import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuthHeaders } from '../services/googleSheetsService';

export const SYNC_TOAST_DURATION_MS = 5000;

export interface UseSellerLiveSyncOptions {
  enabled: boolean;
  sellerId: string;
  onDataUpdated: () => void | Promise<void>;
}

function getSeenVersionStorageKey(sellerId: string): string {
  return `fdv_seen_sync_version_${sellerId}`;
}

function readSeenVersion(sellerId: string): number | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(getSeenVersionStorageKey(sellerId));
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeSeenVersion(sellerId: string, version: number): void {
  if (typeof window === 'undefined' || !window.localStorage || version <= 0) return;
  try {
    window.localStorage.setItem(getSeenVersionStorageKey(sellerId), String(version));
  } catch {
    // Ignorar silenciosamente si el navegador bloquea localStorage
  }
}

/**
 * Suscripción en tiempo real por SSE (`GET /api/vendedor/:sellerId/stream`) + respaldo de reconexión
 * (`GET /api/vendedor/:sellerId/sync-status`) con notificación exacta de 5000 ms y deduplicación
 * persistente en `localStorage` (`fdv_seen_sync_version_${sellerId}`).
 */
export function useSellerLiveSync({
  enabled,
  sellerId,
  onDataUpdated
}: UseSellerLiveSyncOptions): {
  showToast: boolean;
  dismissToast: () => void;
  lastVersion: number | null;
} {
  const [showToast, setShowToast] = useState(false);
  const [lastVersion, setLastVersion] = useState<number | null>(() =>
    sellerId ? readSeenVersion(sellerId) : null
  );

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDataUpdatedRef = useRef(onDataUpdated);
  const hasBaselineInSessionRef = useRef(false);
  const lastSeenVersionRef = useRef<number | null>(sellerId ? readSeenVersion(sellerId) : null);

  useEffect(() => {
    onDataUpdatedRef.current = onDataUpdated;
  }, [onDataUpdated]);

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const dismissToast = useCallback(() => {
    clearToastTimer();
    setShowToast(false);
  }, [clearToastTimer]);

  const triggerFiveSecondToast = useCallback(() => {
    clearToastTimer();
    setShowToast(true);
    toastTimerRef.current = setTimeout(() => {
      toastTimerRef.current = null;
      setShowToast(false);
    }, SYNC_TOAST_DURATION_MS);
  }, [clearToastTimer]);

  /**
   * Evalúa una versión reportada por el servidor.
   * - Si `isRealtimeEvent === true` (`datos_actualizados` por SSE): muestra alerta si `version > lastSeen`.
   * - Si `isRealtimeEvent === false` (conexión inicial o reconexión): establece baseline sin alerta si
   *   aún no había versión previa en la sesión; solo dispara alerta si ya existía baseline previo y `version > lastSeen`.
   */
  const handleServerVersion = useCallback(
    (incomingVersion: number, isRealtimeEvent: boolean) => {
      if (!sellerId || !Number.isFinite(incomingVersion) || incomingVersion <= 0) return;

      const persisted = readSeenVersion(sellerId);
      const currentSeen = lastSeenVersionRef.current ?? persisted;

      // Caso 1: primera vez que recibimos versión en esta sesión (carga inicial o tras reinicio del servidor)
      if (!isRealtimeEvent && currentSeen === null) {
        lastSeenVersionRef.current = incomingVersion;
        hasBaselineInSessionRef.current = true;
        writeSeenVersion(sellerId, incomingVersion);
        setLastVersion(incomingVersion);
        return;
      }

      // Caso 2: servidor reinició (version === 1 mientras localStorage tenía una versión mayor de sesión anterior)
      if (!isRealtimeEvent && currentSeen !== null && incomingVersion < currentSeen) {
        lastSeenVersionRef.current = incomingVersion;
        hasBaselineInSessionRef.current = true;
        writeSeenVersion(sellerId, incomingVersion);
        setLastVersion(incomingVersion);
        return;
      }

      // Caso 3: misma versión ya vista (ej. usuario presionó F5) -> NO mostrar alerta repetida
      if (currentSeen !== null && incomingVersion <= currentSeen) {
        hasBaselineInSessionRef.current = true;
        setLastVersion(currentSeen);
        return;
      }

      // Caso 4: versión estrictamente superior -> actualización numérica real detectada
      if (isRealtimeEvent || (hasBaselineInSessionRef.current && currentSeen !== null && incomingVersion > currentSeen)) {
        lastSeenVersionRef.current = incomingVersion;
        hasBaselineInSessionRef.current = true;
        writeSeenVersion(sellerId, incomingVersion);
        setLastVersion(incomingVersion);
        Promise.resolve(onDataUpdatedRef.current()).catch(() => {});
        triggerFiveSecondToast();
        return;
      }

      // Caso 5: primera carga de esta sesión (sin baseline previo en sesión) cuando localStorage tenía
      // una versión antigua de una sesión cerrada. La carga inicial ya consulta los datos vigentes:
      // establecemos la nueva línea base silenciosamente sin mostrar alerta falsa al abrir el navegador.
      lastSeenVersionRef.current = incomingVersion;
      hasBaselineInSessionRef.current = true;
      writeSeenVersion(sellerId, incomingVersion);
      setLastVersion(incomingVersion);
    },
    [sellerId, triggerFiveSecondToast]
  );

  useEffect(() => {
    if (!enabled || !sellerId) {
      clearToastTimer();
      setShowToast(false);
      hasBaselineInSessionRef.current = false;
      return;
    }

    const token = typeof window !== 'undefined' ? window.localStorage.getItem('dashboard_fdv_token') : null;
    if (!token) return;

    lastSeenVersionRef.current = readSeenVersion(sellerId);
    hasBaselineInSessionRef.current = false;

    let disposed = false;
    let eventSource: EventSource | null = null;
    let retryDelayMs = 2000;
    const statusAbortControllers = new Set<AbortController>();

    const checkSyncStatusFallback = async () => {
      if (disposed) return;
      const ac = new AbortController();
      statusAbortControllers.add(ac);
      try {
        const res = await fetch(
          `/api/vendedor/${encodeURIComponent(sellerId)}/sync-status?_t=${Date.now()}`,
          {
            cache: 'no-store',
            signal: ac.signal,
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              ...getAuthHeaders()
            }
          }
        );
        if (!res.ok || disposed) return;
        const payload = await res.json().catch(() => null);
        if (payload && typeof payload.version === 'number') {
          handleServerVersion(payload.version, false);
        }
      } catch {
        // Silencioso en micro-cortes móviles
      } finally {
        statusAbortControllers.delete(ac);
      }
    };

    const connectSse = () => {
      if (disposed || typeof EventSource === 'undefined') return;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }

      const streamUrl = `/api/vendedor/${encodeURIComponent(sellerId)}/stream?token=${encodeURIComponent(token)}`;
      const es = new EventSource(streamUrl);
      eventSource = es;

      es.addEventListener('connected', (event: MessageEvent) => {
        retryDelayMs = 2000;
        try {
          const data = JSON.parse(event.data);
          if (typeof data?.version === 'number') {
            handleServerVersion(data.version, false);
          }
        } catch {
          // no-op
        }
      });

      es.addEventListener('baseline', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (typeof data?.version === 'number') {
            handleServerVersion(data.version, false);
          }
        } catch {
          // no-op
        }
      });

      es.addEventListener('datos_actualizados', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (typeof data?.version === 'number') {
            handleServerVersion(data.version, true);
          }
        } catch {
          // no-op
        }
      });

      es.onerror = () => {
        if (disposed) return;
        es.close();
        eventSource = null;
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          checkSyncStatusFallback();
          connectSse();
        }, retryDelayMs);
        retryDelayMs = Math.min(30_000, retryDelayMs * 2);
      };
    };

    // Baseline inicial + conexión SSE en tiempo real
    checkSyncStatusFallback();
    connectSse();

    const handleVisibilityOrOnline = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      checkSyncStatusFallback();
      if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
        connectSse();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrOnline);
    window.addEventListener('online', handleVisibilityOrOnline);

    return () => {
      disposed = true;
      clearToastTimer();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      for (const ac of statusAbortControllers) {
        ac.abort();
      }
      statusAbortControllers.clear();
      document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
      window.removeEventListener('online', handleVisibilityOrOnline);
    };
  }, [enabled, sellerId, handleServerVersion, clearToastTimer]);

  return { showToast, dismissToast, lastVersion };
}
