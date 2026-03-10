
-- 1. Trigger: block payments if ciclo has no apuração or is not active
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
  -- Get ciclo from apuração
  SELECT ciclo_id INTO v_ciclo_id
  FROM public.t2_apuracoes
  WHERE id = NEW.apuracao_id;

  IF v_ciclo_id IS NULL THEN
    RAISE EXCEPTION 'Este ciclo ainda não foi apurado.';
  END IF;

  SELECT status INTO v_ciclo_status
  FROM public.t2_ciclos
  WHERE id = v_ciclo_id;

  IF v_ciclo_status <> 'ativo' THEN
    RAISE EXCEPTION 'Pagamentos só podem ser registrados em ciclos ativos (status atual: %).', v_ciclo_status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER t2_validar_pagamento_ciclo_trigger
  BEFORE INSERT ON public.t2_pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.t2_validar_pagamento_ciclo();

-- 2. Trigger: enforce status flow on t2_ciclos (no regression)
CREATE OR REPLACE FUNCTION public.t2_validar_status_ciclo()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Only allow: ativo → encerrado, ativo → inadimplente
    IF OLD.status = 'ativo' AND NEW.status IN ('encerrado', 'inadimplente') THEN
      RETURN NEW;
    END IF;
    
    RAISE EXCEPTION 'Transição de status inválida: % → %. Fluxo permitido: ativo → encerrado ou inadimplente.', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER t2_validar_status_ciclo_trigger
  BEFORE UPDATE ON public.t2_ciclos
  FOR EACH ROW
  EXECUTE FUNCTION public.t2_validar_status_ciclo();
