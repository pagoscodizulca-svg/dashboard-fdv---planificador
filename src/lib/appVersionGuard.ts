/**
 * Guardián de versión e invalidación automática de caché — Dashboard FDV Planificador.
 *
 * - Consulta `/version.json?t=...` (`cache: 'no-store'`) al abrir, al volver a la pestaña,
 *   al reconectar y cada 3 minutos.
 * - Mantiene actualizado el Service Worker (`/sw.js`) y recarga limpiamente en `controllerchange`.
 * - Purga únicamente cachés estáticas obsoletas, preservando SIEMPRE `fdv-whatsapp-share-v1`
 *   (comprobantes compartidos desde WhatsApp), IndexedDB (`fdv_whatsapp_share_db`) y la sesión del usuario.
 * - Auto-recupera `vite:preloadError` e importaciones dinámicas fallidas tras despliegues.
 */

export const FDV_VERSION_RELOAD_GUARD_KEY = 'codizulca_fdv:version_reload_guard';
export const FDV_PRELOAD_RELOAD_GUARD_KEY = 'codizulca_fdv:preload_reload_guard';
export const FDV_APP_UPDATE_DEFERRED_EVENT = 'codizulca_fdv:update-available';
const PRESERVED_SHARE_CACHE = 'fdv-whatsapp-share-v1';
const POLL_INTERVAL_MS = 3 * 60 * 1000;
const MIN_CHECK_GAP_MS = 15 * 1000;
const RELOAD_COOLDOWN_MS = 60 * 1000;

const CHUNK_LOAD_ERROR_PATTERNS: readonly RegExp[] = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
  /chunkloaderror/i,
  /loading chunk [\w-]+ failed/i,
  /loading css chunk [\w-]+ failed/i,
  /unable to preload css/i,
];

const EDITABLE_INPUT_TYPES = new Set([
  '',
  'text',
  'search',
  'email',
  'tel',
  'url',
  'password',
  'number',
  'date',
  'datetime-local',
  'time',
]);

export interface FdvUpdateDeferredDetail {
  buildId: string;
}

function getCurrentBuildId(): string {
  try {
    return typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__.trim() : '';
  } catch {
    return '';
  }
}

function isValidBuildId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'dev' || trimmed === '__APP_BUILD_ID__') return false;
  return /^[a-zA-Z0-9._-]{4,80}$/.test(trimmed);
}

function isChunkLoadError(err: unknown): boolean {
  const text =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? `${err.name} ${err.message}`
        : err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : '';
  return Boolean(text) && CHUNK_LOAD_ERROR_PATTERNS.some((re) => re.test(text));
}

function isUserEditingForm(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement as HTMLElement | null;
  if (!active || active === document.body || active === document.documentElement) return false;
  const tag = active.tagName?.toUpperCase() ?? '';
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    return EDITABLE_INPUT_TYPES.has(((active as HTMLInputElement).type || '').toLowerCase());
  }
  return Boolean(active.isContentEditable);
}

function canAttemptReload(guardKey: string, signature: string, cooldownMs = RELOAD_COOLDOWN_MS): boolean {
  try {
    const raw = window.sessionStorage.getItem(guardKey);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { signature?: string; at?: number };
    if (parsed?.signature === signature && typeof parsed.at === 'number' && Date.now() - parsed.at < cooldownMs) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

function markReloadAttempt(guardKey: string, signature: string): void {
  try {
    window.sessionStorage.setItem(guardKey, JSON.stringify({ signature, at: Date.now() }));
  } catch {
    // ignorar
  }
}

async function purgeFdvStaticCaches(): Promise<void> {
  if (typeof caches !== 'undefined') {
    try {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name !== PRESERVED_SHARE_CACHE)
          .map((name) => caches.delete(name).catch(() => false))
      );
    } catch {
      // ignorar
    }
  }
}

let reloadInFlight = false;

export async function performCleanFdvReload(options: {
  signature: string;
  guardKey?: string;
  manual?: boolean;
  cooldownMs?: number;
}): Promise<boolean> {
  if (reloadInFlight && !options.manual) return false;
  const guardKey = options.guardKey ?? FDV_VERSION_RELOAD_GUARD_KEY;
  if (!options.manual && !canAttemptReload(guardKey, options.signature, options.cooldownMs)) {
    return false;
  }
  reloadInFlight = true;
  if (!options.manual) {
    markReloadAttempt(guardKey, options.signature);
  }

  await purgeFdvStaticCaches();

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      if (reg) {
        await Promise.race([
          reg.update().catch(() => undefined),
          new Promise((resolve) => setTimeout(resolve, 1200)),
        ]);
      }
    } catch {
      // continuar
    }
  }

  window.location.reload();
  return true;
}

async function fetchServerBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('application/json')) return null;
    const data = (await res.json()) as { buildId?: unknown } | null;
    return data && isValidBuildId(data.buildId) ? data.buildId.trim() : null;
  } catch {
    return null;
  }
}

let guardStarted = false;

export function startFdvVersionGuard(): void {
  if (typeof window === 'undefined' || guardStarted) return;
  guardStarted = true;

  // Capa 5: auto-recuperación de chunks diferidos tras un deploy
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    void performCleanFdvReload({
      signature: `fdv-preload:${getCurrentBuildId() || 'current'}`,
      guardKey: FDV_PRELOAD_RELOAD_GUARD_KEY,
      cooldownMs: 30 * 1000,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return;
    event.preventDefault();
    void performCleanFdvReload({
      signature: `fdv-dynamic-import:${getCurrentBuildId() || 'current'}`,
      guardKey: FDV_PRELOAD_RELOAD_GUARD_KEY,
      cooldownMs: 30 * 1000,
    });
  });

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const hadControllerAtBoot = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadControllerAtBoot) return;
      if (isUserEditingForm()) {
        window.dispatchEvent(
          new CustomEvent<FdvUpdateDeferredDetail>(FDV_APP_UPDATE_DEFERRED_EVENT, {
            detail: { buildId: getCurrentBuildId() || 'nueva-version' },
          })
        );
        return;
      }
      void performCleanFdvReload({
        signature: `fdv-sw:${getCurrentBuildId() || 'runtime'}`,
      });
    });
  }

  const localBuildId = getCurrentBuildId();
  if (!isValidBuildId(localBuildId)) return;

  let lastCheckAt = 0;
  let pendingBuildId: string | null = null;

  const checkVersion = (force: boolean, respectInput: boolean) => {
    if (navigator.onLine === false) return;
    const now = Date.now();
    if (!force && now - lastCheckAt < MIN_CHECK_GAP_MS) return;
    lastCheckAt = now;

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker
        .getRegistration('/')
        .then((reg) => reg?.update().catch(() => undefined))
        .catch(() => undefined);
    }

    void fetchServerBuildId().then(async (remoteBuildId) => {
      if (!remoteBuildId || remoteBuildId === localBuildId) return;
      if (respectInput && isUserEditingForm()) {
        pendingBuildId = remoteBuildId;
        window.dispatchEvent(
          new CustomEvent<FdvUpdateDeferredDetail>(FDV_APP_UPDATE_DEFERRED_EVENT, {
            detail: { buildId: remoteBuildId },
          })
        );
        return;
      }
      const reloaded = await performCleanFdvReload({ signature: remoteBuildId });
      if (!reloaded) {
        pendingBuildId = remoteBuildId;
        window.dispatchEvent(
          new CustomEvent<FdvUpdateDeferredDetail>(FDV_APP_UPDATE_DEFERRED_EVENT, {
            detail: { buildId: remoteBuildId },
          })
        );
      }
    });
  };

  checkVersion(true, false);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (pendingBuildId && !isUserEditingForm()) {
      const target = pendingBuildId;
      pendingBuildId = null;
      void performCleanFdvReload({ signature: target });
      return;
    }
    checkVersion(false, true);
  });

  document.addEventListener('focusout', () => {
    if (!pendingBuildId) return;
    window.setTimeout(() => {
      if (pendingBuildId && !isUserEditingForm()) {
        const target = pendingBuildId;
        pendingBuildId = null;
        void performCleanFdvReload({ signature: target });
      }
    }, 400);
  });

  window.addEventListener('focus', () => checkVersion(false, true));
  window.addEventListener('online', () => checkVersion(true, true));
  window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      checkVersion(true, true);
    }
  }, POLL_INTERVAL_MS);
}
