import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Plus, RefreshCw } from 'lucide-react';
import { format, addDays } from 'date-fns';

const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  inadimplente: 'Inadimplente',
  desistencia: 'Desistência',
};

const STATUS_COLORS: Record<string, string> = {
  ativo: 'bg-green-500/20 text-green-700 dark:text-green-400',
  encerrado: 'bg-muted text-muted-foreground',
  inadimplente: 'bg-red-500/20 text-red-700 dark:text-red-400',
  desistencia: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
};

export default function T2Ciclos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRevendedora, setSelectedRevendedora] = useState('');
  const [selectedPedido, setSelectedPedido] = useState('');
  const [comissao, setComissao] = useState('10');
  const [dataVencimento, setDataVencimento] = useState(format(addDays(new Date(), 45), 'yyyy-MM-dd'));

  const { data: ciclos = [], isLoading } = useQuery({
    queryKey: ['t2-ciclos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_ciclos')
        .select('*, t2_revendedoras(nome_completo, nome_exibicao), t2_pedidos(codigo_pedido)')
        .order('data_inicio', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: revendedoras = [] } = useQuery({
    queryKey: ['t2-revendedoras-para-ciclo'],
    queryFn: async () => {
      const { data, error } = await supabase.from('t2_revendedoras').select('id, nome_completo, nome_exibicao');
      if (error) throw error;
      return data;
    },
  });

  const { data: pedidosDisponiveis = [] } = useQuery({
    queryKey: ['t2-pedidos-disponiveis'],
    queryFn: async () => {
      const { data, error } = await supabase.from('t2_pedidos').select('id, codigo_pedido, valor_total').eq('status', 'disponivel');
      if (error) throw error;
      return data;
    },
  });

  const pedidoSelecionado = pedidosDisponiveis.find((p: any) => p.id === selectedPedido);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRevendedora || !selectedPedido) throw new Error('Selecione revendedora e pedido');
      const pedido = pedidosDisponiveis.find((p: any) => p.id === selectedPedido);
      if (!pedido) throw new Error('Pedido não encontrado');

      const valorKit = Number(pedido.valor_total);
      const comissaoPerc = Number(comissao);
      const valorEmpresa = valorKit * (1 - comissaoPerc / 100);

      const { error: cicloError } = await supabase.from('t2_ciclos').insert({
        pedido_id: selectedPedido,
        revendedora_id: selectedRevendedora,
        representante_id: user?.id,
        valor_kit: valorKit,
        comissao_percentual: comissaoPerc,
        valor_empresa: valorEmpresa,
        valor_restante: valorKit,
        data_vencimento: new Date(dataVencimento).toISOString(),
      });
      if (cicloError) {
        if (cicloError.message?.includes('t2_ciclos_revendedora_ativo_unique')) {
          throw new Error('Esta revendedora já possui um ciclo ativo.');
        }
        throw cicloError;
      }

      // Atualizar status do pedido
      await supabase.from('t2_pedidos').update({ status: 'em_ciclo' }).eq('id', selectedPedido);

      // Log se prazo foi alterado do padrão de 45 dias
      const defaultDate = format(addDays(new Date(), 45), 'yyyy-MM-dd');
      if (dataVencimento !== defaultDate) {
        await supabase.from('logs_operacionais').insert({
          usuario_id: user!.id,
          nome_usuario: 'Sistema',
          papel: 'sistema',
          tipo_acao: 't2_prazo_alterado',
          descricao: `Prazo do ciclo alterado de ${defaultDate} para ${dataVencimento}`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['t2-ciclos'] });
      queryClient.invalidateQueries({ queryKey: ['t2-pedidos-disponiveis'] });
      queryClient.invalidateQueries({ queryKey: ['t2-pedidos'] });
      setCreateOpen(false);
      setSelectedRevendedora('');
      setSelectedPedido('');
      setComissao('10');
      setDataVencimento(format(addDays(new Date(), 45), 'yyyy-MM-dd'));
      toast({ title: 'Ciclo criado com sucesso!' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao criar ciclo', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ciclos T2</h1>
          <p className="text-sm text-muted-foreground">Gestão de ciclos TALIARE 2.0</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Ciclo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Iniciar Ciclo</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Revendedora</Label>
                <Select value={selectedRevendedora} onValueChange={setSelectedRevendedora}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {revendedoras.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.nome_exibicao || r.nome_completo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pedido Disponível</Label>
                <Select value={selectedPedido} onValueChange={setSelectedPedido}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {pedidosDisponiveis.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo_pedido} — R$ {Number(p.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {pedidoSelecionado && (
                <p className="text-sm text-muted-foreground">Valor do kit: <strong>R$ {Number(pedidoSelecionado.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
              )}
              <div>
                <Label>Comissão (%)</Label>
                <Input type="number" value={comissao} onChange={e => setComissao(e.target.value)} />
              </div>
              <div>
                <Label>Data de Vencimento</Label>
                <Input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Padrão: 45 dias a partir de hoje</p>
              </div>
              <Button className="w-full" disabled={!selectedRevendedora || !selectedPedido || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? 'Criando...' : 'Iniciar Ciclo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : ciclos.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-40" /><p>Nenhum ciclo encontrado</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ciclos.map((c: any) => (
            <Card key={c.id} className="border border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    {c.t2_revendedoras?.nome_exibicao || c.t2_revendedoras?.nome_completo || 'Revendedora'}
                  </CardTitle>
                  <Badge className={STATUS_COLORS[c.status] || ''}>{STATUS_LABELS[c.status] || c.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="text-muted-foreground">Pedido: <strong>{c.t2_pedidos?.codigo_pedido}</strong></p>
                <p>Kit: <strong>R$ {Number(c.valor_kit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
                <p>Pago: <strong>R$ {Number(c.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
                <p>Restante: <strong>R$ {Number(c.valor_restante).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
                <p className="text-xs text-muted-foreground">
                  Início: {new Date(c.data_inicio).toLocaleDateString('pt-BR')} · Venc: {new Date(c.data_vencimento).toLocaleDateString('pt-BR')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
