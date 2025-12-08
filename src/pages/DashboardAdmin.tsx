import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { DollarSign, TrendingUp, Package, FileText, Users, TrendingDown, Factory } from 'lucide-react';
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

export default function DashboardAdmin() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  
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

  // Query para cobranças de hoje
  const { data: cobrancasHoje = [] } = useQuery({
    queryKey: ['cobrancas-hoje-admin', hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('total_cobrado')
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

  // Query para produção diária (HOJE)
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

  // Query para produção do período
  const { data: producaoPeriodo = [] } = useQuery({
    queryKey: ['producao-periodo-admin', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('producao_diaria')
        .select('tipo')
        .gte('data', startDate)
        .lte('data', endDate);
      
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

  // Cálculos da produção
  const totalProducaoHoje = producaoHoje.length;
  const totalProducaoPeriodo = producaoPeriodo.length;
  const producaoPorTipo = producaoPeriodo.reduce((acc: Record<string, number>, curr) => {
    const tipo = curr.tipo?.toLowerCase() || 'outro';
    acc[tipo] = (acc[tipo] || 0) + 1;
    return acc;
  }, {});

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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hoje</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarValor(totalHoje)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mês</CardTitle>
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
            <p className="text-xs text-muted-foreground mt-1">Entregues no mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promissórias</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarNumero(totalNotas)}</div>
            <p className="text-xs text-muted-foreground mt-1">Registradas no mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Seção Produção Taliare */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Produção Taliare
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className="bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Produzidos Hoje</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatarNumero(totalProducaoHoje)}</div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Produzidos no Período</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatarNumero(totalProducaoPeriodo)}</div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Iniciais</CardTitle>
                <Package className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatarNumero(producaoPorTipo['inicial'] || 0)}</div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Especiais</CardTitle>
                <Package className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatarNumero(producaoPorTipo['especial'] || 0)}</div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Maletas</CardTitle>
                <Package className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatarNumero(producaoPorTipo['maleta'] || 0)}</div>
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
    </div>
  );
}
