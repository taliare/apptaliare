import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  DollarSign,
  Receipt,
  Minus,
  Equal,
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
  data_execucao: string;
  status: string;
}

interface Pagamento {
  cobranca_id: string;
  valor: number;
  data_pagamento: string;
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
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
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
type LinhaVariant = "receita" | "deducao" | "recuperacao" | "subtotal" | "resultado" | "despesa";

function LinhaDRE({
  icone,
  label,
  valor,
  variant,
  onClick,
  sublabel,
}: {
  icone?: React.ReactNode;
  label: string;
  valor: number;
  variant: LinhaVariant;
  onClick?: () => void;
  sublabel?: string;
}) {
  const isClickable = !!onClick;

  const valorFormatado = (() => {
    if (variant === "deducao") return `(${fmt(valor)})`;
    if (variant === "recuperacao") return `+ ${fmt(valor)}`;
    return fmt(valor);
  })();

  const corValor = (() => {
    if (variant === "resultado") return valor >= 0 ? "text-green-600" : "text-red-600";
    if (variant === "subtotal") return "text-foreground font-bold";
    if (variant === "receita") return "text-green-700";
    if (variant === "recuperacao") return "text-blue-600";
    if (variant === "deducao") return "text-red-600";
    if (variant === "despesa") return "text-red-600";
    return "text-foreground";
  })();

  const bg = (() => {
    if (variant === "subtotal") return "bg-muted/60";
    if (variant === "resultado")
      return valor >= 0 ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30";
    return "";
  })();

  const Wrapper: any = isClickable ? "button" : "div";

  return (
    <Wrapper
      type={isClickable ? "button" : undefined}
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-lg border border-border/40 ${bg} ${
        isClickable ? "hover:bg-muted/40 transition-colors cursor-pointer text-left" : ""
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icone ? <div className="shrink-0">{icone}</div> : <div className="w-4 shrink-0" />}
        <div className="min-w-0">
          <div className={`text-sm ${variant === "subtotal" || variant === "resultado" ? "font-semibold" : "font-medium"}`}>
            {label}
          </div>
          {sublabel && <div className="text-xs text-muted-foreground">{sublabel}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-sm tabular-nums ${corValor}`}>
          {valorFormatado}
        </span>
        {isClickable && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
    </Wrapper>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
type DrilldownTipo =
  | "faturamento"
  | "comissoes"
  | "inadimplencia"
  | "recuperacao"
  | { categoriaId: string; categoriaNome: string }
  | null;

export default function DreResumo() {
  const [ano, setAno] = useState(String(anoAtual));
  const [mes, setMes] = useState(mesAtualStr);
  const [drilldown, setDrilldown] = useState<DrilldownTipo>(null);

  const dataInicio = `${ano}-${mes}-01`;
  const dataFim = `${ano}-${mes}-${ultimoDia(ano, mes)}`;
  const anoMes = `${ano}-${mes}`;

  // 1. Prestações do mês
  const { data: prestacoes = [], isLoading: loadingPrestacoes } = useQuery({
    queryKey: ["dre_prestacoes", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select("id, cobranca_id, revendedora, total_venda, comissao_valor, valor_devido_empresa, data_execucao, status")
        .gte("data_execucao", dataInicio)
        .lte("data_execucao", dataFim)
        .gt("valor_devido_empresa", 0);
      if (error) throw error;
      return (data ?? []) as Prestacao[];
    },
  });

  const cobrancaIdsDoMes = prestacoes.map((p) => p.cobranca_id).filter(Boolean);

  // 2. Pagamentos do mês para cobranças do mês
  const { data: pagamentosDoMes = [] } = useQuery({
    queryKey: ["dre_pagamentos_mes", anoMes, cobrancaIdsDoMes.join(",")],
    enabled: cobrancaIdsDoMes.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_historico")
        .select("cobranca_id, valor, data_pagamento")
        .gte("data_pagamento", dataInicio)
        .lte("data_pagamento", dataFim)
        .in("cobranca_id", cobrancaIdsDoMes);
      if (error) throw error;
      return (data ?? []) as Pagamento[];
    },
  });

  // 3. Todos pagamentos do mês (para apurar recuperação)
  const { data: todosPagamentosDoMes = [] } = useQuery({
    queryKey: ["dre_pagamentos_todos", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_historico")
        .select("cobranca_id, valor, data_pagamento")
        .gte("data_pagamento", dataInicio)
        .lte("data_pagamento", dataFim);
      if (error) throw error;
      return (data ?? []) as Pagamento[];
    },
  });

  const pagamentosRecuperacao = todosPagamentosDoMes.filter(
    (p) => !cobrancaIdsDoMes.includes(p.cobranca_id),
  );
  const cobrancaIdsRecuperacao = [...new Set(pagamentosRecuperacao.map((p) => p.cobranca_id))];

  // 4. Prestações de recuperação
  const { data: prestacoesRecuperacao = [] } = useQuery({
    queryKey: ["dre_prestacoes_recuperacao", cobrancaIdsRecuperacao.join(",")],
    enabled: cobrancaIdsRecuperacao.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select("id, cobranca_id, revendedora, total_venda, comissao_valor, valor_devido_empresa, data_execucao, status")
        .in("cobranca_id", cobrancaIdsRecuperacao);
      if (error) throw error;
      return (data ?? []) as Prestacao[];
    },
  });

  // 5. Categorias
  const { data: categorias = [] } = useQuery({
    queryKey: ["dre_categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_categorias_despesas")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
  });

  // 6. Despesas do mês
  const { data: despesas = [], isLoading: loadingDespesas } = useQuery({
    queryKey: ["dre_despesas_mes", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_despesas")
        .select("id, descricao, valor, forma_pagamento, contato, data_pagamento, observacao, categoria_id, parcela_atual, numero_parcelas")
        .eq("ano_mes", anoMes)
        .eq("status", "pago")
        .order("data_pagamento");
      if (error) throw error;
      return (data ?? []) as Despesa[];
    },
  });

  // ── Cálculos ──
  const faturamentoBruto = prestacoes.reduce((s, p) => s + Number(p.total_venda), 0);
  const totalComissoes = prestacoes.reduce((s, p) => s + Number(p.comissao_valor), 0);
  const recebidoDoMes = pagamentosDoMes.reduce((s, p) => s + Number(p.valor), 0);
  const totalDevidoDoMes = prestacoes.reduce((s, p) => s + Number(p.valor_devido_empresa), 0);
  const inadimplencia = Math.max(0, totalDevidoDoMes - recebidoDoMes);
  const recuperacao = pagamentosRecuperacao.reduce((s, p) => s + Number(p.valor), 0);
  const receitaLiquida = faturamentoBruto - totalComissoes - inadimplencia + recuperacao;

  const totaisPorCategoria: Record<string, number> = {};
  for (const d of despesas) {
    totaisPorCategoria[d.categoria_id] = (totaisPorCategoria[d.categoria_id] ?? 0) + Number(d.valor);
  }
  const totalDespesas = Object.values(totaisPorCategoria).reduce((a, b) => a + b, 0);
  const resultado = receitaLiquida - totalDespesas;

  const categoriasComDespesas = categorias
    .filter((c) => (totaisPorCategoria[c.id] ?? 0) > 0)
    .sort((a, b) => (totaisPorCategoria[b.id] ?? 0) - (totaisPorCategoria[a.id] ?? 0));

  const isLoading = loadingPrestacoes || loadingDespesas;

  // ── Drilldown ──
  const drilldownTitle = (() => {
    if (!drilldown) return "";
    if (drilldown === "faturamento") return "Faturamento Bruto";
    if (drilldown === "comissoes") return "Comissões das Revendedoras";
    if (drilldown === "inadimplencia") return "Inadimplência";
    if (drilldown === "recuperacao") return "Recuperação de Inadimplência";
    if (typeof drilldown === "object") return drilldown.categoriaNome;
    return "";
  })();

  const drilldownContent = (() => {
    if (!drilldown) return null;

    if (drilldown === "faturamento" || drilldown === "comissoes" || drilldown === "inadimplencia") {
      return (
        <table className="w-full text-xs">
          <thead className="text-muted-foreground border-b">
            <tr>
              <th className="text-left py-2 px-2">Revendedora</th>
              <th className="text-left py-2 px-2">Data</th>
              <th className="text-right py-2 px-2">Venda</th>
              <th className="text-right py-2 px-2">Comissão</th>
              <th className="text-right py-2 px-2">
                {drilldown === "inadimplencia" ? "Saldo Devedor" : "A Receber"}
              </th>
            </tr>
          </thead>
          <tbody>
            {prestacoes.map((p) => {
              const pagoDessa = pagamentosDoMes
                .filter((pg) => pg.cobranca_id === p.cobranca_id)
                .reduce((s, pg) => s + Number(pg.valor), 0);
              const saldoDevedor = Math.max(0, Number(p.valor_devido_empresa) - pagoDessa);
              if (drilldown === "inadimplencia" && saldoDevedor === 0) return null;
              return (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium">{p.revendedora}</td>
                  <td className="py-2 px-2">{fmtData(p.data_execucao)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmt(Number(p.total_venda))}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-red-600">
                    ({fmt(Number(p.comissao_valor))})
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold">
                    {drilldown === "inadimplencia" ? fmt(saldoDevedor) : fmt(Number(p.valor_devido_empresa))}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="font-semibold bg-muted/40">
            <tr>
              <td className="py-2 px-2" colSpan={2}>Total</td>
              <td className="py-2 px-2 text-right tabular-nums">{fmt(faturamentoBruto)}</td>
              <td className="py-2 px-2 text-right tabular-nums text-red-600">({fmt(totalComissoes)})</td>
              <td className="py-2 px-2 text-right tabular-nums">
                {drilldown === "inadimplencia" ? fmt(inadimplencia) : fmt(totalDevidoDoMes)}
              </td>
            </tr>
          </tfoot>
        </table>
      );
    }

    if (drilldown === "recuperacao") {
      const prestacoesMap: Record<string, Prestacao> = {};
      for (const p of prestacoesRecuperacao) prestacoesMap[p.cobranca_id] = p;
      return (
        <table className="w-full text-xs">
          <thead className="text-muted-foreground border-b">
            <tr>
              <th className="text-left py-2 px-2">Revendedora</th>
              <th className="text-left py-2 px-2">Prestação Original</th>
              <th className="text-left py-2 px-2">Data Pgto</th>
              <th className="text-right py-2 px-2">Valor</th>
            </tr>
          </thead>
          <tbody>
            {pagamentosRecuperacao.map((p, i) => {
              const prestacao = prestacoesMap[p.cobranca_id];
              return (
                <tr key={`${p.cobranca_id}-${i}`} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium">{prestacao?.revendedora ?? "—"}</td>
                  <td className="py-2 px-2">{fmtData(prestacao?.data_execucao ?? null)}</td>
                  <td className="py-2 px-2">{fmtData(p.data_pagamento)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-blue-600 font-semibold">
                    {fmt(Number(p.valor))}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="font-semibold bg-muted/40">
            <tr>
              <td className="py-2 px-2" colSpan={3}>Total Recuperado</td>
              <td className="py-2 px-2 text-right tabular-nums text-blue-600">{fmt(recuperacao)}</td>
            </tr>
          </tfoot>
        </table>
      );
    }

    if (typeof drilldown === "object") {
      const despesasCat = despesas.filter((d) => d.categoria_id === drilldown.categoriaId);
      const totalCat = despesasCat.reduce((s, d) => s + Number(d.valor), 0);
      return (
        <table className="w-full text-xs">
          <thead className="text-muted-foreground border-b">
            <tr>
              <th className="text-left py-2 px-2">Descrição</th>
              <th className="text-left py-2 px-2">Contato</th>
              <th className="text-left py-2 px-2">Forma Pgto</th>
              <th className="text-left py-2 px-2">Data Pgto</th>
              <th className="text-right py-2 px-2">Valor</th>
            </tr>
          </thead>
          <tbody>
            {despesasCat.map((d) => (
              <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="py-2 px-2">
                  <div className="font-medium">{d.descricao}</div>
                  {d.numero_parcelas && d.numero_parcelas > 1 && (
                    <div className="text-[10px] text-muted-foreground">
                      Parcela {d.parcela_atual}/{d.numero_parcelas}
                    </div>
                  )}
                  {d.observacao && (
                    <div className="text-[10px] text-muted-foreground">{d.observacao}</div>
                  )}
                </td>
                <td className="py-2 px-2">{d.contato || "—"}</td>
                <td className="py-2 px-2">
                  {d.forma_pagamento ? (
                    <Badge variant="outline" className="text-[10px]">
                      {d.forma_pagamento}
                    </Badge>
                  ) : "—"}
                </td>
                <td className="py-2 px-2">{fmtData(d.data_pagamento)}</td>
                <td className="py-2 px-2 text-right tabular-nums text-red-600 font-semibold">
                  {fmt(Number(d.valor))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="font-semibold bg-muted/40">
            <tr>
              <td className="py-2 px-2" colSpan={4}>Total</td>
              <td className="py-2 px-2 text-right tabular-nums text-red-600">{fmt(totalCat)}</td>
            </tr>
          </tfoot>
        </table>
      );
    }

    return null;
  })();

  // ── Render ──
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Receipt className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">DRE</h1>
            <p className="text-sm text-muted-foreground">
              Demonstração do Resultado do Exercício
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((nome, i) => (
                <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANOS.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-2">
            {/* RECEITAS */}
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2 pb-1">
              Receitas
            </div>

            <LinhaDRE
              icone={<DollarSign className="h-4 w-4 text-green-600" />}
              label="Faturamento Bruto"
              sublabel="Total vendido pelas revendedoras"
              valor={faturamentoBruto}
              variant="receita"
              onClick={faturamentoBruto > 0 ? () => setDrilldown("faturamento") : undefined}
            />

            <LinhaDRE
              icone={<Minus className="h-4 w-4 text-red-600" />}
              label="(-) Comissões das Revendedoras"
              sublabel="Já retidas na prestação de contas"
              valor={totalComissoes}
              variant="deducao"
              onClick={totalComissoes > 0 ? () => setDrilldown("comissoes") : undefined}
            />

            <LinhaDRE
              icone={<AlertTriangle className="h-4 w-4 text-red-600" />}
              label="(-) Inadimplência"
              sublabel="Saldo não recebido nas prestações deste mês"
              valor={inadimplencia}
              variant="deducao"
              onClick={inadimplencia > 0 ? () => setDrilldown("inadimplencia") : undefined}
            />

            {recuperacao > 0 && (
              <LinhaDRE
                icone={<RefreshCw className="h-4 w-4 text-blue-600" />}
                label="(+) Recuperação de Inadimplência"
                sublabel="Pagamentos recebidos de meses anteriores"
                valor={recuperacao}
                variant="recuperacao"
                onClick={() => setDrilldown("recuperacao")}
              />
            )}

            <LinhaDRE
              icone={<Equal className="h-4 w-4" />}
              label="(=) Receita Líquida"
              valor={receitaLiquida}
              variant="subtotal"
            />

            {/* DESPESAS */}
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-4 pb-1">
              Despesas
            </div>

            {categoriasComDespesas.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Nenhuma despesa paga registrada neste período.
              </div>
            ) : (
              categoriasComDespesas.map((cat) => (
                <LinhaDRE
                  key={cat.id}
                  icone={<Minus className="h-4 w-4 text-red-600" />}
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

            {/* RESULTADO */}
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-4 pb-1">
              Resultado
            </div>

            <LinhaDRE
              icone={
                resultado >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )
              }
              label={resultado >= 0 ? "✓ Lucro do Período" : "✗ Prejuízo do Período"}
              valor={Math.abs(resultado)}
              variant="resultado"
            />
          </CardContent>
        </Card>
      )}

      {/* Dialog Drilldown */}
      <Dialog open={!!drilldown} onOpenChange={(open) => !open && setDrilldown(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              {drilldownTitle}
              <Badge variant="outline" className="ml-2">
                {MESES[Number(mes) - 1]} / {ano}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">{drilldownContent}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
