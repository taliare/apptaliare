import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
      console.error('[get-garantias-admin] Secrets não configurados');
      return new Response(
        JSON.stringify({ 
          error: 'Configuração incompleta. Configure EXTERNAL_SUPABASE_URL e EXTERNAL_SUPABASE_SERVICE_ROLE_KEY nos secrets.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente com service_role_key (bypass RLS)
    const supabaseAdmin = createClient(EXTERNAL_URL, EXTERNAL_SERVICE_KEY);

    // Buscar TODAS as garantias sem filtro de ownership
    const { data: garantias, error: garantiasError } = await supabaseAdmin
      .from('garantias')
      .select('*')
      .order('data_compra', { ascending: false });

    if (garantiasError) {
      console.error('[get-garantias-admin] Erro ao buscar garantias:', garantiasError);
      return new Response(
        JSON.stringify({ error: garantiasError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[get-garantias-admin] ${garantias?.length || 0} garantias encontradas`);

    // Helper para buscar em lotes (evita URI Too Large quando há muitos IDs)
    const fetchInBatches = async (table: string, ids: string[], select: string, batchSize = 100) => {
      const results: any[] = [];
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { data, error } = await supabaseAdmin
          .from(table)
          .select(select)
          .in('id', batch);
        if (error) {
          console.error(`[get-garantias-admin] Erro ao buscar ${table} (lote ${i}):`, error);
          continue;
        }
        if (data) results.push(...data);
      }
      return results;
    };

    // Buscar clientes relacionados (em lotes)
    const clienteIds = [...new Set((garantias || []).map(g => g.cliente_id).filter(Boolean))];
    const clientes = clienteIds.length > 0
      ? await fetchInBatches('clientes_garantia', clienteIds, '*')
      : [];

    console.log(`[get-garantias-admin] ${clientes.length} clientes encontrados`);

    // Buscar revendedoras relacionadas (em lotes)
    const revendedoraIds = [...new Set((garantias || []).map(g => g.revendedora_id).filter(Boolean))];
    const revendedoras = revendedoraIds.length > 0
      ? await fetchInBatches('profiles', revendedoraIds, 'id, nome')
      : [];

    console.log(`[get-garantias-admin] ${revendedoras.length} revendedoras encontradas`);

    return new Response(
      JSON.stringify({ 
        garantias: garantias || [], 
        clientes,
        revendedoras,
        debug: {
          totalGarantias: garantias?.length || 0,
          totalClientes: clientes.length,
          totalRevendedoras: revendedoras.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-garantias-admin] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
