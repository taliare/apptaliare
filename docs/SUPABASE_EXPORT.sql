-- =====================================================
-- EXPORTAÇÃO COMPLETA DO BANCO DE DADOS
-- Projeto: Taliare Sistema
-- Data: 2026-01-03
-- =====================================================

-- =====================================================
-- PARTE 1: EXTENSÕES E ENUMS
-- =====================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar tipos ENUM
CREATE TYPE app_role AS ENUM ('admin', 'representante', 'producao');
CREATE TYPE forma_pagamento AS ENUM ('pix', 'dinheiro', 'cartao', 'transferencia');
CREATE TYPE status_cobranca AS ENUM ('pendente', 'pago', 'parcial', 'reagendado', 'juridico');

-- =====================================================
-- PARTE 2: TABELAS
-- =====================================================

-- Tabela: profiles
CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY,
  ativo boolean DEFAULT true,
  habilitar_cobranca_diaria boolean DEFAULT true,
  habilitar_kanban boolean DEFAULT true,
  habilitar_dashboard boolean DEFAULT true,
  criado_em timestamp with time zone DEFAULT now(),
  nome text NOT NULL,
  email text,
  avatar_url text,
  tema text DEFAULT 'system'::text,
  idioma text DEFAULT 'pt-BR'::text
);

-- Tabela: user_roles
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Tabela: vendedoras
CREATE TABLE public.vendedoras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  nome text NOT NULL
);

-- Tabela: producao_diaria
CREATE TABLE public.producao_diaria (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data date NOT NULL,
  criado_por uuid NOT NULL,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  valor numeric DEFAULT 0,
  tipo text NOT NULL,
  codigo text NOT NULL
);

-- Tabela: kits_estoque
CREATE TABLE public.kits_estoque (
  origem_producao_id uuid,
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  representante_id uuid,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  valor numeric DEFAULT 0,
  tipo text NOT NULL,
  codigo text NOT NULL,
  status text NOT NULL,
  CONSTRAINT kits_estoque_origem_producao_id_fkey FOREIGN KEY (origem_producao_id) REFERENCES public.producao_diaria(id)
);

-- Tabela: kits_entregues
CREATE TABLE public.kits_entregues (
  representante_id uuid NOT NULL REFERENCES public.profiles(id),
  prestacao_id uuid,
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_entrega date NOT NULL,
  data_vencimento date NOT NULL,
  criado_em timestamp with time zone DEFAULT now(),
  kit_estoque_id uuid REFERENCES public.kits_estoque(id),
  codigo_mostruario text NOT NULL,
  tipo text DEFAULT 'renovacao'::text
);

-- Tabela: cobrancas_agendadas
CREATE TABLE public.cobrancas_agendadas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  representante_id uuid NOT NULL REFERENCES public.profiles(id),
  data_agendada date NOT NULL,
  valor_previsto numeric NOT NULL,
  status status_cobranca DEFAULT 'pendente'::status_cobranca,
  criado_em timestamp with time zone DEFAULT now(),
  valor_adiantado numeric DEFAULT 0,
  data_encaminhado_juridico timestamp with time zone,
  vendedora_id uuid REFERENCES public.vendedoras(id),
  kit_entregue_id uuid REFERENCES public.kits_entregues(id),
  observacoes text,
  tipo text,
  codigo_nota text,
  vendedora text,
  revendedora text NOT NULL
);

-- Tabela: prestacoes_contas
CREATE TABLE public.prestacoes_contas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cobranca_id uuid REFERENCES public.cobrancas_agendadas(id),
  representante_id uuid NOT NULL REFERENCES public.profiles(id),
  data_execucao date NOT NULL,
  total_venda numeric NOT NULL,
  comissao_percentual numeric NOT NULL,
  comissao_valor numeric NOT NULL,
  valor_devido_empresa numeric NOT NULL,
  forma_pagamento forma_pagamento NOT NULL,
  valor_pago numeric NOT NULL,
  saldo_devedor numeric DEFAULT 0,
  houve_renovacao boolean DEFAULT false,
  data_vencimento_mostruario date,
  criado_em timestamp with time zone DEFAULT now(),
  revendedora text NOT NULL,
  codigo_mostruario text,
  codigo_nota_referencia text
);

-- Atualizar FK de kits_entregues para prestacoes_contas
ALTER TABLE public.kits_entregues 
ADD CONSTRAINT kits_entregues_prestacao_id_fkey 
FOREIGN KEY (prestacao_id) REFERENCES public.prestacoes_contas(id);

-- Tabela: cobrancas_diarias
CREATE TABLE public.cobrancas_diarias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  representante_id uuid NOT NULL REFERENCES public.profiles(id),
  data date NOT NULL,
  total_pix numeric DEFAULT 0,
  total_dinheiro numeric DEFAULT 0,
  total_cartao numeric DEFAULT 0,
  total_cobrado numeric NOT NULL,
  despesa_cobranca numeric DEFAULT 0,
  finalizado boolean DEFAULT false,
  criado_em timestamp with time zone DEFAULT now()
);

-- Tabela: metas_cobranca
CREATE TABLE public.metas_cobranca (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  representante_id uuid NOT NULL REFERENCES public.profiles(id),
  meta_valor numeric NOT NULL,
  ativo boolean DEFAULT true,
  criado_em timestamp with time zone DEFAULT now(),
  ano_mes text NOT NULL
);

-- Tabela: notas_promissorias
CREATE TABLE public.notas_promissorias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  representante_id uuid NOT NULL REFERENCES public.profiles(id),
  data date NOT NULL,
  valor_total numeric NOT NULL,
  forma_pagamento_1 forma_pagamento NOT NULL,
  valor_pagamento_1 numeric NOT NULL,
  forma_pagamento_2 forma_pagamento,
  valor_pagamento_2 numeric,
  criado_em timestamp with time zone DEFAULT now(),
  devolveu_tudo boolean NOT NULL DEFAULT false,
  codigo_nota text NOT NULL
);

-- Tabela: repasses
CREATE TABLE public.repasses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cobranca_id uuid NOT NULL REFERENCES public.cobrancas_agendadas(id),
  valor_repasse numeric NOT NULL,
  data_repasse date NOT NULL,
  criado_em timestamp with time zone DEFAULT now(),
  atualizado_em timestamp with time zone DEFAULT now(),
  status text NOT NULL DEFAULT 'agendado'::text
);

-- Tabela: encomendas_kits
CREATE TABLE public.encomendas_kits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  representante_id uuid NOT NULL REFERENCES public.profiles(id),
  producao_id uuid REFERENCES public.profiles(id),
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  tipo_kit text NOT NULL,
  descricao_pedido text NOT NULL,
  status text NOT NULL DEFAULT 'solicitado'::text,
  codigo_kit text
);

-- Tabela: messages
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  content text NOT NULL
);

-- Tabela: notifications
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  link text,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info'::text
);

-- Tabela: push_subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL
);

-- Tabela: leads_revendedoras
CREATE TABLE public.leads_revendedoras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  tempo_disponivel text,
  capital_inicial text,
  motivacao text,
  origem text DEFAULT 'site'::text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  status text NOT NULL DEFAULT 'novo'::text,
  observacao text,
  nome text NOT NULL,
  whatsapp text NOT NULL,
  cidade text,
  instagram text,
  experiencia_vendas text
);

-- =====================================================
-- PARTE 3: FUNÇÕES DO BANCO DE DADOS
-- =====================================================

-- Função: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função: handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Função: handle_new_user_role
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'representante'::app_role)
  )
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Função: update_encomendas_updated_at
CREATE OR REPLACE FUNCTION public.update_encomendas_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

-- Função: update_repasses_updated_at
CREATE OR REPLACE FUNCTION public.update_repasses_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

-- Função: atualizar_status_kit_entrega
CREATE OR REPLACE FUNCTION public.atualizar_status_kit_entrega(p_kit_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM kits_estoque 
    WHERE id = p_kit_id 
    AND representante_id = p_user_id 
    AND status = 'com_representante'
  ) THEN
    RETURN FALSE;
  END IF;
  
  UPDATE kits_estoque 
  SET status = 'com_revendedora'
  WHERE id = p_kit_id 
  AND representante_id = p_user_id;
  
  RETURN TRUE;
END;
$$;

-- Função: reverter_entrega_kit
CREATE OR REPLACE FUNCTION public.reverter_entrega_kit(p_codigo_kit text, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE kits_estoque 
  SET status = 'com_representante'
  WHERE codigo = p_codigo_kit 
  AND representante_id = p_user_id
  AND status = 'com_revendedora';
  
  RETURN FOUND;
END;
$$;

-- Função: entregar_kit_para_revendedora
CREATE OR REPLACE FUNCTION public.entregar_kit_para_revendedora(
  p_kit_id uuid, 
  p_user_id uuid, 
  p_revendedora text, 
  p_data_vencimento date, 
  p_vendedora_id uuid DEFAULT NULL, 
  p_vendedora_nome text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_kit RECORD;
  v_cobranca_id UUID;
  v_kit_entregue_id UUID;
  v_data_entrega DATE := CURRENT_DATE;
BEGIN
  SELECT id, codigo, tipo, valor, status, representante_id
  INTO v_kit
  FROM kits_estoque
  WHERE id = p_kit_id
    AND representante_id = p_user_id
    AND status = 'com_representante'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Kit não encontrado, já entregue ou não pertence a você'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM kits_entregues 
    WHERE codigo_mostruario = v_kit.codigo 
      AND representante_id = p_user_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Este kit já foi entregue anteriormente'
    );
  END IF;

  UPDATE kits_estoque
  SET status = 'com_revendedora'
  WHERE id = p_kit_id;

  INSERT INTO kits_entregues (
    representante_id,
    codigo_mostruario,
    tipo,
    data_entrega,
    data_vencimento,
    kit_estoque_id
  ) VALUES (
    p_user_id,
    v_kit.codigo,
    v_kit.tipo,
    v_data_entrega,
    p_data_vencimento,
    p_kit_id
  )
  RETURNING id INTO v_kit_entregue_id;

  INSERT INTO cobrancas_agendadas (
    representante_id,
    revendedora,
    codigo_nota,
    tipo,
    valor_previsto,
    data_agendada,
    status,
    vendedora_id,
    vendedora,
    observacoes,
    kit_entregue_id
  ) VALUES (
    p_user_id,
    p_revendedora,
    v_kit.codigo,
    'kit',
    COALESCE(v_kit.valor, 0),
    p_data_vencimento,
    'pendente',
    p_vendedora_id,
    p_vendedora_nome,
    'Entrega de kit ' || COALESCE(v_kit.tipo, 'padrão') || ' - Código: ' || v_kit.codigo,
    v_kit_entregue_id
  )
  RETURNING id INTO v_cobranca_id;

  RETURN json_build_object(
    'success', true,
    'kit_codigo', v_kit.codigo,
    'kit_tipo', v_kit.tipo,
    'kit_valor', COALESCE(v_kit.valor, 0),
    'cobranca_id', v_cobranca_id,
    'kit_entregue_id', v_kit_entregue_id
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Este kit já foi entregue (registro duplicado)'
    );
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Função: reverter_entrega_kit_atomico
CREATE OR REPLACE FUNCTION public.reverter_entrega_kit_atomico(p_kit_entregue_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_kit_entregue RECORD;
BEGIN
  SELECT id, codigo_mostruario, representante_id, kit_estoque_id
  INTO v_kit_entregue
  FROM kits_entregues
  WHERE id = p_kit_entregue_id
    AND representante_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Registro de entrega não encontrado ou não pertence a você'
    );
  END IF;

  IF v_kit_entregue.kit_estoque_id IS NOT NULL THEN
    UPDATE kits_estoque
    SET status = 'com_representante'
    WHERE id = v_kit_entregue.kit_estoque_id
      AND status = 'com_revendedora';
  ELSE
    UPDATE kits_estoque
    SET status = 'com_representante'
    WHERE codigo = v_kit_entregue.codigo_mostruario
      AND representante_id = p_user_id
      AND status = 'com_revendedora';
  END IF;

  DELETE FROM cobrancas_agendadas
  WHERE kit_entregue_id = p_kit_entregue_id
     OR (representante_id = p_user_id
         AND codigo_nota = v_kit_entregue.codigo_mostruario
         AND tipo = 'kit'
         AND kit_entregue_id IS NULL);

  DELETE FROM kits_entregues
  WHERE id = p_kit_entregue_id;

  RETURN json_build_object(
    'success', true,
    'codigo_kit', v_kit_entregue.codigo_mostruario
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- =====================================================
-- PARTE 4: TRIGGERS
-- =====================================================

-- Trigger: Criar perfil quando usuário é criado
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Criar role quando usuário é criado
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Trigger: Atualizar timestamp de encomendas
CREATE TRIGGER update_encomendas_timestamp
  BEFORE UPDATE ON public.encomendas_kits
  FOR EACH ROW EXECUTE FUNCTION public.update_encomendas_updated_at();

-- Trigger: Atualizar timestamp de repasses
CREATE TRIGGER update_repasses_timestamp
  BEFORE UPDATE ON public.repasses
  FOR EACH ROW EXECUTE FUNCTION public.update_repasses_updated_at();

-- =====================================================
-- PARTE 5: HABILITAR RLS EM TODAS AS TABELAS
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kits_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kits_entregues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobrancas_agendadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestacoes_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobrancas_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_cobranca ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_promissorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repasses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encomendas_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_revendedoras ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PARTE 6: RLS POLICIES
-- =====================================================

-- === PROFILES ===
CREATE POLICY "Admin pode atualizar perfis" ON public.profiles
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode inserir perfis" ON public.profiles
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode ver todos os perfis" ON public.profiles
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Produção pode ver todos os perfis" ON public.profiles
  FOR SELECT USING (has_role(auth.uid(), 'producao'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuário pode atualizar próprio perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- === USER_ROLES ===
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Produção pode ver todas as roles" ON public.user_roles
  FOR SELECT USING (has_role(auth.uid(), 'producao'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- === VENDEDORAS ===
CREATE POLICY "Admin pode gerenciar vendedoras" ON public.vendedoras
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode ver vendedoras ativas" ON public.vendedoras
  FOR SELECT USING (ativo = true);

-- === PRODUCAO_DIARIA ===
CREATE POLICY "Admin pode gerenciar produção diária" ON public.producao_diaria
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Produção pode gerenciar produção diária" ON public.producao_diaria
  FOR ALL USING (has_role(auth.uid(), 'producao'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- === KITS_ESTOQUE ===
CREATE POLICY "Admin pode gerenciar kits estoque" ON public.kits_estoque
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Produção pode gerenciar kits estoque" ON public.kits_estoque
  FOR ALL USING (has_role(auth.uid(), 'producao'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode atualizar seus kits" ON public.kits_estoque
  FOR UPDATE USING (representante_id = auth.uid()) WITH CHECK (representante_id = auth.uid());

CREATE POLICY "Representante pode ver seus kits" ON public.kits_estoque
  FOR SELECT USING ((representante_id = auth.uid()) AND (status = 'com_representante'::text));

-- === KITS_ENTREGUES ===
CREATE POLICY "Admin pode deletar kits entregues" ON public.kits_entregues
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode ver todos os kits" ON public.kits_entregues
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode atualizar kits" ON public.kits_entregues
  FOR UPDATE USING (representante_id = auth.uid());

CREATE POLICY "Representante pode inserir kits" ON public.kits_entregues
  FOR INSERT WITH CHECK (representante_id = auth.uid());

CREATE POLICY "Representante pode ver seus kits entregues" ON public.kits_entregues
  FOR SELECT USING (representante_id = auth.uid());

-- === COBRANCAS_AGENDADAS ===
CREATE POLICY "Admin pode gerenciar cobranças agendadas" ON public.cobrancas_agendadas
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode atualizar suas cobranças" ON public.cobrancas_agendadas
  FOR UPDATE USING (representante_id = auth.uid());

CREATE POLICY "Representante pode criar suas cobranças" ON public.cobrancas_agendadas
  FOR INSERT WITH CHECK (representante_id = auth.uid());

CREATE POLICY "Representante pode deletar suas cobranças" ON public.cobrancas_agendadas
  FOR DELETE USING (representante_id = auth.uid());

CREATE POLICY "Representante pode ver suas cobranças" ON public.cobrancas_agendadas
  FOR SELECT USING (representante_id = auth.uid());

-- === PRESTACOES_CONTAS ===
CREATE POLICY "Admin pode deletar prestações" ON public.prestacoes_contas
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode ver todas prestações" ON public.prestacoes_contas
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode atualizar suas prestações" ON public.prestacoes_contas
  FOR UPDATE USING (representante_id = auth.uid());

CREATE POLICY "Representante pode inserir prestações" ON public.prestacoes_contas
  FOR INSERT WITH CHECK (representante_id = auth.uid());

CREATE POLICY "Representante pode ver suas prestações" ON public.prestacoes_contas
  FOR SELECT USING (representante_id = auth.uid());

-- === COBRANCAS_DIARIAS ===
CREATE POLICY "Admin pode deletar cobranças diárias" ON public.cobrancas_diarias
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode ver todas cobranças diárias" ON public.cobrancas_diarias
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode atualizar cobranças diárias" ON public.cobrancas_diarias
  FOR UPDATE USING (representante_id = auth.uid());

CREATE POLICY "Representante pode inserir cobranças diárias" ON public.cobrancas_diarias
  FOR INSERT WITH CHECK (representante_id = auth.uid());

CREATE POLICY "Representante pode ver suas cobranças diárias" ON public.cobrancas_diarias
  FOR SELECT USING (representante_id = auth.uid());

-- === METAS_COBRANCA ===
CREATE POLICY "Admin pode gerenciar metas" ON public.metas_cobranca
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode ver suas metas" ON public.metas_cobranca
  FOR SELECT USING (representante_id = auth.uid());

-- === NOTAS_PROMISSORIAS ===
CREATE POLICY "Admin pode deletar notas" ON public.notas_promissorias
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode ver todas as notas" ON public.notas_promissorias
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode atualizar notas" ON public.notas_promissorias
  FOR UPDATE USING (representante_id = auth.uid());

CREATE POLICY "Representante pode excluir suas notas" ON public.notas_promissorias
  FOR DELETE USING (representante_id = auth.uid());

CREATE POLICY "Representante pode inserir notas" ON public.notas_promissorias
  FOR INSERT WITH CHECK (representante_id = auth.uid());

CREATE POLICY "Representante pode ver suas notas" ON public.notas_promissorias
  FOR SELECT USING (representante_id = auth.uid());

-- === REPASSES ===
CREATE POLICY "Admin pode gerenciar todos os repasses" ON public.repasses
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante pode atualizar seus repasses" ON public.repasses
  FOR UPDATE USING (EXISTS (SELECT 1 FROM cobrancas_agendadas WHERE cobrancas_agendadas.id = repasses.cobranca_id AND cobrancas_agendadas.representante_id = auth.uid()));

CREATE POLICY "Representante pode criar seus repasses" ON public.repasses
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM cobrancas_agendadas WHERE cobrancas_agendadas.id = repasses.cobranca_id AND cobrancas_agendadas.representante_id = auth.uid()));

CREATE POLICY "Representante pode ver seus repasses" ON public.repasses
  FOR SELECT USING (EXISTS (SELECT 1 FROM cobrancas_agendadas WHERE cobrancas_agendadas.id = repasses.cobranca_id AND cobrancas_agendadas.representante_id = auth.uid()));

-- === ENCOMENDAS_KITS ===
CREATE POLICY "Admin gerencia encomendas" ON public.encomendas_kits
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Produção atualiza encomendas" ON public.encomendas_kits
  FOR UPDATE USING (has_role(auth.uid(), 'producao'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Produção vê todas encomendas" ON public.encomendas_kits
  FOR SELECT USING (has_role(auth.uid(), 'producao'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representantes criam suas encomendas" ON public.encomendas_kits
  FOR INSERT WITH CHECK (representante_id = auth.uid());

CREATE POLICY "Representantes veem suas encomendas" ON public.encomendas_kits
  FOR SELECT USING (representante_id = auth.uid());

-- === MESSAGES ===
CREATE POLICY "Users can delete sent messages" ON public.messages
  FOR DELETE USING (auth.uid() = sender_id);

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update received messages" ON public.messages
  FOR UPDATE USING (auth.uid() = receiver_id);

CREATE POLICY "Users can view their messages" ON public.messages
  FOR SELECT USING ((auth.uid() = sender_id) OR (auth.uid() = receiver_id));

-- === NOTIFICATIONS ===
CREATE POLICY "Admin pode criar notificações para qualquer usuário" ON public.notifications
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuário pode criar própria notificação" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas notificações" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas notificações" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem ver suas notificações" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- === PUSH_SUBSCRIPTIONS ===
CREATE POLICY "Admins can view all subscriptions" ON public.push_subscriptions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete their own subscriptions" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own subscriptions" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- === LEADS_REVENDEDORAS ===
CREATE POLICY "Admin pode atualizar leads" ON public.leads_revendedoras
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode ver todos os leads" ON public.leads_revendedoras
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Inserção pública de leads" ON public.leads_revendedoras
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- PARTE 7: STORAGE BUCKETS
-- =====================================================

-- Criar bucket de avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Políticas de storage para avatars
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================================================
-- FIM DA EXPORTAÇÃO
-- =====================================================
