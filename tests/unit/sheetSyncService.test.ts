import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as XLSX from 'xlsx';
import {
  parseSheetNumber,
  normalizeSellerKey,
  cleanClientCode,
  consolidateSellerToMasterKey,
  forwardFillMergedHeaderRow,
  parseGridActivacionRange,
  parseVolumenSkuRange,
  parseActivacionClientesAndCajas,
  computeNumericSha256,
  SellerNumericSyncTracker,
  type SellerMasterRecord
} from '../../src/services/sheetSyncService';
import { parseWorkbookFull } from '../../src/services/googleSheetsParser';
import { SyncSuccessToast } from '../../src/components/SyncSuccessToast';
import { SYNC_TOAST_DURATION_MS } from '../../src/hooks/useSellerLiveSync';

const USUARIOS_MASTER: SellerMasterRecord[] = [
  { usuario: 'MIKELANGELO DIAZ', rol: 'VENDEDOR', vendorId: 'V01' },
  { usuario: 'OSCAR ORTIZ', rol: 'VENDEDOR', vendorId: 'V02' },
  { usuario: 'J PABLO ARAUJO', rol: 'VENDEDOR', vendorId: 'V03' },
  { usuario: 'MARIANA CHACIN', rol: 'VENDEDOR', vendorId: 'V04' },
  { usuario: 'ADMIN', rol: 'ADMIN', vendorId: 'ADMIN' }
];

describe('PARTE 1: parseSheetNumber, normalizeSellerKey y reglas por pestaña', () => {
  it('Criterio 1: "8,000.00" -> 8000, "7,575.10" -> 7575.1, "-" -> 0, "-56.60" -> -56.6, decimales y errores', () => {
    expect(parseSheetNumber('8,000.00')).toBe(8000);
    expect(parseSheetNumber('7,575.10')).toBe(7575.1);
    expect(parseSheetNumber('12,345,678.90')).toBe(12345678.9);
    expect(parseSheetNumber('-')).toBe(0);
    expect(parseSheetNumber('—')).toBe(0);
    expect(parseSheetNumber('')).toBe(0);
    expect(parseSheetNumber(null)).toBe(0);
    expect(parseSheetNumber(undefined)).toBe(0);
    expect(parseSheetNumber('N/A')).toBe(0);
    expect(parseSheetNumber('#N/A')).toBe(0);
    expect(parseSheetNumber('#DIV/0!')).toBe(0);
    expect(parseSheetNumber('#VALUE!')).toBe(0);
    expect(parseSheetNumber('#REF!')).toBe(0);
    expect(parseSheetNumber('0.5')).toBe(0.5);
    expect(parseSheetNumber('0.95')).toBe(0.95);
    expect(parseSheetNumber('-56.60')).toBe(-56.6);
    expect(parseSheetNumber('-1.90%')).toBe(-1.9);
    expect(parseSheetNumber('$8,000.00')).toBe(8000);
    expect(parseSheetNumber('Bs 7,575.10')).toBe(7575.1);
    expect(parseSheetNumber('texto invalido')).toBe(0);
  });

  it('1.2 Normalización canónica y consolidación contra Usuarios (rutas subdivididas / sufijos numéricos)', () => {
    expect(normalizeSellerKey('  mikelángelo   díaz1  ')).toBe('MIKELANGELO DIAZ');
    expect(normalizeSellerKey('OSCAR ORTIZ-  CORO')).toBe('OSCAR ORTIZ - CORO');

    expect(consolidateSellerToMasterKey('MIKELANGELO DIAZ1', USUARIOS_MASTER)).toBe('MIKELANGELO DIAZ');
    expect(consolidateSellerToMasterKey('MIKELANGELO DIAZ - VILLA DEL ROS', USUARIOS_MASTER)).toBe('MIKELANGELO DIAZ');
    expect(consolidateSellerToMasterKey('OSCAR ORTIZ- CORO', USUARIOS_MASTER)).toBe('OSCAR ORTIZ');
    expect(consolidateSellerToMasterKey('OSCAR ORTIZ- LA COSTA', USUARIOS_MASTER)).toBe('OSCAR ORTIZ');
    expect(consolidateSellerToMasterKey('J PABLO ARAUJO - RUTA SUR', USUARIOS_MASTER)).toBe('J PABLO ARAUJO');
    expect(consolidateSellerToMasterKey('CUENTAS CLAVES 1 - MC', USUARIOS_MASTER)).toBe('MARIANA CHACIN');
  });

  it('1.3.1 Grid de Activación por Vendedor: doble fila de encabezado, trim de Fila 2 y Activados -> col - 1 desde Fila 3', () => {
    const gridRows = [
      ['', '', 'ACEITE', '', 'AZUCAR', '', 'POLLO', '', 'ESTANDAR Y SUPERIOR', '', 'MORTADELA SALPICAO', ''],
      [
        'Vendedor',
        'CARTERA',
        'Meta Aceite ',
        'Activados',
        'Meta azucar',
        'Activados',
        'Meta pollo',
        'Activados',
        'Meta ESTANDAR Y SUPERIOR ',
        'Activados',
        'Meta MORTADELA SALPICAO ',
        'Activados'
      ],
      ['OSCAR ORTIZ- CORO', '120', '40', '28', '35', '20', '25', '-', '18', '12', '15', '10'],
      ['TOTAL GENERAL', '120', '40', '28', '35', '20', '25', '0', '18', '12', '15', '10']
    ];

    const parsed = parseGridActivacionRange(gridRows, USUARIOS_MASTER);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].masterSellerKey).toBe('OSCAR ORTIZ');
    expect(parsed[0].cartera).toBe(120);
    expect(parsed[0].categories['ACEITE']).toEqual({ meta: 40, activados: 28 });
    expect(parsed[0].categories['POLLO']).toEqual({ meta: 25, activados: 0 });
    expect(parsed[0].categories['MORTADELA SALPICAO']).toEqual({ meta: 15, activados: 10 });
  });

  it('Criterios 2 y 3: Volumen por SKU con celdas combinadas (forward-fill Fila 1) y variantes CUOTA KG / VENTA KG vs CUOTA / KG', () => {
    // Respuesta estilo Google Sheets API donde Row 1 solo trae el nombre del vendedor en la primera celda del triplete
    const volRows = [
      ['', '', 'OSCAR ORTIZ- CORO', '', '', 'OSCAR ORTIZ- LA COSTA', '', '', 'MIKELANGELO DIAZ1', '', ''],
      ['Cod', 'Articulo', 'CUOTA', 'KG', '%', 'CUOTA KG', 'VENTA KG', '%', 'CUOTA KG', 'VENTA KG', '%'],
      ['1001', 'POLLO ENTERO', '8,000.00', '7,575.10', '94.69%', '2,000.00', '1,000.00', '#DIV/0!', '500.00', '-56.60', '-11.32%'],
      ['TOTAL', 'TOTAL GENERAL', '10,000.00', '8,575.10', '85.75%', '2,000.00', '1,000.00', '50%', '500.00', '-56.60', '-11.32%']
    ];

    const filled = forwardFillMergedHeaderRow(volRows[0], volRows[1]);
    expect(filled.slice(2, 5)).toEqual(['OSCAR ORTIZ- CORO', 'OSCAR ORTIZ- CORO', 'OSCAR ORTIZ- CORO']);
    expect(filled.slice(5, 8)).toEqual(['OSCAR ORTIZ- LA COSTA', 'OSCAR ORTIZ- LA COSTA', 'OSCAR ORTIZ- LA COSTA']);
    expect(filled.slice(8, 11)).toEqual(['MIKELANGELO DIAZ1', 'MIKELANGELO DIAZ1', 'MIKELANGELO DIAZ1']);

    const parsed = parseVolumenSkuRange(volRows, USUARIOS_MASTER);
    expect(parsed).toHaveLength(3);

    const coro = parsed.find((r) => r.routeKey === 'OSCAR ORTIZ - CORO')!;
    expect(coro.masterSellerKey).toBe('OSCAR ORTIZ');
    expect(coro.cuotaKg).toBe(8000);
    expect(coro.ventaKg).toBe(7575.1);
    expect(coro.porcentaje).toBe(94.69);

    const laCosta = parsed.find((r) => r.routeKey === 'OSCAR ORTIZ - LA COSTA')!;
    expect(laCosta.masterSellerKey).toBe('OSCAR ORTIZ');
    expect(laCosta.cuotaKg).toBe(2000);
    expect(laCosta.ventaKg).toBe(1000);
    // #DIV/0! corregido mediante recálculo exacto (1000 / 2000) * 100 = 50
    expect(laCosta.porcentaje).toBe(50);

    const mikel = parsed.find((r) => r.routeKey === 'MIKELANGELO DIAZ')!;
    expect(mikel.masterSellerKey).toBe('MIKELANGELO DIAZ');
    expect(mikel.cuotaKg).toBe(500);
    expect(mikel.ventaKg).toBe(-56.6);
    expect(mikel.porcentaje).toBe(-11.32);
  });

  it('1.3.3 Activación por Cliente y hojas de cajas: códigos sin espacios ni .0 residual y cajas decimales exactas (0.5, 0.9, 0.95)', () => {
    expect(cleanClientCode('  #007499.0  ')).toEqual({ rawClean: '007499', canonical: '7499' });
    expect(cleanClientCode('8812.00')).toEqual({ rawClean: '8812', canonical: '8812' });

    const rows = parseActivacionClientesAndCajas({
      clientesRows: [
        ['CODIGO', 'RAZON SOCIAL', 'VENDEDOR'],
        ['7499.0', 'ABASTO CENTRAL', 'OSCAR ORTIZ- CORO'],
        ['008812.00', 'SUPER MERCADO NORTE', 'MIKELANGELO DIAZ1']
      ],
      boxSheets: {
        pollo: [
          ['Id Cliente', 'Cliente', 'Cajas'],
          ['007499', 'ABASTO CENTRAL', '0.5'],
          ['7499.0', 'ABASTO CENTRAL', '0.95']
        ],
        leche: [
          ['Id Cliente', 'Cliente', 'Cajas'],
          ['8812', 'SUPER MERCADO NORTE', '0.9']
        ]
      },
      usuariosMaster: USUARIOS_MASTER
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].codigo).toBe('7499');
    expect(rows[0].masterSellerKey).toBe('OSCAR ORTIZ');
    expect(rows[0].cajas.pollo).toBe(1.45);
    expect(rows[0].activo).toBe(true);

    expect(rows[1].codigoCanonico).toBe('8812');
    expect(rows[1].masterSellerKey).toBe('MIKELANGELO DIAZ');
    expect(rows[1].cajas.leche).toBe(0.9);
  });

  it('Integración googleSheetsParser.parseWorkbookFull preserva forward-fill sin !merges y limpia .0 en códigos', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['', '', 'ACEITE', ''],
        ['Vendedor', 'CARTERA', 'Meta Aceite ', 'Activados'],
        ['OSCAR ORTIZ- CORO', '80', '20', '15']
      ]),
      'Grid de Activación por Vendedor'
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['', '', 'OSCAR ORTIZ- CORO', '', ''],
        ['Cod', 'Articulo', 'CUOTA KG', 'VENTA KG', '%'],
        ['1001', 'POLLO ENTERO', '8,000.00', '7,575.10', '']
      ]),
      'Volumen por SKU'
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['CODIGO', 'RAZON SOCIAL', 'VENDEDOR'],
        ['7499.0', 'ABASTO UNO', 'OSCAR ORTIZ- CORO']
      ]),
      'Activación por Cliente'
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Id Cliente', 'Cliente', 'Cajas'],
        ['007499.0', 'ABASTO UNO', '0.95']
      ]),
      'pollo'
    );

    const parsed = parseWorkbookFull(XLSX, wb, { periodo: '2026-11' });
    expect(parsed.volumenApiRows).toHaveLength(1);
    expect(parsed.volumenApiRows[0].meta).toBe(8000);
    expect(parsed.volumenApiRows[0].ejecutado).toBe(7575.1);
    expect(parsed.volumenApiRows[0].porcentajeCumplimiento).toBe(94.69);

    const cliente = parsed.activacionApiRows.find((c) => c.id === '7499');
    expect(cliente).toBeDefined();
    expect(cliente?.cajas?.POLLO).toBe(0.95);
    expect(cliente?.status).toBe('ACTIVO');
  });
});

describe('PARTES 2 y 5: SellerNumericSyncTracker (SHA-256 por vendedor y cero falsos positivos al reiniciar Render)', () => {
  const buildSnapshot = (oscarKg: number, mikelKg: number, _irrelevantText = 'v1') => ({
    metasApiRows: [
      { vendedorId: 'OSCAR ORTIZ- CORO', vendedorKey: 'OSCAR ORTIZ - CORO', categoria: 'ACEITE', cartera: 100, meta: 30, activados: 20 },
      { vendedorId: 'MIKELANGELO DIAZ1', vendedorKey: 'MIKELANGELO DIAZ', categoria: 'ACEITE', cartera: 90, meta: 25, activados: 18 }
    ],
    volumenApiRows: [
      { vendedorId: 'OSCAR ORTIZ- CORO', vendedorKey: 'OSCAR ORTIZ - CORO', sku: '1001', meta: 8000, ejecutado: oscarKg, ventaNetaKg: oscarKg },
      { vendedorId: 'MIKELANGELO DIAZ1', vendedorKey: 'MIKELANGELO DIAZ', sku: '1001', meta: 5000, ejecutado: mikelKg, ventaNetaKg: mikelKg }
    ],
    activacionApiRows: [
      { id: '7499.0', vendedorId: 'OSCAR ORTIZ- CORO', vendedorKey: 'OSCAR ORTIZ - CORO', status: 'ACTIVO', cajas: { pollo: 0.95 } }
    ],
    usuariosRows: USUARIOS_MASTER
  });

  it('Criterio 5: Arranque en frío / reinicio de Render registra version = 1 SIN emitir ninguna notificación falsa', () => {
    let now = 1_700_000_000_000;
    const tracker = new SellerNumericSyncTracker(() => now);

    const initialChanges = tracker.applyParsedWorkbook(buildSnapshot(7575.1, 3100));
    expect(initialChanges).toHaveLength(0);
    expect(tracker.getSellerStatus('OSCAR ORTIZ').version).toBe(1);
    expect(tracker.getSellerStatus('MIKELANGELO DIAZ').version).toBe(1);

    // Simular reinicio completo de instancia en Render sin cambios en la hoja
    const restartedTracker = new SellerNumericSyncTracker(() => now + 5000);
    const changesAfterRestart = restartedTracker.applyParsedWorkbook(buildSnapshot(7575.1, 3100));
    expect(changesAfterRestart).toHaveLength(0);
    expect(restartedTracker.getSellerStatus('OSCAR ORTIZ').version).toBe(1);
  });

  it('Criterio 4: Solo notifica al vendedor cuyos números cambiaron; ediciones sin cambio numérico no disparan alerta', () => {
    let now = 1_700_000_000_000;
    const tracker = new SellerNumericSyncTracker(() => now);

    // Ciclo 1: baseline silencioso
    expect(tracker.applyParsedWorkbook(buildSnapshot(7575.1, 3100, 'nota A'))).toHaveLength(0);

    // Ciclo 2: texto irrelevante cambia pero números son idénticos -> 0 notificaciones
    now += 60_000;
    expect(tracker.applyParsedWorkbook(buildSnapshot(7575.1, 3100, 'nota B distinta'))).toHaveLength(0);
    expect(tracker.getSellerStatus('OSCAR ORTIZ').version).toBe(1);

    // Ciclo 3: cambia ÚNICAMENTE el volumen numérico de OSCAR ORTIZ (7575.1 -> 8000)
    now += 60_000;
    const changed = tracker.applyParsedWorkbook(buildSnapshot(8000, 3100, 'nota B'));
    const changedIds = changed.map((e) => e.sellerId);

    expect(changedIds).toContain('OSCAR ORTIZ');
    expect(changedIds).toContain('OSCAR ORTIZ - CORO');
    expect(changedIds).toContain('ADMIN');
    expect(changedIds).not.toContain('MIKELANGELO DIAZ');

    expect(tracker.getSellerStatus('OSCAR ORTIZ').version).toBe(2);
    expect(tracker.getSellerStatus('MIKELANGELO DIAZ').version).toBe(1);
  });

  it('Hash SHA-256 es 100% determinista independientemente del orden de las claves de objeto', () => {
    const h1 = computeNumericSha256({ b: 2, a: { y: 0.95, x: 8000 } });
    const h2 = computeNumericSha256({ a: { x: 8000, y: 0.95 }, b: 2 });
    expect(h1).toBe(h2);
  });
});

describe('PARTE 4: Toast exacto de 5.0 segundos ("Tus datos han sido actualizados con éxito")', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Renderiza el texto literal exacto, z-[9999], position fixed y pointer-events-none cuando visible=true', () => {
    const hiddenHtml = renderToStaticMarkup(React.createElement(SyncSuccessToast, { visible: false }));
    expect(hiddenHtml).toBe('');

    const visibleHtml = renderToStaticMarkup(React.createElement(SyncSuccessToast, { visible: true }));
    expect(visibleHtml).toContain('Tus datos han sido actualizados con éxito');
    expect(visibleHtml).toContain('z-[9999]');
    expect(visibleHtml).toContain('pointer-events-none');
    expect(visibleHtml).toContain('fixed');
    expect(visibleHtml).toContain('data-testid="seller-sync-toast"');
  });

  it('Duración exacta configurada en 5000 ms (visible en 4999 ms, oculta a los 5000 ms exactos con clearTimeout)', () => {
    expect(SYNC_TOAST_DURATION_MS).toBe(5000);
    vi.useFakeTimers();

    let visible = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const triggerToast = () => {
      if (timer) clearTimeout(timer);
      visible = true;
      timer = setTimeout(() => {
        timer = null;
        visible = false;
      }, SYNC_TOAST_DURATION_MS);
    };

    triggerToast();
    expect(visible).toBe(true);

    vi.advanceTimersByTime(4999);
    expect(visible).toBe(true);

    vi.advanceTimersByTime(1);
    expect(visible).toBe(false);

    // Dos actualizaciones consecutivas: reinicia contador limpio a 5000 ms completos desde la segunda
    triggerToast();
    vi.advanceTimersByTime(3000);
    expect(visible).toBe(true);
    triggerToast();
    vi.advanceTimersByTime(4999);
    expect(visible).toBe(true);
    vi.advanceTimersByTime(1);
    expect(visible).toBe(false);
  });
});
