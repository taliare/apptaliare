

# Fix: RLS Policies Still RESTRICTIVE — Blocking All Inserts

## Root Cause

The previous migration to convert RESTRICTIVE → PERMISSIVE policies **did not apply successfully**. All 6 `t2_*` tables still have `Permissive: No` on every policy. PostgreSQL requires at least one PERMISSIVE policy to grant access — RESTRICTIVE policies can only narrow existing access. With zero PERMISSIVE policies, **all operations are silently blocked**.

The console shows "INSERT OK" because Supabase JS returns the constructed row, but the database rejects it at the RLS layer and the data never persists.

## Fix

**Single database migration** that:
1. Drops ALL existing RLS policies on all 6 `t2_*` tables
2. Recreates them with identical logic but as **PERMISSIVE** (PostgreSQL default)

Tables affected:
- `t2_revendedoras` (4 policies)
- `t2_ciclos` (4 policies)
- `t2_apuracoes` (3 policies)
- `t2_pagamentos` (3 policies)
- `t2_adiantamentos` (3 policies)
- `t2_pedidos` (needs verification — will include if same issue)

No frontend changes needed — the code is correct.

