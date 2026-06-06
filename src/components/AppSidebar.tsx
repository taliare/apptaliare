import {
  Home,
  Users,
  Target,
  Upload,
  FileText,
  Calendar,
  CalendarCheck,
  Package,
  Factory,
  ShoppingBag,
  Scale,
  PackageCheck,
  Settings,
  UserPlus,
  Shield,
  BarChart3,
  TrendingUp,
  Receipt,
  FolderOpen,
  LineChart,
  ClipboardList,
  AlertTriangle,
  Wallet,
  BookOpen,
  ScanLine,
} from "lucide-react";
import { useRef } from "react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useMenuPermissions } from "@/hooks/useMenuPermissions";
import { ASSIGNABLE_MENUS, MENU_EXTRA_CONFIG } from "@/lib/menuPermissions";
import { useNewLeadsCount } from "@/hooks/useNewLeadsCount";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

// Mapa de ícones para resolver string -> componente
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Home, UserPlus, Users, Shield, Package, PackageCheck, CalendarCheck, Target,
  Calendar, Scale, TrendingUp, Receipt, FolderOpen, BarChart3, LineChart,
  Upload, FileText, ClipboardList, AlertTriangle, Wallet,
};

interface MenuCategory {
  label: string;
  items: {
    title: string;
    url: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeText?: string;
  }[];
}

export function AppSidebar() {
  const { profile } = useAuth();
  const { state, setOpen } = useSidebar();
  const { hasRouteAccess, permissions } = useMenuPermissions();
  const newLeadsCount = useNewLeadsCount();
  const collapsed = state === "collapsed";

  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>();
  const handleMouseEnter = () => {
    clearTimeout(hoverTimeout.current);
    setOpen(true);
  };
  const handleMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => setOpen(false), 120);
  };

  const isAdmin = profile?.role === "admin";

  // Menu items por role, divididos em categorias
  const representanteCategories: MenuCategory[] = [
    {
      label: "INÍCIO",
      items: [
        { title: "Painel Geral", url: "/dashboard", icon: Home },
      ],
    },
    {
      label: "AGENDA",
      items: [
        { title: "Agenda", url: "/cobranca", icon: Calendar },
        { title: "Fechamento do Dia", url: "/cobranca-diaria", icon: CalendarCheck },
      ],
    },
    {
      label: "KITS",
      items: [
        { title: "Kits em Mãos", url: "/kits", icon: Package },
        { title: "Kits Entregues", url: "/kits-entregues", icon: PackageCheck },
        { title: "Pedidos de Kit", url: "/encomendas", icon: ShoppingBag },
      ],
    },
    {
      label: "GESTÃO",
      items: [
        { title: "Minhas Revendedoras", url: "/revendedoras-inativas", icon: Users },
        { title: "Garantias", url: "/garantias", icon: Shield },
        { title: "Histórico de Ações", url: "/historico-acoes", icon: ClipboardList },
      ],
    },
  ];

  const producaoCategories: MenuCategory[] = [
    {
      label: "INÍCIO",
      items: [
        { title: "Painel Geral", url: "/producao", icon: Factory },
      ],
    },
    {
      label: "PRODUÇÃO",
      items: [
        { title: "Produção Diária", url: "/producao-diaria", icon: Package },
        { title: "Distribuição de Kits", url: "/distribuicao-kits", icon: Package },
        { title: "Catálogo de Produtos", url: "/catalogo-produtos", icon: BookOpen },
        { title: "Montar Kit", url: "/montar-kit", icon: ScanLine },
      ],
    },
    {
      label: "ENCOMENDAS",
      items: [
        { title: "Encomendas", url: "/encomendas-producao", icon: ShoppingBag },
      ],
    },
  ];

  const adminCategories: MenuCategory[] = [
    {
      label: "VISÃO GERAL",
      items: [
        { title: "Painel Admin", url: "/dashboard-admin", icon: Home },
      ],
    },
    {
      label: "OPERACIONAL",
      items: [
        { title: "Usuários", url: "/usuarios", icon: Users },
        { title: "Revendedoras", url: "/revendedoras", icon: Users },
        { title: "Venda Externa", url: "/venda-externa", icon: Users },
        { title: "CRM", url: "/leads-revendedoras", icon: UserPlus, badge: newLeadsCount },
        { title: "Distribuição de Kits", url: "/distribuicao-kits", icon: Package },
        { title: "Catálogo de Produtos", url: "/catalogo-produtos", icon: BookOpen },
        { title: "Montar Kit", url: "/montar-kit", icon: ScanLine },
        { title: "Garantias", url: "/garantias", icon: Shield },
      ],
    },
    {
      label: "FINANCEIRO",
      items: [
        { title: "Fechamento Diário", url: "/fechamento-diario", icon: CalendarCheck },
        { title: "Metas", url: "/metas", icon: Target },
        { title: "Gerenciar Agenda", url: "/gerenciar-agenda", icon: Calendar },
        { title: "Apuração de Kits", url: "/apuracao", icon: PackageCheck },
        { title: "Jurídico", url: "/juridico", icon: Scale },
        { title: "Resumo DRE", url: "/dre-resumo", icon: TrendingUp },
        { title: "Despesas", url: "/dre-despesas", icon: Receipt },
        { title: "Categorias", url: "/dre-categorias", icon: FolderOpen },
        { title: "Fluxo de Caixa", url: "/fluxo-caixa", icon: Wallet },
        { title: "Configuração PDF", url: "/configuracao-pdf", icon: FileText },
      ],
    },
    {
      label: "RELATÓRIOS",
      items: [
        { title: "Relatório KPIs", url: "/relatorio-kpis", icon: BarChart3 },
        { title: "Análise Comercial", url: "/analise-comercial", icon: LineChart },
        { title: "Auditoria Geral", url: "/auditoria-geral", icon: ClipboardList },
        { title: "Importar Cobranças", url: "/importar-cobrancas", icon: Upload },
        { title: "Relatórios", url: "/relatorios", icon: FileText },
      ],
    },
  ];

  // Filtra menus baseado em permissões
  const filterMenusByPermission = (items: typeof adminCategories[0]['items']) => {
    if (profile?.role === 'admin') return items;
    
    return items.filter(item => {
      const menuDef = ASSIGNABLE_MENUS.find(m => m.route === item.url);
      if (!menuDef) return true;
      return hasRouteAccess(item.url);
    });
  };

  const baseCategories =
    profile?.role === "admin"
      ? adminCategories
      : profile?.role === "equipe_interna" || profile?.permissoes_customizadas
      ? []
      : profile?.role === "producao"
      ? producaoCategories
      : representanteCategories;

  // Aplica filtro de permissões
  let categories = baseCategories.map(cat => ({
    ...cat,
    items: filterMenusByPermission(cat.items)
  }));

  // Para não-admin: injetar menus extras que o usuário tem permissão mas não estão nas categorias base
  if (!isAdmin) {
    const existingUrls = new Set(categories.flatMap(c => c.items.map(i => i.url)));
    
    const extraMenusByCategory: Record<string, MenuCategory['items']> = {};
    
    for (const permKey of permissions) {
      const menuDef = ASSIGNABLE_MENUS.find(m => m.key === permKey);
      if (!menuDef || existingUrls.has(menuDef.route)) continue;
      
      const config = MENU_EXTRA_CONFIG[permKey];
      if (!config) continue;
      
      const icon = ICON_MAP[config.iconName] || Shield;
      const item = {
        title: menuDef.label,
        url: menuDef.route,
        icon,
        ...(permKey === 'crm' && newLeadsCount > 0 ? { badge: newLeadsCount } : {}),
      };
      
      if (!extraMenusByCategory[config.category]) {
        extraMenusByCategory[config.category] = [];
      }
      extraMenusByCategory[config.category].push(item);
    }
    
    // Adicionar extras nas categorias existentes ou criar novas
    for (const [catLabel, items] of Object.entries(extraMenusByCategory)) {
      const existing = categories.find(c => c.label === catLabel);
      if (existing) {
        existing.items.push(...items);
      } else {
        categories.push({ label: catLabel, items });
      }
    }
  }

  // Remove categorias vazias
  categories = categories.filter(cat => cat.items.length > 0);

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        border-r border-sidebar-border bg-sidebar transition-all duration-200 pt-14
        ${collapsed
          ? "w-16"
          : "w-48 absolute top-0 left-0 h-full z-50 shadow-2xl"
        }
      `}
    >
      <SidebarContent className="flex flex-col h-full custom-scrollbar px-2 py-4">
        {categories.map((category, catIndex) => (
          <SidebarGroup key={category.label} className={catIndex > 0 ? "mt-4" : ""}>
            {!collapsed && (
              <SidebarGroupLabel className="text-sidebar-foreground/40 text-[9px] uppercase tracking-widest px-2 mb-1">
                {category.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {category.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="
                          flex items-center justify-between w-full
                          px-2 py-1.5
                          rounded-lg
                          text-sidebar-foreground/70
                          hover:bg-sidebar-accent/50
                          hover:text-sidebar-foreground
                          transition-all duration-200
                          group
                          relative
                        "
                        activeClassName="bg-primary/10 text-primary border-l-2 border-primary font-medium"
                      >
                        <div className="flex items-center gap-2">
                          <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                          {!collapsed && <span className="text-xs">{item.title}</span>}
                        </div>
                        {!collapsed && item.badge !== undefined && item.badge > 0 && (
                          <Badge
                            variant="secondary"
                            className="ml-auto text-[10px] px-2 py-0 bg-primary/20 text-primary border-0"
                          >
                            {item.badge}
                          </Badge>
                        )}
                        {!collapsed && item.badgeText && (
                          <Badge
                            variant="secondary"
                            className="ml-auto text-[10px] px-2 py-0 bg-success/20 text-success border border-success/30"
                          >
                            {item.badgeText}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
            {catIndex < categories.length - 1 && !collapsed && (
              <div className="mt-4 mx-3 border-t border-sidebar-border/50" />
            )}
          </SidebarGroup>
        ))}

        {/* Footer - Versão */}
        <div className="mt-auto pt-4 border-t border-sidebar-border/50">
          {!collapsed && (
            <div className="px-3 py-2 text-center">
              <p className="text-[10px] text-sidebar-foreground/30 uppercase tracking-widest">
                TALIARE
              </p>
              <p className="text-[10px] text-sidebar-foreground/20">v1.0.0</p>
            </div>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
