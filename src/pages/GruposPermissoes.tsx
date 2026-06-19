import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Shield, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ALL_MENUS,
  CATEGORY_ORDER,
  type MenuCategoryLabel,
  type MenuModule,
} from '@/lib/menuPermissions';

type EditableRole = 'representante' | 'producao' | 'equipe_interna';

const ROLE_COLUMNS: { role: EditableRole; label: string }[] = [
  { role: 'representante',  label: 'Representante' },
  { role: 'producao',       label: 'Produção' },
  { role: 'equipe_interna', label: 'Equipe Interna' },
];

interface RoleMenuRow { role: string; menu_key: string }

export default function GruposPermissoes() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Set<string>>(new Set());

  const { data: matrix = [], isLoading } = useQuery({
    queryKey: ['role-menu-permissions-all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('role_menu_permissions')
        .select('role, menu_key');
      if (error) throw error;
      return (data as RoleMenuRow[]) || [];
    },
  });

  const isAllowed = (role: EditableRole, menuKey: string) =>
    matrix.some((r) => r.role === role && r.menu_key === menuKey);

  const cellId = (role: EditableRole, key: string) => `${role}:${key}`;

  const toggleMutation = useMutation({
    mutationFn: async ({
      role,
      menuKey,
      next,
    }: {
      role: EditableRole;
      menuKey: string;
      next: boolean;
    }) => {
      if (next) {
        const { error } = await (supabase as any)
          .from('role_menu_permissions')
          .insert({ role, menu_key: menuKey });
        if (error && !String(error.message).includes('duplicate')) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('role_menu_permissions')
          .delete()
          .eq('role', role)
          .eq('menu_key', menuKey);
        if (error) throw error;
      }
    },
    onMutate: async ({ role, menuKey, next }) => {
      const id = cellId(role, menuKey);
      setPending((s) => new Set(s).add(id));

      await queryClient.cancelQueries({ queryKey: ['role-menu-permissions-all'] });
      const previous = queryClient.getQueryData<RoleMenuRow[]>([
        'role-menu-permissions-all',
      ]);
      queryClient.setQueryData<RoleMenuRow[]>(
        ['role-menu-permissions-all'],
        (old = []) => {
          if (next) {
            if (old.some((r) => r.role === role && r.menu_key === menuKey)) return old;
            return [...old, { role, menu_key: menuKey }];
          }
          return old.filter((r) => !(r.role === role && r.menu_key === menuKey));
        },
      );
      return { previous };
    },
    onError: (err: any, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['role-menu-permissions-all'], ctx.previous);
      }
      toast.error('Erro ao salvar: ' + (err?.message ?? 'desconhecido'));
    },
    onSuccess: () => {
      toast.success('Permissões atualizadas');
    },
    onSettled: (_d, _e, vars) => {
      const id = cellId(vars.role, vars.menuKey);
      setPending((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['role-menu-permissions-all'] });
      queryClient.invalidateQueries({ queryKey: ['role-menu-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['user-menu-permissions'] });
    },
  });

  const countByRole = (role: EditableRole) =>
    matrix.filter((r) => r.role === role).length;

  // Agrupa módulos por categoria (preservando ordem do registro dentro de cada categoria)
  const modulesByCategory = CATEGORY_ORDER.reduce<Record<string, MenuModule[]>>(
    (acc, cat) => {
      const list = ALL_MENUS.filter((m) => m.category === cat);
      if (list.length) acc[cat] = list;
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" />
          Grupos e Permissões
        </h1>
        <p className="text-muted-foreground mt-1">
          Defina quais módulos cada grupo de usuários enxerga. As alterações são
          salvas automaticamente e aplicadas a todos os usuários do grupo.
        </p>
      </div>

      {/* Resumo dos grupos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {ROLE_COLUMNS.map((c) => (
          <Card key={c.role}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-bold">
                {countByRole(c.role)}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  módulo(s)
                </span>
              </p>
            </CardContent>
          </Card>
        ))}
        <Card className="border-primary/30">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Administrador</p>
            <p className="text-2xl font-bold flex items-center gap-2">
              Total
              <Badge variant="secondary" className="text-xs">acesso fixo</Badge>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Matriz de Permissões</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="text-left p-3 font-medium w-[40%]">Módulo</th>
                  {ROLE_COLUMNS.map((c) => (
                    <th key={c.role} className="text-center p-3 font-medium">
                      {c.label}
                    </th>
                  ))}
                  <th className="text-center p-3 font-medium text-muted-foreground">
                    Admin
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(modulesByCategory).map(([cat, modules]) => (
                  <React.Fragment key={`cat-${cat}`}>
                    <tr key={`cat-${cat}`} className="bg-muted/20">
                      <td
                        colSpan={2 + ROLE_COLUMNS.length}
                        className="p-2 px-3 text-[11px] uppercase tracking-widest text-muted-foreground font-semibold"
                      >
                        {cat}
                      </td>
                    </tr>
                    {modules.map((m) => (
                      <tr key={m.key} className="border-t hover:bg-muted/10">
                        <td className="p-3">
                          <div className="font-medium">{m.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {m.route}
                          </div>
                        </td>
                        {ROLE_COLUMNS.map((c) => {
                          const allowed = isAllowed(c.role, m.key);
                          const id = cellId(c.role, m.key);
                          const isPending = pending.has(id);
                          return (
                            <td key={c.role} className="text-center p-3">
                              <Switch
                                checked={allowed}
                                disabled={isPending}
                                onCheckedChange={(v) =>
                                  toggleMutation.mutate({
                                    role: c.role,
                                    menuKey: m.key,
                                    next: v,
                                  })
                                }
                              />
                            </td>
                          );
                        })}
                        <td className="text-center p-3">
                          <Check className="h-4 w-4 text-success inline-block opacity-50" />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Dica: além do grupo, você pode conceder módulos extras individuais a um
        usuário específico em <strong>Usuários</strong> → editar usuário.
      </p>
    </div>
  );
}
