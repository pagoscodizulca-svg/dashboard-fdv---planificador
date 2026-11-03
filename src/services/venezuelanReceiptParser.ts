/**
 * Motor de Normalización Bancaria Venezolana (venezuelanReceiptParser.ts)
 *
 * Funciones puras y deterministas para extraer, limpiar y normalizar datos de comprobantes
 * de pago venezolanos (Pago Móvil, Transferencias, Provinet, Banesco, BDV, Mercantil, BNC, etc.),
 * incluyendo recortes de columnas sin etiquetas y fotos a monitores con efecto moiré.
 */

export interface ExtractedReceiptData {
  fecha: string;          // Formato YYYY-MM-DD para inputs date o DD/MM/YYYY según use el form
  fechaDisplay: string;   // Formato DD/MM/YYYY (ej. "23/10/2026")
  referencia: string;     // Ej. "000012723"
  montoNumerico: number;  // Ej. 48742.49
  montoFormateado: string;// Ej. "48.742,49"
  banco: string;          // Ej. "BBVA Provincial"
  metodoPago: 'Pago Móvil' | 'Transferencia' | 'Depósito' | 'Zelle' | 'Efectivo';
  cuentaEnmascarada?: string;
  confianza: 'alta' | 'media' | 'baja';
  fechaExplicita?: boolean;
  canal?: string;
  titular?: string;
  rif?: string;
}

export const BANCOS_SUDEBAN: Record<string, string> = {
  '0102': 'Banco de Venezuela',
  '0104': 'Banco Venezolano de Crédito',
  '0105': 'Banco Mercantil',
  '0108': 'BBVA Provincial',
  '0114': 'Bancaribe',
  '0115': 'Banco Exterior',
  '0128': 'Banco Caroní',
  '0134': 'Banesco',
  '0137': 'Banco Sofitasa',
  '0138': 'Banco Plaza',
  '0151': 'BFC Banco Fondo Común',
  '0156': '100% Banco',
  '0157': 'DelSur',
  '0163': 'Banco del Tesoro',
  '0166': 'Banco Agrícola de Venezuela',
  '0168': 'Bancrecer',
  '0169': 'R4 Banco Microfinanciero',
  '0171': 'Banco Activo',
  '0172': 'Bancamiga',
  '0174': 'Banplus',
  '0175': 'Banco Bicentenario',
  '0177': 'BANFANB',
  '0191': 'BNC (Banco Nacional de Crédito)',
};

const MAX_VALID_MONTO_BS = 5_000_000_000;

/**
 * Convierte cualquier representación de monto venezolano o internacional a número flotante exacto.
 * Soporta:
 * - "48.742,49" -> 48742.49
 * - "Bs. 48.742,49" -> 48742.49
 * - "48,742.49" -> 48742.49
 * - "48 742 49" o "576 599.07" (separadores espaciados por OCR en monitores con moiré) -> 48742.49 / 576599.07
 * - "48.742.49" (coma decimal leída como punto por OCR) -> 48742.49
 */
export function parseMontoVenezolano(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 && raw <= MAX_VALID_MONTO_BS ? Number(raw.toFixed(2)) : 0;
  }
  if (!raw || typeof raw !== 'string') return 0;

  let text = raw.trim();
  if (!text) return 0;

  // Descartar cadenas que claramente son RIF/CI, teléfonos celulares o cuentas de 20 dígitos sin símbolo de moneda
  const hasCurrencyWord = /\b(?:bs\.?|bol[ií]vares|ves|veb|monto|total)\b/i.test(text);
  if (!hasCurrencyWord) {
    if (/^[VJEG]\s*[-.]?\s*\d{5,10}$/i.test(text)) return 0;
    const digitsOnly = text.replace(/\D/g, '');
    if (
      /^04(12|14|16|24|26)\d{7}$/.test(digitsOnly) ||
      /^584(12|14|16|24|26)\d{7}$/.test(digitsOnly) ||
      (digitsOnly.length === 20 && digitsOnly.startsWith('01'))
    ) {
      return 0;
    }
  }

  // Normalizar montos donde el OCR separó miles/decimales con espacios (ej. "48 742 49" o "576 599.07")
  text = text
    .replace(/\b(?:bol[ií]vares|bs\.?\s*s?\.?|ves|veb)\b/gi, ' ')
    .replace(/\$/g, ' ')
    .replace(/(\d)\s*([.,])\s*(\d)/g, '$1$2$3')
    .replace(/\b(\d{1,3}(?:[\s.]\d{3})+)\s+(\d{2})\b/g, (_m, intPart, decPart) => {
      return `${String(intPart).replace(/\s+/g, '.')},${decPart}`;
    })
    .replace(/\b(\d{1,3})\s+(\d{3})([.,]\d{2})\b/g, '$1.$2$3')
    .trim();

  // Aislar el primer token numérico monetario si hay texto adicional alrededor
  const tokenMatch = text.match(
    /(-?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|-?\d+(?:[.,]\d{1,2})?)/
  );
  const candidate = tokenMatch ? tokenMatch[1] : text;

  // Limpiar texto dejando solo dígitos, puntos, comas y signo menos
  const cleaned = candidate.replace(/[^\d.,-]/g, '').trim();
  if (!cleaned) return 0;

  let result = 0;

  // Caso 1: Tiene punto(s) y coma (ej. "48.742,49" o "48,742.49")
  if (cleaned.includes('.') && cleaned.includes(',')) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Formato Venezolano: "48.742,49" -> "48742.49"
      result = parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      // Formato US: "48,742.49" -> "48742.49"
      result = parseFloat(cleaned.replace(/,/g, '')) || 0;
    }
  } else if (cleaned.includes(',')) {
    // Caso 2: Solo tiene coma (ej. "48742,49" o "48,742")
    const parts = cleaned.split(',');
    if (parts.length > 2 && parts[parts.length - 1].length <= 2) {
      const dec = parts.pop()!;
      result = parseFloat(`${parts.join('')}.${dec}`) || 0;
    } else if (/,\d{1,2}$/.test(cleaned)) {
      result = parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      result = parseFloat(cleaned.replace(/,/g, '')) || 0;
    }
  } else if (cleaned.includes('.')) {
    // Caso 3: Solo tiene punto (ej. "48742.49", "48.742.49" o "48.742")
    const parts = cleaned.split('.');
    if (parts.length > 2 && parts[parts.length - 1].length <= 2) {
      const dec = parts.pop()!;
      result = parseFloat(`${parts.join('')}.${dec}`) || 0;
    } else if (parts.length === 2 && /\.\d{1,2}$/.test(cleaned)) {
      result = parseFloat(cleaned) || 0;
    } else {
      result = parseFloat(cleaned.replace(/\./g, '')) || 0;
    }
  } else {
    result = parseFloat(cleaned) || 0;
  }

  if (!Number.isFinite(result) || result <= 0 || result > MAX_VALID_MONTO_BS) {
    return 0;
  }

  return Number(result.toFixed(2));
}

export function formatMontoVenezolano(monto: number): string {
  if (!Number.isFinite(monto) || monto <= 0) return '0,00';
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto);
}

/**
 * Infiere el nombre oficial del banco venezolano a partir de candidato directo,
 * cuenta bancaria (completa o enmascarada como "0108*****40*****7396") o texto completo del comprobante.
 */
export function inferirBancoVenezolano(
  bancoCandidato?: string | null,
  cuentaCandidata?: string | null,
  textoCompleto?: string | null
): string {
  const rawString = `${bancoCandidato || ''} ${cuentaCandidata || ''} ${textoCompleto || ''}`;
  const combined = rawString
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // 1. Por palabras clave de plataformas bancarias venezolanas (incluye variantes OCR de moiré como "provmet")
  if (
    combined.includes('provinet') ||
    combined.includes('provmet') ||
    combined.includes('provlnet') ||
    combined.includes('provinel') ||
    combined.includes('provincial') ||
    combined.includes('bbva') ||
    combined.includes('dinero rapido')
  ) {
    return 'BBVA Provincial';
  }
  if (combined.includes('banesco')) return 'Banesco';
  if (
    combined.includes('bdv') ||
    combined.includes('venezuela') ||
    combined.includes('bdvenlinea') ||
    combined.includes('pagomovilbdv')
  ) {
    return 'Banco de Venezuela';
  }
  if (combined.includes('mercantil') || combined.includes('tpago')) {
    return 'Banco Mercantil';
  }
  if (combined.includes('bancamiga')) return 'Bancamiga';
  if (combined.includes('bnc') || combined.includes('nacional de credito')) {
    return 'BNC (Banco Nacional de Crédito)';
  }
  if (combined.includes('bancaribe')) return 'Bancaribe';
  if (combined.includes('banplus')) return 'Banplus';
  if (combined.includes('tesoro')) return 'Banco del Tesoro';
  if (combined.includes('bicentenario')) return 'Banco Bicentenario';
  if (combined.includes('exterior')) return 'Banco Exterior';
  if (combined.includes('plaza')) return 'Banco Plaza';
  if (combined.includes('bvc') || combined.includes('venezolano de credito')) {
    return 'Banco Venezolano de Crédito';
  }
  if (combined.includes('sofitasa')) return 'Banco Sofitasa';
  if (combined.includes('100% banco') || combined.includes('100%banco')) return '100% Banco';
  if (combined.includes('caroni')) return 'Banco Caroní';
  if (combined.includes('banfanb')) return 'BANFANB';
  if (combined.includes('banco activo')) return 'Banco Activo';
  if (combined.includes('bfc') || combined.includes('fondo comun')) return 'BFC Banco Fondo Común';
  if (combined.includes('delsur')) return 'DelSur';
  if (combined.includes('bancrecer')) return 'Bancrecer';
  if (combined.includes('mi banco') || combined.includes('r4')) return 'R4 Banco Microfinanciero';

  // 2. Por código SUDEBAN de 4 dígitos al inicio de cuenta (incluso enmascarada como "0108*****40*****7396" o con guiones por OCR)
  const matchCodigo = rawString.match(/\b(01\d{2})[\d*•xX#.\-:"'+~_=]{4,}/);
  if (matchCodigo && BANCOS_SUDEBAN[matchCodigo[1]]) {
    return BANCOS_SUDEBAN[matchCodigo[1]];
  }

  const standaloneCode = rawString.match(/\b(01\d{2})\b/);
  if (standaloneCode && BANCOS_SUDEBAN[standaloneCode[1]]) {
    return BANCOS_SUDEBAN[standaloneCode[1]];
  }

  const cleanCandidate = String(bancoCandidato || '').trim();
  if (
    !cleanCandidate ||
    /^(null|undefined|n\/a|na|ninguno|no\s+especificado|no\s+visible|origen|destino|banco|cuenta|pago\s+m[oó]vil|transferencia|-+)$/i.test(
      cleanCandidate
    )
  ) {
    return '';
  }

  return cleanCandidate;
}

/**
 * Extrae y normaliza cuentas bancarias venezolanas de 20 dígitos o enmascaradas (ej. "0108*****40*****7396"),
 * reconstruyendo asteriscos cuando el OCR sobre fotos a monitores lee '*' como '-', ':' o '"'.
 */
export function extractCuentaEnmascaradaVenezolana(
  rawCuenta?: unknown,
  textoContexto?: string
): string {
  const combined = `${rawCuenta ?? ''} ${textoContexto ?? ''}`.trim();
  if (!combined) return '';

  // 1. Patrón de cuenta enmascarada tipo Provinet/Banca en línea: 01XX + máscara + 2..4 dígitos + máscara + 4 dígitos
  const maskedMatch = combined.match(
    /\b(01\d{2})\s*([*•xX#.\-:"'+~_=]{3,8})\s*(\d{2,4})\s*([*•xX#.\-:"'+~_=]{3,8})\s*(\d{4})\b/
  );
  if (maskedMatch) {
    let prefix = maskedMatch[1];
    const midDigits = maskedMatch[3];
    const endDigits = maskedMatch[5];
    const isProvinetContext = /provinet|provmet|provlnet|provinel|provincial|bbva/i.test(combined);
    if (
      prefix === '0103' ||
      prefix === '0100' ||
      prefix === '0106' ||
      (isProvinetContext && /^010\d$/.test(prefix))
    ) {
      prefix = '0108';
    }
    return `${prefix}*****${midDigits}*****${endDigits}`;
  }

  // 2. Cuenta de 20 dígitos o enmascarada continua con código SUDEBAN válido
  const continuousMatch = combined.match(
    /\b(01(?:02|04|05|08|14|15|28|34|37|38|51|56|57|63|66|68|69|71|72|74|75|77|91)[*•xX#.\d-]{8,22})\b/
  );
  if (continuousMatch) {
    return continuousMatch[1].trim();
  }

  return '';
}

/**
 * Normaliza el número de referencia bancaria conservando todos los ceros a la izquierda (ej. "000012723").
 */
export function normalizeReferenciaVenezolana(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  if (!str || /^(null|undefined|n\/a|na|ninguno|no\s+visible|-+)$/i.test(str)) return '';

  // Descartar cuentas enmascaradas
  if (/[*•]/.test(str) || /\b01\d{2}[*xX•\d\-:"']{10,20}\b/.test(str)) {
    return '';
  }

  // Eliminar anotaciones de íconos de copiado al final (ej. "948480864 [)" o "947474757 [ícono]" o "947474757 0")
  const cleaned = str
    .replace(/\[[^\]]*\]|\([^)]*\)|\[\)|\(\]/g, ' ')
    .replace(/[\u{1F4CB}\u{1F50D}\u{1F50E}\u{2398}\u{274F}\u{2750}\u{1F517}]/gu, ' ')
    .replace(/^(\D*\d{6,14})\s+[0O8Qo]\s*$/, '$1')
    .trim();

  const digits = cleaned.replace(/\D/g, '');
  if (!digits || digits.length < 4) return '';

  // Descartar teléfonos móviles venezolanos y cuentas de 20 dígitos
  if (/^04(12|14|16|24|26)\d{7}$/.test(digits) || /^584(12|14|16|24|26)\d{7}$/.test(digits)) {
    return '';
  }
  if (digits.length === 20 && digits.startsWith('01')) {
    return '';
  }

  return digits;
}

const MESES_ES: Record<string, string> = {
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
  dic: '12', diciembre: '12',
};

/**
 * Normaliza fechas de comprobantes a YYYY-MM-DD (para `<input type="date">`) y DD/MM/YYYY (`fechaDisplay`).
 */
export function normalizeFechaVenezolana(
  rawFecha?: unknown,
  rawFechaIso?: unknown,
  fallbackIso?: string
): { fecha: string; fechaDisplay: string; esExplicita: boolean } {
  const candidates = [rawFecha, rawFechaIso]
    .map((c) => (c === null || c === undefined ? '' : String(c).trim()))
    .filter((c) => c && !/^(null|undefined|n\/a|na|no\s+visible)$/i.test(c));

  for (const cand of candidates) {
    // 1. DD/MM/YYYY o DD-MM-YYYY
    const dmy = cand.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2}|\d{2})\b/);
    if (dmy) {
      let day = parseInt(dmy[1], 10);
      let month = parseInt(dmy[2], 10);
      let year = parseInt(dmy[3], 10);
      if (year < 100) year += 2000;
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
          fecha: `${yyyy}-${mm}-${dd}`,
          fechaDisplay: `${dd}/${mm}/${yyyy}`,
          esExplicita: true,
        };
      }
    }

    // 2. YYYY-MM-DD
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
          fecha: `${yyyy}-${mm}-${dd}`,
          fechaDisplay: `${dd}/${mm}/${yyyy}`,
          esExplicita: true,
        };
      }
    }

    // 3. Fecha en texto ("23 de octubre de 2026")
    const normTxt = cand
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const txtMatch = normTxt.match(/\b(\d{1,2})\s*(?:de\s*)?([a-z]{3,10})\.?\s*(?:de\s*|del\s*|,\s*)?(20\d{2})?\b/);
    if (txtMatch && MESES_ES[txtMatch[2]]) {
      const day = parseInt(txtMatch[1], 10);
      const mm = MESES_ES[txtMatch[2]];
      const yyyy = txtMatch[3] || String(new Date().getFullYear());
      if (day >= 1 && day <= 31) {
        const dd = String(day).padStart(2, '0');
        return {
          fecha: `${yyyy}-${mm}-${dd}`,
          fechaDisplay: `${dd}/${mm}/${yyyy}`,
          esExplicita: true,
        };
      }
    }
  }

  const defaultIso =
    fallbackIso && /^\d{4}-\d{2}-\d{2}$/.test(fallbackIso)
      ? fallbackIso
      : new Date().toISOString().split('T')[0];
  const [y, m, d] = defaultIso.split('-');
  return {
    fecha: defaultIso,
    fechaDisplay: `${d}/${m}/${y}`,
    esExplicita: false,
  };
}

export function inferirMetodoPagoVenezolano(
  rawMetodo?: unknown,
  textoContexto?: string
): ExtractedReceiptData['metodoPago'] {
  const combined = `${rawMetodo ?? ''} ${textoContexto ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (/\bzelle\b/.test(combined)) return 'Zelle';
  if (/\bdeposito\b/.test(combined)) return 'Depósito';
  if (/\befectivo\b/.test(combined)) return 'Efectivo';
  if (
    /\bpago\s*movil\b|\bp2p\b|\bp2c\b|\bc2p\b|\btpago\b|\bdinero\s*rapido\b/.test(combined)
  ) {
    return 'Pago Móvil';
  }
  if (
    /\btransferencia\b|\btranf\b|\bnota\s+de\s+operacion\b|\bnota\s+de\s+credito\b|\bprovinet\b|\b01\d{2}[*•xX#.\-\d]{12,20}\b/.test(
      combined
    )
  ) {
    return 'Transferencia';
  }
  return 'Pago Móvil';
}

/**
 * Normaliza cualquier payload crudo (de Gemini Vision, `/api/ocr` o `parseVenezuelanReceiptText`)
 * al contrato estricto `ExtractedReceiptData`.
 */
export function normalizeExtractedReceipt(
  rawInput: any,
  fallbackDateIso?: string
): ExtractedReceiptData {
  const raw = rawInput && typeof rawInput === 'object' ? rawInput : {};
  const sub =
    raw.datos_extraidos && typeof raw.datos_extraidos === 'object' ? raw.datos_extraidos : {};
  const evidenciaLines = Array.isArray(raw?.evidencia_visual?.lineas_crudas_detectadas)
    ? raw.evidencia_visual.lineas_crudas_detectadas.join(' ')
    : '';

  const rawCanal = String(
    raw.canal ?? sub.plataforma_canal ?? raw.plataforma_canal ?? ''
  ).trim();
  const cleanCanal =
    rawCanal && !/^(null|undefined|n\/a|pago\s*m[oó]vil|transferencia)$/i.test(rawCanal)
      ? rawCanal
      : '';

  const rawCuentaCandidate =
    raw.cuentaEnmascarada ??
    sub.numero_cuenta ??
    raw.numero_cuenta ??
    raw.cuenta_origen_o_destino ??
    raw.cuenta_enmascarada ??
    raw.cuenta ??
    '';

  const textoCompleto = [
    raw.texto_completo || '',
    raw.textoCompleto || '',
    evidenciaLines,
    cleanCanal,
    String(rawCuentaCandidate || ''),
    raw.observacion_auditoria || '',
    raw.observacion_ia || '',
  ]
    .filter(Boolean)
    .join(' ');

  const cuentaEnmascarada =
    extractCuentaEnmascaradaVenezolana(rawCuentaCandidate, textoCompleto) ||
    (rawCuentaCandidate &&
    !/^(null|undefined|n\/a|pago\s*m[oó]vil|transferencia)$/i.test(String(rawCuentaCandidate).trim())
      ? String(rawCuentaCandidate).trim()
      : '');

  // Monto numérico: prioriza montoRaw si difiere por factor ~1000 de montoNumerico (error típico de punto de miles)
  const montoFromTexto = parseMontoVenezolano(
    raw.montoFormateado ??
      raw.montoRaw ??
      sub.montoRaw ??
      sub.monto_texto ??
      raw.monto_texto ??
      raw.monto_texto_original
  );
  const montoFromNum = parseMontoVenezolano(
    raw.montoNumerico ??
      sub.montoNumerico ??
      sub.monto_numerico ??
      raw.monto_numerico ??
      raw.monto_bs ??
      raw.monto
  );
  const montoFromFullText =
    montoFromTexto === 0 && montoFromNum === 0 ? parseMontoVenezolano(textoCompleto) : 0;

  let montoNumerico = 0;
  if (montoFromTexto > 0 && montoFromNum > 0) {
    montoNumerico =
      montoFromTexto > montoFromNum && Math.abs(montoFromTexto / montoFromNum - 1000) < 15
        ? montoFromTexto
        : montoFromNum;
  } else {
    montoNumerico = montoFromTexto || montoFromNum || montoFromFullText || 0;
  }

  const montoFormateado = montoNumerico > 0 ? formatMontoVenezolano(montoNumerico) : '0,00';

  // Referencia bancaria
  const referencia =
    normalizeReferenciaVenezolana(
      raw.referencia ??
        sub.numero_referencia ??
        raw.numero_referencia ??
        raw.nro_referencia
    ) || normalizeReferenciaVenezolana(raw.codigo_autorizacion);

  // Banco venezolano inferido por nombre, plataforma (Provinet) o código SUDEBAN (0108...)
  const rawBancoCandidate =
    raw.banco ??
    sub.banco_identificado ??
    raw.banco_identificado ??
    raw.banco_origen ??
    raw.banco_destino ??
    sub.codigo_banco ??
    raw.codigo_banco ??
    '';

  const banco = inferirBancoVenezolano(
    String(rawBancoCandidate || ''),
    cuentaEnmascarada || cleanCanal,
    textoCompleto
  );

  // Fecha normalizada
  const fechaInfo = normalizeFechaVenezolana(
    raw.fechaDisplay ?? sub.fecha_original ?? raw.fecha_original ?? raw.fecha_pago,
    raw.fecha ?? sub.fecha_operacion ?? raw.fecha_operacion ?? raw.fecha_iso,
    fallbackDateIso
  );

  // Método de pago
  const metodoPago = inferirMetodoPagoVenezolano(
    raw.metodoPago ?? raw.metodo_pago ?? cleanCanal,
    `${banco} ${cuentaEnmascarada} ${textoCompleto}`
  );

  const resolvedCanal =
    cleanCanal || (banco === 'BBVA Provincial' && /provinet|provmet/i.test(textoCompleto) ? 'Provinet' : '');

  // Nivel de confianza
  const hasAllCore = Boolean(montoNumerico > 0 && referencia && banco && fechaInfo.esExplicita);
  const hasPartialCore = Boolean(montoNumerico > 0 || referencia || banco || cuentaEnmascarada);
  const confianza: ExtractedReceiptData['confianza'] = hasAllCore
    ? 'alta'
    : hasPartialCore
      ? 'media'
      : 'baja';

  const cleanTitular = String(raw.titular_remitente ?? raw.titular ?? '').trim();
  const cleanRif = String(raw.rif_ci_titular ?? raw.rif ?? '').trim();

  return {
    fecha: fechaInfo.fecha,
    fechaDisplay: fechaInfo.fechaDisplay,
    referencia,
    montoNumerico,
    montoFormateado,
    banco,
    metodoPago,
    cuentaEnmascarada: cuentaEnmascarada || resolvedCanal || undefined,
    confianza,
    fechaExplicita: fechaInfo.esExplicita,
    canal: resolvedCanal || undefined,
    titular:
      cleanTitular && !/^(null|undefined|n\/a|no\s+especificado)$/i.test(cleanTitular)
        ? cleanTitular
        : undefined,
    rif:
      cleanRif && !/^(null|undefined|n\/a)$/i.test(cleanRif)
        ? cleanRif
        : undefined,
  };
}

/**
 * Convierte el archivo original (`File` o `Blob`) directamente a Base64 íntegro a partir de sus bytes crudos,
 * sin recorte de `<canvas>` ni dependencia alguna del zoom (`1x`, `2x`) o scroll del visor en pantalla.
 */
export async function fileToFullBase64(file: File | Blob): Promise<{
  base64Data: string;
  dataUrl: string;
  mimeType: string;
  fileName: string;
  size: number;
}> {
  const fileObj = file as File;
  const fileName = fileObj.name || 'soporte_whatsapp.jpg';
  const size = file.size || 0;

  const detectMimeFromBytesOrName = (b64: string, declared?: string, name?: string): string => {
    const clean = b64.replace(/\s+/g, '');
    if (clean.startsWith('JVBERi0')) return 'application/pdf';
    if (clean.startsWith('/9j/')) return 'image/jpeg';
    if (clean.startsWith('iVBORw0KGgo')) return 'image/png';
    if (clean.startsWith('UklGR')) return 'image/webp';
    const d = String(declared || '').toLowerCase();
    if (d === 'image/jpg' || d === 'image/jpeg') return 'image/jpeg';
    if (d === 'image/png' || d === 'image/webp' || d === 'application/pdf') return d;
    const n = String(name || '').toLowerCase();
    if (n.endsWith('.pdf')) return 'application/pdf';
    if (n.endsWith('.png')) return 'image/png';
    if (n.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  };

  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = String(e.target?.result || '');
        if (!result) {
          return reject(new Error('El archivo de soporte está vacío o no pudo leerse.'));
        }
        const base64Data = (result.includes(',') ? result.split(',')[1] : result).replace(/\s+/g, '');
        const mimeType = detectMimeFromBytesOrName(base64Data, file.type, fileName);
        resolve({
          base64Data,
          dataUrl: `data:${mimeType};base64,${base64Data}`,
          mimeType,
          fileName,
          size,
        });
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo de soporte.'));
      reader.readAsDataURL(file);
    });
  }

  const ab = await file.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Data =
    typeof Buffer !== 'undefined' ? Buffer.from(ab).toString('base64') : btoa(binary);
  const mimeType = detectMimeFromBytesOrName(base64Data, file.type, fileName);
  return {
    base64Data,
    dataUrl: `data:${mimeType};base64,${base64Data}`,
    mimeType,
    fileName,
    size,
  };
}
