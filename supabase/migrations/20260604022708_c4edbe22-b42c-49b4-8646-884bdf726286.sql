
-- 1. juridico_bloqueados: enable RLS, admin-only
ALTER TABLE public.juridico_bloqueados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage juridico_bloqueados"
ON public.juridico_bloqueados
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. pagamentos_historico: scoped policies
DROP POLICY IF EXISTS "Acesso autenticado pagamentos_historico" ON public.pagamentos_historico;

CREATE POLICY "Reps see own pagamentos_historico"
ON public.pagamentos_historico
FOR SELECT
TO authenticated
USING (
  representante_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Reps insert own pagamentos_historico"
ON public.pagamentos_historico
FOR INSERT
TO authenticated
WITH CHECK (
  representante_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins update pagamentos_historico"
ON public.pagamentos_historico
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete pagamentos_historico"
ON public.pagamentos_historico
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Storage: revendedoras-fotos — verify ownership via folder = revendedora.id
DROP POLICY IF EXISTS "Revendedoras fotos read authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Revendedoras fotos insert authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Revendedoras fotos update authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Revendedoras fotos delete authenticated" ON storage.objects;

CREATE POLICY "Revendedoras fotos select scoped"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'revendedoras-fotos'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.revendedoras r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND r.representante_id = auth.uid()
    )
  )
);

CREATE POLICY "Revendedoras fotos insert scoped"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'revendedoras-fotos'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (storage.foldername(name))[1] LIKE 'novo-%'
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
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (storage.foldername(name))[1] LIKE 'novo-%'
    OR EXISTS (
      SELECT 1 FROM public.revendedoras r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND r.representante_id = auth.uid()
    )
  )
);

CREATE POLICY "Revendedoras fotos delete scoped"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'revendedoras-fotos'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.revendedoras r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND r.representante_id = auth.uid()
    )
  )
);

-- 4. Function search_path hardening
ALTER FUNCTION public.aplicar_ajuste_admin(uuid, uuid, numeric, text, boolean) SET search_path TO 'public';

ALTER FUNCTION public.registrar_pagamento_cobranca(
  uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, text, date, text,
  numeric, text, numeric, text, numeric, boolean, text, numeric, numeric, text, date, date
) SET search_path TO 'public';

ALTER FUNCTION public.registrar_pagamento_cobranca(
  uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, text, date, text,
  numeric, text, numeric, text, numeric, boolean, text, numeric, numeric, text, date, date, numeric
) SET search_path TO 'public';
