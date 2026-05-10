import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { Plus, Receipt, Pencil, Trash2, Info } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatarValor } from "@/lib/utils";

interface Categoria {
  id: string;
  nome: string;
}

interface Despesa {
  id: string;
  categoria_id: string | null;
  ano_mes: string;
  valor: number;
  observacao: string | null;
  descricao: string | null;
  forma_pagamento: string | null;
  ocorrencia: string;
  numero_parcelas: number | null;
  parcela_atual: number | null;
  data_vencimento: string | null;
  contato: string | null;
  data_despesa: string | null;
  criado_em: string;
  dre_categorias_despesas: Categoria | null;
}

const KEYWORD_MAP: Array<{ keys: string[]; fragment: string }> = [
  { keys: ['salario','salário','funcionario','funcionário','clt','holerite','rescisao','rescisão','admissao','demissão'], fragment: 'folha' },
  { keys: ['pro-labore','prolabore','pro labore','pró-labore','retirada','socio','sócio'], fragment: 'labore' },
  { keys: ['vale','vr','vt','refeicao','refeição','transporte','alimentacao','alimentação','beneficio','benefício'], fragment: 'vale' },
  { keys: ['fornecedor','compra','nota fiscal','nf-e','nfe','insumo','materia','mercadoria','pedido','fatura'], fragment: 'fornecedor' },
  { keys: ['comissao','comissão','representante','vendedora','vendedor','comissionado'], fragment: 'comiss' },
  { keys: ['banco','bancaria','bancário','tarifa','ted','iof','juros','emprestimo','empréstimo','financiamento','taxa bancaria','taxa bancária','credito rotativo'], fragment: 'banc' },
  { keys: ['imposto','das','simples','irpj','csll','cofins','inss','fgts','icms','iss','guia','tributo','darf'], fragment: 'imposto' },
  { keys: ['aluguel','energia','agua','internet','telefone','escritorio','escritório','limpeza','manutencao','manutenção','seguro','assinatura','honorario','honorário','contabil','contábil'], fragment: 'empresa' },
];

function normalize(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function detectarCategoria(texto: string, cats: Categoria[]): Categoria | null {
  if (!texto || texto.length < 3) return null;
  const t = normalize(texto);
  for (const entry of KEYWORD_MAP) {
    if (entry.keys.some(k => t.includes(normalize(k)))) {
      return cats.find(c => normalize(c.nome).includes(entry.fragment)) ?? null;
    }
  }
  return null;
}

const FORMAS_PAGAMENTO = [
  { value: 'pix', label: 'Pix' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'debito_automatico', label: 'Débito Automático' },
];

const OCORRENCIAS = [
  { value: 'unica', label: 'Única' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'parcelada', label: 'Parcelada' },
  { value: 'anual', label: 'Anual' },
];

const formaLabel = (v?: string | null) => FORMAS_PAGAMENTO.find(f => f.value === v)?.label || '-';
const ocorrenciaLabel = (v?: string | null) => OCORRENCIAS.find(o => o.value === v)?.label || '-';

const MESES = [
  { value: "01", label: "Janeiro" }, { value: "02", label: "Fevereiro" }, { value: "03", label: "Março" },
  { value: "04", label: "Abril" }, { value: "05", label: "Maio" }, { value: "06", label: "Junho" },
  { value: "07", label: "Julho" }, { value: "08", label: "Agosto" }, { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" }, { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
];

export default function DreDespesas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentDate = new Date();

  const [selectedMes, setSelectedMes] = useState(String(currentDate.getMonth() + 1).padStart(2, "0"));
  const [selectedAno, setSelectedAno] = useState(String(currentDate.getFullYear()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);
  const [deletingDespesa, setDeletingDespesa] = useState<Despesa | null>(null);
  const [recurrenceDialogOpen, setRecurrenceDialogOpen] = useState(false);
  const [recurrenceCount, setRecurrenceCount] = useState("3");
  const [pendingRecurrence, setPendingRecurrence] = useState<{
    id: string;
    base: any;
    ocorrencia: string;
  } | null>(null);

  // Form state
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<string>("");
  const [ocorrencia, setOcorrencia] = useState<string>("unica");
  const [numeroParcelas, setNumeroParcelas] = useState<string>("1");
  const [dataVencimento, setDataVencimento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dataDespesa, setDataDespesa] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [contato, setContato] = useState("");
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [categoriaSugerida, setCategoriaSugerida] = useState<Categoria | null>(null);

  const anoMes = `${selectedAno}-${selectedMes}`;
  const anos = Array.from({ length: 5 }, (_, i) => String(currentDate.getFullYear() - 2 + i));

  const { data: categorias = [] } = useQuery({
    queryKey: ["dre-categorias-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_categorias_despesas")
        .select("id, nome")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data as Categoria[];
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

  const despesasOrdenadas = useMemo(() => {
    return [...despesas].sort((a, b) => {
      const dataA = a.data_despesa || a.criado_em;
      const dataB = b.data_despesa || b.criado_em;
      return dataB.localeCompare(dataA);
    });
  }, [despesas]);

  const totalPeriodo = despesas.reduce((sum, d) => sum + Number(d.valor), 0);

  const shiftDate = (dateStr: string, ocorr: string, n: number): string => {
    const d = new Date(dateStr + 'T12:00:00');
    if (ocorr === 'mensal' || ocorr === 'parcelada') d.setMonth(d.getMonth() + n);
    else if (ocorr === 'anual') d.setMonth(d.getMonth() + 12 * n);
    else if (ocorr === 'quinzenal') d.setDate(d.getDate() + 15 * n);
    else if (ocorr === 'semanal') d.setDate(d.getDate() + 7 * n);
    return format(d, 'yyyy-MM-dd');
  };

  const gerarRecorrencias = async (
    primeiroId: string,
    base: any,
    ocorr: string,
    quantidadeAdicional: number,
  ) => {
    if (quantidadeAdicional <= 0) return;
    const totalParcelas = quantidadeAdicional + 1;

    // Para parcelada, numero_parcelas já é o total. Para outros, atualizar o primeiro registro.
    if (ocorr !== 'parcelada') {
      await supabase
        .from('dre_despesas')
        .update({ numero_parcelas: totalParcelas })
        .eq('id', primeiroId);
    }

    const rows = [];
    for (let i = 1; i <= quantidadeAdicional; i++) {
      const novaDataVenc = shiftDate(base.data_vencimento, ocorr, i);
      const novaDataDesp = shiftDate(base.data_despesa, ocorr, i);
      rows.push({
        ...base,
        numero_parcelas: totalParcelas,
        parcela_atual: i + 1,
        data_vencimento: novaDataVenc,
        data_despesa: novaDataDesp,
        ano_mes: novaDataVenc.slice(0, 7),
        criado_por: user?.id,
      });
    }

    const { error } = await supabase.from('dre_despesas').insert(rows);
    if (error) {
      toast.error('Erro ao gerar recorrências');
      console.error(error);
      return;
    }
    toast.success(`${quantidadeAdicional} lançamento(s) adicional(is) gerado(s)`);
    queryClient.invalidateQueries({ queryKey: ['dre-despesas'] });
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      id?: string;
      categoria_id: string;
      valor: number;
      descricao: string;
      observacao: string;
      forma_pagamento: string;
      ocorrencia: string;
      numero_parcelas: number;
      data_vencimento: string;
      data_despesa: string;
      contato: string;
    }) => {
      const base = {
        categoria_id: payload.categoria_id,
        valor: payload.valor,
        descricao: payload.descricao || null,
        observacao: payload.observacao || null,
        forma_pagamento: payload.forma_pagamento,
        ocorrencia: payload.ocorrencia,
        numero_parcelas: payload.ocorrencia === 'parcelada' ? payload.numero_parcelas : 1,
        data_vencimento: payload.data_vencimento,
        data_despesa: payload.data_despesa,
        contato: payload.contato || null,
      };

      if (payload.id) {
        const { error } = await supabase
          .from("dre_despesas")
          .update({ ...base, atualizado_em: new Date().toISOString() })
          .eq("id", payload.id);
        if (error) throw error;
        return { id: payload.id, base, isNew: false };
      } else {
        const { data, error } = await supabase
          .from("dre_despesas")
          .insert({
            ...base,
            ano_mes: anoMes,
            criado_por: user?.id,
            parcela_atual: 1,
          })
          .select("id")
          .single();
        if (error) throw error;
        return { id: data.id as string, base, isNew: true };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["dre-despesas", anoMes] });
      const ocorr = result.base.ocorrencia;

      if (result.isNew && ocorr === 'parcelada' && (result.base.numero_parcelas || 1) > 1) {
        // gera automaticamente as parcelas seguintes
        gerarRecorrencias(result.id, result.base, ocorr, (result.base.numero_parcelas || 1) - 1);
        toast.success("Despesa lançada!");
        handleCloseDialog();
        return;
      }

      if (result.isNew && ['mensal', 'quinzenal', 'semanal', 'anual'].includes(ocorr)) {
        setPendingRecurrence({ id: result.id, base: result.base, ocorrencia: ocorr });
        setRecurrenceCount(ocorr === 'anual' ? "2" : "3");
        setRecurrenceDialogOpen(true);
        toast.success("Despesa lançada!");
        handleCloseDialog();
        return;
      }

      toast.success(editingDespesa ? "Despesa atualizada!" : "Despesa lançada!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao salvar despesa");
      console.error(error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dre_despesas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dre-despesas", anoMes] });
      toast.success("Despesa excluída!");
      setDeleteDialogOpen(false);
      setDeletingDespesa(null);
    },
    onError: (error) => {
      toast.error("Erro ao excluir despesa");
      console.error(error);
    },
  });

  const handleOpenDialog = (despesa?: Despesa) => {
    if (despesa) {
      setEditingDespesa(despesa);
      setDescricao(despesa.descricao || "");
      setCategoriaId(despesa.categoria_id || "");
      setFormaPagamento(despesa.forma_pagamento || "");
      setOcorrencia(despesa.ocorrencia || "unica");
      setNumeroParcelas(String(despesa.numero_parcelas || 1));
      setDataVencimento(despesa.data_vencimento || format(new Date(), 'yyyy-MM-dd'));
      setDataDespesa(despesa.data_despesa || format(new Date(), 'yyyy-MM-dd'));
      setContato(despesa.contato || "");
      setValor(formatarValorInput(String(despesa.valor)));
      setObservacao(despesa.observacao || "");
    } else {
      setEditingDespesa(null);
      setDescricao("");
      setCategoriaId("");
      setFormaPagamento("");
      setOcorrencia("unica");
      setNumeroParcelas("1");
      setDataVencimento(format(new Date(), 'yyyy-MM-dd'));
      setDataDespesa(format(new Date(), 'yyyy-MM-dd'));
      setContato("");
      setValor("");
      setObservacao("");
    }
    setCategoriaSugerida(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingDespesa(null);
    setCategoriaSugerida(null);
  };

  const formatarValorInput = (value: string): string => {
    const numericValue = value.replace(/\D/g, "");
    const number = parseInt(numericValue || "0", 10) / 100;
    return number.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseValor = (value: string): number => {
    return parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
  };

  const handleSave = () => {
    if (!descricao.trim()) {
      toast.error("Informe a descrição");
      return;
    }
    if (!categoriaId) {
      toast.error("Selecione uma categoria");
      return;
    }
    if (!formaPagamento) {
      toast.error("Selecione a forma de pagamento");
      return;
    }
    if (!ocorrencia) {
      toast.error("Selecione a ocorrência");
      return;
    }
    if (ocorrencia === 'parcelada' && (!numeroParcelas || parseInt(numeroParcelas) < 2)) {
      toast.error("Informe o número de parcelas (mínimo 2)");
      return;
    }
    if (!dataVencimento) {
      toast.error("Informe a data de vencimento");
      return;
    }
    if (!dataDespesa) {
      toast.error("Informe a data de lançamento");
      return;
    }
    const valorNumerico = parseValor(valor);
    if (valorNumerico <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    saveMutation.mutate({
      id: editingDespesa?.id,
      categoria_id: categoriaId,
      valor: valorNumerico,
      descricao: descricao.trim(),
      observacao: observacao.trim(),
      forma_pagamento: formaPagamento,
      ocorrencia,
      numero_parcelas: parseInt(numeroParcelas) || 1,
      data_vencimento: dataVencimento,
      data_despesa: dataDespesa,
      contato: contato.trim(),
    });
  };

  const handleDeleteClick = (despesa: Despesa) => {
    setDeletingDespesa(despesa);
    setDeleteDialogOpen(true);
  };

  const mesLabel = MESES.find(m => m.value === selectedMes)?.label || "";

  return (
    <TooltipProvider>
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Despesas DRE
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lançamento manual de despesas por competência
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2 hidden md:flex">
          <Plus className="h-4 w-4" />
          Nova Despesa
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm text-muted-foreground">Período:</span>
            <Select value={selectedMes} onValueChange={setSelectedMes}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map((mes) => <SelectItem key={mes.value} value={mes.value}>{mes.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedAno} onValueChange={setSelectedAno}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {anos.map((ano) => <SelectItem key={ano} value={ano}>{ano}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Despesas de {mesLabel} {selectedAno}</CardTitle>
          <CardDescription>{despesas.length} lançamento(s) no período</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : despesas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma despesa lançada neste período</div>
          ) : (
            <div className="space-y-2">
              {despesasOrdenadas.map((despesa) => (
                <div
                  key={despesa.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <div className="md:col-span-3 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm truncate">
                          {despesa.descricao || despesa.observacao || 'Sem descrição'}
                        </span>
                        {despesa.observacao && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              {despesa.observacao}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs mt-1">
                        {despesa.dre_categorias_despesas?.nome || 'Sem categoria'}
                      </Badge>
                    </div>
                    <div className="md:col-span-2 text-sm">
                      <div className="text-xs text-muted-foreground">Forma Pgto</div>
                      <div>{formaLabel(despesa.forma_pagamento)}</div>
                    </div>
                    <div className="md:col-span-2 text-sm">
                      <div className="text-xs text-muted-foreground">Vencimento</div>
                      <div>
                        {despesa.data_vencimento
                          ? format(new Date(despesa.data_vencimento + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })
                          : '-'}
                      </div>
                    </div>
                    <div className="md:col-span-2 text-sm">
                      <div className="text-xs text-muted-foreground">Ocorrência</div>
                      <div>{ocorrenciaLabel(despesa.ocorrencia)}</div>
                    </div>
                    <div className="md:col-span-1 text-sm">
                      <div className="text-xs text-muted-foreground">Parcela</div>
                      <div>
                        {despesa.numero_parcelas && despesa.numero_parcelas > 1
                          ? `${despesa.parcela_atual || 1}/${despesa.numero_parcelas}`
                          : '—'}
                      </div>
                    </div>
                    <div className="md:col-span-2 text-sm md:text-right">
                      <div className="text-xs text-muted-foreground">Valor</div>
                      <div className="font-semibold">{formatarValor(Number(despesa.valor))}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(despesa)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(despesa)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        {despesas.length > 0 && (
          <div className="border-t p-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold">TOTAL DO PERÍODO</span>
              <span className="text-xl font-bold text-destructive">{formatarValor(totalPeriodo)}</span>
            </div>
          </div>
        )}
      </Card>

      <button
        onClick={() => handleOpenDialog()}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all active:scale-95 md:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDespesa ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Linha 1: Descrição */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição *</label>
              <Input
                value={descricao}
                onChange={(e) => {
                  setDescricao(e.target.value);
                  const sugestao = detectarCategoria(e.target.value, categorias);
                  setCategoriaSugerida(sugestao && !categoriaId ? sugestao : null);
                }}
                placeholder="Ex: Pagamento fornecedor X"
                autoFocus={!editingDespesa}
              />
              {categoriaSugerida && !categoriaId && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Sugestão:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoriaId(categoriaSugerida.id);
                      setCategoriaSugerida(null);
                    }}
                    className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors font-medium"
                  >
                    {categoriaSugerida.nome} ↵
                  </button>
                  <span className="text-xs">(clique para aplicar)</span>
                </div>
              )}
            </div>

            {/* Linha 2: Categoria | Forma de Pagamento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoria *</label>
                <Select value={categoriaId} onValueChange={(v) => { setCategoriaId(v); setCategoriaSugerida(null); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Forma de Pagamento *</label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 3: Ocorrência | Parcelas | Vencimento */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Ocorrência *</label>
                <Select value={ocorrencia} onValueChange={setOcorrencia}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OCORRENCIAS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {ocorrencia === 'parcelada' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nº de Parcelas *</label>
                  <Input
                    type="number"
                    min={2}
                    value={numeroParcelas}
                    onChange={(e) => setNumeroParcelas(e.target.value)}
                  />
                </div>
              )}
              <div className={`space-y-2 ${ocorrencia !== 'parcelada' ? 'md:col-span-2' : ''}`}>
                <label className="text-sm font-medium">Data de Vencimento *</label>
                <Input
                  type="date"
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                />
              </div>
            </div>

            {/* Linha 4: Lançamento | Contato */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data de Lançamento *</label>
                <Input
                  type="date"
                  value={dataDespesa}
                  onChange={(e) => setDataDespesa(e.target.value)}
                  max={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Contato</label>
                <Input
                  value={contato}
                  onChange={(e) => setContato(e.target.value)}
                  placeholder="Ex: nome do fornecedor"
                />
              </div>
            </div>

            {/* Linha 5: Valor */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor *</label>
              <Input
                value={valor}
                onChange={(e) => setValor(formatarValorInput(e.target.value))}
                placeholder="0,00"
                inputMode="decimal"
                className="text-lg font-semibold"
              />
            </div>

            {/* Linha 6: Observação */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Observação</label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Informações complementares (opcional)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Despesa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta despesa de{" "}
              <strong>{formatarValor(Number(deletingDespesa?.valor || 0))}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDespesa && deleteMutation.mutate(deletingDespesa.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={recurrenceDialogOpen} onOpenChange={(open) => {
        setRecurrenceDialogOpen(open);
        if (!open) setPendingRecurrence(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingRecurrence?.ocorrencia === 'anual'
                ? 'Gerar para os próximos anos?'
                : 'Gerar para os próximos períodos?'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {pendingRecurrence?.ocorrencia === 'anual'
                ? 'Quantos anos adicionais deseja gerar?'
                : pendingRecurrence?.ocorrencia === 'mensal'
                ? 'Quantos meses adicionais deseja gerar?'
                : pendingRecurrence?.ocorrencia === 'quinzenal'
                ? 'Quantas quinzenas adicionais deseja gerar?'
                : 'Quantas semanas adicionais deseja gerar?'}
            </p>
            <Input
              type="number"
              min={1}
              max={60}
              value={recurrenceCount}
              onChange={(e) => setRecurrenceCount(e.target.value)}
              className="text-lg font-semibold"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRecurrenceDialogOpen(false);
                setPendingRecurrence(null);
              }}
            >
              Não, apenas este
            </Button>
            <Button
              onClick={async () => {
                if (!pendingRecurrence) return;
                const n = parseInt(recurrenceCount) || 0;
                if (n < 1) {
                  toast.error('Informe um número válido');
                  return;
                }
                await gerarRecorrencias(
                  pendingRecurrence.id,
                  pendingRecurrence.base,
                  pendingRecurrence.ocorrencia,
                  n,
                );
                setRecurrenceDialogOpen(false);
                setPendingRecurrence(null);
              }}
            >
              Sim, gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
