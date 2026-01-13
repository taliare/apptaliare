import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Shield, Filter, User, Package, FileText, Clock, Search, Phone, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DateRange } from 'react-day-picker';
import { supabase } from '@/integrations/supabase/client';

// Interfaces baseadas na estrutura real do banco externo
interface Garantia {
  id: string;
  codigo_pedido: string | null;
  codigo_mostruario: string | null;
  descricao_produto: string | null;
  data_compra: string | null;
  data_expiracao: string | null;
  status: string | null;
  cliente_id: string;
  revendedora_id: string | null;
}

interface ClienteGarantia {
  id: string;
  nome: string | null;
  telefone: string | null;
}

interface ClienteComGarantias {
  cliente: ClienteGarantia;
  garantias: Garantia[];
}

// Helpers
const exibirCampo = (valor: string | null | undefined): string => {
  return valor?.trim() || '—';
};

const calcularDiasRestantes = (dataExpiracao: string | null): number | null => {
  if (!dataExpiracao) return null;
  const hoje = startOfDay(new Date());
  const dataFim = startOfDay(new Date(dataExpiracao));
  const diffMs = dataFim.getTime() - hoje.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

const isGarantiaAtiva = (dataExpiracao: string | null): boolean => {
  const dias = calcularDiasRestantes(dataExpiracao);
  return dias !== null && dias >= 0;
};

const formatDateBR = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  try {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return '—';
  }
};

export default function Garantias() {
  const [filtroStatus, setFiltroStatus] = useState<string>('todas');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [searchTerm, setSearchTerm] = useState('');

  // Buscar garantias do Supabase externo agrupadas por cliente
  const { data: clientesComGarantias = [], isLoading, error } = useQuery({
    queryKey: ['garantias-externo-agrupado'],
    queryFn: async () => {
      const supabaseExternal = await getSupabaseExternalClient();
      
      // Buscar garantias com campos específicos
      const { data: garantiasData, error: garantiasError } = await supabaseExternal
        .from('garantias' as any)
        .select(`
          id,
          codigo_pedido,
          codigo_mostruario,
          descricao_produto,
          data_compra,
          data_expiracao,
          status,
          cliente_id,
          revendedora_id
        `)
        .order('data_compra', { ascending: false });

      if (garantiasError) throw garantiasError;
      if (!garantiasData || garantiasData.length === 0) return [] as ClienteComGarantias[];

      // Coletar IDs únicos de clientes
      const clienteIds = [...new Set(garantiasData.map((g: any) => g.cliente_id).filter(Boolean))];

      // Buscar clientes_garantia
      const { data: clientesData } = clienteIds.length > 0
        ? await supabaseExternal
            .from('clientes_garantia' as any)
            .select('id, nome, telefone')
            .in('id', clienteIds)
        : { data: [] };

      // Criar mapa de clientes
      const clientesMap: Record<string, ClienteGarantia> = {};
      (clientesData || []).forEach((c: any) => {
        clientesMap[c.id] = { id: c.id, nome: c.nome, telefone: c.telefone };
      });

      // Agrupar garantias por cliente
      const agrupamento = new Map<string, ClienteComGarantias>();
      
      for (const g of garantiasData as any[]) {
        const clienteId = g.cliente_id;
        if (!clienteId) continue;
        
        if (!agrupamento.has(clienteId)) {
          agrupamento.set(clienteId, {
            cliente: clientesMap[clienteId] || { id: clienteId, nome: null, telefone: null },
            garantias: []
          });
        }
        
        agrupamento.get(clienteId)!.garantias.push({
          id: g.id,
          codigo_pedido: g.codigo_pedido,
          codigo_mostruario: g.codigo_mostruario,
          descricao_produto: g.descricao_produto,
          data_compra: g.data_compra,
          data_expiracao: g.data_expiracao,
          status: g.status,
          cliente_id: g.cliente_id,
          revendedora_id: g.revendedora_id,
        });
      }

      // Ordenar garantias dentro de cada cliente (mais recente primeiro)
      for (const [, item] of agrupamento) {
        item.garantias.sort((a, b) => {
          const dateA = a.data_compra ? new Date(a.data_compra).getTime() : 0;
          const dateB = b.data_compra ? new Date(b.data_compra).getTime() : 0;
          return dateB - dateA;
        });
      }

      return Array.from(agrupamento.values());
    },
    retry: 1,
  });

  // Aplicar filtros nos clientes e suas garantias
  const clientesFiltrados = useMemo(() => {
    if (!clientesComGarantias.length) return [];

    return clientesComGarantias
      .map(({ cliente, garantias }) => {
        // Filtrar garantias dentro do cliente
        const garantiasFiltradas = garantias.filter(g => {
          // Filtro por status
          if (filtroStatus !== 'todas') {
            const ativa = isGarantiaAtiva(g.data_expiracao);
            if (filtroStatus === 'ativa' && !ativa) return false;
            if (filtroStatus === 'expirada' && ativa) return false;
          }

          // Filtro por data de compra
          if (dateRange?.from && g.data_compra) {
            const dataCompra = new Date(g.data_compra);
            if (dataCompra < dateRange.from) return false;
            if (dateRange.to && dataCompra > dateRange.to) return false;
          }

          // Filtro por busca
          if (searchTerm) {
            const termo = searchTerm.toLowerCase();
            const matchCliente = cliente.nome?.toLowerCase().includes(termo) || 
                                 cliente.telefone?.toLowerCase().includes(termo);
            const matchGarantia = 
              g.codigo_pedido?.toLowerCase().includes(termo) ||
              g.codigo_mostruario?.toLowerCase().includes(termo) ||
              g.descricao_produto?.toLowerCase().includes(termo) ||
              g.status?.toLowerCase().includes(termo);
            
            if (!matchCliente && !matchGarantia) return false;
          }

          return true;
        });

        return { cliente, garantias: garantiasFiltradas };
      })
      .filter(({ garantias }) => garantias.length > 0); // Remover clientes sem garantias após filtro
  }, [clientesComGarantias, filtroStatus, dateRange, searchTerm]);

  // Contadores
  const totalGarantias = clientesComGarantias.reduce((acc, c) => acc + c.garantias.length, 0);
  const totalAtivas = clientesComGarantias.reduce((acc, c) => 
    acc + c.garantias.filter(g => isGarantiaAtiva(g.data_expiracao)).length, 0
  );
  const totalExpiradas = totalGarantias - totalAtivas;
  const totalClientes = clientesComGarantias.length;
  const totalGarantiasFiltradas = clientesFiltrados.reduce((acc, c) => acc + c.garantias.length, 0);

  const limparFiltros = () => {
    setFiltroStatus('todas');
    setDateRange(undefined);
    setSearchTerm('');
  };

  // Renderizar contador de dias restantes
  const renderDiasRestantes = (dias: number | null) => {
    if (dias === null) return <span className="text-muted-foreground">—</span>;
    if (dias < 0) return <span className="text-destructive font-medium">Expirada há {Math.abs(dias)} dias</span>;
    if (dias === 0) return <span className="text-warning font-medium">Expira hoje</span>;
    if (dias <= 30) return <span className="text-warning font-medium">{dias} dias restantes</span>;
    return <span className="text-success font-medium">{dias} dias restantes</span>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando garantias...</p>
        </div>
      </div>
    );
  }

  if (error) {
    let errorMessage = 'Erro desconhecido';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      const errObj = error as any;
      if (errObj.message) {
        errorMessage = errObj.code ? `[${errObj.code}] ${errObj.message}` : errObj.message;
      } else {
        try { errorMessage = JSON.stringify(error); } catch { errorMessage = String(error); }
      }
    } else {
      errorMessage = String(error);
    }

    const isConfigError = errorMessage.includes('não configurado') || errorMessage.includes('Missing secrets');
    
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-lg">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-medium mb-2">Erro ao carregar garantias</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {isConfigError 
                ? 'O banco de dados externo não está configurado. Verifique se os secrets EXTERNAL_SUPABASE_URL e EXTERNAL_SUPABASE_ANON_KEY estão definidos.'
                : 'Não foi possível conectar ao banco de dados de garantias.'}
            </p>
            <div className="bg-muted rounded p-3 text-left">
              <p className="text-xs font-mono text-muted-foreground break-all">{errorMessage}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Garantias
          </h1>
          <p className="text-muted-foreground">
            {totalGarantiasFiltradas} garantias de {totalClientes} clientes
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            <Users className="h-3 w-3 mr-1" />
            {totalClientes} Clientes
          </Badge>
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            {totalAtivas} Ativas
          </Badge>
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            {totalExpiradas} Expiradas
          </Badge>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* Busca geral */}
            <div className="lg:col-span-2">
              <Label className="text-sm mb-2 block">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cliente, produto, código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Filtro por status */}
            <div>
              <Label className="text-sm mb-2 block">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="expirada">Expirada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por data de compra */}
            <div>
              <Label className="text-sm mb-2 block">Data de Compra</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                        </>
                      ) : (
                        format(dateRange.from, "dd/MM/yyyy")
                      )
                    ) : (
                      "Período"
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
          </div>

          {/* Botão limpar filtros */}
          {(filtroStatus !== 'todas' || dateRange || searchTerm) && (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={limparFiltros}>
                Limpar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Garantias Agrupadas por Cliente */}
      {clientesFiltrados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhuma garantia encontrada</h3>
            <p className="text-muted-foreground">
              {filtroStatus !== 'todas' || dateRange || searchTerm
                ? 'Nenhuma garantia encontrada com os filtros aplicados.'
                : 'Não há garantias registradas no sistema.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {clientesFiltrados.map(({ cliente, garantias }) => (
            <Card key={cliente.id}>
              {/* Header do cliente */}
              <CardHeader className="pb-3 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{exibirCampo(cliente.nome)}</CardTitle>
                      {cliente.telefone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {cliente.telefone}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="w-fit">
                    {garantias.length} garantia{garantias.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardHeader>

              {/* Lista de garantias do cliente */}
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {garantias.map((garantia) => {
                    const diasRestantes = calcularDiasRestantes(garantia.data_expiracao);
                    const ativa = diasRestantes !== null && diasRestantes >= 0;
                    
                    return (
                      <div 
                        key={garantia.id} 
                        className={cn(
                          "border rounded-lg p-4",
                          ativa ? "bg-card" : "bg-muted/30"
                        )}
                      >
                        {/* Linha superior: Produto + Status */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                          <h4 className="font-medium text-base">
                            {exibirCampo(garantia.descricao_produto)}
                          </h4>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "w-fit",
                              ativa 
                                ? "bg-success/10 text-success border-success/30"
                                : "bg-destructive/10 text-destructive border-destructive/30"
                            )}
                          >
                            {exibirCampo(garantia.status)}
                          </Badge>
                        </div>
                        
                        {/* Grid de informações */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground block text-xs">Pedido</span>
                            <p className="font-medium flex items-center gap-1">
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              {exibirCampo(garantia.codigo_pedido)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-xs">Mostruário</span>
                            <p className="font-medium flex items-center gap-1">
                              <Package className="h-3 w-3 text-muted-foreground" />
                              {exibirCampo(garantia.codigo_mostruario)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-xs">Data Compra</span>
                            <p className="font-medium flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                              {formatDateBR(garantia.data_compra)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-xs">Validade</span>
                            <p className="font-medium flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                              {formatDateBR(garantia.data_expiracao)}
                            </p>
                          </div>
                        </div>
                        
                        {/* Contador de dias restantes */}
                        <div className="mt-3 pt-3 border-t flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {renderDiasRestantes(diasRestantes)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
