CREATE OR REPLACE FUNCTION public.t2_processar_pagamento()
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
  -- Atualizar saldo da apuração
  UPDATE public.t2_apuracoes
  SET saldo_a_receber = saldo_a_receber - NEW.valor_pago
  WHERE id = NEW.apuracao_id
  RETURNING ciclo_id INTO v_ciclo_id;

  -- Atualizar valor_pago no ciclo
  UPDATE public.t2_ciclos
  SET valor_pago = valor_pago + NEW.valor_pago
  WHERE id = v_ciclo_id;

  -- Calcular saldo restante real a partir dos dados brutos
  SELECT valor_empresa INTO v_valor_empresa
  FROM public.t2_ciclos
  WHERE id = v_ciclo_id;

  SELECT COALESCE(SUM(p.valor_pago), 0)
  INTO v_total_pagamentos
  FROM public.t2_pagamentos p
  JOIN public.t2_apuracoes a ON a.id = p.apuracao_id
  WHERE a.ciclo_id = v_ciclo_id;

  SELECT COALESCE(SUM(valor), 0)
  INTO v_total_adiantamentos
  FROM public.t2_adiantamentos
  WHERE ciclo_id = v_ciclo_id;

  v_saldo_restante := v_valor_empresa - v_total_pagamentos - v_total_adiantamentos;

  -- Se saldo zerou, encerrar ciclo
  IF v_saldo_restante <= 0 THEN
    UPDATE public.t2_ciclos
    SET status = 'encerrado'
    WHERE id = v_ciclo_id;
  END IF;

  RETURN NEW;
END;
$$;