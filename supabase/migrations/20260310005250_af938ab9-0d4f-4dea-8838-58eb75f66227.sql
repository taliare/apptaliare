-- Clean duplicate apuracoes keeping the most recent one per ciclo_id
DELETE FROM public.t2_apuracoes a
USING public.t2_apuracoes b
WHERE a.ciclo_id = b.ciclo_id
  AND a.data_apuracao < b.data_apuracao;

-- Now add the UNIQUE constraint
ALTER TABLE public.t2_apuracoes ADD CONSTRAINT t2_apuracoes_ciclo_id_unique UNIQUE (ciclo_id);