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
      console.error('[reset-password-external] Secrets não configurados');
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
    const { userId, newPassword } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newPassword) {
      return new Response(
        JSON.stringify({ error: 'newPassword é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar senha
    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter pelo menos 8 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!/[A-Z]/.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: 'A senha deve conter pelo menos uma letra maiúscula' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!/[a-z]/.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: 'A senha deve conter pelo menos uma letra minúscula' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!/[0-9]/.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: 'A senha deve conter pelo menos um número' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[reset-password-external] Atualizando senha para usuário:', userId);

    // Atualizar senha usando admin auth
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (error) {
      console.error('[reset-password-external] Erro ao atualizar senha:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[reset-password-external] Senha atualizada com sucesso para:', userId);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Senha atualizada com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[reset-password-external] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
