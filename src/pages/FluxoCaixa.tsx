import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Upload, Wallet } from "lucide-react";
import { DFCView } from "@/components/fluxo-caixa/DFCView";

interface ContaBancaria {
  id: string;
  nome: string;
  banco: string | null;
  tipo: string;
  saldo_inicial: number;
  ativo: boolean;
  saldo_atual?: number;
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function parseOFX(text: string) {
  // Remove SGML header if present, keep body
  const body = text.replace(/\r/g, "");
  const txRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  const tag = (block: string, name: string) => {
    const re = new RegExp(`<${name}>([^<\\r\\n]*)`, "i");
    const m = block.match(re);
    return m ? m[1].trim() : "";
  };
  const parseDate = (raw: string) => {
    // YYYYMMDD or YYYYMMDDHHMMSS
    const s = raw.slice(0, 8);
    if (s.length !== 8) return null;
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  };
  const out: {
    id_externo: string;
    data_transacao: string;
    descricao: string;
    valor: number;
    tipo: "credito" | "debito";
  }[] = [];
  let m;
  while ((m = txRegex.exec(body)) !== null) {
    const block = m[1];
    const fitid = tag(block, "FITID");
    const dt = parseDate(tag(block, "DTPOSTED"));
    const amount = parseFloat(tag(block, "TRNAMT").replace(",", "."));
    const memo = tag(block, "MEMO") || tag(block, "NAME") || "";
    if (!fitid || !dt || isNaN(amount)) continue;
    out.push({
      id_externo: fitid,
      data_transacao: dt,
      descricao: memo,
      valor: amount,
      tipo: amount >= 0 ? "credito" : "debito",
    });
  }
  return out;
}

export default function FluxoCaixa() {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    banco: "",
    tipo: "corrente",
    saldo_inicial: "0",
  });
  const [contaSelecionada, setContaSelecionada] = useState<string>("");
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadContas = async () => {
    setLoading(true);
    const { data: contasData, error } = await supabase
      .from("contas_bancarias")
      .select("*")
      .order("nome");
    if (error) {
      toast.error("Erro ao carregar contas: " + error.message);
      setLoading(false);
      return;
    }
    // Calcular saldo: saldo_inicial + soma valores
    const ids = (contasData || []).map((c) => c.id);
    let somas: Record<string, number> = {};
    if (ids.length) {
      const { data: txs } = await supabase
        .from("transacoes_bancarias")
        .select("conta_id,valor")
        .in("conta_id", ids);
      (txs || []).forEach((t: any) => {
        somas[t.conta_id] = (somas[t.conta_id] || 0) + Number(t.valor);
      });
    }
    setContas(
      (contasData || []).map((c) => ({
        ...c,
        saldo_atual: Number(c.saldo_inicial) + (somas[c.id] || 0),
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    loadContas();
  }, []);

  const criarConta = async () => {
    if (!form.nome.trim()) {
      toast.error("Informe o nome da conta");
      return;
    }
    const { error } = await supabase.from("contas_bancarias").insert({
      nome: form.nome.trim(),
      banco: form.banco.trim() || null,
      tipo: form.tipo,
      saldo_inicial: Number(form.saldo_inicial) || 0,
    });
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Conta criada");
    setDialogOpen(false);
    setForm({ nome: "", banco: "", tipo: "corrente", saldo_inicial: "0" });
    loadContas();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!contaSelecionada) {
      toast.error("Selecione uma conta primeiro");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setImportando(true);
    try {
      const text = await file.text();
      const transacoes = parseOFX(text);
      if (!transacoes.length) {
        toast.error("Nenhuma transação encontrada no OFX");
        return;
      }
      let importadas = 0;
      let ignoradas = 0;
      // Insert one-by-one to detect duplicates per row
      for (const tx of transacoes) {
        const { error } = await supabase.from("transacoes_bancarias").insert({
          conta_id: contaSelecionada,
          ...tx,
        });
        if (error) {
          if (error.code === "23505") ignoradas++;
          else {
            console.error(error);
            ignoradas++;
          }
        } else {
          importadas++;
        }
      }
      toast.success(
        `${importadas} transações importadas, ${ignoradas} ignoradas (duplicatas)`,
      );
      loadContas();
    } catch (err: any) {
      toast.error("Erro ao processar OFX: " + err.message);
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          Fluxo de Caixa
        </h1>
        <p className="text-muted-foreground text-sm">
          Gerencie contas bancárias e importe extratos OFX
        </p>
      </div>

      <Tabs defaultValue="contas" className="w-full">
        <TabsList>
          <TabsTrigger value="contas">Contas</TabsTrigger>
          <TabsTrigger value="importar">Importar</TabsTrigger>
        </TabsList>

        <TabsContent value="contas" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova Conta
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Contas Cadastradas</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : contas.length === 0 ? (
                <p className="text-muted-foreground">
                  Nenhuma conta cadastrada
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">
                        Saldo Inicial
                      </TableHead>
                      <TableHead className="text-right">Saldo Atual</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contas.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell>{c.banco || "—"}</TableCell>
                        <TableCell className="capitalize">{c.tipo}</TableCell>
                        <TableCell className="text-right">
                          {BRL(Number(c.saldo_inicial))}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {BRL(c.saldo_atual || 0)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.ativo ? "default" : "secondary"}>
                            {c.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="importar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Importar Extrato OFX</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Conta destino</Label>
                <Select
                  value={contaSelecionada}
                  onValueChange={setContaSelecionada}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {contas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome} {c.banco ? `(${c.banco})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Arquivo OFX</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <Input
                    ref={fileRef}
                    type="file"
                    accept=".ofx,text/plain"
                    onChange={handleUpload}
                    disabled={importando || !contaSelecionada}
                  />
                  {importando && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Processando...
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Transações duplicadas (mesmo ID OFX para a mesma conta) são
                  ignoradas automaticamente.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Conta Bancária</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Santander Principal"
              />
            </div>
            <div className="space-y-2">
              <Label>Banco</Label>
              <Input
                value={form.banco}
                onChange={(e) => setForm({ ...form, banco: e.target.value })}
                placeholder="Ex: Santander"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm({ ...form, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrente">Conta Corrente</SelectItem>
                  <SelectItem value="poupanca">Poupança</SelectItem>
                  <SelectItem value="pagamento">Conta Pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Saldo Inicial</Label>
              <Input
                type="number"
                step="0.01"
                value={form.saldo_inicial}
                onChange={(e) =>
                  setForm({ ...form, saldo_inicial: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={criarConta}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
