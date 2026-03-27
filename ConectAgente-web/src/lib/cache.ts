/**
 * Cache hibrido: memoria + localStorage
 * Com suporte a "stale-while-revalidate":
 *
 * - cacheGet(key)       → dados frescos (< 10 min) — usado pelos services
 * - cacheGetStale(key)  → dados antigos (< 24h) — usado pelas paginas para exibir instantaneamente
 * - cacheSet(key, data) → salva em memoria + localStorage
 *
 * Para evitar erro de hidratacao (SSR vs Client):
 * - cacheGetStale retorna null ate markHydrated() ser chamado
 * - O layout chama markHydrated() no useLayoutEffect e remonta as paginas
 * - Assim as paginas inicializam com dados do cache ANTES do browser pintar
 */

const STORAGE_PREFIX = 'ca_cache_';
const FRESH_TTL = 600_000;      // 10 minutos
const STALE_TTL = 86_400_000;   // 24 horas

const store = new Map<string, { data: unknown; ts: number }>();

// ── Restaurar cache do localStorage na inicializacao (client only) ──
if (typeof window !== 'undefined') {
  try {
    const now = Date.now();
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (!key.startsWith(STORAGE_PREFIX)) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as { data: unknown; ts: number };
        if (now - parsed.ts <= STALE_TTL) {
          store.set(key.slice(STORAGE_PREFIX.length), parsed);
        } else {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  } catch { /* localStorage indisponivel */ }
}

// ── Controle de hidratacao ──
let _hydrated = false;

/**
 * Marca que a hidratacao do React terminou.
 * Chamado pelo layout no useLayoutEffect.
 * Depois disso, cacheGetStale passa a retornar dados.
 */
export function markHydrated() { _hydrated = true; }

/**
 * Retorna dados FRESCOS (< 10 min).
 * Usado pelos services — se retorna null, o service faz request nova.
 * NAO tem guard de hidratacao (services podem rodar a qualquer momento).
 */
export function cacheGet<T>(key: string, ttlMs = FRESH_TTL): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMs) return null;
  return entry.data as T;
}

/**
 * Retorna dados mesmo ANTIGOS (< 24h).
 * Usado pelas paginas em useState initializers para exibir instantaneamente.
 *
 * IMPORTANTE: retorna null antes de markHydrated() para evitar
 * erro de hidratacao (server renderiza 0, client renderiza valor do cache).
 */
export function cacheGetStale<T>(key: string): T | null {
  if (!_hydrated) return null;
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > STALE_TTL) return null;
  return entry.data as T;
}

/**
 * Salva dados no cache (memoria + localStorage).
 */
export function cacheSet<T>(key: string, data: T): void {
  const entry = { data, ts: Date.now() };
  store.set(key, entry);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
    } catch {
      try {
        const items = Object.keys(localStorage)
          .filter((k) => k.startsWith(STORAGE_PREFIX))
          .map((k) => {
            try {
              const raw = localStorage.getItem(k);
              return { key: k, ts: raw ? (JSON.parse(raw) as { ts: number }).ts : 0 };
            } catch { return { key: k, ts: 0 }; }
          })
          .sort((a, b) => a.ts - b.ts);
        for (let i = 0; i < Math.min(10, items.length); i++) {
          localStorage.removeItem(items[i].key);
        }
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
      } catch { /* desistir */ }
    }
  }
}

export function cacheInvalidate(prefix?: string): void {
  if (!prefix) {
    store.clear();
    if (typeof window !== 'undefined') {
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith(STORAGE_PREFIX))
          .forEach((k) => localStorage.removeItem(k));
      } catch { /* ignore */ }
    }
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      try { localStorage.removeItem(STORAGE_PREFIX + key); } catch { /* ignore */ }
    }
  }
}
