ALTER TABLE public.t2_ciclos ADD COLUMN data_cobranca DATE;
UPDATE public.t2_ciclos SET data_cobranca = (data_inicio + INTERVAL '45 days')::date WHERE data_cobranca IS NULL;