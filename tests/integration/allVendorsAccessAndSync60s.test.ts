import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { parseWorkbookFull } from '../../src/services/googleSheetsParser';
import { DEFAULT_VENDOR_BCRYPT_CREDENTIALS } from '../../src/services/defaultUserHashes';
import {
  VENDOR_PROFILES,
  SUPERVISOR_PROFILES,
  SUPERVISOR_SUMMARY_COLUMNS,
  getVendorProfile,
  getSupervisorProfile,
  isRouteMatch,
  matchesVendorAlias
} from '../../src/utils/vendorRoutes';
import { normalizeVendorKey } from '../../src/utils/vendorKeyNormalizer';
import { DEFAULT_SYNC_INTERVAL_MS } from '../../src/services/sheetsSyncScheduler';
import { SHEETS_AUTO_REFRESH_INTERVAL_MS } from '../../src/services/googleSheetsService';

describe('All Vendors Access, Route Isolation & 60s Sheet Sync Contract', () => {
  it('enforces exact 60-second synchronization interval on backend and frontend', () => {
    expect(DEFAULT_SYNC_INTERVAL_MS).toBe(60_000);
    expect(SHEETS_AUTO_REFRESH_INTERVAL_MS).toBe(60_000);
  });

  it('guarantees offline bcrypt fallback credentials and canonical roles for all active vendors and supervisors', () => {
    expect(DEFAULT_VENDOR_BCRYPT_CREDENTIALS['JOHNATAN SOTO'].role).toBe('SUPERVISOR');
    expect(DEFAULT_VENDOR_BCRYPT_CREDENTIALS['ALI PEREZ'].role).toBe('SUPERVISOR');
    expect(DEFAULT_VENDOR_BCRYPT_CREDENTIALS['ADMIN'].role).toBe('ADMIN');

    for (const [key, cred] of Object.entries(DEFAULT_VENDOR_BCRYPT_CREDENTIALS)) {
      expect(cred.passwordHash.startsWith('$2b$')).toBe(true);
      expect(Boolean(cred.vendorId)).toBe(true);
      expect(['ADMIN', 'SUPERVISOR', 'VENDEDOR']).toContain(cred.role);
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it('resolves accent-insensitive and alias vendor keys without cross-route leakage on multi-route profiles', () => {
    // Accent-less resolution
    expect(getVendorProfile('MARIA BRICENO').canonicalUsername).toBe('MARIA BRICEÑO');
    expect(getVendorProfile('EDUARDO PINA').canonicalUsername).toBe('EDUARDO PIÑA');
    expect(getVendorProfile('MARIANGEL').canonicalUsername).toBe('MARIANGEL GONZALEZ');

    // J PABLO ARAUJO sub-route isolation (no prefix double-counting)
    expect(isRouteMatch('J PABLO ARAUJO', 'J PABLO ARAUJO', 'J PABLO ARAUJO', 'VENDEDOR', 'OCCIDENTE')).toBe(true);
    expect(isRouteMatch('J PABLO ARAUJO - CAB/OJE', 'J PABLO ARAUJO', 'J PABLO ARAUJO', 'VENDEDOR', 'OCCIDENTE')).toBe(false);
    expect(isRouteMatch('J PABLO ARAUJO - CAB/OJE', 'J PABLO ARAUJO - CAB/OJE', 'J PABLO ARAUJO', 'VENDEDOR', 'OCCIDENTE')).toBe(true);
    expect(isRouteMatch('J PABLO ARAUJO', 'J PABLO ARAUJO - CAB/OJE', 'J PABLO ARAUJO', 'VENDEDOR', 'OCCIDENTE')).toBe(false);
    expect(isRouteMatch('J PABLO ARAUJO - CAB/OJE', 'ALL_MY_ROUTES', 'J PABLO ARAUJO', 'VENDEDOR', 'OCCIDENTE')).toBe(true);
    expect(isRouteMatch('J PABLO ARAUJO', 'ALL_MY_ROUTES', 'J PABLO ARAUJO', 'VENDEDOR', 'OCCIDENTE')).toBe(true);

    // MIKELANGELO DIAZ vs VILLA DEL ROS sub-route isolation
    expect(isRouteMatch('MIKELANGELO DIAZ', 'MIKELANGELO DIAZ', 'MIKELANGELO DIAZ', 'VENDEDOR', 'OCCIDENTE')).toBe(true);
    expect(isRouteMatch('MIKELANGELO DIAZ - VILLA DEL ROS', 'MIKELANGELO DIAZ', 'MIKELANGELO DIAZ', 'VENDEDOR', 'OCCIDENTE')).toBe(false);
    expect(isRouteMatch('MIKELANGELO DIAZ - VILLA DEL ROS', 'MIKELANGELO DIAZ - VILLA DEL ROS', 'MIKELANGELO DIAZ', 'VENDEDOR', 'OCCIDENTE')).toBe(true);

    // OSCAR ORTIZ sub-route isolation
    expect(isRouteMatch('OSCAR ORTIZ- CORO', 'OSCAR ORTIZ- CORO', 'OSCAR ORTIZ', 'VENDEDOR', 'OCCIDENTE')).toBe(true);
    expect(isRouteMatch('OSCAR ORTIZ- LA COSTA', 'OSCAR ORTIZ- CORO', 'OSCAR ORTIZ', 'VENDEDOR', 'OCCIDENTE')).toBe(false);

    // Cross-vendor strict privacy
    expect(isRouteMatch('ELISA SOLER', 'MARIA BRICEÑO', 'MARIA BRICEÑO', 'VENDEDOR', 'OCCIDENTE')).toBe(false);
    expect(isRouteMatch('ELISA SOLER', 'ALL_MY_ROUTES', 'MARIA BRICEÑO', 'VENDEDOR', 'OCCIDENTE')).toBe(false);
  });

  it('reconciles 100% of local backup workbook routes against VENDOR_PROFILES with zero unmapped columns', () => {
    const xlsxCandidates = [
      path.join(process.cwd(), 'Dashboard_Vendedores (2).xlsx'),
      path.join(process.cwd(), 'Dashboard_Vendedores.xlsx')
    ];
    const foundPath = xlsxCandidates.find((p) => fs.existsSync(p));
    if (!foundPath) return;

    const rawSeed = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts', 'data_maestra_octubre_2026.json'), 'utf8'));
    const masterClients = rawSeed
      .filter((item: any) => item && item.id && item.vendedor)
      .map((item: any) => ({
        cliente_codigo: String(item.id).trim(),
        cliente_nombre: String(item.razonSocial || '').trim(),
        vendedor_id: String(item.vendedor).replace(/\s+/g, ' ').trim(),
        vendedor_nombre: String(item.vendedor).replace(/\s+/g, ' ').trim()
      }));

    const wb = XLSX.read(fs.readFileSync(foundPath), { type: 'buffer' });
    const parsed = parseWorkbookFull(XLSX, wb, { periodo: '2026-11', masterClients });

    const allDefinedAliases = Object.values(VENDOR_PROFILES).flatMap((p) =>
      p.routes.flatMap((r) => [r.id, ...r.aliases])
    );

    const volVendors = Array.from(
      new Set(
        parsed.volumenApiRows
          .map((r) => r.vendedorId)
          .filter((v) => !SUPERVISOR_SUMMARY_COLUMNS.has(normalizeVendorKey(v)))
      )
    );
    for (const v of volVendors) {
      expect(matchesVendorAlias(allDefinedAliases, v)).toBe(true);
    }

    const metasVendors = Array.from(
      new Set(parsed.metasApiRows.map((m) => m.vendedorId).filter((v) => v !== 'ALI PEREZ'))
    );
    for (const v of metasVendors) {
      expect(matchesVendorAlias(allDefinedAliases, v)).toBe(true);
    }

    // Verify supervisor coverage
    expect(Object.keys(SUPERVISOR_PROFILES).length).toBeGreaterThanOrEqual(3);
  });
});
