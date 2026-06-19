import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  ASSIGNABLE_MENUS,
  ALL_MENUS,
  ALWAYS_ALLOWED_ROUTES,
  getMenuByRoute,
  type MenuKey,
} from '@/lib/menuPermissions';

export function useMenuPermissions() {
  const { profile, user } = useAuth();
  const role = profile?.role;
  const isAdmin = role === 'admin';

  // Permissões do GRUPO (role) — base padrão
  const { data: rolePermissions = [], isLoading: loadingRole } = useQuery({
    queryKey: ['role-menu-permissions', role],
    queryFn: async () => {
      if (!role) return [];
      const { data, error } = await supabase
        .from('role_menu_permissions' as any)
        .select('menu_key')
        .eq('role', role);

      if (error) {
        console.error('Error loading role menu permissions:', error);
        return [];
      }
      return (data as Array<{ menu_key: string }> | null)?.map((p) => p.menu_key) || [];
    },
    enabled: !!role && !isAdmin,
    staleTime: 1000 * 60 * 5,
  });

  // EXTRAS individuais do usuário
  const { data: userExtras = [], isLoading: loadingExtras } = useQuery({
    queryKey: ['user-menu-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_menu_permissions')
        .select('menu_key')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading user menu permissions:', error);
        return [];
      }
      return data?.map((p) => p.menu_key) || [];
    },
    enabled: !!user?.id && !isAdmin,
    staleTime: 1000 * 60 * 5,
  });

  // Permissão efetiva = união (grupo ∪ extras)
  const permissions = useMemo(() => {
    if (isAdmin) return ALL_MENUS.map((m) => m.key);
    return Array.from(new Set([...rolePermissions, ...userExtras]));
  }, [isAdmin, rolePermissions, userExtras]);

  const hasMenuAccess = useCallback(
    (menuKeyOrRoute: string) => {
      if (isAdmin) return true;
      const menu =
        ALL_MENUS.find((m) => m.key === menuKeyOrRoute) ||
        ALL_MENUS.find((m) => m.route === menuKeyOrRoute);
      if (!menu) return false;
      return permissions.includes(menu.key);
    },
    [isAdmin, permissions],
  );

  const hasRouteAccess = useCallback(
    (route: string) => {
      if (isAdmin) return true;
      if (ALWAYS_ALLOWED_ROUTES.includes(route)) return true;
      const menu = getMenuByRoute(route);
      // Rota desconhecida no registro = libera (telas internas como NotFound, etc.)
      if (!menu) return true;
      return permissions.includes(menu.key);
    },
    [isAdmin, permissions],
  );

  return {
    permissions,
    rolePermissions,
    userExtras,
    hasMenuAccess,
    hasRouteAccess,
    isLoading: loadingRole || loadingExtras,
    assignableMenus: ASSIGNABLE_MENUS,
  };
}
