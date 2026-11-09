/**
 * @jest-environment node
 */
/**
 * O health check consulta o banco sem login. Depois que o visitante perdeu
 * todo acesso às tabelas, a resposta passou a ser permissão negada, e isso
 * não pode virar "banco fora do ar".
 */
jest.mock('@/lib/env', () => ({
  conferirEnv: () => ({ valido: true, problemas: [] }),
  chaveDeServicoVazou: () => false,
}));

const resposta: { error: { code: string; message: string } | null } = { error: null };

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        limit: () => Promise.resolve(resposta),
      }),
    }),
  }),
}));

import { GET } from '../route';

describe('GET /api/health', () => {
  it('responde saudável quando o banco devolve linhas', async () => {
    resposta.error = null;
    const r = await GET();
    expect(r.status).toBe(200);
    expect((await r.json()).database).toBe('connected');
  });

  it('permissão negada prova que o banco respondeu', async () => {
    resposta.error = { code: '42501', message: 'permission denied for table agentes' };
    const r = await GET();
    expect(r.status).toBe(200);
    expect((await r.json()).status).toBe('healthy');
  });

  it('chave inválida não passa por banco de pé', async () => {
    // O gateway responde 401 sem o código do Postgres.
    resposta.error = { code: '', message: 'Invalid API key' };
    const r = await GET();
    expect(r.status).toBe(503);
  });

  it('outro erro continua sendo banco fora do ar, sem vazar a mensagem', async () => {
    resposta.error = { code: 'PGRST000', message: 'could not connect to server' };
    const r = await GET();
    const corpo = await r.json();
    expect(r.status).toBe(503);
    expect(corpo.database).toBe('unreachable');
    expect(JSON.stringify(corpo)).not.toContain('could not connect');
  });
});
