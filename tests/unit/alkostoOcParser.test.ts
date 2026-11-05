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
  parseAlkostoFlexibleOcrText,
  extractPositionedTextFromAlkostoPdfBuffer,
  extractPositionedTextFromAlkostoPdfBufferAsync,
  validateAndNormalizeAlkostoOC,
  normalizeOrderForCodizulca,
  normalizarUnidadMedidaAlkosto,
  autocorregirTiendasPorFila,
  extraerPedidosNormalizadosDeOC,
  calcularResumenCuadreOC,
  sanitizeBase64Payload,
  detectAlkostoFileMimeType,
  extractCleanJson,
  parseSafeJson,
  sanitizeAndParseOcJson,
  ALKOSTO_OCR_MODEL_CASCADE,
  buildAlkostoOcSystemPrompt,
  construirDistribucionPorTienda,
  construirDistribucionTiendasCanonico,
  normalizarFechaISOAlkosto,
  toCanonicalAlkostoOcJson,
  ALKOSTO_OC_EXTRACTION_SYSTEM_PROMPT,
  ALKOSTO_OC_RESPONSE_SCHEMA,
  AlkostoParseValidationError,
  AlkostoOcrStageError,
  PRODUCTOS_CODIZULCA,
  matchProductoCodizulca,
  toSafeNumber
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
      { file: 'ORDEN CODIZULCA 26-10.pdf', oc: '0000055773', subAk: 11321.85, subFc: 4149.02, count: 6 },
      { file: 'ORDEN CODIZULCA ASTURIA 19-10.pdf', oc: '0000055165', subAk: 11032.25, subFc: 3785.25, count: 5 },
      { file: 'ORDEN CODIZULCA 19-10.pdf', oc: '0000055175', subAk: 11429.70, subFc: 1513.63, count: 5 },
      { file: 'ORDEN CODIZULCA 13-10.pdf', oc: '0000054877', subAk: 15605.15, subFc: 2158.48, count: 6 },
      { file: 'ORDEN CODIZULCA ASTURIA 06-10.pdf', oc: '0000054461', subAk: 14500.50, subFc: 3944.25, count: 4 },
      { file: 'CODIZULCA LECHE.pdf', oc: '0000054457', subAk: 35700.00, subFc: 10450.00, count: 2 }
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

    it('should strictly normalize units of measure (CJ, UND, KG, BLT) without ambiguity', () => {
      expect(normalizarUnidadMedidaAlkosto('CAJAS')).toBe('CJ');
      expect(normalizarUnidadMedidaAlkosto('BULTO')).toBe('CJ');
      expect(normalizarUnidadMedidaAlkosto('CJ')).toBe('CJ');
      expect(normalizarUnidadMedidaAlkosto('UNIDADES')).toBe('UND');
      expect(normalizarUnidadMedidaAlkosto('PIEZA')).toBe('UND');
      expect(normalizarUnidadMedidaAlkosto('UND')).toBe('UND');
      expect(normalizarUnidadMedidaAlkosto('KILOGRAMOS')).toBe('KG');
      expect(normalizarUnidadMedidaAlkosto('KGS')).toBe('KG');
      expect(normalizarUnidadMedidaAlkosto('', 'MORTADELA 10UNDX900GR', 10)).toBe('CJ');
      expect(normalizarUnidadMedidaAlkosto('', 'PECHUGA DE PAVO X KG', 0)).toBe('KG');
    });

    it('should accurately validate and normalize the CODIZULCA 8-column visual OC format and strip empty template rows 4..15', () => {
      const rawVisionCodizulcaForm = {
        CLIENTE: 'Alkosto 1 san Felipe',
        'ID CLIENTE': '7498',
        RUTA: 'SAIRU VALLES / CUENTAS CLAVE 2',
        FECHA: '26/10/2026',
        'ORDEN DE COMPRA': '0200605591',
        SUPERVISOR: 'PEDRO PEREZ',
        CHOFER: 'TRANSPORTE CODIZULCA',
        OBSERVACIONES: 'Dirección de despacho; calle 98 CC san Felipe 1 nivel PB sector casco central.',
        items: [
          {
            'N°': 1,
            UNID: 'BULTOS',
            CANT: 25,
            'CANTIDAD DESPACHADA': '',
            SKU: '1496',
            'DESCRIPCIÓN DEL PRODUCTO': 'MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR',
            PRECIO: '20,00',
            'SUB TOTAL': '500,00'
          },
          {
            'N°': 2,
            UNID: 'UNIDADES',
            CANT: 36,
            'CANTIDAD DESPACHADA': '',
            SKU: '047',
            'DESCRIPCIÓN DEL PRODUCTO': 'NUGGET CORRAL DE 460GM',
            PRECIO: '3,88',
            'SUB TOTAL': '139,68'
          },
          {
            'N°': 3,
            UNID: 'KILOS',
            CANT: 104,
            'CANTIDAD DESPACHADA': '104',
            SKU: '1512',
            'DESCRIPCIÓN DEL PRODUCTO': 'MORT. PECHUGA DE PAVO ASTURIAS X KG',
            PRECIO: '5,50',
            'SUB TOTAL': '572,00'
          },
          // Filas vacías preimpresas de la plantilla (4..6) que deben ser ignoradas automáticamente
          { 'N°': 4, UNID: '', CANT: 0, 'CANTIDAD DESPACHADA': '', SKU: '', 'DESCRIPCIÓN DEL PRODUCTO': '', PRECIO: 0, 'SUB TOTAL': 0 },
          { 'N°': 5, UNID: '', CANT: 0, 'CANTIDAD DESPACHADA': '', SKU: '', 'DESCRIPCIÓN DEL PRODUCTO': '', PRECIO: 0, 'SUB TOTAL': 0 }
        ]
      };

      const validated = validateAndNormalizeAlkostoOC(rawVisionCodizulcaForm, { requireOrdenNro: true });
      expect(validated.ordenNro).toBe('0200605591');
      expect(validated.clienteNombre).toBe('Alkosto 1 san Felipe');
      expect(validated.idCliente).toBe('7498');
      expect(validated.ruta).toBe('SAIRU VALLES / CUENTAS CLAVE 2');
      expect(validated.items).toHaveLength(3);

      expect(validated.items[0]).toMatchObject({
        renglon: 1,
        unid: 'CJ',
        totalCantidad: 25,
        codigo: '1496',
        skuCodizulca: '1496',
        descripcion: 'MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR',
        costoUnitario: 20,
        totalRenglon: 500
      });
      expect(validated.items[1]).toMatchObject({
        renglon: 2,
        unid: 'UND',
        totalCantidad: 36,
        codigo: '047',
        skuCodizulca: '047',
        descripcion: 'NUGGET CORRAL DE 460GM',
        costoUnitario: 3.88,
        totalRenglon: 139.68
      });
      expect(validated.items[2]).toMatchObject({
        renglon: 3,
        unid: 'KG',
        totalCantidad: 104,
        cantDespachada: '104',
        codigo: '1512',
        skuCodizulca: '1512',
        descripcion: 'MORT. PECHUGA DE PAVO ASTURIAS X KG',
        costoUnitario: 5.5,
        totalRenglon: 572
      });
      expect(validated.subtotal).toBe(1211.68);
    });

    it('should automatically recover when OCR swaps UNID and SKU columns', () => {
      const swappedColumnsPayload = {
        ordenNro: '0200605592',
        items: [
          {
            renglon: 1,
            codigo: 'CJ',      // Error típico de visión: puso la unidad en SKU
            unid: '1497',      // y el SKU en UNID
            totalCantidad: 15,
            descripcion: 'MORTADELA ESP D/POLLO ASTURIAS 20UNDX500GR',
            costoUnitario: 22,
            totalRenglon: 330
          }
        ]
      };

      const recovered = validateAndNormalizeAlkostoOC(swappedColumnsPayload);
      expect(recovered.items[0].codigo).toBe('1497');
      expect(recovered.items[0].skuCodizulca).toBe('1497');
      expect(recovered.items[0].unid).toBe('CJ');
      expect(recovered.items[0].totalCantidad).toBe(15);
    });

    it('should autocorrect OCR decimal-gluing (e.g. 200 -> 2.00 in AK10 for 7591210000513 when Total Cantidad is 3.00 and AK04 is 1.00)', () => {
      const correctedStores = autocorregirTiendasPorFila(
        { AK04: 1.0, AK10: 200 },
        3.0
      );
      expect(correctedStores.AK04).toBe(1.0);
      expect(correctedStores.AK10).toBe(2.0);
    });

    it('should strip PVP suffix even without space before slash and homologate all 6 SKUs of OC #0000055773', () => {
      expect(limpiarDescripcionAlkosto('MORTADELA DE POLLO DEL CORRAL 1KG /3.78')).toBe('MORTADELA DE POLLO DEL CORRAL 1KG');
      expect(limpiarDescripcionAlkosto('PAPAS FRITAS CONGELADAS MARQUISE 2,5KG /6.99')).toBe('PAPAS FRITAS CONGELADAS MARQUISE 2,5KG');
      expect(limpiarDescripcionAlkosto('CREMA DE LECHE PURISIMA 500GR /5.89')).toBe('CREMA DE LECHE PURISIMA 500GR');
      expect(limpiarDescripcionAlkosto('CREMA DE LECHE PURISIMA 250GR /3.70')).toBe('CREMA DE LECHE PURISIMA 250GR');

      expect(resolverProductoPorCodigoODescripcion('7591289609129')?.sku).toBe('21');
      expect(resolverProductoPorCodigoODescripcion('7591289400023')?.sku).toBe('047');
      expect(resolverProductoPorCodigoODescripcion('5412873178161')?.sku).toBe('1360');
      expect(resolverProductoPorCodigoODescripcion('100281')?.sku).toBe('100281');
      expect(resolverProductoPorCodigoODescripcion('7591210000513')?.sku).toBe('7591210000513');
      expect(resolverProductoPorCodigoODescripcion('7591210000544')?.sku).toBe('7591210000544');
    });

    it('should extract 16 active branch orders on OC #0000055773 with exact math balance and zero contamination after viewing AK01', () => {
      const fullPath = path.resolve(process.cwd(), '..', 'ORDEN CODIZULCA 26-10.pdf');
      if (!fs.existsSync(fullPath)) return;

      const buf = fs.readFileSync(fullPath);
      const text = extractPositionedTextFromAlkostoPdfBuffer(buf, zlib.inflateSync);
      const parsedOC = parseAlkostoRawText(text!);

      const resumen = calcularResumenCuadreOC(parsedOC);
      expect(resumen).toBeTruthy();
      expect(resumen!.numero_oc).toBe('0000055773');
      expect(resumen!.alkostoCount).toBe(9);
      expect(resumen!.familiaCount).toBe(7);
      expect(resumen!.totalSucursalesActivas).toBe(16);
      expect(resumen!.alkostoMonto).toBeCloseTo(11321.85, 2);
      expect(resumen!.familiaMonto).toBeCloseTo(4149.02, 2);
      expect(resumen!.totalCalculado).toBeCloseTo(15470.87, 2);
      expect(resumen!.cuadreExacto).toBe(true);
      expect(resumen!.textoResumen).toBe(
        'OC #0000055773 | 16 Sucursales Activas (9 Alkosto: $11,321.85 | 7 Familia Center: $4,149.02) | Total OC: $15,470.87 ✓ Cuadre Exacto'
      );

      // Simular que el usuario seleccionó primero la pestaña AK01 (que solo tiene 3 renglones activos: 20x$36 + 10x$22.80 + 45x$10 = $1,398.00) y luego pulsó "Transmitir Lote Completo OC"
      const filasVistaAK01 = [
        { renglon: 1, unid: 'CJ', cantSolicitada: 20, cantDespachada: '', codigo: '21', descripcion: 'MORTADELA DE POLLO DEL CORRAL 1KG', precio: 36, subtotal: 720 },
        { renglon: 2, unid: 'CJ', cantSolicitada: 10, cantDespachada: '', codigo: '1360', descripcion: 'PAPAS FRITAS CONGELADAS MARQUISE 2,5KG', precio: 22.8, subtotal: 228 },
        { renglon: 3, unid: 'KG', cantSolicitada: 45, cantDespachada: '', codigo: '100281', descripcion: 'QUESO MOZZARELLA CORLASA X KG', precio: 10, subtotal: 450 }
      ];

      const lote = extraerPedidosNormalizadosDeOC({
        initialData: parsedOC,
        filasActuales: filasVistaAK01 as any,
        tiendaSeleccionada: 'AK01',
        enviarLoteCompleto: true,
        idClienteSeleccionado: '7498',
        clienteNombreSeleccionado: 'Alkosto 1 san Felipe',
        direccionObservacionFallback: '',
        numero_oc: '0000055773',
        vendedor: 'SAIRU VALLES / CUENTAS CLAVE 2',
        supervisor: 'PEDRO PEREZ',
        chofer: 'TRANSPORTE CODIZULCA',
        cantidadCestas: '0',
        fechaISO: '2026-10-31',
        nroPedido: 'AUTO'
      });

      expect(lote.pedidos).toHaveLength(16);
      const ak01Order = lote.pedidos.find(p => p.sucursalTag === 'AK01');
      expect(ak01Order).toBeDefined();
      expect(ak01Order?.renglones).toHaveLength(3);
      expect(ak01Order?.monto_pedido).toBeCloseTo(1398.00, 2);

      const sumAll16 = Number(
        lote.pedidos.reduce((acc, p) => acc + (p.monto_pedido || 0), 0).toFixed(2)
      );
      expect(sumAll16).toBeCloseTo(15470.87, 2);
    });

    it('should detect dynamic MIME types (JPG, PNG, WEBP, PDF) from magic bytes, Base64 prefixes, and file names', () => {
      // Base64 con prefijo data:...;base64, y espacios
      const rawDataUrl = 'data:image/webp;base64, UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA= \n';
      const clean = sanitizeBase64Payload(rawDataUrl);
      expect(clean).toBe('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=');
      expect(detectAlkostoFileMimeType(clean, 'image/jpeg', 'foto.jpg')).toBe('image/webp');

      // PDF magic bytes (%PDF-)
      const pdfBuf = Buffer.from('%PDF-1.5\n...', 'ascii');
      expect(detectAlkostoFileMimeType(pdfBuf, 'application/octet-stream', 'orden.bin')).toBe('application/pdf');

      // PNG magic bytes (\x89PNG\r\n\x1a\n)
      const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(detectAlkostoFileMimeType(pngBuf, '', 'captura.png')).toBe('image/png');

      // JPEG magic bytes (\xFF\xD8\xFF)
      const jpgBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(detectAlkostoFileMimeType(jpgBuf, '', 'camara.jpg')).toBe('image/jpeg');
    });

    it('should sanitize markdown code blocks before JSON.parse and map distribucionPorTienda bidirectionally', () => {
      const markdownAiResponse = `\`\`\`json
{
  "numero_oc": "0000056001",
  "fecha_emision": "02/11/2026",
  "fecha_entrega": "05/11/2026",
  "clienteCadena": "ALKOSTO",
  "clienteNombre": "ALKOSTO DONDE COMPRAR ES GANAR, C.A.",
  "moneda": "USD",
  "items": [
    {
      "renglon": 1,
      "codigo": "7591289609129",
      "descripcion": "MORTADELA DE POLLO DEL CORRAL 1KG / 3.78",
      "unid": "CAJAS",
      "emp": 12,
      "costoBruto": "38,00",
      "descuento": "5,26",
      "costoUnitario": "$ 36,00",
      "cantidadTotal": 30,
      "totalRenglon": "1.080,00",
      "distribucionPorTienda": [
        { "codigoTienda": "AK01", "nombreTienda": "Alkosto 1 san Felipe", "cantidad": 10 },
        { "codigoTienda": "AK04", "nombreTienda": "Alkosto 4 - Coromoto", "cantidad": 20 }
      ]
    }
  ]
}
\`\`\``;

      const parsedJson = sanitizeAndParseOcJson(markdownAiResponse);
      const normalized = validateAndNormalizeAlkostoOC(parsedJson);

      expect(normalized.ordenNro).toBe('0000056001');
      expect(normalized.numero_oc).toBe('0000056001');
      expect(normalized.fechaEmision).toBe('02/11/2026');
      expect(normalized.moneda).toBe('USD');
      expect(normalized.items).toHaveLength(1);

      const item = normalized.items[0];
      expect(item.codigo).toBe('21');
      expect(item.skuCodizulca).toBe('21');
      expect(item.descripcion).toBe('MORTADELA DE POLLO DEL CORRAL 1KG');
      expect(item.unid).toBe('CJ');
      expect(item.costoBruto).toBe(38);
      expect(item.descuento).toBe(5.26);
      expect(item.costoUnitario).toBe(36);
      expect(item.totalCantidad).toBe(30);
      expect(item.cantidadTotal).toBe(30);
      expect(item.totalRenglon).toBe(1080);
      expect(item.cuadreTiendasValido).toBe(true);
      expect(item.tiendas).toEqual({ AK01: 10, AK04: 20 });
      expect(item.distribucionPorTienda).toEqual([
        { codigoTienda: 'AK01', nombreTienda: 'Alkosto 1 san Felipe', cantidad: 10 },
        { codigoTienda: 'AK04', nombreTienda: 'Alkosto 4 - Coromoto', cantidad: 20 }
      ]);
    });

    it('should validate and export the Canonical JSON Schema (cabecera_orden, renglones, resumen_totales) and enforce all 6 extraction rules', () => {
      expect(ALKOSTO_OC_EXTRACTION_SYSTEM_PROMPT).toContain('cabecera_orden');
      expect(ALKOSTO_OC_EXTRACTION_SYSTEM_PROMPT).toContain('distribucion_tiendas');
      expect(ALKOSTO_OC_EXTRACTION_SYSTEM_PROMPT).toContain('resumen_totales');

      // Regla 4: Formato numérico estándar con $, Bs., % y miles/decimales mixtos
      expect(parseNumeroEstricto('Bs. 1.250,50')).toBe(1250.5);
      expect(parseNumeroEstricto('$ 1,250.00')).toBe(1250);
      expect(parseNumeroEstricto('16%')).toBe(16);
      expect(normalizarFechaISOAlkosto('19/10/2026')).toBe('2026-10-19');

      // Regla 1, 2, 3, 5 y 6: Entrada en formato canónico con comentario JS que debe limpiarse,
      // separación de códigos (codigo_principal, codigo_ean, codigo_interno_alkosto) y alerta_revision en discrepancia OCR
      const rawCanonicalWithComments = `
      {
        "cabecera_orden": {
          "cliente_emisor": "ALKOSTO",
          "receptor_destino": "CODIZULCA",
          "numero_orden_compra": "0000054457",
          "fecha_emision": "06/10/2026",
          "fecha_entrega_estimada": "12/10/2026",
          "moneda": "USD",
          "condicion_pago": "30 DIAS CREDITO",
          "observaciones_generales": "BCV, DESPACHO POR TIENDA / PEDIDO EN BULTOS, DESPACHO 12-13/10"
        },
        "renglones": [
          {
            "numero_renglon": 1,
            "codigo_principal": "7590377000503",
            "codigo_ean": "7590377000503",
            "codigo_interno_alkosto": null,
            "descripcion_producto": "LECHE EN POLVO COMPLETA VENCAMPO 400GR / 2.98",
            "unidad_medida": "BTO",
            "unidades_por_empaque": 24,
            "cantidad_total": 300,
            "distribucion_tiendas": [
              { "codigo_tienda": "AK01", "nombre_tienda": "Alkosto 1 san Felipe", "cantidad": 60 },
              { "codigo_tienda": "AK03", "nombre_tienda": "Alkosto 3 - C2", "cantidad": 60 },
              { "codigo_tienda": "AK04", "nombre_tienda": "Alkosto 4 - Coromoto", "cantidad": 60 },
              { "codigo_tienda": "AK05", "nombre_tienda": "Alkosto 5 - Cabimas", "cantidad": 60 },
              { "codigo_tienda": "AK10", "nombre_tienda": "Alkosto 10 - Sambil", "cantidad": 60 }
            ],
            "costo_unitario": "62,00",
            "porcentaje_descuento": 0,
            "porcentaje_impuesto": 0,
            "monto_total_renglon": "18.600,00",
            "alerta_revision": false,
            "nota_revision": null
          },
          {
            "numero_renglon": 2,
            "codigo_principal": "100881",
            "codigo_ean": null,
            "codigo_interno_alkosto": "100881",
            "descripcion_producto": "PECHUGA DE PAVO ASTURIAS X KG / 6.88",
            "unidad_medida": "KG",
            "unidades_por_empaque": 1,
            "cantidad_total": 100,
            "distribucion_tiendas": [
              { "codigo_tienda": "AK01", "nombre_tienda": "Alkosto 1 san Felipe", "cantidad": 100 }
            ],
            "costo_unitario": "5,50",
            "porcentaje_descuento": 0,
            "porcentaje_impuesto": 0,
            "monto_total_renglon": "599,99", // Discrepancia intencional por lectura borrosa (100 * 5.50 = 550.00 != 599.99)
            "alerta_revision": false,
            "nota_revision": null
          }
        ],
        "resumen_totales": {
          "total_renglones_extraidos": 2,
          "total_unidades_pedidas": 400,
          "subtotal_neto": 19150,
          "total_descuentos": 0,
          "total_impuestos": 0,
          "monto_total_orden": 19150,
          "cuadre_aritmetico_correcto": false
        }
      }`;

      const parsedJson = sanitizeAndParseOcJson(rawCanonicalWithComments);
      const normalized = validateAndNormalizeAlkostoOC(parsedJson, { strictMath: false });
      const canonical = toCanonicalAlkostoOcJson(normalized);

      expect(canonical.cabecera_orden.cliente_emisor).toBe('ALKOSTO');
      expect(canonical.cabecera_orden.receptor_destino).toBe('CODIZULCA');
      expect(canonical.cabecera_orden.numero_orden_compra).toBe('0000054457');
      expect(canonical.cabecera_orden.fecha_emision).toBe('2026-10-06');
      expect(canonical.cabecera_orden.fecha_entrega_estimada).toBe('2026-10-12');
      expect(canonical.cabecera_orden.condicion_pago).toBe('30 DIAS CREDITO');

      expect(canonical.renglones).toHaveLength(2);
      // Renglón 1: cuadre exacto (300 * 62 = 18600)
      expect(canonical.renglones[0].codigo_principal).toBe('7590377000503');
      expect(canonical.renglones[0].codigo_ean).toBe('7590377000503');
      expect(canonical.renglones[0].descripcion_producto).toBe('LECHE EN POLVO COMPLETA VENCAMPO 400GR');
      expect(canonical.renglones[0].unidad_medida).toBe('CJ');
      expect(canonical.renglones[0].unidades_por_empaque).toBe(24);
      expect(canonical.renglones[0].cantidad_total).toBe(300);
      expect(canonical.renglones[0].costo_unitario).toBe(62);
      expect(canonical.renglones[0].monto_total_renglon).toBe(18600);
      expect(canonical.renglones[0].alerta_revision).toBe(false);
      expect(canonical.renglones[0].distribucion_tiendas).toHaveLength(5);

      // Renglón 2: homologación PLU 100881 -> SKU 1512 + preservación de codigo_interno_alkosto + alerta_revision: true por discrepancia aritmética
      expect(canonical.renglones[1].codigo_principal).toBe('1512');
      expect(canonical.renglones[1].codigo_interno_alkosto).toBe('100881');
      expect(canonical.renglones[1].alerta_revision).toBe(true);
      expect(canonical.renglones[1].nota_revision).toContain('Discrepancia aritmética');

      expect(canonical.resumen_totales.total_renglones_extraidos).toBe(2);
      expect(canonical.resumen_totales.total_unidades_pedidas).toBe(400);
      expect(canonical.resumen_totales.subtotal_neto).toBe(19150);
    });

    it('should assign single general store in distribucion_tiendas when order is for a single store in header (Rule 3)', () => {
      const singleStoreOrder = {
        ordenNro: '0200609001',
        clienteNombre: 'Alkosto 1 san Felipe',
        idCliente: '7498',
        items: [
          {
            renglon: 1,
            codigo: '1496',
            descripcion: 'MORTADELA ESPECIAL DE POLLO 900GR ASTURIAS',
            unid: 'CJ',
            emp: 10,
            totalCantidad: 25,
            costoUnitario: 20,
            totalRenglon: 500
          }
        ]
      };

      const normalized = validateAndNormalizeAlkostoOC(singleStoreOrder);
      const canonical = toCanonicalAlkostoOcJson(normalized);

      expect(canonical.renglones[0].distribucion_tiendas).toEqual([
        {
          codigo_tienda: 'AK01',
          nombre_tienda: 'Alkosto 1 san Felipe',
          cantidad: 25
        }
      ]);
    });

    it('should enforce the 5 mandatory OCR resilience steps (model cascade, extractCleanJson, normalizeOrderForCodizulca, and stage diagnostics)', () => {
      // 1. Cascada de modelos en orden exacto (1º gemini-2.5-flash, 2º gemini-2.5-pro, 3º gemini-2.0-flash)
      expect(ALKOSTO_OCR_MODEL_CASCADE).toEqual([
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.0-flash'
      ]);

      // 2. Inyección dinámica de las 17 tiendas sincronizadas (AK01-AK10 y FC01-FC07) y exclusión de AKOP y CI en el prompt
      const dynamicPrompt = buildAlkostoOcSystemPrompt();
      expect(dynamicPrompt).toContain('AK01');
      expect(dynamicPrompt).toContain('AK10');
      expect(dynamicPrompt).toContain('FC01');
      expect(dynamicPrompt).toContain('FC07');
      expect(dynamicPrompt).toContain('AKOP');
      expect(dynamicPrompt).toContain('CI');

      // 3. extractCleanJson y parseSafeJson limpian bloques markdown, extraen entre primera { y última } y no lanzan excepciones
      const noisyText = 'Aquí tienes la extracción:\n```json\n{"cabecera_orden":{"numero_orden":"0000054457","fecha_emision":"06/10/2026","fecha_entrega":"12/10/2026","dias_credito":"30","tasa_cambio":"872.3927","observaciones":"ORDEN LECHE CODIZULCA"},"renglones":[{"numero_renglon":1,"codigo_principal":"7590377000503","descripcion_producto":"LECHE EN POLVO COMPLETA 400GR","unidad_medida":"CJ","unidades_por_empaque":24,"cantidad_total":"240","tiendas":{"AK01":"30","AK02":"25","AK03":25,"AK04":20,"AK05":20,"AK06":20,"AK07":25,"AK08":25,"AK09":25,"AK10":25,"AKOP":999,"CI":888},"costo_unitario":"40.0000","monto_total_renglon":"9,600.00"},{"numero_renglon":2,"codigo_principal":"7590377000503","descripcion_producto":"LECHE EN POLVO COMPLETA 400GR","unidad_medida":"CJ","unidades_por_empaque":24,"cantidad_total":"70","tiendas":{"FC01":"10","FC02":"10","FC03":10,"FC04":10,"FC05":10,"FC06":10,"FC07":10},"costo_unitario":"40.0000","monto_total_renglon":"2,800.00"},{"numero_renglon":3,"codigo_principal":"7590377000510","descripcion_producto":"LECHE EN POLVO COMPLETA 900GR","unidad_medida":"CJ","unidades_por_empaque":12,"cantidad_total":"290","tiendas":{"AK01":30,"AK02":30,"AK03":30,"AK04":30,"AK05":30,"AK06":30,"AK07":30,"AK08":30,"AK09":25,"AK10":25,"AKOP":500,"CI":500},"costo_unitario":"90.0000","monto_total_renglon":"26,100.00"},{"numero_renglon":4,"codigo_principal":"7590377000510","descripcion_producto":"LECHE EN POLVO COMPLETA 900GR","unidad_medida":"CJ","unidades_por_empaque":12,"cantidad_total":"85","tiendas":{"FC01":15,"FC02":15,"FC03":15,"FC04":10,"FC05":10,"FC06":10,"FC07":10},"costo_unitario":"90.0000","monto_total_renglon":"7,650.00"}],"resumen_totales":{"subtotal_alkosto":"35,700.00","subtotal_familia_center":"10,450.00","total_general":"46,150.00"}}\n```\nFin del reporte.';
      const cleanParsed = extractCleanJson(noisyText);
      expect(cleanParsed).toBeTruthy();
      expect(typeof cleanParsed).toBe('object');

      const safeParsed = parseSafeJson(noisyText);
      expect(safeParsed).toBeTruthy();

      // 4. normalizeOrderForCodizulca consolida páginas 1 y 2 por código (7590377000503 y 7590377000510), ignora AKOP y CI, y convierte strings con comas a Number
      const normalized = normalizeOrderForCodizulca(safeParsed);
      expect(normalized.ordenNro).toBe('0000054457');
      expect(normalized.tasaCambio).toBeCloseTo(872.3927, 4);
      expect(normalized.diasCredito).toBe(30);
      expect(normalized.subtotalAlkosto).toBe(35700);
      expect(normalized.subtotalFamiliaCenter).toBe(10450);
      expect(normalized.totalNeto).toBe(46150);

      // Consolidado en exactamente 2 renglones únicos por código (sin duplicar filas entre página 1 y página 2)
      expect(Array.isArray(normalized.items)).toBe(true);
      expect(Array.isArray(normalized.renglones)).toBe(true);
      expect(Array.isArray(normalized.tiendas)).toBe(true);
      expect(normalized.items).toHaveLength(2);
      expect(normalized.tiendas).toHaveLength(17);

      const item503 = normalized.items.find(i => i.codigoBarra === '7590377000503' || i.codigo === '7590377000503')!;
      expect(item503).toBeTruthy();
      expect(item503.costoUnitario).toBe(40);
      expect(item503.tiendas?.AKOP).toBeUndefined();
      expect(item503.tiendas?.CI).toBeUndefined();
      expect(item503.tiendas?.AK01).toBe(30);
      expect(item503.tiendas?.FC01).toBe(10);

      const item510 = normalized.items.find(i => i.codigoBarra === '7590377000510' || i.codigo === '7590377000510')!;
      expect(item510).toBeTruthy();
      expect(item510.costoUnitario).toBe(90);
      expect(item510.tiendas?.AK01).toBe(30);
      expect(item510.tiendas?.FC01).toBe(15);

      // 5. Diagnóstico por etapas AlkostoOcrStageError
      const stageErr = new AlkostoOcrStageError('3-Parseo JSON', 'Fallo de prueba');
      expect(stageErr.message).toBe('Error en Etapa [3-Parseo JSON]: Fallo de prueba');
      expect(stageErr.stage).toBe('3-Parseo JSON');
    });

    it('should deterministically decompress and parse CODIZULCA LECHE.pdf asynchronously using DecompressionStream', async () => {
      const fullPath = path.resolve(process.cwd(), '..', 'CODIZULCA LECHE.pdf');
      if (!fs.existsSync(fullPath)) return;

      const base64Pdf = fs.readFileSync(fullPath).toString('base64');
      const positionedText = await extractPositionedTextFromAlkostoPdfBufferAsync(base64Pdf);
      expect(positionedText).toBeTruthy();

      const parsed = parseAlkostoRawText(positionedText!);
      const normalized = normalizeOrderForCodizulca(parsed);
      expect(normalized.ordenNro).toBe('0000054457');
      expect(normalized.tasaCambio).toBeCloseTo(872.3927, 4);
      expect(normalized.subtotalAlkosto).toBe(35700);
      expect(normalized.subtotalFamiliaCenter).toBe(10450);
      expect(normalized.totalNeto).toBe(46150);
      expect(normalized.items).toHaveLength(2);
    });

    it('should validate ALKOSTO_OC_RESPONSE_SCHEMA and normalize Structured Output camelCase payload (numeroOrden, fechaOrden, tiendasDetectadas, desglosePorTienda, montoTotal)', () => {
      expect(ALKOSTO_OC_RESPONSE_SCHEMA).toBeDefined();
      expect(ALKOSTO_OC_RESPONSE_SCHEMA.properties.numeroOrden).toBeDefined();
      expect(ALKOSTO_OC_RESPONSE_SCHEMA.properties.fechaOrden).toBeDefined();
      expect(ALKOSTO_OC_RESPONSE_SCHEMA.properties.tiendasDetectadas).toBeDefined();
      expect(ALKOSTO_OC_RESPONSE_SCHEMA.properties.renglones).toBeDefined();
      expect(ALKOSTO_OC_RESPONSE_SCHEMA.properties.montoTotal).toBeDefined();

      const structuredPayload = {
        numeroOrden: '0000054457',
        fechaOrden: '06/10/2026',
        fechaEntrega: '12/10/2026',
        tiendasDetectadas: ['AK01', 'AK02', 'FC01'],
        renglones: [
          {
            codigoProducto: '7590377000503',
            ean: '7590377000503',
            descripcion: 'LECHE EN POLVO COMPLETA 400GR / 2.98',
            cantidadTotal: 55,
            desglosePorTienda: [
              { tienda: 'AK01', cantidad: 30 },
              { tienda: 'AK02', cantidad: 25 },
              { tienda: 'FC01', cantidad: 10 },
              { tienda: 'AKOP', cantidad: 999 },
              { tienda: 'CI', cantidad: 888 }
            ],
            precioUnitario: 40,
            subtotal: 2200
          }
        ],
        montoTotal: 2600
      };

      const normalized = normalizeOrderForCodizulca(structuredPayload);
      expect(normalized.ordenNro).toBe('0000054457');
      expect(normalized.numeroOrden).toBe('0000054457');
      expect(normalized.fechaEmision).toBe('06/10/2026');
      expect(normalized.fechaOrden).toBe('06/10/2026');
      expect(normalized.fechaEntrega).toBe('12/10/2026');
      expect(normalized.tiendasDetectadas).toEqual(['AK01', 'AK02', 'FC01']);
      expect(normalized.items).toHaveLength(1);
      expect(normalized.items[0].codigoProducto).toBe('7590377000503');
      expect(normalized.items[0].ean).toBe('7590377000503');
      expect(normalized.items[0].precioUnitario).toBe(40);
      expect(normalized.items[0].tiendas).toEqual({ AK01: 30, AK02: 25, FC01: 10 });
      expect(normalized.items[0].desglosePorTienda).toEqual([
        { tienda: 'AK01', cantidad: 30 },
        { tienda: 'AK02', cantidad: 25 },
        { tienda: 'FC01', cantidad: 10 }
      ]);
      expect(normalized.subtotalAlkosto).toBe(2200);
      expect(normalized.subtotalFamiliaCenter).toBe(400);
      expect(normalized.montoTotal).toBe(2600);
    });

    it('should validate the 158 official products (PRODUCTOS_CODIZULCA), matchProductoCodizulca Vencampo gramajes (1536, 1556, 1574, 1579), reject LPV, and compute exact Sala de Espera subtotal (CANT * valorUnitarioOC)', () => {
      // 1. Catálogo oficial de 221 ítems (del 9 al 1662, incluye 1642 ARVEJAS y 1644 CARAOTAS NEGRAS VENCAMPO) con caracteres UTF-8 (Ñ) preservados
      expect(PRODUCTOS_CODIZULCA).toHaveLength(221);
      expect(PRODUCTOS_CODIZULCA[0].codigo).toBe('9');
      expect(PRODUCTOS_CODIZULCA[PRODUCTOS_CODIZULCA.length - 1].codigo).toBe('1662');
      expect(PRODUCTOS_CODIZULCA.some(p => p.descripcion.includes('DOÑA FLORA'))).toBe(true);
      expect(PRODUCTOS_CODIZULCA.some(p => p.descripcion.includes('NAVIDEÑA'))).toBe(true);

      // 2. Desambiguación obligatoria de Leche en Polvo Vencampo por gramaje y prohibición de 'LPV'
      expect(matchProductoCodizulca('LPV', 'LECHE EN POLVO COMPLETA VENCAMPO 1KG')).toMatchObject({
        codigo: '1536',
        descripcion: 'LECHE EN POLVO VENCAMPO 10X1KG'
      });
      expect(matchProductoCodizulca('7590377000510', 'LECHE EN POLVO COMPLETA VENCAMPO 900GR')).toMatchObject({
        codigo: '1556',
        descripcion: 'LECHE EN POLVO VENCAMPO 10X900GR'
      });
      expect(matchProductoCodizulca('7590377000503', 'LECHE EN POLVO COMPLETA VENCAMPO 400GR')).toMatchObject({
        codigo: '1574',
        descripcion: 'LECHE EN POLVO VENCAMPO 10X400GR'
      });
      expect(matchProductoCodizulca('', 'LECHE EN POLVO VENCAMPO 500G')).toMatchObject({
        codigo: '1579',
        descripcion: 'LECHE EN POLVO VENCAMPO 10X500GR'
      });

      // 3. Limpieza numérica toSafeNumber y cálculo determinista SUB TOTAL = CANT * VALOR_UNITARIO_OC
      expect(toSafeNumber('45,50')).toBe(45.5);
      expect(toSafeNumber('1.250,75')).toBe(1250.75);
      expect(toSafeNumber('1,250.75')).toBe(1250.75);
      expect(toSafeNumber('$ 40.0000')).toBe(40);

      // Verificar que si entra un payload con código inventado 'LPV' y valorUnitarioOC, se corrige al código numérico y calcula subtotal exacto
      const aiPayloadWithLpv = {
        numeroOrden: '0000054457',
        fechaOrden: '06/10/2026',
        tiendasDetectadas: ['AK01', 'FC01'],
        renglones: [
          {
            codigo: 'LPV',
            descripcion: 'LECHE EN POLVO COMPLETA VENCAMPO 400GR',
            unidad: 'CJ',
            cantidad: 40,
            desglosePorTienda: [
              { tienda: 'AK01', cantidad: 30 },
              { tienda: 'FC01', cantidad: 10 }
            ],
            valorUnitarioOC: 40,
            subtotal: 1600
          }
        ],
        montoTotal: 1600
      };

      const normalizedLpv = normalizeOrderForCodizulca(aiPayloadWithLpv);
      expect(normalizedLpv.items[0].codigo).toBe('1574');
      expect(normalizedLpv.items[0].skuCodizulca).toBe('1574');
      expect(normalizedLpv.items[0].descripcion).toBe('LECHE EN POLVO VENCAMPO 10X400GR');
      expect(normalizedLpv.items[0].valorUnitarioOC).toBe(40);
      expect(normalizedLpv.items[0].costoUnitario).toBe(40);

      const lote = extraerPedidosNormalizadosDeOC({
        initialData: normalizedLpv,
        filasActuales: [],
        tiendaSeleccionada: 'CONSOLIDADO',
        enviarLoteCompleto: true,
        idClienteSeleccionado: '7498',
        clienteNombreSeleccionado: 'Alkosto 1 san Felipe',
        numero_oc: '0000054457',
        vendedor: 'Sairu Valles',
        fechaISO: '2026-10-06'
      });

      expect(lote.pedidos).toHaveLength(2);
      const ak01 = lote.pedidos.find(p => p.sucursalTag === 'AK01')!;
      expect(ak01.renglones?.[0].codigo).toBe('1574');
      expect(ak01.renglones?.[0].descripcion).toBe('LECHE EN POLVO VENCAMPO 10X400GR');
      expect(ak01.renglones?.[0].cantidad).toBe(30);
      expect(ak01.renglones?.[0].precio_unitario).toBe(40);
      expect(ak01.renglones?.[0].subtotal).toBe(1200);
      expect(ak01.monto_pedido).toBe(1200);
    });
  });
});
