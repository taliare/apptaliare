-- Fechar todos os dias anteriores que não foram finalizados
UPDATE cobrancas_diarias 
SET 
  finalizado = true,
  observacoes = COALESCE(observacoes || E'\n', '') || '[Fechado por ajuste administrativo do sistema]'
WHERE finalizado = false 
  AND data < CURRENT_DATE;