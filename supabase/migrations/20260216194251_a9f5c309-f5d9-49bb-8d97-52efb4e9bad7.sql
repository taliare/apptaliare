
-- Criar tabela logs_operacionais
CREATE TABLE public.logs_operacionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  nome_usuario text NOT NULL,
  papel text NOT NULL,
  tipo_acao text NOT NULL,
  pedido_id uuid,
  valor_antes numeric,
  valor_depois numeric,
  descricao text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.logs_operacionais ENABLE ROW LEVEL SECURITY;

-- Representantes: SELECT apenas seus proprios logs
CREATE POLICY "Representantes podem ver seus proprios logs"
  ON public.logs_operacionais
  FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- Admin: SELECT todos os logs
CREATE POLICY "Admin pode ver todos os logs"
  ON public.logs_operacionais
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- INSERT: qualquer usuario autenticado
CREATE POLICY "Usuarios autenticados podem inserir logs"
  ON public.logs_operacionais
  FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());
