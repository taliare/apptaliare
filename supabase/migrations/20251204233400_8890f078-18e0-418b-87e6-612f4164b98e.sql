-- Adicionar valor 'juridico' ao enum status_cobranca
ALTER TYPE public.status_cobranca ADD VALUE IF NOT EXISTS 'juridico';