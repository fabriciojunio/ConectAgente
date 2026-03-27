'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';

// useLayoutEffect on client (runs before paint), useEffect on server (avoids SSR warning)
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
import { createClient } from '@/lib/supabase/client';
import type { Session } from '@supabase/supabase-js';
import type { AuthUser, UserRole } from '@/types';

interface UseAuthReturn {
  /** Current authenticated user profile (from agentes table) */
  user: AuthUser | null;
  /** Current Supabase session */
  session: Session | null;
  /** Whether auth state is still loading */
  loading: boolean;
  /** Sign in with email and password */
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Sign out and redirect to login */
  signOut: () => Promise<void>;
  /** Whether the current user has admin role */
  isAdmin: boolean;
  /** Whether the current user has supervisor role */
  isSupervisor: boolean;
}

/**
 * Authentication hook that manages user session and profile data.
 * Fetches the user profile from the agentes table (including role)
 * and provides role-checking helpers.
 */
const SESSION_KEY = 'ca_user_profile';

function readCachedUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function useAuth(): UseAuthReturn {
  // Start with null to match server render (avoids hydration mismatch)
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore cached profile before first paint (useLayoutEffect on client)
  useIsomorphicLayoutEffect(() => {
    const cached = readCachedUser();
    if (cached) {
      setUser(cached);
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClient(), []);

  /** Fetch the user profile from the agentes table */
  const fetchProfile = useCallback(
    async (userId: string, userEmail?: string) => {
      try {
        // Try by auth user ID first
        const byId = await supabase
          .from('agentes')
          .select('id, nome, email, role, unidade_saude, area_atuacao')
          .eq('id', userId)
          .maybeSingle();

        let data = byId?.data ?? null;

        // If not found by ID, try by CPF extracted from email (02363006607@conectagente.local)
        if (!data && userEmail) {
          const cpf = userEmail.split('@')[0];
          if (cpf && /^\d{11}$/.test(cpf)) {
            const byCpf = await supabase
              .from('agentes')
              .select('id, nome, email, role, unidade_saude, area_atuacao')
              .eq('cpf', cpf)
              .maybeSingle();
            data = byCpf?.data ?? null;
          }
        }

        if (!data) {
          // Profile not found — do not clear existing user state; just leave as-is
          return;
        }

        const profile: AuthUser = {
          id: data.id,
          nome: data.nome,
          email: data.email,
          role: data.role as UserRole,
          unidade_saude: data.unidade_saude,
          area_atuacao: data.area_atuacao,
        };
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(profile)); } catch { /* ignore */ }
        setUser(profile);
      } catch (err) {
        console.error('Unexpected error fetching profile:', err);
        // Do not clear user on network error — middleware already verified the session
      }
    },
    [supabase],
  );

  useEffect(() => {
    let mounted = true;

    // Safety timeout: force loading to false after 8 seconds
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 8000);

    // Get initial session
    const initAuth = async () => {
      try {
        // getSession() reads from localStorage — instant, no network call.
        // Use this to render the UI fast, then validate the JWT in the background.
        const { data: { session: cachedSession } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (cachedSession?.user) {
          setSession(cachedSession);
          await fetchProfile(cachedSession.user.id, cachedSession.user.email);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        if (mounted) {
          setLoading(false);
          clearTimeout(timeout);
        }
      }

      // JWT validation is handled by middleware on the server — no client-side clearing needed.
    };

    initAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      setSession(newSession);

      if (event === 'SIGNED_IN' && newSession?.user) {
        await fetchProfile(newSession.user.id, newSession.user.email);
      } else if (event === 'SIGNED_OUT') {
        try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  /** Sign in with email and password */
  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          return { error: error.message };
        }

        return { error: null };
      } catch {
        return { error: 'Erro inesperado ao fazer login. Tente novamente.' };
      }
    },
    [supabase],
  );

  /** Sign out and clear state */
  const signOut = useCallback(async () => {
    // Clear state immediately so UI reacts at once
    setUser(null);
    setSession(null);
    // Fire signOut but don't wait more than 3s — redirect regardless
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch {
      // ignore errors — redirect anyway
    }
    window.location.replace('/login');
  }, [supabase]);

  const role = user?.role;

  return {
    user,
    session,
    loading,
    signIn,
    signOut,
    isAdmin: role === 'admin',
    isSupervisor: role === 'supervisor',
  };
}
