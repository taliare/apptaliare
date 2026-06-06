CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pin_apuracao TEXT DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.definir_pin_apuracao(p_pin TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_pin IS NULL OR length(p_pin) <> 6 OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'PIN deve conter exatamente 6 dígitos numéricos';
  END IF;
  UPDATE public.profiles
  SET pin_apuracao = crypt(p_pin, gen_salt('bf'))
  WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.verificar_pin_apuracao(p_pin TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT pin_apuracao INTO v_hash
  FROM public.profiles
  WHERE id = auth.uid();
  IF v_hash IS NULL THEN
    RETURN false;
  END IF;
  RETURN crypt(p_pin, v_hash) = v_hash;
END;
$$;

REVOKE ALL ON FUNCTION public.definir_pin_apuracao(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verificar_pin_apuracao(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.definir_pin_apuracao(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_pin_apuracao(TEXT) TO authenticated;