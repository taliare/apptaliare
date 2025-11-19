-- Adicionar política RLS de INSERT para representantes na tabela cobrancas_agendadas
CREATE POLICY "Representante pode criar suas cobranças"
ON public.cobrancas_agendadas
FOR INSERT
TO authenticated
WITH CHECK (representante_id = auth.uid());