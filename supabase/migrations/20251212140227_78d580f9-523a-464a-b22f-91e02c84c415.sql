-- Criar tabela de vendedoras
CREATE TABLE public.vendedoras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendedoras ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admin pode gerenciar vendedoras"
ON public.vendedoras
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode ver vendedoras ativas"
ON public.vendedoras
FOR SELECT
USING (ativo = true);

-- Adicionar coluna vendedora_id na tabela cobrancas_agendadas
ALTER TABLE public.cobrancas_agendadas
ADD COLUMN vendedora_id UUID REFERENCES public.vendedoras(id);

-- Inserir vendedoras iniciais
INSERT INTO public.vendedoras (nome) VALUES ('MAISA'), ('PATRÍCIA');

-- Backfill: mapear registros antigos com texto para vendedora_id
-- Normaliza o texto (trim, lower) e mapeia para vendedora_id
UPDATE public.cobrancas_agendadas ca
SET vendedora_id = v.id
FROM public.vendedoras v
WHERE ca.vendedora IS NOT NULL 
  AND ca.vendedora_id IS NULL
  AND LOWER(TRIM(TRANSLATE(ca.vendedora, 'ÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛáàãâéèêíìîóòõôúùû', 'AAAAEEEIIIOOOOUUUaaaaeeeiiiooooouuu'))) 
    = LOWER(TRIM(TRANSLATE(v.nome, 'ÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛáàãâéèêíìîóòõôúùû', 'AAAAEEEIIIOOOOUUUaaaaeeeiiiooooouuu')));