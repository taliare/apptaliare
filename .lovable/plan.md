

## Correção: Exclusão de Leads no CRM

### Problema Identificado

O código atual usa `AlertDialogAction` que fecha o dialog **antes** de executar o `onClick`. Isso pode causar problemas de timing com a mutação.

Porém, após análise mais profunda, verifiquei que:

1. As políticas RLS de DELETE **estão criadas e funcionando** (confirmado pela consulta ao banco)
2. O usuário logado **é admin** (user_id: `6ff5326e-7f4c-47ca-b77a-fca04b60bbf2`)
3. O lead "Teste Ref" **ainda existe** no banco (id: `f152e6c3-c162-4126-882a-4decb74735a4`)

O problema está no comportamento do `AlertDialogAction` do Radix UI: ele fecha o dialog automaticamente quando clicado, o que pode cancelar a execução da mutação em alguns casos.

---

### Causa Raiz

O `AlertDialogAction` chama `onClick` mas também dispara o fechamento do dialog simultaneamente. Se o componente desmonta antes da mutação iniciar, ela pode ser interrompida.

---

### Solução

Modificar o `AlertDialogAction` para usar `onClick` com `preventDefault` e gerenciar o fechamento manualmente após a conclusão da mutação:

```typescript
// ANTES (problemático)
<AlertDialogAction
  onClick={() => deleteLead.mutate()}
  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
>
  {deleteLead.isPending ? "Excluindo..." : "Excluir"}
</AlertDialogAction>

// DEPOIS (corrigido)
<AlertDialogAction
  onClick={(e) => {
    e.preventDefault(); // Impede o fechamento automático
    deleteLead.mutate();
  }}
  disabled={deleteLead.isPending}
  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
>
  {deleteLead.isPending ? "Excluindo..." : "Excluir"}
</AlertDialogAction>
```

---

### Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/leads/LeadDetailsSheet.tsx` | Adicionar `e.preventDefault()` no `AlertDialogAction` |

---

### Resultado Esperado

1. Ao clicar em "Excluir", o dialog permanece aberto enquanto a mutação executa
2. O botão mostra "Excluindo..." durante o processo
3. Após sucesso, o dialog e o sheet fecham automaticamente
4. O lead é removido do Kanban

