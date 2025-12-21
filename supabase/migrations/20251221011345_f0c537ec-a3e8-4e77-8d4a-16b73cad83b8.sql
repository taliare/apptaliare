-- Remover política existente que limita criação
DROP POLICY IF EXISTS "Admin pode criar notificações" ON public.notifications;
DROP POLICY IF EXISTS "Sistema pode criar notificações para qualquer usuário" ON public.notifications;

-- Nova política: Admin pode criar notificações para qualquer usuário
CREATE POLICY "Admin pode criar notificações para qualquer usuário"
ON public.notifications
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Usuário pode criar suas próprias notificações (para sistema)
CREATE POLICY "Usuário pode criar própria notificação"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);