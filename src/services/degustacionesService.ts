import {
  Degustacion,
  DegustacionConfig,
  DegustacionCatalogosResponse,
  TurnoDegustacion,
  HorarioSlot,
  Sucursal
} from '../types';
import { getAuthHeaders, getStoredSucursal } from './authService';
import { normalizeSucursal, assertValidSucursal } from '../utils/sucursalScope';

const STORAGE_KEY_PREFIX = 'dashboard_fdv_degustaciones_cache';
const CONFIG_STORAGE_KEY = 'dashboard_fdv_degustaciones_config';

export const DEFAULT_HORARIO_MANANA = '09:00 AM - 01:00 PM';
export const DEFAULT_HORARIO_TARDE = '02:00 PM - 07:00 PM';

export const SUGGESTED_HORARIOS_MANANA = ['09:00 AM - 01:00 PM'];
export const SUGGESTED_HORARIOS_TARDE = ['02:00 PM - 07:00 PM'];

export const HORARIOS_MANANA = ['09:00 AM - 01:00 PM'];
export const HORARIOS_TARDE = ['02:00 PM - 07:00 PM'];

export const DEFAULT_CONFIG: DegustacionConfig = {
  maxPorDia: 18,
  maxPorTurnoManana: 9,
  maxPorTurnoTarde: 9,
  diasBloqueados: [],
  anticipacionMinimaDias: 2
};

const TEST_IDS_TO_EXCLUDE = [
  'deg-001',
  'deg-002',
  'deg-003',
  'deg-mupk8tih-e3wf',
  'deg-muplzpkm-ncuu',
  'test-ping-01'
];

function resolveActiveCacheSucursal(explicit?: Sucursal | null): Sucursal {
  return normalizeSucursal(explicit) || getStoredSucursal() || 'OCCIDENTE';
}

function getStorageKeyForSucursal(sucursal: Sucursal): string {
  return `${STORAGE_KEY_PREFIX}_${sucursal}`;
}

function getLocalCache(sucursal?: Sucursal | null): Degustacion[] {
  const branch = resolveActiveCacheSucursal(sucursal);
  try {
    const raw = localStorage.getItem(getStorageKeyForSucursal(branch));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (d) =>
            d &&
            d.id &&
            !TEST_IDS_TO_EXCLUDE.includes(d.id) &&
            !d.id.startsWith('test-') &&
            (!d.sucursal || normalizeSucursal(d.sucursal) === branch)
        );
      }
    }
  } catch (e) {
    console.warn('Error parsing degustaciones local cache', e);
  }
  return [];
}

function setLocalCache(data: Degustacion[], sucursal?: Sucursal | null) {
  const branch = resolveActiveCacheSucursal(sucursal);
  try {
    const cleanData = data.filter(
      (d) =>
        d &&
        d.id &&
        !TEST_IDS_TO_EXCLUDE.includes(d.id) &&
        !d.id.startsWith('test-') &&
        (!d.sucursal || normalizeSucursal(d.sucursal) === branch)
    );
    localStorage.setItem(getStorageKeyForSucursal(branch), JSON.stringify(cleanData));
  } catch (e) {
    console.warn('Error setting degustaciones local cache', e);
  }
}

export function getLocalConfig(): DegustacionConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const manana = parsed.maxPorTurnoManana !== undefined ? parsed.maxPorTurnoManana : 9;
      const tarde = parsed.maxPorTurnoTarde !== undefined ? parsed.maxPorTurnoTarde : 9;
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        maxPorTurnoManana: manana,
        maxPorTurnoTarde: tarde,
        maxPorDia: manana + tarde
      };
    }
  } catch (e) {
    console.warn('Error reading local config', e);
  }
  return DEFAULT_CONFIG;
}

export function setLocalConfig(config: DegustacionConfig) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Error writing local config', e);
  }
}

/**
 * Carga los catálogos multisede del servidor (`/api/degustaciones/catalogos`):
 * - `clientes`, `rutas` y `vendedores`: estrictamente filtrados a la `sucursal` activa ('CENTRO' | 'OCCIDENTE').
 * - `productos`: catálogo nacional compartido al 100%.
 */
export async function fetchDegustacionCatalogos(
  activeSucursal?: Sucursal | null
): Promise<DegustacionCatalogosResponse | null> {
  const branch = resolveActiveCacheSucursal(activeSucursal);
  try {
    const res = await fetch(`/api/degustaciones/catalogos?sucursal=${encodeURIComponent(branch)}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        ...getAuthHeaders({ activeSucursal: branch })
      }
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (data?.success) {
      return data as DegustacionCatalogosResponse;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Suscribe las degustaciones desde la única fuente de verdad autoritativa (`/api/degustaciones` -> Supabase compartido),
 * aislada estrictamente por `sucursal` ('CENTRO' | 'OCCIDENTE'), sin fugas secundarias de Firestore.
 */
export function subscribeDegustaciones(
  callback: (degustaciones: Degustacion[]) => void,
  activeSucursal?: Sucursal | null
): () => void {
  const branch = resolveActiveCacheSucursal(activeSucursal);
  const initialData = getLocalCache(branch);
  callback(initialData);

  let isActive = true;

  const loadFromServer = () => {
    fetch(`/api/degustaciones?sucursal=${encodeURIComponent(branch)}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        ...getAuthHeaders({ activeSucursal: branch })
      }
    })
      .then(async (res) => {
        if (!isActive || !res.ok) return;
        const json = await res.json().catch(() => null);
        if (isActive && json?.success && Array.isArray(json.data)) {
          const branchFiltered = json.data.filter(
            (d: Degustacion) => !d.sucursal || normalizeSucursal(d.sucursal) === branch
          );
          const sorted = sortDegustacionesOrdenadas(branchFiltered, false);
          setLocalCache(sorted, branch);
          callback(sorted);
        }
      })
      .catch((err) => {
        console.warn('[DEGUSTACIONES] No se pudo consultar /api/degustaciones, manteniendo caché de sede:', err?.message || err);
      });
  };

  loadFromServer();
  const pollTimer = setInterval(loadFromServer, 45_000);

  return () => {
    isActive = false;
    clearInterval(pollTimer);
  };
}

/**
 * Ordenamiento cronológico determinístico para degustaciones
 */
export function sortDegustacionesOrdenadas(list: Degustacion[], ascending: boolean = false): Degustacion[] {
  const shiftRank = (turno?: string, hora?: string): number => {
    const t = String(turno || '').toUpperCase().trim();
    const h = String(hora || '').toUpperCase().trim();
    if (t === 'MAÑANA' || t === 'MANANA' || h.includes('09:') || h.includes('9:') || h.includes('AM')) return 1;
    if (t === 'TARDE' || h.includes('02:') || h.includes('14:') || h.includes('04:') || h.includes('PM')) return 2;
    return 3;
  };

  const toIsoDate = (raw?: string): string => {
    const s = String(raw || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return s;
  };

  return [...list].sort((a, b) => {
    const dateA = toIsoDate(a.fecha);
    const dateB = toIsoDate(b.fecha);
    if (dateA !== dateB) {
      return ascending ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    }

    const rankA = shiftRank(a.turno, a.hora);
    const rankB = shiftRank(b.turno, b.hora);
    if (rankA !== rankB) {
      return ascending ? rankB - rankA : rankA - rankB;
    }

    const vendA = String(a.vendedorNombre || '').toUpperCase().trim();
    const vendB = String(b.vendedorNombre || '').toUpperCase().trim();
    if (vendA !== vendB) {
      return ascending ? vendB.localeCompare(vendA, 'es') : vendA.localeCompare(vendB, 'es');
    }

    const cliA = String(a.clienteNombre || '').toUpperCase().trim();
    const cliB = String(b.clienteNombre || '').toUpperCase().trim();
    if (cliA !== cliB) {
      return ascending ? cliB.localeCompare(cliA, 'es') : cliA.localeCompare(cliB, 'es');
    }

    return ascending
      ? String(b.id || '').localeCompare(String(a.id || ''))
      : String(a.id || '').localeCompare(String(b.id || ''));
  });
}

export const DEFAULT_GOOGLE_SHEETS_WEBHOOK_URL = '';
export const GOOGLE_SHEETS_WEBHOOK_STORAGE_KEY = 'codizulca_sheets_webhook_url';
let memorySheetsWebhookUrl = '';

export function getGoogleSheetsWebhookUrl(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(GOOGLE_SHEETS_WEBHOOK_STORAGE_KEY);
      if (stored) return stored;
    }
  } catch {}
  return (
    memorySheetsWebhookUrl ||
    (import.meta as any).env?.VITE_GOOGLE_SHEETS_WEBHOOK_URL ||
    DEFAULT_GOOGLE_SHEETS_WEBHOOK_URL
  );
}

export function setGoogleSheetsWebhookUrl(url: string): void {
  const clean = (url || '').trim();
  memorySheetsWebhookUrl = clean;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GOOGLE_SHEETS_WEBHOOK_STORAGE_KEY, clean);
    }
  } catch (e) {
    console.warn('Could not save webhook url to localStorage', e);
  }
}

export async function syncToGoogleSheets(degustacion: Degustacion): Promise<boolean> {
  const webhookUrl = getGoogleSheetsWebhookUrl();
  if (!webhookUrl) return false;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'ADD_DEGUSTACION',
        timestamp: new Date().toISOString(),
        id: degustacion.id,
        sucursal: degustacion.sucursal || resolveActiveCacheSucursal(),
        fechaRegistro: degustacion.createdAt || new Date().toISOString(),
        vendedor: degustacion.vendedorNombre,
        ruta: degustacion.ruta || degustacion.vendedorId,
        clienteCodigo: degustacion.clienteCodigo,
        clienteNombre: degustacion.clienteNombre,
        fechaDegustacion: degustacion.fecha,
        turno: degustacion.turno,
        hora: degustacion.hora,
        productos: Array.isArray(degustacion.productos) ? degustacion.productos.join(', ') : degustacion.productos,
        kilosEstimados: degustacion.kilosEstimados,
        personasEstimadas: degustacion.personasEstimadas,
        requierePromotora: degustacion.requierePromotora ? 'SI' : 'NO',
        materialPop: degustacion.materialPop ? 'SI' : 'NO',
        contactoPunto: degustacion.contactoPunto || '',
        telefonoContacto: degustacion.telefonoContacto || '',
        estado: degustacion.estado || 'SOLICITADA',
        promotoraAsignada: degustacion.promotoraAsignada || '',
        notasTradeMarketing: degustacion.notasTradeMarketing || '',
        observaciones: degustacion.observaciones || ''
      })
    });
    return true;
  } catch (err) {
    console.warn('Error enviando a Google Sheets Webhook:', err);
    return false;
  }
}

export const GERENCIA_TRADE_API_URL =
  (import.meta as any).env?.VITE_TRADE_MARKETING_API_URL ||
  (import.meta as any).env?.VITE_GERENCIA_TRADE_API_URL ||
  '';
export const GERENCIA_UTERIO_SURVEYS_URL = (import.meta as any).env?.VITE_GERENCIA_UTERIO_SURVEYS_URL || '';
export const GERENCIA_UTERIO_ANON_KEY = (import.meta as any).env?.VITE_GERENCIA_UTERIO_ANON_KEY || '';
export const GERENCIA_SUPABASE_SURVEYS_URL = (import.meta as any).env?.VITE_GERENCIA_SUPABASE_SURVEYS_URL || '';
export const GERENCIA_SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export function buildTradeMarketingItem(degustacion: Degustacion) {
  const cleanId = String(degustacion.id || '').replace(/^DEG-/, '');
  const recordId = `DEG-${cleanId}`;

  let dmyDate = String(degustacion.fecha || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dmyDate)) {
    const [y, m, d] = dmyDate.split('-');
    dmyDate = `${d}/${m}/${y}`;
  }

  const timeStr =
    degustacion.hora && degustacion.hora.trim()
      ? degustacion.hora.trim()
      : degustacion.turno === 'TARDE'
        ? '02:00 PM - 07:00 PM'
        : '09:00 AM - 01:00 PM';

  const productListStr =
    Array.isArray(degustacion.productos) && degustacion.productos.length > 0
      ? degustacion.productos.join(', ')
      : typeof degustacion.productos === 'string' && degustacion.productos
        ? degustacion.productos
        : 'MORTADELA';

  const vendedorName = String(degustacion.vendedorNombre || 'VENDEDOR COMERCIAL').trim();
  const clientName = String(degustacion.clienteNombre || 'Punto de Venta').trim();
  const zoneName = String(degustacion.ruta || degustacion.vendedorId || vendedorName || 'Ruta Comercial').trim();
  const kilosNum = Number(degustacion.kilosEstimados) || 5;
  const targetNum = Number(degustacion.personasEstimadas) || 150;

  const normEstado = String(degustacion.estado || 'SOLICITADA').toUpperCase().trim();
  let status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' = 'scheduled';
  if (normEstado === 'REALIZADA' || normEstado === 'COMPLETED') status = 'completed';
  else if (normEstado === 'RECHAZADA' || normEstado === 'CANCELADA' || normEstado === 'CANCELLED') status = 'cancelled';

  const rawPromoter = String(degustacion.promotoraAsignada || '').trim();
  const promoter =
    rawPromoter && !rawPromoter.toUpperCase().includes('POR ASIGNAR')
      ? rawPromoter
      : 'POR ASIGNAR (Trade Marketing)';

  const contactPrefix = degustacion.contactoPunto
    ? `Contacto en tienda: ${degustacion.contactoPunto.trim()}${degustacion.telefonoContacto ? ` (${degustacion.telefonoContacto.trim()})` : ''}. `
    : '';
  const obsClean = String(degustacion.observaciones || '').trim();
  const bodyNote = obsClean ? obsClean : `Agendada por ${vendedorName}. Kilos: ${kilosNum}. Personas: ${targetNum}.`;
  const fullComments = `${contactPrefix}${bodyNote}`.trim();
  const normSucursal = normalizeSucursal(degustacion.sucursal);

  return {
    id: recordId,
    ...(normSucursal ? { sucursal: normSucursal } : {}),
    date: dmyDate,
    time: timeStr,
    activity: `Degustación ${productListStr} - Solicitada por ${vendedorName}`,
    product: productListStr,
    promoter,
    promoterRole: 'Impulsadora' as const,
    client: clientName,
    zone: zoneName,
    vendedor: vendedorName,
    source: 'vendedor_app' as const,
    status,
    delivered: Number(degustacion.resultado?.personasAlcanzadas) || (status === 'completed' ? targetNum : 0),
    target: targetNum,
    acceptanceRate: status === 'completed' ? 95 : 0,
    comments: fullComments
  };
}

export function buildGerenciaSurveyPayload(degustacion: Degustacion) {
  const normEstado = (degustacion.estado || 'SOLICITADA').toUpperCase();
  let status = 'Solicitada';
  if (normEstado === 'APROBADA') status = 'Aprobada';
  else if (normEstado === 'RECHAZADA') status = 'Rechazada';
  else if (normEstado === 'CANCELADA') status = 'Cancelada';
  else if (normEstado === 'REALIZADA') status = 'Realizada';

  let shift = 'Mañana (9:00 AM - 1:00 PM)';
  if (degustacion.turno === 'TARDE') shift = 'Tarde (2:00 PM - 7:00 PM)';
  else if (degustacion.turno === 'COMPLETO') shift = 'Día Completo';

  const productListStr = Array.isArray(degustacion.productos)
    ? degustacion.productos.join(', ')
    : degustacion.productos || 'Productos';

  const rawPromoter = String(degustacion.promotoraAsignada || '').trim();
  const promoterAssigned =
    rawPromoter && !rawPromoter.toUpperCase().includes('POR ASIGNAR') ? rawPromoter : '';
  const normSucursal = normalizeSucursal(degustacion.sucursal);

  const commentsObj = {
    isTasting: true,
    source: 'vendedor_app',
    ...(normSucursal ? { sucursal: normSucursal } : {}),
    degustacionId: degustacion.id,
    id: degustacion.id,
    client: degustacion.clienteNombre,
    cliente: degustacion.clienteNombre,
    clienteCodigo: degustacion.clienteCodigo || 'PDV',
    store: degustacion.clienteNombre,
    vendedor: degustacion.vendedorNombre,
    salesRep: degustacion.vendedorNombre,
    promoter: promoterAssigned || 'POR ASIGNAR (Trade Marketing)',
    promotoraAsignada: promoterAssigned,
    ruta: degustacion.ruta || degustacion.vendedorId || '',
    date: degustacion.fecha || new Date().toISOString().split('T')[0],
    turno: degustacion.turno || 'MAÑANA',
    shift: shift,
    time: degustacion.hora || (degustacion.turno === 'MAÑANA' ? '09:00 AM - 01:00 PM' : '02:00 PM - 07:00 PM'),
    products: productListStr,
    product: productListStr,
    kilos: Number(degustacion.kilosEstimados) || 0,
    kg: Number(degustacion.kilosEstimados) || 0,
    personas: Number(degustacion.personasEstimadas) || 0,
    personasEstimadas: Number(degustacion.personasEstimadas) || 0,
    estado: normEstado,
    status: status,
    requierePromotora: Boolean(degustacion.requierePromotora),
    promoterType: degustacion.requierePromotora ? 'Fija' : 'Vendedor / Impulso',
    materialPop: degustacion.materialPop ? 'SI' : 'NO',
    contactoPunto: degustacion.contactoPunto || '',
    telefonoContacto: degustacion.telefonoContacto || '',
    address: `Ruta: ${degustacion.ruta || degustacion.vendedorNombre || ''} | Contacto: ${degustacion.contactoPunto || ''} (${degustacion.telefonoContacto || ''})`,
    notes:
      degustacion.observaciones ||
      `Agendada por ${degustacion.vendedorNombre}. Kilos: ${degustacion.kilosEstimados}. Personas: ${degustacion.personasEstimadas}.`,
    originalComments:
      degustacion.observaciones ||
      `Agendada por ${degustacion.vendedorNombre}. Kilos: ${degustacion.kilosEstimados}. Personas: ${degustacion.personasEstimadas}.`,
    notasTradeMarketing: degustacion.notasTradeMarketing || '',
    resultado: degustacion.resultado || null
  };

  return {
    type: 'Degustacion',
    ...(normSucursal ? { sucursal: normSucursal } : {}),
    date: degustacion.fecha || new Date().toISOString().split('T')[0],
    store: degustacion.clienteNombre,
    promoter: promoterAssigned || degustacion.vendedorNombre || 'Vendedor',
    product: productListStr,
    comments: JSON.stringify(commentsObj)
  };
}

async function upsertSurveyToSupabaseEndpoint(
  url: string,
  apiKey: string,
  degustacionId: string,
  payload: any
): Promise<boolean> {
  if (!url || !apiKey) return false;
  try {
    const cleanId = String(degustacionId).replace(/^DEG-/, '');
    const searchUrl = `${url}?comments=like.*${encodeURIComponent(cleanId)}*&select=id&limit=5`;
    const searchRes = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (searchRes.ok) {
      const records = await searchRes.json();
      if (Array.isArray(records) && records.length > 0 && records[0].id) {
        const updateUrl = `${url}?id=eq.${records[0].id}`;
        const patchRes = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify(payload)
        });
        return patchRes.ok;
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    return res.ok;
  } catch {
    return false;
  }
}

export async function syncToGerenciaDashboard(degustacion: Degustacion): Promise<boolean> {
  try {
    const tradeItem = buildTradeMarketingItem(degustacion);
    const surveyPayload = buildGerenciaSurveyPayload(degustacion);
    const targetTradeUrl = GERENCIA_TRADE_API_URL || 'https://trade-marketing-qi6j.onrender.com/api/degustaciones';

    const [renderOk, uterioOk, nudltOk] = await Promise.all([
      fetch(targetTradeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeItem)
      })
        .then((r) => r.ok)
        .catch(() => false),
      upsertSurveyToSupabaseEndpoint(GERENCIA_UTERIO_SURVEYS_URL, GERENCIA_UTERIO_ANON_KEY, degustacion.id, surveyPayload),
      upsertSurveyToSupabaseEndpoint(GERENCIA_SUPABASE_SURVEYS_URL, GERENCIA_SUPABASE_ANON_KEY, degustacion.id, surveyPayload)
    ]);

    return renderOk || uterioOk || nudltOk;
  } catch (err) {
    console.warn('Error sincronizando con el Dashboard de Gerencia:', err);
    return false;
  }
}

export async function deleteFromGerenciaDashboard(id: string): Promise<boolean> {
  try {
    const cleanId = String(id).replace(/^DEG-/, '');
    const degId = `DEG-${cleanId}`;
    const targetTradeUrl = GERENCIA_TRADE_API_URL || 'https://trade-marketing-qi6j.onrender.com/api/degustaciones';

    const [renderDel, uterioDel, nudltDel] = await Promise.all([
      fetch(`${targetTradeUrl}/${encodeURIComponent(degId)}`, { method: 'DELETE' })
        .then((r) => r.ok)
        .catch(() => false),
      GERENCIA_UTERIO_SURVEYS_URL && GERENCIA_UTERIO_ANON_KEY
        ? fetch(`${GERENCIA_UTERIO_SURVEYS_URL}?comments=like.*${encodeURIComponent(cleanId)}*`, {
            method: 'DELETE',
            headers: {
              apikey: GERENCIA_UTERIO_ANON_KEY,
              Authorization: `Bearer ${GERENCIA_UTERIO_ANON_KEY}`
            }
          })
            .then((r) => r.ok)
            .catch(() => false)
        : Promise.resolve(false),
      GERENCIA_SUPABASE_SURVEYS_URL && GERENCIA_SUPABASE_ANON_KEY
        ? fetch(`${GERENCIA_SUPABASE_SURVEYS_URL}?comments=like.*${encodeURIComponent(cleanId)}*`, {
            method: 'DELETE',
            headers: {
              apikey: GERENCIA_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${GERENCIA_SUPABASE_ANON_KEY}`
            }
          })
            .then((r) => r.ok)
            .catch(() => false)
        : Promise.resolve(false)
    ]);

    return renderDel || uterioDel || nudltDel;
  } catch (err) {
    console.warn('Error eliminando del Dashboard de Gerencia:', err);
    return false;
  }
}

export async function syncAllDegustacionesToGerencia(
  degustaciones: Degustacion[],
  activeSucursal?: Sucursal | null
): Promise<{ success: number; failed: number }> {
  const branch = resolveActiveCacheSucursal(activeSucursal);
  try {
    const res = await fetch('/api/degustaciones/sync-gerencia', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders({ activeSucursal: branch })
      },
      body: JSON.stringify({ degustaciones, sucursal: branch })
    });
    if (res.ok) {
      const data = await res.json();
      return { success: data.total || data.synced || degustaciones.length, failed: 0 };
    }
  } catch (err) {
    console.warn('[TRADE SYNC] Fallback a sincronización cliente directa:', err);
  }

  let success = 0;
  let failed = 0;
  const validDegs = sortDegustacionesOrdenadas(
    degustaciones.filter((d) => d && d.id && !TEST_IDS_TO_EXCLUDE.includes(d.id)),
    true
  );
  for (const d of validDegs) {
    const ok = await syncToGerenciaDashboard(d);
    if (ok) success++;
    else failed++;
  }
  return { success, failed };
}

/**
 * Envía y persiste una degustación hacia Supabase compartido incluyendo explícitamente `sucursal` ('CENTRO' | 'OCCIDENTE').
 */
export async function saveDegustacion(
  degustacion: Degustacion,
  activeSucursal?: Sucursal | null
): Promise<Degustacion> {
  const resolvedSucursal = assertValidSucursal(
    degustacion.sucursal || activeSucursal || getStoredSucursal(),
    'degustacion.sucursal'
  );

  const payload: Degustacion = {
    ...degustacion,
    sucursal: resolvedSucursal
  };

  const response = await fetch('/api/degustaciones', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': payload.id,
      ...getAuthHeaders({ activeSucursal: resolvedSucursal })
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    throw new Error(errBody?.error || `Error HTTP ${response.status} al sincronizar degustación`);
  }

  const resBody = await response.json().catch(() => null);
  const savedRecord: Degustacion = resBody?.data
    ? { ...payload, ...resBody.data, sucursal: normalizeSucursal(resBody.data.sucursal) || resolvedSucursal }
    : payload;

  const current = getLocalCache(resolvedSucursal);
  const index = current.findIndex((d) => d.id === savedRecord.id);
  let updatedList: Degustacion[];
  if (index >= 0) {
    updatedList = [...current];
    updatedList[index] = savedRecord;
  } else {
    updatedList = [savedRecord, ...current];
  }
  setLocalCache(sortDegustacionesOrdenadas(updatedList, false), resolvedSucursal);

  return savedRecord;
}

/**
 * Actualiza el estado o notas de una degustación dentro de la sucursal autorizada
 */
export async function updateDegustacion(
  id: string,
  updates: Partial<Degustacion>,
  activeSucursal?: Sucursal | null
): Promise<void> {
  const branch = resolveActiveCacheSucursal(updates.sucursal || activeSucursal);
  const response = await fetch(`/api/degustaciones/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders({ activeSucursal: branch })
    },
    body: JSON.stringify({ ...updates, sucursal: branch })
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    throw new Error(errBody?.error || `Error HTTP ${response.status} al actualizar degustación`);
  }

  const current = getLocalCache(branch);
  const index = current.findIndex((d) => d.id === id);
  if (index >= 0) {
    const updatedItem = { ...current[index], ...updates, sucursal: branch, updatedAt: new Date().toISOString() };
    current[index] = updatedItem;
    setLocalCache(sortDegustacionesOrdenadas([...current], false), branch);
  }
}

/**
 * Elimina una degustación dentro de la sucursal autorizada
 */
export async function deleteDegustacion(id: string, activeSucursal?: Sucursal | null): Promise<void> {
  const branch = resolveActiveCacheSucursal(activeSucursal);
  const response = await fetch(`/api/degustaciones/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders({ activeSucursal: branch })
    }
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    throw new Error(errBody?.error || `Error HTTP ${response.status} al eliminar degustación`);
  }

  const current = getLocalCache(branch).filter((d) => d.id !== id);
  setLocalCache(current, branch);
}

export function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getWeekRange(dateStr: string): { startStr: string; endStr: string; label: string } {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startStr = formatYMD(monday);
  const endStr = formatYMD(sunday);
  const label = `${monday.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })} al ${sunday.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}`;

  return { startStr, endStr, label };
}

export function getMondayDeadlineForWeek(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const closingMonday = new Date(d);
  closingMonday.setDate(d.getDate() + diffToMonday);
  closingMonday.setHours(17, 0, 0, 0);
  return closingMonday;
}

export function countVendorDegustacionesInWeek(
  vendedorIdOrName: string,
  targetDateStr: string,
  degustaciones: Degustacion[],
  activeSucursal?: Sucursal | null
): number {
  if (!vendedorIdOrName || !targetDateStr) return 0;
  const { startStr, endStr } = getWeekRange(targetDateStr);
  const normTarget = String(vendedorIdOrName).trim().toUpperCase();
  const branch = normalizeSucursal(activeSucursal);

  return degustaciones.filter((d) => {
    if (d.estado === 'RECHAZADA' || d.estado === 'CANCELADA') return false;
    if (branch && d.sucursal && normalizeSucursal(d.sucursal) !== branch) return false;
    if (d.fecha < startStr || d.fecha > endStr) return false;

    const normV = (d.vendedorNombre || d.vendedorId || '').trim().toUpperCase();
    return normV.includes(normTarget) || normTarget.includes(normV);
  }).length;
}

export function getNextAvailableBookingDate(): string {
  const now = new Date();
  for (let i = 0; i < 45; i++) {
    const testDate = new Date();
    testDate.setDate(now.getDate() + i);
    const day = testDate.getDay();
    if (day === 4 || day === 5 || day === 6) {
      const dateStr = formatYMD(testDate);
      const mondayDeadline = getMondayDeadlineForWeek(dateStr);
      if (now.getTime() <= mondayDeadline.getTime()) {
        return dateStr;
      }
    }
  }
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 7);
  while (fallback.getDay() !== 4) {
    fallback.setDate(fallback.getDate() + 1);
  }
  return formatYMD(fallback);
}

/**
 * Verifica la disponibilidad de una fecha específica.
 * Cuando se suministra `activeSucursal`, contabiliza únicamente las reservas de esa sucursal,
 * impidiendo que cupos de OCCIDENTE bloqueen a CENTRO o viceversa.
 */
export function checkDateAvailability(
  dateStr: string,
  degustaciones: Degustacion[],
  config: DegustacionConfig = DEFAULT_CONFIG,
  activeSucursal?: Sucursal | null
): {
  disponible: boolean;
  cuposTotales: number;
  cuposOcupados: number;
  cuposDisponibles: number;
  cuposMananaOcupados: number;
  cuposMananaDisponibles: number;
  cuposTardeOcupados: number;
  cuposTardeDisponibles: number;
  motivo?: string;
  turnosOcupados: TurnoDegustacion[];
  horariosManana: HorarioSlot[];
  horariosTarde: HorarioSlot[];
  degustacionesManana: Degustacion[];
  degustacionesTarde: Degustacion[];
  degustacionesEnFecha: Degustacion[];
} {
  const targetDate = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maxManana = config.maxPorTurnoManana ?? 9;
  const maxTarde = config.maxPorTurnoTarde ?? 9;
  const totalMax = maxManana + maxTarde;
  const branchFilter = normalizeSucursal(activeSucursal);

  const buildHorarios = (
    horasBase: string[],
    turno: TurnoDegustacion,
    degustacionesTurno: Degustacion[],
    bloqueado: boolean
  ): HorarioSlot[] => {
    const maxTurno = turno === 'MAÑANA' ? maxManana : maxTarde;
    const ocupados = degustacionesTurno.length;
    const isShiftAvailable = !bloqueado && ocupados < maxTurno;

    return horasBase.map((h) => ({
      hora: h,
      turno,
      disponible: isShiftAvailable,
      degustacion: degustacionesTurno[0]
    }));
  };

  if (targetDate.getTime() < today.getTime()) {
    return {
      disponible: false,
      cuposTotales: totalMax,
      cuposOcupados: 0,
      cuposDisponibles: 0,
      cuposMananaOcupados: 0,
      cuposMananaDisponibles: 0,
      cuposTardeOcupados: 0,
      cuposTardeDisponibles: 0,
      motivo: 'La fecha ya ha pasado.',
      turnosOcupados: [],
      horariosManana: buildHorarios(HORARIOS_MANANA, 'MAÑANA', [], true),
      horariosTarde: buildHorarios(HORARIOS_TARDE, 'TARDE', [], true),
      degustacionesManana: [],
      degustacionesTarde: [],
      degustacionesEnFecha: []
    };
  }

  const dayOfWeek = targetDate.getDay();
  if (dayOfWeek !== 4 && dayOfWeek !== 5 && dayOfWeek !== 6) {
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return {
      disponible: false,
      cuposTotales: 0,
      cuposOcupados: 0,
      cuposDisponibles: 0,
      cuposMananaOcupados: 0,
      cuposMananaDisponibles: 0,
      cuposTardeOcupados: 0,
      cuposTardeDisponibles: 0,
      motivo: `Las degustaciones solo están habilitadas para los días Jueves, Viernes y Sábados (seleccionaste un ${dayNames[dayOfWeek]}).`,
      turnosOcupados: [],
      horariosManana: buildHorarios(HORARIOS_MANANA, 'MAÑANA', [], true),
      horariosTarde: buildHorarios(HORARIOS_TARDE, 'TARDE', [], true),
      degustacionesManana: [],
      degustacionesTarde: [],
      degustacionesEnFecha: []
    };
  }

  const now = new Date();
  const mondayDeadline = getMondayDeadlineForWeek(dateStr);
  if (now.getTime() > mondayDeadline.getTime()) {
    return {
      disponible: false,
      cuposTotales: totalMax,
      cuposOcupados: 0,
      cuposDisponibles: 0,
      cuposMananaOcupados: 0,
      cuposMananaDisponibles: 0,
      cuposTardeOcupados: 0,
      cuposTardeDisponibles: 0,
      motivo: 'El agendamiento para esta semana cerró el Lunes a las 5:00 PM. Por favor selecciona una fecha de la siguiente semana.',
      turnosOcupados: [],
      horariosManana: buildHorarios(HORARIOS_MANANA, 'MAÑANA', [], true),
      horariosTarde: buildHorarios(HORARIOS_TARDE, 'TARDE', [], true),
      degustacionesManana: [],
      degustacionesTarde: [],
      degustacionesEnFecha: []
    };
  }

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < config.anticipacionMinimaDias) {
    return {
      disponible: false,
      cuposTotales: totalMax,
      cuposOcupados: 0,
      cuposDisponibles: 0,
      cuposMananaOcupados: 0,
      cuposMananaDisponibles: 0,
      cuposTardeOcupados: 0,
      cuposTardeDisponibles: 0,
      motivo: `Se requiere mínimo ${config.anticipacionMinimaDias} días de anticipación para coordinar promotoras y producto con Trade Marketing.`,
      turnosOcupados: [],
      horariosManana: buildHorarios(HORARIOS_MANANA, 'MAÑANA', [], true),
      horariosTarde: buildHorarios(HORARIOS_TARDE, 'TARDE', [], true),
      degustacionesManana: [],
      degustacionesTarde: [],
      degustacionesEnFecha: []
    };
  }

  if (config.diasBloqueados && config.diasBloqueados.includes(dateStr)) {
    return {
      disponible: false,
      cuposTotales: totalMax,
      cuposOcupados: totalMax,
      cuposDisponibles: 0,
      cuposMananaOcupados: maxManana,
      cuposMananaDisponibles: 0,
      cuposTardeOcupados: maxTarde,
      cuposTardeDisponibles: 0,
      motivo: 'Fecha bloqueada por Trade Marketing (Inventario o evento corporativo).',
      turnosOcupados: ['MAÑANA', 'TARDE', 'COMPLETO'],
      horariosManana: buildHorarios(HORARIOS_MANANA, 'MAÑANA', [], true),
      horariosTarde: buildHorarios(HORARIOS_TARDE, 'TARDE', [], true),
      degustacionesManana: [],
      degustacionesTarde: [],
      degustacionesEnFecha: []
    };
  }

  const activeDeg = degustaciones.filter((d) => {
    if (d.fecha !== dateStr) return false;
    if (d.estado === 'CANCELADA' || d.estado === 'RECHAZADA') return false;
    if (branchFilter && d.sucursal && normalizeSucursal(d.sucursal) !== branchFilter) return false;
    return true;
  });

  let cuposMananaOcupados = 0;
  let cuposTardeOcupados = 0;
  const degManana: Degustacion[] = [];
  const degTarde: Degustacion[] = [];

  activeDeg.forEach((d) => {
    if (d.turno === 'MAÑANA') {
      cuposMananaOcupados += 1;
      degManana.push(d);
    } else if (d.turno === 'TARDE') {
      cuposTardeOcupados += 1;
      degTarde.push(d);
    } else if (d.turno === 'COMPLETO') {
      cuposMananaOcupados += 1;
      cuposTardeOcupados += 1;
      degManana.push(d);
      degTarde.push(d);
    }
  });

  const cuposMananaDisponibles = Math.max(0, maxManana - cuposMananaOcupados);
  const cuposTardeDisponibles = Math.max(0, maxTarde - cuposTardeOcupados);
  const cuposOcupados = cuposMananaOcupados + cuposTardeOcupados;
  const cuposDisponibles = cuposMananaDisponibles + cuposTardeDisponibles;

  const turnosOcupados: TurnoDegustacion[] = [];
  if (cuposMananaDisponibles <= 0) turnosOcupados.push('MAÑANA');
  if (cuposTardeDisponibles <= 0) turnosOcupados.push('TARDE');
  if (cuposMananaDisponibles <= 0 && cuposTardeDisponibles <= 0) turnosOcupados.push('COMPLETO');

  const horariosManana = buildHorarios(HORARIOS_MANANA, 'MAÑANA', degManana, false);
  const horariosTarde = buildHorarios(HORARIOS_TARDE, 'TARDE', degTarde, false);

  if (cuposDisponibles <= 0) {
    return {
      disponible: false,
      cuposTotales: totalMax,
      cuposOcupados,
      cuposDisponibles: 0,
      cuposMananaOcupados,
      cuposMananaDisponibles: 0,
      cuposTardeOcupados,
      cuposTardeDisponibles: 0,
      motivo: `Cupo diario agotado (${maxManana} en la mañana y ${maxTarde} en la tarde programados).`,
      turnosOcupados,
      horariosManana,
      horariosTarde,
      degustacionesManana: degManana,
      degustacionesTarde: degTarde,
      degustacionesEnFecha: activeDeg
    };
  }

  return {
    disponible: true,
    cuposTotales: totalMax,
    cuposOcupados,
    cuposDisponibles,
    cuposMananaOcupados,
    cuposMananaDisponibles,
    cuposTardeOcupados,
    cuposTardeDisponibles,
    turnosOcupados,
    horariosManana,
    horariosTarde,
    degustacionesManana: degManana,
    degustacionesTarde: degTarde,
    degustacionesEnFecha: activeDeg
  };
}
