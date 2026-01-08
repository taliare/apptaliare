import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarIcon, Plus, Filter, DollarSign, Clock, User, Edit, Trash2, CreditCard, CalendarDays, FileText, Package, AlertCircle, Search, TrendingDown, MoreVertical, Scale, HelpCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format, isToday, isBefore, isAfter, addDays, startOfDay, getDate, getDay, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import type { Database } from '@/integrations/supabase/types';
import { formatarValor, parseLocalDate, formatDateBR, getLocalDateString } from '@/lib/utils';
import { ModalReceberCobranca } from '@/components/cobranca/ModalReceberCobranca';
import { ModalSenhaAdmin } from '@/components/cobranca/ModalSenhaAdmin';
import { TutorialCobranca } from '@/components/cobranca/TutorialCobranca';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cobrancaInsertSchema, cobrancaUpdateSchema, validateData, sanitizeString, parseMonetaryValue } from '@/lib/validations';

type StatusCobranca = Database['public']['Enums']['status_cobranca'];
type Cobranca = Database['public']['Tables']['cobrancas_agendadas']['Row'];

interface CobrancaFormData {
  revendedora: string;
  codigo_nota?: string;
  tipo?: string;
  valor_previsto: string;
  data_agendada: string;
  observacoes: string;
}

const statusConfig: Record<StatusCobranca, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' },
  pago: { label: 'Pago', color: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  parcial: { label: 'Parcial', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  reagendado: { label: 'Reagendado', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400' },
  juridico: { label: 'Jurídico', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400' },
};

export default function Cobranca() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCobranca, setEditingCobranca] = useState<Cobranca | null>(null);
  const [filtroAtivo, setFiltroAtivo] = useState<'todas' | 'vencidas' | 'hoje' | 'semana'>('hoje');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modais de pagamento, senha, reagendamento e adiantamento
  const [cobrancaParaPagar, setCobrancaParaPagar] = useState<Cobranca | null>(null);
  const [modalSenhaOpen, setModalSenhaOpen] = useState(false);
  const [acaoSenha, setAcaoSenha] = useState<'editar' | 'excluir'>('editar');
  const [cobrancaParaExcluir, setCobrancaParaExcluir] = useState<string | null>(null);
  const [modalReagendarOpen, setModalReagendarOpen] = useState(false);
  const [cobrancaParaReagendar, setCobrancaParaReagendar] = useState<Cobranca | null>(null);
  const [novaDataAgendada, setNovaDataAgendada] = useState<Date>();
  const [modalAdiantamentoOpen, setModalAdiantamentoOpen] = useState(false);
  const [cobrancaParaAdiantar, setCobrancaParaAdiantar] = useState<Cobranca | null>(null);
  const [valorAdiantamento, setValorAdiantamento] = useState('');
  const [formaPagamentoAdiantamento, setFormaPagamentoAdiantamento] = useState<'pix' | 'dinheiro' | 'cartao'>('pix');
  const [dataAdiantamento, setDataAdiantamento] = useState<Date>(new Date());
  const [showTutorial, setShowTutorial] = useState(() => {
    return !localStorage.getItem('tutorial_cobranca_visto');
  });
  
  const [formData, setFormData] = useState<CobrancaFormData>({
    revendedora: '',
    codigo_nota: '',
    tipo: '',
    valor_previsto: '',
    data_agendada: getLocalDateString(),
    observacoes: '',
  });

  // Função para formatar valor monetário durante digitação
  const formatarValorInput = (valor: string): string => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (!apenasNumeros) return '';
    const numero = parseFloat(apenasNumeros) / 100;
    return numero.toFixed(2);
  };

  // Converter valor formatado (R$ 0,00) para número
  const parseValorFormatado = (valor: string): number => {
    const numeros = valor.replace(/\D/g, '');
    if (!numeros) return 0;
    return parseFloat(numeros) / 100;
  };

  const handleValorChange = (valor: string) => {
    const valorFormatado = formatarValorInput(valor);
    setFormData({ ...formData, valor_previsto: valorFormatado });
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  const { data: cobrancas = [], isLoading } = useQuery({
    queryKey: ['cobrancas-agendadas', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('*')
        .eq('representante_id', userId)
        .in('status', ['pendente', 'parcial', 'reagendado'])
        .order('data_agendada', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Query para buscar dias não finalizados (cobrança diária)
  const { data: diasNaoFinalizados = [] } = useQuery({
    queryKey: ['dias-nao-finalizados', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // Buscar últimos 30 dias
      const hoje = new Date();
      const diasAnteriores: string[] = [];
      
      for (let i = 1; i <= 30; i++) {
        const data = new Date(hoje);
        data.setDate(data.getDate() - i);
        diasAnteriores.push(format(data, 'yyyy-MM-dd'));
      }
      
      // Buscar quais desses dias já foram finalizados
      const { data: finalizados, error } = await supabase
        .from('cobrancas_diarias')
        .select('data')
        .eq('representante_id', userId)
        .eq('finalizado', true)
        .in('data', diasAnteriores);
      
      if (error) throw error;
      
      const datasFinalizadas = new Set(finalizados?.map(f => f.data) || []);
      
      // Retornar dias que NÃO foram finalizados
      return diasAnteriores.filter(d => !datasFinalizadas.has(d));
    },
    enabled: !!userId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CobrancaFormData) => {
      const valorNumerico = parseMonetaryValue(data.valor_previsto);
      if (valorNumerico === null) {
        throw new Error('Valor inválido');
      }
      
      // Prepare and validate data
      const insertData = {
        revendedora: sanitizeString(data.revendedora),
        codigo_nota: data.codigo_nota ? sanitizeString(data.codigo_nota) : null,
        tipo: data.tipo ? sanitizeString(data.tipo) : null,
        valor_previsto: valorNumerico,
        data_agendada: data.data_agendada,
        observacoes: data.observacoes ? sanitizeString(data.observacoes) : null,
        representante_id: userId!,
        status: 'pendente' as const
      };
      
      // Validate with Zod schema
      const validation = validateData(cobrancaInsertSchema, insertData);
      if (!validation.success) {
        throw new Error((validation as { success: false; errors: string[] }).errors.join(', '));
      }
      
      const { error } = await supabase.from('cobrancas_agendadas').insert(insertData);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      toast({ title: 'Cobrança criada com sucesso!' });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar cobrança', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CobrancaFormData }) => {
      const valorNumerico = parseMonetaryValue(data.valor_previsto);
      if (valorNumerico === null) {
        throw new Error('Valor inválido');
      }
      
      // Prepare and validate data
      const updateData = {
        revendedora: sanitizeString(data.revendedora),
        codigo_nota: data.codigo_nota ? sanitizeString(data.codigo_nota) : null,
        tipo: data.tipo ? sanitizeString(data.tipo) : null,
        valor_previsto: valorNumerico,
        data_agendada: data.data_agendada,
        observacoes: data.observacoes ? sanitizeString(data.observacoes) : null,
      };
      
      // Validate with Zod schema
      const validation = validateData(cobrancaUpdateSchema, updateData);
      if (!validation.success) {
        throw new Error((validation as { success: false; errors: string[] }).errors.join(', '));
      }
      
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      toast({ title: 'Cobrança atualizada com sucesso!' });
      setIsDialogOpen(false);
      setEditingCobranca(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar cobrança', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      toast({
        title: "Sucesso",
        description: "Cobrança excluída com sucesso!",
      });
      setIsDialogOpen(false);
      setEditingCobranca(null);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir cobrança.",
        variant: "destructive"
      });
    }
  });

  // Função para processar pagamento completo
  const handlePagamentoCompleto = async (cobrancaId: string, dados: {
    valor_venda: number;
    comissao_percentual: number;
    comissao_valor: number;
    valor_devido_empresa: number;
    pagamentos: Array<{ forma: any; valor: number }>;
    tipo: 'completo' | 'devolucao';
    dataNota: string;
  }) => {
    try {
      const cobranca = cobrancas.find(c => c.id === cobrancaId);
      const dataNota = dados.dataNota; // Usar a data selecionada pelo usuário
      
      // 1. Criar prestação de contas
      const { error: prestacaoError } = await supabase
        .from('prestacoes_contas')
        .insert({
          cobranca_id: cobrancaId,
          representante_id: userId!,
          revendedora: cobranca?.revendedora || '',
          total_venda: dados.valor_venda,
          comissao_percentual: dados.comissao_percentual,
          comissao_valor: dados.comissao_valor,
          valor_devido_empresa: dados.valor_devido_empresa,
          valor_pago: dados.valor_devido_empresa,
          saldo_devedor: 0,
          forma_pagamento: dados.tipo === 'devolucao' ? 'dinheiro' : dados.pagamentos[0].forma,
          data_execucao: dataNota
        });

      if (prestacaoError) throw prestacaoError;

      // 2. Criar nota promissória para alimentar a Cobrança Diária
      // Sempre criar a nota, inclusive para devoluções (para contabilizar no dia)
      const codigoNotaGerado = `${cobranca?.revendedora || ''}-${format(new Date(), 'ddMMyyyyHHmmss')}`;
      const { error: notaError } = await supabase
        .from('notas_promissorias')
        .insert({
          representante_id: userId!,
          codigo_nota: codigoNotaGerado,
          data: dataNota,
          valor_total: dados.tipo === 'devolucao' ? 0 : dados.valor_devido_empresa,
          forma_pagamento_1: dados.tipo === 'devolucao' ? 'dinheiro' : dados.pagamentos[0]?.forma || 'dinheiro',
          valor_pagamento_1: dados.tipo === 'devolucao' ? 0 : dados.pagamentos[0]?.valor || 0,
          forma_pagamento_2: dados.pagamentos[1]?.forma || null,
          valor_pagamento_2: dados.pagamentos[1]?.valor || null,
          devolveu_tudo: dados.tipo === 'devolucao'
        });

      if (notaError) throw notaError;

      // 3. Atualizar status da cobrança para 'pago'
      const { error: updateError } = await supabase
        .from('cobrancas_agendadas')
        .update({ status: 'pago' })
        .eq('id', cobrancaId);

      if (updateError) throw updateError;

      await queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      await queryClient.invalidateQueries({ queryKey: ['notas-promissorias'] });
    } catch (error) {
      throw error;
    }
  };

  // Função para processar pagamento parcial e criar repasse (para KIT) ou nova cobrança (para REPASSE)
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
  }) => {
    try {
      const cobranca = cobrancas.find(c => c.id === cobrancaId);
      const isRepasse = cobranca?.tipo?.toLowerCase() === 'repasse';
      const dataNota = dados.dataNota; // Usar a data selecionada pelo usuário
      const codigoNota = `${cobranca?.revendedora || ''}-${format(new Date(), 'ddMMyyyyHHmmss')}`;
      
      // 1. Criar nota promissória para alimentar a Cobrança Diária (sempre criar, mesmo com valor 0)
      // Isso garante que a cobrança apareça no fechamento do dia
      const notaData: any = {
        representante_id: userId!,
        codigo_nota: codigoNota,
        data: dataNota,
        valor_total: dados.valor_recebido,
        forma_pagamento_1: dados.pagamentos[0]?.forma || 'dinheiro',
        valor_pagamento_1: dados.pagamentos[0]?.valor || 0,
        forma_pagamento_2: dados.pagamentos[1]?.forma || null,
        valor_pagamento_2: dados.pagamentos[1]?.valor || null
      };

      const { error: notaError } = await supabase
        .from('notas_promissorias')
        .insert(notaData);

      if (notaError) throw notaError;

      if (isRepasse) {
        // Para REPASSE: criar nova cobrança com valor restante
        const { error: novaCobrancaError } = await supabase
          .from('cobrancas_agendadas')
          .insert({
            representante_id: userId!,
            revendedora: cobranca?.revendedora || '',
            codigo_nota: cobranca?.codigo_nota || null,
            tipo: 'repasse',
            valor_previsto: dados.valor_repasse,
            data_agendada: format(dados.data_repasse, 'yyyy-MM-dd'),
            status: 'pendente',
            observacoes: `Saldo restante de cobrança anterior`,
            vendedora: cobranca?.vendedora || null
          });

        if (novaCobrancaError) throw novaCobrancaError;

        // Marcar a cobrança original como paga
        const { error: updateError } = await supabase
          .from('cobrancas_agendadas')
          .update({ status: 'pago' })
          .eq('id', cobrancaId);

        if (updateError) throw updateError;
      } else {
        // Para KIT: criar prestação de contas e nova cobrança do tipo repasse
        const { error: prestacaoError } = await supabase
          .from('prestacoes_contas')
          .insert({
            cobranca_id: cobrancaId,
            representante_id: userId!,
            revendedora: cobranca?.revendedora || '',
            total_venda: dados.valor_venda,
            comissao_percentual: dados.comissao_percentual,
            comissao_valor: dados.comissao_valor,
            valor_devido_empresa: dados.valor_devido_empresa,
            valor_pago: dados.valor_recebido,
            saldo_devedor: dados.valor_repasse,
            forma_pagamento: dados.pagamentos[0].forma,
            data_execucao: dataNota,
            codigo_nota_referencia: codigoNota
          });

        if (prestacaoError) throw prestacaoError;

        // Criar nova cobrança do tipo REPASSE com o valor restante
        const { error: novaCobrancaError } = await supabase
          .from('cobrancas_agendadas')
          .insert({
            representante_id: userId!,
            revendedora: cobranca?.revendedora || '',
            codigo_nota: cobranca?.codigo_nota || null,
            tipo: 'repasse',
            valor_previsto: dados.valor_repasse,
            data_agendada: format(dados.data_repasse, 'yyyy-MM-dd'),
            status: 'pendente',
            observacoes: `Saldo restante de cobrança anterior`,
            vendedora: cobranca?.vendedora || null
          });

        if (novaCobrancaError) throw novaCobrancaError;

        // Marcar a cobrança original como paga (some da agenda)
        const { error: updateError } = await supabase
          .from('cobrancas_agendadas')
          .update({ status: 'pago' })
          .eq('id', cobrancaId);

        if (updateError) throw updateError;
      }

      await queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      await queryClient.invalidateQueries({ queryKey: ['notas-promissorias'] });
    } catch (error) {
      throw error;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCobranca) {
      updateMutation.mutate({ id: editingCobranca.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (cobranca: Cobranca) => {
    if (profile?.role !== 'admin') {
      setEditingCobranca(cobranca);
      setAcaoSenha('editar');
      setModalSenhaOpen(true);
    } else {
      setEditingCobranca(cobranca);
      setFormData({
        revendedora: cobranca.revendedora,
        codigo_nota: cobranca.codigo_nota || '',
        tipo: cobranca.tipo || '',
        valor_previsto: cobranca.valor_previsto.toFixed(2),
        data_agendada: cobranca.data_agendada,
        observacoes: cobranca.observacoes || '',
      });
      setIsDialogOpen(true);
    }
  };

  const handleEditAutorizado = () => {
    if (editingCobranca) {
      setFormData({
        revendedora: editingCobranca.revendedora,
        codigo_nota: editingCobranca.codigo_nota || '',
        tipo: editingCobranca.tipo || '',
        valor_previsto: editingCobranca.valor_previsto.toFixed(2),
        data_agendada: editingCobranca.data_agendada,
        observacoes: editingCobranca.observacoes || '',
      });
      setIsDialogOpen(true);
    }
  };

  const handleDeleteClick = () => {
    if (!editingCobranca) return;
    
    if (profile?.role !== 'admin') {
      setCobrancaParaExcluir(editingCobranca.id);
      setAcaoSenha('excluir');
      setModalSenhaOpen(true);
    } else {
      deleteMutation.mutate(editingCobranca.id);
    }
  };

  const handleDeleteAutorizado = () => {
    if (cobrancaParaExcluir) {
      deleteMutation.mutate(cobrancaParaExcluir);
      setCobrancaParaExcluir(null);
    }
  };

  const handlePagarClick = (cobranca: Cobranca) => {
    setCobrancaParaPagar(cobranca);
  };

  const handleReagendarClick = (cobranca: Cobranca) => {
    setCobrancaParaReagendar(cobranca);
    setNovaDataAgendada(parseLocalDate(cobranca.data_agendada));
    setModalReagendarOpen(true);
  };

  const handleAdiantamentoClick = (cobranca: Cobranca) => {
    setCobrancaParaAdiantar(cobranca);
    setValorAdiantamento('');
    setDataAdiantamento(new Date());
    setModalAdiantamentoOpen(true);
  };

  const adiantamentoMutation = useMutation({
    mutationFn: async ({ cobrancaId, valor, forma, dataNota }: { cobrancaId: string; valor: number; forma: string; dataNota: string }) => {
      const cobranca = cobrancas.find(c => c.id === cobrancaId);
      
      // Criar nota promissória para o adiantamento
      const { error: notaError } = await supabase
        .from('notas_promissorias')
        .insert({
          representante_id: userId!,
          codigo_nota: `ADT-${cobranca?.revendedora || ''}-${format(new Date(), 'ddMMyyyyHHmmss')}`,
          data: dataNota,
          valor_total: valor,
          forma_pagamento_1: forma as any,
          valor_pagamento_1: valor,
          forma_pagamento_2: null,
          valor_pagamento_2: null
        });

      if (notaError) throw notaError;

      // Atualizar valor_adiantado na cobrança
      const { data: cobrancaData } = await supabase
        .from('cobrancas_agendadas')
        .select('valor_adiantado')
        .eq('id', cobrancaId)
        .single();

      const valorAdiantadoAtual = cobrancaData?.valor_adiantado || 0;

      const { error: updateError } = await supabase
        .from('cobrancas_agendadas')
        .update({ 
          valor_adiantado: valorAdiantadoAtual + valor
        })
        .eq('id', cobrancaId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      queryClient.invalidateQueries({ queryKey: ['notas-promissorias'] });
      toast({ title: 'Adiantamento registrado com sucesso!' });
      setModalAdiantamentoOpen(false);
      setCobrancaParaAdiantar(null);
      setValorAdiantamento('');
    },
    onError: () => {
      toast({ title: 'Erro ao registrar adiantamento', variant: 'destructive' });
    },
  });

  const handleConfirmarAdiantamento = () => {
    if (!cobrancaParaAdiantar || !valorAdiantamento) return;
    
    const valor = parseValorFormatado(valorAdiantamento);
    adiantamentoMutation.mutate({
      cobrancaId: cobrancaParaAdiantar.id,
      valor,
      forma: formaPagamentoAdiantamento,
      dataNota: format(dataAdiantamento, 'yyyy-MM-dd')
    });
  };

  const reagendarMutation = useMutation({
    mutationFn: async ({ id, novaData }: { id: string; novaData: string }) => {
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .update({ data_agendada: novaData })
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

  // Mutation para encaminhar ao jurídico
  const juridicoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .update({ 
          status: 'juridico' as any,
          data_encaminhado_juridico: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      toast({ title: 'Cobrança encaminhada ao jurídico!' });
    },
    onError: () => {
      toast({ title: 'Erro ao encaminhar ao jurídico', variant: 'destructive' });
    },
  });

  const handleJuridicoClick = (cobranca: Cobranca) => {
    juridicoMutation.mutate(cobranca.id);
  };

  const handleConfirmarReagendamento = () => {
    if (!cobrancaParaReagendar || !novaDataAgendada) return;
    
    reagendarMutation.mutate({
      id: cobrancaParaReagendar.id,
      novaData: getLocalDateString(novaDataAgendada)
    });
  };

  const resetForm = () => {
    setFormData({
      revendedora: '',
      codigo_nota: '',
      tipo: '',
      valor_previsto: '',
      data_agendada: getLocalDateString(),
      observacoes: '',
    });
  };

  // Funções de filtragem por data
  const hoje = startOfDay(new Date());

  // Função para calcular a semana do mês com base na data (mesma lógica do GerenciarAgenda)
  const getWeekOfMonth = (dateStr: string): number => {
    const date = new Date(dateStr + 'T12:00:00');
    const dayOfMonth = getDate(date);
    const firstDayOfMonth = startOfMonth(date);
    const firstDayWeekday = getDay(firstDayOfMonth); // 0 = domingo
    
    // Semana 1: dia 1 até o primeiro domingo
    const firstSunday = firstDayWeekday === 0 ? 1 : (7 - firstDayWeekday + 1);
    
    if (dayOfMonth <= firstSunday) {
      return 1;
    }
    
    // A partir do primeiro domingo, semanas de segunda a domingo
    const daysAfterFirstSunday = dayOfMonth - firstSunday;
    const weekNumber = Math.ceil(daysAfterFirstSunday / 7) + 1;
    
    return weekNumber;
  };

  // Obter limites da semana atual do mês
  const getWeekBounds = (weekNumber: number): { start: Date; end: Date } => {
    const now = new Date();
    const firstDayOfMonth = startOfMonth(now);
    const firstDayWeekday = getDay(firstDayOfMonth); // 0 = domingo
    
    // Calcular primeiro domingo
    const firstSunday = firstDayWeekday === 0 ? 1 : (7 - firstDayWeekday + 1);
    
    let startDay: number;
    let endDay: number;
    
    if (weekNumber === 1) {
      startDay = 1;
      endDay = firstSunday;
    } else {
      // Semana 2 em diante
      startDay = firstSunday + 1 + (weekNumber - 2) * 7;
      endDay = startDay + 6;
    }
    
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    endDay = Math.min(endDay, daysInMonth);
    
    return {
      start: new Date(year, month, startDay),
      end: new Date(year, month, endDay, 23, 59, 59)
    };
  };

  const semanaAtual = getWeekOfMonth(format(hoje, 'yyyy-MM-dd'));
  const weekBounds = getWeekBounds(semanaAtual);

  // Função auxiliar para aplicar filtro de pesquisa
  const aplicarFiltroPesquisa = (lista: Cobranca[]) => {
    if (!searchTerm) return lista;
    const termo = searchTerm.toLowerCase();
    return lista.filter(c => 
      c.revendedora.toLowerCase().includes(termo) ||
      c.codigo_nota?.toLowerCase().includes(termo)
    );
  };

  const cobrancasVencidas = aplicarFiltroPesquisa(
    cobrancas
      .filter(c => isBefore(parseLocalDate(c.data_agendada), hoje))
      .sort((a, b) => parseLocalDate(a.data_agendada).getTime() - parseLocalDate(b.data_agendada).getTime())
  );
  
  const cobrancasHoje = aplicarFiltroPesquisa(
    cobrancas
      .filter(c => isToday(parseLocalDate(c.data_agendada)))
      .sort((a, b) => parseLocalDate(a.data_agendada).getTime() - parseLocalDate(b.data_agendada).getTime())
  );
  
  const cobrancasSemana = aplicarFiltroPesquisa(
    cobrancas
      .filter(c => {
        const data = parseLocalDate(c.data_agendada);
        // Filtrar notas cuja data de vencimento está dentro da semana atual do mês
        return data >= weekBounds.start && data <= weekBounds.end;
      })
      .sort((a, b) => parseLocalDate(a.data_agendada).getTime() - parseLocalDate(b.data_agendada).getTime())
  );

  // Cobranças futuras (após a semana atual, não incluídas em vencidas, hoje ou semana)
  const cobrancasFuturas = aplicarFiltroPesquisa(
    cobrancas
      .filter(c => {
        const data = parseLocalDate(c.data_agendada);
        // Futuras = após a semana atual E não é hoje E não é vencida
        return isAfter(data, weekBounds.end) && !isToday(data);
      })
      .sort((a, b) => parseLocalDate(a.data_agendada).getTime() - parseLocalDate(b.data_agendada).getTime())
  );

  const cobrancasFiltradas = (() => {
    let filtered = [];
    switch (filtroAtivo) {
      case 'vencidas':
        filtered = cobrancasVencidas;
        break;
      case 'hoje':
        filtered = cobrancasHoje;
        break;
      case 'semana':
        filtered = cobrancasSemana;
        break;
      default:
        // "Todas" - mostrar TODAS as notas sem limitar ao mês atual
        filtered = aplicarFiltroPesquisa(cobrancas);
    }

    return filtered;
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4 shadow-glow" />
          <p className="text-muted-foreground animate-pulse">Carregando cobranças...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-4 md:space-y-6 animate-fade-in px-0 sm:px-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center animate-slide-up">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold truncate">Agenda de Cobranças</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Organize suas cobranças por data de vencimento</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTutorial(true)}
            className="gap-1"
          >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Guia Rápido</span>
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                resetForm();
                setEditingCobranca(null);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Cobrança
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCobranca ? 'Editar Cobrança' : 'Nova Cobrança'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="revendedora">Revendedora</Label>
                <Input
                  id="revendedora"
                  value={formData.revendedora}
                  onChange={(e) => setFormData({ ...formData, revendedora: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="codigo_nota">Código da Nota (opcional)</Label>
                  <Input
                    id="codigo_nota"
                    value={formData.codigo_nota}
                    onChange={(e) => setFormData({ ...formData, codigo_nota: e.target.value })}
                    placeholder="EX: NOTA-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo (opcional)</Label>
                  <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kit">Kit</SelectItem>
                      <SelectItem value="repasse">Repasse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor">Valor Previsto</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="valor"
                    type="text"
                    className="pl-10"
                    value={formData.valor_previsto}
                    onChange={(e) => handleValorChange(e.target.value)}
                    placeholder="0,00"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data">Data Agendada</Label>
                <Input
                  id="data"
                  type="date"
                  value={formData.data_agendada}
                  onChange={(e) => setFormData({ ...formData, data_agendada: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  rows={3}
                />
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                {editingCobranca && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteClick}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </Button>
                )}
                <Button type="submit" className="w-full sm:w-auto">
                  {editingCobranca ? 'Salvar Alterações' : 'Criar Cobrança'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filtros Rápidos e Pesquisa */}
      <Card variant="glass" className="animate-fade-in w-full max-w-full overflow-hidden" style={{ animationDelay: '0.1s' }}>
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6 space-y-3 sm:space-y-4">
          {/* Campo de Pesquisa */}
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
            <Input
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-0 text-sm"
            />
          </div>

          {/* Filtros - Ordem: Hoje, Vencidas, Semana X, Todas */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground icon-hover-rotate shrink-0 hidden sm:block" />
            <Button
              variant={filtroAtivo === 'hoje' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroAtivo('hoje')}
              className="transition-all duration-200 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
            >
              Hoje ({cobrancasHoje.length})
            </Button>
            <Button
              variant={filtroAtivo === 'vencidas' ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setFiltroAtivo('vencidas')}
              className={cn(
                "transition-all duration-200 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3",
                cobrancasVencidas.length > 0 && filtroAtivo !== 'vencidas' && "border-destructive text-destructive bg-destructive/10"
              )}
            >
              Vencidas ({cobrancasVencidas.length})
            </Button>
            <Button
              variant={filtroAtivo === 'semana' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroAtivo('semana')}
              className="transition-all duration-200 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
            >
              Sem. {semanaAtual} ({cobrancasSemana.length})
            </Button>
            <Button
              variant={filtroAtivo === 'todas' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroAtivo('todas')}
              className="transition-all duration-200 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
            >
              Todas ({aplicarFiltroPesquisa(cobrancas).length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Agenda de Cobranças */}
      <div className="space-y-4">
        {/* Vencidas */}
        {(filtroAtivo === 'todas' || filtroAtivo === 'vencidas') && cobrancasVencidas.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5 animate-fade-in" style={{ animationDelay: '0.15s' }}>
            <CardHeader className="bg-destructive/10 border-b border-destructive/20">
              <CardTitle className="text-destructive flex items-center gap-2 font-display">
                <AlertCircle className="h-5 w-5 animate-glow-pulse" />
                Cobranças Vencidas ({cobrancasVencidas.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {cobrancasVencidas.map((cobranca, index) => (
                <CobrancaItem
                  key={cobranca.id}
                  cobranca={cobranca}
                  onEdit={handleEdit}
                  onPagar={handlePagarClick}
                  onReagendar={handleReagendarClick}
                  onAdiantamento={handleAdiantamentoClick}
                  onJuridico={handleJuridicoClick}
                  destacarVencida
                  animationDelay={index * 0.05}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Hoje */}
        {(filtroAtivo === 'todas' || filtroAtivo === 'hoje') && cobrancasHoje.length > 0 && (
          <Card variant="glow" className="border-primary/50 bg-primary/5 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="bg-primary/10 border-b border-primary/20">
              <CardTitle className="flex items-center gap-2 text-primary font-display">
                <CalendarIcon className="h-5 w-5" />
                Hoje - {format(hoje, "dd/MM/yyyy", { locale: ptBR })} ({cobrancasHoje.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {cobrancasHoje.map((cobranca, index) => (
                <CobrancaItem
                  key={cobranca.id}
                  cobranca={cobranca}
                  onEdit={handleEdit}
                  onPagar={handlePagarClick}
                  onReagendar={handleReagendarClick}
                  onAdiantamento={handleAdiantamentoClick}
                  onJuridico={handleJuridicoClick}
                  animationDelay={index * 0.05}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Semana atual */}
        {(filtroAtivo === 'todas' || filtroAtivo === 'semana') && cobrancasSemana.length > 0 && (
          <Card variant="glass" className="animate-fade-in" style={{ animationDelay: '0.25s' }}>
            <CardHeader className="border-b border-border/50">
              <CardTitle className="flex items-center gap-2 font-display">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Semana {semanaAtual} ({cobrancasSemana.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {cobrancasSemana.map((cobranca, index) => (
                <CobrancaItem
                  key={cobranca.id}
                  cobranca={cobranca}
                  onEdit={handleEdit}
                  onPagar={handlePagarClick}
                  onReagendar={handleReagendarClick}
                  onAdiantamento={handleAdiantamentoClick}
                  onJuridico={handleJuridicoClick}
                  animationDelay={index * 0.05}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Cobranças Futuras - apenas visível quando filtro "Todas" está ativo */}
        {filtroAtivo === 'todas' && cobrancasFuturas.length > 0 && (
          <Card variant="glass" className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <CardHeader className="border-b border-border/50 bg-muted/30">
              <CardTitle className="flex items-center gap-2 font-display">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                Próximas Cobranças ({cobrancasFuturas.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {cobrancasFuturas.map((cobranca, index) => (
                <CobrancaItem
                  key={cobranca.id}
                  cobranca={cobranca}
                  onEdit={handleEdit}
                  onPagar={handlePagarClick}
                  onReagendar={handleReagendarClick}
                  onAdiantamento={handleAdiantamentoClick}
                  onJuridico={handleJuridicoClick}
                  animationDelay={index * 0.05}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Lista vazia */}
        {cobrancasFiltradas.length === 0 && (
          <Card variant="glass" className="animate-fade-in">
            <CardContent className="py-12 text-center text-muted-foreground">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50 animate-float" />
              <p className="text-lg font-display font-medium">Nenhuma cobrança encontrada</p>
              <p className="text-sm">Crie uma nova cobrança para começar</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de Receber Cobrança */}
      <ModalReceberCobranca
        open={!!cobrancaParaPagar}
        onOpenChange={(open) => {
          if (!open) {
            setCobrancaParaPagar(null);
          }
        }}
        cobranca={cobrancaParaPagar || { id: '', revendedora: '', valor_previsto: 0, tipo: null }}
        diasNaoFinalizados={diasNaoFinalizados}
        onPagamentoCompleto={async (dados) => {
          if (cobrancaParaPagar) {
            await handlePagamentoCompleto(cobrancaParaPagar.id, dados);
          }
        }}
        onPagamentoParcial={async (dados) => {
          if (cobrancaParaPagar) {
            await handlePagamentoParcial(cobrancaParaPagar.id, dados);
          }
        }}
      />

      {/* Modal de Senha Admin */}
      <ModalSenhaAdmin
        open={modalSenhaOpen}
        onOpenChange={setModalSenhaOpen}
        acao={acaoSenha}
        onAutorizado={() => {
          if (acaoSenha === 'editar') {
            handleEditAutorizado();
          } else {
            handleDeleteAutorizado();
          }
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
                <p className="text-sm"><strong>Revendedora:</strong> {cobrancaParaReagendar.revendedora}</p>
                <p className="text-sm"><strong>Valor:</strong> {formatarValor(cobrancaParaReagendar.valor_previsto)}</p>
                <p className="text-sm"><strong>Data Atual:</strong> {formatDateBR(cobrancaParaReagendar.data_agendada)}</p>
              </div>
              
              <div className="space-y-2">
                <Label>Nova Data de Vencimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !novaDataAgendada && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {novaDataAgendada ? format(novaDataAgendada, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione uma data</span>}
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
                <Button onClick={handleConfirmarReagendamento} disabled={!novaDataAgendada}>
                  Salvar Nova Data
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Adiantamento */}
      <Dialog open={modalAdiantamentoOpen} onOpenChange={setModalAdiantamentoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Adiantamento</DialogTitle>
          </DialogHeader>
          {cobrancaParaAdiantar && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm"><strong>Revendedora:</strong> {cobrancaParaAdiantar.revendedora}</p>
                <p className="text-sm"><strong>Valor Total:</strong> {formatarValor(cobrancaParaAdiantar.valor_previsto)}</p>
                <p className="text-sm"><strong>Data de Vencimento:</strong> {formatDateBR(cobrancaParaAdiantar.data_agendada)}</p>
                {cobrancaParaAdiantar.valor_adiantado > 0 && (
                  <p className="text-sm"><strong>Valor já Adiantado:</strong> <span className="text-green-600 font-semibold">{formatarValor(cobrancaParaAdiantar.valor_adiantado)}</span></p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Valor do Adiantamento</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    R$
                  </span>
                  <Input
                    className="pl-10"
                    value={valorAdiantamento}
                    onChange={(e) => {
                      const valor = formatarValorInput(e.target.value);
                      setValorAdiantamento(valor);
                    }}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data do Adiantamento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dataAdiantamento && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataAdiantamento ? format(dataAdiantamento, "PPP", { locale: ptBR }) : "Selecione uma data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataAdiantamento}
                      onSelect={(date) => date && setDataAdiantamento(date)}
                      disabled={(date) => {
                        const hoje = new Date();
                        hoje.setHours(0, 0, 0, 0);
                        const checkDate = new Date(date);
                        checkDate.setHours(0, 0, 0, 0);
                        
                        // Permite hoje
                        if (checkDate.getTime() === hoje.getTime()) return false;
                        
                        // Se for no passado, verifica se está na lista de não finalizados
                        if (checkDate < hoje) {
                          const dateStr = format(checkDate, 'yyyy-MM-dd');
                          return !diasNaoFinalizados.includes(dateStr);
                        }
                        
                        // Bloqueia datas futuras
                        return true;
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {diasNaoFinalizados.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Você pode selecionar dias anteriores que ainda não foram finalizados.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={formaPagamentoAdiantamento} onValueChange={(v: any) => setFormaPagamentoAdiantamento(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setModalAdiantamentoOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirmarAdiantamento} disabled={!valorAdiantamento}>
                  Registrar Adiantamento
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tutorial */}
      <TutorialCobranca 
        open={showTutorial} 
        onOpenChange={(open) => {
          setShowTutorial(open);
          if (!open) {
            localStorage.setItem('tutorial_cobranca_visto', 'true');
          }
        }} 
      />
    </div>
  );
}

// Componente de Item de Cobrança na Agenda
function CobrancaItem({
  cobranca,
  onEdit,
  onPagar,
  onReagendar,
  onAdiantamento,
  onJuridico,
  destacarVencida = false,
  animationDelay = 0,
}: {
  cobranca: Cobranca;
  onEdit: (cobranca: Cobranca) => void;
  onPagar: (cobranca: Cobranca) => void;
  onReagendar: (cobranca: Cobranca) => void;
  onAdiantamento: (cobranca: Cobranca) => void;
  onJuridico: (cobranca: Cobranca) => void;
  destacarVencida?: boolean;
  animationDelay?: number;
}) {
  const { profile } = useAuth();
  
  return (
    <Card 
      variant="interactive"
      className={cn(
        "animate-fade-in w-full max-w-full overflow-hidden",
        destacarVencida && "border-destructive/60 bg-destructive/5 hover:border-destructive"
      )}
      style={{ animationDelay: `${animationDelay}s` }}
    >
      <CardContent className="p-3 sm:p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-start sm:items-center gap-2 flex-wrap">
              <div className="font-semibold text-sm sm:text-base md:text-lg flex items-center gap-1.5 font-display min-w-0 max-w-full">
                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                <span className="truncate max-w-[180px] sm:max-w-none">{cobranca.revendedora}</span>
              </div>
              {destacarVencida && (
                <AlertCircle className="h-3.5 w-3.5 text-destructive animate-glow-pulse shrink-0" />
              )}
              <Badge className={cn(statusConfig[cobranca.status].color, "transition-all duration-200 text-[10px] sm:text-xs shrink-0")}>
                {statusConfig[cobranca.status].label}
              </Badge>
              {cobranca.tipo && (
                <Badge 
                  variant="outline"
                  className={cn(
                    "transition-all duration-200 text-[10px] sm:text-xs shrink-0",
                    cobranca.tipo === 'kit' 
                      ? 'border-primary/50 bg-primary/10 text-primary' 
                      : 'border-muted-foreground/50 bg-muted text-muted-foreground'
                  )}
                >
                  <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5" />
                  {cobranca.tipo.toUpperCase()}
                </Badge>
              )}
            </div>
            
            <div className="flex flex-wrap gap-3 text-sm">
              {cobranca.codigo_nota && (
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs bg-muted px-2 py-1 rounded font-medium">
                    {cobranca.codigo_nota}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span className="font-semibold text-foreground text-base">{formatarValor(cobranca.valor_previsto)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                <span className={cn(
                  "font-medium",
                  destacarVencida && "text-destructive font-semibold"
                )}>
                  {formatDateBR(cobranca.data_agendada)}
                </span>
              </div>
            </div>

            {cobranca.observacoes && (
              <p className="text-xs text-muted-foreground">{cobranca.observacoes}</p>
            )}

            {cobranca.valor_adiantado > 0 && (
              <div className="text-xs text-green-600 font-semibold flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                Adiantamento: {formatarValor(cobranca.valor_adiantado)}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 sm:flex-nowrap items-center">
            {profile?.role === 'admin' && (
              <Button variant="outline" size="sm" onClick={() => onEdit(cobranca)} className="flex-1 sm:flex-none">
                <Edit className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
            )}
            <Button variant="default" size="sm" onClick={() => onPagar(cobranca)} className="flex-1 sm:flex-none">
              <CreditCard className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Cobrar</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                  <MoreVertical className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Mais opções</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onReagendar(cobranca)}>
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Reagendar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAdiantamento(cobranca)}>
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Adiantamento
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onJuridico(cobranca)} className="text-purple-600">
                  <Scale className="h-4 w-4 mr-2" />
                  Encaminhar ao Jurídico
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
