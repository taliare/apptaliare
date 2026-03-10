
CREATE OR REPLACE FUNCTION public.t2_validar_pagamento()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_ciclo_id uuid;
  v_valor_empresa numeric;
  v_total_pagamentos numeric;
  v_total_adiantamentos numeric;
  v_saldo_restante numeric;
BEGIN
  -- Get ciclo_id from apuração
  SELECT a.ciclo_id, a.valor_empresa
  INTO v_ciclo_id, v_valor_empresa
  FROM public.t2_apuracoes a
  WHERE a.id = NEW.apuracao_id;

  IF v_ciclo_id IS NULL THEN
    RAISE EXCEPTION 'Apuração não encontrada.';
  END IF;

  -- Sum existing payments for this apuração
  SELECT COALESCE(SUM(valor_pago), 0)
  INTO v_total_pagamentos
  FROM public.t2_pagamentos
  WHERE apuracao_id = NEW.apuracao_id;

  -- Sum adiantamentos for this ciclo
  SELECT COALESCE(SUM(valor), 0)
  INTO v_total_adiantamentos
  FROM public.t2_adiantamentos
  WHERE ciclo_id = v_ciclo_id;

  v_saldo_restante := v_valor_empresa - v_total_pagamentos - v_total_adiantamentos;

  IF NEW.valor_pago > v_saldo_restante THEN
    RAISE EXCEPTION 'Valor maior que o saldo restante do ciclo.';
  END IF;

  RETURN NEW;
END;
$$;
