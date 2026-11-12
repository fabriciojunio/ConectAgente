import { SIDEBAR_ITEMS } from './constants';
import type { UserRole } from '@/types';

const TODOS: UserRole[] = ['agente', 'coordenador', 'gerente', 'admin'];

/**
 * Item do menu que governa o caminho: o de `href` mais longo que é prefixo
 * dele. `/admin/usuarios/123` cai em `/admin/usuarios`, não em `/admin`.
 */
function itemDoCaminho(pathname: string) {
  return SIDEBAR_ITEMS.filter(
    (i) => i.href !== '/' && (pathname === i.href || pathname.startsWith(i.href + '/'))
  ).sort((a, b) => b.href.length - a.href.length)[0];
}

/**
 * Papéis que podem abrir o caminho. O menu e o portão do servidor leem a
 * mesma lista (`SIDEBAR_ITEMS`), então não existe tela que o menu esconde e
 * a URL digitada abre.
 */
export function papeisDaRota(pathname: string): UserRole[] {
  return itemDoCaminho(pathname)?.roles ?? TODOS;
}

/** O caminho precisa conferir papel no servidor antes de abrir? */
export function rotaRestrita(pathname: string): boolean {
  return papeisDaRota(pathname).length < TODOS.length;
}

export function papelPodeAbrir(pathname: string, role: string | null | undefined): boolean {
  if (!role) return !rotaRestrita(pathname);
  return papeisDaRota(pathname).includes(role as UserRole);
}
