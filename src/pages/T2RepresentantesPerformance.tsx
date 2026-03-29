import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, TrendingUp, AlertTriangle, Search } from 'lucide-react';
import { formatarValor } from '@/lib/utils';
import { profilesLimited } from '@/lib/profilesLimited';
import { format, startOfDay } from 'date-fns';

export default function T2RepresentantesPerformance() {
  const [search, setSearch] = useState('');
  const hoje = startOfDay(new Date());

  const { data: representantes = [] } = useQuery({
    queryKey: ['reps-performance-v1'],
    queryFn: async () => {
      const { data } = await profilesLimited().select('id, nome').order('nome');
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'representante');
      const repIds = new Set(roles?.map((r: any) => r.user_id) || []);
      return (data || []).filter((p: any) => repIds.has(p.id));
    },
  });

  const { data: prestacoes = [], isLoading } = useQuery({
    queryKey: ['prestacoes-performance-v1'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prestacoes_contas')
        .select('representante_id, revendedora, total_venda, valor_devido_empresa, valor_pago, cobranca_id');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: cobrancasVencidas = [] } = useQuery({
    queryKey: ['cobrancas-vencidas-performance-v1'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('id, representante_id, revendedora, valor_previsto, valor_pago_acumulado, valor_adiantado, data_agendada, status, tipo')
        .in('status', ['pendente', 'parcial', 'reagendado'])
        .lt('data_agendada', format(hoje, 'yyyy-MM-dd'));
      if (error) throw error;
      return data || [];
    },
  });

  const cobrancaIds = cobrancasVencidas.map((c: any) => c.id);

  const { data: prestVencidas = [] } = useQuery({
    queryKey: ['prest-vencidas-performance-v1', cobrancaIds.length],
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

  const prestVencidasSet = useMemo(
    () => new Set(prestVencidas.map((p: any) => p.cobranca_id)),
    [prestVencidas]
  );

  const performance = useMemo(() => {
    const map = new Map<string, {
      representante_id: string;
      revendedoras: Set<string>;
      ciclos: Set<string>;
      totalVendido: number;
      totalDevido: number;
      inadimplencia: number;
    }>();

    representantes.forEach((r: any) => {
      map.set(r.id, {
        representante_id: r.id,
        revendedoras: new Set(),
        ciclos: new Set(),
        totalVendido: 0,
        totalDevido: 0,
        inadimplencia: 0,
      });
    });

    const processados = new Set<string>();
    prestacoes.forEach((p: any) => {
      if (p.cobranca_id) {
        if (processados.has(p.cobranca_id)) return;
        processados.add(p.cobranca_id);
      }
      const entry = map.get(p.representante_id);
      if (!entry) return;
      entry.revendedoras.add(p.revendedora);
      if (p.cobranca_id) entry.ciclos.add(p.cobranca_id);
      entry.totalVendido += Number(p.total_venda) || 0;
      entry.totalDevido += Number(p.valor_devido_empresa) || 0;
    });

    cobrancasVencidas.forEach((c: any) => {
      const tipoApurado = ['repasse', 'acrescimo'].includes((c.tipo || '').toLowerCase());
      if (!prestVencidasSet.has(c.id) && !tipoApurado) return;
      const saldo = Math.max(0,
        c.valor_previsto - (c.valor_pago_acumulado || 0) - (c.valor_adiantado || 0)
      );
      if (saldo <= 0) return;
      const entry = map.get(c.representante_id);
      if (entry) entry.inadimplencia += saldo;
    });

    return Array.from(map.values())
      .filter(r => r.totalVendido > 0 || r.inadimplencia > 0)
      .map(r => ({
        ...r,
        totalRevendedoras: r.revendedoras.size,
        totalCiclos: r.ciclos.size,
        ticketMedio: r.ciclos.size > 0 ? r.totalVendido / r.ciclos.size : 0,
        pctInadimplencia: r.totalDevido > 0 ? (r.inadimplencia / r.totalDevido) * 100 : 0,
      }))
      .sort((a, b) => b.totalVendido - a.totalVendido);
  }, [representantes, prestacoes, cobrancasVencidas, prestVencidasSet]);

  const getNome = (id: string) => representantes.find((r: any) => r.id === id)?.nome || '—';

  const filtered = useMemo(() => {
    if (!search) return performance;
    return performance.filter(p =>
      getNome(p.representante_id).toLowerCase().includes(search.toLowerCase())
    );
  }, [performance, search, representantes]);

  const topVendas = useMemo(() =>
    [...performance].sort((a, b) => b.totalVendido - a.totalVendido).slice(0, 3),
    [performance]
  );
  const topRede = useMemo(() =>
    [...performance].sort((a, b) => b.totalRevendedoras - a.totalRevendedoras).slice(0, 3),
    [performance]
  );
  const topAdimplentes = useMemo(() =>
    [...performance]
      .filter(p => p.totalDevido > 0)
      .sort((a, b) => a.pctInadimplencia - b.pctInadimplencia)
      .slice(0, 3),
    [performance]
  );

  const totais = useMemo(() => ({
    vendido: performance.reduce((s, p) => s + p.totalVendido, 0),
    revendedoras: performance.reduce((s, p) => s + p.totalRevendedoras, 0),
    inadimplencia: performance.reduce((s, p) => s + p.inadimplencia, 0),
  }), [performance]);

  const getInadColor = (pct: number) => {
    if (pct > 10) return 'bg-red-500/20 text-red-700 dark:text-red-400';
    if (pct >= 5) return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
    return 'bg-green-500/20 text-green-700 dark:text-green-400';
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Performance de Representantes</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada por representante</p>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Vendido</span>
            </div>
            <p className="text-xl font-bold text-foreground">{formatarValor(totais.vendido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Revendedoras</span>
            </div>
            <p className="text-xl font-bold text-foreground">{totais.revendedoras}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Inadimplência Total</span>
            </div>
            <p className="text-xl font-bold text-foreground">{formatarValor(totais.inadimplencia)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rankings */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">🏆 Top Vendas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topVendas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados</p>
            ) : topVendas.map((r, i) => (
              <div key={r.representante_id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                  <span className="text-sm truncate">{getNome(r.representante_id)}</span>
                </div>
                <span className="text-sm font-semibold shrink-0">{formatarValor(r.totalVendido)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">📈 Maior Rede</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topRede.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados</p>
            ) : topRede.map((r, i) => (
              <div key={r.representante_id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                  <span className="text-sm truncate">{getNome(r.representante_id)}</span>
                </div>
                <span className="text-sm font-semibold shrink-0">{r.totalRevendedoras} rev.</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">✅ Menor Inadimplência</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topAdimplentes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados</p>
            ) : topAdimplentes.map((r, i) => (
              <div key={r.representante_id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                  <span className="text-sm truncate">{getNome(r.representante_id)}</span>
                </div>
                <Badge className={getInadColor(r.pctInadimplencia)}>
                  {r.pctInadimplencia.toFixed(1)}%
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar representante..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Representante</TableHead>
                  <TableHead className="text-center">Revendedoras</TableHead>
                  <TableHead className="text-center">Ciclos</TableHead>
                  <TableHead className="text-right">Total Vendido</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                  <TableHead className="text-right">Inadimplência</TableHead>
                  <TableHead className="text-center">% Inad.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum dado encontrado
                    </TableCell>
                  </TableRow>
                ) : filtered.map(row => (
                  <TableRow key={row.representante_id}>
                    <TableCell className="font-medium">{getNome(row.representante_id)}</TableCell>
                    <TableCell className="text-center">{row.totalRevendedoras}</TableCell>
                    <TableCell className="text-center">{row.totalCiclos}</TableCell>
                    <TableCell className="text-right font-medium">{formatarValor(row.totalVendido)}</TableCell>
                    <TableCell className="text-right">{formatarValor(row.ticketMedio)}</TableCell>
                    <TableCell className="text-right">
                      {row.inadimplencia > 0 ? formatarValor(row.inadimplencia) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getInadColor(row.pctInadimplencia)}>
                        {row.pctInadimplencia.toFixed(1)}%
                      </Badge>
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
