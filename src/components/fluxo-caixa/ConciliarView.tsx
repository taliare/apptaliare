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
import { CategorizarDialog } from "./CategorizarDialog";

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

  const totais = useMemo(() => {
    const c = { entradas: 0, saidas: 0 };
    transacoes.forEach((t) => {
      if (t.tipo === "credito") c.entradas += Number(t.valor);
      else c.saidas += Math.abs(Number(t.valor));
    });
    return c;
  }, [transacoes]);

  return (
    <div className="space-y-4">
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

        <div className="sm:ml-auto text-sm text-muted-foreground">
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
                              variant="outline"
                              onClick={() => abrirCategorizar(t)}
                            >
                              Categorizar
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

      <CategorizarDialog
        transacao={editando}
        open={open}
        onOpenChange={setOpen}
        onSaved={carregar}
      />
    </div>
  );
}
