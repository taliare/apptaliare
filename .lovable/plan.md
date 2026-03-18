

# Cancelar Apuração — Botão Admin no Menu Ciclos

## O que será feito

Adicionar um botão "Cancelar Apuração" nos cards de ciclos apurados, visível apenas para admins. Ao confirmar, o sistema reverte toda a apuração: remove pagamentos, remove a apuração e retorna o ciclo ao status "ativo".

## Alterações

### 1. Migração SQL — Função `t2_cancelar_apuracao`

Criar uma função SECURITY DEFINER que executa atomicamente:
1. Deleta todos os `t2_pagamentos` vinculados à apuração do ciclo
2. Deleta o registro em `t2_apuracoes`
3. Atualiza `t2_ciclos` → `status = 'ativo'`, `valor_pago = 0`

Precisa ser SECURITY DEFINER para contornar o trigger `t2_validar_status_ciclo` que bloqueia transição `apurado → ativo`.

### 2. `src/pages/T2Ciclos.tsx` — Botão no card

- Adicionar botão "Cancelar Apuração" (ícone `Undo2`) nos cards com status `apurado`
- Visível apenas quando `profile?.role === 'admin'`
- Ao clicar, exibir `AlertDialog` de confirmação
- Chamar `supabase.rpc('t2_cancelar_apuracao', { p_ciclo_id })` 
- Invalidar queries relevantes após sucesso

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| Migração SQL | Função `t2_cancelar_apuracao` |
| `src/pages/T2Ciclos.tsx` | Botão admin + dialog de confirmação |

