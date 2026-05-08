import { useState, useEffect, useRef, useMemo } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { formatarValor } from "@/lib/utils";
import { Plus, ScanLine, X, CheckCircle2, Package } from "lucide-react";
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
};

type KitItem = {
  id: string;
  kit_id: string;
  codigo_barras: string;
  produto_id: string | null;
  descricao_snapshot: string | null;
  categoria_snapshot: string | null;
  preco_snapshot: number;
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
  const [novoNumero, setNovoNumero] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [confirmFinalizar, setConfirmFinalizar] = useState(false);
  const [processando, setProcessando] = useState(false);

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

  // Contadores em tempo real
  const totalPecas = itens.reduce((s, i) => s + (i.quantidade || 1), 0);
  const totalValor = itens.reduce((s, i) => s + (i.preco_snapshot || 0) * (i.quantidade || 1), 0);

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
      const numero = novoNumero.trim();
      if (!numero) throw new Error("Número do kit é obrigatório");
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("kits_montagem" as any)
        .insert({
          numero,
          descricao: novaDescricao.trim() || null,
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
      setNovoNumero("");
      setNovaDescricao("");
      setKitAtivoId(kit.id);
    },
    onError: (e: any) => {
      toast({ title: "Erro ao criar kit", description: e.message, variant: "destructive" });
    },
  });

  const bipar = async () => {
    const cod = codigo.trim();
    if (!cod || !kitAtivoId || processando) {
      refocus();
      return;
    }
    setProcessando(true);
    try {
      const { data: produto, error: pErr } = await supabase
        .from("produtos_catalogo" as any)
        .select("*")
        .eq("codigo_barras", cod)
        .eq("ativo", true)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!produto) {
        toast({
          title: "Produto não encontrado",
          description: cod,
          variant: "destructive",
        });
        setCodigo("");
        refocus();
        return;
      }
      const p = produto as any;
      const { error: insErr } = await supabase.from("kits_montagem_itens" as any).insert({
        kit_id: kitAtivoId,
        codigo_barras: p.codigo_barras,
        produto_id: p.id,
        descricao_snapshot: p.descricao,
        categoria_snapshot: p.categoria,
        preco_snapshot: p.preco_varejo ?? 0,
        quantidade: 1,
      });
      if (insErr) throw insErr;
      toast({
        title: "✓ Bipado",
        description: `${p.descricao} — ${formatarValor(p.preco_varejo ?? 0)}`,
      });
      setCodigo("");
      await refetchItens();
    } catch (e: any) {
      toast({ title: "Erro ao bipar", description: e.message, variant: "destructive" });
    } finally {
      setProcessando(false);
      refocus();
    }
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
        .update({ status: "finalizado", finalizado_em: nowIso })
        .eq("id", kitAtivo.id);
      if (error) throw error;

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
                  {k.descricao && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{k.descricao}</p>
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
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setKitAtivoId(null)}>
                      Fechar
                    </Button>
                    {itens.length > 0 && (
                      <Button onClick={() => setConfirmFinalizar(true)}>
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Finalizar Kit
                      </Button>
                    )}
                  </div>
                </div>

                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    bipar();
                  }}
                >
                  <div className="relative flex-1">
                    <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                    <Input
                      ref={inputRef}
                      autoFocus
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                      placeholder="Bipe ou digite o código de barras..."
                      className="pl-11 h-14 text-lg font-mono"
                      disabled={processando}
                    />
                  </div>
                  <Button type="submit" size="lg" disabled={processando || !codigo.trim()}>
                    Bipar
                  </Button>
                </form>

                <div className="mt-3 flex items-center justify-between text-sm bg-muted/40 rounded-lg p-3">
                  <span>
                    Total de peças: <strong className="text-foreground">{totalPecas}</strong>
                  </span>
                  <span>
                    Valor total: <strong className="text-primary">{formatarValor(totalValor)}</strong>
                  </span>
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-3">Itens bipados</h3>
                <div className="rounded-md border overflow-x-auto max-h-[50vh] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Cód. Barras</TableHead>
                        <TableHead className="text-right">Preço</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Nenhum item bipado ainda
                          </TableCell>
                        </TableRow>
                      ) : (
                        itens.map((it, idx) => {
                          // Agrupamento visual: alternar fundo quando categoria muda
                          const prev = itens[idx - 1];
                          const newGroup = !prev || prev.categoria_snapshot !== it.categoria_snapshot;
                          // Determinar índice do grupo para zebra
                          let groupIdx = 0;
                          for (let i = 0; i <= idx; i++) {
                            if (i === 0 || itens[i].categoria_snapshot !== itens[i - 1].categoria_snapshot) {
                              groupIdx++;
                            }
                          }
                          const zebra = groupIdx % 2 === 0;
                          return (
                            <TableRow key={it.id} className={zebra ? "bg-muted/20" : ""}>
                              <TableCell className="text-xs text-muted-foreground">
                                {itens.length - idx}
                              </TableCell>
                              <TableCell className="font-medium">{it.descricao_snapshot}</TableCell>
                              <TableCell>
                                {newGroup && (
                                  <Badge variant="outline" className="text-xs">
                                    {it.categoria_snapshot ?? "—"}
                                  </Badge>
                                )}
                                {!newGroup && <span className="text-muted-foreground text-xs">{it.categoria_snapshot}</span>}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{it.codigo_barras}</TableCell>
                              <TableCell className="text-right">{formatarValor(it.preco_snapshot)}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removerItem(it.id)}
                                >
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
            <DialogDescription>Informe o número único do kit para iniciar a montagem.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Número do Kit *</Label>
              <Input
                value={novoNumero}
                onChange={(e) => setNovoNumero(e.target.value)}
                placeholder="Ex: 6050"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                placeholder="Ex: Kit de mostruário primavera"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={() => criarKit.mutate()} disabled={criarKit.isPending || !novoNumero.trim()}>
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
    </div>
  );
}
