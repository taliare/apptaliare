
-- Admin pode inserir notas em nome de representantes
CREATE POLICY "Admin pode inserir notas" ON notas_promissorias
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admin pode atualizar notas (alterar data, etc)
CREATE POLICY "Admin pode atualizar notas" ON notas_promissorias
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
