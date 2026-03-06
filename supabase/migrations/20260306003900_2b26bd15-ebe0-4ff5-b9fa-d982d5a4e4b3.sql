
CREATE OR REPLACE VIEW public.t2_vw_radar_revendedoras AS
SELECT
  r.id AS revendedora_id,
  r.nome_completo AS nome_revendedora,
  r.representante_id,
  r.cidade,
  r.categoria_atual,
  r.score,
  COALESCE(h.total_vendido, 0) AS total_vendido,
  COALESCE(h.total_ciclos, 0) AS total_ciclos,
  h.data_ultimo_ciclo AS ultimo_ciclo_data,
  CASE
    WHEN h.data_ultimo_ciclo IS NULL THEN NULL
    ELSE (CURRENT_DATE - h.data_ultimo_ciclo::date)
  END AS dias_sem_vender,
  CASE
    WHEN h.data_ultimo_ciclo IS NULL THEN 'RISCO'
    WHEN (CURRENT_DATE - h.data_ultimo_ciclo::date) <= 45 THEN 'ATIVA'
    WHEN (CURRENT_DATE - h.data_ultimo_ciclo::date) <= 90 THEN 'ATENCAO'
    ELSE 'RISCO'
  END AS status_radar
FROM public.t2_revendedoras r
LEFT JOIN public.t2_vw_historico_revendedoras h ON h.revendedora_id = r.id
WHERE r.status NOT IN ('desistencia');
