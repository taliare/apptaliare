import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format, subHours } from 'date-fns';
import { formatDateBR } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';

interface ImportedRow {
  representante_email: string;
  nome_revendedora: string;
  codigo_nota: string;
  tipo: string;
  valor: number;
  data_vencimento: string;
  representante_id?: string;
  status: 'pendente' | 'erro' | 'sucesso';
  erro?: string;
}

export default function ImportarCobrancas() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importedData, setImportedData] = useState<ImportedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedToDelete, setSelectedToDelete] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Buscar cobranças importadas nas últimas 24 horas
  const { data: recentImports = [], refetch: refetchRecent } = useQuery({
    queryKey: ['recent-imports'],
    queryFn: async () => {
      const last24Hours = subHours(new Date(), 24).toISOString();
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('*, profiles(nome, email)')
        .gte('criado_em', last24Hours)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx')) {
        toast.error('Por favor, selecione um arquivo Excel (.xlsx)');
        return;
      }
      setSelectedFile(file);
      setImportedData([]);
    }
  };

  const parseExcel = async (file: File): Promise<ImportedRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (jsonData.length === 0) {
            reject(new Error('Arquivo Excel vazio'));
            return;
          }

          const rows = jsonData.map((row: any, index: number) => {
            const lineNumber = index + 2;
            
            // Validação de campos obrigatórios
            if (!row.representante_email || !row.nome_revendedora || !row.codigo_nota || !row.tipo || !row.valor || !row.data_vencimento) {
              return {
                representante_email: row.representante_email || '',
                nome_revendedora: row.nome_revendedora || '',
                codigo_nota: row.codigo_nota || '',
                tipo: row.tipo || '',
                valor: 0,
                data_vencimento: '',
                status: 'erro' as const,
                erro: `Linha ${lineNumber}: Campos obrigatórios ausentes`,
              };
            }

            // Parse do valor
            let valor = 0;
            if (typeof row.valor === 'number') {
              valor = row.valor;
            } else if (typeof row.valor === 'string') {
              // Trata formato brasileiro: 8.710,00 -> 8710.00
              // Remove pontos (separadores de milhar) e substitui vírgula por ponto (decimal)
              const valorLimpo = row.valor
                .replace(/[^\d,.-]/g, '') // Remove símbolos exceto dígitos, vírgula, ponto e traço
                .replace(/\./g, '') // Remove pontos (separadores de milhar)
                .replace(',', '.'); // Substitui vírgula por ponto (decimal)
              valor = parseFloat(valorLimpo);
            }

            if (isNaN(valor) || valor <= 0) {
              return {
                representante_email: row.representante_email,
                nome_revendedora: row.nome_revendedora,
                codigo_nota: row.codigo_nota,
                tipo: row.tipo,
                valor: 0,
                data_vencimento: '',
                status: 'erro' as const,
                erro: `Linha ${lineNumber}: Valor inválido`,
              };
            }

            // Parse da data
            let data_vencimento = '';
            if (row.data_vencimento) {
              const dateValue = row.data_vencimento;
              
              if (typeof dateValue === 'number') {
                // Excel serial date
                const date = XLSX.SSF.parse_date_code(dateValue);
                data_vencimento = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
              } else if (typeof dateValue === 'string') {
                if (dateValue.includes('/')) {
                  const [dia, mes, ano] = dateValue.split('/');
                  data_vencimento = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
                } else if (dateValue.includes('-')) {
                  data_vencimento = dateValue;
                }
              }
            }

            if (!data_vencimento || !/^\d{4}-\d{2}-\d{2}$/.test(data_vencimento)) {
              return {
                representante_email: row.representante_email,
                nome_revendedora: row.nome_revendedora,
                codigo_nota: row.codigo_nota,
                tipo: row.tipo,
                valor,
                data_vencimento: '',
                status: 'erro' as const,
                erro: `Linha ${lineNumber}: Data de vencimento inválida`,
              };
            }

            // Validação do tipo
            const tipoLower = row.tipo.toLowerCase();
            if (tipoLower !== 'kit' && tipoLower !== 'repasse') {
              return {
                representante_email: row.representante_email,
                nome_revendedora: row.nome_revendedora,
                codigo_nota: row.codigo_nota,
                tipo: row.tipo,
                valor,
                data_vencimento,
                status: 'erro' as const,
                erro: `Linha ${lineNumber}: Tipo deve ser "kit" ou "repasse"`,
              };
            }

            return {
              representante_email: row.representante_email.toLowerCase().trim(),
              nome_revendedora: row.nome_revendedora,
              codigo_nota: row.codigo_nota,
              tipo: tipoLower,
              valor,
              data_vencimento,
              status: 'pendente' as const,
            };
          });

          resolve(rows);
        } catch (error: any) {
          reject(new Error('Erro ao processar Excel: ' + error.message));
        }
      };

      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsBinaryString(file);
    });
  };

  const handleProcessFile = async () => {
    if (!selectedFile) {
      toast.error('Selecione um arquivo primeiro');
      return;
    }

    setIsProcessing(true);

    try {
      const data = await parseExcel(selectedFile);
      
      // Buscar IDs dos representantes por email
      const emails = [...new Set(data.map(d => d.representante_email))];
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email')
        .in('email', emails);

      if (error) throw error;

      const emailToIdMap = new Map(profiles?.map(p => [p.email?.toLowerCase(), p.id]) || []);

      // Mapear representante_id para cada linha
      const dataWithIds = data.map(row => {
        if (row.status === 'erro') return row;
        
        const representante_id = emailToIdMap.get(row.representante_email);
        if (!representante_id) {
          return {
            ...row,
            status: 'erro' as const,
            erro: `Representante com email ${row.representante_email} não encontrado`,
          };
        }
        
        return { ...row, representante_id };
      });

      setImportedData(dataWithIds);
      
      const erros = dataWithIds.filter(d => d.status === 'erro').length;
      const validos = dataWithIds.filter(d => d.status === 'pendente').length;
      
      if (erros > 0) {
        toast.warning(`${validos} linha(s) válida(s), ${erros} com erro.`);
      } else {
        toast.success(`${validos} linha(s) prontas para importar`);
      }
    } catch (error: any) {
      toast.error('Erro ao processar arquivo: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    const validRows = importedData.filter(row => row.status === 'pendente' && row.representante_id);
    
    if (validRows.length === 0) {
      toast.error('Nenhuma linha válida para importar');
      return;
    }

    setIsProcessing(true);

    try {
      // Verificar duplicações
      const { data: existingCobrancas } = await supabase
        .from('cobrancas_agendadas')
        .select('codigo_nota, representante_id')
        .in('codigo_nota', validRows.map(r => r.codigo_nota));

      const existingKeys = new Set(
        existingCobrancas?.map(c => `${c.codigo_nota}_${c.representante_id}`) || []
      );

      const rowsToInsert = validRows.filter(row => {
        const key = `${row.codigo_nota}_${row.representante_id}`;
        return !existingKeys.has(key);
      });

      if (rowsToInsert.length === 0) {
        toast.warning('Todas as cobranças já existem no sistema');
        setIsProcessing(false);
        return;
      }

      const { error } = await supabase.from('cobrancas_agendadas').insert(
        rowsToInsert.map(row => ({
          representante_id: row.representante_id!,
          revendedora: row.nome_revendedora,
          codigo_nota: row.codigo_nota,
          tipo: row.tipo,
          valor_previsto: row.valor,
          data_agendada: row.data_vencimento,
          status: 'pendente' as const,
        }))
      );

      if (error) throw error;

      setImportedData(prev => 
        prev.map(row => 
          row.status === 'pendente' && row.representante_id
            ? { ...row, status: 'sucesso' as const }
            : row
        )
      );

      const duplicadas = validRows.length - rowsToInsert.length;
      if (duplicadas > 0) {
        toast.success(`${rowsToInsert.length} cobrança(s) importada(s). ${duplicadas} já existiam.`);
      } else {
        toast.success(`${rowsToInsert.length} cobrança(s) importada(s) com sucesso!`);
      }
      refetchRecent();
    } catch (error: any) {
      toast.error('Erro ao importar: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedToDelete.size === 0) {
      toast.error('Selecione ao menos uma cobrança para remover');
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('cobrancas_agendadas')
        .delete()
        .in('id', Array.from(selectedToDelete));

      if (error) throw error;

      toast.success(`${selectedToDelete.size} cobrança(s) removida(s) com sucesso`);
      setSelectedToDelete(new Set());
      refetchRecent();
    } catch (error: any) {
      toast.error('Erro ao remover cobranças: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedToDelete(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (selectedToDelete.size === recentImports.length) {
      setSelectedToDelete(new Set());
    } else {
      setSelectedToDelete(new Set(recentImports.map(r => r.id)));
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        representante_email: 'representante@example.com',
        nome_revendedora: 'Maria Silva',
        codigo_nota: 'NOTA-001',
        tipo: 'kit',
        valor: 1500.00,
        data_vencimento: '25/12/2024'
      },
      {
        representante_email: 'representante@example.com',
        nome_revendedora: 'João Santos',
        codigo_nota: 'NOTA-002',
        tipo: 'repasse',
        valor: 2300.50,
        data_vencimento: '30/12/2024'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cobranças');
    XLSX.writeFile(wb, 'modelo_importacao_agenda_cobranca.xlsx');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Importar Agenda de Cobrança</h1>
        <p className="text-muted-foreground">Importe cobranças agendadas via arquivo Excel</p>
      </div>

      {recentImports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Importações Recentes (Últimas 24h)
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  {selectedToDelete.size === recentImports.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      disabled={selectedToDelete.size === 0 || isProcessing}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover Selecionados ({selectedToDelete.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja remover {selectedToDelete.size} cobrança(s) selecionada(s)? 
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteSelected}>
                        Confirmar Exclusão
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedToDelete.size === recentImports.length && recentImports.length > 0}
                        onCheckedChange={selectAll}
                      />
                    </TableHead>
                    <TableHead>Importado em</TableHead>
                    <TableHead>Representante</TableHead>
                    <TableHead>Revendedora</TableHead>
                    <TableHead>Código Nota</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentImports.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedToDelete.has(row.id)}
                          onCheckedChange={() => toggleSelection(row.id)}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(row.criado_em!), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.profiles?.nome || 'N/A'}
                      </TableCell>
                      <TableCell>{row.revendedora}</TableCell>
                      <TableCell className="font-mono text-sm">{row.codigo_nota}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          row.tipo === 'kit' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {row.tipo}
                        </span>
                      </TableCell>
                      <TableCell>R$ {row.valor_previsto.toFixed(2)}</TableCell>
                      <TableCell>{formatDateBR(row.data_agendada)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          row.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' :
                          row.status === 'pago' ? 'bg-green-100 text-green-800' :
                          row.status === 'parcial' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {row.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Formato do arquivo:</strong> O Excel deve conter as colunas: representante_email, nome_revendedora, codigo_nota, tipo (kit ou repasse), valor, data_vencimento (DD/MM/YYYY)
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Upload de Planilha Excel
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Baixar Modelo
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Arquivo Excel (.xlsx) *</Label>
            <div className="flex gap-2">
              <Input
                id="file"
                type="file"
                accept=".xlsx"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="flex-1"
              />
              <Button onClick={handleProcessFile} disabled={!selectedFile || isProcessing}>
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
              Dados Processados ({importedData.filter(d => d.status === 'pendente').length} válidos)
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
                    <TableHead>Email Representante</TableHead>
                    <TableHead>Revendedora</TableHead>
                    <TableHead>Código Nota</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importedData.map((row, index) => (
                    <TableRow key={index} className={row.status === 'erro' ? 'bg-destructive/10' : ''}>
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
                      <TableCell className="text-sm">{row.representante_email}</TableCell>
                      <TableCell>{row.nome_revendedora}</TableCell>
                      <TableCell className="font-mono text-sm">{row.codigo_nota}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          row.tipo === 'kit' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {row.tipo}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.valor > 0 ? `R$ ${row.valor.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        {row.erro ? (
                          <span className="text-sm text-destructive">{row.erro}</span>
                        ) : row.data_vencimento ? (
                          format(new Date(row.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy')
                        ) : '-'}
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