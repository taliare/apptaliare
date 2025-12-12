import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CalendarIcon, Plus, Trash2, CheckCircle2, XCircle, Lock, Package, Wallet, DollarSign, Receipt } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn, formatarValor, formatarNumero } from '@/lib/utils';

interface NotaPromissoria {
  id: string;
  codigo_nota: string;
  data: string;
  valor_total: number;
  forma_pagamento_1: 'pix' | 'dinheiro' | 'cartao' | 'transferencia';
  valor_pagamento_1: number;
  forma_pagamento_2?: 'pix' | 'dinheiro' | 'cartao' | 'transferencia' | null;
  valor_pagamento_2?: number | null;
  representante_id: string;
  criado_em?: string | null;
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
}

const formaPagamentoLabels = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  transferencia: 'Transferência'
};

export default function CobrancaDiaria() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isNotaDialogOpen, setIsNotaDialogOpen] = useState(false);
  const [editingNota, setEditingNota] = useState<NotaPromissoria | null>(null);
  const [historicoDialogOpen, setHistoricoDialogOpen] = useState(false);
  const [selectedHistoricoDate, setSelectedHistoricoDate] = useState<string | null>(null);

  // State para entrega de kit
  const [isKitEntregaDialogOpen, setIsKitEntregaDialogOpen] = useState(false);
  const [kitSearchTerm, setKitSearchTerm] = useState('');
  const [selectedKit, setSelectedKit] = useState<string>('');
  const [vincularVendedora, setVincularVendedora] = useState(false);
  const [vendedoraKit, setVendedoraKit] = useState('');
  const [revendedoraKit, setRevendedoraKit] = useState('');
  const [dataVencimentoKit, setDataVencimentoKit] = useState<Date>(addDays(new Date(), 60));

  // Form states for Nota Promissória
  const [codigoNota, setCodigoNota] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [formaPagamento1, setFormaPagamento1] = useState<'pix' | 'dinheiro' | 'cartao' | 'transferencia'>('pix');
  const [valorPagamento1, setValorPagamento1] = useState('');
  const [formaPagamento2, setFormaPagamento2] = useState<'pix' | 'dinheiro' | 'cartao' | 'transferencia' | ''>('');
  const [valorPagamento2, setValorPagamento2] = useState('');

  // Form states for Cobrança Diária
  const [despesaCobranca, setDespesaCobranca] = useState('');

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

  const handleValorChange = (
    valor: string,
    setter: (v: string) => void
  ) => {
    const valorFormatado = formatarValorInput(valor);
    setter(valorFormatado);
  };

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Query for notas promissórias do dia
  const { data: notas = [], isLoading: loadingNotas } = useQuery({
    queryKey: ['notas-promissorias', dateStr, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_promissorias')
        .select('*')
        .eq('representante_id', user?.id)
        .eq('data', dateStr)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      return data as NotaPromissoria[];
    },
    enabled: !!user?.id,
  });

  // Query for cobrança diária
  const { data: cobrancaDiaria, isLoading: loadingCobranca } = useQuery({
    queryKey: ['cobranca-diaria', dateStr, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('*')
        .eq('representante_id', user?.id)
        .eq('data', dateStr)
        .maybeSingle();
      
      if (error) throw error;
      return data as CobrancaDiaria | null;
    },
    enabled: !!user?.id,
  });

  // Query for histórico de fechamentos
  const { data: historico = [] } = useQuery({
    queryKey: ['historico-cobrancas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('*')
        .eq('representante_id', user?.id)
        .eq('finalizado', true)
        .order('data', { ascending: false })
        .limit(30);
      
      if (error) throw error;
      return data as CobrancaDiaria[];
    },
    enabled: !!user?.id,
  });

  // Query para contar notas por dia
  const { data: notasPorDia = {} } = useQuery({
    queryKey: ['notas-por-dia', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_promissorias')
        .select('data')
        .eq('representante_id', user?.id);
      
      if (error) throw error;
      
      const contagem: Record<string, number> = {};
      data.forEach((nota) => {
        contagem[nota.data] = (contagem[nota.data] || 0) + 1;
      });
      
      return contagem;
    },
    enabled: !!user?.id,
  });

  // Query para buscar notas de uma data específica do histórico
  const { data: notasHistorico = [], isLoading: loadingNotasHistorico } = useQuery({
    queryKey: ['notas-historico', selectedHistoricoDate, user?.id],
    queryFn: async () => {
      if (!selectedHistoricoDate) return [];
      
      const { data, error } = await supabase
        .from('notas_promissorias')
        .select('*')
        .eq('representante_id', user?.id)
        .eq('data', selectedHistoricoDate)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      return data as NotaPromissoria[];
    },
    enabled: !!user?.id && !!selectedHistoricoDate,
  });

  // Query para buscar revendedoras das cobranças agendadas (lookup por codigo_nota)
  const { data: cobrancasAgendadas = [] } = useQuery({
    queryKey: ['cobrancas-agendadas-lookup', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('codigo_nota, revendedora')
        .eq('representante_id', user?.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Criar mapa de codigo_nota -> revendedora para lookup rápido
  const revendedoraMap = cobrancasAgendadas.reduce((acc, item) => {
    if (item.codigo_nota) {
      acc[item.codigo_nota] = item.revendedora;
    }
    return acc;
  }, {} as Record<string, string>);

  // Query para kits em estoque do representante
  const { data: kitsEstoque = [] } = useQuery({
    queryKey: ['kits-estoque-rep-diaria', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kits_estoque')
        .select('*')
        .eq('representante_id', user?.id)
        .eq('status', 'com_representante')
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Query para entregas de kits do dia (usando kits_entregues com data_entrega real)
  const { data: kitsEntreguesDoDia = [] } = useQuery({
    queryKey: ['kits-entregues-dia', dateStr, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kits_entregues')
        .select('*')
        .eq('representante_id', user?.id)
        .eq('data_entrega', dateStr)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Buscar detalhes das cobranças (revendedora, valor) para os kits entregues do dia
  const codigosKitsDoDia = kitsEntreguesDoDia.map((k: any) => k.codigo_mostruario);
  
  const { data: detalhesKitsCobrancas = [] } = useQuery({
    queryKey: ['detalhes-kits-cobrancas', codigosKitsDoDia, user?.id],
    queryFn: async () => {
      if (codigosKitsDoDia.length === 0) return [];
      
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('codigo_nota, revendedora, valor_previsto')
        .eq('representante_id', user?.id)
        .eq('tipo', 'kit')
        .in('codigo_nota', codigosKitsDoDia);
      
      if (error) throw error;
      return data;
    },
    enabled: codigosKitsDoDia.length > 0 && !!user?.id,
  });

  // Mapear detalhes por código do kit
  const detalhesKitMap = detalhesKitsCobrancas.reduce((acc: Record<string, any>, item: any) => {
    if (item.codigo_nota) {
      acc[item.codigo_nota] = item;
    }
    return acc;
  }, {});

  // Combinar kits entregues com detalhes das cobranças para exibição
  const entregasDoDia = kitsEntreguesDoDia.map((kit: any) => {
    const detalhes = detalhesKitMap[kit.codigo_mostruario];
    return {
      id: kit.id,
      codigo_nota: kit.codigo_mostruario,
      revendedora: detalhes?.revendedora || 'Não informada',
      valor_previsto: detalhes?.valor_previsto || 0,
      tipo: kit.tipo,
      data_entrega: kit.data_entrega,
    };
  });

  // Filtrar kits pela pesquisa
  const kitsFiltrados = kitsEstoque.filter((kit: any) =>
    kit.codigo.toLowerCase().includes(kitSearchTerm.toLowerCase())
  );

  // Mutation para registrar entrega de kit
  const entregaKitMutation = useMutation({
    mutationFn: async (data: { kitId: string; codigo: string; tipo: string; valor: number; revendedora: string; vendedora?: string; dataVencimento: string }) => {
      const { data: updateResult, error: updateError } = await supabase
        .rpc('atualizar_status_kit_entrega', {
          p_kit_id: data.kitId,
          p_user_id: user!.id
        });

      if (updateError) throw updateError;
      if (!updateResult) throw new Error('Kit não encontrado ou não pertence a você');

      const { error: cobrancaError } = await supabase
        .from('cobrancas_agendadas')
        .insert({
          representante_id: user!.id,
          revendedora: data.revendedora,
          codigo_nota: data.codigo,
          tipo: 'kit',
          valor_previsto: data.valor,
          data_agendada: data.dataVencimento,
          status: 'pendente',
          vendedora: data.vendedora || null,
          observacoes: `Entrega de kit ${data.tipo} - Código: ${data.codigo}`
        });

      if (cobrancaError) throw cobrancaError;

      // Registrar na tabela kits_entregues para alimentar a tela "Kits Entregues"
      const { error: kitEntregueError } = await supabase
        .from('kits_entregues')
        .insert({
          representante_id: user!.id,
          codigo_mostruario: data.codigo,
          tipo: data.tipo,
          data_entrega: format(new Date(), 'yyyy-MM-dd'),
          data_vencimento: data.dataVencimento
        });

      if (kitEntregueError) throw kitEntregueError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kits-estoque-rep-diaria'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      queryClient.invalidateQueries({ queryKey: ['kits-entregues-dia'] });
      queryClient.invalidateQueries({ queryKey: ['detalhes-kits-cobrancas'] });
      queryClient.invalidateQueries({ queryKey: ['kits-entregues-representante'] });
      toast.success('Entrega de kit registrada com sucesso!');
      resetKitEntregaForm();
      setIsKitEntregaDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Erro ao registrar entrega: ${error.message}`);
    },
  });

  // Mutation para excluir entrega de kit
  const excluirEntregaMutation = useMutation({
    mutationFn: async (entrega: { id: string; codigo_nota: string }) => {
      // Reverter status do kit no estoque
      const { error: revertError } = await supabase
        .rpc('reverter_entrega_kit', {
          p_codigo_kit: entrega.codigo_nota,
          p_user_id: user!.id
        });

      if (revertError) throw revertError;

      // Deletar da tabela kits_entregues
      const { error: deleteKitEntregueError } = await supabase
        .from('kits_entregues')
        .delete()
        .eq('id', entrega.id);

      if (deleteKitEntregueError) throw deleteKitEntregueError;

      // Deletar da tabela cobrancas_agendadas pelo código do kit
      const { error: deleteCobrancaError } = await supabase
        .from('cobrancas_agendadas')
        .delete()
        .eq('representante_id', user!.id)
        .eq('codigo_nota', entrega.codigo_nota)
        .eq('tipo', 'kit');

      if (deleteCobrancaError) throw deleteCobrancaError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kits-estoque-rep-diaria'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      queryClient.invalidateQueries({ queryKey: ['kits-entregues-dia'] });
      queryClient.invalidateQueries({ queryKey: ['detalhes-kits-cobrancas'] });
      queryClient.invalidateQueries({ queryKey: ['kits-entregues-representante'] });
      toast.success('Entrega excluída! Kit voltou para sua posse.');
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir entrega: ${error.message}`);
    },
  });

  const resetKitEntregaForm = () => {
    setSelectedKit('');
    setKitSearchTerm('');
    setVincularVendedora(false);
    setVendedoraKit('');
    setRevendedoraKit('');
    setDataVencimentoKit(addDays(new Date(), 60));
  };

  const handleSubmitKitEntrega = () => {
    if (!user?.id) {
      toast.error('Usuário não autenticado. Faça login novamente.');
      return;
    }

    if (!selectedKit || !revendedoraKit) {
      toast.error('Selecione um kit e informe o nome da revendedora');
      return;
    }

    const kit = kitsEstoque.find((k: any) => k.id === selectedKit);
    if (!kit) {
      toast.error('Kit não encontrado');
      return;
    }

    entregaKitMutation.mutate({
      kitId: selectedKit,
      codigo: kit.codigo,
      tipo: kit.tipo,
      valor: kit.valor || 0,
      revendedora: revendedoraKit,
      vendedora: vincularVendedora ? vendedoraKit : undefined,
      dataVencimento: format(dataVencimentoKit, 'yyyy-MM-dd')
    });
  };

  // Mutation para adicionar nota
  const addNotaMutation = useMutation({
    mutationFn: async (nota: Omit<NotaPromissoria, 'id' | 'criado_em'>) => {
      const { data, error } = await supabase
        .from('notas_promissorias')
        .insert(nota)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-promissorias'] });
      toast.success('Nota promissória adicionada com sucesso!');
      resetNotaForm();
      setIsNotaDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Erro ao adicionar nota: ${error.message}`);
    },
  });

  // Mutation para atualizar nota
  const updateNotaMutation = useMutation({
    mutationFn: async ({ id, ...nota }: Partial<NotaPromissoria> & { id: string }) => {
      const { data, error } = await supabase
        .from('notas_promissorias')
        .update(nota)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-promissorias'] });
      toast.success('Nota promissória atualizada com sucesso!');
      resetNotaForm();
      setIsNotaDialogOpen(false);
      setEditingNota(null);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar nota: ${error.message}`);
    },
  });

  // Mutation para excluir nota da cobrança de hoje e devolver para agenda
  const excluirNotaDaCobrancaMutation = useMutation({
    mutationFn: async (nota: NotaPromissoria) => {
      // Buscar dados da cobrança agendada original para preservar
      const { data: cobrancaOriginal } = await supabase
        .from('cobrancas_agendadas')
        .select('*')
        .eq('representante_id', user?.id)
        .eq('codigo_nota', nota.codigo_nota)
        .maybeSingle();

      // Deletar a nota promissória (registro da cobrança de hoje)
      const { error: deleteError } = await supabase
        .from('notas_promissorias')
        .delete()
        .eq('id', nota.id);

      if (deleteError) throw deleteError;

      // Se existia cobrança agendada, apenas garantir que está pendente
      if (cobrancaOriginal) {
        const { error: updateError } = await supabase
          .from('cobrancas_agendadas')
          .update({ status: 'pendente' })
          .eq('id', cobrancaOriginal.id);

        if (updateError) throw updateError;
      } else {
        // Se não existia, criar uma nova cobrança agendada para não perder a nota
        const revendedora = revendedoraMap[nota.codigo_nota] || 'Revendedora não identificada';
        const { error: insertError } = await supabase
          .from('cobrancas_agendadas')
          .insert({
            representante_id: user!.id,
            revendedora: revendedora,
            codigo_nota: nota.codigo_nota,
            valor_previsto: nota.valor_total,
            data_agendada: dateStr,
            status: 'pendente',
            observacoes: 'Nota devolvida da cobrança diária'
          });

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-promissorias'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      queryClient.invalidateQueries({ queryKey: ['notas-por-dia'] });
      toast.success('Nota removida da cobrança de hoje e devolvida para a Agenda!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover nota: ${error.message}`);
    },
  });

  // Mutation para deletar nota e reverter cobrança se necessário
  const deleteNotaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: nota, error: notaError } = await supabase
        .from('notas_promissorias')
        .select('*')
        .eq('id', id)
        .single();
      
      if (notaError) throw notaError;
      
      const { data: prestacao, error: prestacaoError } = await supabase
        .from('prestacoes_contas')
        .select('*')
        .eq('codigo_nota_referencia', nota.codigo_nota)
        .maybeSingle();
      
      if (prestacaoError) throw prestacaoError;
      
      if (prestacao && prestacao.cobranca_id) {
        const { error: repasseError } = await supabase
          .from('repasses')
          .delete()
          .eq('cobranca_id', prestacao.cobranca_id);
        
        if (repasseError) throw repasseError;
        
        const { error: deletePrestacaoError } = await supabase
          .from('prestacoes_contas')
          .delete()
          .eq('id', prestacao.id);
        
        if (deletePrestacaoError) throw deletePrestacaoError;
        
        const { error: updateCobrancaError } = await supabase
          .from('cobrancas_agendadas')
          .update({ status: 'pendente' })
          .eq('id', prestacao.cobranca_id);
        
        if (updateCobrancaError) throw updateCobrancaError;
      }
      
      const { error: deleteNotaError } = await supabase
        .from('notas_promissorias')
        .delete()
        .eq('id', id);
      
      if (deleteNotaError) throw deleteNotaError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-promissorias'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      queryClient.invalidateQueries({ queryKey: ['prestacoes-contas'] });
      queryClient.invalidateQueries({ queryKey: ['repasses'] });
      toast.success('Nota promissória excluída e cobrança restaurada com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao excluir nota: ${error.message}`);
    },
  });

  // Mutation para finalizar dia
  const finalizarDiaMutation = useMutation({
    mutationFn: async () => {
      const totalCobrado = notas.reduce((acc, nota) => acc + nota.valor_total, 0);
      
      const cobrancaData = {
        representante_id: user!.id,
        data: dateStr,
        total_cobrado: totalCobrado,
        total_pix: totalPixCalculado,
        total_dinheiro: totalDinheiroCalculado,
        total_cartao: totalCartaoCalculado,
        despesa_cobranca: parseValorFormatado(despesaCobranca) || 0,
        finalizado: true,
      };

      if (cobrancaDiaria?.id) {
        const { error } = await supabase
          .from('cobrancas_diarias')
          .update(cobrancaData)
          .eq('id', cobrancaDiaria.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cobrancas_diarias')
          .insert(cobrancaData);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobranca-diaria'] });
      queryClient.invalidateQueries({ queryKey: ['historico-cobrancas'] });
      toast.success('Dia finalizado com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao finalizar dia: ${error.message}`);
    },
  });

  const resetNotaForm = () => {
    setCodigoNota('');
    setValorTotal('');
    setFormaPagamento1('pix');
    setValorPagamento1('');
    setFormaPagamento2('');
    setValorPagamento2('');
  };

  const handleOpenNotaDialog = (nota?: NotaPromissoria) => {
    if (nota) {
      setEditingNota(nota);
      setCodigoNota(nota.codigo_nota);
      setValorTotal(nota.valor_total.toFixed(2));
      setFormaPagamento1(nota.forma_pagamento_1);
      setValorPagamento1(nota.valor_pagamento_1.toFixed(2));
      setFormaPagamento2(nota.forma_pagamento_2 || '');
      setValorPagamento2(nota.valor_pagamento_2?.toFixed(2) || '');
    } else {
      resetNotaForm();
      setEditingNota(null);
    }
    setIsNotaDialogOpen(true);
  };

  const handleDevolveuTudo = () => {
    if (!codigoNota) {
      toast.error('Informe o código da nota');
      return;
    }

    const notaData = {
      representante_id: user!.id,
      codigo_nota: codigoNota,
      data: dateStr,
      valor_total: 0,
      forma_pagamento_1: formaPagamento1,
      valor_pagamento_1: 0,
      forma_pagamento_2: null,
      valor_pagamento_2: null,
    };

    addNotaMutation.mutate(notaData);
  };

  const handleSubmitNota = () => {
    if (!codigoNota) {
      toast.error('Preencha o código da nota');
      return;
    }

    const valor1 = parseValorFormatado(valorPagamento1);
    const valor2 = formaPagamento2 ? parseValorFormatado(valorPagamento2) : 0;
    const valorTotalNum = parseValorFormatado(valorTotal);

    if (valorTotalNum === 0 && !editingNota) {
      toast.error('O valor total não pode ser zero. Use "Devolveu tudo" para registrar devoluções.');
      return;
    }

    if (Math.abs((valor1 + valor2) - valorTotalNum) > 0.01) {
      toast.error('A soma dos pagamentos deve ser igual ao valor total');
      return;
    }

    const notaData = {
      representante_id: user!.id,
      codigo_nota: codigoNota,
      data: dateStr,
      valor_total: valorTotalNum,
      forma_pagamento_1: formaPagamento1,
      valor_pagamento_1: valor1,
      forma_pagamento_2: formaPagamento2 || null,
      valor_pagamento_2: valor2 || null,
    };

    if (editingNota) {
      updateNotaMutation.mutate({ id: editingNota.id, ...notaData });
    } else {
      addNotaMutation.mutate(notaData);
    }
  };

  const handleFinalizarDia = () => {
    finalizarDiaMutation.mutate();
  };

  // Calcular totais
  const totalCobradoCalculado = notas.reduce((acc, nota) => acc + nota.valor_total, 0);
  const totalNotasDoDia = notas.length;

  const totaisPorFormaPagamento = notas.reduce(
    (acc, nota) => {
      acc[nota.forma_pagamento_1] = (acc[nota.forma_pagamento_1] || 0) + nota.valor_pagamento_1;
      if (nota.forma_pagamento_2 && nota.valor_pagamento_2) {
        acc[nota.forma_pagamento_2] = (acc[nota.forma_pagamento_2] || 0) + nota.valor_pagamento_2;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  const totalPixCalculado = totaisPorFormaPagamento['pix'] || 0;
  const totalDinheiroCalculado = totaisPorFormaPagamento['dinheiro'] || 0;
  const totalCartaoCalculado = totaisPorFormaPagamento['cartao'] || 0;

  const isDiaFinalizado = cobrancaDiaria?.finalizado === true;

  const handleOpenHistoricoDialog = (data: string) => {
    setSelectedHistoricoDate(data);
    setHistoricoDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Título com data */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            Fechamento do Dia
            {isDiaFinalizado && (
              <Badge variant="default" className="text-sm">
                <Lock className="h-3 w-3 mr-1" />
                Finalizado
              </Badge>
            )}
          </h1>
          <p className="text-lg text-muted-foreground">
            {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <CalendarIcon className="mr-2 h-4 w-4" />
              Alterar Data
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Três blocos visuais */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Bloco Cobranças de Hoje */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5 text-primary" />
              Cobranças de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingNotas ? (
              <div className="text-center py-4 text-muted-foreground text-sm">Carregando...</div>
            ) : notas.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Nenhuma cobrança registrada
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {notas.map((nota) => {
                  const revendedora = revendedoraMap[nota.codigo_nota];
                  return (
                    <div key={nota.id} className="p-2 bg-muted/50 rounded-lg text-sm space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          {revendedora && (
                            <p className="font-medium text-foreground truncate">{revendedora}</p>
                          )}
                          <p className="text-xs text-muted-foreground font-mono">{nota.codigo_nota}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-primary whitespace-nowrap">{formatarValor(nota.valor_total)}</span>
                          {!isDiaFinalizado && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
                                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir da Cobrança de Hoje</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    A nota <strong>{nota.codigo_nota}</strong> será removida da cobrança de hoje e voltará para a <strong>Agenda de Cobrança</strong> como pendente.
                                    <br /><br />
                                    A nota NÃO será apagada do sistema.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => excluirNotaDaCobrancaMutation.mutate(nota)}
                                    disabled={excluirNotaDaCobrancaMutation.isPending}
                                  >
                                    {excluirNotaDaCobrancaMutation.isPending ? 'Removendo...' : 'Confirmar'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3 pt-3 border-t flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{notas.length} notas</span>
              <span className="font-bold text-primary">{formatarValor(totalCobradoCalculado)}</span>
            </div>
            {!isDiaFinalizado && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-3"
                onClick={() => handleOpenNotaDialog()}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Nota
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Bloco Entregas de Kits */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" />
              Entregas de Kits
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entregasDoDia.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Nenhuma entrega hoje
              </div>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {entregasDoDia.map((entrega: any) => (
                  <div key={entrega.id} className="p-2 bg-muted/50 rounded-lg text-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-medium">{entrega.codigo_nota}</span>
                      {!isDiaFinalizado && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Entrega</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir esta entrega? O kit {entrega.codigo_nota} voltará para sua posse.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => excluirEntregaMutation.mutate({ 
                                  id: entrega.id, 
                                  codigo_nota: entrega.codigo_nota 
                                })}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{entrega.revendedora}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 pt-3 border-t flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{entregasDoDia.length} entregas</span>
              <span className="font-bold text-primary">
                {formatarValor(entregasDoDia.reduce((acc: number, e: any) => acc + (e.valor_previsto || 0), 0))}
              </span>
            </div>
            {!isDiaFinalizado && (
              <Dialog open={isKitEntregaDialogOpen} onOpenChange={setIsKitEntregaDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-3"
                    onClick={resetKitEntregaForm}
                    disabled={kitsEstoque.length === 0}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Entregar Kit ({kitsEstoque.length})
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Entrega de Kit</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Selecionar Kit * ({kitsEstoque.length} disponíveis)</Label>
                      <Select value={selectedKit} onValueChange={setSelectedKit}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pesquisar e selecionar kit..." />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="p-2">
                            <Input
                              placeholder="Buscar por código..."
                              value={kitSearchTerm}
                              onChange={(e) => setKitSearchTerm(e.target.value)}
                              className="mb-2"
                            />
                          </div>
                          {kitsFiltrados.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">Nenhum kit encontrado</div>
                          ) : (
                            kitsFiltrados.map((kit: any) => (
                              <SelectItem key={kit.id} value={kit.id}>
                                {kit.codigo} ({kit.tipo}) {kit.valor > 0 && `- R$ ${kit.valor.toFixed(2)}`}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedKit && (() => {
                      const kit = kitsEstoque.find((k: any) => k.id === selectedKit);
                      return kit ? (
                        <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                          <p><strong>Código:</strong> {kit.codigo}</p>
                          <p><strong>Tipo:</strong> {kit.tipo}</p>
                          <p><strong>Valor:</strong> R$ {(kit.valor || 0).toFixed(2)}</p>
                        </div>
                      ) : null;
                    })()}

                    <div>
                      <Label>Nome da Revendedora *</Label>
                      <Input
                        value={revendedoraKit}
                        onChange={(e) => setRevendedoraKit(e.target.value)}
                        placeholder="Ex: Maria Silva"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="vincular-vendedora"
                        checked={vincularVendedora}
                        onChange={(e) => setVincularVendedora(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="vincular-vendedora" className="cursor-pointer">
                        Vincular a uma vendedora
                      </Label>
                    </div>

                    {vincularVendedora && (
                      <div>
                        <Label>Nome da Vendedora</Label>
                        <Input
                          value={vendedoraKit}
                          onChange={(e) => setVendedoraKit(e.target.value)}
                          placeholder="Ex: Ana Costa"
                        />
                      </div>
                    )}

                    <div>
                      <Label>Data de Vencimento</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(dataVencimentoKit, "dd/MM/yyyy", { locale: ptBR })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dataVencimentoKit}
                            onSelect={(date) => date && setDataVencimentoKit(date)}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsKitEntregaDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSubmitKitEntrega} disabled={entregaKitMutation.isPending}>
                      {entregaKitMutation.isPending ? 'Registrando...' : 'Registrar Entrega'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        {/* Bloco Despesas do Dia */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wallet className="h-5 w-5 text-primary" />
              Despesas do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="despesa_cobranca" className="text-sm">Valor da Despesa</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="despesa_cobranca"
                    type="text"
                    value={despesaCobranca}
                    onChange={(e) => handleValorChange(e.target.value, setDespesaCobranca)}
                    placeholder="0,00"
                    className="pl-10"
                    disabled={isDiaFinalizado}
                  />
                </div>
              </div>
              
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">PIX</span>
                  <span className="font-medium">{formatarValor(totalPixCalculado)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dinheiro</span>
                  <span className="font-medium">{formatarValor(totalDinheiroCalculado)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cartão</span>
                  <span className="font-medium">{formatarValor(totalCartaoCalculado)}</span>
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Saldo Final</span>
                  <span className="text-xl font-bold text-primary">
                    {formatarValor(totalCobradoCalculado - parseValorFormatado(despesaCobranca))}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botão grande de confirmar fechamento */}
      {!isDiaFinalizado && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="lg" className="w-full h-14 text-lg">
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Confirmar Fechamento do Dia
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Fechamento</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja finalizar o dia? Após finalizar, não será possível editar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleFinalizarDia}>
                Confirmar Finalização
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Dialog para adicionar/editar nota */}
      <Dialog open={isNotaDialogOpen} onOpenChange={setIsNotaDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingNota ? 'Editar Nota Promissória' : 'Nova Nota Promissória'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="codigo_nota">Código da Nota *</Label>
              <Input
                id="codigo_nota"
                value={codigoNota}
                onChange={(e) => setCodigoNota(e.target.value)}
                placeholder="Ex: NP-001"
              />
            </div>

            <div>
              <Label htmlFor="valor_total">Valor Total *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  R$
                </span>
                <Input
                  id="valor_total"
                  type="text"
                  value={valorTotal}
                  onChange={(e) => handleValorChange(e.target.value, setValorTotal)}
                  placeholder="0,00"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="forma_pagamento_1">Forma de Pagamento 1 *</Label>
                <Select value={formaPagamento1} onValueChange={(v: any) => setFormaPagamento1(v)}>
                  <SelectTrigger id="forma_pagamento_1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="valor_pagamento_1">Valor Pagamento 1 *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="valor_pagamento_1"
                    type="text"
                    value={valorPagamento1}
                    onChange={(e) => handleValorChange(e.target.value, setValorPagamento1)}
                    placeholder="0,00"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="forma_pagamento_2">Forma de Pagamento 2 (Opcional)</Label>
                <Select value={formaPagamento2} onValueChange={(v: any) => setFormaPagamento2(v)}>
                  <SelectTrigger id="forma_pagamento_2">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="valor_pagamento_2">Valor Pagamento 2</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="valor_pagamento_2"
                    type="text"
                    value={valorPagamento2}
                    onChange={(e) => handleValorChange(e.target.value, setValorPagamento2)}
                    placeholder="0,00"
                    className="pl-10"
                    disabled={!formaPagamento2}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsNotaDialogOpen(false)}>
              Cancelar
            </Button>
            {!editingNota && (
              <Button 
                variant="secondary" 
                onClick={handleDevolveuTudo}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Devolveu tudo
              </Button>
            )}
            <Button onClick={handleSubmitNota}>
              {editingNota ? 'Atualizar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico de Fechamentos - Colapsável */}
      {historico.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none">
            <Card className="group-open:rounded-b-none">
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="text-base font-medium">Ver histórico de fechamentos anteriores</CardTitle>
                <Badge variant="secondary">{historico.length} registros</Badge>
              </CardHeader>
            </Card>
          </summary>
          <Card className="rounded-t-none border-t-0">
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Total Cobrado</TableHead>
                      <TableHead className="text-right">Despesas</TableHead>
                      <TableHead className="text-right">Qtd Notas</TableHead>
                      <TableHead className="text-right">Saldo do Dia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((cobranca) => {
                      const qtdNotas = notasPorDia[cobranca.data] || 0;
                      const saldo = cobranca.total_cobrado - (cobranca.despesa_cobranca || 0);
                      
                      return (
                        <TableRow 
                          key={cobranca.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleOpenHistoricoDialog(cobranca.data)}
                        >
                          <TableCell className="font-medium">
                            {format(new Date(cobranca.data + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatarValor(cobranca.total_cobrado)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatarValor(cobranca.despesa_cobranca || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="font-semibold">
                              {formatarNumero(qtdNotas)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-foreground">
                            {formatarValor(saldo)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </details>
      )}

      {/* Dialog de Detalhes do Histórico */}
      <Dialog open={historicoDialogOpen} onOpenChange={setHistoricoDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalhes da Cobrança - {selectedHistoricoDate && format(new Date(selectedHistoricoDate + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          
          {loadingNotasHistorico ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : notasHistorico.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma nota encontrada para esta data
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Forma Pag. 1</TableHead>
                      <TableHead>Valor Pag. 1</TableHead>
                      <TableHead>Forma Pag. 2</TableHead>
                      <TableHead>Valor Pag. 2</TableHead>
                      <TableHead>Horário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notasHistorico.map((nota) => (
                      <TableRow key={nota.id}>
                        <TableCell className="font-medium">
                          {nota.codigo_nota}
                          {nota.valor_total === 0 && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Devolução Total
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className={nota.valor_total === 0 ? 'text-muted-foreground' : 'font-semibold'}>
                          {formatarValor(nota.valor_total)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {formaPagamentoLabels[nota.forma_pagamento_1]}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatarValor(nota.valor_pagamento_1)}</TableCell>
                        <TableCell>
                          {nota.forma_pagamento_2 ? (
                            <Badge variant="secondary">
                              {formaPagamentoLabels[nota.forma_pagamento_2]}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {nota.valor_pagamento_2 ? formatarValor(nota.valor_pagamento_2) : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {nota.criado_em ? format(new Date(nota.criado_em), 'HH:mm', { locale: ptBR }) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Resumo do dia */}
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-foreground mb-3">Resumo do Dia</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Notas</p>
                    <p className="text-lg font-bold">{notasHistorico.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Cobrado</p>
                    <p className="text-lg font-bold">
                      {formatarValor(notasHistorico.reduce((acc, n) => acc + n.valor_total, 0))}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoricoDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
