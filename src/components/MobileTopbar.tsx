import { Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import taliare_icone from "@/assets/taliare-icone-claro.png";
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
        px-4 py-3
        bg-background/80
        backdrop-blur-xl
        border-b border-border/50
        safe-top
      "
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
          <img 
            src={taliare_icone} 
            alt="TALIARE" 
            className="h-8 w-8 relative z-10"
          />
        </div>
        <span className="font-display font-semibold text-foreground tracking-wide">
          TALIARE
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <PushNotificationToggle />
        
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="
            relative
            rounded-lg
            bg-secondary
            text-foreground
            hover:bg-primary
            hover:text-primary-foreground
            transition-all duration-200
          "
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
