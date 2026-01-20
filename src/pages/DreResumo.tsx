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
  Percent,
  MinusCircle,
  PlusCircle,
  AlertTriangle,
  RefreshCw,
  Wallet,
  BarChart3,
} from "lucide-react";

interface Venda {
  id: string;
  data_execucao: string;
  total_venda: number;
  comissao_valor: number;
  valor_devido_empresa: number;
  valor_pago: number;
  saldo_devedor: number | null;
  cobrancas_agendadas: { tipo: string | null } | null;
}

interface Recuperacao {
  id: string;
  data_execucao: string;
  valor_pago: number;
  cobrancas_agendadas: { tipo: string | null } | null;
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

  // QUERY PRINCIPAL: Vendas (prestacoes_contas) do período
  // Baseado em data_execucao (competência da venda)
  const { data: vendas = [], isLoading: loadingVendas } = useQuery({
    queryKey: ["dre-vendas", anoMes],
    queryFn: async () => {
      const inicioMes = `${anoMes}-01`;
      const fimMes = `${anoMes}-31`;

      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select(`
          id, data_execucao, total_venda, comissao_valor,
          valor_devido_empresa, valor_pago, saldo_devedor,
          cobranca_id,
          cobrancas_agendadas(tipo)
        `)
        .gte("data_execucao", inicioMes)
        .lte("data_execucao", fimMes);

      if (error) throw error;
      return data as Venda[];
    },
  });

  // QUERY RECUPERAÇÃO: Repasses pagos no período cuja venda original é de meses anteriores
  const { data: recuperacao = [] } = useQuery({
    queryKey: ["dre-recuperacao", anoMes],
    queryFn: async () => {
      const inicioMes = `${anoMes}-01`;
      const fimMes = `${anoMes}-31`;

      // Busca prestações de repasses realizadas no período
      const { data, error } = await supabase
        .from("prestacoes_contas")
        .select(`
          id, data_execucao, valor_pago,
          cobrancas_agendadas(tipo)
        `)
        .gte("data_execucao", inicioMes)
        .lte("data_execucao", fimMes);

      if (error) throw error;
      
      // Filtra apenas repasses (recuperação de inadimplência)
      return (data || []).filter(
        (r: Recuperacao) => r.cobrancas_agendadas?.tipo === "repasse"
      ) as Recuperacao[];
    },
  });

  // Fetch cobranças diárias (despesas de cobrança automáticas)
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

  // Cálculos do DRE - Modelo Consignação
  const dre = useMemo(() => {
    // ======== FILTRAR APENAS VENDAS DE KITS ========
    // Repasses NÃO são receita nova, são recuperação de inadimplência
    const vendasKits = vendas.filter(v => 
      v.cobrancas_agendadas?.tipo === "kit" && 
      v.total_venda > 0
    );

    // ======== RECEITA BRUTA ========
    // Soma de TODOS os valores informados em "quanto foi a venda"
    // Baseado em competência (data_execucao), não em pagamento
    const receitaBruta = vendasKits.reduce(
      (sum, v) => sum + Number(v.total_venda || 0), 0
    );

    // ======== COMISSÃO DAS REVENDEDORAS ========
    // Comissão nasce no momento da venda, independente de pagamento
    const comissaoRevendedoras = vendasKits.reduce(
      (sum, v) => sum + Number(v.comissao_valor || 0), 0
    );

    // ======== RECEITA LÍQUIDA TEÓRICA ========
    // O que deveria entrar se todos pagassem
    const receitaLiquidaTeorica = vendasKits.reduce(
      (sum, v) => sum + Number(v.valor_devido_empresa || 0), 0
    );

    // ======== INADIMPLÊNCIA DO PERÍODO ========
    // Saldo devedor das vendas do período
    const inadimplencia = vendasKits.reduce(
      (sum, v) => sum + Number(v.saldo_devedor || 0), 0
    );

    // ======== RECEITA LÍQUIDA REAL (CAIXA) ========
    // O que efetivamente entrou no caixa das vendas do período
    const receitaLiquidaReal = vendasKits.reduce(
      (sum, v) => sum + Number(v.valor_pago || 0), 0
    );

    // ======== RECUPERAÇÃO DE INADIMPLÊNCIA ========
    // Pagamentos de repasses (vendas de meses anteriores)
    // NÃO conta como receita bruta, apenas como entrada de caixa informativa
    const valorRecuperacao = recuperacao.reduce(
      (sum, r) => sum + Number(r.valor_pago || 0), 0
    );

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
    // Baseado na receita que efetivamente entrou (Receita Líquida Real)
    const resultadoOperacional = receitaLiquidaReal - totalDespesas;
    const margemOperacional = receitaLiquidaReal > 0 
      ? (resultadoOperacional / receitaLiquidaReal) * 100 
      : 0;

    // ======== KPIs INFORMATIVOS ========
    const taxaInadimplencia = receitaLiquidaTeorica > 0
      ? (inadimplencia / receitaLiquidaTeorica) * 100
      : 0;

    const comissaoMedia = receitaBruta > 0
      ? (comissaoRevendedoras / receitaBruta) * 100
      : 0;

    return {
      vendas: { quantidade: vendasKits.length },
      receitaBruta,
      comissaoRevendedoras,
      receitaLiquidaTeorica,
      inadimplencia,
      receitaLiquidaReal,
      recuperacao: valorRecuperacao,
      despesasCobranca,
      despesasListadas,
      totalDespesasManuais,
      totalDespesas,
      resultadoOperacional,
      margemOperacional,
      taxaInadimplencia,
      comissaoMedia,
    };
  }, [vendas, recuperacao, cobrancasDiarias, despesasManuais]);

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const isLoading = loadingVendas;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            DRE - Consignação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Demonstração do Resultado por Competência
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
                DRE - {mesLabel} {selectedAno}
              </CardTitle>
              <p className="text-xs text-center text-muted-foreground">
                Modelo de Vendas em Consignação
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* RECEITAS */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
                  <PlusCircle className="h-4 w-4 text-success" />
                  Receitas (por Competência)
                </h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-success/10">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-success" />
                      <span>Receita Bruta - Vendas de Kits</span>
                      <Badge variant="outline" className="text-xs">
                        {dre.vendas.quantidade} vendas
                      </Badge>
                    </div>
                    <span className="font-semibold text-success">
                      {formatCurrency(dre.receitaBruta)}
                    </span>
                  </div>
                </div>

                <Separator className="my-3" />
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 font-semibold">
                  <span>RECEITA BRUTA TOTAL</span>
                  <span className="text-lg">{formatCurrency(dre.receitaBruta)}</span>
                </div>

                <div className="flex items-center justify-between p-3 mt-2 text-destructive">
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    <span>(-) Comissão das Revendedoras</span>
                    <Badge variant="outline" className="text-xs">
                      {dre.comissaoMedia.toFixed(1)}% média
                    </Badge>
                  </div>
                  <span>- {formatCurrency(dre.comissaoRevendedoras)}</span>
                </div>

                <Separator className="my-3" />

                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 font-semibold">
                  <div className="flex flex-col">
                    <span>RECEITA LÍQUIDA TEÓRICA</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      (valor devido à empresa se todos pagassem)
                    </span>
                  </div>
                  <span className="text-lg text-primary">{formatCurrency(dre.receitaLiquidaTeorica)}</span>
                </div>
              </div>

              {/* INADIMPLÊNCIA */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Inadimplência do Período
                </h3>

                <div className="flex items-center justify-between p-3 rounded-lg bg-warning/20 border border-warning/30">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <div className="flex flex-col">
                      <span>Saldo Devedor (não recebido)</span>
                      <span className="text-xs text-muted-foreground">
                        Vendas do período com pagamento pendente
                      </span>
                    </div>
                  </div>
                  <span className="font-semibold text-warning">
                    - {formatCurrency(dre.inadimplencia)}
                  </span>
                </div>

                <Separator className="my-3" />

                <div className="flex items-center justify-between p-4 rounded-lg bg-success/20 border border-success/30 font-semibold">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-success" />
                    <div className="flex flex-col">
                      <span>RECEITA LÍQUIDA REAL</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        (valor que efetivamente entrou no caixa)
                      </span>
                    </div>
                  </div>
                  <span className="text-xl text-success">{formatCurrency(dre.receitaLiquidaReal)}</span>
                </div>
              </div>

              {/* CUSTOS E DESPESAS */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
                  <MinusCircle className="h-4 w-4 text-destructive" />
                  Despesas Operacionais
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
                  <span>TOTAL DESPESAS OPERACIONAIS</span>
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
                    <span className="text-sm text-muted-foreground">
                      Margem sobre Receita Líquida Real
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

          {/* KPIs INFORMATIVOS */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                KPIs Informativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Taxa de Inadimplência */}
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="text-sm text-muted-foreground">Taxa de Inadimplência</span>
                  </div>
                  <span className={`text-2xl font-bold ${
                    dre.taxaInadimplencia > 30 ? "text-destructive" : 
                    dre.taxaInadimplencia > 15 ? "text-warning" : "text-success"
                  }`}>
                    {dre.taxaInadimplencia.toFixed(1)}%
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">
                    do valor devido no período
                  </p>
                </div>

                {/* Recuperação de Inadimplência */}
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <RefreshCw className="h-4 w-4 text-primary" />
                    <span className="text-sm text-muted-foreground">Recuperação de Inadimplência</span>
                  </div>
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(dre.recuperacao)}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">
                    repasses de meses anteriores
                  </p>
                </div>

                {/* Comissão Média */}
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Percent className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Comissão Média</span>
                  </div>
                  <span className="text-2xl font-bold">
                    {dre.comissaoMedia.toFixed(1)}%
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">
                    das revendedoras
                  </p>
                </div>
              </div>

              {/* Nota explicativa */}
              <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-muted">
                <p className="text-xs text-muted-foreground">
                  <strong>Nota:</strong> A "Recuperação de Inadimplência" representa pagamentos de repasses 
                  realizados neste mês, referentes a vendas de meses anteriores. Este valor NÃO é contabilizado 
                  como receita bruta do período atual, pois a venda já foi registrada no mês de competência original.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
