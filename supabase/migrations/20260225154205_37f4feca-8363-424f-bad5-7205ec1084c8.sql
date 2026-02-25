
CREATE OR REPLACE FUNCTION public.registrar_acrescimo_pedido(p_kit_entregue_id uuid, p_user_id uuid, p_revendedora text, p_valor numeric, p_descricao text DEFAULT NULL::text, p_data_vencimento date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_kit_entregue RECORD;
  v_cobranca_id UUID;
  v_acrescimo_id UUID;
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

  -- 2. Inserir o acrescimo
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

  -- 3. Buscar cobranca original tipo 'kit' do mesmo kit_entregue_id
  SELECT id INTO v_cobranca_id
  FROM cobrancas_agendadas
  WHERE kit_entregue_id = p_kit_entregue_id
    AND tipo = 'kit'
  LIMIT 1;

  -- 4. Somar acrescimo ao valor_previsto da nota original
  IF v_cobranca_id IS NOT NULL THEN
    UPDATE cobrancas_agendadas
    SET valor_previsto = valor_previsto + p_valor
    WHERE id = v_cobranca_id;
  END IF;

  -- 5. Vincular acrescimo a nota original
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
$function$;
