import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ModalSenhaAdminProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAutorizado: () => void;
  acao: 'editar' | 'excluir';
}

export function ModalSenhaAdmin({
  open,
  onOpenChange,
  onAutorizado,
  acao
}: ModalSenhaAdminProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  const validarCredenciais = async () => {
    if (!email || !senha) {
      toast({
        title: "Atenção",
        description: "Informe o email e a senha do administrador.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      // Tentar fazer login com as credenciais fornecidas
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: senha
      });

      if (authError) {
        toast({
          title: "Erro",
          description: "Email ou senha inválidos.",
          variant: "destructive"
        });
        return;
      }

      // Verificar se o usuário é admin
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleError || !roleData) {
        toast({
          title: "Acesso Negado",
          description: "Este usuário não possui permissão de administrador.",
          variant: "destructive"
        });
        
        // Fazer logout do usuário temporário
        await supabase.auth.signOut();
        return;
      }

      // Autorização concedida
      toast({
        title: "Autorizado",
        description: "Credenciais de administrador validadas com sucesso.",
      });

      // Fazer logout do admin temporário para voltar ao usuário original
      await supabase.auth.signOut();
      
      // Chamar callback de sucesso
      onAutorizado();
      
      // Fechar modal e limpar campos
      onOpenChange(false);
      setEmail('');
      setSenha('');
      
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao validar credenciais.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) {
        setEmail('');
        setSenha('');
      }
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Autorização de Administrador</DialogTitle>
          <DialogDescription>
            Para {acao === 'editar' ? 'editar' : 'excluir'} esta cobrança, é necessária a autorização de um administrador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-admin">Email do Administrador</Label>
            <Input
              id="email-admin"
              type="email"
              placeholder="admin@taliare.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha-admin">Senha do Administrador</Label>
            <Input
              id="senha-admin"
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  validarCredenciais();
                }
              }}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={validarCredenciais}
              disabled={loading}
            >
              {loading ? 'Validando...' : 'Autorizar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
