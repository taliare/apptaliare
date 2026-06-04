import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { profilesLimited } from '@/lib/profilesLimited';

export interface RevendedoraAuditEntry {
  id: string;
  revendedora_id: string;
  user_id: string | null;
  acao: 'criou' | 'editou';
  campos_alterados: Record<string, { antes: unknown; depois: unknown }>;
  criado_em: string;
  user_nome?: string | null;
}

export function useRevendedoraHistorico(revendedoraId?: string | null) {
  return useQuery({
    queryKey: ['revendedora-historico', revendedoraId],
    enabled: !!revendedoraId,
    queryFn: async (): Promise<RevendedoraAuditEntry[]> => {
      const { data, error } = await supabase
        .from('revendedoras_audit' as any)
        .select('*')
        .eq('revendedora_id', revendedoraId!)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      const nomes = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profs } = await profilesLimited().select('id, nome').in('id', userIds);
        (profs ?? []).forEach((p: any) => nomes.set(p.id, p.nome));
      }
      return rows.map((r) => ({ ...r, user_nome: r.user_id ? nomes.get(r.user_id) ?? null : null }));
    },
  });
}
