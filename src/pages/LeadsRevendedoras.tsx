import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { profilesLimited } from "@/lib/profilesLimited";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, Search, Filter, ChevronDown, Plus, UserPlus, FileSpreadsheet, RefreshCw, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { LeadsKanban } from "@/components/leads/LeadsKanban";
import { ImportLeadDialog } from "@/components/leads/ImportLeadDialog";
import { BulkImportLeadsDialog } from "@/components/leads/BulkImportLeadsDialog";
import { LeadRevendedora, KANBAN_COLUMNS } from "@/components/leads/types";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function LeadsRevendedoras() {
  const queryClient = useQueryClient();

  // Filtros
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [origemFiltro, setOrigemFiltro] = useState("todos");
  const [responsavelFiltro, setResponsavelFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Mutation para sincronizar leads do site externo
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "sync-leads-from-external"
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads-revendedoras"] });
      toast({
        title: "Sincronização concluída!",
        description: data.synced > 0 
          ? `${data.synced} novos leads importados do site.`
          : data.message || "Todos os leads já estão sincronizados.",
      });
    },
    onError: (error: Error) => {
      console.error("Erro na sincronização:", error);
      toast({
        title: "Erro na sincronização",
        description: error.message || "Não foi possível sincronizar os leads do site.",
        variant: "destructive",
      });
    },
  });

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

  // Query para buscar responsáveis (profiles)
  const { data: responsaveis = [] } = useQuery({
    queryKey: ["responsaveis-leads"],
    queryFn: async () => {
      const { data, error } = await profilesLimited()
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data;
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

  const leadsFiltrados = leads.filter((lead) => {
    if (statusFiltro !== "todos" && lead.status !== statusFiltro) return false;
    if (origemFiltro !== "todos" && lead.origem !== origemFiltro) return false;
    if (responsavelFiltro !== "todos") {
      if (responsavelFiltro === "sem_responsavel") {
        if (lead.responsavel_id !== null) return false;
      } else {
        if (lead.responsavel_id !== responsavelFiltro) return false;
      }
    }
    if (busca) {
      const termoBusca = busca.toLowerCase();
      if (!lead.nome?.toLowerCase().includes(termoBusca) &&
          !lead.whatsapp?.includes(busca) &&
          !lead.cidade?.toLowerCase().includes(termoBusca) &&
          !lead.instagram?.toLowerCase().includes(termoBusca) &&
          !lead.responsavel_nome?.toLowerCase().includes(termoBusca)) return false;
    }
    if (dataInicio || dataFim) {
      const dataCriacao = lead.created_at?.split('T')[0];
      if (!dataCriacao) return false;
      if (dataInicio && dataCriacao < dataInicio) return false;
      if (dataFim && dataCriacao > dataFim) return false;
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", syncMutation.isPending && "animate-spin")} />
              Sincronizar do Site
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Importar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Importar Contato
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBulkImportOpen(true)}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Importar em Massa (Excel)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Responsável */}
                <div>
                  <Label className="text-xs">Responsável</Label>
                  <Select value={responsavelFiltro} onValueChange={setResponsavelFiltro}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="sem_responsavel">Sem responsável</SelectItem>
                      {responsaveis.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Data Início */}
                <div>
                  <Label className="text-xs">Data Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "mt-1 w-full justify-start text-left font-normal",
                          !dataInicio && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataInicio
                          ? format(new Date(dataInicio + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                          : <span>Selecionar data</span>}
                        {dataInicio && (
                          <X
                            className="ml-auto h-4 w-4 opacity-60 hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); setDataInicio(''); }}
                          />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataInicio ? new Date(dataInicio + 'T12:00:00') : undefined}
                        onSelect={(d) => setDataInicio(d ? format(d, 'yyyy-MM-dd') : '')}
                        initialFocus
                        locale={ptBR}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Data Fim */}
                <div>
                  <Label className="text-xs">Data Fim</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "mt-1 w-full justify-start text-left font-normal",
                          !dataFim && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataFim
                          ? format(new Date(dataFim + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                          : <span>Selecionar data</span>}
                        {dataFim && (
                          <X
                            className="ml-auto h-4 w-4 opacity-60 hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); setDataFim(''); }}
                          />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataFim ? new Date(dataFim + 'T12:00:00') : undefined}
                        onSelect={(d) => setDataFim(d ? format(d, 'yyyy-MM-dd') : '')}
                        initialFocus
                        locale={ptBR}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
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

      {/* Dialog de Importação */}
      <ImportLeadDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
      />

      {/* Dialog de Importação em Massa */}
      <BulkImportLeadsDialog
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
      />
    </div>
  );
}
