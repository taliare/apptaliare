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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Conta {
  id: string;
  nome: string;
  banco: string | null;
}
interface Categoria {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  contas: Conta[];
  contaPadrao?: string;
}

const todayLocal = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
};

export function NovaTransacaoDialog({
  open,
  onOpenChange,
  onSaved,
  contas,
  contaPadrao,
}: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contaId, setContaId] = useState("");
  const [tipo, setTipo] = useState<"credito" | "debito">("debito");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(todayLocal());
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
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
    setContaId(contaPadrao || contas[0]?.id || "");
    setTipo("debito");
    setValor("");
    setData(todayLocal());
    setDescricao("");
    setCategoriaId("");
    setObservacao("");
  }, [open, contaPadrao, contas]);

  const salvar = async () => {
    const v = parseFloat(valor.replace(",", "."));
    if (!contaId) return toast.error("Selecione a conta");
    if (!v || v <= 0) return toast.error("Informe um valor válido");
    if (!data) return toast.error("Informe a data");
    if (!descricao.trim()) return toast.error("Informe a descrição");
    if (!categoriaId) return toast.error("Selecione uma categoria");

    setSalvando(true);
    try {
      const valorAssinado = tipo === "credito" ? v : -v;
      const idExterno = `manual_${crypto.randomUUID()}`;

      const { data: tx, error } = await supabase
        .from("transacoes_bancarias")
        .insert({
          conta_id: contaId,
          data_transacao: data,
          descricao: descricao.trim(),
          name_ofx: descricao.trim(),
          memo_ofx: null,
          trntype: tipo === "credito" ? "CREDIT" : "DEBIT",
          valor: valorAssinado,
          tipo,
          id_externo: idExterno,
          categoria_id: categoriaId,
          status_conciliacao: "conciliado",
          observacao: observacao.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (tipo === "debito") {
        const { data: despesa, error: errDesp } = await supabase
          .from("dre_despesas")
          .insert({
            descricao: descricao.trim(),
            valor: v,
            categoria_id: categoriaId,
            data_pagamento: data,
            ano_mes: data.slice(0, 7),
            status_pagamento: "pago",
            forma_pagamento: "Manual",
            observacao: observacao.trim() || null,
            ocorrencia: "unica",
          })
          .select("id")
          .single();
        if (errDesp) throw errDesp;
        if (despesa && tx) {
          await supabase
            .from("transacoes_bancarias")
            .update({ despesa_id: despesa.id })
            .eq("id", tx.id);
        }
      }

      toast.success("Transação lançada");
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
          <DialogTitle>Nova Transação Manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <Label>Conta *</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credito">Entrada</SelectItem>
                  <SelectItem value="debito">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Data *</Label>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Pagamento fornecedor X"
            />
          </div>

          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
