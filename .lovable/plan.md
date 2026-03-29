

# Reescrever T2RepresentantesPerformance com dados V1

## Resumo
Substituir completamente o arquivo `src/pages/T2RepresentantesPerformance.tsx` (279 linhas) por uma versão que usa `prestacoes_contas` e `cobrancas_agendadas` em vez da view `t2_vw_performance_representantes`.

## O que muda

### Remove
- Interface `PerformanceRow` (campos T2)
- Query para `t2_vw_performance_representantes`
- Query para `profiles_limited` direto (troca por `profilesLimited()`)
- Função `getInadimplenciaLevel`
- Colunas T2 na tabela: Ativas, Atenção, Risco
- Import de `useAuth`, `Select`, `Trophy`

### Adiciona
- Query `representantes`: `profilesLimited()` + `user_roles` filtrando role=representante
- Query `prestacoes_contas`: agrupa por representante (totalVendido, totalDevido, revendedoras, ciclos)
- Query `cobrancasVencidas`: cobranças vencidas para calcular inadimplência real
- Query `prestVencidas`: identifica cobranças já apuradas
- Rankings top 3: Top Vendas, Maior Rede, Menor Inadimplência
- Cards resumo: Total Vendido, Revendedoras, Inadimplência Total
- Tabela: Representante, Revendedoras, Ciclos, Total Vendido, Ticket Médio, Inadimplência, % Inad.
- Import de `formatarValor`, `profilesLimited`, `format`/`startOfDay` de date-fns

### Lógica de inadimplência
Mesma usada na página T2Inadimplencia: só conta cobranças vencidas que já foram apuradas (existem em `prestacoes_contas` ou tipo repasse/acrescimo), calcula `saldo = valor_previsto - valor_pago_acumulado - valor_adiantado`.

## Arquivo afetado
- `src/pages/T2RepresentantesPerformance.tsx` — substituição completa (1 arquivo)

