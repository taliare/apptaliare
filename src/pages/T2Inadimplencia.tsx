import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, DollarSign, Users, TrendingDown } from 'lucide-react';
import { differenceInDays, startOfDay, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarValor } from '@/lib/utils';
import { profilesLimited } from '@/lib/profilesLimited';

export default function T2Inadimplencia() {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [filtroRepresentante, setFiltroRepresentante] = useState('todos');
  const [filtroAtraso, setFiltroAtraso] = useState('todos');
  const [busca, setBusca] = useState('');

  const hoje = startOfDay(new Date());

  // Buscar representantes (admin only)
  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes-inadimplencia'],
    queryFn: async () => {
      const { data } = await profilesLimited().select('id, nome').order('nome');
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'representante');
      const repIds = new Set(roles?.map((r: any) => r.user_id) || []);
      return (data || []).filter((p: any) => repIds.has(p.id));
    },
    enabled: isAdmin,
  });

  // Buscar cobranças vencidas com saldo em aberto
  const { data: cobrancas = [], isLoading } = useQuery({
    queryKey: ['inadimplencia-v1', user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from('cobrancas_agendadas')
        .select('id, revendedora, representante_id, valor_previsto, valor_pago_acumulado, valor_adiantado, data_agendada, status, tipo, codigo_nota')
        .in('status', ['pendente', 'parcial', 'reagendado'])
        .lt('data_agendada', format(hoje, 'yyyy-MM-dd'))
        .order('data_agendada', { ascending: true });

      if (!isAdmin) {
        query = query.eq('representante_id', user!.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Buscar prestações para saber quais já foram apuradas
  const cobrancaIds = cobrancas.map(c => c.id);
  const { data: prestacoes = [] } = useQuery({
    queryKey: ['inadimplencia-prestacoes', cobrancaIds],
    queryFn: async () => {
      if (cobrancaIds.length === 0) return [];
      const { data, error } = await supabase
        .from('prestacoes_contas')
        .select('cobranca_id, valor_devido_empresa')
        .in('cobranca_id', cobrancaIds);
      if (error) throw error;
      return data || [];
    },
    enabled: cobrancaIds.length > 0,
  });

  const prestacaoMap = useMemo(() => {
    const map = new Map<string, number>();
    prestacoes.forEach(p => {
      if (p.cobranca_id) map.set(p.cobranca_id, p.valor_devido_empresa);
    });
    return map;
  }, [prestacoes]);

  // Calcular inadimplentes
  const inadimplentes = useMemo(() => {
    return cobrancas
      .map(c => {
        const acumulado = (c as any).valor_pago_acumulado || 0;
        const adiantado = c.valor_adiantado || 0;
        const jaApurada = prestacaoMap.has(c.id);
        const tipoJaApurado = ['repasse', 'acrescimo'].includes((c.tipo || '').toLowerCase());

        // Calcular saldo real
        let saldo = 0;
        if (jaApurada || tipoJaApurado) {
          saldo = Math.max(0, c.valor_previsto - acumulado - adiantado);
        } else {
          // Kit ainda não apurado — não conta como inadimplência real
          return null;
        }

        if (saldo <= 0) return null;

        const diasAtraso = differenceInDays(hoje, startOfDay(new Date(c.data_agendada + 'T12:00:00')));

        return {
          ...c,
          saldo,
          diasAtraso,
        };
      })
      .filter(Boolean) as any[];
  }, [cobrancas, prestacaoMap, hoje]);

  // Aplicar filtros
  const inadimplentesFiltered = useMemo(() => {
    return inadimplentes.filter((c: any) => {
      if (isAdmin && filtroRepresentante !== 'todos' && c.representante_id !== filtroRepresentante) return false;
      if (busca && !c.revendedora.toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroAtraso === '0-15' && c.diasAtraso > 15) return false;
      if (filtroAtraso === '16-30' && (c.diasAtraso < 16 || c.diasAtraso > 30)) return false;
      if (filtroAtraso === '31+' && c.diasAtraso < 31) return false;
      return true;
    }).sort((a: any, b: any) => b.diasAtraso - a.diasAtraso);
  }, [inadimplentes, filtroRepresentante, busca, filtroAtraso, isAdmin]);

  // Totais
  const totalSaldo = inadimplentesFiltered.reduce((s: number, c: any) => s + c.saldo, 0);
  const totalRevendedoras = new Set(inadimplentesFiltered.map((c: any) => c.revendedora)).size;
  const maiorAtraso = inadimplentesFiltered[0]?.diasAtraso || 0;

  const getRepNome = (id: string) => representantes.find((r: any) => r.id === id)?.nome || '—';

  const getAtrasoColor = (dias: number) => {
    if (dias <= 15) return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
    if (dias <= 30) return 'bg-orange-500/20 text-orange-700 dark:text-orange-400';
    return 'bg-red-500/20 text-red-700 dark:text-red-400';
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inadimplência</h1>
        <p className="text-sm text-muted-foreground">Cobranças vencidas com saldo pendente após apuração</p>
      </div>

      {/* Cards resumo */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              Total em aberto
            </div>
            <p className="text-2xl font-bold text-destructive">{formatarValor(totalSaldo)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              Revendedoras
            </div>
            <p className="text-2xl font-bold">{totalRevendedoras}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown className="h-4 w-4" />
              Maior atraso
            </div>
            <p className="text-2xl font-bold">{maiorAtraso} dias</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Buscar revendedora..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="max-w-xs"
        />
        {isAdmin && (
          <Select value={filtroRepresentante} onValueChange={setFiltroRepresentante}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Representante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {representantes.map((r: any) => (
                <SelectItem key={r.id} value={r.id!}>{r.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filtroAtraso} onValueChange={setFiltroAtraso}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Atraso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="0-15">0 — 15 dias</SelectItem>
            <SelectItem value="16-30">16 — 30 dias</SelectItem>
            <SelectItem value="31+">31+ dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : inadimplentesFiltered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p>Nenhuma inadimplência encontrada</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {inadimplentesFiltered.length} cobranças em atraso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-3 px-2 font-medium text-muted-foreground">Revendedora</th>
                    {isAdmin && <th className="py-3 px-2 font-medium text-muted-foreground">Representante</th>}
                    <th className="py-3 px-2 font-medium text-muted-foreground">Nota</th>
                    <th className="py-3 px-2 font-medium text-muted-foreground text-right">Saldo</th>
                    <th className="py-3 px-2 font-medium text-muted-foreground text-center">Vencimento</th>
                    <th className="py-3 px-2 font-medium text-muted-foreground text-center">Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {inadimplentesFiltered.map((c: any) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-2 font-medium">{c.revendedora}</td>
                      {isAdmin && (
                        <td className="py-3 px-2 text-muted-foreground">{getRepNome(c.representante_id)}</td>
                      )}
                      <td className="py-3 px-2 text-muted-foreground">
                        {c.codigo_nota || '—'}
                      </td>
                      <td className="py-3 px-2 text-right font-semibold text-destructive">
                        {formatarValor(c.saldo)}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {format(new Date(c.data_agendada + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <Badge className={`text-xs ${getAtrasoColor(c.diasAtraso)}`}>
                          {c.diasAtraso} dias
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
