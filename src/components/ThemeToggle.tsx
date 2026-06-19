import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface ThemeToggleProps {
  className?: string;
  variant?: "header" | "mobile";
}

export function ThemeToggle({ className, variant = "header" }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = mounted ? (theme === "system" ? resolvedTheme : theme) : "light";
  const isDark = current === "dark";

  const baseClass =
    variant === "header"
      ? "h-9 w-9 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg"
      : "h-9 w-9 xs:h-10 xs:w-10 rounded-lg bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`${baseClass} ${className ?? ""}`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
