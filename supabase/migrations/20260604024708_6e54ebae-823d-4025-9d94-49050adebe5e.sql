CREATE OR REPLACE FUNCTION public.handle_new_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY: Always default to 'representante'. Never trust raw_user_meta_data
  -- for role assignment as it is fully user-controlled at signup.
  -- Admins can elevate roles via the admin UI after account creation.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'representante'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$function$;