

# Corrigir Drop em Colunas do Kanban CRM

## Problema Raiz

O algoritmo de deteccao de colisao `closestCorners` calcula distancias entre cantos do card arrastado e cantos das colunas. Em colunas lado a lado de 280px, isso frequentemente seleciona a coluna **errada** ou nenhuma coluna, fazendo com que "Contato Realizado" (e potencialmente outras) nao aceitem drops.

## Solucao

### Arquivo: `src/components/leads/LeadsKanban.tsx`

Trocar o algoritmo de colisao de `closestCorners` para `pointerWithin`:

- `pointerWithin` verifica se o **ponteiro do mouse** esta dentro do retangulo da coluna destino
- Muito mais intuitivo e previsivel para quadros Kanban com colunas lado a lado
- Resolve o problema para **todas** as 7 colunas de uma vez

Alteracao unica: na importacao e no `DndContext`, substituir `closestCorners` por `pointerWithin`.

### Arquivo: `src/components/leads/KanbanColumn.tsx`

Aumentar a area minima de drop para facilitar o alvo:

- Mudar `min-h-[200px]` para `min-h-[300px]` na area de cards, garantindo zona de drop maior mesmo em colunas com poucos cards

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/components/leads/LeadsKanban.tsx` | Trocar `closestCorners` por `pointerWithin` |
| `src/components/leads/KanbanColumn.tsx` | Aumentar min-height da zona de drop |

## O que NAO muda

- Logica de movimentacao de status
- Layout geral das colunas
- Funcionalidade dos cards (clique, WhatsApp, expandir)
- Sensor de ativacao (distance 8px, touch delay 150ms)

