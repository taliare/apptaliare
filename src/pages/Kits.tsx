import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, formatarValor } from '@/lib/utils';

interface Vendedora {
  id: string;
  nome: string;
}

export default function Kits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State para entrega de kit
  const [isKitEntregaDialogOpen, setIsKitEntregaDialogOpen] = useState(false);
  const [kitSearchTerm, setKitSearchTerm] = useState('');
  const [selectedKit, setSelectedKit] = useState<string>('');
  const [vincularVendedora, setVincularVendedora] = useState(false);
  const [selectedVendedoraId, setSelectedVendedoraId] = useState<string>('');
  
  const [revendedoraKit, setRevendedoraKit] = useState('');
  const [dataVencimentoKit, setDataVencimentoKit] = useState<Date>(addDays(new Date(), 60));

  // Query for kits em estoque (atualmente com o representante)
  const { data: kitsEstoque = [], isLoading } = useQuery({
    queryKey: ['kits-estoque-rep', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kits_estoque')
        .select('*')
        .eq('representante_id', user?.id)
        .eq('status', 'com_representante')
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Query para vendedoras ativas
  const { data: vendedoras = [] } = useQuery({
    queryKey: ['vendedoras-ativas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedoras')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data as Vendedora[];
    },
  });

  // Filtrar kits pela pesquisa
  const kitsFiltrados = kitsEstoque.filter((kit: any) =>
    kit.codigo.toLowerCase().includes(kitSearchTerm.toLowerCase())
  );

  const resetKitEntregaForm = () => {
    setSelectedKit('');
    setKitSearchTerm('');
    setVincularVendedora(false);
    setSelectedVendedoraId('');
    setRevendedoraKit('');
    setDataVencimentoKit(addDays(new Date(), 60));
  };

  // Mutation para registrar entrega de kit usando função RPC atômica
  const entregaKitMutation = useMutation({
    mutationFn: async (data: { 
      kitId: string; 
      revendedora: string; 
      vendedoraId?: string; 
      vendedoraNome?: string;
      dataVencimento: string 
    }) => {
      // Usar função RPC atômica que faz tudo em uma única transação
      const { data: result, error } = await supabase
        .rpc('entregar_kit_para_revendedora', {
          p_kit_id: data.kitId,
          p_user_id: user!.id,
          p_revendedora: data.revendedora,
          p_data_vencimento: data.dataVencimento,
          p_vendedora_id: data.vendedoraId || null,
          p_vendedora_nome: data.vendedoraNome || null
        });

      if (error) throw error;
      
      // A função retorna JSON com success: true/false
      const response = result as { success: boolean; error?: string };
      if (!response.success) {
        throw new Error(response.error || 'Erro ao registrar entrega');
      }
      
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kits-estoque-rep'] });
      queryClient.invalidateQueries({ queryKey: ['kits-estoque'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      queryClient.invalidateQueries({ queryKey: ['kits-entregues-representante'] });
      queryClient.invalidateQueries({ queryKey: ['vendas-externas'] });
      toast.success('Entrega de kit registrada com sucesso!');
      resetKitEntregaForm();
      setIsKitEntregaDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Erro ao registrar entrega: ${error.message}`);
    },
  });

  const handleSubmitKitEntrega = () => {
    if (!user?.id) {
      toast.error('Usuário não autenticado. Faça login novamente.');
      return;
    }

    if (!selectedKit || !revendedoraKit) {
      toast.error('Selecione um kit e informe o nome da revendedora');
      return;
    }

    if (vincularVendedora && !selectedVendedoraId) {
      toast.error('Selecione uma vendedora');
      return;
    }

    const kit = kitsEstoque.find((k: any) => k.id === selectedKit);
    if (!kit) {
      toast.error('Kit não encontrado');
      return;
    }

    const vendedoraSelecionada = vendedoras.find(v => v.id === selectedVendedoraId);

    entregaKitMutation.mutate({
      kitId: selectedKit,
      revendedora: revendedoraKit,
      vendedoraId: vincularVendedora ? selectedVendedoraId : undefined,
      vendedoraNome: vincularVendedora ? vendedoraSelecionada?.nome : undefined,
      dataVencimento: format(dataVencimentoKit, 'yyyy-MM-dd')
    });
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'inicial': return 'Inicial';
      case 'especial': return 'Especial';
      case 'maleta': return 'Maleta';
      default: return tipo;
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'inicial': return 'bg-blue-500';
      case 'especial': return 'bg-purple-500';
      case 'maleta': return 'bg-green-500';
      default: return 'bg-muted';
    }
  };


  return (
    <div className="space-y-6">
      {/* Número grande no topo */}
      <Card className="border-2 border-primary/20">
        <CardContent className="py-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Package className="h-10 w-10 text-primary" />
              <span className="text-6xl font-bold text-primary">{kitsEstoque.length}</span>
            </div>
            <p className="text-xl text-muted-foreground">Kits em Mãos</p>
          </div>
        </CardContent>
      </Card>

      {/* Botão grande de registrar entrega */}
      <Dialog open={isKitEntregaDialogOpen} onOpenChange={setIsKitEntregaDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            size="lg" 
            className="w-full h-14 text-lg"
            disabled={kitsEstoque.length === 0}
            onClick={resetKitEntregaForm}
          >
            <Package className="h-5 w-5 mr-2" />
            Registrar Entrega de Kit
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Entrega de Kit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Selecionar Kit * ({kitsEstoque.length} disponíveis)</Label>
              <Select value={selectedKit} onValueChange={setSelectedKit}>
                <SelectTrigger>
                  <SelectValue placeholder="Pesquisar e selecionar kit..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Buscar por código..."
                      value={kitSearchTerm}
                      onChange={(e) => setKitSearchTerm(e.target.value)}
                      className="mb-2"
                    />
                  </div>
                  {kitsFiltrados.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">Nenhum kit encontrado</div>
                  ) : (
                    kitsFiltrados.map((kit: any) => (
                      <SelectItem key={kit.id} value={kit.id}>
                        {kit.codigo} ({kit.tipo}) {kit.valor > 0 && `- R$ ${kit.valor.toFixed(2)}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedKit && (() => {
              const kit = kitsEstoque.find((k: any) => k.id === selectedKit);
              return kit ? (
                <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                  <p><strong>Código:</strong> {kit.codigo}</p>
                  <p><strong>Tipo:</strong> {kit.tipo}</p>
                  <p><strong>Valor:</strong> R$ {(kit.valor || 0).toFixed(2)}</p>
                </div>
              ) : null;
            })()}

            <div>
              <Label>Nome da Revendedora *</Label>
              <Input
                value={revendedoraKit}
                onChange={(e) => setRevendedoraKit(e.target.value)}
                placeholder="Ex: Maria Silva"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="vincular-vendedora"
                checked={vincularVendedora}
                onChange={(e) => {
                  setVincularVendedora(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedVendedoraId('');
                  }
                }}
                className="rounded"
              />
              <Label htmlFor="vincular-vendedora" className="cursor-pointer">
                Vincular a uma vendedora/recrutadora
              </Label>
            </div>

            {vincularVendedora && (
              <div className="space-y-2">
                <Label>Vendedora/Recrutadora *</Label>
                {vendedoras.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                    Nenhuma vendedora cadastrada. Peça ao admin para cadastrar.
                  </p>
                ) : vendedoras.length <= 6 ? (
                  // Chips para até 6 vendedoras
                  <div className="flex flex-wrap gap-2">
                    {vendedoras.map((vendedora) => (
                      <button
                        key={vendedora.id}
                        type="button"
                        onClick={() => setSelectedVendedoraId(vendedora.id)}
                        className={cn(
                          "px-4 py-2.5 rounded-lg font-medium text-sm transition-all border-2",
                          selectedVendedoraId === vendedora.id
                            ? "bg-primary text-primary-foreground border-primary shadow-md"
                            : "bg-muted hover:bg-accent border-transparent hover:border-primary/30"
                        )}
                      >
                        {vendedora.nome.toUpperCase()}
                      </button>
                    ))}
                  </div>
                ) : (
                  // Select com busca para mais de 6 vendedoras
                  <Select value={selectedVendedoraId} onValueChange={setSelectedVendedoraId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione a vendedora..." />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      {vendedoras.map((vendedora) => (
                        <SelectItem key={vendedora.id} value={vendedora.id}>
                          {vendedora.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div>
              <Label>Data de Vencimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dataVencimentoKit, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataVencimentoKit}
                    onSelect={(date) => date && setDataVencimentoKit(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsKitEntregaDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitKitEntrega} disabled={entregaKitMutation.isPending}>
              {entregaKitMutation.isPending ? 'Registrando...' : 'Registrar Entrega'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lista simples de kits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Meus Kits
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : kitsEstoque.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg">Nenhum kit em mãos</p>
              <p className="text-sm">Você receberá kits da produção</p>
            </div>
          ) : (
            <div className="space-y-3">
              {kitsEstoque.map((kit: any) => (
                <div 
                  key={kit.id} 
                  className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-lg font-semibold">{kit.codigo}</span>
                    <Badge className={cn("text-white", getTipoColor(kit.tipo))}>
                      {getTipoLabel(kit.tipo)}
                    </Badge>
                  </div>
                  {kit.valor > 0 && (
                    <span className="text-sm font-medium text-primary">
                      {formatarValor(kit.valor)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
