CREATE POLICY "Equipe interna pode ver leads"
ON public.leads_revendedoras
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'equipe_interna'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_menu_permissions
    WHERE user_id = auth.uid() AND menu_key = 'crm'
  )
);

CREATE POLICY "Equipe interna pode atualizar leads"
ON public.leads_revendedoras
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'equipe_interna'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_menu_permissions
    WHERE user_id = auth.uid() AND menu_key = 'crm'
  )
);