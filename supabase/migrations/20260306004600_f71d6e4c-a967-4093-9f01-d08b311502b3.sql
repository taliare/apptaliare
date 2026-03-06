
CREATE OR REPLACE VIEW public.t2_vw_previsao_recebimentos
WITH (security_invoker = on)
AS
SELECT
  c.id AS ciclo_id,
  c.revendedora_id,
  r.nome_completo AS nome_revendedora,
  c.representante_id,
  r.cidade,
  COALESCE(c.valor_empresa, 0) AS valor_empresa,
  COALESCE(c.valor_pago, 0) AS valor_pago,
  COALESCE(c.valor_empresa, 0) - COALESCE(c.valor_pago, 0) AS saldo_restante,
  c.data_vencimento,
  c.status AS status_ciclo,
  CASE
    WHEN (COALESCE(c.valor_empresa, 0) - COALESCE(c.valor_pago, 0)) <= 0 THEN 'RECEBIDO'
    WHEN c.data_vencimento < now() AND (COALESCE(c.valor_empresa, 0) - COALESCE(c.valor_pago, 0)) > 0 THEN 'INADIMPLENTE'
    WHEN (COALESCE(c.valor_empresa, 0) - COALESCE(c.valor_pago, 0)) > 0 AND c.data_vencimento >= now() AND c.data_vencimento < (now() + interval '5 days') THEN 'EM_RISCO'
    ELSE 'A_RECEBER'
  END AS status_financeiro
FROM public.t2_ciclos c
JOIN public.t2_revendedoras r ON r.id = c.revendedora_id;
