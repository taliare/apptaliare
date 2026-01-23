-- 1. Adicionar campo whatsapp na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp TEXT NULL;

-- 2. Criar tabela de logs de auditoria
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_user_id UUID NULL,
  action TEXT NOT NULL,
  details JSONB NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para consultas rápidas
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas: apenas admin pode ver e inserir
CREATE POLICY "Admin pode ver logs" ON public.audit_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode inserir logs" ON public.audit_logs
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));