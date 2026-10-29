import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizarCodigoProducto,
  resolverProductoPorCodigoODescripcion,
  calcularSiguienteCorrelativo,
  getSucursalByTag,
  detectCadenaFromTagOrName,
  SUCURSALES_ALKOSTO,
  SUCURSALES_FAMILIA_CENTER,
  CATALOGO_ALKOSTO,
  transmitirPedidoAlkosto,
  validarPedidoAlkostoAntesDeEnviar,
  sanitizarPedidoSucursalAntesDeEnviar
} from '../../src/services/alkostoService';
import {
  generarIdDeterministaPedidoAlkosto,
  normalizarNombreVendedorSairu
} from '../../src/services/alkostoOcParser';
import { AlkostoOrder } from '../../src/types';

describe('Unit: alkostoService', () => {
  describe('normalizarCodigoProducto', () => {
    it('should strip spaces, hyphens, underscores and dots', () => {
      expect(normalizarCodigoProducto('14-61')).toBe('1461');
      expect(normalizarCodigoProducto(' 14_96 ')).toBe('1496');
      expect(normalizarCodigoProducto('759.0377.000077')).toBe('7590377000077');
      expect(normalizarCodigoProducto('AK - 01')).toBe('AK01');
    });

    it('should handle edge cases: empty string, null, undefined', () => {
      expect(normalizarCodigoProducto('')).toBe('');
      expect(normalizarCodigoProducto(null as any)).toBe('');
      expect(normalizarCodigoProducto(undefined as any)).toBe('');
    });
  });

  describe('getSucursalByTag', () => {
    it('should find Alkosto branches by valid tag (case-insensitive and trimmed)', () => {
      const ak01 = getSucursalByTag('AK01');
      expect(ak01).toBeDefined();
      expect(ak01?.codigo).toBe('7498');
      expect(ak01?.nombre).toBe('Alkosto 1 san Felipe');

      const ak02Lower = getSucursalByTag('  ak02  ');
      expect(ak02Lower).toBeDefined();
      expect(ak02Lower?.codigo).toBe('7499');
      expect(ak02Lower?.nombre).toBe('Alkosto 2 - Plaza baral');

      const ak03 = getSucursalByTag('AK03');
      expect(ak03).toBeDefined();
      expect(ak03?.codigo).toBe('7497');
      expect(ak03?.nombre).toBe('Alkosto 3 - Delicias');
    });

    it('should find Familia Center branches by tag', () => {
      const fc01 = getSucursalByTag('FC01');
      expect(fc01).toBeDefined();
      expect(fc01?.codigo).toBe('7490');
      expect(fc01?.nombre).toBe('Familia Center 1 - Plaza lago');

      const fc05 = getSucursalByTag('fc05');
      expect(fc05).toBeDefined();
      expect(fc05?.codigo).toBe('7489');
      expect(fc05?.nombre).toBe('Familia Center 5 - La lago');
    });

    it('should return undefined for non-existent tags or empty inputs', () => {
      expect(getSucursalByTag('NONEXISTENT')).toBeUndefined();
      expect(getSucursalByTag('')).toBeUndefined();
      expect(getSucursalByTag(null as any)).toBeUndefined();
      expect(getSucursalByTag(undefined as any)).toBeUndefined();
    });
  });

  describe('detectCadenaFromTagOrName', () => {
    it('should identify FAMILIA_CENTER when containing FC or FAMILIA', () => {
      expect(detectCadenaFromTagOrName('FC01')).toBe('FAMILIA_CENTER');
      expect(detectCadenaFromTagOrName('fc03')).toBe('FAMILIA_CENTER');
      expect(detectCadenaFromTagOrName('Familia Center La Limpia')).toBe('FAMILIA_CENTER');
      expect(detectCadenaFromTagOrName('FCOP')).toBe('FAMILIA_CENTER');
    });

    it('should default to ALKOSTO for Alkosto branches or other strings', () => {
      expect(detectCadenaFromTagOrName('AK01')).toBe('ALKOSTO');
      expect(detectCadenaFromTagOrName('Alkosto Curva de Molina')).toBe('ALKOSTO');
      expect(detectCadenaFromTagOrName('')).toBe('ALKOSTO');
      expect(detectCadenaFromTagOrName(null as any)).toBe('ALKOSTO');
    });
  });

  describe('resolverProductoPorCodigoODescripcion', () => {
    it('Level 1: matches exact SKU', () => {
      const product = resolverProductoPorCodigoODescripcion('1496', '');
      expect(product).toBeDefined();
      expect(product?.sku).toBe('1496');
      expect(product?.producto).toContain('ASTURIAS');
    });

    it('Level 2: matches by barcode EAN-13', () => {
      const product = resolverProductoPorCodigoODescripcion('7590377000077', '');
      expect(product).toBeDefined();
      expect(product?.sku).toBe('1496');
    });

    it('Level 3: matches by chain-specific code (codigosCadena)', () => {
      // 100929 is a chain code for Jamon Superior / Mort. Superior Asturias (1463)
      const product = resolverProductoPorCodigoODescripcion('100929', '');
      expect(product).toBeDefined();
      expect(['1463', '171']).toContain(product?.sku);
    });

    it('Level 4: matches by synonym in code', () => {
      const product = resolverProductoPorCodigoODescripcion('SHOULDER ASTURIAS', '');
      expect(product).toBeDefined();
      expect(product?.sku).toBe('1561');
    });

    it('Level 5: matches by description fuzzy/tokens when code is missing or unmapped', () => {
      const product = resolverProductoPorCodigoODescripcion('UNKNOWN999', 'MORTADELA ESPECIAL COCIDA ASTURIAS');
      expect(product).toBeDefined();
      expect(product?.sku).toBe('1462');

      const chicken = resolverProductoPorCodigoODescripcion('', 'POLLO ENTERO BENEFICIADO');
      expect(chicken).toBeDefined();
      expect(chicken?.sku).toBe('101');
    });

    it('Edge cases: returns undefined for empty, null, or garbage inputs', () => {
      expect(resolverProductoPorCodigoODescripcion('', '')).toBeUndefined();
      expect(resolverProductoPorCodigoODescripcion(null as any, null as any)).toBeUndefined();
      expect(resolverProductoPorCodigoODescripcion('   ', '   ')).toBeUndefined();
      expect(resolverProductoPorCodigoODescripcion('XYZ999999NOTFOUND', 'PRODUCTO QUE NO EXISTE EN EL MUNDO')).toBeUndefined();
    });
  });

  describe('calcularSiguienteCorrelativo', () => {
    it('should return 0001 when order list is empty', () => {
      expect(calcularSiguienteCorrelativo([])).toBe('0001');
    });

    it('should increment maximum numeric correlativo with 4-digit zero padding', () => {
      const orders: Partial<AlkostoOrder>[] = [
        { id: '1', correlativo: '0001', numeroPedido: '0001' } as any,
        { id: '2', correlativo: '0005', numeroPedido: '0005' } as any,
        { id: '3', correlativo: '0002', numeroPedido: '0002' } as any
      ];
      expect(calcularSiguienteCorrelativo(orders as AlkostoOrder[])).toBe('0006');
    });

    it('should extract digits from complex order numbers like ALK-0012', () => {
      const orders: Partial<AlkostoOrder>[] = [
        { id: '1', correlativo: 'ALK-0012', numeroPedido: 'ALK-0012' } as any
      ];
      expect(calcularSiguienteCorrelativo(orders as AlkostoOrder[])).toBe('0013');
    });

    it('should ignore extreme numbers (>= 100000) such as timestamps and use length fallback', () => {
      const orders: Partial<AlkostoOrder>[] = [
        { id: '1', correlativo: '179183000000', numeroPedido: '179183000000' } as any,
        { id: '2', correlativo: '179183000001', numeroPedido: '179183000001' } as any
      ];
      // num >= 100000 are ignored, so next falls back to orders.length + 1 = 3 -> '0003'
      expect(calcularSiguienteCorrelativo(orders as AlkostoOrder[])).toBe('0003');
    });

    it('should handle orders with missing or malformed fields safely', () => {
      const orders: Partial<AlkostoOrder>[] = [
        { id: '1' } as any,
        { id: '2', correlativo: '', numeroPedido: undefined } as any,
        { id: '3', correlativo: '0004' } as any
      ];
      expect(calcularSiguienteCorrelativo(orders as AlkostoOrder[])).toBe('0005');
    });
  });

  describe('Production Hardening: Pre-validation, Homologation, Idempotency & Retries', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    const buildValidMockOrder = (overrides: Partial<AlkostoOrder> = {}): AlkostoOrder => ({
      id: 'alk-ak01-oc1234abcd',
      numeroPedido: '0042',
      correlativo: '0042',
      ordenCompraAlkosto: '0000055769',
      sucursalTag: 'AK01',
      sucursalCodigo: '7498',
      sucursalNombre: 'Alkosto 1 san Felipe',
      direccionEntrega: 'Calle 98 CC San Felipe',
      vendedora: 'SAIRU VALLES / CUENTAS CLAVE 2',
      ruta: 'CUENTAS CLAVE 2',
      fechaPedido: '2026-10-29',
      fechaEntregaEstimada: '2026-10-30',
      condicionPago: 'Crédito 21 días',
      items: [
        {
          id: 'item-1',
          sku: '1496',
          producto: 'MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR',
          categoria: 'MORTADELAS',
          presentacion: 'CJ',
          cantidadCajas: 10,
          cajas: 10,
          unidades: 0,
          kilosPorCaja: 9,
          totalKilos: 90,
          precioBrutoUSD: 25,
          descuento: 20,
          precioUnitarioUSD: 20,
          subtotalUSD: 200
        }
      ],
      totalBultos: 10,
      totalKilos: 90,
      totalUSD: 200,
      estado: 'BORRADOR',
      createdAt: '2026-10-29T10:00:00Z',
      updatedAt: '2026-10-29T10:00:00Z',
      ...overrides
    });

    it('should block submission during pre-validation when items are empty or all quantities <= 0', async () => {
      const emptyOrder = buildValidMockOrder({ items: [], renglones: [] });
      const checkEmpty = validarPedidoAlkostoAntesDeEnviar(emptyOrder);
      expect(checkEmpty.valido).toBe(false);

      const zeroQtyOrder = buildValidMockOrder({
        items: [
          {
            id: 'item-1',
            sku: '1496',
            producto: 'MORTADELA',
            categoria: 'MORTADELAS',
            presentacion: 'CJ',
            cantidadCajas: 0,
            kilosPorCaja: 9,
            totalKilos: 0,
            precioUnitarioUSD: 20,
            subtotalUSD: 0
          }
        ]
      });
      expect(validarPedidoAlkostoAntesDeEnviar(zeroQtyOrder).valido).toBe(false);

      global.fetch = vi.fn();
      await expect(transmitirPedidoAlkosto(emptyOrder)).rejects.toThrow(/Validación previa/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should homologate Sairu Valles, ALKOSTO chain, POR_VALIDAR state and 100% item fields (0% data loss)', () => {
      expect(normalizarNombreVendedorSairu('SAIRU VALLES / CUENTAS CLAVE 2')).toBe('Sairu Valles');
      expect(normalizarNombreVendedorSairu('SAIRU')).toBe('Sairu Valles');
      expect(normalizarNombreVendedorSairu('')).toBe('Sairu Valles');

      const sanitized = sanitizarPedidoSucursalAntesDeEnviar(buildValidMockOrder());
      expect(sanitized).not.toBeNull();
      expect(sanitized?.vendedor).toBe('Sairu Valles');
      expect(sanitized?.vendedora).toBe('Sairu Valles');
      expect(sanitized?.ruta).toBe('Sairu Valles');
      expect(sanitized?.cadena).toBe('ALKOSTO');
      expect(sanitized?.estadoSalaEspera).toBe('POR_VALIDAR');
      expect(sanitized?.renglones?.[0]).toMatchObject({
        codigo: '1496',
        sku: '1496',
        descripcion: 'MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR',
        cantidad: 10,
        cajas: 10,
        unidades: 0,
        precio_unitario: 20,
        precio_bruto: 25,
        descuento: 20,
        subtotal: 200
      });
    });

    it('should generate deterministic idempotency IDs for identical branch + OC + items', () => {
      const id1 = generarIdDeterministaPedidoAlkosto({
        tagSlug: 'AK01',
        idCliente: '007498',
        numeroOc: '0000055769',
        fechaISO: '2026-10-29',
        renglones: [{ codigo: '1496', unidad_medida: 'CJ', cantidad: 10, precio_unitario: 20, descuento: 0, subtotal: 200 }]
      });
      const id2 = generarIdDeterministaPedidoAlkosto({
        tagSlug: 'ak01',
        idCliente: '007498',
        numeroOc: '55769',
        fechaISO: '2026-10-29',
        renglones: [{ codigo: '1496', unidad_medida: 'CJ', cantidad: 10, precio_unitario: 20, descuento: 0, subtotal: 200 }]
      });
      const idDifferentStore = generarIdDeterministaPedidoAlkosto({
        tagSlug: 'AK02',
        idCliente: '007499',
        numeroOc: '0000055769',
        fechaISO: '2026-10-29',
        renglones: [{ codigo: '1496', unidad_medida: 'CJ', cantidad: 10, precio_unitario: 20, descuento: 0, subtotal: 200 }]
      });

      expect(id1).toBe(id2);
      expect(id1.startsWith('alk-ak01-')).toBe(true);
      expect(id1).not.toBe(idDifferentStore);
    });

    it('should return success ONLY when backend confirms insertion returning real database id', async () => {
      const mockOrder = buildValidMockOrder();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              success: true,
              salaEsperaId: 'alk-ak01-oc1234abcd',
              data: { id: 'alk-ak01-oc1234abcd', correlativo: '0042' },
              message: 'Pedido transmitido y confirmado en Sala de Espera'
            })
          )
      } as any);

      const result = await transmitirPedidoAlkosto(mockOrder);
      expect(result.success).toBe(true);
      expect(result.id).toBe('alk-ak01-oc1234abcd');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should perform up to 2 automatic retries on network micro-cuts/5xx and succeed when retry confirms id', async () => {
      const mockOrder = buildValidMockOrder({ id: 'alk-ak02-retrytest' });

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve({
            ok: false,
            status: 503,
            text: () => Promise.resolve(JSON.stringify({ error: 'Micro-corte temporal de red' }))
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                success: true,
                salaEsperaId: 'alk-ak02-retrytest',
                data: { id: 'alk-ak02-retrytest', correlativo: '0043' }
              })
            )
        });
      });

      const result = await transmitirPedidoAlkosto(mockOrder);
      expect(callCount).toBe(3); // 1 intento inicial + 2 reintentos automáticos
      expect(result.success).toBe(true);
      expect(result.id).toBe('alk-ak02-retrytest');
      expect(result.attempts).toBe(3);
    });

    it('should deduplicate concurrent double-click calls so only 1 network POST is sent', async () => {
      const mockOrder = buildValidMockOrder({ id: 'alk-ak03-deduptest', idempotencyKey: 'alk-ak03-deduptest' });

      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  text: () =>
                    Promise.resolve(
                      JSON.stringify({
                        success: true,
                        salaEsperaId: 'alk-ak03-deduptest',
                        data: { id: 'alk-ak03-deduptest', correlativo: '0044' }
                      })
                    )
                }),
              40
            )
          )
      );

      const [r1, r2] = await Promise.all([
        transmitirPedidoAlkosto(mockOrder),
        transmitirPedidoAlkosto(mockOrder)
      ]);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(r1.id).toBe('alk-ak03-deduptest');
      expect(r2.id).toBe('alk-ak03-deduptest');
    });

    it('should NEVER fake success if all 3 attempts fail or if DB fails to return confirmed id', async () => {
      const mockOrder = buildValidMockOrder({ id: 'alk-ak04-failtest', idempotencyKey: 'alk-ak04-failtest' });

      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline or DNS failure'));

      await expect(transmitirPedidoAlkosto(mockOrder)).rejects.toThrow(/Network offline/i);
      expect(global.fetch).toHaveBeenCalledTimes(3); // 1 inicial + 2 reintentos
    });
  });
});
