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
  ChevronDown,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useSidebarLayout, type ResolvedCategory } from "@/hooks/useSidebarLayout";
import { useNewLeadsCount } from "@/hooks/useNewLeadsCount";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Home, UserPlus, Users, Shield, Package, PackageCheck, CalendarCheck, Target,
  Calendar, Scale, TrendingUp, Receipt, FolderOpen, BarChart3, LineChart,
  Upload, FileText, ClipboardList, AlertTriangle, Wallet, Factory,
  ShoppingBag, BookOpen, ScanLine,
};

const STORAGE_KEY = "taliare:sidebar:open-categories";

function readOpenState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function AppSidebar() {
  const { state, setOpen } = useSidebar();
  const collapsed = state === "collapsed";
  const categories = useSidebarLayout();
  const newLeadsCount = useNewLeadsCount();
  const { pathname } = useLocation();

  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>();
  const handleMouseEnter = () => {
    clearTimeout(hoverTimeout.current);
    setOpen(true);
  };
  const handleMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => setOpen(false), 120);
  };

  // Categoria que contém a rota ativa
  const activeCategoryId = useMemo(() => {
    for (const cat of categories) {
      if (cat.items.some((i) => i.route === pathname)) return cat.id;
    }
    return null;
  }, [categories, pathname]);

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => readOpenState());

  // Garante que a categoria ativa esteja aberta
  useEffect(() => {
    if (!activeCategoryId) return;
    setOpenMap((prev) =>
      prev[activeCategoryId] ? prev : { ...prev, [activeCategoryId]: true },
    );
  }, [activeCategoryId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openMap));
    } catch {
      /* ignore */
    }
  }, [openMap]);

  const toggle = (id: string) =>
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        border-r border-sidebar-border bg-sidebar transition-all duration-200
        ${collapsed
          ? "w-16 h-full"
          : "w-56 !fixed !top-14 !left-0 !h-[calc(100vh-3.5rem)] z-40 bg-sidebar"
        }
      `}
    >
      <SidebarContent className="flex flex-col h-full custom-scrollbar px-2 py-4 bg-sidebar">

        {collapsed ? (
          // ===== Modo recolhido: lista chapada de ícones =====
          <SidebarMenu className="space-y-0.5">
            {categories.flatMap((c) => c.items).map((item) => {
              const Icon = ICON_MAP[item.iconName] || Shield;
              return (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.route}
                      title={item.label}
                      className="flex items-center justify-center w-full px-2 py-1.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200"
                      activeClassName="bg-primary/20 text-primary border-l-2 border-primary"
                    >
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        ) : (
          // ===== Modo expandido: accordion ERP =====
          <nav className="flex flex-col gap-0.5">
            {categories.map((cat) => (
              <CategoryNode
                key={cat.id}
                category={cat}
                open={!!openMap[cat.id]}
                onToggle={() => toggle(cat.id)}
                newLeadsCount={newLeadsCount}
              />
            ))}
          </nav>
        )}

        {/* Footer */}
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

interface CategoryNodeProps {
  category: ResolvedCategory;
  open: boolean;
  onToggle: () => void;
  newLeadsCount: number;
}

function CategoryNode({ category, open, onToggle, newLeadsCount }: CategoryNodeProps) {
  const HeaderIcon = ICON_MAP[category.iconName] || Shield;

  // Categoria DIRECT = link único, sem accordion
  if (category.direct) {
    const item = category.items[0];
    if (!item) return null;
    const Icon = ICON_MAP[item.iconName] || HeaderIcon;
    return (
      <NavLink
        to={item.route}
        className="flex items-center gap-2 px-2 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200"
        activeClassName="bg-primary/20 text-primary border-l-2 border-primary font-medium"
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="text-xs font-medium uppercase tracking-wider">{item.label}</span>
      </NavLink>
    );
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center justify-between w-full px-2 py-2 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-all duration-200"
      >
        <div className="flex items-center gap-2">
          <HeaderIcon className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-[10px] uppercase tracking-widest font-medium">
            {category.label}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <ul className="pl-3 mt-0.5 mb-1 space-y-0.5 border-l border-sidebar-border/50 ml-3">
            {category.items.map((item) => {
              const Icon = ICON_MAP[item.iconName] || Shield;
              const showBadge = item.key === "crm" && newLeadsCount > 0;
              return (
                <li key={item.key}>
                  <NavLink
                    to={item.route}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-colors"
                    activeClassName="bg-primary/25 text-primary border-l-2 border-accent font-medium -ml-[1px]"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="text-xs truncate">{item.label}</span>
                    </span>
                    {showBadge && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-2 py-0 bg-primary/20 text-primary border-0"
                      >
                        {newLeadsCount}
                      </Badge>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
