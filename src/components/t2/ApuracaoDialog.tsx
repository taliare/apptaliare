import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { getComissaoFaixa } from "./constants";

interface ApuracaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ciclo: any;
}

export function ApuracaoDialog({ open, onOpenChange, ciclo }: ApuracaoDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [valorDevolvido, setValorDevolvido] = useState("");

  // Buscar total de adiantamentos do ciclo
  const { data: totalAdiantamentos = 0 } = useQuery({
    queryKey: ["t2-adiantamentos-total", ciclo?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("t2_adiantamentos").select("valor").eq("ciclo_id", ciclo.id);
      if (error) throw error;
      return data.reduce((sum: number, a: any) => sum + Number(a.valor), 0);
    },
    enabled: !!ciclo?.id && open,
  });

  const valorKit = Number(ciclo?.valor_kit || 0);
  const devolvido = Number(valorDevolvido) || 0;
  const valorVendido = Math.max(0, valorKit - devolvido);
  const { percentual, categoria } = getComissaoFaixa(valorVendido);
  const valorComissao = valorVendido * (percentual / 100);
  const valorEmpresa = valorVendido - valorComissao;
  const saldoAReceber = Math.max(0, valorEmpresa - totalAdiantamentos);

  const isInvalid = devolvido > valorKit || devolvido < 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (isInvalid) throw new Error("Valor devolvido inválido");
      const { error } = await supabase.from("t2_apuracoes").insert({
        ciclo_id: ciclo.id,
        valor_kit: valorKit,
        valor_devolvido: devolvido,
        valor_vendido: valorVendido,
        percentual_comissao: percentual,
        valor_comissao: valorComissao,
        valor_empresa: valorEmpresa,
        saldo_a_receber: saldoAReceber,
        apurado_por: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["t2-ciclos"] });
      queryClient.invalidateQueries({ queryKey: ["t2-apuracoes"] });
      onOpenChange(false);
      setValorDevolvido("");
      toast({ title: "Apuração registrada com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Prestação de Contas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Valor do Kit</Label>
            <p className="text-lg font-bold text-foreground">R$ {fmt(valorKit)}</p>
          </div>

          {totalAdiantamentos > 0 && (
            <div className="flex justify-between text-sm rounded-md border border-border p-2 bg-muted/20">
              <span className="text-muted-foreground">Adiantamentos Registrados:</span>
              <span className="font-semibold text-primary">R$ {fmt(totalAdiantamentos)}</span>
            </div>
          )}

          <div>
            <Label>Valor Devolvido</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={valorKit}
              value={valorDevolvido}
              onChange={(e) => setValorDevolvido(e.target.value)}
              placeholder="0.00"
            />
            {isInvalid && (
              <p className="text-sm text-destructive mt-1">
                Valor devolvido não pode ser maior que o valor do kit (R$ {fmt(valorKit)})
              </p>
            )}
          </div>

          {valorDevolvido !== "" && !isInvalid && (
            <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor Vendido:</span>
                <span className="font-semibold">R$ {fmt(valorVendido)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Categoria:</span>
                <span className="font-semibold">{categoria}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Comissão ({percentual}%):</span>
                <span className="font-semibold">R$ {fmt(valorComissao)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2">
                <span className="text-muted-foreground font-medium">Valor Empresa:</span>
                <span className="font-bold">R$ {fmt(valorEmpresa)}</span>
              </div>
              {totalAdiantamentos > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">(-) Adiantamentos:</span>
                  <span className="font-semibold text-primary">R$ {fmt(totalAdiantamentos)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-border pt-2">
                <span className="text-muted-foreground font-medium">Saldo a Receber:</span>
                <span className="font-bold text-primary">R$ {fmt(saldoAReceber)}</span>
              </div>
            </div>
          )}

          <Button
            className="w-full"
            disabled={!valorDevolvido || isInvalid || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Registrando..." : "Confirmar Apuração"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
