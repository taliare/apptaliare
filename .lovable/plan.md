

# Controle de Kits do Representante - "Meus Kits" T2

## Visão Geral

Criar uma nova tela "Meus Kits" no TALIARE 2.0 para representantes, que mostra os pedidos recebidos da produção agrupados como kits e permite entregá-los diretamente a uma revendedora, criando automaticamente um ciclo.

## Abordagem

Em vez de criar uma nova tabela, vamos usar a tabela `t2_pedidos` existente como base. Os pedidos com `status = 'disponivel'` e `representante_id` do usuário logado são os "kits disponíveis". Pedidos com `status = 'em_ciclo'` são "kits entregues". A tela "Meus Kits" é essencialmente uma visão centrada no representante dos seus pedidos.

A ação "Entregar para revendedora" reproduz a mesma lógica de criação de ciclo já existente em T2Ciclos (criar ciclo, vincular pedidos via `t2_ciclo_pedidos`, atualizar status dos pedidos para `em_ciclo`).

## Banco de Dados

Nenhuma alteração de schema necessária. A estrutura de `t2_pedidos` já suporta o fluxo:
- `status = 'disponivel'` → kit disponível
- `status = 'em_ciclo'` → kit entregue
- `representante_id` → dono do kit

## Alterações no Frontend

### 1. Nova página: `src/pages/T2MeusKits.tsx`

- Lista pedidos do representante logado (`t2_pedidos` where `representante_id = user.id`)
- Duas seções ou filtro: "Disponíveis" / "Entregues"
- Para cada pedido disponível: código, valor, data, botão "Entregar para Revendedora"
- Modal de entrega com:
  - Select de revendedora (`t2_revendedoras`)
  - Seleção de pedidos disponíveis (checkbox, pré-selecionado o kit clicado)
  - Campo comissão (%) — padrão 10%
  - Data de vencimento — padrão 45 dias
- Ao confirmar: cria ciclo + vincula pedidos + atualiza status (mesma lógica de `T2Ciclos.createMutation`)

### 2. Rota: `src/components/AnimatedRoutes.tsx`

- Adicionar rota `/t2-meus-kits` apontando para `T2MeusKits`

### 3. Menu lateral: `src/components/AppSidebar.tsx`

- Adicionar "Meus Kits" na categoria "TALIARE 2.0" do representante (entre Revendedoras T2 e Ciclos T2)

### 4. Menu mobile: `src/components/MobileDrawer.tsx`

- Adicionar "Meus Kits" na seção T2

### 5. Permissões: `src/lib/menuPermissions.ts`

- Adicionar `t2_meus_kits` ao `ASSIGNABLE_MENUS` e `MENU_EXTRA_CONFIG`

