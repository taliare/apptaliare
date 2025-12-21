import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Package, TrendingUp, DollarSign, Target, TrendingDown, FileText,
  Sun, Moon, CloudSun, Sparkles, Calendar, ChevronDown, ChevronUp, BarChart3
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatarValor, formatarNumero } from '@/lib/utils';
import { DateRangeFilterPopover } from '@/components/DateRangeFilterPopover';
import { useMetaNotifications } from '@/hooks/useMetaNotifications';

interface CobrancaDiaria {
  data: string;
  total_cobrado: number;
  despesa_cobranca: number | null;
}

interface KitEntregue {
  data_vencimento: string;
  tipo: string | null;
}

interface MetaCobranca {
  meta_valor: number;
  ativo: boolean | null;
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

// Função para obter frase aleatória do dia
const getFraseMotivacional = () => {
  const hoje = new Date();
  const seed = hoje.getDate() + hoje.getMonth() * 31 + hoje.getFullYear();
  return frasesMotivacionais[seed % frasesMotivacionais.length];
};

export default function Dashboard() {
  const { profile, user } = useAuth();
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [showGraficos, setShowGraficos] = useState(false);
  
  const mesAtual = format(new Date(), 'yyyy-MM');
  const saudacao = getSaudacao();
  const fraseMotivacional = useMemo(() => getFraseMotivacional(), []);
  const SaudacaoIcon = saudacao.icon;

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

  // Ciclo padrão de kits
  const mesVencimentoKits = format(addMonths(new Date(), 2), 'yyyy-MM');

  // Query para kits entregues
  const { data: kitsDoMes = [] } = useQuery({
    queryKey: ['kits-mes-dashboard', user?.id, mesVencimentoKits],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kits_entregues')
        .select('data_vencimento, tipo')
        .eq('representante_id', user!.id);
      
      if (error) throw error;
      
      return (data as KitEntregue[]).filter(kit => {
        const vencimentoMes = kit.data_vencimento.substring(0, 7);
        return vencimentoMes === mesVencimentoKits;
      });
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

  // Query para notas promissórias
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

  // Notificações de meta
  useMetaNotifications({
    percentualMeta,
    metaValor: metaDoMes?.meta_valor || 0,
    totalCobrado,
  });

  // Dados para gráficos
  const diasDoMes = eachDayOfInterval({ 
    start: new Date(startDate), 
    end: new Date(endDate) 
  });

  const dadosGrafico = diasDoMes.map(dia => {
    const dataStr = format(dia, 'yyyy-MM-dd');
    const cobrancaDia = cobrancas.find(c => c.data === dataStr);
    const cobranasAteEsseDia = cobrancas.filter(c => c.data <= dataStr);
    const acumulado = cobranasAteEsseDia.reduce((sum, c) => sum + c.total_cobrado, 0);
    
    return {
      dia: format(dia, 'dd/MM'),
      cobrado: cobrancaDia?.total_cobrado || 0,
      acumulado,
      despesas: cobrancaDia?.despesa_cobranca || 0,
    };
  });

  const dadosMetaVsRealizado = [
    { name: 'Meta', valor: metaDoMes?.meta_valor || 0 },
    { name: 'Realizado', valor: totalCobrado },
  ];

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
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5 md:mb-1">Período</p>
              <p className="text-sm md:text-xl font-bold text-primary truncate">{formatarValor(totalCobrado)}</p>
            </div>
            {metaDoMes && (
              <div className="flex-1 text-center p-2 md:p-3 bg-background/60 backdrop-blur-sm rounded-lg md:rounded-xl border border-border/50">
                <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5 md:mb-1">Meta</p>
                <p className="text-sm md:text-xl font-bold text-chart-2 truncate">{percentualMeta.toFixed(0)}%</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cards Principais */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-3">
        {/* Total Cobrado */}
        <Card variant="interactive" className="animate-card-entrance animate-card-entrance-1 w-full max-w-full overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Total Cobrado</CardTitle>
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10 shrink-0">
              <DollarSign className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-base md:text-2xl font-display font-bold truncate">{formatarValor(totalCobrado)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              {formatarNumero(cobrancas.length)} dia{cobrancas.length !== 1 ? 's' : ''} de cobrança
            </p>
          </CardContent>
        </Card>

        {/* Notas */}
        <Card variant="interactive" className="animate-card-entrance animate-card-entrance-2 w-full max-w-full overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Notas</CardTitle>
            <div className="p-1.5 md:p-2 rounded-lg bg-chart-2/10 shrink-0">
              <FileText className="h-3.5 w-3.5 md:h-4 md:w-4 text-chart-2" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-base md:text-2xl font-display font-bold truncate">{formatarNumero(totalNotas)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">Promissórias</p>
          </CardContent>
        </Card>

        {/* Ticket Médio */}
        <Card variant="interactive" className="animate-card-entrance animate-card-entrance-3 w-full max-w-full overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Ticket Médio</CardTitle>
            <div className="p-1.5 md:p-2 rounded-lg bg-chart-3/10 shrink-0">
              <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-chart-3" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-base md:text-2xl font-display font-bold truncate">{formatarValor(ticketMedio)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">Por nota</p>
          </CardContent>
        </Card>

        {/* Despesas */}
        <Card variant="interactive" className="animate-card-entrance animate-card-entrance-4 w-full max-w-full overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Despesas</CardTitle>
            <div className="p-1.5 md:p-2 rounded-lg bg-destructive/10 shrink-0">
              <TrendingDown className="h-3.5 w-3.5 md:h-4 md:w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-base md:text-2xl font-display font-bold truncate">{formatarValor(totalDespesas)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              Líquido: {formatarValor(totalCobrado - totalDespesas)}
            </p>
          </CardContent>
        </Card>

        {/* Kits */}
        <Card variant="interactive" className="animate-card-entrance animate-card-entrance-5 w-full max-w-full overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Kits</CardTitle>
            <div className="p-1.5 md:p-2 rounded-lg bg-chart-4/10 shrink-0">
              <Package className="h-3.5 w-3.5 md:h-4 md:w-4 text-chart-4" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-base md:text-2xl font-display font-bold truncate">{formatarNumero(totalKits)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              Venc: {format(addMonths(new Date(), 2), "MMM/yy", { locale: ptBR })}
            </p>
          </CardContent>
        </Card>

        {/* Meta */}
        <Card variant="glow" className="animate-card-entrance animate-card-entrance-6 w-full max-w-full overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Meta do Mês</CardTitle>
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10 animate-glow-pulse shrink-0">
              <Target className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            {metaDoMes ? (
              <>
                <div className={`text-base md:text-2xl font-display font-bold truncate ${percentualMeta >= 100 ? 'text-chart-3' : 'text-primary'}`}>
                  {percentualMeta.toFixed(0)}%
                </div>
                <Progress value={Math.min(percentualMeta, 100)} className="mt-2 h-1.5 md:h-2" />
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate">
                  {formatarValor(metaDoMes.meta_valor)}
                </p>
              </>
            ) : (
              <>
                <div className="text-base md:text-2xl font-display font-bold truncate">-</div>
                <p className="text-[10px] md:text-xs text-muted-foreground truncate">Sem meta definida</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráficos - Collapsible */}
      <Collapsible open={showGraficos} onOpenChange={setShowGraficos}>
        <Card variant="glass" className="animate-fade-in" style={{ animationDelay: '0.35s' }}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm md:text-base font-display">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Gráficos de Desempenho
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {cobrancas.length > 0 ? 'Dados disponíveis' : 'Sem dados'}
                  </span>
                  {showGraficos ? (
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
              {cobrancas.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Gráfico de Evolução */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-4">Evolução Diária</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={dadosGrafico}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="dia" 
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          angle={-45}
                          textAnchor="end"
                          height={50}
                          stroke="hsl(var(--border))"
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                          stroke="hsl(var(--border))"
                          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip 
                          formatter={(value: number) => formatarValor(value)}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="cobrado" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          name="Dia"
                          dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="acumulado" 
                          stroke="hsl(var(--chart-2))" 
                          strokeWidth={2}
                          name="Acumulado"
                          dot={{ fill: 'hsl(var(--chart-2))', r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Gráfico Meta vs Realizado */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-4">Meta vs Realizado</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={dadosMetaVsRealizado}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                          stroke="hsl(var(--border))"
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                          stroke="hsl(var(--border))"
                          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
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
                          dataKey="valor" 
                          fill="hsl(var(--primary))" 
                          name="Valor"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <TrendingUp className="h-16 w-16 mb-4 animate-float" />
                  <p className="text-lg font-display">Nenhuma cobrança no período</p>
                  <p className="text-sm">Registre cobranças para ver seus gráficos</p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
