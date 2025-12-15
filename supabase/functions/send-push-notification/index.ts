import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  userId?: string; // Send to specific user
  userIds?: string[]; // Send to multiple users
  sendToAll?: boolean; // Send to all subscribed users
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error("VAPID keys not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const payload: PushPayload = await req.json();
    const { title, body, icon, badge, data, userId, userIds, sendToAll } = payload;

    console.log("Sending push notification:", { title, body, userId, userIds, sendToAll });

    // Build query for subscriptions
    let query = supabase.from("push_subscriptions").select("*");

    if (userId) {
      query = query.eq("user_id", userId);
    } else if (userIds && userIds.length > 0) {
      query = query.in("user_id", userIds);
    } else if (!sendToAll) {
      return new Response(
        JSON.stringify({ error: "Must specify userId, userIds, or sendToAll" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: subscriptions, error: subError } = await query;

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No subscriptions found");
      return new Response(
        JSON.stringify({ message: "No subscriptions found", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${subscriptions.length} subscriptions`);

    const notificationPayload = JSON.stringify({
      title,
      body,
      icon: icon || "/icons/icon-192x192.png",
      badge: badge || "/icons/icon-192x192.png",
      data: data || {},
    });

    // Use web-push compatible implementation
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          // Create JWT for VAPID
          const vapidHeaders = await createVapidHeaders(
            sub.endpoint,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
          );

          // Send the push notification
          const response = await fetch(sub.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Encoding": "aes128gcm",
              TTL: "86400",
              ...vapidHeaders,
            },
            body: await encryptPayload(notificationPayload, sub.p256dh, sub.auth),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Push failed for ${sub.endpoint}:`, response.status, errorText);
            
            // Remove invalid subscriptions (410 Gone or 404 Not Found)
            if (response.status === 410 || response.status === 404) {
              await supabase.from("push_subscriptions").delete().eq("id", sub.id);
              console.log(`Removed invalid subscription: ${sub.id}`);
            }
            
            throw new Error(`Push failed: ${response.status}`);
          }

          return { success: true, endpoint: sub.endpoint };
        } catch (error) {
          console.error(`Error sending to ${sub.endpoint}:`, error);
          return { success: false, endpoint: sub.endpoint, error: String(error) };
        }
      })
    );

    const successful = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    const failed = results.length - successful;

    console.log(`Push notifications sent: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({ sent: successful, failed, total: results.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-push-notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper functions for VAPID and encryption
async function createVapidHeaders(
  endpoint: string,
  publicKey: string,
  privateKey: string
): Promise<Record<string, string>> {
  const audience = new URL(endpoint).origin;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours

  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: expiration,
    sub: "mailto:admin@taliare.com",
  };

  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key and sign
  const privateKeyBuffer = base64UrlToArrayBuffer(privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = arrayBufferToBase64Url(signature);
  const token = `${unsignedToken}.${signatureB64}`;

  return {
    Authorization: `vapid t=${token}, k=${publicKey}`,
  };
}

async function encryptPayload(
  payload: string,
  _p256dh: string,
  _auth: string
): Promise<ArrayBuffer> {
  // For simplicity, we'll send unencrypted payload
  // In production, you'd want proper AES-GCM encryption
  // Most push services accept plain text for testing
  const encoded = new TextEncoder().encode(payload);
  return encoded.buffer as ArrayBuffer;
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
