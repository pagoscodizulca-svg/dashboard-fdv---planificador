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

export type MetodoPagoSoportado =
  | 'Pago Móvil'
  | 'Transferencia'
  | 'Zelle'
  | 'Divisas Efectivo'
  | 'Biopago'
  | 'Efectivo'
  | 'Divisas';

export type ConfianzaLectura = 'alta' | 'media' | 'baja';

export const MAX_COHERENT_MONTO_BS = 5_000_000_000;

export interface AuditedReceiptResult {
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

export const VENEZUELAN_BANKING_AUDIT_SYSTEM_PROMPT = `Actúa como un Auditor Financiero y Especialista en OCR Bancario de Venezuela.
Tu única tarea es extraer con precisión quirúrgica los datos de comprobantes de pago (Pago Móvil, Transferencias, Zelle, Depósitos) enviados por clientes a través de WhatsApp.

REGLAS ESTRICTAS DE EXTRACCIÓN VISUAL (ANTI-ALUCINACIÓN):

1. MONTO DEL PAGO (monto_bs):
   - Localiza exclusivamente la etiqueta "Monto", "Monto pagado" o "Total" (si la comisión es Bs. 0,00, "Monto" y "Total" son iguales; toma el valor principal de la operación, NUNCA sumes ambos ni concatenes otros números).
   - PROHIBIDO extraer o mezclar dígitos provenientes de "Beneficiario", números de teléfono (ej. 0412, 0414, 0424, 0416, 0426), Cédula/RIF (V-, J-, E-) o número de cuenta ("Cuenta debitada").
   - En Venezuela el formato visual suele ser punto (.) para miles y coma (,) para decimales (ej. "Bs. 22.000,00").
   - Devuelve SIEMPRE un número flotante estándar en el JSON usando punto (.) SOLO para los dos decimales y SIN separadores de miles (ejemplo: si ves "Bs. 22.000,00", devuelve exactamente 22000.00).

2. NÚMERO DE REFERENCIA (referencia):
   - Extrae únicamente los dígitos numéricos que están debajo o al lado de "Referencia", "Nro. de Referencia", "Operación" o "Recibo".
   - ¡ALERTA CRÍTICA EN BANCOS (ESPECIALMENTE BNC, MERCANTIL Y BANESCO)!: Al final del número de referencia suele aparecer un ÍCONO GRÁFICO (dos hojas de copiar, ícono de compartir o lupa). NUNCA interpretes ese ícono como el número cero ("0"), la letra "O" ni el número "8".
   - Ejemplo BNC: Si ves "947474757 [ícono]", el valor correcto es "947474757" (9 dígitos), NO "9474747570".
   - No confundas "Referencia" con "Código autorización" (en BNC aparece más abajo un código corto de 6 dígitos como "236792"; ignóralo a menos que no exista referencia principal).

3. BANCO (banco):
   - Identifica el banco emisor o del comprobante por su logo, colores o códigos bancarios de 4 dígitos (ej. 0191 = "BNC (Banco Nacional de Crédito)", 0134 = "Banesco", 0105 = "Mercantil", 0102 = "Banco de Venezuela", 0108 = "Provincial").

4. MÉTODO DE PAGO (metodo_pago):
   - Clasifica estrictamente en una de las opciones válidas del formulario: "Pago Móvil", "Transferencia", "Zelle", "Divisas Efectivo" o "Biopago". Si el texto dice "Su pago móvil ha sido Ejecutado exitosamente", asigna "Pago Móvil".

5. FECHA DE PAGO (fecha_pago):
   - Busca la fecha explícita en el comprobante y formatéala como "DD/MM/YYYY".
   - Si el comprobante (como ocurre en capturas de Pago Móvil del BNC) NO muestra la fecha en el cuerpo del recibo, devuelve null en este campo para que el sistema asigne la fecha del archivo o del día actual por defecto.

6. VALIDACIÓN DE COHERENCIA:
   - Si el monto extraído supera los 5.000.000.000,00 Bs. o tiene más de 10 dígitos enteros, es un error de lectura. Re-inspecciona la etiqueta "Monto" antes de responder.

FORMATO DE SALIDA (JSON ESTRICTO SIN TEXTO ADICIONAL NI BLOQUES MARKDOWN):
{
  "metodo_pago": "Pago Móvil",
  "banco": "BNC (Banco Nacional de Crédito)",
  "monto_bs": 22000.00,
  "referencia": "947474757",
  "codigo_autorizacion": "236792",
  "fecha_pago": null,
  "confianza_lectura": "alta",
  "observacion_auditoria": "Comprobante BNC Pago Móvil por Bs. 22.000,00. Ícono de copiado ignorado en referencia."
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
 * Regla 1 y Regla 6: Convierte montos impresos en formato venezolano ("Bs. 203.242,47", "22.000,00 Bs")
 * o estándar a número flotante con 2 decimales (ej. 22000.00) sin separadores de miles.
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
    if (bank.patterns.some((rx) => rx.test(clean))) {
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
 * Regla 3: Normaliza el nombre del banco venezolano según catálogo oficial y códigos SUDEBAN.
 */
export function normalizeVenezuelanBank(val: unknown): string | null {
  const clean = cleanNullableString(val);
  if (!clean) return null;

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
  if (clean === 'alta' || clean === 'media' || clean === 'baja') {
    return clean;
  }
  if (!legible || numericConfianza < 0.5) return 'baja';
  if (isCompleteCore && numericConfianza >= 0.85) return 'alta';
  return 'media';
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
 */
export function auditAndNormalizeReceiptPayload(rawInput: any): AuditedReceiptResult {
  const raw = rawInput && typeof rawInput === 'object' ? rawInput : {};

  let beneficiario = cleanNullableString(
    raw.beneficiario_detectado ?? raw.beneficiario ?? raw.destinatario
  );
  let titular = cleanNullableString(
    raw.titular_remitente ?? raw.titular ?? raw.remitente ?? raw.ordenante ?? raw.emisor
  );
  let rif = normalizeRifCiTitular(
    raw.rif_ci_titular ?? raw.rif ?? raw.cedula ?? raw.documento_emisor
  );

  // Cortafuegos Emisor vs. Beneficiario
  if (titular && isBeneficiaryName(titular)) {
    if (!beneficiario) {
      beneficiario = titular;
    }
    titular = null;
    // Si el titular colocado por error era el beneficiario, descartar también su RIF si coincide o si es J- corporativo sin emisor
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
  const montoTextoOriginal = cleanNullableString(raw.monto_texto_original);
  const rawMontoInput = raw.monto_bs ?? raw.monto;
  const montoBs =
    parseVenezuelanMonto(rawMontoInput) ??
    parseVenezuelanMonto(montoTextoOriginal);

  // REGLA 2: Número de Referencia (solo dígitos, sin ícono de copiado, separado de Código autorización)
  const codigoAutorizacion = normalizeReferenciaBancaria(
    raw.codigo_autorizacion ?? raw.codigoAutorizacion
  );
  const primaryReferencia = normalizeReferenciaBancaria(
    raw.referencia ?? raw.nro_referencia ?? raw.numero_referencia
  );
  const nroReferencia = primaryReferencia ?? codigoAutorizacion ?? null;

  // REGLA 3: Bancos normalizados
  const bancoOrigen = normalizeVenezuelanBank(raw.banco_origen);
  const bancoDestino = normalizeVenezuelanBank(raw.banco_destino);
  const bancoPrincipal =
    normalizeVenezuelanBank(raw.banco) || bancoOrigen || bancoDestino || null;

  // REGLA 4: Método de Pago
  const rawObservacion = cleanNullableString(
    raw.observacion_auditoria ?? raw.observacion_ia
  );
  const metodoPago = normalizeMetodoPago(
    raw.metodo_pago,
    `${bancoPrincipal || ''} ${montoTextoOriginal || ''} ${rawObservacion || ''}`
  );

  // REGLA 5: Fechas DD/MM/YYYY y YYYY-MM-DD (null si no aparece en el cuerpo del recibo)
  const { fecha_pago, fecha_iso } = normalizeReceiptDates(
    raw.fecha_pago,
    raw.fecha_iso
  );

  // Tolerancia a lectura parcial: si se extrajo al menos monto, referencia o banco/fecha/emisor,
  // marcar legible = true para autocompletar todos los campos encontrados sin bloquear al usuario
  const hasCoreOrPartialData = Boolean(
    (montoBs && montoBs > 0) ||
      nroReferencia ||
      (bancoPrincipal && fecha_iso) ||
      titular
  );
  const legible = hasCoreOrPartialData;
  const isCompleteCore = Boolean(montoBs && montoBs > 0 && nroReferencia);

  let confianza = Number(raw.confianza);
  if (!Number.isFinite(confianza) || confianza < 0 || confianza > 1) {
    const rawLevel = cleanNullableString(raw.confianza_lectura)?.toLowerCase();
    if (rawLevel === 'alta') {
      confianza = 0.96;
    } else if (rawLevel === 'media') {
      confianza = 0.78;
    } else if (rawLevel === 'baja') {
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
    raw.confianza_lectura,
    confianza,
    legible,
    isCompleteCore
  );

  const observacion =
    rawObservacion ||
    (legible
      ? isCompleteCore
        ? 'Comprobante de operación exitosa leído correctamente.'
        : 'Lectura parcial completada; se autocompletaron los datos detectados en el comprobante.'
      : 'No se lograron identificar con claridad el monto o la referencia del comprobante.');

  return {
    legible,
    confianza,
    confianza_lectura: confianzaLectura,
    metodo_pago: metodoPago,
    banco: bancoPrincipal,
    banco_origen: bancoOrigen,
    banco_destino: bancoDestino,
    monto_bs: montoBs,
    monto_texto_original:
      montoTextoOriginal ||
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
 * Motor heurístico determinista sobre texto plano (extraído de PDF digital vía pdf-parse
 * o de imagen vía Tesseract OCR) para comprobantes bancarios venezolanos.
 */
export function parseVenezuelanReceiptText(rawText: string): AuditedReceiptResult {
  const text = String(rawText || '').replace(/\r/g, '\n');
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);

  const fullText = lines.join('\n');

  // 1. Detectar bancos (Origen, Destino y Marca general del comprobante)
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
      for (const bank of VENEZUELAN_BANKS) {
        if (bank.patterns.some((rx) => rx.test(line))) {
          bancoGeneral = bank.canonical;
          break;
        }
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
      }
    }
  }

  // 3. Extraer Número de Referencia y Código de Autorización (sin confundir ambos)
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

  // 4. Extraer Fecha Impresa
  let fechaPago: string | null = null;
  let fechaIso: string | null = null;
  for (const line of lines) {
    const parsedDates = normalizeReceiptDates(line);
    if (parsedDates.fecha_pago && parsedDates.fecha_iso) {
      fechaPago = parsedDates.fecha_pago;
      fechaIso = parsedDates.fecha_iso;
      break;
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
    legible: Boolean((montoBs && montoBs > 0) || resolvedRef),
    confianza: montoBs && resolvedRef ? 0.9 : 0.65,
    confianza_lectura: montoBs && resolvedRef ? 'alta' : 'media',
    metodo_pago: metodoPago,
    banco,
    banco_origen: bancoOrigen,
    banco_destino: bancoDestino,
    monto_bs: montoBs,
    monto_texto_original: montoTextoOriginal,
    referencia: resolvedRef,
    nro_referencia: resolvedRef,
    codigo_autorizacion: codigoAutorizacion,
    fecha_pago: fechaPago,
    fecha_iso: fechaIso,
    titular_remitente: titularRemitente,
    rif_ci_titular: rifCiTitular,
    beneficiario_detectado: beneficiarioDetectado,
    observacion_auditoria:
      montoBs && resolvedRef
        ? 'Comprobante de operación exitosa leído correctamente.'
        : 'Lectura parcial del comprobante; verifique los campos antes de consolidar.'
  });
}
