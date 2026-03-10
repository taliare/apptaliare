

# Controle de Inadimplência T2 — Refatoração

## Problema Atual

A página `T2Inadimplencia.tsx` filtra apenas por `status = 'inadimplente'`, que depende de um trigger/edge function externo. O pedido é usar critérios dinâmicos:

- `data_cobranca < hoje`
- `status != 'encerrado'`
- `saldo_restante > 0` (calculado: valor_empresa - pagamentos - adiantamentos)

## Alteração — T2Inadimplencia.tsx

1. **Query principal**: Buscar ciclos onde `status != 'encerrado'` com join em `t2_revendedoras`, sem filtrar por `status = 'inadimplente'`

2. **Queries auxiliares**: Buscar `t2_apuracoes`, `t2_pagamentos` e `t2_adiantamentos` para os ciclos retornados, para calcular saldo real

3. **Filtro client-side**: Aplicar os critérios de inadimplência:
   - `data_cobranca` existe e é anterior a hoje
   - Saldo calculado (valor_empresa - pagamentos - adiantamentos) > 0

4. **Exibir `data_cobranca`** em vez de `data_vencimento` na coluna de data e no cálculo de dias em atraso

5. **Ordenar** do maior atraso para o menor (desc por dias)

6. **Coluna "Saldo Restante"**: Calculado dinamicamente (não usar `valor_restante` do ciclo)

| Campo Exibido | Fonte |
|---|---|
| Nome da revendedora | `t2_revendedoras.nome_exibicao / nome_completo` |
| Data de cobrança | `t2_ciclos.data_cobranca` |
| Dias em atraso | `differenceInDays(hoje, data_cobranca)` |
| Saldo restante | `valor_empresa - sum(pagamentos) - sum(adiantamentos)` |

Mantém filtros existentes (representante, cidade, faixa de atraso). Nenhuma alteração de banco ou lógica financeira.

| Arquivo | Alteração |
|---|---|
| `src/pages/T2Inadimplencia.tsx` | Refatorar query e cálculo de saldo dinâmico |

