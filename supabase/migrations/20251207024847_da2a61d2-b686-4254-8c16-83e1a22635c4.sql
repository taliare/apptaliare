-- Adicionar campo para data de encaminhamento ao jurídico
ALTER TABLE public.cobrancas_agendadas 
ADD COLUMN IF NOT EXISTS data_encaminhado_juridico timestamp with time zone;