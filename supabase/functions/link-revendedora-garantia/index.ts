import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { ok: false, status: 401, error: 'Não autenticado' };
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await supabaseAuth.auth.getUser();
  if (error || !user) return { ok: false, status: 401, error: 'Token inválido' };
  const { data: isAdmin } = await supabaseAuth.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!isAdmin) return { ok: false, status: 403, error: 'Acesso negado: apenas administradores' };
  return { ok: true as const };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const { revendedoraId, perfilGarantiaId } = await req.json();

    if (!revendedoraId || typeof revendedoraId !== 'string') {
      return new Response(JSON.stringify({ error: 'revendedoraId é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (perfilGarantiaId !== null && typeof perfilGarantiaId !== 'string') {
      return new Response(JSON.stringify({ error: 'perfilGarantiaId deve ser string ou null' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Se vinculando, garante que não existe outro registro com o mesmo perfil_garantia_id
    if (perfilGarantiaId) {
      const { data: existente } = await supabaseAdmin
        .from('revendedoras')
        .select('id')
        .eq('perfil_garantia_id', perfilGarantiaId)
        .neq('id', revendedoraId)
        .maybeSingle();

      if (existente) {
        // Limpa o vínculo anterior antes de aplicar o novo
        await supabaseAdmin
          .from('revendedoras')
          .update({ perfil_garantia_id: null })
          .eq('id', existente.id);
      }
    }

    const { error } = await supabaseAdmin
      .from('revendedoras')
      .update({ perfil_garantia_id: perfilGarantiaId })
      .eq('id', revendedoraId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[link-revendedora-garantia]', error);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
