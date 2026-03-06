import { useState } from 'react';
import { LogOut, ShoppingBag, Scale, PackageCheck, X, MessageCircle, User, Settings, UserPlus, Shield, TrendingUp, Receipt, FolderOpen, LineChart, ClipboardList, AlertTriangle } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useMessages } from '@/hooks/useMessages';
import { MessagesDialog } from '@/components/messages/MessagesDialog';
import { NotificationsSheet } from '@/components/notifications/NotificationsSheet';
import { Home, Users, Target, Upload, FileText, Calendar, CalendarCheck, Package, Factory, Bell, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { ASSIGNABLE_MENUS, MENU_EXTRA_CONFIG } from '@/lib/menuPermissions';
import { useNewLeadsCount } from '@/hooks/useNewLeadsCount';
// Mapa de ícones para resolver string -> componente
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  UserPlus, Users, Shield, Package, CalendarCheck, Target, Calendar, Scale,
  TrendingUp, Receipt, FolderOpen, BarChart3, LineChart, Upload, FileText, ClipboardList, AlertTriangle,
};

interface MenuCategory {
  label: string;
  items: {
    title: string;
    url: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[];
}

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileDrawer({ open, onOpenChange }: MobileDrawerProps) {
  const { profile, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const { unreadCount: unreadMessages } = useMessages();
  const navigate = useNavigate();
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { hasRouteAccess, permissions } = useMenuPermissions();
  const newLeadsCount = useNewLeadsCount();

  const userInitials = profile?.nome
    ? profile.nome
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  const representanteCategories: MenuCategory[] = [
    {
      label: "INÍCIO",
      items: [
        { title: 'Painel Geral', url: '/dashboard', icon: Home },
      ],
    },
    {
      label: "AGENDA",
      items: [
        { title: 'Agenda', url: '/cobranca', icon: Calendar },
        { title: 'Fechamento do Dia', url: '/cobranca-diaria', icon: CalendarCheck },
      ],
    },
    {
      label: "KITS",
      items: [
        { title: 'Kits em Mãos', url: '/kits', icon: Package },
        { title: 'Kits Entregues', url: '/kits-entregues', icon: PackageCheck },
        { title: 'Pedidos de Kit', url: '/encomendas', icon: ShoppingBag },
      ],
    },
    {
      label: "GESTÃO",
      items: [
        { title: 'Revendedoras Inativas', url: '/revendedoras-inativas', icon: Users },
        { title: 'Histórico de Ações', url: '/historico-acoes', icon: ClipboardList },
      ],
    },
  ];

  const producaoCategories: MenuCategory[] = [
    {
      label: "INÍCIO",
      items: [
        { title: 'Painel Geral', url: '/producao', icon: Factory },
      ],
    },
    {
      label: "PRODUÇÃO",
      items: [
        { title: 'Produção Diária', url: '/producao-diaria', icon: Package },
        { title: 'Distribuição de Kits', url: '/distribuicao-kits', icon: Package },
      ],
    },
    {
      label: "ENCOMENDAS",
      items: [
        { title: 'Encomendas', url: '/encomendas-producao', icon: ShoppingBag },
      ],
    },
  ];

  const adminCategories: MenuCategory[] = [
    {
      label: "VISÃO GERAL",
      items: [
        { title: 'Painel Admin', url: '/dashboard-admin', icon: Home },
      ],
    },
    {
      label: "OPERACIONAL",
      items: [
        { title: 'Usuários', url: '/usuarios', icon: Users },
        { title: 'Revendedoras', url: '/revendedoras', icon: Users },
        { title: 'Venda Externa', url: '/venda-externa', icon: Users },
        { title: 'CRM', url: '/leads-revendedoras', icon: UserPlus, badge: newLeadsCount },
        { title: 'Distribuição de Kits', url: '/distribuicao-kits', icon: Package },
        { title: 'Garantias', url: '/garantias', icon: Shield },
      ],
    },
    {
      label: "FINANCEIRO",
      items: [
        { title: 'Fechamento Diário', url: '/fechamento-diario', icon: CalendarCheck },
        { title: 'Metas', url: '/metas', icon: Target },
        { title: 'Gerenciar Agenda', url: '/gerenciar-agenda', icon: Calendar },
        { title: 'Jurídico', url: '/juridico', icon: Scale },
        { title: 'Resumo DRE', url: '/dre-resumo', icon: TrendingUp },
        { title: 'Despesas', url: '/dre-despesas', icon: Receipt },
        { title: 'Categorias', url: '/dre-categorias', icon: FolderOpen },
      ],
    },
    {
      label: "RELATÓRIOS",
      items: [
        { title: 'Relatório KPIs', url: '/relatorio-kpis', icon: BarChart3 },
        { title: 'Análise Comercial', url: '/analise-comercial', icon: LineChart },
        { title: 'Auditoria Geral', url: '/auditoria-geral', icon: ClipboardList },
        { title: 'Importar Cobranças', url: '/importar-cobrancas', icon: Upload },
        { title: 'Relatórios', url: '/relatorios', icon: FileText },
      ],
    },
    {
      label: "TALIARE 2.0",
      items: [
        { title: 'Produção T2', url: '/t2-producao', icon: Package },
        { title: 'Revendedoras T2', url: '/t2-revendedoras', icon: Users },
        { title: 'Ciclos T2', url: '/t2-ciclos', icon: Target },
        { title: 'Inadimplência', url: '/t2-inadimplencia', icon: AlertTriangle },
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

  const baseCategories = profile?.role === 'admin' 
    ? adminCategories 
    : profile?.role === 'producao' 
    ? producaoCategories 
    : representanteCategories;

  let categories = baseCategories.map(cat => ({
    ...cat,
    items: filterMenusByPermission(cat.items)
  }));

  // Para não-admin: injetar menus extras que o usuário tem permissão mas não estão nas categorias base
  if (profile?.role !== 'admin') {
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
    
    for (const [catLabel, items] of Object.entries(extraMenusByCategory)) {
      const existing = categories.find(c => c.label === catLabel);
      if (existing) {
        existing.items.push(...items);
      } else {
        categories.push({ label: catLabel, items });
      }
    }
  }

  categories = categories.filter(cat => cat.items.length > 0);

  const handleLinkClick = () => {
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side="left" 
          className="w-[88%] xs:w-[85%] max-w-sm p-0 bg-sidebar border-r border-sidebar-border [&>button]:hidden"
        >
          {/* Header with user profile */}
          <SheetHeader className="border-b border-sidebar-border p-0">
            <div className="flex items-center justify-between p-3 xs:p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-primary/30">
                  <AvatarImage src={profile?.avatar_url || ""} alt={profile?.nome || "Usuário"} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-medium text-sidebar-foreground truncate max-w-[140px]">
                    {profile?.nome}
                  </p>
                  <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">
                    {profile?.role === 'admin' ? 'Administrador' : profile?.role === 'producao' ? 'Produção' : 'Representante'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Quick action buttons */}
            <div className="flex items-center gap-2 px-4 pb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMessagesOpen(true);
                  onOpenChange(false);
                }}
                className="flex-1 h-9 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 gap-2 relative"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="text-xs">Mensagens</span>
                {unreadMessages > 0 && (
                  <span className="absolute top-0.5 right-2 h-4 w-4 flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-medium rounded-full">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNotificationsOpen(true);
                  onOpenChange(false);
                }}
                className="flex-1 h-9 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 gap-2 relative"
              >
                <Bell className="h-4 w-4" />
                <span className="text-xs">Notificações</span>
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-2 h-4 w-4 flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-medium rounded-full">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </div>
            <SheetTitle className="sr-only">Menu</SheetTitle>
          </SheetHeader>

          {/* Navigation */}
          <div className="flex flex-col h-[calc(100%-140px)]">
            <nav className="flex-1 overflow-y-auto px-2 py-3 custom-scrollbar">
              {categories.map((category, catIndex) => (
                <div key={category.label} className={catIndex > 0 ? "mt-4" : ""}>
                  <p className="text-[10px] text-sidebar-foreground/40 uppercase tracking-widest px-3 mb-2">
                    {category.label}
                  </p>
                  <div className="space-y-0.5">
                    {category.items.map((item) => (
                      <NavLink
                        key={item.title}
                        to={item.url}
                        onClick={handleLinkClick}
                        className="
                          flex items-center justify-between
                          px-3 py-2.5
                          rounded-xl
                          text-sidebar-foreground/70
                          hover:bg-sidebar-accent/50
                          hover:text-sidebar-foreground
                          transition-all duration-200
                          group
                        "
                        activeClassName="bg-primary/10 text-primary border-l-2 border-primary font-medium"
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="h-4 w-4" />
                          <span className="text-sm">{item.title}</span>
                        </div>
                        {item.badge !== undefined && item.badge > 0 && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-2 py-0 bg-primary/20 text-primary border-0"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </NavLink>
                    ))}
                  </div>
                  {/* Separator */}
                  {catIndex < categories.length - 1 && (
                    <div className="mt-4 mx-3 border-t border-sidebar-border/50" />
                  )}
                </div>
              ))}
            </nav>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-sidebar-border p-3">
              <div className="flex gap-2 mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigate("/perfil");
                    onOpenChange(false);
                  }}
                  className="flex-1 h-9 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 gap-2"
                >
                  <User className="h-4 w-4" />
                  <span className="text-xs">Perfil</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigate("/perfil");
                    onOpenChange(false);
                  }}
                  className="flex-1 h-9 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 gap-2"
                >
                  <Settings className="h-4 w-4" />
                  <span className="text-xs">Config</span>
                </Button>
              </div>

              <Button
                variant="ghost"
                onClick={() => {
                  signOut();
                  onOpenChange(false);
                }}
                className="
                  w-full justify-center gap-2
                  h-10
                  text-sidebar-foreground/70
                  hover:bg-destructive/10
                  hover:text-destructive
                  rounded-xl
                  transition-all duration-200
                "
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm">Sair</span>
              </Button>

              {/* Version */}
              <div className="mt-3 text-center">
                <p className="text-[10px] text-sidebar-foreground/30 uppercase tracking-widest">
                  TALIARE
                </p>
                <p className="text-[10px] text-sidebar-foreground/20">v1.0.0</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <MessagesDialog open={messagesOpen} onOpenChange={setMessagesOpen} />
      <NotificationsSheet open={notificationsOpen} onOpenChange={setNotificationsOpen} />
    </>
  );
}
