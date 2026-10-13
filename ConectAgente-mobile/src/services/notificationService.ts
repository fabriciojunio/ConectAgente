/**
 * Lembrete de visita agendada.
 *
 * O agente marca a visita na agenda e o aparelho avisa meia hora antes. Sem
 * isso, a agenda só serve para quem abre o aplicativo para conferir, que é
 * justamente quem já lembrou.
 *
 * Não funciona no Expo Go, e isso deixou de ser um problema: o projeto passou
 * a ser distribuído só como APK de release, em 13/10/2026.
 *
 * O que mudou na API do SDK 54, e passaria batido:
 *
 * `shouldShowAlert` foi substituído por `shouldShowBanner` e `shouldShowList`.
 * O campo antigo ainda existe, marcado como obsoleto, então o código compila e
 * a notificação some do banner sem erro nenhum.
 *
 * O gatilho agora exige `type`. Passar só `{ date }` compila, porque o tipo é
 * uma união, e o agendamento falha em tempo de execução.
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

/** Meia hora antes, que é o tempo de o agente se deslocar. */
export const ANTECEDENCIA_MINUTOS = 30;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Pede a permissão, se ainda não houver.
 *
 * Devolve `false` em emulador: `Device.isDevice` é falso ali, e o sistema não
 * entrega notificação. Melhor dizer que não dá do que agendar no vazio.
 */
export async function solicitarPermissaoNotificacoes(): Promise<boolean> {
  if (!Device.isDevice) return false;

  const { status: atual } = await Notifications.getPermissionsAsync();
  if (atual === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Agenda o lembrete e devolve o identificador, para dar para cancelar depois.
 *
 * Devolve `null` em vez de lançar quando não há permissão ou quando a data já
 * passou. Agendar lembrete é melhoria da agenda, não a agenda: falhar aqui não
 * pode impedir o agente de marcar a visita.
 */
export async function agendarLembreteVisita(params: {
  visitaId: string;
  endereco: string;
  quando: Date;
}): Promise<string | null> {
  if (!(await solicitarPermissaoNotificacoes())) return null;

  const disparo = new Date(params.quando.getTime() - ANTECEDENCIA_MINUTOS * 60 * 1000);
  if (disparo.getTime() <= Date.now()) return null;

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Visita agendada',
        body: `Daqui a ${ANTECEDENCIA_MINUTOS} minutos: ${params.endereco}`,
        // Só o identificador, nunca nome ou dado de saúde: a notificação
        // aparece na tela bloqueada, à vista de quem estiver por perto.
        data: { visitaId: params.visitaId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: disparo,
      },
    });
  } catch (erro) {
    console.warn('Não foi possível agendar o lembrete:', erro);
    return null;
  }
}

/** Cancela um lembrete. Silencioso: cancelar o que já disparou não é erro. */
export async function cancelarLembrete(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Nada a fazer.
  }
}

/** Apaga todos os lembretes. Usado no logout, para o aparelho não avisar de
 *  visita de um agente para o próximo que entrar. */
export async function limparLembretes(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Nada a fazer.
  }
}
