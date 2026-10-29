import { VolumenData } from '../types';
import { clasificarRubroServerLabel } from '../lib/rubros';
import { SUPERVISOR_SUMMARY_COLUMNS, normalizeVendorName } from '../utils/vendorRoutes';

export const DEFAULT_GOOGLE_SHEET_ID = '1PLzYEe9GG1vHb_wjd7HA93U6UQNtyP-uk8sxVfiN4sg';

/**
 * Limpia y valida el ID del Google Sheet desde variables de entorno,
 * removiendo corchetes angulares `<...>`, comillas, espacios o extrayendo el ID si se pegó una URL completa.
 */
export function sanitizeGoogleSheetId(raw?: string | null): string {
  if (!raw) return DEFAULT_GOOGLE_SHEET_ID;
  let cleaned = String(raw).trim().replace(/^['"<]+|['">]+$/g, '').trim();
  if (!cleaned || /PEGA_AQUI/i.test(cleaned)) {
    return DEFAULT_GOOGLE_SHEET_ID;
  }
  const urlMatch = cleaned.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  return cleaned;
}

/**
 * Obtiene el GOOGLE_SHEET_ID parametrizado en entorno con respaldo seguro al ID productivo.
 */
export function getGoogleSheetId(envOverride?: Record<string, string | undefined>): string {
  const procEnv = typeof process !== 'undefined' && process.env ? process.env : {};
  const raw =
    envOverride?.GOOGLE_SHEET_ID ||
    envOverride?.VITE_GOOGLE_SHEET_ID ||
    procEnv.GOOGLE_SHEET_ID ||
    procEnv.VITE_GOOGLE_SHEET_ID;
  return sanitizeGoogleSheetId(raw);
}

/**
 * Construye la URL de exportación directa de Google Sheets con parámetro anti-caché limpio.
 */
export function buildGoogleSheetExportUrl(
  sheetId?: string | null,
  format: 'xlsx' | 'csv' = 'xlsx',
  gid?: string | number
): string {
  const id = sanitizeGoogleSheetId(sheetId || getGoogleSheetId());
  const gidParam = gid !== undefined && gid !== null && String(gid).trim() !== '' ? `&gid=${encodeURIComponent(String(gid))}` : '';
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=${format}${gidParam}&_cb=${Date.now()}`;
}

/**
 * Parser CSV estricto conforme a RFC 4180 (máquina de estados finitos).
 * Prohibido usar `.split(',')`: respeta comas internas, comillas dobles escapadas `""`
 * y saltos de línea (`\n`, `\r\n`) dentro de celdas entrecomilladas.
 */
export function parseCsvRfc4180(csvText: string): string[][] {
  if (!csvText) return [];
  const text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && text[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        currentField += ch;
        i++;
      }
      continue;
    }

    if (ch === '"' && currentField.length === 0) {
      inQuotes = true;
      i++;
    } else if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
      i++;
    } else if (ch === '\r') {
      currentRow.push(currentField);
      currentField = '';
      rows.push(currentRow);
      currentRow = [];
      if (i + 1 < len && text[i + 1] === '\n') {
        i += 2;
      } else {
        i++;
      }
    } else if (ch === '\n') {
      currentRow.push(currentField);
      currentField = '';
      rows.push(currentRow);
      currentRow = [];
      i++;
    } else {
      currentField += ch;
      i++;
    }
  }

  if (inQuotes || currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Normaliza cualquier encabezado de columna o nombre de pestaña:
 * - Repara mojibake común UTF-8/Latin1
 * - Limpia espacios iniciales/finales (.trim())
 * - Remueve tildes/diacríticos Unicode (NFD)
 * - Convierte a snake_case ASCII en minúsculas
 */
export function normalizeHeaderKey(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .replace(/Ã‘|Ã±/g, 'n')
    .replace(/Ã¡|Ã€/g, 'a')
    .replace(/Ã©|Ã‰/g, 'e')
    .replace(/Ã­|Ã /g, 'i')
    .replace(/Ã³|Ã“/g, 'o')
    .replace(/Ãº|Ãš/g, 'u')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Verifica si una fila está 100% vacía (todas sus celdas son null, undefined o whitespace).
 * Garantiza que filas vacías intermedias se ignoren sin cortar la lectura de filas inferiores.
 */
export function isRowCompletelyEmpty(row: unknown[] | null | undefined): boolean {
  if (!row || !Array.isArray(row) || row.length === 0) return true;
  for (let i = 0; i < row.length; i++) {
    const cell = row[i];
    if (cell !== null && cell !== undefined && String(cell).trim() !== '') {
      return false;
    }
  }
  return true;
}

/**
 * Normaliza códigos de cliente eliminando prefijos `#`, espacios y ceros a la izquierda para cruce exacto.
 */
export function normalizeClientCode(raw: unknown): { rawClean: string; canonical: string } {
  if (raw === null || raw === undefined) return { rawClean: '', canonical: '' };
  const rawClean = String(raw).replace(/^[#\s]+/, '').trim();
  if (!rawClean) return { rawClean: '', canonical: '' };
  const canonical = rawClean.replace(/^0+/, '') || '0';
  return { rawClean, canonical };
}

/**
 * Convierte números con formato local (`1.000,50`), anglosajón (`1,000.50`), decimales con coma (`0,75`),
 * contables `(1.200,00)` o celdas con guion `"-"` / `"#N/D"` de forma 100% segura sin devolver jamás `NaN`.
 */
export function parseLocaleNumber(raw: unknown, fallback = 0): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : fallback;
  }
  if (raw === null || raw === undefined || typeof raw === 'boolean') {
    return fallback;
  }

  let s = String(raw).replace(/\u00A0/g, ' ').trim();
  if (!s) return fallback;

  // Marcadores de vacío o cero habituales en Google Sheets / Excel
  if (/^[-–—]+$/.test(s) || /^(n\/?a|#n\/?d|#n\/?a|#value!|#ref!|#div\/0!|null|undefined|sin\s*dato)$/i.test(s)) {
    return fallback;
  }

  // Detectar formato contable negativo entre paréntesis: (1.234,56)
  let isNegative = false;
  if (/^\(.*\)$/.test(s)) {
    isNegative = true;
    s = s.slice(1, -1).trim();
  }

  // Limpiar símbolos de moneda, unidades y espacios internos
  s = s.replace(/[$\u20AC\u00A3%]/g, '').replace(/\b(bs\.?|usd|kg|kgs|cj|cajas|und)\b/gi, '').replace(/\s+/g, '');
  if (s.startsWith('-')) {
    isNegative = !isNegative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }

  if (!s || /^[-–—]+$/.test(s)) return fallback;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // Formato 1.000,50 -> punto es miles, coma es decimal
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato 1,000.50 -> coma es miles, punto es decimal
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const commaCount = (s.match(/,/g) || []).length;
    if (commaCount > 1) {
      // Múltiples comas: 1,234,567 -> separador de miles
      s = s.replace(/,/g, '');
    } else {
      const [intPart, fracPart] = s.split(',');
      // Si es 0,xxx (ej. 0,75 o 0,500) o tiene != 3 dígitos tras la coma -> decimal
      if (intPart === '0' || fracPart.length !== 3) {
        s = `${intPart}.${fracPart}`;
      } else {
        // Ej: "1,500" -> 1500 (separador de miles)
        s = `${intPart}${fracPart}`;
      }
    }
  } else if (lastDot !== -1) {
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Múltiples puntos: 1.234.567 -> separador de miles
      s = s.replace(/\./g, '');
    }
    // Con un solo punto (ej. 105.9 o 0.798) se conserva como separador decimal estándar
  }

  const parsed = Number(s);
  if (!Number.isFinite(parsed)) return fallback;
  const result = isNegative ? -parsed : parsed;
  return Object.is(result, -0) ? 0 : result;
}

/**
 * Convierte fechas desde seriales numéricos de Google Sheets / Excel (ej. `46296` -> `2026-10-01`),
 * cadenas `DD/MM/YYYY`, `DD-MM-YYYY`, `YYYY-MM-DD` o timestamps ISO 8601 a formato canónico `YYYY-MM-DD`.
 * Devuelve `null` si el valor no es una fecha válida (jamás produce `Invalid Date`).
 */
export function parseSheetDate(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }

  const isValidYmd = (y: number, m: number, d: number): string | null => {
    if (y < 1900 || y > 2150 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
      return null;
    }
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  // Serial numérico de Google Sheets / Excel (epoch 1899-12-30; 25569 = 1970-01-01)
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw < 20000 || raw > 90000) return null;
    const utcMs = Math.round((Math.floor(raw) - 25569) * 86400 * 1000);
    const dt = new Date(utcMs);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  }

  const s = String(raw).trim();
  if (!s) return null;

  // Serial numérico venido como string (ej. "46296" o "46296.5")
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial >= 20000 && serial <= 90000) {
      const utcMs = Math.round((Math.floor(serial) - 25569) * 86400 * 1000);
      const dt = new Date(utcMs);
      if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    }
  }

  // ISO YYYY-MM-DD o timestamp ISO 8601 (2026-10-12T18:17:26.121Z)
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    return isValidYmd(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  // Formato latinoamericano DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s.*)?$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    let year = Number(dmyMatch[3]);
    if (year < 100) year += 2000;
    return isValidYmd(year, month, day);
  }

  return null;
}

/**
 * Localiza una pestaña en un Workbook de XLSX comparando nombres normalizados exactos y alias seguros.
 */
export function resolveSheetByAliases(
  workbook: any,
  exactAliases: string[],
  substringAliases: string[] = [],
  excludeSubstrings: string[] = []
): { sheetName: string; sheet: any } | null {
  if (!workbook || !Array.isArray(workbook.SheetNames)) return null;
  const exactNorm = new Set(exactAliases.map(normalizeHeaderKey).filter(Boolean));
  const subNorm = substringAliases.map(normalizeHeaderKey).filter(Boolean);
  const exclNorm = excludeSubstrings.map(normalizeHeaderKey).filter(Boolean);

  for (const name of workbook.SheetNames) {
    const norm = normalizeHeaderKey(name);
    if (exactNorm.has(norm)) {
      return { sheetName: name, sheet: workbook.Sheets[name] };
    }
  }

  for (const name of workbook.SheetNames) {
    const norm = normalizeHeaderKey(name);
    if (exclNorm.some((ex) => norm.includes(ex))) continue;
    if (subNorm.some((sub) => norm.includes(sub))) {
      return { sheetName: name, sheet: workbook.Sheets[name] };
    }
  }

  return null;
}

/**
 * Mapea encabezados de una fila a índices de columna mediante un diccionario de alias normalizados.
 */
export function mapHeaderColumns<K extends string>(
  headerRow: unknown[],
  schema: Record<K, string[]>,
  fallbacks?: Partial<Record<K, number>>
): Record<K, number> {
  const normalizedHeaders = (headerRow || []).map(normalizeHeaderKey);
  const result = {} as Record<K, number>;

  for (const key of Object.keys(schema) as K[]) {
    const aliases = schema[key].map(normalizeHeaderKey);
    let foundIdx = -1;

    // 1. Coincidencia exacta
    for (const alias of aliases) {
      const idx = normalizedHeaders.indexOf(alias);
      if (idx !== -1) {
        foundIdx = idx;
        break;
      }
    }

    // 2. Coincidencia parcial segura si no hubo exacta
    if (foundIdx === -1) {
      for (const alias of aliases) {
        const idx = normalizedHeaders.findIndex((h) => h && (h.includes(alias) || alias.includes(h)));
        if (idx !== -1) {
          foundIdx = idx;
          break;
        }
      }
    }

    if (foundIdx === -1 && fallbacks && typeof fallbacks[key] === 'number') {
      foundIdx = fallbacks[key]!;
    }

    result[key] = foundIdx;
  }

  return result;
}

export interface SheetWarning {
  sheet: string;
  row: number; // 1-based Excel row number
  reason: string;
}

export interface SheetTabMetrics {
  sheetName: string;
  totalRowsInSheet: number;
  headerRows: number;
  emptyRowsSkipped: number;
  summaryRowsSkipped: number;
  incompleteRowsLogged: number;
  validRecordsRead: number;
}

export interface MasterClientSeed {
  id?: number;
  cliente_codigo: string;
  cliente_nombre: string;
  vendedor_id: string;
  vendedor_nombre: string;
  has_aceite?: boolean;
  has_azucar?: boolean;
  has_pollo?: boolean;
  has_estandar_asturias?: boolean;
  has_mortadela_salpicao?: boolean;
}

export interface ParsedWorkbookResult {
  periodo: string;
  volumenSupabaseRows: Array<{
    periodo: string;
    sku: string;
    articulo: string;
    categoria: string;
    vendedor_id: string;
    vendedor_nombre: string;
    meta_kg: number;
    ejecutado_kg: number;
    zona: string;
  }>;
  volumenApiRows: VolumenData[];
  metasSupabaseRows: Array<{
    periodo: string;
    vendedor_id: string;
    categoria: string;
    meta: number;
    activados: number;
  }>;
  metasApiRows: Array<{
    vendedorId: string;
    categoria: string;
    meta: number;
    activados: number;
  }>;
  activacionApiRows: any[];
  activacionSupabaseUpserts: any[];
  newSheetClientsForSupabase: any[];
  productMaps: {
    ACEITE: Map<string, number>;
    AZUCAR: Map<string, number>;
    POLLO: Map<string, number>;
    ESTANDAR_ASTURIAS: Map<string, number>;
    MORTADELA_SALPICAO: Map<string, number>;
  };
  usuariosRows: Array<{
    usuario: string;
    cedula: string;
    rol: string;
    vendorId: string;
  }>;
  degustacionesRows: Array<Record<string, any>>;
  metrics: Record<string, SheetTabMetrics>;
  warnings: SheetWarning[];
}

function isSupervisorSummaryHeader(vendorRaw: string): boolean {
  const clean = String(vendorRaw || '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (!clean) return false;
  if (SUPERVISOR_SUMMARY_COLUMNS.has(clean)) return true;
  const norm = normalizeVendorName(clean);
  return SUPERVISOR_SUMMARY_COLUMNS.has(norm);
}

function formatVolumenVendorDisplay(vendorName: string): {
  finalVendedorId: string;
  finalVendedorNombre: string;
  finalVendedorEmail?: string;
} {
  const vendorUpper = vendorName.toUpperCase();
  const isMikelRoute1 =
    vendorUpper === 'MIKELANGELO DIAZ1' ||
    vendorUpper.includes('MIKELANGELO DIAZ 1') ||
    vendorUpper.includes('MIKELANGELO DIAZ - PRINCIPAL');
  const isMikelVilla =
    (vendorUpper.includes('MIKELANGELO') || vendorUpper.includes('SOTO') || vendorUpper.includes('DIAZ')) &&
    vendorUpper.includes('VILLA');
  const isJohnatanHistorical =
    (vendorUpper === 'JOHNATAN SOTO' || vendorUpper === 'JHONATAN SOTO') && !vendorUpper.includes('VILLA');

  if (isMikelRoute1) {
    return {
      finalVendedorId: 'MIKELANGELO DIAZ1',
      finalVendedorNombre: 'Mikelangelo Diaz (Principal)',
      finalVendedorEmail: 'Mikelangelodiaz@gmail.com'
    };
  }
  if (isMikelVilla) {
    return {
      finalVendedorId: 'MIKELANGELO DIAZ - VILLA DEL ROS',
      finalVendedorNombre: 'Mikelangelo Diaz (Villa del Rosario)',
      finalVendedorEmail: 'Mikelangelodiaz@gmail.com'
    };
  }
  if (isJohnatanHistorical) {
    return {
      finalVendedorId: 'JOHNATAN SOTO (HISTORICO)',
      finalVendedorNombre: 'Johnatan Soto (Histórico)'
    };
  }
  if (/mikelangelo/i.test(vendorName)) {
    return {
      finalVendedorId: vendorName,
      finalVendedorNombre: 'Mikelangelo Diaz',
      finalVendedorEmail: 'Mikelangelodiaz@gmail.com'
    };
  }
  return {
    finalVendedorId: vendorName,
    finalVendedorNombre: vendorName
  };
}

function parseTruthySheetFlag(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw > 0;
  if (raw === null || raw === undefined) return false;
  const norm = normalizeHeaderKey(raw);
  return norm === 'si' || norm === 'yes' || norm === 'true' || norm === '1' || norm === 'activo' || norm === 'x';
}

/**
 * Extrae las filas crudas de una hoja XLSX conservando filas intermedias vacías (`blankrows: true`)
 * para garantizar conteo exacto de números de fila y evitar cualquier desfase.
 */
function extractSheetRows(XLSX: any, sheet: any): any[][] {
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: true,
    raw: true
  });
}

/**
 * Motor integral de lectura, validación y normalización exacta de las 10 pestañas del Google Sheet.
 */
export function parseWorkbookFull(
  XLSX: any,
  workbook: any,
  options: {
    periodo: string;
    masterClients?: MasterClientSeed[];
  }
): ParsedWorkbookResult {
  const { periodo, masterClients = [] } = options;
  const warnings: SheetWarning[] = [];
  const metrics: Record<string, SheetTabMetrics> = {};

  // ============================================================================
  // 1. VOLUMEN POR SKU (Detección dinámica de bloques de vendedor sin corte c>=89)
  // ============================================================================
  const volumenSupabaseRows: ParsedWorkbookResult['volumenSupabaseRows'] = [];
  const volumenApiRows: VolumenData[] = [];
  const volResolved = resolveSheetByAliases(workbook, ['volumen_por_sku'], ['volumen', 'sku']);

  if (volResolved) {
    const rows = extractSheetRows(XLSX, volResolved.sheet);
    const tabMetric: SheetTabMetrics = {
      sheetName: volResolved.sheetName,
      totalRowsInSheet: rows.length,
      headerRows: rows.length >= 2 ? 2 : rows.length,
      emptyRowsSkipped: 0,
      summaryRowsSkipped: 0,
      incompleteRowsLogged: 0,
      validRecordsRead: 0
    };

    if (rows.length >= 2) {
      const header0 = rows[0] || [];
      const header1 = rows[1] || [];
      const maxHeaderCols = Math.max(header0.length, header1.length);

      const baseCols = mapHeaderColumns(
        header1,
        {
          sku: ['cod', 'codigo', 'sku', 'id_articulo', 'cod_articulo'],
          articulo: ['articulo', 'producto', 'descripcion', 'nombre']
        },
        { sku: 0, articulo: 1 }
      );

      interface VendorColBlock {
        vendorName: string;
        cuotaCol: number;
        ejecutadoCol: number;
      }
      const vendorBlocks: VendorColBlock[] = [];

      const headerStarts: number[] = [];
      for (let c = 0; c < maxHeaderCols; c++) {
        if (c === baseCols.sku || c === baseCols.articulo) continue;
        const h0 = header0[c];
        if (h0 !== null && h0 !== undefined && String(h0).trim() !== '') {
          headerStarts.push(c);
        }
      }

      for (let bIdx = 0; bIdx < headerStarts.length; bIdx++) {
        const startCol = headerStarts[bIdx];
        const endCol = bIdx + 1 < headerStarts.length ? headerStarts[bIdx + 1] : Math.min(startCol + 3, maxHeaderCols);
        const vendorName = String(header0[startCol] || '').replace(/\s+/g, ' ').trim();
        if (!vendorName) continue;

        // Omitir ÚNICAMENTE columnas de resumen de supervisores por nombre normalizado (NUNCA por índice fijo c >= 89)
        if (isSupervisorSummaryHeader(vendorName)) continue;

        let cuotaCol = startCol;
        let ejecutadoCol = startCol + 1;

        for (let subC = startCol; subC < endCol; subC++) {
          const subNorm = normalizeHeaderKey(header1[subC]);
          if (subNorm === 'cuota' || subNorm === 'cuota_kg' || subNorm === 'meta' || subNorm === 'meta_kg') {
            cuotaCol = subC;
          } else if (
            subNorm === 'kg' ||
            subNorm === 'venta_kg' ||
            subNorm === 'venta' ||
            subNorm === 'ejecutado' ||
            subNorm === 'ejecutado_kg'
          ) {
            ejecutadoCol = subC;
          }
        }

        vendorBlocks.push({ vendorName, cuotaCol, ejecutadoCol });
      }

      let idCounter = 1;
      for (let r = 2; r < rows.length; r++) {
        const row = rows[r];
        if (isRowCompletelyEmpty(row)) {
          tabMetric.emptyRowsSkipped++;
          continue;
        }

        const rawSku = row[baseCols.sku];
        const rawArticulo = row[baseCols.articulo];
        const sku = rawSku !== null && rawSku !== undefined ? String(rawSku).trim() : '';
        const articulo = rawArticulo !== null && rawArticulo !== undefined ? String(rawArticulo).trim() : '';

        if (!sku) {
          if (!articulo) {
            // Fila de sumatoria/totales al pie de la hoja (ej. fila 52 con totales por vendedor)
            tabMetric.summaryRowsSkipped++;
          } else {
            tabMetric.incompleteRowsLogged++;
            warnings.push({
              sheet: volResolved.sheetName,
              row: r + 1,
              reason: `Fila con artículo "${articulo}" sin código SKU en columna Cod`
            });
          }
          continue;
        }

        if (!articulo) {
          warnings.push({
            sheet: volResolved.sheetName,
            row: r + 1,
            reason: `SKU "${sku}" tiene nombre de artículo vacío`
          });
        }

        const cat = clasificarRubroServerLabel(sku, articulo);

        for (const block of vendorBlocks) {
          const metaKg = parseLocaleNumber(row[block.cuotaCol], 0);
          const ejecutadoKg = parseLocaleNumber(row[block.ejecutadoCol], 0);

          if (metaKg > 0 || ejecutadoKg > 0) {
            tabMetric.validRecordsRead++;
            volumenSupabaseRows.push({
              periodo,
              sku,
              articulo,
              categoria: cat,
              vendedor_id: block.vendorName,
              vendedor_nombre: block.vendorName,
              meta_kg: metaKg,
              ejecutado_kg: ejecutadoKg,
              zona: 'General'
            });

            const display = formatVolumenVendorDisplay(block.vendorName);
            volumenApiRows.push({
              id: String(idCounter++),
              vendedorId: display.finalVendedorId,
              vendedorNombre: display.finalVendedorNombre,
              vendedorEmail: display.finalVendedorEmail,
              sku,
              skuId: sku,
              articulo,
              cliente: display.finalVendedorNombre,
              categoria: cat,
              meta: metaKg,
              metaKg,
              ejecutado: ejecutadoKg,
              ejecutadoKg,
              zona: 'General',
              lat: 10.6427,
              lng: -71.6125
            });
          }
        }
      }
    }
    metrics[volResolved.sheetName] = tabMetric;
  }

  // ============================================================================
  // 2. HOJAS OPERATIVAS DE COMPRA POR RUBRO (Aceite, Azucar, pollo, jamon asturias, Enteros Ligeros)
  // ============================================================================
  const readProductPurchaseSheet = (
    exactAliases: string[],
    substringAliases: string[]
  ): Map<string, number> => {
    const clientMap = new Map<string, number>();
    const resolved = resolveSheetByAliases(
      workbook,
      exactAliases,
      substringAliases,
      ['grid', 'volumen', 'activacion_por_cliente', 'usuarios', 'degustaciones']
    );
    if (!resolved) return clientMap;

    const rows = extractSheetRows(XLSX, resolved.sheet);
    const tabMetric: SheetTabMetrics = {
      sheetName: resolved.sheetName,
      totalRowsInSheet: rows.length,
      headerRows: rows.length > 0 ? 1 : 0,
      emptyRowsSkipped: 0,
      summaryRowsSkipped: 0,
      incompleteRowsLogged: 0,
      validRecordsRead: 0
    };

    if (rows.length > 1) {
      const cols = mapHeaderColumns(
        rows[0] || [],
        {
          codigo: ['id_cliente', 'codigo', 'cod_cliente', 'cliente_codigo', 'id', 'cod'],
          cliente: ['cliente', 'razon_social', 'nombre_cliente', 'nombre'],
          cajas: ['cajas', 'cantidad', 'bultos', 'unidades', 'compra']
        },
        { codigo: 0, cliente: 1, cajas: 2 }
      );

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (isRowCompletelyEmpty(row)) {
          tabMetric.emptyRowsSkipped++;
          continue;
        }

        const { rawClean, canonical } = normalizeClientCode(row[cols.codigo]);
        if (!canonical) {
          tabMetric.incompleteRowsLogged++;
          warnings.push({
            sheet: resolved.sheetName,
            row: r + 1,
            reason: `Fila de compra sin Id Cliente válido (Cliente="${String(row[cols.cliente] ?? '').trim()}")`
          });
          continue;
        }

        const cajas = parseLocaleNumber(row[cols.cajas], 0);
        const addVal = cajas > 0 ? cajas : 1;
        tabMetric.validRecordsRead++;

        const nextTotal = +((clientMap.get(canonical) || 0) + addVal).toFixed(4);
        clientMap.set(canonical, nextTotal);
        if (rawClean && rawClean !== canonical) {
          clientMap.set(rawClean, nextTotal);
        }
      }
    }

    metrics[resolved.sheetName] = tabMetric;
    return clientMap;
  };

  const productMaps = {
    ACEITE: readProductPurchaseSheet(['aceite'], ['aceite']),
    AZUCAR: readProductPurchaseSheet(['azucar'], ['azucar']),
    POLLO: readProductPurchaseSheet(['pollo'], ['pollo']),
    ESTANDAR_ASTURIAS: readProductPurchaseSheet(['jamon_asturias', 'estandar_asturias'], ['jamon', 'asturias']),
    MORTADELA_SALPICAO: readProductPurchaseSheet(['enteros_ligeros', 'mortadela_salpicao'], ['ligeros', 'salpicao', 'mortadela'])
  };

  // ============================================================================
  // 3. ACTIVACIÓN POR CLIENTE + FUSIÓN CON CARTERA MAESTRA
  // ============================================================================
  const actResolved = resolveSheetByAliases(
    workbook,
    ['activacion_por_cliente', 'clientes'],
    ['activacion_por_cliente', 'activacion_cliente']
  );

  interface SheetClientRow {
    rawCode: string;
    canonicalCode: string;
    razonSocial: string;
    vendedor: string;
    flagAceite: boolean;
    flagAzucar: boolean;
    flagPollo: boolean;
    flagAsturias: boolean;
    flagSalpicao: boolean;
  }

  const sheetClientsByCanonical = new Map<string, SheetClientRow>();
  if (actResolved) {
    const rows = extractSheetRows(XLSX, actResolved.sheet);
    const tabMetric: SheetTabMetrics = {
      sheetName: actResolved.sheetName,
      totalRowsInSheet: rows.length,
      headerRows: rows.length > 0 ? 1 : 0,
      emptyRowsSkipped: 0,
      summaryRowsSkipped: 0,
      incompleteRowsLogged: 0,
      validRecordsRead: 0
    };

    if (rows.length > 1) {
      const cols = mapHeaderColumns(
        rows[0] || [],
        {
          codigo: ['codigo', 'id_cliente', 'cliente_codigo', 'cod', 'id'],
          razonSocial: ['razon_social', 'cliente', 'nombre_cliente', 'nombre'],
          vendedor: ['vendedor', 'ruta', 'ejecutivo', 'vendedor_nombre'],
          aceite: ['aceite'],
          azucar: ['azucar'],
          pollo: ['pollo', 'arroz'],
          asturias: ['estandar_y_superior_asturias', 'jamon_asturias', 'estandar_asturias'],
          salpicao: ['mortadela_salpicao_y_asturias', 'enteros_ligeros', 'mortadela_salpicao']
        },
        {
          codigo: 0,
          razonSocial: 1,
          vendedor: 2,
          aceite: 3,
          azucar: 4,
          pollo: 5,
          asturias: 6,
          salpicao: 7
        }
      );

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (isRowCompletelyEmpty(row)) {
          tabMetric.emptyRowsSkipped++;
          continue;
        }

        const { rawClean, canonical } = normalizeClientCode(row[cols.codigo]);
        const razonSocial = String(row[cols.razonSocial] ?? '').trim();
        const rawVendor = String(row[cols.vendedor] ?? '').replace(/\s+/g, ' ').trim();

        if (!canonical || !rawVendor) {
          tabMetric.incompleteRowsLogged++;
          warnings.push({
            sheet: actResolved.sheetName,
            row: r + 1,
            reason: `Fila incompleta en Activación por Cliente (CODIGO="${rawClean}", VENDEDOR="${rawVendor}")`
          });
          continue;
        }

        const flagAceite = cols.aceite >= 0 ? parseTruthySheetFlag(row[cols.aceite]) : false;
        const flagAzucar = cols.azucar >= 0 ? parseTruthySheetFlag(row[cols.azucar]) : false;
        const flagPollo = cols.pollo >= 0 ? parseTruthySheetFlag(row[cols.pollo]) : false;
        const flagAsturias = cols.asturias >= 0 ? parseTruthySheetFlag(row[cols.asturias]) : false;
        const flagSalpicao = cols.salpicao >= 0 ? parseTruthySheetFlag(row[cols.salpicao]) : false;

        const mappedVendor =
          rawVendor.toUpperCase() === 'FOOD SERVICE NORTE'
            ? 'JAIDER MEDINA - FOOD SERVICE NORTE'
            : rawVendor;

        if (sheetClientsByCanonical.has(canonical)) {
          const prev = sheetClientsByCanonical.get(canonical)!;
          prev.flagAceite = prev.flagAceite || flagAceite;
          prev.flagAzucar = prev.flagAzucar || flagAzucar;
          prev.flagPollo = prev.flagPollo || flagPollo;
          prev.flagAsturias = prev.flagAsturias || flagAsturias;
          prev.flagSalpicao = prev.flagSalpicao || flagSalpicao;
          warnings.push({
            sheet: actResolved.sheetName,
            row: r + 1,
            reason: `Código de cliente duplicado #${rawClean} ("${razonSocial}") consolidado en registro único`
          });
          continue;
        }

        tabMetric.validRecordsRead++;
        sheetClientsByCanonical.set(canonical, {
          rawCode: rawClean,
          canonicalCode: canonical,
          razonSocial,
          vendedor: mappedVendor,
          flagAceite,
          flagAzucar,
          flagPollo,
          flagAsturias,
          flagSalpicao
        });
      }
    }

    metrics[actResolved.sheetName] = tabMetric;
  }

  // Construir cartera unificada: Cartera Maestra (Supabase / Maestra Oct 2026) + nuevos clientes del Google Sheet
  const mergedClientsMap = new Map<
    string,
    {
      dbId?: number;
      codigo: string;
      canonical: string;
      razonSocial: string;
      vendedorId: string;
      vendedorNombre: string;
      isNewFromSheet: boolean;
      sheetFlags?: SheetClientRow;
    }
  >();

  for (const mc of masterClients) {
    const { rawClean, canonical } = normalizeClientCode(mc.cliente_codigo);
    if (!canonical) continue;
    const sheetMatch = sheetClientsByCanonical.get(canonical);
    if (!mergedClientsMap.has(canonical)) {
      mergedClientsMap.set(canonical, {
        dbId: mc.id,
        codigo: rawClean || canonical,
        canonical,
        razonSocial: String(mc.cliente_nombre || sheetMatch?.razonSocial || '').trim(),
        vendedorId: String(mc.vendedor_id || mc.vendedor_nombre || '').replace(/\s+/g, ' ').trim(),
        vendedorNombre: String(mc.vendedor_nombre || mc.vendedor_id || '').replace(/\s+/g, ' ').trim(),
        isNewFromSheet: false,
        sheetFlags: sheetMatch
      });
    }
  }

  // Incorporar automáticamente cualquier cliente presente en el Google Sheet que no exista aún en la maestra
  for (const [canonical, sc] of sheetClientsByCanonical.entries()) {
    if (mergedClientsMap.has(canonical)) continue;
    if (sc.vendedor.toUpperCase() === 'ALI PEREZ') continue;
    mergedClientsMap.set(canonical, {
      codigo: sc.rawCode || canonical,
      canonical,
      razonSocial: sc.razonSocial,
      vendedorId: sc.vendedor,
      vendedorNombre: sc.vendedor,
      isNewFromSheet: true,
      sheetFlags: sc
    });
  }

  const activacionApiRows: any[] = [];
  const activacionSupabaseUpserts: any[] = [];
  const newSheetClientsForSupabase: any[] = [];
  const clientActByVendor = new Map<string, Record<string, number>>();

  for (const c of mergedClientsMap.values()) {
    if (!c.vendedorId || c.vendedorId.toUpperCase() === 'ALI PEREZ') continue;

    const cAceite = productMaps.ACEITE.get(c.canonical) || productMaps.ACEITE.get(c.codigo) || 0;
    const cAzucar = productMaps.AZUCAR.get(c.canonical) || productMaps.AZUCAR.get(c.codigo) || 0;
    const cPollo = productMaps.POLLO.get(c.canonical) || productMaps.POLLO.get(c.codigo) || 0;
    const cAsturias = productMaps.ESTANDAR_ASTURIAS.get(c.canonical) || productMaps.ESTANDAR_ASTURIAS.get(c.codigo) || 0;
    const cSalpicao = productMaps.MORTADELA_SALPICAO.get(c.canonical) || productMaps.MORTADELA_SALPICAO.get(c.codigo) || 0;

    const hasAceite = cAceite > 0 || Boolean(c.sheetFlags?.flagAceite);
    const hasAzucar = cAzucar > 0 || Boolean(c.sheetFlags?.flagAzucar);
    const hasPollo = cPollo > 0 || Boolean(c.sheetFlags?.flagPollo);
    const hasAsturias = cAsturias > 0 || Boolean(c.sheetFlags?.flagAsturias);
    const hasSalpicao = cSalpicao > 0 || Boolean(c.sheetFlags?.flagSalpicao);
    const isActivo = hasAceite || hasAzucar || hasPollo || hasAsturias || hasSalpicao;

    const vNorm = normalizeVendorName(c.vendedorNombre || c.vendedorId);
    if (!clientActByVendor.has(vNorm)) {
      clientActByVendor.set(vNorm, {
        ACEITE: 0,
        'AZÚCAR': 0,
        AZUCAR: 0,
        POLLO: 0,
        'ESTANDAR Y SUPERIOR ASTURIAS': 0,
        'MORTADELA SALPICAO Y ASTURIAS': 0
      });
    }
    const vCounts = clientActByVendor.get(vNorm)!;
    if (hasAceite) vCounts.ACEITE++;
    if (hasAzucar) {
      vCounts['AZÚCAR']++;
      vCounts.AZUCAR++;
    }
    if (hasPollo) vCounts.POLLO++;
    if (hasAsturias) vCounts['ESTANDAR Y SUPERIOR ASTURIAS']++;
    if (hasSalpicao) vCounts['MORTADELA SALPICAO Y ASTURIAS']++;

    const supaPayload = {
      ...(c.dbId !== undefined ? { id: c.dbId } : {}),
      periodo,
      cliente_codigo: c.codigo,
      cliente_nombre: c.razonSocial,
      vendedor_id: c.vendedorId,
      vendedor_nombre: c.vendedorNombre,
      status: isActivo ? 'ACTIVO' : 'INACTIVO',
      cajas_aceite: cAceite,
      cajas_azucar: cAzucar,
      cajas_pollo: cPollo,
      cajas_estandar_asturias: cAsturias,
      cajas_mortadela_salpicao: cSalpicao,
      has_aceite: hasAceite,
      has_azucar: hasAzucar,
      has_pollo: hasPollo,
      has_estandar_asturias: hasAsturias,
      has_mortadela_salpicao: hasSalpicao
    };

    if (c.dbId !== undefined) {
      activacionSupabaseUpserts.push(supaPayload);
    } else if (c.isNewFromSheet) {
      newSheetClientsForSupabase.push(supaPayload);
    }

    const vendUpper = c.vendedorId.toUpperCase();
    const isVilla = vendUpper.includes('VILLA');
    const isJohnatanOrMikel =
      vendUpper.includes('JOHNATAN') || vendUpper.includes('MIKELANGELO') || vendUpper.includes('SOTO');
    const displayVendedorNombre = isJohnatanOrMikel
      ? isVilla
        ? 'Mikelangelo Diaz (Villa del Rosario)'
        : 'Mikelangelo Diaz (Principal)'
      : c.vendedorNombre;
    const displayEmail = isJohnatanOrMikel ? 'Mikelangelodiaz@gmail.com' : undefined;

    activacionApiRows.push({
      id: String(c.codigo),
      vendedorId: c.vendedorId,
      vendedorNombre: displayVendedorNombre,
      vendedorEmail: displayEmail,
      cliente: c.razonSocial,
      status: isActivo ? 'ACTIVO' : 'INACTIVO',
      cats: {
        ACEITE: hasAceite,
        AZUCAR: hasAzucar,
        POLLO: hasPollo,
        ESTANDAR_ASTURIAS: hasAsturias,
        MORTADELA_SALPICAO: hasSalpicao,
        ARROZ: hasPollo,
        ENTERO: hasAsturias,
        LIGEROS: hasSalpicao
      },
      cajas: {
        ACEITE: cAceite,
        AZUCAR: cAzucar,
        POLLO: cPollo,
        ESTANDAR_ASTURIAS: cAsturias,
        MORTADELA_SALPICAO: cSalpicao
      }
    });
  }

  // ============================================================================
  // 4. GRID DE ACTIVACIÓN POR VENDEDOR (Mapeo dinámico de encabezados con espacios/minúsculas)
  // ============================================================================
  const metasSupabaseRows: ParsedWorkbookResult['metasSupabaseRows'] = [];
  const metasApiRows: ParsedWorkbookResult['metasApiRows'] = [];
  const gridResolved = resolveSheetByAliases(
    workbook,
    ['grid_de_activacion_por_vendedor'],
    ['grid_de_activacion', 'grid']
  );

  if (gridResolved) {
    const rows = extractSheetRows(XLSX, gridResolved.sheet);
    const tabMetric: SheetTabMetrics = {
      sheetName: gridResolved.sheetName,
      totalRowsInSheet: rows.length,
      headerRows: rows.length >= 2 ? 2 : rows.length,
      emptyRowsSkipped: 0,
      summaryRowsSkipped: 0,
      incompleteRowsLogged: 0,
      validRecordsRead: 0
    };

    if (rows.length >= 2) {
      const h0 = (rows[0] || []).map(normalizeHeaderKey);
      const h1 = (rows[1] || []).map(normalizeHeaderKey);

      const vendorCol = h1.findIndex((h) => h === 'vendedor' || h === 'ruta' || h === 'ejecutivo');
      const resolvedVendorCol = vendorCol !== -1 ? vendorCol : 0;

      const findCategoryCols = (
        catKeywords: string[],
        fallbackMeta: number,
        fallbackAct: number
      ): { metaIdx: number; actIdx: number } => {
        // Buscar en fila 1 ("Meta Aceite ", "Meta azucar", etc.) o en fila 0 ("ACEITE ", "AZUCAR", etc.)
        for (let c = 0; c < Math.max(h0.length, h1.length); c++) {
          const cell1 = h1[c] || '';
          const cell0 = h0[c] || '';
          if (
            (cell1.startsWith('meta') && catKeywords.some((kw) => cell1.includes(kw))) ||
            catKeywords.some((kw) => cell0 === kw || cell0.includes(kw))
          ) {
            const actCol = h1[c + 1]?.includes('activad') ? c + 1 : c + 1;
            return { metaIdx: c, actIdx: actCol };
          }
        }
        return { metaIdx: fallbackMeta, actIdx: fallbackAct };
      };

      const catDefs = [
        { name: 'ACEITE', ...findCategoryCols(['aceite'], 2, 3) },
        { name: 'AZÚCAR', ...findCategoryCols(['azucar'], 4, 5) },
        { name: 'POLLO', ...findCategoryCols(['pollo', 'arroz'], 6, 7) },
        { name: 'ESTANDAR Y SUPERIOR ASTURIAS', ...findCategoryCols(['estandar', 'superior'], 8, 9) },
        { name: 'MORTADELA SALPICAO Y ASTURIAS', ...findCategoryCols(['mortadela', 'salpicao'], 10, 11) }
      ];

      for (let r = 2; r < rows.length; r++) {
        const row = rows[r];
        if (isRowCompletelyEmpty(row)) {
          tabMetric.emptyRowsSkipped++;
          continue;
        }

        const rawVendor = row[resolvedVendorCol];
        const vName = rawVendor !== null && rawVendor !== undefined ? String(rawVendor).replace(/\s+/g, ' ').trim() : '';

        if (!vName) {
          // Fila de totales al final del Grid (ej. fila 28 con totales globales por rubro)
          tabMetric.summaryRowsSkipped++;
          continue;
        }

        if (isSupervisorSummaryHeader(vName)) {
          tabMetric.summaryRowsSkipped++;
          continue;
        }

        tabMetric.validRecordsRead++;
        const vNorm = normalizeVendorName(vName);
        const liveCounts = clientActByVendor.get(vNorm);

        for (const cDef of catDefs) {
          const meta = Math.round(parseLocaleNumber(row[cDef.metaIdx], 0));
          let activados = Math.round(parseLocaleNumber(row[cDef.actIdx], 0));
          if (activados === 0 && liveCounts && liveCounts[cDef.name] !== undefined) {
            activados = liveCounts[cDef.name];
          }

          metasSupabaseRows.push({
            periodo,
            vendedor_id: vName,
            categoria: cDef.name,
            meta,
            activados
          });

          metasApiRows.push({
            vendedorId: vName,
            categoria: cDef.name,
            meta,
            activados
          });
        }
      }

      if (!metasSupabaseRows.some((m) => normalizeVendorName(m.vendedor_id).includes('ANGEL NAVARRO'))) {
        const angelCounts = clientActByVendor.get('ANGEL NAVARRO') || {};
        for (const cat of [
          'ACEITE',
          'AZÚCAR',
          'POLLO',
          'ESTANDAR Y SUPERIOR ASTURIAS',
          'MORTADELA SALPICAO Y ASTURIAS'
        ]) {
          const act = angelCounts[cat] || 0;
          metasSupabaseRows.push({ periodo, vendedor_id: 'ANGEL NAVARRO', categoria: cat, meta: 0, activados: act });
          metasApiRows.push({ vendedorId: 'ANGEL NAVARRO', categoria: cat, meta: 0, activados: act });
        }
      }
    }

    metrics[gridResolved.sheetName] = tabMetric;
  }

  // ============================================================================
  // 5. USUARIOS
  // ============================================================================
  const usuariosRows: ParsedWorkbookResult['usuariosRows'] = [];
  const usrResolved = resolveSheetByAliases(workbook, ['usuarios'], ['usuario']);
  if (usrResolved) {
    const rows = extractSheetRows(XLSX, usrResolved.sheet);
    const tabMetric: SheetTabMetrics = {
      sheetName: usrResolved.sheetName,
      totalRowsInSheet: rows.length,
      headerRows: rows.length > 0 ? 1 : 0,
      emptyRowsSkipped: 0,
      summaryRowsSkipped: 0,
      incompleteRowsLogged: 0,
      validRecordsRead: 0
    };

    if (rows.length > 1) {
      const cols = mapHeaderColumns(
        rows[0] || [],
        {
          usuario: ['usuario', 'username', 'nombre'],
          cedula: ['contrasena', 'cedula', 'password', 'clave'],
          rol: ['rol', 'role', 'perfil'],
          vendorId: ['id_del_vendedor', 'vendor_id', 'id_vendedor', 'id']
        },
        { usuario: 0, cedula: 1, rol: 2, vendorId: 3 }
      );

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (isRowCompletelyEmpty(row)) {
          tabMetric.emptyRowsSkipped++;
          continue;
        }
        const usuario = String(row[cols.usuario] ?? '').replace(/\s+/g, ' ').trim();
        const cedula = String(row[cols.cedula] ?? '').trim();
        if (!usuario) {
          tabMetric.incompleteRowsLogged++;
          warnings.push({
            sheet: usrResolved.sheetName,
            row: r + 1,
            reason: 'Fila en Usuarios sin nombre de usuario'
          });
          continue;
        }
        tabMetric.validRecordsRead++;
        usuariosRows.push({
          usuario,
          cedula,
          rol: String(row[cols.rol] || 'Vendedor').trim(),
          vendorId: String(row[cols.vendorId] ?? '').trim()
        });
      }
    }
    metrics[usrResolved.sheetName] = tabMetric;
  }

  // ============================================================================
  // 6. DEGUSTACIONES (Tolerancia a filas vacías iniciales y seriales de fecha)
  // ============================================================================
  const degustacionesRows: Array<Record<string, any>> = [];
  const degResolved = resolveSheetByAliases(workbook, ['degustaciones'], ['degustacion']);
  if (degResolved) {
    const rows = extractSheetRows(XLSX, degResolved.sheet);
    const tabMetric: SheetTabMetrics = {
      sheetName: degResolved.sheetName,
      totalRowsInSheet: rows.length,
      headerRows: rows.length > 0 ? 1 : 0,
      emptyRowsSkipped: 0,
      summaryRowsSkipped: 0,
      incompleteRowsLogged: 0,
      validRecordsRead: 0
    };

    if (rows.length > 1) {
      const cols = mapHeaderColumns(
        rows[0] || [],
        {
          id: ['id'],
          fechaRegistro: ['fecha_registro', 'created_at', 'timestamp'],
          vendedor: ['vendedor', 'vendedor_nombre'],
          ruta: ['ruta', 'zona'],
          clienteCodigo: ['codigo_cliente', 'id_cliente', 'cliente_codigo'],
          clienteNombre: ['nombre_cliente', 'cliente', 'razon_social'],
          fechaDegustacion: ['fecha_degustacion', 'fecha'],
          turno: ['turno'],
          horario: ['horario', 'hora'],
          productos: ['productos', 'producto'],
          kilosEstimados: ['kilos_estimados', 'kilos'],
          personasEstimadas: ['personas_estimadas', 'personas'],
          requierePromotora: ['requiere_promotora'],
          materialPop: ['material_pop'],
          contactoPunto: ['contacto_punto', 'contacto'],
          telefonoContacto: ['telefono_contacto', 'telefono'],
          estado: ['estado', 'status'],
          promotoraAsignada: ['promotora_asignada', 'promotora'],
          notasTradeMarketing: ['notas_trade_marketing', 'notas', 'observaciones']
        },
        {
          id: 0,
          fechaRegistro: 1,
          vendedor: 2,
          ruta: 3,
          clienteCodigo: 4,
          clienteNombre: 5,
          fechaDegustacion: 6,
          turno: 7,
          horario: 8,
          productos: 9,
          kilosEstimados: 10,
          personasEstimadas: 11,
          requierePromotora: 12,
          materialPop: 13,
          contactoPunto: 14,
          telefonoContacto: 15,
          estado: 16,
          promotoraAsignada: 17,
          notasTradeMarketing: 18
        }
      );

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        // Crítico: las filas 2..9 están 100% vacías en la hoja real; se saltan sin cortar la lectura de las 135 filas siguientes
        if (isRowCompletelyEmpty(row)) {
          tabMetric.emptyRowsSkipped++;
          continue;
        }

        const id = String(row[cols.id] ?? '').trim();
        if (!id) {
          tabMetric.incompleteRowsLogged++;
          warnings.push({
            sheet: degResolved.sheetName,
            row: r + 1,
            reason: 'Fila en Degustaciones con datos parciales pero sin ID primario'
          });
          continue;
        }

        tabMetric.validRecordsRead++;
        const rawProductos = String(row[cols.productos] ?? '').trim();
        const parsedProductos = rawProductos
          ? (parseCsvRfc4180(rawProductos)[0] || []).map((p) => p.trim()).filter(Boolean)
          : [];

        degustacionesRows.push({
          id,
          createdAt: parseSheetDate(row[cols.fechaRegistro]) || String(row[cols.fechaRegistro] ?? '').trim(),
          vendedorNombre: String(row[cols.vendedor] ?? '').trim(),
          ruta: String(row[cols.ruta] ?? '').trim(),
          clienteCodigo: normalizeClientCode(row[cols.clienteCodigo]).rawClean,
          clienteNombre: String(row[cols.clienteNombre] ?? '').trim(),
          fecha: parseSheetDate(row[cols.fechaDegustacion]) || '',
          turno: String(row[cols.turno] ?? 'MAÑANA').trim().toUpperCase(),
          hora: String(row[cols.horario] ?? '').trim(),
          productos: parsedProductos,
          kilosEstimados: parseLocaleNumber(row[cols.kilosEstimados], 0),
          personasEstimadas: Math.round(parseLocaleNumber(row[cols.personasEstimadas], 0)),
          requierePromotora: parseTruthySheetFlag(row[cols.requierePromotora]),
          materialPop: parseTruthySheetFlag(row[cols.materialPop]),
          contactoPunto: String(row[cols.contactoPunto] ?? '').trim(),
          telefonoContacto: String(row[cols.telefonoContacto] ?? '').trim(),
          estado: String(row[cols.estado] ?? 'SOLICITADA').trim().toUpperCase(),
          promotoraAsignada: String(row[cols.promotoraAsignada] ?? '').trim(),
          notasTradeMarketing: String(row[cols.notasTradeMarketing] ?? '').trim()
        });
      }
    }
    metrics[degResolved.sheetName] = tabMetric;
  }

  return {
    periodo,
    volumenSupabaseRows,
    volumenApiRows,
    metasSupabaseRows,
    metasApiRows,
    activacionApiRows,
    activacionSupabaseUpserts,
    newSheetClientsForSupabase,
    productMaps,
    usuariosRows,
    degustacionesRows,
    metrics,
    warnings
  };
}
