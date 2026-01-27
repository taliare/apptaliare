import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ASSIGNABLE_MENUS, type MenuKey } from '@/lib/menuPermissions';

export function useMenuPermissions() {
  const { profile, user } = useAuth();

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['menu-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_menu_permissions')
        .select('menu_key')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error loading menu permissions:', error);
        return [];
      }
      
      return data?.map(p => p.menu_key) || [];
    },
    enabled: !!user?.id && profile?.role !== 'admin',
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const hasMenuAccess = useCallback((menuKeyOrRoute: string) => {
    // Admin tem acesso a tudo
    if (profile?.role === 'admin') return true;
    
    // Verificar se é uma rota e converter para key
    const menuDef = ASSIGNABLE_MENUS.find(
      m => m.route === menuKeyOrRoute || m.key === menuKeyOrRoute
    );
    
    if (!menuDef) return false;
    
    return permissions.includes(menuDef.key);
  }, [profile?.role, permissions]);

  const hasRouteAccess = useCallback((route: string) => {
    // Admin tem acesso a tudo
    if (profile?.role === 'admin') return true;
    
    // Buscar o menu pela rota
    const menuDef = ASSIGNABLE_MENUS.find(m => m.route === route);
    
    // Se não é um menu atribuível (ex: dashboard padrão), permite acesso
    if (!menuDef) return true;
    
    return permissions.includes(menuDef.key);
  }, [profile?.role, permissions]);

  return { 
    permissions, 
    hasMenuAccess, 
    hasRouteAccess,
    isLoading,
    assignableMenus: ASSIGNABLE_MENUS
  };
}
