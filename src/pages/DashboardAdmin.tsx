import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  DollarSign, TrendingUp, Package, Users, TrendingDown, 
  Factory, Warehouse, ChevronDown, ChevronUp, Sparkles, Sun, Moon, 
  CloudSun, Flame, Target, Calendar, Eye, EyeOff
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
  const [showValues, setShowValues] = useState(() => {
    const saved = localStorage.getItem('dashboard-admin-show-values');
    return saved !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('dashboard-admin-show-values', String(showValues));
  }, [showValues]);
  
  const mesAtual = getLocalMonthString();
  const hoje = getLocalDateString();
  const saudacao = getSaudacao();
  const fraseMotivacional = useMemo(() => getFraseMotivacional(), []);
  const SaudacaoIcon = saudacao.icon;

  // Query para representantes (somente role='representante', inclui inativos)
  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes-dashboard'],
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
        .select('id, nome, email, ativo')
        .in('id', representanteIds)
        .order('nome');

      if (error) throw error;
      return data as Profile[];
    },
  });

  // TOTAL COBRADO POR REPRESENTANTE: usa cobrancas_diarias.total_cobrado
  // (valor que o próprio representante registra no fechamento diário — fonte confiável p/ admin).
  // cobrancas_diarias continua sendo usado também para despesa_cobranca.

  // Query para cobranças do período (total_cobrado somado por representante)
  const { data: cobrancasMes = [] } = useQuery({
    queryKey: ['cobrancas-mes-admin', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('representante_id, total_cobrado')
        .gte('data', startDate)
        .lte('data', endDate);

      if (error) throw error;

      const agrupado = data.reduce((acc: Record<string, CobrancaData>, curr) => {
        const id = curr.representante_id;
        if (!acc[id]) {
          acc[id] = { representante_id: id, total_cobrado: 0, total_despesas: 0 };
        }
        acc[id].total_cobrado += Number(curr.total_cobrado) || 0;
        return acc;
      }, {});

      return Object.values(agrupado);
    },
  });

  // Query para despesas do período (cobrancas_diarias.despesa_cobranca — campo correto)
  const { data: despesasPorRep = {} } = useQuery({
    queryKey: ['despesas-periodo-admin', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('representante_id, despesa_cobranca')
        .gte('data', startDate)
        .lte('data', endDate);

      if (error) throw error;

      return data.reduce((acc: Record<string, number>, curr) => {
        const id = curr.representante_id;
        acc[id] = (acc[id] || 0) + (Number(curr.despesa_cobranca) || 0);
        return acc;
      }, {});
    },
  });

  // Query para despesas de hoje + status de finalização (cobrancas_diarias)
  const { data: despesasHojeRaw = [] } = useQuery({
    queryKey: ['despesas-hoje-admin', hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('representante_id, despesa_cobranca, finalizado')
        .eq('data', hoje);

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  // Apenas representantes que finalizaram o dia entram no totalizador
  const repsFinalizadosHoje = new Set(
    despesasHojeRaw.filter((d: any) => d.finalizado).map((d: any) => d.representante_id)
  );
  const despesasHoje = despesasHojeRaw.filter((d: any) => d.finalizado);

  // Query para cobranças de hoje (cobrancas_diarias.total_cobrado) — filtradas por reps finalizados
  const { data: cobrancasHojeAll = [] } = useQuery({
    queryKey: ['cobrancas-hoje-admin', hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('representante_id, total_cobrado')
        .eq('data', hoje);

      if (error) throw error;
      return (data || []).map((d: any) => ({
        representante_id: d.representante_id,
        valor_pago: Number(d.total_cobrado) || 0,
      }));
    },
    refetchInterval: 30000,
  });

  const cobrancasHoje = cobrancasHojeAll.filter((c: any) =>
    repsFinalizadosHoje.has(c.representante_id)
  );

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

  // Extrair dias com fechamento por representante
  const diasComFechamentoPorRep = useMemo(() => {
    const result: Record<string, string[]> = {};
    cobrancasMes.forEach(c => {
      // Precisamos buscar as datas originais, não os agregados
    });
    return result;
  }, [cobrancasMes]);

  // Query para todas as datas de fechamento no período
  const { data: fechamentosData = [] } = useQuery({
    queryKey: ['fechamentos-admin', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('representante_id, data')
        .gte('data', startDate)
        .lte('data', endDate);
      
      if (error) throw error;
      return data;
    },
  });

  // Agrupar datas de fechamento por representante
  const diasFechamentoPorRep = useMemo(() => {
    const result: Record<string, string[]> = {};
    fechamentosData.forEach(f => {
      if (!result[f.representante_id]) {
        result[f.representante_id] = [];
      }
      result[f.representante_id].push(f.data);
    });
    return result;
  }, [fechamentosData]);

  // Todas as datas de fechamento (para query geral)
  const todasDatasFechamento = useMemo(() => {
    return [...new Set(fechamentosData.map(f => f.data))];
  }, [fechamentosData]);

  // Query para notas cobradas por representante (prestações de contas) - apenas em dias com fechamento
  const { data: notasPorRepresentante = {} } = useQuery({
    queryKey: ['notas-cobradas-admin', todasDatasFechamento],
    queryFn: async () => {
      if (todasDatasFechamento.length === 0) {
        return {};
      }
      
      const { data, error } = await supabase
        .from('prestacoes_contas')
        .select('representante_id, id, data_execucao')
        .in('data_execucao', todasDatasFechamento);
      
      if (error) throw error;
      
      // Contar apenas notas cujo representante teve fechamento naquele dia específico
      const agrupado = data.reduce((acc: Record<string, number>, curr) => {
        const id = curr.representante_id;
        const diasDoRep = diasFechamentoPorRep[id] || [];
        // Só conta se o representante fez fechamento nesse dia
        if (diasDoRep.includes(curr.data_execucao)) {
          acc[id] = (acc[id] || 0) + 1;
        }
        return acc;
      }, {});
      
      return agrupado;
    },
    enabled: todasDatasFechamento.length > 0,
  });

  // Total de notas cobradas (soma de todos representantes)
  const totalNotasCobradas = useMemo(() => {
    return Object.values(notasPorRepresentante).reduce((sum, count) => sum + count, 0);
  }, [notasPorRepresentante]);

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

  // Query para meta de produção do mês atual
  const { data: metaProducao } = useQuery({
    queryKey: ['meta-producao-admin', mesAtual],
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

  // Cálculos - FONTE FINANCEIRA OFICIAL: prestacoes_contas.valor_pago
  const totalHoje = cobrancasHoje.reduce((sum, c) => sum + (Number(c.valor_pago) || 0), 0);

  const totalPeriodo = cobrancasMes.reduce((sum, c) => sum + c.total_cobrado, 0);
  const totalDespesas = Object.values(despesasPorRep).reduce((sum, v) => sum + v, 0);

  // RESULTADO = Total Cobrado - Despesas
  const resultadoPeriodo = totalPeriodo - totalDespesas;
  
  const totalKits = kitsData?.length || 0;
  const totalProducaoHoje = producaoHoje.length;
  const totalEstoque = kitsEstoque.length;

  // Helpers de mascaramento
  const mv = (valor: number) => showValues ? formatarValor(valor) : 'R$ *****';
  const mn = (valor: number) => showValues ? formatarNumero(valor) : '*****';
  
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

  // Meta total e realizado (usa o Total Cobrado para cálculo de meta)
  const totalMeta = metas.reduce((sum, m) => sum + m.meta_valor, 0);
  const percentualMetaGeral = totalMeta > 0 ? (totalPeriodo / totalMeta) * 100 : 0;

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
      despesas: despesasPorRep[rep.id] || 0,
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

  // Despesas de hoje por representante
  const despesasHojePorRep = despesasHoje.reduce((acc: Record<string, number>, c) => {
    acc[c.representante_id] = (acc[c.representante_id] || 0) + (Number(c.despesa_cobranca) || 0);
    return acc;
  }, {});

  // Detalhamento de cobranças de hoje (agregado por representante)
  const cobrancasHojeAgrupadas = cobrancasHoje.reduce((acc: Record<string, number>, c) => {
    acc[c.representante_id] = (acc[c.representante_id] || 0) + (Number(c.valor_pago) || 0);
    return acc;
  }, {});

  const cobrancasHojeDetalhadas: CobrancaHojeRepresentante[] = Object.entries(cobrancasHojeAgrupadas).map(([id, total]) => {
    const rep = representantes.find(r => r.id === id);
    return {
      representante_id: id,
      nome: rep?.nome || 'Desconhecido',
      total_cobrado: total,
      despesa: despesasHojePorRep[id] || 0,
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
            
            {/* Ações: Ocultar valores + Filtro de Período */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowValues(!showValues)}
                className="shrink-0"
                title={showValues ? 'Ocultar valores' : 'Exibir valores'}
              >
                {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <DateRangeFilterPopover 
                onFilterChange={(start, end) => {
                  setStartDate(start);
                  setEndDate(end);
                }}
              />
            </div>
          </div>
          
          <div className="flex items-start gap-2 bg-background/50 backdrop-blur-sm rounded-lg p-2 md:p-3 border border-primary/10">
            <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-primary mt-0.5 animate-pulse shrink-0" />
            <p className="text-xs md:text-sm text-muted-foreground italic line-clamp-2">
              "{fraseMotivacional}"
            </p>
          </div>

        </div>
      </div>

      {/* Cards Principais - Grid Responsivo */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Card Total Hoje */}
        <Card 
          variant="interactive"
          className="cursor-pointer group animate-card-entrance animate-card-entrance-1 w-full max-w-full overflow-hidden"
          onClick={() => setCobrancaHojeDialogOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Hoje</CardTitle>
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
              <DollarSign className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-base md:text-2xl font-display font-bold truncate">{mv(totalHoje)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate">Somente dias finalizados</p>
          </CardContent>
        </Card>

        {/* Card Total do Período (FONTE FINANCEIRA OFICIAL) */}
        <Card 
          variant="interactive" 
          className="animate-card-entrance animate-card-entrance-2 w-full max-w-full overflow-hidden"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Total do Período</CardTitle>
            <div className="p-1.5 md:p-2 rounded-lg bg-chart-2/10 shrink-0">
              <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-chart-2" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-base md:text-2xl font-display font-bold truncate text-chart-2">{mv(totalPeriodo)}</div>
            <div className="text-[10px] md:text-xs text-muted-foreground mt-1 space-y-0.5">
              <p className="truncate">📉 Despesas: {mv(totalDespesas)}</p>
              <p className={`truncate font-medium ${resultadoPeriodo >= 0 ? 'text-chart-2' : 'text-destructive'}`}>
                💰 Resultado: {mv(resultadoPeriodo)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card Kits Entregues */}
        <Card 
          variant="interactive" 
          className="animate-card-entrance animate-card-entrance-3 w-full max-w-full overflow-hidden"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Kits Entregues</CardTitle>
            <div className="p-1.5 md:p-2 rounded-lg bg-chart-3/10 shrink-0">
              <Package className="h-3.5 w-3.5 md:h-4 md:w-4 text-chart-3" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-base md:text-2xl font-display font-bold truncate">{mn(totalKits)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate">No período</p>
          </CardContent>
        </Card>

        {/* Card Meta Geral */}
        <Card 
          variant="glow" 
          className="animate-card-entrance animate-card-entrance-4 w-full max-w-full overflow-hidden"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Meta Geral</CardTitle>
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10 animate-glow-pulse shrink-0">
              <Target className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-base md:text-2xl font-display font-bold text-primary truncate">
              {showValues ? `${percentualMetaGeral.toFixed(0)}%` : '***%'}
            </div>
            <Progress value={showValues ? Math.min(percentualMetaGeral, 100) : 0} className="mt-2 h-1.5 md:h-2" />
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
                    tickFormatter={(value) => showValues ? `${(value / 1000).toFixed(0)}k` : '*****'}
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
                    formatter={(value: number) => showValues ? formatarValor(value) : 'R$ *****'}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    isAnimationActive={false}
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
                      label={({ name, percent, x, y }) => (
                        <text
                          x={x}
                          y={y}
                          fill="hsl(var(--foreground))"
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={12}
                        >
                          {`${name} ${(percent * 100).toFixed(0)}%`}
                        </text>
                      )}
                      labelLine={false}
                    >
                      {dadosEstoquePie.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => `${value} kits`}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      isAnimationActive={false}
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
              <span className="text-2xl font-bold">{mn(totalEstoque)}</span>
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
                    Hoje: <span className="font-bold text-foreground">{mn(totalProducaoHoje)}</span> kits
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
            <CardContent className="pt-0 space-y-4">
              {/* Grid de Cards: 3 colunas */}
              <div className="grid gap-4 grid-cols-3">
                <div className="bg-chart-3/10 p-4 rounded-xl text-center">
                  <Package className="h-8 w-8 mx-auto text-chart-3 mb-2" />
                  <p className="text-sm text-muted-foreground">Produzidos Hoje</p>
                  <p className="text-3xl font-bold">{mn(totalProducaoHoje)}</p>
                </div>
                <div className="bg-primary/10 p-4 rounded-xl text-center">
                  <Package className="h-8 w-8 mx-auto text-primary mb-2" />
                  <p className="text-sm text-muted-foreground">No Período</p>
                  <p className="text-3xl font-bold">{mn(producaoPeriodo.length)}</p>
                </div>
                <div className="bg-chart-2/10 p-4 rounded-xl text-center">
                  <Warehouse className="h-8 w-8 mx-auto text-chart-2 mb-2" />
                  <p className="text-sm text-muted-foreground">Em Estoque</p>
                  <p className="text-3xl font-bold">{mn(totalEstoque)}</p>
                </div>
              </div>

              {/* Meta do Mês */}
              {metaProducao && metaProducao.meta_kits > 0 && (
                <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-5 w-5 text-chart-2" />
                    <span className="font-medium">
                      Meta do Mês: {format(new Date(), 'MMMM/yyyy', { locale: ptBR })}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>
                        Produzidos: <span className="font-bold">{mn(producaoPeriodo.length)}</span> / Meta: <span className="font-bold">{mn(metaProducao.meta_kits)}</span>
                      </span>
                      <span className="font-medium">
                        {showValues ? `${((producaoPeriodo.length / metaProducao.meta_kits) * 100).toFixed(1)}%` : '***%'}
                      </span>
                    </div>
                    <Progress 
                      value={showValues ? Math.min((producaoPeriodo.length / metaProducao.meta_kits) * 100, 100) : 0} 
                      className="h-3"
                    />
                  </div>

                  {/* Observação do Admin */}
                  {metaProducao.observacao && (
                    <div className="flex items-start gap-2 mt-3 p-2 bg-background/50 rounded-lg">
                      <Sparkles className="h-4 w-4 text-chart-2 shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">{metaProducao.observacao}</p>
                    </div>
                  )}

                  {/* Mensagem de meta atingida */}
                  {(producaoPeriodo.length / metaProducao.meta_kits) * 100 >= 100 && (
                    <div className="flex items-center gap-2 mt-3 p-3 bg-accent/50 rounded-lg border border-chart-2/30">
                      <Flame className="h-5 w-5 text-chart-2" />
                      <span className="font-medium text-chart-2">
                        🎉 Meta atingida! Parabéns equipe!
                      </span>
                    </div>
                  )}
                </div>
              )}
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
                            {rep.meta > 0 ? mv(rep.meta) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm">
                            {mv(rep.realizado)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {mv(rep.realizado - rep.despesas)}
                          </TableCell>
                          <TableCell className="text-right text-sm hidden md:table-cell">
                            {mn(rep.qtdNotas)}
                          </TableCell>
                          <TableCell className="text-right text-sm hidden md:table-cell">
                            {rep.qtdNotas > 0 ? mv(rep.ticketMedio) : '-'}
                          </TableCell>
                          <TableCell>
                            {rep.meta > 0 ? (
                              <div className="space-y-1 min-w-[100px]">
                                <div className="flex justify-between text-xs">
                                  <span className={`font-medium ${rep.percentual >= 100 ? 'text-chart-3' : ''}`}>
                                    {showValues ? `${rep.percentual.toFixed(0)}%` : '***%'}
                                  </span>
                                </div>
                                <Progress value={showValues ? Math.min(rep.percentual, 100) : 0} className="h-2" />
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
                  {mn(estoquePorTipo['inicial'] || 0)}
                </p>
              </div>
              <div className="bg-chart-2/10 p-4 rounded-xl text-center">
                <p className="text-sm text-muted-foreground">Kits Especiais</p>
                <p className="text-3xl font-bold text-chart-2">
                  {mn(estoquePorTipo['especial'] || 0)}
                </p>
              </div>
            </div>
            <div className="bg-chart-3/10 p-4 rounded-xl text-center">
              <p className="text-sm text-muted-foreground">Maletas</p>
              <p className="text-3xl font-bold text-chart-3">
                {mn(estoquePorTipo['maleta'] || 0)}
              </p>
            </div>
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Geral</span>
                <span className="text-2xl font-bold">{mn(totalEstoque)}</span>
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
                          Despesa: {mv(item.despesa)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{mv(item.total_cobrado)}</p>
                      {item.despesa > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Líquido: {mv(item.total_cobrado - item.despesa)}
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
                <span className="text-2xl font-bold text-primary">{mv(totalHoje)}</span>
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
