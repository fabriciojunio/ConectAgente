/**
 * Testes para utils/encryption.ts
 *
 * Cobre: hashSHA256, hashSenha (PBKDF2), verificarSenha nos três formatos,
 *        precisaAtualizarHash, sortearCodigoRecuperacao,
 *        e a garantia de que a cifra de campo não voltou e a
 *        documentação descreve o SQLCipher
 */

// PBKDF2 de verdade, com as iterações de produção: lento de propósito.
jest.setTimeout(30_000);

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

import { pbkdf2Sync } from 'crypto';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {
  ITERACOES_PBKDF2,
  HASH_QUE_NUNCA_CONFERE,
  precisaAtualizarHash,
  sortearCodigoRecuperacao,
  normalizarCodigoRecuperacao,
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
  // resetAllMocks, e não clearAllMocks: um `mockResolvedValueOnce` que um
  // teste não consumiu vazaria para o seguinte.
  jest.resetAllMocks();
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

/**
 * PBKDF2 de referência, o do Node, para conferir a implementação usada no
 * aplicativo sem depender dela. O sal entra como o texto hexadecimal, que é
 * como o aplicativo o passa.
 */
function pbkdf2DeReferencia(senha: string, salHex: string, iteracoes: number): string {
  return pbkdf2Sync(senha, salHex, iteracoes, 32, 'sha256').toString('hex');
}

describe('hashSenha', () => {
  it('sai no formato pbkdf2-sha256$iteracoes$sal$hash, com o número atual', async () => {
    mockedCrypto.getRandomBytesAsync.mockResolvedValue(new Uint8Array(16).fill(0xab) as any);

    const partes = (await hashSenha('minhasenha')).split('$');

    expect(partes).toHaveLength(4);
    expect(partes[0]).toBe('pbkdf2-sha256');
    expect(Number(partes[1])).toBe(ITERACOES_PBKDF2);
    expect(partes[2]).toBe('ab'.repeat(16));
    expect(partes[3]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('confere com o PBKDF2-HMAC-SHA256 de referência', async () => {
    mockedCrypto.getRandomBytesAsync.mockResolvedValue(new Uint8Array(16).fill(0x01) as any);

    const [, , sal, hash] = (await hashSenha('minhasenha')).split('$');

    expect(hash).toBe(pbkdf2DeReferencia('minhasenha', sal, ITERACOES_PBKDF2));
  });

  it('não usa mais um SHA-256 de uma passada só', async () => {
    // O formato antigo era sha256(sal + senha). Um computador comum faz
    // bilhões disso por segundo; é o que tornava o hash fácil de quebrar.
    await hashSenha('minhasenha');
    expect(mockedCrypto.digestStringAsync).not.toHaveBeenCalled();
  });

  it('salt é gerado com 16 bytes aleatórios', async () => {
    await hashSenha('senha');

    expect(mockedCrypto.getRandomBytesAsync).toHaveBeenCalledWith(16);
  });

  it('gera hashes diferentes para a mesma senha (salt aleatório)', async () => {
    mockedCrypto.getRandomBytesAsync
      .mockResolvedValueOnce(new Uint8Array(16).fill(0x01) as any)
      .mockResolvedValueOnce(new Uint8Array(16).fill(0x02) as any);

    const h1 = await hashSenha('mesmaSenha');
    const h2 = await hashSenha('mesmaSenha');

    expect(h1).not.toBe(h2);
  });
});

// ─── verificarSenha ───────────────────────────────────────────

describe('verificarSenha - formato atual (PBKDF2)', () => {
  it('aceita a senha certa e recusa a errada', async () => {
    const guardado = await hashSenha('SenhaCerta@1');

    expect(await verificarSenha('SenhaCerta@1', guardado)).toBe(true);
    expect(await verificarSenha('SenhaErrada@1', guardado)).toBe(false);
  });

  it('usa o número de iterações gravado no hash', async () => {
    // Senão subir o número numa versão futura trancaria todo mundo fora.
    const sal = 'cd'.repeat(16);
    const guardado = `pbkdf2-sha256$1000$${sal}$${pbkdf2DeReferencia('antiga', sal, 1000)}`;

    expect(await verificarSenha('antiga', guardado)).toBe(true);
  });

  it('recusa número de iterações inválido', async () => {
    expect(await verificarSenha('x', `pbkdf2-sha256$0$${'0'.repeat(32)}$${'0'.repeat(64)}`)).toBe(false);
    expect(await verificarSenha('x', `pbkdf2-sha256$abc$${'0'.repeat(32)}$${'0'.repeat(64)}`)).toBe(false);
  });

  it('o hash de conta inexistente nunca confere e custa o mesmo que um de verdade', async () => {
    expect(HASH_QUE_NUNCA_CONFERE.startsWith(`pbkdf2-sha256$${ITERACOES_PBKDF2}$`)).toBe(true);
    expect(await verificarSenha('', HASH_QUE_NUNCA_CONFERE)).toBe(false);
  });
});

describe('precisaAtualizarHash', () => {
  it('formatos antigos e menos iterações pedem atualização; o atual não', async () => {
    expect(precisaAtualizarHash('hashSemSalt')).toBe(true);
    expect(precisaAtualizarHash('aabbcc$hash')).toBe(true);
    expect(precisaAtualizarHash(`pbkdf2-sha256$1000$${'0'.repeat(32)}$${'0'.repeat(64)}`)).toBe(true);
    expect(precisaAtualizarHash(await hashSenha('x'))).toBe(false);
  });
});

describe('verificarSenha - formatos antigos, para a migração', () => {
  it('retorna true para senha correta no formato salt$hash', async () => {
    mockedCrypto.digestStringAsync.mockResolvedValue('hash-correto');

    expect(await verificarSenha('senhaCorreta', 'aabbcc$hash-correto')).toBe(true);
  });

  it('retorna false para senha errada no formato salt$hash', async () => {
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

describe('sortearCodigoRecuperacao', () => {
  // Substitui a recuperação por CPF e e-mail, que não pedia segredo nenhum:
  // os dois do administrador eram públicos.
  beforeEach(() => {
    (Crypto.getRandomBytesAsync as jest.Mock).mockImplementation(
      async (n: number) =>
        new Uint8Array(Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256))
    );
  });

  it('sai no formato XXXX-XXXX-XXXX', async () => {
    expect(await sortearCodigoRecuperacao()).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it('todo valor de byte vira símbolo com a mesma chance, sem os confundíveis', async () => {
    // 64 códigos de 12 símbolos são 768 bytes: cada um dos 256 valores de
    // byte aparece 3 vezes. Com alfabeto de tamanho que não divide 256,
    // `byte % tamanho` favoreceria os primeiros símbolos e as contagens
    // sairiam desiguais. E O e 0, I e 1 não podem aparecer: o código é lido
    // de uma tela e digitado a mão.
    let proximo = 0;
    (Crypto.getRandomBytesAsync as jest.Mock).mockImplementation(
      async (n: number) => new Uint8Array(Array.from({ length: n }, () => proximo++ % 256))
    );

    const contagem = new Map<string, number>();
    for (let i = 0; i < 64; i++) {
      for (const c of (await sortearCodigoRecuperacao()).replace(/-/g, '')) {
        contagem.set(c, (contagem.get(c) ?? 0) + 1);
      }
    }

    expect(contagem.size).toBe(32);
    expect(new Set(contagem.values())).toEqual(new Set([24]));
    expect([...contagem.keys()].join('')).not.toMatch(/[O0I1]/);
  });

  it('muda a cada chamada', async () => {
    let semente = 0;
    (Crypto.getRandomBytesAsync as jest.Mock).mockImplementation(
      async (n: number) =>
        new Uint8Array(Array.from({ length: n }, (_, i) => (i * 37 + semente++) % 256))
    );

    const codigos = new Set<string>();
    for (let i = 0; i < 5; i++) codigos.add(await sortearCodigoRecuperacao());
    expect(codigos.size).toBe(5);
  });
});

describe('normalizarCodigoRecuperacao', () => {
  it('ignora caixa, espaço e hífen', () => {
    expect(normalizarCodigoRecuperacao(' abcd-efgh jklm ')).toBe('ABCDEFGHJKLM');
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

  it('a documentação descreve a cifra do banco inteiro, não cifra campo a campo', () => {
    const seguranca = readFileSync(join(RAIZ, 'docs', 'seguranca.md'), 'utf-8');
    const lgpd = readFileSync(join(RAIZ, 'docs', 'lgpd.md'), 'utf-8');
    const manual = readFileSync(join(RAIZ, 'docs', 'manual-tecnico.md'), 'utf-8');
    const leiaMe = readFileSync(join(RAIZ, 'README.md'), 'utf-8');

    // O que protege o aparelho desde a 1.2.0 é o SQLCipher no arquivo todo.
    expect(seguranca).toContain('cifrado inteiro com SQLCipher');
    expect(seguranca).toContain('foi removida, não ligada');
    // E nenhum documento volta a descrever a cifra de campo como se rodasse.
    expect(lgpd).not.toContain('cifra dos campos de identificação no aparelho');
    expect(manual).not.toContain('são cifrados com **SHA-256 no modo CTR**');
    expect(manual).not.toContain('SHA-256-CTR com IV aleatório');
    expect(leiaMe).not.toContain('ficam em texto puro no banco do aparelho');
  });

  it('a política de segurança, nas duas línguas, não diz mais que o banco local está sem cifra', () => {
    const politica = readFileSync(join(RAIZ, 'SECURITY.md'), 'utf-8');
    const policy = readFileSync(join(RAIZ, 'docs', 'en', 'security-policy.md'), 'utf-8');

    expect(politica).toContain('cifrado inteiro com SQLCipher');
    expect(politica).not.toContain('não é cifrado pelo aplicativo');
    expect(policy).toContain('encrypted whole with SQLCipher');
    expect(policy).not.toContain('not encrypted by the app');
  });
});
