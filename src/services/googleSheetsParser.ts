import { VolumenData } from '../types';
import { clasificarRubro, clasificarRubroServerLabel, RUBROS_ACTIVOS_CONFIG, type RubroCodigo } from '../lib/rubros';
import { SUPERVISOR_SUMMARY_COLUMNS, normalizeVendorName } from '../utils/vendorRoutes';
import { normalizeVendorKey, resolveCanonicalRouteKey } from '../utils/vendorKeyNormalizer';
import type { SyncAuditLogEntry } from './monthlySyncEngine';
import {
  DataQualityTracker,
  type DataQualitySnapshot,
  isBlankOrDashMarker,
  isSheetErrorMarker,
  isValidNumericCell,
  parseSafeNumber,
  parseSafePercentage,
  roundToDecimals,
  sanitizeSheetText,
  sumDecimalExact
} from '../utils/safeNumber';
import {
  DEFAULT_GOOGLE_SHEET_ID,
  GRID_CATEGORY_HEADER_KEYWORDS,
  buildValidatedGoogleSheetUrl,
  getGoogleSheetId,
  isClientActiveInAnyFocusProduct,
  isSummaryOrHeaderLabel,
  isValidActivacionRecord,
  isValidMetaRecord,
  isValidVolumenRecord,
  sanitizeGoogleSheetId
} from '../config/sheetsConfig';

export { DEFAULT_GOOGLE_SHEET_ID, sanitizeGoogleSheetId, getGoogleSheetId };

/**
 * Construye la URL de exportación directa de Google Sheets validada contra la allowlist OWASP
 * (`https://docs.google.com/spreadsheets/`) con parámetro anti-caché limpio.
 */
export function buildGoogleSheetExportUrl(
  sheetId?: string | null,
  format: 'xlsx' | 'csv' = 'xlsx',
  gid?: string | number
): string {
  return buildValidatedGoogleSheetUrl({
    sheetId,
    format,
    gid,
    cacheBust: true
  });
}

/**
 * Parser CSV estricto conforme a RFC 4180 (máquina de estados finitos).
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
 * Normaliza cualquier encabezado de columna o nombre de pestaña a snake_case ASCII sin tildes.
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
 * Verifica si una fila está 100% vacía.
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
 * Detecta si una celda representa un marcador explícito de vacío/guion/error de Excel (sin ser texto basura arbitrario).
 */
function isBlankOrZeroMarker(raw: unknown): boolean {
  return isBlankOrDashMarker(raw) || isSheetErrorMarker(raw);
}

/**
 * Convierte números con formato local (`1.000,50`, `1.250`), anglosajón (`1,000.50`), decimales con coma (`0,75`),
 * contables `(1.200,00)` o celdas con guion `"-"` / `"#N/D"` de forma 100% segura sin devolver jamás `NaN`.
 */
export function parseLocaleNumber(
  raw: unknown,
  fallback = 0,
  tracker?: DataQualityTracker,
  context?: string
): number {
  return parseSafeNumber(raw, { fallback, tracker, context });
}

/**
 * Convierte fechas desde seriales numéricos de Google Sheets / Excel, DD/MM/YYYY o ISO 8601 a `YYYY-MM-DD`.
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

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw < 20000 || raw > 90000) return null;
    const utcMs = Math.round((Math.floor(raw) - 25569) * 86400 * 1000);
    const dt = new Date(utcMs);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  }

  const s = String(raw).trim();
  if (!s) return null;

  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial >= 20000 && serial <= 90000) {
      const utcMs = Math.round((Math.floor(serial) - 25569) * 86400 * 1000);
      const dt = new Date(utcMs);
      if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    }
  }

  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    return isValidYmd(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

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

    for (const alias of aliases) {
      const idx = normalizedHeaders.indexOf(alias);
      if (idx !== -1) {
        foundIdx = idx;
        break;
      }
    }

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
  row: number;
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
    vendedor_key: string;
    vendedor_nombre: string;
    meta_kg: number;
    ejecutado_kg: number;
    venta_bruta_kg: number;
    devoluciones_kg: number;
    venta_neta_kg: number;
    porcentaje_cumplimiento: number | null;
    zona: string;
  }>;
  volumenApiRows: VolumenData[];
  metasSupabaseRows: Array<{
    periodo: string;
    vendedor_id: string;
    vendedor_key: string;
    categoria: string;
    cartera: number;
    meta: number;
    activados: number;
  }>;
  metasApiRows: Array<{
    vendedorId: string;
    vendedorKey: string;
    categoria: string;
    cartera: number;
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
    LECHE_VENCAMPO: Map<string, number>;
    MORTADELA_ASTURIAS: Map<string, number>;
    SALPICAO: Map<string, number>;
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
  auditLogs: SyncAuditLogEntry[];
  dataQuality?: DataQualitySnapshot;
}

function isSupervisorSummaryHeader(vendorRaw: string): boolean {
  const clean = String(vendorRaw || '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (!clean) return false;
  if (SUPERVISOR_SUMMARY_COLUMNS.has(clean)) return true;
  const norm = normalizeVendorName(clean);
  if (SUPERVISOR_SUMMARY_COLUMNS.has(norm)) return true;
  const canon = normalizeVendorKey(clean);
  return SUPERVISOR_SUMMARY_COLUMNS.has(canon);
}

function normalizeCuentasClavesVendor(vendorName: string): { id: string; display: string } | null {
  const u = normalizeVendorKey(vendorName);
  if (
    u === 'MARIANA CHACIN' ||
    u === 'CUENTAS CLAVE 1' ||
    u === 'CUENTAS CLAVES 1' ||
    u === 'CUENTAS CLAVE 1 - MC' ||
    u === 'CUENTAS CLAVES 1 - MC'
  ) {
    return { id: 'CUENTAS CLAVES 1 - MC', display: 'Cuentas claves 1 - MC' };
  }
  if (
    u === 'SAIRU VALLES' ||
    u === 'CUENTAS CLAVE 2' ||
    u === 'CUENTAS CLAVES 2' ||
    u === 'CUENTAS CLAVE 2 - SV' ||
    u === 'CUENTAS CLAVES 2 - SV'
  ) {
    return { id: 'CUENTAS CLAVES 2 - SV', display: 'Cuentas claves 2 - SV' };
  }
  if (
    u === 'LUIS GUANIPA' ||
    u === 'VICTORIA VARGAS' ||
    u === 'RUTA LUIS GUANIPA' ||
    u === 'RUTA VICTORIA VARGAS'
  ) {
    return { id: 'VICTORIA VARGAS', display: 'VICTORIA VARGAS' };
  }
  return null;
}

function formatVolumenVendorDisplay(vendorName: string): {
  finalVendedorId: string;
  finalVendedorNombre: string;
  finalVendedorEmail?: string;
} {
  const cc = normalizeCuentasClavesVendor(vendorName);
  if (cc) {
    return {
      finalVendedorId: cc.id,
      finalVendedorNombre: cc.display
    };
  }
  const vendorKey = normalizeVendorKey(vendorName);
  const isMikelRoute1 =
    vendorKey === 'MIKELANGELO DIAZ' ||
    vendorKey.includes('MIKELANGELO DIAZ - PRINCIPAL');
  const isMikelVilla =
    (vendorKey.includes('MIKELANGELO') || vendorKey.includes('SOTO') || vendorKey.includes('DIAZ')) &&
    vendorKey.includes('VILLA');

  if (isMikelRoute1) {
    return {
      finalVendedorId: 'MIKELANGELO DIAZ',
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
  return {
    finalVendedorId: String(vendorName || '').replace(/\s+/g, ' ').trim(),
    finalVendedorNombre: String(vendorName || '').replace(/\s+/g, ' ').trim()
  };
}

function parseTruthySheetFlag(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw > 0;
  if (raw === null || raw === undefined) return false;
  const norm = normalizeHeaderKey(raw);
  return norm === 'si' || norm === 'yes' || norm === 'true' || norm === '1' || norm === 'activo' || norm === 'x';
}

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
 * Devuelve un mapa `startCol -> endColExclusive` de las celdas combinadas (`!merges`)
 * horizontales sobre una fila específica (ej. fila 0 de encabezados de vendedor o rubro foco).
 */
function getMergedHeaderSpansForRow(sheet: any, targetRow: number): Map<number, number> {
  const spans = new Map<number, number>();
  const merges = Array.isArray(sheet?.['!merges']) ? sheet['!merges'] : [];
  for (const m of merges) {
    if (
      m &&
      m.s &&
      m.e &&
      typeof m.s.r === 'number' &&
      typeof m.e.r === 'number' &&
      typeof m.s.c === 'number' &&
      typeof m.e.c === 'number' &&
      m.s.r <= targetRow &&
      m.e.r >= targetRow &&
      m.e.c >= m.s.c
    ) {
      spans.set(m.s.c, m.e.c + 1);
    }
  }
  return spans;
}

/**
 * Propaga los textos de encabezados combinados (`!merges`) sobre la fila 0 para consultas por columna.
 */
function expandMergedRowValues(sheet: any, rowValues: unknown[], targetRow: number): unknown[] {
  const expanded = Array.isArray(rowValues) ? rowValues.slice() : [];
  const merges = Array.isArray(sheet?.['!merges']) ? sheet['!merges'] : [];
  for (const m of merges) {
    if (
      m &&
      m.s &&
      m.e &&
      typeof m.s.r === 'number' &&
      typeof m.e.r === 'number' &&
      typeof m.s.c === 'number' &&
      typeof m.e.c === 'number' &&
      m.s.r <= targetRow &&
      m.e.r >= targetRow
    ) {
      const anchor = expanded[m.s.c];
      if (anchor !== null && anchor !== undefined && String(anchor).trim() !== '') {
        for (let c = m.s.c + 1; c <= m.e.c; c++) {
          if (expanded[c] === null || expanded[c] === undefined || String(expanded[c]).trim() === '') {
            expanded[c] = anchor;
          }
        }
      }
    }
  }
  return expanded;
}

function sheetCellHasPercentageFormat(XLSX: any, sheet: any, rowIdx: number, colIdx: number): boolean {
  if (!sheet || !XLSX?.utils?.encode_cell || rowIdx < 0 || colIdx < 0) return false;
  try {
    const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
    const cell = sheet[addr];
    if (!cell) return false;
    if (typeof cell.z === 'string' && cell.z.includes('%')) return true;
    if (typeof cell.w === 'string' && cell.w.includes('%')) return true;
    return false;
  } catch {
    return false;
  }
}

function parseOfficialSheetPercentage(
  rawPct: unknown,
  options: {
    hasPercentFormat?: boolean;
    referenceRatio?: number;
    tracker?: DataQualityTracker;
    context?: string;
  } = {}
): number | null {
  const { hasPercentFormat = false, referenceRatio, tracker, context } = options;
  return parseSafePercentage(rawPct, {
    scale: hasPercentFormat ? 'ratio_0_1' : 'auto',
    referenceRatio,
    decimals: 4,
    tracker,
    context
  });
}

/**
 * Motor Espejo 1:1 de lectura, normalización canónica y auditoría de las 10 pestañas de "Dashboard_Vendedores".
 */
export function parseWorkbookFull(
  XLSX: any,
  workbook: any,
  options: {
    periodo: string;
    masterClients?: MasterClientSeed[];
    ventasMes?: Array<{ id_cliente: string; id_articulo: string; articulo: string; cajas: number }>;
  }
): ParsedWorkbookResult {
  const { periodo, masterClients = [], ventasMes = [] } = options;
  const warnings: SheetWarning[] = [];
  const auditLogs: SyncAuditLogEntry[] = [];
  const metrics: Record<string, SheetTabMetrics> = {};
  const qualityTracker = new DataQualityTracker(50);

  // ============================================================================
  // 1. VOLUMEN POR SKU (Bloques resilientes con !merges, resta algebraica, % seguro y exclusión de totales)
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
      const row0MergeSpans = getMergedHeaderSpansForRow(volResolved.sheet, 0);
      const maxHeaderCols = Math.max(
        header0.length,
        header1.length,
        ...Array.from(row0MergeSpans.values(), (end) => end)
      );

      const baseCols = mapHeaderColumns(
        header1,
        {
          sku: ['cod', 'codigo', 'sku', 'id_articulo', 'cod_articulo'],
          articulo: ['articulo', 'producto', 'descripcion', 'nombre']
        },
        { sku: 0, articulo: 1 }
      );

      interface VendorColBlock {
        rawVendorName: string;
        vendorKey: string;
        startCol: number;
        cuotaCol: number;
        ejecutadoCol: number;
        pctCol: number;
      }

      const rawCandidateBlocks: VendorColBlock[] = [];
      const headerStarts: number[] = [];
      for (let c = 0; c < maxHeaderCols; c++) {
        if (c === baseCols.sku || c === baseCols.articulo) continue;
        const h0 = header0[c];
        if (h0 !== null && h0 !== undefined && sanitizeSheetText(h0) !== '') {
          headerStarts.push(c);
        }
      }

      const supervisorOccurrences = new Map<string, number>();
      for (let bIdx = 0; bIdx < headerStarts.length; bIdx++) {
        const startCol = headerStarts[bIdx];
        const mergedEnd = row0MergeSpans.get(startCol);
        const nextStart = bIdx + 1 < headerStarts.length ? headerStarts[bIdx + 1] : Math.min(startCol + 3, maxHeaderCols);
        const endCol = mergedEnd && mergedEnd > startCol ? Math.min(mergedEnd, nextStart) : nextStart;
        const rawVendorName = sanitizeSheetText(header0[startCol]);
        if (!rawVendorName) continue;

        const vendorKey = normalizeVendorKey(rawVendorName);
        if (isSupervisorSummaryHeader(rawVendorName)) {
          const occ = (supervisorOccurrences.get(vendorKey) || 0) + 1;
          supervisorOccurrences.set(vendorKey, occ);
          auditLogs.push({
            severity: occ > 1 ? 'WARN' : 'INFO',
            sheet_name: volResolved.sheetName,
            row_number: 1,
            event_code: 'SUPERVISOR_SUMMARY_BLOCK_SKIPPED',
            vendor_key: vendorKey,
            entity_key: `COL_${startCol}`,
            message: `Bloque resumen de supervisor "${rawVendorName}" en col ${startCol} excluido de volumen individual (aparición #${occ}).`,
            payload: { startCol, occurrence: occ, rawVendorName }
          });
          continue;
        }

        if (isSummaryOrHeaderLabel(rawVendorName)) {
          auditLogs.push({
            severity: 'INFO',
            sheet_name: volResolved.sheetName,
            row_number: 1,
            event_code: 'SUMMARY_COLUMN_SKIPPED',
            vendor_key: vendorKey,
            entity_key: `COL_${startCol}`,
            message: `Columna resumen "${rawVendorName}" en col ${startCol} excluida para evitar doble conteo.`,
            payload: { startCol, rawVendorName }
          });
          continue;
        }

        let cuotaCol = startCol;
        let ejecutadoCol = startCol + 1 < endCol ? startCol + 1 : startCol;
        let pctCol = startCol + 2 < endCol ? startCol + 2 : -1;

        for (let subC = startCol; subC < endCol; subC++) {
          const rawSub = sanitizeSheetText(header1[subC]);
          const subNorm = normalizeHeaderKey(rawSub);
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
          } else if (
            rawSub === '%' ||
            subNorm === 'pct' ||
            subNorm === 'porcentaje' ||
            subNorm === 'cumplimiento'
          ) {
            pctCol = subC;
          }
        }

        rawCandidateBlocks.push({
          rawVendorName,
          vendorKey,
          startCol,
          cuotaCol,
          ejecutadoCol,
          pctCol
        });
      }

      // Pre-identificar filas válidas de SKU excluyendo totales, subtotales, promedios y encabezados repetidos
      interface ValidSkuRow {
        rowIdx: number;
        sku: string;
        articulo: string;
        categoria: string;
      }
      const validSkuRows: ValidSkuRow[] = [];

      for (let r = 2; r < rows.length; r++) {
        const row = rows[r];
        if (isRowCompletelyEmpty(row)) {
          tabMetric.emptyRowsSkipped++;
          continue;
        }

        const rawSku = row[baseCols.sku];
        const rawArticulo = row[baseCols.articulo];
        const sku = sanitizeSheetText(rawSku);
        const articulo = sanitizeSheetText(rawArticulo);

        if (
          isSummaryOrHeaderLabel(sku, ['COD', 'CODIGO', 'SKU', 'ID ARTICULO', 'COD ARTICULO']) ||
          (!sku && isSummaryOrHeaderLabel(articulo, ['ARTICULO', 'PRODUCTO', 'DESCRIPCION', 'NOMBRE'])) ||
          (!/^\d+$/.test(sku) && isSummaryOrHeaderLabel(articulo, ['ARTICULO', 'PRODUCTO', 'DESCRIPCION', 'NOMBRE']))
        ) {
          tabMetric.summaryRowsSkipped++;
          auditLogs.push({
            severity: 'INFO',
            sheet_name: volResolved.sheetName,
            row_number: r + 1,
            event_code: 'SUMMARY_OR_REPEATED_HEADER_SKIPPED',
            entity_key: sku || articulo || `ROW_${r + 1}`,
            message: `Fila resumen o encabezado repetido ("${sku || articulo}") excluida en "${volResolved.sheetName}".`
          });
          continue;
        }

        if (!sku) {
          if (!articulo) {
            tabMetric.summaryRowsSkipped++;
          } else {
            tabMetric.incompleteRowsLogged++;
            warnings.push({
              sheet: volResolved.sheetName,
              row: r + 1,
              reason: `Fila con artículo "${articulo}" sin código SKU en columna Cod`
            });
            auditLogs.push({
              severity: 'WARN',
              sheet_name: volResolved.sheetName,
              row_number: r + 1,
              event_code: 'VOLUMEN_ROW_WITHOUT_SKU',
              entity_key: articulo,
              message: `Fila con artículo "${articulo}" sin código SKU omitida.`
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

        validSkuRows.push({
          rowIdx: r,
          sku,
          articulo,
          categoria: clasificarRubroServerLabel(sku, articulo)
        });
      }

      // Resolver colisiones de bloques repetidos por vendorKey (Decisión 1)
      const blocksByVendorKey = new Map<string, VendorColBlock[]>();
      for (const b of rawCandidateBlocks) {
        const arr = blocksByVendorKey.get(b.vendorKey) || [];
        arr.push(b);
        blocksByVendorKey.set(b.vendorKey, arr);
      }

      const vendorBlocks: VendorColBlock[] = [];
      for (const [vKey, group] of blocksByVendorKey.entries()) {
        if (group.length === 1) {
          vendorBlocks.push(group[0]);
          continue;
        }

        let primary = group[0];
        const vectorFor = (blk: VendorColBlock) =>
          validSkuRows.map(({ rowIdx }) => {
            const r = rows[rowIdx];
            return [parseLocaleNumber(r[blk.cuotaCol], 0), parseLocaleNumber(r[blk.ejecutadoCol], 0)] as const;
          });

        let primaryVec = vectorFor(primary);
        let primaryHasData = primaryVec.some(([m, k]) => m !== 0 || k !== 0);

        for (let idx = 1; idx < group.length; idx++) {
          const candidate = group[idx];
          const candVec = vectorFor(candidate);
          const isIdentical =
            primaryVec.length === candVec.length &&
            primaryVec.every(([m, k], i) => m === candVec[i][0] && k === candVec[i][1]);

          if (isIdentical) {
            auditLogs.push({
              severity: 'WARN',
              sheet_name: volResolved.sheetName,
              row_number: 1,
              event_code: 'DUPLICATE_IDENTICAL_VENDOR_BLOCK',
              vendor_key: vKey,
              entity_key: `COL_${candidate.startCol}`,
              message: `Bloque duplicado idéntico para "${candidate.rawVendorName}" en col ${candidate.startCol} deduplicado contra col ${primary.startCol}.`,
              payload: { keptCol: primary.startCol, skippedCol: candidate.startCol }
            });
          } else {
            const candHasData = candVec.some(([m, k]) => m !== 0 || k !== 0);
            const keptNetKg = sumDecimalExact(primaryVec.map(([, k]) => k), 2);
            const collidedNetKg = sumDecimalExact(candVec.map(([, k]) => k), 2);
            if (!primaryHasData && candHasData) {
              primary = candidate;
              primaryVec = candVec;
              primaryHasData = true;
            }
            auditLogs.push({
              severity: 'CRITICAL',
              sheet_name: volResolved.sheetName,
              row_number: 1,
              event_code: 'COLLISION_DISTINCT_VENDOR_BLOCK',
              vendor_key: vKey,
              entity_key: `COL_${candidate.startCol}`,
              message: `Colisión crítica de bloques distintos para "${candidate.rawVendorName}" (col ${primary.startCol} vs col ${candidate.startCol}). Se conservó el primer bloque activo.`,
              payload: {
                keptCol: primary.startCol,
                collidedCol: candidate.startCol,
                keptNetKg,
                collidedNetKg
              }
            });
          }
        }

        vendorBlocks.push(primary);
      }

      // Acumulador algebraico exacto por (vendorKey, sku) para consolidar si un SKU aparece más de una vez
      const supaVolMap = new Map<string, ParsedWorkbookResult['volumenSupabaseRows'][number]>();
      const apiVolMap = new Map<string, VolumenData>();
      let idCounter = 1;

      for (const skuRow of validSkuRows) {
        const row = rows[skuRow.rowIdx];
        for (const block of vendorBlocks) {
          const cellCtx = `${volResolved.sheetName}:R${skuRow.rowIdx + 1}:${block.vendorKey}`;
          const metaKg = roundToDecimals(
            parseLocaleNumber(row[block.cuotaCol], 0, qualityTracker, `${cellCtx}:meta`),
            2
          );
          const ventaKg = roundToDecimals(
            parseLocaleNumber(row[block.ejecutadoCol], 0, qualityTracker, `${cellCtx}:venta`),
            2
          );
          const pctVal =
            block.pctCol >= 0
              ? parseOfficialSheetPercentage(row[block.pctCol], {
                  hasPercentFormat: sheetCellHasPercentageFormat(XLSX, volResolved.sheet, skuRow.rowIdx, block.pctCol),
                  referenceRatio: metaKg > 0 ? ventaKg / metaKg : undefined,
                  tracker: qualityTracker,
                  context: `${cellCtx}:pct`
                })
              : null;

          // Retener cualquier SKU con cuota != 0 o venta != 0 (INCLUYENDO notas de crédito / devoluciones negativas)
          if (metaKg !== 0 || ventaKg !== 0) {
            tabMetric.validRecordsRead++;
            const ccVol = normalizeCuentasClavesVendor(block.rawVendorName);
            const canonicalBlockVendor = ccVol ? ccVol.id : normalizeVendorKey(block.rawVendorName) === 'MIKELANGELO DIAZ' ? 'MIKELANGELO DIAZ' : block.rawVendorName;
            const brutaDelta = ventaKg > 0 ? ventaKg : 0;
            const devDelta = ventaKg < 0 ? ventaKg : 0;
            const mapKey = `${block.vendorKey}::${skuRow.sku}`;

            const existingSupa = supaVolMap.get(mapKey);
            if (!existingSupa) {
              supaVolMap.set(mapKey, {
                periodo,
                sku: skuRow.sku,
                articulo: skuRow.articulo,
                categoria: skuRow.categoria,
                vendedor_id: canonicalBlockVendor,
                vendedor_key: block.vendorKey,
                vendedor_nombre: canonicalBlockVendor,
                meta_kg: metaKg,
                ejecutado_kg: ventaKg,
                venta_bruta_kg: brutaDelta,
                devoluciones_kg: devDelta,
                venta_neta_kg: ventaKg,
                porcentaje_cumplimiento: pctVal,
                zona: 'General'
              });
            } else {
              existingSupa.meta_kg = sumDecimalExact([existingSupa.meta_kg, metaKg], 2);
              existingSupa.venta_bruta_kg = sumDecimalExact([existingSupa.venta_bruta_kg, brutaDelta], 2);
              existingSupa.devoluciones_kg = sumDecimalExact([existingSupa.devoluciones_kg, devDelta], 2);
              existingSupa.venta_neta_kg = sumDecimalExact([existingSupa.venta_neta_kg, ventaKg], 2);
              existingSupa.ejecutado_kg = existingSupa.venta_neta_kg;
              existingSupa.porcentaje_cumplimiento =
                existingSupa.meta_kg > 0
                  ? roundToDecimals((existingSupa.venta_neta_kg / existingSupa.meta_kg) * 100, 4)
                  : pctVal;
            }

            const display = formatVolumenVendorDisplay(block.rawVendorName);
            const existingApi = apiVolMap.get(mapKey);
            if (!existingApi) {
              const candidateApi: VolumenData = {
                id: String(idCounter++),
                vendedorId: display.finalVendedorId,
                vendedorKey: block.vendorKey,
                vendedorNombre: display.finalVendedorNombre,
                vendedorEmail: display.finalVendedorEmail,
                sku: skuRow.sku,
                skuId: skuRow.sku,
                articulo: skuRow.articulo,
                cliente: display.finalVendedorNombre,
                categoria: skuRow.categoria,
                meta: metaKg,
                metaKg,
                ejecutado: ventaKg,
                ejecutadoKg: ventaKg,
                ventaBrutaKg: brutaDelta,
                devolucionesKg: devDelta,
                ventaNetaKg: ventaKg,
                porcentajeCumplimiento: pctVal,
                zona: 'General',
                lat: 10.6427,
                lng: -71.6125
              };
              if (isValidVolumenRecord(candidateApi)) {
                apiVolMap.set(mapKey, candidateApi);
              }
            } else {
              const nextMeta = sumDecimalExact([existingApi.meta, metaKg], 2);
              const nextNeta = sumDecimalExact([existingApi.ejecutado, ventaKg], 2);
              existingApi.meta = nextMeta;
              existingApi.metaKg = nextMeta;
              existingApi.ejecutado = nextNeta;
              existingApi.ejecutadoKg = nextNeta;
              existingApi.ventaBrutaKg = sumDecimalExact([existingApi.ventaBrutaKg || 0, brutaDelta], 2);
              existingApi.devolucionesKg = sumDecimalExact([existingApi.devolucionesKg || 0, devDelta], 2);
              existingApi.ventaNetaKg = nextNeta;
              existingApi.porcentajeCumplimiento =
                nextMeta > 0 ? roundToDecimals((nextNeta / nextMeta) * 100, 4) : pctVal;
            }
          }
        }
      }

      volumenSupabaseRows.push(...supaVolMap.values());
      volumenApiRows.push(...apiVolMap.values());
    }
    metrics[volResolved.sheetName] = tabMetric;
  }

  // ============================================================================
  // 2. HOJAS DE DETALLE DE COMPRA POR RUBRO (Lectura 100% íntegra, decimal exacta e inmune a "fx")
  // ============================================================================
  const readProductPurchaseSheet = (
    exactAliases: string[],
    substringAliases: string[]
  ): { sheetName: string | null; map: Map<string, number> } => {
    const clientMap = new Map<string, number>();
    const resolved = resolveSheetByAliases(
      workbook,
      exactAliases,
      substringAliases,
      ['grid', 'volumen', 'activacion_por_cliente', 'usuarios', 'degustaciones']
    );
    if (!resolved) return { sheetName: null, map: clientMap };

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

      let prevCajas = -1;
      let loggedResetAnomaly = false;

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (isRowCompletelyEmpty(row)) {
          tabMetric.emptyRowsSkipped++;
          continue;
        }

        const rawCodeText = sanitizeSheetText(row[cols.codigo]);
        const cliStr = sanitizeSheetText(row[cols.cliente]);
        if (
          isSummaryOrHeaderLabel(rawCodeText, ['ID CLIENTE', 'CODIGO', 'COD CLIENTE', 'CLIENTE CODIGO', 'ID', 'COD']) ||
          (!rawCodeText && isSummaryOrHeaderLabel(cliStr, ['CLIENTE', 'RAZON SOCIAL', 'NOMBRE CLIENTE', 'NOMBRE']))
        ) {
          tabMetric.summaryRowsSkipped++;
          auditLogs.push({
            severity: 'INFO',
            sheet_name: resolved.sheetName,
            row_number: r + 1,
            event_code: 'SUMMARY_OR_REPEATED_HEADER_SKIPPED',
            entity_key: rawCodeText || cliStr || `ROW_${r + 1}`,
            message: `Fila resumen o encabezado repetido ("${rawCodeText || cliStr}") excluida en "${resolved.sheetName}".`
          });
          continue;
        }

        const { rawClean, canonical } = normalizeClientCode(rawCodeText);
        if (!canonical) {
          // Ignorar silenciosamente filas donde solo hay un texto residual (como 'fx') fuera de Id Cliente/Cliente
          const rawCj = row[cols.cajas];
          if (!cliStr && (rawCj === null || rawCj === undefined || String(rawCj).trim() === '')) {
            tabMetric.emptyRowsSkipped++;
            continue;
          }
          tabMetric.incompleteRowsLogged++;
          warnings.push({
            sheet: resolved.sheetName,
            row: r + 1,
            reason: `Fila de compra sin Id Cliente válido (Cliente="${cliStr}")`
          });
          auditLogs.push({
            severity: 'WARN',
            sheet_name: resolved.sheetName,
            row_number: r + 1,
            event_code: 'DETAIL_ROW_MISSING_CLIENT_ID',
            entity_key: cliStr || null,
            message: `Fila en "${resolved.sheetName}" sin Id Cliente válido.`
          });
          continue;
        }

        const rawCajasCell = row[cols.cajas];
        let cajas = 0;
        if (rawCajasCell !== null && rawCajasCell !== undefined && String(rawCajasCell).trim() !== '') {
          if (!isBlankOrZeroMarker(rawCajasCell) && !isValidNumericCell(rawCajasCell)) {
            qualityTracker.recordIssue('invalid_text', rawCajasCell, `${resolved.sheetName}:R${r + 1}:cajas`);
            warnings.push({
              sheet: resolved.sheetName,
              row: r + 1,
              reason: `Texto residual no numérico "${sanitizeSheetText(rawCajasCell)}" ignorado en columna Cajas (Id Cliente=${rawClean})`
            });
            auditLogs.push({
              severity: 'WARN',
              sheet_name: resolved.sheetName,
              row_number: r + 1,
              event_code: 'RESIDUAL_TEXT_IN_CAJAS',
              entity_key: canonical,
              message: `Texto residual "${sanitizeSheetText(rawCajasCell)}" ignorado en columna Cajas de "${resolved.sheetName}".`,
              payload: { rawCajas: sanitizeSheetText(rawCajasCell), clientCode: rawClean }
            });
            cajas = 0;
          } else {
            cajas = parseLocaleNumber(rawCajasCell, 0, qualityTracker, `${resolved.sheetName}:R${r + 1}:cajas`);
          }
        }

        // Registrar anomalía de reinicio de orden ascendente sin truncar la lectura (Espejo 100% íntegro)
        if (!loggedResetAnomaly && tabMetric.validRecordsRead >= 50 && prevCajas >= 50 && cajas > 0 && cajas <= prevCajas * 0.02) {
          loggedResetAnomaly = true;
          auditLogs.push({
            severity: 'INFO',
            sheet_name: resolved.sheetName,
            row_number: r + 1,
            event_code: 'NON_MONOTONIC_RESET_DETECTED',
            entity_key: canonical,
            message: `Caída abrupta de ordenamiento detectada en "${resolved.sheetName}" fila ${r + 1} (${prevCajas} -> ${cajas} cajas). Se leyeron todas las filas sin truncar.`,
            payload: { prevCajas, cajas, row: r + 1 }
          });
        }
        if (cajas > 0) {
          prevCajas = cajas;
        }

        tabMetric.validRecordsRead++;
        const nextTotal = sumDecimalExact([clientMap.get(canonical) || 0, cajas], 2);
        clientMap.set(canonical, nextTotal);
        if (rawClean && rawClean !== canonical) {
          clientMap.set(rawClean, nextTotal);
        }
      }
    }

    metrics[resolved.sheetName] = tabMetric;
    return { sheetName: resolved.sheetName, map: clientMap };
  };

  const detailAceite = readProductPurchaseSheet(['aceite'], ['aceite']);
  const detailAzucar = readProductPurchaseSheet(['azucar'], ['azucar']);
  const detailLeche = readProductPurchaseSheet(['leche', 'leche_vencampo', 'leche_en_polvo_vencampo'], ['leche']);
  const detailPollo = readProductPurchaseSheet(['pollo'], ['pollo']);
  const detailAsturias = readProductPurchaseSheet(['jamon_asturias', 'estandar_asturias'], ['jamon', 'asturias']);
  const detailSalpicao = readProductPurchaseSheet(['enteros_ligeros', 'mortadela_salpicao'], ['ligeros', 'salpicao', 'mortadela']);
  const detailMortadelaAsturias = readProductPurchaseSheet(['mortadela_asturias'], []);
  const detailSalpicaoSolo = readProductPurchaseSheet(['salpicao'], []);

  // Si se inyecta explícitamente ventasMes (solo para rubros desagregados auxiliares cuando el cliente no está en la hoja), completar sin duplicar jamás lo leído del Sheet
  if (ventasMes.length > 0) {
    const fallbackFromVentas = (targetMap: Map<string, number>, rubro: RubroCodigo) => {
      const temp = new Map<string, number>();
      for (const v of ventasMes) {
        const cajas = Number(v.cajas) || 0;
        if (cajas <= 0) continue;
        if (clasificarRubro(v.id_articulo, v.articulo) !== rubro) continue;
        const { rawClean, canonical } = normalizeClientCode(v.id_cliente);
        if (!canonical || targetMap.has(canonical)) continue;
        const next = +((temp.get(canonical) || 0) + cajas).toFixed(2);
        temp.set(canonical, next);
        if (rawClean && rawClean !== canonical) temp.set(rawClean, next);
      }
      temp.forEach((val, k) => {
        if (!targetMap.has(k)) targetMap.set(k, val);
      });
    };
    fallbackFromVentas(detailLeche.map, 'LECHE_VENCAMPO');
    fallbackFromVentas(detailMortadelaAsturias.map, 'MORTADELA_ASTURIAS');
    fallbackFromVentas(detailSalpicaoSolo.map, 'SALPICAO');
  }

  const productMaps = {
    ACEITE: detailAceite.map,
    AZUCAR: detailAzucar.map,
    POLLO: detailPollo.map,
    ESTANDAR_ASTURIAS: detailAsturias.map,
    MORTADELA_SALPICAO: detailSalpicao.map,
    LECHE_VENCAMPO: detailLeche.map,
    MORTADELA_ASTURIAS: detailMortadelaAsturias.map,
    SALPICAO: detailSalpicaoSolo.map
  };

  // ============================================================================
  // 3. ACTIVACIÓN POR CLIENTE + CRUCE EXACTO DE CODIGO CON ID CLIENTE
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
    vendedorKey: string;
    flagAceite: boolean;
    flagAzucar: boolean;
    flagPollo: boolean;
    flagAsturias: boolean;
    flagSalpicao: boolean;
    flagLeche: boolean;
    flagMortadelaAsturias: boolean;
    flagSalpicaoNuevo: boolean;
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
          salpicao: ['mortadela_salpicao_y_asturias', 'enteros_ligeros', 'mortadela_salpicao'],
          leche: ['leche_en_polvo_vencampo', 'leche_vencampo', 'leche'],
          mortadelaAsturias: ['mortadela_asturias']
        },
        {
          codigo: 0,
          razonSocial: 1,
          vendedor: 2,
          aceite: 3,
          azucar: 4,
          pollo: 5,
          asturias: 6,
          salpicao: 7,
          leche: -1,
          mortadelaAsturias: -1
        }
      );
      const salpicaoNuevoIdx = (rows[0] || []).map(normalizeHeaderKey).indexOf('salpicao');

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (isRowCompletelyEmpty(row)) {
          tabMetric.emptyRowsSkipped++;
          continue;
        }

        const rawCodeText = sanitizeSheetText(row[cols.codigo]);
        const razonSocial = sanitizeSheetText(row[cols.razonSocial]);
        const rawVendor = sanitizeSheetText(row[cols.vendedor]);

        if (
          isSummaryOrHeaderLabel(rawCodeText, ['CODIGO', 'ID CLIENTE', 'CLIENTE CODIGO', 'COD', 'ID']) ||
          isSummaryOrHeaderLabel(rawVendor, ['VENDEDOR', 'RUTA', 'EJECUTIVO', 'VENDEDOR NOMBRE']) ||
          (!rawCodeText && isSummaryOrHeaderLabel(razonSocial, ['RAZON SOCIAL', 'CLIENTE', 'NOMBRE CLIENTE']))
        ) {
          tabMetric.summaryRowsSkipped++;
          auditLogs.push({
            severity: 'INFO',
            sheet_name: actResolved.sheetName,
            row_number: r + 1,
            event_code: 'SUMMARY_OR_REPEATED_HEADER_SKIPPED',
            entity_key: rawCodeText || razonSocial || rawVendor || `ROW_${r + 1}`,
            message: `Fila resumen o encabezado repetido ("${rawCodeText || razonSocial || rawVendor}") excluida en "${actResolved.sheetName}".`
          });
          continue;
        }

        const { rawClean, canonical } = normalizeClientCode(rawCodeText);

        if (!canonical || !rawVendor) {
          tabMetric.incompleteRowsLogged++;
          warnings.push({
            sheet: actResolved.sheetName,
            row: r + 1,
            reason: `Fila incompleta en Activación por Cliente (CODIGO="${rawClean}", VENDEDOR="${rawVendor}")`
          });
          auditLogs.push({
            severity: 'WARN',
            sheet_name: actResolved.sheetName,
            row_number: r + 1,
            event_code: 'ACTIVACION_INCOMPLETE_ROW',
            entity_key: rawClean || null,
            message: `Fila incompleta en Activación por Cliente (CODIGO="${rawClean}", VENDEDOR="${rawVendor}").`
          });
          continue;
        }

        const flagAceite = cols.aceite >= 0 ? parseTruthySheetFlag(row[cols.aceite]) : false;
        const flagAzucar = cols.azucar >= 0 ? parseTruthySheetFlag(row[cols.azucar]) : false;
        const flagPollo = cols.pollo >= 0 ? parseTruthySheetFlag(row[cols.pollo]) : false;
        const flagAsturias = cols.asturias >= 0 ? parseTruthySheetFlag(row[cols.asturias]) : false;
        const flagSalpicao = cols.salpicao >= 0 ? parseTruthySheetFlag(row[cols.salpicao]) : false;
        const flagLeche = cols.leche >= 0 ? parseTruthySheetFlag(row[cols.leche]) : false;
        const flagMortadelaAsturias = cols.mortadelaAsturias >= 0 ? parseTruthySheetFlag(row[cols.mortadelaAsturias]) : false;
        const flagSalpicaoNuevo = salpicaoNuevoIdx >= 0 ? parseTruthySheetFlag(row[salpicaoNuevoIdx]) : false;

        const ccSheet = normalizeCuentasClavesVendor(rawVendor);
        const mappedVendor = ccSheet
          ? ccSheet.id
          : normalizeVendorKey(rawVendor) === 'FOOD SERVICE NORTE'
            ? 'JAIDER MEDINA - FOOD SERVICE NORTE'
            : rawVendor;
        const vendorKey = normalizeVendorKey(mappedVendor);

        if (sheetClientsByCanonical.has(canonical)) {
          const prev = sheetClientsByCanonical.get(canonical)!;
          prev.flagAceite = prev.flagAceite || flagAceite;
          prev.flagAzucar = prev.flagAzucar || flagAzucar;
          prev.flagPollo = prev.flagPollo || flagPollo;
          prev.flagAsturias = prev.flagAsturias || flagAsturias;
          prev.flagSalpicao = prev.flagSalpicao || flagSalpicao;
          prev.flagLeche = prev.flagLeche || flagLeche;
          prev.flagMortadelaAsturias = prev.flagMortadelaAsturias || flagMortadelaAsturias;
          prev.flagSalpicaoNuevo = prev.flagSalpicaoNuevo || flagSalpicaoNuevo;
          warnings.push({
            sheet: actResolved.sheetName,
            row: r + 1,
            reason: `Código de cliente duplicado #${rawClean} ("${razonSocial}") consolidado en registro único`
          });
          auditLogs.push({
            severity: 'INFO',
            sheet_name: actResolved.sheetName,
            row_number: r + 1,
            event_code: 'DUPLICATE_CLIENT_CODE_CONSOLIDATED',
            vendor_key: vendorKey,
            entity_key: canonical,
            message: `Código de cliente duplicado #${rawClean} consolidado en registro único.`
          });
          continue;
        }

        tabMetric.validRecordsRead++;
        sheetClientsByCanonical.set(canonical, {
          rawCode: rawClean,
          canonicalCode: canonical,
          razonSocial,
          vendedor: mappedVendor,
          vendedorKey: vendorKey,
          flagAceite,
          flagAzucar,
          flagPollo,
          flagAsturias,
          flagSalpicao,
          flagLeche,
          flagMortadelaAsturias,
          flagSalpicaoNuevo
        });
      }
    }

    metrics[actResolved.sheetName] = tabMetric;
  }

  const mergedClientsMap = new Map<
    string,
    {
      dbId?: number;
      codigo: string;
      canonical: string;
      razonSocial: string;
      vendedorId: string;
      vendedorKey: string;
      vendedorNombre: string;
      isNewFromSheet: boolean;
      sheetFlags?: SheetClientRow;
    }
  >();

  const activeCanonicalCodes = new Set<string>();

  for (const mc of masterClients) {
    const rawCodeClean = String(mc.cliente_codigo || '').replace(/#\d+$/, '').trim();
    const { rawClean, canonical } = normalizeClientCode(rawCodeClean);
    if (!canonical) continue;
    const rawVId = String(mc.vendedor_id || mc.vendedor_nombre || '').replace(/\s+/g, ' ').trim();
    if (rawVId.toUpperCase().startsWith('INACTIVO_MAESTRA::')) continue;
    const rawVNombre = String(mc.vendedor_nombre || mc.vendedor_id || '').replace(/\s+/g, ' ').trim();
    const ccMc = normalizeCuentasClavesVendor(rawVNombre) || normalizeCuentasClavesVendor(rawVId);
    const vIdClean = ccMc ? ccMc.id : rawVId;
    const vNombreClean = ccMc ? ccMc.id : rawVNombre;
    const vKey = normalizeVendorKey(vNombreClean);
    const compositeKey = `${vKey}::${canonical}`;
    const sheetMatch = sheetClientsByCanonical.get(canonical);
    if (!mergedClientsMap.has(compositeKey)) {
      activeCanonicalCodes.add(canonical);
      mergedClientsMap.set(compositeKey, {
        dbId: mc.id,
        codigo: String(mc.cliente_codigo || rawClean || canonical).trim(),
        canonical,
        razonSocial: String(mc.cliente_nombre || sheetMatch?.razonSocial || '').trim(),
        vendedorId: vIdClean,
        vendedorKey: vKey,
        vendedorNombre: vNombreClean,
        isNewFromSheet: false,
        sheetFlags: sheetMatch
      });
    }
  }

  if (masterClients.length === 0) {
    for (const [canonical, sc] of sheetClientsByCanonical.entries()) {
      if (sc.vendedorKey === 'ALI PEREZ') continue;
      const compositeKey = `${sc.vendedorKey}::${canonical}`;
      if (mergedClientsMap.has(compositeKey)) continue;
      activeCanonicalCodes.add(canonical);
      mergedClientsMap.set(compositeKey, {
        codigo: sc.rawCode || canonical,
        canonical,
        razonSocial: sc.razonSocial,
        vendedorId: sc.vendedor,
        vendedorKey: sc.vendedorKey,
        vendedorNombre: sc.vendedor,
        isNewFromSheet: true,
        sheetFlags: sc
      });
    }
  }

  // Auditar clientes con compra en las 5 hojas de detalle que no aparecen en la cartera maestra/Activación por Cliente
  const detailAudits: Array<{ label: string; detail: { sheetName: string | null; map: Map<string, number> } }> = [
    { label: 'AZUCAR', detail: detailAzucar },
    { label: 'LECHE VENCAMPO', detail: detailLeche },
    { label: 'POLLO', detail: detailPollo },
    { label: 'ESTANDAR Y SUPERIOR ASTURIAS', detail: detailAsturias },
    { label: 'MORTADELA SALPICAO Y ASTURIAS', detail: detailSalpicao }
  ];
  for (const { label, detail } of detailAudits) {
    if (!detail.sheetName || activeCanonicalCodes.size === 0) continue;
    const missingCodes: string[] = [];
    for (const [code, cajas] of detail.map.entries()) {
      const { canonical } = normalizeClientCode(code);
      if (canonical && code === canonical && cajas > 0 && !activeCanonicalCodes.has(canonical)) {
        missingCodes.push(canonical);
      }
    }
    if (missingCodes.length > 0) {
      auditLogs.push({
        severity: 'WARN',
        sheet_name: detail.sheetName,
        row_number: null,
        event_code: 'DETAIL_CLIENT_NOT_IN_MASTER_SHEET',
        entity_key: label,
        message: `${missingCodes.length} cliente(s) con compra en "${detail.sheetName}" no existen en la cartera activa de "Activación por Cliente".`,
        payload: { count: missingCodes.length, sampleClientCodes: missingCodes.slice(0, 25) }
      });
    }
  }

  const activacionApiRows: any[] = [];
  const activacionSupabaseUpserts: any[] = [];
  const newSheetClientsForSupabase: any[] = [];
  const clientActByVendorKey = new Map<string, Record<string, number>>();

  for (const c of mergedClientsMap.values()) {
    if (!c.vendedorId || c.vendedorKey === 'ALI PEREZ') continue;

    const cAceite = +(productMaps.ACEITE.get(c.canonical) ?? productMaps.ACEITE.get(c.codigo) ?? 0).toFixed(2);
    const cAzucar = +(productMaps.AZUCAR.get(c.canonical) ?? productMaps.AZUCAR.get(c.codigo) ?? 0).toFixed(2);
    const cPollo = +(productMaps.POLLO.get(c.canonical) ?? productMaps.POLLO.get(c.codigo) ?? 0).toFixed(2);
    const cAsturias = +(productMaps.ESTANDAR_ASTURIAS.get(c.canonical) ?? productMaps.ESTANDAR_ASTURIAS.get(c.codigo) ?? 0).toFixed(2);
    const cSalpicao = +(productMaps.MORTADELA_SALPICAO.get(c.canonical) ?? productMaps.MORTADELA_SALPICAO.get(c.codigo) ?? 0).toFixed(2);
    const cLeche = +(productMaps.LECHE_VENCAMPO.get(c.canonical) ?? productMaps.LECHE_VENCAMPO.get(c.codigo) ?? 0).toFixed(2);
    const cMortAst = +(productMaps.MORTADELA_ASTURIAS.get(c.canonical) ?? productMaps.MORTADELA_ASTURIAS.get(c.codigo) ?? 0).toFixed(2);
    const cSalpNuevo = +(productMaps.SALPICAO.get(c.canonical) ?? productMaps.SALPICAO.get(c.codigo) ?? 0).toFixed(2);

    const hasAceite = cAceite > 0 || Boolean(c.sheetFlags?.flagAceite);
    const hasAzucar = cAzucar > 0 || Boolean(c.sheetFlags?.flagAzucar);
    const hasPollo = cPollo > 0 || Boolean(c.sheetFlags?.flagPollo);
    const hasAsturias = cAsturias > 0 || Boolean(c.sheetFlags?.flagAsturias);
    const hasSalpicao = cSalpicao > 0 || Boolean(c.sheetFlags?.flagSalpicao);
    const hasLeche = cLeche > 0 || Boolean(c.sheetFlags?.flagLeche);
    const hasMortAst = cMortAst > 0 || Boolean(c.sheetFlags?.flagMortadelaAsturias);
    const hasSalpNuevo = cSalpNuevo > 0 || Boolean(c.sheetFlags?.flagSalpicaoNuevo);
    const isActivo = hasAzucar || hasLeche || hasPollo || hasAsturias || hasSalpicao;

    const routeTrackKey = resolveCanonicalRouteKey(c.vendedorKey);
    for (const k of new Set([c.vendedorKey, routeTrackKey])) {
      if (!clientActByVendorKey.has(k)) {
        clientActByVendorKey.set(k, {
          AZUCAR: 0,
          'LECHE VENCAMPO': 0,
          POLLO: 0,
          'ESTANDAR Y SUPERIOR ASTURIAS': 0,
          'MORTADELA SALPICAO Y ASTURIAS': 0
        });
      }
      const vCounts = clientActByVendorKey.get(k)!;
      if (hasAzucar) vCounts.AZUCAR++;
      if (hasLeche) vCounts['LECHE VENCAMPO']++;
      if (hasPollo) vCounts.POLLO++;
      if (hasAsturias) vCounts['ESTANDAR Y SUPERIOR ASTURIAS']++;
      if (hasSalpicao) vCounts['MORTADELA SALPICAO Y ASTURIAS']++;
    }

    const supaPayload = {
      ...(c.dbId !== undefined ? { id: c.dbId } : {}),
      periodo,
      cliente_codigo: c.codigo,
      cliente_codigo_canonico: c.canonical,
      cliente_nombre: c.razonSocial,
      vendedor_id: c.vendedorId,
      vendedor_key: c.vendedorKey,
      vendedor_nombre: c.vendedorNombre,
      status: isActivo ? 'ACTIVO' : 'INACTIVO',
      cajas_aceite: cAceite,
      cajas_azucar: cAzucar,
      cajas_pollo: cPollo,
      cajas_estandar_asturias: cAsturias,
      cajas_mortadela_salpicao: cSalpicao,
      cajas_leche_vencampo: cLeche,
      cajas_mortadela_asturias: cMortAst,
      cajas_salpicao: cSalpNuevo,
      has_aceite: hasAceite,
      has_azucar: hasAzucar,
      has_pollo: hasPollo,
      has_estandar_asturias: hasAsturias,
      has_mortadela_salpicao: hasSalpicao,
      has_leche_vencampo: hasLeche,
      has_mortadela_asturias: hasMortAst,
      has_salpicao: hasSalpNuevo
    };

    if (c.dbId !== undefined) {
      activacionSupabaseUpserts.push(supaPayload);
    } else if (c.isNewFromSheet) {
      newSheetClientsForSupabase.push(supaPayload);
    }

    const ccAct = normalizeCuentasClavesVendor(c.vendedorNombre) || normalizeCuentasClavesVendor(c.vendedorId);
    const vendUpper = c.vendedorKey;
    const isVilla = vendUpper.includes('VILLA');
    const isJohnatanOrMikel =
      vendUpper.includes('JOHNATAN') || vendUpper.includes('MIKELANGELO') || vendUpper.includes('SOTO');
    const displayVendedorNombre = ccAct
      ? ccAct.display
      : isJohnatanOrMikel
        ? isVilla
          ? 'Mikelangelo Diaz (Villa del Rosario)'
          : 'Mikelangelo Diaz (Principal)'
        : c.vendedorNombre;
    const displayEmail = isJohnatanOrMikel ? 'Mikelangelodiaz@gmail.com' : undefined;

    const candidateActRow = {
      id: String(c.codigo),
      vendedorId: c.vendedorId,
      vendedorKey: c.vendedorKey,
      vendedorNombre: displayVendedorNombre,
      vendedorEmail: displayEmail,
      cliente: sanitizeSheetText(c.razonSocial),
      status: isActivo ? ('ACTIVO' as const) : ('INACTIVO' as const),
      cats: {
        ACEITE: hasAceite,
        AZUCAR: hasAzucar,
        POLLO: hasPollo,
        ESTANDAR_ASTURIAS: hasAsturias,
        MORTADELA_SALPICAO: hasSalpicao,
        LECHE_VENCAMPO: hasLeche,
        MORTADELA_ASTURIAS: hasMortAst,
        SALPICAO: hasSalpNuevo,
        ARROZ: hasPollo,
        ENTERO: hasAsturias,
        LIGEROS: hasSalpicao
      },
      cajas: {
        ACEITE: cAceite,
        AZUCAR: cAzucar,
        POLLO: cPollo,
        ESTANDAR_ASTURIAS: cAsturias,
        MORTADELA_SALPICAO: cSalpicao,
        LECHE_VENCAMPO: cLeche,
        MORTADELA_ASTURIAS: cMortAst,
        SALPICAO: cSalpNuevo
      }
    };
    candidateActRow.status = isClientActiveInAnyFocusProduct(candidateActRow) ? 'ACTIVO' : 'INACTIVO';
    if (isValidActivacionRecord(candidateActRow)) {
      activacionApiRows.push(candidateActRow);
    }
  }

  // ============================================================================
  // 4. GRID DE ACTIVACIÓN POR VENDEDOR (Espejo exacto desde Fila 1 + !merges; excluye TOTAL/SUBTOTAL/encabezados repetidos)
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
      const gridMergeSpans = getMergedHeaderSpansForRow(gridResolved.sheet, 0);
      const expandedRow0 = expandMergedRowValues(gridResolved.sheet, rows[0] || [], 0);
      const h0Raw = (rows[0] || []).map(normalizeHeaderKey);
      const h0Expanded = expandedRow0.map(normalizeHeaderKey);
      const h1 = (rows[1] || []).map(normalizeHeaderKey);

      const vendorCol = h1.findIndex((h) => h === 'vendedor' || h === 'ruta' || h === 'ejecutivo');
      const carteraCol = h1.findIndex((h) => h === 'cartera' || h === 'clientes');
      const resolvedVendorCol = vendorCol !== -1 ? vendorCol : 0;
      const resolvedCarteraCol = carteraCol !== -1 ? carteraCol : 1;

      // Localizar los 5 productos foco EXCLUSIVAMENTE desde la Fila 1 (rows[0] + !merges),
      // ignorando las etiquetas obsoletas de la Fila 2 ("Meta Aceite ", "Meta azucar"),
      // y resolviendo subcolumnas Meta / Activados dentro del rango combinado aunque cambie el orden.
      const findCategoryColsFromRow1 = (
        catKeywords: string[],
        fallbackMeta: number,
        fallbackAct: number
      ): { metaIdx: number; actIdx: number } => {
        const searchArr = h0Raw.some(Boolean) ? h0Raw : h0Expanded;
        for (let c = 0; c < searchArr.length; c++) {
          const cell0 = searchArr[c] || '';
          if (cell0 && catKeywords.some((kw) => cell0 === kw || cell0.includes(kw))) {
            const spanEnd = gridMergeSpans.get(c) || c + 2;
            let metaIdx = c;
            let actIdx = c + 1;
            for (let subC = c; subC < spanEnd; subC++) {
              const sub = h1[subC] || '';
              if (sub.includes('meta') || sub.includes('cuota') || sub.includes('objetivo')) {
                metaIdx = subC;
              } else if (sub.includes('activado') || sub.includes('ejecutado') || sub.includes('real') || sub.includes('logro')) {
                actIdx = subC;
              }
            }
            if (metaIdx === actIdx) {
              actIdx = metaIdx === c ? c + 1 : c;
            }
            return { metaIdx, actIdx };
          }
        }
        return { metaIdx: fallbackMeta, actIdx: fallbackAct };
      };

      const catDefs = RUBROS_ACTIVOS_CONFIG.map((r) => {
        const g = GRID_CATEGORY_HEADER_KEYWORDS[r.codigo as keyof typeof GRID_CATEGORY_HEADER_KEYWORDS] || {
          keywords: [normalizeHeaderKey(r.categoriaServidor)],
          fallbackMeta: -1,
          fallbackAct: -1
        };
        return { name: r.categoriaServidor, ...findCategoryColsFromRow1(g.keywords, g.fallbackMeta, g.fallbackAct) };
      });

      const sumByCat = new Map<string, { meta: number; activados: number }>();
      catDefs.forEach((c) => sumByCat.set(c.name, { meta: 0, activados: 0 }));

      for (let r = 2; r < rows.length; r++) {
        const row = rows[r];
        if (isRowCompletelyEmpty(row)) {
          tabMetric.emptyRowsSkipped++;
          continue;
        }

        const rawVendor = row[resolvedVendorCol];
        const rawVName = sanitizeSheetText(rawVendor);
        const isRepeatedHeader = rawVName
          ? ['vendedor', 'ruta', 'ejecutivo', 'vendedor_nombre'].includes(normalizeHeaderKey(rawVName))
          : false;
        const isLabeledSummary = rawVName ? isSummaryOrHeaderLabel(rawVName) : false;

        if (isRepeatedHeader) {
          tabMetric.summaryRowsSkipped++;
          auditLogs.push({
            severity: 'INFO',
            sheet_name: gridResolved.sheetName,
            row_number: r + 1,
            event_code: 'SUMMARY_OR_REPEATED_HEADER_SKIPPED',
            entity_key: rawVName,
            message: `Encabezado repetido ("${rawVName}") excluido en "${gridResolved.sheetName}".`
          });
          continue;
        }

        if (!rawVName || isLabeledSummary) {
          // Fila final o etiquetada de sumatoria/promedio (TOTAL, SUBTOTAL, TOTAL GENERAL, PROMEDIO o en blanco):
          // excluir de metas_activacion y auditar totales contra SUM(filas)
          tabMetric.summaryRowsSkipped++;
          const isPromedio = /PROMEDIO|MEDIA/i.test(rawVName);
          if (isLabeledSummary) {
            auditLogs.push({
              severity: 'INFO',
              sheet_name: gridResolved.sheetName,
              row_number: r + 1,
              event_code: 'SUMMARY_OR_REPEATED_HEADER_SKIPPED',
              entity_key: rawVName,
              message: `Fila resumen etiquetada ("${rawVName}") excluida en "${gridResolved.sheetName}" para evitar doble conteo.`
            });
          }
          if (!isPromedio) {
            for (const cDef of catDefs) {
              const footerMeta = Math.round(parseLocaleNumber(row[cDef.metaIdx], 0));
              const footerAct = Math.round(parseLocaleNumber(row[cDef.actIdx], 0));
              const computed = sumByCat.get(cDef.name)!;
              if (footerMeta !== computed.meta || footerAct !== computed.activados) {
                auditLogs.push({
                  severity: 'WARN',
                  sheet_name: gridResolved.sheetName,
                  row_number: r + 1,
                  event_code: 'GRID_FOOTER_MISMATCH',
                  entity_key: cDef.name,
                  message: `Descuadre en fila total del Grid para "${cDef.name}": fila=${footerMeta}/${footerAct} vs suma=${computed.meta}/${computed.activados}.`,
                  payload: {
                    categoria: cDef.name,
                    footerMeta,
                    computedMeta: computed.meta,
                    footerActivados: footerAct,
                    computedActivados: computed.activados
                  }
                });
              }
            }
          }
          continue;
        }

        if (isSupervisorSummaryHeader(rawVName)) {
          tabMetric.summaryRowsSkipped++;
          continue;
        }

        tabMetric.validRecordsRead++;
        const vName = normalizeVendorKey(rawVName) === 'LUIS GUANIPA' ? 'VICTORIA VARGAS' : rawVName;
        const vKey = normalizeVendorKey(vName);
        const routeLookupKey = resolveCanonicalRouteKey(vKey);
        const cartera = Math.max(
          0,
          Math.round(parseLocaleNumber(row[resolvedCarteraCol], 0, qualityTracker, `${gridResolved.sheetName}:R${r + 1}:cartera`))
        );
        const detailCounts = clientActByVendorKey.get(vKey) || clientActByVendorKey.get(routeLookupKey);

        for (const cDef of catDefs) {
          const meta = Math.max(
            0,
            Math.round(parseLocaleNumber(row[cDef.metaIdx], 0, qualityTracker, `${gridResolved.sheetName}:R${r + 1}:${cDef.name}:meta`))
          );
          const activados = Math.max(
            0,
            Math.round(parseLocaleNumber(row[cDef.actIdx], 0, qualityTracker, `${gridResolved.sheetName}:R${r + 1}:${cDef.name}:act`))
          );

          const acc = sumByCat.get(cDef.name)!;
          acc.meta += meta;
          acc.activados += activados;

          // Auditar diferencia entre el resumen oficial del Grid y el conteo en hojas de detalle SIN pisar el valor del Grid
          if (detailCounts && detailCounts[cDef.name] !== undefined && detailCounts[cDef.name] !== activados) {
            auditLogs.push({
              severity: 'WARN',
              sheet_name: gridResolved.sheetName,
              row_number: r + 1,
              event_code: 'SUMMARY_VS_DETAIL_MISMATCH',
              vendor_key: vKey,
              entity_key: cDef.name,
              message: `Diferencia entre Grid (${activados}) y Hojas de Detalle (${detailCounts[cDef.name]}) para "${vName}" en "${cDef.name}". Se respeta el espejo del Grid.`,
              payload: {
                gridActivados: activados,
                detailActivados: detailCounts[cDef.name],
                delta: activados - detailCounts[cDef.name]
              }
            });
          }

          const candidateMetaApi = {
            vendedorId: vName,
            vendedorKey: vKey,
            categoria: cDef.name,
            cartera,
            meta,
            activados
          };
          if (isValidMetaRecord(candidateMetaApi)) {
            metasSupabaseRows.push({
              periodo,
              vendedor_id: vName,
              vendedor_key: vKey,
              categoria: cDef.name,
              cartera,
              meta,
              activados
            });

            metasApiRows.push(candidateMetaApi);
          }
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
  // 6. DEGUSTACIONES (19 columnas + filtro estricto del mes vigente + cuarentena en sync_audit_logs)
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

      const TEST_IDENTITY_RE = /\b(SISTEMA\s*TEST|AGENTE\s*PRUEBA|CLIENTE\s*PRUEBA|TEST\s*PING)\b/i;

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (isRowCompletelyEmpty(row)) {
          tabMetric.emptyRowsSkipped++;
          continue;
        }

        const id = String(row[cols.id] ?? '').trim();
        const vendedorNombre = String(row[cols.vendedor] ?? '').trim();
        const ruta = String(row[cols.ruta] ?? '').trim();
        const clienteNombre = String(row[cols.clienteNombre] ?? '').trim();
        const vendedorKey = normalizeVendorKey(vendedorNombre || ruta);

        // 1) Cuarentena: fila desplazada sin ID primario
        if (!id) {
          tabMetric.incompleteRowsLogged++;
          warnings.push({
            sheet: degResolved.sheetName,
            row: r + 1,
            reason: 'Fila en Degustaciones con datos parciales pero sin ID primario'
          });
          auditLogs.push({
            severity: 'WARN',
            sheet_name: degResolved.sheetName,
            row_number: r + 1,
            event_code: 'QUARANTINE_MISSING_ID',
            vendor_key: vendedorKey || null,
            entity_key: null,
            message: 'Fila desplazada o incompleta sin ID en Degustaciones enviada a cuarentena.',
            payload: { vendedorNombre, clienteNombre, ruta }
          });
          continue;
        }

        // 2) Cuarentena: registros de prueba (test-*, deg-00*, SISTEMA TEST, AGENTE PRUEBA)
        if (
          /^test(?:[-_0-9]|$)/i.test(id) ||
          /^deg-00/i.test(id) ||
          TEST_IDENTITY_RE.test(`${id} ${vendedorNombre} ${clienteNombre}`)
        ) {
          auditLogs.push({
            severity: 'INFO',
            sheet_name: degResolved.sheetName,
            row_number: r + 1,
            event_code: 'QUARANTINE_TEST_DATA',
            vendor_key: vendedorKey || null,
            entity_key: id,
            message: `Registro de prueba "${id}" enviado a cuarentena.`,
            payload: { id, vendedorNombre, clienteNombre }
          });
          continue;
        }

        const fechaDeg = parseSheetDate(row[cols.fechaDegustacion]);

        // 3) Cuarentena: registros foráneos (ej. alk-* de Alkosto) o sin fecha de degustación válida
        if (/^alk-/i.test(id) || !fechaDeg) {
          auditLogs.push({
            severity: 'WARN',
            sheet_name: degResolved.sheetName,
            row_number: r + 1,
            event_code: 'QUARANTINE_FOREIGN_RECORD',
            vendor_key: vendedorKey || null,
            entity_key: id,
            message: `Registro foráneo o sin Fecha Degustación válida ("${id}") enviado a cuarentena.`,
            payload: { id, rawFechaDegustacion: row[cols.fechaDegustacion], ruta }
          });
          continue;
        }

        // 4) Cuarentena: registros fuera del periodo mensual vigente en America/Caracas (ej. meses pasados)
        const degMonth = fechaDeg.slice(0, 7);
        if (periodo && /^\d{4}-\d{2}$/.test(periodo) && degMonth !== periodo) {
          auditLogs.push({
            severity: 'INFO',
            sheet_name: degResolved.sheetName,
            row_number: r + 1,
            event_code: 'QUARANTINE_OUT_OF_PERIOD_MONTH',
            vendor_key: vendedorKey || null,
            entity_key: id,
            message: `Degustación "${id}" (${fechaDeg}) fuera del periodo vigente (${periodo}) enviada a cuarentena para proteger histórico.`,
            payload: { id, fecha: fechaDeg, periodoEsperado: periodo }
          });
          continue;
        }

        tabMetric.validRecordsRead++;
        const rawProductos = String(row[cols.productos] ?? '').trim();
        const parsedProductos = rawProductos
          ? (parseCsvRfc4180(rawProductos)[0] || []).map((p) => p.trim()).filter(Boolean)
          : [];

        degustacionesRows.push({
          id: sanitizeSheetText(id),
          createdAt: parseSheetDate(row[cols.fechaRegistro]) || sanitizeSheetText(row[cols.fechaRegistro]),
          vendedorNombre: sanitizeSheetText(vendedorNombre),
          vendedorId: sanitizeSheetText(ruta || vendedorNombre),
          vendedorKey,
          ruta: sanitizeSheetText(ruta),
          clienteCodigo: normalizeClientCode(row[cols.clienteCodigo]).rawClean || 'PDV',
          clienteNombre: sanitizeSheetText(clienteNombre),
          fecha: fechaDeg,
          turno: sanitizeSheetText(row[cols.turno] ?? 'MAÑANA').toUpperCase(),
          hora: sanitizeSheetText(row[cols.horario]),
          productos: parsedProductos.map((p) => sanitizeSheetText(p)).filter(Boolean),
          kilosEstimados: roundToDecimals(
            parseLocaleNumber(row[cols.kilosEstimados], 0, qualityTracker, `${degResolved.sheetName}:R${r + 1}:kilos`),
            2
          ),
          personasEstimadas: Math.max(
            0,
            Math.round(
              parseLocaleNumber(row[cols.personasEstimadas], 0, qualityTracker, `${degResolved.sheetName}:R${r + 1}:personas`)
            )
          ),
          requierePromotora: parseTruthySheetFlag(row[cols.requierePromotora]),
          materialPop: parseTruthySheetFlag(row[cols.materialPop]),
          contactoPunto: sanitizeSheetText(row[cols.contactoPunto]),
          telefonoContacto: sanitizeSheetText(row[cols.telefonoContacto]),
          estado: sanitizeSheetText(row[cols.estado] ?? 'SOLICITADA').toUpperCase(),
          promotoraAsignada: sanitizeSheetText(row[cols.promotoraAsignada]),
          notasTradeMarketing: sanitizeSheetText(row[cols.notasTradeMarketing])
        });
      }
    }
    metrics[degResolved.sheetName] = tabMetric;
  }

  const dataQuality = qualityTracker.snapshot();
  if (dataQuality.sheetErrors > 0 || dataQuality.invalidText > 0) {
    auditLogs.push({
      severity: 'WARN',
      sheet_name: 'WORKBOOK_QUALITY',
      row_number: null,
      event_code: 'DATA_QUALITY_COERCIONS',
      message: `Calidad de datos numéricos: ${dataQuality.sheetErrors} errores de fórmula (#N/A/#DIV/0!) y ${dataQuality.invalidText} textos no numéricos saneados a 0.`,
      payload: {
        totalParsed: dataQuality.totalParsed,
        sheetErrors: dataQuality.sheetErrors,
        invalidText: dataQuality.invalidText,
        samples: dataQuality.samples.slice(0, 15)
      }
    });
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
    warnings,
    auditLogs,
    dataQuality
  };
}
