import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import taliareLogoHorizontalClaro from '@/assets/taliare-logo-horizontal-claro.png';
import taliareLogoHorizontalEscuro from '@/assets/taliare-logo-horizontal.png';
import taliareIconeClaro from '@/assets/taliare-icone-claro.png';
import taliareIconeEscuro from '@/assets/taliare-icone-escuro.png';
import { Loader2 } from 'lucide-react';

export default function Auth() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isExiting, setIsExiting] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const hasNavigated = useRef(false);
  
  const { signIn, user, profile } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    // Only navigate once when user and profile are both loaded
    if (user && profile && !hasNavigated.current) {
      hasNavigated.current = true;
      
      // Step 1: Start form exit animation
      setIsExiting(true);
      
      // Step 2: Show transition overlay after form fades
      setTimeout(() => {
        setShowTransition(true);
      }, 300);
      
      // Step 3: Navigate after transition animation
      const timer = setTimeout(() => {
        if (profile.role === 'admin') {
          navigate('/dashboard-admin', { replace: true });
        } else if (profile.role === 'producao') {
          navigate('/producao', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }, 2500);
      
      return () => clearTimeout(timer);
    }
  }, [user, profile, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginEmail || !loginPassword) {
      toast.error('Preencha todos os campos');
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    
    if (error) {
      setIsSubmitting(false);
      toast.error('Erro ao fazer login: ' + error.message);
    } else {
      toast.success('Login realizado com sucesso!');
    }
  };

  const showLoading = isSubmitting || (user && !profile);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background com luzes animadas */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Orb principal vermelho - canto superior direito */}
        <div 
          className="absolute -top-[20%] -right-[15%] w-[500px] h-[500px] md:w-[600px] md:h-[600px] animate-orb-float-slow"
          style={{ animationDelay: '0s' }}
        >
          <div className={`w-full h-full rounded-full animate-glow-pulse ${isDark ? 'bg-primary/40' : 'bg-primary/55'}`} />
        </div>
        
        {/* Orb secundário vermelho - canto inferior esquerdo */}
        <div 
          className="absolute -bottom-[25%] -left-[20%] w-[400px] h-[400px] md:w-[500px] md:h-[500px] animate-orb-float-medium"
          style={{ animationDelay: '-5s' }}
        >
          <div 
            className={`w-full h-full rounded-full animate-glow-breathe ${isDark ? 'bg-primary/35' : 'bg-primary/50'}`}
            style={{ animationDelay: '-2s' }} 
          />
        </div>
        
        {/* Orb terciário vermelho - centro-esquerda */}
        <div 
          className="absolute top-[30%] -left-[10%] w-[300px] h-[300px] md:w-[400px] md:h-[400px] animate-orb-float-fast"
          style={{ animationDelay: '-3s' }}
        >
          <div 
            className={`w-full h-full rounded-full animate-glow-pulse ${isDark ? 'bg-primary/30' : 'bg-primary/45'}`}
            style={{ animationDelay: '-1s' }} 
          />
        </div>
        
        {/* Orb quaternário vermelho - topo centro */}
        <div 
          className="absolute -top-[10%] left-[25%] w-[280px] h-[280px] md:w-[350px] md:h-[350px] animate-orb-float-medium"
          style={{ animationDelay: '-8s' }}
        >
          <div 
            className={`w-full h-full rounded-full animate-glow-breathe ${isDark ? 'bg-primary/32' : 'bg-primary/48'}`}
            style={{ animationDelay: '-4s' }} 
          />
        </div>
        
        {/* Orb pequeno vermelho - inferior direito */}
        <div 
          className="absolute bottom-[20%] right-[10%] w-[200px] h-[200px] md:w-[250px] md:h-[250px] animate-orb-float-slow"
          style={{ animationDelay: '-10s' }}
        >
          <div 
            className={`w-full h-full rounded-full animate-glow-fade ${isDark ? 'bg-primary/38' : 'bg-primary/52'}`}
            style={{ animationDelay: '-3s' }} 
          />
        </div>
        
        {/* Orb extra vermelho - centro direito */}
        <div 
          className="absolute top-[50%] -right-[5%] w-[180px] h-[180px] md:w-[220px] md:h-[220px] animate-orb-float-fast"
          style={{ animationDelay: '-7s' }}
        >
          <div 
            className={`w-full h-full rounded-full animate-glow-pulse ${isDark ? 'bg-primary/28' : 'bg-primary/42'}`}
            style={{ animationDelay: '-5s' }} 
          />
        </div>

        {/* Orb bege - superior esquerdo */}
        <div 
          className="absolute -top-[15%] -left-[10%] w-[350px] h-[350px] md:w-[450px] md:h-[450px] animate-orb-float-medium"
          style={{ animationDelay: '-4s' }}
        >
          <div 
            className={`w-full h-full rounded-full animate-glow-breathe ${isDark ? 'bg-[#F5F0E8]/40' : 'bg-[#8B4D6B]/30'}`}
            style={{ animationDelay: '-1s' }} 
          />
        </div>

        {/* Orb bege - centro */}
        <div 
          className="absolute top-[45%] left-[40%] w-[250px] h-[250px] md:w-[320px] md:h-[320px] animate-orb-float-slow"
          style={{ animationDelay: '-6s' }}
        >
          <div 
            className={`w-full h-full rounded-full animate-glow-pulse ${isDark ? 'bg-[#EDE5D8]/35' : 'bg-[#8B4D6B]/25'}`}
            style={{ animationDelay: '-2s' }} 
          />
        </div>

        {/* Orb bege - inferior centro */}
        <div 
          className="absolute -bottom-[10%] left-[35%] w-[280px] h-[280px] md:w-[350px] md:h-[350px] animate-orb-float-fast"
          style={{ animationDelay: '-9s' }}
        >
          <div 
            className={`w-full h-full rounded-full animate-glow-fade ${isDark ? 'bg-[#F8F4ED]/38' : 'bg-[#8B4D6B]/28'}`}
            style={{ animationDelay: '-4s' }} 
          />
        </div>

        {/* Orb bege pequeno - direita */}
        <div 
          className="absolute top-[15%] right-[25%] w-[180px] h-[180px] md:w-[220px] md:h-[220px] animate-orb-float-medium"
          style={{ animationDelay: '-11s' }}
        >
          <div 
            className={`w-full h-full rounded-full animate-glow-breathe ${isDark ? 'bg-[#F2EBE0]/32' : 'bg-[#8B4D6B]/22'}`}
            style={{ animationDelay: '-6s' }} 
          />
        </div>
      </div>

      {/* Transition Overlay */}
      <div 
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-all duration-500 ${
          showTransition 
            ? 'opacity-100 pointer-events-auto' 
            : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Gradiente radial suave */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.08)_0%,transparent_50%)]" />

        {/* Logo e saudação */}
        <div className={`relative z-10 flex flex-col items-center gap-6 transition-all duration-700 ease-out ${showTransition ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
          <div className="relative">
            {/* Sombra sutil */}
            <div className={`absolute inset-0 blur-[40px] rounded-full scale-150 -z-10 transition-opacity duration-700 ${showTransition ? 'opacity-100' : 'opacity-0'} ${isDark ? 'bg-primary/15' : 'bg-primary/25'}`} />
            <img 
              src={isDark ? taliareIconeClaro : taliareIconeEscuro} 
              alt="Taliare" 
              className={`h-24 w-24 drop-shadow-lg transition-all duration-500 ease-out ${showTransition ? 'opacity-100 translate-y-0 animate-pulse-soft' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: '100ms' }}
            />
          </div>
          
          <h1 
            className={`text-2xl font-display font-semibold tracking-wide text-foreground/90 transition-all duration-500 ease-out ${showTransition ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
            style={{ transitionDelay: '150ms' }}
          >
            {profile?.nome 
              ? `Bem-vindo, ${profile.nome.split(' ')[0].charAt(0).toUpperCase() + profile.nome.split(' ')[0].slice(1).toLowerCase()}!`
              : 'Bem-vindo!'}
          </h1>
          
          {/* Barra de progresso elegante */}
          <div 
            className={`w-40 h-1.5 bg-border/30 rounded-full overflow-hidden transition-opacity duration-500 ${showTransition ? 'opacity-100' : 'opacity-0'}`}
            style={{ transitionDelay: '200ms' }}
          >
            <div className="h-full rounded-full animate-progress" />
          </div>
        </div>
      </div>

      {/* Login Form */}
      <div 
        className={`w-full max-w-md relative z-10 transition-all duration-400 ease-out ${
          isExiting 
            ? 'opacity-0 scale-95 -translate-y-4' 
            : 'animate-login-entrance'
        }`}
      >
        <Card variant="glass">
          <CardHeader className="space-y-6 pb-4">
            <div className="flex justify-center">
              <img 
                src={isDark ? taliareLogoHorizontalClaro : taliareLogoHorizontalEscuro} 
                alt="Taliare Semijoias" 
                className="h-12 drop-shadow-lg"
              />
            </div>
            
            <div className="text-center">
              <CardDescription className="text-muted-foreground">
                Sistema Interno de Gestão
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2 animate-stagger-in animate-stagger-in-1">
                <Label htmlFor="login-email" className="text-sm font-medium text-foreground/80">
                  Email
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-12"
                  disabled={showLoading || isExiting}
                />
              </div>

              <div className="space-y-2 animate-stagger-in animate-stagger-in-2">
                <Label htmlFor="login-password" className="text-sm font-medium text-foreground/80">
                  Senha
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12"
                  disabled={showLoading || isExiting}
                />
              </div>

              <div className="animate-stagger-in animate-stagger-in-3">
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-medium mt-2 transition-all duration-200" 
                  variant="glow"
                  disabled={showLoading || isExiting}
                >
                  {showLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="animate-pulse">Entrando...</span>
                    </span>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-border/50">
              <p className="text-xs text-center text-muted-foreground">
                © {new Date().getFullYear()} Taliare Semijoias
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
