-- Adicionar coluna para rastrear origem do lead externo
ALTER TABLE public.leads_revendedoras 
ADD COLUMN IF NOT EXISTS external_id uuid UNIQUE;

-- Índice para busca rápida por external_id
CREATE INDEX IF NOT EXISTS idx_leads_external_id 
ON public.leads_revendedoras(external_id);