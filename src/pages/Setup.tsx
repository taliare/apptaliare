import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import taliareLogoHorizontal from '@/assets/taliare-logo-horizontal.png';

export default function Setup() {
  const [loading, setLoading] = useState(true);
  const [created, setCreated] = useState(false);
  const [adminExists, setAdminExists] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nome: 'Admin Taliare',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminExists = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role', 'admin')
        .limit(1);

      if (data && data.length > 0) {
        setAdminExists(true);
        toast.info('Admin já existe. Redirecionando...');
        setTimeout(() => navigate('/auth'), 2000);
      }
      setLoading(false);
    };
    checkAdminExists();
  }, [navigate]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Senha deve ter pelo menos 8 caracteres';
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Senha deve conter pelo menos uma letra maiúscula';
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = 'Senha deve conter pelo menos uma letra minúscula';
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = 'Senha deve conter pelo menos um número';
    } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
      newErrors.password = 'Senha deve conter pelo menos um caractere especial';
    }

    // Confirm password
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'As senhas não coincidem';
    }

    // Name validation
    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createAdminUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            nome: formData.nome.trim(),
            role: 'admin',
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Usuário não criado');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          ativo: true,
        })
        .eq('id', authData.user.id);

      if (profileError) throw profileError;

      setCreated(true);
      toast.success('Usuário admin criado com sucesso!');
      
      setTimeout(() => {
        navigate('/auth');
      }, 2000);
      
    } catch (error: any) {
      if (error.message?.includes('already registered')) {
        toast.error('Este email já está registrado! Vá para a tela de login.');
        setTimeout(() => {
          navigate('/auth');
        }, 2000);
      } else {
        toast.error('Erro ao criar admin: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img src={taliareLogoHorizontal} alt="Taliare Semijoias" className="h-12" />
          </div>
          <div className="space-y-2 text-center">
            <CardTitle className="text-2xl">Configuração Inicial</CardTitle>
            <CardDescription>
              Crie o usuário administrador do sistema
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && !formData.email ? (
            <div className="text-center space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <p className="text-sm text-muted-foreground">Verificando...</p>
            </div>
          ) : adminExists ? (
            <div className="text-center space-y-4">
              <div className="text-blue-600 dark:text-blue-400">
                ℹ Admin já configurado
              </div>
              <p className="text-sm text-muted-foreground">
                Redirecionando para login...
              </p>
            </div>
          ) : !created ? (
            <form onSubmit={createAdminUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Administrador</Label>
                <Input
                  id="nome"
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome completo"
                  disabled={loading}
                />
                {errors.nome && <p className="text-sm text-destructive">{errors.nome}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="admin@empresa.com"
                  disabled={loading}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Mínimo 8 caracteres"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                <p className="text-xs text-muted-foreground">
                  Deve conter: maiúscula, minúscula, número e caractere especial
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Repita a senha"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>
              
              <Button 
                type="submit"
                className="w-full" 
                disabled={loading}
              >
                {loading ? 'Criando...' : 'Criar Usuário Admin'}
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                Esta página só precisa ser acessada uma única vez
              </p>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="text-green-600 dark:text-green-400">
                ✓ Usuário admin criado com sucesso!
              </div>
              <p className="text-sm text-muted-foreground">
                Redirecionando para a tela de login...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
