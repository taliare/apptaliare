
-- Create a limited profiles view that excludes sensitive fields (email, whatsapp)
-- This view bypasses RLS (security_definer by default) and is accessible to all authenticated users
-- but only exposes non-sensitive fields
CREATE OR REPLACE VIEW public.profiles_limited AS
SELECT 
  id,
  nome,
  ativo,
  avatar_url,
  habilitar_cobranca_diaria,
  habilitar_kanban,
  habilitar_dashboard,
  criado_em,
  tema,
  idioma
FROM public.profiles;

-- Grant access to authenticated users
GRANT SELECT ON public.profiles_limited TO authenticated;
GRANT SELECT ON public.profiles_limited TO anon;

-- Drop the broad production policy that exposes all profile fields including email/whatsapp
DROP POLICY IF EXISTS "Produção pode ver todos os perfis" ON public.profiles;
