import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DollarSign, CreditCard, Banknote, Wallet, TrendingDown, TrendingUp, CalendarDays, BarChart3, MessageSquare, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatarValor } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  nome: string;
  ativo: boolean | null;
}

interface ResumoRepresentante {
  representante_id: string;
  nome: string;
  dias: number;
  total_cobrado: number;
  total_pix: number;
  total_dinheiro: number;
  total_cartao: number;
  despesas: number;
  saldo: number;
  media_diaria: number;
}

interface FechamentoPeriodoViewProps {
  periodoInicio: string;
  periodoFim: string;
  selectedRepresentante: string;
  representantes: Profile[];
}

const FORMA_PAGAMENTO_LABELS: Record<string, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  transferencia: 'Transferência',
};

export function FechamentoPeriodoView({
  periodoInicio,
  periodoFim,
  selectedRepresentante,
  representantes,
}: FechamentoPeriodoViewProps) {
  const hasValidRange = periodoInicio && periodoFim && periodoInicio <= periodoFim;
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});

  const { data: cobrancasPeriodo = [], isLoading } = useQuery({
    queryKey: ['fechamento-periodo', periodoInicio, periodoFim, selectedRepresentante],
    queryFn: async () => {
      let query = supabase
        .from('cobrancas_diarias')
        .select('*')
        .gte('data', periodoInicio)
        .lte('data', periodoFim);

      if (selectedRepresentante) {
        query = query.eq('representante_id', selectedRepresentante);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: hasValidRange,
  });

  const { data: notasPeriodo = [] } = useQuery({
    queryKey: ['notas-periodo', periodoInicio, periodoFim, selectedRepresentante],
    queryFn: async () => {
      let query = supabase
        .from('notas_promissorias')
        .select('*')
        .gte('data', periodoInicio)
        .lte('data', periodoFim)
        .order('data', { ascending: false });

      if (selectedRepresentante) {
        query = query.eq('representante_id', selectedRepresentante);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: hasValidRange,
  });

  const representantesMap = useMemo(() => {
    return representantes.reduce((acc, r) => {
      acc[r.id] = r.nome;
      return acc;
    }, {} as Record<string, string>);
  }, [representantes]);

  const resumoPorRepresentante = useMemo((): ResumoRepresentante[] => {
    const agrupado: Record<string, {
      dias: Set<string>;
      total_cobrado: number;
      total_pix: number;
      total_dinheiro: number;
      total_cartao: number;
      despesas: number;
    }> = {};

    for (const c of cobrancasPeriodo) {
      if (!agrupado[c.representante_id]) {
        agrupado[c.representante_id] = {
          dias: new Set(),
          total_cobrado: 0,
          total_pix: 0,
          total_dinheiro: 0,
          total_cartao: 0,
          despesas: 0,
        };
      }

      const g = agrupado[c.representante_id];
      g.dias.add(c.data);
      g.total_cobrado += c.total_cobrado || 0;
      g.total_pix += c.total_pix || 0;
      g.total_dinheiro += c.total_dinheiro || 0;
      g.total_cartao += c.total_cartao || 0;
      g.despesas += c.despesa_cobranca || 0;
    }

    return Object.entries(agrupado)
      .map(([id, g]) => ({
        representante_id: id,
        nome: representantesMap[id] || 'Desconhecido',
        dias: g.dias.size,
        total_cobrado: g.total_cobrado,
        total_pix: g.total_pix,
        total_dinheiro: g.total_dinheiro,
        total_cartao: g.total_cartao,
        despesas: g.despesas,
        saldo: g.total_cobrado - g.despesas,
        media_diaria: g.dias.size > 0 ? g.total_cobrado / g.dias.size : 0,
      }))
      .sort((a, b) => b.total_cobrado - a.total_cobrado);
  }, [cobrancasPeriodo, representantesMap]);

  const totaisGerais = useMemo(() => {
    return resumoPorRepresentante.reduce(
      (acc, r) => ({
        total_cobrado: acc.total_cobrado + r.total_cobrado,
        total_pix: acc.total_pix + r.total_pix,
        total_dinheiro: acc.total_dinheiro + r.total_dinheiro,
        total_cartao: acc.total_cartao + r.total_cartao,
        despesas: acc.despesas + r.despesas,
        saldo: acc.saldo + r.saldo,
        dias: acc.dias + r.dias,
      }),
      { total_cobrado: 0, total_pix: 0, total_dinheiro: 0, total_cartao: 0, despesas: 0, saldo: 0, dias: 0 }
    );
  }, [resumoPorRepresentante]);

  const observacoesDoPeriodo = useMemo(() => {
    return cobrancasPeriodo
      .filter((c) => c.observacoes && c.observacoes.trim())
      .map((c) => ({
        data: c.data,
        nome: representantesMap[c.representante_id] || 'Desconhecido',
        observacoes: c.observacoes!,
      }))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [cobrancasPeriodo, representantesMap]);

  const notasAgrupadasPorDia = useMemo(() => {
    const agrupado: Record<string, typeof notasPeriodo> = {};
    for (const nota of notasPeriodo) {
      if (!agrupado[nota.data]) {
        agrupado[nota.data] = [];
      }
      agrupado[nota.data].push(nota);
    }
    return Object.entries(agrupado)
      .sort(([a], [b]) => b.localeCompare(a));
  }, [notasPeriodo]);

  const toggleDay = (day: string) => {
    setOpenDays(prev => ({ ...prev, [day]: !prev[day] }));
  };

  if (!hasValidRange) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          Selecione um período válido para visualizar os dados consolidados
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Carregando dados do período...</p>
      </Card>
    );
  }

  if (cobrancasPeriodo.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          Nenhum fechamento encontrado neste período
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Cards de Totais Gerais */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Totais do Período</h2>
        <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
              <CardTitle className="text-xs md:text-sm font-medium">PIX</CardTitle>
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <Wallet className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <div className="text-lg md:text-xl font-bold">{formatarValor(totaisGerais.total_pix)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
              <CardTitle className="text-xs md:text-sm font-medium">Dinheiro</CardTitle>
              <div className="p-1.5 rounded-lg bg-green-500/10">
                <Banknote className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <div className="text-lg md:text-xl font-bold">{formatarValor(totaisGerais.total_dinheiro)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
              <CardTitle className="text-xs md:text-sm font-medium">Cartão/Transf.</CardTitle>
              <div className="p-1.5 rounded-lg bg-purple-500/10">
                <CreditCard className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <div className="text-lg md:text-xl font-bold">{formatarValor(totaisGerais.total_cartao)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
              <CardTitle className="text-xs md:text-sm font-medium">Total Cobrado</CardTitle>
              <div className="p-1.5 rounded-lg bg-primary/10">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <div className="text-lg md:text-xl font-bold text-primary">{formatarValor(totaisGerais.total_cobrado)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
              <CardTitle className="text-xs md:text-sm font-medium">Despesas</CardTitle>
              <div className="p-1.5 rounded-lg bg-red-500/10">
                <TrendingDown className="h-4 w-4 text-red-500" />
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <div className="text-lg md:text-xl font-bold text-red-500">- {formatarValor(totaisGerais.despesas)}</div>
            </CardContent>
          </Card>

          <Card className="border-2 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
              <CardTitle className="text-xs md:text-sm font-medium">Saldo Líquido</CardTitle>
              <div className="p-1.5 rounded-lg bg-primary/10">
                {totaisGerais.saldo >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <div className={cn(
                "text-lg md:text-xl font-bold",
                totaisGerais.saldo >= 0 ? "text-green-500" : "text-red-500"
              )}>
                {formatarValor(totaisGerais.saldo)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabela por Representante */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <BarChart3 className="h-5 w-5 text-primary" />
            Resumo por Representante
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Representante</TableHead>
                  <TableHead className="text-center">Dias</TableHead>
                  <TableHead className="text-right">Total Cobrado</TableHead>
                  <TableHead className="text-right hidden md:table-cell">PIX</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Dinheiro</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Cartão</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Média/Dia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumoPorRepresentante.map((r) => (
                  <TableRow key={r.representante_id}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {r.dias}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {formatarValor(r.total_cobrado)}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">{formatarValor(r.total_pix)}</TableCell>
                    <TableCell className="text-right hidden md:table-cell">{formatarValor(r.total_dinheiro)}</TableCell>
                    <TableCell className="text-right hidden md:table-cell">{formatarValor(r.total_cartao)}</TableCell>
                    <TableCell className="text-right text-red-500">- {formatarValor(r.despesas)}</TableCell>
                    <TableCell className={cn(
                      "text-right font-medium",
                      r.saldo >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {formatarValor(r.saldo)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground hidden sm:table-cell">
                      {formatarValor(r.media_diaria)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-center">{totaisGerais.dias}</TableCell>
                  <TableCell className="text-right text-primary">{formatarValor(totaisGerais.total_cobrado)}</TableCell>
                  <TableCell className="text-right hidden md:table-cell">{formatarValor(totaisGerais.total_pix)}</TableCell>
                  <TableCell className="text-right hidden md:table-cell">{formatarValor(totaisGerais.total_dinheiro)}</TableCell>
                  <TableCell className="text-right hidden md:table-cell">{formatarValor(totaisGerais.total_cartao)}</TableCell>
                  <TableCell className="text-right text-red-500">- {formatarValor(totaisGerais.despesas)}</TableCell>
                  <TableCell className={cn(
                    "text-right",
                    totaisGerais.saldo >= 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {formatarValor(totaisGerais.saldo)}
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell">—</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Notas Cobradas por Dia */}
      {notasAgrupadasPorDia.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Notas Cobradas por Dia ({notasPeriodo.length} notas)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notasAgrupadasPorDia.map(([dia, notas]) => {
              const totalDia = notas.reduce((sum, n) => sum + n.valor_total, 0);
              const isOpen = openDays[dia] ?? false;

              return (
                <Collapsible key={dia} open={isOpen} onOpenChange={() => toggleDay(dia)}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50 hover:bg-muted/80 transition-colors">
                      <div className="flex items-center gap-3">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Badge variant="outline" className="text-xs">
                          {new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {notas.length} {notas.length === 1 ? 'nota' : 'notas'}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-primary">
                        {formatarValor(totalDia)}
                      </span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-1 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Código</TableHead>
                            {!selectedRepresentante && (
                              <TableHead className="text-xs hidden sm:table-cell">Representante</TableHead>
                            )}
                            <TableHead className="text-xs text-right">Valor</TableHead>
                            <TableHead className="text-xs text-center">Pgto 1</TableHead>
                            <TableHead className="text-xs text-right">Valor 1</TableHead>
                            <TableHead className="text-xs text-center hidden sm:table-cell">Pgto 2</TableHead>
                            <TableHead className="text-xs text-right hidden sm:table-cell">Valor 2</TableHead>
                            <TableHead className="text-xs text-center">Devolveu</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {notas.map((nota) => (
                            <TableRow key={nota.id}>
                              <TableCell className="text-xs font-medium">{nota.codigo_nota}</TableCell>
                              {!selectedRepresentante && (
                                <TableCell className="text-xs hidden sm:table-cell">
                                  {representantesMap[nota.representante_id] || '—'}
                                </TableCell>
                              )}
                              <TableCell className="text-xs text-right font-semibold">
                                {formatarValor(nota.valor_total)}
                              </TableCell>
                              <TableCell className="text-xs text-center">
                                <Badge variant="secondary" className="text-[10px] px-1.5">
                                  {FORMA_PAGAMENTO_LABELS[nota.forma_pagamento_1] || nota.forma_pagamento_1}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-right">
                                {formatarValor(nota.valor_pagamento_1)}
                              </TableCell>
                              <TableCell className="text-xs text-center hidden sm:table-cell">
                                {nota.forma_pagamento_2 ? (
                                  <Badge variant="secondary" className="text-[10px] px-1.5">
                                    {FORMA_PAGAMENTO_LABELS[nota.forma_pagamento_2] || nota.forma_pagamento_2}
                                  </Badge>
                                ) : '—'}
                              </TableCell>
                              <TableCell className="text-xs text-right hidden sm:table-cell">
                                {nota.valor_pagamento_2 ? formatarValor(nota.valor_pagamento_2) : '—'}
                              </TableCell>
                              <TableCell className="text-xs text-center">
                                {nota.devolveu_tudo ? (
                                  <Badge variant="destructive" className="text-[10px] px-1.5">Sim</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] px-1.5">Não</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell colSpan={selectedRepresentante ? 1 : 2} className="text-xs font-bold">
                              Total do dia
                            </TableCell>
                            <TableCell className="text-xs text-right font-bold text-primary">
                              {formatarValor(totalDia)}
                            </TableCell>
                            <TableCell colSpan={5} />
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Observações do Período */}
      {observacoesDoPeriodo.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
              Observações do Período ({observacoesDoPeriodo.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {observacoesDoPeriodo.map((obs, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {new Date(obs.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </Badge>
                    <span className="text-sm font-medium">{obs.nome}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{obs.observacoes}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
