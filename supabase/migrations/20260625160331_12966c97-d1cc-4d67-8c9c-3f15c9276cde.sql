
-- Overload 1 (24 params) — corrige valor_total da promissória para soma das formas
CREATE OR REPLACE FUNCTION public.registrar_pagamento_cobranca(
  p_cobranca_id uuid, p_representante_id uuid, p_revendedora text,
  p_total_venda numeric, p_comissao_percentual numeric, p_comissao_valor numeric,
  p_valor_devido_empresa numeric, p_valor_pago_prestacao numeric, p_saldo_devedor numeric,
  p_forma_pagamento text, p_data_execucao date, p_codigo_nota_ref text,
  p_valor_nota numeric, p_forma_pagamento_1 text, p_valor_pagamento_1 numeric,
  p_forma_pagamento_2 text DEFAULT NULL::text, p_valor_pagamento_2 numeric DEFAULT NULL::numeric,
  p_devolveu_tudo boolean DEFAULT false, p_status_no_pagamento text DEFAULT NULL::text,
  p_novo_acumulado numeric DEFAULT NULL::numeric, p_novo_valor_previsto numeric DEFAULT NULL::numeric,
  p_novo_status text DEFAULT NULL::text, p_data_quitacao date DEFAULT NULL::date,
  p_data_agendada date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prestacao_id UUID;
  v_nota_id      UUID;
  v_acumulado    NUMERIC;
BEGIN
  -- Proteção anti-duplicata: bloqueia submissão idêntica nos últimos 30 segundos
  IF EXISTS (
    SELECT 1 FROM prestacoes_contas
    WHERE cobranca_id  = p_cobranca_id
      AND valor_pago   = p_valor_pago_prestacao
      AND data_execucao = p_data_execucao
      AND criado_em    > NOW() - INTERVAL '30 seconds'
  ) THEN
    SELECT id INTO v_nota_id
    FROM notas_promissorias
    WHERE cobranca_id = p_cobranca_id
    ORDER BY criado_em DESC LIMIT 1;

    RETURN jsonb_build_object(
      'success',   true,
      'nota_id',   v_nota_id,
      'duplicate', true
    );
  END IF;

  -- Acumulado calculado dentro da transação
  SELECT COALESCE(SUM(valor_pago), 0) + p_valor_pago_prestacao
  INTO v_acumulado
  FROM prestacoes_contas
  WHERE cobranca_id = p_cobranca_id;

  -- 1. Inserir prestação de contas
  INSERT INTO prestacoes_contas (
    cobranca_id, representante_id, revendedora,
    total_venda, comissao_percentual, comissao_valor,
    valor_devido_empresa, valor_pago, saldo_devedor,
    forma_pagamento, data_execucao, codigo_nota_referencia
  ) VALUES (
    p_cobranca_id, p_representante_id, p_revendedora,
    p_total_venda, p_comissao_percentual, p_comissao_valor,
    p_valor_devido_empresa, p_valor_pago_prestacao, p_saldo_devedor,
    p_forma_pagamento, p_data_execucao, p_codigo_nota_ref
  ) RETURNING id INTO v_prestacao_id;

  -- 2. Inserir nota promissória (valor_total = soma das formas)
  INSERT INTO notas_promissorias (
    representante_id, codigo_nota, cobranca_id, data,
    valor_total, forma_pagamento_1, valor_pagamento_1,
    forma_pagamento_2, valor_pagamento_2,
    devolveu_tudo, status_no_pagamento
  ) VALUES (
    p_representante_id, p_codigo_nota_ref, p_cobranca_id, p_data_execucao,
    COALESCE(p_valor_pagamento_1, 0) + COALESCE(p_valor_pagamento_2, 0),
    p_forma_pagamento_1, p_valor_pagamento_1,
    p_forma_pagamento_2, p_valor_pagamento_2,
    p_devolveu_tudo, p_status_no_pagamento
  ) RETURNING id INTO v_nota_id;

  -- 3. Atualizar cobrança preservando valor_kit_original
  UPDATE cobrancas_agendadas
  SET
    valor_kit_original   = CASE
      WHEN p_novo_valor_previsto IS NOT NULL AND valor_kit_original IS NULL
        THEN valor_previsto
      ELSE valor_kit_original
    END,
    valor_pago_acumulado = v_acumulado,
    valor_previsto       = COALESCE(p_novo_valor_previsto, valor_previsto),
    status               = p_novo_status::status_cobranca,
    data_quitacao        = p_data_quitacao,
    data_agendada        = COALESCE(p_data_agendada, data_agendada)
  WHERE id = p_cobranca_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cobranca_id % não encontrado', p_cobranca_id;
  END IF;

  RETURN jsonb_build_object(
    'success',      true,
    'prestacao_id', v_prestacao_id,
    'nota_id',      v_nota_id,
    'acumulado',    v_acumulado
  );
END;
$function$;

-- Overload 2 (25 params, com p_valor_devolvido) — mesma correção
CREATE OR REPLACE FUNCTION public.registrar_pagamento_cobranca(
  p_cobranca_id uuid, p_representante_id uuid, p_revendedora text,
  p_total_venda numeric, p_comissao_percentual numeric, p_comissao_valor numeric,
  p_valor_devido_empresa numeric, p_valor_pago_prestacao numeric, p_saldo_devedor numeric,
  p_forma_pagamento text, p_data_execucao date, p_codigo_nota_ref text,
  p_valor_nota numeric, p_forma_pagamento_1 text, p_valor_pagamento_1 numeric,
  p_forma_pagamento_2 text DEFAULT NULL::text, p_valor_pagamento_2 numeric DEFAULT NULL::numeric,
  p_devolveu_tudo boolean DEFAULT false, p_status_no_pagamento text DEFAULT NULL::text,
  p_novo_acumulado numeric DEFAULT NULL::numeric, p_novo_valor_previsto numeric DEFAULT NULL::numeric,
  p_novo_status text DEFAULT NULL::text, p_data_quitacao date DEFAULT NULL::date,
  p_data_agendada date DEFAULT NULL::date, p_valor_devolvido numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prestacao_id UUID;
  v_nota_id      UUID;
  v_acumulado    NUMERIC;
BEGIN
  IF EXISTS (
    SELECT 1 FROM prestacoes_contas
    WHERE cobranca_id  = p_cobranca_id
      AND valor_pago   = p_valor_pago_prestacao
      AND data_execucao = p_data_execucao
      AND criado_em    > NOW() - INTERVAL '30 seconds'
  ) THEN
    SELECT id INTO v_nota_id
    FROM notas_promissorias
    WHERE cobranca_id = p_cobranca_id
    ORDER BY criado_em DESC LIMIT 1;

    RETURN jsonb_build_object(
      'success',   true,
      'nota_id',   v_nota_id,
      'duplicate', true
    );
  END IF;

  SELECT COALESCE(SUM(valor_pago), 0) + p_valor_pago_prestacao
  INTO v_acumulado
  FROM prestacoes_contas
  WHERE cobranca_id = p_cobranca_id;

  INSERT INTO prestacoes_contas (
    cobranca_id, representante_id, revendedora,
    total_venda, comissao_percentual, comissao_valor,
    valor_devido_empresa, valor_pago, saldo_devedor,
    forma_pagamento, data_execucao, codigo_nota_referencia,
    valor_devolvido
  ) VALUES (
    p_cobranca_id, p_representante_id, p_revendedora,
    p_total_venda, p_comissao_percentual, p_comissao_valor,
    p_valor_devido_empresa, p_valor_pago_prestacao, p_saldo_devedor,
    p_forma_pagamento::forma_pagamento, p_data_execucao, p_codigo_nota_ref,
    COALESCE(p_valor_devolvido, 0)
  ) RETURNING id INTO v_prestacao_id;

  INSERT INTO notas_promissorias (
    representante_id, codigo_nota, cobranca_id, data,
    valor_total, forma_pagamento_1, valor_pagamento_1,
    forma_pagamento_2, valor_pagamento_2,
    devolveu_tudo, status_no_pagamento
  ) VALUES (
    p_representante_id, p_codigo_nota_ref, p_cobranca_id, p_data_execucao,
    COALESCE(p_valor_pagamento_1, 0) + COALESCE(p_valor_pagamento_2, 0),
    p_forma_pagamento_1::forma_pagamento, p_valor_pagamento_1,
    CASE WHEN p_forma_pagamento_2 IS NULL THEN NULL ELSE p_forma_pagamento_2::forma_pagamento END,
    p_valor_pagamento_2,
    p_devolveu_tudo, p_status_no_pagamento
  ) RETURNING id INTO v_nota_id;

  UPDATE cobrancas_agendadas
  SET
    valor_kit_original   = CASE
      WHEN p_novo_valor_previsto IS NOT NULL AND valor_kit_original IS NULL
        THEN valor_previsto
      ELSE valor_kit_original
    END,
    valor_pago_acumulado = v_acumulado,
    valor_previsto       = COALESCE(p_novo_valor_previsto, valor_previsto),
    status               = p_novo_status::status_cobranca,
    data_quitacao        = p_data_quitacao,
    data_agendada        = COALESCE(p_data_agendada, data_agendada)
  WHERE id = p_cobranca_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cobranca_id % não encontrado', p_cobranca_id;
  END IF;

  RETURN jsonb_build_object(
    'success',      true,
    'prestacao_id', v_prestacao_id,
    'nota_id',      v_nota_id,
    'acumulado',    v_acumulado
  );
END;
$function$;
