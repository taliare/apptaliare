import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, TrendingUp, AlertTriangle, Trophy, Search } from 'lucide-react';

interface PerformanceRow {
  representante_id: string;
  total_revendedoras: number;
  revendedoras_ativas: number;
  revendedoras_em_risco: number;
  revendedoras_atencao: number;
  total_ciclos: number;
  total_vendido: number;
  ticket_medio: number;
  total_recebido_empresa: number;
  inadimplencia_total: number;
}

interface ProfileInfo {
  id: string;
  nome: string;
}

function getInadimplenciaLevel(inadimplencia: number, totalRecebido: number) {
  if (totalRecebido <= 0) return { label: '0%', color: 'bg-green-500/20 text-green-700 dark:text-green-400' };
  const pct = (inadimplencia / totalRecebido) * 100;
  if (pct > 10) return { label: `${pct.toFixed(1)}%`, color: 'bg-red-500/20 text-red-700 dark:text-red-400' };
  if (pct >= 5) return { label: `${pct.toFixed(1)}%`, color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' };
  return { label: `${pct.toFixed(1)}%`, color: 'bg-green-500/20 text-green-700 dark:text-green-400' };
}

export default function T2RepresentantesPerformance() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');

  const { data: performance = [], isLoading } = useQuery({
    queryKey: ['t2-performance-representantes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_vw_performance_representantes' as any)
        .select('*');
      if (error) throw error;
      return (data || []) as unknown as PerformanceRow[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-limited-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles_limited')
        .select('id, nome');
      if (error) throw error;
      return (data || []) as ProfileInfo[];
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach(p => m.set(p.id!, p.nome!));
    return m;
  }, [profiles]);

  const filtered = useMemo(() => {
    if (!search) return performance;
    const s = search.toLowerCase();
    return performance.filter(p => {
      const nome = profileMap.get(p.representante_id) || '';
      return nome.toLowerCase().includes(s);
    });
  }, [performance, search, profileMap]);

  // Rankings
  const rankingVendas = useMemo(() =>
    [...performance].sort((a, b) => b.total_vendido - a.total_vendido).slice(0, 5),
    [performance]
  );

  const rankingRede = useMemo(() =>
    [...performance].sort((a, b) => b.revendedoras_ativas - a.revendedoras_ativas).slice(0, 5),
    [performance]
  );

  const rankingMenorInadimplencia = useMemo(() =>
    [...performance]
      .filter(p => p.total_recebido_empresa > 0)
      .sort((a, b) => {
        const pctA = a.inadimplencia_total / a.total_recebido_empresa;
        const pctB = b.inadimplencia_total / b.total_recebido_empresa;
        return pctA - pctB;
      })
      .slice(0, 5),
    [performance]
  );

  const totais = useMemo(() => ({
    vendido: performance.reduce((s, p) => s + p.total_vendido, 0),
    revendedoras: performance.reduce((s, p) => s + p.total_revendedoras, 0),
    ativas: performance.reduce((s, p) => s + p.revendedoras_ativas, 0),
    inadimplencia: performance.reduce((s, p) => s + p.inadimplencia_total, 0),
  }), [performance]);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Performance de Representantes</h1>
        <p className="text-sm text-muted-foreground">TALIARE 2.0 — Visão consolidada por representante</p>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Vendido</span>
            </div>
            <p className="text-xl font-bold text-foreground">{fmt(totais.vendido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Revendedoras</span>
            </div>
            <p className="text-xl font-bold text-foreground">{totais.revendedoras}</p>
            <p className="text-xs text-muted-foreground">{totais.ativas} ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Representantes</span>
            </div>
            <p className="text-xl font-bold text-foreground">{performance.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Inadimplência</span>
            </div>
            <p className="text-xl font-bold text-foreground">{fmt(totais.inadimplencia)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rankings */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">🏆 Ranking Vendas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rankingVendas.map((r, i) => (
              <div key={r.representante_id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{i + 1}. {profileMap.get(r.representante_id) || '—'}</span>
                <span className="font-medium text-foreground">{fmt(r.total_vendido)}</span>
              </div>
            ))}
            {rankingVendas.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">📈 Maior Rede Ativa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rankingRede.map((r, i) => (
              <div key={r.representante_id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{i + 1}. {profileMap.get(r.representante_id) || '—'}</span>
                <span className="font-medium text-foreground">{r.revendedoras_ativas} ativas</span>
              </div>
            ))}
            {rankingRede.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">✅ Menor Inadimplência</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rankingMenorInadimplencia.map((r, i) => {
              const info = getInadimplenciaLevel(r.inadimplencia_total, r.total_recebido_empresa);
              return (
                <div key={r.representante_id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{i + 1}. {profileMap.get(r.representante_id) || '—'}</span>
                  <Badge className={info.color}>{info.label}</Badge>
                </div>
              );
            })}
            {rankingMenorInadimplencia.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
          </CardContent>
        </Card>
      </div>

      {/* Filtro */}
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Representante</TableHead>
                <TableHead className="text-center">Revendedoras</TableHead>
                <TableHead className="text-center">Ativas</TableHead>
                <TableHead className="text-center">Atenção</TableHead>
                <TableHead className="text-center">Risco</TableHead>
                <TableHead className="text-right">Total Vendido</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-center">Inadimplência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum dado encontrado</TableCell>
                </TableRow>
              ) : filtered.map(row => {
                const inadInfo = getInadimplenciaLevel(row.inadimplencia_total, row.total_recebido_empresa);
                return (
                  <TableRow key={row.representante_id}>
                    <TableCell className="font-medium">{profileMap.get(row.representante_id) || '—'}</TableCell>
                    <TableCell className="text-center">{row.total_revendedoras}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-green-500/20 text-green-700 dark:text-green-400">{row.revendedoras_ativas}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {row.revendedoras_atencao > 0 ? (
                        <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">{row.revendedoras_atencao}</Badge>
                      ) : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.revendedoras_em_risco > 0 ? (
                        <Badge className="bg-red-500/20 text-red-700 dark:text-red-400">{row.revendedoras_em_risco}</Badge>
                      ) : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmt(row.total_vendido)}</TableCell>
                    <TableCell className="text-right">{fmt(row.ticket_medio)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={inadInfo.color}>{inadInfo.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
