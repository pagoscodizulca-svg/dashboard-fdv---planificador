import * as XLSX from 'xlsx';

export const BCV_INDICE_INVERSION_URL = 'https://www.bcv.org.ve/estadisticas/indice-de-inversion';
export const BCV_SMC_URL = 'https://www.bcv.org.ve/estadisticas/tipo-cambio-de-referencia-smc';
export const BCV_HISTORY_CACHE_KEY = 'bcv_rates_history_cache';

export interface BcvRateResult {
  tasa: number;
  fechaValor: string;               // YYYY-MM-DD (fecha valor efectiva publicada por el BCV)
  fechaValorDisplay: string;        // DD/MM/YYYY
  fechaSolicitada: string;          // YYYY-MM-DD
  fechaSolicitadaDisplay: string;   // DD/MM/YYYY
  fuente: string;
  esDiaHabilAnterior?: boolean;
  desdeCache?: boolean;
}

export interface BcvCachedEntry {
  tasa: number;
  fechaValor: string;
  fuente: string;
  updatedAt: string;
}

/**
 * Normaliza cualquier fecha de entrada ("23/10/2026", "23-10-2026" o "2026-10-23")
 * al estándar YYYY-MM-DD y su representación DD/MM/YYYY.
 */
export function normalizeBcvDateInput(fechaInput: string): { iso: string; display: string } {
  const raw = String(fechaInput || '').trim();

  // 1. Formato YYYY-MM-DD o YYYY/MM/DD
  const isoMatch = raw.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    const yyyy = isoMatch[1];
    const mm = isoMatch[2].padStart(2, '0');
    const dd = isoMatch[3].padStart(2, '0');
    return {
      iso: `${yyyy}-${mm}-${dd}`,
      display: `${dd}/${mm}/${yyyy}`,
    };
  }

  // 2. Formato DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = raw.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    const yyyy = dmyMatch[3];
    return {
      iso: `${yyyy}-${mm}-${dd}`,
      display: `${dd}/${mm}/${yyyy}`,
    };
  }

  // 3. Formato compacto DDMMYYYY (usado en nombres de hojas Excel del BCV como "23102026")
  const compactMatch = raw.match(/^(\d{2})(\d{2})(20\d{2})$/);
  if (compactMatch) {
    const [, dd, mm, yyyy] = compactMatch;
    return {
      iso: `${yyyy}-${mm}-${dd}`,
      display: `${dd}/${mm}/${yyyy}`,
    };
  }

  const todayIso = new Date().toISOString().split('T')[0];
  const [y, m, d] = todayIso.split('-');
  return {
    iso: todayIso,
    display: `${d}/${m}/${y}`,
  };
}

/**
 * Convierte YYYY-MM-DD a DD/MM/YYYY.
 */
export function formatIsoToDisplayDate(isoDate: string): string {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDate;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Limpia el formato numérico venezolano del BCV (donde el punto separa miles y la coma
 * separa decimales, ej. "886,22710000" -> 886.23, "891,10540000" -> 891.11) redondeado a 2 decimales.
 */
export function parseNumeroBcv(raw: unknown): number {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.round((raw + Number.EPSILON) * 100) / 100;
  }
  if (!raw || typeof raw !== 'string') return 0;

  const cleaned = raw.replace(/[^\d.,-]/g, '').trim();
  if (!cleaned) return 0;

  let numericValue = 0;

  if (cleaned.includes('.') && cleaned.includes(',')) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Formato Venezolano BCV: "1.234,56780000" -> "1234.56780000"
      numericValue = parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      // Formato US: "1,234.5678" -> "1234.5678"
      numericValue = parseFloat(cleaned.replace(/,/g, '')) || 0;
    }
  } else if (cleaned.includes(',')) {
    // Formato BCV estándar con coma decimal: "886,22710000" -> 886.2271
    numericValue = parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  } else {
    numericValue = parseFloat(cleaned) || 0;
  }

  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
}

/**
 * Extrae las tasas publicadas en las tablas HTML de https://www.bcv.org.ve/estadisticas/indice-de-inversion
 * Retorna un mapa { "YYYY-MM-DD": tasaRedondeada2Decimales }
 */
export function parseBcvIndiceInversionHtml(html: string): Record<string, number> {
  const ratesByDate: Record<string, number> = {};
  if (!html || typeof html !== 'string') return ratesByDate;

  // Buscar todas las filas <tr>...</tr>
  const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  for (const rowHtml of rowMatches) {
    // Ignorar filas de encabezado <th>
    if (/<th[\s>]/i.test(rowHtml) && !/<td[\s>]/i.test(rowHtml)) continue;

    // 1. Intentar extraer fecha del atributo content="YYYY-MM-DD..." o del texto DD-MM-YYYY / DD/MM/YYYY en la celda de fecha
    let dateIso = '';
    const contentDateMatch = rowHtml.match(/content=["'](20\d{2}-\d{2}-\d{2})T/i);
    if (contentDateMatch) {
      dateIso = contentDateMatch[1];
    } else {
      const dateCellMatch =
        rowHtml.match(/views-field-field-fecha-del-indicador[^>]*>([\s\S]*?)<\/td>/i) ||
        rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
      if (dateCellMatch) {
        const plainDate = dateCellMatch[1].replace(/<[^>]+>/g, ' ').trim();
        if (/\b\d{1,2}[-/]\d{1,2}[-/]20\d{2}\b/.test(plainDate) || /\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/.test(plainDate)) {
          dateIso = normalizeBcvDateInput(plainDate).iso;
        }
      }
    }

    if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) continue;

    // 2. Extraer "Tipo de Cambio de Venta (Bs / USD)" de la segunda columna (views-field-views-conditional)
    let rateVal = 0;
    const conditionalCellMatch = rowHtml.match(
      /class=["'][^"']*views-field-views-conditional(?:\s|["'])[^>]*>([\s\S]*?)<\/td>/i
    );
    if (conditionalCellMatch) {
      const cellText = conditionalCellMatch[1].replace(/<[^>]+>/g, ' ').trim();
      rateVal = parseNumeroBcv(cellText);
    } else {
      // Fallback genérico: tomar todas las celdas <td> y leer la segunda columna
      const tdMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
        m[1].replace(/<[^>]+>/g, ' ').trim()
      );
      if (tdMatches.length >= 2) {
        rateVal = parseNumeroBcv(tdMatches[1]);
      }
    }

    if (rateVal > 0) {
      ratesByDate[dateIso] = rateVal;
    }
  }

  return ratesByDate;
}

/**
 * Extrae enlaces a archivos estadísticos .xls o .xlsx dentro del HTML del BCV.
 */
export function extractBcvExcelLinksFromHtml(html: string): string[] {
  if (!html || typeof html !== 'string') return [];
  const links: string[] = [];
  const regex = /href=["']([^"']+\.(?:xls|xlsx)(?:\?[^"']*)?)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const rawHref = match[1].trim();
    if (!rawHref) continue;
    const fullUrl = rawHref.startsWith('http')
      ? rawHref
      : `https://www.bcv.org.ve${rawHref.startsWith('/') ? '' : '/'}${rawHref}`;
    if (!links.includes(fullUrl)) {
      links.push(fullUrl);
    }
  }
  return links;
}

/**
 * Parsea un archivo Excel (.xls / .xlsx) del BCV usando la librería `xlsx`
 * y extrae el mapa { "YYYY-MM-DD": tasaRedondeada2Decimales }.
 * Soporta tanto hojas tabulares de Índice de Inversión como libros trimestrales SMC (ej. 2_1_2d26_smc.xls).
 */
export function parseBcvExcelBuffer(buffer: ArrayBuffer | Uint8Array): Record<string, number> {
  const ratesByDate: Record<string, number> = {};
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      if (!Array.isArray(rows) || rows.length === 0) continue;

      let sheetFechaValorIso = '';
      let sheetFechaOperacionIso = '';

      // Si el nombre de la hoja es DDMMYYYY (ej. "23102026")
      if (/^\d{8}$/.test(sheetName.trim())) {
        sheetFechaOperacionIso = normalizeBcvDateInput(sheetName.trim()).iso;
      }

      for (const row of rows) {
        if (!Array.isArray(row) || row.length === 0) continue;
        const rowText = row.map((c) => String(c ?? '').trim()).join(' ');

        // Detectar "Fecha Valor: DD/MM/YYYY" o "Fecha Operacion: DD/MM/YYYY" en cabeceras de hojas SMC
        const fvMatch = rowText.match(/Fecha\s+Valor\s*:\s*(\d{2}[-/]\d{2}[-/]20\d{2})/i);
        if (fvMatch) {
          sheetFechaValorIso = normalizeBcvDateInput(fvMatch[1]).iso;
        }
        const foMatch = rowText.match(/Fecha\s+Operaci[oó]n\s*:\s*(\d{2}[-/]\d{2}[-/]20\d{2})/i);
        if (foMatch) {
          sheetFechaOperacionIso = normalizeBcvDateInput(foMatch[1]).iso;
        }

        // Caso A: Fila de moneda USD en libro SMC: ['USD', 'E.U.A.', 1, 1, compra, venta]
        const firstCol = String(row[0] ?? '').trim().toUpperCase();
        if (firstCol === 'USD' && row.length >= 6) {
          const askRate = parseNumeroBcv(row[5]) || parseNumeroBcv(row[4]);
          if (askRate > 0) {
            if (sheetFechaValorIso) {
              ratesByDate[sheetFechaValorIso] = askRate;
            }
            if (sheetFechaOperacionIso && !ratesByDate[sheetFechaOperacionIso]) {
              ratesByDate[sheetFechaOperacionIso] = askRate;
            }
          }
          continue;
        }

        // Caso B: Fila tabular [Fecha, Tipo de Cambio de Venta (Bs/USD), ...]
        const cell0 = String(row[0] ?? '').trim();
        if (
          /^\d{1,2}[-/]\d{1,2}[-/]20\d{2}$/.test(cell0) ||
          /^20\d{2}[-/]\d{1,2}[-/]\d{1,2}$/.test(cell0)
        ) {
          const iso = normalizeBcvDateInput(cell0).iso;
          const rateCandidate = parseNumeroBcv(row[1]);
          if (iso && rateCandidate > 0) {
            ratesByDate[iso] = rateCandidate;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[BCV EXCEL PARSER] Error procesando libro Excel del BCV:', err);
  }
  return ratesByDate;
}

/**
 * Regla Bancaria para Fines de Semana y Días sin Publicación:
 * Si la FECHA DE PAGO cae en sábado, domingo o feriado y no existe fila exacta para ese día,
 * busca automáticamente hacia atrás el último día hábil inmediato disponible (hasta 5 días previos).
 */
export function resolveBcvRateWithBusinessDayFallback(
  ratesMap: Record<string, number>,
  fechaInput: string,
  maxLookbackDays: number = 5,
  fuente: string = BCV_INDICE_INVERSION_URL
): BcvRateResult | null {
  if (!ratesMap || typeof ratesMap !== 'object') return null;
  const { iso: targetIso, display: targetDisplay } = normalizeBcvDateInput(fechaInput);

  // 1. Coincidencia exacta en la fecha solicitada
  const exactRate = ratesMap[targetIso];
  if (typeof exactRate === 'number' && exactRate > 0) {
    return {
      tasa: exactRate,
      fechaValor: targetIso,
      fechaValorDisplay: targetDisplay,
      fechaSolicitada: targetIso,
      fechaSolicitadaDisplay: targetDisplay,
      fuente,
      esDiaHabilAnterior: false,
    };
  }

  // 2. Retroceso de hasta maxLookbackDays (5 días previos) para cubrir sábado, domingo y feriados bancarios
  const baseDate = new Date(`${targetIso}T12:00:00Z`);
  if (isNaN(baseDate.getTime())) return null;

  for (let offset = 1; offset <= maxLookbackDays; offset++) {
    const prevDate = new Date(baseDate.getTime() - offset * 86400000);
    const yyyy = prevDate.getUTCFullYear();
    const mm = String(prevDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(prevDate.getUTCDate()).padStart(2, '0');
    const prevIso = `${yyyy}-${mm}-${dd}`;
    const candidateRate = ratesMap[prevIso];
    if (typeof candidateRate === 'number' && candidateRate > 0) {
      return {
        tasa: candidateRate,
        fechaValor: prevIso,
        fechaValorDisplay: `${dd}/${mm}/${yyyy}`,
        fechaSolicitada: targetIso,
        fechaSolicitadaDisplay: targetDisplay,
        fuente,
        esDiaHabilAnterior: true,
      };
    }
  }

  return null;
}

/**
 * Lee el diccionario de tasas históricas almacenado en localStorage bajo `bcv_rates_history_cache`.
 */
export function readLocalBcvRatesCache(): Record<string, BcvCachedEntry> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(BCV_HISTORY_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

/**
 * Guarda entradas en el diccionario `bcv_rates_history_cache` de localStorage.
 */
export function saveToLocalBcvRatesCache(
  entries: Record<string, { tasa: number; fechaValor?: string; fuente?: string }>
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const current = readLocalBcvRatesCache();
    const nowIso = new Date().toISOString();
    for (const [dateKey, val] of Object.entries(entries)) {
      if (!val || typeof val.tasa !== 'number' || val.tasa <= 0) continue;
      const cleanRate = parseNumeroBcv(val.tasa);
      if (cleanRate <= 0) continue;
      current[dateKey] = {
        tasa: cleanRate,
        fechaValor: val.fechaValor || dateKey,
        fuente: val.fuente || BCV_INDICE_INVERSION_URL,
        updatedAt: nowIso,
      };
    }
    window.localStorage.setItem(BCV_HISTORY_CACHE_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('[BCV CACHE] No se pudo escribir en localStorage:', err);
  }
}

/**
 * Obtiene la tasa oficial del BCV para la fecha del comprobante (ej. "23/10/2026" o "2026-10-23"),
 * consultando primero el caché local `bcv_rates_history_cache` y luego el endpoint `/api/bcv-rate`
 * conectado con https://www.bcv.org.ve/estadisticas/indice-de-inversion.
 */
export async function getTasaBcvPorFecha(
  fechaInput: string,
  options?: { forceRefresh?: boolean }
): Promise<BcvRateResult> {
  const { iso: fechaSolicitada, display: fechaSolicitadaDisplay } = normalizeBcvDateInput(fechaInput);

  // 1. Verificar caché local en `bcv_rates_history_cache`
  if (!options?.forceRefresh) {
    const cachedDict = readLocalBcvRatesCache();
    const directHit = cachedDict[fechaSolicitada];
    if (directHit && typeof directHit.tasa === 'number' && directHit.tasa > 0) {
      const fvIso = directHit.fechaValor || fechaSolicitada;
      return {
        tasa: directHit.tasa,
        fechaValor: fvIso,
        fechaValorDisplay: formatIsoToDisplayDate(fvIso),
        fechaSolicitada,
        fechaSolicitadaDisplay,
        fuente: directHit.fuente || BCV_INDICE_INVERSION_URL,
        esDiaHabilAnterior: fvIso !== fechaSolicitada,
        desdeCache: true,
      };
    }
  }

  // 2. Consultar nuestro endpoint /api/bcv-rate (y fallback /api/tasa-bcv) que extrae de https://www.bcv.org.ve/estadisticas/indice-de-inversion
  const endpoints = [
    `/api/bcv-rate?date=${encodeURIComponent(fechaSolicitada)}`,
    `/api/tasa-bcv?date=${encodeURIComponent(fechaSolicitada)}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) continue;

      const data = await response.json();
      if (data && typeof data === 'object') {
        // Si el backend devuelve la serie reciente del BCV, poblar `bcv_rates_history_cache`
        if (data.serieReciente && typeof data.serieReciente === 'object') {
          const batchToSave: Record<string, { tasa: number; fechaValor: string; fuente: string }> = {};
          for (const [k, v] of Object.entries(data.serieReciente)) {
            const num = parseNumeroBcv(v);
            if (num > 0) {
              batchToSave[k] = {
                tasa: num,
                fechaValor: k,
                fuente: data.fuente || BCV_INDICE_INVERSION_URL,
              };
            }
          }
          saveToLocalBcvRatesCache(batchToSave);
        }

        const tasaNum = parseNumeroBcv(data.tasa);
        if (tasaNum > 0) {
          const fechaValor = String(data.fechaValor || fechaSolicitada);
          const fuente = String(data.fuente || BCV_INDICE_INVERSION_URL);

          // Guardar también la fecha solicitada en `bcv_rates_history_cache`
          saveToLocalBcvRatesCache({
            [fechaSolicitada]: { tasa: tasaNum, fechaValor, fuente },
            [fechaValor]: { tasa: tasaNum, fechaValor, fuente },
          });

          return {
            tasa: tasaNum,
            fechaValor,
            fechaValorDisplay: formatIsoToDisplayDate(fechaValor),
            fechaSolicitada,
            fechaSolicitadaDisplay,
            fuente,
            esDiaHabilAnterior: Boolean(data.esDiaHabilAnterior || fechaValor !== fechaSolicitada),
            desdeCache: Boolean(data.desdeCache),
          };
        }
      }
    } catch (err) {
      console.warn(`[BCV SERVICE] Advertencia consultando ${endpoint}:`, err);
    }
  }

  // 3. Fallback a través del proxy de Vite (/bcv-proxy/estadisticas/indice-de-inversion) si el backend no respondió
  try {
    const proxyRes = await fetch('/bcv-proxy/estadisticas/indice-de-inversion');
    if (proxyRes.ok) {
      const html = await proxyRes.text();
      const parsedMap = parseBcvIndiceInversionHtml(html);
      const resolved = resolveBcvRateWithBusinessDayFallback(
        parsedMap,
        fechaSolicitada,
        5,
        BCV_INDICE_INVERSION_URL
      );
      if (resolved) {
        const batchToSave: Record<string, { tasa: number; fechaValor: string; fuente: string }> = {};
        for (const [k, v] of Object.entries(parsedMap)) {
          batchToSave[k] = { tasa: v, fechaValor: k, fuente: BCV_INDICE_INVERSION_URL };
        }
        batchToSave[fechaSolicitada] = {
          tasa: resolved.tasa,
          fechaValor: resolved.fechaValor,
          fuente: BCV_INDICE_INVERSION_URL,
        };
        saveToLocalBcvRatesCache(batchToSave);
        return resolved;
      }
    }
  } catch {
    // Continuar al fallback en caché local
  }

  // 4. Último recurso: buscar día hábil previo en el diccionario local `bcv_rates_history_cache`
  const cachedDict = readLocalBcvRatesCache();
  const flatMap: Record<string, number> = {};
  for (const [k, v] of Object.entries(cachedDict)) {
    if (v && typeof v.tasa === 'number' && v.tasa > 0) {
      flatMap[k] = v.tasa;
    }
  }
  const fallbackFromCache = resolveBcvRateWithBusinessDayFallback(
    flatMap,
    fechaSolicitada,
    5,
    'bcv_rates_history_cache'
  );
  if (fallbackFromCache) {
    return {
      ...fallbackFromCache,
      desdeCache: true,
    };
  }

  throw new Error(`No se pudo obtener la tasa BCV para la fecha ${fechaSolicitadaDisplay}`);
}
