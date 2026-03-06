

# TALIARE 2.0 - Performance e Ranking de Representantes

## 1. Migração SQL

### View `t2_vw_performance_representantes`
Agrega dados por `representante_id` a partir de `t2_revendedoras`, `t2_ciclos`, `t2_apuracoes`, e `t2_vw_radar_revendedoras`:
- `representante_id`, `total_revendedoras`, `revendedoras_ativas` (ciclo ativo), `revendedoras_em_risco` (radar RISCO), `revendedoras_atencao` (radar ATENCAO), `total_ciclos`, `total_vendido` (sum apurações), `ticket_medio`, `total_recebido_empresa` (sum valor_pago dos ciclos), `inadimplencia_total` (sum saldo_a_receber onde status=inadimplente)
- `security_invoker = on`

### View `t2_vw_ranking_representantes`
Subconjunto da view de performance ordenado por `total_vendido DESC`:
- `representante_id`, `total_vendido`, `total_ciclos`, `ticket_medio`, `revendedoras_ativas`, `inadimplencia_total`

## 2. Frontend

### Nova página `src/pages/T2RepresentantesPerformance.tsx` (rota existente `/t2-revendedoras` não — precisa nova rota)
- Verificando: já existe menu "Revendedoras T2" em `/t2-revendedoras`. A nova tela de representantes precisa de rota separada.
- Rota: reutilizar a existente... Na verdade, o plano pede um novo menu "Representantes" em TALIARE 2.0. Criarei uma nova rota.

### Rota: `/t2-representantes-performance`
- **Dashboard cards**: total vendido por representante, ranking de vendas, ranking de crescimento da rede, ranking de menor inadimplência
- **Tabela**: nome, total_revendedoras, revendedoras_ativas, revendedoras_atencao, revendedoras_em_risco, total_vendido, ticket_medio, inadimplencia_total
- **Indicador visual de inadimplência**: VERDE (<5%), AMARELO (5-10%), VERMELHO (>10%) — calculado como inadimplencia_total / total_recebido_empresa
- **Filtros**: por período (não aplicável diretamente na view — filtraremos client-side ou faremos query separada), por cidade, por categoria de revendedoras

### Navegação
- Novo menu "Performance Reps" na categoria TALIARE 2.0 em `AppSidebar.tsx` e `MobileDrawer.tsx`
- Nova rota em `AnimatedRoutes.tsx` com `PermissionRoute`
- Nova chave `t2_representantes` em `menuPermissions.ts`

## 3. Resumo de Arquivos

| Ação | Arquivo |
|------|---------|
| SQL | Views `t2_vw_performance_representantes` + `t2_vw_ranking_representantes` |
| Criar | `src/pages/T2RepresentantesPerformance.tsx` |
| Editar | `src/components/AnimatedRoutes.tsx` (nova rota) |
| Editar | `src/components/AppSidebar.tsx` (menu) |
| Editar | `src/components/MobileDrawer.tsx` (menu) |
| Editar | `src/lib/menuPermissions.ts` (nova chave) |

