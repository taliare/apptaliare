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
      console.error('[update-profile-external] Secrets não configurados');
      return new Response(
        JSON.stringify({ 
          error: 'Configuração incompleta. Configure EXTERNAL_SUPABASE_URL e EXTERNAL_SUPABASE_SERVICE_ROLE_KEY nos secrets.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente com service_role_key (bypass RLS)
    const supabaseAdmin = createClient(EXTERNAL_URL, EXTERNAL_SERVICE_KEY);

    // Obter dados do request
    const { userId, nome } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!nome || !nome.trim()) {
      return new Response(
        JSON.stringify({ error: 'nome é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar o profile
    const { data, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ nome: nome.trim() })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('[update-profile-external] Erro ao atualizar profile:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[update-profile-external] Profile ${userId} atualizado com sucesso`);

    return new Response(
      JSON.stringify({ 
        success: true,
        profile: data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[update-profile-external] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
