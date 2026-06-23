CREATE POLICY "Acesso por permissao de menu - editar revendedoras"
ON public.revendedoras FOR UPDATE TO authenticated
USING ( public.has_menu_access(auth.uid(), 'revendedoras') )
WITH CHECK ( public.has_menu_access(auth.uid(), 'revendedoras') );

CREATE POLICY "Acesso por permissao de menu - inserir revendedoras"
ON public.revendedoras FOR INSERT TO authenticated
WITH CHECK ( public.has_menu_access(auth.uid(), 'revendedoras') );