import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, User, Calendar, DollarSign, Camera, CameraOff, Plus, Package2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfMonth, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarValor, formatDateBR, parseLocalDate } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface KitEntregue {
  id: string;
  codigo_mostruario: string;
  tipo: string | null;
  data_entrega: string;
  data_vencimento: string;
  representante_id: string;
  prestacao_id: string | null;
}

interface CobrancaKit {
  codigo_nota: string;
  revendedora: string;
  valor_previsto: number;
  data_agendada: string;
}

export default function KitsEntregues() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  // Estados do dialog "Adicionar Peças"
  const [openAdicional, setOpenAdicional] = useState(false);
  const [kitSelecionado, setKitSelecionado] = useState<{ id: string; revendedora: string } | null>(null);
  const [descricaoAdicional, setDescricaoAdicional] = useState('');
  const [precoAdicional, setPrecoAdicional] = useState('');
  const [qtdAdicional, setQtdAdicional] = useState('1');
  const [codigoLido, setCodigoLido] = useState('');
  const [scanAtivo, setScanAtivo] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<BrowserMultiFormatReader | null>(null);

  // Gerar opções de meses (últimos 6 meses + próximos 6 meses)
  const mesOptions = useMemo(() => {
    const hoje = new Date();
    const opcoes: { value: string; label: string }[] = [];
    
    for (let i = -3; i <= 6; i++) {
      const mes = addMonths(startOfMonth(hoje), i);
      opcoes.push({
        value: format(mes, 'yyyy-MM'),
        label: format(mes, "MMMM 'de' yyyy", { locale: ptBR })
      });
    }
    
    return opcoes;
  }, []);

  const mesVencimentoPadrao = format(addMonths(new Date(), 2), 'yyyy-MM');
  const [mesVencimentoFiltro, setMesVencimentoFiltro] = useState(mesVencimentoPadrao);

  const { data: kitsEntregues = [], isLoading } = useQuery({
    queryKey: ['kits-entregues-representante', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('kits_entregues')
        .select('*')
        .eq('representante_id', userId)
        .order('data_vencimento', { ascending: true });

      if (error) throw error;
      return data as KitEntregue[];
    },
    enabled: !!userId,
  });

  const codigoKits = kitsEntregues.map(k => k.codigo_mostruario);

  const { data: cobrancasKit = [] } = useQuery({
    queryKey: ['cobrancas-kit', codigoKits, userId],
    queryFn: async () => {
      if (codigoKits.length === 0 || !userId) return [];
      
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('codigo_nota, revendedora, valor_previsto, data_agendada')
        .eq('representante_id', userId)
        .eq('vigente', true)
        .eq('tipo', 'kit')
        .in('codigo_nota', codigoKits);

      if (error) throw error;
      return data as CobrancaKit[];
    },
    enabled: codigoKits.length > 0 && !!userId,
  });

  const cobrancasMap = useMemo(() => {
    const map: Record<string, CobrancaKit> = {};
    cobrancasKit.forEach(c => {
      if (c.codigo_nota) {
        map[c.codigo_nota] = c;
      }
    });
    return map;
  }, [cobrancasKit]);

  const kitsFiltrados = useMemo(() => {
    return kitsEntregues.filter(kit => {
      const vencimentoMes = format(parseLocalDate(kit.data_vencimento), 'yyyy-MM');
      return vencimentoMes === mesVencimentoFiltro;
    });
  }, [kitsEntregues, mesVencimentoFiltro]);

  const resumo = useMemo(() => {
    const iniciais = kitsFiltrados.filter(k => 
      k.tipo?.toLowerCase() === 'inicial' || k.tipo?.toLowerCase() === 'novo'
    ).length;
    const especiais = kitsFiltrados.filter(k => 
      k.tipo?.toLowerCase() === 'especial'
    ).length;
    const maletas = kitsFiltrados.filter(k => 
      k.tipo?.toLowerCase() === 'maleta'
    ).length;
    const outros = kitsFiltrados.length - iniciais - especiais - maletas;
    
    return {
      iniciais: iniciais + outros,
      especiais,
      maletas,
      total: kitsFiltrados.length
    };
  }, [kitsFiltrados]);

  const getValorKit = (kit: KitEntregue): number => {
    const cobranca = cobrancasMap[kit.codigo_mostruario];
    if (cobranca) return cobranca.valor_previsto;
    const tipo = kit.tipo?.toLowerCase() || '';
    if (tipo === 'maleta') return 800;
    if (tipo === 'especial') return 500;
    return 350;
  };

  const getRevendedora = (kit: KitEntregue): string => {
    const cobranca = cobrancasMap[kit.codigo_mostruario];
    if (cobranca) return cobranca.revendedora;
    return 'Não informada';
  };

  // Câmera / scanner
  const pararCamera = () => {
    if (scannerRef.current) {
      try {
        (BrowserMultiFormatReader as any).releaseAllStreams?.();
      } catch {}
      scannerRef.current = null;
    }
    setScanAtivo(false);
  };

  const iniciarCamera = async () => {
    try {
      const reader = new BrowserMultiFormatReader();
      scannerRef.current = reader;
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const deviceId = devices[devices.length - 1]?.deviceId;
      setScanAtivo(true);
      await reader.decodeFromVideoDevice(deviceId, videoRef.current!, (result) => {
        if (result) {
          const cod = result.getText();
          setCodigoLido(cod);
          supabase
            .from('produtos_catalogo')
            .select('descricao, preco_varejo')
            .eq('codigo_barras', cod)
            .eq('ativo', true)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                setDescricaoAdicional(data.descricao);
                setPrecoAdicional(String(data.preco_varejo ?? ''));
                toast.success(`Produto encontrado: ${data.descricao}`);
              } else {
                toast.info('Código lido — produto não encontrado no catálogo. Preencha a descrição manualmente.');
              }
            });
          pararCamera();
        }
      });
    } catch (e: any) {
      toast.error(`Erro ao acessar câmera: ${e.message}`);
      setScanAtivo(false);
    }
  };

  useEffect(() => {
    if (!openAdicional) pararCamera();
  }, [openAdicional]);

  const adicionarItemMutation = useMutation({
    mutationFn: async () => {
      if (!kitSelecionado || !user?.id) throw new Error('Dados inválidos');
      if (!descricaoAdicional.trim()) throw new Error('Descrição é obrigatória');
      const preco = parseFloat(precoAdicional.replace(',', '.')) || 0;
      const qtd = parseInt(qtdAdicional) || 1;
      const valorTotal = preco * qtd;

      // 1. Salva a peça na tabela de adicionais
      const { error: insErr } = await supabase
        .from('kit_adicionais_itens')
        .insert({
          kit_entregue_id: kitSelecionado.id,
          representante_id: user.id,
          revendedora: kitSelecionado.revendedora,
          descricao: descricaoAdicional.trim(),
          codigo_barras: codigoLido || null,
          preco_unitario: preco,
          quantidade: qtd,
          criado_por: user.id,
        });
      if (insErr) throw insErr;

      // 2. Registra o acréscimo na cobrança da revendedora
      const { data: result, error: rpcErr } = await supabase.rpc('registrar_acrescimo_pedido', {
        p_kit_entregue_id: kitSelecionado.id,
        p_revendedora: kitSelecionado.revendedora,
        p_user_id: user.id,
        p_valor: valorTotal,
        p_descricao: descricaoAdicional.trim(),
      });
      if (rpcErr) throw rpcErr;
      const res = result as unknown as { success: boolean; error?: string };
      if (!res.success) throw new Error(res.error || 'Erro ao registrar acréscimo');
    },
    onSuccess: () => {
      toast.success('Peça adicionada com sucesso!');
      setDescricaoAdicional('');
      setPrecoAdicional('');
      setQtdAdicional('1');
      setCodigoLido('');
      queryClient.invalidateQueries({ queryKey: ['kit-adicionais', kitSelecionado?.id] });
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const { data: adicionaisDoKit = [] } = useQuery({
    queryKey: ['kit-adicionais', kitSelecionado?.id],
    enabled: !!kitSelecionado?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kit_adicionais_itens')
        .select('*')
        .eq('kit_entregue_id', kitSelecionado!.id)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalAdicionais = adicionaisDoKit.reduce(
    (s: number, i: any) => s + (i.preco_unitario || 0) * (i.quantidade || 1), 0
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando kits entregues...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Kits Entregues</h1>
          <p className="text-muted-foreground">Visualize os kits entregues para revendedoras</p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Vencimento:</span>
          <Select value={mesVencimentoFiltro} onValueChange={setMesVencimentoFiltro}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mesOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold text-primary">{resumo.total}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Entregues</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{resumo.iniciais}</p>
            <p className="text-sm text-muted-foreground mt-1">Kits Iniciais</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{resumo.especiais}</p>
            <p className="text-sm text-muted-foreground mt-1">Kits Especiais</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{resumo.maletas}</p>
            <p className="text-sm text-muted-foreground mt-1">Maletas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Detalhamento dos Kits
          </CardTitle>
        </CardHeader>
        <CardContent>
          {kitsFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">Nenhum kit entregue neste período</p>
              <p className="text-sm">Selecione outro mês de vencimento para ver outros kits</p>
            </div>
          ) : (
            <div className="space-y-3">
              {kitsFiltrados.map((kit) => {
                const revendedoraDoKit = getRevendedora(kit);
                return (
                  <div 
                    key={kit.id} 
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-muted/50 rounded-lg gap-3"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{kit.codigo_mostruario}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{revendedoraDoKit}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="px-2 py-1 bg-background rounded text-xs font-medium uppercase">
                        {kit.tipo || 'Inicial'}
                      </span>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        <span>{formatarValor(getValorKit(kit))}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Venc: {formatDateBR(kit.data_vencimento)}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setKitSelecionado({ id: kit.id, revendedora: revendedoraDoKit });
                          setOpenAdicional(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar Peças
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Adicionar Peças */}
      <Dialog open={openAdicional} onOpenChange={setOpenAdicional}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package2 className="h-5 w-5" />
              Adicionar Peças — {kitSelecionado?.revendedora}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Nova Peça</h3>

            {/* Scanner */}
            <div className="space-y-2">
              {scanAtivo ? (
                <div className="space-y-2">
                  <video ref={videoRef} className="w-full rounded-lg border bg-black aspect-video" />
                  <Button variant="destructive" size="sm" onClick={pararCamera} className="w-full">
                    <CameraOff className="h-4 w-4 mr-1" />
                    Parar Câmera
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={iniciarCamera} className="w-full">
                  <Camera className="h-4 w-4 mr-1" />
                  Abrir Câmera para Ler Código de Barras
                </Button>
              )}
              {codigoLido && (
                <p className="text-xs text-muted-foreground">Código lido: <span className="font-mono">{codigoLido}</span></p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Descrição da Peça *</Label>
              <Input
                value={descricaoAdicional}
                onChange={(e) => setDescricaoAdicional(e.target.value)}
                placeholder="Ex: Brinco argola dourado P"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Preço Unitário (R$)</Label>
                <Input
                  value={precoAdicional}
                  onChange={(e) => setPrecoAdicional(e.target.value)}
                  placeholder="0,00"
                  type="number"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  value={qtdAdicional}
                  onChange={(e) => setQtdAdicional(e.target.value)}
                  type="number"
                  min={1}
                />
              </div>
            </div>

            <Button
              onClick={() => adicionarItemMutation.mutate()}
              disabled={adicionarItemMutation.isPending || !descricaoAdicional.trim()}
              className="w-full"
            >
              {adicionarItemMutation.isPending ? 'Adicionando...' : 'Confirmar Adição'}
            </Button>
          </div>

          {adicionaisDoKit.length > 0 && (
            <div className="space-y-2 pt-4 border-t">
              <h3 className="font-semibold text-sm">
                Peças Adicionadas ({adicionaisDoKit.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Descrição</th>
                      <th className="p-2 text-center">Qtd</th>
                      <th className="p-2 text-right">Unit.</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adicionaisDoKit.map((item: any) => (
                      <tr key={item.id} className="border-b">
                        <td className="p-2">{item.descricao}</td>
                        <td className="p-2 text-center">{item.quantidade}</td>
                        <td className="p-2 text-right">{formatarValor(item.preco_unitario)}</td>
                        <td className="p-2 text-right">{formatarValor(item.preco_unitario * item.quantidade)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="font-bold bg-muted/50">
                    <tr>
                      <td className="p-2" colSpan={3}>Total Adicionais</td>
                      <td className="p-2 text-right">{formatarValor(totalAdicionais)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
