import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Plus, Filter, DollarSign, Clock, User } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  closestCorners,
  useDraggable,
  useDroppable,
  DragStartEvent
} from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';
import type { Database } from '@/integrations/supabase/types';

type StatusCobranca = Database['public']['Enums']['status_cobranca'];
type Cobranca = Database['public']['Tables']['cobrancas_agendadas']['Row'];

interface CobrancaFormData {
  revendedora: string;
  valor_previsto: string;
  data_agendada: string;
  observacoes: string;
}

const statusConfig: Record<StatusCobranca, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' },
  pago: { label: 'Pago', color: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  parcial: { label: 'Parcial', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  reagendado: { label: 'Reagendado', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400' },
};

export default function Cobranca() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCobranca, setEditingCobranca] = useState<Cobranca | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('');
  
  const [formData, setFormData] = useState<CobrancaFormData>({
    revendedora: '',
    valor_previsto: '',
    data_agendada: format(new Date(), 'yyyy-MM-dd'),
    observacoes: '',
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  const { data: cobrancas = [], isLoading } = useQuery({
    queryKey: ['cobrancas-agendadas', userId, dateFilter],
    queryFn: async () => {
      if (!userId) return [];
      
      let query = supabase
        .from('cobrancas_agendadas')
        .select('*')
        .eq('representante_id', userId)
        .order('data_agendada', { ascending: true });

      if (dateFilter) {
        const startDate = new Date(dateFilter);
        const endDate = new Date(dateFilter);
        endDate.setMonth(endDate.getMonth() + 1);
        
        query = query
          .gte('data_agendada', startDate.toISOString())
          .lt('data_agendada', endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Cobranca[];
    },
    enabled: !!userId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CobrancaFormData) => {
      if (!userId) throw new Error('Usuário não autenticado');
      
      const { error } = await supabase.from('cobrancas_agendadas').insert({
        representante_id: userId,
        revendedora: data.revendedora,
        valor_previsto: parseFloat(data.valor_previsto),
        data_agendada: data.data_agendada,
        observacoes: data.observacoes || null,
        status: 'pendente',
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      toast({ title: 'Cobrança criada com sucesso!' });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao criar cobrança', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Cobranca> }) => {
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      toast({ title: 'Cobrança atualizada com sucesso!' });
      setIsDialogOpen(false);
      setEditingCobranca(null);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar cobrança', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      toast({ title: 'Cobrança excluída com sucesso!' });
    },
    onError: () => {
      toast({ title: 'Erro ao excluir cobrança', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      revendedora: '',
      valor_previsto: '',
      data_agendada: format(new Date(), 'yyyy-MM-dd'),
      observacoes: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.revendedora || !formData.valor_previsto) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    if (editingCobranca) {
      updateMutation.mutate({
        id: editingCobranca.id,
        data: {
          revendedora: formData.revendedora,
          valor_previsto: parseFloat(formData.valor_previsto),
          data_agendada: formData.data_agendada,
          observacoes: formData.observacoes || null,
        },
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (cobranca: Cobranca) => {
    setEditingCobranca(cobranca);
    setFormData({
      revendedora: cobranca.revendedora,
      valor_previsto: cobranca.valor_previsto.toString(),
      data_agendada: cobranca.data_agendada,
      observacoes: cobranca.observacoes || '',
    });
    setIsDialogOpen(true);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const cobrancaId = active.id as string;
    const newStatus = over.id as StatusCobranca;
    
    const cobranca = cobrancas.find(c => c.id === cobrancaId);
    if (!cobranca || cobranca.status === newStatus) return;

    updateMutation.mutate({
      id: cobrancaId,
      data: { status: newStatus },
    });
  };

  const getCobrancasByStatus = (status: StatusCobranca) => {
    return cobrancas.filter(c => c.status === status);
  };

  const activeCobranca = activeId ? cobrancas.find(c => c.id === activeId) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Kanban de Cobrança</h1>
          <p className="text-muted-foreground">Gerencie suas cobranças agendadas</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingCobranca(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Cobrança
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCobranca ? 'Editar Cobrança' : 'Nova Cobrança'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="revendedora">Revendedora *</Label>
                <Input
                  id="revendedora"
                  value={formData.revendedora}
                  onChange={(e) => setFormData({ ...formData, revendedora: e.target.value })}
                  placeholder="Nome da revendedora"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="valor_previsto">Valor Previsto *</Label>
                <Input
                  id="valor_previsto"
                  type="number"
                  step="0.01"
                  value={formData.valor_previsto}
                  onChange={(e) => setFormData({ ...formData, valor_previsto: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="data_agendada">Data Agendada *</Label>
                <Input
                  id="data_agendada"
                  type="date"
                  value={formData.data_agendada}
                  onChange={(e) => setFormData({ ...formData, data_agendada: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingCobranca(null);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingCobranca ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-filter">Filtrar por mês</Label>
              <Input
                id="date-filter"
                type="month"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-48"
              />
            </div>
            {dateFilter && (
              <Button
                variant="outline"
                onClick={() => setDateFilter('')}
                className="self-end"
              >
                Limpar Filtro
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.keys(statusConfig) as StatusCobranca[]).map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              title={statusConfig[status].label}
              cobrancas={getCobrancasByStatus(status)}
              onEdit={handleEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCobranca && (
            <CobrancaCard
              cobranca={activeCobranca}
              isDragging
              onEdit={() => {}}
              onDelete={() => {}}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

interface KanbanColumnProps {
  status: StatusCobranca;
  title: string;
  cobrancas: Cobranca[];
  onEdit: (cobranca: Cobranca) => void;
  onDelete: (id: string) => void;
}

function KanbanColumn({ status, title, cobrancas, onEdit, onDelete }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <Card ref={setNodeRef} className="min-h-[500px]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge variant="secondary">{cobrancas.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {cobrancas.map((cobranca) => (
          <CobrancaCard
            key={cobranca.id}
            cobranca={cobranca}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {cobrancas.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Nenhuma cobrança
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CobrancaCardProps {
  cobranca: Cobranca;
  isDragging?: boolean;
  onEdit: (cobranca: Cobranca) => void;
  onDelete: (id: string) => void;
}

function CobrancaCard({ cobranca, isDragging = false, onEdit, onDelete }: CobrancaCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: cobranca.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{cobranca.revendedora}</h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <DollarSign className="h-3 w-3" />
              <span>R$ {cobranca.valor_previsto.toFixed(2)}</span>
            </div>
          </div>
          <Badge className={statusConfig[cobranca.status!].color}>
            {statusConfig[cobranca.status!].label}
          </Badge>
        </div>

        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{format(new Date(cobranca.data_agendada), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
        </div>

        {cobranca.observacoes && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {cobranca.observacoes}
          </p>
        )}

        <div className="flex gap-2 pt-2 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(cobranca);
            }}
            className="flex-1"
          >
            Editar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Deseja realmente excluir esta cobrança?')) {
                onDelete(cobranca.id);
              }
            }}
            className="flex-1"
          >
            Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
