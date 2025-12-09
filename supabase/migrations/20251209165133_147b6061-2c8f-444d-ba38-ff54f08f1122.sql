-- Adicionar política para representante deletar suas cobranças
CREATE POLICY "Representante pode deletar suas cobranças" 
ON public.cobrancas_agendadas 
FOR DELETE 
TO authenticated
USING (representante_id = auth.uid());