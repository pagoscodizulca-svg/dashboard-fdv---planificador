import express from "express";
import path from "path";
import fs from "fs";
import https from "https";
import zlib from "zlib";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import {
  extractPositionedTextFromAlkostoPdfBuffer,
  parseAlkostoRawText,
  parseAlkostoFlexibleOcrText,
  validateAndNormalizeAlkostoOC,
  normalizeOrderForCodizulca,
  AlkostoParseValidationError,
  AlkostoOcrStageError,
  AlkostoOcrStage,
  normalizarCadenaEstricta,
  construirObservacionFormateada,
  parseNumeroEstricto,
  limpiarDescripcionAlkosto,
  calcularResumenCuadreOC,
  normalizarNombreVendedorSairu,
  generarIdDeterministaPedidoAlkosto,
  sanitizeBase64Payload,
  detectAlkostoFileMimeType,
  extractCleanJson,
  parseSafeJson,
  sanitizeAndParseOcJson,
  ALKOSTO_OCR_MODEL_CASCADE,
  callGeminiWithFallback,
  buildAlkostoOcSystemPrompt,
  ALKOSTO_OC_EXTRACTION_SYSTEM_PROMPT,
  toCanonicalAlkostoOcJson,
  PRODUCTOS_CODIZULCA,
  matchProductoCodizulca,
  toSafeNumber
} from "./src/services/alkostoOcParser";
import {
  hasPrimaryNounConflict,
  isBrandOrPresentationToken
} from "./src/services/productosCodizulca";
import crypto from "crypto";
import { categoriaARubroCodigo, clasificarRubro, esRubroActivo } from "./src/lib/rubros";
import {
  parseMaestraBytes,
  MaestraParseError
} from "./src/utils/maestraParser";
import {
  crearMaestraRepoSupabase,
  calcularPreviewDb,
  sincronizarMaestra,
  leerCarteraActivaMaestra,
  MaestraEsquemaError,
  MaestraBajasMasivasError
} from "./src/utils/maestraSync";
import {
  VENEZUELAN_BANKING_AUDIT_SYSTEM_PROMPT,
  VENEZUELAN_RECEIPT_RESPONSE_SCHEMA,
  detectReceiptMimeType,
  extractSupportWithGemini,
  safeExtractReceiptJson,
  auditAndNormalizeReceiptPayload,
  parseVenezuelanReceiptText,
  parseMontoVenezolano,
  inferirBancoVenezolano,
  AuditedReceiptResult
} from "./src/services/venezuelanReceiptAuditor";
import {
  BCV_INDICE_INVERSION_URL,
  BCV_SMC_URL,
  normalizeBcvDateInput,
  parseNumeroBcv,
  parseBcvIndiceInversionHtml,
  extractBcvExcelLinksFromHtml,
  parseBcvExcelBuffer,
  resolveBcvRateWithBusinessDayFallback
} from "./src/services/bcvRateService";

dotenv.config();

// Prevenir caídas del proceso por errores o rechazos no controlados en tareas asíncronas (como caídas de red o reconexiones VPN)
process.on('uncaughtException', (err: any) => {
  const msg = err?.message || String(err);
  if (msg.includes('firestore') || msg.includes('GrpcConnection') || msg.includes('Name resolution failed') || err?.code === 14) {
    console.warn('[SERVER] Advertencia de red Firestore capturada (VPN/DNS):', msg);
    return;
  }
  console.error('[SERVER] Excepción no controlada capturada:', err);
});

process.on('unhandledRejection', (reason: any, promise) => {
  const msg = reason?.message || String(reason);
  if (msg.includes('firestore') || msg.includes('GrpcConnection') || msg.includes('Name resolution failed') || reason?.code === 14) {
    console.warn('[SERVER] Rechazo de red Firestore capturado (VPN/DNS):', msg);
    return;
  }
  console.error('[SERVER] Promesa rechazada no controlada:', reason);
});

import { db } from './src/lib/firebase';
import {
  VENDOR_PROFILES,
  SUPERVISOR_SUMMARY_COLUMNS,
  getVendorProfile,
  getSupervisorProfile,
  getSupervisedAliases,
  getSupervisedRoutes,
  hydrateVendorProfilesFromMasterCatalog,
  matchesVendorAlias,
  normalizeVendorName
} from './src/utils/vendorRoutes';
import {
  getRuntimeSellerCatalog,
  hydrateRuntimeSellerCatalog
} from './src/utils/maestraCatalogSanitizer';
import {
  getGoogleSheetId,
  buildGoogleSheetExportUrl,
  parseWorkbookFull,
  MasterClientSeed,
  SheetTabMetrics,
  SheetWarning
} from './src/services/googleSheetsParser';
import {
  validateGoogleSheetsUrl,
  isClientActiveInAnyFocusProduct
} from './src/config/sheetsConfig';
import {
  parseSafeNumber,
  type DataQualitySnapshot
} from './src/utils/safeNumber';
import {
  SheetsSyncScheduler,
  DEFAULT_SYNC_INTERVAL_MS,
  DEFAULT_SERVER_CACHE_TTL_MS,
  DEFAULT_MANUAL_COOLDOWN_MS,
  formatCaracasTimestamp,
  type SyncTriggerSource
} from './src/services/sheetsSyncScheduler';
import {
  normalizeVendorKey,
  getCaracasYearMonth
} from './src/utils/vendorKeyNormalizer';
import {
  computeBufferSha256,
  buildHashedUsersForSupabase,
  SyncAuditLogEntry
} from './src/services/monthlySyncEngine';
import {
  SellerNumericSyncTracker,
  type SellerNumericChangeEvent,
  cleanClientCode,
  consolidateSellerToMasterKey,
  normalizeSellerKey
} from './src/services/sheetSyncService';
import { DEFAULT_VENDOR_BCRYPT_CREDENTIALS } from './src/services/defaultUserHashes';
import { canAccessAlkosto, ALKOSTO_ACCESS_DENIED_MESSAGE } from './src/utils/alkostoPermissions';
import {
  normalizeSucursal,
  validateCrossBranchSubmission,
  type Sucursal
} from './src/utils/sucursalScope';
import {
  createTradeSupabaseClients,
  getScopedTradeClient,
  authenticateVendorFromTradeSupabase,
  fetchProductosNacionales,
  fetchClientesPorSucursal,
  fetchRutasPorSucursal,
  fetchVendedoresPorSucursal,
  lookupStoreGlobalSucursal,
  lookupVendorGlobalSucursal
} from './src/services/tradeMultisedeService';
import { collection, doc, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Polyfill WebSocket para compatibilidad total en Node.js < 22 con @supabase/realtime-js
if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    (globalThis as any).WebSocket = require('ws');
  } catch {
    (globalThis as any).WebSocket = class DummyWebSocket {} as any;
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

const tradeSupabaseCfg = createTradeSupabaseClients(process.env);
const tradeSupabase = tradeSupabaseCfg.adminClient || supabase;

// Periodo (YYYY-MM) del mes en curso fijado estrictamente en zona horaria America/Caracas (UTC-4)
export const metasPeriodoActual = (d: Date = new Date()) => getCaracasYearMonth(d);

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('[SECURITY] JWT_SECRET es obligatorio en producción.');
}
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// Middleware de autenticación segura vía JWT
export function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Token de autenticación requerido (Bearer token ausente)' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Token inválido o expirado' });
    }
    req.user = decoded;
    next();
  });
}

export function requireAdmin(req: any, res: any, next: any) {
  if (req.user && req.user.role === 'ADMIN') {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Acceso no autorizado: Se requieren privilegios de Administrador' });
}

export function requireSupervisorOrAdmin(req: any, res: any, next: any) {
  const supProfile = getSupervisorProfile(req.user?.username);
  const role = supProfile ? 'SUPERVISOR' : String(req.user?.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'SUPERVISOR') {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: 'Acceso restringido: Solo Administradores o Supervisores pueden disparar la sincronización global.'
  });
}

export function requireAlkostoAccess(req: any, res: any, next: any) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED',
      error: 'Token de autenticación requerido'
    });
  }

  const allowed = canAccessAlkosto({
    username: user.username,
    role: user.role,
    vendorId: user.vendorId,
    vendorKey: user.vendorKey
  });

  if (!allowed) {
    console.warn(
      `[SECURITY][ALKOSTO] 403 Forbidden - usuario="${String(user.username || 'unknown')}" vendorId="${String(user.vendorId ?? '')}" endpoint="${req.method} ${req.originalUrl}"`
    );
    return res.status(403).json({
      success: false,
      code: 'ALKOSTO_FORBIDDEN',
      error: ALKOSTO_ACCESS_DENIED_MESSAGE
    });
  }

  return next();
}

// Control de rate limiting en memoria por usuario + IP para evitar abuso / Quota Exhaustion
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
export function rateLimiter(windowMs: number, maxRequests: number, label: string) {
  return (req: any, res: any, next: any) => {
    const now = Date.now();
    if (rateLimitMap.size > 5000) {
      for (const [k, rec] of rateLimitMap.entries()) {
        if (now > rec.resetTime) rateLimitMap.delete(k);
      }
    }

    const clientIp = String(req.headers?.['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || 'unknown')
      .split(',')[0]
      .trim();
    const keys = [
      `ip:${clientIp}:${label}`,
      ...(req.user?.username ? [`usr:${String(req.user.username).toUpperCase()}:${label}`] : [])
    ];

    for (const key of keys) {
      const record = rateLimitMap.get(key);
      if (record && now <= record.resetTime && record.count >= maxRequests) {
        const waitSec = Math.ceil((record.resetTime - now) / 1000);
        res.setHeader('Retry-After', String(waitSec));
        return res.status(429).json({
          success: false,
          error: `Límite de solicitudes alcanzado para ${label}. Por favor espera ${waitSec} segundos.`
        });
      }
    }

    for (const key of keys) {
      const record = rateLimitMap.get(key);
      if (!record || now > record.resetTime) {
        rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      } else {
        record.count++;
      }
    }
    next();
  };
}

// Optimización de memoria para Render: NO retener jamás el libro crudo de SheetJS en RAM permanente.
// Solo conservamos hashes SHA-256 ligeros y arreglos tipados procesados; el libro temporal se libera tras parsear.
let lastWorkbookSha256: string = '';
let lastFetchTime = 0;
const CACHE_TTL = DEFAULT_SERVER_CACHE_TTL_MS; // 55 segundos (TTL centralizado de servidor)
const SHEETS_AUTO_SYNC_INTERVAL_MS = (() => {
  const parsed = Number(process.env.SHEETS_SYNC_INTERVAL_MS);
  if (Number.isFinite(parsed) && parsed >= 30000) return Math.round(parsed);
  return DEFAULT_SYNC_INTERVAL_MS; // Sincronización automática con Google Sheet cada 60 segundos
})();
let lastSuccessfulSheetSyncAt: string = '';
let lastSheetDegraded = false;
let lastSheetCooldownRemaining = 0;
let getLiveSchedulerMeta: (() => {
  degraded: boolean;
  cooldownRemainingSeconds: number;
  lastUpdated: string | null;
  lastUpdatedCaracas: string | null;
}) | null = null;
let lastSheetSource: 'live_google_sheet' | 'local_backup' | 'supabase' | 'memory' = 'memory';
let lastSheetMetrics: Record<string, SheetTabMetrics> = {};
let lastSheetWarnings: SheetWarning[] = [];
let lastSheetAuditLogs: SyncAuditLogEntry[] = [];
let lastSheetDataQuality: DataQualitySnapshot | null = null;
let lastLiveProductMaps: Record<string, Map<string, number>> | null = null;
const lastSyncedSha256ByPeriod = new Map<string, string>();
let cachedLocalMasterSeed: MasterClientSeed[] | null = null;

function loadLocalMasterClientSeed(): MasterClientSeed[] {
  if (cachedLocalMasterSeed) return cachedLocalMasterSeed;
  try {
    const seedPath = path.join(process.cwd(), 'scripts', 'data_maestra_octubre_2026.json');
    if (fs.existsSync(seedPath)) {
      const raw = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      if (Array.isArray(raw)) {
        cachedLocalMasterSeed = raw
          .filter((item: any) => item && item.id && item.vendedor)
          .map((item: any) => ({
            cliente_codigo: String(item.id).trim(),
            cliente_nombre: String(item.razonSocial || '').trim(),
            vendedor_id: String(item.vendedor).replace(/\s+/g, ' ').trim(),
            vendedor_nombre: String(item.vendedor).replace(/\s+/g, ' ').trim()
          }));
        return cachedLocalMasterSeed;
      }
    }
  } catch (err: any) {
    console.warn('[SERVER] No se pudo cargar semilla local data_maestra_octubre_2026.json:', err?.message);
  }
  return [];
}

function setNoCacheSyncHeaders(res: any, source?: string, options?: { degraded?: boolean; cooldownRemainingSeconds?: number }) {
  const liveMeta = getLiveSchedulerMeta ? getLiveSchedulerMeta() : null;
  const effectiveSyncAt = liveMeta?.lastUpdated || lastSuccessfulSheetSyncAt;
  const effectiveCaracas = liveMeta?.lastUpdatedCaracas || formatCaracasTimestamp(effectiveSyncAt);
  const isDegraded = options?.degraded ?? liveMeta?.degraded ?? lastSheetDegraded;
  const cooldownRem = options?.cooldownRemainingSeconds ?? liveMeta?.cooldownRemainingSeconds ?? lastSheetCooldownRemaining;

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  if (effectiveSyncAt) {
    res.setHeader('X-Last-Sync', effectiveSyncAt);
    if (effectiveCaracas) {
      res.setHeader('X-Last-Sync-Caracas', effectiveCaracas);
    }
  }
  if (source || lastSheetSource) {
    res.setHeader('X-Sync-Source', source || lastSheetSource);
  }
  res.setHeader('X-Sync-Degraded', isDegraded ? 'true' : 'false');
  if (cooldownRem > 0) {
    res.setHeader('X-Sync-Cooldown-Remaining', String(cooldownRem));
  }
}

async function fetchGoogleSheetWithRetry(url: string, maxAttempts = 3): Promise<ArrayBuffer> {
  const safeUrl = validateGoogleSheetsUrl(url);
  let lastError: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const fetchRes = await fetch(safeUrl, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (!fetchRes.ok) {
        throw new Error(`HTTP ${fetchRes.status} ${fetchRes.statusText}`);
      }
      return await fetchRes.arrayBuffer();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delayMs = 500 * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('Fallo al descargar Google Sheet');
}

/**
 * Carga transitoria del libro Excel de Google Sheets (sin retención en RAM permanente).
 * El caller DEBE extraer los rangos tipados y liberar la referencia al objeto devuelto inmediatamente.
 */
async function loadWorkbookTransient(
  forceLive = false,
  options: { strictLive?: boolean; hasLiveSnapshot?: boolean } = {}
): Promise<{ workbook: any; sha256: string; source: 'live_google_sheet' | 'local_backup' }> {
  const XLSX = await import('xlsx');
  const sheetId = getGoogleSheetId();
  const localPath = path.join(process.cwd(), 'sheet.xlsx');
  let liveDownloadError: Error | null = null;

  // Si no se fuerza descarga en vivo y el respaldo local reciente aún está dentro de TTL, evitar descarga redundante
  if (!forceLive && Date.now() - lastFetchTime < CACHE_TTL && fs.existsSync(localPath)) {
    try {
      const localBuf = fs.readFileSync(localPath);
      const sha = computeBufferSha256(localBuf);
      const wb = XLSX.read(localBuf, { type: 'buffer', raw: true });
      return {
        workbook: wb,
        sha256: sha,
        source: lastSheetSource === 'live_google_sheet' ? 'live_google_sheet' : 'local_backup'
      };
    } catch {
      // Continuar a descarga en vivo
    }
  }

  // 1. Intentar descargar en caliente desde Google Sheets (solo lectura) si GOOGLE_SHEET_ID está parametrizado en el servidor
  if (sheetId) {
    try {
      const exportUrl = buildGoogleSheetExportUrl(sheetId, 'xlsx');
      const arrayBuf = await fetchGoogleSheetWithRetry(exportUrl, 3);
      const nodeBuf = Buffer.from(arrayBuf);
      const sha = computeBufferSha256(nodeBuf);
      lastWorkbookSha256 = sha;
      lastFetchTime = Date.now();
      lastSuccessfulSheetSyncAt = new Date().toISOString();
      lastSheetSource = 'live_google_sheet';
      lastSheetDegraded = false;
      if (!process.env.VITEST && process.env.NODE_ENV !== 'test' && process.env.DISABLE_LOCAL_SHEET_OVERWRITE !== '1') {
        try {
          fs.writeFileSync(localPath, nodeBuf);
        } catch (_) {}
      }
      const wb = XLSX.read(nodeBuf, { type: 'buffer', raw: true });
      return { workbook: wb, sha256: sha, source: 'live_google_sheet' };
    } catch (err: any) {
      liveDownloadError = err instanceof Error ? err : new Error('Fallo descargando Google Sheet');
      console.warn('[SERVER] No se pudo obtener XLSX en vivo desde Google Sheets (se preserva Last-Known-Good si existe).');
    }
  }

  // Last-Known-Good estricto: si ya existe una instantánea viva procesada y el caller pidió validación en vivo,
  // NO sobrescribirla con respaldo local estático — propagar el fallo al scheduler para activar estado degradado limpio.
  if (options.strictLive && liveDownloadError && options.hasLiveSnapshot) {
    throw liveDownloadError;
  }

  // 2. Fallback inicial (cold boot) a copia local de respaldo sheet.xlsx (carga transitoria sin caché global)
  if (fs.existsSync(localPath)) {
    try {
      const localBuf = fs.readFileSync(localPath);
      const sha = computeBufferSha256(localBuf);
      lastWorkbookSha256 = sha;
      lastFetchTime = Date.now();
      lastSheetSource = 'local_backup';
      if (!lastSuccessfulSheetSyncAt) {
        try {
          lastSuccessfulSheetSyncAt = fs.statSync(localPath).mtime.toISOString();
        } catch {
          lastSuccessfulSheetSyncAt = new Date().toISOString();
        }
      }
      const wb = XLSX.read(localBuf, { type: 'buffer', raw: true });
      return { workbook: wb, sha256: sha, source: 'local_backup' };
    } catch (fsErr: any) {
      console.warn('[SERVER] Error leyendo archivo local sheet.xlsx:', fsErr?.message);
    }
  }

  throw liveDownloadError || new Error('No se pudo cargar el libro de datos ni en línea ni desde el respaldo local.');
}


async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
      return res.status(400).json({ success: false, error: 'JSON malformado en la petición' });
    }
    next(err);
  });

  // CORS Middleware estricto por allowlist (Render oficial, Trade Marketing y localhost en desarrollo)
  const allowedCorsOrigins = new Set<string>([
    'https://dashboard-fdv-planificador.onrender.com',
    'https://trade-marketing-qi6j.onrender.com',
    ...String(process.env.ALLOWED_CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  ]);

  const isOriginAllowed = (origin: string): boolean => {
    if (allowedCorsOrigins.has(origin)) return true;
    if (process.env.NODE_ENV !== 'production') {
      try {
        const parsed = new URL(origin);
        if (
          (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
          (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
        ) {
          return true;
        }
      } catch {
        return false;
      }
    }
    return false;
  };

  app.use((req, res, next) => {
    const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
    res.header('Vary', 'Origin');

    if (requestOrigin) {
      if (isOriginAllowed(requestOrigin)) {
        res.header('Access-Control-Allow-Origin', requestOrigin);
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, X-Idempotency-Key, X-Sync-Token, X-Active-Sucursal');
        res.header('Access-Control-Expose-Headers', 'X-Last-Sync, X-Last-Sync-Caracas, X-Sync-Source, X-Sync-Degraded, X-Sync-Cooldown-Remaining');
      } else if (req.method === 'OPTIONS') {
        return res.status(403).json({ success: false, error: 'Origen CORS no autorizado.' });
      }
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  const SERVER_STARTED_AT_ISO = new Date().toISOString();
  const APP_DEPLOY_COMMIT = String(process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'local').trim().slice(0, 12);
  const APP_DEPLOY_BRANCH = String(process.env.RENDER_GIT_BRANCH || 'master').trim();
  let getHealthSyncSummary: (() => {
    lastSyncAt: string | null;
    lastSyncCaracas: string | null;
    isSyncing: boolean;
    degraded: boolean;
    trackedSellers: number;
  }) | null = null;

  // Health check con observabilidad de versión desplegada en Render (cero secretos)
  app.get("/api/health", (_req, res) => {
    const syncSummary = getHealthSyncSummary ? getHealthSyncSummary() : null;
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('X-App-Commit', APP_DEPLOY_COMMIT);
    res.json({
      status: "ok",
      commit: APP_DEPLOY_COMMIT,
      branch: APP_DEPLOY_BRANCH,
      startedAt: SERVER_STARTED_AT_ISO,
      uptimeSeconds: Math.round(process.uptime()),
      sync: syncSummary
    });
  });

  // ==============================================================
  // ENDPOINT DE AUTENTICACIÓN SEGURA (BCRYPT EXCLUSIVO - CERO TEXTO PLANO)
  // ==============================================================
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Usuario y contraseña requeridos' });
      }

      const usuarioUpper = String(username).toUpperCase().trim();
      const pwd = String(password).trim();
      const pwdClean = pwd.replace(/\D/g, '');
      const usuarioNorm = normalizeVendorKey(usuarioUpper);

      let creds = DEFAULT_VENDOR_BCRYPT_CREDENTIALS[usuarioUpper];
      let matchedCanonicalKey = usuarioUpper;
      if (!creds) {
        for (const [key, val] of Object.entries(DEFAULT_VENDOR_BCRYPT_CREDENTIALS)) {
          if (normalizeVendorKey(key) === usuarioNorm) {
            creds = val;
            matchedCanonicalKey = key;
            break;
          }
        }
      }

      const verifyAgainstHash = async (candidateHash: string): Promise<boolean> => {
        if (!candidateHash) return false;
        if (candidateHash.startsWith('$2')) {
          if (await bcrypt.compare(pwd, candidateHash)) return true;
          if (pwdClean && pwdClean !== pwd && (await bcrypt.compare(pwdClean, candidateHash))) return true;
          return false;
        }
        // Compatibilidad transitoria si la fila en BD aún no ha pasado por el primer hash bcrypt(12)
        return pwd === candidateHash || (Boolean(pwdClean) && pwdClean === candidateHash);
      };

      // 1A. Intentar autenticación multisede contra tabla `vendedores` / `vendedores_fdv` en Supabase compartido (CENTRO | OCCIDENTE)
      if (tradeSupabase) {
        const tradeAuth = await authenticateVendorFromTradeSupabase(tradeSupabase, usuarioUpper, pwd);
        if (tradeAuth.matched) {
          if (tradeAuth.inactive) {
            return res.status(401).json({ success: false, error: 'Usuario inactivo o deshabilitado' });
          }
          if (!tradeAuth.validPassword || !tradeAuth.user) {
            return res.status(401).json({ success: false, error: 'Contraseña incorrecta' });
          }
          const tu = tradeAuth.user;
          hydrateVendorProfilesFromMasterCatalog([
            {
              username: tu.username,
              nombre: tu.displayName,
              ruta: tu.ruta,
              sucursal: tu.sucursal,
              role: tu.role,
              email: tu.email,
              activo: true
            }
          ]);
          const token = jwt.sign(
            {
              username: tu.username,
              displayName: tu.displayName,
              role: tu.role,
              vendorId: tu.vendorId,
              ruta: tu.ruta,
              sucursal: tu.sucursal,
              vendorKey: normalizeVendorKey(tu.username)
            },
            JWT_SECRET,
            { expiresIn: '7d' }
          );
          return res.json({
            success: true,
            token,
            user: {
              username: tu.username,
              displayName: tu.displayName,
              role: tu.role,
              vendorId: tu.vendorId,
              ruta: tu.ruta,
              sucursal: tu.sucursal
            },
            source: tu.source
          });
        }
      }

      // 1B. Intentar autenticación contra tabla `usuarios` de Supabase si existe
      if (supabase) {
        try {
          let supaUser: any = null;
          let supaErr: any = null;
          const withSucRes = await supabase
            .from('usuarios')
            .select('username,password_hash,role,vendor_id,activo,sucursal')
            .in('username', [usuarioUpper, matchedCanonicalKey])
            .maybeSingle();
          if (withSucRes.error && /sucursal|schema cache|42703/i.test(String(withSucRes.error.message || withSucRes.error.code || ''))) {
            const legacyRes = await supabase
              .from('usuarios')
              .select('username,password_hash,role,vendor_id,activo')
              .in('username', [usuarioUpper, matchedCanonicalKey])
              .maybeSingle();
            supaUser = legacyRes.data;
            supaErr = legacyRes.error;
          } else {
            supaUser = withSucRes.data;
            supaErr = withSucRes.error;
          }

          if (!supaErr && supaUser) {
            if (supaUser.activo === false) {
              return res.status(401).json({ success: false, error: 'Usuario inactivo o deshabilitado' });
            }

            let isValid = await verifyAgainstHash(String(supaUser.password_hash || ''));
            if (!isValid && creds) {
              isValid = await verifyAgainstHash(creds.passwordHash);
            }

            if (isValid) {
              // Auto-migrar en caliente a bcrypt(12) si el registro en BD aún estaba sin hashear
              if (supaUser.password_hash && !String(supaUser.password_hash).startsWith('$2')) {
                bcrypt.hash(pwdClean || pwd, 12).then((upgradedHash) => {
                  supabase
                    .from('usuarios')
                    .update({ password_hash: upgradedHash, updated_at: new Date().toISOString() })
                    .eq('username', supaUser.username)
                    .then(() => {}, () => {});
                }).catch(() => {});
              }

              const supProfile = getSupervisorProfile(supaUser.username);
              const resolvedRole = supProfile ? 'SUPERVISOR' : supaUser.role;
              const canonicalUser = matchedCanonicalKey || supaUser.username;
              const resolvedSucursal: Sucursal =
                normalizeSucursal(supaUser.sucursal) ||
                (resolvedRole === 'ADMIN' ? normalizeSucursal(req.body?.sucursal) : null) ||
                supProfile?.sucursal ||
                getVendorProfile(canonicalUser).sucursal ||
                'OCCIDENTE';

              const token = jwt.sign(
                {
                  username: canonicalUser,
                  role: resolvedRole,
                  vendorId: supaUser.vendor_id,
                  sucursal: resolvedSucursal,
                  vendorKey: normalizeVendorKey(canonicalUser)
                },
                JWT_SECRET,
                { expiresIn: '7d' }
              );

              return res.json({
                success: true,
                token,
                user: {
                  username: canonicalUser,
                  role: resolvedRole,
                  vendorId: supaUser.vendor_id,
                  sucursal: resolvedSucursal
                },
                source: 'supabase'
              });
            } else {
              return res.status(401).json({ success: false, error: 'Contraseña incorrecta' });
            }
          }
        } catch {
          // Fallback a hashes bcrypt locales si Supabase no responde
        }
      }

      if (!creds) {
        return res.status(401).json({ success: false, error: 'Usuario no autorizado o no encontrado en la base de datos' });
      }

      // Permitir override de hash de administrador vía variable de entorno ADMIN_PASSWORD_HASH / ADMIN_PASSWORD
      let isValidPwd = false;
      if (matchedCanonicalKey === 'ADMIN' && process.env.ADMIN_PASSWORD_HASH) {
        isValidPwd = await verifyAgainstHash(process.env.ADMIN_PASSWORD_HASH);
      } else if (matchedCanonicalKey === 'ADMIN' && process.env.ADMIN_PASSWORD) {
        isValidPwd = pwd === process.env.ADMIN_PASSWORD;
      } else {
        isValidPwd = await verifyAgainstHash(creds.passwordHash);
      }

      if (!isValidPwd) {
        return res.status(401).json({ success: false, error: 'Contraseña incorrecta' });
      }

      const localSucursal: Sucursal =
        creds.role === 'ADMIN'
          ? (normalizeSucursal(req.body?.sucursal) || 'OCCIDENTE')
          : (getSupervisorProfile(matchedCanonicalKey)?.sucursal || getVendorProfile(matchedCanonicalKey).sucursal || 'OCCIDENTE');

      const token = jwt.sign(
        {
          username: matchedCanonicalKey,
          role: creds.role,
          vendorId: creds.vendorId,
          sucursal: localSucursal,
          vendorKey: normalizeVendorKey(matchedCanonicalKey)
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        token,
        user: {
          username: matchedCanonicalKey,
          role: creds.role,
          vendorId: creds.vendorId,
          sucursal: localSucursal
        },
        source: 'local'
      });
    } catch {
      return res.status(500).json({ success: false, error: 'Error interno en autenticación' });
    }
  });

  // Verificación de sesión activa y perfil del usuario autenticado (con sucursal autoritativa)
  app.get("/api/auth/me", authenticateToken, (req: any, res: any) => {
    const supProfile = getSupervisorProfile(req.user?.username);
    const resolvedRole = supProfile ? 'SUPERVISOR' : req.user.role;
    const resolvedSucursal: Sucursal =
      normalizeSucursal(req.user?.sucursal) ||
      supProfile?.sucursal ||
      getVendorProfile(req.user?.username || '').sucursal ||
      'OCCIDENTE';
    return res.json({
      success: true,
      user: {
        username: req.user.username,
        role: resolvedRole,
        vendorId: req.user.vendorId,
        ruta: req.user.ruta,
        sucursal: resolvedSucursal
      }
    });
  });

  // ==============================================================
  // ENDPOINTS DE DEGUSTACIONES Y TRADE MARKETING
  // Permite sincronización directa con https://dashboardgerencia01.ai.studio/
  // ==============================================================
  const EXCLUDED_TEST_DEG_IDS = new Set([
    'deg-001', 'deg-002', 'deg-003', 'deg-mupk8tih-e3wf', 'deg-muplzpkm-ncuu', 'test-ping-01'
  ]);

  function normalizeDegustacionRecord(raw: any, fallbackSucursal?: Sucursal): any {
    const cleanId = String(raw.id || raw.degustacionId || '').replace(/^DEG-/, '');
    const resolvedSucursal = normalizeSucursal(raw.sucursal) || fallbackSucursal || 'OCCIDENTE';
    return {
      id: cleanId,
      sucursal: resolvedSucursal,
      clienteCodigo: raw.clienteCodigo || raw.cliente_codigo || 'PDV',
      clienteNombre: raw.clienteNombre || raw.cliente_nombre || raw.client || 'Punto de Venta',
      vendedorNombre: raw.vendedorNombre || raw.vendedor_nombre || raw.vendedor || 'Vendedor',
      vendedorId: raw.vendedorId || raw.vendedor_id || raw.ruta || '1',
      vendedorEmail: raw.vendedorEmail || raw.vendedor_email || undefined,
      ruta: raw.ruta || raw.zone || raw.vendedorId || raw.vendedor_id || '',
      fecha: raw.fecha || raw.date || '',
      turno: raw.turno || 'MAÑANA',
      hora: raw.hora || raw.time || '',
      productos: Array.isArray(raw.productos)
        ? raw.productos
        : (typeof raw.productos === 'string' && raw.productos ? raw.productos.split(',').map((s: string) => s.trim()) : []),
      kilosEstimados: Number(raw.kilosEstimados ?? raw.kilos_estimados) || 0,
      personasEstimadas: Number(raw.personasEstimadas ?? raw.personas_estimadas) || 150,
      requierePromotora: Boolean(raw.requierePromotora ?? raw.requiere_promotora ?? true),
      promotoraAsignada: raw.promotoraAsignada || raw.promotora_asignada || '',
      materialPop: Boolean(raw.materialPop ?? raw.material_pop ?? true),
      contactoPunto: raw.contactoPunto || raw.contacto_punto || '',
      telefonoContacto: raw.telefonoContacto || raw.telefono_contacto || '',
      observaciones: raw.observaciones || '',
      estado: raw.estado || 'SOLICITADA',
      notasTradeMarketing: raw.notasTradeMarketing || raw.notas_trade_marketing || '',
      resultado: raw.resultado || null,
      createdAt: raw.createdAt || raw.created_at || new Date().toISOString()
    };
  }

  /**
   * Resuelve y valida el alcance de `sucursal` ('CENTRO' | 'OCCIDENTE') para el request autenticado.
   * - VENDEDOR / SUPERVISOR / COORDINADORA: estrictamente atados al claim `sucursal` firmado en su JWT.
   *   Cualquier intento de consultar u operar otra sucursal por query/header/body retorna 403.
   * - ADMIN: puede operar en la sucursal activa solicitada explícitamente ('CENTRO' | 'OCCIDENTE').
   */
  function resolveRequestSucursalScope(req: any):
    | { ok: true; sucursal: Sucursal; role: string; status?: number; code?: string; error?: string }
    | { ok: false; sucursal?: Sucursal; role?: string; status: number; code: string; error: string } {
    const user = req.user;
    if (!user) {
      return { ok: false, status: 401, code: 'AUTH_REQUIRED', error: 'Token de autenticación requerido' };
    }
    const roleUpper = String(user.role || 'VENDEDOR').toUpperCase().trim();
    const tokenSucursal: Sucursal = normalizeSucursal(user.sucursal) || 'OCCIDENTE';

    const rawRequested =
      req.headers?.['x-active-sucursal'] ??
      req.query?.sucursal ??
      req.body?.sucursal;

    if (rawRequested !== undefined && rawRequested !== null && String(rawRequested).trim() !== '') {
      const parsedReq = normalizeSucursal(rawRequested);
      if (!parsedReq) {
        return {
          ok: false,
          status: 400,
          code: 'INVALID_SUCURSAL_VALUE',
          error: `Sucursal inválida "${String(rawRequested)}". Valores permitidos: 'CENTRO' | 'OCCIDENTE'.`
        };
      }
      if (roleUpper !== 'ADMIN' && parsedReq !== tokenSucursal) {
        return {
          ok: false,
          status: 403,
          code: 'SUCURSAL_TAMPERING_DETECTED',
          error: `Acceso multisede denegado: tu sesión pertenece a ${tokenSucursal} y no tiene permisos sobre ${parsedReq}.`
        };
      }
      return { ok: true, sucursal: parsedReq, role: roleUpper };
    }

    return { ok: true, sucursal: tokenSucursal, role: roleUpper };
  }

  function sortDegustacionesServer(list: any[], ascending: boolean = false): any[] {
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
      const dateA = toIsoDate(a.fecha || a.date);
      const dateB = toIsoDate(b.fecha || b.date);
      if (dateA !== dateB) {
        return ascending ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      }

      const rankA = shiftRank(a.turno, a.hora || a.time);
      const rankB = shiftRank(b.turno, b.hora || b.time);
      if (rankA !== rankB) {
        return ascending ? rankB - rankA : rankA - rankB;
      }

      const vendA = String(a.vendedorNombre || a.vendedor || '').toUpperCase().trim();
      const vendB = String(b.vendedorNombre || b.vendedor || '').toUpperCase().trim();
      if (vendA !== vendB) {
        return ascending ? vendB.localeCompare(vendA, 'es') : vendA.localeCompare(vendB, 'es');
      }

      const cliA = String(a.clienteNombre || a.client || '').toUpperCase().trim();
      const cliB = String(b.clienteNombre || b.client || '').toUpperCase().trim();
      if (cliA !== cliB) {
        return ascending ? cliB.localeCompare(cliA, 'es') : cliA.localeCompare(cliB, 'es');
      }

      return ascending
        ? String(b.id || '').localeCompare(String(a.id || ''))
        : String(a.id || '').localeCompare(String(b.id || ''));
    });
  }

  // Almacén en memoria de respaldo (modo offline/QA) + estructuras de idempotencia y serialización
  const degustacionesMemoryStore = new Map<string, any>();
  const inFlightDegustacionCreates = new Map<string, Promise<{ record: any; sync: any }>>();
  const completedDegustacionIdempotency = new Map<string, { record: any; sync: any; expiresAt: number }>();
  const DEGUSTACION_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
  const surveyUpsertLocks = new Map<string, Promise<any>>();
  let tradeJsonWriteQueue: Promise<void> = Promise.resolve();
  let inFlightFullTradeSync: Promise<{ total: number; synced: number; timestamp: string }> | null = null;

  function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    let timer: any;
    const timeoutPromise = new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), timeoutMs);
    });
    return Promise.race([
      promise.finally(() => clearTimeout(timer)),
      timeoutPromise
    ]);
  }

  async function fetchWithRetry(
    url: string,
    options: RequestInit = {},
    config: { timeoutMs?: number; maxAttempts?: number } = {}
  ): Promise<Response> {
    const timeoutMs = config.timeoutMs ?? 10000;
    const maxAttempts = config.maxAttempts ?? 2;
    let lastErr: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt - 1)));
          continue;
        }
        return res;
      } catch (err: any) {
        clearTimeout(timer);
        lastErr = err;
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt - 1)));
          continue;
        }
      }
    }
    throw lastErr || new Error(`Fetch failed for ${url}`);
  }

  async function loadAllMergedDegustaciones(
    scopeSucursal: Sucursal,
    actor?: { username: string; role: string; vendorId: string }
  ): Promise<any[]> {
    const mapById = new Map<string, any>();
    const activeClient = actor
      ? getScopedTradeClient(tradeSupabaseCfg, {
          username: actor.username,
          role: actor.role,
          vendorId: actor.vendorId,
          sucursal: scopeSucursal
        })
      : tradeSupabase;

    if (activeClient) {
      try {
        let supaList: any[] | null = null;
        const { data, error } = await activeClient
          .from('degustaciones')
          .select('*')
          .eq('sucursal', scopeSucursal)
          .order('fecha', { ascending: false });

        if (!error && Array.isArray(data)) {
          supaList = data;
        } else if (
          error &&
          !tradeSupabaseCfg.strictSucursalColumn &&
          scopeSucursal === 'OCCIDENTE' &&
          /sucursal|schema cache|42703|PGRST204/i.test(String(error.message || error.code || ''))
        ) {
          // Compatibilidad transitoria solo para OCCIDENTE si la BD legacy aún no tiene columna sucursal
          // (NUNCA exponer filas legacy de Occidente a una sesión de CENTRO)
          const legacyRes = await activeClient
            .from('degustaciones')
            .select('*')
            .order('fecha', { ascending: false });
          if (!legacyRes.error && Array.isArray(legacyRes.data)) {
            supaList = legacyRes.data;
          }
        }

        if (Array.isArray(supaList)) {
          for (const row of supaList) {
            const rowBranch = normalizeSucursal(row.sucursal) || 'OCCIDENTE';
            if (rowBranch !== scopeSucursal) continue;
            const norm = normalizeDegustacionRecord(row, scopeSucursal);
            if (norm.id && !EXCLUDED_TEST_DEG_IDS.has(norm.id) && !norm.id.startsWith('test-')) {
              mapById.set(norm.id, norm);
            }
          }
        }
      } catch (_) {}
    }

    for (const [memId, memRecord] of degustacionesMemoryStore.entries()) {
      if (memId && !EXCLUDED_TEST_DEG_IDS.has(memId) && !memId.startsWith('test-')) {
        const memBranch = normalizeSucursal(memRecord.sucursal) || 'OCCIDENTE';
        if (memBranch === scopeSucursal) {
          mapById.set(memId, normalizeDegustacionRecord(memRecord, scopeSucursal));
        }
      }
    }

    return sortDegustacionesServer(Array.from(mapById.values()), false);
  }

  // CATÁLOGOS DELIMITADOS POR SUCURSAL (Tiendas, Rutas, Vendedores de la sede + Productos Nacionales 100%)
  app.get("/api/degustaciones/catalogos", authenticateToken, async (req: any, res: any) => {
    try {
      const scope = resolveRequestSucursalScope(req);
      if (!scope.ok) {
        return res.status(scope.status).json({ success: false, code: scope.code, error: scope.error });
      }
      const targetSucursal = scope.sucursal;
      const scopedClient = getScopedTradeClient(tradeSupabaseCfg, {
        username: req.user.username,
        role: scope.role,
        vendorId: String(req.user.vendorId || ''),
        sucursal: targetSucursal
      });

      const [clientesRes, rutas, vendedores, productos] = await Promise.all([
        fetchClientesPorSucursal(
          scopedClient,
          targetSucursal,
          { username: req.user.username, role: scope.role, vendorId: req.user.vendorId },
          cachedActivacionParsed || undefined
        ),
        fetchRutasPorSucursal(scopedClient, targetSucursal, {
          username: req.user.username,
          role: scope.role
        }),
        fetchVendedoresPorSucursal(scopedClient, targetSucursal, {
          username: req.user.username,
          role: scope.role
        }),
        fetchProductosNacionales(scopedClient)
      ]);

      if (vendedores.length > 0) {
        hydrateVendorProfilesFromMasterCatalog(
          vendedores.map((v) => ({
            username: v.username,
            nombre: v.nombre,
            ruta: v.ruta,
            supervisor: v.supervisor,
            sucursal: v.sucursal,
            role: v.role,
            activo: true
          }))
        );
      }

      return res.json({
        success: true,
        sucursal: targetSucursal,
        clientes: clientesRes.items,
        rutas,
        vendedores,
        productos
      });
    } catch (err: any) {
      console.error("Error consultando catálogos multisede de degustaciones:", err);
      return res.status(500).json({
        success: false,
        error: "Error al cargar catálogos de la sucursal",
        details: err?.message
      });
    }
  });

  app.get("/api/degustaciones", authenticateToken, async (req: any, res: any) => {
    try {
      const scope = resolveRequestSucursalScope(req);
      if (!scope.ok) {
        return res.status(scope.status).json({ success: false, code: scope.code, error: scope.error });
      }

      let list = await loadAllMergedDegustaciones(scope.sucursal, {
        username: req.user.username,
        role: scope.role,
        vendorId: String(req.user.vendorId || '')
      });

      // Si se solicita explícitamente solo las propias del vendedor (`?mine=true`)
      if (req.query.mine === 'true' && scope.role === 'VENDEDOR') {
        const uKey = String(req.user.username || '').toUpperCase().trim();
        const uId = String(req.user.vendorId || '').toUpperCase().trim();
        list = list.filter((d) => {
          const dv = String(d.vendedorNombre || '').toUpperCase().trim();
          const dvid = String(d.vendedorId || '').toUpperCase().trim();
          return (
            (uKey && (dv.includes(uKey) || uKey.includes(dv))) ||
            (uId && dvid === uId)
          );
        });
      }

      // Filtros opcionales dentro de la misma sucursal autorizada
      if (req.query.id) {
        const cleanReqId = String(req.query.id).replace(/^DEG-/, '').trim();
        list = list.filter(d => String(d.id || '').replace(/^DEG-/, '') === cleanReqId);
      }
      if (req.query.tag) {
        const t = String(req.query.tag).toUpperCase().trim();
        list = list.filter(d =>
          String(d.id || '').toUpperCase().includes(t) ||
          String(d.clienteNombre || '').toUpperCase().includes(t) ||
          String(d.observaciones || '').toUpperCase().includes(t)
        );
      }
      if (req.query.vendedor) {
        const v = String(req.query.vendedor).toUpperCase().trim();
        list = list.filter(d => 
          (d.vendedorNombre || '').toUpperCase().includes(v) ||
          (d.vendedorId || '').toUpperCase().includes(v)
        );
      }
      if (req.query.estado) {
        const e = String(req.query.estado).toUpperCase().trim();
        list = list.filter(d => (d.estado || '').toUpperCase() === e);
      }
      if (req.query.fecha) {
        const f = String(req.query.fecha).trim();
        list = list.filter(d => d.fecha === f);
      }

      res.json({
        success: true,
        sucursal: scope.sucursal,
        count: list.length,
        data: list,
        source: tradeSupabase ? 'supabase_primary' : 'memory_fallback'
      });
    } catch (err: any) {
      console.error("Error fetching degustaciones via API:", err);
      res.status(500).json({ error: "Error al consultar degustaciones", details: err?.message });
    }
  });

  const GOOGLE_SCRIPT_WEBHOOK_URL = process.env.GOOGLE_SCRIPT_WEBHOOK_URL || '';
  const GERENCIA_TRADE_API_URL =
    process.env.TRADE_MARKETING_API_URL ||
    process.env.GERENCIA_TRADE_API_URL ||
    '';
  const TRADE_MARKETING_API_KEY = process.env.TRADE_MARKETING_API_KEY || '';
  const GERENCIA_UTERIO_SURVEYS_URL = process.env.GERENCIA_UTERIO_SURVEYS_URL || '';
  const GERENCIA_UTERIO_ANON_KEY = process.env.GERENCIA_UTERIO_ANON_KEY || '';
  const GERENCIA_SUPABASE_SURVEYS_URL = process.env.GERENCIA_SUPABASE_SURVEYS_URL || (SUPABASE_URL ? `${SUPABASE_URL}/rest/v1/surveys` : '');
  const GERENCIA_SUPABASE_ANON_KEY = process.env.GERENCIA_SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY || '';

  // Configuración de Supabase para el Programa de Pedidos Manuales (gestor-de-pedidos-pro)
  const PEDIDOS_MANUALES_SUPABASE_URL = process.env.PEDIDOS_MANUALES_SUPABASE_URL || 'https://vxduxyrbeybhhbpdyqoc.supabase.co';
  const PEDIDOS_MANUALES_SUPABASE_KEY = process.env.PEDIDOS_MANUALES_SUPABASE_KEY || '';

  function buildTradeMarketingItemServer(rawItem: any, existingRemote?: any) {
    const item = normalizeDegustacionRecord(rawItem);
    const recordId = `DEG-${item.id}`;

    let dmyDate = String(item.fecha || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dmyDate)) {
      const [y, m, day] = dmyDate.split('-');
      dmyDate = `${day}/${m}/${y}`;
    }

    const timeStr = (item.hora && item.hora.trim())
      ? item.hora.trim()
      : (item.turno === 'TARDE' ? '02:00 PM - 07:00 PM' : '09:00 AM - 01:00 PM');

    const productStr = Array.isArray(item.productos) && item.productos.length > 0
      ? item.productos.join(', ')
      : (item.productos || 'MORTADELA');

    const vendedorName = String(item.vendedorNombre || 'VENDEDOR COMERCIAL').trim();
    const clientName = String(item.clienteNombre || 'Punto de Venta').trim();
    const zoneName = String(item.ruta || item.vendedorId || vendedorName || 'Ruta Comercial').trim();
    const kilosNum = Number(item.kilosEstimados) || 5;
    const targetNum = Number(item.personasEstimadas) || 150;

    let status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' = 'scheduled';
    const norm = String(item.estado || 'SOLICITADA').toUpperCase().trim();
    if (norm === 'REALIZADA' || norm === 'COMPLETED') status = 'completed';
    else if (norm === 'CANCELADA' || norm === 'RECHAZADA' || norm === 'CANCELLED') status = 'cancelled';

    if (existingRemote && existingRemote.status && existingRemote.status !== 'scheduled' && status === 'scheduled') {
      status = existingRemote.status;
    }

    const rawPromoter = String(item.promotoraAsignada || '').trim();
    const hasLocalAssigned = rawPromoter && !rawPromoter.toUpperCase().includes('POR ASIGNAR');
    const hasRemoteAssigned = existingRemote?.promoter && !String(existingRemote.promoter).toUpperCase().includes('POR ASIGNAR');

    const promoter = hasLocalAssigned
      ? rawPromoter
      : (hasRemoteAssigned ? existingRemote.promoter : 'POR ASIGNAR (Trade Marketing)');

    const promoterEmail = hasRemoteAssigned ? (existingRemote.promoterEmail || '') : '';
    const promoterId = hasRemoteAssigned ? (existingRemote.promoterId || '') : '';
    const promoterRole = hasRemoteAssigned && existingRemote.promoterRole ? existingRemote.promoterRole : 'Impulsadora';

    const contactPrefix = item.contactoPunto
      ? `Contacto en tienda: ${item.contactoPunto.trim()}${item.telefonoContacto ? ` (${item.telefonoContacto.trim()})` : ''}. `
      : '';
    const obsClean = String(item.observaciones || '').trim();
    const bodyNote = obsClean
      ? obsClean
      : `Agendada por ${vendedorName}. Kilos: ${kilosNum}. Personas: ${targetNum}.`;
    const fullComments = `${contactPrefix}${bodyNote}`.trim();

    return {
      id: recordId,
      date: dmyDate,
      time: timeStr,
      activity: `Degustación ${productStr} - Solicitada por ${vendedorName}`,
      product: productStr,
      promoter,
      ...(promoterEmail ? { promoterEmail } : {}),
      ...(promoterId ? { promoterId } : {}),
      promoterRole,
      client: clientName,
      zone: zoneName,
      vendedor: vendedorName,
      source: 'vendedor_app',
      status,
      delivered: Number(item.resultado?.personasAlcanzadas || existingRemote?.delivered || 0),
      target: targetNum,
      acceptanceRate: Number(existingRemote?.acceptanceRate || (status === 'completed' ? 95 : 0)),
      comments: fullComments
    };
  }

  // Sincronizador serializado y atómico para data_degustaciones.json local (sin escrituras concurrentes destructivas ni rutas externas)
  function enqueueTradeJsonOperation(op: () => Promise<void>): Promise<void> {
    const next = tradeJsonWriteQueue.then(op).catch((err: any) => {
      console.warn("[SYNC TRADE] Error en cola de escritura JSON local:", err?.message);
    });
    tradeJsonWriteQueue = next;
    return next;
  }

  function syncToTradeMarketingJson(itemOrList: any | any[]): Promise<void> {
    return enqueueTradeJsonOperation(async () => {
      const items = sortDegustacionesServer(Array.isArray(itemOrList) ? itemOrList : [itemOrList], false);
      const localPath = path.resolve(process.cwd(), 'data_degustaciones.json');

      let existing: any[] = [];
      try {
        if (fs.existsSync(localPath)) {
          const raw = await fs.promises.readFile(localPath, 'utf8');
          existing = JSON.parse(raw || '[]');
        }
      } catch (_) {}

      const existingMap = new Map<string, any>();
      const historicalItems: any[] = [];
      existing.forEach(e => {
        if (!e || !e.id) return;
        const normId = String(e.id).startsWith('DEG-') ? String(e.id) : `DEG-${e.id}`;
        existingMap.set(normId, e);
        if (String(e.id).startsWith('DEG-HIST-')) {
          historicalItems.push(e);
        }
      });

      const updatedVendorMap = new Map<string, any>();
      if (!Array.isArray(itemOrList)) {
        existing.forEach(e => {
          if (e && e.id && !String(e.id).startsWith('DEG-HIST-')) {
            const normId = String(e.id).startsWith('DEG-') ? String(e.id) : `DEG-${e.id}`;
            updatedVendorMap.set(normId, e);
          }
        });
      }

      for (const rawItem of items) {
        if (!rawItem || (!rawItem.id && !rawItem.degustacionId)) continue;
        const cleanId = String(rawItem.id || rawItem.degustacionId).replace(/^DEG-/, '');
        const degId = `DEG-${cleanId}`;
        const built = buildTradeMarketingItemServer(rawItem, existingMap.get(degId));
        updatedVendorMap.set(degId, built);
      }

      const vendorItems = Array.from(updatedVendorMap.values());
      vendorItems.sort((a, b) => {
        const toIso = (s: string) => {
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(s || '')) {
            const [d, m, y] = s.split('/');
            return `${y}-${m}-${d}`;
          }
          return s || '';
        };
        const dA = toIso(a.date);
        const dB = toIso(b.date);
        if (dA !== dB) return dB.localeCompare(dA);
        const tA = String(a.time || '').includes('09:') ? 1 : 2;
        const tB = String(b.time || '').includes('09:') ? 1 : 2;
        if (tA !== tB) return tA - tB;
        return String(a.vendedor || '').localeCompare(String(b.vendedor || ''), 'es');
      });

      const finalJsonList = [...vendorItems, ...historicalItems];
      const tmpPath = `${localPath}.${process.pid}.${Date.now()}.tmp`;
      await fs.promises.writeFile(tmpPath, JSON.stringify(finalJsonList, null, 2), 'utf8');
      await fs.promises.rename(tmpPath, localPath);
    });
  }

  function deleteFromTradeMarketingJson(id: string): Promise<void> {
    return enqueueTradeJsonOperation(async () => {
      const cleanId = String(id).replace(/^DEG-/, '');
      const degId = `DEG-${cleanId}`;
      const localPath = path.resolve(process.cwd(), 'data_degustaciones.json');
      if (!fs.existsSync(localPath)) return;
      const raw = await fs.promises.readFile(localPath, 'utf8');
      const existing: any[] = JSON.parse(raw || '[]');
      const filtered = existing.filter(e => e.id !== id && e.id !== cleanId && e.id !== degId);
      const tmpPath = `${localPath}.${process.pid}.${Date.now()}.tmp`;
      await fs.promises.writeFile(tmpPath, JSON.stringify(filtered, null, 2), 'utf8');
      await fs.promises.rename(tmpPath, localPath);
    });
  }

  function buildGerenciaDirectPayload(rawItem: any) {
    const item = normalizeDegustacionRecord(rawItem);
    const normEstado = (item.estado || 'SOLICITADA').toUpperCase();
    let status = 'Solicitada';
    if (normEstado === 'APROBADA') status = 'Aprobada';
    else if (normEstado === 'RECHAZADA') status = 'Rechazada';
    else if (normEstado === 'CANCELADA') status = 'Cancelada';
    else if (normEstado === 'REALIZADA') status = 'Realizada';

    let shift = 'Mañana (9:00 AM - 1:00 PM)';
    if (item.turno === 'TARDE') shift = 'Tarde (2:00 PM - 7:00 PM)';
    else if (item.turno === 'COMPLETO') shift = 'Día Completo';

    const productListStr = Array.isArray(item.productos) && item.productos.length > 0
      ? item.productos.join(', ')
      : (item.productos || 'MORTADELA');

    const rawPromoter = String(item.promotoraAsignada || '').trim();
    const promoterAssigned = (rawPromoter && !rawPromoter.toUpperCase().includes('POR ASIGNAR'))
      ? rawPromoter
      : '';

    const commentsObj = {
      isTasting: true,
      source: 'vendedor_app',
      degustacionId: item.id,
      id: item.id,
      client: item.clienteNombre,
      cliente: item.clienteNombre,
      clienteCodigo: item.clienteCodigo || 'PDV',
      store: item.clienteNombre,
      vendedor: item.vendedorNombre,
      salesRep: item.vendedorNombre,
      promoter: promoterAssigned || 'POR ASIGNAR (Trade Marketing)',
      promotoraAsignada: promoterAssigned,
      ruta: item.ruta || item.vendedorId || '',
      date: item.fecha || new Date().toISOString().split('T')[0],
      turno: item.turno || 'MAÑANA',
      shift: shift,
      time: item.hora || (item.turno === 'MAÑANA' ? '09:00 AM - 01:00 PM' : '02:00 PM - 07:00 PM'),
      products: productListStr,
      product: productListStr,
      kilos: Number(item.kilosEstimados) || 0,
      kg: Number(item.kilosEstimados) || 0,
      personas: Number(item.personasEstimadas) || 150,
      personasEstimadas: Number(item.personasEstimadas) || 150,
      estado: normEstado,
      status: status,
      requierePromotora: Boolean(item.requierePromotora),
      promoterType: item.requierePromotora ? 'Fija' : 'Vendedor / Impulso',
      materialPop: item.materialPop ? 'SI' : 'NO',
      contactoPunto: item.contactoPunto || '',
      telefonoContacto: item.telefonoContacto || '',
      address: `Ruta: ${item.ruta || item.vendedorNombre || ''} | Contacto: ${item.contactoPunto || ''} (${item.telefonoContacto || ''})`,
      notes: item.observaciones || `Agendada por ${item.vendedorNombre}. Kilos: ${item.kilosEstimados || 5}. Personas: ${item.personasEstimadas || 150}.`,
      originalComments: item.observaciones || `Agendada por ${item.vendedorNombre}. Kilos: ${item.kilosEstimados || 5}. Personas: ${item.personasEstimadas || 150}.`,
      notasTradeMarketing: item.notasTradeMarketing || '',
      resultado: item.resultado || null
    };

    return {
      type: 'Degustacion',
      date: item.fecha || new Date().toISOString().split('T')[0],
      store: item.clienteNombre,
      promoter: promoterAssigned || item.vendedorNombre || 'Vendedor',
      product: productListStr,
      comments: JSON.stringify(commentsObj)
    };
  }

  async function upsertSurveyAtSupabase(url: string, apiKey: string, cleanId: string, payload: any): Promise<boolean> {
    if (!url || !apiKey || !cleanId) return false;

    // Lock serializado por (endpoint + degustacionId) para eliminar condiciones de carrera TOCTOU
    const lockKey = `${url}::${cleanId}`;
    const previousLock = surveyUpsertLocks.get(lockKey) || Promise.resolve();

    const runUpsert = async (): Promise<boolean> => {
      try {
        const searchUrl = `${url}?comments=like.*${encodeURIComponent(cleanId)}*&select=id&limit=5`;
        const searchRes = await fetchWithRetry(
          searchUrl,
          {
            method: 'GET',
            headers: {
              'apikey': apiKey,
              'Authorization': `Bearer ${apiKey}`
            }
          },
          { timeoutMs: 8000, maxAttempts: 2 }
        );

        if (searchRes.ok) {
          const records = await searchRes.json();
          if (Array.isArray(records) && records.length > 0 && records[0].id) {
            const updateUrl = `${url}?id=eq.${records[0].id}`;
            const patchRes = await fetchWithRetry(
              updateUrl,
              {
                method: 'PATCH',
                headers: {
                  'apikey': apiKey,
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=representation'
                },
                body: JSON.stringify(payload)
              },
              { timeoutMs: 8000, maxAttempts: 2 }
            );
            return patchRes.ok;
          }
        }

        const postRes = await fetchWithRetry(
          url,
          {
            method: 'POST',
            headers: {
              'apikey': apiKey,
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(payload)
          },
          { timeoutMs: 8000, maxAttempts: 2 }
        );
        return postRes.ok;
      } catch (_) {
        return false;
      }
    };

    const chained = previousLock.then(runUpsert, runUpsert);
    surveyUpsertLocks.set(lockKey, chained);
    try {
      return await chained;
    } finally {
      if (surveyUpsertLocks.get(lockKey) === chained) {
        surveyUpsertLocks.delete(lockKey);
      }
    }
  }

  async function syncToGerenciaDirect(item: any, existingRemote?: any) {
    const startedAt = Date.now();
    const result = {
      localJson: false,
      tradeMarketingWebhook: { attempted: false, ok: false, status: 0 as number },
      supabaseSurveys: false,
      uterioSurveys: false,
      latencyMs: 0
    };

    try {
      const norm = normalizeDegustacionRecord(item);
      if (!norm.id || EXCLUDED_TEST_DEG_IDS.has(norm.id)) {
        result.latencyMs = Date.now() - startedAt;
        return result;
      }

      const tradeItem = buildTradeMarketingItemServer(norm, existingRemote);
      const surveyPayload = buildGerenciaDirectPayload(norm);

      const tradeHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `DEG-${norm.id}`
      };
      if (TRADE_MARKETING_API_KEY) {
        tradeHeaders['Authorization'] = `Bearer ${TRADE_MARKETING_API_KEY}`;
      }

      const [jsonOk, webhookRes, uterioOk, supaSurveyOk] = await Promise.all([
        syncToTradeMarketingJson(norm).then(() => true).catch(() => false),
        GERENCIA_TRADE_API_URL
          ? (result.tradeMarketingWebhook.attempted = true,
            fetchWithRetry(
              GERENCIA_TRADE_API_URL,
              {
                method: 'POST',
                headers: tradeHeaders,
                body: JSON.stringify(tradeItem)
              },
              { timeoutMs: 8000, maxAttempts: 2 }
            )
              .then((r) => ({ ok: r.ok, status: r.status }))
              .catch(() => ({ ok: false, status: 0 })))
          : Promise.resolve({ ok: false, status: 0 }),
        upsertSurveyAtSupabase(GERENCIA_UTERIO_SURVEYS_URL, GERENCIA_UTERIO_ANON_KEY, norm.id, surveyPayload),
        upsertSurveyAtSupabase(GERENCIA_SUPABASE_SURVEYS_URL, GERENCIA_SUPABASE_ANON_KEY, norm.id, surveyPayload)
      ]);

      result.localJson = jsonOk;
      result.tradeMarketingWebhook.ok = webhookRes.ok;
      result.tradeMarketingWebhook.status = webhookRes.status;
      result.uterioSurveys = uterioOk;
      result.supabaseSurveys = supaSurveyOk;
    } catch (err) {
      console.warn("Failed to sync directly to Gerencia:", err);
    }

    result.latencyMs = Date.now() - startedAt;
    return result;
  }

  async function deleteFromGerenciaDirect(id: string) {
    try {
      const cleanId = String(id).replace(/^DEG-/, '');
      const degId = `DEG-${cleanId}`;

      const tradeHeaders: Record<string, string> = {};
      if (TRADE_MARKETING_API_KEY) {
        tradeHeaders['Authorization'] = `Bearer ${TRADE_MARKETING_API_KEY}`;
      }

      await Promise.all([
        deleteFromTradeMarketingJson(cleanId),
        GERENCIA_TRADE_API_URL
          ? fetchWithRetry(`${GERENCIA_TRADE_API_URL}/${encodeURIComponent(degId)}`, {
              method: 'DELETE',
              headers: tradeHeaders
            }, { timeoutMs: 6000, maxAttempts: 2 }).catch(() => {})
          : Promise.resolve(),
        GERENCIA_UTERIO_SURVEYS_URL && GERENCIA_UTERIO_ANON_KEY
          ? fetchWithRetry(`${GERENCIA_UTERIO_SURVEYS_URL}?comments=like.*${encodeURIComponent(cleanId)}*`, {
              method: 'DELETE',
              headers: {
                'apikey': GERENCIA_UTERIO_ANON_KEY,
                'Authorization': `Bearer ${GERENCIA_UTERIO_ANON_KEY}`
              }
            }, { timeoutMs: 6000, maxAttempts: 2 }).catch(() => {})
          : Promise.resolve(),
        GERENCIA_SUPABASE_SURVEYS_URL && GERENCIA_SUPABASE_ANON_KEY
          ? fetchWithRetry(`${GERENCIA_SUPABASE_SURVEYS_URL}?comments=like.*${encodeURIComponent(cleanId)}*`, {
              method: 'DELETE',
              headers: {
                'apikey': GERENCIA_SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${GERENCIA_SUPABASE_ANON_KEY}`
              }
            }, { timeoutMs: 6000, maxAttempts: 2 }).catch(() => {})
          : Promise.resolve()
      ]);
    } catch (err) {
      console.warn("Failed to delete from Gerencia:", err);
    }
  }

  // ENDPOINT DE SINCRONIZACIÓN INTEGRAL DE DEGUSTACIONES CON TRADE MARKETING (con coalescing anti-tormenta y delimitación por sucursal)
  app.post("/api/degustaciones/sync-gerencia", authenticateToken, async (req: any, res: any) => {
    try {
      const scope = resolveRequestSucursalScope(req);
      if (!scope.ok) {
        return res.status(scope.status).json({ success: false, code: scope.code, error: scope.error });
      }
      if (scope.role !== 'ADMIN' && scope.role !== 'COORDINADORA' && scope.role !== 'SUPERVISOR') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN_SYNC',
          error: 'Solo Administración o Coordinación de Trade Marketing pueden disparar sincronización masiva.'
        });
      }

      if (inFlightFullTradeSync) {
        const shared = await inFlightFullTradeSync;
        return res.json({
          success: true,
          coalesced: true,
          message: "Sincronización consolidada con Trade Marketing completada",
          ...shared
        });
      }

      inFlightFullTradeSync = (async () => {
        console.log(`[SYNC TRADE] Sincronizando degustaciones de ${scope.sucursal} con Trade Marketing...`);
        const mergedDesc = await loadAllMergedDegustaciones(scope.sucursal, {
          username: req.user.username,
          role: scope.role,
          vendorId: String(req.user.vendorId || '')
        });

        // 1. Asegurar que todas las degustaciones de esta sucursal estén en Supabase con sucursal explícita
        const scopedClient = getScopedTradeClient(tradeSupabaseCfg, {
          username: req.user.username,
          role: scope.role,
          vendorId: String(req.user.vendorId || ''),
          sucursal: scope.sucursal
        });
        if (scopedClient && mergedDesc.length > 0) {
          const supaRows = mergedDesc.map(record => ({
            id: record.id,
            sucursal: scope.sucursal,
            cliente_codigo: record.clienteCodigo || 'PDV',
            cliente_nombre: record.clienteNombre,
            vendedor_nombre: record.vendedorNombre || 'Vendedor',
            vendedor_id: record.vendedorId || '1',
            vendedor_email: record.vendedorEmail || null,
            ruta: record.ruta || '',
            fecha: record.fecha,
            turno: record.turno || 'MAÑANA',
            hora: record.hora || '',
            productos: Array.isArray(record.productos) ? record.productos : [],
            kilos_estimados: Number(record.kilosEstimados) || 0,
            personas_estimadas: Number(record.personasEstimadas) || 150,
            requiere_promotora: Boolean(record.requierePromotora),
            promotora_asignada: record.promotoraAsignada || '',
            material_pop: Boolean(record.materialPop),
            contacto_punto: record.contactoPunto || '',
            telefono_contacto: record.telefonoContacto || '',
            observaciones: record.observaciones || '',
            estado: record.estado || 'SOLICITADA',
            notas_trade_marketing: record.notasTradeMarketing || '',
            resultado: record.resultado || null,
            created_at: record.createdAt
          }));
          const { error: upErr } = await scopedClient.from('degustaciones').upsert(supaRows);
          if (
            upErr &&
            !tradeSupabaseCfg.strictSucursalColumn &&
            scope.sucursal === 'OCCIDENTE' &&
            /sucursal|schema cache|42703|PGRST204/i.test(String(upErr.message || upErr.code || ''))
          ) {
            const legacyRows = supaRows.map(({ sucursal: _s, ...rest }) => rest);
            await scopedClient.from('degustaciones').upsert(legacyRows);
          }
        }

        // 2. Consultar estado actual remoto si el webhook está disponible
        const remoteById = new Map<string, any>();
        if (GERENCIA_TRADE_API_URL) {
          try {
            const remRes = await fetchWithRetry(GERENCIA_TRADE_API_URL, {}, { timeoutMs: 6000, maxAttempts: 1 });
            if (remRes.ok) {
              const remJson = await remRes.json();
              if (Array.isArray(remJson)) {
                remJson.forEach((r: any) => {
                  if (r && r.id) remoteById.set(String(r.id), r);
                });
              }
            }
          } catch (_) {}
        }

        // 3. Sincronizar en data_degustaciones.json de forma atómica
        await syncToTradeMarketingJson(mergedDesc);

        // 4. Sincronizar en orden ascendente (lotes controlados de 5 para evitar saturación)
        const orderedAsc = sortDegustacionesServer(mergedDesc, true);
        let countSynced = 0;
        for (const item of orderedAsc) {
          const degId = `DEG-${item.id}`;
          await syncToGerenciaDirect(item, remoteById.get(degId));
          countSynced++;
        }

        return {
          total: mergedDesc.length,
          synced: countSynced,
          timestamp: new Date().toISOString()
        };
      })();

      try {
        const result = await inFlightFullTradeSync;
        res.json({
          success: true,
          message: "Degustaciones sincronizadas y ordenadas correctamente en Trade Marketing",
          ...result
        });
      } finally {
        inFlightFullTradeSync = null;
      }
    } catch (err: any) {
      console.error("[SYNC TRADE] Error en /api/degustaciones/sync-gerencia:", err);
      res.status(500).json({ error: "Error sincronizando con Trade Marketing", details: err?.message });
    }
  });

  async function syncToGoogleScript(item: any) {
    if (!GOOGLE_SCRIPT_WEBHOOK_URL) return;
    try {
      await fetchWithRetry(
        GOOGLE_SCRIPT_WEBHOOK_URL,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ADD_DEGUSTACION',
            timestamp: new Date().toISOString(),
            id: item.id,
            fechaRegistro: item.createdAt || new Date().toISOString(),
            vendedor: item.vendedorNombre || item.vendedor,
            ruta: item.ruta || item.vendedorId,
            clienteCodigo: item.clienteCodigo,
            clienteNombre: item.clienteNombre,
            fechaDegustacion: item.fecha || item.fechaDegustacion,
            turno: item.turno,
            hora: item.hora,
            productos: Array.isArray(item.productos) ? item.productos.join(', ') : item.productos,
            kilosEstimados: item.kilosEstimados,
            personasEstimadas: item.personasEstimadas,
            requierePromotora: item.requierePromotora ? 'SI' : 'NO',
            materialPop: item.materialPop ? 'SI' : 'NO',
            contactoPunto: item.contactoPunto || '',
            telefonoContacto: item.telefonoContacto || '',
            estado: item.estado || 'SOLICITADA',
            promotoraAsignada: item.promotoraAsignada || '',
            notasTradeMarketing: item.notasTradeMarketing || '',
            observaciones: item.observaciones || ''
          })
        },
        { timeoutMs: 8000, maxAttempts: 2 }
      );
    } catch (err) {
      console.warn("Failed to sync with Google Script:", err);
    }
  }

  function buildSupabaseDegustacionRow(record: any, explicitSucursal: Sucursal) {
    return {
      id: record.id,
      sucursal: explicitSucursal,
      cliente_codigo: record.clienteCodigo || 'PDV',
      cliente_nombre: record.clienteNombre,
      vendedor_nombre: record.vendedorNombre || 'Vendedor',
      vendedor_id: record.vendedorId || '1',
      vendedor_email: record.vendedorEmail || null,
      ruta: record.ruta || '',
      fecha: record.fecha,
      turno: record.turno || 'MAÑANA',
      hora: record.hora || '',
      productos: Array.isArray(record.productos) ? record.productos : [],
      kilos_estimados: Number(record.kilosEstimados) || 0,
      personas_estimadas: Number(record.personasEstimadas) || 0,
      requiere_promotora: Boolean(record.requierePromotora),
      promotora_asignada: record.promotoraAsignada || '',
      material_pop: Boolean(record.materialPop),
      contacto_punto: record.contactoPunto || '',
      telefono_contacto: record.telefonoContacto || '',
      observaciones: record.observaciones || '',
      estado: record.estado || 'SOLICITADA',
      notas_trade_marketing: record.notasTradeMarketing || '',
      resultado: record.resultado || null,
      created_at: record.createdAt
    };
  }

  app.post("/api/degustaciones", authenticateToken, async (req: any, res: any) => {
    try {
      const item = req.body;
      if (!item || !item.clienteNombre || !item.fecha) {
        return res.status(400).json({ success: false, error: "Faltan campos obligatorios (clienteNombre, fecha)" });
      }

      const sessionRole = String(req.user?.role || 'VENDEDOR').toUpperCase().trim();
      const sessionSucursal: Sucursal = normalizeSucursal(req.user?.sucursal) || 'OCCIDENTE';

      // Validar sucursal explícita en header si fue enviada
      const headerSucRaw = req.headers['x-active-sucursal'];
      if (headerSucRaw !== undefined && String(headerSucRaw).trim() !== '') {
        const headerSuc = normalizeSucursal(headerSucRaw);
        if (!headerSuc) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_SUCURSAL_VALUE',
            error: `Cabecera X-Active-Sucursal inválida: "${String(headerSucRaw)}".`
          });
        }
        if (sessionRole !== 'ADMIN' && headerSuc !== sessionSucursal) {
          return res.status(403).json({
            success: false,
            code: 'SUCURSAL_TAMPERING_DETECTED',
            error: `Operación denegada: tu sesión (${sessionSucursal}) no puede enviar solicitudes bajo ${headerSuc}.`
          });
        }
      }

      // Validación cruzada en BD: Tienda + Vendedor + Ruta + Sesión deben pertenecer a la misma sucursal
      const requestedVendorRef =
        sessionRole === 'VENDEDOR'
          ? String(req.user?.username || item.vendedorNombre || item.vendedorId || '').trim()
          : String(item.vendedorNombre || item.vendedorId || req.user?.username || '').trim();

      const [storeLookup, vendorLookup] = await Promise.all([
        lookupStoreGlobalSucursal(tradeSupabase, String(item.clienteCodigo || ''), String(item.clienteNombre || '')),
        lookupVendorGlobalSucursal(tradeSupabase, requestedVendorRef)
      ]);

      const isQaSyntheticStress =
        /^qa-stress-/i.test(String(item.id || '')) &&
        /\[QA_STRESS_TEST_/i.test(`${String(item.clienteNombre || '')} ${String(item.observaciones || '')}`);

      // Resolver ruta y vendedor concretos (eliminar 'ALL_MY_ROUTES' de forma determinista)
      const rawRuta = String(item.ruta || item.vendedorId || req.user?.ruta || '').trim();
      const fallbackProf = getVendorProfile(requestedVendorRef || req.user?.username || '', sessionSucursal);
      const resolvedRuta =
        !rawRuta || rawRuta.toUpperCase() === 'ALL_MY_ROUTES' || rawRuta.toUpperCase() === 'SUPERVISOR_ALL'
          ? (storeLookup.ruta || vendorLookup.primaryRoute || fallbackProf.routes[0]?.id || fallbackProf.canonicalUsername)
          : rawRuta;

      const resolvedVendorId =
        !item.vendedorId || String(item.vendedorId).toUpperCase() === 'ALL_MY_ROUTES'
          ? (vendorLookup.vendorId || String(req.user?.vendorId || resolvedRuta))
          : String(item.vendedorId).trim();

      const resolvedVendorName =
        sessionRole === 'VENDEDOR'
          ? (vendorLookup.canonicalName || fallbackProf.canonicalUsername || String(req.user?.username || '').toUpperCase())
          : (String(item.vendedorNombre || vendorLookup.canonicalName || req.user?.username || 'Vendedor').trim().toUpperCase());

      // Verificar si la ruta pertenece a otra sucursal en caso de que el cliente la haya especificado manualmente
      let routeSucursal: Sucursal | null = null;
      if (tradeSupabase && resolvedRuta) {
        try {
          const { data: rutaRows, error: rutaErr } = await tradeSupabase
            .from('rutas')
            .select('codigo,nombre,sucursal,activo')
            .or(`codigo.eq.${resolvedRuta},nombre.eq.${resolvedRuta}`)
            .limit(5);
          if (!rutaErr && Array.isArray(rutaRows) && rutaRows.length > 0) {
            const activeRutas = rutaRows.filter((r: any) => r.activo !== false);
            if (activeRutas.length > 0) {
              const matchingBranch = activeRutas.find((r: any) => normalizeSucursal(r.sucursal) === (vendorLookup.sucursal || sessionSucursal));
              routeSucursal = normalizeSucursal((matchingBranch || activeRutas[0]).sucursal);
            }
          }
        } catch {}
      }

      const branchCheck = validateCrossBranchSubmission({
        sessionRole,
        sessionSucursal,
        payloadSucursal: item.sucursal ?? headerSucRaw,
        vendorSucursal: vendorLookup.sucursal,
        storeSucursal: storeLookup.sucursal,
        routeSucursal,
        storeExistsInCatalog: storeLookup.found,
        requireCatalogStore: storeLookup.authoritativeCatalogActive && !isQaSyntheticStress,
        resolvedRoute: resolvedRuta
      });

      if (!branchCheck.ok) {
        return res.status(branchCheck.status).json({
          success: false,
          code: branchCheck.code,
          error: branchCheck.error
        });
      }

      const authoritativeSucursal: Sucursal = branchCheck.sucursal;

      const parsedProductos = Array.isArray(item.productos)
        ? item.productos.map((p: any) => String(p || '').trim()).filter(Boolean)
        : typeof item.productos === 'string' && item.productos.trim()
          ? item.productos.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];

      if (parsedProductos.length === 0) {
        return res.status(400).json({
          success: false,
          code: 'PRODUCTS_REQUIRED',
          error: 'Debes seleccionar al menos un producto del catálogo nacional.'
        });
      }

      const rawHeaderKey = req.headers['x-idempotency-key'] ? String(req.headers['x-idempotency-key']).trim() : '';
      const id = String(item.id || rawHeaderKey || `deg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`).trim();
      const rawIdempKey = rawHeaderKey || String(item.idempotencyKey || id).trim();
      const idempotencyKey = `${authoritativeSucursal}::${rawIdempKey}`;

      // 1. Verificar caché de idempotencia completada (particionada por sucursal)
      const now = Date.now();
      const cachedDone = completedDegustacionIdempotency.get(idempotencyKey);
      if (cachedDone && cachedDone.expiresAt > now) {
        return res.json({
          success: true,
          idempotentReplay: true,
          data: cachedDone.record,
          sync: cachedDone.sync
        });
      }

      // 2. Coalescing en vuelo para ráfagas simultáneas con la misma clave de idempotencia
      const existingFlight = inFlightDegustacionCreates.get(idempotencyKey);
      if (existingFlight) {
        const shared = await existingFlight;
        return res.json({
          success: true,
          idempotentReplay: true,
          data: shared.record,
          sync: shared.sync
        });
      }

      const record = normalizeDegustacionRecord(
        {
          ...item,
          id,
          sucursal: authoritativeSucursal,
          clienteCodigo: storeLookup.codigo || item.clienteCodigo || 'PDV',
          clienteNombre: storeLookup.nombre || item.clienteNombre,
          vendedorNombre: resolvedVendorName,
          vendedorId: resolvedVendorId,
          ruta: resolvedRuta,
          productos: parsedProductos,
          createdAt: item.createdAt || new Date().toISOString()
        },
        authoritativeSucursal
      );

      const executionPromise = (async () => {
        let supabaseDegustacionesOk = false;
        const scopedClient = getScopedTradeClient(tradeSupabaseCfg, {
          username: req.user.username,
          role: sessionRole,
          vendorId: resolvedVendorId,
          sucursal: authoritativeSucursal
        });

        // A. Persistencia primaria estrictamente awaited en Supabase compartido con `sucursal` explícito (cumpliendo RLS + Trigger)
        if (scopedClient) {
          const explicitRow = buildSupabaseDegustacionRow(record, authoritativeSucursal);
          const customRpc = String(process.env.TRADE_SUPABASE_INSERT_RPC || '').trim();
          let supaErr: any = null;

          if (customRpc) {
            const rpcRes = await scopedClient.rpc(customRpc, { p_payload: explicitRow, p_sucursal: authoritativeSucursal });
            supaErr = rpcRes.error;
          } else {
            const upRes = await scopedClient
              .from('degustaciones')
              .upsert(explicitRow, { onConflict: 'id' });
            supaErr = upRes.error;
          }

          if (supaErr) {
            const errMsg = String(supaErr.message || '');
            const errCode = String(supaErr.code || '');
            const isMissingSucColOnLegacy =
              !tradeSupabaseCfg.strictSucursalColumn &&
              authoritativeSucursal === 'OCCIDENTE' &&
              (errCode === 'PGRST204' || errCode === '42703' || /Could not find the 'sucursal' column/i.test(errMsg));

            if (isMissingSucColOnLegacy) {
              const { sucursal: _omitSuc, ...legacyRow } = explicitRow;
              const retryRes = await scopedClient.from('degustaciones').upsert(legacyRow, { onConflict: 'id' });
              if (!retryRes.error) {
                supabaseDegustacionesOk = true;
              } else {
                console.warn("[SUPABASE] Error en fallback legacy de degustación:", retryRes.error.message);
              }
            } else if (
              errCode === '42501' ||
              errCode === '23514' ||
              errCode === '23502' ||
              /row-level security|CROSS_BRANCH|VENDOR_SUCURSAL_MISMATCH|MULTISEDE_/i.test(errMsg)
            ) {
              const secErr: any = new Error(errMsg || 'Rechazado por política RLS o integridad multisede en Supabase');
              secErr.httpStatus = errCode === '42501' || /row-level security|CROSS_BRANCH|MISMATCH/i.test(errMsg) ? 403 : 400;
              secErr.code = /CROSS_BRANCH/i.test(errMsg) ? 'CROSS_BRANCH_STORE_FORBIDDEN' : 'SUPABASE_RLS_REJECTED';
              throw secErr;
            } else if (authoritativeSucursal === 'CENTRO' && /sucursal|PGRST204|42703/i.test(errMsg)) {
              const schemaErr: any = new Error(
                'La instancia de Supabase conectada aún no posee la columna obligatoria sucursal. Configura TRADE_SUPABASE_URL o ejecuta scripts/sql/05_multisede_sucursal_rls.sql.'
              );
              schemaErr.httpStatus = 503;
              schemaErr.code = 'MULTISEDE_SCHEMA_REQUIRED';
              throw schemaErr;
            } else {
              console.warn("[SUPABASE] Error en upsert de degustación:", errMsg);
            }
          } else {
            supabaseDegustacionesOk = true;
          }
        }

        // B. Respaldo en memoria aislado con sucursal explícita
        degustacionesMemoryStore.set(record.id, record);

        // C. Sincronización secundaria (webhook opcional si configurado + JSON local)
        const [directSync] = await Promise.all([
          syncToGerenciaDirect(record),
          syncToGoogleScript(record)
        ]);

        const syncSummary = {
          supabaseDegustaciones: supabaseDegustacionesOk,
          sucursal: authoritativeSucursal,
          ...directSync
        };

        if (completedDegustacionIdempotency.size >= 5000) {
          const oldestKey = completedDegustacionIdempotency.keys().next().value;
          if (oldestKey) completedDegustacionIdempotency.delete(oldestKey);
        }
        completedDegustacionIdempotency.set(idempotencyKey, {
          record,
          sync: syncSummary,
          expiresAt: Date.now() + DEGUSTACION_IDEMPOTENCY_TTL_MS
        });

        return { record, sync: syncSummary };
      })();

      inFlightDegustacionCreates.set(idempotencyKey, executionPromise);
      try {
        const result = await executionPromise;
        return res.json({
          success: true,
          idempotentReplay: false,
          data: result.record,
          sync: result.sync
        });
      } finally {
        inFlightDegustacionCreates.delete(idempotencyKey);
      }
    } catch (err: any) {
      if (err?.httpStatus) {
        return res.status(err.httpStatus).json({
          success: false,
          code: err.code || 'DEGUSTACION_VALIDATION_ERROR',
          error: err.message
        });
      }
      console.error("Error creating degustacion via API:", err);
      res.status(500).json({ success: false, error: "Error al guardar degustacion", details: err?.message });
    }
  });

  app.put("/api/degustaciones/:id", authenticateToken, async (req: any, res: any) => {
    try {
      const scope = resolveRequestSucursalScope(req);
      if (!scope.ok) {
        return res.status(scope.status).json({ success: false, code: scope.code, error: scope.error });
      }

      const { id } = req.params;
      const updates = req.body || {};

      const scopedClient = getScopedTradeClient(tradeSupabaseCfg, {
        username: req.user.username,
        role: scope.role,
        vendorId: String(req.user.vendorId || ''),
        sucursal: scope.sucursal
      });

      let existingRecord: any = degustacionesMemoryStore.get(id) || null;
      if (scopedClient) {
        try {
          const { data: supaRow } = await scopedClient.from('degustaciones').select('*').eq('id', id).maybeSingle();
          if (supaRow) {
            existingRecord = normalizeDegustacionRecord(supaRow, normalizeSucursal(supaRow.sucursal) || 'OCCIDENTE');
          }
        } catch (_) {}
      }

      if (existingRecord) {
        const existingSuc = normalizeSucursal(existingRecord.sucursal) || 'OCCIDENTE';
        if (scope.role !== 'ADMIN' && existingSuc !== scope.sucursal) {
          return res.status(403).json({
            success: false,
            code: 'CROSS_BRANCH_ACCESS_DENIED',
            error: `No tienes permisos para modificar una degustación de la sucursal ${existingSuc}.`
          });
        }
      }

      const targetSucursal: Sucursal =
        (existingRecord && normalizeSucursal(existingRecord.sucursal)) || scope.sucursal;

      const mergedRecord = normalizeDegustacionRecord(
        {
          ...(existingRecord || {}),
          ...updates,
          id,
          sucursal: targetSucursal
        },
        targetSucursal
      );

      if (scopedClient) {
        const supaUpdate: any = { updated_at: new Date().toISOString(), sucursal: targetSucursal };
        if (updates.clienteNombre !== undefined) supaUpdate.cliente_nombre = updates.clienteNombre;
        if (updates.vendedorNombre !== undefined) supaUpdate.vendedor_nombre = updates.vendedorNombre;
        if (updates.estado !== undefined) supaUpdate.estado = updates.estado;
        if (updates.notasTradeMarketing !== undefined) supaUpdate.notas_trade_marketing = updates.notasTradeMarketing;
        if (updates.promotoraAsignada !== undefined) supaUpdate.promotora_asignada = updates.promotoraAsignada;
        if (updates.resultado !== undefined) supaUpdate.resultado = updates.resultado;
        if (updates.kilosEstimados !== undefined) supaUpdate.kilos_estimados = Number(updates.kilosEstimados) || 0;
        if (updates.personasEstimadas !== undefined) supaUpdate.personas_estimadas = Number(updates.personasEstimadas) || 0;
        if (updates.observaciones !== undefined) supaUpdate.observaciones = updates.observaciones;

        let updateQuery = scopedClient.from('degustaciones').update(supaUpdate).eq('id', id).eq('sucursal', targetSucursal);
        const { error: supaErr } = await updateQuery;
        if (
          supaErr &&
          !tradeSupabaseCfg.strictSucursalColumn &&
          targetSucursal === 'OCCIDENTE' &&
          /sucursal|PGRST204|42703/i.test(String(supaErr.message || supaErr.code || ''))
        ) {
          delete supaUpdate.sucursal;
          await scopedClient.from('degustaciones').update(supaUpdate).eq('id', id);
        } else if (supaErr) {
          console.warn("[SUPABASE] Error actualizando degustación:", supaErr.message);
        }
      }

      degustacionesMemoryStore.set(id, mergedRecord);
      completedDegustacionIdempotency.delete(`${targetSucursal}::${id}`);

      const syncSummary = await syncToGerenciaDirect(mergedRecord);
      syncToGoogleScript(mergedRecord).catch(() => {});

      res.json({ success: true, id, sucursal: targetSucursal, updated: updates, data: mergedRecord, sync: syncSummary });
    } catch (err: any) {
      console.error("Error updating degustacion via API:", err);
      res.status(500).json({ success: false, error: "Error al actualizar degustacion", details: err?.message });
    }
  });

  app.delete("/api/degustaciones/:id", authenticateToken, async (req: any, res: any) => {
    try {
      const scope = resolveRequestSucursalScope(req);
      if (!scope.ok) {
        return res.status(scope.status).json({ success: false, code: scope.code, error: scope.error });
      }

      const { id } = req.params;
      const cleanId = String(id).replace(/^DEG-/, '').trim();

      const scopedClient = getScopedTradeClient(tradeSupabaseCfg, {
        username: req.user.username,
        role: scope.role,
        vendorId: String(req.user.vendorId || ''),
        sucursal: scope.sucursal
      });

      const memExisting = degustacionesMemoryStore.get(cleanId) || degustacionesMemoryStore.get(id);
      if (memExisting && scope.role !== 'ADMIN') {
        const memSuc = normalizeSucursal(memExisting.sucursal) || 'OCCIDENTE';
        if (memSuc !== scope.sucursal) {
          return res.status(403).json({
            success: false,
            code: 'CROSS_BRANCH_ACCESS_DENIED',
            error: `No puedes eliminar registros pertenecientes a la sucursal ${memSuc}.`
          });
        }
      }

      let supabaseDeleted = false;
      if (scopedClient) {
        const { error: supaErr } = await scopedClient
          .from('degustaciones')
          .delete()
          .eq('id', cleanId)
          .eq('sucursal', scope.sucursal);

        if (
          supaErr &&
          !tradeSupabaseCfg.strictSucursalColumn &&
          scope.sucursal === 'OCCIDENTE' &&
          /sucursal|PGRST204|42703/i.test(String(supaErr.message || supaErr.code || ''))
        ) {
          const retryDel = await scopedClient.from('degustaciones').delete().eq('id', cleanId);
          if (!retryDel.error) supabaseDeleted = true;
        } else if (supaErr) {
          console.warn("[SUPABASE] Error eliminando degustación:", supaErr.message);
        } else {
          supabaseDeleted = true;
        }
      }

      degustacionesMemoryStore.delete(cleanId);
      degustacionesMemoryStore.delete(id);
      for (const [k, v] of completedDegustacionIdempotency.entries()) {
        if (k === id || k === cleanId || k.endsWith(`::${cleanId}`) || v.record?.id === cleanId) {
          completedDegustacionIdempotency.delete(k);
        }
      }

      await deleteFromGerenciaDirect(cleanId);
      res.json({ success: true, id: cleanId, sucursal: scope.sucursal, supabaseDeleted });
    } catch (err: any) {
      console.error("Error deleting degustacion via API:", err);
      res.status(500).json({ success: false, error: "Error al eliminar degustacion", details: err?.message });
    }
  });

  // ==============================================================
  // MÓDULO ENRUTADOR RETIRADO DE LA CAPA DE APLICACIÓN (HISTÓRICO INTACTO)
  // ==============================================================
  app.all(["/api/rutero", "/api/rutero/*"], (_req: any, res: any) => {
    return res.status(410).json({
      success: false,
      code: "MODULE_RETIRED",
      error: "El módulo Enrutador fue retirado de la aplicación. Los datos históricos permanecen intactos."
    });
  });

  // ==============================================================
  // ENDPOINTS DE PEDIDOS ALKOSTO (RESTRINGIDOS A PERFILES AUTORIZADOS - SAIRU VALLES DENEGADA)
  // ==============================================================
  app.get("/api/alkosto/pedidos", authenticateToken, requireAlkostoAccess, async (req: any, res: any) => {
    try {
      if (supabase) {
        try {
          const { data: supaList, error: supaErr } = await supabase
            .from('pedidos_alkosto')
            .select('*')
            .order('created_at', { ascending: false });

          if (!supaErr && Array.isArray(supaList) && supaList.length > 0) {
            const mapped = supaList.map((p: any) => ({
              id: p.id,
              numeroPedido: p.numero_pedido || '',
              correlativo: p.correlativo || p.numero_pedido || '',
              ordenCompraAlkosto: p.orden_compra_alkosto || '',
              sucursalCodigo: p.sucursal_codigo || '',
              sucursalNombre: p.sucursal_nombre || '',
              vendedora: p.vendedora || 'SAIRU VALLES',
              ruta: p.ruta || 'CUENTAS CLAVE 2',
              fechaPedido: p.fecha_pedido,
              fechaEntregaEstimada: p.fecha_entrega,
              totalBultos: Number(p.total_bultos) || 0,
              totalKilos: Number(p.total_kilos) || 0,
              totalUSD: Number(p.total_usd) || 0,
              condicionPago: p.condicion_pago || '',
              items: p.items || [],
              observaciones: p.observaciones || '',
              status: p.status || 'PENDIENTE',
              createdAt: p.created_at
            }));
            return res.json({ success: true, count: mapped.length, data: mapped, source: 'supabase' });
          }
        } catch (e: any) {
          // Fallback silencioso a Firestore si la tabla no existe
        }
      }

      const snapshot = await getDocs(collection(db, 'alkosto_orders'));
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      res.json({ success: true, count: list.length, data: list, source: 'firestore' });
    } catch (err: any) {
      console.error("Error fetching Alkosto orders:", err);
      res.status(500).json({ error: "Error fetching Alkosto orders", details: err?.message });
    }
  });

  // Contador atómico en memoria para asignación secuencial de correlativos sin colisiones en lotes
  let lastAllocatedCorrelativo = 0;

  async function allocateNextCorrelativo(requestedCorrelativo?: string): Promise<string> {
    if (lastAllocatedCorrelativo === 0) {
      let maxFound = 0;
      if (supabase) {
        try {
          const { data } = await supabase
            .from('pedidos_alkosto')
            .select('correlativo, numero_pedido')
            .order('created_at', { ascending: false })
            .limit(200);
          if (Array.isArray(data)) {
            for (const row of data) {
              const cVal = parseInt(String(row.correlativo || row.numero_pedido || ''), 10);
              if (!isNaN(cVal) && cVal > maxFound && cVal < 9000) {
                maxFound = cVal;
              }
            }
          }
        } catch {}
      }
      if (maxFound === 0) {
        try {
          const snap = await getDocs(collection(db, 'alkosto_orders'));
          snap.forEach(d => {
            const data = d.data();
            const cVal = parseInt(String(data.correlativo || data.numeroPedido || ''), 10);
            if (!isNaN(cVal) && cVal > maxFound && cVal < 9000) {
              maxFound = cVal;
            }
          });
        } catch {}
      }
      lastAllocatedCorrelativo = maxFound;
    }

    const reqClean = String(requestedCorrelativo || '').trim();
    if (reqClean && /^\d{1,5}$/.test(reqClean)) {
      const reqNum = parseInt(reqClean, 10);
      if (reqNum > lastAllocatedCorrelativo) {
        lastAllocatedCorrelativo = reqNum;
        return String(reqNum).padStart(4, '0');
      }
    }

    lastAllocatedCorrelativo += 1;
    return String(lastAllocatedCorrelativo).padStart(4, '0');
  }

  // Deduplicación idempotente en servidor para evitar pedidos duplicados por doble clic o reintentos
  const inFlightAlkostoSubmissions = new Map<string, Promise<any>>();
  const recentAlkostoSubmissions = new Map<string, { timestamp: number; record: any }>();
  const IDEMPOTENCY_TTL_MS = 60_000;

  class AlkostoHttpError extends Error {
    public readonly statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.name = 'AlkostoHttpError';
      this.statusCode = statusCode;
    }
  }

  function extraerArticulosHomologadosSalaEspera(item: any) {
    const sourceRenglones =
      Array.isArray(item?.renglones) && item.renglones.length > 0
        ? item.renglones
        : Array.isArray(item?.items) && item.items.length > 0
          ? item.items
          : Array.isArray(item?.articulos) && item.articulos.length > 0
            ? item.articulos
            : [];

    return sourceRenglones
      .map((it: any) => {
        if (!it || typeof it !== 'object') return null;
        const rawCod = String(it.sku ?? it.codigo ?? '').trim();
        const rawDesc = String(it.producto ?? it.descripcion ?? '').trim();
        if (!rawCod && !rawDesc) return null;

        const isForbiddenAlpha = /^(LPV|UTH|UHT|QS|JUGOS)$/i.test(rawCod);
        const desc = limpiarDescripcionAlkosto((rawDesc || 'PRODUCTO').toUpperCase());
        const productoOficial = matchProductoCodizulca(isForbiddenAlpha ? '' : rawCod, desc);
        const hasExactOficial =
          productoOficial.matchExacto !== false &&
          productoOficial.codigo !== 'S/C' &&
          productoOficial.codigo !== 'PENDIENTE';
        const resolvedProd = hasExactOficial ? null : resolverProductoBackend(isForbiddenAlpha ? '' : rawCod, desc);
        const hasExactCatalogMatch = Boolean(hasExactOficial || resolvedProd);
        const cleanCod =
          (hasExactOficial ? productoOficial.codigo : '') ||
          (resolvedProd && !/^(LPV|UTH|UHT|QS|JUGOS)$/i.test(resolvedProd.sku) ? resolvedProd.sku : '') ||
          (!isForbiddenAlpha && rawCod && rawCod !== 'S/C' && !(!hasExactCatalogMatch && /^\d{8,14}$/.test(rawCod)) ? rawCod : '') ||
          'PENDIENTE';
        const cleanDesc = hasExactCatalogMatch
          ? (hasExactOficial ? productoOficial.descripcion : '') ||
            (resolvedProd ? resolvedProd.nombre : '') ||
            desc
          : String(rawDesc || desc || 'PRODUCTO').trim().toUpperCase();

        const cant = toSafeNumber(
          it.cantidad ??
            it.cantidad_solicitada ??
            it.cantidadCajas ??
            it.cantSolicitada ??
            it.bultos ??
            it.cajas ??
            it.unidades ??
            it.kilos
        );
        if (!Number.isFinite(cant) || Number.isNaN(cant) || cant <= 0) {
          return null;
        }

        const precioBruto = toSafeNumber(
          it.precio_bruto ?? it.precioBrutoUSD ?? it.costoBruto
        );
        const descuentoRaw = Math.max(0, toSafeNumber(it.descuento));
        let precio = toSafeNumber(
          it.valorUnitarioOC ?? it.precio_unitario ?? it.precioUnitarioUSD ?? it.precio
        );
        if (precio <= 0 && precioBruto > 0 && descuentoRaw > 0 && descuentoRaw <= 100) {
          precio = Number((precioBruto * (1 - descuentoRaw / 100)).toFixed(4));
        }

        const descuentoEfectivo =
          descuentoRaw > 0
            ? Number(descuentoRaw.toFixed(2))
            : precioBruto > precio && precio > 0
              ? Number((((precioBruto - precio) / precioBruto) * 100).toFixed(2))
              : 0;

        // REGLA MATEMÁTICA OBLIGATORIA: SUB TOTAL = CANT * VALOR UNITARIO DE LA OC
        const sub =
          precio > 0
            ? Number((cant * precio).toFixed(2))
            : Number(
                Math.max(
                  0,
                  toSafeNumber(it.subtotal ?? it.subtotalUSD ?? it.sub_total)
                ).toFixed(2)
              );

        const rawUnit = String(
          it.unidad_medida || it.presentacion || it.unid || it.unidad || resolvedProd?.unid || 'CJ'
        )
          .trim()
          .toUpperCase();

        const isBoxUnit =
          ['CJ', 'CJA', 'CAJA', 'CAJAS', 'BLT', 'BTO', 'BULTO', 'BULTOS'].includes(rawUnit) ||
          rawUnit.startsWith('CAJA');
        const isPieceUnit = ['UND', 'UNID', 'UNIDAD', 'UNIDADES'].includes(rawUnit);

        const normUnit = isBoxUnit ? 'BULTO' : isPieceUnit ? 'UNIDAD' : 'KG';
        const unidadOriginal = rawUnit === 'BLT' ? 'BLT' : isBoxUnit ? 'CJ' : isPieceUnit ? 'UND' : 'KG';

        const cajasVal = Number.isFinite(Number(it.cajas)) && Number(it.cajas) > 0
          ? Number(Number(it.cajas).toFixed(2))
          : isBoxUnit
            ? Number(cant.toFixed(2))
            : 0;
        const unidadesVal = Number.isFinite(Number(it.unidades)) && Number(it.unidades) > 0
          ? Number(Number(it.unidades).toFixed(2))
          : isPieceUnit
            ? Number(cant.toFixed(2))
            : 0;
        const kilosVal = Number.isFinite(Number(it.totalKilos ?? it.kilos)) && Number(it.totalKilos ?? it.kilos) > 0
          ? Number(Number(it.totalKilos ?? it.kilos).toFixed(2))
          : normUnit === 'KG'
            ? Number(cant.toFixed(2))
            : Number((cant * 10).toFixed(2));

        return {
          codigo: cleanCod,
          sku: cleanCod,
          descripcion: cleanDesc,
          cantidad_solicitada: Number(cant.toFixed(2)),
          cantidad: Number(cant.toFixed(2)),
          cantidad_despachada: 0,
          unidad_medida: normUnit,
          unidad_original: unidadOriginal,
          cajas: cajasVal,
          unidades: unidadesVal,
          kilos: kilosVal,
          precio_unitario: Number(precio.toFixed(4)),
          precio: Number(precio.toFixed(4)),
          ...(precioBruto > 0 ? { precio_bruto: Number(precioBruto.toFixed(4)) } : {}),
          descuento: descuentoEfectivo,
          sub_total: Number(sub.toFixed(2)),
          subtotal: Number(sub.toFixed(2))
        };
      })
      .filter((a: any): a is NonNullable<typeof a> => a !== null);
  }

  async function syncAlkostoOrderToExternal(
    item: any,
    gestorArticlesPrecomputed?: any[]
  ): Promise<{
    confirmedId: string;
    status: string;
    totalRenglones: number;
    montoPedido: number;
    attempts: number;
  }> {
    const correlativo = String(item.correlativo || item.numeroPedido || '').trim();
    const orderId = String(item.id || '').trim();
    if (!orderId) {
      throw new AlkostoHttpError(400, 'ID de pedido ausente para sincronizar con Sala de Espera.');
    }

    const cadenaNorm = normalizarCadenaEstricta(
      item.cadena || item.sucursalTag || item.sucursalCodigo || item.id_cliente,
      item.sucursal_cliente || item.sucursalNombre || item.cliente
    );
    const sucursalClienteClean = String(
      item.sucursal_cliente || item.sucursalNombre || item.cliente || cadenaNorm
    )
      .trim()
      .toUpperCase();

    const rawIdCli = String(item.id_cliente || item.sucursalCodigo || item.idCliente || '').trim();
    const idClientePadded = /^\d+$/.test(rawIdCli) ? rawIdCli.padStart(6, '0') : rawIdCli;
    const sucursalTagClean = String(item.sucursalTag || item.sucursal_tag || '').trim().toUpperCase();

    const numeroOcClean = String(
      item.numero_oc || item.ordenCompraAlkosto || item.orden_compra_alkosto || item.orden_compra || 'S/N'
    ).trim();

    const direccionDespachoClean = String(
      item.direccion_despacho || item.direccionEntrega || item.observaciones || 'Entrega según Orden de Compra'
    ).trim();

    const observacionFormateada =
      item.observacion_formateada && String(item.observacion_formateada).includes(' | OC ')
        ? String(item.observacion_formateada).trim()
        : construirObservacionFormateada({
            sucursal_cliente: sucursalClienteClean,
            cadena: cadenaNorm,
            numero_oc: numeroOcClean,
            direccion_despacho: direccionDespachoClean
          });

    const gestorArticles = Array.isArray(gestorArticlesPrecomputed)
      ? gestorArticlesPrecomputed
      : extraerArticulosHomologadosSalaEspera(item);

    if (gestorArticles.length === 0) {
      throw new AlkostoHttpError(
        400,
        `Validación previa: El pedido de ${sucursalClienteClean} no contiene productos válidos con cantidad mayor a cero.`
      );
    }

    const totalMonto = Number(
      gestorArticles
        .reduce((acc: number, a: any) => acc + Number(a.sub_total || 0), 0)
        .toFixed(2)
    );

    const fechaValida = item.fechaPedido || item.fecha
      ? (String(item.fechaPedido || item.fecha).includes('T')
          ? String(item.fechaPedido || item.fecha).split('T')[0]
          : String(item.fechaPedido || item.fecha))
      : new Date().toISOString().split('T')[0];

    // Homologación exacta: vendedor = 'Sairu Valles' y ruta = 'Sairu Valles' (coincide con VS["Sairu Valles"] y cd(row) en Pedidos Manuales)
    const vendedorHomologado = normalizarNombreVendedorSairu(
      item.vendedor || item.vendedora || item.ruta
    );
    const supervisorClean = String(item.supervisor || vendedorHomologado).trim();

    const rawOrder = {
      id: orderId,
      idempotency_key: String(item.idempotencyKey || orderId),
      id_cliente: idClientePadded,
      cliente: sucursalClienteClean,
      sucursal_cliente: sucursalClienteClean,
      ...(sucursalTagClean ? { sucursal_tag: sucursalTagClean } : {}),
      cadena: cadenaNorm,
      numero_oc: numeroOcClean,
      orden_compra: numeroOcClean,
      orden_de_compra: numeroOcClean,
      direccion_despacho: direccionDespachoClean,
      observacion_formateada: observacionFormateada,
      vendedor: vendedorHomologado,
      vendedor_nombre: vendedorHomologado,
      canal_comercial: 'CUENTAS CLAVE 2',
      numero_pedido: correlativo,
      ruta: vendedorHomologado,
      supervisor: supervisorClean,
      chofer: String(item.chofer || 'TRANSPORTE CODIZULCA').trim(),
      observaciones: observacionFormateada,
      fecha: fechaValida,
      total_pedido: totalMonto,
      monto_pedido: totalMonto,
      total_renglones: gestorArticles.length,
      estado: 'POR VALIDAR',
      estado_sala_espera: 'POR_VALIDAR',
      origen: cadenaNorm,
      fuente_origen: 'APP FDV',
      sucursal: 'Maracaibo',
      articulos: gestorArticles,
      renglones: gestorArticles.map((a: any) => ({
        codigo: a.codigo,
        sku: a.sku,
        descripcion: a.descripcion,
        unidad_medida: a.unidad_medida,
        unidad_original: a.unidad_original,
        cantidad: a.cantidad_solicitada,
        cajas: a.cajas,
        unidades: a.unidades,
        kilos: a.kilos,
        precio_unitario: a.precio_unitario,
        ...(a.precio_bruto ? { precio_bruto: a.precio_bruto } : {}),
        descuento: a.descuento,
        subtotal: a.sub_total
      }))
    };

    const supabaseOrderRow = {
      id: orderId,
      numero_pedido: correlativo || 'APP-FDV',
      cliente: rawOrder.cliente,
      id_cliente: rawOrder.id_cliente || null,
      ruta: vendedorHomologado,
      supervisor: rawOrder.supervisor,
      chofer: rawOrder.chofer || null,
      observaciones: observacionFormateada,
      fecha: fechaValida,
      total_pedido: totalMonto,
      monto_pedido: totalMonto,
      status: 'POR_VALIDAR', // Estado exacto que filtra la Sala de Espera de Pedidos Manuales
      sucursal: 'Maracaibo',
      version: 1,
      is_modified: false,
      reject_reason: null,
      cxc_note: null,
      fact_note: null,
      articulos: gestorArticles,
      status_history: [
        {
          status: 'POR_VALIDAR',
          department: 'Ventas',
          changedBy: vendedorHomologado,
          timestamp: new Date().toISOString(),
          reason: `Recibido en Sala de Espera desde APP FDV (${vendedorHomologado} | ${cadenaNorm} | OC: ${numeroOcClean})`
        }
      ],
      raw_order: rawOrder,
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_archived: false
    };

    // 1. Envío transaccional con hasta 2 reintentos automáticos (3 intentos totales) a public.orders (Sala de Espera)
    const ordersUrl = `${PEDIDOS_MANUALES_SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/orders`;
    const maxAttempts = 3;
    let confirmedId = '';
    let attemptsUsed = 0;
    let lastExternalErr: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attemptsUsed = attempt;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      try {
        const supaRes = await fetch(ordersUrl, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'apikey': PEDIDOS_MANUALES_SUPABASE_KEY,
            'Authorization': `Bearer ${PEDIDOS_MANUALES_SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify(supabaseOrderRow)
        });

        const bodyText = await supaRes.text();
        if (!supaRes.ok) {
          const isClientSchemaError = supaRes.status >= 400 && supaRes.status < 500 && supaRes.status !== 408 && supaRes.status !== 429;
          const err = new AlkostoHttpError(
            isClientSchemaError ? 502 : 503,
            `Supabase Sala de Espera respondió HTTP ${supaRes.status}: ${bodyText.slice(0, 300)}`
          );
          (err as any).retryable = !isClientSchemaError;
          throw err;
        }

        let parsedRep: any = null;
        try {
          parsedRep = bodyText ? JSON.parse(bodyText) : null;
        } catch {}

        const insertedRow = Array.isArray(parsedRep) ? parsedRep[0] : parsedRep;
        confirmedId = String(insertedRow?.id || '').trim();
        if (!confirmedId) {
          throw new AlkostoHttpError(
            502,
            'Supabase Sala de Espera no devolvió el ID de confirmación en la representación insertada.'
          );
        }

        console.log(
          `[ENVIO_FDV -> SALA_ESPERA] Confirmado Pedido N° ${correlativo} (ID BD: ${confirmedId} | Vendedor: ${vendedorHomologado} | ${sucursalClienteClean} | OC: ${numeroOcClean} | Renglones: ${gestorArticles.length} | Monto: $${totalMonto.toFixed(2)} | Intento: ${attempt}/${maxAttempts})`
        );
        break;
      } catch (err: any) {
        lastExternalErr = err instanceof Error ? err : new Error(String(err));
        const canRetry = attempt < maxAttempts && (err?.retryable !== false);
        console.warn(
          `[ENVIO_FDV -> SALA_ESPERA] Intento ${attempt}/${maxAttempts} fallido para ${sucursalClienteClean}: ${lastExternalErr.message}`
        );
        if (!canRetry) {
          break;
        }
        await new Promise(r => setTimeout(r, 400 * attempt));
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!confirmedId) {
      throw (
        lastExternalErr ||
        new AlkostoHttpError(
          502,
          `No se pudo confirmar la inserción del pedido N° ${correlativo} (${sucursalClienteClean}) en Supabase Sala de Espera.`
        )
      );
    }

    // 2. Persistencia opcional en archivo local orders.json del Gestor de Pedidos Manuales (si existe en entorno local)
    try {
      const ordersFilePath = path.resolve(process.cwd(), '../gestor-de-pedidos-pro/orders.json');
      if (fs.existsSync(ordersFilePath)) {
        const rawContent = fs.readFileSync(ordersFilePath, 'utf8');
        let fileOrders: any[] = [];
        try {
          fileOrders = JSON.parse(rawContent);
          if (!Array.isArray(fileOrders)) fileOrders = [];
        } catch {}

        const dbOrderObj = {
          id: confirmedId,
          status: 'POR_VALIDAR',
          isArchived: false,
          createdAt: supabaseOrderRow.created_at,
          updatedAt: supabaseOrderRow.updated_at,
          sucursal: 'Maracaibo',
          version: 1,
          order: rawOrder,
          statusHistory: supabaseOrderRow.status_history
        };

        const existingIdx = fileOrders.findIndex(
          o =>
            o.id === confirmedId ||
            (o.order?.numero_pedido && correlativo && String(o.order.numero_pedido).trim() === correlativo)
        );

        if (existingIdx >= 0) {
          fileOrders[existingIdx] = dbOrderObj;
        } else {
          fileOrders.unshift(dbOrderObj);
        }

        fs.writeFileSync(ordersFilePath, JSON.stringify(fileOrders, null, 2), 'utf8');
      }
    } catch (fErr) {
      console.warn(`[ALKOSTO -> PEDIDOS MANUALES] No se pudo escribir localmente en orders.json:`, fErr);
    }

    // 3. Enviar espejo secundario a Google Sheets Webhook (no bloqueante, tras confirmar BD principal)
    if (GOOGLE_SCRIPT_WEBHOOK_URL) {
      fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_PEDIDO_ALKOSTO',
          tipo: 'PEDIDO_ALKOSTO',
          timestamp: new Date().toISOString(),
          id: confirmedId,
          numeroPedido: correlativo,
          correlativo: correlativo,
          ordenCompraAlkosto: numeroOcClean,
          sucursalCodigo: item.sucursalCodigo,
          sucursalNombre: sucursalClienteClean,
          vendedora: vendedorHomologado,
          ruta: vendedorHomologado,
          fechaPedido: fechaValida,
          fechaEntrega: item.fechaEntregaEstimada,
          totalBultos: item.totalBultos,
          totalKilos: item.totalKilos,
          totalUSD: totalMonto,
          condicionPago: item.condicionPago || 'Crédito 21 días',
          items: item.items,
          observaciones: observacionFormateada
        })
      }).catch(err => console.warn("Google script webhook alkosto error:", err));
    }

    return {
      confirmedId,
      status: 'POR_VALIDAR',
      totalRenglones: gestorArticles.length,
      montoPedido: totalMonto,
      attempts: attemptsUsed
    };
  }

  async function processAndPersistSingleAlkostoOrder(
    item: any,
    headerIdempotencyKey?: string
  ): Promise<any> {
    if (!item || typeof item !== 'object') {
      throw new AlkostoHttpError(400, 'Datos de pedido requeridos o inválidos.');
    }

    // 1. Validación previa estricta de ítems con cantidad > 0
    const gestorArticles = extraerArticulosHomologadosSalaEspera(item);
    if (gestorArticles.length === 0) {
      throw new AlkostoHttpError(
        400,
        'Validación previa: El pedido debe contener al menos un producto válido con cantidad mayor a cero.'
      );
    }

    const cadenaNorm = normalizarCadenaEstricta(
      item.cadena || item.sucursalTag || item.sucursalCodigo || item.id_cliente,
      item.sucursal_cliente || item.sucursalNombre || item.cliente
    );
    const sucursalNombreClean = String(
      item.sucursal_cliente || item.sucursalNombre || item.cliente || cadenaNorm
    )
      .trim()
      .toUpperCase();
    const numeroOcClean = String(
      item.numero_oc || item.ordenCompraAlkosto || item.orden_compra_alkosto || 'S/N'
    ).trim();
    const direccionClean = String(
      item.direccion_despacho || item.direccionEntrega || item.observaciones || 'Entrega según Orden de Compra'
    ).trim();
    const fechaISO = item.fechaPedido || item.fecha
      ? String(item.fechaPedido || item.fecha).split('T')[0]
      : new Date().toISOString().split('T')[0];

    const rawIdInput = String(item.id || '').trim();
    const rawClientCode = String(item.id_cliente || item.sucursalCodigo || '').trim();
    const tagSlug = String(item.sucursalTag || item.sucursal_tag || 'doc')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'doc';

    const deterministicId =
      rawIdInput && !/^alk-ord-/i.test(rawIdInput)
        ? rawIdInput
        : String(headerIdempotencyKey || item.idempotencyKey || '').trim() ||
          generarIdDeterministaPedidoAlkosto({
            tagSlug,
            idCliente: rawClientCode,
            numeroOc: numeroOcClean,
            fechaISO,
            renglones: gestorArticles.map((a: any) => ({
              codigo: a.codigo,
              unidad_medida: a.unidad_original || a.unidad_medida,
              cantidad: a.cantidad_solicitada,
              precio_unitario: a.precio_unitario,
              descuento: a.descuento,
              subtotal: a.sub_total
            }))
          });

    const idempotencyKey = String(
      headerIdempotencyKey || item.idempotencyKey || deterministicId
    ).trim();

    // 2. Deduplicación de peticiones concurrentes (anti-doble clic) y caché reciente de idempotencia
    const existingInFlight = inFlightAlkostoSubmissions.get(idempotencyKey);
    if (existingInFlight) {
      return existingInFlight;
    }

    const cachedRecent = recentAlkostoSubmissions.get(idempotencyKey);
    if (
      cachedRecent &&
      !item.forceRetransmit &&
      Date.now() - cachedRecent.timestamp < IDEMPOTENCY_TTL_MS
    ) {
      return cachedRecent.record;
    }

    const runPromise = (async () => {
      const correlativo = await allocateNextCorrelativo(
        item.correlativo && item.correlativo !== 'AUTO' && item.numeroPedido !== 'PENDIENTE'
          ? item.correlativo
          : undefined
      );

      const observacionFormateada =
        item.observacion_formateada && String(item.observacion_formateada).includes(' | OC ')
          ? String(item.observacion_formateada).trim()
          : construirObservacionFormateada({
              sucursal_cliente: sucursalNombreClean,
              cadena: cadenaNorm,
              numero_oc: numeroOcClean,
              direccion_despacho: direccionClean
            });

      const vendedorHomologado = normalizarNombreVendedorSairu(
        item.vendedor || item.vendedora || item.ruta
      );
      const totalMonto = Number(
        gestorArticles.reduce((acc: number, a: any) => acc + Number(a.sub_total || 0), 0).toFixed(2)
      );
      const totalBultos = Number(
        gestorArticles.reduce((acc: number, a: any) => acc + Number(a.cantidad_solicitada || 0), 0).toFixed(2)
      );

      const draftRecord = {
        ...item,
        id: deterministicId,
        idempotencyKey,
        correlativo,
        numeroPedido: correlativo,
        ordenCompraAlkosto: numeroOcClean !== 'S/N' ? numeroOcClean : (item.ordenCompraAlkosto || ''),
        sucursalNombre: sucursalNombreClean,
        direccionEntrega: direccionClean,
        vendedora: vendedorHomologado,
        vendedor: vendedorHomologado,
        ruta: vendedorHomologado,
        observaciones: observacionFormateada,
        observacion_formateada: observacionFormateada,
        cadena: cadenaNorm,
        sucursal_cliente: sucursalNombreClean,
        numero_oc: numeroOcClean,
        direccion_despacho: direccionClean,
        totalBultos: Number(item.totalBultos) > 0 ? Number(item.totalBultos) : totalBultos,
        totalUSD: totalMonto,
        monto_pedido: totalMonto,
        total_renglones: gestorArticles.length,
        origen: 'APP FDV',
        createdAt: item.createdAt || new Date().toISOString()
      };

      // 3. Insertar PRIMERO en la Sala de Espera de Pedidos Manuales y exigir confirmación real del ID en BD
      const externalConfirmation = await syncAlkostoOrderToExternal(draftRecord, gestorArticles);
      const confirmedId = externalConfirmation.confirmedId;
      const nowIso = new Date().toISOString();

      const confirmedRecord = {
        ...draftRecord,
        id: confirmedId,
        salaEsperaId: confirmedId,
        estadoSalaEspera: externalConfirmation.status,
        estado: 'ENVIADO',
        status: 'ENVIADO',
        transmitido_a_pedidos_manuales: true,
        fecha_transmision: nowIso
      };

      // 4. Solo tras confirmación real de Sala de Espera, persistir estado ENVIADO en Firestore y Supabase local
      await setDoc(doc(db, 'alkosto_orders', confirmedId), confirmedRecord, { merge: true }).catch(err =>
        console.warn("[FIRESTORE] Aviso guardando pedido Alkosto:", err?.message)
      );

      if (supabase) {
        const { error: supaErr } = await supabase.from('pedidos_alkosto').upsert({
          id: confirmedRecord.id,
          numero_pedido: confirmedRecord.numeroPedido || '',
          correlativo: confirmedRecord.correlativo || confirmedRecord.numeroPedido || '',
          orden_compra_alkosto: confirmedRecord.ordenCompraAlkosto || '',
          sucursal_codigo: confirmedRecord.sucursalCodigo || '',
          sucursal_nombre: confirmedRecord.sucursalNombre || '',
          vendedora: vendedorHomologado,
          ruta: vendedorHomologado,
          fecha_pedido: confirmedRecord.fechaPedido ? new Date(confirmedRecord.fechaPedido).toISOString().split('T')[0] : null,
          total_bultos: Number(confirmedRecord.totalBultos) || 0,
          total_kilos: Number(confirmedRecord.totalKilos) || 0,
          total_usd: totalMonto,
          condicion_pago: confirmedRecord.condicionPago || '',
          items: confirmedRecord.items || [],
          observaciones: observacionFormateada,
          status: 'ENVIADO',
          created_at: confirmedRecord.createdAt,
          updated_at: nowIso
        });
        if (supaErr) {
          console.warn("[SUPABASE LOCAL] Error en upsert de pedidos_alkosto:", supaErr.message);
        }
      }

      recentAlkostoSubmissions.set(idempotencyKey, {
        timestamp: Date.now(),
        record: confirmedRecord
      });

      return confirmedRecord;
    })();

    inFlightAlkostoSubmissions.set(idempotencyKey, runPromise);
    try {
      return await runPromise;
    } finally {
      inFlightAlkostoSubmissions.delete(idempotencyKey);
    }
  }

  app.post("/api/alkosto/pedidos", authenticateToken, requireAlkostoAccess, async (req: any, res: any) => {
    try {
      const item = req.body;
      if (!item || (!item.sucursalNombre && !item.sucursal_cliente && !item.sucursalCodigo)) {
        return res.status(400).json({ success: false, error: "Falta sucursalNombre / sucursal_cliente" });
      }
      const idempHeader = req.headers['x-idempotency-key'] ? String(req.headers['x-idempotency-key']) : undefined;
      const record = await processAndPersistSingleAlkostoOrder(item, idempHeader);
      res.json({
        success: true,
        id: record.salaEsperaId || record.id,
        salaEsperaId: record.salaEsperaId || record.id,
        data: record
      });
    } catch (err: any) {
      const statusCode = err instanceof AlkostoHttpError ? err.statusCode : 500;
      console.error("Error saving Alkosto order:", err?.message || err);
      res.status(statusCode).json({
        success: false,
        error: err?.message || "Error saving Alkosto order",
        details: err?.message
      });
    }
  });

  // Endpoint transaccional de lote secuencial (N pedidos de una Orden de Compra)
  app.post("/api/alkosto/pedidos/lote", authenticateToken, requireAlkostoAccess, async (req: any, res: any) => {
    try {
      const pedidosInput = Array.isArray(req.body?.pedidos) ? req.body.pedidos : Array.isArray(req.body) ? req.body : [];
      if (pedidosInput.length === 0) {
        return res.status(400).json({ success: false, error: "El lote de pedidos está vacío" });
      }

      const insertados: any[] = [];
      const fallidos: Array<{ index: number; sucursal?: string; error: string }> = [];

      for (let i = 0; i < pedidosInput.length; i++) {
        const p = pedidosInput[i];
        try {
          const saved = await processAndPersistSingleAlkostoOrder(p);
          insertados.push(saved);
          console.log(`[ENVIO_FDV LOTE] Pedido ${i + 1}/${pedidosInput.length} confirmado en Sala de Espera con ID ${saved.id} (Correlativo: ${saved.correlativo})`);
        } catch (err: any) {
          fallidos.push({
            index: i,
            sucursal: p?.sucursal_cliente || p?.sucursalNombre,
            error: err?.message || "Error procesando pedido del lote"
          });
        }
      }

      res.status(fallidos.length === 0 ? 200 : 207).json({
        success: fallidos.length === 0,
        totalRecibidos: pedidosInput.length,
        totalInsertados: insertados.length,
        data: insertados,
        fallidos
      });
    } catch (err: any) {
      console.error("Error procesando lote Alkosto:", err);
      res.status(500).json({ success: false, error: "Error procesando lote de pedidos", details: err?.message });
    }
  });

  app.post("/api/alkosto/pedidos/transmitir", authenticateToken, requireAlkostoAccess, async (req: any, res: any) => {
    try {
      const item = req.body;
      if (!item || (!item.id && !item.numeroPedido && !item.sucursalNombre && !item.sucursal_cliente)) {
        return res.status(400).json({ success: false, error: "Datos de pedido requeridos o inválidos para transmisión" });
      }
      const idempHeader = req.headers['x-idempotency-key'] ? String(req.headers['x-idempotency-key']) : undefined;
      const record = await processAndPersistSingleAlkostoOrder(item, idempHeader);
      const confirmedId = record.salaEsperaId || record.id;
      res.json({ 
        success: true, 
        id: confirmedId,
        salaEsperaId: confirmedId,
        data: record,
        message: `Pedido N° ${record.correlativo || record.numeroPedido} transmitido y confirmado en la Sala de Espera (ID: ${confirmedId})` 
      });
    } catch (err: any) {
      const statusCode = err instanceof AlkostoHttpError ? err.statusCode : 500;
      console.error("Error transmitiendo pedido:", err?.message || err);
      res.status(statusCode).json({
        success: false,
        error: err?.message || "Error transmitiendo pedido",
        details: err?.message
      });
    }
  });

  app.put("/api/alkosto/pedidos/:id", authenticateToken, requireAlkostoAccess, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      await setDoc(doc(db, 'alkosto_orders', id), updates, { merge: true });

      if (supabase) {
        const supaUpdate: any = {};
        if (updates.status !== undefined) supaUpdate.status = updates.status;
        if (updates.observaciones !== undefined) supaUpdate.observaciones = updates.observaciones;
        if (updates.items !== undefined) supaUpdate.items = updates.items;
        if (updates.totalBultos !== undefined) supaUpdate.total_bultos = Number(updates.totalBultos) || 0;
        if (updates.totalKilos !== undefined) supaUpdate.total_kilos = Number(updates.totalKilos) || 0;
        if (updates.totalUSD !== undefined) supaUpdate.total_usd = Number(updates.totalUSD) || 0;
        supaUpdate.updated_at = new Date().toISOString();

        Promise.resolve(supabase.from('pedidos_alkosto').update(supaUpdate).eq('id', id)).catch(err => console.warn("[SUPABASE] Error actualizando pedido Alkosto:", err?.message));
      }

      res.json({ success: true, id, updated: updates });
    } catch (err: any) {
      console.error("Error updating Alkosto order:", err);
      res.status(500).json({ error: "Error updating Alkosto order", details: err?.message });
    }
  });

  app.delete("/api/alkosto/pedidos/:id", authenticateToken, requireAlkostoAccess, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await deleteDoc(doc(db, 'alkosto_orders', id)).catch(() => {});
      if (supabase) {
        Promise.resolve(supabase.from('pedidos_alkosto').delete().eq('id', id)).catch(err => console.warn("[SUPABASE] Error eliminando pedido Alkosto:", err?.message));
      }
      // Si es un registro de prueba automatizada (test-int-* / test-qa-*), limpiar también de Sala de Espera para cero contaminación
      if (/^test-(int|qa)-/i.test(String(id))) {
        const cleanUrl = `${PEDIDOS_MANUALES_SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/orders?id=eq.${encodeURIComponent(String(id))}`;
        await fetch(cleanUrl, {
          method: 'DELETE',
          headers: {
            'apikey': PEDIDOS_MANUALES_SUPABASE_KEY,
            'Authorization': `Bearer ${PEDIDOS_MANUALES_SUPABASE_KEY}`
          }
        }).catch(() => {});
      }
      res.json({ success: true, id });
    } catch (err: any) {
      console.error("Error deleting Alkosto order:", err);
      res.status(500).json({ error: "Error deleting Alkosto order", details: err?.message });
    }
  });

  // DICCIONARIO MAESTRO OFICIAL DE PRODUCTOS Y CÓDIGOS CODIZULCA
  const MASTER_PRODUCTOS_DICT = [
    { sku: '1496', nombre: 'MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR', barcode: '7590377000077', chainCodes: ['1496', '7590377000077'], unid: 'CJ' },
    { sku: '1497', nombre: 'MORTADELA ESP D/POLLO ASTURIAS 20UNDX500GR', barcode: '7590377000589', chainCodes: ['1497', '7590377000589'], unid: 'CJ' },
    { sku: '1519', nombre: 'MORTADELA ESP D/POLLO SALPICAO 10UNDX900GR', barcode: '', chainCodes: ['1462', '1519'], unid: 'CJ' },
    { sku: '21', nombre: 'MORTADELA DE POLLO DEL CORRAL 1KG', barcode: '7591289609129', chainCodes: ['21', '021', '1463', '7591289609129'], unid: 'CJ' },
    { sku: '047', nombre: 'NUGGETS DE POLLO DEL CORRAL 460GR', barcode: '7591289400023', chainCodes: ['047', '47', '7591289400023'], unid: 'UND' },
    { sku: '1360', nombre: 'PAPAS FRITAS CONGELADAS MARQUISE 2,5KG', barcode: '5412873178161', chainCodes: ['1360', '5412873178161', 'PATATAS'], unid: 'CJ' },
    { sku: '100281', nombre: 'QUESO MOZZARELLA CORLASA X KG', barcode: '', chainCodes: ['100281'], unid: 'KG' },
    { sku: '7591210000513', nombre: 'CREMA DE LECHE PURISIMA 500GR', barcode: '7591210000513', chainCodes: ['7591210000513'], unid: 'CJ' },
    { sku: '7591210000544', nombre: 'CREMA DE LECHE PURISIMA 250GR', barcode: '7591210000544', chainCodes: ['7591210000544'], unid: 'CJ' },
    { sku: '1464', nombre: 'MORT. NAVIDEÑA ASTURIAS XKG', barcode: '', chainCodes: ['1464'], unid: 'KG' },
    { sku: '1461', nombre: 'MORT. ESTANDAR ASTURIAS X KG', barcode: '', chainCodes: ['1461'], unid: 'KG' },
    { sku: '1462', nombre: 'MORT. ESPECIAL COCIDA ASTURIAS X KG', barcode: '', chainCodes: ['1462'], unid: 'KG' },
    { sku: '1463', nombre: 'MORT. SUPERIOR ASTURIAS X KG', barcode: '', chainCodes: ['1463', '100929'], unid: 'KG' },
    { sku: '1512', nombre: 'MORT. PECHUGA DE PAVO ASTURIAS X KG', barcode: '', chainCodes: ['100881', '1512'], unid: 'KG' },
    { sku: '1511', nombre: 'MORT. PECHUGA DE POLLO ASTURIAS X KG', barcode: '', chainCodes: ['100882', '1511'], unid: 'KG' },
    { sku: '1561', nombre: 'MORT. PAVO TIPO SHOULDER ASTURIAS POR KG', barcode: '', chainCodes: ['1561'], unid: 'KG' },
    { sku: '1521', nombre: 'MORT. ECONOM COCIDA ASTURIAS X KG', barcode: '', chainCodes: ['1521'], unid: 'KG' },
    { sku: '1522', nombre: 'MORT. TIPO AREPERO ASTURIAS X KG', barcode: '', chainCodes: ['1522'], unid: 'KG' },
    { sku: '1564', nombre: 'MORTADELA EXTRA ASTURIAS X KG', barcode: '', chainCodes: ['1564'], unid: 'KG' },
    { sku: '1563', nombre: 'MORT. ESTANDAR SALPICAO X KG', barcode: '', chainCodes: ['1563'], unid: 'KG' },
    { sku: '1562', nombre: 'MORT. ESPECIAL COCIDA SALPICAO X KG', barcode: '', chainCodes: ['1562'], unid: 'KG' },
    { sku: '1599', nombre: 'MORT. NAVIDEÑA SALPICAO X KG', barcode: '', chainCodes: ['1599'], unid: 'KG' },
    { sku: '927', nombre: 'MORTADELA ESP. CARACAS 10X900GRS', barcode: '', chainCodes: ['927'], unid: 'CJ' },
    { sku: '1051', nombre: 'MORTADELA ESP. CARACAS 10X500GRS', barcode: '', chainCodes: ['1051'], unid: 'CJ' },
    { sku: '1242', nombre: 'MORT. CHORIZO ESPECIAL CDZ X KG', barcode: '', chainCodes: ['1242'], unid: 'KG' },
    { sku: '1446', nombre: 'CHULETA FRESCA ASTURIAS POR KG', barcode: '', chainCodes: ['1446'], unid: 'KG' },
    { sku: '1088', nombre: 'CHULETA FRESCA IBERICO POR KG', barcode: '', chainCodes: ['1088'], unid: 'KG' },
    { sku: '1445', nombre: 'TOCINO FRESCO ASTURIAS X KG', barcode: '', chainCodes: ['1445'], unid: 'KG' },
    { sku: '340', nombre: 'CHULETA AHUMADA ALIMEX X KG', barcode: '', chainCodes: ['340'], unid: 'KG' },
    { sku: '171', nombre: 'JAMON COC. SUPERIOR ALIMEX 1X5.9KG', barcode: '', chainCodes: ['171', '100929'], unid: 'CJ' },
    { sku: '172', nombre: 'ESPALDA COCIDA ALIMEX 1X4.6KG', barcode: '', chainCodes: ['172'], unid: 'CJ' },
    { sku: '241', nombre: 'ESPAL. AHUM T/VISKING ALIMEX 6X3.2', barcode: '', chainCodes: ['241'], unid: 'CJ' },
    { sku: '439', nombre: 'ESPAL AHUM.T/AREPERO ALIMEX 12X1,6KG', barcode: '', chainCodes: ['439'], unid: 'CJ' },
    { sku: '995', nombre: 'ESPAL. AHUM T/VISKING ITALICO 6UNDX3.2KG', barcode: '', chainCodes: ['995'], unid: 'CJ' },
    { sku: '337', nombre: 'JAMON COCIDO ESTANDAR ITALICO X KG', barcode: '', chainCodes: ['337'], unid: 'KG' },
    { sku: '170', nombre: 'TOCINETA AHUM S/CUERO ALIMEX X KG', barcode: '', chainCodes: ['170'], unid: 'KG' },
    { sku: '177', nombre: 'SALCHICHA VIENA ALIMEX 16 X 450 GRS', barcode: '', chainCodes: ['177'], unid: 'CJ' },
    { sku: '176', nombre: 'SALCHICHA VIENA ALIMEX 8 X 800 GRS', barcode: '', chainCodes: ['176'], unid: 'CJ' },
    { sku: '101', nombre: 'POLLO BENEFICIADO ENTERO', barcode: '', chainCodes: ['101', 'POLLO'], unid: 'KG' },
    { sku: '103', nombre: 'FILET VARIAS PRESENTACIONES', barcode: '', chainCodes: ['103', 'FILET'], unid: 'KG' },
    { sku: '629', nombre: 'MUSLO CUADRIL DESPRESADO POR KG', barcode: '', chainCodes: ['629', '102', 'MUSLO'], unid: 'KG' },
    { sku: '630', nombre: 'ALAS DESPRESADAS POR KG', barcode: '', chainCodes: ['630', 'ALAS'], unid: 'KG' },
    { sku: '870', nombre: 'HIGADO (EMPACADO)', barcode: '', chainCodes: ['870'], unid: 'KG' },
    { sku: '393', nombre: 'MOLLEJA (EMPACADA)', barcode: '', chainCodes: ['393'], unid: 'KG' },
    { sku: '301', nombre: 'ACEITE VEGETAL COMESTIBLE 12X1LT', barcode: '', chainCodes: ['301', 'ACEITE'], unid: 'CJ' },
    { sku: '302', nombre: 'MANTEQUILLA CON SAL PURISIMA BARRA 18X200GR', barcode: '', chainCodes: ['302'], unid: 'CJ' },
    { sku: '303', nombre: 'ARROZ BLANCO ESPECIAL 24X1KG', barcode: '', chainCodes: ['303', 'ARROZ'], unid: 'CJ' },
    { sku: '401', nombre: 'HUEVOS BLANCOS SELECCIONADOS', barcode: '', chainCodes: ['401', 'HUEVOS'], unid: 'CJ' },
    { sku: '1569', nombre: 'PATATAS FRESCAS DOBLE COBERTURA 4X2.5KG', barcode: '', chainCodes: ['1569'], unid: 'CJ' },
    { sku: '1543', nombre: 'AZUCAR BLANCA VENCAMPO 1X20ND', barcode: '7590377000220', chainCodes: ['1543', '7590377000220'], unid: 'BLT' },
    { sku: '1536', nombre: 'LECHE EN POLVO VENCAMPO 10X1KG', barcode: '', chainCodes: ['1536'], unid: 'CJ' },
    { sku: '1556', nombre: 'LECHE EN POLVO VENCAMPO 10X900GR', barcode: '7590377000510', chainCodes: ['1556', '7590377000510'], unid: 'CJ' },
    { sku: '1574', nombre: 'LECHE EN POLVO VENCAMPO 10X400GR', barcode: '7590377000503', chainCodes: ['1574', '7590377000503'], unid: 'CJ' },
    { sku: '1579', nombre: 'LECHE EN POLVO VENCAMPO 10X500GR', barcode: '', chainCodes: ['1579'], unid: 'CJ' },
    { sku: '1642', nombre: 'ARVEJAS VENCAMPO 25 UND X 400GR', barcode: '7590377000411', chainCodes: ['1642', '001642', '7590377000411'], unid: 'CJ' },
    { sku: '1644', nombre: 'CARAOTAS NEGRAS VENCAMPO 25 UND X 400GR', barcode: '7590377000459', chainCodes: ['1644', '001644', '7590377000459'], unid: 'CJ' },
    { sku: '1572', nombre: 'CAJAS DE PIZZA 1X100', barcode: '', chainCodes: ['1572'], unid: 'BLT' },
    ...PRODUCTOS_CODIZULCA.map(p => ({
      sku: p.codigo,
      nombre: p.descripcion,
      barcode: '',
      chainCodes: [p.codigo],
      unid: /\b(X\s*KG|POR\s*KG|A\s+GRANEL)\b/i.test(p.descripcion) ? 'KG' : 'CJ'
    }))
  ];

  function resolverProductoBackend(codInput: string, descInput: string) {
    const rawCod = String(codInput || '').trim();
    const isForbiddenAlpha = /^(LPV|UTH|UHT|QS|JUGOS)$/i.test(rawCod);
    const cleanCod = isForbiddenAlpha ? '' : rawCod.replace(/[\s\-_.]/g, '').toUpperCase();
    const cleanDesc = String(descInput || '').trim().toUpperCase();

    // 0. Priorizar homologación determinista contra el catálogo oficial de productos (`Data de productos.csv`)
    const prodOficial = matchProductoCodizulca(cleanCod, cleanDesc);
    if (
      prodOficial.matchExacto !== false &&
      prodOficial.codigo !== 'S/C' &&
      prodOficial.codigo !== 'PENDIENTE'
    ) {
      const dictEntry = MASTER_PRODUCTOS_DICT.find(p => p.sku === prodOficial.codigo);
      return {
        sku: prodOficial.codigo,
        nombre: prodOficial.descripcion,
        barcode: dictEntry?.barcode || '',
        chainCodes: dictEntry?.chainCodes || [prodOficial.codigo],
        unid: dictEntry?.unid || (/\b(X\s*KG|POR\s*KG|A\s+GRANEL)\b/i.test(prodOficial.descripcion) ? 'KG' : 'CJ')
      };
    }

    // 1. Coincidencia por código de barra (EAN-13)
    if (cleanCod) {
      const match = MASTER_PRODUCTOS_DICT.find(
        p => p.barcode && p.barcode.replace(/[\s\-_.]/g, '') === cleanCod && (!cleanDesc || !hasPrimaryNounConflict(p.nombre, cleanDesc))
      );
      if (match) return match;
    }

    // 2. Coincidencia exacta SKU (validando sustantivo principal)
    if (cleanCod && cleanCod !== 'PENDIENTE' && cleanCod !== 'S/C') {
      const match = MASTER_PRODUCTOS_DICT.find(
        p => p.sku.toUpperCase() === cleanCod && (!cleanDesc || !hasPrimaryNounConflict(p.nombre, cleanDesc))
      );
      if (match) return match;
    }

    // 3. Coincidencia por código de cadena (Alkosto / Familia Center)
    if (cleanCod && cleanCod !== 'PENDIENTE' && cleanCod !== 'S/C') {
      const match = MASTER_PRODUCTOS_DICT.find(
        p => p.chainCodes && p.chainCodes.some(c => c.toUpperCase() === cleanCod) && (!cleanDesc || !hasPrimaryNounConflict(p.nombre, cleanDesc))
      );
      if (match) return match;
    }

    // Guardarraíl: si trae un EAN/código numérico explícito no catalogado, no hacer match difuso por descripción
    if (cleanCod.length >= 4 && /^\d+$/.test(cleanCod)) {
      return null;
    }

    // 4. Coincidencia por texto de descripción (exigiendo coincidencia obligatoria de sustantivo principal y prohibiendo match parcial por marca/gramaje)
    if (cleanDesc) {
      const match = MASTER_PRODUCTOS_DICT.find(p => {
        if (hasPrimaryNounConflict(p.nombre, cleanDesc)) return false;
        const pNorm = p.nombre.toUpperCase();
        return cleanDesc.includes(pNorm) || pNorm.includes(cleanDesc);
      });
      if (match) return match;

      const tokens = cleanDesc
        .split(/\s+/)
        .filter(t => t.length > 2 && !['POR', 'CON', 'DEL', 'LOS', 'LAS', 'PARA'].includes(t) && !isBrandOrPresentationToken(t));
      if (tokens.length > 0) {
        const tokenMatch = MASTER_PRODUCTOS_DICT.find(p => {
          if (hasPrimaryNounConflict(p.nombre, cleanDesc)) return false;
          const pNorm = p.nombre.toUpperCase();
          const required = tokens.length <= 2 ? tokens.length : Math.max(2, Math.ceil(tokens.length * 0.75));
          return tokens.filter(t => pNorm.includes(t)).length >= required;
        });
        if (tokenMatch) return tokenMatch;
      }
    }

    return null;
  }

  // Helper numérico robusto contra formato venezolano e internacional (ej: 210,00 o 1.500,50 o 1,500.50 o con símbolos)
  function parseNumeroSeguro(val: any): number {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const s = String(val).trim();
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
      const num = parseFloat(s.replace(/\./g, '').replace(',', '.'));
      return isNaN(num) ? 0 : num;
    }
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
      const num = parseFloat(s.replace(/,/g, ''));
      return isNaN(num) ? 0 : num;
    }
    if (/^\d+,\d+$/.test(s)) {
      const num = parseFloat(s.replace(',', '.'));
      return isNaN(num) ? 0 : num;
    }
    const cleaned = s.replace(/[$BsUSD\s]/gi, '');
    if (cleaned.includes('.') && cleaned.includes(',')) {
      if (cleaned.indexOf('.') < cleaned.indexOf(',')) {
        const n = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
        return isNaN(n) ? 0 : n;
      } else {
        const n = parseFloat(cleaned.replace(/,/g, ''));
        return isNaN(n) ? 0 : n;
      }
    }
    if (cleaned.includes(',')) {
      const n = parseFloat(cleaned.replace(',', '.'));
      return isNaN(n) ? 0 : n;
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  // LECTOR OCR INTELIGENTE Y DETERMINISTA DE ÓRDENES DE COMPRA ALKOSTO Y FAMILIA CENTER
  // Protegido con JWT + política de autorización Alkosto (403 Forbidden para perfiles no autorizados / Sairu Valles)
  app.post("/api/alkosto/ocr-orden", authenticateToken, requireAlkostoAccess, rateLimiter(10 * 60000, 30, 'OCR Orden Alkosto'), async (req: any, res: any) => {
    req.setTimeout?.(120000);
    res.setTimeout?.(120000);
    let currentStage: AlkostoOcrStage = "1-Archivo";

    try {
      const { imageBase64, mimeType = "image/jpeg", fileName = "" } = req.body || {};
      if (!imageBase64) {
        return res.status(400).json({
          error: "Error en Etapa [1-Archivo]: Falta la imagen (JPG, PNG, WEBP) o el archivo PDF de la Orden de Compra.",
          stage: "1-Archivo",
          code: "MISSING_FILE_PAYLOAD"
        });
      }

      const cleanBase64 = sanitizeBase64Payload(String(imageBase64));
      if (!cleanBase64) {
        return res.status(400).json({
          error: "Error en Etapa [1-Archivo]: El contenido Base64 del archivo está vacío o tiene un formato inválido.",
          stage: "1-Archivo",
          code: "EMPTY_BASE64_PAYLOAD"
        });
      }

      const binaryBuffer = Buffer.from(cleanBase64, "base64");
      if (!binaryBuffer || binaryBuffer.length < 32) {
        return res.status(400).json({
          error: "Error en Etapa [1-Archivo]: El archivo de la Orden de Compra está vacío o corrupto.",
          stage: "1-Archivo",
          code: "CORRUPTED_FILE_BUFFER"
        });
      }

      // Detección dinámica real de mimeType por magic bytes + MIME declarado + extensión
      const actualMime = detectAlkostoFileMimeType(binaryBuffer, mimeType, fileName);
      const isPdfPayload = actualMime === "application/pdf";

      console.log(
        `[ALKOSTO OCR] Iniciando procesamiento: fileName="${fileName || "N/A"}", declaredMime="${mimeType}", detectedMime="${actualMime}", sizeKB=${Math.round(binaryBuffer.length / 1024)}`
      );

      // 1. Extracción determinista de alta velocidad para PDFs digitales del ERP de Alkosto / Familia Center
      let deterministicOrder: any = null;
      if (isPdfPayload) {
        try {
          const positionedText = extractPositionedTextFromAlkostoPdfBuffer(binaryBuffer, zlib.inflateSync);
          if (positionedText) {
            const parsedDet = parseAlkostoRawText(positionedText);
            if (parsedDet && parsedDet.items.length > 0) {
              deterministicOrder = normalizeOrderForCodizulca(parsedDet);
              console.log(
                `[ALKOSTO OCR] Extracción PDF determinista exitosa (coordenadas X,Y): OC=${deterministicOrder.ordenNro}, renglones=${deterministicOrder.items.length}`
              );
            }
          }
        } catch (pdfParseErr: any) {
          console.warn("[ALKOSTO OCR] Advertencia en lectura de coordenadas PDF:", pdfParseErr?.message);
        }

        // Si el PDF fue re-guardado por otro visor sin matrices BT..ET estándar, intentar extracción con pdf-parse
        if (!deterministicOrder) {
          try {
            const { PDFParse } = await import("pdf-parse");
            const pdfParser = new PDFParse({ data: binaryBuffer });
            try {
              const textRes = await pdfParser.getText();
              const rawPdfText = String(textRes?.text || "").trim();
              if (rawPdfText.length >= 30) {
                const parsedFlexible = parseAlkostoFlexibleOcrText(rawPdfText);
                if (parsedFlexible && parsedFlexible.items.length > 0) {
                  deterministicOrder = normalizeOrderForCodizulca(parsedFlexible);
                  console.log(
                    `[ALKOSTO OCR] Extracción PDF vía pdf-parse exitosa: OC=${deterministicOrder.ordenNro}, renglones=${deterministicOrder.items.length}`
                  );
                }
              }
            } finally {
              await pdfParser.destroy().catch(() => {});
            }
          } catch (pdfFallbackErr: any) {
            console.warn("[ALKOSTO OCR] Advertencia en pdf-parse secundario:", pdfFallbackErr?.message);
          }
        }
      }

      const rawKeyCandidates = [
        process.env.GEMINI_API_KEY,
        process.env.GOOGLE_API_KEY,
        process.env.VITE_GEMINI_API_KEY,
        process.env.API_KEY
      ]
        .filter(Boolean)
        .flatMap((k) => String(k).split(","))
        .map((k) => k.trim().replace(/^["']+|["']+$/g, "").trim())
        .filter((k) => k.length > 10 && k !== "undefined" && k !== "null");
      const apiKeys = Array.from(new Set(rawKeyCandidates));

      // Si el PDF digital ya cuadró matemáticamente al 100% o no hay API keys, devolver de inmediato sin latencia ni timeouts
      if (deterministicOrder && Array.isArray(deterministicOrder.items) && deterministicOrder.items.length > 0) {
        const detCuadre = calcularResumenCuadreOC(deterministicOrder);
        if (detCuadre?.cuadreExacto || apiKeys.length === 0) {
          return res.json({
            success: true,
            parserMode: "DETERMINISTIC_PDF",
            data: deterministicOrder,
            canonical: toCanonicalAlkostoOcJson(deterministicOrder)
          });
        }
      }

      currentStage = "2-Conexión Gemini-Render";
      const systemInstruction = buildAlkostoOcSystemPrompt();
      const prompt = `Analiza minuciosamente la imagen, captura o documento PDF adjunto correspondiente a una Orden de Compra de ALKOSTO y FAMILIA CENTER en todas sus páginas. Devuelve ÚNICAMENTE el objeto JSON válido consolidando las cantidades por tienda en las 17 tiendas válidas (AK01-AK10 y FC01-FC07, ignorando AKOP y CI) y normalizando los montos numéricos sin comas de miles.`;

      let lastModelError: any = null;
      let validatedOrder: any = null;
      let usedModel = "";

      if (apiKeys.length > 0) {
        try {
          const geminiOut = await callGeminiWithFallback({
            base64Data: cleanBase64,
            mimeType: actualMime,
            fileName,
            apiKeys,
            systemInstruction,
            prompt
          });

          currentStage = "4-Mapeo Nota de Pedido";
          const candidateValidated = validateAndNormalizeAlkostoOC(geminiOut.parsedJson, {
            strictMath: false,
            requireOrdenNro: false
          });
          validatedOrder = normalizeOrderForCodizulca(candidateValidated);
          usedModel = geminiOut.usedModel;

          console.log(
            `[ALKOSTO OCR] Extracción IA exitosa con ${usedModel}: OC=${validatedOrder.ordenNro}, renglones=${validatedOrder.items.length}`
          );
        } catch (mErr: any) {
          lastModelError = mErr;
          if (mErr instanceof AlkostoOcrStageError) {
            currentStage = mErr.stage;
          }
          console.warn(`[ALKOSTO OCR] Fallo en cascada Gemini (${currentStage}):`, mErr?.message);
        }
      }

      // 2. Si el documento es un PDF digital y el motor determinista obtuvo renglones válidos mientras Gemini falló o tuvo menos renglones, usar el determinista
      if (deterministicOrder) {
        const detCuadre = calcularResumenCuadreOC(deterministicOrder);
        const aiCuadre = validatedOrder ? calcularResumenCuadreOC(validatedOrder) : null;
        if (
          !validatedOrder ||
          (!aiCuadre?.cuadreExacto && detCuadre?.cuadreExacto) ||
          validatedOrder.items.length < deterministicOrder.items.length
        ) {
          return res.json({
            success: true,
            parserMode: usedModel ? `AI_HYBRID_${usedModel}` : "DETERMINISTIC_PDF",
            data: deterministicOrder,
            canonical: toCanonicalAlkostoOcJson(deterministicOrder)
          });
        }
      }

      // 3. Fallback OCR Local (Tesseract.js en Español) para imágenes o PDFs escaneados si la IA externa no estuvo disponible
      if (!validatedOrder) {
        try {
          if (actualMime.startsWith("image/")) {
            const TesseractMod: any = await import("tesseract.js");
            const recognizeFn = TesseractMod.recognize || TesseractMod.default?.recognize;
            if (typeof recognizeFn === "function") {
              const ocrOut = await recognizeFn(binaryBuffer, "spa");
              const ocrText = String(ocrOut?.data?.text || "").trim();
              if (ocrText) {
                const localParsed = parseAlkostoFlexibleOcrText(ocrText);
                if (localParsed && localParsed.items.length > 0) {
                  validatedOrder = normalizeOrderForCodizulca(localParsed);
                  usedModel = "LOCAL_TESSERACT_OCR";
                }
              }
            }
          } else if (isPdfPayload) {
            const { PDFParse } = await import("pdf-parse");
            const pdfParser = new PDFParse({ data: binaryBuffer });
            try {
              const imgRes = await pdfParser.getImage({ imageBuffer: true, first: 1 });
              const firstPageImgs = imgRes?.pages?.[0]?.images || [];
              if (firstPageImgs.length > 0 && firstPageImgs[0]?.data) {
                const TesseractMod: any = await import("tesseract.js");
                const recognizeFn = TesseractMod.recognize || TesseractMod.default?.recognize;
                if (typeof recognizeFn === "function") {
                  const ocrOut = await recognizeFn(Buffer.from(firstPageImgs[0].data), "spa");
                  const ocrText = String(ocrOut?.data?.text || "").trim();
                  if (ocrText) {
                    const localParsed = parseAlkostoFlexibleOcrText(ocrText);
                    if (localParsed && localParsed.items.length > 0) {
                      validatedOrder = normalizeOrderForCodizulca(localParsed);
                      usedModel = "LOCAL_PDF_TESSERACT_OCR";
                    }
                  }
                }
              }
            } finally {
              await pdfParser.destroy().catch(() => {});
            }
          }
        } catch (localErr: any) {
          console.warn("[ALKOSTO OCR] Advertencia en fallback OCR local:", localErr?.message);
        }
      }

      if (!validatedOrder) {
        const lastMsg = String(lastModelError?.message || "");
        const isAuthOrKeyError =
          apiKeys.length === 0 ||
          /API_KEY_INVALID|API key not valid|reported as leaked|PERMISSION_DENIED|GEMINI_API_KEY/i.test(lastMsg);
        const isQuotaError =
          /RESOURCE_EXHAUSTED|prepayment credits|quota|billing|429/i.test(lastMsg);

        if (isAuthOrKeyError) {
          console.error("[ALKOSTO OCR] Error de configuración de clave Gemini API:", lastMsg.slice(0, 200));
          return res.status(503).json({
            error: "Error en Etapa [2-Conexión Gemini-Render]: El servicio de IA no tiene una clave GEMINI_API_KEY activa para analizar imágenes. Sube el archivo en formato PDF digital original de Alkosto o configura GEMINI_API_KEY en Render.",
            stage: "2-Conexión Gemini-Render",
            code: "AI_API_KEY_UNAVAILABLE"
          });
        }
        if (isQuotaError) {
          console.error("[ALKOSTO OCR] Cuota agotada en Gemini API:", lastMsg.slice(0, 200));
          return res.status(503).json({
            error: "Error en Etapa [2-Conexión Gemini-Render]: El servicio de lectura con IA alcanzó su límite temporal de solicitudes. Intenta nuevamente en unos segundos o sube el PDF digital de la Orden de Compra.",
            stage: "2-Conexión Gemini-Render",
            code: "AI_QUOTA_EXCEEDED"
          });
        }

        throw new AlkostoOcrStageError(
          currentStage,
          lastMsg || "No fue posible extraer renglones válidos de la Orden de Compra. Asegúrate de que la imagen o PDF sea legible."
        );
      }

      return res.json({
        success: true,
        parserMode: `AI_VALIDATED_${usedModel}`,
        data: normalizeOrderForCodizulca(validatedOrder),
        canonical: toCanonicalAlkostoOcJson(validatedOrder)
      });
    } catch (err: any) {
      const errStatus = err?.status || err?.statusCode || 500;
      const errMessage = String(err?.message || "Error desconocido");
      const stage: AlkostoOcrStage =
        err instanceof AlkostoOcrStageError
          ? err.stage
          : err instanceof AlkostoParseValidationError
            ? "4-Mapeo Nota de Pedido"
            : /JSON|parse|llave/i.test(errMessage)
              ? "3-Parseo JSON"
              : currentStage || "2-Conexión Gemini-Render";

      const formattedStageError = /^Error en Etapa \[/i.test(errMessage)
        ? errMessage
        : `Error en Etapa [${stage}]: ${errMessage}`;

      console.error("[ALKOSTO OCR] Error detallado procesando Orden de Compra:", {
        stage,
        statusCode: errStatus,
        name: err?.name,
        code: err?.code,
        message: formattedStageError.slice(0, 500)
      });

      if (err instanceof AlkostoParseValidationError) {
        return res.status(422).json({
          error: formattedStageError,
          stage: "4-Mapeo Nota de Pedido",
          code: err.code,
          issues: err.issues
        });
      }

      const isQuota = /RESOURCE_EXHAUSTED|prepayment credits|quota|billing|429/i.test(errMessage);
      const isKey = /API_KEY_INVALID|API key not valid|reported as leaked|PERMISSION_DENIED/i.test(errMessage);
      const isParse = /JSON|renglones|interpretar|legible/i.test(errMessage);

      if (isQuota || isKey) {
        return res.status(503).json({
          error: isKey
            ? "Error en Etapa [2-Conexión Gemini-Render]: El motor de IA requiere actualizar la credencial GEMINI_API_KEY en el servidor. Puedes subir el PDF digital original de Alkosto o ingresar los datos manualmente."
            : "Error en Etapa [2-Conexión Gemini-Render]: El lector automático (IA) está temporalmente saturado. Por favor reintenta en unos segundos o sube el PDF digital.",
          stage: "2-Conexión Gemini-Render",
          code: isKey ? "AI_KEY_INVALID" : "AI_QUOTA_EXCEEDED"
        });
      }

      if (isParse) {
        return res.status(422).json({
          error: formattedStageError,
          stage: "3-Parseo JSON",
          code: "OC_PARSE_ERROR"
        });
      }

      return res.status(500).json({
        error: formattedStageError,
        stage,
        code: "OC_PROCESSING_ERROR"
      });
    }
  });

  // RUTAS PARA ABREVIATURAS Y SUCURSALES DE CADENAS (ALKOSTO & FAMILIA CENTER)
  const ABREVIATURAS_CONFIG = {
    alkosto: [
      { codigo: '7498', tag: 'AK01', nombre: 'Alkosto 1 san Felipe', zona: 'san Felipe', direccion: 'Dirección de despacho; calle 98 CC san Felipe 1 nivel PB sector casco central.' },
      { codigo: '7499', tag: 'AK02', nombre: 'Alkosto 2 - Plaza baral', zona: 'Plaza baral', direccion: 'Plaza baral' },
      { codigo: '7497', tag: 'AK03', nombre: 'Alkosto 3 - Delicias', zona: 'Delicias', direccion: 'Delicias' },
      { codigo: '7500', tag: 'AK04', nombre: 'Alkosto 4 - Coromoto', zona: 'Coromoto', direccion: 'Coromoto' },
      { codigo: '7502', tag: 'AK05', nombre: 'Alkosto 5 - Cabimas', zona: 'Cabimas', direccion: 'Cabimas' },
      { codigo: '7503', tag: 'AK06', nombre: 'Alkosto 6 - Los cactu', zona: 'Los cactu', direccion: 'Los cactu' },
      { codigo: '7680', tag: 'AK07', nombre: 'Alkosto 7 - Bella vista', zona: 'Bella vista', direccion: 'Bella vista' },
      { codigo: '7905', tag: 'AK08', nombre: 'Alkosto 8 - Trujillo', zona: 'Trujillo', direccion: 'Trujillo' },
      { codigo: '8160', tag: 'AK09', nombre: 'Alkosto 9 - Antiguo nasa Zona industrial', zona: 'Antiguo nasa Zona industrial', direccion: 'Antiguo nasa Zona industrial' },
      { codigo: '8306', tag: 'AK10', nombre: 'Alkosto 10 - La limpia', zona: 'La limpia', direccion: 'La limpia' }
    ],
    familiaCenter: [
      { codigo: '7490', tag: 'FC01', nombre: 'Familia Center 1 - Plaza lago', zona: 'Plaza lago', direccion: 'Plaza lago' },
      { codigo: '7492', tag: 'FC02', nombre: 'Familia Center 2', zona: 'URB monte claro', direccion: 'Calle43entre Av 150 416N°15-041 URB monte claro' },
      { codigo: '7494', tag: 'FC03', nombre: 'Familia Center 3', zona: 'Parroquia Coquivacoa', direccion: 'CalleJ con Av 12 distinguido bajo el NJ-10 de nomenclatura municipal en jurisdicción parroquia coquivacoa el municipio autónomo Maracaibo estado Zulia.' },
      { codigo: '7491', tag: 'FC04', nombre: 'Familia 4 - Dr quintero', zona: 'Dr quintero', direccion: 'Dr quintero' },
      { codigo: '7489', tag: 'FC05', nombre: 'Familia Center 5 - La lago', zona: 'La lago', direccion: 'La lago' },
      { codigo: '7493', tag: 'FC06', nombre: 'Familia 6 - Los olivos', zona: 'Los olivos', direccion: 'Los olivos' },
      { codigo: '8229', tag: 'FC07', nombre: 'Familia Center #7 - San Francisco', zona: 'San Francisco', direccion: 'San Francisco' }
    ],
    tags: {
      alkosto: ['AK01', 'AK02', 'AK03', 'AK04', 'AK05', 'AK06', 'AK07', 'AK08', 'AK09', 'AK10'],
      familiaCenter: ['FC01', 'FC02', 'FC03', 'FC04', 'FC05', 'FC06', 'FC07']
    }
  };

  app.get("/api/cadenas/sucursales", authenticateToken, requireAlkostoAccess, async (req, res) => {
    try {
      res.json({
        success: true,
        ...ABREVIATURAS_CONFIG
      });
    } catch (err: any) {
      res.status(500).json({ error: "Error obteniendo sucursales de cadenas" });
    }
  });

  app.post("/api/cadenas/sincronizar", authenticateToken, requireAlkostoAccess, async (req, res) => {
    try {
      await setDoc(doc(db, 'cadenas_config', 'abreviaturas'), {
        ...ABREVIATURAS_CONFIG,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      res.json({ success: true, message: "Abreviaturas de Alkosto y Familia Center sincronizadas correctamente en Firestore" });
    } catch (err: any) {
      console.error("Error sincronizando cadenas en Firestore:", err);
      res.status(500).json({ error: "Error sincronizando en Firestore", details: err?.message });
    }
  });

  let cachedBcvRate = 875.65;

  // AGENTE EXPERTO EN AUDITORÍA BANCARIA Y EXTRACCIÓN DE DATOS FINANCIEROS EN VENEZUELA
  // Nota: Se emplea rateLimiter sin bloqueo por JWT expirado para evitar fallos 401/403 en campo.
  app.post("/api/ocr", rateLimiter(10 * 60000, 30, 'OCR Bancario'), async (req: any, res: any) => {
    try {
      const { imageBase64, mimeType = "image/jpeg", fileName = "" } = req.body || {};
      if (!imageBase64) {
        return res.status(400).json({ error: "Falta la imagen o PDF del comprobante de pago." });
      }

      const rawBase64Str = String(imageBase64).trim();
      const cleanBase64 = (rawBase64Str.includes(",") ? rawBase64Str.split(",")[1] : rawBase64Str).replace(/\s+/g, "");

      const binaryBuffer = Buffer.from(cleanBase64, "base64");
      if (!binaryBuffer || binaryBuffer.length < 32) {
        return res.status(400).json({ error: "El archivo del comprobante está vacío o corrupto." });
      }

      // Detección dinámica real de mimeType por magic bytes + DataURL + extensión
      const actualMime = detectReceiptMimeType(binaryBuffer, mimeType, fileName);

      // Descubrir y limpiar claves de API de Gemini configuradas en el entorno
      const rawKeyCandidates = [
        process.env.GEMINI_API_KEY,
        process.env.GOOGLE_API_KEY,
        process.env.VITE_GEMINI_API_KEY,
        process.env.API_KEY
      ]
        .filter(Boolean)
        .flatMap((k) => String(k).split(","))
        .map((k) => k.trim().replace(/^["']+|["']+$/g, "").trim())
        .filter((k) => k.length > 10 && k !== "undefined" && k !== "null");
      const apiKeys = Array.from(new Set(rawKeyCandidates));

      let aiResult: AuditedReceiptResult | null = null;
      let lastAiError: any = null;

      if (apiKeys.length > 0) {
        const geminiExtraction = await extractSupportWithGemini({
          apiKeys,
          base64Data: cleanBase64,
          mimeType: actualMime,
          fileName
        });

        const audited = geminiExtraction.audited;
        const hasCompleteAiFields = Boolean(
          audited &&
            audited.banco &&
            audited.monto_bs &&
            audited.monto_bs > 0 &&
            audited.referencia
        );
        if (audited && hasCompleteAiFields) {
          return res.json({
            ...audited,
            es_legible: true,
            legible: true,
            lectura_exitosa: true
          });
        }
        aiResult = audited;
        if (geminiExtraction.errorMessage) {
          lastAiError = new Error(geminiExtraction.errorMessage);
        }
      }

      // MOTOR SECUNDARIO DETERMINISTA / OCR LOCAL (PDF Digital + Preprocesamiento Anti-Moiré + Tesseract.js en Español)
      // Garantiza extracción continua en capturas oscuras y fotos a monitores con efecto moiré / tablas sin etiquetas
      const runSmartImageOcrWithAntiMoire = async (imgBuffer: Buffer): Promise<AuditedReceiptResult | null> => {
        const TesseractMod: any = await import("tesseract.js");
        const recognizeFn = TesseractMod.recognize || TesseractMod.default?.recognize;
        const createWorkerFn = TesseractMod.createWorker || TesseractMod.default?.createWorker;

        let pass1Result: AuditedReceiptResult | null = null;
        let pass2Result: AuditedReceiptResult | null = null;

        try {
          const canvasMod: any = await import("@napi-rs/canvas");
          const { createCanvas, loadImage } = canvasMod;
          const img = await loadImage(imgBuffer);
          const w = img.width;
          const h = img.height;

          // PASADA 1: Escalado 2x + inversión automática para capturas en Modo Oscuro (ej. BNC Pago Móvil)
          const scale1 = w < 1000 ? 2 : 1;
          const c1 = createCanvas(w * scale1, h * scale1);
          const ctx1 = c1.getContext("2d");
          ctx1.imageSmoothingEnabled = true;
          ctx1.drawImage(img, 0, 0, w * scale1, h * scale1);
          const d1 = ctx1.getImageData(0, 0, w * scale1, h * scale1);
          let meanLum = 0;
          const totalPx1 = w * scale1 * h * scale1;
          for (let i = 0; i < totalPx1; i++) {
            meanLum += 0.299 * d1.data[i * 4] + 0.587 * d1.data[i * 4 + 1] + 0.114 * d1.data[i * 4 + 2];
          }
          meanLum /= Math.max(1, totalPx1);
          if (meanLum < 90) {
            for (let i = 0; i < totalPx1; i++) {
              const g = 255 - (0.299 * d1.data[i * 4] + 0.587 * d1.data[i * 4 + 1] + 0.114 * d1.data[i * 4 + 2]);
              d1.data[i * 4] = g;
              d1.data[i * 4 + 1] = g;
              d1.data[i * 4 + 2] = g;
            }
            ctx1.putImageData(d1, 0, 0);
          }

          if (typeof recognizeFn === "function") {
            const out1 = await recognizeFn(c1.toBuffer("image/png"), "spa");
            const txt1 = String(out1?.data?.text || "").trim();
            if (txt1) {
              pass1Result = parseVenezuelanReceiptText(txt1);
            }
          }

          if (pass1Result && pass1Result.monto_bs && pass1Result.monto_bs > 0 && pass1Result.referencia && pass1Result.banco) {
            return pass1Result;
          }

          // PASADA 2: Filtro Anti-Moiré Horizontal + Imagen Integral + Supresión de Bordes de Tabla + PSM 6
          // Diseñado específicamente para fotos tomadas a monitores (ej. Provinet en columna sin etiquetas)
          const cOrig = createCanvas(w, h);
          const ctxOrig = cOrig.getContext("2d");
          ctxOrig.drawImage(img, 0, 0);
          const src = ctxOrig.getImageData(0, 0, w, h).data;

          const gray = new Float32Array(w * h);
          for (let i = 0; i < w * h; i++) {
            const g = 0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2];
            gray[i] = meanLum < 90 ? 255 - g : g;
          }

          const weights = [0.15, 0.2, 0.3, 0.2, 0.15];
          const hBlur = new Float32Array(w * h);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              let s = 0;
              let wSum = 0;
              for (let dx = -2; dx <= 2; dx++) {
                const nx = x + dx;
                if (nx >= 0 && nx < w) {
                  const wt = weights[dx + 2];
                  s += gray[y * w + nx] * wt;
                  wSum += wt;
                }
              }
              hBlur[y * w + x] = s / wSum;
            }
          }

          const integral = new Float64Array((w + 1) * (h + 1));
          for (let y = 1; y <= h; y++) {
            let rowSum = 0;
            for (let x = 1; x <= w; x++) {
              rowSum += hBlur[(y - 1) * w + (x - 1)];
              integral[y * (w + 1) + x] = integral[(y - 1) * (w + 1) + x] + rowSum;
            }
          }
          const getBoxMean = (x0: number, y0: number, x1: number, y1: number) => {
            const cx0 = Math.max(0, x0);
            const cy0 = Math.max(0, y0);
            const cx1 = Math.min(w - 1, x1);
            const cy1 = Math.min(h - 1, y1);
            const area = (cx1 - cx0 + 1) * (cy1 - cy0 + 1);
            return (
              (integral[(cy1 + 1) * (w + 1) + (cx1 + 1)] -
                integral[cy0 * (w + 1) + (cx1 + 1)] -
                integral[(cy1 + 1) * (w + 1) + cx0] +
                integral[cy0 * (w + 1) + cx0]) /
              area
            );
          };

          const norm = new Float32Array(w * h);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const bg = getBoxMean(x - 25, y - 25, x + 25, y + 25);
              norm[y * w + x] = Math.max(0, bg - hBlur[y * w + x]);
            }
          }

          const isLine = new Uint8Array(w * h);
          for (let y = 0; y < h; y++) {
            let runStart = -1;
            for (let x = 0; x <= w; x++) {
              const val =
                x < w
                  ? Math.max(
                      norm[y * w + x],
                      y > 0 ? norm[(y - 1) * w + x] * 0.8 : 0,
                      y + 1 < h ? norm[(y + 1) * w + x] * 0.8 : 0
                    )
                  : 0;
              if (val > 7) {
                if (runStart === -1) runStart = x;
              } else {
                if (runStart !== -1 && x - runStart >= 50) {
                  for (let k = runStart; k < x; k++) {
                    const above = y >= 5 ? norm[(y - 5) * w + k] : 0;
                    const below = y + 5 < h ? norm[(y + 5) * w + k] : 0;
                    if (above < 12 || below < 12) {
                      isLine[y * w + k] = 1;
                      if (y > 0 && above < 10) isLine[(y - 1) * w + k] = 1;
                      if (y + 1 < h && below < 10) isLine[(y + 1) * w + k] = 1;
                    }
                  }
                }
                runStart = -1;
              }
            }
          }

          for (let x = 0; x < w; x++) {
            let runStart = -1;
            for (let y = 0; y <= h; y++) {
              const val =
                y < h
                  ? Math.max(
                      norm[y * w + x],
                      x > 0 ? norm[y * w + (x - 1)] * 0.8 : 0,
                      x + 1 < w ? norm[y * w + (x + 1)] * 0.8 : 0
                    )
                  : 0;
              if (val > 7) {
                if (runStart === -1) runStart = y;
              } else {
                if (runStart !== -1 && y - runStart >= 55) {
                  for (let k = runStart; k < y; k++) {
                    const left = x >= 5 ? norm[k * w + (x - 5)] : 0;
                    const right = x + 5 < w ? norm[k * w + (x + 5)] : 0;
                    if (left < 12 || right < 12) {
                      isLine[k * w + x] = 1;
                      if (x > 0 && left < 10) isLine[k * w + (x - 1)] = 1;
                      if (x + 1 < w && right < 10) isLine[k * w + (x + 1)] = 1;
                    }
                  }
                }
                runStart = -1;
              }
            }
          }

          const outCanvas = createCanvas(w, h);
          const outCtx = outCanvas.getContext("2d");
          const outImg = outCtx.createImageData(w, h);
          for (let i = 0; i < w * h; i++) {
            const d = isLine[i] ? 0 : norm[i];
            const v = d <= 4 ? 255 : Math.max(0, Math.min(255, Math.round(255 - (d - 4) * 8.5)));
            outImg.data[i * 4] = v;
            outImg.data[i * 4 + 1] = v;
            outImg.data[i * 4 + 2] = v;
            outImg.data[i * 4 + 3] = 255;
          }
          outCtx.putImageData(outImg, 0, 0);

          const scale2 = w < 900 ? 2 : 1;
          let finalPngBuffer: Buffer;
          if (scale2 === 1) {
            finalPngBuffer = outCanvas.toBuffer("image/png");
          } else {
            const upCanvas = createCanvas(w * scale2, h * scale2);
            const upCtx = upCanvas.getContext("2d");
            upCtx.imageSmoothingEnabled = true;
            upCtx.drawImage(outCanvas, 0, 0, w * scale2, h * scale2);
            finalPngBuffer = upCanvas.toBuffer("image/png");
          }

          if (typeof createWorkerFn === "function") {
            const worker = await createWorkerFn("spa");
            try {
              await worker.setParameters({ tessedit_pageseg_mode: "6" });
              const out2 = await worker.recognize(finalPngBuffer);
              const txt2 = String(out2?.data?.text || "").trim();
              if (txt2) {
                pass2Result = parseVenezuelanReceiptText(txt2);
              }
            } finally {
              await worker.terminate().catch(() => {});
            }
          } else if (typeof recognizeFn === "function") {
            const out2 = await recognizeFn(finalPngBuffer, "spa");
            const txt2 = String(out2?.data?.text || "").trim();
            if (txt2) {
              pass2Result = parseVenezuelanReceiptText(txt2);
            }
          }
        } catch (canvasErr) {
          if (typeof recognizeFn === "function" && !pass1Result) {
            const rawOut = await recognizeFn(imgBuffer, "spa");
            const rawTxt = String(rawOut?.data?.text || "").trim();
            if (rawTxt) {
              pass1Result = parseVenezuelanReceiptText(rawTxt);
            }
          }
        }

        const scoreAudited = (r: AuditedReceiptResult | null): number => {
          if (!r) return 0;
          let s = 0;
          if (r.monto_bs && r.monto_bs > 0) s += 3;
          if (r.referencia) s += 3;
          if (r.banco) s += 2;
          if (r.fecha_iso) s += 2;
          if (r.numero_cuenta) s += 1;
          return s;
        };

        if (scoreAudited(pass2Result) >= scoreAudited(pass1Result) && pass2Result) {
          return pass2Result;
        }
        return pass1Result || pass2Result;
      };

      let fallbackResult: AuditedReceiptResult | null = null;
      try {
        if (actualMime === "application/pdf") {
          const { PDFParse } = await import("pdf-parse");
          const pdfParser = new PDFParse({ data: binaryBuffer });
          try {
            const textRes = await pdfParser.getText();
            const extractedPdfText = String(textRes?.text || "").trim();
            if (extractedPdfText.length >= 12) {
              fallbackResult = parseVenezuelanReceiptText(extractedPdfText);
            }
            // Si el PDF es una imagen escaneada incrustada sin capa de texto digital
            if (!fallbackResult?.legible) {
              const imgRes = await pdfParser.getImage({ imageBuffer: true, first: 1 });
              const firstPageImgs = imgRes?.pages?.[0]?.images || [];
              if (firstPageImgs.length > 0 && firstPageImgs[0]?.data) {
                fallbackResult = await runSmartImageOcrWithAntiMoire(Buffer.from(firstPageImgs[0].data));
              }
            }
          } finally {
            await pdfParser.destroy().catch(() => {});
          }
        } else if (actualMime.startsWith("image/")) {
          fallbackResult = await runSmartImageOcrWithAntiMoire(binaryBuffer);
        }
      } catch (localOcrErr: any) {
        console.warn("[OCR COBROS LOCAL] Advertencia en motor local PDF/Tesseract:", localOcrErr?.message);
      }

      if (aiResult || fallbackResult) {
        const mergedTexto = [
          aiResult?.texto_completo || "",
          fallbackResult?.texto_completo || "",
          aiResult?.canal || "",
          fallbackResult?.canal || ""
        ]
          .filter(Boolean)
          .join(" ");
        const mergedCuenta =
          aiResult?.numero_cuenta ||
          aiResult?.datos_extraidos?.numero_cuenta ||
          fallbackResult?.numero_cuenta ||
          fallbackResult?.datos_extraidos?.numero_cuenta ||
          null;
        const mergedBanco =
          inferirBancoVenezolano(
            aiResult?.banco || fallbackResult?.banco || null,
            mergedTexto,
            mergedCuenta
          ) ||
          aiResult?.banco ||
          fallbackResult?.banco ||
          null;
        const mergedMontoNum =
          parseMontoVenezolano(aiResult?.montoRaw ?? aiResult?.montoNumerico ?? aiResult?.monto_bs) ||
          parseMontoVenezolano(fallbackResult?.montoRaw ?? fallbackResult?.montoNumerico ?? fallbackResult?.monto_bs) ||
          null;
        const mergedMontoRaw =
          aiResult?.montoRaw ||
          fallbackResult?.montoRaw ||
          (mergedMontoNum
            ? new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(mergedMontoNum)
            : null);

        const baseObj = aiResult || fallbackResult!;
        const combined = auditAndNormalizeReceiptPayload({
          ...fallbackResult,
          ...aiResult,
          banco: mergedBanco,
          canal: aiResult?.canal || fallbackResult?.canal || (mergedBanco === "BBVA Provincial" ? "Provinet" : null),
          monto_bs: mergedMontoNum,
          montoNumerico: mergedMontoNum,
          montoRaw: mergedMontoRaw,
          referencia: aiResult?.referencia || fallbackResult?.referencia || null,
          fecha_pago: aiResult?.fecha_pago || fallbackResult?.fecha_pago || null,
          fecha_iso: aiResult?.fecha_iso || fallbackResult?.fecha_iso || null,
          numero_cuenta: mergedCuenta,
          texto_completo: mergedTexto || baseObj.texto_completo || null
        });

        const hasAnyCombinedField = Boolean(
          (combined.monto_bs && combined.monto_bs > 0) ||
            combined.referencia ||
            combined.fecha_pago ||
            combined.fecha_iso ||
            combined.banco ||
            combined.numero_cuenta
        );

        if (hasAnyCombinedField) {
          return res.json({
            ...combined,
            es_legible: true,
            legible: true,
            lectura_exitosa: true
          });
        }
      }

      if (aiResult) {
        return res.status(422).json({
          ...aiResult,
          es_legible: false,
          legible: false,
          error: aiResult.observacion_ia || "No se pudo leer con claridad el monto o la referencia del comprobante."
        });
      }

      const rawAiErrMsg = String(lastAiError?.message || "");
      const isQuotaOrKeyIssue =
        apiKeys.length === 0 ||
        /RESOURCE_EXHAUSTED|prepayment credits|"code"\s*:\s*(402|429)|quota|billing|API_KEY_INVALID|API key not valid|reported as leaked|PERMISSION_DENIED/i.test(
          rawAiErrMsg
        );

      const fallbackMessage = isQuotaOrKeyIssue
        ? "No se pudo completar la lectura automática en este soporte. Por favor ingresa o verifica los datos manualmente."
        : "Comprobante ilegible o con baja resolución. Toma la captura nítida sin recortes o ingresa los datos manualmente.";

      const unreadablePayload: AuditedReceiptResult = {
        es_legible: false,
        legible: false,
        confianza: 0.0,
        confianza_lectura: "baja",
        metodo_pago: "Pago Móvil",
        banco: null,
        canal: null,
        banco_origen: null,
        banco_destino: null,
        monto_bs: null,
        monto_texto_original: null,
        referencia: null,
        nro_referencia: null,
        codigo_autorizacion: null,
        fecha_pago: null,
        fecha_iso: null,
        titular_remitente: null,
        rif_ci_titular: null,
        beneficiario_detectado: null,
        observacion_auditoria: fallbackMessage,
        observacion_ia: fallbackMessage
      };

      return res.status(isQuotaOrKeyIssue ? 503 : 422).json({
        ...unreadablePayload,
        error: unreadablePayload.observacion_auditoria
      });
    } catch (err: any) {
      console.error("[OCR COBROS] Error inesperado procesando comprobante:", err);
      const internalErrObs = "Error interno al procesar el comprobante. Puedes ingresar los datos manualmente.";
      return res.status(500).json({
        legible: false,
        confianza: 0.0,
        confianza_lectura: "baja",
        metodo_pago: "Pago Móvil",
        banco: null,
        banco_origen: null,
        banco_destino: null,
        monto_bs: null,
        monto_texto_original: null,
        referencia: null,
        nro_referencia: null,
        codigo_autorizacion: null,
        fecha_pago: null,
        fecha_iso: null,
        titular_remitente: null,
        rif_ci_titular: null,
        beneficiario_detectado: null,
        observacion_auditoria: internalErrObs,
        observacion_ia: internalErrObs,
        error: "No se pudo interpretar el comprobante. Puedes ingresar los datos manualmente."
      });
    }
  });

  // ==============================================================
  // ALMACENAMIENTO EN LA NUBE (SUPABASE STORAGE) Y REGISTRO DE COBROS
  // ==============================================================
  const COBROS_BUCKET = 'comprobantes-cobros';
  const COBROS_LOCAL_DB_PATH = path.join(process.cwd(), 'cobros_registrados.json');
  let cobrosBucketInitialized = false;

  async function ensureCobrosBucket() {
    if (cobrosBucketInitialized || !supabase) return;
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const exists = Array.isArray(buckets) && buckets.some((b: any) => b.name === COBROS_BUCKET);
      if (!exists) {
        await supabase.storage.createBucket(COBROS_BUCKET, {
          public: true,
          fileSizeLimit: 15728640,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'application/json']
        });
      }
      cobrosBucketInitialized = true;
    } catch (err: any) {
      console.warn('[COBROS STORAGE] Advertencia verificando bucket:', err?.message);
    }
  }

  app.post("/api/cobros/sync", authenticateToken, async (req: any, res: any) => {
    try {
      const {
        id,
        vendedor,
        vendedorEmail,
        ruta,
        metodo_pago = 'Pago Móvil',
        banco = 'No especificado',
        monto = 0,
        referencia = '',
        fecha_pago,
        titular = '',
        rif = '',
        tasa = 0,
        codigo_cliente = 'N/A',
        nombre_cliente = '',
        factura = 'N/A',
        fileDataUrl,
        fileName,
        fileMimeType,
        createdAt
      } = req.body || {};

      if (!referencia || Number(monto) <= 0) {
        return res.status(400).json({ error: 'Referencia y monto mayor a 0 son obligatorios para sincronizar el cobro.' });
      }

      const cobroId = String(id || `pago-${Date.now()}`);
      const safeVendedor = String(vendedor || req.user?.username || 'VENDEDOR')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 40);
      const safeRef = String(referencia).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30) || 'ref';
      const fechaStr = String(fecha_pago || new Date().toISOString().split('T')[0]).replace(/[^0-9-]/g, '');

      let comprobante_url = '';
      let uploadedMime = String(fileMimeType || 'image/jpeg');

      // 1. Subir archivo del comprobante (JPG/PNG/WEBP o PDF) a Supabase Storage
      if (fileDataUrl && typeof fileDataUrl === 'string' && supabase) {
        await ensureCobrosBucket();
        let base64Part = fileDataUrl.trim();
        if (base64Part.startsWith('data:')) {
          const m = base64Part.match(/^data:([^;]+);base64,(.+)$/);
          if (m) {
            uploadedMime = m[1];
            base64Part = m[2];
          }
        }
        const fileBuffer = Buffer.from(base64Part, 'base64');
        if (fileBuffer.length > 0) {
          let ext = 'jpg';
          if (uploadedMime === 'application/pdf' || String(fileName || '').toLowerCase().endsWith('.pdf')) {
            ext = 'pdf';
            uploadedMime = 'application/pdf';
          } else if (uploadedMime === 'image/png') {
            ext = 'png';
          } else if (uploadedMime === 'image/webp') {
            ext = 'webp';
          }

          const storagePath = `soportes/${safeVendedor}/${fechaStr}_${safeRef}_${cobroId}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from(COBROS_BUCKET)
            .upload(storagePath, fileBuffer, {
              contentType: uploadedMime,
              upsert: true
            });

          if (!uploadErr) {
            const { data: pubData } = supabase.storage.from(COBROS_BUCKET).getPublicUrl(storagePath);
            if (pubData?.publicUrl) {
              comprobante_url = pubData.publicUrl;
            }
          } else {
            console.warn('[COBROS STORAGE] Error subiendo archivo a Supabase Storage:', uploadErr.message);
          }
        }
      }

      const syncedAt = new Date().toISOString();
      const cobroMetadata = {
        id: cobroId,
        vendedor: String(vendedor || req.user?.username || 'ADMIN'),
        vendedorEmail: vendedorEmail || null,
        ruta: String(ruta || 'Ruta 1'),
        metodo_pago: String(metodo_pago || 'Pago Móvil'),
        banco: String(banco || 'No especificado'),
        monto: Number(monto) || 0,
        referencia: String(referencia).trim(),
        fecha_pago: fechaStr,
        titular: String(titular || ''),
        rif: String(rif || ''),
        tasa: Number(tasa) || 0,
        codigo_cliente: String(codigo_cliente || 'N/A'),
        nombre_cliente: String(nombre_cliente || ''),
        factura: String(factura || 'N/A'),
        fileName: fileName || null,
        fileMimeType: uploadedMime,
        comprobante_url: comprobante_url || null,
        createdAt: createdAt || syncedAt,
        syncedAt
      };

      // 2. Guardar registro JSON estructurado en Supabase Storage (vinculando comprobante_url al cobro)
      if (supabase) {
        try {
          await ensureCobrosBucket();
          const jsonBuffer = Buffer.from(JSON.stringify(cobroMetadata, null, 2), 'utf-8');
          await supabase.storage
            .from(COBROS_BUCKET)
            .upload(`registros/${safeVendedor}/${cobroId}.json`, jsonBuffer, {
              contentType: 'application/json',
              upsert: true
            });
        } catch (e: any) {
          console.warn('[COBROS STORAGE] Advertencia guardando JSON en Storage:', e?.message);
        }
      }

      // 3. Guardar en Firestore (colección cobros_registrados) si está disponible
      try {
        await setDoc(doc(db, 'cobros_registrados', cobroId), cobroMetadata, { merge: true });
      } catch (_fsErr) {}

      // 4. Guardar en respaldo local del servidor (cobros_registrados.json)
      try {
        let existingList: any[] = [];
        if (fs.existsSync(COBROS_LOCAL_DB_PATH)) {
          existingList = JSON.parse(fs.readFileSync(COBROS_LOCAL_DB_PATH, 'utf-8')) || [];
        }
        const filtered = existingList.filter((item: any) => item && item.id !== cobroId);
        filtered.unshift(cobroMetadata);
        fs.writeFileSync(COBROS_LOCAL_DB_PATH, JSON.stringify(filtered.slice(0, 1000), null, 2), 'utf-8');
      } catch (_localErr) {}

      return res.json({
        success: true,
        comprobante_url,
        syncedAt,
        cobro: cobroMetadata
      });
    } catch (err: any) {
      console.error('[COBROS SYNC] Error sincronizando cobro:', err);
      return res.status(500).json({ error: err?.message || 'Error interno al sincronizar el cobro en la nube.' });
    }
  });

  // Normaliza nombres de vendedores para cruzar con carpetas de Supabase Storage (ej. "maria briceños" -> "Mar_a_Brice_o")
  const normalizeCobroVendorKey = (raw: string): string =>
    String(raw || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/s\b/g, '')
      .replace(/[^a-z0-9]/g, '');

  const toVenezuelaDateIso = (isoStr?: string): string => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr).slice(0, 10);
    // Venezuela UTC-4
    return new Date(d.getTime() - 4 * 3600 * 1000).toISOString().slice(0, 10);
  };

  app.get("/api/cobros", authenticateToken, async (req: any, res: any) => {
    try {
      const vendedorFilter = String(req.query.vendedor || '').trim();
      const dateFilter = String(req.query.date || '').trim(); // ej. "2026-11-03", "today", "2026-11-03_utc", "all"
      const includeImages = req.query.includeImages === 'true';

      const targetDateVe =
        dateFilter === 'today'
          ? toVenezuelaDateIso(new Date().toISOString())
          : /^\d{4}-\d{2}-\d{2}$/.test(dateFilter)
          ? dateFilter
          : '';

      const byId = new Map<string, any>();

      // 1. Leer respaldo local en disco (cobros_registrados.json)
      if (fs.existsSync(COBROS_LOCAL_DB_PATH)) {
        try {
          const localList = JSON.parse(fs.readFileSync(COBROS_LOCAL_DB_PATH, 'utf-8')) || [];
          for (const item of localList) {
            if (item && item.id) byId.set(item.id, item);
          }
        } catch (_e) {}
      }

      // 2. Consultar directamente Supabase Storage (bucket comprobantes-cobros/registros)
      if (supabase) {
        try {
          const { data: folders } = await supabase.storage.from(COBROS_BUCKET).list('registros', { limit: 100 });
          const targetVendorKey = normalizeCobroVendorKey(vendedorFilter);

          const matchingFolders = (folders || []).filter((f: any) => {
            if (!f?.name) return false;
            if (!targetVendorKey) return true;
            const folderKey = normalizeCobroVendorKey(f.name.replace(/_/g, ' '));
            return (
              folderKey.includes(targetVendorKey) ||
              targetVendorKey.includes(folderKey) ||
              (targetVendorKey.includes('maria') && folderKey.includes('mar') && folderKey.includes('brice'))
            );
          });

          for (const folder of matchingFolders) {
            const { data: files } = await supabase.storage
              .from(COBROS_BUCKET)
              .list(`registros/${folder.name}`, {
                limit: 300,
                sortBy: { column: 'created_at', order: 'desc' },
              });

            const candidateFiles = (files || []).filter((fileObj: any) => {
              if (!fileObj?.name || !fileObj.name.endsWith('.json')) return false;
              if (!dateFilter || dateFilter === 'all') return true;
              const createdAtStr = String(fileObj.created_at || '');
              if (dateFilter.endsWith('_utc')) {
                const utcDay = dateFilter.replace('_utc', '');
                return createdAtStr.startsWith(utcDay);
              }
              if (targetDateVe) {
                const fileVeDay = toVenezuelaDateIso(createdAtStr);
                return fileVeDay === targetDateVe || createdAtStr.startsWith(targetDateVe);
              }
              return true;
            });

            // Descargar en paralelo (en lotes de 10) los metadatos JSON faltantes
            const batchSize = 10;
            for (let i = 0; i < candidateFiles.length; i += batchSize) {
              const slice = candidateFiles.slice(i, i + batchSize);
              await Promise.all(
                slice.map(async (fileObj: any) => {
                  const idGuess = fileObj.name.replace(/\.json$/, '');
                  if (byId.has(idGuess)) return;
                  try {
                    const { data: blob } = await supabase.storage
                      .from(COBROS_BUCKET)
                      .download(`registros/${folder.name}/${fileObj.name}`);
                    if (blob) {
                      const rec = JSON.parse(await blob.text());
                      if (rec && rec.id) {
                        byId.set(rec.id, rec);
                      }
                    }
                  } catch (_dlErr) {}
                })
              );
            }
          }
        } catch (supaErr: any) {
          console.warn('[COBROS RECOVER] Advertencia listando Supabase Storage:', supaErr?.message);
        }
      }

      // 3. Filtrar por vendedor y por fecha solicitada
      let list = Array.from(byId.values());

      if (vendedorFilter) {
        const targetVendorKey = normalizeCobroVendorKey(vendedorFilter);
        list = list.filter((item: any) => {
          const itemKey = normalizeCobroVendorKey(item.vendedor || '');
          return (
            itemKey.includes(targetVendorKey) ||
            targetVendorKey.includes(itemKey) ||
            (targetVendorKey.includes('maria') && itemKey.includes('maria') && itemKey.includes('briceno'))
          );
        });
      }

      if (dateFilter && dateFilter !== 'all') {
        if (dateFilter.endsWith('_utc')) {
          const utcDay = dateFilter.replace('_utc', '');
          list = list.filter((item: any) =>
            String(item.createdAt || item.syncedAt || '').startsWith(utcDay)
          );
        } else if (targetDateVe) {
          list = list.filter((item: any) => {
            const veDay = toVenezuelaDateIso(item.createdAt || item.syncedAt);
            return veDay === targetDateVe;
          });
        }
      }

      // Ordenar cronológicamente (más recientes primero)
      list.sort((a: any, b: any) =>
        String(b.createdAt || b.syncedAt || '').localeCompare(String(a.createdAt || a.syncedAt || ''))
      );

      // 4. Si se solicitó includeImages=true, hidratar imágenes Base64 desde comprobante_url para exportación PDF
      if (includeImages && list.length > 0) {
        const imgBatchSize = 6;
        for (let i = 0; i < list.length; i += imgBatchSize) {
          const slice = list.slice(i, i + imgBatchSize);
          await Promise.all(
            slice.map(async (item: any) => {
              if (item.image || !item.comprobante_url) return;
              try {
                const imgRes = await fetch(item.comprobante_url);
                if (imgRes.ok) {
                  const arrBuf = await imgRes.arrayBuffer();
                  const mime = item.fileMimeType || imgRes.headers.get('content-type') || 'image/jpeg';
                  const b64 = Buffer.from(arrBuf).toString('base64');
                  const dataUrl = `data:${mime};base64,${b64}`;
                  item.image = mime === 'application/pdf' ? undefined : dataUrl;
                  item.fileDataUrl = dataUrl;
                }
              } catch (_imgErr) {}
            })
          );
        }
      }

      return res.json({
        success: true,
        total: list.length,
        cobros: list,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Error consultando cobros sincronizados' });
    }
  });

  // ============================================================================
  // SERVICIO Y SCRAPER OFICIAL BCV: https://www.bcv.org.ve/estadisticas/indice-de-inversion
  // Soporta tablas HTML + paginación + archivos .xls/.xlsx + regla de día hábil (5 días)
  // ============================================================================
  const BCV_LOCAL_CACHE_PATH = path.join(process.cwd(), "bcv_rates_history_cache.json");
  const bcvHttpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
  let bcvRatesHistoryMap: Record<string, number> = {};
  let lastBcvScrapeTimestamp = 0;
  const BCV_SCRAPE_TTL_MS = 10 * 60 * 1000; // 10 minutos

  // Cargar caché de tasas históricas BCV desde disco al iniciar
  try {
    if (fs.existsSync(BCV_LOCAL_CACHE_PATH)) {
      const rawJson = JSON.parse(fs.readFileSync(BCV_LOCAL_CACHE_PATH, "utf-8"));
      if (rawJson && typeof rawJson === "object") {
        for (const [k, v] of Object.entries(rawJson)) {
          const num = typeof v === "number" ? v : (v as any)?.tasa;
          const clean = parseNumeroBcv(num);
          if (clean > 0 && /^\d{4}-\d{2}-\d{2}$/.test(k)) {
            bcvRatesHistoryMap[k] = clean;
          }
        }
      }
    }
  } catch (_e) {}

  // Hidratar y sincronizar diccionario de tasas históricas BCV con Supabase Storage
  const persistBcvRatesCache = async () => {
    try {
      fs.writeFileSync(BCV_LOCAL_CACHE_PATH, JSON.stringify(bcvRatesHistoryMap, null, 2), "utf-8");
    } catch (_e) {}
    if (supabase) {
      try {
        await ensureCobrosBucket();
        const payload = Buffer.from(JSON.stringify(bcvRatesHistoryMap, null, 2), "utf-8");
        await supabase.storage
          .from(COBROS_BUCKET)
          .upload("config/bcv_rates_history_cache.json", payload, {
            contentType: "application/json",
            upsert: true,
          });
      } catch (_supaErr) {}
    }
  };

  // Descarga binaria/texto desde www.bcv.org.ve ignorando cadena SSL incompleta
  const fetchBcvBuffer = (targetUrl: string, timeoutMs = 7000, redirectsLeft = 3): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
      const req = https.get(
        targetUrl,
        {
          agent: bcvHttpsAgent,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-VE,es;q=0.9,en;q=0.8",
          },
        },
        (resp) => {
          const status = resp.statusCode || 0;
          if ([301, 302, 303, 307, 308].includes(status) && resp.headers.location && redirectsLeft > 0) {
            const nextUrl = resp.headers.location.startsWith("http")
              ? resp.headers.location
              : `https://www.bcv.org.ve${resp.headers.location.startsWith("/") ? "" : "/"}${resp.headers.location}`;
            resp.resume();
            fetchBcvBuffer(nextUrl, timeoutMs, redirectsLeft - 1).then(resolve).catch(reject);
            return;
          }
          if (status < 200 || status >= 300) {
            resp.resume();
            reject(new Error(`HTTP ${status} desde ${targetUrl}`));
            return;
          }
          const chunks: Buffer[] = [];
          resp.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          resp.on("end", () => resolve(Buffer.concat(chunks)));
          resp.on("error", reject);
        }
      );
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error(`Timeout (${timeoutMs}ms) consultando ${targetUrl}`));
      });
      req.on("error", reject);
    });
  };

  // Scraper de https://www.bcv.org.ve/estadisticas/indice-de-inversion (tablas HTML + paginación + .xls/.xlsx)
  const syncBcvRatesForDate = async (targetIso: string): Promise<void> => {
    const now = Date.now();
    const alreadyResolved = resolveBcvRateWithBusinessDayFallback(bcvRatesHistoryMap, targetIso, 5);
    if (alreadyResolved && !alreadyResolved.esDiaHabilAnterior) {
      return;
    }
    if (alreadyResolved && now - lastBcvScrapeTimestamp < BCV_SCRAPE_TTL_MS) {
      return;
    }

    let updated = false;

    try {
      // 1. Descargar página principal de https://www.bcv.org.ve/estadisticas/indice-de-inversion
      const page0Buf = await fetchBcvBuffer(BCV_INDICE_INVERSION_URL, 7000);
      const page0Html = page0Buf.toString("utf-8");
      const page0Rates = parseBcvIndiceInversionHtml(page0Html);
      const extractedDates = Object.keys(page0Rates).sort();

      if (extractedDates.length > 0) {
        Object.assign(bcvRatesHistoryMap, page0Rates);
        lastBcvScrapeTimestamp = now;
        updated = true;
      }

      // 2. Si la página enlaza archivos .xls / .xlsx y aún no tenemos la fecha objetivo, procesarlos con `xlsx`
      if (!resolveBcvRateWithBusinessDayFallback(bcvRatesHistoryMap, targetIso, 5)) {
        const excelLinks = extractBcvExcelLinksFromHtml(page0Html);
        for (const xlsUrl of excelLinks.slice(0, 2)) {
          try {
            const xlsBuf = await fetchBcvBuffer(xlsUrl, 7000);
            const xlsRates = parseBcvExcelBuffer(new Uint8Array(xlsBuf));
            if (Object.keys(xlsRates).length > 0) {
              Object.assign(bcvRatesHistoryMap, xlsRates);
              updated = true;
            }
          } catch (_xlsErr) {}
        }
      }

      // 3. Si la fecha solicitada es anterior a la más antigua de la página 0, explorar páginas históricas (?page=1..5)
      const oldestPage0 = extractedDates[0];
      if (
        oldestPage0 &&
        targetIso < oldestPage0 &&
        !resolveBcvRateWithBusinessDayFallback(bcvRatesHistoryMap, targetIso, 5)
      ) {
        const diffDays = Math.max(
          1,
          Math.round(
            (new Date(`${oldestPage0}T12:00:00Z`).getTime() - new Date(`${targetIso}T12:00:00Z`).getTime()) / 86400000
          )
        );
        const startPage = Math.max(1, Math.floor(diffDays / 70));
        const pagesToTry = Array.from(new Set([startPage, startPage + 1, 1, 2])).slice(0, 3);

        for (const pageNum of pagesToTry) {
          try {
            const pagedBuf = await fetchBcvBuffer(`${BCV_INDICE_INVERSION_URL}?page=${pageNum}`, 6000);
            const pagedRates = parseBcvIndiceInversionHtml(pagedBuf.toString("utf-8"));
            if (Object.keys(pagedRates).length > 0) {
              Object.assign(bcvRatesHistoryMap, pagedRates);
              updated = true;
              if (resolveBcvRateWithBusinessDayFallback(bcvRatesHistoryMap, targetIso, 5)) {
                break;
              }
            }
          } catch (_pErr) {}
        }
      }

      // 4. Respaldo estadístico Excel oficial del BCV (/estadisticas/tipo-cambio-de-referencia-smc)
      if (!resolveBcvRateWithBusinessDayFallback(bcvRatesHistoryMap, targetIso, 5)) {
        try {
          const smcBuf = await fetchBcvBuffer(BCV_SMC_URL, 6000);
          const smcExcelLinks = extractBcvExcelLinksFromHtml(smcBuf.toString("utf-8"));
          if (smcExcelLinks.length > 0) {
            const firstXlsBuf = await fetchBcvBuffer(smcExcelLinks[0], 7000);
            const smcRates = parseBcvExcelBuffer(new Uint8Array(firstXlsBuf));
            if (Object.keys(smcRates).length > 0) {
              Object.assign(bcvRatesHistoryMap, smcRates);
              updated = true;
            }
          }
        } catch (_smcErr) {}
      }
    } catch (bcvErr: any) {
      console.warn("[BCV SCRAPER] Advertencia conectando con bcv.org.ve:", bcvErr?.message);
    }

    if (updated) {
      const latestDates = Object.keys(bcvRatesHistoryMap).sort();
      if (latestDates.length > 0) {
        cachedBcvRate = bcvRatesHistoryMap[latestDates[latestDates.length - 1]];
      }
      persistBcvRatesCache().catch(() => {});
    }
  };

  const handleBcvRateRequest = async (req: express.Request, res: express.Response) => {
    try {
      const rawDate = String(req.query.date || req.query.fecha || "").trim();
      const todayIso = new Date().toISOString().split("T")[0];
      const { iso: targetIso, display: targetDisplay } = normalizeBcvDateInput(rawDate || todayIso);

      // 1. Sincronizar desde https://www.bcv.org.ve/estadisticas/indice-de-inversion
      await syncBcvRatesForDate(targetIso);

      // 2. Resolver tasa exacta o último día hábil inmediato (hasta 5 días previos para sábados/domingos/feriados)
      const resolved = resolveBcvRateWithBusinessDayFallback(
        bcvRatesHistoryMap,
        targetIso,
        5,
        BCV_INDICE_INVERSION_URL
      );

      if (resolved) {
        return res.json({
          ...resolved,
          serieReciente: bcvRatesHistoryMap,
        });
      }

      // 3. Respaldo externo (rates.dolarvzla.com) con ventana de hasta 5 días hábiles previos
      const baseDate = new Date(`${targetIso}T12:00:00Z`);
      for (let offset = 0; offset <= 5; offset++) {
        const checkDate = new Date(baseDate.getTime() - offset * 86400000);
        const py = checkDate.getUTCFullYear();
        const pm = checkDate.getUTCMonth() + 1;
        const pd = checkDate.getUTCDate();
        const checkIso = `${py}-${String(pm).padStart(2, "0")}-${String(pd).padStart(2, "0")}`;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const extRes = await fetch(`https://rates.dolarvzla.com/bcv/${py}/${pm}/${pd}.json`, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (extRes.ok) {
            const extData = await extRes.json();
            const usdVal = parseNumeroBcv(extData?.usd);
            if (usdVal > 0) {
              bcvRatesHistoryMap[checkIso] = usdVal;
              persistBcvRatesCache().catch(() => {});
              return res.json({
                tasa: usdVal,
                fechaValor: checkIso,
                fechaValorDisplay: `${String(pd).padStart(2, "0")}/${String(pm).padStart(2, "0")}/${py}`,
                fechaSolicitada: targetIso,
                fechaSolicitadaDisplay: targetDisplay,
                esDiaHabilAnterior: offset > 0,
                fuente: "https://www.bcv.org.ve/estadisticas/indice-de-inversion",
                serieReciente: bcvRatesHistoryMap,
              });
            }
          }
        } catch (_extErr) {}
      }

      // 4. Solo si la fecha solicitada es HOY y BCV no respondió, permitir fallback a ve.dolarapi.com
      if (targetIso === todayIso) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const currRes = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (currRes.ok) {
            const data = await currRes.json();
            const prom = parseNumeroBcv(data?.promedio);
            if (prom > 0) {
              bcvRatesHistoryMap[todayIso] = prom;
              return res.json({
                tasa: prom,
                fechaValor: todayIso,
                fechaValorDisplay: targetDisplay,
                fechaSolicitada: targetIso,
                fechaSolicitadaDisplay: targetDisplay,
                esDiaHabilAnterior: false,
                fuente: "https://ve.dolarapi.com/v1/dolares/oficial",
                serieReciente: bcvRatesHistoryMap,
              });
            }
          }
        } catch (_e) {}
      }

      return res.status(503).json({
        error: `No se pudo conectar con BCV para el ${targetDisplay}`,
        fechaSolicitada: targetIso,
        fechaSolicitadaDisplay: targetDisplay,
      });
    } catch (err: any) {
      return res.status(503).json({
        error: err?.message || "No se pudo consultar la tasa del BCV",
      });
    }
  };

  app.get("/api/bcv-rate", handleBcvRateRequest);
  app.get("/api/tasa-bcv", handleBcvRateRequest);

  app.get("/api/sheets-structure", authenticateToken, requireAdmin, async (req: any, res: any) => {
    try {
      const googleToken = String(req.headers['x-google-access-token'] || '').trim();
      if (!googleToken) {
        return res.status(400).json({ error: "Header x-google-access-token requerido para inspección de Google Sheets API." });
      }
      const spreadsheetId = getGoogleSheetId();
      if (!spreadsheetId) {
        return res.status(400).json({ error: "GOOGLE_SHEET_ID no está configurado o es inválido." });
      }

      const metaUrl = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`);
      if (metaUrl.origin !== 'https://sheets.googleapis.com') {
        return res.status(403).json({ error: "URL fuera de allowlist de Google Sheets API." });
      }

      const metaRes = await fetch(metaUrl.toString(), {
        headers: {
          'Authorization': `Bearer ${googleToken}`
        }
      });

      if (!metaRes.ok) {
        return res.status(metaRes.status).json({ error: "Failed to fetch spreadsheet structure" });
      }

      const metaData = await metaRes.json();
      const sheets = Array.isArray(metaData?.sheets)
        ? metaData.sheets.map((s: any) => ({
            title: String(s?.properties?.title || ''),
            sheetId: s?.properties?.sheetId
          }))
        : [];

      const summary: Array<{ title: string; sheetId: any; previewRowsCount: number; headers: unknown[] }> = [];
      for (const sheet of sheets) {
        const rangeEncoded = encodeURIComponent(`'${sheet.title.replace(/'/g, "''")}'!A1:Z5`);
        const valuesUrl = new URL(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${rangeEncoded}`
        );
        const dataRes = await fetch(valuesUrl.toString(), {
          headers: { 'Authorization': `Bearer ${googleToken}` }
        });
        if (dataRes.ok) {
          const data = await dataRes.json();
          const vals = Array.isArray(data?.values) ? data.values : [];
          summary.push({
            title: sheet.title,
            sheetId: sheet.sheetId,
            previewRowsCount: vals.length,
            headers: Array.isArray(vals[0]) ? vals[0] : []
          });
        }
      }

      return res.json({ success: true, sheets: summary });
    } catch (err: any) {
      console.error("Structure lookup error:", err?.message || 'unknown');
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  let cachedVolumenParsed: any[] | null = null;
  let lastVolumenParsedTime = 0;
  let cachedActivacionParsed: any[] | null = null;
  let lastActivacionParsedTime = 0;
  let cachedMetasParsed: any[] | null = null;
  let lastMetasParsedTime = 0;
  const PARSED_DATA_TTL = DEFAULT_SERVER_CACHE_TTL_MS; // 55s (caché centralizada alineada al ciclo de 60s)

  app.get("/api/usuarios", (_req, res) => {
    return res.status(403).json({
      success: false,
      error: "Endpoint deshabilitado por política de seguridad: prohibida la exposición de credenciales."
    });
  });

  app.get("/api/client-lookup", authenticateToken, async (req: any, res: any) => {
    try {
      const codigo = req.query.codigo as string;
      if (!codigo) {
        return res.status(400).json({ error: "Missing 'codigo' parameter" });
      }

      const cleanCode = String(codigo).replace(/^[#\s]+/, '').trim();
      const codeNoZeros = cleanCode.replace(/^0+/, '');

      let clientFound: any = null;

      if (supabase) {
        try {
          const { data: supaRows } = await supabase
            .from('activacion_clientes')
            .select('*')
            .or(`cliente_codigo.eq.${cleanCode},cliente_codigo.eq.${codeNoZeros}`)
            .limit(1);
          if (supaRows && supaRows.length > 0) {
            clientFound = supaRows[0];
          }
        } catch (sErr: any) {
          console.warn("[SERVER] Error consultando Supabase en client-lookup:", sErr?.message);
        }
      }

      if (!clientFound && cachedActivacionParsed && cachedActivacionParsed.length > 0) {
        const match = cachedActivacionParsed.find(c => {
          const cId = String(c.id || c.cliente_codigo || '').replace(/^[#\s]+/, '').trim();
          const cNoZeros = cId.replace(/^0+/, '');
          return cId === cleanCode || (codeNoZeros && cNoZeros === codeNoZeros);
        });
        if (match) {
          clientFound = {
            cliente_nombre: match.cliente || match.cliente_nombre,
            vendedor_nombre: match.vendedorNombre || match.vendedorId,
            cliente_codigo: match.id || match.cliente_codigo
          };
        }
      }

      if (!clientFound) {
        let transientWb: any = null;
        try {
          const loaded = await loadWorkbookTransient(false);
          transientWb = loaded.workbook;
          const XLSX = await import('xlsx');
          const sheetName = transientWb.SheetNames.find((s: string) => /activacion|clientes/i.test(s));
          if (sheetName) {
            const sheet = transientWb.Sheets[sheetName];
            const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            for (let r = 1; r < rows.length; r++) {
              const row = rows[r];
              if (!row || !row[0]) continue;
              const cleanedRowCode = cleanClientCode(row[0]);
              const rCode = cleanedRowCode.rawClean;
              const rNoZeros = cleanedRowCode.canonical;
              if (rCode === cleanCode || (codeNoZeros && rNoZeros === codeNoZeros)) {
                clientFound = {
                  cliente_nombre: String(row[1] || '').trim(),
                  vendedor_nombre: String(row[2] || '').trim(),
                  cliente_codigo: rCode
                };
                break;
              }
            }
          }
        } catch (wbErr: any) {
          console.warn("[SERVER] Fallback workbook client lookup error:", wbErr?.message);
        } finally {
          transientWb = null;
        }
      }

      if (!clientFound) {
        return res.status(404).json({ error: "Cliente no encontrado" });
      }

      const data = clientFound;

      let vendedorNombre = data.vendedor_nombre;
      let vendedorEmail = '';
      if (vendedorNombre && /johnatan|soto|mikelangelo/i.test(vendedorNombre)) {
        vendedorNombre = 'Mikelangelo Diaz';
        vendedorEmail = 'Mikelangelodiaz@gmail.com';
      }
      return res.json({ 
        nombre: data.cliente_nombre || data.razon_social || '', 
        vendedor: vendedorNombre, 
        vendedorEmail: vendedorEmail, 
        direccion: data.direccion || '', 
        ruc: data.cliente_codigo || data.codigo || ''
      });

    } catch (err: any) {
      console.error("Client lookup error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==============================================================
  // MAESTRA ACTIVA (clientes / vendedores / supervisores) - solo ADMIN
  //   POST /api/maestra/preview : parsea el CSV y calcula el diff contra la BD SIN escribir
  //   POST /api/maestra/sync    : re-parsea en el servidor (nunca confía en el cliente) y sincroniza
  //   GET  /api/maestra/estado  : última carga registrada
  // ==============================================================
  let maestraSyncEnCurso = false;

  function leerCsvMaestraDeBody(body: any): { bytes: Buffer; archivoNombre: string; sha256: string } {
    const b64 = String(body?.csvBase64 || '').replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
    if (!b64) throw new MaestraParseError('Falta el archivo CSV (csvBase64).');
    const bytes = Buffer.from(b64, 'base64');
    if (bytes.length === 0) throw new MaestraParseError('El archivo CSV está vacío.');
    if (bytes.length > 20 * 1024 * 1024) throw new MaestraParseError('El archivo CSV supera el máximo de 20 MB.');
    return {
      bytes,
      archivoNombre: String(body?.archivo || 'maestra.csv').slice(0, 200),
      sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    };
  }

  function responderErrorMaestra(res: any, err: any, contexto: string) {
    if (err instanceof MaestraParseError) {
      return res.status(400).json({ success: false, code: 'CSV_INVALIDO', error: err.message });
    }
    if (err instanceof MaestraEsquemaError) {
      return res.status(412).json({ success: false, code: 'ESQUEMA_FALTANTE', error: err.message });
    }
    if (err instanceof MaestraBajasMasivasError) {
      return res.status(409).json({
        success: false,
        code: 'BAJAS_MASIVAS',
        error: err.message,
        bajas: err.bajas,
        activos: err.activos
      });
    }
    console.error(`[MAESTRA] Error en ${contexto}:`, err?.message || err);
    return res.status(500).json({ success: false, code: 'ERROR_INTERNO', error: err?.message || `Error en ${contexto}` });
  }

  app.post(
    "/api/maestra/preview",
    authenticateToken,
    requireAdmin,
    rateLimiter(60_000, 20, 'maestra-preview'),
    async (req: any, res: any) => {
      try {
        const { bytes, archivoNombre, sha256 } = leerCsvMaestraDeBody(req.body);
        const parsed = parseMaestraBytes(new Uint8Array(bytes));

        const conteoPorVendedor = new Map<number, number>();
        parsed.clientes.forEach(c => conteoPorVendedor.set(c.idVendedor, (conteoPorVendedor.get(c.idVendedor) || 0) + 1));

        let db: any = null;
        if (supabase) {
          const { aBajaIds, ...resto } = await calcularPreviewDb(crearMaestraRepoSupabase(supabase), parsed, { archivoSha256: sha256 });
          db = { ...resto, aBajaMuestra: aBajaIds.slice(0, 25) };
        }

        res.json({
          success: true,
          archivo: { nombre: archivoNombre, sha256, bytes: bytes.length },
          reporte: parsed.reporte,
          supervisores: parsed.supervisores,
          vendedores: parsed.vendedores.map(v => ({ ...v, clientes: conteoPorVendedor.get(v.idVendedor) || 0 })),
          db
        });
      } catch (err: any) {
        responderErrorMaestra(res, err, 'preview');
      }
    }
  );

  app.post(
    "/api/maestra/sync",
    authenticateToken,
    requireAdmin,
    rateLimiter(60_000, 6, 'maestra-sync'),
    async (req: any, res: any) => {
      if (maestraSyncEnCurso) {
        return res.status(409).json({ success: false, code: 'SYNC_EN_CURSO', error: 'Ya hay una sincronización de la maestra en curso.' });
      }
      maestraSyncEnCurso = true;
      try {
        if (!supabase) {
          return res.status(503).json({ success: false, code: 'SIN_BASE_DE_DATOS', error: 'Supabase no está configurado en el servidor.' });
        }
        const { bytes, archivoNombre, sha256 } = leerCsvMaestraDeBody(req.body);
        const parsed = parseMaestraBytes(new Uint8Array(bytes));

        const resultado = await sincronizarMaestra(crearMaestraRepoSupabase(supabase), parsed, {
          periodo: metasPeriodoActual(),
          archivoNombre,
          archivoSha256: sha256,
          creadoPor: String(req.user?.username || req.user?.nombre || 'ADMIN'),
          forzarBajas: req.body?.forzarBajas === true
        });

        // Invalidar cachés en memoria para que el Dashboard recalcule la cartera con la maestra nueva
        cachedVolumenParsed = null;
        cachedActivacionParsed = null;
        cachedMetasParsed = null;
        lastVolumenParsedTime = 0;
        lastActivacionParsedTime = 0;
        lastMetasParsedTime = 0;

        console.log(
          `[MAESTRA] Carga ${resultado.cargaId} (${resultado.estado}): ${resultado.clientes.enArchivo} clientes | nuevos ${resultado.clientes.nuevos} | actualizados ${resultado.clientes.actualizados} | reactivados ${resultado.clientes.reactivados} | dados de baja ${resultado.clientes.desactivados} | vendedores ${resultado.vendedores.enArchivo} | activos en BD ${resultado.verificacion.activosEnBd}`
        );
        res.json({ success: true, resultado, reporte: parsed.reporte });
      } catch (err: any) {
        responderErrorMaestra(res, err, 'sync');
      } finally {
        maestraSyncEnCurso = false;
      }
    }
  );

  app.get("/api/maestra/estado", authenticateToken, requireAdmin, async (_req: any, res: any) => {
    try {
      if (!supabase) return res.json({ success: true, esquemaDisponible: false, ultimaCarga: null });
      const { data, error } = await supabase
        .from('maestra_cargas')
        .select('id,periodo,archivo_nombre,estado,creado_por,creado_en,finalizado_en')
        .order('creado_en', { ascending: false })
        .limit(1);
      if (error) {
        const faltaEsquema = /does not exist|schema cache|Could not find the table/i.test(error.message || '') || error.code === '42P01' || error.code === 'PGRST205';
        if (faltaEsquema) return res.json({ success: true, esquemaDisponible: false, ultimaCarga: null });
        throw error;
      }
      res.json({ success: true, esquemaDisponible: true, ultimaCarga: data && data[0] ? data[0] : null });
    } catch (err: any) {
      responderErrorMaestra(res, err, 'estado');
    }
  });

  // Columnas nuevas de activacion_clientes (scripts/sql/03_rubros_noviembre_2026.sql). Si la BD aún no las tiene
  // se omiten de los upserts para no romper la sincronización existente.
  const COLUMNAS_ACTIVACION_NUEVAS = [
    'cajas_leche_vencampo', 'cajas_mortadela_asturias', 'cajas_salpicao',
    'has_leche_vencampo', 'has_mortadela_asturias', 'has_salpicao'
  ];
  const NUEVOS_RUBROS_CODES = ['LECHE_VENCAMPO', 'MORTADELA_ASTURIAS', 'SALPICAO'];
  let activacionColsNuevasCache: { ok: boolean; at: number } | null = null;
  async function activacionTieneColumnasNuevas(): Promise<boolean> {
    if (!supabase) return false;
    if (activacionColsNuevasCache && Date.now() - activacionColsNuevasCache.at < 60_000) return activacionColsNuevasCache.ok;
    const { error } = await supabase.from('activacion_clientes').select(COLUMNAS_ACTIVACION_NUEVAS.join(',')).limit(1);
    activacionColsNuevasCache = { ok: !error, at: Date.now() };
    if (error) console.warn('[RUBROS] activacion_clientes aún no tiene las columnas de los rubros nuevos; ejecuta scripts/sql/03_rubros_noviembre_2026.sql');
    return !error;
  }
  const sinColumnasNuevas = (row: any) => {
    const copia = { ...row };
    for (const k of COLUMNAS_ACTIVACION_NUEVAS) delete copia[k];
    return copia;
  };

  // Ventas netas del mes en curso por cliente/artículo: permite separar por cliente 'Mortadela Asturias' vs 'Salpicao'
  // (la hoja 'Enteros Ligeros' los trae combinados).
  async function cargarVentasMesActual(): Promise<Array<{ id_cliente: string; id_articulo: string; articulo: string; cajas: number }>> {
    if (!supabase) return [];
    try {
      const hoy = new Date();
      const rows = await histFetchAll((a, b) =>
        supabase!.from('ventas_historial')
          .select('id_cliente,id_articulo,articulo,cajas')
          .eq('ano', hoy.getFullYear()).eq('mes', hoy.getMonth() + 1)
          .order('id_cliente').order('id_articulo').range(a, b)
      );
      return rows.map((r: any) => ({ id_cliente: String(r.id_cliente || ''), id_articulo: String(r.id_articulo || ''), articulo: String(r.articulo || ''), cajas: Number(r.cajas) || 0 }));
    } catch {
      return [];
    }
  }

  // ============================================================================
  // DETECCIÓN EXACTA DE CAMBIOS NUMÉRICOS POR VENDEDOR (SHA-256) + SSE + WEBHOOK
  // ============================================================================
  const sellerNumericTracker = new SellerNumericSyncTracker();
  const sseSubscribers = new Map<string, Set<express.Response>>();
  const sseHeartbeats = new Set<ReturnType<typeof setInterval>>();
  const WEBHOOK_DEBOUNCE_MS = 2000;
  const SSE_HEARTBEAT_INTERVAL_MS = 25_000;
  let webhookDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let webhookPendingFollowUp = false;

  const verifySyncSecretConstantTime = (candidate: string, expected: string): boolean => {
    if (!candidate || !expected) return false;
    const hashA = crypto.createHash('sha256').update(candidate, 'utf8').digest();
    const hashB = crypto.createHash('sha256').update(expected, 'utf8').digest();
    return crypto.timingSafeEqual(hashA, hashB);
  };

  const resolveAuthorizedSellerStreamKey = (user: any, rawRequestedSellerId: string): string | null => {
    if (!user) return null;
    const supProfile = getSupervisorProfile(user.username);
    const effectiveRole = supProfile ? 'SUPERVISOR' : String(user.role || '').toUpperCase();

    let decodedRaw = String(rawRequestedSellerId || '').trim();
    try {
      decodedRaw = decodeURIComponent(decodedRaw).trim();
    } catch {
      // mantener valor original si ya viene decodificado
    }
    if (!decodedRaw) return null;

    const upperRaw = decodedRaw.toUpperCase();
    const isSupPrefixed = upperRaw.startsWith('SUPERVISOR:');
    const normalizedReq = isSupPrefixed
      ? `SUPERVISOR:${normalizeSellerKey(decodedRaw.replace(/^SUPERVISOR:/i, ''))}`
      : upperRaw === 'ADMIN'
        ? 'ADMIN'
        : normalizeSellerKey(decodedRaw);

    if (effectiveRole === 'ADMIN') {
      return normalizedReq || 'ADMIN';
    }

    if (effectiveRole === 'SUPERVISOR' && supProfile) {
      const supCanonicalKey = `SUPERVISOR:${normalizeSellerKey(supProfile.canonicalUsername)}`;
      const supPlainKey = normalizeSellerKey(supProfile.canonicalUsername);
      if (normalizedReq === supCanonicalKey || normalizedReq === supPlainKey) {
        return supCanonicalKey;
      }
      const allowedAliases = new Set<string>(
        [
          ...supProfile.supervisedVendors,
          ...getSupervisedAliases(user.username)
        ]
          .map((v) => normalizeSellerKey(v))
          .filter(Boolean)
      );
      const consolidatedReq = consolidateSellerToMasterKey(decodedRaw);
      if (allowedAliases.has(normalizedReq) || allowedAliases.has(consolidatedReq)) {
        return normalizedReq;
      }
      return null;
    }

    // Rol VENDEDOR: aislamiento estricto por identidad autenticada (cero lectura cruzada)
    const userOwnKeys = new Set<string>();
    const ownUserNorm = normalizeSellerKey(user.username);
    const ownVendorIdNorm = normalizeSellerKey(user.vendorId);
    const ownMasterKey = consolidateSellerToMasterKey(user.username || user.vendorId);
    if (ownUserNorm) userOwnKeys.add(ownUserNorm);
    if (ownVendorIdNorm) userOwnKeys.add(ownVendorIdNorm);
    if (ownMasterKey) userOwnKeys.add(ownMasterKey);

    const prof = getVendorProfile(user.username) || getVendorProfile(user.vendorId);
    if (prof) {
      userOwnKeys.add(normalizeSellerKey(prof.canonicalUsername));
      for (const route of prof.routes) {
        userOwnKeys.add(normalizeSellerKey(route.id));
        for (const alias of route.aliases) {
          userOwnKeys.add(normalizeSellerKey(alias));
        }
      }
    }

    const reqConsolidated = consolidateSellerToMasterKey(decodedRaw);
    if (userOwnKeys.has(normalizedReq) || (reqConsolidated && userOwnKeys.has(reqConsolidated))) {
      // Resolver a la llave exacta que el tracker conoce (o llave maestra del vendedor)
      const directStatus = sellerNumericTracker.getSellerStatus(normalizedReq);
      if (directStatus.version > 0) return directStatus.sellerId;
      return ownMasterKey || normalizedReq;
    }

    return null;
  };

  const emitSseEventToSeller = (
    sellerKey: string,
    eventName: 'datos_actualizados' | 'baseline',
    payload: SellerNumericChangeEvent
  ) => {
    const subscribers = sseSubscribers.get(sellerKey);
    if (!subscribers || subscribers.size === 0) return;
    const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of Array.from(subscribers)) {
      if (res.writableEnded || res.destroyed) {
        subscribers.delete(res);
        continue;
      }
      try {
        res.write(frame);
      } catch {
        subscribers.delete(res);
      }
    }
    if (subscribers.size === 0) {
      sseSubscribers.delete(sellerKey);
    }
  };

  const applySellerNumericDiffAndBroadcast = (parsed: ReturnType<typeof parseWorkbookFull>) => {
    const { initialized, changed } = sellerNumericTracker.applyParsedWorkbookDetailed({
      metasApiRows: parsed.metasApiRows,
      volumenApiRows: parsed.volumenApiRows,
      activacionApiRows: parsed.activacionApiRows,
      usuariosRows: parsed.usuariosRows.map((u) => ({
        usuario: u.usuario,
        rol: u.rol,
        vendorId: u.vendorId
      }))
    });

    // Notificar silenciosamente línea base versión 1 solo a clientes ya conectados durante cold boot (sin toast)
    for (const initEvt of initialized) {
      emitSseEventToSeller(initEvt.sellerId, 'baseline', initEvt);
    }

    // Emitir `datos_actualizados` EXCLUSIVAMENTE a los vendedores cuyo hash numérico SHA-256 cambió
    for (const changeEvt of changed) {
      emitSseEventToSeller(changeEvt.sellerId, 'datos_actualizados', changeEvt);
    }

    if (changed.length > 0) {
      console.log(`[SYNC SSE] Cambio numérico real detectado en ${changed.length} perfil(es) de vendedor/vista.`);
    }
    return changed;
  };

  async function syncWorkbookToSupabase(workbook: any) {
    const XLSX = await import('xlsx');
    const periodo = metasPeriodoActual();

    // 1. Cargar Cartera Maestra desde Supabase (deduplicando códigos repetidos si los hubiera) con fallback a semilla local
    let masterClients: MasterClientSeed[] = [];
    let hadDbClients = false;

    if (supabase) {
      try {
        const allClients: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from('activacion_clientes')
            .select('*')
            .order('id')
            .range(from, from + 999);
          if (error || !data || data.length === 0) break;
          allClients.push(...data);
          if (data.length < 1000) break;
          from += 1000;
        }

        if (allClients.length > 0) {
          hadDbClients = true;
          const seenComposite = new Map<string, any>();
          for (const c of allClients) {
            const rawVid = String(c.vendedor_id || '').trim();
            if (
              rawVid.toUpperCase().startsWith('INACTIVO_MAESTRA::') ||
              String(c.status || '').toUpperCase() === 'BAJA_MAESTRA' ||
              c.activo === false
            ) {
              continue;
            }
            const rawCod = String(c.cliente_codigo || '').trim();
            const cleanCod = rawCod.replace(/#\d+$/, '').trim();
            if (!cleanCod) continue;
            const vNorm = normalizeVendorName(c.vendedor_nombre || c.vendedor_id);
            const compKey = `${vNorm}::${cleanCod}`;
            if (!seenComposite.has(compKey)) {
              seenComposite.set(compKey, c);
            } else {
              const prev = seenComposite.get(compKey);
              prev.has_aceite = Boolean(prev.has_aceite || c.has_aceite);
              prev.has_azucar = Boolean(prev.has_azucar || c.has_azucar);
              prev.has_pollo = Boolean(prev.has_pollo || c.has_pollo);
              prev.has_estandar_asturias = Boolean(prev.has_estandar_asturias || c.has_estandar_asturias);
              prev.has_mortadela_salpicao = Boolean(prev.has_mortadela_salpicao || c.has_mortadela_salpicao);
            }
          }

          masterClients = Array.from(seenComposite.values()).map((c: any) => ({
            id: c.id,
            cliente_codigo: String(c.cliente_codigo || '').trim(),
            cliente_nombre: String(c.cliente_nombre || '').trim(),
            vendedor_id: String(c.vendedor_id || c.vendedor_nombre || '').replace(/\s+/g, ' ').trim(),
            vendedor_nombre: String(c.vendedor_nombre || c.vendedor_id || '').replace(/\s+/g, ' ').trim(),
            has_aceite: Boolean(c.has_aceite),
            has_azucar: Boolean(c.has_azucar),
            has_pollo: Boolean(c.has_pollo),
            has_estandar_asturias: Boolean(c.has_estandar_asturias),
            has_mortadela_salpicao: Boolean(c.has_mortadela_salpicao)
          }));
        }
      } catch (dbReadErr: any) {
        console.warn("[SERVER] Advertencia leyendo cartera maestra desde Supabase:", dbReadErr?.message);
      }
    }

    if (masterClients.length === 0) {
      masterClients = loadLocalMasterClientSeed();
    }

    // Fuente preferente: Maestra Activa (tablas maestra_*, cargadas desde "Actualizar Maestra").
    // Si aún no existen o están vacías, se mantiene la fuente anterior sin cambios.
    if (supabase) {
      const idActivacionPorCodigo = new Map<string, number>();
      for (const mc of masterClients) {
        if (mc.id !== undefined) idActivacionPorCodigo.set(String(mc.cliente_codigo).trim(), mc.id);
      }
      const carteraMaestra = await leerCarteraActivaMaestra(supabase, idActivacionPorCodigo);
      if (carteraMaestra.length > 0) {
        masterClients = carteraMaestra;
      }
    }

    // 2. Parsear y normalizar las 10 pestañas del Google Sheet bajo el Contrato Espejo (sin mezclar ventas_historial)
    const parsed = parseWorkbookFull(XLSX, workbook, {
      periodo,
      masterClients
    });

    // 3. Actualizar cachés en memoria de inmediato para respuesta instantánea y consistente
    cachedVolumenParsed = parsed.volumenApiRows;
    lastVolumenParsedTime = Date.now();
    cachedActivacionParsed = parsed.activacionApiRows;
    lastActivacionParsedTime = Date.now();
    cachedMetasParsed = parsed.metasApiRows;
    lastMetasParsedTime = Date.now();
    lastSheetMetrics = parsed.metrics;
    lastSheetWarnings = parsed.warnings;
    lastSheetAuditLogs = parsed.auditLogs;
    lastSheetDataQuality = parsed.dataQuality || null;
    lastLiveProductMaps = parsed.productMaps;

    // 3b. Evaluar hashes SHA-256 numéricos por vendedor y notificar en tiempo real (SSE) solo cambios reales
    applySellerNumericDiffAndBroadcast(parsed);

    if (parsed.warnings.length > 0) {
      console.warn(
        `[SHEET QA] ${parsed.warnings.length} advertencia(s) y ${parsed.auditLogs.length} evento(s) de auditoría registrados sin cortar carga.`
      );
    }

    // 4. Sincronizar hacia Supabase usando la RPC atómica sync_monthly_sales_snapshot (con fallback seguro acotado al periodo)
    if (supabase) {
      const allActivacionRows = [...parsed.activacionSupabaseUpserts, ...(hadDbClients ? parsed.newSheetClientsForSupabase : parsed.newSheetClientsForSupabase)];
      let rpcSucceeded = false;

      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('sync_monthly_sales_snapshot', {
          p_periodo_mes: periodo,
          p_sheet_sha256: lastWorkbookSha256 || '',
          p_triggered_by: 'backend_sync',
          p_metas: parsed.metasSupabaseRows,
          p_volumen: parsed.volumenSupabaseRows,
          p_activacion: allActivacionRows,
          p_degustaciones: parsed.degustacionesRows.map((d) => ({
            id: d.id,
            cliente_codigo: d.clienteCodigo,
            cliente_nombre: d.clienteNombre,
            vendedor_nombre: d.vendedorNombre,
            vendedor_id: d.vendedorId,
            vendedor_key: d.vendedorKey,
            ruta: d.ruta,
            fecha: d.fecha,
            turno: d.turno,
            hora: d.hora,
            productos: d.productos,
            kilos_estimados: d.kilosEstimados,
            personas_estimadas: d.personasEstimadas,
            requiere_promotora: d.requierePromotora,
            promotora_asignada: d.promotoraAsignada,
            material_pop: d.materialPop,
            contacto_punto: d.contactoPunto,
            telefono_contacto: d.telefonoContacto,
            observaciones: '',
            estado: d.estado,
            notas_trade_marketing: d.notasTradeMarketing
          })),
          p_audit_logs: parsed.auditLogs,
          p_metrics: parsed.metrics,
          p_allow_empty: false
        });

        if (!rpcErr && rpcData) {
          rpcSucceeded = true;
        } else if (rpcErr) {
          console.warn('[SYNC RPC] sync_monthly_sales_snapshot no disponible aún (ejecuta scripts/sql/04_contrato_espejo_sync.sql):', rpcErr.message);
        }
      } catch (rpcEx: any) {
        console.warn('[SYNC RPC] Excepción invocando sync_monthly_sales_snapshot:', rpcEx?.message);
      }

      // Fallback acotado estrictamente a `periodo` si la migración 04 aún no fue corrida en Supabase
      if (!rpcSucceeded) {
        try {
          if (parsed.volumenSupabaseRows.length > 0) {
            const legacyVol = parsed.volumenSupabaseRows.map((r) => ({
              periodo: r.periodo,
              sku: r.sku,
              articulo: r.articulo,
              categoria: r.categoria,
              vendedor_id: r.vendedor_id,
              vendedor_nombre: r.vendedor_nombre,
              meta_kg: r.meta_kg,
              ejecutado_kg: r.venta_neta_kg,
              zona: r.zona
            }));
            await supabase.from('ventas_volumen').delete().eq('periodo', periodo);
            for (let i = 0; i < legacyVol.length; i += 200) {
              await supabase.from('ventas_volumen').insert(legacyVol.slice(i, i + 200));
            }
          }
        } catch (vErr: any) {
          console.warn('[SERVER] Error fallback ventas_volumen:', vErr?.message);
        }

        try {
          const colsNuevasOk = await activacionTieneColumnasNuevas();
          const stripExtra = (row: any) => {
            const base = colsNuevasOk ? { ...row } : sinColumnasNuevas(row);
            delete base.vendedor_key;
            delete base.cliente_codigo_canonico;
            return base;
          };
          if (parsed.activacionSupabaseUpserts.length > 0) {
            for (let i = 0; i < parsed.activacionSupabaseUpserts.length; i += 200) {
              const batch = parsed.activacionSupabaseUpserts.slice(i, i + 200).map(stripExtra);
              await supabase.from('activacion_clientes').upsert(batch, { onConflict: 'id' });
            }
          }
          if (hadDbClients && parsed.newSheetClientsForSupabase.length > 0) {
            for (let i = 0; i < parsed.newSheetClientsForSupabase.length; i += 200) {
              const batch = parsed.newSheetClientsForSupabase.slice(i, i + 200).map(stripExtra);
              await supabase.from('activacion_clientes').insert(batch);
            }
          }
        } catch (cErr: any) {
          console.warn('[SERVER] Error fallback activacion_clientes:', cErr?.message);
        }

        try {
          if (parsed.metasSupabaseRows.length > 0) {
            const legacyMetas = parsed.metasSupabaseRows.map((m) => ({
              periodo: m.periodo,
              vendedor_id: m.vendedor_id,
              categoria: m.categoria,
              meta: m.meta,
              activados: m.activados
            }));
            await supabase.from('metas_activacion').delete().eq('periodo', periodo);
            for (let i = 0; i < legacyMetas.length; i += 200) {
              await supabase.from('metas_activacion').insert(legacyMetas.slice(i, i + 200));
            }
          }
        } catch (mErr: any) {
          console.warn('[SERVER] Error fallback metas_activacion:', mErr?.message);
        }
      }

      // 4d. Sincronizar Usuarios con bcrypt(12) en background sin exponer jamás contraseñas en texto plano
      if (parsed.usuariosRows.length > 0) {
        buildHashedUsersForSupabase(parsed.usuariosRows, SUPERVISOR_SUMMARY_COLUMNS)
          .then(async (hashedUsers) => {
            if (!supabase || hashedUsers.length === 0) return;
            const upserts = hashedUsers.map((u) => ({
              username: u.username,
              password_hash: u.password_hash,
              role: u.role === 'SUPERVISOR' ? 'VENDEDOR' : u.role,
              vendor_id: u.vendor_id,
              nombre_completo: u.nombre_completo,
              activo: true,
              updated_at: new Date().toISOString()
            }));
            await supabase.from('usuarios').upsert(upserts, { onConflict: 'username' });
          })
          .catch(() => {});
      }
    }

    if (lastWorkbookSha256) {
      lastSyncedSha256ByPeriod.set(periodo, lastWorkbookSha256);
    }

    return {
      status: 'OK' as const,
      countVolumen: parsed.volumenApiRows.length,
      countActivacion: parsed.activacionApiRows.length,
      countMetas: parsed.metasApiRows.length,
      countDegustaciones: parsed.degustacionesRows.length,
      warningsCount: parsed.warnings.length,
      auditLogsCount: parsed.auditLogs.length,
      metrics: parsed.metrics
    };
  }

  interface SyncPayloadSummary {
    countVolumen: number;
    countActivacion: number;
    countMetas: number;
    countDegustaciones: number;
    warningsCount: number;
    auditLogsCount: number;
    metrics: Record<string, SheetTabMetrics>;
  }

  const sheetsScheduler = new SheetsSyncScheduler<SyncPayloadSummary>({
    syncIntervalMs: SHEETS_AUTO_SYNC_INTERVAL_MS,
    cacheTtlMs: DEFAULT_SERVER_CACHE_TTL_MS,
    manualCooldownMs: DEFAULT_MANUAL_COOLDOWN_MS,
    maxRetries: 3,
    baseBackoffMs: 500,
    maxBackoffMs: 2_000,
    isValidPayload: (p) =>
      Boolean(p && (p.countVolumen > 0 || p.countActivacion > 0 || p.countMetas > 0)),
    syncFn: async ({ forceRebuild }) => {
      const hasExistingLiveCache = Boolean(
        cachedVolumenParsed?.length && cachedActivacionParsed?.length && cachedMetasParsed?.length
      );
      let loaded: { workbook: any; sha256: string; source: 'live_google_sheet' | 'local_backup' } | null =
        await loadWorkbookTransient(true, {
          strictLive: hasExistingLiveCache,
          hasLiveSnapshot: hasExistingLiveCache
        });
      try {
        const periodo = metasPeriodoActual();
        const prevHash = lastSyncedSha256ByPeriod.get(periodo);
        if (
          !forceRebuild &&
          prevHash &&
          loaded.sha256 &&
          prevHash === loaded.sha256 &&
          cachedVolumenParsed &&
          cachedActivacionParsed &&
          cachedMetasParsed &&
          sellerNumericTracker.getStateSize() > 0
        ) {
          lastVolumenParsedTime = Date.now();
          lastActivacionParsedTime = Date.now();
          lastMetasParsedTime = Date.now();
          return {
            unchanged: true,
            syncedAt: lastSuccessfulSheetSyncAt || new Date().toISOString(),
            payload: {
              countVolumen: cachedVolumenParsed.length,
              countActivacion: cachedActivacionParsed.length,
              countMetas: cachedMetasParsed.length,
              countDegustaciones: 0,
              warningsCount: lastSheetWarnings.length,
              auditLogsCount: lastSheetAuditLogs.length,
              metrics: lastSheetMetrics
            }
          };
        }
        const res = await syncWorkbookToSupabase(loaded.workbook);
        return {
          unchanged: false,
          syncedAt: lastSuccessfulSheetSyncAt || new Date().toISOString(),
          payload: {
            countVolumen: res.countVolumen,
            countActivacion: res.countActivacion,
            countMetas: res.countMetas,
            countDegustaciones: res.countDegustaciones ?? 0,
            warningsCount: res.warningsCount,
            auditLogsCount: res.auditLogsCount ?? lastSheetAuditLogs.length,
            metrics: res.metrics
          }
        };
      } finally {
        // Liberar inmediatamente la referencia del libro XLSX crudo para GC en Render
        if (loaded) loaded.workbook = null;
        loaded = null;
      }
    }
  });

  getLiveSchedulerMeta = () => {
    const st = sheetsScheduler.getStatus();
    return {
      degraded: st.degraded,
      cooldownRemainingSeconds: st.cooldownRemainingSeconds,
      lastUpdated: st.lastUpdated,
      lastUpdatedCaracas: st.lastUpdatedCaracas
    };
  };

  getHealthSyncSummary = () => {
    const st = sheetsScheduler.getStatus();
    return {
      lastSyncAt: st.lastUpdated || lastSuccessfulSheetSyncAt || null,
      lastSyncCaracas: st.lastUpdatedCaracas || formatCaracasTimestamp(lastSuccessfulSheetSyncAt),
      isSyncing: st.isSyncing,
      degraded: st.degraded,
      trackedSellers: sellerNumericTracker.getStateSize()
    };
  };

  async function runCoalescedSheetsSync(
    forceRebuild = false,
    _triggeredBy = 'system',
    source: SyncTriggerSource = 'manual'
  ) {
    const outcome = await sheetsScheduler.triggerSync({ source, forceRebuild });
    lastSheetDegraded = outcome.degraded;
    lastSheetCooldownRemaining = outcome.cooldownRemainingSeconds;
    if (outcome.lastUpdated) {
      lastSuccessfulSheetSyncAt = outcome.lastUpdated;
    }
    const payload = outcome.payload || {
      countVolumen: cachedVolumenParsed?.length || 0,
      countActivacion: cachedActivacionParsed?.length || 0,
      countMetas: cachedMetasParsed?.length || 0,
      countDegustaciones: 0,
      warningsCount: lastSheetWarnings.length,
      auditLogsCount: lastSheetAuditLogs.length,
      metrics: lastSheetMetrics
    };
    return {
      status: outcome.status,
      degraded: outcome.degraded,
      cooldownRemainingSeconds: outcome.cooldownRemainingSeconds,
      lastUpdated: outcome.lastUpdated,
      lastUpdatedCaracas: outcome.lastUpdatedCaracas,
      ...payload
    };
  }

  // ENDPOINT DE SINCRONIZACIÓN BAJO DEMANDA PROTEGIDO (Exclusivo para ADMIN y SUPERVISOR)
  // Rate limiting por IP + Usuario y Cooldown mínimo en servidor de 15s contra Quota Exhaustion
  app.post(
    "/api/sync/sheets",
    authenticateToken,
    requireSupervisorOrAdmin,
    rateLimiter(60_000, 4, 'manual-sheets-sync'),
    async (req: any, res: any) => {
      try {
        const forceRebuild = req.body?.forceRebuild === true;
        console.log(`[SERVER] Sincronización manual solicitada por ${req.user?.username || 'supervisor/admin'} (forceRebuild=${forceRebuild})...`);
        const result = await runCoalescedSheetsSync(forceRebuild, String(req.user?.username || 'ADMIN'), 'manual');
        setNoCacheSyncHeaders(res, undefined, {
          degraded: result.degraded,
          cooldownRemainingSeconds: result.cooldownRemainingSeconds
        });

        const messageByStatus: Record<string, string> = {
          SKIPPED_UNCHANGED: 'El libro de Google Sheets no presenta cambios (SHA-256 idéntico); cero escrituras redundantes.',
          COOLDOWN_CACHED: `Última sincronización reciente. Usando caché vigente (próxima consulta directa habilitada en ${result.cooldownRemainingSeconds}s).`,
          DEGRADED_FALLBACK: 'Google Sheets no respondió temporalmente. Se conserva el último estado válido en caché.',
          OK: 'Sincronización con Google Sheets y Supabase completada con éxito'
        };

        res.json({
          success: true,
          status: result.status,
          degraded: result.degraded,
          cooldownRemainingSeconds: result.cooldownRemainingSeconds,
          message: messageByStatus[result.status] || messageByStatus.OK,
          source: lastSheetSource,
          periodo: metasPeriodoActual(),
          countVolumen: result.countVolumen,
          countActivacion: result.countActivacion,
          countMetas: result.countMetas,
          countDegustaciones: result.countDegustaciones ?? 0,
          warningsCount: result.warningsCount,
          auditLogsCount: result.auditLogsCount ?? lastSheetAuditLogs.length,
          timestamp: result.lastUpdated || lastSuccessfulSheetSyncAt || new Date().toISOString(),
          timestampCaracas: result.lastUpdatedCaracas || formatCaracasTimestamp(lastSuccessfulSheetSyncAt || new Date())
        });
      } catch (err: any) {
        console.error("[SERVER] Error en /api/sync/sheets:", err?.message || 'sync_error');
        res.status(500).json({
          success: false,
          error: "Error temporal al sincronizar con Google Sheets. Se conserva la última instantánea válida."
        });
      }
    }
  );

  // ENDPOINT DE ESTADO Y AUDITORÍA CUANTITATIVA DE SINCRONIZACIÓN (Sin exponer GOOGLE_SHEET_ID ni trazas internas)
  app.get("/api/sync/status", authenticateToken, (req: any, res: any) => {
    const sched = sheetsScheduler.getStatus();
    setNoCacheSyncHeaders(res, undefined, {
      degraded: sched.degraded,
      cooldownRemainingSeconds: sched.cooldownRemainingSeconds
    });
    const isPrivileged = req.user?.role === 'ADMIN' || Boolean(getSupervisorProfile(req.user?.username));
    const effectiveUpdated = sched.lastUpdated || lastSuccessfulSheetSyncAt || null;
    res.json({
      success: true,
      periodo: metasPeriodoActual(),
      isSyncing: sched.isSyncing,
      degraded: sched.degraded,
      lastSyncAt: effectiveUpdated,
      lastUpdated: effectiveUpdated,
      lastUpdatedCaracas: sched.lastUpdatedCaracas || formatCaracasTimestamp(effectiveUpdated),
      source: lastSheetSource,
      syncIntervalSeconds: Math.round(sched.syncIntervalMs / 1000),
      cacheTtlSeconds: Math.round(sched.cacheTtlMs / 1000),
      cooldownSeconds: Math.round(sched.manualCooldownMs / 1000),
      cooldownRemainingSeconds: sched.cooldownRemainingSeconds,
      consecutiveFailures: sched.consecutiveFailures,
      metrics: lastSheetMetrics,
      dataQuality: lastSheetDataQuality,
      warningsCount: lastSheetWarnings.length,
      auditLogsCount: lastSheetAuditLogs.length,
      ...(isPrivileged
        ? {
            warnings: lastSheetWarnings.slice(0, 50),
            auditLogs: lastSheetAuditLogs.slice(0, 50)
          }
        : {})
    });
  });

  // ============================================================================
  // PARTE 3.1: WEBHOOK INSTANTÁNEO DESDE GOOGLE SHEETS (DEBOUNCE 2000ms + MUTEX)
  // ============================================================================
  const scheduleDebouncedWebhookSync = () => {
    if (webhookDebounceTimer) {
      clearTimeout(webhookDebounceTimer);
      webhookDebounceTimer = null;
    }

    webhookDebounceTimer = setTimeout(() => {
      webhookDebounceTimer = null;

      if (sheetsScheduler.getStatus().isSyncing) {
        // Si ya hay una sincronización en vuelo, marcar follow-up sin solapar peticiones a Google Sheets
        webhookPendingFollowUp = true;
        return;
      }

      runCoalescedSheetsSync(false, 'sheets_webhook', 'webhook')
        .catch((err: any) => {
          console.warn('[SYNC WEBHOOK] Error ejecutando sincronización consolidada:', err?.message || 'sync_error');
        })
        .finally(() => {
          if (webhookPendingFollowUp) {
            webhookPendingFollowUp = false;
            scheduleDebouncedWebhookSync();
          }
        });
    }, WEBHOOK_DEBOUNCE_MS);
    if (typeof (webhookDebounceTimer as any)?.unref === 'function') {
      (webhookDebounceTimer as any).unref();
    }
  };

  app.post("/api/sync/sheets-webhook", (req: any, res: any) => {
    const configuredSecret = (process.env.SYNC_SECRET_TOKEN || '').trim();
    if (!configuredSecret) {
      return res.status(503).json({
        success: false,
        error: 'Webhook no configurado: SYNC_SECRET_TOKEN ausente en el servidor.'
      });
    }

    const authHeader = typeof req.headers['authorization'] === 'string' ? req.headers['authorization'].trim() : '';
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    const xSyncToken = typeof req.headers['x-sync-token'] === 'string' ? req.headers['x-sync-token'].trim() : '';
    const providedToken = bearerToken || xSyncToken;

    if (!providedToken) {
      return res.status(401).json({
        success: false,
        error: 'Token de sincronización requerido (Authorization: Bearer o x-sync-token).'
      });
    }

    if (!verifySyncSecretConstantTime(providedToken, configuredSecret)) {
      return res.status(403).json({
        success: false,
        error: 'Token de sincronización inválido.'
      });
    }

    scheduleDebouncedWebhookSync();

    return res.status(202).json({
      success: true,
      accepted: true,
      queued: true,
      debounceMs: WEBHOOK_DEBOUNCE_MS,
      isSyncing: sheetsScheduler.getStatus().isSyncing
    });
  });

  // ============================================================================
  // PARTE 3.2: CANAL EN TIEMPO REAL SSE + ENDPOINT DE RESPALDO POR VENDEDOR
  // ============================================================================
  app.get("/api/vendedor/:sellerId/stream", (req: any, res: any) => {
    const authHeader = typeof req.headers['authorization'] === 'string' ? req.headers['authorization'].trim() : '';
    const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const queryToken = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
    const token = headerToken || queryToken;

    if (!token) {
      return res.status(401).json({ success: false, error: 'Token de autenticación requerido para el canal en tiempo real.' });
    }

    let decodedUser: any = null;
    try {
      decodedUser = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(403).json({ success: false, error: 'Token inválido o expirado.' });
    }

    const authorizedKey = resolveAuthorizedSellerStreamKey(decodedUser, String(req.params.sellerId || ''));
    if (!authorizedKey) {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para suscribirse a actualizaciones de otro vendedor.'
      });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    let subSet = sseSubscribers.get(authorizedKey);
    if (!subSet) {
      subSet = new Set<express.Response>();
      sseSubscribers.set(authorizedKey, subSet);
    }
    subSet.add(res);

    const currentStatus = sellerNumericTracker.getSellerStatus(authorizedKey);
    res.write(
      `event: connected\ndata: ${JSON.stringify({
        sellerId: authorizedKey,
        version: currentStatus.version,
        updatedAt: currentStatus.updatedAt
      })}\n\n`
    );

    const heartbeatTimer = setInterval(() => {
      if (res.writableEnded || res.destroyed) return;
      try {
        res.write(': heartbeat\n\n');
      } catch {
        // cerrado en cliente
      }
    }, SSE_HEARTBEAT_INTERVAL_MS);
    if (typeof (heartbeatTimer as any)?.unref === 'function') {
      (heartbeatTimer as any).unref();
    }
    sseHeartbeats.add(heartbeatTimer);

    const cleanup = () => {
      clearInterval(heartbeatTimer);
      sseHeartbeats.delete(heartbeatTimer);
      const set = sseSubscribers.get(authorizedKey);
      if (set) {
        set.delete(res);
        if (set.size === 0) {
          sseSubscribers.delete(authorizedKey);
        }
      }
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
  });

  app.get("/api/vendedor/:sellerId/sync-status", authenticateToken, (req: any, res: any) => {
    const authorizedKey = resolveAuthorizedSellerStreamKey(req.user, String(req.params.sellerId || ''));
    if (!authorizedKey) {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para consultar el estado de sincronización de otro vendedor.'
      });
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    const status = sellerNumericTracker.getSellerStatus(authorizedKey);
    return res.json({
      sellerId: authorizedKey,
      version: status.version,
      updatedAt: status.updatedAt
    });
  });

  // ==============================================================
  // HISTORIAL DE VENTAS (tabla ventas_historial + vistas hist_*)
  // Solo lectura. Protegido con JWT; el alcance por vendedor se decide AQUÍ (nunca en el navegador).
  // ==============================================================
  const normHist = (s: any) => String(s || '').replace(/Ã‘|Ã±/g, 'N').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Normaliza cualquier nombre/código de rubro (nuevo o legacy) al código canónico de src/lib/rubros.ts
  const normalizeHistRubroCode = (raw: any): string | null => {
    if (!normHist(raw)) return null;
    const code = categoriaARubroCodigo(String(raw || ''));
    return code === 'OTROS' ? null : code;
  };

  const histFail = (res: any, e: any) => {
    const msg = String(e?.message || e || '');
    if (/does not exist|schema cache|Could not find the (table|relation)/i.test(msg)) {
      return res.status(503).json({ error: 'El historial aún no está instalado en Supabase (ejecutar scripts/sql/ventas_historial.sql y cargar el CSV).', code: 'NOT_INSTALLED' });
    }
    console.error('[HISTORIAL]', msg);
    return res.status(500).json({ error: 'Error consultando el historial', details: msg });
  };

  // Pagina de 1000 en 1000 (límite de PostgREST). `build` debe incluir order() para paginar de forma estable.
  async function histFetchAll(build: (from: number, to: number) => any): Promise<any[]> {
    const out: any[] = [];
    for (let from = 0; from < 300000; from += 1000) {
      const { data, error } = await build(from, from + 999);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out;
  }

  let histVendorsCache: { names: string[]; time: number } | null = null;
  async function histGetVendorNames(): Promise<string[]> {
    if (histVendorsCache && Date.now() - histVendorsCache.time < 300000) return histVendorsCache.names;
    const rows = await histFetchAll((a, b) => supabase!.from('hist_vendedores').select('vendedor').order('vendedor').range(a, b));
    const names = rows.map(r => String(r.vendedor || '')).filter(Boolean);
    histVendorsCache = { names, time: Date.now() };
    return names;
  }

  let histCarteraCache: { rows: { cod: string; vend: string }[]; time: number } | null = null;
  async function histGetCarteraVendorMap(): Promise<{ cod: string; vend: string }[]> {
    if (histCarteraCache && Date.now() - histCarteraCache.time < 300000) return histCarteraCache.rows;
    const raw = await histFetchAll((a, b) => supabase!.from('activacion_clientes').select('cliente_codigo,vendedor_nombre').order('id').range(a, b));
    const rows = raw
      .map((r: any) => ({
        cod: String(r.cliente_codigo || '').trim().replace(/^#/, '').replace(/^0+/, ''),
        vend: normHist(r.vendedor_nombre)
      }))
      .filter((r) => r.cod && r.vend);
    histCarteraCache = { rows, time: Date.now() };
    return rows;
  }

  interface HistScope {
    all: boolean;
    names: string[];
    aliases: string[];
    clientIds?: Set<string>;
  }

  // Devuelve los nombres de vendedor que el usuario autenticado puede ver.
  // ADMIN: todo o la ruta/supervisor pedido. SUPERVISOR: su equipo o un vendedor de su equipo. VENDEDOR: únicamente sus propias rutas.
  async function histResolveScope(req: any): Promise<HistScope> {
    const user = req.user || {};
    const supProfile = getSupervisorProfile(user.username);
    const role = supProfile ? 'SUPERVISOR' : String(user.role || '').toUpperCase();
    const q = String(req.query.vendedor || '').trim();
    const qU = q.toUpperCase();
    const known = await histGetVendorNames();
    const toNames = (aliases: string[]) => {
      const set = new Set(aliases.map(normHist));
      return known.filter(n => set.has(normHist(n)));
    };
    const findRoute = (id: string) => {
      for (const p of Object.values(VENDOR_PROFILES)) {
        const r = p.routes.find(r => r.id === id || r.aliases.some(a => normHist(a) === normHist(id)));
        if (r) return r;
      }
      return null;
    };

    const enrichNewVendorScope = async (names: string[], aliases: string[], isSupervisorScope = false): Promise<HistScope> => {
      if (names.length > 0) return { all: false, names, aliases };
      // Para el supervisor Alí Pérez consolidado, en ventas_historial los registros están bajo "ALI PEREZ"
      if (isSupervisorScope) {
        const supHistNames = toNames([...aliases, 'ALI PEREZ']);
        return { all: false, names: supHistNames, aliases };
      }
      // Para vendedores nuevos de la zona de Alí Pérez (Ángel Navarro, Mariangel González, Víctor Campos),
      // filtramos el historial real de sus clientes asignados actualmente en activacion_clientes.
      const aliasSet = new Set(aliases);
      const carteraRows = await histGetCarteraVendorMap();
      const clientIds = new Set<string>();
      carteraRows.forEach((r) => {
        if (aliasSet.has(r.vend)) clientIds.add(r.cod);
      });
      if (clientIds.size > 0) {
        const aliHistNames = toNames(['ALI PEREZ', ...aliases]);
        if (aliHistNames.length > 0) {
          return { all: false, names: aliHistNames, aliases, clientIds };
        }
      }
      return { all: false, names, aliases };
    };

    if (role === 'ADMIN') {
      if (!q || qU === 'ADMIN' || qU === 'TODOS' || qU === 'TODOS LOS VENDEDORES') return { all: true, names: [], aliases: [] };
      if (qU.startsWith('SUPERVISOR:')) {
        const supName = q.slice('SUPERVISOR:'.length);
        const supAliases = getSupervisedAliases(supName);
        return enrichNewVendorScope(toNames([...supAliases, supName]), supAliases.map(normHist), true);
      }
      if (qU.startsWith('CONSOLIDATED:')) {
        const prof = getVendorProfile(q.slice('CONSOLIDATED:'.length));
        const aliases = prof.routes.flatMap(r => [r.id, ...r.aliases]).map(normHist);
        return enrichNewVendorScope(toNames(prof.routes.flatMap(r => r.aliases)), aliases);
      }
      const r = findRoute(q);
      const aliases = (r ? [r.id, ...r.aliases] : [q]).map(normHist);
      return enrichNewVendorScope(toNames(r ? r.aliases : [q]), aliases);
    }

    if (role === 'SUPERVISOR') {
      const mySup = supProfile || getSupervisorProfile(String(user.username || ''));
      const supName = mySup?.canonicalUsername || String(user.username || '');
      const allSupAliases = getSupervisedAliases(supName);
      if (!q || qU === 'SUPERVISOR_ALL' || qU === 'ALL_MY_ROUTES' || qU.startsWith('SUPERVISOR:')) {
        return enrichNewVendorScope(toNames([...allSupAliases, supName]), allSupAliases.map(normHist), true);
      }
      const targetVendor = q.replace(/^CONSOLIDATED:/i, '');
      const supRoutes = getSupervisedRoutes(supName);
      const matchedRoute = supRoutes.find(r => r.id === targetVendor || r.aliases.some(a => normHist(a) === normHist(targetVendor)));
      if (matchedRoute) {
        const aliases = [matchedRoute.id, ...matchedRoute.aliases].map(normHist);
        return enrichNewVendorScope(toNames(matchedRoute.aliases), aliases);
      }
      if (mySup?.supervisedVendors.some(v => normHist(v) === normHist(targetVendor))) {
        const prof = getVendorProfile(targetVendor);
        const aliases = prof.routes.flatMap(r => [r.id, ...r.aliases]).map(normHist);
        return enrichNewVendorScope(toNames(prof.routes.flatMap(r => r.aliases)), aliases);
      }
      return enrichNewVendorScope(toNames([...allSupAliases, supName]), allSupAliases.map(normHist), true);
    }

    const profile = getVendorProfile(String(user.username || ''));
    let routes = profile.routes;
    if (q && qU !== 'ALL_MY_ROUTES') {
      const mine = routes.find(r => r.id === q || r.aliases.some(a => normHist(a) === normHist(q)));
      if (mine) routes = [mine];
    }
    const aliases = routes.flatMap(r => [r.id, ...r.aliases]).map(normHist);
    return enrichNewVendorScope(toNames(routes.flatMap(r => r.aliases)), aliases);
  }

  const histCache = new Map<string, { time: number; data: any }>();
  const histCached = async <T,>(key: string, loader: () => Promise<T>): Promise<T> => {
    const hit = histCache.get(key);
    if (hit && Date.now() - hit.time < 300000) return hit.data as T;
    const data = await loader();
    if (histCache.size > 60) histCache.clear();
    histCache.set(key, { time: Date.now(), data });
    return data;
  };
  const scopeKey = (s: HistScope) => (s.all ? 'ALL' : [...s.names, ...(s.aliases || [])].sort().join('|'));
  const nz = (v: any) => Number(v) || 0;

  async function histLoadVolumen(scope: HistScope) {
    return histCached('vol:' + scopeKey(scope), async () => {
      const merged = new Map<string, any>();
      const add = (r: any) => {
        const k = `${r.ano}|${r.mes}|${r.id_articulo}`;
        let m = merged.get(k);
        if (!m) { m = { ano: r.ano, mes: r.mes, sku: r.id_articulo, articulo: r.articulo, rubro: clasificarRubro(r.id_articulo, r.articulo), cajas: 0, unidades: 0, kgs: 0, monto: 0, clientes: 0 }; merged.set(k, m); }
        m.cajas += nz(r.cajas); m.unidades += nz(r.unidades); m.kgs += nz(r.kgs); m.monto += nz(r.monto); m.clientes += nz(r.clientes);
      };
      if (scope.all) {
        const rows = await histFetchAll((a, b) => supabase!.from('hist_volumen_total_mes').select('*').order('ano').order('mes').order('id_articulo').range(a, b));
        rows.forEach(add);
      } else if (scope.clientIds && scope.clientIds.size > 0) {
        const rawRows = await histFetchAll((a, b) =>
          supabase!.from('ventas_historial')
            .select('ano,mes,id_cliente,id_articulo,articulo,rubro,cajas,unidades,kgs,monto')
            .in('vendedor', scope.names)
            .order('ano').order('mes').order('id_articulo').order('id_cliente')
            .range(a, b)
        );
        const cliSets = new Map<string, Set<string>>();
        rawRows.forEach((r: any) => {
          const cid = String(r.id_cliente || '').trim().replace(/^#/, '').replace(/^0+/, '');
          if (!scope.clientIds!.has(cid)) return;
          const k = `${r.ano}|${r.mes}|${r.id_articulo}`;
          let m = merged.get(k);
          if (!m) { m = { ano: r.ano, mes: r.mes, sku: r.id_articulo, articulo: r.articulo, rubro: clasificarRubro(r.id_articulo, r.articulo), cajas: 0, unidades: 0, kgs: 0, monto: 0, clientes: 0 }; merged.set(k, m); }
          m.cajas += nz(r.cajas); m.unidades += nz(r.unidades); m.kgs += nz(r.kgs); m.monto += nz(r.monto);
          if (nz(r.cajas) > 0 && cid) {
            let cs = cliSets.get(k);
            if (!cs) { cs = new Set(); cliSets.set(k, cs); }
            cs.add(cid);
          }
        });
        cliSets.forEach((cs, k) => {
          const m = merged.get(k);
          if (m) m.clientes = cs.size;
        });
      } else {
        const rows = await histFetchAll((a, b) => supabase!.from('hist_volumen_mes').select('*').in('vendedor', scope.names).order('ano').order('mes').order('vendedor').order('id_articulo').range(a, b));
        rows.forEach(add);
      }
      return [...merged.values()].map(r => ({ ...r, cajas: +r.cajas.toFixed(2), unidades: +r.unidades.toFixed(2), kgs: +r.kgs.toFixed(2), monto: +r.monto.toFixed(2) }));
    });
  }

  app.get('/api/historial/meta', authenticateToken, async (req: any, res: any) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const periodos = await histCached('periodos', () =>
        histFetchAll((a, b) => supabase!.from('hist_periodos').select('ano,mes').order('ano').order('mes').range(a, b)));
      res.json({ periodos });
    } catch (e) { histFail(res, e); }
  });

  app.get('/api/historial/volumen', authenticateToken, async (req: any, res: any) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const scope = await histResolveScope(req);
      if (!scope.all && scope.names.length === 0) return res.json({ rows: [] });
      res.json({ rows: await histLoadVolumen(scope) });
    } catch (e) { histFail(res, e); }
  });

  app.get('/api/historial/rubros', authenticateToken, async (req: any, res: any) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const scope = await histResolveScope(req);
      if (!scope.all && scope.names.length === 0) return res.json({ meses: [], cartera: 0 });

      const result = await histCached('rub:' + scopeKey(scope), async () => {
        const vol = await histLoadVolumen(scope);
        const meses = new Map<string, any>();
        const mesRow = (ano: number, mes: number) => {
          const k = `${ano}|${mes}`;
          let m = meses.get(k);
          if (!m) { m = { ano, mes, kgs: {} as Record<string, number>, cajas: {} as Record<string, number>, monto: {} as Record<string, number>, activos: { ACEITE: 0, AZUCAR: 0, POLLO: 0, ESTANDAR_ASTURIAS: 0, MORTADELA_SALPICAO: 0, LECHE_VENCAMPO: 0, MORTADELA_ASTURIAS: 0, SALPICAO: 0, TOTAL: 0 }, clientesConMovimiento: 0, fueraCartera: 0 }; meses.set(k, m); }
          return m;
        };
        vol.forEach((r: any) => {
          const m = mesRow(r.ano, r.mes);
          m.kgs[r.rubro] = (m.kgs[r.rubro] || 0) + r.kgs;
          m.cajas[r.rubro] = (m.cajas[r.rubro] || 0) + r.cajas;
          m.monto[r.rubro] = (m.monto[r.rubro] || 0) + r.monto;
        });

        const cart = await histFetchAll((a, b) => supabase!.from('activacion_clientes').select('cliente_codigo,vendedor_nombre').order('id').range(a, b));
        const allowed = new Set([...scope.names.map(normHist), ...(scope.aliases || [])]);
        const seen = new Set<string>();
        cart.forEach((c: any) => {
          if (!scope.all && !allowed.has(normHist(c.vendedor_nombre))) return;
          seen.add(String(c.cliente_codigo || '').trim().replace(/^#/, '').replace(/^0+/, ''));
        });

        if (scope.clientIds && scope.clientIds.size > 0) {
          const clientRows = await histFetchAll((a, b) =>
            supabase!.from('ventas_historial')
              .select('ano,mes,id_cliente,id_articulo,articulo,rubro,cajas')
              .in('vendedor', scope.names)
              .order('ano').order('mes').order('id_cliente').order('id_articulo')
              .range(a, b)
          );
          const byMesCliRub = new Map<string, Record<string, number>>();
          clientRows.forEach((r: any) => {
            const cid = String(r.id_cliente || '').trim().replace(/^#/, '').replace(/^0+/, '');
            if (!scope.clientIds!.has(cid)) return;
            const mk = `${r.ano}|${r.mes}|${cid}`;
            let obj = byMesCliRub.get(mk);
            if (!obj) { obj = {}; byMesCliRub.set(mk, obj); }
            const rk = (r.id_articulo || r.articulo) ? clasificarRubro(r.id_articulo, r.articulo) : r.rubro;
            obj[rk] = (obj[rk] || 0) + nz(r.cajas);
            obj._ANY = (obj._ANY || 0) + nz(r.cajas);
          });
          byMesCliRub.forEach((obj, mk) => {
            const [anoS, mesS] = mk.split('|');
            const m = mesRow(Number(anoS), Number(mesS));
            let anyKeyRub = false;
            for (const rub of ['AZUCAR', 'LECHE_VENCAMPO', 'ESTANDAR_ASTURIAS', 'MORTADELA_ASTURIAS', 'SALPICAO', 'ACEITE', 'POLLO', 'MORTADELA_SALPICAO']) {
              if ((obj[rub] || 0) > 0) {
                m.activos[rub] = (m.activos[rub] || 0) + 1;
                if (esRubroActivo(rub)) anyKeyRub = true;
              }
            }
            if (anyKeyRub) m.activos.TOTAL += 1;
            if ((obj._ANY || 0) > 0) m.clientesConMovimiento += 1;
          });
        } else {
          const resumen = await histFetchAll((a, b) => {
            let q = supabase!.from('hist_activacion_resumen_mes').select('*');
            if (!scope.all) q = q.in('vendedor', scope.names);
            return q.order('ano').order('mes').order('vendedor').range(a, b);
          });
          resumen.forEach((r: any) => {
            const m = mesRow(r.ano, r.mes);
            m.activos.ACEITE += nz(r.act_aceite);
            m.activos.AZUCAR += nz(r.act_azucar);
            m.activos.POLLO += nz(r.act_pollo);
            m.activos.ESTANDAR_ASTURIAS += nz(r.act_estandar_asturias);
            m.activos.MORTADELA_SALPICAO += nz(r.act_mortadela_salpicao);
            m.activos.LECHE_VENCAMPO += nz(r.act_leche_vencampo);
            m.activos.MORTADELA_ASTURIAS += nz(r.act_mortadela_asturias);
            m.activos.SALPICAO += nz(r.act_salpicao);
            m.activos.TOTAL += nz(r.act_total ?? r.clientes_con_compra);
            m.clientesConMovimiento += nz(r.clientes_con_movimiento ?? r.clientes_con_compra);
            m.fueraCartera += nz(r.clientes_fuera_cartera);
          });

          // Si las vistas en Supabase tenían filtro legacy para ESTANDAR_ASTURIAS / MORTADELA_SALPICAO,
          // calculamos los clientes activos exactos directamente desde ventas_historial.
          const needsEmFix = [...meses.values()].every(
            (m: any) => m.activos.ESTANDAR_ASTURIAS === 0 && m.activos.MORTADELA_SALPICAO === 0 && ((m.cajas.ESTANDAR_ASTURIAS || 0) > 0 || (m.cajas.MORTADELA_SALPICAO || 0) > 0)
          );
          if (needsEmFix) {
            const emRows = await histFetchAll((a, b) => {
              let q = supabase!.from('ventas_historial').select('ano,mes,id_cliente,rubro,cajas').in('rubro', ['ESTANDAR_ASTURIAS', 'MORTADELA_SALPICAO']);
              if (!scope.all) q = q.in('vendedor', scope.names);
              return q.order('ano').order('mes').order('id_cliente').order('id_articulo').range(a, b);
            });
            const byMesRubCli = new Map<string, number>();
            emRows.forEach((r: any) => {
              const k = `${r.ano}|${r.mes}|${r.rubro}|${String(r.id_cliente || '').replace(/^0+/, '')}`;
              byMesRubCli.set(k, (byMesRubCli.get(k) || 0) + nz(r.cajas));
            });
            byMesRubCli.forEach((cajasSum, key) => {
              if (cajasSum <= 0) return;
              const [anoS, mesS, rub] = key.split('|');
              const m = mesRow(Number(anoS), Number(mesS));
              if (rub === 'ESTANDAR_ASTURIAS' || rub === 'MORTADELA_SALPICAO') {
                m.activos[rub] = (m.activos[rub] || 0) + 1;
              }
            });
          }
        }

        return {
          meses: [...meses.values()].sort((a, b) => a.ano - b.ano || a.mes - b.mes),
          cartera: seen.size
        };
      });
      res.json(result);
    } catch (e) { histFail(res, e); }
  });

  app.get('/api/historial/clientes', authenticateToken, async (req: any, res: any) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const ano = parseInt(String(req.query.ano), 10);
      const mes = parseInt(String(req.query.mes), 10);
      if (!ano || !mes || mes < 1 || mes > 12) return res.status(400).json({ error: 'ano y mes son requeridos' });
      const scope = await histResolveScope(req);
      if (!scope.all && scope.names.length === 0) return res.json({ rows: [] });

      const rows = await histCached(`cli:${ano}:${mes}:${scopeKey(scope)}`, async () => {
        const [data, emData, cart] = await Promise.all([
          histFetchAll((a, b) => {
            let q = supabase!.from('hist_activacion_cliente_mes').select('*').eq('ano', ano).eq('mes', mes);
            if (!scope.all) q = q.in('vendedor', scope.names);
            return q.order('id_cliente').range(a, b);
          }),
          histFetchAll((a, b) => {
            let q = supabase!.from('ventas_historial').select('id_cliente,rubro,cajas').eq('ano', ano).eq('mes', mes).in('rubro', ['ESTANDAR_ASTURIAS', 'MORTADELA_SALPICAO']);
            if (!scope.all) q = q.in('vendedor', scope.names);
            return q.order('id_cliente').order('id_articulo').range(a, b);
          }),
          histFetchAll((a, b) => supabase!.from('activacion_clientes').select('cliente_codigo,vendedor_nombre').order('id').range(a, b))
        ]);

        const allowed = new Set([...scope.names.map(normHist), ...(scope.aliases || [])]);
        const carteraSet = new Set<string>();
        cart.forEach((c: any) => {
          if (!scope.all && !allowed.has(normHist(c.vendedor_nombre))) return;
          carteraSet.add(String(c.cliente_codigo || '').trim().replace(/^#/, '').replace(/^0+/, ''));
        });

        const emByClient = new Map<string, { ESTANDAR_ASTURIAS: number; MORTADELA_SALPICAO: number }>();
        emData.forEach((r: any) => {
          const cid = String(r.id_cliente || '').trim().replace(/^#/, '').replace(/^0+/, '');
          if (scope.clientIds && scope.clientIds.size > 0 && !scope.clientIds.has(cid)) return;
          let cur = emByClient.get(cid);
          if (!cur) { cur = { ESTANDAR_ASTURIAS: 0, MORTADELA_SALPICAO: 0 }; emByClient.set(cid, cur); }
          if (r.rubro === 'ESTANDAR_ASTURIAS') cur.ESTANDAR_ASTURIAS += nz(r.cajas);
          if (r.rubro === 'MORTADELA_SALPICAO') cur.MORTADELA_SALPICAO += nz(r.cajas);
        });

        const filteredData = (scope.clientIds && scope.clientIds.size > 0)
          ? data.filter((r: any) => scope.clientIds!.has(String(r.id_cliente || '').trim().replace(/^#/, '').replace(/^0+/, '')))
          : data;

        return filteredData.map((r: any) => {
          const cid = String(r.id_cliente || '').trim().replace(/^#/, '').replace(/^0+/, '');
          const em = emByClient.get(cid);
          return {
            id: r.id_cliente,
            cliente: r.cliente,
            vendedor: r.vendedor,
            enCartera: r.en_cartera !== undefined ? !!r.en_cartera : carteraSet.has(cid),
            cajas: {
              ACEITE: nz(r.cajas_aceite),
              AZUCAR: nz(r.cajas_azucar),
              POLLO: nz(r.cajas_pollo),
              ESTANDAR_ASTURIAS: nz(r.cajas_estandar_asturias) || +(em?.ESTANDAR_ASTURIAS || 0).toFixed(2),
              MORTADELA_SALPICAO: nz(r.cajas_mortadela_salpicao) || +(em?.MORTADELA_SALPICAO || 0).toFixed(2),
              LECHE_VENCAMPO: nz(r.cajas_leche_vencampo),
              MORTADELA_ASTURIAS: nz(r.cajas_mortadela_asturias),
              SALPICAO: nz(r.cajas_salpicao)
            },
            kgs: nz(r.kgs ?? r.kgs_total),
            monto: nz(r.monto ?? r.monto_total)
          };
        });
      });
      res.json({ rows });
    } catch (e) { histFail(res, e); }
  });

  app.get('/api/historial/cliente/:id', authenticateToken, async (req: any, res: any) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const rawId = String(req.params.id || '').trim().replace(/^#/, '');
      const id = rawId.replace(/^0+/, '');
      if (!/^[A-Za-z0-9._-]{1,24}$/.test(id)) return res.status(400).json({ error: 'Código de cliente inválido' });
      const candidateIds = Array.from(new Set([rawId, id, id.padStart(6, '0'), id.padStart(5, '0'), id.padStart(4, '0')])).filter(Boolean);
      const scope = await histResolveScope(req);
      if (!scope.all && scope.names.length === 0) return res.status(404).json({ error: 'Sin acceso' });
      if (scope.clientIds && scope.clientIds.size > 0 && !scope.clientIds.has(id)) {
        return res.json({ meses: [], productos: [] });
      }

      const meses = await histFetchAll((a, b) => {
        let q = supabase!.from('hist_activacion_cliente_mes').select('*').in('id_cliente', candidateIds);
        if (!scope.all) q = q.in('vendedor', scope.names);
        return q.order('ano').order('mes').range(a, b);
      });
      // Si el cliente no pertenece al alcance del usuario no se devuelve nada (ni sus productos).
      if (meses.length === 0) return res.json({ meses: [], productos: [] });

      const prods = await histFetchAll((a, b) => {
        let q = supabase!.from('ventas_historial').select('ano,mes,id_articulo,articulo,rubro,cajas,kgs,monto').in('id_cliente', candidateIds);
        if (!scope.all) q = q.in('vendedor', scope.names);
        return q.order('ano').order('mes').order('id_articulo').range(a, b);
      });
      const pm = new Map<string, any>();
      const cajasByMesRubro = new Map<string, Record<string, number>>();
      prods.forEach((r: any) => {
        const k = `${r.ano}|${r.mes}|${r.id_articulo}`;
        let m = pm.get(k);
        if (!m) { m = { ano: r.ano, mes: r.mes, sku: r.id_articulo, articulo: r.articulo, rubro: clasificarRubro(r.id_articulo, r.articulo), cajas: 0, kgs: 0, monto: 0 }; pm.set(k, m); }
        m.cajas += nz(r.cajas); m.kgs += nz(r.kgs); m.monto += nz(r.monto);

        const mk = `${r.ano}|${r.mes}`;
        let cm = cajasByMesRubro.get(mk);
        if (!cm) { cm = {}; cajasByMesRubro.set(mk, cm); }
        const rkc = clasificarRubro(r.id_articulo, r.articulo);
        cm[rkc] = (cm[rkc] || 0) + nz(r.cajas);
      });

      res.json({
        meses: meses.map((r: any) => {
          const cm = cajasByMesRubro.get(`${r.ano}|${r.mes}`) || {};
          return {
            ano: r.ano, mes: r.mes, cliente: r.cliente, vendedor: r.vendedor,
            cajas: {
              ACEITE: nz(r.cajas_aceite) || +(cm.ACEITE || 0).toFixed(2),
              AZUCAR: nz(r.cajas_azucar) || +(cm.AZUCAR || 0).toFixed(2),
              POLLO: nz(r.cajas_pollo) || +(cm.POLLO || 0).toFixed(2),
              ESTANDAR_ASTURIAS: nz(r.cajas_estandar_asturias) || +(cm.ESTANDAR_ASTURIAS || 0).toFixed(2),
              MORTADELA_SALPICAO: nz(r.cajas_mortadela_salpicao) || +(cm.MORTADELA_SALPICAO || 0).toFixed(2),
              LECHE_VENCAMPO: nz(r.cajas_leche_vencampo) || +(cm.LECHE_VENCAMPO || 0).toFixed(2),
              MORTADELA_ASTURIAS: nz(r.cajas_mortadela_asturias) || +(cm.MORTADELA_ASTURIAS || 0).toFixed(2),
              SALPICAO: nz(r.cajas_salpicao) || +(cm.SALPICAO || 0).toFixed(2)
            },
            kgs: nz(r.kgs ?? r.kgs_total),
            monto: nz(r.monto ?? r.monto_total)
          };
        }),
        productos: [...pm.values()].map(p => ({ ...p, cajas: +p.cajas.toFixed(2), kgs: +p.kgs.toFixed(2), monto: +p.monto.toFixed(2) }))
      });
    } catch (e) { histFail(res, e); }
  });

  // ==============================================================
  // DASHBOARD 360° HISTÓRICO POR RUBRO (Específico y Personal por Vendedor)
  // ==============================================================
  app.get('/api/historial/rubro-360', authenticateToken, async (req: any, res: any) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const rubroCode = normalizeHistRubroCode(req.query.rubro);
      if (!rubroCode) {
        return res.status(400).json({ error: 'Rubro inválido o no especificado' });
      }
      const scope = await histResolveScope(req);
      if (!scope.all && scope.names.length === 0) {
        return res.json({
          rubro: rubroCode,
          periodos: [],
          carteraTotal: 0,
          activadosMesActual: 0,
          metaMesActual: 0,
          periodoMetaActual: null,
          metasPorMes: [],
          periodosDisponibles: [],
          meses: [],
          skus: [],
          clientes: [],
          resumen: {
            totalMeses: 0, promedioClientesMes: 0, promedioCajasMes: 0, promedioKgsMes: 0,
            mejorMes: null, peorMes: null, totalCajasHistorico: 0, totalKgsHistorico: 0,
            clientesUnicosHistorico: 0, clientesHabituales: 0, oportunidadRecuperacion: 0, reactivadosEsteMes: 0, nuevosEsteMes: 0
          }
        });
      }

      // Filtro opcional de meses (?meses=2026-3,2026-5). Vacío = todos los meses con historial.
      const mesesFiltro: Set<string> | null = (() => {
        const raw = String(req.query.meses || '').trim();
        if (!raw) return null;
        if (raw === 'none') return new Set<string>(); // ningún mes histórico seleccionado (solo mes actual)
        const set = new Set<string>();
        raw.split(',').forEach(tok => {
          const m = tok.trim().match(/^(\d{4})-(\d{1,2})$/);
          if (m) set.add(`${Number(m[1])}-${Number(m[2])}`);
        });
        return set.size > 0 ? set : null;
      })();
      const filtroKey = mesesFiltro ? [...mesesFiltro].sort().join(',') : 'ALL';

      // Datos crudos (se consultan una vez por rubro+alcance; cambiar el filtro de meses no vuelve a consultar la BD)
      const base = await histCached(`rub360base:${rubroCode}:${scopeKey(scope)}`, async () => {
        const [periodos, rawRows, cart, metas] = await Promise.all([
          histCached('periodos', () =>
            histFetchAll((a, b) => supabase!.from('hist_periodos').select('ano,mes').order('ano').order('mes').range(a, b))
          ),
          histFetchAll((a, b) => {
            let q = supabase!
              .from('ventas_historial')
              .select('ano,mes,id_cliente,cliente,vendedor,id_articulo,articulo,cajas,unidades,kgs')
              .eq('rubro', rubroCode);
            if (!scope.all) q = q.in('vendedor', scope.names);
            return q.order('ano').order('mes').order('id_cliente').order('id_articulo').range(a, b);
          }),
          histFetchAll((a, b) =>
            supabase!.from('activacion_clientes').select('*').order('id').range(a, b)
          ),
          histFetchAll((a, b) =>
            supabase!.from('metas_activacion').select('*').order('id').range(a, b)
          )
        ]);
        const rows = (scope.clientIds && scope.clientIds.size > 0)
          ? rawRows.filter((r: any) => scope.clientIds!.has(String(r.id_cliente || '').trim().replace(/^#/, '').replace(/^0+/, '')))
          : rawRows;
        return { periodos, rows, cart, metas };
      });

      const result = await histCached(`rub360:${rubroCode}:${scopeKey(scope)}:${filtroKey}`, async () => {
        const { periodos, cart, metas } = base;
        const rows = mesesFiltro ? base.rows.filter((r: any) => mesesFiltro.has(`${r.ano}-${r.mes}`)) : base.rows;

        const allowed = new Set((scope.aliases && scope.aliases.length > 0) ? scope.aliases : scope.names.map(normHist));
        // activacion_clientes guarda el estado del mes en curso en has_<rubro> / cajas_<rubro>
        const isClientActiveInRubro = (c: any, rub: string): boolean => {
          switch (rub) {
            case 'ACEITE': return !!c.has_aceite || nz(c.cajas_aceite) > 0;
            case 'AZUCAR': return !!c.has_azucar || nz(c.cajas_azucar) > 0;
            case 'POLLO': return !!c.has_pollo || nz(c.cajas_pollo) > 0;
            case 'ESTANDAR_ASTURIAS': return !!c.has_estandar_asturias || nz(c.cajas_estandar_asturias) > 0;
            case 'MORTADELA_SALPICAO': return !!c.has_mortadela_salpicao || nz(c.cajas_mortadela_salpicao) > 0;
            case 'LECHE_VENCAMPO': return !!c.has_leche_vencampo || nz(c.cajas_leche_vencampo) > 0;
            case 'MORTADELA_ASTURIAS': return !!c.has_mortadela_asturias || nz(c.cajas_mortadela_asturias) > 0;
            case 'SALPICAO': return !!c.has_salpicao || nz(c.cajas_salpicao) > 0;
            default: return false;
          }
        };

        // 1. Construir mapa de cartera actual del vendedor
        const carteraMap = new Map<string, { rawId: string; nombre: string; vendedor: string; activoActual: boolean }>();
        cart.forEach((c: any) => {
          if (!scope.all && !allowed.has(normHist(c.vendedor_nombre))) return;
          const normId = String(c.cliente_codigo || '').trim().replace(/^#/, '').replace(/^0+/, '');
          if (!normId) return;
          const activoActual = isClientActiveInRubro(c, rubroCode);
          const prev = carteraMap.get(normId);
          carteraMap.set(normId, {
            rawId: String(c.cliente_codigo || normId).trim(),
            nombre: String(c.cliente_nombre || prev?.nombre || '').trim(),
            vendedor: String(c.vendedor_nombre || prev?.vendedor || '').trim(),
            activoActual: prev ? (prev.activoActual || activoActual) : activoActual
          });
        });

        const carteraTotal = carteraMap.size;
        const activadosClientesActual = [...carteraMap.values()].filter(c => c.activoActual).length;

        // 2. Metas reales guardadas por periodo (metas_activacion). Solo existen los periodos que
        //    fueron sincronizados desde el Grid; los meses sin registro quedan como null (nunca se inventan).
        const aliasSet = new Set(scope.aliases || []);
        const metasPeriodoMap = new Map<string, { meta: number; activados: number }>();
        metas.forEach((m: any) => {
          if (!scope.all && !aliasSet.has(normHist(m.vendedor_id))) return;
          if (normalizeHistRubroCode(m.categoria) !== rubroCode) return;
          const per = String(m.periodo || '');
          if (!/^\d{4}-\d{2}$/.test(per)) return;
          const cur = metasPeriodoMap.get(per) || { meta: 0, activados: 0 };
          cur.meta += nz(m.meta);
          cur.activados += nz(m.activados);
          metasPeriodoMap.set(per, cur);
        });
        const metasPorMes = [...metasPeriodoMap.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([periodo, v]) => ({ periodo, ano: Number(periodo.slice(0, 4)), mes: Number(periodo.slice(5, 7)), meta: v.meta, activados: v.activados }));
        const periodoMetaActual = metasPorMes.length > 0 ? metasPorMes[metasPorMes.length - 1].periodo : null;
        const metaActualRow = metasPorMes.length > 0 ? metasPorMes[metasPorMes.length - 1] : null;
        const metaMesActual = metaActualRow ? metaActualRow.meta : 0;
        const activadosGridActual = metaActualRow ? metaActualRow.activados : 0;
        const activadosMesActual = activadosGridActual > 0 ? activadosGridActual : activadosClientesActual;

        // 3. Estructuras de agregación histórica
        const periodosDisponibles = [...periodos].sort((a: any, b: any) => a.ano - b.ano || a.mes - b.mes);
        const sortedPeriodos = mesesFiltro
          ? periodosDisponibles.filter((p: any) => mesesFiltro.has(`${p.ano}-${p.mes}`))
          : periodosDisponibles;
        const mesAggMap = new Map<string, {
          ano: number;
          mes: number;
          clientCajas: Map<string, number>;
          skusSet: Set<string>;
          cajas: number;
          unidades: number;
          kgs: number;
        }>();

        sortedPeriodos.forEach((p: any) => {
          mesAggMap.set(`${p.ano}-${p.mes}`, {
            ano: p.ano,
            mes: p.mes,
            clientCajas: new Map(),
            skusSet: new Set(),
            cajas: 0,
            unidades: 0,
            kgs: 0
          });
        });

        const skuAggMap = new Map<string, {
          sku: string;
          articulo: string;
          totalCajas: number;
          totalUnidades: number;
          totalKgs: number;
          allClients: Map<string, number>;
          porMes: Map<string, { cajas: number; kgs: number; clientCajas: Map<string, number> }>;
        }>();

        const cliAggMap = new Map<string, {
          id: string;
          cliente: string;
          vendedor: string;
          totalCajas: number;
          totalKgs: number;
          porMes: Map<string, { cajas: number; kgs: number }>;
        }>();

        // Inicializar clientes de cartera en cliAggMap para tener visión 360 completa
        carteraMap.forEach((cInfo, normId) => {
          cliAggMap.set(normId, {
            id: cInfo.rawId.padStart(6, '0'),
            cliente: cInfo.nombre,
            vendedor: cInfo.vendedor,
            totalCajas: 0,
            totalKgs: 0,
            porMes: new Map()
          });
        });

        rows.forEach((r: any) => {
          const pKey = `${r.ano}-${r.mes}`;
          let mAgg = mesAggMap.get(pKey);
          if (!mAgg) {
            mAgg = { ano: r.ano, mes: r.mes, clientCajas: new Map(), skusSet: new Set(), cajas: 0, unidades: 0, kgs: 0 };
            mesAggMap.set(pKey, mAgg);
          }

          const normCid = String(r.id_cliente || '').trim().replace(/^#/, '').replace(/^0+/, '');
          const cajas = nz(r.cajas);
          const unidades = nz(r.unidades);
          const kgs = nz(r.kgs);
          const sku = String(r.id_articulo || '').trim();

          mAgg.cajas += cajas;
          mAgg.unidades += unidades;
          mAgg.kgs += kgs;
          if (normCid) {
            mAgg.clientCajas.set(normCid, (mAgg.clientCajas.get(normCid) || 0) + cajas);
          }
          if (sku && cajas > 0) {
            mAgg.skusSet.add(sku);
          }

          // SKU Aggregation
          if (sku) {
            let sAgg = skuAggMap.get(sku);
            if (!sAgg) {
              sAgg = {
                sku,
                articulo: String(r.articulo || sku).trim(),
                totalCajas: 0,
                totalUnidades: 0,
                totalKgs: 0,
                allClients: new Map(),
                porMes: new Map()
              };
              skuAggMap.set(sku, sAgg);
            }
            sAgg.totalCajas += cajas;
            sAgg.totalUnidades += unidades;
            sAgg.totalKgs += kgs;
            if (normCid) {
              sAgg.allClients.set(normCid, (sAgg.allClients.get(normCid) || 0) + cajas);
            }
            let sm = sAgg.porMes.get(pKey);
            if (!sm) {
              sm = { cajas: 0, kgs: 0, clientCajas: new Map() };
              sAgg.porMes.set(pKey, sm);
            }
            sm.cajas += cajas;
            sm.kgs += kgs;
            if (normCid) {
              sm.clientCajas.set(normCid, (sm.clientCajas.get(normCid) || 0) + cajas);
            }
          }

          // Client Aggregation
          if (normCid) {
            let cAgg = cliAggMap.get(normCid);
            if (!cAgg) {
              cAgg = {
                id: String(r.id_cliente || normCid).trim(),
                cliente: String(r.cliente || '').trim(),
                vendedor: String(r.vendedor || '').trim(),
                totalCajas: 0,
                totalKgs: 0,
                porMes: new Map()
              };
              cliAggMap.set(normCid, cAgg);
            } else {
              if (!cAgg.cliente && r.cliente) cAgg.cliente = String(r.cliente).trim();
              if (!cAgg.vendedor && r.vendedor) cAgg.vendedor = String(r.vendedor).trim();
            }
            cAgg.totalCajas += cajas;
            cAgg.totalKgs += kgs;
            let cm = cAgg.porMes.get(pKey);
            if (!cm) {
              cm = { cajas: 0, kgs: 0 };
              cAgg.porMes.set(pKey, cm);
            }
            cm.cajas += cajas;
            cm.kgs += kgs;
          }
        });

        // 4. Construir arreglo mensual ordenado con variaciones
        const mesesList: any[] = [];
        const orderedMesAggs = [...mesAggMap.values()].sort((a, b) => a.ano - b.ano || a.mes - b.mes);
        orderedMesAggs.forEach((mAgg, idx) => {
          let clientesActivados = 0;
          let clientesEnCartera = 0;
          let clientesFueraCartera = 0;
          mAgg.clientCajas.forEach((netCajas, cid) => {
            if (netCajas > 0) {
              clientesActivados++;
              if (carteraMap.has(cid)) clientesEnCartera++;
              else clientesFueraCartera++;
            }
          });
          // La variación solo se calcula contra el mes calendario inmediatamente anterior (si está visible)
          const prevCand = idx > 0 ? mesesList[idx - 1] : null;
          const prev = prevCand && (mAgg.ano * 12 + mAgg.mes) - (prevCand.ano * 12 + prevCand.mes) === 1 ? prevCand : null;
          const variacionClientes = prev !== null ? clientesActivados - prev.clientesActivados : null;
          const variacionPct = prev !== null && prev.clientesActivados > 0
            ? +(((clientesActivados - prev.clientesActivados) / prev.clientesActivados) * 100).toFixed(1)
            : null;
          const porcentajeCartera = carteraTotal > 0 ? +((clientesActivados / carteraTotal) * 100).toFixed(1) : 0;
          const metaReg = metasPeriodoMap.get(`${mAgg.ano}-${String(mAgg.mes).padStart(2, '0')}`);

          mesesList.push({
            ano: mAgg.ano,
            mes: mAgg.mes,
            clientesActivados,
            clientesEnCartera,
            clientesFueraCartera,
            porcentajeCartera,
            variacionClientes,
            variacionPct,
            cajas: +mAgg.cajas.toFixed(2),
            unidades: +mAgg.unidades.toFixed(2),
            kgs: +mAgg.kgs.toFixed(2),
            skusActivos: mAgg.skusSet.size,
            kgsPorCliente: clientesActivados > 0 ? +(mAgg.kgs / clientesActivados).toFixed(2) : 0,
            meta: metaReg ? metaReg.meta : null
          });
        });

        // 5. Construir arreglo de SKUs del rubro
        const skusList = [...skuAggMap.values()]
          .map(s => {
            const porMesObj: Record<string, { cajas: number; kgs: number; clientes: number }> = {};
            let mesesActivos = 0;
            s.porMes.forEach((sm, pk) => {
              let cliAct = 0;
              sm.clientCajas.forEach(c => { if (c > 0) cliAct++; });
              if (sm.cajas > 0) mesesActivos++;
              porMesObj[pk] = {
                cajas: +sm.cajas.toFixed(2),
                kgs: +sm.kgs.toFixed(2),
                clientes: cliAct
              };
            });
            let clientesUnicos = 0;
            s.allClients.forEach(c => { if (c > 0) clientesUnicos++; });
            return {
              sku: s.sku,
              articulo: s.articulo,
              totalCajas: +s.totalCajas.toFixed(2),
              totalUnidades: +s.totalUnidades.toFixed(2),
              totalKgs: +s.totalKgs.toFixed(2),
              clientesUnicos,
              mesesActivos,
              porMes: porMesObj
            };
          })
          .sort((a, b) => b.totalKgs - a.totalKgs || b.totalCajas - a.totalCajas);

        // 6. Construir matriz 360° de clientes en este rubro
        const totalMesesDisponibles = mesesList.length || 1;
        let clientesUnicosHistorico = 0;
        let clientesHabituales = 0;
        let oportunidadRecuperacion = 0;
        let reactivadosEsteMes = 0;
        let nuevosEsteMes = 0;

        const allClientesList = [...cliAggMap.entries()].map(([normId, c]) => {
          const cartInfo = carteraMap.get(normId);
          const enCartera = !!cartInfo;
          const activoMesActual = !!cartInfo?.activoActual;
          const porMesObj: Record<string, { cajas: number; kgs: number; activo: boolean }> = {};
          let mesesActivados = 0;
          let ultimoMesCompra: { ano: number; mes: number } | null = null;

          orderedMesAggs.forEach(mAgg => {
            const pk = `${mAgg.ano}-${mAgg.mes}`;
            const cm = c.porMes.get(pk);
            const cajas = cm ? +cm.cajas.toFixed(2) : 0;
            const kgs = cm ? +cm.kgs.toFixed(2) : 0;
            const activo = cajas > 0;
            if (activo) {
              mesesActivados++;
              ultimoMesCompra = { ano: mAgg.ano, mes: mAgg.mes };
            }
            if (cajas !== 0 || kgs !== 0) {
              porMesObj[pk] = { cajas, kgs, activo };
            }
          });

          if (mesesActivados > 0) clientesUnicosHistorico++;
          if (mesesActivados >= Math.max(1, Math.min(3, totalMesesDisponibles))) clientesHabituales++;

          let estado360: 'REACTIVADO_ESTE_MES' | 'NUEVO_ESTE_MES' | 'OPORTUNIDAD_RECUPERACION' | 'SIN_HISTORIAL' | 'FUERA_CARTERA';
          if (mesesActivados > 0 && activoMesActual) {
            estado360 = 'REACTIVADO_ESTE_MES';
            reactivadosEsteMes++;
          } else if (mesesActivados === 0 && activoMesActual) {
            estado360 = 'NUEVO_ESTE_MES';
            nuevosEsteMes++;
          } else if (mesesActivados > 0 && !activoMesActual && enCartera) {
            estado360 = 'OPORTUNIDAD_RECUPERACION';
            oportunidadRecuperacion++;
          } else if (!enCartera) {
            estado360 = 'FUERA_CARTERA';
          } else {
            estado360 = 'SIN_HISTORIAL';
          }

          return {
            id: c.id,
            cliente: c.cliente,
            vendedor: c.vendedor,
            enCartera,
            activoMesActual,
            mesesActivados,
            totalMesesDisponibles,
            frecuenciaPct: +((mesesActivados / totalMesesDisponibles) * 100).toFixed(0),
            ultimoMesCompra,
            totalCajas: +c.totalCajas.toFixed(2),
            totalKgs: +c.totalKgs.toFixed(2),
            estado360,
            porMes: porMesObj
          };
        });

        // Ordenar priorizando oportunidades de recuperación y mayor frecuencia histórica
        const estadoPriority: Record<string, number> = {
          OPORTUNIDAD_RECUPERACION: 1,
          REACTIVADO_ESTE_MES: 2,
          NUEVO_ESTE_MES: 3,
          FUERA_CARTERA: 4,
          SIN_HISTORIAL: 5
        };
        allClientesList.sort((a, b) =>
          (estadoPriority[a.estado360] || 9) - (estadoPriority[b.estado360] || 9) ||
          b.mesesActivados - a.mesesActivados ||
          b.totalKgs - a.totalKgs
        );

        // Si es ADMIN global (miles de clientes), enviar todos los que tienen actividad histórica o actual + primeros 300 sin historial
        const clientesList = scope.all
          ? allClientesList.filter((c, i) => c.mesesActivados > 0 || c.activoMesActual || i < 600)
          : allClientesList;

        // 7. Resumen ejecutivo 360°
        const totalCajasHistorico = +mesesList.reduce((acc, m) => acc + m.cajas, 0).toFixed(2);
        const totalKgsHistorico = +mesesList.reduce((acc, m) => acc + m.kgs, 0).toFixed(2);
        const nMeses = mesesList.length || 1;
        const promedioClientesMes = +(mesesList.reduce((acc, m) => acc + m.clientesActivados, 0) / nMeses).toFixed(1);
        const promedioCajasMes = +(totalCajasHistorico / nMeses).toFixed(1);
        const promedioKgsMes = +(totalKgsHistorico / nMeses).toFixed(1);

        const sortedByCli = [...mesesList].sort((a, b) => b.clientesActivados - a.clientesActivados || b.kgs - a.kgs);
        const mejorMes = sortedByCli.length > 0 ? sortedByCli[0] : null;
        const peorMes = sortedByCli.length > 0 ? sortedByCli[sortedByCli.length - 1] : null;

        return {
          rubro: rubroCode,
          periodos: sortedPeriodos,
          periodosDisponibles,
          carteraTotal,
          activadosMesActual,
          metaMesActual,
          periodoMetaActual,
          metasPorMes,
          meses: mesesList,
          skus: skusList,
          clientes: clientesList,
          resumen: {
            totalMeses: mesesList.length,
            promedioClientesMes,
            promedioCajasMes,
            promedioKgsMes,
            mejorMes: mejorMes ? { ano: mejorMes.ano, mes: mejorMes.mes, clientesActivados: mejorMes.clientesActivados, kgs: mejorMes.kgs, cajas: mejorMes.cajas } : null,
            peorMes: peorMes ? { ano: peorMes.ano, mes: peorMes.mes, clientesActivados: peorMes.clientesActivados, kgs: peorMes.kgs, cajas: peorMes.cajas } : null,
            totalCajasHistorico,
            totalKgsHistorico,
            clientesUnicosHistorico,
            clientesHabituales,
            oportunidadRecuperacion,
            reactivadosEsteMes,
            nuevosEsteMes
          }
        };
      });

      res.json(result);
    } catch (e) { histFail(res, e); }
  });

  const hydrateParsedCachesFromWorkbookFallback = async (
    scope: 'all' | 'volumen' | 'activacion' | 'metas' = 'all'
  ) => {
    let loaded: { workbook: any; sha256: string; source: 'live_google_sheet' | 'local_backup' } | null =
      await loadWorkbookTransient(false);
    try {
      const XLSX = await import('xlsx');
      const parsed = parseWorkbookFull(XLSX, loaded.workbook, {
        periodo: metasPeriodoActual(),
        masterClients: loadLocalMasterClientSeed()
      });
      const updateAll = scope === 'all' || lastSheetSource === 'live_google_sheet';
      if (updateAll || scope === 'volumen') {
        cachedVolumenParsed = parsed.volumenApiRows;
        lastVolumenParsedTime = Date.now();
      }
      if (updateAll || scope === 'activacion') {
        cachedActivacionParsed = parsed.activacionApiRows;
        lastActivacionParsedTime = Date.now();
      }
      if (updateAll || scope === 'metas') {
        cachedMetasParsed = parsed.metasApiRows;
        lastMetasParsedTime = Date.now();
      }
      lastSheetMetrics = parsed.metrics;
      lastSheetWarnings = parsed.warnings;
      lastSheetAuditLogs = parsed.auditLogs;
      lastSheetDataQuality = parsed.dataQuality || null;
      lastLiveProductMaps = parsed.productMaps;

      // Evaluar hashes SHA-256 numéricos por vendedor (en arranque frío solo registra versión 1 sin toast)
      applySellerNumericDiffAndBroadcast(parsed);
      return parsed;
    } finally {
      if (loaded) loaded.workbook = null;
      loaded = null;
    }
  };

  const resolveDataFilter = (user: any, queryVendedor: any) => {
    const supProfile = getSupervisorProfile(user?.username);
    const effectiveRole = supProfile ? 'SUPERVISOR' : String(user?.role || '').toUpperCase();
    const rawQuery = String(queryVendedor || '').trim();
    const rawUpper = rawQuery.toUpperCase();

    if (effectiveRole === 'SUPERVISOR') {
      const supName = supProfile?.canonicalUsername || String(user?.username || '').toUpperCase().trim();
      if (!rawUpper || rawUpper === 'SUPERVISOR_ALL' || rawUpper === 'ALL_MY_ROUTES' || rawUpper.startsWith('SUPERVISOR:')) {
        return {
          vendorFilter: `SUPERVISOR:${supName}`,
          allowedAliases: getSupervisedAliases(supName)
        };
      }
      const target = rawUpper.replace(/^CONSOLIDATED:/i, '').trim();
      const supRoutes = getSupervisedRoutes(supName);
      const matchedRoute = supRoutes.find(r => matchesVendorAlias([r.id, ...r.aliases], target));
      if (matchedRoute) {
        return {
          vendorFilter: matchedRoute.id,
          allowedAliases: [matchedRoute.id, ...matchedRoute.aliases]
        };
      }
      if (supProfile?.supervisedVendors.some(v => matchesVendorAlias([v], target))) {
        const prof = getVendorProfile(target);
        return {
          vendorFilter: target,
          allowedAliases: prof.routes.flatMap(r => [r.id, ...r.aliases, prof.canonicalUsername, prof.displayName])
        };
      }
      return {
        vendorFilter: `SUPERVISOR:${supName}`,
        allowedAliases: getSupervisedAliases(supName)
      };
    }

    if (effectiveRole === 'VENDEDOR') {
      const prof = getVendorProfile(user?.username || '');
      return {
        vendorFilter: (user?.username || '').toUpperCase().trim(),
        allowedAliases: prof.routes.flatMap(r => [r.id, ...r.aliases, prof.canonicalUsername, prof.displayName])
      };
    }

    // ADMIN
    if (!rawUpper || rawUpper === 'ADMIN' || rawUpper === 'TODOS' || rawUpper === 'ALL_MY_ROUTES') {
      return { vendorFilter: null, allowedAliases: [] as string[] };
    }
    if (rawUpper.startsWith('SUPERVISOR:')) {
      const supName = rawUpper.slice('SUPERVISOR:'.length).trim();
      return {
        vendorFilter: rawUpper,
        allowedAliases: getSupervisedAliases(supName)
      };
    }
    const cleanParam = rawUpper.replace(/^CONSOLIDATED:/i, '').trim();
    const prof = getVendorProfile(cleanParam);
    return {
      vendorFilter: cleanParam,
      allowedAliases: prof.routes.flatMap(r => [r.id, ...r.aliases, prof.canonicalUsername, prof.displayName])
    };
  };

  app.get("/api/data/volumen", authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user;
      const force = req.query.force === 'true';
      const { vendorFilter, allowedAliases } = resolveDataFilter(user, req.query.vendedor);

      const isPrivilegedUser = user?.role === 'ADMIN' || Boolean(getSupervisorProfile(user?.username));

      const filterByVendor = (list: any[]) => {
        const nonSupervisorList = list.filter(
          (d) => !SUPERVISOR_SUMMARY_COLUMNS.has(normalizeVendorKey(d.vendedorKey || d.vendedorId))
        );
        if (!vendorFilter || vendorFilter === 'ADMIN' || vendorFilter === 'TODOS') return nonSupervisorList;
        const matchTargets = [vendorFilter, ...allowedAliases].filter(Boolean);
        return nonSupervisorList.filter((d) => {
          return (
            matchesVendorAlias(matchTargets, d.vendedorKey) ||
            matchesVendorAlias(matchTargets, d.vendedorId) ||
            matchesVendorAlias(matchTargets, d.vendedorNombre)
          );
        });
      };

      if (force && isPrivilegedUser) {
        await runCoalescedSheetsSync(false, String(user?.username || 'SUPERVISOR'));
        setNoCacheSyncHeaders(res);
        return res.json(filterByVendor(cachedVolumenParsed || []));
      }

      if (!force && cachedVolumenParsed && (Date.now() - lastVolumenParsedTime < PARSED_DATA_TTL)) {
        setNoCacheSyncHeaders(res, 'memory');
        return res.json(filterByVendor(cachedVolumenParsed));
      }

      if (supabase) {
        try {
          let supaRows: any[] = [];
          let from = 0;
          const pageSize = 1000;
          while (from < 10000) {
            const { data, error } = await supabase.from('ventas_volumen').select('*').eq('periodo', metasPeriodoActual()).order('id').range(from, from + pageSize - 1);
            if (error || !data || data.length === 0) break;
            supaRows.push(...data);
            if (data.length < pageSize) break;
            from += pageSize;
          }
          if (Array.isArray(supaRows) && supaRows.length > 0) {
            const mapped = supaRows.map(r => {
              const metaKg = parseSafeNumber(r.meta_kg, 0);
              const ventaNetaKg = r.venta_neta_kg !== undefined && r.venta_neta_kg !== null
                ? parseSafeNumber(r.venta_neta_kg, 0)
                : parseSafeNumber(r.ejecutado_kg, 0);
              const ventaBrutaKg = r.venta_bruta_kg !== undefined && r.venta_bruta_kg !== null
                ? parseSafeNumber(r.venta_bruta_kg, 0)
                : (ventaNetaKg > 0 ? ventaNetaKg : 0);
              const devolucionesKg = r.devoluciones_kg !== undefined && r.devoluciones_kg !== null
                ? parseSafeNumber(r.devoluciones_kg, 0)
                : (ventaNetaKg < 0 ? ventaNetaKg : 0);
              const pctCumpl = r.porcentaje_cumplimiento !== undefined && r.porcentaje_cumplimiento !== null
                ? parseSafeNumber(r.porcentaje_cumplimiento, Number.NaN)
                : null;
              return {
                id: String(r.id),
                sku: r.sku,
                skuId: r.sku,
                articulo: r.articulo,
                categoria: r.categoria,
                vendedorId: r.vendedor_id,
                vendedorKey: r.vendedor_key || normalizeVendorKey(r.vendedor_id),
                vendedorNombre: r.vendedor_nombre,
                vendedorEmail: undefined,
                cliente: r.vendedor_nombre || 'General',
                meta: metaKg,
                metaKg,
                ejecutado: ventaNetaKg,
                ejecutadoKg: ventaNetaKg,
                ventaBrutaKg,
                devolucionesKg,
                ventaNetaKg,
                porcentajeCumplimiento: pctCumpl !== null && Number.isFinite(pctCumpl) ? pctCumpl : null,
                zona: r.zona || 'General'
              };
            });
            cachedVolumenParsed = mapped;
            lastVolumenParsedTime = Date.now();
            setNoCacheSyncHeaders(res, 'supabase');
            return res.json(filterByVendor(mapped));
          }
        } catch (e) {}
      }

      const parsed = await hydrateParsedCachesFromWorkbookFallback('volumen');
      setNoCacheSyncHeaders(res);
      res.json(filterByVendor(parsed.volumenApiRows));
    } catch (err: any) {
      console.error("Error parsing volume data:", err);
      res.status(500).json([]);
    }
  });

  app.get("/api/data/activacion", authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user;
      const force = req.query.force === 'true';
      const { vendorFilter, allowedAliases } = resolveDataFilter(user, req.query.vendedor);

      const isPrivilegedUser = user?.role === 'ADMIN' || Boolean(getSupervisorProfile(user?.username));

      const filterByVendor = (list: any[]) => {
        if (!vendorFilter || vendorFilter === 'ADMIN' || vendorFilter === 'TODOS') return list;
        const matchTargets = [vendorFilter, ...allowedAliases].filter(Boolean);
        return list.filter((d) => {
          return (
            matchesVendorAlias(matchTargets, d.vendedorKey) ||
            matchesVendorAlias(matchTargets, d.vendedorId) ||
            matchesVendorAlias(matchTargets, d.vendedorNombre)
          );
        });
      };

      if (force && isPrivilegedUser) {
        await runCoalescedSheetsSync(false, String(user?.username || 'SUPERVISOR'));
        setNoCacheSyncHeaders(res);
        return res.json(filterByVendor(cachedActivacionParsed || []));
      }

      if (!force && cachedActivacionParsed && (Date.now() - lastActivacionParsedTime < PARSED_DATA_TTL)) {
        setNoCacheSyncHeaders(res, 'memory');
        return res.json(filterByVendor(cachedActivacionParsed));
      }

      if (supabase) {
        try {
          const colsNuevasOk = await activacionTieneColumnasNuevas();
          let supaRows: any[] = [];
          let from = 0;
          const pageSize = 1000;
          while (from < 10000) {
            const { data, error } = await supabase
              .from('activacion_clientes')
              .select('*')
              .order('id', { ascending: true })
              .range(from, from + pageSize - 1);
            if (error || !data || data.length === 0) break;
            supaRows.push(...data);
            if (data.length < pageSize) break;
            from += pageSize;
          }
          if (Array.isArray(supaRows) && supaRows.length > 0) {
            const byClientMap = new Map<string, any>();
            for (const r of supaRows) {
              const rawVid = String(r.vendedor_id || '').trim();
              if (
                rawVid.toUpperCase().startsWith('INACTIVO_MAESTRA::') ||
                String(r.status || '').toUpperCase() === 'BAJA_MAESTRA' ||
                r.activo === false
              ) {
                continue;
              }
              const cid = String(r.cliente_codigo || '').replace(/#\d+$/, '').trim();
              if (!cid) continue;
              const canonicalCid = cid.replace(/^0+/, '') || '0';
              const vNorm = normalizeVendorName(r.vendedor_nombre || r.vendedor_id);
              const vKey = r.vendedor_key || normalizeVendorKey(r.vendedor_nombre || r.vendedor_id);
              const compKey = `${vNorm}::${cid}`;

              const liveLecheCajas = !colsNuevasOk && lastLiveProductMaps?.LECHE_VENCAMPO
                ? (lastLiveProductMaps.LECHE_VENCAMPO.get(canonicalCid) ?? lastLiveProductMaps.LECHE_VENCAMPO.get(cid) ?? 0)
                : 0;
              const liveMortAstCajas = !colsNuevasOk && lastLiveProductMaps?.MORTADELA_ASTURIAS
                ? (lastLiveProductMaps.MORTADELA_ASTURIAS.get(canonicalCid) ?? lastLiveProductMaps.MORTADELA_ASTURIAS.get(cid) ?? 0)
                : 0;
              const liveSalpNuevoCajas = !colsNuevasOk && lastLiveProductMaps?.SALPICAO
                ? (lastLiveProductMaps.SALPICAO.get(canonicalCid) ?? lastLiveProductMaps.SALPICAO.get(cid) ?? 0)
                : 0;

              const cAceite = parseSafeNumber(r.cajas_aceite, 0);
              const cAzucar = parseSafeNumber(r.cajas_azucar, 0);
              const cPollo = parseSafeNumber(r.cajas_pollo, 0);
              const cAsturias = parseSafeNumber(r.cajas_estandar_asturias, 0);
              const cSalpicao = parseSafeNumber(r.cajas_mortadela_salpicao, 0);
              const cLeche = colsNuevasOk ? parseSafeNumber(r.cajas_leche_vencampo, 0) : liveLecheCajas;
              const cMortAst = colsNuevasOk ? parseSafeNumber(r.cajas_mortadela_asturias, 0) : liveMortAstCajas;
              const cSalpNuevo = colsNuevasOk ? parseSafeNumber(r.cajas_salpicao, 0) : liveSalpNuevoCajas;

              const hasAceite = Boolean(r.has_aceite) || cAceite > 0;
              const hasAzucar = Boolean(r.has_azucar) || cAzucar > 0;
              const hasPollo = Boolean(r.has_pollo) || cPollo > 0;
              const hasAsturias = Boolean(r.has_estandar_asturias) || cAsturias > 0;
              const hasSalpicao = Boolean(r.has_mortadela_salpicao) || cSalpicao > 0;
              const hasLeche = (colsNuevasOk && Boolean(r.has_leche_vencampo)) || cLeche > 0;
              const hasMortAst = (colsNuevasOk && Boolean(r.has_mortadela_asturias)) || cMortAst > 0;
              const hasSalpNuevo = (colsNuevasOk && Boolean(r.has_salpicao)) || cSalpNuevo > 0;

              if (!byClientMap.has(compKey)) {
                const entry = {
                  id: cid,
                  cliente: r.cliente_nombre,
                  vendedorId: r.vendedor_id,
                  vendedorKey: vKey,
                  vendedorNombre: r.vendedor_nombre,
                  status: 'INACTIVO' as 'ACTIVO' | 'INACTIVO',
                  cajas: {
                    ACEITE: cAceite,
                    AZUCAR: cAzucar,
                    POLLO: cPollo,
                    ESTANDAR_ASTURIAS: cAsturias,
                    MORTADELA_SALPICAO: cSalpicao,
                    LECHE_VENCAMPO: cLeche,
                    MORTADELA_ASTURIAS: cMortAst,
                    SALPICAO: cSalpNuevo
                  },
                  cats: {
                    ACEITE: hasAceite,
                    AZUCAR: hasAzucar,
                    POLLO: hasPollo,
                    ESTANDAR_ASTURIAS: hasAsturias,
                    MORTADELA_SALPICAO: hasSalpicao,
                    LECHE_VENCAMPO: hasLeche,
                    MORTADELA_ASTURIAS: hasMortAst,
                    SALPICAO: hasSalpNuevo,
                    ARROZ: hasPollo,
                    ENTERO: hasAsturias,
                    LIGEROS: hasSalpicao
                  }
                };
                entry.status = (isClientActiveInAnyFocusProduct(entry) || r.status === 'ACTIVO') ? 'ACTIVO' : 'INACTIVO';
                byClientMap.set(compKey, entry);
              } else {
                const prev = byClientMap.get(compKey);
                prev.cats.ACEITE = prev.cats.ACEITE || hasAceite;
                prev.cats.AZUCAR = prev.cats.AZUCAR || hasAzucar;
                prev.cats.POLLO = prev.cats.POLLO || hasPollo;
                prev.cats.ESTANDAR_ASTURIAS = prev.cats.ESTANDAR_ASTURIAS || hasAsturias;
                prev.cats.MORTADELA_SALPICAO = prev.cats.MORTADELA_SALPICAO || hasSalpicao;
                prev.cats.LECHE_VENCAMPO = prev.cats.LECHE_VENCAMPO || hasLeche;
                prev.cats.MORTADELA_ASTURIAS = prev.cats.MORTADELA_ASTURIAS || hasMortAst;
                prev.cats.SALPICAO = prev.cats.SALPICAO || hasSalpNuevo;
                prev.cats.ARROZ = prev.cats.POLLO;
                prev.cats.ENTERO = prev.cats.ESTANDAR_ASTURIAS;
                prev.cats.LIGEROS = prev.cats.MORTADELA_SALPICAO;
                prev.cajas.ACEITE = Math.max(prev.cajas.ACEITE, cAceite);
                prev.cajas.AZUCAR = Math.max(prev.cajas.AZUCAR, cAzucar);
                prev.cajas.POLLO = Math.max(prev.cajas.POLLO, cPollo);
                prev.cajas.ESTANDAR_ASTURIAS = Math.max(prev.cajas.ESTANDAR_ASTURIAS, cAsturias);
                prev.cajas.MORTADELA_SALPICAO = Math.max(prev.cajas.MORTADELA_SALPICAO, cSalpicao);
                prev.cajas.LECHE_VENCAMPO = Math.max(prev.cajas.LECHE_VENCAMPO || 0, cLeche);
                prev.cajas.MORTADELA_ASTURIAS = Math.max(prev.cajas.MORTADELA_ASTURIAS || 0, cMortAst);
                prev.cajas.SALPICAO = Math.max(prev.cajas.SALPICAO || 0, cSalpNuevo);
                if (isClientActiveInAnyFocusProduct(prev)) {
                  prev.status = 'ACTIVO';
                }
              }
            }
            const mapped = Array.from(byClientMap.values());
            cachedActivacionParsed = mapped;
            lastActivacionParsedTime = Date.now();
            setNoCacheSyncHeaders(res, 'supabase');
            return res.json(filterByVendor(mapped));
          }
        } catch (e) {}
      }

      const parsed = await hydrateParsedCachesFromWorkbookFallback('activacion');
      setNoCacheSyncHeaders(res);
      res.json(filterByVendor(parsed.activacionApiRows));
    } catch (err) {
      console.error("Error in /api/data/activacion:", err);
      res.status(500).json([]);
    }
  });

  app.get("/api/catalog/vendors", async (req: any, res: any) => {
    try {
      let requestedSucursal: Sucursal | null = normalizeSucursal(
        req.headers?.['x-active-sucursal'] ?? req.query?.sucursal
      );

      // Si viene token JWT, respetar estrictamente la sucursal de la sesión (salvo ADMIN)
      const authHeader = req.headers?.['authorization'];
      const rawToken = authHeader && String(authHeader).startsWith('Bearer ') ? String(authHeader).split(' ')[1] : null;
      if (rawToken) {
        try {
          const decoded: any = jwt.verify(rawToken, JWT_SECRET);
          const roleUpper = String(decoded?.role || '').toUpperCase();
          const tokenSuc = normalizeSucursal(decoded?.sucursal) || 'OCCIDENTE';
          if (roleUpper !== 'ADMIN') {
            requestedSucursal = tokenSuc;
          } else if (!requestedSucursal) {
            requestedSucursal = tokenSuc;
          }
        } catch {}
      }

      let vendedores = getRuntimeSellerCatalog();
      let syncedAt: string | null = null;

      if (tradeSupabase) {
        try {
          const { data: tradeVend } = await tradeSupabase.from('vendedores').select('*');
          if (Array.isArray(tradeVend) && tradeVend.length > 0) {
            const mappedTrade = tradeVend.map((v: any) => ({
              vendedor_id: String(v.id ?? v.codigo ?? v.username ?? ''),
              codigo_erp: String(v.codigo ?? v.id ?? ''),
              nombre_canonico: normalizeVendorName(v.username || v.nombre),
              display_name: String(v.nombre || v.username || ''),
              ruta_oficial: normalizeVendorName(v.ruta || v.username || v.nombre),
              supervisor: normalizeVendorName(v.supervisor || ''),
              sucursal: normalizeSucursal(v.sucursal) || 'OCCIDENTE',
              region: normalizeSucursal(v.sucursal) || 'OCCIDENTE',
              role: (String(v.role || 'VENDEDOR').toUpperCase() as any),
              activo: v.activo !== false
            }));
            vendedores = hydrateRuntimeSellerCatalog(mappedTrade);
            hydrateVendorProfilesFromMasterCatalog(mappedTrade);
          }
        } catch {}
      }

      if (supabase) {
        try {
          const { data: supaVendedores } = await supabase.from('vendedores_maestro').select('*');
          if (Array.isArray(supaVendedores) && supaVendedores.length > 0) {
            vendedores = hydrateRuntimeSellerCatalog(supaVendedores);
            hydrateVendorProfilesFromMasterCatalog(supaVendedores);
          }
          const { data: syncMeta } = await supabase
            .from('catalog_sync_meta')
            .select('*')
            .eq('id', 'GLOBAL_MASTER_SYNC')
            .maybeSingle();
          if (syncMeta?.last_synced_at) {
            syncedAt = syncMeta.last_synced_at;
          }
        } catch {
          // Fallback al catálogo en memoria
        }
      }

      const filteredVendedores = requestedSucursal
        ? vendedores.filter((v) => (v.sucursal || normalizeSucursal(v.region) || 'OCCIDENTE') === requestedSucursal)
        : vendedores;

      setNoCacheSyncHeaders(res, 'supabase');
      return res.json({ vendedores: filteredVendedores, sucursal: requestedSucursal, syncedAt });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Error consultando catálogo de vendedores' });
    }
  });

  app.post("/api/data/activacion/toggle-rubro", authenticateToken, async (req: any, res: any) => {
    try {
      const { clienteCodigo, rubro, active } = req.body || {};
      const cleanCod = String(clienteCodigo || '').replace(/^[#\s]+/, '').trim();
      const normRubro = normalizeHistRubroCode(rubro);
      if (!cleanCod || !normRubro) {
        return res.status(400).json({ error: "clienteCodigo y rubro son requeridos" });
      }
      const boolActive = Boolean(active);

      const colMap: Record<string, string> = {
        ACEITE: 'has_aceite',
        AZUCAR: 'has_azucar',
        POLLO: 'has_pollo',
        ESTANDAR_ASTURIAS: 'has_estandar_asturias',
        MORTADELA_SALPICAO: 'has_mortadela_salpicao',
        LECHE_VENCAMPO: 'has_leche_vencampo',
        MORTADELA_ASTURIAS: 'has_mortadela_asturias',
        SALPICAO: 'has_salpicao',
      };
      const dbCol = colMap[normRubro];
      const colsNuevasOk = await activacionTieneColumnasNuevas();
      // Si la BD aún no tiene las columnas nuevas y se intenta marcar un rubro nuevo, avisar (no fallar en silencio)
      if (dbCol && !colsNuevasOk && NUEVOS_RUBROS_CODES.includes(normRubro)) {
        return res.status(412).json({ error: 'Faltan columnas en activacion_clientes. Ejecuta scripts/sql/03_rubros_noviembre_2026.sql en Supabase.', code: 'ESQUEMA_FALTANTE' });
      }

      if (supabase && dbCol) {
        const { data: rows } = await supabase
          .from('activacion_clientes')
          .select('*')
          .eq('cliente_codigo', cleanCod);

        if (Array.isArray(rows) && rows.length > 0) {
          for (const r of rows) {
            const nextState = {
              has_aceite: normRubro === 'ACEITE' ? boolActive : Boolean(r.has_aceite),
              has_azucar: normRubro === 'AZUCAR' ? boolActive : Boolean(r.has_azucar),
              has_pollo: normRubro === 'POLLO' ? boolActive : Boolean(r.has_pollo),
              has_estandar_asturias: normRubro === 'ESTANDAR_ASTURIAS' ? boolActive : Boolean(r.has_estandar_asturias),
              has_mortadela_salpicao: normRubro === 'MORTADELA_SALPICAO' ? boolActive : Boolean(r.has_mortadela_salpicao),
              ...(colsNuevasOk
                ? {
                    has_leche_vencampo: normRubro === 'LECHE_VENCAMPO' ? boolActive : Boolean(r.has_leche_vencampo),
                    has_mortadela_asturias: normRubro === 'MORTADELA_ASTURIAS' ? boolActive : Boolean(r.has_mortadela_asturias),
                    has_salpicao: normRubro === 'SALPICAO' ? boolActive : Boolean(r.has_salpicao)
                  }
                : {})
            };
            const isActivo = [nextState.has_azucar, nextState.has_pollo, nextState.has_estandar_asturias, nextState.has_mortadela_salpicao, (nextState as any).has_leche_vencampo].some(Boolean);
            await supabase
              .from('activacion_clientes')
              .update({
                ...nextState,
                status: isActivo ? 'ACTIVO' : 'INACTIVO',
              })
              .eq('id', r.id);
          }
        }
      }

      if (cachedActivacionParsed && Array.isArray(cachedActivacionParsed)) {
        cachedActivacionParsed.forEach((c: any) => {
          const cid = String(c.id || '').replace(/^[#\s]+/, '').trim();
          if (cid === cleanCod) {
            if (!c.cats) c.cats = {};
            c.cats[normRubro] = boolActive;
            if (normRubro === 'POLLO') c.cats.ARROZ = boolActive;
            if (normRubro === 'ESTANDAR_ASTURIAS') c.cats.ENTERO = boolActive;
            if (normRubro === 'MORTADELA_SALPICAO') c.cats.LIGEROS = boolActive;
            const anyActive = Boolean(
              c.cats.AZUCAR || c.cats.LECHE_VENCAMPO || c.cats.POLLO || c.cats.ESTANDAR_ASTURIAS || c.cats.MORTADELA_SALPICAO
            );
            c.status = anyActive ? 'ACTIVO' : 'INACTIVO';
          }
        });
      }

      setNoCacheSyncHeaders(res);
      return res.json({ success: true, clienteCodigo: cleanCod, rubro: normRubro, active: boolActive });
    } catch (err: any) {
      console.error("[SERVER] Error en /api/data/activacion/toggle-rubro:", err);
      return res.status(500).json({ error: "Error actualizando rubro del cliente", details: err?.message });
    }
  });

  app.get("/api/data/metas-activacion", authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user;
      const force = req.query.force === 'true';
      const { vendorFilter, allowedAliases } = resolveDataFilter(user, req.query.vendedor);

      const isPrivilegedUser = user?.role === 'ADMIN' || Boolean(getSupervisorProfile(user?.username));

      const filterByVendor = (list: any[]) => {
        if (!vendorFilter || vendorFilter === 'ADMIN' || vendorFilter === 'TODOS') return list;
        const matchTargets = [vendorFilter, ...allowedAliases].filter(Boolean);
        return list.filter((d) => {
          return (
            matchesVendorAlias(matchTargets, d.vendedorKey) ||
            matchesVendorAlias(matchTargets, d.vendedorId)
          );
        });
      };

      if (force && isPrivilegedUser) {
        await runCoalescedSheetsSync(false, String(user?.username || 'SUPERVISOR'));
        setNoCacheSyncHeaders(res);
        return res.json(filterByVendor(cachedMetasParsed || []));
      }

      if (!force && cachedMetasParsed && (Date.now() - lastMetasParsedTime < PARSED_DATA_TTL)) {
        setNoCacheSyncHeaders(res, 'memory');
        return res.json(filterByVendor(cachedMetasParsed));
      }

      if (supabase) {
        try {
          const { data, error } = await supabase.from('metas_activacion').select('*').eq('periodo', metasPeriodoActual());
          if (!error && data && data.length > 0) {
            const mapped = data.map((r: any) => ({
              vendedorId: r.vendedor_id,
              vendedorKey: r.vendedor_key || normalizeVendorKey(r.vendedor_id),
              categoria: r.categoria,
              cartera: Math.round(parseSafeNumber(r.cartera, 0)),
              meta: Math.round(parseSafeNumber(r.meta, 0)),
              activados: Math.round(parseSafeNumber(r.activados, 0))
            }));
            cachedMetasParsed = mapped;
            lastMetasParsedTime = Date.now();
            setNoCacheSyncHeaders(res, 'supabase');
            return res.json(filterByVendor(mapped));
          }
        } catch (e) {}
      }

      const parsed = await hydrateParsedCachesFromWorkbookFallback('metas');
      setNoCacheSyncHeaders(res);
      res.json(filterByVendor(parsed.metasApiRows));
    } catch(err) {
      console.error("Error in /api/data/metas-activacion:", err);
      res.status(500).json([]);
    }
  });

  // Almacén temporal en memoria para comprobantes compartidos desde WhatsApp (soporta archivos de hasta 10MB+ sin romper localStorage)
  const sharedReceiptsMemoryStore = new Map<string, {
    dataUrl: string;
    name: string;
    type: string;
    size: number;
    timestamp: number;
  }>();

  app.get('/api/shared-receipt-temp/:id', (req: any, res: any) => {
    const id = String(req.params.id || '').trim();
    const entry = sharedReceiptsMemoryStore.get(id);
    if (!entry) {
      return res.status(404).json({ error: 'Comprobante temporal expirado o ya consumido' });
    }
    sharedReceiptsMemoryStore.delete(id);
    return res.json(entry);
  });

  // Fallback Web Share Target endpoint (en caso de que el navegador envíe el POST directo al servidor antes de que el Service Worker lo intercepte)
  app.post('/share-target-cobro', express.raw({ type: '*/*', limit: '25mb' }), (req: any, res: any) => {
    try {
      const contentType = String(req.headers['content-type'] || '');
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);

      let dataUrl = '';
      let fileName = 'soporte_whatsapp.jpg';
      let mimeType = 'image/jpeg';
      let fileSize = 0;

      if (boundaryMatch && rawBody.length > 0) {
        const boundary = '--' + (boundaryMatch[1] || boundaryMatch[2]).trim();
        const latin = rawBody.toString('latin1');
        const parts = latin.split(boundary);
        for (const part of parts) {
          if (part.includes('filename=')) {
            const fnMatch = part.match(/filename="([^"]+)"/i);
            const ctMatch = part.match(/Content-Type:\s*([^\r\n]+)/i);
            const headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd !== -1) {
              if (fnMatch && fnMatch[1]) fileName = fnMatch[1];
              if (ctMatch && ctMatch[1]) mimeType = ctMatch[1].trim();
              let bodyLatin = part.slice(headerEnd + 4);
              if (bodyLatin.endsWith('\r\n')) bodyLatin = bodyLatin.slice(0, -2);
              const fileBuf = Buffer.from(bodyLatin, 'latin1');
              if (fileBuf.length > 0) {
                fileSize = fileBuf.length;
                const lowerFn = fileName.toLowerCase();
                if (lowerFn.endsWith('.pdf') || fileBuf.subarray(0, 4).toString('ascii') === '%PDF') {
                  mimeType = 'application/pdf';
                } else if (lowerFn.endsWith('.png')) {
                  mimeType = 'image/png';
                } else if (lowerFn.endsWith('.webp')) {
                  mimeType = 'image/webp';
                } else if (lowerFn.endsWith('.heic') || lowerFn.endsWith('.heif')) {
                  mimeType = 'image/heic';
                } else if (!mimeType || mimeType === 'application/octet-stream') {
                  mimeType = 'image/jpeg';
                }
                dataUrl = `data:${mimeType};base64,${fileBuf.toString('base64')}`;
                break;
              }
            }
          }
        }
      }

      const tempReceiptId = `rcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      if (dataUrl) {
        // Limpiar entradas antiguas (> 10 min)
        const now = Date.now();
        for (const [k, v] of sharedReceiptsMemoryStore.entries()) {
          if (now - v.timestamp > 10 * 60 * 1000) sharedReceiptsMemoryStore.delete(k);
        }
        sharedReceiptsMemoryStore.set(tempReceiptId, {
          dataUrl,
          name: fileName,
          type: mimeType,
          size: fileSize,
          timestamp: now,
        });
      }

      const payloadJson = JSON.stringify({
        dataUrl,
        name: fileName,
        type: mimeType,
        size: fileSize,
        receiptId: tempReceiptId,
        timestamp: Date.now(),
      });

      res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recibiendo comprobante de WhatsApp...</title></head>
<body style="background:#0a0a0a;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;gap:12px">
<div style="width:32px;height:32px;border:3px solid #10b981;border-top-color:transparent;border-radius:50%;animation:s 0.8s linear infinite"></div>
<style>@keyframes s{to{transform:rotate(360deg)}}</style>
<div style="font-size:14px;font-weight:bold;color:#10b981">Procesando soporte desde WhatsApp...</div>
<script>
(async function() {
  var payload = ${payloadJson};
  var targetUrl = '/?shared-receipt=1&receiptId=' + encodeURIComponent(payload.receiptId || '') + '#cobros';
  try {
    sessionStorage.setItem('fdv_pending_whatsapp_share', '1');
    if (payload.receiptId) {
      sessionStorage.setItem('fdv_shared_receipt_id', payload.receiptId);
    }
  } catch (e) {}

  try {
    if (payload && payload.dataUrl && payload.dataUrl.length < 3500000) {
      localStorage.setItem('fdv_shared_whatsapp_payload', JSON.stringify(payload));
    }
  } catch (e) {}

  try {
    if (payload && payload.dataUrl && window.indexedDB) {
      var res = await fetch(payload.dataUrl);
      var blob = await res.blob();
      await new Promise(function(resolve) {
        var req = indexedDB.open('fdv_whatsapp_share_db', 1);
        req.onupgradeneeded = function() {
          var db = req.result;
          if (!db.objectStoreNames.contains('shared_receipts')) {
            db.createObjectStore('shared_receipts', { keyPath: 'id' });
          }
        };
        req.onsuccess = function() {
          try {
            var db = req.result;
            var tx = db.transaction('shared_receipts', 'readwrite');
            tx.objectStore('shared_receipts').put({
              id: 'latest_shared_receipt',
              blob: blob,
              name: payload.name || 'soporte_whatsapp.jpg',
              type: payload.type || blob.type || 'image/jpeg',
              size: payload.size || blob.size || 0,
              timestamp: Date.now()
            });
            tx.oncomplete = function() { db.close(); resolve(true); };
            tx.onerror = function() { db.close(); resolve(false); };
          } catch (err) { resolve(false); }
        };
        req.onerror = function() { resolve(false); };
      });
    }
  } catch (e) {}

  window.location.replace(targetUrl);
})();
</script>
</body></html>`);
    } catch (err) {
      console.error('[SHARE TARGET] Error procesando archivo compartido:', err);
      res.redirect(303, '/?shared-receipt=error#cobros');
    }
  });

  const distPath = path.join(process.cwd(), 'dist');
  const distIndexExists = fs.existsSync(path.join(distPath, 'index.html'));

  // Servir estáticos de producción si se especificó production o si existe dist y no es el script dev
  const isDevMode = process.env.npm_lifecycle_event === 'dev' || process.env.NODE_ENV === 'development';

  if (!isDevMode && distIndexExists) {
    app.use(
      express.static(distPath, {
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
          const normalized = filePath.replace(/\\/g, '/');
          res.setHeader('X-App-Commit', APP_DEPLOY_COMMIT);
          if (
            normalized.endsWith('/index.html') ||
            normalized.endsWith('/sw.js') ||
            normalized.endsWith('/manifest.webmanifest')
          ) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          } else if (normalized.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        }
      })
    );
    app.get('*', (req, res) => {
      if (req.path.startsWith('/assets/')) {
        return res.status(404).end();
      }
      res.setHeader('X-App-Commit', APP_DEPLOY_COMMIT);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (vErr) {
      console.error("[SERVER] Error al inicializar Vite en modo desarrollo, usando fallback a dist:", vErr);
      if (distIndexExists) {
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
          if (req.path.startsWith('/assets/')) {
            return res.status(404).end();
          }
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }
    }
  }

  let activeHttpServer: ReturnType<typeof app.listen> | null = null;
  let shutdownRegistered = false;

  const registerGracefulShutdown = () => {
    if (shutdownRegistered) return;
    shutdownRegistered = true;

    const handleSignal = (signal: 'SIGTERM' | 'SIGINT') => {
      console.log(`[SERVER] Señal ${signal} recibida. Deteniendo planificador 60s, SSE y conexiones HTTP...`);
      sheetsScheduler.stop();
      if (webhookDebounceTimer) {
        clearTimeout(webhookDebounceTimer);
        webhookDebounceTimer = null;
      }
      for (const hb of sseHeartbeats) {
        clearInterval(hb);
      }
      sseHeartbeats.clear();
      for (const subscribers of sseSubscribers.values()) {
        for (const sseRes of subscribers) {
          try {
            sseRes.end();
          } catch {
            // no-op
          }
        }
      }
      sseSubscribers.clear();
      if (activeHttpServer) {
        const forceExit = setTimeout(() => process.exit(0), 5000);
        if (typeof (forceExit as any)?.unref === 'function') (forceExit as any).unref();
        activeHttpServer.close(() => {
          clearTimeout(forceExit);
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    process.once('SIGTERM', () => handleSignal('SIGTERM'));
    process.once('SIGINT', () => handleSignal('SIGINT'));
  };

  const tryListen = (portToTry: number) => {
    const serverInstance = app.listen(portToTry, "0.0.0.0", () => {
      activeHttpServer = serverInstance;
      console.log(`Server running on port ${portToTry}`);
      registerGracefulShutdown();

      // Iniciar planificador centralizado (sincronización inicial a los 3s y luego cada 60s con mutex + Last-Known-Good)
      sheetsScheduler.start({ initialDelayMs: 3000 });
    });

    serverInstance.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        const altPort = portToTry === 3000 ? 3005 : portToTry + 1;
        console.warn(`[SERVER] Puerto ${portToTry} ocupado por otra instancia. Intentando en puerto alternativo ${altPort}...`);
        tryListen(altPort);
      } else {
        console.error('[SERVER] Error en servidor HTTP:', err);
      }
    });
  };

  tryListen(PORT);
}

startServer().catch((err) => {
  console.error('[SERVER] Fallo al iniciar startServer:', err);
});
