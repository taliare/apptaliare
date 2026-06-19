import { useState } from "react";
import { MessageCircle, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/components/ui/sidebar";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { SendNotificationDialog } from "@/components/admin/SendNotificationDialog";
import { MessagesDialog } from "@/components/messages/MessagesDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import taliareLogoHorizontal from "@/assets/taliare-logo-horizontal.png";
import { LogOut, Settings, User, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMessages } from "@/hooks/useMessages";

export function AppHeader() {
  const { profile, signOut } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const isAdmin = profile?.role === "admin";
  const { unreadCount } = useMessages();
  const [messagesOpen, setMessagesOpen] = useState(false);

  const userInitials = profile?.nome
    ? profile.nome
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  return (
    <>
      <header className="hidden md:flex items-center justify-between h-14 px-4 bg-sidebar border-b border-sidebar-border sticky top-0 z-30">
        {/* Left side - Logo + Collapse */}
        <div className="flex items-center gap-3">
          <img
            src={taliareLogoHorizontal}
            alt="Taliare Semijoias"
            className="h-8"
          />

        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          {/* Admin: Send notification button */}
          {isAdmin && (
            <SendNotificationDialog
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg"
                >
                  <Send className="h-4 w-4" />
                </Button>
              }
            />
          )}

          {/* Message button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMessagesOpen(true)}
            className="h-9 w-9 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg relative"
          >
            <MessageCircle className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold h-5 w-5 flex items-center justify-center rounded-full">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>

          {/* Theme toggle */}
          <ThemeToggle variant="header" />

          {/* Notifications dropdown */}
          <NotificationsDropdown />

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 w-9 rounded-full p-0 hover:ring-2 hover:ring-primary/50"
              >
                <Avatar className="h-9 w-9 border-2 border-sidebar-border">
                  <AvatarImage src={profile?.avatar_url || ""} alt={profile?.nome || "Usuário"} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{profile?.nome}</p>
                  <p className="text-xs leading-none text-muted-foreground capitalize">
                    {profile?.role || "Usuário"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/perfil")}>
                <User className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/perfil")}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={signOut}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <MessagesDialog open={messagesOpen} onOpenChange={setMessagesOpen} />
    </>
  );
}
