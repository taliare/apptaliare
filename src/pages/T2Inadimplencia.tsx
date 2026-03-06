import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { differenceInDays } from 'date-fns';

export default function T2Inadimplencia() {
  const [filtroRepresentante, setFiltroRepresentante] = useState('todos');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroAtraso, setFiltroAtraso] = useState('todos');

  const { data: ciclos = [], isLoading } = useQuery({
    queryKey: ['t2-inadimplentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_ciclos')
        .select('*, t2_revendedoras(nome_completo, nome_exibicao, cidade)')
        .eq('status', 'inadimplente')
        .order('data_vencimento', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: representantes = [] } = useQuery({
    queryKey: ['t2-representantes-inadimplencia'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles_limited')
        .select('id, nome');
      if (error) throw error;
      return data;
    },
  });

  const hoje = new Date();

  const filtered = ciclos.filter((c: any) => {
    if (filtroRepresentante !== 'todos' && c.representante_id !== filtroRepresentante) return false;
    if (filtroCidade && !(c.t2_revendedoras?.cidade || '').toLowerCase().includes(filtroCidade.toLowerCase())) return false;
    const dias = differenceInDays(hoje, new Date(c.data_vencimento));
    if (filtroAtraso === '0-15' && dias > 15) return false;
    if (filtroAtraso === '16-30' && (dias < 16 || dias > 30)) return false;
    if (filtroAtraso === '31+' && dias < 31) return false;
    return true;
  });

  const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  const getRepName = (id: string) => {
    const rep = representantes.find((r: any) => r.id === id);
    return rep?.nome || 'N/A';
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inadimplência T2</h1>
        <p className="text-sm text-muted-foreground">Ciclos vencidos com saldo pendente</p>
      </div>

      {/* Filtros */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Select value={filtroRepresentante} onValueChange={setFiltroRepresentante}>
          <SelectTrigger><SelectValue placeholder="Representante" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os representantes</SelectItem>
            {representantes.map((r: any) => (
              <SelectItem key={r.id} value={r.id!}>{r.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Filtrar por cidade..."
          value={filtroCidade}
          onChange={e => setFiltroCidade(e.target.value)}
        />
        <Select value={filtroAtraso} onValueChange={setFiltroAtraso}>
          <SelectTrigger><SelectValue placeholder="Dias em atraso" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="0-15">0 - 15 dias</SelectItem>
            <SelectItem value="16-30">16 - 30 dias</SelectItem>
            <SelectItem value="31+">31+ dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p>Nenhum ciclo inadimplente encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-3 px-2 font-medium text-muted-foreground">Revendedora</th>
                <th className="py-3 px-2 font-medium text-muted-foreground">Cidade</th>
                <th className="py-3 px-2 font-medium text-muted-foreground">Representante</th>
                <th className="py-3 px-2 font-medium text-muted-foreground text-right">Valor Devido</th>
                <th className="py-3 px-2 font-medium text-muted-foreground text-center">Vencimento</th>
                <th className="py-3 px-2 font-medium text-muted-foreground text-center">Dias em Atraso</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => {
                const dias = differenceInDays(hoje, new Date(c.data_vencimento));
                return (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-3 px-2 font-medium">
                      {c.t2_revendedoras?.nome_exibicao || c.t2_revendedoras?.nome_completo || 'N/A'}
                    </td>
                    <td className="py-3 px-2 text-muted-foreground">{c.t2_revendedoras?.cidade || '-'}</td>
                    <td className="py-3 px-2">{getRepName(c.representante_id)}</td>
                    <td className="py-3 px-2 text-right font-semibold text-destructive">
                      R$ {fmt(c.valor_restante || 0)}
                    </td>
                    <td className="py-3 px-2 text-center">{new Date(c.data_vencimento).toLocaleDateString('pt-BR')}</td>
                    <td className="py-3 px-2 text-center">
                      <Badge variant="destructive" className="text-xs">{dias} dias</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
