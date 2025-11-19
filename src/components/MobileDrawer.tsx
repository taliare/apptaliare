import { X, LogOut } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Users, Target, Upload, FileText, Calendar, CalendarCheck, Package } from 'lucide-react';
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
  ];

  const adminItems = [
    { title: 'Dashboard Admin', url: '/dashboard-admin', icon: Home },
    { title: 'Usuários', url: '/usuarios', icon: Users },
    { title: 'Metas', url: '/metas', icon: Target },
    { title: 'Importar Cobranças', url: '/importar-cobrancas', icon: Upload },
    { title: 'Relatórios', url: '/relatorios', icon: FileText },
  ];

  const items = profile?.role === 'admin' ? adminItems : representanteItems;

  const handleLinkClick = () => {
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="left">
      <DrawerContent className="h-full w-[80%] max-w-sm fixed left-0 top-0 bottom-0 bg-[#531B24] border-r border-[#6A2931]">
        <DrawerHeader className="flex items-center justify-between border-b border-[#6A2931] pb-4">
          <img src={taliare_horizontal} alt="TALIARE SEMIJOIAS" className="h-8 w-auto brightness-0 invert" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="text-white hover:bg-[#6A2931]"
          >
            <X className="h-5 w-5" />
          </Button>
        </DrawerHeader>

        <div className="flex flex-col h-[calc(100vh-80px)] px-4 py-6">
          <div className="flex-1 space-y-1 overflow-y-auto">
            <p className="text-xs font-semibold text-[#E7D8C3] mb-3 px-3">
              {profile?.role === 'admin' ? 'ADMIN' : 'MENU'}
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

          <div className="border-t border-[#6A2931] pt-4 mt-4">
            <Button
              variant="ghost"
              onClick={() => {
                signOut();
                onOpenChange(false);
              }}
              className="w-full justify-start gap-3 text-[#E7D8C3] hover:bg-[#6A2931]"
            >
              <LogOut className="h-5 w-5" />
              <span>Sair</span>
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
