/**
 * MOTOR NUMÉRICO PURO Y SANITIZADOR DE DATOS DE GOOGLE SHEETS
 * ----------------------------------------------------------------------------
 * - 100% puro, determinista y sin efectos secundarios globales.
 * - Soporta formatos hispanos ("1.234,56", "1.250", "-56,60"), anglosajones ("1,234.56"),
 *   contables ("(150,00)"), monedas (Bs, $, USD, €), unidades (KG, CJ) y espacios Unicode.
 * - Aritmética en enteros escalados para eliminar deriva flotante IEEE-754.
 * - Trazabilidad estructurada de calidad de datos (DataQualityTracker) para celdas
 *   vacías, errores de fórmula (#N/A, #DIV/0!, #VALUE!, #REF!) y texto inválido.
 */

export type DataQualityIssueKind =
  | 'empty_or_dash'
  | 'sheet_error'
  | 'invalid_text'
  | 'non_finite';

export interface DataQualityIssueSample {
  kind: DataQualityIssueKind;
  raw: string;
  context?: string;
}

export interface DataQualitySnapshot {
  totalParsed: number;
  coercedToFallback: number;
  emptyOrDash: number;
  sheetErrors: number;
  invalidText: number;
  nonFinite: number;
  samples: DataQualityIssueSample[];
}

export class DataQualityTracker {
  private totalParsed = 0;
  private coercedToFallback = 0;
  private emptyOrDash = 0;
  private sheetErrors = 0;
  private invalidText = 0;
  private nonFinite = 0;
  private samples: DataQualityIssueSample[] = [];
  private readonly maxSamples: number;

  constructor(maxSamples = 50) {
    this.maxSamples = Math.max(0, maxSamples);
  }

  recordParsed(): void {
    this.totalParsed++;
  }

  recordIssue(kind: DataQualityIssueKind, raw: unknown, context?: string): void {
    this.coercedToFallback++;
    switch (kind) {
      case 'empty_or_dash':
        this.emptyOrDash++;
        break;
      case 'sheet_error':
        this.sheetErrors++;
        break;
      case 'invalid_text':
        this.invalidText++;
        break;
      case 'non_finite':
        this.nonFinite++;
        break;
    }

    if (kind !== 'empty_or_dash' && this.samples.length < this.maxSamples) {
      const rawText = raw === null || raw === undefined ? String(raw) : String(raw).slice(0, 80);
      this.samples.push({ kind, raw: rawText, ...(context ? { context } : {}) });
    }
  }

  snapshot(): DataQualitySnapshot {
    return {
      totalParsed: this.totalParsed,
      coercedToFallback: this.coercedToFallback,
      emptyOrDash: this.emptyOrDash,
      sheetErrors: this.sheetErrors,
      invalidText: this.invalidText,
      nonFinite: this.nonFinite,
      samples: this.samples.slice()
    };
  }

  reset(): void {
    this.totalParsed = 0;
    this.coercedToFallback = 0;
    this.emptyOrDash = 0;
    this.sheetErrors = 0;
    this.invalidText = 0;
    this.nonFinite = 0;
    this.samples = [];
  }
}

export interface ParseSafeNumberOptions {
  fallback?: number;
  localeHint?: 'auto' | 'es' | 'en';
  /** Permite interpretar strings con un único punto y 3 decimales ("36.425") como decimal (ej. tasas BCV o ratios). */
  allowThreeDecimals?: boolean;
  tracker?: DataQualityTracker;
  context?: string;
}

export interface ParseSafePercentageOptions {
  /**
   * - `auto`: detecta `%` explícito, usa `referenceRatio` si está disponible, o aplica umbral seguro (`|n| <= 2` -> ratio 0-1, `|n| > 2` -> 0-100).
   * - `ratio_0_1`: multiplica números sin `%` por 100 (formato interno Excel/Sheets).
   * - `percent_0_100`: conserva valores numéricos directamente en escala 0-100.
   */
  scale?: 'auto' | 'ratio_0_1' | 'percent_0_100';
  /** Ratio esperado (`ejecutado / meta`) para desambiguar celdas sin `%` ni formato de porcentaje (ej. 48.95 = 4895% vs 85.5 = 85.5%). */
  referenceRatio?: number;
  decimals?: number;
  tracker?: DataQualityTracker;
  context?: string;
}

const UNICODE_WS_RE = /[\u00A0\u202F\u2007\u200B-\u200D\uFEFF\t\r\n]+/g;
const DASH_ONLY_RE = /^[-–—]+$/;
const SHEET_ERROR_RE =
  /^(?:#?n\/?a|#?n\/?d|#div\/0!|#value!|#ref!|#name\?|#num!|#null!|#error!|null|undefined|nan|infinity|-infinity)$/i;
const EMPTY_LABEL_RE = /^(?:sin\s*dato|s\/d|none)$/i;

function cleanNumericWhitespace(raw: string): string {
  return raw.replace(UNICODE_WS_RE, ' ').trim();
}

export function isSheetErrorMarker(raw: unknown): boolean {
  if (typeof raw === 'number') return !Number.isFinite(raw);
  if (raw === null || raw === undefined) return false;
  const s = cleanNumericWhitespace(String(raw));
  if (!s) return false;
  return SHEET_ERROR_RE.test(s);
}

export function isBlankOrDashMarker(raw: unknown): boolean {
  if (raw === null || raw === undefined) return true;
  const s = cleanNumericWhitespace(String(raw));
  if (!s) return true;
  return DASH_ONLY_RE.test(s) || EMPTY_LABEL_RE.test(s);
}

function stripCurrencyAndUnits(raw: string): string {
  return raw
    // Prefijos de moneda (ej. "Bs. 48.742,49", "Bs.S 100", "US$ 12", "USD 320,50")
    .replace(/(?:^|[\s(])(?:US\$|USD|VES|EUR|BS\.?\s*[SD]?|BS\.?)(?=[\s\d+\-(]|$)/gi, ' ')
    // Sufijos de moneda/unidad al final o antes de cierre de paréntesis (ej. "1.250 KG", "25 CJ", "100 Bs.")
    .replace(/(?:[\d\s)])(?:KGS?|CAJAS?|CJ|UNDS?|BULTOS?|BLT|USD|VES|EUR|BS\.?\s*[SD]?|BS\.?)(?=$|[\s)])/gi, (m) => m[0])
    .replace(/[$€£%]/g, '')
    .replace(/\s+/g, '');
}

/**
 * Verifica si una celda cruda representa un valor numérico reconocible (soporta negativos contables,
 * monedas, unidades y porcentajes; rechaza texto residual arbitrario como "fx" o "texto_invalido").
 */
export function isValidNumericCell(raw: unknown): boolean {
  if (typeof raw === 'number') return Number.isFinite(raw);
  if (raw === null || raw === undefined || typeof raw === 'boolean') return false;
  const s = cleanNumericWhitespace(String(raw));
  if (!s || isBlankOrDashMarker(s) || isSheetErrorMarker(s)) return false;
  if (!/\d/.test(s)) return false;

  let normalized = s;
  if (/^\(.*\)$/.test(normalized)) {
    normalized = normalized.slice(1, -1).trim();
  }
  normalized = stripCurrencyAndUnits(normalized);
  if (normalized.startsWith('-') || normalized.startsWith('+')) {
    normalized = normalized.slice(1);
  }
  return /^\d+(?:[.,]\d+)*$/.test(normalized);
}

/**
 * Parsea cualquier entrada numérica cruda (Excel/Google Sheets/OCR/UI) a un número finito
 * de forma 100% segura sin retornar jamás `NaN` ni `Infinity`.
 */
export function parseSafeNumber(raw: unknown, optionsOrFallback?: ParseSafeNumberOptions | number): number {
  const opts: ParseSafeNumberOptions =
    typeof optionsOrFallback === 'number' ? { fallback: optionsOrFallback } : optionsOrFallback || {};
  const fallback = typeof opts.fallback === 'number' && Number.isFinite(opts.fallback) ? opts.fallback : 0;
  const localeHint = opts.localeHint || 'auto';
  const allowThreeDecimals = Boolean(opts.allowThreeDecimals);
  const tracker = opts.tracker;
  const context = opts.context;

  tracker?.recordParsed();

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      tracker?.recordIssue('non_finite', raw, context);
      return fallback;
    }
    return Object.is(raw, -0) ? 0 : raw;
  }

  if (raw === null || raw === undefined) {
    tracker?.recordIssue('empty_or_dash', raw, context);
    return fallback;
  }

  if (typeof raw === 'boolean') {
    tracker?.recordIssue('invalid_text', raw, context);
    return fallback;
  }

  let s = cleanNumericWhitespace(String(raw));
  if (!s || isBlankOrDashMarker(s)) {
    tracker?.recordIssue('empty_or_dash', raw, context);
    return fallback;
  }

  if (isSheetErrorMarker(s)) {
    tracker?.recordIssue('sheet_error', raw, context);
    return fallback;
  }

  let isNegative = false;
  if (/^\(.*\)$/.test(s)) {
    isNegative = true;
    s = s.slice(1, -1).trim();
  }

  s = stripCurrencyAndUnits(s);

  if (s.startsWith('-')) {
    isNegative = !isNegative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }

  if (!s || DASH_ONLY_RE.test(s)) {
    tracker?.recordIssue('empty_or_dash', raw, context);
    return fallback;
  }

  if (!/^\d+(?:[.,]\d+)*$/.test(s)) {
    tracker?.recordIssue('invalid_text', raw, context);
    return fallback;
  }

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // Formato hispano/europeo: 1.234,56 -> 1234.56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato anglosajón: 1,234.56 -> 1234.56
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const commaCount = (s.match(/,/g) || []).length;
    if (commaCount > 1) {
      // Múltiples comas => separadores de miles anglosajones (1,234,567)
      s = s.replace(/,/g, '');
    } else {
      const [intPart, fracPart] = s.split(',');
      const looksLikeThousands =
        localeHint !== 'es' &&
        !allowThreeDecimals &&
        fracPart.length === 3 &&
        /^[1-9]\d{0,2}$/.test(intPart);
      s = looksLikeThousands ? `${intPart}${fracPart}` : `${intPart}.${fracPart}`;
    }
  } else if (lastDot !== -1) {
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Múltiples puntos => separadores de miles hispanos (1.234.567)
      s = s.replace(/\./g, '');
    } else {
      const [intPart, fracPart] = s.split('.');
      // Regla determinista anti-error 1000x:
      // "1.250" / "8.000" / "120.500" en formato hispano => 1250 / 8000 / 120500,
      // mientras "0.125", "12.50", "1234.56" o allowThreeDecimals=true conservan su decimal.
      const looksLikeHispanicThousands =
        localeHint !== 'en' &&
        !allowThreeDecimals &&
        fracPart.length === 3 &&
        /^[1-9]\d{0,2}$/.test(intPart);
      if (looksLikeHispanicThousands) {
        s = `${intPart}${fracPart}`;
      }
    }
  }

  const parsed = Number(s);
  if (!Number.isFinite(parsed)) {
    tracker?.recordIssue('non_finite', raw, context);
    return fallback;
  }

  const result = isNegative ? -parsed : parsed;
  return Object.is(result, -0) ? 0 : result;
}

/**
 * Redondeo determinista sin deriva IEEE-754 y sin `-0`.
 */
export function roundToDecimals(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const safeDecimals = Math.max(0, Math.min(8, Math.trunc(decimals)));
  const factor = Math.pow(10, safeDecimals);
  const rounded = Math.sign(value) * Math.round((Math.abs(value) + 1e-12) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Estandariza porcentajes provenientes de Google Sheets / Excel distinguiendo con precisión
 * entre textos con `%` explícito, ratios `0–1` de Excel y valores en escala `0–100`.
 */
export function parseSafePercentage(raw: unknown, options: ParseSafePercentageOptions = {}): number | null {
  const { scale = 'auto', referenceRatio, decimals = 4, tracker, context } = options;

  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      tracker?.recordIssue('non_finite', raw, context);
      return null;
    }
    if (raw === 0) return 0;

    if (scale === 'ratio_0_1') {
      return roundToDecimals(raw * 100, decimals);
    }
    if (scale === 'percent_0_100') {
      return roundToDecimals(raw, decimals);
    }

    // Modo 'auto'
    if (referenceRatio !== undefined && Number.isFinite(referenceRatio)) {
      const expectedPct = referenceRatio * 100;
      const errAsRatio = Math.abs(raw * 100 - expectedPct);
      const errAsPercent = Math.abs(raw - expectedPct);
      const chosen = errAsRatio <= errAsPercent ? raw * 100 : raw;
      return roundToDecimals(chosen, decimals);
    }

    // Heurística segura sin referencia externa:
    // valores en [-2, 2] (p.ej. 0.503, 1.057, -0.019) son ratios 0-1 -> x100;
    // valores con |n| > 2 (p.ej. 85.5, 120.4) se mantienen en escala 0-100 evitando corrupción 8550%.
    const scaled = Math.abs(raw) <= 2 ? raw * 100 : raw;
    return roundToDecimals(scaled, decimals);
  }

  const s = cleanNumericWhitespace(String(raw));
  if (!s || isBlankOrDashMarker(s)) {
    tracker?.recordIssue('empty_or_dash', raw, context);
    return null;
  }
  if (isSheetErrorMarker(s)) {
    tracker?.recordIssue('sheet_error', raw, context);
    return null;
  }
  if (!isValidNumericCell(s)) {
    tracker?.recordIssue('invalid_text', raw, context);
    return null;
  }

  const hasExplicitPercent = s.includes('%');
  const numericVal = parseSafeNumber(s, {
    fallback: Number.NaN,
    allowThreeDecimals: true,
    tracker,
    context
  });
  if (!Number.isFinite(numericVal)) return null;

  if (hasExplicitPercent) {
    return roundToDecimals(numericVal, decimals);
  }

  return parseSafePercentage(numericVal, { scale, referenceRatio, decimals });
}

/**
 * Sumatoria exacta mediante enteros escalados (elimina deriva IEEE-754 como 0.1 + 0.2 = 0.30000000000000004
 * e impide concatenaciones accidentales de strings).
 */
export function sumDecimalExact(
  values: Iterable<unknown>,
  decimals = 2,
  parseOptions?: ParseSafeNumberOptions
): number {
  const safeDecimals = Math.max(0, Math.min(6, Math.trunc(decimals)));
  const factor = Math.pow(10, safeDecimals);
  let scaledTotal = 0;

  for (const item of values) {
    const n = typeof item === 'number' && Number.isFinite(item)
      ? item
      : parseSafeNumber(item, parseOptions);
    if (!Number.isFinite(n)) continue;
    scaledTotal += Math.round(n * factor);
  }

  const result = scaledTotal / factor;
  return Object.is(result, -0) ? 0 : result;
}

/**
 * Sumatoria monetaria exacta en centavos (2 decimales).
 */
export function sumMoneyCents(values: Iterable<unknown>, parseOptions?: ParseSafeNumberOptions): number {
  return sumDecimalExact(values, 2, parseOptions);
}

/**
 * Calcula porcentaje de cumplimiento seguro sin división por cero ni `NaN`/`Infinity`.
 */
export function calculateCompliancePct(executed: unknown, goal: unknown, decimals = 1): number {
  const execVal = parseSafeNumber(executed, 0);
  const goalVal = parseSafeNumber(goal, 0);
  if (goalVal <= 0) return 0;
  return roundToDecimals((execVal / goalVal) * 100, decimals);
}

/**
 * Sanitiza cualquier texto proveniente de Google Sheets como dato no confiable:
 * elimina caracteres de control invisibles, normaliza espacios Unicode y nunca evalúa HTML.
 */
export function sanitizeSheetText(
  raw: unknown,
  options: { maxLength?: number; preserveNewlines?: boolean } = {}
): string {
  if (raw === null || raw === undefined) return '';
  const { maxLength, preserveNewlines = false } = options;

  let text = String(raw)
    // Remover caracteres de control peligrosos / invisibles (manteniendo \n si preserveNewlines)
    .replace(preserveNewlines ? /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, ' ')
    // Remover zero-width y BOM
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Normalizar espacios Unicode no separables
    .replace(/[\u00A0\u202F\u2007]/g, ' ');

  if (preserveNewlines) {
    text = text
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .join('\n')
      .trim();
  } else {
    text = text.replace(/\s+/g, ' ').trim();
  }

  if (maxLength && maxLength > 0 && text.length > maxLength) {
    return text.slice(0, maxLength).trim();
  }
  return text;
}
