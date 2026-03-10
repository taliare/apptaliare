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
import { Plus, RefreshCw, ClipboardList, DollarSign, AlertTriangle, CalendarDays, CalendarClock } from 'lucide-react';
import { format, addDays, isToday, isTomorrow, isBefore, isAfter, startOfDay, endOfDay, addWeeks } from 'date-fns';
import { STATUS_LABELS, STATUS_COLORS } from '@/components/t2/constants';
import { ApuracaoDialog } from '@/components/t2/ApuracaoDialog';
import { ApuracoesSection } from '@/components/t2/ApuracoesSection';
import { AdiantamentoDialog } from '@/components/t2/AdiantamentoDialog';

interface AgendaSection {
  key: string;
  label: string;
  icon: React.ReactNode;
  accent: string;
  ciclos: any[];
}

function groupCiclosByAgenda(ciclos: any[]): AgendaSection[] {
  const hoje = startOfDay(new Date());
  const amanha = addDays(hoje, 1);
  const fimSemana = endOfDay(addWeeks(hoje, 1));

  const atrasados: any[] = [];
  const hojeLista: any[] = [];
  const amanhaLista: any[] = [];
  const semanaLista: any[] = [];
  const proximosLista: any[] = [];

  for (const c of ciclos) {
    const dataCobranca = startOfDay(new Date(c.data_cobranca));
    if (isBefore(dataCobranca, hoje)) {
      atrasados.push(c);
    } else if (isToday(dataCobranca)) {
      hojeLista.push(c);
    } else if (isTomorrow(dataCobranca)) {
      amanhaLista.push(c);
    } else if (isBefore(dataCobranca, fimSemana) || dataCobranca.getTime() === fimSemana.getTime()) {
      semanaLista.push(c);
    } else {
      proximosLista.push(c);
    }
  }

  return [
    { key: 'atrasados', label: 'Atrasados', icon: <AlertTriangle className="h-4 w-4" />, accent: 'text-destructive', ciclos: atrasados },
    { key: 'hoje', label: 'Hoje', icon: <CalendarDays className="h-4 w-4" />, accent: 'text-primary', ciclos: hojeLista },
    { key: 'amanha', label: 'Amanhã', icon: <CalendarClock className="h-4 w-4" />, accent: 'text-foreground', ciclos: amanhaLista },
    { key: 'semana', label: 'Esta Semana', icon: <CalendarDays className="h-4 w-4" />, accent: 'text-muted-foreground', ciclos: semanaLista },
    { key: 'proximos', label: 'Próximos', icon: <CalendarClock className="h-4 w-4" />, accent: 'text-muted-foreground', ciclos: proximosLista },
  ].filter(s => s.ciclos.length > 0);
}

function getCicloIndicator(ciclo: any) {
  const hoje = startOfDay(new Date());
  const dataCobranca = startOfDay(new Date(ciclo.data_cobranca));
  if (isBefore(dataCobranca, hoje)) return 'border-l-4 border-l-destructive';
  if (isToday(dataCobranca)) return 'border-l-4 border-l-primary';
  if (isTomorrow(dataCobranca)) return 'border-l-4 border-l-yellow-500';
  return 'border-l-4 border-l-green-500';
}

export default function T2Ciclos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRevendedora, setSelectedRevendedora] = useState('');
  const [selectedPedido, setSelectedPedido] = useState('');
  const [comissao, setComissao] = useState('10');
  const [dataVencimento, setDataVencimento] = useState(format(addDays(new Date(), 45), 'yyyy-MM-dd'));
  const [apuracaoCiclo, setApuracaoCiclo] = useState<any>(null);
  const [adiantamentoCiclo, setAdiantamentoCiclo] = useState<any>(null);

  const { data: ciclos = [], isLoading } = useQuery({
    queryKey: ['t2-ciclos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_ciclos')
        .select('*, t2_revendedoras(nome_completo, nome_exibicao), t2_pedidos(codigo_pedido)')
        .eq('status', 'ativo')
        .order('data_cobranca', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Query to check which ciclos already have apuração
  const { data: apuracoesCicloIds = [] } = useQuery({
    queryKey: ['t2-apuracoes-ciclo-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_apuracoes')
        .select('ciclo_id');
      if (error) throw error;
      return data.map((a: any) => a.ciclo_id);
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

      const { data: cicloData, error: cicloError } = await supabase.from('t2_ciclos').insert({
        pedido_id: selectedPedido,
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
        console.error("t2_ciclos INSERT ERROR:", cicloError);
        if (cicloError.message?.includes('t2_ciclos_revendedora_ativo_unique')) {
          throw new Error('Esta revendedora já possui um ciclo ativo.');
        }
        throw cicloError;
      }
      console.log("t2_ciclos INSERT OK:", cicloData);

      await supabase.from('t2_pedidos').update({ status: 'em_ciclo' }).eq('id', selectedPedido);
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

  const handleOpenApuracao = (ciclo: any) => {
    if (apuracoesCicloIds.includes(ciclo.id)) {
      toast({ title: 'Este ciclo já possui uma prestação de contas registrada.', variant: 'destructive' });
      return;
    }
    setApuracaoCiclo(ciclo);
  };

  const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const sections = groupCiclosByAgenda(ciclos);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda de Cobranças</h1>
          <p className="text-sm text-muted-foreground">Ciclos TALIARE 2.0 organizados por data de cobrança</p>
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
                        {p.codigo_pedido} — R$ {fmt(p.valor_total)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {pedidoSelecionado && (
                <p className="text-sm text-muted-foreground">Valor do kit: <strong>R$ {fmt(pedidoSelecionado.valor_total)}</strong></p>
              )}
              <div>
                <Label>Comissão (%)</Label>
                <Input type="number" value={comissao} onChange={e => setComissao(e.target.value)} />
              </div>
              <div>
                <Label>Data de Vencimento / Cobrança</Label>
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
      ) : sections.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-40" /><p>Nenhum ciclo ativo na agenda</p></CardContent></Card>
      ) : (
        <div className="space-y-6">
          {sections.map(section => (
            <div key={section.key}>
              <div className={`flex items-center gap-2 mb-3 ${section.accent}`}>
                {section.icon}
                <h2 className="text-lg font-semibold">{section.label}</h2>
                <Badge variant="secondary" className="text-xs">{section.ciclos.length}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {section.ciclos.map((c: any) => {
                  const indicator = getCicloIndicator(c);
                  const hasApuracao = apuracoesCicloIds.includes(c.id);
                  return (
                    <Card key={c.id} className={`border border-border ${indicator}`}>
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
                        <p>Kit: <strong>R$ {fmt(c.valor_kit)}</strong></p>
                        <p>Pago: <strong>R$ {fmt(c.valor_pago)}</strong></p>
                        <p>Restante: <strong>R$ {fmt(c.valor_restante)}</strong></p>
                        <p className="text-xs text-muted-foreground">
                          Cobrança: <strong>{c.data_cobranca ? new Date(c.data_cobranca + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</strong>
                          {' · '}Venc: {new Date(c.data_vencimento).toLocaleDateString('pt-BR')}
                        </p>

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

                        <ApuracoesSection cicloId={c.id} />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

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
