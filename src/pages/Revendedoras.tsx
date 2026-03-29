import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Search, UserCheck, UserX, Phone, Edit2, Upload } from 'lucide-react';
import RankingRevendedoras from '@/components/revendedoras/RankingRevendedoras';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { profilesLimited } from '@/lib/profilesLimited';
import { toast } from 'sonner';
import { ImportWhatsAppDialog } from '@/components/revendedoras/ImportWhatsAppDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Revendedora {
  id: string;
  nome: string;
  whatsapp: string | null;
  representante_id: string | null;
  ativo: boolean;
  ultima_atividade: string | null;
  profiles?: { nome: string } | null;
}

interface Profile {
  id: string;
  nome: string;
}

export default function Revendedoras() {
  const queryClient = useQueryClient();
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'ativas' | 'inativas'>('todos');
  const [representanteFiltro, setRepresentanteFiltro] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog para editar WhatsApp
  const [editingRevendedora, setEditingRevendedora] = useState<Revendedora | null>(null);
  const [whatsappValue, setWhatsappValue] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Query para buscar representantes (para o filtro)
  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes-lista'],
    queryFn: async () => {
      const { data, error } = await profilesLimited()
        .select('id, nome')
        .order('nome');
      
      if (error) throw error;
      
      // Filtrar apenas representantes (que têm role representante)
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'representante');
      
      const repIds = roles?.map(r => r.user_id) || [];
      return (data as Profile[]).filter(p => repIds.includes(p.id));
    },
  });

  // Query para buscar revendedoras
  const { data: revendedoras = [], isLoading } = useQuery({
    queryKey: ['revendedoras-admin', statusFiltro, representanteFiltro],
    queryFn: async () => {
      let query = supabase
        .from('revendedoras')
        .select('*')
        .order('nome');
      
      if (statusFiltro !== 'todos') {
        query = query.eq('ativo', statusFiltro === 'ativas');
      }
      if (representanteFiltro !== 'todos') {
        query = query.eq('representante_id', representanteFiltro);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Buscar nomes dos representantes
      const repIds = [...new Set(data?.map(r => r.representante_id).filter(Boolean) || [])];
      const { data: profiles } = await profilesLimited()
        .select('id, nome')
        .in('id', repIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p.nome]) || []);
      
      return data?.map(r => ({
        ...r,
        profiles: r.representante_id ? { nome: profileMap.get(r.representante_id) || '' } : null
      })) as Revendedora[];
    },
  });

  // Mutation para atualizar WhatsApp
  const atualizarWhatsAppMutation = useMutation({
    mutationFn: async ({ id, whatsapp }: { id: string; whatsapp: string }) => {
      const { error } = await supabase
        .from('revendedoras')
        .update({ whatsapp: whatsapp || null, atualizado_em: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revendedoras-admin'] });
      toast.success('WhatsApp atualizado com sucesso');
      setEditingRevendedora(null);
    },
    onError: () => {
      toast.error('Erro ao atualizar WhatsApp');
    },
  });

  // Filtrar por termo de busca
  const revendedorasFiltradas = useMemo(() => {
    if (!searchTerm) return revendedoras;
    const termo = searchTerm.toLowerCase();
    return revendedoras.filter(r => 
      r.nome.toLowerCase().includes(termo) ||
      r.whatsapp?.toLowerCase().includes(termo) ||
      r.profiles?.nome?.toLowerCase().includes(termo)
    );
  }, [revendedoras, searchTerm]);

  // Estatísticas
  const totalAtivas = revendedoras.filter(r => r.ativo).length;
  const totalInativas = revendedoras.filter(r => !r.ativo).length;

  const handleEditWhatsApp = (revendedora: Revendedora) => {
    setEditingRevendedora(revendedora);
    setWhatsappValue(revendedora.whatsapp || '');
  };

  const handleSaveWhatsApp = () => {
    if (!editingRevendedora) return;
    atualizarWhatsAppMutation.mutate({ id: editingRevendedora.id, whatsapp: whatsappValue });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Revendedoras</h1>
          <p className="text-muted-foreground">Gestão e ranking de revendedoras</p>
        </div>
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
            <div className="flex gap-2">
              <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as typeof statusFiltro)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativas">Ativas</SelectItem>
                  <SelectItem value="inativas">Inativas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={representanteFiltro} onValueChange={setRepresentanteFiltro}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Representante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {representantes.map(rep => (
                    <SelectItem key={rep.id} value={rep.id}>{rep.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{revendedorasFiltradas.length}</p>
                <p className="text-sm text-muted-foreground">Total Exibido</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <UserCheck className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{totalAtivas}</p>
                <p className="text-sm text-muted-foreground">Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <UserX className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{totalInativas}</p>
                <p className="text-sm text-muted-foreground">Inativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de revendedoras */}
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
                    <TableHead>Nome</TableHead>
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
                      <TableCell className="font-medium">{revendedora.nome}</TableCell>
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
                        <Badge variant={revendedora.ativo ? 'default' : 'secondary'}>
                          {revendedora.ativo ? '🟢 Ativa' : '🔴 Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {revendedora.ultima_atividade
                          ? format(new Date(revendedora.ultima_atividade + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditWhatsApp(revendedora)}
                        >
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

      {/* Dialog para editar WhatsApp */}
      <Dialog open={!!editingRevendedora} onOpenChange={() => setEditingRevendedora(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Revendedora</Label>
              <p className="text-sm font-medium">{editingRevendedora?.nome}</p>
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input
                value={whatsappValue}
                onChange={(e) => setWhatsappValue(e.target.value)}
                placeholder="Ex: 11999998888"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRevendedora(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveWhatsApp} disabled={atualizarWhatsAppMutation.isPending}>
              {atualizarWhatsAppMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
