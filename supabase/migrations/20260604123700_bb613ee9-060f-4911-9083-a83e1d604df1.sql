
-- Allow CRM users to update any lead (not only ones assigned to them or unassigned)
DROP POLICY IF EXISTS "Equipe interna pode atualizar leads" ON public.leads_revendedoras;
CREATE POLICY "Equipe CRM pode atualizar leads"
ON public.leads_revendedoras
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'equipe_interna'::app_role)
  OR EXISTS (
    SELECT 1 FROM user_menu_permissions
    WHERE user_id = auth.uid() AND menu_key = 'crm'
  )
)
WITH CHECK (
  has_role(auth.uid(), 'equipe_interna'::app_role)
  OR EXISTS (
    SELECT 1 FROM user_menu_permissions
    WHERE user_id = auth.uid() AND menu_key = 'crm'
  )
);

-- Allow CRM users to insert and view status history
CREATE POLICY "Equipe CRM pode inserir histórico"
ON public.leads_status_historico
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'equipe_interna'::app_role)
  OR EXISTS (
    SELECT 1 FROM user_menu_permissions
    WHERE user_id = auth.uid() AND menu_key = 'crm'
  )
);

CREATE POLICY "Equipe CRM pode ver histórico"
ON public.leads_status_historico
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'equipe_interna'::app_role)
  OR EXISTS (
    SELECT 1 FROM user_menu_permissions
    WHERE user_id = auth.uid() AND menu_key = 'crm'
  )
);
