-- Corrigir função para ter search_path seguro
DROP FUNCTION IF EXISTS public.update_repasses_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.update_repasses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

-- Recriar trigger
CREATE TRIGGER update_repasses_updated_at
BEFORE UPDATE ON public.repasses
FOR EACH ROW
EXECUTE FUNCTION public.update_repasses_updated_at();