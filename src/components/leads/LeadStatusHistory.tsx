import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Clock } from "lucide-react";
import { LeadStatusHistorico, getColumnLabel } from "./types";

interface LeadStatusHistoryProps {
  leadId: string;
}

export function LeadStatusHistory({ leadId }: LeadStatusHistoryProps) {
  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["lead-status-historico", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads_status_historico")
        .select("*")
        .eq("lead_id", leadId)
        .order("criado_em", { ascending: false });

      if (error) throw error;
      return data as LeadStatusHistorico[];
    },
  });

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Carregando histórico...</div>
    );
  }

  if (historico.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Nenhuma alteração de status registrada.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {historico.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 text-sm border-l-2 border-muted pl-3"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {item.status_anterior ? (
                <>
                  <span className="text-muted-foreground">
                    {getColumnLabel(item.status_anterior)}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">
                    {getColumnLabel(item.status_novo)}
                  </span>
                </>
              ) : (
                <span className="font-medium">
                  Entrada: {getColumnLabel(item.status_novo)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3" />
              {format(parseISO(item.criado_em), "dd/MM/yyyy 'às' HH:mm", {
                locale: ptBR,
              })}
              {item.alterado_por_nome && (
                <span>• por {item.alterado_por_nome}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
