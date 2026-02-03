-- Função para deletar lead e histórico de forma atômica
CREATE OR REPLACE FUNCTION public.delete_lead_with_history(p_lead_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead_nome TEXT;
  v_deleted_history_count INT;
BEGIN
  -- Buscar nome do lead para confirmar existência
  SELECT nome INTO v_lead_nome
  FROM leads_revendedoras
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Lead não encontrado'
    );
  END IF;

  -- Deletar histórico de status
  DELETE FROM leads_status_historico
  WHERE lead_id = p_lead_id;
  
  GET DIAGNOSTICS v_deleted_history_count = ROW_COUNT;

  -- Deletar o lead
  DELETE FROM leads_revendedoras
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Falha ao excluir lead'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'lead_nome', v_lead_nome,
    'historico_deletado', v_deleted_history_count
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;