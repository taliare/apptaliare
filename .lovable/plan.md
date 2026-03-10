

# Saldo Atual Calculado na Lista de Ciclos

## O que será feito

Substituir o campo `valor_restante` (armazenado no banco) por um saldo calculado dinamicamente a partir dos dados reais: `valor_empresa - pagamentos - adiantamentos`.

## Alterações

### T2Ciclos.tsx

1. **Adicionar query para buscar pagamentos por ciclo**: Buscar `t2_pagamentos` (via `t2_apuracoes`) e `t2_adiantamentos` para todos os ciclos ativos/apurados.

2. **Calcular saldo dinamicamente**: Para cada ciclo:
   - Se não tem apuração (`hasApuracao = false`), exibir "Aguardando apuração"
   - Se tem apuração, calcular: `valor_empresa - SUM(pagamentos) - SUM(adiantamentos)`

3. **Substituir a linha de Saldo no card**: Trocar `valor_restante` pelo valor calculado, com formatação condicional (verde se zero, laranja se pendente).

### Dados necessários (novas queries)

- `t2_pagamentos` com `apuracao_id` vinculado aos ciclos exibidos (já existe query em `ApuracoesSection`, mas precisamos no nível do componente pai)
- `t2_adiantamentos` filtrado por `ciclo_id` dos ciclos exibidos

### Resumo

| Alteração | Arquivo |
|-----------|---------|
| Queries para pagamentos e adiantamentos por ciclo | `T2Ciclos.tsx` |
| Cálculo dinâmico do saldo e exibição condicional | `T2Ciclos.tsx` |

Nenhuma alteração de banco de dados ou lógica financeira.

