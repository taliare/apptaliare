

# Correção do modal "Buscar Nota na Agenda"

## Resumo
Duas correções pontuais no modal de busca de nota em `src/pages/CobrancaDiaria.tsx`:
1. Exibir saldo em aberto ao invés do valor total quando há pagamentos anteriores
2. Esconder botão "Joias adicionais" quando a nota já foi parcialmente paga

## Alterações

### Correção 1 — Valor exibido (linhas 1374-1379)
Substituir a exibição fixa de `valor_previsto` por cálculo do saldo em aberto quando `valor_pago_acumulado > 0` ou `status === 'parcial'`. Adicionar linha "Já pago" abaixo quando houver pagamentos anteriores.

### Correção 2 — Botão "Joias adicionais" (linhas 1397-1406)
Adicionar condições `valor_pago_acumulado === 0` e `status !== 'parcial'` para que o botão só apareça em notas ainda não apuradas.

### Arquivo afetado
- `src/pages/CobrancaDiaria.tsx` — apenas 2 blocos substituídos, nenhuma outra alteração

