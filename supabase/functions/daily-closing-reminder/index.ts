import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const cronHeader = req.headers.get("x-cron-secret") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (token !== serviceKey && cronHeader !== serviceKey) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("🔔 Iniciando verificação de fechamentos diários...");

    // Verificar dia da semana (não executar no domingo)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = domingo
    
    if (dayOfWeek === 0) {
      console.log("📅 Hoje é domingo, não enviando lembretes.");
      return new Response(
        JSON.stringify({ success: true, message: "Domingo - nenhum lembrete enviado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use default Supabase environment variables (always available in edge functions)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log("🔑 URL configurada:", supabaseUrl ? "Sim" : "Não");
    console.log("🔑 Service Key configurada:", supabaseServiceKey ? "Sim" : "Não");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Data de hoje no formato yyyy-MM-dd
    const hoje = now.toISOString().split("T")[0];
    console.log(`📅 Verificando fechamentos para: ${hoje}`);

    // Buscar todos os representantes ativos
    const { data: representantes, error: repError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "representante");

    if (repError) {
      console.error("Erro ao buscar representantes:", repError);
      throw repError;
    }

    console.log(`👥 Encontrados ${representantes?.length || 0} representantes`);

    if (!representantes || representantes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum representante encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar fechamentos de hoje
    const { data: fechamentos, error: fechError } = await supabaseAdmin
      .from("cobrancas_diarias")
      .select("representante_id")
      .eq("data", hoje)
      .eq("finalizado", true);

    if (fechError) {
      console.error("Erro ao buscar fechamentos:", fechError);
      throw fechError;
    }

    const fechamentoIds = new Set(fechamentos?.map((f) => f.representante_id) || []);
    console.log(`✅ ${fechamentoIds.size} representantes já finalizaram o dia`);

    // Filtrar representantes que não finalizaram
    const semFechamento = representantes.filter((r) => !fechamentoIds.has(r.user_id));
    console.log(`⚠️ ${semFechamento.length} representantes ainda não finalizaram`);

    if (semFechamento.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Todos os representantes já finalizaram o dia" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar notificações para cada representante sem fechamento
    const notifications = semFechamento.map((rep) => ({
      user_id: rep.user_id,
      title: "Lembrete de Fechamento",
      message: "Você ainda não realizou o fechamento do dia. Finalize sua cobrança diária!",
      type: "warning",
      link: "/cobranca-diaria",
    }));

    const { error: notifError } = await supabaseAdmin
      .from("notifications")
      .insert(notifications);

    if (notifError) {
      console.error("Erro ao inserir notificações:", notifError);
      throw notifError;
    }

    console.log(`📬 ${notifications.length} notificações inseridas`);

    // Enviar push notifications
    const userIds = semFechamento.map((r) => r.user_id);
    
    // Buscar subscriptions de push para esses usuários
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    if (subError) {
      console.error("Erro ao buscar subscriptions:", subError);
    }

    if (subscriptions && subscriptions.length > 0) {
      console.log(`📱 Enviando push para ${subscriptions.length} subscriptions`);

      const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

      if (vapidPublicKey && vapidPrivateKey) {
        let successCount = 0;
        let failCount = 0;

        for (const sub of subscriptions) {
          try {
            const pushPayload = JSON.stringify({
              title: "Lembrete de Fechamento",
              body: "Você ainda não realizou o fechamento do dia. Finalize sua cobrança diária!",
              icon: "/icons/icon-192x192.png",
              badge: "/icons/icon-192x192.png",
              data: {
                url: "/cobranca-diaria",
              },
            });

            // Gerar headers VAPID e criptografar payload
            const vapidHeaders = await createVapidHeaders(
              sub.endpoint,
              vapidPublicKey,
              vapidPrivateKey
            );

            const encryptedPayload = await encryptPayload(
              pushPayload,
              sub.p256dh,
              sub.auth
            );

            const response = await fetch(sub.endpoint, {
              method: "POST",
              headers: {
                ...vapidHeaders,
                "Content-Type": "application/octet-stream",
                "Content-Encoding": "aes128gcm",
                TTL: "86400",
              },
              body: encryptedPayload as unknown as BodyInit,
            });

            if (response.ok || response.status === 201) {
              successCount++;
            } else {
              failCount++;
              console.error(`Push falhou para ${sub.user_id}: ${response.status}`);
              
              // Remover subscription inválida
              if (response.status === 410 || response.status === 404) {
                await supabaseAdmin
                  .from("push_subscriptions")
                  .delete()
                  .eq("id", sub.id);
              }
            }
          } catch (pushError) {
            failCount++;
            console.error(`Erro ao enviar push:`, pushError);
          }
        }

        console.log(`📱 Push: ${successCount} sucesso, ${failCount} falhas`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notificacoes_enviadas: notifications.length,
        representantes_sem_fechamento: semFechamento.length,
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

// Helper functions for VAPID and encryption (same as send-push-notification)
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
  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

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

  return {
    Authorization: `vapid t=${jwt}, k=${publicKey}`,
  };
}

async function encryptPayload(
  payload: string,
  p256dh: string,
  auth: string
): Promise<Uint8Array> {
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

  const localPublicKeyBytes = await crypto.subtle.exportKey(
    "raw",
    localKeyPair.publicKey
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const authInfo = encoder.encode("Content-Encoding: auth\0");
  const prkCombined = new Uint8Array(
    authSecretBytes.byteLength + sharedSecret.byteLength
  );
  prkCombined.set(new Uint8Array(authSecretBytes), 0);
  prkCombined.set(new Uint8Array(sharedSecret), authSecretBytes.byteLength);

  const prkKey = await crypto.subtle.importKey(
    "raw",
    prkCombined,
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );

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
  keyInfoFull.set(
    new Uint8Array(localPublicKeyBytes),
    keyInfo.length + 1 + 65
  );

  const cekKey = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );

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

  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes, 0);
  paddedPayload[payloadBytes.length] = 2;

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    paddedPayload
  );

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
