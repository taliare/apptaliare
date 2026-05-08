CREATE TABLE public.produtos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_barras text UNIQUE NOT NULL,
  referencia text,
  descricao text NOT NULL,
  categoria text,
  subcategoria text,
  cor text,
  tamanho text,
  preco_varejo numeric(10,2) NOT NULL DEFAULT 0,
  foto_url text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kits_montagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'em_montagem',
  criado_por uuid REFERENCES auth.users(id),
  finalizado_em timestamptz,
  pdf_detalhado_url text,
  pdf_resumido_url text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kits_montagem_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES public.kits_montagem(id) ON DELETE CASCADE,
  codigo_barras text NOT NULL,
  produto_id uuid REFERENCES public.produtos_catalogo(id),
  descricao_snapshot text,
  categoria_snapshot text,
  preco_snapshot numeric(10,2) NOT NULL DEFAULT 0,
  quantidade integer NOT NULL DEFAULT 1,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.produtos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kits_montagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kits_montagem_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver catalogo" ON public.produtos_catalogo
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin pode gerenciar catalogo" ON public.produtos_catalogo
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'producao'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'producao'::app_role));

CREATE POLICY "Producao e admin podem ver kits montagem" ON public.kits_montagem
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'producao'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Producao e admin podem gerenciar kits montagem" ON public.kits_montagem
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'producao'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'producao'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Producao e admin podem gerenciar itens montagem" ON public.kits_montagem_itens
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'producao'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'producao'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_kits_montagem_itens_kit_id ON public.kits_montagem_itens(kit_id);
CREATE INDEX idx_kits_montagem_itens_codigo_barras ON public.kits_montagem_itens(codigo_barras);
CREATE INDEX idx_produtos_catalogo_categoria ON public.produtos_catalogo(categoria);