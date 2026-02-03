

## Plano: Corrigir Drag & Drop do Kanban + Adicionar Opção de Excluir Lead

### Resumo

Vou corrigir dois problemas no CRM Kanban:
1. **Melhorar a movimentação de cards** - Atualmente está difícil arrastar cards entre colunas
2. **Adicionar opção de excluir lead** - Para manter o CRM organizado

---

### Problemas Identificados

| Problema | Causa | Solução |
|----------|-------|---------|
| Difícil mover cards | Algoritmo `closestCenter` não funciona bem para Kanban horizontal | Mudar para `pointerWithin` |
| Cards não respondem bem ao drag | Conflito entre `useSortable` (sorting dentro da coluna) e `useDroppable` (drop entre colunas) | Simplificar para usar apenas `useDraggable` + `useDroppable` |
| Botão WhatsApp interfere no drag | O clique no botão captura o evento de drag | Separar área de drag do botão |
| Sem opção de excluir | Funcionalidade não implementada | Adicionar botão de exclusão com confirmação |

---

### Solução 1: Melhorar Drag & Drop

A implementação atual mistura `useSortable` (para ordenar cards dentro de uma coluna) com `useDroppable` (para aceitar drops nas colunas). Isso causa conflitos.

**Mudanças:**

1. Trocar de `useSortable` para `useDraggable` no `LeadCard`
2. Usar algoritmo de colisão `pointerWithin` em vez de `closestCenter`
3. Adicionar um "drag handle" (ícone de arrastar) para evitar conflito com o botão WhatsApp
4. Remover o `SortableContext` das colunas (não precisamos ordenar dentro da coluna)

---

### Solução 2: Adicionar Exclusão de Lead

1. Adicionar botão "Excluir" no sheet de detalhes do lead (`LeadDetailsSheet`)
2. Mostrar confirmação antes de excluir (AlertDialog)
3. Ao excluir, também remover registros do histórico de status (`leads_status_historico`)

---

### Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/leads/LeadCard.tsx` | EDITAR | Trocar `useSortable` por `useDraggable` + adicionar drag handle |
| `src/components/leads/LeadsKanban.tsx` | EDITAR | Mudar collision detection para `pointerWithin` |
| `src/components/leads/KanbanColumn.tsx` | EDITAR | Remover `SortableContext`, manter apenas `useDroppable` |
| `src/components/leads/LeadDetailsSheet.tsx` | EDITAR | Adicionar botão de exclusão com confirmação |

---

### Seção Técnica

#### 1. LeadCard.tsx - Usar useDraggable

```typescript
// ANTES - useSortable (problemático)
import { useSortable } from "@dnd-kit/sortable";
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });

// DEPOIS - useDraggable (mais simples e confiável para Kanban)
import { useDraggable } from "@dnd-kit/core";
const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });

// Adicionar ícone de drag handle (GripVertical) para melhor UX
<div {...listeners} {...attributes} className="cursor-grab">
  <GripVertical className="h-4 w-4 text-muted-foreground" />
</div>
```

#### 2. LeadsKanban.tsx - Mudar Algoritmo de Colisão

```typescript
// ANTES - closestCenter (ruim para Kanban horizontal)
import { closestCenter } from "@dnd-kit/core";
<DndContext collisionDetection={closestCenter} ...>

// DEPOIS - pointerWithin (melhor para detectar em qual coluna o cursor está)
import { pointerWithin } from "@dnd-kit/core";
<DndContext collisionDetection={pointerWithin} ...>
```

#### 3. KanbanColumn.tsx - Remover SortableContext

```typescript
// ANTES - Com SortableContext (desnecessário)
<SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
  {leads.map((lead) => <LeadCard ... />)}
</SortableContext>

// DEPOIS - Sem SortableContext
<div className="space-y-2 min-h-[100px]">
  {leads.map((lead) => <LeadCard ... />)}
</div>
```

#### 4. LeadDetailsSheet.tsx - Adicionar Exclusão

```typescript
// Adicionar estado e mutation para exclusão
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

const deleteLead = useMutation({
  mutationFn: async () => {
    if (!lead) throw new Error("No lead selected");
    
    // Primeiro, deletar histórico
    await supabase
      .from("leads_status_historico")
      .delete()
      .eq("lead_id", lead.id);
    
    // Depois, deletar o lead
    const { error } = await supabase
      .from("leads_revendedoras")
      .delete()
      .eq("id", lead.id);
    
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["leads-revendedoras"] });
    toast({ title: "Lead excluído com sucesso!" });
    onClose();
  },
});

// UI do botão de exclusão (no final do sheet)
<Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
  <Trash2 className="h-4 w-4 mr-2" />
  Excluir Lead
</Button>

// AlertDialog de confirmação
<AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
      <AlertDialogDescription>
        Esta ação não pode ser desfeita. O lead "{lead?.nome}" será removido permanentemente.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={() => deleteLead.mutate()}>
        Excluir
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

### Visual do Card Atualizado

```text
┌─────────────────────────────────┐
│ ⠿  João Silva                  │  ← Ícone de arrastar (GripVertical)
├─────────────────────────────────┤
│ [💬 WhatsApp]                   │  ← Botão separado (não interfere no drag)
├─────────────────────────────────┤
│ 📍 São Paulo                    │
│ 📅 03/02/26                     │
│ 👤 Maria (responsável)         │
└─────────────────────────────────┘
```

---

### Visual do Sheet com Exclusão

```text
┌─────────────────────────────────────┐
│ João Silva    [Leads Novos]         │
├─────────────────────────────────────┤
│ 📞 (11) 99999-9999 → WhatsApp       │
│ 📍 São Paulo                        │
│ ...                                 │
├─────────────────────────────────────┤
│ [Salvar Observação]                 │
├─────────────────────────────────────┤
│ Histórico de Status                 │
│ ...                                 │
├─────────────────────────────────────┤
│ [🗑️ Excluir Lead]  ← NOVO           │
└─────────────────────────────────────┘
```

---

### Resultado Esperado

1. **Drag & Drop fluido**: Cards podem ser arrastados facilmente entre colunas
2. **Feedback visual**: Cursor muda para "grab" no ícone de arrastar
3. **WhatsApp funciona**: Botão de WhatsApp não interfere mais no drag
4. **Exclusão segura**: Leads podem ser excluídos com confirmação prévia
5. **Dados limpos**: Histórico do lead também é removido ao excluir

