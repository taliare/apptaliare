

# Importar 83 Revendedoras Faltantes e Tratar Duplicata

## Situacao Atual
- A tabela `revendedoras` tem 494 registros, todos unicos (sem duplicatas internas)
- Existem 83 revendedoras que aparecem em `cobrancas_agendadas` mas nao estao na tabela centralizada
- Ha 1 caso de variacao de nome por casing ("vanessa lopes de oliveira" / "Vanessa Lopes de Oliveira")

## Plano de Acao

### 1. Tratar a duplicata de casing
Normalizar o nome "vanessa lopes de oliveira" nas cobrancas para a forma padrao antes da importacao.

### 2. Importar as 83 revendedoras faltantes
Executar um INSERT que:
- Busca todos os nomes distintos (UPPER+TRIM) de `cobrancas_agendadas` que nao existem em `revendedoras`
- Insere cada nome com o `representante_id` correspondente
- Define `ativo` baseado na existencia de cobrancas pendentes (se tem cobranca pendente/parcial = ativa, senao = inativa)
- Usa o formato de nome mais recente (ultima cobranca) como nome oficial

### 3. Verificacao pos-importacao
Consultar a tabela para confirmar que todos os registros foram importados corretamente.

## Detalhes Tecnicos

Serao executados 2 comandos SQL via ferramenta de dados:

**Passo 1** - Normalizar casing da duplicata:
```sql
UPDATE cobrancas_agendadas
SET revendedora = 'Vanessa Lopes de Oliveira'
WHERE UPPER(TRIM(revendedora)) = 'VANESSA LOPES DE OLIVEIRA'
  AND representante_id = 'e082d4f6-c9be-4050-8aca-b05e6b9bd76c';
```

**Passo 2** - Inserir as revendedoras faltantes:
```sql
INSERT INTO revendedoras (nome, representante_id, ativo, ultima_atividade)
SELECT DISTINCT ON (UPPER(TRIM(ca.revendedora)), ca.representante_id)
  ca.revendedora as nome,
  ca.representante_id,
  EXISTS (
    SELECT 1 FROM cobrancas_agendadas c2
    WHERE UPPER(TRIM(c2.revendedora)) = UPPER(TRIM(ca.revendedora))
      AND c2.representante_id = ca.representante_id
      AND c2.status IN ('pendente','parcial','reagendado')
  ) as ativo,
  (SELECT MAX(c3.data_agendada) FROM cobrancas_agendadas c3
   WHERE UPPER(TRIM(c3.revendedora)) = UPPER(TRIM(ca.revendedora))
     AND c3.representante_id = ca.representante_id
  ) as ultima_atividade
FROM cobrancas_agendadas ca
WHERE NOT EXISTS (
  SELECT 1 FROM revendedoras r
  WHERE UPPER(TRIM(r.nome)) = UPPER(TRIM(ca.revendedora))
    AND r.representante_id = ca.representante_id
)
ORDER BY UPPER(TRIM(ca.revendedora)), ca.representante_id, ca.criado_em DESC;
```

Nenhuma alteracao de codigo ou schema necessaria -- apenas operacoes de dados.

