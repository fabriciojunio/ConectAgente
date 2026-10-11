/**
 * Testes das ações de cadastro e aprovação.
 *
 * O foco é a autorização, que não existia. Server Action em Next.js é um
 * endpoint HTTP alcançável de fora. `aprovarSolicitacao` e
 * `rejeitarSolicitacao` recebiam o id do aprovador como parâmetro, confiavam
 * nele, e usavam o cliente de serviço, que ignora o RLS por definição.
 *
 * O caminho de ataque era direto e não exigia credencial nenhuma:
 *
 *   1. preencher o cadastro público escolhendo cargo "gerente"
 *   2. chamar `aprovarSolicitacao` com o id da própria solicitação e
 *      qualquer uuid como aprovador
 *   3. receber usuário de autenticação e linha em `agentes` com
 *      role = 'gerente'
 *   4. entrar no painel e ler o prontuário de todo mundo
 *
 * Num sistema de órgão público com dado de saúde, isso é comprometimento
 * completo por quem estiver na internet. Estes testes existem para que a
 * guarda não volte a sair sem ninguém notar.
 */
const mockGetUser = jest.fn();
const mockRateLimit = jest.fn();

/** Tabelas tocadas pelo cliente de serviço, por nome. */
let tabelasAcessadas: string[] = [];
let agenteRetornado: { role: string; ativo?: boolean } | null = null;
let solicitacaoRetornada: Record<string, unknown> | null = null;
let agenteInserido: Record<string, unknown> | null = null;
const mockCreateUser = jest.fn();
const mockDeleteUser = jest.fn();

jest.mock('next/headers', () => ({
  headers: async () => ({ get: () => '127.0.0.1' }),
}));

jest.mock('@/lib/rateLimit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: () => mockGetUser() },
  }),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        createUser: (...a: unknown[]) => mockCreateUser(...a),
        deleteUser: (...a: unknown[]) => mockDeleteUser(...a),
      },
    },
    from: (tabela: string) => {
      tabelasAcessadas.push(tabela);
      const encadeado = {
        select: () => encadeado,
        eq: () => encadeado,
        in: () => encadeado,
        maybeSingle: async () =>
          tabela === 'agentes'
            ? { data: agenteRetornado, error: null }
            : { data: null, error: null },
        single: async () => ({ data: solicitacaoRetornada, error: null }),
        insert: async (linha: Record<string, unknown>) => {
          if (tabela === 'agentes') agenteInserido = linha;
          return { error: null };
        },
        update: () => encadeado,
      };
      return encadeado;
    },
  }),
}));

import { aprovarSolicitacao, rejeitarSolicitacao } from '../registro';

const SOLICITACAO = {
  id: 'sol-1',
  nome: 'Atacante',
  cpf: '52998224725',
  telefone: '14999',
  area_atuacao: 'x',
  unidade_saude: 'UBS',
  cargo_pretendido: 'gerente',
  status: 'pendente',
};

beforeEach(() => {
  jest.clearAllMocks();
  tabelasAcessadas = [];
  agenteInserido = null;
  agenteRetornado = null;
  solicitacaoRetornada = SOLICITACAO;
  mockRateLimit.mockResolvedValue({ allowed: true });
  mockCreateUser.mockResolvedValue({ data: { user: { id: 'novo-id' } }, error: null });
});

describe('aprovarSolicitacao - autorizacao', () => {
  it('recusa quem nao tem sessao', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const r = await aprovarSolicitacao('sol-1', 'Senha@123');

    expect(r.success).toBe(false);
    expect(r.error).toContain('Sessao nao encontrada');
    // O mais importante: nenhuma conta chegou a ser criada.
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(agenteInserido).toBeNull();
  });

  it('recusa agente comum', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'ag-1' } } });
    agenteRetornado = { role: 'agente', ativo: true };

    const r = await aprovarSolicitacao('sol-1', 'Senha@123');

    expect(r.success).toBe(false);
    expect(r.error).toContain('Apenas gerentes e administradores');
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('recusa coordenador', async () => {
    // Coordenador enxerga a propria unidade, mas nao cria conta de ninguem.
    mockGetUser.mockResolvedValue({ data: { user: { id: 'co-1' } } });
    agenteRetornado = { role: 'coordenador', ativo: true };

    const r = await aprovarSolicitacao('sol-1', 'Senha@123');

    expect(r.success).toBe(false);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('recusa conta desativada, mesmo sendo gerente', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'ge-1' } } });
    agenteRetornado = { role: 'gerente', ativo: false };

    const r = await aprovarSolicitacao('sol-1', 'Senha@123');

    expect(r.success).toBe(false);
    expect(r.error).toContain('sem acesso');
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('recusa usuario autenticado que nao e agente do sistema', async () => {
    // Sessao valida no Supabase Auth sem linha correspondente em `agentes`.
    mockGetUser.mockResolvedValue({ data: { user: { id: 'fantasma' } } });
    agenteRetornado = null;

    const r = await aprovarSolicitacao('sol-1', 'Senha@123');

    expect(r.success).toBe(false);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('aceita gerente e grava quem aprovou a partir da sessao', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'ge-1' } } });
    agenteRetornado = { role: 'gerente', ativo: true };

    const r = await aprovarSolicitacao('sol-1', 'Senha@123');

    expect(r.success).toBe(true);
    expect(mockCreateUser).toHaveBeenCalled();
    // O limite de taxa passa a contar pelo aprovador de verdade.
    expect(mockRateLimit).toHaveBeenCalledWith('aprovar:ge-1', 10, 60_000);
  });

  it('aceita admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'ad-1' } } });
    agenteRetornado = { role: 'admin', ativo: true };

    const r = await aprovarSolicitacao('sol-1', 'Senha@123');

    expect(r.success).toBe(true);
  });

  it('o papel gravado e um dos que o CHECK do banco aceita', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'ad-1' } } });
    agenteRetornado = { role: 'admin', ativo: true };
    solicitacaoRetornada = { ...SOLICITACAO, cargo_pretendido: 'coordenador' };

    await aprovarSolicitacao('sol-1', 'Senha@123');

    expect(agenteInserido).not.toBeNull();
    expect(['agente', 'coordenador', 'gerente', 'admin']).toContain(
      agenteInserido!.role
    );
    expect(agenteInserido!.role).toBe('coordenador');
  });

  it('cargo "outro" recebe o menor privilegio', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'ad-1' } } });
    agenteRetornado = { role: 'admin', ativo: true };
    solicitacaoRetornada = { ...SOLICITACAO, cargo_pretendido: 'outro' };

    await aprovarSolicitacao('sol-1', 'Senha@123');

    expect(agenteInserido!.role).toBe('agente');
  });
});

describe('rejeitarSolicitacao - autorizacao', () => {
  it('recusa quem nao tem sessao', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const r = await rejeitarSolicitacao('sol-1', 'motivo qualquer');

    expect(r.success).toBe(false);
    expect(tabelasAcessadas).not.toContain('solicitacoes_registro');
  });

  it('recusa agente comum', async () => {
    // Deixar rejeitar aberto permitiria derrubar o cadastro de um colega.
    mockGetUser.mockResolvedValue({ data: { user: { id: 'ag-1' } } });
    agenteRetornado = { role: 'agente', ativo: true };

    const r = await rejeitarSolicitacao('sol-1', 'motivo qualquer');

    expect(r.success).toBe(false);
  });

  it('aceita gerente', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'ge-1' } } });
    agenteRetornado = { role: 'gerente', ativo: true };

    const r = await rejeitarSolicitacao('sol-1', 'justificativa insuficiente');

    expect(r.success).toBe(true);
  });
});
