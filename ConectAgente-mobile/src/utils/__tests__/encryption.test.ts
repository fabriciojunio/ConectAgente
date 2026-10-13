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
  sortearSenhaForte,
  hashSHA256,
  hashSenha,
  verificarSenha,
} from '../encryption';

const mockedCrypto = Crypto as jest.Mocked<typeof Crypto>;
const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

// Chave fixa de 64 chars hex (256 bits) para testes determinísticos
const FIXED_KEY = '0123456789abcdef'.repeat(4);

// IV fixo de 16 bytes para testes de criptografia determinísticos

// Bytes previsiveis no lugar do gerador aleatorio. Servem ao sal do hash de
// senha e ao sorteio da senha inicial, que e o que restou de aleatorio aqui
// depois que a cifra de campo saiu.
const BYTES_FIXOS = new Uint8Array(16).fill(0xaa);

beforeEach(() => {
  jest.clearAllMocks();
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

  mockedCrypto.getRandomBytesAsync.mockResolvedValue(BYTES_FIXOS as any);
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

describe('sortearSenhaForte', () => {
  // Existe porque a senha do administrador era a constante `Admin@2025`,
  // repetida no README publico e impressa na tela de configuracoes. Quem
  // encontrasse uma instalacao no ar entrava como administrador e lia o
  // prontuario de todos.
  beforeEach(() => {
    // Bytes variados: com tudo igual o embaralhamento nao teria o que mover
    // e o teste de classes passaria por acidente.
    (Crypto.getRandomBytesAsync as jest.Mock).mockImplementation(
      async (n: number) =>
        new Uint8Array(Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256))
    );
  });

  it('respeita o tamanho pedido', async () => {
    expect((await sortearSenhaForte(16)).length).toBe(16);
    expect((await sortearSenhaForte(24)).length).toBe(24);
  });

  it('tem ao menos uma maiuscula, uma minuscula, um numero e um simbolo', async () => {
    // Sem isto a senha poderia ser recusada pela propria validacao do
    // aplicativo, que exige as quatro classes.
    const senha = await sortearSenhaForte(16);
    expect(senha).toMatch(/[A-Z]/);
    expect(senha).toMatch(/[a-z]/);
    expect(senha).toMatch(/[0-9]/);
    expect(senha).toMatch(/[^A-Za-z0-9]/);
  });

  it('nao usa caracteres que se confundem na leitura', async () => {
    // Esta senha e lida de uma tela e digitada a mao: O e 0, l e 1 e I viram
    // chamado de suporte.
    const senha = await sortearSenhaForte(32);
    expect(senha).not.toMatch(/[O0l1I]/);
  });

  it('muda a cada chamada', async () => {
    let semente = 0;
    (Crypto.getRandomBytesAsync as jest.Mock).mockImplementation(
      async (n: number) =>
        new Uint8Array(Array.from({ length: n }, (_, i) => (i * 37 + semente++) % 256))
    );

    const senhas = new Set<string>();
    for (let i = 0; i < 5; i++) senhas.add(await sortearSenhaForte(16));
    expect(senhas.size).toBe(5);
  });
});

/**
 * Guarda: a cifra de campo foi removida, e a documentação diz a verdade.
 *
 * Em 13/10/2026 descobri que `encryptField` e `encryptSensitiveFields` não eram
 * chamados por nenhuma linha do aplicativo, em nenhum commit do histórico, e
 * que três documentos afirmavam o contrário: `docs/lgpd.md` listava a cifra
 * como implementada para o art. 46, `docs/seguranca.md` dizia que os campos
 * ficavam cifrados, e o README tratava a fraqueza da cifra como se ela
 * estivesse em uso. Os campos sempre estiveram em texto puro no SQLite.
 *
 * A cifra foi removida em vez de ligada. Ela não autenticava, e cifrar `nome` e
 * `cpf` quebraria a busca local que o agente usa em campo. Código morto com
 * cara de segurança é pior que a ausência dele: convida a ser ligado por quem
 * precisa de "criptografia" e não vai reler a construção.
 *
 * Este teste trava as duas pontas. Se alguém trouxer a cifra de volta, ele
 * falha e manda ler o porquê antes. E se alguém reescrever a documentação
 * dizendo que o dado está cifrado, ele falha também.
 */
describe('a cifra de campo não voltou, e a documentação diz a verdade', () => {
  const { readFileSync, readdirSync } = require('fs') as typeof import('fs');
  const { join } = require('path') as typeof import('path');

  const SRC = join(__dirname, '..', '..');
  const RAIZ = join(SRC, '..', '..');

  function fontes(pasta: string): string[] {
    const achados: string[] = [];
    for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
      if (entrada.name === '__tests__' || entrada.name === 'node_modules') continue;
      const caminho = join(pasta, entrada.name);
      if (entrada.isDirectory()) achados.push(...fontes(caminho));
      else if (/\.tsx?$/.test(entrada.name)) achados.push(caminho);
    }
    return achados;
  }

  it('nenhum arquivo cifra campo no aparelho', () => {
    const comCifra = fontes(SRC).filter((c) =>
      /encryptField|encryptSensitiveFields|ctrEncrypt|deriveKeystream/.test(
        readFileSync(c, 'utf-8')
      )
    );
    expect(comCifra.map((c) => c.replace(SRC, ''))).toEqual([]);
  });

  it('o módulo explica por que a cifra saiu, para ninguém trazer de volta sem ler', () => {
    const fonte = readFileSync(join(SRC, 'utils', 'encryption.ts'), 'utf-8');
    expect(fonte).toContain('nenhuma linha do aplicativo chamava');
    expect(fonte).toContain('SQLCipher');
  });

  it('a documentação não afirma que os campos estão cifrados', () => {
    const seguranca = readFileSync(join(RAIZ, 'docs', 'seguranca.md'), 'utf-8');
    const lgpd = readFileSync(join(RAIZ, 'docs', 'lgpd.md'), 'utf-8');

    expect(seguranca).toContain('em texto puro no SQLite');
    expect(lgpd).not.toContain('cifra dos campos de identificação no aparelho');
  });
});
