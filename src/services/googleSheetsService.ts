import { VolumenData } from '../types';

let memVolumen: { key: string; data: VolumenData[]; time: number } | null = null;
let memActivacion: { key: string; data: any[]; time: number } | null = null;
let memMetas: { key: string; data: any[]; time: number } | null = null;
const MEM_TTL = 25000; // 25s ventana corta en memoria; SWR revalida en segundo plano

const SWR_PREFIX = 'fdv_swr_v2_';
const SWR_SYNC_META_KEY = `${SWR_PREFIX}sync_meta`;

export interface SheetsSyncMeta {
  lastSyncAt: string | null;
  source: string | null;
  updatedAt: number;
}

const buildSwrKey = (type: 'vol' | 'act' | 'metas', cacheKey: string): string => {
  const safe = String(cacheKey || 'ALL').replace(/[^a-zA-Z0-9:_-]/g, '_');
  return `${SWR_PREFIX}${type}_${safe}`;
};

const readSwrStorage = <T>(storageKey: string): T | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && parsed.data !== undefined ? parsed.data : parsed) as T;
  } catch {
    return null;
  }
};

const writeSwrStorage = (storageKey: string, data: unknown): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const payload = JSON.stringify({ data, savedAt: Date.now() });
  try {
    window.localStorage.setItem(storageKey, payload);
  } catch {
    // Si localStorage alcanzó cuota máxima, limpiar entradas SWR antiguas y reintentar una vez
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(SWR_PREFIX) && k !== SWR_SYNC_META_KEY && k !== storageKey) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      window.localStorage.setItem(storageKey, payload);
    } catch {
      // Ignorar silenciosamente si el navegador bloquea almacenamiento privado
    }
  }
};

const emitSyncMetaUpdate = (meta: SheetsSyncMeta): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(SWR_SYNC_META_KEY, JSON.stringify(meta));
    window.dispatchEvent(new CustomEvent('fdv-sheets-sync-meta', { detail: meta }));
  } catch {
    // no-op
  }
};

export const getLastSyncMetadata = (): SheetsSyncMeta => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { lastSyncAt: null, source: null, updatedAt: 0 };
  }
  try {
    const raw = window.localStorage.getItem(SWR_SYNC_META_KEY);
    if (!raw) return { lastSyncAt: null, source: null, updatedAt: 0 };
    const parsed = JSON.parse(raw);
    return {
      lastSyncAt: parsed?.lastSyncAt || null,
      source: parsed?.source || null,
      updatedAt: Number(parsed?.updatedAt) || 0
    };
  } catch {
    return { lastSyncAt: null, source: null, updatedAt: 0 };
  }
};

/**
 * Obtiene instantáneamente (0 ms) la instantánea local Stale-While-Revalidate (SWR)
 * para mostrar datos al vendedor de inmediato mientras se revalida con Google Sheets en segundo plano.
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
    (memVolumen?.key === cacheKey ? memVolumen.data : null) ||
    readSwrStorage<VolumenData[]>(buildSwrKey('vol', cacheKey)) ||
    [];
  const act =
    (memActivacion?.key === cacheKey ? memActivacion.data : null) ||
    readSwrStorage<any[]>(buildSwrKey('act', cacheKey)) ||
    [];
  const metas =
    (memMetas?.key === cacheKey ? memMetas.data : null) ||
    readSwrStorage<any[]>(buildSwrKey('metas', cacheKey)) ||
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
  memVolumen = null;
  memActivacion = null;
  memMetas = null;

  if (clearPersistent && typeof window !== 'undefined' && window.localStorage) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(SWR_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // no-op
    }
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
  onRetry?: (attempt: number, maxAttempts: number) => void;
}

/**
 * Fetch con cabeceras estrictas anti-caché y reintento automático con Exponential Backoff
 * para proteger a los vendedores ante micro-cortes o fluctuaciones de señal móvil (3G/4G).
 */
export const fetchWithRetryBackoff = async (
  url: string,
  options: RequestInit = {},
  retryOpts: RetryFetchOptions = {}
): Promise<Response> => {
  const { timeoutMs = 12000, maxAttempts = 3, baseDelayMs = 600, onRetry } = retryOpts;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
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
      lastError = err;
    } finally {
      clearTimeout(timer);
    }

    if (attempt < maxAttempts) {
      if (onRetry) onRetry(attempt + 1, maxAttempts);
      const jitter = Math.floor(Math.random() * 150);
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Error de red tras múltiples reintentos');
};

const recordResponseSyncHeaders = (response: Response, fallbackTimestamp?: string): void => {
  const headerSync = response.headers.get('X-Last-Sync');
  const headerSource = response.headers.get('X-Sync-Source');
  const current = getLastSyncMetadata();
  const nextSyncAt = headerSync || fallbackTimestamp || current.lastSyncAt || new Date().toISOString();
  emitSyncMetaUpdate({
    lastSyncAt: nextSyncAt,
    source: headerSource || current.source || 'server',
    updatedAt: Date.now()
  });
};

export const fetchVolumenData = async (force: boolean = false, vendorId?: string): Promise<VolumenData[]> => {
  const cacheKey = `${vendorId || 'ALL'}`;
  const swrKey = buildSwrKey('vol', cacheKey);
  if (!force && memVolumen && memVolumen.key === cacheKey && Date.now() - memVolumen.time < MEM_TTL) {
    return memVolumen.data;
  }

  try {
    const vParam = vendorId ? `&vendedor=${encodeURIComponent(vendorId)}` : '';
    const response = await fetchWithRetryBackoff(
      `/api/data/volumen?force=${force}${vParam}`,
      { headers: getAuthHeaders() },
      { timeoutMs: force ? 18000 : 10000, maxAttempts: 3 }
    );
    if (!response.ok) {
      return (memVolumen?.key === cacheKey ? memVolumen.data : null) || readSwrStorage<VolumenData[]>(swrKey) || [];
    }
    const text = await response.text();
    if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
      console.warn('Respuesta no-JSON recibida en volumen data.');
      return (memVolumen?.key === cacheKey ? memVolumen.data : null) || readSwrStorage<VolumenData[]>(swrKey) || [];
    }
    const parsed: VolumenData[] = JSON.parse(text);
    memVolumen = { key: cacheKey, data: parsed, time: Date.now() };
    writeSwrStorage(swrKey, parsed);
    recordResponseSyncHeaders(response);
    return parsed;
  } catch (error: any) {
    console.warn('Error leyendo volumen data (usando respaldo SWR):', error?.message);
    return (memVolumen?.key === cacheKey ? memVolumen.data : null) || readSwrStorage<VolumenData[]>(swrKey) || [];
  }
};

export const fetchActivacionData = async (force: boolean = false, vendorId?: string): Promise<any[]> => {
  const cacheKey = `${vendorId || 'ALL'}`;
  const swrKey = buildSwrKey('act', cacheKey);
  if (!force && memActivacion && memActivacion.key === cacheKey && Date.now() - memActivacion.time < MEM_TTL) {
    return memActivacion.data;
  }

  try {
    const vParam = vendorId ? `&vendedor=${encodeURIComponent(vendorId)}` : '';
    const response = await fetchWithRetryBackoff(
      `/api/data/activacion?force=${force}${vParam}`,
      { headers: getAuthHeaders() },
      { timeoutMs: force ? 18000 : 10000, maxAttempts: 3 }
    );
    if (!response.ok) {
      return (memActivacion?.key === cacheKey ? memActivacion.data : null) || readSwrStorage<any[]>(swrKey) || [];
    }
    const text = await response.text();
    if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
      console.warn('Respuesta no-JSON recibida en activacion data.');
      return (memActivacion?.key === cacheKey ? memActivacion.data : null) || readSwrStorage<any[]>(swrKey) || [];
    }
    const parsed: any[] = JSON.parse(text);
    memActivacion = { key: cacheKey, data: parsed, time: Date.now() };
    writeSwrStorage(swrKey, parsed);
    recordResponseSyncHeaders(response);
    return parsed;
  } catch (error: any) {
    console.warn('Error leyendo activacion data (usando respaldo SWR):', error?.message);
    return (memActivacion?.key === cacheKey ? memActivacion.data : null) || readSwrStorage<any[]>(swrKey) || [];
  }
};

export const fetchMetasActivacion = async (force: boolean = false, vendorId?: string): Promise<any[]> => {
  const cacheKey = `${vendorId || 'ALL'}`;
  const swrKey = buildSwrKey('metas', cacheKey);
  if (!force && memMetas && memMetas.key === cacheKey && Date.now() - memMetas.time < MEM_TTL) {
    return memMetas.data;
  }

  try {
    const vParam = vendorId ? `&vendedor=${encodeURIComponent(vendorId)}` : '';
    const response = await fetchWithRetryBackoff(
      `/api/data/metas-activacion?force=${force}${vParam}`,
      { headers: getAuthHeaders() },
      { timeoutMs: force ? 18000 : 10000, maxAttempts: 3 }
    );
    if (!response.ok) {
      return (memMetas?.key === cacheKey ? memMetas.data : null) || readSwrStorage<any[]>(swrKey) || [];
    }
    const text = await response.text();
    if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
      console.warn('Respuesta no-JSON recibida en metas data.');
      return (memMetas?.key === cacheKey ? memMetas.data : null) || readSwrStorage<any[]>(swrKey) || [];
    }
    const parsed: any[] = JSON.parse(text);
    memMetas = { key: cacheKey, data: parsed, time: Date.now() };
    writeSwrStorage(swrKey, parsed);
    recordResponseSyncHeaders(response);
    return parsed;
  } catch (error: any) {
    console.warn('Error leyendo metas data (usando respaldo SWR):', error?.message);
    return (memMetas?.key === cacheKey ? memMetas.data : null) || readSwrStorage<any[]>(swrKey) || [];
  }
};

export const toggleClienteRubro = async (
  clienteCodigo: string,
  rubro: string,
  active: boolean
): Promise<boolean> => {
  const cleanCod = String(clienteCodigo || '').replace(/^[#\s]+/, '').trim();
  if (memActivacion && Array.isArray(memActivacion.data)) {
    memActivacion.data.forEach((c: any) => {
      const cid = String(c.id || '').replace(/^[#\s]+/, '').trim();
      if (cid === cleanCod) {
        if (!c.cats) c.cats = {};
        c.cats[rubro] = active;
        const anyActive = Boolean(
          c.cats.ACEITE || c.cats.AZUCAR || c.cats.POLLO || c.cats.ESTANDAR_ASTURIAS || c.cats.MORTADELA_SALPICAO
        );
        c.status = anyActive ? 'ACTIVO' : 'INACTIVO';
      }
    });
    writeSwrStorage(buildSwrKey('act', memActivacion.key), memActivacion.data);
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
  } catch (e) {
    console.warn('Error sincronizando rubro de cliente con el servidor:', e);
    return false;
  }
};

export const triggerSheetsSync = async (
  onRetry?: (attempt: number, maxAttempts: number) => void
): Promise<{
  success: boolean;
  message: string;
  countVolumen?: number;
  countActivacion?: number;
  countMetas?: number;
  timestamp?: string;
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
      onRetry
    }
  );

  if (!response.ok) {
    const errPayload = await response.json().catch(() => ({}));
    throw new Error(errPayload?.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  clearSheetsCache(false);
  recordResponseSyncHeaders(response, data?.timestamp);
  return data;
};
