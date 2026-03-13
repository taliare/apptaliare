

# Exibir Todos os Campos do Lead no CRM

## Problema

O formulário externo possui 20 campos, mas o banco interno e o CRM só armazenam/exibem 12 deles. Faltam **14 campos** que o SDR precisa ver para avaliar o lead.

## Campos faltantes (a adicionar)

| Campo externo | Existe no interno? |
|---|---|
| ultimo_envio | Não |
| tentativas | Não |
| data_nascimento | Não |
| cpf | Não |
| estado_civil | Não |
| profissao | Não |
| telefone_alternativo | Não |
| email | Não |
| cep | Não |
| endereco | Não |
| bairro | Não |
| restricao_serasa | Não |
| possui_veiculo | Não |
| expectativa_venda | Não |

Campos que existem no interno mas não no externo (`capital_inicial`, `tempo_disponivel`, `idade`) serão mantidos para compatibilidade com leads antigos.

## Alterações

### 1. Migração de banco — adicionar 14 colunas

```sql
ALTER TABLE leads_revendedoras
  ADD COLUMN IF NOT EXISTS ultimo_envio timestamptz,
  ADD COLUMN IF NOT EXISTS tentativas integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_nascimento text,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS estado_civil text,
  ADD COLUMN IF NOT EXISTS profissao text,
  ADD COLUMN IF NOT EXISTS telefone_alternativo text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS restricao_serasa text,
  ADD COLUMN IF NOT EXISTS possui_veiculo text,
  ADD COLUMN IF NOT EXISTS expectativa_venda text;
```

### 2. Edge Function `sync-leads-from-external/index.ts`

Adicionar os 14 novos campos no mapeamento `leadsToInsert`, copiando do lead externo.

### 3. Interface `LeadRevendedora` em `types.ts`

Adicionar os 14 campos como `string | null` (e `tentativas` como `number | null`).

### 4. `LeadDetailsSheet.tsx` — exibir todos os campos

Adicionar seção "Dados Pessoais" (data_nascimento, cpf, estado_civil, profissao, email, telefone_alternativo) e "Endereço" (cep, endereco, bairro) e "Perfil Comercial" (restricao_serasa, possui_veiculo, expectativa_venda) com ícones e labels legíveis.

### 5. `LeadCard.tsx` — sem alteração visual

Os cards do Kanban continuam compactos. Os novos campos são visíveis apenas ao abrir o detalhe do lead.

### Arquivos alterados

| Arquivo | Tipo |
|---|---|
| Migração SQL | Novo — 14 colunas |
| `supabase/functions/sync-leads-from-external/index.ts` | Editar — mapear novos campos |
| `src/components/leads/types.ts` | Editar — interface LeadRevendedora |
| `src/components/leads/LeadDetailsSheet.tsx` | Editar — exibir todos os campos |

