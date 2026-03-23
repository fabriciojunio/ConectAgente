/**
 * Background sync task — roda mesmo com o app fechado.
 *
 * iOS: o sistema operacional decide quando executar (mínimo ~15 min).
 * Android: WorkManager garante execução periódica mesmo após fechar o app.
 *
 * ATENÇÃO: Não funciona no Expo Go. Requer build de desenvolvimento ou produção.
 */
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Network from 'expo-network';
import { syncService } from '../services/syncService';

export const BACKGROUND_SYNC_TASK = 'conectagente-background-sync';

// A definição da task DEVE estar no nível do módulo (fora de qualquer componente).
// É importada antes do app iniciar para garantir que o sistema encontre a task.
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || !networkState.isInternetReachable) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const pendentes = await syncService.contarPendentes();
    if (pendentes === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    await syncService.sincronizar();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Registra a task de background sync com o sistema operacional.
 * Deve ser chamada uma vez ao iniciar o app.
 */
export async function registrarBackgroundSync(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();

    // Se o SO não permite (bloqueado pelo usuário ou restrição do sistema)
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return;
    }

    const jaRegistrado = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (!jaRegistrado) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 15 * 60, // 15 minutos (mínimo aceito pelo iOS e Android)
        stopOnTerminate: false,   // Android: continua rodando após fechar o app
        startOnBoot: true,        // Android: registra novamente após reiniciar o celular
      });
    }
  } catch {
    // Silencioso — ocorre no Expo Go ou em simuladores sem suporte
  }
}
