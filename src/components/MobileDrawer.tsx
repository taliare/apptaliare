import { X, LogOut, ShoppingBag, Scale } from 'lucide-react';
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
import taliare_horizontal from '@/assets/taliare-horizontal-escuro.png';

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileDrawer({ open, onOpenChange }: MobileDrawerProps) {
  const { profile, signOut } = useAuth();

  const representanteItems = [
    { title: 'Dashboard', url: '/dashboard', icon: Home },
    { title: 'Cobrança', url: '/cobranca', icon: Calendar },
    { title: 'Cobrança Diária', url: '/cobranca-diaria', icon: CalendarCheck },
    { title: 'Kits', url: '/kits', icon: Package },
    { title: 'Encomendas', url: '/encomendas', icon: ShoppingBag },
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

  const handleLinkClick = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="left" 
        className="w-[80%] max-w-sm p-0 bg-[#531B24] border-r border-[#6A2931] [&>button]:text-white [&>button]:hover:bg-[#6A2931]"
      >
        <SheetHeader className="flex flex-row items-center justify-between border-b border-[#6A2931] p-4">
          <img src={taliare_horizontal} alt="TALIARE SEMIJOIAS" className="h-8 w-auto brightness-0 invert" />
          <SheetTitle className="sr-only">Menu</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-[calc(100%-65px)]">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#E7D8C3] mb-3 px-3">
                {profile?.role === 'admin' ? 'ADMIN' : profile?.role === 'producao' ? 'PRODUÇÃO' : 'MENU'}
              </p>
              {items.map((item) => (
                <NavLink
                  key={item.title}
                  to={item.url}
                  onClick={handleLinkClick}
                  className="flex items-center gap-3 px-3 py-3 rounded-md text-[#E7D8C3] hover:bg-[#6A2931] transition-colors"
                  activeClassName="bg-[#E7D8C3] text-[#531B24] font-medium"
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.title}</span>
                </NavLink>
              ))}
            </div>
          </div>

          <div className="flex-shrink-0 border-t border-[#6A2931] p-4">
            <Button
              variant="ghost"
              onClick={() => {
                signOut();
                onOpenChange(false);
              }}
              className="w-full justify-start gap-3 text-[#E7D8C3] hover:bg-[#6A2931] hover:text-[#E7D8C3]"
            >
              <LogOut className="h-5 w-5" />
              <span>Sair</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
