import { ReactNode, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'representante' | 'producao';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (!loading && !hasNavigated.current) {
      if (!user) {
        hasNavigated.current = true;
        navigate('/auth', { replace: true });
      } else if (requiredRole && profile?.role !== requiredRole) {
        hasNavigated.current = true;
        // Redirect based on role
        if (profile?.role === 'admin') {
          navigate('/dashboard-admin', { replace: true });
        } else if (profile?.role === 'producao') {
          navigate('/producao', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }
    }
  }, [user, profile, loading, navigate, requiredRole]);

  // Reset navigation flag when user/profile changes
  useEffect(() => {
    hasNavigated.current = false;
  }, [user?.id, profile?.role]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Keep showing loading state while navigating to prevent DOM removal race condition
  if (!user || (requiredRole && profile?.role !== requiredRole)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
