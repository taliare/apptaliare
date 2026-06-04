import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { ok: false, status: 401, error: 'Não autenticado' };
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
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
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const EXTERNAL_SUPABASE_URL = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const EXTERNAL_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
    if (!EXTERNAL_SUPABASE_URL || !EXTERNAL_SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Configuração do banco externo não encontrada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_SERVICE_ROLE_KEY);

    const { count, error: countError } = await supabaseAdmin
      .from('garantias').select('*', { count: 'exact', head: true }).eq('revendedora_id', userId);
    if (countError) {
      return new Response(JSON.stringify({ error: `Erro ao verificar garantias: ${countError.message}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (count && count > 0) {
      return new Response(JSON.stringify({
        error: `Esta revendedora possui ${count} garantia(s) registrada(s) e não pode ser excluída.`,
        garantiasCount: count,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      return new Response(JSON.stringify({ error: `Erro ao excluir usuário: ${deleteAuthError.message}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    return new Response(JSON.stringify({ success: true, message: 'Revendedora excluída com sucesso' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const error = err as Error;
    return new Response(JSON.stringify({ error: error.message || 'Erro interno do servidor' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
