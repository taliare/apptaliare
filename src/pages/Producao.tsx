import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, TrendingUp, Box, Sun, Moon, CloudSun, Sparkles, Calendar, Target, MessageSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { Progress } from '@/components/ui/progress';
import { EncomendaAlertBanner } from '@/components/producao/EncomendaAlertBanner';
import { useAuth } from '@/contexts/AuthContext';

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

export default function Producao() {
  const { profile } = useAuth();
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  
  const mesAtual = format(new Date(), 'yyyy-MM');
  const saudacao = getSaudacao();
  const fraseMotivacional = useMemo(() => getFraseMotivacional(), []);
  const SaudacaoIcon = saudacao.icon;

  const { data: stats } = useQuery({
    queryKey: ['producao-stats', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('producao_diaria')
        .select('tipo')
        .gte('data', startDate)
        .lte('data', endDate);

      if (error) throw error;

      const inicial = data.filter(p => p.tipo === 'inicial').length;
      const especial = data.filter(p => p.tipo === 'especial').length;
      const maleta = data.filter(p => p.tipo === 'maleta').length;

      return { inicial, especial, maleta, total: inicial + especial + maleta };
    },
  });

  // Query para meta de produção do mês
  const { data: metaProducao } = useQuery({
    queryKey: ['meta-producao', mesAtual],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metas_producao')
        .select('*')
        .eq('ano_mes', mesAtual)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Calcular progresso da meta
  const progressoMeta = metaProducao && metaProducao.meta_kits > 0
    ? ((stats?.total || 0) / metaProducao.meta_kits) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Alerta de Encomendas Pendentes */}
      <EncomendaAlertBanner />

      {/* Hero Section com Saudação */}
      <div className="relative overflow-hidden rounded-xl md:rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-background border border-border/50 p-4 md:p-6">
        {/* Elementos decorativos */}
        <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-24 md:w-48 h-24 md:h-48 bg-chart-2/10 rounded-full blur-2xl" />
        
        <div className="relative z-10 flex flex-col gap-3 md:gap-4">
          {/* Saudação */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-primary/20 rounded-lg md:rounded-xl">
              <SaudacaoIcon className="h-4 w-4 md:h-6 md:w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl lg:text-3xl font-bold text-foreground">
                {saudacao.texto}, {profile?.nome?.split(' ')[0] || 'Produção'}!
              </h1>
              <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm text-muted-foreground">
                <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                <span>{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</span>
              </div>
            </div>
          </div>

          {/* Frase Motivacional */}
          <div className="flex items-start gap-2 p-2 md:p-3 bg-background/60 backdrop-blur-sm rounded-lg md:rounded-xl border border-border/50">
            <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4 text-chart-2 shrink-0 mt-0.5" />
            <p className="text-xs md:text-sm text-muted-foreground italic leading-relaxed">
              "{fraseMotivacional}"
            </p>
          </div>

          {/* Quick Stats */}
          {metaProducao && (
            <div className="flex items-center gap-2 md:gap-4">
              <div className="flex-1 text-center p-2 md:p-3 bg-background/60 backdrop-blur-sm rounded-lg md:rounded-xl border border-border/50">
                <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5 md:mb-1">Produzidos</p>
                <p className="text-sm md:text-xl font-bold text-primary truncate">{stats?.total || 0}</p>
              </div>
              <div className="flex-1 text-center p-2 md:p-3 bg-background/60 backdrop-blur-sm rounded-lg md:rounded-xl border border-border/50">
                <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5 md:mb-1">Meta</p>
                <p className="text-sm md:text-xl font-bold text-chart-2 truncate">{metaProducao.meta_kits}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card de Meta do Mês */}
      {metaProducao && (
        <Card className="border-chart-2/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Target className="h-5 w-5 text-chart-2" />
              Meta do Mês: {format(new Date(), 'MMMM yyyy', { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Meta</p>
                <p className="text-xl md:text-2xl font-bold">{metaProducao.meta_kits} kits</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Produzidos</p>
                <p className="text-xl md:text-2xl font-bold text-primary">{stats?.total || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Faltam</p>
                <p className="text-xl md:text-2xl font-bold text-chart-2">
                  {Math.max(0, metaProducao.meta_kits - (stats?.total || 0))}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso</span>
                <span className="font-medium">{progressoMeta.toFixed(1)}%</span>
              </div>
              <Progress value={Math.min(progressoMeta, 100)} className="h-3" />
            </div>

            {/* Observação do Admin */}
            {metaProducao.observacao && (
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg border border-border">
                <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Observação do Administrador:</p>
                  <p className="text-sm text-foreground">{metaProducao.observacao}</p>
                </div>
              </div>
            )}

            {progressoMeta >= 100 && (
              <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-600">
                  Parabéns! A meta foi atingida!
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <DateRangeFilter 
        onFilterChange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }} 
      />

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kits Iniciais</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.inicial || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kits Especiais</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.especial || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maletas</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.maleta || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Geral</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
