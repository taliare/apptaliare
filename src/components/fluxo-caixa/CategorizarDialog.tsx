import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Categoria {
  id: string;
  nome: string;
}

interface Transacao {
  id: string;
  name_ofx: string | null;
  memo_ofx: string | null;
  descricao: string | null;
  valor: number;
  tipo: string;
  data_transacao: string;
  observacao: string | null;
  categoria_id: string | null;
}

interface Props {
  transacao: Transacao | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

const ymd = (d: string) => d.slice(0, 7);

export function CategorizarDialog({ transacao, open, onOpenChange, onSaved }: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [busca, setBusca] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("dre_categorias_despesas")
      .select("id,nome")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setCategorias(data || []));
    setCategoriaId(transacao?.categoria_id || "");
    setObservacao(transacao?.observacao || "");
    setBusca("");
  }, [open, transacao]);

  const filtradas = categorias.filter((c) =>
    c.nome.toLowerCase().includes(busca.toLowerCase()),
  );

  const salvar = async () => {
    if (!transacao || !categoriaId) {
      toast.error("Selecione uma categoria");
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase
        .from("transacoes_bancarias")
        .update({
          categoria_id: categoriaId,
          observacao: observacao || null,
          status_conciliacao: "conciliado",
        })
        .eq("id", transacao.id);
      if (error) throw error;

      // Criar dre_despesa se for débito
      if (transacao.tipo === "debito") {
        const memo = (transacao.memo_ofx || "").toLowerCase();
        let forma = "Outro";
        if (memo.includes("enviado") || memo.includes("pix")) forma = "Pix";
        else if (memo.includes("cart") || memo.includes("compra")) forma = "Cartão";

        const { data: despesa, error: errDesp } = await supabase
          .from("dre_despesas")
          .insert({
            descricao: transacao.name_ofx || transacao.descricao || "Transação bancária",
            valor: Math.abs(Number(transacao.valor)),
            categoria_id: categoriaId,
            data_pagamento: transacao.data_transacao,
            ano_mes: ymd(transacao.data_transacao),
            status_pagamento: "pago",
            forma_pagamento: forma,
            observacao: observacao || null,
            ocorrencia: "unica",
          })
          .select("id")
          .single();
        if (errDesp) throw errDesp;
        if (despesa) {
          await supabase
            .from("transacoes_bancarias")
            .update({ despesa_id: despesa.id })
            .eq("id", transacao.id);
        }
      }

      toast.success("Transação conciliada");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Categorizar Transação</DialogTitle>
        </DialogHeader>
        {transacao && (
          <div className="space-y-4 overflow-y-auto">
            <div className="text-sm space-y-1 bg-muted/40 rounded p-3">
              <div><strong>Data:</strong> {transacao.data_transacao}</div>
              <div><strong>Descrição:</strong> {transacao.name_ofx || transacao.descricao}</div>
              {transacao.memo_ofx && (
                <div><strong>Memo:</strong> {transacao.memo_ofx}</div>
              )}
              <div>
                <strong>Valor:</strong>{" "}
                {Number(transacao.valor).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Buscar categoria</Label>
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite para filtrar..."
              />
              <div className="max-h-48 overflow-y-auto border rounded">
                {filtradas.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3">Nenhuma categoria</p>
                ) : (
                  filtradas.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoriaId(c.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${
                        categoriaId === c.id ? "bg-accent font-semibold" : ""
                      }`}
                    >
                      {c.nome}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || !categoriaId}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
