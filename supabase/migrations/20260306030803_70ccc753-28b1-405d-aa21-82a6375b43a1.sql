
-- Drop existing RESTRICTIVE policies
DROP POLICY IF EXISTS "Admin full access t2_apuracoes" ON public.t2_apuracoes;
DROP POLICY IF EXISTS "Representante pode criar t2_apuracoes" ON public.t2_apuracoes;
DROP POLICY IF EXISTS "Representante pode ver suas t2_apuracoes" ON public.t2_apuracoes;

-- Recreate as PERMISSIVE
CREATE POLICY "Admin full access t2_apuracoes"
ON public.t2_apuracoes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode criar t2_apuracoes"
ON public.t2_apuracoes
FOR INSERT
TO authenticated
WITH CHECK (apurado_por = auth.uid());

CREATE POLICY "Representante pode ver suas t2_apuracoes"
ON public.t2_apuracoes
FOR SELECT
TO authenticated
USING (apurado_por = auth.uid());
