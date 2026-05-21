import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Routes that require admin or gerente role */
const ADMIN_ROUTES = ['/admin', '/admin/usuarios'];

/** Routes that do not require authentication */
const PUBLIC_ROUTES = ['/login', '/registro', '/demo'];

/**
 * Next.js middleware for authentication, role-based access control,
 * and security headers.
 *
 * - Redirects unauthenticated users to /login
 * - Redirects authenticated users from /login to /dashboard
 * - Restricts admin routes to gerente/admin roles
 * - Sets security headers on all responses
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Create a response that we can modify
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Create Supabase client with cookie handling for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    if (!agente || !['admin', 'supervisor'].includes(agente.role)) {
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
