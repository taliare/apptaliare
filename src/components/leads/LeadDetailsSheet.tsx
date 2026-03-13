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
import { Textarea } from "@/components/ui/textarea";
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
  MapPin,
  Instagram,
  Calendar,
  Clock,
  DollarSign,
  MessageSquare,
  ExternalLink,
  User,
  Trash2,
  AlertTriangle,
  Mail,
  Briefcase,
  Car,
  Home,
  FileText,
  ShieldAlert,
  Target,
  Heart,
} from "lucide-react";
import { LeadRevendedora, KANBAN_COLUMNS, COLUMN_COLORS } from "./types";
import { LeadStatusHistory } from "./LeadStatusHistory";

interface LeadDetailsSheetProps {
  lead: LeadRevendedora | null;
  onClose: () => void;
}

interface Profile {
  id: string;
  nome: string;
}

export function LeadDetailsSheet({ lead, onClose }: LeadDetailsSheetProps) {
  const queryClient = useQueryClient();
  const [observacaoEdit, setObservacaoEdit] = useState("");
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch admins for responsavel select
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
      setObservacaoEdit(lead.observacao || "");
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
      toast({
        title: "Erro ao atualizar lead",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteLead = useMutation({
    mutationFn: async () => {
      if (!lead) throw new Error("No lead selected");

      // Usar função atômica do banco
      const { data, error } = await supabase.rpc("delete_lead_with_history", {
        p_lead_id: lead.id,
      });

      if (error) throw error;

      // Verificar resultado da função
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || "Falha ao excluir lead");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-revendedoras"] });
      toast({ title: "Lead excluído com sucesso!" });
      setShowDeleteConfirm(false);
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir lead",
        description: error.message,
        variant: "destructive",
      });
      setShowDeleteConfirm(false);
    },
  });

  const handleSalvarObservacao = () => {
    updateLead.mutate({ observacao: observacaoEdit });
  };

  const handleResponsavelChange = (value: string) => {
    const newResponsavelId = value === "none" ? null : value;
    const admin = admins.find((a) => a.id === newResponsavelId);
    setResponsavelId(newResponsavelId);
    updateLead.mutate({
      responsavel_id: newResponsavelId,
      responsavel_nome: admin?.nome || null,
    });
  };

  const formatarWhatsapp = (whatsapp: string) => {
    return whatsapp.replace(/\D/g, "");
  };

  if (!lead) return null;

  const currentColumn = KANBAN_COLUMNS.find((c) => c.id === lead.status);
  const colorClass = currentColumn
    ? COLUMN_COLORS[currentColumn.color]
    : COLUMN_COLORS.blue;

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
          {/* Contato */}
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

            {lead.cidade && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {lead.cidade}
              </p>
            )}

            <p className="flex items-center gap-2 text-muted-foreground text-sm">
              <Calendar className="h-4 w-4" />
              {format(parseISO(lead.created_at), "dd/MM/yyyy 'às' HH:mm", {
                locale: ptBR,
              })}
            </p>

            {lead.origem && (
              <p className="text-sm text-muted-foreground">
                Origem: {lead.origem}
              </p>
            )}
          </div>

          <Separator />

          {/* Responsável */}
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              Responsável pelo atendimento
            </Label>
            <Select
              value={responsavelId || "none"}
              onValueChange={handleResponsavelChange}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecionar responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {admins.map((admin) => (
                  <SelectItem key={admin.id} value={admin.id}>
                    {admin.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Dados Pessoais */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Dados Pessoais
            </Label>
            {lead.idade && (
              <div>
                <Label className="text-xs text-muted-foreground">Idade</Label>
                <p className="text-sm">{lead.idade}</p>
              </div>
            )}
            {lead.data_nascimento && (
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <Label className="text-xs text-muted-foreground">Data de Nascimento</Label>
                  <p className="text-sm">{lead.data_nascimento}</p>
                </div>
              </div>
            )}
            {lead.cpf && (
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <Label className="text-xs text-muted-foreground">CPF</Label>
                  <p className="text-sm">{lead.cpf}</p>
                </div>
              </div>
            )}
            {lead.estado_civil && (
              <div className="flex items-start gap-2">
                <Heart className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <Label className="text-xs text-muted-foreground">Estado Civil</Label>
                  <p className="text-sm">{lead.estado_civil}</p>
                </div>
              </div>
            )}
            {lead.profissao && (
              <div className="flex items-start gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <Label className="text-xs text-muted-foreground">Profissão</Label>
                  <p className="text-sm">{lead.profissao}</p>
                </div>
              </div>
            )}
            {lead.email && (
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <Label className="text-xs text-muted-foreground">E-mail</Label>
                  <p className="text-sm">{lead.email}</p>
                </div>
              </div>
            )}
            {lead.telefone_alternativo && (
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <Label className="text-xs text-muted-foreground">Telefone Alternativo</Label>
                  <p className="text-sm">{lead.telefone_alternativo}</p>
                </div>
              </div>
            )}
          </div>

          {/* Endereço */}
          {(lead.cep || lead.endereco || lead.bairro) && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Endereço
                </Label>
                {lead.endereco && (
                  <div className="flex items-start gap-2">
                    <Home className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <Label className="text-xs text-muted-foreground">Endereço</Label>
                      <p className="text-sm">{lead.endereco}</p>
                    </div>
                  </div>
                )}
                {lead.bairro && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Bairro</Label>
                    <p className="text-sm">{lead.bairro}</p>
                  </div>
                )}
                {lead.cep && (
                  <div>
                    <Label className="text-xs text-muted-foreground">CEP</Label>
                    <p className="text-sm">{lead.cep}</p>
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Perfil Comercial */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Perfil Comercial
            </Label>
            {lead.experiencia_vendas && (
              <div>
                <Label className="text-xs text-muted-foreground">Experiência em vendas</Label>
                <p className="text-sm">{lead.experiencia_vendas}</p>
              </div>
            )}
            {lead.tempo_disponivel && (
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <Label className="text-xs text-muted-foreground">Tempo disponível</Label>
                  <p className="text-sm">{lead.tempo_disponivel}</p>
                </div>
              </div>
            )}
            {lead.capital_inicial && (
              <div className="flex items-start gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <Label className="text-xs text-muted-foreground">Capital inicial</Label>
                  <p className="text-sm">{lead.capital_inicial}</p>
                </div>
              </div>
            )}
            {lead.expectativa_venda && (
              <div className="flex items-start gap-2">
                <Target className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <Label className="text-xs text-muted-foreground">Expectativa de venda</Label>
                  <p className="text-sm">{lead.expectativa_venda}</p>
                </div>
              </div>
            )}
            {lead.restricao_serasa && (
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <Label className="text-xs text-muted-foreground">Restrição Serasa</Label>
                  <p className="text-sm">{lead.restricao_serasa}</p>
                </div>
              </div>
            )}
            {lead.possui_veiculo && (
              <div className="flex items-start gap-2">
                <Car className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <Label className="text-xs text-muted-foreground">Possui veículo</Label>
                  <p className="text-sm">{lead.possui_veiculo}</p>
                </div>
              </div>
            )}
            {lead.motivacao && (
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <Label className="text-xs text-muted-foreground">Motivação</Label>
                  <p className="text-sm">{lead.motivacao}</p>
                </div>
              </div>
            )}
          </div>

          {/* UTMs */}
          {(lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
            <>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground">UTM</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {lead.utm_source && (
                    <Badge variant="outline" className="text-xs">
                      source: {lead.utm_source}
                    </Badge>
                  )}
                  {lead.utm_medium && (
                    <Badge variant="outline" className="text-xs">
                      medium: {lead.utm_medium}
                    </Badge>
                  )}
                  {lead.utm_campaign && (
                    <Badge variant="outline" className="text-xs">
                      campaign: {lead.utm_campaign}
                    </Badge>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Observação */}
          <div>
            <Label className="text-xs text-muted-foreground">Observação</Label>
            <Textarea
              value={observacaoEdit}
              onChange={(e) => setObservacaoEdit(e.target.value)}
              className="mt-1"
              rows={3}
              placeholder="Adicione uma observação..."
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={handleSalvarObservacao}
              disabled={updateLead.isPending}
            >
              Salvar Observação
            </Button>
          </div>

          <Separator />

          {/* Histórico */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              Histórico de Status
            </Label>
            <LeadStatusHistory leadId={lead.id} />
          </div>

          <Separator />

          {/* Excluir - Confirmação Inline */}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleteLead.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteLead.mutate()}
                    disabled={deleteLead.isPending}
                  >
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
