import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SyncIndicator } from '../SyncIndicator';
import { MENSAGEM_CONTA_NAO_LIBERADA } from '../../../utils/falhaDeSincronizacao';

const mockSync = { status: { sincronizando: false, pendentes: 19, ultimaSync: null, erro: null as string | null }, sincronizarAgora: jest.fn() };
jest.mock('../../../contexts/SyncContext', () => ({ useSync: () => mockSync }));
jest.mock('../../../contexts/NetworkContext', () => ({ useNetwork: () => ({ isOnline: true }) }));

beforeEach(() => {
  jest.restoreAllMocks();
  mockSync.status.erro = null;
  mockSync.sincronizarAgora.mockReset();
});

type Botao = { text: string; onPress?: () => void };

describe('SyncIndicator', () => {
  it('servidor recusou a conta: o selo diz que parou e explica o que fazer', () => {
    mockSync.status.erro = 'Sem sessão no servidor. Entre novamente para a sincronização voltar.';
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = render(<SyncIndicator />);
    fireEvent.press(getByText('Parada • 19'));
    expect(alerta).toHaveBeenCalledWith('Sincronização parada', MENSAGEM_CONTA_NAO_LIBERADA, expect.any(Array));
  });

  it('sincronizar pelo botão sempre responde, inclusive quando falha', async () => {
    mockSync.sincronizarAgora.mockResolvedValue({ ok: false, erro: 'Invalid login credentials', pendentes: 19 });
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = render(<SyncIndicator />);
    fireEvent.press(getByText('19 pendentes'));
    const botoes = alerta.mock.calls[0][2] as Botao[];
    botoes.find((b) => b.text === 'Sincronizar')?.onPress?.();
    await waitFor(() => expect(alerta).toHaveBeenLastCalledWith('Sincronização parada', MENSAGEM_CONTA_NAO_LIBERADA));
  });

  it('quando tudo sobe, confirma', async () => {
    mockSync.sincronizarAgora.mockResolvedValue({ ok: true, erro: null, pendentes: 0 });
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = render(<SyncIndicator />);
    fireEvent.press(getByText('19 pendentes'));
    (alerta.mock.calls[0][2] as Botao[]).find((b) => b.text === 'Sincronizar')?.onPress?.();
    await waitFor(() => expect(alerta).toHaveBeenLastCalledWith('Tudo enviado', expect.any(String)));
  });
});
