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
import taliareHorizontalEscuro from '@/assets/taliare-horizontal-escuro.png';
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
    <div className="relative overflow-hidden flex min-h-screen items-center justify-center p-4" style={{ background: '#0D0305' }}>
      {/* Background com focos de luz animados */}
      <div style={{ position:'absolute',width:520,height:520,background:'#6A2931',borderRadius:'50%',filter:'blur(90px)',mixBlendMode:'screen',top:-100,left:-80,animation:'drift1 10s ease-in-out infinite',pointerEvents:'none' }} />
      <div style={{ position:'absolute',width:460,height:460,background:'#531B24',borderRadius:'50%',filter:'blur(90px)',mixBlendMode:'screen',bottom:-80,right:-60,animation:'drift2 12s ease-in-out infinite',pointerEvents:'none' }} />
      <div style={{ position:'absolute',width:320,height:320,background:'#6A2931',borderRadius:'50%',filter:'blur(90px)',mixBlendMode:'screen',top:'40%',left:'40%',opacity:0.5,animation:'drift3 9s ease-in-out infinite',pointerEvents:'none' }} />

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
        <Card variant={isDark ? "glass" : "login"}>
          <CardHeader className="space-y-6 pb-4">
            <div className="flex justify-center">
              <img 
                src={isDark ? taliareHorizontalEscuro : taliareLogoHorizontalEscuro} 
                alt="Taliare Semijoias" 
                className="h-12 drop-shadow-lg"
              />
            </div>
            
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2 animate-stagger-in animate-stagger-in-1">
                <Label htmlFor="login-email" className={`text-sm font-medium ${isDark ? "text-foreground/80" : "text-white/80"}`}>
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
                  className={`h-12 ${isDark ? "" : "bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white/10 focus-visible:bg-white/10 focus-visible:border-white/40 focus-visible:ring-white/20"}`}
                  disabled={showLoading || isExiting}
                />
              </div>

              <div className="space-y-2 animate-stagger-in animate-stagger-in-2">
                <Label htmlFor="login-password" className={`text-sm font-medium ${isDark ? "text-foreground/80" : "text-white/80"}`}>
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
                  className={`h-12 ${isDark ? "" : "bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white/10 focus-visible:bg-white/10 focus-visible:border-white/40 focus-visible:ring-white/20"}`}
                  disabled={showLoading || isExiting}
                />
              </div>

              <div className="animate-stagger-in animate-stagger-in-3">
                <Button 
                  type="submit" 
                  className={`w-full h-12 text-base font-medium mt-2 transition-all duration-200 ${isDark ? "" : "bg-[hsl(38,42%,92%)] text-[hsl(350,47%,20%)] hover:bg-[hsl(38,42%,85%)]"}`}
                  variant={isDark ? "glow" : "default"}
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

            <div className={`mt-8 pt-6 border-t ${isDark ? "border-border/50" : "border-white/20"}`}>
              <p className={`text-xs text-center ${isDark ? "text-muted-foreground" : "text-white/50"}`}>
                © {new Date().getFullYear()} Taliare Semijoias
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
