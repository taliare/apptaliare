
CREATE OR REPLACE FUNCTION public.has_menu_access(_user_id uuid, _menu_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_menu_permissions rmp ON rmp.role = ur.role
      WHERE ur.user_id = _user_id AND rmp.menu_key = _menu_key
    )
    OR EXISTS (
      SELECT 1 FROM public.user_menu_permissions ump
      WHERE ump.user_id = _user_id AND ump.menu_key = _menu_key
    );
$$;

GRANT EXECUTE ON FUNCTION public.has_menu_access(uuid, text) TO authenticated;

CREATE POLICY "Acesso por permissao de menu - revendedoras"
ON public.revendedoras FOR SELECT TO authenticated
USING ( public.has_menu_access(auth.uid(), 'revendedoras') );

CREATE POLICY "Acesso por permissao de menu - agenda"
ON public.cobrancas_agendadas FOR SELECT TO authenticated
USING (
  public.has_menu_access(auth.uid(), 'revendedoras')
  OR public.has_menu_access(auth.uid(), 'gerenciar_agenda')
);

CREATE POLICY "Acesso por permissao de menu - prestacoes"
ON public.prestacoes_contas FOR SELECT TO authenticated
USING (
  public.has_menu_access(auth.uid(), 'revendedoras')
  OR public.has_menu_access(auth.uid(), 'gerenciar_agenda')
  OR public.has_menu_access(auth.uid(), 'apuracao')
);

CREATE POLICY "Acesso por permissao de menu - leads"
ON public.leads_revendedoras FOR SELECT TO authenticated
USING ( public.has_menu_access(auth.uid(), 'crm') );

CREATE POLICY "Acesso por permissao de menu - leads observacoes"
ON public.leads_observacoes FOR SELECT TO authenticated
USING ( public.has_menu_access(auth.uid(), 'crm') );

CREATE POLICY "Acesso por permissao de menu - leads historico"
ON public.leads_status_historico FOR SELECT TO authenticated
USING ( public.has_menu_access(auth.uid(), 'crm') );
