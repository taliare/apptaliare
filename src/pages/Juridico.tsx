import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Scale, User, FileText, Clock, RotateCcw, Filter } from 'lucide-react';
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

  // Buscar representantes únicos que têm notas no jurídico
  const representantesUnicos = Array.from(
    new Map(
      cobrancasJuridico
        .filter(c => c.profiles?.nome)
        .map(c => [c.representante_id, { id: c.representante_id, nome: c.profiles?.nome || '' }])
    ).values()
  );

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
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Scale className="h-8 w-8" />
            Jurídico
          </h1>
          <p className="text-muted-foreground">
            Notas encaminhadas ao jurídico ({cobrancasFiltradas.length} {cobrancasFiltradas.length === 1 ? 'nota' : 'notas'})
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="w-full sm:w-64">
              <Label className="text-sm mb-2 block">Representante</Label>
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
              <Label className="text-sm mb-2 block">Data de Encaminhamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[280px] justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
                        </>
                      ) : (
                        format(dateRange.from, "dd/MM/yyyy")
                      )
                    ) : (
                      "Selecione o período"
                    )}
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

            <Button variant="outline" onClick={limparFiltros}>
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
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="bg-purple-500/10 text-purple-700 dark:text-purple-400">
                        Jurídico
                      </Badge>
                      <span className="font-semibold text-lg">{cobranca.revendedora}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{cobranca.profiles?.nome || 'N/A'}</span>
                      </div>
                      
                      {cobranca.codigo_nota && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          <span>{cobranca.codigo_nota}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarIcon className="h-4 w-4" />
                        <span>Venc: {formatDateBR(cobranca.data_agendada)}</span>
                      </div>
                      
                      {cobranca.data_encaminhado_juridico && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>Enc: {format(parseISO(cobranca.data_encaminhado_juridico), 'dd/MM/yyyy')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Valor</p>
                      <p className="text-xl font-bold text-primary">
                        {formatarValor(cobranca.valor_previsto)}
                      </p>
                    </div>
                    
                    <Button
                      variant="outline"
                      onClick={() => handleRetornarClick(cobranca)}
                      className="flex items-center gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Retornar para Agenda
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
