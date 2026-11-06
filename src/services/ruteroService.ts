import { RUBROS_ACTIVOS_CONFIG } from '../lib/rubros';
import {
  AsignacionClienteRuta,
  ClienteRutaEnriquecido,
  DiaSemanaRuta,
  EstadoVisitaRuta,
  MotivoNoVentaRuta,
  PrioridadRutaCliente,
  RegistroVisitaRuta,
  ResumenJornadaRuta
} from '../types';
import { getAuthHeaders } from './authService';

export const ASIGNACIONES_STORAGE_KEY = 'fdv_rutero_asignaciones_v1';
export const VISITAS_STORAGE_KEY = 'fdv_rutero_visitas_v1';
export const MANUAL_RUBROS_STORAGE_KEY = 'fdv_manual_rubros_v1';

export const DIAS_SEMANA_RUTA: Array<{
  id: DiaSemanaRuta;
  label: string;
  short: string;
  jsDay: number;
}> = [
  { id: 'LUNES', label: 'Lunes', short: 'L', jsDay: 1 },
  { id: 'MARTES', label: 'Martes', short: 'M', jsDay: 2 },
  { id: 'MIERCOLES', label: 'Miércoles', short: 'Mi', jsDay: 3 },
  { id: 'JUEVES', label: 'Jueves', short: 'J', jsDay: 4 },
  { id: 'VIERNES', label: 'Viernes', short: 'V', jsDay: 5 },
  { id: 'SABADO', label: 'Sábado', short: 'S', jsDay: 6 }
];

export const DIAS_HABILES_AUTO_DISTRIBUCION: DiaSemanaRuta[] = [
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES'
];

/**
 * Rubros estratégicos del mes = rubros ACTIVOS de la configuración central (src/lib/rubros.ts).
 * Los elementos son las claves de categoría de servidor de cada rubro (no los nombres comerciales).
 */
export const RUBROS_ESTRATEGICOS_5: readonly string[] = RUBROS_ACTIVOS_CONFIG.map((r) => r.categoriaServidor);

/** Nombre comercial a mostrar por clave de categoría (chips, tooltips, listados). */
export const RUBRO_SHORT_LABELS: Record<string, string> = Object.fromEntries(
  RUBROS_ACTIVOS_CONFIG.map((r) => [r.categoriaServidor, r.label])
);

export const MOTIVOS_NO_VENTA_RUTA: Array<{
  id: MotivoNoVentaRuta;
  label: string;
}> = [
  { id: 'INVENTARIO_ALTO', label: 'Con inventario alto / stock suficiente' },
  { id: 'SIN_CUPO_CREDITO', label: 'Sin cupo de crédito / factura pendiente' },
  { id: 'ENCARGADO_AUSENTE', label: 'Encargado de compras ausente' },
  { id: 'LOCAL_CERRADO', label: 'Local cerrado en horario de visita' },
  { id: 'PRECIO_COMPETENCIA', label: 'Diferencia de precio / competencia' },
  { id: 'OTRO', label: 'Otro motivo comercial' }
];

/**
 * Obtiene el día de la semana correspondiente para el rutero (Lunes a Sábado).
 * Si hoy es domingo (0), retorna 'LUNES' para preparar la jornada siguiente.
 */
export function getDiaSemanaActualRuta(date: Date = new Date()): DiaSemanaRuta {
  const day = date.getDay();
  switch (day) {
    case 1:
      return 'LUNES';
    case 2:
      return 'MARTES';
    case 3:
      return 'MIERCOLES';
    case 4:
      return 'JUEVES';
    case 5:
      return 'VIERNES';
    case 6:
      return 'SABADO';
    default:
      return 'LUNES';
  }
}

/**
 * Genera una clave única y estable para cada cliente dentro de su ruta/vendedor.
 */
export function normalizarClaveClienteRuta(
  clienteId?: string,
  clienteNombre?: string,
  vendedorId?: string
): string {
  const cleanId = String(clienteId || '')
    .replace(/^[#\s]+/, '')
    .trim()
    .toUpperCase();
  const cleanName = String(clienteNombre || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  const cleanVend = String(vendedorId || '')
    .trim()
    .toUpperCase();

  const base = cleanId || cleanName || 'SIN_ID';
  return cleanVend ? `${cleanVend}::${base}` : base;
}

/**
 * Extrae los rubros activos de un registro de activación aplicando overrides manuales si existen.
 */
export function extraerRubrosActivosRecord(
  a: any,
  existingSet?: Set<string>,
  manualOverrides?: Record<string, Record<string, boolean | undefined>>
): Set<string> {
  const rubros = existingSet ? new Set(existingSet) : new Set<string>();
  if (!a) return rubros;

  // Alias de claves antiguas que aún pueden venir en el payload (compatibilidad)
  const aliasCats: Record<string, string[]> = { AZUCAR: ['AZÚCAR'], ESTANDAR_ASTURIAS: ['ENTERO'], SALPICAO: ['LIGEROS'] };

  for (const r of RUBROS_ACTIVOS_CONFIG) {
    const claves = [r.codigo, ...(aliasCats[r.codigo] || [])];
    if (claves.some((k) => Boolean(a.cats?.[k])) || (Number(a.cajas?.[r.codigo]) || 0) > 0) {
      rubros.add(r.categoriaServidor);
    }
  }

  const key = a.id
    ? String(a.id).replace(/^[#\s]+/, '').trim()
    : String(a.cliente || '').trim();
  const ov = key && manualOverrides ? manualOverrides[key] : undefined;
  if (ov) {
    for (const r of RUBROS_ACTIVOS_CONFIG) {
      if (ov[r.codigo] === true) rubros.add(r.categoriaServidor);
      else if (ov[r.codigo] === false) rubros.delete(r.categoriaServidor);
    }
  }

  return rubros;
}

/**
 * Calcula la prioridad comercial de visita según la brecha de los 5 rubros estratégicos:
 * 1º ALTA_INACTIVO (100 pts): Cliente con 0 rubros (urgencia máxima de activación).
 * 2º ALTA_CIERRE_5 (83-84 pts): Cliente con 3 o 4 rubros (a solo 1-2 rubros del 5/5).
 * 3º MEDIA_DESARROLLO (51-52 pts): Cliente con 1 o 2 rubros activos.
 * 4º CUMPLIDO_5 (20 pts): Cliente con los 5 rubros ya activados en el mes.
 */
export function calcularPrioridadVisita(
  totalRubrosActivos: number,
  isActivoMes: boolean
): { prioridad: PrioridadRutaCliente; prioridadScore: number } {
  if (!isActivoMes || totalRubrosActivos <= 0) {
    return { prioridad: 'ALTA_INACTIVO', prioridadScore: 100 };
  }
  if (totalRubrosActivos >= 5) {
    return { prioridad: 'CUMPLIDO_5', prioridadScore: 20 };
  }
  if (totalRubrosActivos >= 3) {
    return { prioridad: 'ALTA_CIERRE_5', prioridadScore: 80 + totalRubrosActivos };
  }
  return { prioridad: 'MEDIA_DESARROLLO', prioridadScore: 50 + totalRubrosActivos };
}

/**
 * Construye la lista enriquecida de clientes de la cartera del vendedor cruzando:
 * - Activación por cliente y sus 5 rubros estratégicos
 * - Volumen (KG ejecutados y meta)
 * - Días de visita asignados en el Rutero (Lunes a Sábado)
 * - Registro de visita del día seleccionado (`fechaISO`)
 */
export function buildClientesRutaEnriquecidos(params: {
  filteredActivacion: any[];
  filteredVolumen: any[];
  asignacionesMap: Record<string, AsignacionClienteRuta>;
  visitasMap: Record<string, RegistroVisitaRuta>;
  fechaISO: string;
  manualOverrides?: Record<string, Record<string, boolean | undefined>>;
}): ClienteRutaEnriquecido[] {
  const {
    filteredActivacion = [],
    filteredVolumen = [],
    asignacionesMap = {},
    visitasMap = {},
    fechaISO,
    manualOverrides
  } = params;

  const clientMap = new Map<
    string,
    {
      clienteKey: string;
      clienteId: string;
      clienteNombre: string;
      vendedorId: string;
      zona?: string;
      rubrosComprados: Set<string>;
      ejecutadoKgMes: number;
      metaKgMes: number;
    }
  >();

  // 1. Consolidar desde Activación
  for (const a of filteredActivacion) {
    if (!a) continue;
    const rawId = String(a.id || '').replace(/^[#\s]+/, '').trim();
    const rawName = String(a.cliente || '').trim();
    if (!rawId && !rawName) continue;

    const vendId = String(a.vendedorId || '').trim();
    const key = normalizarClaveClienteRuta(rawId, rawName, vendId);
    const existing = clientMap.get(key);
    const rubros = extraerRubrosActivosRecord(a, existing?.rubrosComprados, manualOverrides);

    clientMap.set(key, {
      clienteKey: key,
      clienteId: rawId || existing?.clienteId || 'S/C',
      clienteNombre: rawName || existing?.clienteNombre || 'CLIENTE SIN NOMBRE',
      vendedorId: vendId || existing?.vendedorId || '',
      zona: a.zona || existing?.zona,
      rubrosComprados: rubros,
      ejecutadoKgMes: existing?.ejecutadoKgMes || 0,
      metaKgMes: existing?.metaKgMes || 0
    });
  }

  // 2. Complementar con Volumen (clientes que puedan figurar en volumen y sumar sus KG)
  for (const v of filteredVolumen) {
    if (!v) continue;
    const rawId = String(v.id || '').replace(/^[#\s]+/, '').trim();
    const rawName = String(v.cliente || '').trim();
    if (!rawId && !rawName) continue;

    const vendId = String(v.vendedorId || '').trim();
    const candidateKey = normalizarClaveClienteRuta(rawId, rawName, vendId);

    // Buscar también por nombre dentro del mismo vendedor si en volumen no vino el código numérico
    let matchedEntry = clientMap.get(candidateKey);
    if (!matchedEntry && rawName) {
      const normTargetName = rawName.toUpperCase();
      for (const entry of clientMap.values()) {
        if (
          entry.vendedorId.toUpperCase() === vendId.toUpperCase() &&
          entry.clienteNombre.toUpperCase() === normTargetName
        ) {
          matchedEntry = entry;
          break;
        }
      }
    }

    const ejecKg = Number(v.ejecutadoKg ?? v.ejecutado) || 0;
    const metaKg = Number(v.metaKg ?? v.meta) || 0;

    if (matchedEntry) {
      matchedEntry.ejecutadoKgMes = Number((matchedEntry.ejecutadoKgMes + ejecKg).toFixed(2));
      matchedEntry.metaKgMes = Number((matchedEntry.metaKgMes + metaKg).toFixed(2));
      if (!matchedEntry.zona && v.zona) matchedEntry.zona = v.zona;
    } else {
      clientMap.set(candidateKey, {
        clienteKey: candidateKey,
        clienteId: rawId || 'S/C',
        clienteNombre: rawName || 'CLIENTE SIN NOMBRE',
        vendedorId: vendId,
        zona: v.zona,
        rubrosComprados: new Set<string>(),
        ejecutadoKgMes: Number(ejecKg.toFixed(2)),
        metaKgMes: Number(metaKg.toFixed(2))
      });
    }
  }

  // 3. Enriquecer cada cliente con su asignación de días, brecha de rubros y visita del día
  const enriched: ClienteRutaEnriquecido[] = [];

  for (const item of clientMap.values()) {
    const asig =
      asignacionesMap[item.clienteKey] ||
      asignacionesMap[normalizarClaveClienteRuta(item.clienteId, item.clienteNombre, '')];

    const diasAsignados = Array.isArray(asig?.dias) ? asig.dias : [];
    const rubrosComprados = RUBROS_ESTRATEGICOS_5.filter(r => item.rubrosComprados.has(r));
    const rubrosFaltantes = RUBROS_ESTRATEGICOS_5.filter(r => !item.rubrosComprados.has(r));
    const totalRubrosActivos = rubrosComprados.length;
    const isActivoMes = totalRubrosActivos > 0 || item.ejecutadoKgMes > 0;

    const { prioridad, prioridadScore } = calcularPrioridadVisita(totalRubrosActivos, isActivoMes);

    const visitIdKey = `${fechaISO}::${item.clienteKey}`;
    const visitaHoy = visitasMap[visitIdKey];

    enriched.push({
      clienteKey: item.clienteKey,
      clienteId: item.clienteId,
      clienteNombre: item.clienteNombre,
      vendedorId: item.vendedorId,
      zona: asig?.zona || item.zona,
      diasAsignados,
      orden: asig?.orden,
      notasFijas: asig?.notasFijas,
      isActivoMes,
      rubrosComprados,
      rubrosFaltantes,
      totalRubrosActivos,
      prioridad,
      prioridadScore,
      ejecutadoKgMes: item.ejecutadoKgMes,
      metaKgMes: item.metaKgMes,
      visitaHoy
    });
  }

  // Ordenar por prioridad comercial (mayor urgencia primero) y luego por orden/nombre
  enriched.sort((a, b) => {
    const aVisited = a.visitaHoy && a.visitaHoy.estado !== 'PENDIENTE' ? 1 : 0;
    const bVisited = b.visitaHoy && b.visitaHoy.estado !== 'PENDIENTE' ? 1 : 0;
    if (aVisited !== bVisited) return aVisited - bVisited; // Pendientes primero
    if (b.prioridadScore !== a.prioridadScore) return b.prioridadScore - a.prioridadScore;
    if ((a.orden ?? 9999) !== (b.orden ?? 9999)) return (a.orden ?? 9999) - (b.orden ?? 9999);
    return a.clienteNombre.localeCompare(b.clienteNombre);
  });

  return enriched;
}

/**
 * Distribución automática e inteligente de la cartera entre Lunes y Viernes:
 * Asigna equitativamente todos los clientes sin día (o toda la cartera si overwrite=true)
 * en bloques balanceados de Lunes a Viernes.
 */
export function autoDistribuirCarteraSemanal(
  clientes: Array<{
    clienteKey: string;
    clienteId: string;
    clienteNombre: string;
    vendedorId: string;
    zona?: string;
  }>,
  existingMap: Record<string, AsignacionClienteRuta> = {},
  overwriteExisting = false
): Record<string, AsignacionClienteRuta> {
  const updated: Record<string, AsignacionClienteRuta> = { ...existingMap };
  const nowIso = new Date().toISOString();

  // Ordenar por zona y nombre natural (ej. Cliente 2 antes de Cliente 10) para agrupar paradas cercanas en el mismo día
  const sorted = [...clientes].sort((a, b) => {
    const zA = String(a.zona || '').toUpperCase();
    const zB = String(b.zona || '').toUpperCase();
    if (zA !== zB) return zA.localeCompare(zB, undefined, { numeric: true, sensitivity: 'base' });
    return a.clienteNombre.localeCompare(b.clienteNombre, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Contar cuántos clientes tiene actualmente cada día hábil para balancear la carga
  const dayCounts: Record<DiaSemanaRuta, number> = {
    LUNES: 0,
    MARTES: 0,
    MIERCOLES: 0,
    JUEVES: 0,
    VIERNES: 0,
    SABADO: 0
  };

  if (!overwriteExisting) {
    for (const c of sorted) {
      const current = updated[c.clienteKey];
      if (current && Array.isArray(current.dias) && current.dias.length > 0) {
        current.dias.forEach(d => {
          dayCounts[d] = (dayCounts[d] || 0) + 1;
        });
      }
    }
  }

  sorted.forEach((c, idx) => {
    const existing = updated[c.clienteKey];
    if (!overwriteExisting && existing && Array.isArray(existing.dias) && existing.dias.length > 0) {
      return;
    }

    // Elegir el día hábil (Lunes a Viernes) con menor carga actual
    let targetDay: DiaSemanaRuta = DIAS_HABILES_AUTO_DISTRIBUCION[idx % DIAS_HABILES_AUTO_DISTRIBUCION.length];
    let minCount = Infinity;
    for (const d of DIAS_HABILES_AUTO_DISTRIBUCION) {
      if (dayCounts[d] < minCount) {
        minCount = dayCounts[d];
        targetDay = d;
      }
    }

    dayCounts[targetDay] += 1;
    updated[c.clienteKey] = {
      clienteKey: c.clienteKey,
      clienteId: c.clienteId,
      clienteNombre: c.clienteNombre,
      vendedorId: c.vendedorId,
      zona: c.zona || existing?.zona,
      dias: [targetDay],
      orden: dayCounts[targetDay],
      notasFijas: existing?.notasFijas,
      updatedAt: nowIso
    };
  });

  return updated;
}

/**
 * Calcula los indicadores clave (KPIs) de ejecución y efectividad de la jornada seleccionada.
 */
export function calcularResumenJornadaRuta(params: {
  clientesEnriquecidos: ClienteRutaEnriquecido[];
  diaSeleccionado: DiaSemanaRuta;
  fechaISO: string;
}): ResumenJornadaRuta {
  const { clientesEnriquecidos, diaSeleccionado, fechaISO } = params;

  const totalCarteraVendedor = clientesEnriquecidos.length;
  const totalConDiaAsignado = clientesEnriquecidos.filter(c => c.diasAsignados.length > 0).length;
  const totalSinDiaAsignado = Math.max(0, totalCarteraVendedor - totalConDiaAsignado);

  const clientesDelDia = clientesEnriquecidos.filter(c =>
    c.diasAsignados.includes(diaSeleccionado)
  );

  const programadosHoy = clientesDelDia.length;
  let visitadosHoy = 0;
  let efectivosPedidoHoy = 0;
  let gestionCobroHoy = 0;
  let sinVentaHoy = 0;
  let inactivosProgramadosHoy = 0;

  for (const c of clientesDelDia) {
    if (!c.isActivoMes) {
      inactivosProgramadosHoy++;
    }
    const estado = c.visitaHoy?.estado;
    if (estado && estado !== 'PENDIENTE') {
      visitadosHoy++;
      if (estado === 'EFECTIVA_PEDIDO') efectivosPedidoHoy++;
      else if (estado === 'GESTION_COBRO') gestionCobroHoy++;
      else if (estado === 'SIN_VENTA') sinVentaHoy++;
    }
  }

  const pendientesHoy = Math.max(0, programadosHoy - visitadosHoy);
  const porcentajeAvanceRuta =
    programadosHoy > 0 ? Math.round((visitadosHoy / programadosHoy) * 100) : 0;
  const totalEfectivos = efectivosPedidoHoy + gestionCobroHoy;
  const porcentajeEfectividad =
    visitadosHoy > 0 ? Math.round((totalEfectivos / visitadosHoy) * 100) : 0;

  return {
    diaSeleccionado,
    fechaISO,
    totalCarteraVendedor,
    totalConDiaAsignado,
    totalSinDiaAsignado,
    programadosHoy,
    visitadosHoy,
    pendientesHoy,
    efectivosPedidoHoy,
    gestionCobroHoy,
    sinVentaHoy,
    inactivosProgramadosHoy,
    porcentajeAvanceRuta,
    porcentajeEfectividad
  };
}

// ============================================================================
// PERSISTENCIA OFFLINE-FIRST (LOCALSTORAGE + BACKEND SYNC)
// ============================================================================

export function loadAsignacionesRutaLocal(): Record<string, AsignacionClienteRuta> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ASIGNACIONES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveAsignacionesRutaLocal(map: Record<string, AsignacionClienteRuta>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ASIGNACIONES_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('[Rutero] No se pudo guardar asignaciones en localStorage:', e);
  }
}

export function loadVisitasRutaLocal(): Record<string, RegistroVisitaRuta> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(VISITAS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveVisitasRutaLocal(map: Record<string, RegistroVisitaRuta>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VISITAS_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('[Rutero] No se pudo guardar visitas en localStorage:', e);
  }
}

export async function fetchRuteroFromServer(): Promise<{
  asignaciones: Record<string, AsignacionClienteRuta>;
  visitas: Record<string, RegistroVisitaRuta>;
} | null> {
  try {
    const res = await fetch('/api/rutero', {
      headers: getAuthHeaders()
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.success) return null;
    return {
      asignaciones: data.asignaciones || {},
      visitas: data.visitas || {}
    };
  } catch {
    return null;
  }
}

export async function pushAsignacionesToServer(
  items: AsignacionClienteRuta[]
): Promise<boolean> {
  if (!items || items.length === 0) return true;
  try {
    const res = await fetch('/api/rutero/asignaciones', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ asignaciones: items })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pushVisitaToServer(visita: RegistroVisitaRuta): Promise<boolean> {
  try {
    const res = await fetch('/api/rutero/visitas', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ visita })
    });
    return res.ok;
  } catch {
    return false;
  }
}
