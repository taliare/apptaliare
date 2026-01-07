-- Tabela de metas de produção
CREATE TABLE public.metas_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_mes TEXT NOT NULL UNIQUE,
  meta_kits INTEGER NOT NULL DEFAULT 0,
  observacao TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.metas_producao ENABLE ROW LEVEL SECURITY;

-- Admin pode gerenciar metas de produção
CREATE POLICY "Admin pode gerenciar metas_producao" ON public.metas_producao
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Produção pode visualizar metas
CREATE POLICY "Producao pode ver metas_producao" ON public.metas_producao
  FOR SELECT USING (has_role(auth.uid(), 'producao'::app_role));