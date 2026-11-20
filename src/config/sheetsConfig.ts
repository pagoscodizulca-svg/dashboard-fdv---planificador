/**
 * CONFIGURACIÓN CENTRALIZADA DE GOOGLE SHEETS, ALLOWLIST OWASP Y PRODUCTOS FOCO
 * ----------------------------------------------------------------------------
 * - Única fuente de verdad para:
 *   1. Validación estricta de GOOGLE_SHEET_ID, GIDs de pestañas y allowlist de red
 *      restringida exclusivamente a `https://docs.google.com/spreadsheets/` mediante `URL` nativa.
 *   2. Catálogo unificado de productos foco y mapa canónico de alias (derivado de `src/lib/rubros.ts`).
 *   3. Detector centralizado de filas/columnas de resumen (`TOTAL`, `SUBTOTAL`, `PROMEDIO`, encabezados repetidos).
 *   4. Type Guards estrictos para registros emitidos hacia Supabase y Frontend.
 */

import { RUBROS_ACTIVACION, RUBROS_ACTIVOS_CONFIG, type RubroActivoCodigo, type RubroConfig } from '../lib/rubros';
import type { VolumenData } from '../types';
import { sanitizeSheetText } from '../utils/safeNumber';

export const DEFAULT_GOOGLE_SHEET_ID = '';
export const ALLOWED_GOOGLE_SHEETS_ORIGIN = 'https://docs.google.com';
export const ALLOWED_GOOGLE_SHEETS_PATH_PREFIX = '/spreadsheets/';
export const GOOGLE_SHEET_ID_REGEX = /^[a-zA-Z0-9_-]{20,80}$/;
export const GOOGLE_SHEET_GID_REGEX = /^\d{1,15}$/;

export type SheetTabKey =
  | 'grid'
  | 'volumen'
  | 'clientes'
  | 'degustaciones'
  | 'usuarios'
  | 'azucar'
  | 'leche'
  | 'pollo'
  | 'asturias'
  | 'salpicao';

const PLACEHOLDER_ID_RE =
  /(?:PEGA_AQUI|GOOGLE_SHEET_ID|YOUR_SHEET_ID|REPLACE_ME|GID_HOJA|EXAMPLE)/i;

/**
 * Valida con la API nativa `URL` que una URL pertenezca estrictamente al dominio permitido
 * `https://docs.google.com/spreadsheets/` sin path traversal, credenciales ni puertos no estándar.
 */
export function validateGoogleSheetsUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('[SECURITY_ALLOWLIST] URL de Google Sheets vacía o inválida.');
  }
  const trimmed = rawUrl.trim();
  if (/(?:\.\.|%2e%2e|%2f\.\.|\.\.%2f|\\)/i.test(trimmed)) {
    throw new Error('[SECURITY_ALLOWLIST] Path traversal detectado en URL de Google Sheets.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('[SECURITY_ALLOWLIST] URL de Google Sheets malformada.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('[SECURITY_ALLOWLIST] Solo se permite protocolo HTTPS para Google Sheets.');
  }
  if (parsed.hostname.toLowerCase() !== 'docs.google.com') {
    throw new Error('[SECURITY_ALLOWLIST] Dominio fuera de allowlist para Google Sheets.');
  }
  if (parsed.port !== '' || parsed.username !== '' || parsed.password !== '') {
    throw new Error('[SECURITY_ALLOWLIST] URL de Google Sheets con puerto o credenciales embebidas no permitida.');
  }
  if (!parsed.pathname.startsWith(ALLOWED_GOOGLE_SHEETS_PATH_PREFIX)) {
    throw new Error('[SECURITY_ALLOWLIST] Ruta fuera de /spreadsheets/ no permitida.');
  }

  return parsed.toString();
}

/**
 * Sanitiza y valida un GOOGLE_SHEET_ID proveniente de variables de entorno o URL allowlisted.
 * Rechaza placeholders, caracteres peligrosos o URLs fuera de `https://docs.google.com/spreadsheets/`.
 */
export function sanitizeGoogleSheetId(raw?: string | null): string {
  if (!raw) return DEFAULT_GOOGLE_SHEET_ID;
  const cleaned = String(raw).trim().replace(/^['"<]+|['">]+$/g, '').trim();
  if (!cleaned || PLACEHOLDER_ID_RE.test(cleaned)) {
    return DEFAULT_GOOGLE_SHEET_ID;
  }

  if (/^https?:\/\//i.test(cleaned)) {
    try {
      const safeUrl = validateGoogleSheetsUrl(cleaned);
      const parsed = new URL(safeUrl);
      const match = parsed.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,80})(?:\/|$)/);
      return match && match[1] ? match[1] : DEFAULT_GOOGLE_SHEET_ID;
    } catch {
      return DEFAULT_GOOGLE_SHEET_ID;
    }
  }

  const inlineMatch = cleaned.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,80})(?:\/|$)/);
  const candidate = inlineMatch && inlineMatch[1] ? inlineMatch[1] : cleaned;
  return GOOGLE_SHEET_ID_REGEX.test(candidate) ? candidate : DEFAULT_GOOGLE_SHEET_ID;
}

/**
 * Sanitiza un GID numérico de pestaña de Google Sheets (rechaza placeholders o inyecciones).
 */
export function sanitizeGoogleSheetGid(raw?: string | number | null): string {
  if (raw === null || raw === undefined) return '';
  const cleaned = String(raw).trim().replace(/^['"<]+|['">]+$/g, '').trim();
  if (!cleaned || PLACEHOLDER_ID_RE.test(cleaned)) return '';
  return GOOGLE_SHEET_GID_REGEX.test(cleaned) ? cleaned : '';
}

/**
 * Lee GOOGLE_SHEET_ID exclusivamente desde variables de entorno del servidor (nunca hardcodeado).
 */
export function getGoogleSheetId(envOverride?: Record<string, string | undefined>): string {
  const procEnv = typeof process !== 'undefined' && process.env ? process.env : {};
  const raw = envOverride?.GOOGLE_SHEET_ID ?? procEnv.GOOGLE_SHEET_ID ?? '';
  return sanitizeGoogleSheetId(raw);
}

/**
 * Lee los GIDs opcionales parametrizados por pestaña desde variables de entorno del servidor.
 */
export function getConfiguredSheetGids(
  envOverride?: Record<string, string | undefined>
): Record<SheetTabKey, string> {
  const procEnv = typeof process !== 'undefined' && process.env ? process.env : {};
  const read = (key: string) => sanitizeGoogleSheetGid(envOverride?.[key] ?? procEnv[key]);

  return {
    grid: read('GOOGLE_SHEET_GID_GRID'),
    volumen: read('GOOGLE_SHEET_GID_VOLUMEN'),
    clientes: read('GOOGLE_SHEET_GID_CLIENTES'),
    degustaciones: read('GOOGLE_SHEET_GID_DEGUSTACIONES'),
    usuarios: read('GOOGLE_SHEET_GID_USUARIOS'),
    azucar: read('GOOGLE_SHEET_GID_AZUCAR'),
    leche: read('GOOGLE_SHEET_GID_LECHE'),
    pollo: read('GOOGLE_SHEET_GID_POLLO'),
    asturias: read('GOOGLE_SHEET_GID_ASTURIAS'),
    salpicao: read('GOOGLE_SHEET_GID_SALPICAO')
  };
}

/**
 * Construye una URL validada de exportación de Google Sheets verificada contra la allowlist OWASP.
 */
export function buildValidatedGoogleSheetUrl(params: {
  sheetId?: string | null;
  format?: 'xlsx' | 'csv';
  gid?: string | number | null;
  cacheBust?: boolean;
  envOverride?: Record<string, string | undefined>;
}): string {
  const {
    sheetId,
    format = 'xlsx',
    gid,
    cacheBust = true,
    envOverride
  } = params;

  const id = sanitizeGoogleSheetId(sheetId ?? getGoogleSheetId(envOverride));
  if (!id) {
    throw new Error('[SECURITY_ALLOWLIST] GOOGLE_SHEET_ID inválido o ausente.');
  }
  if (format !== 'xlsx' && format !== 'csv') {
    throw new Error('[SECURITY_ALLOWLIST] Formato de exportación de Google Sheets no permitido.');
  }

  const url = new URL(`${ALLOWED_GOOGLE_SHEETS_ORIGIN}/spreadsheets/d/${id}/export`);
  url.searchParams.set('format', format);

  if (gid !== undefined && gid !== null && String(gid).trim() !== '') {
    const cleanGid = sanitizeGoogleSheetGid(gid);
    if (!cleanGid) {
      throw new Error('[SECURITY_ALLOWLIST] Parámetro gid inválido para Google Sheets.');
    }
    url.searchParams.set('gid', cleanGid);
  }

  if (cacheBust) {
    url.searchParams.set('_cb', String(Date.now()));
  }

  return validateGoogleSheetsUrl(url.toString());
}

/**
 * ============================================================================
 * CATÁLOGO ÚNICO DE PRODUCTOS FOCO Y ALIAS (FUENTE ÚNICA DE VERDAD)
 * ============================================================================
 */
export const FOCUS_PRODUCTS_CONFIG: RubroConfig[] = RUBROS_ACTIVOS_CONFIG;
export const FOCUS_PRODUCT_CODES: RubroActivoCodigo[] = RUBROS_ACTIVACION;

/**
 * Mapa canónico de alias históricos y de pestaña por cada uno de los 5 rubros foco activos.
 * Consumido de forma idéntica por ActivacionRubro, ActivacionClientes, googleSheetsService y googleSheetsParser.
 */
export const FOCUS_PRODUCT_ALIASES: Record<RubroActivoCodigo, string[]> = {
  AZUCAR: ['AZUCAR'],
  LECHE_VENCAMPO: ['LECHE_VENCAMPO'],
  POLLO: ['POLLO', 'ARROZ'],
  ESTANDAR_ASTURIAS: ['ESTANDAR_ASTURIAS', 'ENTERO'],
  MORTADELA_SALPICAO: ['MORTADELA_SALPICAO', 'MORTADELA_ASTURIAS', 'SALPICAO', 'LIGEROS']
};

export const GRID_CATEGORY_HEADER_KEYWORDS: Record<
  RubroActivoCodigo,
  { keywords: string[]; fallbackMeta: number; fallbackAct: number }
> = {
  AZUCAR: { keywords: ['azucar'], fallbackMeta: 2, fallbackAct: 3 },
  LECHE_VENCAMPO: { keywords: ['leche_vencampo', 'leche_en_polvo_vencampo', 'leche'], fallbackMeta: 4, fallbackAct: 5 },
  POLLO: { keywords: ['pollo'], fallbackMeta: 6, fallbackAct: 7 },
  ESTANDAR_ASTURIAS: { keywords: ['estandar_y_superior_asturias', 'estandar', 'superior'], fallbackMeta: 8, fallbackAct: 9 },
  MORTADELA_SALPICAO: {
    keywords: ['mortadela_salpicao_y_asturias', 'mortadela_salpicao', 'mortadela', 'salpicao'],
    fallbackMeta: 10,
    fallbackAct: 11
  }
};

/**
 * Determina de forma consistente si un cliente está activado en un rubro foco dado,
 * contemplando tanto el código canónico como sus alias legacy y cajas > 0.
 */
export function isClientActiveForFocusProduct(
  cliente: { cats?: Record<string, unknown>; cajas?: Record<string, unknown> } | null | undefined,
  codigo: RubroActivoCodigo
): boolean {
  if (!cliente) return false;
  const keys = FOCUS_PRODUCT_ALIASES[codigo] || [codigo];
  const cats = cliente.cats || {};
  const cajas = cliente.cajas || {};

  return keys.some((k) => {
    const flag = cats[k];
    const boxes = cajas[k];
    const flagActive = flag === true || flag === 1 || (typeof flag === 'number' && flag > 0);
    const boxesActive = typeof boxes === 'number' && Number.isFinite(boxes) && boxes > 0;
    return flagActive || boxesActive;
  });
}

/**
 * Determina si un cliente posee activación en al menos uno de los 5 rubros foco activos.
 */
export function isClientActiveInAnyFocusProduct(
  cliente: { cats?: Record<string, unknown>; cajas?: Record<string, unknown> } | null | undefined
): boolean {
  return FOCUS_PRODUCT_CODES.some((code) => isClientActiveForFocusProduct(cliente, code));
}

/**
 * ============================================================================
 * DETECTOR DE FILAS / COLUMNAS DE RESUMEN Y ENCABEZADOS REPETIDOS
 * ============================================================================
 */
const SUMMARY_LABEL_PATTERNS: RegExp[] = [
  /^(?:GRAN\s+)?(?:SUB[\s-]?)?TOTAL(?:ES)?(?:\s+(?:GENERAL(?:ES)?|EMPRESA|VENTAS?|KG|CAJAS?|ACTIVADOS?|META|MES|RUTA|ZONA|FDV|EQUIPO|GRUPO|COMERCIAL|GLOBAL|CONSOLIDADO|NETO|BRUTO))?$/,
  /^(?:TOTAL(?:ES)?\s+DE\s+.+)$/,
  /^(?:PROMEDIO|MEDIA|RESUMEN|CONSOLIDADO|SUMATORIA|ACUMULADO)(?:\s+(?:GENERAL|EMPRESA|MENSUAL|TOTAL|DE\s+.+))?$/,
  /^(?:TOTAL\s+)?EMPRESA$/,
  /^GENERAL$/
];

function normalizeSummaryToken(raw: unknown): string {
  return sanitizeSheetText(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[∑Σ:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Identifica si una etiqueta de fila o columna corresponde a un resumen (`TOTAL`, `SUBTOTAL`,
 * `TOTAL GENERAL`, `PROMEDIO`, `RESUMEN`, `CONSOLIDADO`, `TOTAL EMPRESA`) o a un encabezado
 * repetido a mitad de hoja.
 */
export function isSummaryOrHeaderLabel(raw: unknown, extraHeaderTokens: string[] = []): boolean {
  const token = normalizeSummaryToken(raw);
  if (!token) return false;

  if (SUMMARY_LABEL_PATTERNS.some((re) => re.test(token))) {
    return true;
  }

  if (extraHeaderTokens.length > 0) {
    const normalizedExtras = extraHeaderTokens.map(normalizeSummaryToken);
    if (normalizedExtras.includes(token)) {
      return true;
    }
  }

  return false;
}

/**
 * ============================================================================
 * TYPE GUARDS ESTRICTOS PARA REGISTROS DE GOOGLE SHEETS
 * ============================================================================
 */
export function isValidVolumenRecord(rec: unknown): rec is VolumenData {
  if (!rec || typeof rec !== 'object') return false;
  const r = rec as Record<string, unknown>;
  return (
    typeof r.vendedorId === 'string' &&
    r.vendedorId.trim().length > 0 &&
    typeof r.skuId === 'string' &&
    r.skuId.trim().length > 0 &&
    typeof r.meta === 'number' &&
    Number.isFinite(r.meta) &&
    typeof r.ejecutado === 'number' &&
    Number.isFinite(r.ejecutado) &&
    (r.porcentajeCumplimiento === undefined ||
      r.porcentajeCumplimiento === null ||
      (typeof r.porcentajeCumplimiento === 'number' && Number.isFinite(r.porcentajeCumplimiento)))
  );
}

export function isValidMetaRecord(rec: unknown): rec is {
  vendedorId: string;
  vendedorKey: string;
  categoria: string;
  cartera: number;
  meta: number;
  activados: number;
} {
  if (!rec || typeof rec !== 'object') return false;
  const r = rec as Record<string, unknown>;
  return (
    typeof r.vendedorId === 'string' &&
    r.vendedorId.trim().length > 0 &&
    typeof r.vendedorKey === 'string' &&
    r.vendedorKey.trim().length > 0 &&
    typeof r.categoria === 'string' &&
    r.categoria.trim().length > 0 &&
    typeof r.cartera === 'number' &&
    Number.isFinite(r.cartera) &&
    r.cartera >= 0 &&
    typeof r.meta === 'number' &&
    Number.isFinite(r.meta) &&
    r.meta >= 0 &&
    typeof r.activados === 'number' &&
    Number.isFinite(r.activados) &&
    r.activados >= 0
  );
}

export function isValidActivacionRecord(rec: unknown): rec is {
  id: string;
  vendedorId: string;
  cliente: string;
  status: 'ACTIVO' | 'INACTIVO';
  cats: Record<string, boolean>;
  cajas: Record<string, number>;
} {
  if (!rec || typeof rec !== 'object') return false;
  const r = rec as Record<string, unknown>;
  if (
    typeof r.id !== 'string' ||
    r.id.trim().length === 0 ||
    typeof r.vendedorId !== 'string' ||
    r.vendedorId.trim().length === 0 ||
    (r.status !== 'ACTIVO' && r.status !== 'INACTIVO') ||
    !r.cats ||
    typeof r.cats !== 'object' ||
    !r.cajas ||
    typeof r.cajas !== 'object'
  ) {
    return false;
  }

  for (const val of Object.values(r.cajas as Record<string, unknown>)) {
    if (typeof val !== 'number' || !Number.isFinite(val)) return false;
  }
  return true;
}
