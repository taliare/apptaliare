import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Banco INTERNO: buscar perfis de garantia vinculados às revendedoras deste representante
    const supabaseInternal = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: vinculos, error: vincErr } = await supabaseInternal
      .from('revendedoras')
      .select('perfil_garantia_id')
      .eq('representante_id', user.id)
      .not('perfil_garantia_id', 'is', null);

    if (vincErr) {
      console.error('[get-garantias-representante] vinculos error:', vincErr);
      return new Response(JSON.stringify({ error: vincErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const perfilGarantiaIds = [
      ...new Set((vinculos || []).map((r: any) => r.perfil_garantia_id).filter(Boolean)),
    ] as string[];

    if (perfilGarantiaIds.length === 0) {
      return new Response(JSON.stringify({
        garantias: [], clientes: [], revendedoras: [], totalVinculadas: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Banco EXTERNO
    const EXTERNAL_URL = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const EXTERNAL_SERVICE_KEY = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
    if (!EXTERNAL_URL || !EXTERNAL_SERVICE_KEY) {
      return new Response(JSON.stringify({ error: 'Configuração externa incompleta.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseExternal = createClient(EXTERNAL_URL, EXTERNAL_SERVICE_KEY);

    // Garantias paginadas, filtradas por revendedora_id IN (perfilGarantiaIds)
    const fetchGarantiasPaginated = async () => {
      const all: any[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabaseExternal
          .from('garantias')
          .select('*')
          .in('revendedora_id', perfilGarantiaIds)
          .order('data_compra', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (data && data.length > 0) all.push(...data);
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all;
    };

    let garantias: any[] = [];
    try {
      garantias = await fetchGarantiasPaginated();
    } catch (gErr: any) {
      console.error('[get-garantias-representante] garantias error:', gErr);
      return new Response(JSON.stringify({ error: gErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fetchInBatches = async (table: string, ids: string[], select: string, batchSize = 100) => {
      const results: any[] = [];
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { data, error } = await supabaseExternal.from(table).select(select).in('id', batch);
        if (error) continue;
        if (data) results.push(...data);
      }
      return results;
    };

    const clienteIds = [...new Set(garantias.map((g: any) => g.cliente_id).filter(Boolean))] as string[];
    const clientes = clienteIds.length > 0 ? await fetchInBatches('clientes_garantia', clienteIds, '*') : [];

    const revendedoraIds = [...new Set(garantias.map((g: any) => g.revendedora_id).filter(Boolean))] as string[];
    const revendedoras = revendedoraIds.length > 0 ? await fetchInBatches('profiles', revendedoraIds, 'id, nome') : [];

    return new Response(JSON.stringify({
      garantias,
      clientes,
      revendedoras,
      totalVinculadas: perfilGarantiaIds.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[get-garantias-representante]', error);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
