-- Adicionar campo para relacionar notas promissórias com prestações de contas
-- Isso permite rastrear e reverter cobranças quando notas são excluídas

ALTER TABLE prestacoes_contas
ADD COLUMN IF NOT EXISTS codigo_nota_referencia text;

COMMENT ON COLUMN prestacoes_contas.codigo_nota_referencia IS 'Código da nota promissória gerada no pagamento parcial, usado para rastrear e reverter se a nota for excluída';