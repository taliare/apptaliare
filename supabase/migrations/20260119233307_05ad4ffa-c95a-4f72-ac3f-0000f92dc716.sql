-- Criar tabela de categorias de despesas do DRE
CREATE TABLE public.dre_categorias_despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de despesas do DRE
CREATE TABLE public.dre_despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id UUID REFERENCES public.dre_categorias_despesas(id) ON DELETE SET NULL,
  ano_mes TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  observacao TEXT,
  criado_por UUID,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_dre_despesas_ano_mes ON public.dre_despesas(ano_mes);
CREATE INDEX idx_dre_despesas_categoria ON public.dre_despesas(categoria_id);

-- Habilitar RLS
ALTER TABLE public.dre_categorias_despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dre_despesas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para categorias
CREATE POLICY "Admin pode visualizar categorias DRE"
  ON public.dre_categorias_despesas FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin pode inserir categorias DRE"
  ON public.dre_categorias_despesas FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin pode atualizar categorias DRE"
  ON public.dre_categorias_despesas FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin pode deletar categorias DRE"
  ON public.dre_categorias_despesas FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Políticas RLS para despesas
CREATE POLICY "Admin pode visualizar despesas DRE"
  ON public.dre_despesas FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin pode inserir despesas DRE"
  ON public.dre_despesas FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin pode atualizar despesas DRE"
  ON public.dre_despesas FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin pode deletar despesas DRE"
  ON public.dre_despesas FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Seed de categorias iniciais
INSERT INTO public.dre_categorias_despesas (nome, ordem) VALUES
  ('Produção de kits', 1),
  ('Embalagens / insumos', 2),
  ('Comissão de representantes', 3),
  ('Comissão de vendedoras', 4),
  ('Despesas de cobrança', 5),
  ('Logística', 6),
  ('Marketing', 7),
  ('Sistemas / ferramentas', 8),
  ('Administrativo', 9);