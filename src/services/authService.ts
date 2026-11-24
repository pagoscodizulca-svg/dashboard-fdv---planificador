import { Role, Sucursal } from '../types';
import { normalizeSucursal } from '../utils/sucursalScope';

export interface AuthUser {
  username: string;
  role: Role;
  vendorId: string;
  sucursal?: Sucursal;
  ruta?: string;
}

const TOKEN_KEY = 'dashboard_fdv_token';
const ROLE_KEY = 'dashboard_fdv_role';
const VENDOR_KEY = 'dashboard_fdv_vendor';
const VENDOR_ID_KEY = 'dashboard_fdv_vendor_id';
const ROUTE_KEY = 'dashboard_fdv_active_route';
const SUCURSAL_KEY = 'dashboard_fdv_sucursal';
const LOGGED_IN_KEY = 'dashboard_fdv_logged_in';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredSucursal(): Sucursal | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return normalizeSucursal(localStorage.getItem(SUCURSAL_KEY));
  } catch {
    return null;
  }
}

export function setStoredSucursal(sucursal: Sucursal): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const norm = normalizeSucursal(sucursal);
    if (norm) {
      localStorage.setItem(SUCURSAL_KEY, norm);
    }
  } catch {
    // ignore storage errors
  }
}

export function getAuthHeaders(options?: { activeSucursal?: Sucursal | null }): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (options?.activeSucursal) {
    const norm = normalizeSucursal(options.activeSucursal);
    if (norm) {
      headers['X-Active-Sucursal'] = norm;
    }
  }
  return headers;
}

export function getStoredAuthIdentity(): {
  username: string;
  role: string;
  vendorId: string;
  route: string;
  sucursal: Sucursal | null;
} | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const username = localStorage.getItem(VENDOR_KEY) || '';
    const role = localStorage.getItem(ROLE_KEY) || '';
    const vendorId = localStorage.getItem(VENDOR_ID_KEY) || '';
    const route = localStorage.getItem(ROUTE_KEY) || '';
    const sucursal = normalizeSucursal(localStorage.getItem(SUCURSAL_KEY));
    if (!username && !role && !vendorId) return null;
    return { username, role, vendorId, route, sucursal };
  } catch {
    return null;
  }
}

export function saveAuthSession(token: string, user: AuthUser, initialRoute?: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(LOGGED_IN_KEY, 'true');
  localStorage.setItem(ROLE_KEY, user.role);
  localStorage.setItem(VENDOR_KEY, user.username);
  if (user.vendorId !== undefined && user.vendorId !== null) {
    localStorage.setItem(VENDOR_ID_KEY, String(user.vendorId));
  }
  if (user.sucursal) {
    const normSuc = normalizeSucursal(user.sucursal);
    if (normSuc) {
      localStorage.setItem(SUCURSAL_KEY, normSuc);
    }
  }
  if (initialRoute) {
    localStorage.setItem(ROUTE_KEY, initialRoute);
  }
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LOGGED_IN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(VENDOR_KEY);
  localStorage.removeItem(VENDOR_ID_KEY);
  localStorage.removeItem(ROUTE_KEY);
  localStorage.removeItem(SUCURSAL_KEY);
  // Purgar cachés de degustaciones legacy sin partición de sucursal
  localStorage.removeItem('dashboard_fdv_degustaciones_cache');
}

export async function verifyServerSession(): Promise<{ valid: boolean; user?: AuthUser }> {
  const token = getAuthToken();
  if (!token) {
    clearAuthSession();
    return { valid: false };
  }

  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      clearAuthSession();
      return { valid: false };
    }

    const data = await res.json();
    if (data?.success && data?.user) {
      // Re-sincronizar los valores locales con la verdad criptográfica del servidor
      localStorage.setItem(ROLE_KEY, data.user.role);
      localStorage.setItem(VENDOR_KEY, data.user.username);
      if (data.user.vendorId !== undefined && data.user.vendorId !== null) {
        localStorage.setItem(VENDOR_ID_KEY, String(data.user.vendorId));
      }
      const serverSucursal = normalizeSucursal(data.user.sucursal);
      if (serverSucursal) {
        localStorage.setItem(SUCURSAL_KEY, serverSucursal);
      }
      localStorage.setItem(LOGGED_IN_KEY, 'true');
      return { valid: true, user: data.user };
    }

    clearAuthSession();
    return { valid: false };
  } catch (err) {
    console.warn('[AUTH] Error verificando sesión en servidor:', err);
    // Si no hay red pero el token existe, se asume temporalmente válido
    return { valid: true };
  }
}
