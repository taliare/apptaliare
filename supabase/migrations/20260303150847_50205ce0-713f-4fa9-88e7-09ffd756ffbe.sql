CREATE OR REPLACE FUNCTION public.get_valor_original_kit(p_kit_entregue_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ks.valor
  FROM kits_entregues ke
  JOIN kits_estoque ks ON ks.id = ke.kit_estoque_id
  WHERE ke.id = p_kit_entregue_id
$$;