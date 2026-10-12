/**
 * Decisão anti-CSRF, como função pura.
 *
 * Fica separada do middleware de propósito: o runtime edge do Next.js é
 * difícil de testar diretamente, e a regra que decide quem escreve no
 * prontuário de um munícipe merece teste.
 *
 * Por que existe. Server Action em Next.js é um endpoint HTTP, e o navegador
 * envia cookie de sessão em requisição disparada de outro site. Sem conferir a
 * origem, uma página maliciosa que a pessoa abra noutra aba consegue disparar
 * escrita autenticada em nome dela. O Next tem proteção própria para Server
 * Actions, mas ela não cobre rota de API, e defesa que depende de uma camada
 * só é defesa que some quando aquela camada muda.
 */

export const METODOS_ESCRITA = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

export type ResultadoCsrf =
  | { permitido: true }
  | { permitido: false; status: 403; motivo: string };

/**
 * A origem precisa bater com o host que o navegador usou.
 *
 * Usa `Origin` e, na falta, `Referer`. Escrita sem nenhum dos dois é barrada,
 * e não liberada no silêncio: navegador manda `Origin` em toda requisição de
 * escrita desde 2020, então a ausência indica cliente que não é navegador ou
 * tentativa de contornar.
 */
export function validarOrigem(
  metodo: string,
  origin: string | null,
  referer: string | null,
  host: string | null
): ResultadoCsrf {
  const ehEscrita = (METODOS_ESCRITA as readonly string[]).includes(
    metodo.toUpperCase()
  );
  if (!ehEscrita) return { permitido: true };

  const fonte = origin ?? referer;
  if (!fonte || !host) {
    return { permitido: false, status: 403, motivo: 'Origem não informada.' };
  }

  let hostDaFonte: string;
  try {
    hostDaFonte = new URL(fonte).host;
  } catch {
    return { permitido: false, status: 403, motivo: 'Origem inválida.' };
  }

  if (hostDaFonte !== host) {
    return { permitido: false, status: 403, motivo: 'Origem não permitida.' };
  }

  return { permitido: true };
}
