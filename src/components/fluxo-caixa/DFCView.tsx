import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DialogFooter } from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
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
  LineChart,
  Line,
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
  AlertTriangle,
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
  const queryClient = useQueryClient();

  // Edit/delete state for despesas
  const [editDespesa, setEditDespesa] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ descricao: "", valor: "", data: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteDespesa, setDeleteDespesa] = useState<any | null>(null);
  const [vinculosCount, setVinculosCount] = useState<number>(0);
  const [deleting, setDeleting] = useState(false);

  const invalidarDFC = () => {
    queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("dfc-"),
    });
  };

  const abrirEditDespesa = (d: any) => {
    setEditForm({
      descricao: d.descricao || "",
      valor: String(d.valor ?? ""),
      data: (d.data_pagamento || "").slice(0, 10),
    });
    setEditDespesa(d);
  };

  const salvarEditDespesa = async () => {
    if (!editDespesa) return;
    const descricao = editForm.descricao.trim();
    const valor = Number(editForm.valor);
    const data = editForm.data;
    if (!descricao || !data || !valor || valor <= 0) {
      toast.error("Preencha descrição, valor e data válidos.");
      return;
    }
    setSavingEdit(true);
    try {
      const novoAnoMes = data.slice(0, 7);
      const { error } = await supabase
        .from("dre_despesas")
        .update({
          descricao,
          valor,
          data_pagamento: data,
          data_despesa: data,
          ano_mes: novoAnoMes,
        })
        .eq("id", editDespesa.id);
      if (error) throw error;
      toast.success("Lançamento atualizado.");
      setEditDespesa(null);
      invalidarDFC();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar lançamento.");
    } finally {
      setSavingEdit(false);
    }
  };

  const abrirDeleteDespesa = async (d: any) => {
    setDeleteDespesa(d);
    setVinculosCount(0);
    try {
      const { count } = await supabase
        .from("transacoes_bancarias")
        .select("id", { count: "exact", head: true })
        .eq("despesa_id", d.id);
      setVinculosCount(count || 0);
    } catch {
      // ignora; segue permitindo
    }
  };

  const confirmarDeleteDespesa = async () => {
    if (!deleteDespesa) return;
    setDeleting(true);
    try {
      if (vinculosCount > 0) {
        const { error: unlinkErr } = await supabase
          .from("transacoes_bancarias")
          .update({ despesa_id: null, status_conciliacao: "pendente" })
          .eq("despesa_id", deleteDespesa.id);
        if (unlinkErr) throw unlinkErr;
      }
      const { error } = await supabase
        .from("dre_despesas")
        .delete()
        .eq("id", deleteDespesa.id);
      if (error) throw error;
      toast.success("Lançamento excluído.");
      setDeleteDespesa(null);
      invalidarDFC();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir lançamento.");
    } finally {
      setDeleting(false);
    }
  };


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

  // CONTAS bancárias (para saldo total + chart de saldo acumulado)
  const { data: contas = [] } = useQuery({
    queryKey: ["dfc-contas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contas_bancarias")
        .select("id, nome, saldo_inicial, ativo")
        .eq("ativo", true);
      return data || [];
    },
  });

  // TRANSAÇÕES bancárias (todas até fim do período, para saldo acumulado por conta)
  const { data: transacoesBanco = [] } = useQuery({
    queryKey: ["dfc-transacoes-banco", fimPeriodo],
    queryFn: async () => {
      const { data } = await supabase
        .from("transacoes_bancarias")
        .select("conta_id, data_transacao, valor, tipo, status_conciliacao")
        .lte("data_transacao", fimPeriodo)
        .neq("status_conciliacao", "ignorado");
      return data || [];
    },
  });

  // Créditos do período (para detectar divergências com prestações)
  const creditosPeriodo = useMemo(
    () =>
      (transacoesBanco as any[]).filter(
        (t) =>
          t.tipo === "credito" &&
          t.data_transacao >= inicioPeriodo &&
          t.data_transacao <= fimPeriodo,
      ),
    [transacoesBanco, inicioPeriodo, fimPeriodo],
  );

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

  // Saldo atual de cada conta (saldo_inicial + soma de tudo até hoje)
  const saldosPorConta = useMemo(() => {
    const map = new Map<string, number>();
    contas.forEach((c: any) => map.set(c.id, Number(c.saldo_inicial || 0)));
    (transacoesBanco as any[]).forEach((t) => {
      map.set(t.conta_id, (map.get(t.conta_id) || 0) + Number(t.valor));
    });
    return map;
  }, [contas, transacoesBanco]);

  const saldoTotal = useMemo(
    () => Array.from(saldosPorConta.values()).reduce((s, v) => s + v, 0),
    [saldosPorConta],
  );

  // Dados do gráfico de saldo acumulado por conta ao longo do mês
  const dadosSaldoConta = useMemo(() => {
    // Saldo inicial = saldo_inicial + transações anteriores ao período
    const saldoBase = new Map<string, number>();
    contas.forEach((c: any) => saldoBase.set(c.id, Number(c.saldo_inicial || 0)));
    (transacoesBanco as any[])
      .filter((t) => t.data_transacao < inicioPeriodo)
      .forEach((t) => {
        saldoBase.set(t.conta_id, (saldoBase.get(t.conta_id) || 0) + Number(t.valor));
      });

    // Transações do período por dia/conta
    const porDia: Record<string, Record<string, number>> = {};
    (transacoesBanco as any[])
      .filter((t) => t.data_transacao >= inicioPeriodo && t.data_transacao <= fimPeriodo)
      .forEach((t) => {
        const dia = t.data_transacao.slice(0, 10);
        if (!porDia[dia]) porDia[dia] = {};
        porDia[dia][t.conta_id] = (porDia[dia][t.conta_id] || 0) + Number(t.valor);
      });

    // Acumular dia a dia
    const acumulado: Record<string, number> = {};
    contas.forEach((c: any) => (acumulado[c.id] = saldoBase.get(c.id) || 0));
    const series: any[] = [];
    for (let d = 1; d <= ultimoDiaNum; d++) {
      const diaStr = `${ano}-${mes}-${String(d).padStart(2, "0")}`;
      const movs = porDia[diaStr] || {};
      Object.entries(movs).forEach(([cid, v]) => {
        acumulado[cid] = (acumulado[cid] || 0) + v;
      });
      const row: any = { dia: String(d).padStart(2, "0") };
      contas.forEach((c: any) => (row[c.nome] = Number((acumulado[c.id] || 0).toFixed(2))));
      series.push(row);
    }
    return series;
  }, [contas, transacoesBanco, inicioPeriodo, fimPeriodo, ano, mes, ultimoDiaNum]);

  const CORES_CONTA = [
    "hsl(210 90% 55%)",
    "hsl(280 75% 60%)",
    "hsl(35 90% 55%)",
    "hsl(160 70% 45%)",
    "hsl(340 80% 60%)",
    "hsl(190 80% 50%)",
  ];

  // Divergências: prestações sem correspondência em crédito do extrato (±3 dias, dif < 5%)
  const divergencias = useMemo(() => {
    const addDays = (s: string, n: number) => {
      const [y, mo, d] = s.split("-").map(Number);
      const dt = new Date(y, mo - 1, d + n);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    };
    return prestacoes
      .filter((p: any) => {
        const valor = Number(p.valor_pago || 0);
        if (!valor || !p.data_execucao) return false;
        const dRef = p.data_execucao.slice(0, 10);
        const min = addDays(dRef, -3);
        const max = addDays(dRef, 3);
        const match = creditosPeriodo.find((t: any) => {
          if (t.data_transacao < min || t.data_transacao > max) return false;
          const diff = Math.abs(Number(t.valor) - valor) / valor;
          return diff < 0.05;
        });
        return !match;
      })
      .map((p: any) => ({
        id: p.id,
        revendedora: p.revendedora,
        data: p.data_execucao,
        valor: Number(p.valor_pago),
        representante: nomeRep(p.representante_id),
      }));
  }, [prestacoes, creditosPeriodo, perfis]);

  // ============ PROJEÇÃO 30 DIAS ============
  const hoje = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const hoje30 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  // Últimos 3 meses (anos_mes) para histórico
  const ultimos3MesesAnoMes = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 1; i <= 3; i++) {
      const ref = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push(`${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  }, []);
  const inicio3M = useMemo(() => `${ultimos3MesesAnoMes[2]}-01`, [ultimos3MesesAnoMes]);
  const fim3M = useMemo(() => {
    const [y, m] = ultimos3MesesAnoMes[0].split("-").map(Number);
    const dn = new Date(y, m, 0).getDate();
    return `${ultimos3MesesAnoMes[0]}-${String(dn).padStart(2, "0")}`;
  }, [ultimos3MesesAnoMes]);

  // Cobranças a vencer nos próximos 30 dias
  const { data: cobrancasProj = [] } = useQuery({
    queryKey: ["dfc-proj-cobrancas", hoje, hoje30],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas_agendadas")
        .select("id, data_agendada, valor_previsto, valor_pago_acumulado, valor_adiantado, status")
        .gte("data_agendada", hoje)
        .lte("data_agendada", hoje30)
        .in("status", ["pendente", "parcial"])
        .eq("vigente", true);
      if (error) throw error;
      return data || [];
    },
  });

  // Histórico: cobranças agendadas nos últimos 3 meses (valor_previsto)
  const { data: cobrancasHist = [] } = useQuery({
    queryKey: ["dfc-proj-hist-cobrancas", inicio3M, fim3M],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas_agendadas")
        .select("valor_previsto, valor_pago_acumulado, valor_adiantado")
        .gte("data_agendada", inicio3M)
        .lte("data_agendada", fim3M)
        .eq("vigente", true);
      if (error) throw error;
      return data || [];
    },
  });

  // Despesas pagas nos últimos 3 meses (para média)
  const { data: despesasHist = [] } = useQuery({
    queryKey: ["dfc-proj-hist-despesas", ultimos3MesesAnoMes.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_despesas")
        .select("valor, ano_mes")
        .in("ano_mes", ultimos3MesesAnoMes)
        .eq("status_pagamento", "pago");
      if (error) throw error;
      return data || [];
    },
  });

  // Taxa histórica de adimplência
  const taxaAdimplencia = useMemo(() => {
    const previsto = cobrancasHist.reduce(
      (s: number, c: any) => s + Number(c.valor_previsto || 0),
      0,
    );
    const recebido = cobrancasHist.reduce(
      (s: number, c: any) =>
        s + Number(c.valor_pago_acumulado || 0) + Number(c.valor_adiantado || 0),
      0,
    );
    if (previsto <= 0) return 1;
    return Math.min(1, recebido / previsto);
  }, [cobrancasHist]);

  // Despesas fixas médias (últimos 3 meses)
  const despesasFixasMedia = useMemo(() => {
    const total = despesasHist.reduce((s: number, d: any) => s + Number(d.valor || 0), 0);
    return total / 3;
  }, [despesasHist]);

  // Projeção agrupada por semana (semanas de 7 dias a partir de hoje)
  const projecaoSemanas = useMemo(() => {
    const semanas = [0, 1, 2, 3].map((i) => ({
      semana: `Sem ${i + 1}`,
      previsto: 0,
      realista: 0,
    }));
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    cobrancasProj.forEach((c: any) => {
      const aReceber =
        Number(c.valor_previsto || 0) -
        Number(c.valor_pago_acumulado || 0) -
        Number(c.valor_adiantado || 0);
      if (aReceber <= 0 || !c.data_agendada) return;
      const [y, mo, dd] = c.data_agendada.split("-").map(Number);
      const dt = new Date(y, mo - 1, dd);
      const diff = Math.floor((dt.getTime() - base.getTime()) / 86400000);
      const idx = Math.min(3, Math.max(0, Math.floor(diff / 7)));
      semanas[idx].previsto += aReceber;
      semanas[idx].realista += aReceber * taxaAdimplencia;
    });
    return semanas.map((s) => ({
      ...s,
      previsto: Number(s.previsto.toFixed(2)),
      realista: Number(s.realista.toFixed(2)),
    }));
  }, [cobrancasProj, taxaAdimplencia]);

  const totalPrevisto30 = useMemo(
    () => projecaoSemanas.reduce((s, w) => s + w.previsto, 0),
    [projecaoSemanas],
  );
  const totalRealista30 = useMemo(
    () => projecaoSemanas.reduce((s, w) => s + w.realista, 0),
    [projecaoSemanas],
  );
  const saldoProjetado = saldoTotal + totalRealista30 - despesasFixasMedia;
  const semaforo: "verde" | "amarelo" | "vermelho" =
    saldoProjetado < 0
      ? "vermelho"
      : saldoProjetado > despesasFixasMedia
        ? "verde"
        : "amarelo";
  const semaforoCfg = {
    verde: { cls: "border-l-green-500 bg-green-500/5", text: "text-green-600", label: "Saudável" },
    amarelo: { cls: "border-l-amber-500 bg-amber-500/5", text: "text-amber-600", label: "Atenção" },
    vermelho: { cls: "border-l-red-500 bg-red-500/5", text: "text-red-600", label: "Crítico" },
  }[semaforo];





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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className={`border-l-4 ${saldoTotal >= 0 ? "border-l-blue-500" : "border-l-red-500"}`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Wallet className="h-4 w-4 text-blue-500" /> Saldo Total (Contas)
            </div>
            <div className={`text-2xl font-bold mt-1 ${saldoTotal >= 0 ? "text-blue-600" : "text-red-600"}`}>
              {fmt(saldoTotal)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{contas.length} conta(s)</div>
          </CardContent>
        </Card>
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

      {/* Saldo acumulado por conta */}
      {contas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saldo Acumulado por Conta</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dadosSaldoConta}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="dia" />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                {contas.map((c: any, i: number) => (
                  <Line
                    key={c.id}
                    type="monotone"
                    dataKey={c.nome}
                    stroke={CORES_CONTA[i % CORES_CONTA.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            {transacoesBanco.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Importe extratos OFX para visualizar a evolução do saldo.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Projeção 30 dias */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
            <span>Projeção — Próximos 30 dias</span>
            <span className="text-xs font-normal text-muted-foreground">
              Taxa histórica: <strong>{(taxaAdimplencia * 100).toFixed(1)}%</strong>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Total Previsto (30d)</div>
                <div className="text-xl font-bold text-blue-600 mt-1">{fmt(totalPrevisto30)}</div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Total Realista (30d)</div>
                <div className="text-xl font-bold text-emerald-600 mt-1">{fmt(totalRealista30)}</div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-400">
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Despesas Fixas (média 3m)</div>
                <div className="text-xl font-bold text-red-500 mt-1">{fmt(despesasFixasMedia)}</div>
              </CardContent>
            </Card>
            <Card className={`border-l-4 ${semaforoCfg.cls}`}>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>Saldo Projetado</span>
                  <span className={`text-[10px] font-semibold uppercase ${semaforoCfg.text}`}>
                    {semaforoCfg.label}
                  </span>
                </div>
                <div className={`text-xl font-bold mt-1 ${semaforoCfg.text}`}>
                  {fmt(saldoProjetado)}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Saldo atual + realista − despesas fixas
                </div>
              </CardContent>
            </Card>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={projecaoSemanas}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="semana" />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Bar dataKey="previsto" name="Previsto" fill="hsl(210 90% 55%)" />
              <Bar dataKey="realista" name="Realista" fill="hsl(160 70% 45%)" />
            </BarChart>
          </ResponsiveContainer>

          {cobrancasProj.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhuma cobrança agendada nos próximos 30 dias.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Divergências */}
      <Card className={divergencias.length > 0 ? "border-amber-500/40" : ""}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 ${divergencias.length > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            Divergências ({divergencias.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Prestações de contas pagas no sistema sem crédito correspondente no extrato bancário (±3 dias, diferença &lt; 5%).
          </p>
          {divergencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma divergência detectada no período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Revendedora</TableHead>
                    <TableHead>Representante</TableHead>
                    <TableHead className="text-right">Valor Esperado</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {divergencias.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{fmtData(d.data)}</TableCell>
                      <TableCell>{d.revendedora}</TableCell>
                      <TableCell className="text-xs">{d.representante}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(d.valor)}</TableCell>
                      <TableCell>
                        <span className="text-xs text-amber-600 font-medium">
                          Não encontrado no extrato
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
                    <TableHead className="text-right w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {despesasFiltradas.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell>{fmtData(d.data_pagamento)}</TableCell>
                      <TableCell>{d.descricao}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">{fmt(Number(d.valor))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => abrirEditDespesa(d)}
                            aria-label="Editar despesa"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => abrirDeleteDespesa(d)}
                            aria-label="Excluir despesa"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      {fmt(despesasFiltradas.reduce((s, d: any) => s + Number(d.valor || 0), 0))}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Editar despesa */}
      <Dialog open={!!editDespesa} onOpenChange={(o) => { if (!o) setEditDespesa(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Lançamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={editForm.descricao}
                onChange={(e) => setEditForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.valor}
                  onChange={(e) => setEditForm((f) => ({ ...f, valor: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={editForm.data}
                  onChange={(e) => setEditForm((f) => ({ ...f, data: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDespesa(null)} disabled={savingEdit}>
              Cancelar
            </Button>
            <Button onClick={salvarEditDespesa} disabled={savingEdit}>
              {savingEdit ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir despesa */}
      <AlertDialog open={!!deleteDespesa} onOpenChange={(o) => { if (!o) setDeleteDespesa(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <div>
                  Excluir o lançamento{" "}
                  <span className="font-semibold">"{deleteDespesa?.descricao}"</span> de{" "}
                  <span className="font-semibold">{deleteDespesa ? fmt(Number(deleteDespesa.valor)) : ""}</span> em{" "}
                  <span className="font-semibold">{deleteDespesa ? fmtData(deleteDespesa.data_pagamento) : ""}</span>?
                  Esta ação não pode ser desfeita.
                </div>
                {vinculosCount > 0 && (
                  <div className="text-amber-600 font-medium">
                    ⚠ Este lançamento está conciliado a {vinculosCount} transação(ões) bancária(s).
                    O vínculo será removido (a transação bancária permanece).
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmarDeleteDespesa(); }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

