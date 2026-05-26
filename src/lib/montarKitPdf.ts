import jsPDF from "jspdf";
import { formatarValor } from "@/lib/utils";

export type ItemKit = {
  codigo_barras: string;
  descricao_snapshot: string | null;
  categoria_snapshot: string | null;
  preco_snapshot: number;
  quantidade: number;
  referencia?: string | null;
};

const formatarDataBR = (iso?: string | null) => {
  const d = iso ? new Date(iso) : new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
};

// Cache em memória da logo já convertida (evita refazer fetch a cada PDF)
const logoCache = new Map<string, string>();

async function carregarLogoBase64(url: string): Promise<string | null> {
  if (!url) return null;
  if (logoCache.has(url)) return logoCache.get(url)!;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("read error"));
      reader.readAsDataURL(blob);
    });
    logoCache.set(url, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

const drawHeader = (
  doc: jsPDF,
  titulo: string,
  dataStr: string,
  logoBase64?: string | null
) => {
  if (logoBase64) {
    try {
      const fmt = logoBase64.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(logoBase64, fmt, 150, 6, 46, 24);
    } catch {
      // ignora silenciosamente se a imagem falhar
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(139, 21, 56);
  doc.text("TALIARE", 14, 18);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text(titulo, 14, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Data: ${dataStr}`, 14, 35);
  doc.setDrawColor(200);
  doc.line(14, 38, 196, 38);
};


const drawFooter = (doc: jsPDF) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    "Taliare Semi-Joias — Documento gerado automaticamente",
    105,
    pageHeight - 8,
    { align: "center" }
  );
  doc.setTextColor(0);
};

const checkPageBreak = (doc: jsPDF, y: number, threshold = 280): number => {
  if (y > threshold) {
    drawFooter(doc);
    doc.addPage();
    return 20;
  }
  return y;
};

export async function gerarPdfDetalhado(
  numero: string,
  itens: ItemKit[],
  dataIso?: string | null,
  logoUrl?: string | null
): Promise<Blob> {
  const logo = logoUrl ? await carregarLogoBase64(logoUrl) : null;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const dataStr = formatarDataBR(dataIso);

  // Sort: categoria asc, depois descrição
  const ordenados = [...itens].sort((a, b) => {
    const ca = (a.categoria_snapshot ?? "").toLowerCase();
    const cb = (b.categoria_snapshot ?? "").toLowerCase();
    if (ca !== cb) return ca.localeCompare(cb);
    return (a.descricao_snapshot ?? "").localeCompare(b.descricao_snapshot ?? "");
  });

  const totalPecas = ordenados.reduce((s, i) => s + (i.quantidade || 1), 0);
  const totalValor = ordenados.reduce(
    (s, i) => s + (i.preco_snapshot || 0) * (i.quantidade || 1),
    0
  );

  drawHeader(doc, `Kit #${numero} — Detalhado`, dataStr, logo);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Total de peças: ${totalPecas}`, 14, 46);
  doc.text(`Valor total: ${formatarValor(totalValor)}`, 110, 46);

  // Header da tabela
  let y = 56;
  doc.setFillColor(139, 21, 56);
  doc.setTextColor(255);
  doc.rect(14, y - 5, 182, 7, "F");
  doc.setFontSize(9);
  doc.text("Ref.", 16, y);
  doc.text("Descrição", 38, y);
  doc.text("Categoria", 100, y);
  doc.text("Cód. Barras", 135, y);
  doc.text("Preço", 192, y, { align: "right" });
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  y += 6;

  let lastCat = "";
  let zebra = false;
  for (const it of ordenados) {
    y = checkPageBreak(doc, y);
    if (y === 20) {
      drawHeader(doc, `Kit #${numero} — Detalhado (cont.)`, dataStr, logo);
      y = 50;
      doc.setFillColor(139, 21, 56);
      doc.setTextColor(255);
      doc.rect(14, y - 5, 182, 7, "F");
      doc.setFontSize(9);
      doc.text("Ref.", 16, y);
      doc.text("Descrição", 38, y);
      doc.text("Categoria", 100, y);
      doc.text("Cód. Barras", 135, y);
      doc.text("Preço", 192, y, { align: "right" });
      doc.setTextColor(0);
      y += 6;
    }

    const cat = it.categoria_snapshot ?? "";
    if (cat !== lastCat) {
      lastCat = cat;
      zebra = !zebra;
    }

    if (zebra) {
      doc.setFillColor(245, 240, 242);
      doc.rect(14, y - 4, 182, 6, "F");
    }

    const desc = (it.descricao_snapshot ?? "").substring(0, 38);
    const ref = (it.referencia ?? "").substring(0, 10);
    doc.setFontSize(8.5);
    doc.text(ref, 16, y);
    doc.text(desc, 38, y);
    doc.text(cat.substring(0, 18), 100, y);
    doc.text(it.codigo_barras.substring(0, 18), 135, y);
    doc.text(formatarValor(it.preco_snapshot), 192, y, { align: "right" });
    y += 6;
  }

  drawFooter(doc);
  return doc.output("blob");
}

export function gerarPdfResumido(
  numero: string,
  itens: ItemKit[],
  dataIso?: string | null
): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const dataStr = formatarDataBR(dataIso);

  drawHeader(doc, `Kit #${numero} — Resumo por Categoria`, dataStr);

  // Agrupar por categoria
  const grupos = new Map<string, { qtd: number; total: number }>();
  for (const it of itens) {
    const cat = it.categoria_snapshot ?? "Sem categoria";
    const cur = grupos.get(cat) ?? { qtd: 0, total: 0 };
    cur.qtd += it.quantidade || 1;
    cur.total += (it.preco_snapshot || 0) * (it.quantidade || 1);
    grupos.set(cat, cur);
  }
  const linhas = Array.from(grupos.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const totalQtd = linhas.reduce((s, [, v]) => s + v.qtd, 0);
  const totalVal = linhas.reduce((s, [, v]) => s + v.total, 0);

  let y = 50;
  doc.setFillColor(139, 21, 56);
  doc.setTextColor(255);
  doc.rect(14, y - 5, 182, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Categoria", 18, y);
  doc.text("Qtd. Peças", 120, y, { align: "right" });
  doc.text("Valor Total", 192, y, { align: "right" });
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  y += 8;

  for (const [cat, v] of linhas) {
    y = checkPageBreak(doc, y);
    doc.setFontSize(10);
    doc.text(cat, 18, y);
    doc.text(String(v.qtd), 120, y, { align: "right" });
    doc.text(formatarValor(v.total), 192, y, { align: "right" });
    y += 7;
  }

  // Linha total
  doc.setDrawColor(180);
  doc.line(14, y, 196, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL GERAL", 18, y);
  doc.text(String(totalQtd), 120, y, { align: "right" });
  doc.text(formatarValor(totalVal), 192, y, { align: "right" });
  y += 14;
  doc.setFont("helvetica", "normal");

  // Termo
  doc.setDrawColor(200);
  doc.line(14, y, 196, y);
  y += 8;
  doc.setFontSize(10);
  const termo =
    "Declaro que recebi as peças listadas acima em perfeito estado e me comprometo a devolver ou repassar o valor correspondente conforme acordado.";
  const termoLines = doc.splitTextToSize(termo, 182);
  doc.text(termoLines, 14, y);
  y += termoLines.length * 5 + 14;

  doc.text(`Data: ___/___/______`, 14, y);
  y += 14;
  doc.text("Assinatura: _______________________________________", 14, y);
  y += 10;
  doc.text("Nome: ___________________________________________", 14, y);
  y += 10;
  doc.text("CPF: _____________________________________________", 14, y);

  drawFooter(doc);
  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
