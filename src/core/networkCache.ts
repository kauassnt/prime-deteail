import { ErrorReporter, safeJsonParse } from './errorHandler';

export interface SwrOptions<T> {
  /** Freshness window where cached response is returned without background network revalidation */
  staleMs?: number;
  /** Maximum lifetime before cached data is considered expired */
  maxAgeMs?: number;
  /** Optional localStorage persistence key for offline/reload cache hydration */
  persistKey?: string;
  /** Optional AbortSignal for caller cancellation */
  signal?: AbortSignal;
  /** Optional predicate to avoid caching empty/invalid payloads */
  validate?: (value: T) => boolean;
  /** Bypass cache and force immediate network request */
  forceRefresh?: boolean;
}

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const activeRevalidations = new Set<string>();

function readPersistedEntry<T>(persistKey?: string): CacheEntry<T> | null {
  if (!persistKey || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(persistKey);
    if (!raw) return null;
    const parsed = safeJsonParse<Partial<CacheEntry<T>> | null>(raw, null);
    if (parsed && typeof parsed.fetchedAt === 'number' && parsed.data !== undefined) {
      return parsed as CacheEntry<T>;
    }
    return null;
  } catch {
    return null;
  }
}

function writePersistedEntry<T>(persistKey: string | undefined, entry: CacheEntry<T>): void {
  if (!persistKey || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(persistKey, JSON.stringify(entry));
  } catch {
    // Storage quota exceeded: silent ignore; L1 memory cache remains active
  }
}

export function invalidateSwrCache(prefix?: string): void {
  for (const key of Array.from(memoryCache.keys())) {
    if (!prefix || key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Stale-While-Revalidate (SWR) network cache with concurrent request deduplication.
 * - Eliminates duplicate concurrent network fetches for the same resource key.
 * - Serves fresh/stale data in O(1) (~0ms) while revalidating stale entries quietly in background.
 */
export async function swrFetch<T>(
  key: string,
  fetcher: (signal?: AbortSignal) => Promise<T>,
  options: SwrOptions<T> = {}
): Promise<T> {
  const {
    staleMs = 5 * 60 * 1000,
    maxAgeMs = 24 * 60 * 60 * 1000,
    persistKey,
    signal,
    validate,
    forceRefresh = false,
  } = options;

  const now = Date.now();
  let entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry && persistKey) {
    const hydrated = readPersistedEntry<T>(persistKey);
    if (hydrated) {
      entry = hydrated;
      memoryCache.set(key, hydrated);
    }
  }

  const executeNetwork = async (): Promise<T> => {
    const existing = inFlightRequests.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const requestPromise = (async () => {
      const data = await fetcher(signal);
      if (!validate || validate(data)) {
        const nextEntry: CacheEntry<T> = { data, fetchedAt: Date.now() };
        memoryCache.set(key, nextEntry);
        writePersistedEntry(persistKey, nextEntry);
      }
      return data;
    })();

    inFlightRequests.set(key, requestPromise);
    try {
      return await requestPromise;
    } finally {
      if (inFlightRequests.get(key) === requestPromise) {
        inFlightRequests.delete(key);
      }
    }
  };

  if (!forceRefresh && entry) {
    const age = now - entry.fetchedAt;
    if (age <= staleMs) {
      return entry.data;
    }
    if (age <= maxAgeMs) {
      if (!activeRevalidations.has(key)) {
        activeRevalidations.add(key);
        void executeNetwork()
          .catch(err => {
            ErrorReporter.report(err, { cacheKey: key, phase: 'swr_revalidate', silentOnAbort: true });
          })
          .finally(() => {
            activeRevalidations.delete(key);
          });
      }
      return entry.data;
    }
  }

  return executeNetwork();
}

/**
 * Neutralizes async race conditions when rapid user interactions dispatch overlapping requests
 * (e.g. fast brand/model switching or typeahead queries).
 * Cancels the previous AbortController and validates monotonic request sequence tokens.
 */
export interface LatestRequestGuard {
  next: () => { token: number; signal: AbortSignal };
  isLatest: (token: number) => boolean;
  cancelCurrent: () => void;
}

export function createLatestRequestGuard(): LatestRequestGuard {
  let latestToken = 0;
  let activeController: AbortController | null = null;

  return {
    next() {
      latestToken += 1;
      if (activeController) {
        activeController.abort();
      }
      activeController = new AbortController();
      return { token: latestToken, signal: activeController.signal };
    },
    isLatest(token: number) {
      return token === latestToken;
    },
    cancelCurrent() {
      latestToken += 1;
      if (activeController) {
        activeController.abort();
        activeController = null;
      }
    },
  };
}
