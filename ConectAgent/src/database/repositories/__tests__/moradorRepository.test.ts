/**
 * Testes para moradorRepository
 */
jest.mock('../../../database/database', () => ({
  getDatabase: jest.fn(),
  withTransaction: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue('chave-teste-base64'),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(32)),
  digestStringAsync: jest.fn().mockResolvedValue('hash'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

import { getDatabase } from '../../../database/database';
import { moradorRepository } from '../moradorRepository';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

const mockDb = {
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
  execAsync: jest.fn(),
  withTransactionAsync: jest.fn((cb: () => Promise<void>) => cb()),
};

const moradorBase = {
  id: 'morador-uuid-123',
  residencia_id: 'res-uuid-456',
  agente_id: 'agente-uuid-123',
  nome: 'Maria Oliveira',
  cpf: '52998224725',
  cartao_sus: '700123456789012',
  telefone: null,
  data_nascimento: '1985-06-20',
  sexo: 'feminino',
  tem_doenca: 0,
  doencas: null,
  beneficio_bolsa_familia: 0,
  tem_convenio: 0,
  toma_medicamento: 0,
  is_responsavel: 1,
  is_hipertenso: 0,
  is_diabetico: 0,
  is_gestante: 0,
  is_domiciliado: 0,
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

describe('moradorRepository.criar', () => {
  it('cria morador e retorna o objeto', async () => {
    mockDb.getFirstAsync.mockResolvedValue(moradorBase);

    const morador = await moradorRepository.criar({
      residencia_id: 'res-uuid-456',
      nome: 'Maria Oliveira',
      data_nascimento: '1985-06-20',
      sexo: 'feminino',
      tem_doenca: false,
      beneficio_bolsa_familia: false,
      tem_convenio: false,
      toma_medicamento: false,
      is_responsavel: true,
    });

    expect(mockDb.runAsync).toHaveBeenCalled();
    expect(morador).toBeDefined();
  });
});

describe('moradorRepository.buscarPorCpf', () => {
  it('retorna morador pelo CPF', async () => {
    mockDb.getFirstAsync.mockResolvedValue(moradorBase);

    const morador = await moradorRepository.buscarPorCpf('52998224725', 'agente-123');

    expect(morador).not.toBeNull();
  });

  it('retorna null quando CPF não encontrado', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);

    const morador = await moradorRepository.buscarPorCpf('00000000000', 'agente-123');

    expect(morador).toBeNull();
  });
});

describe('moradorRepository.buscarPorCartaoSUS', () => {
  it('retorna morador pelo cartão SUS', async () => {
    mockDb.getFirstAsync.mockResolvedValue(moradorBase);

    const morador = await moradorRepository.buscarPorCartaoSUS('700123456789012', 'agente-123');

    expect(morador).not.toBeNull();
  });

  it('retorna null quando SUS não encontrado', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);

    const morador = await moradorRepository.buscarPorCartaoSUS('999999999999999', 'agente-123');

    expect(morador).toBeNull();
  });
});

describe('moradorRepository.buscarPorNome', () => {
  it('retorna lista de moradores pelo nome', async () => {
    mockDb.getAllAsync.mockResolvedValue([moradorBase]);

    const moradores = await moradorRepository.buscarPorNome('Maria', 'agente-123');

    expect(moradores).toHaveLength(1);
    expect(moradores[0].nome).toBe('Maria Oliveira');
  });

  it('retorna lista vazia quando não encontrado', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    const moradores = await moradorRepository.buscarPorNome('Xablau', 'agente-123');

    expect(moradores).toHaveLength(0);
  });
});

describe('moradorRepository.excluir', () => {
  it('anonimiza o morador ao excluir (LGPD)', async () => {
    await moradorRepository.excluir('morador-uuid-123');

    expect(mockDb.runAsync).toHaveBeenCalled();
    const allCalls = mockDb.runAsync.mock.calls.flat().join(' ');
    expect(allCalls).toContain('ANONIMIZADO');
  });
});

describe('moradorRepository.contar', () => {
  it('retorna quantidade de moradores do agente', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ count: 42 });

    const count = await moradorRepository.contar('agente-123');

    expect(count).toBe(42);
  });

  it('retorna 0 quando não há moradores', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ count: 0 });

    const count = await moradorRepository.contar('agente-sem-moradores');

    expect(count).toBe(0);
  });
});
