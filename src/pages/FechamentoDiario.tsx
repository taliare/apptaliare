import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CalendarIcon, CheckCircle2, XCircle, DollarSign, Receipt, CreditCard, Banknote, Wallet, RefreshCw, Lock, Package, TrendingUp, TrendingDown, Minus, MessageSquare, CalendarRange, Plus, Trash2, Eye, Search, AlertTriangle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { registrarLog } from '@/lib/logOperacional';
import { useAuth } from '@/contexts/AuthContext';
import { cn, formatarValor, getLocalDateString } from '@/lib/utils';
import { FechamentoPeriodoView } from '@/components/fechamento/FechamentoPeriodoView';
import { RevendedoraSearchSelect } from '@/components/RevendedoraSearchSelect';
import { ModalReceberCobranca } from '@/components/cobranca/ModalReceberCobranca';
import { sanitizeString } from '@/lib/validations';
import type { Database } from '@/integrations/supabase/types';

type Cobranca = Database['public']['Tables']['cobrancas_agendadas']['Row'];
type FormaPagamento = 'pix' | 'dinheiro' | 'cartao' | 'transferencia';

interface Profile {
  id: string;
  nome: string;
  ativo: boolean | null;
}

interface NotaPromissoria {
  id: string;
  codigo_nota: string;
  data: string;
  valor_total: number;
  forma_pagamento_1: 'pix' | 'dinheiro' | 'cartao' | 'transferencia';
  valor_pagamento_1: number;
  forma_pagamento_2?: 'pix' | 'dinheiro' | 'cartao' | 'transferencia' | null;
  valor_pagamento_2?: number | null;
  devolveu_tudo?: boolean;
  cobranca_id?: string | null;
}

interface CobrancaDiaria {
  id: string;
  data: string;
  total_cobrado: number;
  total_pix: number | null;
  total_dinheiro: number | null;
  total_cartao: number | null;
  despesa_cobranca: number | null;
  finalizado: boolean | null;
  representante_id: string;
  observacoes: string | null;
}

interface KitEntregue {
  id: string;
  codigo_mostruario: string;
  data_entrega: string;
  data_vencimento: string;
  tipo: string | null;
}

interface CobrancaAgendadaKit {
  codigo_nota: string | null;
  revendedora: string;
  valor_previsto: number;
  tipo: string | null;
}

const formaPagamentoLabels: Record<string, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  transferencia: 'Transferência'
};

export default function FechamentoDiario() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const [selectedRepresentante, setSelectedRepresentante] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [despesaCobranca, setDespesaCobranca] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Estados do modo período
  const [modoPeriodo, setModoPeriodo] = useState(false);
  const [periodoInicio, setPeriodoInicio] = useState(getLocalDateString(startOfMonth(new Date())));
  const [periodoFim, setPeriodoFim] = useState(getLocalDateString(endOfMonth(new Date())));

  // Estado para modal "Adicionar Nota" (buscar na agenda)
  const [buscarNotaOpen, setBuscarNotaOpen] = useState(false);
  const [codigoBusca, setCodigoBusca] = useState('');
  const [buscandoNota, setBuscandoNota] = useState(false);
  const [notaEncontrada, setNotaEncontrada] = useState<Cobranca | null>(null);
  const [erroNota, setErroNota] = useState<string | null>(null);
  const [cobrancaParaPagar, setCobrancaParaPagar] = useState<Cobranca | null>(null);

  // Estado para deletar nota
  const [notaParaDeletar, setNotaParaDeletar] = useState<NotaPromissoria | null>(null);

  // Estado para edição de despesa quando finalizado
  const [editandoDespesa, setEditandoDespesa] = useState(false);
  const [despesaEditValue, setDespesaEditValue] = useState('');

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Query para buscar representantes ativos
  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes-ativos-fechamento'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, nome, ativo')
        .eq('ativo', true);

      if (error) throw error;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'representante');

      if (rolesError) throw rolesError;

      const representanteIds = new Set(roles?.map(r => r.user_id) || []);
      return (profiles || []).filter(p => representanteIds.has(p.id)) as Profile[];
    },
  });

  // Query para resumo do dia (todos os representantes) - quando nenhum rep selecionado
  const { data: resumoDia = [] } = useQuery({
    queryKey: ['resumo-dia-todos', dateStr],
    queryFn: async () => {
      // Buscar cobranças diárias de todos os representantes nesse dia
      const { data: cobrancas, error } = await supabase
        .from('cobrancas_diarias')
        .select('*')
        .eq('data', dateStr);
      if (error) throw error;

      // Buscar notas de todos os representantes nesse dia (com valor)
      const { data: todasNotas, error: notasError } = await supabase
        .from('notas_promissorias')
        .select('representante_id, valor_total')
        .eq('data', dateStr);
      if (notasError) throw notasError;

      // Contar notas e somar valores por representante
      const notasCount: Record<string, number> = {};
      const notasTotal: Record<string, number> = {};
      (todasNotas || []).forEach(n => {
        notasCount[n.representante_id] = (notasCount[n.representante_id] || 0) + 1;
        notasTotal[n.representante_id] = (notasTotal[n.representante_id] || 0) + (n.valor_total || 0);
      });

      // Mapear cobranças por representante
      const cobrancaMap: Record<string, CobrancaDiaria> = {};
      (cobrancas || []).forEach(c => {
        cobrancaMap[c.representante_id] = c as CobrancaDiaria;
      });

      return representantes.map(rep => {
        const cob = cobrancaMap[rep.id];
        return {
          id: rep.id,
          nome: rep.nome,
          totalCobrado: notasTotal[rep.id] || cob?.total_cobrado || 0,
          qtdNotas: notasCount[rep.id] || 0,
          finalizado: cob?.finalizado || false,
          temRegistro: !!cob || (notasCount[rep.id] || 0) > 0,
        };
      });
    },
    enabled: !selectedRepresentante && !modoPeriodo && representantes.length > 0,
  });

  // Query para notas do representante selecionado na data selecionada
  const { data: notas = [], isLoading: loadingNotas } = useQuery({
    queryKey: ['notas-representante-fechamento', selectedRepresentante, dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_promissorias')
        .select('*')
        .eq('representante_id', selectedRepresentante)
        .eq('data', dateStr)
        .order('criado_em', { ascending: false });

      if (error) throw error;
      return data as NotaPromissoria[];
    },
    enabled: !!selectedRepresentante,
  });

  // Query para cobrança diária do representante
  const { data: cobrancaDiaria, isLoading: loadingCobranca } = useQuery({
    queryKey: ['cobranca-diaria-fechamento', selectedRepresentante, dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('*')
        .eq('representante_id', selectedRepresentante)
        .eq('data', dateStr)
        .maybeSingle();

      if (error) throw error;
      return data as CobrancaDiaria | null;
    },
    enabled: !!selectedRepresentante,
  });

  // Query para buscar revendedoras das cobranças agendadas (lookup por codigo_nota)
  const { data: cobrancasAgendadas = [] } = useQuery({
    queryKey: ['cobrancas-agendadas-lookup-fechamento', selectedRepresentante],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('id, codigo_nota, revendedora, tipo, apurado, status, valor_previsto, valor_pago_acumulado, valor_adiantado')
        .eq('representante_id', selectedRepresentante)
        .eq('vigente', true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedRepresentante,
  });

  // Query para kits entregues do representante na data
  const { data: kitsEntreguesDoDia = [] } = useQuery({
    queryKey: ['kits-entregues-admin', selectedRepresentante, dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kits_entregues')
        .select('*')
        .eq('representante_id', selectedRepresentante)
        .eq('data_entrega', dateStr)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      return data as KitEntregue[];
    },
    enabled: !!selectedRepresentante,
  });

  // Query para buscar detalhes dos kits (revendedora + valor)
  const codigosKitsDoDia = useMemo(() => 
    kitsEntreguesDoDia.map(k => k.codigo_mostruario), 
    [kitsEntreguesDoDia]
  );

  const { data: detalhesKitsCobrancas = [] } = useQuery({
    queryKey: ['detalhes-kits-cobrancas-admin', codigosKitsDoDia, selectedRepresentante],
    queryFn: async () => {
      if (codigosKitsDoDia.length === 0) return [];
      
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('codigo_nota, revendedora, valor_previsto, tipo')
        .eq('representante_id', selectedRepresentante)
        .eq('vigente', true)
        .eq('tipo', 'kit')
        .in('codigo_nota', codigosKitsDoDia);
      
      if (error) throw error;
      return data as CobrancaAgendadaKit[];
    },
    enabled: codigosKitsDoDia.length > 0 && !!selectedRepresentante,
  });

  // Mapa para detalhes dos kits
  const kitsDetalhesMap = useMemo(() => {
    return detalhesKitsCobrancas.reduce((acc, item) => {
      if (item.codigo_nota) {
        acc[item.codigo_nota] = {
          revendedora: item.revendedora,
          valor: item.valor_previsto
        };
      }
      return acc;
    }, {} as Record<string, { revendedora: string; valor: number }>);
  }, [detalhesKitsCobrancas]);

  // Criar mapa de codigo_nota -> revendedora
  const revendedoraMap = cobrancasAgendadas.reduce((acc, item) => {
    if (item.codigo_nota) {
      acc[item.codigo_nota] = item.revendedora;
    }
    return acc;
  }, {} as Record<string, string>);

  // Criar mapa de cobranca_id -> { codigo_nota, revendedora, status } para lookup reverso
  const cobrancaIdMap = cobrancasAgendadas.reduce((acc, item) => {
    if (item.id) {
      acc[item.id] = { 
        codigo_nota: item.codigo_nota || '', 
        revendedora: item.revendedora, 
        tipo: item.tipo || '',
        status: item.status || '',
        valor_previsto: Number(item.valor_previsto) || 0,
        valor_pago_acumulado: Number(item.valor_pago_acumulado) || 0,
        valor_adiantado: Number(item.valor_adiantado) || 0,
      };
    }
    return acc;
  }, {} as Record<string, { codigo_nota: string; revendedora: string; tipo: string; status: string; valor_previsto: number; valor_pago_acumulado: number; valor_adiantado: number }>);

  // Cálculos baseados nas notas
  const totais = useMemo(() => {
    const pix = notas.reduce((sum, nota) => {
      let total = 0;
      if (nota.forma_pagamento_1 === 'pix') total += nota.valor_pagamento_1;
      if (nota.forma_pagamento_2 === 'pix') total += nota.valor_pagamento_2 || 0;
      return sum + total;
    }, 0);

    const dinheiro = notas.reduce((sum, nota) => {
      let total = 0;
      if (nota.forma_pagamento_1 === 'dinheiro') total += nota.valor_pagamento_1;
      if (nota.forma_pagamento_2 === 'dinheiro') total += nota.valor_pagamento_2 || 0;
      return sum + total;
    }, 0);

    const cartao = notas.reduce((sum, nota) => {
      let total = 0;
      if (nota.forma_pagamento_1 === 'cartao') total += nota.valor_pagamento_1;
      if (nota.forma_pagamento_2 === 'cartao') total += nota.valor_pagamento_2 || 0;
      return sum + total;
    }, 0);

    const transferencia = notas.reduce((sum, nota) => {
      let total = 0;
      if (nota.forma_pagamento_1 === 'transferencia') total += nota.valor_pagamento_1;
      if (nota.forma_pagamento_2 === 'transferencia') total += nota.valor_pagamento_2 || 0;
      return sum + total;
    }, 0);

    return {
      pix,
      dinheiro,
      cartao,
      transferencia,
      total: pix + dinheiro + cartao + transferencia,
    };
  }, [notas]);

  // Total de kits entregues
  const totalKits = useMemo(() => {
    return kitsEntreguesDoDia.reduce((sum, kit) => {
      const detalhe = kitsDetalhesMap[kit.codigo_mostruario];
      return sum + (detalhe?.valor || 0);
    }, 0);
  }, [kitsEntreguesDoDia, kitsDetalhesMap]);

  const parseValor = (valor: string): number => {
    const numeros = valor.replace(/\D/g, '');
    if (!numeros) return 0;
    return parseFloat(numeros) / 100;
  };

  const formatarValorInput = (valor: string): string => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (!apenasNumeros) return '';
    const numero = parseFloat(apenasNumeros) / 100;
    return numero.toFixed(2);
  };

  // Valor da despesa (do registro ou do input)
  const despesaValor = useMemo(() => {
    if (cobrancaDiaria?.finalizado && !editandoDespesa) {
      return cobrancaDiaria.despesa_cobranca || 0;
    }
    if (editandoDespesa) {
      return parseValor(despesaEditValue);
    }
    return parseValor(despesaCobranca);
  }, [cobrancaDiaria, despesaCobranca, editandoDespesa, despesaEditValue]);

  // Saldo do dia
  const saldoDoDia = totais.total - despesaValor;

  // Mutation para finalizar dia pelo representante
  const finalizarDiaMutation = useMutation({
    mutationFn: async () => {
      const despesa = parseValor(despesaCobranca);

      if (cobrancaDiaria) {
        const { error } = await supabase
          .from('cobrancas_diarias')
          .update({
            total_cobrado: totais.total,
            total_pix: totais.pix,
            total_dinheiro: totais.dinheiro,
            total_cartao: totais.cartao + totais.transferencia,
            despesa_cobranca: despesa,
            finalizado: true,
          })
          .eq('id', cobrancaDiaria.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cobrancas_diarias')
          .insert({
            representante_id: selectedRepresentante,
            data: dateStr,
            total_cobrado: totais.total,
            total_pix: totais.pix,
            total_dinheiro: totais.dinheiro,
            total_cartao: totais.cartao + totais.transferencia,
            despesa_cobranca: despesa,
            finalizado: true,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobranca-diaria-fechamento'] });
      queryClient.invalidateQueries({ queryKey: ['resumo-dia-todos'] });
      toast.success('Dia finalizado com sucesso pelo admin!');
      const repNome = representantes.find(r => r.id === selectedRepresentante)?.nome || '';
      registrarLog({
        tipo_acao: 'CONFERENCIA_INTERNA',
        descricao: `Conferência interna finalizada para ${repNome} no dia ${dateStr}`,
        user: { id: user!.id, nome: profile?.nome || '', papel: profile?.role || 'admin' },
      });
      setDespesaCobranca('');
    },
    onError: (error: any) => {
      toast.error(`Erro ao finalizar dia: ${error.message}`);
    },
  });

  // Mutation para reabrir dia
  const reabrirDiaMutation = useMutation({
    mutationFn: async () => {
      if (!cobrancaDiaria) throw new Error('Nenhuma cobrança para reabrir');

      const { error } = await supabase
        .from('cobrancas_diarias')
        .update({ finalizado: false })
        .eq('id', cobrancaDiaria.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobranca-diaria-fechamento'] });
      queryClient.invalidateQueries({ queryKey: ['resumo-dia-todos'] });
      toast.success('Dia reaberto com sucesso!');
      const repNome = representantes.find(r => r.id === selectedRepresentante)?.nome || '';
      registrarLog({
        tipo_acao: 'REABERTURA_PEDIDO',
        descricao: `Dia ${dateStr} reaberto para ${repNome}`,
        user: { id: user!.id, nome: profile?.nome || '', papel: profile?.role || 'admin' },
      });
    },
    onError: (error: any) => {
      toast.error(`Erro ao reabrir dia: ${error.message}`);
    },
  });

  // Mutation para excluir nota promissória
  const excluirNotaMutation = useMutation({
    mutationFn: async (notaId: string) => {
      const { error } = await supabase
        .from('notas_promissorias')
        .delete()
        .eq('id', notaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-representante-fechamento'] });
      queryClient.invalidateQueries({ queryKey: ['cobranca-diaria-fechamento'] });
      queryClient.invalidateQueries({ queryKey: ['resumo-dia-todos'] });
      toast.success('Nota excluída com sucesso');
      setNotaParaDeletar(null);
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir nota: ${error.message}`);
    },
  });

  // Mutation para atualizar despesa quando dia finalizado
  const atualizarDespesaMutation = useMutation({
    mutationFn: async (novaDespesa: number) => {
      if (!cobrancaDiaria) throw new Error('Registro não encontrado');
      const { error } = await supabase
        .from('cobrancas_diarias')
        .update({ despesa_cobranca: novaDespesa })
        .eq('id', cobrancaDiaria.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobranca-diaria-fechamento'] });
      toast.success('Despesa atualizada');
      setEditandoDespesa(false);
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
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
        .eq('vigente', true)
        .ilike('codigo_nota', `%${codigoBusca.trim()}%`)
        .in('status', ['pendente', 'parcial'])
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
        .eq('vigente', true)
        .ilike('revendedora', `%${codigoBusca.trim()}%`)
        .in('status', ['pendente', 'parcial'])
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

  // Handler de pagamento completo
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
          forma_pagamento: dados.tipo === 'devolucao' ? 'dinheiro' : (dados.pagamentos[0]?.forma || 'dinheiro'),
          data_execucao: dados.dataNota,
          codigo_nota_referencia: codigoNota,
        });
      if (prestacaoError) throw prestacaoError;

      // Buscar status atual da cobrança para snapshot fiel no fechamento
      const { data: cobAtualSnap } = await supabase
        .from('cobrancas_agendadas')
        .select('status')
        .eq('id', cobranca.id)
        .maybeSingle();

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
          status_no_pagamento: cobAtualSnap?.status ?? null,
        });
      if (notaError) throw notaError;

      const acumuladoAtual = cobranca.valor_pago_acumulado || 0;
      const valorAdiantado = cobranca.valor_adiantado || 0;
      const novoAcumulado = acumuladoAtual + dados.valor_devido_empresa;

      let valorPrevistoEfetivoCompleto = cobranca.valor_previsto || 0;
      const updateDataCompleto: any = { valor_pago_acumulado: novoAcumulado };

      if (dados.tipo === 'devolucao') {
        updateDataCompleto.valor_previsto = 0;
        valorPrevistoEfetivoCompleto = 0;
      } else if (acumuladoAtual === 0 && cobranca.tipo?.toLowerCase() !== 'repasse') {
        valorPrevistoEfetivoCompleto = dados.valor_devido_empresa + valorAdiantado;
        updateDataCompleto.valor_previsto = valorPrevistoEfetivoCompleto;
      } else if (acumuladoAtual > 0 && cobranca.tipo?.toLowerCase() !== 'repasse') {
        const saldoAnterior = (cobranca.valor_previsto || 0) - acumuladoAtual - valorAdiantado;
        if (dados.valor_devido_empresa < saldoAnterior) {
          valorPrevistoEfetivoCompleto = novoAcumulado + valorAdiantado;
          updateDataCompleto.valor_previsto = valorPrevistoEfetivoCompleto;
        }
      }

      const saldoAberto = valorPrevistoEfetivoCompleto - novoAcumulado - valorAdiantado;

      // Kit sem prestação de contas prévia = precisa de apuração física
      // Adiantamento NÃO conta como prestação de contas
      const { data: prestacaoExistenteCompleto } = await supabase
        .from('prestacoes_contas')
        .select('id')
        .eq('cobranca_id', cobranca.id)
        .maybeSingle();

      const isKitCompleto = cobranca.tipo?.toLowerCase() === 'kit';
      const temPrestacaoAnteriorCompleto = !!prestacaoExistenteCompleto;

      updateDataCompleto.status = (saldoAberto <= 0 ? 'pago' : 'parcial') as any;
      updateDataCompleto.data_quitacao = saldoAberto <= 0 ? dados.dataNota : null;
      updateDataCompleto.apurado = isKitCompleto ? temPrestacaoAnteriorCompleto : true;

      const { error: updateError } = await supabase
        .from('cobrancas_agendadas')
        .update(updateDataCompleto)
        .eq('id', cobranca.id);
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['notas-representante-fechamento'] });
      queryClient.invalidateQueries({ queryKey: ['cobranca-diaria-fechamento'] });
      queryClient.invalidateQueries({ queryKey: ['resumo-dia-todos'] });
      toast.success('Nota registrada com sucesso pelo admin');
      setCobrancaParaPagar(null);
      setBuscarNotaOpen(false);
      setCodigoBusca('');
      setNotaEncontrada(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Handler de pagamento parcial
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
      // Buscar status atual da cobrança para snapshot fiel no fechamento
      const { data: cobAtualSnap } = await supabase
        .from('cobrancas_agendadas')
        .select('status')
        .eq('id', cobranca.id)
        .maybeSingle();

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
          status_no_pagamento: cobAtualSnap?.status ?? null,
        });
      if (notaError) throw notaError;

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

      const acumuladoAtual = cobranca.valor_pago_acumulado || 0;
      const valorAdiantado = cobranca.valor_adiantado || 0;
      let valorPrevistoEfetivo = cobranca.valor_previsto || 0;

      const updateData: any = {
        valor_pago_acumulado: acumuladoAtual + dados.valor_recebido,
        data_agendada: format(dados.data_repasse, 'yyyy-MM-dd'),
      };

      if (acumuladoAtual === 0 && cobranca.tipo?.toLowerCase() !== 'repasse') {
        valorPrevistoEfetivo = dados.valor_devido_empresa + valorAdiantado;
        updateData.valor_previsto = valorPrevistoEfetivo;
      }

      const novoAcumulado = acumuladoAtual + dados.valor_recebido;
      const saldoAberto = valorPrevistoEfetivo - novoAcumulado - valorAdiantado;
      updateData.status = saldoAberto <= 0 ? 'pago' : 'parcial';
      if (saldoAberto <= 0) updateData.data_quitacao = dados.dataNota;

      // Kit sem prestação de contas prévia = precisa de apuração física
      // Adiantamento NÃO conta como prestação de contas
      const { data: prestacaoExistenteParcial } = await supabase
        .from('prestacoes_contas')
        .select('id')
        .eq('cobranca_id', cobranca.id)
        .maybeSingle();

      const isKitParcial = cobranca.tipo?.toLowerCase() === 'kit';
      const temPrestacaoAnteriorParcial = !!prestacaoExistenteParcial;

      updateData.apurado = isKitParcial ? temPrestacaoAnteriorParcial : true;

      const { error: updateError } = await supabase
        .from('cobrancas_agendadas')
        .update(updateData)
        .eq('id', cobranca.id);
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['notas-representante-fechamento'] });
      queryClient.invalidateQueries({ queryKey: ['cobranca-diaria-fechamento'] });
      queryClient.invalidateQueries({ queryKey: ['resumo-dia-todos'] });
      toast.success('Pagamento parcial registrado pelo admin');
      setCobrancaParaPagar(null);
      setBuscarNotaOpen(false);
      setCodigoBusca('');
      setNotaEncontrada(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const isDiaFinalizado = cobrancaDiaria?.finalizado === true;
  const representanteSelecionado = representantes.find(r => r.id === selectedRepresentante);

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
            Fechamento Diário
          </h1>
          <p className="text-sm text-muted-foreground">
            Visualize e gerencie o fechamento diário dos representantes
          </p>
        </div>

        {/* Toggle Dia Único / Período */}
        <div className="flex gap-2">
          <Button
            variant={!modoPeriodo ? 'default' : 'outline'}
            size="sm"
            onClick={() => setModoPeriodo(false)}
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            Dia único
          </Button>
          <Button
            variant={modoPeriodo ? 'default' : 'outline'}
            size="sm"
            onClick={() => setModoPeriodo(true)}
          >
            <CalendarRange className="h-4 w-4 mr-2" />
            Selecionar período
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedRepresentante} onValueChange={(val) => setSelectedRepresentante(val === '__clear__' ? '' : val)}>
            <SelectTrigger className="w-full sm:w-[280px]">
              <SelectValue placeholder={modoPeriodo ? "Todos os representantes" : "Selecione um representante"} />
            </SelectTrigger>
            <SelectContent>
              {modoPeriodo && (
                <SelectItem value="todos">Todos os representantes</SelectItem>
              )}
              {!modoPeriodo && selectedRepresentante && (
                <SelectItem value="__clear__">← Voltar ao resumo</SelectItem>
              )}
              {representantes.map((rep) => (
                <SelectItem key={rep.id} value={rep.id}>
                  {rep.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!modoPeriodo ? (
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-[200px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setIsCalendarOpen(false);
                    }
                  }}
                  locale={ptBR}
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">De:</Label>
                <Input
                  type="date"
                  value={periodoInicio}
                  onChange={(e) => setPeriodoInicio(e.target.value)}
                  className="h-9 w-full sm:w-[160px] text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Até:</Label>
                <Input
                  type="date"
                  value={periodoFim}
                  onChange={(e) => setPeriodoFim(e.target.value)}
                  className="h-9 w-full sm:w-[160px] text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modo Período */}
      {modoPeriodo ? (
        <FechamentoPeriodoView
          periodoInicio={periodoInicio}
          periodoFim={periodoFim}
          selectedRepresentante={selectedRepresentante === 'todos' ? '' : selectedRepresentante}
          representantes={representantes}
        />
      ) : !selectedRepresentante ? (
        /* ===== TABELA RESUMO DO DIA (sem representante selecionado) ===== */
        <div key="resumo-dia">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Receipt className="h-5 w-5" />
              Resumo do Dia — {format(selectedDate, "dd/MM/yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {representantes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Carregando representantes...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Representante</TableHead>
                      <TableHead className="text-right">Total Cobrado</TableHead>
                      <TableHead className="text-center">Notas</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumoDia.map((rep) => (
                      <TableRow key={rep.id}>
                        <TableCell className="font-medium">{rep.nome}</TableCell>
                        <TableCell className="text-right">
                          {rep.totalCobrado > 0 ? formatarValor(rep.totalCobrado) : '—'}
                        </TableCell>
                        <TableCell className="text-center">{rep.qtdNotas}</TableCell>
                        <TableCell className="text-center">
                          {rep.finalizado ? (
                            <Badge className="bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20">
                              <Lock className="h-3 w-3 mr-1" />
                              Finalizado
                            </Badge>
                          ) : rep.temRegistro ? (
                            <Badge variant="outline" className="border-yellow-500/50 text-yellow-600">
                              Em aberto
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Sem registro
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedRepresentante(rep.id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Totais do resumo */}
                <div className="mt-4 pt-3 border-t flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total geral: </span>
                    <span className="font-bold text-primary">
                      {formatarValor(resumoDia.reduce((s, r) => s + r.totalCobrado, 0))}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Finalizados: </span>
                    <span className="font-bold text-green-600">
                      {resumoDia.filter(r => r.finalizado).length}/{resumoDia.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total de notas: </span>
                    <span className="font-bold">
                      {resumoDia.reduce((s, r) => s + r.qtdNotas, 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      ) : (
        <div key="detalhes-rep">
          {/* Status do Dia */}
          <Card className={cn(
            "border-2",
            isDiaFinalizado 
              ? "border-green-500/50 bg-green-500/5" 
              : "border-yellow-500/50 bg-yellow-500/5"
          )}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isDiaFinalizado ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-yellow-500" />
                )}
                <div>
                  <p className="font-medium">
                    {representanteSelecionado?.nome} - {format(selectedDate, "dd/MM/yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isDiaFinalizado 
                      ? `Dia finalizado • Total: ${formatarValor(cobrancaDiaria?.total_cobrado || 0)}`
                      : `Dia em aberto • ${notas.length} nota(s) registrada(s)`
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isDiaFinalizado ? (
                  <Badge variant="default" className="bg-green-500">
                    <Lock className="h-3 w-3 mr-1" />
                    Finalizado
                  </Badge>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Card de Observações do Representante */}
          {cobrancaDiaria?.observacoes && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Observação do Representante
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm bg-background/80 p-3 rounded-lg whitespace-pre-wrap">
                  {cobrancaDiaria.observacoes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Cards de Totais de Cobrança */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Totais de Cobrança</h2>
            <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
                  <CardTitle className="text-xs md:text-sm font-medium">PIX</CardTitle>
                  <div className="p-1.5 rounded-lg bg-blue-500/10">
                    <Wallet className="h-4 w-4 text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent className="p-3 md:p-4 pt-0">
                  <div className="text-lg md:text-xl font-bold">{formatarValor(totais.pix)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
                  <CardTitle className="text-xs md:text-sm font-medium">Dinheiro</CardTitle>
                  <div className="p-1.5 rounded-lg bg-green-500/10">
                    <Banknote className="h-4 w-4 text-green-500" />
                  </div>
                </CardHeader>
                <CardContent className="p-3 md:p-4 pt-0">
                  <div className="text-lg md:text-xl font-bold">{formatarValor(totais.dinheiro)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
                  <CardTitle className="text-xs md:text-sm font-medium">Cartão/Transf.</CardTitle>
                  <div className="p-1.5 rounded-lg bg-purple-500/10">
                    <CreditCard className="h-4 w-4 text-purple-500" />
                  </div>
                </CardHeader>
                <CardContent className="p-3 md:p-4 pt-0">
                  <div className="text-lg md:text-xl font-bold">{formatarValor(totais.cartao + totais.transferencia)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
                  <CardTitle className="text-xs md:text-sm font-medium">Total Cobrado</CardTitle>
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="p-3 md:p-4 pt-0">
                  <div className="text-lg md:text-xl font-bold text-primary">{formatarValor(totais.total)}</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Resumo do Dia: Despesas, Kits e Saldo */}
          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
            {/* Despesas - EDITÁVEL para admin mesmo finalizado */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
                <CardTitle className="text-xs md:text-sm font-medium">Despesas do Dia</CardTitle>
                <div className="p-1.5 rounded-lg bg-red-500/10">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0">
                {isDiaFinalizado && !editandoDespesa ? (
                  <div className="space-y-2">
                    <div className="text-lg md:text-xl font-bold text-red-500">
                      - {formatarValor(cobrancaDiaria?.despesa_cobranca || 0)}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setDespesaEditValue(((cobrancaDiaria?.despesa_cobranca || 0) * 100).toFixed(0).replace(/(\d+)/, (m) => (parseFloat(m) / 100).toFixed(2)));
                        setEditandoDespesa(true);
                      }}
                    >
                      Editar despesa
                    </Button>
                  </div>
                ) : isDiaFinalizado && editandoDespesa ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="0.00"
                      value={despesaEditValue}
                      onChange={(e) => setDespesaEditValue(formatarValorInput(e.target.value))}
                      className="h-9"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => atualizarDespesaMutation.mutate(parseValor(despesaEditValue))}
                        disabled={atualizarDespesaMutation.isPending}
                      >
                        Salvar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditandoDespesa(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      placeholder="0.00"
                      value={despesaCobranca}
                      onChange={(e) => setDespesaCobranca(formatarValorInput(e.target.value))}
                      className="h-9"
                    />
                    <p className="text-xs text-muted-foreground">Informe as despesas do dia</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Entregas de Kits */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
                <CardTitle className="text-xs md:text-sm font-medium">Entregas de Kits</CardTitle>
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Package className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0">
                <div className="text-lg md:text-xl font-bold">{kitsEntreguesDoDia.length}</div>
                <p className="text-xs text-muted-foreground">
                  Total: {formatarValor(totalKits)}
                </p>
              </CardContent>
            </Card>

            {/* Saldo do Dia */}
            <Card className="border-2 border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
                <CardTitle className="text-xs md:text-sm font-medium">Saldo Líquido</CardTitle>
                <div className="p-1.5 rounded-lg bg-primary/10">
                  {saldoDoDia >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <Minus className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0">
                <div className={cn(
                  "text-lg md:text-xl font-bold",
                  saldoDoDia >= 0 ? "text-green-500" : "text-red-500"
                )}>
                  {formatarValor(saldoDoDia)}
                </div>
                <p className="text-xs text-muted-foreground">Cobrado - Despesas</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Entregas de Kits */}
          {kitsEntreguesDoDia.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Package className="h-5 w-5 text-primary" />
                  Entregas de Kits do Dia ({kitsEntreguesDoDia.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Revendedora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kitsEntreguesDoDia.map((kit) => {
                        const detalhe = kitsDetalhesMap[kit.codigo_mostruario];
                        return (
                          <TableRow key={kit.id}>
                            <TableCell className="font-mono">{kit.codigo_mostruario}</TableCell>
                            <TableCell>{detalhe?.revendedora || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {kit.tipo || 'renovação'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatarValor(detalhe?.valor || 0)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {kitsEntreguesDoDia.length} entrega(s)
                  </span>
                  <span className="font-bold text-primary">
                    {formatarValor(totalKits)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Card de Devoluções Esperadas */}
          {(() => {
            const devolucoesEsperadas = notas.filter(nota => {
              if (nota.devolveu_tudo) return true;
              if (nota.cobranca_id) {
                const cobranca = cobrancasAgendadas.find(c => c.id === nota.cobranca_id);
                if (cobranca && cobranca.tipo === 'kit' && !cobranca.apurado) return true;
              }
              return false;
            }).length;
            return devolucoesEsperadas > 0 ? (
              <Card className={cn("border-2", devolucoesEsperadas > 0 ? "border-red-500/50 bg-red-500/5" : "")}>
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <span className="font-medium text-red-600">
                    Devoluções esperadas hoje: {devolucoesEsperadas}
                  </span>
                </CardContent>
              </Card>
            ) : null;
          })()}

          {/* Tabela de Notas com botão Adicionar e coluna Ações */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Receipt className="h-5 w-5" />
                Notas do Dia ({notas.length})
              </CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setBuscarNotaOpen(true);
                  setCodigoBusca('');
                  setNotaEncontrada(null);
                  setErroNota(null);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Nota
              </Button>
            </CardHeader>
            <CardContent>
              {loadingNotas ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : notas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma nota registrada nesta data
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Revendedora</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notas.map((nota) => {
                        let revendedora: string | undefined;
                        let codigoPedido: string | undefined;
                        let cobrancaStatus: string | undefined;

                        if (nota.cobranca_id && cobrancaIdMap[nota.cobranca_id]) {
                          const mapped = cobrancaIdMap[nota.cobranca_id];
                          revendedora = mapped.revendedora;
                          codigoPedido = mapped.codigo_nota;
                          cobrancaStatus = mapped.status;
                        } else if (nota.codigo_nota?.startsWith('ADT-')) {
                          // Adiantamento sem cobranca_id vinculado
                          codigoPedido = undefined;
                          const match = nota.codigo_nota.match(/^ADT-(.+?)-\d{14}$/);
                          if (match) {
                            revendedora = match[1];
                          }
                        } else if (revendedoraMap[nota.codigo_nota]) {
                          revendedora = revendedoraMap[nota.codigo_nota];
                          codigoPedido = nota.codigo_nota;
                        } else if (nota.codigo_nota) {
                          const match = nota.codigo_nota.match(/^(.+?)-\d{14}$/);
                          if (match) {
                            revendedora = match[1];
                            codigoPedido = undefined;
                          } else {
                            codigoPedido = nota.codigo_nota;
                          }
                        }

                        // Remove prefixo ADT- do nome (tipo já indicado pelo badge)
                        if (revendedora?.startsWith('ADT-')) {
                          revendedora = revendedora.substring(4);
                        }

                        // Determinar badge de status
                        let statusBadge = <Badge variant="outline">—</Badge>;
                        if (cobrancaStatus) {
                          if (cobrancaStatus === 'pago') {
                            statusBadge = <Badge className="bg-success/15 text-success border border-success/30">Pago</Badge>;
                          } else if (cobrancaStatus === 'parcial') {
                            statusBadge = <Badge className="bg-warning/15 text-warning border border-warning/30">Parcial</Badge>;
                          } else if (cobrancaStatus === 'pendente') {
                            statusBadge = <Badge className="bg-destructive/15 text-destructive border border-destructive/30">Pendente</Badge>;
                          }
                        }

                        return (
                          <TableRow key={nota.id}>
                            <TableCell className="font-mono">{codigoPedido ? `Nota ${codigoPedido}` : '—'}</TableCell>
                            <TableCell>{revendedora || '-'}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatarValor(nota.valor_total)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5 text-xs">
                                <span>{formaPagamentoLabels[nota.forma_pagamento_1]}: {formatarValor(nota.valor_pagamento_1)}</span>
                                {nota.forma_pagamento_2 && nota.valor_pagamento_2 && (
                                  <span>{formaPagamentoLabels[nota.forma_pagamento_2]}: {formatarValor(nota.valor_pagamento_2)}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {statusBadge}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setNotaParaDeletar(nota)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Botões Finalizar/Reabrir */}
          <div className="flex flex-wrap gap-2">
            {!isDiaFinalizado ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={finalizarDiaMutation.isPending}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Finalizar Dia
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Fechamento</AlertDialogTitle>
                    <AlertDialogDescription>
                      Você está prestes a finalizar o dia {format(selectedDate, "dd/MM/yyyy")} para {representanteSelecionado?.nome}.
                      <br /><br />
                      <strong>Total Cobrado: {formatarValor(totais.total)}</strong>
                      {despesaCobranca && (
                        <>
                          <br />
                          Despesa: {formatarValor(parseValor(despesaCobranca))}
                        </>
                      )}
                      <br />
                      <strong>Entregas de Kits: {kitsEntreguesDoDia.length} ({formatarValor(totalKits)})</strong>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => finalizarDiaMutation.mutate()}>
                      Confirmar Fechamento
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={reabrirDiaMutation.isPending}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reabrir Dia
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reabrir Dia</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja reabrir o dia {format(selectedDate, "dd/MM/yyyy")} para {representanteSelecionado?.nome}?
                      Isso permitirá que novas notas sejam adicionadas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => reabrirDiaMutation.mutate()}>
                      Confirmar Reabertura
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      )}

      {/* Dialog Buscar Nota (Adicionar Nota) */}
      <Dialog open={buscarNotaOpen} onOpenChange={setBuscarNotaOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Nota — {representanteSelecionado?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Busque pela nota na agenda do representante por código ou nome da revendedora.
            </p>
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
                    <div className="text-right">
                      <span className="font-bold">
                        {formatarValor(Math.max(0, notaEncontrada.valor_previsto - (notaEncontrada.valor_pago_acumulado || 0) - (notaEncontrada.valor_adiantado || 0)))}
                      </span>
                      {(notaEncontrada.valor_pago_acumulado || 0) > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          Total: {formatarValor(notaEncontrada.valor_previsto)}
                        </span>
                      )}
                    </div>
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

      {/* Dialog Confirmar Exclusão de Nota */}
      <AlertDialog open={!!notaParaDeletar} onOpenChange={(open) => { if (!open) setNotaParaDeletar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Nota</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a nota <strong>{notaParaDeletar?.codigo_nota}</strong> no valor de <strong>{formatarValor(notaParaDeletar?.valor_total || 0)}</strong>?
              <br /><br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => notaParaDeletar && excluirNotaMutation.mutate(notaParaDeletar.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Receber Cobrança */}
      {cobrancaParaPagar && (
        <ModalReceberCobranca
          open={!!cobrancaParaPagar}
          onOpenChange={(open) => { if (!open) setCobrancaParaPagar(null); }}
          isAdmin={true}
          cobranca={{
            id: cobrancaParaPagar.id,
            revendedora: cobrancaParaPagar.revendedora,
            valor_previsto: cobrancaParaPagar.valor_previsto,
            tipo: cobrancaParaPagar.tipo,
            valor_adiantado: cobrancaParaPagar.valor_adiantado,
            status: cobrancaParaPagar.status,
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
