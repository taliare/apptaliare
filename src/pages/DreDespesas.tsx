import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Receipt, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatarValor } from "@/lib/utils";
import { cn } from "@/lib/utils";

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
  data_despesa: string | null;
  criado_em: string;
  dre_categorias_despesas: Categoria | null;
}

const CATEGORIA_KEYWORDS: Array<{ keywords: string[]; nomeCategoria: string }> = [
  {
    nomeCategoria: 'Folha de Pagamento',
    keywords: ['salario', 'salário', 'funcionario', 'funcionário', 'clt', 'pagamento funcionario', 'holerite', 'rescisao', 'rescisão'],
  },
  {
    nomeCategoria: 'Pró-Labore',
    keywords: ['pro-labore', 'prolabore', 'pró-labore', 'pro labore', 'retirada', 'socio', 'sócio'],
  },
  {
    nomeCategoria: 'Vales',
    keywords: ['vale', 'vr', 'vt', 'vale refeicao', 'vale refeição', 'vale transporte', 'alimentacao', 'alimentação', 'beneficio', 'benefício'],
  },
  {
    nomeCategoria: 'Fornecedores',
    keywords: ['fornecedor', 'compra', 'nota fiscal', 'nf-e', 'insumo', 'materia prima', 'material', 'pedido', 'produto'],
  },
  {
    nomeCategoria: 'Comissões',
    keywords: ['comissao', 'comissão', 'representante', 'vendedora', 'vendedor', 'comissionado'],
  },
  {
    nomeCategoria: 'Despesas Bancárias',
    keywords: ['banco', 'bancaria', 'bancário', 'tarifa', 'ted', 'iof', 'juros', 'emprestimo', 'empréstimo', 'financiamento', 'cartao credito', 'cartão crédito', 'taxa'],
  },
  {
    nomeCategoria: 'Impostos',
    keywords: ['imposto', 'das', 'simples nacional', 'irpj', 'csll', 'cofins', 'pis', 'inss', 'fgts', 'icms', 'iss', 'nfse', 'tributo', 'guia'],
  },
  {
    nomeCategoria: 'Despesas da Empresa',
    keywords: ['aluguel', 'energia', 'agua', 'internet', 'telefone', 'escritorio', 'escritório', 'limpeza', 'manutencao', 'manutenção', 'seguro', 'assinatura'],
  },
];

function normalize(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function sugerirCategoria(descricao: string, categorias: Categoria[]): Categoria | null {
  if (!descricao || descricao.length < 3) return null;
  const lower = normalize(descricao);
  for (const entry of CATEGORIA_KEYWORDS) {
    if (entry.keywords.some(kw => lower.includes(normalize(kw)))) {
      return categorias.find(c => normalize(c.nome) === normalize(entry.nomeCategoria)) ?? null;
    }
  }
  return null;
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
  
  // Form state
  const [categoriaId, setCategoriaId] = useState("");
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [dataDespesa, setDataDespesa] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [categoriaSugerida, setCategoriaSugerida] = useState<Categoria | null>(null);

  const anoMes = `${selectedAno}-${selectedMes}`;
  const anos = Array.from({ length: 5 }, (_, i) => String(currentDate.getFullYear() - 2 + i));

  // Fetch categorias ativas
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

  // Fetch despesas do período
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

  // Ordenar despesas por data_despesa ou criado_em (mais recente primeiro)
  const despesasOrdenadas = useMemo(() => {
    return [...despesas].sort((a, b) => {
      const dataA = a.data_despesa || a.criado_em;
      const dataB = b.data_despesa || b.criado_em;
      return dataB.localeCompare(dataA);
    });
  }, [despesas]);

  const totalPeriodo = despesas.reduce((sum, d) => sum + Number(d.valor), 0);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; categoria_id: string; valor: number; observacao: string; data_despesa?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from("dre_despesas")
          .update({
            categoria_id: data.categoria_id,
            valor: data.valor,
            observacao: data.observacao || null,
            atualizado_em: new Date().toISOString(),
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("dre_despesas")
          .insert({
            categoria_id: data.categoria_id,
            ano_mes: anoMes,
            valor: data.valor,
            observacao: data.observacao || null,
            criado_por: user?.id,
            data_despesa: data.data_despesa,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dre-despesas", anoMes] });
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
      setCategoriaId(despesa.categoria_id || "");
      setValor(formatarValorInput(String(despesa.valor)));
      setObservacao(despesa.observacao || "");
      setDataDespesa(despesa.data_despesa || format(new Date(), 'yyyy-MM-dd'));
    } else {
      setEditingDespesa(null);
      setCategoriaId("");
      setValor("");
      setObservacao("");
      setDataDespesa(format(new Date(), 'yyyy-MM-dd'));
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingDespesa(null);
    setCategoriaId("");
    setValor("");
    setObservacao("");
    setDataDespesa(format(new Date(), 'yyyy-MM-dd'));
  };

  const formatarValorInput = (value: string): string => {
    const numericValue = value.replace(/\D/g, "");
    const number = parseInt(numericValue || "0", 10) / 100;
    return number.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const parseValor = (value: string): number => {
    return parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
  };

  const handleSave = () => {
    if (!categoriaId) {
      toast.error("Selecione uma categoria");
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
      observacao: observacao.trim(),
      data_despesa: editingDespesa ? undefined : dataDespesa,
    });
  };

  const handleDeleteClick = (despesa: Despesa) => {
    setDeletingDespesa(despesa);
    setDeleteDialogOpen(true);
  };

  const mesLabel = MESES.find(m => m.value === selectedMes)?.label || "";

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
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

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Período:</span>
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
          </div>
        </CardContent>
      </Card>

      {/* Lista de Despesas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Despesas de {mesLabel} {selectedAno}
          </CardTitle>
          <CardDescription>
            {despesas.length} lançamento(s) no período
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : despesas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma despesa lançada neste período
            </div>
          ) : (
            <div className="space-y-3">
              {despesasOrdenadas.map((despesa) => (
                <div
                  key={despesa.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {formatarValor(Number(despesa.valor))}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {despesa.dre_categorias_despesas?.nome || 'Sem categoria'}
                      </Badge>
                    </div>
                    {despesa.observacao && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {despesa.observacao}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {despesa.data_despesa
                        ? format(new Date(despesa.data_despesa + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })
                        : format(new Date(despesa.criado_em), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
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
              <span className="text-xl font-bold text-destructive">
                {formatarValor(totalPeriodo)}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Botão flutuante mobile */}
      <button
        onClick={() => handleOpenDialog()}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all active:scale-95 md:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Dialog de Lançamento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDespesa ? "Editar Despesa" : "Nova Despesa"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Data */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data</label>
              <Input
                type="date"
                value={dataDespesa}
                onChange={(e) => setDataDespesa(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            {/* Categorias como botões rápidos */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria *</label>
              <div className="grid grid-cols-2 gap-2">
                {categorias.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoriaId(cat.id)}
                    className={cn(
                      "text-left px-3 py-2 rounded-lg text-sm border transition-all",
                      categoriaId === cat.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 border-border hover:bg-muted"
                    )}
                  >
                    {cat.nome}
                  </button>
                ))}
              </div>
            </div>

            {/* Valor */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor *</label>
              <Input
                value={valor}
                onChange={(e) => setValor(formatarValorInput(e.target.value))}
                placeholder="0,00"
                inputMode="decimal"
                className="text-lg font-semibold"
                autoFocus={!editingDespesa}
              />
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição (opcional)</label>
              <Input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: Pagamento fornecedor X"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : editingDespesa ? "Salvar" : "Lançar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Despesa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta despesa de{" "}
              <strong>
                {formatarValor(Number(deletingDespesa?.valor || 0))}
              </strong>
              ? Esta ação não pode ser desfeita.
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
    </div>
  );
}
