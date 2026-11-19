/**
 * NORMALIZADOR CANÓNICO TRANSVERSAL DE VENDEDORES / RUTAS Y RELOJ AMERICA/CARACAS
 * ---------------------------------------------------------------------------------
 * Garantiza paridad 1:1 en llaves de cruce entre:
 *  - Google Sheet "Dashboard_Vendedores" (Grid, Volumen por SKU, Activación por Cliente, Degustaciones, Usuarios)
 *  - Tablas y RPC en Supabase PostgreSQL
 *  - Filtros de autorización y vistas del frontend
 */

/**
 * Repara mojibake UTF-8/CP1252 común en hojas exportadas y limpia caracteres invisibles / BOM.
 */
function cleanMojibakeAndInvisible(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .replace(/[\uFEFF\u200B-\u200D]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/Ã‘|Ã±|\u00C3\u2018|\u00C3\u00B1/g, 'N')
    .replace(/Ã¡|Ã€/g, 'A')
    .replace(/Ã©|Ã‰/g, 'E')
    .replace(/Ã­|Ã /g, 'I')
    .replace(/Ã³|Ã“/g, 'O')
    .replace(/Ãº|Ãš/g, 'U');
}

/**
 * Normalizador Canónico Transversal (`normalizeVendorKey`):
 * 1. Limpia espacios extremos y dobles ("OSCAR ORTIZ-  LA COSTA" -> "OSCAR ORTIZ - LA COSTA").
 * 2. Estandariza cualquier variante de guion con espacios uniformes `' - '`.
 * 3. Elimina tildes/diacríticos y convierte `Ñ` -> `N` en llaves de cruce ASCII mayúsculas.
 * 4. Remueve dígitos accidentales pegados al final de nombres propios ("MIKELANGELO DIAZ1" -> "MIKELANGELO DIAZ"),
 *    preservando intactos los números independientes de rutas comerciales ("CUENTAS CLAVE 1 - MC", "CUENTAS CLAVE 2 - SV").
 */
export function normalizeVendorKey(raw: unknown): string {
  const cleaned = cleanMojibakeAndInvisible(raw);
  if (!cleaned) return '';

  return cleaned
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[-–—]+/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()
    // Remover dígitos accidentales pegados a tokens alfabéticos (ej. DIAZ1 -> DIAZ),
    // sin alterar tokens numéricos independientes como "1" en "CUENTAS CLAVE 1 - MC".
    .replace(/\b([A-Z]{2,})\d+\b/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resuelve la llave canónica de ruta comercial unificando alias conocidos del negocio
 * (ej. CUENTAS CLAVE 1 / MARIANA CHACIN -> CUENTAS CLAVES 1 - MC; LUIS GUANIPA -> VICTORIA VARGAS).
 */
export function resolveCanonicalRouteKey(raw: unknown): string {
  const key = normalizeVendorKey(raw);
  if (!key) return '';

  if (
    key === 'MARIANA CHACIN' ||
    key === 'CUENTAS CLAVE 1' ||
    key === 'CUENTAS CLAVES 1' ||
    key === 'CUENTAS CLAVE 1 - MC' ||
    key === 'CUENTAS CLAVES 1 - MC'
  ) {
    return 'CUENTAS CLAVES 1 - MC';
  }

  if (
    key === 'SAIRU VALLES' ||
    key === 'CUENTAS CLAVE 2' ||
    key === 'CUENTAS CLAVES 2' ||
    key === 'CUENTAS CLAVE 2 - SV' ||
    key === 'CUENTAS CLAVES 2 - SV'
  ) {
    return 'CUENTAS CLAVES 2 - SV';
  }

  if (
    key === 'LUIS GUANIPA' ||
    key === 'VICTORIA VARGAS' ||
    key === 'RUTA LUIS GUANIPA' ||
    key === 'RUTA VICTORIA VARGAS'
  ) {
    return 'VICTORIA VARGAS';
  }

  if (key === 'FOOD SERVICE NORTE' || key === 'JAIDER MEDINA') {
    return 'JAIDER MEDINA - FOOD SERVICE NORTE';
  }

  if (key === 'FOOD SERVICE SENIOR') {
    return 'FOOD SERVICE SENIOR - JUAN HERNANDEZ';
  }

  if (
    key === 'MIKELANGELO' ||
    key === 'MIKELANGELO DIAZ' ||
    key === 'MIKELANGELO DIAZ - PRINCIPAL' ||
    key === 'MIKELANGELO DIAZ (PRINCIPAL)'
  ) {
    return 'MIKELANGELO DIAZ';
  }

  if (
    (key.includes('MIKELANGELO') || key.includes('SOTO')) &&
    key.includes('VILLA')
  ) {
    return 'MIKELANGELO DIAZ - VILLA DEL ROS';
  }

  if (key === 'MARIANGEL') {
    return 'MARIANGEL GONZALEZ';
  }

  return key;
}

/**
 * Calcula el periodo mensual vigente (`YYYY-MM`) estrictamente en la zona horaria `America/Caracas` (UTC-4),
 * evitando saltos prematuros de mes entre las 20:00 y 23:59 VET cuando el servidor corre en UTC.
 */
export function getCaracasYearMonth(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value || String(date.getUTCFullYear());
  const month = parts.find((p) => p.type === 'month')?.value || String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Calcula la fecha actual (`YYYY-MM-DD`) estrictamente en la zona horaria `America/Caracas`.
 */
export function getCaracasIsoDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value || String(date.getUTCFullYear());
  const month = parts.find((p) => p.type === 'month')?.value || String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = parts.find((p) => p.type === 'day')?.value || String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
