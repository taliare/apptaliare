

# Correção: Restaurar valor original da nota 5512

## Situação

A nota 5512 (Sara Kelly Belchior Costa) está com `valor_previsto = 2500` (valor da venda registrado durante o teste). O valor original do kit é `4630`. Como o teste foi revertido (`status = pendente`, `valor_pago_acumulado = 0`), o `valor_previsto` precisa voltar ao valor do kit.

## Solução

Executar uma migração SQL simples:

```sql
UPDATE cobrancas_agendadas 
SET valor_previsto = 4630 
WHERE id = '58f12fc0-3bb8-4cd5-b72b-ccc99e217b06';
```

Apenas uma alteração pontual de dados, sem mudança de código.

