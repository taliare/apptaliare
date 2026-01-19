import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  Info,
  Package,
  Users,
  DollarSign,
  Target,
  Clock,
  ArrowUpDown,
  ChevronDown,
} from "lucide-react";
import { formatarValor, getLocalDateString } from "@/lib/utils";
import { format, subDays, startOfMonth, endOfMonth, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type PeriodFilter = "hoje" | "mes" | "ciclo" | "custom";
type SortField = "totalCobrado" | "percentualMeta" | "ticketMedio" | "eficiencia";
type SortDirection = "asc" | "desc";

interface Alerta {
  tipo: "info" | "warning" | "error";
  titulo: string;
  descricao: string;
}

export default function RelatorioKpis() {
  const hoje = new Date();
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("mes");
  const [customStart, setCustomStart] = useState(getLocalDateString(startOfMonth(hoje)));
  const [customEnd, setCustomEnd] = useState(getLocalDateString(endOfMonth(hoje)));
  const [sortField, setSortField] = useState<SortField>("totalCobrado");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Calculate date range based on filter
  const { startDate, endDate } = useMemo(() => {
    switch (periodFilter) {
      case "hoje":
        return {
          startDate: getLocalDateString(hoje),
          endDate: getLocalDateString(hoje),
        };
      case "mes":
        return {
          startDate: getLocalDateString(startOfMonth(hoje)),
          endDate: getLocalDateString(endOfMonth(hoje)),
        };
      case "ciclo":
        return {
          startDate: getLocalDateString(subDays(hoje, 60)),
          endDate: getLocalDateString(hoje),
        };
      case "custom":
        return { startDate: customStart, endDate: customEnd };
      default:
        return {
          startDate: getLocalDateString(startOfMonth(hoje)),
          endDate: getLocalDateString(endOfMonth(hoje)),
        };
    }
  }, [periodFilter, customStart, customEnd]);

  // Fetch representatives (need to join user_roles)
  const { data: representantes = [] } = useQuery({
    queryKey: ["representantes-kpis"],
    queryFn: async () => {
      // First get user_roles that are representantes
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "representante");
      if (rolesError) throw rolesError;
      
      const repIds = roles?.map(r => r.user_id) || [];
      if (repIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, ativo")
        .eq("ativo", true)
        .in("id", repIds);
      if (error) throw error;
      return data || [];
    },
  });

  // BLOCO 1 - Total Cobrado no período
  const { data: cobrancasDiarias = [], isLoading: loadingCobrancas } = useQuery({
    queryKey: ["kpis-cobrancas-diarias", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas_diarias")
        .select("*")
        .gte("data", startDate)
        .lte("data", endDate);
      if (error) throw error;
      return data || [];
    },
  });

  // Prestações de contas for ticket calculation
  const { data: prestacoes = [] } = useQuery({
    queryKey: ["kpis-prestacoes", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select("*")
        .gte("criado_em", startDate)
        .lte("criado_em", endDate);
      if (error) throw error;
      return data || [];
    },
  });

  // BLOCO 1 - Repasses ativos
  const { data: repassesAtivos = [], isLoading: loadingRepasses } = useQuery({
    queryKey: ["kpis-repasses-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repasses")
        .select("*")
        .eq("status", "agendado");
      if (error) throw error;
      return data || [];
    },
  });

  // BLOCO 1 - Valor vencido
  const { data: cobrancasVencidas = [], isLoading: loadingVencidas } = useQuery({
    queryKey: ["kpis-vencidas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas_agendadas")
        .select("*")
        .eq("status", "pendente")
        .lt("data_agendada", getLocalDateString(hoje));
      if (error) throw error;
      return data || [];
    },
  });

  // BLOCO 2 - Cobranças pendentes para previsão
  const { data: cobrancasPendentes = [] } = useQuery({
    queryKey: ["kpis-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas_agendadas")
        .select("*")
        .eq("status", "pendente")
        .gte("data_agendada", getLocalDateString(hoje));
      if (error) throw error;
      return data || [];
    },
  });

  // BLOCO 3 - Metas
  const { data: metas = [] } = useQuery({
    queryKey: ["kpis-metas", startDate],
    queryFn: async () => {
      const mesAno = startDate.substring(0, 7);
      const { data, error } = await supabase
        .from("metas_cobranca")
        .select("*")
        .eq("ano_mes", mesAno);
      if (error) throw error;
      return data || [];
    },
  });

  // BLOCO 4 - Kits entregues no período
  const { data: kitsEntregues = [], isLoading: loadingKitsEntregues } = useQuery({
    queryKey: ["kpis-kits-entregues", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kits_entregues")
        .select("*")
        .gte("data_entrega", startDate)
        .lte("data_entrega", endDate);
      if (error) throw error;
      return data || [];
    },
  });

  // BLOCO 4 - Kits em posse dos representantes
  const { data: kitsEmPosse = [], isLoading: loadingKitsPosse } = useQuery({
    queryKey: ["kpis-kits-posse"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kits_estoque")
        .select("*")
        .eq("status", "com_representante");
      if (error) throw error;
      return data || [];
    },
  });

  // BLOCO 5 - Revendedoras ativas (com cobranças pendentes)
  const { data: revendedorasAtivas = [] } = useQuery({
    queryKey: ["kpis-revendedoras-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas_agendadas")
        .select("revendedora")
        .in("status", ["pendente", "parcial"])
        .not("revendedora", "is", null);
      if (error) throw error;
      const unique = new Set(data?.map((c) => c.revendedora) || []);
      return Array.from(unique);
    },
  });

  // Revendedoras inativas
  const { data: revendedorasInativas = [] } = useQuery({
    queryKey: ["kpis-revendedoras-inativas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_revendedoras_inativas_count" as never);
      if (error) {
        // Fallback - count from prestacoes without active cobrancas
        const { data: prestData } = await supabase
          .from("prestacoes_contas")
          .select("revendedora")
          .not("revendedora", "is", null);
        const { data: activeData } = await supabase
          .from("cobrancas_agendadas")
          .select("revendedora")
          .in("status", ["pendente", "parcial"]);
        
        const allRevendedoras = new Set(prestData?.map((p) => p.revendedora) || []);
        const activeRevendedoras = new Set(activeData?.map((c) => c.revendedora) || []);
        const inactive = Array.from(allRevendedoras).filter(
          (r) => !activeRevendedoras.has(r)
        );
        return inactive;
      }
      return data || [];
    },
  });

  // Calculate metrics
  const totalCobrado = cobrancasDiarias.reduce(
    (sum, c) => sum + (c.total_cobrado || 0),
    0
  );
  const qtdNotas = prestacoes.length;
  const ticketMedio = qtdNotas > 0 ? totalCobrado / qtdNotas : 0;
  const valorRepasseAtivo = repassesAtivos.reduce(
    (sum, r) => sum + (r.valor_repasse || 0),
    0
  );
  const valorVencido = cobrancasVencidas.reduce(
    (sum, c) => sum + (c.valor_previsto || 0),
    0
  );
  const qtdNotasVencidas = cobrancasVencidas.length;
  const qtdRepassesAtivos = repassesAtivos.length;

  // BLOCO 2 - Previsão
  const previsao7dias = cobrancasPendentes
    .filter((c) => {
      const dataVenc = new Date(c.data_agendada);
      return dataVenc <= addDays(hoje, 7);
    })
    .reduce((sum, c) => sum + (c.valor_previsto || 0), 0);

  const previsao15dias = cobrancasPendentes
    .filter((c) => {
      const dataVenc = new Date(c.data_agendada);
      return dataVenc <= addDays(hoje, 15);
    })
    .reduce((sum, c) => sum + (c.valor_previsto || 0), 0);

  const previsao30dias = cobrancasPendentes
    .filter((c) => {
      const dataVenc = new Date(c.data_agendada);
      return dataVenc <= addDays(hoje, 30);
    })
    .reduce((sum, c) => sum + (c.valor_previsto || 0), 0);

  // Taxa de inadimplência
  const valorTotalAReceber = valorVencido + cobrancasPendentes.reduce(
    (sum, c) => sum + (c.valor_previsto || 0),
    0
  );
  const taxaInadimplencia =
    valorTotalAReceber > 0 ? (valorVencido / valorTotalAReceber) * 100 : 0;

  // BLOCO 3 - Performance representantes
  const representantesPerformance = useMemo(() => {
    return representantes.map((rep) => {
      const cobrancasRep = cobrancasDiarias.filter(
        (c) => c.representante_id === rep.id
      );
      const totalCobradoRep = cobrancasRep.reduce(
        (sum, c) => sum + (c.total_cobrado || 0),
        0
      );
      const totalDespesas = cobrancasRep.reduce(
        (sum, c) => sum + (c.despesa_cobranca || 0),
        0
      );
      const meta = metas.find((m) => m.representante_id === rep.id);
      const metaValor = meta?.meta_valor || 0;
      const percentualMeta = metaValor > 0 ? (totalCobradoRep / metaValor) * 100 : 0;
      const prestacoesRep = prestacoes.filter((p) => p.representante_id === rep.id);
      const ticketMedioRep =
        prestacoesRep.length > 0 ? totalCobradoRep / prestacoesRep.length : 0;
      const eficiencia = totalDespesas > 0 ? totalCobradoRep / totalDespesas : 0;

      return {
        id: rep.id,
        nome: rep.nome,
        totalCobrado: totalCobradoRep,
        metaValor,
        percentualMeta,
        ticketMedio: ticketMedioRep,
        totalDespesas,
        eficiencia,
      };
    });
  }, [representantes, cobrancasDiarias, metas, prestacoes]);

  // Sort representatives
  const sortedRepresentantes = useMemo(() => {
    return [...representantesPerformance].sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;
      return (a[sortField] - b[sortField]) * multiplier;
    });
  }, [representantesPerformance, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // BLOCO 4 - Kits
  const kitsEntreguesQtd = kitsEntregues.length;
  const kitsEmPosseQtd = kitsEmPosse.length;
  const giroKits = kitsEmPosseQtd > 0 ? kitsEntreguesQtd / kitsEmPosseQtd : 0;

  // BLOCO 5 - Revendedoras
  const totalRevendedorasAtivas = revendedorasAtivas.length;
  const totalRevendedorasInativas = revendedorasInativas.length;
  const taxaRetencao =
    totalRevendedorasAtivas + totalRevendedorasInativas > 0
      ? (totalRevendedorasAtivas /
          (totalRevendedorasAtivas + totalRevendedorasInativas)) *
        100
      : 0;

  // BLOCO 6 - Alertas
  const alertas: Alerta[] = useMemo(() => {
    const list: Alerta[] = [];

    // Alerta: Representantes com alto repasse
    // Need to get representante_id from cobranca_id relationship
    representantesPerformance.forEach((rep) => {
      // For now, calculate based on cobrancas_diarias repasse data
      const cobrancasRep = cobrancasDiarias.filter(
        (c) => c.representante_id === rep.id
      );
      // Estimate repasse from total - this is simplified
      const totalRepasse = cobrancasRep.reduce(
        (sum, c) => sum + Math.max(0, (c.total_cobrado || 0) * 0.1),
        0
      );
      if (totalRepasse > 500) {
        list.push({
          tipo: "warning",
          titulo: `${rep.nome} com repasse alto`,
          descricao: formatarValor(totalRepasse) + " em repasses ativos",
        });
      }
    });

    // Alerta: Alto volume de notas vencidas
    if (qtdNotasVencidas > 10) {
      list.push({
        tipo: "error",
        titulo: "Alto volume de inadimplência",
        descricao: `${qtdNotasVencidas} notas vencidas (${formatarValor(valorVencido)})`,
      });
    } else if (qtdNotasVencidas > 5) {
      list.push({
        tipo: "warning",
        titulo: "Notas vencidas acumulando",
        descricao: `${qtdNotasVencidas} notas vencidas`,
      });
    }

    // Alerta: Giro de kits baixo
    if (giroKits < 0.3 && kitsEmPosseQtd > 5) {
      list.push({
        tipo: "warning",
        titulo: "Giro de kits abaixo do esperado",
        descricao: `Giro atual: ${(giroKits * 100).toFixed(0)}%`,
      });
    }

    // Alerta: Taxa de inadimplência alta
    if (taxaInadimplencia > 20) {
      list.push({
        tipo: "error",
        titulo: "Taxa de inadimplência crítica",
        descricao: `${taxaInadimplencia.toFixed(1)}% do valor a receber está vencido`,
      });
    }

    return list;
  }, [
    representantesPerformance,
    repassesAtivos,
    qtdNotasVencidas,
    valorVencido,
    giroKits,
    kitsEmPosseQtd,
    taxaInadimplencia,
  ]);

  const getPeriodLabel = () => {
    switch (periodFilter) {
      case "hoje":
        return "Hoje";
      case "mes":
        return format(hoje, "MMMM/yyyy", { locale: ptBR });
      case "ciclo":
        return "Últimos 60 dias";
      case "custom":
        return `${format(new Date(customStart), "dd/MM")} - ${format(new Date(customEnd), "dd/MM")}`;
    }
  };

  const isLoading = loadingCobrancas || loadingRepasses || loadingVencidas;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            Relatório de KPIs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão executiva do negócio
          </p>
        </div>

        {/* Period Filter */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={periodFilter === "hoje" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodFilter("hoje")}
          >
            Hoje
          </Button>
          <Button
            variant={periodFilter === "mes" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodFilter("mes")}
          >
            Mês Atual
          </Button>
          <Button
            variant={periodFilter === "ciclo" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodFilter("ciclo")}
          >
            Ciclo (60d)
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={periodFilter === "custom" ? "default" : "outline"}
                size="sm"
                className="gap-1"
              >
                <Calendar className="h-4 w-4" />
                Personalizado
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="end">
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Início</label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => {
                      setCustomStart(e.target.value);
                      setPeriodFilter("custom");
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Fim</label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => {
                      setCustomEnd(e.target.value);
                      setPeriodFilter("custom");
                    }}
                    className="mt-1"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Period Badge */}
      <Badge variant="outline" className="text-xs">
        Período: {getPeriodLabel()}
      </Badge>

      {/* BLOCO 1 - VISÃO GERAL */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs">Total Cobrado</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-lg sm:text-2xl font-bold text-foreground">
                {formatarValor(totalCobrado)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Ticket Médio</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-lg sm:text-2xl font-bold text-foreground">
                {formatarValor(ticketMedio)}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              {qtdNotas} notas
            </p>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-600 mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Repasse Ativo</span>
            </div>
            {loadingRepasses ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-lg sm:text-2xl font-bold text-yellow-600">
                {formatarValor(valorRepasseAtivo)}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              {qtdRepassesAtivos} repasses
            </p>
          </CardContent>
        </Card>

        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive mb-2">
              <TrendingDown className="h-4 w-4" />
              <span className="text-xs">Valor Vencido</span>
            </div>
            {loadingVencidas ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-lg sm:text-2xl font-bold text-destructive">
                {formatarValor(valorVencido)}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              {qtdNotasVencidas} notas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* BLOCO 2 - COBRANÇA & PREVISIBILIDADE */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Previsão de Recebimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Próximos 7 dias</span>
              <span className="font-semibold">{formatarValor(previsao7dias)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Próximos 15 dias</span>
              <span className="font-semibold">{formatarValor(previsao15dias)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Próximos 30 dias</span>
              <span className="font-semibold">{formatarValor(previsao30dias)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Indicadores de Risco
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Taxa de Inadimplência</span>
              <Badge
                variant={taxaInadimplencia > 20 ? "destructive" : taxaInadimplencia > 10 ? "secondary" : "outline"}
              >
                {taxaInadimplencia.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Notas Vencidas</span>
              <span className="font-semibold text-destructive">{qtdNotasVencidas}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Repasses Ativos</span>
              <span className="font-semibold text-yellow-600">{qtdRepassesAtivos}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BLOCO 3 - REPRESENTANTES */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Performance dos Representantes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Representante</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("totalCobrado")}
                >
                  <div className="flex items-center gap-1">
                    Total Cobrado
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("percentualMeta")}
                >
                  <div className="flex items-center gap-1">
                    % Meta
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 hidden sm:table-cell"
                  onClick={() => handleSort("ticketMedio")}
                >
                  <div className="flex items-center gap-1">
                    Ticket Médio
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="hidden md:table-cell">Despesas</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 hidden lg:table-cell"
                  onClick={() => handleSort("eficiencia")}
                >
                  <div className="flex items-center gap-1">
                    Eficiência
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRepresentantes.map((rep) => (
                <TableRow key={rep.id}>
                  <TableCell className="font-medium text-xs sm:text-sm">
                    {rep.nome}
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm">
                    {formatarValor(rep.totalCobrado)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        rep.percentualMeta >= 100
                          ? "default"
                          : rep.percentualMeta >= 70
                          ? "secondary"
                          : "outline"
                      }
                      className={
                        rep.percentualMeta >= 100
                          ? "bg-green-600"
                          : ""
                      }
                    >
                      {rep.percentualMeta.toFixed(0)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs sm:text-sm">
                    {formatarValor(rep.ticketMedio)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs sm:text-sm">
                    {formatarValor(rep.totalDespesas)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span
                      className={
                        rep.eficiencia > 10
                          ? "text-green-600"
                          : rep.eficiencia > 5
                          ? "text-yellow-600"
                          : "text-muted-foreground"
                      }
                    >
                      {rep.eficiencia.toFixed(1)}x
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {sortedRepresentantes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum dado no período
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* BLOCO 4 - KITS */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Package className="h-4 w-4" />
          Kits (Giro e Risco)
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Entregues</p>
              {loadingKitsEntregues ? (
                <Skeleton className="h-8 w-12 mx-auto" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {kitsEntreguesQtd}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">no período</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Em Posse</p>
              {loadingKitsPosse ? (
                <Skeleton className="h-8 w-12 mx-auto" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {kitsEmPosseQtd}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">com representantes</p>
            </CardContent>
          </Card>

          <Card className={giroKits < 0.3 ? "border-yellow-500/30" : ""}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Giro</p>
              <p
                className={`text-2xl font-bold ${
                  giroKits < 0.3 ? "text-yellow-600" : "text-foreground"
                }`}
              >
                {(giroKits * 100).toFixed(0)}%
              </p>
              <p className="text-[10px] text-muted-foreground">rotatividade</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* BLOCO 5 - REVENDEDORAS */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Target className="h-4 w-4" />
          Revendedoras
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Ativas</p>
              <p className="text-2xl font-bold text-green-600">
                {totalRevendedorasAtivas}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Inativas</p>
              <p className="text-2xl font-bold text-muted-foreground">
                {totalRevendedorasInativas}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Retenção</p>
              <p
                className={`text-2xl font-bold ${
                  taxaRetencao >= 70 ? "text-green-600" : "text-yellow-600"
                }`}
              >
                {taxaRetencao.toFixed(0)}%
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* BLOCO 6 - ALERTAS */}
      {alertas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              Alertas Operacionais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertas.map((alerta, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  alerta.tipo === "error"
                    ? "bg-destructive/10 border border-destructive/20"
                    : alerta.tipo === "warning"
                    ? "bg-yellow-500/10 border border-yellow-500/20"
                    : "bg-primary/10 border border-primary/20"
                }`}
              >
                {alerta.tipo === "error" ? (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                ) : alerta.tipo === "warning" ? (
                  <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                ) : (
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium">{alerta.titulo}</p>
                  <p className="text-xs text-muted-foreground">{alerta.descricao}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {alertas.length === 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-600">
                Tudo em ordem!
              </p>
              <p className="text-xs text-muted-foreground">
                Nenhum alerta operacional no momento
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
