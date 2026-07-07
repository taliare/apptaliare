import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDateBR } from '@/lib/utils';
import { format } from 'date-fns';
import { ArrowRight, Info } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cobrancaId: string | null;
  contagem: number;
}

interface HistRow {
  id: string;
  data_anterior: string;
  data_nova: string;
  criado_em: string;
  nome_usuario: string | null;
}

export function HistoricoReagendamentosDialog({ open, onOpenChange, cobrancaId, contagem }: Props) {
  const { data: rows = [], isLoading } = useQuery<HistRow[]>({
    queryKey: ['reagendamentos-historico', cobrancaId],
    enabled: !!cobrancaId && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('reagendamentos_historico')
        .select('id, data_anterior, data_nova, criado_em, nome_usuario')
        .eq('cobranca_id', cobrancaId)
        .order('criado_em', { ascending: true });
      if (error) throw error;
      return (data ?? []) as HistRow[];
    },
  });

  const legado = Math.max(0, (contagem || 0) - rows.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Histórico de Reagendamentos</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3">
          {legado > 0 && (
            <div className="flex gap-2 items-start rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {legado} reagendamento(s) anterior(es) sem detalhe registrado.
                O histórico detalhado (data → data) começa a partir de 02/07/2026.
              </span>
            </div>
          )}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : rows.length === 0 && legado === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum reagendamento registrado.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.id} className="rounded-md border border-border p-3 bg-card">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span>{formatDateBR(r.data_anterior)}</span>
                    <ArrowRight className="h-4 w-4 text-primary" />
                    <span>{formatDateBR(r.data_nova)}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(r.criado_em), "dd/MM/yyyy 'às' HH:mm")}
                    {r.nome_usuario ? ` · ${r.nome_usuario}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
