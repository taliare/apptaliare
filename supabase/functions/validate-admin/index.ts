import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = [
  Deno.env.get('APP_URL') || '',
  'https://lovable.dev',
].filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const isAllowed = allowedOrigins.some(allowed => origin === allowed) || 
                    origin.endsWith('.lovable.dev') || 
                    origin.endsWith('.lovableproject.com');
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : (allowedOrigins[0] || ''),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { attempts: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000; // 1 minute window
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minute lockout after max attempts

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record) {
    return false;
  }
  
  // Reset if window has passed and not in lockout
  if (now - record.lastAttempt > WINDOW_MS && record.attempts < MAX_ATTEMPTS) {
    rateLimitMap.delete(identifier);
    return false;
  }
  
  // Check if in lockout period
  if (record.attempts >= MAX_ATTEMPTS) {
    if (now - record.lastAttempt < LOCKOUT_MS) {
      return true;
    }
    // Lockout period passed, reset
    rateLimitMap.delete(identifier);
    return false;
  }
  
  return false;
}

function recordAttempt(identifier: string, success: boolean): void {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (success) {
    // Clear on successful authentication
    rateLimitMap.delete(identifier);
    return;
  }
  
  if (!record) {
    rateLimitMap.set(identifier, { attempts: 1, lastAttempt: now });
  } else {
    rateLimitMap.set(identifier, { 
      attempts: record.attempts + 1, 
      lastAttempt: now 
    });
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting (use X-Forwarded-For if behind proxy)
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";

    // Check rate limit before processing
    if (isRateLimited(clientIP)) {
      console.log("Rate limit exceeded for IP:", clientIP);
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Tente novamente em 5 minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email e senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate admin credentials using admin client (doesn't affect user session)
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.user) {
      console.log("Admin validation failed: invalid credentials for IP:", clientIP);
      recordAttempt(clientIP, false);
      return new Response(
        JSON.stringify({ error: "Credenciais inválidas" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", signInData.user.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      console.log("Admin validation failed: user is not admin, IP:", clientIP);
      recordAttempt(clientIP, false);
      return new Response(
        JSON.stringify({ error: "Usuário não é administrador" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Success - clear rate limit record
    recordAttempt(clientIP, true);
    console.log("Admin validation successful for:", email);
    return new Response(
      JSON.stringify({ success: true, adminId: signInData.user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in validate-admin:", error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
