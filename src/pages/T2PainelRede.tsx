import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, RefreshCw, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface Metrics {
  revendedorasAtivas: number;
  ciclosAtivos: number;
  totalVendido: number;
  totalAReceber: number;
}

export default function T2PainelRede() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  async function fetchMetrics() {
    setLoading(true);
    try {
      // 1. Ciclos ativos (status ativo ou apurado)
      const { data: ciclos } = await (supabase as any)
        .from("t2_ciclos")
        .select("id, revendedora_id, status, valor_empresa")
        .in("status", ["ativo", "apurado"]);

      const activeCycles = ciclos || [];
      const uniqueResellers = new Set(activeCycles.map((c) => c.revendedora_id));

      // 2. Total vendido (sum de apuracoes.valor_vendido)
      const { data: apuracoes } = await (supabase as any)
        .from("t2_apuracoes")
        .select("valor_vendido");

      const totalVendido = (apuracoes || []).reduce(
        (acc, a) => acc + (a.valor_vendido || 0),
        0
      );

      // 3. Total a receber: para ciclos não encerrados, calcular saldo
      const { data: allNonClosed } = await (supabase as any)
        .from("t2_ciclos")
        .select("id, valor_empresa")
        .neq("status", "encerrado");

      const nonClosedCycles = allNonClosed || [];
      const cycleIds = nonClosedCycles.map((c) => c.id);

      let totalPagamentos = 0;
      let totalAdiantamentos = 0;

      if (cycleIds.length > 0) {
        // Pagamentos via apuracoes
        const { data: apurs } = await (supabase as any)
          .from("t2_apuracoes")
          .select("ciclo_id, id")
          .in("ciclo_id", cycleIds);

        const apurIds = (apurs || []).map((a) => a.id);

        if (apurIds.length > 0) {
          const { data: pags } = await supabase
            .from("t2_pagamentos")
            .select("valor_pago, apuracao_id")
            .in("apuracao_id", apurIds);

          totalPagamentos = (pags || []).reduce(
            (acc, p) => acc + (p.valor_pago || 0),
            0
          );
        }

        const { data: adiants } = await supabase
          .from("t2_adiantamentos")
          .select("valor, ciclo_id")
          .in("ciclo_id", cycleIds);

        totalAdiantamentos = (adiants || []).reduce(
          (acc, a) => acc + (a.valor || 0),
          0
        );
      }

      const totalEmpresa = nonClosedCycles.reduce(
        (acc, c) => acc + (c.valor_empresa || 0),
        0
      );
      const totalAReceber = Math.max(0, totalEmpresa - totalPagamentos - totalAdiantamentos);

      setMetrics({
        revendedorasAtivas: uniqueResellers.size,
        ciclosAtivos: activeCycles.length,
        totalVendido,
        totalAReceber,
      });
    } catch (err) {
      console.error("Erro ao buscar métricas:", err);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const cards = [
    {
      title: "Revendedoras Ativas",
      value: metrics?.revendedorasAtivas ?? 0,
      icon: Users,
      format: (v: number) => String(v),
    },
    {
      title: "Ciclos Ativos",
      value: metrics?.ciclosAtivos ?? 0,
      icon: RefreshCw,
      format: (v: number) => String(v),
    },
    {
      title: "Total Vendido",
      value: metrics?.totalVendido ?? 0,
      icon: TrendingUp,
      format: formatCurrency,
    },
    {
      title: "Total a Receber",
      value: metrics?.totalAReceber ?? 0,
      icon: Wallet,
      format: formatCurrency,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel da Rede</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral da operação TALIARE 2.0
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title} variant="default">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  {card.format(card.value)}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
