import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronRight,
  DollarSign,
  Receipt,
  Minus,
  Equal,
  Clock,
  FileText,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Categoria {
  id: string;
  nome: string;
}

interface Prestacao {
  id: string;
  cobranca_id: string;
  revendedora: string;
  total_venda: number;
  comissao_valor: number;
  valor_devido_empresa: number;
  valor_pago: number;
  saldo_devedor: number;
  data_execucao: string;
  criado_em: string;
}

interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  forma_pagamento: string | null;
  contato: string | null;
  data_pagamento: string | null;
  observacao: string | null;
  categoria_id: string;
  parcela_atual: number | null;
  numero_parcelas: number | null;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtData = (d: string | null) => {
  if (!d) return "—";
  const parts = d.split("T")[0].split("-");
  if (parts.length < 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const ultimoDia = (ano: string, mes: string) =>
  new Date(Number(ano), Number(mes), 0).getDate();

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const anoAtual = new Date().getFullYear();
const ANOS = [anoAtual - 1, anoAtual, anoAtual + 1];
const mesAtualStr = String(new Date().getMonth() + 1).padStart(2, "0");

// ─────────────────────────────────────────────
// Sub-component: linha do DRE
// ─────────────────────────────────────────────
type LinhaVariant = "receita" | "deducao" | "aviso" | "subtotal" | "resultado" | "despesa";

function LinhaDRE({
  icone, label, valor, variant, onClick, sublabel,
}: {
  icone?: React.ReactNode;
  label: string;
  valor: number;
  variant: LinhaVariant;
  onClick?: () => void;
  sublabel?: string;
}) {
  const isClickable = !!onClick;

  const valorFormatado =
    variant === "deducao" || variant === "aviso" ? `(${fmt(valor)})` : fmt(valor);

  const corValor =
    variant === "resultado" ? (valor >= 0 ? "text-green-600" : "text-red-600")
    : variant === "subtotal" ? "text-foreground font-bold"
    : variant === "receita" ? "text-green-700 dark:text-green-400"
    : variant === "aviso" ? "text-orange-500"
    : "text-red-600 dark:text-red-400";

  const bg =
    variant === "subtotal" ? "bg-muted/60"
    : variant === "resultado"
      ? (valor >= 0 ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30")
    : "";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      className={`w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-border/50 transition-colors ${bg} ${
        isClickable ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icone ?? <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />}
        <div className="text-left min-w-0">
          <div className={`text-sm ${variant === "subtotal" || variant === "resultado" ? "font-semibold" : "font-medium"}`}>
            {label}
          </div>
          {sublabel && <div className="text-xs text-muted-foreground truncate">{sublabel}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-sm md:text-base font-mono tabular-nums ${corValor}`}>
          {valorFormatado}
        </span>
        {isClickable && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
type DrilldownTipo =
  | "faturamento" | "comissoes" | "descontos" | "recuperacao" | "inadimplencia" | "em_aberto_anterior"
  | { categoriaId: string; categoriaNome: string }
  | null;

export default function DreResumo() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [ano, setAno] = useState(String(anoAtual));
  const [mes, setMes] = useState(mesAtualStr);
  const [drilldown, setDrilldown] = useState<DrilldownTipo>(null);

  const dataInicio = `${ano}-${mes}-01`;
  const dataFim = `${ano}-${mes}-${String(ultimoDia(ano, mes)).padStart(2, "0")}`;
  const anoMes = `${ano}-${mes}`;

  // ── 1. Vendas do mês ──
  const { data: vendasDoMes = [], isLoading: loadingVendas } = useQuery({
    queryKey: ["dre_vendas_mes", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select("id, cobranca_id, revendedora, total_venda, comissao_valor, valor_devido_empresa, valor_pago, saldo_devedor, data_execucao, criado_em, cobrancas_agendadas!prestacoes_contas_cobranca_id_fkey(valor_adiantado)")
        .gte("data_execucao", dataInicio)
        .lte("data_execucao", dataFim)
        .gt("comissao_valor", 0)
        .order("data_execucao");
      if (error) throw error;
      return (data ?? []) as Prestacao[];
    },
  });

  const cobrancaIdsDoMes = useMemo(
    () => [...new Set(vendasDoMes.map(v => v.cobranca_id).filter(Boolean))],
    [vendasDoMes]
  );

  // ── 2. Todos registros dessas cobranças (saldo atualizado) ──
  const { data: todosRegistros = [], isLoading: loadingRegistros } = useQuery({
    queryKey: ["dre_todos_registros", cobrancaIdsDoMes.join(",")],
    enabled: cobrancaIdsDoMes.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select("id, cobranca_id, revendedora, total_venda, comissao_valor, valor_devido_empresa, valor_pago, saldo_devedor, data_execucao, criado_em, cobrancas_agendadas!prestacoes_contas_cobranca_id_fkey(valor_adiantado)")
        .in("cobranca_id", cobrancaIdsDoMes)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Prestacao[];
    },
  });

  // ── 3. Recuperação ──
  const { data: registrosRecuperacao = [], isLoading: loadingRecup } = useQuery({
    queryKey: ["dre_recuperacao", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select("id, cobranca_id, revendedora, total_venda, comissao_valor, valor_devido_empresa, valor_pago, saldo_devedor, data_execucao, criado_em, cobrancas_agendadas!prestacoes_contas_cobranca_id_fkey(valor_adiantado)")
        .gte("data_execucao", dataInicio)
        .lte("data_execucao", dataFim)
        .eq("comissao_valor", 0)
        .gt("valor_pago", 0);
      if (error) throw error;
      return (data ?? []) as Prestacao[];
    },
  });

  // ── 4. Saldos em aberto de meses anteriores ──
  const { data: prestacoesAbertas = [], isLoading: loadingAbertas } = useQuery({
    queryKey: ["dre_prest_abertas", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select("id, cobranca_id, revendedora, total_venda, comissao_valor, valor_devido_empresa, valor_pago, saldo_devedor, data_execucao, criado_em, cobrancas_agendadas!prestacoes_contas_cobranca_id_fkey(valor_adiantado)")
        .lt("data_execucao", dataInicio)
        .gt("comissao_valor", 0)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      const latestPorCobranca: Record<string, any> = {};
      for (const p of (data ?? [])) {
        if (!latestPorCobranca[p.cobranca_id]) {
          latestPorCobranca[p.cobranca_id] = p;
        }
      }
      return Object.values(latestPorCobranca).filter((p: any) => Number(p.saldo_devedor) > 0) as Prestacao[];
    },
  });

  // ── 5. Categorias ──
  const { data: categorias = [] } = useQuery({
    queryKey: ["dre_categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_categorias_despesas")
        .select("id, nome")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
  });

  // ── 6. Despesas do mês ──
  const { data: despesas = [], isLoading: loadingDesp } = useQuery({
    queryKey: ["dre_desp_mes", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_despesas")
        .select("id, descricao, valor, forma_pagamento, contato, data_pagamento, observacao, categoria_id, parcela_atual, numero_parcelas")
        .eq("ano_mes", anoMes)
        .eq("status_pagamento", "pago")
        .not("data_pagamento", "is", null)
        .order("data_pagamento");
      if (error) throw error;
      return (data ?? []) as Despesa[];
    },
  });

  // ─────────────────────────────────────────────
  // Cálculos
  // ─────────────────────────────────────────────
  const registrosRecuperacaoFiltrados = useMemo(
    () => registrosRecuperacao.filter(r => !cobrancaIdsDoMes.includes(r.cobranca_id)),
    [registrosRecuperacao, cobrancaIdsDoMes]
  );
  const recuperacao = registrosRecuperacaoFiltrados.reduce((s, r) => s + Number(r.valor_pago), 0);

  const { latestPorCobranca, inadimplenciaNota, receitaLiquida } = useMemo(() => {
    const latest: Record<string, Prestacao> = {};
    for (const r of todosRegistros) {
      if (!latest[r.cobranca_id]) latest[r.cobranca_id] = r;
    }
    const inadimpNota = Object.values(latest).reduce((s, p) => s + Number(p.saldo_devedor), 0);
    const totDevido = vendasDoMes.reduce((s, v) => s + Number(v.valor_devido_empresa), 0);
    const recLiq = Math.max(0, totDevido - inadimpNota);
    return { latestPorCobranca: latest, inadimplenciaNota: inadimpNota, receitaLiquida: recLiq };
  }, [todosRegistros, vendasDoMes]);

  const faturamentoBruto = vendasDoMes.reduce((s, v) => s + Number(v.total_venda), 0);
  const totalComissoes = vendasDoMes.reduce((s, v) => s + Number(v.comissao_valor), 0);
  const totalDevido = vendasDoMes.reduce((s, v) => s + Number(v.valor_devido_empresa), 0);
  const totalAdiantado = vendasDoMes.reduce((s, v) => s + Number((v as any).cobrancas_agendadas?.valor_adiantado || 0), 0);
  const ajustes = Math.max(0, (faturamentoBruto - totalComissoes) - totalAdiantado - totalDevido);
  const inadimplencia = inadimplenciaNota;
  const receitaLiquidaTotal = receitaLiquida + recuperacao;

  const totaisPorCategoria: Record<string, number> = {};
  for (const d of despesas) {
    totaisPorCategoria[d.categoria_id] = (totaisPorCategoria[d.categoria_id] ?? 0) + Number(d.valor);
  }
  const totalDespesas = Object.values(totaisPorCategoria).reduce((a, b) => a + b, 0);
  const resultado = receitaLiquidaTotal - totalDespesas;

  const categoriasComDespesas = categorias
    .filter(c => totaisPorCategoria[c.id] > 0)
    .sort((a, b) => (totaisPorCategoria[b.id] ?? 0) - (totaisPorCategoria[a.id] ?? 0));

  const totalEmAbertoAnterior = prestacoesAbertas.reduce((s, p) => s + Number(p.saldo_devedor), 0);

  const isLoading = loadingVendas || loadingRegistros || loadingAbertas || loadingDesp || loadingRecup;

  // ─────────────────────────────────────────────
  // Drilldowns
  // ─────────────────────────────────────────────
  const drilldownTitle = (() => {
    if (!drilldown) return "";
    if (drilldown === "faturamento") return "Faturamento Bruto";
    if (drilldown === "comissoes") return "Comissões das Revendedoras";
    if (drilldown === "descontos") return "Descontos / Abatimentos";
    if (drilldown === "recuperacao") return "Recuperação de Inadimplência";
    if (drilldown === "inadimplencia") return "Inadimplência do Mês";
    if (drilldown === "em_aberto_anterior") return "Saldo em Aberto — Meses Anteriores";
    if (typeof drilldown === "object") return drilldown.categoriaNome;
    return "";
  })();

  const tabelaPrestacoes = (lista: Prestacao[], mostrarSaldo = false) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Revendedora</TableHead>
          <TableHead>Data</TableHead>
          <TableHead className="text-right">Venda</TableHead>
          <TableHead className="text-right">Comissão</TableHead>
          <TableHead className="text-right">Recebido</TableHead>
          {mostrarSaldo && <TableHead className="text-right">Saldo</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {lista.map(p => {
          const latest = latestPorCobranca[p.cobranca_id] ?? p;
          const saldoAtual = Number(latest.saldo_devedor);
          const recebido = Number(p.valor_devido_empresa) - saldoAtual;
          return (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.revendedora}</TableCell>
              <TableCell>{fmtData(p.data_execucao)}</TableCell>
              <TableCell className="text-right font-mono">{fmt(Number(p.total_venda))}</TableCell>
              <TableCell className="text-right font-mono text-red-600">({fmt(Number(p.comissao_valor))})</TableCell>
              <TableCell className="text-right font-mono text-green-700">{fmt(Math.max(0, recebido))}</TableCell>
              {mostrarSaldo && (
                <TableCell className="text-right font-mono text-orange-500">{fmt(saldoAtual)}</TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}>Total</TableCell>
          <TableCell className="text-right font-mono">{fmt(lista.reduce((s, p) => s + Number(p.total_venda), 0))}</TableCell>
          <TableCell className="text-right font-mono text-red-600">({fmt(lista.reduce((s, p) => s + Number(p.comissao_valor), 0))})</TableCell>
          <TableCell className="text-right font-mono">—</TableCell>
          {mostrarSaldo && <TableCell className="text-right font-mono">—</TableCell>}
        </TableRow>
      </TableFooter>
    </Table>
  );

  const drilldownContent = (() => {
    if (!drilldown) return null;
    if (drilldown === "faturamento" || drilldown === "comissoes") return tabelaPrestacoes(vendasDoMes, true);

    if (drilldown === "descontos") {
      const descontosPorRep: Record<string, { revendedora: string; totalVenda: number; comissao: number; valorDevido: number; desconto: number }> = {};
      for (const p of vendasDoMes) {
        const valorAdiantado = Number((p as any).cobrancas_agendadas?.valor_adiantado || 0);
        const desconto = Number(p.total_venda) - Number(p.comissao_valor) - valorAdiantado - Number(p.valor_devido_empresa);
        if (desconto <= 0) continue;
        if (!descontosPorRep[p.cobranca_id]) {
          descontosPorRep[p.cobranca_id] = {
            revendedora: p.revendedora,
            totalVenda: Number(p.total_venda),
            comissao: Number(p.comissao_valor),
            valorDevido: Number(p.valor_devido_empresa),
            desconto,
          };
        }
      }
      const linhas = Object.values(descontosPorRep).sort((a, b) => b.desconto - a.desconto);
      const totalDesc = linhas.reduce((s, l) => s + l.desconto, 0);
      if (linhas.length === 0) return <p className="text-sm text-muted-foreground py-4">Nenhum desconto registrado.</p>;
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Revendedora</TableHead>
              <TableHead className="text-right">Venda</TableHead>
              <TableHead className="text-right">Comissão</TableHead>
              <TableHead className="text-right">Deveria</TableHead>
              <TableHead className="text-right">Cobrado</TableHead>
              <TableHead className="text-right">Desconto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{l.revendedora}</TableCell>
                <TableCell className="text-right font-mono">{fmt(l.totalVenda)}</TableCell>
                <TableCell className="text-right font-mono text-red-600">({fmt(l.comissao)})</TableCell>
                <TableCell className="text-right font-mono">{fmt(l.totalVenda - l.comissao)}</TableCell>
                <TableCell className="text-right font-mono">{fmt(l.valorDevido)}</TableCell>
                <TableCell className="text-right font-mono text-orange-500">({fmt(l.desconto)})</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5}>Total de Descontos</TableCell>
              <TableCell className="text-right font-mono text-orange-500">({fmt(totalDesc)})</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      );
    }

    if (drilldown === "recuperacao") {
      const totalRecup = registrosRecuperacaoFiltrados.reduce((s, r) => s + Number(r.valor_pago), 0);
      if (registrosRecuperacaoFiltrados.length === 0) return <p className="text-sm text-muted-foreground py-4">Nenhuma recuperação neste mês.</p>;
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Revendedora</TableHead>
              <TableHead>Data Pgto</TableHead>
              <TableHead className="text-right">Valor Recebido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrosRecuperacaoFiltrados.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.revendedora}</TableCell>
                <TableCell>{fmtData(r.data_execucao)}</TableCell>
                <TableCell className="text-right font-mono text-green-700">{fmt(Number(r.valor_pago))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>Total Recuperado</TableCell>
              <TableCell className="text-right font-mono text-green-700">{fmt(totalRecup)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      );
    }

    if (drilldown === "inadimplencia") {
      const comSaldo = vendasDoMes.filter(p => {
        const latest = latestPorCobranca[p.cobranca_id] ?? p;
        return Number(latest.saldo_devedor) > 0;
      });
      if (comSaldo.length === 0) return <p className="text-sm text-muted-foreground py-4">Sem inadimplência neste mês.</p>;
      return tabelaPrestacoes(comSaldo, true);
    }

    if (drilldown === "em_aberto_anterior") return tabelaPrestacoes(prestacoesAbertas, true);

    if (typeof drilldown === "object") {
      const despesasCat = despesas.filter(d => d.categoria_id === drilldown.categoriaId);
      const totalCat = despesasCat.reduce((s, d) => s + Number(d.valor), 0);
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Forma Pgto</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {despesasCat.map(d => (
              <TableRow key={d.id}>
                <TableCell>
                  <p className="font-medium">{d.descricao}</p>
                  {d.numero_parcelas && d.numero_parcelas > 1 && (
                    <p className="text-xs text-muted-foreground">Parcela {d.parcela_atual}/{d.numero_parcelas}</p>
                  )}
                  {d.observacao && <p className="text-xs text-muted-foreground">{d.observacao}</p>}
                </TableCell>
                <TableCell>{d.contato || "—"}</TableCell>
                <TableCell>
                  {d.forma_pagamento ? <Badge variant="outline">{d.forma_pagamento}</Badge> : "—"}
                </TableCell>
                <TableCell>{fmtData(d.data_pagamento)}</TableCell>
                <TableCell className="text-right font-mono text-red-600">{fmt(Number(d.valor))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4}>Total</TableCell>
              <TableCell className="text-right font-mono text-red-600">{fmt(totalCat)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      );
    }
    return null;
  })();

  // ─────────────────────────────────────────────
  // Exportar PDF
  // ─────────────────────────────────────────────
  const handleExportPdf = () => {
    const mesNome = MESES[Number(mes) - 1];
    const escapeHtml = (s: string) =>
      s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
    const dataGeracao = new Date().toLocaleString("pt-BR");

    const linhas: string[] = [];
    linhas.push(`<tr><td>Faturamento Bruto</td><td class="r pos">${fmt(faturamentoBruto)}</td></tr>`);
    linhas.push(`<tr><td>(-) Comissões das Revendedoras</td><td class="r neg">(${fmt(totalComissoes)})</td></tr>`);
    linhas.push(`<tr><td>(-) Descontos / Abatimentos</td><td class="r neg">(${fmt(ajustes)})</td></tr>`);
    linhas.push(`<tr><td>(-) Inadimplência do Mês</td><td class="r warn">(${fmt(inadimplencia)})</td></tr>`);
    if (recuperacao > 0) {
      linhas.push(`<tr><td>(+) Recuperação de Inadimplência</td><td class="r pos">${fmt(recuperacao)}</td></tr>`);
    }
    linhas.push(`<tr class="sub"><td>(=) Receita Líquida</td><td class="r">${fmt(receitaLiquidaTotal)}</td></tr>`);

    const despLinhas = categoriasComDespesas
      .map(c => `<tr><td>(-) ${escapeHtml(c.nome)}</td><td class="r neg">(${fmt(totaisPorCategoria[c.id] ?? 0)})</td></tr>`)
      .join("");

    const corResultado = resultado >= 0 ? "pos" : "neg";

    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>DRE — ${mesNome} de ${ano}</title>
      <style>
        @page { size: A4; margin: 18mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 16px; }
        h1 { margin: 0 0 4px; font-size: 22px; }
        .meta { color: #666; font-size: 12px; margin-bottom: 18px; }
        h2 { font-size: 14px; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #ccc; text-transform: uppercase; letter-spacing: 0.5px; color: #444; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        td { padding: 8px 10px; border-bottom: 1px solid #eee; }
        td.r { text-align: right; font-family: 'Courier New', monospace; white-space: nowrap; }
        tr.sub td { background: #f5f5f5; font-weight: bold; }
        tr.result td { background: #f0f0f0; font-weight: bold; font-size: 15px; padding: 12px 10px; }
        .pos { color: #117a3a; }
        .neg { color: #b91c1c; }
        .warn { color: #c2660b; }
        .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 11px; color: #888; text-align: center; }
        @media print { body { padding: 0; } }
      </style></head><body>
        <h1>DRE — ${mesNome} de ${ano}</h1>
        <div class="meta">Demonstração do Resultado do Exercício · Gerado em ${escapeHtml(dataGeracao)}</div>

        <h2>Receitas</h2>
        <table>${linhas.join("")}</table>

        <h2>Despesas</h2>
        <table>
          ${despLinhas || `<tr><td colspan="2" style="color:#888;text-align:center;">Nenhuma despesa paga registrada.</td></tr>`}
          <tr class="sub"><td>(=) Total Despesas</td><td class="r">(${fmt(totalDespesas)})</td></tr>
        </table>

        <h2>Resultado</h2>
        <table>
          <tr class="result"><td>(=) ${resultado >= 0 ? "Lucro do Período" : "Prejuízo do Período"}</td><td class="r ${corResultado}">${fmt(Math.abs(resultado))}</td></tr>
        </table>

        ${totalEmAbertoAnterior > 0 ? `
          <h2>Saldo em Aberto — Meses Anteriores</h2>
          <table>
            <tr><td>Total em aberto de meses anteriores</td><td class="r warn">${fmt(totalEmAbertoAnterior)}</td></tr>
          </table>
        ` : ""}

        <div class="footer">Taliare Semijoias — Confidencial</div>
      </body></html>
    `;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 300);
    }
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="space-y-4 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">DRE</h1>
            <p className="text-xs text-muted-foreground">Demonstração do Resultado do Exercício</p>
          </div>
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
              {ANOS.map(a => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-center py-12 text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="px-4 py-2 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b">
                Receitas
              </div>

              <LinhaDRE
                icone={<TrendingUp className="h-4 w-4 text-green-600" />}
                label="Faturamento Bruto"
                sublabel="Total vendido pelas revendedoras neste mês"
                valor={faturamentoBruto}
                variant="receita"
                onClick={() => setDrilldown("faturamento")}
              />
              <LinhaDRE
                icone={<Minus className="h-4 w-4 text-red-600" />}
                label="(-) Comissões das Revendedoras"
                sublabel="Já retidas na prestação de contas"
                valor={totalComissoes}
                variant="deducao"
                onClick={() => setDrilldown("comissoes")}
              />
              <LinhaDRE
                icone={<Minus className="h-4 w-4 text-orange-500" />}
                label="(-) Descontos / Abatimentos"
                sublabel={ajustes > 0 ? "Clique para ver por representante" : "Nenhum desconto registrado"}
                valor={ajustes}
                variant="deducao"
                onClick={ajustes > 0 ? () => setDrilldown("descontos") : undefined}
              />
              {recuperacao > 0 && (
                <LinhaDRE
                  icone={<TrendingUp className="h-4 w-4 text-green-600" />}
                  label="(+) Recuperação de Inadimplência"
                  sublabel="Recebimentos de dívidas de meses anteriores"
                  valor={recuperacao}
                  variant="receita"
                  onClick={() => setDrilldown("recuperacao")}
                />
              )}
              <LinhaDRE
                icone={<AlertTriangle className="h-4 w-4 text-orange-500" />}
                label="(-) Inadimplência"
                sublabel="Saldo em aberto das notas deste mês"
                valor={inadimplencia}
                variant="aviso"
                onClick={inadimplencia > 0 ? () => setDrilldown("inadimplencia") : undefined}
              />
              <LinhaDRE
                icone={<Equal className="h-4 w-4" />}
                label="(=) Receita Líquida"
                sublabel="Total efetivamente recebido no mês"
                valor={receitaLiquidaTotal}
                variant="subtotal"
              />

              <div className="px-4 py-2 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-t">
                Despesas
              </div>

              {categoriasComDespesas.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                  Nenhuma despesa paga registrada neste período.
                </p>
              ) : (
                categoriasComDespesas.map(cat => (
                  <LinhaDRE
                    key={cat.id}
                    icone={<Receipt className="h-4 w-4 text-red-600" />}
                    label={`(-) ${cat.nome}`}
                    valor={totaisPorCategoria[cat.id] ?? 0}
                    variant="despesa"
                    onClick={() => setDrilldown({ categoriaId: cat.id, categoriaNome: cat.nome })}
                  />
                ))
              )}

              <LinhaDRE
                icone={<Equal className="h-4 w-4" />}
                label="(=) Total Despesas"
                valor={totalDespesas}
                variant="subtotal"
              />

              <div className="px-4 py-2 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-t">
                Resultado
              </div>

              <LinhaDRE
                icone={resultado >= 0
                  ? <TrendingUp className="h-5 w-5 text-green-600" />
                  : <TrendingDown className="h-5 w-5 text-red-600" />}
                label={resultado >= 0 ? "✓ Lucro do Período" : "✗ Prejuízo do Período"}
                valor={Math.abs(resultado)}
                variant="resultado"
              />
            </CardContent>
          </Card>

          {totalEmAbertoAnterior > 0 && (
            <Card
              className="cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => setDrilldown("em_aberto_anterior")}
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Clock className="h-5 w-5 text-orange-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">Saldo em Aberto — Meses Anteriores</p>
                    <p className="text-xs text-muted-foreground">
                      Revendedoras com dívidas de meses anteriores ainda não pagas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-semibold text-orange-500">{fmt(totalEmAbertoAnterior)}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Dialog Drilldown */}
      <Dialog open={!!drilldown} onOpenChange={(open) => !open && setDrilldown(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {drilldownTitle}
              <Badge variant="outline" className="ml-2">{MESES[Number(mes) - 1]} / {ano}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            {drilldownContent}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
