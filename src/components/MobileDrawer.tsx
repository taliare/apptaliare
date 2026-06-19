import { useEffect, useMemo, useState } from 'react';
import {
  LogOut, ShoppingBag, Scale, PackageCheck, X, MessageCircle, User, Settings,
  UserPlus, Shield, TrendingUp, Receipt, FolderOpen, LineChart, ClipboardList,
  AlertTriangle, Wallet, Home, Users, Target, Upload, FileText, Calendar,
  CalendarCheck, Package, Factory, Bell, BarChart3, BookOpen, ScanLine,
  ChevronDown,
} from 'lucide-react';
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
import { useNavigate, useLocation } from 'react-router-dom';
import { useSidebarLayout, type ResolvedCategory } from '@/hooks/useSidebarLayout';
import { useNewLeadsCount } from '@/hooks/useNewLeadsCount';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Home, UserPlus, Users, Shield, Package, PackageCheck, CalendarCheck, Target,
  Calendar, Scale, TrendingUp, Receipt, FolderOpen, BarChart3, LineChart,
  Upload, FileText, ClipboardList, AlertTriangle, Wallet, Factory,
  ShoppingBag, BookOpen, ScanLine,
};

const STORAGE_KEY = 'taliare:mobile-drawer:open-categories';

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileDrawer({ open, onOpenChange }: MobileDrawerProps) {
  const { profile, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const { unreadCount: unreadMessages } = useMessages();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const categories = useSidebarLayout();
  const newLeadsCount = useNewLeadsCount();

  const userInitials = profile?.nome
    ? profile.nome
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  const activeCategoryId = useMemo(() => {
    for (const cat of categories) {
      if (cat.items.some((i) => i.route === pathname)) return cat.id;
    }
    return null;
  }, [categories, pathname]);

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

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

  const handleLinkClick = () => onOpenChange(false);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="left"
          className="w-[88%] xs:w-[85%] max-w-sm p-0 bg-sidebar border-r border-sidebar-border [&>button]:hidden"
        >
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

          <div className="flex flex-col h-[calc(100%-140px)]">
            <nav className="flex-1 overflow-y-auto px-2 py-3 custom-scrollbar">
              {categories.map((cat) => (
                <MobileCategoryNode
                  key={cat.id}
                  category={cat}
                  open={!!openMap[cat.id]}
                  onToggle={() => toggle(cat.id)}
                  onLinkClick={handleLinkClick}
                  newLeadsCount={newLeadsCount}
                />
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
                className="w-full justify-center gap-2 h-10 text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive rounded-xl transition-all duration-200"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm">Sair</span>
              </Button>

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

interface MobileCategoryNodeProps {
  category: ResolvedCategory;
  open: boolean;
  onToggle: () => void;
  onLinkClick: () => void;
  newLeadsCount: number;
}

function MobileCategoryNode({
  category, open, onToggle, onLinkClick, newLeadsCount,
}: MobileCategoryNodeProps) {
  const HeaderIcon = ICON_MAP[category.iconName] || Shield;

  if (category.direct) {
    const item = category.items[0];
    if (!item) return null;
    const Icon = ICON_MAP[item.iconName] || HeaderIcon;
    return (
      <NavLink
        to={item.route}
        onClick={onLinkClick}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200 mb-1"
        activeClassName="bg-primary/20 text-primary border-l-2 border-primary font-medium"
      >
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{item.label}</span>
      </NavLink>
    );
  }

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <HeaderIcon className="h-4 w-4" />
          <span className="text-[11px] uppercase tracking-widest font-medium">
            {category.label}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
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
          <ul className="pl-3 mt-1 space-y-0.5 border-l border-sidebar-border/50 ml-5">
            {category.items.map((item) => {
              const Icon = ICON_MAP[item.iconName] || Shield;
              const showBadge = item.key === "crm" && newLeadsCount > 0;
              return (
                <li key={item.key}>
                  <NavLink
                    to={item.route}
                    onClick={onLinkClick}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-colors"
                    activeClassName="bg-primary/25 text-primary border-l-2 border-accent font-medium -ml-[1px]"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm truncate">{item.label}</span>
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
