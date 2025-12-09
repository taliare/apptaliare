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
import { CalendarIcon, Plus, Trash2, CheckCircle2, XCircle, Lock, Package, Search } from 'lucide-react';
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
  const [isEntregasDialogOpen, setIsEntregasDialogOpen] = useState(false);

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
    // Remove tudo que não é número
    const apenasNumeros = valor.replace(/\D/g, '');
    
    if (!apenasNumeros) return '';
    
    // Converte para número e divide por 100 para ter 2 casas decimais
    const numero = parseFloat(apenasNumeros) / 100;
    
    // Formata com 2 casas decimais
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
      
      // Agrupar por data e contar
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

  // Query para entregas de kits do dia (cobranças tipo='kit' criadas hoje)
  const { data: entregasDoDia = [] } = useQuery({
    queryKey: ['entregas-kits-dia', dateStr, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('*')
        .eq('representante_id', user?.id)
        .eq('tipo', 'kit')
        .gte('criado_em', `${dateStr}T00:00:00`)
        .lt('criado_em', `${dateStr}T23:59:59.999`)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Filtrar kits pela pesquisa
  const kitsFiltrados = kitsEstoque.filter((kit: any) =>
    kit.codigo.toLowerCase().includes(kitSearchTerm.toLowerCase())
  );

  // Mutation para registrar entrega de kit
  const entregaKitMutation = useMutation({
    mutationFn: async (data: { kitId: string; codigo: string; tipo: string; valor: number; revendedora: string; vendedora?: string; dataVencimento: string }) => {
      // 1. Atualizar status do kit usando função SECURITY DEFINER
      const { data: updateResult, error: updateError } = await supabase
        .rpc('atualizar_status_kit_entrega', {
          p_kit_id: data.kitId,
          p_user_id: user!.id
        });

      if (updateError) throw updateError;
      if (!updateResult) throw new Error('Kit não encontrado ou não pertence a você');

      // 2. Criar cobrança para o kit entregue usando o valor da produção
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kits-estoque-rep-diaria'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      queryClient.invalidateQueries({ queryKey: ['entregas-kits-dia'] });
      toast.success('Entrega de kit registrada com sucesso!');
      resetKitEntregaForm();
      setIsKitEntregaDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Erro ao registrar entrega: ${error.message}`);
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

  // Mutation para deletar nota e reverter cobrança se necessário
  const deleteNotaMutation = useMutation({
    mutationFn: async (id: string) => {
      // 1. Buscar a nota que será deletada
      const { data: nota, error: notaError } = await supabase
        .from('notas_promissorias')
        .select('*')
        .eq('id', id)
        .single();
      
      if (notaError) throw notaError;
      
      // 2. Buscar prestação de contas associada através do codigo_nota_referencia
      const { data: prestacao, error: prestacaoError } = await supabase
        .from('prestacoes_contas')
        .select('*')
        .eq('codigo_nota_referencia', nota.codigo_nota)
        .maybeSingle();
      
      if (prestacaoError) throw prestacaoError;
      
      // 3. Se existe prestação associada (pagamento parcial), fazer rollback completo
      if (prestacao && prestacao.cobranca_id) {
        // 3.1. Deletar repasse associado
        const { error: repasseError } = await supabase
          .from('repasses')
          .delete()
          .eq('cobranca_id', prestacao.cobranca_id);
        
        if (repasseError) throw repasseError;
        
        // 3.2. Deletar prestação de contas
        const { error: deletePrestacaoError } = await supabase
          .from('prestacoes_contas')
          .delete()
          .eq('id', prestacao.id);
        
        if (deletePrestacaoError) throw deletePrestacaoError;
        
        // 3.3. Reverter status da cobrança para pendente
        const { error: updateCobrancaError } = await supabase
          .from('cobrancas_agendadas')
          .update({ status: 'pendente' })
          .eq('id', prestacao.cobranca_id);
        
        if (updateCobrancaError) throw updateCobrancaError;
      }
      
      // 4. Deletar a nota promissória
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

      if (cobrancaDiaria) {
        const { data, error } = await supabase
          .from('cobrancas_diarias')
          .update(cobrancaData)
          .eq('id', cobrancaDiaria.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('cobrancas_diarias')
          .insert(cobrancaData)
          .select()
          .single();
        
        if (error) throw error;
        return data;
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
      setValorPagamento2(nota.valor_pagamento_2 ? nota.valor_pagamento_2.toFixed(2) : '');
    } else {
      resetNotaForm();
      setEditingNota(null);
    }
    setIsNotaDialogOpen(true);
  };

  const handleDevolveuTudo = () => {
    // Validação mínima
    if (!codigoNota) {
      toast.error('Preencha o código da nota');
      return;
    }

    const notaDevolvida = {
      representante_id: user!.id,
      data: dateStr,
      codigo_nota: codigoNota,
      valor_total: 0,
      forma_pagamento_1: 'pix' as const,
      valor_pagamento_1: 0,
      forma_pagamento_2: null,
      valor_pagamento_2: null,
    };

    addNotaMutation.mutate(notaDevolvida);
    toast.success('Nota registrada como devolução total.');
  };

  const handleSubmitNota = () => {
    // Validações
    if (!codigoNota || !valorTotal || !valorPagamento1) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const vTotal = parseValorFormatado(valorTotal);
    const vPag1 = parseValorFormatado(valorPagamento1);
    const vPag2 = valorPagamento2 ? parseValorFormatado(valorPagamento2) : 0;

    // Validação com tolerância para problemas de precisão de ponto flutuante
    const soma = Math.round((vPag1 + vPag2) * 100) / 100;
    const total = Math.round(vTotal * 100) / 100;
    
    if (Math.abs(soma - total) > 0.01) {
      toast.error('A soma dos pagamentos deve ser igual ao valor total');
      return;
    }

    if (valorPagamento2 && !formaPagamento2) {
      toast.error('Selecione a forma de pagamento 2');
      return;
    }

    const notaData = {
      representante_id: user!.id,
      data: dateStr,
      codigo_nota: codigoNota,
      valor_total: vTotal,
      forma_pagamento_1: formaPagamento1,
      valor_pagamento_1: vPag1,
      forma_pagamento_2: formaPagamento2 || null,
      valor_pagamento_2: vPag2 > 0 ? vPag2 : null,
    };

    if (editingNota) {
      updateNotaMutation.mutate({ id: editingNota.id, ...notaData });
    } else {
      addNotaMutation.mutate(notaData);
    }
  };

  const handleFinalizarDia = () => {
    // Permite finalizar mesmo sem cobranças (apenas despesas ou entregas)
    finalizarDiaMutation.mutate();
  };

  const totalCobradoCalculado = notas.reduce((acc, nota) => acc + nota.valor_total, 0);
  const totalNotasDoDia = notas.length;
  
  // Calcular totais por forma de pagamento automaticamente
  const totaisPorFormaPagamento = notas.reduce((acc, nota) => {
    // Soma pagamento 1
    acc[nota.forma_pagamento_1] = (acc[nota.forma_pagamento_1] || 0) + nota.valor_pagamento_1;
    
    // Soma pagamento 2 se existir
    if (nota.forma_pagamento_2 && nota.valor_pagamento_2) {
      acc[nota.forma_pagamento_2] = (acc[nota.forma_pagamento_2] || 0) + nota.valor_pagamento_2;
    }
    
    return acc;
  }, {} as Record<string, number>);
  
  const totalPixCalculado = totaisPorFormaPagamento['pix'] || 0;
  const totalDinheiroCalculado = totaisPorFormaPagamento['dinheiro'] || 0;
  const totalCartaoCalculado = totaisPorFormaPagamento['cartao'] || 0;
  const totalTransferenciaCalculado = totaisPorFormaPagamento['transferencia'] || 0;
  
  const isDiaFinalizado = cobrancaDiaria?.finalizado;

  const handleOpenHistoricoDialog = (date: string) => {
    setSelectedHistoricoDate(date);
    setHistoricoDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cobrança Diária</h1>
          <p className="text-muted-foreground">Registre suas notas promissórias e finalize o dia</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[240px] justify-start">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
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

      {/* Notas Promissórias */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Notas Promissórias do Dia</CardTitle>
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
        </CardHeader>
        <CardContent>
          {loadingNotas ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : notas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma nota promissória registrada para este dia
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Pagamento 1</TableHead>
                  <TableHead>Pagamento 2</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notas.map((nota) => (
                  <TableRow key={nota.id}>
                    <TableCell className="font-medium">{nota.codigo_nota}</TableCell>
                    <TableCell>{formatarValor(nota.valor_total)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {formaPagamentoLabels[nota.forma_pagamento_1]}: {formatarValor(nota.valor_pagamento_1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {nota.forma_pagamento_2 && nota.valor_pagamento_2 ? (
                        <Badge variant="secondary">
                          {formaPagamentoLabels[nota.forma_pagamento_2]}: {formatarValor(nota.valor_pagamento_2)}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenNotaDialog(nota)}
                          disabled={isDiaFinalizado}
                        >
                          Editar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              disabled={isDiaFinalizado}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Nota Promissória</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir a nota {nota.codigo_nota}? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteNotaMutation.mutate(nota.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Fechamento do Dia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Fechamento do Dia
            {isDiaFinalizado && (
              <Badge variant="default" className="ml-2">
                <Lock className="h-3 w-3 mr-1" />
                Finalizado
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="total_pix">Total PIX</Label>
              <Input
                id="total_pix"
                type="text"
                value={formatarValor(totalPixCalculado)}
                readOnly
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="total_dinheiro">Total Dinheiro</Label>
              <Input
                id="total_dinheiro"
                type="text"
                value={formatarValor(totalDinheiroCalculado)}
                readOnly
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="total_cartao">Total Cartão</Label>
              <Input
                id="total_cartao"
                type="text"
                value={formatarValor(totalCartaoCalculado)}
                readOnly
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="despesa_cobranca">Despesa de Cobrança</Label>
              <div className="relative">
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
          </div>

          <div className="space-y-4">
            {/* Resumo Financeiro */}
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <p className="text-sm text-muted-foreground">Total de notas cobradas</p>
                <p className="text-xl font-bold">{formatarNumero(totalNotasDoDia)}</p>
              </div>
              
              <div className="flex items-center justify-between border-b border-border pb-2">
                <p className="text-sm text-muted-foreground">Total Cobrado (soma das notas)</p>
                <p className="text-xl font-bold">{formatarValor(totalCobradoCalculado)}</p>
              </div>
              
              {despesaCobranca && parseFloat(despesaCobranca) > 0 && (
                <>
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <p className="text-sm text-muted-foreground">Despesa de Cobrança</p>
                    <p className="text-xl font-semibold text-destructive">- {formatarValor(parseFloat(despesaCobranca))}</p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-sm font-semibold text-foreground">Saldo Final</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatarValor(totalCobradoCalculado - parseFloat(despesaCobranca))}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Resumo de Entregas de Kits do Dia */}
            {entregasDoDia.length > 0 && (
              <>
                <div 
                  className="p-4 bg-primary/10 rounded-lg cursor-pointer hover:bg-primary/20 transition-colors"
                  onClick={() => setIsEntregasDialogOpen(true)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      <span className="font-semibold">Kits Entregues Hoje</span>
                    </div>
                    <Badge variant="default" className="text-lg px-3 py-1">
                      {entregasDoDia.length}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Clique para ver detalhes</p>
                </div>

                {/* Dialog de lista de entregas */}
                <Dialog open={isEntregasDialogOpen} onOpenChange={setIsEntregasDialogOpen}>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Entregas de Kits - {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {entregasDoDia.map((entrega: any) => (
                        <div key={entrega.id} className="p-3 bg-muted rounded-lg flex justify-between items-center">
                          <div>
                            <p className="font-medium">{entrega.revendedora}</p>
                            <p className="text-sm text-muted-foreground">Kit: {entrega.codigo_nota}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{formatarValor(entrega.valor_previsto)}</p>
                            <p className="text-xs text-muted-foreground">
                              Venc: {format(new Date(entrega.data_agendada + 'T12:00:00'), "dd/MM/yyyy")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsEntregasDialogOpen(false)}>
                        Fechar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {/* Botão Registrar Entrega de Kit */}
            {!isDiaFinalizado && (
              <Dialog open={isKitEntregaDialogOpen} onOpenChange={setIsKitEntregaDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="lg" className="w-full" onClick={resetKitEntregaForm}>
                    <Package className="h-4 w-4 mr-2" />
                    Registrar Entrega de Kit ({kitsEstoque.length} em posse)
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

            {/* Botão Finalizar */}
            {!isDiaFinalizado && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="lg" className="w-full">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Finalizar Dia
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Finalizar Cobrança Diária</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja finalizar o dia? Após finalizar, não será possível adicionar ou editar notas promissórias para esta data.
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
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Fechamentos */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Fechamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum fechamento registrado ainda
            </div>
          ) : (
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
                        style={{ cursor: 'pointer' }}
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
          )}
        </CardContent>
      </Card>

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
                  <div>
                    <p className="text-sm text-muted-foreground">Total PIX</p>
                    <p className="text-lg font-semibold">
                      {formatarValor(
                        notasHistorico.reduce((acc, n) => {
                          let total = 0;
                          if (n.forma_pagamento_1 === 'pix') total += n.valor_pagamento_1;
                          if (n.forma_pagamento_2 === 'pix' && n.valor_pagamento_2) total += n.valor_pagamento_2;
                          return acc + total;
                        }, 0)
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Dinheiro</p>
                    <p className="text-lg font-semibold">
                      {formatarValor(
                        notasHistorico.reduce((acc, n) => {
                          let total = 0;
                          if (n.forma_pagamento_1 === 'dinheiro') total += n.valor_pagamento_1;
                          if (n.forma_pagamento_2 === 'dinheiro' && n.valor_pagamento_2) total += n.valor_pagamento_2;
                          return acc + total;
                        }, 0)
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Cartão</p>
                    <p className="text-lg font-semibold">
                      {formatarValor(
                        notasHistorico.reduce((acc, n) => {
                          let total = 0;
                          if (n.forma_pagamento_1 === 'cartao') total += n.valor_pagamento_1;
                          if (n.forma_pagamento_2 === 'cartao' && n.valor_pagamento_2) total += n.valor_pagamento_2;
                          return acc + total;
                        }, 0)
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Transferência</p>
                    <p className="text-lg font-semibold">
                      {formatarValor(
                        notasHistorico.reduce((acc, n) => {
                          let total = 0;
                          if (n.forma_pagamento_1 === 'transferencia') total += n.valor_pagamento_1;
                          if (n.forma_pagamento_2 === 'transferencia' && n.valor_pagamento_2) total += n.valor_pagamento_2;
                          return acc + total;
                        }, 0)
                      )}
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
