-- Adicionar política para representante atualizar seus próprios kits (quando entrega para revendedora)
CREATE POLICY "Representante pode atualizar seus kits" 
ON public.kits_estoque 
FOR UPDATE 
USING (representante_id = auth.uid())
WITH CHECK (representante_id = auth.uid());