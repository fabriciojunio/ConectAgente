jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

import { renderHook, act, waitFor } from '@testing-library/react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '../useAuth';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function buildMockSupabase() {
  const mock = {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      signInWithPassword: jest.fn(),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: jest.fn((callback: (event: string, session: unknown) => void) => {
        return {
          data: {
            subscription: { unsubscribe: jest.fn() },
          },
        };
      }),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  };

  return { mock };
}

// Mock window.location
const originalLocation = window.location;
beforeAll(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { href: '', replace: jest.fn() },
  });
});
afterAll(() => {
  window.location = originalLocation;
});

describe('useAuth', () => {
  let supabaseMock: ReturnType<typeof buildMockSupabase>['mock'];

  beforeEach(() => {
    jest.clearAllMocks();
    const built = buildMockSupabase();
    supabaseMock = built.mock;
    mockCreateClient.mockReturnValue(supabaseMock as unknown as ReturnType<typeof createClient>);
    window.location.href = '';
    (window.location.replace as jest.Mock).mockClear();
    // Clear sessionStorage to avoid leaking between tests
    try { sessionStorage.clear(); } catch { /* ignore */ }
  });

  it('returns loading true initially', () => {
    // Make getSession hang so loading stays true
    supabaseMock.auth.getSession.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('returns user after session loads', async () => {
    const mockSession = {
      user: { id: 'user-1', email: 'maria@test.com' },
    };
    const mockProfile = {
      id: 'user-1',
      nome: 'Maria Silva',
      email: 'maria@test.com',
      role: 'admin',
      unidade_saude: 'UBS Centro',
      area_atuacao: 'Area 1',
    };

    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const profileChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
    };
    supabaseMock.from.mockReturnValue(profileChain as never);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual({
      id: 'user-1',
      nome: 'Maria Silva',
      email: 'maria@test.com',
      role: 'admin',
      unidade_saude: 'UBS Centro',
      area_atuacao: 'Area 1',
    });
  });

  it('signOut clears session and redirects', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(supabaseMock.auth.signOut).toHaveBeenCalled();
    expect(window.location.replace).toHaveBeenCalledWith('/login');
  });

  it('isAdmin returns true for admin role', async () => {
    const mockSession = { user: { id: 'user-1', email: 'admin@test.com' } };
    const mockProfile = {
      id: 'user-1',
      nome: 'Admin User',
      email: 'admin@test.com',
      role: 'admin',
      unidade_saude: 'UBS',
      area_atuacao: 'Area 1',
    };

    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const profileChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
    };
    supabaseMock.from.mockReturnValue(profileChain as never);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isSupervisor).toBe(false);
  });

  it('isSupervisor returns true for supervisor role', async () => {
    const mockSession = { user: { id: 'user-2', email: 'supervisor@test.com' } };
    const mockProfile = {
      id: 'user-2',
      nome: 'Supervisor User',
      email: 'supervisor@test.com',
      role: 'supervisor',
      unidade_saude: 'UBS',
      area_atuacao: 'Area 2',
    };

    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const profileChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
    };
    supabaseMock.from.mockReturnValue(profileChain as never);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isSupervisor).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it('returns loading false and null user when no session', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isSupervisor).toBe(false);
  });

  it('signIn calls supabase auth with credentials', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let signInResult: { error: string | null } = { error: null };
    await act(async () => {
      signInResult = await result.current.signIn('test@test.com', 'password123');
    });

    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'password123',
    });
    expect(signInResult.error).toBeNull();
  });

  it('signIn returns error message on failure', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid credentials' },
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let signInResult: { error: string | null } = { error: null };
    await act(async () => {
      signInResult = await result.current.signIn('test@test.com', 'wrong');
    });

    expect(signInResult.error).toBe('Invalid credentials');
  });
});
