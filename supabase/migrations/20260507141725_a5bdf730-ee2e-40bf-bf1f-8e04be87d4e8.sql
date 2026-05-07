CREATE POLICY "Equipe interna pode ver observacoes"
ON public.leads_observacoes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'equipe_interna'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_menu_permissions
    WHERE user_id = auth.uid() AND menu_key = 'crm'
  )
);

CREATE POLICY "Equipe interna pode criar observacoes"
ON public.leads_observacoes
FOR INSERT
TO authenticated
WITH CHECK (
  autor_id = auth.uid() AND (
    has_role(auth.uid(), 'equipe_interna'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_menu_permissions
      WHERE user_id = auth.uid() AND menu_key = 'crm'
    )
  )
);

CREATE POLICY "Autor pode deletar suas observacoes"
ON public.leads_observacoes
FOR DELETE
TO authenticated
USING (autor_id = auth.uid());