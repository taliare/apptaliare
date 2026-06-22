CREATE OR REPLACE FUNCTION public.corrigir_revendedora_da_nota(
  p_cobranca_id uuid,
  p_nova_revendedora text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem corrigir a revendedora de uma nota' USING ERRCODE = '42501';
  END IF;

  IF p_nova_revendedora IS NULL OR length(trim(p_nova_revendedora)) = 0 THEN
    RAISE EXCEPTION 'Nome da revendedora é obrigatório';
  END IF;

  UPDATE public.cobrancas_agendadas
  SET revendedora = p_nova_revendedora
  WHERE id = p_cobranca_id;

  UPDATE public.prestacoes_contas
  SET revendedora = p_nova_revendedora
  WHERE cobranca_id = p_cobranca_id;

  UPDATE public.acrescimos_pedido
  SET revendedora = p_nova_revendedora
  WHERE cobranca_id = p_cobranca_id;
END;
$$;

REVOKE ALL ON FUNCTION public.corrigir_revendedora_da_nota(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.corrigir_revendedora_da_nota(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.corrigir_revendedora_da_nota(uuid, text) TO authenticated;