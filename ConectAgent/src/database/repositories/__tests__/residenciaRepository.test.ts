/**
 * Testes para residenciaRepository
 */
jest.mock('../../../database/database', () => ({
  getDatabase: jest.fn(),
  withTransaction: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import { getDatabase } from '../../../database/database';
import { residenciaRepository } from '../residenciaRepository';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

const mockDb = {
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
  execAsync: jest.fn(),
  withTransactionAsync: jest.fn((cb: () => Promise<void>) => cb()),
};

const residenciaBase = {
  id: 'res-uuid-456',
  agente_id: 'agente-uuid-123',
  cep: '01310100',
  logradouro: 'Avenida Paulista',
  numero: '1000',
  complemento: null,
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  estado: 'SP',
  tipo_imovel: 'proprio',
  num_comodos: 4,
  tem_animais: 0,
  animais_info: null,
  morador_responsavel_id: null,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  sync_status: 'pendente',
  deleted_at: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.runAsync.mockResolvedValue({ changes: 1 });
  mockDb.getFirstAsync.mockResolvedValue(null);
  mockDb.getAllAsync.mockResolvedValue([]);
  mockGetDatabase.mockResolvedValue(mockDb as any);
});

describe('residenciaRepository.criar', () => {
  it('insere residência e retorna o objeto', async () => {
    mockDb.getFirstAsync.mockResolvedValue(residenciaBase);

    const residencia = await residenciaRepository.criar({
      agente_id: 'agente-uuid-123',
      cep: '01310100',
      logradouro: 'Avenida Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      estado: 'SP',
      tipo_imovel: 'proprio',
      num_comodos: 4,
      tem_animais: false,
    });

    expect(mockDb.runAsync).toHaveBeenCalled();
    expect(residencia).toBeDefined();
  });

  it('enfileira na sync_queue ao criar', async () => {
    mockDb.getFirstAsync.mockResolvedValue(residenciaBase);

    await residenciaRepository.criar({
      agente_id: 'agente-uuid-123',
      cep: '01310100',
      logradouro: 'Av. Teste',
      numero: '1',
      bairro: 'Centro',
      cidade: 'SP',
      estado: 'SP',
      tipo_imovel: 'alugado',
      num_comodos: 2,
      tem_animais: false,
    });

    // Deve ter chamado runAsync ao menos 2x: INSERT residencia + INSERT sync_queue
    expect(mockDb.runAsync.mock.calls.length).toBeGreaterThanOrEqual(2);
    const queries = mockDb.runAsync.mock.calls.map(([q]: [string]) => q).join(' ');
    expect(queries).toContain('sync_queue');
  });
});

describe('residenciaRepository.listar', () => {
  it('lista residências do agente', async () => {
    mockDb.getAllAsync.mockResolvedValue([residenciaBase]);

    const residencias = await residenciaRepository.listar('agente-uuid-123');

    expect(residencias).toHaveLength(1);
    expect(residencias[0].id).toBe('res-uuid-456');
  });

  it('retorna lista vazia quando agente sem residências', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    const residencias = await residenciaRepository.listar('agente-sem-residencias');

    expect(residencias).toHaveLength(0);
  });

  it('não retorna residências excluídas (deleted_at IS NULL)', async () => {
    await residenciaRepository.listar('agente-uuid-123');

    const query: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(query).toContain('deleted_at IS NULL');
  });
});

describe('residenciaRepository.buscarPorId', () => {
  it('retorna residência pelo ID', async () => {
    mockDb.getFirstAsync.mockResolvedValue(residenciaBase);

    const residencia = await residenciaRepository.buscarPorId('res-uuid-456');

    expect(residencia).not.toBeNull();
    expect(residencia?.id).toBe('res-uuid-456');
  });

  it('retorna null para ID inexistente', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);

    const residencia = await residenciaRepository.buscarPorId('id-nao-existe');

    expect(residencia).toBeNull();
  });
});

describe('residenciaRepository.atualizar', () => {
  it('atualiza campos fornecidos', async () => {
    // atualizar retorna void — apenas verifica que runAsync foi chamado com UPDATE
    await residenciaRepository.atualizar('res-uuid-456', { numero: '2000' }, 'agente-uuid-123');

    expect(mockDb.runAsync).toHaveBeenCalled();
    const query: string = mockDb.runAsync.mock.calls[0][0];
    expect(query.toLowerCase()).toContain('update residencias');
  });
});

describe('residenciaRepository.excluir', () => {
  it('realiza soft-delete (define deleted_at)', async () => {
    await residenciaRepository.excluir('res-uuid-456');

    expect(mockDb.runAsync).toHaveBeenCalled();
    const query: string = mockDb.runAsync.mock.calls[0][0];
    expect(query.toLowerCase()).toContain('deleted_at');
  });
});

describe('residenciaRepository.buscarPorCep', () => {
  it('retorna residências com o CEP informado', async () => {
    mockDb.getAllAsync.mockResolvedValue([residenciaBase]);

    const residencias = await residenciaRepository.buscarPorCep('01310100', 'agente-uuid-123');

    expect(residencias).toHaveLength(1);
  });
});
