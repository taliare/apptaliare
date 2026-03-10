import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { differenceInDays, isBefore, startOfDay } from 'date-fns';
import { formatarValor } from '@/lib/utils';

export default function T2Inadimplencia() {
  const [filtroRepresentante, setFiltroRepresentante] = useState('todos');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroAtraso, setFiltroAtraso] = useState('todos');

  // 1. Buscar ciclos não encerrados com data_cobranca preenchida
  const { data: ciclos = [], isLoading: loadingCiclos } = useQuery({
    queryKey: ['t2-inadimplencia-ciclos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_ciclos')
        .select('*, t2_revendedoras(nome_completo, nome_exibicao, cidade)')
        .neq('status', 'encerrado')
        .not('data_cobranca', 'is', null)
        .order('data_cobranca', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // 2. Buscar apurações dos ciclos para valor_empresa
  const cicloIds = ciclos.map((c: any) => c.id);

  const { data: apuracoes = [] } = useQuery({
    queryKey: ['t2-inadimplencia-apuracoes', cicloIds],
    queryFn: async () => {
      if (cicloIds.length === 0) return [];
      const { data, error } = await supabase
        .from('t2_apuracoes')
        .select('ciclo_id, valor_empresa')
        .in('ciclo_id', cicloIds);
      if (error) throw error;
      return data;
    },
    enabled: cicloIds.length > 0,
  });

  // 3. Buscar pagamentos
  const apuracaoMap = useMemo(() => {
    const map: Record<string, string> = {};
    apuracoes.forEach((a: any) => { map[a.ciclo_id] = a.ciclo_id; });
    return map;
  }, [apuracoes]);

  const { data: pagamentos = [] } = useQuery({
    queryKey: ['t2-inadimplencia-pagamentos', cicloIds],
    queryFn: async () => {
      if (cicloIds.length === 0) return [];
      // Buscar pagamentos via apuracoes
      const apuracaoIds = apuracoes.map((a: any) => a.id);
      if (apuracaoIds.length === 0) return [];
      const { data, error } = await supabase
        .from('t2_pagamentos')
        .select('apuracao_id, valor_pago')
        .in('apuracao_id', apuracoes.map((a: any) => a.id));
      if (error) throw error;
      return data;
    },
    enabled: apuracoes.length > 0,
  });

  // 4. Buscar adiantamentos
  const { data: adiantamentos = [] } = useQuery({
    queryKey: ['t2-inadimplencia-adiantamentos', cicloIds],
    queryFn: async () => {
      if (cicloIds.length === 0) return [];
      const { data, error } = await supabase
        .from('t2_adiantamentos')
        .select('ciclo_id, valor')
        .in('ciclo_id', cicloIds);
      if (error) throw error;
      return data;
    },
    enabled: cicloIds.length > 0,
  });

  // 5. Representantes para filtro
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

  // Mapas de cálculo
  const apuracaoValorEmpresa = useMemo(() => {
    const map: Record<string, number> = {};
    apuracoes.forEach((a: any) => { map[a.ciclo_id] = Number(a.valor_empresa) || 0; });
    return map;
  }, [apuracoes]);

  const apuracaoIdByCiclo = useMemo(() => {
    const map: Record<string, string> = {};
    apuracoes.forEach((a: any) => { map[a.ciclo_id] = a.id; });
    return map;
  }, [apuracoes]);

  const totalPagamentosByApuracao = useMemo(() => {
    const map: Record<string, number> = {};
    pagamentos.forEach((p: any) => {
      map[p.apuracao_id] = (map[p.apuracao_id] || 0) + Number(p.valor_pago);
    });
    return map;
  }, [pagamentos]);

  const totalAdiantamentosByCiclo = useMemo(() => {
    const map: Record<string, number> = {};
    adiantamentos.forEach((a: any) => {
      map[a.ciclo_id] = (map[a.ciclo_id] || 0) + Number(a.valor);
    });
    return map;
  }, [adiantamentos]);

  const calcSaldo = (cicloId: string) => {
    const valorEmpresa = apuracaoValorEmpresa[cicloId] || 0;
    // Se não tem apuração, usar valor_kit do ciclo como fallback
    if (!apuracaoIdByCiclo[cicloId]) {
      const ciclo = ciclos.find((c: any) => c.id === cicloId);
      const valorKit = Number(ciclo?.valor_kit || 0);
      const adiant = totalAdiantamentosByCiclo[cicloId] || 0;
      return valorKit - adiant;
    }
    const apuracaoId = apuracaoIdByCiclo[cicloId];
    const pags = totalPagamentosByApuracao[apuracaoId] || 0;
    const adiant = totalAdiantamentosByCiclo[cicloId] || 0;
    return valorEmpresa - pags - adiant;
  };

  const hoje = startOfDay(new Date());

  // Filtrar inadimplentes: data_cobranca < hoje && saldo > 0
  const inadimplentes = useMemo(() => {
    return ciclos
      .filter((c: any) => {
        const dataCobranca = new Date(c.data_cobranca);
        if (!isBefore(startOfDay(dataCobranca), hoje)) return false;
        const saldo = calcSaldo(c.id);
        if (saldo <= 0) return false;
        // Filtros do usuário
        if (filtroRepresentante !== 'todos' && c.representante_id !== filtroRepresentante) return false;
        if (filtroCidade && !(c.t2_revendedoras?.cidade || '').toLowerCase().includes(filtroCidade.toLowerCase())) return false;
        const dias = differenceInDays(hoje, startOfDay(dataCobranca));
        if (filtroAtraso === '0-15' && dias > 15) return false;
        if (filtroAtraso === '16-30' && (dias < 16 || dias > 30)) return false;
        if (filtroAtraso === '31+' && dias < 31) return false;
        return true;
      })
      .map((c: any) => ({
        ...c,
        diasAtraso: differenceInDays(hoje, startOfDay(new Date(c.data_cobranca))),
        saldoRestante: calcSaldo(c.id),
      }))
      .sort((a: any, b: any) => b.diasAtraso - a.diasAtraso);
  }, [ciclos, apuracaoValorEmpresa, apuracaoIdByCiclo, totalPagamentosByApuracao, totalAdiantamentosByCiclo, filtroRepresentante, filtroCidade, filtroAtraso, hoje]);

  const isLoading = loadingCiclos;

  const getRepName = (id: string) => {
    const rep = representantes.find((r: any) => r.id === id);
    return rep?.nome || 'N/A';
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inadimplência T2</h1>
        <p className="text-sm text-muted-foreground">Ciclos com cobrança vencida e saldo pendente</p>
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
      ) : inadimplentes.length === 0 ? (
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
                <th className="py-3 px-2 font-medium text-muted-foreground text-right">Saldo Restante</th>
                <th className="py-3 px-2 font-medium text-muted-foreground text-center">Data Cobrança</th>
                <th className="py-3 px-2 font-medium text-muted-foreground text-center">Dias em Atraso</th>
              </tr>
            </thead>
            <tbody>
              {inadimplentes.map((c: any) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 px-2 font-medium">
                    {c.t2_revendedoras?.nome_exibicao || c.t2_revendedoras?.nome_completo || 'N/A'}
                  </td>
                  <td className="py-3 px-2 text-muted-foreground">{c.t2_revendedoras?.cidade || '-'}</td>
                  <td className="py-3 px-2">{getRepName(c.representante_id)}</td>
                  <td className="py-3 px-2 text-right font-semibold text-destructive">
                    {formatarValor(c.saldoRestante)}
                  </td>
                  <td className="py-3 px-2 text-center">{new Date(c.data_cobranca).toLocaleDateString('pt-BR')}</td>
                  <td className="py-3 px-2 text-center">
                    <Badge variant="destructive" className="text-xs">{c.diasAtraso} dias</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
