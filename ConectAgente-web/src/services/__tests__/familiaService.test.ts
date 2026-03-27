jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@/lib/supabase/client';
import { getFamilias, getFamiliaById, getFamiliasEmAtraso, getMoradoresByFamilia, getHistoricoVisitas } from '../familiaService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function buildMockSupabase() {
  const chainable = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
  };

  const mock = {
    from: jest.fn(() => chainable),
    rpc: jest.fn(),
  };

  return { mock, chainable };
}

describe('familiaService', () => {
  let supabaseMock: ReturnType<typeof buildMockSupabase>['mock'];
  let chainable: ReturnType<typeof buildMockSupabase>['chainable'];

  beforeEach(() => {
    jest.clearAllMocks();
    const built = buildMockSupabase();
    supabaseMock = built.mock;
    chainable = built.chainable;
    mockCreateClient.mockReturnValue(supabaseMock as unknown as ReturnType<typeof createClient>);
  });

  describe('getFamilias', () => {
    it('should return paginated families', async () => {
      const mockData = [{ id: '1', logradouro: 'Rua A', numero: '10', bairro: 'Centro' }];
      chainable.range.mockResolvedValue({ data: mockData, error: null, count: 1 });

      const result = await getFamilias(undefined, { page: 1, per_page: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(supabaseMock.from).toHaveBeenCalledWith('residencias');
    });

    it('should apply filters', async () => {
      chainable.range.mockResolvedValue({ data: [], error: null, count: 0 });

      await getFamilias({ bairro: 'Centro', agente_id: 'agent-1' });

      expect(chainable.eq).toHaveBeenCalledWith('bairro', 'Centro');
      expect(chainable.eq).toHaveBeenCalledWith('agente_id', 'agent-1');
    });

    it('should throw on error', async () => {
      chainable.range.mockResolvedValue({ data: null, error: { message: 'DB error' }, count: 0 });

      await expect(getFamilias()).rejects.toThrow('Erro ao buscar famílias');
    });
  });

  describe('getFamiliaById', () => {
    it('should return family by id', async () => {
      const mockData = { id: '1', logradouro: 'Rua A' };
      chainable.single.mockResolvedValue({ data: mockData, error: null });

      const result = await getFamiliaById('1');

      expect(result).toEqual(mockData);
    });

    it('should return null when not found', async () => {
      chainable.single.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'not found' } });

      const result = await getFamiliaById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getFamiliasEmAtraso', () => {
    it('should call RPC with correct parameters', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: [], error: null });

      await getFamiliasEmAtraso(30, { unidade_saude: 'UBS Centro' });

      expect(supabaseMock.rpc).toHaveBeenCalledWith('fn_familias_em_atraso', {
        p_dias: 30,
        p_unidade: 'UBS Centro',
      });
    });

    it('should throw on RPC error', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

      await expect(getFamiliasEmAtraso(30)).rejects.toThrow('Erro ao buscar famílias em atraso');
    });
  });

  describe('getMoradoresByFamilia', () => {
    it('should return moradores for a residence', async () => {
      const mockData = [{ id: '1', nome: 'Joao' }];
      chainable.order.mockResolvedValue({ data: mockData, error: null });

      const result = await getMoradoresByFamilia('res-1');

      expect(result).toHaveLength(1);
      expect(supabaseMock.from).toHaveBeenCalledWith('moradores');
      expect(chainable.eq).toHaveBeenCalledWith('residencia_id', 'res-1');
    });
  });

  describe('getHistoricoVisitas', () => {
    it('should return visit history ordered by date desc', async () => {
      const mockData = [
        { id: '1', data_visita: '2024-01-15', status: 'realizada' },
        { id: '2', data_visita: '2024-01-10', status: 'agendada' },
      ];
      chainable.order.mockResolvedValue({ data: mockData, error: null });

      const result = await getHistoricoVisitas('res-1');

      expect(result).toHaveLength(2);
      expect(chainable.order).toHaveBeenCalledWith('data_visita', { ascending: false });
    });
  });
});
