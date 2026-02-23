

# Simplificar Cards do CRM Kanban

## Objetivo

Reduzir o tamanho visual dos cards no Kanban, mostrando apenas o **nome** e o **botao de WhatsApp** por padrao. As demais informacoes (cidade, origem, data, responsavel) ficam ocultas e podem ser expandidas com um clique.

## Alteracoes

### Arquivo: `src/components/leads/LeadCard.tsx`

- Manter visivel apenas:
  - Nome do lead (truncado)
  - Botao de WhatsApp (compacto)
- Esconder por padrao (em um bloco colapsavel):
  - Cidade
  - Origem
  - Data de criacao
  - Responsavel
- Adicionar um pequeno icone/botao de expandir (chevron) para revelar os detalhes extras
- Remover o grip de drag da area visivel principal e manter o card inteiro arrastavel pelo handle existente
- Reduzir padding geral do card para ficar mais compacto

### Comportamento

- Card padrao: nome + WhatsApp + chevron pequeno
- Ao clicar no chevron: expande mostrando cidade, origem, data e responsavel
- Clicar no card continua abrindo o LeadDetailsSheet normalmente

## Detalhes tecnicos

- Usar estado local `expanded` com `useState` no LeadCard
- O clique no chevron usa `e.stopPropagation()` para nao abrir o Sheet
- Nenhum outro arquivo precisa ser alterado
- Nenhuma logica de drag-and-drop sera modificada

