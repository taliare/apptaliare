import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import taliareLogoHorizontal from "@/assets/taliare-logo-horizontal.png";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";

interface MobileTopbarProps {
  onMenuClick: () => void;
}

export function MobileTopbar({ onMenuClick }: MobileTopbarProps) {
  return (
    <header
      className="
        md:hidden
        fixed top-0 left-0 right-0 z-40
        flex items-center justify-between
        px-3 xs:px-4 py-2.5 xs:py-3
        bg-background/80
        backdrop-blur-xl
        border-b border-border/50
        safe-top
      "
    >
      {/* Logo */}
      <div className="flex items-center">
        <img 
          src={taliareLogoHorizontal} 
          alt="Taliare Semijoias" 
          className="h-7 xs:h-8"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 xs:gap-2">
        <PushNotificationToggle />
        
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="
            relative
            h-9 w-9 xs:h-10 xs:w-10
            rounded-lg
            bg-secondary
            text-foreground
            hover:bg-primary
            hover:text-primary-foreground
            transition-all duration-200
          "
        >
          <Menu className="h-4 w-4 xs:h-5 xs:w-5" />
        </Button>
      </div>
    </header>
  );
}
