/**
 * Testes da sincronização em segundo plano.
 *
 * O que estes testes travam, além do óbvio:
 *
 * **O intervalo é em minutos.** No `expo-background-fetch`, que foi
 * descontinuado, `minimumInterval` era em segundos, e o código antigo passava
 * `15 * 60` querendo dizer quinze minutos. No `expo-background-task` o mesmo
 * campo é em minutos, então aquele valor significaria quinze horas. Os dois
 * são `number`, nada acusaria, e a sincronização simplesmente quase nunca
 * rodaria. É o tipo de defeito que só aparece em reclamação de campo.
 *
 * **Sem rede não é falha.** Devolver `Failed` faria o sistema operacional
 * penalizar o aplicativo e espaçar as execuções seguintes. Para um agente que
 * passa o dia sem sinal, isso desligaria o recurso na prática.
 *
 * **Registrar nunca derruba a abertura.** Em emulador, ou com o recurso
 * restrito, a tarefa não entra e o aplicativo continua sincronizando quando
 * está aberto. Trocar um recurso a mais por um aplicativo que não abre seria
 * mau negócio.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import * as Network from 'expo-network';
import {
  INTERVALO_MINUTOS,
  TAREFA_SYNC,
  registrarSincronizacaoEmSegundoPlano,
  pararSincronizacaoEmSegundoPlano,
} from '../backgroundSync';
import { syncService } from '../../services/syncService';

jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn() }));
jest.mock('../../services/syncService', () => ({
  syncService: {
    contarPendentes: jest.fn().mockResolvedValue(0),
    sincronizar: jest.fn().mockResolvedValue(undefined),
  },
}));

const comoMock = <T,>(f: T) => f as unknown as jest.Mock;

/**
 * A função que o TaskManager recebeu no `defineTask`.
 *
 * Capturada aqui, no carregamento do módulo de teste, e não dentro do caso.
 * O `defineTask` acontece uma vez só, quando `backgroundSync` é importado, e o
 * `jest.clearAllMocks()` do `beforeEach` apaga o registro dessa chamada. Buscar
 * depois devolve lista vazia.
 */
const TAREFA: () => Promise<number> =
  comoMock(TaskManager.defineTask).mock.calls[0][1];

beforeEach(() => {
  jest.clearAllMocks();
  comoMock(BackgroundTask.getStatusAsync).mockResolvedValue(
    BackgroundTask.BackgroundTaskStatus.Available
  );
  comoMock(TaskManager.isTaskRegisteredAsync).mockResolvedValue(false);
  comoMock(Network.getNetworkStateAsync).mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  });
});

describe('o intervalo', () => {
  it('é 15, e a unidade é minuto', () => {
    // Quinze minutos é o mínimo que o sistema aceita. Se alguém escrever
    // 15 * 60 aqui, achando que é segundo, vira quinze horas.
    expect(INTERVALO_MINUTOS).toBe(15);
    expect(INTERVALO_MINUTOS).toBeLessThan(60);
  });

  it('é o valor passado no registro', async () => {
    await registrarSincronizacaoEmSegundoPlano();

    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(TAREFA_SYNC, {
      minimumInterval: 15,
    });
  });
});

describe('registrar', () => {
  it('registra quando o sistema permite e a tarefa ainda não existe', async () => {
    expect(await registrarSincronizacaoEmSegundoPlano()).toBe(true);
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledTimes(1);
  });

  it('não registra duas vezes', async () => {
    comoMock(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);

    expect(await registrarSincronizacaoEmSegundoPlano()).toBe(true);
    expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
  });

  it('desiste quando o sistema restringe, sem tentar registrar', async () => {
    comoMock(BackgroundTask.getStatusAsync).mockResolvedValue(
      BackgroundTask.BackgroundTaskStatus.Restricted
    );

    expect(await registrarSincronizacaoEmSegundoPlano()).toBe(false);
    expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
  });

  it('não lança quando o módulo nativo falha', async () => {
    // Acontece em emulador. A abertura do aplicativo não pode depender disto.
    comoMock(BackgroundTask.getStatusAsync).mockRejectedValue(new Error('sem suporte'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(registrarSincronizacaoEmSegundoPlano()).resolves.toBe(false);
  });
});

describe('a tarefa, quando o sistema acorda o aplicativo', () => {
  it('não sincroniza sem rede, e isso não é falha', async () => {
    comoMock(Network.getNetworkStateAsync).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });

    const resultado = await TAREFA();

    expect(resultado).toBe(BackgroundTask.BackgroundTaskResult.Success);
    expect(syncService.sincronizar).not.toHaveBeenCalled();
  });

  it('não sincroniza com rede conectada mas sem internet', async () => {
    // Wi-Fi de unidade de saúde com portal de autenticação é exatamente isto.
    comoMock(Network.getNetworkStateAsync).mockResolvedValue({
      isConnected: true,
      isInternetReachable: false,
    });

    await TAREFA();
    expect(syncService.sincronizar).not.toHaveBeenCalled();
  });

  it('não faz nada quando a fila está vazia', async () => {
    comoMock(syncService.contarPendentes).mockResolvedValue(0);

    const resultado = await TAREFA();

    expect(resultado).toBe(BackgroundTask.BackgroundTaskResult.Success);
    expect(syncService.sincronizar).not.toHaveBeenCalled();
  });

  it('sincroniza quando há rede e fila', async () => {
    comoMock(syncService.contarPendentes).mockResolvedValue(3);

    const resultado = await TAREFA();

    expect(syncService.sincronizar).toHaveBeenCalledTimes(1);
    expect(resultado).toBe(BackgroundTask.BackgroundTaskResult.Success);
  });

  it('devolve Failed quando a sincronização lança', async () => {
    comoMock(syncService.contarPendentes).mockResolvedValue(1);
    comoMock(syncService.sincronizar).mockRejectedValue(new Error('servidor fora'));

    expect(await TAREFA()).toBe(BackgroundTask.BackgroundTaskResult.Failed);
  });
});

describe('parar', () => {
  it('desregistra quando a tarefa existe', async () => {
    comoMock(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);
    await pararSincronizacaoEmSegundoPlano();

    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(TAREFA_SYNC);
  });

  it('não tenta desregistrar o que não existe', async () => {
    await pararSincronizacaoEmSegundoPlano();
    expect(BackgroundTask.unregisterTaskAsync).not.toHaveBeenCalled();
  });

  it('não lança quando o módulo nativo falha', async () => {
    comoMock(TaskManager.isTaskRegisteredAsync).mockRejectedValue(new Error('x'));
    await expect(pararSincronizacaoEmSegundoPlano()).resolves.toBeUndefined();
  });
});

describe('a definição da tarefa', () => {
  it('acontece no nível do módulo, com o nome que o sistema procura', () => {
    // O sistema acorda o processo e procura a tarefa pelo nome, antes de
    // qualquer componente existir. Definir dentro de componente faria a tarefa
    // existir só com o aplicativo aberto, que é o contrário do que ela serve.
    expect(typeof TAREFA).toBe('function');
    expect(TAREFA_SYNC).toBe('conectagente-sincronizacao');
  });
});
