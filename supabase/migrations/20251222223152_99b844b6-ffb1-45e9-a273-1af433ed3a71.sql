-- Adicionar coluna devolveu_tudo à tabela notas_promissorias
ALTER TABLE public.notas_promissorias 
ADD COLUMN devolveu_tudo boolean NOT NULL DEFAULT false;

-- Criar índice para otimizar consultas
CREATE INDEX idx_notas_promissorias_devolveu_tudo ON public.notas_promissorias(devolveu_tudo) WHERE devolveu_tudo = true;

-- Corrigir dados antigos: identificar notas que realmente são devoluções
-- Uma nota zerada é devolução APENAS se NÃO existir repasse associado
-- Primeiro, atualizar todas as notas zeradas como devolveu_tudo = true
UPDATE public.notas_promissorias np
SET devolveu_tudo = true
WHERE np.valor_total = 0;

-- Depois, desmarcar as que têm repasses (essas são acertos com repasse, não devolução)
-- Uma nota com repasse significa que gerou valor de repasse, logo não é devolução total
UPDATE public.notas_promissorias np
SET devolveu_tudo = false
WHERE np.valor_total = 0
AND EXISTS (
  SELECT 1 
  FROM public.cobrancas_agendadas ca
  JOIN public.repasses r ON r.cobranca_id = ca.id
  WHERE ca.codigo_nota = np.codigo_nota
  AND ca.representante_id = np.representante_id
);