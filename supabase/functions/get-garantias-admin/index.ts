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

    // Buscar clientes relacionados
    const clienteIds = [...new Set((garantias || []).map(g => g.cliente_id).filter(Boolean))];
    
    let clientes: any[] = [];
    if (clienteIds.length > 0) {
      const { data: clientesData, error: clientesError } = await supabaseAdmin
        .from('clientes_garantia')
        .select('*')
        .in('id', clienteIds);

      if (clientesError) {
        console.error('[get-garantias-admin] Erro ao buscar clientes:', clientesError);
      } else {
        clientes = clientesData || [];
      }
    }

    console.log(`[get-garantias-admin] ${clientes.length} clientes encontrados`);

    return new Response(
      JSON.stringify({ 
        garantias: garantias || [], 
        clientes,
        debug: {
          totalGarantias: garantias?.length || 0,
          totalClientes: clientes.length
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
