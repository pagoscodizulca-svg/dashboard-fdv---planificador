import { createClient, SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  Role,
  Sucursal,
  TiendaCatalogoItem,
  RutaCatalogoItem,
  VendedorCatalogoItem,
  ProductoNacionalItem
} from '../types';
import {
  normalizeSucursal,
  inferSucursalFromLegacyMetadata,
  validateCrossBranchSubmission
} from '../utils/sucursalScope';
import {
  VENDOR_PROFILES,
  SUPERVISOR_PROFILES,
  getVendorProfile,
  getSupervisorProfile,
  getAllowedRoutesForUser,
  matchesVendorAlias,
  normalizeVendorName,
  normalizeAsciiKey
} from '../utils/vendorRoutes';
import { PRODUCTOS_CODIZULCA } from './productosCodizulca';

export interface TradeSupabaseClients {
  /** Cliente administrativo del backend para catálogos/validación cruzada cuando no hay JWT de Supabase Auth */
  adminClient: SupabaseClient | null;
  url: string;
  anonKey: string;
  jwtSecret: string;
  /** true cuando apunta a una instancia dedicada TRADE_SUPABASE_URL o se exige columna sucursal estricta */
  strictSucursalColumn: boolean;
}

export function createTradeSupabaseClients(env: NodeJS.ProcessEnv = process.env): TradeSupabaseClients {
  const dedicatedUrl = String(env.TRADE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const fallbackUrl = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const url = dedicatedUrl || fallbackUrl;

  const serviceKey = String(
    env.TRADE_SUPABASE_SERVICE_ROLE_KEY ||
    (dedicatedUrl ? env.TRADE_SUPABASE_ANON_KEY : env.SUPABASE_SERVICE_ROLE_KEY) ||
    ''
  ).trim();

  const anonKey = String(
    env.TRADE_SUPABASE_ANON_KEY ||
    (!dedicatedUrl ? env.VITE_SUPABASE_ANON_KEY : '') ||
    serviceKey
  ).trim();

  const jwtSecret = String(env.TRADE_SUPABASE_JWT_SECRET || '').trim();
  const strictSucursalColumn = Boolean(dedicatedUrl) || env.TRADE_STRICT_SUCURSAL === 'true';

  const adminClient =
    url && serviceKey
      ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;

  return {
    adminClient,
    url,
    anonKey,
    jwtSecret,
    strictSucursalColumn
  };
}

/**
 * Construye un cliente Supabase sujeto a políticas Row Level Security (`authenticated`)
 * con claims inmutables en `app_metadata` (`role`, `sucursal`, `vendor_id`, `vendor_name`)
 * cuando `TRADE_SUPABASE_JWT_SECRET` + `TRADE_SUPABASE_ANON_KEY` están configurados.
 * En caso contrario retorna `adminClient` manteniendo todas las guardias explícitas `.eq('sucursal', ...)`.
 */
export function getScopedTradeClient(
  clients: TradeSupabaseClients,
  actor: {
    username: string;
    role: Role | string;
    vendorId: string;
    sucursal: Sucursal;
    supabaseAccessToken?: string;
  }
): SupabaseClient | null {
  if (!clients.url) return null;

  if (actor.supabaseAccessToken && clients.anonKey) {
    return createClient(clients.url, clients.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${actor.supabaseAccessToken}`,
          'X-FDV-Sucursal': actor.sucursal
        }
      }
    });
  }

  if (clients.jwtSecret && clients.anonKey) {
    const nowSec = Math.floor(Date.now() / 1000);
    const rlsJwt = jwt.sign(
      {
        aud: 'authenticated',
        role: 'authenticated',
        sub: `fdv-${normalizeAsciiKey(actor.vendorId || actor.username) || 'user'}`,
        app_metadata: {
          role: String(actor.role).toUpperCase(),
          sucursal: actor.sucursal,
          vendor_id: actor.vendorId,
          vendor_name: actor.username
        },
        iat: nowSec,
        exp: nowSec + 300
      },
      clients.jwtSecret
    );

    return createClient(clients.url, clients.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${rlsJwt}`,
          'X-FDV-Sucursal': actor.sucursal
        }
      }
    });
  }

  return clients.adminClient;
}

function isMissingTableOrColumnError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    /does not exist|schema cache|Could not find the/i.test(msg)
  );
}

export interface AuthenticatedMultisedeUser {
  username: string;
  displayName: string;
  role: Role;
  vendorId: string;
  ruta: string;
  sucursal: Sucursal;
  email?: string;
  source: 'supabase_vendedores' | 'supabase_usuarios' | 'local';
}

async function verifyPasswordOrCedula(rawPwd: string, storedHashOrCedula: string): Promise<boolean> {
  const pwd = String(rawPwd || '').trim();
  const pwdDigits = pwd.replace(/\D/g, '');
  const candidate = String(storedHashOrCedula || '').trim();
  if (!pwd || !candidate) return false;

  if (candidate.startsWith('$2')) {
    if (await bcrypt.compare(pwd, candidate)) return true;
    if (pwdDigits && pwdDigits !== pwd && (await bcrypt.compare(pwdDigits, candidate))) return true;
    return false;
  }

  const candDigits = candidate.replace(/\D/g, '');
  return pwd === candidate || (Boolean(pwdDigits) && Boolean(candDigits) && pwdDigits === candDigits);
}

/**
 * Autentica un vendedor, supervisor o coordinadora contra la tabla `vendedores` / `vendedores_fdv`
 * en Supabase compartido, resolviendo su `sucursal` autoritativa ('CENTRO' | 'OCCIDENTE').
 */
export async function authenticateVendorFromTradeSupabase(
  client: SupabaseClient | null,
  rawUsername: string,
  rawPassword: string
): Promise<{ matched: boolean; validPassword?: boolean; inactive?: boolean; user?: AuthenticatedMultisedeUser }> {
  if (!client) return { matched: false };

  const userUpper = normalizeVendorName(rawUsername);
  const userAscii = normalizeAsciiKey(userUpper);
  if (!userUpper) return { matched: false };

  for (const tableName of ['vendedores', 'vendedores_fdv']) {
    try {
      const { data, error } = await client.from(tableName).select('*');
      if (error) {
        if (isMissingTableOrColumnError(error)) continue;
        break;
      }
      if (!Array.isArray(data) || data.length === 0) continue;

      const found = data.find((r: any) => {
        const candidates = [r.username, r.nombre, r.codigo, r.id, r.vendedor_id]
          .map((v) => normalizeVendorName(v))
          .filter(Boolean);
        return candidates.some((c) => c === userUpper || normalizeAsciiKey(c) === userAscii);
      });

      if (!found) continue;

      if (found.activo === false) {
        return { matched: true, inactive: true };
      }

      const secretField = String(found.password_hash || found.cedula_hash || found.cedula || found.password || found.codigo || '').trim();
      const valid = await verifyPasswordOrCedula(rawPassword, secretField);
      if (!valid) {
        return { matched: true, validPassword: false };
      }

      // Auto-upgrade a bcrypt(12) si la fila tenía cédula sin hashear y existe password_hash
      if (found.password_hash !== undefined && (!found.password_hash || !String(found.password_hash).startsWith('$2'))) {
        const cleanDigits = String(rawPassword).replace(/\D/g, '') || String(rawPassword).trim();
        bcrypt.hash(cleanDigits, 12).then((hash) => {
          client.from(tableName).update({ password_hash: hash }).eq('id', found.id).then(() => {}, () => {});
        }).catch(() => {});
      }

      const sucursal = normalizeSucursal(found.sucursal);
      if (!sucursal) {
        return { matched: false };
      }

      const rawRole = String(found.role || found.rol || 'VENDEDOR').toUpperCase().trim();
      const role: Role =
        rawRole === 'ADMIN' || rawRole === 'SUPERVISOR' || rawRole === 'COORDINADORA'
          ? (rawRole as Role)
          : 'VENDEDOR';

      const canonicalUsername = normalizeVendorName(found.username || found.nombre);
      const vendorId = String(found.id ?? found.codigo ?? found.vendedor_id ?? canonicalUsername).trim();
      const ruta = normalizeVendorName(found.ruta || found.ruta_oficial || canonicalUsername);

      return {
        matched: true,
        validPassword: true,
        user: {
          username: canonicalUsername,
          displayName: String(found.nombre || found.display_name || canonicalUsername).trim(),
          role,
          vendorId,
          ruta,
          sucursal,
          email: found.email ? String(found.email).trim() : undefined,
          source: 'supabase_vendedores'
        }
      };
    } catch {
      continue;
    }
  }

  return { matched: false };
}

/**
 * Carga el catálogo nacional de `public.productos` (SIN filtro de sucursal).
 * Si la tabla aún no existe en un entorno local/legacy, usa el catálogo oficial de 158 SKUs.
 */
export async function fetchProductosNacionales(client: SupabaseClient | null): Promise<ProductoNacionalItem[]> {
  if (client) {
    try {
      const { data, error } = await client.from('productos').select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        return data
          .filter((p: any) => p && p.activo !== false)
          .map((p: any) => {
            const codigo = String(p.codigo ?? p.sku ?? p.id ?? '').trim();
            const nombre = String(p.nombre ?? p.descripcion ?? p.producto ?? codigo).trim().toUpperCase();
            return {
              id: String(p.id ?? codigo),
              codigo: codigo || nombre,
              nombre,
              categoria: p.categoria ? String(p.categoria).trim().toUpperCase() : undefined
            };
          })
          .filter((p) => Boolean(p.nombre))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      }
    } catch {
      // Fallback a catálogo nacional estático
    }
  }

  return PRODUCTOS_CODIZULCA.map((p) => ({
    id: p.codigo,
    codigo: p.codigo,
    nombre: p.descripcion,
    categoria: 'NACIONAL'
  }));
}

/**
 * Carga clientes/tiendas estrictamente delimitados por `sucursal` ('CENTRO' | 'OCCIDENTE').
 * Jamás retorna tiendas de otra sucursal.
 */
export async function fetchClientesPorSucursal(
  client: SupabaseClient | null,
  sucursal: Sucursal,
  actor?: { username: string; role: Role | string; vendorId?: string },
  fallbackOccidenteRows?: Array<Record<string, any>>
): Promise<{ items: TiendaCatalogoItem[]; fromAuthoritativeTable: boolean }> {
  const targetBranch = normalizeSucursal(sucursal) || 'OCCIDENTE';

  if (client) {
    for (const tableName of ['clientes', 'tiendas']) {
      try {
        const { data, error } = await client
          .from(tableName)
          .select('*')
          .eq('sucursal', targetBranch);

        if (error) {
          if (isMissingTableOrColumnError(error)) continue;
          break;
        }

        if (Array.isArray(data)) {
          const activeRows = data.filter((r: any) => {
            if (!r || r.activo === false) return false;
            return normalizeSucursal(r.sucursal) === targetBranch;
          });

          const mapped: TiendaCatalogoItem[] = activeRows
            .map((r: any) => {
              const codigo = String(r.codigo ?? r.cliente_codigo ?? r.id_cliente ?? r.id ?? '').trim();
              const nombre = String(r.nombre ?? r.razon_social ?? r.cliente_nombre ?? r.tienda ?? '').trim().toUpperCase();
              return {
                id: String(r.id ?? codigo),
                codigo: codigo || String(r.id ?? ''),
                nombre,
                rif: r.rif ? String(r.rif).trim() : undefined,
                direccion: r.direccion ? String(r.direccion).trim() : undefined,
                ruta: r.ruta ? String(r.ruta).trim().toUpperCase() : undefined,
                vendedorId: r.vendedor_id !== undefined && r.vendedor_id !== null ? String(r.vendedor_id).trim() : undefined,
                vendedorNombre: r.vendedor_nombre ? String(r.vendedor_nombre).trim().toUpperCase() : undefined,
                sucursal: targetBranch
              };
            })
            .filter((item) => Boolean(item.nombre && item.codigo));

          // Si el usuario es VENDEDOR y el catálogo de esta sucursal asigna vendedor/ruta específica a sus tiendas, filtrar a su cartera;
          // si las tiendas de la sucursal son de cartera abierta de la sede (sin vendedor_id asignado), mostrar las de su sucursal.
          const roleUpper = String(actor?.role || '').toUpperCase();
          if (roleUpper === 'VENDEDOR' && actor?.username) {
            const prof = getVendorProfile(actor.username, targetBranch);
            const aliases = Array.from(
              new Set([
                actor.username,
                actor.vendorId || '',
                prof.canonicalUsername,
                prof.displayName,
                ...prof.routes.flatMap((rt) => [rt.id, ...rt.aliases])
              ].filter(Boolean))
            );
            const hasVendorAssignment = mapped.some((m) => Boolean(m.vendedorId || m.vendedorNombre || m.ruta));
            if (hasVendorAssignment) {
              const vendorOwned = mapped.filter(
                (m) =>
                  matchesVendorAlias(aliases, m.vendedorNombre) ||
                  matchesVendorAlias(aliases, m.vendedorId) ||
                  matchesVendorAlias(aliases, m.ruta)
              );
              if (vendorOwned.length > 0) {
                return {
                  items: vendorOwned.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
                  fromAuthoritativeTable: true
                };
              }
            }
          }

          return {
            items: mapped.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
            fromAuthoritativeTable: true
          };
        }
      } catch {
        continue;
      }
    }
  }

  // Fallback seguro: SOLO para OCCIDENTE si aún no existe `public.clientes` (NUNCA entregar semillas de Occidente a CENTRO)
  if (targetBranch === 'OCCIDENTE' && Array.isArray(fallbackOccidenteRows) && fallbackOccidenteRows.length > 0) {
    const seen = new Map<string, TiendaCatalogoItem>();
    const roleUpper = String(actor?.role || '').toUpperCase();
    const prof = actor?.username ? getVendorProfile(actor.username, 'OCCIDENTE') : null;
    const aliases = prof
      ? [
          actor!.username,
          actor?.vendorId || '',
          prof.canonicalUsername,
          prof.displayName,
          ...prof.routes.flatMap((rt) => [rt.id, ...rt.aliases])
        ].filter(Boolean)
      : [];

    for (const raw of fallbackOccidenteRows) {
      const rowSuc = inferSucursalFromLegacyMetadata(raw.sucursal, raw.zona || raw.region);
      if (rowSuc !== 'OCCIDENTE') continue;

      const vId = String(raw.vendedorId ?? raw.vendedor_id ?? '').trim();
      const vName = String(raw.vendedorNombre ?? raw.vendedor_nombre ?? vId).trim();
      if (roleUpper === 'VENDEDOR' && aliases.length > 0) {
        if (!matchesVendorAlias(aliases, vName) && !matchesVendorAlias(aliases, vId)) {
          continue;
        }
      }

      const codigo = String(raw.id ?? raw.cliente_codigo ?? raw.codigo ?? '').replace(/#\d+$/, '').trim();
      const nombre = String(raw.cliente ?? raw.cliente_nombre ?? raw.nombre ?? '').trim().toUpperCase();
      if (!codigo || !nombre) continue;

      const key = `${codigo.toUpperCase()}::${nombre}`;
      if (!seen.has(key)) {
        seen.set(key, {
          id: codigo,
          codigo,
          nombre,
          ruta: vId || vName,
          vendedorId: vId,
          vendedorNombre: vName.toUpperCase(),
          sucursal: 'OCCIDENTE'
        });
      }
    }
    return {
      items: Array.from(seen.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      fromAuthoritativeTable: false
    };
  }

  return { items: [], fromAuthoritativeTable: false };
}

/**
 * Carga rutas comerciales estrictamente delimitadas por `sucursal`.
 */
export async function fetchRutasPorSucursal(
  client: SupabaseClient | null,
  sucursal: Sucursal,
  actor?: { username: string; role: Role | string }
): Promise<RutaCatalogoItem[]> {
  const targetBranch = normalizeSucursal(sucursal) || 'OCCIDENTE';

  if (client) {
    try {
      const { data, error } = await client
        .from('rutas')
        .select('*')
        .eq('sucursal', targetBranch);

      if (!error && Array.isArray(data) && data.length > 0) {
        const list = data
          .filter((r: any) => r && r.activo !== false && normalizeSucursal(r.sucursal) === targetBranch)
          .map((r: any) => ({
            id: String(r.id ?? r.codigo ?? r.nombre).trim(),
            codigo: String(r.codigo ?? r.id ?? r.nombre).trim().toUpperCase(),
            nombre: String(r.nombre ?? r.codigo ?? r.id).trim().toUpperCase(),
            supervisor: r.supervisor ? String(r.supervisor).trim().toUpperCase() : undefined,
            sucursal: targetBranch
          }));

        if (String(actor?.role || '').toUpperCase() === 'VENDEDOR' && actor?.username) {
          const prof = getVendorProfile(actor.username, targetBranch);
          const aliases = [actor.username, prof.canonicalUsername, ...prof.routes.flatMap((rt) => [rt.id, ...rt.aliases])];
          const own = list.filter((r) => matchesVendorAlias(aliases, r.nombre) || matchesVendorAlias(aliases, r.codigo));
          if (own.length > 0) return own;
        }
        return list;
      }
    } catch {
      // Fallback a perfiles en memoria filtrados por sucursal
    }
  }

  const allowed = getAllowedRoutesForUser(
    actor?.username || 'ADMIN',
    (actor?.role as Role) || 'ADMIN',
    targetBranch
  );
  return allowed.map((r) => ({
    id: r.id,
    codigo: r.id,
    nombre: r.label,
    sucursal: targetBranch
  }));
}

/**
 * Carga vendedores FDV estrictamente delimitados por `sucursal`.
 */
export async function fetchVendedoresPorSucursal(
  client: SupabaseClient | null,
  sucursal: Sucursal,
  actor?: { username: string; role: Role | string }
): Promise<VendedorCatalogoItem[]> {
  const targetBranch = normalizeSucursal(sucursal) || 'OCCIDENTE';

  if (client) {
    for (const tableName of ['vendedores', 'vendedores_fdv']) {
      try {
        const { data, error } = await client
          .from(tableName)
          .select('*')
          .eq('sucursal', targetBranch);

        if (error) {
          if (isMissingTableOrColumnError(error)) continue;
          break;
        }

        if (Array.isArray(data) && data.length > 0) {
          const items: VendedorCatalogoItem[] = data
            .filter((v: any) => v && v.activo !== false && normalizeSucursal(v.sucursal) === targetBranch)
            .map((v: any) => {
              const rawRole = String(v.role || v.rol || 'VENDEDOR').toUpperCase().trim();
              const role: Role =
                rawRole === 'ADMIN' || rawRole === 'SUPERVISOR' || rawRole === 'COORDINADORA'
                  ? (rawRole as Role)
                  : 'VENDEDOR';
              const username = normalizeVendorName(v.username || v.nombre);
              return {
                id: String(v.id ?? v.codigo ?? username),
                codigo: v.codigo ? String(v.codigo).trim() : undefined,
                username,
                nombre: String(v.nombre || v.display_name || username).trim(),
                ruta: v.ruta ? String(v.ruta).trim().toUpperCase() : undefined,
                supervisor: v.supervisor ? String(v.supervisor).trim().toUpperCase() : undefined,
                role,
                sucursal: targetBranch
              };
            });

          if (String(actor?.role || '').toUpperCase() === 'VENDEDOR' && actor?.username) {
            return items.filter((v) => matchesVendorAlias([actor.username], v.username) || matchesVendorAlias([actor.username], v.nombre));
          }
          return items;
        }
      } catch {
        continue;
      }
    }
  }

  // Fallback seguro: perfiles en memoria pertenecientes exclusivamente a targetBranch
  const seen = new Set<string>();
  const list: VendedorCatalogoItem[] = [];
  for (const prof of Object.values(VENDOR_PROFILES)) {
    if (seen.has(prof.canonicalUsername)) continue;
    seen.add(prof.canonicalUsername);
    if ((prof.sucursal || 'OCCIDENTE') !== targetBranch) continue;
    if (
      String(actor?.role || '').toUpperCase() === 'VENDEDOR' &&
      actor?.username &&
      !matchesVendorAlias([actor.username], prof.canonicalUsername)
    ) {
      continue;
    }
    list.push({
      id: prof.canonicalUsername,
      username: prof.canonicalUsername,
      nombre: prof.displayName,
      ruta: prof.routes[0]?.id || prof.canonicalUsername,
      role: 'VENDEDOR',
      sucursal: targetBranch
    });
  }
  return list.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/**
 * Busca la sucursal real de una tienda en todo el catálogo global (CENTRO + OCCIDENTE)
 * para detectar y bloquear intentos de un vendedor de CENTRO seleccionando tiendas de OCCIDENTE o viceversa.
 */
export async function lookupStoreGlobalSucursal(
  client: SupabaseClient | null,
  clienteCodigo: string,
  clienteNombre: string
): Promise<{
  authoritativeCatalogActive: boolean;
  found: boolean;
  sucursal: Sucursal | null;
  codigo?: string;
  nombre?: string;
  ruta?: string;
}> {
  const cleanCode = String(clienteCodigo || '').replace(/^[#\s]+/, '').replace(/^c-/i, '').trim().toUpperCase();
  const cleanName = String(clienteNombre || '').trim().toUpperCase();

  if (client) {
    for (const tableName of ['clientes', 'tiendas']) {
      try {
        const { data, error } = await client.from(tableName).select('*');
        if (error) {
          if (isMissingTableOrColumnError(error)) continue;
          break;
        }
        if (!Array.isArray(data) || data.length === 0) continue;

        const activeRows = data.filter((r: any) => r && r.activo !== false);
        if (activeRows.length === 0) continue;

        const match = activeRows.find((r: any) => {
          const rCode = String(r.codigo ?? r.cliente_codigo ?? r.id_cliente ?? r.id ?? '')
            .replace(/^[#\s]+/, '')
            .replace(/^c-/i, '')
            .trim()
            .toUpperCase();
          const rName = String(r.nombre ?? r.razon_social ?? r.cliente_nombre ?? r.tienda ?? '').trim().toUpperCase();
          if (cleanCode && cleanCode !== 'PDV' && rCode && (rCode === cleanCode || rCode.replace(/^0+/, '') === cleanCode.replace(/^0+/, ''))) {
            return true;
          }
          if (cleanName && rName && rName === cleanName) {
            return true;
          }
          return false;
        });

        if (!match) {
          return { authoritativeCatalogActive: true, found: false, sucursal: null };
        }

        return {
          authoritativeCatalogActive: true,
          found: true,
          sucursal: normalizeSucursal(match.sucursal),
          codigo: String(match.codigo ?? match.cliente_codigo ?? match.id ?? cleanCode).trim(),
          nombre: String(match.nombre ?? match.razon_social ?? match.cliente_nombre ?? cleanName).trim().toUpperCase(),
          ruta: match.ruta ? String(match.ruta).trim().toUpperCase() : undefined
        };
      } catch {
        continue;
      }
    }
  }

  return { authoritativeCatalogActive: false, found: false, sucursal: null };
}

/**
 * Busca la sucursal real de un vendedor en todo el catálogo global (CENTRO + OCCIDENTE).
 */
export async function lookupVendorGlobalSucursal(
  client: SupabaseClient | null,
  vendedorIdOrName: string
): Promise<{ found: boolean; sucursal: Sucursal | null; canonicalName?: string; vendorId?: string; primaryRoute?: string }> {
  const clean = normalizeVendorName(vendedorIdOrName);
  const ascii = normalizeAsciiKey(clean);
  if (!clean || clean === 'ADMIN' || clean === 'GERENCIA TRADE MARKETING') {
    return { found: false, sucursal: null };
  }

  if (client) {
    for (const tableName of ['vendedores', 'vendedores_fdv']) {
      try {
        const { data, error } = await client.from(tableName).select('*');
        if (error) {
          if (isMissingTableOrColumnError(error)) continue;
          break;
        }
        if (!Array.isArray(data) || data.length === 0) continue;

        const match = data.find((v: any) => {
          if (!v || v.activo === false) return false;
          const candidates = [v.username, v.nombre, v.codigo, v.id, v.ruta]
            .map((x) => normalizeVendorName(x))
            .filter(Boolean);
          return candidates.some((c) => c === clean || normalizeAsciiKey(c) === ascii);
        });

        if (match) {
          return {
            found: true,
            sucursal: normalizeSucursal(match.sucursal),
            canonicalName: normalizeVendorName(match.username || match.nombre),
            vendorId: String(match.id ?? match.codigo ?? match.username).trim(),
            primaryRoute: normalizeVendorName(match.ruta || match.username || match.nombre)
          };
        }
      } catch {
        continue;
      }
    }
  }

  // Verificar supervisores o vendedores en memoria
  const sup = getSupervisorProfile(clean);
  if (sup) {
    return {
      found: true,
      sucursal: sup.sucursal || 'OCCIDENTE',
      canonicalName: sup.canonicalUsername,
      vendorId: sup.canonicalUsername,
      primaryRoute: sup.canonicalUsername
    };
  }

  const knownInMemory =
    VENDOR_PROFILES[clean] ||
    Object.values(VENDOR_PROFILES).find(
      (p) =>
        normalizeAsciiKey(p.canonicalUsername) === ascii ||
        normalizeAsciiKey(p.displayName) === ascii ||
        p.routes.some((r) => matchesVendorAlias([r.id, ...r.aliases], clean))
    );

  if (knownInMemory) {
    return {
      found: true,
      sucursal: knownInMemory.sucursal || 'OCCIDENTE',
      canonicalName: knownInMemory.canonicalUsername,
      vendorId: knownInMemory.routes[0]?.id || knownInMemory.canonicalUsername,
      primaryRoute: knownInMemory.routes[0]?.id || knownInMemory.canonicalUsername
    };
  }

  return { found: false, sucursal: null };
}

export { validateCrossBranchSubmission };
