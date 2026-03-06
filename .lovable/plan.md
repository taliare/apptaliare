

# TALIARE 2.0 - Adiantamentos, Inadimplência e Indicadores Visuais

## 1. Migração SQL

### Tabela `t2_adiantamentos`
- `id`, `ciclo_id` (FK t2_ciclos), `revendedora_id`, `representante_id`, `valor`, `forma_pagamento`, `observacao`, `data_pagamento` (default now()), `registrado_por`
- RLS: Admin full access (RESTRICTIVE), representante acessa onde `registrado_por = auth.uid()`
- Validation trigger: não permitir `valor > valor_kit` do ciclo associado, e só permitir INSERT se ciclo estiver com status `ativo`

### Atualizar `ApuracaoDialog` para deduzir adiantamentos
- Na apuração, consultar soma de adiantamentos do ciclo
- `saldo_a_receber = MAX(0, valor_empresa - soma_adiantamentos)`
- Salvar no registro de apuração já com saldo ajustado

## 2. Edge Function: auto-close-t2-inadimplencia
- Cron diário que verifica ciclos onde `data_vencimento < now()` AND `status = 'ativo'`
- Atualiza para `status = 'inadimplente'`
- Pode ser adicionado à edge function existente `auto-close-daily` ou criar nova

## 3. Frontend

### Componente `AdiantamentoDialog.tsx`
- Dialog para registrar adiantamento em ciclo ativo
- Campos: valor, forma_pagamento, observacao
- Validação: valor <= valor_kit do ciclo
- Botão "Registrar Adiantamento" no card do ciclo ativo (ao lado do botão de prestação de contas)

### Atualizar `ApuracaoDialog.tsx`
- Buscar adiantamentos do ciclo ao abrir
- Mostrar na tela: valor_kit, adiantamentos registrados, valor_devolvido, valor_vendido, comissão, valor_empresa, saldo_a_receber (já deduzido)
- Fórmula: `saldo_a_receber = max(0, valor_empresa - total_adiantamentos)`

### Atualizar `T2Ciclos.tsx`
- Indicadores visuais nos cards:
  - Verde: ciclo ativo dentro do prazo
  - Amarelo: faltam menos de 5 dias para vencer
  - Vermelho: ciclo inadimplente
- Botão "Registrar Adiantamento" nos ciclos ativos
- Mostrar seção de adiantamentos existentes no card

### Nova página `T2Inadimplencia.tsx`
- Lista ciclos com status `inadimplente`
- Mostrar: revendedora, representante, valor_devido, dias_em_atraso, data_vencimento
- Filtros: por representante, por cidade, por dias de atraso
- Join com `t2_revendedoras` para nome e cidade, `profiles_limited` para nome do representante

### Navegação
- Adicionar rota `/t2-inadimplencia` em `AnimatedRoutes.tsx`
- Adicionar menu "Inadimplência" na categoria "TALIARE 2.0" em `AppSidebar.tsx` e `MobileDrawer.tsx`
- Adicionar `t2_inadimplencia` em `menuPermissions.ts`

## 4. Resumo de Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/components/t2/AdiantamentoDialog.tsx` |
| Criar | `src/pages/T2Inadimplencia.tsx` |
| Editar | `src/components/t2/ApuracaoDialog.tsx` (deduzir adiantamentos) |
| Editar | `src/pages/T2Ciclos.tsx` (indicadores visuais + botão adiantamento) |
| Editar | `src/components/AppSidebar.tsx` (menu Inadimplência) |
| Editar | `src/components/MobileDrawer.tsx` (menu Inadimplência) |
| Editar | `src/components/AnimatedRoutes.tsx` (rota) |
| Editar | `src/lib/menuPermissions.ts` (nova chave) |
| SQL | Migração: tabela `t2_adiantamentos` + trigger validação |
| Edge fn | Cron para marcar ciclos como inadimplentes |

