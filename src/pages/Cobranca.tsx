import { useState, useMemo } from 'react';
import { registrarLog } from '@/lib/logOperacional';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Calendar as CalendarIcon,
  CreditCard,
  Search,
  ChevronRight,
  RefreshCw,
  MoreVertical,
  Wallet,
  Package,
  Scale,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { ModalRegistrarAcrescimo } from '@/components/cobranca/ModalRegistrarAcrescimo';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format, getDate, getDay, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { Database } from '@/integrations/supabase/types';
import { formatarValor, parseLocalDate, formatDateBR, getLocalDateString, cn } from '@/lib/utils';
import { ModalReceberCobranca } from '@/components/cobranca/ModalReceberCobranca';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAgendaCobrancas } from '@/hooks/useAgendaCobrancas';

type Cobranca = Database['public']['Tables']['cobrancas_agendadas']['Row'];

function getSmartStatus(cobranca: Cobranca): { label: string; color: string } {
  if (cobranca.status === 'pago')
    return { label: 'Pago', color: 'bg-green-500/15 text-green-700 dark:text-green-400' };
  if (cobranca.status === 'parcial')
    return { label: 'Parcial', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' };
  if (cobranca.status === 'juridico')
    return { label: 'Jurídico', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400' };
  if (cobranca.status === 'cancelado')
    return { label: 'Cancelado', color: 'bg-muted text-muted-foreground dark:text-gray-400' };
  // pendente
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataCobranca = parseLocalDate(cobranca.data_agendada);
  if (dataCobranca < hoje)
    return { label: 'Vencida', color: 'bg-red-500/15 text-red-700 dark:text-red-400' };
  return { label: 'A vencer', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' };
}

// Semana do mês (mesma lógica do GerenciarAgenda)
function getWeekOfMonth(dateStr: string): number {
  const date = new Date(dateStr + 'T12:00:00');
  const dayOfMonth = getDate(date);
  const firstDayOfMonth = startOfMonth(date);
  const firstDayWeekday = getDay(firstDayOfMonth);
  const firstSunday = firstDayWeekday === 0 ? 1 : 7 - firstDayWeekday + 1;
  if (dayOfMonth <= firstSunday) return 1;
  const daysAfterFirstSunday = dayOfMonth - firstSunday;
  return Math.ceil(daysAfterFirstSunday / 7) + 1;
}

export default function Cobranca() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  // userId e a query da agenda vivem em useAgendaCobrancas — NÃO usar useEffect com supabase.auth.getUser() (race condition).
  const { cobrancas, isLoading, userId } = useAgendaCobrancas();

  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('abertas');
  const [filtroMesAno, setFiltroMesAno] = useState<string>(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Modal de detalhe
  const [detailCobranca, setDetailCobranca] = useState<Cobranca | null>(null);
  const [detailPrestacao, setDetailPrestacao] = useState<any>(null);
  const [detailNotas, setDetailNotas] = useState<any[]>([]);
  const [detailPagamentosHistorico, setDetailPagamentosHistorico] = useState<any[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal cobrar
  const [cobrancaParaPagar, setCobrancaParaPagar] = useState<Cobranca | null>(null);

  // Modal reagendar
  const [modalReagendarOpen, setModalReagendarOpen] = useState(false);
  const [cobrancaParaReagendar, setCobrancaParaReagendar] = useState<Cobranca | null>(null);
  const [novaDataAgendada, setNovaDataAgendada] = useState<Date>();

  // Modal adiantamento
  const [modalAdiantamentoOpen, setModalAdiantamentoOpen] = useState(false);
  const [cobrancaParaAdiantar, setCobrancaParaAdiantar] = useState<Cobranca | null>(null);
  const [valorAdiantamento, setValorAdiantamento] = useState('');
  const [obsAdiantamento, setObsAdiantamento] = useState('');

  // Modal encomendas (acréscimo)
  const [modalAcrescimoOpen, setModalAcrescimoOpen] = useState(false);
  const [cobrancaParaAcrescimo, setCobrancaParaAcrescimo] = useState<Cobranca | null>(null);

  // Confirmação jurídico
  const [cobrancaParaJuridico, setCobrancaParaJuridico] = useState<Cobranca | null>(null);

  // Buscar dias não finalizados
  const { data: diasNaoFinalizados = [] } = useQuery({
    queryKey: ['dias-nao-finalizados', userId],
    queryFn: async () => {
      if (!userId) return [];
      const hoje = new Date();
      const diasAnteriores: string[] = [];
      for (let i = 1; i <= 30; i++) {
        const data = new Date(hoje);
        data.setDate(data.getDate() - i);
        diasAnteriores.push(format(data, 'yyyy-MM-dd'));
      }
      const { data: finalizados, error } = await supabase
        .from('cobrancas_diarias')
        .select('data')
        .eq('representante_id', userId)
        .eq('finalizado', true)
        .in('data', diasAnteriores);
      if (error) throw error;
      const datasFinalizadas = new Set(finalizados?.map(f => f.data) || []);
      return diasAnteriores.filter(d => !datasFinalizadas.has(d));
    },
    enabled: !!userId,
  });

  // ============ MUTATIONS DE PAGAMENTO (mantidas do código original) ============

  const handlePagamentoCompleto = async (cobrancaId: string, dados: {
    valor_venda: number;
    comissao_percentual: number;
    comissao_valor: number;
    valor_devido_empresa: number;
    pagamentos: Array<{ forma: any; valor: number }>;
    tipo: 'completo' | 'devolucao';
    dataNota: string;
    valor_devolvido?: number;
  }) => {
    const cobrancaLocal = cobrancas.find(c => c.id === cobrancaId);
    const { data: freshCobranca, error: freshError } = await supabase
      .from('cobrancas_agendadas')
      .select('*')
      .eq('id', cobrancaId)
      .maybeSingle();
    if (freshError) throw freshError;
    const cobranca = (freshCobranca as Cobranca | null) || cobrancaLocal;

    const { data: historicoAtual } = await supabase
      .from('pagamentos_historico')
      .select('valor')
      .eq('cobranca_id', cobrancaId);
    const acumuladoAtual = Math.max(
      Number((cobranca as any)?.valor_pago_acumulado || 0),
      (historicoAtual || []).reduce((t, p) => t + Number(p.valor || 0), 0)
    );

    const dataNota = dados.dataNota;
    const codigoNotaGerado = cobranca?.codigo_nota || `AUTO-${Date.now()}`;
    const valorAdiantado = cobranca?.valor_adiantado || 0;

    // Determinar novo valor_previsto (preservando lógica original)
    let novoValorPrevisto: number | null = null;
    if (dados.tipo === 'devolucao') {
      novoValorPrevisto = 0;
    } else if (acumuladoAtual === 0 && cobranca?.tipo?.toLowerCase() !== 'repasse') {
      novoValorPrevisto = dados.valor_devido_empresa + valorAdiantado;
    }

    const formaPagamento = dados.tipo === 'devolucao'
      ? 'dinheiro'
      : (dados.pagamentos[0]?.forma || 'dinheiro');

    const isContinuacao = acumuladoAtual > 0;
    const { error: rpcError } = await supabase.rpc('registrar_pagamento_cobranca', {
      p_cobranca_id: cobrancaId,
      p_representante_id: userId!,
      p_revendedora: cobranca?.revendedora || '',
      p_total_venda: isContinuacao ? 0 : dados.valor_venda,
      p_comissao_percentual: isContinuacao ? 0 : dados.comissao_percentual,
      p_comissao_valor: isContinuacao ? 0 : dados.comissao_valor,
      p_valor_devido_empresa: dados.valor_devido_empresa,
      p_valor_pago_prestacao: dados.valor_devido_empresa,
      p_saldo_devedor: 0,
      p_forma_pagamento: formaPagamento,
      p_data_execucao: dataNota,
      p_codigo_nota_ref: codigoNotaGerado,
      p_valor_nota: dados.tipo === 'devolucao' ? 0 : dados.valor_devido_empresa,
      p_forma_pagamento_1: formaPagamento,
      p_valor_pagamento_1: dados.tipo === 'devolucao' ? 0 : (dados.pagamentos[0]?.valor || 0),
      p_forma_pagamento_2: dados.pagamentos[1]?.forma || null,
      p_valor_pagamento_2: dados.pagamentos[1]?.valor ?? null,
      p_devolveu_tudo: dados.tipo === 'devolucao',
      p_status_no_pagamento: (cobranca as any)?.status ?? null,
      p_novo_valor_previsto: novoValorPrevisto,
      p_novo_status: 'pago',
      p_data_quitacao: dataNota,
      p_data_agendada: null,
      p_valor_devolvido: dados.valor_devolvido || 0,
    } as any);
    if (rpcError) throw rpcError;

    await queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
    await queryClient.invalidateQueries({ queryKey: ['notas-promissorias'] });

    const userLog = { id: userId!, nome: profile?.nome || '', papel: profile?.role || 'representante' };
    if (dados.tipo === 'devolucao') {
      registrarLog({
        tipo_acao: 'ALTERACAO_DEVOLUCAO',
        pedido_id: cobrancaId,
        valor_antes: cobranca?.valor_previsto,
        valor_depois: 0,
        descricao: `Devolução total registrada para ${cobranca?.revendedora || 'revendedora'}`,
        user: userLog,
      });
    } else {
      registrarLog({
        tipo_acao: 'REGISTRO_PAGAMENTO',
        pedido_id: cobrancaId,
        valor_antes: cobranca?.valor_previsto,
        valor_depois: dados.valor_devido_empresa,
        descricao: `Pagamento completo registrado para ${cobranca?.revendedora || 'revendedora'} - ${formatarValor(dados.valor_devido_empresa)}`,
        user: userLog,
      });
    }
  };

  const handlePagamentoParcial = async (cobrancaId: string, dados: {
    valor_venda: number;
    comissao_percentual: number;
    comissao_valor: number;
    valor_devido_empresa: number;
    valor_recebido: number;
    pagamentos: Array<{ forma: any; valor: number }>;
    valor_repasse: number;
    data_repasse: Date;
    dataNota: string;
    valor_devolvido?: number;
  }) => {
    const cobrancaLocal = cobrancas.find(c => c.id === cobrancaId);
    const { data: freshCobranca, error: freshError } = await supabase
      .from('cobrancas_agendadas')
      .select('*')
      .eq('id', cobrancaId)
      .maybeSingle();
    if (freshError) throw freshError;
    const cobranca = (freshCobranca as Cobranca | null) || cobrancaLocal;

    const { data: historicoAtual } = await supabase
      .from('pagamentos_historico')
      .select('valor')
      .eq('cobranca_id', cobrancaId);
    const acumuladoAtual = Math.max(
      Number((cobranca as any)?.valor_pago_acumulado || 0),
      (historicoAtual || []).reduce((t, p) => t + Number(p.valor || 0), 0)
    );

    const dataNota = dados.dataNota;
    const codigoNota = cobranca?.codigo_nota || `AUTO-${Date.now()}`;
    const isRepasse = cobranca?.tipo?.toLowerCase() === 'repasse';
    const valorAdiantado = cobranca?.valor_adiantado || 0;
    const novoStatus = (dados.valor_repasse ?? 0) <= 0 ? 'pago' : 'parcial';
    const dataQuitacao = novoStatus === 'pago' ? dataNota : null;
    const dataAgendada = format(dados.data_repasse, 'yyyy-MM-dd');
    const formaPagamento = dados.pagamentos[0]?.forma || 'dinheiro';

    let novoValorPrevisto: number | null = null;
    if (acumuladoAtual === 0 && !isRepasse) {
      novoValorPrevisto = dados.valor_devido_empresa + valorAdiantado;
    }

    if (isRepasse) {
      // Repasse: não gera prestação. Mantém insert direto de nota + update.
      const { error: notaError } = await supabase.from('notas_promissorias').insert({
        representante_id: userId!,
        codigo_nota: codigoNota,
        cobranca_id: cobrancaId,
        data: dataNota,
        valor_total: dados.valor_recebido,
        forma_pagamento_1: formaPagamento,
        valor_pagamento_1: dados.pagamentos[0]?.valor || 0,
        forma_pagamento_2: dados.pagamentos[1]?.forma || null,
        valor_pagamento_2: dados.pagamentos[1]?.valor ?? null,
        status_no_pagamento: (cobranca as any)?.status ?? null,
      });
      if (notaError) throw notaError;

      const updateData: any = {
        valor_pago_acumulado: acumuladoAtual + dados.valor_recebido,
        data_agendada: dataAgendada,
        status: novoStatus,
      };
      if (novoStatus === 'pago') updateData.data_quitacao = dataNota;

      const { error: updateError } = await supabase
        .from('cobrancas_agendadas')
        .update(updateData)
        .eq('id', cobrancaId);
      if (updateError) throw updateError;
    } else {
      const isContinuacao = acumuladoAtual > 0;
      const { error: rpcError } = await supabase.rpc('registrar_pagamento_cobranca', {
        p_cobranca_id: cobrancaId,
        p_representante_id: userId!,
        p_revendedora: cobranca?.revendedora || '',
        p_total_venda: isContinuacao ? 0 : dados.valor_venda,
        p_comissao_percentual: isContinuacao ? 0 : dados.comissao_percentual,
        p_comissao_valor: isContinuacao ? 0 : dados.comissao_valor,
        p_valor_devido_empresa: dados.valor_devido_empresa,
        p_valor_pago_prestacao: dados.valor_recebido,
        p_saldo_devedor: dados.valor_repasse,
        p_forma_pagamento: formaPagamento,
        p_data_execucao: dataNota,
        p_codigo_nota_ref: codigoNota,
        p_valor_nota: dados.valor_recebido,
        p_forma_pagamento_1: formaPagamento,
        p_valor_pagamento_1: dados.pagamentos[0]?.valor || 0,
        p_forma_pagamento_2: dados.pagamentos[1]?.forma || null,
        p_valor_pagamento_2: dados.pagamentos[1]?.valor ?? null,
        p_devolveu_tudo: false,
        p_status_no_pagamento: (cobranca as any)?.status ?? null,
        p_novo_valor_previsto: novoValorPrevisto,
        p_novo_status: novoStatus,
        p_data_quitacao: dataQuitacao,
        p_data_agendada: dataAgendada,
        p_valor_devolvido: dados.valor_devolvido || 0,
      } as any);
      if (rpcError) throw rpcError;
    }

    await queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
    await queryClient.invalidateQueries({ queryKey: ['notas-promissorias'] });

    registrarLog({
      tipo_acao: 'REGISTRO_PAGAMENTO',
      pedido_id: cobrancaId,
      valor_antes: cobranca?.valor_previsto,
      valor_depois: dados.valor_recebido,
      descricao: `Pagamento parcial de ${formatarValor(dados.valor_recebido)} registrado para ${cobranca?.revendedora || 'revendedora'}`,
      user: { id: userId!, nome: profile?.nome || '', papel: profile?.role || 'representante' },
    });
  };

  const reagendarMutation = useMutation({
    mutationFn: async ({ id, novaData }: { id: string; novaData: string }) => {
      const cobranca = cobrancas.find(c => c.id === id);
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .update({
          data_agendada: novaData,
          contagem_reagendamentos: ((cobranca?.contagem_reagendamentos || 0) + 1),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      toast({ title: 'Data reagendada com sucesso!' });
      setModalReagendarOpen(false);
      setCobrancaParaReagendar(null);
      setNovaDataAgendada(undefined);
    },
    onError: () => {
      toast({ title: 'Erro ao reagendar', variant: 'destructive' });
    },
  });

  const handleReagendarClick = (cobranca: Cobranca) => {
    setCobrancaParaReagendar(cobranca);
    setNovaDataAgendada(parseLocalDate(cobranca.data_agendada));
    setModalReagendarOpen(true);
  };

  const handleConfirmarReagendamento = () => {
    if (!cobrancaParaReagendar || !novaDataAgendada) return;
    reagendarMutation.mutate({
      id: cobrancaParaReagendar.id,
      novaData: getLocalDateString(novaDataAgendada),
    });
  };

  // Mutation: Adiantamento (pagamento antes do acerto)
  const adiantamentoMutation = useMutation({
    mutationFn: async () => {
      if (!cobrancaParaAdiantar || !userId) throw new Error('Dados incompletos');
      const valor = parseFloat(valorAdiantamento.replace(',', '.'));
      if (!valor || valor <= 0) throw new Error('Valor inválido');

      const cobrancaId = cobrancaParaAdiantar.id;
      const cobranca = cobrancas.find(c => c.id === cobrancaId);
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const codigoNota = `ADT-${cobranca?.revendedora || ''}-${format(new Date(), 'ddMMyyyyHHmmss')}`;

      const { error: notaError } = await supabase
        .from('notas_promissorias')
        .insert({
          representante_id: userId,
          codigo_nota: codigoNota,
          cobranca_id: cobrancaId,
          data: hoje,
          valor_total: valor,
          forma_pagamento_1: 'dinheiro',
          valor_pagamento_1: valor,
          status_no_pagamento: cobranca?.status ?? null,
        });
      if (notaError) throw notaError;

      const adiantadoAtual = cobranca?.valor_adiantado || 0;
      const { error: updateError } = await supabase
        .from('cobrancas_agendadas')
        .update({
          valor_adiantado: adiantadoAtual + valor,
          observacoes: obsAdiantamento
            ? `${cobranca?.observacoes || ''}\n[Adiantamento ${formatarValor(valor)}]: ${obsAdiantamento}`.trim()
            : cobranca?.observacoes,
        })
        .eq('id', cobrancaId);
      if (updateError) throw updateError;

      registrarLog({
        tipo_acao: 'REGISTRO_ADIANTAMENTO',
        pedido_id: cobrancaId,
        valor_antes: adiantadoAtual,
        valor_depois: adiantadoAtual + valor,
        descricao: `Adiantamento de ${formatarValor(valor)} registrado para ${cobranca?.revendedora || 'revendedora'}`,
        user: { id: userId, nome: profile?.nome || '', papel: profile?.role || 'representante' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      queryClient.invalidateQueries({ queryKey: ['notas-promissorias'] });
      toast({ title: 'Adiantamento registrado com sucesso!' });
      setModalAdiantamentoOpen(false);
      setCobrancaParaAdiantar(null);
      setValorAdiantamento('');
      setObsAdiantamento('');
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao registrar adiantamento', description: err?.message, variant: 'destructive' });
    },
  });

  // Mutation: Encaminhar para o jurídico
  const juridicoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .update({
          status: 'juridico',
          data_encaminhado_juridico: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      toast({ title: 'Cobrança encaminhada ao jurídico!' });
      setCobrancaParaJuridico(null);
    },
    onError: () => {
      toast({ title: 'Erro ao encaminhar ao jurídico', variant: 'destructive' });
    },
  });

  const handleOpenAdiantamento = (cobranca: Cobranca) => {
    setCobrancaParaAdiantar(cobranca);
    setValorAdiantamento('');
    setObsAdiantamento('');
    setModalAdiantamentoOpen(true);
  };

  const handleOpenAcrescimo = (cobranca: Cobranca) => {
    setCobrancaParaAcrescimo(cobranca);
    setModalAcrescimoOpen(true);
  };

  const handleOpenDetail = async (cobranca: Cobranca) => {
    setDetailCobranca(cobranca);
    setIsDetailOpen(true);
    setLoadingDetail(true);
    setDetailPrestacao(null);
    setDetailNotas([]);
    setDetailPagamentosHistorico([]);
    try {
      const { data: fresh } = await supabase
        .from('cobrancas_agendadas')
        .select('*')
        .eq('id', cobranca.id)
        .maybeSingle();
      if (fresh) setDetailCobranca(fresh as any);

      const { data: pc } = await supabase
        .from('prestacoes_contas')
        .select('*')
        .eq('cobranca_id', cobranca.id);
      const { data: notas } = await supabase
        .from('notas_promissorias')
        .select('*')
        .eq('cobranca_id', cobranca.id)
        .order('data', { ascending: true });
      const { data: pagamentosHistorico } = await supabase
        .from('pagamentos_historico')
        .select('*')
        .eq('cobranca_id', cobranca.id)
        .order('data_pagamento', { ascending: true });
      setDetailPrestacao(pc && pc.length > 0 ? pc[0] : null);
      setDetailNotas(notas || []);
      setDetailPagamentosHistorico(pagamentosHistorico || []);
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ============ FILTRAGEM E AGRUPAMENTO ============
  const cobrancasFiltradas = useMemo(() => {
    return cobrancas.filter(c => {
      // Mês/Ano
      if (filtroMesAno !== 'todas') {
        const [anoFiltro, mesFiltro] = filtroMesAno.split('-').map(Number);
        const dataCobranca = new Date(c.data_agendada + 'T12:00:00');
        if (
          dataCobranca.getFullYear() !== anoFiltro ||
          dataCobranca.getMonth() + 1 !== mesFiltro
        ) {
          return false;
        }
      }
      // Busca
      if (searchTerm) {
        const termo = searchTerm.toLowerCase();
        const match =
          c.revendedora.toLowerCase().includes(termo) ||
          c.codigo_nota?.toLowerCase().includes(termo);
        if (!match) return false;
      }
      // Status
      if (filtroStatus === 'abertas') {
        if (!['pendente', 'parcial'].includes(c.status as string)) return false;
      } else if (filtroStatus !== 'todos' && c.status !== filtroStatus) {
        return false;
      }
      return true;
    });
  }, [cobrancas, filtroMesAno, searchTerm, filtroStatus]);

  const { cobrancasPorGrupo, grupoLabels, gruposOrdenados } = useMemo(() => {
    const por: Record<string, Cobranca[]> = {};
    const labels: Record<string, string> = {};

    if (filtroMesAno === 'todas') {
      cobrancasFiltradas.forEach(cobranca => {
        const d = new Date(cobranca.data_agendada + 'T12:00:00');
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!por[key]) {
          por[key] = [];
          const labelRaw = format(d, "MMMM 'de' yyyy", { locale: ptBR });
          labels[key] = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);
        }
        por[key].push(cobranca);
      });
    } else {
      cobrancasFiltradas.forEach(cobranca => {
        const semana = getWeekOfMonth(cobranca.data_agendada);
        const key = String(semana);
        if (!por[key]) {
          por[key] = [];
          labels[key] = `Semana ${semana}`;
        }
        por[key].push(cobranca);
      });
    }

    Object.keys(por).forEach(key => {
      por[key].sort(
        (a, b) =>
          parseLocalDate(a.data_agendada).getTime() - parseLocalDate(b.data_agendada).getTime(),
      );
    });

    return {
      cobrancasPorGrupo: por,
      grupoLabels: labels,
      gruposOrdenados: Object.keys(por).sort(),
    };
  }, [cobrancasFiltradas, filtroMesAno]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground animate-pulse">Carregando cobranças...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Agenda de Cobranças</h1>
          <p className="text-sm text-muted-foreground">
            Suas cobranças organizadas por semana
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] })}
          title="Atualizar dados"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {filtroMesAno === 'todas'
              ? 'Todas as Cobranças'
              : (() => {
                  const [ano, mes] = filtroMesAno.split('-').map(Number);
                  const data = new Date(ano, mes - 1, 1);
                  const label = format(data, "MMMM 'de' yyyy", { locale: ptBR });
                  return 'Agenda de ' + label.charAt(0).toUpperCase() + label.slice(1);
                })()}
          </CardTitle>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por revendedora ou código da nota..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-md"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={filtroMesAno} onValueChange={setFiltroMesAno}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Mês/Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as notas</SelectItem>
                    {(() => {
                      const meses = [];
                      const hoje = new Date();
                      for (let i = -6; i <= 6; i++) {
                        const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
                        const valor = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
                        const label = format(data, 'MMMM/yyyy', { locale: ptBR });
                        meses.push({
                          valor,
                          label: label.charAt(0).toUpperCase() + label.slice(1),
                        });
                      }
                      return meses.map(m => (
                        <SelectItem key={m.valor} value={m.valor}>
                          {m.label}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="abertas">Abertas (a cobrar)</SelectItem>
                    <SelectItem value="todos">Todos Status</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="parcial">Parcial</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {cobrancasFiltradas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma cobrança encontrada
            </div>
          ) : (
            <div className="space-y-4">
              {gruposOrdenados.map(grupoKey => {
                const isOpen = openGroups[grupoKey] ?? false;
                const notasGrupo = cobrancasPorGrupo[grupoKey];
                const totalGrupo = notasGrupo.reduce((sum, c) => sum + c.valor_previsto, 0);
                const grupoLabel = grupoLabels[grupoKey];

                return (
                  <Collapsible
                    key={grupoKey}
                    open={isOpen}
                    onOpenChange={() => toggleGroup(grupoKey)}
                    className="group"
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 bg-card border border-border rounded-lg shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <ChevronRight
                          className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                        />
                        <div className="flex flex-col items-start">
                          <span className="font-semibold text-foreground">{grupoLabel}</span>
                          <span className="text-xs text-muted-foreground">
                            {notasGrupo.length} nota{notasGrupo.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
                        <div className="text-right hidden sm:block">
                          <span className="text-sm font-medium text-foreground">
                            {formatarValor(totalGrupo)}
                          </span>
                          <span className="text-xs text-muted-foreground block">previsto</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {(() => {
                            const pendentes = notasGrupo.filter(c => c.status === 'pendente').length;
                            const pagas = notasGrupo.filter(c => c.status === 'pago').length;
                            const parciais = notasGrupo.filter(c => c.status === 'parcial').length;
                            return (
                              <>
                                {pendentes > 0 && (
                                  <Badge className="bg-yellow-500/10 text-yellow-700 border-0 text-xs">
                                    {pendentes} pend.
                                  </Badge>
                                )}
                                {parciais > 0 && (
                                  <Badge className="bg-amber-500/10 text-amber-700 border-0 text-xs">
                                    {parciais} parc.
                                  </Badge>
                                )}
                                {pagas > 0 && (
                                  <Badge className="bg-green-500/10 text-green-700 border-0 text-xs">
                                    {pagas} paga{pagas !== 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                      {/* MOBILE: Cards (< 768px) */}
                      <div className="md:hidden mt-2 space-y-2">
                        {notasGrupo.map(cobranca => {
                          const smart = getSmartStatus(cobranca);
                          const status = cobranca.status;
                           const isAtivo = ['pendente', 'parcial'].includes(status as string);
                           const valorKit = cobranca.valor_kit_original && cobranca.valor_kit_original > 0 ? cobranca.valor_kit_original : cobranca.valor_previsto;
                           const pago = cobranca.valor_pago_acumulado || 0;
                          let saldoLabel: React.ReactNode;
                          if (status === 'pago') {
                            saldoLabel = formatarValor(0);
                          } else if (status === 'parcial') {
                            const saldo =
                              cobranca.valor_previsto - pago - (cobranca.valor_adiantado || 0);
                            saldoLabel = formatarValor(Math.max(0, saldo));
                          } else {
                            saldoLabel = (
                              <span className="text-muted-foreground italic text-xs">
                                Apuração pendente
                              </span>
                            );
                          }

                          return (
                            <div
                              key={cobranca.id}
                              onClick={() => handleOpenDetail(cobranca)}
                              className="border border-border rounded-lg p-3 bg-card/50 active:bg-card/80 transition-colors cursor-pointer space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold text-sm text-foreground leading-tight flex-1">
                                  {cobranca.revendedora}
                                </p>
                                <Badge className={`${smart.color} border-0 whitespace-nowrap text-xs shrink-0`}>
                                  {smart.label}
                                </Badge>
                              </div>

                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="font-mono">
                                  Cód: {cobranca.codigo_nota || '—'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <CalendarIcon className="h-3 w-3" />
                                  {formatDateBR(cobranca.data_agendada)}
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-border/50">
                                <div>
                                  <span className="text-muted-foreground block">Kit</span>
                                  <span className="font-medium text-foreground">
                                    {status === 'pendente' ? formatarValor(valorKit) : '—'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">Pago</span>
                                  <span className="font-medium text-foreground">
                                    {pago > 0 ? formatarValor(pago) : '—'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">Saldo</span>
                                  <span className="font-semibold text-foreground">{saldoLabel}</span>
                                </div>
                              </div>

                              {isAtivo && (
                                <div
                                  className="flex items-center gap-2 pt-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    size="sm"
                                    onClick={() => setCobrancaParaPagar(cobranca)}
                                    className="flex-1 h-9"
                                  >
                                    <CreditCard className="h-4 w-4 mr-1.5" />
                                    Cobrar
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="sm" variant="outline" className="h-9 w-9 p-0">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                      <DropdownMenuItem onClick={() => handleReagendarClick(cobranca)}>
                                        <CalendarIcon className="h-4 w-4 mr-2" />
                                        Reagendar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleOpenAdiantamento(cobranca)}>
                                        <Wallet className="h-4 w-4 mr-2" />
                                        Adiantamento
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        disabled={!cobranca.kit_entregue_id}
                                        onClick={() => handleOpenAcrescimo(cobranca)}
                                      >
                                        <Package className="h-4 w-4 mr-2" />
                                        Encomendas
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => setCobrancaParaJuridico(cobranca)}
                                        className="text-purple-700 focus:text-purple-700 focus:bg-purple-500/10"
                                      >
                                        <Scale className="h-4 w-4 mr-2" />
                                        Jurídico
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* DESKTOP: Table (>= 768px) */}
                      <div className="hidden md:block overflow-x-auto mt-2 border border-border rounded-lg bg-card/50">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="min-w-[140px]">Revendedora</TableHead>
                              <TableHead className="min-w-[90px]">Código</TableHead>
                              <TableHead className="min-w-[110px]">Valor do Kit</TableHead>
                              <TableHead className="min-w-[100px]">Pago</TableHead>
                              <TableHead className="min-w-[130px]">Saldo</TableHead>
                              <TableHead className="min-w-[110px]">Data Vencimento</TableHead>
                              <TableHead className="min-w-[110px]">Status</TableHead>
                              <TableHead className="text-right min-w-[150px]">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {notasGrupo.map(cobranca => (
                              <TableRow
                                key={cobranca.id}
                                className="cursor-pointer"
                                onClick={() => handleOpenDetail(cobranca)}
                              >
                                <TableCell className="font-medium">{cobranca.revendedora}</TableCell>
                                <TableCell>
                                  <span className="font-mono text-xs">
                                    {cobranca.codigo_nota || '-'}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {cobranca.status === 'pendente'
                                    ? formatarValor(cobranca.valor_kit_original && cobranca.valor_kit_original > 0 ? cobranca.valor_kit_original : cobranca.valor_previsto)
                                    : '-'}
                                </TableCell>
                                <TableCell>
                                   {(() => {
                                     const pagoAcum = cobranca.valor_pago_acumulado || 0;
                                     const adiantado = cobranca.valor_adiantado || 0;
                                     const previsto = cobranca.valor_previsto || 0;
                                     if (cobranca.status === 'pago' && pagoAcum === 0) return formatarValor(previsto);
                                     const pago = Math.min(pagoAcum + adiantado, previsto);
                                     if (pago > 0) return formatarValor(pago);
                                     return '-';
                                   })()}
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    const status = cobranca.status;
                                    if (status === 'pago') return formatarValor(0);
                                    if (status === 'parcial') {
                                      const saldo =
                                        cobranca.valor_previsto -
                                        (cobranca.valor_pago_acumulado || 0) -
                                        (cobranca.valor_adiantado || 0);
                                      return formatarValor(Math.max(0, saldo));
                                    }
                                    return (
                                      <span className="text-muted-foreground italic text-xs">
                                        Apuração pendente
                                      </span>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell>{formatDateBR(cobranca.data_agendada)}</TableCell>
                                <TableCell>
                                  {(() => {
                                    const smart = getSmartStatus(cobranca);
                                    return (
                                      <Badge className={`${smart.color} border-0 whitespace-nowrap`}>
                                        {smart.label}
                                      </Badge>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell
                                  className="text-right"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex items-center justify-end gap-1">
                                    {['pendente', 'parcial'].includes(cobranca.status as string) && (
                                      <>
                                        <Button
                                          size="sm"
                                          onClick={() => setCobrancaParaPagar(cobranca)}
                                          className="h-8"
                                        >
                                          <CreditCard className="h-3.5 w-3.5 mr-1" />
                                          Cobrar
                                        </Button>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                                              <MoreVertical className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuItem onClick={() => handleReagendarClick(cobranca)}>
                                              <CalendarIcon className="h-4 w-4 mr-2" />
                                              Reagendar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleOpenAdiantamento(cobranca)}>
                                              <Wallet className="h-4 w-4 mr-2" />
                                              Adiantamento
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              disabled={!cobranca.kit_entregue_id}
                                              onClick={() => handleOpenAcrescimo(cobranca)}
                                            >
                                              <Package className="h-4 w-4 mr-2" />
                                              Encomendas
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              onClick={() => setCobrancaParaJuridico(cobranca)}
                                              className="text-purple-700 focus:text-purple-700 focus:bg-purple-500/10"
                                            >
                                              <Scale className="h-4 w-4 mr-2" />
                                              Jurídico
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Receber Cobrança */}
      <ModalReceberCobranca
        open={!!cobrancaParaPagar}
        onOpenChange={(open) => {
          if (!open) setCobrancaParaPagar(null);
        }}
        cobranca={
          cobrancaParaPagar || {
            id: '',
            revendedora: '',
            valor_previsto: 0,
            tipo: null,
            status: null,
          }
        }
        valor_pago_acumulado={(cobrancaParaPagar as any)?.valor_pago_acumulado || 0}
        diasNaoFinalizados={diasNaoFinalizados}
        onPagamentoCompleto={async (dados) => {
          if (cobrancaParaPagar) await handlePagamentoCompleto(cobrancaParaPagar.id, dados);
        }}
        onPagamentoParcial={async (dados) => {
          if (cobrancaParaPagar) await handlePagamentoParcial(cobrancaParaPagar.id, dados);
        }}
      />

      {/* Modal de Reagendar */}
      <Dialog open={modalReagendarOpen} onOpenChange={setModalReagendarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar Cobrança</DialogTitle>
          </DialogHeader>
          {cobrancaParaReagendar && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm">
                  <strong>Revendedora:</strong> {cobrancaParaReagendar.revendedora}
                </p>
                <p className="text-sm">
                  <strong>Valor:</strong> {formatarValor(cobrancaParaReagendar.valor_previsto)}
                </p>
                <p className="text-sm">
                  <strong>Data Atual:</strong> {formatDateBR(cobrancaParaReagendar.data_agendada)}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Nova Data de Vencimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !novaDataAgendada && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {novaDataAgendada ? (
                        format(novaDataAgendada, 'dd/MM/yyyy', { locale: ptBR })
                      ) : (
                        <span>Selecione uma data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={novaDataAgendada}
                      onSelect={setNovaDataAgendada}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setModalReagendarOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmarReagendamento}
                  disabled={!novaDataAgendada || reagendarMutation.isPending}
                >
                  Salvar Nova Data
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhamento */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalhamento da Nota {detailCobranca?.codigo_nota || ''}
            </DialogTitle>
          </DialogHeader>
          {detailCobranca && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Revendedora</span>
                  <p className="font-medium">{detailCobranca.revendedora}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Data Vencimento</span>
                  <p className="font-medium">{formatDateBR(detailCobranca.data_agendada)}</p>
                </div>
                 <div>
                  <span className="text-muted-foreground">Valor Original do Kit</span>
                  <p className="font-semibold">
                    {formatarValor(detailCobranca.valor_kit_original && detailCobranca.valor_kit_original > 0 ? detailCobranca.valor_kit_original : detailCobranca.valor_previsto)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <div className="mt-0.5">
                    {(() => {
                      const smart = getSmartStatus(detailCobranca);
                      return <Badge className={`${smart.color} border-0`}>{smart.label}</Badge>;
                    })()}
                  </div>
                </div>
              </div>

              {loadingDetail ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2 py-4">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                  Carregando detalhes...
                </div>
              ) : (
                <>
                  {detailPrestacao && (
                    <div className="border border-border rounded-lg p-4 space-y-2">
                      <h3 className="text-sm font-semibold text-foreground">Prestação de Contas</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Comissão</span>
                          <p className="font-medium">
                            {detailPrestacao.comissao_percentual}% —{' '}
                            {formatarValor(detailPrestacao.comissao_valor)}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Vendido</span>
                          <p className="font-medium">
                            {formatarValor(detailPrestacao.total_venda)}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Valor Devido à Empresa</span>
                          <p className="font-semibold">
                            {formatarValor(detailPrestacao.valor_devido_empresa)}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Forma de Pagamento</span>
                          <p className="font-medium capitalize">
                            {detailPrestacao.forma_pagamento}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {detailNotas.length > 0 && (
                    <div className="border border-border rounded-lg p-4 space-y-2">
                      <h3 className="text-sm font-semibold text-foreground">Histórico de Pagamentos</h3>
                      <div className="divide-y divide-border">
                        {detailNotas.map((nota: any) => (
                          <div key={nota.id} className="flex flex-col py-2 text-sm">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-mono text-xs text-muted-foreground mr-2">
                                  {nota.codigo_nota}
                                </span>
                                <span>{formatDateBR(nota.data)}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="capitalize text-xs text-muted-foreground">
                                  {nota.forma_pagamento_1}
                                </span>
                                <span className="font-semibold">
                                  {formatarValor(nota.valor_pagamento_1)}
                                </span>
                              </div>
                            </div>
                            {nota.forma_pagamento_2 && nota.valor_pagamento_2 && (
                              <div className="flex items-center justify-between mt-1 pl-2">
                                <span className="text-xs text-muted-foreground">
                                  + segundo pagamento
                                </span>
                                <div className="flex items-center gap-3">
                                  <span className="capitalize text-xs text-muted-foreground">
                                    {nota.forma_pagamento_2}
                                  </span>
                                  <span className="font-semibold">
                                    {formatarValor(nota.valor_pagamento_2)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border border-border rounded-lg p-4 space-y-2 bg-muted/30">
                    <h3 className="text-sm font-semibold text-foreground">Resumo Financeiro</h3>
                    {(() => {
                      // Fonte de verdade para recebimento: pagamentos_historico.
                      const adiantado = Number(detailCobranca.valor_adiantado || 0);
                      const pagoHistorico = detailPagamentosHistorico.reduce(
                        (total, pagamento) => total + Number(pagamento.valor || 0),
                        0
                      );
                      const pagoPrestacao = detailPrestacao
                        ? Number(detailPrestacao.valor_pago || 0)
                        : null;
                      const pagoAcumulado = Number(detailCobranca.valor_pago_acumulado || 0);
                      const isPago = (detailCobranca as any).status === 'pago';
                      const fallbackPago = isPago ? Number(detailCobranca.valor_previsto || 0) : 0;
                      const pagoBase = pagoHistorico > 0
                        ? pagoHistorico
                        : (pagoAcumulado > 0
                            ? pagoAcumulado
                            : (pagoPrestacao && pagoPrestacao > 0 ? pagoPrestacao : fallbackPago));
                      const totalRecebido = pagoBase + adiantado;

                      const baseDevida = detailPrestacao
                        ? Number(detailPrestacao.valor_devido_empresa || 0)
                        : Number(detailCobranca.valor_previsto || 0);
                      const saldoCalc = Math.max(0, baseDevida - pagoBase - adiantado);

                      return (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Total Recebido</span>
                            <p className="font-semibold text-green-700">
                              {formatarValor(totalRecebido)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Saldo Restante</span>
                            <p className="font-semibold">
                              {detailCobranca.status === 'pago' ? (
                                formatarValor(0)
                              ) : detailPrestacao || detailCobranca.status === 'parcial' ? (
                                formatarValor(saldoCalc)
                              ) : (
                                <span className="text-muted-foreground italic font-normal">
                                  Apuração pendente
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Adiantamento */}
      <Dialog
        open={modalAdiantamentoOpen}
        onOpenChange={(open) => {
          setModalAdiantamentoOpen(open);
          if (!open) {
            setCobrancaParaAdiantar(null);
            setValorAdiantamento('');
            setObsAdiantamento('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Adiantamento</DialogTitle>
          </DialogHeader>
          {cobrancaParaAdiantar && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                <p><strong>Revendedora:</strong> {cobrancaParaAdiantar.revendedora}</p>
                <p><strong>Código:</strong> {cobrancaParaAdiantar.codigo_nota || '—'}</p>
                <p><strong>Valor previsto:</strong> {formatarValor(cobrancaParaAdiantar.valor_previsto)}</p>
                {(cobrancaParaAdiantar.valor_adiantado || 0) > 0 && (
                  <p>
                    <strong>Já adiantado:</strong>{' '}
                    {formatarValor(cobrancaParaAdiantar.valor_adiantado || 0)}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Valor do Adiantamento (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valorAdiantamento}
                  onChange={(e) => setValorAdiantamento(e.target.value.replace(/[^\d,.]/g, ''))}
                />
              </div>
              <div className="space-y-2">
                <Label>Observação (opcional)</Label>
                <Textarea
                  placeholder="Ex.: pagamento parcial recebido em mãos"
                  value={obsAdiantamento}
                  onChange={(e) => setObsAdiantamento(e.target.value)}
                  rows={2}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setModalAdiantamentoOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => adiantamentoMutation.mutate()}
                  disabled={adiantamentoMutation.isPending || !valorAdiantamento}
                >
                  Registrar Adiantamento
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Encomendas / Acréscimo */}
      {cobrancaParaAcrescimo && cobrancaParaAcrescimo.kit_entregue_id && (
        <ModalRegistrarAcrescimo
          open={modalAcrescimoOpen}
          onOpenChange={(open) => {
            setModalAcrescimoOpen(open);
            if (!open) setCobrancaParaAcrescimo(null);
          }}
          kitEntregueId={cobrancaParaAcrescimo.kit_entregue_id}
          revendedora={cobrancaParaAcrescimo.revendedora}
          codigoKit={cobrancaParaAcrescimo.codigo_nota || ''}
        />
      )}

      {/* Confirmação Jurídico */}
      <AlertDialog
        open={!!cobrancaParaJuridico}
        onOpenChange={(open) => !open && setCobrancaParaJuridico(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encaminhar para o jurídico?</AlertDialogTitle>
            <AlertDialogDescription>
              A nota de <strong>{cobrancaParaJuridico?.revendedora}</strong>{' '}
              ({cobrancaParaJuridico?.codigo_nota || 's/cód.'}) será marcada como{' '}
              <strong>Jurídico</strong> e sairá da agenda ativa de cobrança.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cobrancaParaJuridico && juridicoMutation.mutate(cobrancaParaJuridico.id)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Encaminhar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
