'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Server action for sign out.
 * Uses the server-side Supabase client so cookies are properly cleared
 * before the redirect — preventing the middleware from seeing a stale session.
 */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
