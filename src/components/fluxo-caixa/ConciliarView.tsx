import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { CategorizarDialog } from "./CategorizarDialog";
import { NovaTransacaoDialog } from "./NovaTransacaoDialog";
import { DespesasRepresentantesView } from "./DespesasRepresentantesView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Conta {
  id: string;
  nome: string;
  banco: string | null;
}

interface Transacao {
  id: string;
  conta_id: string;
  data_transacao: string;
  descricao: string | null;
  name_ofx: string | null;
  memo_ofx: string | null;
  trntype: string | null;
  valor: number;
  tipo: string;
  status_conciliacao: string;
  categoria_id: string | null;
  observacao: string | null;
  despesa_id: string | null;
  categoria?: { nome: string } | null;
}

type Filtro = "todas" | "pendente" | "conciliado" | "ignorado";

const BRL = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ConciliarView() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [contaSel, setContaSel] = useState<string>("");
  const [filtro, setFiltro] = useState<Filtro>("pendente");
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState<Transacao | null>(null);
  const [open, setOpen] = useState(false);
  const [novaOpen, setNovaOpen] = useState(false);

  useEffect(() => {
    supabase
      .from("contas_bancarias")
      .select("id,nome,banco")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => {
        setContas(data || []);
        if (!contaSel && data?.length) setContaSel(data[0].id);
      });
  }, []);

  const carregar = async () => {
    if (!contaSel) return;
    setLoading(true);
    let q = supabase
      .from("transacoes_bancarias")
      .select("*, categoria:dre_categorias_despesas(nome)")
      .eq("conta_id", contaSel)
      .order("data_transacao", { ascending: false });
    if (filtro !== "todas") q = q.eq("status_conciliacao", filtro);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setTransacoes((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [contaSel, filtro]);

  const atualizarStatus = async (
    tx: Transacao,
    status: "pendente" | "ignorado",
  ) => {
    // Se estiver revertendo uma conciliada, remover a despesa criada
    if (tx.status_conciliacao === "conciliado" && tx.despesa_id) {
      await supabase.from("dre_despesas").delete().eq("id", tx.despesa_id);
    }
    const { error } = await supabase
      .from("transacoes_bancarias")
      .update({
        status_conciliacao: status,
        despesa_id: null,
        ...(status === "pendente" ? { categoria_id: null } : {}),
      })
      .eq("id", tx.id);
    if (error) toast.error(error.message);
    else {
      toast.success(status === "pendente" ? "Revertida" : "Ignorada");
      carregar();
    }
  };

  const abrirCategorizar = (tx: Transacao) => {
    setEditando(tx);
    setOpen(true);
  };

  const confirmarDireto = async (tx: Transacao) => {
    if (!tx.categoria_id) {
      abrirCategorizar(tx);
      return;
    }
    try {
      const { error } = await supabase
        .from("transacoes_bancarias")
        .update({ status_conciliacao: "conciliado" })
        .eq("id", tx.id);
      if (error) throw error;

      if (tx.tipo === "debito" && !tx.despesa_id) {
        const memo = (tx.memo_ofx || "").toLowerCase();
        let forma = "Outro";
        if (memo.includes("enviado") || memo.includes("pix")) forma = "Pix";
        else if (memo.includes("cart") || memo.includes("compra")) forma = "Cartão";

        const { data: despesa, error: errDesp } = await supabase
          .from("dre_despesas")
          .insert({
            descricao: tx.name_ofx || tx.descricao || "Transação bancária",
            valor: Math.abs(Number(tx.valor)),
            categoria_id: tx.categoria_id,
            data_pagamento: tx.data_transacao,
            ano_mes: tx.data_transacao.slice(0, 7),
            status_pagamento: "pago",
            forma_pagamento: forma,
            observacao: tx.observacao || null,
            ocorrencia: "unica",
          })
          .select("id")
          .single();
        if (errDesp) throw errDesp;
        if (despesa) {
          await supabase
            .from("transacoes_bancarias")
            .update({ despesa_id: despesa.id })
            .eq("id", tx.id);
        }
      }

      toast.success("Transação conciliada");
      carregar();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  const totais = useMemo(() => {
    const c = { entradas: 0, saidas: 0 };
    transacoes.forEach((t) => {
      if (t.tipo === "credito") c.entradas += Number(t.valor);
      else c.saidas += Math.abs(Number(t.valor));
    });
    return c;
  }, [transacoes]);

  return (
    <Tabs defaultValue="extrato" className="w-full">
      <TabsList>
        <TabsTrigger value="extrato">Extrato Bancário</TabsTrigger>
        <TabsTrigger value="despesas-rep">Despesas dos Representantes</TabsTrigger>
      </TabsList>
      <TabsContent value="despesas-rep" className="mt-4">
        <DespesasRepresentantesView />
      </TabsContent>
      <TabsContent value="extrato" className="mt-4 space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">

        <Select value={contaSel} onValueChange={setContaSel}>
          <SelectTrigger className="w-full sm:w-64">
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

        <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="conciliado">Conciliadas</SelectItem>
            <SelectItem value="ignorado">Ignoradas</SelectItem>
          </SelectContent>
        </Select>

        <Button size="sm" onClick={() => setNovaOpen(true)} className="sm:ml-auto">
          <Plus className="h-4 w-4 mr-1" /> Nova Transação Manual
        </Button>

        <div className="text-sm text-muted-foreground">
          {transacoes.length} {transacoes.length === 1 ? "transação" : "transações"}
          {" · "}
          <span className="text-green-600">{BRL(totais.entradas)}</span>
          {" / "}
          <span className="text-red-600">-{BRL(totais.saidas)}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : transacoes.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma transação</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Memo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transacoes.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap">
                        {t.data_transacao.split("-").reverse().join("/")}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate">
                        {t.name_ofx || t.descricao || "—"}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                        {t.memo_ofx || "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right whitespace-nowrap font-medium ${
                          t.tipo === "credito" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {BRL(Number(t.valor))}
                      </TableCell>
                      <TableCell>
                        {t.categoria?.nome ? (
                          <Badge variant="secondary">{t.categoria.nome}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            t.status_conciliacao === "conciliado"
                              ? "default"
                              : t.status_conciliacao === "ignorado"
                                ? "outline"
                                : "secondary"
                          }
                        >
                          {t.status_conciliacao}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          {t.status_conciliacao !== "conciliado" && (
                            <Button
                              size="sm"
                              variant={t.categoria?.nome ? "default" : "outline"}
                              onClick={() => (t.categoria_id ? confirmarDireto(t) : abrirCategorizar(t))}
                            >
                              {t.categoria?.nome ? "Confirmar" : "Categorizar"}
                            </Button>
                          )}
                          {t.status_conciliacao === "pendente" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => atualizarStatus(t, "ignorado")}
                            >
                              Ignorar
                            </Button>
                          )}
                          {t.status_conciliacao !== "pendente" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => atualizarStatus(t, "pendente")}
                            >
                              Reverter
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </TabsContent>



      <CategorizarDialog
        transacao={editando}
        open={open}
        onOpenChange={setOpen}
        onSaved={carregar}
      />

      <NovaTransacaoDialog
        open={novaOpen}
        onOpenChange={setNovaOpen}
        onSaved={carregar}
        contas={contas}
        contaPadrao={contaSel}
      />
    </div>
  );
}
