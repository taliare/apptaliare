

# Correção de "Notas Cobradas" e "Ticket Médio" no Dashboard

## Resumo
A query de `notasCobradas` conta todas as linhas de `notas_promissorias`, mas ciclos parciais geram múltiplas notas para a mesma cobrança, inflando os números. A correção conta apenas `cobranca_id` distintos.

## Alterações em `src/pages/Dashboard.tsx`

### 1. Query notasCobradas (linhas 202-206)
Adicionar `cobranca_id` ao select:
```typescript
.select("id, cobranca_id")
```

### 2. Cálculo totalNotasCobradas e ticketMedio (linhas 219-220)
Substituir contagem simples por contagem de `cobranca_id` distintos usando `Set`:
```typescript
const cobrancasUnicas = new Set(
  notasCobradas
    .filter(n => n.cobranca_id)
    .map(n => n.cobranca_id)
);
const totalNotasCobradas = cobrancasUnicas.size;
const ticketMedio = totalNotasCobradas > 0 ? totalCobrado / totalNotasCobradas : 0;
```

### Arquivo afetado
- `src/pages/Dashboard.tsx` — 2 blocos substituídos

