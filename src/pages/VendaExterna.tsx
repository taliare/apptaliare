import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Users, Search, ChevronLeft, ChevronRight, Unlink } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarValor } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface EntregaVendedora {
  id: string;
  vendedora_id: string;
  vendedora_nome: string;
  revendedora: string;
  representante_nome: string;
  codigo_kit: string;
  tipo: string;
  valor: number;
  data_entrega: string;
  data_vencimento: string;
}

interface Vendedora {
  id: string;
  nome: string;
}

export default function VendaExterna() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [entregaParaDesvincular, setEntregaParaDesvincular] = useState<EntregaVendedora | null>(null);

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const startDate = format(currentWeekStart, 'yyyy-MM-dd');
  const endDate = format(weekEnd, 'yyyy-MM-dd');

  // Query para buscar vendedoras cadastradas
  const { data: vendedorasMap = new Map() } = useQuery({
    queryKey: ['vendedoras-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedoras')
        .select('id, nome');
      
      if (error) throw error;
      return new Map((data as Vendedora[]).map(v => [v.id, v.nome]));
    },
  });

  // Query para buscar entregas com vendedora_id vinculada (filtro por data de entrega)
  const { data: entregas = [], isLoading } = useQuery({
    queryKey: ['vendas-externas', startDate, endDate],
    queryFn: async () => {
      // Buscar kits entregues no período
      const { data: kitsEntregues, error: kitsError } = await supabase
        .from('kits_entregues')
        .select('codigo_mostruario, data_entrega, data_vencimento, representante_id')
        .gte('data_entrega', startDate)
        .lte('data_entrega', endDate);
      
      if (kitsError) throw kitsError;

      const codigoNotas = kitsEntregues?.map(k => k.codigo_mostruario) || [];
      
      if (codigoNotas.length === 0) return [];

      // Buscar cobrancas agendadas que têm vendedora_id preenchida
      const { data: cobrancas, error: cobrancasError } = await supabase
        .from('cobrancas_agendadas')
        .select(`
          id,
          vendedora_id,
          vendedora,
          revendedora,
          representante_id,
          codigo_nota,
          tipo,
          valor_previsto
        `)
        .not('vendedora_id', 'is', null)
        .in('codigo_nota', codigoNotas);
      
      if (cobrancasError) throw cobrancasError;

      // Buscar nomes dos representantes
      const repIds = [...new Set(cobrancas?.map(c => c.representante_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', repIds);
      
      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.id, p.nome]) || []);
      const kitsMap = new Map(kitsEntregues?.map(k => [k.codigo_mostruario, k]) || []);

      // Buscar vendedoras para mapear nomes
      const { data: vendedoras } = await supabase
        .from('vendedoras')
        .select('id, nome');
      
      const vendedoraMap = new Map((vendedoras || []).map(v => [v.id, v.nome]));

      return cobrancas?.map(c => ({
        id: c.id,
        vendedora_id: c.vendedora_id || '',
        vendedora_nome: vendedoraMap.get(c.vendedora_id) || c.vendedora || 'Desconhecida',
        revendedora: c.revendedora || '',
        representante_nome: profileMap.get(c.representante_id) || 'Desconhecido',
        codigo_kit: c.codigo_nota || '',
        tipo: c.tipo || 'inicial',
        valor: c.valor_previsto || 0,
        data_entrega: kitsMap.get(c.codigo_nota)?.data_entrega || '',
        data_vencimento: kitsMap.get(c.codigo_nota)?.data_vencimento || '',
      })) as EntregaVendedora[];
    },
  });

  // Mutation para desvincular vendedora
  const desvincularMutation = useMutation({
    mutationFn: async (entregaId: string) => {
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .update({ vendedora_id: null, vendedora: null })
        .eq('id', entregaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendas-externas'] });
      toast.success('Vendedora desvinculada com sucesso');
      setEntregaParaDesvincular(null);
    },
    onError: () => {
      toast.error('Erro ao desvincular vendedora');
    },
  });

  // Filtrar por termo de busca
  const entregasFiltradas = useMemo(() => {
    if (!searchTerm) return entregas;
    const termo = searchTerm.toLowerCase();
    return entregas.filter(e => 
      e.vendedora_nome.toLowerCase().includes(termo) ||
      e.revendedora.toLowerCase().includes(termo) ||
      e.representante_nome.toLowerCase().includes(termo) ||
      e.codigo_kit.toLowerCase().includes(termo)
    );
  }, [entregas, searchTerm]);

  // Agrupar por vendedora_id (usando o id como chave, não o nome)
  const entregasAgrupadas = useMemo(() => {
    const grupos: Record<string, { nome: string; entregas: EntregaVendedora[] }> = {};
    
    entregasFiltradas.forEach(entrega => {
      const vendedoraId = entrega.vendedora_id;
      if (!grupos[vendedoraId]) {
        grupos[vendedoraId] = {
          nome: entrega.vendedora_nome,
          entregas: []
        };
      }
      grupos[vendedoraId].entregas.push(entrega);
    });

    // Ordenar por data de entrega dentro de cada grupo e ordenar grupos por nome
    Object.values(grupos).forEach(grupo => {
      grupo.entregas.sort((a, b) => 
        new Date(b.data_entrega).getTime() - new Date(a.data_entrega).getTime()
      );
    });

    return Object.entries(grupos).sort(([, a], [, b]) => a.nome.localeCompare(b.nome));
  }, [entregasFiltradas]);

  const tipoLabels: Record<string, string> = {
    inicial: 'Inicial',
    especial: 'Especial',
    maleta: 'Maleta',
    kit: 'Kit',
  };

  const tipoColors: Record<string, string> = {
    inicial: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    especial: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    maleta: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    kit: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  };

  const navegarSemana = (direcao: 'anterior' | 'proxima') => {
    setCurrentWeekStart(prev => 
      direcao === 'anterior' ? subWeeks(prev, 1) : addWeeks(prev, 1)
    );
  };

  const irParaSemanaAtual = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Venda Externa</h1>
        <p className="text-muted-foreground">Entregas vinculadas a vendedoras cadastradas</p>
      </div>

      {/* Filtro por semana (baseado na data de entrega) */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navegarSemana('anterior')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center min-w-[200px]">
                <span className="font-medium">
                  {format(currentWeekStart, "dd/MM", { locale: ptBR })} - {format(weekEnd, "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
              <Button variant="outline" size="icon" onClick={() => navegarSemana('proxima')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="secondary" size="sm" onClick={irParaSemanaAtual}>
              Semana Atual
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Barra de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por vendedora, revendedora, representante ou código..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Card resumo simplificado */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total de Entregas no Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{entregasFiltradas.length}</div>
        </CardContent>
      </Card>

      {/* Lista agrupada por vendedora */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Entregas por Vendedora
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : entregasAgrupadas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Nenhuma entrega encontrada com esse termo' : 'Nenhuma entrega com vendedora vinculada nesta semana'}
            </div>
          ) : (
            <div className="space-y-6">
              {entregasAgrupadas.map(([vendedoraId, grupo]) => (
                <div key={vendedoraId} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-3 border-b">
                    <h3 className="font-semibold text-lg">{grupo.nome}</h3>
                    <span className="text-sm text-muted-foreground">
                      {grupo.entregas.length} entrega{grupo.entregas.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="divide-y">
                    {grupo.entregas.map((entrega) => (
                      <div key={entrega.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                              <span className="text-xs text-muted-foreground">Revendedora</span>
                              <p className="font-medium">{entrega.revendedora || '-'}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Representante</span>
                              <p>{entrega.representante_nome}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Código do Kit</span>
                              <p className="font-mono text-sm">{entrega.codigo_kit}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Tipo</span>
                              <div className="mt-1">
                                <Badge className={tipoColors[entrega.tipo] || ''}>
                                  {tipoLabels[entrega.tipo] || entrega.tipo}
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Valor</span>
                              <p className="font-semibold">{formatarValor(entrega.valor)}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Data Entrega</span>
                              <p>
                                {entrega.data_entrega && format(new Date(entrega.data_entrega + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Vencimento</span>
                              <p>
                                {entrega.data_vencimento && format(new Date(entrega.data_vencimento + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setEntregaParaDesvincular(entrega)}
                          >
                            <Unlink className="h-4 w-4 mr-1" />
                            Desvincular
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação para desvincular */}
      <AlertDialog open={!!entregaParaDesvincular} onOpenChange={() => setEntregaParaDesvincular(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular vendedora?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desvincular a vendedora <strong>{entregaParaDesvincular?.vendedora_nome}</strong> do registro do kit <strong>{entregaParaDesvincular?.codigo_kit}</strong>?
              <br /><br />
              <span className="text-muted-foreground">
                A nota e a agenda do representante não serão alteradas. Apenas a vinculação com a vendedora será removida.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => entregaParaDesvincular && desvincularMutation.mutate(entregaParaDesvincular.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
