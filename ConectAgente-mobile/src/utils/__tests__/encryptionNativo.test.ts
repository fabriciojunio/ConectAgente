import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';

/**
 * O caminho do Android: com o módulo nativo presente, o hash sai dele.
 *
 * O nativo de mentira calcula com a @noble, a mesma biblioteca que gravou os
 * hashes existentes. A equivalência do Java com a @noble foi conferida fora do
 * Jest, com os vetores da RFC 7914 (ver modules/pbkdf2-nativo/README.md).
 */
const mockChamadas: unknown[][] = [];
const mockNativo = {
  pbkdf2Sha256: jest.fn(async (senha: string, sal: string, iteracoes: number, tamanho: number) => {
    mockChamadas.push([senha, sal, iteracoes, tamanho]);
    const bytes = pbkdf2(sha256, senha, sal, { c: iteracoes, dkLen: tamanho });
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }),
};

jest.mock('expo', () => ({
  requireOptionalNativeModule: (nome: string) => (nome === 'Pbkdf2Nativo' ? mockNativo : null),
}));

// Carregado depois do falso existir: um import seria içado para antes dele.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { hashSenha, verificarSenha, ITERACOES_PBKDF2 } = require('../encryption') as typeof import('../encryption');

describe('PBKDF2 pelo módulo nativo', () => {
  beforeEach(() => {
    mockChamadas.length = 0;
    mockNativo.pbkdf2Sha256.mockClear();
  });

  it('gera o hash pelo nativo, com as iterações e o tamanho atuais', async () => {
    const hash = await hashSenha('Agente@2026');
    expect(mockNativo.pbkdf2Sha256).toHaveBeenCalledTimes(1);
    const [senha, sal, iteracoes, tamanho] = mockChamadas[0];
    expect(senha).toBe('Agente@2026');
    expect(sal).toMatch(/^[0-9a-f]{32}$/);
    expect(iteracoes).toBe(ITERACOES_PBKDF2);
    expect(tamanho).toBe(32);
    expect(hash).toMatch(new RegExp(`^pbkdf2-sha256\\$${ITERACOES_PBKDF2}\\$[0-9a-f]{32}\\$[0-9a-f]{64}$`));
  });

  it('confere senha certa e recusa a errada pelo nativo', async () => {
    const hash = await hashSenha('senha-com-acentuação-ç');
    await expect(verificarSenha('senha-com-acentuação-ç', hash)).resolves.toBe(true);
    await expect(verificarSenha('senha-com-acentuacao-c', hash)).resolves.toBe(false);
  });

  it('confere hash gravado antes, pela @noble, sem precisar regravar', async () => {
    const sal = '9f86d081884c7d659a2feaa0c55ad015';
    const gravado = `pbkdf2-sha256$100000$${sal}$15bffdef01c9bfc23dcf4c4b51ef076a89e692a543698e689e4101c1c0477f0b`;
    await expect(verificarSenha('Agente@2026', gravado)).resolves.toBe(true);
  });
});
