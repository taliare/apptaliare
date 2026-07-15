
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 1) Função: situação consolidada por revendedora
CREATE OR REPLACE FUNCTION public.calcular_situacao_revendedora(p_nome text)
RETURNS TABLE(nome text, whatsapp text, situacao text, valor_pendente numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_nome_oficial text;
  v_whatsapp text;
  v_situacao text;
  v_valor_pendente numeric := 0;
  v_prioridade int := 0;
  v_hoje date := CURRENT_DATE;
  r RECORD;
  v_bucket text;
  v_prio int;
BEGIN
  v_norm := upper(trim(public.unaccent(coalesce(p_nome, ''))));
  IF v_norm = '' THEN RETURN; END IF;

  -- Nome oficial e whatsapp (prioriza registro com whatsapp preenchido)
  SELECT r.nome, r.whatsapp
  INTO v_nome_oficial, v_whatsapp
  FROM public.revendedoras r
  WHERE upper(trim(public.unaccent(r.nome))) = v_norm
  ORDER BY (CASE WHEN coalesce(r.whatsapp,'') <> '' THEN 0 ELSE 1 END),
           r.atualizado_em DESC NULLS LAST
  LIMIT 1;

  IF v_nome_oficial IS NULL THEN
    -- fallback: usa o próprio nome recebido, sem whatsapp
    v_nome_oficial := p_nome;
  END IF;

  FOR r IN
    SELECT ca.status::text AS status,
           ca.data_agendada,
           COALESCE(ca.valor_previsto,0) AS valor_previsto,
           COALESCE(ca.valor_pago_acumulado,0) AS valor_pago_acumulado,
           COALESCE(ca.valor_adiantado,0) AS valor_adiantado
    FROM public.cobrancas_agendadas ca
    WHERE ca.vigente = true
      AND upper(trim(public.unaccent(ca.revendedora))) = v_norm
      AND ca.status NOT IN ('pago'::status_cobranca, 'cancelado'::status_cobranca)
  LOOP
    v_bucket := NULL;
    IF r.status = 'juridico' THEN
      v_bucket := 'juridico'; v_prio := 6;
    ELSIF r.status = 'parcial' AND r.data_agendada < v_hoje THEN
      v_bucket := 'parcial_vencida'; v_prio := 5;
    ELSIF r.status = 'pendente' AND r.data_agendada < v_hoje THEN
      v_bucket := 'vencida'; v_prio := 4;
    ELSIF r.status = 'parcial' THEN
      v_bucket := 'parcial'; v_prio := 3;
    ELSIF r.status = 'pendente' AND r.data_agendada = v_hoje THEN
      v_bucket := 'vence_hoje'; v_prio := 2;
    ELSIF r.status = 'pendente' AND r.data_agendada > v_hoje THEN
      v_bucket := 'a_vencer'; v_prio := 1;
    ELSE
      CONTINUE;
    END IF;

    IF v_prio > v_prioridade THEN
      v_prioridade := v_prio;
      v_situacao := v_bucket;
    END IF;

    v_valor_pendente := v_valor_pendente
      + GREATEST(0, r.valor_previsto - r.valor_pago_acumulado - r.valor_adiantado);
  END LOOP;

  IF v_situacao IS NULL THEN
    RETURN;
  END IF;

  nome := v_nome_oficial;
  whatsapp := v_whatsapp;
  situacao := v_situacao;
  valor_pendente := round(v_valor_pendente::numeric, 2);
  RETURN NEXT;
END;
$$;

-- 2) Função: dispara POST para o Atendro
CREATE OR REPLACE FUNCTION public.enviar_webhook_atendro(p_revendedora_nome text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
BEGIN
  SELECT * INTO v
  FROM public.calcular_situacao_revendedora(p_revendedora_nome)
  LIMIT 1;

  IF v.situacao IS NULL THEN
    RETURN;
  END IF;

  IF v.whatsapp IS NULL OR trim(v.whatsapp) = '' THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://api.atendro.ai/functions/v1/automation-webhook/9f84ba02-e036-43b6-8082-b47edcb21505',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'nome', v.nome,
      'whatsapp', v.whatsapp,
      'situacao', v.situacao,
      'valor_pendente', v.valor_pendente
    )
  );
END;
$$;

-- 3) Trigger em cobrancas_agendadas
CREATE OR REPLACE FUNCTION public.fn_notificar_atendro_cobranca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF NEW.revendedora IS NOT NULL AND trim(NEW.revendedora) <> '' THEN
      PERFORM public.enviar_webhook_atendro(NEW.revendedora);
    END IF;
    IF TG_OP = 'UPDATE'
       AND OLD.revendedora IS NOT NULL
       AND trim(OLD.revendedora) <> ''
       AND OLD.revendedora IS DISTINCT FROM NEW.revendedora THEN
      PERFORM public.enviar_webhook_atendro(OLD.revendedora);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Falha ao notificar Atendro para %: %', NEW.revendedora, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_atendro_cobranca ON public.cobrancas_agendadas;
CREATE TRIGGER trg_notificar_atendro_cobranca
AFTER INSERT OR UPDATE OF status, data_agendada, valor_pago_acumulado
ON public.cobrancas_agendadas
FOR EACH ROW
EXECUTE FUNCTION public.fn_notificar_atendro_cobranca();
