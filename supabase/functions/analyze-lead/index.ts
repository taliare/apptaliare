import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
- Idade: ${lead.idade || "Não informada"}
- Profissão: ${lead.profissao || "Não informada"}
- Estado Civil: ${lead.estado_civil || "Não informado"}
- Cidade: ${lead.cidade || "Não informada"}
- Experiência em vendas: ${lead.experiencia_vendas || "Não informada"}
- Motivação: ${lead.motivacao || "Não informada"}
- Capital inicial: ${lead.capital_inicial || "Não informado"}
- Tempo disponível: ${lead.tempo_disponivel || "Não informado"}
- Restrição Serasa: ${lead.restricao_serasa || "Não informado"}
- Expectativa de venda: ${lead.expectativa_venda || "Não informada"}

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
