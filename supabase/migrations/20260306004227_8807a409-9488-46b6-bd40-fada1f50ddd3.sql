
CREATE OR REPLACE VIEW public.t2_vw_ranking_representantes
WITH (security_invoker = on)
AS
SELECT
  representante_id,
  total_vendido,
  total_ciclos,
  ticket_medio,
  revendedoras_ativas,
  inadimplencia_total
FROM public.t2_vw_performance_representantes
ORDER BY total_vendido DESC;
