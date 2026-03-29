import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";

export function PWAUpdateNotification() {
  const { showUpdate, reloadPage } = usePWAUpdate();

  if (!showUpdate) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-lg text-center space-y-6">
        {/* Ícone animado */}
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <RefreshCw className="h-8 w-8 text-primary animate-spin" style={{ animationDuration: '3s' }} />
          </div>
        </div>

        {/* Texto */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Nova versão disponível</h2>
          <p className="text-sm text-muted-foreground">
            O sistema foi atualizado com melhorias e correções importantes. É necessário atualizar para continuar usando.
          </p>
        </div>

        {/* Botão */}
        <Button onClick={reloadPage} className="w-full" size="lg">
          <RefreshCw className="h-4 w-4" />
          Atualizar agora
        </Button>

        <p className="text-xs text-muted-foreground">
          Seus dados estão salvos e não serão perdidos.
        </p>
      </div>
    </div>
  );
}
