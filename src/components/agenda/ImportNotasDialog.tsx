import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const COLUNAS_IMPORT = [
  'representante_email',
  'nome_revendedora',
  'codigo_nota',
  'situacao',
  'valor',
  'data_vencimento',
] as const;

type LinhaStatus = 'valida' | 'existe' | 'erro';

interface Linha {
  linha: number;
  representante_email: string;
  nome_revendedora: string;
  codigo_nota: string;
  situacao: 'pendente' | 'parcial' | '';
  valor: number;
  data_vencimento: string; // YYYY-MM-DD
  representante_id?: string;
  revendedora_canonica?: string;
  status: LinhaStatus;
  erro?: string;
}

const norm = (s: string) => (s || '').trim().toUpperCase();

function parseDataVenc(v: any): string | 'invalid' | '' {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return 'invalid';
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (s.includes('/')) {
      const [d, m, y] = s.split('/');
      if (d && m && y) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  return 'invalid';
}

function parseValorBR(v: any): number {
  if (v === null || v === undefined || v === '') return NaN;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/[R$\s]/g, '');
  if (!s) return NaN;
  // remove milhar "." e troca "," por "."
  const normalized = s.includes(',')
    ? s.replace(/\./g, '').replace(',', '.')
    : s;
  const n = Number(normalized);
  return isNaN(n) ? NaN : n;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportNotasDialog({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [processando, setProcessando] = useState(false);
  const [importando, setImportando] = useState(false);

  const reset = () => { setFile(null); setLinhas([]); };
  const handleClose = () => { reset(); onClose(); };

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.xlsx')) {
      toast({ title: 'Arquivo inválido', description: 'Selecione um .xlsx', variant: 'destructive' });
      return;
    }
    setFile(f);
    setLinhas([]);
  };

  const processar = async () => {
    if (!file) return;
    setProcessando(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (rows.length === 0) {
        toast({ title: 'Planilha vazia', variant: 'destructive' });
        setProcessando(false);
        return;
      }

      // Mapear representantes por email
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'representante');
      const repIds = (roles || []).map(r => r.user_id);
      const { data: profs } = await supabase.from('profiles').select('id, email').in('id', repIds);
      const emailToId = new Map<string, string>();
      (profs || []).forEach(p => { if (p.email) emailToId.set(p.email.toLowerCase().trim(), p.id); });

      // Pré-processar
      const pre: Linha[] = rows.map((row, i) => {
        const linha = i + 2;
        const rep_email = String(row.representante_email ?? '').toLowerCase().trim();
        const nome_rev = String(row.nome_revendedora ?? '').trim();
        const codigo = String(row.codigo_nota ?? '').trim();
        const sitRaw = String(row.situacao ?? '').toLowerCase().trim();
        const situacao = (sitRaw === 'parcial' ? 'parcial' : sitRaw === 'pendente' ? 'pendente' : '') as Linha['situacao'];
        const valor = parseValorBR(row.valor);
        const dv = parseDataVenc(row.data_vencimento);

        const base: Linha = {
          linha,
          representante_email: rep_email,
          nome_revendedora: nome_rev,
          codigo_nota: codigo,
          situacao,
          valor,
          data_vencimento: typeof dv === 'string' && dv !== 'invalid' ? dv : '',
          status: 'valida',
        };

        if (!rep_email) return { ...base, status: 'erro', erro: 'representante_email obrigatório' };
        const rep_id = emailToId.get(rep_email);
        if (!rep_id) return { ...base, status: 'erro', erro: 'Representante não encontrado' };
        if (!nome_rev) return { ...base, status: 'erro', erro: 'nome_revendedora obrigatório' };
        if (!codigo) return { ...base, status: 'erro', erro: 'codigo_nota obrigatório' };
        if (!situacao) return { ...base, status: 'erro', erro: 'situacao inválida (use pendente ou parcial)' };
        if (isNaN(valor) || valor <= 0) return { ...base, status: 'erro', erro: 'valor inválido' };
        if (dv === 'invalid') return { ...base, status: 'erro', erro: 'data_vencimento inválida (use DD/MM/AAAA)' };
        if (!base.data_vencimento) return { ...base, status: 'erro', erro: 'data_vencimento obrigatória' };

        return { ...base, representante_id: rep_id };
      });

      // Buscar revendedoras dos representantes envolvidos
      const repsUsados = [...new Set(pre.filter(p => p.representante_id).map(p => p.representante_id!))];
      const revByKey = new Map<string, string>(); // "repId::NOMENORM" -> nome canônico
      if (repsUsados.length > 0) {
        const { data: revs } = await supabase
          .from('revendedoras')
          .select('nome, representante_id')
          .in('representante_id', repsUsados);
        (revs || []).forEach((r: any) => {
          revByKey.set(`${r.representante_id}::${norm(r.nome)}`, r.nome);
        });
      }

      // Buscar duplicidades (codigo_nota + representante_id)
      const codigos = [...new Set(pre.filter(p => p.codigo_nota && p.representante_id).map(p => p.codigo_nota))];
      const existeKey = new Set<string>();
      if (codigos.length > 0) {
        const { data: existentes } = await supabase
          .from('cobrancas_agendadas')
          .select('codigo_nota, representante_id')
          .in('codigo_nota', codigos);
        (existentes || []).forEach((c: any) => {
          if (c.codigo_nota && c.representante_id) {
            existeKey.add(`${c.representante_id}::${c.codigo_nota}`);
          }
        });
      }

      const final: Linha[] = pre.map(p => {
        if (p.status === 'erro') return p;
        const canonica = revByKey.get(`${p.representante_id}::${norm(p.nome_revendedora)}`);
        if (!canonica) {
          return { ...p, status: 'erro', erro: 'Revendedora não cadastrada — cadastre a revendedora primeiro' };
        }
        if (existeKey.has(`${p.representante_id}::${p.codigo_nota}`)) {
          return { ...p, revendedora_canonica: canonica, status: 'existe', erro: 'Nota já cadastrada' };
        }
        return { ...p, revendedora_canonica: canonica };
      });

      setLinhas(final);
      toast({ title: `Processadas ${final.length} linha(s)` });
    } catch (e: any) {
      toast({ title: 'Erro ao processar', description: e.message, variant: 'destructive' });
    } finally {
      setProcessando(false);
    }
  };

  const importar = async () => {
    const validas = linhas.filter(l => l.status === 'valida');
    if (validas.length === 0) {
      toast({ title: 'Nada para importar', variant: 'destructive' });
      return;
    }
    setImportando(true);
    let ok = 0;
    const erros: string[] = [];

    for (const l of validas) {
      const isParcial = l.situacao === 'parcial';
      const payload = {
        representante_id: l.representante_id!,
        revendedora: l.revendedora_canonica!,
        codigo_nota: l.codigo_nota,
        tipo: isParcial ? 'repasse' : 'kit',
        status: isParcial ? 'parcial' : 'pendente',
        valor_previsto: l.valor,
        valor_kit_original: isParcial ? null : l.valor,
        data_agendada: l.data_vencimento,
      } as any;
      const { error } = await supabase.from('cobrancas_agendadas').insert(payload);
      if (error) erros.push(`Linha ${l.linha} (${l.codigo_nota}): ${error.message}`);
      else ok++;
    }

    const jaExistiam = linhas.filter(l => l.status === 'existe').length;
    const erroPre = linhas.filter(l => l.status === 'erro').length;

    toast({
      title: 'Importação concluída',
      description: `${ok} importada(s) · ${jaExistiam} já existia(m) · ${erroPre + erros.length} erro(s)`,
    });
    if (erros.length) console.error('Erros importação notas:', erros);
    qc.invalidateQueries({ queryKey: ['todas-cobrancas-admin'] });
    setImportando(false);
    handleClose();
  };

  const cValidas = linhas.filter(l => l.status === 'valida').length;
  const cExiste = linhas.filter(l => l.status === 'existe').length;
  const cErro = linhas.filter(l => l.status === 'erro').length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Notas (Excel)</DialogTitle>
          <DialogDescription>
            Colunas: {COLUNAS_IMPORT.join(', ')}. A revendedora precisa já estar cadastrada para o representante.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Arquivo .xlsx</Label>
            <div className="flex gap-2">
              <Input id="file" type="file" accept=".xlsx" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <Button onClick={processar} disabled={!file || processando}>
                {processando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Validar'}
              </Button>
            </div>
          </div>

          {linhas.length > 0 && (
            <>
              <div className="flex gap-2 flex-wrap">
                <Badge>{cValidas} válida(s)</Badge>
                <Badge variant="secondary">{cExiste} já existe(m)</Badge>
                <Badge variant="destructive">{cErro} erro(s)</Badge>
              </div>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Linha</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Revendedora</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Venc.</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.slice(0, 200).map(l => (
                      <TableRow key={l.linha}>
                        <TableCell>{l.linha}</TableCell>
                        <TableCell className="text-xs">{l.codigo_nota}</TableCell>
                        <TableCell className="text-xs">{l.revendedora_canonica || l.nome_revendedora}</TableCell>
                        <TableCell className="text-xs">{l.situacao || '-'}</TableCell>
                        <TableCell className="text-xs">{isNaN(l.valor) ? '-' : l.valor.toFixed(2)}</TableCell>
                        <TableCell className="text-xs">{l.data_vencimento || '-'}</TableCell>
                        <TableCell>
                          {l.status === 'valida' && <Badge>Válida</Badge>}
                          {l.status === 'existe' && <Badge variant="secondary">Já existe</Badge>}
                          {l.status === 'erro' && <Badge variant="destructive">Erro</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.erro}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {linhas.length > 200 && (
                  <p className="p-2 text-xs text-muted-foreground">Mostrando 200 de {linhas.length} linhas.</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={importar} disabled={importando || cValidas === 0}>
            {importando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Importar válidas ({cValidas})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// === Export e modelo ===

export async function exportarNotasXlsx(cobrancasFiltradas: any[]) {
  if (!cobrancasFiltradas || cobrancasFiltradas.length === 0) {
    return { ok: false, message: 'Nenhuma nota para exportar' };
  }
  const repIds = [...new Set(cobrancasFiltradas.map(c => c.representante_id).filter(Boolean))];
  const { data: profs } = await supabase.from('profiles').select('id, email').in('id', repIds);
  const emailById = new Map<string, string>();
  (profs || []).forEach((p: any) => { if (p.email) emailById.set(p.id, p.email); });

  const rows = cobrancasFiltradas.map((c: any) => {
    const isParcial = c.status === 'parcial' || c.tipo === 'repasse';
    const d = c.data_agendada ? c.data_agendada.split('-') : null;
    const dataBR = d ? `${d[2]}/${d[1]}/${d[0]}` : '';
    return {
      representante_email: emailById.get(c.representante_id) ?? '',
      nome_revendedora: c.revendedora ?? '',
      codigo_nota: c.codigo_nota ?? '',
      situacao: isParcial ? 'parcial' : 'pendente',
      valor: Number(c.valor_previsto ?? 0),
      data_vencimento: dataBR,
      status_atual: c.status ?? '',
      valor_pago_acumulado: Number(c.valor_pago_acumulado ?? 0),
    };
  });

  const header = [...COLUNAS_IMPORT, 'status_atual', 'valor_pago_acumulado'];
  const ws = XLSX.utils.json_to_sheet(rows, { header });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Notas');
  const hoje = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `agenda_notas_export_${hoje}.xlsx`);
  return { ok: true, count: rows.length };
}

export function baixarModeloNotas() {
  const exemplo = [{
    representante_email: 'rep@taliare.com.br',
    nome_revendedora: 'MARIA DA SILVA',
    codigo_nota: 'NF-0001',
    situacao: 'pendente',
    valor: 1500,
    data_vencimento: '15/07/2026',
  }];
  const ws = XLSX.utils.json_to_sheet(exemplo, { header: [...COLUNAS_IMPORT] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Notas');
  XLSX.writeFile(wb, 'modelo_importacao_notas.xlsx');
}
