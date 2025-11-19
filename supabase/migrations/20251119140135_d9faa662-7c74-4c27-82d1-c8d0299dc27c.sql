-- ============================================
-- CRITICAL SECURITY FIX: Separate Role Storage
-- ============================================
-- This migration fixes the privilege escalation vulnerability by:
-- 1. Creating a separate user_roles table for authorization data
-- 2. Migrating existing role data from profiles to user_roles
-- 3. Replacing is_admin() with has_role() security definer function
-- 4. Updating all RLS policies to use the new function
-- 5. Removing the role column from profiles table

-- Step 1: Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 2: Migrate existing role data from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 3: Create has_role() security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 4: Create trigger to automatically assign role when new user is created
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert role from metadata into user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'representante'::app_role)
  )
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Update the existing trigger to also handle roles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Step 5: Update ALL RLS policies to use has_role() instead of is_admin()

-- Profiles table policies
DROP POLICY IF EXISTS "Admin pode ver todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admin pode atualizar perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admin pode inserir perfis" ON public.profiles;

CREATE POLICY "Admin pode ver todos os perfis"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin pode atualizar perfis"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin pode inserir perfis"
  ON public.profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Cobrancas agendadas policies
DROP POLICY IF EXISTS "Admin pode gerenciar cobranças agendadas" ON public.cobrancas_agendadas;

CREATE POLICY "Admin pode gerenciar cobranças agendadas"
  ON public.cobrancas_agendadas FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Cobrancas diarias policies
DROP POLICY IF EXISTS "Admin pode ver todas cobranças diárias" ON public.cobrancas_diarias;

CREATE POLICY "Admin pode ver todas cobranças diárias"
  ON public.cobrancas_diarias FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Kits entregues policies
DROP POLICY IF EXISTS "Admin pode ver todos os kits" ON public.kits_entregues;

CREATE POLICY "Admin pode ver todos os kits"
  ON public.kits_entregues FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Metas cobranca policies
DROP POLICY IF EXISTS "Admin pode gerenciar metas" ON public.metas_cobranca;

CREATE POLICY "Admin pode gerenciar metas"
  ON public.metas_cobranca FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Notas promissorias policies
DROP POLICY IF EXISTS "Admin pode ver todas as notas" ON public.notas_promissorias;

CREATE POLICY "Admin pode ver todas as notas"
  ON public.notas_promissorias FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Prestacoes contas policies
DROP POLICY IF EXISTS "Admin pode ver todas prestações" ON public.prestacoes_contas;

CREATE POLICY "Admin pode ver todas prestações"
  ON public.prestacoes_contas FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- User_roles table policies
CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Step 6: Drop the old is_admin() function (no longer needed)
DROP FUNCTION IF EXISTS public.is_admin(uuid);

-- Step 7: Remove role column from profiles table
-- This is the final step to complete the separation
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;