

## Plano: Notificação Push para Novos Leads + Badge no Menu CRM

### Resumo

Vou implementar duas funcionalidades:
1. **Notificação push para admins** quando um novo lead se cadastrar no site
2. **Badge (bolinha com número)** no menu lateral CRM mostrando quantidade de leads novos

---

### O Que Será Implementado

| Componente | Descrição |
|------------|-----------|
| **Edge Function** | Modificar `sync-leads-from-external` para enviar notificações push e criar notificações no banco quando novos leads forem sincronizados |
| **Hook de Leads Novos** | Criar hook `useNewLeadsCount` para buscar contagem de leads com status "leads_novos" |
| **AppSidebar** | Adicionar badge dinâmica no menu CRM mostrando contagem de leads novos |
| **MobileDrawer** | Adicionar mesma badge no drawer mobile |

---

### Fluxo da Notificação

```text
┌─────────────────────────────────────────────────────────────┐
│   1. Admin clica em "Sincronizar do Site"                  │
│      ↓                                                      │
│   2. Edge Function busca leads do site externo              │
│      ↓                                                      │
│   3. Se há novos leads:                                     │
│      ├── Insere no banco interno                            │
│      ├── Cria notificação na tabela "notifications"         │
│      │   para cada admin                                    │
│      └── Envia push notification para admins                │
│      ↓                                                      │
│   4. Admin recebe:                                          │
│      ├── Push no dispositivo (se ativado)                   │
│      ├── Badge no sino de notificações                      │
│      └── Badge no menu CRM (quantidade de leads novos)      │
└─────────────────────────────────────────────────────────────┘
```

---

### Badge no Menu CRM

A badge mostrará a quantidade de leads com status "leads_novos":

```text
┌─────────────────────────┐
│ OPERACIONAL             │
├─────────────────────────┤
│ 👤 Usuários             │
│ 👥 Revendedoras         │
│ 👥 Venda Externa        │
│ ➕ CRM           [10]   │  ← Badge com número de leads novos
│ 📦 Distribuição de Kits │
│ 🛡️ Garantias            │
└─────────────────────────┘
```

- Quando não há leads novos, a badge não aparece
- A contagem atualiza automaticamente quando leads são movidos para outro status
- Funciona tanto no sidebar desktop quanto no drawer mobile

---

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/hooks/useNewLeadsCount.ts` | CRIAR | Hook para buscar contagem de leads novos |
| `supabase/functions/sync-leads-from-external/index.ts` | EDITAR | Adicionar criação de notificações e push |
| `src/components/AppSidebar.tsx` | EDITAR | Adicionar badge dinâmica no menu CRM |
| `src/components/MobileDrawer.tsx` | EDITAR | Adicionar badge dinâmica no menu CRM |

---

### Seção Técnica

#### 1. Hook useNewLeadsCount

```typescript
// src/hooks/useNewLeadsCount.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useNewLeadsCount() {
  const { data: count = 0 } = useQuery({
    queryKey: ["leads-novos-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("leads_revendedoras")
        .select("*", { count: "exact", head: true })
        .eq("status", "leads_novos");
      
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000, // Atualiza a cada 30s
  });

  return count;
}
```

#### 2. Modificação da Edge Function sync-leads-from-external

Após inserir os leads, adicionar:

```typescript
// Buscar todos os admins
const { data: adminUsers } = await internalClient
  .from("user_roles")
  .select("user_id")
  .eq("role", "admin");

// Criar notificações para cada admin
if (adminUsers && insertedLeads && insertedLeads.length > 0) {
  const notifications = adminUsers.map((admin) => ({
    user_id: admin.user_id,
    title: "Novos leads do site!",
    message: `${insertedLeads.length} novo(s) lead(s) cadastrado(s) no site.`,
    type: "lead",
    link: "/leads-revendedoras",
  }));

  await internalClient.from("notifications").insert(notifications);

  // Enviar push notifications (opcional - se VAPID configurado)
  // Usa a mesma lógica do send-push-notification
}
```

#### 3. AppSidebar com Badge

```typescript
// Importar o hook
import { useNewLeadsCount } from "@/hooks/useNewLeadsCount";

// No componente
const newLeadsCount = useNewLeadsCount();

// No item CRM, adicionar badge dinamicamente
{ 
  title: "CRM", 
  url: "/leads-revendedoras", 
  icon: UserPlus,
  badge: newLeadsCount  // Badge com contagem
}
```

#### 4. MobileDrawer com Badge

Mesma lógica aplicada no drawer mobile para consistência.

---

### Resultado Esperado

1. **Quando leads são sincronizados**:
   - Admins recebem notificação push (se ativado)
   - Aparece notificação no sino (badge vermelha)
   - Menu CRM mostra badge com quantidade de leads novos

2. **Badge no CRM**:
   - Mostra número de leads com status "leads_novos"
   - Atualiza automaticamente a cada 30 segundos
   - Quando lead é movido para outro status, contador diminui
   - Se não há leads novos, badge não aparece

3. **Consistência**:
   - Funciona igual no desktop (sidebar) e mobile (drawer)

