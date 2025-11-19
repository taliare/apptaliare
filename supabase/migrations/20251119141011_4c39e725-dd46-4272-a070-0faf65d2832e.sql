-- Remove the unused RPC function for password update
DROP FUNCTION IF EXISTS public.admin_update_user_password(uuid, text);