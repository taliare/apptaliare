import jsPDF from "jspdf";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LeadRevendedora } from "@/components/leads/types";
import { KANBAN_COLUMNS } from "@/components/leads/types";

interface Observacao {
  id: string;
  lead_id: string;
  autor_id: string;
  autor_nome: string;
  conteudo: string;
  criado_em: string;
}

interface StatusHistorico {
  id: string;
  status_anterior: string | null;
  status_novo: string;
  alterado_por_nome: string | null;
  criado_em: string;
}

const MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 6;

function getColumnLabel(statusId: string): string {
  const col = KANBAN_COLUMNS.find((c) => c.id === statusId);
  return col?.label || statusId;
}

function val(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "Não informado";
  return String(v);
}

function formatBool(v: string | null): string {
  if (!v) return "Não informado";
  const l = v.toLowerCase().trim();
  if (l === "true" || l === "sim" || l === "yes") return "Sim";
  if (l === "false" || l === "nao" || l === "não" || l === "no") return "Não";
  return v;
}

async function loadLogoBase64(): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const logoUrl = new URL(
      "../assets/taliare-logo-horizontal.png",
      import.meta.url
    ).href;
    return await new Promise((resolve) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(null);
      img.src = logoUrl;
    });
  } catch {
    return null;
  }
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 280) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = checkPageBreak(doc, y, 14);
  doc.setFillColor(30, 30, 30);
  doc.rect(MARGIN, y, CONTENT_WIDTH, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), MARGIN + 4, y + 5.5);
  doc.setTextColor(50, 50, 50);
  return y + 12;
}

function drawField(doc: jsPDF, label: string, value: string, y: number): number {
  y = checkPageBreak(doc, y, LINE_HEIGHT + 2);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text(label + ":", MARGIN + 2, y);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);

  const maxWidth = CONTENT_WIDTH - 60;
  const xValue = MARGIN + 58;
  const lines = doc.splitTextToSize(value, maxWidth);
  doc.text(lines, xValue, y);

  return y + Math.max(LINE_HEIGHT, lines.length * 4.5) + 1;
}

export async function generateLeadPdf(
  lead: LeadRevendedora,
  observacoes: Observacao[],
  historico: StatusHistorico[] = []
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogoBase64();
  let y = MARGIN;

  // Header
  if (logo) {
    doc.addImage(logo, "PNG", MARGIN, y, 50, 14);
    y += 18;
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Ficha de Cadastro — Revendedora", MARGIN, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(140, 140, 140);
  doc.text(
    `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    MARGIN,
    y
  );
  y += 4;

  // Thin separator
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 6;

  // Section 1 — Dados Pessoais
  y = drawSectionTitle(doc, "Dados Pessoais", y);
  y = drawField(doc, "Nome", val(lead.nome), y);
  y = drawField(doc, "WhatsApp", val(lead.whatsapp), y);
  y = drawField(doc, "Instagram", val(lead.instagram), y);
  y = drawField(doc, "Data de Nascimento", val(lead.data_nascimento), y);
  y = drawField(doc, "CPF", val(lead.cpf), y);
  y = drawField(doc, "Estado Civil", val(lead.estado_civil), y);
  y = drawField(doc, "E-mail", val(lead.email), y);
  y = drawField(doc, "Tel. Alternativo", val(lead.telefone_alternativo), y);
  y = drawField(doc, "Profissão", val(lead.profissao), y);
  y = drawField(doc, "Endereço", val(lead.endereco), y);
  y += 4;

  // Section 2 — Perfil Comercial
  y = drawSectionTitle(doc, "Perfil Comercial", y);
  y = drawField(doc, "Exp. em Vendas", val(lead.experiencia_vendas), y);
  y = drawField(doc, "Capital Inicial", val(lead.capital_inicial), y);
  y = drawField(doc, "Motivação", val(lead.motivacao), y);
  y = drawField(doc, "Restrição Serasa", formatBool(lead.restricao_serasa), y);
  y += 4;

  // Section 3 — Status CRM
  y = drawSectionTitle(doc, "Status no CRM", y);
  y = drawField(doc, "Status Atual", getColumnLabel(lead.status), y);
  y = drawField(doc, "Responsável", val(lead.responsavel_nome), y);
  y = drawField(
    doc,
    "Cadastrado em",
    format(parseISO(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
    y
  );
  y = drawField(doc, "Tentativas", val(lead.tentativas), y);
  y = drawField(doc, "Último Envio", val(lead.ultimo_envio), y);
  y = drawField(doc, "Origem", val(lead.origem), y);
  y += 4;

  // Section 4 — Observações
  y = drawSectionTitle(doc, "Observações", y);
  if (observacoes.length === 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150, 150, 150);
    doc.text("Nenhuma observação registrada.", MARGIN + 2, y);
    y += LINE_HEIGHT;
  } else {
    for (const obs of observacoes) {
      y = checkPageBreak(doc, y, 16);

      // Author + date header
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);
      const obsDate = format(parseISO(obs.criado_em), "dd/MM/yy 'às' HH:mm", {
        locale: ptBR,
      });
      doc.text(`${obs.autor_nome} — ${obsDate}`, MARGIN + 2, y);
      y += 4;

      // Content
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      const lines = doc.splitTextToSize(obs.conteudo, CONTENT_WIDTH - 4);
      for (const line of lines) {
        y = checkPageBreak(doc, y, LINE_HEIGHT);
        doc.text(line, MARGIN + 2, y);
        y += 4.5;
      }
      y += 3;
    }
  }
  y += 4;

  // Section 5 — Histórico de Status
  if (historico.length > 0) {
    y = drawSectionTitle(doc, "Histórico de Status", y);
    for (const h of historico) {
      y = checkPageBreak(doc, y, 10);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      const hDate = format(parseISO(h.criado_em), "dd/MM/yy HH:mm", { locale: ptBR });
      const from = h.status_anterior ? getColumnLabel(h.status_anterior) : "—";
      const to = getColumnLabel(h.status_novo);
      const by = h.alterado_por_nome || "Sistema";
      doc.text(`${hDate}  |  ${from} → ${to}  |  por ${by}`, MARGIN + 2, y);
      y += 5;
    }
  }

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(170, 170, 170);
    doc.text("Documento gerado pelo sistema Taliare", MARGIN, 290);
    doc.text(`Página ${i} de ${totalPages}`, PAGE_WIDTH - MARGIN - 25, 290);
  }

  const nomeArquivo = `${lead.nome.trim().replace(/[^a-zA-ZÀ-ÿ0-9 ]/g, "").replace(/\s+/g, "_")}.pdf`;
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
