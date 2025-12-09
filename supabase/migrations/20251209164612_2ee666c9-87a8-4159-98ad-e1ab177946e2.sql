-- Criar função para atualizar status do kit (bypass RLS com security definer)
CREATE OR REPLACE FUNCTION public.atualizar_status_kit_entrega(
  p_kit_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o kit pertence ao usuário
  IF NOT EXISTS (
    SELECT 1 FROM kits_estoque 
    WHERE id = p_kit_id 
    AND representante_id = p_user_id 
    AND status = 'com_representante'
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Atualizar status do kit
  UPDATE kits_estoque 
  SET status = 'com_revendedora'
  WHERE id = p_kit_id 
  AND representante_id = p_user_id;
  
  RETURN TRUE;
END;
$$;