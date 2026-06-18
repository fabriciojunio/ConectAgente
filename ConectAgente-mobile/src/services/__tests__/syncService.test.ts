/**
 * Testes para syncService (com Supabase)
 */
jest.mock('../../database/repositories/syncQueueRepository', () => ({
  syncQueueRepository: {
    listarPendentes: jest.fn(),
    marcarSucesso: jest.fn(),
    marcarErro: jest.fn(),
    contarPendentes: jest.fn(),
    limparSincronizados: jest.fn(),
  },
}));

jest.mock('../../database/repositories/residenciaRepository', () => ({
  residenciaRepository: { marcarComoSincronizado: jest.fn() },
}));

jest.mock('../../database/repositories/moradorRepository', () => ({
  moradorRepository: { marcarComoSincronizado: jest.fn() },
}));

jest.mock('../../database/repositories/visitaRepository', () => ({
  visitaRepository: { marcarComoSincronizado: jest.fn() },
}));

// Mock do Supabase
const mockSupabaseUpsert = jest.fn().mockResolvedValue({ error: null });
const mockSupabaseUpdate = jest.fn().mockResolvedValue({ error: null });
const mockSupabaseDelete = jest.fn().mockResolvedValue({ error: null });
const mockSupabaseEq = jest.fn().mockReturnThis();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: mockSupabaseUpsert,
      update: jest.fn(() => ({ eq: mockSupabaseEq })),
    })),
  },
  handleSupabaseError: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { syncQueueRepository } from '../../database/repositories/syncQueueRepository';
import { syncService } from '../syncService';

const mockedQueue = syncQueueRepository as jest.Mocked<typeof syncQueueRepository>;

const itemSyncBase = {
  id: 'sync-001',
  tabela: 'residencias',
  operacao: 'insert' as const,
  registro_id: 'res-uuid-456',
  payload: JSON.stringify({ id: 'res-uuid-456', logradouro: 'Rua X' }),
  tentativas: 0,
  status: 'pendente' as const,
  created_at: '2024-03-15T10:00:00.000Z',
  updated_at: '2024-03-15T10:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedQueue.marcarSucesso.mockResolvedValue(undefined);
  mockedQueue.marcarErro.mockResolvedValue(undefined);
  mockedQueue.limparSincronizados.mockResolvedValue(undefined);
  mockSupabaseUpsert.mockResolvedValue({ error: null });
});

describe('syncService.contarPendentes', () => {
  it('retorna contagem de itens pendentes', async () => {
    mockedQueue.contarPendentes.mockResolvedValue(5);

    const count = await syncService.contarPendentes();

    expect(count).toBe(5);
  });

  it('retorna 0 quando não há pendentes', async () => {
    mockedQueue.contarPendentes.mockResolvedValue(0);

    const count = await syncService.contarPendentes();

    expect(count).toBe(0);
  });
});

describe('syncService.sincronizar', () => {
  it('não processa quando fila está vazia', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([]);

    await syncService.sincronizar();

    expect(mockSupabaseUpsert).not.toHaveBeenCalled();
  });

  it('processa INSERT usando Supabase upsert', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([itemSyncBase]);

    await syncService.sincronizar();

    expect(mockSupabaseUpsert).toHaveBeenCalled();
    expect(mockedQueue.marcarSucesso).toHaveBeenCalledWith('sync-001');
  });

  it('marca erro quando Supabase falha', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([itemSyncBase]);
    mockSupabaseUpsert.mockResolvedValueOnce({ error: { message: 'Conexão recusada' } });

    await syncService.sincronizar();

    expect(mockedQueue.marcarErro).toHaveBeenCalledWith('sync-001', 'Conexão recusada');
    expect(mockedQueue.marcarSucesso).not.toHaveBeenCalled();
  });

  it('processa múltiplos itens', async () => {
    const itens = [
      { ...itemSyncBase, id: 'sync-a', registro_id: 'res-a' },
      { ...itemSyncBase, id: 'sync-b', registro_id: 'res-b', tabela: 'moradores' },
    ];
    mockedQueue.listarPendentes.mockResolvedValue(itens);

    await syncService.sincronizar();

    expect(mockSupabaseUpsert).toHaveBeenCalledTimes(2);
    expect(mockedQueue.marcarSucesso).toHaveBeenCalledTimes(2);
  });
});
