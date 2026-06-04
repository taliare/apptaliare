
-- 1) Storage: tighten revendedoras-fotos INSERT/UPDATE to require uploader scoping in "novo-" folders
DROP POLICY IF EXISTS "Revendedoras fotos insert scoped" ON storage.objects;
DROP POLICY IF EXISTS "Revendedoras fotos update scoped" ON storage.objects;

CREATE POLICY "Revendedoras fotos insert scoped"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'revendedoras-fotos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (storage.foldername(name))[1] LIKE ('novo-' || auth.uid()::text || '-%')
    OR EXISTS (
      SELECT 1 FROM public.revendedoras r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND r.representante_id = auth.uid()
    )
  )
);

CREATE POLICY "Revendedoras fotos update scoped"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'revendedoras-fotos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (storage.foldername(name))[1] LIKE ('novo-' || auth.uid()::text || '-%')
    OR EXISTS (
      SELECT 1 FROM public.revendedoras r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND r.representante_id = auth.uid()
    )
  )
);

-- 2) leads_revendedoras: scope equipe_interna / crm UPDATE to assigned or unassigned leads
DROP POLICY IF EXISTS "Equipe interna pode atualizar leads" ON public.leads_revendedoras;

CREATE POLICY "Equipe interna pode atualizar leads"
ON public.leads_revendedoras
FOR UPDATE
TO authenticated
USING (
  (
    has_role(auth.uid(), 'equipe_interna'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_menu_permissions
      WHERE user_menu_permissions.user_id = auth.uid()
        AND user_menu_permissions.menu_key = 'crm'
    )
  )
  AND (responsavel_id = auth.uid() OR responsavel_id IS NULL)
)
WITH CHECK (
  (
    has_role(auth.uid(), 'equipe_interna'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_menu_permissions
      WHERE user_menu_permissions.user_id = auth.uid()
        AND user_menu_permissions.menu_key = 'crm'
    )
  )
  AND (responsavel_id = auth.uid() OR responsavel_id IS NULL)
);
