import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Profile {
  id: string;
  nome: string;
  email: string | null;
}

interface ImportedRow {
  revendedora: string;
  valor_previsto: number;
  data_agendada: string;
  observacoes?: string;
  status: 'pendente' | 'erro' | 'sucesso';
  erro?: string;
}

export default function ImportarCobrancas() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [representanteId, setRepresentanteId] = useState('');
  const [importedData, setImportedData] = useState<ImportedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Query para representantes ativos
  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes-import'],
    queryFn: async () => {
      // Busca apenas representantes
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'representante');
      
      if (rolesError) throw rolesError;
      
      const representanteIds = rolesData.map(r => r.user_id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .eq('ativo', true)
        .in('id', representanteIds)
        .order('nome');
      
      if (error) throw error;
      return data as Profile[];
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast.error('Por favor, selecione um arquivo CSV');
        return;
      }
      setSelectedFile(file);
      setImportedData([]);
    }
  };

  const parseCSV = (text: string): ImportedRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('Arquivo CSV vazio ou inválido');
    }

    // Pula o cabeçalho
    const dataLines = lines.slice(1);
    
    return dataLines.map((line, index) => {
      const values = line.split(',').map(v => v.trim());
      
      if (values.length < 3) {
        return {
          revendedora: '',
          valor_previsto: 0,
          data_agendada: '',
          status: 'erro' as const,
          erro: `Linha ${index + 2}: Formato inválido`,
        };
      }

      const [revendedora, valorStr, dataStr, ...observacoesArr] = values;
      const valor_previsto = parseFloat(valorStr.replace(/[^\d,.-]/g, '').replace(',', '.'));
      
      // Valida data (espera formato DD/MM/YYYY ou YYYY-MM-DD)
      let data_agendada = '';
      if (dataStr.includes('/')) {
        const [dia, mes, ano] = dataStr.split('/');
        data_agendada = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      } else {
        data_agendada = dataStr;
      }

      if (!revendedora || isNaN(valor_previsto) || !data_agendada) {
        return {
          revendedora: revendedora || '',
          valor_previsto: valor_previsto || 0,
          data_agendada: data_agendada || '',
          status: 'erro' as const,
          erro: `Linha ${index + 2}: Dados inválidos`,
        };
      }

      return {
        revendedora,
        valor_previsto,
        data_agendada,
        observacoes: observacoesArr.join(','),
        status: 'pendente' as const,
      };
    });
  };

  const handleProcessFile = async () => {
    if (!selectedFile) {
      toast.error('Selecione um arquivo primeiro');
      return;
    }

    if (!representanteId) {
      toast.error('Selecione um representante');
      return;
    }

    setIsProcessing(true);

    try {
      const text = await selectedFile.text();
      const data = parseCSV(text);
      setImportedData(data);
      
      const erros = data.filter(d => d.status === 'erro').length;
      if (erros > 0) {
        toast.warning(`${erros} linha(s) com erro. Corrija os erros antes de importar.`);
      } else {
        toast.success(`${data.length} linha(s) prontas para importar`);
      }
    } catch (error: any) {
      toast.error('Erro ao processar arquivo: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    const validRows = importedData.filter(row => row.status === 'pendente');
    
    if (validRows.length === 0) {
      toast.error('Nenhuma linha válida para importar');
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await supabase.from('cobrancas_agendadas').insert(
        validRows.map(row => ({
          representante_id: representanteId,
          revendedora: row.revendedora,
          valor_previsto: row.valor_previsto,
          data_agendada: row.data_agendada,
          observacoes: row.observacoes || null,
          status: 'pendente' as const,
        }))
      );

      if (error) throw error;

      // Atualiza status para sucesso
      setImportedData(prev => 
        prev.map(row => 
          row.status === 'pendente' 
            ? { ...row, status: 'sucesso' as const }
            : row
        )
      );

      toast.success(`${validRows.length} cobrança(s) importada(s) com sucesso!`);
    } catch (error: any) {
      toast.error('Erro ao importar: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const template = 'Revendedora,Valor Previsto,Data Agendada (DD/MM/YYYY),Observações\nMaria Silva,1500.00,25/12/2024,Pagamento parcelado\nJoão Santos,2300.50,30/12/2024,Cliente preferencial';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_importacao_cobrancas.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Importar Cobranças</h1>
        <p className="text-muted-foreground">Importe cobranças agendadas via arquivo CSV</p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          O arquivo CSV deve conter as colunas: Revendedora, Valor Previsto, Data Agendada (DD/MM/YYYY), Observações
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Upload de Planilha
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Baixar Modelo
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="representante">Representante *</Label>
            <Select value={representanteId} onValueChange={setRepresentanteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o representante" />
              </SelectTrigger>
              <SelectContent>
                {representantes.map((rep) => (
                  <SelectItem key={rep.id} value={rep.id}>
                    {rep.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Arquivo CSV *</Label>
            <div className="flex gap-2">
              <Input
                id="file"
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="flex-1"
              />
              <Button onClick={handleProcessFile} disabled={!selectedFile || !representanteId || isProcessing}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Processar
              </Button>
            </div>
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Arquivo selecionado: {selectedFile.name}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {importedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Dados Processados
              <Button 
                onClick={handleImport} 
                disabled={isProcessing || !importedData.some(d => d.status === 'pendente')}
              >
                <Upload className="h-4 w-4 mr-2" />
                Importar Válidos
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Revendedora</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importedData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {row.status === 'erro' && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                        {row.status === 'pendente' && (
                          <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                        )}
                        {row.status === 'sucesso' && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </TableCell>
                      <TableCell>{row.revendedora}</TableCell>
                      <TableCell>
                        {row.valor_previsto > 0 ? `R$ ${row.valor_previsto.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        {row.data_agendada ? format(new Date(row.data_agendada + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        {row.erro ? (
                          <span className="text-sm text-destructive">{row.erro}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">{row.observacoes || '-'}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
