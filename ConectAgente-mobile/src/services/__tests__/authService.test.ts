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

// O login agora abre sessao no Supabase, que e o que permite sincronizar.
// Sem este mock, importar o authService instancia o cliente de verdade.
const mockSignIn = jest.fn().mockResolvedValue({ data: {}, error: null });
const mockSignOut = jest.fn().mockResolvedValue({ error: null });
const mockGetSession = jest.fn().mockResolvedValue({ data: { session: null } });

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      signOut: () => mockSignOut(),
      getSession: () => mockGetSession(),
    },
  },
  supabaseConfigurado: true,
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
  is_admin: false,
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

describe('authService - sessao no servidor', () => {
  // Sem sessao no Supabase, `auth.uid()` e nulo e o RLS nega toda gravacao.
  // Medido com o schema e as policies reais:
  //   sem sessao: new row violates row-level security policy
  //   com sessao: as oito tabelas aceitam
  // Entao abrir a sessao no login nao e enfeite, e o que faz o dado sair do
  // aparelho. Mas nao pode bloquear o login, senao o aplicativo deixa de
  // funcionar offline, que e a razao de ele existir.

  it('abre sessao no servidor usando o email do agente', async () => {
    mockedAgenteRepo.autenticar.mockResolvedValue(agenteBase);

    await authService.login('52998224725', 'senha123');

    expect(mockSignIn).toHaveBeenCalledWith({
      email: agenteBase.email,
      password: 'senha123',
    });
  });

  it('login funciona mesmo quando o servidor recusa', async () => {
    // Agente sem usuario no Supabase Auth, ou aparelho offline.
    mockSignIn.mockResolvedValueOnce({
      data: {},
      error: { message: 'Invalid login credentials' },
    });
    mockedAgenteRepo.autenticar.mockResolvedValue(agenteBase);

    const sessao = await authService.login('52998224725', 'senha123');

    expect(sessao.agente.id).toBe(agenteBase.id);
  });

  it('login funciona quando a rede cai no meio', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('Network request failed'));
    mockedAgenteRepo.autenticar.mockResolvedValue(agenteBase);

    const sessao = await authService.login('52998224725', 'senha123');

    expect(sessao.agente.id).toBe(agenteBase.id);
  });

  it('logout encerra a sessao do servidor', async () => {
    // Sem isto o aparelho ficaria com token valido depois do logout, e quem
    // pegasse o aparelho leria pela API o dado do agente anterior.
    await authService.logout();

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('temSessaoNoServidor reflete o que o cliente responde', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    expect(await authService.temSessaoNoServidor()).toBe(false);

    mockGetSession.mockResolvedValueOnce({ data: { session: { access_token: 'x' } } });
    expect(await authService.temSessaoNoServidor()).toBe(true);
  });

  it('temSessaoNoServidor devolve falso quando o cliente lanca', async () => {
    mockGetSession.mockRejectedValueOnce(new Error('sem rede'));
    expect(await authService.temSessaoNoServidor()).toBe(false);
  });
});
