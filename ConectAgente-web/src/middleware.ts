import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { validarOrigem } from '@/lib/csrf';

/** Rotas que exigem papel de gerente ou admin */
const ADMIN_ROUTES = ['/admin', '/admin/usuarios'];

/** Routes that do not require authentication */
const PUBLIC_ROUTES = ['/login', '/registro', '/demo'];

/**
 * Next.js middleware for authentication, role-based access control,
 * and security headers.
 *
 * - Redirects unauthenticated users to /login
 * - Redirects authenticated users from /login to /dashboard
 * - Restringe as rotas administrativas a gerente e admin
 * - Sets security headers on all responses
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Barreira anti-CSRF antes de qualquer outra coisa.
  //
  // Server Action e rota de API sao endpoints HTTP, e o navegador manda o
  // cookie de sessao em requisicao disparada de outro site. Sem conferir a
  // origem, uma pagina maliciosa aberta noutra aba consegue escrever no
  // prontuario em nome de quem esta logado. O Next protege Server Action por
  // conta propria, mas nao cobre rota de API, e defesa que depende de uma
  // camada so some quando aquela camada muda.
  const csrf = validarOrigem(
    request.method,
    request.headers.get('origin'),
    request.headers.get('referer'),
    request.headers.get('host')
  );
  if (!csrf.permitido) {
    return new NextResponse(csrf.motivo, { status: csrf.status });
  }

  // Create a response that we can modify
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Create Supabase client with cookie handling for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }: { name: string; value: string }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: Record<string, unknown> }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Refresh session (important for token rotation)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route);
  const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));

  // Redirect unauthenticated users to login
  if (!user && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login
  if (user && isPublicRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Role-based access control for admin routes
  if (user && isAdminRoute) {
    const { data: agente } = await supabase
      .from('agentes')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    // Mesma regra da policy de RLS `audit_log_select`, que libera para
    // ('gerente', 'admin'). A lista anterior pedia 'supervisor', papel que o
    // CHECK de agentes.role nao aceita: nenhum usuario real tinha esse papel,
    // entao o portao redirecionava todo mundo, inclusive gerente.
    if (!agente || !['admin', 'gerente'].includes(agente.role)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Set security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains',
  );

  return response;
}

/**
 * Middleware matcher configuration.
 * Matches all routes except Next.js internals and static files.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
