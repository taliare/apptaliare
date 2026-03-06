

# TALIARE 2.0 - Apurações e Pagamentos

## Resumo

Criar duas novas tabelas (`t2_apuracoes`, `t2_pagamentos`) e expandir a tela de Ciclos com fluxo de prestação de contas e registro de pagamentos. A comissão é calculada automaticamente por faixa de valor vendido. Quando o saldo zera, o ciclo encerra automaticamente.

## 1. Migração SQL

### Tabela `t2_apuracoes`
- `id`, `ciclo_id` (FK t2_ciclos), `valor_kit`, `valor_devolvido`, `valor_vendido`, `comissao_percentual`, `valor_comissao`, `valor_empresa`, `saldo_a_receber`, `data_apuracao` (default now()), `apurado_por`, `status` (default 'apurado')
- RLS: Admin full access (RESTRICTIVE), representante acessa onde `apurado_por = auth.uid()`
- Constraint: `valor_devolvido <= valor_kit` via validation trigger

### Tabela `t2_pagamentos`
- `id`, `apuracao_id` (FK t2_apuracoes), `valor_pago`, `forma_pagamento`, `observacao`, `data_pagamento` (default now()), `registrado_por`
- RLS: Admin full access, representante acessa onde `registrado_por = auth.uid()`
- Trigger: após INSERT, reduz `saldo_a_receber` na apuração e, se zero, encerra o ciclo associado

### Trigger de auto-quitação
- Função `t2_processar_pagamento()` (SECURITY DEFINER):
  1. Atualiza `t2_apuracoes.saldo_a_receber -= NEW.valor_pago`
  2. Se `saldo_a_receber <= 0`, atualiza `t2_ciclos.status = 'encerrado'`

## 2. Código Frontend

### Expandir `T2Ciclos.tsx`
- Adicionar botão "Registrar Prestação de Contas" nos cards de ciclos ativos
- Dialog de apuração:
  - Mostra `valor_kit` do ciclo
  - Input: `valor_devolvido` (validado: não pode ser > valor_kit)
  - Cálculos automáticos em tempo real:
    - `valor_vendido = valor_kit - valor_devolvido`
    - Categoria/comissão por faixa (0-299→20%, 300-999→30%, 1000-1999→40%, 2000+→50%)
    - `valor_comissao`, `valor_empresa`
  - Botão confirmar → insere em `t2_apuracoes`

- Seção de apurações no card do ciclo (ou expansível):
  - Lista apurações existentes com saldo
  - Botão "Registrar Pagamento" por apuração
  - Dialog pagamento: `valor_pago` (validado: <= saldo_a_receber), `forma_pagamento`, `observacao`
  - Histórico de pagamentos da apuração

### Atualizar types.ts
- Será atualizado automaticamente após migração

## 3. Menu
- Não precisa de novas rotas/menus - tudo fica dentro de Ciclos T2

## Validações client-side
- `valor_devolvido > valor_kit` → bloqueia
- `valor_pago > saldo_a_receber` → bloqueia
- Ambos com mensagens de erro claras

