import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Search, Users, TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import { CATEGORIA_COLORS, CATEGORIA_LABELS } from '@/components/t2/constants';

export default function T2Ranking() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [search, setSearch] = useState('');
  const [cidadeFilter, setCidadeFilter] = useState('all');

  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ['t2-ranking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_vw_ranking_revendedoras' as any)
        .select('*');
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-limited-t2'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles_limited').select('id, nome');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const cidades = [...new Set(ranking.map((r: any) => r.cidade).filter(Boolean))].sort();

  const filtered = ranking.filter((r: any) => {
    if (search && !r.nome_revendedora?.toLowerCase().includes(search.toLowerCase())) return false;
    if (cidadeFilter !== 'all' && r.cidade !== cidadeFilter) return false;
    return true;
  });

  const getRepName = (id: string) => profiles.find((p: any) => p.id === id)?.nome || '—';
  const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  // Dashboard cards
  const totalRevendedoras = ranking.length;
  const categoryCounts = ranking.reduce((acc: Record<string, number>, r: any) => {
    const cat = r.categoria_atual || 'SEM CATEGORIA';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const totalVendido = ranking.reduce((s: number, r: any) => s + Number(r.total_vendido || 0), 0);
  const ticketMedio = totalRevendedoras > 0
    ? ranking.reduce((s: number, r: any) => s + Number(r.total_vendido || 0), 0) / Math.max(1, ranking.filter((r: any) => Number(r.total_vendido) > 0).length)
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ranking T2</h1>
        <p className="text-sm text-muted-foreground">Performance das revendedoras TALIARE 2.0</p>
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" /><span className="text-xs">Revendedoras</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalRevendedoras}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" /><span className="text-xs">Volume Vendido</span>
            </div>
            <p className="text-2xl font-bold text-foreground">R$ {fmt(totalVendido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" /><span className="text-xs">Ticket Médio</span>
            </div>
            <p className="text-2xl font-bold text-foreground">R$ {fmt(ticketMedio)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" /><span className="text-xs">Por Categoria</span>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {['ELITE', 'DESTAQUE', 'ATIVA', 'INICIAL'].map(cat => (
                <Badge key={cat} className={`${CATEGORIA_COLORS[cat] || ''} text-[10px]`}>
                  {CATEGORIA_LABELS[cat] || cat}: {categoryCounts[cat] || 0}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar revendedora..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {cidades.length > 0 && (
          <Select value={cidadeFilter} onValueChange={setCidadeFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Cidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as cidades</SelectItem>
              {cidades.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Trophy className="h-12 w-12 mx-auto mb-4 opacity-40" /><p>Nenhuma revendedora encontrada</p></CardContent></Card>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Revendedora</TableHead>
                <TableHead className="hidden md:table-cell">Cidade</TableHead>
                {isAdmin && <TableHead className="hidden lg:table-cell">Representante</TableHead>}
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Total Vendido</TableHead>
                <TableHead className="hidden md:table-cell text-right">Ciclos</TableHead>
                <TableHead className="hidden md:table-cell text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r: any, idx: number) => (
                <TableRow key={r.revendedora_id}>
                  <TableCell className="font-bold text-muted-foreground">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                  </TableCell>
                  <TableCell className="font-medium">{r.nome_revendedora}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{r.cidade || '—'}</TableCell>
                  {isAdmin && <TableCell className="hidden lg:table-cell text-muted-foreground">{getRepName(r.representante_id)}</TableCell>}
                  <TableCell>
                    <Badge className={CATEGORIA_COLORS[r.categoria_atual] || 'bg-muted text-muted-foreground'}>
                      {CATEGORIA_LABELS[r.categoria_atual] || r.categoria_atual || '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">R$ {fmt(r.total_vendido)}</TableCell>
                  <TableCell className="hidden md:table-cell text-right text-muted-foreground">{r.total_ciclos}</TableCell>
                  <TableCell className="hidden md:table-cell text-right text-muted-foreground">{r.score}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
