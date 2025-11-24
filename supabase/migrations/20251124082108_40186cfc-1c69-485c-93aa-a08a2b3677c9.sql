-- Criar tabela producao_diaria
CREATE TABLE public.producao_diaria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('inicial', 'especial', 'maleta')),
  codigo TEXT NOT NULL,
  criado_por UUID NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela kits_estoque
CREATE TABLE public.kits_estoque (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('inicial', 'especial', 'maleta')),
  codigo TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('estoque', 'com_representante')),
  representante_id UUID,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  origem_producao_id UUID REFERENCES public.producao_diaria(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.producao_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kits_estoque ENABLE ROW LEVEL SECURITY;

-- RLS policies for producao_diaria
CREATE POLICY "Produção pode gerenciar produção diária"
ON public.producao_diaria
FOR ALL
USING (has_role(auth.uid(), 'producao'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode gerenciar produção diária"
ON public.producao_diaria
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for kits_estoque
CREATE POLICY "Produção pode gerenciar kits estoque"
ON public.kits_estoque
FOR ALL
USING (has_role(auth.uid(), 'producao'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode gerenciar kits estoque"
ON public.kits_estoque
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode ver seus kits"
ON public.kits_estoque
FOR SELECT
USING (
  representante_id = auth.uid() 
  AND status = 'com_representante'
);

-- Índices para melhor performance
CREATE INDEX idx_kits_estoque_status ON public.kits_estoque(status);
CREATE INDEX idx_kits_estoque_representante ON public.kits_estoque(representante_id);
CREATE INDEX idx_producao_diaria_data ON public.producao_diaria(data);