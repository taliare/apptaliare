ALTER TABLE public.revendedoras
DROP CONSTRAINT IF EXISTS revendedoras_nome_representante_id_key;

CREATE INDEX IF NOT EXISTS idx_revendedoras_nome_representante
ON public.revendedoras (nome, representante_id);