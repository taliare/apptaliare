-- Adicionar campos tipo e codigo_nota à tabela cobrancas_agendadas
ALTER TABLE cobrancas_agendadas 
ADD COLUMN IF NOT EXISTS tipo text,
ADD COLUMN IF NOT EXISTS codigo_nota text;

-- Criar índice para evitar duplicações
CREATE INDEX IF NOT EXISTS idx_cobrancas_codigo_nota ON cobrancas_agendadas(codigo_nota, representante_id) WHERE codigo_nota IS NOT NULL;