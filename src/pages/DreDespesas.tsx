import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Plus, Receipt, Pencil, Trash2, CheckCircle2, RotateCcw,
  MessageSquare, Sparkles, ChevronUp, ChevronDown, ChevronsUpDown,
  Search, Filter, SlidersHorizontal,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatarValor } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────── */
interface Categoria { id: string; nome: string }
interface Profile { id: string; nome: string }

interface Despesa {
  id: string;
  categoria_id: string | null;
  ano_mes: string;
  valor: number;
  status: string;
  descricao: string | null;
  observacao: string | null;
  forma_pagamento: string | null;
  ocorrencia: string | null;
  numero_parcelas: number | null;
  parcela_atual: number | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  data_despesa: string | null;
  contato: string | null;
  dia_vencimento_mensal: number | null;
  dia_semana: string | null;
  data_limite_recorrencia: string | null;
  desconto: number | null;
  acrescimo: number | null;
  criado_em: string;
  dre_categorias_despesas: Categoria | null;
}

/* ─── Constants ──────────────────────────────────────────── */
const MESES = [
  { value: "01", label: "Janeiro" }, { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },   { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },    { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },   { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },{ value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },{ value: "12", label: "Dezembro" },
];
const FORMAS_PAGAMENTO = ["Dinheiro","PIX","Boleto","Cartão de Crédito","Cartão de Débito","Transferência","Débito Automático","Cheque"];
const OCORRENCIAS = [
  { value: "unico", label: "Único" },
  { value: "mensal", label: "Mensal" },
  { value: "parcelado", label: "Parcelado" },
  { value: "anual", label: "Anual" },
  { value: "semanal", label: "Semanal" },
];

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "");

const CATEGORIA_KEYWORDS: { keyword: string; catFragment: string }[] = [
  { keyword: "folha", catFragment: "folha" }, { keyword: "salario", catFragment: "folha" },
  { keyword: "funcionario", catFragment: "folha" }, { keyword: "rescisao", catFragment: "folha" },
  { keyword: "pro labore", catFragment: "labore" }, { keyword: "prolabore", catFragment: "labore" },
  { keyword: "retirada", catFragment: "labore" }, { keyword: "socio", catFragment: "labore" },
  { keyword: "vale", catFragment: "vale" }, { keyword: "alimentacao", catFragment: "vale" },
  { keyword: "refeicao", catFragment: "vale" }, { keyword: "transporte", catFragment: "vale" },
  { keyword: "fornecedor", catFragment: "fornecedor" }, { keyword: "insumo", catFragment: "fornecedor" },
  { keyword: "compra", catFragment: "fornecedor" }, { keyword: "embalagem", catFragment: "fornecedor" },
  { keyword: "comissao", catFragment: "comiss" }, { keyword: "representante", catFragment: "comiss" },
  { keyword: "bancaria", catFragment: "banc" }, { keyword: "banco", catFragment: "banc" },
  { keyword: "tarifa", catFragment: "banc" }, { keyword: "iof", catFragment: "banc" },
  { keyword: "juros", catFragment: "banc" }, { keyword: "ted", catFragment: "banc" },
  { keyword: "imposto", catFragment: "imposto" }, { keyword: "tributo", catFragment: "imposto" },
  { keyword: "das ", catFragment: "imposto" }, { keyword: "inss", catFragment: "imposto" },
  { keyword: "simples", catFragment: "imposto" }, { keyword: "irpf", catFragment: "imposto" },
  { keyword: "aluguel", catFragment: "empresa" }, { keyword: "agua", catFragment: "empresa" },
  { keyword: "energia", catFragment: "empresa" }, { keyword: "internet", catFragment: "empresa" },
  { keyword: "telefone", catFragment: "empresa" }, { keyword: "contador", catFragment: "empresa" },
  { keyword: "sistema", catFragment: "empresa" }, { keyword: "marketing", catFragment: "empresa" },
  { keyword: "frete", catFragment: "empresa" }, { keyword: "seguro", catFragment: "empresa" },
];

const DIAS_SEMANA_NUM: Record<string, number> = {
  domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
};

const gerarDatasRecorrentes = (
  ocorrencia: string,
  diaSemanaVal: string,
  diaVencMensal: number | null,
  anoMesInicial: string,
  dataLimite: string | null
): { data_vencimento: string; ano_mes: string }[] => {
  const [ano, mes] = anoMesInicial.split("-").map(Number);
  const inicio = new Date(ano, mes - 1, 1);
  const fim = dataLimite
    ? new Date(dataLimite + "T23:59:59")
    : new Date(ano, mes, 0, 23, 59, 59);
  const results: { data_vencimento: string; ano_mes: string }[] = [];

  if (ocorrencia === "mensal" && diaVencMensal) {
    let cur = new Date(ano, mes - 1, diaVencMensal);
    while (cur <= fim) {
      const am = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      results.push({ data_vencimento: format(cur, "yyyy-MM-dd"), ano_mes: am });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, diaVencMensal);
    }
  } else if (ocorrencia === "semanal" && diaSemanaVal) {
    const target = DIAS_SEMANA_NUM[diaSemanaVal] ?? 1;
    let cur = new Date(inicio);
    while (cur.getDay() !== target) cur.setDate(cur.getDate() + 1);
    while (cur <= fim) {
      const am = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      results.push({ data_vencimento: format(cur, "yyyy-MM-dd"), ano_mes: am });
      cur = new Date(cur.getTime());
      cur.setDate(cur.getDate() + 7);
    }
  } else if (ocorrencia === "anual") {
    let cur = new Date(ano, mes - 1, 1);
    while (cur <= fim) {
      const am = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      results.push({ data_vencimento: format(cur, "yyyy-MM-dd"), ano_mes: am });
      cur = new Date(cur.getFullYear() + 1, cur.getMonth(), cur.getDate());
    }
  }
  return results;
};

/* ─── Component ──────────────────────────────────────────── */
export default function DreDespesas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentDate = new Date();

  const [selectedMes, setSelectedMes] = useState(String(currentDate.getMonth() + 1).padStart(2, "0"));
  const [selectedAno, setSelectedAno] = useState(String(currentDate.getFullYear()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pagarDialogOpen, setPagarDialogOpen] = useState(false);
  const [estornarDialogOpen, setEstornarDialogOpen] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState(null);
  const [deletingDespesa, setDeletingDespesa] = useState(null);
  const [actionDespesa, setActionDespesa] = useState(null);

  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [categoriaSugerida, setCategoriaSugerida] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [ocorrencia, setOcorrencia] = useState("unico");
  const [numeroParcelas, setNumeroParcelas] = useState("2");
  const [dataVencimento, setDataVencimento] = useState("");
  const [dataDespesa, setDataDespesa] = useState(format(new Date(), "yyyy-MM-dd"));
  const [contato, setContato] = useState("");
  const [contatoSearch, setContatoSearch] = useState("");
  const [showContatoDropdown, setShowContatoDropdown] = useState(false);
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [diaVencimentoMensal, setDiaVencimentoMensal] = useState("");
  const [diaSemana, setDiaSemana] = useState("");
  const [dataLimiteRecorrencia, setDataLimiteRecorrencia] = useState("");

  // Estados de pagamento
  const [pgDesconto, setPgDesconto] = useState("0,00");
  const [pgAcrescimo, setPgAcrescimo] = useState("0,00");
  const [pgValorPago, setPgValorPago] = useState("");
  const [pgDataPagamento, setPgDataPagamento] = useState(format(new Date(), "yyyy-MM-dd"));
  const [pgObs, setPgObs] = useState("");
  const [pgManualValor, setPgManualValor] = useState(false);

  // Ordenação
  const [sortField, setSortField] = useState("data_vencimento");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Busca por coluna
  const [colSearch, setColSearch] = useState({
    descricao: "", forma_pagamento: "", contato: "", categoria: "", ocorrencia: "",
  });

  // Filtro painel
  const [filtroOpen, setFiltroOpen] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroOcorrencia, setFiltroOcorrencia] = useState("");

  const contatoRef = useRef(null);

  const anoMes = `${selectedAno}-${selectedMes}`;
  const anos = Array.from({ length: 5 }, (_, i) => String(currentDate.getFullYear() - 2 + i));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contatoRef.current && !contatoRef.current.contains(e.target as Node)) {
        setShowContatoDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ─── Queries ───────────────────────────────────────────── */
  const { data: categorias = [] } = useQuery({
    queryKey: ["dre-categorias-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_categorias_despesas").select("id, nome")
        .eq("ativo", true).order("ordem", { ascending: true });
      if (error) throw error;
      return data as Categoria[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-names"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles").select("id, nome").order("nome");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: despesas = [], isLoading } = useQuery({
    queryKey: ["dre-despesas", anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_despesas")
        .select("*, dre_categorias_despesas(id, nome)")
        .eq("ano_mes", anoMes)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data as Despesa[];
    },
  });

  const pendentes = useMemo(() => despesas.filter(d => (d.status || "pendente") === "pendente"), [despesas]);
  const pagas = useMemo(() => despesas.filter(d => d.status === "pago"), [despesas]);
  const totalPendentes = pendentes.reduce((s, d) => s + Number(d.valor), 0);
  const totalPagas = pagas.reduce((s, d) => s + Number(d.valor), 0);

  const contatoSuggestions = useMemo(() => {
    if (!contatoSearch.trim()) return [];
    const n = norm(contatoSearch);
    return profiles.filter(p => p.nome && norm(p.nome).includes(n)).slice(0, 6);
  }, [contatoSearch, profiles]);

  /* ─── Auto-sugestão ─────────────────────────────────────── */
  const detectarCategoria = (desc: string): Categoria | undefined => {
    if (!desc.trim() || !categorias.length) return undefined;
    const n = norm(desc);
    for (const entry of CATEGORIA_KEYWORDS) {
      if (n.includes(entry.keyword)) {
        const cat = categorias.find(c => norm(c.nome).includes(entry.catFragment));
        if (cat) return cat;
      }
    }
    return undefined;
  };

  const handleDescricaoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setDescricao(v);
    if (!categoriaId || categoriaSugerida) {
      const s = detectarCategoria(v);
      if (s) { setCategoriaId(s.id); setCategoriaSugerida(true); }
      else if (categoriaSugerida) { setCategoriaId(""); setCategoriaSugerida(false); }
    }
  };

  /* ─── Mutations ──────────────────────────────────────────── */
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        categoria_id: data.categoria_id,
        valor: data.valor,
        descricao: data.descricao || null,
        observacao: data.observacao || null,
        forma_pagamento: data.forma_pagamento || null,
        ocorrencia: data.ocorrencia || null,
        numero_parcelas: data.numero_parcelas,
        data_vencimento: data.data_vencimento || null,
        contato: data.contato || null,
        status: "pendente",
      };
      if (data.id) {
        const { error } = await supabase.from("dre_despesas")
          .update({ ...payload, atualizado_em: new Date().toISOString() })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const isRecorrente = ["mensal", "semanal", "anual"].includes(data.ocorrencia);
        if (isRecorrente) {
          const datas = gerarDatasRecorrentes(
            data.ocorrencia,
            data.dia_semana || "",
            data.dia_vencimento_mensal || null,
            anoMes,
            data.data_limite_recorrencia || null
          );
          if (datas.length === 0) {
            throw new Error("Nenhuma ocorrência gerada para o período informado");
          }
          const registros = datas.map(d => ({
            ...payload,
            ano_mes: d.ano_mes,
            data_vencimento: d.data_vencimento,
            data_despesa: d.data_vencimento,
            criado_por: user?.id,
          }));
          const { error } = await supabase.from("dre_despesas").insert(registros);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("dre_despesas")
            .insert({ ...payload, ano_mes: anoMes, criado_por: user?.id, data_despesa: data.data_despesa });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dre-despesas", anoMes] });
      toast.success(
        editingDespesa
          ? "Despesa atualizada!"
          : ["mensal","semanal","anual"].includes(ocorrencia)
          ? "Despesas recorrentes geradas com sucesso!"
          : "Despesa lançada como pendente!"
      );
      handleCloseDialog();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar despesa"),
  });

  const pagarMutation = useMutation({
    mutationFn: async ({
      despesa, valorPago, desconto, acrescimo, dataPagamento, obs,
    }: {
      despesa: Despesa;
      valorPago: number;
      desconto: number;
      acrescimo: number;
      dataPagamento: string;
      obs: string;
    }) => {
      const valorOriginal = Number(despesa.valor);
      const valorCalculado = valorOriginal - desconto + acrescimo;
      const isParcial = valorPago < valorCalculado - 0.01;
      const saldo = valorCalculado - valorPago;

      const { error: e1 } = await supabase.from("dre_despesas")
        .update({
          status: "pago",
          valor: valorPago,
          desconto,
          acrescimo,
          data_pagamento: dataPagamento,
          observacao: obs || despesa.observacao || null,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", despesa.id);
      if (e1) throw e1;

      if (isParcial) {
        const { error: e2 } = await supabase.from("dre_despesas").insert({
          categoria_id: despesa.categoria_id,
          ano_mes: despesa.ano_mes,
          valor: saldo,
          descricao: despesa.descricao,
          observacao: `Parcial — saldo restante de ${formatarValor(saldo)}`,
          forma_pagamento: despesa.forma_pagamento,
          ocorrencia: despesa.ocorrencia,
          contato: despesa.contato,
          data_vencimento: despesa.data_vencimento,
          dia_vencimento_mensal: despesa.dia_vencimento_mensal,
          dia_semana: despesa.dia_semana,
          status: "pendente",
        });
        if (e2) throw e2;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["dre-despesas", anoMes] });
      const valorCalculado = Number(vars.despesa.valor) - vars.desconto + vars.acrescimo;
      if (vars.valorPago < valorCalculado - 0.01) {
        toast.success(`Pagamento parcial de ${formatarValor(vars.valorPago)} registrado. Saldo de ${formatarValor(valorCalculado - vars.valorPago)} permanece pendente.`);
      } else {
        toast.success("Despesa paga e lançada no DRE! ✅");
      }
      setPagarDialogOpen(false);
      setActionDespesa(null);
    },
    onError: (e: any) => toast.error("Erro ao registrar pagamento: " + (e?.message || "")),
  });

  const estornarMutation = useMutation({
    mutationFn: async (despesa: Despesa) => {
      const { error } = await supabase.from("dre_despesas")
        .update({ status: "pendente", data_pagamento: null, atualizado_em: new Date().toISOString() })
        .eq("id", despesa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dre-despesas", anoMes] });
      toast.success("Despesa estornada e removida do DRE!");
      setEstornarDialogOpen(false); setActionDespesa(null);
    },
    onError: () => toast.error("Erro ao estornar despesa"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dre_despesas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dre-despesas", anoMes] });
      toast.success("Despesa excluída!");
      setDeleteDialogOpen(false); setDeletingDespesa(null);
    },
    onError: () => toast.error("Erro ao excluir despesa"),
  });

  /* ─── Handlers ───────────────────────────────────────────── */
  const resetForm = () => {
    setEditingDespesa(null); setDescricao(""); setCategoriaId("");
    setCategoriaSugerida(false); setFormaPagamento(""); setOcorrencia("unico");
    setNumeroParcelas("2"); setDataVencimento(""); setDataDespesa(format(new Date(), "yyyy-MM-dd"));
    setContato(""); setContatoSearch(""); setValor(""); setObservacao("");
    setDiaVencimentoMensal(""); setDiaSemana(""); setDataLimiteRecorrencia("");
  };

  const handleOpenDialog = (despesa?: Despesa) => {
    if (despesa) {
      setEditingDespesa(despesa);
      setDescricao(despesa.descricao || "");
      setCategoriaId(despesa.categoria_id || "");
      setCategoriaSugerida(false);
      setFormaPagamento(despesa.forma_pagamento || "");
      setOcorrencia(despesa.ocorrencia || "unico");
      setNumeroParcelas(String(despesa.numero_parcelas || 2));
      setDataVencimento(despesa.data_vencimento || "");
      setDataDespesa(despesa.data_despesa || format(new Date(), "yyyy-MM-dd"));
      setContato(despesa.contato || "");
      setContatoSearch(despesa.contato || "");
      setValor(formatarValorInput(String(despesa.valor)));
      setObservacao(despesa.observacao || "");
      setDiaVencimentoMensal(String(despesa.dia_vencimento_mensal || ""));
      setDiaSemana(despesa.dia_semana || "");
      setDataLimiteRecorrencia(despesa.data_limite_recorrencia || "");
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => { setDialogOpen(false); resetForm(); };

  const handleAbrirPagar = (d: Despesa) => {
    setActionDespesa(d);
    setPgDesconto("0,00");
    setPgAcrescimo("0,00");
    setPgValorPago(formatarValorInput(String(d.valor)));
    setPgDataPagamento(format(new Date(), "yyyy-MM-dd"));
    setPgObs("");
    setPgManualValor(false);
    setPagarDialogOpen(true);
  };

  const handleSave = () => {
    if (!categoriaId) { toast.error("Selecione uma categoria"); return; }
    const valorNum = parseValor(valor);
    if (valorNum <= 0) { toast.error("Informe um valor válido"); return; }
    saveMutation.mutate({
      id: editingDespesa?.id,
      categoria_id: categoriaId,
      valor: valorNum,
      descricao: descricao.trim(),
      observacao: observacao.trim(),
      forma_pagamento: formaPagamento,
      ocorrencia,
      numero_parcelas: ocorrencia === "parcelado" ? parseInt(numeroParcelas) || null : null,
      data_vencimento: dataVencimento || null,
      contato: contato.trim(),
      data_despesa: editingDespesa ? undefined : dataDespesa,
      dia_vencimento_mensal: ocorrencia === "mensal" ? parseInt(diaVencimentoMensal) || null : null,
      dia_semana: ocorrencia === "semanal" ? diaSemana || null : null,
      data_limite_recorrencia: ["mensal", "semanal", "anual"].includes(ocorrencia) ? dataLimiteRecorrencia || null : null,
    });
  };

  const formatarValorInput = (value: string): string => {
    const n = value.replace(/\D/g, "");
    return (parseInt(n || "0", 10) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseValor = (value: string) =>
    parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;

  const mesLabel = MESES.find(m => m.value === selectedMes)?.label || "";
  const categoriaSelecionada = categorias.find(c => c.id === categoriaId);

  // Ordenação
  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const aplicarFiltroEOrdem = (list: Despesa[]) => {
    let result = list.filter(d => {
      if (colSearch.descricao && !norm(d.descricao || d.observacao || "").includes(norm(colSearch.descricao))) return false;
      if (colSearch.forma_pagamento && !norm(d.forma_pagamento || "").includes(norm(colSearch.forma_pagamento))) return false;
      if (colSearch.contato && !norm(d.contato || "").includes(norm(colSearch.contato))) return false;
      if (colSearch.categoria && !norm(d.dre_categorias_despesas?.nome || "").includes(norm(colSearch.categoria))) return false;
      if (colSearch.ocorrencia && d.ocorrencia !== colSearch.ocorrencia) return false;
      if (filtroCategoria && d.categoria_id !== filtroCategoria) return false;
      if (filtroOcorrencia && d.ocorrencia !== filtroOcorrencia) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      let va: any, vb: any;
      switch (sortField) {
        case "data_vencimento":
          va = a.data_vencimento || "9999-12-31"; vb = b.data_vencimento || "9999-12-31"; break;
        case "descricao":
          va = norm(a.descricao || a.observacao || ""); vb = norm(b.descricao || b.observacao || ""); break;
        case "contato":
          va = norm(a.contato || ""); vb = norm(b.contato || ""); break;
        case "categoria":
          va = norm(a.dre_categorias_despesas?.nome || ""); vb = norm(b.dre_categorias_despesas?.nome || ""); break;
        case "valor":
          va = Number(a.valor); vb = Number(b.valor); break;
        case "ocorrencia":
          va = a.ocorrencia || ""; vb = b.ocorrencia || ""; break;
        case "forma_pagamento":
          va = a.forma_pagamento || ""; vb = b.forma_pagamento || ""; break;
        default:
          va = a.criado_em; vb = b.criado_em;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  };

  const SortTh = ({ field, label, align = "left" }: { field: string; label: string; align?: string }) => (
    <th
      onClick={() => handleSort(field)}
      className={`px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none whitespace-nowrap text-${align}`}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field
          ? sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
          : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
      </div>
    </th>
  );

  const colSearchInput = (key: keyof typeof colSearch, placeholder = "") => (
    <td className="px-3 py-1">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          className="h-7 pl-7 text-xs bg-background"
          value={colSearch[key]}
          onChange={(e) => setColSearch(s => ({ ...s, [key]: e.target.value }))}
          placeholder={placeholder}
        />
      </div>
    </td>
  );

  /* ─── Table Row ──────────────────────────────────────────── */
  const TableRow = ({ d, isPaga }: { d: Despesa; isPaga: boolean }) => (
    <tr className="border-b border-border hover:bg-secondary/40 transition-colors">
      <td className="px-3 py-2 text-sm whitespace-nowrap max-w-[160px] truncate">
        {d.descricao || d.observacao || "—"}
      </td>
      <td className="px-3 py-2 text-sm whitespace-nowrap">
        {d.forma_pagamento || "—"}
      </td>
      <td className="px-3 py-2 text-sm whitespace-nowrap">
        {d.contato || "—"}
      </td>
      <td className="px-3 py-2 text-sm whitespace-nowrap">
        {d.dre_categorias_despesas?.nome
          ? <Badge variant="outline">{d.dre_categorias_despesas.nome}</Badge>
          : "—"}
      </td>
      <td className="px-3 py-2 text-sm whitespace-nowrap">
        {d.data_vencimento
          ? <span className="text-muted-foreground">
              {format(new Date(d.data_vencimento + "T12:00:00"), "dd/MM/yyyy")}
            </span>
          : "—"}
      </td>
      <td className="px-3 py-2 text-sm whitespace-nowrap font-medium">
        {formatarValor(Number(d.valor))}
      </td>
      <td className="px-3 py-2 text-sm whitespace-nowrap">
        {OCORRENCIAS.find(o => o.value === d.ocorrencia)?.label || d.ocorrencia || "—"}
      </td>
      <td className="px-3 py-2 text-sm whitespace-nowrap">
        {d.ocorrencia === "parcelado" && d.numero_parcelas
          ? <span className="text-muted-foreground">{d.parcela_atual || 1}/{d.numero_parcelas}</span>
          : "—"}
      </td>
      <td className="px-3 py-2 text-sm whitespace-nowrap">
        {d.observacao
          ? <TooltipProvider><Tooltip>
              <TooltipTrigger asChild>
                <MessageSquare className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                {d.observacao}
              </TooltipContent>
            </Tooltip></TooltipProvider>
          : "—"}
      </td>
      <td className="px-3 py-2 text-sm whitespace-nowrap">
        <div className="flex items-center gap-1">
          {!isPaga ? (
            <>
              <Button size="icon-sm" variant="ghost" onClick={() => handleAbrirPagar(d)}>
                <CheckCircle2 className="h-4 w-4 text-success" />
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={() => handleOpenDialog(d)}>
                <Pencil className="h-4 w-4 text-primary" />
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={() => { setDeletingDespesa(d); setDeleteDialogOpen(true); }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          ) : (
            <Button size="icon-sm" variant="ghost" onClick={() => { setActionDespesa(d); setEstornarDialogOpen(true); }}>
              <RotateCcw className="h-4 w-4 text-warning" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Contas a Pagar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de despesas pendentes e pagas
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2 hidden md:flex">
          <Plus className="h-4 w-4" />
          Nova Despesa
        </Button>
      </div>

      {/* Período */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm text-muted-foreground">Período:</span>
            <Select value={selectedMes} onValueChange={setSelectedMes}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedAno} onValueChange={setSelectedAno}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {anos.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Popover open={filtroOpen} onOpenChange={setFiltroOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 ml-auto sm:ml-0">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtro
                  {(filtroCategoria || filtroOcorrencia) && (
                    <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-4" align="start">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                  <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas</SelectItem>
                      {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Ocorrência</label>
                  <Select value={filtroOcorrencia} onValueChange={setFiltroOcorrencia}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas</SelectItem>
                      {OCORRENCIAS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setFiltroCategoria(""); setFiltroOcorrencia(""); }}>
                  Limpar filtros
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pendentes" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pendentes">
            Pendentes
            {pendentes.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pendentes.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pagas">
            Pagas
            {pagas.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pagas.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Carregando...
                </div>
              ) : pendentes.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhuma despesa pendente em {mesLabel} {selectedAno}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-secondary/50">
                        <SortTh field="descricao" label="Descrição" />
                        <SortTh field="forma_pagamento" label="Forma Pagto" />
                        <SortTh field="contato" label="Contato" />
                        <SortTh field="categoria" label="Categoria" />
                        <SortTh field="data_vencimento" label="Vencimento" />
                        <SortTh field="valor" label="Valor" align="right" />
                        <SortTh field="ocorrencia" label="Ocorrência" />
                        <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Parcela</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Obs</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Ações</th>
                      </tr>
                      <tr className="bg-secondary/30">
                        {colSearchInput("descricao", "Buscar...")}
                        {colSearchInput("forma_pagamento", "Buscar...")}
                        {colSearchInput("contato", "Buscar...")}
                        {colSearchInput("categoria", "Buscar...")}
                        <td className="px-3 py-1"></td>
                        <td className="px-3 py-1"></td>
                        {colSearchInput("ocorrencia", "Buscar...")}
                        <td className="px-3 py-1"></td>
                        <td className="px-3 py-1"></td>
                        <td className="px-3 py-1"></td>
                      </tr>
                    </thead>
                    <tbody>
                      {aplicarFiltroEOrdem(pendentes).map(d => <TableRow key={d.id} d={d} isPaga={false} />)}
                      <tr className="bg-secondary/60 font-semibold text-sm">
                        <td className="px-3 py-2" colSpan={5}>TOTAL PENDENTE</td>
                        <td className="px-3 py-2 text-primary">{formatarValor(totalPendentes)}</td>
                        <td colSpan={4}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
            {pendentes.length > 0 && (
              <div className="px-4 py-3 border-t border-border bg-secondary/30 flex justify-between items-center">
                <span className="text-sm font-medium">TOTAL PENDENTE</span>
                <span className="text-sm font-bold text-primary">{formatarValor(totalPendentes)}</span>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="pagas" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Carregando...
                </div>
              ) : pagas.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhuma despesa paga em {mesLabel} {selectedAno}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-secondary/50">
                        <SortTh field="descricao" label="Descrição" />
                        <SortTh field="forma_pagamento" label="Forma Pagto" />
                        <SortTh field="contato" label="Contato" />
                        <SortTh field="categoria" label="Categoria" />
                        <SortTh field="data_vencimento" label="Vencimento" />
                        <SortTh field="valor" label="Valor" align="right" />
                        <SortTh field="ocorrencia" label="Ocorrência" />
                        <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Parcela</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Obs</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Ações</th>
                      </tr>
                      <tr className="bg-secondary/30">
                        {colSearchInput("descricao", "Buscar...")}
                        {colSearchInput("forma_pagamento", "Buscar...")}
                        {colSearchInput("contato", "Buscar...")}
                        {colSearchInput("categoria", "Buscar...")}
                        <td className="px-3 py-1"></td>
                        <td className="px-3 py-1"></td>
                        {colSearchInput("ocorrencia", "Buscar...")}
                        <td className="px-3 py-1"></td>
                        <td className="px-3 py-1"></td>
                        <td className="px-3 py-1"></td>
                      </tr>
                    </thead>
                    <tbody>
                      {aplicarFiltroEOrdem(pagas).map(d => <TableRow key={d.id} d={d} isPaga={true} />)}
                      <tr className="bg-secondary/60 font-semibold text-sm">
                        <td className="px-3 py-2" colSpan={5}>TOTAL PAGO NO DRE</td>
                        <td className="px-3 py-2 text-success">{formatarValor(totalPagas)}</td>
                        <td colSpan={4}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
            {pagas.length > 0 && (
              <div className="px-4 py-3 border-t border-border bg-secondary/30 flex justify-between items-center">
                <span className="text-sm font-medium">TOTAL PAGO NO DRE</span>
                <span className="text-sm font-bold text-success">{formatarValor(totalPagas)}</span>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* FAB mobile */}
      <Button onClick={() => handleOpenDialog()}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 md:hidden">
        <Plus className="h-6 w-6" />
      </Button>

      {/* Dialog Nova/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingDespesa ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto pr-1">
            <div>
              <label className="text-sm font-medium">Descrição *</label>
              <Input value={descricao} onChange={handleDescricaoChange} placeholder="Ex: Aluguel do escritório" />
            </div>

            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                Categoria *
                {categoriaSugerida && categoriaSelecionada && (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" /> sugerida
                  </Badge>
                )}
              </label>
              <Select value={categoriaId} onValueChange={(v) => { setCategoriaId(v); setCategoriaSugerida(false); }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Forma de Pagamento</label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Ocorrência</label>
              <Select value={ocorrencia} onValueChange={setOcorrencia}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OCORRENCIAS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {ocorrencia === "parcelado" && (
              <div>
                <label className="text-sm font-medium">Número de Parcelas</label>
                <Input value={numeroParcelas} onChange={(e) => setNumeroParcelas(e.target.value)} placeholder="Ex: 12" />
              </div>
            )}

            {ocorrencia === "mensal" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Dia do vencimento (todo mês)</label>
                <Input
                  type="number" min="1" max="31"
                  value={diaVencimentoMensal}
                  onChange={e => setDiaVencimentoMensal(e.target.value)}
                  placeholder="Ex: 30 (vence todo dia 30)"
                />
              </div>
            )}

            {ocorrencia === "semanal" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Dia da semana</label>
                <Select value={diaSemana} onValueChange={setDiaSemana}>
                  <SelectTrigger><SelectValue placeholder="Selecione o dia" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="segunda">Segunda-feira</SelectItem>
                    <SelectItem value="terca">Terça-feira</SelectItem>
                    <SelectItem value="quarta">Quarta-feira</SelectItem>
                    <SelectItem value="quinta">Quinta-feira</SelectItem>
                    <SelectItem value="sexta">Sexta-feira</SelectItem>
                    <SelectItem value="sabado">Sábado</SelectItem>
                    <SelectItem value="domingo">Domingo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {["mensal", "semanal", "anual"].includes(ocorrencia) && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Data limite da recorrência</label>
                <Input type="date" value={dataLimiteRecorrencia}
                  onChange={e => setDataLimiteRecorrencia(e.target.value)} />
              </div>
            )}

{["unico", "parcelado"].includes(ocorrencia) && (
              <div>
                <label className="text-sm font-medium">Data de Vencimento</label>
                <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Data de Lançamento</label>
              <Input type="date" value={dataDespesa} onChange={(e) => setDataDespesa(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium">Contato / Fornecedor</label>
              <div className="relative" ref={contatoRef}>
                <Input value={contatoSearch} onChange={(e) => { setContatoSearch(e.target.value); setContato(e.target.value); setShowContatoDropdown(true); }}
                  onFocus={() => setShowContatoDropdown(true)}
                  placeholder="Digite para buscar usuário..." />
                {showContatoDropdown && contatoSuggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {contatoSuggestions.map(p => (
                      <div key={p.id} className="px-3 py-2 hover:bg-secondary cursor-pointer text-sm"
                        onClick={() => { setContato(p.nome); setContatoSearch(p.nome); setShowContatoDropdown(false); }}>
                        {p.nome}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Valor *</label>
              <Input value={valor} onChange={(e) => setValor(formatarValorInput(e.target.value))}
                placeholder="0,00" inputMode="decimal" className="text-lg font-semibold" />
            </div>

            <div>
              <label className="text-sm font-medium">Observação</label>
              <Input value={observacao} onChange={(e) => setObservacao(e.target.value)}
                placeholder="Informações adicionais (opcional)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : editingDespesa ? "Salvar" : "Lançar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pagar Dialog */}
      <Dialog open={pagarDialogOpen} onOpenChange={setPagarDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Registrar Pagamento
            </DialogTitle>
          </DialogHeader>
          {actionDespesa && (() => {
            const descVal = parseValor(pgDesconto);
            const acrVal = parseValor(pgAcrescimo);
            const valorOriginal = Number(actionDespesa.valor);
            const valorCalculado = valorOriginal - descVal + acrVal;
            const valorPagoNum = parseValor(pgValorPago);
            const saldo = valorCalculado - valorPagoNum;
            const isParcial = valorPagoNum < valorCalculado - 0.01;

            const handleDescontoChange = (v: string) => {
              setPgDesconto(formatarValorInput(v));
              if (!pgManualValor) {
                const d = parseFloat(formatarValorInput(v).replace(/\./g, "").replace(",", ".")) || 0;
                const a = parseValor(pgAcrescimo);
                setPgValorPago(formatarValorInput(String(Math.round((valorOriginal - d + a) * 100))));
              }
            };

            const handleAcrescimoChange = (v: string) => {
              setPgAcrescimo(formatarValorInput(v));
              if (!pgManualValor) {
                const d = parseValor(pgDesconto);
                const a = parseFloat(formatarValorInput(v).replace(/\./g, "").replace(",", ".")) || 0;
                setPgValorPago(formatarValorInput(String(Math.round((valorOriginal - d + a) * 100))));
              }
            };

            return (
              <div className="space-y-4 py-2">
                {/* Resumo */}
                <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Descrição</span>
                    <span className="font-medium">{actionDespesa.descricao || "—"}</span>
                  </div>
                  {actionDespesa.contato && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contato</span>
                      <span>{actionDespesa.contato}</span>
                    </div>
                  )}
                  {actionDespesa.data_vencimento && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vencimento</span>
                      <span>{format(new Date(actionDespesa.data_vencimento + "T12:00:00"), "dd/MM/yyyy")}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1.5 mt-1.5">
                    <span className="text-muted-foreground">Valor original</span>
                    <span className="font-bold">{formatarValor(valorOriginal)}</span>
                  </div>
                </div>

                {/* Desconto / Acréscimo */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-green-600">Desconto</label>
                    <Input
                      value={pgDesconto}
                      onChange={e => handleDescontoChange(e.target.value)}
                      inputMode="decimal"
                      className="border-green-200 focus:border-green-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-red-500">Acréscimo</label>
                    <Input
                      value={pgAcrescimo}
                      onChange={e => handleAcrescimoChange(e.target.value)}
                      inputMode="decimal"
                      className="border-red-200 focus:border-red-500"
                    />
                  </div>
                </div>

                {/* Valor a pagar */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Valor a pagar
                    {isParcial && <span className="ml-2 text-xs text-amber-500 font-normal">pagamento parcial</span>}
                  </label>
                  <Input
                    value={pgValorPago}
                    onChange={e => { setPgManualValor(true); setPgValorPago(formatarValorInput(e.target.value)); }}
                    inputMode="decimal"
                    className="text-lg font-bold"
                  />
                  {isParcial && saldo > 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1">
                      Saldo restante de <strong>{formatarValor(saldo)}</strong> ficará como nova despesa pendente
                    </p>
                  )}
                </div>

                {/* Data pagamento */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Data do pagamento</label>
                  <Input type="date" value={pgDataPagamento} onChange={e => setPgDataPagamento(e.target.value)} />
                </div>

                {/* Observação */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Observação</label>
                  <Input value={pgObs} onChange={e => setPgObs(e.target.value)} placeholder="Opcional" />
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagarDialogOpen(false)}>Cancelar</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={pagarMutation.isPending || parseValor(pgValorPago) <= 0}
              onClick={() => {
                if (!actionDespesa) return;
                pagarMutation.mutate({
                  despesa: actionDespesa,
                  valorPago: parseValor(pgValorPago),
                  desconto: parseValor(pgDesconto),
                  acrescimo: parseValor(pgAcrescimo),
                  dataPagamento: pgDataPagamento,
                  obs: pgObs,
                });
              }}
            >
              {pagarMutation.isPending ? "Salvando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Estornar Dialog */}
      <AlertDialog open={estornarDialogOpen} onOpenChange={setEstornarDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar Pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma o estorno de {formatarValor(Number(actionDespesa?.valor || 0))}?
              <div className="mt-2 text-sm text-muted-foreground">
                A despesa será removida do DRE e voltará para Contas Pendentes.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEstornarDialogOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => actionDespesa && estornarMutation.mutate(actionDespesa)}>
              ↩ Estornar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Despesa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{" "}
              {deletingDespesa?.descricao || deletingDespesa?.observacao} de{" "}
              {formatarValor(Number(deletingDespesa?.valor || 0))}?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingDespesa && deleteMutation.mutate(deletingDespesa.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}