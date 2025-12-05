-- Fix RLS policies for prestacoes_contas: Split ALL into specific operations, restrict DELETE to admin
DROP POLICY IF EXISTS "Representante pode gerenciar suas prestações" ON public.prestacoes_contas;

-- Allow INSERT for representatives
CREATE POLICY "Representante pode inserir prestações" 
ON public.prestacoes_contas 
FOR INSERT 
WITH CHECK (representante_id = auth.uid());

-- Allow SELECT for representatives (their own data)
CREATE POLICY "Representante pode ver suas prestações" 
ON public.prestacoes_contas 
FOR SELECT 
USING (representante_id = auth.uid());

-- Allow UPDATE for representatives (their own data)
CREATE POLICY "Representante pode atualizar suas prestações" 
ON public.prestacoes_contas 
FOR UPDATE 
USING (representante_id = auth.uid());

-- Fix RLS policies for cobrancas_diarias: Split ALL into specific operations, restrict DELETE to admin
DROP POLICY IF EXISTS "Representante pode gerenciar suas cobranças diárias" ON public.cobrancas_diarias;

-- Allow INSERT for representatives
CREATE POLICY "Representante pode inserir cobranças diárias" 
ON public.cobrancas_diarias 
FOR INSERT 
WITH CHECK (representante_id = auth.uid());

-- Allow SELECT for representatives (their own data)
CREATE POLICY "Representante pode ver suas cobranças diárias" 
ON public.cobrancas_diarias 
FOR SELECT 
USING (representante_id = auth.uid());

-- Allow UPDATE for representatives (their own data)
CREATE POLICY "Representante pode atualizar cobranças diárias" 
ON public.cobrancas_diarias 
FOR UPDATE 
USING (representante_id = auth.uid());

-- Fix RLS policies for notas_promissorias: Split ALL into specific operations, restrict DELETE to admin
DROP POLICY IF EXISTS "Representante pode gerenciar suas notas" ON public.notas_promissorias;

-- Allow INSERT for representatives
CREATE POLICY "Representante pode inserir notas" 
ON public.notas_promissorias 
FOR INSERT 
WITH CHECK (representante_id = auth.uid());

-- Allow SELECT for representatives (their own data)
CREATE POLICY "Representante pode ver suas notas" 
ON public.notas_promissorias 
FOR SELECT 
USING (representante_id = auth.uid());

-- Allow UPDATE for representatives (their own data)
CREATE POLICY "Representante pode atualizar notas" 
ON public.notas_promissorias 
FOR UPDATE 
USING (representante_id = auth.uid());

-- Fix RLS policies for kits_entregues: Split ALL into specific operations, restrict DELETE to admin
DROP POLICY IF EXISTS "Representante pode gerenciar seus kits" ON public.kits_entregues;

-- Allow INSERT for representatives
CREATE POLICY "Representante pode inserir kits" 
ON public.kits_entregues 
FOR INSERT 
WITH CHECK (representante_id = auth.uid());

-- Allow SELECT for representatives (their own data)
CREATE POLICY "Representante pode ver seus kits entregues" 
ON public.kits_entregues 
FOR SELECT 
USING (representante_id = auth.uid());

-- Allow UPDATE for representatives (their own data)
CREATE POLICY "Representante pode atualizar kits" 
ON public.kits_entregues 
FOR UPDATE 
USING (representante_id = auth.uid());

-- Add admin DELETE policies for all these tables
CREATE POLICY "Admin pode deletar prestações" 
ON public.prestacoes_contas 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode deletar cobranças diárias" 
ON public.cobrancas_diarias 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode deletar notas" 
ON public.notas_promissorias 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode deletar kits entregues" 
ON public.kits_entregues 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));