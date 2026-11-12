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
    redefinirSenhaComCodigo: jest.fn(),
    gerarCodigoRecuperacao: jest.fn(),
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
const mockUpdateUser = jest.fn().mockResolvedValue({ error: null });

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      signOut: () => mockSignOut(),
      getSession: () => mockGetSession(),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
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
import { authService, AVISO_SENHA_DO_SERVIDOR } from '../authService';

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

  it('abre sessao no servidor com o e-mail que a aprovação criou, e não com o do cadastro local', async () => {
    // A conta do servidor nasce na aprovação do painel como <cpf>@conectagente.local.
    // Entrar com o e-mail do cadastro do celular (joao@ubs.gov.br) dava
    // "Invalid login credentials" mesmo com a senha certa.
    mockedAgenteRepo.autenticar.mockResolvedValue(agenteBase);

    await authService.login('52998224725', 'senha123');

    expect(mockSignIn).toHaveBeenCalledWith({
      email: '52998224725@conectagente.local',
      password: 'senha123',
    });
  });

  it('servidor recusando a conta devolve aviso para o agente', async () => {
    mockSignIn.mockResolvedValueOnce({ data: {}, error: { message: 'Invalid login credentials' } });
    mockedAgenteRepo.autenticar.mockResolvedValue(agenteBase);

    const sessao = await authService.login('52998224725', 'senha123');

    expect(sessao.aviso).toMatch(/O servidor não reconheceu sua conta/);
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

describe('authService - senha trocada pela recuperação', () => {
  // A recuperação troca a senha no aparelho. A conta do servidor usa e-mail
  // interno, sem "esqueci a senha" de lá. Se o servidor ficasse com a senha
  // antiga sem ninguém saber, a sincronização pararia calada.
  const CHAVE_PENDENTE = `conectagente_senha_servidor_pendente_${agenteBase.id}`;

  beforeEach(() => {
    mockedAgenteRepo.redefinirSenhaComCodigo.mockResolvedValue('NOVO-CODI-GO23');
    mockedAgenteRepo.buscarPorCpf.mockResolvedValue(agenteBase);
  });

  it('troca a senha no servidor quando a sessão aberta é da mesma pessoa', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { email: '52998224725@conectagente.local' } } },
    });

    const r = await authService.recuperarSenha('52998224725', 'ABCD-EFGH-JKLM', 'Nova@1234');

    expect(r).toEqual({ codigo: 'NOVO-CODI-GO23', servidorAtualizado: true });
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'Nova@1234' });
    expect(mockedSecureStore.setItemAsync).not.toHaveBeenCalledWith(CHAVE_PENDENTE, expect.anything());
  });

  it('não usa a sessão de outra pessoa para trocar a senha', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { email: 'outra@ubs.gov.br' } } },
    });

    const r = await authService.recuperarSenha('52998224725', 'ABCD-EFGH-JKLM', 'Nova@1234');

    expect(r?.servidorAtualizado).toBe(false);
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(CHAVE_PENDENTE, expect.any(String));
  });

  it('sem sessão, marca a pendência', async () => {
    const r = await authService.recuperarSenha('52998224725', 'ABCD-EFGH-JKLM', 'Nova@1234');

    expect(r?.servidorAtualizado).toBe(false);
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(CHAVE_PENDENTE, expect.any(String));
  });

  it('código errado não toca no servidor', async () => {
    mockedAgenteRepo.redefinirSenhaComCodigo.mockResolvedValue(null);

    expect(await authService.recuperarSenha('52998224725', 'XXXX', 'Nova@1234')).toBeNull();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('administrador do aparelho não tem conta no servidor e não fica pendente', async () => {
    mockedAgenteRepo.buscarPorCpf.mockResolvedValue({ ...agenteBase, is_admin: true });

    const r = await authService.recuperarSenha('11144477735', 'ABCD-EFGH-JKLM', 'Nova@1234');

    expect(r?.servidorAtualizado).toBe(true);
    expect(mockedSecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('o login avisa enquanto o servidor recusar a senha nova', async () => {
    mockedAgenteRepo.autenticar.mockResolvedValue(agenteBase);
    mockedSecureStore.getItemAsync.mockImplementation(async (chave: string) =>
      chave === CHAVE_PENDENTE ? '2026-11-10T00:00:00.000Z' : null
    );
    mockSignIn.mockResolvedValueOnce({ data: {}, error: { message: 'Invalid login credentials' } });

    const sessao = await authService.login('52998224725', 'Nova@1234');

    expect(sessao.aviso).toBe(AVISO_SENHA_DO_SERVIDOR);
  });

  it('o aviso some quando a coordenação redefine a senha no painel', async () => {
    mockedAgenteRepo.autenticar.mockResolvedValue(agenteBase);
    mockedSecureStore.getItemAsync.mockImplementation(async (chave: string) =>
      chave === CHAVE_PENDENTE ? '2026-11-10T00:00:00.000Z' : null
    );

    const sessao = await authService.login('52998224725', 'Nova@1234');

    expect(sessao.aviso).toBeUndefined();
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith(CHAVE_PENDENTE);
  });

  it('login comum não traz aviso', async () => {
    mockedAgenteRepo.autenticar.mockResolvedValue(agenteBase);

    expect((await authService.login('52998224725', 'senha123')).aviso).toBeUndefined();
  });
});

describe('authService - fila depois do login', () => {
  it('com a sessão aberta, o que desistiu volta para a fila', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { syncQueueRepository } = require('../../database/repositories/syncQueueRepository');
    const reabrir = jest.spyOn(syncQueueRepository, 'reabrirComErro').mockResolvedValue(3);
    mockedAgenteRepo.autenticar.mockResolvedValue(agenteBase);

    await authService.login('52998224725', 'senha123');

    expect(reabrir).toHaveBeenCalled();
  });

  it('sem sessão, não mexe na fila', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { syncQueueRepository } = require('../../database/repositories/syncQueueRepository');
    const reabrir = jest.spyOn(syncQueueRepository, 'reabrirComErro').mockResolvedValue(0);
    mockSignIn.mockResolvedValueOnce({ data: {}, error: { message: 'Invalid login credentials' } });
    mockedAgenteRepo.autenticar.mockResolvedValue(agenteBase);

    await authService.login('52998224725', 'senha123');

    expect(reabrir).not.toHaveBeenCalled();
  });
});

describe('authService - administrador do aparelho', () => {
  it('não tenta abrir sessão no servidor nem avisa conta não reconhecida', async () => {
    mockedAgenteRepo.autenticar.mockResolvedValue({ ...agenteBase, is_admin: true });

    const sessao = await authService.login('11144477735', 'SenhaDoAdmin1');

    expect(mockSignIn).not.toHaveBeenCalled();
    expect(sessao.aviso).toBeUndefined();
  });
});
