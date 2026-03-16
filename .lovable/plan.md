

# Atualizar Filas do CRM Kanban

## Novo funil (7 colunas)

```text
Leads Novos → Em Análise → Pré-aprovadas → Aguardando Entrevista → Para Entregar → Ativas ✓ / Reprovadas ✗
```

## Alterações

### 1. `src/components/leads/types.ts` — Novo KANBAN_COLUMNS

| id | label | color | final |
|---|---|---|---|
| leads_novos | Leads Novos | blue | — |
| em_analise | Em Análise | yellow | — |
| pre_aprovada | Pré-aprovadas | purple | — |
| aguardando_entrevista | Aguardando Entrevista | orange | — |
| para_entregar | Para Entregar | cyan | — |
| ativa | Ativas | green | sim |
| reprovada | Reprovadas | red | sim |

### 2. Migração SQL — Remapear status existentes

- `aprovada` → `pre_aprovada`
- `entrevista_agendada` → `aguardando_entrevista`
- `ativada` → `ativa`

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/leads/types.ts` | Novas 7 colunas |
| Migração SQL | Remapear 3 status |

