import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { normalizeVendorKey, resolveCanonicalRouteKey } from '../utils/vendorKeyNormalizer';

export interface SyncAuditLogEntry {
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  sheet_name: string;
  row_number?: number | null;
  event_code: string;
  vendor_key?: string | null;
  entity_key?: string | null;
  message: string;
  payload?: Record<string, unknown>;
}

export interface MirrorSnapshotPayload {
  periodoMes: string;
  sheetSha256: string;
  triggeredBy: string;
  metas: Array<Record<string, any>>;
  volumen: Array<Record<string, any>>;
  activacion: Array<Record<string, any>>;
  degustaciones: Array<Record<string, any>>;
  auditLogs: SyncAuditLogEntry[];
  metrics?: Record<string, any>;
  allowEmpty?: boolean;
}

export interface MirrorSyncRunResult {
  status: 'OK' | 'SKIPPED_UNCHANGED' | 'LOCKED_CONCURRENT_RUN';
  sync_run_id?: string;
  periodo_mes: string;
  sheet_sha256?: string;
  metas?: { upserted: number; deleted_orphans: number };
  volumen?: { upserted: number; deleted_orphans: number };
  activacion?: { upserted: number; deleted_orphans: number };
  degustaciones?: { upserted: number; deleted_orphans: number };
  audit_logs_inserted?: number;
}

const VALID_PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function computeBufferSha256(bytes: Uint8Array | Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export interface InMemoryMirrorState {
  metas_activacion: Array<Record<string, any>>;
  ventas_volumen: Array<Record<string, any>>;
  activacion_clientes: Array<Record<string, any>>;
  degustaciones: Array<Record<string, any>>;
  ventas_historial: Array<Record<string, any>>;
  sync_runs: Array<Record<string, any>>;
  sync_audit_logs: Array<Record<string, any>>;
}

export interface MirrorStoreAdapter {
  state: InMemoryMirrorState;
  getLastSha256: (periodoMes: string) => string | null;
}

/**
 * Repositorio transaccional en memoria con semántica idéntica a `public.sync_monthly_sales_snapshot`
 * (usado en pruebas de integración deterministas y como respaldo atómico si la migración RPC aún no ha sido aplicada).
 */
export function createInMemoryMirrorStore(seed?: Partial<InMemoryMirrorState>): MirrorStoreAdapter {
  const state: InMemoryMirrorState = {
    metas_activacion: structuredClone(seed?.metas_activacion || []),
    ventas_volumen: structuredClone(seed?.ventas_volumen || []),
    activacion_clientes: structuredClone(seed?.activacion_clientes || []),
    degustaciones: structuredClone(seed?.degustaciones || []),
    ventas_historial: structuredClone(seed?.ventas_historial || []),
    sync_runs: structuredClone(seed?.sync_runs || []),
    sync_audit_logs: structuredClone(seed?.sync_audit_logs || [])
  };

  return {
    state,
    getLastSha256(periodoMes: string) {
      for (let i = state.sync_runs.length - 1; i >= 0; i--) {
        const run = state.sync_runs[i];
        if (run.periodo_mes === periodoMes && run.status === 'OK' && run.sheet_sha256) {
          return String(run.sheet_sha256);
        }
      }
      return null;
    }
  };
}

const activePeriodLocks = new Set<string>();

/**
 * Ejecuta la transacción atómica anti-huérfanos sobre `MirrorStoreAdapter`:
 * - Valida formato `YYYY-MM` y freno anti-vaciado accidental.
 * - Hace copia de respaldo previa para rollback completo ante cualquier error.
 * - Aplica UPSERT sobre `periodoMes` y elimina ÚNICAMENTE los huérfanos de ese mismo `periodoMes`.
 * - Jamás altera meses históricos anteriores ni `ventas_historial`.
 */
export async function executeMirrorSyncSnapshot(
  store: MirrorStoreAdapter,
  payload: MirrorSnapshotPayload
): Promise<MirrorSyncRunResult> {
  const { periodoMes, sheetSha256, triggeredBy, metas, volumen, activacion, degustaciones, auditLogs, metrics, allowEmpty = false } = payload;

  if (!periodoMes || !VALID_PERIOD_RE.test(periodoMes)) {
    throw new Error(`Periodo mensual inválido: "${periodoMes}". Se esperaba YYYY-MM.`);
  }

  if (!allowEmpty && (metas.length === 0 || volumen.length === 0 || activacion.length === 0)) {
    throw new Error(
      `Freno de seguridad activado: payload vacío para el periodo ${periodoMes} (metas=${metas.length}, volumen=${volumen.length}, activacion=${activacion.length}).`
    );
  }

  const lockKey = `sync_monthly_sales_snapshot:${periodoMes}`;
  if (activePeriodLocks.has(lockKey)) {
    return {
      status: 'LOCKED_CONCURRENT_RUN',
      periodo_mes: periodoMes
    };
  }

  activePeriodLocks.add(lockKey);
  const snapshotBefore = structuredClone(store.state);

  try {
    const runId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    // 1. METAS ACTIVACIÓN (UPSERT + Anti-Huérfanos SOLO en periodoMes)
    const incomingMetasKeys = new Set<string>();
    let upsertedMetas = 0;
    for (const m of metas) {
      const nk = `${m.vendedor_key}::${m.categoria}`;
      incomingMetasKeys.add(nk);
      const idx = store.state.metas_activacion.findIndex(
        (r) => r.periodo === periodoMes && r.vendedor_key === m.vendedor_key && r.categoria === m.categoria
      );
      const nextRow = { ...m, periodo: periodoMes, updated_at: nowIso };
      if (idx >= 0) store.state.metas_activacion[idx] = { ...store.state.metas_activacion[idx], ...nextRow };
      else store.state.metas_activacion.push(nextRow);
      upsertedMetas++;
    }
    const beforeMetasLen = store.state.metas_activacion.length;
    store.state.metas_activacion = store.state.metas_activacion.filter((r) => {
      if (r.periodo !== periodoMes) return true; // Blindaje estricto de meses históricos
      return incomingMetasKeys.has(`${r.vendedor_key}::${r.categoria}`);
    });
    const deletedMetas = beforeMetasLen - store.state.metas_activacion.length;

    // 2. VENTAS VOLUMEN (UPSERT + Anti-Huérfanos SOLO en periodoMes)
    const incomingVolKeys = new Set<string>();
    let upsertedVolumen = 0;
    for (const v of volumen) {
      const nk = `${v.vendedor_key}::${v.sku}`;
      incomingVolKeys.add(nk);
      const idx = store.state.ventas_volumen.findIndex(
        (r) => r.periodo === periodoMes && r.vendedor_key === v.vendedor_key && r.sku === v.sku
      );
      const nextRow = {
        ...v,
        periodo: periodoMes,
        ejecutado_kg: v.venta_neta_kg,
        updated_at: nowIso
      };
      if (idx >= 0) store.state.ventas_volumen[idx] = { ...store.state.ventas_volumen[idx], ...nextRow };
      else store.state.ventas_volumen.push(nextRow);
      upsertedVolumen++;
    }
    const beforeVolLen = store.state.ventas_volumen.length;
    store.state.ventas_volumen = store.state.ventas_volumen.filter((r) => {
      if (r.periodo !== periodoMes) return true;
      return incomingVolKeys.has(`${r.vendedor_key}::${r.sku}`);
    });
    const deletedVolumen = beforeVolLen - store.state.ventas_volumen.length;

    // 3. ACTIVACIÓN CLIENTES (UPSERT + Anti-Huérfanos SOLO en periodoMes)
    const incomingActKeys = new Set<string>();
    let upsertedAct = 0;
    for (const a of activacion) {
      const nk = `${a.vendedor_key}::${a.cliente_codigo_canonico}`;
      incomingActKeys.add(nk);
      const idx = store.state.activacion_clientes.findIndex(
        (r) =>
          r.periodo === periodoMes &&
          r.vendedor_key === a.vendedor_key &&
          r.cliente_codigo_canonico === a.cliente_codigo_canonico
      );
      const nextRow = { ...a, periodo: periodoMes, updated_at: nowIso };
      if (idx >= 0) store.state.activacion_clientes[idx] = { ...store.state.activacion_clientes[idx], ...nextRow };
      else store.state.activacion_clientes.push(nextRow);
      upsertedAct++;
    }
    const beforeActLen = store.state.activacion_clientes.length;
    store.state.activacion_clientes = store.state.activacion_clientes.filter((r) => {
      if (r.periodo !== periodoMes) return true;
      return incomingActKeys.has(`${r.vendedor_key}::${r.cliente_codigo_canonico}`);
    });
    const deletedAct = beforeActLen - store.state.activacion_clientes.length;

    // 4. DEGUSTACIONES DEL MES VIGENTE (UPSERT + Anti-Huérfanos SOLO de origen_sync=true en periodoMes)
    const incomingDegIds = new Set<string>();
    let upsertedDeg = 0;
    for (const d of degustaciones) {
      const fechaStr = String(d.fecha || '');
      if (fechaStr.slice(0, 7) !== periodoMes) continue;
      incomingDegIds.add(String(d.id));
      const idx = store.state.degustaciones.findIndex((r) => String(r.id) === String(d.id));
      if (idx >= 0) {
        const existingPeriod = String(store.state.degustaciones[idx].fecha || '').slice(0, 7);
        if (existingPeriod && existingPeriod !== periodoMes) continue;
        store.state.degustaciones[idx] = {
          ...store.state.degustaciones[idx],
          ...d,
          origen_sync: true,
          updated_at: nowIso
        };
      } else {
        store.state.degustaciones.push({ ...d, origen_sync: true, updated_at: nowIso });
      }
      upsertedDeg++;
    }
    const beforeDegLen = store.state.degustaciones.length;
    store.state.degustaciones = store.state.degustaciones.filter((r) => {
      const rowPeriod = String(r.fecha || '').slice(0, 7);
      if (rowPeriod !== periodoMes) return true;
      if (r.origen_sync !== true) return true;
      return incomingDegIds.has(String(r.id));
    });
    const deletedDeg = beforeDegLen - store.state.degustaciones.length;

    // 5. AUDIT LOGS + SYNC RUN
    for (const log of auditLogs) {
      store.state.sync_audit_logs.push({
        sync_run_id: runId,
        periodo_mes: periodoMes,
        ...log,
        created_at: nowIso
      });
    }

    store.state.sync_runs.push({
      id: runId,
      periodo_mes: periodoMes,
      sheet_sha256: sheetSha256,
      status: 'OK',
      triggered_by: triggeredBy,
      metrics: metrics || {},
      warnings_count: auditLogs.length,
      started_at: nowIso,
      finished_at: nowIso
    });

    return {
      status: 'OK',
      sync_run_id: runId,
      periodo_mes: periodoMes,
      sheet_sha256: sheetSha256,
      metas: { upserted: upsertedMetas, deleted_orphans: deletedMetas },
      volumen: { upserted: upsertedVolumen, deleted_orphans: deletedVolumen },
      activacion: { upserted: upsertedAct, deleted_orphans: deletedAct },
      degustaciones: { upserted: upsertedDeg, deleted_orphans: deletedDeg },
      audit_logs_inserted: auditLogs.length
    };
  } catch (err) {
    store.state = snapshotBefore;
    throw err;
  } finally {
    activePeriodLocks.delete(lockKey);
  }
}

export interface OrchestratedSyncDeps {
  fetchWorkbookBytes: () => Promise<Uint8Array | Buffer>;
  parseBytes: (bytes: Uint8Array | Buffer) => Promise<{
    periodoMes: string;
    metas: Array<Record<string, any>>;
    volumen: Array<Record<string, any>>;
    activacion: Array<Record<string, any>>;
    degustaciones: Array<Record<string, any>>;
    auditLogs: SyncAuditLogEntry[];
    usuarios?: Array<{ usuario: string; cedula: string; rol: string; vendorId: string }>;
    metrics?: Record<string, any>;
  }>;
  persistSnapshot: (payload: MirrorSnapshotPayload) => Promise<MirrorSyncRunResult>;
  getLastSyncedSha256: (periodoMes: string) => Promise<string | null> | string | null;
  periodoHint?: string;
  triggeredBy: string;
  forceRebuild?: boolean;
}

/**
 * Orquestador híbrido con cortocircuito por hash SHA-256:
 * si el binario del Google Sheet no cambió para el mismo `periodo_mes` y `forceRebuild` es `false`,
 * retorna `SKIPPED_UNCHANGED` sin ejecutar parseo pesado ni escrituras en Supabase.
 */
export async function runOrchestratedSheetsSync(deps: OrchestratedSyncDeps): Promise<MirrorSyncRunResult> {
  const bytes = await deps.fetchWorkbookBytes();
  const sha256 = computeBufferSha256(bytes);

  if (!deps.forceRebuild && deps.periodoHint) {
    const prevHash = await deps.getLastSyncedSha256(deps.periodoHint);
    if (prevHash && prevHash === sha256) {
      return {
        status: 'SKIPPED_UNCHANGED',
        periodo_mes: deps.periodoHint,
        sheet_sha256: sha256
      };
    }
  }

  const parsed = await deps.parseBytes(bytes);
  if (!deps.forceRebuild) {
    const prevHash = await deps.getLastSyncedSha256(parsed.periodoMes);
    if (prevHash && prevHash === sha256) {
      return {
        status: 'SKIPPED_UNCHANGED',
        periodo_mes: parsed.periodoMes,
        sheet_sha256: sha256
      };
    }
  }

  return deps.persistSnapshot({
    periodoMes: parsed.periodoMes,
    sheetSha256: sha256,
    triggeredBy: deps.triggeredBy,
    metas: parsed.metas,
    volumen: parsed.volumen,
    activacion: parsed.activacion,
    degustaciones: parsed.degustaciones,
    auditLogs: parsed.auditLogs,
    metrics: parsed.metrics
  });
}

// Cache en memoria de hashes bcrypt por huella HMAC-SHA256 para evitar recalcular bcrypt(12) cuando la clave en el Sheet no cambió
const userBcryptMemo = new Map<string, string>();
const PROCESS_HMAC_KEY = crypto.randomBytes(32);

/**
 * Transforma las filas crudas de la pestaña "Usuarios" en registros listos para `public.usuarios`
 * hasheando con `bcrypt(12)` en memoria. JAMÁS expone ni retorna la contraseña en texto plano.
 */
export async function buildHashedUsersForSupabase(
  rawUsers: Array<{ usuario: string; cedula: string; rol: string; vendorId: string }>,
  supervisorSet: Set<string>
): Promise<
  Array<{
    username: string;
    password_hash: string;
    role: 'ADMIN' | 'SUPERVISOR' | 'VENDEDOR';
    vendor_id: string;
    nombre_completo: string;
    activo: boolean;
    vendor_key: string;
    route_key: string;
  }>
> {
  const out = [];
  for (const u of rawUsers) {
    const username = String(u.usuario || '').replace(/\s+/g, ' ').trim().toUpperCase();
    const rawPwd = String(u.cedula || '').trim();
    if (!username || !rawPwd) continue;

    const vendorKey = normalizeVendorKey(username);
    const routeKey = resolveCanonicalRouteKey(username);
    const rawRol = String(u.rol || '').trim().toUpperCase();
    const role: 'ADMIN' | 'SUPERVISOR' | 'VENDEDOR' =
      rawRol === 'ADMIN'
        ? 'ADMIN'
        : rawRol === 'SUPERVISOR' || supervisorSet.has(vendorKey)
          ? 'SUPERVISOR'
          : 'VENDEDOR';

    let passwordHash: string;
    if (rawPwd.startsWith('$2')) {
      passwordHash = rawPwd;
    } else {
      const fingerprint = crypto
        .createHmac('sha256', PROCESS_HMAC_KEY)
        .update(`${username}:${rawPwd}`)
        .digest('hex');
      const cached = userBcryptMemo.get(fingerprint);
      if (cached) {
        passwordHash = cached;
      } else {
        passwordHash = await bcrypt.hash(rawPwd, 12);
        userBcryptMemo.set(fingerprint, passwordHash);
      }
    }

    out.push({
      username,
      password_hash: passwordHash,
      role,
      vendor_id: String(u.vendorId || vendorKey),
      nombre_completo: username,
      activo: true,
      vendor_key: vendorKey,
      route_key: routeKey
    });
  }
  return out;
}
