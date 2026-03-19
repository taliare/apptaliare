CREATE POLICY "Representante pode atualizar seus t2_pedidos"
  ON public.t2_pedidos FOR UPDATE TO authenticated
  USING (representante_id = auth.uid())
  WITH CHECK (representante_id = auth.uid());