jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@/lib/supabase/client';
import {
  getDashboardStats,
  getVisitasPorPeriodo,
  getVisitasPorAgente,
  getVisitasRecentes,
  getAlertasAtraso,
} from '../dashboardService';
import type { DashboardStats, VisitaPorPeriodo, VisitaPorAgente, VisitaComDetalhes, FamiliaEmAtraso } from '@/types';

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
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
  };

  const mock = {
    from: jest.fn(() => chainable),
    rpc: jest.fn(),
  };

  return { mock, chainable };
}

describe('dashboardService', () => {
  let supabaseMock: ReturnType<typeof buildMockSupabase>['mock'];
  let chainable: ReturnType<typeof buildMockSupabase>['chainable'];

  beforeEach(() => {
    jest.clearAllMocks();
    const built = buildMockSupabase();
    supabaseMock = built.mock;
    chainable = built.chainable;
    mockCreateClient.mockReturnValue(supabaseMock as unknown as ReturnType<typeof createClient>);
  });

  describe('getDashboardStats', () => {
    const mockStats: DashboardStats = {
      visitas_hoje: 10,
      visitas_semana: 50,
      visitas_mes: 200,
      total_familias: 100,
      total_moradores: 400,
      agentes_ativos: 15,
      visitas_realizadas: 180,
      visitas_pendentes: 20,
      taxa_conclusao: 90,
    };

    it('calls rpc with correct function name and returns stats', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: mockStats, error: null });

      const result = await getDashboardStats();

      expect(supabaseMock.rpc).toHaveBeenCalledWith('fn_dashboard_stats', {});
      expect(result).toEqual(mockStats);
    });

    it('passes filter params to rpc', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: mockStats, error: null });

      await getDashboardStats({ unidade_saude: 'UBS Centro', agente_id: 'abc-123' });

      expect(supabaseMock.rpc).toHaveBeenCalledWith('fn_dashboard_stats', {
        p_unidade: 'UBS Centro',
        p_agente_id: 'abc-123',
      });
    });

    it('returns defaults when rpc fails', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'DB error' } });

      const result = await getDashboardStats();

      // Service logs error and returns defaults, does NOT throw
      expect(result.visitas_hoje).toBe(0);
      expect(result.total_familias).toBe(0);
    });

    it('returns defaults when data is null', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: null, error: null });

      const result = await getDashboardStats();

      expect(result.visitas_hoje).toBe(0);
      expect(result.total_familias).toBe(0);
    });
  });

  describe('getVisitasPorPeriodo', () => {
    const mockData: VisitaPorPeriodo[] = [
      { data: '2024-03-01', total_visitas: 5, realizadas: 4, canceladas: 1, nao_encontrado: 0 },
    ];

    it('calls rpc with dates and returns array', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: mockData, error: null });

      const result = await getVisitasPorPeriodo('2024-03-01', '2024-03-31');

      expect(supabaseMock.rpc).toHaveBeenCalledWith('fn_visitas_por_periodo', {
        p_inicio: '2024-03-01',
        p_fim: '2024-03-31',
      });
      expect(result).toEqual(mockData);
    });

    it('passes optional unidade filter', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: mockData, error: null });

      await getVisitasPorPeriodo('2024-03-01', '2024-03-31', { unidade_saude: 'UBS Norte' });

      expect(supabaseMock.rpc).toHaveBeenCalledWith('fn_visitas_por_periodo', {
        p_inicio: '2024-03-01',
        p_fim: '2024-03-31',
        p_unidade: 'UBS Norte',
      });
    });

    it('returns empty array on error', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'fail' } });

      const result = await getVisitasPorPeriodo('2024-03-01', '2024-03-31');

      // Service logs error and returns [], does NOT throw
      expect(result).toEqual([]);
    });

    it('returns empty array when data is null', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: null, error: null });

      const result = await getVisitasPorPeriodo('2024-03-01', '2024-03-31');
      expect(result).toEqual([]);
    });
  });

  describe('getVisitasPorAgente', () => {
    const mockData: VisitaPorAgente[] = [
      { agente_id: '1', nome: 'Maria', total: 10, realizadas: 8, pendentes: 2, taxa: 80 },
    ];

    it('calls rpc with dates and returns data', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: mockData, error: null });

      const result = await getVisitasPorAgente('2024-03-01', '2024-03-31');

      expect(supabaseMock.rpc).toHaveBeenCalledWith('fn_visitas_por_agente', {
        p_inicio: '2024-03-01',
        p_fim: '2024-03-31',
      });
      expect(result).toEqual(mockData);
    });

    it('passes optional unidade filter', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: mockData, error: null });

      await getVisitasPorAgente('2024-03-01', '2024-03-31', { unidade_saude: 'UBS Norte' });

      expect(supabaseMock.rpc).toHaveBeenCalledWith('fn_visitas_por_agente', {
        p_inicio: '2024-03-01',
        p_fim: '2024-03-31',
        p_unidade: 'UBS Norte',
      });
    });

    it('returns empty array on error', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'fail' } });

      const result = await getVisitasPorAgente('2024-03-01', '2024-03-31');

      expect(result).toEqual([]);
    });
  });

  describe('getVisitasRecentes', () => {
    const mockVisitas: Partial<VisitaComDetalhes>[] = [
      { id: 'v1', data_visita: '2024-03-15', status: 'realizada' as never },
    ];

    it('queries visitas with joins and default limit', async () => {
      chainable.limit.mockResolvedValue({ data: mockVisitas, error: null });

      const result = await getVisitasRecentes();

      expect(supabaseMock.from).toHaveBeenCalledWith('visitas');
      expect(chainable.select).toHaveBeenCalledWith(
        expect.stringContaining('agente:agentes')
      );
      expect(chainable.order).toHaveBeenCalledWith('data_visita', { ascending: false });
      expect(chainable.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockVisitas);
    });

    it('applies custom limit', async () => {
      chainable.limit.mockResolvedValue({ data: mockVisitas, error: null });

      await getVisitasRecentes(5);

      expect(chainable.limit).toHaveBeenCalledWith(5);
    });

    it('returns empty array on error', async () => {
      chainable.limit.mockResolvedValue({ data: null, error: { message: 'fail' } });

      const result = await getVisitasRecentes();

      // Service logs error and returns [], does NOT throw
      expect(result).toEqual([]);
    });
  });

  describe('getAlertasAtraso', () => {
    const mockAlertas: Partial<FamiliaEmAtraso>[] = [
      { residencia_id: 'r1', dias_sem_visita: 45, agente_nome: 'Jose' },
    ];

    it('calls rpc with default 30 days', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: mockAlertas, error: null });

      const result = await getAlertasAtraso();

      expect(supabaseMock.rpc).toHaveBeenCalledWith('fn_familias_em_atraso', {
        p_dias: 30,
      });
      expect(result).toEqual(mockAlertas);
    });

    it('passes custom days parameter', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: mockAlertas, error: null });

      await getAlertasAtraso(50);

      expect(supabaseMock.rpc).toHaveBeenCalledWith('fn_familias_em_atraso', {
        p_dias: 50,
      });
    });

    it('returns empty array on error', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'fail' } });

      const result = await getAlertasAtraso();

      expect(result).toEqual([]);
    });
  });
});
