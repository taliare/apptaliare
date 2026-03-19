
-- Create leads_observacoes table
CREATE TABLE public.leads_observacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads_revendedoras(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL,
  autor_nome text NOT NULL,
  conteudo text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads_observacoes ENABLE ROW LEVEL SECURITY;

-- RLS: Admin full access
CREATE POLICY "Admin pode gerenciar observacoes" ON public.leads_observacoes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast lookups
CREATE INDEX idx_leads_observacoes_lead_id ON public.leads_observacoes(lead_id);
