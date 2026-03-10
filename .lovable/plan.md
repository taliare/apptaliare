

# Reorganização da Lista de Ciclos

## Mapeamento de campos

O usuário menciona `data_prevista_acerto` e `data_entrega`. Na tabela `t2_ciclos`:
- **Data de entrega** = `data_inicio` (quando o ciclo foi criado/kit entregue)
- **Data prevista de acerto** = `data_cobranca` (data de cobrança, já usada como referência)
- **Saldo atual** = `valor_restante`

Não será necessário criar colunas novas.

## Alterações

### T2Ciclos.tsx — Simplificar para lista ordenada

- Remover o agrupamento por seções (Atrasados, Hoje, Amanhã, etc.)
- Remover as funções `groupCiclosByAgenda` e `getCicloIndicator`
- Ordenar ciclos por `data_cobranca` ascendente (já vem do banco)
- Cada card mostra: Revendedora, Data de entrega, Data prevista de acerto, Valor do kit, Saldo atual, Status
- Destaque visual: borda vermelha para atrasados (`data_cobranca < hoje` e status ≠ encerrado), borda primária para vencendo hoje
- Manter botões de Prestação e Adiantamento
- Manter dialogs existentes sem alteração

### Resumo

| Alteração | Arquivo |
|-----------|---------|
| Simplificar lista, remover agrupamento por seções, adicionar destaques visuais | `T2Ciclos.tsx` |

Nenhuma alteração de lógica financeira ou banco de dados.

