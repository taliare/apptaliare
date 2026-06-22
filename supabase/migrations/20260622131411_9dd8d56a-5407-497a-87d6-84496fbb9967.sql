CREATE OR REPLACE FUNCTION public.fn_manter_vigente()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Se for UPDATE e não mudou codigo_nota nem vigente, não há nada a fazer
  -- (ex.: troca de representante_id) — evita trabalho e recursão.
  IF TG_OP = 'UPDATE'
     AND NEW.codigo_nota IS NOT DISTINCT FROM OLD.codigo_nota
     AND NEW.vigente IS NOT DISTINCT FROM OLD.vigente THEN
    RETURN NEW;
  END IF;

  -- Marca como não-vigentes apenas as irmãs que AINDA estão vigentes
  -- (o filtro vigente = true impede re-disparo em cascata infinita).
  UPDATE public.cobrancas_agendadas
  SET vigente = false
  WHERE TRIM(codigo_nota) = TRIM(NEW.codigo_nota)
    AND id != NEW.id
    AND vigente = true;

  NEW.vigente = true;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.transferir_revendedora(p_revendedora_id uuid, p_novo_representante_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_nome text;
  v_rep_antigo uuid;
  v_ids uuid[];
  v_count int := 0;
  v_kit_count int := 0;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem transferir revendedoras' USING ERRCODE = '42501';
  END IF;

  SELECT nome, representante_id INTO v_nome, v_rep_antigo
  FROM public.revendedoras WHERE id = p_revendedora_id FOR UPDATE;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Revendedora não encontrada';
  END IF;

  IF p_novo_representante_id IS NULL THEN
    RAISE EXCEPTION 'Novo representante é obrigatório';
  END IF;

  IF p_novo_representante_id = v_rep_antigo THEN
    RETURN jsonb_build_object('success', true, 'notas_movidas', 0, 'mensagem', 'Mesmo representante, nada a fazer');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_novo_representante_id AND role = 'representante'::app_role) THEN
    RAISE EXCEPTION 'O usuário destino não é um representante';
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_ids
  FROM public.cobrancas_agendadas
  WHERE revendedora = v_nome
    AND representante_id = v_rep_antigo
    AND status IN ('pendente'::status_cobranca, 'parcial'::status_cobranca, 'juridico'::status_cobranca);

  UPDATE public.revendedoras
  SET representante_id = p_novo_representante_id,
      atualizado_em = now()
  WHERE id = p_revendedora_id;

  IF array_length(v_ids, 1) IS NOT NULL THEN
    UPDATE public.cobrancas_agendadas SET representante_id = p_novo_representante_id WHERE id = ANY(v_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE public.prestacoes_contas SET representante_id = p_novo_representante_id WHERE cobranca_id = ANY(v_ids);
    UPDATE public.acrescimos_pedido SET representante_id = p_novo_representante_id WHERE cobranca_id = ANY(v_ids);
    UPDATE public.notas_promissorias SET representante_id = p_novo_representante_id WHERE cobranca_id = ANY(v_ids);
    UPDATE public.pagamentos_historico SET representante_id = p_novo_representante_id WHERE cobranca_id = ANY(v_ids);
  END IF;

  UPDATE public.kit_adicionais_itens
  SET representante_id = p_novo_representante_id
  WHERE revendedora = v_nome AND representante_id = v_rep_antigo;
  GET DIAGNOSTICS v_kit_count = ROW_COUNT;

  INSERT INTO public.audit_logs (user_id, target_user_id, action, details)
  VALUES (
    v_caller,
    p_novo_representante_id,
    'revendedora_transferida',
    jsonb_build_object(
      'revendedora_id', p_revendedora_id,
      'revendedora_nome', v_nome,
      'rep_antigo', v_rep_antigo,
      'rep_novo', p_novo_representante_id,
      'notas_movidas', v_count,
      'kit_adicionais_movidos', v_kit_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'notas_movidas', v_count,
    'kit_adicionais_movidos', v_kit_count
  );
END;
$$;