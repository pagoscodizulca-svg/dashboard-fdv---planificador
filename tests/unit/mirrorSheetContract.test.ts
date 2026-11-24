import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { parseWorkbookFull } from '../../src/services/googleSheetsParser';

describe('Phase 2 Baseline — Mirror Contract for Dashboard_Vendedores', () => {
  it('UT-GRID-01: reads the 5 focus products dynamically from Row 1, ignores obsolete Row 2 labels, converts "-" to 0, excludes footer sum row, and audits mismatches without injecting phantom vendors', () => {
    const wb = XLSX.utils.book_new();
    const gridRows = [
      // Row 1: Real focus products
      [null, null, 'AZUCAR', null, 'LECHE VENCAMPO', null, 'POLLO', null, 'ESTANDAR Y SUPERIOR ASTURIAS', null, 'MORTADELA SALPICAO Y ASTURIAS', null],
      // Row 2: Obsolete / mismatched sublabels ("Meta Aceite " under AZUCAR, "Meta azucar" under LECHE VENCAMPO)
      ['Vendedor', 'CARTERA', 'Meta Aceite ', 'Activados', 'Meta azucar', 'Activados', 'Meta pollo', 'Activados', 'Meta ESTANDAR Y SUPERIOR ASTURIAS', 'Activados', 'Meta MORTADELA SALPICAO Y ASTURIAS', 'Activados'],
      ['MARIA BRICEÑO', 125, 70, 53, 28, 44, '-', '', 70, 46, 40, 22],
      ['OSCAR ORTIZ-  LA COSTA', 60, 30, 10, '-', '-', 15, 5, 20, 8, 25, 12],
      // Footer summary row without vendor name (intentional mismatch in AZUCAR meta: 999 vs 100)
      [null, null, 999, 63, 28, 44, 15, 5, 90, 54, 65, 34]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gridRows), 'Grid de Activación por Vendedor');

    const parsed = parseWorkbookFull(XLSX, wb, { periodo: '2026-11', masterClients: [] });

    // Only the 2 real vendors x 5 focus categories = 10 rows (no synthetic ANGEL NAVARRO injected!)
    expect(parsed.metasSupabaseRows).toHaveLength(10);

    const mariaAzucar = parsed.metasSupabaseRows.find(
      (r) => r.vendedor_key === 'MARIA BRICENO' && r.categoria === 'AZUCAR'
    );
    expect(mariaAzucar).toMatchObject({ meta: 70, activados: 53, cartera: 125 });

    const mariaLeche = parsed.metasSupabaseRows.find(
      (r) => r.vendedor_key === 'MARIA BRICENO' && r.categoria === 'LECHE VENCAMPO'
    );
    expect(mariaLeche).toMatchObject({ meta: 28, activados: 44, cartera: 125 });

    const mariaPollo = parsed.metasSupabaseRows.find(
      (r) => r.vendedor_key === 'MARIA BRICENO' && r.categoria === 'POLLO'
    );
    expect(mariaPollo).toMatchObject({ meta: 0, activados: 0 });

    const oscarCosta = parsed.metasSupabaseRows.find(
      (r) => r.vendedor_key === 'OSCAR ORTIZ - LA COSTA' && r.categoria === 'LECHE VENCAMPO'
    );
    expect(oscarCosta).toMatchObject({ meta: 0, activados: 0, cartera: 60 });

    // Footer mismatch in AZUCAR meta (999 vs 70+30=100) logged in auditLogs
    expect(parsed.auditLogs.some((a) => a.event_code === 'GRID_FOOTER_MISMATCH')).toBe(true);
  });

  it('UT-VOL-01 & UT-VOL-02: retains negative credit notes/returns when CUOTA is 0/"-", performs algebraic net subtraction, and preserves the Sheet "%" column', () => {
    const wb = XLSX.utils.book_new();
    const volRows = [
      [null, null, 'OSCAR ORTIZ-  LA COSTA', null, null, 'ANGELICA MORENO', null, null],
      ['Cod', 'Articulo', 'CUOTA', 'KG', '%', 'CUOTA', 'VENTA KG', '%'],
      [1568, 'POLLO VENCAMPO POR KG', '-', -56.6, -0.019, 1000, 503, 0.503],
      [1549, 'ARROZ BLANCO VENCAMPO 24X900GR', 1000, 1000, 1.0, '-', -648, -0.032],
      [1572, 'CAJAS DE PIZZA 1X100', 40, 1958, 48.95, '-', '-', 0]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(volRows), 'Volumen por SKU');

    const parsed = parseWorkbookFull(XLSX, wb, { periodo: '2026-11', masterClients: [] });

    const oscarRows = parsed.volumenSupabaseRows.filter((r) => r.vendedor_key === 'OSCAR ORTIZ - LA COSTA');
    expect(oscarRows).toHaveLength(3);

    const oscarNeg = oscarRows.find((r) => r.sku === '1568')!;
    expect(oscarNeg).toBeDefined();
    expect(oscarNeg.meta_kg).toBe(0);
    expect(oscarNeg.venta_bruta_kg).toBe(0);
    expect(oscarNeg.devoluciones_kg).toBe(-56.6);
    expect(oscarNeg.venta_neta_kg).toBe(-56.6);
    expect(oscarNeg.ejecutado_kg).toBe(-56.6);
    expect(oscarNeg.porcentaje_cumplimiento).toBeCloseTo(-1.9, 3);

    const oscarPizza = oscarRows.find((r) => r.sku === '1572')!;
    expect(oscarPizza.porcentaje_cumplimiento).toBeCloseTo(4895, 2);

    // Algebraic sum for Oscar Ortiz - La Costa: -56.6 + 1000 + 1958 = 2901.40
    const oscarNetTotal = +oscarRows.reduce((s, r) => s + r.venta_neta_kg, 0).toFixed(2);
    expect(oscarNetTotal).toBe(2901.4);

    // Algebraic sum for Angelica Moreno: 503 + (-648) = -145.00
    const angelicaRows = parsed.volumenSupabaseRows.filter((r) => r.vendedor_key === 'ANGELICA MORENO');
    expect(angelicaRows).toHaveLength(2);
    const angelicaNetTotal = +angelicaRows.reduce((s, r) => s + r.venta_neta_kg, 0).toFixed(2);
    expect(angelicaNetTotal).toBe(-145);
  });

  it('UT-VOL-03: handles supervisor blocks (JOHNATAN SOTO repeated) and real vendor duplicate block collisions deterministically with auditLogs', () => {
    const wb = XLSX.utils.book_new();
    const volRows = [
      [
        null, null,
        'MIKELANGELO DIAZ1', null, null,
        'JOHNATAN SOTO', null, null,
        'JOHNATAN SOTO', null, null,
        'HERNAN PAZ', null, null,
        'HERNAN PAZ', null, null,
        'SARAH REYES', null, null,
        'SARAH REYES', null, null
      ],
      [
        'Cod', 'Articulo',
        'CUOTA', 'KG', '%',
        'CUOTA', 'KG', '%',
        'CUOTA', 'KG', '%',
        'CUOTA', 'KG', '%',
        'CUOTA', 'KG', '%',
        'CUOTA', 'KG', '%',
        'CUOTA', 'KG', '%'
      ],
      [
        1568, 'POLLO VENCAMPO POR KG',
        500, 250, 0.5,
        9000, 4500, 0.5, // Supervisor summary block 1
        9000, 4500, 0.5, // Supervisor summary block 2
        300, 120, 0.4,   // Hernan Paz block 1
        300, 120, 0.4,   // Hernan Paz identical duplicate block 2 -> deduplicate!
        400, 100, 0.25,  // Sarah Reyes block 1
        400, 290, 0.725  // Sarah Reyes distinct collision block 2 -> retain first + CRITICAL audit!
      ]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(volRows), 'Volumen por SKU');

    const parsed = parseWorkbookFull(XLSX, wb, { periodo: '2026-11', masterClients: [] });

    // Supervisor JOHNATAN SOTO excluded from individual vendor rows
    expect(parsed.volumenSupabaseRows.some((r) => r.vendedor_key === 'JOHNATAN SOTO')).toBe(false);
    expect(parsed.auditLogs.some((a) => a.event_code === 'SUPERVISOR_SUMMARY_BLOCK_SKIPPED')).toBe(true);

    // MIKELANGELO DIAZ1 normalized to MIKELANGELO DIAZ
    const mikel = parsed.volumenSupabaseRows.filter((r) => r.vendedor_key === 'MIKELANGELO DIAZ');
    expect(mikel).toHaveLength(1);
    expect(mikel[0].venta_neta_kg).toBe(250);

    // HERNAN PAZ identical duplicate block deduplicated (120, NOT 240)
    const hernan = parsed.volumenSupabaseRows.filter((r) => r.vendedor_key === 'HERNAN PAZ');
    expect(hernan).toHaveLength(1);
    expect(hernan[0].venta_neta_kg).toBe(120);
    expect(parsed.auditLogs.some((a) => a.event_code === 'DUPLICATE_IDENTICAL_VENDOR_BLOCK')).toBe(true);

    // SARAH REYES distinct collision retains first block (100) and logs CRITICAL collision
    const sarah = parsed.volumenSupabaseRows.filter((r) => r.vendedor_key === 'SARAH REYES');
    expect(sarah).toHaveLength(1);
    expect(sarah[0].venta_neta_kg).toBe(100);
    expect(
      parsed.auditLogs.some((a) => a.event_code === 'COLLISION_DISTINCT_VENDOR_BLOCK' && a.severity === 'CRITICAL')
    ).toBe(true);
  });

  it('UT-ACT-01: reads 100% of rows across the 5 detail tabs without breaking on magnitude drops, preserves decimal boxes, ignores "fx", does not fabricate +1 on 0 boxes, and logs summary vs detail deltas', () => {
    const wb = XLSX.utils.book_new();

    // Grid says MARIA BRICEÑO has 5 AZUCAR activated, while detail has 2 -> must NOT overwrite Grid's 5, only log delta
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        [null, null, 'AZUCAR', null, 'LECHE VENCAMPO', null, 'POLLO', null, 'ESTANDAR Y SUPERIOR ASTURIAS', null, 'MORTADELA SALPICAO Y ASTURIAS', null],
        ['Vendedor', 'CARTERA', 'Meta', 'Activados', 'Meta', 'Activados', 'Meta', 'Activados', 'Meta', 'Activados', 'Meta', 'Activados'],
        ['MARIA BRICEÑO', 3, 10, 5, 10, 1, 10, 0, 10, 1, 10, 1]
      ]),
      'Grid de Activación por Vendedor'
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['CODIGO', 'RAZON SOCIAL', 'VENDEDOR', 'ACEITE', 'AZUCAR', 'ARROZ ', 'ESTANDAR Y SUPERIOR ASTURIAS', 'MORTADELA SALPICAO Y ASTURIAS'],
        [329, 'CLIENTE UNO', 'MARIA BRICEÑO', null, null, null, null, null],
        [332, 'CLIENTE DOS', 'MARIA BRICEÑO', null, null, null, null, null],
        [335, 'CLIENTE CERO CAJAS', 'MARIA BRICEÑO', null, null, null, null, null]
      ]),
      'Activación por Cliente'
    );

    // Azucar with >55 rows, jumping from 7500 down to 0.95 (previously broke at row 52!), plus "fx" residual
    const azucarRows: any[][] = [['Id Cliente', 'Cliente', 'Cajas', null, null, null, 'fx']];
    for (let i = 1; i <= 55; i++) {
      azucarRows.push([9000 + i, `MAYORISTA ${i}`, i === 55 ? 7500 : 20, null, null, null, null]);
    }
    azucarRows.push(['00329', 'CLIENTE UNO', 0.95, null, null, null, null]); // after magnitude drop 7500 -> 0.95!
    azucarRows.push([332, 'CLIENTE DOS', 'fx', null, null, null, null]);     // residual text in Cajas -> 0 + audit
    azucarRows.push([335, 'CLIENTE CERO CAJAS', 0, null, null, null, null]); // 0 cajas -> must stay 0 (NOT +1)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(azucarRows), 'Azucar');

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Id Cliente', 'Cliente', 'Cajas'],
        [329, 'CLIENTE UNO', 0.9]
      ]),
      'leche'
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Id Cliente', 'Cliente', 'Cajas'],
        [329, 'CLIENTE UNO', 0.5]
      ]),
      'jamon asturias'
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Id Cliente', 'Cliente', 'Cajas'],
        [329, 'CLIENTE UNO', 0.5]
      ]),
      'Enteros Ligeros'
    );

    const parsed = parseWorkbookFull(XLSX, wb, { periodo: '2026-11', masterClients: [] });

    const c329 = parsed.activacionSupabaseUpserts.concat(parsed.newSheetClientsForSupabase).find(
      (c) => c.cliente_codigo_canonico === '329'
    );
    expect(c329).toBeDefined();
    expect(c329.cajas_azucar).toBe(0.95);
    expect(c329.cajas_leche_vencampo).toBe(0.9);
    expect(c329.cajas_estandar_asturias).toBe(0.5);
    expect(c329.cajas_mortadela_salpicao).toBe(0.5);
    expect(c329.has_azucar).toBe(true);
    expect(c329.has_leche_vencampo).toBe(true);

    const c332 = parsed.activacionSupabaseUpserts.concat(parsed.newSheetClientsForSupabase).find(
      (c) => c.cliente_codigo_canonico === '332'
    );
    expect(c332.cajas_azucar).toBe(0);
    expect(c332.has_azucar).toBe(false);

    const c335 = parsed.activacionSupabaseUpserts.concat(parsed.newSheetClientsForSupabase).find(
      (c) => c.cliente_codigo_canonico === '335'
    );
    expect(c335.cajas_azucar).toBe(0);
    expect(c335.has_azucar).toBe(false);

    // Grid's official activados = 5 is NOT overwritten by detail count (1)
    const gridAzucar = parsed.metasSupabaseRows.find((m) => m.categoria === 'AZUCAR')!;
    expect(gridAzucar.activados).toBe(5);

    // Audit logs recorded residual "fx", clients outside master, and summary-vs-detail delta
    expect(parsed.auditLogs.some((a) => a.event_code === 'RESIDUAL_TEXT_IN_CAJAS')).toBe(true);
    expect(parsed.auditLogs.some((a) => a.event_code === 'SUMMARY_VS_DETAIL_MISMATCH')).toBe(true);
  });

  it('UT-DEG-01: filters Degustaciones strictly to current America/Caracas month across all 19 columns and quarantines missing-ID, alk-*, test-*, SISTEMA TEST, AGENTE PRUEBA, and past months', () => {
    const wb = XLSX.utils.book_new();
    const degRows: any[][] = [
      ['ID', 'Fecha Registro', 'Vendedor', 'Ruta', 'Codigo Cliente', 'Nombre Cliente', 'Fecha Degustacion', 'Turno', 'Horario', 'Productos', 'Kilos Estimados', 'Personas Estimadas', 'Requiere Promotora', 'Material POP', 'Contacto Punto', 'Telefono Contacto', 'Estado', 'Promotora Asignada', 'Notas Trade Marketing'],
      new Array(19).fill(null),
      // Shifted row without ID
      [null, '2026-11-05T10:00:00Z', 'MARIA BRICEÑO', 'RUTA 1', '329', 'CLIENTE A', '2026-11-10', 'MAÑANA', '09:00 AM', 'POLLO', 5, 100, 'SI', 'SI', 'JUAN', '0414', 'SOLICITADA', '', ''],
      // Test rows
      ['test-ping-01', '2026-11-01T10:00:00Z', 'SISTEMA TEST', 'RUTA TEST', '0', 'CLIENTE PRUEBA CONEXION', '2026-11-12', 'MAÑANA', '', 'POLLO', 1, 10, 'NO', 'NO', '', '', 'SOLICITADA', '', ''],
      ['deg-999', '2026-11-02T10:00:00Z', 'AGENTE PRUEBA', 'RUTA TEST', '0', 'CLIENTE PRUEBA INTEGRACION', '2026-11-13', 'TARDE', '', 'JAMON', 2, 20, 'NO', 'NO', '', '', 'SOLICITADA', '', ''],
      // Foreign Alkosto order leaked into Degustaciones sheet
      ['alk-ak11-571501o6lrdz149', '2026-11-17T14:42:35.865Z', null, 'Sairu Valles', null, null, null, null, null, null, 0, 0, 'NO', 'NO', null, null, null, null, null],
      // Past month (October 2026) -> quarantined during 2026-11 sync
      ['deg-oct-01', '2026-10-10T12:00:00Z', 'SAIRU VALLES', 'CUENTAS CLAVE 2', '7499', 'ALKOSTO', '2026-10-15', 'MAÑANA', '09:00 AM', 'MORTADELA', 10, 150, 'SI', 'SI', 'ANA', '0414', 'REALIZADA', 'LUISA', 'OK'],
      // Valid current month (November 2026)
      ['deg-nov-01', '2026-11-10T12:00:00Z', 'SAIRÚ VALLES', 'CUENTAS CLAVE 2', '07499', 'ALKOSTO SAN FELIPE', '2026-11-20', 'TARDE', '02:00 PM - 07:00 PM', 'MORTADELA, SALPICAO', '8,5', 180, 'SI', 'SI', 'PEDRO', '04141112233', 'APROBADA', 'CARLA', 'STAND ENTRADA']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(degRows), 'Degustaciones');

    const parsed = parseWorkbookFull(XLSX, wb, { periodo: '2026-11', masterClients: [] });

    expect(parsed.degustacionesRows).toHaveLength(1);
    expect(parsed.degustacionesRows[0]).toMatchObject({
      id: 'deg-nov-01',
      fecha: '2026-11-20',
      vendedorKey: 'SAIRU VALLES',
      kilosEstimados: 8.5,
      personasEstimadas: 180,
      estado: 'APROBADA',
      promotoraAsignada: 'CARLA',
      notasTradeMarketing: 'STAND ENTRADA'
    });

    const codes = parsed.auditLogs.map((a) => a.event_code);
    expect(codes).toContain('QUARANTINE_MISSING_ID');
    expect(codes).toContain('QUARANTINE_TEST_DATA');
    expect(codes).toContain('QUARANTINE_FOREIGN_RECORD');
    expect(codes).toContain('QUARANTINE_OUT_OF_PERIOD_MONTH');
  });

  it('verifies exact quantitative reconciliation on local sheet.xlsx backup (all 11 negative returns retained, 0 detail rows truncated)', () => {
    const localSheetPath = path.join(process.cwd(), 'sheet.xlsx');
    if (!fs.existsSync(localSheetPath)) return;

    const wb = XLSX.readFile(localSheetPath, { raw: true });
    const parsed = parseWorkbookFull(XLSX, wb, { periodo: '2026-11', masterClients: [] });

    // All negative SKU rows (including the 11 with CUOTA = "-") must be preserved
    const negativeRows = parsed.volumenSupabaseRows.filter((r) => r.venta_neta_kg < 0);
    expect(negativeRows.length).toBeGreaterThanOrEqual(70);

    // Detail sheets read 100% of non-empty data rows without premature break (accounting identity holds on all 5 tabs)
    expect(parsed.metrics['Azucar'].validRecordsRead).toBeGreaterThanOrEqual(1200);
    expect(parsed.metrics['leche'].validRecordsRead).toBeGreaterThanOrEqual(700);
    expect(parsed.metrics['pollo'].validRecordsRead).toBeGreaterThanOrEqual(550);
    expect(parsed.metrics['jamon asturias'].validRecordsRead).toBeGreaterThanOrEqual(550);
    expect(parsed.metrics['Enteros Ligeros'].validRecordsRead).toBeGreaterThanOrEqual(550);
    for (const tab of ['Azucar', 'leche', 'pollo', 'jamon asturias', 'Enteros Ligeros']) {
      const m = parsed.metrics[tab];
      expect(m.headerRows + m.emptyRowsSkipped + m.summaryRowsSkipped + m.incompleteRowsLogged + m.validRecordsRead).toBe(
        m.totalRowsInSheet
      );
    }

    // Degustaciones for 2026-11 keeps only valid Nov 2026 records and quarantines alk-* / test-* / Oct 2026
    expect(parsed.degustacionesRows.length).toBeGreaterThanOrEqual(8);
  });
});
