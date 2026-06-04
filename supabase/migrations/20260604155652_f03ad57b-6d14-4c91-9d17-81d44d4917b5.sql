
-- Garantir triggers de auditoria idempotentes
DROP TRIGGER IF EXISTS trg_revendedoras_audit_upd ON public.revendedoras;
DROP TRIGGER IF EXISTS trg_revendedoras_audit_ins ON public.revendedoras;

CREATE TRIGGER trg_revendedoras_audit_upd
BEFORE UPDATE ON public.revendedoras
FOR EACH ROW EXECUTE FUNCTION public.fn_revendedoras_audit();

CREATE TRIGGER trg_revendedoras_audit_ins
AFTER INSERT ON public.revendedoras
FOR EACH ROW EXECUTE FUNCTION public.fn_revendedoras_audit();

-- RPC robusta para encontrar o cadastro de uma revendedora a partir do nome livre vindo de cobranças/prestações.
-- Estratégia: match normalizado (UPPER + TRIM + unaccent), priorizando o registro com mais dados preenchidos e mais recente.
CREATE OR REPLACE FUNCTION public.buscar_revendedora_match(p_representante_id uuid, p_nome text)
RETURNS public.revendedoras
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_row public.revendedoras;
BEGIN
  v_norm := upper(trim(public.unaccent(coalesce(p_nome, ''))));
  IF v_norm = '' THEN RETURN NULL; END IF;

  SELECT r.* INTO v_row
  FROM public.revendedoras r
  WHERE (p_representante_id IS NULL OR r.representante_id = p_representante_id)
    AND upper(trim(public.unaccent(r.nome))) = v_norm
  ORDER BY
    -- prioriza registros com endereço preenchido
    (CASE WHEN r.cep IS NOT NULL OR r.logradouro IS NOT NULL THEN 0 ELSE 1 END),
    r.atualizado_em DESC NULLS LAST,
    r.criado_em DESC NULLS LAST
  LIMIT 1;

  IF v_row.id IS NOT NULL THEN RETURN v_row; END IF;

  -- fallback: prefixo normalizado (cobre casos onde o nome cadastrado é uma versão mais completa)
  SELECT r.* INTO v_row
  FROM public.revendedoras r
  WHERE (p_representante_id IS NULL OR r.representante_id = p_representante_id)
    AND (
      upper(trim(public.unaccent(r.nome))) LIKE v_norm || '%'
      OR v_norm LIKE upper(trim(public.unaccent(r.nome))) || '%'
    )
  ORDER BY
    (CASE WHEN r.cep IS NOT NULL OR r.logradouro IS NOT NULL THEN 0 ELSE 1 END),
    r.atualizado_em DESC NULLS LAST,
    r.criado_em DESC NULLS LAST
  LIMIT 1;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_revendedora_match(uuid, text) TO authenticated, service_role;
