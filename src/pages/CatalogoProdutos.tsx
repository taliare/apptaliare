import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  Plus, Upload, Pencil, Search, Package, Image as ImageIcon, Loader2,
  Camera, X, Boxes, Clock, Handshake, CheckCircle2, Ban, AlertTriangle,
} from "lucide-react";

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
  fotos_adicionais: string[] | null;
  ativo: boolean;
  // fornecedor
  fornecedor: string | null;
  codigo_barras_fornecedor: string | null;
  // NF-e
  numero_ncm: string | null;
  numero_ean: string | null;
  cfop: string | null;
  fcp_percentual: number | null;
  imposto: string | null;
  observacao: string | null;
  // estoque
  qtd_estoque: number | null;
  qtd_pendente: number | null;
  qtd_consignado: number | null;
  qtd_vendido: number | null;
  qtd_cancelado: number | null;
  qtd_perdido: number | null;
  estoque_minimo: number | null;
  estoque_maximo: number | null;
  localizacao: string | null;
  // valores
  custo_compra_bruto: number | null;
  custo_insumos: number | null;
  banho_ouro: number | null;
  banho_prata: number | null;
  banho_rodio: number | null;
  banho_verniz: number | null;
  lucro_varejo_percentual: number | null;
};

type ProdutoForm = {
  id?: string;
  codigo_barras: string;
  referencia: string;
  descricao: string;
  categoria: string;
  subcategoria: string;
  cor: string;
  tamanho: string;
  precoStr: string;
  precoCustoStr: string;
  foto_url: string;
  fotos_adicionais: string[];
  ativo: boolean;
  fornecedor: string;
  codigo_barras_fornecedor: string;
  numero_ncm: string;
  numero_ean: string;
  cfop: string;
  fcp_percentual: string;
  imposto: string;
  observacao: string;
  qtd_estoque: string;
  qtd_pendente: string;
  qtd_consignado: string;
  qtd_vendido: string;
  qtd_cancelado: string;
  qtd_perdido: string;
  estoque_minimo: string;
  estoque_maximo: string;
  localizacao: string;
  custoDetalhado: boolean;
  custo_compra_bruto: string;
  custo_insumos: string;
  banho_ouro: string;
  banho_prata: string;
  banho_rodio: string;
  banho_verniz: string;
  lucro_varejo_percentual: string;
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
  fotos_adicionais: [],
  ativo: true,
  fornecedor: "",
  codigo_barras_fornecedor: "",
  numero_ncm: "",
  numero_ean: "",
  cfop: "",
  fcp_percentual: "",
  imposto: "",
  observacao: "",
  qtd_estoque: "0",
  qtd_pendente: "0",
  qtd_consignado: "0",
  qtd_vendido: "0",
  qtd_cancelado: "0",
  qtd_perdido: "0",
  estoque_minimo: "0",
  estoque_maximo: "0",
  localizacao: "",
  custoDetalhado: false,
  custo_compra_bruto: "",
  custo_insumos: "",
  banho_ouro: "",
  banho_prata: "",
  banho_rodio: "",
  banho_verniz: "",
  lucro_varejo_percentual: "",
};

const formatBRL = (n: number) =>
  n ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

export default function CatalogoProdutos() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState<string>("__all__");
  const [page, setPage] = useState(1);

  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<ProdutoForm>(emptyForm);
  const [activeTab, setActiveTab] = useState("dados");
  const [editEstoque, setEditEstoque] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingExtras, setUploadingExtras] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const extrasInputRef = useRef<HTMLInputElement>(null);

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

  // ==== Cálculo de custo detalhado ====
  const custoDetalhadoTotal = useMemo(() => {
    if (!form.custoDetalhado) return parseInputMoeda(form.precoCustoStr);
    return (
      parseInputMoeda(form.custo_compra_bruto) +
      parseInputMoeda(form.custo_insumos) +
      parseInputMoeda(form.banho_ouro) +
      parseInputMoeda(form.banho_prata) +
      parseInputMoeda(form.banho_rodio) +
      parseInputMoeda(form.banho_verniz)
    );
  }, [form.custoDetalhado, form.precoCustoStr, form.custo_compra_bruto, form.custo_insumos, form.banho_ouro, form.banho_prata, form.banho_rodio, form.banho_verniz]);

  // Quando custo detalhado muda, atualiza precoCustoStr
  useEffect(() => {
    if (form.custoDetalhado) {
      const novo = formatBRL(custoDetalhadoTotal);
      if (novo !== form.precoCustoStr) {
        setForm((p) => ({ ...p, precoCustoStr: novo }));
      }
    }
  }, [custoDetalhadoTotal, form.custoDetalhado]);

  const saveMutation = useMutation({
    mutationFn: async (f: ProdutoForm) => {
      const numOrNull = (s: string) => {
        const v = parseInputMoeda(s);
        return Number.isFinite(v) ? v : 0;
      };
      const intOrZero = (s: string) => {
        const n = parseInt(s.replace(/\D/g, "") || "0", 10);
        return Number.isFinite(n) ? n : 0;
      };
      const payload: any = {
        codigo_barras: f.codigo_barras.trim(),
        referencia: f.referencia?.trim() || null,
        descricao: f.descricao.trim(),
        categoria: f.categoria?.trim() || null,
        subcategoria: f.subcategoria?.trim() || null,
        cor: f.cor?.trim() || null,
        tamanho: f.tamanho?.trim() || null,
        preco_varejo: numOrNull(f.precoStr),
        preco_custo: numOrNull(f.precoCustoStr),
        foto_url: f.foto_url || null,
        fotos_adicionais: f.fotos_adicionais ?? [],
        ativo: f.ativo,
        fornecedor: f.fornecedor?.trim() || null,
        codigo_barras_fornecedor: f.codigo_barras_fornecedor?.trim() || null,
        numero_ncm: f.numero_ncm?.trim() || null,
        numero_ean: f.numero_ean?.trim() || null,
        cfop: f.cfop?.trim() || null,
        fcp_percentual: numOrNull(f.fcp_percentual),
        imposto: f.imposto?.trim() || null,
        observacao: f.observacao?.trim() || null,
        qtd_estoque: intOrZero(f.qtd_estoque),
        qtd_pendente: intOrZero(f.qtd_pendente),
        qtd_consignado: intOrZero(f.qtd_consignado),
        qtd_vendido: intOrZero(f.qtd_vendido),
        qtd_cancelado: intOrZero(f.qtd_cancelado),
        qtd_perdido: intOrZero(f.qtd_perdido),
        estoque_minimo: intOrZero(f.estoque_minimo),
        estoque_maximo: intOrZero(f.estoque_maximo),
        localizacao: f.localizacao?.trim() || null,
        custo_compra_bruto: numOrNull(f.custo_compra_bruto),
        custo_insumos: numOrNull(f.custo_insumos),
        banho_ouro: numOrNull(f.banho_ouro),
        banho_prata: numOrNull(f.banho_prata),
        banho_rodio: numOrNull(f.banho_rodio),
        banho_verniz: numOrNull(f.banho_verniz),
        lucro_varejo_percentual: numOrNull(f.lucro_varejo_percentual),
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
    setActiveTab("dados");
    setEditEstoque(false);
    setOpenForm(true);
  };

  const openEdit = (p: Produto) => {
    const detalhes =
      (p.custo_compra_bruto || 0) +
      (p.custo_insumos || 0) +
      (p.banho_ouro || 0) +
      (p.banho_prata || 0) +
      (p.banho_rodio || 0) +
      (p.banho_verniz || 0);
    setForm({
      id: p.id,
      codigo_barras: p.codigo_barras,
      referencia: p.referencia ?? "",
      descricao: p.descricao,
      categoria: p.categoria ?? "",
      subcategoria: p.subcategoria ?? "",
      cor: p.cor ?? "",
      tamanho: p.tamanho ?? "",
      precoStr: formatBRL(p.preco_varejo),
      precoCustoStr: formatBRL(p.preco_custo),
      foto_url: p.foto_url ?? "",
      fotos_adicionais: Array.isArray(p.fotos_adicionais) ? p.fotos_adicionais : [],
      ativo: p.ativo,
      fornecedor: p.fornecedor ?? "",
      codigo_barras_fornecedor: p.codigo_barras_fornecedor ?? "",
      numero_ncm: p.numero_ncm ?? "",
      numero_ean: p.numero_ean ?? "",
      cfop: p.cfop ?? "",
      fcp_percentual: p.fcp_percentual ? formatBRL(p.fcp_percentual) : "",
      imposto: p.imposto ?? "",
      observacao: p.observacao ?? "",
      qtd_estoque: String(p.qtd_estoque ?? 0),
      qtd_pendente: String(p.qtd_pendente ?? 0),
      qtd_consignado: String(p.qtd_consignado ?? 0),
      qtd_vendido: String(p.qtd_vendido ?? 0),
      qtd_cancelado: String(p.qtd_cancelado ?? 0),
      qtd_perdido: String(p.qtd_perdido ?? 0),
      estoque_minimo: String(p.estoque_minimo ?? 0),
      estoque_maximo: String(p.estoque_maximo ?? 0),
      localizacao: p.localizacao ?? "",
      custoDetalhado: detalhes > 0,
      custo_compra_bruto: p.custo_compra_bruto ? formatBRL(p.custo_compra_bruto) : "",
      custo_insumos: p.custo_insumos ? formatBRL(p.custo_insumos) : "",
      banho_ouro: p.banho_ouro ? formatBRL(p.banho_ouro) : "",
      banho_prata: p.banho_prata ? formatBRL(p.banho_prata) : "",
      banho_rodio: p.banho_rodio ? formatBRL(p.banho_rodio) : "",
      banho_verniz: p.banho_verniz ? formatBRL(p.banho_verniz) : "",
      lucro_varejo_percentual: p.lucro_varejo_percentual ? formatBRL(p.lucro_varejo_percentual) : "",
    });
    setActiveTab("dados");
    setEditEstoque(false);
    setOpenForm(true);
  };

  const uploadOne = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${form.id || form.codigo_barras || crypto.randomUUID()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("produtos-fotos")
      .upload(fileName, file, { upsert: true, contentType: file.type });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("produtos-fotos").getPublicUrl(fileName);
    return pub.publicUrl;
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadOne(file);
      setForm((prev) => ({ ...prev, foto_url: url }));
      toast({ title: "Foto enviada" });
    } catch (e: any) {
      toast({ title: "Erro ao enviar foto", description: e.message, variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleExtrasUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingExtras(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await uploadOne(f));
      setForm((prev) => ({ ...prev, fotos_adicionais: [...(prev.fotos_adicionais ?? []), ...urls] }));
      toast({ title: `${urls.length} foto(s) adicionada(s)` });
    } catch (e: any) {
      toast({ title: "Erro ao enviar fotos", description: e.message, variant: "destructive" });
    } finally {
      setUploadingExtras(false);
      if (extrasInputRef.current) extrasInputRef.current.value = "";
    }
  };

  const removeExtraPhoto = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      fotos_adicionais: (prev.fotos_adicionais ?? []).filter((_, i) => i !== idx),
    }));
  };

  // Recalcular preço a partir do lucro
  const handleLucroChange = (val: string) => {
    const masked = formatarInputMoeda(val);
    const lucro = parseInputMoeda(masked);
    const custo = parseInputMoeda(form.precoCustoStr);
    let novoVarejo = form.precoStr;
    if (custo > 0 && lucro > 0 && lucro < 100) {
      const v = custo / (1 - lucro / 100);
      novoVarejo = formatBRL(v);
    }
    setForm({ ...form, lucro_varejo_percentual: masked, precoStr: novoVarejo });
  };

  // Recalcular lucro a partir do preço
  const handleVarejoChange = (val: string) => {
    const masked = formatarInputMoeda(val);
    const varejo = parseInputMoeda(masked);
    const custo = parseInputMoeda(form.precoCustoStr);
    let novoLucro = form.lucro_varejo_percentual;
    if (custo > 0 && varejo > 0 && varejo > custo) {
      const l = ((varejo - custo) / varejo) * 100;
      novoLucro = formatBRL(l);
    }
    setForm({ ...form, precoStr: masked, lucro_varejo_percentual: novoLucro });
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

  const estoqueCards: { key: keyof ProdutoForm; label: string; icon: any; editable?: boolean }[] = [
    { key: "qtd_estoque", label: "Estoque", icon: Boxes, editable: true },
    { key: "qtd_pendente", label: "Pendente", icon: Clock },
    { key: "qtd_consignado", label: "Consignado", icon: Handshake },
    { key: "qtd_vendido", label: "Vendido", icon: CheckCircle2 },
    { key: "qtd_cancelado", label: "Cancelado", icon: Ban },
    { key: "qtd_perdido", label: "Perdido", icon: AlertTriangle },
  ];

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
                <TableHead className="w-16">Foto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : pageItems.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Nenhum produto encontrado</TableCell></TableRow>
              ) : pageItems.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.foto_url ? (
                      <img src={p.foto_url} alt={p.descricao} className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.codigo_barras}</TableCell>
                  <TableCell>{p.referencia || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{p.descricao}</TableCell>
                  <TableCell>{p.categoria || "—"}</TableCell>
                  <TableCell>{p.cor || "—"}</TableCell>
                  <TableCell>{p.tamanho || "—"}</TableCell>
                  <TableCell className="text-right">{formatarValor(p.preco_varejo)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatarValor(p.preco_custo ?? 0)}</TableCell>
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
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="estoque">Estoque</TabsTrigger>
              <TabsTrigger value="valores">Valores</TabsTrigger>
            </TabsList>

            {/* ========= ABA DADOS ========= */}
            <TabsContent value="dados" className="overflow-y-auto py-2 mt-2">
              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
                {/* Coluna Fotos */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Foto de Capa</Label>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="relative h-[200px] w-[200px] rounded-lg border-2 border-dashed border-border bg-muted/40 flex items-center justify-center overflow-hidden group hover:border-primary transition-colors"
                    >
                      {form.foto_url ? (
                        <img src={form.foto_url} alt="Capa" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Camera className="h-10 w-10" />
                          <span className="text-xs">Clique para enviar</span>
                        </div>
                      )}
                      {uploadingPhoto && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      )}
                    </button>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }}
                    />
                    {form.foto_url && (
                      <Button
                        type="button" variant="ghost" size="sm" className="mt-1 w-[200px]"
                        onClick={() => setForm({ ...form, foto_url: "" })}
                      >Remover capa</Button>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Fotos Adicionais</Label>
                    <div className="grid grid-cols-3 gap-2 w-[200px]">
                      {(form.fotos_adicionais ?? []).map((url, i) => (
                        <div key={i} className="relative h-16 w-16 rounded border overflow-hidden group">
                          <img src={url} alt={`extra-${i}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeExtraPhoto(i)}
                            className="absolute top-0 right-0 bg-background/80 rounded-bl p-0.5 opacity-0 group-hover:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => extrasInputRef.current?.click()}
                        className="h-16 w-16 rounded border border-dashed flex items-center justify-center hover:border-primary"
                      >
                        {uploadingExtras ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </button>
                    </div>
                    <input
                      ref={extrasInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleExtrasUpload(e.target.files)}
                    />
                  </div>
                </div>

                {/* Coluna Dados */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Descrição *</Label>
                    <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Código de Barras *</Label>
                      <Input value={form.codigo_barras} onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Referência</Label>
                      <Input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Categoria *</Label>
                      <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Subcategoria</Label>
                      <Input value={form.subcategoria} onChange={(e) => setForm({ ...form, subcategoria: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Tamanho</Label>
                      <Input value={form.tamanho} onChange={(e) => setForm({ ...form, tamanho: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Cor</Label>
                      <Input value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} />
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <h4 className="text-sm font-semibold mb-2">Fornecedor</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Fornecedor</Label>
                        <Input value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label>Cód. Barras Fornecedor</Label>
                        <Input value={form.codigo_barras_fornecedor} onChange={(e) => setForm({ ...form, codigo_barras_fornecedor: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <h4 className="text-sm font-semibold mb-2">Dados para NF-e</h4>
                    <div className="grid grid-cols-5 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">NCM</Label>
                        <Input value={form.numero_ncm} onChange={(e) => setForm({ ...form, numero_ncm: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">EAN</Label>
                        <Input value={form.numero_ean} onChange={(e) => setForm({ ...form, numero_ean: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">CFOP</Label>
                        <Input value={form.cfop} onChange={(e) => setForm({ ...form, cfop: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">FCP %</Label>
                        <Input
                          value={form.fcp_percentual}
                          onChange={(e) => setForm({ ...form, fcp_percentual: formatarInputMoeda(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Imposto</Label>
                        <Input value={form.imposto} onChange={(e) => setForm({ ...form, imposto: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-3 space-y-3">
                    <h4 className="text-sm font-semibold">Outros</h4>
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select value={form.ativo ? "ativo" : "inativo"} onValueChange={(v) => setForm({ ...form, ativo: v === "ativo" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="inativo">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Observação</Label>
                      <Textarea
                        value={form.observacao}
                        onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ========= ABA ESTOQUE ========= */}
            <TabsContent value="estoque" className="overflow-y-auto py-2 mt-2 space-y-4">
              <h3 className="text-sm font-semibold">Quantidades do Produto</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {estoqueCards.map(({ key, label, icon: Icon, editable }) => (
                  <Card key={key as string} className="p-4 flex flex-col items-center text-center gap-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Icon className="h-4 w-4" />
                      <span className="text-xs">{label}</span>
                      {editable && (
                        <button
                          type="button"
                          onClick={() => setEditEstoque((v) => !v)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    {editable && editEstoque ? (
                      <Input
                        className="text-center text-xl font-bold w-24"
                        value={form[key] as string}
                        onChange={(e) =>
                          setForm({ ...form, [key]: e.target.value.replace(/\D/g, "") } as ProdutoForm)
                        }
                      />
                    ) : (
                      <div className="text-2xl font-bold">{form[key] as string || "0"}</div>
                    )}
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 border-t pt-4">
                <div className="space-y-1">
                  <Label>Estoque Mínimo</Label>
                  <Input
                    value={form.estoque_minimo}
                    onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value.replace(/\D/g, "") })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Estoque Máximo</Label>
                  <Input
                    value={form.estoque_maximo}
                    onChange={(e) => setForm({ ...form, estoque_maximo: e.target.value.replace(/\D/g, "") })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Localização</Label>
                  <Input value={form.localizacao} onChange={(e) => setForm({ ...form, localizacao: e.target.value })} />
                </div>
              </div>
            </TabsContent>

            {/* ========= ABA VALORES ========= */}
            <TabsContent value="valores" className="overflow-y-auto py-2 mt-2 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Custos</h3>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.custoDetalhado}
                      onCheckedChange={(v) => setForm({ ...form, custoDetalhado: v })}
                    />
                    <Label className="text-xs">Ativar cálculo detalhado</Label>
                  </div>
                </div>

                {form.custoDetalhado ? (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { k: "custo_compra_bruto", l: "Custo de Compra Bruto" },
                        { k: "custo_insumos", l: "Custo de Insumos" },
                        { k: "banho_ouro", l: "Banho de Ouro" },
                        { k: "banho_prata", l: "Banho de Prata" },
                        { k: "banho_rodio", l: "Banho de Ródio" },
                        { k: "banho_verniz", l: "Banho de Verniz" },
                      ].map(({ k, l }) => (
                        <div key={k} className="space-y-1">
                          <Label className="text-xs">{l}</Label>
                          <Input
                            value={form[k as keyof ProdutoForm] as string}
                            onChange={(e) =>
                              setForm({ ...form, [k]: formatarInputMoeda(e.target.value) } as ProdutoForm)
                            }
                            placeholder="0,00"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <Label>Bruto + Insumos + Banho (Custo total)</Label>
                      <Input value={formatBRL(custoDetalhadoTotal)} readOnly className="bg-muted font-semibold" />
                    </div>
                  </>
                ) : (
                  <div className="space-y-1">
                    <Label>Preço de Custo</Label>
                    <Input
                      value={form.precoCustoStr}
                      onChange={(e) => setForm({ ...form, precoCustoStr: formatarInputMoeda(e.target.value) })}
                      placeholder="0,00"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold">Preços</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Lucro Varejo %</Label>
                    <Input
                      value={form.lucro_varejo_percentual}
                      onChange={(e) => handleLucroChange(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Valor Varejo *</Label>
                    <Input
                      value={form.precoStr}
                      onChange={(e) => handleVarejoChange(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

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
