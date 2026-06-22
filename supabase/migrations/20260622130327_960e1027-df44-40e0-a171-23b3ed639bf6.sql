
CREATE OR REPLACE FUNCTION public.transferir_revendedora(
  p_revendedora_id uuid,
  p_novo_representante_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Validar que destino é representante
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_novo_representante_id AND role = 'representante'::app_role) THEN
    RAISE EXCEPTION 'O usuário destino não é um representante';
  END IF;

  -- IDs de notas em aberto da revendedora no rep antigo
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_ids
  FROM public.cobrancas_agendadas
  WHERE revendedora = v_nome
    AND representante_id = v_rep_antigo
    AND status IN ('pendente'::status_cobranca, 'parcial'::status_cobranca, 'juridico'::status_cobranca);

  -- Atualiza titularidade da revendedora
  UPDATE public.revendedoras
  SET representante_id = p_novo_representante_id,
      atualizado_em = now()
  WHERE id = p_revendedora_id;

  IF array_length(v_ids, 1) IS NOT NULL THEN
    PERFORM set_config('app.allow_status_regression', 'true', true);

    UPDATE public.cobrancas_agendadas SET representante_id = p_novo_representante_id WHERE id = ANY(v_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE public.prestacoes_contas SET representante_id = p_novo_representante_id WHERE cobranca_id = ANY(v_ids);
    UPDATE public.acrescimos_pedido SET representante_id = p_novo_representante_id WHERE cobranca_id = ANY(v_ids);
    UPDATE public.notas_promissorias SET representante_id = p_novo_representante_id WHERE cobranca_id = ANY(v_ids);
    UPDATE public.pagamentos_historico SET representante_id = p_novo_representante_id WHERE cobranca_id = ANY(v_ids);

    PERFORM set_config('app.allow_status_regression', 'false', true);
  END IF;

  -- Kits adicionais (sem cobranca_id) — todos os itens da revendedora no rep antigo
  UPDATE public.kit_adicionais_itens
  SET representante_id = p_novo_representante_id
  WHERE revendedora = v_nome AND representante_id = v_rep_antigo;
  GET DIAGNOSTICS v_kit_count = ROW_COUNT;

  -- Auditoria
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

REVOKE ALL ON FUNCTION public.transferir_revendedora(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.transferir_revendedora(uuid, uuid) TO authenticated;
