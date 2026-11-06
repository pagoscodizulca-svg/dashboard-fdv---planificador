/**
 * SERVICIO DE PARSEO Y SANITIZACIÓN DE LA MAESTRA ACTIVA (CLIENTES + VENDEDORES + SUPERVISORES)
 *
 * Módulo PURO (sin I/O ni dependencias de Node/Supabase): se usa igual en el servidor,
 * el script CLI y los tests. Contrato del archivo `MAESTRA ACTIVA ultima version.csv`:
 *   - UTF-8 con BOM (`\uFEFF`), delimitador `;`.
 *   - Fila 1: banner título (`;;MAESTRA CLIENTES ACTIVOS NOVIEMBRE 2026;;;`) -> se ignora.
 *   - Fila 2: encabezados `SUPERVISOR;ID VENDEDOR;Vendedor;Id;Razón Social;RIF`.
 *   - Cola con filas residuales de fórmulas de Excel (`Id`/`ID VENDEDOR` vacíos y RIF `#N/D`).
 *
 * Regla de deduplicación (determinista): la clave primaria de `maestra_clientes` es `id_cliente`;
 * si un `Id` aparece más de una vez en el archivo, GANA LA ÚLTIMA FILA (la más reciente del archivo)
 * y se registra un warning `ID_CLIENTE_DUPLICADO` con las líneas y vendedores en conflicto.
 */

export interface MaestraFilaValida {
  /** Número de línea (1-based) en el archivo original, útil para auditoría. */
  linea: number;
  supervisor: string;
  idVendedor: number;
  vendedor: string;
  idCliente: number;
  razonSocial: string;
  /** `null` cuando el archivo trae `#N/D`, `N/A` o vacío. */
  rif: string | null;
}

export interface MaestraVendedor {
  idVendedor: number;
  nombre: string;
  supervisor: string;
}

export type MaestraWarningTipo =
  | 'ID_CLIENTE_DUPLICADO'
  | 'VENDEDOR_INCONSISTENTE'
  | 'FILA_PARCIAL_DESCARTADA'
  | 'ID_NO_NUMERICO_DESCARTADO'
  | 'SUPERVISOR_VACIO'
  | 'CODIFICACION_NO_UTF8';

export interface MaestraWarning {
  tipo: MaestraWarningTipo;
  mensaje: string;
  idCliente?: number;
  lineas?: number[];
}

export interface MaestraReporte {
  /** Banner detectado en la fila 1 (o `null` si el archivo no lo trae). */
  banner: string | null;
  /** Filas de datos leídas (después del encabezado, sin contar líneas totalmente vacías). */
  filasLeidas: number;
  filasValidas: number;
  filasDescartadas: number;
  totalSupervisores: number;
  totalVendedores: number;
  /** Clientes únicos tras deduplicar por `Id`. */
  clientesUnicos: number;
  /** Filas válidas cuyo RIF vino como `#N/D`/`N/A`/vacío (antes de deduplicar). */
  rifPendientesFilas: number;
  /** Clientes únicos (después de deduplicar) que quedaron con RIF `null`. */
  rifPendientesClientes: number;
  /** Cantidad de `Id` que aparecen más de una vez en el archivo. */
  idsDuplicadosEnArchivo: number;
  /** Filas sobrantes eliminadas por duplicado (filasValidas - clientesUnicos). */
  filasDuplicadasEliminadas: number;
  /** Informativo: RIFs compartidos por más de un cliente (sucursales/grupos). */
  rifsCompartidos: { grupos: number; filas: number };
  warnings: MaestraWarning[];
}

export interface MaestraParseResult {
  /** Clientes únicos ya deduplicados (listos para UPSERT). */
  clientes: MaestraFilaValida[];
  vendedores: MaestraVendedor[];
  supervisores: string[];
  reporte: MaestraReporte;
}

export class MaestraParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaestraParseError';
  }
}

const REQUIRED_HEADERS = ['SUPERVISOR', 'IDVENDEDOR', 'VENDEDOR', 'ID', 'RAZONSOCIAL', 'RIF'] as const;
const MAX_HEADER_SCAN_ROWS = 10;
const RIF_NULL_TOKENS = new Set(['', '#N/D', '#N/A', 'N/D', 'N/A', 'NA', 'NULL', 'NAN', 'UNDEFINED']);

/** Normaliza un encabezado para compararlo: sin acentos, sin espacios ni signos, en mayúsculas. */
function normHeader(s: string): string {
  return String(s ?? '')
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** `trim()` + colapsa espacios internos repetidos + quita BOM/caracteres invisibles. */
function cleanText(s: unknown): string {
  return String(s ?? '')
    .replace(/[\uFEFF\u200B-\u200D]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Decodifica los bytes del archivo. Intenta UTF-8 estricto (con o sin BOM) y, solo si falla,
 * cae a windows-1252 devolviendo `fallback: true` para que el reporte lo advierta.
 */
export function decodeMaestraBytes(bytes: Uint8Array | ArrayBuffer): { texto: string; fallback: boolean } {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let texto: string;
  let fallback = false;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(view);
  } catch {
    texto = new TextDecoder('windows-1252').decode(view);
    fallback = true;
  }
  return { texto: texto.replace(/^\uFEFF/, ''), fallback };
}

/**
 * Parser CSV con soporte de comillas (RFC 4180 simplificado). Imprescindible: hay razones sociales
 * con el delimitador dentro de comillas, p. ej. `"COMERCIALIZADORA YUSI 600; C.A."`.
 * Una comilla solo abre un campo entrecomillado si está al inicio del campo.
 */
export function parseCsvRows(texto: string, delimitador = ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  let fieldStart = true;

  const endField = () => {
    row.push(cur);
    cur = '';
    fieldStart = true;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (inQuotes) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
      continue;
    }
    if (c === '"' && fieldStart) {
      inQuotes = true;
      fieldStart = false;
    } else if (c === delimitador) {
      endField();
    } else if (c === '\r') {
      if (texto[i + 1] === '\n') i++;
      endRow();
    } else if (c === '\n') {
      endRow();
    } else {
      cur += c;
      fieldStart = false;
    }
  }
  if (cur !== '' || row.length > 0) endRow();
  return rows;
}

/** Normaliza el RIF: `null` para `#N/D`/`N/A`/vacío; mayúsculas y sin espacios internos en el resto. */
export function sanitizarRifMaestra(raw: unknown): string | null {
  const t = cleanText(raw).replace(/^["']+|["']+$/g, '').trim();
  if (RIF_NULL_TOKENS.has(t.toUpperCase())) return null;
  return t.replace(/\s+/g, '').toUpperCase();
}

/** Convierte a entero estricto (`'  8377 '` -> 8377). Devuelve `null` si no es un entero válido. */
export function aEnteroEstricto(raw: unknown): number | null {
  const t = cleanText(raw).replace(/\.0+$/, '');
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

function filaVacia(cells: string[]): boolean {
  return cells.every(c => cleanText(c) === '');
}

/**
 * Parsea y valida el contenido (texto ya decodificado) de la maestra.
 * Lanza `MaestraParseError` si no encuentra los encabezados requeridos.
 */
export function parseMaestraTexto(textoCrudo: string, opciones: { codificacionFallback?: boolean } = {}): MaestraParseResult {
  const texto = textoCrudo.replace(/^\uFEFF/, '');
  const todas = parseCsvRows(texto, ';');

  // 1. Detectar encabezado: la primera fila (entre las primeras N) que contenga TODOS los encabezados requeridos.
  let headerIdx = -1;
  let colIdx: Record<(typeof REQUIRED_HEADERS)[number], number> | null = null;
  for (let i = 0; i < Math.min(todas.length, MAX_HEADER_SCAN_ROWS); i++) {
    const norm = todas[i].map(normHeader);
    const found = {} as Record<(typeof REQUIRED_HEADERS)[number], number>;
    let ok = true;
    for (const h of REQUIRED_HEADERS) {
      const pos = norm.indexOf(h);
      if (pos < 0) {
        ok = false;
        break;
      }
      found[h] = pos;
    }
    if (ok) {
      headerIdx = i;
      colIdx = found;
      break;
    }
  }
  if (headerIdx < 0 || !colIdx) {
    throw new MaestraParseError(
      `No se encontró la fila de encabezados. Se esperaba: SUPERVISOR; ID VENDEDOR; Vendedor; Id; Razón Social; RIF (en las primeras ${MAX_HEADER_SCAN_ROWS} filas).`
    );
  }

  // Banner: filas previas al encabezado con contenido (ej. `;;MAESTRA CLIENTES ACTIVOS NOVIEMBRE 2026;;;`)
  const bannerCells = todas
    .slice(0, headerIdx)
    .flatMap(r => r.map(cleanText))
    .filter(Boolean);
  const banner = bannerCells.length > 0 ? bannerCells.join(' ') : null;

  const warnings: MaestraWarning[] = [];
  if (opciones.codificacionFallback) {
    warnings.push({
      tipo: 'CODIFICACION_NO_UTF8',
      mensaje: 'El archivo no era UTF-8 válido; se decodificó como windows-1252. Revisa que los acentos y la Ñ se vean bien.'
    });
  }

  // 2. Recorrer filas de datos
  const validas: MaestraFilaValida[] = [];
  let filasLeidas = 0;
  let filasDescartadas = 0;

  for (let i = headerIdx + 1; i < todas.length; i++) {
    const cells = todas[i];
    if (filaVacia(cells)) continue; // línea en blanco final / separadores: no cuentan como fila leída
    filasLeidas++;
    const linea = i + 1;

    const get = (h: (typeof REQUIRED_HEADERS)[number]) => cleanText(cells[colIdx![h]]);
    const idVendRaw = get('IDVENDEDOR');
    const idCliRaw = get('ID');

    // Regla: Id o ID VENDEDOR nulo/vacío/NaN -> descartar (residuos de fórmulas de Excel)
    if (!idVendRaw || !idCliRaw || /^(NAN|#N\/D|#N\/A|N\/A|NULL)$/i.test(idVendRaw) || /^(NAN|#N\/D|#N\/A|N\/A|NULL)$/i.test(idCliRaw)) {
      filasDescartadas++;
      const rifRaw = get('RIF');
      const razon = get('RAZONSOCIAL');
      const sup = get('SUPERVISOR');
      // Solo es "parcial" (posible dato real perdido) si alguna celda de negocio trae contenido real
      if (razon || sup || get('VENDEDOR') || idVendRaw || idCliRaw) {
        warnings.push({
          tipo: 'FILA_PARCIAL_DESCARTADA',
          mensaje: `Línea ${linea} descartada: falta Id (${idCliRaw || 'vacío'}) o ID VENDEDOR (${idVendRaw || 'vacío'}); razón social "${razon}".`,
          lineas: [linea]
        });
      } else if (rifRaw && !RIF_NULL_TOKENS.has(rifRaw.toUpperCase())) {
        warnings.push({
          tipo: 'FILA_PARCIAL_DESCARTADA',
          mensaje: `Línea ${linea} descartada pero traía un RIF real (${rifRaw}) sin Id ni vendedor.`,
          lineas: [linea]
        });
      }
      continue;
    }

    const idVendedor = aEnteroEstricto(idVendRaw);
    const idCliente = aEnteroEstricto(idCliRaw);
    if (idVendedor === null || idCliente === null) {
      filasDescartadas++;
      warnings.push({
        tipo: 'ID_NO_NUMERICO_DESCARTADO',
        mensaje: `Línea ${linea} descartada: Id ("${idCliRaw}") o ID VENDEDOR ("${idVendRaw}") no es un entero válido.`,
        lineas: [linea]
      });
      continue;
    }

    validas.push({
      linea,
      supervisor: get('SUPERVISOR'),
      idVendedor,
      vendedor: get('VENDEDOR'),
      idCliente,
      razonSocial: get('RAZONSOCIAL'),
      rif: sanitizarRifMaestra(cells[colIdx!.RIF])
    });
  }

  // 3. Deduplicar por Id de cliente (PK): gana la ÚLTIMA fila; todo conflicto queda en warnings.
  const porId = new Map<number, MaestraFilaValida[]>();
  for (const f of validas) {
    const arr = porId.get(f.idCliente);
    if (arr) arr.push(f);
    else porId.set(f.idCliente, [f]);
  }
  const clientes: MaestraFilaValida[] = [];
  let idsDuplicados = 0;
  for (const [idCliente, filas] of porId) {
    const ganadora = filas[filas.length - 1];
    clientes.push(ganadora);
    if (filas.length > 1) {
      idsDuplicados++;
      const detalle = filas
        .map(f => `línea ${f.linea} → vendedor ${f.idVendedor} (${f.vendedor})`)
        .join(' | ');
      warnings.push({
        tipo: 'ID_CLIENTE_DUPLICADO',
        idCliente,
        lineas: filas.map(f => f.linea),
        mensaje: `Id ${idCliente} ("${ganadora.razonSocial}") aparece ${filas.length} veces: ${detalle}. Se conserva la última (línea ${ganadora.linea}, vendedor ${ganadora.idVendedor}).`
      });
    }
  }

  // 4. Catálogo de vendedores / supervisores (a partir de los clientes ya deduplicados + filas válidas)
  const vendedoresMap = new Map<number, MaestraVendedor>();
  for (const f of validas) {
    const existente = vendedoresMap.get(f.idVendedor);
    if (!existente) {
      vendedoresMap.set(f.idVendedor, { idVendedor: f.idVendedor, nombre: f.vendedor, supervisor: f.supervisor });
    } else if (existente.nombre !== f.vendedor || existente.supervisor !== f.supervisor) {
      warnings.push({
        tipo: 'VENDEDOR_INCONSISTENTE',
        mensaje: `ID VENDEDOR ${f.idVendedor} aparece con datos distintos (línea ${f.linea}: "${f.vendedor}" / ${f.supervisor}) vs. el primero ("${existente.nombre}" / ${existente.supervisor}). Se conserva el primero.`,
        lineas: [f.linea]
      });
    }
  }
  const vendedores = Array.from(vendedoresMap.values()).sort((a, b) => a.idVendedor - b.idVendedor);
  vendedores.forEach(v => {
    if (!v.supervisor) {
      warnings.push({ tipo: 'SUPERVISOR_VACIO', mensaje: `El vendedor ${v.idVendedor} (${v.nombre}) no tiene supervisor.` });
    }
  });
  const supervisores = Array.from(new Set(vendedores.map(v => v.supervisor).filter(Boolean))).sort();

  // 5. Métricas informativas
  const rifPendientesFilas = validas.filter(f => f.rif === null).length;
  const rifPendientesClientes = clientes.filter(c => c.rif === null).length;
  const porRif = new Map<string, Set<number>>();
  for (const c of clientes) {
    if (c.rif === null) continue;
    if (!porRif.has(c.rif)) porRif.set(c.rif, new Set());
    porRif.get(c.rif)!.add(c.idCliente);
  }
  let gruposRif = 0;
  let filasRif = 0;
  for (const ids of porRif.values()) {
    if (ids.size > 1) {
      gruposRif++;
      filasRif += ids.size;
    }
  }

  return {
    clientes,
    vendedores,
    supervisores,
    reporte: {
      banner,
      filasLeidas,
      filasValidas: validas.length,
      filasDescartadas,
      totalSupervisores: supervisores.length,
      totalVendedores: vendedores.length,
      clientesUnicos: clientes.length,
      rifPendientesFilas,
      rifPendientesClientes,
      idsDuplicadosEnArchivo: idsDuplicados,
      filasDuplicadasEliminadas: validas.length - clientes.length,
      rifsCompartidos: { grupos: gruposRif, filas: filasRif },
      warnings
    }
  };
}

/** Atajo: bytes del archivo -> resultado (decodifica UTF-8-sig, quita BOM, detecta banner, valida). */
export function parseMaestraBytes(bytes: Uint8Array | ArrayBuffer): MaestraParseResult {
  const { texto, fallback } = decodeMaestraBytes(bytes);
  return parseMaestraTexto(texto, { codificacionFallback: fallback });
}

/** Valores de referencia del archivo de Noviembre 2026 (solo informativos: la UI los muestra como contraste). */
export const REFERENCIA_MAESTRA_NOV_2026 = {
  filasValidas: 2717,
  filasDescartadas: 67,
  totalSupervisores: 3,
  totalVendedores: 30,
  rifPendientesFilas: 116,
  idsDuplicadosEnArchivo: 1
} as const;
