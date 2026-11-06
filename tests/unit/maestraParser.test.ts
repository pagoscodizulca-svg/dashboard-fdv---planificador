import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseMaestraBytes,
  parseMaestraTexto,
  parseCsvRows,
  sanitizarRifMaestra,
  aEnteroEstricto,
  MaestraParseError,
  REFERENCIA_MAESTRA_NOV_2026
} from '../../src/utils/maestraParser';

const CSV_PATH = path.resolve(__dirname, '../fixtures/MAESTRA_ACTIVA_ultima_version.csv');
const bytes = fs.readFileSync(CSV_PATH);

describe('maestraParser · archivo real MAESTRA ACTIVA (Noviembre 2026)', () => {
  const r = parseMaestraBytes(new Uint8Array(bytes));
  const rep = r.reporte;

  it('el fixture realmente trae BOM UTF-8 y se quita antes de leer encabezados', () => {
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    expect(rep.banner).toContain('MAESTRA CLIENTES ACTIVOS NOVIEMBRE 2026');
    expect(rep.warnings.some(w => w.tipo === 'CODIFICACION_NO_UTF8')).toBe(false);
  });

  it('KPIs exactos: 2,784 leídas / 2,717 válidas / 67 descartadas', () => {
    expect(rep.filasLeidas).toBe(2784);
    expect(rep.filasValidas).toBe(REFERENCIA_MAESTRA_NOV_2026.filasValidas);
    expect(rep.filasDescartadas).toBe(REFERENCIA_MAESTRA_NOV_2026.filasDescartadas);
    expect(rep.filasLeidas).toBe(rep.filasValidas + rep.filasDescartadas);
  });

  it('3 supervisores y 30 vendedores', () => {
    expect(rep.totalSupervisores).toBe(3);
    expect(r.supervisores).toEqual(['ALI PEREZ', 'JOHNATAN SOTO', 'NELSON FINOL']);
    expect(rep.totalVendedores).toBe(30);
    const porSup = (s: string) => r.vendedores.filter(v => v.supervisor === s).length;
    expect(porSup('NELSON FINOL')).toBe(13);
    expect(porSup('JOHNATAN SOTO')).toBe(9);
    expect(porSup('ALI PEREZ')).toBe(8);
  });

  it('116 filas con RIF pendiente (#N/D -> null); 115 clientes únicos por el duplicado 8377', () => {
    expect(rep.rifPendientesFilas).toBe(REFERENCIA_MAESTRA_NOV_2026.rifPendientesFilas);
    expect(rep.rifPendientesClientes).toBe(115);
    expect(r.clientes.filter(c => c.rif === null)).toHaveLength(115);
    expect(r.clientes.some(c => c.rif === '#N/D')).toBe(false);
  });

  it('1 Id duplicado (8377): gana la última fila (vendedor 40) y queda en warnings', () => {
    expect(rep.idsDuplicadosEnArchivo).toBe(1);
    expect(rep.filasDuplicadasEliminadas).toBe(1);
    expect(rep.clientesUnicos).toBe(2716);
    expect(r.clientes).toHaveLength(2716);
    const dup = rep.warnings.filter(w => w.tipo === 'ID_CLIENTE_DUPLICADO');
    expect(dup).toHaveLength(1);
    expect(dup[0].idCliente).toBe(8377);
    expect(dup[0].lineas).toHaveLength(2);
    expect(r.clientes.find(c => c.idCliente === 8377)!.idVendedor).toBe(40);
  });

  it('todos los Id / ID VENDEDOR son enteros, sin espacios residuales en textos', () => {
    for (const c of r.clientes) {
      expect(Number.isInteger(c.idCliente)).toBe(true);
      expect(Number.isInteger(c.idVendedor)).toBe(true);
      for (const t of [c.supervisor, c.vendedor, c.razonSocial, c.rif ?? '']) {
        expect(t).toBe(t.trim());
        expect(t).not.toMatch(/\s{2,}/);
      }
    }
  });

  it('respeta comillas: el cliente 7856 conserva "; C.A." y su RIF no se corrompe', () => {
    const c = r.clientes.find(x => x.idCliente === 7856)!;
    expect(c.razonSocial).toBe('COMERCIALIZADORA YUSI 600; C.A.');
    expect(c.rif).toBe('J-507625117');
  });

  it('RIF con espacio interno se normaliza (V- 11722409 -> V-11722409) y la Ñ sobrevive', () => {
    expect(r.clientes.some(c => c.rif === 'V-11722409')).toBe(true);
    expect(r.vendedores.some(v => v.nombre === 'MARIA BRICEÑO')).toBe(true);
  });

  it('informativo: 11 grupos de RIF compartido (sucursales Alkosto / Familia Center) involucrando 42 clientes', () => {
    expect(rep.rifsCompartidos).toEqual({ grupos: 11, filas: 42 });
  });

  it('las 67 filas residuales no generan warnings de datos reales', () => {
    expect(rep.warnings.filter(w => w.tipo === 'FILA_PARCIAL_DESCARTADA')).toHaveLength(0);
  });
});

describe('maestraParser · casos de borde', () => {
  const HEAD = 'SUPERVISOR;ID VENDEDOR;Vendedor;Id;Razón Social;RIF';

  it('detecta encabezado aunque no haya banner', () => {
    const r = parseMaestraTexto(`${HEAD}\nA;1;V1;10;CLI;J-1\n`);
    expect(r.reporte.banner).toBeNull();
    expect(r.reporte.filasValidas).toBe(1);
  });

  it('lanza error claro si faltan encabezados', () => {
    expect(() => parseMaestraTexto('A;B;C\n1;2;3\n')).toThrow(MaestraParseError);
  });

  it('descarta Id o ID VENDEDOR vacíos / NaN y lo reporta como parcial si hay contenido real', () => {
    const r = parseMaestraTexto(`${HEAD}\nA;1;V1;10;CLI;J-1\nA;;V1;11;SIN VEND;J-2\nA;1;V1;NaN;NAN ID;J-3\n;;;;;#N/D\n`);
    expect(r.reporte.filasLeidas).toBe(4);
    expect(r.reporte.filasValidas).toBe(1);
    expect(r.reporte.filasDescartadas).toBe(3);
    expect(r.reporte.warnings.filter(w => w.tipo === 'FILA_PARCIAL_DESCARTADA')).toHaveLength(2);
  });

  it('descarta Id no numérico con warning', () => {
    const r = parseMaestraTexto(`${HEAD}\nA;1;V1;12X;CLI;J-1\n`);
    expect(r.reporte.filasValidas).toBe(0);
    expect(r.reporte.warnings[0].tipo).toBe('ID_NO_NUMERICO_DESCARTADO');
  });

  it('deduplicación determinista: última fila gana y el resultado no depende de otros ids', () => {
    const r = parseMaestraTexto(`${HEAD}\nA;1;V1;10;PRIMERA;J-1\nB;2;V2;10;SEGUNDA;J-2\n`);
    expect(r.clientes).toHaveLength(1);
    expect(r.clientes[0]).toMatchObject({ idCliente: 10, idVendedor: 2, razonSocial: 'SEGUNDA', rif: 'J-2' });
  });

  it('detecta ID VENDEDOR con nombre o supervisor inconsistente y conserva el primero', () => {
    const r = parseMaestraTexto(`${HEAD}\nA;1;V1;10;C1;J-1\nB;1;OTRO;11;C2;J-2\n`);
    expect(r.vendedores).toEqual([{ idVendedor: 1, nombre: 'V1', supervisor: 'A' }]);
    expect(r.reporte.warnings.some(w => w.tipo === 'VENDEDOR_INCONSISTENTE')).toBe(true);
  });

  it('parseCsvRows: comillas con delimitador, comillas escapadas y comilla literal a mitad de campo', () => {
    expect(parseCsvRows('a;"b;c";d\r\n')).toEqual([['a', 'b;c', 'd']]);
    expect(parseCsvRows('"x ""y"" z";2\n')).toEqual([['x "y" z', '2']]);
    expect(parseCsvRows('INV "X" CA;2\n')).toEqual([['INV "X" CA', '2']]);
  });

  it('sanitizarRifMaestra / aEnteroEstricto', () => {
    for (const v of ['#N/D', '#N/A', 'N/A', '', '   ', 'null', undefined, null]) expect(sanitizarRifMaestra(v)).toBeNull();
    expect(sanitizarRifMaestra('  j-298974656   ')).toBe('J-298974656');
    expect(aEnteroEstricto(' 8377 ')).toBe(8377);
    expect(aEnteroEstricto('8377.0')).toBe(8377);
    expect(aEnteroEstricto('')).toBeNull();
    expect(aEnteroEstricto('1.5')).toBeNull();
    expect(aEnteroEstricto('#N/D')).toBeNull();
  });

  it('cae a windows-1252 con warning cuando los bytes no son UTF-8', () => {
    const latin1 = Uint8Array.from(Buffer.from(`${HEAD}\nA;1;MARIA BRICE\xD1O;10;CLI;J-1\n`, 'latin1'));
    const r = parseMaestraBytes(latin1);
    expect(r.vendedores[0].nombre).toBe('MARIA BRICEÑO');
    expect(r.reporte.warnings.some(w => w.tipo === 'CODIFICACION_NO_UTF8')).toBe(true);
  });
});
