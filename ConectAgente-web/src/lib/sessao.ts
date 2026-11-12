/**
 * Política de sessão do painel.
 *
 * O cookie de sessão do Supabase saía com validade de 400 dias e sem `Secure`.
 * Na prática a sessão sobrevivia a fechar o navegador: no computador
 * compartilhado de uma UBS, quem sentasse depois abria o painel já logado, e
 * já com o segundo fator cumprido.
 *
 * Regras (OWASP ASVS 4.0.3 V3.3.2, nível 2):
 *   - 30 minutos sem usar: o cookie expira e é preciso entrar de novo.
 *     Cada navegação renova o prazo (o middleware regrava o cookie).
 *   - 12 horas desde a senha: entra de novo, mesmo em uso. É um turno.
 *   - `Secure` em produção e `SameSite=Lax` sempre.
 *
 * O cookie não pode ser `HttpOnly`: o cliente do Supabase no navegador lê o
 * token para falar com a API. O que segura roubo de token por script é a CSP
 * com nonce e `strict-dynamic` (ver `montarCsp`).
 */

export const INATIVIDADE_MAXIMA_SEGUNDOS = 30 * 60;
export const DURACAO_MAXIMA_SEGUNDOS = 12 * 60 * 60;

export interface OpcoesDoCookie {
  path: string;
  sameSite: 'lax';
  secure: boolean;
  maxAge: number;
}

export function opcoesDoCookieDeSessao(producao = process.env.NODE_ENV === 'production'): OpcoesDoCookie {
  return { path: '/', sameSite: 'lax', secure: producao, maxAge: INATIVIDADE_MAXIMA_SEGUNDOS };
}

/** Nome dos cookies de sessão do Supabase, inclusive os pedaços `.0`, `.1`. */
export function ehCookieDeSessao(nome: string): boolean {
  return /^sb-[a-z0-9]+-auth-token(\.\d+)?$/.test(nome);
}

export interface MetodoDeEntrada {
  method: string;
  timestamp: number;
}

/**
 * A sessão passou do limite de um turno? Conta a partir da senha, que é a
 * entrada mais antiga registrada no token (`amr`). Sem registro, trata como
 * vencida: falha fechada.
 */
export function sessaoPassouDoTurno(
  metodos: MetodoDeEntrada[] | null | undefined,
  agoraSegundos = Math.floor(Date.now() / 1000)
): boolean {
  const momentos = (metodos ?? []).map((m) => m.timestamp).filter((t) => Number.isFinite(t) && t > 0);
  if (momentos.length === 0) return true;
  return agoraSegundos - Math.min(...momentos) > DURACAO_MAXIMA_SEGUNDOS;
}
