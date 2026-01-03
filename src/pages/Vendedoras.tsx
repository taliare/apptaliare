import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Users, Plus, UserCheck, UserX } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-external';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Vendedora {
  id: string;
  nome: string;
  ativo: boolean;
  criado_em: string;
}

export default function Vendedoras() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [novaVendedora, setNovaVendedora] = useState('');

  // Query para buscar vendedoras
  const { data: vendedoras = [], isLoading } = useQuery({
    queryKey: ['vendedoras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedoras')
        .select('*')
        .order('nome');
      
      if (error) throw error;
      return data as Vendedora[];
    },
  });

  // Mutation para criar vendedora
  const criarVendedoraMutation = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase
        .from('vendedoras')
        .insert({ nome: nome.trim().toUpperCase() });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedoras'] });
      toast.success('Vendedora cadastrada com sucesso');
      setNovaVendedora('');
      setIsDialogOpen(false);
    },
    onError: () => {
      toast.error('Erro ao cadastrar vendedora');
    },
  });

  // Mutation para alternar status (ativo/inativo)
  const alternarStatusMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('vendedoras')
        .update({ ativo })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, { ativo }) => {
      queryClient.invalidateQueries({ queryKey: ['vendedoras'] });
      toast.success(ativo ? 'Vendedora ativada' : 'Vendedora desativada');
    },
    onError: () => {
      toast.error('Erro ao alterar status');
    },
  });

  const handleCriarVendedora = () => {
    if (!novaVendedora.trim()) {
      toast.error('Informe o nome da vendedora');
      return;
    }
    criarVendedoraMutation.mutate(novaVendedora);
  };

  const vendedorasAtivas = vendedoras.filter(v => v.ativo);
  const vendedorasInativas = vendedoras.filter(v => !v.ativo);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Vendedoras</h1>
          <p className="text-muted-foreground">Cadastro de vendedoras para venda externa</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Vendedora
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Vendedora</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome da Vendedora *</Label>
                <Input
                  value={novaVendedora}
                  onChange={(e) => setNovaVendedora(e.target.value)}
                  placeholder="Ex: Maria Silva"
                  onKeyDown={(e) => e.key === 'Enter' && handleCriarVendedora()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCriarVendedora} disabled={criarVendedoraMutation.isPending}>
                {criarVendedoraMutation.isPending ? 'Salvando...' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <UserCheck className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{vendedorasAtivas.length}</p>
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
                <p className="text-2xl font-bold">{vendedorasInativas.length}</p>
                <p className="text-sm text-muted-foreground">Inativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de vendedoras */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Vendedoras Cadastradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : vendedoras.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma vendedora cadastrada
            </div>
          ) : (
            <div className="space-y-3">
              {vendedoras.map((vendedora) => (
                <div
                  key={vendedora.id}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    vendedora.ativo ? 'bg-card' : 'bg-muted/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-semibold text-lg">{vendedora.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Cadastrada em {format(new Date(vendedora.criado_em), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant={vendedora.ativo ? 'default' : 'secondary'}>
                      {vendedora.ativo ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>
                  <Button
                    variant={vendedora.ativo ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => alternarStatusMutation.mutate({ id: vendedora.id, ativo: !vendedora.ativo })}
                    disabled={alternarStatusMutation.isPending}
                  >
                    {vendedora.ativo ? (
                      <>
                        <UserX className="h-4 w-4 mr-1" />
                        Desativar
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4 mr-1" />
                        Ativar
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
