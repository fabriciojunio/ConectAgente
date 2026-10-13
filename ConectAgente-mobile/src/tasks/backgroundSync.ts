/**
 * Sincronização em segundo plano: sobe a fila mesmo com o aplicativo fechado.
 *
 * Por que isto importa aqui. O agente anda a microárea registrando visita sem
 * sinal, e volta para a unidade onde há rede. Se a sincronização só acontecesse
 * com o aplicativo aberto, o dado ficaria no celular até ele lembrar de abrir.
 * Com a tarefa registrada, o sistema operacional acorda o aplicativo quando há
 * rede e a fila sobe sozinha.
 *
 * Não funciona no Expo Go, e isso deixou de ser um problema: o projeto passou a
 * ser distribuído só como APK de release, em 13/10/2026.
 *
 * Duas coisas que a API mudou e passariam batido:
 *
 * `expo-background-fetch` foi descontinuado em favor de `expo-background-task`.
 * O pacote antigo ainda instala e ainda funciona, o que é pior que falhar,
 * porque ninguém percebe que está em cima de algo que vai sair.
 *
 * **`minimumInterval` agora é em minutos.** Era em segundos no pacote antigo.
 * O código anterior pedia `15 * 60`, que ali queria dizer quinze minutos e aqui
 * significaria quinze horas. O tipo é `number` dos dois lados, então nada
 * acusaria: a sincronização simplesmente quase nunca rodaria.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import * as Network from 'expo-network';
import { syncService } from '../services/syncService';

export const TAREFA_SYNC = 'conectagente-sincronizacao';

/** Quinze minutos, que é o mínimo que o sistema aceita. Em minutos. */
export const INTERVALO_MINUTOS = 15;

/**
 * A definição fica no nível do módulo de propósito.
 *
 * O sistema operacional procura a tarefa pelo nome quando acorda o processo, e
 * nesse momento nenhum componente foi montado. Definir dentro de um componente
 * faria a tarefa existir só enquanto o aplicativo estivesse aberto, que é
 * exatamente o contrário do que ela serve.
 */
TaskManager.defineTask(TAREFA_SYNC, async () => {
  try {
    const rede = await Network.getNetworkStateAsync();
    if (!rede.isConnected || !rede.isInternetReachable) {
      // Sem rede não é falha: é o estado normal do agente em campo. Devolver
      // Failed aqui faria o sistema penalizar o aplicativo e espaçar as
      // próximas execuções.
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const pendentes = await syncService.contarPendentes();
    if (pendentes === 0) return BackgroundTask.BackgroundTaskResult.Success;

    await syncService.sincronizar();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Registra a tarefa no sistema. Chamada uma vez, na abertura do aplicativo.
 *
 * Nunca lança. Em emulador sem suporte, ou com o recurso restrito pelo
 * sistema, a tarefa simplesmente não é registrada, e o aplicativo continua
 * sincronizando quando está aberto. Deixar isso derrubar a abertura seria
 * trocar um recurso a mais por um aplicativo que não abre.
 */
export async function registrarSincronizacaoEmSegundoPlano(): Promise<boolean> {
  try {
    const estado = await BackgroundTask.getStatusAsync();
    if (estado === BackgroundTask.BackgroundTaskStatus.Restricted) return false;

    if (await TaskManager.isTaskRegisteredAsync(TAREFA_SYNC)) return true;

    await BackgroundTask.registerTaskAsync(TAREFA_SYNC, {
      minimumInterval: INTERVALO_MINUTOS,
    });
    return true;
  } catch (erro) {
    console.warn('Sincronização em segundo plano não foi registrada:', erro);
    return false;
  }
}

/** Desfaz o registro. Usado no logout, para o aparelho parar de acordar. */
export async function pararSincronizacaoEmSegundoPlano(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TAREFA_SYNC)) {
      await BackgroundTask.unregisterTaskAsync(TAREFA_SYNC);
    }
  } catch {
    // Nada a fazer: se não deu para desregistrar, a tarefa seguinte vai
    // encontrar a fila vazia e não ter o que subir.
  }
}
