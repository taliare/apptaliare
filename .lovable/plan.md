
## Objetivo

Impedir que um representante cadastre uma revendedora que já está vinculada a outro representante. O bloqueio acontece no banco (à prova de bypass) e o formulário mostra mensagem clara informando com quem a revendedora já está cadastrada, orientando a solicitar transferência ao admin.

## Regra de duplicidade

Considera-se a mesma revendedora quando qualquer um destes bate (normalizado):
- **CPF** (só dígitos) — match forte, quando preenchido.
- **WhatsApp** (só dígitos, últimos 11) — match forte, quando preenchido.
- **Nome normalizado** (UPPER + TRIM + unaccent) — match fraco, exige confirmação só se CPF/WhatsApp não baterem (porque homônimo existe).

Comportamento:
- Match por CPF ou WhatsApp com outro representante → **bloqueia sempre**.
- Match só por nome com outro representante → **bloqueia também** (regra rígida pedida), mas mensagem diferencia "nome igual" de "CPF/WhatsApp igual".
- Admin continua podendo cadastrar/editar livremente (a transferência é feita pelo admin alterando `representante_id`).

## Mudanças no banco

1. **Função `public.checar_duplicidade_revendedora(p_representante_id, p_nome, p_cpf, p_whatsapp, p_ignorar_id)`** `SECURITY DEFINER`, retorna JSON:
   ```
   { duplicado: bool, motivo: 'cpf'|'whatsapp'|'nome', representante_nome: text, revendedora_id: uuid }
   ```
   - Ignora `p_ignorar_id` para permitir edição do próprio registro.
   - Lê `revendedoras` + join com `profiles` (via `profiles_limited`) para retornar o nome do dono.

2. **Trigger `BEFORE INSERT OR UPDATE` em `revendedoras`** (`fn_bloquear_duplicidade_revendedora`):
   - Se o usuário não for admin (`has_role(auth.uid(),'admin')`), roda a checagem.
   - Em caso de duplicidade, `RAISE EXCEPTION` com mensagem amigável incluindo o nome do representante atual.
   - Garante o bloqueio mesmo se a UI for burlada.

3. Sem novas tabelas, sem mudança de RLS.

## Mudanças no frontend

1. **`RevendedoraFormDialog.tsx`**
   - Ao perder foco do CPF, WhatsApp ou nome (ou ao submeter), chamar `supabase.rpc('checar_duplicidade_revendedora', …)` passando o `id` em edição quando houver.
   - Se duplicado, exibir alerta inline vermelho no topo do formulário: *"Esta revendedora já está cadastrada com o representante <Nome>. Solicite a transferência ao administrador."* e desabilitar o botão Salvar.
   - Tratar também o erro vindo do trigger (fallback) com `toast.error` da mesma mensagem.

2. **`ImportWhatsAppDialog.tsx`** (importação em massa) — capturar erros de duplicidade por linha e listar no resultado: *"X linhas ignoradas (já cadastradas com outro representante)"*. Sem alterar UX além disso.

## Detalhes técnicos

- Normalizações usam `unaccent` (já instalado, visto em `verificar_bloqueio_juridico` e `buscar_revendedora_match`).
- WhatsApp normalizado = `regexp_replace(whatsapp,'\D','','g')` e comparação pelos últimos 11 dígitos para tolerar prefixo 55.
- A função e o trigger ficam com `SET search_path = public`.
- Admin é exceção verificada via `has_role(auth.uid(),'admin')`; isso permite que o admin faça a transferência (mudar `representante_id`) sem cair na própria regra.

## Validação

- Tentar cadastrar revendedora com mesmo CPF de outra carteira → bloqueio + toast.
- Tentar com mesmo WhatsApp → bloqueio.
- Tentar com nome idêntico (sem CPF/WhatsApp) → bloqueio com mensagem "nome igual".
- Editar a própria revendedora sem alterar dados → salva normal.
- Admin transferir `representante_id` de A para B → permitido.
- Importação em massa relata quantas foram ignoradas.
