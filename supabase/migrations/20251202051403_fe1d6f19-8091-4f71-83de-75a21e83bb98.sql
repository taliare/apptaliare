-- Adicionar campo vendedora na tabela cobrancas_agendadas
-- Este campo será usado para controle de comissões por vendedora

ALTER TABLE cobrancas_agendadas
ADD COLUMN IF NOT EXISTS vendedora text;

COMMENT ON COLUMN cobrancas_agendadas.vendedora IS 'Nome da vendedora que vendeu o kit (para controle de comissões)';

-- Adicionar campo para rastrear adiantamentos
ALTER TABLE cobrancas_agendadas
ADD COLUMN IF NOT EXISTS valor_adiantado numeric DEFAULT 0;

COMMENT ON COLUMN cobrancas_agendadas.valor_adiantado IS 'Valor total de adiantamentos recebidos para esta cobrança';