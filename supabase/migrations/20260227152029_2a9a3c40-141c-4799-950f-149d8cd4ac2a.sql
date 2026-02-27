CREATE POLICY "Representante pode cadastrar suas revendedoras"
ON revendedoras FOR INSERT
WITH CHECK (representante_id = auth.uid());