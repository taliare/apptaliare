import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { profilesLimited } from "@/lib/profilesLimited";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  Phone,
  Instagram,
  Calendar,
  ExternalLink,
  User,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { LeadRevendedora, KANBAN_COLUMNS, COLUMN_COLORS } from "./types";
import { LeadStatusHistory } from "./LeadStatusHistory";
import { LeadObservacoes } from "./LeadObservacoes";

interface LeadDetailsSheetProps {
  lead: LeadRevendedora | null;
  onClose: () => void;
}

interface Profile {
  id: string;
  nome: string;
}

const formatBooleanValue = (value: string | null): string | null => {
  if (!value) return null;
  const lower = value.toLowerCase().trim();
  if (lower === "true" || lower === "sim" || lower === "yes") return "Sim";
  if (lower === "false" || lower === "nao" || lower === "não" || lower === "no") return "Não";
  return value;
};

interface FieldRow {
  label: string;
  value: string | number | null | undefined;
  formatBoolean?: boolean;
}

function LeadFieldsTable({ fields }: { fields: FieldRow[] }) {
  return (
    <div className="space-y-1">
      {fields.map((field) => {
        const displayValue = field.formatBoolean
          ? formatBooleanValue(field.value as string | null)
          : field.value;
        const hasValue = displayValue !== null && displayValue !== undefined && displayValue !== "";

        return (
          <div key={field.label} className="flex justify-between items-start py-1.5 border-b border-border/50 last:border-0">
            <span className="text-xs text-muted-foreground font-medium shrink-0 mr-3">
              {field.label}
            </span>
            <span className={`text-sm text-right ${hasValue ? "text-foreground" : "text-muted-foreground/50 italic"}`}>
              {hasValue ? String(displayValue) : "Não informado"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function LeadDetailsSheet({ lead, onClose }: LeadDetailsSheetProps) {
  const queryClient = useQueryClient();
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: admins = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await profilesLimited()
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data as Profile[];
    },
  });

  useEffect(() => {
    if (lead) {
      setResponsavelId(lead.responsavel_id);
      setShowDeleteConfirm(false);
    }
  }, [lead]);

  const updateLead = useMutation({
    mutationFn: async (updates: Partial<LeadRevendedora>) => {
      if (!lead) throw new Error("No lead selected");
      const { error } = await supabase
        .from("leads_revendedoras")
        .update(updates)
        .eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-revendedoras"] });
      toast({ title: "Lead atualizado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar lead", description: error.message, variant: "destructive" });
    },
  });

  const deleteLead = useMutation({
    mutationFn: async () => {
      if (!lead) throw new Error("No lead selected");
      const { data, error } = await supabase.rpc("delete_lead_with_history", { p_lead_id: lead.id });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error || "Falha ao excluir lead");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-revendedoras"] });
      toast({ title: "Lead excluído com sucesso!" });
      setShowDeleteConfirm(false);
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir lead", description: error.message, variant: "destructive" });
      setShowDeleteConfirm(false);
    },
  });

  const handleResponsavelChange = (value: string) => {
    const newResponsavelId = value === "none" ? null : value;
    const admin = admins.find((a) => a.id === newResponsavelId);
    setResponsavelId(newResponsavelId);
    updateLead.mutate({
      responsavel_id: newResponsavelId,
      responsavel_nome: admin?.nome || null,
    });
  };

  const formatarWhatsapp = (whatsapp: string) => whatsapp.replace(/\D/g, "");

  if (!lead) return null;

  const currentColumn = KANBAN_COLUMNS.find((c) => c.id === lead.status);
  const colorClass = currentColumn ? COLUMN_COLORS[currentColumn.color] : COLUMN_COLORS.blue;

  const allFields: FieldRow[] = [
    { label: "Nome", value: lead.nome },
    { label: "WhatsApp", value: lead.whatsapp },
    { label: "Instagram", value: lead.instagram },
    { label: "Data de Nascimento", value: lead.data_nascimento },
    { label: "CPF", value: lead.cpf },
    { label: "Estado Civil", value: lead.estado_civil },
    { label: "E-mail", value: lead.email },
    { label: "Telefone Alternativo", value: lead.telefone_alternativo },
    { label: "Profissão", value: lead.profissao },
    { label: "Endereço", value: lead.endereco },
    { label: "Experiência em Vendas", value: lead.experiencia_vendas },
    { label: "Capital Inicial", value: lead.capital_inicial },
    { label: "Motivação", value: lead.motivacao },
    { label: "Restrição Serasa", value: lead.restricao_serasa, formatBoolean: true },
    { label: "Tentativas", value: lead.tentativas },
    { label: "Último Envio", value: lead.ultimo_envio },
    { label: "Origem", value: lead.origem },
  ];

  return (
    <Sheet open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            {lead.nome}
            <Badge className={colorClass}>{currentColumn?.label || lead.status}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Quick contact links */}
          <div className="space-y-2">
            <a
              href={`https://wa.me/${formatarWhatsapp(lead.whatsapp)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-green-500 hover:underline"
            >
              <Phone className="h-4 w-4" />
              {lead.whatsapp}
              <ExternalLink className="h-3 w-3" />
            </a>
            {lead.instagram && (
              <a
                href={`https://instagram.com/${lead.instagram.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-pink-500 hover:underline"
              >
                <Instagram className="h-4 w-4" />
                {lead.instagram}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <p className="flex items-center gap-2 text-muted-foreground text-sm">
              <Calendar className="h-4 w-4" />
              Cadastrado em {format(parseISO(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>

          <Separator />

          {/* Responsável */}
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              Responsável pelo atendimento
            </Label>
            <Select value={responsavelId || "none"} onValueChange={handleResponsavelChange}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecionar responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {admins.map((admin) => (
                  <SelectItem key={admin.id} value={admin.id}>{admin.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Todas as Respostas do Formulário */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Todas as Respostas
            </Label>
            <LeadFieldsTable fields={allFields} />
          </div>

          <Separator />

          {/* Observações */}
          <LeadObservacoes leadId={lead.id} />

          <Separator />

          {/* Histórico */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Histórico de Status</Label>
            <LeadStatusHistory leadId={lead.id} />
          </div>

          <Separator />

          {/* Excluir */}
          <div>
            {showDeleteConfirm ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Excluir lead?</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Esta ação não pode ser desfeita. O lead "{lead.nome}" será removido permanentemente.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLead.isPending}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteLead.mutate()} disabled={deleteLead.isPending}>
                    {deleteLead.isPending ? "Excluindo..." : "Confirmar Exclusão"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Lead
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
