

# Fix: t2_apuracoes RLS Insert Failure

## Root Cause

All RLS policies on `t2_apuracoes` are set as **RESTRICTIVE**. In PostgreSQL, RESTRICTIVE policies can only narrow access already granted by a PERMISSIVE policy. Since there are **no PERMISSIVE policies**, no inserts can succeed — even for admins or representantes.

Current policies (all RESTRICTIVE, all broken):
- `Admin full access t2_apuracoes` (ALL) — RESTRICTIVE
- `Representante pode criar t2_apuracoes` (INSERT) — RESTRICTIVE  
- `Representante pode ver suas t2_apuracoes` (SELECT) — RESTRICTIVE

## Fix

Drop all existing policies and recreate them as **PERMISSIVE** (the PostgreSQL default). The logic stays the same — only the policy type changes.

### SQL Migration
1. Drop the 3 existing RESTRICTIVE policies
2. Recreate them as PERMISSIVE:
   - Admin ALL: `has_role(auth.uid(), 'admin')`
   - Representante INSERT: `apurado_por = auth.uid()`
   - Representante SELECT: `apurado_por = auth.uid()`

### No frontend changes needed
The insert logic in `ApuracaoDialog.tsx` is correct — `apurado_por: user!.id` matches the policy check.

