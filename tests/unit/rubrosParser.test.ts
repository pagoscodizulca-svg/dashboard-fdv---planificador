import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbookFull } from '../../src/services/googleSheetsParser';

function buildWorkbook() {
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: any[][]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);

  // Activación por Cliente (formato Noviembre 2026): sin Aceite/Pollo; la columna combinada legacy puede seguir existiendo
  add('Activación por Cliente', [
    ['CODIGO', 'RAZON SOCIAL', 'VENDEDOR', 'AZUCAR', 'ESTANDAR Y SUPERIOR ASTURIAS', 'MORTADELA SALPICAO Y ASTURIAS'],
    [329, 'LA NUEVA CARNICERIA', 'MARIA BRICEÑO', 'SI', '', ''],
    [332, 'MINIMARKET I&F', 'MARIA BRICEÑO', '', '', 'SI'], // legacy combinado: NO debe activar Mortadela Asturias ni Salpicao
    [335, 'ABASTO LUZ', 'MARIA BRICEÑO', '', 'SI', '']
  ]);
  // Hoja de compras de leche en polvo Vencampo
  add('leche', [
    ['Id Cliente', 'Cliente', 'Cajas'],
    [329, 'LA NUEVA CARNICERIA', 5]
  ]);
  // Grid: encabezado real del Google Sheet (Fila 1 con los 5 nombres nuevos y Fila 2 con sub-encabezados antiguos "Meta Aceite " / "Meta azucar")
  add('Grid de Activación por Vendedor', [
    [null, null, 'AZUCAR', null, 'LECHE VENCAMPO', null, 'POLLO', null, 'ESTANDAR Y SUPERIOR ASTURIAS', null, 'MORTADELA SALPICAO Y ASTURIAS'],
    ['Vendedor', 'CARTERA', 'Meta Aceite ', 'Activados', 'Meta azucar', 'Activados', 'Meta pollo', 'Activados', 'Meta ESTANDAR Y SUPERIOR ASTURIAS', 'Activados', 'Meta MORTADELA SALPICAO Y ASTURIAS', 'Activados'],
    ['MARIA BRICEÑO', 125, 70, 24, 28, 16, 40, 20, 70, 15, 40, 13],
    ['OSWALDO CHURION', 65, 39, 6, 15, 2, 15, '-', 35, 3, 35, 3]
  ]);
  return wb;
}

const masterClients = [
  { cliente_codigo: '329', cliente_nombre: 'LA NUEVA CARNICERIA', vendedor_id: 'MARIA BRICEÑO', vendedor_nombre: 'MARIA BRICEÑO' },
  { cliente_codigo: '332', cliente_nombre: 'MINIMARKET I&F', vendedor_id: 'MARIA BRICEÑO', vendedor_nombre: 'MARIA BRICEÑO' },
  { cliente_codigo: '335', cliente_nombre: 'ABASTO LUZ', vendedor_id: 'MARIA BRICEÑO', vendedor_nombre: 'MARIA BRICEÑO' }
];

// Ventas netas del mes por cliente/artículo (ventas_historial)
const ventasMes = [
  { id_cliente: '000329', id_articulo: '1519', articulo: 'MORTADELA ESP D/POLLO SALPICAO 10UNDX900GR', cajas: 3 },
  { id_cliente: '332', id_articulo: '1464', articulo: 'MORT. NAVIDEÑA ASTURIAS XKG', cajas: 2 },
  { id_cliente: '335', id_articulo: '1574', articulo: 'LECHE EN POLVO VENCAMPO 10X400GR', cajas: 4 },
  { id_cliente: '335', id_articulo: '1519', articulo: 'SALPICAO', cajas: -2 }
];

describe('parseWorkbookFull · 5 categorías de activación (Grid Cols C-L)', () => {
  const parsed = parseWorkbookFull(XLSX, buildWorkbook(), { periodo: '2026-11', masterClients, ventasMes });
  const byId = (id: string) => parsed.activacionApiRows.find((r: any) => r.id === id)!;

  it('LECHE VENCAMPO: se activa por su hoja Y por ventas del mes', () => {
    expect(byId('329').cats.LECHE_VENCAMPO).toBe(true);
    expect(byId('329').cajas.LECHE_VENCAMPO).toBe(5);
    expect(byId('335').cats.LECHE_VENCAMPO).toBe(true);
    expect(byId('332').cats.LECHE_VENCAMPO).toBe(false);
  });

  it('MORTADELA SALPICAO Y ASTURIAS se activa correctamente en la cartera', () => {
    expect(byId('332').cats.MORTADELA_SALPICAO).toBe(true);
    expect(byId('335').cats.MORTADELA_SALPICAO).toBe(false);
  });

  it('AZUCAR y ESTANDAR Y SUPERIOR ASTURIAS siguen leyéndose de la hoja por cliente', () => {
    expect(byId('329').cats.AZUCAR).toBe(true);
    expect(byId('335').cats.ESTANDAR_ASTURIAS).toBe(true);
  });

  it('el estado ACTIVO del cliente se calcula con los 5 rubros activos', () => {
    expect(byId('329').status).toBe('ACTIVO');
    expect(byId('332').status).toBe('ACTIVO');
    expect(byId('335').status).toBe('ACTIVO');
  });

  it('metas del Grid: lee los 5 pares de columnas (C-L) sin confundirse por "Meta Aceite " / "Meta azucar" en Fila 2', () => {
    const cats = [...new Set(parsed.metasApiRows.map((m: any) => m.categoria))];
    expect(cats).toEqual([
      'AZUCAR',
      'LECHE VENCAMPO',
      'POLLO',
      'ESTANDAR Y SUPERIOR ASTURIAS',
      'MORTADELA SALPICAO Y ASTURIAS'
    ]);
    const mMaria = (c: string) => parsed.metasApiRows.find((x: any) => x.vendedorId === 'MARIA BRICEÑO' && x.categoria === c)!;
    expect(mMaria('AZUCAR')).toMatchObject({ meta: 70, activados: 24 });
    expect(mMaria('LECHE VENCAMPO')).toMatchObject({ meta: 28, activados: 16 });
    expect(mMaria('POLLO')).toMatchObject({ meta: 40, activados: 20 });
    expect(mMaria('ESTANDAR Y SUPERIOR ASTURIAS')).toMatchObject({ meta: 70, activados: 15 });
    expect(mMaria('MORTADELA SALPICAO Y ASTURIAS')).toMatchObject({ meta: 40, activados: 13 });
  });

  it('convierte celdas con guion "-" en 0 sin generar NaN ni sobrescribir con conteos antiguos', () => {
    const mOswaldoPollo = parsed.metasApiRows.find((x: any) => x.vendedorId === 'OSWALDO CHURION' && x.categoria === 'POLLO')!;
    expect(mOswaldoPollo).toMatchObject({ meta: 15, activados: 0 });
    expect(Number.isNaN(mOswaldoPollo.activados)).toBe(false);
  });
});
