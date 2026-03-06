

# TALIARE 2.0 - Novo Módulo Paralelo

## Decisão Técnica Importante: Schema

O Supabase JS client por padrão só acessa o schema `public`. Criar um schema `taliare2` exigiria configuração especial no `config.toml` (arquivo auto-gerenciado que não pode ser editado manualmente) e uso de `.schema('taliare2')` em todas as queries.

**Alternativa recomendada**: Criar tabelas com prefixo `t2_` no schema `public` (ex: `t2_revendedoras`, `t2_pedidos`, `t2_ciclos`). Isso mantém total separação do sistema atual sem complicações técnicas. Nenhuma tabela existente será alterada.

## Implementação

### 1. Migração SQL - 3 tabelas novas

**`t2_revendedoras`**: nome_completo, nome_exibicao, cpf (unique), telefone, instagram, cidade, representante_id, status, score, categoria_atual, data_cadastro. RLS: admin full, representante vê/cria as suas.

**`t2_pedidos`**: codigo_pedido (unique), valor_total, representante_id, status, data_criacao, observacao. RLS: admin full, representante vê os seus com status `disponivel`.

**`t2_ciclos`**: pedido_id, revendedora_id, representante_id, valor_kit, valor_vendido, comissao_percentual, valor_empresa, valor_pago, valor_restante, data_inicio, data_vencimento, status. RLS: admin full, representante vê/cria os seus. Constraint: unique(revendedora_id) WHERE status = 'ativo' (partial unique index para impedir ciclo duplicado ativo).

### 2. Código - 3 páginas + rotas + menu

**Páginas novas**:
- `src/pages/T2Producao.tsx` - CRUD de pedidos, distribuição para representante
- `src/pages/T2Revendedoras.tsx` - cadastro de revendedoras com CPF único
- `src/pages/T2Ciclos.tsx` - fluxo: selecionar revendedora → pedido disponível → criar ciclo (data_vencimento = hoje + 45 dias, editável)

**Integração no sistema**:
- `AnimatedRoutes.tsx`: adicionar 3 rotas (`/t2-producao`, `/t2-revendedoras`, `/t2-ciclos`) com PermissionRoute
- `AppSidebar.tsx` + `MobileDrawer.tsx`: nova categoria "TALIARE 2.0" com 3 itens (Produção, Revendedoras, Ciclos) - visível para admin
- `menuPermissions.ts`: adicionar 3 novas chaves (`t2_producao`, `t2_revendedoras`, `t2_ciclos`)

### 3. Escopo por etapa

Dado o tamanho, sugiro implementar em 2 etapas:
1. **Etapa 1**: Migração SQL (3 tabelas + RLS) + páginas Produção e Revendedoras + menu
2. **Etapa 2**: Página Ciclos com fluxo completo + logs de alteração de prazo

