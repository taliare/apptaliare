import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import {
  Users,
  Search,
  Filter,
  ChevronDown,
  Phone,
  MapPin,
  Instagram,
  Clock,
  DollarSign,
  MessageSquare,
  ExternalLink,
  Calendar,
} from "lucide-react";

interface LeadRevendedora {
  id: string;
  created_at: string;
  nome: string;
  whatsapp: string;
  cidade: string | null;
  instagram: string | null;
  experiencia_vendas: string | null;
  tempo_disponivel: string | null;
  capital_inicial: string | null;
  motivacao: string | null;
  origem: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  status: string;
  observacao: string | null;
}

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "novo", label: "Novo" },
  { value: "em_contato", label: "Em contato" },
  { value: "aprovada", label: "Aprovada" },
  { value: "reprovada", label: "Reprovada" },
];

const STATUS_COLORS: Record<string, string> = {
  novo: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  em_contato: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  aprovada: "bg-green-500/20 text-green-400 border-green-500/30",
  reprovada: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function LeadsRevendedoras() {
  const queryClient = useQueryClient();
  const hoje = new Date();
  
  // Filtros
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(hoje), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(endOfMonth(hoje), "yyyy-MM-dd"));
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [origemFiltro, setOrigemFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  
  // Detalhes
  const [leadSelecionado, setLeadSelecionado] = useState<LeadRevendedora | null>(null);
  const [observacaoEdit, setObservacaoEdit] = useState("");

  // Query para buscar leads
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads-revendedoras", dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads_revendedoras")
        .select("*")
        .gte("created_at", `${dataInicio}T00:00:00`)
        .lte("created_at", `${dataFim}T23:59:59`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LeadRevendedora[];
    },
  });

  // Realtime listener para novos leads
  useEffect(() => {
    const channel = supabase
      .channel('leads-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads_revendedoras'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["leads-revendedoras"] });
          toast({ title: "Novo lead recebido!", description: "A lista foi atualizada automaticamente." });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Mutation para atualizar lead
  const updateLead = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<LeadRevendedora> }) => {
      const { error } = await supabase
        .from("leads_revendedoras")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-revendedoras"] });
      toast({ title: "Lead atualizado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar lead", description: error.message, variant: "destructive" });
    },
  });

  // Filtrar leads
  const leadsFiltrados = useMemo(() => {
    return leads.filter((lead) => {
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
        if (!matchNome && !matchWhatsapp && !matchCidade && !matchInstagram) return false;
      }
      
      return true;
    });
  }, [leads, statusFiltro, origemFiltro, busca]);

  // Contadores
  const totalNoPeriodo = leads.length;
  const totalNovos = leads.filter((l) => l.status === "novo").length;

  // Funções de ação
  const handleMarcarStatus = (novoStatus: string) => {
    if (!leadSelecionado) return;
    updateLead.mutate({ id: leadSelecionado.id, updates: { status: novoStatus } });
    setLeadSelecionado({ ...leadSelecionado, status: novoStatus });
  };

  const handleSalvarObservacao = () => {
    if (!leadSelecionado) return;
    updateLead.mutate({ id: leadSelecionado.id, updates: { observacao: observacaoEdit } });
    setLeadSelecionado({ ...leadSelecionado, observacao: observacaoEdit });
  };

  const abrirDetalhes = (lead: LeadRevendedora) => {
    setLeadSelecionado(lead);
    setObservacaoEdit(lead.observacao || "");
  };

  const formatarWhatsapp = (whatsapp: string) => {
    return whatsapp.replace(/\D/g, "");
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Leads de Revendedoras</h1>
        </div>
        
        {/* Contadores */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Total no período:</span>
            <Badge variant="secondary">{totalNoPeriodo}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Novos:</span>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">{totalNovos}</Badge>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${filtrosAbertos ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {/* Período */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Data Inicial</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Data Final</Label>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Status e Origem */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
              </div>

              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, WhatsApp, cidade ou Instagram..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Lista de Leads */}
      <div className="space-y-3">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Carregando...
            </CardContent>
          </Card>
        ) : leadsFiltrados.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhum lead encontrado
            </CardContent>
          </Card>
        ) : (
          leadsFiltrados.map((lead) => (
            <Card
              key={lead.id}
              className="cursor-pointer hover:bg-accent/5 transition-colors"
              onClick={() => abrirDetalhes(lead)}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{lead.nome}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <a
                        href={`https://wa.me/${formatarWhatsapp(lead.whatsapp)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-green-500 hover:underline"
                      >
                        <Phone className="h-3 w-3" />
                        {lead.whatsapp}
                      </a>
                      {lead.cidade && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {lead.cidade}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(parseISO(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge className={STATUS_COLORS[lead.status] || "bg-muted"}>
                    {STATUS_OPTIONS.find((s) => s.value === lead.status)?.label || lead.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Sheet de Detalhes */}
      <Sheet open={!!leadSelecionado} onOpenChange={(open) => !open && setLeadSelecionado(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {leadSelecionado && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {leadSelecionado.nome}
                  <Badge className={STATUS_COLORS[leadSelecionado.status] || "bg-muted"}>
                    {STATUS_OPTIONS.find((s) => s.value === leadSelecionado.status)?.label || leadSelecionado.status}
                  </Badge>
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                {/* Contato */}
                <div className="space-y-2">
                  <a
                    href={`https://wa.me/${formatarWhatsapp(leadSelecionado.whatsapp)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-green-500 hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    {leadSelecionado.whatsapp}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  
                  {leadSelecionado.instagram && (
                    <a
                      href={`https://instagram.com/${leadSelecionado.instagram.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-pink-500 hover:underline"
                    >
                      <Instagram className="h-4 w-4" />
                      {leadSelecionado.instagram}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  
                  {leadSelecionado.cidade && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {leadSelecionado.cidade}
                    </p>
                  )}
                  
                  <p className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Calendar className="h-4 w-4" />
                    {format(parseISO(leadSelecionado.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>

                {/* Informações */}
                <div className="space-y-3 pt-4 border-t">
                  {leadSelecionado.experiencia_vendas && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Experiência em vendas</Label>
                      <p className="text-sm">{leadSelecionado.experiencia_vendas}</p>
                    </div>
                  )}
                  {leadSelecionado.tempo_disponivel && (
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <Label className="text-xs text-muted-foreground">Tempo disponível</Label>
                        <p className="text-sm">{leadSelecionado.tempo_disponivel}</p>
                      </div>
                    </div>
                  )}
                  {leadSelecionado.capital_inicial && (
                    <div className="flex items-start gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <Label className="text-xs text-muted-foreground">Capital inicial</Label>
                        <p className="text-sm">{leadSelecionado.capital_inicial}</p>
                      </div>
                    </div>
                  )}
                  {leadSelecionado.motivacao && (
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <Label className="text-xs text-muted-foreground">Motivação</Label>
                        <p className="text-sm">{leadSelecionado.motivacao}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* UTMs */}
                {(leadSelecionado.utm_source || leadSelecionado.utm_medium || leadSelecionado.utm_campaign) && (
                  <div className="pt-4 border-t">
                    <Label className="text-xs text-muted-foreground">UTM</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {leadSelecionado.utm_source && (
                        <Badge variant="outline" className="text-xs">source: {leadSelecionado.utm_source}</Badge>
                      )}
                      {leadSelecionado.utm_medium && (
                        <Badge variant="outline" className="text-xs">medium: {leadSelecionado.utm_medium}</Badge>
                      )}
                      {leadSelecionado.utm_campaign && (
                        <Badge variant="outline" className="text-xs">campaign: {leadSelecionado.utm_campaign}</Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Observação */}
                <div className="pt-4 border-t">
                  <Label className="text-xs text-muted-foreground">Observação</Label>
                  <Textarea
                    value={observacaoEdit}
                    onChange={(e) => setObservacaoEdit(e.target.value)}
                    className="mt-1"
                    rows={3}
                    placeholder="Adicione uma observação..."
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={handleSalvarObservacao}
                    disabled={updateLead.isPending}
                  >
                    Salvar Observação
                  </Button>
                </div>

                {/* Ações de Status */}
                <div className="pt-4 border-t space-y-2">
                  <Label className="text-xs text-muted-foreground">Alterar Status</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/10"
                      onClick={() => handleMarcarStatus("em_contato")}
                      disabled={updateLead.isPending || leadSelecionado.status === "em_contato"}
                    >
                      Em contato
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-500 border-green-500/30 hover:bg-green-500/10"
                      onClick={() => handleMarcarStatus("aprovada")}
                      disabled={updateLead.isPending || leadSelecionado.status === "aprovada"}
                    >
                      Aprovar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                      onClick={() => handleMarcarStatus("reprovada")}
                      disabled={updateLead.isPending || leadSelecionado.status === "reprovada"}
                    >
                      Reprovar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-blue-500 border-blue-500/30 hover:bg-blue-500/10"
                      onClick={() => handleMarcarStatus("novo")}
                      disabled={updateLead.isPending || leadSelecionado.status === "novo"}
                    >
                      Marcar como Novo
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
