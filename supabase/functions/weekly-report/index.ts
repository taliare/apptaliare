import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CobrancaDiaria {
  representante_id: string;
  data: string;
  total_cobrado: number;
  total_pix: number | null;
  total_dinheiro: number | null;
  total_cartao: number | null;
  despesa_cobranca: number | null;
  finalizado: boolean | null;
}

interface RepresentanteResumo {
  nome: string;
  diasTrabalhados: number;
  diasNaoFinalizados: number;
  totalCobrado: number;
  totalPix: number;
  totalDinheiro: number;
  totalCartao: number;
  totalDespesas: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📊 Gerando relatório semanal...");

    const supabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Calcular datas da semana anterior (segunda a sábado)
    const hoje = new Date();
    const diasAtras = hoje.getDay() === 0 ? 7 : hoje.getDay(); // Se domingo, volta 7 dias
    
    const fimSemana = new Date(hoje);
    fimSemana.setDate(hoje.getDate() - diasAtras); // Último domingo
    
    const inicioSemana = new Date(fimSemana);
    inicioSemana.setDate(fimSemana.getDate() - 6); // Segunda anterior

    const dataInicio = inicioSemana.toISOString().split("T")[0];
    const dataFim = fimSemana.toISOString().split("T")[0];

    console.log(`📅 Período: ${dataInicio} a ${dataFim}`);

    // Buscar representantes ativos
    const { data: representantes, error: repError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "representante");

    if (repError) throw repError;

    if (!representantes || representantes.length === 0) {
      console.log("Nenhum representante encontrado");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum representante encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const repIds = representantes.map((r) => r.user_id);

    // Buscar perfis dos representantes
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, nome")
      .in("id", repIds);

    if (profileError) throw profileError;

    const profileMap = new Map(profiles?.map((p) => [p.id, p.nome]) || []);

    // Buscar cobranças diárias da semana
    const { data: cobrancas, error: cobError } = await supabaseAdmin
      .from("cobrancas_diarias")
      .select("*")
      .in("representante_id", repIds)
      .gte("data", dataInicio)
      .lte("data", dataFim);

    if (cobError) throw cobError;

    console.log(`📋 ${cobrancas?.length || 0} registros de cobrança encontrados`);

    // Calcular dias úteis na semana (segunda a sábado = 6 dias)
    const diasUteis = 6;

    // Agrupar por representante
    const resumoPorRep: Map<string, RepresentanteResumo> = new Map();

    // Inicializar todos os representantes
    for (const rep of representantes) {
      resumoPorRep.set(rep.user_id, {
        nome: profileMap.get(rep.user_id) || "Sem nome",
        diasTrabalhados: 0,
        diasNaoFinalizados: 0,
        totalCobrado: 0,
        totalPix: 0,
        totalDinheiro: 0,
        totalCartao: 0,
        totalDespesas: 0,
      });
    }

    // Processar cobranças
    for (const cob of (cobrancas || []) as CobrancaDiaria[]) {
      const resumo = resumoPorRep.get(cob.representante_id);
      if (!resumo) continue;

      if (cob.finalizado) {
        resumo.diasTrabalhados++;
        resumo.totalCobrado += cob.total_cobrado || 0;
        resumo.totalPix += cob.total_pix || 0;
        resumo.totalDinheiro += cob.total_dinheiro || 0;
        resumo.totalCartao += cob.total_cartao || 0;
        resumo.totalDespesas += cob.despesa_cobranca || 0;
      } else {
        resumo.diasNaoFinalizados++;
      }
    }

    // Calcular dias sem fechamento (não registrados)
    for (const [repId, resumo] of resumoPorRep) {
      const diasRegistrados = resumo.diasTrabalhados + resumo.diasNaoFinalizados;
      resumo.diasNaoFinalizados = diasUteis - resumo.diasTrabalhados;
    }

    // Formatar valores
    const formatMoney = (value: number) => {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
    };

    // Gerar texto do relatório
    let relatorioTexto = `📊 **RELATÓRIO SEMANAL**\n`;
    relatorioTexto += `📅 Período: ${formatDate(dataInicio)} a ${formatDate(dataFim)}\n\n`;

    let totalGeralCobrado = 0;
    let totalGeralPix = 0;
    let totalGeralDinheiro = 0;
    let totalGeralCartao = 0;
    let totalGeralDespesas = 0;

    const resumosOrdenados = Array.from(resumoPorRep.values()).sort(
      (a, b) => b.totalCobrado - a.totalCobrado
    );

    for (const resumo of resumosOrdenados) {
      relatorioTexto += `👤 **${resumo.nome}**\n`;
      relatorioTexto += `   ✅ Dias trabalhados: ${resumo.diasTrabalhados}/${diasUteis}\n`;
      
      if (resumo.diasNaoFinalizados > 0) {
        relatorioTexto += `   ⚠️ Dias não finalizados: ${resumo.diasNaoFinalizados}\n`;
      }
      
      relatorioTexto += `   💰 Total cobrado: ${formatMoney(resumo.totalCobrado)}\n`;
      relatorioTexto += `   📱 PIX: ${formatMoney(resumo.totalPix)} | 💵 Dinheiro: ${formatMoney(resumo.totalDinheiro)} | 💳 Cartão: ${formatMoney(resumo.totalCartao)}\n`;
      relatorioTexto += `   📉 Despesas: ${formatMoney(resumo.totalDespesas)}\n\n`;

      totalGeralCobrado += resumo.totalCobrado;
      totalGeralPix += resumo.totalPix;
      totalGeralDinheiro += resumo.totalDinheiro;
      totalGeralCartao += resumo.totalCartao;
      totalGeralDespesas += resumo.totalDespesas;
    }

    relatorioTexto += `━━━━━━━━━━━━━━━━━━━━\n`;
    relatorioTexto += `📈 **TOTAIS GERAIS**\n`;
    relatorioTexto += `💰 Total cobrado: ${formatMoney(totalGeralCobrado)}\n`;
    relatorioTexto += `📱 PIX: ${formatMoney(totalGeralPix)}\n`;
    relatorioTexto += `💵 Dinheiro: ${formatMoney(totalGeralDinheiro)}\n`;
    relatorioTexto += `💳 Cartão: ${formatMoney(totalGeralCartao)}\n`;
    relatorioTexto += `📉 Despesas: ${formatMoney(totalGeralDespesas)}\n`;
    relatorioTexto += `💎 Líquido: ${formatMoney(totalGeralCobrado - totalGeralDespesas)}`;

    console.log("📄 Relatório gerado");

    // Buscar admins
    const { data: admins, error: adminError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminError) throw adminError;

    if (!admins || admins.length === 0) {
      console.log("Nenhum admin encontrado");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum admin para notificar" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminIds = admins.map((a) => a.user_id);

    // Criar notificação para cada admin
    const notifications = adminIds.map((adminId) => ({
      user_id: adminId,
      title: `📊 Relatório Semanal - ${formatDate(dataInicio)} a ${formatDate(dataFim)}`,
      message: `Total cobrado: ${formatMoney(totalGeralCobrado)} | Líquido: ${formatMoney(totalGeralCobrado - totalGeralDespesas)}`,
      type: "info",
      link: "/relatorios",
    }));

    const { error: notifError } = await supabaseAdmin
      .from("notifications")
      .insert(notifications);

    if (notifError) {
      console.error("Erro ao inserir notificações:", notifError);
      throw notifError;
    }

    console.log(`📬 ${notifications.length} notificações enviadas para admins`);

    // Enviar push notifications
    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .in("user_id", adminIds);

    if (subscriptions && subscriptions.length > 0) {
      const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

      if (vapidPublicKey && vapidPrivateKey) {
        for (const sub of subscriptions) {
          try {
            const pushPayload = JSON.stringify({
              title: "📊 Relatório Semanal",
              body: `Total: ${formatMoney(totalGeralCobrado)} | Líquido: ${formatMoney(totalGeralCobrado - totalGeralDespesas)}`,
              icon: "/icons/icon-192x192.png",
              badge: "/icons/icon-192x192.png",
              data: { url: "/relatorios" },
            });

            const vapidHeaders = await createVapidHeaders(
              sub.endpoint,
              vapidPublicKey,
              vapidPrivateKey
            );

            const encryptedPayload = await encryptPayload(pushPayload, sub.p256dh, sub.auth);

            await fetch(sub.endpoint, {
              method: "POST",
              headers: {
                ...vapidHeaders,
                "Content-Type": "application/octet-stream",
                "Content-Encoding": "aes128gcm",
                TTL: "86400",
              },
              body: encryptedPayload as unknown as BodyInit,
            });
          } catch (pushError) {
            console.error("Erro ao enviar push:", pushError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        periodo: { inicio: dataInicio, fim: dataFim },
        totalCobrado: totalGeralCobrado,
        totalLiquido: totalGeralCobrado - totalGeralDespesas,
        representantes: resumosOrdenados.length,
        adminsNotificados: adminIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("❌ Erro na função:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

// Helper functions for VAPID and encryption
async function createVapidHeaders(
  endpoint: string,
  publicKey: string,
  privateKey: string
): Promise<Record<string, string>> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: "mailto:contato@taliare.com.br",
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKeyBytes = base64UrlToArrayBuffer(privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = arrayBufferToBase64Url(signature);
  const jwt = `${unsignedToken}.${signatureB64}`;

  return { Authorization: `vapid t=${jwt}, k=${publicKey}` };
}

async function encryptPayload(payload: string, p256dh: string, auth: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);

  const userPublicKeyBytes = base64UrlToArrayBuffer(p256dh);
  const authSecretBytes = base64UrlToArrayBuffer(auth);

  const userPublicKey = await crypto.subtle.importKey(
    "raw",
    userPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );

  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: userPublicKey },
    localKeyPair.privateKey,
    256
  );

  const localPublicKeyBytes = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const authInfo = encoder.encode("Content-Encoding: auth\0");
  const prkCombined = new Uint8Array(authSecretBytes.byteLength + sharedSecret.byteLength);
  prkCombined.set(new Uint8Array(authSecretBytes), 0);
  prkCombined.set(new Uint8Array(sharedSecret), authSecretBytes.byteLength);

  const prkKey = await crypto.subtle.importKey("raw", prkCombined, { name: "HKDF" }, false, ["deriveBits"]);
  const prk = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authInfo, info: new Uint8Array(0) },
    prkKey,
    256
  );

  const keyInfo = encoder.encode("Content-Encoding: aes128gcm\0");
  const keyInfoFull = new Uint8Array(keyInfo.length + 1 + 65 + 65);
  keyInfoFull.set(keyInfo, 0);
  keyInfoFull[keyInfo.length] = 0;
  keyInfoFull.set(new Uint8Array(userPublicKeyBytes), keyInfo.length + 1);
  keyInfoFull.set(new Uint8Array(localPublicKeyBytes), keyInfo.length + 1 + 65);

  const cekKey = await crypto.subtle.importKey("raw", prk, { name: "HKDF" }, false, ["deriveBits"]);
  const cek = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt, info: keyInfoFull },
    cekKey,
    128
  );

  const nonceInfo = encoder.encode("Content-Encoding: nonce\0");
  const nonce = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt, info: nonceInfo },
    cekKey,
    96
  );

  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);

  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes, 0);
  paddedPayload[payloadBytes.length] = 2;

  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPayload);

  const recordSize = 4096;
  const header = new Uint8Array(21 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize, false);
  header[20] = 65;
  header.set(new Uint8Array(localPublicKeyBytes), 21);

  const result = new Uint8Array(header.length + encrypted.byteLength);
  result.set(header, 0);
  result.set(new Uint8Array(encrypted), header.length);

  return result;
}

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
