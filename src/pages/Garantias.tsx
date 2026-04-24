import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Shield, Filter, User, Package, FileText, Clock, Search, Phone, Users, ChevronDown, Edit, Key, Eye, Copy, RefreshCw, Power, Trash2, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DateRange } from 'react-day-picker';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// Interfaces
interface Garantia {
  id: string;
  codigo_pedido: string | null;
  codigo_mostruario: string | null;
  descricao_produto: string | null;
  data_compra: string | null;
  data_expiracao: string | null;
  status: string | null;
  cliente_id: string;
  revendedora_id: string | null;
}

interface ClienteGarantia {
  id: string;
  nome: string | null;
  telefone: string | null;
}

interface Revendedora {
  id: string;
  nome: string | null;
  email?: string | null;
  created_at?: string | null;
  ativo?: boolean;
}

interface ClienteComGarantias {
  cliente: ClienteGarantia;
  garantias: Garantia[];
  nomeRevendedora: string | null;
  revendedoraId: string | null;
}

interface RevendedoraComClientes {
  revendedora: Revendedora;
  clientes: ClienteComGarantias[];
  totalGarantias: number;
  garantiasAtivas: number;
}

// Helpers
const exibirCampo = (valor: string | null | undefined): string => {
  return valor?.trim() || '—';
};

const calcularDiasRestantes = (dataExpiracao: string | null): number | null => {
  if (!dataExpiracao) return null;
  const hoje = startOfDay(new Date());
  const dataFim = startOfDay(new Date(dataExpiracao));
  const diffMs = dataFim.getTime() - hoje.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

const isGarantiaAtiva = (dataExpiracao: string | null): boolean => {
  const dias = calcularDiasRestantes(dataExpiracao);
  return dias !== null && dias >= 0;
};

const formatDateBR = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  try {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return '—';
  }
};

const gerarSenhaAleatoria = (): string => {
  const maiusculas = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const minusculas = 'abcdefghijklmnopqrstuvwxyz';
  const numeros = '0123456789';
  
  let senha = '';
  senha += maiusculas[Math.floor(Math.random() * maiusculas.length)];
  senha += minusculas[Math.floor(Math.random() * minusculas.length)];
  senha += numeros[Math.floor(Math.random() * numeros.length)];
  
  const todos = maiusculas + minusculas + numeros;
  for (let i = 0; i < 5; i++) {
    senha += todos[Math.floor(Math.random() * todos.length)];
  }
  
  return senha.split('').sort(() => Math.random() - 0.5).join('');
};

export default function Garantias() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [activeTab, setActiveTab] = useState('garantias');
  
  // Filtros da aba Garantias
  const [filtroStatus, setFiltroStatus] = useState<string>('todas');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [openRevendedoras, setOpenRevendedoras] = useState<Set<string>>(new Set());
  const [openClientes, setOpenClientes] = useState<Set<string>>(new Set());

  // Filtros da aba Revendedoras
  const [searchRevendedora, setSearchRevendedora] = useState('');
  
  // Modals
  const [editingRevendedora, setEditingRevendedora] = useState<Revendedora | null>(null);
  const [editNome, setEditNome] = useState('');
  const [resetPasswordRevendedora, setResetPasswordRevendedora] = useState<Revendedora | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  
  // Modais de inativar/excluir
  const [toggleAtivoRevendedora, setToggleAtivoRevendedora] = useState<Revendedora | null>(null);
  const [deleteRevendedora, setDeleteRevendedora] = useState<Revendedora | null>(null);
  const [deleteGarantia, setDeleteGarantia] = useState<Garantia | null>(null);

  const toggleRevendedora = (revendedoraId: string) => {
    setOpenRevendedoras(prev => {
      const newSet = new Set(prev);
      if (newSet.has(revendedoraId)) {
        newSet.delete(revendedoraId);
      } else {
        newSet.add(revendedoraId);
      }
      return newSet;
    });
  };

  const toggleCliente = (clienteId: string) => {
    setOpenClientes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clienteId)) {
        newSet.delete(clienteId);
      } else {
        newSet.add(clienteId);
      }
      return newSet;
    });
  };

  // Buscar garantias via edge function
  const { data: dadosGarantias, isLoading: isLoadingGarantias, error: errorGarantias } = useQuery({
    queryKey: ['garantias-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-garantias-admin');
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const garantiasData = data?.garantias || [];
      const clientesData = data?.clientes || [];
      const revendedorasData = data?.revendedoras || [];

      // Criar mapa de clientes
      const clientesMap: Record<string, ClienteGarantia> = {};
      clientesData.forEach((c: any) => {
        clientesMap[c.id] = { id: c.id, nome: c.nome, telefone: c.telefone };
      });

      // Criar mapa de revendedoras
      const revendedorasMap: Record<string, Revendedora> = {};
      revendedorasData.forEach((r: Revendedora) => {
        revendedorasMap[r.id] = r;
      });

      // Agrupar: Revendedora → Cliente → Garantias
      const agrupamentoPorRevendedora = new Map<string, RevendedoraComClientes>();
      
      for (const g of garantiasData) {
        const clienteId = g.cliente_id;
        const revendedoraId = g.revendedora_id || 'sem-revendedora';
        
        if (!clienteId) continue;
        
        // Inicializar revendedora se não existe
        if (!agrupamentoPorRevendedora.has(revendedoraId)) {
          agrupamentoPorRevendedora.set(revendedoraId, {
            revendedora: revendedorasMap[revendedoraId] || { id: revendedoraId, nome: 'Sem Revendedora' },
            clientes: [],
            totalGarantias: 0,
            garantiasAtivas: 0
          });
        }
        
        const revendedoraGroup = agrupamentoPorRevendedora.get(revendedoraId)!;
        
        // Buscar ou criar cliente dentro da revendedora
        let clienteGroup = revendedoraGroup.clientes.find(c => c.cliente.id === clienteId);
        if (!clienteGroup) {
          clienteGroup = {
            cliente: clientesMap[clienteId] || { id: clienteId, nome: null, telefone: null },
            garantias: [],
            nomeRevendedora: revendedorasMap[revendedoraId]?.nome || null,
            revendedoraId: revendedoraId !== 'sem-revendedora' ? revendedoraId : null
          };
          revendedoraGroup.clientes.push(clienteGroup);
        }
        
        clienteGroup.garantias.push({
          id: g.id,
          codigo_pedido: g.codigo_pedido,
          codigo_mostruario: g.codigo_mostruario,
          descricao_produto: g.descricao_produto,
          data_compra: g.data_compra,
          data_expiracao: g.data_expiracao,
          status: g.status,
          cliente_id: g.cliente_id,
          revendedora_id: g.revendedora_id,
        });
        
        revendedoraGroup.totalGarantias++;
        if (isGarantiaAtiva(g.data_expiracao)) {
          revendedoraGroup.garantiasAtivas++;
        }
      }

      // Ordenar garantias e clientes
      for (const [, revGroup] of agrupamentoPorRevendedora) {
        for (const clienteGroup of revGroup.clientes) {
          clienteGroup.garantias.sort((a, b) => {
            const dateA = a.data_compra ? new Date(a.data_compra).getTime() : 0;
            const dateB = b.data_compra ? new Date(b.data_compra).getTime() : 0;
            return dateB - dateA;
          });
        }
        revGroup.clientes.sort((a, b) => (a.cliente.nome || '').localeCompare(b.cliente.nome || ''));
      }

      return Array.from(agrupamentoPorRevendedora.values()).sort((a, b) => 
        (a.revendedora.nome || '').localeCompare(b.revendedora.nome || '')
      );
    },
    retry: 1,
  });

  // Buscar revendedoras do banco externo
  const { data: revendedorasExternas = [], isLoading: isLoadingRevendedoras, refetch: refetchRevendedoras } = useQuery({
    queryKey: ['revendedoras-external'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-revendedoras-external');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.revendedoras || [];
    },
  });

  // Mutation para atualizar nome
  const updateNomeMutation = useMutation({
    mutationFn: async ({ userId, nome }: { userId: string; nome: string }) => {
      const { data, error } = await supabase.functions.invoke('update-profile-external', {
        body: { userId, nome }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Nome atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['revendedoras-external'] });
      queryClient.invalidateQueries({ queryKey: ['garantias-admin'] });
      setEditingRevendedora(null);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar nome: ${error.message}`);
    }
  });

  // Mutation para redefinir senha
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const { data, error } = await supabase.functions.invoke('reset-password-external', {
        body: { userId, newPassword }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Senha redefinida com sucesso!');
      setPasswordSaved(true);
    },
    onError: (error) => {
      toast.error(`Erro ao redefinir senha: ${error.message}`);
    }
  });

  // Mutation para alternar ativo
  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ userId, ativo }: { userId: string; ativo: boolean }) => {
      const { data, error } = await supabase.functions.invoke('toggle-ativo-external', {
        body: { userId, ativo }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.ativo ? 'Revendedora ativada!' : 'Revendedora inativada!');
      queryClient.invalidateQueries({ queryKey: ['revendedoras-external'] });
      setToggleAtivoRevendedora(null);
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  // Mutation para excluir revendedora
  const deleteRevendedoraMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data, error } = await supabase.functions.invoke('delete-revendedora-external', {
        body: { userId }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Revendedora excluída com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['revendedoras-external'] });
      queryClient.invalidateQueries({ queryKey: ['garantias-admin'] });
      setDeleteRevendedora(null);
    },
    onError: (error) => {
      // Mensagem amigável para caso de garantias existentes
      if (error.message.includes('garantia(s) registrada(s)')) {
        toast.warning(error.message, { duration: 5000 });
      } else {
        toast.error(`Erro ao excluir: ${error.message}`);
      }
      setDeleteRevendedora(null);
    }
  });

  // Mutation para excluir garantia individual (admin only)
  const deleteGarantiaMutation = useMutation({
    mutationFn: async ({ garantiaId }: { garantiaId: string }) => {
      const { data, error } = await supabase.functions.invoke('delete-garantia-external', {
        body: { garantiaId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Garantia excluída com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['garantias-admin'] });
      setDeleteGarantia(null);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir garantia: ${error.message}`);
    },
  });
  const revendedorasFiltradas = useMemo(() => {
    if (!dadosGarantias?.length) return [];

    return dadosGarantias
      .filter(revGroup => revGroup && revGroup.clientes)
      .map(revGroup => {
        const clientesFiltrados = (revGroup.clientes || [])
          .map(clienteGroup => {
            const garantiasFiltradas = (clienteGroup.garantias || []).filter(g => {
              // Filtro por status
              if (filtroStatus !== 'todas') {
                const ativa = isGarantiaAtiva(g.data_expiracao);
                if (filtroStatus === 'ativa' && !ativa) return false;
                if (filtroStatus === 'expirada' && ativa) return false;
              }

              // Filtro por data de compra
              if (dateRange?.from && g.data_compra) {
                const dataCompra = new Date(g.data_compra);
                if (dataCompra < dateRange.from) return false;
                if (dateRange.to && dataCompra > dateRange.to) return false;
              }

              // Filtro por busca
              if (searchTerm) {
                const termo = searchTerm.toLowerCase();
                const matchCliente = clienteGroup.cliente.nome?.toLowerCase().includes(termo) || 
                                     clienteGroup.cliente.telefone?.toLowerCase().includes(termo);
                const matchRevendedora = revGroup.revendedora.nome?.toLowerCase().includes(termo);
                const matchGarantia = 
                  g.codigo_pedido?.toLowerCase().includes(termo) ||
                  g.codigo_mostruario?.toLowerCase().includes(termo) ||
                  g.descricao_produto?.toLowerCase().includes(termo) ||
                  g.status?.toLowerCase().includes(termo);
                
                if (!matchCliente && !matchRevendedora && !matchGarantia) return false;
              }

              return true;
            });

            return { ...clienteGroup, garantias: garantiasFiltradas };
          })
          .filter(c => c.garantias.length > 0);

        const totalGarantias = clientesFiltrados.reduce((acc, c) => acc + c.garantias.length, 0);
        const garantiasAtivas = clientesFiltrados.reduce((acc, c) => 
          acc + c.garantias.filter(g => isGarantiaAtiva(g.data_expiracao)).length, 0
        );

        return { ...revGroup, clientes: clientesFiltrados, totalGarantias, garantiasAtivas };
      })
      .filter(r => r.clientes.length > 0);
  }, [dadosGarantias, filtroStatus, dateRange, searchTerm]);

  // Filtrar revendedoras na aba de gerenciamento
  const revendedorasListaFiltrada = useMemo(() => {
    if (!revendedorasExternas.length) return [];
    if (!searchRevendedora) return revendedorasExternas;
    
    const termo = searchRevendedora.toLowerCase();
    return revendedorasExternas.filter((r: Revendedora) => 
      r.nome?.toLowerCase().includes(termo) || 
      r.email?.toLowerCase().includes(termo)
    );
  }, [revendedorasExternas, searchRevendedora]);

  // Contadores
  const totalGarantias = dadosGarantias?.reduce((acc, r) => acc + r.totalGarantias, 0) || 0;
  const totalAtivas = dadosGarantias?.reduce((acc, r) => acc + r.garantiasAtivas, 0) || 0;
  const totalExpiradas = totalGarantias - totalAtivas;
  const totalRevendedoras = dadosGarantias?.length || 0;
  const totalGarantiasFiltradas = revendedorasFiltradas.reduce((acc, r) => acc + r.totalGarantias, 0);

  const limparFiltros = () => {
    setFiltroStatus('todas');
    setDateRange(undefined);
    setSearchTerm('');
  };

  const handleEditRevendedora = (revendedora: Revendedora) => {
    setEditingRevendedora(revendedora);
    setEditNome(revendedora.nome || '');
  };

  const handleSaveNome = () => {
    if (editingRevendedora && editNome.trim()) {
      updateNomeMutation.mutate({ userId: editingRevendedora.id, nome: editNome.trim() });
    }
  };

  const handleResetPassword = (revendedora: Revendedora) => {
    setResetPasswordRevendedora(revendedora);
    setNewPassword(gerarSenhaAleatoria());
    setPasswordCopied(false);
    setPasswordSaved(false);
  };

  const handleSavePassword = () => {
    if (resetPasswordRevendedora && newPassword) {
      resetPasswordMutation.mutate({ userId: resetPasswordRevendedora.id, newPassword });
    }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(newPassword);
    setPasswordCopied(true);
    toast.success('Senha copiada!');
  };

  const handleViewClientes = (revendedoraId: string) => {
    setActiveTab('garantias');
    setSearchTerm('');
    setOpenRevendedoras(new Set([revendedoraId]));
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleAtivo = (revendedora: Revendedora) => {
    setToggleAtivoRevendedora(revendedora);
  };

  const handleConfirmToggleAtivo = () => {
    if (toggleAtivoRevendedora) {
      const novoAtivo = toggleAtivoRevendedora.ativo === false; // se está inativo, vai ativar
      toggleAtivoMutation.mutate({ userId: toggleAtivoRevendedora.id, ativo: novoAtivo });
    }
  };

  const handleDeleteRevendedora = (revendedora: Revendedora) => {
    setDeleteRevendedora(revendedora);
  };

  const handleConfirmDelete = () => {
    if (deleteRevendedora) {
      deleteRevendedoraMutation.mutate({ userId: deleteRevendedora.id });
    }
  };

  // Renderizar contador de dias restantes
  const renderDiasRestantes = (dias: number | null) => {
    if (dias === null) return <span className="text-muted-foreground">—</span>;
    if (dias < 0) return <span className="text-destructive font-medium">Expirada há {Math.abs(dias)} dias</span>;
    if (dias === 0) return <span className="text-warning font-medium">Expira hoje</span>;
    if (dias <= 30) return <span className="text-warning font-medium">{dias} dias restantes</span>;
    return <span className="text-success font-medium">{dias} dias restantes</span>;
  };

  if (isLoadingGarantias) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando garantias...</p>
        </div>
      </div>
    );
  }

  if (errorGarantias) {
    let errorMessage = 'Erro desconhecido';
    if (errorGarantias instanceof Error) {
      errorMessage = errorGarantias.message;
    }
    
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-lg">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-medium mb-2">Erro ao carregar garantias</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Não foi possível conectar ao banco de dados de garantias.
            </p>
            <div className="bg-muted rounded p-3 text-left">
              <p className="text-xs font-mono text-muted-foreground break-all">{errorMessage}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Garantias
          </h1>
          <p className="text-muted-foreground">
            {totalGarantiasFiltradas} garantias de {totalRevendedoras} revendedoras
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            <Users className="h-3 w-3 mr-1" />
            {totalRevendedoras} Revendedoras
          </Badge>
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            {totalAtivas} Ativas
          </Badge>
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            {totalExpiradas} Expiradas
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="garantias" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Garantias
          </TabsTrigger>
          <TabsTrigger value="revendedoras" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Revendedoras
          </TabsTrigger>
        </TabsList>

        {/* Tab: Garantias */}
        <TabsContent value="garantias" className="space-y-6">
          {/* Filtros */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                {/* Busca geral */}
                <div className="lg:col-span-2">
                  <Label className="text-sm mb-2 block">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Revendedora, cliente, produto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Filtro por status */}
                <div>
                  <Label className="text-sm mb-2 block">Status</Label>
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      <SelectItem value="ativa">Ativa</SelectItem>
                      <SelectItem value="expirada">Expirada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro por data de compra */}
                <div>
                  <Label className="text-sm mb-2 block">Data de Compra</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateRange && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                            </>
                          ) : (
                            format(dateRange.from, "dd/MM/yyyy")
                          )
                        ) : (
                          "Período"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Botão limpar filtros */}
              {(filtroStatus !== 'todas' || dateRange || searchTerm) && (
                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={limparFiltros}>
                    Limpar Filtros
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lista de Garantias Agrupadas por Revendedora → Cliente */}
          {revendedorasFiltradas.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhuma garantia encontrada</h3>
                <p className="text-muted-foreground">
                  {filtroStatus !== 'todas' || dateRange || searchTerm
                    ? 'Nenhuma garantia encontrada com os filtros aplicados.'
                    : 'Não há garantias registradas no sistema.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {revendedorasFiltradas.map((revGroup) => {
                const isRevOpen = openRevendedoras.has(revGroup.revendedora.id);
                
                return (
                  <Collapsible
                    key={revGroup.revendedora.id}
                    open={isRevOpen}
                    onOpenChange={() => toggleRevendedora(revGroup.revendedora.id)}
                  >
                    <Card className="border-l-4 border-l-primary">
                      {/* Header da Revendedora */}
                      <CollapsibleTrigger asChild>
                        <CardHeader className="pb-3 p-3 sm:p-6 cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                              <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <User className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <CardTitle className="text-sm sm:text-xl truncate">{exibirCampo(revGroup.revendedora.nome)}</CardTitle>
                                <p className="text-xs text-muted-foreground">
                                  {revGroup.clientes.length} cliente{revGroup.clientes.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                              <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 sm:px-2.5">
                                {revGroup.totalGarantias}<span className="hidden sm:inline">&nbsp;garantia{revGroup.totalGarantias !== 1 ? 's' : ''}</span>
                              </Badge>
                              <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px] sm:text-xs px-1.5 sm:px-2.5">
                                {revGroup.garantiasAtivas}<span className="hidden sm:inline">&nbsp;ativa{revGroup.garantiasAtivas !== 1 ? 's' : ''}</span>
                              </Badge>
                              <ChevronDown className={cn(
                                "h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground transition-transform duration-200 shrink-0",
                                isRevOpen && "rotate-180"
                              )} />
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>

                      {/* Lista de Clientes da Revendedora */}
                      <CollapsibleContent>
                        <CardContent className="pt-4 border-t space-y-3">
                          {revGroup.clientes.map((clienteGroup) => {
                            const isClienteOpen = openClientes.has(clienteGroup.cliente.id);
                            const garantiasAtivas = clienteGroup.garantias.filter(g => isGarantiaAtiva(g.data_expiracao)).length;
                            
                            return (
                              <Collapsible
                                key={clienteGroup.cliente.id}
                                open={isClienteOpen}
                                onOpenChange={() => toggleCliente(clienteGroup.cliente.id)}
                              >
                                <Card className="bg-muted/30">
                                  {/* Header do Cliente */}
                                  <CollapsibleTrigger asChild>
                                    <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-3">
                                          <div className="h-8 w-8 rounded-full bg-secondary/50 flex items-center justify-center">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                          </div>
                                          <div>
                                            <p className="font-medium">{exibirCampo(clienteGroup.cliente.nome)}</p>
                                            {clienteGroup.cliente.telefone && (
                                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Phone className="h-3 w-3" />
                                                {clienteGroup.cliente.telefone}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-xs">
                                            {clienteGroup.garantias.length} garantia{clienteGroup.garantias.length !== 1 ? 's' : ''}
                                          </Badge>
                                          <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                                            {garantiasAtivas} ativa{garantiasAtivas !== 1 ? 's' : ''}
                                          </Badge>
                                          <ChevronDown className={cn(
                                            "h-4 w-4 text-muted-foreground transition-transform duration-200",
                                            isClienteOpen && "rotate-180"
                                          )} />
                                        </div>
                                      </div>
                                    </CardHeader>
                                  </CollapsibleTrigger>

                                  {/* Lista de Garantias do Cliente */}
                                  <CollapsibleContent>
                                    <CardContent className="pt-0 pb-4 space-y-3">
                                      {clienteGroup.garantias.map((garantia) => {
                                        const diasRestantes = calcularDiasRestantes(garantia.data_expiracao);
                                        const ativa = diasRestantes !== null && diasRestantes >= 0;
                                        
                                        return (
                                          <div 
                                            key={garantia.id} 
                                            className={cn(
                                              "border rounded-lg p-4",
                                              ativa ? "bg-card" : "bg-muted/30"
                                            )}
                                          >
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                                              <h4 className="font-medium text-base">
                                                {exibirCampo(garantia.descricao_produto)}
                                              </h4>
                                              <Badge 
                                                variant="outline" 
                                                className={cn(
                                                  "w-fit",
                                                  ativa 
                                                    ? "bg-success/10 text-success border-success/30"
                                                    : "bg-destructive/10 text-destructive border-destructive/30"
                                                )}
                                              >
                                                {exibirCampo(garantia.status)}
                                              </Badge>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                              <div>
                                                <span className="text-muted-foreground block text-xs">Pedido</span>
                                                <p className="font-medium flex items-center gap-1">
                                                  <FileText className="h-3 w-3 text-muted-foreground" />
                                                  {exibirCampo(garantia.codigo_pedido)}
                                                </p>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground block text-xs">Mostruário</span>
                                                <p className="font-medium flex items-center gap-1">
                                                  <Package className="h-3 w-3 text-muted-foreground" />
                                                  {exibirCampo(garantia.codigo_mostruario)}
                                                </p>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground block text-xs">Data Compra</span>
                                                <p className="font-medium flex items-center gap-1">
                                                  <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                                                  {formatDateBR(garantia.data_compra)}
                                                </p>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground block text-xs">Validade</span>
                                                <p className="font-medium flex items-center gap-1">
                                                  <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                                                  {formatDateBR(garantia.data_expiracao)}
                                                </p>
                                              </div>
                                            </div>
                                            
                                            <div className="mt-3 pt-3 border-t flex items-center justify-between gap-2 flex-wrap">
                                              <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                {renderDiasRestantes(diasRestantes)}
                                              </div>
                                              {isAdmin && (
                                                <Button
                                                  variant="destructive"
                                                  size="sm"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteGarantia(garantia);
                                                  }}
                                                  className="h-8"
                                                >
                                                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                                  Excluir
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </CardContent>
                                  </CollapsibleContent>
                                </Card>
                              </Collapsible>
                            );
                          })}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab: Revendedoras */}
        <TabsContent value="revendedoras" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Revendedoras Cadastradas
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Gerencie as revendedoras do sistema de garantias
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchRevendedoras()}
                  disabled={isLoadingRevendedoras}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", isLoadingRevendedoras && "animate-spin")} />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Busca */}
              <div className="mb-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou email..."
                    value={searchRevendedora}
                    onChange={(e) => setSearchRevendedora(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {isLoadingRevendedoras ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : revendedorasListaFiltrada.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma revendedora encontrada</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revendedorasListaFiltrada.map((rev: Revendedora) => (
                        <TableRow key={rev.id} className={rev.ativo === false ? 'opacity-60' : ''}>
                          <TableCell className="font-medium">{exibirCampo(rev.nome)}</TableCell>
                          <TableCell className="text-muted-foreground">{exibirCampo(rev.email)}</TableCell>
                          <TableCell>
                            {rev.ativo === false ? (
                              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                                Inativo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                                Ativo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditRevendedora(rev)}
                                title="Editar nome"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleResetPassword(rev)}
                                title="Redefinir senha"
                              >
                                <Key className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleAtivo(rev)}
                                title={rev.ativo === false ? 'Ativar' : 'Inativar'}
                                className={rev.ativo === false ? 'text-success hover:text-success' : 'text-warning hover:text-warning'}
                              >
                                <Power className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteRevendedora(rev)}
                                title="Excluir"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewClientes(rev.id)}
                                title="Ver clientes"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: Editar Nome */}
      <Dialog open={!!editingRevendedora} onOpenChange={() => setEditingRevendedora(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Revendedora</DialogTitle>
            <DialogDescription>
              Altere o nome da revendedora no sistema de garantias
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                placeholder="Nome da revendedora"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRevendedora(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveNome}
              disabled={!editNome.trim() || updateNomeMutation.isPending}
            >
              {updateNomeMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Redefinir Senha */}
      <Dialog open={!!resetPasswordRevendedora} onOpenChange={() => setResetPasswordRevendedora(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              {resetPasswordRevendedora?.nome || 'Revendedora'} - {resetPasswordRevendedora?.email || ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="newPassword">Nova Senha</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha"
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNewPassword(gerarSenhaAleatoria())}
                  title="Gerar nova senha"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyPassword}
                  title="Copiar senha"
                >
                  <Copy className={cn("h-4 w-4", passwordCopied && "text-success")} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                A senha deve ter 8+ caracteres, maiúscula, minúscula e número
              </p>
            </div>

            {passwordSaved && (
              <div className="bg-success/10 border border-success/30 rounded-lg p-4">
                <p className="text-sm text-success font-medium mb-2">
                  ✓ Senha atualizada com sucesso!
                </p>
                <p className="text-xs text-muted-foreground">
                  Copie a senha e envie para a revendedora via WhatsApp ou outro canal.
                </p>
                <div className="mt-2 p-2 bg-muted rounded font-mono text-sm">
                  {newPassword}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordRevendedora(null)}>
              {passwordSaved ? 'Fechar' : 'Cancelar'}
            </Button>
            {!passwordSaved && (
              <Button 
                onClick={handleSavePassword}
                disabled={!newPassword || resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending ? 'Salvando...' : 'Salvar Senha'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Confirmar Ativar/Inativar */}
      <AlertDialog open={!!toggleAtivoRevendedora} onOpenChange={() => setToggleAtivoRevendedora(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleAtivoRevendedora?.ativo === false ? 'Ativar Revendedora' : 'Inativar Revendedora'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleAtivoRevendedora?.ativo === false ? (
                <>
                  Deseja ativar <strong>{toggleAtivoRevendedora?.nome || 'esta revendedora'}</strong>?
                  <br />
                  A revendedora poderá acessar o sistema novamente.
                </>
              ) : (
                <>
                  Deseja inativar <strong>{toggleAtivoRevendedora?.nome || 'esta revendedora'}</strong>?
                  <br />
                  A revendedora será marcada como inativa no sistema.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggleAtivo}
              disabled={toggleAtivoMutation.isPending}
              className={toggleAtivoRevendedora?.ativo === false ? '' : 'bg-warning text-warning-foreground hover:bg-warning/90'}
            >
              {toggleAtivoMutation.isPending 
                ? 'Processando...' 
                : toggleAtivoRevendedora?.ativo === false 
                  ? 'Ativar' 
                  : 'Inativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Confirmar Exclusão */}
      <AlertDialog open={!!deleteRevendedora} onOpenChange={() => setDeleteRevendedora(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir Revendedora
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Deseja excluir permanentemente <strong>{deleteRevendedora?.nome || 'esta revendedora'}</strong>?
              </p>
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm">
                <p className="font-medium text-destructive mb-1">⚠️ Esta ação não pode ser desfeita!</p>
                <p className="text-muted-foreground">
                  A exclusão só será permitida se a revendedora não possuir garantias registradas.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteRevendedoraMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRevendedoraMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Confirmar Exclusão de Garantia */}
      <AlertDialog open={!!deleteGarantia} onOpenChange={(open) => !open && setDeleteGarantia(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir Garantia
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta garantia? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGarantia && deleteGarantiaMutation.mutate({ garantiaId: deleteGarantia.id })}
              disabled={deleteGarantiaMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteGarantiaMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
