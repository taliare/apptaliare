

# Fix: Missing `data_cobranca` Column in `t2_ciclos`

## Root Cause

The last migration file (`20260310005250`) only contains the `t2_apuracoes` duplicate cleanup and UNIQUE constraint. The `ALTER TABLE t2_ciclos ADD COLUMN data_cobranca DATE` statement was **not included** in the migration. The frontend code references this column, causing the `PGRST204` error on insert.

## Fix

**New database migration** that:
1. Adds `data_cobranca DATE` column to `t2_ciclos`
2. Backfills existing rows: `data_cobranca = (data_inicio + INTERVAL '45 days')::date`

No frontend changes needed — the code already handles `data_cobranca` correctly.

