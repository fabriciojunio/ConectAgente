/**
 * Testes para authService
 */
jest.mock('../../database/repositories/agenteRepository', () => ({
  agenteRepository: {
    autenticar: jest.fn(),
    buscarPorId: jest.fn(),
    buscarPorCpf: jest.fn(),
    criar: jest.fn(),
    existeAgenteCadastrado: jest.fn(),
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn().mockResolvedValue('hashed-value'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

jest.mock('../api', () => ({
  default: {
    post: jest.fn().mockRejectedValue(new Error('offline')),
    get: jest.fn(),
  },
}));

jest.mock('../../utils/encryption', () => ({
  clearEncryptionKeyCache: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { agenteRepository } from '../../database/repositories/agenteRepository';
import { authService } from '../authService';

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedAgenteRepo = agenteRepository as jest.Mocked<typeof agenteRepository>;

const agenteBase = {
  id: 'agente-uuid-123',
  nome: 'João Silva',
  cpf: '52998224725',
  email: 'joao@ubs.gov.br',
  area_atuacao: 'Área 1',
  unidade_saude: 'UBS Central',
  senha_hash: 'hashed-password',
  ativo: true,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  sync_status: 'pendente' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedSecureStore.setItemAsync.mockResolvedValue(undefined);
  mockedSecureStore.deleteItemAsync.mockResolvedValue(undefined);
  mockedSecureStore.getItemAsync.mockResolvedValue(null);
});

describe('authService.login', () => {
  it('faz login offline quando autenticação local OK', async () => {
    mockedAgenteRepo.autenticar.mockResolvedValue(agenteBase);

    const session = await authService.login('52998224725', 'senha123');

    expect(session).toBeDefined();
    expect(session.agente.id).toBe('agente-uuid-123');
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalled();
  });

  it('lança erro com credenciais inválidas', async () => {
    mockedAgenteRepo.autenticar.mockResolvedValue(null);

    await expect(authService.login('52998224725', 'errada')).rejects.toThrow('CPF ou senha inválidos');
  });
});

describe('authService.verificarSessao', () => {
  it('retorna agente quando sessão válida', async () => {
    const expiry = new Date(Date.now() + 3_600_000).toISOString();
    mockedSecureStore.getItemAsync
      .mockResolvedValueOnce('agente-uuid-123')  // AGENTE_ID
      .mockResolvedValueOnce(expiry);             // SESSION_EXPIRES
    mockedAgenteRepo.buscarPorId.mockResolvedValue(agenteBase);

    const agente = await authService.verificarSessao();

    expect(agente).not.toBeNull();
    expect(agente?.id).toBe('agente-uuid-123');
  });

  it('retorna null quando sessão expirada', async () => {
    const expired = new Date(Date.now() - 1000).toISOString();
    mockedSecureStore.getItemAsync
      .mockResolvedValueOnce('agente-uuid-123')
      .mockResolvedValueOnce(expired);

    const agente = await authService.verificarSessao();

    expect(agente).toBeNull();
  });

  it('retorna null quando não há sessão', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);

    const agente = await authService.verificarSessao();

    expect(agente).toBeNull();
  });
});

describe('authService.logout', () => {
  it('limpa dados de sessão do SecureStore', async () => {
    await authService.logout();

    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalled();
    // Deve deletar ao menos 3 chaves (token, agente_id, session_expires)
    expect(mockedSecureStore.deleteItemAsync.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});

describe('authService.renovarSessao', () => {
  it('estende a expiração da sessão via SecureStore', async () => {
    await authService.renovarSessao();

    expect(mockedSecureStore.setItemAsync).toHaveBeenCalled();
    // Verifica que salvou um timestamp futuro
    const [, valorSalvo] = mockedSecureStore.setItemAsync.mock.calls[0];
    expect(new Date(valorSalvo as string).getTime()).toBeGreaterThan(Date.now());
  });
});
