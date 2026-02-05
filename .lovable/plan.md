

## Correcao: Leads excluidos voltando apos sincronizacao

### Problema
O cron de sincronizacao (`sync-leads-from-external`) roda a cada 5 minutos e verifica quais `external_id` ja existem na tabela `leads_revendedoras`. Quando um lead e excluido (hard delete), seu `external_id` desaparece, e a proxima sincronizacao o reimporta como "novo".

### Solucao
Criar uma tabela de rastreamento para guardar os `external_id` de leads excluidos e atualizar tanto a funcao de exclusao quanto a funcao de sincronizacao para consultar essa tabela.

```text
Fluxo ATUAL (com bug):
  Excluir lead --> remove da tabela --> sync nao encontra external_id --> reimporta

Fluxo CORRIGIDO:
  Excluir lead --> salva external_id na tabela de deletados --> remove da tabela --> sync encontra na tabela de deletados --> ignora
```

---

### Mudancas

**1. Nova tabela `leads_external_deletados` (migration SQL)**

Tabela simples com:
- `id` (uuid, PK)
- `external_id` (uuid, UNIQUE, NOT NULL) -- o ID do lead no Supabase externo
- `deletado_em` (timestamptz, default now())
- `deletado_por` (uuid, nullable) -- referencia ao admin que deletou

RLS: apenas admins podem ver/inserir/deletar.

**2. Atualizar funcao `delete_lead_with_history` (migration SQL)**

Antes de deletar o lead, salvar o `external_id` (se existir) na tabela `leads_external_deletados`:
- Buscar `external_id` do lead
- Se tiver `external_id`, inserir em `leads_external_deletados`
- Depois continuar com a exclusao normal (historico + lead)

**3. Atualizar edge function `sync-leads-from-external`**

Na etapa 2 (buscar IDs ja sincronizados), alem de buscar `external_id` de `leads_revendedoras`, tambem buscar da tabela `leads_external_deletados`. Unir os dois conjuntos para filtrar leads que ja foram importados OU que foram deletados intencionalmente.

Trecho que muda:
```text
ANTES:
  existingIds = leads_revendedoras.external_id (nao nulos)

DEPOIS:
  existingIds = leads_revendedoras.external_id (nao nulos)
             + leads_external_deletados.external_id
```

---

### Arquivos alterados

| Arquivo | Tipo de mudanca |
|---------|----------------|
| Migration SQL (nova) | Criar tabela `leads_external_deletados` com RLS |
| Migration SQL (nova) | Atualizar funcao `delete_lead_with_history` para salvar external_id |
| `supabase/functions/sync-leads-from-external/index.ts` | Consultar tabela de deletados antes de importar |

---

### Resultado esperado

- Excluir um lead: funciona normalmente, mas agora salva o `external_id` na tabela de rastreamento
- Sync roda a cada 5 minutos: verifica leads existentes E leads deletados, nao reimporta nenhum que foi excluido
- Lead excluido nunca mais volta como "zumbi"

