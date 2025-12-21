import { useCallback, useRef } from "react";

// Criar sons programaticamente usando Web Audio API
const createNotificationSound = (): AudioContext | null => {
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return null;
  }
};

export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playNotificationSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = createNotificationSound();
      }

      const ctx = audioContextRef.current;
      if (!ctx) return;

      // Resumir contexto se estiver suspenso (política de autoplay)
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Criar oscilador para tom agradável
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Tom suave e agradável (similar a notificação do iPhone)
      oscillator.frequency.setValueAtTime(880, now); // A5
      oscillator.frequency.setValueAtTime(1100, now + 0.1); // C#6
      oscillator.frequency.setValueAtTime(880, now + 0.2); // A5
      oscillator.type = "sine";

      // Envelope suave
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gainNode.gain.linearRampToValueAtTime(0.15, now + 0.15);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.35);

      oscillator.start(now);
      oscillator.stop(now + 0.35);
    } catch (error) {
      console.warn("Erro ao reproduzir som de notificação:", error);
    }
  }, []);

  const playMessageSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = createNotificationSound();
      }

      const ctx = audioContextRef.current;
      if (!ctx) return;

      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Tom de mensagem - mais curto e suave
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Dois tons rápidos (pop pop)
      oscillator.frequency.setValueAtTime(587, now); // D5
      oscillator.frequency.setValueAtTime(784, now + 0.08); // G5
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.25, now + 0.01);
      gainNode.gain.linearRampToValueAtTime(0.1, now + 0.08);
      gainNode.gain.linearRampToValueAtTime(0.25, now + 0.09);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.2);

      oscillator.start(now);
      oscillator.stop(now + 0.2);
    } catch (error) {
      console.warn("Erro ao reproduzir som de mensagem:", error);
    }
  }, []);

  return {
    playNotificationSound,
    playMessageSound,
  };
}
