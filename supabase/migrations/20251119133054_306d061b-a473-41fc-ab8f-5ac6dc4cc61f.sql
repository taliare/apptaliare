-- Criar tipo enum para roles
CREATE TYPE app_role AS ENUM ('admin', 'representante', 'producao');

-- Criar tipo enum para formas de pagamento
CREATE TYPE forma_pagamento AS ENUM ('pix', 'dinheiro', 'cartao', 'transferencia');

-- Criar tipo enum para status de cobrança
CREATE TYPE status_cobranca AS ENUM ('pendente', 'pago', 'parcial', 'reagendado');

-- Tabela de perfis dos usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'representante',
  ativo BOOLEAN DEFAULT true,
  habilitar_cobranca_diaria BOOLEAN DEFAULT true,
  habilitar_kanban BOOLEAN DEFAULT true,
  habilitar_dashboard BOOLEAN DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de metas de cobrança
CREATE TABLE public.metas_cobranca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ano_mes TEXT NOT NULL,
  meta_valor DECIMAL(10,2) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(representante_id, ano_mes)
);

-- Tabela de cobranças agendadas (importadas do Excel)
CREATE TABLE public.cobrancas_agendadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  revendedora TEXT NOT NULL,
  data_agendada DATE NOT NULL,
  valor_previsto DECIMAL(10,2) NOT NULL,
  observacoes TEXT,
  status status_cobranca DEFAULT 'pendente',
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de prestações de contas (quando uma cobrança é executada)
CREATE TABLE public.prestacoes_contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id UUID REFERENCES public.cobrancas_agendadas(id) ON DELETE CASCADE,
  representante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  revendedora TEXT NOT NULL,
  data_execucao DATE NOT NULL,
  total_venda DECIMAL(10,2) NOT NULL,
  comissao_percentual DECIMAL(5,2) NOT NULL,
  comissao_valor DECIMAL(10,2) NOT NULL,
  valor_devido_empresa DECIMAL(10,2) NOT NULL,
  forma_pagamento forma_pagamento NOT NULL,
  valor_pago DECIMAL(10,2) NOT NULL,
  saldo_devedor DECIMAL(10,2) DEFAULT 0,
  houve_renovacao BOOLEAN DEFAULT false,
  codigo_mostruario TEXT,
  data_vencimento_mostruario DATE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de notas promissórias (cobrança diária)
CREATE TABLE public.notas_promissorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  codigo_nota TEXT NOT NULL,
  valor_total DECIMAL(10,2) NOT NULL,
  forma_pagamento_1 forma_pagamento NOT NULL,
  valor_pagamento_1 DECIMAL(10,2) NOT NULL,
  forma_pagamento_2 forma_pagamento,
  valor_pagamento_2 DECIMAL(10,2),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de cobranças diárias (resumo do dia)
CREATE TABLE public.cobrancas_diarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  total_pix DECIMAL(10,2) DEFAULT 0,
  total_dinheiro DECIMAL(10,2) DEFAULT 0,
  total_cartao DECIMAL(10,2) DEFAULT 0,
  total_cobrado DECIMAL(10,2) NOT NULL,
  despesa_cobranca DECIMAL(10,2) DEFAULT 0,
  finalizado BOOLEAN DEFAULT false,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(representante_id, data)
);

-- Tabela de kits (renovações e vendas)
CREATE TABLE public.kits_entregues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prestacao_id UUID REFERENCES public.prestacoes_contas(id) ON DELETE CASCADE,
  codigo_mostruario TEXT NOT NULL,
  data_entrega DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  tipo TEXT DEFAULT 'renovacao',
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_cobranca ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobrancas_agendadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestacoes_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_promissorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobrancas_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kits_entregues ENABLE ROW LEVEL SECURITY;

-- Função para verificar se usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = user_id
    AND role = 'admin'
    AND ativo = true
  );
$$;

-- Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'representante'::app_role)
  );
  RETURN NEW;
END;
$$;

-- Trigger para criar perfil
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies para profiles
CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admin pode ver todos os perfis"
  ON public.profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin pode inserir perfis"
  ON public.profiles FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin pode atualizar perfis"
  ON public.profiles FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- RLS Policies para metas_cobranca
CREATE POLICY "Admin pode gerenciar metas"
  ON public.metas_cobranca FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Representante pode ver suas metas"
  ON public.metas_cobranca FOR SELECT
  USING (representante_id = auth.uid());

-- RLS Policies para cobrancas_agendadas
CREATE POLICY "Admin pode gerenciar cobranças agendadas"
  ON public.cobrancas_agendadas FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Representante pode ver suas cobranças"
  ON public.cobrancas_agendadas FOR SELECT
  USING (representante_id = auth.uid());

CREATE POLICY "Representante pode atualizar suas cobranças"
  ON public.cobrancas_agendadas FOR UPDATE
  USING (representante_id = auth.uid());

-- RLS Policies para prestacoes_contas
CREATE POLICY "Admin pode ver todas prestações"
  ON public.prestacoes_contas FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Representante pode gerenciar suas prestações"
  ON public.prestacoes_contas FOR ALL
  USING (representante_id = auth.uid());

-- RLS Policies para notas_promissorias
CREATE POLICY "Admin pode ver todas as notas"
  ON public.notas_promissorias FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Representante pode gerenciar suas notas"
  ON public.notas_promissorias FOR ALL
  USING (representante_id = auth.uid());

-- RLS Policies para cobrancas_diarias
CREATE POLICY "Admin pode ver todas cobranças diárias"
  ON public.cobrancas_diarias FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Representante pode gerenciar suas cobranças diárias"
  ON public.cobrancas_diarias FOR ALL
  USING (representante_id = auth.uid());

-- RLS Policies para kits_entregues
CREATE POLICY "Admin pode ver todos os kits"
  ON public.kits_entregues FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Representante pode gerenciar seus kits"
  ON public.kits_entregues FOR ALL
  USING (representante_id = auth.uid());