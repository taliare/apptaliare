import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ChevronRight,
} from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtData = (d: string | null) => {
  if (!d) return "—";
  const [y, m, dd] = d.split("T")[0].split("-");
  return `${dd}/${m}/${y}`;
};

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const anoAtual = new Date().getFullYear();
const ANOS = [anoAtual - 1, anoAtual, anoAtual + 1];

type DrillType = null | "prestacoes" | "adiantamentos" | "saidas";

export function DFCView() {
  const [ano, setAno] = useState(String(anoAtual));
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [drill, setDrill] = useState<DrillType>(null);

  const inicioPeriodo = `${ano}-${mes}-01`;
  const ultimoDiaNum = new Date(Number(ano), Number(mes), 0).getDate();
  const fimPeriodo = `${ano}-${mes}-${String(ultimoDiaNum).padStart(2, "0")}`;
  const anoMes = `${ano}-${mes}`;

  // ENTRADAS - Prestações de contas
  const { data: prestacoes = [] } = useQuery({
    queryKey: ["dfc-prestacoes", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select("id, representante_id, revendedora, valor_pago, data_execucao, codigo_nota_referencia")
        .gte("data_execucao", inicioPeriodo)
        .lte("data_execucao", fimPeriodo)
        .gt("valor_pago", 0);
      if (error) throw error;
      return data || [];
    },
  });

  // ENTRADAS - Adiantamentos
  const { data: adiantamentos = [] } = useQuery({
    queryKey: ["dfc-adiantamentos", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas_agendadas")
        .select("id, revendedora, codigo_nota, valor_adiantado, data_quitacao, representante_id")
        .gte("data_quitacao", inicioPeriodo)
        .lte("data_quitacao", fimPeriodo)
        .gt("valor_adiantado", 0);
      if (error) throw error;
      return data || [];
    },
  });

  // SAÍDAS - Despesas pagas
  const { data: despesas = [] } = useQuery({
    queryKey: ["dfc-despesas", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_despesas")
        .select("id, descricao, valor, data_pagamento, categoria_id, dre_categorias_despesas(id,nome)")
        .eq("ano_mes", anoMes)
        .eq("status_pagamento", "pago");
      if (error) throw error;
      return data || [];
    },
  });

  // Perfis para nomes de representantes
  const repIds = useMemo(
    () => Array.from(new Set(prestacoes.map((p) => p.representante_id).filter(Boolean))),
    [prestacoes],
  );
  const { data: perfis = [] } = useQuery({
    queryKey: ["dfc-perfis", repIds.sort().join(",")],
    queryFn: async () => {
      if (!repIds.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", repIds as string[]);
      return data || [];
    },
    enabled: repIds.length > 0,
  });
  const nomeRep = (id: string | null) => {
    if (!id) return "—";
    return perfis.find((p: any) => p.id === id)?.nome || "Representante";
  };

  // Saldo inicial = soma de tudo até o dia anterior ao período
  const diaAnterior = new Date(Number(ano), Number(mes) - 1, 0);
  const diaAnteriorStr = `${diaAnterior.getFullYear()}-${String(diaAnterior.getMonth() + 1).padStart(2, "0")}-${String(diaAnterior.getDate()).padStart(2, "0")}`;
  const mesAnterior = `${diaAnterior.getFullYear()}-${String(diaAnterior.getMonth() + 1).padStart(2, "0")}`;

  const { data: saldoInicial = 0 } = useQuery({
    queryKey: ["dfc-saldo-inicial", anoMes],
    queryFn: async () => {
      const [{ data: prest }, { data: adi }, { data: desp }] = await Promise.all([
        supabase
          .from("prestacoes_contas")
          .select("valor_pago")
          .lte("data_execucao", diaAnteriorStr)
          .gt("valor_pago", 0),
        supabase
          .from("cobrancas_agendadas")
          .select("valor_adiantado")
          .lte("data_quitacao", diaAnteriorStr)
          .gt("valor_adiantado", 0),
        supabase
          .from("dre_despesas")
          .select("valor")
          .lte("ano_mes", mesAnterior)
          .eq("status_pagamento", "pago"),
      ]);
      const e1 = (prest || []).reduce((s, r: any) => s + Number(r.valor_pago || 0), 0);
      const e2 = (adi || []).reduce((s, r: any) => s + Number(r.valor_adiantado || 0), 0);
      const s1 = (desp || []).reduce((s, r: any) => s + Number(r.valor || 0), 0);
      return e1 + e2 - s1;
    },
  });

  // Totais
  const totalPrestacoes = useMemo(
    () => prestacoes.reduce((s, p) => s + Number(p.valor_pago || 0), 0),
    [prestacoes],
  );
  const totalAdiantamentos = useMemo(
    () => adiantamentos.reduce((s, a) => s + Number(a.valor_adiantado || 0), 0),
    [adiantamentos],
  );
  const totalEntradas = totalPrestacoes + totalAdiantamentos;
  const totalSaidas = useMemo(
    () => despesas.reduce((s, d) => s + Number(d.valor || 0), 0),
    [despesas],
  );
  const saldoPeriodo = totalEntradas - totalSaidas;
  const saldoFinal = saldoInicial + saldoPeriodo;

  // Prestações agrupadas por representante (para visão da seção)
  const prestacoesPorRep = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; total: number; qtd: number }>();
    prestacoes.forEach((p) => {
      const k = p.representante_id || "sem";
      const cur = map.get(k) || { id: k, nome: nomeRep(p.representante_id), total: 0, qtd: 0 };
      cur.total += Number(p.valor_pago || 0);
      cur.qtd += 1;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [prestacoes, perfis]);

  // Despesas agrupadas por categoria
  const despesasPorCat = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; total: number; qtd: number }>();
    despesas.forEach((d: any) => {
      const k = d.categoria_id || "sem";
      const nome = d.dre_categorias_despesas?.nome || "Sem categoria";
      const cur = map.get(k) || { id: k, nome, total: 0, qtd: 0 };
      cur.total += Number(d.valor || 0);
      cur.qtd += 1;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [despesas]);

  // Drilldown estado
  const [catFiltro, setCatFiltro] = useState<string | null>(null);

  // Dados do gráfico por semana
  const dadosGrafico = useMemo(() => {
    const semanas: Record<number, { semana: string; entradas: number; saidas: number }> = {
      1: { semana: "Sem 1", entradas: 0, saidas: 0 },
      2: { semana: "Sem 2", entradas: 0, saidas: 0 },
      3: { semana: "Sem 3", entradas: 0, saidas: 0 },
      4: { semana: "Sem 4", entradas: 0, saidas: 0 },
      5: { semana: "Sem 5", entradas: 0, saidas: 0 },
    };
    const semanaDoDia = (dataStr: string) => {
      const dia = Number(dataStr.split("T")[0].split("-")[2]);
      return Math.min(5, Math.ceil(dia / 7));
    };
    prestacoes.forEach((p) => {
      if (!p.data_execucao) return;
      const s = semanaDoDia(p.data_execucao);
      semanas[s].entradas += Number(p.valor_pago || 0);
    });
    adiantamentos.forEach((a: any) => {
      if (!a.data_quitacao) return;
      const s = semanaDoDia(a.data_quitacao);
      semanas[s].entradas += Number(a.valor_adiantado || 0);
    });
    despesas.forEach((d: any) => {
      if (!d.data_pagamento) return;
      const s = semanaDoDia(d.data_pagamento);
      semanas[s].saidas += Number(d.valor || 0);
    });
    const lastWeek = Math.ceil(ultimoDiaNum / 7);
    return Object.values(semanas).filter((_, i) => i + 1 <= lastWeek);
  }, [prestacoes, adiantamentos, despesas, ultimoDiaNum]);

  const despesasFiltradas = catFiltro
    ? despesas.filter((d: any) => (d.categoria_id || "sem") === catFiltro)
    : despesas;

  return (
    <div className="space-y-4">
      {/* Seletor de período */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Mês</label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Ano</label>
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANOS.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <TrendingUp className="h-4 w-4 text-green-500" /> Total Entradas
            </div>
            <div className="text-2xl font-bold text-green-600 mt-1">{fmt(totalEntradas)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <TrendingDown className="h-4 w-4 text-red-500" /> Total Saídas
            </div>
            <div className="text-2xl font-bold text-red-600 mt-1">{fmt(totalSaidas)}</div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${saldoPeriodo >= 0 ? "border-l-green-500" : "border-l-red-500"}`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Wallet className="h-4 w-4" /> Saldo do Período
            </div>
            <div className={`text-2xl font-bold mt-1 ${saldoPeriodo >= 0 ? "text-green-600" : "text-red-600"}`}>
              {fmt(saldoPeriodo)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico */}
      <Card>
        <CardHeader><CardTitle className="text-base">Entradas x Saídas por Semana</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dadosGrafico}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="semana" />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Bar dataKey="entradas" name="Entradas" fill="hsl(142 71% 45%)" />
              <Bar dataKey="saidas" name="Saídas" fill="hsl(0 84% 60%)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Entradas */}
      <Card>
        <CardHeader><CardTitle className="text-base text-green-700">Entradas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <button
            onClick={() => setDrill("prestacoes")}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted transition"
          >
            <div className="text-left">
              <div className="font-medium">Prestações de contas pagas</div>
              <div className="text-xs text-muted-foreground">{prestacoes.length} lançamentos</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-green-600">{fmt(totalPrestacoes)}</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </button>
          <button
            onClick={() => setDrill("adiantamentos")}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted transition"
          >
            <div className="text-left">
              <div className="font-medium">Adiantamentos recebidos</div>
              <div className="text-xs text-muted-foreground">{adiantamentos.length} lançamentos</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-green-600">{fmt(totalAdiantamentos)}</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </button>
        </CardContent>
      </Card>

      {/* Saídas */}
      <Card>
        <CardHeader><CardTitle className="text-base text-red-700">Saídas por Categoria</CardTitle></CardHeader>
        <CardContent>
          {despesasPorCat.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma despesa paga no período.</p>
          ) : (
            <div className="space-y-2">
              {despesasPorCat.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCatFiltro(c.id); setDrill("saidas"); }}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted transition"
                >
                  <div className="text-left">
                    <div className="font-medium">{c.nome}</div>
                    <div className="text-xs text-muted-foreground">{c.qtd} lançamentos</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-red-600">{fmt(c.total)}</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saldo acumulado */}
      <Card className="border-primary/30">
        <CardContent className="pt-4">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="text-muted-foreground">Saldo inicial ({fmtData(diaAnteriorStr)})</TableCell>
                <TableCell className="text-right font-medium">{fmt(saldoInicial)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-green-700">(+) Entradas no período</TableCell>
                <TableCell className="text-right font-medium text-green-700">{fmt(totalEntradas)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-red-700">(−) Saídas no período</TableCell>
                <TableCell className="text-right font-medium text-red-700">{fmt(totalSaidas)}</TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Saldo final ({fmtData(fimPeriodo)})</TableCell>
                <TableCell className={`text-right font-bold text-lg ${saldoFinal >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {fmt(saldoFinal)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Drilldown dialog */}
      <Dialog open={drill !== null} onOpenChange={(o) => { if (!o) { setDrill(null); setCatFiltro(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {drill === "prestacoes" && "Prestações de Contas Pagas"}
              {drill === "adiantamentos" && "Adiantamentos Recebidos"}
              {drill === "saidas" && `Saídas - ${despesasPorCat.find((c) => c.id === catFiltro)?.nome || ""}`}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto">
            {drill === "prestacoes" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Representante</TableHead>
                    <TableHead>Revendedora</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prestacoes.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{fmtData(p.data_execucao)}</TableCell>
                      <TableCell>{nomeRep(p.representante_id)}</TableCell>
                      <TableCell>{p.revendedora}</TableCell>
                      <TableCell className="text-xs">{p.codigo_nota_referencia || "—"}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{fmt(Number(p.valor_pago))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold text-green-600">{fmt(totalPrestacoes)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
            {drill === "adiantamentos" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Revendedora</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adiantamentos.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>{fmtData(a.data_quitacao)}</TableCell>
                      <TableCell>{a.revendedora}</TableCell>
                      <TableCell className="text-xs">{a.codigo_nota || "—"}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{fmt(Number(a.valor_adiantado))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold text-green-600">{fmt(totalAdiantamentos)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
            {drill === "saidas" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {despesasFiltradas.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell>{fmtData(d.data_pagamento)}</TableCell>
                      <TableCell>{d.descricao}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">{fmt(Number(d.valor))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      {fmt(despesasFiltradas.reduce((s, d: any) => s + Number(d.valor || 0), 0))}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
