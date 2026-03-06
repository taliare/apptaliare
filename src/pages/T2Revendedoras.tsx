import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Users, Search } from 'lucide-react';

export default function T2Revendedoras() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === 'admin';
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    nome_completo: '', nome_exibicao: '', cpf: '', telefone: '', cidade: '', instagram: '',
  });

  const { data: revendedoras = [], isLoading } = useQuery({
    queryKey: ['t2-revendedoras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_revendedoras')
        .select('*')
        .order('data_cadastro', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const cpfClean = form.cpf.replace(/\D/g, '');
      if (cpfClean.length !== 11) throw new Error('CPF deve ter 11 dígitos');

      const { error } = await supabase.from('t2_revendedoras').insert({
        nome_completo: form.nome_completo.trim(),
        nome_exibicao: form.nome_exibicao.trim() || null,
        cpf: cpfClean,
        telefone: form.telefone.trim(),
        cidade: form.cidade.trim() || null,
        instagram: form.instagram.trim() || null,
        representante_id: isAdmin ? null : user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['t2-revendedoras'] });
      setForm({ nome_completo: '', nome_exibicao: '', cpf: '', telefone: '', cidade: '', instagram: '' });
      setCreateOpen(false);
      toast({ title: 'Revendedora cadastrada!' });
    },
    onError: (err: any) => {
      const msg = err.message?.includes('t2_revendedoras_cpf_unique')
        ? 'CPF já cadastrado no sistema.'
        : err.message;
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    },
  });

  const filtered = revendedoras.filter((r: any) =>
    r.nome_completo.toLowerCase().includes(search.toLowerCase()) ||
    r.cpf?.includes(search)
  );

  const formatCpf = (cpf: string) => {
    const c = cpf.replace(/\D/g, '');
    return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Revendedoras T2</h1>
          <p className="text-sm text-muted-foreground">Cadastro TALIARE 2.0</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova Revendedora</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar Revendedora</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome Completo *</Label><Input value={form.nome_completo} onChange={e => setForm(f => ({ ...f, nome_completo: e.target.value }))} /></div>
              <div><Label>Nome de Exibição</Label><Input placeholder="Opcional" value={form.nome_exibicao} onChange={e => setForm(f => ({ ...f, nome_exibicao: e.target.value }))} /></div>
              <div><Label>CPF *</Label><Input placeholder="000.000.000-00" value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} /></div>
              <div><Label>Telefone *</Label><Input placeholder="(00) 00000-0000" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></div>
              <div><Label>Cidade</Label><Input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} /></div>
              <div><Label>Instagram</Label><Input placeholder="@usuario" value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} /></div>
              <Button className="w-full" disabled={!form.nome_completo || !form.cpf || !form.telefone || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? 'Salvando...' : 'Cadastrar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome ou CPF..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Users className="h-12 w-12 mx-auto mb-4 opacity-40" /><p>Nenhuma revendedora encontrada</p></CardContent></Card>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">CPF</TableHead>
                <TableHead className="hidden md:table-cell">Telefone</TableHead>
                <TableHead className="hidden lg:table-cell">Cidade</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nome_exibicao || r.nome_completo}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{formatCpf(r.cpf)}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{r.telefone}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{r.cidade || '-'}</TableCell>
                  <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
