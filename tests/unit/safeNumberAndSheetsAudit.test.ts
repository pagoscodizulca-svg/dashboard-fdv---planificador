import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as XLSX from 'xlsx';
import {
  DataQualityTracker,
  calculateCompliancePct,
  isValidNumericCell,
  parseSafeNumber,
  parseSafePercentage,
  roundToDecimals,
  sanitizeSheetText,
  sumDecimalExact,
  sumMoneyCents
} from '../../src/utils/safeNumber';
import {
  FOCUS_PRODUCT_ALIASES,
  FOCUS_PRODUCT_CODES,
  buildValidatedGoogleSheetUrl,
  isClientActiveForFocusProduct,
  isClientActiveInAnyFocusProduct,
  isSummaryOrHeaderLabel,
  sanitizeGoogleSheetGid,
  sanitizeGoogleSheetId,
  validateGoogleSheetsUrl
} from '../../src/config/sheetsConfig';
import { parseWorkbookFull } from '../../src/services/googleSheetsParser';
import {
  DEFAULT_SHEETS_CACHE_TTL_MS,
  clearSheetsCache,
  fetchVolumenData,
  getCachedSheetsSnapshot,
  setSheetsCacheTtlMs
} from '../../src/services/googleSheetsService';

describe('Fase 2 — Línea Base de Exactitud Numérica, Parser Resiliente, Seguridad OWASP y Caché', () => {
  // ==========================================================================
  // 1. Suite parseSafeNumber (formatos regionales, contables, monedas y errores)
  // ==========================================================================
  describe('Suite 1: parseSafeNumber & DataQualityTracker', () => {
    it('parsea formatos hispanos con separadores de miles y coma decimal (incluye corrección 1000x)', () => {
      expect(parseSafeNumber('1.234,56')).toBe(1234.56);
      expect(parseSafeNumber('1.250')).toBe(1250);
      expect(parseSafeNumber('8.000')).toBe(8000);
      expect(parseSafeNumber('120.500')).toBe(120500);
      expect(parseSafeNumber('1.234.567,89')).toBe(1234567.89);
      expect(parseSafeNumber('-56,60')).toBe(-56.6);
      // Valores decimales que NO deben perder su punto decimal
      expect(parseSafeNumber('0.125')).toBe(0.125);
      expect(parseSafeNumber('0.95')).toBe(0.95);
      expect(parseSafeNumber('12.50')).toBe(12.5);
      expect(parseSafeNumber('36.425', { allowThreeDecimals: true })).toBe(36.425);
    });

    it('parsea formatos anglosajones, decimales simples y números nativos', () => {
      expect(parseSafeNumber('1,234.56')).toBe(1234.56);
      expect(parseSafeNumber('1,250.00')).toBe(1250);
      expect(parseSafeNumber('1234.56')).toBe(1234.56);
      expect(parseSafeNumber('0,95')).toBe(0.95);
      expect(parseSafeNumber(1.25)).toBe(1.25);
      expect(parseSafeNumber(-0)).toBe(0);
    });

    it('limpia monedas, unidades y espacios Unicode (NBSP, NNBSP, saltos de línea)', () => {
      expect(parseSafeNumber('Bs. 48.742,49')).toBe(48742.49);
      expect(parseSafeNumber('Bs.S 1.250,00')).toBe(1250);
      expect(parseSafeNumber('$ 1,250.00')).toBe(1250);
      expect(parseSafeNumber('USD\u00A0320,50\n')).toBe(320.5);
      expect(parseSafeNumber('1.250\u202FKG')).toBe(1250);
      expect(parseSafeNumber('85,5%')).toBe(85.5);
    });

    it('convierte negativos contables entre paréntesis', () => {
      expect(parseSafeNumber('(150,00)')).toBe(-150);
      expect(parseSafeNumber('(1.250,75)')).toBe(-1250.75);
      expect(parseSafeNumber('(45.20)')).toBe(-45.2);
      expect(parseSafeNumber('(Bs. 500,00)')).toBe(-500);
    });

    it('sanea vacíos, guiones y errores de Excel/Sheets sin emitir jamás NaN y registra DataQualityTracker', () => {
      const tracker = new DataQualityTracker();
      const blanks = ['', '   ', '-', '–', '—', null, undefined];
      const errors = ['N/A', '#N/A', '#N/D', '#DIV/0!', '#VALUE!', '#REF!', '#NAME?'];
      const nonFinite = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

      for (const b of blanks) {
        expect(parseSafeNumber(b, { tracker })).toBe(0);
      }
      for (const e of errors) {
        expect(parseSafeNumber(e, { tracker, context: 'test_err' })).toBe(0);
      }
      for (const nf of nonFinite) {
        expect(parseSafeNumber(nf, { tracker })).toBe(0);
      }
      expect(parseSafeNumber('fx', { tracker, context: 'residual' })).toBe(0);
      expect(isValidNumericCell('fx')).toBe(false);
      expect(isValidNumericCell('Bs. 1.250,50')).toBe(true);

      const snap = tracker.snapshot();
      expect(snap.emptyOrDash).toBe(blanks.length);
      expect(snap.sheetErrors).toBe(errors.length);
      expect(snap.nonFinite).toBe(nonFinite.length);
      expect(snap.invalidText).toBe(1);
      expect(snap.samples.some((s) => s.raw === '#DIV/0!')).toBe(true);
    });
  });

  // ==========================================================================
  // 2. Suite parseSafePercentage y Precisión IEEE-754
  // ==========================================================================
  describe('Suite 2: parseSafePercentage & Precisión IEEE-754', () => {
    it('estandariza escalas 0–1, porcentajes explícitos y 0–100 sin multiplicar erróneamente por 100', () => {
      expect(parseSafePercentage(0.503)).toBe(50.3);
      expect(parseSafePercentage(1.057)).toBe(105.7);
      expect(parseSafePercentage(-0.019)).toBe(-1.9);
      expect(parseSafePercentage('85,5%')).toBe(85.5);
      expect(parseSafePercentage('120.4%')).toBe(120.4);
      // Escala 0-100 explícita y detección segura en 'auto' (jamás 8550%!)
      expect(parseSafePercentage(85.5, { scale: 'percent_0_100' })).toBe(85.5);
      expect(parseSafePercentage(85.5)).toBe(85.5);
      // Con referenceRatio resuelve tanto ratios extremos (48.95 = 4895%) como 0-100 (85.5 = 85.5%)
      expect(parseSafePercentage(48.95, { referenceRatio: 1958 / 40 })).toBe(4895);
      expect(parseSafePercentage(85.5, { referenceRatio: 855 / 1000 })).toBe(85.5);
      expect(parseSafePercentage('#DIV/0!')).toBeNull();
      expect(parseSafePercentage('-')).toBeNull();
    });

    it('suma montos y decimales sin deriva flotante IEEE-754 ni concatenación de strings', () => {
      expect(sumMoneyCents([0.1, 0.2])).toBe(0.3);
      expect(sumMoneyCents([19.99, 0.01, 100.1, 0.2])).toBe(120.3);
      expect(sumMoneyCents(['1.250,50', 100, '(50,50)', 'Bs. 0,00', '#N/A'])).toBe(1300);
      expect(sumDecimalExact([10.125, 0.875, -1.0], 3)).toBe(10);
      expect(roundToDecimals(1.005, 2)).toBe(1.01);
      expect(calculateCompliancePct(855, 1000, 1)).toBe(85.5);
      expect(calculateCompliancePct(100, 0, 1)).toBe(0);
    });
  });

  // ==========================================================================
  // 3. Suite Mapeo Resiliente de Encabezados y Celdas Combinadas (!merges)
  // ==========================================================================
  describe('Suite 3: Encabezados Resilientes y Celdas Combinadas (!merges)', () => {
    it('soporta columnas reordenadas, encabezados con tildes/espacios irregulares y !merges con subetiquetas invertidas', () => {
      const wb = XLSX.utils.book_new();

      // Grid con rubros en orden distinto, espacios irregulares, tildes y !merges donde Activados viene antes que Meta
      const gridAoa = [
        [null, null, '  MORTADELA SALPICAO Y ASTURIAS  ', null, '   AZÚCAR\u00A0 ', null, 'LECHE VENCAMPO', null, 'POLLO', null, 'ESTANDAR Y SUPERIOR ASTURIAS', null],
        ['  Vendedor\u00A0 ', 'CARTERA', 'Activados', 'Meta Aceite ', 'Meta  Azúcar', 'Activados', 'Meta azucar', 'Activados', 'Meta pollo', 'Activados', 'Meta estandar', 'Activados'],
        ['MARIA BRICEÑO', '1.250', 22, 40, 70, 53, 28, 44, 15, 10, 60, 48]
      ];
      const gridSheet = XLSX.utils.aoa_to_sheet(gridAoa);
      gridSheet['!merges'] = [
        { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } },
        { s: { r: 0, c: 4 }, e: { r: 0, c: 5 } },
        { s: { r: 0, c: 6 }, e: { r: 0, c: 7 } },
        { s: { r: 0, c: 8 }, e: { r: 0, c: 9 } },
        { s: { r: 0, c: 10 }, e: { r: 0, c: 11 } }
      ];
      XLSX.utils.book_append_sheet(wb, gridSheet, 'Grid de Activación por Vendedor');

      // Volumen por SKU con !merges de 3 columnas y orden de subcolumnas alterado (KG, %, CUOTA)
      const volAoa = [
        [null, null, 'ADEL JARABA', null, null],
        ['  Código ', '  Artículo\u00A0 ', 'VENTA KG', '%', 'CUOTA KG'],
        ['1568', 'POLLO VENCAMPO POR KG', '1.250', '83,33%', '1.500']
      ];
      const volSheet = XLSX.utils.aoa_to_sheet(volAoa);
      volSheet['!merges'] = [{ s: { r: 0, c: 2 }, e: { r: 0, c: 4 } }];
      XLSX.utils.book_append_sheet(wb, volSheet, 'Volumen por SKU');

      const parsed = parseWorkbookFull(XLSX, wb, { periodo: '2026-11', masterClients: [] });

      const mort = parsed.metasApiRows.find((m) => m.categoria === 'MORTADELA SALPICAO Y ASTURIAS');
      expect(mort).toMatchObject({ cartera: 1250, meta: 40, activados: 22 });

      const azucar = parsed.metasApiRows.find((m) => m.categoria === 'AZUCAR');
      expect(azucar).toMatchObject({ cartera: 1250, meta: 70, activados: 53 });

      expect(parsed.volumenApiRows).toHaveLength(1);
      expect(parsed.volumenApiRows[0]).toMatchObject({
        vendedorId: 'ADEL JARABA',
        metaKg: 1500,
        ejecutadoKg: 1250,
        porcentajeCumplimiento: 83.33
      });
    });
  });

  // ==========================================================================
  // 4. Suite Exclusión Estricta de Filas de Resumen y Encabezados Repetidos
  // ==========================================================================
  describe('Suite 4: Exclusión Estricta de TOTAL / SUBTOTAL / PROMEDIO y Encabezados Repetidos', () => {
    it('descarta filas y columnas de resumen en Grid, Volumen por SKU, Activación por Cliente y hojas de detalle sin duplicar sumatorias', () => {
      expect(isSummaryOrHeaderLabel('TOTAL')).toBe(true);
      expect(isSummaryOrHeaderLabel('TOTAL GENERAL')).toBe(true);
      expect(isSummaryOrHeaderLabel('Sub-Total')).toBe(true);
      expect(isSummaryOrHeaderLabel('PROMEDIO')).toBe(true);
      expect(isSummaryOrHeaderLabel('TOTAL EMPRESA')).toBe(true);
      expect(isSummaryOrHeaderLabel('MARIA BRICEÑO')).toBe(false);
      expect(isSummaryOrHeaderLabel('INVERSIONES TOTAL FOOD C.A.')).toBe(false);

      const wb = XLSX.utils.book_new();

      // Grid con filas resumen etiquetadas + encabezado repetido en medio
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          [null, null, 'AZUCAR', null, 'LECHE VENCAMPO', null, 'POLLO', null, 'ESTANDAR Y SUPERIOR ASTURIAS', null, 'MORTADELA SALPICAO Y ASTURIAS', null],
          ['Vendedor', 'CARTERA', 'Meta', 'Activados', 'Meta', 'Activados', 'Meta', 'Activados', 'Meta', 'Activados', 'Meta', 'Activados'],
          ['MARIA BRICEÑO', 100, 50, 30, 20, 10, 15, 5, 40, 20, 30, 15],
          ['Vendedor', 'CARTERA', 'Meta', 'Activados', 'Meta', 'Activados', 'Meta', 'Activados', 'Meta', 'Activados', 'Meta', 'Activados'],
          ['SUBTOTAL', 100, 50, 30, 20, 10, 15, 5, 40, 20, 30, 15],
          ['TOTAL GENERAL', 100, 50, 30, 20, 10, 15, 5, 40, 20, 30, 15],
          ['PROMEDIO', 100, 50, 30, 20, 10, 15, 5, 40, 20, 30, 15],
          ['RESUMEN', 100, 50, 30, 20, 10, 15, 5, 40, 20, 30, 15]
        ]),
        'Grid de Activación por Vendedor'
      );

      // Volumen por SKU con columna TOTAL EMPRESA + filas TOTAL / SUBTOTAL / encabezado repetido
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          [null, null, 'MARIA BRICEÑO', null, null, 'TOTAL EMPRESA', null, null],
          ['Cod', 'Articulo', 'CUOTA', 'KG', '%', 'CUOTA', 'KG', '%'],
          ['1568', 'POLLO VENCAMPO POR KG', 200, 150, 0.75, 200, 150, 0.75],
          ['Cod', 'Articulo', 'CUOTA', 'KG', '%', 'CUOTA', 'KG', '%'],
          ['TOTAL', 'TOTAL GENERAL', 200, 150, 0.75, 200, 150, 0.75],
          ['SUBTOTAL', 'SUBTOTAL CARNES', 200, 150, 0.75, 200, 150, 0.75]
        ]),
        'Volumen por SKU'
      );

      // Hoja detalle Azucar con fila TOTAL y encabezado repetido
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ['Id Cliente', 'Cliente', 'Cajas'],
          ['329', 'CLIENTE REAL', '10,5'],
          ['Id Cliente', 'Cliente', 'Cajas'],
          ['TOTAL', 'TOTAL CAJAS', '10,5']
        ]),
        'Azucar'
      );

      // Activación por Cliente con fila TOTAL y encabezado repetido
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ['CODIGO', 'RAZON SOCIAL', 'VENDEDOR', 'ACEITE', 'AZUCAR', 'POLLO', 'ESTANDAR Y SUPERIOR ASTURIAS', 'MORTADELA SALPICAO Y ASTURIAS'],
          ['329', 'CLIENTE REAL', 'MARIA BRICEÑO', 'NO', 'SI', 'NO', 'NO', 'NO'],
          ['CODIGO', 'RAZON SOCIAL', 'VENDEDOR', 'ACEITE', 'AZUCAR', 'POLLO', 'ESTANDAR Y SUPERIOR ASTURIAS', 'MORTADELA SALPICAO Y ASTURIAS'],
          ['TOTAL', 'TOTAL GENERAL', 'TOTAL', 'SI', 'SI', 'SI', 'SI', 'SI']
        ]),
        'Activación por Cliente'
      );

      const parsed = parseWorkbookFull(XLSX, wb, { periodo: '2026-11', masterClients: [] });

      // Exactamente 1 vendedor x 5 rubros = 5 metas (0 duplicación por SUBTOTAL/TOTAL GENERAL/PROMEDIO/RESUMEN/header)
      expect(parsed.metasApiRows).toHaveLength(5);
      expect(parsed.metasApiRows.find((m) => m.categoria === 'AZUCAR')?.meta).toBe(50);

      // Exactamente 1 fila de volumen (ni columna TOTAL EMPRESA ni filas TOTAL/SUBTOTAL/header)
      expect(parsed.volumenApiRows).toHaveLength(1);
      expect(parsed.volumenApiRows[0].metaKg).toBe(200);
      expect(parsed.volumenApiRows[0].ejecutadoKg).toBe(150);

      // Exactamente 1 cliente en Azucar y Activación por Cliente (sin cliente fantasma "TOTAL")
      expect(parsed.productMaps.AZUCAR.has('TOTAL')).toBe(false);
      expect(parsed.productMaps.AZUCAR.get('329')).toBe(10.5);
      expect(parsed.activacionApiRows).toHaveLength(1);
      expect(parsed.activacionApiRows[0].id).toBe('329');

      // Verificar identidad de foco unificada
      expect(FOCUS_PRODUCT_CODES).toContain('POLLO');
      expect(FOCUS_PRODUCT_CODES).toContain('MORTADELA_SALPICAO');
      expect(FOCUS_PRODUCT_ALIASES.POLLO).toContain('ARROZ');
      expect(isClientActiveForFocusProduct({ cats: { ARROZ: true } }, 'POLLO')).toBe(true);
      expect(isClientActiveInAnyFocusProduct({ cats: { POLLO: true } })).toBe(true);
    });
  });

  // ==========================================================================
  // 5. Suite Seguridad OWASP (Allowlist de Red y Sanitización XSS)
  // ==========================================================================
  describe('Suite 5: Seguridad OWASP — Allowlist Google Sheets & Sanitización de Texto', () => {
    it('acepta únicamente IDs válidos sobre https://docs.google.com/spreadsheets/ y rechaza URLs maliciosas', () => {
      const validId = '1PLzYEe9GG1vHb_wjd7HA93U6UQNtyP-uk8sxVfiN4sg';
      const url = buildValidatedGoogleSheetUrl({ sheetId: validId, format: 'xlsx', gid: '12345', cacheBust: false });
      expect(url).toBe(`https://docs.google.com/spreadsheets/d/${validId}/export?format=xlsx&gid=12345`);
      expect(validateGoogleSheetsUrl(url)).toBe(url);

      // Rechaza protocolo inseguro, otros dominios, path traversal y credenciales embebidas
      expect(() => validateGoogleSheetsUrl(`http://docs.google.com/spreadsheets/d/${validId}/export`)).toThrow(/SECURITY_ALLOWLIST/);
      expect(() => validateGoogleSheetsUrl(`https://evil.example.com/spreadsheets/d/${validId}/export`)).toThrow(/SECURITY_ALLOWLIST/);
      expect(() => validateGoogleSheetsUrl(`https://docs.google.com/spreadsheets/d/${validId}/../../etc/passwd`)).toThrow(/SECURITY_ALLOWLIST/);
      expect(() => validateGoogleSheetsUrl(`https://user:pass@docs.google.com/spreadsheets/d/${validId}/export`)).toThrow(/SECURITY_ALLOWLIST/);
      expect(() => validateGoogleSheetsUrl('https://docs.google.com/document/d/1234567890123456789012/edit')).toThrow(/SECURITY_ALLOWLIST/);

      // Rechaza placeholders, inyección de query en ID y GID inválido
      expect(sanitizeGoogleSheetId('<GOOGLE_SHEET_ID>')).toBe('');
      expect(sanitizeGoogleSheetId('abc?evil=1')).toBe('');
      expect(sanitizeGoogleSheetId('https://evil.com/spreadsheets/d/1PLzYEe9GG1vHb_wjd7HA93U6UQNtyP-uk8sxVfiN4sg/edit')).toBe('');
      expect(sanitizeGoogleSheetGid('<GID_HOJA_GRID>')).toBe('');
      expect(sanitizeGoogleSheetGid('123&format=html')).toBe('');
      expect(() => buildValidatedGoogleSheetUrl({ sheetId: '<GOOGLE_SHEET_ID>' })).toThrow(/SECURITY_ALLOWLIST/);
    });

    it('sanitiza caracteres de control invisibles sin evaluar HTML/scripts', () => {
      const clean = sanitizeSheetText('  \u0000\u0007Cliente\u00A0\u200B<img src=x onerror=alert(1)>\t\r\n ');
      expect(clean).toBe('Cliente <img src=x onerror=alert(1)>');
      expect(clean).not.toContain('\u0000');
      expect(clean).not.toContain('\u200B');
    });
  });

  // ==========================================================================
  // 6. Suite Cliente Optimizado (Deduplicación, TTL sessionStorage y AbortController)
  // ==========================================================================
  describe('Suite 6: Cliente Optimizado — Deduplicación In-Flight, TTL Real y AbortController', () => {
    const createMemoryStorage = (): Storage => {
      const store = new Map<string, string>();
      return {
        get length() { return store.size; },
        clear: () => store.clear(),
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        removeItem: (key: string) => { store.delete(key); },
        setItem: (key: string, value: string) => { store.set(key, String(value)); }
      };
    };

    beforeEach(() => {
      const memSession = createMemoryStorage();
      const memLocal = createMemoryStorage();
      vi.stubGlobal('window', {
        sessionStorage: memSession,
        localStorage: memLocal,
        dispatchEvent: vi.fn()
      });
      vi.stubGlobal('localStorage', memLocal);
      setSheetsCacheTtlMs(DEFAULT_SHEETS_CACHE_TTL_MS);
      clearSheetsCache(true);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
      setSheetsCacheTtlMs(DEFAULT_SHEETS_CACHE_TTL_MS);
      clearSheetsCache(true);
    });

    it('deduplica 3 llamadas concurrentes en vuelo en 1 único fetch', async () => {
      const mockPayload = [{ id: '1', vendedorId: 'MARIA BRICEÑO', skuId: '1568', cliente: 'MARIA BRICEÑO', categoria: 'POLLO', meta: 100, ejecutado: 80, zona: 'General' }];
      let resolveFetch!: (val: Response) => void;
      const fetchSpy = vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      );
      vi.stubGlobal('fetch', fetchSpy);

      const p1 = fetchVolumenData(false, 'MARIA BRICEÑO');
      const p2 = fetchVolumenData(false, 'MARIA BRICEÑO');
      const p3 = fetchVolumenData(false, 'MARIA BRICEÑO');

      expect(fetchSpy).toHaveBeenCalledTimes(1);

      resolveFetch(
        new Response(JSON.stringify(mockPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'X-Last-Sync': '2026-11-20T12:00:00.000Z', 'X-Sync-Source': 'supabase' }
        })
      );

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
      expect(r1).toHaveLength(1);
      expect(r2).toHaveLength(1);
      expect(r3).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('respeta expiración real de caché TTL en sessionStorage y permite bypass con forceRefresh', async () => {
      let counter = 0;
      const fetchSpy = vi.fn(async () => {
        counter++;
        return new Response(
          JSON.stringify([{ id: String(counter), vendedorId: 'ALL', skuId: '1568', cliente: 'ALL', categoria: 'POLLO', meta: counter * 100, ejecutado: 50, zona: 'General' }]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });
      vi.stubGlobal('fetch', fetchSpy);

      setSheetsCacheTtlMs(500);
      const first = await fetchVolumenData({ forceRefresh: false, vendorId: 'ALL' });
      expect(first[0].meta).toBe(100);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Dentro del TTL sirve desde caché sin nuevo fetch
      const cached = await fetchVolumenData({ forceRefresh: false, vendorId: 'ALL' });
      expect(cached[0].meta).toBe(100);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // forceRefresh salta caché
      const forced = await fetchVolumenData({ forceRefresh: true, vendorId: 'ALL' });
      expect(forced[0].meta).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Simular expiración real en memoria y sessionStorage (TTL = 0)
      setSheetsCacheTtlMs(0);
      expect(getCachedSheetsSnapshot('ALL').hasCache).toBe(false);

      const afterExpiry = await fetchVolumenData({ forceRefresh: false, vendorId: 'ALL' });
      expect(afterExpiry[0].meta).toBe(300);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('cancela limpiamente una petición pendiente con AbortController', async () => {
      const fetchSpy = vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });
      vi.stubGlobal('fetch', fetchSpy);

      const ac = new AbortController();
      const req = fetchVolumenData({ forceRefresh: true, vendorId: 'RUTA_1', signal: ac.signal });
      ac.abort();

      await expect(req).rejects.toMatchObject({ name: 'AbortError' });
    });
  });
});
