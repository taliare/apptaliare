import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, Search, Package, Phone, Trophy, Users, X, MessageCircle, User as UserIcon, Filter, Plus } from 'lucide-react';
import { RevendedoraFormDialog } from '@/components/revendedoras/RevendedoraFormDialog';
import { PerfilRevendedoraDialog } from '@/components/revendedoras/PerfilRevendedoraDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatusRevendedoraBadge } from '@/components/revendedoras/StatusRevendedoraBadge';
import { calcularStatusRevendedora } from '@/lib/revendedoraStatus';
import { useFotoUrl } from '@/hooks/useFotoUrl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, addDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarValor, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RevendedoraInativa {
  nome: string;
  ultimaVendaData: string;
  ultimaVendaValor: number;
  revendedora_id: string | null;
  whatsapp: string | null;
  foto_url: string | null;
}

interface RevendedoraAtiva {
  nome: string;
  whatsapp: string | null;
  revendedora_id: string | null;
  foto_url: string | null;
  status_juridico: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cobrancas: any[];
  saldoTotal: number;
  temApuracao: boolean;
}

function buildWaUrl(numero: string | null): string | null {
  if (!numero) return null;
  const d = numero.replace(/\D/g, '');
  if (!d) return null;
  return `https://wa.me/${d.startsWith('55') ? d : '55' + d}`;
}

function buildMapsUrlEndereco(r: { cep: string | null; logradouro: string | null; numero: string | null; bairro: string | null; cidade: string | null; estado: string | null }): string | null {
  if (!r.cep && !r.logradouro) return null;
  const parts = [r.logradouro, r.numero, r.bairro, r.cidade, r.estado].filter(Boolean).join(' ');
  const q = parts || r.cep || '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function calcularNivel(ticketMedio: number) {
  if (ticketMedio >= 2000) return { nivel: 'Elite', cor: 'purple' };
  if (ticketMedio >= 1000) return { nivel: 'Destaque', cor: 'orange' };
  if (ticketMedio >= 300) return { nivel: 'Ativa', cor: 'blue' };
  return { nivel: 'Inicial', cor: 'gray' };
}

const nivelBadgeVariant = (cor: string) => {
  switch (cor) {
    case 'purple': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'orange': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'blue': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    default: return 'bg-muted text-muted-foreground';
  }
};

function RevendedoraAvatar({ path, nome }: { path: string | null; nome: string }) {
  const url = useFotoUrl(path);
  const initials = nome.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('');
  return (
    <Avatar className="h-10 w-10">
      {url && <AvatarImage src={url} alt={nome} />}
      <AvatarFallback className="text-xs">{initials || '?'}</AvatarFallback>
    </Avatar>
  );
}

type StatusChipKey =
  | 'todas'
  | 'ativa'
  | 'pagando'
  | 'quite'
  | 'em_atraso'
  | 'inadimplente'
  | 'juridico_solicitado'
  | 'juridico_aprovado'
  | 'inativa';

const STATUS_CHIPS: { value: StatusChipKey; label: string; emoji?: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'ativa', label: 'Ativa', emoji: '🟢' },
  { value: 'pagando', label: 'Pagando', emoji: '🔵' },
  { value: 'quite', label: 'Quite', emoji: '✅' },
  { value: 'em_atraso', label: 'Em Atraso', emoji: '⚠️' },
  { value: 'inadimplente', label: 'Inadimplente', emoji: '🔴' },
  { value: 'juridico_solicitado', label: 'Sol. Jurídico', emoji: '⚖️' },
  { value: 'juridico_aprovado', label: 'Jurídico', emoji: '⛔' },
  { value: 'inativa', label: 'Inativa', emoji: '💤' },
];

function ListagemUnificada({
  ativas, inativas, loading, searchTerm,
  editandoWhatsApp, whatsAppTemp, setWhatsAppTemp, setEditandoWhatsApp,
  handleEditWhatsApp, handleSaveWhatsApp, setPerfilAberto, handleOpenReativar,
  kitsDisponiveisLen, onNovaRevendedora,
}: {
  ativas: RevendedoraAtiva[];
  inativas: RevendedoraInativa[];
  loading: boolean;
  searchTerm: string;
  editandoWhatsApp: string | null;
  whatsAppTemp: string;
  setWhatsAppTemp: (v: string) => void;
  setEditandoWhatsApp: (v: string | null) => void;
  handleEditWhatsApp: (nome: string, whatsappAtual: string | null) => void;
  handleSaveWhatsApp: (revendedora_id: string | null) => void;
  setPerfilAberto: (sel: { nome: string; id: string | null }) => void;
  handleOpenReativar: (rev: RevendedoraInativa) => void;
  kitsDisponiveisLen: number;
  onNovaRevendedora: () => void;
}) {
  const [statusFiltro, setStatusFiltro] = useState<StatusChipKey>('todas');

  type Item =
    | { kind: 'ativa'; nome: string; statusKey: string; rev: RevendedoraAtiva; statusInfo: ReturnType<typeof calcularStatusRevendedora> }
    | { kind: 'inativa'; nome: string; statusKey: 'inativa'; rev: RevendedoraInativa };

  const itens = useMemo<Item[]>(() => {
    const ativasItens: Item[] = ativas.map((rev) => {
      const statusInfo = calcularStatusRevendedora(
        { status_juridico: rev.status_juridico },
        rev.cobrancas.map((c: any) => ({ status: c.status, data_agendada: c.data_agendada }))
      );
      return { kind: 'ativa' as const, nome: rev.nome, statusKey: statusInfo.key, rev, statusInfo };
    });
    const inativasItens: Item[] = inativas.map((r) => ({
      kind: 'inativa' as const, nome: r.nome, statusKey: 'inativa' as const, rev: r,
    }));
    return [...ativasItens, ...inativasItens].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [ativas, inativas]);

  const contagens = useMemo(() => {
    const c: Partial<Record<StatusChipKey, number>> = { todas: itens.length };
    itens.forEach((i) => {
      const k = i.statusKey as StatusChipKey;
      c[k] = (c[k] ?? 0) + 1;
    });
    return c;
  }, [itens]);

  const itensFiltrados = useMemo(() => {
    if (statusFiltro === 'todas') return itens;
    return itens.filter((i) => i.statusKey === statusFiltro);
  }, [itens, statusFiltro]);

  return (
    <div className="space-y-4">
      {/* Total + botão de filtro */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {itensFiltrados.length} revendedora{itensFiltrados.length !== 1 ? 's' : ''}
          {statusFiltro !== 'todas' && (
            <span className="ml-1 opacity-70">de {itens.length}</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filtrar
                {statusFiltro !== 'todas' && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">1</Badge>
                )}
              </Button>
            </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-2">
            <div className="flex flex-col gap-1">
              <p className="text-[11px] uppercase text-muted-foreground px-2 py-1">Status</p>
              {STATUS_CHIPS.map((chip) => {
                const active = statusFiltro === chip.value;
                const count = contagens[chip.value] ?? 0;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setStatusFiltro(chip.value)}
                    className={cn(
                      'flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-left transition-colors',
                      active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                    )}
                  >
                    <span>
                      {chip.emoji && <span className="mr-1">{chip.emoji}</span>}
                      {chip.label}
                    </span>
                    <span className="opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
          </Popover>
          <Button size="sm" className="gap-2" onClick={onNovaRevendedora}>
            <Plus className="h-4 w-4" />
            Nova Revendedora
          </Button>
        </div>
      </div>


      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : itensFiltrados.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          {searchTerm ? 'Nenhuma revendedora encontrada' : 'Nenhuma revendedora nesse filtro'}
        </CardContent></Card>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {itensFiltrados.map((item) => {
              if (item.kind === 'inativa') {
                const waUrl = buildWaUrl(item.rev.whatsapp);
                return (
                  <li key={`inativa-${item.nome}`} className="px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-accent/40 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <RevendedoraAvatar path={item.rev.foto_url} nome={item.nome} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{item.nome}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          Última venda: {format(new Date(item.rev.ultimaVendaData + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })} • {formatarValor(item.rev.ultimaVendaValor)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="secondary" className="gap-1">💤 Inativa</Badge>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {waUrl && (
                        <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-emerald-600 hover:text-emerald-700" title="Abrir WhatsApp">
                          <a href={waUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /></a>
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => setPerfilAberto({ nome: item.nome, id: item.rev.revendedora_id })}>
                        <UserIcon className="h-3.5 w-3.5" />
                        Ver Perfil
                      </Button>
                    </div>

                  </li>
                );
              }
              const { rev, statusInfo } = item;
              const waUrl = buildWaUrl(rev.whatsapp);
              return (
                <li key={`ativa-${rev.nome}`} className="px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <RevendedoraAvatar path={rev.foto_url} nome={rev.nome} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-sm truncate">{rev.nome}</p>
                        {rev.status_juridico === 'aprovado' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-700 border border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800">
                            Jurídico
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {rev.cobrancas.length} cobrança{rev.cobrancas.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusRevendedoraBadge status={statusInfo} />
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {waUrl ? (
                      <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-emerald-600 hover:text-emerald-700" title="Abrir WhatsApp">
                        <a href={waUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /></a>
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-9 w-9 opacity-60" title="Adicionar WhatsApp" onClick={() => handleEditWhatsApp(rev.nome, rev.whatsapp)}>
                        <Phone className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setPerfilAberto({ nome: rev.nome, id: rev.revendedora_id })}>
                      <UserIcon className="h-3.5 w-3.5" />
                      Ver Perfil
                    </Button>
                  </div>

                  {editandoWhatsApp === rev.nome && (
                    <div className="flex items-center gap-1 w-full sm:w-auto">
                      <Input value={whatsAppTemp} onChange={(e) => setWhatsAppTemp(e.target.value)} placeholder="Ex: 92999998888" className="h-8 text-xs flex-1 sm:w-48" />
                      <Button size="sm" className="h-8 px-2 text-xs" onClick={() => handleSaveWhatsApp(rev.revendedora_id)}>Salvar</Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditandoWhatsApp(null)}><X className="h-3 w-3" /></Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

export default function RevendedorasInativas() {

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [novaRevOpen, setNovaRevOpen] = useState(false);
  const [reativarDialogOpen, setReativarDialogOpen] = useState(false);
  const [selectedRevendedora, setSelectedRevendedora] = useState<RevendedoraInativa | null>(null);
  const [selectedKit, setSelectedKit] = useState('');
  const [dataVencimento, setDataVencimento] = useState<Date>(addDays(new Date(), 60));
  const [periodoRanking, setPeriodoRanking] = useState<'mensal' | 'trimestral' | 'total'>('total');
  const [perfilAberto, setPerfilAberto] = useState<{ nome: string; id: string | null } | null>(null);
  const [editandoWhatsApp, setEditandoWhatsApp] = useState<string | null>(null);
  const [whatsAppTemp, setWhatsAppTemp] = useState('');

  // ==================== QUERIES ====================

  // Kits disponíveis
  const { data: kitsDisponiveis = [] } = useQuery({
    queryKey: ['kits-disponiveis-reativar', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kits_estoque')
        .select('id, codigo, tipo, valor')
        .eq('representante_id', user!.id)
        .eq('status', 'com_representante');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Revendedoras ativas (com cobranças abertas)
  const { data: revendedorasAtivas = [], isLoading: loadingAtivas } = useQuery({
    queryKey: ['minhas-revendedoras-ativas', user?.id],
    queryFn: async () => {
      const { data: cobrancas, error } = await supabase
        .from('cobrancas_agendadas')
        .select('id, revendedora, valor_previsto, valor_pago_acumulado, valor_adiantado, data_agendada, status, codigo_nota, tipo')
        .eq('representante_id', user!.id)
        .eq('vigente', true)
        .in('status', ['pendente', 'parcial'])
        .order('revendedora');
      if (error) throw error;

      const nomes = [...new Set(cobrancas?.map(c => c.revendedora) || [])];
      let cadastroMap = new Map<string, any>();
      if (nomes.length > 0) {
        const { data: cadastros } = await supabase
          .from('revendedoras')
          .select('id, nome, whatsapp, ativo, foto_url, status_juridico, cep, logradouro, numero, bairro, cidade, estado')
          .eq('representante_id', user!.id)
          .in('nome', nomes);
        cadastroMap = new Map(cadastros?.map(c => [c.nome.toUpperCase(), c]) || []);
      }

      // Buscar prestações APENAS das cobranças ativas
      const cobrancaIds = cobrancas?.map(c => c.id) || [];
      let prestacaoMap = new Map<string, boolean>();

      if (cobrancaIds.length > 0) {
        const { data: prestacoes } = await supabase
          .from('prestacoes_contas')
          .select('cobranca_id')
          .in('cobranca_id', cobrancaIds);
        
        prestacoes?.forEach(p => {
          if (p.cobranca_id) prestacaoMap.set(p.cobranca_id, true);
        });
      }

      const map = new Map<string, RevendedoraAtiva>();
      cobrancas?.forEach(c => {
        const nome = c.revendedora;
        const tipoJaApurado = ['repasse', 'acrescimo'].includes((c.tipo || '').toLowerCase());
        const jaApurada = prestacaoMap.has(c.id) || tipoJaApurado;
        const saldo = jaApurada
          ? Math.max(0, c.valor_previsto - (c.valor_pago_acumulado || 0) - (c.valor_adiantado || 0))
          : 0;
        if (!map.has(nome)) {
          const cadastro = cadastroMap.get(nome.toUpperCase());
          map.set(nome, {
            nome,
            whatsapp: cadastro?.whatsapp || null,
            revendedora_id: cadastro?.id || null,
            foto_url: cadastro?.foto_url || null,
            status_juridico: cadastro?.status_juridico || null,
            cep: cadastro?.cep || null,
            logradouro: cadastro?.logradouro || null,
            numero: cadastro?.numero || null,
            bairro: cadastro?.bairro || null,
            cidade: cadastro?.cidade || null,
            estado: cadastro?.estado || null,
            cobrancas: [],
            saldoTotal: 0,
            temApuracao: false,
          });
        }
        const entry = map.get(nome)!;
        entry.cobrancas.push(c);
        entry.saldoTotal += saldo;
        if (jaApurada) entry.temApuracao = true;
      });

      return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    },
    enabled: !!user?.id,
  });

  // Revendedoras inativas
  const { data: revendedorasInativas = [], isLoading: loadingInativas } = useQuery({
    queryKey: ['revendedoras-inativas', user?.id],
    queryFn: async () => {
      const { data: prestacoesPassadas, error: prestError } = await supabase
        .from('prestacoes_contas')
        .select('revendedora, data_execucao, total_venda')
        .eq('representante_id', user!.id)
        .order('data_execucao', { ascending: false });
      if (prestError) throw prestError;

      const { data: cobrancasAbertas, error: cobError } = await supabase
        .from('cobrancas_agendadas')
        .select('revendedora')
        .eq('representante_id', user!.id)
        .eq('vigente', true)
        .in('status', ['pendente', 'parcial']);
      if (cobError) throw cobError;

      const { data: repassesPendentes, error: repError } = await supabase
        .from('repasses')
        .select('cobranca_id')
        .eq('status', 'agendado');
      if (repError) throw repError;

      const repasseCobrancaIds = repassesPendentes?.map(r => r.cobranca_id) || [];
      let revendedorasComRepasse: string[] = [];
      if (repasseCobrancaIds.length > 0) {
        const { data: cobrancasRepasse } = await supabase
          .from('cobrancas_agendadas')
          .select('revendedora')
          .eq('representante_id', user!.id)
          .eq('vigente', true)
          .in('id', repasseCobrancaIds);
        revendedorasComRepasse = cobrancasRepasse?.map(c => c.revendedora) || [];
      }

      const revendedorasAtivasSet = new Set([
        ...cobrancasAbertas?.map(c => c.revendedora) || [],
        ...revendedorasComRepasse,
      ]);

      const ultimaPrestacaoPorRevendedora = new Map<string, { data: string; valor: number }>();
      prestacoesPassadas?.forEach(p => {
        if (!ultimaPrestacaoPorRevendedora.has(p.revendedora)) {
          ultimaPrestacaoPorRevendedora.set(p.revendedora, { data: p.data_execucao, valor: p.total_venda });
        }
      });

      const nomesInativas: string[] = [];
      ultimaPrestacaoPorRevendedora.forEach((_info, nome) => {
        if (!revendedorasAtivasSet.has(nome)) nomesInativas.push(nome);
      });

      let cadastroMap = new Map<string, { id: string; whatsapp: string | null; foto_url: string | null }>();
      if (nomesInativas.length > 0) {
        const { data: cadastros } = await supabase
          .from('revendedoras')
          .select('id, nome, whatsapp, foto_url')
          .eq('representante_id', user!.id)
          .in('nome', nomesInativas);
        cadastroMap = new Map(cadastros?.map((c: any) => [c.nome, { id: c.id, whatsapp: c.whatsapp, foto_url: c.foto_url }]) || []);
      }

      const inativas: RevendedoraInativa[] = nomesInativas.map((nome) => {
        const info = ultimaPrestacaoPorRevendedora.get(nome)!;
        const cad = cadastroMap.get(nome);
        return {
          nome,
          ultimaVendaData: info.data,
          ultimaVendaValor: info.valor,
          revendedora_id: cad?.id ?? null,
          whatsapp: cad?.whatsapp ?? null,
          foto_url: cad?.foto_url ?? null,
        };
      });

      return inativas.sort((a, b) => new Date(b.ultimaVendaData).getTime() - new Date(a.ultimaVendaData).getTime());
    },
    enabled: !!user?.id,
  });

  // Ranking prestações
  const { data: prestacoesRanking = [], isLoading: loadingRanking } = useQuery({
    queryKey: ['ranking-minhas-revendedoras', user?.id, periodoRanking],
    queryFn: async () => {
      let query = supabase
        .from('prestacoes_contas')
        .select('revendedora, cobranca_id, total_venda, comissao_percentual, comissao_valor, valor_devido_empresa, valor_pago, data_execucao')
        .eq('representante_id', user!.id)
        .gt('total_venda', 0);

      if (periodoRanking === 'mensal') {
        query = query
          .gte('data_execucao', format(startOfMonth(new Date()), 'yyyy-MM-dd'))
          .lte('data_execucao', format(endOfMonth(new Date()), 'yyyy-MM-dd'));
      } else if (periodoRanking === 'trimestral') {
        query = query.gte('data_execucao', format(subMonths(new Date(), 3), 'yyyy-MM-dd'));
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Perfil prestações
  const { data: prestacoesPerfil = [] } = useQuery({
    queryKey: ['perfil-revendedora-prestacoes', user?.id, perfilAberto?.nome],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prestacoes_contas')
        .select('cobranca_id, revendedora, total_venda, comissao_percentual, comissao_valor, valor_devido_empresa, valor_pago, saldo_devedor, data_execucao')
        .eq('representante_id', user!.id)
        .eq('revendedora', perfilAberto!.nome)
        .order('data_execucao', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!perfilAberto,
  });

  // ==================== MEMOS ====================

  // Filtro de busca compartilhado
  const ativasFiltradas = useMemo(() => {
    if (!searchTerm) return revendedorasAtivas;
    const t = searchTerm.toLowerCase();
    return revendedorasAtivas.filter(r => r.nome.toLowerCase().includes(t));
  }, [revendedorasAtivas, searchTerm]);

  const inativasFiltradas = useMemo(() => {
    if (!searchTerm) return revendedorasInativas;
    const t = searchTerm.toLowerCase();
    return revendedorasInativas.filter(r => r.nome.toLowerCase().includes(t));
  }, [revendedorasInativas, searchTerm]);

  // Deduplicar ranking por cobranca_id
  const prestacoesRankingDedup = useMemo(() => {
    if (!prestacoesRanking) return [];
    const porCobranca = new Map<string, any>();
    for (const p of prestacoesRanking) {
      if (!p.cobranca_id) continue;
      const existente = porCobranca.get(p.cobranca_id);
      if (!existente || p.total_venda > existente.total_venda) {
        porCobranca.set(p.cobranca_id, p);
      }
    }
    const semCobrancaId = prestacoesRanking.filter(p => !p.cobranca_id);
    return [...porCobranca.values(), ...semCobrancaId];
  }, [prestacoesRanking]);

  // Agrupar ranking por revendedora
  const rankingAgrupado = useMemo(() => {
    const map = new Map<string, { nome: string; ciclos: number; volumeTotal: number; comissaoTotal: number; valorEmpresaTotal: number }>();
    for (const p of prestacoesRankingDedup) {
      if (!map.has(p.revendedora)) {
        map.set(p.revendedora, { nome: p.revendedora, ciclos: 0, volumeTotal: 0, comissaoTotal: 0, valorEmpresaTotal: 0 });
      }
      const e = map.get(p.revendedora)!;
      e.ciclos++;
      e.volumeTotal += p.total_venda;
      e.comissaoTotal += p.comissao_valor;
      e.valorEmpresaTotal += p.valor_devido_empresa;
    }
    const arr = Array.from(map.values()).map(r => ({
      ...r,
      ticketMedio: r.ciclos > 0 ? r.volumeTotal / r.ciclos : 0,
      ...calcularNivel(r.ciclos > 0 ? r.volumeTotal / r.ciclos : 0),
    }));
    return arr.sort((a, b) => b.volumeTotal - a.volumeTotal);
  }, [prestacoesRankingDedup]);

  const rankingFiltrado = useMemo(() => {
    if (!searchTerm) return rankingAgrupado;
    const t = searchTerm.toLowerCase();
    return rankingAgrupado.filter(r => r.nome.toLowerCase().includes(t));
  }, [rankingAgrupado, searchTerm]);

  // Perfil deduplicado
  const prestacoesPerfilDedup = useMemo(() => {
    if (!prestacoesPerfil) return [];
    const porCobranca = new Map<string, any>();
    for (const p of prestacoesPerfil) {
      if (!p.cobranca_id) continue;
      const existente = porCobranca.get(p.cobranca_id);
      if (!existente || p.total_venda > existente.total_venda) {
        porCobranca.set(p.cobranca_id, p);
      }
    }
    const semCobrancaId = prestacoesPerfil.filter(p => !p.cobranca_id);
    return [...porCobranca.values(), ...semCobrancaId].sort(
      (a, b) => new Date(b.data_execucao).getTime() - new Date(a.data_execucao).getTime()
    );
  }, [prestacoesPerfil]);

  const perfilResumo = useMemo(() => {
    const ciclos = prestacoesPerfilDedup.length;
    const volumeTotal = prestacoesPerfilDedup.reduce((s, p) => s + p.total_venda, 0);
    const ticketMedio = ciclos > 0 ? volumeTotal / ciclos : 0;
    return { ciclos, volumeTotal, ticketMedio, ...calcularNivel(ticketMedio) };
  }, [prestacoesPerfilDedup]);

  // ==================== MUTATIONS ====================

  const reativarMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRevendedora || !selectedKit) throw new Error('Selecione um kit');
      const kit = kitsDisponiveis.find(k => k.id === selectedKit);
      if (!kit) throw new Error('Kit não encontrado');

      const { fetchStatusRevendedoraPorNome } = await import('@/lib/revendedoraStatus');
      const statusInfo = await fetchStatusRevendedoraPorNome(selectedRevendedora.nome);
      if (statusInfo.blocked) {
        throw new Error('⚠️ Revendedora com pendência jurídica — novos pedidos bloqueados. Entre em contato com o jurídico para mais informações.');
      }


      const { error: cobrancaError } = await supabase.from('cobrancas_agendadas').insert({
        representante_id: user!.id,
        revendedora: selectedRevendedora.nome,
        codigo_nota: kit.codigo,
        valor_previsto: kit.valor || 0,
        data_agendada: format(dataVencimento, 'yyyy-MM-dd'),
        status: 'pendente',
        tipo: kit.tipo,
      });
      if (cobrancaError) throw cobrancaError;

      const { error: kitError } = await supabase.from('kits_estoque').update({ status: 'com_revendedora' }).eq('id', selectedKit);
      if (kitError) throw kitError;

      const { error: entregaError } = await supabase.from('kits_entregues').insert({
        representante_id: user!.id,
        codigo_mostruario: kit.codigo,
        data_entrega: format(new Date(), 'yyyy-MM-dd'),
        data_vencimento: format(dataVencimento, 'yyyy-MM-dd'),
        tipo: kit.tipo,
      });
      if (entregaError) throw entregaError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revendedoras-inativas'] });
      queryClient.invalidateQueries({ queryKey: ['kits-disponiveis-reativar'] });
      queryClient.invalidateQueries({ queryKey: ['minhas-revendedoras-ativas'] });
      toast.success(`Revendedora ${selectedRevendedora?.nome} reativada com sucesso!`);
      setReativarDialogOpen(false);
      setSelectedKit('');
      setDataVencimento(addDays(new Date(), 60));
    },
    onError: (error: any) => toast.error(`Erro ao reativar: ${error.message}`),
  });

  const atualizarWhatsAppMutation = useMutation({
    mutationFn: async ({ revendedora_id, whatsapp }: { revendedora_id: string; whatsapp: string }) => {
      const { error } = await supabase.from('revendedoras').update({ whatsapp: whatsapp || null }).eq('id', revendedora_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minhas-revendedoras-ativas'] });
      toast.success('WhatsApp atualizado!');
      setEditandoWhatsApp(null);
    },
    onError: (error: any) => toast.error(`Erro: ${error.message}`),
  });

  // ==================== HANDLERS ====================

  const handleOpenReativar = (revendedora: RevendedoraInativa) => {
    setSelectedRevendedora(revendedora);
    setReativarDialogOpen(true);
  };

  const handleEditWhatsApp = (nome: string, whatsappAtual: string | null) => {
    setEditandoWhatsApp(nome);
    setWhatsAppTemp(whatsappAtual || '');
  };

  const handleSaveWhatsApp = (revendedora_id: string | null) => {
    if (!revendedora_id) {
      toast.error('Revendedora não cadastrada no sistema');
      return;
    }
    atualizarWhatsAppMutation.mutate({ revendedora_id, whatsapp: whatsAppTemp });
  };

  const tipoLabels: Record<string, string> = { inicial: 'Inicial', especial: 'Especial', maleta: 'Maleta' };

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Minhas Revendedoras</h1>
        <p className="text-muted-foreground">Gerencie suas revendedoras ativas, inativas e acompanhe o ranking</p>
      </div>

      {/* Busca compartilhada */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome da revendedora..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
      </div>

      <Tabs defaultValue="listagem">
        <TabsList>
          <TabsTrigger value="listagem">Listagem</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        {/* ==================== ABA LISTAGEM ==================== */}
        <TabsContent value="listagem" className="space-y-4">
          <ListagemUnificada
            ativas={ativasFiltradas}
            inativas={inativasFiltradas}
            loading={loadingAtivas || loadingInativas}
            searchTerm={searchTerm}
            editandoWhatsApp={editandoWhatsApp}
            whatsAppTemp={whatsAppTemp}
            setWhatsAppTemp={setWhatsAppTemp}
            setEditandoWhatsApp={setEditandoWhatsApp}
            handleEditWhatsApp={handleEditWhatsApp}
            handleSaveWhatsApp={handleSaveWhatsApp}
            setPerfilAberto={setPerfilAberto}
            handleOpenReativar={handleOpenReativar}
            kitsDisponiveisLen={kitsDisponiveis.length}
            onNovaRevendedora={() => setNovaRevOpen(true)}
          />
        </TabsContent>



        {/* ==================== ABA RANKING ==================== */}
        <TabsContent value="ranking" className="space-y-4">
          {/* Filtro período */}
          <div className="flex gap-2">
            {(['mensal', 'trimestral', 'total'] as const).map(p => (
              <Button key={p} variant={periodoRanking === p ? 'default' : 'outline'} size="sm" onClick={() => setPeriodoRanking(p)}>
                {p === 'mensal' ? 'Mensal' : p === 'trimestral' ? 'Trimestral' : 'Total'}
              </Button>
            ))}
          </div>

          {/* Cards resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Revendedoras</div>
              <div className="text-2xl font-bold"><Users className="inline h-4 w-4 mr-1" />{rankingAgrupado.length}</div>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Volume Total</div>
              <div className="text-lg font-bold text-primary">{formatarValor(rankingAgrupado.reduce((s, r) => s + r.volumeTotal, 0))}</div>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Média Ciclos</div>
              <div className="text-2xl font-bold">{rankingAgrupado.length > 0 ? (rankingAgrupado.reduce((s, r) => s + r.ciclos, 0) / rankingAgrupado.length).toFixed(1) : '0'}</div>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Destaque</div>
              <div className="text-sm font-bold truncate"><Trophy className="inline h-4 w-4 mr-1 text-yellow-500" />{rankingAgrupado[0]?.nome || '-'}</div>
            </CardContent></Card>
          </div>

          {/* Tabela ranking */}
          {loadingRanking ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : rankingFiltrado.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum dado de ranking no período</CardContent></Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Nível</TableHead>
                      <TableHead className="text-right">Ciclos</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Ticket Médio</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankingFiltrado.map((r, i) => (
                      <TableRow key={r.nome}>
                        <TableCell className="font-bold">{i + 1}</TableCell>
                        <TableCell className="font-medium">{r.nome}</TableCell>
                        <TableCell><Badge className={nivelBadgeVariant(r.cor)}>{r.nivel}</Badge></TableCell>
                        <TableCell className="text-right">{r.ciclos}</TableCell>
                        <TableCell className="text-right font-medium">{formatarValor(r.volumeTotal)}</TableCell>
                        <TableCell className="text-right">{formatarValor(r.ticketMedio)}</TableCell>
                        <TableCell><Button size="sm" variant="ghost" onClick={() => setPerfilAberto({ nome: r.nome, id: null })}>Ver Perfil</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ==================== DIALOG REATIVAR ==================== */}
      <Dialog open={reativarDialogOpen} onOpenChange={setReativarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reativar Revendedora</DialogTitle>
            <DialogDescription>Reativando <strong>{selectedRevendedora?.nome}</strong></DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Kit para Entrega *</Label>
              <Select value={selectedKit} onValueChange={setSelectedKit}>
                <SelectTrigger><SelectValue placeholder="Selecione um kit" /></SelectTrigger>
                <SelectContent>
                  {kitsDisponiveis.map((kit) => (
                    <SelectItem key={kit.id} value={kit.id}>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        <span>{kit.codigo}</span>
                        <Badge variant="outline" className="ml-1">{tipoLabels[kit.tipo] || kit.tipo}</Badge>
                        <span className="text-muted-foreground">- {formatarValor(kit.valor || 0)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de Vencimento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />{format(dataVencimento, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataVencimento} onSelect={(date) => date && setDataVencimento(date)} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            {selectedKit && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium mb-1">Resumo:</p>
                <p>Kit: {kitsDisponiveis.find(k => k.id === selectedKit)?.codigo}</p>
                <p>Valor: {formatarValor(kitsDisponiveis.find(k => k.id === selectedKit)?.valor || 0)}</p>
                <p>Vencimento: {format(dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReativarDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => reativarMutation.mutate()} disabled={!selectedKit || reativarMutation.isPending}>
              {reativarMutation.isPending ? 'Reativando...' : 'Confirmar Reativação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {perfilAberto && (
        <PerfilRevendedoraDialog
          nomeRevendedora={perfilAberto.nome}
          revendedoraId={perfilAberto.id}
          representantes={[]}
          onClose={() => setPerfilAberto(null)}
        />
      )}

      <RevendedoraFormDialog
        open={novaRevOpen}
        onClose={() => setNovaRevOpen(false)}
        onSaved={() => {
          setNovaRevOpen(false);
          queryClient.invalidateQueries({ queryKey: ['minhas-revendedoras-ativas'] });
          queryClient.invalidateQueries({ queryKey: ['revendedoras-inativas'] });
        }}
      />
    </div>
  );
}
