import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserPlus, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type AppRole = Database['public']['Enums']['app_role'];

// Extended profile type with role from user_roles table
interface ProfileWithRole extends ProfileRow {
  role: AppRole;
}

export default function Usuarios() {
  const [profiles, setProfiles] = useState<ProfileWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ProfileWithRole | null>(null);
  
  // Form state
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('representante');
  const [ativo, setAtivo] = useState(true);
  const [habilitarDashboard, setHabilitarDashboard] = useState(true);
  const [habilitarKanban, setHabilitarKanban] = useState(true);
  const [habilitarCobrancaDiaria, setHabilitarCobrancaDiaria] = useState(true);
  const [senha, setSenha] = useState('');

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('criado_em', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles for all users
      const userIds = profilesData?.map(p => p.id) || [];
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      // Combine profile and role data
      const profilesWithRoles = profilesData?.map(profile => {
        const roleRecord = rolesData?.find(r => r.user_id === profile.id);
        return {
          ...profile,
          role: roleRecord?.role || 'representante' as AppRole
        };
      }) || [];

      setProfiles(profilesWithRoles);
    } catch (error: any) {
      toast.error('Erro ao carregar usuários: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const openNewUserDialog = () => {
    setEditingUser(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (user: ProfileWithRole) => {
    setEditingUser(user);
    setNome(user.nome);
    setEmail('');
    setRole(user.role);
    setAtivo(user.ativo || false);
    setHabilitarDashboard(user.habilitar_dashboard || false);
    setHabilitarKanban(user.habilitar_kanban || false);
    setHabilitarCobrancaDiaria(user.habilitar_cobranca_diaria || false);
    setSenha('');
    setDialogOpen(true);
  };

  const resetForm = () => {
    setNome('');
    setEmail('');
    setRole('representante');
    setAtivo(true);
    setHabilitarDashboard(true);
    setHabilitarKanban(true);
    setHabilitarCobrancaDiaria(true);
    setSenha('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      await updateUser();
    } else {
      await createUser();
    }
  };

  const createUser = async () => {
    // Input validation
    if (!nome.trim()) {
      toast.error('O nome é obrigatório');
      return;
    }

    if (nome.trim().length > 100) {
      toast.error('O nome deve ter no máximo 100 caracteres');
      return;
    }

    if (!email.trim()) {
      toast.error('O email é obrigatório');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Por favor, insira um email válido');
      return;
    }

    if (email.length > 255) {
      toast.error('O email deve ter no máximo 255 caracteres');
      return;
    }

    if (!senha) {
      toast.error('A senha é obrigatória');
      return;
    }

    if (senha.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres');
      return;
    }

    if (senha.length > 100) {
      toast.error('A senha deve ter no máximo 100 caracteres');
      return;
    }

    // Password strength validation
    if (!/[A-Z]/.test(senha)) {
      toast.error('A senha deve conter pelo menos uma letra maiúscula');
      return;
    }

    if (!/[a-z]/.test(senha)) {
      toast.error('A senha deve conter pelo menos uma letra minúscula');
      return;
    }

    if (!/[0-9]/.test(senha)) {
      toast.error('A senha deve conter pelo menos um número');
      return;
    }

    try {
      setLoading(true);

      // Create auth user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: {
          data: {
            nome: nome.trim(),
            role,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Usuário não criado');

      // Update profile settings (role is handled by trigger)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          ativo,
          habilitar_dashboard: habilitarDashboard,
          habilitar_kanban: habilitarKanban,
          habilitar_cobranca_diaria: habilitarCobrancaDiaria,
        })
        .eq('id', signUpData.user.id);

      if (profileError) throw profileError;

      toast.success(`Usuário criado com sucesso!`);
      setDialogOpen(false);
      resetForm();
      loadProfiles();
    } catch (error: any) {
      if (error.message?.includes('already registered')) {
        toast.error('Este email já está cadastrado');
      } else {
        toast.error('Erro ao criar usuário: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async () => {
    if (!editingUser) return;

    // Input validation
    if (!nome.trim()) {
      toast.error('O nome é obrigatório');
      return;
    }

    if (nome.trim().length > 100) {
      toast.error('O nome deve ter no máximo 100 caracteres');
      return;
    }

    try {
      setLoading(true);

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          nome: nome.trim(),
          ativo,
          habilitar_dashboard: habilitarDashboard,
          habilitar_kanban: habilitarKanban,
          habilitar_cobranca_diaria: habilitarCobrancaDiaria,
        })
        .eq('id', editingUser.id);

      if (profileError) throw profileError;

      // Update role in user_roles table
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role })
        .eq('user_id', editingUser.id);

      if (roleError) throw roleError;

      toast.success('Usuário atualizado com sucesso!');
      setDialogOpen(false);
      resetForm();
      loadProfiles();
    } catch (error: any) {
      toast.error('Erro ao atualizar usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ativo: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      toast.success(`Usuário ${!currentStatus ? 'ativado' : 'desativado'}`);
      loadProfiles();
    } catch (error: any) {
      toast.error('Erro ao alterar status: ' + error.message);
    }
  };

  const getRoleName = (role: AppRole) => {
    const roles = {
      admin: 'Administrador',
      representante: 'Representante',
      producao: 'Produção',
    };
    return roles[role] || role;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Usuários</h1>
          <p className="text-muted-foreground">Gerencie representantes e suas permissões</p>
        </div>
        <Button onClick={openNewUserDialog}>
          <UserPlus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum usuário cadastrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.nome}</TableCell>
                    <TableCell>{getRoleName(profile.role)}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={profile.ativo || false}
                        onCheckedChange={() => toggleUserStatus(profile.id, profile.ativo || false)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(profile)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </DialogTitle>
              <DialogDescription>
                {editingUser
                  ? 'Atualize as informações do usuário'
                  : 'Preencha os dados para criar um novo usuário'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do usuário"
                  required
                />
              </div>

              {!editingUser && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="senha">Senha *</Label>
                    <Input
                      id="senha"
                      type="password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="role">Perfil *</Label>
                <Select value={role} onValueChange={(value) => setRole(value as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="representante">Representante</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="producao">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Permissões</Label>
                <div className="flex items-center justify-between">
                  <Label htmlFor="ativo" className="font-normal">
                    Usuário Ativo
                  </Label>
                  <Switch
                    id="ativo"
                    checked={ativo}
                    onCheckedChange={setAtivo}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="dashboard" className="font-normal">
                    Habilitar Dashboard
                  </Label>
                  <Switch
                    id="dashboard"
                    checked={habilitarDashboard}
                    onCheckedChange={setHabilitarDashboard}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="kanban" className="font-normal">
                    Habilitar Kanban
                  </Label>
                  <Switch
                    id="kanban"
                    checked={habilitarKanban}
                    onCheckedChange={setHabilitarKanban}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="cobranca" className="font-normal">
                    Habilitar Cobrança Diária
                  </Label>
                  <Switch
                    id="cobranca"
                    checked={habilitarCobrancaDiaria}
                    onCheckedChange={setHabilitarCobrancaDiaria}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : editingUser ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
