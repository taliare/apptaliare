-- 1. Add columns to leads_revendedoras
ALTER TABLE public.leads_revendedoras
ADD COLUMN responsavel_id uuid REFERENCES public.profiles(id),
ADD COLUMN responsavel_nome text;

-- 2. Create status history table
CREATE TABLE public.leads_status_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads_revendedoras(id) ON DELETE CASCADE,
  status_anterior text,
  status_novo text NOT NULL,
  alterado_por uuid REFERENCES public.profiles(id),
  alterado_por_nome text,
  criado_em timestamptz DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.leads_status_historico ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for history table
CREATE POLICY "Admin pode ver histórico"
ON public.leads_status_historico FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode inserir histórico"
ON public.leads_status_historico FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. Migrate existing status values to new format
UPDATE public.leads_revendedoras SET status = 'leads_novos' WHERE status = 'novo';
UPDATE public.leads_revendedoras SET status = 'contato_realizado' WHERE status = 'em_contato';
UPDATE public.leads_revendedoras SET status = 'ativada' WHERE status = 'aprovada';
UPDATE public.leads_revendedoras SET status = 'perdida' WHERE status = 'reprovada';