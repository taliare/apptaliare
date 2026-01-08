-- Adicionar cobranca_id na tabela notas_promissorias para rastrear a cobrança original
ALTER TABLE public.notas_promissorias 
ADD COLUMN IF NOT EXISTS cobranca_id uuid;

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_notas_promissorias_cobranca_id ON public.notas_promissorias(cobranca_id);