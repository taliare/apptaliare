import { Home, Users, Target, Upload, FileText, LogOut, Calendar, CalendarCheck, Package } from 'lucide-react';
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
import taliare_logo from '@/assets/taliare-logo.png';

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

  const adminItems = [
    { title: 'Dashboard Admin', url: '/dashboard-admin', icon: Home },
    { title: 'Usuários', url: '/usuarios', icon: Users },
    { title: 'Metas', url: '/metas', icon: Target },
    { title: 'Importar Cobranças', url: '/importar-cobrancas', icon: Upload },
    { title: 'Relatórios', url: '/relatorios', icon: FileText },
  ];

  const items = profile?.role === 'admin' ? adminItems : representanteItems;

  return (
    <Sidebar className={collapsed ? 'w-14' : 'w-60'} collapsible="icon">
      <div className="flex items-center justify-between p-4">
        {!collapsed && (
          <img src={taliare_logo} alt="TALIARE" className="h-12 w-auto" />
        )}
        <SidebarTrigger className="ml-auto" />
      </div>

      <SidebarContent>
        <SidebarGroup>
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
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut}>
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
