import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EXTERNAL_URL = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const EXTERNAL_SERVICE_KEY = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');

    if (!EXTERNAL_URL || !EXTERNAL_SERVICE_KEY) {
      console.error('[get-revendedoras-external] Secrets não configurados');
      return new Response(
        JSON.stringify({ 
          error: 'Configuração incompleta. Configure EXTERNAL_SUPABASE_URL e EXTERNAL_SUPABASE_SERVICE_ROLE_KEY nos secrets.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente com service_role_key (bypass RLS)
    const supabaseAdmin = createClient(EXTERNAL_URL, EXTERNAL_SERVICE_KEY);

    // Buscar todos os profiles (revendedoras) do banco externo - inclui ativo se existir
    const { data: revendedoras, error: revendedorasError } = await supabaseAdmin
      .from('profiles')
      .select('id, nome, email, ativo')
      .order('nome', { ascending: true });

    if (revendedorasError) {
      console.error('[get-revendedoras-external] Erro ao buscar revendedoras:', revendedorasError);
      return new Response(
        JSON.stringify({ error: revendedorasError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[get-revendedoras-external] ${revendedoras?.length || 0} revendedoras encontradas`);

    return new Response(
      JSON.stringify({ 
        revendedoras: revendedoras || [],
        total: revendedoras?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-revendedoras-external] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
