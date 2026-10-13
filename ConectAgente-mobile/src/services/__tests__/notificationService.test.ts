/**
 * Testes do lembrete de visita.
 *
 * Três coisas aqui existem por causa de mudança de API do SDK 54, e todas as
 * três compilam erradas: o tipo não acusa nenhuma.
 *
 * **O gatilho exige `type`.** Passar só `{ date }` é aceito pelo compilador,
 * porque o tipo do gatilho é uma união, e falha em tempo de execução.
 *
 * **`shouldShowAlert` virou `shouldShowBanner` e `shouldShowList`.** O campo
 * antigo continua existindo, marcado como obsoleto, então o aviso some do
 * banner sem erro nenhum.
 *
 * E uma de privacidade: a notificação aparece na tela bloqueada, à vista de
 * quem estiver por perto. O corpo dela leva endereço, nunca nome de paciente
 * nem condição de saúde.
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import {
  ANTECEDENCIA_MINUTOS,
  agendarLembreteVisita,
  cancelarLembrete,
  limparLembretes,
  solicitarPermissaoNotificacoes,
} from '../notificationService';

const comoMock = <T,>(f: T) => f as unknown as jest.Mock;

const DAQUI_A_DUAS_HORAS = () => new Date(Date.now() + 2 * 60 * 60 * 1000);

/**
 * O manipulador que o módulo registrou ao ser importado.
 *
 * Capturado aqui, e não dentro do caso: `setNotificationHandler` acontece uma
 * vez só, no carregamento, e o `jest.clearAllMocks()` do `beforeEach` apaga o
 * registro dessa chamada.
 */
const HANDLER = comoMock(Notifications.setNotificationHandler).mock.calls[0][0];

beforeEach(() => {
  jest.clearAllMocks();
  (Device as { isDevice: boolean }).isDevice = true;
  comoMock(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'granted' });
  comoMock(Notifications.scheduleNotificationAsync).mockResolvedValue('id-do-lembrete');
});

describe('permissão', () => {
  it('não pede em emulador, porque ali a notificação não chega', () => {
    (Device as { isDevice: boolean }).isDevice = false;

    return solicitarPermissaoNotificacoes().then((pode) => {
      expect(pode).toBe(false);
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });
  });

  it('não pede de novo quando já foi concedida', async () => {
    expect(await solicitarPermissaoNotificacoes()).toBe(true);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('pede quando ainda não há', async () => {
    comoMock(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'undetermined' });
    comoMock(Notifications.requestPermissionsAsync).mockResolvedValue({ status: 'granted' });

    expect(await solicitarPermissaoNotificacoes()).toBe(true);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});

describe('agendar', () => {
  it('dispara meia hora antes da visita', async () => {
    const visita = DAQUI_A_DUAS_HORAS();
    await agendarLembreteVisita({ visitaId: 'v1', endereco: 'Rua Um, 10', quando: visita });

    const { trigger } = comoMock(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    const diferencaEmMinutos = (visita.getTime() - trigger.date.getTime()) / 60000;

    expect(diferencaEmMinutos).toBe(ANTECEDENCIA_MINUTOS);
    expect(ANTECEDENCIA_MINUTOS).toBe(30);
  });

  it('o gatilho leva o `type`, que o SDK 54 passou a exigir', async () => {
    await agendarLembreteVisita({
      visitaId: 'v1',
      endereco: 'Rua Um, 10',
      quando: DAQUI_A_DUAS_HORAS(),
    });

    const { trigger } = comoMock(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(trigger.type).toBe(Notifications.SchedulableTriggerInputTypes.DATE);
  });

  it('não agenda no passado', async () => {
    // Visita marcada para daqui a dez minutos: o lembrete cairia dez minutos
    // atrás. Agendar no passado dispara na hora e assusta sem motivo.
    const logo = new Date(Date.now() + 10 * 60 * 1000);
    expect(
      await agendarLembreteVisita({ visitaId: 'v1', endereco: 'Rua Um, 10', quando: logo })
    ).toBeNull();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('devolve null sem permissão, em vez de lançar', async () => {
    // Agendar o aviso é melhoria da agenda, não a agenda. Lançar aqui faria a
    // tela dizer que a visita não foi agendada depois de ela ter sido.
    comoMock(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'denied' });
    comoMock(Notifications.requestPermissionsAsync).mockResolvedValue({ status: 'denied' });

    expect(
      await agendarLembreteVisita({
        visitaId: 'v1',
        endereco: 'Rua Um, 10',
        quando: DAQUI_A_DUAS_HORAS(),
      })
    ).toBeNull();
  });

  it('devolve null quando o agendamento falha, em vez de lançar', async () => {
    comoMock(Notifications.scheduleNotificationAsync).mockRejectedValue(new Error('x'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(
      await agendarLembreteVisita({
        visitaId: 'v1',
        endereco: 'Rua Um, 10',
        quando: DAQUI_A_DUAS_HORAS(),
      })
    ).toBeNull();
  });

  it('devolve o identificador, para dar para cancelar depois', async () => {
    expect(
      await agendarLembreteVisita({
        visitaId: 'v1',
        endereco: 'Rua Um, 10',
        quando: DAQUI_A_DUAS_HORAS(),
      })
    ).toBe('id-do-lembrete');
  });
});

describe('o que a notificação mostra na tela bloqueada', () => {
  it('leva endereço e identificador, e nada de pessoal', async () => {
    await agendarLembreteVisita({
      visitaId: 'v1',
      endereco: 'Avenida Duque de Caxias, 250',
      quando: DAQUI_A_DUAS_HORAS(),
    });

    const { content } = comoMock(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    const tudo = JSON.stringify(content).toLowerCase();

    expect(content.body).toContain('Avenida Duque de Caxias, 250');
    expect(content.data).toEqual({ visitaId: 'v1' });

    for (const sensivel of ['cpf', 'sus', 'hipertens', 'diabet', 'gestante', 'nome']) {
      expect(tudo).not.toContain(sensivel);
    }
  });
});

describe('o manipulador de exibição', () => {
  it('usa os campos novos, e não o `shouldShowAlert` obsoleto', async () => {
    const comportamento = await HANDLER.handleNotification();

    expect(comportamento.shouldShowBanner).toBe(true);
    expect(comportamento.shouldShowList).toBe(true);
    expect(comportamento).not.toHaveProperty('shouldShowAlert');
  });
});

describe('cancelar', () => {
  it('cancela um lembrete pelo identificador', async () => {
    await cancelarLembrete('id-do-lembrete');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('id-do-lembrete');
  });

  it('não lança ao cancelar o que já disparou', async () => {
    comoMock(Notifications.cancelScheduledNotificationAsync).mockRejectedValue(new Error('x'));
    await expect(cancelarLembrete('sumiu')).resolves.toBeUndefined();
  });

  it('limpa todos, para um agente não receber aviso do anterior', async () => {
    await limparLembretes();
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  });
});
