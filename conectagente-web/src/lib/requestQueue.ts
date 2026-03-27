/**
 * Fila de requisicoes com prioridade e retry automatico.
 *
 * Problema: o browser limita a 6 conexoes simultaneas por dominio.
 * Se o prefetch dispara 20 requests ao mesmo tempo, as queries da
 * pagina que o usuario esta vendo ficam na fila e demoram 8-10s.
 *
 * Solucao: limitar a concorrencia e dar prioridade as requests da
 * pagina atual (priority: 'high') sobre o prefetch (priority: 'low').
 *
 * Retry: falhas de rede sao retentadas com backoff exponencial
 * (1s, 2s, 4s) ate MAX_RETRIES vezes.
 */

const MAX_CONCURRENT = 4;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface QueueItem {
  fn: () => Promise<unknown>;
  priority: 'high' | 'low';
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  retries: number;
}

const queue: QueueItem[] = [];
let running = 0;

function isRetryableError(err: unknown): boolean {
  if (err instanceof TypeError && err.message.includes('fetch')) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('aborted')) return true;
    if (msg.includes('503') || msg.includes('429') || msg.includes('502')) return true;
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeWithRetry(item: QueueItem): Promise<void> {
  try {
    const result = await item.fn();
    item.resolve(result);
  } catch (err) {
    if (item.retries < MAX_RETRIES && isRetryableError(err)) {
      item.retries++;
      const waitMs = BASE_DELAY_MS * Math.pow(2, item.retries - 1);
      await delay(waitMs);
      // Re-enqueue with same priority (goes back into the queue)
      queue.push(item);
    } else {
      item.reject(err);
    }
  } finally {
    running--;
    processQueue();
  }
}

function processQueue() {
  while (running < MAX_CONCURRENT && queue.length > 0) {
    // High priority items go first
    const idx = queue.findIndex((item) => item.priority === 'high');
    const item = idx >= 0 ? queue.splice(idx, 1)[0] : queue.shift()!;

    running++;
    executeWithRetry(item);
  }
}

/**
 * Enfileira uma requisicao com prioridade.
 * - 'high': requisicoes da pagina atual (passam na frente)
 * - 'low': prefetch em segundo plano (espera as high terminarem)
 *
 * Falhas de rede sao retentadas automaticamente ate 3 vezes
 * com backoff exponencial (1s, 2s, 4s).
 */
export function enqueue<T>(
  fn: () => Promise<T>,
  priority: 'high' | 'low' = 'high',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({
      fn,
      priority,
      resolve: resolve as (v: unknown) => void,
      reject,
      retries: 0,
    });
    processQueue();
  });
}
