

# Corrigir Drag-and-Drop do Kanban CRM

## Problema

O drag-and-drop esta dificil de usar porque:
- A area de arraste e apenas o pequeno icone de grip (14x14px) - muito pequeno para clicar com precisao
- O usuario espera arrastar o card inteiro, nao apenas um icone minusculo
- O clique no card (`onClick`) compete com o inicio do arraste, causando conflitos

## Solucao

### 1. Tornar o card inteiro arrastavel (`LeadCard.tsx`)

- Mover os `listeners` e `attributes` do dnd-kit do icone de grip para o card (`Card`) inteiro
- Remover o icone `GripVertical` (nao e mais necessario se o card inteiro arrasta)
- Manter `e.stopPropagation()` nos botoes interativos (WhatsApp, chevron) para que eles nao iniciem o arraste
- Ajustar o `cursor` do card para `cursor-grab` / `active:cursor-grabbing`

### 2. Aumentar a distancia de ativacao (`LeadsKanban.tsx`)

- Mudar `PointerSensor` distance de `5` para `8` pixels - isso separa melhor o gesto de "clicar" do gesto de "arrastar", evitando arrastar acidentalmente ao clicar
- Manter `TouchSensor` com delay de 150ms para mobile

### 3. Separar clique de arraste (`LeadCard.tsx`)

- Usar a flag `isDragging` do dnd-kit para impedir que o `onClick` do card dispare apos um arraste
- O `onClick` so abre o `LeadDetailsSheet` se o card **nao** estava sendo arrastado

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/components/leads/LeadCard.tsx` | Listeners no card inteiro, remover GripVertical, proteger onClick contra drag |
| `src/components/leads/LeadsKanban.tsx` | Aumentar distance do PointerSensor para 8 |

## O que NAO muda

- Logica de movimentacao de status entre colunas
- Layout das colunas do Kanban
- Deteccao de colisao (`closestCorners`)
- Funcionalidade do WhatsApp, chevron e LeadDetailsSheet
