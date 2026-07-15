## Integração de saída para o Atendro (webhook por revendedora)

Objetivo: sempre que a situação de cobrança consolidada de uma revendedora mudar (ou pela passagem do tempo), enviar um POST para o webhook do Atendro com nome, whatsapp, situação e valor pendente.

### 1. Extensões
- Habilitar `pg_net` e `pg_cron` (se ainda não estiverem ativas) no schema `extensions`.

### 2. Função SQL — `public.calcular_situacao_revendedora(p_nome text)`
- SECURITY DEFINER, `search_path = public`.
- Busca em `revendedoras` por nome (case/acento-insensitive via `upper(trim(unaccent(...)))`) para obter `nome` oficial e `whatsapp`.
- Varre `cobrancas_agendadas` onde `vigente = true`, `revendedora` bate com o nome, e `status` ≠ `'pago'` e ≠ `'cancelado'`.
- Para cada linha calcula um bucket usando a lógica pedida:
  - `juridico` → juridico
  - `parcial` + vencida/no prazo → parcial_vencida / parcial
  - `pendente` + vencida/hoje/futura → vencida / vence_hoje / a_vencer
- Reduz para o pior bucket na ordem: juridico > parcial_vencida > vencida > parcial > vence_hoje > a_vencer.
- Calcula `valor_pendente = SUM(valor_previsto - COALESCE(valor_pago_acumulado,0) - COALESCE(valor_adiantado,0))` das linhas em aberto (clamp em 0).
- Retorna `TABLE(nome text, whatsapp text, situacao text, valor_pendente numeric)`. Retorna 0 linhas quando não há cobrança em aberto.

### 3. Função disparo — `public.enviar_webhook_atendro(p_revendedora_nome text)`
- Chama `calcular_situacao_revendedora`; se não retornar linha, não faz nada.
- Se `whatsapp` for nulo/vazio, também não dispara (sem canal no Atendro).
- Executa `net.http_post` para `https://api.atendro.ai/functions/v1/automation-webhook/9f84ba02-e036-43b6-8082-b47edcb21505` com header `Content-Type: application/json` e body JSON `{ nome, whatsapp, situacao, valor_pendente }`.

### 4. Trigger em `cobrancas_agendadas`
- Trigger `AFTER INSERT OR UPDATE OF status, data_agendada, valor_pago_acumulado` FOR EACH ROW.
- Função `fn_notificar_atendro_cobranca()` (SECURITY DEFINER, search_path public):
  - Chama `enviar_webhook_atendro(NEW.revendedora)`.
  - Se `OLD.revendedora` existe e é diferente de `NEW.revendedora` (rename), dispara também para o antigo (situação pode ter mudado por perder essa nota).
  - `EXCEPTION WHEN OTHERS THEN` engole erro e apenas loga com `RAISE WARNING`, para nunca quebrar a operação principal (`registrar_pagamento_cobranca`, reagendamento, etc.).

### 5. Job diário (pg_cron)
- Via `supabase--insert` (contém referência à instalação — não vai em migration):
  ```sql
  select cron.schedule(
    'atendro-sync-diario',
    '10 0 * * *',
    $$ SELECT public.enviar_webhook_atendro(sub.nome)
       FROM (
         SELECT DISTINCT ca.revendedora AS nome
         FROM public.cobrancas_agendadas ca
         WHERE ca.vigente = true
           AND ca.status NOT IN ('pago'::status_cobranca, 'cancelado'::status_cobranca)
       ) sub; $$
  );
  ```
- Antes disso, faz `cron.unschedule` idempotente se já existir.

### 6. Entrega
- Uma migration com: extensões + 3 funções + trigger.
- Uma chamada de insert separada para agendar o `cron.schedule` (não vai em migration, conforme regra do projeto para dados específicos do ambiente).
- Ao final, imprimo aqui a definição da função de situação e do trigger para revisão.

### O que NÃO vou tocar
- Frontend, `registrar_pagamento_cobranca`, políticas RLS, outras funções/triggers existentes.

Confirma que posso implementar assim?
