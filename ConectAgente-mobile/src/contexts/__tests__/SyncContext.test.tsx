/**
 * A sincronização não pode ficar presa. No S24 (12/11/2026) uma requisição
 * pendurada deixou o selo em "Sincronizando..." e, como a trava nunca era
 * liberada, nenhuma sincronização automática rodava mais até fechar o app.
 */
import React from 'react';
import { act, renderHook } from '@testing-library/react-native';

jest.mock('../../services/syncService', () => ({
  syncService: { sincronizar: jest.fn(), contarPendentes: jest.fn() },
}));
jest.mock('../../database/repositories/syncQueueRepository', () => ({
  syncQueueRepository: { reabrirComErro: jest.fn().mockResolvedValue(0) },
}));
jest.mock('../NetworkContext', () => ({ useNetwork: () => ({ isOnline: true }) }));

import { syncService } from '../../services/syncService';
import { PRAZO_DA_SINCRONIZACAO_MS, SyncProvider, useSync } from '../SyncContext';

const sincronizar = syncService.sincronizar as jest.Mock;
const contarPendentes = syncService.contarPendentes as jest.Mock;

function montar() {
  const wrapper = ({ children }: { children: React.ReactNode }) => <SyncProvider>{children}</SyncProvider>;
  return renderHook(() => useSync(), { wrapper });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  contarPendentes.mockResolvedValue(1);
});
afterEach(() => jest.useRealTimers());

it('sincronização pendurada é encerrada no prazo, com aviso, e libera a próxima', async () => {
  sincronizar.mockImplementation(() => new Promise(() => undefined));
  const { result } = montar();

  let primeira!: Promise<unknown>;
  await act(async () => {
    primeira = result.current.sincronizarAgora();
  });
  expect(result.current.status.sincronizando).toBe(true);

  await act(async () => {
    jest.advanceTimersByTime(PRAZO_DA_SINCRONIZACAO_MS);
    await primeira;
  });
  expect(result.current.status.sincronizando).toBe(false);
  expect(result.current.status.erro).toMatch(/demorou demais/);

  // A trava foi liberada: uma nova tentativa realmente chama o serviço.
  sincronizar.mockResolvedValue(undefined);
  contarPendentes.mockResolvedValue(0);
  const chamadasAntes = sincronizar.mock.calls.length;
  await act(async () => {
    await result.current.sincronizarAgora();
  });
  expect(sincronizar.mock.calls.length).toBe(chamadasAntes + 1);
  expect(result.current.status.pendentes).toBe(0);
});

it('enquanto uma sincronização roda, outras chamadas não começam outra', async () => {
  let terminar!: () => void;
  sincronizar.mockImplementation(() => new Promise<void>((r) => { terminar = r; }));
  // Ao montar online, o provedor já começa uma sincronização.
  const { result } = montar();

  await act(async () => {
    void result.current.sincronizarAgora();
    void result.current.sincronizarAgora();
  });
  expect(sincronizar).toHaveBeenCalledTimes(1);

  await act(async () => {
    terminar();
  });
});
