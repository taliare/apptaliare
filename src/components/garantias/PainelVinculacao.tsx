import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Link2, Link2Off, Check, ChevronsUpDown, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface RevendedoraExterna {
  id: string;
  nome: string | null;
  email: string | null;
  ativo?: boolean;
}

interface RevendedoraInterna {
  id: string;
  nome: string;
  cpf: string | null;
}

function normalizarPalavras(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 1);
}

function sugerirRevendedora(
  nomeExterno: string | null,
  internas: RevendedoraInterna[]
): RevendedoraInterna | null {
  const palavrasExt = new Set(normalizarPalavras(nomeExterno));
  if (palavrasExt.size === 0) return null;

  let melhor: RevendedoraInterna | null = null;
  let melhorScore = 0;

  for (const r of internas) {
    const palavrasInt = normalizarPalavras(r.nome);
    let score = 0;
    for (const p of palavrasInt) {
      if (palavrasExt.has(p)) score++;
    }
    if (score > melhorScore) {
      melhorScore = score;
      melhor = r;
    }
  }

  return melhorScore >= 2 ? melhor : null;
}

interface CardLinhaProps {
  externa: RevendedoraExterna;
  vinculadaInterna: RevendedoraInterna | null;
  internas: RevendedoraInterna[];
  sugestao: RevendedoraInterna | null;
  onVincular: (revendedoraId: string, perfilGarantiaId: string | null) => void;
  isLoading: boolean;
}

function CardLinha({ externa, vinculadaInterna, internas, sugestao, onVincular, isLoading }: CardLinhaProps) {
  const [open, setOpen] = useState(false);
  const [selecionadaId, setSelecionadaId] = useState<string | null>(
    vinculadaInterna?.id || sugestao?.id || null
  );

  const selecionada = useMemo(
    () => internas.find((r) => r.id === selecionadaId) || null,
    [internas, selecionadaId]
  );

  const isVinculada = !!vinculadaInterna;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{externa.nome || '—'}</p>
            <p className="text-xs text-muted-foreground truncate">{externa.email || '—'}</p>
          </div>
          {isVinculada ? (
            <Badge className="bg-green-600 hover:bg-green-600 shrink-0">Vinculada</Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0">Não vinculada</Badge>
          )}
        </div>

        {isVinculada && (
          <div className="text-xs text-muted-foreground rounded-md bg-muted px-2 py-1.5">
            Vinculada a: <span className="font-medium text-foreground">{vinculadaInterna?.nome}</span>
          </div>
        )}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between text-left font-normal"
            >
              <span className="truncate">
                {selecionada
                  ? `${selecionada.nome}${selecionada.cpf ? ` — ${selecionada.cpf}` : ''}`
                  : 'Buscar revendedora...'}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command
              filter={(value, search) => {
                const v = value.toLowerCase();
                const s = search.toLowerCase();
                return v.includes(s) ? 1 : 0;
              }}
            >
              <CommandInput placeholder="Buscar por nome ou CPF..." />
              <CommandList>
                <CommandEmpty>Nenhuma revendedora encontrada.</CommandEmpty>
                <CommandGroup>
                  {internas.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`${r.nome} ${r.cpf || ''}`}
                      onSelect={() => {
                        setSelecionadaId(r.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selecionadaId === r.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{r.nome}</span>
                        {r.cpf && (
                          <span className="text-xs text-muted-foreground">{r.cpf}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {!isVinculada && sugestao && selecionadaId === sugestao.id && (
          <p className="text-xs text-muted-foreground">
            💡 Sugestão automática por similaridade de nome
          </p>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={!selecionadaId || isLoading || selecionadaId === vinculadaInterna?.id}
            onClick={() => selecionadaId && onVincular(selecionadaId, externa.id)}
          >
            <Link2 className="h-4 w-4 mr-1" />
            {isVinculada ? 'Atualizar' : 'Vincular'}
          </Button>
          {isVinculada && vinculadaInterna && (
            <Button
              size="sm"
              variant="outline"
              disabled={isLoading}
              onClick={() => onVincular(vinculadaInterna.id, null)}
            >
              <Link2Off className="h-4 w-4 mr-1" />
              Desvincular
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PainelVinculacao() {
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<'todas' | 'vinculadas' | 'nao-vinculadas'>('todas');
  const [busca, setBusca] = useState('');

  const { data: externalData, isLoading: loadingExternas } = useQuery({
    queryKey: ['vinculacao-revendedoras-external'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-revendedoras-external');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { revendedoras: RevendedoraExterna[]; vinculados: string[] };
    },
  });

  const { data: internas = [], isLoading: loadingInternas } = useQuery({
    queryKey: ['vinculacao-revendedoras-internas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('revendedoras')
        .select('id, nome, cpf, perfil_garantia_id')
        .order('nome', { ascending: true });
      if (error) throw error;
      return (data || []) as (RevendedoraInterna & { perfil_garantia_id: string | null })[];
    },
  });

  const linkMutation = useMutation({
    mutationFn: async ({ revendedoraId, perfilGarantiaId }: { revendedoraId: string; perfilGarantiaId: string | null }) => {
      const { data, error } = await supabase.functions.invoke('link-revendedora-garantia', {
        body: { revendedoraId, perfilGarantiaId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.perfilGarantiaId ? 'Vinculação realizada!' : 'Vínculo removido!');
      queryClient.invalidateQueries({ queryKey: ['vinculacao-revendedoras-external'] });
      queryClient.invalidateQueries({ queryKey: ['vinculacao-revendedoras-internas'] });
    },
    onError: (err: any) => {
      toast.error(`Erro: ${err?.message || 'falha ao vincular'}`);
    },
  });

  // Mapa: perfil_garantia_id (externo) -> revendedora interna
  const mapaVinculados = useMemo(() => {
    const m = new Map<string, RevendedoraInterna>();
    for (const r of internas) {
      const pid = (r as any).perfil_garantia_id as string | null;
      if (pid) m.set(pid, { id: r.id, nome: r.nome, cpf: r.cpf });
    }
    return m;
  }, [internas]);

  const externas = externalData?.revendedoras || [];

  const externasFiltradas = useMemo(() => {
    let lista = externas;
    if (filtro === 'vinculadas') {
      lista = lista.filter((e) => mapaVinculados.has(e.id));
    } else if (filtro === 'nao-vinculadas') {
      lista = lista.filter((e) => !mapaVinculados.has(e.id));
    }
    if (busca.trim()) {
      const t = busca.toLowerCase();
      lista = lista.filter(
        (e) => e.nome?.toLowerCase().includes(t) || e.email?.toLowerCase().includes(t)
      );
    }
    return lista;
  }, [externas, filtro, busca, mapaVinculados]);

  const totalVinculadas = externas.filter((e) => mapaVinculados.has(e.id)).length;
  const totalNaoVinc = externas.length - totalVinculadas;

  const isLoading = loadingExternas || loadingInternas;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Vincular Contas de Garantia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filtro === 'todas' ? 'default' : 'outline'}
              onClick={() => setFiltro('todas')}
            >
              Todas ({externas.length})
            </Button>
            <Button
              size="sm"
              variant={filtro === 'vinculadas' ? 'default' : 'outline'}
              onClick={() => setFiltro('vinculadas')}
            >
              Vinculadas ({totalVinculadas})
            </Button>
            <Button
              size="sm"
              variant={filtro === 'nao-vinculadas' ? 'default' : 'outline'}
              onClick={() => setFiltro('nao-vinculadas')}
            >
              Não vinculadas ({totalNaoVinc})
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : externasFiltradas.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma conta encontrada.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {externasFiltradas.map((externa) => {
              const vinculada = mapaVinculados.get(externa.id) || null;
              const sugestao = !vinculada ? sugerirRevendedora(externa.nome, internas) : null;
              return (
                <CardLinha
                  key={externa.id}
                  externa={externa}
                  vinculadaInterna={vinculada}
                  internas={internas}
                  sugestao={sugestao}
                  isLoading={linkMutation.isPending}
                  onVincular={(revendedoraId, perfilGarantiaId) =>
                    linkMutation.mutate({ revendedoraId, perfilGarantiaId })
                  }
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
