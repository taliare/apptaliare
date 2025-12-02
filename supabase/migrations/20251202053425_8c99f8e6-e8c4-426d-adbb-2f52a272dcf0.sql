-- Permitir que usuários de produção vejam todas as roles
-- (necessário para o Kanban de Distribuição de Kits)
CREATE POLICY "Produção pode ver todas as roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'producao'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);