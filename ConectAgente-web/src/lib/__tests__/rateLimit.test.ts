const mockRpc = jest.fn();
let mockSemConfiguracao = false;

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    if (mockSemConfiguracao) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    return { rpc: (...args: unknown[]) => ({ single: () => mockRpc(...args) }) };
  },
}));

import { chaveAnonimizada, rateLimit } from '../rateLimit';

beforeEach(() => {
  mockRpc.mockReset();
  mockSemConfiguracao = false;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('rateLimit no banco', () => {
  it('pergunta ao banco com a chave em hash, nunca com o CPF', async () => {
    mockRpc.mockResolvedValue({ data: { permitido: true, espera_ms: 0 }, error: null });
    const r = await rateLimit('login_cpf:12345678901', 5, 60_000);

    expect(r).toEqual({ allowed: true, retryAfterMs: 0 });
    const [funcao, parametros] = mockRpc.mock.calls[0];
    expect(funcao).toBe('registrar_tentativa');
    expect(parametros).toEqual({ p_chave: chaveAnonimizada('login_cpf:12345678901'), p_maximo: 5, p_janela_ms: 60_000 });
    expect(JSON.stringify(parametros)).not.toContain('12345678901');
  });

  it('repassa o bloqueio e o tempo de espera que o banco calculou', async () => {
    mockRpc.mockResolvedValue({ data: { permitido: false, espera_ms: 42_000 }, error: null });
    await expect(rateLimit('login_ip:10.0.0.1', 10)).resolves.toEqual({ allowed: false, retryAfterMs: 42_000 });
  });
});

describe('chaveAnonimizada', () => {
  it('mantém o prefixo, troca o valor por SHA-256 e é estável', () => {
    const chave = chaveAnonimizada('login_cpf:12345678901');
    expect(chave).toMatch(/^login_cpf:[0-9a-f]{64}$/);
    expect(chaveAnonimizada('login_cpf:12345678901')).toBe(chave);
    expect(chaveAnonimizada('login_cpf:12345678902')).not.toBe(chave);
  });

  it('identificador sem prefixo também sai em hash', () => {
    expect(chaveAnonimizada('sem-prefixo')).toMatch(/^limite:[0-9a-f]{64}$/);
  });
});

describe('rateLimit na reserva em memória', () => {
  // Sem a migração aplicada, o PostgREST responde erro: o login não pode
  // ficar sem limite nem trancar todo mundo.
  beforeEach(() => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'function registrar_tentativa does not exist' } });
  });

  it('continua limitando quando o banco recusa', async () => {
    const chave = 'teste:bloqueio-' + Date.now();
    await rateLimit(chave, 3, 60_000);
    await rateLimit(chave, 3, 60_000);
    await rateLimit(chave, 3, 60_000);
    const r = await rateLimit(chave, 3, 60_000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it('continua limitando quando nem há chave de serviço configurada', async () => {
    mockSemConfiguracao = true;
    const chave = 'teste:sem-config-' + Date.now();
    await rateLimit(chave, 1, 60_000);
    expect((await rateLimit(chave, 1, 60_000)).allowed).toBe(false);
  });

  it('libera de novo quando a janela vence', async () => {
    const chave = 'teste:janela-' + Date.now();
    await rateLimit(chave, 2, 50);
    await rateLimit(chave, 2, 50);
    expect((await rateLimit(chave, 2, 50)).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    expect((await rateLimit(chave, 2, 50)).allowed).toBe(true);
  });

  it('conta cada identificador separado', async () => {
    const a = 'teste:a-' + Date.now();
    const b = 'teste:b-' + Date.now();
    await rateLimit(a, 1, 60_000);
    expect((await rateLimit(a, 1, 60_000)).allowed).toBe(false);
    expect((await rateLimit(b, 1, 60_000)).allowed).toBe(true);
  });

  it('erro de rede no banco também cai na reserva', async () => {
    mockRpc.mockRejectedValue(new Error('fetch failed'));
    const chave = 'teste:rede-' + Date.now();
    expect((await rateLimit(chave, 1, 60_000)).allowed).toBe(true);
    expect((await rateLimit(chave, 1, 60_000)).allowed).toBe(false);
  });
});
