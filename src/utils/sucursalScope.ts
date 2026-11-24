/**
 * ============================================================================
 * AISLAMIENTO MULTISEDE ESTRICTO ('CENTRO' | 'OCCIDENTE')
 * ============================================================================
 * Garantiza que toda sesión de vendedor, supervisor o coordinadora opere
 * exclusivamente bajo su sucursal autoritativa y bloquea cualquier cruce
 * de tiendas, rutas o manipulación de payloads hacia Supabase.
 */

export type Sucursal = 'CENTRO' | 'OCCIDENTE';

export const VALID_SUCURSALES: readonly Sucursal[] = ['CENTRO', 'OCCIDENTE'] as const;

export function normalizeSucursal(raw: unknown): Sucursal | null {
  if (raw === null || raw === undefined) return null;
  const clean = String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .toUpperCase();

  if (clean === 'CENTRO' || clean === 'SEDE CENTRO' || clean === 'SUCURSAL CENTRO') {
    return 'CENTRO';
  }
  if (clean === 'OCCIDENTE' || clean === 'SEDE OCCIDENTE' || clean === 'SUCURSAL OCCIDENTE') {
    return 'OCCIDENTE';
  }
  return null;
}

export function isValidSucursal(raw: unknown): raw is Sucursal {
  return normalizeSucursal(raw) !== null;
}

export function assertValidSucursal(raw: unknown, context = 'sucursal'): Sucursal {
  const norm = normalizeSucursal(raw);
  if (!norm) {
    throw new Error(`Valor inválido para ${context}: "${String(raw ?? '')}". Se requiere estrictamente 'CENTRO' u 'OCCIDENTE'.`);
  }
  return norm;
}

/**
 * Infiere la sucursal únicamente para perfiles legacy de Zulia/Falcón cuando la
 * fila proviene de semillas históricas sin columna `sucursal` explícita.
 */
export function inferSucursalFromLegacyMetadata(
  rawSucursal?: unknown,
  rawRegionOrZona?: unknown
): Sucursal {
  const explicit = normalizeSucursal(rawSucursal);
  if (explicit) return explicit;

  const hint = `${String(rawSucursal ?? '')} ${String(rawRegionOrZona ?? '')}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (/\b(CENTRO|CARACAS|VALENCIA|MARACAY|ARAGUA|CARABOBO|MIRANDA|GRAN CARACAS|CAPITAL)\b/.test(hint)) {
    return 'CENTRO';
  }
  return 'OCCIDENTE';
}

export interface CrossBranchValidationInput {
  sessionRole: string;
  sessionSucursal: Sucursal;
  payloadSucursal?: unknown;
  vendorSucursal?: Sucursal | null;
  storeSucursal?: Sucursal | null;
  routeSucursal?: Sucursal | null;
  storeExistsInCatalog?: boolean;
  requireCatalogStore?: boolean;
  resolvedRoute?: string | null;
}

export type CrossBranchValidationResult =
  | { ok: true; sucursal: Sucursal; status?: number; code?: string; error?: string }
  | { ok: false; sucursal?: Sucursal; status: number; code: string; error: string };

/**
 * Defensa en profundidad (Zero-Trust): valida que el token de sesión, el vendedor,
 * la ruta, la tienda seleccionada y el atributo `sucursal` del payload pertenezcan
 * exactamente a la misma sede ('CENTRO' | 'OCCIDENTE').
 */
export function validateCrossBranchSubmission(
  input: CrossBranchValidationInput
): CrossBranchValidationResult {
  const roleUpper = String(input.sessionRole || 'VENDEDOR').toUpperCase().trim();
  const sessionBranch = normalizeSucursal(input.sessionSucursal);
  if (!sessionBranch) {
    return {
      ok: false,
      status: 403,
      code: 'INVALID_SESSION_SUCURSAL',
      error: 'La sesión actual no posee una sucursal válida (CENTRO | OCCIDENTE).'
    };
  }

  // Si el payload incluye `sucursal`, debe ser un literal canónico válido
  let payloadBranch: Sucursal | null = null;
  if (input.payloadSucursal !== undefined && input.payloadSucursal !== null && String(input.payloadSucursal).trim() !== '') {
    payloadBranch = normalizeSucursal(input.payloadSucursal);
    if (!payloadBranch) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_SUCURSAL_VALUE',
        error: `Sucursal inválida "${String(input.payloadSucursal)}". Valores permitidos: 'CENTRO' | 'OCCIDENTE'.`
      };
    }
  }

  // Para cualquier rol distinto de ADMIN global, la sucursal de la sesión es inmutable
  if (roleUpper !== 'ADMIN') {
    if (payloadBranch && payloadBranch !== sessionBranch) {
      return {
        ok: false,
        status: 403,
        code: 'SUCURSAL_TAMPERING_DETECTED',
        error: `Operación denegada: Tu sesión pertenece a ${sessionBranch} y no puede emitir solicitudes bajo ${payloadBranch}.`
      };
    }
    if (input.vendorSucursal && input.vendorSucursal !== sessionBranch) {
      return {
        ok: false,
        status: 403,
        code: 'VENDOR_SUCURSAL_MISMATCH',
        error: `Operación denegada: El vendedor seleccionado pertenece a ${input.vendorSucursal}, fuera de tu sucursal (${sessionBranch}).`
      };
    }
  }

  const effectiveSucursal: Sucursal =
    roleUpper === 'ADMIN'
      ? (input.vendorSucursal || input.storeSucursal || payloadBranch || sessionBranch)
      : sessionBranch;

  // Incluso para ADMIN, jamás se puede mezclar un vendedor de una sede con payload/tienda de otra sede
  if (payloadBranch && payloadBranch !== effectiveSucursal) {
    return {
      ok: false,
      status: 403,
      code: 'SUCURSAL_TAMPERING_DETECTED',
      error: `Inconsistencia multisede: el campo sucursal (${payloadBranch}) no coincide con la sede autoritativa (${effectiveSucursal}).`
    };
  }

  if (input.vendorSucursal && input.vendorSucursal !== effectiveSucursal) {
    return {
      ok: false,
      status: 403,
      code: 'VENDOR_SUCURSAL_MISMATCH',
      error: `El vendedor pertenece a ${input.vendorSucursal} pero la solicitud intenta procesarse en ${effectiveSucursal}.`
    };
  }

  if (input.requireCatalogStore && !input.storeExistsInCatalog) {
    return {
      ok: false,
      status: 400,
      code: 'UNCATALOGED_STORE_FORBIDDEN',
      error: `El cliente/tienda indicado no existe en el catálogo activo de la sucursal ${effectiveSucursal}. Selecciónalo desde la lista oficial.`
    };
  }

  if (input.storeSucursal && input.storeSucursal !== effectiveSucursal) {
    return {
      ok: false,
      status: 403,
      code: 'CROSS_BRANCH_STORE_FORBIDDEN',
      error: `Acceso multisede denegado: un vendedor o sesión de ${effectiveSucursal} no puede seleccionar tiendas de ${input.storeSucursal}.`
    };
  }

  if (input.vendorSucursal && input.storeSucursal && input.vendorSucursal !== input.storeSucursal) {
    return {
      ok: false,
      status: 403,
      code: 'CROSS_BRANCH_STORE_FORBIDDEN',
      error: `Cruce de sucursales prohibido: vendedor (${input.vendorSucursal}) ≠ tienda (${input.storeSucursal}).`
    };
  }

  if (input.routeSucursal && input.routeSucursal !== effectiveSucursal) {
    return {
      ok: false,
      status: 403,
      code: 'CROSS_BRANCH_ROUTE_FORBIDDEN',
      error: `La ruta seleccionada pertenece a ${input.routeSucursal} y no puede usarse desde ${effectiveSucursal}.`
    };
  }

  const cleanRoute = String(input.resolvedRoute || '').trim().toUpperCase();
  if (cleanRoute === 'ALL_MY_ROUTES' || cleanRoute === 'SUPERVISOR_ALL') {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_CONSOLIDATED_ROUTE',
      error: 'Debes asociar una ruta comercial específica de tu sucursal (no se permite ALL_MY_ROUTES).'
    };
  }

  return { ok: true, sucursal: effectiveSucursal };
}
