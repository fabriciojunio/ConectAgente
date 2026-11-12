/**
 * Requisição de rede com prazo máximo.
 *
 * O cliente do Supabase usava o `fetch` puro, que espera para sempre. Em
 * campo a tela do celular apaga no meio do envio, o Android corta a rede do
 * app em segundo plano e a conexão morre sem resposta: a requisição ficava
 * pendurada, e com ela a sincronização inteira (achado no S24 em 12/11/2026,
 * selo parado em "Sincronizando..." até fechar o app à força).
 *
 * Com prazo, a requisição falha, o item volta para a fila e a próxima
 * tentativa (periódica, ao voltar para o app ou ao reconectar) o envia.
 */
export const PRAZO_DA_REDE_MS = 20_000;

export function fetchComPrazo(
  entrada: RequestInfo | URL,
  opcoes: RequestInit = {},
  prazoMs: number = PRAZO_DA_REDE_MS,
): Promise<Response> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), prazoMs);

  // Quem chamou também pode cancelar: os dois sinais valem.
  const externo = opcoes.signal;
  if (externo) {
    if (externo.aborted) controle.abort();
    else externo.addEventListener('abort', () => controle.abort());
  }

  return fetch(entrada, { ...opcoes, signal: controle.signal }).finally(() => clearTimeout(relogio));
}

/**
 * Prazo para uma operação inteira (a sincronização de vários lotes). Se
 * passar, rejeita com mensagem clara e libera quem estava esperando.
 */
export function comPrazo<T>(operacao: Promise<T>, prazoMs: number, mensagem: string): Promise<T> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<never>((_, rejeitar) => {
    relogio = setTimeout(() => rejeitar(new Error(mensagem)), prazoMs);
  });
  return Promise.race([operacao, prazo]).finally(() => clearTimeout(relogio));
}
