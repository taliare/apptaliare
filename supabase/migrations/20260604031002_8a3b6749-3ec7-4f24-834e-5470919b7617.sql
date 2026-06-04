
CREATE TABLE public.contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  banco text,
  tipo text NOT NULL DEFAULT 'corrente' CHECK (tipo IN ('corrente','poupanca','pagamento')),
  saldo_inicial numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_bancarias TO authenticated;
GRANT ALL ON public.contas_bancarias TO service_role;
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage contas_bancarias" ON public.contas_bancarias
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.transacoes_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE CASCADE,
  data_transacao date NOT NULL,
  descricao text,
  valor numeric NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('credito','debito')),
  id_externo text,
  status_conciliacao text NOT NULL DEFAULT 'pendente' CHECK (status_conciliacao IN ('pendente','conciliado','ignorado')),
  categoria_id uuid REFERENCES public.dre_categorias_despesas(id) ON DELETE SET NULL,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conta_id, id_externo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transacoes_bancarias TO authenticated;
GRANT ALL ON public.transacoes_bancarias TO service_role;
ALTER TABLE public.transacoes_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage transacoes_bancarias" ON public.transacoes_bancarias
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_transacoes_conta_data ON public.transacoes_bancarias(conta_id, data_transacao DESC);
