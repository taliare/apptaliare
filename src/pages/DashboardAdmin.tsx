import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  DollarSign, TrendingUp, Package, Users, TrendingDown, 
  Factory, Warehouse, ChevronDown, ChevronUp, Sparkles, Sun, Moon, 
  CloudSun, Flame, Target, Calendar
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarValor, formatarNumero, getLocalDateString, getLocalMonthString } from '@/lib/utils';
import { DateRangeFilterPopover } from '@/components/DateRangeFilterPopover';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

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

// Frases motivacionais
const frasesMotivacionais = [
  "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
  "Cada conquista começa com a decisão de tentar.",
  "A persistência é o caminho do êxito.",
  "Sonhe grande, comece pequeno, aja agora.",
  "O único lugar onde o sucesso vem antes do trabalho é no dicionário.",
  "Acredite em você e todo o resto virá naturalmente.",
  "Sua única limitação é você mesmo.",
  "Grandes realizações exigem grandes esforços.",
  "Foco no progresso, não na perfeição.",
  "O segredo do sucesso é a constância do propósito.",
  "Você é mais forte do que imagina.",
  "Todo expert já foi um iniciante.",
  "A disciplina é a ponte entre metas e realizações.",
  "Transforme obstáculos em oportunidades.",
  "Seu potencial é ilimitado.",
];

// Função para obter saudação baseada no horário
const getSaudacao = () => {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) {
    return { texto: 'Bom dia', icon: Sun, emoji: '☀️' };
  } else if (hora >= 12 && hora < 18) {
    return { texto: 'Boa tarde', icon: CloudSun, emoji: '🌤️' };
  } else {
    return { texto: 'Boa noite', icon: Moon, emoji: '🌙' };
  }
};

// Função para obter frase aleatória do dia (baseada na data para consistência)
const getFraseMotivacional = () => {
  const hoje = new Date();
  const seed = hoje.getDate() + hoje.getMonth() * 31 + hoje.getFullYear();
  return frasesMotivacionais[seed % frasesMotivacionais.length];
};

// Cores para gráficos
const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default function DashboardAdmin() {
  const { profile } = useAuth();
  const [startDate, setStartDate] = useState(getLocalDateString(startOfMonth(new Date())));
  const [endDate, setEndDate] = useState(getLocalDateString(endOfMonth(new Date())));
  const [estoqueDialogOpen, setEstoqueDialogOpen] = useState(false);
  const [cobrancaHojeDialogOpen, setCobrancaHojeDialogOpen] = useState(false);
  const [showRepresentantes, setShowRepresentantes] = useState(false);
  const [showProducao, setShowProducao] = useState(false);
  
  const mesAtual = getLocalMonthString();
  const hoje = getLocalDateString();
  const saudacao = getSaudacao();
  const fraseMotivacional = useMemo(() => getFraseMotivacional(), []);
  const SaudacaoIcon = saudacao.icon;

  // Query para representantes ativos (excluindo admins)
  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes-ativos'],
    queryFn: async () => {
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'representante');
      
      if (rolesError) throw rolesError;
      
      const representanteIds = rolesData.map(r => r.user_id);
      
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

  // Query para notas promissórias
  const { data: notasPorRepresentante = [] } = useQuery({
    queryKey: ['notas-mes-admin', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_promissorias')
        .select('representante_id, id')
        .gte('data', startDate)
        .lte('data', endDate);
      
      if (error) throw error;
      
      const agrupado = data.reduce((acc: Record<string, number>, curr) => {
        const id = curr.representante_id;
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {});
      
      return agrupado;
    },
  });

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

  // Query para metas
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

  // Query para produção de hoje
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

  // Query para kits em estoque
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

  // Cálculos
  const totalHoje = cobrancasHoje.reduce((sum, c) => sum + (c.total_cobrado || 0), 0);
  const totalMes = cobrancasMes.reduce((sum, c) => sum + c.total_cobrado, 0);
  const totalDespesas = cobrancasMes.reduce((sum, c) => sum + c.total_despesas, 0);
  const totalKits = kitsData?.length || 0;
  const totalNotas = notasData?.length || 0;
  const totalProducaoHoje = producaoHoje.length;
  const totalEstoque = kitsEstoque.length;
  
  const estoquePorTipo = kitsEstoque.reduce((acc: Record<string, number>, curr) => {
    const tipo = curr.tipo?.toLowerCase() || 'outro';
    acc[tipo] = (acc[tipo] || 0) + 1;
    return acc;
  }, {});

  // Dados para gráfico de pizza do estoque
  const dadosEstoquePie = Object.entries(estoquePorTipo).map(([tipo, quantidade]) => ({
    name: tipo.charAt(0).toUpperCase() + tipo.slice(1),
    value: quantidade,
  }));

  // Meta total e realizado
  const totalMeta = metas.reduce((sum, m) => sum + m.meta_valor, 0);
  const percentualMetaGeral = totalMeta > 0 ? (totalMes / totalMeta) * 100 : 0;

  // Dados para gráfico de barras por representante
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
  }).sort((a, b) => b.realizado - a.realizado);

  // Dados para gráfico de desempenho
  const dadosDesempenhoChart = representantesComDados.slice(0, 5).map(rep => ({
    nome: rep.nome.split(' ')[0],
    realizado: rep.realizado,
    meta: rep.meta,
  }));

  // Detalhamento de cobranças de hoje
  const cobrancasHojeDetalhadas: CobrancaHojeRepresentante[] = cobrancasHoje.map(c => {
    const rep = representantes.find(r => r.id === c.representante_id);
    return {
      representante_id: c.representante_id,
      nome: rep?.nome || 'Desconhecido',
      total_cobrado: c.total_cobrado || 0,
      despesa: c.despesa_cobranca || 0,
    };
  }).sort((a, b) => b.total_cobrado - a.total_cobrado);

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in overflow-x-hidden">
      {/* Hero Section - Saudação */}
      <div className="relative overflow-hidden rounded-xl md:rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-background border border-primary/20 p-4 md:p-8">
        <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 md:w-48 h-24 md:h-48 bg-chart-2/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-primary/20 animate-glow-pulse shrink-0">
                <SaudacaoIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg md:text-3xl font-display font-bold text-foreground truncate">
                  {saudacao.texto}, {profile?.nome?.split(' ')[0]} {saudacao.emoji}
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1 md:gap-2">
                  <Calendar className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
                  <span className="truncate">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</span>
                </p>
              </div>
            </div>
            
            {/* Filtro de Período */}
            <DateRangeFilterPopover 
              onFilterChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
              }}
              className="shrink-0"
            />
          </div>
          
          <div className="flex items-start gap-2 bg-background/50 backdrop-blur-sm rounded-lg p-2 md:p-3 border border-primary/10">
            <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-primary mt-0.5 animate-pulse shrink-0" />
            <p className="text-xs md:text-sm text-muted-foreground italic line-clamp-2">
              "{fraseMotivacional}"
            </p>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex-1 text-center p-2 md:p-3 bg-background/60 backdrop-blur-sm rounded-lg md:rounded-xl border border-border/50">
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5 md:mb-1">Hoje</p>
              <p className="text-sm md:text-xl font-bold text-primary truncate">{formatarValor(totalHoje)}</p>
            </div>
            <div className="flex-1 text-center p-2 md:p-3 bg-background/60 backdrop-blur-sm rounded-lg md:rounded-xl border border-border/50">
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5 md:mb-1">Período</p>
              <p className="text-sm md:text-xl font-bold text-chart-2 truncate">{formatarValor(totalMes)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cards Principais - Grid Responsivo */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Card Total Hoje */}
        <Card 
          variant="interactive"
          className="cursor-pointer group animate-fade-in w-full max-w-full overflow-hidden"
          style={{ animationDelay: '0.05s' }}
          onClick={() => setCobrancaHojeDialogOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Hoje</CardTitle>
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
              <DollarSign className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-base md:text-2xl font-display font-bold truncate">{formatarValor(totalHoje)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate">Toque para detalhes</p>
          </CardContent>
        </Card>

        {/* Card Total Período */}
        <Card 
          variant="interactive" 
          className="animate-fade-in w-full max-w-full overflow-hidden"
          style={{ animationDelay: '0.1s' }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Período</CardTitle>
            <div className="p-1.5 md:p-2 rounded-lg bg-chart-2/10 shrink-0">
              <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-chart-2" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-base md:text-2xl font-display font-bold truncate">{formatarValor(totalMes)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate">
              Líquido: {formatarValor(totalMes - totalDespesas)}
            </p>
          </CardContent>
        </Card>

        {/* Card Kits */}
        <Card 
          variant="interactive" 
          className="animate-fade-in w-full max-w-full overflow-hidden"
          style={{ animationDelay: '0.15s' }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Kits</CardTitle>
            <div className="p-1.5 md:p-2 rounded-lg bg-chart-3/10 shrink-0">
              <Package className="h-3.5 w-3.5 md:h-4 md:w-4 text-chart-3" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-base md:text-2xl font-display font-bold truncate">{formatarNumero(totalKits)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate">Entregues</p>
          </CardContent>
        </Card>

        {/* Card Meta Geral */}
        <Card 
          variant="glow" 
          className="animate-fade-in w-full max-w-full overflow-hidden"
          style={{ animationDelay: '0.2s' }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Meta Geral</CardTitle>
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10 animate-glow-pulse shrink-0">
              <Target className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-base md:text-2xl font-display font-bold text-primary truncate">
              {percentualMetaGeral.toFixed(0)}%
            </div>
            <Progress value={Math.min(percentualMetaGeral, 100)} className="mt-2 h-1.5 md:h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Gráfico de Desempenho por Representante */}
        <Card variant="glass" className="animate-fade-in" style={{ animationDelay: '0.25s' }}>
          <CardHeader>
            <CardTitle className="text-sm md:text-base font-display flex items-center gap-2">
              <Flame className="h-4 w-4 text-primary" />
              Top 5 Representantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dadosDesempenhoChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dadosDesempenhoChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis 
                    type="number" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    stroke="hsl(var(--border))"
                  />
                  <YAxis 
                    type="category" 
                    dataKey="nome" 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    width={60}
                    stroke="hsl(var(--border))"
                  />
                  <Tooltip 
                    formatter={(value: number) => formatarValor(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar 
                    dataKey="realizado" 
                    fill="hsl(var(--primary))" 
                    name="Realizado"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                <Users className="h-8 w-8 mr-2" />
                <span>Sem dados no período</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Pizza - Estoque */}
        <Card 
          variant="glass" 
          className="cursor-pointer animate-fade-in" 
          style={{ animationDelay: '0.3s' }}
          onClick={() => setEstoqueDialogOpen(true)}
        >
          <CardHeader>
            <CardTitle className="text-sm md:text-base font-display flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-chart-2" />
              Estoque por Tipo
              <span className="text-xs text-muted-foreground ml-auto">Toque para detalhes</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dadosEstoquePie.length > 0 ? (
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={dadosEstoquePie}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {dadosEstoquePie.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => `${value} kits`}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                <Package className="h-12 w-12 mb-2 animate-float" />
                <span>Estoque vazio</span>
              </div>
            )}
            <div className="text-center mt-2">
              <span className="text-2xl font-bold">{formatarNumero(totalEstoque)}</span>
              <span className="text-muted-foreground text-sm ml-2">kits em estoque</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Produção Taliare - Collapsible */}
      <Collapsible open={showProducao} onOpenChange={setShowProducao}>
        <Card variant="glass" className="animate-fade-in" style={{ animationDelay: '0.35s' }}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm md:text-base font-display">
                  <Factory className="h-5 w-5 text-chart-3" />
                  Produção Taliare
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    Hoje: <span className="font-bold text-foreground">{formatarNumero(totalProducaoHoje)}</span> kits
                  </span>
                  {showProducao ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid gap-4 grid-cols-2">
                <div className="bg-chart-3/10 p-4 rounded-xl text-center">
                  <Package className="h-8 w-8 mx-auto text-chart-3 mb-2" />
                  <p className="text-sm text-muted-foreground">Produzidos Hoje</p>
                  <p className="text-3xl font-bold">{formatarNumero(totalProducaoHoje)}</p>
                </div>
                <div className="bg-chart-2/10 p-4 rounded-xl text-center">
                  <Warehouse className="h-8 w-8 mx-auto text-chart-2 mb-2" />
                  <p className="text-sm text-muted-foreground">Em Estoque</p>
                  <p className="text-3xl font-bold">{formatarNumero(totalEstoque)}</p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Tabela de Representantes - Collapsible */}
      <Collapsible open={showRepresentantes} onOpenChange={setShowRepresentantes}>
        <Card variant="glass" className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm md:text-base font-display">
                  <Users className="h-5 w-5 text-chart-4" />
                  Desempenho por Representante
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {representantes.length} representantes
                  </span>
                  {showRepresentantes ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {representantesComDados.length === 0 ? (
                <div className="flex items-center justify-center h-[150px] text-muted-foreground">
                  <Users className="h-12 w-12 mr-4 animate-float" />
                  <div>
                    <p>Nenhum representante cadastrado</p>
                    <p className="text-sm">Cadastre representantes na seção de Usuários</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Representante</TableHead>
                        <TableHead className="text-right">Meta</TableHead>
                        <TableHead className="text-right">Realizado</TableHead>
                        <TableHead className="text-right">Líquido</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Notas</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Ticket</TableHead>
                        <TableHead className="w-32">Progresso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {representantesComDados.map((rep, index) => (
                        <TableRow 
                          key={rep.id} 
                          className="animate-fade-in"
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          <TableCell className="font-medium">
                            <div>
                              <p className="text-sm">{rep.nome}</p>
                              <p className="text-xs text-muted-foreground hidden md:block">{rep.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {rep.meta > 0 ? formatarValor(rep.meta) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm">
                            {formatarValor(rep.realizado)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatarValor(rep.realizado - rep.despesas)}
                          </TableCell>
                          <TableCell className="text-right text-sm hidden md:table-cell">
                            {formatarNumero(rep.qtdNotas)}
                          </TableCell>
                          <TableCell className="text-right text-sm hidden md:table-cell">
                            {rep.qtdNotas > 0 ? formatarValor(rep.ticketMedio) : '-'}
                          </TableCell>
                          <TableCell>
                            {rep.meta > 0 ? (
                              <div className="space-y-1 min-w-[100px]">
                                <div className="flex justify-between text-xs">
                                  <span className={`font-medium ${rep.percentual >= 100 ? 'text-chart-3' : ''}`}>
                                    {rep.percentual.toFixed(0)}%
                                  </span>
                                </div>
                                <Progress value={Math.min(rep.percentual, 100)} className="h-2" />
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sem meta</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Dialog de Estoque */}
      <Dialog open={estoqueDialogOpen} onOpenChange={setEstoqueDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-chart-2" />
              Detalhes do Estoque
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-primary/10 p-4 rounded-xl text-center">
                <p className="text-sm text-muted-foreground">Kits Iniciais</p>
                <p className="text-3xl font-bold text-primary">
                  {formatarNumero(estoquePorTipo['inicial'] || 0)}
                </p>
              </div>
              <div className="bg-chart-2/10 p-4 rounded-xl text-center">
                <p className="text-sm text-muted-foreground">Kits Especiais</p>
                <p className="text-3xl font-bold text-chart-2">
                  {formatarNumero(estoquePorTipo['especial'] || 0)}
                </p>
              </div>
            </div>
            <div className="bg-chart-3/10 p-4 rounded-xl text-center">
              <p className="text-sm text-muted-foreground">Maletas</p>
              <p className="text-3xl font-bold text-chart-3">
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
              <DollarSign className="h-5 w-5 text-primary" />
              Cobranças de Hoje
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {cobrancasHojeDetalhadas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-2 animate-float" />
                Nenhuma cobrança registrada hoje
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {cobrancasHojeDetalhadas.map((item, index) => (
                  <div 
                    key={item.representante_id} 
                    className="flex justify-between items-center p-3 bg-muted/50 rounded-lg animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
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
