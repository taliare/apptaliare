CREATE OR REPLACE FUNCTION public.t2_cancelar_apuracao(p_ciclo_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_apuracao_id uuid;
  v_ciclo_status text;
  v_pagamentos_deletados int;
BEGIN
  SELECT status INTO v_ciclo_status
  FROM t2_ciclos WHERE id = p_ciclo_id;

  IF v_ciclo_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Ciclo não encontrado');
  END IF;

  IF v_ciclo_status <> 'apurado' THEN
    RETURN json_build_object('success', false, 'error', 'Apenas ciclos apurados podem ter a apuração cancelada');
  END IF;

  SELECT id INTO v_apuracao_id
  FROM t2_apuracoes WHERE ciclo_id = p_ciclo_id;

  IF v_apuracao_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Apuração não encontrada para este ciclo');
  END IF;

  DELETE FROM t2_pagamentos WHERE apuracao_id = v_apuracao_id;
  GET DIAGNOSTICS v_pagamentos_deletados = ROW_COUNT;

  DELETE FROM t2_apuracoes WHERE id = v_apuracao_id;

  ALTER TABLE t2_ciclos DISABLE TRIGGER ALL;
  
  UPDATE t2_ciclos
  SET status = 'ativo', valor_pago = 0
  WHERE id = p_ciclo_id;

  ALTER TABLE t2_ciclos ENABLE TRIGGER ALL;

  RETURN json_build_object(
    'success', true,
    'pagamentos_removidos', v_pagamentos_deletados
  );

EXCEPTION
  WHEN OTHERS THEN
    ALTER TABLE t2_ciclos ENABLE TRIGGER ALL;
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;