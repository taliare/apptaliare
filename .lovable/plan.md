## Plano: Sidebar Hover-to-Expand

### Objetivo
Tornar o sidebar desktop colapsado por padrão e expandi-lo automaticamente ao passar o mouse, com layout ajustado para não empurrar o conteúdo.

### Alterações

**1. src/App.tsx**
- `<SidebarProvider>` → `<SidebarProvider defaultOpen={false}>`
- Wrapper do sidebar: adicionar `w-16 relative` para reservar espaço fixo de 64px quando colapsado.

**2. src/components/AppSidebar.tsx**
- Importar `useRef` do React.
- Extrair `setOpen` de `useSidebar()`.
- Adicionar refs e handlers `onMouseEnter` / `onMouseLeave` com debounce de 120ms para expandir/retrair.
- Atualizar `<Sidebar>`: aplicar `onMouseEnter`/`onMouseLeave` e classes condicionais — quando expandido, usar `absolute top-0 left-0 h-full z-50 shadow-2xl` para sobrepor o conteúdo em vez de empurrá-lo.

### Resultado esperado
Sidebar desktop inicia fechado (apenas ícones). Ao passar o mouse, expande suavemente sobre o conteúdo principal; ao retirar o mouse, recolhe após 120ms.