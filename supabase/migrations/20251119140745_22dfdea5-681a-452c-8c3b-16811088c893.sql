-- Create RPC function to update user password (admin only)
CREATE OR REPLACE FUNCTION public.admin_update_user_password(
  target_user_id uuid,
  new_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Check if the caller is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can update user passwords';
  END IF;

  -- Update the user's password using Supabase Auth admin API
  -- Note: This uses the auth schema which requires service role
  result := extensions.http((
    'POST',
    current_setting('app.settings.api_url') || '/auth/v1/admin/users/' || target_user_id,
    ARRAY[
      extensions.http_header('apikey', current_setting('app.settings.service_role_key')),
      extensions.http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
      extensions.http_header('Content-Type', 'application/json')
    ],
    'application/json',
    json_build_object('password', new_password)::text
  )::extensions.http_request);

  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users (function checks admin role internally)
GRANT EXECUTE ON FUNCTION public.admin_update_user_password(uuid, text) TO authenticated;