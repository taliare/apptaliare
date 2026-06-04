ALTER TABLE public.transacoes_bancarias
  ADD COLUMN IF NOT EXISTS name_ofx text,
  ADD COLUMN IF NOT EXISTS memo_ofx text,
  ADD COLUMN IF NOT EXISTS trntype text,
  ADD COLUMN IF NOT EXISTS despesa_id uuid REFERENCES public.dre_despesas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transacoes_status ON public.transacoes_bancarias(status_conciliacao);