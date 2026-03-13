import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    
    // Verificar se é chamada do cron (POST sem auth de usuário, mas com body específico)
    let isCronCall = false;
    let body: { source?: string } = {};
    
    if (req.method === "POST") {
      try {
        body = await req.json();
        isCronCall = body?.source === "cron";
      } catch {
        // Body vazio ou inválido, não é cron
      }
    }

    // Cliente do Supabase externo (site Taliare)
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");

    if (!externalUrl || !externalKey) {
      return new Response(
        JSON.stringify({ 
          error: "Configuração do Supabase externo não encontrada",
          missing: !externalUrl ? "EXTERNAL_SUPABASE_URL" : "EXTERNAL_SUPABASE_SERVICE_ROLE_KEY"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const externalClient = createClient(externalUrl, externalKey);

    // Cliente do Supabase interno (Lovable Cloud)
    const internalUrl = Deno.env.get("SUPABASE_URL")!;
    const internalKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalClient = createClient(internalUrl, internalKey);

    // Se é chamada do cron, pular verificação de admin
    if (isCronCall) {
      console.log("Sincronização automática via cron job");
    } else {
      // Chamada manual - verificar autenticação de admin
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await internalClient.auth.getUser(token);

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Token inválido" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar role admin
      const { data: roleData } = await internalClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (!roleData) {
        return new Response(
          JSON.stringify({ error: "Apenas administradores podem sincronizar leads" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 1. Buscar todos os leads do Supabase externo
    const { data: externalLeads, error: externalError } = await externalClient
      .from("leads_revendedoras")
      .select("*")
      .order("created_at", { ascending: false });

    if (externalError) {
      console.error("Erro ao buscar leads externos:", externalError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar leads do site", details: externalError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!externalLeads || externalLeads.length === 0) {
      return new Response(
        JSON.stringify({ synced: 0, message: "Nenhum lead encontrado no site externo" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Buscar IDs já sincronizados no banco interno
    const [existingResult, deletedResult] = await Promise.all([
      internalClient
        .from("leads_revendedoras")
        .select("external_id")
        .not("external_id", "is", null),
      internalClient
        .from("leads_external_deletados")
        .select("external_id"),
    ]);

    if (existingResult.error) {
      console.error("Erro ao buscar leads internos:", existingResult.error);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar leads existentes", details: existingResult.error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (deletedResult.error) {
      console.error("Erro ao buscar leads deletados:", deletedResult.error);
      // Não bloquear a sync, apenas logar o erro
    }

    // Unir IDs existentes + IDs deletados intencionalmente
    const existingIds = new Set([
      ...(existingResult.data?.map((l) => l.external_id) || []),
      ...(deletedResult.data?.map((l) => l.external_id) || []),
    ]);

    // 3. Filtrar apenas leads novos (não sincronizados)
    const newLeads = externalLeads.filter((lead) => !existingIds.has(lead.id));

    if (newLeads.length === 0) {
      return new Response(
        JSON.stringify({ 
          synced: 0, 
          message: "Todos os leads já estão sincronizados",
          total_external: externalLeads.length 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Preparar dados para inserção
    const leadsToInsert = newLeads.map((lead) => ({
      external_id: lead.id,
      nome: lead.nome,
      whatsapp: lead.whatsapp,
      cidade: lead.cidade,
      instagram: lead.instagram,
      experiencia_vendas: lead.experiencia_vendas,
      tempo_disponivel: lead.tempo_disponivel,
      capital_inicial: lead.capital_inicial,
      motivacao: lead.motivacao,
      origem: "site",
      status: "leads_novos",
      utm_source: lead.utm_source,
      utm_medium: lead.utm_medium,
      utm_campaign: lead.utm_campaign,
      idade: lead.idade || null,
      created_at: lead.created_at,
      responsavel_id: null,
      responsavel_nome: null,
      observacao: null,
      ultimo_envio: lead.ultimo_envio || null,
      tentativas: lead.tentativas || 0,
      data_nascimento: lead.data_nascimento || null,
      cpf: lead.cpf || null,
      estado_civil: lead.estado_civil || null,
      profissao: lead.profissao || null,
      telefone_alternativo: lead.telefone_alternativo || null,
      email: lead.email || null,
      cep: lead.cep || null,
      endereco: lead.endereco || null,
      bairro: lead.bairro || null,
      restricao_serasa: lead.restricao_serasa || null,
      possui_veiculo: lead.possui_veiculo || null,
      expectativa_venda: lead.expectativa_venda || null,
    }));

    // 5. Inserir novos leads em batch
    const { data: insertedLeads, error: insertError } = await internalClient
      .from("leads_revendedoras")
      .insert(leadsToInsert)
      .select();

    if (insertError) {
      console.error("Erro ao inserir leads:", insertError);
      return new Response(
        JSON.stringify({ error: "Erro ao inserir leads", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sincronizados ${insertedLeads?.length || 0} leads do site externo`);

    // 6. Criar notificações para todos os admins se houver novos leads
    if (insertedLeads && insertedLeads.length > 0) {
      // Buscar todos os admins
      const { data: adminUsers } = await internalClient
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminUsers && adminUsers.length > 0) {
        const notifications = adminUsers.map((admin) => ({
          user_id: admin.user_id,
          title: "Novos leads do site!",
          message: `${insertedLeads.length} novo(s) lead(s) cadastrado(s) no site.`,
          type: "lead",
          link: "/leads-revendedoras",
          read: false,
        }));

        const { error: notifError } = await internalClient
          .from("notifications")
          .insert(notifications);

        if (notifError) {
          console.error("Erro ao criar notificações:", notifError);
        } else {
          console.log(`Notificações criadas para ${adminUsers.length} admins`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        synced: insertedLeads?.length || 0,
        total_external: externalLeads.length,
        already_synced: existingIds.size,
        message: `${insertedLeads?.length || 0} novos leads importados do site`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro na sincronização:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: "Erro interno na sincronização", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
