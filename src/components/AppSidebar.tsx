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
import taliare_horizontal from "@/assets/taliare-horizontal-escuro.png";
import taliare_icone from "@/assets/taliare-icone-escuro.png";

export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const isAdmin = profile?.role === "admin";
  const isProducao = profile?.role === "producao";
  const isRepresentante = !isAdmin && !isProducao;

  const menuLabel = isAdmin ? "Admin" : "Menu";
  const roleLabel = isAdmin ? "Painel Administrativo" : isProducao ? "Produção" : "Representante";

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
    { title: "Dashboard", url: "/dashboard", icon: Home, badge: 0 },
    { title: "Agenda de Cobrança", url: "/cobranca", icon: Calendar, badge: 0 },
    { title: "Cobrança Diária", url: "/cobranca-diaria", icon: CalendarCheck, badge: 0 },
    { title: "Kits", url: "/kits", icon: Package, badge: 0 },
    { title: "Encomendas", url: "/encomendas", icon: ShoppingBag, badge: encomendasProntas },
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
    { title: "Jurídico", url: "/juridico", icon: Scale, badge: 0 },
    { title: "Importar Cobranças", url: "/importar-cobrancas", icon: Upload, badge: 0 },
    { title: "Relatórios", url: "/relatorios", icon: FileText, badge: 0 },
  ];

  const items =
    profile?.role === "admin" ? adminItems : profile?.role === "producao" ? producaoItems : representanteItems;

  return (
    <Sidebar
      collapsible="icon"
      className={collapsed ? "w-14 border-r border-sidebar-border" : "w-60 border-r border-sidebar-border"}
    >
      {/* Logo / Topo */}
      <div className="flex flex-col items-center gap-2 px-4 py-4 border-b border-sidebar-border">
        {collapsed ? (
          <img src={taliare_icone} alt="TALIARE" className="h-10 w-10" />
        ) : (
          <>
            <img src={taliare_horizontal} alt="TALIARE SEMIJOIAS" className="h-10 w-auto" />
            <span className="text-xs text-muted-foreground tracking-wide uppercase">{roleLabel}</span>
          </>
        )}
      </div>

      {/* Trigger de colapso */}
      <div className="flex justify-center py-2 border-b border-sidebar-border">
        <SidebarTrigger />
      </div>

      <SidebarContent className="flex flex-col h-full">
        {/* Menu principal */}
        <SidebarGroup className="flex-1">
          <SidebarGroupLabel>{menuLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent/50 transition-colors flex items-center justify-between w-full"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </div>
                      {!collapsed && item.badge > 0 && (
                        <Badge variant="default" className="ml-auto">
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

        {/* Botão de sair no rodapé */}
        <SidebarGroup className="mt-auto border-t border-sidebar-border pt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={signOut}
                  className="hover:bg-destructive/10 hover:text-destructive flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  {!collapsed && <span>Sair</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
