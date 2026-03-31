import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
  FileDown,
  Loader2,
} from "lucide-react";
import { LeadRevendedora, KANBAN_COLUMNS, COLUMN_COLORS } from "./types";
import { LeadStatusHistory } from "./LeadStatusHistory";
import { LeadObservacoes } from "./LeadObservacoes";
import { generateLeadPdf } from "@/lib/generateLeadPdf";

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
  const { profile } = useAuth();
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [analisandoIA, setAnalisandoIA] = useState(false);
  const [analiseFeita, setAnaliseFeita] = useState(false);

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

  const { data: observacoes = [] } = useQuery({
    queryKey: ['leads-observacoes-check', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase
        .from('leads_observacoes')
        .select('conteudo')
        .eq('lead_id', lead.id)
        .ilike('conteudo', '%ANÁLISE DE IA%')
        .limit(1);
      return data || [];
    },
    enabled: !!lead?.id,
  });

  useEffect(() => {
    if (lead) {
      setResponsavelId(lead.responsavel_id);
      setShowDeleteConfirm(false);
      setAnaliseFeita(false);
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

  const handleExportPdf = async () => {
    if (!lead) return;
    setIsExporting(true);
    try {
      const [obsRes, histRes] = await Promise.all([
        supabase
          .from("leads_observacoes")
          .select("*")
          .eq("lead_id", lead.id)
          .order("criado_em", { ascending: true }),
        supabase
          .from("leads_status_historico")
          .select("*")
          .eq("lead_id", lead.id)
          .order("criado_em", { ascending: true }),
      ]);
      await generateLeadPdf(lead, obsRes.data || [], histRes.data || []);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Erro ao gerar PDF", description: message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const analisarComIA = async () => {
    if (!lead || !profile) return;
    setAnalisandoIA(true);
    try {
      const prompt = `Você é um assistente especializado em triagem de revendedoras para a Taliare Semijoias, uma empresa de semijoias em consignação que atua em Manaus, Manacapuru, Rio Preto da Eva e Presidente Figueiredo (AM).

Analise o perfil abaixo e gere um score de triagem baseado nos critérios reais da empresa:

CRITÉRIOS DE APROVAÇÃO:
- Profissão com renda fixa ou estável (garante reposição em caso de calote no ciclo de consignação)
- Profissão com acesso a público para revender (hospital, escola, salão, empresa grande, comércio, etc.)
- Motivação empreendedora — quer crescer, já revendeu antes, leva a sério o negócio, menciona a marca Taliare
- Idade madura (preferencialmente acima de 25 anos) — mais responsabilidade financeira
- Cidade dentro da área de atuação (Manaus, Manacapuru, Rio Preto da Eva, Presidente Figueiredo)
- Experiência prévia em vendas ou revendas
- Respondeu todas as perguntas do formulário com honestidade e atenção

CRITÉRIOS DE REPROVAÇÃO:
- Motivação de desespero financeiro ("preciso muito de renda", "estou sem emprego", "para sustentar minha casa", "terminar meus estudos") — alto risco de calote
- Muito jovem sem base financeira (abaixo de 20 anos)
- Sem profissão ou profissão sem renda estável
- Cidade fora da área de atuação
- Linguagem que demonstra falta de seriedade ou comprometimento
- Deixou campos importantes em branco ou respondeu de forma evasiva (especialmente a pergunta sobre restrição no Serasa — quando não responde, é sinal de desonestidade)
- Formulário preenchido com dados incorretos (ex: colocou telefone no campo de motivação)

IMPORTANTE SOBRE O SERASA: Ter restrição no Serasa não é critério de reprovação, pois a grande maioria das candidatas tem restrições. O que importa é quando ela NÃO responde essa pergunta — isso indica desonestidade.

PERFIL DA CANDIDATA:
- Nome: ${lead.nome}
- Idade: ${lead.idade || 'Não informada'}
- Profissão: ${lead.profissao || 'Não informada'}
- Estado Civil: ${lead.estado_civil || 'Não informado'}
- Cidade: ${lead.cidade || 'Não informada'}
- Experiência em vendas: ${lead.experiencia_vendas || 'Não informada'}
- Motivação: ${lead.motivacao || 'Não informada'}
- Quantidade de filhos: ${lead.capital_inicial || 'Não informada'}
- Tempo disponível para vendas: ${lead.tempo_disponivel || 'Não informado'}
- Possui restrição no Serasa: ${lead.restricao_serasa || 'NÃO RESPONDEU (atenção)'}
- Expectativa de venda: ${lead.expectativa_venda || 'Não informada'}

Responda APENAS neste formato:
RECOMENDAÇÃO: [APROVAR / REVISAR / REPROVAR]
SCORE: [número de 0 a 100]
RESUMO: [2 linhas explicando a recomendação]
PONTOS POSITIVOS: [liste em tópicos, ou "Nenhum identificado"]
PONTOS DE ATENÇÃO: [liste em tópicos, ou "Nenhum identificado"]`;

      const { data, error: fnError } = await supabase.functions.invoke("analyze-lead", {
        body: { lead, prompt },
      });

      if (fnError) throw new Error(fnError.message || "Erro ao chamar a função de análise");
      if (data?.error) throw new Error(data.error);

      const texto = data?.analysis;
      if (!texto) throw new Error("Resposta vazia da IA");

      const conteudo = `🤖 ANÁLISE DE IA\n\n${texto}`;
      const { error } = await supabase.from("leads_observacoes").insert({
        lead_id: lead.id,
        autor_id: profile.id,
        autor_nome: "IA Taliare",
        conteudo,
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["leads-observacoes", lead.id] });
      queryClient.invalidateQueries({ queryKey: ["leads-observacoes-check", lead.id] });
      toast({ title: "✅ Análise concluída!", description: "O resultado foi salvo nas observações." });
      setAnaliseFeita(true);
    } catch (err: any) {
      toast({ title: "Erro na análise", description: err.message, variant: "destructive" });
    } finally {
      setAnalisandoIA(false);
    }
  };

  if (!lead) return null;

  const currentColumn = KANBAN_COLUMNS.find((c) => c.id === lead.status);
  const colorClass = currentColumn ? COLUMN_COLORS[currentColumn.color] : COLUMN_COLORS.blue;

  const formatSerasaValue = (value: string | null): string => {
    if (!value || value.trim() === '') return 'Não informado';
    const lower = value.toLowerCase().trim();
    if (lower === 'true' || lower === 'sim' || lower === 'yes') return 'Possui restrição';
    if (lower === 'false' || lower === 'nao' || lower === 'não' || lower === 'no') return 'Não possui restrição';
    return value;
  };

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
    { label: "Quantidade de Filhos", value: lead.capital_inicial },
    { label: "Por que escolher você", value: lead.motivacao },
    { label: "Sonho e Objetivo", value: lead.expectativa_venda },
    { label: "Restrição Serasa", value: formatSerasaValue(lead.restricao_serasa) },
    ...((lead as any).objetivo_financeiro_outro ? [{ label: "Detalhe da Restrição", value: (lead as any).objetivo_financeiro_outro }] : []),
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={isExporting}
            className="w-full"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
            Exportar PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={analisarComIA}
            disabled={analisandoIA}
            className="w-full border-primary/30 text-primary hover:bg-primary/10"
          >
            {analisandoIA ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Analisando perfil...
              </>
            ) : (
              <>✨ Analisar com IA</>
            )}
          </Button>
          {(analiseFeita || observacoes.length > 0) && !['ativa', 'reprovada'].includes(lead.status) && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={updateLead.isPending}
                onClick={async () => {
                  await updateLead.mutateAsync({ status: 'ligar_referencias' });
                  navigator.clipboard.writeText(
                    `Olá! Temos uma ótima notícia — *seu perfil foi pré-aprovado pela equipe da TALIARE! 🎉*\nO próximo passo é um bate papo com nosso representante, para conhecer você melhor, tirar dúvidas e verificar suas respostas do formulário, ok?\nO nosso representante tem até 24 horas em dias úteis para entrar em contato com você, então peço que aguarde o contato por favor.\nQualquer dúvida, é só chamar aqui!`
                  );
                  toast({ title: '✅ Lead aprovado!', description: 'Movido para "Ligar para Referências". Mensagem copiada — cole no WhatsApp!' });
                  onClose();
                }}
              >
                ✅ Aprovar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={updateLead.isPending}
                onClick={async () => {
                  await updateLead.mutateAsync({ status: 'reprovada' });
                  navigator.clipboard.writeText(
                    `Olá! \nPassando para agradecer muito pelo seu interesse em fazer parte da TALIARE. 🙏\nApós analisar seu cadastro com cuidado, identificamos que neste momento o seu perfil não se encaixa no que estamos buscando para nossa equipe de revendedoras.\nIsso não significa que a porta está fechada para sempre — perfis e momentos mudam. Se quiser, pode tentar novamente em um próximo ciclo de seleção.\nDesejamos muito sucesso na sua jornada! 😊`
                  );
                  toast({ title: '❌ Lead reprovado!', description: 'Movido para "Reprovadas". Mensagem copiada — cole no WhatsApp!' });
                  onClose();
                }}
              >
                ❌ Reprovar
              </Button>
            </div>
          )}
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
