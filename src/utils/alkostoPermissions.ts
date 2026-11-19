import { normalizeVendorKey } from './vendorKeyNormalizer';
import { getSupervisorProfile } from './vendorRoutes';

export interface AlkostoIdentityInput {
  username?: string | null;
  role?: string | null;
  vendorId?: string | number | null;
  vendorKey?: string | null;
  route?: string | null;
}

export const ALKOSTO_ACCESS_DENIED_MESSAGE =
  'Acceso restringido: el módulo Alkosto no está habilitado para tu perfil.';

/**
 * Identificadores internos/ERP asociados a la cuenta de Sairu Valles.
 * - '26': vendor_id en usuarios/auth (`defaultUserHashes.ts` y `public.usuarios`)
 * - '56': código ERP secundario registrado en `maestraCatalogSanitizer.ts`
 */
const SAIRU_VALLES_VENDOR_IDS = new Set(['26', '56']);

function normalizeAsciiUpper(value: string | null | undefined): string {
  if (!value) return '';
  return String(value)
    .replace(/Ã‘|Ã±/g, 'N')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Determina de forma determinista si la identidad corresponde a Sairu Valles
 * evaluando vendorId, vendorKey canónico, username y alias de ruta.
 */
export function isSairuVallesIdentity(identity: AlkostoIdentityInput | null | undefined): boolean {
  if (!identity) return false;

  const normalizedId = String(identity.vendorId ?? '').trim();
  if (normalizedId && SAIRU_VALLES_VENDOR_IDS.has(normalizedId)) {
    return true;
  }

  const candidates = [identity.username, identity.vendorKey, identity.route];
  for (const raw of candidates) {
    if (!raw) continue;
    const ascii = normalizeAsciiUpper(raw);
    if (!ascii) continue;

    if (
      ascii.includes('SAIRU') ||
      ascii.includes('VALLES') ||
      ascii.includes('CUENTAS CLAVES 2') ||
      ascii.includes('CUENTAS CLAVE 2')
    ) {
      return true;
    }

    const canonicalKey = normalizeVendorKey(raw);
    if (canonicalKey === 'SAIRU VALLES') {
      return true;
    }
  }

  return false;
}

/**
 * Política central de autorización para el módulo Alkosto (Defensa en Profundidad).
 * Regla 1 (Denegación explícita prioritaria): Sairu Valles SIEMPRE es rechazada.
 * Regla 2 (Mínimo privilegio): Solo perfiles autorizados (ADMIN / SUPERVISOR) tienen acceso.
 */
export function canAccessAlkosto(identity: AlkostoIdentityInput | null | undefined): boolean {
  if (!identity) return false;

  // Denegación explícita e incondicional para Sairu Valles (incluso ante manipulación de rol/ruta)
  if (isSairuVallesIdentity(identity)) {
    return false;
  }

  const roleUpper = normalizeAsciiUpper(identity.role);
  if (roleUpper === 'ADMIN') {
    return true;
  }

  if (roleUpper === 'SUPERVISOR' || Boolean(getSupervisorProfile(identity.username))) {
    return true;
  }

  return false;
}

/**
 * Detecta intentos de acceso directo por URL, hash o query string al módulo Alkosto.
 */
export function isAlkostoRouteUrl(locationLike?: {
  pathname?: string;
  hash?: string;
  search?: string;
}): boolean {
  const loc =
    locationLike ||
    (typeof window !== 'undefined'
      ? {
          pathname: window.location.pathname,
          hash: window.location.hash,
          search: window.location.search
        }
      : null);

  if (!loc) return false;

  try {
    const pathname = String(loc.pathname || '').toLowerCase();
    const hash = String(loc.hash || '').toLowerCase();
    const params = new URLSearchParams(String(loc.search || ''));
    const tabParam = String(params.get('tab') || '').toLowerCase();

    return (
      pathname === '/alkosto' ||
      pathname.startsWith('/alkosto/') ||
      hash === '#alkosto' ||
      hash.startsWith('#alkosto/') ||
      tabParam === 'alkosto'
    );
  } catch {
    return false;
  }
}
