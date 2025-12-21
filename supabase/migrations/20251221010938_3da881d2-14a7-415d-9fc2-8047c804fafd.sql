-- Criar tabela de notificações
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- info, success, warning, error
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver suas notificações"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas notificações"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas notificações"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admin pode criar notificações"
ON public.notifications
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode criar notificações para qualquer usuário"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Habilitar realtime para notificações
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;