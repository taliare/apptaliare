## Causa raiz

A tabela `revendedoras` **não tem política RLS de UPDATE para representantes**. As únicas políticas hoje são:
- `INSERT` para representantes (`representante_id = auth.uid()`)
- `SELECT` para representantes (suas revendedoras)
- `ALL` apenas para admin

Como o código faz `supabase.from('revendedoras').update(payload).eq('id', id)` **sem `.select()`**, o PostgREST responde 204 (sucesso) mesmo quando 0 linhas foram afetadas pela RLS. Resultado: o toast "Revendedora atualizada" aparece, o dialog fecha, **mas nada foi gravado**. Os representantes percebem isso de forma intermitente — só notam quando reabrem o perfil e veem dados antigos. (Para revendedoras editadas pelo admin tudo salva normalmente, daí "algumas sim, outras não".)

## Plano

### 1. Migration — destravar UPDATE e criar trilha de auditoria

- **Política `UPDATE` em `revendedoras`** para o dono (`representante_id = auth.uid()`), com `WITH CHECK` igual ao `USING` para impedir transferir a revendedora para outro representante.
- Mesma política para `revendedoras_referencias` (verificar; se faltar, criar análoga via `EXISTS` no parent).
- Nova tabela `public.revendedoras_audit`:
  - `revendedora_id`, `user_id`, `acao` (`criou` | `editou`), `campos_alterados jsonb` (diff campo → {antes, depois}), `criado_em`.
  - GRANTs para `authenticated`/`service_role`.
  - RLS: SELECT permitido ao representante dono da revendedora e ao admin; INSERT só via trigger (sem policy de insert para usuários).
- Trigger `AFTER INSERT OR UPDATE` em `revendedoras` (SECURITY DEFINER) que grava no audit:
  - No `INSERT`: registra `criou` com `auth.uid()`.
  - No `UPDATE`: monta diff dos campos relevantes (nome, cpf, rg, endereço completo, contatos, observações, foto_url, status_juridico) e só insere se houver mudança real.
- Garantir `atualizado_em = now()` via trigger para não depender do cliente.

### 2. Hook — histórico de edições

Novo `useRevendedoraHistorico(revendedoraId)` em `src/hooks/`:
- Query em `revendedoras_audit` ordenada desc, faz join com `profiles_limited` para mostrar quem editou.

### 3. `RevendedoraFormDialog.tsx`

- Adicionar `.select('id').single()` ao `UPDATE` para que falhas de RLS retornem erro real (defesa em profundidade).
- Remover envio manual de `atualizado_em` (passa a ser do trigger).
- Adicionar uma nova seção colapsável **"Histórico de edições"** no final do formulário (só quando `revendedoraId`):
  - Lista `criado_em` (primeira linha "Cadastrada em … por …") + cada edição com data/hora e usuário.
  - Limite inicial 10, "ver mais" expande.

### 4. `PerfilRevendedoraDialog.tsx`

- Garantir que todos os campos do cadastro são exibidos em uma nova seção "Dados cadastrais" — quando vazios, mostrar `—` (campos limpos) ao invés de esconder.
- Manter botão lápis (`Edit2`) já existente.
- Adicionar duas linhas no header:
  - **Cadastrada em:** `revendedoraInfo.criado_em` formatada.
  - **Última edição:** `revendedoraInfo.atualizado_em` + nome do último editor (via última linha do audit).
- Para revendedoras **sem registro** em `revendedoras` (apenas com cobranças antigas pelo nome), o dialog hoje já mostra o botão "Editar" que abre o form com `initialNome`. Manter esse comportamento; campos limpos aparecem naturalmente.

### 5. Validação pós-deploy

- Logar como representante, editar endereço de uma revendedora existente, recarregar e confirmar persistência.
- Conferir que o audit gerou linha com diff.
- Confirmar que a tentativa de editar revendedora de outro representante continua sendo bloqueada.

## Fora de escopo

- Não vou tocar em `RevendedoraFormDialog` para mudar layout das seções existentes além de inserir o bloco de histórico.
- Sem backfill de auditoria para edições passadas (não há como reconstruir diffs antigos).
