import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { PagamentoDialog } from './PagamentoDialog';
import { FORMAS_PAGAMENTO } from './constants';

interface ApuracoesSectionProps {
  cicloId: string;
}

export function ApuracoesSection({ cicloId }: ApuracoesSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [pagApuracao, setPagApuracao] = useState<any>(null);

  const { data: apuracoes = [] } = useQuery({
    queryKey: ['t2-apuracoes', cicloId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_apuracoes')
        .select('*')
        .eq('ciclo_id', cicloId)
        .order('data_apuracao', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ['t2-pagamentos', cicloId],
    queryFn: async () => {
      if (apuracoes.length === 0) return [];
      const ids = apuracoes.map((a: any) => a.id);
      const { data, error } = await supabase
        .from('t2_pagamentos')
        .select('*')
        .in('apuracao_id', ids)
        .order('data_pagamento', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: apuracoes.length > 0,
  });

  if (apuracoes.length === 0) return null;

  const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const formaLabel = (v: string) => FORMAS_PAGAMENTO.find(f => f.value === v)?.label || v;

  return (
    <div className="mt-2 border-t border-border pt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-primary hover:underline w-full"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {apuracoes.length} apuração(ões)
      </button>

      {expanded && (
        <div className="mt-2 space-y-3">
          {apuracoes.map((ap: any) => {
            const apPagamentos = pagamentos.filter((p: any) => p.apuracao_id === ap.id);
            return (
              <div key={ap.id} className="rounded-md border border-border p-2 text-xs space-y-1 bg-muted/20">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Vendido: R$ {fmt(ap.valor_vendido)}</span>
                  <Badge variant="outline" className="text-[10px]">{ap.comissao_percentual}%</Badge>
                </div>
                <p>Empresa: R$ {fmt(ap.valor_empresa)} · Comissão: R$ {fmt(ap.valor_comissao)}</p>
                <p className="font-semibold">
                  Saldo: <span className={Number(ap.saldo_a_receber) <= 0 ? 'text-green-600' : 'text-orange-600'}>
                    R$ {fmt(ap.saldo_a_receber)}
                  </span>
                </p>

                {Number(ap.saldo_a_receber) > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-7 mt-1"
                    onClick={() => setPagApuracao(ap)}
                  >
                    <DollarSign className="h-3 w-3 mr-1" /> Registrar Pagamento
                  </Button>
                )}

                {apPagamentos.length > 0 && (
                  <div className="mt-1 space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium">Pagamentos:</p>
                    {apPagamentos.map((pg: any) => (
                      <div key={pg.id} className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{new Date(pg.data_pagamento).toLocaleDateString('pt-BR')} · {formaLabel(pg.forma_pagamento || '')}</span>
                        <span className="font-medium text-foreground">R$ {fmt(pg.valor_pago)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pagApuracao && (
        <PagamentoDialog
          open={!!pagApuracao}
          onOpenChange={(o) => !o && setPagApuracao(null)}
          apuracao={pagApuracao}
        />
      )}
    </div>
  );
}
