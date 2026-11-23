/**
 * MOTOR DE INGESTA EXACTA, NORMALIZACIÓN CANÓNICA Y DETECCIÓN DE CAMBIOS NUMÉRICOS POR VENDEDOR
 * ---------------------------------------------------------------------------------------------
 * - parseSheetNumber: sanitización estricta de números ("8,000.00" -> 8000, "7,575.10" -> 7575.1,
 *   "0.5"/"0.95", "-56.60", "-1.90%", "-"/"#DIV/0!"/"#VALUE!"/"#REF!"/"N/A" -> 0).
 * - normalizeSellerKey + consolidateSellerToMasterKey: consolidación exacta de rutas/sufijos
 *   subdivididos (MIKELANGELO DIAZ1, J PABLO ARAUJO - ..., OSCAR ORTIZ- CORO / LA COSTA) contra
 *   el maestro de la hoja `Usuarios` sin perder ni duplicar kilos ni cuotas.
 * - Reglas explícitas por hoja:
 *   1) `Grid de Activación por Vendedor` (A1:L): doble fila de encabezado, trim de Fila 2 y
 *      asociación de cada `Activados` a su categoría inmediatamente anterior (`col - 1`), datos desde Fila 3.
 *   2) `Volumen por SKU` (A1:CN): forward-fill horizontal de celdas combinadas en Fila 1,
 *      soporte de variaciones `CUOTA`/`CUOTA KG`, `KG`/`VENTA KG` y `%` validado, datos desde Fila 3.
 *   3) `Activación por Cliente` (A1:H) + hojas de cajas (`pollo`, `jamon asturias`, `leche`,
 *      `Azucar`, `Enteros Ligeros`): códigos alfanuméricos sin espacios ni `.0` y decimales exactos.
 * - SellerNumericSyncTracker: hash SHA-256 determinista sobre payload numérico ordenado por vendedor,
 *   sin falsos positivos al reiniciar Render (`version = 1` silenciosa en arranque).
 */

import crypto from 'crypto';
import { parseSafeNumber, roundToDecimals, sanitizeSheetText, sumDecimalExact } from '../utils/safeNumber';
import { normalizeVendorKey, resolveCanonicalRouteKey } from '../utils/vendorKeyNormalizer';
import { SUPERVISOR_SUMMARY_COLUMNS, VENDOR_PROFILES, SUPERVISOR_PROFILES, matchesVendorAlias } from '../utils/vendorRoutes';
import { isSummaryOrHeaderLabel } from '../config/sheetsConfig';

export interface SellerMasterRecord {
  usuario: string;
  rol: string;
  vendorId: string;
}

export interface GridActivacionSellerRow {
  sellerRaw: string;
  sellerKey: string;
  masterSellerKey: string;
  cartera: number;
  categories: Record<string, { meta: number; activados: number }>;
}

export interface VolumenSkuParsedRow {
  sellerRaw: string;
  routeKey: string;
  masterSellerKey: string;
  sku: string;
  articulo: string;
  cuotaKg: number;
  ventaKg: number;
  porcentaje: number;
}

export interface ClienteActivacionCajasRow {
  codigo: string;
  codigoCanonico: string;
  razonSocial: string;
  vendedorRaw: string;
  masterSellerKey: string;
  cajas: Record<string, number>;
  activo: boolean;
}

export interface SellerSyncStateEntry {
  sellerId: string;
  numericHash: string;
  version: number;
  updatedAt: number;
}

export interface SellerNumericChangeEvent {
  sellerId: string;
  version: number;
  updatedAt: number;
}

export interface SheetMergeRange {
  s: { r: number; c: number };
  e: { r: number; c: number };
}

/**
 * 1.1 Función obligatoria `parseSheetNumber(rawValue)`:
 * - Convierte `null`, `undefined`, `""`, `"-"`, `"N/A"` y errores de fórmula (`#DIV/0!`, `#VALUE!`, `#REF!`) a `0`.
 * - Limpia espacios, monedas, separadores de miles y `%` ANTES de convertir a `Number`.
 * - Preserva decimales (`0.5`, `0.95`) y negativos reales (`-56.60`, `-1.90%`).
 * - Garantiza `"8,000.00"` -> `8000` y `"7,575.10"` -> `7575.1`. Nunca devuelve `NaN`.
 */
export function parseSheetNumber(rawValue: unknown): number {
  if (rawValue === null || rawValue === undefined) return 0;
  if (typeof rawValue === 'number') {
    if (!Number.isFinite(rawValue)) return 0;
    return Object.is(rawValue, -0) ? 0 : rawValue;
  }
  if (typeof rawValue === 'boolean') return 0;

  const trimmed = String(rawValue)
    .replace(/[\u00A0\u202F\u2007\u200B-\u200D\uFEFF\t\r\n]+/g, ' ')
    .trim();

  if (
    !trimmed ||
    /^[-–—]+$/.test(trimmed) ||
    /^(?:#?n\/?a|#?n\/?d|#div\/0!|#value!|#ref!|#name\?|#num!|#null!|#error!|null|undefined|nan)$/i.test(trimmed)
  ) {
    return 0;
  }

  // Si tiene formato anglosajón inequívoco con coma de miles y punto decimal (ej. "8,000.00", "7,575.10", "-1,250.50")
  const strippedQuick = trimmed
    .replace(/(?:^|[\s(])(?:US\$|USD|VES|EUR|BS\.?\s*[SD]?|BS\.?)(?=[\s\d+\-(]|$)/gi, ' ')
    .replace(/[$€£%\s]/g, '');

  if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(strippedQuick)) {
    const num = Number(strippedQuick.replace(/,/g, ''));
    return Number.isFinite(num) ? (Object.is(num, -0) ? 0 : num) : 0;
  }

  // Delegar resto de formatos (hispanos, contables "(150,00)", negativos "-56.60", "-1.90%", "0.95", etc.) al motor puro
  const parsed = parseSafeNumber(trimmed, { fallback: 0, allowThreeDecimals: false });
  return Number.isFinite(parsed) ? (Object.is(parsed, -0) ? 0 : parsed) : 0;
}

/**
 * 1.2 Normalización canónica de nombres de vendedores (`normalizeSellerKey`):
 * Mayúsculas, `.trim()`, sin tildes/diacríticos mediante `normalize('NFD')`,
 * consistencia en `Ñ` y colapso de espacios múltiples a uno solo.
 */
export function normalizeSellerKey(raw: unknown): string {
  return normalizeVendorKey(raw);
}

/**
 * Limpia `CODIGO` / `Id Cliente` como string alfanumérico sin espacios, `#` ni `.0` residuales.
 */
export function cleanClientCode(raw: unknown): { rawClean: string; canonical: string } {
  if (raw === null || raw === undefined) return { rawClean: '', canonical: '' };
  let cleaned = sanitizeSheetText(raw).replace(/^[#\s]+/, '').trim();
  // Eliminar sufijos decimales residuales ".0", ".00" producidos por celdas numéricas de Excel/Sheets
  if (/^\d+\.0+$/.test(cleaned)) {
    cleaned = cleaned.replace(/\.0+$/, '');
  }
  // Conservar únicamente caracteres alfanuméricos / guiones seguros si viene ruido de puntuación en extremos
  cleaned = cleaned.replace(/\s+/g, '');
  if (!cleaned) return { rawClean: '', canonical: '' };
  const canonical = cleaned.replace(/^0+/, '') || '0';
  return { rawClean: cleaned, canonical };
}

/**
 * Consolida un nombre de vendedor o sub-bloque de ruta/zona/sufijo numérico
 * (ej. `MIKELANGELO DIAZ1`, `J PABLO ARAUJO - ...`, `OSCAR ORTIZ- CORO`, `OSCAR ORTIZ- LA COSTA`)
 * contra el registro maestro en `Usuarios` (`A1:D`) y `VENDOR_PROFILES` sin perder ni duplicar datos.
 */
export function consolidateSellerToMasterKey(
  rawSellerName: unknown,
  usuariosMaster: SellerMasterRecord[] = []
): string {
  const baseKey = normalizeSellerKey(rawSellerName);
  if (!baseKey) return '';

  // 1. Verificar coincidencia exacta o por perfil maestro conocido (rutas múltiples del mismo vendedor)
  const routeCanonical = resolveCanonicalRouteKey(baseKey);

  // Buscar primero en el maestro de la hoja `Usuarios` si se proporcionó
  if (usuariosMaster.length > 0) {
    const normalizedUsers = usuariosMaster
      .map((u) => ({
        userKey: normalizeSellerKey(u.usuario),
        vendorIdKey: normalizeSellerKey(u.vendorId),
        rol: normalizeSellerKey(u.rol)
      }))
      .filter((u) => Boolean(u.userKey) && u.rol !== 'ADMIN');

    // Coincidencia exacta por nombre de usuario o vendorId
    for (const u of normalizedUsers) {
      if (u.userKey === baseKey || u.userKey === routeCanonical || (u.vendorIdKey && u.vendorIdKey === baseKey)) {
        return u.userKey;
      }
    }

    // Coincidencia por prefijo de ruta subdividida (ej. "OSCAR ORTIZ - CORO" o "OSCAR ORTIZ - LA COSTA" -> "OSCAR ORTIZ",
    // "J PABLO ARAUJO - ZONA SUR" -> "J PABLO ARAUJO", "MIKELANGELO DIAZ - VILLA DEL ROS" -> "MIKELANGELO DIAZ")
    const prefixBase = baseKey.split(' - ')[0].trim();
    for (const u of normalizedUsers) {
      if (u.userKey === prefixBase || baseKey.startsWith(`${u.userKey} - `) || baseKey.startsWith(`${u.userKey} `)) {
        return u.userKey;
      }
    }
  }

  // 2. Fallback determinista contra perfiles maestros del catálogo (`VENDOR_PROFILES`)
  for (const prof of Object.values(VENDOR_PROFILES)) {
    const profKey = normalizeSellerKey(prof.canonicalUsername);
    const allAliases = [
      prof.canonicalUsername,
      prof.displayName,
      ...prof.routes.flatMap((r) => [r.id, r.label, ...r.aliases])
    ];
    if (matchesVendorAlias(allAliases, baseKey) || matchesVendorAlias(allAliases, routeCanonical)) {
      return profKey;
    }
  }

  // 3. Si trae subdivisión de zona (`NOMBRE VENDEDOR - SUBZONA`), consolidar por prefijo base salvo Cuentas Claves
  if (baseKey.includes(' - ') && !baseKey.startsWith('CUENTAS CLAVE')) {
    const prefix = baseKey.split(' - ')[0].trim();
    if (prefix.length >= 4) {
      return prefix;
    }
  }

  return routeCanonical || baseKey;
}

/**
 * Normaliza un encabezado de columna a snake_case ASCII sin tildes.
 */
function normColHeader(raw: unknown): string {
  return sanitizeSheetText(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Forward-fill horizontal de la Fila 1 en `Volumen por SKU` (`A1:CN`) para propagar
 * el nombre del vendedor sobre sus 3 columnas correspondientes (celdas combinadas).
 */
export function forwardFillMergedHeaderRow(
  row1: unknown[],
  row2: unknown[] = [],
  merges: SheetMergeRange[] = []
): string[] {
  const maxMergeEnd = merges.reduce((max, m) => (m && m.s?.r <= 0 && m.e?.r >= 0 ? Math.max(max, m.e.c + 1) : max), 0);
  const totalCols = Math.max(row1.length, row2.length, maxMergeEnd);
  const filled: string[] = new Array(totalCols).fill('');

  // 1. Aplicar spans explícitos de !merges en Fila 0 si existen
  const mergedCols = new Set<number>();
  for (const m of merges) {
    if (m && m.s && m.e && m.s.r <= 0 && m.e.r >= 0 && m.e.c >= m.s.c) {
      const anchor = sanitizeSheetText(row1[m.s.c]);
      if (anchor) {
        for (let c = m.s.c; c <= m.e.c && c < totalCols; c++) {
          filled[c] = anchor;
          mergedCols.add(c);
        }
      }
    }
  }

  // 2. Forward-fill horizontal en bloques de 3 columnas para respuestas de Google Sheets API
  //    donde no vienen `!merges` y solo aparece el vendedor en la primera celda del triplete.
  let activeVendor = '';
  let remainingTriplet = 0;

  for (let c = 0; c < totalCols; c++) {
    if (mergedCols.has(c)) {
      activeVendor = filled[c];
      remainingTriplet = 0;
      continue;
    }

    const rawCell = sanitizeSheetText(row1[c]);
    if (rawCell) {
      filled[c] = rawCell;
      activeVendor = rawCell;
      remainingTriplet = 2; // propagar a las 2 columnas siguientes del triplete (Cuota, Kg, %)
    } else if (activeVendor && remainingTriplet > 0) {
      const subNorm = normColHeader(row2[c]);
      const isDataSubheader =
        row2.length === 0 ||
        subNorm === '' ||
        subNorm === 'cuota' ||
        subNorm === 'cuota_kg' ||
        subNorm === 'meta' ||
        subNorm === 'meta_kg' ||
        subNorm === 'kg' ||
        subNorm === 'venta_kg' ||
        subNorm === 'venta' ||
        subNorm === 'ejecutado' ||
        subNorm === 'ejecutado_kg' ||
        sanitizeSheetText(row2[c]) === '%' ||
        subNorm === 'pct' ||
        subNorm === 'porcentaje' ||
        subNorm === 'cumplimiento';
      if (isDataSubheader) {
        filled[c] = activeVendor;
        remainingTriplet--;
      } else {
        activeVendor = '';
        remainingTriplet = 0;
      }
    }
  }

  return filled;
}

/**
 * 1.3.1 Parser de `Grid de Activación por Vendedor` (`A1:L`):
 * - Doble fila de encabezado (Fila 1 agrupadores, Fila 2 columnas reales con `.trim()`).
 * - Asocia cada columna `Activados` con su categoría inmediatamente anterior (`col - 1`).
 * - Lee estrictamente desde la Fila 3 (índice 2) en adelante.
 */
export function parseGridActivacionRange(
  rows: unknown[][],
  usuariosMaster: SellerMasterRecord[] = []
): GridActivacionSellerRow[] {
  if (!Array.isArray(rows) || rows.length < 3) return [];

  const row1 = rows[0] || [];
  const row2 = rows[1] || [];
  const maxCols = Math.max(row1.length, row2.length);

  let vendorCol = 0;
  let carteraCol = 1;
  const categoryPairs: Array<{ category: string; metaCol: number; activadosCol: number }> = [];

  for (let c = 0; c < maxCols; c++) {
    const h2Trim = sanitizeSheetText(row2[c]);
    const h2Norm = normColHeader(h2Trim);
    if (h2Norm === 'vendedor' || h2Norm === 'ruta' || h2Norm === 'ejecutivo') {
      vendorCol = c;
    } else if (h2Norm === 'cartera' || h2Norm === 'clientes') {
      carteraCol = c;
    } else if (h2Norm === 'activados' || h2Norm === 'activado') {
      const metaCol = c - 1;
      if (metaCol >= 0) {
        // Priorizar agrupador real de Fila 1 si existe; si no, extraer de Fila 2 ("Meta Aceite " -> "ACEITE")
        const topLabel = sanitizeSheetText(row1[metaCol]);
        const metaLabelRaw = sanitizeSheetText(row2[metaCol]);
        const derivedLabel = topLabel || metaLabelRaw.replace(/^meta\s+/i, '').trim() || `CAT_${metaCol}`;
        categoryPairs.push({
          category: derivedLabel.toUpperCase(),
          metaCol,
          activadosCol: c
        });
      }
    }
  }

  const results: GridActivacionSellerRow[] = [];
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((cell) => cell === null || cell === undefined || sanitizeSheetText(cell) === '')) {
      continue;
    }
    const sellerRaw = sanitizeSheetText(row[vendorCol]);
    if (!sellerRaw || isSummaryOrHeaderLabel(sellerRaw, ['VENDEDOR', 'RUTA', 'EJECUTIVO'])) continue;

    const sellerKey = normalizeSellerKey(sellerRaw);
    if (SUPERVISOR_SUMMARY_COLUMNS.has(sellerKey)) continue;

    const masterSellerKey = consolidateSellerToMasterKey(sellerRaw, usuariosMaster);
    const cartera = Math.max(0, Math.round(parseSheetNumber(row[carteraCol])));
    const categories: Record<string, { meta: number; activados: number }> = {};

    for (const pair of categoryPairs) {
      categories[pair.category] = {
        meta: Math.max(0, Math.round(parseSheetNumber(row[pair.metaCol]))),
        activados: Math.max(0, Math.round(parseSheetNumber(row[pair.activadosCol])))
      };
    }

    results.push({
      sellerRaw,
      sellerKey,
      masterSellerKey,
      cartera,
      categories
    });
  }

  return results;
}

/**
 * 1.3.2 Parser de `Volumen por SKU` (`A1:CN`):
 * - Forward-fill horizontal de Fila 1 para asignar las 3 columnas de cada celda combinada a su vendedor.
 * - Soporta variaciones `CUOTA` / `CUOTA KG`, `KG` / `VENTA KG` y `%` (validando/recalculando `(ventaKg / cuotaKg) * 100`).
 * - Lee SKUs estrictamente desde la Fila 3 (`Cod` en Col A, `Articulo` en Col B).
 */
export function parseVolumenSkuRange(
  rows: unknown[][],
  usuariosMaster: SellerMasterRecord[] = [],
  merges: SheetMergeRange[] = []
): VolumenSkuParsedRow[] {
  if (!Array.isArray(rows) || rows.length < 3) return [];

  const row1 = rows[0] || [];
  const row2 = rows[1] || [];
  const filledRow1 = forwardFillMergedHeaderRow(row1, row2, merges);

  // Agrupar columnas contiguas que comparten el mismo nombre de vendedor propagado
  interface SellerTripletBlock {
    sellerRaw: string;
    routeKey: string;
    masterSellerKey: string;
    cuotaCol: number;
    ventaCol: number;
    pctCol: number;
  }

  const blocks: SellerTripletBlock[] = [];
  let c = 2; // Col A (0) = Cod, Col B (1) = Articulo
  while (c < filledRow1.length) {
    const sellerRaw = filledRow1[c];
    if (!sellerRaw) {
      c++;
      continue;
    }

    let endC = c + 1;
    while (endC < filledRow1.length && filledRow1[endC] === sellerRaw) {
      endC++;
    }

    const routeKey = normalizeSellerKey(sellerRaw);
    if (!SUPERVISOR_SUMMARY_COLUMNS.has(routeKey) && !isSummaryOrHeaderLabel(sellerRaw)) {
      let cuotaCol = c;
      let ventaCol = c + 1 < endC ? c + 1 : c;
      let pctCol = c + 2 < endC ? c + 2 : -1;

      for (let subC = c; subC < endC; subC++) {
        const subTrim = sanitizeSheetText(row2[subC]);
        const subNorm = normColHeader(subTrim);
        if (subNorm === 'cuota' || subNorm === 'cuota_kg' || subNorm === 'meta' || subNorm === 'meta_kg') {
          cuotaCol = subC;
        } else if (
          subNorm === 'kg' ||
          subNorm === 'venta_kg' ||
          subNorm === 'venta' ||
          subNorm === 'ejecutado' ||
          subNorm === 'ejecutado_kg'
        ) {
          ventaCol = subC;
        } else if (subTrim === '%' || subNorm === 'pct' || subNorm === 'porcentaje' || subNorm === 'cumplimiento') {
          pctCol = subC;
        }
      }

      blocks.push({
        sellerRaw,
        routeKey,
        masterSellerKey: consolidateSellerToMasterKey(sellerRaw, usuariosMaster),
        cuotaCol,
        ventaCol,
        pctCol
      });
    }

    c = endC;
  }

  const out: VolumenSkuParsedRow[] = [];
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((cell) => cell === null || cell === undefined || sanitizeSheetText(cell) === '')) {
      continue;
    }

    const sku = cleanClientCode(row[0]).rawClean || sanitizeSheetText(row[0]);
    const articulo = sanitizeSheetText(row[1]);
    if (!sku || isSummaryOrHeaderLabel(sku, ['COD', 'CODIGO', 'SKU']) || isSummaryOrHeaderLabel(articulo, ['ARTICULO', 'PRODUCTO'])) {
      continue;
    }

    for (const blk of blocks) {
      const cuotaKg = roundToDecimals(parseSheetNumber(row[blk.cuotaCol]), 2);
      const ventaKg = roundToDecimals(parseSheetNumber(row[blk.ventaCol]), 2);
      if (cuotaKg === 0 && ventaKg === 0) continue;

      let porcentaje: number;
      if (cuotaKg > 0) {
        // Validar/recalcular (ventaKg / cuotaKg) * 100 para evitar desajustes visuales
        porcentaje = roundToDecimals((ventaKg / cuotaKg) * 100, 2);
      } else if (blk.pctCol >= 0) {
        const rawPctCell = row[blk.pctCol];
        if (typeof rawPctCell === 'number' && Number.isFinite(rawPctCell)) {
          porcentaje = roundToDecimals(Math.abs(rawPctCell) <= 2 ? rawPctCell * 100 : rawPctCell, 2);
        } else {
          porcentaje = roundToDecimals(parseSheetNumber(rawPctCell), 2);
        }
      } else {
        porcentaje = 0;
      }

      out.push({
        sellerRaw: blk.sellerRaw,
        routeKey: blk.routeKey,
        masterSellerKey: blk.masterSellerKey,
        sku,
        articulo,
        cuotaKg,
        ventaKg,
        porcentaje
      });
    }
  }

  return out;
}

/**
 * 1.3.3 Cruce de `Activación por Cliente` (`A1:H`) con hojas de cajas (`pollo`, `jamon asturias`, `leche`, `Azucar`, `Enteros Ligeros`).
 */
export function parseActivacionClientesAndCajas(params: {
  clientesRows: unknown[][];
  boxSheets: Record<string, unknown[][]>;
  usuariosMaster?: SellerMasterRecord[];
}): ClienteActivacionCajasRow[] {
  const { clientesRows, boxSheets, usuariosMaster = [] } = params;
  if (!Array.isArray(clientesRows) || clientesRows.length < 2) return [];

  // Mapear cajas decimales exactas por hoja y código canónico de cliente
  const boxesByCategory = new Map<string, Map<string, number>>();
  for (const [catName, rows] of Object.entries(boxSheets)) {
    const catMap = new Map<string, number>();
    if (Array.isArray(rows) && rows.length > 1) {
      const headers = (rows[0] || []).map(normColHeader);
      const codeIdx = Math.max(0, headers.findIndex((h) => ['id_cliente', 'codigo', 'cod_cliente', 'cod', 'id'].includes(h)));
      const boxesIdx = (() => {
        const idx = headers.findIndex((h) => ['cajas', 'cantidad', 'bultos', 'compra'].includes(h));
        return idx >= 0 ? idx : 2;
      })();

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const { canonical } = cleanClientCode(row[codeIdx]);
        if (!canonical || isSummaryOrHeaderLabel(canonical, ['ID CLIENTE', 'CODIGO'])) continue;
        const boxes = roundToDecimals(parseSheetNumber(row[boxesIdx]), 2);
        if (boxes === 0) continue;
        catMap.set(canonical, sumDecimalExact([catMap.get(canonical) || 0, boxes], 2));
      }
    }
    boxesByCategory.set(catName, catMap);
  }

  const header = (clientesRows[0] || []).map(normColHeader);
  const codeCol = Math.max(0, header.findIndex((h) => ['codigo', 'id_cliente', 'cod'].includes(h)));
  const nameCol = (() => {
    const idx = header.findIndex((h) => ['razon_social', 'cliente', 'nombre'].includes(h));
    return idx >= 0 ? idx : 1;
  })();
  const vendorCol = (() => {
    const idx = header.findIndex((h) => ['vendedor', 'ruta', 'ejecutivo'].includes(h));
    return idx >= 0 ? idx : 2;
  })();

  const seen = new Set<string>();
  const results: ClienteActivacionCajasRow[] = [];

  for (let r = 1; r < clientesRows.length; r++) {
    const row = clientesRows[r];
    if (!row) continue;
    const { rawClean, canonical } = cleanClientCode(row[codeCol]);
    const vendedorRaw = sanitizeSheetText(row[vendorCol]);
    if (!canonical || !vendedorRaw || isSummaryOrHeaderLabel(rawClean, ['CODIGO', 'ID CLIENTE'])) continue;
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    const cajas: Record<string, number> = {};
    let totalBoxes = 0;
    for (const [catName, catMap] of boxesByCategory.entries()) {
      const val = catMap.get(canonical) || 0;
      cajas[catName] = val;
      totalBoxes = sumDecimalExact([totalBoxes, val], 2);
    }

    results.push({
      codigo: rawClean,
      codigoCanonico: canonical,
      razonSocial: sanitizeSheetText(row[nameCol]),
      vendedorRaw,
      masterSellerKey: consolidateSellerToMasterKey(vendedorRaw, usuariosMaster),
      cajas,
      activo: totalBoxes > 0
    });
  }

  return results;
}

/**
 * Serialización JSON determinista con claves recursivamente ordenadas para hashing SHA-256 exacto.
 */
export function stableNumericStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '0';
    return String(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableNumericStringify(item)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableNumericStringify(obj[k])}`).join(',')}}`;
}

export function computeNumericSha256(numericPayload: unknown): string {
  return crypto.createHash('sha256').update(stableNumericStringify(numericPayload)).digest('hex');
}

export interface ParsedDataForHashInput {
  metasApiRows: Array<{
    vendedorId: string;
    vendedorKey?: string;
    categoria: string;
    cartera: number;
    meta: number;
    activados: number;
  }>;
  volumenApiRows: Array<{
    vendedorId: string;
    vendedorKey?: string;
    sku?: string;
    skuId?: string;
    meta: number;
    metaKg?: number;
    ejecutado: number;
    ejecutadoKg?: number;
    ventaNetaKg?: number;
    porcentajeCumplimiento?: number | null;
  }>;
  activacionApiRows: Array<{
    id: string;
    vendedorId: string;
    vendedorKey?: string;
    status: 'ACTIVO' | 'INACTIVO' | string;
    cats?: Record<string, any>;
    cajas?: Record<string, any>;
  }>;
  usuariosRows?: SellerMasterRecord[];
}

interface PerSellerNumericBucket {
  grid: Array<{ categoria: string; cartera: number; meta: number; activados: number }>;
  volumen: Array<{ routeKey: string; sku: string; metaKg: number; ventaKg: number; pct: number }>;
  clientes: Array<{ code: string; activo: number; cajas: Record<string, number> }>;
}

/**
 * PARTE 2: Detector exacto de cambios numéricos por vendedor (`SHA-256` + `sellerSyncState`).
 * - En carga inicial tras reinicio de Render: guarda `version = 1` SIN emitir notificación.
 * - Solo emite evento cuando `newNumericHash !== prevNumericHash` sobre las métricas numéricas de ese vendedor.
 * - Ediciones de texto irrelevantes o cambios en otros vendedores jamás disparan notificaciones falsas.
 */
export class SellerNumericSyncTracker {
  private readonly sellerSyncState = new Map<string, SellerSyncStateEntry>();
  private readonly nowFn: () => number;

  constructor(nowFn: () => number = () => Date.now()) {
    this.nowFn = nowFn;
  }

  private resolveBucketKeysForRow(rawVendor: string, usuariosMaster: SellerMasterRecord[]): string[] {
    const keys = new Set<string>();
    const routeKey = normalizeSellerKey(rawVendor);
    const masterKey = consolidateSellerToMasterKey(rawVendor, usuariosMaster);
    if (routeKey) keys.add(routeKey);
    if (masterKey) keys.add(masterKey);

    // Asociar también a su supervisor (si pertenece a alguno) y al agregado global ADMIN
    for (const sup of Object.values(SUPERVISOR_PROFILES)) {
      const supVendors = sup.supervisedVendors.map((v) => normalizeSellerKey(v));
      if (supVendors.includes(masterKey) || supVendors.includes(routeKey)) {
        keys.add(`SUPERVISOR:${normalizeSellerKey(sup.canonicalUsername)}`);
      }
    }
    keys.add('ADMIN');
    return Array.from(keys);
  }

  private getOrCreateBucket(map: Map<string, PerSellerNumericBucket>, key: string): PerSellerNumericBucket {
    let bucket = map.get(key);
    if (!bucket) {
      bucket = { grid: [], volumen: [], clientes: [] };
      map.set(key, bucket);
    }
    return bucket;
  }

  /**
   * Igual que `applyParsedWorkbook`, pero devuelve por separado los vendedores inicializados por
   * primera vez (`initialized`, versión 1 silenciosa sin toast) y los que tuvieron cambio numérico real (`changed`).
   */
  applyParsedWorkbookDetailed(parsed: ParsedDataForHashInput): {
    initialized: SellerNumericChangeEvent[];
    changed: SellerNumericChangeEvent[];
  } {
    const usuariosMaster = parsed.usuariosRows || [];
    const buckets = new Map<string, PerSellerNumericBucket>();

    // 1. Métricas numéricas del Grid de Activación por Vendedor
    for (const m of parsed.metasApiRows || []) {
      const targetKeys = this.resolveBucketKeysForRow(m.vendedorKey || m.vendedorId, usuariosMaster);
      const item = {
        categoria: sanitizeSheetText(m.categoria).toUpperCase(),
        cartera: Math.round(parseSheetNumber(m.cartera)),
        meta: Math.round(parseSheetNumber(m.meta)),
        activados: Math.round(parseSheetNumber(m.activados))
      };
      for (const key of targetKeys) {
        this.getOrCreateBucket(buckets, key).grid.push(item);
      }
    }

    // 2. Métricas numéricas de Volumen por SKU
    for (const v of parsed.volumenApiRows || []) {
      const routeKey = normalizeSellerKey(v.vendedorKey || v.vendedorId);
      const targetKeys = this.resolveBucketKeysForRow(v.vendedorKey || v.vendedorId, usuariosMaster);
      const metaKg = roundToDecimals(parseSheetNumber(v.metaKg ?? v.meta), 2);
      const ventaKg = roundToDecimals(parseSheetNumber(v.ventaNetaKg ?? v.ejecutadoKg ?? v.ejecutado), 2);
      const pct =
        metaKg > 0
          ? roundToDecimals((ventaKg / metaKg) * 100, 2)
          : roundToDecimals(parseSheetNumber(v.porcentajeCumplimiento ?? 0), 2);

      const item = {
        routeKey,
        sku: cleanClientCode(v.skuId || v.sku).rawClean || sanitizeSheetText(v.skuId || v.sku),
        metaKg,
        ventaKg,
        pct
      };
      for (const key of targetKeys) {
        this.getOrCreateBucket(buckets, key).volumen.push(item);
      }
    }

    // 3. Métricas numéricas de Activación por Cliente y Cajas
    for (const c of parsed.activacionApiRows || []) {
      const targetKeys = this.resolveBucketKeysForRow(c.vendedorKey || c.vendedorId, usuariosMaster);
      const code = cleanClientCode(c.id).canonical;
      if (!code) continue;

      const cajasClean: Record<string, number> = {};
      if (c.cajas && typeof c.cajas === 'object') {
        for (const catKey of Object.keys(c.cajas).sort()) {
          const val = roundToDecimals(parseSheetNumber(c.cajas[catKey]), 2);
          if (val !== 0) {
            cajasClean[catKey] = val;
          }
        }
      }

      const activeFlagsCount =
        c.cats && typeof c.cats === 'object'
          ? Object.values(c.cats).filter((v) => v === true || (typeof v === 'number' && v > 0)).length
          : 0;

      const item = {
        code,
        activo: c.status === 'ACTIVO' || activeFlagsCount > 0 ? 1 : 0,
        cajas: cajasClean
      };
      for (const key of targetKeys) {
        this.getOrCreateBucket(buckets, key).clientes.push(item);
      }
    }

    const now = this.nowFn();
    const initialized: SellerNumericChangeEvent[] = [];
    const changed: SellerNumericChangeEvent[] = [];

    for (const [sellerKey, bucket] of buckets.entries()) {
      // Ordenar determinísticamente cada arreglo antes de calcular SHA-256
      bucket.grid.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.meta - b.meta || a.activados - b.activados);
      bucket.volumen.sort(
        (a, b) => a.routeKey.localeCompare(b.routeKey) || a.sku.localeCompare(b.sku) || a.metaKg - b.metaKg
      );
      bucket.clientes.sort((a, b) => a.code.localeCompare(b.code) || a.activo - b.activo);

      const newHash = computeNumericSha256(bucket);
      const prev = this.sellerSyncState.get(sellerKey);

      if (!prev) {
        // Carga inicial tras reinicio de Render: registrar versión 1 SIN disparar notificación falsa
        this.sellerSyncState.set(sellerKey, {
          sellerId: sellerKey,
          numericHash: newHash,
          version: 1,
          updatedAt: now
        });
        initialized.push({
          sellerId: sellerKey,
          version: 1,
          updatedAt: now
        });
      } else if (prev.numericHash !== newHash) {
        // Cambio numérico real detectado para este vendedor
        const nextVersion = prev.version + 1;
        this.sellerSyncState.set(sellerKey, {
          sellerId: sellerKey,
          numericHash: newHash,
          version: nextVersion,
          updatedAt: now
        });
        changed.push({
          sellerId: sellerKey,
          version: nextVersion,
          updatedAt: now
        });
      }
    }

    return { initialized, changed };
  }

  /**
   * Procesa el resultado parseado del libro, calcula el hash SHA-256 numérico de cada vendedor,
   * actualiza `sellerSyncState` y devuelve ÚNICAMENTE los vendedores con cambio numérico real
   * (excluyendo la carga inicial tras reinicio del servidor).
   */
  applyParsedWorkbook(parsed: ParsedDataForHashInput): SellerNumericChangeEvent[] {
    return this.applyParsedWorkbookDetailed(parsed).changed;
  }

  /**
   * Consulta el estado ligero `{ sellerId, version, updatedAt }` de un vendedor o perfil.
   */
  getSellerStatus(rawSellerId: string): { sellerId: string; version: number; updatedAt: number } {
    const clean = String(rawSellerId || '').trim();
    const normalized = clean.toUpperCase().startsWith('SUPERVISOR:')
      ? `SUPERVISOR:${normalizeSellerKey(clean.replace(/^SUPERVISOR:/i, ''))}`
      : clean.toUpperCase() === 'ADMIN'
        ? 'ADMIN'
        : normalizeSellerKey(clean);

    const direct = this.sellerSyncState.get(normalized);
    if (direct) {
      return { sellerId: direct.sellerId, version: direct.version, updatedAt: direct.updatedAt };
    }

    const consolidated = consolidateSellerToMasterKey(normalized);
    const masterMatch = this.sellerSyncState.get(consolidated);
    if (masterMatch) {
      return { sellerId: masterMatch.sellerId, version: masterMatch.version, updatedAt: masterMatch.updatedAt };
    }

    return { sellerId: normalized || 'UNKNOWN', version: 0, updatedAt: 0 };
  }

  getStateSize(): number {
    return this.sellerSyncState.size;
  }
}
