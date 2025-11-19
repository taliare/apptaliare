import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Plus, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, differenceInDays, addDays, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KitEntregue {
  id: string;
  codigo_mostruario: string;
  data_entrega: string;
  data_vencimento: string;
  tipo: string | null;
  representante_id: string;
  prestacao_id: string | null;
  criado_em: string | null;
}

export default function Kits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<KitEntregue | null>(null);

  // Form states
  const [codigoMostruario, setCodigoMostruario] = useState('');
  const [dataEntrega, setDataEntrega] = useState<Date>(new Date());
  const [dataVencimento, setDataVencimento] = useState<Date>(addDays(new Date(), 60));
  const [tipo, setTipo] = useState<'renovacao' | 'novo'>('novo');

  // Query for kits
  const { data: kits = [], isLoading } = useQuery({
    queryKey: ['kits-entregues', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kits_entregues')
        .select('*')
        .eq('representante_id', user?.id)
        .order('data_vencimento', { ascending: true });
      
      if (error) throw error;
      return data as KitEntregue[];
    },
    enabled: !!user?.id,
  });

  // Mutation para adicionar kit
  const addKitMutation = useMutation({
    mutationFn: async (kit: Omit<KitEntregue, 'id' | 'criado_em' | 'prestacao_id'>) => {
      const { data, error } = await supabase
        .from('kits_entregues')
        .insert({ ...kit, prestacao_id: null })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kits-entregues'] });
      toast.success('Kit registrado com sucesso!');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Erro ao registrar kit: ${error.message}`);
    },
  });

  // Mutation para atualizar kit
  const updateKitMutation = useMutation({
    mutationFn: async ({ id, ...kit }: Partial<KitEntregue> & { id: string }) => {
      const { data, error } = await supabase
        .from('kits_entregues')
        .update(kit)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kits-entregues'] });
      toast.success('Kit atualizado com sucesso!');
      resetForm();
      setIsDialogOpen(false);
      setEditingKit(null);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar kit: ${error.message}`);
    },
  });

  const resetForm = () => {
    setCodigoMostruario('');
    setDataEntrega(new Date());
    setDataVencimento(addDays(new Date(), 60));
    setTipo('novo');
  };

  const handleOpenDialog = (kit?: KitEntregue) => {
    if (kit) {
      setEditingKit(kit);
      setCodigoMostruario(kit.codigo_mostruario);
      setDataEntrega(new Date(kit.data_entrega + 'T00:00:00'));
      setDataVencimento(new Date(kit.data_vencimento + 'T00:00:00'));
      setTipo((kit.tipo as 'renovacao' | 'novo') || 'novo');
    } else {
      resetForm();
      setEditingKit(null);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!codigoMostruario) {
      toast.error('Preencha o código do mostruário');
      return;
    }

    const kitData = {
      representante_id: user!.id,
      codigo_mostruario: codigoMostruario,
      data_entrega: format(dataEntrega, 'yyyy-MM-dd'),
      data_vencimento: format(dataVencimento, 'yyyy-MM-dd'),
      tipo,
    };

    if (editingKit) {
      updateKitMutation.mutate({ id: editingKit.id, ...kitData });
    } else {
      addKitMutation.mutate(kitData);
    }
  };

  const getKitStatus = (kit: KitEntregue) => {
    const hoje = new Date();
    const vencimento = new Date(kit.data_vencimento + 'T00:00:00');
    const diasRestantes = differenceInDays(vencimento, hoje);

    if (diasRestantes < 0) {
      return { label: 'Vencido', variant: 'destructive' as const, icon: AlertTriangle };
    } else if (diasRestantes <= 30) {
      return { label: 'Vencendo', variant: 'secondary' as const, icon: Clock };
    } else {
      return { label: 'Ativo', variant: 'default' as const, icon: CheckCircle };
    }
  };

  const kitsAtivos = kits.filter(kit => {
    const vencimento = new Date(kit.data_vencimento + 'T00:00:00');
    return isAfter(vencimento, new Date());
  });

  const kitsVencendo = kits.filter(kit => {
    const vencimento = new Date(kit.data_vencimento + 'T00:00:00');
    const diasRestantes = differenceInDays(vencimento, new Date());
    return diasRestantes >= 0 && diasRestantes <= 30;
  });

  const kitsVencidos = kits.filter(kit => {
    const vencimento = new Date(kit.data_vencimento + 'T00:00:00');
    return isBefore(vencimento, new Date());
  });

  const taxaRenovacao = kits.length > 0 
    ? ((kits.filter(k => k.tipo === 'renovacao').length / kits.length) * 100).toFixed(1)
    : '0';

  const renderKitTable = (kitsToRender: KitEntregue[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Código</TableHead>
          <TableHead>Data Entrega</TableHead>
          <TableHead>Data Vencimento</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {kitsToRender.map((kit) => {
          const status = getKitStatus(kit);
          const StatusIcon = status.icon;
          
          return (
            <TableRow key={kit.id}>
              <TableCell className="font-medium">{kit.codigo_mostruario}</TableCell>
              <TableCell>
                {format(new Date(kit.data_entrega + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
              </TableCell>
              <TableCell>
                {format(new Date(kit.data_vencimento + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {kit.tipo === 'renovacao' ? 'Renovação' : 'Novo'}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={status.variant}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenDialog(kit)}
                >
                  Editar
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Kits</h1>
          <p className="text-muted-foreground">Acompanhe renovações e entregas de mostruários</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Kit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingKit ? 'Editar Kit' : 'Registrar Nova Entrega de Kit'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="codigo">Código do Mostruário *</Label>
                <Input
                  id="codigo"
                  value={codigoMostruario}
                  onChange={(e) => setCodigoMostruario(e.target.value)}
                  placeholder="Ex: MST-001"
                />
              </div>

              <div>
                <Label>Data de Entrega *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dataEntrega, "dd/MM/yyyy", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataEntrega}
                      onSelect={(date) => date && setDataEntrega(date)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Data de Vencimento *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dataVencimento, "dd/MM/yyyy", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataVencimento}
                      onSelect={(date) => date && setDataVencimento(date)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="tipo">Tipo *</Label>
                <Select value={tipo} onValueChange={(v: 'renovacao' | 'novo') => setTipo(v)}>
                  <SelectTrigger id="tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novo">Novo</SelectItem>
                    <SelectItem value="renovacao">Renovação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit}>
                {editingKit ? 'Atualizar' : 'Registrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Kits</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kits.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kits Ativos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kitsAtivos.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencendo em 30 dias</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kitsVencendo.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Renovação</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taxaRenovacao}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Kits com Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Mostruários Entregues</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : kits.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
              <Package className="h-16 w-16 mb-4" />
              <p className="text-lg">Nenhum kit registrado</p>
              <p className="text-sm">Clique em "Novo Kit" para registrar uma entrega</p>
            </div>
          ) : (
            <Tabs defaultValue="todos" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="todos">Todos ({kits.length})</TabsTrigger>
                <TabsTrigger value="ativos">Ativos ({kitsAtivos.length})</TabsTrigger>
                <TabsTrigger value="vencendo">Vencendo ({kitsVencendo.length})</TabsTrigger>
                <TabsTrigger value="vencidos">Vencidos ({kitsVencidos.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="todos" className="mt-4">
                {renderKitTable(kits)}
              </TabsContent>
              <TabsContent value="ativos" className="mt-4">
                {kitsAtivos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum kit ativo
                  </div>
                ) : (
                  renderKitTable(kitsAtivos)
                )}
              </TabsContent>
              <TabsContent value="vencendo" className="mt-4">
                {kitsVencendo.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum kit vencendo nos próximos 30 dias
                  </div>
                ) : (
                  renderKitTable(kitsVencendo)
                )}
              </TabsContent>
              <TabsContent value="vencidos" className="mt-4">
                {kitsVencidos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum kit vencido
                  </div>
                ) : (
                  renderKitTable(kitsVencidos)
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
