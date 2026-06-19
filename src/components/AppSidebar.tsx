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
import {
  ALL_MENUS,
  CATEGORY_ORDER,
  type MenuCategoryLabel,
  type MenuModule,
} from "@/lib/menuPermissions";
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

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Home, UserPlus, Users, Shield, Package, PackageCheck, CalendarCheck, Target,
  Calendar, Scale, TrendingUp, Receipt, FolderOpen, BarChart3, LineChart,
  Upload, FileText, ClipboardList, AlertTriangle, Wallet, Factory,
  ShoppingBag, BookOpen, ScanLine,
};

interface SidebarItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface SidebarCategory {
  label: MenuCategoryLabel;
  items: SidebarItem[];
}

export function AppSidebar() {
  const { profile } = useAuth();
  const { state, setOpen } = useSidebar();
  const { hasMenuAccess } = useMenuPermissions();
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

  // Monta sidebar a partir do registro unificado, filtrando pela permissão efetiva
  const visibleModules: MenuModule[] = ALL_MENUS.filter((m) => hasMenuAccess(m.key));

  const grouped: Record<string, SidebarItem[]> = {};
  for (const m of visibleModules) {
    const item: SidebarItem = {
      title: m.label,
      url: m.route,
      icon: ICON_MAP[m.iconName] || Shield,
      ...(m.key === "crm" && newLeadsCount > 0 ? { badge: newLeadsCount } : {}),
    };
    (grouped[m.category] ||= []).push(item);
  }

  const categories: SidebarCategory[] = CATEGORY_ORDER
    .filter((cat) => grouped[cat]?.length)
    .map((cat) => ({ label: cat, items: grouped[cat] }));

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
