import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import taliareLogoNovo from '@/assets/taliare-logo-novo.png';
import { Loader2 } from 'lucide-react';
import { WelcomeOverlay } from '@/components/WelcomeOverlay';

export default function Auth() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);
  const hasNavigated = useRef(false);

  const { signIn, user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && profile && !hasNavigated.current) {
      hasNavigated.current = true;
      setShowWelcome(true);
    }
  }, [user, profile]);

  const handleWelcomeComplete = () => {
    if (!profile) return;
    if (profile.role === 'admin') {
      navigate('/dashboard-admin', { replace: true });
    } else if (profile.role === 'producao') {
      navigate('/producao', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

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
    }
  };

  const showLoading = isSubmitting || (user && !profile);

  return (
    <div
      className="relative overflow-hidden flex min-h-screen items-center justify-center"
      style={{ background: '#0D0305' }}
    >
      {/* Background com focos de luz animados — sempre fullscreen, atrás de tudo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div style={{ position: 'absolute', width: 520, height: 520, background: '#6A2931', borderRadius: '50%', filter: 'blur(90px)', mixBlendMode: 'screen', top: -100, left: -80, animation: 'drift1 10s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 460, height: 460, background: '#531B24', borderRadius: '50%', filter: 'blur(90px)', mixBlendMode: 'screen', bottom: -80, right: -60, animation: 'drift2 12s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 320, height: 320, background: '#6A2931', borderRadius: '50%', filter: 'blur(90px)', mixBlendMode: 'screen', top: '40%', left: '40%', opacity: 0.5, animation: 'drift3 9s ease-in-out infinite' }} />
      </div>

      {/* Welcome animation */}
      <WelcomeOverlay
        show={showWelcome}
        nome={profile?.nome}
        variant="welcome"
        onComplete={handleWelcomeComplete}
      />

      {/* Login Form */}
      <div className="w-full max-w-md mx-4 relative z-10 animate-login-entrance">
        <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="p-6 sm:p-8 pb-2 flex justify-center">
            <img
              src={taliareLogoNovo}
              alt="Taliare Semijoias"
              className="h-12 w-auto drop-shadow-lg"
            />
          </div>

          <div className="p-6 sm:p-8 pt-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="animate-stagger-in animate-stagger-in-1">
                <Input
                  id="login-email"
                  type="email"
                  placeholder="Email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:bg-white/5 focus-visible:bg-white/5 focus-visible:border-white/30 focus-visible:ring-white/10 rounded-xl"
                  disabled={!!showLoading}
                />
              </div>

              <div className="animate-stagger-in animate-stagger-in-2">
                <Input
                  id="login-password"
                  type="password"
                  placeholder="Senha"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:bg-white/5 focus-visible:bg-white/5 focus-visible:border-white/30 focus-visible:ring-white/10 rounded-xl"
                  disabled={!!showLoading}
                />
              </div>

              <div className="animate-stagger-in animate-stagger-in-3 pt-2">
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-normal normal-case rounded-xl text-white transition-all duration-200"
                  style={{ backgroundColor: '#6A2931' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#531B24')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#6A2931')}
                  disabled={!!showLoading}
                >
                  {showLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Entrando...</span>
                    </span>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
