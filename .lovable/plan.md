

# Controle de Acesso T2 por Tipo de Usuário

## Situação Atual

A maior parte da infraestrutura já está implementada:
- **RLS** no banco já filtra todas as tabelas T2 por `representante_id` (admin vê tudo, representante vê só o seu)
- **Rotas** já usam `PermissionRoute` com menu keys
- **Botões admin-only** (ex: Cancelar Apuração) já verificam `profile?.role === 'admin'`

## O que falta

### 1. Sidebar — Adicionar menus T2 para representantes

Atualmente os menus T2 só aparecem em `adminCategories`. Representantes não conseguem navegar para nenhuma página T2.

**Ação:** Adicionar categoria "TALIARE 2.0" no `representanteCategories` do `AppSidebar.tsx` com os menus relevantes:
- Revendedoras T2
- Ciclos T2
- Produção T2 (para criar pedidos)

### 2. `T2Revendedoras.tsx` — Corrigir insert com `representante_id: null`

Quando admin cadastra revendedora, o código faz `representante_id: isAdmin ? null : user?.id`. Isso cria registros sem dono. Admin deveria poder selecionar o representante responsável ou, no mínimo, atribuir a si mesmo.

**Ação:** Para admin, adicionar um seletor de representante no formulário. Para representante, manter o `user?.id` automático.

### 3. `T2Ciclos.tsx` — Esconder "Novo Ciclo" condicionalmente

O botão "Novo Ciclo" deve permanecer visível para representantes (eles já definem `representante_id: user?.id`). Verificar que não há bloqueio.

### 4. Esconder funcionalidades admin-only na interface

Nas páginas T2 visíveis para representantes, garantir que elementos admin-only estejam condicionados:
- Botão "Cancelar Apuração" → já feito ✅
- Qualquer filtro por representante (como no `T2Inadimplencia`) → esconder para representantes

## Alterações por arquivo

| Arquivo | Mudança |
|---|---|
| `src/components/AppSidebar.tsx` | Adicionar categoria T2 ao `representanteCategories` |
| `src/components/MobileDrawer.tsx` | Adicionar menus T2 para representante (se necessário) |
| `src/pages/T2Revendedoras.tsx` | Admin: seletor de representante no cadastro; Rep: `user?.id` automático |
| `src/pages/T2Ciclos.tsx` | Esconder seletor de representante (se existir) para não-admins |
| `src/pages/T2Inadimplencia.tsx` | Esconder filtro de representante para não-admins |

Nenhuma alteração de banco de dados necessária — as RLS policies já estão corretas.

