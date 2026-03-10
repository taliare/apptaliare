
-- 1. Update status validation trigger: ativo → apurado → encerrado
CREATE OR REPLACE FUNCTION public.t2_validar_status_ciclo()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Allow: ativo → apurado, apurado → encerrado
    IF OLD.status = 'ativo' AND NEW.status = 'apurado' THEN
      RETURN NEW;
    END IF;
    IF OLD.status = 'apurado' AND NEW.status = 'encerrado' THEN
      RETURN NEW;
    END IF;
    
    RAISE EXCEPTION 'Transição de status inválida: % → %. Fluxo permitido: ativo → apurado → encerrado.', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Create trigger function: apuração sets ciclo status to 'apurado'
CREATE OR REPLACE FUNCTION public.t2_apuracao_set_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.t2_ciclos
  SET status = 'apurado'
  WHERE id = NEW.ciclo_id;
  RETURN NEW;
END;
$$;

-- 3. Create the trigger on t2_apuracoes
DROP TRIGGER IF EXISTS trg_t2_apuracao_set_status ON public.t2_apuracoes;
CREATE TRIGGER trg_t2_apuracao_set_status
  AFTER INSERT ON public.t2_apuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.t2_apuracao_set_status();

-- 4. Update payment validation: allow payments on 'apurado' cycles
CREATE OR REPLACE FUNCTION public.t2_validar_pagamento_ciclo()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_ciclo_id uuid;
  v_ciclo_status text;
BEGIN
  SELECT ciclo_id INTO v_ciclo_id
  FROM public.t2_apuracoes
  WHERE id = NEW.apuracao_id;

  IF v_ciclo_id IS NULL THEN
    RAISE EXCEPTION 'Este ciclo ainda não foi apurado.';
  END IF;

  SELECT status INTO v_ciclo_status
  FROM public.t2_ciclos
  WHERE id = v_ciclo_id;

  IF v_ciclo_status <> 'apurado' THEN
    RAISE EXCEPTION 'Pagamentos só podem ser registrados em ciclos apurados (status atual: %).', v_ciclo_status;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Update processar_pagamento: only close if status is 'apurado'
CREATE OR REPLACE FUNCTION public.t2_processar_pagamento()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_ciclo_id uuid;
  v_ciclo_status text;
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

  -- Verificar status atual do ciclo
  SELECT status, valor_empresa INTO v_ciclo_status, v_valor_empresa
  FROM public.t2_ciclos
  WHERE id = v_ciclo_id;

  -- Só encerrar se ciclo está apurado
  IF v_ciclo_status = 'apurado' THEN
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

    IF v_saldo_restante <= 0 THEN
      UPDATE public.t2_ciclos
      SET status = 'encerrado'
      WHERE id = v_ciclo_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
