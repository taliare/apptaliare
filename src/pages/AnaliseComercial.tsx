import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { profilesLimited } from "@/lib/profilesLimited";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  TrendingUp,
  TrendingDown,
  Percent,
  Calculator,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Info,
  Bell,
  Clock,
  CheckCircle,
  Users,
  UserX,
} from "lucide-react";
import { formatarValor } from "@/lib/utils";
import { differenceInDays } from "date-fns";

interface Alerta {
  tipo: "inadimplencia" | "representante" | "revendedora" | "recuperacao";
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
  corBorda: string;
  corFundo: string;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function AnaliseComercial() {
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth());
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  // Calcular início e fim do mês
  const inicioMes = `${anoSelecionado}-${String(mesSelecionado + 1).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anoSelecionado, mesSelecionado + 1, 0).getDate();
  const fimMes = `${anoSelecionado}-${String(mesSelecionado + 1).padStart(2, "0")}-${ultimoDia}`;

  const navegarMes = (direcao: "anterior" | "proximo") => {
    if (direcao === "anterior") {
      if (mesSelecionado === 0) {
        setMesSelecionado(11);
        setAnoSelecionado(anoSelecionado - 1);
      } else {
        setMesSelecionado(mesSelecionado - 1);
      }
    } else {
      if (mesSelecionado === 11) {
        setMesSelecionado(0);
        setAnoSelecionado(anoSelecionado + 1);
      } else {
        setMesSelecionado(mesSelecionado + 1);
      }
    }
  };

  // Calcular período anterior para comparativo
  const mesAnterior = mesSelecionado === 0 ? 11 : mesSelecionado - 1;
  const anoMesAnterior = mesSelecionado === 0 ? anoSelecionado - 1 : anoSelecionado;
  const inicioMesAnterior = `${anoMesAnterior}-${String(mesAnterior + 1).padStart(2, "0")}-01`;
  const ultimoDiaMesAnterior = new Date(anoMesAnterior, mesAnterior + 1, 0).getDate();
  const fimMesAnterior = `${anoMesAnterior}-${String(mesAnterior + 1).padStart(2, "0")}-${ultimoDiaMesAnterior}`;

  // Query 1: Prestações de Contas (Kits) - para faturamento e comissão
  const { data: prestacoesKits, isLoading: loadingKits } = useQuery({
    queryKey: ["analise-prestacoes-kits", inicioMes, fimMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select(`
          id, total_venda, comissao_valor, valor_pago, representante_id,
          cobrancas_agendadas(tipo)
        `)
        .gte("data_execucao", inicioMes)
        .lte("data_execucao", fimMes);
      
      if (error) throw error;
      return data?.filter(p => p.cobrancas_agendadas?.tipo === "kit") || [];
    },
  });

  // Query 2: Prestações de Contas (Repasses) - recuperação de inadimplência
  const { data: prestacoesRepasses, isLoading: loadingRepasses } = useQuery({
    queryKey: ["analise-prestacoes-repasses", inicioMes, fimMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select(`
          id, valor_pago,
          cobrancas_agendadas(tipo)
        `)
        .gte("data_execucao", inicioMes)
        .lte("data_execucao", fimMes);
      
      if (error) throw error;
      return data?.filter(p => p.cobrancas_agendadas?.tipo === "repasse") || [];
    },
  });

  // Query 3: Fechamento Diário (fonte oficial para cálculo de inadimplência)
  const { data: cobrancasDiarias, isLoading: loadingFechamento } = useQuery({
    queryKey: ["analise-fechamento", inicioMes, fimMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas_diarias")
        .select("id, total_cobrado, representante_id")
        .gte("data", inicioMes)
        .lte("data", fimMes);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Query 4: Representantes ativos
  const { data: representantes } = useQuery({
    queryKey: ["analise-representantes"],
    queryFn: async () => {
      const { data } = await profilesLimited()
        .select("id, nome")
        .eq("ativo", true);
      return data || [];
    },
  });

  // Query 5: Cobrancas em aberto (repasses pendentes/parciais) com valor
  const { data: cobrancasEmAberto } = useQuery({
    queryKey: ["analise-cobrancas-aberto"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cobrancas_agendadas")
        .select("id, revendedora, data_agendada, valor_previsto, tipo, status")
        .eq("vigente", true)
        .in("status", ["pendente", "parcial"])
        .eq("tipo", "repasse");
      return data || [];
    },
  });

  // Query 7: Repasses pagos por representante (para recuperação individual)
  const { data: repassesPorRep } = useQuery({
    queryKey: ["analise-repasses-rep", inicioMes, fimMes],
    queryFn: async () => {
      const { data } = await supabase
        .from("prestacoes_contas")
        .select(`representante_id, valor_pago, cobrancas_agendadas(tipo)`)
        .gte("data_execucao", inicioMes)
        .lte("data_execucao", fimMes);
      return data?.filter(p => p.cobrancas_agendadas?.tipo === "repasse") || [];
    },
  });

  // Query 6: Recuperação do mês anterior (para comparativo)
  const { data: recuperacaoAnterior } = useQuery({
    queryKey: ["analise-recuperacao-anterior", inicioMesAnterior, fimMesAnterior],
    queryFn: async () => {
      const { data } = await supabase
        .from("prestacoes_contas")
        .select(`valor_pago, cobrancas_agendadas(tipo)`)
        .gte("data_execucao", inicioMesAnterior)
        .lte("data_execucao", fimMesAnterior);
      return data?.filter(p => p.cobrancas_agendadas?.tipo === "repasse") || [];
    },
  });

  // Cálculos dos indicadores
  const faturamentoBruto = prestacoesKits?.reduce(
    (sum, p) => sum + (p.total_venda || 0), 0
  ) || 0;

  const comissaoGerada = prestacoesKits?.reduce(
    (sum, p) => sum + (p.comissao_valor || 0), 0
  ) || 0;

  const receitaLiquidaTeorica = faturamentoBruto - comissaoGerada;

  const valorRecebido = cobrancasDiarias?.reduce(
    (sum, c) => sum + (c.total_cobrado || 0), 0
  ) || 0;

  const inadimplencia = Math.max(0, receitaLiquidaTeorica - valorRecebido);

  const recuperacao = prestacoesRepasses?.reduce(
    (sum, p) => sum + (p.valor_pago || 0), 0
  ) || 0;

  // Percentual de inadimplência
  const percentualInadimplencia = receitaLiquidaTeorica > 0 
    ? ((inadimplencia / receitaLiquidaTeorica) * 100).toFixed(1) 
    : "0.0";

  // Recuperação do mês anterior
  const recuperacaoMesAnterior = recuperacaoAnterior?.reduce(
    (sum, p) => sum + (p.valor_pago || 0), 0
  ) || 0;

  // Cálculo de alertas
  const alertas = useMemo(() => {
    const listaAlertas: Alerta[] = [];

    // ALERTA 1: Inadimplência Alta (>15%)
    if (receitaLiquidaTeorica > 0 && Number(percentualInadimplencia) > 15) {
      listaAlertas.push({
        tipo: "inadimplencia",
        icone: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
        titulo: "Inadimplência acima do padrão no período atual",
        descricao: `${percentualInadimplencia}% da receita teórica. Atenção à cobrança.`,
        corBorda: "border-amber-500/30",
        corFundo: "bg-amber-500/5",
      });
    }

    // ALERTA 2: Representante em Risco
    if (representantes && prestacoesKits && cobrancasDiarias) {
      const mediaGeral = Number(percentualInadimplencia);
      
      const inadimplenciaPorRep = representantes.map(rep => {
        const receitaRep = prestacoesKits
          .filter(p => p.representante_id === rep.id)
          .reduce((sum, p) => sum + ((p.total_venda || 0) - (p.comissao_valor || 0)), 0);
        
        const recebidoRep = cobrancasDiarias
          .filter(c => c.representante_id === rep.id)
          .reduce((sum, c) => sum + (c.total_cobrado || 0), 0);
        
        const inadimplenciaRep = Math.max(0, receitaRep - recebidoRep);
        const percentual = receitaRep > 0 ? (inadimplenciaRep / receitaRep) * 100 : 0;
        
        return { ...rep, percentual, inadimplencia: inadimplenciaRep, receitaRep };
      }).filter(rep => rep.receitaRep > 0);

      const representantesEmRisco = inadimplenciaPorRep.filter(
        rep => rep.percentual > mediaGeral && rep.percentual > 15
      );

      representantesEmRisco.slice(0, 3).forEach(rep => {
        listaAlertas.push({
          tipo: "representante",
          icone: <TrendingDown className="h-4 w-4 text-destructive shrink-0" />,
          titulo: "Representante com inadimplência acima da média",
          descricao: `${rep.nome} - ${rep.percentual.toFixed(1)}% (média geral: ${mediaGeral}%)`,
          corBorda: "border-destructive/30",
          corFundo: "bg-destructive/5",
        });
      });
    }

    // ALERTA 3: Revendedora Crítica
    if (cobrancasEmAberto && cobrancasEmAberto.length > 0) {
      const revendedorasPendencias: Record<string, { nome: string; pendencias: number; diasAtraso: number }> = {};
      
      cobrancasEmAberto.forEach(c => {
        const nome = c.revendedora || "Sem nome";
        if (!revendedorasPendencias[nome]) {
          revendedorasPendencias[nome] = { nome, pendencias: 0, diasAtraso: 0 };
        }
        revendedorasPendencias[nome].pendencias++;
        
        const diasAtraso = differenceInDays(new Date(), new Date(c.data_agendada));
        if (diasAtraso > revendedorasPendencias[nome].diasAtraso) {
          revendedorasPendencias[nome].diasAtraso = diasAtraso;
        }
      });

      const revendedorasCriticas = Object.values(revendedorasPendencias)
        .filter(r => r.pendencias > 1 || r.diasAtraso > 30);

      revendedorasCriticas.slice(0, 3).forEach(rev => {
        const motivo = rev.diasAtraso > 30 
          ? `${rev.diasAtraso} dias de atraso`
          : `${rev.pendencias} pendências em aberto`;
        
        listaAlertas.push({
          tipo: "revendedora",
          icone: <Clock className="h-4 w-4 text-orange-500 shrink-0" />,
          titulo: "Revendedora com histórico crítico de atraso",
          descricao: `${rev.nome} - ${motivo}`,
          corBorda: "border-orange-500/30",
          corFundo: "bg-orange-500/5",
        });
      });
    }

    // ALERTA 4: Recuperação Positiva
    if (recuperacao > 0 && recuperacao > recuperacaoMesAnterior) {
      listaAlertas.push({
        tipo: "recuperacao",
        icone: <CheckCircle className="h-4 w-4 text-success shrink-0" />,
        titulo: "Boa recuperação de inadimplência no período",
        descricao: `Fluxo positivo - ${formatarValor(recuperacao)} recuperados`,
        corBorda: "border-success/30",
        corFundo: "bg-success/5",
      });
    }

    return listaAlertas;
  }, [
    receitaLiquidaTeorica, 
    percentualInadimplencia, 
    representantes, 
    prestacoesKits, 
    cobrancasDiarias,
    cobrancasEmAberto,
    recuperacao,
    recuperacaoMesAnterior
  ]);

  // RANKING 1: Representantes por Inadimplência
  const rankingInadimplencia = useMemo(() => {
    if (!representantes || !prestacoesKits || !cobrancasDiarias) return [];
    
    return representantes
      .map(rep => {
        const faturamentoRep = prestacoesKits
          .filter(p => p.representante_id === rep.id)
          .reduce((sum, p) => sum + (p.total_venda || 0), 0);
        
        const comissaoRep = prestacoesKits
          .filter(p => p.representante_id === rep.id)
          .reduce((sum, p) => sum + (p.comissao_valor || 0), 0);
        
        const receitaTeericaRep = faturamentoRep - comissaoRep;
        
        const recebidoRep = cobrancasDiarias
          .filter(c => c.representante_id === rep.id)
          .reduce((sum, c) => sum + (c.total_cobrado || 0), 0);
        
        const inadimplenciaRep = Math.max(0, receitaTeericaRep - recebidoRep);
        const percentual = receitaTeericaRep > 0 
          ? (inadimplenciaRep / receitaTeericaRep) * 100 
          : 0;
        
        return {
          nome: rep.nome,
          receitaTeorica: receitaTeericaRep,
          inadimplencia: inadimplenciaRep,
          percentual
        };
      })
      .filter(rep => rep.receitaTeorica > 0)
      .sort((a, b) => b.percentual - a.percentual);
  }, [representantes, prestacoesKits, cobrancasDiarias]);

  // RANKING 2: Representantes por Performance
  const rankingPerformance = useMemo(() => {
    if (!representantes || !prestacoesKits || !repassesPorRep) return [];
    
    return representantes
      .map(rep => {
        const faturamentoRep = prestacoesKits
          .filter(p => p.representante_id === rep.id)
          .reduce((sum, p) => sum + (p.total_venda || 0), 0);
        
        const comissaoRep = prestacoesKits
          .filter(p => p.representante_id === rep.id)
          .reduce((sum, p) => sum + (p.comissao_valor || 0), 0);
        
        const receitaTeericaRep = faturamentoRep - comissaoRep;
        
        const recuperacaoRep = repassesPorRep
          .filter(p => p.representante_id === rep.id)
          .reduce((sum, p) => sum + (p.valor_pago || 0), 0);
        
        return {
          nome: rep.nome,
          faturamentoBruto: faturamentoRep,
          receitaTeorica: receitaTeericaRep,
          recuperacao: recuperacaoRep
        };
      })
      .filter(rep => rep.receitaTeorica > 0)
      .sort((a, b) => b.receitaTeorica - a.receitaTeorica);
  }, [representantes, prestacoesKits, repassesPorRep]);

  // RANKING 3: Revendedoras Críticas
  const rankingRevendedoras = useMemo(() => {
    if (!cobrancasEmAberto) return [];
    
    const agrupado: Record<string, {
      nome: string;
      valorAberto: number;
      qtdRepasses: number;
      diasAtraso: number;
    }> = {};
    
    cobrancasEmAberto.forEach(c => {
      const nome = c.revendedora || "Sem nome";
      if (!agrupado[nome]) {
        agrupado[nome] = { nome, valorAberto: 0, qtdRepasses: 0, diasAtraso: 0 };
      }
      agrupado[nome].valorAberto += c.valor_previsto || 0;
      agrupado[nome].qtdRepasses++;
      
      const dias = differenceInDays(new Date(), new Date(c.data_agendada));
      if (dias > agrupado[nome].diasAtraso) {
        agrupado[nome].diasAtraso = dias;
      }
    });
    
    return Object.values(agrupado)
      .sort((a, b) => b.valorAberto - a.valorAberto);
  }, [cobrancasEmAberto]);

  const isLoading = loadingKits || loadingRepasses || loadingFechamento;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Análise Comercial</h1>
            <p className="text-sm text-muted-foreground">
              Visão econômica do modelo de consignado
            </p>
          </div>
          <Badge 
            variant="outline" 
            className="self-start sm:self-auto border-dashed border-muted-foreground/50 text-muted-foreground bg-muted/30"
          >
            <Info className="h-3 w-3 mr-1" />
            Análise Gerencial - Não impacta DRE
          </Badge>
        </div>

        {/* Navegação de período */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navegarMes("anterior")}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Select
            value={String(mesSelecionado)}
            onValueChange={(v) => setMesSelecionado(Number(v))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((mes, idx) => (
                <SelectItem key={idx} value={String(idx)}>
                  {mes}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(anoSelecionado)}
            onValueChange={(v) => setAnoSelecionado(Number(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((ano) => (
                <SelectItem key={ano} value={String(ano)}>
                  {ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => navegarMes("proximo")}
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Seção de Alertas */}
      {!isLoading && alertas.length > 0 && (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Alertas do Período
              <Badge variant="outline" className="ml-auto text-[10px]">
                {alertas.length} {alertas.length === 1 ? "alerta" : "alertas"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertas.map((alerta, idx) => (
              <div 
                key={idx} 
                className={`p-3 rounded-lg border ${alerta.corBorda} ${alerta.corFundo}`}
              >
                <div className="flex items-start gap-2">
                  {alerta.icone}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{alerta.titulo}</p>
                    <p className="text-xs text-muted-foreground">{alerta.descricao}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Cards Analíticos */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="border-dashed border-muted-foreground/30">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-40 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Faturamento Bruto Estimado */}
          <Card className="border-dashed border-muted-foreground/30 bg-muted/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Faturamento Bruto Estimado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatarValor(faturamentoBruto)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Vendas das revendedoras para clientes finais
              </p>
              <Badge variant="outline" className="mt-2 text-[10px] border-dashed">
                Valor estimativo
              </Badge>
            </CardContent>
          </Card>

          {/* Card 2: Comissão Gerada */}
          <Card className="border-dashed border-muted-foreground/30 bg-muted/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Percent className="h-4 w-4 text-purple-500" />
                Comissão Gerada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatarValor(comissaoGerada)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total de comissão para as revendedoras
              </p>
              {faturamentoBruto > 0 && (
                <Badge variant="outline" className="mt-2 text-[10px] border-dashed">
                  {((comissaoGerada / faturamentoBruto) * 100).toFixed(1)}% do faturamento
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Receita Líquida Teórica */}
          <Card className="border-dashed border-muted-foreground/30 bg-muted/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calculator className="h-4 w-4 text-cyan-500" />
                Receita Líquida Teórica
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatarValor(receitaLiquidaTeorica)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Faturamento bruto − Comissão gerada
              </p>
              <Badge variant="outline" className="mt-2 text-[10px] border-dashed">
                Se todas as notas fossem pagas
              </Badge>
            </CardContent>
          </Card>

          {/* Card 4: Inadimplência em Aberto */}
          <Card className="border-dashed border-muted-foreground/30 bg-muted/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Inadimplência em Aberto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {formatarValor(inadimplencia)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Receita teórica − Valor efetivamente recebido
              </p>
              <Badge 
                variant={Number(percentualInadimplencia) > 30 ? "destructive" : "outline"} 
                className="mt-2 text-[10px] border-dashed"
              >
                {percentualInadimplencia}% da receita teórica
              </Badge>
            </CardContent>
          </Card>

          {/* Card 5: Recuperação (Repasses) */}
          <Card className="border-dashed border-muted-foreground/30 bg-muted/10 md:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-green-500" />
                Recuperação (Repasses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatarValor(recuperacao)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Inadimplência de períodos anteriores recuperada
              </p>
              <Badge variant="outline" className="mt-2 text-[10px] border-dashed">
                {prestacoesRepasses?.length || 0} repasses pagos
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rankings Analíticos */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ranking 1: Representantes por Inadimplência */}
        <Card className="border-dashed border-muted-foreground/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              Representantes por Inadimplência
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : rankingInadimplencia.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado no período</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Representante</TableHead>
                      <TableHead className="text-right">Receita Teórica</TableHead>
                      <TableHead className="text-right">Inadimplência</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankingInadimplencia.map((rep, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{rep.nome}</TableCell>
                        <TableCell className="text-right">{formatarValor(rep.receitaTeorica)}</TableCell>
                        <TableCell className="text-right text-amber-600">{formatarValor(rep.inadimplencia)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={rep.percentual > 25 ? "destructive" : rep.percentual > 15 ? "warning" : "outline"}>
                            {rep.percentual.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ranking 2: Representantes por Performance */}
        <Card className="border-dashed border-muted-foreground/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-500" />
              Representantes por Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : rankingPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado no período</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Representante</TableHead>
                      <TableHead className="text-right">Fat. Bruto</TableHead>
                      <TableHead className="text-right">Receita Teórica</TableHead>
                      <TableHead className="text-right">Recuperação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankingPerformance.map((rep, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{rep.nome}</TableCell>
                        <TableCell className="text-right">{formatarValor(rep.faturamentoBruto)}</TableCell>
                        <TableCell className="text-right">{formatarValor(rep.receitaTeorica)}</TableCell>
                        <TableCell className="text-right text-green-600">{formatarValor(rep.recuperacao)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking 3: Revendedoras Críticas - Full width */}
      <Card className="border-dashed border-muted-foreground/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <UserX className="h-4 w-4 text-orange-500" />
            Revendedoras Críticas
            <Badge variant="outline" className="ml-auto text-[10px]">
              {rankingRevendedoras.length} {rankingRevendedoras.length === 1 ? "revendedora" : "revendedoras"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : rankingRevendedoras.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma revendedora com repasses em aberto</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Revendedora</TableHead>
                    <TableHead className="text-right">Valor em Aberto</TableHead>
                    <TableHead className="text-right">Qtd Repasses</TableHead>
                    <TableHead className="text-right">Maior Atraso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankingRevendedoras.map((rev, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{rev.nome}</TableCell>
                      <TableCell className="text-right text-amber-600">{formatarValor(rev.valorAberto)}</TableCell>
                      <TableCell className="text-right">{rev.qtdRepasses}</TableCell>
                      <TableCell className="text-right">
                        <span className={rev.diasAtraso > 30 ? "text-destructive font-medium" : ""}>
                          {rev.diasAtraso > 0 ? `${rev.diasAtraso} dias` : "-"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nota informativa */}
      <Card className="border-dashed border-muted-foreground/20 bg-muted/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Sobre esta análise</p>
              <p>
                Os valores apresentados são indicadores gerenciais para análise comercial do modelo de consignado.
                O <strong>Faturamento Bruto</strong> representa as vendas das revendedoras e é um valor estimativo.
                O <strong>cálculo oficial de caixa</strong> da empresa continua sendo exclusivamente o fechamento diário dos representantes (DRE).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
