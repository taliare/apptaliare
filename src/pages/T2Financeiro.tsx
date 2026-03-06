import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, AlertTriangle, XCircle, Calendar, Search, Filter, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, addDays, startOfWeek, endOfWeek, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FINANCEIRO_LABELS, FINANCEIRO_COLORS } from '@/components/t2/constants';
import { getLocalDateString } from '@/lib/utils';
import { startOfMonth, endOfMonth } from 'date-fns';

interface PrevisaoRecebimento {
  ciclo_id: string;
  revendedora_id: string;
  nome_revendedora: string;
  representante_id: string;
  cidade: string | null;
  valor_empresa: number;
  valor_pago: number;
  saldo_restante: number;
  data_vencimento: string;
  status_ciclo: string;
  status_financeiro: string;
}

export default function T2Financeiro() {
  const [searchTerm, setSearchTerm] = useState('');
  const [cidadeFilter, setCidadeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [startDate, setStartDate] = useState(getLocalDateString(startOfMonth(new Date())));
  const [endDate, setEndDate] = useState(getLocalDateString(endOfMonth(addDays(new Date(), 90))));

  // Fetch previsão data
  const { data: previsoes = [], isLoading } = useQuery({
    queryKey: ['t2-previsao-recebimentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_vw_previsao_recebimentos' as any)
        .select('*');
      if (error) throw error;
      return (data || []) as unknown as PrevisaoRecebimento[];
    },
  });

  // Fetch profiles for representative names
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-limited-financeiro'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles_limited')
        .select('id, nome');
      if (error) throw error;
      return data || [];
    },
  });

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach(p => { if (p.id && p.nome) map[p.id] = p.nome; });
    return map;
  }, [profiles]);

  // Unique cities and representatives for filters
  const cidades = useMemo(() => {
    const set = new Set<string>();
    previsoes.forEach(p => { if (p.cidade) set.add(p.cidade); });
    return Array.from(set).sort();
  }, [previsoes]);

  const representantes = useMemo(() => {
    const set = new Set<string>();
    previsoes.forEach(p => set.add(p.representante_id));
    return Array.from(set);
  }, [previsoes]);

  const [repFilter, setRepFilter] = useState<string>('todos');

  // Filtered data
  const filtered = useMemo(() => {
    return previsoes.filter(p => {
      if (searchTerm && !p.nome_revendedora?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (cidadeFilter && cidadeFilter !== 'todas' && p.cidade !== cidadeFilter) return false;
      if (statusFilter !== 'todos' && p.status_financeiro !== statusFilter) return false;
      if (repFilter !== 'todos' && p.representante_id !== repFilter) return false;
      if (startDate && p.data_vencimento < startDate) return false;
      if (endDate && p.data_vencimento > endDate + 'T23:59:59') return false;
      return true;
    });
  }, [previsoes, searchTerm, cidadeFilter, statusFilter, repFilter, startDate, endDate]);

  // Dashboard totals
  const totals = useMemo(() => {
    const result = { recebido: 0, a_receber: 0, em_risco: 0, inadimplente: 0, previsao30: 0 };
    const now = new Date();
    const in30 = addDays(now, 30);

    filtered.forEach(p => {
      switch (p.status_financeiro) {
        case 'RECEBIDO': result.recebido += p.valor_pago; break;
        case 'A_RECEBER': result.a_receber += p.saldo_restante; break;
        case 'EM_RISCO': result.em_risco += p.saldo_restante; break;
        case 'INADIMPLENTE': result.inadimplente += p.saldo_restante; break;
      }
      // Previsão 30 dias
      if (p.saldo_restante > 0 && p.data_vencimento) {
        const venc = new Date(p.data_vencimento);
        if (venc >= now && venc <= in30) {
          result.previsao30 += p.saldo_restante;
        }
      }
    });
    return result;
  }, [filtered]);

  // Tabela por representante
  const repSummary = useMemo(() => {
    const map: Record<string, { recebido: number; a_receber: number; em_risco: number; inadimplente: number }> = {};
    filtered.forEach(p => {
      if (!map[p.representante_id]) {
        map[p.representante_id] = { recebido: 0, a_receber: 0, em_risco: 0, inadimplente: 0 };
      }
      const s = map[p.representante_id];
      switch (p.status_financeiro) {
        case 'RECEBIDO': s.recebido += p.valor_pago; break;
        case 'A_RECEBER': s.a_receber += p.saldo_restante; break;
        case 'EM_RISCO': s.em_risco += p.saldo_restante; break;
        case 'INADIMPLENTE': s.inadimplente += p.saldo_restante; break;
      }
    });
    return Object.entries(map).map(([id, vals]) => ({ representante_id: id, nome: profileMap[id] || 'Desconhecido', ...vals }));
  }, [filtered, profileMap]);

  // Gráfico de caixa - agrupado por semana
  const chartData = useMemo(() => {
    const weekMap: Record<string, number> = {};
    filtered.forEach(p => {
      if (p.saldo_restante <= 0 || !p.data_vencimento) return;
      const date = new Date(p.data_vencimento);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const key = format(weekStart, 'dd/MM', { locale: ptBR });
      weekMap[key] = (weekMap[key] || 0) + p.saldo_restante;
    });
    return Object.entries(weekMap)
      .map(([semana, valor]) => ({ semana, valor }))
      .sort((a, b) => a.semana.localeCompare(b.semana))
      .slice(0, 12);
  }, [filtered]);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const clearFilters = () => {
    setSearchTerm('');
    setCidadeFilter('');
    setStatusFilter('todos');
    setRepFilter('todos');
    setStartDate(getLocalDateString(startOfMonth(new Date())));
    setEndDate(getLocalDateString(endOfMonth(addDays(new Date(), 90))));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Financeiro T2</h1>
        <p className="text-sm text-muted-foreground">Previsão de recebimentos e fluxo de caixa</p>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4 border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-xs text-muted-foreground">Recebido</span>
          </div>
          <p className="text-lg font-bold text-foreground">{fmt(totals.recebido)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-muted-foreground">A Receber</span>
          </div>
          <p className="text-lg font-bold text-foreground">{fmt(totals.a_receber)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-yellow-500">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-xs text-muted-foreground">Em Risco</span>
          </div>
          <p className="text-lg font-bold text-foreground">{fmt(totals.em_risco)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="text-xs text-muted-foreground">Inadimplente</span>
          </div>
          <p className="text-lg font-bold text-foreground">{fmt(totals.inadimplente)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-purple-500 col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-muted-foreground">Previsão 30 dias</span>
          </div>
          <p className="text-lg font-bold text-foreground">{fmt(totals.previsao30)}</p>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium mb-1 block">Buscar Revendedora</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
          </div>
          <div className="min-w-[150px]">
            <label className="text-xs font-medium mb-1 block">Representante</label>
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {representantes.map(id => (
                  <SelectItem key={id} value={id}>{profileMap[id] || id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[130px]">
            <label className="text-xs font-medium mb-1 block">Cidade</label>
            <Select value={cidadeFilter || 'todas'} onValueChange={v => setCidadeFilter(v === 'todas' ? '' : v)}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {cidades.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[130px]">
            <label className="text-xs font-medium mb-1 block">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(FINANCEIRO_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[130px]">
            <label className="text-xs font-medium mb-1 block">De</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm" />
          </div>
          <div className="min-w-[130px]">
            <label className="text-xs font-medium mb-1 block">Até</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm" />
          </div>
          <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-3 w-3" /> Limpar
          </Button>
        </div>
      </Card>

      {/* Gráfico de Caixa */}
      {chartData.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Previsão de Recebimento por Semana</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={l => `Semana de ${l}`} />
              <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Tabela por Representante */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Resumo por Representante</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Representante</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">A Receber</TableHead>
                <TableHead className="text-right">Em Risco</TableHead>
                <TableHead className="text-right">Inadimplência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repSummary.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum dado encontrado</TableCell></TableRow>
              ) : repSummary.map(r => (
                <TableRow key={r.representante_id}>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell className="text-right text-green-600">{fmt(r.recebido)}</TableCell>
                  <TableCell className="text-right text-blue-600">{fmt(r.a_receber)}</TableCell>
                  <TableCell className="text-right text-yellow-600">{fmt(r.em_risco)}</TableCell>
                  <TableCell className="text-right text-red-600">{fmt(r.inadimplente)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Tabela Detalhada */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Detalhamento por Ciclo ({filtered.length})</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Revendedora</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Representante</TableHead>
                <TableHead className="text-right">Valor Empresa</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
              ) : filtered.slice(0, 100).map(p => (
                <TableRow key={p.ciclo_id}>
                  <TableCell className="font-medium">{p.nome_revendedora}</TableCell>
                  <TableCell>{p.cidade || '-'}</TableCell>
                  <TableCell>{profileMap[p.representante_id] || '-'}</TableCell>
                  <TableCell className="text-right">{fmt(p.valor_empresa)}</TableCell>
                  <TableCell className="text-right">{fmt(p.valor_pago)}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(p.saldo_restante)}</TableCell>
                  <TableCell>{p.data_vencimento ? format(new Date(p.data_vencimento), 'dd/MM/yyyy') : '-'}</TableCell>
                  <TableCell>
                    <Badge className={FINANCEIRO_COLORS[p.status_financeiro] || 'bg-muted text-muted-foreground'}>
                      {FINANCEIRO_LABELS[p.status_financeiro] || p.status_financeiro}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length > 100 && (
            <p className="text-xs text-muted-foreground text-center mt-2">Mostrando 100 de {filtered.length} registros</p>
          )}
        </div>
      </Card>
    </div>
  );
}
