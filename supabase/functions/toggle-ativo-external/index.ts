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
    const EXTERNAL_SUPABASE_URL = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const EXTERNAL_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');

    if (!EXTERNAL_SUPABASE_URL || !EXTERNAL_SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing EXTERNAL_SUPABASE_URL or EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
      return new Response(
        JSON.stringify({ error: 'Configuração do banco externo não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, ativo } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof ativo !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'ativo deve ser um booleano' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for external Supabase
    const supabaseAdmin = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_SERVICE_ROLE_KEY);

    // Update ativo status
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ ativo })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating ativo status:', error);
      
      // Check if the column doesn't exist
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        return new Response(
          JSON.stringify({ 
            error: 'O campo "ativo" não existe na tabela profiles do banco externo. Por favor, adicione a coluna via SQL: ALTER TABLE profiles ADD COLUMN ativo boolean DEFAULT true;' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, profile: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Error in toggle-ativo-external:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
