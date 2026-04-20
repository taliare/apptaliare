---
name: smart-status
description: Dynamic badge colors and labels for cobranca status — only 5 states allowed
type: business-rule
---

Status válidos no sistema: **pendente → parcial → pago → juridico → cancelado**.

O status `reagendado` foi REMOVIDO do sistema. Reagendamento apenas atualiza `data_agendada` (e incrementa `contagem_reagendamentos`), sem alterar o status.

`getSmartStatus()` em Cobranca.tsx e GerenciarAgenda.tsx retorna labels dinâmicos:
- pago → "Pago" (verde)
- parcial → "Parcial" (âmbar)
- juridico → "Jurídico" (roxo)
- cancelado → "Cancelado" (cinza)
- pendente + data passada → "Vencida" (vermelho)
- pendente + data futura/hoje → "A vencer" (azul)
