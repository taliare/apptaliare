
-- 1. UPDATE policy para representantes
CREATE POLICY "Representante pode atualizar suas revendedoras"
ON public.revendedoras
FOR UPDATE
TO authenticated
USING (representante_id = auth.uid())
WITH CHECK (representante_id = auth.uid());

-- 2. Tabela de auditoria
CREATE TABLE public.revendedoras_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revendedora_id uuid NOT NULL REFERENCES public.revendedoras(id) ON DELETE CASCADE,
  user_id uuid,
  acao text NOT NULL CHECK (acao IN ('criou','editou')),
  campos_alterados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_revendedoras_audit_rev ON public.revendedoras_audit(revendedora_id, criado_em DESC);

GRANT SELECT ON public.revendedoras_audit TO authenticated;
GRANT ALL ON public.revendedoras_audit TO service_role;

ALTER TABLE public.revendedoras_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin ve todo audit"
ON public.revendedoras_audit FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Representante ve audit das suas"
ON public.revendedoras_audit FOR SELECT TO authenticated
USING (revendedora_id IN (SELECT id FROM public.revendedoras WHERE representante_id = auth.uid()));

-- 3. Função de auditoria + atualizado_em
CREATE OR REPLACE FUNCTION public.fn_revendedoras_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_diff jsonb := '{}'::jsonb;
  v_campos text[] := ARRAY[
    'nome','cpf','rg','data_nascimento','genero','estado_civil',
    'cep','logradouro','numero','complemento','bairro','cidade','estado',
    'whatsapp','telefone_alternativo','email','observacoes','foto_url',
    'status_juridico','ativo'
  ];
  v_campo text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.revendedoras_audit(revendedora_id, user_id, acao, campos_alterados)
    VALUES (NEW.id, auth.uid(), 'criou', '{}'::jsonb);
    RETURN NEW;
  END IF;

  -- UPDATE: garantir atualizado_em
  NEW.atualizado_em := now();

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  FOREACH v_campo IN ARRAY v_campos LOOP
    IF (v_old->v_campo) IS DISTINCT FROM (v_new->v_campo) THEN
      v_diff := v_diff || jsonb_build_object(v_campo, jsonb_build_object('antes', v_old->v_campo, 'depois', v_new->v_campo));
    END IF;
  END LOOP;

  IF v_diff <> '{}'::jsonb THEN
    INSERT INTO public.revendedoras_audit(revendedora_id, user_id, acao, campos_alterados)
    VALUES (NEW.id, auth.uid(), 'editou', v_diff);
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger BEFORE para poder ajustar atualizado_em, e AFTER INSERT separado
CREATE TRIGGER trg_revendedoras_audit_upd
BEFORE UPDATE ON public.revendedoras
FOR EACH ROW
EXECUTE FUNCTION public.fn_revendedoras_audit();

CREATE TRIGGER trg_revendedoras_audit_ins
AFTER INSERT ON public.revendedoras
FOR EACH ROW
EXECUTE FUNCTION public.fn_revendedoras_audit();
