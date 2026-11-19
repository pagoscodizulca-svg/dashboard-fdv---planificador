import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { VENDOR_PROFILES, VendorProfile } from '../../src/utils/vendorRoutes';

export interface StressRequestSample {
  id: string;
  vendor: string;
  route: string;
  burst: 'warmup' | 'medium' | 'peak' | 'idempotency';
  status: number;
  ok: boolean;
  latencyMs: number;
  idempotentReplay?: boolean;
  error?: string;
}

export interface BurstMetrics {
  burst: string;
  concurrency: number;
  total: number;
  succeeded: number;
  failed: number;
  errorRatePct: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  durationMs: number;
}

export interface IntegrityReport {
  expectedCount: number;
  foundInFdvCount: number;
  foundInReceptorCount: number;
  exactFieldMatches: number;
  duplicatesInFdv: number;
  duplicatesInReceptor: number;
  integrityPct: number;
  mismatches: string[];
}

export interface IdempotencyReport {
  parallelRequests: number;
  allSucceeded: boolean;
  uniqueIdsReturned: number;
  replaysReported: number;
  persistedCountInFdv: number;
  persistedCountInReceptor: number;
  passed: boolean;
}

export interface TeardownReport {
  attemptedDeletes: number;
  deleteErrors: number;
  remainingInFdv: number;
  remainingInReceptor: number;
  remainingInLocalJson: number;
  clean: boolean;
}

export interface FullStressSuiteReport {
  runUuid: string;
  tag: string;
  fdvBaseUrl: string;
  receptorBaseUrl?: string;
  activeVendorProfilesTested: number;
  bursts: BurstMetrics[];
  integrity: IntegrityReport;
  idempotency: IdempotencyReport;
  teardown: TeardownReport;
}

const SAMPLE_PRODUCTS = [
  ['ESPALDA', 'MORTADELA'],
  ['ESTANDAR', 'SUPERIOR'],
  ['AHUMADO', 'PAVO'],
  ['MORTADELA', 'ARROZ CON LECHE'],
  ['ESPALDA', 'PAVO', 'MORTADELA']
];

export function getUniqueActiveVendorProfiles(): VendorProfile[] {
  const seen = new Set<string>();
  const unique: VendorProfile[] = [];
  for (const profile of Object.values(VENDOR_PROFILES)) {
    if (!profile?.canonicalUsername || seen.has(profile.canonicalUsername)) continue;
    seen.add(profile.canonicalUsername);
    unique.push(profile);
  }
  return unique;
}

export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedValues.length) - 1;
  const clamped = Math.max(0, Math.min(sortedValues.length - 1, idx));
  return Number(sortedValues[clamped].toFixed(2));
}

export function computeBurstMetrics(
  burst: string,
  concurrency: number,
  samples: StressRequestSample[],
  durationMs: number
): BurstMetrics {
  const latencies = samples.map((s) => s.latencyMs).sort((a, b) => a - b);
  const succeeded = samples.filter((s) => s.ok).length;
  const failed = samples.length - succeeded;
  const errorRatePct = samples.length > 0 ? Number(((failed / samples.length) * 100).toFixed(2)) : 0;

  return {
    burst,
    concurrency,
    total: samples.length,
    succeeded,
    failed,
    errorRatePct,
    minMs: latencies.length ? Number(latencies[0].toFixed(2)) : 0,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
    maxMs: latencies.length ? Number(latencies[latencies.length - 1].toFixed(2)) : 0,
    durationMs: Number(durationMs.toFixed(2))
  };
}

export function buildSyntheticDegustacionPayload(
  vendor: VendorProfile,
  index: number,
  runUuid: string,
  burst: 'warmup' | 'medium' | 'peak' | 'idempotency'
) {
  const tag = `[QA_STRESS_TEST_${runUuid}]`;
  const id = `qa-stress-${runUuid.slice(0, 8)}-${burst}-${String(index).padStart(3, '0')}`;
  const route = vendor.routes[0]?.id || vendor.canonicalUsername;
  const turno = index % 2 === 0 ? 'MAÑANA' : 'TARDE';
  const hora = turno === 'MAÑANA' ? '09:00 AM - 01:00 PM' : '02:00 PM - 07:00 PM';
  const productos = SAMPLE_PRODUCTS[index % SAMPLE_PRODUCTS.length];
  const kilosEstimados = Number((4.5 + (index % 5) * 1.25).toFixed(2));
  const personasEstimadas = 120 + (index % 4) * 25;

  return {
    id,
    idempotencyKey: id,
    clienteCodigo: `QA-${String(1000 + index)}`,
    clienteNombre: `PDV SINTETICO ${String(index).padStart(3, '0')} ${tag}`,
    vendedorNombre: vendor.canonicalUsername,
    vendedorId: route,
    ruta: route,
    fecha: '2026-11-26',
    turno,
    hora,
    productos,
    kilosEstimados,
    personasEstimadas,
    requierePromotora: index % 2 === 0,
    promotoraAsignada: '',
    materialPop: true,
    contactoPunto: `Encargado QA ${index}`,
    telefonoContacto: '0414-0000000',
    observaciones: `${tag} | burst=${burst} | vendedor=${vendor.canonicalUsername}`,
    estado: 'SOLICITADA',
    notasTradeMarketing: `${tag} Registro sintético auditable`,
    createdAt: new Date().toISOString()
  };
}

async function sendSingleCreate(
  fdvBaseUrl: string,
  payload: ReturnType<typeof buildSyntheticDegustacionPayload>,
  burst: 'warmup' | 'medium' | 'peak' | 'idempotency',
  authToken?: string
): Promise<StressRequestSample> {
  const started = performance.now();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Idempotency-Key': payload.idempotencyKey
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const res = await fetch(`${fdvBaseUrl.replace(/\/+$/, '')}/api/degustaciones`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const latencyMs = performance.now() - started;
    const body = await res.json().catch(() => null);
    const ok = res.ok && Boolean(body?.success) && Boolean(body?.data?.id);

    return {
      id: payload.id,
      vendor: payload.vendedorNombre,
      route: payload.ruta,
      burst,
      status: res.status,
      ok,
      latencyMs,
      idempotentReplay: Boolean(body?.idempotentReplay),
      error: ok ? undefined : body?.error || `HTTP ${res.status}`
    };
  } catch (err: any) {
    return {
      id: payload.id,
      vendor: payload.vendedorNombre,
      route: payload.ruta,
      burst,
      status: 0,
      ok: false,
      latencyMs: performance.now() - started,
      error: err?.message || 'Network error'
    };
  }
}

export async function runDegustacionSyncStressSuite(options: {
  fdvBaseUrl: string;
  receptorBaseUrl?: string;
  authToken?: string;
  localJsonPath?: string;
  warmupCount?: number;
  mediumCount?: number;
  peakCount?: number;
  idempotencyParallelCount?: number;
}): Promise<FullStressSuiteReport> {
  const runUuid = crypto.randomUUID();
  const tag = `[QA_STRESS_TEST_${runUuid}]`;
  const vendors = getUniqueActiveVendorProfiles();

  const warmupCount = options.warmupCount ?? 1;
  const mediumCount = options.mediumCount ?? 15;
  const peakCount = options.peakCount ?? 40;
  const idempotencyParallelCount = options.idempotencyParallelCount ?? 5;

  const createdPayloads = new Map<string, ReturnType<typeof buildSyntheticDegustacionPayload>>();
  const bursts: BurstMetrics[] = [];
  let idempotencyReport: IdempotencyReport = {
    parallelRequests: idempotencyParallelCount,
    allSucceeded: false,
    uniqueIdsReturned: 0,
    replaysReported: 0,
    persistedCountInFdv: 0,
    persistedCountInReceptor: 0,
    passed: false
  };
  let integrityReport: IntegrityReport = {
    expectedCount: 0,
    foundInFdvCount: 0,
    foundInReceptorCount: 0,
    exactFieldMatches: 0,
    duplicatesInFdv: 0,
    duplicatesInReceptor: 0,
    integrityPct: 0,
    mismatches: []
  };

  let seq = 1;
  const runBurst = async (burstName: 'warmup' | 'medium' | 'peak', count: number) => {
    const payloads: Array<ReturnType<typeof buildSyntheticDegustacionPayload>> = [];
    for (let i = 0; i < count; i++) {
      const vendor = vendors[(seq - 1) % vendors.length];
      const payload = buildSyntheticDegustacionPayload(vendor, seq, runUuid, burstName);
      seq++;
      payloads.push(payload);
      createdPayloads.set(payload.id, payload);
    }

    const t0 = performance.now();
    const samples = await Promise.all(
      payloads.map((p) => sendSingleCreate(options.fdvBaseUrl, p, burstName, options.authToken))
    );
    const elapsed = performance.now() - t0;
    bursts.push(computeBurstMetrics(burstName, count, samples, elapsed));
  };

  try {
    // 1. Ráfaga Warmup (1 solicitud)
    await runBurst('warmup', warmupCount);

    // 2. Ráfaga Carga Media (15 solicitudes concurrentes)
    await runBurst('medium', mediumCount);

    // 3. Ráfaga Carga Pico (40 solicitudes concurrentes cubriendo todos los 26 perfiles de vendedores)
    await runBurst('peak', peakCount);

    // 4. Prueba explícita de Idempotencia / Doble Clic Concurrente (5 peticiones paralelas con misma X-Idempotency-Key)
    const idempVendor = vendors[0];
    const idempPayload = buildSyntheticDegustacionPayload(idempVendor, 999, runUuid, 'idempotency');
    createdPayloads.set(idempPayload.id, idempPayload);

    const tIdemp0 = performance.now();
    const idempSamples = await Promise.all(
      Array.from({ length: idempotencyParallelCount }, () =>
        sendSingleCreate(options.fdvBaseUrl, idempPayload, 'idempotency', options.authToken)
      )
    );
    const tIdempElapsed = performance.now() - tIdemp0;
    bursts.push(computeBurstMetrics('idempotency_double_click', idempotencyParallelCount, idempSamples, tIdempElapsed));

    // 5. Verificación 1:1 de integridad en FDV y Receptor Trade Marketing
    const fdvGetRes = await fetch(
      `${options.fdvBaseUrl.replace(/\/+$/, '')}/api/degustaciones?tag=${encodeURIComponent(tag)}`
    );
    const fdvJson = await fdvGetRes.json();
    const fdvList: any[] = Array.isArray(fdvJson?.data) ? fdvJson.data : [];

    const fdvById = new Map<string, any[]>();
    for (const row of fdvList) {
      const key = String(row.id || '').replace(/^DEG-/, '');
      const bucket = fdvById.get(key) || [];
      bucket.push(row);
      fdvById.set(key, bucket);
    }

    let receptorList: any[] = [];
    const receptorById = new Map<string, any[]>();
    if (options.receptorBaseUrl) {
      const recRes = await fetch(`${options.receptorBaseUrl.replace(/\/+$/, '')}/api/degustaciones`);
      if (recRes.ok) {
        const recJson = await recRes.json();
        const rawArr = Array.isArray(recJson) ? recJson : Array.isArray(recJson?.data) ? recJson.data : [];
        receptorList = rawArr.filter(
          (r: any) =>
            String(r?.client || '').includes(tag) ||
            String(r?.comments || '').includes(tag) ||
            String(r?.id || '').includes(runUuid.slice(0, 8))
        );
        for (const r of receptorList) {
          const clean = String(r.id || '').replace(/^DEG-/, '');
          const bucket = receptorById.get(clean) || [];
          bucket.push(r);
          receptorById.set(clean, bucket);
        }
      }
    }

    let exactMatches = 0;
    let duplicatesInFdv = 0;
    let duplicatesInReceptor = 0;
    const mismatches: string[] = [];

    for (const [expectedId, expected] of createdPayloads.entries()) {
      const fdvMatches = fdvById.get(expectedId) || [];
      if (fdvMatches.length > 1) duplicatesInFdv += fdvMatches.length - 1;
      if (fdvMatches.length === 0) {
        mismatches.push(`Missing in FDV: ${expectedId}`);
        continue;
      }

      const actual = fdvMatches[0];
      const fdvFieldsOk =
        actual.clienteNombre === expected.clienteNombre &&
        actual.vendedorNombre === expected.vendedorNombre &&
        actual.ruta === expected.ruta &&
        actual.fecha === expected.fecha &&
        actual.turno === expected.turno &&
        Number(actual.kilosEstimados) === Number(expected.kilosEstimados) &&
        Number(actual.personasEstimadas) === Number(expected.personasEstimadas) &&
        Array.isArray(actual.productos) &&
        actual.productos.join(',') === expected.productos.join(',') &&
        actual.observaciones === expected.observaciones;

      if (!fdvFieldsOk) {
        mismatches.push(`FDV field mismatch on ${expectedId}`);
        continue;
      }

      if (options.receptorBaseUrl) {
        const recMatches = receptorById.get(expectedId) || [];
        if (recMatches.length > 1) duplicatesInReceptor += recMatches.length - 1;
        if (recMatches.length === 0) {
          mismatches.push(`Missing in Trade Marketing receptor: ${expectedId}`);
          continue;
        }
        const rec = recMatches[0];
        const recFieldsOk =
          String(rec.client || '') === expected.clienteNombre &&
          String(rec.vendedor || '') === expected.vendedorNombre &&
          String(rec.zone || '') === expected.ruta &&
          String(rec.product || '') === expected.productos.join(', ') &&
          Number(rec.target) === Number(expected.personasEstimadas) &&
          String(rec.comments || '').includes(tag);
        if (!recFieldsOk) {
          mismatches.push(`Receptor field mismatch on ${expectedId}`);
          continue;
        }
      }

      exactMatches++;
    }

    const expectedTotal = createdPayloads.size;
    integrityReport = {
      expectedCount: expectedTotal,
      foundInFdvCount: fdvList.length,
      foundInReceptorCount: receptorList.length,
      exactFieldMatches: exactMatches,
      duplicatesInFdv,
      duplicatesInReceptor,
      integrityPct: expectedTotal > 0 ? Number(((exactMatches / expectedTotal) * 100).toFixed(2)) : 0,
      mismatches
    };

    const idempInFdv = (fdvById.get(idempPayload.id) || []).length;
    const idempInReceptor = options.receptorBaseUrl ? (receptorById.get(idempPayload.id) || []).length : 1;
    const uniqueReturnedIds = new Set(idempSamples.map((s) => s.id)).size;
    const replaysReported = idempSamples.filter((s) => s.idempotentReplay).length;

    idempotencyReport = {
      parallelRequests: idempotencyParallelCount,
      allSucceeded: idempSamples.every((s) => s.ok),
      uniqueIdsReturned: uniqueReturnedIds,
      replaysReported,
      persistedCountInFdv: idempInFdv,
      persistedCountInReceptor: idempInReceptor,
      passed:
        idempSamples.every((s) => s.ok) &&
        uniqueReturnedIds === 1 &&
        idempInFdv === 1 &&
        idempInReceptor === 1
    };
  } finally {
    // 6. TEARDOWN OBLIGATORIO Y VERIFICADO (solo IDs sintéticos de esta corrida)
    let deleteErrors = 0;
    const idsToDelete = Array.from(createdPayloads.keys());
    const deleteBatchSize = 10;

    for (let i = 0; i < idsToDelete.length; i += deleteBatchSize) {
      const slice = idsToDelete.slice(i, i + deleteBatchSize);
      await Promise.all(
        slice.map(async (id) => {
          try {
            const headers: Record<string, string> = {};
            if (options.authToken) headers['Authorization'] = `Bearer ${options.authToken}`;
            const delRes = await fetch(
              `${options.fdvBaseUrl.replace(/\/+$/, '')}/api/degustaciones/${encodeURIComponent(id)}`,
              { method: 'DELETE', headers }
            );
            if (!delRes.ok) deleteErrors++;
          } catch {
            deleteErrors++;
          }
        })
      );
    }

    // Verificación posterior al teardown (0 registros sintéticos remanentes)
    let remainingInFdv = -1;
    try {
      const verifyFdv = await fetch(
        `${options.fdvBaseUrl.replace(/\/+$/, '')}/api/degustaciones?tag=${encodeURIComponent(tag)}`
      );
      if (verifyFdv.ok) {
        const j = await verifyFdv.json();
        remainingInFdv = Array.isArray(j?.data) ? j.data.length : -1;
      }
    } catch {}

    let remainingInReceptor = 0;
    if (options.receptorBaseUrl) {
      remainingInReceptor = -1;
      try {
        const verifyRec = await fetch(`${options.receptorBaseUrl.replace(/\/+$/, '')}/api/degustaciones`);
        if (verifyRec.ok) {
          const j = await verifyRec.json();
          const arr = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
          remainingInReceptor = arr.filter(
            (r: any) =>
              String(r?.client || '').includes(tag) ||
              String(r?.comments || '').includes(tag) ||
              String(r?.id || '').includes(runUuid.slice(0, 8))
          ).length;
        }
      } catch {}
    }

    let remainingInLocalJson = 0;
    const jsonFile = options.localJsonPath || path.resolve(process.cwd(), 'data_degustaciones.json');
    try {
      if (fs.existsSync(jsonFile)) {
        const raw = fs.readFileSync(jsonFile, 'utf8');
        const arr = JSON.parse(raw || '[]');
        if (Array.isArray(arr)) {
          remainingInLocalJson = arr.filter(
            (r: any) =>
              String(r?.client || '').includes(tag) ||
              String(r?.comments || '').includes(tag) ||
              String(r?.id || '').includes(runUuid.slice(0, 8))
          ).length;
        }
      }
    } catch {}

    const teardown: TeardownReport = {
      attemptedDeletes: idsToDelete.length,
      deleteErrors,
      remainingInFdv,
      remainingInReceptor,
      remainingInLocalJson,
      clean:
        deleteErrors === 0 &&
        remainingInFdv === 0 &&
        remainingInReceptor === 0 &&
        remainingInLocalJson === 0
    };

    // Adjuntar al resultado final antes de retornar
    (runDegustacionSyncStressSuite as any).__lastTeardown = teardown;
  }

  const teardown: TeardownReport = (runDegustacionSyncStressSuite as any).__lastTeardown;

  return {
    runUuid,
    tag,
    fdvBaseUrl: options.fdvBaseUrl,
    receptorBaseUrl: options.receptorBaseUrl,
    activeVendorProfilesTested: vendors.length,
    bursts,
    integrity: integrityReport,
    idempotency: idempotencyReport,
    teardown
  };
}
