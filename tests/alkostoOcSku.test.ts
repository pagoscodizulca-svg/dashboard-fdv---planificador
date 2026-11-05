import { describe, it, expect } from 'vitest';
import { matchProductoCodizulca } from '../src/services/productosCodizulca';
import {
  sanitizeAlkostoRawPdfText,
  extraerPedidosNormalizadosDeOC
} from '../src/services/alkostoOcParser';
import { resolverProductoPorCodigoODescripcion } from '../src/services/alkostoService';

const OC_ITEMS: any[] = [
  {
    codigo: '7590377000411',
    codigoBarra: '7590377000411',
    descripcion: 'ARVEJAS VERDES VENCAMPO 400GR/1.00',
    totalCantidad: 95,
    costoUnitario: 20,
    tiendas: { AK01: 15, AK02: 10, AK03: 15, AK04: 15, AK05: 15, AK07: 15, AK10: 10 }
  },
  {
    codigo: '7590377000459',
    codigoBarra: '7590377000459',
    descripcion: 'CARAOTAS NEGRAS VENCAMPO 400GR/1.00',
    totalCantidad: 70,
    costoUnitario: 20,
    tiendas: { AK02: 20, AK04: 20, AK09: 20, AK10: 10 }
  }
];

describe('Lector OC Alkosto - matcher de SKU', () => {
  it('EAN exacto -> SKU oficial (nunca 1555)', () => {
    expect(matchProductoCodizulca('7590377000411', 'ARVEJAS VERDES VENCAMPO 400GR/1.00').codigo).toBe('1642');
    expect(matchProductoCodizulca('7590377000459', 'CARAOTAS NEGRAS VENCAMPO 400GR/1.00').codigo).toBe('1644');
  });

  it('producto sin EAN/sustantivo en catálogo -> PENDIENTE y conserva descripción', () => {
    const r = matchProductoCodizulca('7590377999999', 'GARBANZOS VENCAMPO 400GR/1.00');
    expect(r.codigo).not.toBe('1555');
    expect(r.matchExacto).toBe(false);
    expect(r.codigo).toBe('PENDIENTE');
    expect(String(r.descripcion).toUpperCase()).toContain('GARBANZOS');
  });

  it('marca + gramaje no producen match en el catálogo Alkosto', () => {
    const r = resolverProductoPorCodigoODescripcion('', 'GARBANZOS VENCAMPO 400GR');
    expect(r).toBeUndefined();
  });

  it('sanitiza 15:00 -> 15.00 y 0:00 -> 0.00', () => {
    const out = sanitizeAlkostoRawPdfText('AK03 15:00 AK08 0:00');
    expect(out).toContain('15.00');
    expect(out).toContain('0.00');
    expect(out).not.toMatch(/\d:\d{2}/);
  });
});

describe('Desglose por sucursal', () => {
  const res = extraerPedidosNormalizadosDeOC({
    initialData: { items: OC_ITEMS } as any,
    filasActuales: [],
    tiendaSeleccionada: 'CONSOLIDADO',
    enviarLoteCompleto: true,
    idClienteSeleccionado: '',
    clienteNombreSeleccionado: '',
    numero_oc: '0000056393',
    vendedor: 'SAIRU VALLES',
    fechaISO: '2026-11-05'
  });

  it('genera 8 pedidos con id_cliente correcto', () => {
    expect(res.pedidos).toHaveLength(8);
    expect(res.strictPayloads.map(p => p.id_cliente)).toEqual([
      '007498', '007499', '007497', '007500', '007502', '007680', '008160', '008306'
    ]);
    res.strictPayloads.forEach(p => {
      expect(p.numero_oc).toBe('0000056393');
      expect(p.vendedor).toBe('Sairu Valles');
    });
  });

  it('cada pedido solo contiene renglones con cantidad > 0 y SKU correcto', () => {
    const ak01 = res.strictPayloads.find(p => p.sucursal_tag === 'AK01')!;
    expect(ak01.renglones).toHaveLength(1);
    expect(ak01.renglones[0].codigo).toBe('1642');
    const ak09 = res.strictPayloads.find(p => p.sucursal_tag === 'AK09')!;
    expect(ak09.renglones).toHaveLength(1);
    expect(ak09.renglones[0].codigo).toBe('1644');
    res.strictPayloads.forEach(p => p.renglones.forEach(r => expect(r.cantidad).toBeGreaterThan(0)));
    res.strictPayloads.forEach(p => p.renglones.forEach(r => expect(r.codigo).not.toBe('1555')));
  });

  it('el total del lote cuadra con la OC ($3,300.00)', () => {
    const total = res.strictPayloads.reduce((a, p) => a + p.monto_pedido, 0);
    expect(Number(total.toFixed(2))).toBe(3300);
  });
});

