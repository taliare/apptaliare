import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Package, PackageCheck, Send, RefreshCw } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { formatDateBR } from '@/lib/utils';

export default function T2MeusKits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'disponivel' | 'em_ciclo'>('disponivel');
  const [entregaOpen, setEntregaOpen] = useState(false);
  const [selectedPedidoIds, setSelectedPedidoIds] = useState<string[]>([]);
  const [selectedRevendedora, setSelectedRevendedora] = useState('');
  const [dataVencimento, setDataVencimento] = useState(format(addDays(new Date(), 45), 'yyyy-MM-dd'));

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['t2-meus-kits', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_pedidos')
        .select('*')
        .eq('representante_id', user?.id)
        .order('data_criacao', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: revendedoras = [] } = useQuery({
    queryKey: ['t2-revendedoras-para-entrega'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_revendedoras')
        .select('id, nome_completo, nome_exibicao');
      if (error) throw error;
      return data;
    },
  });

  const filteredPedidos = pedidos.filter((p: any) => p.status === statusFilter);
  const pedidosDisponiveis = pedidos.filter((p: any) => p.status === 'disponivel');

  const valorTotalSelecionado = selectedPedidoIds.reduce((sum, id) => {
    const p = pedidosDisponiveis.find((pd: any) => pd.id === id);
    return sum + (p ? Number(p.valor_total) : 0);
  }, 0);

  const togglePedido = (pedidoId: string) => {
    setSelectedPedidoIds(prev =>
      prev.includes(pedidoId)
        ? prev.filter(id => id !== pedidoId)
        : [...prev, pedidoId]
    );
  };

  const entregarMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRevendedora || selectedPedidoIds.length === 0) {
        throw new Error('Selecione revendedora e pelo menos um pedido');
      }
      const valorKit = valorTotalSelecionado;
      const comissaoPerc = Number(comissao);
      const valorEmpresa = valorKit * (1 - comissaoPerc / 100);

      const { data: cicloData, error: cicloError } = await supabase
        .from('t2_ciclos')
        .insert({
          pedido_id: selectedPedidoIds[0],
          revendedora_id: selectedRevendedora,
          representante_id: user?.id,
          valor_kit: valorKit,
          comissao_percentual: comissaoPerc,
          valor_empresa: valorEmpresa,
          valor_restante: valorKit,
          data_vencimento: new Date(dataVencimento).toISOString(),
          data_cobranca: dataVencimento,
        } as any)
        .select();
      if (cicloError) {
        if (cicloError.message?.includes('t2_ciclos_revendedora_ativo_unique')) {
          throw new Error('Esta revendedora já possui um ciclo ativo.');
        }
        throw cicloError;
      }

      const cicloId = cicloData[0].id;
      const junctionRows = selectedPedidoIds.map(pid => ({ ciclo_id: cicloId, pedido_id: pid }));
      const { error: junctionError } = await supabase
        .from('t2_ciclo_pedidos' as any)
        .insert(junctionRows);
      if (junctionError) throw junctionError;

      for (const pid of selectedPedidoIds) {
        await supabase.from('t2_pedidos').update({ status: 'em_ciclo' }).eq('id', pid);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['t2-meus-kits'] });
      queryClient.invalidateQueries({ queryKey: ['t2-ciclos'] });
      queryClient.invalidateQueries({ queryKey: ['t2-pedidos-disponiveis'] });
      queryClient.invalidateQueries({ queryKey: ['t2-ciclo-pedidos'] });
      resetEntregaForm();
      toast({ title: 'Kit entregue com sucesso!', description: 'Ciclo criado automaticamente.' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao entregar kit', description: err.message, variant: 'destructive' });
    },
  });

  const resetEntregaForm = () => {
    setEntregaOpen(false);
    setSelectedPedidoIds([]);
    setSelectedRevendedora('');
    setComissao('10');
    setDataVencimento(format(addDays(new Date(), 45), 'yyyy-MM-dd'));
  };

  const openEntregaWithPedido = (pedidoId: string) => {
    setSelectedPedidoIds([pedidoId]);
    setEntregaOpen(true);
  };

  const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  const totalDisponivel = pedidos.filter((p: any) => p.status === 'disponivel').length;
  const totalEntregue = pedidos.filter((p: any) => p.status === 'em_ciclo').length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meus Kits</h1>
          <p className="text-sm text-muted-foreground">Kits recebidos da produção — controle e entrega</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={statusFilter === 'disponivel' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('disponivel')}
          >
            <Package className="h-4 w-4 mr-1" />
            Disponíveis ({totalDisponivel})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'em_ciclo' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('em_ciclo')}
          >
            <PackageCheck className="h-4 w-4 mr-1" />
            Entregues ({totalEntregue})
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredPedidos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p>{statusFilter === 'disponivel' ? 'Nenhum kit disponível' : 'Nenhum kit entregue'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPedidos.map((p: any) => (
            <Card key={p.id} className="border border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">{p.codigo_pedido}</CardTitle>
                  <Badge variant={p.status === 'disponivel' ? 'default' : 'secondary'}>
                    {p.status === 'disponivel' ? 'Disponível' : 'Entregue'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Valor: <strong className="text-foreground">R$ {fmt(p.valor_total)}</strong>
                </p>
                <p className="text-muted-foreground">
                  Recebido em: <strong className="text-foreground">{formatDateBR(p.data_criacao)}</strong>
                </p>
                {p.observacao && (
                  <p className="text-muted-foreground text-xs">{p.observacao}</p>
                )}
                {p.status === 'disponivel' && (
                  <Button
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => openEntregaWithPedido(p.id)}
                  >
                    <Send className="h-3 w-3 mr-1" /> Entregar para Revendedora
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Entrega */}
      <Dialog open={entregaOpen} onOpenChange={(open) => {
        if (!open) resetEntregaForm();
        else setEntregaOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entregar Kit para Revendedora</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Revendedora</Label>
              <Select value={selectedRevendedora} onValueChange={setSelectedRevendedora}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {revendedoras.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome_exibicao || r.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Pedidos para entrega</Label>
              <div className="border border-input rounded-md max-h-48 overflow-y-auto mt-1">
                {pedidosDisponiveis.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground text-center">Nenhum pedido disponível</p>
                ) : (
                  pedidosDisponiveis.map((pd: any) => (
                    <label
                      key={pd.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-accent/50 cursor-pointer border-b border-border last:border-b-0"
                    >
                      <Checkbox
                        checked={selectedPedidoIds.includes(pd.id)}
                        onCheckedChange={() => togglePedido(pd.id)}
                      />
                      <span className="text-sm flex-1">
                        <strong>{pd.codigo_pedido}</strong>
                        <span className="text-muted-foreground"> — R$ {fmt(pd.valor_total)}</span>
                      </span>
                    </label>
                  ))
                )}
              </div>
              {selectedPedidoIds.length > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedPedidoIds.length} pedido(s) · Valor total:{' '}
                  <strong className="text-foreground">R$ {fmt(valorTotalSelecionado)}</strong>
                </p>
              )}
            </div>

            <div>
              <Label>Comissão (%)</Label>
              <Input type="number" value={comissao} onChange={e => setComissao(e.target.value)} />
            </div>

            <div>
              <Label>Data de Vencimento / Cobrança</Label>
              <Input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Padrão: 45 dias a partir de hoje</p>
            </div>

            <Button
              className="w-full"
              disabled={!selectedRevendedora || selectedPedidoIds.length === 0 || entregarMutation.isPending}
              onClick={() => entregarMutation.mutate()}
            >
              {entregarMutation.isPending ? 'Entregando...' : 'Confirmar Entrega'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
