import { useEffect, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCenter, DragOverEvent } from '@dnd-kit/core';
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
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm">{kit.codigo}</span>
        <Badge className={tipoColors[kit.tipo] || 'bg-gray-500'}>
          {kit.tipo}
        </Badge>
      </div>
    </div>
  );
}

function Droppable({ id, title, kits }: { id: string; title: string; kits: Kit[] }) {
  return (
    <Card className="min-h-[300px]" data-droppable-id={id}>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          {title}
          <Badge variant="secondary">{kits.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {kits.map(kit => (
          <div key={kit.id} draggable onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('kitId', kit.id);
          }}>
            <KitCard kit={kit} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function DistribuicaoKits() {
  const queryClient = useQueryClient();
  const [activeKit, setActiveKit] = useState<Kit | null>(null);

  const { data: kits = [] } = useQuery({
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

  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .eq('ativo', true);
      if (error) throw error;
      return data as Representante[];
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const kitId = event.active.id as string;
    const kit = kits.find(k => k.id === kitId);
    if (kit) setActiveKit(kit);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveKit(null);

    if (!over || active.id === over.id) return;

    const kitId = active.id as string;
    const targetId = over.id as string;

    try {
      const updates: Partial<Kit> = {};
      
      if (targetId === 'estoque') {
        updates.status = 'estoque';
        updates.representante_id = null;
      } else {
        updates.status = 'com_representante';
        updates.representante_id = targetId;
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
      toast.error(error.message);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const kitId = e.dataTransfer.getData('kitId');
    
    if (!kitId) return;

    try {
      const updates: Partial<Kit> = {};
      
      if (targetId === 'estoque') {
        updates.status = 'estoque';
        updates.representante_id = null;
      } else {
        updates.status = 'com_representante';
        updates.representante_id = targetId;
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
      toast.error(error.message);
    }
  };

  const estoqueKits = kits.filter(k => k.status === 'estoque');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Distribuição de Kits</h1>
        <p className="text-muted-foreground">Arraste os kits entre estoque e representantes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div 
          onDrop={(e) => handleDrop(e, 'estoque')} 
          onDragOver={(e) => e.preventDefault()}
        >
          <Card className="min-h-[300px]">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Mostruários em Estoque
                <Badge variant="secondary">{estoqueKits.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {estoqueKits.map(kit => (
                <div 
                  key={kit.id} 
                  draggable 
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('kitId', kit.id);
                  }}
                >
                  <KitCard kit={kit} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {representantes.map(rep => {
          const repKits = kits.filter(k => k.representante_id === rep.id && k.status === 'com_representante');
          return (
            <div 
              key={rep.id}
              onDrop={(e) => handleDrop(e, rep.id)} 
              onDragOver={(e) => e.preventDefault()}
            >
              <Card className="min-h-[300px]">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    {rep.nome}
                    <Badge variant="secondary">{repKits.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {repKits.map(kit => (
                    <div 
                      key={kit.id} 
                      draggable 
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('kitId', kit.id);
                      }}
                    >
                      <KitCard kit={kit} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}