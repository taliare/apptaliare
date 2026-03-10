

# Fluxo de Status: ativo → apurado → encerrado

## Situação Atual

- Status possíveis: `ativo`, `encerrado`, `inadimplente`
- Trigger `t2_validar_status_ciclo` permite: `ativo → encerrado` ou `ativo → inadimplente`
- Apuração não altera o status do ciclo (permanece `ativo`)
- Encerramento automático ocorre quando saldo zera (trigger `t2_processar_pagamento`)
- Frontend filtra ciclos por `status = 'ativo'`

## Alterações Necessárias

### 1. Database Migration

**Atualizar trigger `t2_validar_status_ciclo`** para novo fluxo:
- `ativo → apurado` (quando apuração é registrada)
- `apurado → encerrado` (quando saldo zera)
- Bloquear qualquer outra transição

**Criar trigger `t2_apuracao_set_status`** (AFTER INSERT on `t2_apuracoes`):
- Ao criar apuração, atualizar `t2_ciclos.status = 'apurado'`

**Atualizar trigger `t2_processar_pagamento`**:
- Mudar encerramento: verificar que ciclo está `apurado` antes de encerrar

**Atualizar trigger `t2_validar_pagamento_ciclo`**:
- Permitir pagamentos em ciclos com status `apurado` (não mais `ativo`)

**Atualizar `STATUS_LABELS` e `STATUS_COLORS`** no frontend para incluir `apurado`

### 2. Frontend — constants.ts

Adicionar `apurado` em `STATUS_LABELS` e `STATUS_COLORS`

### 3. Frontend — T2Ciclos.tsx

- Alterar query para buscar ciclos com status `ativo` **ou** `apurado`
- O botão "Prestação" já está correto (desabilita se `hasApuracao`)
- O botão "Adiantamento" deve ser desabilitado se ciclo está `encerrado`

### 4. Frontend — PagamentoDialog.tsx

- Atualizar `data_cobranca` apenas se ciclo está `apurado` (não `encerrado`)
- Já funciona corretamente pois o trigger bloqueia pagamentos em ciclos encerrados

### Resumo

| Alteração | Onde |
|-----------|------|
| Novo fluxo de status: ativo → apurado → encerrado | Trigger `t2_validar_status_ciclo` |
| Apuração muda status para `apurado` | Novo trigger AFTER INSERT on `t2_apuracoes` |
| Pagamentos permitidos em status `apurado` | Trigger `t2_validar_pagamento_ciclo` |
| Encerramento automático verifica status `apurado` | Trigger `t2_processar_pagamento` |
| Adicionar label/cor para `apurado` | `constants.ts` |
| Listar ciclos `ativo` e `apurado` na agenda | `T2Ciclos.tsx` |

