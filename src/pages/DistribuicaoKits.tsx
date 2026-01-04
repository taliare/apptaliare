import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
} from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package, Trash2, Search, Pencil, CheckSquare, Square, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

// Função para ordenar kits por código numérico/alfanumérico
function sortKitsByCodigo(kits: Kit[]): Kit[] {
  return [...kits].sort((a, b) => {
    const numA = parseFloat(a.codigo);
    const numB = parseFloat(b.codigo);

    // Se ambos são numéricos, ordenar por valor
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    // Se apenas um é numérico, o numérico vem primeiro
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    // Se ambos são alfanuméricos, ordenar como string
    return a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true });
  });
}

interface Kit {
  id: string;
  tipo: string;
  codigo: string;
  status: string;
  representante_id: string | null;
  valor: number | null;
}

interface Representante {
  id: string;
  nome: string;
}

function KitCard({
  kit,
  onDelete,
  onEdit,
  selectionMode,
  isSelected,
  onToggleSelect,
}: {
  kit: Kit;
  onDelete?: (kitId: string) => void;
  onEdit?: (kit: Kit) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (kitId: string) => void;
}) {
  const tipoColors: Record<string, string> = {
    inicial: "bg-blue-500",
    especial: "bg-purple-500",
    maleta: "bg-green-500",
  };

  return (
    <div 
      className={`p-3 bg-card border rounded-lg transition-colors group ${
        selectionMode 
          ? "cursor-pointer hover:bg-accent/50" 
          : "cursor-move hover:bg-accent/50"
      } ${isSelected ? "ring-2 ring-primary bg-primary/5" : ""}`}
      onClick={selectionMode ? () => onToggleSelect?.(kit.id) : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {selectionMode && (
            <Checkbox 
              checked={isSelected} 
              onCheckedChange={() => onToggleSelect?.(kit.id)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-sm font-medium">{kit.codigo}</span>
        </div>
        <div className="flex items-center gap-1">
          <Badge className={tipoColors[kit.tipo] || "bg-gray-500"}>{kit.tipo}</Badge>
          {!selectionMode && onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(kit);
              }}
            >
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </Button>
          )}
          {!selectionMode && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(kit.id);
              }}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({
  id,
  title,
  kits,
  onDragOver,
  onDeleteKit,
  onEditKit,
  selectionMode,
  selectedKits,
  onToggleSelect,
}: {
  id: string;
  title: string;
  kits: Kit[];
  onDragOver: (e: React.DragEvent) => void;
  onDeleteKit?: (kitId: string) => void;
  onEditKit?: (kit: Kit) => void;
  selectionMode?: boolean;
  selectedKits?: Set<string>;
  onToggleSelect?: (kitId: string) => void;
}) {
  return (
    <Card
      className="min-h-[400px] flex flex-col"
      onDragOver={onDragOver}
      onDrop={(e) => e.preventDefault()}
      data-column-id={id}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="truncate">{title}</span>
          <Badge variant="secondary" className="ml-2">
            {kits.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 flex-1 overflow-y-auto">
        {kits.map((kit) => (
          <div
            key={kit.id}
            draggable={!selectionMode}
            onDragStart={(e) => {
              if (selectionMode) {
                e.preventDefault();
                return;
              }
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("kitId", kit.id);
            }}
            className={selectionMode ? "" : "cursor-move"}
          >
            <KitCard 
              kit={kit} 
              onDelete={onDeleteKit} 
              onEdit={onEditKit}
              selectionMode={selectionMode}
              isSelected={selectedKits?.has(kit.id)}
              onToggleSelect={onToggleSelect}
            />
          </div>
        ))}
        {kits.length === 0 && <div className="text-center text-muted-foreground text-sm py-8">Nenhum kit</div>}
      </CardContent>
    </Card>
  );
}

// Função para formatar valor como moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

// Função para parsear valor de moeda brasileira para número
function parseCurrency(value: string): number {
  // Remove "R$", espaços e caracteres não numéricos (exceto , e .)
  let cleaned = value.replace(/R\$\s?/g, "").trim();
  // Remove separador de milhar (ponto) - ex: "1.000,00" -> "1000,00"
  cleaned = cleaned.replace(/\./g, "");
  // Troca vírgula decimal por ponto - ex: "1000,00" -> "1000.00"
  cleaned = cleaned.replace(",", ".");
  return parseFloat(cleaned) || 0;
}

export default function DistribuicaoKits() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draggedKit, setDraggedKit] = useState<Kit | null>(null);
  const [kitToDelete, setKitToDelete] = useState<string | null>(null);
  const [kitToEdit, setKitToEdit] = useState<Kit | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Estado do formulário de edição
  const [editCodigo, setEditCodigo] = useState("");
  const [editValor, setEditValor] = useState("");
  const [editTipo, setEditTipo] = useState("");
  const [editRepresentante, setEditRepresentante] = useState<string>("__estoque__");

  // Estado para seleção em lote
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKits, setSelectedKits] = useState<Set<string>>(new Set());
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [batchRepresentante, setBatchRepresentante] = useState<string>("");
  const [isBatchLoading, setIsBatchLoading] = useState(false);

  // Verificar se o usuário tem permissão (admin ou producao)
  useEffect(() => {
    if (!authLoading && profile) {
      if (profile.role !== "admin" && profile.role !== "producao") {
        navigate("/dashboard");
      }
    }
  }, [profile, authLoading, navigate]);

  // Quando abrir o modal de edição, preencher os campos
  useEffect(() => {
    if (kitToEdit) {
      setEditCodigo(kitToEdit.codigo);
      // Converte valor numérico para formato BR (ex: 1000.5 -> "1000,5")
      setEditValor(kitToEdit.valor != null ? String(kitToEdit.valor).replace('.', ',') : "");
      setEditTipo(kitToEdit.tipo);
      setEditRepresentante("__estoque__"); // Padrão: manter no estoque
      setIsEditDialogOpen(true);
    }
  }, [kitToEdit]);

  const { data: kits = [], isLoading: isLoadingKits } = useQuery({
    queryKey: ["kits-estoque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kits_estoque")
        .select("*")
        .in("status", ["estoque", "com_representante"]) // Excluir kits já entregues (com_revendedora)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data as Kit[];
    },
  });

  const { data: representantes = [], isLoading: isLoadingReps } = useQuery({
    queryKey: ["representantes-ativos"],
    queryFn: async () => {
      // Buscar user_roles com role='representante'
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "representante");

      if (rolesError) {
        console.error("Erro ao buscar roles:", rolesError);
        throw rolesError;
      }

      if (!roles || roles.length === 0) {
        console.log("Nenhuma role de representante encontrada");
        return [];
      }

      const representanteIds = roles.map((r) => r.user_id);

      // Buscar profiles dos representantes
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", representanteIds)
        .eq("ativo", true);

      if (profilesError) {
        console.error("Erro ao buscar profiles:", profilesError);
        throw profilesError;
      }

      console.log("Representantes encontrados:", profiles);
      return (profiles || []) as Representante[];
    },
  });

  // Mutation para editar kit
  const editMutation = useMutation({
    mutationFn: async ({ 
      id, 
      codigo, 
      valor, 
      tipo,
      representante_id,
      status 
    }: { 
      id: string; 
      codigo: string; 
      valor: number; 
      tipo: string;
      representante_id: string | null;
      status: string;
    }) => {
      console.log("Atualizando kit:", { id, codigo, valor, tipo, representante_id, status });

      const { data, error } = await supabase
        .from("kits_estoque")
        .update({ codigo, valor, tipo, representante_id, status })
        .eq("id", id)
        .select();

      if (error) {
        console.error("Erro no update:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error("Kit não encontrado");
      }

      console.log("Kit atualizado:", data);
      return data;
    },
    onSuccess: (_, variables) => {
      const mensagem = variables.representante_id 
        ? "Kit atualizado e distribuído com sucesso!" 
        : "Kit atualizado com sucesso!";
      toast.success(mensagem);
      // Close dialog first, then clear kit data and invalidate after animation completes
      setIsEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar kit: " + error.message);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    const kitId = e.dataTransfer.getData("kitId");

    if (!kitId) return;

    try {
      const updates: Partial<Kit> = {};

      if (targetColumnId === "estoque") {
        updates.status = "estoque";
        updates.representante_id = null;
      } else {
        updates.status = "com_representante";
        updates.representante_id = targetColumnId;
      }

      const { error } = await supabase.from("kits_estoque").update(updates).eq("id", kitId);

      if (error) throw error;

      toast.success("Kit movido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["kits-estoque"] });
      queryClient.invalidateQueries({ queryKey: ["kits-estoque-rep"] });
    } catch (error: any) {
      toast.error("Erro ao mover kit: " + error.message);
    }
  };

  const handleDeleteKit = async () => {
    if (!kitToDelete) return;

    try {
      const { error } = await supabase.from("kits_estoque").delete().eq("id", kitToDelete);

      if (error) throw error;

      toast.success("Kit excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["kits-estoque"] });
      queryClient.invalidateQueries({ queryKey: ["kits-estoque-rep"] });
    } catch (error: any) {
      toast.error("Erro ao excluir kit: " + error.message);
    } finally {
      setKitToDelete(null);
    }
  };

  const handleSaveEdit = () => {
    if (!kitToEdit) return;

    const codigo = editCodigo.trim();
    if (!codigo) {
      toast.error("O código do kit é obrigatório");
      return;
    }

    // Converte valor BR para número: "1.000,50" -> 1000.50
    const valorNum = parseFloat(
      editValor.replace(/\./g, "").replace(",", ".")
    ) || 0;

    // Determinar se vai distribuir ou manter no estoque
    const novoRepresentante = editRepresentante === "__estoque__" ? null : editRepresentante;
    const novoStatus = novoRepresentante ? "com_representante" : "estoque";

    editMutation.mutate({
      id: kitToEdit.id,
      codigo,
      valor: valorNum,
      tipo: editTipo,
      representante_id: novoRepresentante,
      status: novoStatus,
    });
  };

  // Filtrar kits pela busca
  const filteredKits = useMemo(() => {
    if (!searchQuery.trim()) return kits;
    const query = searchQuery.toLowerCase().trim();
    return kits.filter((k) => k.codigo.toLowerCase().includes(query));
  }, [kits, searchQuery]);

  // Kits do estoque, filtrados e ordenados
  const estoqueKits = useMemo(() => {
    const filtered = filteredKits.filter((k) => k.status === "estoque");
    return sortKitsByCodigo(filtered);
  }, [filteredKits]);

  // Função para obter kits de um representante, filtrados e ordenados
  const getRepKits = (repId: string) => {
    const filtered = filteredKits.filter((k) => k.representante_id === repId && k.status === "com_representante");
    return sortKitsByCodigo(filtered);
  };

  // Toggle seleção de kit
  const toggleKitSelection = (kitId: string) => {
    setSelectedKits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(kitId)) {
        newSet.delete(kitId);
      } else {
        newSet.add(kitId);
      }
      return newSet;
    });
  };

  // Selecionar/desselecionar todos os kits do estoque
  const toggleSelectAll = () => {
    if (selectedKits.size === estoqueKits.length) {
      setSelectedKits(new Set());
    } else {
      setSelectedKits(new Set(estoqueKits.map(k => k.id)));
    }
  };

  // Cancelar modo de seleção
  const cancelSelectionMode = () => {
    setSelectionMode(false);
    setSelectedKits(new Set());
  };

  // Distribuir kits em lote
  const handleBatchDistribution = async () => {
    if (!batchRepresentante || selectedKits.size === 0) {
      toast.error("Selecione um representante");
      return;
    }

    setIsBatchLoading(true);
    try {
      const kitIds = Array.from(selectedKits);
      const { error } = await supabase
        .from("kits_estoque")
        .update({ 
          status: "com_representante", 
          representante_id: batchRepresentante 
        })
        .in("id", kitIds);

      if (error) throw error;

      const repNome = representantes.find(r => r.id === batchRepresentante)?.nome || "";
      toast.success(`${kitIds.length} kit(s) distribuído(s) para ${repNome}!`);
      
      queryClient.invalidateQueries({ queryKey: ["kits-estoque"] });
      queryClient.invalidateQueries({ queryKey: ["kits-estoque-rep"] });
      
      setIsBatchDialogOpen(false);
      setBatchRepresentante("");
      setSelectedKits(new Set());
      setSelectionMode(false);
    } catch (error: any) {
      toast.error("Erro ao distribuir kits: " + error.message);
    } finally {
      setIsBatchLoading(false);
    }
  };

  if (isLoadingKits || isLoadingReps) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Distribuição de Kits</h1>
            <p className="text-muted-foreground">
              {selectionMode 
                ? `${selectedKits.size} kit(s) selecionado(s)` 
                : "Arraste os kits entre estoque e representantes"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectionMode ? (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {selectedKits.size === estoqueKits.length ? (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      Desmarcar todos
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Selecionar todos
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={cancelSelectionMode}
                >
                  Cancelar
                </Button>
                <Button 
                  size="sm"
                  disabled={selectedKits.size === 0}
                  onClick={() => setIsBatchDialogOpen(true)}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Distribuir ({selectedKits.size})
                </Button>
              </>
            ) : (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectionMode(true)}
                disabled={estoqueKits.length === 0}
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Selecionar em lote
              </Button>
            )}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Coluna Estoque - com opções de excluir e editar */}
          <div onDrop={(e) => handleDrop(e, "estoque")}>
            <DroppableColumn
              id="estoque"
              title="Estoque"
              kits={estoqueKits}
              onDragOver={handleDragOver}
              onDeleteKit={setKitToDelete}
              onEditKit={setKitToEdit}
              selectionMode={selectionMode}
              selectedKits={selectedKits}
              onToggleSelect={toggleKitSelection}
            />
          </div>

          {/* Colunas dos Representantes - sem opções de excluir/editar */}
          {representantes.map((rep) => (
            <div key={rep.id} onDrop={(e) => handleDrop(e, rep.id)}>
              <DroppableColumn id={rep.id} title={rep.nome} kits={getRepKits(rep.id)} onDragOver={handleDragOver} />
            </div>
          ))}
        </div>
      </div>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!kitToDelete} onOpenChange={(open) => !open && setKitToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este kit do estoque? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteKit}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de edição do kit */}
      <Dialog 
        open={isEditDialogOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setIsEditDialogOpen(false);
            // Delay clearing the kit data and invalidating queries until dialog animation completes
            setTimeout(() => {
              setKitToEdit(null);
              queryClient.invalidateQueries({ queryKey: ["kits-estoque"] });
            }, 150);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Kit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-codigo">Código do Kit</Label>
              <Input
                id="edit-codigo"
                value={editCodigo}
                onChange={(e) => setEditCodigo(e.target.value)}
                placeholder="Ex: 001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-valor">Valor do Kit</Label>
              <Input
                id="edit-valor"
                value={editValor}
                onChange={(e) => setEditValor(e.target.value)}
                inputMode="decimal"
                placeholder="Ex: 120,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tipo">Tipo do Kit</Label>
              <Select value={editTipo} onValueChange={setEditTipo}>
                <SelectTrigger id="edit-tipo">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inicial">Inicial</SelectItem>
                  <SelectItem value="especial">Especial</SelectItem>
                  <SelectItem value="maleta">Maleta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-representante">Distribuir para Representante (opcional)</Label>
              <Select value={editRepresentante} onValueChange={setEditRepresentante}>
                <SelectTrigger id="edit-representante">
                  <SelectValue placeholder="Manter no estoque" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__estoque__">Manter no estoque</SelectItem>
                  {representantes.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={editMutation.isPending}>
              {editMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de distribuição em lote */}
      <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Distribuir Kits em Lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Você selecionou <strong>{selectedKits.size}</strong> kit(s) para distribuir.
            </p>
            <div className="space-y-2">
              <Label htmlFor="batch-representante">Selecione o Representante</Label>
              <Select value={batchRepresentante} onValueChange={setBatchRepresentante}>
                <SelectTrigger id="batch-representante">
                  <SelectValue placeholder="Escolha um representante" />
                </SelectTrigger>
                <SelectContent>
                  {representantes.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBatchDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBatchDistribution} disabled={!batchRepresentante || isBatchLoading}>
              {isBatchLoading ? "Distribuindo..." : "Confirmar Distribuição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
