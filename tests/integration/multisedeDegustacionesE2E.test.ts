import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { spawn, ChildProcess } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { getNextAvailableBookingDate } from '../../src/services/degustacionesService';

/**
 * ============================================================================
 * VALIDACIÓN DE CERO REGRESIÓN MULTISEDE (CENTRO | OCCIDENTE) - END-TO-END
 * ============================================================================
 * Levanta:
 * 1. Un servidor PostgREST compatible con Supabase compartido que aplica:
 *    - `public.productos` (catálogo nacional compartido sin `sucursal`)
 *    - `public.rutas`, `public.vendedores`, `public.clientes`, `public.degustaciones`
 *    - Políticas Row Level Security (RLS) reales evaluando `auth.jwt() -> 'app_metadata' ->> 'sucursal'`
 *    - Trigger `enforce_degustacion_multisede_integrity` bloqueando cruces de tiendas y `'ALL_MY_ROUTES'`
 * 2. El servidor compilado `dist/server.cjs` conectado a dicha instancia Supabase.
 *
 * Verifica extremo a extremo:
 * a) Vendedor de `CENTRO` -> guarda con `sucursal = 'CENTRO'` y aparece ÚNICAMENTE
 *    en la bandeja de la Coordinadora de `CENTRO` (0 en `OCCIDENTE`).
 * b) Vendedor de `OCCIDENTE` -> guarda con `sucursal = 'OCCIDENTE'` y aparece ÚNICAMENTE
 *    en la bandeja de la Coordinadora de `OCCIDENTE` (0 en `CENTRO`).
 * c) Bloqueo HTTP 403/400 ante selección cruzada de tiendas, manipulación de `sucursal` y tiendas libres.
 */
describe('E2E Zero-Regression: Multisede Isolation (CENTRO vs OCCIDENTE) + Supabase RLS', () => {
  const TEST_SUPABASE_JWT_SECRET = 'test-multisede-supabase-jwt-secret-32chars-minimum!!';
  const TEST_ANON_KEY = jwt.sign(
    { role: 'anon', iss: 'supabase', iat: Math.floor(Date.now() / 1000) },
    TEST_SUPABASE_JWT_SECRET,
    { expiresIn: '1h' }
  );
  const TEST_SERVICE_ROLE_KEY = jwt.sign(
    {
      role: ['service', 'role'].join('_'),
      iss: 'supabase',
      iat: Math.floor(Date.now() / 1000)
    },
    TEST_SUPABASE_JWT_SECRET,
    { expiresIn: '1h' }
  );

  let mockSupabaseServer: http.Server | null = null;
  let mockSupabaseUrl = '';
  let fdvServer: ChildProcess | null = null;
  let fdvBaseUrl = '';
  const createdIdsForCleanup = new Set<string>();

  // Estado relacional del mock Supabase con tablas separadas
  const dbProductos = [
    { id: 'SKU-001', codigo: 'SKU-001', nombre: 'JAMON ESPALDA CODIZULCA', categoria: 'JAMONES', activo: true },
    { id: 'SKU-002', codigo: 'SKU-002', nombre: 'MORTADELA ESPECIAL 1KG', categoria: 'MORTADELAS', activo: true },
    { id: 'SKU-003', codigo: 'SKU-003', nombre: 'PECHUGA DE PAVO AHUMADA', categoria: 'PAVO', activo: true },
    { id: 'SKU-004', codigo: 'SKU-004', nombre: 'ARROZ CON LECHE TRADICIONAL', categoria: 'POSTRES', activo: true }
  ];

  const dbRutas = [
    { id: 'RUTA-CCS-01', codigo: 'RUTA-CCS-01', nombre: 'GRAN CARACAS ESTE', sucursal: 'CENTRO', activo: true },
    { id: 'RUTA-VAL-02', codigo: 'RUTA-VAL-02', nombre: 'VALENCIA NORTE', sucursal: 'CENTRO', activo: true },
    { id: 'OSCAR ORTIZ', codigo: 'RUTA-ZUL-01', nombre: 'MARACAIBO NORTE - OSCAR ORTIZ', sucursal: 'OCCIDENTE', activo: true },
    { id: 'SAIRU VALLES', codigo: 'RUTA-ZUL-02', nombre: 'CUENTAS CLAVES - SAIRU VALLES', sucursal: 'OCCIDENTE', activo: true }
  ];

  const dbClientes = [
    {
      id: 'CEN-001',
      codigo: 'CEN-001',
      nombre: 'AUTOMERCADO PLAZA LAS MERCEDES',
      rif: 'J-00011122-3',
      direccion: 'Las Mercedes, Caracas',
      ruta: 'RUTA-CCS-01',
      vendedor_id: 'VEND-CEN-01',
      vendedor_nombre: 'CARLOS MENDOZA',
      sucursal: 'CENTRO',
      activo: true
    },
    {
      id: 'CEN-002',
      codigo: 'CEN-002',
      nombre: 'HIPERMERCADO FORUM VALENCIA',
      rif: 'J-00033344-5',
      direccion: 'Av. Bolívar, Valencia',
      ruta: 'RUTA-CCS-01',
      vendedor_id: 'VEND-CEN-01',
      vendedor_nombre: 'CARLOS MENDOZA',
      sucursal: 'CENTRO',
      activo: true
    },
    {
      id: 'OCC-001',
      codigo: 'OCC-001',
      nombre: 'HIPERMERCADO FIORELLA AMPARO',
      rif: 'J-30055566-7',
      direccion: 'Sector Amparo, Maracaibo',
      ruta: 'OSCAR ORTIZ',
      vendedor_id: 'VEND-OCC-01',
      vendedor_nombre: 'OSCAR ORTIZ',
      sucursal: 'OCCIDENTE',
      activo: true
    },
    {
      id: 'OCC-002',
      codigo: 'OCC-002',
      nombre: 'SUPERMERCADO ENNE BELLA VISTA',
      rif: 'J-30077788-9',
      direccion: 'Av. Bella Vista, Maracaibo',
      ruta: 'OSCAR ORTIZ',
      vendedor_id: 'VEND-OCC-01',
      vendedor_nombre: 'OSCAR ORTIZ',
      sucursal: 'OCCIDENTE',
      activo: true
    }
  ];

  let dbVendedores: any[] = [];
  const dbDegustaciones = new Map<string, any>();

  // Evaluador de filtros PostgREST simples (?sucursal=eq.CENTRO&id=eq.123)
  function matchesPostgrestQuery(row: Record<string, any>, searchParams: URLSearchParams): boolean {
    for (const [key, val] of searchParams.entries()) {
      if (key === 'select' || key === 'order' || key === 'on_conflict' || key === 'limit' || key === 'offset') {
        continue;
      }
      if (val.startsWith('eq.')) {
        const expected = val.slice(3);
        if (String(row[key] ?? '') !== expected) return false;
      } else if (val.startsWith('ilike.')) {
        const pattern = val.slice(6).replace(/\*/g, '').toLowerCase();
        if (!String(row[key] ?? '').toLowerCase().includes(pattern)) return false;
      }
    }
    return true;
  }

  beforeAll(async () => {
    const hashCentroVend = await bcrypt.hash('25111222', 10);
    const hashOccidenteVend = await bcrypt.hash('19888777', 10);
    const hashCoordCentro = await bcrypt.hash('CoordCentro2026!', 10);
    const hashCoordOccidente = await bcrypt.hash('CoordOccidente2026!', 10);

    dbVendedores = [
      {
        id: 'VEND-CEN-01',
        codigo: 'VEND-CEN-01',
        username: 'CARLOS MENDOZA',
        nombre: 'CARLOS MENDOZA',
        cedula_hash: hashCentroVend,
        ruta: 'RUTA-CCS-01',
        role: 'VENDEDOR',
        sucursal: 'CENTRO',
        activo: true
      },
      {
        id: 'COORD-CEN-01',
        codigo: 'COORD-CEN-01',
        username: 'COORDINADORA CENTRO',
        nombre: 'VALERIA ROJAS (COORD CENTRO)',
        cedula_hash: hashCoordCentro,
        ruta: 'COORDINACION CENTRO',
        role: 'COORDINADORA',
        sucursal: 'CENTRO',
        activo: true
      },
      {
        id: 'VEND-OCC-01',
        codigo: 'VEND-OCC-01',
        username: 'OSCAR ORTIZ',
        nombre: 'OSCAR ORTIZ',
        cedula_hash: hashOccidenteVend,
        ruta: 'OSCAR ORTIZ',
        role: 'VENDEDOR',
        sucursal: 'OCCIDENTE',
        activo: true
      },
      {
        id: 'COORD-OCC-01',
        codigo: 'COORD-OCC-01',
        username: 'COORDINADORA OCCIDENTE',
        nombre: 'DANIELA PEREZ (COORD OCCIDENTE)',
        cedula_hash: hashCoordOccidente,
        ruta: 'COORDINACION OCCIDENTE',
        role: 'COORDINADORA',
        sucursal: 'OCCIDENTE',
        activo: true
      }
    ];

    // 1. Iniciar servidor PostgREST simulado con RLS estricto y Trigger multisede
    mockSupabaseServer = http.createServer((req, res) => {
      const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
      res.setHeader('Content-Type', 'application/json');

      if (!urlObj.pathname.startsWith('/rest/v1/')) {
        res.statusCode = 404;
        res.end(JSON.stringify({ message: 'Not Found' }));
        return;
      }

      const table = urlObj.pathname.replace('/rest/v1/', '').split('/')[0];
      const authHeader = String(req.headers['authorization'] || '');
      const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

      let decodedJwt: any = null;
      try {
        decodedJwt = jwt.verify(bearer, TEST_SUPABASE_JWT_SECRET);
      } catch {
        res.statusCode = 401;
        res.end(JSON.stringify({ code: 'PGRST301', message: 'JWT invalid or expired' }));
        return;
      }

      const dbRole = String(decodedJwt?.role || 'anon');
      const isServiceBackend = dbRole === ['service', 'role'].join('_');
      const jwtSucursal = decodedJwt?.app_metadata?.sucursal || null;

      const collectBody = (): Promise<any> =>
        new Promise((resolve, reject) => {
          let raw = '';
          req.on('data', (c) => (raw += c));
          req.on('end', () => {
            if (!raw) return resolve({});
            try {
              resolve(JSON.parse(raw));
            } catch (e) {
              reject(e);
            }
          });
        });

      const sendRlsError = (msg: string) => {
        res.statusCode = 403;
        res.end(JSON.stringify({ code: '42501', message: msg }));
      };

      const sendCheckError = (msg: string) => {
        res.statusCode = 400;
        res.end(JSON.stringify({ code: '23514', message: msg }));
      };

      // Tabla nacional compartida: public.productos
      if (table === 'productos') {
        if (req.method === 'GET') {
          const rows = dbProductos.filter((r) => matchesPostgrestQuery(r, urlObj.searchParams));
          res.statusCode = 200;
          res.end(JSON.stringify(rows));
          return;
        }
        return sendRlsError('productos is read-only for FDV');
      }

      // Tablas delimitadas por sucursal: rutas, vendedores, clientes
      if (table === 'rutas' || table === 'vendedores' || table === 'clientes') {
        const sourceArr =
          table === 'rutas' ? dbRutas : table === 'vendedores' ? dbVendedores : dbClientes;
        if (req.method === 'GET') {
          let rows = sourceArr.filter((r) => matchesPostgrestQuery(r, urlObj.searchParams));
          if (!isServiceBackend) {
            if (dbRole !== 'authenticated' || !jwtSucursal) {
              return sendRlsError(`RLS denied on ${table}: missing app_metadata.sucursal`);
            }
            rows = rows.filter((r) => r.sucursal === jwtSucursal);
          }
          res.statusCode = 200;
          res.end(JSON.stringify(rows));
          return;
        }
        return sendRlsError(`${table} write denied`);
      }

      // Tabla transaccional con RLS + Trigger: public.degustaciones
      if (table === 'degustaciones') {
        if (!isServiceBackend && (dbRole !== 'authenticated' || !jwtSucursal)) {
          return sendRlsError('RLS denied on degustaciones: missing authenticated sucursal claim');
        }

        if (req.method === 'GET') {
          let rows = Array.from(dbDegustaciones.values()).filter((r) =>
            matchesPostgrestQuery(r, urlObj.searchParams)
          );
          if (!isServiceBackend) {
            rows = rows.filter((r) => r.sucursal === jwtSucursal);
          }
          rows.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
          res.statusCode = 200;
          res.end(JSON.stringify(rows));
          return;
        }

        if (req.method === 'POST') {
          collectBody()
            .then((body) => {
              const incoming = Array.isArray(body) ? body : [body];
              const saved: any[] = [];

              for (const row of incoming) {
                // 1. CHECK constraint: sucursal IN ('CENTRO', 'OCCIDENTE')
                if (row.sucursal !== 'CENTRO' && row.sucursal !== 'OCCIDENTE') {
                  return sendCheckError(`Invalid sucursal "${String(row.sucursal)}"`);
                }
                // 2. RLS WITH CHECK: row.sucursal === auth.jwt()->app_metadata->>sucursal
                if (!isServiceBackend && row.sucursal !== jwtSucursal) {
                  return sendRlsError(
                    `new row violates row-level security policy for table "degustaciones" (jwt=${jwtSucursal}, row=${row.sucursal})`
                  );
                }
                // 3. Trigger: prohibir ALL_MY_ROUTES
                if (row.ruta === 'ALL_MY_ROUTES' || row.vendedor_id === 'ALL_MY_ROUTES') {
                  return sendCheckError('ALL_MY_ROUTES is forbidden by multisede trigger');
                }
                // 4. Trigger: verificar que la tienda pertenezca a la misma sucursal
                const storeMatch = dbClientes.find(
                  (c) =>
                    c.codigo.toUpperCase() === String(row.cliente_codigo || '').toUpperCase() ||
                    c.nombre.toUpperCase() === String(row.cliente_nombre || '').toUpperCase()
                );
                if (!storeMatch) {
                  return sendCheckError(`Uncataloged store "${row.cliente_nombre}"`);
                }
                if (storeMatch.sucursal !== row.sucursal) {
                  return sendCheckError(
                    `Cross-branch violation: store ${storeMatch.codigo} belongs to ${storeMatch.sucursal}, not ${row.sucursal}`
                  );
                }

                const persisted = {
                  ...row,
                  updated_at: new Date().toISOString()
                };
                dbDegustaciones.set(String(persisted.id), persisted);
                saved.push(persisted);
              }

              res.statusCode = 201;
              res.end(JSON.stringify(saved));
            })
            .catch(() => {
              res.statusCode = 400;
              res.end(JSON.stringify({ message: 'Invalid JSON' }));
            });
          return;
        }

        if (req.method === 'PATCH') {
          collectBody()
            .then((patch) => {
              const updated: any[] = [];
              for (const [id, existing] of dbDegustaciones.entries()) {
                if (!matchesPostgrestQuery(existing, urlObj.searchParams)) continue;
                if (!isServiceBackend && existing.sucursal !== jwtSucursal) continue;

                const nextSuc = patch.sucursal ?? existing.sucursal;
                if (!isServiceBackend && nextSuc !== jwtSucursal) {
                  return sendRlsError('RLS WITH CHECK violation on UPDATE degustaciones');
                }
                const merged = { ...existing, ...patch, sucursal: existing.sucursal, updated_at: new Date().toISOString() };
                dbDegustaciones.set(id, merged);
                updated.push(merged);
              }
              res.statusCode = 200;
              res.end(JSON.stringify(updated));
            })
            .catch(() => {
              res.statusCode = 400;
              res.end(JSON.stringify({ message: 'Invalid JSON' }));
            });
          return;
        }

        if (req.method === 'DELETE') {
          const deleted: any[] = [];
          for (const [id, existing] of dbDegustaciones.entries()) {
            if (!matchesPostgrestQuery(existing, urlObj.searchParams)) continue;
            if (!isServiceBackend && existing.sucursal !== jwtSucursal) continue;
            dbDegustaciones.delete(id);
            deleted.push(existing);
          }
          res.statusCode = 200;
          res.end(JSON.stringify(deleted));
          return;
        }
      }

      // Cualquier otra tabla opcional (usuarios, maestra, etc.) devuelve vacío o 404 PostgREST
      res.statusCode = 404;
      res.end(JSON.stringify({ code: 'PGRST205', message: `Table ${table} not found` }));
    });

    await new Promise<void>((resolve) => {
      mockSupabaseServer!.listen(0, '127.0.0.1', () => {
        const addr = mockSupabaseServer!.address() as any;
        mockSupabaseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // 2. Levantar el servidor BFF compilado conectado al Supabase Multisede simulado
    const fdvPort = 3045;
    fdvBaseUrl = `http://127.0.0.1:${fdvPort}`;
    fdvServer = spawn('node', ['dist/server.cjs'], {
      env: {
        ...process.env,
        PORT: String(fdvPort),
        SUPABASE_URL: mockSupabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: TEST_SERVICE_ROLE_KEY,
        TRADE_SUPABASE_URL: mockSupabaseUrl,
        TRADE_SUPABASE_ANON_KEY: TEST_ANON_KEY,
        TRADE_SUPABASE_SERVICE_ROLE_KEY: TEST_SERVICE_ROLE_KEY,
        TRADE_SUPABASE_JWT_SECRET: TEST_SUPABASE_JWT_SECRET,
        TRADE_MARKETING_API_URL: '',
        GERENCIA_TRADE_API_URL: '',
        GERENCIA_UTERIO_SURVEYS_URL: '',
        GERENCIA_UTERIO_ANON_KEY: '',
        GOOGLE_SCRIPT_WEBHOOK_URL: ''
      },
      stdio: 'ignore'
    });

    let healthy = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      try {
        const res = await fetch(`${fdvBaseUrl}/api/health`);
        if (res.ok) {
          healthy = true;
          break;
        }
      } catch {}
    }
    if (!healthy) {
      throw new Error('FDV server did not start on port 3045 for multisede E2E test');
    }
  }, 25000);

  afterAll(async () => {
    // Limpiar cualquier registro sintético en data_degustaciones.json antes de apagar el servidor
    try {
      const adminRes = await fetch(`${fdvBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ADMIN', password: process.env.ADMIN_PASSWORD || '123' })
      });
      const adminData = await adminRes.json();
      if (adminData?.token) {
        for (const id of createdIdsForCleanup) {
          await fetch(`${fdvBaseUrl}/api/degustaciones/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${adminData.token}`,
              'X-Active-Sucursal': id.includes('centro') ? 'CENTRO' : 'OCCIDENTE'
            }
          }).catch(() => {});
        }
      }
    } catch {}

    if (fdvServer) {
      fdvServer.kill();
      fdvServer = null;
    }
    if (mockSupabaseServer) {
      await new Promise<void>((resolve) => mockSupabaseServer!.close(() => resolve()));
      mockSupabaseServer = null;
    }
  });

  async function loginUser(username: string, password: string) {
    const res = await fetch(`${fdvBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const body = await res.json();
    return { status: res.status, body };
  }

  it('Case A (CENTRO) & Case B (OCCIDENTE): isolates vendor catalogs, persists explicit sucursal, and delivers each request EXCLUSIVELY to its branch Coordinator inbox (0 cross-leak)', async () => {
    const bookingDate = getNextAvailableBookingDate();

    // 1. Autenticar a los 4 actores desde Supabase Multisede
    const vendCentro = await loginUser('CARLOS MENDOZA', '25111222');
    expect(vendCentro.status).toBe(200);
    expect(vendCentro.body.user.sucursal).toBe('CENTRO');
    expect(vendCentro.body.user.role).toBe('VENDEDOR');

    const coordCentro = await loginUser('COORDINADORA CENTRO', 'CoordCentro2026!');
    expect(coordCentro.status).toBe(200);
    expect(coordCentro.body.user.sucursal).toBe('CENTRO');
    expect(coordCentro.body.user.role).toBe('COORDINADORA');

    const vendOccidente = await loginUser('OSCAR ORTIZ', '19888777');
    expect(vendOccidente.status).toBe(200);
    expect(vendOccidente.body.user.sucursal).toBe('OCCIDENTE');
    expect(vendOccidente.body.user.role).toBe('VENDEDOR');

    const coordOccidente = await loginUser('COORDINADORA OCCIDENTE', 'CoordOccidente2026!');
    expect(coordOccidente.status).toBe(200);
    expect(coordOccidente.body.user.sucursal).toBe('OCCIDENTE');
    expect(coordOccidente.body.user.role).toBe('COORDINADORA');

    // 2. Verificar aislamiento de catálogos en el origen (CENTRO vs OCCIDENTE + Productos Nacionales 100%)
    const catCentroRes = await fetch(`${fdvBaseUrl}/api/degustaciones/catalogos`, {
      headers: { Authorization: `Bearer ${vendCentro.body.token}` }
    });
    expect(catCentroRes.status).toBe(200);
    const catCentro = await catCentroRes.json();
    expect(catCentro.sucursal).toBe('CENTRO');
    expect(catCentro.clientes.length).toBe(2);
    expect(catCentro.clientes.every((c: any) => c.sucursal === 'CENTRO')).toBe(true);
    expect(catCentro.clientes.some((c: any) => c.codigo === 'OCC-001')).toBe(false);
    expect(catCentro.rutas.every((r: any) => r.sucursal === 'CENTRO')).toBe(true);
    expect(catCentro.vendedores.every((v: any) => v.sucursal === 'CENTRO')).toBe(true);
    expect(catCentro.productos.length).toBe(4); // 100% catálogo nacional compartido

    const catOccidenteRes = await fetch(`${fdvBaseUrl}/api/degustaciones/catalogos`, {
      headers: { Authorization: `Bearer ${vendOccidente.body.token}` }
    });
    expect(catOccidenteRes.status).toBe(200);
    const catOccidente = await catOccidenteRes.json();
    expect(catOccidente.sucursal).toBe('OCCIDENTE');
    expect(catOccidente.clientes.length).toBe(2);
    expect(catOccidente.clientes.every((c: any) => c.sucursal === 'OCCIDENTE')).toBe(true);
    expect(catOccidente.clientes.some((c: any) => c.codigo === 'CEN-001')).toBe(false);
    expect(catOccidente.rutas.every((r: any) => r.sucursal === 'OCCIDENTE')).toBe(true);
    expect(catOccidente.vendedores.every((v: any) => v.sucursal === 'OCCIDENTE')).toBe(true);
    expect(catOccidente.productos.length).toBe(4); // 100% catálogo nacional compartido

    // 3. CASO A: Vendedor de CENTRO envía degustación para tienda de CENTRO
    const centroDegId = `e2e-centro-${Date.now()}`;
    createdIdsForCleanup.add(centroDegId);
    const postCentroRes = await fetch(`${fdvBaseUrl}/api/degustaciones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vendCentro.body.token}`,
        'X-Active-Sucursal': 'CENTRO'
      },
      body: JSON.stringify({
        id: centroDegId,
        sucursal: 'CENTRO',
        clienteCodigo: 'CEN-001',
        clienteNombre: 'AUTOMERCADO PLAZA LAS MERCEDES',
        vendedorNombre: 'CARLOS MENDOZA',
        vendedorId: 'ALL_MY_ROUTES', // Verifica también sanitización automática a ruta concreta
        ruta: 'ALL_MY_ROUTES',
        fecha: bookingDate,
        turno: 'MAÑANA',
        hora: '09:00 AM - 01:00 PM',
        productos: ['JAMON ESPALDA CODIZULCA', 'MORTADELA ESPECIAL 1KG'],
        kilosEstimados: 6,
        personasEstimadas: 160,
        requierePromotora: true,
        materialPop: true,
        contactoPunto: 'Gerente Plaza Caracas',
        telefonoContacto: '0414-1112233',
        observaciones: 'E2E Solicitud Centro'
      })
    });
    expect(postCentroRes.status).toBe(200);
    const postCentroBody = await postCentroRes.json();
    expect(postCentroBody.success).toBe(true);
    expect(postCentroBody.data.sucursal).toBe('CENTRO');
    expect(postCentroBody.data.ruta).toBe('RUTA-CCS-01');
    expect(postCentroBody.data.ruta).not.toBe('ALL_MY_ROUTES');

    // Verificar fila cruda en Supabase: guardada con sucursal = 'CENTRO'
    const rawCentroRow = dbDegustaciones.get(centroDegId);
    expect(rawCentroRow).toBeDefined();
    expect(rawCentroRow.sucursal).toBe('CENTRO');
    expect(rawCentroRow.ruta).toBe('RUTA-CCS-01');

    // 4. CASO B: Vendedor de OCCIDENTE envía degustación para tienda de OCCIDENTE
    const occidenteDegId = `e2e-occidente-${Date.now()}`;
    createdIdsForCleanup.add(occidenteDegId);
    const postOccRes = await fetch(`${fdvBaseUrl}/api/degustaciones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vendOccidente.body.token}`,
        'X-Active-Sucursal': 'OCCIDENTE'
      },
      body: JSON.stringify({
        id: occidenteDegId,
        sucursal: 'OCCIDENTE',
        clienteCodigo: 'OCC-001',
        clienteNombre: 'HIPERMERCADO FIORELLA AMPARO',
        vendedorNombre: 'OSCAR ORTIZ',
        vendedorId: 'VEND-OCC-01',
        ruta: 'OSCAR ORTIZ',
        fecha: bookingDate,
        turno: 'TARDE',
        hora: '02:00 PM - 07:00 PM',
        productos: ['PECHUGA DE PAVO AHUMADA'],
        kilosEstimados: 7.5,
        personasEstimadas: 200,
        requierePromotora: true,
        materialPop: true,
        contactoPunto: 'Gerente Fiorella Maracaibo',
        telefonoContacto: '0414-9998877',
        observaciones: 'E2E Solicitud Occidente'
      })
    });
    expect(postOccRes.status).toBe(200);
    const postOccBody = await postOccRes.json();
    expect(postOccBody.success).toBe(true);
    expect(postOccBody.data.sucursal).toBe('OCCIDENTE');

    const rawOccRow = dbDegustaciones.get(occidenteDegId);
    expect(rawOccRow).toBeDefined();
    expect(rawOccRow.sucursal).toBe('OCCIDENTE');

    // 5. VERIFICACIÓN DE BANDEJAS DE COORDINADORAS (vía BFF + RLS de Supabase)
    // 5a) Bandeja Coordinadora de CENTRO -> ve ÚNICAMENTE la solicitud de CENTRO (0 de OCCIDENTE)
    const inboxCentroRes = await fetch(`${fdvBaseUrl}/api/degustaciones`, {
      headers: { Authorization: `Bearer ${coordCentro.body.token}` }
    });
    expect(inboxCentroRes.status).toBe(200);
    const inboxCentro = await inboxCentroRes.json();
    expect(inboxCentro.sucursal).toBe('CENTRO');
    const centroIdsInCentroInbox = inboxCentro.data.map((d: any) => d.id);
    expect(centroIdsInCentroInbox).toContain(centroDegId);
    expect(centroIdsInCentroInbox).not.toContain(occidenteDegId);
    expect(inboxCentro.data.every((d: any) => d.sucursal === 'CENTRO')).toBe(true);

    // 5b) Bandeja Coordinadora de OCCIDENTE -> ve ÚNICAMENTE la solicitud de OCCIDENTE (0 de CENTRO)
    const inboxOccRes = await fetch(`${fdvBaseUrl}/api/degustaciones`, {
      headers: { Authorization: `Bearer ${coordOccidente.body.token}` }
    });
    expect(inboxOccRes.status).toBe(200);
    const inboxOcc = await inboxOccRes.json();
    expect(inboxOcc.sucursal).toBe('OCCIDENTE');
    const occIdsInOccInbox = inboxOcc.data.map((d: any) => d.id);
    expect(occIdsInOccInbox).toContain(occidenteDegId);
    expect(occIdsInOccInbox).not.toContain(centroDegId);
    expect(inboxOcc.data.every((d: any) => d.sucursal === 'OCCIDENTE')).toBe(true);

    // 6. VERIFICACIÓN DIRECTA CONTRA CLIENTE SUPABASE CON RLS (simulando lectura directa del Dashboard Trade Marketing)
    const coordCentroSupaJwt = jwt.sign(
      {
        role: 'authenticated',
        sub: 'coord-centro',
        app_metadata: { sucursal: 'CENTRO', app_role: 'COORDINADORA' }
      },
      TEST_SUPABASE_JWT_SECRET,
      { expiresIn: '15m' }
    );
    const coordOccSupaJwt = jwt.sign(
      {
        role: 'authenticated',
        sub: 'coord-occidente',
        app_metadata: { sucursal: 'OCCIDENTE', app_role: 'COORDINADORA' }
      },
      TEST_SUPABASE_JWT_SECRET,
      { expiresIn: '15m' }
    );

    const directCentroSupa = createClient(mockSupabaseUrl, TEST_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${coordCentroSupaJwt}` } }
    });
    const directOccSupa = createClient(mockSupabaseUrl, TEST_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${coordOccSupaJwt}` } }
    });

    // Consulta SIN filtro .eq('sucursal', ...) para demostrar que RLS filtra por sí solo
    const { data: rlsCentroRows, error: rlsCentroErr } = await directCentroSupa
      .from('degustaciones')
      .select('*');
    expect(rlsCentroErr).toBeNull();
    expect(rlsCentroRows?.map((r: any) => r.id)).toEqual([centroDegId]);

    const { data: rlsOccRows, error: rlsOccErr } = await directOccSupa
      .from('degustaciones')
      .select('*');
    expect(rlsOccErr).toBeNull();
    expect(rlsOccRows?.map((r: any) => r.id)).toEqual([occidenteDegId]);
  });

  it('Case C (Security Blocks): blocks cross-branch store selection, sucursal tampering, uncataloged stores, unauthenticated access, and cross-branch mutations', async () => {
    const bookingDate = getNextAvailableBookingDate();
    const vendCentro = await loginUser('CARLOS MENDOZA', '25111222');
    const vendOccidente = await loginUser('OSCAR ORTIZ', '19888777');
    const coordCentro = await loginUser('COORDINADORA CENTRO', 'CoordCentro2026!');

    const countBefore = dbDegustaciones.size;

    // 1. Petición sin token -> 401
    const unauthRes = await fetch(`${fdvBaseUrl}/api/degustaciones`);
    expect(unauthRes.status).toBe(401);

    // 2. Vendedor de CENTRO intenta agendar tienda de OCCIDENTE (OCC-001) -> 403 CROSS_BRANCH_STORE_FORBIDDEN
    const cross1 = await fetch(`${fdvBaseUrl}/api/degustaciones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vendCentro.body.token}`
      },
      body: JSON.stringify({
        id: `blocked-cross-1-${Date.now()}`,
        sucursal: 'CENTRO',
        clienteCodigo: 'OCC-001',
        clienteNombre: 'HIPERMERCADO FIORELLA AMPARO',
        vendedorNombre: 'CARLOS MENDOZA',
        ruta: 'RUTA-CCS-01',
        fecha: bookingDate,
        turno: 'MAÑANA',
        productos: ['JAMON ESPALDA CODIZULCA']
      })
    });
    expect(cross1.status).toBe(403);
    const cross1Json = await cross1.json();
    expect(cross1Json.code).toBe('CROSS_BRANCH_STORE_FORBIDDEN');

    // 3. Vendedor de OCCIDENTE intenta agendar tienda de CENTRO (CEN-001) -> 403 CROSS_BRANCH_STORE_FORBIDDEN
    const cross2 = await fetch(`${fdvBaseUrl}/api/degustaciones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vendOccidente.body.token}`
      },
      body: JSON.stringify({
        id: `blocked-cross-2-${Date.now()}`,
        sucursal: 'OCCIDENTE',
        clienteCodigo: 'CEN-001',
        clienteNombre: 'AUTOMERCADO PLAZA LAS MERCEDES',
        vendedorNombre: 'OSCAR ORTIZ',
        ruta: 'OSCAR ORTIZ',
        fecha: bookingDate,
        turno: 'TARDE',
        productos: ['MORTADELA ESPECIAL 1KG']
      })
    });
    expect(cross2.status).toBe(403);
    const cross2Json = await cross2.json();
    expect(cross2Json.code).toBe('CROSS_BRANCH_STORE_FORBIDDEN');

    // 4. Vendedor de CENTRO manipula sucursal='OCCIDENTE' en body o header -> 403 SUCURSAL_TAMPERING_DETECTED
    const tamperRes = await fetch(`${fdvBaseUrl}/api/degustaciones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vendCentro.body.token}`,
        'X-Active-Sucursal': 'OCCIDENTE'
      },
      body: JSON.stringify({
        id: `blocked-tamper-${Date.now()}`,
        sucursal: 'OCCIDENTE',
        clienteCodigo: 'OCC-001',
        clienteNombre: 'HIPERMERCADO FIORELLA AMPARO',
        fecha: bookingDate,
        turno: 'MAÑANA',
        productos: ['JAMON ESPALDA CODIZULCA']
      })
    });
    expect(tamperRes.status).toBe(403);
    const tamperJson = await tamperRes.json();
    expect(tamperJson.code).toBe('SUCURSAL_TAMPERING_DETECTED');

    // 5. Vendedor de CENTRO intenta leer bandeja de OCCIDENTE por query param ?sucursal=OCCIDENTE -> 403
    const crossReadRes = await fetch(`${fdvBaseUrl}/api/degustaciones?sucursal=OCCIDENTE`, {
      headers: { Authorization: `Bearer ${vendCentro.body.token}` }
    });
    expect(crossReadRes.status).toBe(403);

    // 6. Vendedor intenta enviar tienda inventada no catalogada -> 400 UNCATALOGED_STORE_FORBIDDEN
    const freeTextStoreRes = await fetch(`${fdvBaseUrl}/api/degustaciones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vendCentro.body.token}`
      },
      body: JSON.stringify({
        id: `blocked-freetext-${Date.now()}`,
        sucursal: 'CENTRO',
        clienteCodigo: 'PDV',
        clienteNombre: 'BODEGA FANTASMA NO EXISTE',
        vendedorNombre: 'CARLOS MENDOZA',
        ruta: 'RUTA-CCS-01',
        fecha: bookingDate,
        turno: 'MAÑANA',
        productos: ['JAMON ESPALDA CODIZULCA']
      })
    });
    expect(freeTextStoreRes.status).toBe(400);
    const freeTextJson = await freeTextStoreRes.json();
    expect(freeTextJson.code).toBe('UNCATALOGED_STORE_FORBIDDEN');

    // 7. Coordinadora de CENTRO intenta aprobar una solicitud de OCCIDENTE -> 404/403 (0 cambios sobre OCCIDENTE)
    const occRow = Array.from(dbDegustaciones.values()).find((r) => r.sucursal === 'OCCIDENTE');
    expect(occRow).toBeDefined();
    const crossUpdateRes = await fetch(`${fdvBaseUrl}/api/degustaciones/${encodeURIComponent(occRow.id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordCentro.body.token}`
      },
      body: JSON.stringify({ estado: 'APROBADA', promotoraAsignada: 'Intento Cruzado' })
    });
    expect([403, 404]).toContain(crossUpdateRes.status);
    expect(dbDegustaciones.get(occRow.id)?.estado).toBe('SOLICITADA');

    // Verificar que ninguno de los ataques insertó registros en Supabase
    expect(dbDegustaciones.size).toBe(countBefore);
  });
});
