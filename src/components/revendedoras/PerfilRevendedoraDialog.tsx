import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatarValor } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calcularNivel } from './RankingRevendedoras';
import { Trophy, TrendingUp, Hash, Award } from 'lucide-react';

interface Props {
  nomeRevendedora: string;
  representantes: { id: string; nome: string }[];
  onClose: () => void;
}

export function PerfilRevendedoraDialog({ nomeRevendedora, representantes, onClose }: Props) {
  const { data: prestacoesBruto = [], isLoading } = useQuery({
    queryKey: ['perfil-revendedora', nomeRevendedora],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prestacoes_contas')
        .select('*')
        .eq('revendedora', nomeRevendedora)
        .order('data_execucao', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Deduplicar: para cada cobranca_id, manter apenas o registro com maior total_venda
  const prestacoes = useMemo(() => {
    if (!prestacoesBruto) return [];
    
    const porCobranca = new Map<string, any>();
    
    for (const p of prestacoesBruto) {
      if (!p.cobranca_id) {
        continue;
      }
      const existente = porCobranca.get(p.cobranca_id);
      if (!existente || Number(p.total_venda) > Number(existente.total_venda)) {
        porCobranca.set(p.cobranca_id, p);
      }
    }
    
    const semCobrancaId = prestacoesBruto.filter(p => !p.cobranca_id);
    
    return [...porCobranca.values(), ...semCobrancaId].sort(
      (a, b) => new Date(b.data_execucao).getTime() - new Date(a.data_execucao).getTime()
    );
  }, [prestacoesBruto]);

  // Buscar info da revendedora na tabela revendedoras
  const { data: revendedoraInfo } = useQuery({
    queryKey: ['revendedora-info', nomeRevendedora],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('revendedoras')
        .select('*')
        .eq('nome', nomeRevendedora)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    representantes.forEach(r => map.set(r.id, r.nome));
    return map;
  }, [representantes]);

  const totalCiclos = prestacoes.length;
  const totalVolume = prestacoes.reduce((s, p) => s + (Number(p.total_venda) || 0), 0);
  const ticketMedio = totalCiclos > 0 ? totalVolume / totalCiclos : 0;
  const { nivel, cor } = calcularNivel(ticketMedio);

  const repNome = revendedoraInfo?.representante_id
    ? profileMap.get(revendedoraInfo.representante_id) || '-'
    : (prestacoes[0]?.representante_id ? profileMap.get(prestacoes[0].representante_id) || '-' : '-');

  const nivelBadgeClass = (c: string) => {
    if (c === 'purple') return 'bg-purple-600 text-white';
    if (c === 'orange') return 'bg-orange-500 text-white';
    if (c === 'blue') return 'bg-blue-500 text-white';
    return '';
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Perfil — {nomeRevendedora}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info básica */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant={revendedoraInfo?.ativo !== false ? 'default' : 'secondary'}>
              {revendedoraInfo?.ativo !== false ? '🟢 Ativa' : '🔴 Inativa'}
            </Badge>
            <span className="text-muted-foreground">Representante: <strong>{repNome}</strong></span>
            {revendedoraInfo?.whatsapp && (
              <span className="text-muted-foreground">WhatsApp: <strong>{revendedoraInfo.whatsapp}</strong></span>
            )}
          </div>

          {/* Cards resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="py-3 text-center">
                <Hash className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-xl font-bold">{totalCiclos}</p>
                <p className="text-xs text-muted-foreground">Ciclos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <TrendingUp className="h-5 w-5 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold">{formatarValor(totalVolume)}</p>
                <p className="text-xs text-muted-foreground">Volume Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <Trophy className="h-5 w-5 mx-auto text-orange-500 mb-1" />
                <p className="text-xl font-bold">{formatarValor(ticketMedio)}</p>
                <p className="text-xs text-muted-foreground">Ticket Médio</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <Award className="h-5 w-5 mx-auto text-purple-500 mb-1" />
                <Badge variant="default" className={nivelBadgeClass(cor)}>{nivel}</Badge>
                <p className="text-xs text-muted-foreground mt-1">Nível Atual</p>
              </CardContent>
            </Card>
          </div>

          {/* Evolução de nível */}
          {prestacoes.length > 1 && (
            <Card>
              <CardContent className="py-3">
                <p className="text-sm font-medium mb-2">Evolução de Nível</p>
                <div className="flex flex-wrap gap-2">
                  {[...prestacoes].reverse().map((p, i) => {
                    const n = calcularNivel(Number(p.total_venda));
                    return (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <Badge variant="default" className={`text-xs ${nivelBadgeClass(n.cor)}`}>{n.nivel}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(p.data_execucao), 'dd/MM/yy', { locale: ptBR })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Histórico */}
          <Card>
            <CardContent className="py-3">
              <p className="text-sm font-medium mb-2">Histórico de Ciclos</p>
              {isLoading ? (
                <p className="text-center text-muted-foreground py-4">Carregando...</p>
              ) : prestacoes.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhum registro encontrado</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor Vendido</TableHead>
                        <TableHead className="text-right">Comissão (%)</TableHead>
                        <TableHead className="text-right">Valor Empresa</TableHead>
                        <TableHead className="text-right">Pago</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prestacoes.map(p => (
                        <TableRow key={p.id}>
                          <TableCell>{format(new Date(p.data_execucao), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                          <TableCell className="text-right">{formatarValor(Number(p.total_venda))}</TableCell>
                          <TableCell className="text-right">{p.comissao_percentual}%</TableCell>
                          <TableCell className="text-right">{formatarValor(Number(p.valor_devido_empresa))}</TableCell>
                          <TableCell className="text-right">{formatarValor(Number(p.valor_pago))}</TableCell>
                          <TableCell className="text-right">{formatarValor(Number(p.saldo_devedor) || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
