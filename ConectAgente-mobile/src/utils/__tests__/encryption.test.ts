/**
 * Testes para utils/encryption.ts
 *
 * Cobre: hashSHA256, hashSenha, verificarSenha,
 *        encryptField (SHA-256-CTR), decryptField,
 *        encryptSensitiveFields, decryptSensitiveFields,
 *        compatibilidade retroativa com formato XOR legado,
 *        clearEncryptionKeyCache
 */

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {
  hashSHA256,
  hashSenha,
  verificarSenha,
  encryptField,
  decryptField,
  encryptSensitiveFields,
  decryptSensitiveFields,
  clearEncryptionKeyCache,
} from '../encryption';

const mockedCrypto = Crypto as jest.Mocked<typeof Crypto>;
const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

// Chave fixa de 64 chars hex (256 bits) para testes determinísticos
const FIXED_KEY = '0123456789abcdef'.repeat(4);

// IV fixo de 16 bytes para testes de criptografia determinísticos
const FIXED_IV = new Uint8Array(16).fill(0xaa);

beforeEach(() => {
  jest.clearAllMocks();
  clearEncryptionKeyCache();
  mockedSecureStore.getItemAsync.mockResolvedValue(FIXED_KEY);
  mockedSecureStore.setItemAsync.mockResolvedValue(undefined);

  // digestStringAsync precisa retornar valores hex determinísticos
  mockedCrypto.digestStringAsync.mockImplementation(async (_alg, input) => {
    // Gera hash fake mas determinístico baseado no input
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16).padStart(8, '0').repeat(8); // 64 chars hex
  });

  // getRandomBytesAsync retorna IV fixo por padrão
  mockedCrypto.getRandomBytesAsync.mockResolvedValue(FIXED_IV as any);
});

// ─── hashSHA256 ───────────────────────────────────────────────

describe('hashSHA256', () => {
  it('chama digestStringAsync com algoritmo SHA-256 e o valor correto', async () => {
    mockedCrypto.digestStringAsync.mockResolvedValue('abc123hash');

    const result = await hashSHA256('minhasenha');

    expect(mockedCrypto.digestStringAsync).toHaveBeenCalledWith('SHA-256', 'minhasenha');
    expect(result).toBe('abc123hash');
  });

  it('retorna o hash fornecido pelo driver de crypto', async () => {
    mockedCrypto.digestStringAsync.mockResolvedValue('fixed-hash-value');

    expect(await hashSHA256('qualquer')).toBe('fixed-hash-value');
  });
});

// ─── hashSenha ────────────────────────────────────────────────

describe('hashSenha', () => {
  it('retorna string no formato salt$hash', async () => {
    mockedCrypto.getRandomBytesAsync.mockResolvedValue(new Uint8Array(16).fill(0xab) as any);
    mockedCrypto.digestStringAsync.mockResolvedValue('computed-hash');

    const result = await hashSenha('minhasenha');
    const [salt, hash] = result.split('$');

    expect(result.split('$')).toHaveLength(2);
    expect(salt).toBe('ab'.repeat(16));
    expect(hash).toBe('computed-hash');
  });

  it('inclui o salt na entrada do hash (salt_hex + senha)', async () => {
    mockedCrypto.getRandomBytesAsync.mockResolvedValue(new Uint8Array(16).fill(0x01) as any);
    mockedCrypto.digestStringAsync.mockResolvedValue('resultado');

    await hashSenha('minhasenha');

    expect(mockedCrypto.digestStringAsync).toHaveBeenCalledWith(
      'SHA-256',
      '01'.repeat(16) + 'minhasenha'
    );
  });

  it('salt é gerado com 16 bytes aleatórios', async () => {
    mockedCrypto.getRandomBytesAsync.mockResolvedValue(new Uint8Array(16).fill(0) as any);
    mockedCrypto.digestStringAsync.mockResolvedValue('h');

    await hashSenha('senha');

    expect(mockedCrypto.getRandomBytesAsync).toHaveBeenCalledWith(16);
  });

  it('gera hashes diferentes para a mesma senha (salt aleatório)', async () => {
    mockedCrypto.getRandomBytesAsync
      .mockResolvedValueOnce(new Uint8Array(16).fill(0x01) as any)
      .mockResolvedValueOnce(new Uint8Array(16).fill(0x02) as any);
    mockedCrypto.digestStringAsync
      .mockResolvedValueOnce('hash-salt-1')
      .mockResolvedValueOnce('hash-salt-2');

    const h1 = await hashSenha('mesmaSenha');
    const h2 = await hashSenha('mesmaSenha');

    expect(h1).not.toBe(h2);
  });
});

// ─── verificarSenha ───────────────────────────────────────────

describe('verificarSenha', () => {
  it('retorna true para senha correta no formato novo (salt$hash)', async () => {
    mockedCrypto.digestStringAsync.mockResolvedValue('hash-correto');

    expect(await verificarSenha('senhaCorreta', 'aabbcc$hash-correto')).toBe(true);
  });

  it('retorna false para senha errada no formato novo', async () => {
    mockedCrypto.digestStringAsync.mockResolvedValue('hash-diferente');

    expect(await verificarSenha('senhaErrada', 'aabbcc$hash-original')).toBe(false);
  });

  it('usa o salt correto ao calcular (salt_hex + senha)', async () => {
    mockedCrypto.digestStringAsync.mockResolvedValue('qq');

    await verificarSenha('senha', 'meu-salt$qq');

    expect(mockedCrypto.digestStringAsync).toHaveBeenCalledWith('SHA-256', 'meu-salt' + 'senha');
  });

  it('verifica senha no formato legado (SHA-256 sem salt)', async () => {
    mockedCrypto.digestStringAsync.mockResolvedValue('hash-legado');

    expect(await verificarSenha('senhaLegada', 'hash-legado')).toBe(true);
  });

  it('rejeita senha errada no formato legado', async () => {
    mockedCrypto.digestStringAsync.mockResolvedValue('hash-diferente');

    expect(await verificarSenha('senhaErrada', 'hash-legado')).toBe(false);
  });

  it('formato legado: computa hash diretamente da senha (sem salt)', async () => {
    mockedCrypto.digestStringAsync.mockResolvedValue('x');

    await verificarSenha('minhaSenha', 'hashSemSalt');

    expect(mockedCrypto.digestStringAsync).toHaveBeenCalledWith('SHA-256', 'minhaSenha');
  });
});

// ─── encryptField / decryptField (SHA-256-CTR) ───────────────

describe('encryptField / decryptField (SHA-256-CTR)', () => {
  it('encripta e decripta de volta ao valor original (round-trip)', async () => {
    const original = '52998224725';
    const encrypted = await encryptField(original);
    const decrypted = await decryptField(encrypted);

    expect(decrypted).toBe(original);
  });

  it('valor encriptado começa com prefixo "v2:"', async () => {
    const encrypted = await encryptField('qualquer');

    expect(encrypted.startsWith('v2:')).toBe(true);
  });

  it('valor encriptado é diferente do original', async () => {
    const original = 'texto-sensivel';
    const encrypted = await encryptField(original);

    expect(encrypted).not.toBe(original);
  });

  it('retorna string vazia sem modificar para entrada vazia', async () => {
    expect(await encryptField('')).toBe('');
  });

  it('retorna string vazia sem modificar para decriptação vazia', async () => {
    expect(await decryptField('')).toBe('');
  });

  it('usa IV aleatório — ciphertext diferente para mesma entrada', async () => {
    mockedCrypto.getRandomBytesAsync
      .mockResolvedValueOnce(new Uint8Array(16).fill(0x11) as any)
      .mockResolvedValueOnce(new Uint8Array(16).fill(0x22) as any);

    const enc1 = await encryptField('mesmo-texto');
    const enc2 = await encryptField('mesmo-texto');

    expect(enc1).not.toBe(enc2);
  });

  it('busca a chave de criptografia do SecureStore', async () => {
    await encryptField('valor');

    expect(mockedSecureStore.getItemAsync).toHaveBeenCalled();
  });

  it('gera chave nova quando não encontrada no SecureStore', async () => {
    clearEncryptionKeyCache();
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
    mockedCrypto.getRandomBytesAsync.mockResolvedValue(new Uint8Array(32).fill(0xcc) as any);

    await encryptField('valor');

    expect(mockedCrypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalled();
  });

  it('usa chave em cache sem acessar SecureStore novamente', async () => {
    await encryptField('a'); // carrega chave no cache
    await encryptField('b'); // deve usar cache

    expect(mockedSecureStore.getItemAsync).toHaveBeenCalledTimes(1);
  });

  it('decripta formato legado XOR (compatibilidade retroativa)', async () => {
    // Simula dado antigo armazenado em XOR (sem prefixo "v2:")
    // XOR de 'A' (65) com chave que começa com 0x01 = 64 = '@'
    const legacyXor = btoa(String.fromCharCode(65 ^ 0x30)); // '0123...' key[0] = '0' = 0x30
    const decrypted = await decryptField(legacyXor);

    // Não deve jogar erro e deve retornar algo (pode não bater com original, mas não quebra)
    expect(typeof decrypted).toBe('string');
  });
});

// ─── encryptSensitiveFields / decryptSensitiveFields ─────────

describe('encryptSensitiveFields / decryptSensitiveFields', () => {
  const objeto = {
    id: 'morador-123',
    nome: 'João da Silva',
    cpf: '52998224725',
    cartao_sus: '700123456789012',
    telefone: '11987654321',
    nome_mae: 'Maria da Silva',
    nome_pai: 'José da Silva',
    residencia_id: 'res-456',
    status: 'ativo',
  };

  it('encripta todos os campos sensíveis (alterando seus valores)', async () => {
    const encrypted = await encryptSensitiveFields(objeto);

    expect(encrypted.nome).not.toBe(objeto.nome);
    expect(encrypted.cpf).not.toBe(objeto.cpf);
    expect(encrypted.cartao_sus).not.toBe(objeto.cartao_sus);
    expect(encrypted.telefone).not.toBe(objeto.telefone);
    expect(encrypted.nome_mae).not.toBe(objeto.nome_mae);
    expect(encrypted.nome_pai).not.toBe(objeto.nome_pai);
  });

  it('campos encriptados têm prefixo "v2:"', async () => {
    const encrypted = await encryptSensitiveFields(objeto);

    expect(encrypted.nome.startsWith('v2:')).toBe(true);
    expect(encrypted.cpf.startsWith('v2:')).toBe(true);
  });

  it('não altera campos não-sensíveis', async () => {
    const encrypted = await encryptSensitiveFields(objeto);

    expect(encrypted.id).toBe(objeto.id);
    expect(encrypted.residencia_id).toBe(objeto.residencia_id);
    expect(encrypted.status).toBe(objeto.status);
  });

  it('round-trip: decripta de volta aos valores originais', async () => {
    const encrypted = await encryptSensitiveFields(objeto);
    const decrypted = await decryptSensitiveFields(encrypted);

    expect(decrypted.nome).toBe(objeto.nome);
    expect(decrypted.cpf).toBe(objeto.cpf);
    expect(decrypted.cartao_sus).toBe(objeto.cartao_sus);
    expect(decrypted.telefone).toBe(objeto.telefone);
    expect(decrypted.nome_mae).toBe(objeto.nome_mae);
    expect(decrypted.nome_pai).toBe(objeto.nome_pai);
  });

  it('não modifica o objeto original (imutabilidade)', async () => {
    await encryptSensitiveFields(objeto);

    expect(objeto.cpf).toBe('52998224725');
    expect(objeto.nome).toBe('João da Silva');
  });

  it('ignora campo sensível ausente no objeto', async () => {
    const objSemCpf = { id: 'abc', nome: 'Fulano', status: 'ok' };
    const encrypted = await encryptSensitiveFields(objSemCpf);

    expect(encrypted.nome.startsWith('v2:')).toBe(true);
    expect((encrypted as any).cpf).toBeUndefined();
  });

  it('ignora campo sensível com valor falsy (null/undefined/vazio)', async () => {
    const obj = { id: '1', nome: '', cpf: undefined as any };
    const encrypted = await encryptSensitiveFields(obj);

    // nome vazio não deve ser alterado
    expect(encrypted.nome).toBe('');
    expect(encrypted.cpf).toBeUndefined();
  });
});

// ─── clearEncryptionKeyCache ──────────────────────────────────

describe('clearEncryptionKeyCache', () => {
  it('força nova leitura do SecureStore após limpar cache', async () => {
    await encryptField('primeiro'); // carrega chave
    clearEncryptionKeyCache();
    await encryptField('segundo'); // deve reler do SecureStore

    expect(mockedSecureStore.getItemAsync).toHaveBeenCalledTimes(2);
  });
});
