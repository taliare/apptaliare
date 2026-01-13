import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const anonKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY");

    if (!url || !anonKey) {
      const missing = [];
      if (!url) missing.push("EXTERNAL_SUPABASE_URL");
      if (!anonKey) missing.push("EXTERNAL_SUPABASE_ANON_KEY");
      
      return new Response(
        JSON.stringify({ 
          error: `Missing secrets: ${missing.join(", ")}`,
          configured: false 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    return new Response(
      JSON.stringify({ url, anonKey, configured: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message, configured: false }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
