import { describe, it, expect } from 'vitest';
import {
  normalizeSucursal,
  isValidSucursal,
  assertValidSucursal,
  inferSucursalFromLegacyMetadata,
  validateCrossBranchSubmission
} from '../../src/utils/sucursalScope';
import {
  checkDateAvailability,
  countVendorDegustacionesInWeek,
  DEFAULT_CONFIG,
  getNextAvailableBookingDate
} from '../../src/services/degustacionesService';
import {
  hydrateVendorProfilesFromMasterCatalog,
  isRouteMatch,
  getVendorProfile
} from '../../src/utils/vendorRoutes';
import { Degustacion } from '../../src/types';

describe('Unit: Multisede Sucursal Scope & Zero-Trust Cross-Branch Guards', () => {
  describe('normalizeSucursal & assertValidSucursal', () => {
    it('normalizes CENTRO and OCCIDENTE variants strictly', () => {
      expect(normalizeSucursal('centro')).toBe('CENTRO');
      expect(normalizeSucursal('  SEDE CENTRO ')).toBe('CENTRO');
      expect(normalizeSucursal('occidente')).toBe('OCCIDENTE');
      expect(normalizeSucursal('SUCURSAL OCCIDENTE')).toBe('OCCIDENTE');
      expect(normalizeSucursal('ORIENTE')).toBeNull();
      expect(normalizeSucursal('')).toBeNull();
      expect(normalizeSucursal(null)).toBeNull();
      expect(isValidSucursal('CENTRO')).toBe(true);
      expect(isValidSucursal('OCCIDENTE')).toBe(true);
      expect(isValidSucursal('SUR')).toBe(false);
    });

    it('throws descriptive error on invalid sucursal in assertValidSucursal', () => {
      expect(assertValidSucursal('CENTRO')).toBe('CENTRO');
      expect(assertValidSucursal('OCCIDENTE')).toBe('OCCIDENTE');
      expect(() => assertValidSucursal('ORIENTE')).toThrow(/CENTRO.*OCCIDENTE/);
    });

    it('infers legacy metadata safely without leaking Occidente to Centro', () => {
      expect(inferSucursalFromLegacyMetadata(undefined, 'CARACAS / GRAN CARACAS')).toBe('CENTRO');
      expect(inferSucursalFromLegacyMetadata(undefined, 'VALENCIA CARABOBO')).toBe('CENTRO');
      expect(inferSucursalFromLegacyMetadata(undefined, 'MARACAIBO ZULIA')).toBe('OCCIDENTE');
      expect(inferSucursalFromLegacyMetadata('CENTRO', 'ZULIA')).toBe('CENTRO');
    });
  });

  describe('validateCrossBranchSubmission (Zero-Trust BFF Guard)', () => {
    it('accepts valid CENTRO submission when session, vendor, store and route belong to CENTRO', () => {
      const res = validateCrossBranchSubmission({
        sessionRole: 'VENDEDOR',
        sessionSucursal: 'CENTRO',
        payloadSucursal: 'CENTRO',
        vendorSucursal: 'CENTRO',
        storeSucursal: 'CENTRO',
        routeSucursal: 'CENTRO',
        storeExistsInCatalog: true,
        requireCatalogStore: true,
        resolvedRoute: 'RUTA-CCS-01'
      });
      expect(res).toEqual({ ok: true, sucursal: 'CENTRO' });
    });

    it('accepts valid OCCIDENTE submission when session, vendor, store and route belong to OCCIDENTE', () => {
      const res = validateCrossBranchSubmission({
        sessionRole: 'VENDEDOR',
        sessionSucursal: 'OCCIDENTE',
        payloadSucursal: 'OCCIDENTE',
        vendorSucursal: 'OCCIDENTE',
        storeSucursal: 'OCCIDENTE',
        routeSucursal: 'OCCIDENTE',
        storeExistsInCatalog: true,
        requireCatalogStore: true,
        resolvedRoute: 'OSCAR ORTIZ'
      });
      expect(res).toEqual({ ok: true, sucursal: 'OCCIDENTE' });
    });

    it('blocks CENTRO vendor attempting to select an OCCIDENTE store (403 CROSS_BRANCH_STORE_FORBIDDEN)', () => {
      const res = validateCrossBranchSubmission({
        sessionRole: 'VENDEDOR',
        sessionSucursal: 'CENTRO',
        payloadSucursal: 'CENTRO',
        vendorSucursal: 'CENTRO',
        storeSucursal: 'OCCIDENTE',
        storeExistsInCatalog: true,
        requireCatalogStore: true,
        resolvedRoute: 'RUTA-CCS-01'
      });
      expect(res.ok).toBe(false);
      expect(res.status).toBe(403);
      expect(res.code).toBe('CROSS_BRANCH_STORE_FORBIDDEN');
    });

    it('blocks OCCIDENTE vendor attempting to select a CENTRO store (403 CROSS_BRANCH_STORE_FORBIDDEN)', () => {
      const res = validateCrossBranchSubmission({
        sessionRole: 'VENDEDOR',
        sessionSucursal: 'OCCIDENTE',
        payloadSucursal: 'OCCIDENTE',
        vendorSucursal: 'OCCIDENTE',
        storeSucursal: 'CENTRO',
        storeExistsInCatalog: true,
        requireCatalogStore: true,
        resolvedRoute: 'OSCAR ORTIZ'
      });
      expect(res.ok).toBe(false);
      expect(res.status).toBe(403);
      expect(res.code).toBe('CROSS_BRANCH_STORE_FORBIDDEN');
    });

    it('blocks payload sucursal tampering when CENTRO vendor sends payloadSucursal=OCCIDENTE', () => {
      const res = validateCrossBranchSubmission({
        sessionRole: 'VENDEDOR',
        sessionSucursal: 'CENTRO',
        payloadSucursal: 'OCCIDENTE',
        vendorSucursal: 'CENTRO',
        storeSucursal: 'CENTRO',
        storeExistsInCatalog: true,
        requireCatalogStore: true,
        resolvedRoute: 'RUTA-CCS-01'
      });
      expect(res.ok).toBe(false);
      expect(res.status).toBe(403);
      expect(res.code).toBe('SUCURSAL_TAMPERING_DETECTED');
    });

    it('blocks uncataloged free-text store when authoritative catalog is active', () => {
      const res = validateCrossBranchSubmission({
        sessionRole: 'VENDEDOR',
        sessionSucursal: 'CENTRO',
        payloadSucursal: 'CENTRO',
        vendorSucursal: 'CENTRO',
        storeSucursal: null,
        storeExistsInCatalog: false,
        requireCatalogStore: true,
        resolvedRoute: 'RUTA-CCS-01'
      });
      expect(res.ok).toBe(false);
      expect(res.status).toBe(400);
      expect(res.code).toBe('UNCATALOGED_STORE_FORBIDDEN');
    });

    it('blocks consolidated synthetic route ALL_MY_ROUTES', () => {
      const res = validateCrossBranchSubmission({
        sessionRole: 'VENDEDOR',
        sessionSucursal: 'OCCIDENTE',
        payloadSucursal: 'OCCIDENTE',
        vendorSucursal: 'OCCIDENTE',
        storeSucursal: 'OCCIDENTE',
        storeExistsInCatalog: true,
        requireCatalogStore: true,
        resolvedRoute: 'ALL_MY_ROUTES'
      });
      expect(res.ok).toBe(false);
      expect(res.status).toBe(400);
      expect(res.code).toBe('INVALID_CONSOLIDATED_ROUTE');
    });
  });

  describe('Multisede Quota & Route Isolation', () => {
    it('isolates 18 daily slots (9 morning + 9 afternoon) strictly per sucursal', () => {
      const futureDate = getNextAvailableBookingDate();
      const occidenteFull: Degustacion[] = Array.from({ length: 18 }, (_, i) => ({
        id: `occ-slot-${i}`,
        sucursal: 'OCCIDENTE',
        clienteCodigo: `OCC-${i + 1}`,
        clienteNombre: `TIENDA OCCIDENTE ${i + 1}`,
        vendedorNombre: 'OSCAR ORTIZ',
        vendedorId: 'OSCAR ORTIZ',
        ruta: 'OSCAR ORTIZ',
        fecha: futureDate,
        turno: i < 9 ? 'MAÑANA' : 'TARDE',
        hora: i < 9 ? '09:00 AM - 01:00 PM' : '02:00 PM - 07:00 PM',
        productos: ['ESPALDA'],
        kilosEstimados: 5,
        personasEstimadas: 120,
        requierePromotora: true,
        materialPop: true,
        contactoPunto: 'Encargado',
        telefonoContacto: '0414-0000000',
        observaciones: '',
        estado: 'SOLICITADA',
        createdAt: new Date().toISOString()
      }));

      const availOccidente = checkDateAvailability(futureDate, occidenteFull, DEFAULT_CONFIG, 'OCCIDENTE');
      expect(availOccidente.disponible).toBe(false);
      expect(availOccidente.cuposDisponibles).toBe(0);
      expect(availOccidente.cuposMananaDisponibles).toBe(0);
      expect(availOccidente.cuposTardeDisponibles).toBe(0);

      const availCentro = checkDateAvailability(futureDate, occidenteFull, DEFAULT_CONFIG, 'CENTRO');
      expect(availCentro.disponible).toBe(true);
      expect(availCentro.cuposDisponibles).toBe(18);
      expect(availCentro.cuposMananaDisponibles).toBe(9);
      expect(availCentro.cuposTardeDisponibles).toBe(9);

      expect(countVendorDegustacionesInWeek('OSCAR ORTIZ', futureDate, occidenteFull, 'OCCIDENTE')).toBe(18);
      expect(countVendorDegustacionesInWeek('OSCAR ORTIZ', futureDate, occidenteFull, 'CENTRO')).toBe(0);
    });

    it('isolates hydrated CENTRO vendor profiles from OCCIDENTE route matching', () => {
      hydrateVendorProfilesFromMasterCatalog([
        {
          username: 'CARLOS MENDOZA CENTRO',
          nombre: 'CARLOS MENDOZA CENTRO',
          ruta: 'RUTA-CCS-01',
          sucursal: 'CENTRO',
          activo: true
        }
      ]);

      const prof = getVendorProfile('CARLOS MENDOZA CENTRO', 'CENTRO');
      expect(prof.sucursal).toBe('CENTRO');
      expect(
        isRouteMatch('RUTA-CCS-01', 'RUTA-CCS-01', 'CARLOS MENDOZA CENTRO', 'VENDEDOR', 'CENTRO')
      ).toBe(true);
      expect(
        isRouteMatch('RUTA-CCS-01', 'RUTA-CCS-01', 'CARLOS MENDOZA CENTRO', 'VENDEDOR', 'OCCIDENTE')
      ).toBe(false);
    });
  });
});
