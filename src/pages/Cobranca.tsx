import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Plus, Filter, DollarSign, Clock, User, Edit, Trash2, CreditCard } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  closestCorners,
  useDraggable,
  useDroppable,
  DragStartEvent
} from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';
import type { Database } from '@/integrations/supabase/types';
import { formatarValor } from '@/lib/utils';
import { ModalReceberCobranca } from '@/components/cobranca/ModalReceberCobranca';
import { ModalSenhaAdmin } from '@/components/cobranca/ModalSenhaAdmin';

type StatusCobranca = Database['public']['Enums']['status_cobranca'];
type Cobranca = Database['public']['Tables']['cobrancas_agendadas']['Row'];

interface CobrancaFormData {
  revendedora: string;
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('');
  
  // Modais de pagamento e senha
  const [cobrancaParaPagar, setCobrancaParaPagar] = useState<Cobranca | null>(null);
  const [modalSenhaOpen, setModalSenhaOpen] = useState(false);
  const [acaoSenha, setAcaoSenha] = useState<'editar' | 'excluir'>('editar');
  const [cobrancaParaExcluir, setCobrancaParaExcluir] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<CobrancaFormData>({
    revendedora: '',
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
    queryKey: ['cobrancas-agendadas', userId, dateFilter],
    queryFn: async () => {
      if (!userId) return [];
      
      let query = supabase
        .from('cobrancas_agendadas')
        .select('*')
        .eq('representante_id', userId)
        .order('data_agendada', { ascending: true });

      if (dateFilter) {
        const startDate = new Date(dateFilter);
        const endDate = new Date(dateFilter);
        endDate.setMonth(endDate.getMonth() + 1);
        
        query = query
          .gte('data_agendada', startDate.toISOString())
          .lt('data_agendada', endDate.toISOString());
      }

      const { data, error } = await query;
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
      // 1. Criar prestação de contas
      const cobranca = cobrancas.find(c => c.id === cobrancaId);
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
          data_execucao: format(new Date(), 'yyyy-MM-dd')
        });

      if (prestacaoError) throw prestacaoError;

      // 2. Atualizar status da cobrança para 'pago'
      const { error: updateError } = await supabase
        .from('cobrancas_agendadas')
        .update({ status: 'pago' })
        .eq('id', cobrancaId);

      if (updateError) throw updateError;

      await queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
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
      // 1. Criar prestação de contas com saldo devedor
      const cobranca = cobrancas.find(c => c.id === cobrancaId);
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
          data_execucao: format(new Date(), 'yyyy-MM-dd')
        });

      if (prestacaoError) throw prestacaoError;

      // 2. Criar repasse
      const { error: repasseError } = await supabase
        .from('repasses')
        .insert({
          cobranca_id: cobrancaId,
          valor_repasse: dados.valor_repasse,
          data_repasse: format(dados.data_repasse, 'yyyy-MM-dd'),
          status: 'agendado'
        });

      if (repasseError) throw repasseError;

      // 3. Atualizar status da cobrança para 'parcial' e data para data do repasse
      const { error: updateError } = await supabase
        .from('cobrancas_agendadas')
        .update({ 
          status: 'parcial',
          data_agendada: format(dados.data_repasse, 'yyyy-MM-dd')
        })
        .eq('id', cobrancaId);

      if (updateError) throw updateError;

      await queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
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
    // Verificar se precisa de senha de admin
    if (profile?.role !== 'admin') {
      setEditingCobranca(cobranca);
      setAcaoSenha('editar');
      setModalSenhaOpen(true);
    } else {
      // Admin pode editar diretamente
      setEditingCobranca(cobranca);
      setFormData({
        revendedora: cobranca.revendedora,
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
        valor_previsto: editingCobranca.valor_previsto.toFixed(2),
        data_agendada: editingCobranca.data_agendada,
        observacoes: editingCobranca.observacoes || '',
      });
      setIsDialogOpen(true);
    }
  };

  const handleDeleteClick = () => {
    if (!editingCobranca) return;
    
    // Verificar se precisa de senha de admin
    if (profile?.role !== 'admin') {
      setCobrancaParaExcluir(editingCobranca.id);
      setAcaoSenha('excluir');
      setModalSenhaOpen(true);
    } else {
      // Admin pode excluir diretamente
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

  const resetForm = () => {
    setFormData({
      revendedora: '',
      valor_previsto: '',
      data_agendada: format(new Date(), 'yyyy-MM-dd'),
      observacoes: '',
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const cobrancaId = active.id as string;
    const newStatus = over.id as StatusCobranca;
    
    const cobranca = cobrancas.find(c => c.id === cobrancaId);
    
    if (cobranca && cobranca.status !== newStatus) {
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .update({ status: newStatus })
        .eq('id', cobrancaId);

      if (error) {
        toast({
          title: 'Erro ao atualizar status',
          variant: 'destructive'
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
        toast({
          title: 'Status atualizado!',
        });
      }
    }
    
    setActiveId(null);
  };

  const getCobrancasByStatus = (status: StatusCobranca) => {
    return cobrancas.filter((c) => c.status === status);
  };

  const activeCobranca = cobrancas.find((c) => c.id === activeId);

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
          <h1 className="text-3xl font-bold">Kanban de Cobranças</h1>
          <p className="text-muted-foreground">Gerencie suas cobranças agendadas</p>
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

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <Label htmlFor="month-filter" className="text-sm">Filtrar por Mês</Label>
              <Input
                id="month-filter"
                type="month"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="max-w-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.keys(statusConfig) as StatusCobranca[]).map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              title={statusConfig[status].label}
              cobrancas={getCobrancasByStatus(status)}
              onEdit={handleEdit}
              onPagar={handlePagarClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCobranca && (
            <CobrancaCard
              cobranca={activeCobranca}
              isDragging
            />
          )}
        </DragOverlay>
      </DndContext>

      {/* Modal de Receber Cobrança */}
      {cobrancaParaPagar && (
        <ModalReceberCobranca
          open={!!cobrancaParaPagar}
          onOpenChange={(open) => !open && setCobrancaParaPagar(null)}
          cobranca={cobrancaParaPagar}
          onPagamentoCompleto={(dados) => handlePagamentoCompleto(cobrancaParaPagar.id, dados)}
          onPagamentoParcial={(dados) => handlePagamentoParcial(cobrancaParaPagar.id, dados)}
        />
      )}

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
    </div>
  );
}

// Componente de Coluna do Kanban
function KanbanColumn({
  status,
  title,
  cobrancas,
  onEdit,
  onPagar,
}: {
  status: StatusCobranca;
  title: string;
  cobrancas: Cobranca[];
  onEdit: (cobranca: Cobranca) => void;
  onPagar: (cobranca: Cobranca) => void;
}) {
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <Card ref={setNodeRef} className="h-fit min-h-[400px]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <Badge variant="secondary">{cobrancas.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {cobrancas.map((cobranca) => (
          <CobrancaCard
            key={cobranca.id}
            cobranca={cobranca}
            onEdit={onEdit}
            onPagar={onPagar}
          />
        ))}
        {cobrancas.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            Nenhuma cobrança
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Componente de Card de Cobrança
function CobrancaCard({
  cobranca,
  isDragging = false,
  onEdit,
  onPagar,
}: {
  cobranca: Cobranca;
  isDragging?: boolean;
  onEdit?: (cobranca: Cobranca) => void;
  onPagar?: (cobranca: Cobranca) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: cobranca.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-move transition-shadow hover:shadow-lg ${
        isDragging ? 'opacity-50' : ''
      }`}
      {...listeners}
      {...attributes}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {cobranca.revendedora}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-3 w-3" />
              {formatarValor(cobranca.valor_previsto)}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Clock className="h-3 w-3" />
              {format(new Date(cobranca.data_agendada), 'dd/MM/yyyy', { locale: ptBR })}
            </div>
          </div>
          <Badge className={statusConfig[cobranca.status].color}>
            {statusConfig[cobranca.status].label}
          </Badge>
        </div>

        {cobranca.observacoes && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {cobranca.observacoes}
          </p>
        )}

        {!isDragging && (onEdit || onPagar) && (
          <div className="flex gap-2 pt-2">
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(cobranca);
                }}
                className="flex-1"
              >
                <Edit className="h-3 w-3 mr-1" />
                Editar
              </Button>
            )}
            {onPagar && cobranca.status !== 'pago' && (
              <Button
                size="sm"
                variant="default"
                onClick={(e) => {
                  e.stopPropagation();
                  onPagar(cobranca);
                }}
                className="flex-1"
              >
                <CreditCard className="h-3 w-3 mr-1" />
                Pagar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
