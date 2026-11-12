import {
  DURACAO_MAXIMA_SEGUNDOS,
  INATIVIDADE_MAXIMA_SEGUNDOS,
  ehCookieDeSessao,
  opcoesDoCookieDeSessao,
  sessaoPassouDoTurno,
} from '../sessao';

describe('cookie de sessão', () => {
  it('em produção sai com Secure, Lax e 30 minutos', () => {
    expect(opcoesDoCookieDeSessao(true)).toEqual({ path: '/', sameSite: 'lax', secure: true, maxAge: 30 * 60 });
  });

  it('em desenvolvimento, sem HTTPS, não exige Secure', () => {
    expect(opcoesDoCookieDeSessao(false).secure).toBe(false);
  });

  it('nunca dura mais que a inatividade máxima', () => {
    expect(opcoesDoCookieDeSessao(true).maxAge).toBe(INATIVIDADE_MAXIMA_SEGUNDOS);
    expect(INATIVIDADE_MAXIMA_SEGUNDOS).toBeLessThanOrEqual(30 * 60);
  });

  it.each([
    ['sb-yfcoatjvsbzmolnpnuya-auth-token', true],
    ['sb-yfcoatjvsbzmolnpnuya-auth-token.0', true],
    ['sb-yfcoatjvsbzmolnpnuya-auth-token.1', true],
    ['conectagente_tema', false],
    ['sb-x-auth-token-code-verifier', false],
  ])('%s é cookie de sessão: %s', (nome, esperado) => {
    expect(ehCookieDeSessao(nome)).toBe(esperado);
  });
});

describe('limite de um turno', () => {
  const agora = 1_800_000_000;

  it('dentro de 12 horas da senha, segue', () => {
    expect(sessaoPassouDoTurno([{ method: 'password', timestamp: agora - 3600 }, { method: 'totp', timestamp: agora - 3500 }], agora)).toBe(false);
  });

  it('passou de 12 horas da senha, vence mesmo com código recente', () => {
    const metodos = [
      { method: 'password', timestamp: agora - DURACAO_MAXIMA_SEGUNDOS - 1 },
      { method: 'totp', timestamp: agora - 60 },
    ];
    expect(sessaoPassouDoTurno(metodos, agora)).toBe(true);
  });

  it('sem registro de entrada, falha fechada', () => {
    expect(sessaoPassouDoTurno([], agora)).toBe(true);
    expect(sessaoPassouDoTurno(undefined, agora)).toBe(true);
    expect(sessaoPassouDoTurno([{ method: 'password', timestamp: 0 }], agora)).toBe(true);
  });
});

describe('a política vale nos três lugares que criam sessão', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require('path') as typeof import('path');
  const ler = (...p: string[]) => readFileSync(join(__dirname, '..', '..', ...p), 'utf8');

  it.each([
    ['middleware.ts'],
    ['lib/supabase/client.ts'],
    ['lib/supabase/server.ts'],
  ])('%s usa o cookie da política', (arquivo) => {
    expect(ler(...arquivo.split('/'))).toContain('cookieOptions: opcoesDoCookieDeSessao()');
  });

  it('o middleware confere o limite do turno e renova a inatividade', () => {
    const mw = ler('middleware.ts');
    expect(mw).toContain('sessaoPassouDoTurno(');
    expect(mw).toContain('ehCookieDeSessao(c.name)');
  });

  it('o login não oferece "permanecer conectado"', () => {
    expect(ler('app', '(auth)', 'login', 'page.tsx')).not.toMatch(/Permanecer conectado/);
  });
});
