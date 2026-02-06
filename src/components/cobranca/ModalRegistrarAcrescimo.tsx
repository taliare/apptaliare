import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, formatarValor, getLocalDateString } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ModalRegistrarAcrescimoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kitEntregueId: string;
  revendedora: string;
  codigoKit: string;
}

export function ModalRegistrarAcrescimo({
  open,
  onOpenChange,
  kitEntregueId,
  revendedora,
  codigoKit,
}: ModalRegistrarAcrescimoProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataVencimento, setDataVencimento] = useState<Date>(addDays(new Date(), 30));

  const formatarValorInput = (input: string): string => {
    const apenasNumeros = input.replace(/\D/g, '');
    if (!apenasNumeros) return '';
    const numero = parseFloat(apenasNumeros) / 100;
    return numero.toFixed(2);
  };

  const parseValorFormatado = (input: string): number => {
    const numeros = input.replace(/\D/g, '');
    if (!numeros) return 0;
    return parseFloat(numeros) / 100;
  };

  const resetForm = () => {
    setValor('');
    setDescricao('');
    setDataVencimento(addDays(new Date(), 30));
  };

  const acrescimoMutation = useMutation({
    mutationFn: async () => {
      const valorNumerico = parseValorFormatado(valor);
      if (valorNumerico <= 0) throw new Error('Informe um valor válido');

      const { data, error } = await supabase.rpc('registrar_acrescimo_pedido', {
        p_kit_entregue_id: kitEntregueId,
        p_user_id: user!.id,
        p_revendedora: revendedora,
        p_valor: valorNumerico,
        p_descricao: descricao || null,
        p_data_vencimento: getLocalDateString(dataVencimento),
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erro ao registrar acréscimo');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas-agendadas'] });
      queryClient.invalidateQueries({ queryKey: ['kits-entregues-representante'] });
      toast.success('Acréscimo registrado com sucesso!');
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Erro ao registrar acréscimo: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!valor || parseValorFormatado(valor) <= 0) {
      toast.error('Informe um valor válido para o acréscimo');
      return;
    }
    acrescimoMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Registrar Joias Adicionais
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
            <p><strong>Kit:</strong> {codigoKit}</p>
            <p><strong>Revendedora:</strong> {revendedora}</p>
          </div>

          <div className="space-y-2">
            <Label>Valor do Acréscimo *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
              <Input
                className="pl-10"
                value={valor}
                onChange={(e) => setValor(formatarValorInput(e.target.value))}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: brincos extras, colar adicional..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Data de Vencimento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dataVencimento, "dd/MM/yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataVencimento}
                  onSelect={(date) => date && setDataVencimento(date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={acrescimoMutation.isPending}>
            {acrescimoMutation.isPending ? 'Registrando...' : 'Registrar Acréscimo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
