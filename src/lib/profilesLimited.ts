import { supabase } from "@/integrations/supabase/client";

/**
 * Query the profiles_limited view which excludes sensitive fields (email, whatsapp).
 * Use for non-admin queries that only need basic profile info (id, nome, ativo, avatar_url).
 * Admin pages needing email/whatsapp should use supabase.from('profiles') directly.
 */
export function profilesLimited() {
  // profiles_limited view is not in auto-generated types yet; bypass type checking
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('profiles_limited');
}
