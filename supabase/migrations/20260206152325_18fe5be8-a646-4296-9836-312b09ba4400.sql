
CREATE OR REPLACE FUNCTION public.reverter_entrega_kit_atomico(p_kit_entregue_id uuid, p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_kit_entregue RECORD;
BEGIN
  -- 1. Buscar o kit entregue com kit_estoque_id
  SELECT id, codigo_mostruario, representante_id, kit_estoque_id
  INTO v_kit_entregue
  FROM kits_entregues
  WHERE id = p_kit_entregue_id
    AND representante_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Registro de entrega não encontrado ou não pertence a você'
    );
  END IF;

  -- 2. Reverter status do kit no estoque (usando kit_estoque_id se disponível)
  IF v_kit_entregue.kit_estoque_id IS NOT NULL THEN
    UPDATE kits_estoque
    SET status = 'com_representante'
    WHERE id = v_kit_entregue.kit_estoque_id
      AND status = 'com_revendedora';
  ELSE
    -- Fallback para busca por código (dados históricos)
    UPDATE kits_estoque
    SET status = 'com_representante'
    WHERE codigo = v_kit_entregue.codigo_mostruario
      AND representante_id = p_user_id
      AND status = 'com_revendedora';
  END IF;

  -- 3. NOVO: Deletar acrescimos vinculados ao kit (ANTES das cobrancas por causa das FKs)
  DELETE FROM acrescimos_pedido
  WHERE kit_entregue_id = p_kit_entregue_id;

  -- 4. Deletar cobrança agendada associada (usando kit_entregue_id se possível)
  DELETE FROM cobrancas_agendadas
  WHERE kit_entregue_id = p_kit_entregue_id
     OR (representante_id = p_user_id
         AND codigo_nota = v_kit_entregue.codigo_mostruario
         AND tipo = 'kit'
         AND kit_entregue_id IS NULL);

  -- 5. Deletar registro de kit entregue
  DELETE FROM kits_entregues
  WHERE id = p_kit_entregue_id;

  RETURN json_build_object(
    'success', true,
    'codigo_kit', v_kit_entregue.codigo_mostruario
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;
