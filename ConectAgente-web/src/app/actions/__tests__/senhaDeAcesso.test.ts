/**
 * Testes de `redefinirSenhaDeAcesso`.
 *
 * A ação entra na conta de outra pessoa: troca a senha que o aplicativo usa
 * para sincronizar. O que estes testes travam é quem pode fazer isso com
 * quem. Se um gerente redefinisse a senha de outro gerente ou de um admin,
 * entraria na conta dele.
 */
const mockGetUser = jest.fn();
const mockRateLimit = jest.fn();
const mockUpdateUserById = jest.fn();
const mockRegistrarAcao = jest.fn();

/** Linhas de `agentes` por id. */
let agentes: Record<string, { role: string; ativo?: boolean }> = {};

jest.mock('next/headers', () => ({
  headers: async () => ({ get: () => '127.0.0.1' }),
}));

jest.mock('@/lib/rateLimit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

jest.mock('@/services/auditService', () => ({
  registrarAcao: (...args: unknown[]) => mockRegistrarAcao(...args),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: () => mockGetUser() },
  }),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: {
      admin: { updateUserById: (...a: unknown[]) => mockUpdateUserById(...a) },
    },
    from: () => {
      let idProcurado = '';
      const encadeado = {
        select: () => encadeado,
        eq: (_coluna: string, valor: string) => {
          idProcurado = valor;
          return encadeado;
        },
        maybeSingle: async () => ({ data: agentes[idProcurado] ?? null, error: null }),
      };
      return encadeado;
    },
  }),
}));

import { redefinirSenhaDeAcesso } from '../registro';

const SENHA = 'NovaSenha@1';

function logadoComo(id: string, role: string) {
  mockGetUser.mockResolvedValue({ data: { user: { id } } });
  agentes[id] = { role, ativo: true };
}

beforeEach(() => {
  jest.clearAllMocks();
  agentes = { 'ag-1': { role: 'agente', ativo: true } };
  mockRateLimit.mockResolvedValue({ allowed: true });
  mockUpdateUserById.mockResolvedValue({ error: null });
});

describe('redefinirSenhaDeAcesso - autorização', () => {
  it('recusa quem não tem sessão', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const r = await redefinirSenhaDeAcesso('ag-1', SENHA);

    expect(r.success).toBe(false);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it('recusa agente e coordenador', async () => {
    for (const papel of ['agente', 'coordenador']) {
      logadoComo('quem-pede', papel);
      expect((await redefinirSenhaDeAcesso('ag-1', SENHA)).success).toBe(false);
    }
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it('gerente redefine a senha de agente', async () => {
    logadoComo('ger-1', 'gerente');

    const r = await redefinirSenhaDeAcesso('ag-1', SENHA);

    expect(r).toEqual({ success: true });
    expect(mockUpdateUserById).toHaveBeenCalledWith('ag-1', { password: SENHA });
  });

  it('gerente não redefine a senha de outro gerente nem de admin', async () => {
    logadoComo('ger-1', 'gerente');
    agentes['ger-2'] = { role: 'gerente', ativo: true };
    agentes['adm-1'] = { role: 'admin', ativo: true };

    expect((await redefinirSenhaDeAcesso('ger-2', SENHA)).success).toBe(false);
    expect((await redefinirSenhaDeAcesso('adm-1', SENHA)).success).toBe(false);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it('admin não redefine a senha de outro admin', async () => {
    logadoComo('adm-1', 'admin');
    agentes['adm-2'] = { role: 'admin', ativo: true };

    expect((await redefinirSenhaDeAcesso('adm-2', SENHA)).success).toBe(false);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it('ninguém usa este caminho para trocar a própria senha', async () => {
    logadoComo('adm-1', 'admin');

    expect((await redefinirSenhaDeAcesso('adm-1', SENHA)).success).toBe(false);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it('recusa conta inativa ou inexistente', async () => {
    logadoComo('ger-1', 'gerente');
    agentes['ag-2'] = { role: 'agente', ativo: false };

    expect((await redefinirSenhaDeAcesso('ag-2', SENHA)).success).toBe(false);
    expect((await redefinirSenhaDeAcesso('nao-existe', SENHA)).success).toBe(false);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });
});

describe('redefinirSenhaDeAcesso - regras', () => {
  beforeEach(() => logadoComo('ger-1', 'gerente'));

  it('exige a mesma senha forte do cadastro', async () => {
    const r = await redefinirSenhaDeAcesso('ag-1', 'fraca');

    expect(r.success).toBe(false);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it('respeita o limite de tentativas por aprovador', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false });

    const r = await redefinirSenhaDeAcesso('ag-1', SENHA);

    expect(r.success).toBe(false);
    expect(mockRateLimit).toHaveBeenCalledWith('senha:ger-1', expect.any(Number), expect.any(Number));
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it('deixa rastro de quem redefiniu, sem a senha', async () => {
    await redefinirSenhaDeAcesso('ag-1', SENHA);

    expect(mockRegistrarAcao).toHaveBeenCalledWith(
      'REDEFINIR_SENHA', 'agentes', 'ag-1', undefined, { redefinida_por: 'ger-1' }
    );
    expect(JSON.stringify(mockRegistrarAcao.mock.calls)).not.toContain(SENHA);
  });

  it('erro do servidor vira mensagem genérica', async () => {
    mockUpdateUserById.mockResolvedValue({ error: new Error('detalhe interno') });

    const r = await redefinirSenhaDeAcesso('ag-1', SENHA);

    expect(r).toEqual({ success: false, error: 'Erro interno ao redefinir a senha.' });
  });
});
