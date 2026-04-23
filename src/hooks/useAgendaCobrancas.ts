import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type Cobranca = Database['public']['Tables']['cobrancas_agendadas']['Row'];

// CRITICO: userId DEVE vir do AuthContext. useEffect separado causa race condition.
// Buscar via supabase.auth.getUser() em useEffect causa um intervalo onde userId é null,
// disparando a query com filtro vazio e zerando a agenda dos representantes na tela.

const PAGE_SIZE = 1000;

/**
 * Hook centralizado para buscar a agenda de cobranças do representante autenticado.
 * Aplica os filtros padrão (vigente=true, status pendente/parcial) e ordena por data.
 * Usa paginação para contornar o limite default de 1000 linhas do Supabase.
 */
export function useAgendaCobrancas() {
  const { user, profile } = useAuth();
  // CRITICO: userId DEVE vir do AuthContext. useEffect separado causa race condition.
  const userId = user?.id ?? profile?.id ?? null;

  const { data: cobrancas = [], isLoading } = useQuery<Cobranca[]>({
    queryKey: ['cobrancas-agendadas', userId],
    queryFn: async () => {
      if (!userId) return [];

      const all: Cobranca[] = [];
      let from = 0;

      // Paginação: continua buscando enquanto a página voltar cheia
      while (true) {
        const { data, error } = await supabase
          .from('cobrancas_agendadas')
          .select('*')
          .eq('representante_id', userId)
          .eq('vigente', true)
          .in('status', ['pendente', 'parcial'])
          .order('data_agendada', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        all.push(...data);

        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      return all;
    },
    enabled: !!userId,
  });

  return { cobrancas, isLoading, userId };
}
