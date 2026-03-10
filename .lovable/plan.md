

# Histórico Detalhado de Ciclos na Tela da Revendedora

## O que será feito

Expandir a seção "Histórico de Ciclos" no Sheet da revendedora para mostrar dados completos de cada ciclo, incluindo valores de apuração, pagamentos e adiantamentos, com saldo calculado dinamicamente.

## Alteração — T2Revendedoras.tsx

1. **Ampliar a query `t2-ciclos-rev`**: Além dos dados do ciclo, buscar `t2_apuracoes` (via `ciclo_id`), e separadamente buscar `t2_pagamentos` e `t2_adiantamentos` para os ciclos da revendedora.

2. **Adicionar duas queries auxiliares** (habilitadas quando `selectedId` existe):
   - `t2_apuracoes` filtrado pelos ciclos da revendedora
   - `t2_pagamentos` (via apuracoes) e `t2_adiantamentos` (via ciclo_id)

3. **Calcular saldo por ciclo**: `valor_empresa - pagamentos - adiantamentos`. Se não tem apuração, mostrar "Aguardando apuração".

4. **Redesenhar os cards de ciclo** para exibir:
   - Data de entrega (data_inicio)
   - Valor do kit, Valor vendido, Comissão, Valor empresa (da apuração)
   - Total pago (soma pagamentos + adiantamentos)
   - Saldo restante (calculado)
   - Status com badge colorido

Layout: grid 2 colunas dentro de cada card de ciclo para os valores, com destaque visual para saldo.

| Alteração | Arquivo |
|-----------|---------|
| Queries para apurações, pagamentos e adiantamentos por revendedora | `T2Revendedoras.tsx` |
| Cards de ciclo expandidos com todos os campos solicitados | `T2Revendedoras.tsx` |

Nenhuma alteração de banco de dados ou lógica financeira.

