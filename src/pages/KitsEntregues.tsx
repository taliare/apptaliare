import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, User, Calendar, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfMonth, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarValor, formatDateBR, parseLocalDate } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface KitEntregue {
  id: string;
  codigo_mostruario: string;
  tipo: string | null;
  data_entrega: string;
  data_vencimento: string;
  representante_id: string;
  prestacao_id: string | null;
}

interface CobrancaKit {
  codigo_nota: string;
  revendedora: string;
  valor_previsto: number;
  data_agendada: string;
}

export default function KitsEntregues() {
  const { user } = useAuth();
  const userId = user?.id;

  // Gerar opções de meses (últimos 6 meses + próximos 6 meses)
  const mesOptions = useMemo(() => {
    const hoje = new Date();
    const opcoes: { value: string; label: string }[] = [];
    
    for (let i = -3; i <= 6; i++) {
      const mes = addMonths(startOfMonth(hoje), i);
      opcoes.push({
        value: format(mes, 'yyyy-MM'),
        label: format(mes, "MMMM 'de' yyyy", { locale: ptBR })
      });
    }
    
    return opcoes;
  }, []);

  // Ciclo padrão: kits entregues cujo vencimento é 2 meses à frente
  const mesVencimentoPadrao = format(addMonths(new Date(), 2), 'yyyy-MM');
  const [mesVencimentoFiltro, setMesVencimentoFiltro] = useState(mesVencimentoPadrao);

  // Buscar kits entregues do representante
  const { data: kitsEntregues = [], isLoading } = useQuery({
    queryKey: ['kits-entregues-representante', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('kits_entregues')
        .select('*')
        .eq('representante_id', userId)
        .order('data_vencimento', { ascending: true });

      if (error) throw error;
      return data as KitEntregue[];
    },
    enabled: !!userId,
  });

  // Buscar cobranças de tipo kit para obter nome da revendedora e valor
  const codigoKits = kitsEntregues.map(k => k.codigo_mostruario);

  const { data: cobrancasKit = [] } = useQuery({
    queryKey: ['cobrancas-kit', codigoKits, userId],
    queryFn: async () => {
      if (codigoKits.length === 0 || !userId) return [];
      
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('codigo_nota, revendedora, valor_previsto, data_agendada')
        .eq('representante_id', userId)
        .eq('vigente', true)
        .eq('tipo', 'kit')
        .in('codigo_nota', codigoKits);

      if (error) throw error;
      return data as CobrancaKit[];
    },
    enabled: codigoKits.length > 0 && !!userId,
  });

  // Mapear cobranças por código do kit
  const cobrancasMap = useMemo(() => {
    const map: Record<string, CobrancaKit> = {};
    cobrancasKit.forEach(c => {
      if (c.codigo_nota) {
        map[c.codigo_nota] = c;
      }
    });
    return map;
  }, [cobrancasKit]);

  // Filtrar kits pelo mês de vencimento selecionado
  const kitsFiltrados = useMemo(() => {
    return kitsEntregues.filter(kit => {
      const vencimentoMes = format(parseLocalDate(kit.data_vencimento), 'yyyy-MM');
      return vencimentoMes === mesVencimentoFiltro;
    });
  }, [kitsEntregues, mesVencimentoFiltro]);

  // Calcular resumo por tipo
  const resumo = useMemo(() => {
    const iniciais = kitsFiltrados.filter(k => 
      k.tipo?.toLowerCase() === 'inicial' || k.tipo?.toLowerCase() === 'novo'
    ).length;
    const especiais = kitsFiltrados.filter(k => 
      k.tipo?.toLowerCase() === 'especial'
    ).length;
    const maletas = kitsFiltrados.filter(k => 
      k.tipo?.toLowerCase() === 'maleta'
    ).length;
    // Considerar renovações e tipos não categorizados como inicial
    const outros = kitsFiltrados.length - iniciais - especiais - maletas;
    
    return {
      iniciais: iniciais + outros,
      especiais,
      maletas,
      total: kitsFiltrados.length
    };
  }, [kitsFiltrados]);

  // Obter valor do kit (da cobrança ou valor padrão)
  const getValorKit = (kit: KitEntregue): number => {
    const cobranca = cobrancasMap[kit.codigo_mostruario];
    if (cobranca) {
      return cobranca.valor_previsto;
    }
    // Valor padrão baseado no tipo
    const tipo = kit.tipo?.toLowerCase() || '';
    if (tipo === 'maleta') return 800;
    if (tipo === 'especial') return 500;
    return 350; // Kit inicial padrão
  };

  // Obter revendedora do kit
  const getRevendedora = (kit: KitEntregue): string => {
    const cobranca = cobrancasMap[kit.codigo_mostruario];
    if (cobranca) {
      return cobranca.revendedora;
    }
    return 'Não informada';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando kits entregues...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Kits Entregues</h1>
          <p className="text-muted-foreground">Visualize os kits entregues para revendedoras</p>
        </div>
        
        {/* Filtro por mês de vencimento */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Vencimento:</span>
          <Select value={mesVencimentoFiltro} onValueChange={setMesVencimentoFiltro}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mesOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold text-primary">{resumo.total}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Entregues</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{resumo.iniciais}</p>
            <p className="text-sm text-muted-foreground mt-1">Kits Iniciais</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{resumo.especiais}</p>
            <p className="text-sm text-muted-foreground mt-1">Kits Especiais</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{resumo.maletas}</p>
            <p className="text-sm text-muted-foreground mt-1">Maletas</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Kits Entregues */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Detalhamento dos Kits
          </CardTitle>
        </CardHeader>
        <CardContent>
          {kitsFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">Nenhum kit entregue neste período</p>
              <p className="text-sm">Selecione outro mês de vencimento para ver outros kits</p>
            </div>
          ) : (
            <div className="space-y-3">
              {kitsFiltrados.map((kit) => (
                <div 
                  key={kit.id} 
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-muted/50 rounded-lg gap-3"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{kit.codigo_mostruario}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{getRevendedora(kit)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="px-2 py-1 bg-background rounded text-xs font-medium uppercase">
                      {kit.tipo || 'Inicial'}
                    </span>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <DollarSign className="h-3 w-3" />
                      <span>{formatarValor(getValorKit(kit))}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>Venc: {formatDateBR(kit.data_vencimento)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
