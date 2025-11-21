import { Home, Users, Target, Upload, FileText, LogOut, Calendar, CalendarCheck, Package, Factory } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
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
} from '@/components/ui/sidebar';
import taliare_horizontal from '@/assets/taliare-horizontal-escuro.png';
import taliare_icone from '@/assets/taliare-icone-escuro.png';

export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === 'collapsed';

  const representanteItems = [
    { title: 'Dashboard', url: '/dashboard', icon: Home },
    { title: 'Cobrança', url: '/cobranca', icon: Calendar },
    { title: 'Cobrança Diária', url: '/cobranca-diaria', icon: CalendarCheck },
    { title: 'Kits', url: '/kits', icon: Package },
  ];

  const producaoItems = [
    { title: 'Produção', url: '/producao', icon: Factory },
  ];

  const adminItems = [
    { title: 'Dashboard Admin', url: '/dashboard-admin', icon: Home },
    { title: 'Usuários', url: '/usuarios', icon: Users },
    { title: 'Metas', url: '/metas', icon: Target },
    { title: 'Importar Cobranças', url: '/importar-cobrancas', icon: Upload },
    { title: 'Relatórios', url: '/relatorios', icon: FileText },
  ];

  const items = profile?.role === 'admin' ? adminItems : profile?.role === 'producao' ? producaoItems : representanteItems;

  return (
    <Sidebar className={collapsed ? 'w-14' : 'w-60'} collapsible="icon">
      <div className="flex items-center justify-center p-4">
        {collapsed ? (
          <img src={taliare_icone} alt="TALIARE" className="h-10 w-10" />
        ) : (
          <img src={taliare_horizontal} alt="TALIARE SEMIJOIAS" className="h-10 w-auto" />
        )}
      </div>
      <div className="flex justify-center pb-2">
        <SidebarTrigger />
      </div>

      <SidebarContent className="flex flex-col h-full">
        <SidebarGroup className="flex-1">
          <SidebarGroupLabel>{profile?.role === 'admin' ? 'Admin' : 'Menu'}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent/50 transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
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
                <SidebarMenuButton onClick={signOut} className="hover:bg-destructive/10 hover:text-destructive">
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
