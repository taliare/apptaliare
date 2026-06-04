import { supabase } from "@/integrations/supabase/client";

// Regras de auto-categorização baseadas em NAME e MEMO do OFX.
// Cada regra resolve para um nome de categoria existente em dre_categorias_despesas
// (criada automaticamente se não existir).
export interface RegraCategorizacao {
  categoria: string;
  testar: (ctx: { name: string; memo: string; trntype: string; valor: number }) => boolean;
  ignorar?: boolean; // transferência interna
}

const inc = (s: string, needle: string) => s.toUpperCase().includes(needle.toUpperCase());

export const REGRAS: RegraCategorizacao[] = [
  {
    categoria: "Recebimento Taliare",
    ignorar: true,
    testar: ({ name, trntype }) =>
      trntype.toUpperCase() === "CREDIT" && inc(name, "AR COMERCIO DE SEMIJOIAS"),
  },
  { categoria: "Marketing", testar: ({ name }) => inc(name, "FACEBK") },
  { categoria: "Sistemas", testar: ({ name }) => inc(name, "ANTHROPIC") || inc(name, "CLAUDE") },
  { categoria: "Sistemas", testar: ({ name }) => inc(name, "LOVABLE") },
  { categoria: "Sistemas", testar: ({ name }) => inc(name, "APPLE.COM") },
  { categoria: "Transporte", testar: ({ name }) => inc(name, "UBER") },
  { categoria: "Telecom", testar: ({ name }) => inc(name, "TIM S A") || inc(name, "TIM S.A") },
  { categoria: "Operacional", testar: ({ memo }) => memo.trim().toLowerCase() === "taliaresemijoias" },
  { categoria: "Sistemas", testar: ({ memo }) => memo.trim().toLowerCase() === "taliare sistemas" },
];

export interface ResultadoRegra {
  categoria_id: string | null;
  status: "pendente" | "conciliado" | "ignorado";
}

// Cache de categorias por nome (lowercase)
let cacheCategorias: Map<string, string> | null = null;

export async function carregarCacheCategorias() {
  const { data } = await supabase.from("dre_categorias_despesas").select("id,nome");
  cacheCategorias = new Map();
  (data || []).forEach((c) => cacheCategorias!.set(c.nome.toLowerCase(), c.id));
}

export async function obterOuCriarCategoria(nome: string): Promise<string | null> {
  if (!cacheCategorias) await carregarCacheCategorias();
  const key = nome.toLowerCase();
  if (cacheCategorias!.has(key)) return cacheCategorias!.get(key)!;
  const { data, error } = await supabase
    .from("dre_categorias_despesas")
    .insert({ nome, ativo: true })
    .select("id")
    .single();
  if (error || !data) return null;
  cacheCategorias!.set(key, data.id);
  return data.id;
}

export async function aplicarRegras(ctx: {
  name: string;
  memo: string;
  trntype: string;
  valor: number;
}): Promise<ResultadoRegra> {
  for (const r of REGRAS) {
    if (r.testar(ctx)) {
      const id = await obterOuCriarCategoria(r.categoria);
      return {
        categoria_id: id,
        status: r.ignorar ? "ignorado" : "pendente",
      };
    }
  }
  return { categoria_id: null, status: "pendente" };
}

export function invalidarCacheCategorias() {
  cacheCategorias = null;
}
