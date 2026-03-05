import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ImportWhatsAppDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  nome: string;
  whatsapp: string;
  nomeNormalizado: string;
  matchId: string | null;
  matchNome: string | null;
}

type Step = 'upload' | 'preview' | 'result';

export function ImportWhatsAppDialog({ open, onClose, onSuccess }: ImportWhatsAppDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ updated: number; notFound: string[] }>({ updated: 0, notFound: [] });

  const normalize = (s: string) => s.toUpperCase().trim().replace(/\s+/g, ' ');

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

      if (json.length === 0) {
        toast.error('Planilha vazia');
        return;
      }

      // Detect column names (case-insensitive)
      const first = Object.keys(json[0]);
      const nomeCol = first.find(k => /nome/i.test(k));
      const whatsCol = first.find(k => /whats|telefone|celular|fone/i.test(k));

      if (!nomeCol || !whatsCol) {
        toast.error('Colunas "Nome" e "WhatsApp" não encontradas na planilha');
        return;
      }

      // Parse rows
      const parsed: ParsedRow[] = json
        .map(r => ({
          nome: String(r[nomeCol] || '').trim(),
          whatsapp: String(r[whatsCol] || '').trim(),
          nomeNormalizado: normalize(String(r[nomeCol] || '')),
          matchId: null,
          matchNome: null,
        }))
        .filter(r => r.nome && r.whatsapp);

      if (parsed.length === 0) {
        toast.error('Nenhuma linha válida encontrada');
        return;
      }

      // Fetch existing revendedoras for matching
      const { data: revendedoras, error } = await supabase
        .from('revendedoras')
        .select('id, nome')
        .order('nome');

      if (error) throw error;

      // Match by normalized name
      const revMap = new Map<string, { id: string; nome: string }>();
      revendedoras?.forEach(r => {
        revMap.set(normalize(r.nome), { id: r.id, nome: r.nome });
      });

      const matched = parsed.map(row => {
        const match = revMap.get(row.nomeNormalizado);
        return {
          ...row,
          matchId: match?.id || null,
          matchNome: match?.nome || null,
        };
      });

      setRows(matched);
      setStep('preview');
    } catch (err) {
      toast.error('Erro ao ler planilha');
      console.error(err);
    }

    // Reset input
    e.target.value = '';
  }, []);

  const handleImport = async () => {
    const toUpdate = rows.filter(r => r.matchId);
    if (toUpdate.length === 0) {
      toast.error('Nenhuma correspondência encontrada');
      return;
    }

    setImporting(true);
    let updated = 0;

    try {
      // Batch update
      for (const row of toUpdate) {
        const { error } = await supabase
          .from('revendedoras')
          .update({ whatsapp: row.whatsapp, atualizado_em: new Date().toISOString() })
          .eq('id', row.matchId!);

        if (!error) updated++;
      }

      const notFound = rows.filter(r => !r.matchId).map(r => r.nome);
      setResult({ updated, notFound });
      setStep('result');
      onSuccess();

      toast.success(`${updated} WhatsApp(s) atualizado(s)`);
    } catch {
      toast.error('Erro durante importação');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setRows([]);
    setResult({ updated: 0, notFound: [] });
    onClose();
  };

  const matchedCount = rows.filter(r => r.matchId).length;
  const notFoundCount = rows.filter(r => !r.matchId).length;

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar WhatsApp via Planilha
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione um arquivo Excel (.xlsx) com as colunas <strong>Nome</strong> e <strong>WhatsApp</strong>.
              O sistema fará a correspondência pelo nome da revendedora.
            </p>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="max-w-xs mx-auto"
              />
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> {matchedCount} encontrada(s)
              </Badge>
              {notFoundCount > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="h-3 w-3" /> {notFoundCount} não encontrada(s)
                </Badge>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome (planilha)</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{row.nome}</TableCell>
                      <TableCell className="text-sm">{row.whatsapp}</TableCell>
                      <TableCell>
                        {row.matchId ? (
                          <Badge variant="default" className="text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Encontrada
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <XCircle className="h-3 w-3" /> Não encontrada
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleImport} disabled={importing || matchedCount === 0}>
                {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Importar {matchedCount} WhatsApp(s)
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
              <p className="text-lg font-semibold">{result.updated} WhatsApp(s) atualizado(s)</p>
            </div>

            {result.notFound.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Nomes não encontrados ({result.notFound.length}):
                </p>
                <div className="max-h-32 overflow-y-auto border rounded p-3 text-sm space-y-1">
                  {result.notFound.map((nome, i) => (
                    <div key={i} className="text-muted-foreground">• {nome}</div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose}>Fechar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
