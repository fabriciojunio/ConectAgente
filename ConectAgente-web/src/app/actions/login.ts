'use server';

import { headers } from 'next/headers';
import { rateLimit } from '@/lib/rateLimit';
import { ipDoCliente } from '@/lib/ipDoCliente';

/**
 * Server-side rate limit check for login attempts.
 * Called from the client login page before attempting authentication.
 * Limits to 5 login attempts per minute per IP to prevent brute force attacks.
 */
export async function checkLoginRateLimit(
  cpf: string
): Promise<{ allowed: boolean; error?: string }> {
  const headersList = await headers();
  const ip = ipDoCliente(headersList);

  // Rate limit by IP (broad protection)
  const ipCheck = await rateLimit(`login_ip:${ip}`, 10, 60_000);
  if (!ipCheck.allowed) {
    return {
      allowed: false,
      error: `Muitas tentativas. Aguarde ${Math.ceil(ipCheck.retryAfterMs / 1000)} segundos.`,
    };
  }

  // Rate limit by CPF (targeted brute force protection)
  const cpfCheck = await rateLimit(`login_cpf:${cpf}`, 5, 60_000);
  if (!cpfCheck.allowed) {
    return {
      allowed: false,
      error: `Muitas tentativas para este CPF. Aguarde ${Math.ceil(cpfCheck.retryAfterMs / 1000)} segundos.`,
    };
  }

  return { allowed: true };
}
