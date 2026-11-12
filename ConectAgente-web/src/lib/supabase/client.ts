'use client';

import { createBrowserClient } from '@supabase/ssr';
import { opcoesDoCookieDeSessao } from '@/lib/sessao';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    // Mesmo cookie do servidor: Secure, Lax e 30 minutos (ver lib/sessao.ts).
    { cookieOptions: opcoesDoCookieDeSessao() },
  );
}
