
CREATE TABLE public.despesas_fechamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fechamento_id UUID NOT NULL REFERENCES public.cobrancas_diarias(id) ON DELETE CASCADE,
  representante_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL CHECK (valor >= 0),
  conciliado BOOLEAN NOT NULL DEFAULT false,
  categoria_id UUID NULL REFERENCES public.dre_categorias_despesas(id) ON DELETE SET NULL,
  despesa_id UUID NULL REFERENCES public.dre_despesas(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_despesas_fechamento_fechamento ON public.despesas_fechamento(fechamento_id);
CREATE INDEX idx_despesas_fechamento_rep ON public.despesas_fechamento(representante_id);
CREATE INDEX idx_despesas_fechamento_conciliado ON public.despesas_fechamento(conciliado) WHERE conciliado = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_fechamento TO authenticated;
GRANT ALL ON public.despesas_fechamento TO service_role;

ALTER TABLE public.despesas_fechamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rep_select_own_despesas_fechamento"
  ON public.despesas_fechamento FOR SELECT TO authenticated
  USING (representante_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "rep_insert_own_despesas_fechamento"
  ON public.despesas_fechamento FOR INSERT TO authenticated
  WITH CHECK (representante_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "rep_delete_own_despesas_fechamento"
  ON public.despesas_fechamento FOR DELETE TO authenticated
  USING (
    (representante_id = auth.uid() AND conciliado = false)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "admin_update_despesas_fechamento"
  ON public.despesas_fechamento FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
