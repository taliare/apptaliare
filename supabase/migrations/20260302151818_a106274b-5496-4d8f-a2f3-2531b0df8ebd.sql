CREATE POLICY "Admin pode inserir cobranças diárias"
ON public.cobrancas_diarias
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));