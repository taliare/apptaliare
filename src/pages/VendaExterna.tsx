import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarValor } from '@/lib/utils';
import { DateRangeFilter } from '@/components/DateRangeFilter';

interface EntregaVendedora {
  id: string;
  vendedora: string;
  representante_nome: string;
  codigo_kit: string;
  tipo: string;
  valor: number;
  data_entrega: string;
  data_vencimento: string;
}

export default function VendaExterna() {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  // Query para buscar entregas com vendedora vinculada
  const { data: entregas = [], isLoading } = useQuery({
    queryKey: ['vendas-externas', startDate, endDate],
    queryFn: async () => {
      // Buscar cobrancas agendadas que têm vendedora preenchida
      let query = supabase
        .from('cobrancas_agendadas')
        .select(`
          id,
          vendedora,
          representante_id,
          codigo_nota,
          tipo,
          valor_previsto,
          data_agendada,
          criado_em
        `)
        .not('vendedora', 'is', null)
        .neq('vendedora', '');
      
      if (startDate) {
        query = query.gte('criado_em', startDate);
      }
      if (endDate) {
        query = query.lte('criado_em', endDate + 'T23:59:59');
      }

      const { data: cobrancas, error: cobrancasError } = await query.order('criado_em', { ascending: false });
      
      if (cobrancasError) throw cobrancasError;

      // Buscar nomes dos representantes
      const repIds = [...new Set(cobrancas?.map(c => c.representante_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', repIds);
      
      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.id, p.nome]) || []);

      // Buscar kits entregues para pegar data de entrega
      const codigoNotas = cobrancas?.map(c => c.codigo_nota).filter(Boolean) || [];
      const { data: kitsEntregues } = await supabase
        .from('kits_entregues')
        .select('codigo_mostruario, data_entrega, data_vencimento')
        .in('codigo_mostruario', codigoNotas);

      const kitsMap = new Map(kitsEntregues?.map(k => [k.codigo_mostruario, k]) || []);

      return cobrancas?.map(c => ({
        id: c.id,
        vendedora: c.vendedora || '',
        representante_nome: profileMap.get(c.representante_id) || 'Desconhecido',
        codigo_kit: c.codigo_nota || '',
        tipo: c.tipo || 'inicial',
        valor: c.valor_previsto || 0,
        data_entrega: kitsMap.get(c.codigo_nota)?.data_entrega || c.criado_em?.split('T')[0] || '',
        data_vencimento: kitsMap.get(c.codigo_nota)?.data_vencimento || c.data_agendada || '',
      })) as EntregaVendedora[];
    },
  });

  // Filtrar por termo de busca
  const entregasFiltradas = useMemo(() => {
    if (!searchTerm) return entregas;
    const termo = searchTerm.toLowerCase();
    return entregas.filter(e => 
      e.vendedora.toLowerCase().includes(termo) ||
      e.representante_nome.toLowerCase().includes(termo) ||
      e.codigo_kit.toLowerCase().includes(termo)
    );
  }, [entregas, searchTerm]);

  const tipoLabels: Record<string, string> = {
    inicial: 'Inicial',
    especial: 'Especial',
    maleta: 'Maleta',
  };

  const tipoColors: Record<string, string> = {
    inicial: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    especial: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    maleta: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Venda Externa</h1>
        <p className="text-muted-foreground">Controle de entregas vinculadas a vendedoras</p>
      </div>

      <DateRangeFilter
        onFilterChange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
      />

      {/* Barra de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por vendedora, representante ou código do kit..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Cards resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendedoras</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(entregasFiltradas.map(e => e.vendedora)).size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Entregas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entregasFiltradas.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatarValor(entregasFiltradas.reduce((acc, e) => acc + e.valor, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de entregas */}
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
          ) : entregasFiltradas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Nenhuma entrega encontrada com esse termo' : 'Nenhuma entrega com vendedora vinculada'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedora</TableHead>
                    <TableHead>Representante</TableHead>
                    <TableHead>Código do Kit</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data Entrega</TableHead>
                    <TableHead>Vencimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entregasFiltradas.map((entrega) => (
                    <TableRow key={entrega.id}>
                      <TableCell className="font-medium">{entrega.vendedora}</TableCell>
                      <TableCell>{entrega.representante_nome}</TableCell>
                      <TableCell className="font-mono text-sm">{entrega.codigo_kit}</TableCell>
                      <TableCell>
                        <Badge className={tipoColors[entrega.tipo] || ''}>
                          {tipoLabels[entrega.tipo] || entrega.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatarValor(entrega.valor)}
                      </TableCell>
                      <TableCell>
                        {entrega.data_entrega && format(new Date(entrega.data_entrega + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {entrega.data_vencimento && format(new Date(entrega.data_vencimento + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
