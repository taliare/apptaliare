import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatarValor, formatarInputMoeda, parseInputMoeda } from "@/lib/utils";
import { Plus, Upload, Pencil, Search, Package, Image as ImageIcon, Loader2 } from "lucide-react";

type Produto = {
  id: string;
  codigo_barras: string;
  referencia: string | null;
  descricao: string;
  categoria: string | null;
  subcategoria: string | null;
  cor: string | null;
  tamanho: string | null;
  preco_varejo: number;
  preco_custo: number;
  foto_url: string | null;
  ativo: boolean;
};

type ProdutoForm = Omit<Produto, "id" | "preco_varejo" | "preco_custo"> & {
  id?: string;
  precoStr: string;
  precoCustoStr: string;
};

const PAGE_SIZE = 20;

const emptyForm: ProdutoForm = {
  codigo_barras: "",
  referencia: "",
  descricao: "",
  categoria: "",
  subcategoria: "",
  cor: "",
  tamanho: "",
  precoStr: "",
  precoCustoStr: "",
  foto_url: "",
  ativo: true,
};

export default function CatalogoProdutos() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState<string>("__all__");
  const [page, setPage] = useState(1);

  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<ProdutoForm>(emptyForm);

  const [openImport, setOpenImport] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; err: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManage = profile?.role === "admin" || profile?.role === "producao";

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos_catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos_catalogo" as any)
        .select("*")
        .order("descricao", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as Produto[];
    },
  });

  const categoriasUnicas = useMemo(() => {
    const set = new Set<string>();
    produtos.forEach((p) => p.categoria && set.add(p.categoria));
    return Array.from(set).sort();
  }, [produtos]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return produtos.filter((p) => {
      if (categoria !== "__all__" && p.categoria !== categoria) return false;
      if (!s) return true;
      return (
        p.codigo_barras.toLowerCase().includes(s) ||
        (p.referencia ?? "").toLowerCase().includes(s) ||
        p.descricao.toLowerCase().includes(s)
      );
    });
  }, [produtos, search, categoria]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const saveMutation = useMutation({
    mutationFn: async (f: ProdutoForm) => {
      const payload = {
        codigo_barras: f.codigo_barras.trim(),
        referencia: f.referencia?.trim() || null,
        descricao: f.descricao.trim(),
        categoria: f.categoria?.trim() || null,
        subcategoria: f.subcategoria?.trim() || null,
        cor: f.cor?.trim() || null,
        tamanho: f.tamanho?.trim() || null,
        preco_varejo: parseInputMoeda(f.precoStr),
        ativo: f.ativo,
        atualizado_em: new Date().toISOString(),
      };
      if (!payload.codigo_barras) throw new Error("Código de barras é obrigatório");
      if (!payload.descricao) throw new Error("Descrição é obrigatória");

      if (f.id) {
        const { error } = await supabase.from("produtos_catalogo" as any).update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produtos_catalogo" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Produto salvo com sucesso" });
      qc.invalidateQueries({ queryKey: ["produtos_catalogo"] });
      setOpenForm(false);
      setForm(emptyForm);
    },
    onError: (e: any) => {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    },
  });

  const openNew = () => {
    setForm(emptyForm);
    setOpenForm(true);
  };

  const openEdit = (p: Produto) => {
    setForm({
      id: p.id,
      codigo_barras: p.codigo_barras,
      referencia: p.referencia ?? "",
      descricao: p.descricao,
      categoria: p.categoria ?? "",
      subcategoria: p.subcategoria ?? "",
      cor: p.cor ?? "",
      tamanho: p.tamanho ?? "",
      precoStr: p.preco_varejo
        ? p.preco_varejo.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "",
      foto_url: p.foto_url ?? "",
      ativo: p.ativo,
    });
    setOpenForm(true);
  };

  // CSV parser (separator ;, supports quoted fields)
  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    for (const line of lines) {
      const out: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQuotes) {
          if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (c === '"') inQuotes = false;
          else cur += c;
        } else {
          if (c === '"') inQuotes = true;
          else if (c === ";") { out.push(cur); cur = ""; }
          else cur += c;
        }
      }
      out.push(cur);
      rows.push(out.map((s) => s.trim()));
    }
    return rows;
  };

  const handleFileChange = async (file: File | null) => {
    setCsvFile(file);
    setCsvPreview(null);
    setImportResult(null);
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    setCsvPreview(rows.slice(0, 2));
  };

  const handleImport = async () => {
    if (!csvFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await csvFile.text();
      const rows = parseCSV(text);
      if (rows.length < 2) throw new Error("CSV vazio ou só com cabeçalho");
      const header = rows[0].map((h) => h.toLowerCase().trim());
      const idx = (name: string) => header.indexOf(name);
      const iCB = idx("codigo_barras");
      const iRef = idx("referencia");
      const iDesc = idx("descricao");
      const iCat = idx("categoria");
      const iSub = idx("subcategoria");
      const iCor = idx("cor");
      const iTam = idx("tamanho");
      const iPre = idx("preco_varejo");

      if (iCB === -1 || iDesc === -1) {
        throw new Error("CSV deve conter ao menos as colunas: codigo_barras, descricao");
      }

      const errors: string[] = [];
      const payloads: any[] = [];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const cb = (row[iCB] ?? "").trim();
        const desc = (row[iDesc] ?? "").trim();
        if (!cb || !desc) {
          errors.push(`Linha ${r + 1}: codigo_barras e descricao são obrigatórios`);
          continue;
        }
        const precoStr = (iPre >= 0 ? row[iPre] : "0") ?? "0";
        const preco = parseFloat(precoStr.replace(/\./g, "").replace(",", ".")) || 0;
        payloads.push({
          codigo_barras: cb,
          referencia: iRef >= 0 ? (row[iRef] || null) : null,
          descricao: desc,
          categoria: iCat >= 0 ? (row[iCat] || null) : null,
          subcategoria: iSub >= 0 ? (row[iSub] || null) : null,
          cor: iCor >= 0 ? (row[iCor] || null) : null,
          tamanho: iTam >= 0 ? (row[iTam] || null) : null,
          preco_varejo: preco,
          atualizado_em: new Date().toISOString(),
        });
      }

      let okCount = 0;
      // upsert in batches of 200
      for (let i = 0; i < payloads.length; i += 200) {
        const batch = payloads.slice(i, i + 200);
        const { error } = await supabase
          .from("produtos_catalogo" as any)
          .upsert(batch, { onConflict: "codigo_barras" });
        if (error) {
          errors.push(`Lote ${i / 200 + 1}: ${error.message}`);
        } else {
          okCount += batch.length;
        }
      }

      setImportResult({ ok: okCount, err: errors.length, errors: errors.slice(0, 10) });
      qc.invalidateQueries({ queryKey: ["produtos_catalogo"] });
      toast({
        title: "Importação concluída",
        description: `${okCount} registros processados, ${errors.length} erros`,
      });
    } catch (e: any) {
      toast({ title: "Erro na importação", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Catálogo de Produtos
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastro de semi-joias individuais para montagem de kits
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpenImport(true)}>
              <Upload className="h-4 w-4 mr-2" /> Importar CSV
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" /> Novo Produto
            </Button>
          </div>
        )}
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por código, referência ou descrição..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={categoria} onValueChange={(v) => { setCategoria(v); setPage(1); }}>
            <SelectTrigger className="md:w-64">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as categorias</SelectItem>
              {categoriasUnicas.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : pageItems.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum produto encontrado</TableCell></TableRow>
              ) : pageItems.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.codigo_barras}</TableCell>
                  <TableCell>{p.referencia || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{p.descricao}</TableCell>
                  <TableCell>{p.categoria || "—"}</TableCell>
                  <TableCell>{p.cor || "—"}</TableCell>
                  <TableCell>{p.tamanho || "—"}</TableCell>
                  <TableCell className="text-right">{formatarValor(p.preco_varejo)}</TableCell>
                  <TableCell>
                    <Badge variant={p.ativo ? "default" : "secondary"}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted-foreground">
            {filtered.length} produto(s) • Página {currentPage} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      </Card>

      {/* Form Dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto py-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Código de Barras *</Label>
              <Input
                value={form.codigo_barras}
                onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })}
                placeholder="Ex: 7891234567890"
              />
            </div>
            <div className="space-y-2">
              <Label>Referência</Label>
              <Input value={form.referencia ?? ""} onChange={(e) => setForm({ ...form, referencia: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input value={form.categoria ?? ""} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição *</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Subcategoria</Label>
              <Input value={form.subcategoria ?? ""} onChange={(e) => setForm({ ...form, subcategoria: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <Input value={form.cor ?? ""} onChange={(e) => setForm({ ...form, cor: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tamanho</Label>
              <Input value={form.tamanho ?? ""} onChange={(e) => setForm({ ...form, tamanho: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Preço Varejo</Label>
              <Input
                value={form.precoStr}
                onChange={(e) => setForm({ ...form, precoStr: formatarInputMoeda(e.target.value) })}
                placeholder="0,00"
              />
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={openImport} onOpenChange={(o) => { setOpenImport(o); if (!o) { setCsvFile(null); setCsvPreview(null); setImportResult(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar Catálogo via CSV</DialogTitle>
            <DialogDescription>
              O arquivo CSV deve ter as colunas: <code>codigo_barras, referencia, descricao, categoria, subcategoria, cor, tamanho, preco_varejo</code> (separadas por <strong>ponto-e-vírgula</strong>). Registros com código de barras existente serão atualizados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto py-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            {csvPreview && csvPreview.length > 0 && (
              <div className="rounded-md border p-3 bg-muted/30 text-xs space-y-2">
                <div className="font-semibold">Pré-visualização:</div>
                <div className="overflow-x-auto">
                  <table className="text-xs">
                    <thead>
                      <tr>{csvPreview[0].map((h, i) => <th key={i} className="px-2 py-1 text-left border-b">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {csvPreview[1] && (
                        <tr>{csvPreview[1].map((c, i) => <td key={i} className="px-2 py-1 border-b">{c}</td>)}</tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {importResult && (
              <div className="rounded-md border p-3 text-sm space-y-1">
                <div><strong>{importResult.ok}</strong> registros inseridos/atualizados</div>
                <div><strong>{importResult.err}</strong> erros</div>
                {importResult.errors.length > 0 && (
                  <ul className="list-disc pl-5 text-xs text-destructive">
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenImport(false)}>Fechar</Button>
            <Button onClick={handleImport} disabled={!csvFile || importing}>
              {importing ? "Importando..." : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
