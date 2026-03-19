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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Plus, RefreshCw, ClipboardList, DollarSign, Package, Undo2, MapPin, MessageCircle, CreditCard, MessageSquarePlus } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, addDays, startOfDay, isBefore, isEqual } from 'date-fns';
import { STATUS_LABELS, STATUS_COLORS } from '@/components/t2/constants';
import { ApuracaoDialog } from '@/components/t2/ApuracaoDialog';
import { ApuracoesSection } from '@/components/t2/ApuracoesSection';
import { AdiantamentoDialog } from '@/components/t2/AdiantamentoDialog';
import { QuickPagamentoDialog } from '@/components/t2/QuickPagamentoDialog';
import { InteracaoDialog } from '@/components/t2/InteracaoDialog';
import { formatDateBR } from '@/lib/utils';

function getCicloHighlight(ciclo: any): string {
  if (ciclo.status === 'encerrado') return '';
  const hoje = startOfDay(new Date());
  const dataCobranca = startOfDay(new Date(ciclo.data_cobranca + 'T00:00:00'));
  if (isBefore(dataCobranca, hoje)) return 'border-l-4 border-l-destructive';
  if (isEqual(dataCobranca, hoje)) return 'border-l-4 border-l-primary';
  return '';
}

export default function T2Ciclos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRevendedora, setSelectedRevendedora] = useState('');
  const [selectedPedidoIds, setSelectedPedidoIds] = useState<string[]>([]);
  const [comissao, setComissao] = useState('10');
  const [dataVencimento, setDataVencimento] = useState(format(addDays(new Date(), 45), 'yyyy-MM-dd'));
  const [apuracaoCiclo, setApuracaoCiclo] = useState<any>(null);
  const [adiantamentoCiclo, setAdiantamentoCiclo] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [revendedoraInfoId, setRevendedoraInfoId] = useState<string | null>(null);

  const { data: ciclos = [], isLoading } = useQuery({
    queryKey: ['t2-ciclos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_ciclos')
        .select('*, t2_revendedoras(id, nome_completo, nome_exibicao, telefone, cidade, endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cep, endereco_estado), t2_pedidos(codigo_pedido)')
        .order('data_cobranca' as any, { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const filteredCiclos = statusFilter === 'todos'
    ? ciclos
    : ciclos.filter((c: any) => c.status === statusFilter);

  const { data: cicloPedidos = [] } = useQuery({
    queryKey: ['t2-ciclo-pedidos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_ciclo_pedidos' as any)
        .select('ciclo_id, pedido_id, t2_pedidos(codigo_pedido, valor_total)');
      if (error) throw error;
      return data;
    },
  });

  const { data: apuracoes = [] } = useQuery({
    queryKey: ['t2-apuracoes-for-ciclos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_apuracoes')
        .select('id, ciclo_id, valor_empresa');
      if (error) throw error;
      return data;
    },
  });

  const apuracoesCicloIds = apuracoes.map((a: any) => a.ciclo_id);

  const { data: allPagamentos = [] } = useQuery({
    queryKey: ['t2-pagamentos-all', apuracoes.length],
    queryFn: async () => {
      if (apuracoes.length === 0) return [];
      const ids = apuracoes.map((a: any) => a.id);
      const { data, error } = await supabase
        .from('t2_pagamentos')
        .select('apuracao_id, valor_pago')
        .in('apuracao_id', ids);
      if (error) throw error;
      return data;
    },
    enabled: apuracoes.length > 0,
  });

  const { data: allAdiantamentos = [] } = useQuery({
    queryKey: ['t2-adiantamentos-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_adiantamentos')
        .select('ciclo_id, valor');
      if (error) throw error;
      return data;
    },
  });

  const getSaldoCiclo = (cicloId: string): { hasApuracao: boolean; saldo: number } => {
    const apuracao = apuracoes.find((a: any) => a.ciclo_id === cicloId);
    if (!apuracao) return { hasApuracao: false, saldo: 0 };
    const totalPag = allPagamentos
      .filter((p: any) => p.apuracao_id === apuracao.id)
      .reduce((sum: number, p: any) => sum + Number(p.valor_pago), 0);
    const totalAdiant = allAdiantamentos
      .filter((a: any) => a.ciclo_id === cicloId)
      .reduce((sum: number, a: any) => sum + Number(a.valor), 0);
    return { hasApuracao: true, saldo: Number(apuracao.valor_empresa) - totalPag - totalAdiant };
  };

  const getPedidosCiclo = (cicloId: string) => {
    return (cicloPedidos as any[]).filter((cp: any) => cp.ciclo_id === cicloId);
  };

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

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRevendedora || selectedPedidoIds.length === 0) throw new Error('Selecione revendedora e pelo menos um pedido');
      const valorKit = valorTotalSelecionado;
      const comissaoPerc = Number(comissao);
      const valorEmpresa = valorKit * (1 - comissaoPerc / 100);
      const { data: cicloData, error: cicloError } = await supabase.from('t2_ciclos').insert({
        pedido_id: selectedPedidoIds[0],
        revendedora_id: selectedRevendedora,
        representante_id: user?.id,
        valor_kit: valorKit,
        comissao_percentual: comissaoPerc,
        valor_empresa: valorEmpresa,
        valor_restante: valorKit,
        data_vencimento: new Date(dataVencimento).toISOString(),
        data_cobranca: dataVencimento,
      } as any).select();
      if (cicloError) {
        if (cicloError.message?.includes('t2_ciclos_revendedora_ativo_unique')) {
          throw new Error('Esta revendedora já possui um ciclo ativo.');
        }
        throw cicloError;
      }
      const cicloId = cicloData[0].id;
      const junctionRows = selectedPedidoIds.map(pid => ({ ciclo_id: cicloId, pedido_id: pid }));
      const { error: junctionError } = await supabase.from('t2_ciclo_pedidos' as any).insert(junctionRows);
      if (junctionError) throw junctionError;
      for (const pid of selectedPedidoIds) {
        await supabase.from('t2_pedidos').update({ status: 'em_ciclo' }).eq('id', pid);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['t2-ciclos'] });
      queryClient.invalidateQueries({ queryKey: ['t2-pedidos-disponiveis'] });
      queryClient.invalidateQueries({ queryKey: ['t2-pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['t2-ciclo-pedidos'] });
      setCreateOpen(false);
      setSelectedRevendedora('');
      setSelectedPedidoIds([]);
      setComissao('10');
      setDataVencimento(format(addDays(new Date(), 45), 'yyyy-MM-dd'));
      toast({ title: 'Ciclo criado com sucesso!' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao criar ciclo', description: err.message, variant: 'destructive' });
    },
  });

  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const cancelApuracaoMutation = useMutation({
    mutationFn: async (cicloId: string) => {
      const { data, error } = await supabase.rpc('t2_cancelar_apuracao', { p_ciclo_id: cicloId } as any);
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['t2-ciclos'] });
      queryClient.invalidateQueries({ queryKey: ['t2-apuracoes-for-ciclos'] });
      queryClient.invalidateQueries({ queryKey: ['t2-pagamentos-all'] });
      toast({ title: 'Apuração cancelada', description: `${data.pagamentos_removidos} pagamento(s) removido(s). Ciclo reativado.` });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao cancelar apuração', description: err.message, variant: 'destructive' });
    },
  });

  const handleOpenApuracao = (ciclo: any) => {
    if (apuracoesCicloIds.includes(ciclo.id)) {
      toast({ title: 'Este ciclo já possui uma prestação de contas registrada.', variant: 'destructive' });
      return;
    }
    setApuracaoCiclo(ciclo);
  };

  const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  const openWhatsApp = (telefone: string) => {
    const clean = telefone.replace(/\D/g, '');
    const num = clean.startsWith('55') ? clean : `55${clean}`;
    window.open(`https://wa.me/${num}`, '_blank');
  };

  const formatEndereco = (r: any) => {
    const parts = [
      r.endereco_rua,
      r.endereco_numero ? `nº ${r.endereco_numero}` : null,
      r.endereco_complemento,
      r.endereco_bairro,
      r.cidade,
      r.endereco_estado,
      r.endereco_cep ? `CEP: ${r.endereco_cep}` : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  // Find the revendedora info for the dialog
  const revendedoraInfo = revendedoraInfoId
    ? ciclos.find((c: any) => c.t2_revendedoras?.id === revendedoraInfoId)?.t2_revendedoras
    : null;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda de Cobranças</h1>
          <p className="text-sm text-muted-foreground">Ciclos TALIARE 2.0 organizados por data de cobrança</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { value: 'todos', label: 'Todos' },
            { value: 'ativo', label: 'Ativos' },
            { value: 'apurado', label: 'Apurados' },
            { value: 'encerrado', label: 'Encerrados' },
          ].map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={statusFilter === f.value ? 'default' : 'outline'}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
          <Dialog open={createOpen} onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) {
              setSelectedPedidoIds([]);
              setSelectedRevendedora('');
            }
          }} modal={false}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" />Novo Ciclo</Button>
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
                <Label>Pedidos Disponíveis</Label>
                <div className="border border-input rounded-md max-h-48 overflow-y-auto mt-1">
                  {pedidosDisponiveis.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground text-center">Nenhum pedido disponível</p>
                  ) : (
                    pedidosDisponiveis.map((p: any) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-accent/50 cursor-pointer border-b border-border last:border-b-0"
                      >
                        <Checkbox
                          checked={selectedPedidoIds.includes(p.id)}
                          onCheckedChange={() => togglePedido(p.id)}
                        />
                        <span className="text-sm flex-1">
                          <strong>{p.codigo_pedido}</strong>
                          <span className="text-muted-foreground"> — R$ {fmt(p.valor_total)}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {selectedPedidoIds.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {selectedPedidoIds.length} pedido(s) selecionado(s) · Valor total: <strong className="text-foreground">R$ {fmt(valorTotalSelecionado)}</strong>
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
              <Button className="w-full" disabled={!selectedRevendedora || selectedPedidoIds.length === 0 || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? 'Criando...' : 'Iniciar Ciclo'}
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : filteredCiclos.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-40" /><p>Nenhum ciclo encontrado</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCiclos.map((c: any) => {
            const highlight = getCicloHighlight(c);
            const hasApuracao = apuracoesCicloIds.includes(c.id);
            const saldoInfo = getSaldoCiclo(c.id);
            const pedidosVinculados = getPedidosCiclo(c.id);
            return (
              <Card key={c.id} className={`border border-border ${highlight}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">
                      <button
                        type="button"
                        className="text-left hover:text-primary underline-offset-2 hover:underline transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRevendedoraInfoId(c.t2_revendedoras?.id || null);
                        }}
                      >
                        {c.t2_revendedoras?.nome_exibicao || c.t2_revendedoras?.nome_completo || 'Revendedora'}
                      </button>
                    </CardTitle>
                    <Badge className={STATUS_COLORS[c.status] || ''}>{STATUS_LABELS[c.status] || c.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {pedidosVinculados.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <Package className="h-3 w-3 text-muted-foreground" />
                      {pedidosVinculados.map((cp: any) => (
                        <Badge key={cp.pedido_id} variant="secondary" className="text-xs">
                          {cp.t2_pedidos?.codigo_pedido || '—'}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {pedidosVinculados.length === 0 && c.t2_pedidos?.codigo_pedido && (
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3 text-muted-foreground" />
                      <Badge variant="secondary" className="text-xs">{c.t2_pedidos.codigo_pedido}</Badge>
                    </div>
                  )}
                  <p className="text-muted-foreground">Entrega: <strong>{c.data_inicio ? formatDateBR(c.data_inicio) : '—'}</strong></p>
                  <p className="text-muted-foreground">Prev. Acerto: <strong>{c.data_cobranca ? formatDateBR(c.data_cobranca) : '—'}</strong></p>
                  <p>Kit: <strong>R$ {fmt(c.valor_kit)}</strong></p>
                  <p>Saldo: {saldoInfo.hasApuracao ? (
                    <strong className={saldoInfo.saldo <= 0 ? 'text-green-600' : 'text-orange-600'}>
                      R$ {fmt(saldoInfo.saldo)}
                    </strong>
                  ) : (
                    <span className="text-muted-foreground italic">Aguardando apuração</span>
                  )}</p>

                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => handleOpenApuracao(c)}
                      disabled={hasApuracao}
                    >
                      <ClipboardList className="h-3 w-3 mr-1" /> {hasApuracao ? 'Apurado' : 'Prestação'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => setAdiantamentoCiclo(c)}
                    >
                      <DollarSign className="h-3 w-3 mr-1" /> Adiantamento
                    </Button>
                  </div>

                  {isAdmin && hasApuracao && c.status === 'apurado' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full text-xs mt-1"
                          disabled={cancelApuracaoMutation.isPending}
                        >
                          <Undo2 className="h-3 w-3 mr-1" />
                          {cancelApuracaoMutation.isPending ? 'Cancelando...' : 'Cancelar Apuração'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancelar Apuração</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação irá remover todos os pagamentos registrados neste ciclo e retornar o status para <strong>ativo</strong>. Deseja continuar?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Não</AlertDialogCancel>
                          <AlertDialogAction onClick={() => cancelApuracaoMutation.mutate(c.id)}>
                            Sim, cancelar apuração
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

                  <ApuracoesSection cicloId={c.id} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Revendedora Info Dialog */}
      <Dialog open={!!revendedoraInfoId} onOpenChange={(o) => !o && setRevendedoraInfoId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {revendedoraInfo?.nome_exibicao || revendedoraInfo?.nome_completo || 'Revendedora'}
            </DialogTitle>
          </DialogHeader>
          {revendedoraInfo && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Endereço</h4>
                {formatEndereco(revendedoraInfo) ? (
                  <p className="text-sm">{formatEndereco(revendedoraInfo)}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Endereço não cadastrado</p>
                )}
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Telefone</h4>
                <p className="text-sm font-medium">{revendedoraInfo.telefone}</p>
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => openWhatsApp(revendedoraInfo.telefone)}
              >
                <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {apuracaoCiclo && (
        <ApuracaoDialog
          open={!!apuracaoCiclo}
          onOpenChange={(o) => {
            if (!o) setApuracaoCiclo(null);
          }}
          ciclo={apuracaoCiclo}
        />
      )}

      {adiantamentoCiclo && (
        <AdiantamentoDialog
          open={!!adiantamentoCiclo}
          onOpenChange={(o) => !o && setAdiantamentoCiclo(null)}
          ciclo={adiantamentoCiclo}
        />
      )}
    </div>
  );
}
