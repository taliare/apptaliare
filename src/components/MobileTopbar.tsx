import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import taliare_horizontal from "@/assets/taliare-horizontal-escuro.png";

interface MobileTopbarProps {
  onMenuClick: () => void;
}

export function MobileTopbar({ onMenuClick }: MobileTopbarProps) {
  return (
    <div
      className="
        md:hidden
        fixed top-0 left-0 right-0 z-40
        flex items-center justify-between
        px-4 py-3
        bg-[#E7D8C3]
        border-b border-[#C6B7A2]
        shadow-sm
      "
    >
      <img src={taliare_horizontal} alt="TALIARE SEMIJOIAS" className="h-8 w-auto" />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        aria-label="Abrir menu"
        className="
          flex items-center justify-center
          rounded-full
          bg-[#531B24]
          text-white
          hover:bg-[#6A2931]
          active:scale-95
          transition
        "
      >
        <Menu className="h-6 w-6" />
      </Button>
    </div>
  );
}
