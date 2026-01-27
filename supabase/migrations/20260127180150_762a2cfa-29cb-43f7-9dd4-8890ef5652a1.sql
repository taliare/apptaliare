-- 1. Criar tabela de revendedoras
CREATE TABLE public.revendedoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  whatsapp text,
  representante_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  ultima_atividade date,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now(),
  UNIQUE (nome, representante_id)
);

-- 2. Criar índice simples para busca
CREATE INDEX idx_revendedoras_nome ON public.revendedoras (nome);
CREATE INDEX idx_revendedoras_representante ON public.revendedoras (representante_id);

-- 3. Habilitar RLS
ALTER TABLE public.revendedoras ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de acesso
CREATE POLICY "Admin pode gerenciar revendedoras"
ON public.revendedoras FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Representante pode ver suas revendedoras"
ON public.revendedoras FOR SELECT
TO authenticated
USING (representante_id = auth.uid());

-- 5. Migrar dados existentes de cobrancas_agendadas (revendedoras únicas)
INSERT INTO public.revendedoras (nome, representante_id, ativo, ultima_atividade)
SELECT DISTINCT ON (UPPER(TRIM(c.revendedora)), c.representante_id)
  UPPER(TRIM(c.revendedora)) as nome,
  c.representante_id,
  false as ativo,
  (SELECT MAX(data_agendada) FROM cobrancas_agendadas ca 
   WHERE UPPER(TRIM(ca.revendedora)) = UPPER(TRIM(c.revendedora)) 
   AND ca.representante_id = c.representante_id) as ultima_atividade
FROM cobrancas_agendadas c
WHERE c.revendedora IS NOT NULL 
  AND TRIM(c.revendedora) != ''
ORDER BY UPPER(TRIM(c.revendedora)), c.representante_id, c.data_agendada DESC
ON CONFLICT (nome, representante_id) DO NOTHING;

-- 6. Marcar como ativas as revendedoras com cobranças pendentes
UPDATE public.revendedoras r
SET ativo = true
WHERE EXISTS (
  SELECT 1 FROM cobrancas_agendadas c
  WHERE UPPER(TRIM(c.revendedora)) = r.nome
    AND c.representante_id = r.representante_id
    AND c.status IN ('pendente', 'parcial', 'reagendado')
);