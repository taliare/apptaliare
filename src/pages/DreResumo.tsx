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
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
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
type LinhaVariant = "receita" | "deducao" | "aviso" | "subtotal" | "resultado" | "despesa";

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
  const isClickable = !!onClick && valor > 0;

  const valorFormatado =
    variant === "deducao" || variant === "aviso" ? `(${fmt(valor)})` : fmt(valor);

  const corValor =
    variant === "resultado"
      ? valor >= 0 ? "text-green-600" : "text-red-600"
      : variant === "subtotal"
      ? "text-foreground font-bold"
      : variant === "receita"
      ? "text-green-700"
      : variant === "aviso"
      ? "text-orange-500"
      : variant === "despesa"
      ? "text-red-600"
      : "text-foreground";

  const bg =
    variant === "subtotal"
      ? "bg-muted/60"
      : variant === "resultado"
      ? valor >= 0
        ? "bg-green-50 dark:bg-green-950/30"
        : "bg-red-50 dark:bg-red-950/30"
      : "";

  const Wrapper: React.ElementType = isClickable ? "button" : "div";

  return (
    <Wrapper
      onClick={isClickable ? onClick : undefined}
      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-md transition-colors ${bg} ${
        isClickable ? "hover:bg-muted/80 cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icone ?? <div className="w-4" />}
        <div className="min-w-0 text-left">
          <div className={variant === "subtotal" || variant === "resultado" ? "font-semibold" : ""}>
            {label}
          </div>
          {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`font-mono tabular-nums ${corValor}`}>{valorFormatado}</span>
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
  | "em_aberto_anterior"
  | { categoriaId: string; categoriaNome: string }
  | null;

export default function DreResumo() {
  const [ano, setAno] = useState(String(anoAtual));
  const [mes, setMes] = useState(mesAtualStr);
  const [drilldown, setDrilldown] = useState<DrilldownTipo>(null);

  const dataInicio = `${ano}-${mes}-01`;
  const dataFim = `${ano}-${mes}-${String(ultimoDia(ano, mes)).padStart(2, "0")}`;
  const anoMes = `${ano}-${mes}`;

  // Prestações deste mês
  const { data: prestacoes = [], isLoading: loadingPrest } = useQuery({
    queryKey: ["dre_prest_mes", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select(
          "id, cobranca_id, revendedora, total_venda, comissao_valor, valor_devido_empresa, valor_pago, saldo_devedor, data_execucao",
        )
        .gte("data_execucao", dataInicio)
        .lte("data_execucao", dataFim)
        .gt("valor_devido_empresa", 0)
        .order("data_execucao");
      if (error) throw error;
      return (data ?? []) as Prestacao[];
    },
  });

  // Prestações de meses anteriores com saldo aberto
  const { data: prestacoesAbertas = [], isLoading: loadingAbertas } = useQuery({
    queryKey: ["dre_prest_abertas", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select(
          "id, cobranca_id, revendedora, total_venda, comissao_valor, valor_devido_empresa, valor_pago, saldo_devedor, data_execucao",
        )
        .lt("data_execucao", dataInicio)
        .gt("saldo_devedor", 0)
        .order("data_execucao");
      if (error) throw error;
      return (data ?? []) as Prestacao[];
    },
  });

  // Categorias
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

  // Despesas do mês
  const { data: despesas = [], isLoading: loadingDesp } = useQuery({
    queryKey: ["dre_desp_mes", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_despesas")
        .select(
          "id, descricao, valor, forma_pagamento, contato, data_pagamento, observacao, categoria_id, parcela_atual, numero_parcelas",
        )
        .eq("ano_mes", anoMes)
        .eq("status", "pago")
        .order("data_pagamento");
      if (error) throw error;
      return (data ?? []) as Despesa[];
    },
  });

  // Cálculos
  const faturamentoBruto = prestacoes.reduce((s, p) => s + Number(p.total_venda), 0);
  const totalComissoes = prestacoes.reduce((s, p) => s + Number(p.comissao_valor), 0);
  const inadimplencia = prestacoes.reduce((s, p) => s + Number(p.saldo_devedor), 0);
  const receitaLiquida = prestacoes.reduce((s, p) => s + Number(p.valor_pago), 0);

  const totalEmAbertoAnterior = prestacoesAbertas.reduce(
    (s, p) => s + Number(p.saldo_devedor),
    0,
  );

  const totaisPorCategoria: Record<string, number> = {};
  for (const d of despesas) {
    totaisPorCategoria[d.categoria_id] =
      (totaisPorCategoria[d.categoria_id] ?? 0) + Number(d.valor);
  }
  const totalDespesas = Object.values(totaisPorCategoria).reduce((a, b) => a + b, 0);
  const resultado = receitaLiquida - totalDespesas;

  const categoriasComDespesas = categorias
    .filter((c) => (totaisPorCategoria[c.id] ?? 0) > 0)
    .sort((a, b) => (totaisPorCategoria[b.id] ?? 0) - (totaisPorCategoria[a.id] ?? 0));

  const isLoading = loadingPrest || loadingAbertas || loadingDesp;

  // Drilldown
  const drilldownTitle = (() => {
    if (!drilldown) return "";
    if (drilldown === "faturamento") return "Faturamento Bruto";
    if (drilldown === "comissoes") return "Comissões das Revendedoras";
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
          <TableHead className="text-right">Pago</TableHead>
          {mostrarSaldo && <TableHead className="text-right">Saldo</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {lista.map((p) => (
          <TableRow key={p.id}>
            <TableCell>{p.revendedora}</TableCell>
            <TableCell>{fmtData(p.data_execucao)}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {fmt(Number(p.total_venda))}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums text-red-600">
              ({fmt(Number(p.comissao_valor))})
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums text-green-700">
              {fmt(Number(p.valor_pago))}
            </TableCell>
            {mostrarSaldo && (
              <TableCell className="text-right font-mono tabular-nums text-orange-500">
                {fmt(Number(p.saldo_devedor))}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}>Total</TableCell>
          <TableCell className="text-right font-mono tabular-nums">
            {fmt(lista.reduce((s, p) => s + Number(p.total_venda), 0))}
          </TableCell>
          <TableCell className="text-right font-mono tabular-nums text-red-600">
            ({fmt(lista.reduce((s, p) => s + Number(p.comissao_valor), 0))})
          </TableCell>
          <TableCell className="text-right font-mono tabular-nums text-green-700">
            {fmt(lista.reduce((s, p) => s + Number(p.valor_pago), 0))}
          </TableCell>
          {mostrarSaldo && (
            <TableCell className="text-right font-mono tabular-nums text-orange-500">
              {fmt(lista.reduce((s, p) => s + Number(p.saldo_devedor), 0))}
            </TableCell>
          )}
        </TableRow>
      </TableFooter>
    </Table>
  );

  const drilldownContent = (() => {
    if (!drilldown) return null;

    if (drilldown === "faturamento" || drilldown === "comissoes")
      return tabelaPrestacoes(prestacoes, true);

    if (drilldown === "inadimplencia")
      return tabelaPrestacoes(
        prestacoes.filter((p) => Number(p.saldo_devedor) > 0),
        true,
      );

    if (drilldown === "em_aberto_anterior")
      return tabelaPrestacoes(prestacoesAbertas, true);

    if (typeof drilldown === "object") {
      const despesasCat = despesas.filter((d) => d.categoria_id === drilldown.categoriaId);
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
            {despesasCat.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <p className="font-medium">{d.descricao}</p>
                  {d.numero_parcelas && d.numero_parcelas > 1 && (
                    <p className="text-xs text-muted-foreground">
                      Parcela {d.parcela_atual}/{d.numero_parcelas}
                    </p>
                  )}
                  {d.observacao && (
                    <p className="text-xs text-muted-foreground">{d.observacao}</p>
                  )}
                </TableCell>
                <TableCell>{d.contato || "—"}</TableCell>
                <TableCell>
                  {d.forma_pagamento ? (
                    <Badge variant="outline">{d.forma_pagamento}</Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{fmtData(d.data_pagamento)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-red-600">
                  {fmt(Number(d.valor))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4}>Total</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {fmt(totalCat)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      );
    }

    return null;
  })();

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Receipt className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">DRE</h1>
            <p className="text-sm text-muted-foreground">
              Demonstração do Resultado do Exercício
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[140px]">
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
            <SelectTrigger className="w-[100px]">
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
        <>
          <Card>
            <CardContent className="p-2 md:p-4 space-y-1">
              {/* RECEITAS */}
              <div className="px-4 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                icone={<AlertTriangle className="h-4 w-4 text-orange-500" />}
                label="(-) Inadimplência"
                sublabel="Saldo ainda não recebido das prestações deste mês"
                valor={inadimplencia}
                variant="aviso"
                onClick={() => setDrilldown("inadimplencia")}
              />
              <LinhaDRE
                icone={<Equal className="h-4 w-4 text-foreground" />}
                label="(=) Receita Líquida"
                sublabel="Total efetivamente recebido das prestações deste mês"
                valor={receitaLiquida}
                variant="subtotal"
              />

              {/* DESPESAS */}
              <div className="px-4 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Despesas
              </div>
              {categoriasComDespesas.length === 0 ? (
                <div className="px-4 py-6 text-sm text-center text-muted-foreground">
                  Nenhuma despesa paga registrada neste período.
                </div>
              ) : (
                categoriasComDespesas.map((cat) => (
                  <LinhaDRE
                    key={cat.id}
                    icone={<Receipt className="h-4 w-4 text-red-600" />}
                    label={`(-) ${cat.nome}`}
                    valor={totaisPorCategoria[cat.id] ?? 0}
                    variant="despesa"
                    onClick={() =>
                      setDrilldown({ categoriaId: cat.id, categoriaNome: cat.nome })
                    }
                  />
                ))
              )}
              <LinhaDRE
                icone={<Equal className="h-4 w-4 text-foreground" />}
                label="(=) Total Despesas"
                valor={totalDespesas}
                variant="subtotal"
              />

              {/* RESULTADO */}
              <div className="px-4 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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

          {/* Saldo em aberto — meses anteriores */}
          {totalEmAbertoAnterior > 0 && (
            <Card
              className="cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => setDrilldown("em_aberto_anterior")}
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-semibold">Saldo em Aberto — Meses Anteriores</p>
                    <p className="text-xs text-muted-foreground">
                      Revendedoras com dívidas de meses anteriores ainda não pagas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums text-orange-500 font-semibold">
                    {fmt(totalEmAbertoAnterior)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Dialog Drilldown */}
      <Dialog open={!!drilldown} onOpenChange={(open) => !open && setDrilldown(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              {drilldownTitle}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {MESES[Number(mes) - 1]} / {ano}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">{drilldownContent}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
