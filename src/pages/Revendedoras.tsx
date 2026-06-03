import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Search, Phone, Edit2, Upload, Plus } from 'lucide-react';
import RankingRevendedoras from '@/components/revendedoras/RankingRevendedoras';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { profilesLimited } from '@/lib/profilesLimited';
import { toast } from 'sonner';
import { ImportWhatsAppDialog } from '@/components/revendedoras/ImportWhatsAppDialog';
import { RevendedoraFormDialog } from '@/components/revendedoras/RevendedoraFormDialog';
import { StatusRevendedoraBadge } from '@/components/revendedoras/StatusRevendedoraBadge';
import { calcularStatusRevendedora, getStatusInfo, type RevendedoraStatusKey } from '@/lib/revendedoraStatus';
import { useFotoUrl } from '@/hooks/useFotoUrl';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Revendedora {
  id: string;
  nome: string;
  whatsapp: string | null;
  representante_id: string | null;
  ativo: boolean;
  ultima_atividade: string | null;
  foto_url: string | null;
  status_juridico: string | null;
  profiles?: { nome: string } | null;
}

interface Profile {
  id: string;
  nome: string;
}

function RevendedoraAvatar({ path, nome }: { path: string | null; nome: string }) {
  const url = useFotoUrl(path);
  const initials = nome.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('');
  return (
    <Avatar className="h-9 w-9">
      {url && <AvatarImage src={url} alt={nome} />}
      <AvatarFallback className="text-xs">{initials || '?'}</AvatarFallback>
    </Avatar>
  );
}

export default function Revendedoras() {
  const queryClient = useQueryClient();
  const [statusFiltro, setStatusFiltro] = useState<'todos' | RevendedoraStatusKey>('todos');
  const [representanteFiltro, setRepresentanteFiltro] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formEditId, setFormEditId] = useState<string | null>(null);

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

  // Carrega cobranças para calcular status (filtra pelos nomes visíveis)
  const nomesNorm = useMemo(
    () => revendedoras.map((r) => r.nome.trim().toUpperCase()),
    [revendedoras]
  );

  const { data: cobrancasMap = new Map<string, { status: string | null; data_agendada: string | null }[]>() } = useQuery({
    queryKey: ['revendedoras-cobrancas-status', nomesNorm],
    enabled: nomesNorm.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('revendedora, status, data_agendada')
        .in('revendedora', nomesNorm);
      if (error) throw error;
      const map = new Map<string, { status: string | null; data_agendada: string | null }[]>();
      (data ?? []).forEach((c: any) => {
        const k = (c.revendedora ?? '').trim().toUpperCase();
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push({ status: c.status, data_agendada: c.data_agendada });
      });
      return map;
    },
  });

  // Anexa o status calculado
  const revendedorasComStatus = useMemo(() => {
    return revendedoras.map((r) => {
      const cobs = cobrancasMap.get(r.nome.trim().toUpperCase()) ?? [];
      const status = calcularStatusRevendedora(r, cobs);
      return { ...r, statusInfo: status };
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

  // Contagens
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
  const openEdit = (id: string) => {
    setFormEditId(id);
    setFormOpen(true);
  };

  const statusOptions: { value: 'todos' | RevendedoraStatusKey; label: string }[] = [
    { value: 'todos', label: 'Todos status' },
    { value: 'ativa', label: '🟢 Ativa' },
    { value: 'pagando', label: '🔵 Pagando' },
    { value: 'quite', label: '✅ Quite' },
    { value: 'em_atraso', label: '⚠️ Em Atraso' },
    { value: 'inadimplente', label: '🔴 Inadimplente' },
    { value: 'juridico_solicitado', label: '⚖️ Sol. Jurídico' },
    { value: 'juridico_aprovado', label: '⛔ Jurídico' },
    { value: 'sem_kit', label: '⚪ Sem Kit' },
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
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setImportDialogOpen(true)} variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Importar WhatsApp
              </Button>
            </div>

            {/* Filtros */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nome, WhatsApp ou representante..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as typeof statusFiltro)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={representanteFiltro} onValueChange={setRepresentanteFiltro}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Representante" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {representantes.map((rep) => (
                          <SelectItem key={rep.id} value={rep.id}>{rep.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold">{revendedorasFiltradas.length}</p><p className="text-xs text-muted-foreground">Exibidas</p></CardContent></Card>
              <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-emerald-600">{contagens.ativa ?? 0}</p><p className="text-xs text-muted-foreground">🟢 Ativas</p></CardContent></Card>
              <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-blue-600">{contagens.pagando ?? 0}</p><p className="text-xs text-muted-foreground">🔵 Pagando</p></CardContent></Card>
              <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-amber-600">{contagens.em_atraso ?? 0}</p><p className="text-xs text-muted-foreground">⚠️ Em Atraso</p></CardContent></Card>
              <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-red-600">{contagens.inadimplente ?? 0}</p><p className="text-xs text-muted-foreground">🔴 Inadimplente</p></CardContent></Card>
              <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-purple-600">{(contagens.juridico_solicitado ?? 0) + (contagens.juridico_aprovado ?? 0)}</p><p className="text-xs text-muted-foreground">⚖️ Jurídico</p></CardContent></Card>
            </div>

            {/* Tabela */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Revendedoras Cadastradas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : revendedorasFiltradas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'Nenhuma revendedora encontrada' : 'Nenhuma revendedora cadastrada'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Revendedora</TableHead>
                          <TableHead>Representante</TableHead>
                          <TableHead>WhatsApp</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Última Atividade</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {revendedorasFiltradas.map((revendedora) => (
                          <TableRow key={revendedora.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <RevendedoraAvatar path={revendedora.foto_url} nome={revendedora.nome} />
                                <span className="font-medium">{revendedora.nome}</span>
                              </div>
                            </TableCell>
                            <TableCell>{revendedora.profiles?.nome || '-'}</TableCell>
                            <TableCell>
                              {revendedora.whatsapp ? (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  {revendedora.whatsapp}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">(vazio)</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <StatusRevendedoraBadge status={revendedora.statusInfo} />
                            </TableCell>
                            <TableCell>
                              {revendedora.ultima_atividade
                                ? format(new Date(revendedora.ultima_atividade + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => openEdit(revendedora.id)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
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
    </div>
  );
}
