import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function calcularIdade(dataNascimento: string): number {
  const nascimento = new Date(dataNascimento);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  return idade;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated user to prevent AI credit abuse
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { lead } = await req.json();
    if (!lead || !lead.nome) {
      return new Response(JSON.stringify({ error: "Lead data is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Você é um assistente especializado em triagem de revendedoras para a Taliare Semijoias, uma empresa de semijoias em consignação que atua em Manaus, Manacapuru, Rio Preto da Eva e Presidente Figueiredo (AM).

O campo Endereço completo sempre contém a cidade da candidata. Nunca aponte ausência de localização se este campo estiver preenchido. A idade da candidata já foi calculada a partir da data de nascimento — nunca aponte ausência de idade.

Analise o perfil abaixo e gere um score de triagem baseado nos critérios reais da empresa:

CRITÉRIOS DE APROVAÇÃO:
- Profissão com renda fixa ou estável (garante reposição em caso de calote)
- Profissão com acesso a público para revender (hospital, escola, salão, empresa grande, etc.)
- Motivação empreendedora — quer crescer, já revendeu antes, leva a sério o negócio
- Idade madura (preferencialmente acima de 25 anos) — mais responsabilidade financeira
- Cidade dentro da área de atuação (Manaus, Manacapuru, Rio Preto da Eva, Presidente Figueiredo)
- Experiência prévia em vendas ou revendas

CRITÉRIOS DE REPROVAÇÃO:
- Motivação de desespero financeiro ("preciso muito de renda", "estou sem emprego", "para sustentar minha casa") — alto risco de calote
- Muito jovem sem base financeira (abaixo de 20 anos)
- Sem profissão ou profissão sem renda estável
- Cidade fora da área de atuação
- Linguagem que demonstra falta de seriedade ou comprometimento

PERFIL DA CANDIDATA:
- Nome: ${lead.nome}
- Idade: ${lead.data_nascimento ? calcularIdade(lead.data_nascimento) + ' anos' : 'Não informada'}
- Endereço completo (contém bairro e cidade): ${lead.endereco || 'Não informado'}
- Profissão/Trabalho atual: ${lead.profissao || 'Não informado'}
- Instagram: ${lead.instagram ? '@' + lead.instagram : 'Não informado'}
- Já teve experiência com vendas?: ${lead.experiencia_vendas || 'Não informado'}
- Quantidade de filhos: ${lead.capital_inicial || 'Não informado'}
- Por que deveríamos escolher você como revendedora?: ${lead.motivacao || 'Não informado'}
- Qual é o seu sonho e objetivo de vida?: ${lead.expectativa_renda || 'Não informado'}

Responda APENAS neste formato:
RECOMENDAÇÃO: [APROVAR / REVISAR / REPROVAR]
SCORE: [número de 0 a 100]
RESUMO: [2 linhas explicando a recomendação]
PONTOS POSITIVOS: [liste em tópicos, ou "Nenhum identificado"]
PONTOS DE ATENÇÃO: [liste em tópicos, ou "Nenhum identificado"]`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "Você é um assistente de triagem de revendedoras. Responda sempre em português brasileiro, de forma objetiva e no formato solicitado.",
            },
            { role: "user", content: prompt },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos nas configurações." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`Erro na API de IA: ${response.status}`);
    }

    const data = await response.json();
    const texto = data.choices?.[0]?.message?.content || "";

    if (!texto) {
      throw new Error("Resposta vazia da IA");
    }

    return new Response(JSON.stringify({ analysis: texto }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-lead error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
