/**
 * Agente Experto en Auditoría Bancaria y Extracción de Datos Financieros en Venezuela.
 *
 * Provee:
 * 1. Prompt maestro y esquema estructurado para extracción multimodal (imágenes WhatsApp y PDFs bancarios).
 * 2. Cortafuegos determinista de negocio (Emisor vs. Beneficiario CODIZULCA, conversión numérica venezolana,
 *    normalización bancaria SUDEBAN, fechas DD/MM/YYYY + YYYY-MM-DD, referencia solo dígitos y RIF/CI con guion).
 * 3. Motor heurístico determinista de respaldo sobre texto extraído (PDF digital o Tesseract OCR) para garantizar
 *    continuidad operativa ante micro-cortes o indisponibilidad de API externa.
 */

import { GoogleGenAI, Type } from '@google/genai';

export type MetodoPagoSoportado =
  | 'Pago Móvil'
  | 'Transferencia'
  | 'Zelle'
  | 'Divisas Efectivo'
  | 'Biopago'
  | 'Efectivo'
  | 'Divisas';

export type ConfianzaLectura = 'alta' | 'media' | 'baja';
export type NivelConfianzaSoporte = 'ALTO' | 'MEDIO' | 'BAJO';

export const MAX_COHERENT_MONTO_BS = 5_000_000_000;

export interface PreparedGeminiImage {
  base64Data: string;
  mimeType: string;
  dataUrl: string;
  width?: number;
  height?: number;
  wasResized: boolean;
}

export interface DatosExtraidosSoporte {
  fecha_operacion: string | null;
  fecha_original: string | null;
  numero_referencia: string | null;
  monto_numerico: number | null;
  monto_texto: string | null;
  moneda: 'VES' | 'USD' | null;
  banco_identificado: string | null;
  codigo_banco: string | null;
  plataforma_canal: string | null;
  numero_cuenta: string | null;
}

export interface EvidenciaVisualSoporte {
  tiene_etiquetas_visibles: boolean;
  es_foto_de_pantalla: boolean;
  lineas_crudas_detectadas: string[];
}

export interface CanonicalVenezuelanReceiptResult {
  lectura_exitosa: boolean;
  nivel_confianza: NivelConfianzaSoporte;
  requiere_revision_manual: boolean;
  motivo_revision: string | null;
  datos_extraidos: DatosExtraidosSoporte;
  evidencia_visual: EvidenciaVisualSoporte;
}

export interface AuditedReceiptResult extends Partial<CanonicalVenezuelanReceiptResult> {
  legible: boolean;
  confianza: number;
  confianza_lectura: ConfianzaLectura;
  metodo_pago: MetodoPagoSoportado;
  banco: string | null;
  banco_origen: string | null;
  banco_destino: string | null;
  monto_bs: number | null;
  monto_texto_original: string | null;
  referencia: string | null;
  nro_referencia: string | null;
  codigo_autorizacion: string | null;
  fecha_pago: string | null;
  fecha_iso: string | null;
  titular_remitente: string | null;
  rif_ci_titular: string | null;
  beneficiario_detectado: string | null;
  observacion_auditoria: string;
  observacion_ia: string;
}

export const VENEZUELAN_RECEIPT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    lectura_exitosa: { type: Type.BOOLEAN },
    nivel_confianza: { type: Type.STRING, description: 'ALTO, MEDIO o BAJO' },
    requiere_revision_manual: { type: Type.BOOLEAN },
    motivo_revision: { type: Type.STRING, nullable: true },
    datos_extraidos: {
      type: Type.OBJECT,
      properties: {
        fecha_operacion: { type: Type.STRING, nullable: true, description: 'Fecha normalizada YYYY-MM-DD (ej. 2026-11-02) o null' },
        fecha_original: { type: Type.STRING, nullable: true, description: 'Texto original de la fecha (ej. 02/11/2026) o null' },
        numero_referencia: { type: Type.STRING, nullable: true, description: 'Referencia con ceros a la izquierda (ej. 000019111) o null' },
        monto_numerico: { type: Type.NUMBER, nullable: true, description: 'Monto float estándar con punto decimal (ej. 576599.07) o null' },
        monto_texto: { type: Type.STRING, nullable: true, description: 'Texto original del monto (ej. 576.599,07) o null' },
        moneda: { type: Type.STRING, nullable: true, description: 'VES o USD o null' },
        banco_identificado: { type: Type.STRING, nullable: true, description: 'Nombre del banco (ej. BBVA Provincial, Banesco, Banco Mercantil, Banco de Venezuela, Bancamiga, BNC, Bancaribe, Banco Exterior) o null' },
        codigo_banco: { type: Type.STRING, nullable: true, description: 'Código bancario de 4 dígitos (0108, 0134, 0105, 0102, 0172, 0191, 0114, 0115) o null' },
        plataforma_canal: { type: Type.STRING, nullable: true, description: 'Provinet, BanescOnline, Mercantil, BDVenlínea, Pago Móvil, Transferencia o null' },
        numero_cuenta: { type: Type.STRING, nullable: true, description: 'Cuenta de 20 caracteres conservando asteriscos (ej. 0108*****40*****7396) o null' }
      }
    },
    evidencia_visual: {
      type: Type.OBJECT,
      properties: {
        tiene_etiquetas_visibles: { type: Type.BOOLEAN },
        es_foto_de_pantalla: { type: Type.BOOLEAN },
        lineas_crudas_detectadas: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    },
    titular_remitente: { type: Type.STRING, nullable: true },
    rif_ci_titular: { type: Type.STRING, nullable: true },
    beneficiario_detectado: { type: Type.STRING, nullable: true },
    codigo_autorizacion: { type: Type.STRING, nullable: true }
  },
  required: ['lectura_exitosa', 'nivel_confianza', 'requiere_revision_manual', 'datos_extraidos', 'evidencia_visual']
};

export const VENEZUELAN_BANKING_AUDIT_SYSTEM_PROMPT = `Eres un motor de extracción de datos financieros y bancarios de Venezuela de precisión quirúrgica.
REGLAS ANTI-ALUCINACIÓN:
1. PROHIBIDO INVENTAR: Extrae únicamente lo que sea visualmente legible en la imagen. Si un campo no existe o no se lee, devuelve \`null\`.
2. CUENTAS ENMASCARADAS: Conserva exactamente los asteriscos (ej. \`0108*****40*****7396\`).
3. CEROS A LA IZQUIERDA: Extrae el número de referencia como texto (\`string\`) respetando todos los ceros iniciales (ej. \`"000019111"\`). Ignora cualquier ícono gráfico de copiado/compartir al final de la referencia.

REGLAS DE RECONOCIMIENTO POR PATRONES (SOPORTES RECORTADOS SIN ETIQUETAS):
Muchos vendedores suben fotos recortadas donde NO aparecen los títulos de las filas ("Fecha", "Referencia", "Monto", "Cuenta", "Banco"). Clasifica cada dato por su morfología visual:
- FECHA: Patrón \`DD/MM/YYYY\`, \`DD-MM-YYYY\` o \`YYYY-MM-DD\` (ej. \`02/11/2026\`). Normalízala a \`YYYY-MM-DD\` (\`"2026-11-02"\`) y guarda el texto original en \`fecha_original\` (\`"02/11/2026"\`).
- REFERENCIA: Secuencia de dígitos continuos sin puntos ni comas ni asteriscos (ej. \`"000019111"\`).
- MONTO: Patrón monetario con separador de miles (\`.\`) y decimales (\`,\`), como \`576.599,07\`. Devuelve el texto original en \`monto_texto\` (\`"576.599,07"\`) y el valor numérico float estándar en \`monto_numerico\` (\`576599.07\`).
- CUENTA: Secuencia de 20 caracteres (dígitos y asteriscos) que inicia con un código bancario venezolano de 4 dígitos (ej. \`0108*****40*****7396\`).
- BANCO Y PLATAFORMA: Deduce el banco por texto explícito, nombre de plataforma o los primeros 4 dígitos de la cuenta:
  * \`0108\` o \`"Provinet"\` -> \`"BBVA Provincial"\`
  * \`0134\` o \`"BanescOnline"\` -> \`"Banesco"\`
  * \`0105\` o \`"Mercantil"\` -> \`"Banco Mercantil"\`
  * \`0102\` o \`"BDVenlínea"\` -> \`"Banco de Venezuela"\`
  * \`0172\` -> \`"Bancamiga"\`
  * \`0191\` -> \`"BNC"\`
  * \`0114\` -> \`"Bancaribe"\`
  * \`0115\` -> \`"Banco Exterior"\`

ESTRUCTURA DE SALIDA (JSON PURO):
Responde ÚNICAMENTE con un objeto JSON válido siguiendo exactamente esta estructura:
{
  "lectura_exitosa": true,
  "nivel_confianza": "ALTO",
  "requiere_revision_manual": false,
  "motivo_revision": null,
  "datos_extraidos": {
    "fecha_operacion": "2026-11-02",
    "fecha_original": "02/11/2026",
    "numero_referencia": "000019111",
    "monto_numerico": 576599.07,
    "monto_texto": "576.599,07",
    "moneda": "VES",
    "banco_identificado": "BBVA Provincial",
    "codigo_banco": "0108",
    "plataforma_canal": "Provinet",
    "numero_cuenta": "0108*****40*****7396"
  },
  "evidencia_visual": {
    "tiene_etiquetas_visibles": false,
    "es_foto_de_pantalla": true,
    "lineas_crudas_detectadas": [
      "0108*****40*****7396",
      "02/11/2026",
      "000019111",
      "576.599,07"
    ]
  }
}`;

const BENEFICIARY_NAME_PATTERNS: RegExp[] = [
  /CODIZULCA/i,
  /COMERCIALIZADORA\s+ZULIANA/i,
  /DISTRIBUIDORA\s+CODIZULCA/i,
  /ZULIANA\s+DE\s+ALIMENTOS/i
];

// RIF oficial de CODIZULCA C.A.: J-40987613-6 / J-409876136
const BENEFICIARY_RIF_DIGITS = ['409876136', '40987613'];

interface BankCatalogEntry {
  canonical: string;
  codes: string[];
  patterns: RegExp[];
}

const VENEZUELAN_BANKS: BankCatalogEntry[] = [
  {
    canonical: 'Banesco',
    codes: ['0134'],
    patterns: [/\bbanesco\b/i, /\bbanesconline\b/i, /\b0134\b/]
  },
  {
    canonical: 'Banco de Venezuela',
    codes: ['0102'],
    patterns: [/banco\s+de\s+venezuela/i, /\bbdv\b/i, /bdvenl[ií]nea/i, /pagom[oó]vilbdv/i, /\b0102\b/]
  },
  {
    canonical: 'Mercantil',
    codes: ['0105'],
    patterns: [/\bmercantil\b/i, /\btpago\b/i, /\b0105\b/]
  },
  {
    canonical: 'BBVA Provincial',
    codes: ['0108'],
    patterns: [/\bprovincial\b/i, /\bbbva\b/i, /\bprovinet\b/i, /dinero\s+r[aá]pido/i, /\b0108\b/]
  },
  {
    canonical: 'BNC (Banco Nacional de Crédito)',
    codes: ['0191'],
    patterns: [/\bbnc\b/i, /nacional\s+de\s+cr[eé]dito/i, /\b0191\b/]
  },
  {
    canonical: 'Bancamiga',
    codes: ['0172'],
    patterns: [/\bbancamiga\b/i, /\b0172\b/]
  },
  {
    canonical: 'Bancaribe',
    codes: ['0114'],
    patterns: [/\bbancaribe\b/i, /\b0114\b/]
  },
  {
    canonical: 'Banplus',
    codes: ['0174'],
    patterns: [/\bbanplus\b/i, /\b0174\b/]
  },
  {
    canonical: 'Banco Exterior',
    codes: ['0115'],
    patterns: [/\bexterior\b/i, /\b0115\b/]
  },
  {
    canonical: 'Banco Plaza',
    codes: ['0138'],
    patterns: [/banco\s+plaza/i, /tu\s+pago\s+plaza/i, /\bplaza\b/i, /\b0138\b/]
  },
  {
    canonical: 'Banco Activo',
    codes: ['0171'],
    patterns: [/banco\s+activo/i, /\b0171\b/]
  },
  {
    canonical: 'Sofitasa',
    codes: ['0137'],
    patterns: [/\bsofitasa\b/i, /\b0137\b/]
  },
  {
    canonical: '100% Banco',
    codes: ['0156'],
    patterns: [/100\s*%\s*banco/i, /\b0156\b/]
  },
  {
    canonical: 'Mi Banco',
    codes: ['0169'],
    patterns: [/\bmi\s+banco\b/i, /\b0169\b/]
  },
  {
    canonical: 'Banco del Tesoro',
    codes: ['0163'],
    patterns: [/banco\s+del\s+tesoro/i, /\btesoro\b/i, /\b0163\b/]
  },
  {
    canonical: 'Banco Bicentenario',
    codes: ['0175'],
    patterns: [/\bbicentenario\b/i, /\b0175\b/]
  },
  {
    canonical: 'BFC Banco Fondo Común',
    codes: ['0151'],
    patterns: [/\bbfc\b/i, /fondo\s+com[uú]n/i, /\b0151\b/]
  },
  {
    canonical: 'Banco Venezolano de Crédito',
    codes: ['0104'],
    patterns: [/venezolano\s+de\s+cr[eé]dito/i, /\bbvc\b/i, /\b0104\b/]
  },
  {
    canonical: 'Banco Caroní',
    codes: ['0128'],
    patterns: [/\bcaron[ií]\b/i, /\b0128\b/]
  },
  {
    canonical: 'Banfanb',
    codes: ['0177'],
    patterns: [/\bbanfanb\b/i, /\b0177\b/]
  }
];

const SPANISH_MONTHS: Record<string, string> = {
  ene: '01', enero: '01',
  feb: '02', febrero: '02',
  mar: '03', marzo: '03',
  abr: '04', abril: '04',
  may: '05', mayo: '05',
  jun: '06', junio: '06',
  jul: '07', julio: '07',
  ago: '08', agosto: '08',
  sep: '09', sept: '09', septiembre: '09', setiembre: '09',
  oct: '10', octubre: '10',
  nov: '11', noviembre: '11',
  dic: '12', diciembre: '12'
};

export function safeExtractReceiptJson(raw: string): any {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Respuesta vacía del motor de auditoría bancaria.');
  }
  let text = raw.replace(/^\uFEFF/, '').trim();
  const mdBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (mdBlock && mdBlock[1]) {
    text = mdBlock[1].trim();
  } else if (text.includes('```')) {
    text = text.replace(/```[a-z]*\s*/gi, '').replace(/```/g, '').trim();
  }

  try {
    return JSON.parse(text);
  } catch {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const slice = text
        .substring(firstBrace, lastBrace + 1)
        .replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(slice);
    }
    throw new Error('No se pudo decodificar el objeto JSON del comprobante.');
  }
}

export function cleanNullableString(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s || /^(null|undefined|n\/a|na|ninguno|no\s+aplica|no\s+visible|desconocido|-+)$/i.test(s)) {
    return null;
  }
  return s;
}

export function isBeneficiaryName(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  return BENEFICIARY_NAME_PATTERNS.some((rx) => rx.test(normalized));
}

export function isBeneficiaryRif(rif: string | null | undefined): boolean {
  if (!rif) return false;
  const digits = String(rif).replace(/\D/g, '');
  if (!digits) return false;
  return BENEFICIARY_RIF_DIGITS.some((b) => digits.includes(b));
}

/**
 * Detecta dinámicamente el mimeType real de un soporte (`image/jpeg`, `image/png`, `image/webp` o `application/pdf`)
 * inspeccionando magic bytes, encabezado DataURL, MIME declarado y extensión de archivo.
 * Nunca deja fijo `image/png` si entra un `.jpeg` o `.webp`.
 */
export function detectReceiptMimeType(
  base64OrDataUrl?: string | Uint8Array | null,
  declaredMime?: string | null,
  fileName?: string | null
): string {
  if (typeof base64OrDataUrl === 'string') {
    const trimmed = base64OrDataUrl.trim();
    const dataUrlMatch = trimmed.match(/^data:(image\/(?:jpeg|jpg|png|webp)|application\/pdf);base64,/i);
    if (dataUrlMatch) {
      const m = dataUrlMatch[1].toLowerCase();
      return m === 'image/jpg' ? 'image/jpeg' : m;
    }
    const pureB64 = (trimmed.includes(',') ? trimmed.split(',')[1] : trimmed).replace(/\s+/g, '');
    if (pureB64.startsWith('JVBERi0')) return 'application/pdf';
    if (pureB64.startsWith('/9j/')) return 'image/jpeg';
    if (pureB64.startsWith('iVBORw0KGgo')) return 'image/png';
    if (pureB64.startsWith('UklGR')) return 'image/webp';
  } else if (base64OrDataUrl && base64OrDataUrl.length >= 12) {
    const b = base64OrDataUrl;
    if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
    if (
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
    ) {
      return 'image/webp';
    }
  }

  const rawMime = String(declaredMime || '').trim().toLowerCase();
  if (rawMime === 'image/jpg' || rawMime === 'image/jpeg') return 'image/jpeg';
  if (rawMime === 'image/png') return 'image/png';
  if (rawMime === 'image/webp') return 'image/webp';
  if (rawMime === 'application/pdf') return 'application/pdf';

  const lowerName = String(fileName || '').trim().toLowerCase();
  if (lowerName.endsWith('.pdf')) return 'application/pdf';
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';

  return 'image/jpeg';
}

/**
 * 1. ARQUITECTURA DE PROCESAMIENTO DE IMAGEN (PRE-ENVÍO A LA IA): `prepareImageForGemini`
 * - Acepta archivos `image/jpeg`, `image/png`, `image/webp` (y `application/pdf`).
 * - Detecta dinámicamente el `mimeType` real del archivo (nunca deja fijo `image/png` si entra un `.jpeg`).
 * - Extrae únicamente el payload Base64 puro haciendo `.split(',')[1]` sobre el `DataURL` para eliminar
 *   el prefijo `data:image/...;base64,` (evitando errores 400 Bad Request en `inlineData`).
 * - Si la imagen supera los 2048px de ancho/alto, la redimensiona en un `<canvas>` manteniendo la
 *   proporción original y calidad alta (`0.92`) para conservar la nitidez en fotos a monitores (efecto moiré).
 */
export async function prepareImageForGemini(
  input: File | Blob | string,
  options: { maxDimension?: number; quality?: number; declaredMime?: string; fileName?: string } = {}
): Promise<PreparedGeminiImage> {
  const maxDim = options.maxDimension ?? 2048;
  const quality = options.quality ?? 0.92;

  const readInputAsDataUrl = (): Promise<{ dataUrl: string; declaredMime: string; fileName: string }> => {
    if (typeof input === 'string') {
      const trimmed = input.trim();
      const detected = detectReceiptMimeType(trimmed, options.declaredMime, options.fileName);
      const pure = (trimmed.includes(',') ? trimmed.split(',')[1] : trimmed).replace(/\s+/g, '');
      const fullDataUrl = trimmed.startsWith('data:') ? trimmed : `data:${detected};base64,${pure}`;
      return Promise.resolve({
        dataUrl: fullDataUrl,
        declaredMime: detected,
        fileName: options.fileName || ''
      });
    }

    const fileObj = input as File;
    const fMime = fileObj.type || options.declaredMime || '';
    const fName = fileObj.name || options.fileName || '';

    if (typeof FileReader !== 'undefined') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = String(e.target?.result || '');
          if (!result) {
            return reject(new Error('El archivo de soporte está vacío o no pudo leerse.'));
          }
          resolve({ dataUrl: result, declaredMime: fMime, fileName: fName });
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo de soporte.'));
        reader.readAsDataURL(input);
      });
    }

    return input.arrayBuffer().then((ab) => {
      const bytes = new Uint8Array(ab);
      const detected = detectReceiptMimeType(bytes, fMime, fName);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = typeof Buffer !== 'undefined' ? Buffer.from(ab).toString('base64') : btoa(binary);
      return {
        dataUrl: `data:${detected};base64,${b64}`,
        declaredMime: detected,
        fileName: fName
      };
    });
  };

  const { dataUrl, declaredMime, fileName } = await readInputAsDataUrl();
  const rawBase64 = (dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl).replace(/\s+/g, '');
  const detectedMime = detectReceiptMimeType(rawBase64, declaredMime, fileName);

  // Si es PDF o estamos en entorno Node sin DOM Image/Canvas, retornar el Base64 puro con su MIME real
  if (
    detectedMime === 'application/pdf' ||
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof Image === 'undefined'
  ) {
    return {
      base64Data: rawBase64,
      mimeType: detectedMime,
      dataUrl: `data:${detectedMime};base64,${rawBase64}`,
      wasResized: false
    };
  }

  // En navegador: verificar dimensiones de la imagen y redimensionar en <canvas> si supera 2048px (calidad 0.92)
  return new Promise<PreparedGeminiImage>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width || 0;
        let height = img.naturalHeight || img.height || 0;

        if (width <= 0 || height <= 0 || (width <= maxDim && height <= maxDim)) {
          return resolve({
            base64Data: rawBase64,
            mimeType: detectedMime,
            dataUrl: `data:${detectedMime};base64,${rawBase64}`,
            width: width || undefined,
            height: height || undefined,
            wasResized: false
          });
        }

        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({
            base64Data: rawBase64,
            mimeType: detectedMime,
            dataUrl: `data:${detectedMime};base64,${rawBase64}`,
            width,
            height,
            wasResized: false
          });
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        const outputMime = detectedMime === 'image/png' || detectedMime === 'image/webp' ? detectedMime : 'image/jpeg';
        if (outputMime === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);

        const resizedDataUrl = canvas.toDataURL(outputMime, quality);
        const resizedBase64 = (resizedDataUrl.includes(',') ? resizedDataUrl.split(',')[1] : resizedDataUrl).replace(/\s+/g, '');
        const finalMime = detectReceiptMimeType(resizedBase64, outputMime, fileName);

        resolve({
          base64Data: resizedBase64,
          mimeType: finalMime,
          dataUrl: `data:${finalMime};base64,${resizedBase64}`,
          width,
          height,
          wasResized: true
        });
      } catch {
        resolve({
          base64Data: rawBase64,
          mimeType: detectedMime,
          dataUrl: `data:${detectedMime};base64,${rawBase64}`,
          wasResized: false
        });
      }
    };
    img.onerror = () => {
      resolve({
        base64Data: rawBase64,
        mimeType: detectedMime,
        dataUrl: `data:${detectedMime};base64,${rawBase64}`,
        wasResized: false
      });
    };
    img.src = `data:${detectedMime};base64,${rawBase64}`;
  });
}

/**
 * 3. PARSER NUMÉRICO VENEZOLANO EN CÓDIGO (DOBLE VERIFICACIÓN): `parseMontoVenezolano(valor)`
 * Si la IA o el usuario devuelve `"576.599,07"`, elimina los puntos de miles y reemplaza la coma decimal
 * por punto antes de hacer `parseFloat()`, garantizando que el resultado sea exactamente `576599.07`
 * y nunca `NaN` ni `576.599`.
 */
export function parseMontoVenezolano(valor: unknown): number {
  const parsed = parseVenezuelanMonto(valor);
  return parsed !== null && Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Regla 1 y Regla 6: Convierte montos impresos en formato venezolano ("Bs. 203.242,47", "576.599,07", "22.000,00 Bs")
 * o estándar a número flotante con 2 decimales (ej. 576599.07) sin separadores de miles.
 * Rechaza dígitos de teléfonos, RIF/Cédula, cuentas bancarias o montos incoherentes (> 5.000.000.000,00 Bs o > 10 dígitos enteros).
 */
export function parseVenezuelanMonto(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || val <= 0) return null;
    if (val > MAX_COHERENT_MONTO_BS || Math.trunc(val).toString().length > 10) {
      return null;
    }
    return Number(val.toFixed(2));
  }

  let s = String(val).trim();
  if (!s) return null;

  // Regla 1 Anti-Alucinación: Prohibido extraer dígitos de teléfonos, RIF/Cédula o cuentas de 20 dígitos
  const hasCurrencyHint = /\b(?:bs\.?|bol[ií]vares|ves|monto|total)\b/i.test(s);
  if (!hasCurrencyHint) {
    if (/^[VJEG]\s*[-.]?\s*\d{5,10}$/i.test(s)) return null;
    const onlyDigits = s.replace(/\D/g, '');
    if (
      /^04(12|14|16|24|26)\d{7}$/.test(onlyDigits) ||
      /^584(12|14|16|24|26)\d{7}$/.test(onlyDigits) ||
      (onlyDigits.length === 20 && onlyDigits.startsWith('01'))
    ) {
      return null;
    }
  }

  // Compactar espacios accidentales de OCR junto a separadores numéricos (ej. "203.242, 47" -> "203.242,47")
  s = s.replace(/(\d)\s*([.,])\s*(\d)/g, '$1$2$3');

  // Aislar el primer token numérico monetario válido (evitando capturar otros textos)
  const moneyMatch = s.match(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!moneyMatch) return null;
  s = moneyMatch[1];

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');

  let parsed = NaN;
  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // Formato venezolano clásico: 203.242,47
      parsed = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    } else {
      // Formato anglosajón: 203,242.47
      parsed = parseFloat(s.replace(/,/g, ''));
    }
  } else if (hasComma) {
    // Si termina en ,XX o ,X es decimal venezolano; si tiene múltiples comas de miles (203,242,000) quitar comas
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      parsed = parseFloat(s.replace(',', '.'));
    } else {
      parsed = parseFloat(s.replace(/,/g, ''));
    }
  } else if (hasDot) {
    const parts = s.split('.');
    if (parts.length === 2 && parts[1].length <= 2) {
      parsed = parseFloat(s);
    } else {
      // Múltiples puntos o 3 dígitos exactos de miles sin decimales (ej. "15.000")
      parsed = parseFloat(s.replace(/\./g, ''));
    }
  } else {
    parsed = parseFloat(s);
  }

  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  // Regla 6 Validación de Coherencia: rechazar lecturas > 5.000.000.000,00 Bs o con más de 10 dígitos enteros
  if (parsed > MAX_COHERENT_MONTO_BS || Math.trunc(parsed).toString().length > 10) {
    return null;
  }

  return Number(parsed.toFixed(2));
}

/**
 * Regla 2: Extrae únicamente la cadena de dígitos del número de referencia,
 * ignorando íconos de copiado al final (BNC, Mercantil, Banesco) y descartando
 * teléfonos celulares venezolanos o números de cuenta de 20 dígitos.
 */
export function normalizeReferenciaBancaria(val: unknown): string | null {
  const clean = cleanNullableString(val);
  if (!clean) return null;

  // Descartar cuentas bancarias enmascaradas con asteriscos (ej. "0108*****40*****7396")
  if (/[*•]/.test(clean) || /\b01\d{2}[*xX•\d-]{10,20}\b/.test(clean)) {
    return null;
  }

  // Eliminar anotaciones de íconos ej. "[ícono]", "[icono]", "(copiar)" o símbolos unicode de copiado/lupa
  let sanitized = clean
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/[\u{1F4CB}\u{1F50D}\u{1F50E}\u{2398}\u{274F}\u{2750}\u{1F517}]/gu, ' ')
    .trim();

  // Si el OCR leyó el ícono de copiado al final separado por espacio como un '0', 'O' u '8' suelto (ej. "947474757 0" o "947474757 O")
  sanitized = sanitized.replace(/^(\D*\d{6,14})\s+[0O8Qo]\s*$/, '$1');

  const digits = sanitized.replace(/\D/g, '');
  if (!digits || digits.length < 4) return null;

  // Descartar si por error es un número celular venezolano de 11 dígitos (0412/0414/0416/0424/0426)
  // o con código de país 58 (12 dígitos: 58414...)
  if (/^04(12|14|16|24|26)\d{7}$/.test(digits) || /^584(12|14|16|24|26)\d{7}$/.test(digits)) {
    return null;
  }

  // Descartar si es un número de cuenta bancaria nacional de 20 dígitos exactos comenzando por 01
  if (digits.length === 20 && digits.startsWith('01')) {
    return null;
  }

  return digits;
}

function matchCatalogVenezuelanBank(val: unknown): string | null {
  const clean = cleanNullableString(val);
  if (!clean) return null;

  for (const bank of VENEZUELAN_BANKS) {
    if (
      bank.patterns.some((rx) => rx.test(clean)) ||
      bank.codes.some((code) => new RegExp(`(?:^|\\b)${code}(?:\\b|\\*|\\d)`).test(clean))
    ) {
      return bank.canonical;
    }
  }

  if (/\bzelle\b/i.test(clean)) return 'Zelle';
  if (/bank\s+of\s+america|\bbofa\b/i.test(clean)) return 'Bank of America';
  if (/wells\s+fargo/i.test(clean)) return 'Wells Fargo';
  if (/\bchase\b/i.test(clean)) return 'Chase';

  return null;
}

/**
 * Extrae el número de cuenta bancaria venezolana de 20 dígitos o cuenta enmascarada con asteriscos
 * (ej. `0108*****40*****7396`) que inicia con un código bancario SUDEBAN de 4 dígitos (`0102`, `0105`, `0108`, `0134`, etc.),
 * conservando exactamente los asteriscos sin adivinar dígitos ocultos (Regla 3).
 */
export function extractNumeroCuentaVenezolana(val: unknown): string | null {
  const clean = cleanNullableString(val);
  if (!clean) return null;

  const match = clean.match(/\b(01(?:02|04|05|08|14|15|28|34|37|38|51|56|63|68|69|71|72|74|75|77|91)[*•xX\d-]{8,22})\b/);
  if (!match) return null;

  const candidate = match[1].trim();
  const digitsAndMasks = candidate.replace(/-/g, '');
  if (digitsAndMasks.length < 10 || digitsAndMasks.length > 24) {
    return null;
  }
  return candidate;
}

/**
 * Extrae la cadena monetaria exacta (ej. `"576.599,07"` o `"203.242,47"`) desde el texto original sin inventar valores si es nulo.
 */
export function extractMontoTextoExacto(val: unknown): string | null {
  const clean = cleanNullableString(val);
  if (!clean) return null;
  const normalized = clean.replace(/(\d)\s*([.,])\s*(\d)/g, '$1$2$3');
  const m = normalized.match(/(\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d+,\d{2}|\d+\.\d{2})/);
  return m ? m[1] : null;
}

/**
 * Resuelve `banco_identificado`, `codigo_banco` y `plataforma_canal` aplicando las reglas morfológicas
 * sobre el nombre explícito, plataforma en pantalla o los primeros 4 dígitos de la cuenta bancaria.
 */
export function resolveVenezuelanBankDetails(
  bankInput: unknown,
  accountInput?: unknown,
  platformInput?: unknown,
  contextText?: string
): {
  banco_identificado: string | null;
  codigo_banco: string | null;
  plataforma_canal: string | null;
  legacy_banco: string | null;
} {
  const cleanBank = cleanNullableString(bankInput);
  const rawArg2 = cleanNullableString(accountInput);
  const rawArg3 = cleanNullableString(platformInput);

  const arg2LooksLikeAccOrCode =
    Boolean(extractNumeroCuentaVenezolana(rawArg2)) || Boolean(rawArg2 && /^01\d{2}$/.test(rawArg2));
  const arg3LooksLikeAccOrCode =
    Boolean(extractNumeroCuentaVenezolana(rawArg3)) || Boolean(rawArg3 && /^01\d{2}$/.test(rawArg3));

  const cleanAcc = arg2LooksLikeAccOrCode
    ? extractNumeroCuentaVenezolana(rawArg2) || rawArg2
    : arg3LooksLikeAccOrCode
      ? extractNumeroCuentaVenezolana(rawArg3) || rawArg3
      : null;

  const cleanPlat = !arg2LooksLikeAccOrCode && rawArg2
    ? rawArg2
    : !arg3LooksLikeAccOrCode && rawArg3
      ? rawArg3
      : null;

  const combined = [cleanBank, cleanAcc, cleanPlat, contextText || ''].filter(Boolean).join(' ');

  let codigoBanco: string | null = null;
  const codeFromAcc = cleanAcc?.match(/^(01\d{2})/);
  if (codeFromAcc) {
    codigoBanco = codeFromAcc[1];
  }

  let matchedEntry: BankCatalogEntry | null = null;
  for (const entry of VENEZUELAN_BANKS) {
    if (codigoBanco && entry.codes.includes(codigoBanco)) {
      matchedEntry = entry;
      break;
    }
    if (
      (cleanBank && (entry.patterns.some((rx) => rx.test(cleanBank)) || entry.codes.some((c) => new RegExp(`(?:^|\\b)${c}(?:\\b|\\*|\\d)`).test(cleanBank)))) ||
      (cleanPlat && entry.patterns.some((rx) => rx.test(cleanPlat))) ||
      (cleanAcc && entry.codes.some((c) => new RegExp(`(?:^|\\b)${c}(?:\\b|\\*|\\d)`).test(cleanAcc)))
    ) {
      matchedEntry = entry;
      codigoBanco = codigoBanco || entry.codes[0] || null;
      break;
    }
  }

  let legacyBanco = normalizeVenezuelanBank(cleanBank) || (matchedEntry ? matchedEntry.canonical : null);
  let bancoIdentificado = legacyBanco;

  // En el esquema canónico `datos_extraidos.banco_identificado`, 0105 / Mercantil en Línea se normaliza a "Banco Mercantil"
  if (matchedEntry?.codes.includes('0105') || /\bmercantil\b/i.test(combined)) {
    bancoIdentificado = 'Banco Mercantil';
    codigoBanco = codigoBanco || '0105';
    if (!legacyBanco) legacyBanco = 'Mercantil';
  } else if (matchedEntry) {
    bancoIdentificado = matchedEntry.canonical;
    codigoBanco = codigoBanco || matchedEntry.codes[0] || null;
  }

  // Plataforma / canal solo si está explícita en el input o en el texto visual (Regla 2: CERO INVENCIÓN)
  let plataformaCanal: string | null = cleanPlat;
  if (!plataformaCanal && combined) {
    if (/\bprovinet\b/i.test(combined)) plataformaCanal = 'Provinet';
    else if (/\bbanesconline\b/i.test(combined)) plataformaCanal = 'BanescOnline';
    else if (/mercantil\s+en\s+l[ií]nea/i.test(combined)) plataformaCanal = 'Mercantil en Línea';
    else if (/bdvenl[ií]nea/i.test(combined)) plataformaCanal = 'BDVenlínea';
    else if (/pagom[oó]vilbdv/i.test(combined)) plataformaCanal = 'PagoMóvilBDV';
    else if (/\btpago\b/i.test(combined)) plataformaCanal = 'Tpago';
    else if (/dinero\s+r[aá]pido/i.test(combined)) plataformaCanal = 'Dinero Rápido';
    else if (/pago\s*m[oó]vil/i.test(combined)) plataformaCanal = 'Pago Móvil';
    else if (/\btransferencia\b/i.test(combined)) plataformaCanal = 'Transferencia';
  }

  return {
    banco_identificado: bancoIdentificado,
    codigo_banco: codigoBanco,
    plataforma_canal: plataformaCanal,
    legacy_banco: legacyBanco
  };
}

/**
 * Regla 3: Normaliza el nombre del banco venezolano según catálogo oficial y códigos SUDEBAN.
 */
export function normalizeVenezuelanBank(val: unknown): string | null {
  const clean = cleanNullableString(val);
  if (!clean) return null;

  if (/banco\s+mercantil|mercantil\s+en\s+l[ií]nea/i.test(clean)) {
    return 'Banco Mercantil';
  }

  const catalogMatch = matchCatalogVenezuelanBank(clean);
  if (catalogMatch) return catalogMatch;

  if (/^(origen|destino|emisor|receptor|beneficiario|banco|cuenta)$/i.test(clean)) {
    return null;
  }

  return clean;
}

/**
 * Regla 4: Clasifica estrictamente el método de pago en los valores soportados.
 */
export function normalizeMetodoPago(
  val: unknown,
  contextHint?: string
): MetodoPagoSoportado {
  const combined = `${cleanNullableString(val) || ''} ${contextHint || ''}`.trim();
  const s = combined.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const raw = (cleanNullableString(val) || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (/\bbiopago\b/.test(raw) || (/\bbiopago\b/.test(s) && !raw)) return 'Biopago';
  if (/\bzelle\b/.test(raw) || (/\bzelle\b/.test(s) && !raw)) return 'Zelle';
  if (/\bdivisas?\s+efectivo\b/.test(raw)) return 'Divisas Efectivo';
  if (/\befectivo\b/.test(raw)) return 'Efectivo';
  if (/\bdivisas?\b|\busd\b|\bdolares?\b/.test(raw)) return 'Divisas';
  if (
    /su\s+pago\s+movil\s+ha\s+sido\s+ejecutado\s+exitosamente|pago\s*movil|\bp2p\b|\bp2c\b|\bc2p\b|\btpago\b|dinero\s*rapido|interbancario\s*movil/.test(
      raw
    )
  ) {
    return 'Pago Móvil';
  }
  if (/transferencia/.test(raw)) {
    return 'Transferencia';
  }

  // Inferencia por evidencia visual/contextual
  if (/\bbiopago\b/.test(s)) return 'Biopago';
  if (/\bzelle\b/.test(s)) return 'Zelle';
  if (
    /su\s+pago\s+movil\s+ha\s+sido\s+ejecutado\s+exitosamente|pago\s*movil|\bp2p\b|\bp2c\b|\bc2p\b|\btpago\b|dinero\s*rapido|\b04(12|14|16|24|26)[-\s]?\d{7}\b/.test(
      s
    )
  ) {
    return 'Pago Móvil';
  }
  if (/\b01\d{2}[*\d\s-]{12,22}\b|transferencia|cuenta\s+destino|cuenta\s+origen/.test(s)) {
    return 'Transferencia';
  }

  return 'Pago Móvil';
}

function normalizeConfianzaLectura(
  rawConfianzaLectura: unknown,
  numericConfianza: number,
  legible: boolean,
  isCompleteCore: boolean
): ConfianzaLectura {
  const clean = cleanNullableString(rawConfianzaLectura)
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (clean === 'alta' || clean === 'alto') return 'alta';
  if (clean === 'media' || clean === 'medio') return 'media';
  if (clean === 'baja' || clean === 'bajo') return 'baja';
  if (!legible || numericConfianza < 0.5) return 'baja';
  if (isCompleteCore && numericConfianza >= 0.85) return 'alta';
  return 'media';
}

function toNivelConfianzaSoporte(confianzaLectura: ConfianzaLectura, rawNivel?: unknown): NivelConfianzaSoporte {
  const clean = cleanNullableString(rawNivel)
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (clean === 'ALTO' || clean === 'ALTA') return 'ALTO';
  if (clean === 'MEDIO' || clean === 'MEDIA') return 'MEDIO';
  if (clean === 'BAJO' || clean === 'BAJA') return 'BAJO';
  if (confianzaLectura === 'alta') return 'ALTO';
  if (confianzaLectura === 'media') return 'MEDIO';
  return 'BAJO';
}

/**
 * Regla 5: Extrae y normaliza la fecha explícita impresa en el comprobante a DD/MM/YYYY y YYYY-MM-DD.
 * Si el comprobante no muestra fecha (ej. capturas de Pago Móvil BNC), devuelve null.
 */
export function normalizeReceiptDates(
  fechaPagoRaw: unknown,
  fechaIsoRaw?: unknown
): { fecha_pago: string | null; fecha_iso: string | null } {
  const candidates = [cleanNullableString(fechaPagoRaw), cleanNullableString(fechaIsoRaw)].filter(
    (x): x is string => Boolean(x)
  );

  for (const cand of candidates) {
    // 1. Formato DD/MM/YYYY o DD-MM-YYYY (con o sin hora posterior)
    const dmy = cand.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2}|\d{2})\b/);
    if (dmy) {
      let day = parseInt(dmy[1], 10);
      let month = parseInt(dmy[2], 10);
      let year = parseInt(dmy[3], 10);
      if (year < 100) year += 2000;

      // Si vino invertido MM/DD/YYYY (ej. 10/29/2026) corregir automáticamente
      if (month > 12 && day <= 12) {
        const tmp = day;
        day = month;
        month = tmp;
      }

      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
        const dd = String(day).padStart(2, '0');
        const mm = String(month).padStart(2, '0');
        const yyyy = String(year);
        return {
          fecha_pago: `${dd}/${mm}/${yyyy}`,
          fecha_iso: `${yyyy}-${mm}-${dd}`
        };
      }
    }

    // 2. Formato ISO YYYY-MM-DD o YYYY/MM/DD
    const ymd = cand.match(/\b(20\d{2})[/-](\d{1,2})[/-](\d{1,2})\b/);
    if (ymd) {
      const year = parseInt(ymd[1], 10);
      const month = parseInt(ymd[2], 10);
      const day = parseInt(ymd[3], 10);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        const dd = String(day).padStart(2, '0');
        const mm = String(month).padStart(2, '0');
        const yyyy = String(year);
        return {
          fecha_pago: `${dd}/${mm}/${yyyy}`,
          fecha_iso: `${yyyy}-${mm}-${dd}`
        };
      }
    }

    // 3. Formato textual en español: "29 de octubre de 2026" o "29 oct. 2026"
    const txt = cand
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const textDate = txt.match(/\b(\d{1,2})\s*(?:de\s*)?([a-z]{3,10})\.?\s*(?:de\s*|del\s*|,\s*)?(20\d{2})?\b/);
    if (textDate && SPANISH_MONTHS[textDate[2]]) {
      const day = parseInt(textDate[1], 10);
      const mm = SPANISH_MONTHS[textDate[2]];
      const yyyy = textDate[3] || String(new Date().getFullYear());
      if (day >= 1 && day <= 31) {
        const dd = String(day).padStart(2, '0');
        return {
          fecha_pago: `${dd}/${mm}/${yyyy}`,
          fecha_iso: `${yyyy}-${mm}-${dd}`
        };
      }
    }
  }

  return { fecha_pago: null, fecha_iso: null };
}

/**
 * Normaliza RIF o Cédula al formato letra mayúscula + guion + dígitos:
 * V-12345678, J-123456789, E-12345678 o G-123456789.
 * Si pertenece al beneficiario (CODIZULCA J-40987613-6) o no es válido, devuelve null.
 */
export function normalizeRifCiTitular(val: unknown): string | null {
  const clean = cleanNullableString(val);
  if (!clean) return null;

  const compact = clean.toUpperCase().replace(/[^VJEG0-9]/g, '');
  const match = compact.match(/^([VJEG])0*(\d{5,10})$/);
  if (!match) {
    // Soportar caso donde viene con ceros a la izquierda significativos en RIF jurídico
    const matchRaw = compact.match(/^([VJEG])(\d{6,10})$/);
    if (!matchRaw) return null;
    const formattedRaw = `${matchRaw[1]}-${matchRaw[2]}`;
    return isBeneficiaryRif(formattedRaw) ? null : formattedRaw;
  }

  const letter = match[1];
  const digits = match[2];
  const formatted = `${letter}-${digits}`;

  if (isBeneficiaryRif(formatted)) {
    return null;
  }

  return formatted;
}

/**
 * Aplica determinísticamente las Reglas Estrictas de Extracción Visual (Anti-Alucinación)
 * sobre cualquier salida cruda (provenga de Gemini Multimodal o del parser determinista PDF/Tesseract).
 * Soporta tanto la estructura anidada `{ lectura_exitosa, nivel_confianza, datos_extraidos, evidencia_visual }`
 * como la estructura plana heredada `{ legible, monto_bs, referencia, banco, fecha_pago, ... }`.
 */
export function auditAndNormalizeReceiptPayload(rawInput: any): AuditedReceiptResult {
  const raw = rawInput && typeof rawInput === 'object' ? rawInput : {};
  const datosSub = raw.datos_extraidos && typeof raw.datos_extraidos === 'object' ? raw.datos_extraidos : {};
  const evidenciaSub = raw.evidencia_visual && typeof raw.evidencia_visual === 'object' ? raw.evidencia_visual : {};

  let beneficiario = cleanNullableString(
    raw.beneficiario_detectado ?? raw.beneficiario ?? raw.destinatario ?? datosSub.beneficiario
  );
  let titular = cleanNullableString(
    raw.titular_remitente ?? raw.titular ?? raw.remitente ?? raw.ordenante ?? raw.emisor ?? datosSub.titular
  );
  let rif = normalizeRifCiTitular(
    raw.rif_ci_titular ?? raw.rif_ci ?? raw.rif ?? raw.cedula ?? raw.documento_emisor ?? datosSub.rif
  );

  // Cortafuegos Emisor vs. Beneficiario
  if (titular && isBeneficiaryName(titular)) {
    if (!beneficiario) {
      beneficiario = titular;
    }
    titular = null;
    rif = null;
  }

  if (
    titular &&
    beneficiario &&
    titular.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() ===
      beneficiario.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  ) {
    titular = null;
    rif = null;
  }

  if (rif && isBeneficiaryRif(rif)) {
    rif = null;
  }

  // REGLA 1 y REGLA 6: Monto en Bolívares con validación de coherencia (<= 5.000.000.000,00 Bs y <= 10 dígitos enteros)
  const rawMontoTextoInput = cleanNullableString(
    datosSub.monto_texto ?? raw.monto_texto ?? raw.monto_texto_original ?? raw.monto_bs_formateado
  );
  const rawMontoNumInput =
    datosSub.monto_numerico ?? raw.monto_numerico ?? raw.monto_bs ?? raw.monto;
  const montoBs =
    parseVenezuelanMonto(rawMontoNumInput) ??
    parseVenezuelanMonto(rawMontoTextoInput);

  const exactMontoTexto =
    montoBs !== null
      ? extractMontoTextoExacto(rawMontoTextoInput) ??
        extractMontoTextoExacto(typeof rawMontoNumInput === 'string' ? rawMontoNumInput : null) ??
        new Intl.NumberFormat('es-VE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(montoBs)
      : null;

  // REGLA 2 y 4: Número de Referencia (solo dígitos, conservando todos los ceros a la izquierda como "000019111")
  const codigoAutorizacion = normalizeReferenciaBancaria(
    raw.codigo_autorizacion ?? raw.codigoAutorizacion ?? datosSub.codigo_autorizacion
  );
  const primaryReferencia = normalizeReferenciaBancaria(
    datosSub.numero_referencia ?? raw.numero_referencia ?? raw.referencia ?? raw.nro_referencia
  );
  const nroReferencia = primaryReferencia ?? codigoAutorizacion ?? null;

  // REGLA 3: Cuenta bancaria (20 dígitos o enmascarada con asteriscos como 0108*****40*****7396) y Bancos
  const rawCuentaInput =
    datosSub.numero_cuenta ??
    datosSub.cuenta_origen_o_destino ??
    raw.numero_cuenta ??
    raw.cuenta_origen_o_destino ??
    raw.cuenta_enmascarada ??
    raw.cuenta_origen ??
    raw.cuenta_destino;
  const numeroCuenta = extractNumeroCuentaVenezolana(rawCuentaInput) ?? cleanNullableString(rawCuentaInput);

  const rawLineasCrudas: string[] = Array.isArray(evidenciaSub.lineas_crudas_detectadas)
    ? evidenciaSub.lineas_crudas_detectadas.map((l: unknown) => String(l ?? '').trim()).filter(Boolean)
    : Array.isArray(raw.lineas_crudas_detectadas)
      ? raw.lineas_crudas_detectadas.map((l: unknown) => String(l ?? '').trim()).filter(Boolean)
      : [];

  const bankDetails = resolveVenezuelanBankDetails(
    datosSub.banco_identificado ?? raw.banco_identificado ?? raw.banco ?? raw.banco_origen ?? raw.banco_destino,
    numeroCuenta || datosSub.codigo_banco || raw.codigo_banco,
    datosSub.plataforma_canal ?? raw.plataforma_canal ?? raw.metodo_pago,
    rawLineasCrudas.join(' ')
  );

  const bancoOrigen = normalizeVenezuelanBank(raw.banco_origen);
  const bancoDestino = normalizeVenezuelanBank(raw.banco_destino);
  const bancoPrincipal =
    normalizeVenezuelanBank(raw.banco) ||
    bancoOrigen ||
    bancoDestino ||
    bankDetails.legacy_banco ||
    bankDetails.banco_identificado ||
    null;

  // REGLA 4: Método de Pago
  const rawObservacion = cleanNullableString(
    raw.observacion_auditoria ?? raw.observacion_ia ?? raw.motivo_revision
  );
  const metodoPago = normalizeMetodoPago(
    raw.metodo_pago ?? bankDetails.plataforma_canal,
    `${bancoPrincipal || ''} ${numeroCuenta || ''} ${rawMontoTextoInput || ''} ${rawObservacion || ''} ${rawLineasCrudas.join(' ')}`
  );

  // REGLA 5: Fechas DD/MM/YYYY (`fecha_original`) y YYYY-MM-DD (`fecha_operacion`)
  const { fecha_pago, fecha_iso } = normalizeReceiptDates(
    datosSub.fecha_original ?? raw.fecha_original ?? raw.fecha_pago,
    datosSub.fecha_operacion ?? raw.fecha_operacion ?? raw.fecha_iso
  );

  const rawMonedaInput = cleanNullableString(datosSub.moneda ?? raw.moneda)?.toUpperCase();
  const monedaDetectada: 'VES' | 'USD' | null =
    rawMonedaInput === 'USD' || metodoPago === 'Zelle' || metodoPago === 'Divisas' || metodoPago === 'Divisas Efectivo'
      ? 'USD'
      : rawMonedaInput === 'VES' || rawMonedaInput === 'BS' || montoBs !== null || Boolean(bankDetails.codigo_banco)
        ? 'VES'
        : null;

  // Tolerancia a lectura parcial: si se extrajo al menos monto, referencia, cuenta o banco/fecha/emisor,
  // marcar legible = true para autocompletar todos los campos encontrados sin bloquear al usuario
  const hasCoreOrPartialData = Boolean(
    (montoBs && montoBs > 0) ||
      nroReferencia ||
      numeroCuenta ||
      (bancoPrincipal && fecha_iso) ||
      titular
  );
  const legible = hasCoreOrPartialData;
  const isCompleteCore = Boolean(montoBs && montoBs > 0 && nroReferencia);

  let confianza = Number(raw.confianza);
  if (!Number.isFinite(confianza) || confianza < 0 || confianza > 1) {
    const rawLevel = cleanNullableString(raw.confianza_lectura ?? raw.nivel_confianza)?.toLowerCase();
    if (rawLevel === 'alta' || rawLevel === 'alto') {
      confianza = 0.96;
    } else if (rawLevel === 'media' || rawLevel === 'medio') {
      confianza = 0.78;
    } else if (rawLevel === 'baja' || rawLevel === 'bajo') {
      confianza = 0.25;
    } else {
      confianza = legible
        ? isCompleteCore && (fecha_pago || bancoPrincipal)
          ? 0.96
          : 0.78
        : 0.2;
    }
  } else {
    confianza = Number(confianza.toFixed(2));
  }

  const confianzaLectura = normalizeConfianzaLectura(
    raw.confianza_lectura ?? raw.nivel_confianza,
    confianza,
    legible,
    isCompleteCore
  );
  const nivelConfianza = toNivelConfianzaSoporte(confianzaLectura, raw.nivel_confianza);

  const tieneEtiquetasVisibles =
    typeof evidenciaSub.tiene_etiquetas_visibles === 'boolean'
      ? evidenciaSub.tiene_etiquetas_visibles
      : typeof raw.tiene_etiquetas_visibles === 'boolean'
        ? raw.tiene_etiquetas_visibles
        : rawLineasCrudas.length > 0
          ? rawLineasCrudas.some((l) =>
              /\b(fecha|referencia|operaci[oó]n|monto|importe|total|banco|beneficiario|remitente|ordenante|cuenta)\b/i.test(l)
            )
          : true;

  const esFotoDePantalla =
    typeof evidenciaSub.es_foto_de_pantalla === 'boolean'
      ? evidenciaSub.es_foto_de_pantalla
      : typeof raw.es_foto_de_pantalla === 'boolean'
        ? raw.es_foto_de_pantalla
        : false;

  const requiereRevisionManual =
    typeof raw.requiere_revision_manual === 'boolean'
      ? raw.requiere_revision_manual
      : !legible || !isCompleteCore || nivelConfianza === 'BAJO';

  const motivoRevision: string | null = requiereRevisionManual
    ? cleanNullableString(raw.motivo_revision) ||
      (!legible
        ? 'No se lograron identificar con claridad el monto o la referencia del comprobante.'
        : !montoBs
          ? 'Monto de la operación no visible o ilegible en el soporte.'
          : !nroReferencia
            ? 'Número de referencia no visible o ilegible en el soporte.'
            : 'Soporte con lectura parcial o sin etiquetas completas; verificar datos antes de conciliar.')
    : cleanNullableString(raw.motivo_revision);

  const observacion =
    rawObservacion ||
    (legible
      ? isCompleteCore
        ? 'Comprobante de operación exitosa leído correctamente.'
        : 'Lectura parcial completada; se autocompletaron los datos detectados en el comprobante.'
      : 'No se lograron identificar con claridad el monto o la referencia del comprobante.');

  const datosExtraidos: DatosExtraidosSoporte = {
    fecha_operacion: fecha_iso,
    fecha_original: fecha_pago,
    numero_referencia: nroReferencia,
    monto_numerico: montoBs,
    monto_texto: exactMontoTexto,
    moneda: monedaDetectada,
    banco_identificado:
      bankDetails.banco_identificado ||
      (bancoPrincipal === 'Mercantil' ? 'Banco Mercantil' : bancoPrincipal),
    codigo_banco: cleanNullableString(datosSub.codigo_banco ?? raw.codigo_banco) ?? bankDetails.codigo_banco,
    plataforma_canal: cleanNullableString(datosSub.plataforma_canal ?? raw.plataforma_canal) ?? bankDetails.plataforma_canal,
    numero_cuenta: numeroCuenta
  };

  const evidenciaVisual: EvidenciaVisualSoporte = {
    tiene_etiquetas_visibles: tieneEtiquetasVisibles,
    es_foto_de_pantalla: esFotoDePantalla,
    lineas_crudas_detectadas: rawLineasCrudas
  };

  return {
    lectura_exitosa: legible,
    nivel_confianza: nivelConfianza,
    requiere_revision_manual: requiereRevisionManual,
    motivo_revision: motivoRevision,
    datos_extraidos: datosExtraidos,
    evidencia_visual: evidenciaVisual,
    legible,
    confianza,
    confianza_lectura: confianzaLectura,
    metodo_pago: metodoPago,
    banco: bancoPrincipal,
    banco_origen: bancoOrigen,
    banco_destino: bancoDestino,
    monto_bs: montoBs,
    monto_texto_original:
      rawMontoTextoInput ||
      (montoBs !== null
        ? `Bs. ${new Intl.NumberFormat('es-VE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }).format(montoBs)}`
        : null),
    referencia: nroReferencia,
    nro_referencia: nroReferencia,
    codigo_autorizacion: codigoAutorizacion,
    fecha_pago,
    fecha_iso,
    titular_remitente: titular,
    rif_ci_titular: rif,
    beneficiario_detectado: beneficiario,
    observacion_auditoria: observacion,
    observacion_ia: observacion
  };
}

/**
 * Devuelve ÚNICAMENTE el objeto JSON puro con la estructura estricta de 6 llaves
 * (`lectura_exitosa`, `nivel_confianza`, `requiere_revision_manual`, `motivo_revision`, `datos_extraidos`, `evidencia_visual`).
 */
export function toCanonicalVenezuelanReceiptJson(rawInput: any): CanonicalVenezuelanReceiptResult {
  const audited = auditAndNormalizeReceiptPayload(rawInput);
  return {
    lectura_exitosa: Boolean(audited.lectura_exitosa),
    nivel_confianza: audited.nivel_confianza || 'BAJO',
    requiere_revision_manual: Boolean(audited.requiere_revision_manual),
    motivo_revision: audited.motivo_revision ?? null,
    datos_extraidos: audited.datos_extraidos!,
    evidencia_visual: audited.evidencia_visual!
  };
}

/**
 * Motor heurístico determinista sobre texto plano (extraído de PDF digital vía pdf-parse
 * o de imagen vía Tesseract OCR) para comprobantes bancarios venezolanos, incluyendo
 * tablas recortadas sin etiquetas en la columna izquierda (ej. Provinet / fotos a monitor).
 */
export function parseVenezuelanReceiptText(rawText: string): AuditedReceiptResult {
  const text = String(rawText || '').replace(/\r/g, '\n');
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);

  const fullText = lines.join('\n');

  // 0. Detectar cuenta bancaria de 20 dígitos o enmascarada con asteriscos (ej. 0108*****40*****7396) y evidencia de etiquetas
  let numeroCuentaDetectada: string | null = null;
  for (const line of lines) {
    const acc = extractNumeroCuentaVenezolana(line);
    if (acc) {
      numeroCuentaDetectada = acc;
      break;
    }
  }

  const tieneEtiquetasVisibles = lines.some((l) =>
    /\b(fecha|referencia|operaci[oó]n|monto|importe|total|banco|beneficiario|remitente|ordenante|cuenta)\b/i.test(l)
  );

  // 1. Detectar bancos (Origen, Destino, Marca general o primeros 4 dígitos SUDEBAN de cuenta enmascarada)
  let bancoOrigen: string | null = null;
  let bancoDestino: string | null = null;
  let bancoGeneral: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';

    if (/(banco\s*(de\s*)?origen|banco\s*emisor|desde\s*banco|cuenta\s*origen)/i.test(line)) {
      const rest = line.replace(
        /^.*?(?:banco\s*(?:de\s*)?origen|banco\s*emisor|desde\s*banco|cuenta\s*origen)\s*[:.-]?\s*/i,
        ''
      );
      bancoOrigen =
        matchCatalogVenezuelanBank(rest) ||
        matchCatalogVenezuelanBank(nextLine) ||
        bancoOrigen;
    } else if (/(banco\s*(de\s*)?destino|banco\s*receptor|banco\s*beneficiario|hacia\s*banco)/i.test(line)) {
      const rest = line.replace(
        /^.*?(?:banco\s*(?:de\s*)?destino|banco\s*receptor|banco\s*beneficiario|hacia\s*banco)\s*[:.-]?\s*/i,
        ''
      );
      bancoDestino =
        matchCatalogVenezuelanBank(rest) ||
        matchCatalogVenezuelanBank(nextLine) ||
        bancoDestino;
    } else if (/^banco\s*[:.-]?$/i.test(line) && nextLine) {
      const b = matchCatalogVenezuelanBank(nextLine);
      if (b && !bancoDestino) bancoDestino = b;
    }

    if (!bancoGeneral) {
      const matched = matchCatalogVenezuelanBank(line);
      if (matched) {
        bancoGeneral = matched;
      }
    }
  }

  // Si un recibo tipo Banesco Pago Móvil muestra su encabezado Banesco y solo una etiqueta "Banco: Banesco"
  if (!bancoDestino && bancoGeneral && !bancoOrigen) {
    bancoDestino = bancoGeneral;
  }
  const banco = bancoOrigen || bancoGeneral || bancoDestino || null;

  // 2. Extraer Monto Principal en Bolívares (ignorando líneas de comisión, beneficiario, cuenta debitada, teléfonos o RIF)
  let montoBs: number | null = null;
  let montoTextoOriginal: string | null = null;
  let montoTextoExacto: string | null = null;
  let montoLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/comisi[oó]n|iva\b|beneficiario|cuenta\s+debitada|tel[eé]fono|celular|c[eé]dula|rif\b/i.test(line)) {
      continue;
    }

    // Buscar patrones con símbolo Bs / Bolívares / VES
    const bsMatch = line.match(
      /(?:Bs\.?\s*S?\.?|Bol[ií]vares)\s*[-:]?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2})/i
    );
    if (bsMatch) {
      const candidate = parseVenezuelanMonto(bsMatch[1]);
      if (candidate && (!montoBs || candidate > montoBs)) {
        montoBs = candidate;
        montoTextoOriginal = bsMatch[0].trim();
        montoTextoExacto = bsMatch[1].trim();
        montoLineIndex = i;
      }
      continue;
    }

    const trailingBsMatch = line.match(
      /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s*(?:Bs\.?\s*S?\.?|VES)\b/i
    );
    if (trailingBsMatch) {
      const candidate = parseVenezuelanMonto(trailingBsMatch[1]);
      if (candidate && (!montoBs || candidate > montoBs)) {
        montoBs = candidate;
        montoTextoOriginal = trailingBsMatch[0].trim();
        montoTextoExacto = trailingBsMatch[1].trim();
        montoLineIndex = i;
      }
      continue;
    }

    if (/^(monto|monto\s+pagado|importe|monto\s+de\s+la\s+operaci[oó]n|total)\b/i.test(line)) {
      const sameLine = parseVenezuelanMonto(line);
      const nextVal =
        lines[i + 1] && !/comisi[oó]n|beneficiario|cuenta\s+debitada/i.test(lines[i + 1])
          ? parseVenezuelanMonto(lines[i + 1])
          : null;
      const picked = sameLine || nextVal;
      if (picked && (!montoBs || picked > montoBs)) {
        montoBs = picked;
        montoTextoOriginal = sameLine ? line : lines[i + 1];
        montoTextoExacto = extractMontoTextoExacto(montoTextoOriginal);
        montoLineIndex = sameLine ? i : i + 1;
      }
    }
  }

  // Inferencia por patrón (Regla morfológica para soportes recortados sin etiquetas como Provinet):
  // Si no apareció "Bs." ni "Monto", detectar cifra en formato moneda venezolana con coma y exactamente 2 decimales (ej. "576.599,07")
  if (montoBs === null) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/comisi[oó]n|iva\b|tasa\b/i.test(line)) continue;
      const standaloneMoneyMatch = line.match(/\b(\d{1,3}(?:\.\d{3})+,\d{2}|\d{2,10},\d{2})\b/);
      if (standaloneMoneyMatch) {
        const candidate = parseVenezuelanMonto(standaloneMoneyMatch[1]);
        if (candidate && (!montoBs || candidate > montoBs)) {
          montoBs = candidate;
          montoTextoOriginal = standaloneMoneyMatch[1];
          montoTextoExacto = standaloneMoneyMatch[1];
          montoLineIndex = i;
        }
      }
    }
  }

  // 3. Extraer Fecha Impresa (antes de inferir referencia por posición para conocer la fila de la fecha)
  let fechaPago: string | null = null;
  let fechaIso: string | null = null;
  let fechaLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const parsedDates = normalizeReceiptDates(lines[i]);
    if (parsedDates.fecha_pago && parsedDates.fecha_iso) {
      fechaPago = parsedDates.fecha_pago;
      fechaIso = parsedDates.fecha_iso;
      fechaLineIndex = i;
      break;
    }
  }

  // 4. Extraer Número de Referencia y Código de Autorización (sin confundir ambos ni con cuentas enmascaradas)
  let nroReferencia: string | null = null;
  let codigoAutorizacion: string | null = null;
  const authCodeLabelRegex = /c[oó]digo\s*(?:de\s*)?autorizaci[oó]n/i;
  const refLabelRegex =
    /(n[uú]mero\s+de\s+referencia|nro\.?\s*(?:de\s*)?referencia|referencia|nro\.?\s*(?:de\s*)?operaci[oó]n|n[uú]mero\s+de\s+operaci[oó]n|operaci[oó]n|secuencia|comprobante|c[oó]digo\s+de\s+operaci[oó]n|recibo|folio|control|id\s*(?:de\s*)?transacci[oó]n|aprobaci[oó]n)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (authCodeLabelRegex.test(line)) {
      const afterAuth = line.replace(authCodeLabelRegex, '').replace(/^[\s:.-]+/, '');
      const sameLineAuth = normalizeReferenciaBancaria(afterAuth);
      if (sameLineAuth) {
        codigoAutorizacion = sameLineAuth;
      } else if (lines[i + 1]) {
        const nextLineAuth = normalizeReferenciaBancaria(lines[i + 1]);
        if (nextLineAuth) {
          codigoAutorizacion = nextLineAuth;
        }
      }
      continue;
    }

    if (!nroReferencia && refLabelRegex.test(line)) {
      const afterLabel = line.replace(refLabelRegex, '').replace(/^[\s:.-]+/, '');
      const sameLineDigits = normalizeReferenciaBancaria(afterLabel);
      if (sameLineDigits) {
        nroReferencia = sameLineDigits;
        continue;
      }
      if (lines[i + 1] && !authCodeLabelRegex.test(lines[i + 1])) {
        const nextLineDigits = normalizeReferenciaBancaria(lines[i + 1]);
        if (nextLineDigits) {
          nroReferencia = nextLineDigits;
          continue;
        }
      }
      if (lines[i + 2] && lines[i + 1] && lines[i + 1].length <= 4) {
        const twoLinesDownDigits = normalizeReferenciaBancaria(lines[i + 2]);
        if (twoLinesDownDigits) {
          nroReferencia = twoLinesDownDigits;
          continue;
        }
      }
    }
  }

  // Inferencia por patrón y posición (Regla morfológica para tablas recortadas sin etiquetas como Provinet):
  // Buscar secuencia numérica pura de 6 a 15 dígitos (conservando ceros a la izquierda como "000019111"),
  // sin separadores de miles (.), sin decimales (,) ni asteriscos (*).
  if (!nroReferencia) {
    const candidateRefs: { ref: string; distance: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === fechaLineIndex || i === montoLineIndex) continue;
      if (/[*•,/.]/.test(line)) continue;
      const pureSeqMatch = line.match(/^(?:#|nro\.?\s*)?(\d{6,15})$/i);
      if (pureSeqMatch) {
        const normalized = normalizeReferenciaBancaria(pureSeqMatch[1]);
        if (normalized && normalized.length >= 6 && normalized.length <= 15) {
          const distFecha = fechaLineIndex >= 0 ? Math.abs(i - fechaLineIndex) : 99;
          const distMonto = montoLineIndex >= 0 ? Math.abs(i - montoLineIndex) : 99;
          candidateRefs.push({
            ref: normalized,
            distance: Math.min(distFecha, distMonto)
          });
        }
      }
    }
    if (candidateRefs.length > 0) {
      candidateRefs.sort((a, b) => a.distance - b.distance);
      nroReferencia = candidateRefs[0].ref;
    }
  }

  // 5. Distinguir Emisor vs. Beneficiario
  let beneficiarioDetectado: string | null = null;
  let titularRemitente: string | null = null;
  let rifCiTitular: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';

    if (isBeneficiaryName(line) && !beneficiarioDetectado) {
      beneficiarioDetectado = line
        .replace(/^(beneficiario|destinatario|nombre|raz[oó]n\s+social|comercio)\s*[:.-]?\s*/i, '')
        .trim();
    }

    if (/^(beneficiario|destinatario|a\s+favor\s+de|comercio|receptor)\b/i.test(line)) {
      const val =
        line.replace(/^(beneficiario|destinatario|a\s+favor\s+de|comercio|receptor)\s*[:.-]?\s*/i, '').trim() ||
        nextLine;
      if (val && !beneficiarioDetectado) {
        beneficiarioDetectado = val;
      }
      continue;
    }

    if (/^(ordenante|remitente|emisor|pagador|titular\s+origen|nombre\s+origen|cliente\s+origen)\b/i.test(line)) {
      const val =
        line
          .replace(/^(ordenante|remitente|emisor|pagador|titular\s+origen|nombre\s+origen|cliente\s+origen)\s*[:.-]?\s*/i, '')
          .trim() || nextLine;
      if (val && !isBeneficiaryName(val)) {
        titularRemitente = val;
      }
    }

    if (
      /(rif|c[eé]dula|c\.?i\.?|documento|identificaci[oó]n)\s*(del\s*)?(ordenante|remitente|emisor|origen|pagador)/i.test(
        line
      )
    ) {
      const candidateRif = normalizeRifCiTitular(line) || normalizeRifCiTitular(nextLine);
      if (candidateRif) {
        rifCiTitular = candidateRif;
      }
    }
  }

  const metodoPago = normalizeMetodoPago('', fullText);
  const resolvedRef = nroReferencia ?? codigoAutorizacion ?? null;

  return auditAndNormalizeReceiptPayload({
    legible: Boolean((montoBs && montoBs > 0) || resolvedRef || numeroCuentaDetectada),
    confianza: montoBs && resolvedRef ? 0.9 : 0.65,
    confianza_lectura: montoBs && resolvedRef ? 'alta' : 'media',
    metodo_pago: metodoPago,
    banco,
    banco_origen: bancoOrigen,
    banco_destino: bancoDestino,
    monto_bs: montoBs,
    monto_texto: montoTextoExacto,
    monto_texto_original: montoTextoOriginal,
    referencia: resolvedRef,
    nro_referencia: resolvedRef,
    codigo_autorizacion: codigoAutorizacion,
    fecha_pago: fechaPago,
    fecha_iso: fechaIso,
    numero_cuenta: numeroCuentaDetectada,
    titular_remitente: titularRemitente,
    rif_ci_titular: rifCiTitular,
    beneficiario_detectado: beneficiarioDetectado,
    evidencia_visual: {
      tiene_etiquetas_visibles: tieneEtiquetasVisibles,
      es_foto_de_pantalla: false,
      lineas_crudas_detectadas: lines
    },
    observacion_auditoria:
      montoBs && resolvedRef
        ? 'Comprobante de operación exitosa leído correctamente.'
        : 'Lectura parcial del comprobante; verifique los campos antes de consolidar.'
  });
}

export const VENEZUELAN_RECEIPT_MODEL_CASCADE = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite'
] as const;

/**
 * 2. SERVICIO DE EXTRACCIÓN CON GEMINI API (DETERMINISTA Y ESTRUCTURADO): `extractSupportWithGemini`
 * - Configura `temperature: 0.0` y `topP: 0.1` para eliminar cualquier creatividad o invención de datos.
 * - Fuerza `responseMimeType: "application/json"` y define `responseSchema: VENEZUELAN_RECEIPT_RESPONSE_SCHEMA`
 *   para que el modelo NUNCA devuelva bloques markdown ni rompa el `JSON.parse()`.
 * - Incluye bloque `try / catch` detallado que captura errores de red, cuota o imágenes ilegibles
 *   sin romper la interfaz de usuario, y aplica doble verificación numérica con `parseMontoVenezolano`.
 */
export async function extractSupportWithGemini(options: {
  apiKeys: string[];
  base64Data: string;
  mimeType: string;
  fileName?: string;
}): Promise<{
  audited: AuditedReceiptResult | null;
  usedModel: string | null;
  errorType: 'NONE' | 'NO_API_KEY' | 'QUOTA_EXCEEDED' | 'NETWORK_ERROR' | 'UNREADABLE_IMAGE';
  errorMessage: string | null;
}> {
  const { apiKeys, base64Data, mimeType, fileName } = options;
  const cleanB64 = (base64Data.includes(',') ? base64Data.split(',')[1] : base64Data).replace(/\s+/g, '');
  const resolvedMime = detectReceiptMimeType(cleanB64, mimeType, fileName);

  if (!apiKeys || apiKeys.length === 0) {
    return {
      audited: null,
      usedModel: null,
      errorType: 'NO_API_KEY',
      errorMessage: 'No hay claves GEMINI_API_KEY configuradas para lectura multimodal.'
    };
  }

  const userInstruction =
    'Analiza minuciosamente este soporte o comprobante de pago venezolano (incluyendo soportes recortados sin etiquetas o fotos a pantallas de monitores). Extrae únicamente datos legibles aplicando las reglas anti-alucinación y devuelve el JSON estructurado.';

  let lastErrorMsg = '';
  let sawQuota = false;
  let sawNetwork = false;
  let partialAudited: AuditedReceiptResult | null = null;

  for (const apiKey of apiKeys) {
    const ai = new GoogleGenAI({ apiKey });

    for (const modelName of VENEZUELAN_RECEIPT_MODEL_CASCADE) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { mimeType: resolvedMime, data: cleanB64 } },
                  { text: userInstruction }
                ]
              }
            ],
            config: {
              systemInstruction: VENEZUELAN_BANKING_AUDIT_SYSTEM_PROMPT,
              responseMimeType: 'application/json',
              responseSchema: VENEZUELAN_RECEIPT_RESPONSE_SCHEMA,
              temperature: 0.0,
              topP: 0.1
            }
          });

          const rawText = String(response?.text || '').trim();
          if (rawText) {
            const parsedJson = safeExtractReceiptJson(rawText);
            const audited = auditAndNormalizeReceiptPayload(parsedJson);
            if (audited.legible || audited.lectura_exitosa) {
              return {
                audited,
                usedModel: modelName,
                errorType: 'NONE',
                errorMessage: null
              };
            }
            partialAudited = audited;
          }
          break;
        } catch (err: any) {
          const msg = String(err?.message || err || '');
          lastErrorMsg = msg;
          if (/RESOURCE_EXHAUSTED|quota|429|billing|prepayment/i.test(msg)) {
            sawQuota = true;
          }
          if (/fetch|network|timeout|ECONNRESET|503|502|504/i.test(msg)) {
            sawNetwork = true;
          }
          if (/API_KEY_INVALID|API key not valid|reported as leaked|PERMISSION_DENIED/i.test(msg)) {
            break;
          }
          if (attempt === 0 && /503|502|504|overloaded|UNAVAILABLE|fetch|network/i.test(msg)) {
            await new Promise((r) => setTimeout(r, 350));
            continue;
          }
          break;
        }
      }
    }
  }

  return {
    audited: partialAudited,
    usedModel: null,
    errorType: sawQuota ? 'QUOTA_EXCEEDED' : sawNetwork ? 'NETWORK_ERROR' : 'UNREADABLE_IMAGE',
    errorMessage: lastErrorMsg || 'No se lograron identificar con claridad los datos del soporte.'
  };
}
