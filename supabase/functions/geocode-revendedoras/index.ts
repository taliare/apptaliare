import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate caller is admin
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Apenas admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch revendedoras without coordinates
    const { data: revendedoras, error } = await admin
      .from('revendedoras')
      .select('id, bairro, cidade, estado')
      .is('latitude', null)
      .not('cidade', 'is', null);

    if (error) throw error;

    let sucesso = 0;
    let falha = 0;

    for (const r of revendedoras ?? []) {
      const estado = r.estado || 'Amazonas';
      const queries: string[] = [];
      if (r.bairro) queries.push(`${r.bairro}, ${r.cidade}, ${estado}, Brasil`);
      queries.push(`${r.cidade}, ${estado}, Brasil`);

      let coords: { lat: number; lng: number } | null = null;
      for (const q of queries) {
        try {
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'TaliareApp/1.0 (admin@taliare.com.br)',
              'Accept': 'application/json',
              'Accept-Language': 'pt-BR',
            },
          });
          const json = await res.json();
          if (Array.isArray(json) && json[0]) {
            coords = { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
            break;
          }
        } catch (e) {
          console.error('Erro Nominatim:', e);
        }
        await new Promise((res) => setTimeout(res, 1000));
      }

      if (coords) {
        await admin
          .from('revendedoras')
          .update({
            latitude: coords.lat,
            longitude: coords.lng,
            geocoded_at: new Date().toISOString(),
          })
          .eq('id', r.id);
        sucesso++;
        console.log(`✅ ${r.bairro || ''} ${r.cidade}/${estado}:`, coords);
      } else {
        falha++;
        console.warn(`❌ Sem resultado para ${r.bairro || ''} ${r.cidade}/${estado}`);
      }

      await new Promise((res) => setTimeout(res, 1000));
    }

    return new Response(
      JSON.stringify({ total: revendedoras?.length ?? 0, sucesso, falha }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('Erro:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
