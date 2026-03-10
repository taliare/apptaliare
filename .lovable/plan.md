

# Investigation Results & Fix Plan

## Findings

### Frontend code is correct
All 6 insert points were inspected:

| Table | File | Insert Format | Mutation | Error Handling |
|-------|------|--------------|----------|----------------|
| t2_revendedoras | T2Revendedoras.tsx:74 | `.insert({...})` ✅ | useMutation ✅ | throw error ✅ |
| t2_ciclos | T2Ciclos.tsx:86 | `.insert({...})` ✅ | useMutation ✅ | throw error ✅ |
| t2_pedidos | T2Producao.tsx:67 | `.insert({...})` ✅ | useMutation ✅ | throw error ✅ |
| t2_apuracoes | ApuracaoDialog.tsx:47 | `.insert({...})` ✅ | useMutation ✅ | throw error ✅ |
| t2_pagamentos | PagamentoDialog.tsx:34 | `.insert({...})` ✅ | useMutation ✅ | throw error ✅ |
| t2_adiantamentos | AdiantamentoDialog.tsx:48 | `.insert({...})` ✅ | useMutation ✅ | throw error ✅ |

- All imports use `@/integrations/supabase/client` ✅
- All mutations are properly wired to buttons/forms ✅
- No state-only updates without Supabase calls ✅
- `.insert({...})` single-object format is valid in Supabase JS v2 ✅

### Root cause: RLS policies are ALL RESTRICTIVE

Despite the user stating "RLS está desativado," the database schema shows RLS **is enabled** on all t2_* tables, and **every single policy is RESTRICTIVE** (`Permissive: No`).

In PostgreSQL, RESTRICTIVE policies can only *narrow* access already granted by a PERMISSIVE policy. With **zero PERMISSIVE policies**, no data operations succeed — inserts silently fail (Supabase returns empty data, no error thrown in some cases).

This affects **all 6 tables**: `t2_revendedoras`, `t2_ciclos`, `t2_apuracoes`, `t2_pagamentos`, `t2_adiantamentos`. The `t2_pedidos` table likely has the same issue. Additionally, the `repasses` table has the same pattern.

Note: We previously fixed `t2_apuracoes` but the schema still shows RESTRICTIVE — the migration may not have applied correctly.

## Fix

### 1. Database Migration
Drop and recreate ALL RLS policies on the 6 t2_* tables as **PERMISSIVE** (default). The policy logic stays identical — only the restrictive/permissive flag changes.

Tables to fix:
- `t2_revendedoras` (3 policies)
- `t2_ciclos` (4 policies)
- `t2_apuracoes` (3 policies)
- `t2_pagamentos` (3 policies)
- `t2_adiantamentos` (3 policies)

For `t2_pedidos` — will check if it has the same issue and include it.

### 2. Frontend: Add `.select()` and logging to all insert mutations
For better diagnostics (per project standard), add `.select()` and `console.log`/`console.error` to all 6 insert points:
- `T2Revendedoras.tsx`
- `T2Ciclos.tsx`
- `T2Producao.tsx`
- `ApuracaoDialog.tsx` (already partially done)
- `PagamentoDialog.tsx`
- `AdiantamentoDialog.tsx`

### No other frontend changes needed
The insert format, mutations, error handling, and Supabase client import are all correct.

