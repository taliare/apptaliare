import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CalendarIcon, Plus, Trash2, CheckCircle2, XCircle, Lock, Package, Wallet, DollarSign, Receipt, Search, MessageSquare } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn, formatarValor, formatarNumero, getLocalDateString } from '@/lib/utils';
import { sanitizeString } from '@/lib/validations';
import { ModalReceberCobranca } from '@/components/cobranca/ModalReceberCobranca';
import { ModalRegistrarAcrescimo } from '@/components/cobranca/ModalRegistrarAcrescimo';
import { RevendedoraSearchSelect } from '@/components/RevendedoraSearchSelect';
import type { Database } from '@/integrations/supabase/types';

interface NotaPromissoria {
  id: string;
  codigo_nota: string;
  data: string;
  valor_total: number;
  forma_pagamento_1: 'pix' | 'dinheiro' | 'cartao' | 'transferencia';
  valor_pagamento_1: number;
  forma_pagamento_2?: 'pix' | 'dinheiro' | 'cartao' | 'transferencia' | null;
  valor_pagamento_2?: number | null;
  representante_id: string;
  criado_em?: string | null;
  devolveu_tudo?: boolean;
  cobranca_id?: string | null; // ID da cobrança original para restauração
}

interface CobrancaDiariaType {
  id: string;
  data: string;
  total_cobrado: number;
  total_pix: number | null;
  total_dinheiro: number | null;
  total_cartao: number | null;
  despesa_cobranca: number | null;
  finalizado: boolean | null;
  representante_id: string;
  observacoes: string | null;
}

type Cobranca = Database['public']['Tables']['cobrancas_agendadas']['Row'];

const formaPagamentoLabels = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  transferencia: 'Transferência'
};

export default function CobrancaDiaria() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [historicoDialogOpen, setHistoricoDialogOpen] = useState(false);
  const [selectedHistoricoDate, setSelectedHistoricoDate] = useState<string | null>(null);

  // State para busca de nota
  const [isBuscarNotaDialogOpen, setIsBuscarNotaDialogOpen] = useState(false);
  const [codigoBusca, setCodigoBusca] = useState('');
  const [buscandoNota, setBuscandoNota] = useState(false);
  const [notaEncontrada, setNotaEncontrada] = useState<Cobranca | null>(null);
  const [erroNota, setErroNota] = useState<string | null>(null);
  
  // State para modal de cobrança
  const [cobrancaParaPagar, setCobrancaParaPagar] = useState<Cobranca | null>(null);

  // State para entrega de kit
  const [isKitEntregaDialogOpen, setIsKitEntregaDialogOpen] = useState(false);
  const [kitSearchTerm, setKitSearchTerm] = useState('');
  const [selectedKit, setSelectedKit] = useState<string>('');
  const [vincularVendedora, setVincularVendedora] = useState(false);
  const [vendedoraId, setVendedoraId] = useState('');
  const [revendedoraKit, setRevendedoraKit] = useState('');
  const [dataVencimentoKit, setDataVencimentoKit] = useState<string>(getLocalDateString(addDays(new Date(), 60)));

  // State para modal de acréscimo
  const [modalAcrescimoOpen, setModalAcrescimoOpen] = useState(false);
  const [cobrancaParaAcrescimo, setCobrancaParaAcrescimo] = useState<Cobranca | null>(null);

  // State para acréscimos na entrega de kit
  const [acrescimosKit, setAcrescimosKit] = useState<Array<{ valor: string; observacao: string }>>([]);

  // Form states for Cobrança Diária
  const [despesaCobranca, setDespesaCobranca] = useState('');
  const [observacoesDia, setObservacoesDia] = useState('');

  // Função para formatar valor monetário durante digitação
  const formatarValorInput = (valor: string): string => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (!apenasNumeros) return '';
    const numero = parseFloat(apenasNumeros) / 100;
    return numero.toFixed(2);
  };

  // Converter valor formatado (R$ 0,00) para número
  const parseValorFormatado = (valor: string): number => {
    const numeros = valor.replace(/\D/g, '');
    if (!numeros) return 0;
    return parseFloat(numeros) / 100;
  };

  const handleValorChange = (
    valor: string,
    setter: (v: string) => void
  ) => {
    const valorFormatado = formatarValorInput(valor);
    setter(valorFormatado);
  };

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Query for notas promissórias do dia
  const { data: notas = [], isLoading: loadingNotas } = useQuery({
    queryKey: ['notas-promissorias', dateStr, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_promissorias')
        .select('*')
        .eq('representante_id', user?.id)
        .eq('data', dateStr)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      return data as NotaPromissoria[];
    },
    enabled: !!user?.id,
  });

  // Query for cobrança diária
  const { data: cobrancaDiaria, isLoading: loadingCobranca } = useQuery({
    queryKey: ['cobranca-diaria', dateStr, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('*')
        .eq('representante_id', user?.id)
        .eq('data', dateStr)
        .maybeSingle();
      
      if (error) throw error;
      return data as CobrancaDiariaType | null;
    },
    enabled: !!user?.id,
  });

  // Realtime subscription para detectar quando admin reabre o dia
  // IMPORTANTE: Não depender de dateStr para não recriar subscription ao mudar data
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = supabase
      .channel('cobranca-diaria-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cobrancas_diarias',
          filter: `representante_id=eq.${user.id}`
        },
        (payload) => {
          const newData = payload.new as CobrancaDiariaType;
          const oldData = payload.old as CobrancaDiariaType;
          
          // Invalidar TODAS as queries de cobrança diária do usuário (não só a data atual)
          queryClient.invalidateQueries({ 
            predicate: (query) => 
              Array.isArray(query.queryKey) && 
              query.queryKey[0] === 'cobranca-diaria' &&
              query.queryKey[2] === user.id
          });
          
          // Também invalidar queries relacionadas
          queryClient.invalidateQueries({ 
            queryKey: ['historico-cobrancas', user.id] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['dias-nao-finalizados', user.id] 
          });
          
          // Se o dia foi reaberto pelo admin, notificar o usuário com a data específica
          if (newData.finalizado === false && oldData.finalizado === true) {
            toast.info(`O administrador reabriu o dia ${newData.data} para ajustes`, {
              duration: 5000
            });
          }
          
          // Se o dia foi finalizado, notificar também
          if (newData.finalizado === true && oldData.finalizado === false) {
            toast.info(`O dia ${newData.data} foi finalizado`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]); // REMOVIDO dateStr das dependências

  // Carregar observações existentes quando há registro do dia
  useEffect(() => {
    if (cobrancaDiaria?.observacoes) {
      setObservacoesDia(cobrancaDiaria.observacoes);
    } else {
      setObservacoesDia('');
    }
  }, [cobrancaDiaria]);

  // Query for histórico de fechamentos
  const { data: historico = [] } = useQuery({
    queryKey: ['historico-cobrancas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('*')
        .eq('representante_id', user?.id)
        .eq('finalizado', true)
        .order('data', { ascending: false })
        .limit(30);
      
      if (error) throw error;
      return data as CobrancaDiariaType[];
    },
    enabled: !!user?.id,
  });

  // Query para contar notas por dia
  const { data: notasPorDia = {} } = useQuery({
    queryKey: ['notas-por-dia', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_promissorias')
        .select('data')
        .eq('representante_id', user?.id);
      
      if (error) throw error;
      
      const contagem: Record<string, number> = {};
      data.forEach((nota) => {
        contagem[nota.data] = (contagem[nota.data] || 0) + 1;
      });
      
      return contagem;
    },
    enabled: !!user?.id,
  });

  // Query para buscar notas de uma data específica do histórico
  const { data: notasHistorico = [], isLoading: loadingNotasHistorico } = useQuery({
    queryKey: ['notas-historico', selectedHistoricoDate, user?.id],
    queryFn: async () => {
      if (!selectedHistoricoDate) return [];
      
      const { data, error } = await supabase
        .from('notas_promissorias')
        .select('*')
        .eq('representante_id', user?.id)
        .eq('data', selectedHistoricoDate)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      return data as NotaPromissoria[];
    },
    enabled: !!user?.id && !!selectedHistoricoDate,
  });

  // Query para buscar revendedoras das cobranças agendadas (lookup por codigo_nota)
  const { data: cobrancasAgendadas = [] } = useQuery({
    queryKey: ['cobrancas-agendadas-lookup', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('id, codigo_nota, revendedora')
        .eq('representante_id', user?.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Criar mapa de codigo_nota -> revendedora para lookup rápido
  const revendedoraMap = cobrancasAgendadas.reduce((acc, item) => {
    if (item.codigo_nota) {
      acc[item.codigo_nota] = item.revendedora;
    }
    return acc;
  }, {} as Record<string, string>);

  // Criar mapa de cobranca_id -> { codigo_nota, revendedora } para lookup reverso
  const cobrancaIdMap = cobrancasAgendadas.reduce((acc, item) => {
    if (item.id) {
      acc[item.id] = { codigo_nota: item.codigo_nota || '', revendedora: item.revendedora };
    }
    return acc;
  }, {} as Record<string, { codigo_nota: string; revendedora: string }>);

  // Lista única de nomes de revendedoras do representante para autocomplete
  const revendedorasUnicas = useMemo(() => {
    const nomes = new Set<string>();
    cobrancasAgendadas.forEach(item => {
      if (item.revendedora && item.revendedora.trim()) {
        nomes.add(item.revendedora.trim().toUpperCase());
      }
    });
    return Array.from(nomes).sort();
  }, [cobrancasAgendadas]);

  // Query para kits em estoque do representante
  const { data: kitsEstoque = [] } = useQuery({
    queryKey: ['kits-estoque-rep-diaria', user?.id],
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
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // Query para entregas de kits do dia (usando kits_entregues com data_entrega real)
  const { data: kitsEntreguesDoDia = [] } = useQuery({
    queryKey: ['kits-entregues-dia', dateStr, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kits_entregues')
        .select('*')
        .eq('representante_id', user?.id)
        .eq('data_entrega', dateStr)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Query para buscar acréscimos dos kits entregues do dia
  const kitIdsDoDia = kitsEntreguesDoDia.map((k: any) => k.id);
  
  const { data: acrescimosKitsDoDia = [] } = useQuery({
    queryKey: ['acrescimos-kits-dia', kitIdsDoDia],
    queryFn: async () => {
      if (kitIdsDoDia.length === 0) return [];
      
      const { data, error } = await supabase
        .from('acrescimos_pedido')
        .select('id, kit_entregue_id, valor, descricao, status')
        .in('kit_entregue_id', kitIdsDoDia);
      
      if (error) throw error;
      return data;
    },
    enabled: kitIdsDoDia.length > 0,
  });

  // Agrupar acréscimos por kit_entregue_id
  const acrescimosMap = useMemo(() => {
    const map: Record<string, Array<{ id: string; valor: number; descricao: string | null; status: string }>> = {};
    acrescimosKitsDoDia.forEach((a: any) => {
      if (!map[a.kit_entregue_id]) map[a.kit_entregue_id] = [];
      map[a.kit_entregue_id].push(a);
    });
    return map;
  }, [acrescimosKitsDoDia]);

  // Buscar detalhes das cobranças (revendedora, valor) para os kits entregues do dia
  const codigosKitsDoDia = kitsEntreguesDoDia.map((k: any) => k.codigo_mostruario);
  
  const { data: detalhesKitsCobrancas = [] } = useQuery({
    queryKey: ['detalhes-kits-cobrancas', codigosKitsDoDia, user?.id],
    queryFn: async () => {
      if (codigosKitsDoDia.length === 0) return [];
      
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('codigo_nota, revendedora, valor_previsto')
        .eq('representante_id', user?.id)
        .eq('tipo', 'kit')
        .in('codigo_nota', codigosKitsDoDia);
      
      if (error) throw error;
      return data;
    },
    enabled: codigosKitsDoDia.length > 0 && !!user?.id,
  });

  // Query para buscar dias não finalizados (últimos 30 dias)
  const { data: diasNaoFinalizados = [] } = useQuery({
    queryKey: ['dias-nao-finalizados', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const hoje = new Date();
      const diasAnteriores: string[] = [];
      
      for (let i = 1; i <= 30; i++) {
        const data = new Date(hoje);
        data.setDate(data.getDate() - i);
        diasAnteriores.push(format(data, 'yyyy-MM-dd'));
      }
      
      const { data: finalizados, error } = await supabase
        .from('cobrancas_diarias')
        .select('data')
        .eq('representante_id', user?.id)
        .eq('finalizado', true)
        .in('data', diasAnteriores);
      
      if (error) throw error;
      
      const datasFinalizadas = new Set(finalizados?.map(f => f.data) || []);
      return diasAnteriores.filter(d => !datasFinalizadas.has(d));
    },
    enabled: !!user?.id,
  });

  // Mapear detalhes por código do kit
  const detalhesKitMap = detalhesKitsCobrancas.reduce((acc: Record<string, any>, item: any) => {
    if (item.codigo_nota) {
      acc[item.codigo_nota] = item;
    }
    return acc;
  }, {});

  // Combinar kits entregues com detalhes das cobranças para exibição
  const entregasDoDia = kitsEntreguesDoDia.map((kit: any) => {
    const detalhes = detalhesKitMap[kit.codigo_mostruario];
    return {
      id: kit.id,
      codigo_nota: kit.codigo_mostruario,
      revendedora: detalhes?.revendedora || 'Não informada',
      valor_previsto: detalhes?.valor_previsto || 0,
      tipo: kit.tipo,
      data_entrega: kit.data_entrega,
    };
  });

  // Filtrar kits pela pesquisa
  const kitsFiltrados = kitsEstoque.filter((kit: any) =>
    kit.codigo.toLowerCase().includes(kitSearchTerm.toLowerCase())
  );

  // Mutation para registrar entrega de kit usando função RPC atômica
  const entregaKitMutation = useMutation({
    mutationFn: async (data: { kitId: string; revendedora: string; vendedoraId?: string; vendedoraNome?: string; dataVencimento: string }) => {
      if (!data.revendedora || data.revendedora.trim().length === 0) {
        throw new Error('Nome da revendedora é obrigatório');
      }
      if (data.revendedora.length > 100) {
        throw new Error('Nome da revendedora muito longo (máximo 100 caracteres)');
      }
      
      const sanitizedRevendedora = sanitizeString(data.revendedora);
      const sanitizedVendedora = data.vendedoraNome ? sanitizeString(data.vendedoraNome) : null;
      
      const { data: result, error } = await supabase
        .rpc('entregar_kit_para_revendedora', {
          p_kit_id: data.kitId,
          p_user_id: user!.id,
          p_revendedora: sanitizedRevendedora,
          p_data_vencimento: data.dataVencimento,
          p_vendedora_id: data.vendedoraId || null,
          p_vendedora_nome: sanitizedVendedora
        });

      if (error) throw error;
      
      const response = result as { success: boolean; error?: string };
      if (!response.success) {
        throw new Error(response.error || 'Erro ao registrar entrega');
      }
      
      return response;
    },
    onSuccess: async (response: any) => {
      // Registrar acréscimos se houver
      if (acrescimosKit.length > 0 && response.kit_entregue_id) {
        for (const acrescimo of acrescimosKit) {
          const valorNumerico = parseValorFormatado(acrescimo.valor);
          if (valorNumerico > 0) {
            try {
              await supabase.rpc('registrar_acrescimo_pedido', {
                p_kit_entregue_id: response.kit_entregue_id,
                p_user_id: user!.id,
                p_revendedora: sanitizeString(revendedoraKit),
                p_valor: valorNumerico,
                p_descricao: acrescimo.observacao || null,
                p_data_vencimento: dataVencimentoKit,
              });
            } catch (err) {
              console.error('Erro ao registrar acréscimo:', err);
            }
          }
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['kits-estoque-rep-diaria'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      queryClient.invalidateQueries({ queryKey: ['kits-entregues-dia'] });
      queryClient.invalidateQueries({ queryKey: ['detalhes-kits-cobrancas'] });
      queryClient.invalidateQueries({ queryKey: ['kits-entregues-representante'] });
      const msgAcrescimos = acrescimosKit.length > 0 ? ` com ${acrescimosKit.length} acréscimo(s)` : '';
      toast.success(`Entrega de kit registrada com sucesso${msgAcrescimos}!`);
      resetKitEntregaForm();
      setIsKitEntregaDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Erro ao registrar entrega: ${error.message}`);
    },
  });

  // Mutation para excluir entrega de kit usando função RPC atômica
  const excluirEntregaMutation = useMutation({
    mutationFn: async (entrega: { id: string; codigo_nota: string }) => {
      const { data: result, error } = await supabase
        .rpc('reverter_entrega_kit_atomico', {
          p_kit_entregue_id: entrega.id,
          p_user_id: user!.id
        });

      if (error) throw error;
      
      const response = result as { success: boolean; error?: string };
      if (!response.success) {
        throw new Error(response.error || 'Erro ao reverter entrega');
      }
      
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kits-estoque-rep-diaria'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      queryClient.invalidateQueries({ queryKey: ['kits-entregues-dia'] });
      queryClient.invalidateQueries({ queryKey: ['detalhes-kits-cobrancas'] });
      queryClient.invalidateQueries({ queryKey: ['kits-entregues-representante'] });
      toast.success('Entrega excluída! Kit voltou para sua posse.');
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir entrega: ${error.message}`);
    },
  });

  const resetKitEntregaForm = () => {
    setSelectedKit('');
    setKitSearchTerm('');
    setVincularVendedora(false);
    setVendedoraId('');
    setRevendedoraKit('');
    setDataVencimentoKit(getLocalDateString(addDays(new Date(), 60)));
    setAcrescimosKit([]);
  };

  const handleSubmitKitEntrega = () => {
    if (!user?.id) {
      toast.error('Usuário não autenticado. Faça login novamente.');
      return;
    }

    if (!selectedKit || !revendedoraKit) {
      toast.error('Selecione um kit e informe o nome da revendedora');
      return;
    }

    const kit = kitsEstoque.find((k: any) => k.id === selectedKit);
    if (!kit) {
      toast.error('Kit não encontrado');
      return;
    }

    const vendedoraSelecionada = vendedoras.find((v: any) => v.id === vendedoraId);
    entregaKitMutation.mutate({
      kitId: selectedKit,
      revendedora: revendedoraKit,
      vendedoraId: vincularVendedora ? vendedoraId : undefined,
      vendedoraNome: vincularVendedora && vendedoraSelecionada ? vendedoraSelecionada.nome : undefined,
      dataVencimento: dataVencimentoKit
    });
  };

  // Função para abrir modal de acréscimo a partir da busca de nota
  const handleAcrescimoFromBusca = async () => {
    if (!notaEncontrada) return;
    
    let kitEntregueId = notaEncontrada.kit_entregue_id;
    
    // Se não tem kit_entregue_id, fazer lookup
    if (!kitEntregueId && notaEncontrada.codigo_nota) {
      const { data } = await supabase
        .from('kits_entregues')
        .select('id')
        .eq('codigo_mostruario', notaEncontrada.codigo_nota)
        .eq('representante_id', user!.id)
        .limit(1)
        .maybeSingle();
      
      if (data) {
        kitEntregueId = data.id;
      } else {
        toast.error('Kit entregue não encontrado para esta nota');
        return;
      }
    }
    
    if (!kitEntregueId) {
      toast.error('Kit entregue não encontrado');
      return;
    }
    
    // Setar a cobrança com o kit_entregue_id resolvido
    setCobrancaParaAcrescimo({ ...notaEncontrada, kit_entregue_id: kitEntregueId });
    setIsBuscarNotaDialogOpen(false);
    setModalAcrescimoOpen(true);
  };

  // Mutation para excluir nota da cobrança de hoje e devolver para agenda
  const excluirNotaDaCobrancaMutation = useMutation({
    mutationFn: async (nota: NotaPromissoria & { cobranca_id?: string }) => {
      // Buscar a cobrança original primeiro - priorizando cobranca_id se existir
      let cobrancaOriginal = null;
      
      if (nota.cobranca_id) {
        // Se tem cobranca_id vinculado, buscar por ele (mais preciso)
        const { data } = await supabase
          .from('cobrancas_agendadas')
          .select('*')
          .eq('id', nota.cobranca_id)
          .maybeSingle();
        cobrancaOriginal = data;
      }
      
      // Fallback: buscar por codigo_nota (compatibilidade com notas antigas)
      if (!cobrancaOriginal) {
        const { data } = await supabase
          .from('cobrancas_agendadas')
          .select('*')
          .eq('representante_id', user?.id)
          .eq('codigo_nota', nota.codigo_nota)
          .maybeSingle();
        cobrancaOriginal = data;
      }

      // Deletar a nota promissória
      const { error: deleteError } = await supabase
        .from('notas_promissorias')
        .delete()
        .eq('id', nota.id);

      if (deleteError) throw deleteError;

      if (cobrancaOriginal) {
        // Restaurar cobrança: reverter valor_pago_acumulado e status
        const acumuladoAtual = (cobrancaOriginal as any).valor_pago_acumulado || 0;
        const novoAcumulado = Math.max(0, acumuladoAtual - nota.valor_total);
        const novoStatus = novoAcumulado > 0 ? 'parcial' : 'pendente';
        
        const updateData: any = { 
          status: novoStatus,
          valor_pago_acumulado: novoAcumulado,
          data_quitacao: null
        };

        // Se novoAcumulado == 0, restaurar valor_previsto para o valor original do kit
        if (novoAcumulado === 0 && cobrancaOriginal.kit_entregue_id) {
          const { data: valorOriginal } = await supabase
            .rpc('get_valor_original_kit', { p_kit_entregue_id: cobrancaOriginal.kit_entregue_id });
          
          if (valorOriginal) {
            updateData.valor_previsto = valorOriginal;
          }
        }

        const { error: updateError } = await supabase
          .from('cobrancas_agendadas')
          .update(updateData)
          .eq('id', cobrancaOriginal.id);

        if (updateError) throw updateError;

        // Deletar prestação vinculada a esta nota específica
        if (nota.codigo_nota) {
          await supabase
            .from('prestacoes_contas')
            .delete()
            .eq('cobranca_id', cobrancaOriginal.id)
            .eq('codigo_nota_referencia', nota.codigo_nota);
        } else {
          // Fallback: deletar por data se não tem codigo_nota
          await supabase
            .from('prestacoes_contas')
            .delete()
            .eq('cobranca_id', cobrancaOriginal.id)
            .eq('data_execucao', dateStr);
        }
      } else {
        // Sem cobrança original - criar uma nova (raro, só para notas órfãs)
        let revendedora = revendedoraMap[nota.codigo_nota];
        
        if (!revendedora && nota.codigo_nota) {
          const match = nota.codigo_nota.match(/^(.+?)-\d{14}$/);
          if (match) {
            revendedora = match[1];
          }
        }
        
        if (!revendedora) {
          revendedora = 'Revendedora não identificada';
        }
        
        const { error: insertError } = await supabase
          .from('cobrancas_agendadas')
          .insert({
            representante_id: user!.id,
            revendedora: revendedora,
            codigo_nota: nota.codigo_nota,
            valor_previsto: nota.valor_total,
            data_agendada: dateStr,
            status: 'pendente',
            tipo: 'repasse'
            // Sem observacoes - mantém limpo
          });

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-promissorias'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      queryClient.invalidateQueries({ queryKey: ['notas-por-dia'] });
      toast.success('Nota removida da cobrança de hoje e devolvida para a Agenda!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover nota: ${error.message}`);
    },
  });

  // Mutation para finalizar dia
  const finalizarDiaMutation = useMutation({
    mutationFn: async () => {
      const totalCobrado = notas.reduce((acc, nota) => acc + nota.valor_total, 0);
      
      const cobrancaData = {
        representante_id: user!.id,
        data: dateStr,
        total_cobrado: totalCobrado,
        total_pix: totalPixCalculado,
        total_dinheiro: totalDinheiroCalculado,
        total_cartao: totalCartaoCalculado,
        despesa_cobranca: parseValorFormatado(despesaCobranca) || 0,
        finalizado: true,
        observacoes: observacoesDia.trim() || null,
      };

      if (cobrancaDiaria?.id) {
        const { error } = await supabase
          .from('cobrancas_diarias')
          .update(cobrancaData)
          .eq('id', cobrancaDiaria.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cobrancas_diarias')
          .insert(cobrancaData);
        
        if (error) throw error;
      }
    },
  onSuccess: async () => {
      // Notificar admins sobre o fechamento
      try {
        const { data: admins } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');

        if (admins && admins.length > 0) {
          const adminIds = admins.map(a => a.user_id);
          const nomeRep = profile?.nome || 'Um representante';
          const dataFormatada = format(selectedDate, 'dd/MM/yyyy');

          // Construir mensagem com observação se existir
          const mensagemBase = `${nomeRep} finalizou o dia ${dataFormatada}`;
          const mensagemCompleta = observacoesDia.trim() 
            ? `${mensagemBase}\n\nObservação: ${observacoesDia.trim()}`
            : mensagemBase;

          // Inserir notificação para cada admin
          const notificacoes = adminIds.map(adminId => ({
            user_id: adminId,
            title: 'Fechamento Realizado',
            message: mensagemCompleta,
            type: 'success',
            link: '/dashboard-admin'
          }));

          await supabase.from('notifications').insert(notificacoes);

          // Enviar push para admins
          const pushBody = observacoesDia.trim()
            ? `${nomeRep} finalizou o dia ${dataFormatada} (com observação)`
            : `${nomeRep} finalizou o dia ${dataFormatada}`;

          await supabase.functions.invoke('send-push-notification', {
            body: {
              userIds: adminIds,
              title: 'Fechamento Realizado',
              body: pushBody
            }
          });
        }
      } catch (notifError) {
        console.error('Erro ao notificar admins:', notifError);
      }

      queryClient.invalidateQueries({ queryKey: ['cobranca-diaria'] });
      queryClient.invalidateQueries({ queryKey: ['historico-cobrancas'] });
      toast.success('Dia finalizado com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao finalizar dia: ${error.message}`);
    },
  });

  // Função para buscar nota por código ou nome de revendedora na agenda
  const handleBuscarNota = async () => {
    if (!codigoBusca.trim()) {
      setErroNota('Informe o código da nota ou nome da revendedora');
      return;
    }

    setBuscandoNota(true);
    setErroNota(null);
    setNotaEncontrada(null);

    try {
      const termoBusca = codigoBusca.trim().toLowerCase();
      
      // Verificar se já foi lançada hoje (por código - busca parcial)
      const notaJaLancada = notas.find(n => 
        n.codigo_nota.toLowerCase().includes(termoBusca) || 
        termoBusca.includes(n.codigo_nota.toLowerCase())
      );

      if (notaJaLancada) {
        setErroNota('Essa nota já foi lançada hoje');
        setBuscandoNota(false);
        return;
      }

      // Buscar por código primeiro (com busca parcial)
      const { data: porCodigo, error: erroCodigo } = await supabase
        .from('cobrancas_agendadas')
        .select('*')
        .eq('representante_id', user?.id)
        .ilike('codigo_nota', `%${codigoBusca.trim()}%`)
        .in('status', ['pendente', 'parcial', 'reagendado'])
        .order('data_agendada', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (erroCodigo) throw erroCodigo;

      if (porCodigo) {
        setNotaEncontrada(porCodigo);
        return;
      }

      // Se não encontrou por código, buscar por nome da revendedora
      const { data: porRevendedora, error: erroRevendedora } = await supabase
        .from('cobrancas_agendadas')
        .select('*')
        .eq('representante_id', user?.id)
        .ilike('revendedora', `%${codigoBusca.trim()}%`)
        .in('status', ['pendente', 'parcial', 'reagendado'])
        .order('data_agendada', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (erroRevendedora) throw erroRevendedora;

      if (porRevendedora) {
        // Verificar se essa nota já foi lançada hoje
        const jaLancadaRevendedora = notas.find(n => 
          n.codigo_nota.toLowerCase() === (porRevendedora.codigo_nota?.toLowerCase() || '')
        );
        
        if (jaLancadaRevendedora) {
          setErroNota('Essa nota já foi lançada hoje');
          return;
        }
        
        setNotaEncontrada(porRevendedora);
      } else {
        setErroNota('Nota não encontrada na sua agenda');
      }
    } catch (error: any) {
      setErroNota(`Erro ao buscar: ${error.message}`);
    } finally {
      setBuscandoNota(false);
    }
  };

  const resetBuscarNotaForm = () => {
    setCodigoBusca('');
    setNotaEncontrada(null);
    setErroNota(null);
  };

  const handleAbrirModalCobrar = () => {
    if (notaEncontrada) {
      setCobrancaParaPagar(notaEncontrada);
      setIsBuscarNotaDialogOpen(false);
    }
  };

  // Função para processar pagamento completo (igual à da Agenda)
  const handlePagamentoCompleto = async (dados: {
    valor_venda: number;
    comissao_percentual: number;
    comissao_valor: number;
    valor_devido_empresa: number;
    pagamentos: Array<{ forma: any; valor: number }>;
    tipo: 'completo' | 'devolucao';
    dataNota: string;
  }) => {
    if (!cobrancaParaPagar || !user?.id) return;

    const cobranca = cobrancaParaPagar;
    const codigoNota = cobranca.codigo_nota || `${cobranca.revendedora}-${format(new Date(), 'ddMMyyyyHHmmss')}`;
    
    // 1. Criar prestação de contas
    const { error: prestacaoError } = await supabase
      .from('prestacoes_contas')
      .insert({
        cobranca_id: cobranca.id,
        representante_id: user.id,
        revendedora: cobranca.revendedora || '',
        total_venda: dados.valor_venda,
        comissao_percentual: dados.comissao_percentual,
        comissao_valor: dados.comissao_valor,
        valor_devido_empresa: dados.valor_devido_empresa,
        valor_pago: dados.valor_devido_empresa,
        saldo_devedor: 0,
        forma_pagamento: dados.tipo === 'devolucao' ? 'dinheiro' : dados.pagamentos[0].forma,
        data_execucao: dados.dataNota,
        codigo_nota_referencia: codigoNota
      });

    if (prestacaoError) throw prestacaoError;

    // 2. Criar nota promissória para alimentar a Cobrança Diária
    const { error: notaError } = await supabase
      .from('notas_promissorias')
      .insert({
        representante_id: user.id,
        codigo_nota: codigoNota,
        cobranca_id: cobranca.id,
        data: dados.dataNota,
        valor_total: dados.tipo === 'devolucao' ? 0 : dados.valor_devido_empresa,
        forma_pagamento_1: dados.tipo === 'devolucao' ? 'dinheiro' : dados.pagamentos[0]?.forma || 'dinheiro',
        valor_pagamento_1: dados.tipo === 'devolucao' ? 0 : dados.pagamentos[0]?.valor || 0,
        forma_pagamento_2: dados.pagamentos[1]?.forma || null,
        valor_pagamento_2: dados.pagamentos[1]?.valor || null,
        devolveu_tudo: dados.tipo === 'devolucao'
      });

    if (notaError) throw notaError;

    // 3. Atualizar cobrança: status pago + acumulado correto
    const acumuladoAtual = (cobranca as any)?.valor_pago_acumulado || 0;
    const valorAdiantado = cobranca.valor_adiantado || 0;
    const novoAcumulado = acumuladoAtual + dados.valor_devido_empresa;
    const saldoAberto = cobranca.valor_previsto - novoAcumulado - valorAdiantado;
    
    const { error: updateError } = await supabase
      .from('cobrancas_agendadas')
      .update({ 
        status: (saldoAberto <= 0 ? 'pago' : 'parcial') as any,
        valor_pago_acumulado: novoAcumulado,
        data_quitacao: saldoAberto <= 0 ? dados.dataNota : null
      })
      .eq('id', cobranca.id);

    if (updateError) throw updateError;

    await queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
    await queryClient.invalidateQueries({ queryKey: ['notas-promissorias'] });
    await queryClient.invalidateQueries({ queryKey: ['notas-por-dia'] });
    
    setCobrancaParaPagar(null);
    resetBuscarNotaForm();
  };

  // Função para processar pagamento parcial - NOVA LÓGICA: abate saldo na mesma cobrança
  const handlePagamentoParcial = async (dados: {
    valor_venda: number;
    comissao_percentual: number;
    comissao_valor: number;
    valor_devido_empresa: number;
    valor_recebido: number;
    pagamentos: Array<{ forma: any; valor: number }>;
    valor_repasse: number;
    data_repasse: Date;
    dataNota: string;
  }) => {
    if (!cobrancaParaPagar || !user?.id) return;

    const cobranca = cobrancaParaPagar;
    const isRepasse = cobranca.tipo?.toLowerCase() === 'repasse';
    const codigoNota = cobranca.codigo_nota || `${cobranca.revendedora}-${format(new Date(), 'ddMMyyyyHHmmss')}`;
    
    // 1. Criar nota promissória para alimentar a Cobrança Diária (sempre criar, mesmo com valor 0)
    const notaData: any = {
      representante_id: user.id,
      codigo_nota: codigoNota,
      cobranca_id: cobranca.id,
      data: dados.dataNota,
      valor_total: dados.valor_recebido,
      forma_pagamento_1: dados.pagamentos[0]?.forma || 'dinheiro',
      valor_pagamento_1: dados.pagamentos[0]?.valor || 0,
      forma_pagamento_2: dados.pagamentos[1]?.forma || null,
      valor_pagamento_2: dados.pagamentos[1]?.valor || null
    };

    const { error: notaError } = await supabase
      .from('notas_promissorias')
      .insert(notaData);

    if (notaError) throw notaError;

    // 2. Para KIT: criar prestação de contas
    if (!isRepasse) {
      const { error: prestacaoError } = await supabase
        .from('prestacoes_contas')
        .insert({
          cobranca_id: cobranca.id,
          representante_id: user.id,
          revendedora: cobranca.revendedora || '',
          total_venda: dados.valor_venda,
          comissao_percentual: dados.comissao_percentual,
          comissao_valor: dados.comissao_valor,
          valor_devido_empresa: dados.valor_devido_empresa,
          valor_pago: dados.valor_recebido,
          saldo_devedor: dados.valor_repasse,
          forma_pagamento: dados.pagamentos[0]?.forma || 'dinheiro',
          data_execucao: dados.dataNota,
          codigo_nota_referencia: codigoNota
        });

      if (prestacaoError) throw prestacaoError;
    }

    // 3. Atualizar a MESMA cobrança - abater saldo (NÃO criar nova cobrança)
    const acumuladoAtual = (cobranca as any)?.valor_pago_acumulado || 0;
    const valorAdiantado = cobranca.valor_adiantado || 0;
    
    // Se é primeira cobrança de KIT, atualizar valor_previsto para o total devido à empresa
    let valorPrevistoEfetivo = cobranca.valor_previsto || 0;
    
    const updateData: any = {
      valor_pago_acumulado: acumuladoAtual + dados.valor_recebido,
    };
    
    if (acumuladoAtual === 0 && cobranca.tipo?.toLowerCase() !== 'repasse') {
      // Primeira cobrança: valor_previsto passa a ser o total devido à empresa
      valorPrevistoEfetivo = dados.valor_devido_empresa + dados.valor_recebido;
      updateData.valor_previsto = valorPrevistoEfetivo;
    }
    
    // Sempre atualizar data_agendada para a próxima data informada
    updateData.data_agendada = format(dados.data_repasse, 'yyyy-MM-dd');
    
    const novoAcumulado = acumuladoAtual + dados.valor_recebido;
    const saldoAberto = valorPrevistoEfetivo - novoAcumulado - valorAdiantado;
    
    const novoStatus = saldoAberto <= 0 ? 'pago' : 'parcial';
    updateData.status = novoStatus;
    
    if (novoStatus === 'pago') {
      updateData.data_quitacao = dados.dataNota;
    }

    const { error: updateError } = await supabase
      .from('cobrancas_agendadas')
      .update(updateData)
      .eq('id', cobranca.id);

    if (updateError) throw updateError;

    await queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
    await queryClient.invalidateQueries({ queryKey: ['notas-promissorias'] });
    await queryClient.invalidateQueries({ queryKey: ['notas-por-dia'] });
    
    setCobrancaParaPagar(null);
    resetBuscarNotaForm();
  };

  const handleFinalizarDia = () => {
    finalizarDiaMutation.mutate();
  };

  // Calcular totais
  const totalCobradoCalculado = notas.reduce((acc, nota) => acc + nota.valor_total, 0);

  const totaisPorFormaPagamento = notas.reduce(
    (acc, nota) => {
      acc[nota.forma_pagamento_1] = (acc[nota.forma_pagamento_1] || 0) + nota.valor_pagamento_1;
      if (nota.forma_pagamento_2 && nota.valor_pagamento_2) {
        acc[nota.forma_pagamento_2] = (acc[nota.forma_pagamento_2] || 0) + nota.valor_pagamento_2;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  const totalPixCalculado = totaisPorFormaPagamento['pix'] || 0;
  const totalDinheiroCalculado = totaisPorFormaPagamento['dinheiro'] || 0;
  const totalCartaoCalculado = totaisPorFormaPagamento['cartao'] || 0;

  const isDiaFinalizado = cobrancaDiaria?.finalizado === true;

  const handleOpenHistoricoDialog = (data: string) => {
    setSelectedHistoricoDate(data);
    setHistoricoDialogOpen(true);
  };

  return (
    <div className="space-y-4 md:space-y-6 max-w-full overflow-x-hidden">
      {/* Título com data */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground flex flex-wrap items-center gap-2">
            <span className="truncate">Fechamento do Dia</span>
            {isDiaFinalizado && (
              <Badge variant="default" className="text-xs sm:text-sm shrink-0">
                <Lock className="h-3 w-3 mr-1" />
                Finalizado
              </Badge>
            )}
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground">
            {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              <CalendarIcon className="mr-2 h-4 w-4" />
              Alterar Data
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Três blocos visuais */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-3">
        {/* Bloco Cobranças de Hoje */}
        <Card className="w-full max-w-full overflow-hidden">
          <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
              <span className="truncate">Cobranças de Hoje</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {loadingNotas ? (
              <div className="text-center py-4 text-muted-foreground text-sm">Carregando...</div>
            ) : notas.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Nenhuma cobrança registrada
              </div>
            ) : (
              <div className="space-y-2 max-h-[240px] sm:max-h-[280px] overflow-y-auto">
              {notas.map((nota) => {
                  // Resolver revendedora e código do pedido real
                  let revendedora: string | undefined;
                  let codigoPedido: string | undefined;

                  // 1. Tentar via cobranca_id (lookup reverso)
                  if (nota.cobranca_id && cobrancaIdMap[nota.cobranca_id]) {
                    const mapped = cobrancaIdMap[nota.cobranca_id];
                    revendedora = mapped.revendedora;
                    codigoPedido = mapped.codigo_nota;
                  }
                  // 2. Tentar via revendedoraMap (código curto direto)
                  else if (revendedoraMap[nota.codigo_nota]) {
                    revendedora = revendedoraMap[nota.codigo_nota];
                    codigoPedido = nota.codigo_nota;
                  }
                  // 3. Código gerado com formato NOME-14digitos
                  else if (nota.codigo_nota) {
                    const match = nota.codigo_nota.match(/^(.+?)-\d{14}$/);
                    if (match) {
                      revendedora = match[1];
                      codigoPedido = undefined; // sem código real
                    } else {
                      codigoPedido = nota.codigo_nota;
                    }
                  }

                  // Usar a coluna devolveu_tudo para identificar devoluções, não apenas valor zero
                  const isDevolveuTudo = nota.devolveu_tudo === true;
                  return (
                    <div key={nota.id} className={cn(
                      "p-2 rounded-lg text-xs sm:text-sm space-y-1",
                      isDevolveuTudo ? "bg-orange-100 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800" : "bg-muted/50"
                    )}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1 overflow-hidden">
                          {revendedora && (
                            <p className="font-medium text-foreground truncate max-w-[140px] sm:max-w-none">{revendedora}</p>
                          )}
                          {codigoPedido ? (
                            <p className="text-[10px] sm:text-xs text-muted-foreground font-mono truncate">Nota {codigoPedido}</p>
                          ) : (
                            <p className="text-[10px] sm:text-xs text-muted-foreground font-mono truncate">—</p>
                          )}
                          {isDevolveuTudo && (
                            <p className="text-[10px] sm:text-xs text-orange-600 dark:text-orange-400 font-medium mt-0.5">Devolveu tudo</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                          <span className={cn(
                            "font-semibold text-xs sm:text-sm whitespace-nowrap",
                            isDevolveuTudo ? "text-orange-600 dark:text-orange-400" : nota.valor_total === 0 ? "text-muted-foreground" : "text-primary"
                          )}>
                            {formatarValor(nota.valor_total)}
                          </span>
                          {!isDiaFinalizado && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-5 w-5 sm:h-6 sm:w-6 p-0 shrink-0">
                                  <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir da Cobrança de Hoje</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    A nota <strong className="break-all">{nota.codigo_nota}</strong> será removida da cobrança de hoje e voltará para a <strong>Agenda de Cobrança</strong> como pendente.
                                    <br /><br />
                                    A nota NÃO será apagada do sistema.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                  <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => excluirNotaDaCobrancaMutation.mutate(nota)}
                                    disabled={excluirNotaDaCobrancaMutation.isPending}
                                    className="w-full sm:w-auto"
                                  >
                                    {excluirNotaDaCobrancaMutation.isPending ? 'Removendo...' : 'Confirmar'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t flex justify-between items-center">
              <span className="text-xs sm:text-sm text-muted-foreground">{notas.length} notas</span>
              <span className="font-bold text-primary text-sm sm:text-base">{formatarValor(totalCobradoCalculado)}</span>
            </div>
            {!isDiaFinalizado && (
              <Dialog open={isBuscarNotaDialogOpen} onOpenChange={(open) => {
                setIsBuscarNotaDialogOpen(open);
                if (!open) resetBuscarNotaForm();
              }}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-3"
                  >
                    <Search className="h-4 w-4 mr-1" />
                    Buscar Nota
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Buscar Nota na Agenda</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="codigo_busca">Código ou Nome da Revendedora</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          id="codigo_busca"
                          value={codigoBusca}
                          onChange={(e) => setCodigoBusca(e.target.value)}
                          placeholder="Ex: KIT-001 ou Maria"
                          onKeyDown={(e) => e.key === 'Enter' && handleBuscarNota()}
                        />
                        <Button 
                          onClick={handleBuscarNota} 
                          disabled={buscandoNota || !codigoBusca.trim()}
                        >
                          {buscandoNota ? 'Buscando...' : 'Buscar'}
                        </Button>
                      </div>
                    </div>

                    {erroNota && (
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                        {erroNota}
                      </div>
                    )}

                    {notaEncontrada && (
                      <div className="p-4 bg-muted rounded-lg space-y-3">
                        <h4 className="font-semibold text-foreground">Nota Encontrada</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Revendedora:</span>
                            <span className="font-medium">{notaEncontrada.revendedora}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tipo:</span>
                            <Badge variant="secondary">
                              {notaEncontrada.tipo?.toLowerCase() === 'repasse' ? 'Repasse' : 'Kit'}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Valor:</span>
                            <span className="font-semibold text-primary">
                              {formatarValor(
                                (notaEncontrada as any).valor_pago_acumulado > 0 || notaEncontrada.status === 'parcial'
                                  ? Math.max(0, notaEncontrada.valor_previsto - ((notaEncontrada as any).valor_pago_acumulado || 0) - (notaEncontrada.valor_adiantado || 0))
                                  : notaEncontrada.valor_previsto
                              )}
                            </span>
                          </div>
                          {(notaEncontrada as any).valor_pago_acumulado > 0 && (
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Já pago:</span>
                              <span>{formatarValor((notaEncontrada as any).valor_pago_acumulado)}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Vencimento:</span>
                            <span>{format(new Date(notaEncontrada.data_agendada + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge variant="outline">{notaEncontrada.status}</Badge>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button 
                            className="flex-1" 
                            onClick={handleAbrirModalCobrar}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Cobrar
                          </Button>
                          {notaEncontrada.tipo === 'kit' && (
                            <Button
                              variant="outline"
                              className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                              onClick={handleAcrescimoFromBusca}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Joias adicionais
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsBuscarNotaDialogOpen(false)}>
                      Cancelar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        {/* Bloco Entregas de Kits */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" />
              Entregas de Kits
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entregasDoDia.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Nenhuma entrega hoje
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {entregasDoDia.map((entrega: any) => {
                  const kitAcrescimos = acrescimosMap[entrega.id] || [];
                  return (
                    <div key={entrega.id} className="p-2 bg-muted/50 rounded-lg text-sm space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-medium">{entrega.codigo_nota}</span>
                        {!isDiaFinalizado && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                              title="Registrar joias adicionais"
                              onClick={() => {
                                setCobrancaParaAcrescimo({
                                  id: entrega.id,
                                  kit_entregue_id: entrega.id,
                                  revendedora: entrega.revendedora,
                                  codigo_nota: entrega.codigo_nota,
                                  representante_id: user?.id || '',
                                  data_agendada: '',
                                  valor_previsto: 0,
                                  status: 'pendente',
                                } as any);
                                setModalAcrescimoOpen(true);
                              }}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Entrega</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir esta entrega? O kit {entrega.codigo_nota} voltará para sua posse.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => excluirEntregaMutation.mutate({ 
                                      id: entrega.id, 
                                      codigo_nota: entrega.codigo_nota 
                                    })}
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{entrega.revendedora}</p>
                      <div className="flex items-center gap-1 text-xs">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span>Kit: {formatarValor(entrega.valor_previsto)}</span>
                      </div>
                      {kitAcrescimos.map((acrescimo: any) => (
                        <div key={acrescimo.id} className="flex items-center gap-1.5 text-xs pl-1">
                          <Badge variant="warning" className="text-[10px] px-1.5 py-0">ACRÉSCIMO</Badge>
                          <span className="truncate">{acrescimo.descricao || 'Joias adicionais'}</span>
                          <span className="font-medium ml-auto whitespace-nowrap">{formatarValor(acrescimo.valor)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3 pt-3 border-t">
              <span className="text-sm text-muted-foreground">{entregasDoDia.length} entregas</span>
            </div>
            {!isDiaFinalizado && (
              <Dialog open={isKitEntregaDialogOpen} onOpenChange={setIsKitEntregaDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-3"
                    onClick={resetKitEntregaForm}
                    disabled={kitsEstoque.length === 0}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Entregar Kit ({kitsEstoque.length})
                  </Button>
                </DialogTrigger>
                <DialogContent className="overflow-visible">
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
                      <RevendedoraSearchSelect
                        representanteId={user?.id || ''}
                        value={revendedoraKit}
                        onSelect={(nome) => setRevendedoraKit(nome)}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="vincular-vendedora"
                        checked={vincularVendedora}
                        onChange={(e) => setVincularVendedora(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="vincular-vendedora" className="cursor-pointer">
                        Vincular a uma vendedora
                      </Label>
                    </div>

                    {vincularVendedora && (
                      <div className="space-y-2">
                        <Label>Vendedora / Recrutadora</Label>
                        <Select
                          value={vendedoraId}
                          onValueChange={setVendedoraId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a vendedora" />
                          </SelectTrigger>
                          <SelectContent>
                            {vendedoras.map((vendedora) => (
                              <SelectItem key={vendedora.id} value={vendedora.id}>
                                {vendedora.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label>Data de Vencimento</Label>
                      <Input
                        type="date"
                        value={dataVencimentoKit}
                        onChange={(e) => setDataVencimentoKit(e.target.value)}
                        className="w-full"
                      />
                    </div>

                    {/* Seção de Joias Adicionais */}
                    <div className="border-t pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Joias Adicionais (opcional)</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAcrescimosKit([...acrescimosKit, { valor: '', observacao: '' }])}
                          className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Adicionar
                        </Button>
                      </div>
                      {acrescimosKit.map((acrescimo, index) => (
                        <div key={index} className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Acréscimo {index + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setAcrescimosKit(acrescimosKit.filter((_, i) => i !== index))}
                              className="h-6 w-6 p-0 text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                            <Input
                              className="pl-10"
                              value={acrescimo.valor}
                              onChange={(e) => {
                                const novos = [...acrescimosKit];
                                novos[index].valor = formatarValorInput(e.target.value);
                                setAcrescimosKit(novos);
                              }}
                              placeholder="0,00"
                            />
                          </div>
                          <Input
                            value={acrescimo.observacao}
                            onChange={(e) => {
                              const novos = [...acrescimosKit];
                              novos[index].observacao = e.target.value;
                              setAcrescimosKit(novos);
                            }}
                            placeholder="Observação (ex: brincos extras)"
                          />
                        </div>
                      ))}
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
            )}
          </CardContent>
        </Card>

        {/* Bloco Despesas do Dia */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wallet className="h-5 w-5 text-primary" />
              Despesas do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="despesa_cobranca" className="text-sm">Valor da Despesa</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="despesa_cobranca"
                    type="text"
                    value={despesaCobranca}
                    onChange={(e) => handleValorChange(e.target.value, setDespesaCobranca)}
                    placeholder="0,00"
                    className="pl-10"
                    disabled={isDiaFinalizado}
                  />
                </div>
              </div>
              
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">PIX</span>
                  <span className="font-medium">{formatarValor(totalPixCalculado)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dinheiro</span>
                  <span className="font-medium">{formatarValor(totalDinheiroCalculado)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cartão</span>
                  <span className="font-medium">{formatarValor(totalCartaoCalculado)}</span>
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Saldo Final</span>
                  <span className="text-xl font-bold text-primary">
                    {formatarValor(totalCobradoCalculado - parseValorFormatado(despesaCobranca))}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card de Observações - antes do botão de finalizar */}
      {!isDiaFinalizado && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
              Observações do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Deixe aqui alguma observação ou recado para o administrador (opcional)..."
              value={observacoesDia}
              onChange={(e) => setObservacoesDia(e.target.value)}
              className="min-h-[100px] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-2 text-right">
              {observacoesDia.length}/500 caracteres
            </p>
          </CardContent>
        </Card>
      )}

      {/* Botão grande de confirmar fechamento */}
      {!isDiaFinalizado && (() => {
        const hoje = getLocalDateString(new Date());
        const ontem = getLocalDateString(new Date(new Date().setDate(new Date().getDate() - 1)));
        const podeFinalizar = dateStr === hoje || dateStr === ontem;
        
        return podeFinalizar ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="lg" className="w-full h-14 text-lg">
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Confirmar Fechamento do Dia
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Fechamento</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja finalizar o dia? Após finalizar, não será possível editar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleFinalizarDia}>
                  Confirmar Finalização
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Card className="p-4 text-center border-yellow-500/50 bg-yellow-500/5">
            <p className="text-sm text-muted-foreground">
              <Lock className="h-4 w-4 inline mr-1" />
              Você só pode finalizar o dia atual ou o dia anterior. Para corrigir dias passados, solicite ao administrador.
            </p>
          </Card>
        );
      })()}

      {/* Modal de Receber Cobrança */}
      {cobrancaParaPagar && (
        <ModalReceberCobranca
          open={!!cobrancaParaPagar}
          onOpenChange={(open) => {
            if (!open) {
              setCobrancaParaPagar(null);
            }
          }}
          cobranca={{
            id: cobrancaParaPagar.id,
            revendedora: cobrancaParaPagar.revendedora,
            valor_previsto: cobrancaParaPagar.valor_previsto,
            tipo: cobrancaParaPagar.tipo,
            valor_adiantado: cobrancaParaPagar.valor_adiantado
          }}
          valor_pago_acumulado={(cobrancaParaPagar as any)?.valor_pago_acumulado || 0}
          diasNaoFinalizados={diasNaoFinalizados}
          onPagamentoCompleto={handlePagamentoCompleto}
          onPagamentoParcial={handlePagamentoParcial}
        />
      )}

      {/* Modal de Acréscimo */}
      {cobrancaParaAcrescimo && cobrancaParaAcrescimo.kit_entregue_id && (
        <ModalRegistrarAcrescimo
          open={modalAcrescimoOpen}
          onOpenChange={(open) => {
            setModalAcrescimoOpen(open);
            if (!open) setCobrancaParaAcrescimo(null);
          }}
          kitEntregueId={cobrancaParaAcrescimo.kit_entregue_id}
          revendedora={cobrancaParaAcrescimo.revendedora}
          codigoKit={cobrancaParaAcrescimo.codigo_nota || ''}
        />
      )}

      {/* Histórico de Fechamentos - Colapsável */}
      {historico.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none">
            <Card className="group-open:rounded-b-none">
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="text-base font-medium">Ver histórico de fechamentos anteriores</CardTitle>
                <Badge variant="secondary">{historico.length} registros</Badge>
              </CardHeader>
            </Card>
          </summary>
          <Card className="rounded-t-none border-t-0">
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Total Cobrado</TableHead>
                      <TableHead className="text-right">Despesas</TableHead>
                      <TableHead className="text-right">Qtd Notas</TableHead>
                      <TableHead className="text-right">Saldo do Dia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((cobranca) => {
                      const qtdNotas = notasPorDia[cobranca.data] || 0;
                      const saldo = cobranca.total_cobrado - (cobranca.despesa_cobranca || 0);
                      
                      return (
                        <TableRow 
                          key={cobranca.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleOpenHistoricoDialog(cobranca.data)}
                        >
                          <TableCell className="font-medium">
                            {format(new Date(cobranca.data + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatarValor(cobranca.total_cobrado)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatarValor(cobranca.despesa_cobranca || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="font-semibold">
                              {formatarNumero(qtdNotas)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-foreground">
                            {formatarValor(saldo)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </details>
      )}

      {/* Dialog de Detalhes do Histórico */}
      <Dialog open={historicoDialogOpen} onOpenChange={setHistoricoDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalhes da Cobrança - {selectedHistoricoDate && format(new Date(selectedHistoricoDate + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          
          {loadingNotasHistorico ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : notasHistorico.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma nota encontrada para esta data
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Forma Pag. 1</TableHead>
                      <TableHead>Valor Pag. 1</TableHead>
                      <TableHead>Forma Pag. 2</TableHead>
                      <TableHead>Valor Pag. 2</TableHead>
                      <TableHead>Horário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notasHistorico.map((nota) => (
                      <TableRow key={nota.id}>
                        <TableCell className="font-medium">
                          {nota.codigo_nota}
                          {nota.devolveu_tudo && (
                            <Badge variant="outline" className="ml-2 text-xs bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700">
                              Devolveu Tudo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className={nota.devolveu_tudo ? 'text-orange-600 dark:text-orange-400' : nota.valor_total === 0 ? 'text-muted-foreground' : 'font-semibold'}>
                          {formatarValor(nota.valor_total)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {formaPagamentoLabels[nota.forma_pagamento_1]}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatarValor(nota.valor_pagamento_1)}</TableCell>
                        <TableCell>
                          {nota.forma_pagamento_2 ? (
                            <Badge variant="secondary">
                              {formaPagamentoLabels[nota.forma_pagamento_2]}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {nota.valor_pagamento_2 ? formatarValor(nota.valor_pagamento_2) : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {nota.criado_em ? format(new Date(nota.criado_em), 'HH:mm', { locale: ptBR }) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Resumo do dia */}
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-foreground mb-3">Resumo do Dia</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Notas</p>
                    <p className="text-lg font-bold">{notasHistorico.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Cobrado</p>
                    <p className="text-lg font-bold">
                      {formatarValor(notasHistorico.reduce((acc, n) => acc + n.valor_total, 0))}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoricoDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
