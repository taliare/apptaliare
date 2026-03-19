import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

interface InteracaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ciclo: any;
}

export function InteracaoDialog({ open, onOpenChange, ciclo }: InteracaoDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [observacao, setObservacao] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      if (!observacao.trim()) throw new Error('Informe a observação');
      const { error } = await supabase.from('t2_interacoes' as any).insert({
        ciclo_id: ciclo.id,
        observacao: observacao.trim(),
        registrado_por: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['t2-interacoes'] });
      onOpenChange(false);
      setObservacao('');
      toast({ title: 'Interação registrada!' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setObservacao(''); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Interação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Revendedora: <strong className="text-foreground">{ciclo?.t2_revendedoras?.nome_completo || 'Revendedora'}</strong>
          </p>
          <div>
            <Label>Observação</Label>
            <Textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={4}
              placeholder="Descreva a interação realizada..."
            />
          </div>
          <Button
            className="w-full"
            disabled={!observacao.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Registrando...' : 'Registrar Interação'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
