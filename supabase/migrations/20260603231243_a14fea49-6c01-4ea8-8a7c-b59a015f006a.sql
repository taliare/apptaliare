CREATE OR REPLACE FUNCTION public.verificar_bloqueio_juridico(p_nome TEXT, p_cpf TEXT DEFAULT NULL)
RETURNS TABLE(blocked BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome_norm TEXT;
  v_cpf_norm TEXT;
  v_found BOOLEAN;
BEGIN
  v_nome_norm := UPPER(TRIM(public.unaccent(COALESCE(p_nome, ''))));
  v_cpf_norm := REGEXP_REPLACE(COALESCE(p_cpf, ''), '\D', '', 'g');

  SELECT EXISTS(
    SELECT 1 FROM public.juridico_bloqueados
    WHERE (v_nome_norm <> '' AND nome_norm = v_nome_norm)
       OR (v_cpf_norm <> '' AND cpf = v_cpf_norm)
  ) INTO v_found;

  RETURN QUERY SELECT v_found;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verificar_bloqueio_juridico(TEXT, TEXT) TO authenticated, anon, service_role;