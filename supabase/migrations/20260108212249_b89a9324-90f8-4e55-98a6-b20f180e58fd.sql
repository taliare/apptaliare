-- Adicionar coluna encomenda_id na tabela kits_estoque
ALTER TABLE kits_estoque ADD COLUMN encomenda_id uuid REFERENCES encomendas_kits(id);

-- Atualizar a encomenda existente de "misto" para "especial"
UPDATE encomendas_kits 
SET tipo_kit = 'especial' 
WHERE codigo_kit = '5543';

-- Inserir o kit 5543 no estoque como "especial" com referência à encomenda
INSERT INTO kits_estoque (tipo, codigo, status, representante_id, encomenda_id)
VALUES (
  'especial', 
  '5543', 
  'estoque', 
  NULL,
  '93486706-e0a3-4fee-b1db-ad65ac49170e'
);