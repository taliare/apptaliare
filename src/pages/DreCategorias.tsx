import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, FolderOpen, GripVertical } from "lucide-react";

interface Categoria {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
  criado_em: string;
}

export default function DreCategorias() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  // Fetch categorias
  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ["dre-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_categorias_despesas")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data as Categoria[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; nome: string; descricao: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from("dre_categorias_despesas")
          .update({ nome: data.nome, descricao: data.descricao || null })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const maxOrdem = categorias.length > 0 
          ? Math.max(...categorias.map(c => c.ordem)) + 1 
          : 1;
        const { error } = await supabase
          .from("dre_categorias_despesas")
          .insert({ nome: data.nome, descricao: data.descricao || null, ordem: maxOrdem });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dre-categorias"] });
      toast.success(editingCategoria ? "Categoria atualizada!" : "Categoria criada!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao salvar categoria");
      console.error(error);
    },
  });

  // Toggle ativo mutation
  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("dre_categorias_despesas")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dre-categorias"] });
      toast.success("Status atualizado!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar status");
      console.error(error);
    },
  });

  const handleOpenDialog = (categoria?: Categoria) => {
    if (categoria) {
      setEditingCategoria(categoria);
      setNome(categoria.nome);
      setDescricao(categoria.descricao || "");
    } else {
      setEditingCategoria(null);
      setNome("");
      setDescricao("");
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCategoria(null);
    setNome("");
    setDescricao("");
  };

  const handleSave = () => {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    saveMutation.mutate({
      id: editingCategoria?.id,
      nome: nome.trim(),
      descricao: descricao.trim(),
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            Categorias de Despesas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie as categorias do DRE para classificar despesas
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Categoria
        </Button>
      </div>

      {/* Lista de Categorias */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Categorias Cadastradas</CardTitle>
          <CardDescription>
            {categorias.length} categoria(s) no total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : categorias.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma categoria cadastrada
            </div>
          ) : (
            <div className="space-y-2">
              {categorias.map((categoria) => (
                <div
                  key={categoria.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{categoria.nome}</span>
                        {!categoria.ativo && (
                          <Badge variant="outline" className="text-xs">
                            Inativa
                          </Badge>
                        )}
                      </div>
                      {categoria.descricao && (
                        <p className="text-sm text-muted-foreground">
                          {categoria.descricao}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={categoria.ativo}
                      onCheckedChange={(ativo) =>
                        toggleAtivoMutation.mutate({ id: categoria.id, ativo })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(categoria)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Criação/Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategoria ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome *</label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Produção de kits"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição opcional da categoria"
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
    </div>
  );
}
