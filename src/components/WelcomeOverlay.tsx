import { useEffect, useState } from 'react';

interface WelcomeOverlayProps {
  show: boolean;
  nome?: string | null;
  variant?: 'welcome' | 'goodbye';
  onComplete?: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatFirstName(nome?: string | null): string {
  if (!nome) return '';
  const first = nome.trim().split(/\s+/)[0] || '';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function WelcomeOverlay({ show, nome, variant = 'welcome', onComplete }: WelcomeOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (!show) {
      setVisible(false);
      setFadingOut(false);
      return;
    }

    // Fade in
    const fadeInTimer = setTimeout(() => setVisible(true), 30);
    // Start fade out after 1.5s of full visibility (0.8s fade-in + 1.5s hold)
    const fadeOutTimer = setTimeout(() => setFadingOut(true), 800 + 1500);
    // Complete after fade out (0.8s)
    const completeTimer = setTimeout(() => {
      onComplete?.();
    }, 800 + 1500 + 800);

    return () => {
      clearTimeout(fadeInTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(completeTimer);
    };
  }, [show, onComplete]);

  if (!show) return null;

  const firstName = formatFirstName(nome);
  const message = variant === 'welcome'
    ? `${getGreeting()}${firstName ? `, ${firstName}` : ''}`
    : `Até logo${firstName ? `, ${firstName}` : ''}`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: '#0D0305' }}
    >
      <h1
        className="font-thin text-2xl tracking-wide text-center px-6 transition-opacity duration-[800ms] ease-out"
        style={{
          color: '#E7D8C3',
          opacity: visible && !fadingOut ? 1 : 0,
        }}
      >
        {message}
      </h1>
    </div>
  );
}
