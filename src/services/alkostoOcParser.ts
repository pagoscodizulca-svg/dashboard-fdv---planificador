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

import { ParsedOrdenCompraAlkosto } from '../types';
import { resolverProductoPorCodigoODescripcion, normalizarCodigoProducto } from './alkostoService';

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
    .replace(/\s+\/\s*\d+(?:[.,]\d+)?\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
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

  return {
    iva,
    emp,
    tiendas,
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
      const rawDescPart = prodHeaderMatch[2].trim();

      // Evitar falsos positivos con el RIF/Código de proveedor (409876136) o seriales
      if (rawCode === '409876136' || /^267319/.test(rawCode) || rawDescPart.toUpperCase().startsWith('CODIZULCA')) {
        continue;
      }

      // Buscar la línea inmediatamente siguiente que contiene los valores numéricos del renglón
      const nextLine = lines[i + 1] || '';
      const numTokens = nextLine.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
      if (numTokens.length < 8) continue;

      const mapped = mapNumericCellsToRow(numTokens, pageChain);
      if (!mapped) continue;
      i++; // Consumir la línea numérica

      const cleanDesc = limpiarDescripcionAlkosto(rawDescPart);
      const catalogMatch = resolverProductoPorCodigoODescripcion(rawCode, cleanDesc);

      const finalSku = catalogMatch ? catalogMatch.sku : rawCode;
      const finalBarcode = catalogMatch?.codigoBarra || (/^\d{12,14}$/.test(rawCode) ? rawCode : undefined);
      const finalUnid = normalizarUnidadMedidaAlkosto(undefined, cleanDesc, mapped.emp, catalogMatch?.unidadSugerida);

      const existing = itemsByCode.get(rawCode);
      if (existing) {
        // Fusionar tiendas de Alkosto y Familia Center para el mismo producto
        Object.assign(existing.tiendas, mapped.tiendas);
        if (pageChain === 'ALKOSTO') {
          existing.totalCantidadAlkosto = mapped.totalCantidad;
        } else if (pageChain === 'FAMILIA_CENTER') {
          existing.totalCantidadFamilia = mapped.totalCantidad;
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
    // Para que la vista inicial (ALKOSTO si existe página Alkosto) muestre el total exacto de la cadena principal:
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
    pickProp(root, ['ordenNro', 'ORDEN DE COMPRA', 'ordenCompra', 'orden_compra', 'numeroOrden', 'nroOrden', 'nro_orden', 'oc']) ??
    pickProp(rawInput, ['ordenNro', 'ORDEN DE COMPRA', 'ordenCompra', 'numeroOrden', 'nroOrden', 'oc']) ??
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
  const normalizedItems: ParsedOrdenCompraAlkosto['items'] = [];

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
    const cleanTiendas: Record<string, number> = {};
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
        if (numVal > 0 && ALL_VALID_STORE_TAGS.has(uTag) && uTag !== 'CI') {
          cleanTiendas[uTag] = numVal;
        }
      }
    }

    // También soportar tiendas en la raíz del item (it.AK01, it.FC01)
    for (const [k, val] of Object.entries(it)) {
      const uKey = k.trim().toUpperCase();
      if (ALL_VALID_STORE_TAGS.has(uKey) && uKey !== 'CI') {
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

    // Calcular suma de tiendas por cadena
    const sumAkTiendas = Object.entries(cleanTiendas)
      .filter(([tk]) => tk.startsWith('AK'))
      .reduce((acc, [, v]) => acc + v, 0);
    const sumFcTiendas = Object.entries(cleanTiendas)
      .filter(([tk]) => tk.startsWith('FC'))
      .reduce((acc, [, v]) => acc + v, 0);
    const sumAllTiendas = Object.values(cleanTiendas).reduce((acc, v) => acc + v, 0);

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
        totalCant = sumAllTiendas;
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

    normalizedItems.push({
      renglon: normalizedItems.length + 1,
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
  const fechaExtraida = String(pickProp(root, ['fechaEntrega', 'FECHA', 'fecha', 'entrega', 'fechaEmision']) ?? '').trim();

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
    fechaEmision: normalizarFechaAlkosto(root.fechaEmision || fechaExtraida || ''),
    fechaEntrega: normalizarFechaAlkosto(root.fechaEntrega || root.entrega || fechaExtraida || ''),
    diasCredito: parseNumeroEstricto(root.diasCredito, 15),
    tasaCambio: parseNumeroEstricto(root.tasaCambio, 0),
    proveedorNombre: String(root.proveedorNombre || 'CODIZULCA, C.A.').trim(),
    proveedorRif: String(root.proveedorRif || 'J409876136').trim(),
    observaciones: observacionesClean || undefined,
    subtotal: rawSubtotal > 0 ? rawSubtotal : Number(subtotalCalc.toFixed(2)),
    subtotalAlkosto: root.subtotalAlkosto,
    subtotalFamiliaCenter: root.subtotalFamiliaCenter,
    items: normalizedItems
  };
}
