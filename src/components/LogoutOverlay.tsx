import { useAuth } from '@/contexts/AuthContext';
import taliareIcone from '@/assets/taliare-icone-claro.png';

export function LogoutOverlay() {
  const { isLoggingOut, profile } = useAuth();

  if (!isLoggingOut) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background animate-fade-in">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] animate-orb-float-slow">
          <div className="w-full h-full bg-primary/30 rounded-full animate-glow-pulse" />
        </div>
        <div className="absolute top-1/3 left-1/4 w-[250px] h-[250px] animate-orb-float-medium" style={{ animationDelay: '-3s' }}>
          <div className="w-full h-full bg-[#F5F0E8]/25 rounded-full animate-glow-breathe" />
        </div>
        <div className="absolute bottom-1/3 right-1/4 w-[200px] h-[200px] animate-orb-float-fast" style={{ animationDelay: '-5s' }}>
          <div className="w-full h-full bg-primary/20 rounded-full animate-glow-fade" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-[50px] rounded-full scale-150 animate-glow-breathe" />
          <img 
            src={taliareIcone} 
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