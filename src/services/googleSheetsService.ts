import { VolumenData } from '../types';
import { isClientActiveInAnyFocusProduct } from '../config/sheetsConfig';

export const SERVER_CACHE_TTL_MS = 55 * 1000; // 55 segundos (TTL centralizado en servidor)
export const DEFAULT_SHEETS_CACHE_TTL_MS = SERVER_CACHE_TTL_MS;
export const SHEETS_AUTO_REFRESH_INTERVAL_MS = 60 * 1000; // 60 segundos (refresco automático silencioso)
export const MANUAL_SYNC_COOLDOWN_MS = 15 * 1000; // 15 segundos (cooldown anti-spam)
let cacheTtlMs = DEFAULT_SHEETS_CACHE_TTL_MS;

export const getSheetsCacheTtlMs = (): number => cacheTtlMs;

export const setSheetsCacheTtlMs = (ms: number): void => {
  if (typeof ms === 'number' && Number.isFinite(ms) && ms >= 0) {
    cacheTtlMs = ms;
  }
};

interface CacheEntry<T> {
  key: string;
  data: T;
  savedAt: number;
}

const memVolumen = new Map<string, CacheEntry<VolumenData[]>>();
const memActivacion = new Map<string, CacheEntry<any[]>>();
const memMetas = new Map<string, CacheEntry<any[]>>();

interface InFlightEntry<T> {
  promise: Promise<T>;
  controller: AbortController;
  listeners: number;
}

const inFlightRequests = new Map<string, InFlightEntry<any>>();

const SESSION_PREFIX = 'fdv_sheets_v3_';
const LEGACY_SWR_PREFIX = 'fdv_swr_v2_';
const SYNC_META_KEY = `${SESSION_PREFIX}sync_meta`;

export interface SheetsSyncMeta {
  lastSyncAt: string | null;
  lastSyncCaracas?: string | null;
  source: string | null;
  degraded?: boolean;
  cooldownRemainingSeconds?: number;
  updatedAt: number;
}

export interface FetchSheetsOptions {
  forceRefresh?: boolean;
  vendorId?: string;
  signal?: AbortSignal;
  ttlMs?: number;
}

const getSessionStorageSafe = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage || null;
  } catch {
    return null;
  }
};

const buildCacheStorageKey = (type: 'vol' | 'act' | 'metas', cacheKey: string): string => {
  const safe = String(cacheKey || 'ALL').replace(/[^a-zA-Z0-9:_-]/g, '_');
  return `${SESSION_PREFIX}${type}_${safe}`;
};

const readSessionCache = <T>(storageKey: string, ttlMs: number = cacheTtlMs): T | null => {
  const storage = getSessionStorageSafe();
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.savedAt !== 'number') {
      storage.removeItem(storageKey);
      return null;
    }
    if (Date.now() - parsed.savedAt >= ttlMs) {
      storage.removeItem(storageKey);
      return null;
    }
    return parsed.data as T;
  } catch {
    try {
      storage.removeItem(storageKey);
    } catch {
      // no-op
    }
    return null;
  }
};

const writeSessionCache = (storageKey: string, data: unknown): void => {
  const storage = getSessionStorageSafe();
  if (!storage) return;
  const payload = JSON.stringify({ data, savedAt: Date.now() });
  try {
    storage.setItem(storageKey, payload);
  } catch {
    // Si sessionStorage alcanzó cuota máxima, purgar entradas previas y reintentar una vez
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && k.startsWith(SESSION_PREFIX) && k !== SYNC_META_KEY && k !== storageKey) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => storage.removeItem(k));
      storage.setItem(storageKey, payload);
    } catch {
      // Ignorar silenciosamente si el navegador restringe almacenamiento privado
    }
  }
};

const purgeLegacyLocalStorageCache = (): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(LEGACY_SWR_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // no-op
  }
};

// Limpiar entradas legacy sin TTL en localStorage al inicializar el módulo
purgeLegacyLocalStorageCache();

const emitSyncMetaUpdate = (meta: SheetsSyncMeta): void => {
  if (typeof window === 'undefined') return;
  try {
    getSessionStorageSafe()?.setItem(SYNC_META_KEY, JSON.stringify(meta));
    window.dispatchEvent(new CustomEvent('fdv-sheets-sync-meta', { detail: meta }));
  } catch {
    // no-op
  }
};

export const getLastSyncMetadata = (): SheetsSyncMeta => {
  const storage = getSessionStorageSafe();
  if (!storage) {
    return { lastSyncAt: null, lastSyncCaracas: null, source: null, degraded: false, updatedAt: 0 };
  }
  try {
    const raw = storage.getItem(SYNC_META_KEY);
    if (!raw) return { lastSyncAt: null, lastSyncCaracas: null, source: null, degraded: false, updatedAt: 0 };
    const parsed = JSON.parse(raw);
    return {
      lastSyncAt: parsed?.lastSyncAt || null,
      lastSyncCaracas: parsed?.lastSyncCaracas || null,
      source: parsed?.source || null,
      degraded: Boolean(parsed?.degraded),
      cooldownRemainingSeconds: Number(parsed?.cooldownRemainingSeconds) || 0,
      updatedAt: Number(parsed?.updatedAt) || 0
    };
  } catch {
    return { lastSyncAt: null, lastSyncCaracas: null, source: null, degraded: false, updatedAt: 0 };
  }
};

const readFreshMemory = <T>(map: Map<string, CacheEntry<T>>, cacheKey: string, ttlMs: number): T | null => {
  const entry = map.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.savedAt >= ttlMs) {
    map.delete(cacheKey);
    return null;
  }
  return entry.data;
};

/**
 * Obtiene instantáneamente (0 ms) la instantánea vigente dentro del TTL de sesión (5 min por defecto)
 * sin servir jamás datos caducados indefinidamente.
 */
export const getCachedSheetsSnapshot = (vendorId?: string): {
  volumen: VolumenData[];
  activacion: any[];
  metas: any[];
  lastSyncAt: string | null;
  hasCache: boolean;
} => {
  const cacheKey = `${vendorId || 'ALL'}`;
  const vol =
    readFreshMemory(memVolumen, cacheKey, cacheTtlMs) ||
    readSessionCache<VolumenData[]>(buildCacheStorageKey('vol', cacheKey), cacheTtlMs) ||
    [];
  const act =
    readFreshMemory(memActivacion, cacheKey, cacheTtlMs) ||
    readSessionCache<any[]>(buildCacheStorageKey('act', cacheKey), cacheTtlMs) ||
    [];
  const metas =
    readFreshMemory(memMetas, cacheKey, cacheTtlMs) ||
    readSessionCache<any[]>(buildCacheStorageKey('metas', cacheKey), cacheTtlMs) ||
    [];
  const meta = getLastSyncMetadata();

  return {
    volumen: Array.isArray(vol) ? vol : [],
    activacion: Array.isArray(act) ? act : [],
    metas: Array.isArray(metas) ? metas : [],
    lastSyncAt: meta.lastSyncAt,
    hasCache: (Array.isArray(vol) && vol.length > 0) || (Array.isArray(act) && act.length > 0)
  };
};

export const clearSheetsCache = (clearPersistent: boolean = false): void => {
  memVolumen.clear();
  memActivacion.clear();
  memMetas.clear();

  if (clearPersistent) {
    const storage = getSessionStorageSafe();
    if (storage) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k && k.startsWith(SESSION_PREFIX)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => storage.removeItem(k));
      } catch {
        // no-op
      }
    }
    purgeLegacyLocalStorageCache();
  }
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('dashboard_fdv_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface RetryFetchOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
  onRetry?: (attempt: number, maxAttempts: number) => void;
}

const createAbortError = (): Error => {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('La solicitud fue cancelada.', 'AbortError');
  }
  const err = new Error('La solicitud fue cancelada.');
  err.name = 'AbortError';
  return err;
};

const isAbortError = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  return (err as { name?: string }).name === 'AbortError';
};

const waitWithSignal = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Fetch con cabeceras estrictas anti-caché, soporte de AbortSignal del llamador y
 * reintento automático con Exponential Backoff para resiliencia en redes móviles (3G/4G).
 */
export const fetchWithRetryBackoff = async (
  url: string,
  options: RequestInit = {},
  retryOpts: RetryFetchOptions = {}
): Promise<Response> => {
  const { timeoutMs = 12000, maxAttempts = 3, baseDelayMs = 600, signal: callerSignal, onRetry } = retryOpts;
  const externalSignal = callerSignal || options.signal || undefined;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (externalSignal?.aborted) {
      throw createAbortError();
    }

    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const separator = url.includes('?') ? '&' : '?';
      const bustUrl = `${url}${separator}_t=${Date.now()}`;
      const response = await fetch(bustUrl, {
        ...options,
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          ...(options.headers || {})
        }
      });

      // No reintentar errores de autenticación/cliente (401/403/400/404), salvo 429 Too Many Requests o 5xx
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (err: any) {
      if (externalSignal?.aborted) {
        throw createAbortError();
      }
      lastError = err;
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    }

    if (attempt < maxAttempts) {
      if (onRetry) onRetry(attempt + 1, maxAttempts);
      const jitter = Math.floor(Math.random() * 150);
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
      await waitWithSignal(delay, externalSignal);
    }
  }

  throw lastError || new Error('Error de red tras múltiples reintentos');
};

const recordResponseSyncHeaders = (
  response: Response,
  fallbackTimestamp?: string,
  overrides?: Partial<SheetsSyncMeta>
): void => {
  const headerSync = response.headers.get('X-Last-Sync');
  const headerCaracas = response.headers.get('X-Last-Sync-Caracas');
  const headerSource = response.headers.get('X-Sync-Source');
  const headerDegraded = response.headers.get('X-Sync-Degraded');
  const headerCooldown = response.headers.get('X-Sync-Cooldown-Remaining');
  const current = getLastSyncMetadata();
  const nextSyncAt = headerSync || fallbackTimestamp || current.lastSyncAt || new Date().toISOString();
  emitSyncMetaUpdate({
    lastSyncAt: nextSyncAt,
    lastSyncCaracas: overrides?.lastSyncCaracas ?? headerCaracas ?? current.lastSyncCaracas ?? null,
    source: overrides?.source ?? headerSource ?? current.source ?? 'server',
    degraded: overrides?.degraded ?? (headerDegraded === 'true'),
    cooldownRemainingSeconds: overrides?.cooldownRemainingSeconds ?? (Number(headerCooldown) || 0),
    updatedAt: Date.now()
  });
};

const markDegradedCacheMeta = (): void => {
  const current = getLastSyncMetadata();
  emitSyncMetaUpdate({
    ...current,
    degraded: true,
    updatedAt: Date.now()
  });
};

function resolveFetchArgs(
  forceOrOpts?: boolean | FetchSheetsOptions,
  vendorId?: string,
  signal?: AbortSignal
): { force: boolean; vendorId?: string; signal?: AbortSignal; ttlMs: number } {
  if (typeof forceOrOpts === 'object' && forceOrOpts !== null) {
    return {
      force: Boolean(forceOrOpts.forceRefresh),
      vendorId: forceOrOpts.vendorId,
      signal: forceOrOpts.signal,
      ttlMs: typeof forceOrOpts.ttlMs === 'number' ? forceOrOpts.ttlMs : cacheTtlMs
    };
  }
  return {
    force: Boolean(forceOrOpts),
    vendorId,
    signal,
    ttlMs: cacheTtlMs
  };
}

function attachCallerSignal<T>(entry: InFlightEntry<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return entry.promise;
  }
  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }

  entry.listeners++;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      if (settled) return;
      settled = true;
      entry.listeners = Math.max(0, entry.listeners - 1);
      if (entry.listeners === 0) {
        entry.controller.abort();
      }
      reject(createAbortError());
    };

    signal.addEventListener('abort', onAbort, { once: true });
    entry.promise.then(
      (val) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(val);
      },
      (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      }
    );
  });
}

async function fetchDatasetWithDedup<T>(params: {
  type: 'vol' | 'act' | 'metas';
  endpoint: string;
  memMap: Map<string, CacheEntry<T[]>>;
  force: boolean;
  vendorId?: string;
  signal?: AbortSignal;
  ttlMs: number;
}): Promise<T[]> {
  const { type, endpoint, memMap, force, vendorId, signal, ttlMs } = params;
  if (signal?.aborted) {
    throw createAbortError();
  }

  const cacheKey = `${vendorId || 'ALL'}`;
  const storageKey = buildCacheStorageKey(type, cacheKey);

  if (!force) {
    const freshMem = readFreshMemory(memMap, cacheKey, ttlMs);
    if (freshMem) return freshMem;

    const freshSession = readSessionCache<T[]>(storageKey, ttlMs);
    if (freshSession) {
      memMap.set(cacheKey, { key: cacheKey, data: freshSession, savedAt: Date.now() });
      return freshSession;
    }
  }

  const flightKey = `${type}:${cacheKey}:${force ? 'force' : 'std'}`;
  const existingFlight = inFlightRequests.get(flightKey) as InFlightEntry<T[]> | undefined;
  if (existingFlight) {
    return attachCallerSignal(existingFlight, signal);
  }

  const controller = new AbortController();
  const sharedPromise = (async (): Promise<T[]> => {
    try {
      const vParam = vendorId ? `&vendedor=${encodeURIComponent(vendorId)}` : '';
      const response = await fetchWithRetryBackoff(
        `${endpoint}?force=${force}${vParam}`,
        { headers: getAuthHeaders() },
        { timeoutMs: force ? 18000 : 10000, maxAttempts: 3, signal: controller.signal }
      );
      if (!response.ok) {
        markDegradedCacheMeta();
        return memMap.get(cacheKey)?.data || readSessionCache<T[]>(storageKey, ttlMs) || [];
      }
      const text = await response.text();
      const trimmed = text.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        markDegradedCacheMeta();
        return memMap.get(cacheKey)?.data || readSessionCache<T[]>(storageKey, ttlMs) || [];
      }
      const parsed: T[] = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) {
        markDegradedCacheMeta();
        return memMap.get(cacheKey)?.data || readSessionCache<T[]>(storageKey, ttlMs) || [];
      }
      memMap.set(cacheKey, { key: cacheKey, data: parsed, savedAt: Date.now() });
      writeSessionCache(storageKey, parsed);
      recordResponseSyncHeaders(response);
      return parsed;
    } catch (error: any) {
      if (isAbortError(error) || controller.signal.aborted) {
        throw createAbortError();
      }
      markDegradedCacheMeta();
      return memMap.get(cacheKey)?.data || readSessionCache<T[]>(storageKey, ttlMs) || [];
    } finally {
      inFlightRequests.delete(flightKey);
    }
  })();

  const entry: InFlightEntry<T[]> = {
    promise: sharedPromise,
    controller,
    listeners: signal ? 0 : 1
  };
  inFlightRequests.set(flightKey, entry);

  return attachCallerSignal(entry, signal);
}

export const fetchVolumenData = async (
  forceOrOpts: boolean | FetchSheetsOptions = false,
  vendorId?: string,
  signal?: AbortSignal
): Promise<VolumenData[]> => {
  const args = resolveFetchArgs(forceOrOpts, vendorId, signal);
  return fetchDatasetWithDedup<VolumenData>({
    type: 'vol',
    endpoint: '/api/data/volumen',
    memMap: memVolumen,
    ...args
  });
};

export const fetchActivacionData = async (
  forceOrOpts: boolean | FetchSheetsOptions = false,
  vendorId?: string,
  signal?: AbortSignal
): Promise<any[]> => {
  const args = resolveFetchArgs(forceOrOpts, vendorId, signal);
  return fetchDatasetWithDedup<any>({
    type: 'act',
    endpoint: '/api/data/activacion',
    memMap: memActivacion,
    ...args
  });
};

export const fetchMetasActivacion = async (
  forceOrOpts: boolean | FetchSheetsOptions = false,
  vendorId?: string,
  signal?: AbortSignal
): Promise<any[]> => {
  const args = resolveFetchArgs(forceOrOpts, vendorId, signal);
  return fetchDatasetWithDedup<any>({
    type: 'metas',
    endpoint: '/api/data/metas-activacion',
    memMap: memMetas,
    ...args
  });
};

export const toggleClienteRubro = async (
  clienteCodigo: string,
  rubro: string,
  active: boolean
): Promise<boolean> => {
  const cleanCod = String(clienteCodigo || '').replace(/^[#\s]+/, '').trim();
  for (const [cacheKey, entry] of memActivacion.entries()) {
    if (Array.isArray(entry.data)) {
      entry.data.forEach((c: any) => {
        const cid = String(c.id || '').replace(/^[#\s]+/, '').trim();
        if (cid === cleanCod) {
          if (!c.cats) c.cats = {};
          c.cats[rubro] = active;
          c.status = isClientActiveInAnyFocusProduct(c) ? 'ACTIVO' : 'INACTIVO';
        }
      });
      writeSessionCache(buildCacheStorageKey('act', cacheKey), entry.data);
    }
  }
  try {
    const res = await fetchWithRetryBackoff(
      '/api/data/activacion/toggle-rubro',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ clienteCodigo: cleanCod, rubro, active })
      },
      { timeoutMs: 10000, maxAttempts: 3 }
    );
    return res.ok;
  } catch {
    return false;
  }
};

export const triggerSheetsSync = async (
  onRetry?: (attempt: number, maxAttempts: number) => void,
  signal?: AbortSignal
): Promise<{
  success: boolean;
  status?: 'OK' | 'SKIPPED_UNCHANGED' | 'COOLDOWN_CACHED' | 'DEGRADED_FALLBACK';
  degraded?: boolean;
  cooldownRemainingSeconds?: number;
  message: string;
  countVolumen?: number;
  countActivacion?: number;
  countMetas?: number;
  timestamp?: string;
  timestampCaracas?: string | null;
}> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeaders()
  };

  const response = await fetchWithRetryBackoff(
    '/api/sync/sheets',
    {
      method: 'POST',
      headers
    },
    {
      timeoutMs: 22000,
      maxAttempts: 3,
      baseDelayMs: 700,
      signal,
      onRetry
    }
  );

  if (!response.ok) {
    const errPayload = await response.json().catch(() => ({}));
    throw new Error(errPayload?.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data?.status !== 'COOLDOWN_CACHED' && !data?.degraded) {
    clearSheetsCache(true);
  }
  recordResponseSyncHeaders(response, data?.timestamp, {
    lastSyncCaracas: data?.timestampCaracas || undefined,
    degraded: Boolean(data?.degraded),
    cooldownRemainingSeconds: Number(data?.cooldownRemainingSeconds) || 0
  });
  return data;
};
