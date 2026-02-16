import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatarValor } from '@/lib/utils';
import * as XLSX from 'xlsx';

const TIPOS_ACAO = [
  { value: 'REGISTRO_PAGAMENTO', label: 'Registro de Pagamento' },
  { value: 'ALTERACAO_COMISSAO', label: 'Alteração de Comissão' },
  { value: 'ACRESCIMO_PEDIDO', label: 'Acréscimo de Pedido' },
  { value: 'REGISTRO_ADIANTAMENTO', label: 'Registro de Adiantamento' },
  { value: 'DESISTENCIA_KIT', label: 'Desistência de Kit' },
  { value: 'REABERTURA_PEDIDO', label: 'Reabertura de Pedido' },
  { value: 'ALTERACAO_DEVOLUCAO', label: 'Alteração/Devolução' },
  { value: 'CONFERENCIA_INTERNA', label: 'Conferência Interna' },
];

export default function HistoricoAcoes() {
  const { user } = useAuth();
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['logs-operacionais-usuario', user?.id, dataInicio, dataFim, tipoFiltro],
    queryFn: async () => {
      let query = supabase
        .from('logs_operacionais' as any)
        .select('*')
        .eq('usuario_id', user!.id)
        .order('criado_em', { ascending: false })
        .limit(500);

      if (dataInicio) query = query.gte('criado_em', `${dataInicio}T00:00:00`);
      if (dataFim) query = query.lte('criado_em', `${dataFim}T23:59:59`);
      if (tipoFiltro && tipoFiltro !== 'todos') query = query.eq('tipo_acao', tipoFiltro);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const getTipoLabel = (tipo: string) => {
    return TIPOS_ACAO.find(t => t.value === tipo)?.label || tipo;
  };

  const exportarCSV = () => {
    if (logs.length === 0) return;
    const dados = logs.map((log: any) => ({
      Data: format(new Date(log.criado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      'Tipo de Ação': getTipoLabel(log.tipo_acao),
      Descrição: log.descricao,
      'Valor Antes': log.valor_antes != null ? log.valor_antes : '',
      'Valor Depois': log.valor_depois != null ? log.valor_depois : '',
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico');
    XLSX.writeFile(wb, `historico-acoes-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
            Histórico de Ações
          </h1>
          <p className="text-sm text-muted-foreground">Suas ações registradas no sistema</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportarCSV} disabled={logs.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">De:</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-9 w-full sm:w-[160px] text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Até:</Label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-9 w-full sm:w-[160px] text-sm" />
            </div>
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger className="w-full sm:w-[220px] h-9">
                <SelectValue placeholder="Tipo de ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {TIPOS_ACAO.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum registro encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor Antes</TableHead>
                    <TableHead className="text-right">Valor Depois</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(log.criado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{getTipoLabel(log.tipo_acao)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate">{log.descricao}</TableCell>
                      <TableCell className="text-right text-sm">
                        {log.valor_antes != null ? formatarValor(log.valor_antes) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {log.valor_depois != null ? formatarValor(log.valor_depois) : '—'}
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
