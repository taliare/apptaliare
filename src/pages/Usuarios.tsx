import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
import { UserPlus, Pencil, Key, Trash2, MessageCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ASSIGNABLE_MENUS } from '@/lib/menuPermissions';
import type { Database } from '@/integrations/supabase/types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type AppRole = Database['public']['Enums']['app_role'];

// Extended profile type with role from user_roles table
interface ProfileWithRole extends ProfileRow {
  role: AppRole;
}

// Formatador de WhatsApp
const formatWhatsApp = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

const cleanWhatsApp = (value: string) => value.replace(/\D/g, '');

export default function Usuarios() {
  const { user: currentUser, profile: currentProfile } = useAuth();
  const [profiles, setProfiles] = useState<ProfileWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ProfileWithRole | null>(null);
  const [selectedUser, setSelectedUser] = useState<ProfileWithRole | null>(null);
  
  // Form state
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [role, setRole] = useState<AppRole>('representante');
  const [ativo, setAtivo] = useState(true);
  const [habilitarDashboard, setHabilitarDashboard] = useState(true);
  const [habilitarKanban, setHabilitarKanban] = useState(true);
  const [habilitarCobrancaDiaria, setHabilitarCobrancaDiaria] = useState(true);
  const [senha, setSenha] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    loadProfiles();
  }, []);

  // Função para registrar log de auditoria
  const registrarLog = async (
    action: string,
    targetUserId: string | null,
    details: Record<string, any>
  ) => {
    if (!currentUser?.id) return;
    
    try {
      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        target_user_id: targetUserId,
        action,
        details
      });
    } catch (error) {
      console.error('Erro ao registrar log:', error);
    }
  };

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

  const loadUserPermissions = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_menu_permissions')
      .select('menu_key')
      .eq('user_id', userId);
    
    if (!error && data) {
      setSelectedPermissions(data.map(p => p.menu_key));
    } else {
      setSelectedPermissions([]);
    }
  };

  const openEditDialog = async (user: ProfileWithRole) => {
    setEditingUser(user);
    setNome(user.nome);
    setEmail(user.email || '');
    setWhatsapp(user.whatsapp ? formatWhatsApp(user.whatsapp) : '');
    setRole(user.role);
    setAtivo(user.ativo || false);
    setHabilitarDashboard(user.habilitar_dashboard || false);
    setHabilitarKanban(user.habilitar_kanban || false);
    setHabilitarCobrancaDiaria(user.habilitar_cobranca_diaria || false);
    setSenha('');
    
    // Load permissions for non-admin users
    if (user.role !== 'admin') {
      await loadUserPermissions(user.id);
    } else {
      setSelectedPermissions([]);
    }
    
    setDialogOpen(true);
  };

  const resetForm = () => {
    setNome('');
    setEmail('');
    setWhatsapp('');
    setRole('representante');
    setAtivo(true);
    setHabilitarDashboard(true);
    setHabilitarKanban(true);
    setHabilitarCobrancaDiaria(true);
    setSenha('');
    setSelectedPermissions([]);
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

    // WhatsApp validation (optional but if provided must be valid)
    const cleanedWhatsapp = cleanWhatsApp(whatsapp);
    if (cleanedWhatsapp && (cleanedWhatsapp.length < 10 || cleanedWhatsapp.length > 11)) {
      toast.error('WhatsApp deve ter 10 ou 11 dígitos (DDD + número)');
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

      // Update profile settings (role is handled by trigger, email is set by trigger)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          ativo,
          whatsapp: cleanedWhatsapp || null,
          habilitar_dashboard: habilitarDashboard,
          habilitar_kanban: habilitarKanban,
          habilitar_cobranca_diaria: habilitarCobrancaDiaria,
        })
        .eq('id', signUpData.user.id);

      if (profileError) throw profileError;

      // Save menu permissions for non-admin users
      if (role !== 'admin' && selectedPermissions.length > 0) {
        const { error: permError } = await supabase
          .from('user_menu_permissions')
          .insert(
            selectedPermissions.map(key => ({
              user_id: signUpData.user!.id,
              menu_key: key,
            }))
          );
        
        if (permError) {
          console.error('Erro ao salvar permissões:', permError);
        }
      }

      // Registrar log de auditoria
      await registrarLog('user_created', signUpData.user.id, {
        nome: nome.trim(),
        email: email.trim(),
        role,
        menu_permissions: role !== 'admin' ? selectedPermissions : [],
        admin_nome: currentProfile?.nome
      });

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

    // Validar email se foi fornecido
    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast.error('Por favor, insira um email válido');
        return;
      }

      if (email.length > 255) {
        toast.error('O email deve ter no máximo 255 caracteres');
        return;
      }
    }

    // WhatsApp validation (optional but if provided must be valid)
    const cleanedWhatsapp = cleanWhatsApp(whatsapp);
    if (cleanedWhatsapp && (cleanedWhatsapp.length < 10 || cleanedWhatsapp.length > 11)) {
      toast.error('WhatsApp deve ter 10 ou 11 dígitos (DDD + número)');
      return;
    }

    try {
      setLoading(true);

      // Track changes for audit log
      const changes: Record<string, { old: any; new: any }> = {};
      if (nome.trim() !== editingUser.nome) {
        changes.nome = { old: editingUser.nome, new: nome.trim() };
      }
      if (ativo !== editingUser.ativo) {
        changes.ativo = { old: editingUser.ativo, new: ativo };
      }
      if (cleanedWhatsapp !== (editingUser.whatsapp || '')) {
        changes.whatsapp = { old: editingUser.whatsapp, new: cleanedWhatsapp || null };
      }
      if (role !== editingUser.role) {
        changes.role = { old: editingUser.role, new: role };
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          nome: nome.trim(),
          ativo,
          whatsapp: cleanedWhatsapp || null,
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

      // Update email if changed and provided
      if (email.trim() && email.trim() !== editingUser.email) {
        const { error: emailError } = await supabase.functions.invoke('admin-update-email', {
          body: { userId: editingUser.id, newEmail: email.trim() },
        });

        if (emailError) throw emailError;
        changes.email = { old: editingUser.email, new: email.trim() };
      }

      // Update menu permissions for non-admin users
      if (role !== 'admin') {
        // Delete existing permissions
        await supabase
          .from('user_menu_permissions')
          .delete()
          .eq('user_id', editingUser.id);

        // Insert new permissions
        if (selectedPermissions.length > 0) {
          const { error: permError } = await supabase
            .from('user_menu_permissions')
            .insert(
              selectedPermissions.map(key => ({
                user_id: editingUser.id,
                menu_key: key,
              }))
            );
          
          if (permError) {
            console.error('Erro ao salvar permissões:', permError);
          }
        }
      } else {
        // If changing to admin, remove all menu permissions (admin has full access)
        await supabase
          .from('user_menu_permissions')
          .delete()
          .eq('user_id', editingUser.id);
      }

      // Registrar log de auditoria
      if (Object.keys(changes).length > 0) {
        await registrarLog('user_updated', editingUser.id, {
          usuario_nome: editingUser.nome,
          alteracoes: changes,
          admin_nome: currentProfile?.nome
        });
      }

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
    const targetProfile = profiles.find(p => p.id === userId);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ativo: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      // Registrar log de auditoria
      await registrarLog('user_status_changed', userId, {
        usuario_nome: targetProfile?.nome,
        old_status: currentStatus,
        new_status: !currentStatus,
        admin_nome: currentProfile?.nome
      });

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

  const openPasswordDialog = (user: ProfileWithRole) => {
    setSelectedUser(user);
    setNovaSenha('');
    setPasswordDialogOpen(true);
  };

  const openDeleteDialog = (user: ProfileWithRole) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !novaSenha) {
      toast.error('Digite uma nova senha');
      return;
    }

    if (novaSenha.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres');
      return;
    }

    if (!/[A-Z]/.test(novaSenha)) {
      toast.error('A senha deve conter pelo menos uma letra maiúscula');
      return;
    }

    if (!/[a-z]/.test(novaSenha)) {
      toast.error('A senha deve conter pelo menos uma letra minúscula');
      return;
    }

    if (!/[0-9]/.test(novaSenha)) {
      toast.error('A senha deve conter pelo menos um número');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.functions.invoke('admin-update-password', {
        body: { userId: selectedUser.id, newPassword: novaSenha }
      });

      if (error) throw error;

      // Criar notificação para o usuário
      await supabase.from('notifications').insert({
        user_id: selectedUser.id,
        title: '🔐 Senha Alterada',
        message: 'Sua senha foi redefinida pelo administrador. Use a nova senha para fazer login.',
        type: 'warning',
        link: null
      });

      // Registrar log de auditoria
      await registrarLog('password_reset', selectedUser.id, {
        usuario_nome: selectedUser.nome,
        usuario_email: selectedUser.email,
        admin_nome: currentProfile?.nome,
        motivo: 'Reset administrativo'
      });

      toast.success('Senha alterada e usuário notificado!');
      setPasswordDialogOpen(false);
      setNovaSenha('');
      setSelectedUser(null);
    } catch (error: any) {
      toast.error('Erro ao alterar senha: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);

      // Registrar log ANTES de excluir
      await registrarLog('user_deleted', selectedUser.id, {
        usuario_nome: selectedUser.nome,
        usuario_email: selectedUser.email,
        usuario_role: selectedUser.role,
        admin_nome: currentProfile?.nome
      });

      const { error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: selectedUser.id }
      });

      if (error) throw error;

      toast.success('Usuário excluído com sucesso!');
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      loadProfiles();
    } catch (error: any) {
      toast.error('Erro ao excluir usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getWhatsAppLink = (whatsappNumber: string) => {
    const cleaned = cleanWhatsApp(whatsappNumber);
    return `https://wa.me/55${cleaned}`;
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
                  <TableHead>Email</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{profile.email || '-'}</TableCell>
                    <TableCell>
                      {profile.whatsapp ? (
                        <a
                          href={getWhatsAppLink(profile.whatsapp)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-chart-2 hover:underline"
                        >
                          <MessageCircle className="h-4 w-4" />
                          {formatWhatsApp(profile.whatsapp)}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getRoleName(profile.role)}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={profile.ativo || false}
                        onCheckedChange={() => toggleUserStatus(profile.id, profile.ativo || false)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(profile)}
                          title="Editar usuário"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openPasswordDialog(profile)}
                          title="Alterar senha"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(profile)}
                          title="Excluir usuário"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
                      placeholder="Mínimo 8 caracteres"
                      required
                    />
                  </div>
                </>
              )}

              {editingUser && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe em branco para manter o email atual
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatWhatsApp(e.target.value))}
                  placeholder="(00) 00000-0000"
                  maxLength={16}
                />
              </div>

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

              {/* Menu Permissions - Only show for non-admin users */}
              {role !== 'admin' && (
                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-base font-semibold">Permissões de Menu</Label>
                  <p className="text-xs text-muted-foreground">
                    Selecione os menus que este usuário pode acessar
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
                    {ASSIGNABLE_MENUS.map(menu => (
                      <div key={menu.key} className="flex items-center gap-2">
                        <Checkbox
                          id={`perm-${menu.key}`}
                          checked={selectedPermissions.includes(menu.key)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedPermissions([...selectedPermissions, menu.key]);
                            } else {
                              setSelectedPermissions(selectedPermissions.filter(k => k !== menu.key));
                            }
                          }}
                        />
                        <Label htmlFor={`perm-${menu.key}`} className="text-sm font-normal cursor-pointer">
                          {menu.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

      {/* Dialog de Alteração de Senha */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>
              Digite a nova senha para {selectedUser?.nome}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="novaSenha">Nova Senha *</Label>
              <Input
                id="novaSenha"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
              <p className="text-xs text-muted-foreground">
                A senha deve conter: mínimo 8 caracteres, uma letra maiúscula, uma minúscula e um número
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPasswordDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleChangePassword} disabled={loading}>
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{selectedUser?.nome}</strong>?
              Esta ação não pode ser desfeita e todos os dados relacionados a este usuário serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loading}
            >
              {loading ? 'Excluindo...' : 'Excluir Usuário'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
