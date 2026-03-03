

# Correção do Fluxo de Prestação de Contas

## Resumo dos Problemas

4 bugs identificados no fluxo de cobrança. O usuário corrigiu o exemplo do Bug 2: se a empresa deve receber R$ 560 e a revendedora pagou R$ 200, o valor previsto deve ser R$ 560 (definido na primeira cobrança) e o saldo = 560 - 200 = **R$ 360** (não 760 como o bug atual calcula).

---

## Correções

### 1. `Cobranca.tsx` - handlePagamentoParcial (linha 443)

**Bug**: `valorPrevistoEfetivo = dados.valor_devido_empresa + dados.valor_recebido` (560+200=760)
**Fix**: `valorPrevistoEfetivo = dados.valor_devido_empresa` (560)

Com isso, saldo = 560 - 200 - 0 = 360. Correto.

### 2. `Cobranca.tsx` - handlePagamentoCompleto (linhas 324-337)

Na primeira cobrança de kit, atualizar `valor_previsto` para `valor_devido_empresa` para que o saldo seja calculado corretamente. Para devoluções, setar `valor_previsto = 0`.

### 3. `ModalReceberCobranca.tsx` - Modo de cobrança subsequente

Quando `valor_pago_acumulado > 0` (nota já tem pagamentos anteriores):
- **Esconder** campo "Valor da Venda" e seção de comissão (já definidos na primeira prestação)
- Calcular saldo automaticamente: `saldo = valor_previsto - valor_pago_acumulado - valor_adiantado`
- Mostrar apenas: saldo em aberto, forma de pagamento, opção parcial, data
- Enviar `valor_venda: 0`, `comissao: 0`, `valor_devido_empresa: saldo` nos handlers

### 4. Correção de dados em produção (SQL)

```sql
-- 447 notas 'pago' com saldo > 0: corrigir valor_previsto = acumulado + adiantado
UPDATE cobrancas_agendadas
SET valor_previsto = COALESCE(valor_pago_acumulado, 0) + COALESCE(valor_adiantado, 0)
WHERE status = 'pago'
  AND (valor_previsto - COALESCE(valor_pago_acumulado, 0) - COALESCE(valor_adiantado, 0)) > 0.01
  AND valor_previsto > 0
  AND COALESCE(valor_pago_acumulado, 0) > 0;

-- Devoluções: notas 'pago' com acumulado = 0
UPDATE cobrancas_agendadas
SET valor_previsto = 0
WHERE status = 'pago'
  AND COALESCE(valor_pago_acumulado, 0) = 0
  AND valor_previsto > 0
  AND data_quitacao IS NOT NULL;

-- Parcial com saldo = 0: marcar como pago
UPDATE cobrancas_agendadas
SET status = 'pago', data_quitacao = CURRENT_DATE
WHERE status = 'parcial'
  AND (valor_previsto - COALESCE(valor_pago_acumulado, 0) - COALESCE(valor_adiantado, 0)) <= 0.01;
```

## Fluxo Corrigido

```text
1a Cobrança (KIT):
  Representante informa: valor_venda=5000, comissão=40%=2000
  valor_devido_empresa = 3000
  Revendedora paga 1000 (parcial)
  → valor_previsto = 3000 (atualizado para valor_devido_empresa)
  → valor_pago_acumulado = 1000
  → saldo = 3000 - 1000 = 2000
  → status = 'parcial'

2a Cobrança (subsequente):
  Modal mostra: saldo = 2000 (sem pedir valor da venda)
  Revendedora paga 2000
  → valor_pago_acumulado = 3000
  → saldo = 3000 - 3000 = 0
  → status = 'pago', nota sai da agenda
```

## Arquivos Alterados
1. `src/pages/Cobranca.tsx` - Corrigir fórmulas nos handlers
2. `src/components/cobranca/ModalReceberCobranca.tsx` - Modo subsequente
3. SQL via insert tool - Correção dos ~448 registros

