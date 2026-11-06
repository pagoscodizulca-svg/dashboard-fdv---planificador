/**
 * CONFIGURACIÓN CENTRAL DE RUBROS DE ACTIVACIÓN
 * ----------------------------------------------------------------------------
 * ÚNICA fuente de verdad de los rubros activos del mes: códigos internos, nombres comerciales,
 * categorías de servidor (Grid de metas), palabras clave de búsqueda, hojas de compra del Google Sheet
 * y reglas de clasificación de artículos. Para cambiar los rubros del mes basta con editar `RUBROS_CONFIG`.
 *
 * Los códigos legacy (ACEITE, POLLO, MORTADELA_SALPICAO) se conservan con `activo: false` para no
 * romper historial ni columnas de base de datos: siguen existiendo pero ya no se muestran en el módulo.
 *
 * Esta clasificación debe ser idéntica entre el motor de sincronización de Google Sheets (hoja
 * "Volumen por SKU"), el historial de ventas y la interfaz (paridad servidor/cliente).
 */

export type RubroCodigo =
  | 'AZUCAR'
  | 'LECHE_VENCAMPO'
  | 'POLLO'
  | 'ESTANDAR_ASTURIAS'
  | 'MORTADELA_SALPICAO'
  // Legacy / auxiliares: se conservan para historial y compatibilidad de datos
  | 'ACEITE'
  | 'MORTADELA_ASTURIAS'
  | 'SALPICAO'
  | 'OTROS';

export type RubroActivoCodigo = 'AZUCAR' | 'LECHE_VENCAMPO' | 'POLLO' | 'ESTANDAR_ASTURIAS' | 'MORTADELA_SALPICAO';

export interface RubroConfig {
  codigo: Exclude<RubroCodigo, 'OTROS'>;
  /** Nombre comercial exacto mostrado al usuario (KPIs, tablas, filtros, tooltips y PDF). */
  label: string;
  /** Clave interna de categoría usada por el Grid de metas / servidor. */
  categoriaServidor: string;
  /** Palabras clave (sin acentos, minúsculas) para el buscador del módulo. */
  palabrasClave: string;
  /** Si es `false` el rubro no se muestra en el módulo (se conserva solo por compatibilidad/historial). */
  activo: boolean;
}

/** Rubros del mes, en el orden exacto de las 5 columnas del Grid de Activación por Vendedor (C-D, E-F, G-H, I-J, K-L). */
export const RUBROS_CONFIG: RubroConfig[] = [
  {
    codigo: 'AZUCAR',
    label: 'AZUCAR',
    categoriaServidor: 'AZUCAR',
    palabrasClave: 'azucar montalban vencampo',
    activo: true
  },
  {
    codigo: 'LECHE_VENCAMPO',
    label: 'LECHE VENCAMPO',
    categoriaServidor: 'LECHE VENCAMPO',
    palabrasClave: 'leche en polvo vencampo lpv',
    activo: true
  },
  {
    codigo: 'POLLO',
    label: 'POLLO',
    categoriaServidor: 'POLLO',
    palabrasClave: 'pollo filet muslo alas higado molleja arroz vencampo',
    activo: true
  },
  {
    codigo: 'ESTANDAR_ASTURIAS',
    label: 'ESTANDAR Y SUPERIOR ASTURIAS',
    categoriaServidor: 'ESTANDAR Y SUPERIOR ASTURIAS',
    palabrasClave: 'jamon estandar superior asturias entero',
    activo: true
  },
  {
    codigo: 'MORTADELA_SALPICAO',
    label: 'MORTADELA SALPICAO Y ASTURIAS',
    categoriaServidor: 'MORTADELA SALPICAO Y ASTURIAS',
    palabrasClave: 'mortadela salpicao asturias ligeros enteros',
    activo: true
  },

  // ---- Legacy / auxiliares (no se muestran como tarjeta independiente) ----
  { codigo: 'ACEITE', label: 'ACEITE', categoriaServidor: 'ACEITE', palabrasClave: 'aceite oleo soya girasol', activo: false },
  {
    codigo: 'MORTADELA_ASTURIAS',
    label: 'MORTADELA ASTURIAS',
    categoriaServidor: 'MORTADELA ASTURIAS',
    palabrasClave: 'mortadela asturias',
    activo: false
  },
  { codigo: 'SALPICAO', label: 'SALPICAO', categoriaServidor: 'SALPICAO', palabrasClave: 'salpicao ligeros', activo: false }
];

export const RUBROS_ACTIVOS_CONFIG: RubroConfig[] = RUBROS_CONFIG.filter(r => r.activo);

/** Rubros mostrados en el módulo, en orden. */
export const RUBROS_ACTIVACION: RubroActivoCodigo[] = RUBROS_ACTIVOS_CONFIG.map(r => r.codigo as RubroActivoCodigo);

export const RUBROS_CLAVE: { codigo: RubroActivoCodigo; label: string }[] = RUBROS_ACTIVOS_CONFIG.map(r => ({
  codigo: r.codigo as RubroActivoCodigo,
  label: r.label
}));

export const MESES_CORTO: Record<number, string> = {
  1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic'
};

export const MESES_LARGO: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
};

export const RUBRO_LABEL: Record<RubroCodigo, string> = {
  ...(Object.fromEntries(RUBROS_CONFIG.map(r => [r.codigo, r.label])) as Record<Exclude<RubroCodigo, 'OTROS'>, string>),
  OTROS: 'Otros'
};

export const RUBRO_SERVER_CATEGORY: Record<RubroCodigo, string> = {
  ...(Object.fromEntries(RUBROS_CONFIG.map(r => [r.codigo, r.categoriaServidor])) as Record<Exclude<RubroCodigo, 'OTROS'>, string>),
  OTROS: 'OTROS'
};

/** Palabras clave de búsqueda por rubro (buscador del módulo). */
export const RUBRO_KEYWORDS: Record<RubroCodigo, string> = {
  ...(Object.fromEntries(RUBROS_CONFIG.map(r => [r.codigo, r.palabrasClave])) as Record<Exclude<RubroCodigo, 'OTROS'>, string>),
  OTROS: 'otros varios'
};

export function esRubroActivo(codigo: string): codigo is RubroActivoCodigo {
  return (RUBROS_ACTIVACION as string[]).includes(codigo);
}

const sinAcentos = (s: string) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

/**
 * Convierte un nombre de categoría (Grid de metas, hoja, API, etiqueta comercial o valor legacy guardado en base de datos)
 * al código canónico del rubro. Tolera el nombre comercial nuevo y los nombres anteriores.
 */
export function categoriaARubroCodigo(cat: string): RubroCodigo {
  const c = sinAcentos(cat).trim();
  if (c === 'MORTADELA_ASTURIAS' || c === 'MORTADELA ASTURIAS') return 'MORTADELA_SALPICAO';
  if (c === 'SALPICAO') return 'MORTADELA_SALPICAO';
  if (c.includes('MORTADELA') || c.includes('SALPICAO') || c.includes('LIGEROS')) return 'MORTADELA_SALPICAO';
  if (c.includes('LECHE')) return 'LECHE_VENCAMPO';
  if (c.includes('AZUCAR')) return 'AZUCAR';
  if (c.includes('ESTANDAR') || c.includes('SUPERIOR') || c.includes('JAMON') || c.includes('ENTERO')) return 'ESTANDAR_ASTURIAS';
  if (c.includes('POLLO') || c.includes('ARROZ')) return 'POLLO';
  if (c.includes('ACEITE')) return 'ACEITE';
  return 'OTROS';
}

const SKUS_MORTADELA_ASTURIAS = new Set(['1464', '1462', '1512', '1521', '1561', '1522', '1564', '1496', '1511']);
const SKUS_SALPICAO = new Set(['1563', '1562', '1519', '1599']);
const SKUS_LECHE_VENCAMPO = new Set(['1536', '1555', '1556', '1574', '1579', '1622']);
const SKUS_POLLO = new Set(['630', '629', '870', '393', '1568', '681', 'POLLO', 'FILET', 'MUSLO', 'ALAS']);

/**
 * Clasifica un artículo en una de las 5 categorías de activación del mes:
 *  1. ESTANDAR Y SUPERIOR ASTURIAS
 *  2. MORTADELA SALPICAO Y ASTURIAS
 *  3. LECHE VENCAMPO
 *  4. AZUCAR
 *  5. POLLO
 */
export function clasificarRubro(sku: string, nombre: string): RubroCodigo {
  const s = String(sku || '').trim();
  const sU = s.toUpperCase();
  const n = String(nombre || '').toUpperCase();

  if (s === '1461' || s === '1463' || n.includes('ESTANDAR ASTURIAS') || n.includes('SUPERIOR ASTURIAS')) {
    return 'ESTANDAR_ASTURIAS';
  }
  if (
    n.includes('SALPICAO') ||
    SKUS_SALPICAO.has(s) ||
    SKUS_MORTADELA_ASTURIAS.has(s) ||
    (n.includes('ASTURIAS') && (n.includes('MORTADELA') || n.includes('MORT.') || n.includes('PECHUGA')))
  ) {
    return 'MORTADELA_SALPICAO';
  }
  if (SKUS_LECHE_VENCAMPO.has(s) || (n.includes('LECHE') && n.includes('VENCAMPO'))) return 'LECHE_VENCAMPO';
  if (sU === 'ACEITE' || n.includes('ACEITE')) return 'ACEITE';
  if (sU === 'AZUCAR' || sU === 'AZÚCAR' || n.includes('AZUCAR') || n.includes('AZÚCAR')) return 'AZUCAR';
  if (
    SKUS_POLLO.has(s) ||
    SKUS_POLLO.has(sU) ||
    n.includes('POLLO ENTERO') ||
    n.includes('POLLO TODAS') ||
    n.includes('POLLO VENCAMPO') ||
    n.includes('FILET') ||
    n.includes('MUSLO') ||
    n.includes('ALAS DESPRESADAS') ||
    n.includes('HIGADO') ||
    n.includes('MOLLEJA')
  ) {
    return 'POLLO';
  }
  return 'OTROS';
}

export function clasificarRubroServerLabel(sku: string, nombre: string): string {
  return RUBRO_SERVER_CATEGORY[clasificarRubro(sku, nombre)];
}
