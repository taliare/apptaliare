import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Package } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Encomenda = {
  id: string;
  tipo_kit: string;
  descricao_pedido: string;
  status: string;
  codigo_kit: string | null;
  criado_em: string;
};

export default function EncomendaRepresentante() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [tipoKit, setTipoKit] = useState('');
  const [descricao, setDescricao] = useState('');

  const { data: encomendas = [], isLoading } = useQuery({
    queryKey: ['encomendas-representante', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('encomendas_kits')
        .select('*')
        .eq('representante_id', user?.id)
        .order('criado_em', { ascending: false });

      if (error) throw error;
      return data as Encomenda[];
    },
    enabled: !!user?.id,
  });

  const criarEncomenda = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('encomendas_kits').insert({
        representante_id: user?.id,
        tipo_kit: tipoKit,
        descricao_pedido: descricao,
        status: 'solicitado',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encomendas-representante'] });
      toast.success('Encomenda enviada para a produção');
      setModalOpen(false);
      setTipoKit('');
      setDescricao('');
    },
    onError: () => {
      toast.error('Erro ao criar encomenda');
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
      solicitado: { label: 'Solicitado', variant: 'default' },
      em_producao: { label: 'Em Produção', variant: 'secondary' },
      pronto: { label: 'Pronto', variant: 'outline' },
      cancelado: { label: 'Cancelado', variant: 'destructive' },
    };

    const config = variants[status] || variants.solicitado;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTipoKitLabel = (tipo: string) => {
    const tipos: Record<string, string> = {
      inicial: 'Inicial',
      especial: 'Especial',
      maleta: 'Maleta',
      misto: 'Misto',
    };
    return tipos[tipo] || tipo;
  };

  const handleSubmit = () => {
    if (!tipoKit || !descricao.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    criarEncomenda.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Encomendas</h1>
          <p className="text-muted-foreground">Solicite kits personalizados para a produção</p>
        </div>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Encomenda
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Encomenda de Kit</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tipo_kit">Tipo do Kit</Label>
                <Select value={tipoKit} onValueChange={setTipoKit}>
                  <SelectTrigger id="tipo_kit">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inicial">Inicial</SelectItem>
                    <SelectItem value="especial">Especial</SelectItem>
                    <SelectItem value="maleta">Maleta</SelectItem>
                    <SelectItem value="misto">Misto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição do Pedido</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva o que precisa neste mostruário sob encomenda..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={4}
                />
              </div>

              <Button onClick={handleSubmit} className="w-full" disabled={criarEncomenda.isPending}>
                {criarEncomenda.isPending ? 'Enviando...' : 'Enviar Encomenda'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-6">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando encomendas...</div>
        ) : encomendas.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma encomenda encontrada</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Código</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {encomendas.map((encomenda) => (
                <TableRow key={encomenda.id}>
                  <TableCell>
                    {format(new Date(encomenda.criado_em), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell>{getTipoKitLabel(encomenda.tipo_kit)}</TableCell>
                  <TableCell className="max-w-xs truncate">{encomenda.descricao_pedido}</TableCell>
                  <TableCell>{getStatusBadge(encomenda.status)}</TableCell>
                  <TableCell>
                    {encomenda.codigo_kit ? (
                      <span className="font-mono font-semibold">{encomenda.codigo_kit}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
