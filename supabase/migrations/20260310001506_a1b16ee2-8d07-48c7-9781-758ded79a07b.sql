
-- =============================================
-- FIX: Convert ALL RESTRICTIVE policies to PERMISSIVE on t2_* tables
-- Root cause: RESTRICTIVE policies without any PERMISSIVE base policy = all operations blocked
-- =============================================

-- ============ t2_revendedoras ============
DROP POLICY IF EXISTS "Admin full access t2_revendedoras" ON public.t2_revendedoras;
DROP POLICY IF EXISTS "Representante pode atualizar suas t2_revendedoras" ON public.t2_revendedoras;
DROP POLICY IF EXISTS "Representante pode criar t2_revendedoras" ON public.t2_revendedoras;
DROP POLICY IF EXISTS "Representante pode ver suas t2_revendedoras" ON public.t2_revendedoras;

CREATE POLICY "Admin full access t2_revendedoras" ON public.t2_revendedoras
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode ver suas t2_revendedoras" ON public.t2_revendedoras
  FOR SELECT TO authenticated
  USING (representante_id = auth.uid());

CREATE POLICY "Representante pode criar t2_revendedoras" ON public.t2_revendedoras
  FOR INSERT TO authenticated
  WITH CHECK (representante_id = auth.uid());

CREATE POLICY "Representante pode atualizar suas t2_revendedoras" ON public.t2_revendedoras
  FOR UPDATE TO authenticated
  USING (representante_id = auth.uid());

-- ============ t2_ciclos ============
DROP POLICY IF EXISTS "Admin full access t2_ciclos" ON public.t2_ciclos;
DROP POLICY IF EXISTS "Representante pode atualizar seus t2_ciclos" ON public.t2_ciclos;
DROP POLICY IF EXISTS "Representante pode criar t2_ciclos" ON public.t2_ciclos;
DROP POLICY IF EXISTS "Representante pode ver seus t2_ciclos" ON public.t2_ciclos;

CREATE POLICY "Admin full access t2_ciclos" ON public.t2_ciclos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode ver seus t2_ciclos" ON public.t2_ciclos
  FOR SELECT TO authenticated
  USING (representante_id = auth.uid());

CREATE POLICY "Representante pode criar t2_ciclos" ON public.t2_ciclos
  FOR INSERT TO authenticated
  WITH CHECK (representante_id = auth.uid());

CREATE POLICY "Representante pode atualizar seus t2_ciclos" ON public.t2_ciclos
  FOR UPDATE TO authenticated
  USING (representante_id = auth.uid());

-- ============ t2_apuracoes ============
DROP POLICY IF EXISTS "Admin full access t2_apuracoes" ON public.t2_apuracoes;
DROP POLICY IF EXISTS "Representante pode criar t2_apuracoes" ON public.t2_apuracoes;
DROP POLICY IF EXISTS "Representante pode ver suas t2_apuracoes" ON public.t2_apuracoes;

CREATE POLICY "Admin full access t2_apuracoes" ON public.t2_apuracoes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode ver suas t2_apuracoes" ON public.t2_apuracoes
  FOR SELECT TO authenticated
  USING (apurado_por = auth.uid());

CREATE POLICY "Representante pode criar t2_apuracoes" ON public.t2_apuracoes
  FOR INSERT TO authenticated
  WITH CHECK (apurado_por = auth.uid());

-- ============ t2_pagamentos ============
DROP POLICY IF EXISTS "Admin full access t2_pagamentos" ON public.t2_pagamentos;
DROP POLICY IF EXISTS "Representante pode criar t2_pagamentos" ON public.t2_pagamentos;
DROP POLICY IF EXISTS "Representante pode ver seus t2_pagamentos" ON public.t2_pagamentos;

CREATE POLICY "Admin full access t2_pagamentos" ON public.t2_pagamentos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode ver seus t2_pagamentos" ON public.t2_pagamentos
  FOR SELECT TO authenticated
  USING (registrado_por = auth.uid());

CREATE POLICY "Representante pode criar t2_pagamentos" ON public.t2_pagamentos
  FOR INSERT TO authenticated
  WITH CHECK (registrado_por = auth.uid());

-- ============ t2_adiantamentos ============
DROP POLICY IF EXISTS "Admin full access t2_adiantamentos" ON public.t2_adiantamentos;
DROP POLICY IF EXISTS "Representante pode criar t2_adiantamentos" ON public.t2_adiantamentos;
DROP POLICY IF EXISTS "Representante pode ver seus t2_adiantamentos" ON public.t2_adiantamentos;

CREATE POLICY "Admin full access t2_adiantamentos" ON public.t2_adiantamentos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode ver seus t2_adiantamentos" ON public.t2_adiantamentos
  FOR SELECT TO authenticated
  USING (registrado_por = auth.uid());

CREATE POLICY "Representante pode criar t2_adiantamentos" ON public.t2_adiantamentos
  FOR INSERT TO authenticated
  WITH CHECK (registrado_por = auth.uid());

-- ============ t2_pedidos ============
DROP POLICY IF EXISTS "Admin full access t2_pedidos" ON public.t2_pedidos;
DROP POLICY IF EXISTS "Representante pode ver seus t2_pedidos" ON public.t2_pedidos;
DROP POLICY IF EXISTS "Representante pode criar t2_pedidos" ON public.t2_pedidos;

CREATE POLICY "Admin full access t2_pedidos" ON public.t2_pedidos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode ver seus t2_pedidos" ON public.t2_pedidos
  FOR SELECT TO authenticated
  USING (representante_id = auth.uid());

CREATE POLICY "Representante pode criar t2_pedidos" ON public.t2_pedidos
  FOR INSERT TO authenticated
  WITH CHECK (representante_id = auth.uid());
