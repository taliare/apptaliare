-- Tabela para armazenar permissões de menu por usuário
CREATE TABLE public.user_menu_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  menu_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, menu_key)
);

-- Habilitar RLS
ALTER TABLE public.user_menu_permissions ENABLE ROW LEVEL SECURITY;

-- Política: Admins podem ver/editar todas as permissões
CREATE POLICY "Admins can manage all permissions"
ON public.user_menu_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Política: Usuários podem ver suas próprias permissões
CREATE POLICY "Users can view own permissions"
ON public.user_menu_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());