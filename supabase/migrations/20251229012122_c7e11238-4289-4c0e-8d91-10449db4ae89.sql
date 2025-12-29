-- Criar tabela leads_revendedoras
CREATE TABLE public.leads_revendedoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  cidade TEXT,
  instagram TEXT,
  experiencia_vendas TEXT,
  tempo_disponivel TEXT,
  capital_inicial TEXT,
  motivacao TEXT,
  origem TEXT DEFAULT 'site',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  observacao TEXT
);

-- Enable RLS
ALTER TABLE public.leads_revendedoras ENABLE ROW LEVEL SECURITY;

-- Policy: Admin pode ver todos os leads
CREATE POLICY "Admin pode ver todos os leads"
ON public.leads_revendedoras
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Admin pode atualizar leads
CREATE POLICY "Admin pode atualizar leads"
ON public.leads_revendedoras
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Inserção pública (para o site inserir leads)
CREATE POLICY "Inserção pública de leads"
ON public.leads_revendedoras
FOR INSERT
WITH CHECK (true);

-- Index para buscas
CREATE INDEX idx_leads_revendedoras_created_at ON public.leads_revendedoras(created_at DESC);
CREATE INDEX idx_leads_revendedoras_status ON public.leads_revendedoras(status);