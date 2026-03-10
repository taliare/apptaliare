

# Validação de Saldo Restante no Pagamento

## O que existe hoje

- Trigger `t2_validar_pagamento` verifica `valor_pago > saldo_a_receber` da apuração
- O `saldo_a_receber` já desconta adiantamentos (feito na criação da apuração) e é decrementado a cada pagamento pelo trigger `t2_processar_pagamento`
- Frontend (PagamentoDialog) já bloqueia valores maiores que `saldo_a_receber`

## O que será alterado

**Atualizar o trigger `t2_validar_pagamento`** para calcular o saldo restante real a partir dos dados brutos:

```
saldo_restante = valor_empresa - soma(t2_pagamentos.valor_pago) - soma(t2_adiantamentos.valor)
```

Se `NEW.valor_pago > saldo_restante`, bloquear com a mensagem: "Valor maior que o saldo restante do ciclo."

Isso garante integridade independentemente do valor armazenado em `saldo_a_receber`.

## Resumo

| Alteração | Onde |
|-----------|------|
| Atualizar função `t2_validar_pagamento()` para calcular saldo real | Migration SQL |
| Nenhuma alteração no frontend | — |

