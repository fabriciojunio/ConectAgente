jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@/lib/supabase/client';
import {
  getAgentes,
  getAgenteById,
  getAgenteDesempenho,
  getRankingAgentes,
} from '../agenteService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function buildMockSupabase() {
  const chainable = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
  };

  const mock = {
    from: jest.fn(() => chainable),
    rpc: jest.fn(),
  };

  return { mock, chainable };
}

describe('agenteService', () => {
  let supabaseMock: ReturnType<typeof buildMockSupabase>['mock'];
  let chainable: ReturnType<typeof buildMockSupabase>['chainable'];

  beforeEach(() => {
    jest.clearAllMocks();
    const built = buildMockSupabase();
    supabaseMock = built.mock;
    chainable = built.chainable;
    mockCreateClient.mockReturnValue(supabaseMock as unknown as ReturnType<typeof createClient>);
  });

  describe('getAgentes', () => {
    it('returns paginated list of agents', async () => {
      const mockAgentes = [
        { id: 'a1', nome: 'Maria', ativo: true },
        { id: 'a2', nome: 'Jose', ativo: true },
      ];

      // First from() for agentes query (chain ends with .range())
      const agentesChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: mockAgentes, error: null, count: 2 }),
      };

      const visitas = [
        { id: 'v1', agente_id: 'a1', status: 'realizada' },
        { id: 'v2', agente_id: 'a1', status: 'agendada' },
        { id: 'v3', agente_id: 'a2', status: 'realizada' },
      ];
      const visitasChain = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: visitas, error: null }),
      };

      supabaseMock.from
        .mockReturnValueOnce(agentesChain as never)
        .mockReturnValueOnce(visitasChain as never);

      const result = await getAgentes();

      expect(supabaseMock.from).toHaveBeenCalledWith('agentes');
      expect(agentesChain.eq).toHaveBeenCalledWith('ativo', true);
      expect(visitasChain.in).toHaveBeenCalledWith('agente_id', ['a1', 'a2']);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({ total_visitas: 2, visitas_realizadas: 1, taxa_conclusao: 50 });
      expect(result.data[1]).toMatchObject({ total_visitas: 1, visitas_realizadas: 1, taxa_conclusao: 100 });
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('conta visitas acima de 1.000 buscando em lotes', async () => {
      const agentesChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [{ id: 'a1', nome: 'Maria' }], error: null, count: 1 }),
      };
      const lote = (qtd: number, status: string) =>
        Array.from({ length: qtd }, (_, i) => ({ id: `${status}-${i}`, agente_id: 'a1', status }));
      const lotes = [lote(1000, 'realizada'), lote(5, 'agendada')];
      const novaCadeia = () => ({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn(() => Promise.resolve({ data: lotes.shift() ?? [], error: null })),
      });
      const cadeias = [novaCadeia(), novaCadeia()];
      supabaseMock.from
        .mockReturnValueOnce(agentesChain as never)
        .mockReturnValueOnce(cadeias[0] as never)
        .mockReturnValueOnce(cadeias[1] as never);

      const result = await getAgentes();

      expect(cadeias[0].range).toHaveBeenCalledWith(0, 999);
      expect(cadeias[1].range).toHaveBeenCalledWith(1000, 1999);
      expect(result.data[0]).toMatchObject({ total_visitas: 1005, visitas_realizadas: 1000 });
    });

    it('lança o erro da contagem de visitas em vez de mostrar zero', async () => {
      const agentesChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [{ id: 'a1', nome: 'Maria' }], error: null, count: 1 }),
      };
      const visitasChain = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: null, error: { message: 'sem permissão' } }),
      };
      supabaseMock.from
        .mockReturnValueOnce(agentesChain as never)
        .mockReturnValueOnce(visitasChain as never);

      await expect(getAgentes()).rejects.toThrow('Erro ao contar visitas dos agentes: sem permissão');
    });

    it('sem agentes devolve lista vazia, sem dados de demonstração', async () => {
      chainable.range.mockResolvedValueOnce({ data: [], error: null, count: 0 });

      const result = await getAgentes();

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.total_pages).toBe(0);
    });

    it('throws on error', async () => {
      chainable.range.mockResolvedValueOnce({ data: null, error: { message: 'DB error' }, count: null });

      await expect(getAgentes()).rejects.toThrow('Erro ao buscar agentes');
    });
  });

  describe('getAgenteById', () => {
    it('returns single agent with stats', async () => {
      const mockAgente = { id: 'a1', nome: 'Maria' };
      chainable.single.mockResolvedValueOnce({ data: mockAgente, error: null });

      // Contagem no banco (head: true): uma para o total e outra para as realizadas.
      const contagem = (count: number) => {
        const c: Record<string, jest.Mock> = {};
        c.select = jest.fn(() => c);
        c.eq = jest.fn(() => c);
        c.then = jest.fn((resolve: (v: unknown) => void) => resolve({ count, error: null }));
        return c;
      };
      const total = contagem(3);
      const realizadas = contagem(2);
      supabaseMock.from
        .mockReturnValueOnce(chainable as never)
        .mockReturnValueOnce(total as never)
        .mockReturnValueOnce(realizadas as never);

      const result = await getAgenteById('a1');

      expect(total.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
      expect(realizadas.eq).toHaveBeenCalledWith('status', 'realizada');
      expect(result).not.toBeNull();
      expect(result?.total_visitas).toBe(3);
      expect(result?.visitas_realizadas).toBe(2);
      expect(result?.taxa_conclusao).toBeCloseTo(66.67, 1);
    });

    it('returns null when not found (PGRST116)', async () => {
      chainable.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const result = await getAgenteById('nonexistent');

      expect(result).toBeNull();
    });

    it('throws on other errors', async () => {
      chainable.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'OTHER', message: 'fail' },
      });

      await expect(getAgenteById('a1')).rejects.toThrow('Erro ao buscar agente');
    });
  });

  describe('getAgenteDesempenho', () => {
    it('returns performance data with correct calculations', async () => {
      const mockVisitas = [
        { data_visita: '2024-03-01T10:00:00Z', status: 'realizada' },
        { data_visita: '2024-03-01T14:00:00Z', status: 'realizada' },
        { data_visita: '2024-03-02T10:00:00Z', status: 'agendada' },
      ];

      chainable.range.mockResolvedValueOnce({ data: mockVisitas, error: null });

      const result = await getAgenteDesempenho('a1', '2024-03-01', '2024-03-03');

      expect(supabaseMock.from).toHaveBeenCalledWith('visitas');
      expect(chainable.eq).toHaveBeenCalledWith('agente_id', 'a1');
      expect(chainable.gte).toHaveBeenCalledWith('data_visita', '2024-03-01');
      // data_visita tem hora: o último dia entra inteiro, até antes do dia seguinte.
      expect(chainable.lt).toHaveBeenCalledWith('data_visita', '2024-03-04');
      expect(result.total_visitas).toBe(3);
      expect(result.total_realizadas).toBe(2);
      expect(result.visitas_por_dia).toHaveLength(2);
      expect(result.taxa_conclusao).toBeCloseTo(66.67, 1);
      expect(result.media_diaria).toBe(1); // 3 visitas / 3 dias
    });

    it('handles empty results', async () => {
      chainable.range.mockResolvedValueOnce({ data: [], error: null });

      const result = await getAgenteDesempenho('a1', '2024-03-01', '2024-03-03');

      expect(result.total_visitas).toBe(0);
      expect(result.total_realizadas).toBe(0);
      expect(result.taxa_conclusao).toBe(0);
      expect(result.visitas_por_dia).toEqual([]);
    });

    it('throws on error', async () => {
      chainable.range.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

      await expect(getAgenteDesempenho('a1', '2024-03-01', '2024-03-03')).rejects.toThrow(
        'Erro ao buscar desempenho do agente'
      );
    });
  });

  describe('getRankingAgentes', () => {
    it('calls rpc with correct params', async () => {
      const mockData = [
        { agente_id: 'a1', nome: 'Maria', total: 20, realizadas: 18, pendentes: 2, taxa: 90 },
      ];
      supabaseMock.rpc.mockResolvedValue({ data: mockData, error: null });

      const result = await getRankingAgentes('2024-03-01', '2024-03-31');

      expect(supabaseMock.rpc).toHaveBeenCalledWith('fn_visitas_por_agente', {
        p_inicio: '2024-03-01',
        p_fim: '2024-03-31',
      });
      expect(result).toEqual(mockData);
    });

    it('returns empty array when data is null', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: null, error: null });

      const result = await getRankingAgentes('2024-03-01', '2024-03-31');

      expect(result).toEqual([]);
    });

    it('throws on error', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'fail' } });

      await expect(getRankingAgentes('2024-03-01', '2024-03-31')).rejects.toThrow(
        'Erro ao buscar ranking de agentes'
      );
    });
  });
});
