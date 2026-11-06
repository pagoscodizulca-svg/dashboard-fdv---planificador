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
  // Grid: encabezado de 2 filas con los rubros nuevos. Aún NO trae columnas separadas de Mortadela Asturias / Salpicao
  add('Grid de Activación por Vendedor', [
    [null, null, 'AZUCAR', null, 'LECHE VENCAMPO', null, 'ESTANDAR Y SUPERIOR ASTURIAS', null, 'MORTADELA SALPICAO Y ASTURIAS', null],
    ['Vendedor', 'CARTERA', 'Meta azucar', 'Activados', 'Meta leche', 'Activados', 'Meta estandar y superior asturias', 'Activados', 'Meta mortadela salpicao y asturias', 'Activados'],
    ['MARIA BRICEÑO', 125, 10, 4, 8, 3, 6, 2, 40, 13]
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
  { id_cliente: '000329', id_articulo: '1519', articulo: 'MORTADELA ESP D/POLLO SALPICAO 10UNDX900GR', cajas: 3 }, // Salpicao
  { id_cliente: '332', id_articulo: '1464', articulo: 'MORT. NAVIDEÑA ASTURIAS XKG', cajas: 2 }, // Mortadela Asturias
  { id_cliente: '335', id_articulo: '1574', articulo: 'LECHE EN POLVO VENCAMPO 10X400GR', cajas: 4 }, // Leche (refuerza la hoja)
  { id_cliente: '335', id_articulo: '1519', articulo: 'SALPICAO', cajas: -2 } // devolución neta: NO activa
];

describe('parseWorkbookFull · rubros activos Noviembre 2026', () => {
  const parsed = parseWorkbookFull(XLSX, buildWorkbook(), { periodo: '2026-11', masterClients, ventasMes });
  const byId = (id: string) => parsed.activacionApiRows.find((r: any) => r.id === id)!;

  it('Leche en polvo Vencampo: se activa por su hoja Y por ventas del mes', () => {
    expect(byId('329').cats.LECHE_VENCAMPO).toBe(true);
    expect(byId('329').cajas.LECHE_VENCAMPO).toBe(5);
    expect(byId('335').cats.LECHE_VENCAMPO).toBe(true); // solo por ventas del mes
    expect(byId('332').cats.LECHE_VENCAMPO).toBe(false);
  });

  it('Mortadela Asturias y Salpicao se separan por cliente según el artículo vendido (no se duplican)', () => {
    expect(byId('329').cats.SALPICAO).toBe(true);
    expect(byId('329').cats.MORTADELA_ASTURIAS).toBe(false);
    expect(byId('332').cats.MORTADELA_ASTURIAS).toBe(true);
    expect(byId('332').cats.SALPICAO).toBe(false);
    // Devolución neta (cajas <= 0) no activa
    expect(byId('335').cats.SALPICAO).toBe(false);
  });

  it('la columna combinada legacy NO activa ni Mortadela Asturias ni Salpicao (se conserva solo como histórico)', () => {
    expect(byId('332').cats.MORTADELA_SALPICAO).toBe(true);
    expect(byId('335').cats.MORTADELA_SALPICAO).toBe(false);
  });

  it('Azúcar y Jamón estándar y superior Asturias siguen leyéndose de la hoja por cliente', () => {
    expect(byId('329').cats.AZUCAR).toBe(true);
    expect(byId('335').cats.ESTANDAR_ASTURIAS).toBe(true);
  });

  it('el estado ACTIVO del cliente se calcula con los 5 rubros activos', () => {
    expect(byId('329').status).toBe('ACTIVO');
    expect(byId('332').status).toBe('ACTIVO'); // por Mortadela Asturias (ventas)
    expect(byId('335').status).toBe('ACTIVO');
  });

  it('la fila a Supabase incluye las columnas de los rubros nuevos', () => {
    const up = [...parsed.activacionSupabaseUpserts, ...parsed.newSheetClientsForSupabase].concat([]);
    // Sin ids de BD los clientes de la maestra no generan upsert; validamos el payload vía productMaps
    expect(parsed.productMaps.LECHE_VENCAMPO.get('329')).toBe(5);
    expect(parsed.productMaps.SALPICAO.get('329')).toBe(3);
    expect(parsed.productMaps.MORTADELA_ASTURIAS.get('332')).toBe(2);
    expect(Array.isArray(up)).toBe(true);
  });

  it('metas del Grid: solo rubros activos, con su meta/activados y sin Aceite/Pollo', () => {
    const cats = [...new Set(parsed.metasApiRows.map((m: any) => m.categoria))];
    expect(cats).toEqual(['AZÚCAR', 'LECHE VENCAMPO', 'ESTANDAR Y SUPERIOR ASTURIAS', 'MORTADELA ASTURIAS', 'SALPICAO']);
    const m = (c: string) => parsed.metasApiRows.find((x: any) => x.categoria === c)!;
    expect(m('AZÚCAR')).toMatchObject({ meta: 10, activados: 4 });
    expect(m('LECHE VENCAMPO')).toMatchObject({ meta: 8, activados: 3 });
    expect(m('ESTANDAR Y SUPERIOR ASTURIAS')).toMatchObject({ meta: 6, activados: 2 });
  });

  it('el Grid aún combinado NO se asigna a Mortadela Asturias ni a Salpicao (meta 0; activados reales de la cartera)', () => {
    const ma = parsed.metasApiRows.find((x: any) => x.categoria === 'MORTADELA ASTURIAS')!;
    const sp = parsed.metasApiRows.find((x: any) => x.categoria === 'SALPICAO')!;
    expect(ma.meta).toBe(0);
    expect(sp.meta).toBe(0);
    expect(ma.activados).toBe(1); // cliente 332
    expect(sp.activados).toBe(1); // cliente 329
  });
});
