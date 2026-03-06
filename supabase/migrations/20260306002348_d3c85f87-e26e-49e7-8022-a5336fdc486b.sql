
-- =============================================
-- TABELA t2_apuracoes
-- =============================================
CREATE TABLE public.t2_apuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL REFERENCES public.t2_ciclos(id) ON DELETE CASCADE,
  valor_kit numeric NOT NULL,
  valor_devolvido numeric NOT NULL,
  valor_vendido numeric NOT NULL,
  comissao_percentual numeric NOT NULL,
  valor_comissao numeric NOT NULL,
  valor_empresa numeric NOT NULL,
  saldo_a_receber numeric NOT NULL,
  data_apuracao timestamptz NOT NULL DEFAULT now(),
  apurado_por uuid NOT NULL,
  status text NOT NULL DEFAULT 'apurado'
);

ALTER TABLE public.t2_apuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access t2_apuracoes" ON public.t2_apuracoes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Representante pode ver suas t2_apuracoes" ON public.t2_apuracoes
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (apurado_por = auth.uid());

CREATE POLICY "Representante pode criar t2_apuracoes" ON public.t2_apuracoes
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (apurado_por = auth.uid());

-- =============================================
-- TABELA t2_pagamentos
-- =============================================
CREATE TABLE public.t2_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apuracao_id uuid NOT NULL REFERENCES public.t2_apuracoes(id) ON DELETE CASCADE,
  valor_pago numeric NOT NULL,
  forma_pagamento text,
  observacao text,
  data_pagamento timestamptz NOT NULL DEFAULT now(),
  registrado_por uuid NOT NULL
);

ALTER TABLE public.t2_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access t2_pagamentos" ON public.t2_pagamentos
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Representante pode ver seus t2_pagamentos" ON public.t2_pagamentos
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (registrado_por = auth.uid());

CREATE POLICY "Representante pode criar t2_pagamentos" ON public.t2_pagamentos
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (registrado_por = auth.uid());

-- =============================================
-- VALIDATION TRIGGER: valor_devolvido <= valor_kit
-- =============================================
CREATE OR REPLACE FUNCTION public.t2_validar_apuracao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.valor_devolvido > NEW.valor_kit THEN
    RAISE EXCEPTION 'valor_devolvido não pode ser maior que valor_kit';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER t2_validar_apuracao_trigger
  BEFORE INSERT OR UPDATE ON public.t2_apuracoes
  FOR EACH ROW EXECUTE FUNCTION public.t2_validar_apuracao();

-- =============================================
-- VALIDATION TRIGGER: valor_pago <= saldo_a_receber
-- =============================================
CREATE OR REPLACE FUNCTION public.t2_validar_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo numeric;
BEGIN
  SELECT saldo_a_receber INTO v_saldo
  FROM public.t2_apuracoes
  WHERE id = NEW.apuracao_id;

  IF NEW.valor_pago > v_saldo THEN
    RAISE EXCEPTION 'valor_pago não pode ser maior que saldo_a_receber (R$ %)', v_saldo;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER t2_validar_pagamento_trigger
  BEFORE INSERT ON public.t2_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.t2_validar_pagamento();

-- =============================================
-- TRIGGER: processar pagamento e auto-quitação
-- =============================================
CREATE OR REPLACE FUNCTION public.t2_processar_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ciclo_id uuid;
  v_novo_saldo numeric;
BEGIN
  -- Atualizar saldo da apuração
  UPDATE public.t2_apuracoes
  SET saldo_a_receber = saldo_a_receber - NEW.valor_pago
  WHERE id = NEW.apuracao_id
  RETURNING saldo_a_receber, ciclo_id INTO v_novo_saldo, v_ciclo_id;

  -- Atualizar valor_pago no ciclo
  UPDATE public.t2_ciclos
  SET valor_pago = valor_pago + NEW.valor_pago
  WHERE id = v_ciclo_id;

  -- Se saldo zerou, encerrar ciclo
  IF v_novo_saldo <= 0 THEN
    UPDATE public.t2_ciclos
    SET status = 'encerrado'
    WHERE id = v_ciclo_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER t2_processar_pagamento_trigger
  AFTER INSERT ON public.t2_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.t2_processar_pagamento();
