

# Corrigir Menus de Permissao que Nao Aparecem para Representantes

## Problema

O sistema de permissoes funciona assim:
1. Admin atribui permissoes (ex: `garantias`) a um representante na tabela `user_menu_permissions`
2. O sidebar filtra os menus baseado nas permissoes

Porem, o `representanteCategories` e uma lista fixa com apenas os menus basicos (Dashboard, Agenda, Kits, Gestao). Menus como "Garantias", "CRM", "Fechamento Diario", etc. so existem no `adminCategories`. Quando o filtro de permissoes roda, ele filtra itens que JA ESTAO na lista -- nunca adiciona novos.

Resultado: mesmo com a permissao `garantias` atribuida no banco, o menu nao aparece porque nao esta no `representanteCategories`.

**Usuarios afetados no banco:**
- BLYNDSON SANTOS: permissoes `crm` e `garantias` -- nenhuma aparece
- CELIA ARAGAO: permissao `garantias` -- nao aparece
- JOSINALDO OLIVEIRA: permissao `garantias` -- nao aparece

## Solucao

Modificar o `AppSidebar.tsx` e o `MobileDrawer.tsx` para que, apos montar as categorias base do representante, injete dinamicamente os menus atribuidos via permissao que nao estejam ja na lista.

### Logica

1. Manter o `representanteCategories` como esta (menus basicos)
2. Apos o filtro de permissoes, verificar quais menus o representante tem permissao que NAO estao em nenhuma categoria base
3. Para cada menu com permissao que esta faltando, buscar a definicao no `adminCategories` (titulo, icone, url) e adicionar numa nova categoria "EXTRAS" ou na categoria mais adequada

### Implementacao tecnica

Criar um mapa de definicoes de menus (icone, titulo, categoria sugerida) em `menuPermissions.ts`, e usar isso para injetar menus extras:

```text
// Em menuPermissions.ts - adicionar metadata dos menus
export const MENU_DEFINITIONS: Record<MenuKey, { label: string; icon: string; category: string }> = {
  garantias: { label: 'Garantias', icon: 'Shield', category: 'OPERACIONAL' },
  crm: { label: 'CRM', icon: 'UserPlus', category: 'OPERACIONAL' },
  fechamento_diario: { label: 'Fechamento Diário', icon: 'CalendarCheck', category: 'FINANCEIRO' },
  // ... todos os menus atribuiveis
};
```

```text
// Em AppSidebar.tsx e MobileDrawer.tsx - apos montar categorias base:

// 1. Coletar todas as URLs ja presentes nas categorias base
const existingUrls = new Set(baseCategories.flatMap(c => c.items.map(i => i.url)));

// 2. Para cada permissao do representante, se a rota nao esta nas categorias base, adicionar
const extraItems = permissions
  .map(key => ASSIGNABLE_MENUS.find(m => m.key === key))
  .filter(m => m && !existingUrls.has(m.route))
  .map(m => ({ title: MENU_DEFINITIONS[m.key].label, url: m.route, icon: iconMap[m.key] }));

// 3. Se ha extras, adicionar como nova categoria
if (extraItems.length > 0) {
  baseCategories.push({ label: 'EXTRAS', items: extraItems });
}
```

### Arquivos a modificar

1. **`src/lib/menuPermissions.ts`** -- Adicionar mapa de icones/labels para cada menu atribuivel
2. **`src/components/AppSidebar.tsx`** -- Injetar menus extras baseado em permissoes do representante
3. **`src/components/MobileDrawer.tsx`** -- Mesma logica do sidebar para o drawer mobile

### O que NAO muda

- Rotas no `AnimatedRoutes.tsx` ja estao corretas (todas usam `PermissionRoute`)
- Tabela `user_menu_permissions` e dados existentes estao corretos
- Hook `useMenuPermissions` funciona corretamente
- Admin continua vendo tudo normalmente

