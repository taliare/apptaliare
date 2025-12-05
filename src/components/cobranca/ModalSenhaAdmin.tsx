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
      // Use edge function to validate admin credentials server-side
      // This doesn't affect the current user's session
      const { data, error } = await supabase.functions.invoke('validate-admin', {
        body: { email, password: senha }
      });

      if (error) {
        toast({
          title: "Erro",
          description: error.message || "Erro ao validar credenciais.",
          variant: "destructive"
        });
        return;
      }

      if (!data?.success) {
        toast({
          title: "Acesso Negado",
          description: data?.error || "Credenciais inválidas ou usuário não é administrador.",
          variant: "destructive"
        });
        return;
      }

      // Autorização concedida
      toast({
        title: "Autorizado",
        description: "Credenciais de administrador validadas com sucesso.",
      });
      
      // Chamar callback de sucesso
      onAutorizado();
      
      // Fechar modal e limpar campos
      onOpenChange(false);
      setEmail('');
      setSenha('');
      
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao validar credenciais.",
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
              placeholder="admin@exemplo.com"
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
