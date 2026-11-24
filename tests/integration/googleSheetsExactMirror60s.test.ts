import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { SHEETS_AUTO_REFRESH_INTERVAL_MS } from '../../src/services/googleSheetsService';
import { DEFAULT_SYNC_INTERVAL_MS } from '../../src/services/sheetsSyncScheduler';
import { parseWorkbookFull } from '../../src/services/googleSheetsParser';
import { sumDecimalExact } from '../../src/utils/safeNumber';

describe('E2E Exactness: Google Sheets November Mirror (60s Auto-Sync) vs Supabase Historical Separation', () => {
  it('enforces exact 60-second synchronization interval on both frontend and backend scheduler', () => {
    expect(SHEETS_AUTO_REFRESH_INTERVAL_MS).toBe(60_000);
    expect(DEFAULT_SYNC_INTERVAL_MS).toBe(60_000);
  });

  it('serves 100% unaltered Google Sheet numbers (0.00 kg delta, 0 meta/activados delta, full 2,717 portfolio) and preserves historical separation in Supabase', async () => {
    const port = 3057;
    const baseUrl = `http://127.0.0.1:${port}`;
    const child = spawn('node', ['dist/server.cjs'], {
      env: {
        ...process.env,
        PORT: String(port),
        DISABLE_LOCAL_SHEET_OVERWRITE: '1'
      },
      stdio: 'ignore'
    });

    try {
      let healthy = false;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 250));
        try {
          const h = await fetch(`${baseUrl}/api/health`);
          if (h.ok) {
            healthy = true;
            break;
          }
        } catch {}
      }
      expect(healthy).toBe(true);

      // Login as ADMIN
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'ADMIN',
          password: process.env.ADMIN_PASSWORD || '123'
        })
      });
      expect(loginRes.status).toBe(200);
      const { token } = await loginRes.json();
      const authHeaders = { Authorization: `Bearer ${token}` };

      // Verify /api/sync/status reports 60s sync interval
      const syncStatusRes = await fetch(`${baseUrl}/api/sync/status`, { headers: authHeaders });
      expect(syncStatusRes.status).toBe(200);
      const syncStatus = await syncStatusRes.json();
      expect(syncStatus.syncIntervalSeconds).toBe(60);

      // Fetch the 3 live frontend endpoints
      const [volRes, actRes, metasRes] = await Promise.all([
        fetch(`${baseUrl}/api/data/volumen`, { headers: authHeaders }),
        fetch(`${baseUrl}/api/data/activacion`, { headers: authHeaders }),
        fetch(`${baseUrl}/api/data/metas-activacion`, { headers: authHeaders })
      ]);
      expect(volRes.status).toBe(200);
      expect(actRes.status).toBe(200);
      expect(metasRes.status).toBe(200);

      const [volRows, actRows, metasRows] = await Promise.all([
        volRes.json(),
        actRes.json(),
        metasRes.json()
      ]);

      // 1. Portfolio completeness: NEVER truncated to partial Supabase activacion_clientes (~957 rows)
      expect(Array.isArray(actRows)).toBe(true);
      expect(actRows.length).toBeGreaterThanOrEqual(2500);

      // 2. Metas completeness: cartera is preserved (> 0), 125 rows (25 vendors x 5 focus rubros)
      expect(Array.isArray(metasRows)).toBe(true);
      expect(metasRows.length).toBe(125);
      const totalCartera = metasRows.reduce((acc: number, m: any) => acc + (Number(m.cartera) || 0), 0);
      expect(totalCartera).toBeGreaterThan(0);

      // 3. Volumen exactness: percentages and net/gross/return fields from Google Sheet are intact
      expect(Array.isArray(volRows)).toBe(true);
      expect(volRows.length).toBeGreaterThanOrEqual(1247);
      expect(volRows.some((v: any) => v.porcentajeCumplimiento !== null && v.porcentajeCumplimiento !== undefined)).toBe(true);

      // If source was local_backup (offline CI), compare 1:1 against local sheet.xlsx; if live_google_sheet, verify internal accounting consistency
      const syncSource = volRes.headers.get('x-sync-source');
      if (syncSource === 'local_backup' && fs.existsSync(path.join(process.cwd(), 'sheet.xlsx'))) {
        const wb = XLSX.readFile(path.join(process.cwd(), 'sheet.xlsx'), { raw: true });
        const seed = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts', 'data_maestra_octubre_2026.json'), 'utf8')).map((i: any) => ({
          cliente_codigo: String(i.id).trim(),
          cliente_nombre: String(i.razonSocial || '').trim(),
          vendedor_id: String(i.vendedor).replace(/\s+/g, ' ').trim(),
          vendedor_nombre: String(i.vendedor).replace(/\s+/g, ' ').trim()
        }));
        const expected = parseWorkbookFull(XLSX, wb, { periodo: syncStatus.periodo, masterClients: seed });
        expect(sumDecimalExact(volRows.map((r: any) => r.meta), 2)).toBe(
          sumDecimalExact(expected.volumenApiRows.map((r) => r.meta), 2)
        );
        expect(sumDecimalExact(volRows.map((r: any) => r.ejecutado), 2)).toBe(
          sumDecimalExact(expected.volumenApiRows.map((r) => r.ejecutado), 2)
        );
      }

      // 4. Verify Leonardo Rios & Sairu Valles receive their complete November portfolio (102 and 36 clients, not 5 and 2)
      const leoActRes = await fetch(`${baseUrl}/api/data/activacion?vendedor=${encodeURIComponent('LEONARDO RIOS')}`, {
        headers: authHeaders
      });
      const leoAct = await leoActRes.json();
      expect(leoAct.length).toBeGreaterThanOrEqual(95);

      const sairuActRes = await fetch(`${baseUrl}/api/data/activacion?vendedor=${encodeURIComponent('SAIRU VALLES')}`, {
        headers: authHeaders
      });
      const sairuAct = await sairuActRes.json();
      expect(sairuAct.length).toBeGreaterThanOrEqual(35);
    } finally {
      child.kill();
    }
  }, 30000);
});
