

# Plano: Remover popup de Guia Rapido da Agenda de Cobranca

## O que sera feito

Remover completamente o tutorial/guia rapido da pagina de Agenda de Cobrancas, incluindo:

1. O botao "Guia Rapido" no cabecalho da pagina
2. O componente `TutorialCobranca` renderizado no final da pagina
3. O estado `showTutorial` e a logica de localStorage associada
4. O import do componente `TutorialCobranca` e do icone `HelpCircle`

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/pages/Cobranca.tsx` | Remover import, estado, botao e renderizacao do tutorial |

## Detalhes tecnicos

### Remocoes em `src/pages/Cobranca.tsx`

1. **Import**: Remover a linha `import { TutorialCobranca } from '@/components/cobranca/TutorialCobranca'` e o icone `HelpCircle` (se nao for usado em outro lugar)
2. **Estado**: Remover o `useState` de `showTutorial` (linhas 72-74)
3. **Botao**: Remover o `Button` com icone `HelpCircle` e texto "Guia Rapido" (linhas 801-809)
4. **Componente**: Remover o bloco `<TutorialCobranca ... />` no final do JSX (linhas 1305-1314)

O arquivo `src/components/cobranca/TutorialCobranca.tsx` sera mantido no projeto por enquanto (pode ser removido futuramente se desejado), ja que a unica referencia a ele sera eliminada.

