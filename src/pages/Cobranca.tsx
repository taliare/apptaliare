import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarIcon, Plus, Filter, DollarSign, Clock, User, Edit, Trash2, CreditCard, CalendarDays, FileText, Package } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format, isToday, isBefore, isAfter, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import type { Database } from '@/integrations/supabase/types';
import { formatarValor } from '@/lib/utils';
import { ModalReceberCobranca } from '@/components/cobranca/ModalReceberCobranca';
import { ModalSenhaAdmin } from '@/components/cobranca/ModalSenhaAdmin';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
};

export default function Cobranca() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCobranca, setEditingCobranca] = useState<Cobranca | null>(null);
  const [filtroAtivo, setFiltroAtivo] = useState<'todas' | 'vencidas' | 'hoje' | 'proximos7'>('todas');
  
  // Modais de pagamento, senha e reagendamento
  const [cobrancaParaPagar, setCobrancaParaPagar] = useState<Cobranca | null>(null);
  const [modalSenhaOpen, setModalSenhaOpen] = useState(false);
  const [acaoSenha, setAcaoSenha] = useState<'editar' | 'excluir'>('editar');
  const [cobrancaParaExcluir, setCobrancaParaExcluir] = useState<string | null>(null);
  const [modalReagendarOpen, setModalReagendarOpen] = useState(false);
  const [cobrancaParaReagendar, setCobrancaParaReagendar] = useState<Cobranca | null>(null);
  const [novaDataAgendada, setNovaDataAgendada] = useState<Date>();
  
  const [formData, setFormData] = useState<CobrancaFormData>({
    revendedora: '',
    codigo_nota: '',
    tipo: '',
    valor_previsto: '',
    data_agendada: format(new Date(), 'yyyy-MM-dd'),
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

  const createMutation = useMutation({
    mutationFn: async (data: CobrancaFormData) => {
      const valorNumerico = parseValorFormatado(data.valor_previsto);
      
      const { error } = await supabase.from('cobrancas_agendadas').insert({
        revendedora: data.revendedora,
        codigo_nota: data.codigo_nota || null,
        tipo: data.tipo || null,
        valor_previsto: valorNumerico,
        data_agendada: data.data_agendada,
        observacoes: data.observacoes,
        representante_id: userId!,
        status: 'pendente'
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      toast({ title: 'Cobrança criada com sucesso!' });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao criar cobrança', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CobrancaFormData }) => {
      const valorNumerico = parseValorFormatado(data.valor_previsto);
      
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .update({
          revendedora: data.revendedora,
          codigo_nota: data.codigo_nota || null,
          tipo: data.tipo || null,
          valor_previsto: valorNumerico,
          data_agendada: data.data_agendada,
          observacoes: data.observacoes,
        })
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
    onError: () => {
      toast({ title: 'Erro ao atualizar cobrança', variant: 'destructive' });
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
  }) => {
    try {
      const cobranca = cobrancas.find(c => c.id === cobrancaId);
      const dataHoje = format(new Date(), 'yyyy-MM-dd');
      
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
          data_execucao: dataHoje
        });

      if (prestacaoError) throw prestacaoError;

      // 2. Criar nota promissória para alimentar a Cobrança Diária
      if (dados.tipo === 'completo' && dados.pagamentos.length > 0) {
        const { error: notaError } = await supabase
          .from('notas_promissorias')
          .insert({
            representante_id: userId!,
            codigo_nota: `${cobranca?.revendedora || ''}-${format(new Date(), 'ddMMyyyyHHmmss')}`,
            data: dataHoje,
            valor_total: dados.valor_devido_empresa,
            forma_pagamento_1: dados.pagamentos[0].forma,
            valor_pagamento_1: dados.pagamentos[0].valor,
            forma_pagamento_2: dados.pagamentos[1]?.forma || null,
            valor_pagamento_2: dados.pagamentos[1]?.valor || null
          });

        if (notaError) throw notaError;
      }

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

  // Função para processar pagamento parcial e criar repasse
  const handlePagamentoParcial = async (cobrancaId: string, dados: {
    valor_venda: number;
    comissao_percentual: number;
    comissao_valor: number;
    valor_devido_empresa: number;
    valor_recebido: number;
    pagamentos: Array<{ forma: any; valor: number }>;
    valor_repasse: number;
    data_repasse: Date;
  }) => {
    try {
      const cobranca = cobrancas.find(c => c.id === cobrancaId);
      const dataHoje = format(new Date(), 'yyyy-MM-dd');
      
      // 1. Criar prestação de contas com saldo devedor
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
          data_execucao: dataHoje
        });

      if (prestacaoError) throw prestacaoError;

      // 2. Criar nota promissória para alimentar a Cobrança Diária (valor parcial recebido)
      if (dados.pagamentos.length > 0) {
        const { error: notaError } = await supabase
          .from('notas_promissorias')
          .insert({
            representante_id: userId!,
            codigo_nota: `${cobranca?.revendedora || ''}-${format(new Date(), 'ddMMyyyyHHmmss')}`,
            data: dataHoje,
            valor_total: dados.valor_recebido,
            forma_pagamento_1: dados.pagamentos[0].forma,
            valor_pagamento_1: dados.pagamentos[0].valor,
            forma_pagamento_2: dados.pagamentos[1]?.forma || null,
            valor_pagamento_2: dados.pagamentos[1]?.valor || null
          });

        if (notaError) throw notaError;
      }

      // 3. Criar repasse
      const { error: repasseError } = await supabase
        .from('repasses')
        .insert({
          cobranca_id: cobrancaId,
          valor_repasse: dados.valor_repasse,
          data_repasse: format(dados.data_repasse, 'yyyy-MM-dd'),
          status: 'agendado'
        });

      if (repasseError) throw repasseError;

      // 4. Atualizar status da cobrança para 'parcial' e data para data do repasse
      const { error: updateError } = await supabase
        .from('cobrancas_agendadas')
        .update({ 
          status: 'parcial',
          data_agendada: format(dados.data_repasse, 'yyyy-MM-dd')
        })
        .eq('id', cobrancaId);

      if (updateError) throw updateError;

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
    setNovaDataAgendada(new Date(cobranca.data_agendada));
    setModalReagendarOpen(true);
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

  const handleConfirmarReagendamento = () => {
    if (!cobrancaParaReagendar || !novaDataAgendada) return;
    
    reagendarMutation.mutate({
      id: cobrancaParaReagendar.id,
      novaData: format(novaDataAgendada, 'yyyy-MM-dd')
    });
  };

  const resetForm = () => {
    setFormData({
      revendedora: '',
      codigo_nota: '',
      tipo: '',
      valor_previsto: '',
      data_agendada: format(new Date(), 'yyyy-MM-dd'),
      observacoes: '',
    });
  };

  // Funções de filtragem por data
  const hoje = startOfDay(new Date());
  const proximos7Dias = addDays(hoje, 7);

  const cobrancasVencidas = cobrancas.filter(c => 
    isBefore(new Date(c.data_agendada), hoje)
  );
  
  const cobrancasHoje = cobrancas.filter(c => 
    isToday(new Date(c.data_agendada))
  );
  
  const cobrancasProximos7 = cobrancas.filter(c => {
    const data = new Date(c.data_agendada);
    return isAfter(data, hoje) && !isToday(data) && isBefore(data, proximos7Dias);
  });

  const cobrancasFiltradas = (() => {
    switch (filtroAtivo) {
      case 'vencidas':
        return cobrancasVencidas;
      case 'hoje':
        return cobrancasHoje;
      case 'proximos7':
        return cobrancasProximos7;
      default:
        return cobrancas;
    }
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando cobranças...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Agenda de Cobranças</h1>
          <p className="text-muted-foreground">Organize suas cobranças por data de vencimento</p>
        </div>
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

      {/* Filtros Rápidos */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <Button
              variant={filtroAtivo === 'todas' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroAtivo('todas')}
            >
              Todas ({cobrancas.length})
            </Button>
            <Button
              variant={filtroAtivo === 'vencidas' ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setFiltroAtivo('vencidas')}
            >
              Vencidas ({cobrancasVencidas.length})
            </Button>
            <Button
              variant={filtroAtivo === 'hoje' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroAtivo('hoje')}
            >
              Hoje ({cobrancasHoje.length})
            </Button>
            <Button
              variant={filtroAtivo === 'proximos7' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroAtivo('proximos7')}
            >
              Próximos 7 dias ({cobrancasProximos7.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Agenda de Cobranças */}
      <div className="space-y-4">
        {/* Vencidas */}
        {(filtroAtivo === 'todas' || filtroAtivo === 'vencidas') && cobrancasVencidas.length > 0 && (
          <Card className="border-destructive">
            <CardHeader className="bg-destructive/10">
              <CardTitle className="text-destructive flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Cobranças Vencidas ({cobrancasVencidas.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {cobrancasVencidas.map((cobranca) => (
                <CobrancaItem
                  key={cobranca.id}
                  cobranca={cobranca}
                  onEdit={handleEdit}
                  onPagar={handlePagarClick}
                  onReagendar={handleReagendarClick}
                  destacarVencida
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Hoje */}
        {(filtroAtivo === 'todas' || filtroAtivo === 'hoje') && cobrancasHoje.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Hoje - {format(hoje, "dd/MM/yyyy", { locale: ptBR })} ({cobrancasHoje.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {cobrancasHoje.map((cobranca) => (
                <CobrancaItem
                  key={cobranca.id}
                  cobranca={cobranca}
                  onEdit={handleEdit}
                  onPagar={handlePagarClick}
                  onReagendar={handleReagendarClick}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Próximos 7 dias */}
        {(filtroAtivo === 'todas' || filtroAtivo === 'proximos7') && cobrancasProximos7.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Próximos 7 dias ({cobrancasProximos7.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {cobrancasProximos7.map((cobranca) => (
                <CobrancaItem
                  key={cobranca.id}
                  cobranca={cobranca}
                  onEdit={handleEdit}
                  onPagar={handlePagarClick}
                  onReagendar={handleReagendarClick}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Lista vazia */}
        {cobrancasFiltradas.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">Nenhuma cobrança encontrada</p>
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
        cobranca={cobrancaParaPagar || { id: '', revendedora: '', valor_previsto: 0 }}
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
                <p className="text-sm"><strong>Data Atual:</strong> {format(new Date(cobrancaParaReagendar.data_agendada), 'dd/MM/yyyy', { locale: ptBR })}</p>
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
    </div>
  );
}

// Componente de Item de Cobrança na Agenda
function CobrancaItem({
  cobranca,
  onEdit,
  onPagar,
  onReagendar,
  destacarVencida = false,
}: {
  cobranca: Cobranca;
  onEdit: (cobranca: Cobranca) => void;
  onPagar: (cobranca: Cobranca) => void;
  onReagendar: (cobranca: Cobranca) => void;
  destacarVencida?: boolean;
}) {
  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      destacarVencida && "border-destructive bg-destructive/5"
    )}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="font-semibold text-lg flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {cobranca.revendedora}
              </div>
              <Badge className={statusConfig[cobranca.status].color}>
                {statusConfig[cobranca.status].label}
              </Badge>
              {cobranca.tipo && (
                <Badge variant={cobranca.tipo === 'kit' ? 'default' : 'secondary'}>
                  {cobranca.tipo.toUpperCase()}
                </Badge>
              )}
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm">
              {cobranca.codigo_nota && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                    {cobranca.codigo_nota}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span className="font-medium text-foreground">{formatarValor(cobranca.valor_previsto)}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                <span className={cn(destacarVencida && "text-destructive font-medium")}>
                  {format(new Date(cobranca.data_agendada), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              </div>
            </div>

            {cobranca.observacoes && (
              <p className="text-xs text-muted-foreground">{cobranca.observacoes}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(cobranca)}>
              <Edit className="h-3 w-3 mr-1" />
              Editar
            </Button>
            <Button variant="default" size="sm" onClick={() => onPagar(cobranca)}>
              <CreditCard className="h-3 w-3 mr-1" />
              Cobrar
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onReagendar(cobranca)}>
              <CalendarDays className="h-3 w-3 mr-1" />
              Reagendar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
