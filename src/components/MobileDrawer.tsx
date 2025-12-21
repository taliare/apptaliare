import { LogOut, ShoppingBag, Scale, PackageCheck, X, MessageCircle, User, Settings } from 'lucide-react';
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
import { Home, Users, Target, Upload, FileText, Calendar, CalendarCheck, Package, Factory, Bell } from 'lucide-react';
import taliareLogoHorizontal from '@/assets/taliare-logo-horizontal.png';

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
        { title: 'Dashboard', url: '/dashboard', icon: Home },
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
      ],
    },
  ];

  const producaoCategories: MenuCategory[] = [
    {
      label: "INÍCIO",
      items: [
        { title: 'Dashboard', url: '/producao', icon: Factory },
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
      label: "INÍCIO",
      items: [
        { title: 'Dashboard Admin', url: '/dashboard-admin', icon: Home },
      ],
    },
    {
      label: "GESTÃO",
      items: [
        { title: 'Usuários', url: '/usuarios', icon: Users },
        { title: 'Vendedoras', url: '/vendedoras', icon: Users },
        { title: 'Venda Externa', url: '/venda-externa', icon: Users },
      ],
    },
    {
      label: "FINANCEIRO",
      items: [
        { title: 'Metas', url: '/metas', icon: Target },
        { title: 'Gerenciar Agenda', url: '/gerenciar-agenda', icon: Calendar },
        { title: 'Jurídico', url: '/juridico', icon: Scale },
      ],
    },
    {
      label: "KITS",
      items: [
        { title: 'Distribuição de Kits', url: '/distribuicao-kits', icon: Package },
      ],
    },
    {
      label: "FERRAMENTAS",
      items: [
        { title: 'Importar Cobranças', url: '/importar-cobrancas', icon: Upload },
        { title: 'Relatórios', url: '/relatorios', icon: FileText },
      ],
    },
  ];

  const categories = profile?.role === 'admin' 
    ? adminCategories 
    : profile?.role === 'producao' 
    ? producaoCategories 
    : representanteCategories;

  const handleLinkClick = () => {
    onOpenChange(false);
  };

  return (
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
                <AvatarImage src="" alt={profile?.nome || "Usuário"} />
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
              className="flex-1 h-9 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs">Mensagens</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
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
                className="flex-1 h-9 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 gap-2"
              >
                <User className="h-4 w-4" />
                <span className="text-xs">Perfil</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
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
  );
}
