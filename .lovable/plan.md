

## Plano: Sincronização de Leads do Site Externo para o CRM

### Resumo

O site da Taliare armazena leads na tabela `leads_revendedoras` no **Supabase externo**, mas o CRM do sistema interno busca dados do **Supabase interno** (Lovable Cloud). 

Vou criar uma Edge Function que sincroniza automaticamente os leads do Supabase externo para o interno, permitindo que o CRM exiba todos os leads do site.

---

### Estratégia de Sincronização

```text
┌─────────────────────────────────────────────────────────────┐
│                      SITE TALIARE                           │
│                                                             │
│   Formulário de Cadastro → INSERT na tabela                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               SUPABASE EXTERNO                              │
│                                                             │
│   Tabela: leads_revendedoras                                │
│   (dados originais do site)                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ Edge Function: sync-leads-from-external
┌─────────────────────────────────────────────────────────────┐
│               SUPABASE INTERNO (Lovable Cloud)              │
│                                                             │
│   Tabela: leads_revendedoras                                │
│   (cópia sincronizada + dados do CRM)                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ Exibição no CRM
┌─────────────────────────────────────────────────────────────┐
│                   SISTEMA INTERNO (CRM)                     │
│                                                             │
│   Kanban - Leads Novos                                      │
│   ┌─────────────────────┐                                   │
│   │ Maria Silva         │                                   │
│   │ [WhatsApp]          │                                   │
│   │ São Paulo           │                                   │
│   │ site                │                                   │
│   │ 02/02/26 14:30      │                                   │
│   └─────────────────────┘                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### O Que Será Implementado

| Componente | Descrição |
|------------|-----------|
| **Edge Function** | `sync-leads-from-external` - busca leads do Supabase externo e sincroniza para o interno |
| **Botão de Sincronização** | Adicionar botão "Sincronizar Leads" na página do CRM |
| **Campo de Referência** | Adicionar coluna `external_id` na tabela interna para rastrear origem |

---

### Lógica de Sincronização

1. Buscar todos os leads do Supabase externo
2. Para cada lead, verificar se já existe no interno (via `external_id`)
3. Se não existir, criar novo registro
4. Se existir, manter os dados internos (status, responsável, observações do CRM)

---

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/migrations/xxx.sql` | CRIAR | Adicionar coluna `external_id` na tabela |
| `supabase/functions/sync-leads-from-external/index.ts` | CRIAR | Edge Function de sincronização |
| `src/pages/LeadsRevendedoras.tsx` | EDITAR | Adicionar botão de sincronização |

---

### Seção Técnica

#### 1. Migração: Adicionar coluna external_id

```sql
-- Adicionar coluna para rastrear origem do lead externo
ALTER TABLE public.leads_revendedoras 
ADD COLUMN IF NOT EXISTS external_id uuid UNIQUE;

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_leads_external_id 
ON public.leads_revendedoras(external_id);
```

#### 2. Edge Function: sync-leads-from-external

```typescript
import { createClient } from '@supabase/supabase-js';

// Buscar leads do Supabase externo
const externalClient = createClient(
  Deno.env.get('EXTERNAL_SUPABASE_URL'),
  Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')
);

// Buscar leads do Supabase interno
const internalClient = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
);

// 1. Buscar todos os leads do externo
const { data: externalLeads } = await externalClient
  .from('leads_revendedoras')
  .select('*');

// 2. Buscar IDs já sincronizados
const { data: existingLeads } = await internalClient
  .from('leads_revendedoras')
  .select('external_id');

const existingIds = new Set(existingLeads?.map(l => l.external_id));

// 3. Filtrar apenas novos
const newLeads = externalLeads?.filter(l => !existingIds.has(l.id));

// 4. Inserir novos leads com external_id
for (const lead of newLeads) {
  await internalClient
    .from('leads_revendedoras')
    .insert({
      ...lead,
      external_id: lead.id,
      id: undefined, // Gerar novo ID interno
      status: 'leads_novos', // Sempre começa como novo
    });
}

return { synced: newLeads.length };
```

#### 3. Botão de Sincronização no CRM

```typescript
// Na página LeadsRevendedoras.tsx
const syncMutation = useMutation({
  mutationFn: async () => {
    const { data, error } = await supabase.functions.invoke(
      'sync-leads-from-external'
    );
    if (error) throw error;
    return data;
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['leads-revendedoras'] });
    toast({
      title: 'Sincronização concluída!',
      description: `${data.synced} novos leads importados.`,
    });
  },
});

// No header, junto com "Importar"
<Button 
  variant="outline" 
  onClick={() => syncMutation.mutate()}
  disabled={syncMutation.isPending}
>
  <RefreshCw className={cn("h-4 w-4 mr-2", syncMutation.isPending && "animate-spin")} />
  Sincronizar do Site
</Button>
```

---

### Mapeamento de Campos

| Campo no Externo | Campo no Interno | Observação |
|------------------|------------------|------------|
| `id` | `external_id` | ID original é salvo como referência |
| `nome` | `nome` | Direto |
| `whatsapp` | `whatsapp` | Direto |
| `cidade` | `cidade` | Direto |
| `instagram` | `instagram` | Direto |
| `experiencia_vendas` | `experiencia_vendas` | Direto |
| `tempo_disponivel` | `tempo_disponivel` | Direto |
| `capital_inicial` | `capital_inicial` | Direto |
| `motivacao` | `motivacao` | Direto |
| `utm_source` | `utm_source` | Direto |
| `utm_medium` | `utm_medium` | Direto |
| `utm_campaign` | `utm_campaign` | Direto |
| `created_at` | `created_at` | Data/hora original preservada |
| - | `status` | Sempre `leads_novos` na importação |
| - | `origem` | Sempre `site` |
| - | `responsavel_id` | Null (será atribuído no CRM) |
| - | `observacao` | Null (será preenchido no CRM) |

---

### Resultado Esperado

1. Admin clica em "Sincronizar do Site" no CRM
2. Edge Function busca leads do Supabase externo
3. Novos leads são inseridos no Supabase interno com `external_id`
4. Cards aparecem na coluna "Leads Novos" do Kanban
5. Ao clicar no card, todas as informações do formulário são exibidas:
   - Nome e WhatsApp (com botão de acesso)
   - Cidade e Instagram
   - Data e hora do cadastro
   - Experiência, tempo disponível, capital, motivação
   - UTMs de rastreamento

---

### Sincronização Automática (Opcional Futuro)

Após a implementação manual, podemos adicionar:
- Sincronização automática a cada 5 minutos via cron job
- Webhook no Supabase externo que notifica o interno sobre novos leads
- Notificação push quando novo lead chega

