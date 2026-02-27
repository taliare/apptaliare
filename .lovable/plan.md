
# Adicionar campo "idade" ao CRM de Leads

## Objetivo
O formulario do site externo coleta a idade da candidata, mas esse campo nao esta sendo sincronizado nem exibido no CRM.

## Alteracoes

### 1. Migracap de banco de dados
Adicionar coluna `idade` na tabela `leads_revendedoras`:
```sql
ALTER TABLE leads_revendedoras ADD COLUMN idade text NULL;
```

### 2. Atualizar Edge Function `sync-leads-from-external`
No mapeamento de campos (linhas 156-175), adicionar:
```
idade: lead.idade || null,
```

### 3. Atualizar tipo TypeScript `LeadRevendedora`
Em `src/components/leads/types.ts`, adicionar:
```
idade: string | null;
```

### 4. Exibir idade no `LeadDetailsSheet`
Adicionar campo "Idade" na secao de informacoes detalhadas, junto com experiencia_vendas, tempo_disponivel, etc.

### 5. (Opcional) Exibir idade no `LeadCard`
Mostrar idade no card expandido do Kanban, se disponivel.

## Detalhes Tecnicos
- A coluna `idade` e do tipo `text` porque o formulario externo pode retornar valores como "25 anos" ou faixas etarias
- A migracao e nao-destrutiva (ADD COLUMN com NULL default)
- Leads ja sincronizados ficarao com `idade = null` ate nova sincronizacao (nao retroativo)
- A Edge Function precisa ser re-deployada apos a alteracao
