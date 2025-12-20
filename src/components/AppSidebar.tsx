import {
  Home,
  Users,
  Target,
  Upload,
  FileText,
  LogOut,
  Calendar,
  CalendarCheck,
  Package,
  Factory,
  ShoppingBag,
  Scale,
  PackageCheck,
  ChevronRight,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import taliare_icone from "@/assets/taliare-icone-claro.png";

export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const isAdmin = profile?.role === "admin";
  const isProducao = profile?.role === "producao";
  const isRepresentante = !isAdmin && !isProducao;

  const menuLabel = isAdmin ? "Admin" : "Menu";
  const roleLabel = isAdmin ? "Administrador" : isProducao ? "Produção" : "Representante";

  // Badge de encomendas prontas para representante
  const { data: encomendasProntas = 0 } = useQuery({
    queryKey: ["encomendas-prontas-badge", profile?.id],
    queryFn: async () => {
      if (profile?.role !== "representante") return 0;

      const { count, error } = await supabase
        .from("encomendas_kits")
        .select("*", { count: "exact", head: true })
        .eq("representante_id", profile.id)
        .eq("status", "pronto");

      if (error) throw error;
      return count || 0;
    },
    enabled: profile?.role === "representante",
  });

  // Badge de encomendas solicitadas para produção
  const { data: encomendasSolicitadas = 0 } = useQuery({
    queryKey: ["encomendas-solicitadas-badge"],
    queryFn: async () => {
      if (profile?.role !== "producao") return 0;

      const { count, error } = await supabase
        .from("encomendas_kits")
        .select("*", { count: "exact", head: true })
        .eq("status", "solicitado");

      if (error) throw error;
      return count || 0;
    },
    enabled: profile?.role === "producao",
  });

  const representanteItems = [
    { title: "Início", url: "/dashboard", icon: Home, badge: 0 },
    { title: "Agenda", url: "/cobranca", icon: Calendar, badge: 0 },
    { title: "Fechamento do Dia", url: "/cobranca-diaria", icon: CalendarCheck, badge: 0 },
    { title: "Kits em Mãos", url: "/kits", icon: Package, badge: 0 },
    { title: "Kits Entregues", url: "/kits-entregues", icon: PackageCheck, badge: 0 },
    { title: "Pedidos de Kit", url: "/encomendas", icon: ShoppingBag, badge: encomendasProntas },
    { title: "Revendedoras Inativas", url: "/revendedoras-inativas", icon: Users, badge: 0 },
  ];

  const producaoItems = [
    { title: "Dashboard", url: "/producao", icon: Factory, badge: 0 },
    { title: "Produção Diária", url: "/producao-diaria", icon: Package, badge: 0 },
    { title: "Distribuição de Kits", url: "/distribuicao-kits", icon: Package, badge: 0 },
    { title: "Encomendas", url: "/encomendas-producao", icon: ShoppingBag, badge: encomendasSolicitadas },
  ];

  const adminItems = [
    { title: "Dashboard Admin", url: "/dashboard-admin", icon: Home, badge: 0 },
    { title: "Usuários", url: "/usuarios", icon: Users, badge: 0 },
    { title: "Metas", url: "/metas", icon: Target, badge: 0 },
    { title: "Gerenciar Agenda", url: "/gerenciar-agenda", icon: Calendar, badge: 0 },
    { title: "Distribuição de Kits", url: "/distribuicao-kits", icon: Package, badge: 0 },
    { title: "Venda Externa", url: "/venda-externa", icon: Users, badge: 0 },
    { title: "Vendedoras", url: "/vendedoras", icon: Users, badge: 0 },
    { title: "Jurídico", url: "/juridico", icon: Scale, badge: 0 },
    { title: "Importar Cobranças", url: "/importar-cobrancas", icon: Upload, badge: 0 },
    { title: "Relatórios", url: "/relatorios", icon: FileText, badge: 0 },
  ];

  const items =
    profile?.role === "admin" ? adminItems : profile?.role === "producao" ? producaoItems : representanteItems;

  return (
    <Sidebar
      collapsible="icon"
      className={`${collapsed ? "w-16" : "w-64"} border-r border-sidebar-border bg-sidebar transition-all duration-300`}
    >
      {/* Logo / Header */}
      <div className="flex flex-col items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full scale-150" />
          <img 
            src={taliare_icone} 
            alt="TALIARE" 
            className={`${collapsed ? "h-8 w-8" : "h-12 w-12"} relative z-10 transition-all duration-300`}
          />
        </div>
        {!collapsed && (
          <div className="text-center animate-fade-in">
            <span className="font-display font-semibold text-sidebar-foreground tracking-wide text-lg">
              TALIARE
            </span>
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest mt-0.5">
              {roleLabel}
            </p>
          </div>
        )}
      </div>

      {/* Collapse trigger */}
      <div className="flex justify-center py-3 border-b border-sidebar-border">
        <SidebarTrigger className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent" />
      </div>

      <SidebarContent className="flex flex-col h-full custom-scrollbar">
        {/* Menu principal */}
        <SidebarGroup className="flex-1 py-4">
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest px-4 mb-2">
            {menuLabel}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 space-y-1">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="
                        flex items-center justify-between w-full
                        px-3 py-2.5
                        rounded-xl
                        text-sidebar-foreground/70
                        hover:bg-sidebar-accent
                        hover:text-sidebar-foreground
                        transition-all duration-200
                        group
                      "
                      activeClassName="bg-primary text-primary-foreground shadow-glow-sm font-medium"
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span className="text-sm">{item.title}</span>}
                      </div>
                      {!collapsed && item.badge > 0 && (
                        <Badge variant="glow" className="ml-auto text-[10px] px-2 py-0">
                          {item.badge}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Footer */}
        <SidebarGroup className="mt-auto border-t border-sidebar-border py-3">
          <SidebarGroupContent>
            <SidebarMenu className="px-2 space-y-1">
              {/* Notificações */}
              <SidebarMenuItem>
                <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between px-3"} py-2`}>
                  {!collapsed && (
                    <span className="text-xs text-sidebar-foreground/50">Notificações</span>
                  )}
                  <PushNotificationToggle />
                </div>
              </SidebarMenuItem>

              {/* User info (when expanded) */}
              {!collapsed && profile && (
                <SidebarMenuItem>
                  <div className="px-3 py-2 mb-1">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">
                      {profile.nome}
                    </p>
                  </div>
                </SidebarMenuItem>
              )}

              {/* Sair */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={signOut}
                  className="
                    flex items-center gap-3
                    px-3 py-2.5
                    rounded-xl
                    text-sidebar-foreground/70
                    hover:bg-destructive/10
                    hover:text-destructive
                    transition-all duration-200
                    w-full
                  "
                >
                  <LogOut className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span className="text-sm">Sair</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
