import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CalendarIcon, CheckCircle2, XCircle, DollarSign, Receipt, CreditCard, Banknote, Wallet, RefreshCw, Lock, Package, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn, formatarValor } from '@/lib/utils';

interface Profile {
  id: string;
  nome: string;
  ativo: boolean | null;
}

interface NotaPromissoria {
  id: string;
  codigo_nota: string;
  data: string;
  valor_total: number;
  forma_pagamento_1: 'pix' | 'dinheiro' | 'cartao' | 'transferencia';
  valor_pagamento_1: number;
  forma_pagamento_2?: 'pix' | 'dinheiro' | 'cartao' | 'transferencia' | null;
  valor_pagamento_2?: number | null;
  devolveu_tudo?: boolean;
}

interface CobrancaDiaria {
  id: string;
  data: string;
  total_cobrado: number;
  total_pix: number | null;
  total_dinheiro: number | null;
  total_cartao: number | null;
  despesa_cobranca: number | null;
  finalizado: boolean | null;
  representante_id: string;
}

interface KitEntregue {
  id: string;
  codigo_mostruario: string;
  data_entrega: string;
  data_vencimento: string;
  tipo: string | null;
}

interface CobrancaAgendadaKit {
  codigo_nota: string | null;
  revendedora: string;
  valor_previsto: number;
  tipo: string | null;
}

const formaPagamentoLabels = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  transferencia: 'Transferência'
};

export default function FechamentoDiario() {
  const queryClient = useQueryClient();
  const [selectedRepresentante, setSelectedRepresentante] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [despesaCobranca, setDespesaCobranca] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Query para buscar representantes ativos
  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes-ativos-fechamento'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, nome, ativo')
        .eq('ativo', true);

      if (error) throw error;

      // Filtrar apenas representantes
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'representante');

      if (rolesError) throw rolesError;

      const representanteIds = new Set(roles?.map(r => r.user_id) || []);
      return (profiles || []).filter(p => representanteIds.has(p.id)) as Profile[];
    },
  });

  // Query para notas do representante selecionado na data selecionada
  const { data: notas = [], isLoading: loadingNotas } = useQuery({
    queryKey: ['notas-representante-fechamento', selectedRepresentante, dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_promissorias')
        .select('*')
        .eq('representante_id', selectedRepresentante)
        .eq('data', dateStr)
        .order('criado_em', { ascending: false });

      if (error) throw error;
      return data as NotaPromissoria[];
    },
    enabled: !!selectedRepresentante,
  });

  // Query para cobrança diária do representante
  const { data: cobrancaDiaria, isLoading: loadingCobranca } = useQuery({
    queryKey: ['cobranca-diaria-fechamento', selectedRepresentante, dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('*')
        .eq('representante_id', selectedRepresentante)
        .eq('data', dateStr)
        .maybeSingle();

      if (error) throw error;
      return data as CobrancaDiaria | null;
    },
    enabled: !!selectedRepresentante,
  });

  // Query para buscar revendedoras das cobranças agendadas (lookup por codigo_nota)
  const { data: cobrancasAgendadas = [] } = useQuery({
    queryKey: ['cobrancas-agendadas-lookup-fechamento', selectedRepresentante],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('codigo_nota, revendedora')
        .eq('representante_id', selectedRepresentante);
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedRepresentante,
  });

  // Query para kits entregues do representante na data
  const { data: kitsEntreguesDoDia = [] } = useQuery({
    queryKey: ['kits-entregues-admin', selectedRepresentante, dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kits_entregues')
        .select('*')
        .eq('representante_id', selectedRepresentante)
        .eq('data_entrega', dateStr)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      return data as KitEntregue[];
    },
    enabled: !!selectedRepresentante,
  });

  // Query para buscar detalhes dos kits (revendedora + valor)
  const codigosKitsDoDia = useMemo(() => 
    kitsEntreguesDoDia.map(k => k.codigo_mostruario), 
    [kitsEntreguesDoDia]
  );

  const { data: detalhesKitsCobrancas = [] } = useQuery({
    queryKey: ['detalhes-kits-cobrancas-admin', codigosKitsDoDia, selectedRepresentante],
    queryFn: async () => {
      if (codigosKitsDoDia.length === 0) return [];
      
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('codigo_nota, revendedora, valor_previsto, tipo')
        .eq('representante_id', selectedRepresentante)
        .eq('tipo', 'kit')
        .in('codigo_nota', codigosKitsDoDia);
      
      if (error) throw error;
      return data as CobrancaAgendadaKit[];
    },
    enabled: codigosKitsDoDia.length > 0 && !!selectedRepresentante,
  });

  // Mapa para detalhes dos kits
  const kitsDetalhesMap = useMemo(() => {
    return detalhesKitsCobrancas.reduce((acc, item) => {
      if (item.codigo_nota) {
        acc[item.codigo_nota] = {
          revendedora: item.revendedora,
          valor: item.valor_previsto
        };
      }
      return acc;
    }, {} as Record<string, { revendedora: string; valor: number }>);
  }, [detalhesKitsCobrancas]);

  // Criar mapa de codigo_nota -> revendedora
  const revendedoraMap = cobrancasAgendadas.reduce((acc, item) => {
    if (item.codigo_nota) {
      acc[item.codigo_nota] = item.revendedora;
    }
    return acc;
  }, {} as Record<string, string>);

  // Cálculos baseados nas notas
  const totais = useMemo(() => {
    const pix = notas.reduce((sum, nota) => {
      let total = 0;
      if (nota.forma_pagamento_1 === 'pix') total += nota.valor_pagamento_1;
      if (nota.forma_pagamento_2 === 'pix') total += nota.valor_pagamento_2 || 0;
      return sum + total;
    }, 0);

    const dinheiro = notas.reduce((sum, nota) => {
      let total = 0;
      if (nota.forma_pagamento_1 === 'dinheiro') total += nota.valor_pagamento_1;
      if (nota.forma_pagamento_2 === 'dinheiro') total += nota.valor_pagamento_2 || 0;
      return sum + total;
    }, 0);

    const cartao = notas.reduce((sum, nota) => {
      let total = 0;
      if (nota.forma_pagamento_1 === 'cartao') total += nota.valor_pagamento_1;
      if (nota.forma_pagamento_2 === 'cartao') total += nota.valor_pagamento_2 || 0;
      return sum + total;
    }, 0);

    const transferencia = notas.reduce((sum, nota) => {
      let total = 0;
      if (nota.forma_pagamento_1 === 'transferencia') total += nota.valor_pagamento_1;
      if (nota.forma_pagamento_2 === 'transferencia') total += nota.valor_pagamento_2 || 0;
      return sum + total;
    }, 0);

    return {
      pix,
      dinheiro,
      cartao,
      transferencia,
      total: pix + dinheiro + cartao + transferencia,
    };
  }, [notas]);

  // Total de kits entregues
  const totalKits = useMemo(() => {
    return kitsEntreguesDoDia.reduce((sum, kit) => {
      const detalhe = kitsDetalhesMap[kit.codigo_mostruario];
      return sum + (detalhe?.valor || 0);
    }, 0);
  }, [kitsEntreguesDoDia, kitsDetalhesMap]);

  const parseValor = (valor: string): number => {
    const numeros = valor.replace(/\D/g, '');
    if (!numeros) return 0;
    return parseFloat(numeros) / 100;
  };

  const formatarValorInput = (valor: string): string => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (!apenasNumeros) return '';
    const numero = parseFloat(apenasNumeros) / 100;
    return numero.toFixed(2);
  };

  // Valor da despesa (do registro ou do input)
  const despesaValor = useMemo(() => {
    if (cobrancaDiaria?.finalizado) {
      return cobrancaDiaria.despesa_cobranca || 0;
    }
    return parseValor(despesaCobranca);
  }, [cobrancaDiaria, despesaCobranca]);

  // Saldo do dia
  const saldoDoDia = totais.total - despesaValor;

  // Mutation para finalizar dia pelo representante
  const finalizarDiaMutation = useMutation({
    mutationFn: async () => {
      const despesa = parseValor(despesaCobranca);

      if (cobrancaDiaria) {
        // Atualizar registro existente
        const { error } = await supabase
          .from('cobrancas_diarias')
          .update({
            total_cobrado: totais.total,
            total_pix: totais.pix,
            total_dinheiro: totais.dinheiro,
            total_cartao: totais.cartao + totais.transferencia,
            despesa_cobranca: despesa,
            finalizado: true,
          })
          .eq('id', cobrancaDiaria.id);

        if (error) throw error;
      } else {
        // Criar novo registro
        const { error } = await supabase
          .from('cobrancas_diarias')
          .insert({
            representante_id: selectedRepresentante,
            data: dateStr,
            total_cobrado: totais.total,
            total_pix: totais.pix,
            total_dinheiro: totais.dinheiro,
            total_cartao: totais.cartao + totais.transferencia,
            despesa_cobranca: despesa,
            finalizado: true,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobranca-diaria-fechamento'] });
      toast.success('Dia finalizado com sucesso pelo admin!');
      setDespesaCobranca('');
    },
    onError: (error: any) => {
      toast.error(`Erro ao finalizar dia: ${error.message}`);
    },
  });

  // Mutation para reabrir dia
  const reabrirDiaMutation = useMutation({
    mutationFn: async () => {
      if (!cobrancaDiaria) throw new Error('Nenhuma cobrança para reabrir');

      const { error } = await supabase
        .from('cobrancas_diarias')
        .update({ finalizado: false })
        .eq('id', cobrancaDiaria.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobranca-diaria-fechamento'] });
      toast.success('Dia reaberto com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao reabrir dia: ${error.message}`);
    },
  });

  const isDiaFinalizado = cobrancaDiaria?.finalizado === true;
  const representanteSelecionado = representantes.find(r => r.id === selectedRepresentante);

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
            Fechamento Diário
          </h1>
          <p className="text-sm text-muted-foreground">
            Visualize e gerencie o fechamento diário dos representantes
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedRepresentante} onValueChange={setSelectedRepresentante}>
            <SelectTrigger className="w-full sm:w-[280px]">
              <SelectValue placeholder="Selecione um representante" />
            </SelectTrigger>
            <SelectContent>
              {representantes.map((rep) => (
                <SelectItem key={rep.id} value={rep.id}>
                  {rep.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-[200px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setIsCalendarOpen(false);
                  }
                }}
                locale={ptBR}
                disabled={(date) => date > new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {!selectedRepresentante ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Selecione um representante para visualizar o fechamento
          </p>
        </Card>
      ) : (
        <>
          {/* Status do Dia */}
          <Card className={cn(
            "border-2",
            isDiaFinalizado 
              ? "border-green-500/50 bg-green-500/5" 
              : "border-yellow-500/50 bg-yellow-500/5"
          )}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isDiaFinalizado ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-yellow-500" />
                )}
                <div>
                  <p className="font-medium">
                    {representanteSelecionado?.nome} - {format(selectedDate, "dd/MM/yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isDiaFinalizado 
                      ? `Dia finalizado • Total: ${formatarValor(cobrancaDiaria?.total_cobrado || 0)}`
                      : `Dia em aberto • ${notas.length} nota(s) registrada(s)`
                    }
                  </p>
                </div>
              </div>
              {isDiaFinalizado && (
                <Badge variant="default" className="bg-green-500">
                  <Lock className="h-3 w-3 mr-1" />
                  Finalizado
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Cards de Totais de Cobrança */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Totais de Cobrança</h2>
            <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
                  <CardTitle className="text-xs md:text-sm font-medium">PIX</CardTitle>
                  <div className="p-1.5 rounded-lg bg-blue-500/10">
                    <Wallet className="h-4 w-4 text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent className="p-3 md:p-4 pt-0">
                  <div className="text-lg md:text-xl font-bold">{formatarValor(totais.pix)}</div>
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
                  <div className="text-lg md:text-xl font-bold">{formatarValor(totais.dinheiro)}</div>
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
                  <div className="text-lg md:text-xl font-bold">{formatarValor(totais.cartao + totais.transferencia)}</div>
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
                  <div className="text-lg md:text-xl font-bold text-primary">{formatarValor(totais.total)}</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Resumo do Dia: Despesas, Kits e Saldo */}
          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
            {/* Despesas */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
                <CardTitle className="text-xs md:text-sm font-medium">Despesas do Dia</CardTitle>
                <div className="p-1.5 rounded-lg bg-red-500/10">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0">
                {isDiaFinalizado ? (
                  <div className="text-lg md:text-xl font-bold text-red-500">
                    - {formatarValor(cobrancaDiaria?.despesa_cobranca || 0)}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      placeholder="0.00"
                      value={despesaCobranca}
                      onChange={(e) => setDespesaCobranca(formatarValorInput(e.target.value))}
                      className="h-9"
                    />
                    <p className="text-xs text-muted-foreground">Informe as despesas do dia</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Entregas de Kits */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
                <CardTitle className="text-xs md:text-sm font-medium">Entregas de Kits</CardTitle>
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Package className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0">
                <div className="text-lg md:text-xl font-bold">{kitsEntreguesDoDia.length}</div>
                <p className="text-xs text-muted-foreground">
                  Total: {formatarValor(totalKits)}
                </p>
              </CardContent>
            </Card>

            {/* Saldo do Dia */}
            <Card className="border-2 border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
                <CardTitle className="text-xs md:text-sm font-medium">Saldo Líquido</CardTitle>
                <div className="p-1.5 rounded-lg bg-primary/10">
                  {saldoDoDia >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <Minus className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0">
                <div className={cn(
                  "text-lg md:text-xl font-bold",
                  saldoDoDia >= 0 ? "text-green-500" : "text-red-500"
                )}>
                  {formatarValor(saldoDoDia)}
                </div>
                <p className="text-xs text-muted-foreground">Cobrado - Despesas</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Entregas de Kits */}
          {kitsEntreguesDoDia.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Package className="h-5 w-5 text-primary" />
                  Entregas de Kits do Dia ({kitsEntreguesDoDia.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Revendedora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kitsEntreguesDoDia.map((kit) => {
                        const detalhe = kitsDetalhesMap[kit.codigo_mostruario];
                        return (
                          <TableRow key={kit.id}>
                            <TableCell className="font-mono">{kit.codigo_mostruario}</TableCell>
                            <TableCell>{detalhe?.revendedora || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {kit.tipo || 'renovação'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatarValor(detalhe?.valor || 0)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {kitsEntreguesDoDia.length} entrega(s)
                  </span>
                  <span className="font-bold text-primary">
                    {formatarValor(totalKits)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela de Notas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Receipt className="h-5 w-5" />
                Notas do Dia ({notas.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingNotas ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : notas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma nota registrada nesta data
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Revendedora</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notas.map((nota) => (
                        <TableRow key={nota.id}>
                          <TableCell className="font-mono">{nota.codigo_nota}</TableCell>
                          <TableCell>{revendedoraMap[nota.codigo_nota] || '-'}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatarValor(nota.valor_total)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5 text-xs">
                              <span>{formaPagamentoLabels[nota.forma_pagamento_1]}: {formatarValor(nota.valor_pagamento_1)}</span>
                              {nota.forma_pagamento_2 && nota.valor_pagamento_2 && (
                                <span>{formaPagamentoLabels[nota.forma_pagamento_2]}: {formatarValor(nota.valor_pagamento_2)}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {nota.devolveu_tudo ? (
                              <Badge variant="secondary">Devolveu</Badge>
                            ) : (
                              <Badge variant="default" className="bg-green-500">Pago</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ações do Admin */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ações do Administrador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isDiaFinalizado ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={notas.length === 0 || finalizarDiaMutation.isPending}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Finalizar Dia pelo Representante
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Fechamento</AlertDialogTitle>
                      <AlertDialogDescription>
                        Você está prestes a finalizar o dia {format(selectedDate, "dd/MM/yyyy")} para {representanteSelecionado?.nome}.
                        <br /><br />
                        <strong>Total Cobrado: {formatarValor(totais.total)}</strong>
                        {despesaCobranca && (
                          <>
                            <br />
                            Despesa: {formatarValor(parseValor(despesaCobranca))}
                          </>
                        )}
                        <br />
                        <strong>Entregas de Kits: {kitsEntreguesDoDia.length} ({formatarValor(totalKits)})</strong>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => finalizarDiaMutation.mutate()}>
                        Confirmar Fechamento
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={reabrirDiaMutation.isPending}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reabrir Dia
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reabrir Dia</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja reabrir o dia {format(selectedDate, "dd/MM/yyyy")} para {representanteSelecionado?.nome}?
                        Isso permitirá que novas notas sejam adicionadas.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => reabrirDiaMutation.mutate()}>
                        Confirmar Reabertura
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}