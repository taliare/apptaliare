
-- Admin pode inserir prestações de contas
CREATE POLICY "Admin pode inserir prestações"
ON public.prestacoes_contas
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admin pode atualizar prestações de contas
CREATE POLICY "Admin pode atualizar prestações"
ON public.prestacoes_contas
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
