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

    const EXTERNAL_URL = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const EXTERNAL_SERVICE_KEY = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
    if (!EXTERNAL_URL || !EXTERNAL_SERVICE_KEY) {
      return new Response(JSON.stringify({ error: 'Configuração incompleta.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(EXTERNAL_URL, EXTERNAL_SERVICE_KEY);

    const { data: garantias, error: garantiasError } = await supabaseAdmin
      .from('garantias').select('*').order('data_compra', { ascending: false });
    if (garantiasError) {
      return new Response(JSON.stringify({ error: garantiasError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fetchInBatches = async (table: string, ids: string[], select: string, batchSize = 100) => {
      const results: any[] = [];
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { data, error } = await supabaseAdmin.from(table).select(select).in('id', batch);
        if (error) continue;
        if (data) results.push(...data);
      }
      return results;
    };

    const clienteIds = [...new Set((garantias || []).map(g => g.cliente_id).filter(Boolean))];
    const clientes = clienteIds.length > 0 ? await fetchInBatches('clientes_garantia', clienteIds, '*') : [];

    const revendedoraIds = [...new Set((garantias || []).map(g => g.revendedora_id).filter(Boolean))];
    const revendedoras = revendedoraIds.length > 0 ? await fetchInBatches('profiles', revendedoraIds, 'id, nome') : [];

    return new Response(JSON.stringify({
      garantias: garantias || [], clientes, revendedoras,
      debug: { totalGarantias: garantias?.length || 0, totalClientes: clientes.length, totalRevendedoras: revendedoras.length }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[get-garantias-admin]', error);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
