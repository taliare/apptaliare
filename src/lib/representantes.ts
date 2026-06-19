import { supabase } from "@/integrations/supabase/client";
import { profilesLimited } from "@/lib/profilesLimited";

/**
 * Lista todos os usuários com papel 'representante' em user_roles.
 * Inclui inativos (há dados históricos atrelados a eles).
 * Retorna { id, nome } ordenado por nome.
 */
export async function fetchRepresentanteIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "representante");
  if (error) throw error;
  return (data || []).map((r) => r.user_id);
}

export async function fetchRepresentantes(): Promise<Array<{ id: string; nome: string }>> {
  const ids = await fetchRepresentanteIds();
  if (ids.length === 0) return [];
  const { data, error } = await profilesLimited()
    .select("id, nome")
    .in("id", ids)
    .order("nome");
  if (error) throw error;
  return (data || []) as Array<{ id: string; nome: string }>;
}

/**
 * Versão admin (acessa profiles direto, com email/whatsapp).
 */
export async function fetchRepresentantesAdmin(): Promise<
  Array<{ id: string; nome: string; email: string | null; ativo: boolean }>
> {
  const ids = await fetchRepresentanteIds();
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, email, ativo")
    .in("id", ids)
    .order("nome");
  if (error) throw error;
  return (data || []) as Array<{ id: string; nome: string; email: string | null; ativo: boolean }>;
}
