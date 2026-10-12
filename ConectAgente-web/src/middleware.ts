import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { validarOrigem } from '@/lib/csrf';

/** Rotas que exigem papel de gerente ou admin */
const ADMIN_ROUTES = ['/admin', '/admin/usuarios'];

/** Rotas abertas, que redirecionam para a raiz quando ja ha sessao. */
const PUBLIC_ROUTES = ['/login', '/registro', '/demo'];

/**
 * Rotas que ficam fora da logica de autenticacao por inteiro.
 *
 * Nao basta serem "publicas": a regra que manda quem ja esta logado de volta
 * para a raiz tambem nao pode valer aqui. Medido antes da correcao, com o
 * build de producao servindo:
 *
 *   GET /api/health   307  ->  /login?redirect=%2Fapi%2Fhealth
 *   GET /robots.txt   307  ->  /login?redirect=%2Frobots.txt
 *
 * Um endpoint de saude que exige login nao serve para monitoramento, porque
 * monitor nao faz login: o alerta diria que o sistema caiu toda vez que ele
 * estivesse de pe. E robots.txt atras de login nao e lido por robo nenhum,
 * o que anula justamente a instrucao de nao indexar um sistema com dado de
 * saude.
 *
 * A resposta do /api/health ja e cuidadosa com o que mostra: nunca devolve
 * mensagem do banco nem nome de variavel, so o estado.
 */
const ROTAS_SEM_AUTENTICACAO = ['/api/health', '/robots.txt', '/favicon.ico'];

/**
 * Monta a politica de seguranca de conteudo com um nonce novo por requisicao.
 *
 * Por que trocar `'unsafe-inline'` por nonce. Com `'unsafe-inline'`, qualquer
 * script que um atacante consiga injetar na pagina executa: a politica diz ao
 * navegador que script embutido e aceitavel, e ele nao tem como distinguir o
 * do Next do injetado. Isso transforma um XSS pequeno em leitura do prontuario
 * de todos os pacientes, porque o script roda com a sessao de quem esta
 * logado.
 *
 * Com nonce, so executa o script que carrega o valor sorteado nesta
 * requisicao. O atacante nao tem como adivinhar: o valor muda a cada
 * resposta e nunca aparece em lugar que ele consiga ler.
 *
 * `'strict-dynamic'` acompanha porque o Next carrega o resto do pacote a
 * partir do script inicial. Sem ele, cada pedaco carregado dinamicamente
 * seria bloqueado.
 *
 * O `style-src` continua com `'unsafe-inline'`: o Tailwind e o `next/font`
 * injetam estilo embutido, e nao ha caminho de nonce para estilo no Next hoje.
 * Estilo injetado tem superficie de ataque muito menor que script, e o resto
 * da politica continua fechando o que importa.
 */
function montarCsp(nonce: string, desenvolvimento: boolean): string {
  const script = desenvolvimento
    ? // `unsafe-eval` e exigido pelo Fast Refresh, e so existe em
      // desenvolvimento. `unsafe-inline` fica junto porque navegador que
      // entende nonce ignora, e o que nao entende precisa dele.
      `script-src 'self' 'unsafe-eval' 'unsafe-inline' 'nonce-${nonce}' 'strict-dynamic'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    "default-src 'self'",
    script,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(desenvolvimento ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

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
  // Nonce novo a cada requisicao. O Next le o cabecalho `x-nonce` e carimba
  // os proprios scripts com ele, entao a politica pode recusar todo o resto.
  //
  // Calculado antes da barreira de CSRF de proposito: a resposta 403 tem
  // corpo, e resposta com corpo sem politica e resposta sem protecao.
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = montarCsp(nonce, process.env.NODE_ENV === 'development');

  const cabecalhosDaRequisicao = new Headers(request.headers);
  cabecalhosDaRequisicao.set('x-nonce', nonce);
  cabecalhosDaRequisicao.set('Content-Security-Policy', csp);

  /**
   * Carimba a politica em qualquer resposta que sai daqui.
   *
   * Existe porque havia tres caminhos de saida sem ela: o 403 do CSRF e os
   * dois redirecionamentos de sessao. Cabecalho de seguranca que depende de
   * qual `return` a requisicao pegou e cabecalho que falta em producao.
   */
  const comCsp = (resposta: NextResponse) => {
    resposta.headers.set('Content-Security-Policy', csp);
    return resposta;
  };

  const csrf = validarOrigem(
    request.method,
    request.headers.get('origin'),
    request.headers.get('referer'),
    request.headers.get('host')
  );
  if (!csrf.permitido) {
    return comCsp(new NextResponse(csrf.motivo, { status: csrf.status }));
  }

  let response = comCsp(
    NextResponse.next({ request: { headers: cabecalhosDaRequisicao } })
  );

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
          // `cabecalhosDaRequisicao`, e nao `request.headers`: o nonce vive
          // ali. Com o original, o Next renderiza sem carimbar os scripts e a
          // politica sai de cena justamente na renovacao de token, ou seja no
          // caminho de quem esta logado.
          response = comCsp(
            NextResponse.next({ request: { headers: cabecalhosDaRequisicao } })
          );
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

  // Sai antes de qualquer decisao de sessao, mas depois da barreira de CSRF
  // e com os cabecalhos de seguranca que o next.config aplica.
  if (ROTAS_SEM_AUTENTICACAO.some((rota) => pathname === rota)) {
    return response;
  }

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route);
  const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));

  // Redirect unauthenticated users to login
  if (!user && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return comCsp(NextResponse.redirect(loginUrl));
  }

  // Redirect authenticated users away from login
  if (user && isPublicRoute) {
    return comCsp(NextResponse.redirect(new URL('/', request.url)));
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
      return comCsp(NextResponse.redirect(new URL('/', request.url)));
    }
  }

  // Os cabecalhos de seguranca saem do `next.config.ts`, num lugar so.
  //
  // Eles estavam declarados aqui tambem, com valores diferentes: o HSTS daqui
  // dizia 31536000 contra 63072000 do config, e o Permissions-Policy daqui
  // nao travava `payment` nem `usb`. Como o middleware escreve depois, quem
  // valia era o valor mais fraco, e o config dava a impressao de proteger
  // mais do que protegia.
  //
  // Cabecalho de seguranca definido em dois lugares e cabecalho que ninguem
  // sabe qual vale.

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
