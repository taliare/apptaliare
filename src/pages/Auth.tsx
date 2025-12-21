import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import taliareLogoHorizontal from '@/assets/taliare-logo-horizontal.png';
import { Loader2 } from 'lucide-react';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isExiting, setIsExiting] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  
  const { signIn, user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && profile && !isExiting) {
      // Trigger exit animation
      setIsExiting(true);
      
      // Navigate after animation completes
      const timer = setTimeout(() => {
        if (profile.role === 'admin') {
          navigate('/dashboard-admin');
        } else if (profile.role === 'producao') {
          navigate('/producao');
        } else {
          navigate('/dashboard');
        }
      }, 320);
      
      return () => clearTimeout(timer);
    }
  }, [user, profile, navigate, isExiting]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginEmail || !loginPassword) {
      toast.error('Preencha todos os campos');
      return;
    }

    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    
    if (error) {
      setLoading(false);
      toast.error('Erro ao fazer login: ' + error.message);
    } else {
      toast.success('Login realizado com sucesso!');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-primary/10 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse-subtle" />
      </div>

      <div 
        ref={formRef}
        className={`w-full max-w-md relative z-10 transition-all duration-300 ease-out ${
          isExiting 
            ? 'opacity-0 -translate-y-3' 
            : 'opacity-100 translate-y-0 animate-scale-in'
        }`}
      >
        <Card variant="glass">
          <CardHeader className="space-y-6 pb-4">
            {/* Logo with glow effect */}
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
                  disabled={loading || isExiting}
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
                  disabled={loading || isExiting}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-medium mt-2 transition-all duration-200" 
                variant="glow"
                disabled={loading || isExiting}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="animate-pulse">Entrando...</span>
                  </span>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>

            {/* Subtle footer */}
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
