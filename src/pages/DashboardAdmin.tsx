import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Package, FileText, Users, TrendingDown, Factory, Warehouse } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarValor, formatarNumero } from '@/lib/utils';
import { DateRangeFilter } from '@/components/DateRangeFilter';

interface Profile {
  id: string;
  nome: string;
  email: string | null;
  ativo: boolean | null;
}

interface CobrancaData {
  representante_id: string;
  total_cobrado: number;
  total_despesas: number;
}

interface MetaData {
  representante_id: string;
  meta_valor: number;
}

interface CobrancaHojeRepresentante {
  representante_id: string;
  nome: string;
  total_cobrado: number;
  despesa: number;
}

export default function DashboardAdmin() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [estoqueDialogOpen, setEstoqueDialogOpen] = useState(false);
  const [cobrancaHojeDialogOpen, setCobrancaHojeDialogOpen] = useState(false);
  
  // Meta sempre do mês atual, não do período filtrado
  const mesAtual = format(new Date(), 'yyyy-MM');
  const hoje = format(new Date(), 'yyyy-MM-dd');

  // Query para representantes ativos (excluindo admins)
  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes-ativos'],
    queryFn: async () => {
      // Primeiro, busca os IDs dos usuários que são representantes
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'representante');
      
      if (rolesError) throw rolesError;
      
      const representanteIds = rolesData.map(r => r.user_id);
      
      // Depois busca os perfis desses representantes
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email, ativo')
        .eq('ativo', true)
        .in('id', representanteIds)
        .order('nome');
      
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Query para cobranças do período
  const { data: cobrancasMes = [] } = useQuery({
    queryKey: ['cobrancas-mes-admin', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('representante_id, total_cobrado, despesa_cobranca')
        .gte('data', startDate)
        .lte('data', endDate);
      
      if (error) throw error;
      
      // Agrupa por representante
      const agrupado = data.reduce((acc: Record<string, CobrancaData>, curr) => {
        const id = curr.representante_id;
        if (!acc[id]) {
          acc[id] = {
            representante_id: id,
            total_cobrado: 0,
            total_despesas: 0,
          };
        }
        acc[id].total_cobrado += curr.total_cobrado || 0;
        acc[id].total_despesas += curr.despesa_cobranca || 0;
        return acc;
      }, {});
      
      return Object.values(agrupado);
    },
  });

  // Query para cobranças de hoje (com detalhamento por representante)
  const { data: cobrancasHoje = [] } = useQuery({
    queryKey: ['cobrancas-hoje-admin', hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('representante_id, total_cobrado, despesa_cobranca')
        .eq('data', hoje);
      
      if (error) throw error;
      return data;
    },
  });

  // Query para kits do período
  const { data: kitsData } = useQuery({
    queryKey: ['kits-mes-admin', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kits_entregues')
        .select('id', { count: 'exact' })
        .gte('data_entrega', startDate)
        .lte('data_entrega', endDate);
      
      if (error) throw error;
      return data;
    },
  });

  // Query para notas promissórias do período (agrupadas por representante)
  const { data: notasPorRepresentante = [] } = useQuery({
    queryKey: ['notas-mes-admin', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_promissorias')
        .select('representante_id, id')
        .gte('data', startDate)
        .lte('data', endDate);
      
      if (error) throw error;
      
      // Agrupa por representante e conta as notas
      const agrupado = data.reduce((acc: Record<string, number>, curr) => {
        const id = curr.representante_id;
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {});
      
      return agrupado;
    },
  });

  // Query para notas promissórias do período (total geral)
  const { data: notasData } = useQuery({
    queryKey: ['notas-total-mes-admin', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_promissorias')
        .select('id', { count: 'exact' })
        .gte('data', startDate)
        .lte('data', endDate);
      
      if (error) throw error;
      return data;
    },
  });

  // Query para metas do mês
  const { data: metas = [] } = useQuery({
    queryKey: ['metas-mes-admin', mesAtual],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metas_cobranca')
        .select('representante_id, meta_valor')
        .eq('ano_mes', mesAtual)
        .eq('ativo', true);
      
      if (error) throw error;
      return data as MetaData[];
    },
  });

  // Query para produção de HOJE (corrigido - usando a tabela producao_diaria)
  const { data: producaoHoje = [] } = useQuery({
    queryKey: ['producao-hoje-admin', hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('producao_diaria')
        .select('tipo')
        .eq('data', hoje);
      
      if (error) throw error;
      return data;
    },
  });

  // Query para kits em estoque (status = 'estoque')
  const { data: kitsEstoque = [] } = useQuery({
    queryKey: ['kits-estoque-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kits_estoque')
        .select('tipo')
        .eq('status', 'estoque');
      
      if (error) throw error;
      return data;
    },
  });

  // Cálculos dos totais
  const totalHoje = cobrancasHoje.reduce((sum, c) => sum + (c.total_cobrado || 0), 0);
  const totalMes = cobrancasMes.reduce((sum, c) => sum + c.total_cobrado, 0);
  const totalDespesas = cobrancasMes.reduce((sum, c) => sum + c.total_despesas, 0);
  const totalKits = kitsData?.length || 0;
  const totalNotas = notasData?.length || 0;

  // Cálculos da produção de hoje
  const totalProducaoHoje = producaoHoje.length;

  // Cálculos do estoque
  const totalEstoque = kitsEstoque.length;
  const estoquePorTipo = kitsEstoque.reduce((acc: Record<string, number>, curr) => {
    const tipo = curr.tipo?.toLowerCase() || 'outro';
    acc[tipo] = (acc[tipo] || 0) + 1;
    return acc;
  }, {});

  // Detalhamento de cobranças de hoje por representante
  const cobrancasHojeDetalhadas: CobrancaHojeRepresentante[] = cobrancasHoje.map(c => {
    const rep = representantes.find(r => r.id === c.representante_id);
    return {
      representante_id: c.representante_id,
      nome: rep?.nome || 'Desconhecido',
      total_cobrado: c.total_cobrado || 0,
      despesa: c.despesa_cobranca || 0,
    };
  }).sort((a, b) => b.total_cobrado - a.total_cobrado);

  // Combina dados dos representantes com suas cobranças e metas
  const representantesComDados = representantes.map(rep => {
    const cobranca = cobrancasMes.find(c => c.representante_id === rep.id);
    const meta = metas.find(m => m.representante_id === rep.id);
    const realizado = cobranca?.total_cobrado || 0;
    const metaValor = meta?.meta_valor || 0;
    const percentual = metaValor > 0 ? (realizado / metaValor) * 100 : 0;
    const qtdNotas = notasPorRepresentante[rep.id] || 0;
    const ticketMedio = qtdNotas > 0 ? realizado / qtdNotas : 0;

    return {
      ...rep,
      realizado,
      meta: metaValor,
      percentual,
      despesas: cobranca?.total_despesas || 0,
      qtdNotas,
      ticketMedio,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Administrativo</h1>
        <p className="text-muted-foreground">Visão geral de todos os representantes</p>
      </div>

      <DateRangeFilter 
        onFilterChange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }} 
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Card Total Hoje - Clicável */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setCobrancaHojeDialogOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hoje</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarValor(totalHoje)}</div>
            <p className="text-xs text-muted-foreground mt-1">Clique para ver detalhes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Período</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarValor(totalMes)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarValor(totalDespesas)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Líquido: {formatarValor(totalMes - totalDespesas)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kits</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarNumero(totalKits)}</div>
            <p className="text-xs text-muted-foreground mt-1">Entregues no período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promissórias</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarNumero(totalNotas)}</div>
            <p className="text-xs text-muted-foreground mt-1">Registradas no período</p>
          </CardContent>
        </Card>
      </div>

      {/* Seção Produção Taliare - Simplificada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Produção Taliare
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Produzidos Hoje</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatarNumero(totalProducaoHoje)}</div>
              </CardContent>
            </Card>

            {/* Card Kits em Estoque - Clicável */}
            <Card 
              className="bg-muted/50 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setEstoqueDialogOpen(true)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Kits em Estoque</CardTitle>
                <Warehouse className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatarNumero(totalEstoque)}</div>
                <p className="text-xs text-muted-foreground mt-1">Clique para ver detalhes</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Desempenho por Representante</CardTitle>
        </CardHeader>
        <CardContent>
          {representantesComDados.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              <Users className="h-12 w-12 mr-4" />
              <div>
                <p>Nenhum representante cadastrado</p>
                <p className="text-sm">Cadastre representantes na seção de Usuários</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Representante</TableHead>
                  <TableHead>Meta</TableHead>
                  <TableHead>Realizado</TableHead>
                  <TableHead>Despesas</TableHead>
                  <TableHead>Líquido</TableHead>
                  <TableHead>Qtd Notas</TableHead>
                  <TableHead>Ticket Médio</TableHead>
                  <TableHead>Progresso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {representantesComDados.map((rep) => (
                  <TableRow key={rep.id}>
                    <TableCell className="font-medium">
                      <div>
                        <p>{rep.nome}</p>
                        <p className="text-xs text-muted-foreground">{rep.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{rep.meta > 0 ? formatarValor(rep.meta) : '-'}</TableCell>
                    <TableCell>{formatarValor(rep.realizado)}</TableCell>
                    <TableCell>{formatarValor(rep.despesas)}</TableCell>
                    <TableCell className="font-medium">
                      {formatarValor(rep.realizado - rep.despesas)}
                    </TableCell>
                    <TableCell>{formatarNumero(rep.qtdNotas)}</TableCell>
                    <TableCell>{rep.qtdNotas > 0 ? formatarValor(rep.ticketMedio) : '-'}</TableCell>
                    <TableCell>
                      {rep.meta > 0 ? (
                        <div className="space-y-2 min-w-[120px]">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{rep.percentual.toFixed(1)}%</span>
                          </div>
                          <Progress value={Math.min(rep.percentual, 100)} />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sem meta</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Estoque */}
      <Dialog open={estoqueDialogOpen} onOpenChange={setEstoqueDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" />
              Detalhes do Estoque
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Kits Iniciais</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {formatarNumero(estoquePorTipo['inicial'] || 0)}
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Kits Especiais</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {formatarNumero(estoquePorTipo['especial'] || 0)}
                </p>
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Maletas</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {formatarNumero(estoquePorTipo['maleta'] || 0)}
              </p>
            </div>
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Geral</span>
                <span className="text-2xl font-bold">{formatarNumero(totalEstoque)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEstoqueDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Cobranças de Hoje */}
      <Dialog open={cobrancaHojeDialogOpen} onOpenChange={setCobrancaHojeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cobranças de Hoje por Representante
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {cobrancasHojeDetalhadas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma cobrança registrada hoje
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {cobrancasHojeDetalhadas.map((item) => (
                  <div 
                    key={item.representante_id} 
                    className="flex justify-between items-center p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{item.nome}</p>
                      {item.despesa > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Despesa: {formatarValor(item.despesa)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{formatarValor(item.total_cobrado)}</p>
                      {item.despesa > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Líquido: {formatarValor(item.total_cobrado - item.despesa)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total do Dia</span>
                <span className="text-2xl font-bold text-primary">{formatarValor(totalHoje)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCobrancaHojeDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
