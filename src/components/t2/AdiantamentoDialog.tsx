import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

interface AdiantamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ciclo: any;
}

export function AdiantamentoDialog({ open, onOpenChange, ciclo }: AdiantamentoDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [valor, setValor] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('pix');
  const [observacao, setObservacao] = useState('');

  const { data: totalAdiantamentos = 0 } = useQuery({
    queryKey: ['t2-adiantamentos-total', ciclo?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('t2_adiantamentos')
        .select('valor')
        .eq('ciclo_id', ciclo.id);
      if (error) throw error;
      return data.reduce((sum: number, a: any) => sum + Number(a.valor), 0);
    },
    enabled: !!ciclo?.id,
  });

  const valorKit = Number(ciclo?.valor_kit || 0);
  const valorNum = Number(valor) || 0;
  const limiteDisponivel = Math.max(0, valorKit - totalAdiantamentos);
  const isInvalid = valorNum <= 0 || valorNum > limiteDisponivel;

  const mutation = useMutation({
    mutationFn: async () => {
      if (isInvalid) throw new Error('Valor inválido');
      const { data, error } = await (supabase as any).from('t2_adiantamentos').insert({
        ciclo_id: ciclo.id,
        revendedora_id: ciclo.revendedora_id,
        representante_id: ciclo.representante_id,
        valor: valorNum,
        forma_pagamento: formaPagamento,
        observacao: observacao || null,
        registrado_por: user!.id,
      }).select();
      if (error) { console.error("t2_adiantamentos INSERT ERROR:", error); throw error; }
      console.log("t2_adiantamentos INSERT OK:", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['t2-adiantamentos'] });
      queryClient.invalidateQueries({ queryKey: ['t2-adiantamentos-total'] });
      queryClient.invalidateQueries({ queryKey: ['t2-ciclos'] });
      onOpenChange(false);
      setValor('');
      setObservacao('');
      toast({ title: 'Adiantamento registrado com sucesso!' });
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
          <DialogTitle>Registrar Adiantamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Valor do Kit</Label>
            <p className="text-lg font-bold text-foreground">R$ {fmt(valorKit)}</p>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Já adiantado:</span>
            <span className="font-semibold">R$ {fmt(totalAdiantamentos)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Limite disponível:</span>
            <span className="font-semibold">R$ {fmt(limiteDisponivel)}</span>
          </div>
          <div>
            <Label>Valor do Adiantamento</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={limiteDisponivel}
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="0.00"
            />
            {valor && isInvalid && (
              <p className="text-sm text-destructive mt-1">
                Valor deve ser entre R$ 0,01 e R$ {fmt(limiteDisponivel)}
              </p>
            )}
          </div>
          <div>
            <Label>Forma de Pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observação (opcional)</Label>
            <Textarea value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="..." />
          </div>
          <Button
            className="w-full"
            disabled={!valor || isInvalid || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Registrando...' : 'Confirmar Adiantamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
