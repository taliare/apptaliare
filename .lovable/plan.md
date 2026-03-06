

# TALIARE 2.0 - Financeiro (Previsão de Recebimentos)

## 1. Migração SQL

### View `t2_vw_previsao_recebimentos`
Calculada a partir de `t2_ciclos` + `t2_apuracoes` + `t2_revendedoras`:
- `ciclo_id`, `revendedora_id`, `nome_revendedora`, `representante_id`, `cidade`, `valor_empresa`, `valor_pago`, `saldo_restante` (valor_empresa - valor_pago), `data_vencimento`, `status_ciclo`
- `status_financeiro` (CASE):
  - `RECEBIDO` → saldo_restante <= 0
  - `INADIMPLENTE` → data_vencimento < now() AND saldo_restante > 0
  - `EM_RISCO` → saldo_restante > 0 AND data_vencimento entre now() e now()+5 dias
  - `A_RECEBER` → saldo_restante > 0 AND data_vencimento >= now()+5 dias
- `security_invoker = on`

## 2. Frontend

### Nova página `src/pages/T2Financeiro.tsx` (rota `/t2-financeiro`)
- **Dashboard cards**: Total Recebido (verde), Total A Receber (azul), Total Em Risco (amarelo), Total Inadimplente (vermelho)
- **Card Previsão 30 dias**: soma de saldo_restante onde data_vencimento nos próximos 30 dias
- **Tabela por representante**: nome, valor recebido, valor a receber, valor em risco, inadimplência
- **Gráfico de caixa** (Recharts BarChart): eixo X = datas de vencimento (agrupadas por semana/mês), eixo Y = valor previsto
- **Tabela detalhada** com todos os ciclos e seus status financeiros
- **Filtros**: representante (Select), cidade (Input), período (DateRange), status financeiro (Select)

### Atualizar `constants.ts`
- Adicionar `FINANCEIRO_LABELS` e `FINANCEIRO_COLORS` (RECEBIDO→verde, A_RECEBER→azul, EM_RISCO→amarelo, INADIMPLENTE→vermelho)

### Navegação
- Rota `/t2-financeiro` em `AnimatedRoutes.tsx` com `PermissionRoute menuKey="t2_financeiro"`
- Menu "Financeiro T2" na categoria TALIARE 2.0 em `AppSidebar.tsx` e `MobileDrawer.tsx`
- Nova chave `t2_financeiro` em `menuPermissions.ts`

## 3. Resumo de Arquivos

| Ação | Arquivo |
|------|---------|
| SQL | View `t2_vw_previsao_recebimentos` |
| Criar | `src/pages/T2Financeiro.tsx` |
| Editar | `src/components/t2/constants.ts` |
| Editar | `src/components/AnimatedRoutes.tsx` |
| Editar | `src/components/AppSidebar.tsx` |
| Editar | `src/components/MobileDrawer.tsx` |
| Editar | `src/lib/menuPermissions.ts` |

