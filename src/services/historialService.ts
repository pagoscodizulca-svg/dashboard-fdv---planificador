import { getAuthHeaders, DEFAULT_SHEETS_CACHE_TTL_MS } from './googleSheetsService';
import { RubroCodigo, categoriaARubroCodigo } from '../lib/rubros';

export interface HistPeriodo { ano: number; mes: number }

export interface HistVolumenRow {
  ano: number; mes: number; sku: string; articulo: string; rubro: string;
  cajas: number; unidades: number; kgs: number; monto: number; clientes: number;
}

export interface HistRubroMes {
  ano: number; mes: number;
  kgs: Record<string, number>; cajas: Record<string, number>; monto: Record<string, number>;
  activos: Record<string, number>;
  clientesConMovimiento: number; fueraCartera: number;
}

export interface HistClienteRow {
  id: string; cliente: string; vendedor: string; enCartera: boolean;
  cajas: Record<string, number>; kgs: number; monto: number;
}

export interface HistClienteDetalle {
  meses: { ano: number; mes: number; cliente: string; vendedor: string; cajas: Record<string, number>; kgs: number; monto: number }[];
  productos: { ano: number; mes: number; sku: string; articulo: string; rubro: string; cajas: number; kgs: number; monto: number }[];
}

export interface Rubro360Mes {
  ano: number;
  mes: number;
  clientesActivados: number;
  clientesEnCartera: number;
  clientesFueraCartera: number;
  porcentajeCartera: number;
  variacionClientes: number | null;
  variacionPct: number | null;
  cajas: number;
  unidades: number;
  kgs: number;
  skusActivos: number;
  kgsPorCliente: number;
  /** Meta solicitada para ese mes si fue registrada; null = no hay meta guardada de ese mes. */
  meta: number | null;
}

export interface Rubro360MetaMes {
  periodo: string;
  ano: number;
  mes: number;
  meta: number;
  activados: number;
}

export interface Rubro360Sku {
  sku: string;
  articulo: string;
  totalCajas: number;
  totalUnidades: number;
  totalKgs: number;
  clientesUnicos: number;
  mesesActivos: number;
  porMes: Record<string, { cajas: number; kgs: number; clientes: number }>;
}

export type EstadoClienteRubro360 =
  | 'REACTIVADO_ESTE_MES'
  | 'NUEVO_ESTE_MES'
  | 'OPORTUNIDAD_RECUPERACION'
  | 'SIN_HISTORIAL'
  | 'FUERA_CARTERA';

export interface Rubro360Cliente {
  id: string;
  cliente: string;
  vendedor: string;
  enCartera: boolean;
  activoMesActual: boolean;
  mesesActivados: number;
  totalMesesDisponibles: number;
  frecuenciaPct: number;
  ultimoMesCompra: { ano: number; mes: number } | null;
  totalCajas: number;
  totalKgs: number;
  estado360: EstadoClienteRubro360;
  porMes: Record<string, { cajas: number; kgs: number; activo: boolean }>;
}

export interface Rubro360Data {
  rubro: RubroCodigo;
  /** Meses visibles según el filtro aplicado. */
  periodos: HistPeriodo[];
  /** Todos los meses con historial (para armar el filtro de fechas). */
  periodosDisponibles: HistPeriodo[];
  carteraTotal: number;
  activadosMesActual: number;
  metaMesActual: number;
  periodoMetaActual: string | null;
  metasPorMes: Rubro360MetaMes[];
  meses: Rubro360Mes[];
  skus: Rubro360Sku[];
  clientes: Rubro360Cliente[];
  resumen: {
    totalMeses: number;
    promedioClientesMes: number;
    promedioCajasMes: number;
    promedioKgsMes: number;
    mejorMes: { ano: number; mes: number; clientesActivados: number; kgs: number; cajas: number } | null;
    peorMes: { ano: number; mes: number; clientesActivados: number; kgs: number; cajas: number } | null;
    totalCajasHistorico: number;
    totalKgsHistorico: number;
    clientesUnicosHistorico: number;
    clientesHabituales: number;
    oportunidadRecuperacion: number;
    reactivadosEsteMes: number;
    nuevosEsteMes: number;
  };
}

export function categoryToRubroCode(cat: string): RubroCodigo {
  return categoriaARubroCodigo(cat);
}

export class HistorialError extends Error {
  code?: string;
  constructor(message: string, code?: string) { super(message); this.code = code; }
}

export interface HistorialFetchOptions {
  forceRefresh?: boolean;
  signal?: AbortSignal;
  ttlMs?: number;
}

const histCache = new Map<string, { data: unknown; savedAt: number }>();
const histInFlight = new Map<string, { promise: Promise<unknown>; controller: AbortController; listeners: number }>();

export function clearHistorialCache(): void {
  histCache.clear();
}

const createHistAbortError = (): Error => {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Consulta de historial cancelada.', 'AbortError');
  }
  const err = new Error('Consulta de historial cancelada.');
  err.name = 'AbortError';
  return err;
};

async function getJSON<T>(url: string, options: HistorialFetchOptions = {}): Promise<T> {
  const { forceRefresh = false, signal, ttlMs = DEFAULT_SHEETS_CACHE_TTL_MS } = options;
  if (signal?.aborted) {
    throw createHistAbortError();
  }

  if (!forceRefresh) {
    const cached = histCache.get(url);
    if (cached && Date.now() - cached.savedAt < ttlMs) {
      return cached.data as T;
    }
    if (cached) {
      histCache.delete(url);
    }
  }

  const attachSignal = (entry: { promise: Promise<unknown>; controller: AbortController; listeners: number }): Promise<T> => {
    if (!signal) return entry.promise as Promise<T>;
    entry.listeners++;
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const onAbort = () => {
        if (settled) return;
        settled = true;
        entry.listeners = Math.max(0, entry.listeners - 1);
        if (entry.listeners === 0) entry.controller.abort();
        reject(createHistAbortError());
      };
      signal.addEventListener('abort', onAbort, { once: true });
      entry.promise.then(
        (val) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', onAbort);
          resolve(val as T);
        },
        (err) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', onAbort);
          reject(err);
        }
      );
    });
  };

  const existing = histInFlight.get(url);
  if (existing && !forceRefresh) {
    return attachSignal(existing);
  }

  const controller = new AbortController();
  const promise = (async () => {
    try {
      const res = await fetch(url, { headers: getAuthHeaders(), signal: controller.signal });
      let body: any = null;
      try { body = await res.json(); } catch { /* respuesta vacía */ }
      if (!res.ok) throw new HistorialError(body?.error || `Error ${res.status} consultando el historial`, body?.code);
      histCache.set(url, { data: body, savedAt: Date.now() });
      return body as T;
    } finally {
      histInFlight.delete(url);
    }
  })();

  const entry = { promise, controller, listeners: signal ? 0 : 1 };
  histInFlight.set(url, entry);
  return attachSignal(entry);
}

const v = (vendedor?: string) => (vendedor ? `vendedor=${encodeURIComponent(vendedor)}` : '');

export const fetchHistMeta = (options?: HistorialFetchOptions) =>
  getJSON<{ periodos: HistPeriodo[] }>('/api/historial/meta', options);
export const fetchHistVolumen = (vendedor?: string, options?: HistorialFetchOptions) =>
  getJSON<{ rows: HistVolumenRow[] }>(`/api/historial/volumen?${v(vendedor)}`, options);
export const fetchHistRubros = (vendedor?: string, options?: HistorialFetchOptions) =>
  getJSON<{ meses: HistRubroMes[]; cartera: number }>(`/api/historial/rubros?${v(vendedor)}`, options);
export const fetchHistClientes = (ano: number, mes: number, vendedor?: string, options?: HistorialFetchOptions) =>
  getJSON<{ rows: HistClienteRow[] }>(`/api/historial/clientes?ano=${ano}&mes=${mes}&${v(vendedor)}`, options);
export const fetchHistCliente = (id: string, vendedor?: string, options?: HistorialFetchOptions) =>
  getJSON<HistClienteDetalle>(`/api/historial/cliente/${encodeURIComponent(id)}?${v(vendedor)}`, options);
export const fetchHistRubro360 = (rubro: RubroCodigo, vendedor?: string, meses: string[] = [], options?: HistorialFetchOptions) =>
  getJSON<Rubro360Data>(
    `/api/historial/rubro-360?rubro=${encodeURIComponent(rubro)}&${v(vendedor)}${meses.length ? `&meses=${encodeURIComponent(meses.join(','))}` : ''}`,
    options
  );
