

# Correção do handleJuridicoClick para usar saldo real

## Resumo
Atualizar `valor_previsto` para o saldo real (descontando pagamentos e adiantamentos) ao encaminhar cobrança ao jurídico.

## Alteração em `src/pages/Cobranca.tsx`

### Bloco 1: juridicoMutation (linhas 667-686)
Alterar `mutationFn` para receber `{ id, saldoReal }` em vez de apenas `id`, e incluir `valor_previsto: saldoReal` no update.

### Bloco 2: handleJuridicoClick (linhas 688-690)
Calcular `saldoReal = Math.max(0, valor_previsto - acumulado - adiantado)` e passar `{ id, saldoReal }` ao mutate.

### Arquivo afetado
- `src/pages/Cobranca.tsx` — 2 blocos (linhas 667-690)

