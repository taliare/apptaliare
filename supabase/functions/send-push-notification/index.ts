import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Use external Supabase credentials
const EXTERNAL_SUPABASE_URL = Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '';
const EXTERNAL_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error("VAPID keys not configured");
    }

    // ===== AUTHENTICATION CHECK =====
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized: No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service role client for all operations
    const supabaseAdmin = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify the user's JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id);

    // ===== AUTHORIZATION CHECK =====
    // Check if user has admin role for sendToAll or sending to other users
    const { data: userRoles, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (roleError) {
      console.error("Error fetching user roles:", roleError);
    }

    const isAdmin = userRoles?.some((r) => r.role === "admin") || false;
    console.log("User is admin:", isAdmin);

    const payload: PushPayload = await req.json();
    const { title, body, icon, badge, data, userId, userIds, sendToAll } = payload;

    console.log("Sending push notification:", { title, body, userId, userIds, sendToAll });

    // ===== ROLE-BASED ACCESS CONTROL =====
    // Non-admins can only send notifications to themselves
    if (!isAdmin) {
      if (sendToAll) {
        console.error("Non-admin tried to use sendToAll");
        return new Response(
          JSON.stringify({ error: "Forbidden: Only admins can send to all users" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (userIds && userIds.length > 0) {
        const hasOtherUsers = userIds.some((id) => id !== user.id);
        if (hasOtherUsers) {
          console.error("Non-admin tried to send to other users");
          return new Response(
            JSON.stringify({ error: "Forbidden: You can only send notifications to yourself" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      if (userId && userId !== user.id) {
        console.error("Non-admin tried to send to another user");
        return new Response(
          JSON.stringify({ error: "Forbidden: You can only send notifications to yourself" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Build query for subscriptions
    let query = supabaseAdmin.from("push_subscriptions").select("*");

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
              await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
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
  p256dh: string,
  auth: string
): Promise<ArrayBuffer> {
  // RFC8291 Web Push Message Encryption with AES-128-GCM
  const payloadBytes = new TextEncoder().encode(payload);
  
  // Decode subscriber's public key (p256dh) and auth secret
  const subscriberPublicKeyBytes = base64UrlToArrayBuffer(p256dh);
  const authSecretBytes = base64UrlToArrayBuffer(auth);
  
  // Generate ephemeral ECDH key pair for this message
  const senderKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  
  // Import subscriber's public key
  const subscriberPublicKey = await crypto.subtle.importKey(
    "raw",
    subscriberPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  
  // Derive shared secret using ECDH
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subscriberPublicKey },
    senderKeyPair.privateKey,
    256
  );
  
  // Export sender's public key for the header
  const senderPublicKeyBytes = await crypto.subtle.exportKey("raw", senderKeyPair.publicKey);
  
  // Generate 16-byte random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Derive PRK using HKDF with auth secret
  const authInfo = new TextEncoder().encode("WebPush: info\0");
  const authInfoBuffer = new Uint8Array(authInfo.length + subscriberPublicKeyBytes.byteLength + senderPublicKeyBytes.byteLength);
  authInfoBuffer.set(authInfo, 0);
  authInfoBuffer.set(new Uint8Array(subscriberPublicKeyBytes), authInfo.length);
  authInfoBuffer.set(new Uint8Array(senderPublicKeyBytes), authInfo.length + subscriberPublicKeyBytes.byteLength);
  
  const ikm = await hkdfExpand(sharedSecret, authSecretBytes, authInfoBuffer.buffer as ArrayBuffer, 32);
  
  // Derive CEK (Content Encryption Key) and nonce using HKDF
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  
  const cek = await hkdfExpand(ikm, salt.buffer as ArrayBuffer, cekInfo.buffer as ArrayBuffer, 16);
  const nonce = await hkdfExpand(ikm, salt.buffer as ArrayBuffer, nonceInfo.buffer as ArrayBuffer, 12);
  
  // Import CEK for AES-GCM encryption
  const cekKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  
  // Add padding delimiter (0x02 for final record)
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes, 0);
  paddedPayload[payloadBytes.length] = 0x02;
  
  // Encrypt with AES-128-GCM
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, tagLength: 128 },
    cekKey,
    paddedPayload
  );
  
  // Build the encrypted content header (RFC8188 aes128gcm)
  // Header: salt (16) + rs (4) + idlen (1) + keyid (65 for P-256 public key)
  const recordSize = 4096;
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize, false);
  header[20] = 65; // Key ID length (P-256 public key)
  header.set(new Uint8Array(senderPublicKeyBytes), 21);
  
  // Combine header and ciphertext
  const result = new Uint8Array(header.length + ciphertext.byteLength);
  result.set(header, 0);
  result.set(new Uint8Array(ciphertext), header.length);
  
  return result.buffer as ArrayBuffer;
}

// HKDF-Expand function for key derivation
async function hkdfExpand(
  ikm: ArrayBuffer,
  salt: ArrayBuffer,
  info: ArrayBuffer,
  length: number
): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    ikm,
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );
  
  const derived = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt,
      info: info,
    },
    keyMaterial,
    length * 8
  );
  
  return derived;
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
