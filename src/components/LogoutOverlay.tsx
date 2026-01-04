import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import taliareIconeClaro from '@/assets/taliare-icone-claro.png';
import taliareIconeEscuro from '@/assets/taliare-icone-escuro.png';

export function LogoutOverlay() {
  const { isLoggingOut, profile } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  if (!isLoggingOut) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background animate-fade-in">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] animate-orb-float-slow">
          <div className={`w-full h-full rounded-full animate-glow-pulse ${isDark ? 'bg-primary/30' : 'bg-primary/50'}`} />
        </div>
        <div className="absolute top-1/3 left-1/4 w-[250px] h-[250px] animate-orb-float-medium" style={{ animationDelay: '-3s' }}>
          <div className={`w-full h-full rounded-full animate-glow-breathe ${isDark ? 'bg-[#F5F0E8]/25' : 'bg-[#8B4D6B]/25'}`} />
        </div>
        <div className="absolute bottom-1/3 right-1/4 w-[200px] h-[200px] animate-orb-float-fast" style={{ animationDelay: '-5s' }}>
          <div className={`w-full h-full rounded-full animate-glow-fade ${isDark ? 'bg-primary/20' : 'bg-primary/40'}`} />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="relative">
          <div className={`absolute inset-0 blur-[50px] rounded-full scale-150 animate-glow-breathe ${isDark ? 'bg-primary/20' : 'bg-primary/35'}`} />
          <img 
            src={isDark ? taliareIconeClaro : taliareIconeEscuro} 
            alt="Taliare" 
            className="h-20 w-20 drop-shadow-lg animate-pulse-soft"
          />
        </div>
        
        <h1 className="text-xl font-display font-semibold tracking-wide text-foreground/90 animate-stagger-in animate-stagger-in-1">
          {profile?.nome 
            ? `Até logo, ${profile.nome.split(' ')[0].charAt(0).toUpperCase() + profile.nome.split(' ')[0].slice(1).toLowerCase()}!`
            : 'Até logo!'}
        </h1>
        
        {/* Progress bar */}
        <div className="w-32 h-1 bg-border/30 rounded-full overflow-hidden animate-stagger-in animate-stagger-in-2">
          <div className="h-full bg-primary/60 rounded-full animate-progress" />
        </div>
      </div>
    </div>
  );
}