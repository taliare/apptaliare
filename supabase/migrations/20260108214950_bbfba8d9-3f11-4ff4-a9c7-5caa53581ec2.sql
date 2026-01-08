-- Corrigir cobranças agendadas com "Revendedora não identificada" 
-- extraindo o nome do codigo_nota no formato "NOME-timestamp14digitos"
UPDATE cobrancas_agendadas
SET revendedora = SUBSTRING(codigo_nota FROM '^(.+?)-[0-9]{14}$')
WHERE revendedora = 'Revendedora não identificada'
  AND codigo_nota ~ '^.+-[0-9]{14}$'
  AND SUBSTRING(codigo_nota FROM '^(.+?)-[0-9]{14}$') IS NOT NULL;