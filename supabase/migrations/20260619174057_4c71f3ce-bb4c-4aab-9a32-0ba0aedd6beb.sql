
CREATE TABLE public.role_menu_permissions (
  role app_role NOT NULL,
  menu_key text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, menu_key)
);

GRANT SELECT ON public.role_menu_permissions TO authenticated;
GRANT ALL ON public.role_menu_permissions TO service_role;

ALTER TABLE public.role_menu_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view role menu permissions"
ON public.role_menu_permissions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage role menu permissions"
ON public.role_menu_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.role_menu_permissions (role, menu_key) VALUES
  ('representante','dashboard'),
  ('representante','cobranca'),
  ('representante','cobranca_diaria'),
  ('representante','kits'),
  ('representante','kits_entregues'),
  ('representante','encomendas'),
  ('representante','revendedoras_inativas'),
  ('representante','garantias'),
  ('representante','historico_acoes'),
  ('producao','producao'),
  ('producao','producao_diaria'),
  ('producao','distribuicao_kits'),
  ('producao','catalogo_produtos'),
  ('producao','montar_kit'),
  ('producao','encomendas_producao')
ON CONFLICT DO NOTHING;
