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
  MessageSquare, Sparkles,
} from "lucide-react";
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
        const { error } = await supabase.from("dre_despesas")
          .insert({ ...payload, ano_mes: anoMes, criado_por: user?.id, data_despesa: data.data_despesa });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dre-despesas", anoMes] });
      toast.success(editingDespesa ? "Despesa atualizada!" : "Despesa lançada como pendente!");
      handleCloseDialog();
    },
    onError: () => toast.error("Erro ao salvar despesa"),
  });

  const pagarMutation = useMutation({
    mutationFn: async (despesa: Despesa) => {
      const { error } = await supabase.from("dre_despesas")
        .update({ status: "pago", data_pagamento: format(new Date(), "yyyy-MM-dd"), atualizado_em: new Date().toISOString() })
        .eq("id", despesa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dre-despesas", anoMes] });
      toast.success("Despesa marcada como paga e lançada no DRE! ✅");
      setPagarDialogOpen(false); setActionDespesa(null);
    },
    onError: () => toast.error("Erro ao pagar despesa"),
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
              <Button size="icon-sm" variant="ghost" onClick={() => { setActionDespesa(d); setPagarDialogOpen(true); }}>
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
                      {pendentes.map(d => <TableRow key={d.id} d={d} isPaga={false} />)}
                    </thead>
                    <tbody>
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
                      {pagas.map(d => <TableRow key={d.id} d={d} isPaga={true} />)}
                    </thead>
                    <tbody>
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
      <AlertDialog open={pagarDialogOpen} onOpenChange={setPagarDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma o pagamento de {formatarValor(Number(actionDespesa?.valor || 0))} referente a{" "}
              {actionDespesa?.descricao || actionDespesa?.observacao}?
              <div className="mt-2 text-sm text-muted-foreground">
                A despesa será lançada no DRE automaticamente.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPagarDialogOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => actionDespesa && pagarMutation.mutate(actionDespesa)}>
              ✅ Confirmar Pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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