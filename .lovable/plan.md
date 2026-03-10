

# Encerramento Automático de Ciclo por Saldo Zero

## O que existe hoje

O trigger `t2_processar_pagamento` (AFTER INSERT on `t2_pagamentos`) já faz:
- Decrementa `saldo_a_receber` na apuração
- Incrementa `valor_pago` no ciclo
- Encerra ciclo se `saldo_a_receber <= 0`

Porém, ele usa o campo armazenado `saldo_a_receber` para decidir o encerramento.

## O que será alterado

Atualizar o trigger `t2_processar_pagamento` para, após processar o pagamento, calcular o saldo real a partir dos dados brutos:

```
saldo_restante = valor_empresa - SUM(t2_pagamentos.valor_pago) - SUM(t2_adiantamentos.valor)
```

Se `saldo_restante <= 0`, atualizar `t2_ciclos.status = 'encerrado'`.

## Resumo

| Alteração | Onde |
|-----------|------|
| Atualizar função `t2_processar_pagamento()` para calcular saldo real e encerrar ciclo automaticamente | Migration SQL |
| Nenhuma alteração no frontend | -- |

