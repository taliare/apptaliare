

# Regras de Integridade TALIARE 2.0

## Current State

- UNIQUE constraint on `t2_apuracoes(ciclo_id)` already exists (migration `20260310005250`)
- DB trigger `t2_processar_pagamento` already handles: updating saldo, updating valor_pago on ciclo, and setting `status = 'encerrado'` when saldo reaches zero
- DB trigger `t2_validar_pagamento` already blocks payments exceeding `saldo_a_receber`
- DB trigger `t2_validar_adiantamento` already validates adiantamentos against valor_kit
- Frontend already has guards for duplicate apuração in T2Ciclos.tsx

## What's Missing

1. **Payments require apuração first** — no DB or frontend guard exists
2. **Payment validation uses `saldo_a_receber` from apuração only** — doesn't account for adiantamentos (adiantamentos are already subtracted during apuração creation, so this is actually correct)
3. **Status flow enforcement** — no guard preventing status regression (encerrado → ativo)

## Plan

### Database Migration

1. **Add trigger to block payments without apuração**: Before insert on `t2_pagamentos`, verify that the `apuracao_id` references an apuração whose `ciclo_id` has status `'ativo'` and the apuração exists.

2. **Add trigger to enforce status flow**: Before update on `t2_ciclos`, if `status` is being changed, ensure it only moves forward: `ativo → encerrado` (or `ativo → inadimplente`). Block any regression.

### Frontend Changes

#### PagamentoDialog.tsx
- No changes needed — payments already go through `apuracao_id`, so they inherently require an apuração to exist. The "Registrar Pagamento" button only appears inside `ApuracoesSection` when an apuração exists.

#### T2Ciclos.tsx  
- The "Prestação" button already checks `hasApuracao` and is disabled accordingly. No changes needed.

#### ApuracoesSection.tsx
- Already only shows payment button when `saldo_a_receber > 0`. No changes needed.

### Summary

| Change | Where |
|--------|-------|
| Trigger: block t2_pagamentos insert if ciclo has no apuração | DB migration |
| Trigger: enforce status flow on t2_ciclos (no regression) | DB migration |
| No frontend changes needed | — |

The existing triggers and frontend guards already handle most rules. We only need 2 new DB triggers for server-side enforcement.

