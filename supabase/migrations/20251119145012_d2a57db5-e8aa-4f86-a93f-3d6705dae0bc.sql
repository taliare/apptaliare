-- Remover a política existente e criar com WITH CHECK explícito
DROP POLICY IF EXISTS "Representante pode gerenciar suas notas" ON public.notas_promissorias;

-- Criar política com WITH CHECK explícito para INSERT
CREATE POLICY "Representante pode gerenciar suas notas"
ON public.notas_promissorias
FOR ALL
TO authenticated
USING (representante_id = auth.uid())
WITH CHECK (representante_id = auth.uid());