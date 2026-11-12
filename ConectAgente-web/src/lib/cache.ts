/**
 * Cache híbrido: memória + sessionStorage
 * Com suporte a "stale-while-revalidate":
 *
 * - cacheGet(key)       → dados frescos (< 10 min), usado pelos services
 * - cacheGetStale(key)  → dados antigos (< 24h), usado pelas páginas para exibir instantaneamente
 * - cacheSet(key, data) → salva em memória + sessionStorage
 * - cacheClear()        → apaga tudo; chamado no login e no "Sair"
 * - cacheBindUser(id)   → apaga tudo se o cache for de outra conta
 *
 * Por que sessionStorage, e não localStorage: o cache guarda lista de
 * pacientes, famílias e visitas, que é dado de saúde (LGPD, art. 11). No
 * localStorage ele ficava 24 horas no disco e sobrevivia ao "Sair": num
 * computador compartilhado de UBS, a conta seguinte abria o navegador com o
 * dado da anterior. O sessionStorage morre com a aba, e mesmo dentro dela o
 * cache é apagado no login, no "Sair" e quando a conta muda.
 *
 * Para evitar erro de hidratação (SSR vs Client):
 * - cacheGetStale retorna null até markHydrated() ser chamado
 * - O layout chama markHydrated() no useLayoutEffect e remonta as páginas
 * - Assim as páginas inicializam com dados do cache ANTES do browser pintar
 */

const STORAGE_PREFIX = 'ca_cache_';
const OWNER_KEY = 'ca_cache_dono';
const FRESH_TTL = 600_000;      // 10 minutos
const STALE_TTL = 86_400_000;   // 24 horas

const store = new Map<string, { data: unknown; ts: number }>();

function armazenamento(): Storage | null {
  if (typeof window === 'undefined') return null;
  try { return window.sessionStorage; } catch { return null; }
}

function chavesDoCache(s: Storage): string[] {
  return Object.keys(s).filter((k) => k.startsWith(STORAGE_PREFIX) && k !== OWNER_KEY);
}

// ── Restaurar cache na inicialização (client only) ──
if (typeof window !== 'undefined') {
  // Versões anteriores gravavam no localStorage: o que sobrou de lá sai agora.
  try {
    for (const k of Object.keys(window.localStorage)) {
      if (k.startsWith(STORAGE_PREFIX)) window.localStorage.removeItem(k);
    }
  } catch { /* localStorage indisponível */ }

  const s = armazenamento();
  if (s) {
    try {
      const now = Date.now();
      for (const key of chavesDoCache(s)) {
        try {
          const raw = s.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw) as { data: unknown; ts: number };
          if (now - parsed.ts <= STALE_TTL) {
            store.set(key.slice(STORAGE_PREFIX.length), parsed);
          } else {
            s.removeItem(key);
          }
        } catch {
          s.removeItem(key);
        }
      }
    } catch { /* sessionStorage indisponível */ }
  }
}

/** Apaga o cache inteiro, da memória e do navegador. */
export function cacheClear(): void {
  store.clear();
  const s = armazenamento();
  if (!s) return;
  try {
    for (const k of chavesDoCache(s)) s.removeItem(k);
    s.removeItem(OWNER_KEY);
  } catch { /* indisponível */ }
}

/**
 * Amarra o cache à conta logada. Se o que está guardado é de outra conta,
 * apaga antes de qualquer página ler.
 */
export function cacheBindUser(userId: string): void {
  const s = armazenamento();
  let dono: string | null = null;
  try { dono = s?.getItem(OWNER_KEY) ?? null; } catch { /* indisponível */ }
  if (dono === userId) return;
  cacheClear();
  try { s?.setItem(OWNER_KEY, userId); } catch { /* indisponível */ }
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
 * Usado pelos services, se retorna null, o service faz request nova.
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
 * Salva dados no cache (memória + sessionStorage).
 */
export function cacheSet<T>(key: string, data: T): void {
  const entry = { data, ts: Date.now() };
  store.set(key, entry);

  const s = armazenamento();
  if (!s) return;
  try {
    s.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Cheio: tira as 10 entradas mais antigas e tenta de novo.
    try {
      const antigas = chavesDoCache(s)
        .map((k) => {
          try {
            const raw = s.getItem(k);
            return { key: k, ts: raw ? (JSON.parse(raw) as { ts: number }).ts : 0 };
          } catch { return { key: k, ts: 0 }; }
        })
        .sort((a, b) => a.ts - b.ts);
      for (const item of antigas.slice(0, 10)) s.removeItem(item.key);
      s.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
    } catch { /* desiste: fica só na memória */ }
  }
}
