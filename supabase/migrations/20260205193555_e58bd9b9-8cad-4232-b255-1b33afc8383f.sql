-- Remove the overly permissive public INSERT policy on leads_revendedoras
DROP POLICY IF EXISTS "Inserção pública de leads" ON public.leads_revendedoras;

-- Replace with admin-only INSERT policy (sync edge function uses service_role and bypasses RLS)
CREATE POLICY "Admin pode inserir leads"
ON public.leads_revendedoras
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));