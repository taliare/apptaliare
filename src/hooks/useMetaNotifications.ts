import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Target } from 'lucide-react';

interface MetaNotificationProps {
  percentualMeta: number;
  metaValor: number;
  totalCobrado: number;
}

export function useMetaNotifications({ percentualMeta, metaValor, totalCobrado }: MetaNotificationProps) {
  const { toast } = useToast();
  const notifiedLevels = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!metaValor || metaValor === 0) return;

    const checkAndNotify = (level: number, message: string, description: string) => {
      if (percentualMeta >= level && !notifiedLevels.current.has(level)) {
        notifiedLevels.current.add(level);
        toast({
          title: message,
          description: description,
          duration: 5000,
        });
      }
    };

    // Notificações em marcos importantes
    checkAndNotify(
      50,
      '🎯 Metade do caminho!',
      `Você já atingiu 50% da meta do mês. Continue assim!`
    );

    checkAndNotify(
      75,
      '🔥 Você está indo muito bem!',
      `Faltam apenas 25% para atingir sua meta mensal!`
    );

    checkAndNotify(
      90,
      '⚡ Quase lá!',
      `Você está a 10% de atingir sua meta. Continue focado!`
    );

    checkAndNotify(
      100,
      '🎉 Parabéns! Meta atingida!',
      `Você atingiu 100% da sua meta mensal!`
    );

    checkAndNotify(
      120,
      '🚀 Superação incrível!',
      `Você superou sua meta em 20%! Excelente trabalho!`
    );

  }, [percentualMeta, metaValor, toast]);
}
