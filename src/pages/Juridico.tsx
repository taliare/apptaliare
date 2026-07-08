import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Scale, User, FileText, Clock, RotateCcw, Filter, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { formatarValor, parseLocalDate, formatDateBR, getLocalDateString } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRange } from 'react-day-picker';

interface CobrancaJuridico {
  id: string;
  revendedora: string;
  codigo_nota: string | null;
  valor_previsto: number;
  data_agendada: string;
  data_encaminhado_juridico: string | null;
  representante_id: string;
  profiles: {
    nome: string;
  } | null;
}

export default function Juridico() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [filtroRepresentante, setFiltroRepresentante] = useState<string>('todos');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [busca, setBusca] = useState<string>('');

  const normalizarNome = (s: string) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  const somenteDigitos = (s: string) => (s || '').replace(/\D/g, '');
  
  const [modalRetornarOpen, setModalRetornarOpen] = useState(false);
  const [cobrancaParaRetornar, setCobrancaParaRetornar] = useState<CobrancaJuridico | null>(null);
  const [novaDataVencimento, setNovaDataVencimento] = useState<Date>();

  // Buscar cobranças com status = "juridico"
  const { data: cobrancasJuridico = [], isLoading } = useQuery({
    queryKey: ['cobrancas-juridico'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select(`
          id,
          revendedora,
          codigo_nota,
          valor_previsto,
          data_agendada,
          data_encaminhado_juridico,
          representante_id,
          profiles:representante_id (nome)
        `)
        .eq('vigente', true)
        .eq('status', 'juridico')
        .order('data_agendada', { ascending: true });

      if (error) throw error;
      return (data || []) as CobrancaJuridico[];
    },
  });

  // Buscar revendedoras (nome + cpf) para permitir busca por CPF e exibição
  const { data: revendedorasList = [] } = useQuery({
    queryKey: ['revendedoras-nome-cpf'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('revendedoras')
        .select('nome, cpf');
      if (error) throw error;
      return (data || []) as { nome: string | null; cpf: string | null }[];
    },
  });

  const cpfPorNome = new Map<string, string>();
  for (const r of revendedorasList) {
    const key = normalizarNome(r.nome || '');
    if (key && r.cpf && !cpfPorNome.has(key)) cpfPorNome.set(key, r.cpf);
  }

  // Buscar representantes únicos que têm notas no jurídico
  const representantesUnicos = Array.from(
    new Map(
      cobrancasJuridico
        .filter(c => c.profiles?.nome)
        .map(c => [c.representante_id, { id: c.representante_id, nome: c.profiles?.nome || '' }])
    ).values()
  );

  const buscaNorm = normalizarNome(busca);
  const buscaDigitos = somenteDigitos(busca);

  // Aplicar filtros
  const cobrancasFiltradas = cobrancasJuridico.filter(c => {
    // Filtro por representante
    if (filtroRepresentante !== 'todos' && c.representante_id !== filtroRepresentante) {
      return false;
    }
    
    // Filtro por data de encaminhamento
    if (dateRange?.from && c.data_encaminhado_juridico) {
      const dataEnc = new Date(c.data_encaminhado_juridico);
      if (dataEnc < dateRange.from) return false;
      if (dateRange.to && dataEnc > dateRange.to) return false;
    }

    // Filtro por busca (nome ou CPF)
    if (buscaNorm) {
      const nomeNorm = normalizarNome(c.revendedora || '');
      const cpfDigits = somenteDigitos(cpfPorNome.get(nomeNorm) || '');
      const matchNome = nomeNorm.includes(buscaNorm);
      const matchCpf = buscaDigitos.length > 0 && cpfDigits.includes(buscaDigitos);
      if (!matchNome && !matchCpf) return false;
    }

    return true;
  });

  // Mutation para retornar à agenda
  const retornarMutation = useMutation({
    mutationFn: async ({ id, novaData }: { id: string; novaData?: string }) => {
      const updateData: any = { 
        status: 'pendente',
        data_encaminhado_juridico: null
      };
      
      if (novaData) {
        updateData.data_agendada = novaData;
      }
      
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas-juridico'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      toast({ title: 'Cobrança retornada para a agenda!' });
      setModalRetornarOpen(false);
      setCobrancaParaRetornar(null);
      setNovaDataVencimento(undefined);
    },
    onError: () => {
      toast({ title: 'Erro ao retornar cobrança', variant: 'destructive' });
    },
  });

  const handleRetornarClick = (cobranca: CobrancaJuridico) => {
    setCobrancaParaRetornar(cobranca);
    setNovaDataVencimento(parseLocalDate(cobranca.data_agendada));
    setModalRetornarOpen(true);
  };

  const handleConfirmarRetorno = () => {
    if (!cobrancaParaRetornar) return;
    
    retornarMutation.mutate({
      id: cobrancaParaRetornar.id,
      novaData: novaDataVencimento ? getLocalDateString(novaDataVencimento) : undefined
    });
  };

  const limparFiltros = () => {
    setFiltroRepresentante('todos');
    setDateRange(undefined);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando cobranças do jurídico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2">
            <Scale className="h-5 w-5 sm:h-8 sm:w-8 shrink-0" />
            Jurídico
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Notas encaminhadas ao jurídico ({cobrancasFiltradas.length} {cobrancasFiltradas.length === 1 ? 'nota' : 'notas'})
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3 p-3 sm:p-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
            <div className="w-full sm:w-64">
              <Label className="text-xs sm:text-sm mb-2 block">Representante</Label>
              <Select value={filtroRepresentante} onValueChange={setFiltroRepresentante}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os representantes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os representantes</SelectItem>
                  {representantesUnicos.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-auto">
              <Label className="text-xs sm:text-sm mb-2 block">Data de Encaminhamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[280px] justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                          </>
                        ) : (
                          format(dateRange.from, "dd/MM/yyyy")
                        )
                      ) : (
                        "Selecione o período"
                      )}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button variant="outline" onClick={limparFiltros} className="w-full sm:w-auto">
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Cobranças */}
      {cobrancasFiltradas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Scale className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhuma nota no jurídico</h3>
            <p className="text-muted-foreground">
              {filtroRepresentante !== 'todos' || dateRange
                ? 'Nenhuma nota encontrada com os filtros aplicados.'
                : 'Não há notas encaminhadas ao jurídico no momento.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {cobrancasFiltradas.map((cobranca) => (
            <Card key={cobranca.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="bg-purple-500/10 text-purple-700 dark:text-purple-400 text-xs">
                        Jurídico
                      </Badge>
                      <span className="font-semibold text-base sm:text-lg truncate">{cobranca.revendedora}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 text-xs sm:text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                        <span className="truncate">{cobranca.profiles?.nome || 'N/A'}</span>
                      </div>
                      
                      {cobranca.codigo_nota && (
                        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                          <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                          <span className="truncate">{cobranca.codigo_nota}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                        <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                        <span className="truncate">Venc: {formatDateBR(cobranca.data_agendada)}</span>
                      </div>
                      
                      {cobranca.data_encaminhado_juridico && (
                        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                          <span className="truncate">Enc: {format(parseISO(cobranca.data_encaminhado_juridico), 'dd/MM/yyyy')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-3 md:gap-4 pt-2 md:pt-0 border-t md:border-t-0">
                    <div className="text-left md:text-right">
                      <p className="text-xs text-muted-foreground">Valor</p>
                      <p className="text-lg sm:text-xl font-bold text-primary">
                        {formatarValor(cobranca.valor_previsto)}
                      </p>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetornarClick(cobranca)}
                      className="flex items-center gap-2 sm:size-default"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span className="hidden sm:inline">Retornar para Agenda</span>
                      <span className="sm:hidden">Retornar</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Retornar para Agenda */}
      <Dialog open={modalRetornarOpen} onOpenChange={setModalRetornarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retornar para Agenda</DialogTitle>
          </DialogHeader>
          
          {cobrancaParaRetornar && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg space-y-1">
                <p><strong>Revendedora:</strong> {cobrancaParaRetornar.revendedora}</p>
                <p><strong>Código:</strong> {cobrancaParaRetornar.codigo_nota || 'N/A'}</p>
                <p><strong>Valor:</strong> {formatarValor(cobrancaParaRetornar.valor_previsto)}</p>
                <p><strong>Representante:</strong> {cobrancaParaRetornar.profiles?.nome || 'N/A'}</p>
              </div>
              
              <div className="space-y-2">
                <Label>Nova Data de Vencimento (opcional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !novaDataVencimento && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {novaDataVencimento
                        ? format(novaDataVencimento, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                        : "Manter data atual"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={novaDataVencimento}
                      onSelect={setNovaDataVencimento}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Data atual: {formatDateBR(cobrancaParaRetornar.data_agendada)}
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalRetornarOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmarRetorno} disabled={retornarMutation.isPending}>
              {retornarMutation.isPending ? 'Retornando...' : 'Confirmar Retorno'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
