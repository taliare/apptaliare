
-- 1. BACKFILL: notas com kit vinculado recebem o valor real do estoque
UPDATE public.cobrancas_agendadas c
SET valor_kit_original = kes.valor
FROM public.kits_entregues ke
JOIN public.kits_estoque kes ON kes.id = ke.kit_estoque_id
WHERE ke.id = c.kit_entregue_id
  AND c.kit_entregue_id IS NOT NULL
  AND kes.valor IS NOT NULL
  AND (c.valor_kit_original IS NULL OR c.valor_kit_original = 0 OR c.valor_kit_original <> kes.valor);

-- 1b. BACKFILL: notas pendentes sem kit vinculado (valor_previsto ainda é o valor do kit)
UPDATE public.cobrancas_agendadas c
SET valor_kit_original = c.valor_previsto
WHERE c.kit_entregue_id IS NULL
  AND c.status = 'pendente'
  AND (c.valor_kit_original IS NULL OR c.valor_kit_original = 0)
  AND c.valor_previsto > 0;

-- 2. ENTREGA: a RPC passa a gravar valor_kit_original = valor do kit
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
  SELECT id, codigo, tipo, valor, status, representante_id
  INTO v_kit
  FROM kits_estoque
  WHERE id = p_kit_id
    AND representante_id = p_user_id
    AND status = 'com_representante'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Kit não encontrado, já entregue ou não pertence a você');
  END IF;

  IF EXISTS (
    SELECT 1 FROM kits_entregues ke
    WHERE ke.codigo_mostruario = v_kit.codigo
      AND ke.representante_id = p_user_id
      AND NOT EXISTS (
        SELECT 1 FROM cobrancas_agendadas ca
        WHERE ca.kit_entregue_id = ke.id AND ca.status = 'cancelado'
      )
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Este kit já foi entregue anteriormente');
  END IF;

  UPDATE kits_estoque SET status = 'com_revendedora' WHERE id = p_kit_id;

  INSERT INTO kits_entregues (
    representante_id, codigo_mostruario, tipo, data_entrega, data_vencimento, kit_estoque_id
  ) VALUES (
    p_user_id, v_kit.codigo, v_kit.tipo, v_data_entrega, p_data_vencimento, p_kit_id
  ) RETURNING id INTO v_kit_entregue_id;

  INSERT INTO cobrancas_agendadas (
    representante_id, revendedora, codigo_nota, tipo,
    valor_previsto, valor_kit_original,
    data_agendada, status, vendedora_id, vendedora, observacoes, kit_entregue_id
  ) VALUES (
    p_user_id, p_revendedora, v_kit.codigo, 'kit',
    COALESCE(v_kit.valor, 0), COALESCE(v_kit.valor, 0),
    p_data_vencimento, 'pendente', p_vendedora_id, p_vendedora_nome,
    'Entrega de kit ' || COALESCE(v_kit.tipo, 'padrão') || ' - Código: ' || v_kit.codigo,
    v_kit_entregue_id
  ) RETURNING id INTO v_cobranca_id;

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
    RETURN json_build_object('success', false, 'error', 'Este kit já foi entregue (registro duplicado)');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;
