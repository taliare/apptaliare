import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface Categoria {
  id: string;
  nome: string;
}

interface Despesa {
  id: string;
  fechamento_id: string;
  representante_id: string;
  descricao: string;
  valor: number;
  conciliado: boolean;
  categoria_id: string | null;
  criado_em: string;
  representante_nome?: string;
  fechamento_data?: string;
}

const BRL = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DespesasRepresentantesView() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState<Despesa | null>(null);
  const [busca, setBusca] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("despesas_fechamento" as any)
      .select("*")
      .eq("conciliado", false)
      .order("criado_em", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data as any[]) || [];
    const repIds = Array.from(new Set(rows.map((r) => r.representante_id)));
    const fechIds = Array.from(new Set(rows.map((r) => r.fechamento_id)));
    const [{ data: profiles }, { data: fechs }] = await Promise.all([
      repIds.length
        ? supabase.from("profiles").select("id,nome").in("id", repIds)
        : Promise.resolve({ data: [] as any[] }),
      fechIds.length
        ? supabase.from("cobrancas_diarias").select("id,data").in("id", fechIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pMap = new Map((profiles || []).map((p: any) => [p.id, p.nome]));
    const fMap = new Map((fechs || []).map((f: any) => [f.id, f.data]));
    setDespesas(
      rows.map((r) => ({
        ...r,
        representante_nome: pMap.get(r.representante_id) || "—",
        fechamento_data: fMap.get(r.fechamento_id) || null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    supabase
      .from("dre_categorias_despesas")
      .select("id,nome")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setCategorias(data || []));
  }, []);

  const abrir = (d: Despesa) => {
    setEditando(d);
    setCategoriaId("");
    setBusca("");
  };

  const salvar = async () => {
    if (!editando || !categoriaId) {
      toast.error("Selecione uma categoria");
      return;
    }
    setSalvando(true);
    try {
      const dataPag = editando.fechamento_data || editando.criado_em.slice(0, 10);
      const { data: despesa, error: errDesp } = await supabase
        .from("dre_despesas")
        .insert({
          descricao: `[${editando.representante_nome}] ${editando.descricao}`,
          valor: Number(editando.valor),
          categoria_id: categoriaId,
          data_pagamento: dataPag,
          ano_mes: dataPag.slice(0, 7),
          status_pagamento: "pago",
          forma_pagamento: "Outro",
          ocorrencia: "unica",
          observacao: `Despesa do fechamento do representante`,
        })
        .select("id")
        .single();
      if (errDesp) throw errDesp;

      const { error } = await supabase
        .from("despesas_fechamento" as any)
        .update({
          conciliado: true,
          categoria_id: categoriaId,
          despesa_id: despesa!.id,
        })
        .eq("id", editando.id);
      if (error) throw error;

      toast.success("Despesa categorizada e lançada no DRE");
      setEditando(null);
      carregar();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const filtradas = categorias.filter((c) =>
    c.nome.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Despesas dos Representantes</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : despesas.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma despesa pendente de conciliação.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Representante</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {despesas.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-nowrap">
                      {d.fechamento_data
                        ? d.fechamento_data.split("-").reverse().join("/")
                        : "—"}
                    </TableCell>
                    <TableCell>{d.representante_nome}</TableCell>
                    <TableCell className="max-w-[280px] truncate">
                      {d.descricao}
                    </TableCell>
                    <TableCell className="text-right text-red-600 font-medium">
                      {BRL(Number(d.valor))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => abrir(d)}>
                        Categorizar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editando} onOpenChange={(v) => !v && setEditando(null)}>
        <DialogContent className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Categorizar Despesa</DialogTitle>
          </DialogHeader>
          {editando && (
            <div className="space-y-4 overflow-y-auto">
              <div className="text-sm space-y-1 bg-muted/40 rounded p-3">
                <div>
                  <strong>Representante:</strong> {editando.representante_nome}
                </div>
                <div>
                  <strong>Descrição:</strong> {editando.descricao}
                </div>
                <div>
                  <strong>Valor:</strong> {BRL(Number(editando.valor))}
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
                    <p className="text-sm text-muted-foreground p-3">
                      Nenhuma categoria
                    </p>
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
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando || !categoriaId}>
              {salvando ? "Salvando..." : "Confirmar e lançar no DRE"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
