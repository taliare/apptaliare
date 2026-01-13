import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Shield, Filter, User, Package, FileText, Clock, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DateRange } from 'react-day-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getSupabaseExternalClient } from '@/lib/supabase-external';

interface Garantia {
  id: string;
  nome_revendedora: string;
  nome_cliente: string;
  codigo_pedido: string | null;
  codigo_mostruario: string | null;
  descricao_produto: string;
  data_compra: string;
  data_garantia_fim: string;
  criado_em?: string;
}

export default function Garantias() {
  const [filtroRevendedora, setFiltroRevendedora] = useState<string>('todas');
  const [filtroStatus, setFiltroStatus] = useState<string>('todas');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [searchTerm, setSearchTerm] = useState('');

  // Buscar garantias do Supabase externo com JOINs
  const { data: garantias = [], isLoading, error } = useQuery({
    queryKey: ['garantias-externo'],
    queryFn: async () => {
      // Inicialização lazy do cliente externo (com fallback runtime)
      const supabaseExternal = await getSupabaseExternalClient();
      
      const { data, error } = await supabaseExternal
        .from('garantias' as any)
        .select(`
          id,
          codigo_pedido,
          codigo_mostruario,
          descricao_produto,
          data_compra,
          data_garantia_fim,
          clientes_garantia!cliente_id (
            nome
          ),
          profiles!revendedora_id (
            nome
          )
        `)
        .order('data_compra', { ascending: false });

      if (error) throw error;
      
      // Mapear dados para o formato esperado
      return (data || []).map((g: any) => ({
        id: g.id,
        nome_revendedora: g.profiles?.nome || 'Sem revendedora',
        nome_cliente: g.clientes_garantia?.nome || 'Sem cliente',
        codigo_pedido: g.codigo_pedido,
        codigo_mostruario: g.codigo_mostruario,
        descricao_produto: g.descricao_produto,
        data_compra: g.data_compra,
        data_garantia_fim: g.data_garantia_fim,
      })) as Garantia[];
    },
    retry: 1,
  });

  // Revendedoras únicas para o filtro
  const revendedorasUnicas = useMemo(() => {
    const unique = [...new Set(garantias.map(g => g.nome_revendedora))];
    return unique.sort();
  }, [garantias]);

  // Determinar se garantia está ativa ou expirada
  const isGarantiaAtiva = (dataFim: string) => {
    const hoje = startOfDay(new Date());
    const dataGarantiaFim = startOfDay(new Date(dataFim));
    return !isBefore(dataGarantiaFim, hoje);
  };

  // Aplicar filtros
  const garantiasFiltradas = useMemo(() => {
    return garantias.filter(g => {
      // Filtro por revendedora
      if (filtroRevendedora !== 'todas' && g.nome_revendedora !== filtroRevendedora) {
        return false;
      }

      // Filtro por status
      if (filtroStatus !== 'todas') {
        const ativa = isGarantiaAtiva(g.data_garantia_fim);
        if (filtroStatus === 'ativa' && !ativa) return false;
        if (filtroStatus === 'expirada' && ativa) return false;
      }

      // Filtro por data de compra
      if (dateRange?.from) {
        const dataCompra = new Date(g.data_compra);
        if (dataCompra < dateRange.from) return false;
        if (dateRange.to && dataCompra > dateRange.to) return false;
      }

      // Filtro por busca (nome cliente, código pedido, código mostruário, produto)
      if (searchTerm) {
        const termo = searchTerm.toLowerCase();
        const match = 
          g.nome_cliente.toLowerCase().includes(termo) ||
          g.nome_revendedora.toLowerCase().includes(termo) ||
          (g.codigo_pedido && g.codigo_pedido.toLowerCase().includes(termo)) ||
          (g.codigo_mostruario && g.codigo_mostruario.toLowerCase().includes(termo)) ||
          g.descricao_produto.toLowerCase().includes(termo);
        if (!match) return false;
      }

      return true;
    });
  }, [garantias, filtroRevendedora, filtroStatus, dateRange, searchTerm]);

  // Contadores
  const totalAtivas = garantias.filter(g => isGarantiaAtiva(g.data_garantia_fim)).length;
  const totalExpiradas = garantias.length - totalAtivas;

  const limparFiltros = () => {
    setFiltroRevendedora('todas');
    setFiltroStatus('todas');
    setDateRange(undefined);
    setSearchTerm('');
  };

  const formatDateBR = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
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
    const errorMessage = error instanceof Error ? error.message : String(error);
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
              <p className="text-xs font-mono text-muted-foreground break-all">
                {errorMessage}
              </p>
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
            Consulta de garantias registradas ({garantiasFiltradas.length} de {garantias.length})
          </p>
        </div>
        <div className="flex gap-2">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
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

            {/* Filtro por revendedora */}
            <div>
              <Label className="text-sm mb-2 block">Revendedora</Label>
              <Select value={filtroRevendedora} onValueChange={setFiltroRevendedora}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {revendedorasUnicas.map((rev) => (
                    <SelectItem key={rev} value={rev}>
                      {rev}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          {(filtroRevendedora !== 'todas' || filtroStatus !== 'todas' || dateRange || searchTerm) && (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={limparFiltros}>
                Limpar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Garantias - Desktop: Tabela, Mobile: Cards */}
      {garantiasFiltradas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhuma garantia encontrada</h3>
            <p className="text-muted-foreground">
              {filtroRevendedora !== 'todas' || filtroStatus !== 'todas' || dateRange || searchTerm
                ? 'Nenhuma garantia encontrada com os filtros aplicados.'
                : 'Não há garantias registradas no sistema.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop - Tabela */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Revendedora</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Mostruário</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Data Compra</TableHead>
                      <TableHead>Válido até</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {garantiasFiltradas.map((garantia) => {
                      const ativa = isGarantiaAtiva(garantia.data_garantia_fim);
                      return (
                        <TableRow key={garantia.id}>
                          <TableCell className="font-medium">{garantia.nome_revendedora}</TableCell>
                          <TableCell>{garantia.nome_cliente}</TableCell>
                          <TableCell>{garantia.codigo_pedido || '-'}</TableCell>
                          <TableCell>{garantia.codigo_mostruario || '-'}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{garantia.descricao_produto}</TableCell>
                          <TableCell>{formatDateBR(garantia.data_compra)}</TableCell>
                          <TableCell>{formatDateBR(garantia.data_garantia_fim)}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                ativa 
                                  ? "bg-success/10 text-success border-success/30"
                                  : "bg-destructive/10 text-destructive border-destructive/30"
                              )}
                            >
                              {ativa ? 'Ativa' : 'Expirada'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile - Cards */}
          <div className="md:hidden grid gap-4">
            {garantiasFiltradas.map((garantia) => {
              const ativa = isGarantiaAtiva(garantia.data_garantia_fim);
              return (
                <Card key={garantia.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            ativa 
                              ? "bg-success/10 text-success border-success/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                          )}
                        >
                          {ativa ? 'Ativa' : 'Expirada'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          até {formatDateBR(garantia.data_garantia_fim)}
                        </span>
                      </div>

                      <div>
                        <p className="font-semibold text-lg">{garantia.nome_cliente}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2">{garantia.descricao_produto}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          <span className="truncate">{garantia.nome_revendedora}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          <span>Compra: {formatDateBR(garantia.data_compra)}</span>
                        </div>
                        {garantia.codigo_pedido && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <FileText className="h-3.5 w-3.5" />
                            <span>{garantia.codigo_pedido}</span>
                          </div>
                        )}
                        {garantia.codigo_mostruario && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Package className="h-3.5 w-3.5" />
                            <span>{garantia.codigo_mostruario}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
