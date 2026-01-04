import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import taliareLogoHorizontal from '@/assets/taliare-logo-horizontal.png';
import taliareIcone from '@/assets/taliare-icone-claro.png';
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
      }, 1200);
      
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
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-primary/10 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse-subtle" />
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
            <div className={`absolute inset-0 bg-primary/15 blur-[40px] rounded-full scale-150 -z-10 transition-opacity duration-700 ${showTransition ? 'opacity-100' : 'opacity-0'}`} />
            <img 
              src={taliareIcone} 
              alt="Taliare" 
              className={`h-24 w-24 drop-shadow-lg transition-all duration-500 ease-out ${showTransition ? 'opacity-100 translate-y-0 animate-pulse-soft' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: '200ms' }}
            />
          </div>
          
          <h1 
            className={`text-2xl font-display font-semibold tracking-wide text-foreground/90 transition-all duration-500 ease-out ${showTransition ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
            style={{ transitionDelay: '400ms' }}
          >
            {profile?.nome 
              ? `Bem-vindo, ${profile.nome.split(' ')[0].charAt(0).toUpperCase() + profile.nome.split(' ')[0].slice(1).toLowerCase()}!`
              : 'Bem-vindo!'}
          </h1>
          
          {/* Barra de progresso elegante */}
          <div 
            className={`w-40 h-1.5 bg-border/30 rounded-full overflow-hidden transition-opacity duration-500 ${showTransition ? 'opacity-100' : 'opacity-0'}`}
            style={{ transitionDelay: '600ms' }}
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
            : 'opacity-100 scale-100 translate-y-0 animate-scale-in'
        }`}
      >
        <Card variant="glass">
          <CardHeader className="space-y-6 pb-4">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full scale-150" />
                <img 
                  src={taliareLogoHorizontal} 
                  alt="Taliare Semijoias" 
                  className="h-12 relative z-10 drop-shadow-lg"
                />
              </div>
            </div>
            
            <div className="text-center">
              <CardDescription className="text-muted-foreground">
                Sistema Interno de Gestão
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
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

              <div className="space-y-2">
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
