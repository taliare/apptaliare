

# Atualizar Colunas do Kanban de Leads

## Novo funil

```text
Leads Novos → Em Análise → Aprovada → Entrevista Agendada → Ativada ✓ / Reprovada ✗
```

## Alterações

### 1. `src/components/leads/types.ts` — Substituir KANBAN_COLUMNS

Trocar as 7 colunas atuais por 6:

| id | label | color | final |
|---|---|---|---|
| leads_novos | Leads Novos | blue | — |
| em_analise | Em Análise | yellow | — |
| aprovada | Aprovada | purple | — |
| entrevista_agendada | Entrevista Agendada | orange | — |
| ativada | Ativada | green | sim |
| reprovada | Reprovada | red | sim |

### 2. Migração SQL — Mapear leads antigos para novos status

Leads existentes com status removidos precisam ser remapeados:

- `contato_realizado` → `em_analise`
- `follow_up` → `em_analise`
- `interessada` → `aprovada`
- `aguardando_kit` → `entrevista_agendada`
- `perdida` → `reprovada`

### 3. `src/pages/LeadsRevendedoras.tsx` — Filtro de status

O filtro de status usa `KANBAN_COLUMNS` dinamicamente, então se ajusta automaticamente. Nenhuma alteração necessária.

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/leads/types.ts` | Novas colunas do Kanban |
| Migração SQL | Remapear status antigos |

