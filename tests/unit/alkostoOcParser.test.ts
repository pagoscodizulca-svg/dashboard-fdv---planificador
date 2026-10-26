import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import {
  parseNumeroEstricto,
  limpiarDescripcionAlkosto,
  normalizarFechaAlkosto,
  assertValidInputPayload,
  mapNumericCellsToRow,
  parseAlkostoRawText,
  extractPositionedTextFromAlkostoPdfBuffer,
  validateAndNormalizeAlkostoOC,
  AlkostoParseValidationError
} from '../../src/services/alkostoOcParser';
import { resolverProductoPorCodigoODescripcion } from '../../src/services/alkostoService';

// Textos reales extraídos del stream interno de las Órdenes de Compra de Alkosto (con el desfase real de EMP del ERP)
const REAL_OC_0000055165_STREAM_TEXT = `
ALKOSTO DONDE COMPRAR ES GANAR, C.A. - SEDE: AKOP
CALLE 78 DR PORTILLO LOCAL 17-71 SECTOR PARAISO MARACAIBO ZULIA
RIF: J-413243580
19 de Octubre del 2026 Pág.: 0001 de 0002
Dias de Credito
 21
Orden Nro.: 0000055165
TASA DE CAMBIO: 881.0664
Emisión 19/10/2026
Entrega 22/10/2026
Proveedor: 409876136
CODIZULCA, C.A.
EMP AK01 AK02 AK03 AK04 AK05 AK06 AK07 AK08 AK09 AK10 Cantidad
7590377000077 MORTADELA ESPECIAL DE POLLO 900GR ASTURIAS / 2.40
 0.00 10.00 0.00 0.00 10.00 10 0.00 10.00 20.00 0.00 0.00 10.00 0.00 0.00 60.00 20.0000 0.00 0.00 0.00 20.0000 1,200.00
7590377000589 MORTADELA ESPECIAL DE POLLO ASTURIA 500GR / 1.38
 0.00 5.00 0.00 0.00 0.00 20 0.00 0.00 5.00 0.00 0.00 5.00 0.00 0.00 15.00 22.0000 0.00 0.00 0.00 22.0000 330.00
100881 PECHUGA DE PAVO ASTURIAS X KG / 6.88
 0.00 78.00 65.00 104.00 78.00 0 0.00 65.00 104.00 39.00 130.00 104.00 0.00 0.00 767.00 5.5000 0.00 0.00 0.00 5.5000 4,218.50
100882 PECHUGA DE POLLO ASTURIAS X KG / 6.69
 0.00 75.00 30.00 75.00 45.00 0 0.00 45.00 75.00 30.00 105.00 45.00 0.00 0.00 525.00 5.3500 0.00 0.00 0.00 5.3500 2,808.75
100929 JAMON COCIDO DE PAVO AHUMADO SUPERIOR ASTURIAS X KG / 7.80
 0.00 44.00 0.00 44.00 44.00 0 0.00 110.00 44.00 0.00 66.00 44.00 0.00 0.00 396.00 6.2500 0.00 0.00 0.00 6.2500 2,475.00
SubTotal ( AK ) 11,032.25
21 DIAS BS BCV DESPACHO DESDE EL 20/10/26 100% AVERIA,
FAMILIA CENTER, C.A.
AV LIBERTADOR CALLE 100 CC PLAZA LAGO NIVEL PB LOCAL 54 SECTOR
RIF: J-501398836
19 de Octubre del 2026 Pág.: 0002 de 0002
Orden Nro.: 0000055165
TASA DE CAMBIO: 881.0664
EMP FC06 FC07 Cantidad
7590377000077 MORTADELA ESPECIAL DE POLLO 900GR ASTURIAS / 2.40
 0.00 5.00 0.00 10 0.00 0.00 0.00 10.00 0.00 15.00 20.0000 0.00 0.00 0.00 20.0000 300.00
7590377000589 MORTADELA ESPECIAL DE POLLO ASTURIA 500GR / 1.38
 0.00 5.00 0.00 20 0.00 0.00 0.00 0.00 0.00 5.00 22.0000 0.00 0.00 0.00 22.0000 110.00
100881 PECHUGA DE PAVO ASTURIAS X KG / 6.88
 0.00 26.00 65.00 0 78.00 65.00 65.00 75.00 0.00 374.00 5.5000 0.00 0.00 0.00 5.5000 2,057.00
100882 PECHUGA DE POLLO ASTURIAS X KG / 6.69
 0.00 15.00 30.00 0 30.00 30.00 30.00 60.00 0.00 195.00 5.3500 0.00 0.00 0.00 5.3500 1,043.25
100929 JAMON COCIDO DE PAVO AHUMADO SUPERIOR ASTURIAS X KG / 7.80
 0.00 0.00 0.00 0 0.00 22.00 22.00 0.00 0.00 44.00 6.2500 0.00 0.00 0.00 6.2500 275.00
SubTotal ( FC ) 3,785.25
`;

const REAL_OC_0000055175_STREAM_TEXT = `
ALKOSTO DONDE COMPRAR ES GANAR, C.A. - SEDE: AKOP
RIF: J-413243580
19 de Octubre del 2026 Pág.: 0001 de 0003
Dias de Credito
 15
Orden Nro.: 0000055175
TASA DE CAMBIO: 881.0664
Emisión 19/10/2026
Entrega 22/10/2026
EMP AK01 AK02 AK03 AK04 AK05 AK06 AK07 AK08 AK09 AK10 Cantidad
7591289609129 MORTADELA DE POLLO DEL CORRAL 1KG / 3.78
 0.00 10.00 15.00 10.00 20.00 12 0.00 30.00 10.00 20.00 10.00 20.00 0.00 0.00 145.00 36.0000 0.00 0.00 0.00 36.0000 5,220.00
7591289400023 NUGGETS DE POLLO DEL CORRAL 460GR / 5.84
16.00 0.00 0.00 0.00 24.00 0 0.00 0.00 36.00 0.00 12.00 12.00 0.00 0.00 84.00 3.8800 0.00 0.00 0.00 3.8800 325.92
5412873178161 PAPAS FRITAS CONGELADAS MARQUISE 2,5KG / 6.99
 0.00 10.00 15.00 30.00 30.00 4 0.00 20.00 70.00 0.00 30.00 20.00 0.00 0.00 225.00 22.8000 0.00 0.00 0.00 22.8000 5,130.00
7591210000513 CREMA DE LECHE PURISIMA 500GR / 5.89
16.00 0.00 0.00 1.00 2.00 6 0.00 0.00 0.00 0.00 1.00 2.00 0.00 0.00 6.00 25.6300 0.00 0.00 0.00 25.6300 153.78
100281 QUESO MOZZARELLA CORLASA X KG / 12.00
 0.00 0.00 0.00 0.00 0.00 0 0.00 0.00 60.00 0.00 0.00 0.00 0.00 0.00 60.00 10.0000 0.00 0.00 0.00 10.0000 600.00
SubTotal ( AK ) 11,429.70
FAMILIA CENTER, C.A.
RIF: J-501398836
Orden Nro.: 0000055175
7591289609129 MORTADELA DE POLLO DEL CORRAL 1KG / 3.78
 0.00 10.00 5.00 12 5.00 0.00 5.00 5.00 5.00 35.00 36.0000 0.00 0.00 0.00 36.0000 1,260.00
5412873178161 PAPAS FRITAS CONGELADAS MARQUISE 2,5KG / 6.99
 0.00 0.00 0.00 4 10.00 0.00 0.00 0.00 0.00 10.00 22.8000 0.00 0.00 0.00 22.8000 228.00
7591210000513 CREMA DE LECHE PURISIMA 500GR / 5.89
16.00 0.00 0.00 6 0.00 0.00 0.00 1.00 0.00 1.00 25.6300 0.00 0.00 0.00 25.6300 25.63
SubTotal ( FC ) 1,513.63
`;

describe('Unit & Regression: alkostoOcParser', () => {
  describe('parseNumeroEstricto & helpers', () => {
    it('should parse Venezuelan, Anglo, and 4-decimal ERP numbers accurately', () => {
      expect(parseNumeroEstricto('11,032.25')).toBe(11032.25);
      expect(parseNumeroEstricto('11.032,25')).toBe(11032.25);
      expect(parseNumeroEstricto('20.0000')).toBe(20);
      expect(parseNumeroEstricto('5.3500')).toBe(5.35);
      expect(parseNumeroEstricto('25.6300')).toBe(25.63);
      expect(parseNumeroEstricto('$ 1,200.00')).toBe(1200);
      expect(parseNumeroEstricto('')).toBe(0);
      expect(parseNumeroEstricto(null)).toBe(0);
    });

    it('should strip trailing / PVP reference from Alkosto descriptions without altering product weights', () => {
      expect(limpiarDescripcionAlkosto('MORTADELA ESPECIAL DE POLLO 900GR ASTURIAS / 2.40'))
        .toBe('MORTADELA ESPECIAL DE POLLO 900GR ASTURIAS');
      expect(limpiarDescripcionAlkosto('PAPAS FRITAS CONGELADAS MARQUISE 2,5KG / 6.99'))
        .toBe('PAPAS FRITAS CONGELADAS MARQUISE 2,5KG');
      expect(limpiarDescripcionAlkosto('PECHUGA DE PAVO ASTURIAS X KG')).toBe('PECHUGA DE PAVO ASTURIAS X KG');
    });

    it('should normalize DD/MM/YYYY and YYYY-MM-DD dates', () => {
      expect(normalizarFechaAlkosto('22/10/2026')).toBe('22/10/2026');
      expect(normalizarFechaAlkosto('2026-10-22')).toBe('2026-10-22');
      expect(normalizarFechaAlkosto('')).toBe('');
    });
  });

  describe('Regression: OC 0000055165 (Asturias Multi-Page Alkosto + Familia Center)', () => {
    it('should unscramble EMP and store columns (AK01..AK10 and FC01..FC07) with 100% mathematical accuracy', () => {
      const parsed = parseAlkostoRawText(REAL_OC_0000055165_STREAM_TEXT);

      expect(parsed.ordenNro).toBe('0000055165');
      expect(parsed.diasCredito).toBe(21);
      expect(parsed.tasaCambio).toBe(881.0664);
      expect(parsed.fechaEmision).toBe('19/10/2026');
      expect(parsed.fechaEntrega).toBe('22/10/2026');
      expect(parsed.subtotalAlkosto).toBe(11032.25);
      expect(parsed.subtotalFamiliaCenter).toBe(3785.25);
      expect(parsed.items).toHaveLength(5);

      // Renglón 1: 7590377000077 -> SKU 1496 (900GR)
      const r1 = parsed.items[0];
      expect(r1.codigo).toBe('1496');
      expect(r1.emp).toBe(10);
      expect(r1.costoUnitario).toBe(20);
      expect(r1.totalCantidad).toBe(60);
      expect(r1.totalRenglon).toBe(1200);
      expect(r1.tiendas).toEqual({
        AK01: 10,
        AK04: 10,
        AK05: 20,
        AK09: 10,
        AK10: 10,
        FC01: 5,
        FC06: 10
      });

      // Renglón 2: 7590377000589 -> SKU 1497 (500GR - NUNCA debe contaminarse con 1496)
      const r2 = parsed.items[1];
      expect(r2.codigo).toBe('1497');
      expect(r2.emp).toBe(20);
      expect(r2.costoUnitario).toBe(22);
      expect(r2.totalCantidad).toBe(15);
      expect(r2.totalRenglon).toBe(330);
      expect(r2.tiendas).toEqual({
        AK01: 5,
        AK05: 5,
        AK10: 5,
        FC01: 5
      });

      // Renglón 3: 100881 -> SKU 1512 Pechuga de Pavo
      const r3 = parsed.items[2];
      expect(r3.codigo).toBe('1512');
      expect(r3.costoUnitario).toBe(5.5);
      expect(r3.totalCantidad).toBe(767);
      expect(r3.totalRenglon).toBe(4218.5);
      expect(r3.tiendas).toEqual({
        AK01: 78,
        AK02: 65,
        AK03: 104,
        AK04: 78,
        AK05: 104,
        AK06: 39,
        AK07: 130,
        AK09: 65,
        AK10: 104,
        FC01: 26,
        FC02: 65,
        FC03: 78,
        FC04: 65,
        FC05: 65,
        FC06: 75
      });
    });
  });

  describe('Regression: OC 0000055175 (Del Corral / Marquise / Purísima / Corlasa)', () => {
    it('should accurately parse all items without confusing Nuggets (047) with Mortadela (21) or EMP with AK05', () => {
      const parsed = parseAlkostoRawText(REAL_OC_0000055175_STREAM_TEXT);

      expect(parsed.ordenNro).toBe('0000055175');
      expect(parsed.diasCredito).toBe(15);
      expect(parsed.subtotalAlkosto).toBe(11429.7);
      expect(parsed.subtotalFamiliaCenter).toBe(1513.63);
      expect(parsed.items).toHaveLength(5);

      // R1: Mortadela Del Corral 1KG (EMP=12 no debe caer en AK05; AK05=10, AK06=20, AK07=10, AK08=0, AK09=30, AK10=20)
      const r1 = parsed.items[0];
      expect(r1.codigo).toBe('21');
      expect(r1.emp).toBe(12);
      expect(r1.totalCantidad).toBe(145);
      expect(r1.costoUnitario).toBe(36);
      expect(r1.totalRenglon).toBe(5220);
      expect(r1.tiendas).toEqual({
        AK01: 10,
        AK02: 15,
        AK03: 10,
        AK04: 20,
        AK05: 10,
        AK06: 20,
        AK07: 10,
        AK09: 30,
        AK10: 20,
        FC01: 10,
        FC02: 5,
        FC03: 5,
        FC05: 5,
        FC06: 5,
        FC07: 5
      });

      // R2: Nuggets de Pollo Del Corral 460GR -> SKU 047 (NUNCA SKU 21)
      const r2 = parsed.items[1];
      expect(r2.codigo).toBe('047');
      expect(r2.totalCantidad).toBe(84);
      expect(r2.costoUnitario).toBe(3.88);
      expect(r2.totalRenglon).toBe(325.92);
      expect(r2.tiendas).toEqual({
        AK04: 24,
        AK05: 36,
        AK07: 12,
        AK10: 12
      });

      // R3: Papas Fritas Marquise 2.5KG -> SKU 1360 (EMP=4 no debe caer en AK05)
      const r3 = parsed.items[2];
      expect(r3.codigo).toBe('1360');
      expect(r3.emp).toBe(4);
      expect(r3.totalCantidad).toBe(225);
      expect(r3.costoUnitario).toBe(22.8);
      expect(r3.totalRenglon).toBe(5130);
      expect(r3.tiendas?.FC03).toBe(10);
    });
  });

  describe('Direct Binary PDF Parsing (Real PDF Files in Workspace/Downloads)', () => {
    const pdfCandidates = [
      { file: 'ORDEN CODIZULCA ASTURIA 19-10.pdf', oc: '0000055165', subAk: 11032.25, subFc: 3785.25, count: 5 },
      { file: 'ORDEN CODIZULCA 19-10.pdf', oc: '0000055175', subAk: 11429.70, subFc: 1513.63, count: 5 },
      { file: 'ORDEN CODIZULCA 13-10.pdf', oc: '0000054877', subAk: 15605.15, subFc: 2158.48, count: 6 },
      { file: 'ORDEN CODIZULCA ASTURIA 06-10.pdf', oc: '0000054461', subAk: 14500.50, subFc: 3944.25, count: 4 }
    ];

    for (const cand of pdfCandidates) {
      it(`should deterministically parse binary PDF ${cand.file} (${cand.oc}) if present`, () => {
        const fullPath = path.resolve(process.cwd(), '..', cand.file);
        if (!fs.existsSync(fullPath)) return;

        const buf = fs.readFileSync(fullPath);
        const text = extractPositionedTextFromAlkostoPdfBuffer(buf, zlib.inflateSync);
        expect(text).toBeTruthy();

        const result = parseAlkostoRawText(text!);
        expect(result.ordenNro).toBe(cand.oc);
        expect(result.subtotalAlkosto).toBeCloseTo(cand.subAk, 2);
        expect(result.subtotalFamiliaCenter).toBeCloseTo(cand.subFc, 2);
        expect(result.items).toHaveLength(cand.count);
      });
    }
  });

  describe('Schema Validation & Guardrails (Edge Cases & Corrupted Inputs)', () => {
    it('should throw AlkostoParseValidationError on null, empty string, or empty items array', () => {
      expect(() => assertValidInputPayload(null)).toThrow(AlkostoParseValidationError);
      expect(() => assertValidInputPayload('   ')).toThrow(AlkostoParseValidationError);
      expect(() => validateAndNormalizeAlkostoOC({ ordenNro: '0000055165', items: [] }))
        .toThrow(AlkostoParseValidationError);
    });

    it('should throw AlkostoParseValidationError in strictMath mode when store sum disagrees with totalCantidad', () => {
      const corruptedOrder = {
        ordenNro: '0000099999',
        items: [
          {
            codigo: '1496',
            descripcion: 'MORTADELA ESPECIAL DE POLLO 900GR ASTURIAS',
            totalCantidad: 100, // Suma real de tiendas es 30 -> desalineación crítica
            costoUnitario: 20,
            totalRenglon: 2000,
            tiendas: { AK01: 10, AK02: 20 }
          }
        ]
      };

      expect(() => validateAndNormalizeAlkostoOC(corruptedOrder, { strictMath: true }))
        .toThrow(AlkostoParseValidationError);
    });

    it('should never overwrite an unknown numeric barcode with a false-positive fuzzy match', () => {
      const unknownProduct = resolverProductoPorCodigoODescripcion(
        '7599999999999',
        'MORTADELA ESPECIAL DE POLLO NUEVA PRESENTACION 250GR'
      );
      expect(unknownProduct).toBeUndefined();
    });
  });
});
