import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function solicitarPermissaoNotificacoes(): Promise<boolean> {
  if (!Device.isDevice) return false;

  const { status: statusExistente } = await Notifications.getPermissionsAsync();
  if (statusExistente === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function agendarLembreteVisita(
  visitaId: string,
  nomeResidencia: string,
  dataVisita: Date
): Promise<string> {
  const temPermissao = await solicitarPermissaoNotificacoes();
  if (!temPermissao) throw new Error('Permissão de notificação negada');

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Lembrete de Visita',
      body: `Visita agendada para ${nomeResidencia}`,
      data: { visitaId },
    },
    trigger: {
      date: new Date(dataVisita.getTime() - 30 * 60 * 1000),
    },
  });

  return id;
}

export async function cancelarLembrete(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
