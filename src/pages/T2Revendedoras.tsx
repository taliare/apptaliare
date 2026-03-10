import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Users, Search, Star, TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import { CATEGORIA_COLORS, CATEGORIA_LABELS, STATUS_COLORS, STATUS_LABELS } from '@/components/t2/constants';

export default function T2Revendedoras() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === 'admin';
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    nome_completo: '', nome_exibicao: '', cpf: '', telefone: '', cidade: '', instagram: '',
  });

  const { data: revendedoras = [], isLoading } = useQuery({
    queryKey: ['t2-revendedoras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_revendedoras')
        .select('*')
        .order('data_cadastro', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Historico da revendedora selecionada
  const { data: historico } = useQuery({
    queryKey: ['t2-historico', selectedId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_vw_historico_revendedoras' as any)
        .select('*')
        .eq('revendedora_id', selectedId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!selectedId,
  });

  const { data: ciclosRevendedora = [] } = useQuery({
    queryKey: ['t2-ciclos-rev', selectedId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_ciclos')
        .select('*, t2_pedidos(codigo_pedido)')
        .eq('revendedora_id', selectedId!)
        .order('data_inicio', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedId,
  });

  const cicloIds = ciclosRevendedora.map((c: any) => c.id);

  const { data: apuracoes = [] } = useQuery({
    queryKey: ['t2-apuracoes-rev', selectedId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_apuracoes')
        .select('*')
        .in('ciclo_id', cicloIds);
      if (error) throw error;
      return data;
    },
    enabled: cicloIds.length > 0,
  });

  const apuracaoIds = apuracoes.map((a: any) => a.id);

  const { data: pagamentos = [] } = useQuery({
    queryKey: ['t2-pagamentos-rev', selectedId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_pagamentos')
        .select('*')
        .in('apuracao_id', apuracaoIds);
      if (error) throw error;
      return data;
    },
    enabled: apuracaoIds.length > 0,
  });

  const { data: adiantamentos = [] } = useQuery({
    queryKey: ['t2-adiantamentos-rev', selectedId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_adiantamentos')
        .select('*')
        .in('ciclo_id', cicloIds);
      if (error) throw error;
      return data;
    },
    enabled: cicloIds.length > 0,
  });

  // Helper maps for cycle details
  const getApuracao = (cicloId: string) => apuracoes.find((a: any) => a.ciclo_id === cicloId);
  const getTotalPagamentos = (cicloId: string) => {
    const ap = getApuracao(cicloId);
    if (!ap) return 0;
    return pagamentos.filter((p: any) => p.apuracao_id === ap.id).reduce((s: number, p: any) => s + Number(p.valor_pago), 0);
  };
  const getTotalAdiantamentos = (cicloId: string) =>
    adiantamentos.filter((a: any) => a.ciclo_id === cicloId).reduce((s: number, a: any) => s + Number(a.valor), 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      const cpfClean = form.cpf.replace(/\D/g, '');
      if (cpfClean.length !== 11) throw new Error('CPF deve ter 11 dígitos');
      const { data, error } = await supabase.from('t2_revendedoras').insert({
        nome_completo: form.nome_completo.trim(),
        nome_exibicao: form.nome_exibicao.trim() || null,
        cpf: cpfClean,
        telefone: form.telefone.trim(),
        cidade: form.cidade.trim() || null,
        instagram: form.instagram.trim() || null,
        representante_id: isAdmin ? null : user?.id,
      }).select();
      if (error) { console.error("t2_revendedoras INSERT ERROR:", error); throw error; }
      console.log("t2_revendedoras INSERT OK:", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['t2-revendedoras'] });
      setForm({ nome_completo: '', nome_exibicao: '', cpf: '', telefone: '', cidade: '', instagram: '' });
      setCreateOpen(false);
      toast({ title: 'Revendedora cadastrada!' });
    },
    onError: (err: any) => {
      const msg = err.message?.includes('t2_revendedoras_cpf_unique')
        ? 'CPF já cadastrado no sistema.'
        : err.message;
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    },
  });

  const filtered = revendedoras.filter((r: any) =>
    r.nome_completo.toLowerCase().includes(search.toLowerCase()) ||
    r.cpf?.includes(search)
  );

  const formatCpf = (cpf: string) => {
    const c = cpf.replace(/\D/g, '');
    return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const fmt = (v: number) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const selected = revendedoras.find((r: any) => r.id === selectedId);

  // Dashboard stats
  const totalAtivas = revendedoras.filter((r: any) => r.status !== 'inativa').length;
  const categoryCounts = revendedoras.reduce((acc: Record<string, number>, r: any) => {
    const cat = r.categoria_atual || 'SEM CATEGORIA';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Revendedoras T2</h1>
          <p className="text-sm text-muted-foreground">Cadastro TALIARE 2.0</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova Revendedora</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar Revendedora</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome Completo *</Label><Input value={form.nome_completo} onChange={e => setForm(f => ({ ...f, nome_completo: e.target.value }))} /></div>
              <div><Label>Nome de Exibição</Label><Input placeholder="Opcional" value={form.nome_exibicao} onChange={e => setForm(f => ({ ...f, nome_exibicao: e.target.value }))} /></div>
              <div><Label>CPF *</Label><Input placeholder="000.000.000-00" value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} /></div>
              <div><Label>Telefone *</Label><Input placeholder="(00) 00000-0000" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></div>
              <div><Label>Cidade</Label><Input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} /></div>
              <div><Label>Instagram</Label><Input placeholder="@usuario" value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} /></div>
              <Button className="w-full" disabled={!form.nome_completo || !form.cpf || !form.telefone || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? 'Salvando...' : 'Cadastrar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><Users className="h-3 w-3" /><span className="text-xs">Ativas</span></div>
            <p className="text-xl font-bold">{totalAtivas}</p>
          </CardContent>
        </Card>
        {['ELITE', 'DESTAQUE', 'ATIVA', 'INICIAL'].map(cat => (
          <Card key={cat}>
            <CardContent className="pt-3 pb-3">
              <Badge className={`${CATEGORIA_COLORS[cat]} text-[10px] mb-1`}>{CATEGORIA_LABELS[cat]}</Badge>
              <p className="text-xl font-bold">{categoryCounts[cat] || 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome ou CPF..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Users className="h-12 w-12 mx-auto mb-4 opacity-40" /><p>Nenhuma revendedora encontrada</p></CardContent></Card>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">CPF</TableHead>
                <TableHead className="hidden md:table-cell">Telefone</TableHead>
                <TableHead className="hidden lg:table-cell">Cidade</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="hidden md:table-cell text-right">Score</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r: any) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelectedId(r.id)}>
                  <TableCell className="font-medium">{r.nome_exibicao || r.nome_completo}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{formatCpf(r.cpf)}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{r.telefone}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{r.cidade || '-'}</TableCell>
                  <TableCell>
                    <Badge className={CATEGORIA_COLORS[r.categoria_atual] || 'bg-muted text-muted-foreground'}>
                      {CATEGORIA_LABELS[r.categoria_atual] || r.categoria_atual || '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right text-muted-foreground">{r.score}</TableCell>
                  <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Perfil Sheet */}
      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.nome_exibicao || selected?.nome_completo}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="space-y-6 mt-4">
              {/* Dados cadastrais */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dados Cadastrais</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">CPF:</span> <span className="font-medium">{formatCpf(selected.cpf)}</span></div>
                  <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{selected.telefone}</span></div>
                  <div><span className="text-muted-foreground">Cidade:</span> <span className="font-medium">{selected.cidade || '—'}</span></div>
                  <div><span className="text-muted-foreground">Instagram:</span> <span className="font-medium">{selected.instagram || '—'}</span></div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Badge className={CATEGORIA_COLORS[selected.categoria_atual] || 'bg-muted text-muted-foreground'}>
                    {CATEGORIA_LABELS[selected.categoria_atual] || selected.categoria_atual || 'Sem categoria'}
                  </Badge>
                  <Badge variant="outline" className="gap-1"><Star className="h-3 w-3" />{selected.score} pts</Badge>
                </div>
              </div>

              {/* Histórico agregado */}
              {historico && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Performance</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Card><CardContent className="pt-3 pb-3">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1"><DollarSign className="h-3 w-3" /><span className="text-xs">Total Vendido</span></div>
                      <p className="text-lg font-bold">R$ {fmt(historico.total_vendido)}</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-3 pb-3">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1"><BarChart3 className="h-3 w-3" /><span className="text-xs">Ticket Médio</span></div>
                      <p className="text-lg font-bold">R$ {fmt(historico.ticket_medio)}</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-3 pb-3">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1"><TrendingUp className="h-3 w-3" /><span className="text-xs">Total Empresa</span></div>
                      <p className="text-lg font-bold">R$ {fmt(historico.total_pago_empresa)}</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-3 pb-3">
                      <div className="text-muted-foreground mb-1 text-xs">Ciclos</div>
                      <p className="text-lg font-bold">{historico.total_ciclos}</p>
                    </CardContent></Card>
                  </div>
                </div>
              )}

              {/* Lista de ciclos */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Histórico de Ciclos</h3>
                {ciclosRevendedora.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum ciclo registrado</p>
                ) : (
                  <div className="space-y-3">
                    {ciclosRevendedora.map((c: any) => {
                      const ap = getApuracao(c.id);
                      const totalPag = getTotalPagamentos(c.id);
                      const totalAdiant = getTotalAdiantamentos(c.id);
                      const totalPago = totalPag + totalAdiant;
                      const valorEmpresa = ap ? Number(ap.valor_empresa) : null;
                      const saldoRestante = valorEmpresa !== null ? valorEmpresa - totalPago : null;

                      return (
                        <div key={c.id} className="rounded-lg border border-border p-3 space-y-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{c.t2_pedidos?.codigo_pedido || 'Sem pedido'}</span>
                            <Badge className={STATUS_COLORS[c.status] || ''}>{STATUS_LABELS[c.status] || c.status}</Badge>
                          </div>

                          <div className="text-xs text-muted-foreground">
                            Entrega: {new Date(c.data_inicio).toLocaleDateString('pt-BR')} → Vencimento: {new Date(c.data_vencimento).toLocaleDateString('pt-BR')}
                          </div>

                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Valor do Kit:</span>
                              <span className="font-medium">R$ {fmt(c.valor_kit)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Valor Vendido:</span>
                              <span className="font-medium">{ap ? `R$ ${fmt(ap.valor_vendido)}` : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Comissão:</span>
                              <span className="font-medium">{ap ? `${ap.comissao_percentual}% (R$ ${fmt(ap.valor_comissao)})` : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Valor Empresa:</span>
                              <span className="font-medium">{valorEmpresa !== null ? `R$ ${fmt(valorEmpresa)}` : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total Pago:</span>
                              <span className="font-medium text-green-600 dark:text-green-400">R$ {fmt(totalPago)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Saldo Restante:</span>
                              {saldoRestante !== null ? (
                                <span className={`font-semibold ${saldoRestante > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                                  R$ {fmt(saldoRestante)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">Aguardando apuração</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
