
-- 1. Limpeza dos registros órfãos do kit 5708
DELETE FROM acrescimos_pedido WHERE kit_entregue_id = '3dc79ad2-b8ff-443a-99cb-83376999b6ab';
DELETE FROM cobrancas_agendadas WHERE id = 'a33653f2-3042-4075-a184-09375941b3da';
DELETE FROM kits_entregues WHERE id = '3dc79ad2-b8ff-443a-99cb-83376999b6ab';

-- 2. Atualizar função para ignorar entregas com cobrança cancelada
CREATE OR REPLACE FUNCTION public.entregar_kit_para_revendedora(p_kit_id uuid, p_user_id uuid, p_revendedora text, p_data_vencimento date, p_vendedora_id uuid DEFAULT NULL::uuid, p_vendedora_nome text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Kit não encontrado, já entregue ou não pertence a você'
    );
  END IF;

  -- 2. Verificar se já existe entrega ATIVA deste kit (ignora entregas com cobrança cancelada)
  IF EXISTS (
    SELECT 1 FROM kits_entregues ke
    WHERE ke.codigo_mostruario = v_kit.codigo 
      AND ke.representante_id = p_user_id
      AND NOT EXISTS (
        SELECT 1 FROM cobrancas_agendadas ca
        WHERE ca.kit_entregue_id = ke.id
          AND ca.status = 'cancelado'
      )
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

  -- 4. Registrar kit entregue COM referência ao kit_estoque
  INSERT INTO kits_entregues (
    representante_id,
    codigo_mostruario,
    tipo,
    data_entrega,
    data_vencimento,
    kit_estoque_id
  ) VALUES (
    p_user_id,
    v_kit.codigo,
    v_kit.tipo,
    v_data_entrega,
    p_data_vencimento,
    p_kit_id
  )
  RETURNING id INTO v_kit_entregue_id;

  -- 5. Criar cobrança agendada COM referência ao kit_entregue
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
    v_kit.codigo,
    'kit',
    COALESCE(v_kit.valor, 0),
    p_data_vencimento,
    'pendente',
    p_vendedora_id,
    p_vendedora_nome,
    'Entrega de kit ' || COALESCE(v_kit.tipo, 'padrão') || ' - Código: ' || v_kit.codigo,
    v_kit_entregue_id
  )
  RETURNING id INTO v_cobranca_id;

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
$function$;
