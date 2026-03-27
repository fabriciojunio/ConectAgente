/**
 * Testes para agenteRepository
 *
 * Cobre: criar, autenticar (rate limiting, timing-safe, migração legado),
 *        buscarPorId, existeAgenteCadastrado, atualizar,
 *        verificarIdentidade, resetarSenha, loginRateStatus
 */

jest.mock('../../../database/database', () => ({
  getDatabase: jest.fn(),
  withTransaction: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(16).fill(0x01)),
  digestStringAsync: jest.fn().mockResolvedValue('hashed-password'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue('0123456789abcdef'.repeat(4)),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as Crypto from 'expo-crypto';
import { getDatabase } from '../../../database/database';
import { agenteRepository, loginRateStatus, _resetLoginAttemptsForTesting } from '../agenteRepository';
import { clearEncryptionKeyCache } from '../../../utils/encryption';

const mockedCrypto = Crypto as jest.Mocked<typeof Crypto>;
const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

const mockDb = {
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
  execAsync: jest.fn(),
  withTransactionAsync: jest.fn((cb: () => Promise<void>) => cb()),
};

const agenteBase = {
  id: 'agente-uuid-123',
  nome: 'João Silva',
  cpf: '52998224725',
  email: 'joao@ubs.gov.br',
  area_atuacao: 'Área 1',
  unidade_saude: 'UBS Central',
  senha_hash: 'aabbccdd$hashed-password',
  telefone: null,
  ativo: 1,
  is_admin: 0,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  clearEncryptionKeyCache();
  _resetLoginAttemptsForTesting();

  // Restaura mock padrão que clearAllMocks pode ter limpado
  mockedCrypto.digestStringAsync.mockResolvedValue('hashed-password');
  mockedCrypto.getRandomBytesAsync.mockResolvedValue(new Uint8Array(16).fill(0x01) as any);

  mockDb.runAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
  mockDb.getFirstAsync.mockResolvedValue(null);
  mockDb.getAllAsync.mockResolvedValue([]);
  mockGetDatabase.mockResolvedValue(mockDb as any);
});

// ─── criar ────────────────────────────────────────────────────

describe('agenteRepository.criar', () => {
  it('cria agente e retorna objeto com os dados corretos', async () => {
    const agente = await agenteRepository.criar({
      nome: 'João Silva',
      cpf: '52998224725',
      email: 'joao@ubs.gov.br',
      area_atuacao: 'Área 1',
      unidade_saude: 'UBS Central',
      senha: 'Senha@2025',
    });

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO agentes'),
      expect.any(Array)
    );
    expect(agente.cpf).toBe('52998224725');
    expect(agente.nome).toBe('João Silva');
    expect(agente.is_admin).toBe(false);
  });

  it('cria agente com is_admin=true quando especificado', async () => {
    const agente = await agenteRepository.criar({
      nome: 'Admin',
      cpf: '11144477735',
      email: 'admin@sistema.br',
      area_atuacao: 'Administração',
      unidade_saude: 'Sistema',
      senha: 'Admin@2025',
      is_admin: true,
    });

    expect(agente.is_admin).toBe(true);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO agentes'),
      expect.arrayContaining([1])
    );
  });
});

// ─── autenticar ───────────────────────────────────────────────

describe('agenteRepository.autenticar', () => {
  it('retorna agente com credenciais corretas (formato novo salt$hash)', async () => {
    mockDb.getFirstAsync.mockResolvedValue(agenteBase);

    const agente = await agenteRepository.autenticar('52998224725', 'senha123');

    expect(agente).not.toBeNull();
    expect(agente?.cpf).toBe('52998224725');
  });

  it('retorna null quando CPF não existe no banco', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);

    const result = await agenteRepository.autenticar('00011122233', 'senha');

    expect(result).toBeNull();
  });

  it('retorna null quando senha é incorreta', async () => {
    // Hash computado diferente do armazenado
    mockedCrypto.digestStringAsync.mockResolvedValueOnce('hash-diferente');
    mockDb.getFirstAsync.mockResolvedValue(agenteBase);

    const result = await agenteRepository.autenticar('52998224725', 'senhaErrada');

    expect(result).toBeNull();
  });

  it('executa verificarSenha mesmo quando usuário não existe (timing-safe)', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);

    await agenteRepository.autenticar('cpf-inexistente', 'qualquerSenha');

    // digestStringAsync deve ter sido chamado (mesmo sem usuário no banco)
    expect(mockedCrypto.digestStringAsync).toHaveBeenCalled();
  });

  it('migra hash legado (sem salt) para formato novo com salt', async () => {
    // senha_hash sem "$" = formato legado
    mockDb.getFirstAsync.mockResolvedValue({
      ...agenteBase,
      senha_hash: 'hashed-password', // legado sem salt
    });
    // digestStringAsync: primeira chamada = verificarSenha legado (retorna match)
    // segunda chamada = hashSenha para gerar novo hash
    mockedCrypto.digestStringAsync
      .mockResolvedValueOnce('hashed-password') // verificarSenha: legacyHash === stored ✓
      .mockResolvedValueOnce('novo-hash');       // hashSenha: novo hash com salt

    await agenteRepository.autenticar('52998224725', 'senha123');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE agentes SET senha_hash'),
      expect.any(Array)
    );
  });
});

// ─── Rate Limiting ────────────────────────────────────────────

describe('agenteRepository — rate limiting', () => {
  const CPF_A = '11122233344';
  const CPF_B = '99988877766';
  const CPF_C = '55566677788';
  const CPF_NOVO = '44455566677';

  beforeEach(() => {
    mockDb.getFirstAsync.mockResolvedValue(null); // CPF inexistente = falha garantida
  });

  it('permite autenticação antes de atingir o limite', async () => {
    for (let i = 0; i < 4; i++) {
      await agenteRepository.autenticar(CPF_A, 'errada');
    }

    const status = loginRateStatus(CPF_A);
    expect(status.locked).toBe(false);
    expect(status.remaining).toBe(1);
  });

  it('bloqueia após 5 falhas consecutivas', async () => {
    for (let i = 0; i < 5; i++) {
      await agenteRepository.autenticar(CPF_B, 'errada');
    }

    await expect(
      agenteRepository.autenticar(CPF_B, 'qualquer')
    ).rejects.toThrow('Conta temporariamente bloqueada');
  });

  it('loginRateStatus retorna locked=true e unlocksAt após bloqueio', async () => {
    for (let i = 0; i < 5; i++) {
      await agenteRepository.autenticar(CPF_C, 'errada');
    }

    const status = loginRateStatus(CPF_C);
    expect(status.locked).toBe(true);
    expect(status.remaining).toBe(0);
    expect(status.unlocksAt).toBeGreaterThan(Date.now());
  });

  it('loginRateStatus retorna remaining=5 para CPF sem histórico', () => {
    const status = loginRateStatus(CPF_NOVO);
    expect(status.locked).toBe(false);
    expect(status.remaining).toBe(5);
  });

  it('limpa falhas após login bem-sucedido', async () => {
    const CPF_OK = '22233344455';
    // 2 falhas
    await agenteRepository.autenticar(CPF_OK, 'errada');
    await agenteRepository.autenticar(CPF_OK, 'errada');

    // Login com sucesso
    mockDb.getFirstAsync.mockResolvedValue(agenteBase);
    await agenteRepository.autenticar(CPF_OK, 'certa');

    // Deve ter resetado o contador
    const status = loginRateStatus(CPF_OK);
    expect(status.remaining).toBe(5);
  });
});

// ─── buscarPorId ──────────────────────────────────────────────

describe('agenteRepository.buscarPorId', () => {
  it('retorna agente pelo ID', async () => {
    mockDb.getFirstAsync.mockResolvedValue(agenteBase);

    const agente = await agenteRepository.buscarPorId('agente-uuid-123');

    expect(agente?.id).toBe('agente-uuid-123');
  });

  it('retorna null para ID inexistente', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);

    expect(await agenteRepository.buscarPorId('nao-existe')).toBeNull();
  });
});

// ─── existeAgenteCadastrado ───────────────────────────────────

describe('agenteRepository.existeAgenteCadastrado', () => {
  it('retorna true quando há agentes não-admin cadastrados', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ count: 2 });

    expect(await agenteRepository.existeAgenteCadastrado()).toBe(true);
  });

  it('retorna false quando não há agentes não-admin', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ count: 0 });

    expect(await agenteRepository.existeAgenteCadastrado()).toBe(false);
  });

  it('filtra apenas is_admin = 0 (admin não conta no fluxo de primeiro acesso)', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ count: 0 });

    await agenteRepository.existeAgenteCadastrado();

    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('is_admin = 0')
    );
  });
});

// ─── atualizar ────────────────────────────────────────────────

describe('agenteRepository.atualizar', () => {
  it('executa UPDATE com os campos fornecidos', async () => {
    await agenteRepository.atualizar('agente-uuid-123', { nome: 'João Atualizado' });

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE agentes'),
      expect.arrayContaining(['João Atualizado'])
    );
  });

  it('não lança erro para atualização parcial (campos undefined → COALESCE)', async () => {
    await expect(
      agenteRepository.atualizar('agente-uuid-123', { email: 'novo@email.com' })
    ).resolves.not.toThrow();
  });
});

// ─── verificarIdentidade ─────────────────────────────────────

describe('agenteRepository.verificarIdentidade', () => {
  it('retorna true quando CPF e email correspondem a um agente ativo', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ count: 1 });

    const resultado = await agenteRepository.verificarIdentidade('52998224725', 'joao@ubs.gov.br');

    expect(resultado).toBe(true);
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('cpf = ?'),
      expect.arrayContaining(['52998224725'])
    );
  });

  it('retorna false quando combinação é inválida', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ count: 0 });

    expect(await agenteRepository.verificarIdentidade('52998224725', 'errado@email.com')).toBe(false);
  });

  it('normaliza o email (lowercase e trim) antes da query', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ count: 1 });

    await agenteRepository.verificarIdentidade('52998224725', ' JOAO@UBS.GOV.BR ');

    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['joao@ubs.gov.br'])
    );
  });
});

// ─── resetarSenha ────────────────────────────────────────────

describe('agenteRepository.resetarSenha', () => {
  it('retorna false e não altera senha quando identidade não é verificada', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ count: 0 });

    const resultado = await agenteRepository.resetarSenha('52998224725', 'errado@email.com', 'novaSenha');

    expect(resultado).toBe(false);
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('atualiza a senha e registra audit_log quando identidade OK', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce(agenteBase);

    const resultado = await agenteRepository.resetarSenha('52998224725', 'joao@ubs.gov.br', 'Novo@2025');

    expect(resultado).toBe(true);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(2); // UPDATE senha + INSERT audit_log
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('RESET_SENHA'),
      expect.any(Array)
    );
  });

  it('retorna true mesmo sem agente no buscarPorCpf (não quebra o fluxo)', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce(null);

    const resultado = await agenteRepository.resetarSenha('52998224725', 'joao@ubs.gov.br', 'Novo@2025');

    expect(resultado).toBe(true);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1); // apenas UPDATE, sem audit_log
  });
});

// ─── garantirAdminPadrao ─────────────────────────────────────

describe('agenteRepository.garantirAdminPadrao', () => {
  it('não cria admin quando já existe', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ count: 1 });

    await agenteRepository.garantirAdminPadrao();

    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('cria admin quando não existe', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ count: 0 });

    await agenteRepository.garantirAdminPadrao();

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO agentes'),
      expect.arrayContaining(['Administrador'])
    );
  });
});
