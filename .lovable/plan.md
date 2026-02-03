

## Correção Definitiva: CRM Travando Após Exclusão de Lead

### Problema Identificado

O código atual tem um **AlertDialog aninhado dentro de um Sheet**, ambos componentes do Radix UI que aplicam scroll lock no body. Ao analisar o código-fonte do Radix UI, encontrei:

```typescript
// node_modules/@radix-ui/react-alert-dialog/dist/index.d.ts linha 7
interface AlertDialogProps extends Omit<DialogProps, 'modal'> {}
```

O AlertDialog **sempre é modal** e não permite desabilitar o scroll lock. Quando temos dois modais aninhados:

1. O Sheet abre e aplica `data-scroll-locked="1"` no body
2. O AlertDialog abre e incrementa para `data-scroll-locked="2"`
3. Quando o AlertDialog fecha, ele remove o scroll lock de forma incorreta, interferindo no lock do Sheet
4. O Sheet também fecha (via `onClose()`), mas o estado do body fica corrompido

---

### Causa Raiz

O problema NÃO é o botão ou a mutação - é a **arquitetura de modais aninhados** do Radix UI que conflita com o gerenciamento de scroll locks.

Quando olhamos para a estrutura atual:

```text
Sheet (scroll-lock=1)
  └── AlertDialog (scroll-lock=2)
         └── Button onClick → mutate() → onSuccess → fecha AlertDialog + fecha Sheet
```

Ao fechar ambos os modais em sequência rápida (no `onSuccess`), o Radix não consegue gerenciar corretamente o ciclo de vida dos scroll locks.

---

### Solucao

**Usar Dialog normal com `modal={false}`** ao invés de AlertDialog. Isso evita que o dialog interno aplique seu próprio scroll lock, deixando apenas o Sheet gerenciar:

```typescript
// Antes: AlertDialog (sempre modal, sempre scroll lock)
<AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>

// Depois: Dialog com modal={false}
<Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm} modal={false}>
```

---

### Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/leads/LeadDetailsSheet.tsx` | Substituir AlertDialog por Dialog com `modal={false}` |

---

### Codigo Final

```typescript
// Imports
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// No JSX (substituir o AlertDialog existente):
<Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm} modal={false}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Excluir lead?</DialogTitle>
      <DialogDescription>
        Esta acao nao pode ser desfeita. O lead "{lead?.nome}" sera removido permanentemente do sistema.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
        Cancelar
      </Button>
      <Button
        variant="destructive"
        onClick={() => deleteLead.mutate()}
        disabled={deleteLead.isPending}
      >
        {deleteLead.isPending ? "Excluindo..." : "Excluir"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### Diferencas Principais

| Aspecto | AlertDialog | Dialog modal={false} |
|---------|-------------|---------------------|
| Scroll Lock | Sempre aplica | Nao aplica |
| Fecha ao clicar fora | Nao | Sim (controlavel) |
| Conflito com Sheet | Sim | Nao |

---

### Resultado Esperado

1. Exclusao funciona normalmente
2. Rolagem horizontal do Kanban continua funcionando apos exclusao
3. Nenhum estado de scroll-lock residual no body
4. Dialog de confirmacao funciona dentro do Sheet sem conflitos

