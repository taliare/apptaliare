

# Painel de Performance da Rede — T2

## Análise

O sistema já possui páginas T2 para ranking, radar, financeiro, inadimplência, etc. O pedido é criar um **painel simples de métricas gerais** da operação. Não existe uma página dedicada a isso atualmente.

## Plano

### 1. Criar página `src/pages/T2PainelRede.tsx`

Página com 4 cards de métricas:

| Métrica | Cálculo |
|---|---|
| Revendedoras Ativas | Distinct `revendedora_id` de `t2_ciclos` onde `status` in ('ativo', 'apurado') |
| Ciclos Ativos | Count de `t2_ciclos` onde `status` in ('ativo', 'apurado') |
| Total Vendido | Sum de `t2_apuracoes.valor_vendido` |
| Total a Receber | Para ciclos não encerrados: `valor_empresa` (da apuração) - sum(pagamentos) - sum(adiantamentos) |

Queries usando `supabase` client diretamente nas tabelas `t2_ciclos`, `t2_apuracoes`, `t2_pagamentos`, `t2_adiantamentos`.

Layout: 4 cards em grid responsivo (2 cols mobile, 4 cols desktop), seguindo o padrão visual das outras páginas T2.

### 2. Registrar rota em `AnimatedRoutes.tsx`

Adicionar rota `/t2-painel-rede` com `PermissionRoute` usando menuKey `t2_painel_rede`.

### 3. Adicionar ao menu em `AppSidebar.tsx` e `MobileDrawer.tsx`

Adicionar item "Painel da Rede" no grupo TALIARE 2.0 dos dois menus.

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/pages/T2PainelRede.tsx` | **Novo** — página com 4 cards de métricas |
| `src/components/AnimatedRoutes.tsx` | Adicionar rota `/t2-painel-rede` |
| `src/components/AppSidebar.tsx` | Adicionar item no menu T2 |
| `src/components/MobileDrawer.tsx` | Adicionar item no menu T2 mobile |

Nenhuma alteração de banco de dados ou lógica financeira.

