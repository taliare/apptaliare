import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp, TrendingDown, Minus, DollarSign, Target,
  Receipt, Repeat, Wallet, Percent, ChevronDown, ChevronRight,
  BarChart3, Boxes, Clock, RotateCcw, AlertTriangle, Scale, Hourglass,
  Activity,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const fmtPct = (v: number) =>
  `${(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;

const fmtData = (d: string | null) => {
  if (!d) return "—";
  const parts = d.split("T")[0].split("-");
  if (parts.length < 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const ultimoDia = (ano: string, mes: string) =>
  new Date(Number(ano), Number(mes), 0).getDate();

const mesAnterior = (ano: string, mes: string) => {
  const m = Number(mes) - 1;
  if (m <= 0) return { ano: String(Number(ano) - 1), mes: "12" };
  return { ano, mes: String(m).padStart(2, "0") };
};

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const anoAtual = new Date().getFullYear();
const ANOS = [anoAtual - 1, anoAtual, anoAtual + 1];
const mesAtualStr = String(new Date().getMonth() + 1).padStart(2, "0");

// ─── Types ─────────────────────────────────────
interface Prestacao {
  id: string;
  cobranca_id: string | null;
  revendedora: string | null;
  total_venda: number | null;
  comissao_valor: number | null;
  valor_pago: number | null;
  saldo_devedor: number | null;
  data_execucao: string;
}

interface Cobranca {
  id: string;
  revendedora: string | null;
  codigo_nota: string | null;
  valor_previsto: number | null;
  valor_pago_acumulado: number | null;
  data_agendada: string;
  status: string | null;
  data_quitacao?: string | null;
  data_encaminhado_juridico?: string | null;
}

interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  ano_mes: string;
}

// ─── Fetch helpers ─────────────────────────────
async function fetchPrestacoesPeriodo(inicio: string, fim: string) {
  const { data, error } = await supabase
    .from("prestacoes_contas")
    .select("id,cobranca_id,revendedora,total_venda,comissao_valor,valor_pago,saldo_devedor,data_execucao")
    .gte("data_execucao", inicio)
    .lte("data_execucao", fim);
  if (error) throw error;
  return (data ?? []) as Prestacao[];
}

async function fetchCobrancasPeriodo(inicio: string, fim: string) {
  const { data, error } = await supabase
    .from("cobrancas_agendadas")
    .select("id,revendedora,codigo_nota,valor_previsto,valor_pago_acumulado,data_agendada,status,data_quitacao,data_encaminhado_juridico")
    .gte("data_agendada", inicio)
    .lte("data_agendada", fim)
    .eq("vigente", true);
  if (error) throw error;
  return (data ?? []) as Cobranca[];
}

// Cobranças quitadas (status=pago) com data_quitacao no período
async function fetchQuitadasPeriodo(inicio: string, fim: string) {
  const { data, error } = await supabase
    .from("cobrancas_agendadas")
    .select("id,revendedora,codigo_nota,valor_previsto,valor_pago_acumulado,data_agendada,status,data_quitacao,data_encaminhado_juridico")
    .eq("status", "pago")
    .gte("data_quitacao", inicio)
    .lte("data_quitacao", fim)
    .eq("vigente", true);
  if (error) throw error;
  return (data ?? []) as Cobranca[];
}

// Snapshot: todas pendentes/parciais vigentes (kits em campo)
async function fetchCobrancasAbertas() {
  const { data, error } = await supabase
    .from("cobrancas_agendadas")
    .select("id,revendedora,codigo_nota,valor_previsto,valor_pago_acumulado,data_agendada,status,data_quitacao,data_encaminhado_juridico")
    .in("status", ["pendente", "parcial"])
    .eq("vigente", true);
  if (error) throw error;
  return (data ?? []) as Cobranca[];
}

// Cobranças no jurídico com data_encaminhado_juridico no período
async function fetchJuridicoPeriodo(inicio: string, fim: string) {
  const { data, error } = await supabase
    .from("cobrancas_agendadas")
    .select("id,revendedora,codigo_nota,valor_previsto,valor_pago_acumulado,data_agendada,status,data_quitacao,data_encaminhado_juridico")
    .not("data_encaminhado_juridico", "is", null)
    .gte("data_encaminhado_juridico", `${inicio}T00:00:00`)
    .lte("data_encaminhado_juridico", `${fim}T23:59:59`);
  if (error) throw error;
  return (data ?? []) as Cobranca[];
}

// Notas com devolveu_tudo no período (para taxa devolução total)
async function fetchDevolucoesTotaisPeriodo(inicio: string, fim: string) {
  const { data, error } = await supabase
    .from("notas_promissorias")
    .select("id,cobranca_id,codigo_nota,data,valor_total")
    .eq("devolveu_tudo", true)
    .gte("data", inicio)
    .lte("data", fim);
  if (error) throw error;
  return (data ?? []) as { id: string; cobranca_id: string | null; codigo_nota: string; data: string; valor_total: number }[];
}

async function fetchDespesasMes(anoMes: string) {
  const { data, error } = await supabase
    .from("dre_despesas")
    .select("id,descricao,valor,data_pagamento,forma_pagamento,ano_mes")
    .eq("ano_mes", anoMes)
    .eq("status_pagamento", "pago");
  if (error) throw error;
  return (data ?? []) as Despesa[];
}

// ─── Variation chip ────────────────────────────
function Variacao({ atual, anterior }: { atual: number; anterior: number }) {
  if (!isFinite(atual) || !isFinite(anterior)) return null;
  if (anterior === 0 && atual === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> 0%
      </span>
    );
  }
  const diff = atual - anterior;
  const pct = anterior !== 0 ? (diff / Math.abs(anterior)) * 100 : 100;
  const up = diff >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        up ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
      }`}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {fmtPct(Math.abs(pct))}
    </span>
  );
}

// ─── KPI Card ──────────────────────────────────
function KpiCard({
  icon, titulo, valor, subtitulo, anterior, atual, extra, onClick, accent,
}: {
  icon: React.ReactNode;
  titulo: string;
  valor: string;
  subtitulo?: string;
  anterior?: number;
  atual?: number;
  extra?: React.ReactNode;
  onClick?: () => void;
  accent?: "green" | "red" | "neutral";
}) {
  const accentBorder =
    accent === "green" ? "border-l-green-500" :
    accent === "red" ? "border-l-red-500" :
    "border-l-primary/60";
  return (
    <Card
      onClick={onClick}
      className={`border-l-4 ${accentBorder} ${onClick ? "cursor-pointer hover:shadow-md transition" : ""}`}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {icon}
            <span>{titulo}</span>
          </div>
          {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="text-2xl font-bold font-mono tabular-nums">{valor}</div>
        <div className="flex items-center justify-between">
          {subtitulo && <span className="text-xs text-muted-foreground">{subtitulo}</span>}
          {atual !== undefined && anterior !== undefined && (
            <Variacao atual={atual} anterior={anterior} />
          )}
        </div>
        {extra}
      </CardContent>
    </Card>
  );
}

// ─── Gauge bar (aproveitamento) ────────────────
function GaugeBar({ pct }: { pct: number }) {
  const cor =
    pct < 20 ? "bg-red-500" :
    pct < 35 ? "bg-yellow-500" :
    "bg-green-500";
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
      <div className={`h-full ${cor} transition-all`} style={{ width: `${width}%` }} />
    </div>
  );
}

// ─── Drilldown types ──────────────────────────
type Drilldown =
  | { tipo: "receita"; titulo: string; rows: Prestacao[] }
  | { tipo: "aproveitamento"; titulo: string; rows: Cobranca[] }
  | { tipo: "ticket"; titulo: string; rows: Cobranca[] }
  | { tipo: "recuperacao"; titulo: string; rows: Prestacao[] }
  | { tipo: "custo"; titulo: string; rows: Despesa[] }
  | { tipo: "margem"; titulo: string; receita: number; custo: number }
  | { tipo: "op_cobrancas"; titulo: string; rows: Cobranca[]; mostrarSaldo?: boolean }
  | { tipo: "op_tempo"; titulo: string; rows: { cobranca: Cobranca; dias: number }[] }
  | { tipo: "op_atraso"; titulo: string; rows: { cobranca: Cobranca; dias: number; bucket: string }[] }
  | { tipo: "op_prazo"; titulo: string; rows: { cobranca: Cobranca; primeira: string; dias: number }[] }
  | null;

// ─── Main ──────────────────────────────────────
export default function RelatorioKpis() {
  const [ano, setAno] = useState(String(anoAtual));
  const [mes, setMes] = useState(mesAtualStr);
  const [openFinanceiro, setOpenFinanceiro] = useState(true);
  const [openOperacional, setOpenOperacional] = useState(true);
  const [drill, setDrill] = useState<Drilldown>(null);

  const dataInicio = `${ano}-${mes}-01`;
  const dataFim = `${ano}-${mes}-${String(ultimoDia(ano, mes)).padStart(2, "0")}`;
  const anoMes = `${ano}-${mes}`;
  const prev = mesAnterior(ano, mes);
  const prevInicio = `${prev.ano}-${prev.mes}-01`;
  const prevFim = `${prev.ano}-${prev.mes}-${String(ultimoDia(prev.ano, prev.mes)).padStart(2, "0")}`;
  const prevAnoMes = `${prev.ano}-${prev.mes}`;

  // ─── Queries período atual ───
  const { data: prestAtual = [], isLoading: lp1 } = useQuery({
    queryKey: ["kpi_prest", anoMes],
    queryFn: () => fetchPrestacoesPeriodo(dataInicio, dataFim),
  });
  const { data: cobrAtual = [], isLoading: lc1 } = useQuery({
    queryKey: ["kpi_cobr", anoMes],
    queryFn: () => fetchCobrancasPeriodo(dataInicio, dataFim),
  });
  const { data: despAtual = [], isLoading: ld1 } = useQuery({
    queryKey: ["kpi_desp", anoMes],
    queryFn: () => fetchDespesasMes(anoMes),
  });

  // ─── Queries período anterior ───
  const { data: prestPrev = [] } = useQuery({
    queryKey: ["kpi_prest", prevAnoMes],
    queryFn: () => fetchPrestacoesPeriodo(prevInicio, prevFim),
  });
  const { data: cobrPrev = [] } = useQuery({
    queryKey: ["kpi_cobr", prevAnoMes],
    queryFn: () => fetchCobrancasPeriodo(prevInicio, prevFim),
  });
  const { data: despPrev = [] } = useQuery({
    queryKey: ["kpi_desp", prevAnoMes],
    queryFn: () => fetchDespesasMes(prevAnoMes),
  });

  // ─── Queries OPERACIONAL ───
  const { data: cobrAbertas = [], isLoading: lo1 } = useQuery({
    queryKey: ["kpi_op_abertas"],
    queryFn: fetchCobrancasAbertas,
  });
  const { data: cobrQuitadas = [], isLoading: lo2 } = useQuery({
    queryKey: ["kpi_op_quitadas", anoMes],
    queryFn: () => fetchQuitadasPeriodo(dataInicio, dataFim),
  });
  const { data: juridicoAtual = [], isLoading: lo3 } = useQuery({
    queryKey: ["kpi_op_juridico", anoMes],
    queryFn: () => fetchJuridicoPeriodo(dataInicio, dataFim),
  });
  const { data: juridicoPrev = [] } = useQuery({
    queryKey: ["kpi_op_juridico", prevAnoMes],
    queryFn: () => fetchJuridicoPeriodo(prevInicio, prevFim),
  });
  const { data: devolucoesAtual = [], isLoading: lo4 } = useQuery({
    queryKey: ["kpi_op_devol", anoMes],
    queryFn: () => fetchDevolucoesTotaisPeriodo(dataInicio, dataFim),
  });

  // ─── Cálculos ───
  const k = useMemo(() => {
    // 1. Receita Líquida
    const receitaAtual = prestAtual.reduce((s, p) => s + Number(p.valor_pago || 0), 0);
    const receitaPrev = prestPrev.reduce((s, p) => s + Number(p.valor_pago || 0), 0);

    // 2. Aproveitamento
    const previstoAtual = cobrAtual.reduce((s, c) => s + Number(c.valor_previsto || 0), 0);
    const pagoCobrAtual = cobrAtual.reduce((s, c) => s + Number(c.valor_pago_acumulado || 0), 0);
    const aproveitAtual = previstoAtual > 0 ? (pagoCobrAtual / previstoAtual) * 100 : 0;

    const previstoPrev = cobrPrev.reduce((s, c) => s + Number(c.valor_previsto || 0), 0);
    const pagoCobrPrev = cobrPrev.reduce((s, c) => s + Number(c.valor_pago_acumulado || 0), 0);
    const aproveitPrev = previstoPrev > 0 ? (pagoCobrPrev / previstoPrev) * 100 : 0;

    // 3. Ticket médio
    const ticketAtual = cobrAtual.length > 0 ? previstoAtual / cobrAtual.length : 0;
    const ticketPrev = cobrPrev.length > 0 ? previstoPrev / cobrPrev.length : 0;

    // 4. Recuperação inadimplência
    const recupRowsAtual = prestAtual.filter(p =>
      Number(p.comissao_valor || 0) === 0 && Number(p.valor_pago || 0) > 0
    );
    const recupRowsPrev = prestPrev.filter(p =>
      Number(p.comissao_valor || 0) === 0 && Number(p.valor_pago || 0) > 0
    );
    const recupAtual = recupRowsAtual.reduce((s, p) => s + Number(p.valor_pago || 0), 0);
    const recupPrev = recupRowsPrev.reduce((s, p) => s + Number(p.valor_pago || 0), 0);

    // 5. Custo operacional
    const custoAtual = despAtual.reduce((s, d) => s + Number(d.valor || 0), 0);
    const custoPrev = despPrev.reduce((s, d) => s + Number(d.valor || 0), 0);

    // 6. Margem
    const margemAtual = receitaAtual > 0 ? ((receitaAtual - custoAtual) / receitaAtual) * 100 : 0;
    const margemPrev = receitaPrev > 0 ? ((receitaPrev - custoPrev) / receitaPrev) * 100 : 0;

    return {
      receitaAtual, receitaPrev,
      previstoAtual, pagoCobrAtual, aproveitAtual, aproveitPrev,
      ticketAtual, ticketPrev,
      recupAtual, recupPrev, recupRowsAtual,
      custoAtual, custoPrev,
      margemAtual, margemPrev,
    };
  }, [prestAtual, prestPrev, cobrAtual, cobrPrev, despAtual, despPrev]);

  // ─── Cálculos OPERACIONAL ───
  const op = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

    const diffDias = (a: string, b: string) => {
      const d1 = new Date(a + "T12:00:00").getTime();
      const d2 = new Date(b + "T12:00:00").getTime();
      return Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
    };

    // 1. Kits em campo
    const kitsCampoValor = cobrAbertas.reduce((s, c) =>
      s + (Number(c.valor_previsto || 0) - Number(c.valor_pago_acumulado || 0)), 0
    );

    // 2. Tempo médio de retorno (status=pago, data_quitacao no período)
    const retornoRows = cobrQuitadas
      .filter(c => c.data_quitacao && c.data_agendada)
      .map(c => ({ cobranca: c, dias: diffDias(c.data_quitacao!, c.data_agendada) }))
      .filter(r => r.dias >= 0);
    const tempoMedioRetorno = retornoRows.length > 0
      ? retornoRows.reduce((s, r) => s + r.dias, 0) / retornoRows.length
      : 0;

    // 3. Taxa de devolução total
    const cobrIdsDevolucao = new Set(devolucoesAtual.map(d => d.cobranca_id).filter(Boolean));
    const encerradasIds = new Set(cobrQuitadas.map(c => c.id));
    const devolvidasEncerradas = cobrQuitadas.filter(c => cobrIdsDevolucao.has(c.id));
    const taxaDevolucao = encerradasIds.size > 0
      ? (devolvidasEncerradas.length / encerradasIds.size) * 100
      : 0;

    // 4. Notas em atraso (snapshot agora)
    const atrasadas = cobrAbertas
      .filter(c => c.data_agendada < hojeStr)
      .map(c => {
        const dias = diffDias(hojeStr, c.data_agendada);
        let bucket = "0-30";
        if (dias > 60) bucket = "+60";
        else if (dias > 30) bucket = "31-60";
        return { cobranca: c, dias, bucket };
      });
    const atraso030 = atrasadas.filter(a => a.bucket === "0-30");
    const atraso3160 = atrasadas.filter(a => a.bucket === "31-60");
    const atraso60plus = atrasadas.filter(a => a.bucket === "+60");

    // 5. Notas no jurídico
    const juridicoCountAtual = juridicoAtual.length;
    const juridicoValorAtual = juridicoAtual.reduce((s, c) =>
      s + (Number(c.valor_previsto || 0) - Number(c.valor_pago_acumulado || 0)), 0
    );
    const juridicoCountPrev = juridicoPrev.length;

    // 6. Prazo médio recebimento (cobranças do período com prestação)
    const primeiraPorCobranca = new Map<string, string>();
    for (const p of prestAtual) {
      if (!p.cobranca_id || Number(p.valor_pago || 0) <= 0) continue;
      const cur = primeiraPorCobranca.get(p.cobranca_id);
      if (!cur || p.data_execucao < cur) {
        primeiraPorCobranca.set(p.cobranca_id, p.data_execucao);
      }
    }
    const prazoRows: { cobranca: Cobranca; primeira: string; dias: number }[] = [];
    for (const c of cobrAtual) {
      const primeira = primeiraPorCobranca.get(c.id);
      if (!primeira) continue;
      const dias = diffDias(primeira, c.data_agendada);
      prazoRows.push({ cobranca: c, primeira, dias });
    }
    const prazoMedio = prazoRows.length > 0
      ? prazoRows.reduce((s, r) => s + r.dias, 0) / prazoRows.length
      : 0;

    return {
      kitsCampoValor, cobrAbertasCount: cobrAbertas.length,
      tempoMedioRetorno, retornoRows,
      taxaDevolucao, devolvidasEncerradas, encerradasTotal: encerradasIds.size,
      atrasadas, atraso030, atraso3160, atraso60plus,
      juridicoCountAtual, juridicoValorAtual, juridicoCountPrev,
      prazoMedio, prazoRows,
    };
  }, [cobrAbertas, cobrQuitadas, devolucoesAtual, juridicoAtual, juridicoPrev, prestAtual, cobrAtual]);

  const loading = lp1 || lc1 || ld1;
  const loadingOp = lo1 || lo2 || lo3 || lo4;

  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            Relatório de KPIs
          </h1>
          <p className="text-sm text-muted-foreground">
            Indicadores estratégicos do mês selecionado
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((nome, i) => (
                <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* SEÇÃO 1 — FINANCEIRO */}
      <Collapsible open={openFinanceiro} onOpenChange={setOpenFinanceiro}>
        <Card>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="font-semibold text-lg">Financeiro</span>
              </div>
              <ChevronDown
                className={`h-5 w-5 transition-transform ${openFinanceiro ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="p-4 pt-0">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <KpiCard
                    icon={<DollarSign className="h-4 w-4" />}
                    titulo="Receita Líquida do Mês"
                    valor={fmt(k.receitaAtual)}
                    subtitulo="Pago em prestações"
                    atual={k.receitaAtual}
                    anterior={k.receitaPrev}
                    accent="green"
                    onClick={() => setDrill({
                      tipo: "receita",
                      titulo: "Receita Líquida — Prestações pagas",
                      rows: prestAtual.filter(p => Number(p.valor_pago || 0) > 0),
                    })}
                  />

                  <KpiCard
                    icon={<Target className="h-4 w-4" />}
                    titulo="Aproveitamento"
                    valor={fmtPct(k.aproveitAtual)}
                    subtitulo={`${fmt(k.pagoCobrAtual)} / ${fmt(k.previstoAtual)}`}
                    atual={k.aproveitAtual}
                    anterior={k.aproveitPrev}
                    accent={k.aproveitAtual < 20 ? "red" : k.aproveitAtual < 35 ? "neutral" : "green"}
                    extra={<GaugeBar pct={k.aproveitAtual} />}
                    onClick={() => setDrill({
                      tipo: "aproveitamento",
                      titulo: "Aproveitamento — Cobranças do período",
                      rows: cobrAtual,
                    })}
                  />

                  <KpiCard
                    icon={<Receipt className="h-4 w-4" />}
                    titulo="Ticket Médio por Nota"
                    valor={fmt(k.ticketAtual)}
                    subtitulo={`${cobrAtual.length} nota(s)`}
                    atual={k.ticketAtual}
                    anterior={k.ticketPrev}
                    accent="neutral"
                    onClick={() => setDrill({
                      tipo: "ticket",
                      titulo: "Ticket Médio — Notas agendadas",
                      rows: cobrAtual,
                    })}
                  />

                  <KpiCard
                    icon={<Repeat className="h-4 w-4" />}
                    titulo="Recuperação de Inadimplência"
                    valor={fmt(k.recupAtual)}
                    subtitulo={`${k.recupRowsAtual.length} recuperação(ões)`}
                    atual={k.recupAtual}
                    anterior={k.recupPrev}
                    accent="green"
                    onClick={() => setDrill({
                      tipo: "recuperacao",
                      titulo: "Recuperação de Inadimplência",
                      rows: k.recupRowsAtual,
                    })}
                  />

                  <KpiCard
                    icon={<Wallet className="h-4 w-4" />}
                    titulo="Custo Operacional"
                    valor={fmt(k.custoAtual)}
                    subtitulo="Despesas pagas no mês"
                    atual={k.custoAtual}
                    anterior={k.custoPrev}
                    accent="red"
                    onClick={() => setDrill({
                      tipo: "custo",
                      titulo: "Custo Operacional — Despesas pagas",
                      rows: despAtual,
                    })}
                  />

                  <KpiCard
                    icon={<Percent className="h-4 w-4" />}
                    titulo="Margem Operacional"
                    valor={fmtPct(k.margemAtual)}
                    subtitulo={`${fmt(k.receitaAtual - k.custoAtual)} de resultado`}
                    atual={k.margemAtual}
                    anterior={k.margemPrev}
                    accent={k.margemAtual >= 0 ? "green" : "red"}
                    onClick={() => setDrill({
                      tipo: "margem",
                      titulo: "Margem Operacional — Composição",
                      receita: k.receitaAtual,
                      custo: k.custoAtual,
                    })}
                  />
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* SEÇÃO 2 — OPERACIONAL */}
      <Collapsible open={openOperacional} onOpenChange={setOpenOperacional}>
        <Card>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <span className="font-semibold text-lg">Operacional</span>
              </div>
              <ChevronDown
                className={`h-5 w-5 transition-transform ${openOperacional ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="p-4 pt-0">
              {loadingOp ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <KpiCard
                    icon={<Boxes className="h-4 w-4" />}
                    titulo="Kits em Campo (Valor Total)"
                    valor={fmt(op.kitsCampoValor)}
                    subtitulo={`Capital imobilizado · ${op.cobrAbertasCount} nota(s)`}
                    accent="neutral"
                    onClick={() => setDrill({
                      tipo: "op_cobrancas",
                      titulo: "Kits em Campo — Cobranças abertas",
                      rows: cobrAbertas,
                      mostrarSaldo: true,
                    })}
                  />

                  <KpiCard
                    icon={<Clock className="h-4 w-4" />}
                    titulo="Tempo Médio de Retorno"
                    valor={`${op.tempoMedioRetorno.toFixed(0)} dias`}
                    subtitulo={`${op.retornoRows.length} kit(s) encerrado(s)`}
                    accent={
                      op.tempoMedioRetorno < 45 ? "green" :
                      op.tempoMedioRetorno <= 90 ? "neutral" : "red"
                    }
                    onClick={() => setDrill({
                      tipo: "op_tempo",
                      titulo: "Tempo de Retorno — Kits encerrados",
                      rows: op.retornoRows,
                    })}
                  />

                  <KpiCard
                    icon={<RotateCcw className="h-4 w-4" />}
                    titulo="Taxa de Devolução Total"
                    valor={fmtPct(op.taxaDevolucao)}
                    subtitulo={`Kits que voltaram sem nenhuma venda · ${op.devolvidasEncerradas.length}/${op.encerradasTotal}`}
                    accent={op.taxaDevolucao > 20 ? "red" : op.taxaDevolucao > 10 ? "neutral" : "green"}
                    onClick={() => setDrill({
                      tipo: "op_cobrancas",
                      titulo: "Kits devolvidos totalmente no período",
                      rows: op.devolvidasEncerradas,
                    })}
                  />

                  <KpiCard
                    icon={<AlertTriangle className="h-4 w-4" />}
                    titulo="Notas em Atraso"
                    valor={String(op.atrasadas.length)}
                    subtitulo={`0-30: ${op.atraso030.length} · 31-60: ${op.atraso3160.length} · +60: ${op.atraso60plus.length}`}
                    accent={op.atraso60plus.length > 0 ? "red" : op.atraso3160.length > 0 ? "neutral" : "green"}
                    onClick={() => setDrill({
                      tipo: "op_atraso",
                      titulo: "Notas em Atraso (snapshot atual)",
                      rows: op.atrasadas,
                    })}
                  />

                  <KpiCard
                    icon={<Scale className="h-4 w-4" />}
                    titulo="Notas no Jurídico"
                    valor={String(op.juridicoCountAtual)}
                    subtitulo={`${fmt(op.juridicoValorAtual)} encaminhado`}
                    atual={op.juridicoCountAtual}
                    anterior={op.juridicoCountPrev}
                    accent={op.juridicoCountAtual > op.juridicoCountPrev ? "red" : "neutral"}
                    onClick={() => setDrill({
                      tipo: "op_cobrancas",
                      titulo: "Notas encaminhadas ao Jurídico",
                      rows: juridicoAtual,
                      mostrarSaldo: true,
                    })}
                  />

                  <KpiCard
                    icon={<Hourglass className="h-4 w-4" />}
                    titulo="Prazo Médio de Recebimento"
                    valor={`${op.prazoMedio.toFixed(0)} dias`}
                    subtitulo={`${op.prazoRows.length} nota(s) com pagamento`}
                    accent={
                      op.prazoMedio < 30 ? "green" :
                      op.prazoMedio <= 60 ? "neutral" : "red"
                    }
                    onClick={() => setDrill({
                      tipo: "op_prazo",
                      titulo: "Prazo de Recebimento — Agendamento → 1º pagamento",
                      rows: op.prazoRows,
                    })}
                  />
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>


      {/* Drilldown Sheet */}
      <Sheet open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>{drill?.titulo}</SheetTitle>
            <SheetDescription>
              Período: {MESES[Number(mes) - 1]} / {ano}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <div className="p-4">
              {drill?.tipo === "receita" && <DrillPrestacoes rows={drill.rows} />}
              {drill?.tipo === "recuperacao" && <DrillPrestacoes rows={drill.rows} />}
              {drill?.tipo === "aproveitamento" && <DrillCobrancas rows={drill.rows} mostrarSaldo />}
              {drill?.tipo === "ticket" && <DrillCobrancas rows={drill.rows} />}
              {drill?.tipo === "custo" && <DrillDespesas rows={drill.rows} />}
              {drill?.tipo === "margem" && (
                <DrillMargem receita={drill.receita} custo={drill.custo} />
              )}
              {drill?.tipo === "op_cobrancas" && (
                <DrillCobrancas rows={drill.rows} mostrarSaldo={drill.mostrarSaldo} />
              )}
              {drill?.tipo === "op_tempo" && <DrillTempo rows={drill.rows} />}
              {drill?.tipo === "op_atraso" && <DrillAtraso rows={drill.rows} />}
              {drill?.tipo === "op_prazo" && <DrillPrazo rows={drill.rows} />}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Drilldown components ──────────────────────
function DrillPrestacoes({ rows }: { rows: Prestacao[] }) {
  const total = rows.reduce((s, r) => s + Number(r.valor_pago || 0), 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Revendedora</TableHead>
          <TableHead className="text-right">Valor Pago</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sem registros</TableCell></TableRow>
        ) : rows.map(r => (
          <TableRow key={r.id}>
            <TableCell className="text-xs">{fmtData(r.data_execucao)}</TableCell>
            <TableCell className="text-sm">{r.revendedora || "—"}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{fmt(Number(r.valor_pago || 0))}</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/40 font-semibold">
          <TableCell colSpan={2}>Total ({rows.length})</TableCell>
          <TableCell className="text-right font-mono tabular-nums">{fmt(total)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function DrillCobrancas({ rows, mostrarSaldo }: { rows: Cobranca[]; mostrarSaldo?: boolean }) {
  const totalPrev = rows.reduce((s, r) => s + Number(r.valor_previsto || 0), 0);
  const totalPago = rows.reduce((s, r) => s + Number(r.valor_pago_acumulado || 0), 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Revendedora</TableHead>
          <TableHead>Nota</TableHead>
          <TableHead className="text-right">Previsto</TableHead>
          {mostrarSaldo && <TableHead className="text-right">Pago</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={mostrarSaldo ? 5 : 4} className="text-center text-muted-foreground py-6">Sem registros</TableCell></TableRow>
        ) : rows.map(r => (
          <TableRow key={r.id}>
            <TableCell className="text-xs">{fmtData(r.data_agendada)}</TableCell>
            <TableCell className="text-sm">{r.revendedora || "—"}</TableCell>
            <TableCell className="text-xs">{r.codigo_nota || "—"}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{fmt(Number(r.valor_previsto || 0))}</TableCell>
            {mostrarSaldo && (
              <TableCell className="text-right font-mono tabular-nums">{fmt(Number(r.valor_pago_acumulado || 0))}</TableCell>
            )}
          </TableRow>
        ))}
        <TableRow className="bg-muted/40 font-semibold">
          <TableCell colSpan={3}>Total ({rows.length})</TableCell>
          <TableCell className="text-right font-mono tabular-nums">{fmt(totalPrev)}</TableCell>
          {mostrarSaldo && <TableCell className="text-right font-mono tabular-nums">{fmt(totalPago)}</TableCell>}
        </TableRow>
      </TableBody>
    </Table>
  );
}

function DrillDespesas({ rows }: { rows: Despesa[] }) {
  const total = rows.reduce((s, r) => s + Number(r.valor || 0), 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Forma</TableHead>
          <TableHead className="text-right">Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem despesas</TableCell></TableRow>
        ) : rows.map(r => (
          <TableRow key={r.id}>
            <TableCell className="text-xs">{fmtData(r.data_pagamento)}</TableCell>
            <TableCell className="text-sm">{r.descricao}</TableCell>
            <TableCell className="text-xs">{r.forma_pagamento || "—"}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{fmt(Number(r.valor || 0))}</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/40 font-semibold">
          <TableCell colSpan={3}>Total ({rows.length})</TableCell>
          <TableCell className="text-right font-mono tabular-nums">{fmt(total)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function DrillMargem({ receita, custo }: { receita: number; custo: number }) {
  const resultado = receita - custo;
  const margem = receita > 0 ? (resultado / receita) * 100 : 0;
  return (
    <div className="space-y-3">
      <Row label="Receita Líquida" valor={fmt(receita)} cor="text-green-600" />
      <Row label="(-) Custo Operacional" valor={fmt(custo)} cor="text-red-600" />
      <div className="h-px bg-border" />
      <Row
        label="= Resultado"
        valor={fmt(resultado)}
        cor={resultado >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}
        bold
      />
      <Row
        label="Margem Operacional"
        valor={fmtPct(margem)}
        cor={margem >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}
        bold
      />
    </div>
  );
}

function Row({ label, valor, cor, bold }: { label: string; valor: string; cor: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded bg-muted/30">
      <span className={`text-sm ${bold ? "font-bold" : ""}`}>{label}</span>
      <span className={`font-mono tabular-nums ${cor} ${bold ? "font-bold text-lg" : ""}`}>{valor}</span>
    </div>
  );
}
