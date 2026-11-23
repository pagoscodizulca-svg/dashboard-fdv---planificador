/**
 * PLANIFICADOR CENTRALIZADO DE SINCRONIZACIÓN AUTOMÁTICA (60s) Y LAST-KNOWN-GOOD
 * -------------------------------------------------------------------------------
 * - Ejecución periódica no solapada cada 60s (`SYNC_INTERVAL_MS = 60_000`) + sync inicial.
 * - Mutex de concurrencia (`isSyncing`) + coalescencia de promesas en vuelo:
 *   si el cron y una petición manual coinciden, comparten la misma ejecución sin duplicar
 *   peticiones contra Google Sheets (prevención HTTP 429 / Quota Exhaustion).
 * - Cooldown mínimo en servidor de 15s (`MANUAL_COOLDOWN_MS = 15_000`) para disparos manuales.
 * - Caché centralizada con TTL de 55s (`CACHE_TTL_MS = 55_000`) y marcas `lastUpdated` (ISO 8601)
 *   + `lastUpdatedCaracas` (`America/Caracas`, UTC-4).
 * - Estrategia Last-Known-Good estricta: jamás sobrescribe el último snapshot válido con
 *   arreglos vacíos ni errores transitorios; aplica reintentos con exponential backoff acotado.
 * - Ciclo de vida limpio (`start()` / `stop()`) para señales `SIGTERM` / `SIGINT` en Render.
 */

export const DEFAULT_SYNC_INTERVAL_MS = 60_000;
export const DEFAULT_SERVER_CACHE_TTL_MS = 55_000;
export const DEFAULT_MANUAL_COOLDOWN_MS = 15_000;

export type SyncTriggerSource = 'startup' | 'interval' | 'manual' | 'webhook';

export type SyncExecutionStatus =
  | 'OK'
  | 'SKIPPED_UNCHANGED'
  | 'COOLDOWN_CACHED'
  | 'DEGRADED_FALLBACK';

export interface SyncLogger {
  info: (event: string, meta?: Record<string, unknown>) => void;
  warn: (event: string, meta?: Record<string, unknown>) => void;
  error: (event: string, meta?: Record<string, unknown>) => void;
}

export interface SyncRunOutcome<TPayload> {
  status: SyncExecutionStatus;
  payload: TPayload | null;
  unchanged?: boolean;
  degraded: boolean;
  lastUpdated: string | null;
  lastUpdatedCaracas: string | null;
  cooldownRemainingSeconds: number;
  source: SyncTriggerSource;
}

export interface SyncSchedulerStatus {
  isRunning: boolean;
  isSyncing: boolean;
  degraded: boolean;
  hasValidCache: boolean;
  isCacheFresh: boolean;
  lastUpdated: string | null;
  lastUpdatedCaracas: string | null;
  lastAttemptAt: string | null;
  syncIntervalMs: number;
  cacheTtlMs: number;
  manualCooldownMs: number;
  cooldownRemainingSeconds: number;
  consecutiveFailures: number;
  lastErrorCode: string | null;
}

export interface SheetsSyncSchedulerOptions<TPayload> {
  /** Función que realiza la lectura/ingesta desde Google Sheets (solo lectura). */
  syncFn: (context: { source: SyncTriggerSource; forceRebuild: boolean; attempt: number }) => Promise<{
    payload: TPayload;
    unchanged?: boolean;
    syncedAt?: string;
  }>;
  /** Valida que el payload devuelto contenga datos útiles antes de reemplazar el Last-Known-Good. */
  isValidPayload?: (payload: TPayload | null | undefined) => boolean;
  syncIntervalMs?: number;
  cacheTtlMs?: number;
  manualCooldownMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  nowFn?: () => number;
  delayFn?: (ms: number) => Promise<void>;
  logger?: SyncLogger;
}

const defaultLogger: SyncLogger = {
  info: (event, meta) => {
    console.log(JSON.stringify({ level: 'INFO', component: 'SheetsSyncScheduler', event, ...(meta || {}) }));
  },
  warn: (event, meta) => {
    console.warn(JSON.stringify({ level: 'WARN', component: 'SheetsSyncScheduler', event, ...(meta || {}) }));
  },
  error: (event, meta) => {
    console.error(JSON.stringify({ level: 'ERROR', component: 'SheetsSyncScheduler', event, ...(meta || {}) }));
  }
};

/**
 * Formatea un instante en zona horaria oficial `America/Caracas` (UTC-4): `DD/MM/YYYY HH:mm:ss VET`.
 */
export function formatCaracasTimestamp(input?: Date | string | number | null): string | null {
  if (input === null || input === undefined) return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const pick = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return `${pick('day')}/${pick('month')}/${pick('year')} ${pick('hour')}:${pick('minute')}:${pick('second')} VET`;
}

function classifySafeErrorCode(err: unknown): string {
  const msg = String((err as { message?: string })?.message || '').toUpperCase();
  const name = String((err as { name?: string })?.name || '').toUpperCase();
  if (name === 'ABORTERROR' || msg.includes('ABORT') || msg.includes('TIMEOUT')) return 'SHEETS_TIMEOUT';
  if (msg.includes('429')) return 'SHEETS_RATE_LIMITED_429';
  if (/\b5\d{2}\b/.test(msg)) return 'SHEETS_UPSTREAM_5XX';
  if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('FETCH FAILED') || msg.includes('NETWORK')) {
    return 'SHEETS_NETWORK_ERROR';
  }
  if (msg.includes('EMPTY_PAYLOAD')) return 'SHEETS_EMPTY_PAYLOAD';
  return 'SHEETS_SYNC_ERROR';
}

export class SheetsSyncScheduler<TPayload> {
  private readonly syncFn: SheetsSyncSchedulerOptions<TPayload>['syncFn'];
  private readonly isValidPayload: (payload: TPayload | null | undefined) => boolean;
  private readonly syncIntervalMs: number;
  private readonly cacheTtlMs: number;
  private readonly manualCooldownMs: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly nowFn: () => number;
  private readonly delayFn: (ms: number) => Promise<void>;
  private readonly logger: SyncLogger;

  private isRunning = false;
  private isSyncing = false;
  private inFlightPromise: Promise<SyncRunOutcome<TPayload>> | null = null;
  private timerHandle: ReturnType<typeof setTimeout> | null = null;
  private startupHandle: ReturnType<typeof setTimeout> | null = null;

  private lastKnownGood: TPayload | null = null;
  private lastUpdatedIso: string | null = null;
  private lastUpdatedCaracas: string | null = null;
  private lastSuccessMs = 0;
  private lastAttemptMs = 0;
  private degraded = false;
  private consecutiveFailures = 0;
  private lastErrorCode: string | null = null;

  constructor(options: SheetsSyncSchedulerOptions<TPayload>) {
    this.syncFn = options.syncFn;
    this.isValidPayload = options.isValidPayload || ((p) => p !== null && p !== undefined);
    this.syncIntervalMs = Math.max(10_000, Math.round(options.syncIntervalMs ?? DEFAULT_SYNC_INTERVAL_MS));
    this.cacheTtlMs = Math.max(5_000, Math.round(options.cacheTtlMs ?? DEFAULT_SERVER_CACHE_TTL_MS));
    this.manualCooldownMs = Math.max(1_000, Math.round(options.manualCooldownMs ?? DEFAULT_MANUAL_COOLDOWN_MS));
    this.maxRetries = Math.max(1, Math.min(5, Math.round(options.maxRetries ?? 3)));
    this.baseBackoffMs = Math.max(50, Math.round(options.baseBackoffMs ?? 500));
    this.maxBackoffMs = Math.max(this.baseBackoffMs, Math.round(options.maxBackoffMs ?? 4_000));
    this.nowFn = options.nowFn || (() => Date.now());
    this.delayFn = options.delayFn || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.logger = options.logger || defaultLogger;
  }

  /**
   * Permite precargar una instantánea inicial válida (ej. desde Supabase o respaldo local en arranque frío)
   * sin perderla si la primera llamada a Google Sheets falla.
   */
  seedLastKnownGood(payload: TPayload, updatedAtIso?: string | null): void {
    if (!this.isValidPayload(payload)) return;
    if (this.lastKnownGood !== null) return;
    this.lastKnownGood = payload;
    const iso = updatedAtIso || new Date(this.nowFn()).toISOString();
    this.lastUpdatedIso = iso;
    this.lastUpdatedCaracas = formatCaracasTimestamp(iso);
    this.lastSuccessMs = this.nowFn();
  }

  getCooldownRemainingSeconds(): number {
    if (this.lastSuccessMs <= 0) return 0;
    const elapsed = this.nowFn() - this.lastSuccessMs;
    if (elapsed >= this.manualCooldownMs) return 0;
    return Math.ceil((this.manualCooldownMs - elapsed) / 1000);
  }

  isCacheFresh(): boolean {
    if (this.lastKnownGood === null || this.lastSuccessMs <= 0) return false;
    return this.nowFn() - this.lastSuccessMs < this.cacheTtlMs;
  }

  getSnapshot(): {
    payload: TPayload | null;
    lastUpdated: string | null;
    lastUpdatedCaracas: string | null;
    degraded: boolean;
    isFresh: boolean;
  } {
    return {
      payload: this.lastKnownGood,
      lastUpdated: this.lastUpdatedIso,
      lastUpdatedCaracas: this.lastUpdatedCaracas,
      degraded: this.degraded,
      isFresh: this.isCacheFresh()
    };
  }

  getStatus(): SyncSchedulerStatus {
    return {
      isRunning: this.isRunning,
      isSyncing: this.isSyncing,
      degraded: this.degraded,
      hasValidCache: this.lastKnownGood !== null,
      isCacheFresh: this.isCacheFresh(),
      lastUpdated: this.lastUpdatedIso,
      lastUpdatedCaracas: this.lastUpdatedCaracas,
      lastAttemptAt: this.lastAttemptMs > 0 ? new Date(this.lastAttemptMs).toISOString() : null,
      syncIntervalMs: this.syncIntervalMs,
      cacheTtlMs: this.cacheTtlMs,
      manualCooldownMs: this.manualCooldownMs,
      cooldownRemainingSeconds: this.getCooldownRemainingSeconds(),
      consecutiveFailures: this.consecutiveFailures,
      lastErrorCode: this.lastErrorCode
    };
  }

  /**
   * Inicia el planificador automático cada 60s con ejecución inicial configurable y sin solapamiento.
   */
  start(options: { initialDelayMs?: number } = {}): void {
    if (this.isRunning) return;
    this.isRunning = true;
    const initialDelayMs = Math.max(0, Math.round(options.initialDelayMs ?? 3_000));

    const scheduleNext = () => {
      if (!this.isRunning) return;
      this.timerHandle = setTimeout(async () => {
        this.timerHandle = null;
        if (!this.isRunning) return;
        await this.triggerSync({ source: 'interval' });
        scheduleNext();
      }, this.syncIntervalMs);
      if (typeof (this.timerHandle as any)?.unref === 'function') {
        (this.timerHandle as any).unref();
      }
    };

    this.startupHandle = setTimeout(async () => {
      this.startupHandle = null;
      if (!this.isRunning) return;
      await this.triggerSync({ source: 'startup' });
      scheduleNext();
    }, initialDelayMs);

    if (typeof (this.startupHandle as any)?.unref === 'function') {
      (this.startupHandle as any).unref();
    }
  }

  /**
   * Detiene limpiamente todos los temporizadores activos (invocado en `SIGTERM` / `SIGINT` en Render).
   */
  stop(): void {
    this.isRunning = false;
    if (this.startupHandle) {
      clearTimeout(this.startupHandle);
      this.startupHandle = null;
    }
    if (this.timerHandle) {
      clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
  }

  /**
   * Dispara una sincronización con mutex de concurrencia (`isSyncing`), coalescencia de promesa en vuelo,
   * cooldown de 15s para disparos manuales y preservación Last-Known-Good ante errores.
   */
  async triggerSync(params: {
    source?: SyncTriggerSource;
    forceRebuild?: boolean;
  } = {}): Promise<SyncRunOutcome<TPayload>> {
    const source: SyncTriggerSource = params.source || 'manual';
    const forceRebuild = Boolean(params.forceRebuild);

    // 1. Mutex de concurrencia: reutilizar la promesa en vuelo sin duplicar peticiones contra Google Sheets
    if (this.inFlightPromise) {
      return this.inFlightPromise;
    }

    // 2. Cooldown preventivo de 15s en servidor para disparos manuales (protección contra agotamiento de cuota)
    if (source === 'manual' && this.lastKnownGood !== null) {
      const remainingSec = this.getCooldownRemainingSeconds();
      if (remainingSec > 0) {
        this.logger.info('MANUAL_SYNC_COOLDOWN_HIT', {
          cooldownRemainingSeconds: remainingSec,
          lastUpdated: this.lastUpdatedIso
        });
        return {
          status: 'COOLDOWN_CACHED',
          payload: this.lastKnownGood,
          unchanged: true,
          degraded: this.degraded,
          lastUpdated: this.lastUpdatedIso,
          lastUpdatedCaracas: this.lastUpdatedCaracas,
          cooldownRemainingSeconds: remainingSec,
          source
        };
      }
    }

    this.isSyncing = true;
    this.lastAttemptMs = this.nowFn();

    this.inFlightPromise = (async (): Promise<SyncRunOutcome<TPayload>> => {
      let lastErr: unknown = null;

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const result = await this.syncFn({ source, forceRebuild, attempt });

          if (!this.isValidPayload(result?.payload)) {
            throw new Error('EMPTY_PAYLOAD');
          }

          const nowMs = this.nowFn();
          const syncedIso = result.syncedAt || new Date(nowMs).toISOString();
          this.lastKnownGood = result.payload;
          this.lastUpdatedIso = syncedIso;
          this.lastUpdatedCaracas = formatCaracasTimestamp(syncedIso);
          this.lastSuccessMs = nowMs;
          this.degraded = false;
          this.consecutiveFailures = 0;
          this.lastErrorCode = null;

          const status: SyncExecutionStatus = result.unchanged ? 'SKIPPED_UNCHANGED' : 'OK';
          return {
            status,
            payload: this.lastKnownGood,
            unchanged: Boolean(result.unchanged),
            degraded: false,
            lastUpdated: this.lastUpdatedIso,
            lastUpdatedCaracas: this.lastUpdatedCaracas,
            cooldownRemainingSeconds: this.getCooldownRemainingSeconds(),
            source
          };
        } catch (err) {
          lastErr = err;
          const errorCode = classifySafeErrorCode(err);
          this.logger.warn('SHEETS_SYNC_ATTEMPT_FAILED', {
            source,
            attempt,
            maxRetries: this.maxRetries,
            errorCode
          });

          if (attempt < this.maxRetries) {
            const backoffMs = Math.min(this.maxBackoffMs, this.baseBackoffMs * Math.pow(2, attempt - 1));
            await this.delayFn(backoffMs);
          }
        }
      }

      // Todos los intentos fallaron: preservar Last-Known-Good intacto (jamás sobrescribir con vacío)
      const finalErrorCode = classifySafeErrorCode(lastErr);
      this.degraded = true;
      this.consecutiveFailures += 1;
      this.lastErrorCode = finalErrorCode;

      this.logger.error('SHEETS_SYNC_DEGRADED_LAST_KNOWN_GOOD', {
        source,
        errorCode: finalErrorCode,
        consecutiveFailures: this.consecutiveFailures,
        hasLastKnownGood: this.lastKnownGood !== null,
        lastUpdated: this.lastUpdatedIso
      });

      return {
        status: 'DEGRADED_FALLBACK',
        payload: this.lastKnownGood,
        unchanged: true,
        degraded: true,
        lastUpdated: this.lastUpdatedIso,
        lastUpdatedCaracas: this.lastUpdatedCaracas,
        cooldownRemainingSeconds: this.getCooldownRemainingSeconds(),
        source
      };
    })();

    try {
      return await this.inFlightPromise;
    } finally {
      this.isSyncing = false;
      this.inFlightPromise = null;
    }
  }
}
