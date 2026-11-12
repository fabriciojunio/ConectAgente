jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@/lib/supabase/client';
import {
  getVisitas,
  getVisitaById,
  getVisitasByAgente,
  getEstatisticasVisitas,
} from '../visitaService';
import { StatusVisita } from '@/types';

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

describe('visitaService', () => {
  let supabaseMock: ReturnType<typeof buildMockSupabase>['mock'];
  let chainable: ReturnType<typeof buildMockSupabase>['chainable'];

  beforeEach(() => {
    jest.clearAllMocks();
    const built = buildMockSupabase();
    supabaseMock = built.mock;
    chainable = built.chainable;
    mockCreateClient.mockReturnValue(supabaseMock as unknown as ReturnType<typeof createClient>);
  });

  describe('getVisitas', () => {
    it('returns paginated result with default pagination', async () => {
      const mockData = [{ id: 'v1' }, { id: 'v2' }];
      chainable.range.mockResolvedValue({ data: mockData, error: null, count: 2 });

      const result = await getVisitas();

      expect(supabaseMock.from).toHaveBeenCalledWith('visitas');
      expect(chainable.select).toHaveBeenCalledWith(
        expect.stringContaining('agente:agentes'),
        { count: 'exact', head: false }
      );
      expect(chainable.range).toHaveBeenCalledWith(0, 19);
      expect(result.data).toEqual(mockData);
      expect(result.page).toBe(1);
      expect(result.per_page).toBe(20);
      expect(result.total).toBe(2);
    });

    it('applies pagination parameters', async () => {
      const pageData = Array.from({ length: 10 }, (_, i) => ({ id: `v${i}` }));
      chainable.range.mockResolvedValue({ data: pageData, error: null, count: 50 });

      const result = await getVisitas(undefined, { page: 3, per_page: 10 });

      expect(chainable.range).toHaveBeenCalledWith(20, 29);
      expect(result.page).toBe(3);
      expect(result.per_page).toBe(10);
      expect(result.total_pages).toBe(5);
    });

    it('applies status filter', async () => {
      chainable.range.mockResolvedValue({ data: [], error: null, count: 0 });

      await getVisitas({ status: StatusVisita.REALIZADA });

      expect(chainable.eq).toHaveBeenCalledWith('status', 'realizada');
    });

    it('applies agente_id filter', async () => {
      chainable.range.mockResolvedValue({ data: [], error: null, count: 0 });

      await getVisitas({ agente_id: 'agent-1' });

      expect(chainable.eq).toHaveBeenCalledWith('agente_id', 'agent-1');
    });

    it('applies periodo filters', async () => {
      chainable.range.mockResolvedValue({ data: [], error: null, count: 0 });

      await getVisitas({ periodo_inicio: '2024-01-01', periodo_fim: '2024-03-31' });

      expect(chainable.gte).toHaveBeenCalledWith('data_visita', '2024-01-01');
      // data_visita é timestamp: o último dia entra inteiro, até antes do dia seguinte.
      expect(chainable.lt).toHaveBeenCalledWith('data_visita', '2024-04-01');
      expect(chainable.lte).not.toHaveBeenCalled();
    });

    it('rejeita data final fora do formato do filtro', async () => {
      await expect(getVisitas({ periodo_fim: '31/03/2024' })).rejects.toThrow(
        'Data final do período inválida'
      );
    });

    it('filtra unidade pelo agente com !inner', async () => {
      chainable.range.mockResolvedValue({ data: [], error: null, count: 0 });

      await getVisitas({ unidade_saude: 'UBS Central' });

      expect(chainable.select).toHaveBeenCalledWith(
        expect.stringContaining('agente:agentes!inner('),
        { count: 'exact', head: false }
      );
      expect(chainable.eq).toHaveBeenCalledWith('agente.unidade_saude', 'UBS Central');
      expect(chainable.eq).not.toHaveBeenCalledWith('unidade_saude', expect.anything());
    });

    it('filtra bairro pela residência com !inner', async () => {
      chainable.range.mockResolvedValue({ data: [], error: null, count: 0 });

      await getVisitas({ bairro: 'Centro' });

      expect(chainable.select).toHaveBeenCalledWith(
        expect.stringContaining('residencia:residencias!inner('),
        { count: 'exact', head: false }
      );
      expect(chainable.eq).toHaveBeenCalledWith('residencia.bairro', 'Centro');
    });

    it('sem filtro de unidade ou bairro não usa !inner', async () => {
      chainable.range.mockResolvedValue({ data: [], error: null, count: 0 });

      await getVisitas();

      expect(chainable.select.mock.calls[0][0]).not.toContain('!inner');
    });

    it('throws on error', async () => {
      chainable.range.mockResolvedValue({ data: null, error: { message: 'DB error' }, count: null });

      await expect(getVisitas()).rejects.toThrow('Não foi possível buscar visitas');
    });
  });

  describe('getVisitaById', () => {
    it('returns single visita with details', async () => {
      const mockVisita = { id: 'v1', status: 'realizada', agente: { nome: 'Maria' } };
      chainable.single.mockResolvedValue({ data: mockVisita, error: null });

      const result = await getVisitaById('v1');

      expect(supabaseMock.from).toHaveBeenCalledWith('visitas');
      expect(chainable.eq).toHaveBeenCalledWith('id', 'v1');
      expect(chainable.single).toHaveBeenCalled();
      expect(result).toEqual(mockVisita);
    });

    it('returns null when not found (PGRST116)', async () => {
      chainable.single.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } });

      const result = await getVisitaById('nonexistent');

      expect(result).toBeNull();
    });

    it('throws on other errors', async () => {
      chainable.single.mockResolvedValue({ data: null, error: { code: 'OTHER', message: 'fail' } });

      await expect(getVisitaById('v1')).rejects.toThrow('Não foi possível buscar visita');
    });
  });

  describe('getVisitasByAgente', () => {
    it('filters by agente_id and returns array', async () => {
      const mockData = [{ id: 'v1' }];
      chainable.range.mockResolvedValue({ data: mockData, error: null });

      const result = await getVisitasByAgente('agent-1');

      expect(chainable.eq).toHaveBeenCalledWith('agente_id', 'agent-1');
      expect(result).toEqual(mockData);
    });

    it('traz todas as visitas do agente, mesmo acima de 1.000', async () => {
      const lote = (qtd: number, base: number) =>
        Array.from({ length: qtd }, (_, i) => ({ id: `v${base + i}` }));
      chainable.range
        .mockResolvedValueOnce({ data: lote(1000, 0), error: null })
        .mockResolvedValueOnce({ data: lote(3, 1000), error: null });

      const result = await getVisitasByAgente('agent-1');

      expect(result).toHaveLength(1003);
      expect(chainable.range).toHaveBeenNthCalledWith(1, 0, 999);
      expect(chainable.range).toHaveBeenNthCalledWith(2, 1000, 1999);
      expect(chainable.order).toHaveBeenCalledWith('id', { ascending: true });
    });

    it('applies optional filters', async () => {
      chainable.range.mockResolvedValue({ data: [], error: null });

      await getVisitasByAgente('agent-1', {
        status: StatusVisita.AGENDADA,
        periodo_inicio: '2024-01-01',
      });

      expect(chainable.eq).toHaveBeenCalledWith('agente_id', 'agent-1');
      expect(chainable.eq).toHaveBeenCalledWith('status', 'agendada');
      expect(chainable.gte).toHaveBeenCalledWith('data_visita', '2024-01-01');
    });

    it('throws on error', async () => {
      chainable.range.mockResolvedValue({ data: null, error: { message: 'fail' } });

      await expect(getVisitasByAgente('agent-1')).rejects.toThrow('Não foi possível buscar visitas do agente');
    });
  });

  describe('getEstatisticasVisitas', () => {
    it('returns correct stat counts using count queries', async () => {
      // The service uses Promise.all with 5 count queries (head:true).
      // Each query chain ends as a thenable. We mock from() to return
      // a chainable that resolves with the right count for each call.
      let callIndex = 0;
      const counts = [100, 40, 30, 20, 10]; // total, realizada, agendada, cancelada, nao_encontrado

      supabaseMock.from.mockImplementation(() => {
        const idx = callIndex++;
        const c: Record<string, jest.Mock> = {};
        c.select = jest.fn(() => c);
        c.eq = jest.fn(() => c);
        c.gte = jest.fn(() => c);
        c.lte = jest.fn(() => c);
        c.is = jest.fn(() => c);
        // Make the chain thenable
        c.then = jest.fn((resolve: (v: unknown) => void) => resolve({ count: counts[idx] ?? 0, error: null }));
        return c;
      });

      const result = await getEstatisticasVisitas();

      expect(result.total).toBe(100);
      expect(result.realizadas).toBe(40);
      expect(result.agendadas).toBe(30);
      expect(result.canceladas).toBe(20);
      expect(result.nao_encontrado).toBe(10);
      expect(result.taxa_conclusao).toBe(40); // 40/100 * 100
    });

    it('sem visitas devolve zero, não números de demonstração', async () => {
      supabaseMock.from.mockImplementation(() => {
        const c: Record<string, jest.Mock> = {};
        c.select = jest.fn(() => c);
        c.eq = jest.fn(() => c);
        c.gte = jest.fn(() => c);
        c.lte = jest.fn(() => c);
        c.is = jest.fn(() => c);
        c.then = jest.fn((resolve: (v: unknown) => void) => resolve({ count: 0, error: null }));
        return c;
      });

      const result = await getEstatisticasVisitas();

      expect(result).toEqual({
        total: 0, realizadas: 0, agendadas: 0, canceladas: 0, nao_encontrado: 0, taxa_conclusao: 0,
      });
    });

    it('lança o erro da contagem em vez de mostrar zero', async () => {
      supabaseMock.from.mockImplementation(() => {
        const c: Record<string, jest.Mock> = {};
        c.select = jest.fn(() => c);
        c.eq = jest.fn(() => c);
        c.then = jest.fn((resolve: (v: unknown) => void) =>
          resolve({ count: null, error: { message: 'sem permissão' } }));
        return c;
      });

      await expect(getEstatisticasVisitas()).rejects.toThrow('Não foi possível contar visitas');
    });

    it('conta por unidade pelo agente, não por coluna da visita', async () => {
      const cadeias: Array<Record<string, jest.Mock>> = [];
      supabaseMock.from.mockImplementation(() => {
        const c: Record<string, jest.Mock> = {};
        c.select = jest.fn(() => c);
        c.eq = jest.fn(() => c);
        c.gte = jest.fn(() => c);
        c.lt = jest.fn(() => c);
        c.then = jest.fn((resolve: (v: unknown) => void) => resolve({ count: 4, error: null }));
        cadeias.push(c);
        return c;
      });

      await getEstatisticasVisitas({ unidade_saude: 'UBS Norte', periodo_fim: '2024-02-29' });

      expect(cadeias).toHaveLength(5);
      for (const c of cadeias) {
        expect(c.select).toHaveBeenCalledWith('id, agente:agentes!inner(id)', { count: 'exact', head: true });
        expect(c.eq).toHaveBeenCalledWith('agente.unidade_saude', 'UBS Norte');
        expect(c.eq).not.toHaveBeenCalledWith('unidade_saude', expect.anything());
        expect(c.lt).toHaveBeenCalledWith('data_visita', '2024-03-01');
      }
    });
  });
});
