

## Correção: Rolagem Horizontal do Kanban Travando Após Exclusão

### Problema Identificado

O uso de `e.preventDefault()` no `AlertDialogAction` impede o comportamento normal do Radix UI, incluindo:
1. O fechamento automático do dialog
2. A limpeza correta do **scroll lock** que o Radix aplica ao `body`

Quando o dialog abre, o Radix adiciona `overflow: hidden` ao body. Normalmente, ao fechar (via `AlertDialogAction`), ele remove esse estilo. Com `e.preventDefault()`, a limpeza não acontece corretamente, deixando a página "travada".

---

### Causa Raiz

```typescript
// O problema está aqui:
<AlertDialogAction
  onClick={(e) => {
    e.preventDefault(); // Impede TUDO, incluindo limpeza de scroll lock
    deleteLead.mutate();
  }}
>
```

O `e.preventDefault()` estava necessário para evitar que o dialog fechasse antes da mutação, mas ele também quebra a lógica interna do Radix para restaurar o scroll.

---

### Solução

Usar um **Button normal** ao invés de `AlertDialogAction`, controlando o fechamento manualmente apenas no `onSuccess` da mutação. Isso permite total controle sem interferir nos internos do Radix:

```typescript
// ANTES (problemático)
<AlertDialogAction
  onClick={(e) => {
    e.preventDefault();
    deleteLead.mutate();
  }}
>

// DEPOIS (correto)
<Button
  variant="destructive"
  onClick={() => deleteLead.mutate()}
  disabled={deleteLead.isPending}
>
  {deleteLead.isPending ? "Excluindo..." : "Excluir"}
</Button>
```

O fechamento do dialog continua sendo gerenciado pelo `onSuccess`:
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["leads-revendedoras"] });
  toast({ title: "Lead excluído com sucesso!" });
  setShowDeleteConfirm(false); // Fecha o AlertDialog
  onClose(); // Fecha o Sheet
},
```

---

### Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/leads/LeadDetailsSheet.tsx` | Substituir `AlertDialogAction` por `Button` |

---

### Código Final

```typescript
<AlertDialogFooter>
  <AlertDialogCancel>Cancelar</AlertDialogCancel>
  <Button
    variant="destructive"
    onClick={() => deleteLead.mutate()}
    disabled={deleteLead.isPending}
  >
    {deleteLead.isPending ? "Excluindo..." : "Excluir"}
  </Button>
</AlertDialogFooter>
```

---

### Resultado Esperado

1. Exclusão funciona normalmente
2. Dialog permanece aberto durante a exclusão (controlado por `disabled`)
3. Scroll horizontal do Kanban funciona corretamente após exclusão
4. Nenhum estado de "scroll lock" residual no body

