
DROP POLICY IF EXISTS "Revendedoras fotos select scoped" ON storage.objects;
CREATE POLICY "Revendedoras fotos select scoped"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'revendedoras-fotos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (storage.foldername(name))[1] LIKE ('novo-' || auth.uid()::text || '-%')
    OR EXISTS (
      SELECT 1 FROM revendedoras r
      WHERE r.id::text = (storage.foldername(objects.name))[1]
        AND r.representante_id = auth.uid()
    )
  )
);
