import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";

export function PWAUpdateNotification() {
  const { showUpdate, reloadPage, dismissUpdate } = usePWAUpdate();

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[200] animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-center gap-3">
        <RefreshCw className="h-5 w-5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">Nova versão disponível!</p>
          <p className="text-xs opacity-90">Atualize para obter as últimas melhorias.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={reloadPage}
            className="h-8 text-xs"
          >
            Atualizar
          </Button>
          <button
            onClick={dismissUpdate}
            className="p-1 hover:opacity-70 transition-opacity"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
