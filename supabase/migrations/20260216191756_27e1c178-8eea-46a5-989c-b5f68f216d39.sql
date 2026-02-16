
-- Criar tabela ajustes_representantes
CREATE TABLE public.ajustes_representantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representante_id uuid NOT NULL REFERENCES public.profiles(id),
  cobranca_id uuid NOT NULL REFERENCES public.cobrancas_agendadas(id),
  valor_registrado numeric NOT NULL,
  valor_conferido numeric NOT NULL,
  diferenca numeric NOT NULL,
  motivo text,
  status text NOT NULL DEFAULT 'pendente',
  criado_em timestamptz DEFAULT now(),
  quitado_em timestamptz
);

-- Habilitar RLS
ALTER TABLE public.ajustes_representantes ENABLE ROW LEVEL SECURITY;

-- Política: apenas admin tem acesso completo
CREATE POLICY "Admin pode gerenciar ajustes representantes"
  ON public.ajustes_representantes
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
