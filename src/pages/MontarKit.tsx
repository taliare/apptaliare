import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatarValor } from "@/lib/utils";
import { Plus, ScanLine, X, CheckCircle2, Package, Trash2, Image as ImageIcon } from "lucide-react";
import {
  gerarPdfDetalhado, gerarPdfResumido, downloadBlob, type ItemKit,
} from "@/lib/montarKitPdf";

type KitMontagem = {
  id: string;
  numero: string;
  descricao: string | null;
  status: string;
  finalizado_em: string | null;
  criado_em: string;
  total_pecas?: number | null;
  valor_varejo?: number | null;
  valor_custo?: number | null;
};

type KitItem = {
  id: string;
  kit_id: string;
  codigo_barras: string;
  produto_id: string | null;
  descricao_snapshot: string | null;
  categoria_snapshot: string | null;
  preco_snapshot: number;
  custo_snapshot: number;
  foto_snapshot: string | null;
  quantidade: number;
  criado_em: string;
};

export default function MontarKit() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [kitAtivoId, setKitAtivoId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [tipoKit, setTipoKit] = useState<string>("");
  const [confirmFinalizar, setConfirmFinalizar] = useState(false);
  const [confirmCancelar, setConfirmCancelar] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [acao, setAcao] = useState<"adicionar" | "remover">("adicionar");
  const [quantidade, setQuantidade] = useState<string>("1");
  const [tipoPreco, setTipoPreco] = useState<"varejo" | "custo">("varejo");
  const [ultimoBipado, setUltimoBipado] = useState<{
    referencia: string | null;
    descricao: string | null;
    quantidade: number;
    preco: number;
    foto: string | null;
  } | null>(null);

  const TIPO_LABELS: Record<string, string> = {
    inicial: "Inicial",
    especial: "Especial",
    maleta_vip: "Maleta VIP",
  };

  // Lista de kits (em_montagem ou finalizados últimos 7 dias)
  const { data: kits = [] } = useQuery({
    queryKey: ["kits_montagem_lista"],
    queryFn: async () => {
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
      const { data, error } = await supabase
        .from("kits_montagem" as any)
        .select("*")
        .or(`status.eq.em_montagem,and(status.eq.finalizado,finalizado_em.gte.${seteDiasAtras.toISOString()})`)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as KitMontagem[];
    },
  });

  const kitAtivo = useMemo(() => kits.find((k) => k.id === kitAtivoId) ?? null, [kits, kitAtivoId]);

  const proximoNumero = useMemo(() => {
    if (kits.length === 0) return 10000;
    const maxNum = Math.max(...kits.map((k) => parseInt(k.numero) || 0));
    return Math.max(maxNum, 9999) + 1;
  }, [kits]);

  const { data: itens = [], refetch: refetchItens } = useQuery({
    queryKey: ["kits_montagem_itens", kitAtivoId],
    enabled: !!kitAtivoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kits_montagem_itens" as any)
        .select("*")
        .eq("kit_id", kitAtivoId!)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as KitItem[];
    },
  });

  // Lookup de referencia/subcategoria por produto_id
  const produtoIds = useMemo(
    () => Array.from(new Set(itens.map((i) => i.produto_id).filter(Boolean) as string[])),
    [itens]
  );
  const { data: produtosMeta = [] } = useQuery({
    queryKey: ["produtos_meta", produtoIds.join(",")],
    enabled: produtoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos_catalogo" as any)
        .select("id, referencia, subcategoria")
        .in("id", produtoIds);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const metaMap = useMemo(() => {
    const m = new Map<string, { referencia: string | null; subcategoria: string | null }>();
    for (const p of produtosMeta) m.set(p.id, { referencia: p.referencia, subcategoria: p.subcategoria });
    return m;
  }, [produtosMeta]);

  // Contadores em tempo real
  const totalPecas = itens.reduce((s, i) => s + (i.quantidade || 1), 0);
  const totalValor = itens.reduce((s, i) => s + (i.preco_snapshot || 0) * (i.quantidade || 1), 0);
  const totalCusto = itens.reduce((s, i) => s + (i.custo_snapshot || 0) * (i.quantidade || 1), 0);
  const margemBruta = totalValor > 0 ? ((totalValor - totalCusto) / totalValor) * 100 : 0;

  // Resumo por categoria
  const resumoCategorias = useMemo(() => {
    const map = new Map<string, { qtd: number; varejo: number; custo: number }>();
    for (const it of itens) {
      const cat = it.categoria_snapshot || "—";
      const cur = map.get(cat) ?? { qtd: 0, varejo: 0, custo: 0 };
      cur.qtd += it.quantidade || 1;
      cur.varejo += (it.preco_snapshot || 0) * (it.quantidade || 1);
      cur.custo += (it.custo_snapshot || 0) * (it.quantidade || 1);
      map.set(cat, cur);
    }
    return Array.from(map.entries())
      .map(([categoria, v]) => ({
        categoria,
        ...v,
        margem: v.varejo > 0 ? ((v.varejo - v.custo) / v.varejo) * 100 : 0,
      }))
      .sort((a, b) => a.categoria.localeCompare(b.categoria));
  }, [itens]);

  // Auto-focus quando kit ativo muda
  useEffect(() => {
    if (kitAtivoId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [kitAtivoId]);

  const refocus = () => {
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const criarKit = useMutation({
    mutationFn: async () => {
      const { data: ultimoKit, error: ultimoErr } = await supabase
        .from("kits_montagem" as any)
        .select("numero, status")
        .order("numero", { ascending: false })
        .limit(1);
      if (ultimoErr) throw ultimoErr;
      const ultimo = (ultimoKit as any[])?.[0];
      let numero: string;
      if (ultimo && ultimo.status === "cancelado") {
        await supabase
          .from("kits_montagem" as any)
          .delete()
          .eq("numero", ultimo.numero);
        numero = ultimo.numero;
      } else {
        const ultimoNum = ultimo?.numero ? parseInt(ultimo.numero) : 9999;
        numero = String(Math.max(ultimoNum, 9999) + 1);
      }
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("kits_montagem" as any)
        .insert({
          numero,
          descricao: TIPO_LABELS[tipoKit] ?? null,
          status: "em_montagem",
          criado_por: userData.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as KitMontagem;
    },
    onSuccess: (kit) => {
      toast({ title: `Kit #${kit.numero} criado` });
      qc.invalidateQueries({ queryKey: ["kits_montagem_lista"] });
      setOpenNew(false);
      setTipoKit("");
      setKitAtivoId(kit.id);
    },
    onError: (e: any) => {
      toast({ title: "Erro ao criar kit", description: e.message, variant: "destructive" });
    },
  });

  const playBeep = useCallback((freq: number, duration: number) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
      osc.start();
      osc.stop(ctx.currentTime + duration / 1000);
    } catch {}
  }, []);

  const bipar = async () => {
    const cod = codigo.trim();
    if (!cod || !kitAtivoId || processando) {
      refocus();
      return;
    }
    setProcessando(true);
    try {
      if (acao === "remover") {
        // Buscar último item com esse código no kit
        const item = itens.find((i) => i.codigo_barras === cod);
        if (!item) {
          playBeep(300, 150);
          toast({ title: "Item não encontrado no kit", description: cod, variant: "destructive" });
          setCodigo("");
          refocus();
          return;
        }
        const { error } = await supabase.from("kits_montagem_itens" as any).delete().eq("id", item.id);
        if (error) throw error;
        playBeep(800, 80);
        toast({ title: "✓ Removido", description: item.descricao_snapshot ?? cod });
        setCodigo("");
        await refetchItens();
        return;
      }

      const { data: produto, error: pErr } = await supabase
        .from("produtos_catalogo" as any)
        .select("*")
        .eq("codigo_barras", cod)
        .eq("ativo", true)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!produto) {
        playBeep(300, 150);
        toast({ title: "Produto não encontrado", description: cod, variant: "destructive" });
        setCodigo("");
        refocus();
        return;
      }
      const p = produto as any;
      const qtd = Math.max(1, parseInt(quantidade || "1", 10) || 1);
      const precoUnit = tipoPreco === "custo" ? (p.preco_custo ?? 0) : (p.preco_varejo ?? 0);
      const { error: insErr } = await supabase.from("kits_montagem_itens" as any).insert({
        kit_id: kitAtivoId,
        codigo_barras: p.codigo_barras,
        produto_id: p.id,
        descricao_snapshot: p.descricao,
        categoria_snapshot: p.categoria,
        preco_snapshot: precoUnit,
        custo_snapshot: p.preco_custo ?? 0,
        foto_snapshot: p.foto_url ?? null,
        quantidade: qtd,
      });
      if (insErr) throw insErr;
      playBeep(800, 80);
      setUltimoBipado({
        referencia: p.referencia ?? null,
        descricao: p.descricao ?? null,
        quantidade: qtd,
        preco: precoUnit,
        foto: p.foto_url ?? null,
      });
      toast({
        title: "✓ Bipado",
        description: (
          <div className="flex items-center gap-2">
            {p.foto_url && (
              <img src={p.foto_url} alt="" className="h-8 w-8 rounded object-cover" />
            )}
            <span>{p.descricao} — {formatarValor(precoUnit)}</span>
          </div>
        ) as any,
      });
      setCodigo("");
      setQuantidade("1");
      await refetchItens();
    } catch (e: any) {
      playBeep(300, 150);
      toast({ title: "Erro ao bipar", description: e.message, variant: "destructive" });
    } finally {
      setProcessando(false);
      refocus();
    }
  };

  const atualizarQuantidade = async (id: string, novaQtd: number) => {
    const q = Math.max(1, Math.floor(novaQtd) || 1);
    const { error } = await supabase
      .from("kits_montagem_itens" as any)
      .update({ quantidade: q })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    refetchItens();
  };

  const removerItem = async (id: string) => {
    const { error } = await supabase.from("kits_montagem_itens" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    refetchItens();
    refocus();
  };

  const finalizarKit = async () => {
    if (!kitAtivo || itens.length === 0) return;
    setProcessando(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("kits_montagem" as any)
        .update({
          status: "finalizado",
          finalizado_em: nowIso,
          total_pecas: totalPecas,
          valor_varejo: totalValor,
          valor_custo: totalCusto,
        })
        .eq("id", kitAtivo.id);
      if (error) throw error;

      // Inserir kit na tabela kits_estoque
      const valorTotal = itens.reduce(
        (s, i) => s + (i.preco_snapshot || 0) * (i.quantidade || 1),
        0
      );
      const labelToTipo: Record<string, string> = {
        Inicial: "inicial",
        Especial: "especial",
        "Maleta VIP": "maleta_vip",
      };
      const tipoEstoque = labelToTipo[kitAtivo.descricao ?? ""] ?? "inicial";
      const { error: estoqueErr } = await supabase
        .from("kits_estoque" as any)
        .insert({
          codigo: kitAtivo.numero,
          tipo: tipoEstoque,
          status: "estoque",
          representante_id: null,
          valor: valorTotal,
        });
      if (estoqueErr) throw estoqueErr;

      const itensPdf: ItemKit[] = itens.map((i) => ({
        codigo_barras: i.codigo_barras,
        descricao_snapshot: i.descricao_snapshot,
        categoria_snapshot: i.categoria_snapshot,
        preco_snapshot: i.preco_snapshot,
        quantidade: i.quantidade,
      }));
      const blobDet = gerarPdfDetalhado(kitAtivo.numero, itensPdf, nowIso);
      const blobRes = gerarPdfResumido(kitAtivo.numero, itensPdf, nowIso);
      downloadBlob(blobDet, `Kit-${kitAtivo.numero}-Detalhado.pdf`);
      setTimeout(() => downloadBlob(blobRes, `Kit-${kitAtivo.numero}-Resumido.pdf`), 300);

      toast({ title: "Kit finalizado!", description: "PDFs gerados." });
      qc.invalidateQueries({ queryKey: ["kits_montagem_lista"] });
      setConfirmFinalizar(false);
      setKitAtivoId(null);
    } catch (e: any) {
      toast({ title: "Erro ao finalizar", description: e.message, variant: "destructive" });
    } finally {
      setProcessando(false);
    }
  };

  const cancelarMontagem = async () => {
    if (!kitAtivo) return;
    setProcessando(true);
    try {
      const { error: errItens } = await supabase
        .from("kits_montagem_itens" as any)
        .delete()
        .eq("kit_id", kitAtivo.id);
      if (errItens) throw errItens;
      const { error: errKit } = await supabase
        .from("kits_montagem" as any)
        .update({ status: "cancelado" })
        .eq("id", kitAtivo.id);
      if (errKit) throw errKit;
      toast({ title: `Kit #${kitAtivo.numero} cancelado.` });
      qc.invalidateQueries({ queryKey: ["kits_montagem_lista"] });
      setConfirmCancelar(false);
      setKitAtivoId(null);
    } catch (e: any) {
      toast({ title: "Erro ao cancelar", description: e.message, variant: "destructive" });
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanLine className="h-6 w-6 text-primary" />
            Montagem de Kits
          </h1>
          <p className="text-sm text-muted-foreground">
            Bipe cada peça para compor o kit
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo Kit
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista de kits */}
        <Card className="p-4 lg:col-span-1 max-h-[70vh] overflow-y-auto">
          <h2 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
            Kits Recentes
          </h2>
          <div className="space-y-2">
            {kits.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum kit ativo. Crie um novo.</p>
            )}
            {kits.map((k) => {
              const ativo = k.id === kitAtivoId;
              const finalizado = k.status === "finalizado";
              return (
                <button
                  key={k.id}
                  type="button"
                  disabled={finalizado}
                  onClick={() => !finalizado && setKitAtivoId(k.id)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    ativo
                      ? "border-primary bg-primary/10"
                      : finalizado
                      ? "border-border opacity-60 cursor-not-allowed"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Kit #{k.numero}
                    </div>
                    <Badge variant={finalizado ? "secondary" : "default"}>
                      {finalizado ? "Finalizado" : "Em montagem"}
                    </Badge>
                  </div>
                  {(k.descricao || k.total_pecas) && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {k.descricao}
                      {k.descricao && (k.total_pecas ?? 0) > 0 && " • "}
                      {(k.total_pecas ?? 0) > 0 && `${k.total_pecas} peças`}
                      {(k.valor_varejo ?? 0) > 0 && ` • ${formatarValor(k.valor_varejo!)}`}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(k.criado_em).toLocaleString("pt-BR")}
                  </p>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Bipagem */}
        <div className="lg:col-span-2 space-y-4">
          {!kitAtivo ? (
            <Card className="p-12 text-center text-muted-foreground">
              <ScanLine className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>Selecione um kit ou crie um novo para iniciar a bipagem.</p>
            </Card>
          ) : (
            <>
              <Card className="p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h2 className="text-xl font-bold">Kit #{kitAtivo.numero}</h2>
                    {kitAtivo.descricao && (
                      <p className="text-sm text-muted-foreground">{kitAtivo.descricao}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" onClick={() => setKitAtivoId(null)}>Fechar</Button>
                    <Button variant="destructive" onClick={() => setConfirmCancelar(true)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Cancelar Montagem
                    </Button>
                    {itens.length > 0 && (
                      <Button onClick={() => setConfirmFinalizar(true)}>
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Finalizar Kit
                      </Button>
                    )}
                  </div>
                </div>

                {/* Painel de bipagem em duas colunas */}
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
                  {/* COLUNA ESQUERDA: BIPAR PRODUTO */}
                  <div className="lg:col-span-3 rounded-lg border bg-card p-4 space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      Bipar Produto
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={acao} onValueChange={(v) => setAcao(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="adicionar">Adicionar</SelectItem>
                          <SelectItem value="remover">Remover</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value="codigo_barras" onValueChange={() => {}}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="codigo_barras">Código de Barras</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <form
                      onSubmit={(e) => { e.preventDefault(); bipar(); }}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-[1fr_90px] gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Código de Barras *</Label>
                          <div className="relative">
                            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                            <Input
                              ref={inputRef}
                              autoFocus
                              value={codigo}
                              onChange={(e) => setCodigo(e.target.value)}
                              placeholder="Bipe ou digite..."
                              className="pl-9 h-11 font-mono"
                              disabled={processando}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Quantidade</Label>
                          <Input
                            type="number"
                            min={1}
                            value={quantidade}
                            onChange={(e) => setQuantidade(e.target.value)}
                            className="h-11 text-center"
                            disabled={processando || acao === "remover"}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Tipo de Preço</Label>
                        <Select value={tipoPreco} onValueChange={(v) => setTipoPreco(v as any)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="varejo">Varejo</SelectItem>
                            <SelectItem value="custo">Custo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        type="submit"
                        disabled={processando || !codigo.trim()}
                        className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {acao === "remover" ? "REMOVER" : "ADICIONAR"}
                      </Button>
                    </form>
                  </div>

                  {/* COLUNA DIREITA: PRODUTO + TOTAIS */}
                  <div className="lg:col-span-2 rounded-lg border bg-card overflow-hidden">
                    <div className="p-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
                        Produto
                      </h3>
                      {ultimoBipado ? (
                        <div className="flex gap-3">
                          <div className="flex-1 text-xs space-y-1">
                            <div><span className="text-muted-foreground">Referência:</span>{" "}
                              <span className="font-medium">{ultimoBipado.referencia ?? "—"}</span>
                            </div>
                            <div><span className="text-muted-foreground">Descrição:</span></div>
                            <div className="font-medium line-clamp-2">{ultimoBipado.descricao ?? "—"}</div>
                            <div className="pt-1"><span className="text-muted-foreground">Quantidade:</span>{" "}
                              <span className="font-semibold">{ultimoBipado.quantidade}</span>
                            </div>
                            <div><span className="text-muted-foreground">Preço Unitário:</span></div>
                            <div className="text-base font-bold text-primary">{formatarValor(ultimoBipado.preco)}</div>
                          </div>
                          <div className="h-[120px] w-[120px] rounded border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                            {ultimoBipado.foto ? (
                              <img src={ultimoBipado.foto} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <ImageIcon className="h-8 w-8 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground py-8 text-xs">
                          Nenhum produto bipado ainda
                        </div>
                      )}
                    </div>
                    <div className="border-t bg-muted/30 p-4 space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-semibold">
                          {formatarValor(ultimoBipado ? ultimoBipado.preco * ultimoBipado.quantidade : 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Quantidade (kit)</span>
                        <span className="font-semibold">{totalPecas} peças</span>
                      </div>
                      <div className="flex justify-between border-t pt-1.5">
                        <span className="font-semibold">Valor Total</span>
                        <span className="font-bold text-primary">{formatarValor(totalValor)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Totais resumidos do kit */}
                <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <div className="text-xl font-bold text-foreground">{totalPecas}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Peças</div>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <div className="text-xl font-bold text-primary">{formatarValor(totalValor)}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Varejo</div>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <div className="text-xl font-bold text-foreground">{formatarValor(totalCusto)}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Custo</div>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <div className="text-xl font-bold text-emerald-600">{margemBruta.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Margem</div>
                  </div>
                </div>
              </Card>

              {resumoCategorias.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
                    Resumo por Categoria
                  </h3>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Varejo</TableHead>
                          <TableHead className="text-right">Custo</TableHead>
                          <TableHead className="text-right">Margem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resumoCategorias.map((c) => (
                          <TableRow key={c.categoria}>
                            <TableCell className="font-medium">{c.categoria}</TableCell>
                            <TableCell className="text-right">{c.qtd}</TableCell>
                            <TableCell className="text-right">{formatarValor(c.varejo)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{formatarValor(c.custo)}</TableCell>
                            <TableCell className="text-right">{c.margem.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell>TOTAL</TableCell>
                          <TableCell className="text-right">{totalPecas}</TableCell>
                          <TableCell className="text-right">{formatarValor(totalValor)}</TableCell>
                          <TableCell className="text-right">{formatarValor(totalCusto)}</TableCell>
                          <TableCell className="text-right">{margemBruta.toFixed(1)}%</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}

              {/* Lista de Produtos */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Lista de Produtos</h3>
                <div className="rounded-md border overflow-x-auto max-h-[50vh] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-16">Foto</TableHead>
                        <TableHead>Cód. de Barras</TableHead>
                        <TableHead>Referência</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Subcategoria</TableHead>
                        <TableHead className="w-20 text-center">Qtd.</TableHead>
                        <TableHead className="text-right">Unitário</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                            Nenhum item bipado ainda
                          </TableCell>
                        </TableRow>
                      ) : (
                        itens.map((it) => {
                          const meta = it.produto_id ? metaMap.get(it.produto_id) : null;
                          const total = (it.preco_snapshot || 0) * (it.quantidade || 1);
                          return (
                            <TableRow key={it.id}>
                              <TableCell>
                                {it.foto_snapshot ? (
                                  <img src={it.foto_snapshot} alt="" className="h-10 w-10 rounded object-cover" />
                                ) : (
                                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{it.codigo_barras}</TableCell>
                              <TableCell className="text-xs">{meta?.referencia ?? "—"}</TableCell>
                              <TableCell className="font-medium max-w-[220px] truncate">{it.descricao_snapshot}</TableCell>
                              <TableCell className="text-xs">{it.categoria_snapshot ?? "—"}</TableCell>
                              <TableCell className="text-xs">{meta?.subcategoria ?? "—"}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={1}
                                  value={it.quantidade}
                                  onChange={(e) => atualizarQuantidade(it.id, parseInt(e.target.value, 10))}
                                  className="h-8 w-16 text-center"
                                />
                              </TableCell>
                              <TableCell className="text-right">{formatarValor(it.preco_snapshot)}</TableCell>
                              <TableCell className="text-right font-semibold">{formatarValor(total)}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => removerItem(it.id)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Dialog Novo Kit */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Kit</DialogTitle>
            <DialogDescription>
              Kit <strong>#{proximoNumero}</strong> será criado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Tipo do Kit</Label>
              <Select value={tipoKit} onValueChange={setTipoKit}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inicial">Inicial</SelectItem>
                  <SelectItem value="especial">Especial</SelectItem>
                  <SelectItem value="maleta_vip">Maleta VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={() => criarKit.mutate()} disabled={criarKit.isPending || !tipoKit}>
              {criarKit.isPending ? "Criando..." : "Criar Kit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Finalização */}
      <Dialog open={confirmFinalizar} onOpenChange={setConfirmFinalizar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Kit</DialogTitle>
            <DialogDescription>
              Finalizar Kit #{kitAtivo?.numero} com <strong>{totalPecas}</strong> peças no valor de{" "}
              <strong>{formatarValor(totalValor)}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmFinalizar(false)}>Cancelar</Button>
            <Button onClick={finalizarKit} disabled={processando}>
              {processando ? "Finalizando..." : "Confirmar e Gerar PDFs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCancelar} onOpenChange={setConfirmCancelar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar montagem</AlertDialogTitle>
            <AlertDialogDescription>
              Cancelar a montagem do Kit #{kitAtivo?.numero}? Todos os itens bipados serão removidos e o kit será marcado como cancelado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processando}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); cancelarMontagem(); }}
              disabled={processando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processando ? "Cancelando..." : "Confirmar Cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
