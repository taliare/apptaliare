import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Search, Upload, Plus, MessageCircle, MapPin, User as UserIcon, Filter, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import RankingRevendedoras from '@/components/revendedoras/RankingRevendedoras';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { profilesLimited } from '@/lib/profilesLimited';
import { ImportWhatsAppDialog } from '@/components/revendedoras/ImportWhatsAppDialog';
import { RevendedoraFormDialog } from '@/components/revendedoras/RevendedoraFormDialog';
import { StatusRevendedoraBadge } from '@/components/revendedoras/StatusRevendedoraBadge';
import { PerfilRevendedoraDialog } from '@/components/revendedoras/PerfilRevendedoraDialog';
import { calcularStatusRevendedora, type RevendedoraStatusKey } from '@/lib/revendedoraStatus';
import { useFotoUrl } from '@/hooks/useFotoUrl';
import { formatarValor, cn } from '@/lib/utils';

interface Revendedora {
  id: string;
  nome: string;
  whatsapp: string | null;
  representante_id: string | null;
  ativo: boolean;
  ultima_atividade: string | null;
  foto_url: string | null;
  status_juridico: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  profiles?: { nome: string } | null;
}

interface Profile {
  id: string;
  nome: string;
}

function RevendedoraAvatar({ path, nome, size = 'sm' }: { path: string | null; nome: string; size?: 'sm' | 'md' }) {
  const url = useFotoUrl(path);
  const initials = nome.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('');
  const cls = size === 'md' ? 'h-11 w-11' : 'h-9 w-9';
  return (
    <Avatar className={cls}>
      {url && <AvatarImage src={url} alt={nome} />}
      <AvatarFallback className="text-xs">{initials || '?'}</AvatarFallback>
    </Avatar>
  );
}

function buildMapsUrl(r: Revendedora): string | null {
  if (!r.cep && !r.logradouro) return null;
  const parts = [r.logradouro, r.numero, r.bairro, r.cidade, r.estado].filter(Boolean).join(' ');
  const query = parts || r.cep || '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildWhatsappUrl(numero: string | null): string | null {
  if (!numero) return null;
  const digits = numero.replace(/\D/g, '');
  if (!digits) return null;
  const full = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${full}`;
}

export default function Revendedoras() {
  const queryClient = useQueryClient();
  const [statusFiltro, setStatusFiltro] = useState<'todos' | RevendedoraStatusKey>('todos');
  const [representanteFiltro, setRepresentanteFiltro] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formEditId, setFormEditId] = useState<string | null>(null);
  const [perfilNome, setPerfilNome] = useState<string | null>(null);

  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes-lista'],
    queryFn: async () => {
      const { data, error } = await profilesLimited().select('id, nome').order('nome');
      if (error) throw error;
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'representante');
      const repIds = roles?.map((r) => r.user_id) || [];
      return (data as Profile[]).filter((p) => repIds.includes(p.id));
    },
  });

  const { data: revendedoras = [], isLoading } = useQuery({
    queryKey: ['revendedoras-admin', representanteFiltro],
    queryFn: async () => {
      let query = supabase.from('revendedoras').select('*').order('nome');
      if (representanteFiltro !== 'todos') query = query.eq('representante_id', representanteFiltro);

      const { data, error } = await query;
      if (error) throw error;

      const repIds = [...new Set(data?.map((r) => r.representante_id).filter(Boolean) || [])];
      const { data: profiles } = await profilesLimited().select('id, nome').in('id', repIds);
      const profileMap = new Map(profiles?.map((p) => [p.id, p.nome]) || []);

      return (data?.map((r) => ({
        ...r,
        profiles: r.representante_id ? { nome: profileMap.get(r.representante_id) || '' } : null,
      })) ?? []) as Revendedora[];
    },
  });

  const nomesNorm = useMemo(
    () => revendedoras.map((r) => r.nome.trim().toUpperCase()),
    [revendedoras]
  );

  const { data: cobrancasMap = new Map<string, any[]>() } = useQuery({
    queryKey: ['revendedoras-cobrancas-status', nomesNorm],
    enabled: nomesNorm.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('revendedora, status, data_agendada, valor_previsto, valor_pago_acumulado, valor_adiantado')
        .in('revendedora', nomesNorm);
      if (error) throw error;
      const map = new Map<string, any[]>();
      (data ?? []).forEach((c: any) => {
        const k = (c.revendedora ?? '').trim().toUpperCase();
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(c);
      });
      return map;
    },
  });

  const revendedorasComStatus = useMemo(() => {
    return revendedoras.map((r) => {
      const cobs = cobrancasMap.get(r.nome.trim().toUpperCase()) ?? [];
      const status = calcularStatusRevendedora(r, cobs);
      const saldo = cobs.reduce((sum, c) => {
        if (c.status === 'pago') return sum;
        const restante = Number(c.valor_previsto || 0) - Number(c.valor_pago_acumulado || 0) - Number(c.valor_adiantado || 0);
        return sum + Math.max(0, restante);
      }, 0);
      return { ...r, statusInfo: status, saldoAberto: saldo };
    });
  }, [revendedoras, cobrancasMap]);

  const revendedorasFiltradas = useMemo(() => {
    let list = revendedorasComStatus;
    if (statusFiltro !== 'todos') list = list.filter((r) => r.statusInfo.key === statusFiltro);
    if (searchTerm) {
      const termo = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          r.nome.toLowerCase().includes(termo) ||
          r.whatsapp?.toLowerCase().includes(termo) ||
          r.profiles?.nome?.toLowerCase().includes(termo)
      );
    }
    return list;
  }, [revendedorasComStatus, statusFiltro, searchTerm]);

  const contagens = useMemo(() => {
    const c: Partial<Record<RevendedoraStatusKey, number>> = {};
    revendedorasComStatus.forEach((r) => {
      c[r.statusInfo.key] = (c[r.statusInfo.key] ?? 0) + 1;
    });
    return c;
  }, [revendedorasComStatus]);

  const openNova = () => {
    setFormEditId(null);
    setFormOpen(true);
  };

  const statusChips: { value: 'todos' | RevendedoraStatusKey; label: string; emoji?: string }[] = [
    { value: 'todos', label: 'Todas' },
    { value: 'ativa', label: 'Ativa', emoji: '🟢' },
    { value: 'pagando', label: 'Pagando', emoji: '🔵' },
    { value: 'quite', label: 'Quite', emoji: '✅' },
    { value: 'em_atraso', label: 'Em Atraso', emoji: '⚠️' },
    { value: 'inadimplente', label: 'Inadimplente', emoji: '🔴' },
    { value: 'juridico_solicitado', label: 'Sol. Jurídico', emoji: '⚖️' },
    { value: 'juridico_aprovado', label: 'Jurídico', emoji: '⛔' },
    { value: 'inativa', label: 'Inativa', emoji: '💤' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Revendedoras</h1>
          <p className="text-muted-foreground">Gestão e ranking de revendedoras</p>
        </div>
        <Button onClick={openNova} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Revendedora
        </Button>
      </div>

      <Tabs defaultValue="listagem" className="w-full">
        <TabsList>
          <TabsTrigger value="listagem">Listagem</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        <TabsContent value="listagem">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setImportDialogOpen(true)} variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Importar WhatsApp
              </Button>
            </div>

            {/* Busca + botão Filtrar */}
            <Card>
              <CardContent className="py-4">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, WhatsApp ou representante..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={(statusFiltro !== 'todos' || representanteFiltro !== 'todos') ? 'default' : 'outline'}
                        className="gap-2 relative"
                      >
                        <Filter className="h-4 w-4" />
                        <span className="hidden sm:inline">Filtrar</span>
                        {(statusFiltro !== 'todos' ? 1 : 0) + (representanteFiltro !== 'todos' ? 1 : 0) > 0 && (
                          <Badge
                            variant="secondary"
                            className="ml-1 h-5 min-w-5 px-1.5 rounded-full text-[10px] bg-background text-foreground"
                          >
                            {(statusFiltro !== 'todos' ? 1 : 0) + (representanteFiltro !== 'todos' ? 1 : 0)}
                          </Badge>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[320px] max-h-[80vh] overflow-y-auto">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Filtros</p>
                          {(statusFiltro !== 'todos' || representanteFiltro !== 'todos') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => { setStatusFiltro('todos'); setRepresentanteFiltro('todos'); }}
                            >
                              <X className="h-3 w-3" />
                              Limpar
                            </Button>
                          )}
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground font-medium">Representante</p>
                          <Select value={representanteFiltro} onValueChange={setRepresentanteFiltro}>
                            <SelectTrigger>
                              <SelectValue placeholder="Representante" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">Todos representantes</SelectItem>
                              {representantes.map((rep) => (
                                <SelectItem key={rep.id} value={rep.id}>{rep.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground font-medium">Status</p>
                          <div className="flex flex-wrap gap-2">
                            {statusChips.map((chip) => {
                              const active = statusFiltro === chip.value;
                              const count = chip.value === 'todos'
                                ? revendedorasComStatus.length
                                : (contagens[chip.value as RevendedoraStatusKey] ?? 0);
                              return (
                                <button
                                  key={chip.value}
                                  type="button"
                                  onClick={() => setStatusFiltro(chip.value)}
                                  className={cn(
                                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                                    active
                                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                      : 'bg-background text-foreground border-border hover:bg-accent'
                                  )}
                                >
                                  {chip.emoji && <span className="mr-1">{chip.emoji}</span>}
                                  {chip.label}
                                  <span className={cn('ml-1 opacity-70', active && 'opacity-90')}>({count})</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardContent>
            </Card>

            {/* Lista */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5" />
                  {revendedorasFiltradas.length} revendedora{revendedorasFiltradas.length !== 1 ? 's' : ''}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 sm:px-6">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : revendedorasFiltradas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'Nenhuma revendedora encontrada' : 'Nenhuma revendedora cadastrada'}
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {revendedorasFiltradas.map((rev) => {
                      const mapsUrl = buildMapsUrl(rev);
                      const waUrl = buildWhatsappUrl(rev.whatsapp);
                      return (
                        <li
                          key={rev.id}
                          className="px-3 sm:px-2 py-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-accent/40 transition-colors"
                        >
                          {/* Foto + nome + rep */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <RevendedoraAvatar path={rev.foto_url} nome={rev.nome} size="md" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{rev.nome}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {rev.profiles?.nome || 'Sem representante'}
                              </p>
                            </div>
                          </div>

                          {/* Status + saldo */}
                          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                            <StatusRevendedoraBadge status={rev.statusInfo} />
                            <div className="text-right min-w-[90px]">
                              <p className="text-[10px] uppercase text-muted-foreground leading-none">Saldo</p>
                              <p className={cn(
                                'text-sm font-semibold',
                                rev.saldoAberto > 0 ? 'text-amber-600' : 'text-emerald-600'
                              )}>
                                {formatarValor(rev.saldoAberto)}
                              </p>
                            </div>
                          </div>

                          {/* Ações */}
                          <div className="flex items-center gap-1 flex-wrap">
                            {waUrl && (
                              <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-emerald-600 hover:text-emerald-700"
                                title="Abrir WhatsApp"
                              >
                                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                                  <MessageCircle className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {mapsUrl && (
                              <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-blue-600 hover:text-blue-700"
                                title="Abrir no Google Maps"
                              >
                                <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                                  <MapPin className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => setPerfilNome(rev.nome)}
                            >
                              <UserIcon className="h-3.5 w-3.5" />
                              Ver Perfil
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <ImportWhatsAppDialog
              open={importDialogOpen}
              onClose={() => setImportDialogOpen(false)}
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ['revendedoras-admin'] })}
            />
          </div>
        </TabsContent>

        <TabsContent value="ranking">
          <RankingRevendedoras
            representantes={representantes}
            representanteFiltro={representanteFiltro}
            setRepresentanteFiltro={setRepresentanteFiltro}
          />
        </TabsContent>
      </Tabs>

      <RevendedoraFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        revendedoraId={formEditId}
      />

      {perfilNome && (
        <PerfilRevendedoraDialog
          nomeRevendedora={perfilNome}
          representantes={representantes}
          onClose={() => setPerfilNome(null)}
        />
      )}
    </div>
  );
}
