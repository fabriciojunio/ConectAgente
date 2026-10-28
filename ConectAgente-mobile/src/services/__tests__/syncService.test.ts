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
const mockSupabaseEq = jest.fn().mockResolvedValue({ error: null });
const mockSupabaseInsert = jest.fn().mockResolvedValue({ error: null });
const mockSupabaseUpdateComEq = jest.fn(() => ({ eq: mockSupabaseEq }));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: mockSupabaseUpsert,
      insert: mockSupabaseInsert,
      update: mockSupabaseUpdateComEq,
    })),
  },
  handleSupabaseError: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// A sincronizacao agora exige sessao no servidor: sem ela o RLS nega toda
// gravacao, e deixar a fila tentar queimaria as cinco tentativas de cada
// item por uma causa que nao tem relacao com o dado.
const mockTemSessao = jest.fn().mockResolvedValue(true);
jest.mock('../authService', () => ({
  authService: {
    temSessaoNoServidor: () => mockTemSessao(),
  },
}));

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
  mockTemSessao.mockResolvedValue(true);
  mockedQueue.marcarSucesso.mockResolvedValue(undefined);
  mockedQueue.marcarErro.mockResolvedValue(undefined);
  mockedQueue.limparSincronizados.mockResolvedValue(undefined);
  mockSupabaseUpsert.mockResolvedValue({ error: null });
  mockSupabaseInsert.mockResolvedValue({ error: null });
  mockSupabaseEq.mockResolvedValue({ error: null });
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

    expect(mockSupabaseUpsert).toHaveBeenCalledTimes(1);
    expect(mockSupabaseInsert).toHaveBeenCalledTimes(1);
    expect(mockedQueue.marcarSucesso).toHaveBeenCalledTimes(2);
  });
});

// O servidor fecha a leitura de cpf, cartão do SUS, doença e medicação, e o
// Postgres recusa upsert que atualize coluna que o usuário não pode ler.
describe('syncService.sincronizar - morador sem upsert', () => {
  const itemMorador = {
    ...itemSyncBase,
    id: 'sync-m',
    tabela: 'moradores',
    registro_id: 'mor-1',
    payload: JSON.stringify({ nome: 'Dados simulados', cpf: '11144477735' }),
  };

  it('insere o morador novo sem usar upsert', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([itemMorador]);

    await syncService.sincronizar();

    expect(mockSupabaseUpsert).not.toHaveBeenCalled();
    expect(mockSupabaseInsert).toHaveBeenCalledWith({ nome: 'Dados simulados', cpf: '11144477735', id: 'mor-1' });
    expect(mockSupabaseUpdateComEq).not.toHaveBeenCalled();
    expect(mockedQueue.marcarSucesso).toHaveBeenCalledWith('sync-m');
  });

  it('na retentativa, chave repetida vira update pelo id', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([itemMorador]);
    mockSupabaseInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } });

    await syncService.sincronizar();

    expect(mockSupabaseUpdateComEq).toHaveBeenCalledWith({ nome: 'Dados simulados', cpf: '11144477735' });
    expect(mockSupabaseEq).toHaveBeenCalledWith('id', 'mor-1');
    expect(mockedQueue.marcarSucesso).toHaveBeenCalledWith('sync-m');
  });

  it('outro erro no insert não vira update e marca erro', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([itemMorador]);
    mockSupabaseInsert.mockResolvedValueOnce({ error: { code: '42501', message: 'permission denied' } });

    await syncService.sincronizar();

    expect(mockSupabaseUpdateComEq).not.toHaveBeenCalled();
    expect(mockedQueue.marcarErro).toHaveBeenCalledWith('sync-m', 'permission denied');
  });

  it('erro no update da retentativa marca erro', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([itemMorador]);
    mockSupabaseInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } });
    mockSupabaseEq.mockResolvedValueOnce({ error: { message: 'Conexão recusada' } });

    await syncService.sincronizar();

    expect(mockedQueue.marcarErro).toHaveBeenCalledWith('sync-m', 'Conexão recusada');
  });
});

describe('syncService.sincronizar - sem sessao no servidor', () => {
  // Sem sessao, `auth.uid()` e nulo e toda policy de RLS nega a gravacao.
  // Medido com o schema e as policies reais num PostgreSQL:
  //   new row violates row-level security policy for table "residencias"
  //
  // O teste importante nao e que falha, e que falha SEM gastar tentativa:
  // a fila marca o item como erro definitivo depois de cinco, e perder a
  // coleta de um dia por falta de login seria o pior resultado possivel.

  it('nao tenta enviar e avisa o motivo', async () => {
    mockTemSessao.mockResolvedValue(false);
    mockedQueue.listarPendentes.mockResolvedValue([itemSyncBase]);

    await expect(syncService.sincronizar()).rejects.toThrow('Sem sessão no servidor');

    expect(mockSupabaseUpsert).not.toHaveBeenCalled();
  });

  it('nao gasta tentativa da fila', async () => {
    mockTemSessao.mockResolvedValue(false);
    mockedQueue.listarPendentes.mockResolvedValue([itemSyncBase]);

    await expect(syncService.sincronizar()).rejects.toThrow();

    expect(mockedQueue.marcarErro).not.toHaveBeenCalled();
    expect(mockedQueue.marcarSucesso).not.toHaveBeenCalled();
  });

  it('nao checa sessao quando a fila esta vazia', async () => {
    // Nao faz sentido exigir login para nao fazer nada, e o aplicativo
    // chama a sincronizacao em intervalo fixo.
    mockedQueue.listarPendentes.mockResolvedValue([]);

    await expect(syncService.sincronizar()).resolves.toBeUndefined();
    expect(mockTemSessao).not.toHaveBeenCalled();
  });
});
