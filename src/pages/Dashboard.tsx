import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, TrendingUp, DollarSign, Target, TrendingDown, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatarValor, formatarNumero } from '@/lib/utils';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { useMetaNotifications } from '@/hooks/useMetaNotifications';

interface CobrancaDiaria {
  data: string;
  total_cobrado: number;
  despesa_cobranca: number | null;
}

interface KitEntregue {
  data_entrega: string;
}

interface MetaCobranca {
  meta_valor: number;
  ativo: boolean | null;
}

export default function Dashboard() {
  const { profile, user } = useAuth();
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  
  // Meta sempre do mês atual, não do período filtrado
  const mesAtual = format(new Date(), 'yyyy-MM');

  // Query para cobranças diárias do período
  const { data: cobrancas = [] } = useQuery({
    queryKey: ['cobrancas-mes', user?.id, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('data, total_cobrado, despesa_cobranca')
        .eq('representante_id', user!.id)
        .gte('data', startDate)
        .lte('data', endDate)
        .order('data');
      
      if (error) throw error;
      return data as CobrancaDiaria[];
    },
    enabled: !!user?.id,
  });

  // Query para kits entregues no período
  const { data: kitsDoMes = [] } = useQuery({
    queryKey: ['kits-mes', user?.id, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kits_entregues')
        .select('data_entrega')
        .eq('representante_id', user!.id)
        .gte('data_entrega', startDate)
        .lte('data_entrega', endDate);
      
      if (error) throw error;
      return data as KitEntregue[];
    },
    enabled: !!user?.id,
  });

  // Query para meta do mês
  const { data: metaDoMes } = useQuery({
    queryKey: ['meta-mes', user?.id, mesAtual],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metas_cobranca')
        .select('meta_valor, ativo')
        .eq('representante_id', user!.id)
        .eq('ano_mes', mesAtual)
        .eq('ativo', true)
        .maybeSingle();
      
      if (error) throw error;
      return data as MetaCobranca | null;
    },
    enabled: !!user?.id,
  });

  // Query para notas promissórias do período
  const { data: notasDoMes = [] } = useQuery({
    queryKey: ['notas-mes', user?.id, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_promissorias')
        .select('id, valor_total')
        .eq('representante_id', user!.id)
        .gte('data', startDate)
        .lte('data', endDate);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Cálculos
  const totalCobrado = cobrancas.reduce((sum, c) => sum + c.total_cobrado, 0);
  const totalDespesas = cobrancas.reduce((sum, c) => sum + (c.despesa_cobranca || 0), 0);
  const totalKits = kitsDoMes.length;
  const totalNotas = notasDoMes.length;
  const ticketMedio = totalNotas > 0 ? totalCobrado / totalNotas : 0;
  
  const percentualMeta = metaDoMes?.meta_valor 
    ? (totalCobrado / metaDoMes.meta_valor) * 100 
    : 0;

  // Ativa notificações de progresso da meta
  useMetaNotifications({
    percentualMeta,
    metaValor: metaDoMes?.meta_valor || 0,
    totalCobrado,
  });

  // Dados para o gráfico - evolução diária
  const diasDoMes = eachDayOfInterval({ 
    start: new Date(startDate), 
    end: new Date(endDate) 
  });

  const dadosGrafico = diasDoMes.map(dia => {
    const dataStr = format(dia, 'yyyy-MM-dd');
    const cobrancaDia = cobrancas.find(c => c.data === dataStr);
    
    // Calcula acumulado até este dia
    const cobranasAteEsseDia = cobrancas.filter(c => c.data <= dataStr);
    const acumulado = cobranasAteEsseDia.reduce((sum, c) => sum + c.total_cobrado, 0);
    
    return {
      dia: format(dia, 'dd/MM'),
      cobrado: cobrancaDia?.total_cobrado || 0,
      acumulado,
      despesas: cobrancaDia?.despesa_cobranca || 0,
    };
  });

  // Dados para gráfico comparativo meta vs realizado
  const dadosMetaVsRealizado = [
    {
      name: 'Meta',
      valor: metaDoMes?.meta_valor || 0,
    },
    {
      name: 'Realizado',
      valor: totalCobrado,
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6 px-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Bem-vindo, {profile?.nome}</h1>
        <p className="text-sm md:text-base text-muted-foreground">Acompanhe seu desempenho e metas</p>
      </div>

      <DateRangeFilter 
        onFilterChange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }} 
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 md:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cobrado (Mês)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarValor(totalCobrado)}</div>
            <p className="text-xs text-muted-foreground">
              {formatarNumero(cobrancas.length)} dia{cobrancas.length !== 1 ? 's' : ''} de cobrança
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notas Cobradas (Mês)</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarNumero(totalNotas)}</div>
            <p className="text-xs text-muted-foreground">
              Notas promissórias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarValor(ticketMedio)}</div>
            <p className="text-xs text-muted-foreground">
              Valor médio por nota
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas (Mês)</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarValor(totalDespesas)}</div>
            <p className="text-xs text-muted-foreground">
              Líquido: {formatarValor(totalCobrado - totalDespesas)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kits Entregues</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarNumero(totalKits)}</div>
            <p className="text-xs text-muted-foreground">
              Neste mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meta do Mês</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metaDoMes ? (
              <>
                <div className="text-2xl font-bold">{percentualMeta.toFixed(1)}%</div>
                <Progress value={Math.min(percentualMeta, 100)} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {formatarValor(metaDoMes.meta_valor)}
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground">Meta não definida</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Evolução Diária das Cobranças</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dadosGrafico}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="dia" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => formatarValor(value)}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="cobrado" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Cobrado no Dia"
                />
                <Line 
                  type="monotone" 
                  dataKey="acumulado" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  name="Acumulado"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meta vs Realizado</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosMetaVsRealizado}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => formatarValor(value)}
                />
                <Legend />
                <Bar 
                  dataKey="valor" 
                  fill="hsl(var(--primary))" 
                  name="Valor (R$)"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {cobrancas.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <TrendingUp className="h-16 w-16 mx-auto mb-4" />
              <p className="text-lg">Nenhuma cobrança registrada este mês</p>
              <p className="text-sm">Registre suas cobranças diárias para ver seus dados aqui</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
