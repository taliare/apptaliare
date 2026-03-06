

# TALIARE 2.0 - Histórico, Classificação, Ranking e Dashboard

## Decisão Técnica

Continuando com tabelas `t2_` no schema `public` (mesmo padrão já estabelecido). Views não são diretamente queryáveis pelo Supabase JS client da mesma forma — usaremos queries agregadas no frontend ou criaremos database views acessíveis via Supabase.

## 1. Migração SQL

### Database Views
- **`t2_vw_historico_revendedoras`**: View agregando dados de `t2_ciclos` + `t2_apuracoes` por revendedora (total_ciclos, total_vendido, ticket_medio, total_pago_empresa, data_primeiro_ciclo, data_ultimo_ciclo). Join com `t2_revendedoras` para nome e cidade.
- **`t2_vw_ranking_revendedoras`**: View ordenada por total_vendido DESC com categoria_atual.

### Trigger para classificação automática
- Função `t2_atualizar_categoria_revendedora()` executada AFTER INSERT em `t2_apuracoes`
- Atualiza `t2_revendedoras.categoria_atual` baseado no `valor_vendido` da apuração: INICIAL (0-299), ATIVA (300-999), DESTAQUE (1000-1999), ELITE (2000+)

### Trigger para score
- Função `t2_atualizar_score()` executada em UPDATE de `t2_ciclos` quando status muda
- `encerrado` → +10 pontos no score da revendedora
- `inadimplente` → -20 pontos

### RLS nas views
- Views com `SECURITY DEFINER` para acesso controlado, ou RLS policies adequadas

## 2. Frontend

### Atualizar `constants.ts`
- Adicionar categorias INICIAL, ATIVA, DESTAQUE, ELITE com cores

### Expandir `T2Revendedoras.tsx` - Perfil da Revendedora
- Ao clicar na revendedora, abrir Sheet/Dialog com:
  - Dados cadastrais, categoria, score
  - Histórico agregado (total vendido, ticket médio, ciclos)
  - Lista de ciclos com status
  - Histórico de pagamentos

### Nova página `T2Ranking.tsx` (rota `/t2-ranking`)
- Tabela ordenada por total_vendido
- Filtros: representante, cidade, período
- Badges de categoria

### Expandir `T2Revendedoras.tsx` ou criar seção Dashboard
- Cards: total revendedoras ativas, por categoria (INICIAL/ATIVA/DESTAQUE/ELITE), ticket médio, volume vendido

## 3. Navegação
- Adicionar rota `/t2-ranking` em `AnimatedRoutes.tsx`
- Menu "Ranking" na categoria TALIARE 2.0 em `AppSidebar.tsx` e `MobileDrawer.tsx`
- Nova chave `t2_ranking` em `menuPermissions.ts`

## 4. Resumo de Arquivos

| Ação | Arquivo |
|------|---------|
| SQL | Migração: views + triggers classificação/score |
| Editar | `src/components/t2/constants.ts` (categorias) |
| Editar | `src/pages/T2Revendedoras.tsx` (perfil + dashboard) |
| Criar | `src/pages/T2Ranking.tsx` |  
| Editar | `src/components/AnimatedRoutes.tsx` (rota) |
| Editar | `src/components/AppSidebar.tsx` (menu) |
| Editar | `src/components/MobileDrawer.tsx` (menu) |
| Editar | `src/lib/menuPermissions.ts` (chave) |

