-- Adicionar coluna de observações na tabela cobrancas_diarias
ALTER TABLE cobrancas_diarias 
ADD COLUMN observacoes TEXT NULL;

COMMENT ON COLUMN cobrancas_diarias.observacoes IS 'Observações do representante sobre o fechamento do dia';