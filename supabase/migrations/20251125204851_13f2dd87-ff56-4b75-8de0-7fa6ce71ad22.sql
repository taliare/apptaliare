-- Criar tabela de encomendas de kits
CREATE TABLE public.encomendas_kits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  representante_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  producao_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tipo_kit TEXT NOT NULL CHECK (tipo_kit IN ('inicial', 'especial', 'maleta', 'misto')),
  descricao_pedido TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'solicitado' CHECK (status IN ('solicitado', 'em_producao', 'pronto', 'cancelado')),
  codigo_kit TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX idx_encomendas_representante ON public.encomendas_kits(representante_id);
CREATE INDEX idx_encomendas_status ON public.encomendas_kits(status);
CREATE INDEX idx_encomendas_criado_em ON public.encomendas_kits(criado_em DESC);

-- Habilitar RLS
ALTER TABLE public.encomendas_kits ENABLE ROW LEVEL SECURITY;

-- Política para representantes verem apenas suas encomendas
CREATE POLICY "Representantes veem suas encomendas"
ON public.encomendas_kits
FOR SELECT
USING (representante_id = auth.uid());

-- Política para representantes criarem suas encomendas
CREATE POLICY "Representantes criam suas encomendas"
ON public.encomendas_kits
FOR INSERT
WITH CHECK (representante_id = auth.uid());

-- Política para produção ver todas as encomendas
CREATE POLICY "Produção vê todas encomendas"
ON public.encomendas_kits
FOR SELECT
USING (has_role(auth.uid(), 'producao'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Política para produção atualizar encomendas
CREATE POLICY "Produção atualiza encomendas"
ON public.encomendas_kits
FOR UPDATE
USING (has_role(auth.uid(), 'producao'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Admin pode gerenciar tudo
CREATE POLICY "Admin gerencia encomendas"
ON public.encomendas_kits
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_encomendas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_encomendas_updated_at_trigger
BEFORE UPDATE ON public.encomendas_kits
FOR EACH ROW
EXECUTE FUNCTION update_encomendas_updated_at();