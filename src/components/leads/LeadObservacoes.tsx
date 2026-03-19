import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Observacao {
  id: string;
  lead_id: string;
  autor_id: string;
  autor_nome: string;
  conteudo: string;
  criado_em: string;
}

interface LeadObservacoesProps {
  leadId: string;
}

export function LeadObservacoes({ leadId }: LeadObservacoesProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [novaObs, setNovaObs] = useState("");

  const { data: observacoes = [], isLoading } = useQuery({
    queryKey: ["leads-observacoes", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads_observacoes")
        .select("*")
        .eq("lead_id", leadId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data as Observacao[];
    },
  });

  const addObservacao = useMutation({
    mutationFn: async (conteudo: string) => {
      if (!profile) throw new Error("Usuário não autenticado");
      const { error } = await supabase.from("leads_observacoes").insert({
        lead_id: leadId,
        autor_id: profile.id,
        autor_nome: profile.nome,
        conteudo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-observacoes", leadId] });
      setNovaObs("");
      toast({ title: "Observação adicionada!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar observação", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    const trimmed = novaObs.trim();
    if (!trimmed) return;
    addObservacao.mutate(trimmed);
  };

  const getInitials = (nome: string) =>
    nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-3">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
        Observações
      </Label>

      {/* Input */}
      <div className="flex gap-2">
        <Textarea
          value={novaObs}
          onChange={(e) => setNovaObs(e.target.value)}
          placeholder="Adicione uma observação..."
          rows={2}
          className="min-h-[60px] text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit();
          }}
        />
        <Button
          size="icon"
          className="shrink-0 self-end"
          onClick={handleSubmit}
          disabled={!novaObs.trim() || addObservacao.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : observacoes.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhuma observação registrada.</p>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {observacoes.map((obs) => (
            <div key={obs.id} className="flex gap-2 p-2 rounded-lg bg-muted/50 border border-border/50">
              <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  {getInitials(obs.autor_nome)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-foreground">{obs.autor_nome}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(parseISO(obs.criado_em), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap break-words">
                  {obs.conteudo}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
