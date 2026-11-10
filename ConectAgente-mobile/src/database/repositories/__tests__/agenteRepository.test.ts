/**
 * Testes para agenteRepository
 *
 * Cobre: criar, autenticar (rate limiting, timing-safe, migração legado),
 *        buscarPorId, existeAgenteCadastrado, atualizar, loginRateStatus,
 *        código de recuperação e configuração do administrador
 */

// O hash de senha é PBKDF2 de verdade, com as iterações de produção: um login
// custa centenas de milissegundos de propósito. Com a suíte toda rodando em
// paralelo, os 5 segundos padrão do Jest não bastam para os testes que fazem
// vários logins seguidos.
jest.setTimeout(30_000);

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
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// A auditoria tem teste próprio; aqui ela só não pode mexer na contagem de
// chamadas ao banco.
jest.mock('../auditRepository', () => ({
  ...jest.requireActual('../auditRepository'),
  auditRepository: { registrar: jest.fn().mockResolvedValue(true) },
}));

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as encryption from '../../../utils/encryption';
import { _esquecerMemoriaParaTeste } from '../../limiteDeTentativas';
import { SECURE_KEYS } from '../../../utils/constants';
import { getDatabase } from '../../../database/database';
import { auditRepository } from '../auditRepository';
import {
  ADMIN_CPF,
  agenteRepository,
  loginRateStatus,
  _resetLoginAttemptsForTesting,
} from '../agenteRepository';

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

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

/** Espião da comparação de senha, que passa a chamada adiante sem mudar nada. */
const espiaoVerificar = jest.spyOn(encryption, 'verificarSenha');

beforeEach(async () => {
  jest.clearAllMocks();
  await _resetLoginAttemptsForTesting();

  // Restaura mock padrão que clearAllMocks pode ter limpado
  mockedCrypto.digestStringAsync.mockResolvedValue('hashed-password');
  mockedCrypto.getRandomBytesAsync.mockResolvedValue(new Uint8Array(16).fill(0x01) as any);

  mockedSecureStore.getItemAsync.mockResolvedValue(null);
  mockedSecureStore.setItemAsync.mockResolvedValue(undefined);
  mockedSecureStore.deleteItemAsync.mockResolvedValue(undefined);

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

    // Compara contra um hash PBKDF2 com as mesmas iterações de uma conta de
    // verdade, para o tempo não dizer se o CPF existe.
    expect(espiaoVerificar).toHaveBeenCalledWith('qualquerSenha', encryption.HASH_QUE_NUNCA_CONFERE);
  });

  it('regrava no PBKDF2 a senha que estava no SHA-256 com sal', async () => {
    mockDb.getFirstAsync.mockResolvedValue(agenteBase); // 'aabbccdd$hashed-password'

    await agenteRepository.autenticar('52998224725', 'senha123');

    const update = mockDb.runAsync.mock.calls.find(([sql]) => String(sql).includes('UPDATE agentes SET senha_hash'));
    expect(String(update?.[1]?.[0])).toMatch(/^pbkdf2-sha256\$/);
  });

  it('não regrava quem já está no formato atual', async () => {
    const atual = await encryption.hashSenha('Atual@123');
    mockDb.getFirstAsync.mockResolvedValue({ ...agenteBase, senha_hash: atual });

    expect(await agenteRepository.autenticar('52998224725', 'Atual@123')).not.toBeNull();
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('migra hash legado (sem salt) para formato novo com salt', async () => {
    // senha_hash sem "$" = formato legado
    mockDb.getFirstAsync.mockResolvedValue({
      ...agenteBase,
      senha_hash: 'hashed-password', // legado sem salt
    });
    // verificarSenha legado: sha256(senha) === stored. O hash novo é PBKDF2 e
    // não passa por aqui; um segundo valor enfileirado sobraria para o
    // próximo teste.
    mockedCrypto.digestStringAsync.mockResolvedValueOnce('hashed-password');

    await agenteRepository.autenticar('52998224725', 'senha123');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE agentes SET senha_hash'),
      [expect.stringMatching(/^pbkdf2-sha256\$/), expect.any(String), agenteBase.id]
    );
  });

  it('recusa o administrador que ainda não escolheu a senha', async () => {
    // O marcador não é hash; nenhuma senha pode conferir com ele, nem a
    // que por acaso produzisse o mesmo texto no formato legado.
    mockDb.getFirstAsync.mockResolvedValue({ ...agenteBase, senha_hash: 'senha-nao-definida' });
    mockedCrypto.digestStringAsync.mockResolvedValue('senha-nao-definida');

    expect(await agenteRepository.autenticar('52998224725', 'qualquer')).toBeNull();
    // Compara mesmo assim, para o tempo não denunciar o estado da conta.
    expect(espiaoVerificar).toHaveBeenCalledWith('qualquer', encryption.HASH_QUE_NUNCA_CONFERE);
  });
});

// ─── Rate Limiting ────────────────────────────────────────────

describe('agenteRepository: rate limiting', () => {
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

  it('o bloqueio sobrevive a fechar e abrir o aplicativo', async () => {
    // Antes a contagem ficava só na memória: reabrir o aplicativo dava mais
    // cinco tentativas, sem espera.
    const CPF_R = '33344455566';
    for (let i = 0; i < 5; i++) {
      await agenteRepository.autenticar(CPF_R, 'errada');
    }

    _esquecerMemoriaParaTeste(); // como se o processo tivesse reiniciado

    await expect(agenteRepository.autenticar(CPF_R, 'qualquer')).rejects.toThrow(
      'Conta temporariamente bloqueada'
    );
  });

  it('as falhas antes do bloqueio também sobrevivem ao reinício', async () => {
    const CPF_P = '66677788899';
    for (let i = 0; i < 4; i++) {
      await agenteRepository.autenticar(CPF_P, 'errada');
    }
    _esquecerMemoriaParaTeste();

    await agenteRepository.autenticar(CPF_P, 'errada');

    expect(loginRateStatus(CPF_P).locked).toBe(true);
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

// ─── código de recuperação ───────────────────────────────────

const CHAVE_DO_CODIGO = `${SECURE_KEYS.CODIGO_RECUPERACAO}${agenteBase.id}`;
const HASH_DO_CODIGO = 'aabbccdd$hashed-password';

describe('agenteRepository.gerarCodigoRecuperacao', () => {
  it('devolve o código e guarda só o hash, na chave da conta', async () => {
    const codigo = await agenteRepository.gerarCodigoRecuperacao(agenteBase.id);

    expect(codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const [chave, guardado] = mockedSecureStore.setItemAsync.mock.calls[0];
    expect(chave).toBe(CHAVE_DO_CODIGO);
    expect(guardado).toContain('$');
    expect(guardado).not.toContain(codigo);
    expect(guardado).not.toContain(codigo.replace(/-/g, ''));
  });
});

describe('agenteRepository.redefinirSenhaComCodigo', () => {
  function comCodigoGuardado() {
    mockDb.getFirstAsync.mockResolvedValue(agenteBase);
    mockedSecureStore.getItemAsync.mockImplementation(async (chave: string) =>
      chave === CHAVE_DO_CODIGO ? HASH_DO_CODIGO : null
    );
  }

  it('não aceita CPF e e-mail: a troca exige o código', async () => {
    // O defeito que motivou isto: CPF e e-mail do administrador eram
    // públicos e bastavam para trocar a senha dele.
    expect('verificarIdentidade' in agenteRepository).toBe(false);
    expect('resetarSenha' in agenteRepository).toBe(false);
  });

  it('troca a senha com o código certo e devolve um código novo', async () => {
    comCodigoGuardado();

    const novo = await agenteRepository.redefinirSenhaComCodigo('52998224725', 'ABCD-EFGH-JKLM', 'NovaSenha@1');

    expect(novo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE agentes SET senha_hash'),
      expect.arrayContaining([agenteBase.id])
    );
    expect(auditRepository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'RESET_SENHA', agenteId: agenteBase.id })
    );
  });

  it('o código usado é substituído, então não vale de novo', async () => {
    comCodigoGuardado();

    await agenteRepository.redefinirSenhaComCodigo('52998224725', 'ABCD-EFGH-JKLM', 'NovaSenha@1');

    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(CHAVE_DO_CODIGO, expect.any(String));
  });

  it('aceita o código com minúscula, espaço e sem hífen', async () => {
    comCodigoGuardado();

    await agenteRepository.redefinirSenhaComCodigo('52998224725', ' abcd efgh jklm ', 'NovaSenha@1');

    expect(mockedCrypto.digestStringAsync).toHaveBeenCalledWith('SHA-256', 'aabbccddABCDEFGHJKLM');
  });

  it('código errado não troca a senha', async () => {
    comCodigoGuardado();
    mockedCrypto.digestStringAsync.mockResolvedValueOnce('outro-hash');

    expect(await agenteRepository.redefinirSenhaComCodigo('52998224725', 'XXXX-XXXX-XXXX', 'NovaSenha@1')).toBeNull();
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('conta sem código guardado não troca a senha, e compara mesmo assim', async () => {
    mockDb.getFirstAsync.mockResolvedValue(agenteBase);

    expect(await agenteRepository.redefinirSenhaComCodigo('52998224725', 'ABCD-EFGH-JKLM', 'NovaSenha@1')).toBeNull();
    expect(mockDb.runAsync).not.toHaveBeenCalled();
    expect(espiaoVerificar).toHaveBeenCalledWith('ABCDEFGHJKLM', encryption.HASH_QUE_NUNCA_CONFERE);
  });

  it('CPF que não existe devolve o mesmo nulo', async () => {
    expect(await agenteRepository.redefinirSenhaComCodigo('00011122233', 'ABCD-EFGH-JKLM', 'NovaSenha@1')).toBeNull();
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('bloqueia depois de cinco tentativas erradas', async () => {
    comCodigoGuardado();
    mockedCrypto.digestStringAsync.mockResolvedValue('outro-hash');

    for (let i = 0; i < 5; i++) {
      await agenteRepository.redefinirSenhaComCodigo('52998224725', 'XXXX-XXXX-XXXX', 'NovaSenha@1');
    }

    await expect(
      agenteRepository.redefinirSenhaComCodigo('52998224725', 'ABCD-EFGH-JKLM', 'NovaSenha@1')
    ).rejects.toThrow('Muitas tentativas');
  });
});

// ─── administrador do aparelho ───────────────────────────────

describe('agenteRepository.garantirAdminPadrao', () => {
  it('cria o administrador sem senha nenhuma', async () => {
    await agenteRepository.garantirAdminPadrao();

    const [sql, parametros] = mockDb.runAsync.mock.calls[0];
    expect(sql).toContain('INSERT INTO agentes');
    expect(parametros).toContain(ADMIN_CPF);
    expect(parametros).toContain('senha-nao-definida');
  });

  it('não sorteia, não guarda e não mostra senha em lugar nenhum', async () => {
    // A 1.2 sorteava a senha, guardava no cofre e a tela de entrada mostrava
    // para quem abrisse o aplicativo.
    await agenteRepository.garantirAdminPadrao();

    expect(mockedSecureStore.setItemAsync).not.toHaveBeenCalled();
    const parametros = mockDb.runAsync.mock.calls[0][1] as unknown[];
    expect(parametros.some((p) => typeof p === 'string' && p.includes('$'))).toBe(false);
  });

  it('não mexe no administrador que já existe', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ id: 'admin-id' });

    await agenteRepository.garantirAdminPadrao();

    expect(mockDb.runAsync).not.toHaveBeenCalled();
    expect(mockedSecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('instalação da 1.2: trata a senha exibida como vazada e pede configuração nova', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ id: 'admin-id' });
    mockedSecureStore.getItemAsync.mockImplementation(async (chave: string) =>
      chave === SECURE_KEYS.SENHA_ADMIN_INICIAL ? 'senha-sorteada-da-1.2' : null
    );

    await agenteRepository.garantirAdminPadrao();

    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith(SECURE_KEYS.SENHA_ADMIN_INICIAL);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE agentes SET senha_hash'),
      ['senha-nao-definida', expect.any(String), 'admin-id']
    );
    // Apaga a chave antes de desfazer a senha. Na ordem contrária, uma falha
    // do cofre faria a próxima abertura desfazer a senha nova.
    expect(mockedSecureStore.deleteItemAsync.mock.invocationCallOrder[0])
      .toBeLessThan(mockDb.runAsync.mock.invocationCallOrder[0]);
  });

  it('se não conseguir apagar a senha antiga, não desfaz a senha atual', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ id: 'admin-id' });
    mockedSecureStore.getItemAsync.mockResolvedValue('senha-antiga');
    mockedSecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('cofre'));

    await agenteRepository.garantirAdminPadrao();

    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });
});

describe('agenteRepository.adminPrecisaConfigurar', () => {
  it('sim, enquanto a conta não tem senha', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ senha_hash: 'senha-nao-definida' });
    expect(await agenteRepository.adminPrecisaConfigurar()).toBe(true);
  });

  it('sim, se a conta ainda nem foi criada (abertura em andamento)', async () => {
    expect(await agenteRepository.adminPrecisaConfigurar()).toBe(true);
  });

  it('não, depois que a senha foi escolhida', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ senha_hash: HASH_DO_CODIGO });
    expect(await agenteRepository.adminPrecisaConfigurar()).toBe(false);
  });
});

describe('agenteRepository.configurarAdmin', () => {
  beforeEach(() => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({ id: 'admin-id' }) // garantirAdminPadrao
      .mockResolvedValueOnce({ ...agenteBase, id: 'admin-id', cpf: ADMIN_CPF, is_admin: 1 });
  });

  it('só grava sobre a conta sem senha e devolve o código de recuperação', async () => {
    const codigo = await agenteRepository.configurarAdmin('SenhaForte@1');

    const update = mockDb.runAsync.mock.calls.find(([sql]) => String(sql).includes('UPDATE agentes'));
    expect(update?.[0]).toMatch(/WHERE cpf = \? AND is_admin = 1 AND senha_hash = \?/);
    expect(update?.[1]).toEqual([expect.stringContaining('$'), expect.any(String), ADMIN_CPF, 'senha-nao-definida']);
    expect(codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      `${SECURE_KEYS.CODIGO_RECUPERACAO}admin-id`,
      expect.any(String)
    );
  });

  it('recusa quando o administrador já foi configurado', async () => {
    // Senão este caminho viraria uma troca de senha sem senha nenhuma.
    mockDb.runAsync.mockResolvedValue({ changes: 0, lastInsertRowId: 0 });

    await expect(agenteRepository.configurarAdmin('OutraSenha@1')).rejects.toThrow('já foi configurado');
    expect(mockedSecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});
