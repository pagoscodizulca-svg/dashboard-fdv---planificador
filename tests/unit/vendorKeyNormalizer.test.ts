import { describe, it, expect } from 'vitest';
import {
  normalizeVendorKey,
  resolveCanonicalRouteKey,
  getCaracasYearMonth
} from '../../src/utils/vendorKeyNormalizer';

describe('Phase 2 Baseline — Vendor Key Normalizer & America/Caracas Clock', () => {
  it('UT-NORM-01: cleans peripheral/double spaces and standardizes asymmetric hyphens', () => {
    expect(normalizeVendorKey('  OSCAR ORTIZ-  LA COSTA ')).toBe('OSCAR ORTIZ - LA COSTA');
    expect(normalizeVendorKey('OSCAR ORTIZ- CORO')).toBe('OSCAR ORTIZ - CORO');
    expect(normalizeVendorKey('OSCAR ORTIZ – LA COSTA')).toBe('OSCAR ORTIZ - LA COSTA');
    expect(normalizeVendorKey('J PABLO ARAUJO- CAB/OJE')).toBe('J PABLO ARAUJO - CAB/OJE');
  });

  it('UT-NORM-02: strips accents/diacritics, Ñ -> N, and repairs UTF-8/CP1252 mojibake', () => {
    expect(normalizeVendorKey('MARÍA BRICEÑO')).toBe('MARIA BRICENO');
    expect(normalizeVendorKey('MARIA BRICEÃ‘O')).toBe('MARIA BRICENO');
    expect(normalizeVendorKey('EDUARDO PIÑA')).toBe('EDUARDO PINA');
    expect(normalizeVendorKey('HERNÁN PAZ')).toBe('HERNAN PAZ');
    expect(normalizeVendorKey('OSWALDO CHURIÓN')).toBe('OSWALDO CHURION');
    expect(normalizeVendorKey('SAIRÚ VALLES')).toBe('SAIRU VALLES');
  });

  it('UT-NORM-03: strips accidental trailing digits attached to names while preserving numbered commercial routes', () => {
    expect(normalizeVendorKey('MIKELANGELO DIAZ1')).toBe('MIKELANGELO DIAZ');
    expect(normalizeVendorKey('  Mikelangelo   Díaz2 ')).toBe('MIKELANGELO DIAZ');
    expect(normalizeVendorKey('MIKELANGELO DIAZ1 - VILLA DEL ROS')).toBe('MIKELANGELO DIAZ - VILLA DEL ROS');

    // Preserves legitimate standalone route numbers
    expect(normalizeVendorKey('CUENTAS CLAVE 1 - MC')).toBe('CUENTAS CLAVE 1 - MC');
    expect(normalizeVendorKey('CUENTAS CLAVE 2 - SV')).toBe('CUENTAS CLAVE 2 - SV');
    expect(resolveCanonicalRouteKey('CUENTAS CLAVE 1 - MC')).toBe('CUENTAS CLAVES 1 - MC');
    expect(resolveCanonicalRouteKey('CUENTAS CLAVE 2 - SV')).toBe('CUENTAS CLAVES 2 - SV');
    expect(resolveCanonicalRouteKey('MIKELANGELO DIAZ1')).toBe('MIKELANGELO DIAZ');
  });

  it('UT-TIME-01: computes YYYY-MM strictly in America/Caracas (UTC-4) across UTC midnight boundaries', () => {
    // 2026-11-01T02:30:00Z is 2026-10-31 22:30:00 in America/Caracas -> must still be 2026-10
    expect(getCaracasYearMonth(new Date('2026-11-01T02:30:00.000Z'))).toBe('2026-10');
    // 2026-11-01T03:59:59Z is 2026-10-31 23:59:59 in America/Caracas -> must still be 2026-10
    expect(getCaracasYearMonth(new Date('2026-11-01T03:59:59.000Z'))).toBe('2026-10');
    // 2026-11-01T04:01:00Z is 2026-11-01 00:01:00 in America/Caracas -> flips to 2026-11
    expect(getCaracasYearMonth(new Date('2026-11-01T04:01:00.000Z'))).toBe('2026-11');
  });
});
