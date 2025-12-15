import { Bell, BellOff, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function PushNotificationToggle() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);

  if (!isSupported) {
    return null;
  }

  const handleClick = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const handleTestNotification = async () => {
    if (!user) return;
    
    setIsTesting(true);
    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          title: '🔔 Teste de Notificação',
          body: 'Se você está vendo isso, as notificações estão funcionando!',
          data: { url: '/dashboard' }
        }
      });

      if (error) throw error;

      toast({
        title: 'Notificação enviada!',
        description: 'Verifique se recebeu a notificação push.',
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar a notificação de teste.',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const getTooltipText = () => {
    if (permission === 'denied') {
      return 'Notificações bloqueadas pelo navegador';
    }
    if (isSubscribed) {
      return 'Gerenciar notificações';
    }
    return 'Ativar notificações push';
  };

  if (!isSubscribed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClick}
              disabled={isLoading || permission === 'denied'}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltipText()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={isLoading}
          className="relative"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Bell className="h-5 w-5 text-primary" />
          )}
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <div className="grid gap-2">
          <p className="text-sm font-medium">Notificações ativas</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestNotification}
            disabled={isTesting}
            className="w-full justify-start"
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar teste
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClick}
            disabled={isLoading}
            className="w-full justify-start text-muted-foreground"
          >
            <BellOff className="h-4 w-4 mr-2" />
            Desativar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
