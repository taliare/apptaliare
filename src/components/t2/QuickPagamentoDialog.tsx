import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { FORMAS_PAGAMENTO } from './constants';
import { format, addDays } from 'date-fns';

interface QuickPagamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ciclo: any;
}

export function QuickPagamentoDialog({ open, onOpenChange, ciclo }: QuickPagamentoDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [valorPago, setValorPago] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('');
  const [observacao, setObservacao] = useState('');
  const [novaDataCobranca, setNovaDataCobranca] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));

  const { data: apuracao } = useQuery({
    queryKey: ['t2-apuracao-ciclo', ciclo?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('t2_apuracoes')
        .select('id, ciclo_id, valor_empresa, saldo_a_receber')
        .eq('ciclo_id', ciclo.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!ciclo?.id && open,
  });

  const saldo = Number(apuracao?.saldo_a_receber || 0);
  const pago = Number(valorPago) || 0;
  const isPartial = pago > 0 && pago < saldo;
  const isInvalid = pago > saldo || pago <= 0;

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!apuracao) throw new Error('Ciclo sem apuração');
      if (isInvalid) throw new Error('Valor inválido');
      const { error } = await (supabase as any).from('t2_pagamentos').insert({
        apuracao_id: apuracao.id,
        valor_pago: pago,
        forma_pagamento: formaPagamento || null,
        observacao: observacao.trim() || null,
        registrado_por: user!.id,
      });
      if (error) throw error;

      if (isPartial && novaDataCobranca) {
        await (supabase as any)
          .from('t2_ciclos')
          .update({ data_cobranca: novaDataCobranca })
          .eq('id', ciclo.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['t2-apuracoes'] });
      queryClient.invalidateQueries({ queryKey: ['t2-apuracoes-for-ciclos'] });
      queryClient.invalidateQueries({ queryKey: ['t2-pagamentos'] });
      queryClient.invalidateQueries({ queryKey: ['t2-pagamentos-all'] });
      queryClient.invalidateQueries({ queryKey: ['t2-ciclos'] });
      onOpenChange(false);
      resetForm();
      toast({ title: 'Pagamento registrado!' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setValorPago('');
    setFormaPagamento('');
    setObservacao('');
    setNovaDataCobranca(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>
        {!apuracao ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Este ciclo ainda não foi apurado. Registre a prestação de contas antes de registrar pagamentos.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Saldo a receber: <strong className="text-foreground">R$ {fmt(saldo)}</strong>
            </p>
            <div>
              <Label>Valor Pago</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={saldo}
                value={valorPago}
                onChange={e => setValorPago(e.target.value)}
                placeholder="0.00"
              />
              {pago > saldo && (
                <p className="text-sm text-destructive mt-1">
                  Valor não pode ser maior que o saldo (R$ {fmt(saldo)})
                </p>
              )}
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isPartial && (
              <div className="rounded-lg border border-border p-3 bg-muted/30 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  Pagamento parcial — defina a próxima data de cobrança:
                </p>
                <div>
                  <Label>Próxima Data de Cobrança</Label>
                  <Input
                    type="date"
                    value={novaDataCobranca}
                    onChange={e => setNovaDataCobranca(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <Label>Observação</Label>
              <Textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} />
            </div>
            <Button
              className="w-full"
              disabled={isInvalid || mutation.isPending || (isPartial && !novaDataCobranca)}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Registrando...' : 'Confirmar Pagamento'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
