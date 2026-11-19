import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  createInMemoryMirrorStore,
  executeMirrorSyncSnapshot,
  runOrchestratedSheetsSync
} from '../../src/services/monthlySyncEngine';

describe('Phase 2 Baseline — Atomic Anti-Orphan Sync, SHA-256 Idempotency & Security Audit', () => {
  it('IT-RPC-01: upserts current periodo_mes and deletes ONLY current-month orphans while leaving historical months (2026-09, 2026-10) and ventas_historial 100% untouched', async () => {
    const store = createInMemoryMirrorStore({
      metas_activacion: [
        { periodo: '2026-09', vendedor_id: 'MARIA BRICEÑO', vendedor_key: 'MARIA BRICENO', categoria: 'AZUCAR', cartera: 120, meta: 65, activados: 60 },
        { periodo: '2026-10', vendedor_id: 'MARIA BRICEÑO', vendedor_key: 'MARIA BRICENO', categoria: 'AZUCAR', cartera: 122, meta: 68, activados: 64 },
        { periodo: '2026-11', vendedor_id: 'MARIA BRICEÑO', vendedor_key: 'MARIA BRICENO', categoria: 'AZUCAR', cartera: 125, meta: 70, activados: 40 },
        { periodo: '2026-11', vendedor_id: 'VENDEDOR BORRADO', vendedor_key: 'VENDEDOR BORRADO', categoria: 'AZUCAR', cartera: 50, meta: 20, activados: 5 }
      ],
      ventas_volumen: [
        { periodo: '2026-10', vendedor_id: 'MARIA BRICEÑO', vendedor_key: 'MARIA BRICENO', vendedor_nombre: 'MARIA BRICEÑO', sku: '1568', articulo: 'POLLO', categoria: 'POLLO', meta_kg: 5000, venta_bruta_kg: 4800, devoluciones_kg: 0, venta_neta_kg: 4800, ejecutado_kg: 4800, porcentaje_cumplimiento: 96, zona: 'General' },
        { periodo: '2026-11', vendedor_id: 'MARIA BRICEÑO', vendedor_key: 'MARIA BRICENO', vendedor_nombre: 'MARIA BRICEÑO', sku: '9999', articulo: 'SKU HUERFANO', categoria: 'OTROS', meta_kg: 100, venta_bruta_kg: 10, devoluciones_kg: 0, venta_neta_kg: 10, ejecutado_kg: 10, porcentaje_cumplimiento: 10, zona: 'General' }
      ],
      activacion_clientes: [
        { periodo: '2026-10', cliente_codigo: '329', cliente_codigo_canonico: '329', cliente_nombre: 'HIST CLIENT', vendedor_id: 'MARIA BRICEÑO', vendedor_key: 'MARIA BRICENO', vendedor_nombre: 'MARIA BRICEÑO', status: 'ACTIVO', cajas_azucar: 5, has_azucar: true },
        { periodo: '2026-11', cliente_codigo: '8888', cliente_codigo_canonico: '8888', cliente_nombre: 'ORPHAN CLIENT', vendedor_id: 'MARIA BRICEÑO', vendedor_key: 'MARIA BRICENO', vendedor_nombre: 'MARIA BRICEÑO', status: 'INACTIVO', cajas_azucar: 0, has_azucar: false }
      ],
      degustaciones: [
        { id: 'deg-oct-keep', fecha: '2026-10-15', vendedor_key: 'MARIA BRICENO', cliente_nombre: 'OCT PDV', vendedor_nombre: 'MARIA BRICEÑO', vendedor_id: '1', turno: 'MAÑANA', origen_sync: true },
        { id: 'deg-nov-app-manual', fecha: '2026-11-18', vendedor_key: 'MARIA BRICENO', cliente_nombre: 'APP CREATED', vendedor_nombre: 'MARIA BRICEÑO', vendedor_id: '1', turno: 'TARDE', origen_sync: false },
        { id: 'deg-nov-orphan', fecha: '2026-11-12', vendedor_key: 'MARIA BRICENO', cliente_nombre: 'REMOVED FROM SHEET', vendedor_nombre: 'MARIA BRICEÑO', vendedor_id: '1', turno: 'MAÑANA', origen_sync: true }
      ],
      ventas_historial: [
        { ano: 2026, mes: 10, id_cliente: '329', id_vendedor: '1', id_articulo: '1568', kgs: 4800, cajas: 240 }
      ]
    });

    const result = await executeMirrorSyncSnapshot(store, {
      periodoMes: '2026-11',
      sheetSha256: 'abc123sha256',
      triggeredBy: 'ADMIN',
      metas: [
        { vendedor_id: 'MARIA BRICEÑO', vendedor_key: 'MARIA BRICENO', categoria: 'AZUCAR', cartera: 125, meta: 70, activados: 53 }
      ],
      volumen: [
        { vendedor_id: 'MARIA BRICEÑO', vendedor_key: 'MARIA BRICENO', vendedor_nombre: 'MARIA BRICEÑO', sku: '1568', articulo: 'POLLO', categoria: 'POLLO', meta_kg: 5000, venta_bruta_kg: 2000, devoluciones_kg: -56.6, venta_neta_kg: 1943.4, porcentaje_cumplimiento: 38.87, zona: 'General' }
      ],
      activacion: [
        { cliente_codigo: '329', cliente_codigo_canonico: '329', cliente_nombre: 'CLIENT 329', vendedor_id: 'MARIA BRICEÑO', vendedor_key: 'MARIA BRICENO', vendedor_nombre: 'MARIA BRICEÑO', status: 'ACTIVO', cajas_azucar: 0.95, has_azucar: true }
      ],
      degustaciones: [
        { id: 'deg-nov-valid', fecha: '2026-11-21', vendedor_key: 'MARIA BRICENO', cliente_codigo: '329', cliente_nombre: 'CLIENT 329', vendedor_nombre: 'MARIA BRICEÑO', vendedor_id: '1', turno: 'MAÑANA', kilos_estimados: 12.5, personas_estimadas: 150, estado: 'APROBADA' }
      ],
      auditLogs: [
        { severity: 'WARN', sheet_name: 'Azucar', row_number: 10, event_code: 'SUMMARY_VS_DETAIL_MISMATCH', vendor_key: 'MARIA BRICENO', entity_key: 'AZUCAR', message: 'Delta test', payload: { delta: 52 } }
      ]
    });

    expect(result.status).toBe('OK');
    expect(result.metas).toEqual({ upserted: 1, deleted_orphans: 1 });
    expect(result.volumen).toEqual({ upserted: 1, deleted_orphans: 1 });
    expect(result.activacion).toEqual({ upserted: 1, deleted_orphans: 1 });
    expect(result.degustaciones).toEqual({ upserted: 1, deleted_orphans: 1 });

    // Historical months 2026-09 and 2026-10 + ventas_historial + app-created degustacion remain 100% untouched
    expect(store.state.metas_activacion.filter((r) => r.periodo === '2026-09')).toHaveLength(1);
    expect(store.state.metas_activacion.filter((r) => r.periodo === '2026-10')).toHaveLength(1);
    expect(store.state.metas_activacion.filter((r) => r.periodo === '2026-11')).toHaveLength(1);
    expect(store.state.metas_activacion.find((r) => r.periodo === '2026-11')!.activados).toBe(53);

    expect(store.state.ventas_volumen.filter((r) => r.periodo === '2026-10')).toHaveLength(1);
    expect(store.state.ventas_volumen.find((r) => r.periodo === '2026-11')!.venta_neta_kg).toBe(1943.4);

    expect(store.state.degustaciones.map((d) => d.id).sort()).toEqual([
      'deg-nov-app-manual',
      'deg-nov-valid',
      'deg-oct-keep'
    ]);
    expect(store.state.ventas_historial).toHaveLength(1);
    expect(store.state.sync_audit_logs).toHaveLength(1);
  });

  it('IT-RPC-02: activates empty-payload circuit breaker and rolls back atomically on malformed period or error', async () => {
    const store = createInMemoryMirrorStore({
      metas_activacion: [
        { periodo: '2026-11', vendedor_id: 'MARIA BRICEÑO', vendedor_key: 'MARIA BRICENO', categoria: 'AZUCAR', cartera: 125, meta: 70, activados: 53 }
      ]
    });

    await expect(
      executeMirrorSyncSnapshot(store, {
        periodoMes: '2026-13',
        sheetSha256: 'bad',
        triggeredBy: 'ADMIN',
        metas: [{ vendedor_id: 'X', vendedor_key: 'X', categoria: 'AZUCAR', cartera: 1, meta: 1, activados: 1 }],
        volumen: [{ vendedor_id: 'X', vendedor_key: 'X', vendedor_nombre: 'X', sku: '1', articulo: 'A', categoria: 'POLLO', meta_kg: 1, venta_bruta_kg: 1, devoluciones_kg: 0, venta_neta_kg: 1, porcentaje_cumplimiento: 100, zona: 'General' }],
        activacion: [{ cliente_codigo: '1', cliente_codigo_canonico: '1', cliente_nombre: 'C', vendedor_id: 'X', vendedor_key: 'X', vendedor_nombre: 'X', status: 'ACTIVO' }],
        degustaciones: [],
        auditLogs: []
      })
    ).rejects.toThrow(/Periodo mensual inválido/i);

    await expect(
      executeMirrorSyncSnapshot(store, {
        periodoMes: '2026-11',
        sheetSha256: 'empty',
        triggeredBy: 'ADMIN',
        metas: [],
        volumen: [],
        activacion: [],
        degustaciones: [],
        auditLogs: []
      })
    ).rejects.toThrow(/Freno de seguridad/i);

    // Existing 2026-11 data remained untouched
    expect(store.state.metas_activacion).toHaveLength(1);
    expect(store.state.metas_activacion[0].activados).toBe(53);
  });

  it('IT-HASH-01: skips redundant DB writes when SHA-256 of workbook bytes has not changed unless forceRebuild is requested', async () => {
    const store = createInMemoryMirrorStore();
    let rpcCalls = 0;
    const sampleBytes = Buffer.from('deterministic-workbook-binary-payload');

    const runOnce = (forceRebuild = false) =>
      runOrchestratedSheetsSync({
        fetchWorkbookBytes: async () => sampleBytes,
        parseBytes: async () => ({
          periodoMes: '2026-11',
          metas: [{ vendedor_id: 'MARIA BRICEÑO', vendedor_key: 'MARIA BRICENO', categoria: 'AZUCAR', cartera: 10, meta: 5, activados: 3 }],
          volumen: [{ vendedor_id: 'MARIA BRICEÑO', vendedor_key: 'MARIA BRICENO', vendedor_nombre: 'MARIA BRICEÑO', sku: '1568', articulo: 'POLLO', categoria: 'POLLO', meta_kg: 100, venta_bruta_kg: 80, devoluciones_kg: 0, venta_neta_kg: 80, porcentaje_cumplimiento: 80, zona: 'General' }],
          activacion: [{ cliente_codigo: '329', cliente_codigo_canonico: '329', cliente_nombre: 'C1', vendedor_id: 'MARIA BRICEÑO', vendedor_key: 'MARIA BRICENO', vendedor_nombre: 'MARIA BRICEÑO', status: 'ACTIVO' }],
          degustaciones: [],
          auditLogs: [],
          usuarios: []
        }),
        persistSnapshot: async (payload) => {
          rpcCalls++;
          return executeMirrorSyncSnapshot(store, payload);
        },
        getLastSyncedSha256: async (periodoMes) => store.getLastSha256(periodoMes),
        triggeredBy: 'CRON',
        forceRebuild
      });

    const r1 = await runOnce(false);
    expect(r1.status).toBe('OK');
    expect(rpcCalls).toBe(1);

    const r2 = await runOnce(false);
    expect(r2.status).toBe('SKIPPED_UNCHANGED');
    expect(rpcCalls).toBe(1); // Zero extra DB writes!

    const r3 = await runOnce(true);
    expect(r3.status).toBe('OK');
    expect(rpcCalls).toBe(2);
  });

  it('IT-SEC-01: static security audit verifies zero service_role keys, GEMINI_API_KEY defines, GOOGLE_SHEET_ID literals, or plaintext user passwords in client/server source files', () => {
    const root = process.cwd();
    const degService = fs.readFileSync(path.join(root, 'src/services/degustacionesService.ts'), 'utf8');
    const viteCfg = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
    const parserSrc = fs.readFileSync(path.join(root, 'src/services/googleSheetsParser.ts'), 'utf8');
    const serverSrc = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
    const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');

    // 1. No service_role JWT or claim in frontend src/services/degustacionesService.ts
    expect(degService).not.toMatch(/service_role/);
    expect(degService).not.toMatch(/InNlcnZpY2Vfcm9sZSI/); // base64 of "service_role"

    // 2. vite.config.ts must NOT inject GEMINI_API_KEY into frontend bundle via define
    expect(viteCfg).not.toMatch(/'process\.env\.GEMINI_API_KEY'\s*:/);
    expect(viteCfg).not.toMatch(/'process\.env\.API_KEY'\s*:/);

    // 3. DEFAULT_GOOGLE_SHEET_ID must not hardcode a real 44-char Google Sheet ID in source
    expect(parserSrc).not.toMatch(/DEFAULT_GOOGLE_SHEET_ID\s*=\s*['"][a-zA-Z0-9_-]{30,}['"]/);

    // 4. server.ts must not contain hardcoded service_role JWT or plaintext cedula passwords in VENDOR_SERVER_CREDENTIALS
    expect(serverSrc).not.toMatch(/InNlcnZpY2Vfcm9sZSI/);
    expect(serverSrc).not.toMatch(/password:\s*['"]\d{7,9}['"]/);

    // 5. .gitignore must block .env* and credential JSON/key files
    expect(gitignore).toMatch(/\.env\*/);
    expect(gitignore).toMatch(/credentials/i);
  });

  it('IT-SEC-02: live HTTP server enforces 403 on GET /api/usuarios, blocks VENDEDOR on POST /api/sync/sheets, strips sheetId from responses, and isolates vendor data', async () => {
    const port = 3099;
    const baseUrl = `http://127.0.0.1:${port}`;
    const child = spawn('node', ['dist/server.cjs'], {
      env: { ...process.env, PORT: String(port) },
      stdio: 'ignore'
    });

    try {
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 250));
        try {
          const h = await fetch(`${baseUrl}/api/health`);
          if (h.ok) break;
        } catch {}
      }

      // 1. GET /api/usuarios is strictly forbidden (403) and never leaks passwords
      const usrRes = await fetch(`${baseUrl}/api/usuarios`);
      expect(usrRes.status).toBe(403);
      const usrBody = await usrRes.text();
      expect(usrBody).not.toMatch(/cedula/i);

      // 2. Login as VENDEDOR (SAIRU VALLES) and ADMIN
      const vendLogin = await (
        await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'SAIRU VALLES', password: '18383237' })
        })
      ).json();
      expect(vendLogin.success).toBe(true);

      const adminLogin = await (
        await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'ADMIN', password: '123' })
        })
      ).json();
      expect(adminLogin.success).toBe(true);

      // 3. VENDEDOR cannot trigger global POST /api/sync/sheets (403 Forbidden)
      const vendSync = await fetch(`${baseUrl}/api/sync/sheets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${vendLogin.token}`
        },
        body: JSON.stringify({})
      });
      expect(vendSync.status).toBe(403);

      // 4. ADMIN can trigger POST /api/sync/sheets and response does NOT expose sheetId
      const adminSync = await fetch(`${baseUrl}/api/sync/sheets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminLogin.token}`
        },
        body: JSON.stringify({ forceRebuild: false })
      });
      expect(adminSync.status).toBe(200);
      const adminSyncJson = await adminSync.json();
      expect(adminSyncJson.success).toBe(true);
      expect(adminSyncJson.sheetId).toBeUndefined();

      // 5. VENDEDOR attempting ?vendedor=MARIA BRICEÑO still receives ONLY their own route (CUENTAS CLAVES 2 - SV)
      const vendVol = await (
        await fetch(`${baseUrl}/api/data/volumen?vendedor=${encodeURIComponent('MARIA BRICEÑO')}`, {
          headers: { Authorization: `Bearer ${vendLogin.token}` }
        })
      ).json();
      expect(Array.isArray(vendVol)).toBe(true);
      expect(vendVol.length).toBeGreaterThan(0);
      expect(vendVol.every((r: any) => r.vendedorKey === 'CUENTAS CLAVE 2 - SV' || r.vendedorId === 'CUENTAS CLAVES 2 - SV')).toBe(true);
    } finally {
      child.kill();
    }
  }, 25000);
});
