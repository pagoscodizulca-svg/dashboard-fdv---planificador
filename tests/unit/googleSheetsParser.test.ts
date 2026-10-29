import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import {
  DEFAULT_GOOGLE_SHEET_ID,
  sanitizeGoogleSheetId,
  getGoogleSheetId,
  parseCsvRfc4180,
  normalizeHeaderKey,
  isRowCompletelyEmpty,
  normalizeClientCode,
  parseLocaleNumber,
  parseSheetDate,
  mapHeaderColumns,
  parseWorkbookFull
} from '../../src/services/googleSheetsParser';
import { clasificarRubro, clasificarRubroServerLabel } from '../../src/lib/rubros';
import { getVendorProfile } from '../../src/utils/vendorRoutes';

describe('Unit & QA: Google Sheets Sync Engine & Normalizer', () => {
  describe('GOOGLE_SHEET_ID Parameterization & Sanitization', () => {
    it('strips angle brackets, quotes, and spaces from <1PLzYEe9GG1vHb_wjd7HA93U6UQNtyP-uk8sxVfiN4sg>', () => {
      expect(sanitizeGoogleSheetId('<1PLzYEe9GG1vHb_wjd7HA93U6UQNtyP-uk8sxVfiN4sg>')).toBe(
        '1PLzYEe9GG1vHb_wjd7HA93U6UQNtyP-uk8sxVfiN4sg'
      );
      expect(sanitizeGoogleSheetId(' "1PLzYEe9GG1vHb_wjd7HA93U6UQNtyP-uk8sxVfiN4sg" ')).toBe(
        '1PLzYEe9GG1vHb_wjd7HA93U6UQNtyP-uk8sxVfiN4sg'
      );
    });

    it('extracts spreadsheet ID if a full Google Sheets URL is provided', () => {
      const url = 'https://docs.google.com/spreadsheets/d/1PLzYEe9GG1vHb_wjd7HA93U6UQNtyP-uk8sxVfiN4sg/edit#gid=0';
      expect(sanitizeGoogleSheetId(url)).toBe('1PLzYEe9GG1vHb_wjd7HA93U6UQNtyP-uk8sxVfiN4sg');
    });

    it('falls back safely when placeholder <PEGA_AQUI_EL_ID_DEL_GOOGLE_SHEET> or empty value is passed', () => {
      expect(sanitizeGoogleSheetId('<PEGA_AQUI_EL_ID_DEL_GOOGLE_SHEET>')).toBe(DEFAULT_GOOGLE_SHEET_ID);
      expect(sanitizeGoogleSheetId('')).toBe(DEFAULT_GOOGLE_SHEET_ID);
      expect(getGoogleSheetId({ GOOGLE_SHEET_ID: '<1PLzYEe9GG1vHb_wjd7HA93U6UQNtyP-uk8sxVfiN4sg>' })).toBe(
        '1PLzYEe9GG1vHb_wjd7HA93U6UQNtyP-uk8sxVfiN4sg'
      );
    });
  });

  describe('RFC 4180 CSV State-Machine Parser (No naive .split(","))', () => {
    it('preserves commas, escaped quotes, and multiline breaks inside quoted cells without shifting columns', () => {
      const csv =
        '\uFEFFCODIGO,RAZON SOCIAL,NOTAS,CAJAS\r\n' +
        '186,"INVERSIONES LOS HERMANOS, C.A.","Entrega en puerta\nLlamar antes","1.250,50"\r\n' +
        '7499,"BODEGON ""EL REY"", S.A.","Linea 1\r\nLinea 2",25\n';

      const rows = parseCsvRfc4180(csv);
      expect(rows).toHaveLength(3);
      expect(rows[0]).toEqual(['CODIGO', 'RAZON SOCIAL', 'NOTAS', 'CAJAS']);
      expect(rows[1]).toEqual([
        '186',
        'INVERSIONES LOS HERMANOS, C.A.',
        'Entrega en puerta\nLlamar antes',
        '1.250,50'
      ]);
      expect(rows[2]).toEqual(['7499', 'BODEGON "EL REY", S.A.', 'Linea 1\r\nLinea 2', '25']);
    });
  });

  describe('Header Normalization & Alias Mapping', () => {
    it('normalizes trailing spaces, casing, accents, and mojibake', () => {
      expect(normalizeHeaderKey(' Vendedor ')).toBe('vendedor');
      expect(normalizeHeaderKey('ACEITE ')).toBe('aceite');
      expect(normalizeHeaderKey('Meta Aceite ')).toBe('meta_aceite');
      expect(normalizeHeaderKey('ARROZ ')).toBe('arroz');
      expect(normalizeHeaderKey('Activación por Cliente')).toBe('activacion_por_cliente');
      expect(normalizeHeaderKey('AZÃšCAR')).toBe('azucar');
    });

    it('maps real Google Sheet headers with trailing spaces and casing variations accurately', () => {
      const realHeaders = [
        ' CODIGO ',
        'RAZON SOCIAL',
        ' Vendedor ',
        'ACEITE ',
        'AZUCAR',
        'ARROZ ',
        'ESTANDAR Y SUPERIOR ASTURIAS',
        'MORTADELA SALPICAO Y ASTURIAS'
      ];
      const mapped = mapHeaderColumns(realHeaders, {
        codigo: ['codigo'],
        razonSocial: ['razon_social'],
        vendedor: ['vendedor'],
        aceite: ['aceite'],
        azucar: ['azucar'],
        pollo: ['pollo', 'arroz'],
        asturias: ['estandar_y_superior_asturias'],
        salpicao: ['mortadela_salpicao_y_asturias']
      });
      expect(mapped).toEqual({
        codigo: 0,
        razonSocial: 1,
        vendedor: 2,
        aceite: 3,
        azucar: 4,
        pollo: 5,
        asturias: 6,
        salpicao: 7
      });
    });
  });

  describe('Locale Numbers & Google Sheets Dates', () => {
    it('parses Latin American, US, accounting, and dash markers without ever returning NaN', () => {
      expect(parseLocaleNumber('1.000,50')).toBe(1000.5);
      expect(parseLocaleNumber('1,000.50')).toBe(1000.5);
      expect(parseLocaleNumber('0,75')).toBe(0.75);
      expect(parseLocaleNumber('1,500')).toBe(1500);
      expect(parseLocaleNumber('1.234.567')).toBe(1234567);
      expect(parseLocaleNumber('(1.200,50)')).toBe(-1200.5);
      expect(parseLocaleNumber('-')).toBe(0);
      expect(parseLocaleNumber(' - ')).toBe(0);
      expect(parseLocaleNumber('#N/D')).toBe(0);
      expect(parseLocaleNumber(null)).toBe(0);
      expect(Number.isNaN(parseLocaleNumber('texto_invalido'))).toBe(false);
    });

    it('converts Google Sheets serial numbers, DD/MM/YYYY, and ISO timestamps safely without Invalid Date', () => {
      expect(parseSheetDate(46296)).toBe('2026-10-01');
      expect(parseSheetDate(46312)).toBe('2026-10-17');
      expect(parseSheetDate('46296')).toBe('2026-10-01');
      expect(parseSheetDate('19/10/2026')).toBe('2026-10-19');
      expect(parseSheetDate('5-3-26')).toBe('2026-03-05');
      expect(parseSheetDate('2026-10-12T18:17:26.121Z')).toBe('2026-10-12');
      expect(parseSheetDate('31/02/2026')).toBeNull();
      expect(parseSheetDate('no-es-fecha')).toBeNull();
      expect(parseSheetDate('')).toBeNull();
    });

    it('normalizes client codes stripping leading # and leading zeros consistently', () => {
      expect(normalizeClientCode(' #007499 ')).toEqual({ rawClean: '007499', canonical: '7499' });
      expect(normalizeClientCode(186)).toEqual({ rawClean: '186', canonical: '186' });
    });
  });

  describe('SKU Classification & Vendor Alias Parity', () => {
    it('classifies Cod="POLLO" ("POLLO TODAS LAS MARCAS") as POLLO identically on backend and frontend', () => {
      expect(clasificarRubro('POLLO', 'POLLO TODAS LAS MARCAS')).toBe('POLLO');
      expect(clasificarRubroServerLabel('POLLO', 'POLLO TODAS LAS MARCAS')).toBe('POLLO');
      expect(clasificarRubro('ACEITE', 'ACEITE TODAS LAS MARCAS')).toBe('ACEITE');
      expect(clasificarRubro('AZUCAR', 'AZUCAR TODAS LAS MARCAS')).toBe('AZUCAR');
    });

    it('resolves short username "MARIANGEL" from Usuarios sheet to MARIANGEL GONZALEZ profile', () => {
      const prof = getVendorProfile('MARIANGEL');
      expect(prof.canonicalUsername).toBe('MARIANGEL GONZALEZ');
    });
  });

  describe('Full Workbook Engine: Col 89 Retention, Empty Intermediate Rows & Duplicate Summation', () => {
    it('retains Col 89 (OSCAR ORTIZ- LA COSTA), skips Col 92 (ALI PEREZ summary), survives 8 blank rows in Degustaciones, and sums repeated client purchases', () => {
      const wb = XLSX.utils.book_new();

      // 1. Volumen por SKU con 101 columnas (Col 89 = OSCAR ORTIZ- LA COSTA, Col 92 = ALI PEREZ)
      const h0 = new Array(96).fill(null);
      const h1 = new Array(96).fill(null);
      h1[0] = 'Cod';
      h1[1] = 'Articulo';

      h0[2] = 'ADEL JARABA';
      h1[2] = 'CUOTA KG';
      h1[3] = 'VENTA KG';
      h1[4] = '%';

      h0[89] = 'OSCAR ORTIZ-  LA COSTA';
      h1[89] = 'Cuota';
      h1[90] = 'Kg';
      h1[91] = '%';

      h0[92] = 'ALI PEREZ';
      h1[92] = 'Cuota';
      h1[93] = 'Kg';
      h1[94] = '%';

      const skuRow1 = new Array(96).fill('-');
      skuRow1[0] = 'POLLO';
      skuRow1[1] = 'POLLO TODAS LAS MARCAS';
      skuRow1[2] = '1.000,50';
      skuRow1[3] = '500,25';
      skuRow1[89] = 1500;
      skuRow1[90] = 820.5;
      skuRow1[92] = 9999; // Supervisor summary -> must be excluded!
      skuRow1[93] = 8888;

      const emptyRow = new Array(96).fill(null);

      const summaryRow = new Array(96).fill(null);
      summaryRow[89] = 1500;
      summaryRow[90] = 820.5;

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([h0, h1, skuRow1, emptyRow, summaryRow]),
        'Volumen por SKU'
      );

      // 2. Hoja pollo con código duplicado 7499 en 2 filas que deben sumarse
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ['Id Cliente', 'Cliente', 'Cajas'],
          ['7499', 'ALKOSTO TIENDA 1', 10],
          [null, null, null],
          ['07499', 'ALKOSTO TIENDA 1 (PEDIDO 2)', '15,5']
        ]),
        'pollo'
      );

      // 3. Activación por Cliente con encabezado "ARROZ " con espacio al final y código duplicado 186
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ['CODIGO', 'RAZON SOCIAL', ' Vendedor ', 'ACEITE ', 'AZUCAR', 'ARROZ ', 'ESTANDAR Y SUPERIOR ASTURIAS', 'MORTADELA SALPICAO Y ASTURIAS'],
          ['7499', 'ALKOSTO', 'SAIRU VALLES', 'NO', 'NO', 'SI', 'NO', 'NO'],
          ['186', 'CLIENTE DUPLICADO A', 'JUAN HERNANDEZ', 'SI', 'NO', 'NO', 'NO', 'NO'],
          ['186', 'CLIENTE DUPLICADO A', 'JUAN HERNANDEZ', 'NO', 'SI', 'NO', 'NO', 'NO']
        ]),
        'Activación por Cliente'
      );

      // 4. Degustaciones con 8 filas vacías al inicio + 1 fila incompleta sin ID + 1 fila válida con serial 46296
      const degRows: any[][] = [
        ['ID', 'Fecha Registro', 'Vendedor', 'Ruta', 'Código Cliente', 'Nombre Cliente', 'Fecha Degustación', 'Turno', 'Horario', 'Productos', 'Kilos Estimados', 'Personas Estimadas', 'Requiere Promotora', 'Material POP', 'Contacto Punto', 'Teléfono Contacto', 'Estado', 'Promotora Asignada', 'Notas Trade Marketing']
      ];
      for (let b = 0; b < 8; b++) degRows.push(new Array(19).fill(null));
      const incompleteDeg = new Array(19).fill(null);
      incompleteDeg[2] = 'MARIA BRICEÑO';
      incompleteDeg[6] = 46296;
      degRows.push(incompleteDeg);

      const validDeg = [
        'deg-real-01',
        '2026-10-01T12:00:00Z',
        'SAIRU VALLES',
        'CUENTAS CLAVE 2',
        '7499',
        'ALKOSTO',
        46296,
        'MAÑANA',
        '09:00 AM - 01:00 PM',
        '"MORTADELA, POLLO", JAMON',
        '12,5',
        120,
        'SI',
        'SI',
        'ENCARGADO',
        '04141234567',
        'APROBADA',
        'ANA',
        'OK'
      ];
      degRows.push(validDeg);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(degRows), 'Degustaciones');

      const parsed = parseWorkbookFull(XLSX, wb, { periodo: '2026-10', masterClients: [] });

      // Verificar que Col 89 (OSCAR ORTIZ- LA COSTA) se leyó y Col 92 (ALI PEREZ) se excluyó
      expect(parsed.volumenApiRows).toHaveLength(2);
      const oscarRow = parsed.volumenApiRows.find((r) => r.vendedorId === 'OSCAR ORTIZ- LA COSTA');
      expect(oscarRow).toBeDefined();
      expect(oscarRow?.categoria).toBe('POLLO');
      expect(oscarRow?.metaKg).toBe(1500);
      expect(oscarRow?.ejecutadoKg).toBe(820.5);

      const adelRow = parsed.volumenApiRows.find((r) => r.vendedorId === 'ADEL JARABA');
      expect(adelRow?.metaKg).toBe(1000.5);
      expect(adelRow?.ejecutadoKg).toBe(500.25);

      expect(parsed.volumenApiRows.some((r) => r.vendedorId === 'ALI PEREZ')).toBe(false);

      // Verificar suma de compras repetidas de pollo (10 + 15.5 = 25.5) y consolidación de duplicado #186
      const alkostoAct = parsed.activacionApiRows.find((c) => c.id === '7499');
      expect(alkostoAct?.cajas.POLLO).toBe(25.5);
      expect(alkostoAct?.cats.POLLO).toBe(true);

      const dup186 = parsed.activacionApiRows.filter((c) => c.id === '186');
      expect(dup186).toHaveLength(1);
      expect(dup186[0].cats.ACEITE).toBe(true);
      expect(dup186[0].cats.AZUCAR).toBe(true);

      // Verificar que Degustaciones sobrevivió las 8 filas vacías y convirtió el serial 46296 -> 2026-10-01
      expect(parsed.degustacionesRows).toHaveLength(1);
      expect(parsed.degustacionesRows[0].id).toBe('deg-real-01');
      expect(parsed.degustacionesRows[0].fecha).toBe('2026-10-01');
      expect(parsed.degustacionesRows[0].productos).toEqual(['MORTADELA, POLLO', 'JAMON']);
      expect(parsed.degustacionesRows[0].kilosEstimados).toBe(12.5);
      expect(parsed.metrics['Degustaciones'].emptyRowsSkipped).toBe(8);
      expect(parsed.metrics['Degustaciones'].incompleteRowsLogged).toBe(1);
      expect(parsed.warnings.length).toBeGreaterThanOrEqual(2);
    });

    it('validates exact quantitative row counts on live local sheet.xlsx backup when present', () => {
      const localSheetPath = path.join(process.cwd(), 'sheet.xlsx');
      if (!fs.existsSync(localSheetPath)) return;

      const wb = XLSX.readFile(localSheetPath);
      const seedPath = path.join(process.cwd(), 'scripts', 'data_maestra_octubre_2026.json');
      const masterClients = fs.existsSync(seedPath)
        ? JSON.parse(fs.readFileSync(seedPath, 'utf8')).map((item: any) => ({
            cliente_codigo: String(item.id).trim(),
            cliente_nombre: String(item.razonSocial || '').trim(),
            vendedor_id: String(item.vendedor).replace(/\s+/g, ' ').trim(),
            vendedor_nombre: String(item.vendedor).replace(/\s+/g, ' ').trim()
          }))
        : [];

      const parsed = parseWorkbookFull(XLSX, wb, { periodo: '2026-10', masterClients });

      expect(parsed.volumenApiRows.length).toBeGreaterThanOrEqual(1247);
      expect(
        parsed.volumenApiRows.filter((r) => r.vendedorId === 'OSCAR ORTIZ- LA COSTA').length
      ).toBeGreaterThanOrEqual(40);
      expect(parsed.metasApiRows.length).toBeGreaterThanOrEqual(125);
      expect(parsed.usuariosRows.length).toBeGreaterThanOrEqual(28);
      expect(parsed.degustacionesRows.length).toBeGreaterThanOrEqual(132);
      expect(isRowCompletelyEmpty([null, '', '   '])).toBe(true);
    });
  });
});
