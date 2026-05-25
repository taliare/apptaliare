
-- 1. Enable RLS on produtos_taliare and restrict to authenticated users
ALTER TABLE public.produtos_taliare ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view products"
ON public.produtos_taliare
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage products"
ON public.produtos_taliare
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Fix mutable search_path on trigger functions
ALTER FUNCTION public.fn_manter_vigente() SET search_path = public;
ALTER FUNCTION public.fn_atualizar_status_pagamento() SET search_path = public;
ALTER FUNCTION public.fn_status_so_avanca() SET search_path = public;
ALTER FUNCTION public.fn_recalcular_fechamento_diario() SET search_path = public;
ALTER FUNCTION public.fn_registrar_pagamento_historico() SET search_path = public;

-- 3. Add explicit RESTRICTIVE policy on user_roles to prevent self-escalation
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update roles"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
