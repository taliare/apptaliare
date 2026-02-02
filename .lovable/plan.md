

## Plano: Sincronização Automática de Leads a Cada 5 Minutos

### Resumo

Vou criar um cron job que executa automaticamente a Edge Function `sync-leads-from-external` a cada 5 minutos, eliminando a necessidade de clicar manualmente no botão "Sincronizar do Site".

---

### O Que Será Implementado

| Componente | Descrição |
|------------|-----------|
| **Cron Job** | Criar job `sync-leads-cron` que executa a cada 5 minutos |
| **Edge Function** | Ajustar `sync-leads-from-external` para funcionar sem autenticação quando chamada pelo cron |

---

### Fluxo da Sincronização Automática

```text
┌──────────────────────────────────────────────────────────────┐
│   A cada 5 minutos:                                          │
│   ┌────────────────────────────────────────────────────────┐ │
│   │  pg_cron dispara                                       │ │
│   │        ↓                                               │ │
│   │  pg_net.http_post() chama Edge Function                │ │
│   │        ↓                                               │ │
│   │  sync-leads-from-external executa                      │ │
│   │        ↓                                               │ │
│   │  Se há novos leads:                                    │ │
│   │  ├── Insere no banco interno                           │ │
│   │  └── Cria notificações para admins                     │ │
│   └────────────────────────────────────────────────────────┘ │
│                                                              │
│   Admin vê:                                                  │
│   ├── Badge no menu CRM atualiza automaticamente            │
│   ├── Notificação no sino quando há novos leads             │
│   └── Leads aparecem no Kanban em tempo real                │
└──────────────────────────────────────────────────────────────┘
```

---

### Cron Jobs Existentes (Referência)

O projeto já possui 3 cron jobs configurados:

| Job | Schedule | Descrição |
|-----|----------|-----------|
| `daily-closing-reminder` | `0 21 * * 1-6` | 21h de segunda a sábado |
| `weekly-report` | `0 11 * * 1` | 11h toda segunda-feira |
| `auto-close-daily-job` | `3 3 * * 1-6` | 3:03 de segunda a sábado |

---

### Alterações Necessárias

| Arquivo/Componente | Ação | Descrição |
|-------------------|------|-----------|
| Edge Function `sync-leads-from-external` | EDITAR | Permitir execução via cron (sem auth do usuário) |
| Banco de dados | SQL | Criar cron job para executar a cada 5 minutos |

---

### Seção Técnica

#### 1. Ajuste na Edge Function

A função atual requer autenticação de usuário admin. Para o cron funcionar, preciso adicionar uma verificação de chamada interna via header especial ou detectar quando é uma chamada do cron:

```typescript
// Detectar se é chamada do cron (sem Authorization header mas com body específico)
const isCronCall = !authHeader && req.method === "POST";

if (isCronCall) {
  console.log("Sincronização automática via cron job");
  // Pular verificação de admin, executar diretamente
} else {
  // Manter verificação de admin para chamadas manuais
}
```

#### 2. Cron Job SQL

Usando o mesmo padrão dos cron jobs existentes:

```sql
SELECT cron.schedule(
  'sync-leads-cron',
  '*/5 * * * *',  -- A cada 5 minutos
  $$
  SELECT net.http_post(
    url := 'https://iqluvckcmbcndjjkfznw.supabase.co/functions/v1/sync-leads-from-external',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <anon-key>"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);
```

O schedule `*/5 * * * *` significa:
- `*/5` = a cada 5 minutos
- `*` = toda hora
- `*` = todo dia do mês
- `*` = todo mês
- `*` = todo dia da semana

---

### Resultado Esperado

1. **Sem intervenção manual**: Leads do site são importados automaticamente a cada 5 minutos
2. **Notificações**: Admins recebem notificação quando novos leads chegam
3. **Badge atualizada**: O contador no menu CRM reflete os novos leads em até 30 segundos
4. **Botão manual ainda funciona**: O botão "Sincronizar do Site" continua disponível para forçar sincronização imediata

---

### Considerações

- O cron executa 24/7, incluindo fins de semana e madrugada
- A função é idempotente (não duplica leads já sincronizados via `external_id`)
- Logs de execução ficam disponíveis no painel do backend

