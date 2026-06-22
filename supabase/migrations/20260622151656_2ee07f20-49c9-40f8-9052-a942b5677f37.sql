CREATE OR REPLACE FUNCTION public.reverter_entrega_kit(p_cobranca_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_codigo text;
  v_rep uuid;
  v_pago numeric;
  v_status status_cobranca;
  v_kit_id uuid;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem reverter entregas' USING ERRCODE = '42501';
  END IF;

  SELECT codigo_nota, representante_id, COALESCE(valor_pago_acumulado, 0), status
  INTO v_codigo, v_rep, v_pago, v_status
  FROM public.cobrancas_agendadas
  WHERE id = p_cobranca_id
  FOR UPDATE;

  IF v_codigo IS NULL THEN
    RAISE EXCEPTION 'Nota não encontrada';
  END IF;

  IF v_pago > 0
     OR v_status IN ('pago'::status_cobranca, 'parcial'::status_cobranca)
     OR EXISTS (SELECT 1 FROM public.prestacoes_contas WHERE cobranca_id = p_cobranca_id) THEN
    RAISE EXCEPTION 'Esta nota já possui pagamento ou prestação registrada. Estorne o pagamento antes de reverter a entrega.';
  END IF;

  SELECT id INTO v_kit_id
  FROM public.kits_estoque
  WHERE codigo = v_codigo
    AND representante_id = v_rep
    AND status = 'com_revendedora'
  LIMIT 1;

  IF v_kit_id IS NOT NULL THEN
    UPDATE public.kits_estoque
    SET status = 'com_representante'
    WHERE id = v_kit_id;

    DELETE FROM public.kits_entregues WHERE kit_estoque_id = v_kit_id;
  END IF;

  -- Fallback: registros de entrega antigos sem kit_estoque_id vinculado
  DELETE FROM public.kits_entregues
  WHERE codigo_mostruario = v_codigo
    AND representante_id = v_rep;

  UPDATE public.cobrancas_agendadas
  SET status = 'cancelado'::status_cobranca
  WHERE id = p_cobranca_id;

  INSERT INTO public.audit_logs (user_id, target_user_id, action, details)
  VALUES (
    v_caller,
    v_rep,
    'entrega_revertida',
    jsonb_build_object(
      'cobranca_id', p_cobranca_id,
      'codigo_nota', v_codigo,
      'representante_id', v_rep,
      'kit_estoque_id', v_kit_id,
      'kit_devolvido', v_kit_id IS NOT NULL
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'kit_devolvido', v_kit_id IS NOT NULL,
    'codigo', v_codigo
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reverter_entrega_kit(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reverter_entrega_kit(uuid) TO authenticated;