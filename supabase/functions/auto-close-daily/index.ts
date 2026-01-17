import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔄 Iniciando fechamento automático de dias anteriores...");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Data de ontem (considerando UTC-3 para Brasília)
    const agora = new Date();
    const ontem = new Date(agora);
    ontem.setDate(ontem.getDate() - 1);
    const dataOntem = ontem.toISOString().split("T")[0];

    // Verificar se ontem foi domingo (day = 0)
    if (ontem.getDay() === 0) {
      console.log("📅 Ontem foi domingo, não há fechamento automático.");
      return new Response(
        JSON.stringify({ success: true, message: "Domingo - sem fechamento" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📅 Fechando dia: ${dataOntem}`);

    // Buscar todos os representantes ativos
    const { data: representantes, error: repError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, profiles(nome)")
      .eq("role", "representante");

    if (repError) {
      console.error("Erro ao buscar representantes:", repError);
      throw repError;
    }

    console.log(`📊 Total de representantes: ${representantes?.length || 0}`);

    const fechadosAutomaticamente: string[] = [];

    for (const rep of representantes || []) {
      const nomeRep = (rep as any).profiles?.nome || "Representante";

      // Verificar se já tem registro para ontem
      const { data: cobranca, error: cobError } = await supabaseAdmin
        .from("cobrancas_diarias")
        .select("*")
        .eq("representante_id", rep.user_id)
        .eq("data", dataOntem)
        .maybeSingle();

      if (cobError) {
        console.error(`Erro ao buscar cobrança de ${nomeRep}:`, cobError);
        continue;
      }

      if (cobranca) {
        // Se existe mas não está finalizado, finalizar
        if (!cobranca.finalizado) {
          const novaObs = cobranca.observacoes 
            ? `${cobranca.observacoes}\n[Fechado automaticamente pelo sistema]`
            : '[Fechado automaticamente pelo sistema]';

          const { error: updateError } = await supabaseAdmin
            .from("cobrancas_diarias")
            .update({ finalizado: true, observacoes: novaObs })
            .eq("id", cobranca.id);

          if (!updateError) {
            fechadosAutomaticamente.push(nomeRep);
            console.log(`✅ Fechado automaticamente: ${nomeRep}`);
          } else {
            console.error(`Erro ao fechar ${nomeRep}:`, updateError);
          }
        } else {
          console.log(`⏭️ Já finalizado: ${nomeRep}`);
        }
      } else {
        // Se não existe, criar com valores zerados
        const { error: insertError } = await supabaseAdmin
          .from("cobrancas_diarias")
          .insert({
            representante_id: rep.user_id,
            data: dataOntem,
            total_pix: 0,
            total_dinheiro: 0,
            total_cartao: 0,
            total_cobrado: 0,
            despesa_cobranca: 0,
            finalizado: true,
            observacoes: '[Fechado automaticamente pelo sistema - sem atividade]'
          });

        if (!insertError) {
          fechadosAutomaticamente.push(nomeRep);
          console.log(`✅ Criado e fechado: ${nomeRep} (sem atividade)`);
        } else {
          console.error(`Erro ao criar registro para ${nomeRep}:`, insertError);
        }
      }
    }

    // Notificar admins se houve fechamentos automáticos
    if (fechadosAutomaticamente.length > 0) {
      console.log(`📨 Notificando admins sobre ${fechadosAutomaticamente.length} fechamentos...`);
      
      const { data: admins, error: adminError } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminError) {
        console.error("Erro ao buscar admins:", adminError);
      } else {
        for (const admin of admins || []) {
          const { error: notifError } = await supabaseAdmin
            .from("notifications")
            .insert({
              user_id: admin.user_id,
              title: "Fechamentos Automáticos",
              message: `${fechadosAutomaticamente.length} representante(s) tiveram o dia ${dataOntem} fechado automaticamente: ${fechadosAutomaticamente.join(", ")}`,
              type: "info",
              link: "/fechamento-diario"
            });

          if (notifError) {
            console.error("Erro ao notificar admin:", notifError);
          }
        }
      }
    }

    console.log(`✅ Processo finalizado. ${fechadosAutomaticamente.length} fechamento(s) automático(s).`);

    return new Response(
      JSON.stringify({
        success: true,
        data: dataOntem,
        fechados_automaticamente: fechadosAutomaticamente,
        total: fechadosAutomaticamente.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Erro no fechamento automático:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
