

# Ciclos T2 — Agenda de Cobrança

## Database Changes (Migration)

1. **Add `data_cobranca` column** to `t2_ciclos`:
   - `data_cobranca DATE` nullable (for existing rows), default calculated on insert

2. **Add UNIQUE constraint** on `t2_apuracoes(ciclo_id)` to enforce one apuração per ciclo

3. **Backfill existing rows**: set `data_cobranca = (data_inicio + 45 days)::date` for existing ciclos

## Frontend Changes

### T2Ciclos.tsx — Full rewrite of the listing

- Query filters to `status = 'ativo'`, ordered by `data_cobranca ASC`
- Group ciclos into 4 sections based on `data_cobranca` vs today:
  - **Atrasados** (data_cobranca < hoje) — red accent
  - **Hoje** (data_cobranca = hoje) — highlighted
  - **Amanhã** (data_cobranca = hoje+1)
  - **Esta Semana** (data_cobranca within next 7 days)
  - Remaining active ciclos shown in a "Próximos" section
- Each section has a header with count
- Keep the existing card layout with indicator colors, but base them on `data_cobranca` instead of `data_vencimento`
- Keep "Novo Ciclo" dialog — on insert, set `data_cobranca` = `data_vencimento` (which is already defaulted to +45 days)

### PagamentoDialog.tsx — Ask for next `data_cobranca` on partial payment

- After entering payment amount, if `pago < saldo` (partial), show a date input "Próxima data de cobrança"
- On submit, after inserting `t2_pagamentos`, also update `t2_ciclos.data_cobranca` with the new date
- The existing trigger `t2_processar_pagamento` already handles setting `status = 'encerrado'` when saldo reaches zero, so encerrado ciclos will automatically disappear from the agenda query

### ApuracaoDialog.tsx — Minor guard

- Before opening, check if ciclo already has an apuração (the UNIQUE constraint will also enforce this server-side)
- Show a toast if already has apuração instead of opening the dialog

## Summary of changes

| Area | What |
|------|------|
| Migration | Add `data_cobranca DATE` to `t2_ciclos`, UNIQUE on `t2_apuracoes(ciclo_id)`, backfill |
| T2Ciclos.tsx | Filter active only, order by `data_cobranca`, group into agenda sections |
| PagamentoDialog.tsx | Add "nova data de cobrança" field for partial payments, update ciclo |
| ApuracaoDialog.tsx | Guard against duplicate apuração |

