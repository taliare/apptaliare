REVOKE ALL ON FUNCTION public.recalcular_cobranca_por_historico(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalcular_cobranca_por_historico(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.recalcular_cobranca_por_historico(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_cobranca_por_historico(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fn_sincronizar_cobranca_apos_historico() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_sincronizar_cobranca_apos_historico() FROM anon;
REVOKE ALL ON FUNCTION public.fn_sincronizar_cobranca_apos_historico() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_sincronizar_cobranca_apos_historico() TO service_role;