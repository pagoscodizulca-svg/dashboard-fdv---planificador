import { describe, it, expect, beforeEach } from 'vitest';
import {
  isSairuVallesIdentity,
  canAccessAlkosto,
  isAlkostoRouteUrl,
  ALKOSTO_ACCESS_DENIED_MESSAGE
} from '../../src/utils/alkostoPermissions';
import {
  subscribeAlkostoOrders,
  saveAlkostoOrder,
  parseAlkostoOrderImage
} from '../../src/services/alkostoService';

describe('Unit: Alkosto Defense-in-Depth Permissions (Sairu Valles Block vs Authorized Profiles)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('isSairuVallesIdentity', () => {
    it('detects Sairu Valles across canonical name, accents, route aliases, and vendor IDs', () => {
      expect(isSairuVallesIdentity({ username: 'SAIRU VALLES' })).toBe(true);
      expect(isSairuVallesIdentity({ username: 'Sairú Valles' })).toBe(true);
      expect(isSairuVallesIdentity({ username: 'sairu valles' })).toBe(true);
      expect(isSairuVallesIdentity({ username: 'CUENTAS CLAVES 2 - SV' })).toBe(true);
      expect(isSairuVallesIdentity({ username: 'CUENTAS CLAVE 2' })).toBe(true);
      expect(isSairuVallesIdentity({ route: 'CUENTAS CLAVES 2 - SV' })).toBe(true);
      expect(isSairuVallesIdentity({ vendorId: '26' })).toBe(true);
      expect(isSairuVallesIdentity({ vendorId: 26 })).toBe(true);
      expect(isSairuVallesIdentity({ vendorId: '56' })).toBe(true);
      expect(isSairuVallesIdentity({ vendorKey: 'SAIRU VALLES' })).toBe(true);
    });

    it('does not falsely match other vendors, supervisors, or ADMIN', () => {
      expect(isSairuVallesIdentity({ username: 'ADMIN', role: 'ADMIN', vendorId: 'ADMIN' })).toBe(false);
      expect(isSairuVallesIdentity({ username: 'ALI PEREZ', role: 'SUPERVISOR', vendorId: 'SUPERVISOR_ALI_PEREZ' })).toBe(false);
      expect(isSairuVallesIdentity({ username: 'MARIANA CHACIN', role: 'VENDEDOR', vendorId: '2', route: 'CUENTAS CLAVES 1 - MC' })).toBe(false);
      expect(isSairuVallesIdentity({ username: 'MARIA BRICEÑO', role: 'VENDEDOR', vendorId: '1' })).toBe(false);
      expect(isSairuVallesIdentity(null)).toBe(false);
    });
  });

  describe('canAccessAlkosto', () => {
    it('strictly denies Sairu Valles in every combination (even if role is tampered to ADMIN)', () => {
      expect(canAccessAlkosto({ username: 'SAIRU VALLES', role: 'VENDEDOR', vendorId: '26' })).toBe(false);
      expect(canAccessAlkosto({ username: 'Sairú Valles', role: 'VENDEDOR', route: 'CUENTAS CLAVES 2 - SV' })).toBe(false);
      expect(canAccessAlkosto({ username: 'CUENTAS CLAVES 2 - SV', role: 'VENDEDOR' })).toBe(false);
      // Explicit deny overrides tampered role
      expect(canAccessAlkosto({ username: 'SAIRU VALLES', role: 'ADMIN', vendorId: '26' })).toBe(false);
      expect(canAccessAlkosto({ username: 'OTHER', role: 'ADMIN', vendorId: '26' })).toBe(false);
      expect(canAccessAlkosto({ username: 'OTHER', role: 'SUPERVISOR', route: 'CUENTAS CLAVES 2 - SV' })).toBe(false);
    });

    it('allows authorized profiles (ADMIN and SUPERVISOR) without regression', () => {
      expect(canAccessAlkosto({ username: 'ADMIN', role: 'ADMIN', vendorId: 'ADMIN' })).toBe(true);
      expect(canAccessAlkosto({ username: 'ALI PEREZ', role: 'SUPERVISOR', vendorId: 'SUPERVISOR_ALI_PEREZ' })).toBe(true);
      expect(canAccessAlkosto({ username: 'NELSON FINOL', role: 'SUPERVISOR' })).toBe(true);
      expect(canAccessAlkosto({ username: 'JOHNATAN SOTO', role: 'SUPERVISOR' })).toBe(true);
    });

    it('denies unauthenticated or standard vendor profiles by least privilege', () => {
      expect(canAccessAlkosto(null)).toBe(false);
      expect(canAccessAlkosto({ username: 'MARIA BRICEÑO', role: 'VENDEDOR', vendorId: '1' })).toBe(false);
      expect(canAccessAlkosto({ username: 'OSCAR ORTIZ', role: 'VENDEDOR', vendorId: '46' })).toBe(false);
    });
  });

  describe('isAlkostoRouteUrl', () => {
    it('detects direct path, hash, and query parameter attempts to open Alkosto', () => {
      expect(isAlkostoRouteUrl({ pathname: '/alkosto', hash: '', search: '' })).toBe(true);
      expect(isAlkostoRouteUrl({ pathname: '/alkosto/historial', hash: '', search: '' })).toBe(true);
      expect(isAlkostoRouteUrl({ pathname: '/', hash: '#alkosto', search: '' })).toBe(true);
      expect(isAlkostoRouteUrl({ pathname: '/', hash: '#ALKOSTO/ocr', search: '' })).toBe(true);
      expect(isAlkostoRouteUrl({ pathname: '/', hash: '', search: '?tab=ALKOSTO' })).toBe(true);
      expect(isAlkostoRouteUrl({ pathname: '/', hash: '#cobros', search: '' })).toBe(false);
      expect(isAlkostoRouteUrl({ pathname: '/', hash: '', search: '?tab=DEGUSTACIONES' })).toBe(false);
    });
  });

  describe('Client-side data layer guard in alkostoService', () => {
    it('blocks direct service reads/writes/OCR when stored session belongs to Sairu Valles', async () => {
      localStorage.setItem('dashboard_fdv_vendor', 'SAIRU VALLES');
      localStorage.setItem('dashboard_fdv_role', 'VENDEDOR');
      localStorage.setItem('dashboard_fdv_vendor_id', '26');
      localStorage.setItem('dashboard_fdv_active_route', 'CUENTAS CLAVES 2 - SV');

      let receivedOrders: any[] | null = null;
      const unsub = subscribeAlkostoOrders((orders) => {
        receivedOrders = orders;
      });
      expect(receivedOrders).toEqual([]);
      unsub();

      await expect(
        saveAlkostoOrder({
          id: 'alk-blocked',
          numeroPedido: '0001',
          sucursalCodigo: '7498',
          sucursalNombre: 'Alkosto 1',
          vendedora: 'SAIRU VALLES',
          ruta: 'CUENTAS CLAVES 2 - SV',
          fechaPedido: '2026-11-19',
          fechaEntregaEstimada: '2026-11-20',
          condicionPago: 'Crédito 15 días',
          createdAt: '2026-11-19T12:00:00.000Z',
          items: [],
          totalBultos: 0,
          totalKilos: 0,
          totalUSD: 0,
          estado: 'BORRADOR'
        })
      ).rejects.toThrow(ALKOSTO_ACCESS_DENIED_MESSAGE);

      await expect(parseAlkostoOrderImage('JVBERi0xLjQK', 'application/pdf', 'test.pdf')).rejects.toThrow(
        ALKOSTO_ACCESS_DENIED_MESSAGE
      );
    });
  });
});
