CREATE OR REPLACE FUNCTION public.recalcular_cobranca_por_historico(p_cobranca_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total numeric := 0;
  v_valor_previsto numeric := 0;
  v_valor_adiantado numeric := 0;
  v_status status_cobranca;
  v_data_quitacao date;
  v_saldo numeric := 0;
BEGIN
  SELECT COALESCE(SUM(valor), 0)
  INTO v_total
  FROM public.pagamentos_historico
  WHERE cobranca_id = p_cobranca_id;

  SELECT COALESCE(valor_previsto, 0), COALESCE(valor_adiantado, 0), status, data_quitacao
  INTO v_valor_previsto, v_valor_adiantado, v_status, v_data_quitacao
  FROM public.cobrancas_agendadas
  WHERE id = p_cobranca_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_saldo := v_valor_previsto - v_total - v_valor_adiantado;

  SET LOCAL session_replication_role = replica;

  UPDATE public.cobrancas_agendadas
  SET
    valor_pago_acumulado = v_total,
    status = CASE
      WHEN v_status IN ('juridico'::status_cobranca, 'cancelado'::status_cobranca) THEN v_status
      WHEN v_valor_previsto > 0 AND v_saldo <= 0 THEN 'pago'::status_cobranca
      WHEN v_total > 0 OR v_valor_adiantado > 0 THEN 'parcial'::status_cobranca
      ELSE 'pendente'::status_cobranca
    END,
    data_quitacao = CASE
      WHEN v_status IN ('juridico'::status_cobranca, 'cancelado'::status_cobranca) THEN v_data_quitacao
      WHEN v_valor_previsto > 0 AND v_saldo <= 0 THEN COALESCE(v_data_quitacao, CURRENT_DATE)
      ELSE NULL
    END
  WHERE id = p_cobranca_id;

  SET LOCAL session_replication_role = DEFAULT;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_sincronizar_cobranca_apos_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.recalcular_cobranca_por_historico(COALESCE(NEW.cobranca_id, OLD.cobranca_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_cobranca_apos_historico ON public.pagamentos_historico;
CREATE TRIGGER trg_sincronizar_cobranca_apos_historico
AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos_historico
FOR EACH ROW
EXECUTE FUNCTION public.fn_sincronizar_cobranca_apos_historico();

SELECT public.recalcular_cobranca_por_historico(cobranca_id)
FROM (
  SELECT DISTINCT cobranca_id
  FROM public.pagamentos_historico
  WHERE cobranca_id IS NOT NULL
) historicos;