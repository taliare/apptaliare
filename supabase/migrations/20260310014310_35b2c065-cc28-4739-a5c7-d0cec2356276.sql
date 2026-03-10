
-- Create junction table for multi-pedido per ciclo
CREATE TABLE public.t2_ciclo_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL REFERENCES t2_ciclos(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES t2_pedidos(id),
  criado_em timestamptz DEFAULT now(),
  UNIQUE(pedido_id)
);

ALTER TABLE public.t2_ciclo_pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Representante pode ver seus t2_ciclo_pedidos" ON public.t2_ciclo_pedidos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM t2_ciclos WHERE t2_ciclos.id = t2_ciclo_pedidos.ciclo_id AND t2_ciclos.representante_id = auth.uid()));

CREATE POLICY "Representante pode criar t2_ciclo_pedidos" ON public.t2_ciclo_pedidos
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM t2_ciclos WHERE t2_ciclos.id = t2_ciclo_pedidos.ciclo_id AND t2_ciclos.representante_id = auth.uid()));

CREATE POLICY "Admin full access t2_ciclo_pedidos" ON public.t2_ciclo_pedidos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Make pedido_id nullable for backward compatibility
ALTER TABLE public.t2_ciclos ALTER COLUMN pedido_id DROP NOT NULL;
