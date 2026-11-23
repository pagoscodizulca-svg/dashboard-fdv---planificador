import { describe, it, expect, vi, afterEach } from 'vitest';
import * as XLSX from 'xlsx';
import {
  DEFAULT_MANUAL_COOLDOWN_MS,
  DEFAULT_SERVER_CACHE_TTL_MS,
  DEFAULT_SYNC_INTERVAL_MS,
  SheetsSyncScheduler,
  formatCaracasTimestamp
} from '../../src/services/sheetsSyncScheduler';
import {
  parseWorkbookFull,
  resolveCriticalSheetTabs
} from '../../src/services/googleSheetsParser';

const silentLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

describe('Sincronización Automática 60s — Resiliencia, Concurrencia y Tolerancia de Pestañas', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // 1. Resolución tolerante de las 3 pestañas críticas con normalize('NFD')
  // ============================================================================
  describe('1. Normalización y resolución tolerante de las 3 pestañas críticas', () => {
    it('resuelve "Activación por Cliente ", "SKU por Volumen" y "Activación por Rubro " ignorando tildes, mayúsculas y espacios', () => {
      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ['CODIGO', 'RAZON SOCIAL', 'VENDEDOR', 'ACEITE', 'AZUCAR', 'POLLO', 'ESTANDAR Y SUPERIOR ASTURIAS', 'MORTADELA SALPICAO Y ASTURIAS'],
          ['1001', 'SUPERMERCADO CENTRAL', 'MARIA BRICEÑO', 'NO', 'SI', 'NO', 'NO', 'NO']
        ]),
        '  Activación por Cliente  '
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          [null, null, 'MARIA BRICEÑO', null, null],
          ['Cod', 'Articulo', 'CUOTA', 'KG', '%'],
          ['1568', 'POLLO VENCAMPO POR KG', 500, 320.5, 0.641]
        ]),
        '  SKU   por  Volúmen '
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          [null, null, 'AZUCAR', null, 'LECHE VENCAMPO', null, 'POLLO', null, 'ESTANDAR Y SUPERIOR ASTURIAS', null, 'MORTADELA SALPICAO Y ASTURIAS', null],
          ['Vendedor', 'CARTERA', 'Meta', 'Activados', 'Meta', 'Activados', 'Meta', 'Activados', 'Meta', 'Activados', 'Meta', 'Activados'],
          ['MARIA BRICEÑO', 80, 40, 28, 20, 22, 15, 10, 30, 18, 25, 12]
        ]),
        ' Activación por Rubro '
      );

      const resolved = resolveCriticalSheetTabs(wb);
      expect(resolved.activacionCliente?.sheetName).toBe('  Activación por Cliente  ');
      expect(resolved.volumenSku?.sheetName).toBe('  SKU   por  Volúmen ');
      expect(resolved.activacionRubro?.sheetName).toBe(' Activación por Rubro ');

      const parsed = parseWorkbookFull(XLSX, wb, { periodo: '2026-11', masterClients: [] });
      expect(parsed.activacionApiRows).toHaveLength(1);
      expect(parsed.activacionApiRows[0]).toMatchObject({ id: '1001', status: 'ACTIVO' });
      expect(parsed.volumenApiRows).toHaveLength(1);
      expect(parsed.volumenApiRows[0]).toMatchObject({ metaKg: 500, ejecutadoKg: 320.5 });
      expect(parsed.metasApiRows).toHaveLength(5);
      expect(parsed.metasApiRows.find((m) => m.categoria === 'AZUCAR')).toMatchObject({ meta: 40, activados: 28 });
    });

    it('mantiene 100% compatibilidad con nombres históricos ("Volumen por SKU", "Grid de Activación por Vendedor")', () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['A']]), 'Volumen por SKU');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['A']]), 'Activación por Cliente');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['A']]), 'Grid de Activación por Vendedor');

      const resolved = resolveCriticalSheetTabs(wb);
      expect(resolved.volumenSku?.sheetName).toBe('Volumen por SKU');
      expect(resolved.activacionCliente?.sheetName).toBe('Activación por Cliente');
      expect(resolved.activacionRubro?.sheetName).toBe('Grid de Activación por Vendedor');
    });
  });

  // ============================================================================
  // 2. Mutex de concurrencia (isSyncing) + coalescencia ante llamadas simultáneas
  // ============================================================================
  describe('2. Mutex isSyncing y coalescencia de promesas concurrentes', () => {
    it('coalesce 5 llamadas simultáneas en exactamente 1 única consulta contra Google Sheets', async () => {
      let resolveSheetFetch!: (val: { payload: { rows: number }; syncedAt: string }) => void;
      const syncFn = vi.fn(
        () =>
          new Promise<{ payload: { rows: number }; syncedAt: string }>((resolve) => {
            resolveSheetFetch = resolve;
          })
      );

      const scheduler = new SheetsSyncScheduler<{ rows: number }>({
        syncFn,
        delayFn: async () => {},
        logger: silentLogger
      });

      const calls = [
        scheduler.triggerSync({ source: 'interval' }),
        scheduler.triggerSync({ source: 'manual' }),
        scheduler.triggerSync({ source: 'manual' }),
        scheduler.triggerSync({ source: 'manual' }),
        scheduler.triggerSync({ source: 'interval' })
      ];

      expect(scheduler.getStatus().isSyncing).toBe(true);
      expect(syncFn).toHaveBeenCalledTimes(1);

      resolveSheetFetch({ payload: { rows: 2716 }, syncedAt: '2026-11-23T20:00:00.000Z' });
      const results = await Promise.all(calls);

      expect(scheduler.getStatus().isSyncing).toBe(false);
      expect(syncFn).toHaveBeenCalledTimes(1);
      for (const r of results) {
        expect(r.status).toBe('OK');
        expect(r.payload).toEqual({ rows: 2716 });
        expect(r.lastUpdatedCaracas).toContain('VET');
      }
    });
  });

  // ============================================================================
  // 3. Ciclo automático cada 60 segundos + limpieza limpia (SIGTERM/stop)
  // ============================================================================
  describe('3. Planificador automático cada 60s y ciclo de vida limpio', () => {
    it('ejecuta sync inicial y repite cada 60000ms, deteniéndose limpiamente al invocar stop()', async () => {
      vi.useFakeTimers();
      let tick = 0;
      const syncFn = vi.fn(async () => {
        tick++;
        return { payload: { version: tick }, syncedAt: new Date().toISOString() };
      });

      const scheduler = new SheetsSyncScheduler<{ version: number }>({
        syncFn,
        syncIntervalMs: DEFAULT_SYNC_INTERVAL_MS,
        cacheTtlMs: DEFAULT_SERVER_CACHE_TTL_MS,
        manualCooldownMs: DEFAULT_MANUAL_COOLDOWN_MS,
        delayFn: async () => {},
        logger: silentLogger
      });

      scheduler.start({ initialDelayMs: 3000 });

      // Inicial tras 3s
      await vi.advanceTimersByTimeAsync(3000);
      expect(syncFn).toHaveBeenCalledTimes(1);

      // Ciclo 1 tras +60s
      await vi.advanceTimersByTimeAsync(60_000);
      expect(syncFn).toHaveBeenCalledTimes(2);

      // Ciclo 2 tras +60s
      await vi.advanceTimersByTimeAsync(60_000);
      expect(syncFn).toHaveBeenCalledTimes(3);
      expect(scheduler.getSnapshot().payload).toEqual({ version: 3 });

      // Simular SIGTERM -> stop() debe impedir cualquier nueva ejecución
      scheduler.stop();
      expect(scheduler.getStatus().isRunning).toBe(false);
      await vi.advanceTimersByTimeAsync(180_000);
      expect(syncFn).toHaveBeenCalledTimes(3);
    });
  });

  // ============================================================================
  // 4. Cooldown de 15s en servidor y TTL de caché 55s
  // ============================================================================
  describe('4. Cooldown preventivo 15s en servidor y TTL 55s', () => {
    it('protege cuota bloqueando disparos manuales repetidos dentro de 15s y expira caché a los 55s', async () => {
      let fakeNow = 1_700_000_000_000;
      let calls = 0;
      const syncFn = vi.fn(async () => {
        calls++;
        return { payload: { run: calls }, syncedAt: new Date(fakeNow).toISOString() };
      });

      const scheduler = new SheetsSyncScheduler<{ run: number }>({
        syncFn,
        nowFn: () => fakeNow,
        delayFn: async () => {},
        logger: silentLogger
      });

      const first = await scheduler.triggerSync({ source: 'manual' });
      expect(first.status).toBe('OK');
      expect(syncFn).toHaveBeenCalledTimes(1);
      expect(scheduler.isCacheFresh()).toBe(true);

      // 5s después: disparo manual cae en cooldown sin consultar Google Sheets
      fakeNow += 5_000;
      const cooled = await scheduler.triggerSync({ source: 'manual' });
      expect(cooled.status).toBe('COOLDOWN_CACHED');
      expect(cooled.cooldownRemainingSeconds).toBe(10);
      expect(syncFn).toHaveBeenCalledTimes(1);

      // A los 16s: se permite nuevamente disparo manual
      fakeNow += 11_000;
      const second = await scheduler.triggerSync({ source: 'manual' });
      expect(second.status).toBe('OK');
      expect(syncFn).toHaveBeenCalledTimes(2);

      // A los 54s del último éxito sigue fresca; a los 56s expira el TTL de 55s
      fakeNow += 54_000;
      expect(scheduler.isCacheFresh()).toBe(true);
      fakeNow += 2_000;
      expect(scheduler.isCacheFresh()).toBe(false);
    });
  });

  // ============================================================================
  // 5. Estrategia Last-Known-Good ante fallo simulado de Google Sheets (429 / Timeout)
  // ============================================================================
  describe('5. Preservación Last-Known-Good ante HTTP 429 / Timeout / payload vacío', () => {
    it('conserva intacto el último estado válido y aplica exponential backoff acotado ante caída de Google Sheets', async () => {
      const backoffDelays: number[] = [];
      let shouldFail = false;

      const syncFn = vi.fn(async () => {
        if (shouldFail) {
          throw new Error('HTTP 429 Too Many Requests');
        }
        return {
          payload: { clientes: 2716, volumenKg: 1464302.7, activados: 3285 },
          syncedAt: '2026-11-23T20:15:00.000Z'
        };
      });

      const scheduler = new SheetsSyncScheduler<{ clientes: number; volumenKg: number; activados: number }>({
        syncFn,
        maxRetries: 3,
        baseBackoffMs: 500,
        maxBackoffMs: 4000,
        delayFn: async (ms) => {
          backoffDelays.push(ms);
        },
        logger: silentLogger
      });

      // 1) Ingesta exitosa inicial
      const ok = await scheduler.triggerSync({ source: 'startup' });
      expect(ok.status).toBe('OK');
      expect(ok.degraded).toBe(false);
      expect(ok.payload?.clientes).toBe(2716);
      expect(formatCaracasTimestamp('2026-11-23T20:15:00.000Z')).toBe('23/11/2026 16:15:00 VET');

      // 2) Simular caída HTTP 429 de Google Sheets en el siguiente ciclo de 60s
      shouldFail = true;
      const degraded = await scheduler.triggerSync({ source: 'interval' });

      expect(degraded.status).toBe('DEGRADED_FALLBACK');
      expect(degraded.degraded).toBe(true);
      // Last-Known-Good intacto (jamás reemplazado por null o vacío)
      expect(degraded.payload).toEqual({ clientes: 2716, volumenKg: 1464302.7, activados: 3285 });
      expect(degraded.lastUpdated).toBe('2026-11-23T20:15:00.000Z');
      expect(backoffDelays).toEqual([500, 1000]);
      expect(scheduler.getStatus().consecutiveFailures).toBe(1);
      expect(scheduler.getStatus().lastErrorCode).toBe('SHEETS_RATE_LIMITED_429');

      // 3) Recuperación automática en el siguiente ciclo limpia estado degradado
      shouldFail = false;
      const recovered = await scheduler.triggerSync({ source: 'interval' });
      expect(recovered.status).toBe('OK');
      expect(recovered.degraded).toBe(false);
      expect(scheduler.getStatus().consecutiveFailures).toBe(0);
    });

    it('rechaza payloads vacíos vía isValidPayload preservando el último snapshot bueno', async () => {
      let emptyResponse = false;
      const scheduler = new SheetsSyncScheduler<{ count: number }>({
        syncFn: async () => ({ payload: { count: emptyResponse ? 0 : 120 }, syncedAt: '2026-11-23T20:20:00.000Z' }),
        isValidPayload: (p) => Boolean(p && p.count > 0),
        maxRetries: 2,
        delayFn: async () => {},
        logger: silentLogger
      });

      await scheduler.triggerSync({ source: 'startup' });
      expect(scheduler.getSnapshot().payload).toEqual({ count: 120 });

      emptyResponse = true;
      const res = await scheduler.triggerSync({ source: 'interval' });
      expect(res.status).toBe('DEGRADED_FALLBACK');
      expect(res.degraded).toBe(true);
      expect(res.payload).toEqual({ count: 120 });
      expect(scheduler.getStatus().lastErrorCode).toBe('SHEETS_EMPTY_PAYLOAD');
    });
  });
});
