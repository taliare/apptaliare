
-- Adicionar colunas para controle de pagamento parcial acumulado
ALTER TABLE public.cobrancas_agendadas
  ADD COLUMN valor_pago_acumulado NUMERIC DEFAULT 0,
  ADD COLUMN data_quitacao DATE;
