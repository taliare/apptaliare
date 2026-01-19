import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Package,
  Repeat,
  Percent,
  MinusCircle,
  PlusCircle,
} from "lucide-react";

interface Cobranca {
  id: string;
  tipo: string;
  status: string;
  valor_previsto: number;
  data_agendada: string;
}

interface CobrancaDiaria {
  id: string;
  data: string;
  despesa_cobranca: number | null;
}

interface Despesa {
  id: string;
  categoria_id: string | null;
  valor: number;
  dre_categorias_despesas: { nome: string } | null;
}

const MESES = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

// Taxa de comissão configurável (15%)
const TAXA_COMISSAO_REPRESENTANTES = 0.15;

export default function DreResumo() {
  const currentDate = new Date();
  const [selectedMes, setSelectedMes] = useState(String(currentDate.getMonth() + 1).padStart(2, "0"));
  const [selectedAno, setSelectedAno] = useState(String(currentDate.getFullYear()));

  const anoMes = `${selectedAno}-${selectedMes}`;
  const mesLabel = MESES.find(m => m.value === selectedMes)?.label || "";
  const anos = Array.from({ length: 5 }, (_, i) => String(currentDate.getFullYear() - 2 + i));

  // Navegação entre meses
  const navegarMes = (direcao: 1 | -1) => {
    let novoMes = parseInt(selectedMes) + direcao;
    let novoAno = parseInt(selectedAno);

    if (novoMes > 12) {
      novoMes = 1;
      novoAno += 1;
    } else if (novoMes < 1) {
      novoMes = 12;
      novoAno -= 1;
    }

    setSelectedMes(String(novoMes).padStart(2, "0"));
    setSelectedAno(String(novoAno));
  };

  // Fetch cobranças pagas no período
  const { data: cobrancas = [], isLoading: loadingCobrancas } = useQuery({
    queryKey: ["dre-cobrancas", anoMes],
    queryFn: async () => {
      const inicioMes = `${anoMes}-01`;
      const fimMes = `${anoMes}-31`;

      const { data, error } = await supabase
        .from("cobrancas_agendadas")
        .select("id, tipo, status, valor_previsto, data_agendada")
        .eq("status", "pago")
        .gte("data_agendada", inicioMes)
        .lte("data_agendada", fimMes);

      if (error) throw error;
      return data as Cobranca[];
    },
  });

  // Fetch cobranças diárias (despesas de cobrança)
  const { data: cobrancasDiarias = [] } = useQuery({
    queryKey: ["dre-cobrancas-diarias", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas_diarias")
        .select("id, data, despesa_cobranca")
        .like("data", `${anoMes}%`);

      if (error) throw error;
      return data as CobrancaDiaria[];
    },
  });

  // Fetch despesas manuais do DRE
  const { data: despesasManuais = [] } = useQuery({
    queryKey: ["dre-despesas-manuais", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_despesas")
        .select("id, categoria_id, valor, dre_categorias_despesas(nome)")
        .eq("ano_mes", anoMes);

      if (error) throw error;
      return data as Despesa[];
    },
  });

  // Cálculos do DRE
  const dre = useMemo(() => {
    // Receitas
    const cobrancasKits = cobrancas.filter(c => c.tipo === "kit");
    const cobrancasRepasses = cobrancas.filter(c => c.tipo === "repasse");

    const receitaBrutaKits = cobrancasKits.reduce((sum, c) => sum + (c.valor_previsto || 0), 0);
    const receitaRepasses = cobrancasRepasses.reduce((sum, c) => sum + (c.valor_previsto || 0), 0);
    const receitaBrutaTotal = receitaBrutaKits + receitaRepasses;

    // Comissão de representantes (sobre kits)
    const comissaoRepresentantes = receitaBrutaKits * TAXA_COMISSAO_REPRESENTANTES;

    // Receita líquida
    const receitaLiquida = receitaBrutaTotal - comissaoRepresentantes;

    // Despesas de cobrança (automático)
    const despesasCobranca = cobrancasDiarias.reduce(
      (sum, cd) => sum + (cd.despesa_cobranca || 0),
      0
    );

    // Despesas manuais agrupadas por categoria
    const despesasPorCategoria: Record<string, { nome: string; valor: number }> = {};
    despesasManuais.forEach((d) => {
      const catNome = d.dre_categorias_despesas?.nome || "Sem categoria";
      if (!despesasPorCategoria[catNome]) {
        despesasPorCategoria[catNome] = { nome: catNome, valor: 0 };
      }
      despesasPorCategoria[catNome].valor += Number(d.valor);
    });

    const despesasListadas = Object.values(despesasPorCategoria).sort((a, b) =>
      a.nome.localeCompare(b.nome)
    );

    const totalDespesasManuais = despesasManuais.reduce((sum, d) => sum + Number(d.valor), 0);
    const totalCustosEDespesas = comissaoRepresentantes + despesasCobranca + totalDespesasManuais;

    // Resultado
    const resultadoOperacional = receitaLiquida - despesasCobranca - totalDespesasManuais;
    const margemOperacional = receitaLiquida > 0 
      ? (resultadoOperacional / receitaLiquida) * 100 
      : 0;

    return {
      kits: {
        quantidade: cobrancasKits.length,
        valor: receitaBrutaKits,
      },
      repasses: {
        quantidade: cobrancasRepasses.length,
        valor: receitaRepasses,
      },
      receitaBrutaTotal,
      comissaoRepresentantes,
      receitaLiquida,
      despesasCobranca,
      despesasListadas,
      totalDespesasManuais,
      totalCustosEDespesas,
      resultadoOperacional,
      margemOperacional,
    };
  }, [cobrancas, cobrancasDiarias, despesasManuais]);

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const isLoading = loadingCobrancas;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Resumo DRE
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Demonstração do Resultado do Exercício
          </p>
        </div>
      </div>

      {/* Navegação de Período */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => navegarMes(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Select value={selectedMes} onValueChange={setSelectedMes}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((mes) => (
                    <SelectItem key={mes.value} value={mes.value}>
                      {mes.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedAno} onValueChange={setSelectedAno}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((ano) => (
                    <SelectItem key={ano} value={ano}>
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="icon" onClick={() => navegarMes(1)}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Carregando DRE...
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl text-center">
              DRE - {mesLabel} {selectedAno}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* RECEITAS */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-success" />
                Receitas
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-success/10">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-success" />
                    <span>Receita Bruta Kits</span>
                    <Badge variant="outline" className="text-xs">
                      {dre.kits.quantidade} kits
                    </Badge>
                  </div>
                  <span className="font-semibold text-success">
                    {formatCurrency(dre.kits.valor)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-success/10">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-success" />
                    <span>Receita Repasses</span>
                    <Badge variant="outline" className="text-xs">
                      {dre.repasses.quantidade} repasses
                    </Badge>
                  </div>
                  <span className="font-semibold text-success">
                    {formatCurrency(dre.repasses.valor)}
                  </span>
                </div>
              </div>

              <Separator className="my-3" />
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 font-semibold">
                <span>RECEITA BRUTA TOTAL</span>
                <span className="text-lg">{formatCurrency(dre.receitaBrutaTotal)}</span>
              </div>

              <div className="flex items-center justify-between p-3 mt-2 text-destructive">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  <span>(-) Comissão Representantes ({(TAXA_COMISSAO_REPRESENTANTES * 100).toFixed(0)}%)</span>
                </div>
                <span>- {formatCurrency(dre.comissaoRepresentantes)}</span>
              </div>

              <Separator className="my-3" />

              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 font-semibold">
                <span>RECEITA LÍQUIDA ESTIMADA</span>
                <span className="text-lg text-primary">{formatCurrency(dre.receitaLiquida)}</span>
              </div>
            </div>

            {/* CUSTOS E DESPESAS */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
                <MinusCircle className="h-4 w-4 text-destructive" />
                Custos e Despesas
              </h3>

              <div className="space-y-2">
                {/* Despesas de cobrança (automático) */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10">
                  <div className="flex items-center gap-2">
                    <span>Despesas de cobrança</span>
                    <Badge variant="outline" className="text-xs">automático</Badge>
                  </div>
                  <span className="font-medium text-destructive">
                    - {formatCurrency(dre.despesasCobranca)}
                  </span>
                </div>

                {/* Despesas manuais por categoria */}
                {dre.despesasListadas.map((cat) => (
                  <div
                    key={cat.nome}
                    className="flex items-center justify-between p-3 rounded-lg bg-destructive/10"
                  >
                    <span>{cat.nome}</span>
                    <span className="font-medium text-destructive">
                      - {formatCurrency(cat.valor)}
                    </span>
                  </div>
                ))}

                {dre.despesasListadas.length === 0 && dre.despesasCobranca === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Nenhuma despesa lançada neste período
                  </div>
                )}
              </div>

              <Separator className="my-3" />

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 font-semibold">
                <span>TOTAL CUSTOS E DESPESAS</span>
                <span className="text-lg text-destructive">
                  - {formatCurrency(dre.despesasCobranca + dre.totalDespesasManuais)}
                </span>
              </div>
            </div>

            {/* RESULTADO */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Resultado
              </h3>

              <div
                className={`p-4 rounded-lg ${
                  dre.resultadoOperacional >= 0 ? "bg-success/20" : "bg-destructive/20"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">RESULTADO OPERACIONAL</span>
                  <span
                    className={`text-2xl font-bold flex items-center gap-2 ${
                      dre.resultadoOperacional >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {dre.resultadoOperacional >= 0 ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <TrendingDown className="h-5 w-5" />
                    )}
                    {formatCurrency(dre.resultadoOperacional)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Margem Operacional</span>
                  <Badge
                    variant={dre.margemOperacional >= 0 ? "default" : "destructive"}
                    className="text-sm"
                  >
                    {dre.margemOperacional.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
