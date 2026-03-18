
# Correcao do DRE - Fevereiro nao soma valores

## Problema
A consulta do DRE usa `fimMes = "${anoMes}-31"` como limite superior da data. Para fevereiro, isso gera a data invalida `2026-02-31`, que causa um erro no banco de dados. O resultado e que a query falha silenciosamente e retorna zero para Total Cobrado e Despesas de Cobranca.

Os dados existem no banco (56 fechamentos em fevereiro, R$ 40.447,30 de total cobrado, R$ 4.008,44 de despesas), mas nao sao retornados por causa desse bug.

## Solucao
Alterar `src/pages/DreResumo.tsx` para calcular o ultimo dia real do mes selecionado em vez de usar dia 31 fixo.

### Alteracao em `DreResumo.tsx` (query de cobrancas_diarias)

**De:**
```typescript
const inicioMes = `${anoMes}-01`;
const fimMes = `${anoMes}-31`;
```

**Para:**
```typescript
const inicioMes = `${anoMes}-01`;
const ultimoDia = new Date(parseInt(selectedAno), parseInt(selectedMes), 0).getDate();
const fimMes = `${anoMes}-${String(ultimoDia).padStart(2, "0")}`;
```

Isso usa `new Date(ano, mes, 0)` que retorna o ultimo dia do mes corretamente (28/29 para fevereiro, 30 para abril/junho/setembro/novembro, 31 para os demais).

**Nota:** O `selectedAno` e `selectedMes` precisam ser acessiveis dentro da queryFn. Eles ja estao no escopo do componente, entao nao ha problema. Tambem serao adicionados ao `queryKey` (ja estao via `anoMes`).

## Impacto
- Apenas 1 arquivo alterado: `src/pages/DreResumo.tsx`
- Corrige o problema para fevereiro e qualquer outro mes com menos de 31 dias (abril, junho, setembro, novembro)
- Nenhuma alteracao de banco de dados necessaria
