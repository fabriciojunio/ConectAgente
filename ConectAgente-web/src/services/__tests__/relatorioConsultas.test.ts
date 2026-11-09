/**
 * Testes das consultas que alimentam o relatório.
 *
 * Os filtros da tela de relatórios não chegavam ao banco do jeito certo:
 * unidade em residencias dava erro de coluna, bairro sem `!inner` não cortava
 * nada, status era ignorado e qualquer resultado parava em 1.000 linhas.
 */
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@/lib/supabase/client';
import {
  gerarRelatorio,
  gerarRelatorioAgentes,
  gerarRelatorioAtrasos,
  gerarRelatorioFamilias,
  gerarRelatorioVisitas,
  LINHAS_POR_LOTE,
} from '../relatorioService';
import { StatusVisita } from '@/types';
import type { RelatorioFiltros } from '@/types';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

type Cadeia = Record<string, jest.Mock>;
type Resposta = { data: unknown[] | null; error: { message: string } | null };

/**
 * Cada `from()` e cada `rpc()` devolve uma cadeia nova, como o Supabase faz,
 * e o `range()` entrega a próxima resposta da fila daquela tabela.
 */
function montarSupabase(
  respostas: Record<string, Resposta[]>,
  // Consultas que não paginam terminam no order, como a lista de agentes.
  terminaNoOrder: Record<string, Resposta> = {}
) {
  const cadeias: Array<{ alvo: string; c: Cadeia }> = [];

  function cadeia(alvo: string): Cadeia {
    const c: Cadeia = {};
    for (const metodo of ['select', 'eq', 'gte', 'lt', 'lte', 'in', 'is', 'order']) {
      c[metodo] = jest.fn(() => c);
    }
    if (terminaNoOrder[alvo]) {
      c.order = jest.fn(() => Promise.resolve(terminaNoOrder[alvo]));
    }
    c.range = jest.fn(() => Promise.resolve(respostas[alvo]?.shift() ?? { data: [], error: null }));
    cadeias.push({ alvo, c });
    return c;
  }

  const supabase = {
    from: jest.fn((tabela: string) => cadeia(tabela)),
    rpc: jest.fn((funcao: string) => cadeia(funcao)),
  };
  mockCreateClient.mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return { supabase, cadeias, de: (alvo: string) => cadeias.filter((x) => x.alvo === alvo).map((x) => x.c) };
}

function linhas(qtd: number, base: Record<string, unknown> = {}) {
  return Array.from({ length: qtd }, (_, i) => ({ id: `id-${i}`, ...base }));
}

const filtrosBase: RelatorioFiltros = {
  tipo: 'visitas',
  formato: 'csv',
  periodo_inicio: '',
  periodo_fim: '',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('gerarRelatorioVisitas', () => {
  it('leva unidade, bairro, status e período até o banco', async () => {
    const { de } = montarSupabase({ visitas: [{ data: [], error: null }] });

    await gerarRelatorioVisitas({
      ...filtrosBase,
      periodo_inicio: '2026-11-01',
      periodo_fim: '2026-11-30',
      unidade_saude: 'UBS Central',
      bairro: 'Centro',
      status: StatusVisita.REALIZADA,
    });

    const [c] = de('visitas');
    const select = c.select.mock.calls[0][0] as string;
    expect(select).toContain('agente:agentes!inner(');
    expect(select).toContain('residencia:residencias!inner(');
    expect(c.eq).toHaveBeenCalledWith('agente.unidade_saude', 'UBS Central');
    expect(c.eq).toHaveBeenCalledWith('residencia.bairro', 'Centro');
    expect(c.eq).toHaveBeenCalledWith('status', 'realizada');
    expect(c.gte).toHaveBeenCalledWith('data_visita', '2026-11-01');
    expect(c.lt).toHaveBeenCalledWith('data_visita', '2026-12-01');
  });

  it('busca em lotes e passa de 1.000 linhas', async () => {
    const { de } = montarSupabase({
      visitas: [
        { data: linhas(LINHAS_POR_LOTE), error: null },
        { data: linhas(LINHAS_POR_LOTE), error: null },
        { data: linhas(7), error: null },
      ],
    });

    const resultado = await gerarRelatorioVisitas(filtrosBase);

    expect(resultado).toHaveLength(2 * LINHAS_POR_LOTE + 7);
    const cadeias = de('visitas');
    expect(cadeias.map((c) => c.range.mock.calls[0])).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    // Sem desempate, dois lotes com a mesma data podem repetir ou pular visita.
    expect(cadeias[0].order).toHaveBeenCalledWith('id', { ascending: true });
  });

  it('para no primeiro lote quando ele vem incompleto', async () => {
    const { de } = montarSupabase({ visitas: [{ data: linhas(3), error: null }] });

    expect(await gerarRelatorioVisitas(filtrosBase)).toHaveLength(3);
    expect(de('visitas')).toHaveLength(1);
  });

  it('propaga o erro do banco com a mensagem do relatório', async () => {
    montarSupabase({ visitas: [{ data: null, error: { message: 'falhou' } }] });

    await expect(gerarRelatorioVisitas(filtrosBase)).rejects.toThrow(
      'Erro ao gerar relatório de visitas: falhou'
    );
  });
});

describe('gerarRelatorioFamilias', () => {
  it('filtra unidade pelo agente e não pela residência', async () => {
    const { de } = montarSupabase({ residencias: [{ data: [], error: null }] });

    await gerarRelatorioFamilias({ ...filtrosBase, tipo: 'familias', unidade_saude: 'UBS Sul' });

    const [c] = de('residencias');
    expect(c.select.mock.calls[0][0]).toContain('agente:agentes!inner(');
    expect(c.eq).toHaveBeenCalledWith('agente.unidade_saude', 'UBS Sul');
    expect(c.eq).not.toHaveBeenCalledWith('unidade_saude', expect.anything());
    expect(c.is).toHaveBeenCalledWith('deleted_at', null);
  });
});

describe('gerarRelatorioAgentes', () => {
  it('conta todas as visitas mesmo acima de 1.000', async () => {
    const realizadas = linhas(LINHAS_POR_LOTE, { agente_id: 'a1', status: 'realizada' });
    const resto = [
      ...linhas(4, { agente_id: 'a1', status: 'agendada' }),
      ...linhas(2, { agente_id: 'a2', status: 'realizada' }),
    ];
    montarSupabase(
      {
        visitas: [
          { data: realizadas, error: null },
          { data: resto, error: null },
        ],
      },
      { agentes: { data: [{ id: 'a1', nome: 'Ana' }, { id: 'a2', nome: 'Bia' }], error: null } }
    );

    const resultado = await gerarRelatorioAgentes({ ...filtrosBase, tipo: 'agentes' });

    expect(resultado.find((a) => a.id === 'a1')).toMatchObject({
      total_visitas: LINHAS_POR_LOTE + 4,
      visitas_realizadas: LINHAS_POR_LOTE,
    });
    expect(resultado.find((a) => a.id === 'a2')).toMatchObject({
      total_visitas: 2,
      visitas_realizadas: 2,
      taxa_conclusao: 100,
    });
  });
});

describe('gerarRelatorioAtrasos', () => {
  it('pagina a função do banco e repassa a unidade', async () => {
    const { supabase, de } = montarSupabase({
      fn_familias_em_atraso: [
        { data: linhas(LINHAS_POR_LOTE), error: null },
        { data: linhas(1), error: null },
      ],
    });

    const resultado = await gerarRelatorioAtrasos({ ...filtrosBase, tipo: 'atrasos', unidade_saude: 'UBS Norte' });

    expect(resultado).toHaveLength(LINHAS_POR_LOTE + 1);
    expect(supabase.rpc).toHaveBeenCalledWith('fn_familias_em_atraso', { p_dias: 0, p_unidade: 'UBS Norte' });
    expect(de('fn_familias_em_atraso')[0].order).toHaveBeenCalledWith('residencia_id', { ascending: true });
  });
});

describe('gerarRelatorio', () => {
  beforeEach(() => {
    global.URL.createObjectURL = jest.fn(() => 'blob:fake');
    global.URL.revokeObjectURL = jest.fn();
    jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') return { href: '', download: '', click: jest.fn() } as unknown as HTMLElement;
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLElement;
    }) as typeof document.createElement);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('formata data_visita que chega como timestamp completo', async () => {
    montarSupabase({
      visitas: [
        {
          data: [
            {
              id: 'v1',
              data_visita: '2026-11-05T12:30:00+00:00',
              status: 'realizada',
              agente: { nome: 'Ana' },
              residencia: { logradouro: 'Rua A', numero: '10', bairro: 'Centro' },
            },
          ],
          error: null,
        },
      ],
    });

    const { preview } = await gerarRelatorio('visitas', 'csv', {});

    expect(preview.data[0]['Data']).toBe('05/11/2026');
  });

  it('repassa o status escolhido na tela', async () => {
    const { de } = montarSupabase({ visitas: [{ data: [], error: null }] });

    await gerarRelatorio('visitas', 'csv', { status: StatusVisita.CANCELADA });

    expect(de('visitas')[0].eq).toHaveBeenCalledWith('status', 'cancelada');
  });
});
