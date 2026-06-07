import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { profilesLimited } from "@/lib/profilesLimited";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Users,
  UserX,
  Package,
  Trophy,
  AlertCircle,
} from "lucide-react";
import { formatarValor } from "@/lib/utils";
import { differenceInDays } from "date-fns";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Alerta {
  cor: "vermelho" | "laranja" | "amarelo" | "verde";
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
}

const corClasses: Record<Alerta["cor"], { border: string; bg: string; text: string }> = {
  vermelho: { border: "border-destructive/40", bg: "bg-destructive/5", text: "text-destructive" },
  laranja: { border: "border-orange-500/40", bg: "bg-orange-500/5", text: "text-orange-500" },
  amarelo: { border: "border-amber-500/40", bg: "bg-amber-500/5", text: "text-amber-500" },
  verde: { border: "border-success/40", bg: "bg-success/5", text: "text-success" },
};

function barraAproveitamento(pct: number) {
  if (pct >= 70) return "bg-success";
  if (pct >= 40) return "bg-amber-500";
  return "bg-destructive";
}

function badgeVariantAproveitamento(pct: number): "success" | "warning" | "destructive" {
  if (pct >= 70) return "success";
  if (pct >= 40) return "warning";
  return "destructive";
}

export default function AnaliseComercial() {
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth());
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  const inicioMes = `${anoSelecionado}-${String(mesSelecionado + 1).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anoSelecionado, mesSelecionado + 1, 0).getDate();
  const fimMes = `${anoSelecionado}-${String(mesSelecionado + 1).padStart(2, "0")}-${ultimoDia}`;

  const mesAnterior = mesSelecionado === 0 ? 11 : mesSelecionado - 1;
  const anoMesAnterior = mesSelecionado === 0 ? anoSelecionado - 1 : anoSelecionado;
  const inicioMesAnterior = `${anoMesAnterior}-${String(mesAnterior + 1).padStart(2, "0")}-01`;
  const ultimoDiaMesAnterior = new Date(anoMesAnterior, mesAnterior + 1, 0).getDate();
  const fimMesAnterior = `${anoMesAnterior}-${String(mesAnterior + 1).padStart(2, "0")}-${ultimoDiaMesAnterior}`;

  const hojeStr = new Date().toISOString().split("T")[0];
  const data90 = new Date();
  data90.setDate(data90.getDate() - 90);
  const limite90 = data90.toISOString().split("T")[0];
  const data60 = new Date();
  data60.setDate(data60.getDate() - 60);
  const limite60 = data60.toISOString().split("T")[0];
  const data30 = new Date();
  data30.setDate(data30.getDate() - 30);
  const limite30 = data30.toISOString().split("T")[0];

  const navegarMes = (direcao: "anterior" | "proximo") => {
    if (direcao === "anterior") {
      if (mesSelecionado === 0) {
        setMesSelecionado(11);
        setAnoSelecionado(anoSelecionado - 1);
      } else setMesSelecionado(mesSelecionado - 1);
    } else {
      if (mesSelecionado === 11) {
        setMesSelecionado(0);
        setAnoSelecionado(anoSelecionado + 1);
      } else setMesSelecionado(mesSelecionado + 1);
    }
  };

  // Representantes ativos
  const { data: representantes } = useQuery({
    queryKey: ["desempenho-representantes"],
    queryFn: async () => {
      const { data } = await profilesLimited()
        .select("id, nome")
        .eq("ativo", true);
      return (data || []) as Array<{ id: string; nome: string }>;
    },
  });

  // Prestações do mês selecionado (com cobrança para tipo e valores previstos/pagos)
  const { data: prestacoesMes, isLoading: loadingMes } = useQuery({
    queryKey: ["desempenho-prestacoes-mes", inicioMes, fimMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select(`
          id, cobranca_id, representante_id, revendedora,
          total_venda, comissao_valor, valor_devido_empresa, valor_pago, data_execucao,
          cobrancas_agendadas!prestacoes_contas_cobranca_id_fkey(tipo, valor_previsto, valor_pago_acumulado)
        `)
        .gte("data_execucao", inicioMes)
        .lte("data_execucao", fimMes);
      if (error) throw error;
      return data || [];
    },
  });

  // Prestações do mês anterior (comparativo)
  const { data: prestacoesAnterior, isLoading: loadingAnt } = useQuery({
    queryKey: ["desempenho-prestacoes-anterior", inicioMesAnterior, fimMesAnterior],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select(`
          id, representante_id, total_venda, comissao_valor,
          cobrancas_agendadas!prestacoes_contas_cobranca_id_fkey(tipo)
        `)
        .gte("data_execucao", inicioMesAnterior)
        .lte("data_execucao", fimMesAnterior);
      if (error) throw error;
      return data || [];
    },
  });

  // Cobranças vigentes (kits em campo) – aproveitamento por representante
  const { data: cobrancasVigentes, isLoading: loadingVig } = useQuery({
    queryKey: ["desempenho-cobrancas-vigentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas_agendadas")
        .select("id, representante_id, valor_previsto, valor_pago_acumulado, status, tipo, revendedora, data_agendada, kit_entregue_id, apurado")
        .eq("vigente", true);
      if (error) throw error;
      return data || [];
    },
  });

  // Cobranças VENCIDAS (data_agendada < hoje) em aberto – inadimplência real
  const { data: cobrancasAbertas, isLoading: loadingAb } = useQuery({
    queryKey: ["desempenho-cobrancas-vencidas", hojeStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas_agendadas")
        .select("id, representante_id, valor_previsto, valor_pago_acumulado, valor_adiantado, status, data_agendada, revendedora, tipo")
        .eq("vigente", true)
        .in("status", ["pendente", "parcial"])
        .lt("data_agendada", hojeStr);
      if (error) throw error;
      return data || [];
    },
  });

  // Kits entregues há mais de 60 dias (para detectar atrasos)
  const { data: kitsAtrasados, isLoading: loadingKits } = useQuery({
    queryKey: ["desempenho-kits-atrasados", limite60],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kits_entregues")
        .select("id, representante_id, data_entrega, codigo_mostruario")
        .lt("data_entrega", limite60);
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = loadingMes || loadingAnt || loadingVig || loadingAb || loadingKits;

  const nomeRep = (id: string | null | undefined): string => {
    if (!id) return "—";
    return representantes?.find(r => r.id === id)?.nome || "—";
  };

  // ====== Cálculos ======

  // Aproveitamento por representante (kits em campo)
  const aproveitamentoPorRep = useMemo(() => {
    if (!representantes || !cobrancasVigentes) return [];
    return representantes
      .map(rep => {
        const kits = cobrancasVigentes.filter(c => c.representante_id === rep.id && c.tipo === "kit");
        const previsto = kits.reduce((s, c) => s + Number(c.valor_previsto || 0), 0);
        const recebido = kits.reduce((s, c) => s + Number(c.valor_pago_acumulado || 0), 0);
        const pct = previsto > 0 ? (recebido / previsto) * 100 : 0;
        return {
          id: rep.id,
          nome: rep.nome,
          qtdKits: kits.length,
          previsto,
          recebido,
          pct,
        };
      })
      .filter(r => r.qtdKits > 0)
      .sort((a, b) => b.pct - a.pct);
  }, [representantes, cobrancasVigentes]);

  // Inadimplência por representante — apenas valores VENCIDOS
  const inadimplenciaPorRep = useMemo(() => {
    if (!representantes || !cobrancasAbertas || !cobrancasVigentes) return [];
    return representantes
      .map(rep => {
        const vencidas = cobrancasAbertas.filter(c => c.representante_id === rep.id);
        const vencido = vencidas.reduce(
          (s, c) => s + Math.max(
            0,
            Number(c.valor_previsto || 0)
              - Number(c.valor_pago_acumulado || 0)
              - Number((c as any).valor_adiantado || 0)
          ),
          0
        );
        const carteira = cobrancasVigentes
          .filter(c => c.representante_id === rep.id)
          .reduce((s, c) => s + Number(c.valor_previsto || 0), 0);
        const pct = carteira > 0 ? (vencido / carteira) * 100 : 0;
        return { id: rep.id, nome: rep.nome, vencido, carteira, pct };
      })
      .filter(r => r.vencido > 0)
      .sort((a, b) => b.vencido - a.vencido);
  }, [representantes, cobrancasAbertas, cobrancasVigentes]);

  // Top performers do mês (revendedoras)
  const topPerformers = useMemo(() => {
    if (!prestacoesMes) return [];
    const agg: Record<string, {
      nome: string; representanteId: string | null;
      totalVenda: number; comissao: number; devidoEmpresa: number;
    }> = {};
    prestacoesMes.forEach((p: any) => {
      const nome = p.revendedora || "—";
      const key = `${nome}__${p.representante_id || ""}`;
      if (!agg[key]) {
        agg[key] = {
          nome, representanteId: p.representante_id,
          totalVenda: 0, comissao: 0, devidoEmpresa: 0,
        };
      }
      agg[key].totalVenda += Number(p.total_venda || 0);
      agg[key].comissao += Number(p.comissao_valor || 0);
      agg[key].devidoEmpresa += Number(p.valor_devido_empresa || 0);
    });
    return Object.values(agg)
      .sort((a, b) => b.totalVenda - a.totalVenda)
      .slice(0, 10);
  }, [prestacoesMes]);

  // Revendedoras em atenção
  const revendedorasAtencao = useMemo(() => {
    const lista: Array<{
      nome: string; representante: string;
      situacao: "Kit atrasado" | "Saldo em aberto"; dias: number;
      valor?: number;
    }> = [];

    // 1) Kits há mais de 60 dias sem retorno (vigente=true, tipo=kit, kit_entregue_id != null)
    if (cobrancasVigentes && kitsAtrasados) {
      const kitsAtrasadosMap = new Map(kitsAtrasados.map(k => [k.id, k]));
      cobrancasVigentes
        .filter(c => c.tipo === "kit" && !c.apurado && c.kit_entregue_id && kitsAtrasadosMap.has(c.kit_entregue_id))
        .forEach(c => {
          const k = kitsAtrasadosMap.get(c.kit_entregue_id!);
          if (!k) return;
          const dias = differenceInDays(new Date(), new Date(k.data_entrega));
          lista.push({
            nome: c.revendedora || "—",
            representante: nomeRep(c.representante_id),
            situacao: "Kit atrasado",
            dias,
          });
        });
    }

    // 2) Cobranças parciais há mais de 30 dias vencidas
    if (cobrancasAbertas) {
      cobrancasAbertas
        .filter(c => c.status === "parcial" && c.data_agendada < limite30)
        .forEach(c => {
          const dias = differenceInDays(new Date(), new Date(c.data_agendada));
          const saldo = Math.max(0, Number(c.valor_previsto || 0) - Number(c.valor_pago_acumulado || 0));
          lista.push({
            nome: c.revendedora || "—",
            representante: nomeRep(c.representante_id),
            situacao: "Saldo em aberto",
            dias,
            valor: saldo,
          });
        });
    }

    return lista.sort((a, b) => b.dias - a.dias).slice(0, 20);
  }, [cobrancasVigentes, cobrancasAbertas, kitsAtrasados, representantes, limite30]);

  // Comparativo Mês atual vs Mês anterior
  const comparativo = useMemo(() => {
    if (!representantes || !prestacoesMes || !prestacoesAnterior) return [];

    const fatPorRepMes: Record<string, number> = {};
    const inadPorRepMes: Record<string, number> = {};
    prestacoesMes.forEach((p: any) => {
      const repId = p.representante_id;
      if (!repId) return;
      fatPorRepMes[repId] = (fatPorRepMes[repId] || 0) + Number(p.total_venda || 0);
    });

    if (cobrancasAbertas) {
      cobrancasAbertas.forEach(c => {
        const repId = c.representante_id;
        if (!repId) return;
        const saldo = Math.max(0, Number(c.valor_previsto || 0) - Number(c.valor_pago_acumulado || 0));
        inadPorRepMes[repId] = (inadPorRepMes[repId] || 0) + saldo;
      });
    }

    const fatPorRepAnt: Record<string, number> = {};
    prestacoesAnterior.forEach((p: any) => {
      const repId = p.representante_id;
      if (!repId) return;
      fatPorRepAnt[repId] = (fatPorRepAnt[repId] || 0) + Number(p.total_venda || 0);
    });

    return representantes
      .map(rep => {
        const fAtu = fatPorRepMes[rep.id] || 0;
        const fAnt = fatPorRepAnt[rep.id] || 0;
        const variacao = fAnt > 0 ? ((fAtu - fAnt) / fAnt) * 100 : (fAtu > 0 ? 100 : 0);
        return {
          id: rep.id,
          nome: rep.nome,
          fatAtual: fAtu,
          fatAnterior: fAnt,
          variacao,
          inadAtual: inadPorRepMes[rep.id] || 0,
          inadAnterior: 0, // não temos snapshot histórico
        };
      })
      .filter(r => r.fatAtual > 0 || r.fatAnterior > 0)
      .sort((a, b) => b.fatAtual - a.fatAtual);
  }, [representantes, prestacoesMes, prestacoesAnterior, cobrancasAbertas]);

  // Alertas
  const alertas = useMemo<Alerta[]>(() => {
    const lista: Alerta[] = [];

    // 🔴 Reps com inadimplência (vencido) > 20% da carteira ativa
    if (representantes && cobrancasAbertas && cobrancasVigentes) {
      representantes.forEach(rep => {
        const carteira = cobrancasVigentes
          .filter(c => c.representante_id === rep.id)
          .reduce((s, c) => s + Number(c.valor_previsto || 0), 0);
        const vencido = cobrancasAbertas
          .filter(c => c.representante_id === rep.id)
          .reduce(
            (s, c) => s + Math.max(
              0,
              Number(c.valor_previsto || 0)
                - Number(c.valor_pago_acumulado || 0)
                - Number((c as any).valor_adiantado || 0)
            ),
            0
          );
        const pct = carteira > 0 ? (vencido / carteira) * 100 : 0;
        if (pct > 20 && carteira > 0) {
          lista.push({
            cor: "vermelho",
            icone: <AlertCircle className="h-4 w-4" />,
            titulo: `${rep.nome}: inadimplência ${pct.toFixed(1)}%`,
            descricao: `${formatarValor(vencido)} vencidos sobre carteira ativa de ${formatarValor(carteira)}`,
          });
        }
      });
    }

    // 🟠 Revendedoras com kit > 90 dias sem retorno
    if (cobrancasVigentes && kitsAtrasados) {
      const map90 = new Map(
        kitsAtrasados.filter(k => k.data_entrega < limite90).map(k => [k.id, k])
      );
      const revsCriticas = new Set<string>();
      cobrancasVigentes
        .filter(c => c.tipo === "kit" && !c.apurado && c.kit_entregue_id && map90.has(c.kit_entregue_id))
        .forEach(c => revsCriticas.add(c.revendedora || "—"));
      if (revsCriticas.size > 0) {
        lista.push({
          cor: "laranja",
          icone: <Package className="h-4 w-4" />,
          titulo: `${revsCriticas.size} ${revsCriticas.size === 1 ? "revendedora" : "revendedoras"} com kit há mais de 90 dias`,
          descricao: "Mostruários sem retorno ou apuração. Verificar regularização.",
        });
      }
    }

    // 🟡 Aproveitamento do mês < 60%
    if (prestacoesMes && prestacoesMes.length > 0) {
      let previsto = 0;
      let pago = 0;
      prestacoesMes.forEach((p: any) => {
        const cob = p.cobrancas_agendadas;
        if (!cob) return;
        previsto += Number(cob.valor_previsto || 0);
        pago += Number(cob.valor_pago_acumulado || 0);
      });
      const pct = previsto > 0 ? (pago / previsto) * 100 : 0;
      if (previsto > 0 && pct < 60) {
        lista.push({
          cor: "amarelo",
          icone: <AlertTriangle className="h-4 w-4" />,
          titulo: `Aproveitamento do mês em ${pct.toFixed(1)}%`,
          descricao: `Recebido ${formatarValor(pago)} de ${formatarValor(previsto)} previstos`,
        });
      }
    }

    if (lista.length === 0 && !isLoading) {
      lista.push({
        cor: "verde",
        icone: <CheckCircle className="h-4 w-4" />,
        titulo: "Operação saudável neste período",
        descricao: "Nenhum alerta operacional identificado.",
      });
    }

    return lista;
  }, [representantes, prestacoesMes, cobrancasAbertas, cobrancasVigentes, kitsAtrasados, limite90, isLoading]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Análise de Desempenho</h1>
          <p className="text-sm text-muted-foreground">
            Rankings, alertas e comparativos operacionais
          </p>
        </div>

        {/* Navegação de período */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => navegarMes("anterior")} className="h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={String(mesSelecionado)} onValueChange={(v) => setMesSelecionado(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((mes, idx) => (
                <SelectItem key={idx} value={String(idx)}>{mes}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(anoSelecionado)} onValueChange={(v) => setAnoSelecionado(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((ano) => (
                <SelectItem key={ano} value={String(ano)}>{ano}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => navegarMes("proximo")} className="h-9 w-9">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* SEÇÃO 1 — Alertas Operacionais */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Alertas Operacionais</h2>
          <div className="flex-1 border-t border-border" />
        </div>
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {alertas.map((a, idx) => {
              const c = corClasses[a.cor];
              return (
                <div key={idx} className={`p-3 rounded-lg border ${c.border} ${c.bg}`}>
                  <div className="flex items-start gap-2">
                    <div className={c.text}>{a.icone}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{a.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-1">{a.descricao}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SEÇÃO 2 — Representantes */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Representantes</h2>
          <div className="flex-1 border-t border-border" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Aproveitamento */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4 text-success" />
                Ranking por Aproveitamento
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {aproveitamentoPorRep.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Representante</TableHead>
                        <TableHead className="text-xs text-right">Kits</TableHead>
                        <TableHead className="text-xs text-right">Previsto</TableHead>
                        <TableHead className="text-xs text-right">Recebido</TableHead>
                        <TableHead className="text-xs">Aproveitamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aproveitamentoPorRep.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm font-medium">{r.nome}</TableCell>
                          <TableCell className="text-sm text-right">{r.qtdKits}</TableCell>
                          <TableCell className="text-sm text-right">{formatarValor(r.previsto)}</TableCell>
                          <TableCell className="text-sm text-right">{formatarValor(r.recebido)}</TableCell>
                          <TableCell className="min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                                <div
                                  className={`h-full ${barraAproveitamento(r.pct)} transition-all`}
                                  style={{ width: `${Math.min(100, r.pct)}%` }}
                                />
                              </div>
                              <Badge variant={badgeVariantAproveitamento(r.pct)} className="text-[10px]">
                                {r.pct.toFixed(0)}%
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inadimplência */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Ranking por Inadimplência
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {inadimplenciaPorRep.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem inadimplência</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Representante</TableHead>
                        <TableHead className="text-xs text-right">Valor Vencido</TableHead>
                        <TableHead className="text-xs text-right">% da Carteira Ativa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inadimplenciaPorRep.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm font-medium">{r.nome}</TableCell>
                          <TableCell className="text-sm text-right text-destructive">{formatarValor(r.vencido)}</TableCell>
                          <TableCell className="text-sm text-right">
                            <Badge variant={r.pct > 20 ? "destructive" : r.pct > 10 ? "warning" : "outline"} className="text-[10px]">
                              {r.pct.toFixed(1)}%
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
        </div>
      </section>

      {/* SEÇÃO 3 — Revendedoras */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Revendedoras</h2>
          <div className="flex-1 border-t border-border" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Top performers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4 text-success" />
                Top Performers do Mês
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {topPerformers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem dados no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Revendedora</TableHead>
                        <TableHead className="text-xs">Representante</TableHead>
                        <TableHead className="text-xs text-right">Total Vendido</TableHead>
                        <TableHead className="text-xs text-right">Comissão</TableHead>
                        <TableHead className="text-xs text-right">Devido Empresa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topPerformers.map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm font-medium">{r.nome}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{nomeRep(r.representanteId)}</TableCell>
                          <TableCell className="text-sm text-right">{formatarValor(r.totalVenda)}</TableCell>
                          <TableCell className="text-sm text-right">{formatarValor(r.comissao)}</TableCell>
                          <TableCell className="text-sm text-right">{formatarValor(r.devidoEmpresa)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Em atenção */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <UserX className="h-4 w-4 text-orange-500" />
                Revendedoras em Atenção
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {revendedorasAtencao.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma revendedora em atenção</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Revendedora</TableHead>
                        <TableHead className="text-xs">Representante</TableHead>
                        <TableHead className="text-xs">Situação</TableHead>
                        <TableHead className="text-xs text-right">Dias</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revendedorasAtencao.map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm font-medium">{r.nome}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.representante}</TableCell>
                          <TableCell>
                            <Badge
                              variant={r.situacao === "Saldo em aberto" ? "destructive" : "warning"}
                              className="text-[10px]"
                            >
                              {r.situacao}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-right font-medium">{r.dias}d</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* SEÇÃO 4 — Comparativo Representantes */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Comparativo Mensal — Representantes
          </h2>
          <div className="flex-1 border-t border-border" />
        </div>
        <Card>
          <CardContent className="pt-6">
            {comparativo.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem dados para comparar</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Representante</TableHead>
                      <TableHead className="text-xs text-right">Faturamento Atual</TableHead>
                      <TableHead className="text-xs text-right">Faturamento Anterior</TableHead>
                      <TableHead className="text-xs text-right">Variação</TableHead>
                      <TableHead className="text-xs text-right">Inadimplência Atual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparativo.map(r => {
                      const subiu = r.variacao >= 0;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm font-medium">{r.nome}</TableCell>
                          <TableCell className="text-sm text-right">{formatarValor(r.fatAtual)}</TableCell>
                          <TableCell className="text-sm text-right text-muted-foreground">{formatarValor(r.fatAnterior)}</TableCell>
                          <TableCell className="text-sm text-right">
                            <span className={`inline-flex items-center gap-1 ${subiu ? "text-success" : "text-destructive"}`}>
                              {subiu ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {r.fatAnterior === 0 && r.fatAtual > 0 ? "novo" : `${r.variacao.toFixed(1)}%`}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-right text-destructive">
                            {r.inadAtual > 0 ? formatarValor(r.inadAtual) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
