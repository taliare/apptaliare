import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';

interface PermissionRouteProps {
  children: ReactNode;
  menuKey: string;
}

export function PermissionRoute({ children, menuKey }: PermissionRouteProps) {
  const { profile, loading } = useAuth();
  const { hasMenuAccess, isLoading } = useMenuPermissions();

  // Aguarda carregamento
  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Admin tem acesso total
  if (profile?.role === 'admin') {
    return <>{children}</>;
  }

  // Verifica se tem permissão
  if (hasMenuAccess(menuKey)) {
    return <>{children}</>;
  }

  // Redireciona para dashboard se não tiver permissão
  return <Navigate to="/dashboard" replace />;
}
