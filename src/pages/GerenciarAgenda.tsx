import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { profilesLimited } from '@/lib/profilesLimited';
import { useToast } from '@/hooks/use-toast';
import { format, getDate, getDay, startOfMonth, getMonth, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Edit, Search, Plus, Trash2, CheckSquare, ChevronRight, Scale } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Database } from '@/integrations/supabase/types';
import { formatarValor, formatDateBR, parseLocalDate, getLocalDateString } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cobrancaInsertSchema, cobrancaUpdateSchema, validateData, sanitizeString, parseMonetaryValue } from '@/lib/validations';

type StatusCobranca = Database['public']['Enums']['status_cobranca'];
type Cobranca = Database['public']['Tables']['cobrancas_agendadas']['Row'] & {
  profiles?: { nome: string };
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500/10 text-yellow-700' },
  pago: { label: 'Pago', color: 'bg-green-500/10 text-green-700' },
  parcial: { label: 'Parcial', color: 'bg-blue-400/10 text-blue-600' },
  reagendado: { label: 'Reagendado', color: 'bg-orange-500/10 text-orange-700' },
  juridico: { label: 'Jurídico', color: 'bg-purple-500/10 text-purple-700' },
  cancelado: { label: 'Cancelado', color: 'bg-gray-500/10 text-gray-700' },
};

function getSmartStatus(cobranca: Cobranca): { label: string; color: string } {
  if (cobranca.status === 'pago') return { label: 'Pago', color: 'bg-green-500/15 text-green-700' };
  if (cobranca.status === 'parcial') return { label: 'Parcial', color: 'bg-amber-500/15 text-amber-700' };
  if (cobranca.status === 'juridico') return { label: 'Jurídico', color: 'bg-purple-500/15 text-purple-700' };
  if (cobranca.status === 'cancelado') return { label: 'Cancelado', color: 'bg-gray-500/15 text-gray-700' };
  if (cobranca.status === 'reagendado') {
    const n = cobranca.contagem_reagendamentos || 1;
    return { label: `Reagendada (${n}x)`, color: 'bg-orange-500/15 text-orange-700' };
  }
  // pendente
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataCobranca = new Date(cobranca.data_agendada + 'T12:00:00');
  if (dataCobranca < hoje) return { label: 'Vencida', color: 'bg-red-500/15 text-red-700' };
  return { label: 'A vencer', color: 'bg-blue-500/15 text-blue-700' };
}

export default function GerenciarAgenda() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCobranca, setEditingCobranca] = useState<Cobranca | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Seleção em massa
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkStatusOpen, setIsBulkStatusOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<StatusCobranca>('pendente');
  
  // Jurídico
  const [juridicoCobranca, setJuridicoCobranca] = useState<Cobranca | null>(null);
  
  // Filtros
  const [filtroRepresentante, setFiltroRepresentante] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('pendente'); // Padrão: pendente
  
  // Filtro de mês/ano - padrão: mês atual
  const [filtroMesAno, setFiltroMesAno] = useState<string>(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [formData, setFormData] = useState({
    revendedora: '',
    codigo_nota: '',
    tipo: '',
    valor_previsto: '',
    data_agendada: '',
    status: 'pendente' as StatusCobranca,
    observacoes: '',
  });

  const [createFormData, setCreateFormData] = useState({
    representante_id: '',
    revendedora: '',
    codigo_nota: '',
    tipo: 'kit',
    valor_previsto: '',
    data_agendada: getLocalDateString(),
    observacoes: '',
  });

  // Buscar representantes para filtro e cadastro
  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes-admin'],
    queryFn: async () => {
      const { data, error } = await profilesLimited()
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  const { data: cobrancas = [], isLoading } = useQuery({
    queryKey: ['todas-cobrancas-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select(`
          *,
          profiles:representante_id(nome)
        `)
        .order('data_agendada', { ascending: true });

      if (error) throw error;
      return data as Cobranca[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      // Sanitize input data
      const sanitizedData = {
        ...data,
        revendedora: data.revendedora ? sanitizeString(data.revendedora) : undefined,
        codigo_nota: data.codigo_nota ? sanitizeString(data.codigo_nota) : null,
        tipo: data.tipo ? sanitizeString(data.tipo) : null,
        observacoes: data.observacoes ? sanitizeString(data.observacoes) : null,
      };
      
      // Validate with schema
      const validation = validateData(cobrancaUpdateSchema, sanitizedData);
      if (!validation.success) {
        throw new Error((validation as { success: false; errors: string[] }).errors.join(', '));
      }
      
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .update(sanitizedData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todas-cobrancas-admin'] });
      toast({ title: 'Cobrança atualizada com sucesso!' });
      setIsDialogOpen(false);
      setEditingCobranca(null);
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
      queryClient.invalidateQueries({ queryKey: ['todas-cobrancas-admin'] });
      toast({ title: 'Cobrança excluída com sucesso!' });
      setIsDialogOpen(false);
      setEditingCobranca(null);
    },
    onError: () => {
      toast({ title: 'Erro ao excluir cobrança', variant: 'destructive' });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof createFormData) => {
      const valorNumerico = parseMonetaryValue(data.valor_previsto);
      if (valorNumerico === null) {
        throw new Error('Valor inválido');
      }
      
      // Sanitize input data
      const insertData = {
        representante_id: data.representante_id,
        revendedora: sanitizeString(data.revendedora),
        codigo_nota: data.codigo_nota ? sanitizeString(data.codigo_nota) : null,
        tipo: data.tipo ? sanitizeString(data.tipo) : null,
        valor_previsto: valorNumerico,
        data_agendada: data.data_agendada,
        status: 'pendente' as const,
        observacoes: data.observacoes ? sanitizeString(data.observacoes) : null,
      };
      
      // Validate with schema
      const validation = validateData(cobrancaInsertSchema, insertData);
      if (!validation.success) {
        throw new Error((validation as { success: false; errors: string[] }).errors.join(', '));
      }
      
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .insert(insertData);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todas-cobrancas-admin'] });
      toast({ title: 'Cobrança cadastrada com sucesso!' });
      setIsCreateDialogOpen(false);
      setCreateFormData({
        representante_id: '',
        revendedora: '',
        codigo_nota: '',
        tipo: 'kit',
        valor_previsto: '',
        data_agendada: format(new Date(), 'yyyy-MM-dd'),
        observacoes: '',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao cadastrar cobrança', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation para exclusão em massa
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .delete()
        .in('id', ids);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todas-cobrancas-admin'] });
      toast({ title: `${selectedIds.size} cobrança(s) excluída(s) com sucesso!` });
      setSelectedIds(new Set());
      setIsBulkDeleteOpen(false);
    },
    onError: () => {
      toast({ title: 'Erro ao excluir cobranças', variant: 'destructive' });
    },
  });

  // Mutation para alterar status em massa
  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: StatusCobranca }) => {
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .update({ status })
        .in('id', ids);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todas-cobrancas-admin'] });
      toast({ title: `Status de ${selectedIds.size} cobrança(s) alterado para ${statusConfig[bulkStatus].label}!` });
      setSelectedIds(new Set());
      setIsBulkStatusOpen(false);
    },
    onError: () => {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' });
    },
  });

  // Mutation para encaminhar ao jurídico
  const juridicoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .update({ 
          status: 'juridico' as StatusCobranca, 
          data_encaminhado_juridico: new Date().toISOString() 
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todas-cobrancas-admin'] });
      toast({ title: 'Cobrança encaminhada ao jurídico com sucesso!' });
      setJuridicoCobranca(null);
    },
    onError: () => {
      toast({ title: 'Erro ao encaminhar ao jurídico', variant: 'destructive' });
    },
  });

  const handleEdit = (cobranca: Cobranca) => {
    setEditingCobranca(cobranca);
    setFormData({
      revendedora: cobranca.revendedora,
      codigo_nota: cobranca.codigo_nota || '',
      tipo: cobranca.tipo || '',
      valor_previsto: cobranca.valor_previsto.toFixed(2),
      data_agendada: cobranca.data_agendada,
      status: cobranca.status,
      observacoes: cobranca.observacoes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!editingCobranca) return;

    const valorNumerico = parseFloat(formData.valor_previsto.replace(/\D/g, '')) / 100;

    updateMutation.mutate({
      id: editingCobranca.id,
      data: {
        revendedora: formData.revendedora,
        codigo_nota: formData.codigo_nota || null,
        tipo: formData.tipo || null,
        valor_previsto: valorNumerico,
        data_agendada: formData.data_agendada,
        status: formData.status,
        observacoes: formData.observacoes,
      },
    });
  };

  const handleCreate = () => {
    if (!createFormData.representante_id || !createFormData.revendedora || !createFormData.valor_previsto) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    createMutation.mutate(createFormData);
  };

  // Funções de seleção em massa
  const toggleSelectAll = () => {
    if (selectedIds.size === cobrancasFiltradas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cobrancasFiltradas.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  };

  const handleBulkStatus = () => {
    bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status: bulkStatus });
  };

  // Função para calcular a semana do mês com base na data
  const getWeekOfMonth = (dateStr: string): number => {
    const date = new Date(dateStr + 'T12:00:00');
    const dayOfMonth = getDate(date);
    const firstDayOfMonth = startOfMonth(date);
    const firstDayWeekday = getDay(firstDayOfMonth); // 0 = domingo
    
    // Semana 1: dia 1 até o primeiro domingo
    // Encontrar o primeiro domingo
    const firstSunday = firstDayWeekday === 0 ? 1 : (7 - firstDayWeekday + 1);
    
    if (dayOfMonth <= firstSunday) {
      return 1;
    }
    
    // A partir do primeiro domingo, semanas de segunda a domingo
    const daysAfterFirstSunday = dayOfMonth - firstSunday;
    const weekNumber = Math.ceil(daysAfterFirstSunday / 7) + 1;
    
    return weekNumber;
  };

  // Filtrar cobranças por mês/ano primeiro e depois por outros filtros
  const cobrancasFiltradas = cobrancas.filter((c) => {
    // Filtro de mês/ano (principal)
    const [anoFiltro, mesFiltro] = filtroMesAno.split('-').map(Number);
    const dataCobranca = new Date(c.data_agendada + 'T12:00:00');
    const mesCobranca = dataCobranca.getMonth() + 1;
    const anoCobranca = dataCobranca.getFullYear();
    
    if (anoCobranca !== anoFiltro || mesCobranca !== mesFiltro) {
      return false;
    }
    
    // Filtro de busca
    if (searchTerm) {
      const termo = searchTerm.toLowerCase();
      const matchSearch = 
        c.revendedora.toLowerCase().includes(termo) ||
        c.codigo_nota?.toLowerCase().includes(termo) ||
        (c.profiles as any)?.nome?.toLowerCase().includes(termo);
      if (!matchSearch) return false;
    }
    
    // Filtro de representante
    if (filtroRepresentante !== 'todos' && c.representante_id !== filtroRepresentante) {
      return false;
    }
    
    
    // Filtro de status
    if (filtroStatus !== 'todos' && c.status !== filtroStatus) {
      return false;
    }
    
    return true;
  });

  // Agrupar cobranças por semana
  const cobrancasPorSemana = cobrancasFiltradas.reduce((acc: Record<number, Cobranca[]>, cobranca) => {
    const semana = getWeekOfMonth(cobranca.data_agendada);
    if (!acc[semana]) {
      acc[semana] = [];
    }
    acc[semana].push(cobranca);
    return acc;
  }, {});

  // Ordenar cada semana por data
  Object.keys(cobrancasPorSemana).forEach(semana => {
    cobrancasPorSemana[Number(semana)].sort((a, b) => 
      parseLocalDate(a.data_agendada).getTime() - parseLocalDate(b.data_agendada).getTime()
    );
  });

  const semanasOrdenadas = Object.keys(cobrancasPorSemana).map(Number).sort((a, b) => a - b);

  // Estado para controlar quais semanas estão abertas - TODAS FECHADAS por padrão
  const [openWeeks, setOpenWeeks] = useState<Record<number, boolean>>({});

  const toggleWeek = (week: number) => {
    setOpenWeeks(prev => ({
      ...prev,
      [week]: !prev[week]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gerenciar Agenda de Cobranças</h1>
          <p className="text-muted-foreground">Visualize, edite e cadastre cobranças do sistema</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Cadastrar Nova Nota
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Agenda de {(() => {
              const [ano, mes] = filtroMesAno.split('-').map(Number);
              const data = new Date(ano, mes - 1, 1);
              const label = format(data, "MMMM 'de' yyyy", { locale: ptBR });
              return label.charAt(0).toUpperCase() + label.slice(1);
            })()}
          </CardTitle>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por revendedora, código da nota ou representante..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-md"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* Filtro de Mês/Ano */}
                <Select value={filtroMesAno} onValueChange={setFiltroMesAno}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Mês/Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const meses = [];
                      const hoje = new Date();
                      // Gerar 6 meses para trás e 6 meses para frente
                      for (let i = -6; i <= 6; i++) {
                        const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
                        const valor = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
                        const label = format(data, "MMMM/yyyy", { locale: ptBR });
                        meses.push({ valor, label: label.charAt(0).toUpperCase() + label.slice(1) });
                      }
                      return meses.map((m) => (
                        <SelectItem key={m.valor} value={m.valor}>{m.label}</SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
                <Select value={filtroRepresentante} onValueChange={setFiltroRepresentante}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Representante" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos Representantes</SelectItem>
                    {representantes.map((rep) => (
                      <SelectItem key={rep.id} value={rep.id}>{rep.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos Status</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="parcial">Parcial</SelectItem>
                    <SelectItem value="reagendado">Reagendado</SelectItem>
                    <SelectItem value="juridico">Jurídico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Barra de ações em massa */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <CheckSquare className="h-5 w-5 text-primary" />
                <span className="font-medium">{selectedIds.size} selecionado(s)</span>
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={() => setIsBulkStatusOpen(true)}>
                  Alterar Status
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Limpar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : cobrancasFiltradas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma cobrança encontrada
            </div>
          ) : (
            <div className="space-y-4">
              {semanasOrdenadas.map((semana) => {
                const isOpen = openWeeks[semana] ?? false;
                const notasSemana = cobrancasPorSemana[semana];
                const totalSemana = notasSemana.reduce((sum, c) => sum + c.valor_previsto, 0);
                
                return (
                  <Collapsible 
                    key={semana} 
                    open={isOpen} 
                    onOpenChange={() => toggleWeek(semana)}
                    className="group"
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 bg-card border border-border rounded-lg shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <ChevronRight 
                          className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} 
                        />
                        <div className="flex flex-col items-start">
                          <span className="font-semibold text-foreground">Semana {semana}</span>
                          <span className="text-xs text-muted-foreground">
                            {notasSemana.length} nota{notasSemana.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
                        <div className="text-right hidden sm:block">
                          <span className="text-sm font-medium text-foreground">
                            {formatarValor(totalSemana)}
                          </span>
                          <span className="text-xs text-muted-foreground block">previsto</span>
                        </div>
                        {/* Resumo de status por semana */}
                        <div className="flex items-center gap-1">
                          {(() => {
                            const pendentes = notasSemana.filter(c => c.status === 'pendente').length;
                            const pagas = notasSemana.filter(c => c.status === 'pago').length;
                            const juridico = notasSemana.filter(c => c.status === 'juridico').length;
                            return (
                              <>
                                {pendentes > 0 && (
                                  <Badge className="bg-yellow-500/10 text-yellow-700 border-0 text-xs">
                                    {pendentes} pend.
                                  </Badge>
                                )}
                                {pagas > 0 && (
                                  <Badge className="bg-green-500/10 text-green-700 border-0 text-xs">
                                    {pagas} paga{pagas !== 1 ? 's' : ''}
                                  </Badge>
                                )}
                                {juridico > 0 && (
                                  <Badge className="bg-purple-500/10 text-purple-700 border-0 text-xs">
                                    {juridico} juríd.
                                  </Badge>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                      <div className="overflow-x-auto mt-2 border border-border rounded-lg bg-card/50">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-[50px]">
                                <Checkbox
                                  checked={notasSemana.every(c => selectedIds.has(c.id))}
                                  onCheckedChange={() => {
                                    const weekIds = notasSemana.map(c => c.id);
                                    const allSelected = weekIds.every(id => selectedIds.has(id));
                                    const newSelected = new Set(selectedIds);
                                    if (allSelected) {
                                      weekIds.forEach(id => newSelected.delete(id));
                                    } else {
                                      weekIds.forEach(id => newSelected.add(id));
                                    }
                                    setSelectedIds(newSelected);
                                  }}
                                  aria-label={`Selecionar semana ${semana}`}
                                />
                              </TableHead>
                              <TableHead className="min-w-[130px]">Representante</TableHead>
                              <TableHead className="min-w-[130px]">Revendedora</TableHead>
                              <TableHead className="min-w-[90px]">Código</TableHead>
                              <TableHead className="min-w-[110px]">Valor do Kit</TableHead>
                              <TableHead className="min-w-[100px]">Pago</TableHead>
                              <TableHead className="min-w-[130px]">Saldo</TableHead>
                              <TableHead className="min-w-[110px]">Data Vencimento</TableHead>
                              <TableHead className="min-w-[120px]">Status</TableHead>
                              <TableHead className="text-right min-w-[90px]">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {notasSemana.map((cobranca) => (
                              <TableRow key={cobranca.id} className={selectedIds.has(cobranca.id) ? 'bg-primary/5' : ''}>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedIds.has(cobranca.id)}
                                    onCheckedChange={() => toggleSelect(cobranca.id)}
                                    aria-label={`Selecionar ${cobranca.revendedora}`}
                                  />
                                </TableCell>
                                <TableCell>{(cobranca.profiles as any)?.nome || 'N/A'}</TableCell>
                                <TableCell className="font-medium">{cobranca.revendedora}</TableCell>
                                <TableCell>
                                  <span className="font-mono text-xs">{cobranca.codigo_nota || '-'}</span>
                                </TableCell>
                                <TableCell>
                                  {cobranca.status === 'pendente' || cobranca.status === 'reagendado'
                                    ? formatarValor(cobranca.valor_kit_original || cobranca.valor_previsto)
                                    : '-'}
                                </TableCell>
                                <TableCell>
                                  {(cobranca.valor_pago_acumulado || 0) > 0 
                                    ? formatarValor(cobranca.valor_pago_acumulado || 0) 
                                    : '-'}
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    const status = cobranca.status;
                                    if (status === 'pago') return '-';
                                    if (status === 'parcial') {
                                      const saldo = cobranca.valor_previsto - (cobranca.valor_pago_acumulado || 0) - (cobranca.valor_adiantado || 0);
                                      return formatarValor(Math.max(0, saldo));
                                    }
                                    // pendente (A vencer / Vencida)
                                    return <span className="text-muted-foreground italic text-xs">Apuração pendente</span>;
                                  })()}
                                </TableCell>
                                <TableCell>
                                  {formatDateBR(cobranca.data_agendada)}
                                </TableCell>
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
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {['pendente', 'parcial', 'reagendado'].includes(cobranca.status) && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="text-purple-600 hover:text-purple-700 hover:bg-purple-500/10"
                                              onClick={() => setJuridicoCobranca(cobranca)}
                                            >
                                              <Scale className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Encaminhar ao Jurídico</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEdit(cobranca)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
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

      {/* Dialog de Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Cobrança</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Revendedora</Label>
                <Input
                  value={formData.revendedora}
                  onChange={(e) => setFormData({ ...formData, revendedora: e.target.value })}
                />
              </div>
              <div>
                <Label>Código da Nota</Label>
                <Input
                  value={formData.codigo_nota}
                  onChange={(e) => setFormData({ ...formData, codigo_nota: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kit">Kit</SelectItem>
                    <SelectItem value="repasse">Repasse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: StatusCobranca) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="parcial">Parcial</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="reagendado">Reagendado</SelectItem>
                    <SelectItem value="juridico">Jurídico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    R$
                  </span>
                  <Input
                    className="pl-10"
                    value={formData.valor_previsto}
                    onChange={(e) => {
                      const valor = e.target.value.replace(/\D/g, '');
                      const numero = parseFloat(valor) / 100;
                      setFormData({ ...formData, valor_previsto: numero.toFixed(2) });
                    }}
                  />
                </div>
              </div>
              <div>
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={formData.data_agendada}
                  onChange={(e) => setFormData({ ...formData, data_agendada: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Input
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir esta cobrança? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => editingCobranca && deleteMutation.mutate(editingCobranca.id)}>
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit}>Salvar Alterações</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Cadastro */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cadastrar Nova Nota</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Representante *</Label>
              <Select
                value={createFormData.representante_id}
                onValueChange={(value) => setCreateFormData({ ...createFormData, representante_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o representante" />
                </SelectTrigger>
                <SelectContent>
                  {representantes.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>{rep.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Revendedora *</Label>
                <Input
                  value={createFormData.revendedora}
                  onChange={(e) => setCreateFormData({ ...createFormData, revendedora: e.target.value })}
                />
              </div>
              <div>
                <Label>Código da Nota</Label>
                <Input
                  value={createFormData.codigo_nota}
                  onChange={(e) => setCreateFormData({ ...createFormData, codigo_nota: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={createFormData.tipo}
                  onValueChange={(value) => setCreateFormData({ ...createFormData, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kit">Kit</SelectItem>
                    <SelectItem value="repasse">Repasse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    R$
                  </span>
                  <Input
                    className="pl-10"
                    value={createFormData.valor_previsto}
                    onChange={(e) => {
                      const valor = e.target.value.replace(/\D/g, '');
                      const numero = parseFloat(valor) / 100;
                      setCreateFormData({ ...createFormData, valor_previsto: numero.toFixed(2) });
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={createFormData.data_agendada}
                  onChange={(e) => setCreateFormData({ ...createFormData, data_agendada: e.target.value })}
                />
              </div>
              <div>
                <Label>Observações</Label>
                <Input
                  value={createFormData.observacoes}
                  onChange={(e) => setCreateFormData({ ...createFormData, observacoes: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Exclusão em Massa */}
      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão em Massa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedIds.size} cobrança(s)? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir {selectedIds.size} cobrança(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Alterar Status em Massa */}
      <Dialog open={isBulkStatusOpen} onOpenChange={setIsBulkStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Status em Massa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Alterar o status de {selectedIds.size} cobrança(s) selecionada(s).
            </p>
            <div>
              <Label>Novo Status</Label>
              <Select value={bulkStatus} onValueChange={(value: StatusCobranca) => setBulkStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="reagendado">Reagendado</SelectItem>
                  <SelectItem value="juridico">Jurídico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkStatusOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkStatus}>
              Alterar Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação - Encaminhar ao Jurídico */}
      <AlertDialog open={!!juridicoCobranca} onOpenChange={(open) => !open && setJuridicoCobranca(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encaminhar ao Jurídico</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja encaminhar esta cobrança ao jurídico?
              {juridicoCobranca && (
                <div className="mt-3 space-y-1 text-sm">
                  <p><strong>Revendedora:</strong> {juridicoCobranca.revendedora}</p>
                  <p><strong>Código da Nota:</strong> {juridicoCobranca.codigo_nota || '-'}</p>
                  <p><strong>Valor:</strong> {formatarValor(juridicoCobranca.valor_previsto)}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => juridicoCobranca && juridicoMutation.mutate(juridicoCobranca.id)}
            >
              Confirmar Encaminhamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}