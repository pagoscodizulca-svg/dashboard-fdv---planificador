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

import {
  ParsedOrdenCompraAlkosto,
  DistribucionPorTiendaItem,
  AlkostoOcCabeceraOrden,
  AlkostoOcDistribucionTienda,
  AlkostoOcRenglonExtraido,
  AlkostoOcResumenTotales,
  AlkostoOcCanonicalPayload,
  StrictOrderPayload,
  StrictOrderRenglon,
  AlkostoOrder,
  CodizulcaNotaPedidoItem
} from '../types';
import {
  resolverProductoPorCodigoODescripcion,
  normalizarCodigoProducto,
  getSucursalByTag,
  SUCURSALES_ALKOSTO,
  SUCURSALES_FAMILIA_CENTER,
  CADENAS_ABREVIATURAS
} from './alkostoService';

/**
 * Lista oficial de modelos Gemini en cascada automática (Paso 3):
 * 1º `gemini-2.5-flash` (óptimo en velocidad y lectura de tablas multimodales, evitando timeouts en Render)
 * 2º `gemini-2.5-pro` (máxima profundidad analítica de respaldo)
 * 3º `gemini-2.0-flash` (respaldo de compatibilidad)
 */
export const ALKOSTO_OCR_MODEL_CASCADE = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash'
] as const;

export type AlkostoOcrStage =
  | '1-Archivo'
  | '2-Conexión Gemini-Render'
  | '3-Parseo JSON'
  | '4-Mapeo Nota de Pedido';

export class AlkostoOcrStageError extends Error {
  public readonly stage: AlkostoOcrStage;
  public readonly statusCode?: number;
  public readonly code?: string;
  public readonly details?: any;

  constructor(stage: AlkostoOcrStage, message: string, options?: { statusCode?: number; code?: string; details?: any }) {
    const cleanMsg = String(message || 'Error desconocido').replace(/^Error en Etapa \[[^\]]+\]:\s*/i, '');
    super(`Error en Etapa [${stage}]: ${cleanMsg}`);
    this.name = 'AlkostoOcrStageError';
    this.stage = stage;
    this.statusCode = options?.statusCode;
    this.code = options?.code;
    this.details = options?.details;
  }
}

/**
 * Construye dinámicamente el System Prompt del motor OCR inyectando las 17 abreviaturas sincronizadas
 * en base de datos (`AK01` a `AK10` para Alkosto y `FC01` a `FC07` para Familia Center), ignorando `AKOP` y `CI`.
 */
export function buildAlkostoOcSystemPrompt(
  abrevAlkosto: string[] = CADENAS_ABREVIATURAS?.ALKOSTO || ['AK01', 'AK02', 'AK03', 'AK04', 'AK05', 'AK06', 'AK07', 'AK08', 'AK09', 'AK10'],
  abrevFamilia: string[] = CADENAS_ABREVIATURAS?.FAMILIA_CENTER || ['FC01', 'FC02', 'FC03', 'FC04', 'FC05', 'FC06', 'FC07']
): string {
  const akTagsStr = (abrevAlkosto || []).join(', ');
  const fcTagsStr = (abrevFamilia || []).join(', ');
  const sucursalesAkDetalle = (SUCURSALES_ALKOSTO || [])
    .map(s => `${s.tag || s.codigo}: "${s.nombre}" (ID ${s.codigo})`)
    .join(' | ');
  const sucursalesFcDetalle = (SUCURSALES_FAMILIA_CENTER || [])
    .map(s => `${s.tag || s.codigo}: "${s.nombre}" (ID ${s.codigo})`)
    .join(' | ');

  return `ROL Y OBJETIVO:
Eres un motor experto en extracción de datos contables y comerciales (OCR + Comprensión Documental) especializado en procesar Órdenes de Compra emitidas por ALKOSTO y FAMILIA CENTER para ser integradas automáticamente en la Nota de Pedido de Codizulca.

TAREA PRINCIPAL:
Analiza minuciosamente la imagen, captura o documento PDF adjunto correspondiente a una Orden de Compra de ALKOSTO / FAMILIA CENTER en TODAS sus páginas. Extrae la totalidad de los datos de cabecera, todos los renglones de productos, códigos, el desglose de cantidades por tienda/sucursal y los montos financieros, sin omitir ni resumir ningún ítem.

17 TIENDAS VÁLIDAS SINCRONIZADAS EN BASE DE DATOS (ÚNICAS PERMITIDAS):
- Alkosto (${akTagsStr}): ${sucursalesAkDetalle}
- Familia Center (${fcTagsStr}): ${sucursalesFcDetalle}
- PROHIBIDO extraer las columnas administrativas "AKOP", "FCOP" o "CI": ignóralas por completo.

REGLAS ESTRICTAS DE EXTRACCIÓN Y NORMALIZACIÓN (PASO 4):
1. LECTURA MULTIPÁGINA Y UNIFICACIÓN (ALKOSTO + FAMILIA CENTER):
   - Lee todas las páginas del documento (unificando la sección de Página 1 "ALKOSTO DONDE COMPRAR ES GANAR, C.A." y la de Página 2 "FAMILIA CENTER, C.A.").
   - Nunca utilices comentarios como "// resto de los ítems".
2. EXCLUSIÓN DE COLUMNAS EXTRA (AKOP / CI) Y EXTRACCIÓN DE LAS 17 TIENDAS:
   - Extrae únicamente las 17 tiendas válidas sincronizadas en base de datos (${akTagsStr} y ${fcTagsStr}).
   - Ignora por completo las columnas "AKOP", "FCOP" y "CI" que aparecen en las tablas del PDF.
3. CONSOLIDACIÓN POR CÓDIGO DE PRODUCTO SIN DUPLICADOS:
   - Si el mismo código de producto (ej. "7590377000503", "7590377000510") aparece en la página de ALKOSTO (AK01..AK10) y en la página de FAMILIA CENTER (FC01..FC07), consolida sus cantidades por tienda en un único renglón por producto dentro de \`tiendas\` (ej. \`{"AK01": 15, ..., "FC01": 10}\`) y en \`distribucion_tiendas\`, evitando claves o filas duplicadas.
   - Homologación oficial Codizulca:
     * 7591289609129 -> codigo_principal: "21", codigo_ean: "7591289609129", unidad_medida: "CJ", descripcion_producto: "MORTADELA DE POLLO DEL CORRAL 1KG"
     * 7591289400023 -> codigo_principal: "047", codigo_ean: "7591289400023", unidad_medida: "UND", descripcion_producto: "NUGGETS DE POLLO DEL CORRAL 460GR"
     * 5412873178161 -> codigo_principal: "1360", codigo_ean: "5412873178161", unidad_medida: "CJ", descripcion_producto: "PAPAS FRITAS CONGELADAS MARQUISE 2,5KG"
     * 7590377000077 -> codigo_principal: "1496", codigo_ean: "7590377000077", unidad_medida: "CJ", descripcion_producto: "MORTADELA ESPECIAL DE POLLO 900GR ASTURIAS"
     * 7590377000589 -> codigo_principal: "1497", codigo_ean: "7590377000589", unidad_medida: "CJ", descripcion_producto: "MORTADELA ESPECIAL DE POLLO ASTURIA 500GR"
     * 100881 -> codigo_principal: "1512", codigo_interno_alkosto: "100881", unidad_medida: "KG", descripcion_producto: "PECHUGA DE PAVO ASTURIAS X KG"
     * 100882 -> codigo_principal: "1511", codigo_interno_alkosto: "100882", unidad_medida: "KG", descripcion_producto: "PECHUGA DE POLLO ASTURIAS X KG"
     * 100929 -> codigo_principal: "171", codigo_interno_alkosto: "100929", unidad_medida: "KG", descripcion_producto: "JAMON COCIDO DE PAVO AHUMADO SUPERIOR ASTURIAS X KG"
     * 100281 -> codigo_principal: "100281", codigo_interno_alkosto: "100281", unidad_medida: "KG", descripcion_producto: "QUESO MOZZARELLA CORLASA X KG"
     * 7591210000513 -> codigo_principal: "7591210000513", codigo_ean: "7591210000513", unidad_medida: "CJ", descripcion_producto: "CREMA DE LECHE PURISIMA 500GR"
     * 7591210000544 -> codigo_principal: "7591210000544", codigo_ean: "7591210000544", unidad_medida: "CJ", descripcion_producto: "CREMA DE LECHE PURISIMA 250GR"
     * 7590377000503 -> codigo_principal: "7590377000503", codigo_ean: "7590377000503", unidad_medida: "CJ", descripcion_producto: "LECHE EN POLVO COMPLETA VENCAMPO 400GR"
     * 7590377000510 -> codigo_principal: "7590377000510", codigo_ean: "7590377000510", unidad_medida: "CJ", descripcion_producto: "LECHE EN POLVO COMPLETA VENCAMPO 900GR"
   - Elimina siempre el sufijo de PVP sugerido tras la barra en la descripción (ej. quitar "/ 2.40", "/ 6.88").
4. FORMATO NUMÉRICO ESTÁNDAR (CRÍTICO):
   - Normaliza todos los números eliminando comas de miles ("9,600.00" -> 9600, "46,150.00" -> 46150) y reduciendo costos de 4 decimales ("40.0000" -> 40, "90.0000" -> 90).
   - Usa punto \`.\` exclusivamente como separador decimal y elimina símbolos de moneda \`$\`, \`Bs\`, \`%\`.
5. CABECERA COMPLETA Y VALIDACIÓN ARITMÉTICA:
   - Extrae la cabecera completa: \`numero_orden\`, \`fecha_emision\`, \`fecha_entrega\`, \`dias_credito\`, \`tasa_cambio\` y \`observaciones\`.
   - Comprueba en cada renglón si \`cantidad_total * costo_unitario\` coincide con \`monto_total_renglon\`. Si hay discrepancia por lectura borrosa en foto, prioriza valores legibles y marca \`alerta_revision: true\`.
6. SALIDA JSON PURA:
   - Devuelve ÚNICAMENTE un objeto JSON válido sin bloques Markdown (\`\`\`json) ni texto adicional.

ESQUEMA JSON DE SALIDA REQUERIDO:
{
  "numero_orden": "0000054457",
  "fecha_emision": "YYYY-MM-DD",
  "fecha_entrega": "YYYY-MM-DD",
  "dias_credito": 10,
  "tasa_cambio": 872.3927,
  "observaciones": "string | null",
  "subtotal_alkosto": 0.0,
  "subtotal_familia_center": 0.0,
  "total_factura": 0.0,
  "cabecera_orden": {
    "cliente_emisor": "ALKOSTO",
    "receptor_destino": "CODIZULCA",
    "numero_orden_compra": "string",
    "fecha_emision": "YYYY-MM-DD",
    "fecha_entrega_estimada": "YYYY-MM-DD | null",
    "dias_credito": 10,
    "tasa_cambio": 872.3927,
    "moneda": "USD",
    "condicion_pago": "string | null",
    "observaciones_generales": "string | null"
  },
  "renglones": [
    {
      "numero_renglon": 1,
      "codigo_principal": "string",
      "codigo_ean": "string | null",
      "codigo_interno_alkosto": "string | null",
      "descripcion_producto": "string",
      "unidad_medida": "CJ",
      "unidades_por_empaque": 1,
      "cantidad_total": 0.0,
      "tiendas": {
        "AK01": 0.0,
        "FC01": 0.0
      },
      "distribucion_tiendas": [
        {
          "codigo_tienda": "AK01",
          "nombre_tienda": "string",
          "cantidad": 0.0
        }
      ],
      "costo_unitario": 0.0,
      "porcentaje_descuento": 0.0,
      "porcentaje_impuesto": 0.0,
      "monto_total_renglon": 0.0,
      "alerta_revision": false,
      "nota_revision": "string | null"
    }
  ],
  "resumen_totales": {
    "total_renglones_extraidos": 0,
    "total_unidades_pedidas": 0.0,
    "subtotal_neto": 0.0,
    "total_descuentos": 0.0,
    "total_impuestos": 0.0,
    "monto_total_orden": 0.0,
    "cuadre_aritmetico_correcto": true
  }
}`;
}

export const ALKOSTO_OC_EXTRACTION_SYSTEM_PROMPT = buildAlkostoOcSystemPrompt();

/**
 * Extrae el Base64 limpio desde el resultado de un `FileReader` (`readerResult.includes(',') ? readerResult.split(',')[1] : readerResult`)
 * eliminando cualquier prefijo `data:<mime>;base64,` y espacios en blanco.
 */
export function sanitizeBase64Payload(rawBase64: string): string {
  if (!rawBase64 || typeof rawBase64 !== 'string') return '';
  const readerResult = rawBase64.trim();
  const base64Data = readerResult.includes(',')
    ? readerResult.split(',')[1] || ''
    : readerResult.replace(/^data:[^;]+;base64,/i, '');
  return base64Data.replace(/\s+/g, '');
}

/**
 * Determina el `mimeType` de forma segura para archivos de Orden de Compra (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`).
 * Si `file.type` (`declaredMimeType`) está vacío o es genérico, lo infiere por la extensión (`.pdf`, `.jpg/.jpeg`, `.png`, `.webp`)
 * y por los magic bytes del contenido Base64/Buffer.
 */
export function detectAlkostoFileMimeType(
  bytesOrBase64?: Uint8Array | Buffer | string | null,
  declaredMimeType?: string | null,
  fileName?: string | null
): 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' {
  if (bytesOrBase64) {
    if (typeof bytesOrBase64 === 'string') {
      const cleanB64 = sanitizeBase64Payload(bytesOrBase64);
      // Evaluar prefijos Base64 canónicos de magic bytes sin decodificar todo el archivo
      if (cleanB64.startsWith('JVBERi0')) return 'application/pdf'; // %PDF-
      if (cleanB64.startsWith('iVBORw0KGgo')) return 'image/png'; // \x89PNG\r\n\x1a\n
      if (cleanB64.startsWith('UklGR')) return 'image/webp'; // RIFF....WEBP
      if (cleanB64.startsWith('/9j/')) return 'image/jpeg'; // \xFF\xD8\xFF
    } else if (bytesOrBase64.length >= 4) {
      const b0 = bytesOrBase64[0];
      const b1 = bytesOrBase64[1];
      const b2 = bytesOrBase64[2];
      const b3 = bytesOrBase64[3];
      // %PDF
      if (b0 === 0x25 && b1 === 0x50 && b2 === 0x44 && b3 === 0x46) {
        return 'application/pdf';
      }
      // PNG: 89 50 4E 47
      if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4e && b3 === 0x47) {
        return 'image/png';
      }
      // WEBP: RIFF (52 49 46 46) .... WEBP (57 45 42 50)
      if (
        bytesOrBase64.length >= 12 &&
        b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46 &&
        bytesOrBase64[8] === 0x57 && bytesOrBase64[9] === 0x45 && bytesOrBase64[10] === 0x42 && bytesOrBase64[11] === 0x50
      ) {
        return 'image/webp';
      }
      // JPEG: FF D8 FF
      if (b0 === 0xff && b1 === 0xd8 && b2 === 0xff) {
        return 'image/jpeg';
      }
    }
  }

  const normMime = String(declaredMimeType || '').trim().toLowerCase();
  if (normMime === 'application/pdf' || normMime.includes('pdf')) return 'application/pdf';
  if (normMime === 'image/png' || normMime.includes('png')) return 'image/png';
  if (normMime === 'image/webp' || normMime.includes('webp')) return 'image/webp';
  if (normMime === 'image/jpeg' || normMime === 'image/jpg' || normMime.includes('jpeg') || normMime.includes('jpg')) {
    return 'image/jpeg';
  }

  const ext = String(fileName || '').trim().toLowerCase();
  if (ext.endsWith('.pdf')) return 'application/pdf';
  if (ext.endsWith('.png')) return 'image/png';
  if (ext.endsWith('.webp')) return 'image/webp';
  if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) return 'image/jpeg';

  return 'image/jpeg';
}

/**
 * Recorta el contenido desde la primera `{` hasta la última `}` (o `[` a `]`),
 * limpia bloques markdown/comentarios y ejecuta `JSON.parse()` (Paso 3).
 */
export function extractCleanJson(text: string): any {
  if (!text || typeof text !== 'string') return null;

  const stripped = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  if (!stripped) return null;

  try {
    return JSON.parse(stripped);
  } catch {
    const firstBrace = stripped.indexOf('{');
    const lastBrace = stripped.lastIndexOf('}');
    const firstBracket = stripped.indexOf('[');
    const lastBracket = stripped.lastIndexOf(']');

    let startIdx = -1;
    let endIdx = -1;

    if (firstBrace !== -1 && lastBrace > firstBrace && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
      endIdx = lastBrace;
    } else if (firstBracket !== -1 && lastBracket > firstBracket) {
      startIdx = firstBracket;
      endIdx = lastBracket;
    } else if (firstBrace !== -1 && lastBrace > firstBrace) {
      startIdx = firstBrace;
      endIdx = lastBrace;
    }

    if (startIdx === -1 || endIdx <= startIdx) {
      return null;
    }

    const candidate = stripped
      .slice(startIdx, endIdx + 1)
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/,\s*\/\/[^\r\n]*/g, ',')
      .replace(/([0-9"truefalsenull\]}])\s*\/\/[^\r\n]*/g, '$1')
      .replace(/,\s*([}\]])/g, '$1');

    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
}

/**
 * Parsea un texto JSON de respuesta de IA de forma blindada sin lanzar excepciones no controladas:
 * a) Limpia bloques markdown (` ```json ` y ` ``` `).
 * b) Extrae el contenido entre la primera llave `{` (o corchete `[`) y la última `}` (o `]`).
 * c) Parsea el JSON limpiando comentarios o comas residuales y devuelve `null` si no es válido.
 */
export function parseSafeJson(rawText: string): any {
  return extractCleanJson(rawText);
}

/**
 * Sanitiza la salida de texto del modelo de IA usando `extractCleanJson` y lanza error descriptivo
 * únicamente si el texto no contiene ningún JSON interpretable.
 */
export function sanitizeAndParseOcJson(rawText: string): any {
  if (!rawText || typeof rawText !== 'string') {
    throw new AlkostoOcrStageError('3-Parseo JSON', 'La respuesta del modelo de IA está vacía.');
  }
  const parsed = extractCleanJson(rawText);
  if (parsed === null || parsed === undefined) {
    throw new AlkostoOcrStageError('3-Parseo JSON', 'No se encontró un bloque JSON válido en la respuesta del modelo.');
  }
  return parsed;
}

/**
 * Motor de lectura multimodal con cascada de modelos (Paso 3):
 * 1º `gemini-2.5-flash` (óptimo en velocidad y lectura de tablas multimodales, evitando timeouts en Render)
 * 2º `gemini-2.5-pro` (máxima profundidad analítica de respaldo)
 * 3º `gemini-2.0-flash` (respaldo de compatibilidad)
 */
export async function callGeminiWithFallback(params: {
  base64Data: string;
  mimeType?: string;
  fileName?: string;
  apiKeys: string | string[];
  prompt?: string;
  systemInstruction?: string;
}): Promise<{ rawText: string; parsedJson: any; modelUsed: string; usedModel: string }> {
  const cleanBase64 = sanitizeBase64Payload(params.base64Data);
  if (!cleanBase64) {
    throw new AlkostoOcrStageError('1-Archivo', 'El archivo Base64 está vacío o corrupto.');
  }

  const detectedMime = detectAlkostoFileMimeType(cleanBase64, params.mimeType, params.fileName);
  const rawKeys = Array.isArray(params.apiKeys) ? params.apiKeys : [params.apiKeys];
  const validKeys = Array.from(
    new Set(
      rawKeys
        .filter(Boolean)
        .flatMap(k => String(k).split(','))
        .map(k => k.trim().replace(/^["']+|["']+$/g, '').trim())
        .filter(k => k.length > 10 && k !== 'undefined' && k !== 'null')
    )
  );

  if (validKeys.length === 0) {
    throw new AlkostoOcrStageError(
      '2-Conexión Gemini-Render',
      'No se encontró la clave GEMINI_API_KEY configurada en las variables de entorno (GEMINI_API_KEY / VITE_GEMINI_API_KEY).',
      { statusCode: 503, code: 'AI_API_KEY_UNAVAILABLE' }
    );
  }

  const { GoogleGenAI } = await import('@google/genai');
  const systemInstruction = params.systemInstruction || buildAlkostoOcSystemPrompt();
  const prompt =
    params.prompt ||
    `Analiza minuciosamente todas las páginas de la Orden de Compra de ALKOSTO y FAMILIA CENTER adjunta. Unifica las cantidades por tienda únicamente para las 17 tiendas válidas (${(CADENAS_ABREVIATURAS?.ALKOSTO || []).join(', ')} y ${(CADENAS_ABREVIATURAS?.FAMILIA_CENTER || []).join(', ')}), ignorando por completo AKOP y CI. Normaliza todos los montos sin comas de miles y devuelve ÚNICAMENTE el objeto JSON válido.`;

  let lastError: any = null;
  let lastStage: AlkostoOcrStage = '2-Conexión Gemini-Render';

  for (let keyIdx = 0; keyIdx < validKeys.length; keyIdx++) {
    const apiKey = validKeys[keyIdx];
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    for (const modelName of ALKOSTO_OCR_MODEL_CASCADE) {
      try {
        lastStage = '2-Conexión Gemini-Render';
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { data: cleanBase64, mimeType: detectedMime } },
                { text: prompt }
              ]
            }
          ],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        });

        const rawText = String(response?.text || '').trim();
        if (!rawText) {
          throw new AlkostoOcrStageError('3-Parseo JSON', `El modelo ${modelName} devolvió una respuesta vacía.`);
        }

        lastStage = '3-Parseo JSON';
        const parsedJson = extractCleanJson(rawText);
        if (!parsedJson || typeof parsedJson !== 'object') {
          throw new AlkostoOcrStageError(
            '3-Parseo JSON',
            `El modelo ${modelName} devolvió texto que no pudo convertirse en JSON válido.`
          );
        }

        return {
          rawText,
          parsedJson,
          modelUsed: modelName,
          usedModel: modelName
        };
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err);
        console.warn(`[callGeminiWithFallback] Reintento tras fallo en key#${keyIdx + 1} / modelo ${modelName}: ${errMsg.slice(0, 220)}`);
        if (/API_KEY_INVALID|API key not valid|reported as leaked|PERMISSION_DENIED/i.test(errMsg)) {
          break; // Probar siguiente clave si hay otra disponible
        }
      }
    }
  }

  if (lastError instanceof AlkostoOcrStageError) {
    throw lastError;
  }

  const finalMsg = String(lastError?.message || 'Fallo al conectar con los modelos Gemini en cascada.');
  throw new AlkostoOcrStageError(lastStage, finalMsg, {
    statusCode: lastError?.status || lastError?.statusCode || 503,
    code: lastError?.code
  });
}

/**
 * Construye el sub-arreglo estructurado `distribucionPorTienda` a partir del mapa `tiendas`
 * asociando cada código (`AK01..AK10`, `FC01..FC07`) con su nombre oficial de sucursal.
 */
export function construirDistribucionPorTienda(
  tiendas?: Record<string, number>
): DistribucionPorTiendaItem[] {
  if (!tiendas || typeof tiendas !== 'object') return [];
  const list: DistribucionPorTiendaItem[] = [];
  for (const [rawTag, rawQty] of Object.entries(tiendas)) {
    const tag = rawTag.trim().toUpperCase();
    const cantidad = parseNumeroEstricto(rawQty, 0);
    if (cantidad <= 0 || tag === 'CI' || tag === 'AKOP' || tag === 'FCOP') continue;
    const sucursalInfo = getSucursalByTag(tag);
    list.push({
      codigoTienda: tag,
      nombreTienda: sucursalInfo?.nombre || tag,
      cantidad: Number(cantidad.toFixed(2))
    });
  }
  return list;
}

/**
 * Construye el sub-arreglo canónico `distribucion_tiendas` ({ codigo_tienda, nombre_tienda, cantidad }).
 * Cumple la Regla 3:
 * - Si hay desglose por tienda en `tiendas` o `customStoreItems`, incluye cada tienda y su cantidad.
 * - Si la orden es para una única tienda general indicada en la cabecera, asigna esa tienda en `distribucion_tiendas`
 *   con el total de unidades del renglón.
 */
export function construirDistribucionTiendasCanonico(
  tiendas?: Record<string, number>,
  customStoreItems?: AlkostoOcDistribucionTienda[],
  fallbackSingleStore?: { codigoTienda?: string | null; nombreTienda?: string | null; cantidad?: number }
): AlkostoOcDistribucionTienda[] {
  const fromMap = construirDistribucionPorTienda(tiendas).map(d => ({
    codigo_tienda: d.codigoTienda || null,
    nombre_tienda: d.nombreTienda,
    cantidad: d.cantidad
  }));

  if (fromMap.length > 0) {
    return fromMap;
  }

  if (Array.isArray(customStoreItems) && customStoreItems.length > 0) {
    const validCustom = customStoreItems.filter(c => c.cantidad > 0);
    if (validCustom.length > 0) {
      return validCustom.map(c => ({
        codigo_tienda: c.codigo_tienda || null,
        nombre_tienda: c.nombre_tienda || 'ALKOSTO',
        cantidad: Number(c.cantidad.toFixed(2))
      }));
    }
  }

  if (fallbackSingleStore && (fallbackSingleStore.cantidad ?? 0) > 0) {
    const rawCode = fallbackSingleStore.codigoTienda ? String(fallbackSingleStore.codigoTienda).trim() : null;
    const suc = rawCode ? getSucursalByTag(rawCode) : undefined;
    return [
      {
        codigo_tienda: suc?.tag || suc?.codigo || rawCode || null,
        nombre_tienda: suc?.nombre || fallbackSingleStore.nombreTienda || 'ALKOSTO',
        cantidad: Number((fallbackSingleStore.cantidad ?? 0).toFixed(2))
      }
    ];
  }

  return [];
}

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

  const cleaned = raw.replace(/(?:Bs\.?|USD|US\$|\$|%|€|\s)+/gi, '');
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
 * Convierte cualquier fecha DD/MM/YYYY, DD-MM-YYYY o YYYY-MM-DD al formato ISO canónico YYYY-MM-DD.
 * Retorna null si la fecha está vacía o no es reconocible.
 */
export function normalizarFechaISOAlkosto(fechaRaw?: string | null): string | null {
  const s = String(fechaRaw || '').trim();
  if (!s || s.toLowerCase() === 'null') return null;
  const ymd = s.match(/^(\d{4})[/-](\d{2})[/-](\d{2})$/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  }
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    const yyyy = dmy[3];
    return `${yyyy}-${mm}-${dd}`;
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
    codigoPrincipal?: string;
    skuCodizulca?: string;
    codigoBarra?: string;
    codigoEan?: string | null;
    codigoInternoAlkosto?: string | null;
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
      const obsMatch = pageText.match(/(\d+\s*DIAS\s+BS\s+BCV[^\r\n]*)/i)
        || pageText.match(/(BCV,\s*DESPACHO[^\r\n]*(?:\r?\n\s*(?:PEDIDO|DESPACHO)[^\r\n]*)?)/i);
      if (obsMatch) {
        observaciones = obsMatch[1].replace(/\s+/g, ' ').trim();
      }
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
      const finalCodigoInternoAlkosto = /^100\d{3}$/.test(rawCode) ? rawCode : null;
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
          codigoPrincipal: finalSku,
          skuCodizulca: finalSku,
          codigoBarra: finalBarcode,
          codigoEan: finalBarcode || null,
          codigoInternoAlkosto: finalCodigoInternoAlkosto,
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
      codigoPrincipal: it.codigoPrincipal || it.codigo,
      skuCodizulca: it.skuCodizulca,
      codigoBarra: it.codigoBarra,
      codigoEan: it.codigoEan ?? null,
      codigoInternoAlkosto: it.codigoInternoAlkosto ?? null,
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
 * Intenta extraer una Orden de Compra desde texto OCR libre (ej. Tesseract sobre imagen JPG/PNG/WEBP
 * o PDF escaneado) cuando la estructura no conserva las 21 celdas exactas del stream ERP.
 */
export function parseAlkostoFlexibleOcrText(rawText: string): ParsedOrdenCompraAlkosto | null {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 20) return null;

  try {
    return parseAlkostoRawText(rawText);
  } catch {
    // Continuar con extracción heurística de renglones
  }

  const upper = rawText.toUpperCase();
  const isFamilia = upper.includes('FAMILIA CENTER') || /\bFC0[1-7]\b/.test(upper);
  const clienteCadena = isFamilia ? 'FAMILIA_CENTER' : 'ALKOSTO';

  const ocMatch =
    rawText.match(/Orden\s*(?:de\s*Compra|Nro\.?)?\s*:?\s*#?\s*(\d{4,12})/i) ||
    rawText.match(/\b(0000\d{5,8})\b/);
  const ordenNro = ocMatch ? ocMatch[1].trim() : 'S/N';

  const datesFound = rawText.match(/\b(\d{2}[/-]\d{2}[/-]\d{4})\b/g) || [];
  const fechaEmision = datesFound[0] ? normalizarFechaAlkosto(datesFound[0].replace(/-/g, '/')) : '';
  const fechaEntrega = datesFound[1] ? normalizarFechaAlkosto(datesFound[1].replace(/-/g, '/')) : fechaEmision;

  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length >= 6);

  const items: any[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Detectar líneas con código EAN/SKU (2 a 14 dígitos) y descripción de producto
    const m = line.match(/^(?:\d{1,2}\s+)?(?:(CJ|KG|UND|BLT)\s+)?(?:(\d+(?:[.,]\d+)?)\s+)?(\d{2,14})\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9\s.,/-]{4,})$/i);
    if (!m) continue;

    const unidHint = m[1];
    const cantHint = m[2] ? parseNumeroEstricto(m[2], 0) : 0;
    const rawCode = m[3].trim();
    const restText = m[4].trim();

    if (rawCode === '409876136' || /^267319/.test(rawCode)) continue;

    const trailingNums = restText.match(/-?\d+(?:[.,]\d+)?/g) || [];
    const descOnly = limpiarDescripcionAlkosto(
      restText.replace(/(?:\s+-?\d+(?:[.,]\d+)?){2,}\s*$/, '').trim()
    );

    const catalogMatch = resolverProductoPorCodigoODescripcion(rawCode, descOnly);
    if (!catalogMatch && trailingNums.length < 2 && cantHint <= 0) continue;

    let totalCantidad = cantHint;
    let costoUnitario = catalogMatch?.precioSugeridoUSD || 0;
    let totalRenglon = 0;

    if (trailingNums.length >= 3) {
      const nLast = parseNumeroEstricto(trailingNums[trailingNums.length - 1], 0);
      const nPrev = parseNumeroEstricto(trailingNums[trailingNums.length - 2], 0);
      const nThird = parseNumeroEstricto(trailingNums[trailingNums.length - 3], 0);
      if (!totalCantidad && nThird > 0) totalCantidad = nThird;
      if (nPrev > 0) costoUnitario = nPrev;
      if (nLast > 0) totalRenglon = nLast;
    } else if (trailingNums.length === 2) {
      const n1 = parseNumeroEstricto(trailingNums[0], 0);
      const n2 = parseNumeroEstricto(trailingNums[1], 0);
      if (!totalCantidad) {
        totalCantidad = n1;
        costoUnitario = n2;
      } else {
        costoUnitario = n1;
        totalRenglon = n2;
      }
    }

    if (totalCantidad <= 0) continue;
    if (!totalRenglon && costoUnitario > 0) {
      totalRenglon = Number((totalCantidad * costoUnitario).toFixed(2));
    }

    items.push({
      renglon: items.length + 1,
      codigo: catalogMatch?.sku || rawCode,
      skuCodizulca: catalogMatch?.sku || rawCode,
      codigoBarra: catalogMatch?.codigoBarra || (/^\d{12,14}$/.test(rawCode) ? rawCode : undefined),
      descripcion: catalogMatch?.producto || descOnly,
      unid: normalizarUnidadMedidaAlkosto(unidHint, catalogMatch?.producto || descOnly, undefined, catalogMatch?.unidadSugerida),
      totalCantidad,
      costoUnitario,
      totalRenglon
    });
  }

  if (items.length === 0) return null;

  try {
    return validateAndNormalizeAlkostoOC(
      {
        clienteCadena,
        ordenNro,
        fechaEmision,
        fechaEntrega,
        moneda: 'USD',
        items
      },
      { strictMath: false, requireOrdenNro: false }
    );
  } catch {
    return null;
  }
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
    const btBlocks = inflated.match(/(?:q\s+[\d.]+\s+0(?:\.0+)?\s+0(?:\.0+)?\s+[\d.]+\s+0(?:\.0+)?\s+0(?:\.0+)?\s+cm[\s\S]{0,80}?)?BT[\s\S]*?ET/g) || [];

    for (const block of btBlocks) {
      const cmMatch = block.match(/([\d.]+)\s+0(?:\.0+)?\s+0(?:\.0+)?\s+([\d.]+)\s+0(?:\.0+)?\s+0(?:\.0+)?\s+cm/);
      const cmScaleX = cmMatch ? parseFloat(cmMatch[1]) || 1 : 1;
      const cmScaleY = cmMatch ? parseFloat(cmMatch[2]) || 1 : 1;

      const tfMatch = block.match(/\/F\d+\s+([\d.]+)\s+Tf/);
      const rawFontSize = tfMatch ? parseFloat(tfMatch[1]) : 9.28;
      const fontSize = rawFontSize * cmScaleX;
      const tmMatch = block.match(/1\s+0\s+0(?:\.0+)?\s+-1\s+([\d.]+)\s+([\d.]+)\s+Tm/);
      if (!tmMatch) continue;

      let curX = parseFloat(tmMatch[1]) * cmScaleX;
      const y = parseFloat(tmMatch[2]) * cmScaleY;

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

/**
 * Descomprime un stream FlateDecode de PDF utilizando `DecompressionStream('deflate')` nativo
 * (compatible en navegadores modernos y Node 18+ sin requerir `zlib` de Node).
 */
async function inflatePdfSliceWithWebStream(rawSlice: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === 'undefined') return '';
  let start = 0;
  let end = rawSlice.length;
  while (start < end && (rawSlice[start] === 0x0d || rawSlice[start] === 0x0a)) start++;
  while (end > start && (rawSlice[end - 1] === 0x0d || rawSlice[end - 1] === 0x0a)) end--;
  if (end <= start) return '';
  const trimmed = rawSlice.subarray(start, end);

  const tryDecompress = async (format: 'deflate' | 'deflate-raw'): Promise<Uint8Array> => {
    const ds = new DecompressionStream(format as any);
    const writer = ds.writable.getWriter();
    writer.write(trimmed).catch(() => {});
    writer.close().catch(() => {});
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    let totalLen = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value && value.length > 0) {
          chunks.push(value);
          totalLen += value.length;
        }
      }
    } catch {
      // Ignorar advertencia de bytes de relleno al final del stream si ya se descomprimió el bloque
    }
    const out = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  };

  let bytes = await tryDecompress('deflate');
  if (bytes.length === 0 && trimmed.length > 2) {
    bytes = await tryDecompress('deflate-raw');
  }
  if (bytes.length === 0) return '';
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return str;
}

/**
 * Versión asíncrona universal (Browser + Node) de extracción de texto posicionado por coordenadas (X, Y)
 * desde un PDF digital de Alkosto / Familia Center usando `DecompressionStream('deflate')`.
 */
export async function extractPositionedTextFromAlkostoPdfBufferAsync(
  pdfBytesOrBase64: Uint8Array | string
): Promise<string | null> {
  let bytes: Uint8Array;
  if (typeof pdfBytesOrBase64 === 'string') {
    const cleanB64 = sanitizeBase64Payload(pdfBytesOrBase64);
    if (!cleanB64) return null;
    if (typeof Buffer !== 'undefined') {
      bytes = new Uint8Array(Buffer.from(cleanB64, 'base64'));
    } else if (typeof atob === 'function') {
      const binStr = atob(cleanB64);
      bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
    } else {
      return null;
    }
  } else {
    bytes = pdfBytesOrBase64;
  }

  if (!bytes || bytes.length < 32) return null;

  let latin1 = '';
  for (let i = 0; i < bytes.length; i++) {
    latin1 += String.fromCharCode(bytes[i]);
  }

  let cursor = 0;
  const pageTexts: string[] = [];

  while ((cursor = latin1.indexOf('stream', cursor)) !== -1) {
    let start = latin1.indexOf('\n', cursor);
    if (start === -1) break;
    start += 1;
    const end = latin1.indexOf('endstream', start);
    if (end === -1) break;

    const rawSlice = bytes.subarray(start, end);
    cursor = end + 9;

    const inflated = await inflatePdfSliceWithWebStream(rawSlice);
    if (!inflated || !inflated.includes('BT') || !inflated.includes('ET') || !inflated.includes('Tm')) {
      continue;
    }

    const tokens: Array<{ x: number; y: number; txt: string }> = [];
    const btBlocks = inflated.match(/(?:q\s+[\d.]+\s+0(?:\.0+)?\s+0(?:\.0+)?\s+[\d.]+\s+0(?:\.0+)?\s+0(?:\.0+)?\s+cm[\s\S]{0,80}?)?BT[\s\S]*?ET/g) || [];

    for (const block of btBlocks) {
      const cmMatch = block.match(/([\d.]+)\s+0(?:\.0+)?\s+0(?:\.0+)?\s+([\d.]+)\s+0(?:\.0+)?\s+0(?:\.0+)?\s+cm/);
      const cmScaleX = cmMatch ? parseFloat(cmMatch[1]) || 1 : 1;
      const cmScaleY = cmMatch ? parseFloat(cmMatch[2]) || 1 : 1;

      const tfMatch = block.match(/\/F\d+\s+([\d.]+)\s+Tf/);
      const rawFontSize = tfMatch ? parseFloat(tfMatch[1]) : 9.28;
      const fontSize = rawFontSize * cmScaleX;
      const tmMatch = block.match(/1\s+0\s+0(?:\.0+)?\s+-1\s+([\d.]+)\s+([\d.]+)\s+Tm/);
      if (!tmMatch) continue;

      let curX = parseFloat(tmMatch[1]) * cmScaleX;
      const y = parseFloat(tmMatch[2]) * cmScaleY;

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

  const cabeceraObj =
    root.cabecera_orden && typeof root.cabecera_orden === 'object'
      ? root.cabecera_orden
      : rawInput?.cabecera_orden && typeof rawInput.cabecera_orden === 'object'
        ? rawInput.cabecera_orden
        : null;

  const resumenObj =
    root.resumen_totales && typeof root.resumen_totales === 'object'
      ? root.resumen_totales
      : rawInput?.resumen_totales && typeof rawInput.resumen_totales === 'object'
        ? rawInput.resumen_totales
        : null;

  // Filtrar filas vacías de plantillas (ej. filas en blanco 2..15 de la Nota de Pedido Codizulca)
  const nonEmptyRawItems = rawItems.filter((it: any) => {
    if (!it || typeof it !== 'object') return true; // Dejar pasar para que el validador reporte el error de tipo
    const hasCod = Boolean(
      String(
        pickProp(it, [
          'codigo_principal',
          'codigoPrincipal',
          'codigo',
          'sku',
          'SKU',
          'skuCodizulca',
          'codigo_ean',
          'codigoEan',
          'codigoBarra',
          'ean',
          'codigo_interno_alkosto',
          'codigoInternoAlkosto',
          'referencia'
        ]) ?? ''
      ).trim()
    );
    const hasDesc = Boolean(
      String(
        pickProp(it, [
          'descripcion_producto',
          'descripcionProducto',
          'descripcion',
          'DESCRIPCIÓN DEL PRODUCTO',
          'producto',
          'nombre',
          'articulo'
        ]) ?? ''
      ).trim()
    );
    const hasCant =
      parseNumeroEstricto(
        pickProp(it, [
          'cantidad_total',
          'totalCantidad',
          'cantidadTotal',
          'cantSolicitada',
          'CANT',
          'cantidad',
          'cant',
          'CANT. SOLICITADA'
        ]),
        0
      ) > 0;
    const hasStores =
      (it.tiendas && typeof it.tiendas === 'object' && Object.values(it.tiendas).some(v => parseNumeroEstricto(v, 0) > 0)) ||
      (Array.isArray(it.distribucionPorTienda) && it.distribucionPorTienda.some((d: any) => parseNumeroEstricto(d?.cantidad, 0) > 0)) ||
      (Array.isArray(it.distribucion_tiendas) && it.distribucion_tiendas.some((d: any) => parseNumeroEstricto(d?.cantidad, 0) > 0));
    return hasCod || hasDesc || hasCant || hasStores;
  });

  const itemsToValidate = nonEmptyRawItems.length > 0 ? nonEmptyRawItems : rawItems;

  // 3. Validar y normalizar Número de Orden de Compra y metadatos de cabecera
  const rawOrdenNro = String(
    pickProp(cabeceraObj, ['numero_orden_compra', 'numeroOrdenCompra', 'numero_orden', 'numeroOrden', 'ordenNro', 'numero_oc', 'ordenCompra', 'oc']) ??
    pickProp(root, ['numero_orden_compra', 'numero_orden', 'ordenNro', 'numero_oc', 'ORDEN DE COMPRA', 'ordenCompra', 'orden_compra', 'numeroOrden', 'nroOrden', 'nro_orden', 'oc']) ??
    pickProp(rawInput, ['numero_orden_compra', 'numero_orden', 'ordenNro', 'numero_oc', 'ORDEN DE COMPRA', 'ordenCompra', 'numeroOrden', 'nroOrden', 'oc']) ??
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

  const clienteEmisorCabecera = String(
    pickProp(cabeceraObj, ['cliente_emisor', 'clienteEmisor', 'cliente']) ?? ''
  ).trim();
  const receptorDestinoCabecera = String(
    pickProp(cabeceraObj, ['receptor_destino', 'receptorDestino', 'proveedor']) ?? ''
  ).trim();
  const clienteNombreClean = String(
    pickProp(root, ['clienteNombre', 'CLIENTE', 'cliente']) ??
    pickProp(rawInput, ['clienteNombre', 'CLIENTE', 'cliente']) ??
    clienteEmisorCabecera ??
    ''
  ).trim();
  const idClienteClean = String(
    pickProp(root, ['idCliente', 'ID CLIENTE', 'codigoCliente', 'codCliente']) ??
    pickProp(rawInput, ['idCliente', 'ID CLIENTE', 'codigoCliente']) ??
    ''
  ).trim();

  // 4. Normalizar y validar cada renglón
  const rawNormalizedItems: ParsedOrdenCompraAlkosto['items'] = [];

  itemsToValidate.forEach((it: any, idx: number) => {
    const renglonNum = Number(pickProp(it, ['numero_renglon', 'numeroRenglon', 'renglon', 'N°', 'nro', 'numero'])) || idx + 1;
    if (!it || typeof it !== 'object') {
      issues.push({
        field: `items[${idx}]`,
        renglon: renglonNum,
        message: `El renglón ${renglonNum} no es un objeto válido.`,
        severity: 'ERROR'
      });
      return;
    }

    const cleanCodeField = (val: unknown): string => {
      const s = String(val ?? '').trim();
      if (!s || /^(null|undefined|n\/a|none|-)$/i.test(s)) return '';
      return s;
    };

    let rawCodPrincipal = cleanCodeField(
      pickProp(it, [
        'codigo_principal',
        'codigoPrincipal',
        'codigo',
        'sku',
        'SKU',
        'skuCodizulca',
        'codigo_articulo',
        'codigo_producto',
        'referencia'
      ])
    );
    const rawCodEan = cleanCodeField(
      pickProp(it, ['codigo_ean', 'codigoEan', 'codigoBarra', 'codigo_barra', 'ean', 'barcode', 'upc'])
    );
    const rawCodAlkosto = cleanCodeField(
      pickProp(it, ['codigo_interno_alkosto', 'codigoInternoAlkosto', 'plu', 'sku_alkosto'])
    );

    let rawUnidInput = String(
      pickProp(it, [
        'unidad_medida',
        'unidadMedida',
        'unid',
        'UNID',
        'unidad',
        'cantSolicitadaUnid'
      ]) ?? ''
    ).trim();

    // Guardarraíl contra cruce de columnas: si la IA colocó la unidad ("CJ", "KG", "UND") en el campo SKU/codigo
    if (/^(CJ|CAJ|CAJA|CAJAS|KG|KGS|KILOS|UND|UNID|UNIDADES|BLT|BTO|BTOS|BULTO|BULTOS)$/i.test(rawCodPrincipal)) {
      const potentialCodeInUnid =
        rawUnidInput && !/^(CJ|CAJ|CAJA|CAJAS|KG|KGS|KILOS|UND|UNID|UNIDADES|BLT|BTO|BTOS|BULTO|BULTOS)$/i.test(rawUnidInput)
          ? rawUnidInput
          : '';
      rawUnidInput = rawCodPrincipal;
      rawCodPrincipal = cleanCodeField(pickProp(it, ['skuCodizulca', 'codigoBarra', 'codigo_ean', 'codigo_interno_alkosto']) ?? potentialCodeInUnid);
    }

    const rawCodCombined = rawCodPrincipal || rawCodEan || rawCodAlkosto;
    const cleanCod = normalizarCodigoProducto(rawCodCombined);
    const cleanCodEanInput = normalizarCodigoProducto(rawCodEan);
    const cleanCodAlkostoInput = normalizarCodigoProducto(rawCodAlkosto);

    const rawDesc = String(
      pickProp(it, [
        'descripcion_producto',
        'descripcionProducto',
        'descripcion',
        'DESCRIPCIÓN DEL PRODUCTO',
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

    const match =
      resolverProductoPorCodigoODescripcion(cleanCod, cleanDesc) ||
      (cleanCodEanInput ? resolverProductoPorCodigoODescripcion(cleanCodEanInput, cleanDesc) : undefined) ||
      (cleanCodAlkostoInput ? resolverProductoPorCodigoODescripcion(cleanCodAlkostoInput, cleanDesc) : undefined);

    const finalSku =
      (match ? match.sku : '') ||
      (it.skuCodizulca ? normalizarCodigoProducto(it.skuCodizulca) : '') ||
      normalizarCodigoProducto(rawCodPrincipal) ||
      cleanCod;
    const finalCodigo = finalSku || cleanCod || (match?.codigoBarra ?? '');

    // Separación clara de códigos (Regla 2): codigo_principal, codigo_ean y codigo_interno_alkosto
    const resolvedEan: string | null =
      cleanCodEanInput ||
      (/^\d{12,14}$/.test(cleanCod) ? cleanCod : '') ||
      match?.codigoBarra ||
      null;

    const catalogAlkostoPlu = match?.codigosCadena?.find(c => /^100\d{3}$/.test(normalizarCodigoProducto(c))) || null;
    const resolvedCodigoAlkosto: string | null =
      cleanCodAlkostoInput ||
      (/^100\d{3}$/.test(cleanCod) ? cleanCod : '') ||
      catalogAlkostoPlu ||
      null;

    const finalBarcode = resolvedEan || undefined;
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

    // Normalizar tiendas (AK01..AK10, FC01..FC07, etc.) desde `tiendas`, `distribucion_tiendas`, `distribucionPorTienda` o raíz del item
    let cleanTiendas: Record<string, number> = {};
    const customStoreItems: AlkostoOcDistribucionTienda[] = [];

    if (it.tiendas && typeof it.tiendas === 'object') {
      for (const [tag, val] of Object.entries(it.tiendas)) {
        const uTag = tag.trim().toUpperCase();
        if (val === null || val === undefined || val === '' || val === '-') {
          continue;
        }
        const numVal = parseNumeroEstricto(val, NaN);
        if (Number.isNaN(numVal) || numVal < 0) {
          if (strictMath) {
            issues.push({
              field: `items[${idx}].tiendas.${uTag}`,
              renglon: renglonNum,
              message: `Valor inválido en tienda ${uTag} del renglón ${renglonNum}: "${val}"`,
              severity: 'ERROR'
            });
          }
          continue;
        }
        if (numVal > 0 && ALL_VALID_STORE_TAGS.has(uTag) && uTag !== 'CI' && uTag !== 'AKOP' && uTag !== 'FCOP') {
          cleanTiendas[uTag] = numVal;
        }
      }
    }

    // Soportar sub-arreglo estructurado `distribucion_tiendas` / `distribucionPorTienda` devuelto por el modelo de IA
    const rawDistList = pickProp(it, [
      'distribucion_tiendas',
      'distribucionTiendas',
      'distribucionPorTienda',
      'distribucion_por_tienda',
      'tiendasDesglose',
      'tiendas_desglose'
    ]);
    if (Array.isArray(rawDistList)) {
      for (const distItem of rawDistList) {
        if (!distItem || typeof distItem !== 'object') continue;
        const rawStoreTag = cleanCodeField(
          pickProp(distItem, ['codigo_tienda', 'codigoTienda', 'tienda', 'codigo', 'tag'])
        ).toUpperCase();
        const rawStoreName = String(
          pickProp(distItem, ['nombre_tienda', 'nombreTienda', 'nombre', 'sucursal']) ?? ''
        ).trim();
        const storeQty = parseNumeroEstricto(
          pickProp(distItem, ['cantidad', 'cant', 'cantidadSolicitada', 'total']),
          0
        );
        if (storeQty <= 0) continue;

        let resolvedTag = rawStoreTag;
        if (resolvedTag && !ALL_VALID_STORE_TAGS.has(resolvedTag)) {
          const sucByCode = getSucursalByTag(resolvedTag);
          if (sucByCode?.tag) {
            resolvedTag = sucByCode.tag.toUpperCase();
          }
        }
        if (!ALL_VALID_STORE_TAGS.has(resolvedTag) && rawStoreName) {
          const allSucs = [...SUCURSALES_ALKOSTO, ...SUCURSALES_FAMILIA_CENTER];
          const foundSuc = allSucs.find(
            s =>
              (s.tag && s.tag.toUpperCase() === rawStoreName.toUpperCase()) ||
              s.codigo.toUpperCase() === rawStoreName.toUpperCase() ||
              s.nombre.toUpperCase().includes(rawStoreName.toUpperCase()) ||
              rawStoreName.toUpperCase().includes(s.nombre.toUpperCase())
          );
          if (foundSuc) resolvedTag = (foundSuc.tag || foundSuc.codigo).toUpperCase();
        }
        if (ALL_VALID_STORE_TAGS.has(resolvedTag) && resolvedTag !== 'CI' && resolvedTag !== 'AKOP' && resolvedTag !== 'FCOP') {
          if (cleanTiendas[resolvedTag] === undefined) {
            cleanTiendas[resolvedTag] = storeQty;
          }
        } else {
          customStoreItems.push({
            codigo_tienda: rawStoreTag || null,
            nombre_tienda: rawStoreName || rawStoreTag || clienteNombreClean || 'ALKOSTO',
            cantidad: Number(storeQty.toFixed(2))
          });
        }
      }
    }

    // También soportar tiendas en la raíz del item (it.AK01, it.FC01)
    for (const [k, val] of Object.entries(it)) {
      const uKey = k.trim().toUpperCase();
      if (ALL_VALID_STORE_TAGS.has(uKey) && uKey !== 'CI' && uKey !== 'AKOP' && uKey !== 'FCOP') {
        const numVal = parseNumeroEstricto(val, 0);
        if (numVal > 0 && cleanTiendas[uKey] === undefined) {
          cleanTiendas[uKey] = numVal;
        }
      }
    }

    const empNum = parseNumeroEstricto(
      pickProp(it, ['emp', 'unidades_por_empaque', 'unidadesPorEmpaque']),
      0
    );
    const ivaNum = parseNumeroEstricto(
      pickProp(it, ['porcentaje_impuesto', 'porcentajeImpuesto', 'iva', 'impuesto']),
      0
    );
    const descuentoNum = parseNumeroEstricto(
      pickProp(it, [
        'porcentaje_descuento',
        'porcentajeDescuento',
        'descuento',
        'porcentajeBonif',
        'porcentaje_bonif',
        'bonif',
        'descuentoPorcentaje'
      ]),
      0
    );

    const finalUnid = normalizarUnidadMedidaAlkosto(
      rawUnidInput,
      finalDesc,
      empNum,
      match?.unidadSugerida
    );

    let totalCant = parseNumeroEstricto(
      pickProp(it, [
        'cantidad_total',
        'totalCantidad',
        'cantidadTotal',
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
      cleanTiendas = autocorregirTiendasPorFila(cleanTiendas, totalCant);
    }

    // Calcular suma de tiendas por cadena tras autocorrección
    const sumAkTiendas = Object.entries(cleanTiendas)
      .filter(([tk]) => tk.startsWith('AK'))
      .reduce((acc, [, v]) => acc + v, 0);
    const sumFcTiendas = Object.entries(cleanTiendas)
      .filter(([tk]) => tk.startsWith('FC'))
      .reduce((acc, [, v]) => acc + v, 0);
    const sumCustomTiendas = customStoreItems.reduce((acc, c) => acc + c.cantidad, 0);
    const sumAllTiendas = Object.values(cleanTiendas).reduce((acc, v) => acc + v, 0) + sumCustomTiendas;

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

    // Seguimiento de alertas de revisión aritmética o de lectura (Reglas 3 y 5)
    let alertaRevision = Boolean(
      it.alerta_revision === true ||
      it.alertaRevision === true ||
      String(it.alerta_revision).toLowerCase() === 'true'
    );
    const notasRevisionList: string[] = [];
    const rawNotaInput = cleanCodeField(pickProp(it, ['nota_revision', 'notaRevision']));
    if (rawNotaInput) {
      notasRevisionList.push(rawNotaInput);
    }

    // Reconciliación matemática entre suma de tiendas y totalCantidad
    let cuadreTiendasValido = true;
    const rawTotalCantOriginal = totalCant;
    if (sumAllTiendas > 0) {
      const matchesAll = Math.abs(sumAllTiendas - totalCant) <= 0.05;
      const matchesAk = sumAkTiendas > 0 && Math.abs(sumAkTiendas - totalCant) <= 0.05;
      const matchesFc = sumFcTiendas > 0 && Math.abs(sumFcTiendas - totalCant) <= 0.05;

      if (totalCant === 0) {
        totalCant = sumAkTiendas > 0 && sumFcTiendas === 0 ? sumAkTiendas : sumAllTiendas;
      } else if (!matchesAll && !matchesAk && !matchesFc) {
        cuadreTiendasValido = false;
        if (strictMath) {
          issues.push({
            field: `items[${idx}].totalCantidad`,
            renglon: renglonNum,
            message: `Desalineación en renglón ${renglonNum} (${finalCodigo}): la suma de tiendas (${sumAllTiendas}) no coincide con Total Cantidad (${totalCant}).`,
            severity: 'ERROR'
          });
        } else {
          alertaRevision = true;
          notasRevisionList.push(
            `Suma de tiendas (${Number(sumAllTiendas.toFixed(2))}) difiere de cantidad_total (${rawTotalCantOriginal}).`
          );
          totalCant = sumAkTiendas > 0 && sumFcTiendas === 0 ? sumAkTiendas : totalCant;
        }
      }
    }

    let precio = parseNumeroEstricto(
      pickProp(it, [
        'costo_unitario',
        'costoUnitario',
        'PRECIO',
        'precio',
        'precioUnitario',
        'precio_unitario',
        'costoBruto',
        'costo_bruto'
      ]),
      0
    );

    let totalRenglon = parseNumeroEstricto(
      pickProp(it, [
        'monto_total_renglon',
        'montoTotalRenglon',
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
      const factorDesc = descuentoNum > 0 && descuentoNum <= 100 && !it.costoBruto ? 1 - descuentoNum / 100 : 1;
      totalRenglon = Number((totalCant * precio * factorDesc).toFixed(2));
    } else if (precio > 0 && totalCant > 0 && totalRenglon > 0) {
      const expectedDirect = Number((totalCant * precio).toFixed(2));
      const expectedDiscounted =
        descuentoNum > 0 && descuentoNum <= 100
          ? Number((totalCant * precio * (1 - descuentoNum / 100)).toFixed(2))
          : expectedDirect;
      const tolDirect = Math.max(0.5, expectedDirect * 0.02);
      const tolDisc = Math.max(0.5, expectedDiscounted * 0.02);
      const matchesDirect = Math.abs(expectedDirect - totalRenglon) <= tolDirect;
      const matchesDiscounted = descuentoNum > 0 && Math.abs(expectedDiscounted - totalRenglon) <= tolDisc;

      if (!matchesDirect && !matchesDiscounted) {
        if (strictMath) {
          issues.push({
            field: `items[${idx}].totalRenglon`,
            renglon: renglonNum,
            message: `Inconsistencia matemática en renglón ${renglonNum} (${finalCodigo}): ${totalCant} x ${precio} = ${expectedDirect}, pero figura ${totalRenglon}.`,
            severity: 'ERROR'
          });
        } else {
          alertaRevision = true;
          const expectedTarget =
            descuentoNum > 0 && (!it.costoBruto || Math.abs(parseNumeroEstricto(it.costoBruto, 0) - precio) < 0.001)
              ? expectedDiscounted
              : expectedDirect;
          notasRevisionList.push(
            `Discrepancia aritmética: cantidad_total (${totalCant}) * costo_unitario (${precio})${
              expectedTarget === expectedDiscounted && descuentoNum > 0 ? ` (-${descuentoNum}% desc.)` : ''
            } = ${expectedTarget}, pero monto_total_renglon leído fue ${totalRenglon}. Se priorizaron valores legibles.`
          );
          totalRenglon = expectedTarget;
        }
      }
    }

    if (totalCant <= 0 && sumAllTiendas <= 0) {
      if (strictMath || rawItems.length <= 1) {
        issues.push({
          field: `items[${idx}].totalCantidad`,
          renglon: renglonNum,
          message: `El renglón ${renglonNum} (${finalCodigo}) tiene cantidad solicitada 0.`,
          severity: 'ERROR'
        });
      } else {
        issues.push({
          field: `items[${idx}].totalCantidad`,
          renglon: renglonNum,
          message: `Renglón ${renglonNum} (${finalCodigo}) con cantidad 0 omitido.`,
          severity: 'WARNING'
        });
        return;
      }
    }

    const distribucionPorTienda = construirDistribucionPorTienda(cleanTiendas);
    const distribucionTiendasCanonico = construirDistribucionTiendasCanonico(
      cleanTiendas,
      customStoreItems,
      {
        codigoTienda: idClienteClean || (root.sede ? String(root.sede) : null),
        nombreTienda: clienteNombreClean || clienteEmisorCabecera || 'ALKOSTO',
        cantidad: totalCant
      }
    );
    const notaRevisionFinal = notasRevisionList.length > 0 ? notasRevisionList.join(' | ') : null;

    rawNormalizedItems.push({
      renglon: rawNormalizedItems.length + 1,
      codigo: finalCodigo,
      codigoPrincipal: finalCodigo,
      skuCodizulca: finalSku,
      codigoBarra: finalBarcode,
      codigoEan: resolvedEan,
      codigoInternoAlkosto: resolvedCodigoAlkosto,
      descripcion: finalDesc,
      iva: ivaNum,
      emp: empNum,
      unid: finalUnid,
      totalCantidad: totalCant,
      cantidadTotal: totalCant,
      cantDespachada: cantDespachadaClean,
      costoBruto: parseNumeroEstricto(it.costoBruto, precio),
      ...(descuentoNum > 0 ? { descuento: Number(descuentoNum.toFixed(2)) } : {}),
      costoUnitario: precio,
      totalRenglon: Number(totalRenglon.toFixed(2)),
      tiendas: cleanTiendas,
      distribucionPorTienda,
      distribucion_tiendas: distribucionTiendasCanonico,
      cuadreTiendasValido,
      alertaRevision,
      notaRevision: notaRevisionFinal
    });
  });

  if (rawNormalizedItems.length === 0 && issues.filter(i => i.severity === 'ERROR').length === 0) {
    issues.push({
      field: 'items',
      message: 'Todos los renglones extraídos tienen cantidad solicitada 0.',
      severity: 'ERROR'
    });
  }

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
      existing.distribucionPorTienda = construirDistribucionPorTienda(mergedTiendas);
      existing.distribucion_tiendas = construirDistribucionTiendasCanonico(mergedTiendas);
      existing.totalCantidad = primaryCant;
      existing.cantidadTotal = primaryCant;
      existing.totalRenglon = Number((primaryCant * existing.costoUnitario).toFixed(2));
      if (item.alertaRevision) {
        existing.alertaRevision = true;
        existing.notaRevision = [existing.notaRevision, item.notaRevision].filter(Boolean).join(' | ') || null;
      }
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

  const rutaClean = String(pickProp(root, ['ruta', 'RUTA']) ?? pickProp(rawInput, ['ruta', 'RUTA']) ?? '').trim();
  const supervisorClean = String(pickProp(root, ['supervisor', 'SUPERVISOR']) ?? pickProp(rawInput, ['supervisor', 'SUPERVISOR']) ?? '').trim();
  const choferClean = String(pickProp(root, ['chofer', 'CHOFER']) ?? pickProp(rawInput, ['chofer', 'CHOFER']) ?? '').trim();
  const cantidadCestasClean = pickProp(root, ['cantidadCestas', 'CANTIDAD DE CESTAS']) ?? pickProp(rawInput, ['cantidadCestas', 'CANTIDAD DE CESTAS']);
  const nroPedidoClean = String(pickProp(root, ['nroPedido', 'N° DE PEDIDO', 'numeroPedido']) ?? pickProp(rawInput, ['nroPedido', 'N° DE PEDIDO']) ?? '').trim();
  const observacionesClean = String(
    pickProp(cabeceraObj, ['observaciones_generales', 'observacionesGenerales', 'observaciones']) ??
    pickProp(root, ['observaciones', 'observaciones_generales', 'OBSERVACIONES']) ??
    pickProp(rawInput, ['observaciones', 'observaciones_generales', 'OBSERVACIONES']) ??
    ''
  ).trim();
  const condicionPagoClean = String(
    pickProp(cabeceraObj, ['condicion_pago', 'condicionPago']) ??
    pickProp(root, ['condicion_pago', 'condicionPago']) ??
    pickProp(rawInput, ['condicion_pago', 'condicionPago']) ??
    ''
  ).trim();
  const fechaEmisionExtraida = String(
    pickProp(cabeceraObj, ['fecha_emision', 'fechaEmision']) ??
    pickProp(root, ['fechaEmision', 'fecha_emision']) ??
    ''
  ).trim();
  const fechaEntregaExtraida = String(
    pickProp(cabeceraObj, ['fecha_entrega_estimada', 'fechaEntregaEstimada', 'fecha_entrega', 'fechaEntrega']) ??
    pickProp(root, ['fechaEntrega', 'fecha_entrega', 'fecha_entrega_estimada', 'FECHA', 'fecha', 'entrega', 'fechaEmision', 'fecha_emision']) ??
    ''
  ).trim();
  const monedaExtraida = String(
    pickProp(cabeceraObj, ['moneda', 'currency', 'divisa']) ??
    pickProp(root, ['moneda', 'currency', 'divisa']) ??
    pickProp(rawInput, ['moneda', 'currency']) ??
    'USD'
  ).trim().toUpperCase() || 'USD';

  let clienteCadena = String(
    root.clienteCadena ||
    rawInput.clienteCadena ||
    (clienteEmisorCabecera.toUpperCase().includes('FAMILIA') ? 'FAMILIA_CENTER' : '')
  ).trim().toUpperCase();
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

  const explicitSubAk = parseNumeroEstricto(
    pickProp(root, ['subtotalAlkosto', 'subtotal_alkosto']) ??
    pickProp(cabeceraObj, ['subtotalAlkosto', 'subtotal_alkosto']) ??
    pickProp(resumenObj, ['subtotalAlkosto', 'subtotal_alkosto']),
    0
  );
  const explicitSubFc = parseNumeroEstricto(
    pickProp(root, ['subtotalFamiliaCenter', 'subtotal_familia_center', 'subtotalFamilia', 'subtotal_familia']) ??
    pickProp(cabeceraObj, ['subtotalFamiliaCenter', 'subtotal_familia_center']) ??
    pickProp(resumenObj, ['subtotalFamiliaCenter', 'subtotal_familia_center', 'subtotalFamilia', 'subtotal_familia']),
    0
  );
  const explicitSubGen = parseNumeroEstricto(
    pickProp(root, ['subtotalGeneral', 'subtotal_general', 'total_factura', 'totalFactura', 'totalNeto', 'total_neto', 'total_general']) ??
    pickProp(cabeceraObj, ['total_factura', 'totalFactura', 'total_general']) ??
    pickProp(resumenObj, ['monto_total_orden', 'subtotal_neto', 'total_factura', 'total_general']),
    0
  );

  const finalSubAk = explicitSubAk > 0 ? explicitSubAk : (calcSubtotalAlkosto > 0 ? calcSubtotalAlkosto : undefined);
  const finalSubFc = explicitSubFc > 0 ? explicitSubFc : (calcSubtotalFamilia > 0 ? calcSubtotalFamilia : undefined);
  const finalSubGen = explicitSubGen > 0
    ? explicitSubGen
    : (finalSubAk || finalSubFc)
      ? Number(((finalSubAk || 0) + (finalSubFc || 0)).toFixed(2))
      : undefined;

  const subtotalCalc = Number(normalizedItems.reduce((acc, it) => acc + (it.totalRenglon || 0), 0).toFixed(2));
  const rawSubtotal = parseNumeroEstricto(
    root.subtotal ?? root.total ?? pickProp(resumenObj, ['subtotal_neto', 'monto_total_orden']),
    0
  );
  const normalizedFechaEmision = normalizarFechaAlkosto(fechaEmisionExtraida || fechaEntregaExtraida || '');
  const normalizedFechaEntrega = normalizarFechaAlkosto(fechaEntregaExtraida || '');

  const creditDigitsMatch = condicionPagoClean.match(/(\d{1,3})/);
  const diasCreditoFinal = parseNumeroEstricto(
    pickProp(cabeceraObj, ['dias_credito', 'diasCredito']) ??
    pickProp(root, ['diasCredito', 'dias_credito']) ??
    pickProp(rawInput, ['diasCredito', 'dias_credito']),
    creditDigitsMatch ? parseInt(creditDigitsMatch[1], 10) : 15
  );
  const tasaCambioFinal = parseNumeroEstricto(
    pickProp(cabeceraObj, ['tasa_cambio', 'tasaCambio']) ??
    pickProp(root, ['tasaCambio', 'tasa_cambio']) ??
    pickProp(rawInput, ['tasaCambio', 'tasa_cambio']),
    0
  );
  const condicionPagoFinal = condicionPagoClean || (diasCreditoFinal > 0 ? `${diasCreditoFinal} días` : null);

  // Construir estructura canónica { cabecera_orden, renglones, resumen_totales } (Regla 6)
  const cabeceraOrdenCanonica: AlkostoOcCabeceraOrden = {
    cliente_emisor: clienteEmisorCabecera || (clienteCadena === 'FAMILIA_CENTER' ? 'FAMILIA CENTER' : 'ALKOSTO'),
    receptor_destino: receptorDestinoCabecera || 'CODIZULCA',
    numero_orden_compra: rawOrdenNro || 'S/N',
    fecha_emision: normalizarFechaISOAlkosto(normalizedFechaEmision) || normalizedFechaEmision || '',
    fecha_entrega_estimada: normalizarFechaISOAlkosto(normalizedFechaEntrega),
    moneda: monedaExtraida || null,
    condicion_pago: condicionPagoFinal,
    observaciones_generales: observacionesClean || null
  };

  const renglonesCanonicos: AlkostoOcRenglonExtraido[] = normalizedItems.map((it, idx) => ({
    numero_renglon: idx + 1,
    codigo_principal: it.codigoPrincipal || it.codigo,
    codigo_ean: it.codigoEan ?? it.codigoBarra ?? null,
    codigo_interno_alkosto: it.codigoInternoAlkosto ?? null,
    descripcion_producto: it.descripcion,
    unidad_medida: it.unid,
    unidades_por_empaque: it.emp && it.emp > 0 ? Math.round(it.emp) : 1,
    cantidad_total: Number((it.totalCantidad || 0).toFixed(2)),
    distribucion_tiendas:
      it.distribucion_tiendas && it.distribucion_tiendas.length > 0
        ? it.distribucion_tiendas
        : construirDistribucionTiendasCanonico(it.tiendas, undefined, {
            codigoTienda: idClienteClean || null,
            nombreTienda: clienteNombreClean || cabeceraOrdenCanonica.cliente_emisor,
            cantidad: it.totalCantidad
          }),
    costo_unitario: Number((it.costoUnitario || 0).toFixed(4)),
    porcentaje_descuento: Number((it.descuento || 0).toFixed(2)),
    porcentaje_impuesto: Number((it.iva || 0).toFixed(2)),
    monto_total_renglon: Number((it.totalRenglon || 0).toFixed(2)),
    alerta_revision: Boolean(it.alertaRevision),
    nota_revision: it.notaRevision ?? null
  }));

  const totalUnidadesPedidas = Number(
    renglonesCanonicos.reduce((acc, r) => acc + r.cantidad_total, 0).toFixed(2)
  );
  const totalDescuentosCalc = Number(
    normalizedItems
      .reduce((acc, it) => {
        const bruto = Number(it.costoBruto || it.costoUnitario || 0);
        const neto = Number(it.costoUnitario || 0);
        if (bruto > neto && neto > 0) {
          return acc + (bruto - neto) * (it.totalCantidad || 0);
        }
        return acc;
      }, 0)
      .toFixed(2)
  );
  const totalDescuentosFinal = parseNumeroEstricto(
    pickProp(resumenObj, ['total_descuentos', 'totalDescuentos']),
    totalDescuentosCalc
  );
  const totalImpuestosCalc = Number(
    renglonesCanonicos
      .reduce((acc, r) => acc + r.monto_total_renglon * ((r.porcentaje_impuesto || 0) / 100), 0)
      .toFixed(2)
  );
  const totalImpuestosFinal = parseNumeroEstricto(
    pickProp(resumenObj, ['total_impuestos', 'totalImpuestos']),
    totalImpuestosCalc
  );
  const subtotalNetoFinal = subtotalCalc;
  const montoTotalOrdenCalc = Number((subtotalNetoFinal + totalImpuestosFinal).toFixed(2));
  const explicitMontoTotalOrden = parseNumeroEstricto(
    pickProp(resumenObj, ['monto_total_orden', 'montoTotalOrden']),
    0
  );
  const anyRowAlert = renglonesCanonicos.some(r => r.alerta_revision);
  const headerTotalMatches =
    explicitMontoTotalOrden <= 0 ||
    Math.abs(explicitMontoTotalOrden - montoTotalOrdenCalc) <= 0.5 ||
    (finalSubGen !== undefined && Math.abs(explicitMontoTotalOrden - finalSubGen) <= 0.5);

  const explicitCuadreFlag = pickProp(resumenObj, ['cuadre_aritmetico_correcto', 'cuadreAritmeticoCorrecto']);
  const cuadreAritmeticoCorrecto =
    !anyRowAlert &&
    headerTotalMatches &&
    (explicitCuadreFlag === undefined ? true : Boolean(explicitCuadreFlag));

  const resumenTotalesCanonico: AlkostoOcResumenTotales = {
    total_renglones_extraidos: renglonesCanonicos.length,
    total_unidades_pedidas: totalUnidadesPedidas,
    subtotal_neto: subtotalNetoFinal,
    total_descuentos: Number(totalDescuentosFinal.toFixed(2)),
    total_impuestos: Number(totalImpuestosFinal.toFixed(2)),
    monto_total_orden: explicitMontoTotalOrden > 0 && headerTotalMatches ? explicitMontoTotalOrden : montoTotalOrdenCalc,
    cuadre_aritmetico_correcto: cuadreAritmeticoCorrecto
  };

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
    numero_oc: rawOrdenNro || 'S/N',
    sede: String(root.sede || (clienteCadena === 'FAMILIA_CENTER' ? 'FCOP' : 'AKOP')).trim(),
    fechaEmision: normalizedFechaEmision,
    fecha_emision: normalizedFechaEmision,
    fechaEntrega: normalizedFechaEntrega,
    moneda: monedaExtraida,
    condicionPago: condicionPagoFinal || undefined,
    diasCredito: diasCreditoFinal,
    tasaCambio: tasaCambioFinal,
    proveedorNombre: String(root.proveedorNombre || receptorDestinoCabecera || 'CODIZULCA, C.A.').trim(),
    proveedorRif: String(root.proveedorRif || 'J409876136').trim(),
    observaciones: observacionesClean || undefined,
    subtotal: rawSubtotal > 0 ? rawSubtotal : subtotalCalc,
    subtotalAlkosto: finalSubAk,
    subtotalFamiliaCenter: finalSubFc,
    subtotalGeneral: finalSubGen,
    cabecera_orden: cabeceraOrdenCanonica,
    renglones: renglonesCanonicos,
    resumen_totales: resumenTotalesCanonico,
    items: normalizedItems
  };
}

/**
 * Devuelve el objeto JSON puro que cumple estrictamente con el esquema canónico
 * { cabecera_orden, renglones, resumen_totales } requerido para integración automática.
 */
export function toCanonicalAlkostoOcJson(
  input: ParsedOrdenCompraAlkosto | any,
  options: { strictMath?: boolean; requireOrdenNro?: boolean } = { strictMath: false, requireOrdenNro: false }
): AlkostoOcCanonicalPayload {
  const normalized: ParsedOrdenCompraAlkosto =
    input &&
    typeof input === 'object' &&
    input.cabecera_orden &&
    Array.isArray(input.renglones) &&
    input.resumen_totales &&
    Array.isArray(input.items)
      ? input
      : validateAndNormalizeAlkostoOC(input, options);

  return {
    cabecera_orden: normalized.cabecera_orden!,
    renglones: normalized.renglones!,
    resumen_totales: normalized.resumen_totales!
  };
}

/**
 * PASO 5: Adaptador defensivo hacia la Nota de Pedido de Codizulca (`normalizeOrderForCodizulca(rawData)`).
 * Garantiza que todos los arreglos (`items`, `renglones`, `cadenasDetectadas`, `distribucion_tiendas`, `distribucionPorTienda`)
 * y mapas (`tiendas`) existan siempre (`Array.isArray`), excluye `AKOP`, `FCOP` y `CI`, consolida por código de producto,
 * convierte strings numéricos con comas o 4 decimales a `Number` nativo y rellena valores por defecto (`0` o `""`)
 * para que la carga automática en la Nota de Pedido jamás falle por `undefined` o `NaN`.
 */
export function normalizeOrderForCodizulca(rawData: any): ParsedOrdenCompraAlkosto {
  if (!rawData || typeof rawData !== 'object') {
    throw new AlkostoOcrStageError(
      '4-Mapeo Nota de Pedido',
      'Los datos extraídos de la Orden de Compra están vacíos o no son un objeto válido.'
    );
  }

  let validated: ParsedOrdenCompraAlkosto;
  try {
    validated = validateAndNormalizeAlkostoOC(rawData, {
      strictMath: false,
      requireOrdenNro: false
    });
  } catch (err: any) {
    throw new AlkostoOcrStageError(
      '4-Mapeo Nota de Pedido',
      err?.message || 'Error al normalizar la estructura de la Orden de Compra hacia el Formato Codizulca.'
    );
  }

  const valid17Stores = new Set<string>([
    ...(CADENAS_ABREVIATURAS?.ALKOSTO || ['AK01', 'AK02', 'AK03', 'AK04', 'AK05', 'AK06', 'AK07', 'AK08', 'AK09', 'AK10']),
    ...(CADENAS_ABREVIATURAS?.FAMILIA_CENTER || ['FC01', 'FC02', 'FC03', 'FC04', 'FC05', 'FC06', 'FC07'])
  ]);

  const safeNum = (val: unknown, fallback = 0): number => {
    const n = parseNumeroEstricto(val, fallback);
    return Number.isFinite(n) && !Number.isNaN(n) ? Number(n.toFixed(4)) : fallback;
  };

  const safeStr = (val: unknown, fallback = ''): string => {
    if (val === null || val === undefined) return fallback;
    const s = String(val).trim();
    return s || fallback;
  };

  const rawItemsList = Array.isArray(validated.items) ? validated.items : [];
  const mergedItemsMap = new Map<string, ParsedOrdenCompraAlkosto['items'][0]>();

  for (let i = 0; i < rawItemsList.length; i++) {
    const it = rawItemsList[i] || ({} as any);
    const cleanStores: Record<string, number> = {};

    if (it.tiendas && typeof it.tiendas === 'object') {
      for (const [k, v] of Object.entries(it.tiendas)) {
        const tag = safeStr(k).toUpperCase();
        const qty = safeNum(v, 0);
        if (valid17Stores.has(tag) && qty > 0) {
          cleanStores[tag] = Number(((cleanStores[tag] || 0) + qty).toFixed(2));
        }
      }
    }

    const distInput = Array.isArray(it.distribucion_tiendas)
      ? it.distribucion_tiendas
      : Array.isArray(it.distribucionPorTienda)
        ? it.distribucionPorTienda
        : [];
    for (const d of distInput) {
      if (!d || typeof d !== 'object') continue;
      const tag = safeStr((d as any).codigo_tienda ?? (d as any).codigoTienda).toUpperCase();
      const qty = safeNum((d as any).cantidad, 0);
      if (valid17Stores.has(tag) && qty > 0 && cleanStores[tag] === undefined) {
        cleanStores[tag] = Number(qty.toFixed(2));
      }
    }

    const codeKey = safeStr(it.codigo || it.codigoPrincipal || it.skuCodizulca || it.codigoBarra, `ITEM_${i + 1}`);
    const costoUnit = safeNum(it.costoUnitario, 0);
    const costoBruto = safeNum(it.costoBruto, costoUnit);
    const sumAk = Object.entries(cleanStores)
      .filter(([tk]) => tk.startsWith('AK'))
      .reduce((acc, [, v]) => acc + v, 0);
    const sumAll = Object.values(cleanStores).reduce((acc, v) => acc + v, 0);
    const fallbackCant = safeNum(it.totalCantidad ?? it.cantidadTotal, 0);
    const effectiveCant = sumAk > 0 ? sumAk : sumAll > 0 ? sumAll : fallbackCant;
    const effectiveTotal = Number((effectiveCant * costoUnit).toFixed(2));

    const existing = mergedItemsMap.get(codeKey);
    if (existing && Object.keys(cleanStores).length > 0) {
      const mergedTiendas: Record<string, number> = { ...(existing.tiendas || {}) };
      for (const [tk, tv] of Object.entries(cleanStores)) {
        mergedTiendas[tk] = Number(((mergedTiendas[tk] || 0) + tv).toFixed(2));
      }
      const mSumAk = Object.entries(mergedTiendas)
        .filter(([tk]) => tk.startsWith('AK'))
        .reduce((acc, [, v]) => acc + v, 0);
      const mSumAll = Object.values(mergedTiendas).reduce((acc, v) => acc + v, 0);
      const primaryCant = mSumAk > 0 ? mSumAk : mSumAll;
      existing.tiendas = mergedTiendas;
      existing.distribucionPorTienda = construirDistribucionPorTienda(mergedTiendas);
      existing.distribucion_tiendas = construirDistribucionTiendasCanonico(mergedTiendas);
      existing.totalCantidad = Number(primaryCant.toFixed(2));
      existing.cantidadTotal = Number(primaryCant.toFixed(2));
      existing.totalRenglon = Number((primaryCant * existing.costoUnitario).toFixed(2));
    } else {
      mergedItemsMap.set(codeKey, {
        renglon: mergedItemsMap.size + 1,
        codigo: codeKey,
        codigoPrincipal: safeStr(it.codigoPrincipal, codeKey),
        skuCodizulca: safeStr(it.skuCodizulca, codeKey),
        codigoBarra: safeStr(it.codigoBarra, ''),
        codigoEan: it.codigoEan ?? (it.codigoBarra || null),
        codigoInternoAlkosto: it.codigoInternoAlkosto ?? null,
        descripcion: safeStr(it.descripcion, 'PRODUCTO CODIZULCA'),
        iva: safeNum(it.iva, 0),
        emp: safeNum(it.emp, 1),
        unid: normalizarUnidadMedidaAlkosto(it.unid, it.descripcion, it.emp),
        totalCantidad: Number(effectiveCant.toFixed(2)),
        cantidadTotal: Number(effectiveCant.toFixed(2)),
        cantDespachada: safeStr(it.cantDespachada, ''),
        costoBruto,
        ...(safeNum(it.descuento, 0) > 0 ? { descuento: Number(safeNum(it.descuento, 0).toFixed(2)) } : {}),
        costoUnitario: costoUnit,
        totalRenglon: effectiveTotal > 0 ? effectiveTotal : Number(safeNum(it.totalRenglon, 0).toFixed(2)),
        tiendas: cleanStores,
        distribucionPorTienda: construirDistribucionPorTienda(cleanStores),
        distribucion_tiendas: construirDistribucionTiendasCanonico(cleanStores),
        cuadreTiendasValido: it.cuadreTiendasValido !== false,
        alertaRevision: Boolean(it.alertaRevision),
        notaRevision: it.notaRevision ?? null
      });
    }
  }

  const safeItems = Array.from(mergedItemsMap.values());
  const safeRenglones: AlkostoOcRenglonExtraido[] = safeItems.map((it, idx) => ({
    numero_renglon: idx + 1,
    codigo_principal: safeStr(it.codigoPrincipal || it.codigo),
    codigo_ean: it.codigoEan ?? null,
    codigo_interno_alkosto: it.codigoInternoAlkosto ?? null,
    descripcion_producto: safeStr(it.descripcion),
    unidad_medida: safeStr(it.unid, 'CJ'),
    unidades_por_empaque: Math.max(1, Math.round(safeNum(it.emp, 1))),
    cantidad_total: safeNum(it.totalCantidad, 0),
    distribucion_tiendas: Array.isArray(it.distribucion_tiendas) ? it.distribucion_tiendas : [],
    costo_unitario: safeNum(it.costoUnitario, 0),
    porcentaje_descuento: safeNum(it.descuento, 0),
    porcentaje_impuesto: safeNum(it.iva, 0),
    monto_total_renglon: safeNum(it.totalRenglon, 0),
    alerta_revision: Boolean(it.alertaRevision),
    nota_revision: it.notaRevision ?? null
  }));

  const calcSubAk = Number(
    safeItems
      .reduce((acc, it) => {
        const akQty = Object.entries(it.tiendas || {})
          .filter(([tk]) => tk.startsWith('AK'))
          .reduce((s, [, v]) => s + safeNum(v, 0), 0);
        return acc + Number((akQty * safeNum(it.costoUnitario, 0)).toFixed(2));
      }, 0)
      .toFixed(2)
  );
  const calcSubFc = Number(
    safeItems
      .reduce((acc, it) => {
        const fcQty = Object.entries(it.tiendas || {})
          .filter(([tk]) => tk.startsWith('FC'))
          .reduce((s, [, v]) => s + safeNum(v, 0), 0);
        return acc + Number((fcQty * safeNum(it.costoUnitario, 0)).toFixed(2));
      }, 0)
      .toFixed(2)
  );

  const subAkFinal = safeNum(validated.subtotalAlkosto, 0) > 0 ? safeNum(validated.subtotalAlkosto, 0) : calcSubAk;
  const subFcFinal = safeNum(validated.subtotalFamiliaCenter, 0) > 0 ? safeNum(validated.subtotalFamiliaCenter, 0) : calcSubFc;
  const subGenFinal =
    safeNum(validated.subtotalGeneral, 0) > 0
      ? safeNum(validated.subtotalGeneral, 0)
      : Number((subAkFinal + subFcFinal).toFixed(2)) || safeNum(validated.subtotal, 0);

  const ordenNroSafe = safeStr(validated.ordenNro || validated.numero_oc || (rawData as any)?.numero_orden, 'S/N');
  const fechaEmisionSafe = safeStr(validated.fechaEmision || validated.fecha_emision || (rawData as any)?.fecha_emision, '');
  const fechaEntregaSafe = safeStr(validated.fechaEntrega || (rawData as any)?.fecha_entrega || fechaEmisionSafe, '');
  const diasCreditoSafe = Math.max(0, Math.round(safeNum(validated.diasCredito ?? (rawData as any)?.dias_credito, 15)));
  const tasaCambioSafe = safeNum(validated.tasaCambio ?? (rawData as any)?.tasa_cambio, 0);
  const observacionesSafe = safeStr(validated.observaciones ?? (rawData as any)?.observaciones, '');
  const subtotalSafe = safeNum(validated.subtotal, 0) > 0 ? safeNum(validated.subtotal, 0) : (subAkFinal > 0 ? subAkFinal : subGenFinal);

  return {
    ...validated,
    clienteCadena: safeStr(validated.clienteCadena, 'ALKOSTO'),
    cadenasDetectadas: Array.isArray(validated.cadenasDetectadas) && validated.cadenasDetectadas.length > 0
      ? validated.cadenasDetectadas
      : ['ALKOSTO'],
    ordenNro: ordenNroSafe,
    numero_oc: ordenNroSafe,
    sede: safeStr(validated.sede, 'AKOP'),
    fechaEmision: fechaEmisionSafe,
    fecha_emision: fechaEmisionSafe,
    fechaEntrega: fechaEntregaSafe,
    moneda: safeStr(validated.moneda, 'USD'),
    condicionPago: safeStr(validated.condicionPago, `${diasCreditoSafe} días`),
    diasCredito: diasCreditoSafe,
    tasaCambio: tasaCambioSafe,
    proveedorNombre: safeStr(validated.proveedorNombre, 'CODIZULCA, C.A.'),
    proveedorRif: safeStr(validated.proveedorRif, 'J409876136'),
    observaciones: observacionesSafe,
    subtotal: Number(subtotalSafe.toFixed(2)),
    subtotalAlkosto: subAkFinal > 0 ? Number(subAkFinal.toFixed(2)) : undefined,
    subtotalFamiliaCenter: subFcFinal > 0 ? Number(subFcFinal.toFixed(2)) : undefined,
    subtotalGeneral: subGenFinal > 0 ? Number(subGenFinal.toFixed(2)) : undefined,
    totalNeto: Number((subGenFinal || subtotalSafe).toFixed(2)),
    tiendas: Array.from(valid17Stores),
    cabecera_orden: validated.cabecera_orden || {
      cliente_emisor: safeStr(validated.clienteCadena, 'ALKOSTO'),
      receptor_destino: 'CODIZULCA',
      numero_orden_compra: ordenNroSafe,
      fecha_emision: normalizarFechaISOAlkosto(fechaEmisionSafe) || fechaEmisionSafe,
      fecha_entrega_estimada: normalizarFechaISOAlkosto(fechaEntregaSafe),
      moneda: safeStr(validated.moneda, 'USD'),
      condicion_pago: safeStr(validated.condicionPago, `${diasCreditoSafe} días`),
      observaciones_generales: observacionesSafe || null
    },
    renglones: safeRenglones,
    resumen_totales: validated.resumen_totales || {
      total_renglones_extraidos: safeRenglones.length,
      total_unidades_pedidas: Number(safeRenglones.reduce((a, r) => a + r.cantidad_total, 0).toFixed(2)),
      subtotal_neto: Number(subtotalSafe.toFixed(2)),
      total_descuentos: 0,
      total_impuestos: 0,
      monto_total_orden: Number((subGenFinal || subtotalSafe).toFixed(2)),
      cuadre_aritmetico_correcto: true
    },
    items: safeItems
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
