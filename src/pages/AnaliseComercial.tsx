import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  TrendingUp,
  Percent,
  Calculator,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { formatarValor } from "@/lib/utils";

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

  // Query 1: Prestações de Contas (Kits) - para faturamento e comissão
  const { data: prestacoesKits, isLoading: loadingKits } = useQuery({
    queryKey: ["analise-prestacoes-kits", inicioMes, fimMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select(`
          id, total_venda, comissao_valor, valor_pago,
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
        .select("id, total_cobrado")
        .gte("data", inicioMes)
        .lte("data", fimMes);
      
      if (error) throw error;
      return data || [];
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
