/**
 * ============================================================================
 * MOTOR DETERMINISTA Y VALIDADOR ESTRICTO DE ÓRDENES DE COMPRA (OC) ALKOSTO
 * ============================================================================
 *
 * REGLAS DE NEGOCIO Y ESTRUCTURA DEL FORMATO OFICIAL ALKOSTO / FAMILIA CENTER:
 *
 * 1. ESTRUCTURA MULTI-PÁGINA Y MULTI-CADENA:
 *    Un mismo archivo PDF de Orden de Compra de Alkosto (ej. Orden Nro. 0000055165,
 *    0000055175, 0000054877, 0000054461) contiene múltiples páginas por cadena:
 *    - Página 1: "ALKOSTO DONDE COMPRAR ES GANAR, C.A." (Columnas: AK01..AK10, AKOP, CI)
 *                Cierra con "SubTotal ( AK )".
 *    - Página 2: "FAMILIA CENTER, C.A." (Columnas: FC01..FC07)
 *                Cierra con "SubTotal ( FC )".
 *    - Página 3 (opcional): "VECINO CENTER, C.A" (Columnas: VC01..VC03)
 *                Cierra con "SubTotal ( HC )" y "TOTAL FACTURA".
 *
 * 2. ORDEN INTERNO DEL FLUJO DE TEXTO (STREAM) VS ORDEN VISUAL (COORDENADA X):
 *    En los PDFs generados por el ERP de Alkosto ("Licencia de Uso: ALKOSTO DONDE
 *    COMPRAR ES GANAR C.A."), las celdas numéricas de cada renglón tienen dos
 *    representaciones distintas:
 *    a) Orden Visual por Coordenada X (de izquierda a derecha):
 *       - Alkosto (21 celdas):
 *         [IVA, EMP, AK01, AK02, AK03, AK04, AK05, AK06, AK07, AK08, AK09, AK10, AKOP, CI,
 *          TotalCantidad, CostoBruto, %Bonif, %Fact, %PP, CostoUnitario, TotalRenglon]
 *       - Familia Center (16 celdas):
 *         [IVA, EMP, FC01, FC02, FC03, FC04, FC05, FC06, FC07,
 *          TotalCantidad, CostoBruto, %Bonif, %Fact, %PP, CostoUnitario, TotalRenglon]
 *    b) Orden del Stream Secuencial del PDF (cuando se extrae texto plano sin ordenar por X):
 *       - Alkosto (21 celdas):
 *         [IVA, AK01, AK02, AK03, AK04, EMP, AK08, AK09, AK05, AK06, AK07, AK10, AKOP, CI,
 *          TotalCantidad, CostoBruto, %Bonif, %Fact, %PP, CostoUnitario, TotalRenglon]
 *         (Nota: El entero EMP aparece en el índice 5 después de AK04, y AK08/AK09 anteceden a AK05..AK07).
 *       - Familia Center (16 celdas):
 *         [IVA, FC01, FC02, EMP, FC03, FC04, FC05, FC06, FC07,
 *          TotalCantidad, CostoBruto, %Bonif, %Fact, %PP, CostoUnitario, TotalRenglon]
 *         (Nota: El entero EMP aparece en el índice 3 entre FC02 y FC03).
 *
 * 3. SUFIJO DE PRECIO SUGERIDO (/ PVP) EN LA COLUMNA DESCRIPCIÓN:
 *    Las descripciones incluyen al final "/ <número>" (ej. "PECHUGA DE PAVO ASTURIAS X KG / 6.88").
 *    Ese número tras la barra es una referencia interna de PVP de la cadena y NUNCA debe
 *    interpretarse como Costo Unitario ni peso.
 *
 * 4. INVARIANTES MATEMÁTICAS OBLIGATORIAS POR RENGLÓN:
 *    - Invariante 1 (Suma de Tiendas): Sum(Tiendas de la página) == TotalCantidad de la página.
 *    - Invariante 2 (Importe de Renglón): TotalCantidad * CostoUnitario == TotalRenglon (tol. ±0.05).
 *    - Invariante 3 (Subtotal de Página): Sum(TotalRenglon) == SubTotal ( AK | FC | HC ) (tol. ±0.10).
 */

import { ParsedOrdenCompraAlkosto, StrictOrderPayload, StrictOrderRenglon, AlkostoOrder, CodizulcaNotaPedidoItem } from '../types';
import {
  resolverProductoPorCodigoODescripcion,
  normalizarCodigoProducto,
  getSucursalByTag,
  SUCURSALES_ALKOSTO,
  SUCURSALES_FAMILIA_CENTER
} from './alkostoService';

export interface AlkostoValidationIssue {
  field: string;
  message: string;
  renglon?: number;
  severity: 'ERROR' | 'WARNING';
}

export class AlkostoParseValidationError extends Error {
  public readonly code: string;
  public readonly issues: AlkostoValidationIssue[];

  constructor(message: string, issues: AlkostoValidationIssue[] = [], code = 'ALKOSTO_OC_VALIDATION_ERROR') {
    super(message);
    this.name = 'AlkostoParseValidationError';
    this.code = code;
    this.issues = issues;
  }
}

export const ALKOSTO_STORE_TAGS = [
  'AK01', 'AK02', 'AK03', 'AK04', 'AK05', 'AK06', 'AK07', 'AK08', 'AK09', 'AK10', 'AKOP', 'CI'
] as const;

export const FAMILIA_CENTER_STORE_TAGS = [
  'FC01', 'FC02', 'FC03', 'FC04', 'FC05', 'FC06', 'FC07', 'FCOP'
] as const;

export const VECINO_CENTER_STORE_TAGS = [
  'VC01', 'VC02', 'VC03'
] as const;

export const ALL_VALID_STORE_TAGS = new Set<string>([
  ...ALKOSTO_STORE_TAGS,
  ...FAMILIA_CENTER_STORE_TAGS,
  ...VECINO_CENTER_STORE_TAGS
]);

/**
 * Parsea de forma determinista y segura cualquier representación numérica
 * (formato anglosajón "1,200.50", venezolano "1.200,50", 4 decimales "36.0000").
 * Lanza o retorna NaN si no es un número válido cuando strict=true.
 */
export function parseNumeroEstricto(val: unknown, defaultVal = 0): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : defaultVal;
  }
  if (val === null || val === undefined) return defaultVal;
  const raw = String(val).trim();
  if (!raw) return defaultVal;

  const cleaned = raw.replace(/[$BsUSD\s]/gi, '');
  if (!cleaned || !/\d/.test(cleaned)) return defaultVal;

  // Caso 1: Formato venezolano con miles por punto y decimales por coma: 1.250,50 o 12.345.678,90
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    const n = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : defaultVal;
  }

  // Caso 2: Formato internacional con miles por coma y decimales por punto: 1,250.50 o 11,032.25
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    const n = parseFloat(cleaned.replace(/,/g, ''));
    return Number.isFinite(n) ? n : defaultVal;
  }

  // Caso 3: Decimal simple con coma (ej: "210,00" o "36,0000")
  if (/^-?\d+,\d+$/.test(cleaned)) {
    const n = parseFloat(cleaned.replace(',', '.'));
    return Number.isFinite(n) ? n : defaultVal;
  }

  // Caso 4: Ambos separadores presentes en formatos no estándar
  if (cleaned.includes('.') && cleaned.includes(',')) {
    if (cleaned.lastIndexOf('.') < cleaned.lastIndexOf(',')) {
      const n = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : defaultVal;
    } else {
      const n = parseFloat(cleaned.replace(/,/g, ''));
      return Number.isFinite(n) ? n : defaultVal;
    }
  }

  // Caso 5: Número estándar con punto decimal o entero ("20.0000", "767.00", "10")
  const n = parseFloat(cleaned.replace(/,/g, '.'));
  return Number.isFinite(n) ? n : defaultVal;
}

/**
 * Limpia el sufijo "/ <PVP>" que el ERP de Alkosto imprime al final de la descripción
 * (ej. "MORTADELA ESPECIAL DE POLLO 900GR ASTURIAS / 2.40" -> "MORTADELA ESPECIAL DE POLLO 900GR ASTURIAS").
 */
export function limpiarDescripcionAlkosto(desc: string): string {
  if (!desc) return '';
  return String(desc)
    .replace(/\s*\/\s*\d+(?:[.,]\d+)?\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Regla de Autocorrector Matemático por Fila:
 * Si el OCR pega decimales en una celda de tienda (ej. lee "200" en lugar de "2.00" en AK10
 * para el código 7591210000513 cuando Total Cantidad de la fila es 3.00 y AK04 tiene 1.00),
 * corrige automáticamente el valor verificando que la suma de las tiendas cuadre con `totalCantidad`.
 */
export function autocorregirTiendasPorFila(
  tiendas: Record<string, number>,
  totalCantidad: number
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(tiendas || {})) {
    const num = parseNumeroEstricto(v, 0);
    if (num > 0 && k.toUpperCase() !== 'CI' && k.toUpperCase() !== 'AKOP' && k.toUpperCase() !== 'FCOP') {
      result[k.toUpperCase()] = num;
    } else if (num > 0 && (k.toUpperCase() === 'AKOP' || k.toUpperCase() === 'FCOP')) {
      result[k.toUpperCase()] = num;
    }
  }

  if (!totalCantidad || totalCantidad <= 0) return result;

  const entries = Object.entries(result);
  if (entries.length === 0) return result;

  const currentSum = entries.reduce((acc, [, v]) => acc + v, 0);
  if (Math.abs(currentSum - totalCantidad) <= 0.05) {
    return result;
  }

  // Solo autocorregir cuando la suma excede totalCantidad por un factor decimal pegado (100x o 10x)
  if (currentSum > totalCantidad) {
    // Caso 1: Una sola celda tiene el punto decimal pegado (ej. 200 -> 2.00 o 20 -> 2.00)
    for (const [tag, val] of entries) {
      for (const divisor of [100, 10]) {
        if (val >= divisor) {
          const candidateVal = Number((val / divisor).toFixed(2));
          const candidateSum = currentSum - val + candidateVal;
          if (Math.abs(candidateSum - totalCantidad) <= 0.05) {
            result[tag] = candidateVal;
            return result;
          }
        }
      }
    }

    // Caso 2: Todas las celdas >= 100 (o >= 10) de la fila perdieron los 2 decimales (.00)
    for (const divisor of [100, 10]) {
      const scaledEntries = entries.map(([tag, val]) => [
        tag,
        val >= divisor && val % (divisor / 10) === 0 ? Number((val / divisor).toFixed(2)) : val
      ] as const);
      const scaledSum = scaledEntries.reduce((acc, [, v]) => acc + v, 0);
      if (Math.abs(scaledSum - totalCantidad) <= 0.05) {
        const corrected: Record<string, number> = {};
        scaledEntries.forEach(([tag, v]) => {
          if (v > 0) corrected[tag] = v;
        });
        return corrected;
      }
    }

    // Caso 3: Dos celdas con decimales pegados (búsqueda combinatoria sobre celdas con val > totalCantidad)
    const suspectTags = entries.filter(([, val]) => val > totalCantidad).map(([tag]) => tag);
    if (suspectTags.length >= 2 && suspectTags.length <= 6) {
      const trial = { ...result };
      for (const tag of suspectTags) {
        const v = trial[tag];
        if (v / 100 <= totalCantidad) {
          trial[tag] = Number((v / 100).toFixed(2));
        } else if (v / 10 <= totalCantidad) {
          trial[tag] = Number((v / 10).toFixed(2));
        }
      }
      const trialSum = Object.values(trial).reduce((acc, v) => acc + v, 0);
      if (Math.abs(trialSum - totalCantidad) <= 0.05) {
        return trial;
      }
    }
  }

  return result;
}

/**
 * Normaliza estrictamente cualquier unidad de medida extraída por OCR o PDF
 * hacia las 4 unidades oficiales de CODIZULCA: 'CJ' | 'KG' | 'UND' | 'BLT'.
 */
export function normalizarUnidadMedidaAlkosto(
  rawUnid?: unknown,
  descripcion?: string,
  emp?: number,
  catalogUnid?: string
): 'CJ' | 'KG' | 'UND' | 'BLT' {
  const clean = String(rawUnid || '')
    .trim()
    .toUpperCase()
    .replace(/[.\-_/]/g, '');

  if (clean) {
    if (['CJ', 'CJA', 'CAJ', 'CAJA', 'CAJAS', 'CJS', 'BTO', 'BTOS', 'BULTO', 'BULTOS', 'EMP', 'CS'].includes(clean)) {
      return 'CJ';
    }
    if (['BLT'].includes(clean)) {
      return 'BLT';
    }
    if (['KG', 'KGS', 'KILO', 'KILOS', 'KLS', 'KGR', 'KL', 'K'].includes(clean)) {
      return 'KG';
    }
    if (['UND', 'UNID', 'UNIDAD', 'UNIDADES', 'UNI', 'UN', 'PZA', 'PZAS', 'PIEZA', 'PIEZAS', 'PAQ', 'PAQUETE', 'BOLSA', 'BOLSAS'].includes(clean)) {
      return 'UND';
    }
  }

  if (catalogUnid && ['CJ', 'KG', 'UND', 'BLT'].includes(catalogUnid.toUpperCase())) {
    return catalogUnid.toUpperCase() as 'CJ' | 'KG' | 'UND' | 'BLT';
  }

  const descUpper = String(descripcion || '').toUpperCase();
  if (/\b(X\s*KG|POR\s*KG|XKG|A\s+GRANEL)\b/.test(descUpper)) {
    return 'KG';
  }
  if (/\b(\d+\s*UND\s*X|\d+\s*X\s*\d+\s*(GR|GRS|KG|LT|ML|UNI|UND))\b/.test(descUpper)) {
    return 'CJ';
  }

  if (emp && emp > 0) {
    return 'CJ';
  }

  return 'KG';
}

/**
 * Normaliza fechas en formato DD/MM/YYYY a DD/MM/YYYY o YYYY-MM-DD según se requiera,
 * validando que día, mes y año estén en rangos reales.
 */
export function normalizarFechaAlkosto(fechaRaw: string): string {
  const s = String(fechaRaw || '').trim();
  if (!s) return '';
  const dmy = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    const d = parseInt(dd, 10);
    const m = parseInt(mm, 10);
    const y = parseInt(yyyy, 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2100) {
      return `${dd}/${mm}/${yyyy}`;
    }
  }
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    return s;
  }
  return s;
}

/**
 * Aserción previa al procesamiento de cualquier documento de Orden de Compra.
 */
export function assertValidInputPayload(input: unknown, context = 'Documento OC Alkosto'): void {
  if (input === null || input === undefined) {
    throw new AlkostoParseValidationError(
      `${context}: El contenido de entrada es nulo o indefinido.`,
      [{ field: 'input', message: 'Entrada vacía o nula', severity: 'ERROR' }],
      'EMPTY_INPUT'
    );
  }
  if (typeof input === 'string' && input.trim().length === 0) {
    throw new AlkostoParseValidationError(
      `${context}: El texto o imagen base64 de entrada está vacío.`,
      [{ field: 'input', message: 'Cadena de entrada vacía', severity: 'ERROR' }],
      'EMPTY_STRING_INPUT'
    );
  }
}

/**
 * Desordena o corrige una fila de valores numéricos de una página de Alkosto o Familia Center,
 * detectando automáticamente si viene en Orden Visual (coordenada X: [IVA, EMP, Tiendas...])
 * o en Orden de Stream PDF ([IVA, AK01..AK04, EMP, AK08, AK09, AK05..AK07, AK10, AKOP, CI]
 * o [IVA, FC01, FC02, EMP, FC03..FC07]).
 */
export function mapNumericCellsToRow(
  rawTokens: string[],
  pageChain: 'ALKOSTO' | 'FAMILIA_CENTER' | 'VECINO_CENTER',
  explicitStoreHeaders?: string[]
): {
  iva: number;
  emp: number;
  tiendas: Record<string, number>;
  totalCantidad: number;
  costoBruto: number;
  costoUnitario: number;
  totalRenglon: number;
} | null {
  if (!rawTokens || rawTokens.length < 8) return null;

  const isPlainInteger = (tok: string) => /^\d+$/.test(tok.trim());
  const nums = rawTokens.map(t => parseNumeroEstricto(t, 0));

  // Los últimos 7 valores de toda fila en el ERP de Alkosto son SIEMPRE:
  // [TotalCantidad, CostoBruto, %Bonif, %Fact, %PP, CostoUnitario, TotalRenglon]
  const tailStart = nums.length - 7;
  if (tailStart < 2) return null;

  const totalCantidad = nums[tailStart];
  const costoBruto = nums[tailStart + 1];
  const costoUnitario = nums[tailStart + 5] || costoBruto;
  const totalRenglon = nums[tailStart + 6];

  const prefixTokens = rawTokens.slice(0, tailStart);
  const prefixNums = nums.slice(0, tailStart);
  const iva = prefixNums[0] ?? 0;

  const tiendas: Record<string, number> = {};
  let emp = 0;

  if (pageChain === 'ALKOSTO' && prefixNums.length === 14) {
    // 14 valores antes de TotalCantidad: 1 IVA + 1 EMP + 12 columnas (AK01..AK10, AKOP, CI)
    // Detectar si está en Orden Stream PDF (índice 5 es entero EMP y no índice 1)
    const idx1IsInt = isPlainInteger(prefixTokens[1]);
    const idx5IsInt = isPlainInteger(prefixTokens[5]);

    let storeValues: number[];
    if (idx5IsInt && !idx1IsInt) {
      // Orden Stream PDF de Alkosto:
      // [0:IVA, 1:AK01, 2:AK02, 3:AK03, 4:AK04, 5:EMP, 6:AK08, 7:AK09, 8:AK05, 9:AK06, 10:AK07, 11:AK10, 12:AKOP, 13:CI]
      emp = prefixNums[5];
      storeValues = [
        prefixNums[1],  // AK01
        prefixNums[2],  // AK02
        prefixNums[3],  // AK03
        prefixNums[4],  // AK04
        prefixNums[8],  // AK05
        prefixNums[9],  // AK06
        prefixNums[10], // AK07
        prefixNums[6],  // AK08
        prefixNums[7],  // AK09
        prefixNums[11], // AK10
        prefixNums[12], // AKOP
        prefixNums[13]  // CI
      ];
    } else {
      // Orden Visual por coordenada X:
      // [0:IVA, 1:EMP, 2:AK01, 3:AK02, 4:AK03, 5:AK04, 6:AK05, 7:AK06, 8:AK07, 9:AK08, 10:AK09, 11:AK10, 12:AKOP, 13:CI]
      emp = prefixNums[1];
      storeValues = prefixNums.slice(2, 14);
    }

    ALKOSTO_STORE_TAGS.forEach((tag, i) => {
      const val = storeValues[i] || 0;
      if (val > 0 && tag !== 'CI') {
        tiendas[tag] = val;
      }
    });
  } else if (pageChain === 'FAMILIA_CENTER' && prefixNums.length === 9) {
    // 9 valores antes de TotalCantidad: 1 IVA + 1 EMP + 7 columnas (FC01..FC07)
    const idx1IsInt = isPlainInteger(prefixTokens[1]);
    const idx3IsInt = isPlainInteger(prefixTokens[3]);

    let storeValues: number[];
    if (idx3IsInt && !idx1IsInt) {
      // Orden Stream PDF de Familia Center:
      // [0:IVA, 1:FC01, 2:FC02, 3:EMP, 4:FC03, 5:FC04, 6:FC05, 7:FC06, 8:FC07]
      emp = prefixNums[3];
      storeValues = [
        prefixNums[1], // FC01
        prefixNums[2], // FC02
        prefixNums[4], // FC03
        prefixNums[5], // FC04
        prefixNums[6], // FC05
        prefixNums[7], // FC06
        prefixNums[8]  // FC07
      ];
    } else {
      // Orden Visual por coordenada X:
      // [0:IVA, 1:EMP, 2:FC01, 3:FC02, 4:FC03, 5:FC04, 6:FC05, 7:FC06, 8:FC07]
      emp = prefixNums[1];
      storeValues = prefixNums.slice(2, 9);
    }

    const fcTags = ['FC01', 'FC02', 'FC03', 'FC04', 'FC05', 'FC06', 'FC07'];
    fcTags.forEach((tag, i) => {
      const val = storeValues[i] || 0;
      if (val > 0) {
        tiendas[tag] = val;
      }
    });
  } else {
    // Caso general (Vecino Center VC01..VC03 o número variable de tiendas)
    emp = prefixNums[1] || 0;
    const storeSlice = prefixNums.slice(2);
    const headers = explicitStoreHeaders && explicitStoreHeaders.length === storeSlice.length
      ? explicitStoreHeaders
      : storeSlice.map((_, i) => {
          if (pageChain === 'FAMILIA_CENTER') return `FC0${i + 1}`;
          if (pageChain === 'VECINO_CENTER') return `VC0${i + 1}`;
          return ALKOSTO_STORE_TAGS[i] || `AK0${i + 1}`;
        });
    headers.forEach((tag, i) => {
      const val = storeSlice[i] || 0;
      if (val > 0 && tag !== 'CI') {
        tiendas[tag] = val;
      }
    });
  }

  const correctedTiendas = autocorregirTiendasPorFila(tiendas, totalCantidad);

  return {
    iva,
    emp,
    tiendas: correctedTiendas,
    totalCantidad,
    costoBruto,
    costoUnitario,
    totalRenglon
  };
}

/**
 * Parsea una o múltiples páginas de texto extraído de una Orden de Compra de Alkosto / Familia Center.
 * Soporta tanto texto ordenado visualmente como texto crudo del stream del PDF.
 */
export function parseAlkostoRawText(rawText: string): ParsedOrdenCompraAlkosto {
  assertValidInputPayload(rawText, 'parseAlkostoRawText');

  // Dividir por páginas si el documento tiene varias cabeceras ("Pág.: 0001 de 0002" o cambios de Razón Social)
  const pageChunks = splitTextIntoPages(rawText);

  let ordenNro = '';
  let sede = 'AKOP';
  let fechaEmision = '';
  let fechaEntrega = '';
  let diasCredito = 15;
  let tasaCambio = 0;
  let proveedorNombre = 'CODIZULCA, C.A.';
  let proveedorRif = 'J409876136';
  let observaciones = '';
  let subtotalAlkosto = 0;
  let subtotalFamiliaCenter = 0;
  let subtotalGeneral = 0;
  const cadenasDetectadas: Array<'ALKOSTO' | 'FAMILIA_CENTER' | 'VECINO_CENTER'> = [];

  // Mapa para fusionar productos por código limpio preservando sus tiendas AK y FC
  const itemsByCode = new Map<string, {
    renglon: number;
    codigo: string;
    skuCodizulca?: string;
    codigoBarra?: string;
    descripcion: string;
    iva: number;
    emp: number;
    unid: string;
    totalCantidadAlkosto: number;
    totalCantidadFamilia: number;
    totalCantidad: number;
    costoBruto: number;
    costoUnitario: number;
    totalRenglon: number;
    tiendas: Record<string, number>;
  }>();

  for (const pageText of pageChunks) {
    const upper = pageText.toUpperCase();
    let pageChain: 'ALKOSTO' | 'FAMILIA_CENTER' | 'VECINO_CENTER' = 'ALKOSTO';
    if (upper.includes('FAMILIA CENTER') || upper.includes('SUBTOTAL ( FC )') || /\bFC01\b/.test(upper)) {
      pageChain = 'FAMILIA_CENTER';
    } else if (upper.includes('VECINO CENTER') || upper.includes('SUBTOTAL ( HC )') || /\bVC01\b/.test(upper)) {
      pageChain = 'VECINO_CENTER';
    }

    if (!cadenasDetectadas.includes(pageChain)) {
      cadenasDetectadas.push(pageChain);
    }

    // Extraer metadatos de cabecera
    if (!ordenNro) {
      const ocMatch = pageText.match(/Orden\s*Nro\.?\s*:?\s*(\d{5,12})/i) ||
                      pageText.match(/\b(0000\d{6})\b/);
      if (ocMatch) ordenNro = ocMatch[1].trim();
    }

    if (!tasaCambio) {
      const tasaMatch = pageText.match(/TASA\s+DE\s+CAMBIO\s*:?\s*([\d.,]+)/i);
      if (tasaMatch) tasaCambio = parseNumeroEstricto(tasaMatch[1], 0);
    }

    const datesFound = pageText.match(/\b(\d{2}\/\d{2}\/\d{4})\b/g) || [];
    if (datesFound.length >= 2 && !fechaEntrega) {
      // En el formato Alkosto: a la izquierda está "Entrega" (ej. 22/10/2026) y al lado "Emisión" (ej. 19/10/2026)
      // Si en el stream "Emisión" aparece primero y luego "Entrega", verificamos cuál es mayor
      const d1 = datesFound[0];
      const d2 = datesFound[1];
      const toComparable = (d: string) => {
        const [dd, mm, yyyy] = d.split('/');
        return `${yyyy}-${mm}-${dd}`;
      };
      if (toComparable(d1) >= toComparable(d2)) {
        fechaEntrega = d1;
        fechaEmision = d2;
      } else {
        fechaEmision = d1;
        fechaEntrega = d2;
      }
    } else if (datesFound.length === 1 && !fechaEntrega) {
      fechaEntrega = datesFound[0];
      fechaEmision = datesFound[0];
    }

    const credMatch = pageText.match(/Dias\s+de\s+Credito\s*[\r\n\s]*(\d{1,3})/i);
    if (credMatch) {
      diasCredito = parseInt(credMatch[1], 10) || diasCredito;
    }

    if (!observaciones) {
      const obsMatch = pageText.match(/(\d+\s*DIAS\s+BS\s+BCV[^\r\n]*)/i);
      if (obsMatch) observaciones = obsMatch[1].trim();
    }

    const subAkMatch = pageText.match(/SubTotal\s*\(\s*AK\s*\)\s*([\d.,]+)/i);
    if (subAkMatch) subtotalAlkosto = parseNumeroEstricto(subAkMatch[1], 0);

    const subFcMatch = pageText.match(/SubTotal\s*\(\s*FC\s*\)\s*([\d.,]+)/i);
    if (subFcMatch) subtotalFamiliaCenter = parseNumeroEstricto(subFcMatch[1], 0);

    const subGenMatch = pageText.match(/Sub\s*Total\s*:\s*([\d.,]+)/i);
    if (subGenMatch) subtotalGeneral = parseNumeroEstricto(subGenMatch[1], 0);

    // Ignorar los renglones de VECINO CENTER para las notas de Alkosto / Familia Center,
    // a menos que el documento sea exclusivamente de otra tienda.
    if (pageChain === 'VECINO_CENTER') continue;

    // Extraer renglones de productos de la página
    const lines = pageText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Un renglón de producto inicia con un código numérico de 4 a 14 dígitos seguido de la descripción en mayúsculas
      const prodHeaderMatch = line.match(/^(\d{4,14})\s+([A-ZÁÉÍÓÚÑ0-9][\s\S]+)$/i);
      if (!prodHeaderMatch) continue;

      const rawCode = prodHeaderMatch[1].trim();
      let rawDescPart = prodHeaderMatch[2].trim();

      // Evitar falsos positivos con el RIF/Código de proveedor (409876136) o seriales
      if (rawCode === '409876136' || /^267319/.test(rawCode) || rawDescPart.toUpperCase().startsWith('CODIZULCA')) {
        continue;
      }

      // Buscar la línea siguiente que contiene los valores numéricos del renglón (soportando salto de línea en la descripción)
      let nextLineIdx = i + 1;
      let nextLine = lines[nextLineIdx] || '';
      let numTokens = nextLine.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
      if (
        numTokens.length < 8 &&
        nextLine &&
        !/^(\d{4,14})\s+[A-ZÁÉÍÓÚÑ]/i.test(nextLine) &&
        !/^SubTotal/i.test(nextLine) &&
        lines[i + 2]
      ) {
        const secondNextTokens = lines[i + 2].match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
        if (secondNextTokens.length >= 8) {
          rawDescPart = `${rawDescPart} ${nextLine}`.trim();
          nextLineIdx = i + 2;
          nextLine = lines[nextLineIdx];
          numTokens = secondNextTokens;
        }
      }
      if (numTokens.length < 8) continue;

      const mapped = mapNumericCellsToRow(numTokens, pageChain);
      if (!mapped) continue;
      i = nextLineIdx; // Consumir la(s) línea(s) procesadas

      const cleanDesc = limpiarDescripcionAlkosto(rawDescPart);
      const catalogMatch = resolverProductoPorCodigoODescripcion(rawCode, cleanDesc);

      const finalSku = catalogMatch ? catalogMatch.sku : rawCode;
      const finalBarcode = catalogMatch?.codigoBarra || (/^\d{12,14}$/.test(rawCode) ? rawCode : undefined);
      const finalUnid = normalizarUnidadMedidaAlkosto(undefined, cleanDesc, mapped.emp, catalogMatch?.unidadSugerida);

      const existing = itemsByCode.get(rawCode);
      if (existing) {
        // Fusionar tiendas de Alkosto y Familia Center (o múltiples páginas de la misma cadena) sin perder ni truncar ninguna sucursal
        for (const [tk, tv] of Object.entries(mapped.tiendas)) {
          existing.tiendas[tk] = (existing.tiendas[tk] || 0) + tv;
        }
        if (pageChain === 'ALKOSTO') {
          existing.totalCantidadAlkosto = (existing.totalCantidadAlkosto || 0) + mapped.totalCantidad;
        } else if (pageChain === 'FAMILIA_CENTER') {
          existing.totalCantidadFamilia = (existing.totalCantidadFamilia || 0) + mapped.totalCantidad;
        }
        existing.totalCantidad = (existing.totalCantidadAlkosto || 0) + (existing.totalCantidadFamilia || 0);
        existing.totalRenglon = Number((existing.totalCantidad * existing.costoUnitario).toFixed(2));
      } else {
        itemsByCode.set(rawCode, {
          renglon: itemsByCode.size + 1,
          codigo: finalSku,
          skuCodizulca: finalSku,
          codigoBarra: finalBarcode,
          descripcion: cleanDesc,
          iva: mapped.iva,
          emp: mapped.emp,
          unid: finalUnid,
          totalCantidadAlkosto: pageChain === 'ALKOSTO' ? mapped.totalCantidad : 0,
          totalCantidadFamilia: pageChain === 'FAMILIA_CENTER' ? mapped.totalCantidad : 0,
          totalCantidad: mapped.totalCantidad,
          costoBruto: mapped.costoBruto,
          costoUnitario: mapped.costoUnitario,
          totalRenglon: mapped.totalRenglon,
          tiendas: { ...mapped.tiendas }
        });
      }
    }
  }

  const mergedItems = Array.from(itemsByCode.values()).map((it, idx) => {
    // Para que la vista inicial (ALKOSTO si existe página Alkosto) muestre el total exacto de la cadena principal,
    // mientras `it.tiendas` conserva el 100% de las tiendas AK y FC para el desglose multi-sucursal:
    const hasAlkostoPage = cadenasDetectadas.includes('ALKOSTO');
    const primaryTotalCantidad = hasAlkostoPage && it.totalCantidadAlkosto > 0
      ? it.totalCantidadAlkosto
      : it.totalCantidad;
    const primaryTotalRenglon = Number((primaryTotalCantidad * it.costoUnitario).toFixed(2));

    return {
      renglon: idx + 1,
      codigo: it.codigo,
      skuCodizulca: it.skuCodizulca,
      codigoBarra: it.codigoBarra,
      descripcion: it.descripcion,
      iva: it.iva,
      emp: it.emp,
      unid: it.unid,
      totalCantidad: primaryTotalCantidad,
      costoBruto: it.costoBruto,
      costoUnitario: it.costoUnitario,
      totalRenglon: primaryTotalRenglon,
      tiendas: it.tiendas
    };
  });

  const primaryCadena = cadenasDetectadas.includes('ALKOSTO')
    ? 'ALKOSTO'
    : (cadenasDetectadas.includes('FAMILIA_CENTER') ? 'FAMILIA_CENTER' : 'ALKOSTO');

  const computedSubtotal = primaryCadena === 'ALKOSTO' && subtotalAlkosto > 0
    ? subtotalAlkosto
    : (primaryCadena === 'FAMILIA_CENTER' && subtotalFamiliaCenter > 0
      ? subtotalFamiliaCenter
      : mergedItems.reduce((acc, it) => acc + it.totalRenglon, 0));

  const computedSubtotalGeneral = subtotalGeneral > 0
    ? subtotalGeneral
    : (subtotalAlkosto > 0 || subtotalFamiliaCenter > 0)
      ? Number(((subtotalAlkosto || 0) + (subtotalFamiliaCenter || 0)).toFixed(2))
      : Number(computedSubtotal.toFixed(2));

  const result: ParsedOrdenCompraAlkosto = {
    clienteCadena: primaryCadena,
    cadenasDetectadas,
    ordenNro,
    sede: primaryCadena === 'FAMILIA_CENTER' ? 'FCOP' : sede,
    fechaEmision: normalizarFechaAlkosto(fechaEmision),
    fechaEntrega: normalizarFechaAlkosto(fechaEntrega),
    diasCredito,
    tasaCambio,
    proveedorNombre,
    proveedorRif,
    observaciones: observaciones || undefined,
    subtotal: Number(computedSubtotal.toFixed(2)),
    subtotalAlkosto: subtotalAlkosto > 0 ? subtotalAlkosto : undefined,
    subtotalFamiliaCenter: subtotalFamiliaCenter > 0 ? subtotalFamiliaCenter : undefined,
    subtotalGeneral: computedSubtotalGeneral > 0 ? computedSubtotalGeneral : undefined,
    items: mergedItems
  };

  return validateAndNormalizeAlkostoOC(result, { strictMath: true });
}

function splitTextIntoPages(rawText: string): string[] {
  const parts = rawText.split(/(?=(?:ALKOSTO DONDE COMPRAR ES GANAR|FAMILIA CENTER,\s*C\.A|VECINO CENTER,\s*C\.A))/i);
  const filtered = parts.map(p => p.trim()).filter(p => p.length > 40);
  return filtered.length > 0 ? filtered : [rawText];
}

/**
 * Extrae las páginas de texto ordenadas por coordenadas (X, Y) directamente desde un Buffer
 * de archivo PDF digital generado por el ERP de Alkosto (usando descompresión FlateDecode nativa).
 * Retorna null si el PDF es una imagen escaneada sin streams de texto.
 */
export function extractPositionedTextFromAlkostoPdfBuffer(
  pdfBuffer: Uint8Array | Buffer,
  inflateSyncFn: (buf: Buffer | Uint8Array) => Buffer
): string | null {
  assertValidInputPayload(pdfBuffer, 'extractPositionedTextFromAlkostoPdfBuffer');

  const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
  const latin1 = buf.toString('latin1');
  let cursor = 0;
  const pageTexts: string[] = [];

  while ((cursor = latin1.indexOf('stream', cursor)) !== -1) {
    let start = latin1.indexOf('\n', cursor);
    if (start === -1) break;
    start += 1;
    const end = latin1.indexOf('endstream', start);
    if (end === -1) break;

    const rawSlice = buf.subarray(start, end);
    cursor = end + 9;

    let inflated = '';
    try {
      inflated = inflateSyncFn(rawSlice).toString('latin1');
    } catch {
      continue;
    }

    if (!inflated.includes('BT') || !inflated.includes('ET') || !inflated.includes('Tm')) {
      continue;
    }

    const tokens: Array<{ x: number; y: number; txt: string }> = [];
    const btBlocks = inflated.match(/BT[\s\S]*?ET/g) || [];

    for (const block of btBlocks) {
      const tfMatch = block.match(/\/F\d+\s+([\d.]+)\s+Tf/);
      const fontSize = tfMatch ? parseFloat(tfMatch[1]) : 9.28;
      const tmMatch = block.match(/1\s+0\s+0(?:\.0+)?\s+-1\s+([\d.]+)\s+([\d.]+)\s+Tm/);
      if (!tmMatch) continue;

      let curX = parseFloat(tmMatch[1]);
      const y = parseFloat(tmMatch[2]);

      const tjMatch = block.match(/\[([\s\S]*?)\]\s*TJ/);
      if (!tjMatch) continue;

      const inner = tjMatch[1];
      const elems = inner.match(/<[0-9A-Fa-f]{4}>|-?\d+(?:\.\d+)?/g) || [];
      let curWord = '';
      let wordStartX = curX;

      for (const el of elems) {
        if (el.startsWith('<')) {
          const gid = parseInt(el.slice(1, 5), 16);
          const ch = decodeAlkostoGlyph(gid);
          if (!curWord) wordStartX = curX;
          curWord += ch;
          curX += fontSize * 0.5;
        } else {
          const kern = parseFloat(el);
          if (kern < -400) {
            if (curWord.trim()) {
              tokens.push({ x: wordStartX, y, txt: curWord.trim() });
            }
            curWord = '';
          }
          curX += (-kern / 1000) * fontSize;
        }
      }

      if (curWord.trim()) {
        tokens.push({ x: wordStartX, y, txt: curWord.trim() });
      }
    }

    if (tokens.length === 0) continue;

    // Agrupar tokens por fila visual (coordenada Y con tolerancia de 2.5 puntos)
    tokens.sort((a, b) => (Math.abs(a.y - b.y) < 2.5 ? a.x - b.x : a.y - b.y));
    const rows: Array<{ y: number; items: Array<{ x: number; y: number; txt: string }> }> = [];

    for (const tok of tokens) {
      const lastRow = rows[rows.length - 1];
      if (lastRow && Math.abs(lastRow.y - tok.y) < 2.5) {
        lastRow.items.push(tok);
      } else {
        rows.push({ y: tok.y, items: [tok] });
      }
    }

    const pageLines = rows.map(r => {
      r.items.sort((a, b) => a.x - b.x);
      return r.items.map(i => i.txt).join('  ');
    });

    const pageStr = pageLines.join('\n');
    if (/Orden\s*Nro|ALKOSTO|FAMILIA\s*CENTER|VECINO\s*CENTER/i.test(pageStr)) {
      pageTexts.push(pageStr);
    }
  }

  return pageTexts.length > 0 ? pageTexts.join('\n\n') : null;
}

function decodeAlkostoGlyph(gid: number): string {
  // Mapa TrueType estándar de los reportes ERP de Alkosto (desplazamiento ASCII +29)
  const code = gid + 29;
  if (code >= 32 && code <= 126) {
    return String.fromCharCode(code);
  }
  if (gid === 0x0079) return 'ó';
  if (gid === 0x0069) return 'á';
  if (gid === 0x0083) return '°';
  return ' ';
}

/**
 * Validador estricto de esquema y reglas de negocio para cualquier Orden de Compra
 * de Alkosto / Familia Center (provenga del parser PDF determinista o de Gemini OCR).
 *
 * - Normaliza nombres de campos alternativos devueltos por IA.
 * - Valida que existan `ordenNro` e `items` válidos.
 * - Verifica las invariantes matemáticas de cada renglón:
 *   1. Suma de tiendas vs `totalCantidad`
 *   2. `totalCantidad * costoUnitario == totalRenglon`
 * - Lanza `AlkostoParseValidationError` si la estructura está corrupta o incompleta.
 */
export function validateAndNormalizeAlkostoOC(
  rawInput: any,
  options: { strictMath?: boolean; requireOrdenNro?: boolean } = {}
): ParsedOrdenCompraAlkosto {
  const { strictMath = false, requireOrdenNro = true } = options;
  assertValidInputPayload(rawInput, 'validateAndNormalizeAlkostoOC');

  const issues: AlkostoValidationIssue[] = [];

  // 1. Desenvolver raíz si viene anidada
  let root: any = rawInput;
  if (typeof root === 'object' && !Array.isArray(root)) {
    if (root.orden && typeof root.orden === 'object' && !Array.isArray(root.orden)) root = root.orden;
    else if (root.ordenCompra && typeof root.ordenCompra === 'object') root = root.ordenCompra;
    else if (root.ordenDeCompra && typeof root.ordenDeCompra === 'object') root = root.ordenDeCompra;
    else if (root.orden_compra && typeof root.orden_compra === 'object') root = root.orden_compra;
    else if (root.orden_de_compra && typeof root.orden_de_compra === 'object') root = root.orden_de_compra;
    else if (root.pedido && typeof root.pedido === 'object' && !Array.isArray(root.pedido)) root = root.pedido;
    else if (root.data && typeof root.data === 'object' && !Array.isArray(root.data)) root = root.data;
  }

  if (!root || typeof root !== 'object') {
    throw new AlkostoParseValidationError(
      'El documento analizado no tiene una estructura de objeto JSON válida.',
      [{ field: 'root', message: 'Se esperaba un objeto JSON de Orden de Compra', severity: 'ERROR' }],
      'INVALID_ROOT_OBJECT'
    );
  }

  // 2. Extraer lista de renglones/items
  let rawItems: any[] = [];
  if (Array.isArray(root)) {
    rawItems = root;
    root = { items: rawItems };
  } else {
    const candidateKeys = ['items', 'articulos', 'artículos', 'productos', 'renglones', 'detalle', 'detalles', 'lineas', 'filas'];
    for (const key of candidateKeys) {
      if (Array.isArray(root[key])) {
        rawItems = root[key];
        break;
      }
    }
    if (rawItems.length === 0) {
      for (const k of Object.keys(root)) {
        if (Array.isArray(root[k]) && root[k].length > 0 && typeof root[k][0] === 'object') {
          rawItems = root[k];
          break;
        }
      }
    }
  }

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new AlkostoParseValidationError(
      'No se encontraron renglones de productos en la Orden de Compra.',
      [{ field: 'items', message: 'La lista de productos (items) está vacía o ausente', severity: 'ERROR' }],
      'EMPTY_ITEMS_LIST'
    );
  }

  // Helper insensible a mayúsculas, acentos y espacios/guiones para leer encabezados visuales de CODIZULCA y Alkosto
  const pickProp = (obj: any, candidates: string[]): any => {
    if (!obj || typeof obj !== 'object') return undefined;
    for (const c of candidates) {
      if (obj[c] !== undefined && obj[c] !== null && obj[c] !== '') return obj[c];
    }
    const normKey = (k: string) =>
      k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const targetSet = new Set(candidates.map(normKey));
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null && v !== '' && targetSet.has(normKey(k))) {
        return v;
      }
    }
    return undefined;
  };

  // Filtrar filas vacías de plantillas (ej. filas en blanco 2..15 de la Nota de Pedido Codizulca)
  const nonEmptyRawItems = rawItems.filter((it: any) => {
    if (!it || typeof it !== 'object') return true; // Dejar pasar para que el validador reporte el error de tipo
    const hasCod = Boolean(String(pickProp(it, ['codigo', 'sku', 'SKU', 'skuCodizulca', 'codigoBarra', 'ean', 'referencia']) ?? '').trim());
    const hasDesc = Boolean(String(pickProp(it, ['descripcion', 'DESCRIPCIÓN DEL PRODUCTO', 'descripcionProducto', 'producto', 'nombre', 'articulo']) ?? '').trim());
    const hasCant = parseNumeroEstricto(pickProp(it, ['totalCantidad', 'cantSolicitada', 'CANT', 'cantidad', 'cant', 'CANT. SOLICITADA']), 0) > 0;
    const hasStores = it.tiendas && typeof it.tiendas === 'object' && Object.values(it.tiendas).some(v => parseNumeroEstricto(v, 0) > 0);
    return hasCod || hasDesc || hasCant || hasStores;
  });

  const itemsToValidate = nonEmptyRawItems.length > 0 ? nonEmptyRawItems : rawItems;

  // 3. Validar y normalizar Número de Orden de Compra
  const rawOrdenNro = String(
    pickProp(root, ['ordenNro', 'numero_oc', 'ORDEN DE COMPRA', 'ordenCompra', 'orden_compra', 'numeroOrden', 'nroOrden', 'nro_orden', 'oc']) ??
    pickProp(rawInput, ['ordenNro', 'numero_oc', 'ORDEN DE COMPRA', 'ordenCompra', 'numeroOrden', 'nroOrden', 'oc']) ??
    (typeof root.orden === 'string' ? root.orden : '') ??
    ''
  ).trim();

  if (requireOrdenNro && !rawOrdenNro) {
    issues.push({
      field: 'ordenNro',
      message: 'Falta el número de Orden de Compra (ordenNro).',
      severity: 'ERROR'
    });
  }

  // 4. Normalizar y validar cada renglón
  const rawNormalizedItems: ParsedOrdenCompraAlkosto['items'] = [];

  itemsToValidate.forEach((it: any, idx: number) => {
    const renglonNum = Number(pickProp(it, ['renglon', 'N°', 'nro', 'numero'])) || idx + 1;
    if (!it || typeof it !== 'object') {
      issues.push({
        field: `items[${idx}]`,
        renglon: renglonNum,
        message: `El renglón ${renglonNum} no es un objeto válido.`,
        severity: 'ERROR'
      });
      return;
    }

    let rawCod = String(
      pickProp(it, [
        'codigo',
        'sku',
        'SKU',
        'skuCodizulca',
        'codigo_articulo',
        'codigo_producto',
        'codigoBarra',
        'codigo_barra',
        'ean',
        'barcode',
        'referencia'
      ]) ?? ''
    ).trim();

    let rawUnidInput = String(
      pickProp(it, [
        'unid',
        'UNID',
        'unidad',
        'unidadMedida',
        'unidad_medida',
        'cantSolicitadaUnid'
      ]) ?? ''
    ).trim();

    // Guardarraíl contra cruce de columnas: si la IA colocó la unidad ("CJ", "KG", "UND") en el campo SKU/codigo
    if (/^(CJ|CAJA|CAJAS|KG|KGS|KILOS|UND|UNID|UNIDADES|BLT|BTO|BTOS|BULTO|BULTOS)$/i.test(rawCod)) {
      const potentialCodeInUnid = rawUnidInput && !/^(CJ|CAJA|CAJAS|KG|KGS|KILOS|UND|UNID|UNIDADES|BLT|BTO|BTOS|BULTO|BULTOS)$/i.test(rawUnidInput)
        ? rawUnidInput
        : '';
      rawUnidInput = rawCod;
      rawCod = String(pickProp(it, ['skuCodizulca', 'codigoBarra']) ?? potentialCodeInUnid ?? '').trim();
    }

    const cleanCod = normalizarCodigoProducto(rawCod);
    const rawDesc = String(
      pickProp(it, [
        'descripcion',
        'DESCRIPCIÓN DEL PRODUCTO',
        'descripcionProducto',
        'descripcion_producto',
        'producto',
        'nombre',
        'articulo',
        'detalle'
      ]) ?? ''
    ).trim();
    const cleanDesc = limpiarDescripcionAlkosto(rawDesc);

    if (!cleanCod && !cleanDesc) {
      issues.push({
        field: `items[${idx}].codigo`,
        renglon: renglonNum,
        message: `El renglón ${renglonNum} carece tanto de SKU/código como de descripción.`,
        severity: 'ERROR'
      });
      return;
    }

    const match = resolverProductoPorCodigoODescripcion(cleanCod, cleanDesc);
    const finalSku = (match ? match.sku : '') || (it.skuCodizulca ? normalizarCodigoProducto(it.skuCodizulca) : '') || cleanCod;
    const finalCodigo = finalSku || cleanCod || (match?.codigoBarra ?? '');
    const finalBarcode = it.codigoBarra || it.ean || match?.codigoBarra || (/^\d{12,14}$/.test(cleanCod) ? cleanCod : undefined);
    const finalDesc = cleanDesc || (match ? match.producto : '');

    if (!finalCodigo) {
      issues.push({
        field: `items[${idx}].codigo`,
        renglon: renglonNum,
        message: `El renglón ${renglonNum} ("${finalDesc}") no tiene un SKU identificable.`,
        severity: 'ERROR'
      });
      return;
    }

    // Normalizar tiendas (AK01..AK10, FC01..FC07, etc.)
    let cleanTiendas: Record<string, number> = {};
    if (it.tiendas && typeof it.tiendas === 'object') {
      for (const [tag, val] of Object.entries(it.tiendas)) {
        const uTag = tag.trim().toUpperCase();
        const numVal = parseNumeroEstricto(val, NaN);
        if (Number.isNaN(numVal) || numVal < 0) {
          issues.push({
            field: `items[${idx}].tiendas.${uTag}`,
            renglon: renglonNum,
            message: `Valor inválido en tienda ${uTag} del renglón ${renglonNum}: "${val}"`,
            severity: 'ERROR'
          });
          continue;
        }
        if (numVal > 0 && ALL_VALID_STORE_TAGS.has(uTag) && uTag !== 'CI' && uTag !== 'AKOP' && uTag !== 'FCOP') {
          cleanTiendas[uTag] = numVal;
        }
      }
    }

    // También soportar tiendas en la raíz del item (it.AK01, it.FC01)
    for (const [k, val] of Object.entries(it)) {
      const uKey = k.trim().toUpperCase();
      if (ALL_VALID_STORE_TAGS.has(uKey) && uKey !== 'CI' && uKey !== 'AKOP' && uKey !== 'FCOP') {
        const numVal = parseNumeroEstricto(val, 0);
        if (numVal > 0) {
          cleanTiendas[uKey] = numVal;
        }
      }
    }

    const empNum = parseNumeroEstricto(it.emp, 0);
    const ivaNum = parseNumeroEstricto(it.iva, 0);

    const finalUnid = normalizarUnidadMedidaAlkosto(
      rawUnidInput,
      finalDesc,
      empNum,
      match?.unidadSugerida
    );

    let totalCant = parseNumeroEstricto(
      pickProp(it, [
        'totalCantidad',
        'cantSolicitada',
        'CANT',
        'cantidadSolicitada',
        'cantidad_solicitada',
        'total_cantidad',
        'cantidad',
        'cant',
        'cajas',
        'bultos'
      ]),
      0
    );

    const totalCantAkExplicit = parseNumeroEstricto(
      pickProp(it, ['totalCantidadAlkosto', 'total_cantidad_alkosto']),
      0
    );
    const totalCantFcExplicit = parseNumeroEstricto(
      pickProp(it, ['totalCantidadFamilia', 'total_cantidad_familia', 'totalCantidadFamiliaCenter', 'total_cantidad_familia_center']),
      0
    );

    // Aplicar Regla de Autocorrector Matemático por Fila contra decimales pegados (ej. 200 -> 2.00)
    if (totalCantAkExplicit > 0 || totalCantFcExplicit > 0) {
      const akMap: Record<string, number> = {};
      const fcMap: Record<string, number> = {};
      const otherMap: Record<string, number> = {};
      for (const [tk, tv] of Object.entries(cleanTiendas)) {
        if (tk.startsWith('AK')) akMap[tk] = tv;
        else if (tk.startsWith('FC')) fcMap[tk] = tv;
        else otherMap[tk] = tv;
      }
      const fixedAk = totalCantAkExplicit > 0 ? autocorregirTiendasPorFila(akMap, totalCantAkExplicit) : akMap;
      const fixedFc = totalCantFcExplicit > 0 ? autocorregirTiendasPorFila(fcMap, totalCantFcExplicit) : fcMap;
      cleanTiendas = { ...fixedAk, ...fixedFc, ...otherMap };
    } else if (totalCant > 0) {
      const akKeys = Object.keys(cleanTiendas).filter(tk => tk.startsWith('AK'));
      const fcKeys = Object.keys(cleanTiendas).filter(tk => tk.startsWith('FC'));
      if (akKeys.length > 0 && fcKeys.length === 0) {
        cleanTiendas = autocorregirTiendasPorFila(cleanTiendas, totalCant);
      } else if (fcKeys.length > 0 && akKeys.length === 0) {
        cleanTiendas = autocorregirTiendasPorFila(cleanTiendas, totalCant);
      } else {
        cleanTiendas = autocorregirTiendasPorFila(cleanTiendas, totalCant);
      }
    }

    // Calcular suma de tiendas por cadena tras autocorrección
    const sumAkTiendas = Object.entries(cleanTiendas)
      .filter(([tk]) => tk.startsWith('AK'))
      .reduce((acc, [, v]) => acc + v, 0);
    const sumFcTiendas = Object.entries(cleanTiendas)
      .filter(([tk]) => tk.startsWith('FC'))
      .reduce((acc, [, v]) => acc + v, 0);
    const sumAllTiendas = Object.values(cleanTiendas).reduce((acc, v) => acc + v, 0);

    const cantDespachadaRaw = pickProp(it, ['cantDespachada', 'CANTIDAD DESPACHADA', 'cantidadDespachada', 'cantidad_despachada']) ?? '';
    const cantDespachadaClean = cantDespachadaRaw !== '' && cantDespachadaRaw !== null && cantDespachadaRaw !== undefined
      ? String(parseNumeroEstricto(cantDespachadaRaw, 0) || cantDespachadaRaw).trim()
      : '';

    if (totalCant < 0) {
      issues.push({
        field: `items[${idx}].totalCantidad`,
        renglon: renglonNum,
        message: `Cantidad negativa (${totalCant}) en renglón ${renglonNum}.`,
        severity: 'ERROR'
      });
    }

    // Reconciliación matemática entre suma de tiendas y totalCantidad
    if (sumAllTiendas > 0) {
      const matchesAll = Math.abs(sumAllTiendas - totalCant) <= 0.05;
      const matchesAk = sumAkTiendas > 0 && Math.abs(sumAkTiendas - totalCant) <= 0.05;
      const matchesFc = sumFcTiendas > 0 && Math.abs(sumFcTiendas - totalCant) <= 0.05;

      if (totalCant === 0) {
        totalCant = sumAkTiendas > 0 && sumFcTiendas === 0 ? sumAkTiendas : sumAllTiendas;
      } else if (!matchesAll && !matchesAk && !matchesFc) {
        if (strictMath) {
          issues.push({
            field: `items[${idx}].totalCantidad`,
            renglon: renglonNum,
            message: `Desalineación en renglón ${renglonNum} (${finalCodigo}): la suma de tiendas (${sumAllTiendas}) no coincide con Total Cantidad (${totalCant}).`,
            severity: 'ERROR'
          });
        } else {
          totalCant = sumAkTiendas > 0 && sumFcTiendas === 0 ? sumAkTiendas : totalCant;
        }
      }
    }

    let precio = parseNumeroEstricto(
      pickProp(it, [
        'costoUnitario',
        'PRECIO',
        'precio',
        'precioUnitario',
        'precio_unitario',
        'costo_unitario',
        'costoBruto',
        'costo_bruto'
      ]),
      0
    );

    let totalRenglon = parseNumeroEstricto(
      pickProp(it, [
        'totalRenglon',
        'SUB TOTAL',
        'subtotal',
        'subTotal',
        'sub_total',
        'total_renglon',
        'importe',
        'monto'
      ]),
      0
    );

    if (precio < 0 || totalRenglon < 0) {
      issues.push({
        field: `items[${idx}].costoUnitario`,
        renglon: renglonNum,
        message: `Precio o total negativo en renglón ${renglonNum}.`,
        severity: 'ERROR'
      });
    }

    if (!precio && totalRenglon > 0 && totalCant > 0) {
      precio = Number((totalRenglon / totalCant).toFixed(4));
    } else if (precio > 0 && !totalRenglon && totalCant > 0) {
      totalRenglon = Number((totalCant * precio).toFixed(2));
    } else if (precio > 0 && totalCant > 0 && totalRenglon > 0) {
      const expectedTotal = Number((totalCant * precio).toFixed(2));
      if (Math.abs(expectedTotal - totalRenglon) > Math.max(0.5, expectedTotal * 0.02)) {
        if (strictMath) {
          issues.push({
            field: `items[${idx}].totalRenglon`,
            renglon: renglonNum,
            message: `Inconsistencia matemática en renglón ${renglonNum} (${finalCodigo}): ${totalCant} x ${precio} = ${expectedTotal}, pero figura ${totalRenglon}.`,
            severity: 'ERROR'
          });
        } else {
          totalRenglon = expectedTotal;
        }
      }
    }

    if (totalCant <= 0 && sumAllTiendas <= 0) {
      issues.push({
        field: `items[${idx}].totalCantidad`,
        renglon: renglonNum,
        message: `El renglón ${renglonNum} (${finalCodigo}) tiene cantidad solicitada 0.`,
        severity: 'ERROR'
      });
    }

    rawNormalizedItems.push({
      renglon: rawNormalizedItems.length + 1,
      codigo: finalCodigo,
      skuCodizulca: finalSku,
      codigoBarra: finalBarcode,
      descripcion: finalDesc,
      iva: ivaNum,
      emp: empNum,
      unid: finalUnid,
      totalCantidad: totalCant,
      cantDespachada: cantDespachadaClean,
      costoBruto: parseNumeroEstricto(it.costoBruto, precio),
      costoUnitario: precio,
      totalRenglon: Number(totalRenglon.toFixed(2)),
      tiendas: cleanTiendas
    });
  });

  const errorIssues = issues.filter(i => i.severity === 'ERROR');
  if (errorIssues.length > 0) {
    throw new AlkostoParseValidationError(
      `Error de validación en Orden de Compra Alkosto: ${errorIssues.map(e => e.message).join(' | ')}`,
      issues,
      'SCHEMA_VALIDATION_FAILED'
    );
  }

  // Fusionar renglones por código si la IA devolvió filas separadas para la Página 1 (Alkosto) y la Página 2 (Familia Center)
  const mergedByCodeMap = new Map<string, ParsedOrdenCompraAlkosto['items'][0]>();
  for (const item of rawNormalizedItems) {
    const hasStores = item.tiendas && Object.keys(item.tiendas).length > 0;
    const key = hasStores ? item.codigo : `${item.codigo}#${item.renglon}`;
    const existing = mergedByCodeMap.get(key);
    if (existing && hasStores) {
      const mergedTiendas: Record<string, number> = { ...(existing.tiendas || {}) };
      for (const [tk, tv] of Object.entries(item.tiendas || {})) {
        mergedTiendas[tk] = (mergedTiendas[tk] || 0) + tv;
      }
      const sumAk = Object.entries(mergedTiendas)
        .filter(([tk]) => tk.startsWith('AK'))
        .reduce((acc, [, v]) => acc + v, 0);
      const sumAll = Object.values(mergedTiendas).reduce((acc, v) => acc + v, 0);
      const primaryCant = sumAk > 0 ? sumAk : sumAll;
      existing.tiendas = mergedTiendas;
      existing.totalCantidad = primaryCant;
      existing.totalRenglon = Number((primaryCant * existing.costoUnitario).toFixed(2));
    } else {
      mergedByCodeMap.set(key, {
        ...item,
        renglon: mergedByCodeMap.size + 1
      });
    }
  }
  const normalizedItems = Array.from(mergedByCodeMap.values());

  // Determinar cadena principal: priorizar ALKOSTO si hay tiendas AK, o FAMILIA_CENTER si solo hay tiendas FC
  const allStoreTags = new Set<string>();
  normalizedItems.forEach(it => {
    if (it.tiendas) Object.keys(it.tiendas).forEach(t => allStoreTags.add(t));
  });
  const hasAk = Array.from(allStoreTags).some(t => t.startsWith('AK'));
  const hasFc = Array.from(allStoreTags).some(t => t.startsWith('FC'));

  const clienteNombreClean = String(pickProp(root, ['clienteNombre', 'CLIENTE', 'cliente']) ?? pickProp(rawInput, ['clienteNombre', 'CLIENTE', 'cliente']) ?? '').trim();
  const idClienteClean = String(pickProp(root, ['idCliente', 'ID CLIENTE', 'codigoCliente', 'codCliente']) ?? pickProp(rawInput, ['idCliente', 'ID CLIENTE', 'codigoCliente']) ?? '').trim();
  const rutaClean = String(pickProp(root, ['ruta', 'RUTA']) ?? pickProp(rawInput, ['ruta', 'RUTA']) ?? '').trim();
  const supervisorClean = String(pickProp(root, ['supervisor', 'SUPERVISOR']) ?? pickProp(rawInput, ['supervisor', 'SUPERVISOR']) ?? '').trim();
  const choferClean = String(pickProp(root, ['chofer', 'CHOFER']) ?? pickProp(rawInput, ['chofer', 'CHOFER']) ?? '').trim();
  const cantidadCestasClean = pickProp(root, ['cantidadCestas', 'CANTIDAD DE CESTAS']) ?? pickProp(rawInput, ['cantidadCestas', 'CANTIDAD DE CESTAS']);
  const nroPedidoClean = String(pickProp(root, ['nroPedido', 'N° DE PEDIDO', 'numeroPedido']) ?? pickProp(rawInput, ['nroPedido', 'N° DE PEDIDO']) ?? '').trim();
  const observacionesClean = String(pickProp(root, ['observaciones', 'OBSERVACIONES']) ?? pickProp(rawInput, ['observaciones', 'OBSERVACIONES']) ?? '').trim();
  const fechaEmisionExtraida = String(pickProp(root, ['fechaEmision', 'fecha_emision']) ?? '').trim();
  const fechaEntregaExtraida = String(pickProp(root, ['fechaEntrega', 'fecha_entrega', 'FECHA', 'fecha', 'entrega', 'fechaEmision', 'fecha_emision']) ?? '').trim();

  let clienteCadena = String(root.clienteCadena || rawInput.clienteCadena || '').trim().toUpperCase();
  if (hasAk && !clienteCadena) {
    clienteCadena = 'ALKOSTO';
  } else if (hasFc && !hasAk) {
    clienteCadena = 'FAMILIA_CENTER';
  } else if (!clienteCadena) {
    const sedeStr = String(root.sede || '').toUpperCase();
    clienteCadena = sedeStr.startsWith('FC') ||
                    /FAMILIA/i.test(String(root.proveedorNombre || '')) ||
                    /FAMILIA/i.test(clienteNombreClean)
      ? 'FAMILIA_CENTER'
      : 'ALKOSTO';
  }

  // Calcular subtotales por cadena a partir de las tiendas si no vinieron explícitos
  const calcSubtotalAlkosto = Number(
    normalizedItems.reduce((acc, it) => {
      const akQty = Object.entries(it.tiendas || {})
        .filter(([tk]) => tk.startsWith('AK'))
        .reduce((s, [, v]) => s + v, 0);
      return acc + Number((akQty * (it.costoUnitario || 0)).toFixed(2));
    }, 0).toFixed(2)
  );
  const calcSubtotalFamilia = Number(
    normalizedItems.reduce((acc, it) => {
      const fcQty = Object.entries(it.tiendas || {})
        .filter(([tk]) => tk.startsWith('FC'))
        .reduce((s, [, v]) => s + v, 0);
      return acc + Number((fcQty * (it.costoUnitario || 0)).toFixed(2));
    }, 0).toFixed(2)
  );

  const explicitSubAk = parseNumeroEstricto(pickProp(root, ['subtotalAlkosto', 'subtotal_alkosto']), 0);
  const explicitSubFc = parseNumeroEstricto(pickProp(root, ['subtotalFamiliaCenter', 'subtotal_familia_center']), 0);
  const explicitSubGen = parseNumeroEstricto(pickProp(root, ['subtotalGeneral', 'subtotal_general']), 0);

  const finalSubAk = explicitSubAk > 0 ? explicitSubAk : (calcSubtotalAlkosto > 0 ? calcSubtotalAlkosto : undefined);
  const finalSubFc = explicitSubFc > 0 ? explicitSubFc : (calcSubtotalFamilia > 0 ? calcSubtotalFamilia : undefined);
  const finalSubGen = explicitSubGen > 0
    ? explicitSubGen
    : (finalSubAk || finalSubFc)
      ? Number(((finalSubAk || 0) + (finalSubFc || 0)).toFixed(2))
      : undefined;

  const subtotalCalc = normalizedItems.reduce((acc, it) => acc + (it.totalRenglon || 0), 0);
  const rawSubtotal = parseNumeroEstricto(root.subtotal ?? root.total, 0);

  return {
    clienteCadena,
    cadenasDetectadas: root.cadenasDetectadas || (hasAk && hasFc ? ['ALKOSTO', 'FAMILIA_CENTER'] : [clienteCadena as any]),
    clienteNombre: clienteNombreClean || undefined,
    idCliente: idClienteClean || undefined,
    ruta: rutaClean || undefined,
    supervisor: supervisorClean || undefined,
    chofer: choferClean || undefined,
    cantidadCestas: cantidadCestasClean !== undefined ? cantidadCestasClean : undefined,
    nroPedido: nroPedidoClean || undefined,
    ordenNro: rawOrdenNro || 'S/N',
    sede: String(root.sede || (clienteCadena === 'FAMILIA_CENTER' ? 'FCOP' : 'AKOP')).trim(),
    fechaEmision: normalizarFechaAlkosto(fechaEmisionExtraida || fechaEntregaExtraida || ''),
    fechaEntrega: normalizarFechaAlkosto(fechaEntregaExtraida || ''),
    diasCredito: parseNumeroEstricto(pickProp(root, ['diasCredito', 'dias_credito']), 15),
    tasaCambio: parseNumeroEstricto(pickProp(root, ['tasaCambio', 'tasa_cambio']), 0),
    proveedorNombre: String(root.proveedorNombre || 'CODIZULCA, C.A.').trim(),
    proveedorRif: String(root.proveedorRif || 'J409876136').trim(),
    observaciones: observacionesClean || undefined,
    subtotal: rawSubtotal > 0 ? rawSubtotal : Number(subtotalCalc.toFixed(2)),
    subtotalAlkosto: finalSubAk,
    subtotalFamiliaCenter: finalSubFc,
    subtotalGeneral: finalSubGen,
    items: normalizedItems
  };
}

/**
 * Normaliza estrictamente el nombre de la cadena a "ALKOSTO" o "FAMILIA CENTER"
 * en mayúsculas para coincidir exactamente con los filtros de la Sala de Espera.
 */
export function normalizarCadenaEstricta(
  tagOrName?: string,
  fallbackCadena?: string
): 'ALKOSTO' | 'FAMILIA CENTER' {
  const combined = `${tagOrName || ''} ${fallbackCadena || ''}`.toUpperCase();
  if (
    combined.includes('FAMILIA') ||
    /\bFC0?[1-7]\b|\bFCOP\b/.test(combined) ||
    /\b0*7489\b|\b0*749[0-4]\b|\b0*8229\b|\b0*5373\b/.test(combined)
  ) {
    return 'FAMILIA CENTER';
  }
  return 'ALKOSTO';
}

/**
 * Valida con regex el número de Orden de Compra (OC).
 * Nunca omite el pedido en silencio: retorna `valido: false` y `alerta` si falta o no cumple el patrón.
 */
export function validarNumeroOC(rawOc: unknown): {
  valido: boolean;
  numero_oc: string;
  alerta?: string;
} {
  const raw = String(rawOc ?? '').trim();
  if (!raw || raw.toUpperCase() === 'S/N' || raw.toUpperCase() === 'N/A' || raw.toUpperCase() === 'PENDIENTE') {
    return {
      valido: false,
      numero_oc: 'S/N',
      alerta: 'Falta el número de Orden de Compra (OC). Verifica la casilla "ORDEN DE COMPRA" antes de enviar.'
    };
  }

  // Extraer secuencia válida de OC (ej. "0000055773", "0200605591", "OC-55773")
  const match = raw.match(/(?:OC[-\s#:]*)?([A-Z0-9\-]{4,20})/i);
  const candidate = match ? match[1].trim().toUpperCase() : raw.toUpperCase();
  const hasMinDigits = (candidate.match(/\d/g) || []).length >= 4;

  if (!hasMinDigits) {
    return {
      valido: false,
      numero_oc: candidate || 'S/N',
      alerta: `El número de Orden de Compra "${raw}" no tiene al menos 4 dígitos válidos.`
    };
  }

  return {
    valido: true,
    numero_oc: candidate
  };
}

/**
 * Construye siempre el formato estandarizado de observación para Sala de Espera:
 * "{Sucursal/Ciudad} | OC {Cadena}: {numero_oc} | Dir: {direccion_despacho}"
 */
export function construirObservacionFormateada(params: {
  sucursal_cliente: string;
  ciudad_zona?: string;
  cadena: 'ALKOSTO' | 'FAMILIA CENTER';
  numero_oc?: string;
  direccion_despacho?: string;
}): string {
  const cadenaNorm = normalizarCadenaEstricta(params.cadena, params.sucursal_cliente);
  const sucursalClean = String(params.sucursal_cliente || params.ciudad_zona || cadenaNorm)
    .trim()
    .toUpperCase();
  const ocCheck = validarNumeroOC(params.numero_oc);
  const ocVal = ocCheck.numero_oc || 'S/N';

  // Limpiar dirección para no duplicar prefijos si ya venía formateada previamente
  let rawDir = String(params.direccion_despacho || '')
    .replace(/\s*\|\s*OC\s+(?:ALKOSTO|FAMILIA(?:\s+CENTER)?)\s*:\s*[^|]+/gi, '')
    .replace(/^.*\|\s*Dir:\s*/i, '')
    .trim();

  if (!rawDir || rawDir.toUpperCase() === sucursalClean) {
    rawDir = params.ciudad_zona?.trim() || sucursalClean || 'Entrega según Orden de Compra';
  }

  return `${sucursalClean} | OC ${cadenaNorm}: ${ocVal} | Dir: ${rawDir}`;
}

/**
 * Homologa el identificador de vendedora para la Sala de Espera de Pedidos Manuales.
 * Cualquier variante de Sairu Valles o Cuentas Clave 2 se estandariza exactamente a `'Sairu Valles'`
 * para coincidir con el catálogo `VS["Sairu Valles"]` y el campo `vendedor` / `ruta` de `public.orders`.
 */
export function normalizarNombreVendedorSairu(raw?: string): string {
  const s = String(raw || '').trim();
  if (!s) return 'Sairu Valles';
  const upper = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (upper.includes('SAIRU') || upper.includes('VALLES') || upper.includes('CUENTAS CLAVE')) {
    return 'Sairu Valles';
  }
  return s;
}

/**
 * Genera un ID y clave de idempotencia 100% determinista por sucursal, OC, fecha y huella de ítems,
 * respetando el prefijo `alk-<akXX|fcXX|doc>-` esperado por el clasificador de la Sala de Espera.
 * Evita duplicados en `public.orders` ante doble clic o reintentos de red.
 */
export function generarIdDeterministaPedidoAlkosto(params: {
  tagSlug: string;
  idCliente: string;
  numeroOc: string;
  fechaISO: string;
  renglones: Array<{
    codigo: string;
    unidad_medida?: string;
    cantidad: number;
    precio_unitario: number;
    descuento?: number;
    subtotal: number;
  }>;
}): string {
  const cleanTag = /^(ak\d+|fc\d+)$/i.test(params.tagSlug)
    ? params.tagSlug.toLowerCase()
    : 'doc';

  const ocClean = String(params.numeroOc || 'SN')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^0+/, '') || 'SN';

  const canonicalItems = [...params.renglones]
    .map(r =>
      `${String(r.codigo || '').trim().toUpperCase()}:${String(r.unidad_medida || '').toUpperCase()}:${Number(r.cantidad || 0).toFixed(2)}:${Number(r.precio_unitario || 0).toFixed(4)}:${Number(r.descuento || 0).toFixed(2)}:${Number(r.subtotal || 0).toFixed(2)}`
    )
    .sort()
    .join('|');

  const seed = `${cleanTag}|${String(params.idCliente || '').trim()}|${ocClean}|${String(params.fechaISO || '').slice(0, 10)}|${canonicalItems}`;

  // FNV-1a 32-bit determinista dual para huella compacta libre de colisiones
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    const code = seed.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code + (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const hashHex = `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`.slice(0, 10);
  const ocPrefix = ocClean !== 'SN' ? ocClean.slice(-6).toLowerCase() : 'm';
  return `alk-${cleanTag}-${ocPrefix}${hashHex}`;
}

/**
 * Construye un pedido bajo el Esquema de Datos Normalizado (Strict Payload) y su
 * correspondiente objeto AlkostoOrder listo para transmisión transaccional.
 */
export function construirPedidoNormalizadoSucursal(params: {
  storeTagOrCode: string;
  sucursalNombreFallback?: string;
  direccionFallback?: string;
  numero_oc: string;
  vendedor: string;
  supervisor?: string;
  chofer?: string;
  cantidadCestas?: string | number;
  fechaISO: string;
  condicionPago?: string;
  filas: Array<{
    renglon?: number;
    codigo: string;
    skuCodizulca?: string;
    descripcion: string;
    unid?: string;
    cantidad: number;
    precio_unitario: number;
    precio_bruto?: number;
    descuento?: number;
    subtotal?: number;
  }>;
  orderIndex?: number;
  batchTimestamp?: number;
  explicitCorrelativo?: string;
}): {
  strictPayload: StrictOrderPayload;
  alkostoOrder: AlkostoOrder;
  alertaOC?: string;
} {
  const suc = getSucursalByTag(params.storeTagOrCode);
  const cadena = normalizarCadenaEstricta(
    suc?.tag || params.storeTagOrCode,
    suc?.nombre || params.sucursalNombreFallback
  );

  const rawCode = String(suc?.codigo || params.storeTagOrCode || '7498').trim();
  const idClientePadded = /^\d+$/.test(rawCode) ? rawCode.padStart(6, '0') : rawCode;
  const sucursalCodigoCorto = /^\d+$/.test(rawCode) ? rawCode.replace(/^0+/, '') || rawCode : rawCode;

  const sucursalCliente = String(
    suc?.nombre || params.sucursalNombreFallback || `${cadena} (${params.storeTagOrCode})`
  )
    .trim()
    .toUpperCase();

  const direccionDespacho = String(
    suc?.direccion || params.direccionFallback || suc?.zona || 'Entrega según Orden de Compra'
  ).trim();

  const ocValidation = validarNumeroOC(params.numero_oc);
  const numeroOcFinal = ocValidation.numero_oc;

  const observacionFormateada = construirObservacionFormateada({
    sucursal_cliente: sucursalCliente,
    ciudad_zona: suc?.zona,
    cadena,
    numero_oc: numeroOcFinal,
    direccion_despacho: direccionDespacho
  });

  const vendedorHomologado = normalizarNombreVendedorSairu(params.vendedor);

  const renglonesNormalizados: StrictOrderRenglon[] = [];
  const itemsAlkosto: AlkostoOrder['items'] = [];

  params.filas.forEach((f, idx) => {
    const cantidad = parseNumeroEstricto(f.cantidad, 0);
    const precioUnitarioRaw = parseNumeroEstricto(f.precio_unitario, 0);
    const precioBrutoRaw = parseNumeroEstricto(f.precio_bruto, 0);
    const descuentoRaw = Math.max(0, parseNumeroEstricto(f.descuento, 0));
    if (cantidad <= 0 && !f.codigo && !f.descripcion) return;
    if (cantidad <= 0) return;

    const match = resolverProductoPorCodigoODescripcion(f.codigo, f.descripcion);
    const cleanSku = String(f.skuCodizulca || (match ? match.sku : f.codigo) || 'S/C').trim();
    const cleanDesc = limpiarDescripcionAlkosto(f.descripcion || (match ? match.producto : 'PRODUCTO'));
    const unid = normalizarUnidadMedidaAlkosto(f.unid, cleanDesc, undefined, match?.unidadSugerida);

    // Si se indica precio bruto y descuento porcentual (0 < descuento <= 100) sin precio unitario neto explícito:
    const precioUnitario =
      precioUnitarioRaw > 0
        ? precioUnitarioRaw
        : precioBrutoRaw > 0 && descuentoRaw > 0 && descuentoRaw <= 100
          ? Number((precioBrutoRaw * (1 - descuentoRaw / 100)).toFixed(4))
          : 0;

    const descuentoEfectivo =
      descuentoRaw > 0
        ? Number(descuentoRaw.toFixed(2))
        : precioBrutoRaw > precioUnitario && precioUnitario > 0
          ? Number((((precioBrutoRaw - precioUnitario) / precioBrutoRaw) * 100).toFixed(2))
          : 0;

    const calcSub = precioUnitario > 0
      ? Number((cantidad * precioUnitario).toFixed(2))
      : Number(parseNumeroEstricto(f.subtotal, 0).toFixed(2));
    const safePrice = Number((Number.isFinite(precioUnitario) ? precioUnitario : 0).toFixed(4));
    const safeSub = Number((Number.isFinite(calcSub) ? calcSub : 0).toFixed(2));

    const kxBox = match ? match.kilosPorCaja : (unid === 'KG' ? 1 : 10);
    const totalK = Number((unid === 'KG' ? cantidad : cantidad * kxBox).toFixed(2));
    const cajasVal = unid === 'CJ' || unid === 'BLT' ? Number(cantidad.toFixed(2)) : 0;
    const unidadesVal = unid === 'UND' ? Number(cantidad.toFixed(2)) : 0;

    renglonesNormalizados.push({
      codigo: cleanSku,
      sku: cleanSku,
      descripcion: cleanDesc,
      unidad_medida: unid,
      cantidad: Number(cantidad.toFixed(2)),
      cajas: cajasVal,
      unidades: unidadesVal,
      kilos: totalK,
      precio_unitario: safePrice,
      ...(precioBrutoRaw > 0 ? { precio_bruto: Number(precioBrutoRaw.toFixed(4)) } : {}),
      descuento: descuentoEfectivo,
      subtotal: safeSub
    });

    itemsAlkosto.push({
      id: `item-${f.renglon || idx + 1}`,
      sku: cleanSku,
      producto: cleanDesc,
      categoria: match ? match.categoria : 'CHARCUTERIA / CARNES',
      presentacion: unid,
      cantidadCajas: Number(cantidad.toFixed(2)),
      cajas: cajasVal,
      unidades: unidadesVal,
      kilosPorCaja: kxBox,
      totalKilos: totalK,
      precioUnitarioUSD: safePrice,
      ...(precioBrutoRaw > 0 ? { precioBrutoUSD: Number(precioBrutoRaw.toFixed(4)) } : {}),
      descuento: descuentoEfectivo,
      subtotalUSD: safeSub
    });
  });

  const totalRenglones = renglonesNormalizados.length;
  const montoPedido = Number(
    renglonesNormalizados.reduce((acc, r) => acc + (Number(r.subtotal) || 0), 0).toFixed(2)
  );
  const totalBultos = Number(
    renglonesNormalizados.reduce((acc, r) => acc + (Number(r.cantidad) || 0), 0).toFixed(2)
  );
  const totalKilos = Number(
    itemsAlkosto.reduce((acc, it) => acc + (Number(it.totalKilos) || 0), 0).toFixed(2)
  );

  const ts = (params.batchTimestamp || Date.now()) + (params.orderIndex || 0) * 50;
  const resolvedTag =
    suc?.tag ||
    (/^(AK|FC)\d{2}$/i.test(params.storeTagOrCode) ? params.storeTagOrCode.toUpperCase() : undefined);
  const tagSlug = String(resolvedTag || 'doc')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  const deterministicId = generarIdDeterministaPedidoAlkosto({
    tagSlug,
    idCliente: idClientePadded,
    numeroOc: numeroOcFinal,
    fechaISO: params.fechaISO,
    renglones: renglonesNormalizados
  });

  const strictPayload: StrictOrderPayload = {
    id: deterministicId,
    idempotency_key: deterministicId,
    correlativo: params.explicitCorrelativo,
    cadena,
    id_cliente: idClientePadded,
    sucursal_cliente: sucursalCliente,
    sucursal_tag: resolvedTag,
    numero_oc: numeroOcFinal,
    direccion_despacho: direccionDespacho,
    observacion_formateada: observacionFormateada,
    vendedor: vendedorHomologado,
    renglones: renglonesNormalizados,
    total_renglones: totalRenglones,
    monto_pedido: montoPedido,
    estado: 'POR VALIDAR',
    estado_sala_espera: 'POR_VALIDAR',
    origen: 'APP FDV',
    fecha: params.fechaISO,
    supervisor: params.supervisor,
    chofer: params.chofer,
    cantidad_cestas: params.cantidadCestas
  };

  const alkostoOrder: AlkostoOrder = {
    id: deterministicId,
    idempotencyKey: deterministicId,
    sucursalTag: resolvedTag,
    numeroPedido: params.explicitCorrelativo || 'AUTO',
    correlativo: params.explicitCorrelativo,
    ordenCompraAlkosto: numeroOcFinal !== 'S/N' ? numeroOcFinal : undefined,
    sucursalCodigo: sucursalCodigoCorto,
    sucursalNombre: sucursalCliente,
    direccionEntrega: direccionDespacho,
    vendedora: vendedorHomologado,
    ruta: vendedorHomologado,
    fechaPedido: params.fechaISO,
    fechaEntregaEstimada: params.fechaISO,
    items: itemsAlkosto,
    totalBultos,
    totalKilos,
    totalUSD: montoPedido,
    estado: 'ENVIADO',
    estadoSalaEspera: 'POR_VALIDAR',
    transmitido_a_pedidos_manuales: false,
    condicionPago: params.condicionPago || 'Crédito 21 días',
    observaciones: observacionFormateada,
    createdAt: new Date(ts).toISOString(),
    cadena,
    sucursal_cliente: sucursalCliente,
    numero_oc: numeroOcFinal,
    direccion_despacho: direccionDespacho,
    observacion_formateada: observacionFormateada,
    vendedor: vendedorHomologado,
    renglones: renglonesNormalizados,
    total_renglones: totalRenglones,
    monto_pedido: montoPedido,
    totalNeto: montoPedido,
    origen: 'APP FDV',
    strict_payload: strictPayload
  };

  return {
    strictPayload,
    alkostoOrder,
    alertaOC: ocValidation.alerta
  };
}

/**
 * Extrae el 100% de los pedidos por sucursal/sede (Multi-Sucursal y Multi-Cadena: Alkosto + Familia Center)
 * contenidos en una Orden de Compra, sin truncar ni mezclar renglones entre sucursales.
 */
export function extraerPedidosNormalizadosDeOC(params: {
  initialData?: ParsedOrdenCompraAlkosto | null;
  filasActuales: CodizulcaNotaPedidoItem[];
  tiendaSeleccionada: string;
  enviarLoteCompleto?: boolean;
  idClienteSeleccionado: string;
  clienteNombreSeleccionado: string;
  direccionObservacionFallback?: string;
  numero_oc: string;
  vendedor: string;
  supervisor?: string;
  chofer?: string;
  cantidadCestas?: string | number;
  fechaISO: string;
  nroPedido?: string;
}): {
  pedidos: AlkostoOrder[];
  strictPayloads: StrictOrderPayload[];
  tiendasConPedido: string[];
  alertaOC?: string;
} {
  const {
    initialData,
    filasActuales,
    tiendaSeleccionada,
    enviarLoteCompleto = true,
    idClienteSeleccionado,
    clienteNombreSeleccionado,
    direccionObservacionFallback,
    numero_oc,
    vendedor,
    supervisor,
    chofer,
    cantidadCestas,
    fechaISO,
    nroPedido
  } = params;

  // Combinar la matriz de tiendas desde initialData.items y filasActuales para nunca perder
  // ni las tiendas de otra cadena (ej. FC01..FC07 cuando se visualiza AK) ni las ediciones hechas en tabla.
  const rawItemsFromOC = Array.isArray(initialData?.items) ? initialData!.items : [];

  // Orden oficial determinista de las 17 sucursales comerciales (AK01..AK10 y FC01..FC07)
  const orderedCandidateTags = [
    ...SUCURSALES_ALKOSTO.map(s => s.tag!).filter(Boolean),
    ...SUCURSALES_FAMILIA_CENTER.map(s => s.tag!).filter(Boolean)
  ];

  // Mapa por código o SKU para reconciliar ediciones manuales en filasActuales sin contaminar por índice
  const editedByCode = new Map<string, CodizulcaNotaPedidoItem>();
  filasActuales.forEach(f => {
    const skuKey = String(f.skuCodizulca || f.codigo || '').trim().toUpperCase();
    const codKey = String(f.codigo || '').trim().toUpperCase();
    const barKey = String(f.codigoBarra || '').trim().toUpperCase();
    if (skuKey) editedByCode.set(skuKey, f);
    if (codKey) editedByCode.set(codKey, f);
    if (barKey) editedByCode.set(barKey, f);
  });

  // Fuente maestra de filas con tiendas
  const masterRows: Array<{
    renglon: number;
    codigo: string;
    skuCodizulca?: string;
    descripcion: string;
    unid: string;
    precio: number;
    precioBruto?: number;
    descuento?: number;
    cantSolicitada: number;
    tiendas?: Record<string, number>;
  }> = [];

  const usedEditedKeys = new Set<string>();

  if (rawItemsFromOC.length > 0) {
    rawItemsFromOC.forEach((ocItem, idx) => {
      const match = resolverProductoPorCodigoODescripcion(ocItem.codigo, ocItem.descripcion);
      const skuKey = String(ocItem.skuCodizulca || (match ? match.sku : ocItem.codigo) || '').trim().toUpperCase();
      const rawKey = String(ocItem.codigo || '').trim().toUpperCase();
      const barKey = String(ocItem.codigoBarra || match?.codigoBarra || '').trim().toUpperCase();

      // Solo cruzar por clave exacta de producto (NUNCA usar filasActuales[idx] cuando la vista está filtrada por tienda)
      const editedRow = editedByCode.get(skuKey) || editedByCode.get(rawKey) || (barKey ? editedByCode.get(barKey) : undefined);
      if (skuKey) usedEditedKeys.add(skuKey);
      if (rawKey) usedEditedKeys.add(rawKey);
      if (barKey) usedEditedKeys.add(barKey);

      const mergedTiendas: Record<string, number> = {
        ...(ocItem.tiendas || {}),
        ...(editedRow?.tiendas || {})
      };

      // Si el usuario estaba viendo una tienda específica (ej. AK01) y editó manualmente cantSolicitada en la tabla:
      if (
        tiendaSeleccionada !== 'CONSOLIDADO' &&
        editedRow &&
        (editedRow.codigo || editedRow.descripcion)
      ) {
        const editedQty = parseNumeroEstricto(editedRow.cantSolicitada, 0);
        if (editedQty > 0) {
          mergedTiendas[tiendaSeleccionada] = editedQty;
        }
      }

      const finalSku = editedRow?.codigo || ocItem.skuCodizulca || (match ? match.sku : ocItem.codigo);
      const finalDesc = limpiarDescripcionAlkosto(editedRow?.descripcion || ocItem.descripcion || (match ? match.producto : ''));
      const finalUnid = normalizarUnidadMedidaAlkosto(
        editedRow?.unid || ocItem.unid,
        finalDesc,
        ocItem.emp,
        match?.unidadSugerida
      );
      const finalPrecio =
        parseNumeroEstricto(editedRow?.precio, 0) ||
        parseNumeroEstricto(ocItem.costoUnitario, 0) ||
        (match?.precioSugeridoUSD ?? 0);
      const finalPrecioBruto =
        parseNumeroEstricto(editedRow?.precioBruto, 0) ||
        parseNumeroEstricto(ocItem.costoBruto, 0);
      const finalDescuento = parseNumeroEstricto(editedRow?.descuento, 0);

      masterRows.push({
        renglon: idx + 1,
        codigo: finalSku,
        skuCodizulca: finalSku,
        descripcion: finalDesc,
        unid: finalUnid,
        precio: finalPrecio,
        precioBruto: finalPrecioBruto > 0 ? finalPrecioBruto : undefined,
        descuento: finalDescuento > 0 ? finalDescuento : undefined,
        cantSolicitada: parseNumeroEstricto(editedRow?.cantSolicitada, 0) || parseNumeroEstricto(ocItem.totalCantidad, 0),
        tiendas: mergedTiendas
      });
    });
  }

  // Agregar cualquier fila extra que la vendedora haya insertado manualmente en la tabla y que no estuviera en rawItemsFromOC
  filasActuales.forEach(f => {
    if (!f.codigo && !f.descripcion) return;
    const cant = parseNumeroEstricto(f.cantSolicitada, 0);
    if (cant <= 0) return;
    const key = String(f.codigo || f.skuCodizulca || '').trim().toUpperCase();
    if (rawItemsFromOC.length > 0 && usedEditedKeys.has(key)) {
      return;
    }
    masterRows.push({
      renglon: f.renglon || masterRows.length + 1,
      codigo: f.codigo,
      skuCodizulca: f.skuCodizulca || f.codigo,
      descripcion: limpiarDescripcionAlkosto(f.descripcion),
      unid: f.unid || 'CJ',
      precio: parseNumeroEstricto(f.precio, 0),
      precioBruto: parseNumeroEstricto(f.precioBruto, 0) || undefined,
      descuento: parseNumeroEstricto(f.descuento, 0) || undefined,
      cantSolicitada: cant,
      tiendas: f.tiendas
    });
  });

  // Identificar el 100% de las tiendas con cantidad > 0 en toda la Orden de Compra
  // (excluyendo columnas con 0.00 en todos los productos o columnas administrativas como AKOP, FCOP, CI)
  const detectedStoresSet = new Set<string>();
  masterRows.forEach(r => {
    if (r.tiendas && typeof r.tiendas === 'object') {
      Object.entries(r.tiendas).forEach(([tag, val]) => {
        const uTag = tag.trim().toUpperCase();
        const numVal = parseNumeroEstricto(val, 0);
        if (uTag !== 'CI' && uTag !== 'AKOP' && uTag !== 'FCOP' && Number.isFinite(numVal) && !Number.isNaN(numVal) && numVal > 0) {
          detectedStoresSet.add(uTag);
        }
      });
    }
  });

  const tiendasConPedido = orderedCandidateTags.filter(t => detectedStoresSet.has(t));
  // Añadir cualquier otro tag válido no listado en orderedCandidateTags
  Array.from(detectedStoresSet).forEach(t => {
    if (!tiendasConPedido.includes(t)) tiendasConPedido.push(t);
  });

  const pedidos: AlkostoOrder[] = [];
  const strictPayloads: StrictOrderPayload[] = [];
  let alertaOC: string | undefined;
  const batchTimestamp = Date.now();

  // Si existen múltiples tiendas en la OC y se solicita enviar el lote completo (comportamiento por defecto para evitar pérdida de sucursales):
  const targetStores =
    enviarLoteCompleto && tiendasConPedido.length > 0
      ? tiendasConPedido
      : tiendaSeleccionada !== 'CONSOLIDADO' && tiendasConPedido.includes(tiendaSeleccionada)
        ? [tiendaSeleccionada]
        : tiendasConPedido;

  if (targetStores.length > 0) {
    targetStores.forEach((storeTag, idx) => {
      const storeFilas = masterRows
        .map(r => {
          const cant = r.tiendas ? parseNumeroEstricto(r.tiendas[storeTag], 0) : 0;
          if (!Number.isFinite(cant) || Number.isNaN(cant) || cant <= 0) return null;
          const precio = Number.isFinite(r.precio) ? r.precio : 0;
          return {
            renglon: r.renglon,
            codigo: r.codigo,
            skuCodizulca: r.skuCodizulca,
            descripcion: r.descripcion,
            unid: r.unid,
            cantidad: cant,
            precio_unitario: precio,
            precio_bruto: r.precioBruto,
            descuento: r.descuento,
            subtotal: Number((cant * precio).toFixed(2))
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (storeFilas.length > 0) {
        const built = construirPedidoNormalizadoSucursal({
          storeTagOrCode: storeTag,
          numero_oc,
          vendedor,
          supervisor,
          chofer,
          cantidadCestas,
          fechaISO,
          filas: storeFilas,
          orderIndex: idx,
          batchTimestamp
        });
        pedidos.push(built.alkostoOrder);
        strictPayloads.push(built.strictPayload);
        if (built.alertaOC) alertaOC = built.alertaOC;
      }
    });
  }

  // Caso de orden manual de una sola sucursal (sin desglose de matriz `tiendas`)
  if (pedidos.length === 0) {
    const validRows = filasActuales
      .filter(f => {
        const cant = parseNumeroEstricto(f.cantSolicitada, 0);
        return (f.codigo || f.descripcion) && Number.isFinite(cant) && !Number.isNaN(cant) && cant > 0;
      })
      .map(f => {
        const cant = parseNumeroEstricto(f.cantSolicitada, 0);
        const precio = parseNumeroEstricto(f.precio, 0);
        return {
          renglon: f.renglon,
          codigo: f.codigo,
          skuCodizulca: f.skuCodizulca,
          descripcion: limpiarDescripcionAlkosto(f.descripcion),
          unid: f.unid,
          cantidad: cant,
          precio_unitario: precio,
          precio_bruto: parseNumeroEstricto(f.precioBruto, 0) || undefined,
          descuento: parseNumeroEstricto(f.descuento, 0) || undefined,
          subtotal: Number((cant * precio).toFixed(2))
        };
      });

    if (validRows.length > 0) {
      const storeRef = tiendaSeleccionada !== 'CONSOLIDADO' ? tiendaSeleccionada : idClienteSeleccionado;
      const explicitCorr =
        nroPedido && nroPedido !== 'AUTO' && !nroPedido.startsWith('PENDIENTE') ? nroPedido : undefined;
      const built = construirPedidoNormalizadoSucursal({
        storeTagOrCode: storeRef,
        sucursalNombreFallback: clienteNombreSeleccionado,
        direccionFallback: direccionObservacionFallback,
        numero_oc,
        vendedor,
        supervisor,
        chofer,
        cantidadCestas,
        fechaISO,
        filas: validRows,
        orderIndex: 0,
        batchTimestamp,
        explicitCorrelativo: explicitCorr
      });
      pedidos.push(built.alkostoOrder);
      strictPayloads.push(built.strictPayload);
      if (built.alertaOC) alertaOC = built.alertaOC;
    }
  }

  return {
    pedidos,
    strictPayloads,
    tiendasConPedido,
    alertaOC
  };
}

/**
 * Calcula el resumen de validación matemática pre-envío para una Orden de Compra (FASE 4):
 * Ejemplo:
 * "OC #0000055773 | 16 Sucursales Activas (9 Alkosto: $11,321.85 | 7 Familia Center: $4,149.02) | Total OC: $15,470.87 ✓ Cuadre Exacto"
 */
export function calcularResumenCuadreOC(
  data: ParsedOrdenCompraAlkosto | null | undefined,
  ordenNroOverride?: string
): {
  numero_oc: string;
  totalSucursalesActivas: number;
  alkostoCount: number;
  alkostoMonto: number;
  familiaCount: number;
  familiaMonto: number;
  totalCalculado: number;
  totalEsperadoPDF: number;
  cuadreExacto: boolean;
  textoResumen: string;
} | null {
  if (!data || !Array.isArray(data.items) || data.items.length === 0) return null;

  const numero_oc = String(ordenNroOverride || data.ordenNro || 'S/N').trim();
  const akStoresTotals = new Map<string, number>();
  const fcStoresTotals = new Map<string, number>();

  for (const item of data.items) {
    const precio = parseNumeroEstricto(item.costoUnitario, 0);
    if (!item.tiendas || typeof item.tiendas !== 'object') continue;
    for (const [rawTag, rawQty] of Object.entries(item.tiendas)) {
      const tag = rawTag.trim().toUpperCase();
      if (tag === 'CI' || tag === 'AKOP' || tag === 'FCOP') continue;
      const qty = parseNumeroEstricto(rawQty, 0);
      if (!Number.isFinite(qty) || Number.isNaN(qty) || qty <= 0) continue;
      const lineSub = Number((qty * precio).toFixed(2));
      if (tag.startsWith('AK')) {
        akStoresTotals.set(tag, Number(((akStoresTotals.get(tag) || 0) + lineSub).toFixed(2)));
      } else if (tag.startsWith('FC')) {
        fcStoresTotals.set(tag, Number(((fcStoresTotals.get(tag) || 0) + lineSub).toFixed(2)));
      }
    }
  }

  const alkostoCount = akStoresTotals.size;
  const familiaCount = fcStoresTotals.size;
  const totalSucursalesActivas = alkostoCount + familiaCount;

  if (totalSucursalesActivas === 0) return null;

  const alkostoMonto = Number(
    Array.from(akStoresTotals.values()).reduce((a, b) => a + b, 0).toFixed(2)
  );
  const familiaMonto = Number(
    Array.from(fcStoresTotals.values()).reduce((a, b) => a + b, 0).toFixed(2)
  );
  const totalCalculado = Number((alkostoMonto + familiaMonto).toFixed(2));

  const subAkPdf = parseNumeroEstricto(data.subtotalAlkosto, 0);
  const subFcPdf = parseNumeroEstricto(data.subtotalFamiliaCenter, 0);
  const subGenPdf = parseNumeroEstricto(data.subtotalGeneral, 0);

  const totalEsperadoPDF = subGenPdf > 0
    ? subGenPdf
    : (subAkPdf > 0 || subFcPdf > 0)
      ? Number(((subAkPdf > 0 ? subAkPdf : alkostoMonto) + (subFcPdf > 0 ? subFcPdf : familiaMonto)).toFixed(2))
      : totalCalculado;

  const cuadreAk = subAkPdf > 0 ? Math.abs(alkostoMonto - subAkPdf) <= 0.05 : true;
  const cuadreFc = subFcPdf > 0 ? Math.abs(familiaMonto - subFcPdf) <= 0.05 : true;
  const cuadreTotal = Math.abs(totalCalculado - totalEsperadoPDF) <= 0.05;
  const cuadreExacto = cuadreAk && cuadreFc && cuadreTotal;

  const fmtUSD = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const partesCadena: string[] = [];
  if (alkostoCount > 0) {
    partesCadena.push(`${alkostoCount} Alkosto: ${fmtUSD(alkostoMonto)}`);
  }
  if (familiaCount > 0) {
    partesCadena.push(`${familiaCount} Familia Center: ${fmtUSD(familiaMonto)}`);
  }

  const estadoTexto = cuadreExacto ? '✓ Cuadre Exacto' : `⚠️ Diferencia vs PDF (${fmtUSD(totalEsperadoPDF)})`;
  const textoResumen = `OC #${numero_oc} | ${totalSucursalesActivas} Sucursales Activas (${partesCadena.join(' | ')}) | Total OC: ${fmtUSD(totalCalculado)} ${estadoTexto}`;

  return {
    numero_oc,
    totalSucursalesActivas,
    alkostoCount,
    alkostoMonto,
    familiaCount,
    familiaMonto,
    totalCalculado,
    totalEsperadoPDF,
    cuadreExacto,
    textoResumen
  };
}
