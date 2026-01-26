
## Plano: CRM Kanban para Leads de Revendedoras

### Resumo
Transformar a página "Leads Revendedoras" de uma lista simples para um CRM completo no estilo Kanban (como Trello), permitindo arrastar leads entre colunas que representam etapas do funil de conversão.

---

### Estrutura das Colunas Kanban

| Ordem | Coluna | Descrição |
|-------|--------|-----------|
| 1 | Leads Novos | Leads recém-cadastrados, sem contato |
| 2 | Contato Realizado | Lead já foi contatada |
| 3 | Follow-up | Precisa de novo contato |
| 4 | Interessada | Demonstrou interesse real |
| 5 | Cadastro Pendente | Decidiu entrar, aguardando cadastro |
| 6 | Aguardando Kit | Cadastro ok, aguardando kit |
| 7 | Ativada | Convertida em revendedora (final) |
| 8 | Perdida | Desistiu ou não respondeu |

---

### Alterações no Banco de Dados

#### 1. Adicionar colunas na tabela `leads_revendedoras`:

```text
responsavel_id   | uuid     | nullable | FK para profiles (quem está atendendo)
responsavel_nome | text     | nullable | cache do nome do responsável
```

#### 2. Criar tabela de histórico de status:

```text
leads_status_historico
├── id                 | uuid      | PK
├── lead_id            | uuid      | FK leads_revendedoras
├── status_anterior    | text      | nullable (null se for primeiro registro)
├── status_novo        | text      | not null
├── alterado_por       | uuid      | FK profiles (quem fez a mudança)
├── alterado_por_nome  | text      | cache do nome
├── criado_em          | timestamp | default now()
```

#### 3. RLS Policies:
- Admin pode SELECT, INSERT em `leads_status_historico`
- Admin pode UPDATE em `leads_revendedoras` (já existe)

---

### Componentes a Criar

#### `src/components/leads/`

```text
LeadsKanban.tsx          → Componente principal do Kanban
KanbanColumn.tsx         → Cada coluna do funil
LeadCard.tsx             → Card individual da lead (arrastável)
LeadDetailsSheet.tsx     → Painel lateral com detalhes da lead
LeadStatusHistory.tsx    → Lista de histórico de mudanças de status
```

---

### Funcionalidades

#### Card da Lead (visível direto)
- Nome da lead
- WhatsApp (clicável)
- Origem do lead
- Data de entrada (formatada)
- Responsável pelo atendimento (se houver)

#### Painel de Detalhes (ao clicar)
- Todas as informações do lead
- Campo de observações (editável)
- Histórico de mudanças de status (status + data)
- Botão para atribuir responsável

#### Drag and Drop
- Usar `@dnd-kit/core` e `@dnd-kit/sortable` (já instalados)
- Ao arrastar card entre colunas:
  - Atualizar `status` na tabela `leads_revendedoras`
  - Inserir registro em `leads_status_historico`
  - Invalidar queries para atualizar UI

---

### Arquitetura Técnica

```text
┌─────────────────────────────────────────────────────────────────┐
│                      LeadsRevendedoras.tsx                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      DndContext                              │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │ │
│  │  │ Coluna  │ │ Coluna  │ │ Coluna  │ │ Coluna  │  ...      │ │
│  │  │  Novos  │ │ Contato │ │ Follow  │ │ Interes │           │ │
│  │  │         │ │         │ │         │ │         │           │ │
│  │  │ ┌─────┐ │ │ ┌─────┐ │ │         │ │ ┌─────┐ │           │ │
│  │  │ │Card │ │ │ │Card │ │ │         │ │ │Card │ │           │ │
│  │  │ └─────┘ │ │ └─────┘ │ │         │ │ └─────┘ │           │ │
│  │  │ ┌─────┐ │ │         │ │         │ │         │           │ │
│  │  │ │Card │ │ │         │ │         │ │         │           │ │
│  │  │ └─────┘ │ │         │ │         │ │         │           │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LeadDetailsSheet                            │
│  ┌──────────────────────────────────────┐                        │
│  │ Nome: Maria Silva                     │                        │
│  │ WhatsApp: (11) 99999-9999            │                        │
│  │ Origem: Site                          │                        │
│  │ Responsável: João Admin              │                        │
│  │                                        │                        │
│  │ [Observações]                         │                        │
│  │ ___________________________________  │                        │
│  │                                        │                        │
│  │ Histórico:                            │                        │
│  │ • 25/01 - Novos → Contato (João)     │                        │
│  │ • 24/01 - Entrada no sistema          │                        │
│  └──────────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

---

### Responsividade

#### Desktop (lg+)
- Grid horizontal com todas as 8 colunas visíveis
- Scroll horizontal se necessário

#### Tablet (md)
- 4 colunas por vez
- Scroll horizontal

#### Mobile (sm)
- Layout em abas ou accordion
- Uma coluna por vez
- Swipe para navegar entre colunas

---

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/LeadsRevendedoras.tsx` | REESCREVER | Transformar em Kanban |
| `src/components/leads/LeadsKanban.tsx` | CRIAR | Container do Kanban com DndContext |
| `src/components/leads/KanbanColumn.tsx` | CRIAR | Coluna droppable |
| `src/components/leads/LeadCard.tsx` | CRIAR | Card arrastável |
| `src/components/leads/LeadDetailsSheet.tsx` | CRIAR | Painel lateral de detalhes |
| `src/components/leads/LeadStatusHistory.tsx` | CRIAR | Histórico de status |
| Migration SQL | CRIAR | Novas colunas + tabela histórico |

---

### Seção Técnica (Detalhes de Implementação)

#### Mapeamento de Status (atual → novo)

```typescript
const STATUS_MAP = {
  'novo': 'leads_novos',
  'em_contato': 'contato_realizado',
  'aprovada': 'ativada',
  'reprovada': 'perdida',
};
```

#### Estrutura de Dados

```typescript
interface LeadRevendedora {
  id: string;
  created_at: string;
  nome: string;
  whatsapp: string;
  cidade: string | null;
  instagram: string | null;
  experiencia_vendas: string | null;
  tempo_disponivel: string | null;
  capital_inicial: string | null;
  motivacao: string | null;
  origem: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  status: string;
  observacao: string | null;
  responsavel_id: string | null;    // NOVO
  responsavel_nome: string | null;  // NOVO
}

interface LeadStatusHistorico {
  id: string;
  lead_id: string;
  status_anterior: string | null;
  status_novo: string;
  alterado_por: string;
  alterado_por_nome: string;
  criado_em: string;
}
```

#### Constantes do Kanban

```typescript
const KANBAN_COLUMNS = [
  { id: 'leads_novos', label: 'Leads Novos', color: 'blue' },
  { id: 'contato_realizado', label: 'Contato Realizado', color: 'yellow' },
  { id: 'follow_up', label: 'Follow-up', color: 'orange' },
  { id: 'interessada', label: 'Interessada', color: 'purple' },
  { id: 'cadastro_pendente', label: 'Cadastro Pendente', color: 'cyan' },
  { id: 'aguardando_kit', label: 'Aguardando Kit', color: 'indigo' },
  { id: 'ativada', label: 'Ativada', color: 'green', final: true },
  { id: 'perdida', label: 'Perdida', color: 'red', final: true },
];
```

#### Lógica de Drag and Drop

```typescript
const handleDragEnd = async (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const leadId = active.id as string;
  const newStatus = over.id as string;
  const lead = leads.find(l => l.id === leadId);
  
  if (!lead || lead.status === newStatus) return;

  // 1. Update lead status
  await supabase
    .from('leads_revendedoras')
    .update({ status: newStatus })
    .eq('id', leadId);

  // 2. Insert history record
  await supabase
    .from('leads_status_historico')
    .insert({
      lead_id: leadId,
      status_anterior: lead.status,
      status_novo: newStatus,
      alterado_por: user.id,
      alterado_por_nome: profile.nome,
    });

  // 3. Invalidate queries
  queryClient.invalidateQueries({ queryKey: ['leads-revendedoras'] });
};
```

#### SQL Migration

```sql
-- 1. Add columns to leads_revendedoras
ALTER TABLE public.leads_revendedoras
ADD COLUMN responsavel_id uuid REFERENCES public.profiles(id),
ADD COLUMN responsavel_nome text;

-- 2. Create status history table
CREATE TABLE public.leads_status_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads_revendedoras(id) ON DELETE CASCADE,
  status_anterior text,
  status_novo text NOT NULL,
  alterado_por uuid REFERENCES public.profiles(id),
  alterado_por_nome text,
  criado_em timestamptz DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.leads_status_historico ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Admin pode ver histórico"
ON public.leads_status_historico FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode inserir histórico"
ON public.leads_status_historico FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. Migrate existing status values to new format
UPDATE public.leads_revendedoras SET status = 'leads_novos' WHERE status = 'novo';
UPDATE public.leads_revendedoras SET status = 'contato_realizado' WHERE status = 'em_contato';
UPDATE public.leads_revendedoras SET status = 'ativada' WHERE status = 'aprovada';
UPDATE public.leads_revendedoras SET status = 'perdida' WHERE status = 'reprovada';
```

---

### Acesso

A rota `/leads-revendedoras` já está protegida para apenas admins:

```typescript
<Route path="/leads-revendedoras" element={
  <ProtectedRoute requiredRole="admin">
    <LeadsRevendedoras />
  </ProtectedRoute>
} />
```

Sobre a role "VENDAS" mencionada: atualmente o sistema só tem `admin`, `representante` e `producao`. Se no futuro for necessário criar uma role específica para vendas, será preciso:
1. Alterar o enum `app_role`
2. Atualizar as policies de RLS
3. Atualizar o menu lateral

Por ora, o CRM ficará acessível apenas para admins.

---

### Resultado Final

Um CRM funcional onde o time de vendas (admins) pode:
- Visualizar todas as leads em um quadro Kanban
- Arrastar leads entre etapas do funil
- Ver detalhes completos de cada lead
- Adicionar observações
- Ver histórico de mudanças de status
- Atribuir responsáveis pelo atendimento
