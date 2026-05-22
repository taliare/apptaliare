import { useState, useMemo } from "react";
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
  const parts = d.split("-");
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

  const valorFormatado =
    variant === "deducao" ? `(${fmt(valor)})`
    : variant === "recuperacao" ? `+ ${fmt(valor)}`
    : fmt(valor);

  const corValor =
    variant === "resultado" ? (valor >= 0 ? "text-green-600" : "text-red-600")
    : variant === "subtotal" ? "text-foreground font-bold"
    : variant === "receita" ? "text-green-700"
    : variant === "recuperacao" ? "text-blue-600"
    : "text-red-600";

  const bg =
    variant === "subtotal" ? "bg-muted/60"
    : variant === "resultado"
      ? (valor >= 0 ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30")
    : "";

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
        <span className={`text-sm tabular-nums ${corValor}`}>{valorFormatado}</span>
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
  const dataFim = `${ano}-${mes}-${String(ultimoDia(ano, mes)).padStart(2, "0")}`;
  const anoMes = `${ano}-${mes}`;

  // 1. Todos os pagamentos recebidos neste mês
  const { data: todosPagamentos = [], isLoading: loadingPag } = useQuery({
    queryKey: ["dre_pag_todos", anoMes],
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

  const allCobrancaIds = useMemo(
    () => [...new Set(todosPagamentos.map((p) => p.cobranca_id).filter(Boolean))],
    [todosPagamentos]
  );

  // 2. Prestações relacionadas aos pagamentos (para classificar atual x recuperação)
  const { data: prestacoesTodas = [], isLoading: loadingPrest } = useQuery({
    queryKey: ["dre_prest_todas", allCobrancaIds.join(",")],
    enabled: allCobrancaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select("id, cobranca_id, revendedora, total_venda, comissao_valor, valor_devido_empresa, data_execucao")
        .in("cobranca_id", allCobrancaIds)
        .gt("valor_devido_empresa", 0)
        .order("data_execucao", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Prestacao[];
    },
  });

  // 3. Prestações realizadas NESTE mês (faturamento bruto)
  const { data: prestacoesDoMes = [], isLoading: loadingPrestMes } = useQuery({
    queryKey: ["dre_prest_mes", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select("id, cobranca_id, revendedora, total_venda, comissao_valor, valor_devido_empresa, data_execucao")
        .gte("data_execucao", dataInicio)
        .lte("data_execucao", dataFim)
        .gt("valor_devido_empresa", 0);
      if (error) throw error;
      return (data ?? []) as Prestacao[];
    },
  });

  // 4. Categorias
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

  // 5. Despesas pagas no mês
  const { data: despesas = [], isLoading: loadingDesp } = useQuery({
    queryKey: ["dre_desp_mes", anoMes],
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

  // ── Cálculos principais ──
  const {
    faturamentoBruto,
    totalComissoes,
    totalDevidoDoMes,
    inadimplencia,
    recuperacao,
    receitaLiquida,
    prestacoesDoMesUnicas,
    pagamentosRecuperacao,
    pagamentosDoMesParaAtuais,
  } = useMemo(() => {
    const primeiraPrestMap: Record<string, Prestacao> = {};
    for (const p of prestacoesTodas) {
      if (!primeiraPrestMap[p.cobranca_id]) {
        primeiraPrestMap[p.cobranca_id] = p;
      }
    }

    const pagamentosAtuais: Pagamento[] = [];
    const pagamentosRecup: Pagamento[] = [];
    for (const pag of todosPagamentos) {
      const prest = primeiraPrestMap[pag.cobranca_id];
      if (!prest) continue;
      if (prest.data_execucao >= dataInicio && prest.data_execucao <= dataFim) {
        pagamentosAtuais.push(pag);
      } else if (prest.data_execucao < dataInicio) {
        pagamentosRecup.push(pag);
      }
    }

    const vistas = new Set<string>();
    const prestMesUnicas: Prestacao[] = [];
    for (const p of prestacoesDoMes) {
      if (!vistas.has(p.cobranca_id)) {
        vistas.add(p.cobranca_id);
        prestMesUnicas.push(p);
      }
    }

    const fatBruto = prestMesUnicas.reduce((s, p) => s + Number(p.total_venda), 0);
    const comissoes = prestMesUnicas.reduce((s, p) => s + Number(p.comissao_valor), 0);
    const totalDevido = prestMesUnicas.reduce((s, p) => s + Number(p.valor_devido_empresa), 0);
    const recebidoAtual = pagamentosAtuais.reduce((s, p) => s + Number(p.valor), 0);
    const inadimp = Math.max(0, totalDevido - recebidoAtual);
    const recup = pagamentosRecup.reduce((s, p) => s + Number(p.valor), 0);
    const recLiquida = fatBruto - comissoes - inadimp + recup;

    return {
      faturamentoBruto: fatBruto,
      totalComissoes: comissoes,
      totalDevidoDoMes: totalDevido,
      inadimplencia: inadimp,
      recuperacao: recup,
      receitaLiquida: recLiquida,
      prestacoesDoMesUnicas: prestMesUnicas,
      pagamentosRecuperacao: pagamentosRecup,
      pagamentosDoMesParaAtuais: pagamentosAtuais,
    };
  }, [prestacoesTodas, prestacoesDoMes, todosPagamentos, dataInicio, dataFim]);

  const totaisPorCategoria: Record<string, number> = {};
  for (const d of despesas) {
    totaisPorCategoria[d.categoria_id] = (totaisPorCategoria[d.categoria_id] ?? 0) + Number(d.valor);
  }
  const totalDespesas = Object.values(totaisPorCategoria).reduce((a, b) => a + b, 0);
  const resultado = receitaLiquida - totalDespesas;

  const categoriasComDespesas = categorias
    .filter((c) => (totaisPorCategoria[c.id] ?? 0) > 0)
    .sort((a, b) => (totaisPorCategoria[b.id] ?? 0) - (totaisPorCategoria[a.id] ?? 0));

  const isLoading = loadingPag || loadingPrest || loadingPrestMes || loadingDesp;

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

  const prestacaoMap = useMemo(() => {
    const m: Record<string, Prestacao> = {};
    for (const p of prestacoesTodas) m[p.cobranca_id] = p;
    return m;
  }, [prestacoesTodas]);

  const pagamentosAtuaisPorCobranca = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of pagamentosDoMesParaAtuais) {
      m[p.cobranca_id] = (m[p.cobranca_id] ?? 0) + Number(p.valor);
    }
    return m;
  }, [pagamentosDoMesParaAtuais]);

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
            {prestacoesDoMesUnicas.map((p) => {
              const recebido = pagamentosAtuaisPorCobranca[p.cobranca_id] ?? 0;
              const saldo = Math.max(0, Number(p.valor_devido_empresa) - recebido);
              if (drilldown === "inadimplencia" && saldo === 0) return null;
              return (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium">{p.revendedora}</td>
                  <td className="py-2 px-2">{fmtData(p.data_execucao)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmt(Number(p.total_venda))}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-red-600">
                    ({fmt(Number(p.comissao_valor))})
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold">
                    {drilldown === "inadimplencia" ? fmt(saldo) : fmt(Number(p.valor_devido_empresa))}
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
              const prest = prestacaoMap[p.cobranca_id];
              return (
                <tr key={`${p.cobranca_id}-${i}`} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium">{prest?.revendedora ?? "—"}</td>
                  <td className="py-2 px-2">{fmtData(prest?.data_execucao ?? null)}</td>
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
                    <Badge variant="outline" className="text-[10px]">{d.forma_pagamento}</Badge>
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
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((nome, i) => (
                <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
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

            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-4 pb-1">
              Resultado
            </div>

            <LinhaDRE
              icone={
                resultado >= 0
                  ? <TrendingUp className="h-5 w-5 text-green-600" />
                  : <TrendingDown className="h-5 w-5 text-red-600" />
              }
              label={resultado >= 0 ? "✓ Lucro do Período" : "✗ Prejuízo do Período"}
              valor={Math.abs(resultado)}
              variant="resultado"
            />
          </CardContent>
        </Card>
      )}

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
