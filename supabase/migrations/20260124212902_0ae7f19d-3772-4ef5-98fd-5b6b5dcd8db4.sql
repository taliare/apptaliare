-- Adicionar policy de UPDATE para admin em cobrancas_diarias
CREATE POLICY "Admin pode atualizar cobranças diárias"
ON public.cobrancas_diarias
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));