

# Correção do cálculo de saldo em aberto — Cobrança de Kit

## Problema
Quando um kit já tem pagamentos anteriores (`valor_pago_acumulado > 0`), o `valor_previsto` só é atualizado na primeira cobrança (quando `acumuladoAtual === 0`). Nas cobranças seguintes, ele mantém o valor antigo, gerando saldo errado.

## Correções

### Correção 1 — `handlePagamentoCompleto` (linhas 337-344)
Remover a condição `acumuladoAtual === 0`, e calcular `valor_previsto = valor_devido_empresa + acumuladoAtual`:

```typescript
if (dados.tipo === 'devolucao') {
  updateData.valor_previsto = 0;
  valorPrevistoEfetivo = 0;
} else if (cobranca?.tipo?.toLowerCase() !== 'repasse') {
  updateData.valor_previsto = dados.valor_devido_empresa + acumuladoAtual;
  valorPrevistoEfetivo = dados.valor_devido_empresa + acumuladoAtual;
}
```

### Correção 2 — `handlePagamentoParcial` (linhas 458-462)
Mesma lógica: remover condição `acumuladoAtual === 0`, usar fórmula corrigida:

```typescript
if (cobranca?.tipo?.toLowerCase() !== 'repasse') {
  valorPrevistoEfetivo = dados.valor_devido_empresa + acumuladoAtual;
  updateData.valor_previsto = valorPrevistoEfetivo;
}
```

### Arquivo afetado
- `src/pages/Cobranca.tsx` — apenas 2 blocos substituídos, nenhuma outra alteração

