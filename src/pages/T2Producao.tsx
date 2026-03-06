import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Plus, Package, Send } from 'lucide-react';
import { profilesLimited } from '@/lib/profilesLimited';

const STATUS_LABELS: Record<string, string> = {
  aguardando_distribuicao: 'Aguardando Distribuição',
  disponivel: 'Disponível',
  em_ciclo: 'Em Ciclo',
  finalizado: 'Finalizado',
};

const STATUS_COLORS: Record<string, string> = {
  aguardando_distribuicao: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  disponivel: 'bg-green-500/20 text-green-700 dark:text-green-400',
  em_ciclo: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  finalizado: 'bg-muted text-muted-foreground',
};

export default function T2Producao() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === 'admin';
  const [createOpen, setCreateOpen] = useState(false);
  const [distribuirOpen, setDistribuirOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<any>(null);
  const [selectedRepresentante, setSelectedRepresentante] = useState('');

  const [form, setForm] = useState({ codigo_pedido: '', valor_total: '', observacao: '' });

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['t2-pedidos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_pedidos')
        .select('*')
        .order('data_criacao', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes-list'],
    queryFn: async () => {
      const query = profilesLimited();
      const { data, error } = await query.select('id, nome').eq('ativo', true);
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('t2_pedidos').insert({
        codigo_pedido: form.codigo_pedido.trim(),
        valor_total: parseFloat(form.valor_total),
        observacao: form.observacao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['t2-pedidos'] });
      setForm({ codigo_pedido: '', valor_total: '', observacao: '' });
      setCreateOpen(false);
      toast({ title: 'Pedido criado com sucesso!' });
    },
    onError: (err: any) => {
      const msg = err.message?.includes('t2_pedidos_codigo_unique')
        ? 'Código de pedido já existe.'
        : err.message;
      toast({ title: 'Erro ao criar pedido', description: msg, variant: 'destructive' });
    },
  });

  const distribuirMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPedido || !selectedRepresentante) throw new Error('Selecione um representante');
      const { error } = await supabase
        .from('t2_pedidos')
        .update({ representante_id: selectedRepresentante, status: 'disponivel' })
        .eq('id', selectedPedido.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['t2-pedidos'] });
      setDistribuirOpen(false);
      setSelectedPedido(null);
      setSelectedRepresentante('');
      toast({ title: 'Pedido distribuído com sucesso!' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao distribuir', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produção T2</h1>
          <p className="text-sm text-muted-foreground">Gestão de pedidos TALIARE 2.0</p>
        </div>
        {isAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Pedido</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Pedido</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Código do Pedido</Label>
                  <Input placeholder="Ex: PED-001" value={form.codigo_pedido} onChange={e => setForm(f => ({ ...f, codigo_pedido: e.target.value }))} />
                </div>
                <div>
                  <Label>Valor Total (R$)</Label>
                  <Input type="number" step="0.01" placeholder="0,00" value={form.valor_total} onChange={e => setForm(f => ({ ...f, valor_total: e.target.value }))} />
                </div>
                <div>
                  <Label>Observação</Label>
                  <Textarea placeholder="Opcional" value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
                </div>
                <Button className="w-full" disabled={!form.codigo_pedido || !form.valor_total || createMutation.isPending} onClick={() => createMutation.mutate()}>
                  {createMutation.isPending ? 'Criando...' : 'Criar Pedido'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : pedidos.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Package className="h-12 w-12 mx-auto mb-4 opacity-40" /><p>Nenhum pedido cadastrado</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pedidos.map((p: any) => (
            <Card key={p.id} className="border border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">{p.codigo_pedido}</CardTitle>
                  <Badge className={STATUS_COLORS[p.status] || ''}>{STATUS_LABELS[p.status] || p.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-lg font-bold text-foreground">R$ {Number(p.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                {p.observacao && <p className="text-xs text-muted-foreground">{p.observacao}</p>}
                <p className="text-xs text-muted-foreground">Criado em {new Date(p.data_criacao).toLocaleDateString('pt-BR')}</p>
                {isAdmin && p.status === 'aguardando_distribuicao' && (
                  <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => { setSelectedPedido(p); setDistribuirOpen(true); }}>
                    <Send className="h-3 w-3 mr-2" />Distribuir
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={distribuirOpen} onOpenChange={setDistribuirOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Distribuir Pedido</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Pedido: <strong>{selectedPedido?.codigo_pedido}</strong></p>
            <div>
              <Label>Representante</Label>
              <Select value={selectedRepresentante} onValueChange={setSelectedRepresentante}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {representantes.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!selectedRepresentante || distribuirMutation.isPending} onClick={() => distribuirMutation.mutate()}>
              {distribuirMutation.isPending ? 'Distribuindo...' : 'Confirmar Distribuição'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
