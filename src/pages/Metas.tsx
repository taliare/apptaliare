import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Plus, TrendingUp, TrendingDown, Minus, Award, Package, Edit, Trash2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarValor, getLocalDateString, getLocalMonthString } from '@/lib/utils';

interface MetaCobranca {
  id: string;
  representante_id: string;
  ano_mes: string;
  meta_valor: number;
  ativo: boolean | null;
  criado_em: string | null;
}

interface MetaProducao {
  id: string;
  ano_mes: string;
  meta_kits: number;
  observacao: string | null;
  criado_em: string | null;
}

interface Profile {
  id: string;
  nome: string;
  email: string | null;
}

interface CobrancaDiaria {
  total_cobrado: number;
}

export default function Metas() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === 'admin';
  
  // Estados para metas de representantes
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState<MetaCobranca | null>(null);
  const [selectedRepresentante, setSelectedRepresentante] = useState('');
  const [selectedMes, setSelectedMes] = useState(format(new Date(), 'yyyy-MM'));
  const [metaValor, setMetaValor] = useState('');

  // Estados para metas de produção
  const [isProducaoDialogOpen, setIsProducaoDialogOpen] = useState(false);
  const [editingMetaProducao, setEditingMetaProducao] = useState<MetaProducao | null>(null);
  const [producaoMes, setProducaoMes] = useState(format(new Date(), 'yyyy-MM'));
  const [producaoMetaKits, setProducaoMetaKits] = useState('');
  const [producaoObservacao, setProducaoObservacao] = useState('');

  // Query for representantes (apenas admin) — somente usuários com role 'representante' (inclui inativos)
  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes'],
    queryFn: async () => {
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'representante');

      if (rolesError) throw rolesError;

      const representanteIds = rolesData.map(r => r.user_id);
      if (representanteIds.length === 0) return [] as Profile[];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .in('id', representanteIds)
        .order('nome');

      if (error) throw error;
      return data as Profile[];
    },
    enabled: isAdmin,
  });

  // Query for metas
  const { data: metas = [], isLoading } = useQuery({
    queryKey: ['metas-cobranca', user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from('metas_cobranca')
        .select('*')
        .order('ano_mes', { ascending: false });

      if (!isAdmin) {
        query = query.eq('representante_id', user!.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as MetaCobranca[];
    },
    enabled: !!user?.id,
  });

  // Query for metas de produção
  const { data: metasProducao = [] } = useQuery({
    queryKey: ['metas-producao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metas_producao')
        .select('*')
        .order('ano_mes', { ascending: false });
      
      if (error) throw error;
      return data as MetaProducao[];
    },
    enabled: isAdmin,
  });

  // Query for cobranças do mês atual
  const mesAtualCalculo = getLocalMonthString();
  const { data: cobrancasDoMes = [] } = useQuery({
    queryKey: ['cobrancas-mes-atual', mesAtualCalculo],
    queryFn: async () => {
      const inicio = getLocalDateString(startOfMonth(new Date()));
      const fim = getLocalDateString(endOfMonth(new Date()));

      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('representante_id, total_cobrado')
        .gte('data', inicio)
        .lte('data', fim);
      
      if (error) throw error;
      return data as (CobrancaDiaria & { representante_id: string })[];
    },
  });

  // Mutation para adicionar/atualizar meta de representante
  const saveMetaMutation = useMutation({
    mutationFn: async (meta: Omit<MetaCobranca, 'id' | 'criado_em'>) => {
      const { data: existing } = await supabase
        .from('metas_cobranca')
        .select('id')
        .eq('representante_id', meta.representante_id)
        .eq('ano_mes', meta.ano_mes)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('metas_cobranca')
          .update(meta)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('metas_cobranca')
          .insert(meta)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metas-cobranca'] });
      toast.success('Meta salva com sucesso!');
      resetForm();
      setIsDialogOpen(false);
      setEditingMeta(null);
    },
    onError: (error) => {
      toast.error(`Erro ao salvar meta: ${error.message}`);
    },
  });

  // Mutation para deletar meta de representante
  const deleteMetaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('metas_cobranca')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metas-cobranca'] });
      toast.success('Meta excluída com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao excluir meta: ${error.message}`);
    },
  });

  // Mutation para salvar meta de produção
  const saveMetaProducaoMutation = useMutation({
    mutationFn: async (meta: { ano_mes: string; meta_kits: number; observacao: string | null }) => {
      const { data: existing } = await supabase
        .from('metas_producao')
        .select('id')
        .eq('ano_mes', meta.ano_mes)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('metas_producao')
          .update(meta)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('metas_producao')
          .insert(meta)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metas-producao'] });
      toast.success('Meta de produção salva!');
      resetProducaoForm();
      setIsProducaoDialogOpen(false);
      setEditingMetaProducao(null);
    },
    onError: (error) => {
      toast.error(`Erro ao salvar meta: ${error.message}`);
    },
  });

  // Mutation para deletar meta de produção
  const deleteMetaProducaoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('metas_producao')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metas-producao'] });
      toast.success('Meta de produção excluída!');
    },
    onError: (error) => {
      toast.error(`Erro ao excluir meta: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSelectedRepresentante('');
    setSelectedMes(format(new Date(), 'yyyy-MM'));
    setMetaValor('');
  };

  const resetProducaoForm = () => {
    setProducaoMes(format(new Date(), 'yyyy-MM'));
    setProducaoMetaKits('');
    setProducaoObservacao('');
  };

  const handleOpenDialog = (meta?: MetaCobranca) => {
    if (meta) {
      setEditingMeta(meta);
      setSelectedRepresentante(meta.representante_id);
      setSelectedMes(meta.ano_mes);
      setMetaValor(meta.meta_valor.toString());
    } else {
      resetForm();
      setEditingMeta(null);
    }
    setIsDialogOpen(true);
  };

  const handleOpenProducaoDialog = (meta?: MetaProducao) => {
    if (meta) {
      setEditingMetaProducao(meta);
      setProducaoMes(meta.ano_mes);
      setProducaoMetaKits(meta.meta_kits.toString());
      setProducaoObservacao(meta.observacao || '');
    } else {
      resetProducaoForm();
      setEditingMetaProducao(null);
    }
    setIsProducaoDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!metaValor || parseFloat(metaValor) <= 0) {
      toast.error('Informe um valor válido para a meta');
      return;
    }

    if (isAdmin && !selectedRepresentante) {
      toast.error('Selecione um representante');
      return;
    }

    const metaData = {
      representante_id: isAdmin ? selectedRepresentante : user!.id,
      ano_mes: selectedMes,
      meta_valor: parseFloat(metaValor),
      ativo: true,
    };

    saveMetaMutation.mutate(metaData);
  };

  const handleSubmitProducao = () => {
    if (!producaoMetaKits || parseInt(producaoMetaKits) <= 0) {
      toast.error('Informe uma quantidade válida para a meta');
      return;
    }

    saveMetaProducaoMutation.mutate({
      ano_mes: producaoMes,
      meta_kits: parseInt(producaoMetaKits),
      observacao: producaoObservacao.trim() || null,
    });
  };

  // Calcula os dados por representante
  const metasPorRepresentante = useMemo(() => {
    const mesAtual = format(new Date(), 'yyyy-MM');
    const metasDoMes = metas.filter(m => m.ano_mes === mesAtual && m.ativo);

    return metasDoMes.map(meta => {
      const representante = representantes.find(r => r.id === meta.representante_id);
      const cobrancasRep = cobrancasDoMes.filter(c => c.representante_id === meta.representante_id);
      const realizado = cobrancasRep.reduce((sum, c) => sum + c.total_cobrado, 0);
      const percentual = meta.meta_valor > 0 ? (realizado / meta.meta_valor) * 100 : 0;
      const atingida = percentual >= 100;

      return {
        meta,
        representante,
        realizado,
        percentual,
        atingida,
      };
    });
  }, [metas, representantes, cobrancasDoMes]);

  // Estatísticas gerais
  const estatisticas = useMemo(() => {
    const totalMetas = metasPorRepresentante.length;
    const metasAtingidas = metasPorRepresentante.filter(m => m.atingida).length;
    const taxaCumprimento = totalMetas > 0 ? (metasAtingidas / totalMetas) * 100 : 0;
    
    const melhorRep = metasPorRepresentante.reduce((best, current) => {
      return current.percentual > (best?.percentual || 0) ? current : best;
    }, metasPorRepresentante[0]);

    return {
      totalMetas,
      metasAtingidas,
      taxaCumprimento,
      melhorRep,
    };
  }, [metasPorRepresentante]);

  const getStatusIcon = (percentual: number) => {
    if (percentual >= 100) return <Award className="h-4 w-4 text-green-600" />;
    if (percentual >= 70) return <TrendingUp className="h-4 w-4 text-blue-600" />;
    if (percentual >= 40) return <Minus className="h-4 w-4 text-yellow-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  if (!isAdmin) {
    // Visão do Representante
    const minhasMetas = metas.filter(m => m.representante_id === user?.id);
    const metaAtual = minhasMetas.find(m => m.ano_mes === format(new Date(), 'yyyy-MM'));
    const cobrancasMinhas = cobrancasDoMes.filter(c => c.representante_id === user?.id);
    const realizado = cobrancasMinhas.reduce((sum, c) => sum + c.total_cobrado, 0);
    const percentual = metaAtual ? (realizado / metaAtual.meta_valor) * 100 : 0;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Minhas Metas</h1>
          <p className="text-muted-foreground">Acompanhe seu desempenho mensal</p>
        </div>

        {metaAtual ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Meta do Mês Atual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Meta</p>
                    <p className="text-2xl font-bold">{formatarValor(metaAtual.meta_valor)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Realizado</p>
                    <p className="text-2xl font-bold">{formatarValor(realizado)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Faltam</p>
                    <p className="text-2xl font-bold">
                      {formatarValor(Math.max(0, metaAtual.meta_valor - realizado))}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progresso</span>
                    <span className="font-medium">{percentual.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(percentual, 100)} />
                </div>

                {percentual >= 100 && (
                  <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <Award className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-600">
                      Parabéns! Você atingiu sua meta!
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de Metas</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Meta</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {minhasMetas.map(meta => (
                      <TableRow key={meta.id}>
                        <TableCell>
                          {format(new Date(meta.ano_mes + '-01'), "MMMM 'de' yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{formatarValor(meta.meta_valor)}</TableCell>
                        <TableCell>
                          <Badge variant={meta.ativo ? 'default' : 'secondary'}>
                            {meta.ativo ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
                <Target className="h-16 w-16 mb-4" />
                <p className="text-lg">Nenhuma meta definida para este mês</p>
                <p className="text-sm">Aguarde seu administrador definir sua meta</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Visão do Admin com Tabs
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Gestão de Metas</h1>
        <p className="text-muted-foreground">Defina metas para representantes e produção</p>
      </div>

      <Tabs defaultValue="representantes" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="representantes" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Representantes
          </TabsTrigger>
          <TabsTrigger value="producao" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Produção
          </TabsTrigger>
        </TabsList>

        {/* Tab de Metas de Representantes */}
        <TabsContent value="representantes" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Meta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingMeta ? 'Editar Meta' : 'Definir Nova Meta'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="representante">Representante *</Label>
                    <Select 
                      value={selectedRepresentante} 
                      onValueChange={setSelectedRepresentante}
                      disabled={!!editingMeta}
                    >
                      <SelectTrigger id="representante">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {representantes.map(rep => (
                          <SelectItem key={rep.id} value={rep.id}>
                            {rep.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="mes">Mês/Ano *</Label>
                    <Input
                      id="mes"
                      type="month"
                      value={selectedMes}
                      onChange={(e) => setSelectedMes(e.target.value)}
                      disabled={!!editingMeta}
                    />
                  </div>

                  <div>
                    <Label htmlFor="valor">Valor da Meta *</Label>
                    <Input
                      id="valor"
                      type="number"
                      step="0.01"
                      value={metaValor}
                      onChange={(e) => setMetaValor(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit}>
                    {editingMeta ? 'Atualizar' : 'Definir Meta'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Cards de Estatísticas */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Metas</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{estatisticas.totalMetas}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Metas Atingidas</CardTitle>
                <Award className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{estatisticas.metasAtingidas}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Cumprimento</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{estatisticas.taxaCumprimento.toFixed(1)}%</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Melhor Representante</CardTitle>
                <Award className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium truncate">
                  {estatisticas.melhorRep?.representante?.nome || '-'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {estatisticas.melhorRep?.percentual.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Grid de Metas por Representante */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {metasPorRepresentante.map(({ meta, representante, realizado, percentual, atingida }) => (
              <Card key={meta.id} className={atingida ? 'border-green-600' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-lg truncate">{representante?.nome}</span>
                    {getStatusIcon(percentual)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Meta</p>
                      <p className="font-medium">{formatarValor(meta.meta_valor)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Realizado</p>
                      <p className="font-medium">{formatarValor(realizado)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">{percentual.toFixed(1)}%</span>
                    </div>
                    <Progress value={Math.min(percentual, 100)} />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleOpenDialog(meta)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMetaMutation.mutate(meta.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {metasPorRepresentante.length === 0 && !isLoading && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
                  <Target className="h-16 w-16 mb-4" />
                  <p className="text-lg">Nenhuma meta definida para o mês atual</p>
                  <p className="text-sm">Clique em "Nova Meta" para começar</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab de Metas de Produção */}
        <TabsContent value="producao" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={isProducaoDialogOpen} onOpenChange={setIsProducaoDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenProducaoDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Meta Produção
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingMetaProducao ? 'Editar Meta de Produção' : 'Definir Meta de Produção'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="producao-mes">Mês/Ano *</Label>
                    <Input
                      id="producao-mes"
                      type="month"
                      value={producaoMes}
                      onChange={(e) => setProducaoMes(e.target.value)}
                      disabled={!!editingMetaProducao}
                    />
                  </div>

                  <div>
                    <Label htmlFor="producao-kits">Quantidade de Kits *</Label>
                    <Input
                      id="producao-kits"
                      type="number"
                      value={producaoMetaKits}
                      onChange={(e) => setProducaoMetaKits(e.target.value)}
                      placeholder="Ex: 100"
                    />
                  </div>

                  <div>
                    <Label htmlFor="producao-obs">Observação</Label>
                    <Textarea
                      id="producao-obs"
                      value={producaoObservacao}
                      onChange={(e) => setProducaoObservacao(e.target.value)}
                      placeholder="Instruções ou observações para a equipe de produção..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsProducaoDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmitProducao}>
                    {editingMetaProducao ? 'Atualizar' : 'Definir Meta'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Lista de Metas de Produção */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Metas de Produção
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metasProducao.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4" />
                  <p>Nenhuma meta de produção definida</p>
                  <p className="text-sm">Clique em "Nova Meta Produção" para começar</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Meta (Kits)</TableHead>
                      <TableHead>Observação</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metasProducao.map(meta => (
                      <TableRow key={meta.id}>
                        <TableCell className="font-medium">
                          {format(new Date(meta.ano_mes + '-01'), "MMMM 'de' yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{meta.meta_kits} kits</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {meta.observacao || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenProducaoDialog(meta)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteMetaProducaoMutation.mutate(meta.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
