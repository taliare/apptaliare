
-- =============================================
-- TALIARE 2.0 - Tabelas com prefixo t2_
-- =============================================

-- 1. t2_revendedoras
CREATE TABLE public.t2_revendedoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo text NOT NULL,
  nome_exibicao text,
  cpf text NOT NULL,
  telefone text NOT NULL,
  instagram text,
  cidade text,
  representante_id uuid,
  status text NOT NULL DEFAULT 'cadastrada',
  score integer NOT NULL DEFAULT 0,
  categoria_atual text,
  data_cadastro timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT t2_revendedoras_cpf_unique UNIQUE (cpf)
);

ALTER TABLE public.t2_revendedoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access t2_revendedoras"
  ON public.t2_revendedoras FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Representante pode ver suas t2_revendedoras"
  ON public.t2_revendedoras FOR SELECT
  TO authenticated
  USING (representante_id = auth.uid());

CREATE POLICY "Representante pode criar t2_revendedoras"
  ON public.t2_revendedoras FOR INSERT
  TO authenticated
  WITH CHECK (representante_id = auth.uid());

CREATE POLICY "Representante pode atualizar suas t2_revendedoras"
  ON public.t2_revendedoras FOR UPDATE
  TO authenticated
  USING (representante_id = auth.uid());

-- 2. t2_pedidos
CREATE TABLE public.t2_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_pedido text NOT NULL,
  valor_total numeric NOT NULL,
  representante_id uuid,
  status text NOT NULL DEFAULT 'aguardando_distribuicao',
  data_criacao timestamptz NOT NULL DEFAULT now(),
  observacao text,
  CONSTRAINT t2_pedidos_codigo_unique UNIQUE (codigo_pedido)
);

ALTER TABLE public.t2_pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access t2_pedidos"
  ON public.t2_pedidos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Representante pode ver seus t2_pedidos disponíveis"
  ON public.t2_pedidos FOR SELECT
  TO authenticated
  USING (representante_id = auth.uid());

-- 3. t2_ciclos
CREATE TABLE public.t2_ciclos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.t2_pedidos(id),
  revendedora_id uuid NOT NULL REFERENCES public.t2_revendedoras(id),
  representante_id uuid NOT NULL,
  valor_kit numeric NOT NULL,
  valor_vendido numeric DEFAULT 0,
  comissao_percentual numeric DEFAULT 0,
  valor_empresa numeric DEFAULT 0,
  valor_pago numeric NOT NULL DEFAULT 0,
  valor_restante numeric DEFAULT 0,
  data_inicio timestamptz NOT NULL DEFAULT now(),
  data_vencimento timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'ativo'
);

ALTER TABLE public.t2_ciclos ENABLE ROW LEVEL SECURITY;

-- Partial unique index: uma revendedora só pode ter um ciclo ativo
CREATE UNIQUE INDEX t2_ciclos_revendedora_ativo_unique
  ON public.t2_ciclos (revendedora_id)
  WHERE (status = 'ativo');

CREATE POLICY "Admin full access t2_ciclos"
  ON public.t2_ciclos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Representante pode ver seus t2_ciclos"
  ON public.t2_ciclos FOR SELECT
  TO authenticated
  USING (representante_id = auth.uid());

CREATE POLICY "Representante pode criar t2_ciclos"
  ON public.t2_ciclos FOR INSERT
  TO authenticated
  WITH CHECK (representante_id = auth.uid());

CREATE POLICY "Representante pode atualizar seus t2_ciclos"
  ON public.t2_ciclos FOR UPDATE
  TO authenticated
  USING (representante_id = auth.uid());
