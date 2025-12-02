-- Permitir que usuários de produção vejam todos os perfis
-- (necessário para listar representantes no Kanban de Distribuição de Kits)
CREATE POLICY "Produção pode ver todos os perfis"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'producao'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);