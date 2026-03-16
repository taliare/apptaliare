

# Adicionar Controle de Zoom ao CRM Kanban

## O que será feito

Adicionar uma barra de controle de zoom acima do Kanban com botões de **zoom in (+)**, **zoom out (-)** e um **slider** para ajuste fino. O zoom será aplicado via CSS `transform: scale()` no container das colunas, variando de 50% a 100% (padrão 80% para caber tudo na tela).

## Alterações

### `src/components/leads/LeadsKanban.tsx`

- Adicionar estado `zoom` (padrão: 0.8, range: 0.5 a 1.0)
- Renderizar barra de controle com:
  - Botão **ZoomOut** (-) 
  - Componente **Slider** para ajuste contínuo
  - Botão **ZoomIn** (+)
  - Label com porcentagem atual (ex: "80%")
- Aplicar `transform: scale(zoom)` + `transform-origin: top left` no container flex das colunas
- Ajustar largura do container com `width: ${100/zoom}%` para compensar o scale e manter o scroll correto

| Arquivo | Mudança |
|---|---|
| `src/components/leads/LeadsKanban.tsx` | Adicionar estado de zoom, barra de controle e CSS transform no container |

