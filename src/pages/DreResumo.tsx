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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  MinusCircle,
  PlusCircle,
} from "lucide-react";

// FONTE FINANCEIRA OFICIAL: cobrancas_diarias.total_cobrado
interface CobrancaDiaria {
  id: string;
  data: string;
  total_cobrado: number | null;
  despesa_cobranca: number | null;
}

interface Despesa {
  id: string;
  categoria_id: string | null;
  valor: number;
  descricao?: string | null;
  contato?: string | null;
  forma_pagamento?: string | null;
  data_pagamento?: string | null;
  data_vencimento?: string | null;
  status?: string | null;
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

export default function DreResumo() {
  const currentDate = new Date();
  const [selectedMes, setSelectedMes] = useState(String(currentDate.getMonth() + 1).padStart(2, "0"));
  const [selectedAno, setSelectedAno] = useState(String(currentDate.getFullYear()));
  const [categoriaDetalhe, setCategoriaDetalhe] = useState<string | null>(null);

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

  // FONTE FINANCEIRA OFICIAL: cobrancas_diarias (fechamentos dos representantes)
  const { data: cobrancasDiarias = [], isLoading: loadingCobrancas } = useQuery({
    queryKey: ["dre-cobrancas-diarias", anoMes],
    queryFn: async () => {
      const inicioMes = `${anoMes}-01`;
      const ultimoDia = new Date(parseInt(selectedAno), parseInt(selectedMes), 0).getDate();
      const fimMes = `${anoMes}-${String(ultimoDia).padStart(2, "0")}`;
      
      const { data, error } = await supabase
        .from("cobrancas_diarias")
        .select("id, data, total_cobrado, despesa_cobranca")
        .gte("data", inicioMes)
        .lte("data", fimMes);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch despesas manuais do DRE
  const { data: despesasManuais = [] } = useQuery({
    queryKey: ["dre-despesas-manuais", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_despesas")
        .select("id, categoria_id, valor, descricao, contato, forma_pagamento, data_pagamento, data_vencimento, status, dre_categorias_despesas(nome)")
        .eq("ano_mes", anoMes);

      if (error) throw error;
      return data as Despesa[];
    },
  });

  // Cálculos do DRE - FONTE FINANCEIRA OFICIAL: cobrancas_diarias.total_cobrado
  const dre = useMemo(() => {
    // ======== RECEITA (TOTAL COBRADO) ========
    // Soma dos fechamentos diários - já líquido, com comissão descontada
    const totalCobrado = cobrancasDiarias.reduce(
      (sum, cd) => sum + Number(cd.total_cobrado || 0), 0
    );
    
    // Quantidade de fechamentos realizados
    const qtdFechamentos = cobrancasDiarias.length;

    // ======== DESPESAS OPERACIONAIS ========
    // Despesas de cobrança (automático do fechamento diário)
    const despesasCobranca = cobrancasDiarias.reduce(
      (sum, cd) => sum + Number(cd.despesa_cobranca || 0), 0
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

    const totalDespesasManuais = despesasManuais.reduce(
      (sum, d) => sum + Number(d.valor), 0
    );
    const totalDespesas = despesasCobranca + totalDespesasManuais;

    // ======== RESULTADO OPERACIONAL ========
    // Resultado = Total Cobrado - Despesas
    const resultadoOperacional = totalCobrado - totalDespesas;
    const margemOperacional = totalCobrado > 0 
      ? (resultadoOperacional / totalCobrado) * 100 
      : 0;

    return {
      totalCobrado,
      qtdFechamentos,
      despesasCobranca,
      despesasListadas,
      totalDespesasManuais,
      totalDespesas,
      resultadoOperacional,
      margemOperacional,
    };
  }, [cobrancasDiarias, despesasManuais]);

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
            DRE - Demonstrativo de Resultado
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Resultado Mensal Consolidado
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
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl text-center">
                {mesLabel} {selectedAno}
              </CardTitle>
              <p className="text-xs text-center text-muted-foreground">
                Baseado nos fechamentos diários dos representantes
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* RECEITA (TOTAL COBRADO) */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
                  <PlusCircle className="h-4 w-4 text-success" />
                  Receita
                </h3>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-success/20 border border-success/30 font-semibold">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-success" />
                    <div className="flex flex-col">
                      <span>TOTAL COBRADO</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Soma dos fechamentos diários ({dre.qtdFechamentos} fechamentos)
                      </span>
                    </div>
                  </div>
                  <span className="text-xl text-success">{formatCurrency(dre.totalCobrado)}</span>
                </div>
              </div>

              {/* SAÍDAS DE CAIXA (DESPESAS) */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
                  <MinusCircle className="h-4 w-4 text-destructive" />
                  Saídas de Caixa (Despesas)
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
                    <button
                      type="button"
                      key={cat.nome}
                      onClick={() => setCategoriaDetalhe(cat.nome)}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors text-left cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        {cat.nome}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <span className="font-medium text-destructive">
                        - {formatCurrency(cat.valor)}
                      </span>
                    </button>
                  ))}

                  {dre.despesasListadas.length === 0 && dre.despesasCobranca === 0 && (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      Nenhuma despesa lançada neste período
                    </div>
                  )}
                </div>

                <Separator className="my-3" />

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 font-semibold">
                  <span>TOTAL DESPESAS</span>
                  <span className="text-lg text-destructive">
                    - {formatCurrency(dre.totalDespesas)}
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
                    <div className="flex flex-col">
                      <span className="font-semibold">RESULTADO</span>
                      <span className="text-xs text-muted-foreground">
                        = Total Cobrado - Total Despesas
                      </span>
                    </div>
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
                    <span className="text-sm text-muted-foreground">
                      Margem sobre Total Cobrado
                    </span>
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

          {/* NOTA EXPLICATIVA */}
          <Card>
            <CardContent className="p-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-muted">
                <p className="text-xs text-muted-foreground">
                  <strong>Fonte Oficial:</strong> Este DRE é baseado exclusivamente nos fechamentos diários 
                  dos representantes (<code>cobrancas_diarias.total_cobrado</code>). O Total Cobrado representa 
                  o valor líquido já com comissão descontada, informado conscientemente pelo representante 
                  no momento do fechamento do dia.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
