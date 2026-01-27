
## Plano: Sistema de Permissões por Menu para Usuários

### Resumo
1. Renomear "Leads Revendedoras" para "CRM" no menu
2. Criar tabela de permissões para controlar acesso a menus específicos do admin
3. Adicionar interface no cadastro de usuários para atribuir permissões de menu
4. Modificar sidebar e rotas para respeitar as permissões atribuídas

---

### Lógica de Permissões

```text
┌─────────────────────────────────────────────────────────────┐
│                    HIERARQUIA DE ACESSO                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ADMIN ──────────────> Acesso TOTAL (todos os menus)      │
│                                                             │
│   OUTROS ROLES ──────-> Acesso apenas aos menus            │
│                         atribuídos pelo admin               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Menus Atribuíveis

Os seguintes menus do admin poderão ser atribuídos a outros usuários:

| Menu | Rota | Descrição |
|------|------|-----------|
| CRM | /leads-revendedoras | Gestão de leads (antigo Leads Revendedoras) |
| Vendedoras | /vendedoras | Gestão de vendedoras |
| Venda Externa | /venda-externa | Registro de vendas externas |
| Garantias | /garantias | Gestão de garantias |
| Distribuição de Kits | /distribuicao-kits | Distribuir kits para representantes |
| Fechamento Diário | /fechamento-diario | Ver fechamentos diários |
| Metas | /metas | Definir e acompanhar metas |
| Jurídico | /juridico | Casos jurídicos |
| Resumo DRE | /dre-resumo | Demonstrativo de resultados |
| Despesas | /dre-despesas | Lançamento de despesas |
| Categorias DRE | /dre-categorias | Categorias de despesas |
| Relatório KPIs | /relatorio-kpis | Indicadores de performance |
| Análise Comercial | /analise-comercial | Análise de vendas |
| Importar Cobranças | /importar-cobrancas | Importação em massa |
| Relatórios | /relatorios | Exportação de relatórios |
| Gerenciar Agenda | /gerenciar-agenda | Gerenciar agendas |

---

### Interface de Atribuição (no Cadastro de Usuário)

```text
┌─────────────────────────────────────────────────────────────┐
│ Editar Usuário                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Nome: [João Silva              ]                            │
│ Email: [joao@email.com         ]                            │
│ Perfil: [Representante ▼]                                   │
│                                                             │
│ ────────────────────────────────────────────────            │
│                                                             │
│ 📋 Permissões de Menu (somente se NÃO for Admin)           │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ ☑ CRM                                               │    │
│ │ ☑ Vendedoras                                        │    │
│ │ ☐ Venda Externa                                     │    │
│ │ ☐ Garantias                                         │    │
│ │ ☐ Fechamento Diário                                 │    │
│ │ ☐ Metas                                             │    │
│ │ ...                                                 │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│              [Cancelar]              [Salvar]               │
└─────────────────────────────────────────────────────────────┘
```

---

### Alterações no Menu

**Antes:**
- Leads Revendedoras

**Depois:**
- CRM

---

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| **Banco de Dados** | CRIAR | Nova tabela `user_menu_permissions` |
| `src/components/AppSidebar.tsx` | EDITAR | Renomear menu e filtrar por permissões |
| `src/components/MobileDrawer.tsx` | EDITAR | Mesmas alterações do sidebar |
| `src/pages/Usuarios.tsx` | EDITAR | Adicionar checkboxes de permissões |
| `src/components/AnimatedRoutes.tsx` | EDITAR | Verificar permissões nas rotas |
| `src/contexts/AuthContext.tsx` | EDITAR | Carregar permissões do usuário |
| `src/hooks/useMenuPermissions.ts` | CRIAR | Hook para verificar permissões |

---

### Seção Técnica

#### 1. Nova Tabela: user_menu_permissions

```sql
-- Tabela para armazenar permissões de menu por usuário
CREATE TABLE public.user_menu_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  menu_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, menu_key)
);

-- Habilitar RLS
ALTER TABLE public.user_menu_permissions ENABLE ROW LEVEL SECURITY;

-- Política: Admins podem ver/editar todas as permissões
CREATE POLICY "Admins can manage all permissions"
ON public.user_menu_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Política: Usuários podem ver suas próprias permissões
CREATE POLICY "Users can view own permissions"
ON public.user_menu_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
```

#### 2. Definição de Menus Atribuíveis

```typescript
// src/lib/menuPermissions.ts
export const ASSIGNABLE_MENUS = [
  { key: 'crm', label: 'CRM', route: '/leads-revendedoras', icon: 'UserPlus' },
  { key: 'vendedoras', label: 'Vendedoras', route: '/vendedoras', icon: 'Users' },
  { key: 'venda_externa', label: 'Venda Externa', route: '/venda-externa', icon: 'Users' },
  { key: 'garantias', label: 'Garantias', route: '/garantias', icon: 'Shield' },
  { key: 'distribuicao_kits', label: 'Distribuição de Kits', route: '/distribuicao-kits', icon: 'Package' },
  { key: 'fechamento_diario', label: 'Fechamento Diário', route: '/fechamento-diario', icon: 'CalendarCheck' },
  { key: 'metas', label: 'Metas', route: '/metas', icon: 'Target' },
  { key: 'gerenciar_agenda', label: 'Gerenciar Agenda', route: '/gerenciar-agenda', icon: 'Calendar' },
  { key: 'juridico', label: 'Jurídico', route: '/juridico', icon: 'Scale' },
  { key: 'dre_resumo', label: 'Resumo DRE', route: '/dre-resumo', icon: 'TrendingUp' },
  { key: 'dre_despesas', label: 'Despesas', route: '/dre-despesas', icon: 'Receipt' },
  { key: 'dre_categorias', label: 'Categorias DRE', route: '/dre-categorias', icon: 'FolderOpen' },
  { key: 'relatorio_kpis', label: 'Relatório KPIs', route: '/relatorio-kpis', icon: 'BarChart3' },
  { key: 'analise_comercial', label: 'Análise Comercial', route: '/analise-comercial', icon: 'LineChart' },
  { key: 'importar_cobrancas', label: 'Importar Cobranças', route: '/importar-cobrancas', icon: 'Upload' },
  { key: 'relatorios', label: 'Relatórios', route: '/relatorios', icon: 'FileText' },
] as const;

export type MenuKey = typeof ASSIGNABLE_MENUS[number]['key'];
```

#### 3. Hook useMenuPermissions

```typescript
// src/hooks/useMenuPermissions.ts
export function useMenuPermissions() {
  const { profile, user } = useAuth();
  
  const { data: permissions = [] } = useQuery({
    queryKey: ['menu-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('user_menu_permissions')
        .select('menu_key')
        .eq('user_id', user.id);
      return data?.map(p => p.menu_key) || [];
    },
    enabled: !!user?.id && profile?.role !== 'admin',
  });

  const hasMenuAccess = useCallback((menuKey: string) => {
    // Admin tem acesso a tudo
    if (profile?.role === 'admin') return true;
    // Outros verificam permissões
    return permissions.includes(menuKey);
  }, [profile?.role, permissions]);

  return { permissions, hasMenuAccess };
}
```

#### 4. Atualização do AuthContext

```typescript
// Adicionar ao Profile interface
interface Profile {
  // ... campos existentes
  menuPermissions?: string[]; // Lista de menu_keys permitidos
}

// No fetchProfile, carregar permissões se não for admin
if (roleData.role !== 'admin') {
  const { data: permissionsData } = await supabase
    .from('user_menu_permissions')
    .select('menu_key')
    .eq('user_id', userId);
  
  setProfile({
    ...profileData,
    role: roleData.role,
    menuPermissions: permissionsData?.map(p => p.menu_key) || []
  });
}
```

#### 5. Atualização do AppSidebar

```typescript
// Filtrar menus baseado em permissões
const filterMenusByPermission = (items: MenuItem[]) => {
  if (profile?.role === 'admin') return items;
  
  return items.filter(item => {
    const menuDef = ASSIGNABLE_MENUS.find(m => m.route === item.url);
    if (!menuDef) return true; // Menus base sempre visíveis
    return profile?.menuPermissions?.includes(menuDef.key);
  });
};

// Aplicar filtro em cada categoria
const filteredCategories = categories.map(cat => ({
  ...cat,
  items: filterMenusByPermission(cat.items)
})).filter(cat => cat.items.length > 0);
```

#### 6. Proteção de Rotas

```typescript
// src/components/PermissionRoute.tsx
export function PermissionRoute({ children, menuKey }: { 
  children: ReactNode; 
  menuKey: string;
}) {
  const { hasMenuAccess } = useMenuPermissions();
  const { profile } = useAuth();
  
  if (profile?.role === 'admin' || hasMenuAccess(menuKey)) {
    return <>{children}</>;
  }
  
  return <Navigate to="/dashboard" replace />;
}
```

#### 7. Interface de Permissões no Usuários.tsx

```tsx
// Estados para permissões
const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

// Ao abrir dialog de edição
const openEditDialog = (user: ProfileWithRole) => {
  // ... código existente
  // Carregar permissões do usuário
  loadUserPermissions(user.id);
};

// Carregar permissões
const loadUserPermissions = async (userId: string) => {
  const { data } = await supabase
    .from('user_menu_permissions')
    .select('menu_key')
    .eq('user_id', userId);
  setSelectedPermissions(data?.map(p => p.menu_key) || []);
};

// No form, mostrar checkboxes apenas se role != admin
{role !== 'admin' && (
  <div className="space-y-3">
    <Label>Permissões de Menu</Label>
    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
      {ASSIGNABLE_MENUS.map(menu => (
        <div key={menu.key} className="flex items-center gap-2">
          <Checkbox
            checked={selectedPermissions.includes(menu.key)}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedPermissions([...selectedPermissions, menu.key]);
              } else {
                setSelectedPermissions(selectedPermissions.filter(k => k !== menu.key));
              }
            }}
          />
          <Label className="text-sm font-normal">{menu.label}</Label>
        </div>
      ))}
    </div>
  </div>
)}

// Ao salvar, atualizar permissões
const savePermissions = async (userId: string, permissions: string[]) => {
  // Deletar permissões antigas
  await supabase.from('user_menu_permissions').delete().eq('user_id', userId);
  
  // Inserir novas permissões
  if (permissions.length > 0) {
    await supabase.from('user_menu_permissions').insert(
      permissions.map(key => ({ user_id: userId, menu_key: key }))
    );
  }
};
```

---

### Fluxo de Uso

1. **Admin cria/edita usuário** com role "representante" ou "producao"
2. **Admin marca checkboxes** dos menus que o usuário pode acessar
3. **Sistema salva permissões** na tabela `user_menu_permissions`
4. **Usuário faz login** → sistema carrega permissões junto com profile
5. **Sidebar filtra menus** baseado nas permissões
6. **Rotas verificam acesso** antes de renderizar páginas

---

### Resultado Final

- Menu "Leads Revendedoras" renomeado para "CRM"
- Admins continuam com acesso total a tudo
- Outros usuários só veem os menus que o admin atribuiu
- Interface simples com checkboxes no cadastro de usuário
- Sistema seguro com verificação em rotas e menus
