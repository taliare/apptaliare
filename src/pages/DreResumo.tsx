import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ChevronRight, TrendingDown, DollarSign, Receipt } from "lucide-react";

interface Categoria {
  id: string;
  nome: string;
}

interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  status: string;
  forma_pagamento: string | null;
  contato: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  observacao: string | null;
  ano_mes: string;
  categoria_id: string;
  parcela_atual: number | null;
  numero_parcelas: number | null;
}

const formatarValor = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatarData = (d: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const anoAtual = new Date().getFullYear();
const ANOS = [anoAtual - 1, anoAtual, anoAtual + 1];
const mesAtualStr = (new Date().getMonth() + 1).toString().padStart(2, "0");

export default function DreResumo() {
  const [ano, setAno] = useState(String(anoAtual));
  const [mes, setMes] = useState(mesAtualStr);
  const [categoriaDetalhe, setCategoriaDetalhe] = useState<Categoria | null>(null);

  const anoMesSelecionado = `${ano}-${mes}`;

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

  const { data: despesas = [], isLoading } = useQuery({
    queryKey: ["dre_despesas_resumo", anoMesSelecionado],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_despesas")
        .select(
          "id, descricao, valor, status, forma_pagamento, contato, data_vencimento, data_pagamento, observacao, ano_mes, categoria_id, parcela_atual, numero_parcelas"
        )
        .eq("ano_mes", anoMesSelecionado)
        .eq("status", "pago")
        .order("data_pagamento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Despesa[];
    },
  });

  const { data: despesasDetalhe = [], isLoading: isLoadingDetalhe } = useQuery({
    queryKey: ["dre_despesas_detalhe", anoMesSelecionado, categoriaDetalhe?.id],
    enabled: !!categoriaDetalhe,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_despesas")
        .select(
          "id, descricao, valor, status, forma_pagamento, contato, data_vencimento, data_pagamento, observacao, ano_mes, categoria_id, parcela_atual, numero_parcelas"
        )
        .eq("ano_mes", anoMesSelecionado)
        .eq("categoria_id", categoriaDetalhe!.id)
        .eq("status", "pago")
        .order("data_pagamento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Despesa[];
    },
  });

  const totaisPorCategoria: Record<string, number> = {};
  for (const d of despesas) {
    totaisPorCategoria[d.categoria_id] = (totaisPorCategoria[d.categoria_id] ?? 0) + Number(d.valor);
  }

  const totalGeral = Object.values(totaisPorCategoria).reduce((a, b) => a + b, 0);
  const categoriasComDespesas = categorias.filter((c) => (totaisPorCategoria[c.id] ?? 0) > 0);
  const totalDetalhe = despesasDetalhe.reduce((s, d) => s + Number(d.valor), 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <TrendingDown className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">DRE — Resumo de Despesas</h1>
          <p className="text-sm text-muted-foreground">
            Clique em uma categoria para ver o detalhamento
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Mês:</span>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((nome, i) => {
                    const v = String(i + 1).padStart(2, "0");
                    return (
                      <SelectItem key={v} value={v}>
                        {nome}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Ano:</span>
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

            <Badge variant="outline" className="ml-auto">
              {MESES[Number(mes) - 1]} / {ano}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de categorias */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Despesas por Categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : categoriasComDespesas.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Nenhuma despesa paga encontrada para {MESES[Number(mes) - 1]}/{ano}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 px-3">Categoria</th>
                    <th className="py-2 px-3 text-center">Qtd</th>
                    <th className="py-2 px-3 text-right">Total</th>
                    <th className="py-2 px-3 text-right">% do Total</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {categoriasComDespesas
                    .sort((a, b) => (totaisPorCategoria[b.id] ?? 0) - (totaisPorCategoria[a.id] ?? 0))
                    .map((cat) => {
                      const total = totaisPorCategoria[cat.id] ?? 0;
                      const qtd = despesas.filter((d) => d.categoria_id === cat.id).length;
                      const pct = totalGeral > 0 ? (total / totalGeral) * 100 : 0;
                      return (
                        <tr
                          key={cat.id}
                          onClick={() => setCategoriaDetalhe(cat)}
                          className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors group"
                        >
                          <td className="py-3 px-3 font-medium">{cat.nome}</td>
                          <td className="py-3 px-3 text-center">
                            <Badge variant="secondary">{qtd}</Badge>
                          </td>
                          <td className="py-3 px-3 text-right font-semibold">
                            {formatarValor(total)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-12 text-right">
                                {pct.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary inline" />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold bg-muted/30">
                    <td className="py-3 px-3">Total Geral</td>
                    <td className="py-3 px-3 text-center">
                      <Badge>{despesas.length}</Badge>
                    </td>
                    <td className="py-3 px-3 text-right text-primary">
                      {formatarValor(totalGeral)}
                    </td>
                    <td className="py-3 px-3 text-right">100%</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de detalhe */}
      <Dialog
        open={!!categoriaDetalhe}
        onOpenChange={(open) => !open && setCategoriaDetalhe(null)}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              {categoriaDetalhe?.nome}
              <Badge variant="outline" className="ml-2">
                {MESES[Number(mes) - 1]} / {ano}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {isLoadingDetalhe ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : despesasDetalhe.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                Nenhuma despesa encontrada.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground sticky top-0 bg-background">
                      <th className="py-2 px-3">Descrição</th>
                      <th className="py-2 px-3">Contato</th>
                      <th className="py-2 px-3">Forma Pgto</th>
                      <th className="py-2 px-3">Data Pgto</th>
                      <th className="py-2 px-3 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {despesasDetalhe.map((d) => (
                      <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-3 px-3">
                          <p className="font-medium">{d.descricao}</p>
                          {d.numero_parcelas && d.numero_parcelas > 1 && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              Parcela {d.parcela_atual}/{d.numero_parcelas}
                            </Badge>
                          )}
                          {d.observacao && (
                            <p className="text-xs text-muted-foreground mt-1">{d.observacao}</p>
                          )}
                        </td>
                        <td className="py-3 px-3">{d.contato || "—"}</td>
                        <td className="py-3 px-3">
                          {d.forma_pagamento ? (
                            <Badge variant="secondary">{d.forma_pagamento}</Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3 px-3">{formatarData(d.data_pagamento)}</td>
                        <td className="py-3 px-3 text-right font-semibold">
                          {formatarValor(Number(d.valor))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold bg-muted/30">
                      <td colSpan={4} className="py-3 px-3">
                        Total — {categoriaDetalhe?.nome}
                      </td>
                      <td className="py-3 px-3 text-right text-primary">
                        {formatarValor(totalDetalhe)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
