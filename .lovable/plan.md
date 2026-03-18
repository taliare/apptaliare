

# Corrigir Erro "permission denied: system trigger"

## Problema

A função `t2_cancelar_apuracao` usa `ALTER TABLE t2_ciclos DISABLE TRIGGER ALL`, que requer privilégios de superusuário — não disponível em Cloud.

## Solução

Em vez de desabilitar triggers, atualizar o trigger `t2_validar_status_ciclo` para permitir a transição `apurado → ativo` (reversão). Depois, remover os comandos `DISABLE/ENABLE TRIGGER` da função.

## Alterações

### Migração SQL

1. **Atualizar `t2_validar_status_ciclo`** — adicionar a transição `apurado → ativo` como permitida
2. **Atualizar `t2_cancelar_apuracao`** — remover `ALTER TABLE ... DISABLE/ENABLE TRIGGER ALL`

| Arquivo | Mudança |
|---|---|
| Migração SQL | Corrigir ambas as funções |

