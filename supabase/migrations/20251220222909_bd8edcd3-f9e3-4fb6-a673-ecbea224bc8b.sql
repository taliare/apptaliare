-- Etapa 2: Criar função RPC atômica para entrega de kit
-- Esta função garante que todas as operações ocorram em uma única transação

CREATE OR REPLACE FUNCTION public.entregar_kit_para_revendedora(
  p_kit_id UUID,
  p_user_id UUID,
  p_revendedora TEXT,
  p_data_vencimento DATE,
  p_vendedora_id UUID DEFAULT NULL,
  p_vendedora_nome TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kit RECORD;
  v_cobranca_id UUID;
  v_kit_entregue_id UUID;
  v_data_entrega DATE := CURRENT_DATE;
BEGIN
  -- 1. Buscar e validar o kit
  SELECT id, codigo, tipo, valor, status, representante_id
  INTO v_kit
  FROM kits_estoque
  WHERE id = p_kit_id
    AND representante_id = p_user_id
    AND status = 'com_representante'
  FOR UPDATE; -- Lock para evitar race conditions

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Kit não encontrado, já entregue ou não pertence a você'
    );
  END IF;

  -- 2. Verificar se já existe entrega deste kit para este representante (evitar duplicata)
  IF EXISTS (
    SELECT 1 FROM kits_entregues 
    WHERE codigo_mostruario = v_kit.codigo 
      AND representante_id = p_user_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Este kit já foi entregue anteriormente'
    );
  END IF;

  -- 3. Atualizar status do kit para "com_revendedora"
  UPDATE kits_estoque
  SET status = 'com_revendedora'
  WHERE id = p_kit_id;

  -- 4. Criar cobrança agendada
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
    observacoes
  ) VALUES (
    p_user_id,
    p_revendedora,
    v_kit.codigo,
    'kit',
    COALESCE(v_kit.valor, 0),
    p_data_vencimento,
    'pendente',
    p_vendedora_id,
    p_vendedora_nome,
    'Entrega de kit ' || COALESCE(v_kit.tipo, 'padrão') || ' - Código: ' || v_kit.codigo
  )
  RETURNING id INTO v_cobranca_id;

  -- 5. Registrar kit entregue
  INSERT INTO kits_entregues (
    representante_id,
    codigo_mostruario,
    tipo,
    data_entrega,
    data_vencimento
  ) VALUES (
    p_user_id,
    v_kit.codigo,
    v_kit.tipo,
    v_data_entrega,
    p_data_vencimento
  )
  RETURNING id INTO v_kit_entregue_id;

  -- 6. Retornar sucesso com IDs criados
  RETURN json_build_object(
    'success', true,
    'kit_codigo', v_kit.codigo,
    'kit_tipo', v_kit.tipo,
    'kit_valor', COALESCE(v_kit.valor, 0),
    'cobranca_id', v_cobranca_id,
    'kit_entregue_id', v_kit_entregue_id
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Este kit já foi entregue (registro duplicado)'
    );
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Criar também a função de reversão atômica melhorada
CREATE OR REPLACE FUNCTION public.reverter_entrega_kit_atomico(
  p_kit_entregue_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kit_entregue RECORD;
BEGIN
  -- 1. Buscar o kit entregue
  SELECT id, codigo_mostruario, representante_id
  INTO v_kit_entregue
  FROM kits_entregues
  WHERE id = p_kit_entregue_id
    AND representante_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Registro de entrega não encontrado ou não pertence a você'
    );
  END IF;

  -- 2. Reverter status do kit no estoque
  UPDATE kits_estoque
  SET status = 'com_representante'
  WHERE codigo = v_kit_entregue.codigo_mostruario
    AND representante_id = p_user_id
    AND status = 'com_revendedora';

  -- 3. Deletar cobrança agendada associada
  DELETE FROM cobrancas_agendadas
  WHERE representante_id = p_user_id
    AND codigo_nota = v_kit_entregue.codigo_mostruario
    AND tipo = 'kit';

  -- 4. Deletar registro de kit entregue
  DELETE FROM kits_entregues
  WHERE id = p_kit_entregue_id;

  RETURN json_build_object(
    'success', true,
    'codigo_kit', v_kit_entregue.codigo_mostruario
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;