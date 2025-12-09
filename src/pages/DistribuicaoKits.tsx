import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, closestCenter } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Package, Trash2, Search } from 'lucide-react';

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
    return a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true });
  });
}
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Kit {
  id: string;
  tipo: string;
  codigo: string;
  status: string;
  representante_id: string | null;
}

interface Representante {
  id: string;
  nome: string;
}

function KitCard({ kit, onDelete }: { kit: Kit; onDelete?: (kitId: string) => void }) {
  const tipoColors: Record<string, string> = {
    inicial: 'bg-blue-500',
    especial: 'bg-purple-500',
    maleta: 'bg-green-500',
  };

  return (
    <div className="p-3 bg-card border rounded-lg cursor-move hover:bg-accent/50 transition-colors group">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-sm font-medium">{kit.codigo}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={tipoColors[kit.tipo] || 'bg-gray-500'}>
            {kit.tipo}
          </Badge>
          {onDelete && (
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
  onDeleteKit
}: { 
  id: string; 
  title: string; 
  kits: Kit[];
  onDragOver: (e: React.DragEvent) => void;
  onDeleteKit?: (kitId: string) => void;
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
          <Badge variant="secondary" className="ml-2">{kits.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 flex-1 overflow-y-auto">
        {kits.map(kit => (
          <div 
            key={kit.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('kitId', kit.id);
            }}
            className="cursor-move"
          >
            <KitCard kit={kit} onDelete={onDeleteKit} />
          </div>
        ))}
        {kits.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Nenhum kit
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DistribuicaoKits() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draggedKit, setDraggedKit] = useState<Kit | null>(null);
  const [kitToDelete, setKitToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Verificar se o usuário tem permissão (admin ou producao)
  useEffect(() => {
    if (!authLoading && profile) {
      if (profile.role !== 'admin' && profile.role !== 'producao') {
        navigate('/dashboard');
      }
    }
  }, [profile, authLoading, navigate]);

  const { data: kits = [], isLoading: isLoadingKits } = useQuery({
    queryKey: ['kits-estoque'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kits_estoque')
        .select('*')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data as Kit[];
    },
  });

  const { data: representantes = [], isLoading: isLoadingReps } = useQuery({
    queryKey: ['representantes-ativos'],
    queryFn: async () => {
      // Buscar user_roles com role='representante'
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'representante');

      if (rolesError) {
        console.error('Erro ao buscar roles:', rolesError);
        throw rolesError;
      }

      if (!roles || roles.length === 0) {
        console.log('Nenhuma role de representante encontrada');
        return [];
      }

      const representanteIds = roles.map(r => r.user_id);

      // Buscar profiles dos representantes
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', representanteIds)
        .eq('ativo', true);
      
      if (profilesError) {
        console.error('Erro ao buscar profiles:', profilesError);
        throw profilesError;
      }

      console.log('Representantes encontrados:', profiles);
      return (profiles || []) as Representante[];
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    const kitId = e.dataTransfer.getData('kitId');
    
    if (!kitId) return;

    try {
      const updates: Partial<Kit> = {};
      
      if (targetColumnId === 'estoque') {
        updates.status = 'estoque';
        updates.representante_id = null;
      } else {
        updates.status = 'com_representante';
        updates.representante_id = targetColumnId;
      }

      const { error } = await supabase
        .from('kits_estoque')
        .update(updates)
        .eq('id', kitId);

      if (error) throw error;

      toast.success('Kit movido com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['kits-estoque'] });
      queryClient.invalidateQueries({ queryKey: ['kits-estoque-rep'] });
    } catch (error: any) {
      toast.error('Erro ao mover kit: ' + error.message);
    }
  };

  const handleDeleteKit = async () => {
    if (!kitToDelete) return;

    try {
      const { error } = await supabase
        .from('kits_estoque')
        .delete()
        .eq('id', kitToDelete);

      if (error) throw error;

      toast.success('Kit excluído com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['kits-estoque'] });
      queryClient.invalidateQueries({ queryKey: ['kits-estoque-rep'] });
    } catch (error: any) {
      toast.error('Erro ao excluir kit: ' + error.message);
    } finally {
      setKitToDelete(null);
    }
  };

  // Filtrar kits pela busca
  const filteredKits = useMemo(() => {
    if (!searchQuery.trim()) return kits;
    const query = searchQuery.toLowerCase().trim();
    return kits.filter(k => k.codigo.toLowerCase().includes(query));
  }, [kits, searchQuery]);

  // Kits do estoque, filtrados e ordenados
  const estoqueKits = useMemo(() => {
    const filtered = filteredKits.filter(k => k.status === 'estoque');
    return sortKitsByCodigo(filtered);
  }, [filteredKits]);

  // Função para obter kits de um representante, filtrados e ordenados
  const getRepKits = (repId: string) => {
    const filtered = filteredKits.filter(k => 
      k.representante_id === repId && k.status === 'com_representante'
    );
    return sortKitsByCodigo(filtered);
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
            <p className="text-muted-foreground">Arraste os kits entre estoque e representantes</p>
          </div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Coluna Estoque */}
          <div onDrop={(e) => handleDrop(e, 'estoque')}>
            <DroppableColumn
              id="estoque"
              title="Estoque"
              kits={estoqueKits}
              onDragOver={handleDragOver}
              onDeleteKit={setKitToDelete}
            />
          </div>

          {/* Colunas dos Representantes */}
          {representantes.map(rep => (
            <div key={rep.id} onDrop={(e) => handleDrop(e, rep.id)}>
              <DroppableColumn
                id={rep.id}
                title={rep.nome}
                kits={getRepKits(rep.id)}
                onDragOver={handleDragOver}
              />
            </div>
          ))}
        </div>
      </div>

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
            <AlertDialogAction onClick={handleDeleteKit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
