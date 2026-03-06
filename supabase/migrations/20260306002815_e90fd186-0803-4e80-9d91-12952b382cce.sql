
-- Tabela de adiantamentos
CREATE TABLE public.t2_adiantamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL REFERENCES public.t2_ciclos(id) ON DELETE CASCADE,
  revendedora_id uuid NOT NULL,
  representante_id uuid NOT NULL,
  valor numeric NOT NULL,
  forma_pagamento text,
  observacao text,
  data_pagamento timestamptz NOT NULL DEFAULT now(),
  registrado_por uuid NOT NULL
);

ALTER TABLE public.t2_adiantamentos ENABLE ROW LEVEL SECURITY;

-- RLS: Admin full access
CREATE POLICY "Admin full access t2_adiantamentos"
  ON public.t2_adiantamentos FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS: Representante pode criar
CREATE POLICY "Representante pode criar t2_adiantamentos"
  ON public.t2_adiantamentos FOR INSERT
  TO authenticated
  WITH CHECK (registrado_por = auth.uid());

-- RLS: Representante pode ver seus adiantamentos
CREATE POLICY "Representante pode ver seus t2_adiantamentos"
  ON public.t2_adiantamentos FOR SELECT
  TO authenticated
  USING (registrado_por = auth.uid());

-- Trigger: validar adiantamento (ciclo ativo + valor <= valor_kit)
CREATE OR REPLACE FUNCTION public.t2_validar_adiantamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
  v_valor_kit numeric;
  v_total_adiantamentos numeric;
BEGIN
  SELECT status, valor_kit INTO v_status, v_valor_kit
  FROM public.t2_ciclos WHERE id = NEW.ciclo_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Ciclo não encontrado';
  END IF;

  IF v_status <> 'ativo' THEN
    RAISE EXCEPTION 'Adiantamentos só podem ser registrados em ciclos ativos';
  END IF;

  SELECT COALESCE(SUM(valor), 0) INTO v_total_adiantamentos
  FROM public.t2_adiantamentos WHERE ciclo_id = NEW.ciclo_id;

  IF (v_total_adiantamentos + NEW.valor) > v_valor_kit THEN
    RAISE EXCEPTION 'Total de adiantamentos (R$ %) não pode ultrapassar o valor do kit (R$ %)', 
      v_total_adiantamentos + NEW.valor, v_valor_kit;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER t2_validar_adiantamento_trigger
  BEFORE INSERT ON public.t2_adiantamentos
  FOR EACH ROW EXECUTE FUNCTION public.t2_validar_adiantamento();
