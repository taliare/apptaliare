
CREATE OR REPLACE VIEW public.t2_vw_performance_representantes
WITH (security_invoker = on)
AS
SELECT
  r.representante_id,
  COUNT(DISTINCT r.id) AS total_revendedoras,
  COUNT(DISTINCT CASE WHEN c_ativo.id IS NOT NULL THEN r.id END) AS revendedoras_ativas,
  COUNT(DISTINCT CASE WHEN radar.status_radar = 'RISCO' THEN r.id END) AS revendedoras_em_risco,
  COUNT(DISTINCT CASE WHEN radar.status_radar = 'ATENCAO' THEN r.id END) AS revendedoras_atencao,
  COALESCE(ciclos_agg.total_ciclos, 0) AS total_ciclos,
  COALESCE(apur_agg.total_vendido, 0) AS total_vendido,
  CASE WHEN COALESCE(ciclos_agg.total_ciclos, 0) > 0
    THEN ROUND(COALESCE(apur_agg.total_vendido, 0) / ciclos_agg.total_ciclos, 2)
    ELSE 0
  END AS ticket_medio,
  COALESCE(ciclos_agg.total_recebido_empresa, 0) AS total_recebido_empresa,
  COALESCE(inadimp.inadimplencia_total, 0) AS inadimplencia_total
FROM public.t2_revendedoras r
LEFT JOIN public.t2_vw_radar_revendedoras radar ON radar.revendedora_id = r.id
LEFT JOIN public.t2_ciclos c_ativo ON c_ativo.revendedora_id = r.id AND c_ativo.status = 'ativo'
LEFT JOIN LATERAL (
  SELECT
    c.representante_id,
    COUNT(*) AS total_ciclos,
    COALESCE(SUM(c.valor_pago), 0) AS total_recebido_empresa
  FROM public.t2_ciclos c
  WHERE c.representante_id = r.representante_id
  GROUP BY c.representante_id
) ciclos_agg ON true
LEFT JOIN LATERAL (
  SELECT
    SUM(a.valor_vendido) AS total_vendido
  FROM public.t2_apuracoes a
  JOIN public.t2_ciclos cc ON cc.id = a.ciclo_id
  WHERE cc.representante_id = r.representante_id
) apur_agg ON true
LEFT JOIN LATERAL (
  SELECT
    SUM(a2.saldo_a_receber) AS inadimplencia_total
  FROM public.t2_apuracoes a2
  JOIN public.t2_ciclos cc2 ON cc2.id = a2.ciclo_id
  WHERE cc2.representante_id = r.representante_id
    AND cc2.status = 'inadimplente'
) inadimp ON true
WHERE r.representante_id IS NOT NULL
GROUP BY r.representante_id, ciclos_agg.total_ciclos, ciclos_agg.total_recebido_empresa, apur_agg.total_vendido, inadimp.inadimplencia_total;
