-- Adicionar policy para representante poder excluir suas próprias notas promissórias
CREATE POLICY "Representante pode excluir suas notas" 
ON public.notas_promissorias 
FOR DELETE 
USING (representante_id = auth.uid());