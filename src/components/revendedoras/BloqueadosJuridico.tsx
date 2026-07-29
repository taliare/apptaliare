import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Search, ShieldBan, ShieldCheck, Lock } from 'lucide-react';

interface Bloqueado {
  id: string;
  nome_norm: string;
  cpf: string | null;
  origem: string | null;
  bloqueado: boolean;
  liberado_em: string | null;
  liberado_por: string | null;
  motivo_liberacao: string | null;
}

function formatarCpf(cpf: string | null) {
  if (!cpf) return null;
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export default function BloqueadosJuridico() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const queryClient = useQueryClient();

  const [busca, setBusca] = useState('');
  const [mostrarLiberadas, setMostrarLiberadas] = useState(false);
  const [desbloquearAlvo, setDesbloquearAlvo] = useState<Bloqueado | null>(null);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ['juridico-bloqueados', mostrarLiberadas],
    queryFn: async () => {
      let query = (supabase.from('juridico_bloqueados' as any) as any)
        .select('id, nome_norm, cpf, origem, bloqueado, liberado_em, liberado_por, motivo_liberacao')
        .order('nome_norm');
      if (!mostrarLiberadas) query = query.eq('bloqueado', true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Bloqueado[];
    },
  });

  const { data: nomesUsuarios = new Map<string, string>() } = useQuery({
    queryKey: ['juridico-bloqueados-liberadores', registros.map((r) => r.liberado_por).join(',')],
    enabled: registros.some((r) => r.liberado_por),
    queryFn: async () => {
      const ids = [...new Set(registros.map((r) => r.liberado_por).filter(Boolean))] as string[];
      const { data } = await supabase.from('profiles').select('id, nome').in('id', ids);
      return new Map((data ?? []).map((p: any) => [p.id, p.nome]));
    },
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toUpperCase();
    const digitos = busca.replace(/\D/g, '');
    if (!termo) return registros;
    return registros.filter(
      (r) =>
        r.nome_norm?.toUpperCase().includes(termo) ||
        (digitos && (r.cpf ?? '').replace(/\D/g, '').includes(digitos))
    );
  }, [registros, busca]);

  const totalBloqueadas = useMemo(() => registros.filter((r) => r.bloqueado).length, [registros]);

  const confirmarDesbloqueio = async () => {
    if (!desbloquearAlvo) return;
    setSalvando(true);
    const { error } = await supabase.rpc('desbloquear_juridico' as any, {
      p_id: desbloquearAlvo.id,
      p_motivo: motivo.trim() || null,
    } as any);
    setSalvando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Revendedora desbloqueada');
    setDesbloquearAlvo(null);
    setMotivo('');
    queryClient.invalidateQueries({ queryKey: ['juridico-bloqueados'] });
  };

  const rebloquear = async (r: Bloqueado) => {
    const { error } = await supabase.rpc('rebloquear_juridico' as any, { p_id: r.id } as any);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Revendedora bloqueada novamente');
    queryClient.invalidateQueries({ queryKey: ['juridico-bloqueados'] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex gap-2 flex-col sm:flex-row sm:items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CPF..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch id="mostrar-liberadas" checked={mostrarLiberadas} onCheckedChange={setMostrarLiberadas} />
              <Label htmlFor="mostrar-liberadas" className="text-sm">Mostrar liberadas</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldBan className="h-5 w-5" />
            {totalBloqueadas} bloqueada{totalBloqueadas !== 1 ? 's' : ''}
            {mostrarLiberadas && (
              <span className="text-sm font-normal text-muted-foreground">
                · {registros.length - totalBloqueadas} liberada(s)
              </span>
            )}
            {busca && (
              <span className="text-sm font-normal text-muted-foreground">
                · {filtrados.length} no filtro
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</div>
          ) : (
            <ul className="divide-y divide-border">
              {filtrados.map((r) => (
                <li
                  key={r.id}
                  className="px-3 sm:px-2 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 hover:bg-accent/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{r.nome_norm}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatarCpf(r.cpf) ?? 'Sem CPF'}
                      {r.origem ? ` · ${r.origem}` : ''}
                    </p>
                    {!r.bloqueado && r.liberado_em && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        Liberada em {new Date(r.liberado_em).toLocaleDateString('pt-BR')}
                        {r.liberado_por && nomesUsuarios.get(r.liberado_por)
                          ? ` por ${nomesUsuarios.get(r.liberado_por)}`
                          : ''}
                        {r.motivo_liberacao ? ` — ${r.motivo_liberacao}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {r.bloqueado ? (
                      <Badge variant="destructive" className="gap-1">
                        <Lock className="h-3 w-3" /> Bloqueada
                      </Badge>
                    ) : (
                      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600 text-white">
                        <ShieldCheck className="h-3 w-3" /> Liberada
                      </Badge>
                    )}

                    {isAdmin && (r.bloqueado ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setDesbloquearAlvo(r); setMotivo(''); }}
                      >
                        Desbloquear
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => rebloquear(r)}>
                        Bloquear novamente
                      </Button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!desbloquearAlvo} onOpenChange={(o) => { if (!o) setDesbloquearAlvo(null); }}>
        <DialogContent className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Desbloquear revendedora</DialogTitle>
            <DialogDescription>
              {desbloquearAlvo?.nome_norm} poderá ser cadastrada normalmente após a liberação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 overflow-y-auto">
            <Label htmlFor="motivo-liberacao">Motivo (opcional)</Label>
            <Textarea
              id="motivo-liberacao"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: débito quitado / cadastro duplicado"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDesbloquearAlvo(null)}>Cancelar</Button>
            <Button onClick={confirmarDesbloqueio} disabled={salvando}>
              {salvando ? 'Liberando...' : 'Confirmar desbloqueio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
