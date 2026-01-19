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
  criado_em: string;
  dre_categorias_despesas: Categoria | null;
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

  // Agrupar despesas por categoria
  const despesasAgrupadas = useMemo(() => {
    const grouped: Record<string, { categoria: string; despesas: Despesa[]; total: number }> = {};
    
    despesas.forEach((d) => {
      const catId = d.categoria_id || "sem-categoria";
      const catNome = d.dre_categorias_despesas?.nome || "Sem categoria";
      
      if (!grouped[catId]) {
        grouped[catId] = { categoria: catNome, despesas: [], total: 0 };
      }
      grouped[catId].despesas.push(d);
      grouped[catId].total += Number(d.valor);
    });
    
    return Object.values(grouped).sort((a, b) => a.categoria.localeCompare(b.categoria));
  }, [despesas]);

  const totalPeriodo = despesas.reduce((sum, d) => sum + Number(d.valor), 0);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; categoria_id: string; valor: number; observacao: string }) => {
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
    } else {
      setEditingDespesa(null);
      setCategoriaId("");
      setValor("");
      setObservacao("");
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingDespesa(null);
    setCategoriaId("");
    setValor("");
    setObservacao("");
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
        <Button onClick={() => handleOpenDialog()} className="gap-2">
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
            <div className="space-y-6">
              {despesasAgrupadas.map((grupo) => (
                <div key={grupo.categoria}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      {grupo.categoria}
                    </h3>
                    <Badge variant="outline">
                      R$ {grupo.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {grupo.despesas.map((despesa) => (
                      <div
                        key={despesa.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <p className="font-medium">
                            R$ {Number(despesa.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                          {despesa.observacao && (
                            <p className="text-sm text-muted-foreground">
                              {despesa.observacao}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(despesa)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(despesa)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
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
                R$ {totalPeriodo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Dialog de Lançamento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDespesa ? "Editar Despesa" : "Nova Despesa"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Competência</label>
              <Input
                value={`${mesLabel} ${selectedAno}`}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria *</label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor *</label>
              <Input
                value={valor}
                onChange={(e) => setValor(formatarValorInput(e.target.value))}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Observação</label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Descrição opcional da despesa"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
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
                R$ {Number(deletingDespesa?.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
