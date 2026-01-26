import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Users, Search, Filter, ChevronDown, LayoutGrid, List } from "lucide-react";
import { LeadsKanban } from "@/components/leads/LeadsKanban";
import { LeadRevendedora, KANBAN_COLUMNS } from "@/components/leads/types";

export default function LeadsRevendedoras() {
  const queryClient = useQueryClient();

  // Filtros
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [origemFiltro, setOrigemFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  // Query para buscar leads
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads-revendedoras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads_revendedoras")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LeadRevendedora[];
    },
  });

  // Realtime listener para novos leads
  useEffect(() => {
    const channel = supabase
      .channel("leads-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads_revendedoras",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["leads-revendedoras"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Filtrar leads
  const leadsFiltrados = leads.filter((lead) => {
    // Filtro de status
    if (statusFiltro !== "todos" && lead.status !== statusFiltro) return false;

    // Filtro de origem
    if (origemFiltro !== "todos" && lead.origem !== origemFiltro) return false;

    // Filtro de busca
    if (busca) {
      const termoBusca = busca.toLowerCase();
      const matchNome = lead.nome?.toLowerCase().includes(termoBusca);
      const matchWhatsapp = lead.whatsapp?.includes(busca);
      const matchCidade = lead.cidade?.toLowerCase().includes(termoBusca);
      const matchInstagram = lead.instagram?.toLowerCase().includes(termoBusca);
      const matchResponsavel = lead.responsavel_nome?.toLowerCase().includes(termoBusca);
      if (!matchNome && !matchWhatsapp && !matchCidade && !matchInstagram && !matchResponsavel)
        return false;
    }

    return true;
  });

  // Contadores
  const totalLeads = leads.length;
  const totalNovos = leads.filter((l) => l.status === "leads_novos").length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">CRM - Leads de Revendedoras</h1>
          </div>
        </div>

        {/* Contadores */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Total:</span>
            <Badge variant="secondary">{totalLeads}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Novos:</span>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
              {totalNovos}
            </Badge>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between md:w-auto">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </div>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                filtrosAbertos ? "rotate-180" : ""
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Status */}
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {KANBAN_COLUMNS.map((col) => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Origem */}
                <div>
                  <Label className="text-xs">Origem</Label>
                  <Select value={origemFiltro} onValueChange={setOrigemFiltro}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="site">Site</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Busca */}
                <div>
                  <Label className="text-xs">Busca</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Nome, WhatsApp, cidade..."
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Kanban */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Carregando...
        </div>
      ) : (
        <LeadsKanban leads={leadsFiltrados} />
      )}
    </div>
  );
}
