import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, closestCenter } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Package } from 'lucide-react';

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

function KitCard({ kit }: { kit: Kit }) {
  const tipoColors: Record<string, string> = {
    inicial: 'bg-blue-500',
    especial: 'bg-purple-500',
    maleta: 'bg-green-500',
  };

  return (
    <div className="p-3 bg-card border rounded-lg cursor-move hover:bg-accent/50 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-sm font-medium">{kit.codigo}</span>
        </div>
        <Badge className={tipoColors[kit.tipo] || 'bg-gray-500'}>
          {kit.tipo}
        </Badge>
      </div>
    </div>
  );
}

function DroppableColumn({ 
  id, 
  title, 
  kits, 
  onDragOver 
}: { 
  id: string; 
  title: string; 
  kits: Kit[];
  onDragOver: (e: React.DragEvent) => void;
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
            <KitCard kit={kit} />
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
  const queryClient = useQueryClient();
  const [draggedKit, setDraggedKit] = useState<Kit | null>(null);

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
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome')
        .eq('ativo', true);
      
      if (profilesError) throw profilesError;

      // Filter only users with representante role
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'representante');

      if (rolesError) throw rolesError;

      const representanteIds = new Set(roles.map(r => r.user_id));
      const reps = profiles.filter(p => representanteIds.has(p.id));

      return reps as Representante[];
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

  const estoqueKits = kits.filter(k => k.status === 'estoque');

  if (isLoadingKits || isLoadingReps) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Distribuição de Kits</h1>
        <p className="text-muted-foreground">Arraste os kits entre estoque e representantes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Coluna Estoque */}
        <div onDrop={(e) => handleDrop(e, 'estoque')}>
          <DroppableColumn
            id="estoque"
            title="Estoque"
            kits={estoqueKits}
            onDragOver={handleDragOver}
          />
        </div>

        {/* Colunas dos Representantes */}
        {representantes.map(rep => {
          const repKits = kits.filter(k => 
            k.representante_id === rep.id && k.status === 'com_representante'
          );
          return (
            <div key={rep.id} onDrop={(e) => handleDrop(e, rep.id)}>
              <DroppableColumn
                id={rep.id}
                title={rep.nome}
                kits={repKits}
                onDragOver={handleDragOver}
              />
            </div>
          );
        })}
      </div>

      {representantes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum representante cadastrado no sistema
        </div>
      )}
    </div>
  );
}
