
-- Fix views to use SECURITY INVOKER instead of SECURITY DEFINER
ALTER VIEW public.t2_vw_historico_revendedoras SET (security_invoker = on);
ALTER VIEW public.t2_vw_ranking_revendedoras SET (security_invoker = on);
