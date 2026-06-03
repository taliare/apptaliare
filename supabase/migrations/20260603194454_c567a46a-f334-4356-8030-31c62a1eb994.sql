
CREATE POLICY "Revendedoras fotos read authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'revendedoras-fotos');

CREATE POLICY "Revendedoras fotos insert authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'revendedoras-fotos');

CREATE POLICY "Revendedoras fotos update authenticated" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'revendedoras-fotos');

CREATE POLICY "Revendedoras fotos delete authenticated" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'revendedoras-fotos');
