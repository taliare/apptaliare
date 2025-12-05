-- Adicionar campo valor ao kits_estoque e producao_diaria
ALTER TABLE public.kits_estoque ADD COLUMN IF NOT EXISTS valor numeric DEFAULT 0;
ALTER TABLE public.producao_diaria ADD COLUMN IF NOT EXISTS valor numeric DEFAULT 0;