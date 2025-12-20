-- Etapa 1: Limpar duplicatas e adicionar constraint UNIQUE em kits_entregues

-- 1. Primeiro, identificar e deletar duplicatas mantendo apenas o registro mais recente (por criado_em)
DELETE FROM kits_entregues
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY codigo_mostruario, representante_id 
             ORDER BY criado_em DESC
           ) as rn
    FROM kits_entregues
  ) subquery
  WHERE rn > 1
);

-- 2. Adicionar constraint UNIQUE para evitar futuras duplicatas
ALTER TABLE kits_entregues 
ADD CONSTRAINT kits_entregues_codigo_representante_unique 
UNIQUE (codigo_mostruario, representante_id);