ALTER TABLE public.revendedoras 
ADD COLUMN IF NOT EXISTS perfil_garantia_id UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_revendedoras_perfil_garantia 
ON public.revendedoras(perfil_garantia_id);

COMMENT ON COLUMN public.revendedoras.perfil_garantia_id IS 
'ID do perfil no banco externo de garantias (profiles.id do Supabase externo)';