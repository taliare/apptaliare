import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { profilesLimited } from '@/lib/profilesLimited';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Package } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Encomenda = {
  id: string;
  representante_id: string;
  tipo_kit: string;
  descricao_pedido: string;
  status: string;
  codigo_kit: string | null;
  criado_em: string;
  representante_nome: string | null;
};

export default function EncomendaProducao() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEncomenda, setSelectedEncomenda] = useState<Encomenda | null>(null);
  const [codigoKit, setCodigoKit] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  const { data: encomendas = [], isLoading } = useQuery({
    queryKey: ['encomendas-producao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('encomendas_kits')
        .select('*')
        .order('criado_em', { ascending: false });

      if (error) throw error;

      // Buscar nomes dos representantes via profiles_limited
      const representanteIds = [...new Set((data || []).map(e => e.representante_id))];
      let namesMap: Record<string, string> = {};

      if (representanteIds.length > 0) {
        const { data: profiles } = await profilesLimited()
          .select('id, nome')
          .in('id', representanteIds);

        if (profiles) {
          namesMap = Object.fromEntries(
            profiles.map((p: { id: string; nome: string }) => [p.id, p.nome])
          );
        }
      }

      return (data || []).map(e => ({
        ...e,
        representante_nome: namesMap[e.representante_id] || null,
      })) as Encomenda[];
    },
  });

  const marcarEmProducao = useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const encomenda = encomendas.find((e) => e.id === id);
      
      const { error } = await supabase
        .from('encomendas_kits')
        .update({
          status: 'em_producao',
          producao_id: userData.user?.id,
        })
        .eq('id', id);

      if (error) throw error;

      // Notificar representante
      if (encomenda) {
        const tipoLabel = { inicial: 'Inicial', especial: 'Especial', maleta: 'Maleta' }[encomenda.tipo_kit] || encomenda.tipo_kit;

        await supabase.from('notifications').insert({
          user_id: encomenda.representante_id,
          title: 'Encomenda em Produção',
          message: `Sua encomenda de kit ${tipoLabel} está sendo produzida`,
          type: 'info',
          link: '/encomendas',
        });

        await supabase.functions.invoke('send-push-notification', {
          body: {
            userId: encomenda.representante_id,
            title: 'Encomenda em Produção',
            body: `Sua encomenda de kit ${tipoLabel} está sendo produzida`,
          },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encomendas-producao'] });
      toast.success('Encomenda marcada como em produção');
      setModalOpen(false);
    },
    onError: () => {
      toast.error('Erro ao atualizar encomenda');
    },
  });

  const finalizarEncomenda = useMutation({
    mutationFn: async ({ id, codigo }: { id: string; codigo: string }) => {
      const encomenda = encomendas.find((e) => e.id === id);
      
      // Atualizar encomenda
      const { error: encomendaError } = await supabase
        .from('encomendas_kits')
        .update({
          status: 'pronto',
          codigo_kit: codigo,
        })
        .eq('id', id);

      if (encomendaError) throw encomendaError;

      // Criar kit no estoque
      if (encomenda) {
        const { error: kitError } = await supabase.from('kits_estoque').insert({
          tipo: encomenda.tipo_kit,
          codigo: codigo,
          status: 'estoque',
          representante_id: null,
        });

        if (kitError) throw kitError;

        // Notificar representante
        const tipoLabel = { inicial: 'Inicial', especial: 'Especial', maleta: 'Maleta' }[encomenda.tipo_kit] || encomenda.tipo_kit;

        await supabase.from('notifications').insert({
          user_id: encomenda.representante_id,
          title: 'Encomenda Pronta!',
          message: `Sua encomenda de kit ${tipoLabel} está pronta. Código: ${codigo}`,
          type: 'success',
          link: '/encomendas',
        });

        await supabase.functions.invoke('send-push-notification', {
          body: {
            userId: encomenda.representante_id,
            title: 'Encomenda Pronta!',
            body: `Sua encomenda de kit ${tipoLabel} está pronta. Código: ${codigo}`,
          },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encomendas-producao'] });
      toast.success('Encomenda finalizada e kit adicionado ao estoque');
      setModalOpen(false);
      setCodigoKit('');
    },
    onError: () => {
      toast.error('Erro ao finalizar encomenda');
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
      solicitado: { label: 'Solicitado', variant: 'default' },
      em_producao: { label: 'Em Produção', variant: 'secondary' },
      pronto: { label: 'Pronto', variant: 'outline' },
      cancelado: { label: 'Cancelado', variant: 'destructive' },
    };

    const config = variants[status] || variants.solicitado;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTipoKitLabel = (tipo: string) => {
    const tipos: Record<string, string> = {
      inicial: 'Inicial',
      especial: 'Especial',
      maleta: 'Maleta',
    };
    return tipos[tipo] || tipo;
  };

  const handleOpenModal = (encomenda: Encomenda) => {
    setSelectedEncomenda(encomenda);
    setModalOpen(true);
  };

  const handleFinalizar = () => {
    if (!codigoKit.trim()) {
      toast.error('Informe o código do kit');
      return;
    }
    if (selectedEncomenda) {
      finalizarEncomenda.mutate({ id: selectedEncomenda.id, codigo: codigoKit });
    }
  };

  const encomendasFiltradas = encomendas.filter((e) => 
    filtroStatus === 'todos' ? true : e.status === filtroStatus
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Encomendas</h1>
        <p className="text-muted-foreground">Gerencie as encomendas dos representantes</p>
      </div>

      <Tabs value={filtroStatus} onValueChange={setFiltroStatus}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="solicitado">
            Solicitado
            {encomendas.filter((e) => e.status === 'solicitado').length > 0 && (
              <Badge className="ml-2" variant="default">
                {encomendas.filter((e) => e.status === 'solicitado').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="em_producao">Em Produção</TabsTrigger>
          <TabsTrigger value="pronto">Pronto</TabsTrigger>
        </TabsList>

        <TabsContent value={filtroStatus} className="mt-6">
          <Card className="p-6">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando encomendas...</div>
            ) : encomendasFiltradas.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhuma encomenda encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Representante</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {encomendasFiltradas.map((encomenda) => (
                    <TableRow key={encomenda.id}>
                      <TableCell>
                        {format(new Date(encomenda.criado_em), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>{encomenda.representante_nome ?? '—'}</TableCell>
                      <TableCell>{getTipoKitLabel(encomenda.tipo_kit)}</TableCell>
                      <TableCell>{getStatusBadge(encomenda.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenModal(encomenda)}
                        >
                          Ver Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da Encomenda</DialogTitle>
          </DialogHeader>
          {selectedEncomenda && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-muted-foreground">Representante</Label>
                <p className="font-medium">{selectedEncomenda.representante_nome ?? '—'}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Tipo de Kit</Label>
                <p className="font-medium">{getTipoKitLabel(selectedEncomenda.tipo_kit)}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Descrição do Pedido</Label>
                <p className="text-sm">{selectedEncomenda.descricao_pedido}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Status Atual</Label>
                <div className="mt-1">{getStatusBadge(selectedEncomenda.status)}</div>
              </div>

              <div className="pt-4 space-y-3">
                {selectedEncomenda.status === 'solicitado' && (
                  <Button
                    onClick={() => marcarEmProducao.mutate(selectedEncomenda.id)}
                    className="w-full"
                    disabled={marcarEmProducao.isPending}
                  >
                    {marcarEmProducao.isPending ? 'Atualizando...' : 'Marcar como Em Produção'}
                  </Button>
                )}

                {selectedEncomenda.status === 'em_producao' && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="codigo_kit">Código do Kit</Label>
                      <Input
                        id="codigo_kit"
                        placeholder="Ex: KIT-2024-001"
                        value={codigoKit}
                        onChange={(e) => setCodigoKit(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleFinalizar}
                      className="w-full"
                      disabled={finalizarEncomenda.isPending}
                    >
                      {finalizarEncomenda.isPending ? 'Finalizando...' : 'Encomenda Criada / Finalizar'}
                    </Button>
                  </div>
                )}

                {selectedEncomenda.status === 'pronto' && selectedEncomenda.codigo_kit && (
                  <div>
                    <Label className="text-muted-foreground">Código do Kit</Label>
                    <p className="font-mono font-semibold text-lg">{selectedEncomenda.codigo_kit}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
