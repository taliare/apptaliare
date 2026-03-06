
-- Views para histórico e ranking de revendedoras T2

-- View: Histórico agregado por revendedora
CREATE OR REPLACE VIEW public.t2_vw_historico_revendedoras AS
SELECT
  r.id AS revendedora_id,
  r.nome_completo AS nome_revendedora,
  r.representante_id,
  r.cidade,
  r.categoria_atual,
  r.score,
  COUNT(DISTINCT c.id) AS total_ciclos,
  COALESCE(SUM(a.valor_vendido), 0) AS total_vendido,
  CASE WHEN COUNT(a.id) > 0 THEN ROUND(AVG(a.valor_vendido), 2) ELSE 0 END AS ticket_medio,
  COALESCE(SUM(a.valor_empresa), 0) AS total_pago_empresa,
  MIN(c.data_inicio) AS data_primeiro_ciclo,
  MAX(c.data_inicio) AS data_ultimo_ciclo
FROM public.t2_revendedoras r
LEFT JOIN public.t2_ciclos c ON c.revendedora_id = r.id
LEFT JOIN public.t2_apuracoes a ON a.ciclo_id = c.id
GROUP BY r.id, r.nome_completo, r.representante_id, r.cidade, r.categoria_atual, r.score;

-- View: Ranking ordenado por total vendido
CREATE OR REPLACE VIEW public.t2_vw_ranking_revendedoras AS
SELECT
  r.id AS revendedora_id,
  r.nome_completo AS nome_revendedora,
  r.representante_id,
  r.cidade,
  r.categoria_atual,
  r.score,
  COUNT(DISTINCT c.id) AS total_ciclos,
  COALESCE(SUM(a.valor_vendido), 0) AS total_vendido
FROM public.t2_revendedoras r
LEFT JOIN public.t2_ciclos c ON c.revendedora_id = r.id
LEFT JOIN public.t2_apuracoes a ON a.ciclo_id = c.id
GROUP BY r.id, r.nome_completo, r.representante_id, r.cidade, r.categoria_atual, r.score
ORDER BY total_vendido DESC;

-- Trigger: Classificação automática da revendedora após apuração
CREATE OR REPLACE FUNCTION public.t2_atualizar_categoria_revendedora()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_revendedora_id uuid;
  v_categoria text;
BEGIN
  -- Buscar revendedora_id do ciclo
  SELECT revendedora_id INTO v_revendedora_id
  FROM public.t2_ciclos WHERE id = NEW.ciclo_id;

  -- Classificar baseado no valor_vendido da apuração
  IF NEW.valor_vendido >= 2000 THEN
    v_categoria := 'ELITE';
  ELSIF NEW.valor_vendido >= 1000 THEN
    v_categoria := 'DESTAQUE';
  ELSIF NEW.valor_vendido >= 300 THEN
    v_categoria := 'ATIVA';
  ELSE
    v_categoria := 'INICIAL';
  END IF;

  UPDATE public.t2_revendedoras
  SET categoria_atual = v_categoria
  WHERE id = v_revendedora_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER t2_trigger_classificacao
AFTER INSERT ON public.t2_apuracoes
FOR EACH ROW
EXECUTE FUNCTION public.t2_atualizar_categoria_revendedora();

-- Trigger: Score automático ao mudar status do ciclo
CREATE OR REPLACE FUNCTION public.t2_atualizar_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só processar quando status realmente mudar
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'encerrado' THEN
      UPDATE public.t2_revendedoras
      SET score = score + 10
      WHERE id = NEW.revendedora_id;
    ELSIF NEW.status = 'inadimplente' THEN
      UPDATE public.t2_revendedoras
      SET score = score - 20
      WHERE id = NEW.revendedora_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER t2_trigger_score
AFTER UPDATE ON public.t2_ciclos
FOR EACH ROW
EXECUTE FUNCTION public.t2_atualizar_score();
