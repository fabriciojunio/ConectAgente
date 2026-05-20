import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

/**
 * Rota raiz — redireciona para login, app ou painel admin dependendo do estado de autenticação.
 */
export default function Index() {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace(isAdmin ? '/(admin)' : '/(app)');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [isAuthenticated, isLoading, isAdmin]);

  return <LoadingSpinner message="Carregando ConectAgente..." />;
}
