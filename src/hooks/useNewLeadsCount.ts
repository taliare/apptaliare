import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useNewLeadsCount() {
  const { data: count = 0 } = useQuery({
    queryKey: ["leads-novos-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("leads_revendedoras")
        .select("*", { count: "exact", head: true })
        .eq("status", "leads_novos");

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  return count;
}
