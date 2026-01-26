import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Copy,
  Loader2,
} from "lucide-react";

interface ImportedLeadRow {
  nome: string;
  whatsapp: string;
  cidade?: string;
  instagram?: string;
  experiencia_vendas?: string;
  tempo_disponivel?: string;
  capital_inicial?: string;
  motivacao?: string;
  status: "pendente" | "erro" | "sucesso" | "duplicado";
  erro?: string;
}

interface BulkImportLeadsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function BulkImportLeadsDialog({
  open,
  onClose,
}: BulkImportLeadsDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [importedData, setImportedData] = useState<ImportedLeadRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const downloadTemplate = () => {
    const template = [
      {
        nome: "Maria Silva",
        whatsapp: "11999998888",
        cidade: "São Paulo",
        instagram: "@mariasilva",
        experiencia_vendas: "Sim, 2 anos",
        tempo_disponivel: "Meio período",
        capital_inicial: "R$ 500",
        motivacao: "Renda extra",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, "modelo_importacao_leads.xlsx");
    toast.success("Template baixado com sucesso!");
  };

  const parseExcel = async (file: File): Promise<ImportedLeadRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<
            string,
            unknown
          >[];

          // Validar cada linha
          const rows: ImportedLeadRow[] = jsonData.map((row) => {
            const nome = String(row.nome || "").trim();
            const whatsapp = String(row.whatsapp || "").trim();

            if (!nome || !whatsapp) {
              return {
                nome,
                whatsapp,
                cidade: row.cidade ? String(row.cidade).trim() : undefined,
                instagram: row.instagram
                  ? String(row.instagram).trim()
                  : undefined,
                experiencia_vendas: row.experiencia_vendas
                  ? String(row.experiencia_vendas).trim()
                  : undefined,
                tempo_disponivel: row.tempo_disponivel
                  ? String(row.tempo_disponivel).trim()
                  : undefined,
                capital_inicial: row.capital_inicial
                  ? String(row.capital_inicial).trim()
                  : undefined,
                motivacao: row.motivacao
                  ? String(row.motivacao).trim()
                  : undefined,
                status: "erro" as const,
                erro: !nome && !whatsapp
                  ? "Nome e WhatsApp obrigatórios"
                  : !nome
                  ? "Nome obrigatório"
                  : "WhatsApp obrigatório",
              };
            }

            return {
              nome,
              whatsapp,
              cidade: row.cidade ? String(row.cidade).trim() : undefined,
              instagram: row.instagram
                ? String(row.instagram).trim()
                : undefined,
              experiencia_vendas: row.experiencia_vendas
                ? String(row.experiencia_vendas).trim()
                : undefined,
              tempo_disponivel: row.tempo_disponivel
                ? String(row.tempo_disponivel).trim()
                : undefined,
              capital_inicial: row.capital_inicial
                ? String(row.capital_inicial).trim()
                : undefined,
              motivacao: row.motivacao
                ? String(row.motivacao).trim()
                : undefined,
              status: "pendente" as const,
            };
          });

          resolve(rows);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsBinaryString(file);
    });
  };

  const checkDuplicates = async (rows: ImportedLeadRow[]) => {
    // Buscar WhatsApps existentes
    const { data: existingLeads } = await supabase
      .from("leads_revendedoras")
      .select("whatsapp");

    const existingWhatsapps = new Set(
      existingLeads?.map((l) => l.whatsapp.replace(/\D/g, "")) || []
    );

    // Verificar duplicados internos (na própria planilha)
    const seenWhatsapps = new Set<string>();

    rows.forEach((row) => {
      if (row.status === "erro") return;

      const cleanWhatsapp = row.whatsapp.replace(/\D/g, "");

      if (existingWhatsapps.has(cleanWhatsapp)) {
        row.status = "duplicado";
        row.erro = "WhatsApp já existe na base";
      } else if (seenWhatsapps.has(cleanWhatsapp)) {
        row.status = "duplicado";
        row.erro = "WhatsApp duplicado na planilha";
      } else {
        seenWhatsapps.add(cleanWhatsapp);
      }
    });

    return rows;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Por favor, selecione um arquivo Excel (.xlsx ou .xls)");
      return;
    }

    setIsLoading(true);
    setFileName(file.name);

    try {
      let rows = await parseExcel(file);
      rows = await checkDuplicates(rows);
      setImportedData(rows);

      const validCount = rows.filter((r) => r.status === "pendente").length;
      const errorCount = rows.filter(
        (r) => r.status === "erro" || r.status === "duplicado"
      ).length;

      if (validCount === 0) {
        toast.warning("Nenhum lead válido encontrado no arquivo");
      } else {
        toast.success(
          `${validCount} leads válidos encontrados${
            errorCount > 0 ? `, ${errorCount} com problemas` : ""
          }`
        );
      }
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Erro ao processar arquivo Excel");
      setFileName(null);
      setImportedData([]);
    } finally {
      setIsLoading(false);
      // Reset input para permitir reselecionar o mesmo arquivo
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleImport = async () => {
    const validRows = importedData.filter((r) => r.status === "pendente");

    if (validRows.length === 0) {
      toast.error("Nenhum lead válido para importar");
      return;
    }

    setIsImporting(true);

    try {
      const { error } = await supabase.from("leads_revendedoras").insert(
        validRows.map((row) => ({
          nome: row.nome.trim(),
          whatsapp: row.whatsapp.trim(),
          cidade: row.cidade?.trim() || null,
          instagram: row.instagram?.trim() || null,
          experiencia_vendas: row.experiencia_vendas?.trim() || null,
          tempo_disponivel: row.tempo_disponivel?.trim() || null,
          capital_inicial: row.capital_inicial?.trim() || null,
          motivacao: row.motivacao?.trim() || null,
          status: "leads_novos",
          origem: "importacao",
        }))
      );

      if (error) throw error;

      toast.success(`${validRows.length} leads importados com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["leads-revendedoras"] });
      handleClose();
    } catch (error) {
      console.error("Erro ao importar leads:", error);
      toast.error("Erro ao importar leads. Tente novamente.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFileName(null);
    setImportedData([]);
    setIsLoading(false);
    setIsImporting(false);
    onClose();
  };

  const validCount = importedData.filter((r) => r.status === "pendente").length;
  const errorCount = importedData.filter((r) => r.status === "erro").length;
  const duplicateCount = importedData.filter(
    (r) => r.status === "duplicado"
  ).length;

  const getStatusIcon = (status: ImportedLeadRow["status"]) => {
    switch (status) {
      case "pendente":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "erro":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "duplicado":
        return <Copy className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Leads em Massa</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-hidden">
          {/* Botões de ação */}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Baixar Modelo Excel
            </Button>

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Selecionar Arquivo
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Nome do arquivo */}
          {fileName && (
            <p className="text-sm text-muted-foreground">
              Arquivo: <span className="font-medium">{fileName}</span>
            </p>
          )}

          {/* Tabela de preview */}
          {importedData.length > 0 && (
            <ScrollArea className="flex-1 border rounded-md max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Status</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importedData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{getStatusIcon(row.status)}</TableCell>
                      <TableCell className="font-medium">
                        {row.nome || "-"}
                      </TableCell>
                      <TableCell>{row.whatsapp || "-"}</TableCell>
                      <TableCell>{row.cidade || "-"}</TableCell>
                      <TableCell className="text-red-500 text-xs">
                        {row.erro || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {/* Resumo */}
          {importedData.length > 0 && (
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge
                variant="secondary"
                className="bg-green-500/20 text-green-400 border-green-500/30"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {validCount} válidos
              </Badge>
              {errorCount > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-red-500/20 text-red-400 border-red-500/30"
                >
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {errorCount} com erro
                </Badge>
              )}
              {duplicateCount > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {duplicateCount} duplicados
                </Badge>
              )}
              <span className="text-muted-foreground">
                Total: {importedData.length} linhas
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={validCount === 0 || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              `Importar ${validCount} Leads`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
