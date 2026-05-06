ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS departamento text,
ADD COLUMN IF NOT EXISTS permissoes_customizadas boolean NOT NULL DEFAULT false;