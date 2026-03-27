jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@/lib/supabase/client';
import { getUsuarios, getUsuarioById, atualizarRole, toggleAtivoUsuario } from '../adminService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function buildMockSupabase() {
  const chainable = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };

  return {
    mock: {
      from: jest.fn(() => chainable),
      rpc: jest.fn(),
    },
    chainable,
  };
}

describe('adminService', () => {
  let supabaseMock: ReturnType<typeof buildMockSupabase>['mock'];
  let chainable: ReturnType<typeof buildMockSupabase>['chainable'];

  beforeEach(() => {
    jest.clearAllMocks();
    const built = buildMockSupabase();
    supabaseMock = built.mock;
    chainable = built.chainable;
    mockCreateClient.mockReturnValue(supabaseMock as unknown as ReturnType<typeof createClient>);
  });

  describe('getUsuarios', () => {
    it('should return paginated users', async () => {
      const mockUsers = [{ id: '1', nome: 'Admin', role: 'admin' }];
      chainable.range.mockResolvedValue({ data: mockUsers, error: null, count: 1 });

      const result = await getUsuarios({ page: 1, per_page: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(supabaseMock.from).toHaveBeenCalledWith('agentes');
    });

    it('should throw on error', async () => {
      chainable.range.mockResolvedValue({ data: null, error: { message: 'Forbidden' }, count: 0 });

      await expect(getUsuarios()).rejects.toThrow('Erro ao buscar usuários');
    });
  });

  describe('getUsuarioById', () => {
    it('should return user by id', async () => {
      const mockUser = { id: '1', nome: 'Admin' };
      chainable.single.mockResolvedValue({ data: mockUser, error: null });

      const result = await getUsuarioById('1');

      expect(result).toEqual(mockUser);
    });

    it('should return null for non-existent user', async () => {
      chainable.single.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'not found' } });

      const result = await getUsuarioById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('atualizarRole', () => {
    it('should update user role', async () => {
      chainable.eq.mockResolvedValue({ error: null });

      await expect(atualizarRole('1', 'supervisor')).resolves.not.toThrow();

      expect(supabaseMock.from).toHaveBeenCalledWith('agentes');
      expect(chainable.update).toHaveBeenCalled();
    });

    it('should throw on error', async () => {
      chainable.eq.mockResolvedValue({ error: { message: 'Forbidden' } });

      await expect(atualizarRole('1', 'admin')).rejects.toThrow('Erro ao atualizar role');
    });
  });

  describe('toggleAtivoUsuario', () => {
    it('should toggle user active status', async () => {
      chainable.eq.mockResolvedValue({ error: null });

      await expect(toggleAtivoUsuario('1', false)).resolves.not.toThrow();

      expect(chainable.update).toHaveBeenCalled();
    });
  });
});
