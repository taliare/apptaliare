import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wifi, AlertTriangle, XCircle, Activity, Search } from 'lucide-react';
import { formatarValor, formatDateBR } from '@/lib/utils';
import { profilesLimited } from '@/lib/profilesLimited';
import { differenceInDays, startOfDay, subDays, format } from 'date-fns';

type StatusRadar = 'ATIVA' | 'ATENCAO' | 'RISCO';

interface RevendedoraRadar {
  nome: string;
  representante_id: string;
  cobranca_id: string;
  codigo_nota: string | null;
  data_agendada: string;
  diasVencida: number;
  saldo: number;
  ultimoPagamento: string | null;
  status: StatusRadar;
}

export default function T2RadarRede() {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [filtroRepresentante, setFiltroRepresentante] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca] = useState('');

  const hoje = startOfDay(new Date());
  const ha15dias = format(subDays(hoje, 15), 'yyyy-MM-dd');
  const ha30dias = format(subDays(hoje, 30), 'yyyy-MM-dd');

  // Representantes (admin only)
  const { data: representantes = [] } = useQuery({
    queryKey: ['reps-radar-v1'],
    queryFn: async () => {
      const { data } = await profilesLimited().select('id, nome').order('nome');
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'representante');
      const repIds = new Set(roles?.map((r: any) => r.user_id) || []);
      return (data || []).filter((p: any) => repIds.has(p.id));
    },
    enabled: isAdmin,
  });

  // Cobranças abertas
  const { data: cobrancas = [], isLoading: loadingCob } = useQuery({
    queryKey: ['radar-cobrancas-v1', user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from('cobrancas_agendadas')
        .select('id, representante_id, revendedora, valor_previsto, valor_pago_acumulado, valor_adiantado, data_agendada, status, tipo, codigo_nota')
        .in('status', ['pendente', 'parcial', 'reagendado']);

      if (!isAdmin) {
        query = query.eq('representante_id', user!.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Prestações para identificar quais foram apuradas
  const cobrancaIds = cobrancas.map((c: any) => c.id);
  const { data: prestacoes = [] } = useQuery({
    queryKey: ['radar-prestacoes-v1', cobrancaIds.length],
    queryFn: async () => {
      if (cobrancaIds.length === 0) return [];
      const { data, error } = await supabase
        .from('prestacoes_contas')
        .select('cobranca_id')
        .in('cobranca_id', cobrancaIds);
      if (error) throw error;
      return data || [];
    },
    enabled: cobrancaIds.length > 0,
  });

  // Notas promissórias dos últimos 30 dias por cobranca_id
  const { data: notas = [] } = useQuery({
    queryKey: ['radar-notas-v1', cobrancaIds.length],
    queryFn: async () => {
      if (cobrancaIds.length === 0) return [];
      const { data, error } = await supabase
        .from('notas_promissorias')
        .select('cobranca_id, data, valor_total')
        .in('cobranca_id', cobrancaIds)
        .gte('data', ha30dias)
        .gt('valor_total', 0);
      if (error) throw error;
      return data || [];
    },
    enabled: cobrancaIds.length > 0,
  });

  const prestSet = useMemo(() => new Set(prestacoes.map((p: any) => p.cobranca_id)), [prestacoes]);

  // Mapa: cobranca_id → data do último pagamento
  const ultimoPagamentoMap = useMemo(() => {
    const map = new Map<string, string>();
    notas.forEach((n: any) => {
      if (!n.cobranca_id) return;
      const atual = map.get(n.cobranca_id);
      if (!atual || n.data > atual) map.set(n.cobranca_id, n.data);
    });
    return map;
  }, [notas]);

  // Calcular status do radar
  const calcularStatus = (diasVencida: number, cobrancaId: string): StatusRadar => {
    if (diasVencida <= 0) return 'ATIVA';

    const ultimoPag = ultimoPagamentoMap.get(cobrancaId);

    if (diasVencida > 30) {
      if (!ultimoPag || ultimoPag < ha30dias) return 'RISCO';
      if (!ultimoPag || ultimoPag < ha15dias) return 'ATENCAO';
      return 'ATIVA';
    }

    if (diasVencida > 15) {
      if (!ultimoPag || ultimoPag < ha15dias) return 'ATENCAO';
      return 'ATIVA';
    }

    return 'ATIVA';
  };

  // Montar lista do radar
  const radarData = useMemo((): RevendedoraRadar[] => {
    const porRevendedora = new Map<string, RevendedoraRadar>();

    cobrancas.forEach((c: any) => {
      const tipoApurado = ['repasse', 'acrescimo'].includes((c.tipo || '').toLowerCase());
      const jaApurada = prestSet.has(c.id) || tipoApurado;

      const acumulado = c.valor_pago_acumulado || 0;
      const adiantado = c.valor_adiantado || 0;
      const saldo = Math.max(0, c.valor_previsto - acumulado - adiantado);

      if (jaApurada && saldo <= 0) return;

      const dataAgendada = startOfDay(new Date(c.data_agendada + 'T12:00:00'));
      const diasVencida = differenceInDays(hoje, dataAgendada);

      const status = jaApurada
        ? calcularStatus(diasVencida, c.id)
        : diasVencida <= 0 ? 'ATIVA' : calcularStatus(diasVencida, c.id);

      const ultimoPag = ultimoPagamentoMap.get(c.id) || null;

      const entrada: RevendedoraRadar = {
        nome: c.revendedora,
        representante_id: c.representante_id,
        cobranca_id: c.id,
        codigo_nota: c.codigo_nota,
        data_agendada: c.data_agendada,
        diasVencida,
        saldo: jaApurada ? saldo : 0,
        ultimoPagamento: ultimoPag,
        status,
      };

      const chave = `${c.representante_id}-${c.revendedora}`;
      const existente = porRevendedora.get(chave);
      const prioridade: Record<StatusRadar, number> = { RISCO: 3, ATENCAO: 2, ATIVA: 1 };
      if (!existente || prioridade[status] > prioridade[existente.status]) {
        porRevendedora.set(chave, entrada);
      }
    });

    return Array.from(porRevendedora.values())
      .sort((a, b) => {
        const p: Record<StatusRadar, number> = { RISCO: 3, ATENCAO: 2, ATIVA: 1 };
        return p[b.status] - p[a.status] || b.diasVencida - a.diasVencida;
      });
  }, [cobrancas, prestSet, ultimoPagamentoMap, hoje]);

  // Filtros
  const filtrado = useMemo(() => {
    return radarData.filter(r => {
      if (isAdmin && filtroRepresentante !== 'todos' && r.representante_id !== filtroRepresentante) return false;
      if (filtroStatus !== 'todos' && r.status !== filtroStatus) return false;
      if (busca && !r.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [radarData, filtroRepresentante, filtroStatus, busca, isAdmin]);

  // Stats
  const stats = useMemo(() => ({
    total: filtrado.length,
    ativas: filtrado.filter(r => r.status === 'ATIVA').length,
    atencao: filtrado.filter(r => r.status === 'ATENCAO').length,
    risco: filtrado.filter(r => r.status === 'RISCO').length,
  }), [filtrado]);

  const getNome = (id: string) => representantes.find((r: any) => r.id === id)?.nome || '—';

  const statusConfig = {
    ATIVA: { label: 'Ativa', color: 'bg-green-500/20 text-green-700 dark:text-green-400', icon: Wifi },
    ATENCAO: { label: 'Atenção', color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400', icon: AlertTriangle },
    RISCO: { label: 'Risco', color: 'bg-red-500/20 text-red-700 dark:text-red-400', icon: XCircle },
  };

  const isLoading = loadingCob;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Radar da Rede</h1>
        <p className="text-sm text-muted-foreground">Monitoramento de atividade das revendedoras</p>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Ativas</span>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.ativas}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Atenção</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.atencao}</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Risco</span>
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.risco}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Rede Ativa</span>
            </div>
            <p className="text-2xl font-bold text-primary">
              {stats.total > 0 ? Math.round((stats.ativas / stats.total) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar revendedora..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>

            {isAdmin && (
              <Select value={filtroRepresentante} onValueChange={setFiltroRepresentante}>
                <SelectTrigger>
                  <SelectValue placeholder="Representante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {representantes.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ATIVA">Ativa</SelectItem>
                <SelectItem value="ATENCAO">Atenção</SelectItem>
                <SelectItem value="RISCO">Risco</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{filtrado.length} revendedoras monitoradas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filtrado.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma revendedora encontrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Revendedora</TableHead>
                    {isAdmin && <TableHead>Representante</TableHead>}
                    <TableHead>Nota</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-center">Dias Vencida</TableHead>
                    <TableHead>Último Pag.</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrado.map(r => {
                    const cfg = statusConfig[r.status];
                    const Icon = cfg.icon;
                    return (
                      <TableRow key={r.cobranca_id}>
                        <TableCell className="font-medium">{r.nome}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-muted-foreground text-sm">
                            {getNome(r.representante_id)}
                          </TableCell>
                        )}
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {r.codigo_nota || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {r.saldo > 0 ? formatarValor(r.saldo) : '—'}
                        </TableCell>
                        <TableCell>
                          {formatDateBR(r.data_agendada)}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.diasVencida > 0 ? (
                            <span className={
                              r.diasVencida > 30 ? 'text-red-600 font-bold' :
                              r.diasVencida > 15 ? 'text-yellow-600 font-medium' :
                              'text-muted-foreground'
                            }>
                              {r.diasVencida}d
                            </span>
                          ) : (
                            <span className="text-green-600 text-sm">No prazo</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.ultimoPagamento ? formatDateBR(r.ultimoPagamento) : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={cfg.color} variant="secondary">
                            <Icon className="h-3 w-3 mr-1" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
