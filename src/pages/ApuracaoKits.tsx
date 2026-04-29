import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Search, ScanBarcode, X, Plus, ArrowLeft, CheckCircle, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PecaDevolvida {
  id: string;
  codigo_barras: string;
  referencia: string | null;
  descricao: string;
  valor: number;
  manual?: boolean;
}

function getComissaoFaixa(valorVendido: number) {
  if (valorVendido >= 2000) return { percentual: 50, categoria: "Elite" };
  if (valorVendido >= 1000) return { percentual: 40, categoria: "Destaque" };
  if (valorVendido >= 300) return { percentual: 30, categoria: "Ativa" };
  return { percentual: 20, categoria: "Inicial" };
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export default function ApuracaoKits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [etapa, setEtapa] = useState<"busca" | "bipagem" | "confirmado">("busca");

  // Modal de apuração rápida (sem bipagem)
  const [quickApurarNota, setQuickApurarNota] = useState<any>(null);
  const [quickTotalVendido, setQuickTotalVendido] = useState<string>("");

  useEffect(() => {
    if (quickApurarNota) {
      const vk = Number((quickApurarNota as any).valor_kit_original || quickApurarNota.valor_previsto || 0);
      const tvRegistrado = (quickApurarNota as any).prestacoes_contas?.[0]?.total_venda;
      const valorVendidoBase = tvRegistrado !== undefined ? Number(tvRegistrado) : vk;
      setQuickTotalVendido(valorVendidoBase.toFixed(2));
    }
  }, [quickApurarNota]);

  const quickTotalVendidoNum = Number(quickTotalVendido) || 0;
  const quickFaixa = getComissaoFaixa(quickTotalVendidoNum);
  const quickComissao = quickTotalVendidoNum * (quickFaixa.percentual / 100);
  const quickValorEmpresa = Math.max(0, quickTotalVendidoNum - quickComissao);

  const quickApurarMutation = useMutation({
    mutationFn: async () => {
      if (!quickApurarNota) throw new Error("Nota não selecionada");
      const { error } = await supabase
        .from("cobrancas_agendadas")
        .update({
          valor_kit_original: Number(quickApurarNota.valor_previsto),
          valor_previsto: quickValorEmpresa,
          apurado: true,
        })
        .eq("id", quickApurarNota.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Apuração confirmada com sucesso!" });
      setQuickApurarNota(null);
      queryClient.invalidateQueries({ queryKey: ["apuracao-kits-pendentes"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao apurar", description: err.message, variant: "destructive" });
    },
  });

  const [buscaCodigo, setBuscaCodigo] = useState("");
  const [notaSelecionada, setNotaSelecionada] = useState<any>(null);
  const [pecas, setPecas] = useState<PecaDevolvida[]>([]);
  const [codigoBarras, setCodigoBarras] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDescricao, setManualDescricao] = useState("");
  const [manualValor, setManualValor] = useState("");
  const [resumoFinal, setResumoFinal] = useState<any>(null);
  const inputBipRef = useRef<HTMLInputElement>(null);
  const [listaExpandida, setListaExpandida] = useState(false);

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

  // Busca notas pelo código
  const { data: resultados = [], isFetching: buscando } = useQuery({
    queryKey: ["apuracao-busca-nota", buscaCodigo],
    queryFn: async () => {
      if (buscaCodigo.length < 2) return [];
      const { data, error } = await supabase
        .from("cobrancas_agendadas")
        .select("*, profiles_limited!cobrancas_agendadas_representante_id_fkey(nome), prestacoes_contas!prestacoes_contas_cobranca_id_fkey(total_venda)")
        .ilike("codigo_nota", `%${buscaCodigo}%`)
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: buscaCodigo.length >= 2 && etapa === "busca",
  });

  const selecionarNota = (nota: any) => {
    setNotaSelecionada(nota);
    setPecas([]);
    setEtapa("bipagem");
    setTimeout(() => inputBipRef.current?.focus(), 100);
  };

  // Busca produto pelo código de barras
  const biparPeca = async () => {
    const codigo = codigoBarras.trim();
    if (!codigo) return;

    const { data, error } = await supabase
      .from("produtos_taliare")
      .select("*")
      .eq("codigo_barras", codigo)
      .maybeSingle();

    if (error) {
      playBeep(300, 150);
      toast({ title: "Erro ao buscar produto", variant: "destructive" });
      setCodigoBarras("");
      return;
    }

    if (!data) {
      playBeep(300, 150);
      toast({
        title: "Produto não encontrado",
        description: `Código "${codigo}" não existe no catálogo. Adicione manualmente.`,
        variant: "destructive",
      });
      setManualOpen(true);
      return;
    }

    playBeep(800, 80);
    setPecas((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        codigo_barras: data.codigo_barras,
        referencia: data.referencia,
        descricao: data.descricao,
        valor: Number(data.preco_varejo) || 0,
      },
    ]);
    setCodigoBarras("");
    inputBipRef.current?.focus();
  };

  const adicionarManual = () => {
    if (!manualDescricao || !manualValor) return;
    setPecas((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        codigo_barras: codigoBarras || `MANUAL-${Date.now()}`,
        referencia: null,
        descricao: manualDescricao,
        valor: Number(manualValor) || 0,
        manual: true,
      },
    ]);
    setManualOpen(false);
    setManualDescricao("");
    setManualValor("");
    setCodigoBarras("");
    inputBipRef.current?.focus();
  };

  const removerPeca = (id: string) => {
    setPecas((prev) => prev.filter((p) => p.id !== id));
  };

  // Cálculos
  const totalDevolvido = pecas.reduce((sum, p) => sum + p.valor, 0);
  const valorKit = Number(notaSelecionada?.valor_kit_original || notaSelecionada?.valor_previsto || 0);
  const valorVendido = valorKit - totalDevolvido;
  const { percentual, categoria } = getComissaoFaixa(valorVendido);
  const valorComissao = valorVendido * (percentual / 100);
  const valorAdiantado = Number(notaSelecionada?.valor_adiantado || 0);
  const valorEmpresa = Math.max(0, valorVendido - valorComissao - valorAdiantado);

  // Valor registrado pelo representante via prestação de contas
  const vendidoRepresentante = useMemo(() => {
    const pc = (notaSelecionada as any)?.prestacoes_contas;
    if (pc && pc.length > 0) return Number(pc[0].total_venda);
    return null;
  }, [notaSelecionada]);

  const divergencia = vendidoRepresentante !== null ? valorVendido - vendidoRepresentante : null;

  // Finalizar apuração
  const finalizarMutation = useMutation({
    mutationFn: async () => {
      if (!notaSelecionada || !user) throw new Error("Dados incompletos");

      const resumo = `Apuração: ${pecas.length} peça(s) devolvida(s) (R$ ${fmt(totalDevolvido)}). Vendido: R$ ${fmt(valorVendido)}. Comissão ${percentual}%: R$ ${fmt(valorComissao)}.${valorAdiantado > 0 ? ` Adiantamento: R$ ${fmt(valorAdiantado)}.` : ''} Valor empresa: R$ ${fmt(valorEmpresa)}.`;

      // Salvar valor_kit_original ANTES de sobrescrever valor_previsto
      const novoStatus = valorEmpresa <= 0 ? 'pago' : 'parcial';

      const { error: errUpdate } = await supabase
        .from("cobrancas_agendadas")
        .update({
          status: novoStatus as any,
          valor_kit_original: Number(notaSelecionada.valor_previsto),
          valor_previsto: valorEmpresa,
          valor_pago_acumulado: 0,
          data_quitacao: novoStatus === 'pago' ? new Date().toISOString().split("T")[0] : null,
          observacoes: resumo,
          apurado: true,
        })
        .eq("id", notaSelecionada.id);

      if (errUpdate) throw errUpdate;

      return { resumo };
    },
    onSuccess: (data) => {
      setResumoFinal({
        pecas: pecas.length,
        totalDevolvido,
        valorVendido,
        percentual,
        categoria,
        valorComissao,
        valorAdiantado,
        valorEmpresa,
        resumo: data.resumo,
        vendidoRepresentante,
        divergencia,
      });
      setEtapa("confirmado");
      toast({ title: "Apuração concluída com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao finalizar", description: err.message, variant: "destructive" });
    },
  });

  const resetar = () => {
    setEtapa("busca");
    setBuscaCodigo("");
    setNotaSelecionada(null);
    setPecas([]);
    setResumoFinal(null);
  };

  // Query: kits pendentes de apuração direto de cobrancas_agendadas
  const { data: kitsPendentes = [], isLoading: loadingPendentes } = useQuery({
    queryKey: ["apuracao-kits-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas_agendadas")
        .select("*, profiles_limited!cobrancas_agendadas_representante_id_fkey(nome), prestacoes_contas!prestacoes_contas_cobranca_id_fkey(total_venda)")
        .eq("apurado", false)
        .in("status", ["pago", "parcial"] as any);

      if (error) throw error;
      return data || [];
    },
    enabled: etapa === "busca",
  });

  // Agrupar por representante
  const gruposRepresentante = useMemo(() => {
    const map: Record<string, { nome: string; notas: any[] }> = {};
    for (const nota of kitsPendentes) {
      const repId = nota.representante_id;
      if (!map[repId]) {
        map[repId] = { nome: (nota as any).profiles_limited?.nome || "Sem nome", notas: [] };
      }
      map[repId].notas.push(nota);
    }
    return Object.values(map);
  }, [kitsPendentes]);

  // ============= ETAPA 1: BUSCA =============
  if (etapa === "busca") {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ScanBarcode className="h-6 w-6 text-primary" />
            Apuração de Kits
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Selecione um kit para apurar ou busque manualmente pelo código
          </p>
        </div>

        {/* Seção: Kits para Apurar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Kits para Apurar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPendentes ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2 py-4">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                Carregando...
              </div>
            ) : gruposRepresentante.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum kit aguardando apuração
              </p>
            ) : (
              <div className="space-y-4">
                {gruposRepresentante.map((grupo, idx) => (
                  <div key={idx}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-foreground">{grupo.nome}</span>
                      <Badge variant="secondary" className="text-xs">{grupo.notas.length} kit{grupo.notas.length > 1 ? "s" : ""}</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {grupo.notas.map((nota: any) => (
                        <div
                          key={nota.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-foreground">{nota.codigo_nota}</span>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-sm text-muted-foreground truncate">{nota.revendedora}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs font-semibold text-foreground">R$ {fmt(Number((nota as any).valor_kit_original || nota.valor_previsto))}</span>
                              <span className="text-xs text-muted-foreground">{nota.data_agendada}</span>
                              <span className="text-xs text-amber-600 font-medium">
                                Devolvido: R$ {fmt((() => {
                                  const vk = Number((nota as any).valor_kit_original || nota.valor_previsto);
                                  const tv = (nota as any).prestacoes_contas?.[0]?.total_venda;
                                  return tv !== undefined ? Math.max(0, vk - Number(tv)) : vk;
                                })())}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <Button size="sm" variant="outline" onClick={() => setQuickApurarNota(nota)}>
                              <CheckCircle className="h-4 w-4 mr-1" /> Apurado
                            </Button>
                            <Button size="sm" variant="default" onClick={() => selecionarNota(nota)}>
                              Apurar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Busca manual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buscar Nota Manualmente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Digite o código da nota (ex: 5731)"
                className="pl-10"
                value={buscaCodigo}
                onChange={(e) => setBuscaCodigo(e.target.value)}
              />
            </div>

            {buscando && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                Buscando...
              </div>
            )}

            {resultados.length > 0 && (
              <div className="space-y-2">
                {resultados.map((nota: any) => (
                  <div
                    key={nota.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">{nota.codigo_nota}</span>
                        <Badge variant="outline" className="text-xs">
                          {nota.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {nota.revendedora} • {nota.profiles_limited?.nome || "—"}
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        Kit: R$ {fmt(Number((nota as any).valor_kit_original || nota.valor_previsto))}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => selecionarNota(nota)}>
                      Iniciar Apuração
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {buscaCodigo.length >= 2 && !buscando && resultados.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma nota encontrada</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============= ETAPA 2: BIPAGEM =============
  if (etapa === "bipagem") {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setEtapa("busca")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ScanBarcode className="h-5 w-5 text-primary" />
              Nota {notaSelecionada?.codigo_nota}
            </h1>
            <p className="text-sm text-muted-foreground">
              {notaSelecionada?.revendedora} • Kit: R$ {fmt(valorKit)}
            </p>
          </div>
        </div>

        {/* Campo de bipagem */}
        <Card>
          <CardContent className="pt-4">
            <Label className="text-sm font-medium">Bipar código de barras da peça</Label>
            <div className="flex gap-2 mt-1">
              <Input
                ref={inputBipRef}
                placeholder="Leia ou digite o código de barras"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && biparPeca()}
              />
              <Button onClick={biparPeca} className="shrink-0">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
            <button
              onClick={() => setManualOpen(true)}
              className="text-xs text-primary underline mt-2"
            >
              Produto não encontrado? Adicionar manualmente
            </button>
          </CardContent>
        </Card>

        {/* Lista de peças */}
        {pecas.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Peças Devolvidas ({pecas.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {(listaExpandida ? pecas : pecas.slice(-5)).map((peca) => (
                  <div key={peca.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {peca.referencia && (
                          <span className="font-mono text-xs text-muted-foreground">{peca.referencia}</span>
                        )}
                        {peca.manual && (
                          <Badge variant="outline" className="text-[10px]">Manual</Badge>
                        )}
                      </div>
                      <p className="text-sm truncate">{peca.descricao}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-2">
                      <span className="font-semibold text-sm whitespace-nowrap">R$ {fmt(peca.valor)}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removerPeca(peca.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {pecas.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-xs text-muted-foreground"
                  onClick={() => setListaExpandida(!listaExpandida)}
                >
                  {listaExpandida ? "Recolher" : `Ver todas (${pecas.length} peças)`}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Comparação representante vs apuração */}
        {pecas.length > 0 && (
          <Card className={vendidoRepresentante !== null && divergencia !== null && divergencia !== 0 ? "border-amber-500/50" : "border-green-500/50"}>
            <CardContent className="pt-4 space-y-2">
              <p className="text-sm font-semibold text-foreground mb-2">Comparação</p>
              {vendidoRepresentante !== null ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vendido pelo representante:</span>
                    <span className="font-semibold">R$ {fmt(vendidoRepresentante)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vendido pela apuração:</span>
                    <span className="font-semibold">R$ {fmt(valorVendido)}</span>
                  </div>
                  {divergencia !== null && divergencia === 0 ? (
                    <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-green-500/10">
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      <span className="text-sm text-green-700 dark:text-green-400">Apuração confirmada — valores conferem</span>
                    </div>
                  ) : divergencia !== null ? (
                    <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-amber-500/10">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="text-sm text-amber-700 dark:text-amber-400">
                        {divergencia > 0
                          ? `Apuração física aponta R$ ${fmt(Math.abs(divergencia))} a MAIS que o representante registrou — verifique se faltou bipar alguma peça`
                          : `Apuração física aponta R$ ${fmt(Math.abs(divergencia))} a MENOS que o representante registrou — verifique se foi bipado algo a mais`}
                      </span>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sem prestação de contas registrada para comparação.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Alerta valor vendido negativo */}
        {valorVendido < 0 && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-red-500/10">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <span className="text-sm text-red-700">
              Total devolvido (R$ {fmt(totalDevolvido)}) supera o valor do kit (R$ {fmt(valorKit)}) em R$ {fmt(Math.abs(valorVendido))} — verifique os itens bipados
            </span>
          </div>
        )}

        {/* Totais */}
        <Card className="border-primary/30">
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Devolvido:</span>
              <span className="font-semibold">R$ {fmt(totalDevolvido)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor do Kit:</span>
              <span className="font-semibold">R$ {fmt(valorKit)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-border pt-2">
              <span className="text-muted-foreground">Valor Vendido:</span>
              <span className="font-bold text-foreground">R$ {fmt(valorVendido)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Categoria:</span>
              <span className="font-semibold">{categoria}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Comissão ({percentual}%):</span>
              <span className="font-semibold">R$ {fmt(valorComissao)}</span>
            </div>
            {valorAdiantado > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Adiantamento abatido:</span>
                <span className="font-semibold text-green-600">- R$ {fmt(valorAdiantado)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t border-border pt-2">
              <span className="font-medium text-muted-foreground">Valor a Receber (Empresa):</span>
              <span className="font-bold text-primary text-base">R$ {fmt(valorEmpresa)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Botão finalizar */}
        <Button
          className="w-full"
          size="lg"
          disabled={pecas.length === 0 || finalizarMutation.isPending}
          onClick={() => finalizarMutation.mutate()}
        >
          {finalizarMutation.isPending ? "Finalizando..." : "Confirmar Apuração"}
        </Button>

        {/* Modal adicionar manual */}
        <Dialog open={manualOpen} onOpenChange={setManualOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Peça Manualmente</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {codigoBarras && (
                <p className="text-sm text-muted-foreground">
                  Código pesquisado: <span className="font-mono font-bold">{codigoBarras}</span>
                </p>
              )}
              <div>
                <Label>Descrição</Label>
                <Input
                  value={manualDescricao}
                  onChange={(e) => setManualDescricao(e.target.value)}
                  placeholder="Ex: Anel solitário dourado"
                />
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualValor}
                  onChange={(e) => setManualValor(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <Button className="w-full" disabled={!manualDescricao || !manualValor} onClick={adicionarManual}>
                Adicionar Peça
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ============= ETAPA 3: CONFIRMAÇÃO =============
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <div className="text-center space-y-2">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
        <h1 className="text-2xl font-bold text-foreground">Apuração Concluída</h1>
        <p className="text-muted-foreground">Nota {notaSelecionada?.codigo_nota} processada com sucesso</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo da Apuração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Revendedora:</span>
            <span className="font-semibold">{notaSelecionada?.revendedora}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Peças devolvidas:</span>
            <span className="font-semibold">{resumoFinal?.pecas}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Devolvido:</span>
            <span className="font-semibold">R$ {fmt(resumoFinal?.totalDevolvido || 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Valor Vendido:</span>
            <span className="font-semibold">R$ {fmt(resumoFinal?.valorVendido || 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Categoria:</span>
            <span className="font-semibold">{resumoFinal?.categoria}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Comissão ({resumoFinal?.percentual}%):</span>
            <span className="font-semibold">R$ {fmt(resumoFinal?.valorComissao || 0)}</span>
          </div>
          {(resumoFinal?.valorAdiantado || 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Adiantamento abatido:</span>
              <span className="font-semibold text-green-600">- R$ {fmt(resumoFinal?.valorAdiantado || 0)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm border-t border-border pt-2">
            <span className="font-medium">Valor Empresa:</span>
            <span className="font-bold text-primary text-lg">R$ {fmt(resumoFinal?.valorEmpresa || 0)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Comparação representante vs apuração */}
      <Card className={resumoFinal?.vendidoRepresentante !== null && resumoFinal?.divergencia !== null && resumoFinal?.divergencia > 0 ? "border-amber-500/50" : "border-green-500/50"}>
        <CardContent className="pt-4 space-y-2">
          <p className="text-sm font-semibold text-foreground mb-2">Comparação</p>
          {resumoFinal?.vendidoRepresentante !== null ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Vendido pelo representante:</span>
                <span className="font-semibold">R$ {fmt(resumoFinal?.vendidoRepresentante || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Vendido pela apuração:</span>
                <span className="font-semibold">R$ {fmt(resumoFinal?.valorVendido || 0)}</span>
              </div>
              {resumoFinal?.divergencia !== null && resumoFinal?.divergencia <= 0 ? (
                <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-green-500/10">
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="text-sm text-green-700 dark:text-green-400">Apuração confirmada — valores conferem</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-sm text-amber-700 dark:text-amber-400">Divergência de R$ {fmt(resumoFinal?.divergencia || 0)} — verifique com o representante</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sem prestação de contas registrada para comparação.</p>
          )}
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" onClick={resetar}>
        Nova Apuração
      </Button>
    </div>
  );
}
