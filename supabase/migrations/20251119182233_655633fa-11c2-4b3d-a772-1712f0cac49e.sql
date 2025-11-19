-- Criar tabela de repasses para controlar valores em aberto
CREATE TABLE IF NOT EXISTS public.repasses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id UUID NOT NULL REFERENCES public.cobrancas_agendadas(id) ON DELETE CASCADE,
  valor_repasse NUMERIC NOT NULL,
  data_repasse DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'pago', 'cancelado')),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS na tabela de repasses
ALTER TABLE public.repasses ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para repasses
CREATE POLICY "Admin pode gerenciar todos os repasses"
ON public.repasses
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode ver seus repasses"
ON public.repasses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cobrancas_agendadas
    WHERE cobrancas_agendadas.id = repasses.cobranca_id
    AND cobrancas_agendadas.representante_id = auth.uid()
  )
);

CREATE POLICY "Representante pode criar seus repasses"
ON public.repasses
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cobrancas_agendadas
    WHERE cobrancas_agendadas.id = repasses.cobranca_id
    AND cobrancas_agendadas.representante_id = auth.uid()
  )
);

CREATE POLICY "Representante pode atualizar seus repasses"
ON public.repasses
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cobrancas_agendadas
    WHERE cobrancas_agendadas.id = repasses.cobranca_id
    AND cobrancas_agendadas.representante_id = auth.uid()
  )
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_repasses_cobranca_id ON public.repasses(cobranca_id);
CREATE INDEX IF NOT EXISTS idx_repasses_data_repasse ON public.repasses(data_repasse);
CREATE INDEX IF NOT EXISTS idx_repasses_status ON public.repasses(status);

-- Trigger para atualizar atualizado_em
CREATE OR REPLACE FUNCTION public.update_repasses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_repasses_updated_at
BEFORE UPDATE ON public.repasses
FOR EACH ROW
EXECUTE FUNCTION public.update_repasses_updated_at();