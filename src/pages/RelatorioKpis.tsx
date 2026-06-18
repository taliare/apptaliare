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
  Activity, Users, UserPlus, UserMinus, Trophy, BarChartHorizontal, Briefcase,
  LineChart as LineChartIcon, Sparkles, Bell, UserX, Heart,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ReferenceLine, Tooltip as RTooltip,
  ResponsiveContainer, Cell, LineChart, Line, Legend, CartesianGrid,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

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
  representante_id?: string | null;
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
    .select("id,revendedora,codigo_nota,valor_previsto,valor_pago_acumulado,data_agendada,status,data_quitacao,data_encaminhado_juridico,representante_id")
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
    .select("id,revendedora,codigo_nota,valor_previsto,valor_pago_acumulado,data_agendada,status,data_quitacao,data_encaminhado_juridico,representante_id")
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
    .select("id,revendedora,codigo_nota,valor_previsto,valor_pago_acumulado,data_agendada,status,data_quitacao,data_encaminhado_juridico,representante_id")
    .in("status", ["pendente", "parcial"])
    .eq("vigente", true);
  if (error) throw error;
  return (data ?? []) as Cobranca[];
}

// Cobranças no jurídico com data_encaminhado_juridico no período
async function fetchJuridicoPeriodo(inicio: string, fim: string) {
  const { data, error } = await supabase
    .from("cobrancas_agendadas")
    .select("id,revendedora,codigo_nota,valor_previsto,valor_pago_acumulado,data_agendada,status,data_quitacao,data_encaminhado_juridico,representante_id")
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

// ─── PESSOAS fetchers ──────────────────────────
interface RevendedoraRow {
  id: string;
  nome: string;
  representante_id: string | null;
  criado_em: string | null;
}
interface ProfileRow {
  id: string;
  nome: string;
}

async function fetchRevendedorasTodas() {
  const { data, error } = await supabase
    .from("revendedoras")
    .select("id,nome,representante_id,criado_em");
  if (error) throw error;
  return (data ?? []) as RevendedoraRow[];
}

async function fetchProfilesTodos() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,nome")
    .eq("ativo", true);
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

// ─── CRESCIMENTO / ALERTAS fetchers ────────────
interface MesTrend {
  anoMes: string;
  label: string;
  receita: number;
  kitsCampo: number;
  aproveit: number;
  novas: number;
}

const MESES_CURTOS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function buildLastMeses(ano: string, mes: string, n: number) {
  const out: { ano: string; mes: string; inicio: string; fim: string; anoMes: string; label: string }[] = [];
  let y = Number(ano);
  let m = Number(mes);
  for (let i = 0; i < n; i++) {
    const ymes = String(m).padStart(2, "0");
    const yano = String(y);
    out.unshift({
      ano: yano,
      mes: ymes,
      inicio: `${yano}-${ymes}-01`,
      fim: `${yano}-${ymes}-${String(ultimoDia(yano, ymes)).padStart(2, "0")}`,
      anoMes: `${yano}-${ymes}`,
      label: `${MESES_CURTOS[m - 1]}/${yano.slice(2)}`,
    });
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

async function fetchMesTrend(m: { inicio: string; fim: string; anoMes: string; label: string }): Promise<MesTrend> {
  const [prest, cobr, novas] = await Promise.all([
    supabase.from("prestacoes_contas").select("valor_pago").gte("data_execucao", m.inicio).lte("data_execucao", m.fim),
    supabase.from("cobrancas_agendadas").select("valor_previsto,valor_pago_acumulado")
      .gte("data_agendada", m.inicio).lte("data_agendada", m.fim).eq("vigente", true),
    supabase.from("revendedoras").select("id", { count: "exact", head: true })
      .gte("criado_em", `${m.inicio}T00:00:00`).lte("criado_em", `${m.fim}T23:59:59`),
  ]);
  const receita = (prest.data ?? []).reduce((s: number, p: any) => s + Number(p.valor_pago || 0), 0);
  const previsto = (cobr.data ?? []).reduce((s: number, c: any) => s + Number(c.valor_previsto || 0), 0);
  const pago = (cobr.data ?? []).reduce((s: number, c: any) => s + Number(c.valor_pago_acumulado || 0), 0);
  return {
    anoMes: m.anoMes,
    label: m.label,
    receita,
    kitsCampo: previsto,
    aproveit: previsto > 0 ? (pago / previsto) * 100 : 0,
    novas: novas.count ?? 0,
  };
}

async function fetchLTV() {
  // soma paginada de prestacoes_contas.valor_pago
  let receitaTotal = 0;
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("prestacoes_contas")
      .select("valor_pago")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    receitaTotal += data.reduce((s: number, p: any) => s + Number(p.valor_pago || 0), 0);
    if (data.length < pageSize) break;
    from += pageSize;
    if (from > 100000) break;
  }
  // distinct revendedoras com pelo menos uma cobrança
  const revSet = new Set<string>();
  let from2 = 0;
  while (true) {
    const { data, error } = await supabase
      .from("cobrancas_agendadas")
      .select("revendedora")
      .range(from2, from2 + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      const n = String((r as any).revendedora || "").trim().toUpperCase();
      if (n) revSet.add(n);
    }
    if (data.length < pageSize) break;
    from2 += pageSize;
    if (from2 > 200000) break;
  }
  return { receitaTotal, revendedorasCount: revSet.size };
}

async function fetchRepsComCobrancaUltimos7Dias(): Promise<Set<string>> {
  const hoje = new Date();
  const ini = new Date(hoje);
  ini.setDate(ini.getDate() - 7);
  const f = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const { data, error } = await supabase
    .from("cobrancas_agendadas")
    .select("representante_id")
    .gte("data_agendada", f(ini))
    .lte("data_agendada", f(hoje));
  if (error) throw error;
  const s = new Set<string>();
  for (const r of data ?? []) {
    const rid = (r as any).representante_id;
    if (rid) s.add(rid);
  }
  return s;
}

// Revendedoras com qualquer cobrança nos últimos 90 dias + universo de quem já teve cobrança
async function fetchRevendedorasInatividade() {
  const hoje = new Date();
  const lim90 = new Date(hoje); lim90.setDate(lim90.getDate() - 90);
  const lim90Str = `${lim90.getFullYear()}-${String(lim90.getMonth() + 1).padStart(2, "0")}-${String(lim90.getDate()).padStart(2, "0")}`;

  const ativas90 = new Set<string>();
  const jaTiveram = new Set<string>();
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("cobrancas_agendadas")
      .select("revendedora,data_agendada")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      const nome = String((r as any).revendedora || "").trim().toUpperCase();
      if (!nome) continue;
      jaTiveram.add(nome);
      const da = String((r as any).data_agendada || "");
      if (da && da >= lim90Str) ativas90.add(nome);
    }
    if (data.length < pageSize) break;
    from += pageSize;
    if (from > 200000) break;
  }
  return { ativas90, jaTiveram };
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
  | { tipo: "pe_revendedoras"; titulo: string; rows: { nome: string; representante: string }[] }
  | { tipo: "pe_novas"; titulo: string; rows: RevendedoraRow[]; nomeRep: Map<string, string> }
  | { tipo: "pe_rep_notas"; titulo: string; rows: Cobranca[] }
  | { tipo: "al_cobrancas"; titulo: string; rows: Cobranca[] }
  | { tipo: "al_reps"; titulo: string; rows: { nome: string; detalhe: string }[] }
  | { tipo: "al_revendedoras"; titulo: string; rows: { nome: string; qtd: number; saldo: number }[] }
  | null;

// ─── Main ──────────────────────────────────────
export default function RelatorioKpis() {
  const [ano, setAno] = useState(String(anoAtual));
  const [mes, setMes] = useState(mesAtualStr);
  const [openFinanceiro, setOpenFinanceiro] = useState(true);
  const [openOperacional, setOpenOperacional] = useState(true);
  const [openPessoas, setOpenPessoas] = useState(true);
  const [openCrescimento, setOpenCrescimento] = useState(true);
  const [openAlertas, setOpenAlertas] = useState(true);
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
  const { data: inatividade } = useQuery({
    queryKey: ["kpi_pe_inatividade"],
    queryFn: fetchRevendedorasInatividade,
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

  // ─── Queries PESSOAS ───
  const { data: revendedoras = [], isLoading: lpe1 } = useQuery({
    queryKey: ["kpi_pe_revendedoras"],
    queryFn: fetchRevendedorasTodas,
  });
  const { data: profilesAll = [], isLoading: lpe2 } = useQuery({
    queryKey: ["kpi_pe_profiles"],
    queryFn: fetchProfilesTodos,
  });

  // ─── Queries CRESCIMENTO ───
  const meses6 = useMemo(() => buildLastMeses(ano, mes, 6), [ano, mes]);
  const { data: trend6 = [], isLoading: lcr1 } = useQuery({
    queryKey: ["kpi_trend6", anoMes],
    queryFn: async () => Promise.all(meses6.map(m => fetchMesTrend(m))),
  });
  const { data: ltv, isLoading: lcr2 } = useQuery({
    queryKey: ["kpi_ltv"],
    queryFn: fetchLTV,
  });

  // ─── Queries ALERTAS ───
  const { data: repsAtivos7d = new Set<string>(), isLoading: lal1 } = useQuery({
    queryKey: ["kpi_al_reps7d"],
    queryFn: fetchRepsComCobrancaUltimos7Dias,
  });




  // ─── Cálculos ───
  const k = useMemo(() => {
    // 1. Receita Líquida
    const receitaAtual = prestAtual.reduce((s, p) => s + Number(p.valor_pago || 0), 0);
    const receitaPrev = prestPrev.reduce((s, p) => s + Number(p.valor_pago || 0), 0);

    // 2. Aproveitamento — receita líquida (prestações pagas no mês) / total previsto (todas notas do mês)
    const previstoAtual = cobrAtual.reduce((s, c) => s + Number(c.valor_previsto || 0), 0);
    const previstoPrev = cobrPrev.reduce((s, c) => s + Number(c.valor_previsto || 0), 0);
    const pagoCobrAtual = receitaAtual; // alinhado com Receita Líquida (mesma fonte/cálculo)
    const aproveitAtual = previstoAtual > 0 ? (receitaAtual / previstoAtual) * 100 : 0;
    const aproveitPrev = previstoPrev > 0 ? (receitaPrev / previstoPrev) * 100 : 0;

    // 3. Ticket médio — apenas notas com status pago ou parcial (valor final conhecido)
    const notasFechadasAtual = cobrAtual.filter(c => c.status === "pago" || c.status === "parcial");
    const notasFechadasPrev = cobrPrev.filter(c => c.status === "pago" || c.status === "parcial");
    const ticketSomaAtual = notasFechadasAtual.reduce((s, c) => s + Number(c.valor_pago_acumulado || 0), 0);
    const ticketSomaPrev = notasFechadasPrev.reduce((s, c) => s + Number(c.valor_pago_acumulado || 0), 0);
    const ticketAtual = notasFechadasAtual.length > 0 ? ticketSomaAtual / notasFechadasAtual.length : 0;
    const ticketPrev = notasFechadasPrev.length > 0 ? ticketSomaPrev / notasFechadasPrev.length : 0;

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

    // Restringe ao mês selecionado (data_agendada dentro do mês)
    const cobrAbertasMes = cobrAbertas.filter(
      c => c.data_agendada >= dataInicio && c.data_agendada <= dataFim
    );

    // 1. Kits em campo (do mês selecionado)
    const kitsCampoValor = cobrAbertasMes.reduce((s, c) =>
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

    // 6. Prazo médio recebimento — média de dias entre data_agendada e data_quitacao
    // das notas quitadas (status=pago) no período
    const prazoRows: { cobranca: Cobranca; primeira: string; dias: number }[] = [];
    for (const c of cobrQuitadas) {
      if (!c.data_quitacao || !c.data_agendada) continue;
      const quit = c.data_quitacao.split("T")[0];
      const dias = diffDias(quit, c.data_agendada);
      if (dias < 0) continue; // proteção: quitação anterior à data agendada (pgto antecipado)
      prazoRows.push({ cobranca: c, primeira: quit, dias });
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

  // ─── Cálculos PESSOAS ───
  const pessoas = useMemo(() => {
    const norm = (s: string | null | undefined) =>
      (s ?? "").trim().toUpperCase();

    const nomeRep = new Map<string, string>();
    for (const p of profilesAll) nomeRep.set(p.id, p.nome);

    // 1. Ativas (distinct revendedora) no mês atual e anterior
    const ativasSetAtual = new Set<string>();
    for (const c of cobrAtual) {
      const n = norm(c.revendedora);
      if (n) ativasSetAtual.add(n);
    }
    const ativasSetPrev = new Set<string>();
    for (const c of cobrPrev) {
      const n = norm(c.revendedora);
      if (n) ativasSetPrev.add(n);
    }
    const ativasAtual = ativasSetAtual.size;
    const ativasPrev = ativasSetPrev.size;

    const ativasRows = Array.from(ativasSetAtual).map(nome => {
      // tenta achar revendedora e seu representante
      const r = revendedoras.find(x => norm(x.nome) === nome);
      return {
        nome,
        representante: r ? (nomeRep.get(r.representante_id ?? "") ?? "—") : "—",
      };
    }).sort((a, b) => a.nome.localeCompare(b.nome));

    // 2. Novas no mês (criado_em no período)
    const novasAtual = revendedoras.filter(r =>
      r.criado_em && r.criado_em >= `${dataInicio}T00:00:00` && r.criado_em <= `${dataFim}T23:59:59`
    );
    const novasPrev = revendedoras.filter(r =>
      r.criado_em && r.criado_em >= `${prevInicio}T00:00:00` && r.criado_em <= `${prevFim}T23:59:59`
    );

    // 3. Perdidas = nomes em cobrPrev mas não em cobrAtual
    const perdidasNomes = Array.from(ativasSetPrev).filter(n => !ativasSetAtual.has(n));
    const perdidasRows = perdidasNomes.map(nome => {
      const r = revendedoras.find(x => norm(x.nome) === nome);
      return {
        nome,
        representante: r ? (nomeRep.get(r.representante_id ?? "") ?? "—") : "—",
      };
    }).sort((a, b) => a.nome.localeCompare(b.nome));

    // 4. Ranking de representantes (do período atual)
    type RepStat = {
      id: string;
      nome: string;
      previsto: number;
      recebido: number;
      aproveit: number;
      notas: number;
      ativasCarteira: number;
      totalCarteira: number;
    };
    const repMap = new Map<string, RepStat>();
    for (const c of cobrAtual) {
      const rid = c.representante_id ?? "";
      if (!rid) continue;
      let r = repMap.get(rid);
      if (!r) {
        r = {
          id: rid,
          nome: nomeRep.get(rid) ?? "(sem nome)",
          previsto: 0, recebido: 0, aproveit: 0, notas: 0,
          ativasCarteira: 0, totalCarteira: 0,
        };
        repMap.set(rid, r);
      }
      r.previsto += Number(c.valor_previsto || 0);
      r.recebido += Number(c.valor_pago_acumulado || 0);
      r.notas += 1;
    }

    // 6. Carteira: ativas vs total por representante
    const totalPorRep = new Map<string, number>();
    const ativasPorRep = new Map<string, Set<string>>();
    for (const r of revendedoras) {
      if (!r.representante_id) continue;
      totalPorRep.set(r.representante_id, (totalPorRep.get(r.representante_id) ?? 0) + 1);
    }
    for (const c of cobrAtual) {
      const rid = c.representante_id ?? "";
      const st = c.status ?? "";
      if (!rid || (st !== "pendente" && st !== "parcial")) continue;
      const nm = norm(c.revendedora);
      if (!nm) continue;
      if (!ativasPorRep.has(rid)) ativasPorRep.set(rid, new Set());
      ativasPorRep.get(rid)!.add(nm);
    }

    // garante todos representantes ativos no map (mesmo sem notas no mês)
    for (const p of profilesAll) {
      if (!repMap.has(p.id) && (totalPorRep.get(p.id) ?? 0) > 0) {
        repMap.set(p.id, {
          id: p.id, nome: p.nome,
          previsto: 0, recebido: 0, aproveit: 0, notas: 0,
          ativasCarteira: 0, totalCarteira: 0,
        });
      }
    }

    const ranking: RepStat[] = [];
    repMap.forEach(r => {
      r.aproveit = r.previsto > 0 ? (r.recebido / r.previsto) * 100 : 0;
      r.totalCarteira = totalPorRep.get(r.id) ?? 0;
      r.ativasCarteira = ativasPorRep.get(r.id)?.size ?? 0;
      ranking.push(r);
    });
    ranking.sort((a, b) => b.aproveit - a.aproveit);

    const aproveitMedio = ranking.length > 0
      ? ranking.reduce((s, r) => s + r.aproveit, 0) / ranking.length
      : 0;

    return {
      ativasAtual, ativasPrev, ativasRows,
      novasAtual, novasPrev,
      perdidasAtual: perdidasRows.length, perdidasRows,
      ranking, aproveitMedio, nomeRep,
    };
  }, [cobrAtual, cobrPrev, revendedoras, profilesAll, dataInicio, dataFim, prevInicio, prevFim]);

  // ─── Cálculos CRESCIMENTO ───
  const crescimento = useMemo(() => {
    const data = trend6 ?? [];
    // tendência de aproveitamento (slope)
    let slope = 0;
    if (data.length >= 2) {
      const xs = data.map((_, i) => i);
      const ys = data.map(d => d.aproveit);
      const n = data.length;
      const mX = xs.reduce((a, b) => a + b, 0) / n;
      const mY = ys.reduce((a, b) => a + b, 0) / n;
      const num = xs.reduce((s, x, i) => s + (x - mX) * (ys[i] - mY), 0);
      const den = xs.reduce((s, x) => s + (x - mX) ** 2, 0);
      slope = den > 0 ? num / den : 0;
    }
    // média móvel 3 períodos
    const aproveitChart = data.map((d, i) => {
      const slice = data.slice(Math.max(0, i - 2), i + 1);
      const ma = slice.reduce((s, x) => s + x.aproveit, 0) / slice.length;
      return { label: d.label, aproveit: d.aproveit, ma };
    });
    // LTV
    const ltvMedio = ltv && ltv.revendedorasCount > 0
      ? ltv.receitaTotal / ltv.revendedorasCount
      : 0;
    return { data, slope, aproveitChart, ltvMedio };
  }, [trend6, ltv]);

  // ─── Cálculos ALERTAS ───
  const alertas = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const f = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const hojeStr = f(hoje);
    const lim30 = new Date(hoje); lim30.setDate(lim30.getDate() - 30);
    const lim90 = new Date(hoje); lim90.setDate(lim90.getDate() - 90);
    const lim30Str = f(lim30);
    const lim90Str = f(lim90);

    // 1. Vencidas > 30 dias
    const vencidas30 = cobrAbertas.filter(c => c.data_agendada < lim30Str);
    // 3. Kits em campo > 90 dias
    const campo90 = cobrAbertas.filter(c => c.data_agendada < lim90Str);

    // 2. Representantes sem cobrança nos últimos 7 dias
    const repsSem7d: { nome: string; detalhe: string }[] = [];
    for (const p of profilesAll) {
      if (!repsAtivos7d.has(p.id)) {
        repsSem7d.push({ nome: p.nome, detalhe: "Sem cobrança nos últimos 7 dias" });
      }
    }

    // 4. Aproveitamento < 20% no mês atual (por representante)
    const repBaixo: { nome: string; detalhe: string }[] = pessoas.ranking
      .filter(r => r.previsto > 0 && r.aproveit < 20)
      .map(r => ({ nome: r.nome, detalhe: `Aproveitamento ${fmtPct(r.aproveit)}` }));

    // 5. Revendedoras com 2+ notas em aberto
    const porRev = new Map<string, { qtd: number; saldo: number }>();
    for (const c of cobrAbertas) {
      const nome = String(c.revendedora || "").trim().toUpperCase();
      if (!nome) continue;
      const cur = porRev.get(nome) ?? { qtd: 0, saldo: 0 };
      cur.qtd += 1;
      cur.saldo += Number(c.valor_previsto || 0) - Number(c.valor_pago_acumulado || 0);
      porRev.set(nome, cur);
    }
    const revAcumulo = Array.from(porRev.entries())
      .filter(([, v]) => v.qtd >= 2)
      .map(([nome, v]) => ({ nome, qtd: v.qtd, saldo: v.saldo }))
      .sort((a, b) => b.qtd - a.qtd);

    return { vencidas30, campo90, repsSem7d, repBaixo, revAcumulo };
  }, [cobrAbertas, profilesAll, repsAtivos7d, pessoas.ranking]);

  const loading = lp1 || lc1 || ld1;
  const loadingOp = lo1 || lo2 || lo3 || lo4;
  const loadingPe = lpe1 || lpe2 || lc1;
  const loadingCr = lcr1 || lcr2;
  const loadingAl = lal1 || lo1 || lpe2;


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

      {/* SEÇÃO 3 — PESSOAS */}
      <Collapsible open={openPessoas} onOpenChange={setOpenPessoas}>
        <Card>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-semibold text-lg">Pessoas</span>
              </div>
              <ChevronDown
                className={`h-5 w-5 transition-transform ${openPessoas ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="p-4 pt-0 space-y-4">
              {loadingPe ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Cards 1, 2, 3 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <KpiCard
                      icon={<Users className="h-4 w-4" />}
                      titulo="Revendedoras Ativas no Mês"
                      valor={String(pessoas.ativasAtual)}
                      subtitulo="Revendedoras distintas com nota no período"
                      atual={pessoas.ativasAtual}
                      anterior={pessoas.ativasPrev}
                      accent={pessoas.ativasAtual >= pessoas.ativasPrev ? "green" : "red"}
                      onClick={() => setDrill({
                        tipo: "pe_revendedoras",
                        titulo: "Revendedoras Ativas no Mês",
                        rows: pessoas.ativasRows,
                      })}
                    />

                    <KpiCard
                      icon={<UserPlus className="h-4 w-4" />}
                      titulo="Novas Revendedoras"
                      valor={String(pessoas.novasAtual.length)}
                      subtitulo="Cadastradas no período"
                      atual={pessoas.novasAtual.length}
                      anterior={pessoas.novasPrev.length}
                      accent={pessoas.novasAtual.length >= pessoas.novasPrev.length ? "green" : "red"}
                      onClick={() => setDrill({
                        tipo: "pe_novas",
                        titulo: "Novas Revendedoras no período",
                        rows: pessoas.novasAtual,
                        nomeRep: pessoas.nomeRep,
                      })}
                    />

                    <KpiCard
                      icon={<UserMinus className="h-4 w-4" />}
                      titulo="Revendedoras Perdidas"
                      valor={String(pessoas.perdidasAtual)}
                      subtitulo="Tinham nota no mês anterior, não têm neste"
                      accent={pessoas.perdidasAtual === 0 ? "green" : pessoas.perdidasAtual > 10 ? "red" : "neutral"}
                      onClick={() => setDrill({
                        tipo: "pe_revendedoras",
                        titulo: "Revendedoras Perdidas no período",
                        rows: pessoas.perdidasRows,
                      })}
                    />
                  </div>

                  {/* Card 4 — Ranking de Representantes */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Trophy className="h-4 w-4 text-primary" />
                        <span className="font-semibold">Ranking de Representantes</span>
                      </div>
                      {pessoas.ranking.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          Sem dados de representantes no período.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Representante</TableHead>
                                <TableHead className="text-right">Previsto</TableHead>
                                <TableHead className="text-right">Recebido</TableHead>
                                <TableHead className="text-right">Aprov. %</TableHead>
                                <TableHead className="text-right">Notas</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pessoas.ranking.map((r, i) => {
                                const isBest = i === 0 && pessoas.ranking.length > 1;
                                const isWorst = i === pessoas.ranking.length - 1 && pessoas.ranking.length > 1;
                                const rowClass =
                                  isBest ? "bg-green-500/10" :
                                  isWorst ? "bg-red-500/10" : "";
                                return (
                                  <TableRow key={r.id} className={rowClass}>
                                    <TableCell className="font-medium">{r.nome}</TableCell>
                                    <TableCell className="text-right font-mono tabular-nums">{fmt(r.previsto)}</TableCell>
                                    <TableCell className="text-right font-mono tabular-nums">{fmt(r.recebido)}</TableCell>
                                    <TableCell className={`text-right font-mono tabular-nums ${
                                      r.aproveit >= 35 ? "text-green-600 dark:text-green-400" :
                                      r.aproveit < 20 ? "text-red-600 dark:text-red-400" :
                                      "text-foreground"
                                    }`}>{fmtPct(r.aproveit)}</TableCell>
                                    <TableCell className="text-right font-mono tabular-nums">{r.notas}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Card 5 — Gráfico Aproveitamento por Representante */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <BarChartHorizontal className="h-4 w-4 text-primary" />
                        <span className="font-semibold">Aproveitamento por Representante</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          Média geral: <span className="font-mono">{fmtPct(pessoas.aproveitMedio)}</span>
                        </span>
                      </div>
                      {pessoas.ranking.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          Sem dados para o gráfico.
                        </p>
                      ) : (
                        <ResponsiveContainer width="100%" height={Math.max(180, pessoas.ranking.length * 36)}>
                          <BarChart
                            data={pessoas.ranking}
                            layout="vertical"
                            margin={{ top: 8, right: 24, left: 12, bottom: 8 }}
                          >
                            <XAxis
                              type="number"
                              domain={[0, Math.max(100, Math.ceil((pessoas.aproveitMedio || 0) * 1.5))]}
                              tickFormatter={(v) => `${v}%`}
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={11}
                            />
                            <YAxis
                              type="category"
                              dataKey="nome"
                              width={120}
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={11}
                            />
                            <RTooltip
                              contentStyle={{
                                background: "hsl(var(--popover))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 6,
                                fontSize: 12,
                              }}
                              formatter={(v: number) => [fmtPct(v), "Aproveitamento"]}
                            />
                            <ReferenceLine
                              x={pessoas.aproveitMedio}
                              stroke="hsl(var(--primary))"
                              strokeDasharray="4 4"
                              label={{
                                value: "Média",
                                fill: "hsl(var(--primary))",
                                fontSize: 10,
                                position: "top",
                              }}
                            />
                            <Bar
                              dataKey="aproveit"
                              radius={[0, 4, 4, 0]}
                              cursor="pointer"
                              onClick={(d: any) => {
                                const rid = d?.id;
                                if (!rid) return;
                                const rows = cobrAtual.filter(c => c.representante_id === rid);
                                setDrill({
                                  tipo: "pe_rep_notas",
                                  titulo: `Notas do período — ${d.nome}`,
                                  rows,
                                });
                              }}
                            >
                              {pessoas.ranking.map((r, i) => (
                                <Cell
                                  key={r.id}
                                  fill={
                                    r.aproveit >= 35 ? "hsl(142 71% 45%)" :
                                    r.aproveit >= 20 ? "hsl(45 93% 47%)" :
                                    "hsl(0 84% 60%)"
                                  }
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  {/* Card 6 — Carteira Ativa vs Total */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Briefcase className="h-4 w-4 text-primary" />
                        <span className="font-semibold">Carteira Ativa vs Total</span>
                      </div>
                      {pessoas.ranking.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          Sem dados de carteira.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {[...pessoas.ranking]
                            .sort((a, b) => b.totalCarteira - a.totalCarteira)
                            .map(r => {
                              const pct = r.totalCarteira > 0
                                ? (r.ativasCarteira / r.totalCarteira) * 100
                                : 0;
                              return (
                                <div key={r.id} className="space-y-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium">{r.nome}</span>
                                    <span className="font-mono tabular-nums text-muted-foreground">
                                      {r.ativasCarteira} / {r.totalCarteira}
                                      <span className="ml-2">({fmtPct(pct)})</span>
                                    </span>
                                  </div>
                                  <Progress value={pct} className="h-2" />
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* SEÇÃO 4 — CRESCIMENTO */}
      <Collapsible open={openCrescimento} onOpenChange={setOpenCrescimento}>
        <Card>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-semibold text-lg">Crescimento</span>
              </div>
              <ChevronDown className={`h-5 w-5 transition-transform ${openCrescimento ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 pt-0 space-y-4">
              {loadingCr ? (
                <div className="grid grid-cols-1 gap-3">
                  <Skeleton className="h-64" />
                  <Skeleton className="h-64" />
                  <Skeleton className="h-24" />
                </div>
              ) : (
                <>
                  {/* Card 1 — Comparativo Mensal */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <LineChartIcon className="h-4 w-4 text-primary" />
                        <span className="font-semibold">Comparativo Mensal (últimos 6 meses)</span>
                      </div>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={crescimento.data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                          <YAxis
                            yAxisId="money"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={11}
                            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                          />
                          <YAxis
                            yAxisId="count"
                            orientation="right"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={11}
                          />
                          <RTooltip
                            contentStyle={{
                              background: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 6,
                              fontSize: 12,
                            }}
                            formatter={(v: number, name: string) =>
                              name === "Novas Revendedoras" ? [v, name] : [fmt(v), name]
                            }
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line yAxisId="money" type="monotone" dataKey="receita" name="Receita Líquida"
                            stroke="hsl(142 71% 45%)" strokeWidth={2} dot={{ r: 3 }} />
                          <Line yAxisId="money" type="monotone" dataKey="kitsCampo" name="Kits em Campo"
                            stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                          <Line yAxisId="count" type="monotone" dataKey="novas" name="Novas Revendedoras"
                            stroke="hsl(45 93% 47%)" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Card 2 — Tendência de Aproveitamento */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        <span className="font-semibold">Tendência de Aproveitamento</span>
                        <span className={`ml-auto inline-flex items-center gap-1 text-xs font-medium ${
                          crescimento.slope >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}>
                          {crescimento.slope >= 0
                            ? <TrendingUp className="h-3 w-3" />
                            : <TrendingDown className="h-3 w-3" />}
                          {crescimento.slope >= 0 ? "Tendência de alta" : "Tendência de queda"}
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={crescimento.aproveitChart} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                          <YAxis
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={11}
                            tickFormatter={(v) => `${v}%`}
                          />
                          <RTooltip
                            contentStyle={{
                              background: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 6,
                              fontSize: 12,
                            }}
                            formatter={(v: number, name: string) => [fmtPct(v), name]}
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="aproveit" name="Aproveitamento %" radius={[4, 4, 0, 0]}>
                            {crescimento.aproveitChart.map((d, i) => (
                              <Cell
                                key={i}
                                fill={
                                  d.aproveit >= 35 ? "hsl(142 71% 45%)" :
                                  d.aproveit >= 20 ? "hsl(45 93% 47%)" :
                                  "hsl(0 84% 60%)"
                                }
                              />
                            ))}
                          </Bar>
                          <Line type="monotone" dataKey="ma" name="Média móvel (3m)"
                            stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Card 3 — LTV Médio */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <KpiCard
                      icon={<Heart className="h-4 w-4" />}
                      titulo="LTV Médio da Revendedora"
                      valor={fmt(crescimento.ltvMedio)}
                      subtitulo={`Valor médio gerado por revendedora ao longo do tempo · base: ${ltv?.revendedorasCount ?? 0}`}
                      accent="green"
                    />
                    <KpiCard
                      icon={<DollarSign className="h-4 w-4" />}
                      titulo="Receita Total Histórica"
                      valor={fmt(ltv?.receitaTotal ?? 0)}
                      subtitulo="Soma de todas as prestações pagas registradas"
                      accent="neutral"
                    />
                  </div>
                </>
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* SEÇÃO 5 — ALERTAS OPERACIONAIS */}
      <Collapsible open={openAlertas} onOpenChange={setOpenAlertas}>
        <Card>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <span className="font-semibold text-lg">Alertas Operacionais</span>
              </div>
              <ChevronDown className={`h-5 w-5 transition-transform ${openAlertas ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 pt-0">
              {loadingAl ? (
                <Skeleton className="h-48" />
              ) : (
                <AlertasList
                  vencidas30={alertas.vencidas30}
                  campo90={alertas.campo90}
                  repsSem7d={alertas.repsSem7d}
                  repBaixo={alertas.repBaixo}
                  revAcumulo={alertas.revAcumulo}
                  onDrill={setDrill}
                />
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
              {drill?.tipo === "pe_revendedoras" && <DrillRevendedoras rows={drill.rows} />}
              {drill?.tipo === "pe_novas" && <DrillNovasRevendedoras rows={drill.rows} nomeRep={drill.nomeRep} />}
              {drill?.tipo === "pe_rep_notas" && <DrillCobrancas rows={drill.rows} mostrarSaldo />}
              {drill?.tipo === "al_cobrancas" && <DrillCobrancas rows={drill.rows} mostrarSaldo />}
              {drill?.tipo === "al_reps" && <DrillRepsAlerta rows={drill.rows} />}
              {drill?.tipo === "al_revendedoras" && <DrillRevendedorasAcumulo rows={drill.rows} />}
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

function DrillTempo({ rows }: { rows: { cobranca: Cobranca; dias: number }[] }) {
  const media = rows.length > 0 ? rows.reduce((s, r) => s + r.dias, 0) / rows.length : 0;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nota</TableHead>
          <TableHead>Revendedora</TableHead>
          <TableHead className="text-right">Agendada</TableHead>
          <TableHead className="text-right">Quitação</TableHead>
          <TableHead className="text-right">Dias</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem registros</TableCell></TableRow>
        ) : rows.map(r => (
          <TableRow key={r.cobranca.id}>
            <TableCell className="text-xs">{r.cobranca.codigo_nota || "—"}</TableCell>
            <TableCell className="text-sm">{r.cobranca.revendedora || "—"}</TableCell>
            <TableCell className="text-right text-xs">{fmtData(r.cobranca.data_agendada)}</TableCell>
            <TableCell className="text-right text-xs">{fmtData(r.cobranca.data_quitacao || null)}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{r.dias}</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/40 font-semibold">
          <TableCell colSpan={4}>Média ({rows.length})</TableCell>
          <TableCell className="text-right font-mono tabular-nums">{media.toFixed(1)} d</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function DrillAtraso({ rows }: { rows: { cobranca: Cobranca; dias: number; bucket: string }[] }) {
  const sorted = [...rows].sort((a, b) => b.dias - a.dias);
  const totalValor = sorted.reduce((s, r) =>
    s + (Number(r.cobranca.valor_previsto || 0) - Number(r.cobranca.valor_pago_acumulado || 0)), 0
  );
  const corBucket = (b: string) =>
    b === "+60" ? "text-red-600 dark:text-red-400 font-semibold" :
    b === "31-60" ? "text-yellow-600 dark:text-yellow-400" :
    "text-muted-foreground";
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nota</TableHead>
          <TableHead>Revendedora</TableHead>
          <TableHead>Bucket</TableHead>
          <TableHead className="text-right">Dias</TableHead>
          <TableHead className="text-right">Saldo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.length === 0 ? (
          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem notas em atraso</TableCell></TableRow>
        ) : sorted.map(r => {
          const saldo = Number(r.cobranca.valor_previsto || 0) - Number(r.cobranca.valor_pago_acumulado || 0);
          return (
            <TableRow key={r.cobranca.id}>
              <TableCell className="text-xs">{r.cobranca.codigo_nota || "—"}</TableCell>
              <TableCell className="text-sm">{r.cobranca.revendedora || "—"}</TableCell>
              <TableCell className={`text-xs ${corBucket(r.bucket)}`}>{r.bucket} dias</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{r.dias}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{fmt(saldo)}</TableCell>
            </TableRow>
          );
        })}
        <TableRow className="bg-muted/40 font-semibold">
          <TableCell colSpan={4}>Total ({sorted.length})</TableCell>
          <TableCell className="text-right font-mono tabular-nums">{fmt(totalValor)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function DrillPrazo({ rows }: { rows: { cobranca: Cobranca; primeira: string; dias: number }[] }) {
  const sorted = [...rows].sort((a, b) => b.dias - a.dias);
  const media = sorted.length > 0 ? sorted.reduce((s, r) => s + r.dias, 0) / sorted.length : 0;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nota</TableHead>
          <TableHead>Revendedora</TableHead>
          <TableHead className="text-right">Agendada</TableHead>
          <TableHead className="text-right">1º Pagto</TableHead>
          <TableHead className="text-right">Dias</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.length === 0 ? (
          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem registros</TableCell></TableRow>
        ) : sorted.map(r => (
          <TableRow key={r.cobranca.id}>
            <TableCell className="text-xs">{r.cobranca.codigo_nota || "—"}</TableCell>
            <TableCell className="text-sm">{r.cobranca.revendedora || "—"}</TableCell>
            <TableCell className="text-right text-xs">{fmtData(r.cobranca.data_agendada)}</TableCell>
            <TableCell className="text-right text-xs">{fmtData(r.primeira)}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{r.dias}</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/40 font-semibold">
          <TableCell colSpan={4}>Média ({sorted.length})</TableCell>
          <TableCell className="text-right font-mono tabular-nums">{media.toFixed(1)} d</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function DrillRevendedoras({ rows }: { rows: { nome: string; representante: string }[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Revendedora</TableHead>
          <TableHead>Representante</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">Nenhuma revendedora.</TableCell></TableRow>
        ) : rows.map((r, i) => (
          <TableRow key={`${r.nome}-${i}`}>
            <TableCell className="text-sm font-medium">{r.nome}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.representante}</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/40 font-semibold">
          <TableCell colSpan={2}>Total: {rows.length}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function DrillNovasRevendedoras({
  rows, nomeRep,
}: { rows: RevendedoraRow[]; nomeRep: Map<string, string> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Revendedora</TableHead>
          <TableHead>Representante</TableHead>
          <TableHead className="text-right">Cadastrada em</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Nenhuma nova revendedora.</TableCell></TableRow>
        ) : rows.map(r => (
          <TableRow key={r.id}>
            <TableCell className="text-sm font-medium">{r.nome}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {nomeRep.get(r.representante_id ?? "") ?? "—"}
            </TableCell>
            <TableCell className="text-right text-xs">{fmtData(r.criado_em)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/40 font-semibold">
          <TableCell colSpan={3}>Total: {rows.length}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}


// ─── Alertas operacionais ──────────────────────
function AlertasList({
  vencidas30, campo90, repsSem7d, repBaixo, revAcumulo, onDrill,
}: {
  vencidas30: Cobranca[];
  campo90: Cobranca[];
  repsSem7d: { nome: string; detalhe: string }[];
  repBaixo: { nome: string; detalhe: string }[];
  revAcumulo: { nome: string; qtd: number; saldo: number }[];
  onDrill: (d: Drilldown) => void;
}) {
  const valorVencidas30 = vencidas30.reduce(
    (s, c) => s + (Number(c.valor_previsto || 0) - Number(c.valor_pago_acumulado || 0)), 0
  );
  const valorCampo90 = campo90.reduce(
    (s, c) => s + (Number(c.valor_previsto || 0) - Number(c.valor_pago_acumulado || 0)), 0
  );

  type Alerta = {
    nivel: "red" | "yellow" | "green";
    icon: React.ReactNode;
    titulo: string;
    descricao: string;
    qtd: number;
    onClick?: () => void;
  };

  const itens: Alerta[] = [
    {
      nivel: "red",
      icon: <AlertTriangle className="h-4 w-4" />,
      titulo: "Notas vencidas há mais de 30 dias",
      descricao: `${fmt(valorVencidas30)} em saldo aberto`,
      qtd: vencidas30.length,
      onClick: vencidas30.length > 0
        ? () => onDrill({ tipo: "al_cobrancas", titulo: "Notas vencidas há mais de 30 dias", rows: vencidas30 })
        : undefined,
    },
    {
      nivel: "red",
      icon: <Boxes className="h-4 w-4" />,
      titulo: "Kits em campo há mais de 90 dias",
      descricao: `${fmt(valorCampo90)} imobilizado`,
      qtd: campo90.length,
      onClick: campo90.length > 0
        ? () => onDrill({ tipo: "al_cobrancas", titulo: "Kits em campo há mais de 90 dias", rows: campo90 })
        : undefined,
    },
    {
      nivel: "yellow",
      icon: <UserX className="h-4 w-4" />,
      titulo: "Representante sem cobrança há 7 dias",
      descricao: "Representantes ativos sem agendamento recente",
      qtd: repsSem7d.length,
      onClick: repsSem7d.length > 0
        ? () => onDrill({ tipo: "al_reps", titulo: "Representantes sem cobrança nos últimos 7 dias", rows: repsSem7d })
        : undefined,
    },
    {
      nivel: "yellow",
      icon: <Target className="h-4 w-4" />,
      titulo: "Aproveitamento < 20% no mês atual",
      descricao: "Representantes abaixo da meta mínima",
      qtd: repBaixo.length,
      onClick: repBaixo.length > 0
        ? () => onDrill({ tipo: "al_reps", titulo: "Representantes com aproveitamento < 20%", rows: repBaixo })
        : undefined,
    },
    {
      nivel: "yellow",
      icon: <Users className="h-4 w-4" />,
      titulo: "Revendedoras com 2+ notas em aberto",
      descricao: "Risco de acúmulo de dívida",
      qtd: revAcumulo.length,
      onClick: revAcumulo.length > 0
        ? () => onDrill({ tipo: "al_revendedoras", titulo: "Revendedoras com 2+ notas em aberto", rows: revAcumulo })
        : undefined,
    },
  ];

  const ordem = { red: 0, yellow: 1, green: 2 };
  itens.sort((a, b) => (ordem[a.nivel] - ordem[b.nivel]) || (b.qtd - a.qtd));

  const corBadge = (n: "red" | "yellow" | "green") =>
    n === "red"
      ? "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30"
      : n === "yellow"
      ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30"
      : "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";

  const corBorda = (n: "red" | "yellow" | "green") =>
    n === "red" ? "border-l-red-500"
      : n === "yellow" ? "border-l-yellow-500"
      : "border-l-green-500";

  return (
    <div className="space-y-2">
      {itens.map((a, i) => {
        const ativo = a.qtd > 0;
        return (
          <div
            key={i}
            onClick={a.onClick}
            className={`flex items-center gap-3 p-3 rounded-md border border-border border-l-4 ${corBorda(a.nivel)} ${
              a.onClick ? "cursor-pointer hover:bg-muted/40 transition" : ""
            } ${!ativo ? "opacity-60" : ""}`}
          >
            <div className={`p-2 rounded-md ${corBadge(a.nivel)}`}>{a.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{a.titulo}</div>
              <div className="text-xs text-muted-foreground truncate">{a.descricao}</div>
            </div>
            <Badge variant="outline" className={`font-mono tabular-nums ${corBadge(a.nivel)}`}>
              {a.qtd}
            </Badge>
            {a.onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        );
      })}
    </div>
  );
}

function DrillRepsAlerta({ rows }: { rows: { nome: string; detalhe: string }[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Representante</TableHead>
          <TableHead>Detalhe</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">Nenhum.</TableCell></TableRow>
        ) : rows.map((r, i) => (
          <TableRow key={`${r.nome}-${i}`}>
            <TableCell className="text-sm font-medium">{r.nome}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.detalhe}</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/40 font-semibold">
          <TableCell colSpan={2}>Total: {rows.length}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function DrillRevendedorasAcumulo({ rows }: { rows: { nome: string; qtd: number; saldo: number }[] }) {
  const totalSaldo = rows.reduce((s, r) => s + r.saldo, 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Revendedora</TableHead>
          <TableHead className="text-right">Notas em aberto</TableHead>
          <TableHead className="text-right">Saldo total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Nenhuma.</TableCell></TableRow>
        ) : rows.map((r, i) => (
          <TableRow key={`${r.nome}-${i}`}>
            <TableCell className="text-sm font-medium">{r.nome}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{r.qtd}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{fmt(r.saldo)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/40 font-semibold">
          <TableCell colSpan={2}>Total: {rows.length}</TableCell>
          <TableCell className="text-right font-mono tabular-nums">{fmt(totalSaldo)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
