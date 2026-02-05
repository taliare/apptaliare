
-- 1. Criar tabela para rastrear leads externos deletados
CREATE TABLE public.leads_external_deletados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id UUID NOT NULL UNIQUE,
  deletado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deletado_por UUID
);

-- Habilitar RLS
ALTER TABLE public.leads_external_deletados ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver
CREATE POLICY "Admin pode ver leads deletados"
ON public.leads_external_deletados
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Apenas admins podem inserir
CREATE POLICY "Admin pode inserir leads deletados"
ON public.leads_external_deletados
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Apenas admins podem deletar
CREATE POLICY "Admin pode deletar leads deletados"
ON public.leads_external_deletados
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Atualizar função delete_lead_with_history para salvar external_id antes de deletar
CREATE OR REPLACE FUNCTION public.delete_lead_with_history(p_lead_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead_nome TEXT;
  v_external_id UUID;
  v_deleted_history_count INT;
BEGIN
  -- Buscar nome e external_id do lead
  SELECT nome, external_id INTO v_lead_nome, v_external_id
  FROM leads_revendedoras
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Lead não encontrado'
    );
  END IF;

  -- Se o lead tem external_id, salvar na tabela de deletados para evitar reimportação
  IF v_external_id IS NOT NULL THEN
    INSERT INTO leads_external_deletados (external_id)
    VALUES (v_external_id)
    ON CONFLICT (external_id) DO NOTHING;
  END IF;

  -- Deletar histórico de status
  DELETE FROM leads_status_historico
  WHERE lead_id = p_lead_id;
  
  GET DIAGNOSTICS v_deleted_history_count = ROW_COUNT;

  -- Deletar o lead
  DELETE FROM leads_revendedoras
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Falha ao excluir lead'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'lead_nome', v_lead_nome,
    'historico_deletado', v_deleted_history_count,
    'external_id_rastreado', v_external_id IS NOT NULL
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;
