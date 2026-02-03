-- Política para Admin deletar leads
CREATE POLICY "Admin pode deletar leads"
ON public.leads_revendedoras
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Política para Admin deletar histórico de status
CREATE POLICY "Admin pode deletar histórico"
ON public.leads_status_historico
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));