
-- =============================================
-- Tabela: acrescimos_pedido
-- =============================================
CREATE TABLE public.acrescimos_pedido (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kit_entregue_id UUID NOT NULL REFERENCES public.kits_entregues(id),
  cobranca_id UUID REFERENCES public.cobrancas_agendadas(id),
  representante_id UUID NOT NULL REFERENCES public.profiles(id),
  revendedora TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  descricao TEXT,
  data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- RLS
-- =============================================
ALTER TABLE public.acrescimos_pedido ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode gerenciar todos acrescimos"
ON public.acrescimos_pedido
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode ver seus acrescimos"
ON public.acrescimos_pedido
FOR SELECT
USING (representante_id = auth.uid());

CREATE POLICY "Representante pode criar seus acrescimos"
ON public.acrescimos_pedido
FOR INSERT
WITH CHECK (representante_id = auth.uid());

CREATE POLICY "Representante pode atualizar seus acrescimos"
ON public.acrescimos_pedido
FOR UPDATE
USING (representante_id = auth.uid());

-- =============================================
-- Função RPC: registrar_acrescimo_pedido
-- =============================================
CREATE OR REPLACE FUNCTION public.registrar_acrescimo_pedido(
  p_kit_entregue_id UUID,
  p_user_id UUID,
  p_revendedora TEXT,
  p_valor NUMERIC,
  p_descricao TEXT DEFAULT NULL,
  p_data_vencimento DATE DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_kit_entregue RECORD;
  v_cobranca_id UUID;
  v_acrescimo_id UUID;
  v_data_vencimento DATE;
BEGIN
  -- 1. Validar que o kit_entregue pertence ao representante
  SELECT ke.id, ke.codigo_mostruario, ke.representante_id, ke.kit_estoque_id,
         ca.vendedora_id, ca.vendedora
  INTO v_kit_entregue
  FROM kits_entregues ke
  LEFT JOIN cobrancas_agendadas ca ON ca.kit_entregue_id = ke.id AND ca.tipo = 'kit'
  WHERE ke.id = p_kit_entregue_id
    AND ke.representante_id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Kit entregue não encontrado ou não pertence a você'
    );
  END IF;

  -- 2. Definir data de vencimento (usa a fornecida ou data atual + 30 dias)
  v_data_vencimento := COALESCE(p_data_vencimento, CURRENT_DATE + INTERVAL '30 days');

  -- 3. Inserir o acrescimo
  INSERT INTO acrescimos_pedido (
    kit_entregue_id,
    representante_id,
    revendedora,
    valor,
    descricao,
    data_lancamento,
    status
  ) VALUES (
    p_kit_entregue_id,
    p_user_id,
    p_revendedora,
    p_valor,
    p_descricao,
    CURRENT_DATE,
    'pendente'
  )
  RETURNING id INTO v_acrescimo_id;

  -- 4. Criar cobranca_agendada tipo 'acrescimo'
  INSERT INTO cobrancas_agendadas (
    representante_id,
    revendedora,
    codigo_nota,
    tipo,
    valor_previsto,
    data_agendada,
    status,
    vendedora_id,
    vendedora,
    observacoes,
    kit_entregue_id
  ) VALUES (
    p_user_id,
    p_revendedora,
    v_kit_entregue.codigo_mostruario,
    'acrescimo',
    p_valor,
    v_data_vencimento,
    'pendente',
    v_kit_entregue.vendedora_id,
    v_kit_entregue.vendedora,
    COALESCE(p_descricao, 'Acréscimo de joias adicionais') || ' - Kit: ' || v_kit_entregue.codigo_mostruario,
    p_kit_entregue_id
  )
  RETURNING id INTO v_cobranca_id;

  -- 5. Atualizar cobranca_id no acrescimo
  UPDATE acrescimos_pedido
  SET cobranca_id = v_cobranca_id
  WHERE id = v_acrescimo_id;

  -- 6. Retornar sucesso
  RETURN json_build_object(
    'success', true,
    'acrescimo_id', v_acrescimo_id,
    'cobranca_id', v_cobranca_id,
    'kit_codigo', v_kit_entregue.codigo_mostruario,
    'valor', p_valor
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;
