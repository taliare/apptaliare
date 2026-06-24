import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const COLUNAS = [
  'nome','representante_email','cpf','whatsapp','data_nascimento','email',
  'cep','logradouro','numero','complemento','bairro','cidade','estado','observacoes'
] as const;

type Status = 'nova' | 'atualizar' | 'erro';

interface LinhaProcessada {
  linha: number;
  nome: string;
  representante_email: string;
  representante_id?: string;
  existente_id?: string;
  cpf?: string;
  whatsapp?: string;
  data_nascimento?: string | null;
  email?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  observacoes?: string;
  status: Status;
  erro?: string;
}

function parseDataNasc(v: any): string | null | 'invalid' {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return 'invalid';
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (s.includes('/')) {
      const [dia, mes, ano] = s.split('/');
      if (dia && mes && ano) return `${ano}-${mes.padStart(2,'0')}-${dia.padStart(2,'0')}`;
    }
  }
  return 'invalid';
}

const norm = (s: string) => (s || '').trim().toUpperCase();
const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportExportRevendedorasDialog({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [linhas, setLinhas] = useState<LinhaProcessada[]>([]);

  const reset = () => { setFile(null); setLinhas([]); };
  const handleClose = () => { reset(); onClose(); };

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.xlsx')) {
      toast.error('Selecione um arquivo .xlsx');
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
        toast.error('Planilha vazia');
        setProcessando(false);
        return;
      }

      // Buscar todos representantes
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'representante');
      const repIds = (roles || []).map(r => r.user_id);
      const { data: profs } = await supabase.from('profiles').select('id, email').in('id', repIds);
      const emailMap = new Map<string, string>();
      (profs || []).forEach(p => { if (p.email) emailMap.set(p.email.toLowerCase().trim(), p.id); });

      // Pré-processar
      const pre: LinhaProcessada[] = rows.map((row, i) => {
        const linha = i + 2;
        const nome = String(row.nome ?? '').trim();
        const rep_email = String(row.representante_email ?? '').toLowerCase().trim();
        const base: LinhaProcessada = {
          linha, nome, representante_email: rep_email, status: 'valida',
        };
        if (!nome) return { ...base, status: 'erro', erro: 'Nome obrigatório' };
        if (!rep_email) return { ...base, status: 'erro', erro: 'representante_email obrigatório' };
        const rep_id = emailMap.get(rep_email);
        if (!rep_id) return { ...base, status: 'erro', erro: 'Representante não encontrado' };

        const dn = parseDataNasc(row.data_nascimento);
        if (dn === 'invalid') return { ...base, status: 'erro', erro: 'data_nascimento inválida (use DD/MM/AAAA)' };

        return {
          ...base,
          representante_id: rep_id,
          cpf: onlyDigits(String(row.cpf ?? '')) || undefined,
          whatsapp: onlyDigits(String(row.whatsapp ?? '')) || undefined,
          data_nascimento: dn,
          email: String(row.email ?? '').trim() || undefined,
          cep: onlyDigits(String(row.cep ?? '')) || undefined,
          logradouro: String(row.logradouro ?? '').trim() || undefined,
          numero: String(row.numero ?? '').trim() || undefined,
          complemento: String(row.complemento ?? '').trim() || undefined,
          bairro: String(row.bairro ?? '').trim() || undefined,
          cidade: String(row.cidade ?? '').trim() || undefined,
          estado: String(row.estado ?? '').trim() || undefined,
          observacoes: String(row.observacoes ?? '').trim() || undefined,
          status: 'valida',
        };
      });

      // Deduplicação: buscar existentes
      const cpfs = [...new Set(pre.filter(p => p.cpf).map(p => p.cpf!))];
      const repIdsUsados = [...new Set(pre.filter(p => p.representante_id).map(p => p.representante_id!))];

      const existCpf = new Set<string>();
      const existNomeRep = new Set<string>(); // `${nome_norm}::${rep_id}`

      if (cpfs.length > 0) {
        const { data } = await supabase.from('revendedoras').select('cpf').in('cpf', cpfs);
        (data || []).forEach((r: any) => { if (r.cpf) existCpf.add(r.cpf); });
      }
      if (repIdsUsados.length > 0) {
        const { data } = await supabase.from('revendedoras').select('nome, representante_id').in('representante_id', repIdsUsados);
        (data || []).forEach((r: any) => existNomeRep.add(`${norm(r.nome)}::${r.representante_id}`));
      }

      const final = pre.map(p => {
        if (p.status === 'erro') return p;
        if (p.cpf && existCpf.has(p.cpf)) return { ...p, status: 'existe' as Status, erro: 'CPF já cadastrado' };
        if (existNomeRep.has(`${norm(p.nome)}::${p.representante_id}`))
          return { ...p, status: 'existe' as Status, erro: 'Já cadastrada para este representante' };
        return p;
      });

      setLinhas(final);
      toast.success(`Processadas ${final.length} linha(s)`);
    } catch (e: any) {
      toast.error('Erro ao processar: ' + e.message);
    } finally {
      setProcessando(false);
    }
  };

  const importar = async () => {
    const validas = linhas.filter(l => l.status === 'valida');
    if (validas.length === 0) {
      toast.error('Nenhuma linha válida para importar');
      return;
    }
    setImportando(true);
    let inseridas = 0;
    const erros: string[] = [];

    for (const l of validas) {
      const { error } = await supabase.from('revendedoras').insert({
        representante_id: l.representante_id!,
        nome: l.nome,
        cpf: l.cpf ?? null,
        whatsapp: l.whatsapp ?? null,
        data_nascimento: l.data_nascimento ?? null,
        email: l.email ?? null,
        cep: l.cep ?? null,
        logradouro: l.logradouro ?? null,
        numero: l.numero ?? null,
        complemento: l.complemento ?? null,
        bairro: l.bairro ?? null,
        cidade: l.cidade ?? null,
        estado: l.estado ?? null,
        observacoes: l.observacoes ?? null,
        ativo: true,
      });
      if (error) erros.push(`Linha ${l.linha} (${l.nome}): ${error.message}`);
      else inseridas++;
    }

    const jaExistiam = linhas.filter(l => l.status === 'existe').length;
    const errosPre = linhas.filter(l => l.status === 'erro').length;

    toast.success(
      `${inseridas} inserida(s) · ${jaExistiam} já existiam · ${errosPre + erros.length} erro(s)`
    );
    if (erros.length) console.error('Erros importação:', erros);
    qc.invalidateQueries({ queryKey: ['revendedoras-admin'] });
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
          <DialogTitle>Importar Revendedoras (Excel)</DialogTitle>
          <DialogDescription>
            Colunas: {COLUNAS.join(', ')}. Use "Baixar modelo" para o template.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Arquivo .xlsx</Label>
            <div className="flex gap-2">
              <Input
                id="file"
                type="file"
                accept=".xlsx"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <Button onClick={processar} disabled={!file || processando}>
                {processando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Validar'}
              </Button>
            </div>
          </div>

          {linhas.length > 0 && (
            <>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="default">{cValidas} válidas</Badge>
                <Badge variant="secondary">{cExiste} já existem</Badge>
                <Badge variant="destructive">{cErro} erros</Badge>
              </div>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Linha</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Representante</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.slice(0, 200).map((l) => (
                      <TableRow key={l.linha}>
                        <TableCell>{l.linha}</TableCell>
                        <TableCell>{l.nome}</TableCell>
                        <TableCell className="text-xs">{l.representante_email}</TableCell>
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
                  <p className="p-2 text-xs text-muted-foreground">
                    Mostrando 200 de {linhas.length} linhas.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={importar} disabled={importando || cValidas === 0}>
            {importando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Importar {cValidas} válida(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export async function exportarRevendedorasXlsx(representanteFiltro: string) {
  let q = supabase.from('revendedoras').select('*').order('nome');
  if (representanteFiltro !== 'todos') q = q.eq('representante_id', representanteFiltro);
  const { data, error } = await q;
  if (error) { toast.error('Erro ao exportar: ' + error.message); return; }

  const repIds = [...new Set((data || []).map((r: any) => r.representante_id).filter(Boolean))];
  const { data: profs } = await supabase.from('profiles').select('id, email').in('id', repIds);
  const emailMap = new Map<string, string>();
  (profs || []).forEach((p: any) => { if (p.email) emailMap.set(p.id, p.email); });

  const rows = (data || []).map((r: any) => ({
    nome: r.nome ?? '',
    representante_email: r.representante_id ? emailMap.get(r.representante_id) ?? '' : '',
    cpf: r.cpf ?? '',
    whatsapp: r.whatsapp ?? '',
    data_nascimento: r.data_nascimento ?? '',
    email: r.email ?? '',
    cep: r.cep ?? '',
    logradouro: r.logradouro ?? '',
    numero: r.numero ?? '',
    complemento: r.complemento ?? '',
    bairro: r.bairro ?? '',
    cidade: r.cidade ?? '',
    estado: r.estado ?? '',
    observacoes: r.observacoes ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows, { header: [...COLUNAS] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Revendedoras');
  const hoje = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `revendedoras_export_${hoje}.xlsx`);
  toast.success(`Exportadas ${rows.length} revendedora(s)`);
}

export function baixarModeloRevendedoras() {
  const exemplo = [{
    nome: 'MARIA DA SILVA',
    representante_email: 'rep@taliare.com.br',
    cpf: '00000000000',
    whatsapp: '11999999999',
    data_nascimento: '15/03/1985',
    email: 'maria@exemplo.com',
    cep: '01001000',
    logradouro: 'Rua Exemplo',
    numero: '123',
    complemento: 'Apto 4',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    observacoes: 'Cliente preferencial',
  }];
  const ws = XLSX.utils.json_to_sheet(exemplo, { header: [...COLUNAS] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Revendedoras');
  XLSX.writeFile(wb, 'modelo_importacao_revendedoras.xlsx');
  toast.success('Modelo baixado');
}
