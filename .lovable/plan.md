
## Plano: Corrigir Funcionalidade do Botão "Reabrir Dia"

### Diagnóstico

O botão "Reabrir Dia" **está funcionando corretamente** no backend - os logs de rede confirmam:
- PATCH request com `{"finalizado":false}` retorna status 204 (sucesso)
- O dado é atualizado no banco de dados

O problema está na **sincronização Realtime** entre a tela do Admin e a tela do Representante:

1. **A subscription no CobrancaDiaria.tsx está vinculada à data atual (`dateStr`)** - se o representante estiver vendo uma data diferente, não recebe a notificação
2. **A subscription é recriada quando a data muda** - pode haver condições de corrida
3. **O representante precisa recarregar a página** para ver a mudança

---

### Solução

Modificar a subscription do Realtime para escutar **todas as mudanças do representante** (não filtrar por data no evento) e invalidar as queries de forma mais abrangente.

---

### Alterações no Arquivo

**Arquivo:** `src/pages/CobrancaDiaria.tsx`

#### 1. Modificar a Subscription Realtime (linhas 153-195)

**De:**
```typescript
useEffect(() => {
  if (!user?.id) return;
  
  const channel = supabase
    .channel('cobranca-diaria-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'cobrancas_diarias',
        filter: `representante_id=eq.${user.id}`
      },
      (payload) => {
        // ... lógica atual
        queryClient.invalidateQueries({ 
          queryKey: ['cobranca-diaria', dateStr, user.id] 
        });
        // ...
      }
    )
    .subscribe();
}, [user?.id, dateStr, queryClient]); // dateStr como dependência
```

**Para:**
```typescript
useEffect(() => {
  if (!user?.id) return;
  
  const channel = supabase
    .channel('cobranca-diaria-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'cobrancas_diarias',
        filter: `representante_id=eq.${user.id}`
      },
      (payload) => {
        const newData = payload.new as CobrancaDiariaType;
        const oldData = payload.old as CobrancaDiariaType;
        
        // Invalidar TODAS as queries de cobrança diária do usuário
        queryClient.invalidateQueries({ 
          queryKey: ['cobranca-diaria'],
          predicate: (query) => 
            Array.isArray(query.queryKey) && 
            query.queryKey[0] === 'cobranca-diaria' &&
            query.queryKey[2] === user.id
        });
        
        // Também invalidar outras queries relacionadas
        queryClient.invalidateQueries({ 
          queryKey: ['historico-cobrancas', user.id] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['dias-nao-finalizados', user.id] 
        });
        
        // Notificar o usuário sobre a mudança
        if (newData.finalizado === false && oldData.finalizado === true) {
          toast.info(`O administrador reabriu o dia ${newData.data} para ajustes`, {
            duration: 5000
          });
        }
        
        if (newData.finalizado === true && oldData.finalizado === false) {
          toast.info(`O dia ${newData.data} foi finalizado`);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user?.id, queryClient]); // REMOVER dateStr das dependências
```

#### Principais Mudanças:

1. **Remover `dateStr` das dependências** - A subscription não será recriada quando o usuário mudar de data
2. **Invalidar queries de forma mais abrangente** - Usar `predicate` para invalidar todas as queries do tipo `cobranca-diaria` do usuário
3. **Invalidar queries relacionadas** - Também atualizar histórico e dias não finalizados
4. **Melhorar a mensagem de notificação** - Incluir a data específica que foi reaberta

---

### Resultado Esperado

Após as mudanças:
1. Quando o admin clicar em "Reabrir Dia", a atualização será enviada pelo Realtime
2. O representante receberá a notificação **independentemente de qual data estiver visualizando**
3. A interface do representante será atualizada automaticamente com o novo status
4. Se o representante estiver vendo a mesma data reaberta, verá o dia como "em aberto" imediatamente

---

### Fluxo Visual

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         ADMIN (FechamentoDiario)                     │
│  1. Seleciona representante + data                                   │
│  2. Clica "Reabrir Dia"                                             │
│  3. Confirma no AlertDialog                                          │
│  4. UPDATE cobrancas_diarias SET finalizado = false                  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SUPABASE REALTIME                                 │
│  Publica evento UPDATE na tabela cobrancas_diarias                   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   REPRESENTANTE (CobrancaDiaria)                     │
│  1. Subscription recebe payload com old/new                          │
│  2. Detecta: finalizado false ← true                                 │
│  3. toast.info("Admin reabriu dia 2026-01-24")                       │
│  4. Invalida queries → UI atualiza                                   │
│  5. Representante pode editar o dia reaberto                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/CobrancaDiaria.tsx` | **MODIFICAR** | Ajustar subscription Realtime para ser mais robusta |
