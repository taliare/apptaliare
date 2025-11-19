import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import taliare_logo from '@/assets/taliare-icone-claro.png';

export default function Setup() {
  const [loading, setLoading] = useState(true);
  const [created, setCreated] = useState(false);
  const [adminExists, setAdminExists] = useState(false);
  const navigate = useNavigate();

  // Check if admin already exists on mount
  useState(() => {
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
  });

  const createAdminUser = async () => {
    setLoading(true);
    
    try {
      // Criar usuário admin
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: 'admin@taliare.com',
        password: 'T@l1@re!2025',
        options: {
          data: {
            nome: 'Admin Taliare',
            role: 'admin',
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Usuário não criado');

      // Atualizar perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          ativo: true,
          habilitar_dashboard: true,
          habilitar_kanban: true,
          habilitar_cobranca_diaria: true,
        })
        .eq('id', authData.user.id);

      if (profileError) throw profileError;

      // Note: Role is automatically assigned by trigger to user_roles table

      setCreated(true);
      toast.success('Usuário admin criado com sucesso!');
      
      // Redirecionar para login após 2 segundos
      setTimeout(() => {
        navigate('/auth');
      }, 2000);
      
    } catch (error: any) {
      if (error.message?.includes('already registered')) {
        toast.error('Usuário admin já existe! Vá para a tela de login.');
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
            <img src={taliare_logo} alt="TALIARE SEMIJOIAS" className="h-20 w-20" />
          </div>
          <div className="space-y-2 text-center">
            <CardTitle className="text-2xl">Configuração Inicial</CardTitle>
            <CardDescription>
              Crie o usuário administrador do sistema
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
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
            <>
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <p className="font-semibold">Configuração do Admin:</p>
                <p className="text-sm">Email: <span className="font-mono">admin@taliare.com</span></p>
                <p className="text-sm text-muted-foreground">Uma senha será gerada automaticamente</p>
              </div>
              
              <Button 
                onClick={createAdminUser} 
                className="w-full" 
                disabled={loading}
              >
                {loading ? 'Criando...' : 'Criar Usuário Admin'}
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                Esta página só precisa ser acessada uma única vez
              </p>
            </>
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
