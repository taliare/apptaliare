-- Remover política restritiva e criar permissiva
DROP POLICY IF EXISTS "Representante pode atualizar seus kits" ON public.kits_estoque;

CREATE POLICY "Representante pode atualizar seus kits" 
ON public.kits_estoque 
FOR UPDATE 
TO authenticated
USING (representante_id = auth.uid())
WITH CHECK (representante_id = auth.uid());