
CREATE OR REPLACE FUNCTION public.fn_bloquear_duplicidade_revendedora()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nome_norm_new text;
  v_cpf_norm_new text;
  v_wpp_norm_new text;
  v_wpp_tail_new text;
  v_nome_norm_old text;
  v_cpf_norm_old text;
  v_wpp_norm_old text;
  v_wpp_tail_old text;
  v_check_nome boolean := false;
  v_check_cpf boolean := false;
  v_check_wpp boolean := false;
  v_row record;
  v_motivo text;
  v_label text;
BEGIN
  -- admins podem cadastrar/transferir livremente
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  v_nome_norm_new := upper(trim(public.unaccent(coalesce(NEW.nome, ''))));
  v_cpf_norm_new := regexp_replace(coalesce(NEW.cpf, ''), '\D', '', 'g');
  v_wpp_norm_new := regexp_replace(coalesce(NEW.whatsapp, ''), '\D', '', 'g');
  v_wpp_tail_new := CASE WHEN length(v_wpp_norm_new) >= 8 THEN right(v_wpp_norm_new, 11) ELSE NULL END;

  IF TG_OP = 'INSERT' THEN
    -- INSERT: checa todos os campos preenchidos
    v_check_nome := v_nome_norm_new <> '';
    v_check_cpf  := v_cpf_norm_new <> '';
    v_check_wpp  := v_wpp_tail_new IS NOT NULL;
  ELSE
    -- UPDATE: só checa campos que mudaram (de fato) E somente nesses
    v_nome_norm_old := upper(trim(public.unaccent(coalesce(OLD.nome, ''))));
    v_cpf_norm_old := regexp_replace(coalesce(OLD.cpf, ''), '\D', '', 'g');
    v_wpp_norm_old := regexp_replace(coalesce(OLD.whatsapp, ''), '\D', '', 'g');
    v_wpp_tail_old := CASE WHEN length(v_wpp_norm_old) >= 8 THEN right(v_wpp_norm_old, 11) ELSE NULL END;

    v_check_nome := v_nome_norm_new <> '' AND v_nome_norm_new IS DISTINCT FROM v_nome_norm_old;
    v_check_cpf  := v_cpf_norm_new <> '' AND v_cpf_norm_new IS DISTINCT FROM v_cpf_norm_old;
    v_check_wpp  := v_wpp_tail_new IS NOT NULL AND v_wpp_tail_new IS DISTINCT FROM v_wpp_tail_old;

    -- Se nada relevante mudou (incluindo representante), libera direto
    IF NOT v_check_nome AND NOT v_check_cpf AND NOT v_check_wpp
       AND NEW.representante_id IS NOT DISTINCT FROM OLD.representante_id THEN
      RETURN NEW;
    END IF;

    -- Se mudou o representante (transferência por não-admin), checa todos os campos
    -- preenchidos contra outras carteiras (não-admin não deveria conseguir transferir).
    IF NEW.representante_id IS DISTINCT FROM OLD.representante_id THEN
      v_check_nome := v_nome_norm_new <> '';
      v_check_cpf  := v_cpf_norm_new <> '';
      v_check_wpp  := v_wpp_tail_new IS NOT NULL;
    END IF;
  END IF;

  IF NOT v_check_nome AND NOT v_check_cpf AND NOT v_check_wpp THEN
    RETURN NEW;
  END IF;

  SELECT r.id, r.nome,
         COALESCE(p.nome, 'outro representante') AS rep_nome,
         CASE
           WHEN v_check_cpf AND r.cpf = v_cpf_norm_new THEN 'cpf'
           WHEN v_check_wpp AND right(regexp_replace(coalesce(r.whatsapp,''), '\D','','g'), 11) = v_wpp_tail_new THEN 'whatsapp'
           WHEN v_check_nome AND upper(trim(public.unaccent(r.nome))) = v_nome_norm_new THEN 'nome'
           ELSE NULL
         END AS motivo
  INTO v_row
  FROM public.revendedoras r
  LEFT JOIN public.profiles p ON p.id = r.representante_id
  WHERE r.id <> NEW.id
    AND r.representante_id IS DISTINCT FROM NEW.representante_id
    AND (
      (v_check_cpf  AND r.cpf = v_cpf_norm_new)
      OR (v_check_wpp  AND right(regexp_replace(coalesce(r.whatsapp,''), '\D','','g'), 11) = v_wpp_tail_new)
      OR (v_check_nome AND upper(trim(public.unaccent(r.nome))) = v_nome_norm_new)
    )
  ORDER BY
    CASE
      WHEN v_check_cpf AND r.cpf = v_cpf_norm_new THEN 0
      WHEN v_check_wpp AND right(regexp_replace(coalesce(r.whatsapp,''), '\D','','g'), 11) = v_wpp_tail_new THEN 1
      ELSE 2
    END
  LIMIT 1;

  IF v_row.id IS NOT NULL THEN
    v_label := CASE v_row.motivo
      WHEN 'cpf' THEN 'CPF'
      WHEN 'whatsapp' THEN 'WhatsApp'
      ELSE 'nome'
    END;
    RAISE EXCEPTION 'Esta revendedora já está cadastrada com o representante % (% igual). Solicite a transferência ao administrador.', v_row.rep_nome, v_label
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$function$;
