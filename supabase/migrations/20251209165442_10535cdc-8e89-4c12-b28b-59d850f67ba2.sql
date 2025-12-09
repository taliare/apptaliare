-- Atualizar constraint para permitir status 'com_revendedora'
ALTER TABLE public.kits_estoque DROP CONSTRAINT kits_estoque_status_check;
ALTER TABLE public.kits_estoque ADD CONSTRAINT kits_estoque_status_check 
  CHECK (status = ANY (ARRAY['estoque'::text, 'com_representante'::text, 'com_revendedora'::text]));