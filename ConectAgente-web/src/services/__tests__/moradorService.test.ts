jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@/lib/supabase/client';
import { getMoradores, getEstatisticasMoradores } from '../moradorService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function buildMockSupabase() {
  const chainable = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
  };

  return {
    mock: { from: jest.fn(() => chainable) },
    chainable,
  };
}

describe('moradorService', () => {
  let supabaseMock: ReturnType<typeof buildMockSupabase>['mock'];
  let chainable: ReturnType<typeof buildMockSupabase>['chainable'];

  beforeEach(() => {
    jest.clearAllMocks();
    const built = buildMockSupabase();
    supabaseMock = built.mock;
    chainable = built.chainable;
    mockCreateClient.mockReturnValue(supabaseMock as unknown as ReturnType<typeof createClient>);
  });

  describe('getMoradores', () => {
    it('should return paginated moradores', async () => {
      const mockData = [{ id: '1', nome: 'Maria' }];
      chainable.range.mockResolvedValue({ data: mockData, error: null, count: 1 });

      const result = await getMoradores(undefined, { page: 1, per_page: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.per_page).toBe(20);
    });

    it('should filter by agente_id', async () => {
      chainable.range.mockResolvedValue({ data: [], error: null, count: 0 });

      await getMoradores({ agente_id: 'agent-1' });

      expect(chainable.eq).toHaveBeenCalledWith('agente_id', 'agent-1');
    });

    it('should throw on error', async () => {
      chainable.range.mockResolvedValue({ data: null, error: { message: 'DB error' }, count: 0 });

      await expect(getMoradores()).rejects.toThrow('Erro ao buscar moradores');
    });
  });

  describe('getEstatisticasMoradores', () => {
    it('should return health statistics using count queries', async () => {
      // The service uses 6 parallel count queries via Promise.all.
      // Each from() call should return a thenable chain that resolves with { count: N }.
      let callIndex = 0;
      const counts = [100, 20, 15, 5, 8, 30]; // total, hip, diab, gest, dom, doenca

      supabaseMock.from.mockImplementation(() => {
        const idx = callIndex++;
        const c: Record<string, jest.Mock> = {};
        c.select = jest.fn(() => c);
        c.eq = jest.fn(() => c);
        c.is = jest.fn(() => c);
        // Make it thenable so await resolves with count data
        c.then = jest.fn((resolve: (v: unknown) => void) => resolve({ count: counts[idx] ?? 0, error: null }));
        return c;
      });

      const result = await getEstatisticasMoradores();

      expect(result.total).toBe(100);
      expect(result.hipertensos).toBe(20);
      expect(result.diabeticos).toBe(15);
      expect(result.gestantes).toBe(5);
      expect(result.domiciliados).toBe(8);
      expect(result.com_doenca).toBe(30);
    });
  });
});
