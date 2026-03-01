import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, MessageSquare, Package, CalendarIcon, Edit2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatarValor, getLocalDateString } from '@/lib/utils';
import { sanitizeString } from '@/lib/validations';
import { RevendedoraSearchSelect } from '@/components/RevendedoraSearchSelect';
import { ModalReceberCobranca } from '@/components/cobranca/ModalReceberCobranca';
import type { Database } from '@/integrations/supabase/types';

type Cobranca = Database['public']['Tables']['cobrancas_agendadas']['Row'];
type FormaPagamento = 'pix' | 'dinheiro' | 'cartao' | 'transferencia';

interface NotaPromissoria {
  id: string;
  codigo_nota: string;
  data: string;
  valor_total: number;
  forma_pagamento_1: string;
  valor_pagamento_1: number;
  forma_pagamento_2?: string | null;
  valor_pagamento_2?: number | null;
  devolveu_tudo?: boolean;
  cobranca_id?: string | null;
}

interface AdminDayActionsProps {
  selectedRepresentante: string;
  representanteNome: string;
  dateStr: string;
  selectedDate: Date;
  cobrancaDiariaId?: string | null;
  isDiaFinalizado: boolean;
  observacoesDia: string | null;
  notas: NotaPromissoria[];
  userId: string;
  userNome: string;
}

export function AdminDayActions({
  selectedRepresentante,
  representanteNome,
  dateStr,
  selectedDate,
  cobrancaDiariaId,
  isDiaFinalizado,
  observacoesDia,
  notas,
  userId,
  userNome,
}: AdminDayActionsProps) {
  const queryClient = useQueryClient();

  // Observações state
  const [editingObs, setEditingObs] = useState(false);
  const [obsText, setObsText] = useState(observacoesDia || '');

  // Buscar nota state
  const [buscarNotaOpen, setBuscarNotaOpen] = useState(false);
  const [codigoBusca, setCodigoBusca] = useState('');
  const [buscandoNota, setBuscandoNota] = useState(false);
  const [notaEncontrada, setNotaEncontrada] = useState<Cobranca | null>(null);
  const [erroNota, setErroNota] = useState<string | null>(null);
  const [cobrancaParaPagar, setCobrancaParaPagar] = useState<Cobranca | null>(null);

  // Alterar data state
  const [alterarDataOpen, setAlterarDataOpen] = useState(false);
  const [notaParaAlterar, setNotaParaAlterar] = useState<NotaPromissoria | null>(null);
  const [novaData, setNovaData] = useState('');

  // Entregar kit state
  const [kitDialogOpen, setKitDialogOpen] = useState(false);
  const [selectedKit, setSelectedKit] = useState('');
  const [kitSearchTerm, setKitSearchTerm] = useState('');
  const [revendedoraKit, setRevendedoraKit] = useState('');
  const [dataVencimentoKit, setDataVencimentoKit] = useState(getLocalDateString(addDays(new Date(), 60)));
  const [vincularVendedora, setVincularVendedora] = useState(false);
  const [vendedoraId, setVendedoraId] = useState('');

  // Queries
  const { data: kitsEstoque = [] } = useQuery({
    queryKey: ['kits-estoque-admin', selectedRepresentante],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kits_estoque')
        .select('*')
        .eq('representante_id', selectedRepresentante)
        .eq('status', 'com_representante')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedRepresentante,
  });

  const { data: vendedoras = [] } = useQuery({
    queryKey: ['vendedoras-ativas-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedoras')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const kitsFiltrados = kitsEstoque.filter((kit: any) =>
    kit.codigo.toLowerCase().includes(kitSearchTerm.toLowerCase())
  );

  // Mutation: Salvar observações
  const salvarObsMutation = useMutation({
    mutationFn: async () => {
      if (!cobrancaDiariaId) throw new Error('Registro de cobrança não encontrado');
      const { error } = await supabase
        .from('cobrancas_diarias')
        .update({ observacoes: obsText.trim() || null })
        .eq('id', cobrancaDiariaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobranca-diaria-fechamento'] });
      toast.success('Observação salva com sucesso');
      setEditingObs(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Mutation: Alterar data da nota
  const alterarDataMutation = useMutation({
    mutationFn: async ({ notaId, novaData }: { notaId: string; novaData: string }) => {
      const { error } = await supabase
        .from('notas_promissorias')
        .update({ data: novaData })
        .eq('id', notaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-representante-fechamento'] });
      queryClient.invalidateQueries({ queryKey: ['cobranca-diaria-fechamento'] });
      toast.success('Data da nota alterada com sucesso');
      setAlterarDataOpen(false);
      setNotaParaAlterar(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Mutation: Entregar kit
  const entregaKitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedKit || !revendedoraKit.trim()) {
        throw new Error('Selecione um kit e informe a revendedora');
      }
      const vendedoraSelecionada = vendedoras.find((v: any) => v.id === vendedoraId);
      const { data: result, error } = await supabase
        .rpc('entregar_kit_para_revendedora', {
          p_kit_id: selectedKit,
          p_user_id: selectedRepresentante,
          p_revendedora: sanitizeString(revendedoraKit),
          p_data_vencimento: dataVencimentoKit,
          p_vendedora_id: vincularVendedora ? vendedoraId : null,
          p_vendedora_nome: vincularVendedora && vendedoraSelecionada ? vendedoraSelecionada.nome : null,
        });
      if (error) throw error;
      const response = result as { success: boolean; error?: string };
      if (!response.success) throw new Error(response.error || 'Erro ao entregar kit');
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kits-estoque-admin'] });
      queryClient.invalidateQueries({ queryKey: ['kits-entregues-admin'] });
      queryClient.invalidateQueries({ queryKey: ['detalhes-kits-cobrancas-admin'] });
      toast.success('Kit entregue com sucesso pelo admin');
      setKitDialogOpen(false);
      setSelectedKit('');
      setKitSearchTerm('');
      setRevendedoraKit('');
      setVincularVendedora(false);
      setVendedoraId('');
      setDataVencimentoKit(getLocalDateString(addDays(new Date(), 60)));
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Buscar nota na agenda do representante
  const handleBuscarNota = async () => {
    if (!codigoBusca.trim()) {
      setErroNota('Informe o código da nota ou nome da revendedora');
      return;
    }
    setBuscandoNota(true);
    setErroNota(null);
    setNotaEncontrada(null);

    try {
      const termoBusca = codigoBusca.trim().toLowerCase();
      const notaJaLancada = notas.find(n =>
        n.codigo_nota.toLowerCase().includes(termoBusca) ||
        termoBusca.includes(n.codigo_nota.toLowerCase())
      );
      if (notaJaLancada) {
        setErroNota('Essa nota já foi lançada hoje');
        setBuscandoNota(false);
        return;
      }

      const { data: porCodigo } = await supabase
        .from('cobrancas_agendadas')
        .select('*')
        .eq('representante_id', selectedRepresentante)
        .ilike('codigo_nota', `%${codigoBusca.trim()}%`)
        .in('status', ['pendente', 'parcial', 'reagendado'])
        .order('data_agendada', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (porCodigo) {
        setNotaEncontrada(porCodigo);
        setBuscandoNota(false);
        return;
      }

      const { data: porRevendedora } = await supabase
        .from('cobrancas_agendadas')
        .select('*')
        .eq('representante_id', selectedRepresentante)
        .ilike('revendedora', `%${codigoBusca.trim()}%`)
        .in('status', ['pendente', 'parcial', 'reagendado'])
        .order('data_agendada', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (porRevendedora) {
        setNotaEncontrada(porRevendedora);
      } else {
        setErroNota('Nenhuma nota encontrada na agenda deste representante');
      }
    } catch (err: any) {
      setErroNota(err.message);
    } finally {
      setBuscandoNota(false);
    }
  };

  // Handler de pagamento completo (matching ModalReceberCobranca signature)
  const handlePagamentoCompleto = async (dados: {
    valor_venda: number;
    comissao_percentual: number;
    comissao_valor: number;
    valor_devido_empresa: number;
    pagamentos: Array<{ forma: FormaPagamento; valor: number }>;
    tipo: 'completo' | 'devolucao';
    dataNota: string;
  }) => {
    if (!cobrancaParaPagar) return;

    const cobranca = cobrancaParaPagar;
    const codigoNota = cobranca.codigo_nota || `ADMIN-${Date.now()}`;

    try {
      // 1. Criar prestação de contas
      const { error: prestacaoError } = await supabase
        .from('prestacoes_contas')
        .insert({
          cobranca_id: cobranca.id,
          representante_id: selectedRepresentante,
          revendedora: cobranca.revendedora || '',
          total_venda: dados.valor_venda,
          comissao_percentual: dados.comissao_percentual,
          comissao_valor: dados.comissao_valor,
          valor_devido_empresa: dados.valor_devido_empresa,
          valor_pago: dados.valor_devido_empresa,
          saldo_devedor: 0,
          forma_pagamento: dados.tipo === 'devolucao' ? 'dinheiro' : dados.pagamentos[0].forma,
          data_execucao: dados.dataNota,
          codigo_nota_referencia: codigoNota,
        });
      if (prestacaoError) throw prestacaoError;

      // 2. Criar nota promissória em nome do representante
      const { error: notaError } = await supabase
        .from('notas_promissorias')
        .insert({
          representante_id: selectedRepresentante,
          codigo_nota: codigoNota,
          data: dados.dataNota,
          valor_total: dados.tipo === 'devolucao' ? 0 : dados.valor_devido_empresa,
          forma_pagamento_1: dados.tipo === 'devolucao' ? 'dinheiro' : dados.pagamentos[0]?.forma || 'dinheiro',
          valor_pagamento_1: dados.tipo === 'devolucao' ? 0 : dados.pagamentos[0]?.valor || 0,
          forma_pagamento_2: dados.pagamentos[1]?.forma || null,
          valor_pagamento_2: dados.pagamentos[1]?.valor || null,
          devolveu_tudo: dados.tipo === 'devolucao',
          cobranca_id: cobranca.id,
        });
      if (notaError) throw notaError;

      // 3. Atualizar cobrança
      const { error: updateError } = await supabase
        .from('cobrancas_agendadas')
        .update({
          status: 'pago' as any,
          valor_pago_acumulado: dados.valor_devido_empresa,
          data_quitacao: dados.dataNota,
        })
        .eq('id', cobranca.id);
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['notas-representante-fechamento'] });
      queryClient.invalidateQueries({ queryKey: ['cobranca-diaria-fechamento'] });
      toast.success('Nota registrada com sucesso pelo admin');
      setCobrancaParaPagar(null);
      setBuscarNotaOpen(false);
      setCodigoBusca('');
      setNotaEncontrada(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Handler de pagamento parcial (matching ModalReceberCobranca signature)
  const handlePagamentoParcial = async (dados: {
    valor_venda: number;
    comissao_percentual: number;
    comissao_valor: number;
    valor_devido_empresa: number;
    valor_recebido: number;
    pagamentos: Array<{ forma: FormaPagamento; valor: number }>;
    valor_repasse: number;
    data_repasse: Date;
    dataNota: string;
  }) => {
    if (!cobrancaParaPagar) return;

    const cobranca = cobrancaParaPagar;
    const isRepasse = cobranca.tipo?.toLowerCase() === 'repasse';
    const codigoNota = cobranca.codigo_nota || `ADMIN-${Date.now()}`;

    try {
      // 1. Criar nota promissória
      const { error: notaError } = await supabase
        .from('notas_promissorias')
        .insert({
          representante_id: selectedRepresentante,
          codigo_nota: codigoNota,
          data: dados.dataNota,
          valor_total: dados.valor_recebido,
          forma_pagamento_1: dados.pagamentos[0]?.forma || 'dinheiro',
          valor_pagamento_1: dados.pagamentos[0]?.valor || 0,
          forma_pagamento_2: dados.pagamentos[1]?.forma || null,
          valor_pagamento_2: dados.pagamentos[1]?.valor || null,
          cobranca_id: cobranca.id,
        });
      if (notaError) throw notaError;

      // 2. Para KIT: criar prestação de contas
      if (!isRepasse) {
        const { error: prestacaoError } = await supabase
          .from('prestacoes_contas')
          .insert({
            cobranca_id: cobranca.id,
            representante_id: selectedRepresentante,
            revendedora: cobranca.revendedora || '',
            total_venda: dados.valor_venda,
            comissao_percentual: dados.comissao_percentual,
            comissao_valor: dados.comissao_valor,
            valor_devido_empresa: dados.valor_devido_empresa,
            valor_pago: dados.valor_recebido,
            saldo_devedor: dados.valor_repasse,
            forma_pagamento: dados.pagamentos[0]?.forma || 'dinheiro',
            data_execucao: dados.dataNota,
            codigo_nota_referencia: codigoNota,
          });
        if (prestacaoError) throw prestacaoError;
      }

      // 3. Atualizar cobrança - abater saldo
      const acumuladoAtual = cobranca.valor_pago_acumulado || 0;
      const valorAdiantado = cobranca.valor_adiantado || 0;
      let valorPrevistoEfetivo = cobranca.valor_previsto || 0;

      const updateData: any = {
        valor_pago_acumulado: acumuladoAtual + dados.valor_recebido,
        data_agendada: format(dados.data_repasse, 'yyyy-MM-dd'),
      };

      if (acumuladoAtual === 0 && cobranca.tipo?.toLowerCase() !== 'repasse') {
        valorPrevistoEfetivo = dados.valor_devido_empresa + dados.valor_recebido;
        updateData.valor_previsto = valorPrevistoEfetivo;
      }

      const novoAcumulado = acumuladoAtual + dados.valor_recebido;
      const saldoAberto = valorPrevistoEfetivo - novoAcumulado - valorAdiantado;
      updateData.status = saldoAberto <= 0 ? 'pago' : 'parcial';
      if (saldoAberto <= 0) updateData.data_quitacao = dados.dataNota;

      const { error: updateError } = await supabase
        .from('cobrancas_agendadas')
        .update(updateData)
        .eq('id', cobranca.id);
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['notas-representante-fechamento'] });
      queryClient.invalidateQueries({ queryKey: ['cobranca-diaria-fechamento'] });
      toast.success('Pagamento parcial registrado pelo admin');
      setCobrancaParaPagar(null);
      setBuscarNotaOpen(false);
      setCodigoBusca('');
      setNotaEncontrada(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-3">
      {/* 1. Observações do Admin */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Observações do Admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!editingObs && isDiaFinalizado ? (
            <div className="space-y-2">
              {observacoesDia ? (
                <p className="text-sm bg-muted/50 p-3 rounded-lg whitespace-pre-wrap">{observacoesDia}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma observação</p>
              )}
              <Button variant="outline" size="sm" onClick={() => { setObsText(observacoesDia || ''); setEditingObs(true); }}>
                <Edit2 className="h-3.5 w-3.5 mr-1" />
                {observacoesDia ? 'Editar' : 'Adicionar'} Observação
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea
                placeholder="Observação do administrador..."
                value={editingObs ? obsText : (observacoesDia || '')}
                onChange={(e) => setObsText(e.target.value)}
                className="min-h-[80px] resize-none"
                maxLength={500}
                disabled={!editingObs && isDiaFinalizado}
              />
              {(editingObs || !isDiaFinalizado) && cobrancaDiariaId && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => salvarObsMutation.mutate()} disabled={salvarObsMutation.isPending}>
                    Salvar
                  </Button>
                  {editingObs && (
                    <Button variant="outline" size="sm" onClick={() => setEditingObs(false)}>
                      Cancelar
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Buscar Nota + 4. Entregar Kit */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => { setBuscarNotaOpen(true); setCodigoBusca(''); setNotaEncontrada(null); setErroNota(null); }}>
          <Search className="h-4 w-4 mr-1" />
          Buscar Nota
        </Button>
        <Button variant="outline" size="sm" onClick={() => setKitDialogOpen(true)}>
          <Package className="h-4 w-4 mr-1" />
          Entregar Kit
        </Button>
      </div>

      {/* 3. Alterar data - ações por nota */}
      {notas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ações por Nota</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {notas.map((nota) => (
                <div key={nota.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 text-sm">
                  <span className="font-mono">{nota.codigo_nota} — {formatarValor(nota.valor_total)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNotaParaAlterar(nota);
                      setNovaData(nota.data);
                      setAlterarDataOpen(true);
                    }}
                  >
                    <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                    Alterar Data
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog Buscar Nota */}
      <Dialog open={buscarNotaOpen} onOpenChange={setBuscarNotaOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buscar Nota na Agenda de {representanteNome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Código da nota ou nome da revendedora"
                value={codigoBusca}
                onChange={(e) => setCodigoBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBuscarNota()}
              />
              <Button onClick={handleBuscarNota} disabled={buscandoNota}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {erroNota && <p className="text-sm text-destructive">{erroNota}</p>}

            {notaEncontrada && (
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">{notaEncontrada.revendedora}</span>
                    <Badge variant="outline">{notaEncontrada.tipo || 'repasse'}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Código: {notaEncontrada.codigo_nota}</span>
                    <span className="font-bold">{formatarValor(notaEncontrada.valor_previsto)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Vencimento: {notaEncontrada.data_agendada}
                    {' • '}Status: {notaEncontrada.status}
                  </div>
                  <Button
                    className="w-full mt-2"
                    onClick={() => setCobrancaParaPagar(notaEncontrada)}
                  >
                    Cobrar
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Alterar Data */}
      <Dialog open={alterarDataOpen} onOpenChange={setAlterarDataOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Data da Nota</DialogTitle>
          </DialogHeader>
          {notaParaAlterar && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Nota: <strong>{notaParaAlterar.codigo_nota}</strong> — {formatarValor(notaParaAlterar.valor_total)}
              </p>
              <div>
                <Label>Nova Data</Label>
                <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAlterarDataOpen(false)}>Cancelar</Button>
                <Button
                  onClick={() => alterarDataMutation.mutate({ notaId: notaParaAlterar.id, novaData })}
                  disabled={!novaData || novaData === notaParaAlterar.data || alterarDataMutation.isPending}
                >
                  Confirmar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Entregar Kit */}
      <Dialog open={kitDialogOpen} onOpenChange={setKitDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Entregar Kit por {representanteNome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Buscar Kit</Label>
              <Input
                placeholder="Pesquisar por código..."
                value={kitSearchTerm}
                onChange={(e) => setKitSearchTerm(e.target.value)}
              />
            </div>
            {kitsFiltrados.length > 0 ? (
              <Select value={selectedKit} onValueChange={setSelectedKit}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um kit" />
                </SelectTrigger>
                <SelectContent>
                  {kitsFiltrados.map((kit: any) => (
                    <SelectItem key={kit.id} value={kit.id}>
                      {kit.codigo} — {kit.tipo} ({formatarValor(kit.valor || 0)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum kit disponível no estoque</p>
            )}

            <div>
              <Label>Revendedora</Label>
              <RevendedoraSearchSelect
                representanteId={selectedRepresentante}
                value={revendedoraKit}
                onSelect={setRevendedoraKit}
                placeholder="Nome da revendedora"
              />
            </div>

            <div>
              <Label>Data de Vencimento</Label>
              <Input type="date" value={dataVencimentoKit} onChange={(e) => setDataVencimentoKit(e.target.value)} />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="vincular-vend-admin" checked={vincularVendedora} onChange={(e) => setVincularVendedora(e.target.checked)} />
              <Label htmlFor="vincular-vend-admin" className="text-sm">Vincular vendedora</Label>
            </div>

            {vincularVendedora && (
              <Select value={vendedoraId} onValueChange={setVendedoraId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a vendedora" />
                </SelectTrigger>
                <SelectContent>
                  {vendedoras.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setKitDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => entregaKitMutation.mutate()}
                disabled={!selectedKit || !revendedoraKit.trim() || entregaKitMutation.isPending}
              >
                Confirmar Entrega
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Receber Cobrança */}
      {cobrancaParaPagar && (
        <ModalReceberCobranca
          open={!!cobrancaParaPagar}
          onOpenChange={(open) => { if (!open) setCobrancaParaPagar(null); }}
          cobranca={{
            id: cobrancaParaPagar.id,
            revendedora: cobrancaParaPagar.revendedora,
            valor_previsto: cobrancaParaPagar.valor_previsto,
            tipo: cobrancaParaPagar.tipo,
            valor_adiantado: cobrancaParaPagar.valor_adiantado,
          }}
          valor_pago_acumulado={cobrancaParaPagar.valor_pago_acumulado || 0}
          diasNaoFinalizados={[]}
          onPagamentoCompleto={handlePagamentoCompleto}
          onPagamentoParcial={handlePagamentoParcial}
        />
      )}
    </div>
  );
}
