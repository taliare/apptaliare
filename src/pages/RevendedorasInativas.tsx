import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserX, RefreshCw, CalendarIcon, Search, Package } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarValor, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RevendedoraInativa {
  nome: string;
  ultimaVendaData: string;
  ultimaVendaValor: number;
}

export default function RevendedorasInativas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [reativarDialogOpen, setReativarDialogOpen] = useState(false);
  const [selectedRevendedora, setSelectedRevendedora] = useState<RevendedoraInativa | null>(null);
  const [selectedKit, setSelectedKit] = useState('');
  const [dataVencimento, setDataVencimento] = useState<Date>(addDays(new Date(), 60));

  // Query para buscar kits disponíveis do representante
  const { data: kitsDisponiveis = [] } = useQuery({
    queryKey: ['kits-disponiveis-reativar', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kits_estoque')
        .select('id, codigo, tipo, valor')
        .eq('representante_id', user!.id)
        .eq('status', 'com_representante');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Query para buscar revendedoras inativas
  const { data: revendedorasInativas = [], isLoading } = useQuery({
    queryKey: ['revendedoras-inativas', user?.id],
    queryFn: async () => {
      // Buscar todas as revendedoras únicas que já tiveram prestações com esse representante
      const { data: prestacoesPassadas, error: prestError } = await supabase
        .from('prestacoes_contas')
        .select('revendedora, data_execucao, total_venda')
        .eq('representante_id', user!.id)
        .order('data_execucao', { ascending: false });

      if (prestError) throw prestError;

      // Buscar revendedoras com cobranças pendentes ou kits ativos
      const { data: cobrancasAbertas, error: cobError } = await supabase
        .from('cobrancas_agendadas')
        .select('revendedora')
        .eq('representante_id', user!.id)
        .in('status', ['pendente', 'parcial', 'reagendado']);

      if (cobError) throw cobError;

      // Buscar repasses pendentes
      const { data: repassesPendentes, error: repError } = await supabase
        .from('repasses')
        .select('cobranca_id')
        .eq('status', 'agendado');

      if (repError) throw repError;

      // Buscar cobranças dos repasses pendentes
      const repasseCobrancaIds = repassesPendentes?.map(r => r.cobranca_id) || [];
      let revendedorasComRepasse: string[] = [];
      
      if (repasseCobrancaIds.length > 0) {
        const { data: cobrancasRepasse } = await supabase
          .from('cobrancas_agendadas')
          .select('revendedora')
          .eq('representante_id', user!.id)
          .in('id', repasseCobrancaIds);
        
        revendedorasComRepasse = cobrancasRepasse?.map(c => c.revendedora) || [];
      }

      // Revendedoras com kits entregues ativos (ainda em posse)
      const { data: kitsAtivos, error: kitsError } = await supabase
        .from('kits_entregues')
        .select('id')
        .eq('representante_id', user!.id);

      if (kitsError) throw kitsError;

      // Set de revendedoras ativas (com dívidas ou kits)
      const revendedorasAtivas = new Set([
        ...cobrancasAbertas?.map(c => c.revendedora) || [],
        ...revendedorasComRepasse,
      ]);

      // Agrupar prestações por revendedora (última prestação)
      const ultimaPrestacaoPorRevendedora = new Map<string, { data: string; valor: number }>();
      
      prestacoesPassadas?.forEach(p => {
        if (!ultimaPrestacaoPorRevendedora.has(p.revendedora)) {
          ultimaPrestacaoPorRevendedora.set(p.revendedora, {
            data: p.data_execucao,
            valor: p.total_venda,
          });
        }
      });

      // Filtrar apenas revendedoras que não estão ativas
      const inativas: RevendedoraInativa[] = [];
      ultimaPrestacaoPorRevendedora.forEach((info, nome) => {
        if (!revendedorasAtivas.has(nome)) {
          inativas.push({
            nome,
            ultimaVendaData: info.data,
            ultimaVendaValor: info.valor,
          });
        }
      });

      // Ordenar por data da última venda (mais recente primeiro)
      return inativas.sort((a, b) => 
        new Date(b.ultimaVendaData).getTime() - new Date(a.ultimaVendaData).getTime()
      );
    },
    enabled: !!user?.id,
  });

  // Filtrar por termo de busca
  const revendedorasFiltradas = useMemo(() => {
    if (!searchTerm) return revendedorasInativas;
    const termo = searchTerm.toLowerCase();
    return revendedorasInativas.filter(r => r.nome.toLowerCase().includes(termo));
  }, [revendedorasInativas, searchTerm]);

  // Mutation para reativar revendedora
  const reativarMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRevendedora || !selectedKit) {
        throw new Error('Selecione um kit');
      }

      const kit = kitsDisponiveis.find(k => k.id === selectedKit);
      if (!kit) {
        throw new Error('Kit não encontrado');
      }

      // Criar nova cobrança agendada
      const { error: cobrancaError } = await supabase
        .from('cobrancas_agendadas')
        .insert({
          representante_id: user!.id,
          revendedora: selectedRevendedora.nome,
          codigo_nota: kit.codigo,
          valor_previsto: kit.valor || 0,
          data_agendada: format(dataVencimento, 'yyyy-MM-dd'),
          status: 'pendente',
          tipo: kit.tipo,
        });

      if (cobrancaError) throw cobrancaError;

      // Atualizar status do kit para com_revendedora
      const { error: kitError } = await supabase
        .from('kits_estoque')
        .update({ status: 'com_revendedora' })
        .eq('id', selectedKit);

      if (kitError) throw kitError;

      // Registrar kit entregue
      const { error: entregaError } = await supabase
        .from('kits_entregues')
        .insert({
          representante_id: user!.id,
          codigo_mostruario: kit.codigo,
          data_entrega: format(new Date(), 'yyyy-MM-dd'),
          data_vencimento: format(dataVencimento, 'yyyy-MM-dd'),
          tipo: kit.tipo,
        });

      if (entregaError) throw entregaError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revendedoras-inativas'] });
      queryClient.invalidateQueries({ queryKey: ['kits-disponiveis-reativar'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      queryClient.invalidateQueries({ queryKey: ['kits-estoque'] });
      toast.success(`Revendedora ${selectedRevendedora?.nome} reativada com sucesso!`);
      setReativarDialogOpen(false);
      setSelectedKit('');
      setDataVencimento(addDays(new Date(), 60));
    },
    onError: (error: any) => {
      toast.error(`Erro ao reativar: ${error.message}`);
    },
  });

  const handleOpenReativar = (revendedora: RevendedoraInativa) => {
    setSelectedRevendedora(revendedora);
    setReativarDialogOpen(true);
  };

  const tipoLabels: Record<string, string> = {
    inicial: 'Inicial',
    especial: 'Especial',
    maleta: 'Maleta',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Revendedoras Inativas</h1>
        <p className="text-muted-foreground">
          Revendedoras que quitaram suas notas e não possuem kits ou repasses em aberto
        </p>
      </div>

      {/* Barra de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome da revendedora..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Card resumo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserX className="h-5 w-5" />
            Total de Revendedoras Inativas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{revendedorasFiltradas.length}</div>
        </CardContent>
      </Card>

      {/* Lista de revendedoras inativas */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : revendedorasFiltradas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {searchTerm 
              ? 'Nenhuma revendedora encontrada com esse termo' 
              : 'Nenhuma revendedora inativa no momento'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {revendedorasFiltradas.map((revendedora) => (
            <Card key={revendedora.nome} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  <div>
                    <h3 className="font-semibold text-lg truncate">{revendedora.nome}</h3>
                    <Badge variant="secondary" className="mt-1">Inativa</Badge>
                  </div>
                  
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Última venda:</span>
                      <span className="font-medium">
                        {format(new Date(revendedora.ultimaVendaData + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor:</span>
                      <span className="font-semibold text-primary">
                        {formatarValor(revendedora.ultimaVendaValor)}
                      </span>
                    </div>
                  </div>

                  <Button 
                    size="sm" 
                    className="w-full mt-2"
                    onClick={() => handleOpenReativar(revendedora)}
                    disabled={kitsDisponiveis.length === 0}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reativar Revendedora
                  </Button>
                  
                  {kitsDisponiveis.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Você não possui kits disponíveis
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de reativação */}
      <Dialog open={reativarDialogOpen} onOpenChange={setReativarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reativar Revendedora</DialogTitle>
            <DialogDescription>
              Reativando <strong>{selectedRevendedora?.nome}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Kit para Entrega *</Label>
              <Select value={selectedKit} onValueChange={setSelectedKit}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um kit" />
                </SelectTrigger>
                <SelectContent>
                  {kitsDisponiveis.map((kit) => (
                    <SelectItem key={kit.id} value={kit.id}>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        <span>{kit.codigo}</span>
                        <Badge variant="outline" className="ml-1">
                          {tipoLabels[kit.tipo] || kit.tipo}
                        </Badge>
                        <span className="text-muted-foreground">
                          - {formatarValor(kit.valor || 0)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data de Vencimento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dataVencimento, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataVencimento}
                    onSelect={(date) => date && setDataVencimento(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {selectedKit && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium mb-1">Resumo:</p>
                <p>Kit: {kitsDisponiveis.find(k => k.id === selectedKit)?.codigo}</p>
                <p>Valor: {formatarValor(kitsDisponiveis.find(k => k.id === selectedKit)?.valor || 0)}</p>
                <p>Vencimento: {format(dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReativarDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => reativarMutation.mutate()}
              disabled={!selectedKit || reativarMutation.isPending}
            >
              {reativarMutation.isPending ? 'Reativando...' : 'Confirmar Reativação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
