
CREATE OR REPLACE FUNCTION public.t2_reverter_ciclo_desistencia(p_ciclo_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ciclo_status text;
  v_has_apuracao boolean;
  v_pedido_ids uuid[];
  v_deleted_adiantamentos int;
  v_deleted_interacoes int;
  v_deleted_ciclo_pedidos int;
BEGIN
  -- 1. Validate cycle exists and is active
  SELECT status INTO v_ciclo_status
  FROM t2_ciclos WHERE id = p_ciclo_id;

  IF v_ciclo_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Ciclo não encontrado');
  END IF;

  IF v_ciclo_status <> 'ativo' THEN
    RETURN json_build_object('success', false, 'error', 'Apenas ciclos ativos podem ser revertidos por desistência');
  END IF;

  -- 2. Check no apuração exists
  SELECT EXISTS(SELECT 1 FROM t2_apuracoes WHERE ciclo_id = p_ciclo_id) INTO v_has_apuracao;
  IF v_has_apuracao THEN
    RETURN json_build_object('success', false, 'error', 'Este ciclo já possui apuração. Cancele a apuração primeiro.');
  END IF;

  -- 3. Collect pedido_ids from junction table
  SELECT array_agg(pedido_id) INTO v_pedido_ids
  FROM t2_ciclo_pedidos WHERE ciclo_id = p_ciclo_id;

  -- 4. Delete adiantamentos
  DELETE FROM t2_adiantamentos WHERE ciclo_id = p_ciclo_id;
  GET DIAGNOSTICS v_deleted_adiantamentos = ROW_COUNT;

  -- 5. Delete interações
  DELETE FROM t2_interacoes WHERE ciclo_id = p_ciclo_id;
  GET DIAGNOSTICS v_deleted_interacoes = ROW_COUNT;

  -- 6. Delete junction records
  DELETE FROM t2_ciclo_pedidos WHERE ciclo_id = p_ciclo_id;
  GET DIAGNOSTICS v_deleted_ciclo_pedidos = ROW_COUNT;

  -- 7. Delete the cycle
  DELETE FROM t2_ciclos WHERE id = p_ciclo_id;

  -- 8. Revert pedidos to disponivel
  IF v_pedido_ids IS NOT NULL THEN
    UPDATE t2_pedidos SET status = 'disponivel' WHERE id = ANY(v_pedido_ids);
  END IF;

  RETURN json_build_object(
    'success', true,
    'pedidos_revertidos', COALESCE(array_length(v_pedido_ids, 1), 0),
    'adiantamentos_removidos', v_deleted_adiantamentos,
    'interacoes_removidas', v_deleted_interacoes
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
