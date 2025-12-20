import { LogOut, ShoppingBag, Scale, PackageCheck, X, ChevronRight } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Users, Target, Upload, FileText, Calendar, CalendarCheck, Package, Factory } from 'lucide-react';
import taliare_icone from '@/assets/taliare-icone-claro.png';

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileDrawer({ open, onOpenChange }: MobileDrawerProps) {
  const { profile, signOut } = useAuth();

  const representanteItems = [
    { title: 'Início', url: '/dashboard', icon: Home },
    { title: 'Agenda', url: '/cobranca', icon: Calendar },
    { title: 'Fechamento do Dia', url: '/cobranca-diaria', icon: CalendarCheck },
    { title: 'Kits em Mãos', url: '/kits', icon: Package },
    { title: 'Kits Entregues', url: '/kits-entregues', icon: PackageCheck },
    { title: 'Pedidos de Kit', url: '/encomendas', icon: ShoppingBag },
  ];

  const producaoItems = [
    { title: 'Dashboard', url: '/producao', icon: Factory },
    { title: 'Produção Diária', url: '/producao-diaria', icon: Package },
    { title: 'Distribuição de Kits', url: '/distribuicao-kits', icon: Package },
    { title: 'Encomendas', url: '/encomendas-producao', icon: ShoppingBag },
  ];

  const adminItems = [
    { title: 'Dashboard Admin', url: '/dashboard-admin', icon: Home },
    { title: 'Usuários', url: '/usuarios', icon: Users },
    { title: 'Metas', url: '/metas', icon: Target },
    { title: 'Gerenciar Agenda', url: '/gerenciar-agenda', icon: Calendar },
    { title: 'Distribuição de Kits', url: '/distribuicao-kits', icon: Package },
    { title: 'Jurídico', url: '/juridico', icon: Scale },
    { title: 'Importar Cobranças', url: '/importar-cobrancas', icon: Upload },
    { title: 'Relatórios', url: '/relatorios', icon: FileText },
  ];

  const items = profile?.role === 'admin' ? adminItems : profile?.role === 'producao' ? producaoItems : representanteItems;
  const roleLabel = profile?.role === 'admin' ? 'Admin' : profile?.role === 'producao' ? 'Produção' : 'Menu';

  const handleLinkClick = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="left" 
        className="w-[88%] xs:w-[85%] max-w-sm p-0 bg-sidebar border-r border-sidebar-border [&>button]:hidden"
      >
        {/* Header */}
        <SheetHeader className="flex flex-row items-center justify-between border-b border-sidebar-border p-3 xs:p-4">
          <div className="flex items-center gap-2 xs:gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 blur-lg rounded-full" />
              <img 
                src={taliare_icone} 
                alt="TALIARE" 
                className="h-8 w-8 xs:h-10 xs:w-10 relative z-10"
              />
            </div>
            <div>
              <span className="font-display font-semibold text-sidebar-foreground tracking-wide text-base xs:text-lg">
                TALIARE
              </span>
              <p className="text-[10px] xs:text-xs text-sidebar-foreground/60 uppercase tracking-wider">
                {roleLabel}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <X className="h-4 w-4 xs:h-5 xs:w-5" />
          </Button>
          <SheetTitle className="sr-only">Menu</SheetTitle>
        </SheetHeader>

        {/* Navigation */}
        <div className="flex flex-col h-[calc(100%-65px)] xs:h-[calc(100%-73px)]">
          <nav className="flex-1 overflow-y-auto px-2 xs:px-3 py-3 xs:py-4 custom-scrollbar">
            <div className="space-y-0.5 xs:space-y-1">
              {items.map((item, index) => (
                <NavLink
                  key={item.title}
                  to={item.url}
                  onClick={handleLinkClick}
                  className="
                    flex items-center justify-between
                    px-3 xs:px-4 py-3 xs:py-3.5
                    rounded-lg xs:rounded-xl
                    text-sidebar-foreground/80
                    hover:bg-sidebar-accent
                    hover:text-sidebar-foreground
                    transition-all duration-200
                    group
                  "
                  activeClassName="bg-primary text-primary-foreground shadow-glow-sm"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-2.5 xs:gap-3">
                    <item.icon className="h-4 w-4 xs:h-5 xs:w-5" />
                    <span className="font-medium text-sm xs:text-base">{item.title}</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 xs:h-4 xs:w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </NavLink>
              ))}
            </div>
          </nav>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-sidebar-border p-2 xs:p-3">
            {/* User info */}
            {profile && (
              <div className="px-3 xs:px-4 py-2 xs:py-3 mb-1 xs:mb-2">
                <p className="text-xs xs:text-sm font-medium text-sidebar-foreground truncate">
                  {profile.nome}
                </p>
              </div>
            )}

            <Button
              variant="ghost"
              onClick={() => {
                signOut();
                onOpenChange(false);
              }}
              className="
                w-full justify-start gap-2.5 xs:gap-3
                px-3 xs:px-4 py-2.5 xs:py-3
                text-sidebar-foreground/80
                hover:bg-destructive/10
                hover:text-destructive
                rounded-lg xs:rounded-xl
                transition-all duration-200
                text-sm xs:text-base
              "
            >
              <LogOut className="h-4 w-4 xs:h-5 xs:w-5" />
              <span>Sair</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
