-- Criar função para reverter entrega de kit
CREATE OR REPLACE FUNCTION public.reverter_entrega_kit(
  p_codigo_kit TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar status do kit de volta para com_representante
  UPDATE kits_estoque 
  SET status = 'com_representante'
  WHERE codigo = p_codigo_kit 
  AND representante_id = p_user_id
  AND status = 'com_revendedora';
  
  RETURN FOUND;
END;
$$;