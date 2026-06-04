
-- 1) Função de checagem (também usada pelo front para feedback antecipado)
CREATE OR REPLACE FUNCTION public.checar_duplicidade_revendedora(
  p_representante_id uuid,
  p_nome text,
  p_cpf text,
  p_whatsapp text,
  p_ignorar_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome_norm text;
  v_cpf_norm text;
  v_wpp_norm text;
  v_wpp_tail text;
  v_row record;
  v_motivo text;
BEGIN
  v_nome_norm := upper(trim(public.unaccent(coalesce(p_nome, ''))));
  v_cpf_norm := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_wpp_norm := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  v_wpp_tail := CASE WHEN length(v_wpp_norm) >= 8 THEN right(v_wpp_norm, 11) ELSE NULL END;

  -- procura match por CPF, WhatsApp (últimos 11 dígitos) ou nome normalizado em outro representante
  SELECT r.id, r.representante_id, r.nome,
         r.cpf, r.whatsapp,
         COALESCE(p.nome, 'outro representante') AS rep_nome,
         CASE
           WHEN v_cpf_norm <> '' AND r.cpf = v_cpf_norm THEN 'cpf'
           WHEN v_wpp_tail IS NOT NULL AND right(regexp_replace(coalesce(r.whatsapp,''), '\D','','g'), 11) = v_wpp_tail THEN 'whatsapp'
           WHEN v_nome_norm <> '' AND upper(trim(public.unaccent(r.nome))) = v_nome_norm THEN 'nome'
           ELSE NULL
         END AS motivo
  INTO v_row
  FROM public.revendedoras r
  LEFT JOIN public.profiles p ON p.id = r.representante_id
  WHERE (p_ignorar_id IS NULL OR r.id <> p_ignorar_id)
    AND (p_representante_id IS NULL OR r.representante_id IS DISTINCT FROM p_representante_id)
    AND (
      (v_cpf_norm <> '' AND r.cpf = v_cpf_norm)
      OR (v_wpp_tail IS NOT NULL AND right(regexp_replace(coalesce(r.whatsapp,''), '\D','','g'), 11) = v_wpp_tail)
      OR (v_nome_norm <> '' AND upper(trim(public.unaccent(r.nome))) = v_nome_norm)
    )
  ORDER BY
    CASE
      WHEN v_cpf_norm <> '' AND r.cpf = v_cpf_norm THEN 0
      WHEN v_wpp_tail IS NOT NULL AND right(regexp_replace(coalesce(r.whatsapp,''), '\D','','g'), 11) = v_wpp_tail THEN 1
      ELSE 2
    END
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('duplicado', false);
  END IF;

  RETURN jsonb_build_object(
    'duplicado', true,
    'motivo', v_row.motivo,
    'representante_nome', v_row.rep_nome,
    'revendedora_id', v_row.id,
    'nome_existente', v_row.nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.checar_duplicidade_revendedora(uuid, text, text, text, uuid) TO authenticated;

-- 2) Trigger de bloqueio em INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.fn_bloquear_duplicidade_revendedora()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_motivo text;
  v_rep text;
  v_label text;
BEGIN
  -- admins podem cadastrar/transferir livremente
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- em UPDATE, se os campos relevantes não mudaram e o representante não mudou, ignora
  IF TG_OP = 'UPDATE' THEN
    IF NEW.representante_id IS NOT DISTINCT FROM OLD.representante_id
       AND NEW.nome IS NOT DISTINCT FROM OLD.nome
       AND NEW.cpf IS NOT DISTINCT FROM OLD.cpf
       AND NEW.whatsapp IS NOT DISTINCT FROM OLD.whatsapp THEN
      RETURN NEW;
    END IF;
  END IF;

  v_result := public.checar_duplicidade_revendedora(
    NEW.representante_id,
    NEW.nome,
    NEW.cpf,
    NEW.whatsapp,
    CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END
  );

  IF (v_result->>'duplicado')::boolean THEN
    v_motivo := v_result->>'motivo';
    v_rep := v_result->>'representante_nome';
    v_label := CASE v_motivo
      WHEN 'cpf' THEN 'CPF'
      WHEN 'whatsapp' THEN 'WhatsApp'
      ELSE 'nome'
    END;
    RAISE EXCEPTION 'Esta revendedora já está cadastrada com o representante % (% igual). Solicite a transferência ao administrador.', v_rep, v_label
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_duplicidade_revendedora ON public.revendedoras;
CREATE TRIGGER trg_bloquear_duplicidade_revendedora
BEFORE INSERT OR UPDATE OF nome, cpf, whatsapp, representante_id
ON public.revendedoras
FOR EACH ROW
EXECUTE FUNCTION public.fn_bloquear_duplicidade_revendedora();
