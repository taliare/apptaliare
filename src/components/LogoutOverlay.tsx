import { useAuth } from '@/contexts/AuthContext';
import { WelcomeOverlay } from '@/components/WelcomeOverlay';

export function LogoutOverlay() {
  const { isLoggingOut, profile } = useAuth();

  return (
    <WelcomeOverlay
      show={isLoggingOut}
      nome={profile?.nome}
      variant="goodbye"
    />
  );
}
