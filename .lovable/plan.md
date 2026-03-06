

# TALIARE 2.0 - Radar da Rede

## 1. Migração SQL

### View `t2_vw_radar_revendedoras`
View calculada a partir de `t2_revendedoras` + `t2_ciclos`, com campos:
- `revendedora_id`, `nome_revendedora`, `representante_id`, `cidade`, `categoria_atual`, `score`, `total_vendido` (sum de apurações), `total_ciclos`, `ultimo_ciclo_data` (max data_inicio), `dias_sem_vender` (current_date - ultimo_ciclo_data), `status_radar` (CASE: <=45 → 'ATIVA', 46-90 → 'ATENCAO', >90 → 'RISCO', NULL → 'RISCO')

Nenhuma tabela nova — apenas uma view.

## 2. Frontend

### Nova página `T2RadarRede.tsx` (rota `/t2-radar`)
- Dashboard de saúde com 4 cards: Ativas (verde), Atenção (amarelo), Risco (vermelho), % Rede Ativa
- Tabela com: revendedora, representante, cidade, categoria, dias sem vender, status radar (badges coloridos)
- Filtros: representante (Select), cidade (Input), categoria (Select), status radar (Select)
- Consulta da view `t2_vw_radar_revendedoras`

### Atualizar `constants.ts`
- Adicionar `RADAR_LABELS` e `RADAR_COLORS` (ATIVA→verde, ATENCAO→amarelo, RISCO→vermelho)

### Navegação
- Rota `/t2-radar` em `AnimatedRoutes.tsx` com `PermissionRoute menuKey="t2_radar"`
- Menu "Radar da Rede" na categoria TALIARE 2.0 em `AppSidebar.tsx` e `MobileDrawer.tsx`
- Nova chave `t2_radar` + route `/t2-radar` em `menuPermissions.ts`

## 3. Resumo de Arquivos

| Ação | Arquivo |
|------|---------|
| SQL | View `t2_vw_radar_revendedoras` |
| Criar | `src/pages/T2RadarRede.tsx` |
| Editar | `src/components/t2/constants.ts` |
| Editar | `src/components/AnimatedRoutes.tsx` |
| Editar | `src/components/AppSidebar.tsx` |
| Editar | `src/components/MobileDrawer.tsx` |
| Editar | `src/lib/menuPermissions.ts` |

