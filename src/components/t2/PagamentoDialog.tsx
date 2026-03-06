import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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

interface PagamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apuracao: any;
}

export function PagamentoDialog({ open, onOpenChange, apuracao }: PagamentoDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [valorPago, setValorPago] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('');
  const [observacao, setObservacao] = useState('');

  const saldo = Number(apuracao?.saldo_a_receber || 0);
  const pago = Number(valorPago) || 0;
  const isInvalid = pago > saldo || pago <= 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (isInvalid) throw new Error('Valor inválido');
      const { error } = await supabase.from('t2_pagamentos').insert({
        apuracao_id: apuracao.id,
        valor_pago: pago,
        forma_pagamento: formaPagamento || null,
        observacao: observacao.trim() || null,
        registrado_por: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['t2-apuracoes'] });
      queryClient.invalidateQueries({ queryKey: ['t2-pagamentos'] });
      queryClient.invalidateQueries({ queryKey: ['t2-ciclos'] });
      onOpenChange(false);
      setValorPago('');
      setFormaPagamento('');
      setObservacao('');
      toast({ title: 'Pagamento registrado!' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>
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
          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} />
          </div>
          <Button
            className="w-full"
            disabled={isInvalid || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Registrando...' : 'Confirmar Pagamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
