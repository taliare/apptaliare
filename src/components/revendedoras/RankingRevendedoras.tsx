import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, TrendingUp, Users, Star, Eye, Award } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { profilesLimited } from '@/lib/profilesLimited';
import { formatarValor } from '@/lib/utils';
import { format, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PerfilRevendedoraDialog } from './PerfilRevendedoraDialog';

interface Profile {
  id: string;
  nome: string;
}

export function calcularNivel(ticketMedio: number): { nivel: string; cor: string } {
  if (ticketMedio >= 2000) return { nivel: 'Elite', cor: 'purple' };
  if (ticketMedio >= 1000) return { nivel: 'Destaque', cor: 'orange' };
  if (ticketMedio >= 300) return { nivel: 'Ativa', cor: 'blue' };
  return { nivel: 'Inicial', cor: 'gray' };
}

interface RankingRevendedorasProps {
  representantes: Profile[];
  representanteFiltro: string;
  setRepresentanteFiltro: (v: string) => void;
}

interface RevendedoraRanking {
  nome: string;
  representanteId: string | null;
  representanteNome: string;
  ciclos: number;
  volumeVendido: number;
  comissaoTotal: number;
  valorEmpresa: number;
  valorPago: number;
  saldoDevedor: number;
  ticketMedio: number;
  nivel: string;
  cor: string;
  quitada: boolean;
}

export default function RankingRevendedoras({ representantes, representanteFiltro, setRepresentanteFiltro }: RankingRevendedorasProps) {
  const [mesSelecionado, setMesSelecionado] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [ordenacao, setOrdenacao] = useState<'volume' | 'ciclos' | 'ticket'>('volume');
  const [perfilAberto, setPerfilAberto] = useState<string | null>(null);

  const mesesDisponiveis = useMemo(() => {
    const meses = [];
    for (let i = -1; i <= 11; i++) {
      const d = subMonths(new Date(), i - 1);
      meses.push({
        value: format(d, 'yyyy-MM'),
        label: format(d, "MMMM 'de' yyyy", { locale: ptBR }),
      });
    }
    return meses;
  }, []);

  const { data: prestacoes = [], isLoading } = useQuery({
    queryKey: ['ranking-revendedoras', mesSelecionado, representanteFiltro],
    queryFn: async () => {
      const inicio = `${mesSelecionado}-01`;
      const fim = format(endOfMonth(new Date(`${mesSelecionado}-01`)), 'yyyy-MM-dd');

      let query = supabase
        .from('prestacoes_contas')
        .select('cobranca_id, revendedora, representante_id, total_venda, comissao_percentual, comissao_valor, valor_devido_empresa, valor_pago, saldo_devedor, data_execucao')
        .gt('total_venda', 0)
        .gte('data_execucao', inicio)
        .lte('data_execucao', fim);

      if (representanteFiltro !== 'todos') {
        query = query.eq('representante_id', representanteFiltro);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    representantes.forEach(r => map.set(r.id, r.nome));
    return map;
  }, [representantes]);

  const prestacoesDeduplicated = useMemo(() => {
    if (!prestacoes) return [];
    const porCobranca = new Map<string, any>();
    for (const p of prestacoes) {
      if (!p.cobranca_id) continue;
      const existente = porCobranca.get(p.cobranca_id);
      if (!existente || Number(p.total_venda) > Number(existente.total_venda)) {
        porCobranca.set(p.cobranca_id, p);
      }
    }
    const semCobrancaId = prestacoes.filter(p => !p.cobranca_id);
    return [...porCobranca.values(), ...semCobrancaId];
  }, [prestacoes]);

  const ranking = useMemo(() => {
    const grouped = new Map<string, { repId: string | null; totalVenda: number; comissao: number; empresa: number; valorPago: number; saldoDevedor: number; count: number }>();

    prestacoesDeduplicated.forEach(p => {
      const nome = p.revendedora;
      const existing = grouped.get(nome) || { repId: null, totalVenda: 0, comissao: 0, empresa: 0, valorPago: 0, saldoDevedor: 0, count: 0 };
      existing.repId = p.representante_id;
      existing.totalVenda += Number(p.total_venda) || 0;
      existing.comissao += Number(p.comissao_valor) || 0;
      existing.empresa += Number(p.valor_devido_empresa) || 0;
      existing.valorPago += Number(p.valor_pago) || 0;
      existing.saldoDevedor += Number(p.saldo_devedor) || 0;
      existing.count += 1;
      grouped.set(nome, existing);
    });

    const result: RevendedoraRanking[] = [];
    grouped.forEach((data, nome) => {
      const ticketMedio = data.count > 0 ? data.totalVenda / data.count : 0;
      const { nivel, cor } = calcularNivel(ticketMedio);
      result.push({
        nome,
        representanteId: data.repId,
        representanteNome: data.repId ? (profileMap.get(data.repId) || '-') : '-',
        ciclos: data.count,
        volumeVendido: data.totalVenda,
        comissaoTotal: data.comissao,
        valorEmpresa: data.empresa,
        valorPago: data.valorPago,
        saldoDevedor: data.saldoDevedor,
        ticketMedio,
        nivel,
        cor,
        quitada: data.saldoDevedor === 0,
      });
    });

    if (ordenacao === 'volume') result.sort((a, b) => b.volumeVendido - a.volumeVendido);
    else if (ordenacao === 'ciclos') result.sort((a, b) => b.ciclos - a.ciclos);
    else result.sort((a, b) => b.ticketMedio - a.ticketMedio);

    return result;
  }, [prestacoesDeduplicated, profileMap, ordenacao]);

  const totalVolume = ranking.reduce((s, r) => s + r.volumeVendido, 0);
  const totalCiclos = ranking.reduce((s, r) => s + r.ciclos, 0);
  const mediaCiclos = ranking.length > 0 ? totalCiclos / ranking.length : 0;
  const quitadasCount = ranking.filter(r => r.quitada).length;
  const destaqueQuitadas = ranking.filter(r => r.quitada);
  const destaque = destaqueQuitadas.length > 0 ? destaqueQuitadas[0] : (ranking.length > 0 ? ranking[0] : null);

  const nivelBadgeVariant = (cor: string) => {
    if (cor === 'purple') return 'default' as const;
    if (cor === 'orange') return 'default' as const;
    if (cor === 'blue') return 'default' as const;
    return 'secondary' as const;
  };

  const nivelBadgeClass = (cor: string) => {
    if (cor === 'purple') return 'bg-purple-600 hover:bg-purple-700 text-white';
    if (cor === 'orange') return 'bg-orange-500 hover:bg-orange-600 text-white';
    if (cor === 'blue') return 'bg-blue-500 hover:bg-blue-600 text-white';
    return '';
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {mesesDisponiveis.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={representanteFiltro} onValueChange={setRepresentanteFiltro}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Representante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {representantes.map(rep => (
                  <SelectItem key={rep.id} value={rep.id}>{rep.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ordenacao} onValueChange={(v) => setOrdenacao(v as typeof ordenacao)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="volume">Por Volume Vendido</SelectItem>
                <SelectItem value="ciclos">Por Ciclos</SelectItem>
                <SelectItem value="ticket">Por Ticket Médio</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{ranking.length}</p>
                <p className="text-sm text-muted-foreground">Revendedoras Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{formatarValor(totalVolume)}</p>
                <p className="text-sm text-muted-foreground">Volume Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{mediaCiclos.toFixed(1)}</p>
                <p className="text-sm text-muted-foreground">Média Ciclos/Rev.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Award className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{quitadasCount}</p>
                <p className="text-sm text-muted-foreground">Aptas para Premiação</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Star className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold truncate max-w-[140px]">{destaque?.nome || '-'}</p>
                <p className="text-sm text-muted-foreground">Destaque do Período</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Ranking de Revendedoras
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : ranking.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum dado encontrado no período</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Representante</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead className="text-right">Ciclos</TableHead>
                    <TableHead className="text-right">Volume Vendido</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                    <TableHead className="text-right">Valor Pago</TableHead>
                    <TableHead className="text-right">Saldo Devedor</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Premiação</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((rev, idx) => (
                    <TableRow key={rev.nome}>
                      <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{rev.nome}</TableCell>
                      <TableCell>{rev.representanteNome}</TableCell>
                      <TableCell>
                        <Badge variant={nivelBadgeVariant(rev.cor)} className={nivelBadgeClass(rev.cor)}>
                          {rev.nivel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{rev.ciclos}</TableCell>
                      <TableCell className="text-right">{formatarValor(rev.volumeVendido)}</TableCell>
                      <TableCell className="text-right">{formatarValor(rev.ticketMedio)}</TableCell>
                      <TableCell className="text-right">{formatarValor(rev.valorPago)}</TableCell>
                      <TableCell className="text-right text-destructive font-medium">
                        {rev.saldoDevedor > 0 ? formatarValor(rev.saldoDevedor) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {rev.quitada ? (
                          <Badge className="bg-green-600 text-white">Quitada</Badge>
                        ) : (
                          <Badge variant="outline" className="border-orange-400 text-orange-600">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {rev.quitada ? (
                          <span title="Elegível para premiação">🏆</span>
                        ) : (
                          <span title="Saldo em aberto" className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setPerfilAberto(rev.nome)}>
                          <Eye className="h-4 w-4 mr-1" />
                          Perfil
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {perfilAberto && (
        <PerfilRevendedoraDialog
          nomeRevendedora={perfilAberto}
          representantes={representantes}
          onClose={() => setPerfilAberto(null)}
        />
      )}
    </div>
  );
}
