CREATE TABLE public.t2_interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL REFERENCES t2_ciclos(id) ON DELETE CASCADE,
  observacao text NOT NULL,
  registrado_por uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.t2_interacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert interacoes"
  ON public.t2_interacoes FOR INSERT TO authenticated
  WITH CHECK (registrado_por = auth.uid());

CREATE POLICY "Admin full access t2_interacoes"
  ON public.t2_interacoes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante can view interacoes"
  ON public.t2_interacoes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.t2_ciclos c
      WHERE c.id = ciclo_id
      AND c.representante_id = auth.uid()
    )
  );