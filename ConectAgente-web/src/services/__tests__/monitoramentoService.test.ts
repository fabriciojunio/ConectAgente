jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/services/familiaService', () => ({
  getFamiliasEmAtraso: jest.fn(),
}));

import { createClient } from '@/lib/supabase/client';
import { getCoberturaPorMicroarea, getMapaCobertura } from '../monitoramentoService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function buildMockSupabase() {
  return {
    mock: {
      from: jest.fn(),
      rpc: jest.fn(),
    },
  };
}

describe('monitoramentoService', () => {
  let supabaseMock: ReturnType<typeof buildMockSupabase>['mock'];

  beforeEach(() => {
    jest.clearAllMocks();
    const built = buildMockSupabase();
    supabaseMock = built.mock;
    mockCreateClient.mockReturnValue(supabaseMock as unknown as ReturnType<typeof createClient>);
  });

  describe('getCoberturaPorMicroarea', () => {
    it('should call RPC with unidade filter', async () => {
      supabaseMock.rpc.mockResolvedValue({
        data: [{ microarea: 'M1', total_familias: 50, familias_visitadas_30d: 40, cobertura_pct: 80 }],
        error: null,
      });

      const result = await getCoberturaPorMicroarea({ unidade_saude: 'UBS 1' });

      expect(supabaseMock.rpc).toHaveBeenCalledWith('fn_cobertura_por_microarea', { p_unidade: 'UBS 1' });
      expect(result).toHaveLength(1);
      expect(result[0].cobertura_pct).toBe(80);
    });

    it('should call RPC without params when no filter', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: [], error: null });

      await getCoberturaPorMicroarea();

      expect(supabaseMock.rpc).toHaveBeenCalledWith('fn_cobertura_por_microarea', {});
    });

    it('should throw on error', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

      await expect(getCoberturaPorMicroarea()).rejects.toThrow('Erro ao buscar cobertura');
    });
  });

  describe('getMapaCobertura', () => {
    it('should call RPC with date range', async () => {
      const mockBairros = [
        { bairro: 'Centro', total_visitas: 100, total_familias: 200, cobertura_pct: 50 },
      ];
      supabaseMock.rpc.mockResolvedValue({ data: mockBairros, error: null });

      const result = await getMapaCobertura('2024-01-01', '2024-01-31');

      expect(supabaseMock.rpc).toHaveBeenCalledWith('fn_visitas_por_bairro', {
        p_inicio: '2024-01-01',
        p_fim: '2024-01-31',
      });
      expect(result).toHaveLength(1);
    });

    it('should throw on error', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } });

      await expect(getMapaCobertura('2024-01-01', '2024-01-31')).rejects.toThrow('Erro ao buscar mapa de cobertura');
    });
  });
});
