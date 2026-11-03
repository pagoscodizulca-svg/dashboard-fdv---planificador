import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as XLSX from 'xlsx';
import {
  BCV_INDICE_INVERSION_URL,
  BCV_HISTORY_CACHE_KEY,
  normalizeBcvDateInput,
  parseNumeroBcv,
  parseBcvIndiceInversionHtml,
  parseBcvExcelBuffer,
  resolveBcvRateWithBusinessDayFallback,
  readLocalBcvRatesCache,
  saveToLocalBcvRatesCache,
  getTasaBcvPorFecha,
} from '../../src/services/bcvRateService';

const SAMPLE_BCV_INDICE_INVERSION_HTML = `
<table class="views-table cols-4 table table-striped table-condensed table-0 table-0">
  <thead>
    <tr>
      <th class="views-field views-field-field-fecha-del-indicador">Fecha</th>
      <th class="views-field views-field-views-conditional">Tipo de Cambio de Venta (Bs / USD)</th>
      <th class="views-field views-field-views-conditional-1">Indice de Inversión</th>
      <th class="views-field views-field-nothing">Indice Nueva Expresión</th>
    </tr>
  </thead>
  <tbody>
    <tr class="odd letra-pequeña views-row-first">
      <td class="views-field views-field-field-fecha-del-indicador">
        <span class="date-display-single" property="dc:date" datatype="xsd:dateTime" content="2026-11-03T00:00:00-04:00">03-11-2026</span>
      </td>
      <td class="views-field views-field-views-conditional">891,10540000</td>
      <td class="views-field views-field-views-conditional-1">N/A</td>
      <td class="views-field views-field-nothing">4,35656757</td>
    </tr>
    <tr class="even letra-pequeña">
      <td class="views-field views-field-field-fecha-del-indicador">
        <span class="date-display-single" property="dc:date" datatype="xsd:dateTime" content="2026-11-02T00:00:00-04:00">02-11-2026</span>
      </td>
      <td class="views-field views-field-views-conditional">889,57540000</td>
      <td class="views-field views-field-views-conditional-1">N/A</td>
      <td class="views-field views-field-nothing">4,34908748</td>
    </tr>
    <tr class="odd letra-pequeña">
      <td class="views-field views-field-field-fecha-del-indicador">
        <span class="date-display-single" property="dc:date" datatype="xsd:dateTime" content="2026-10-27T00:00:00-04:00">27-10-2026</span>
      </td>
      <td class="views-field views-field-views-conditional">887,30200000</td>
      <td class="views-field views-field-views-conditional-1">N/A</td>
      <td class="views-field views-field-nothing">4,33797294</td>
    </tr>
    <tr class="even letra-pequeña">
      <td class="views-field views-field-field-fecha-del-indicador">
        <span class="date-display-single" property="dc:date" datatype="xsd:dateTime" content="2026-10-23T00:00:00-04:00">23-10-2026</span>
      </td>
      <td class="views-field views-field-views-conditional">886,22710000</td>
      <td class="views-field views-field-views-conditional-1">N/A</td>
      <td class="views-field views-field-nothing">4,33271781</td>
    </tr>
  </tbody>
</table>
`;

describe('Servicio y Scraper de Tasa Oficial BCV (bcvRateService)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    vi.restoreAllMocks();
  });

  it('normalizeBcvDateInput normaliza DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD y DDMMYYYY a YYYY-MM-DD', () => {
    expect(normalizeBcvDateInput('23/10/2026')).toEqual({
      iso: '2026-10-23',
      display: '23/10/2026',
    });
    expect(normalizeBcvDateInput('23-10-2026')).toEqual({
      iso: '2026-10-23',
      display: '23/10/2026',
    });
    expect(normalizeBcvDateInput('2026-10-23')).toEqual({
      iso: '2026-10-23',
      display: '23/10/2026',
    });
    expect(normalizeBcvDateInput('23102026')).toEqual({
      iso: '2026-10-23',
      display: '23/10/2026',
    });
  });

  it('parseNumeroBcv convierte el formato numérico venezolano del BCV a número redondeado a 2 decimales', () => {
    expect(parseNumeroBcv('886,22710000')).toBe(886.23);
    expect(parseNumeroBcv('889,57540000')).toBe(889.58);
    expect(parseNumeroBcv('891,10540000')).toBe(891.11);
    expect(parseNumeroBcv('1.234,56780000')).toBe(1234.57);
    expect(parseNumeroBcv(886.2271)).toBe(886.23);
    expect(parseNumeroBcv('N/A')).toBe(0);
  });

  it('parseBcvIndiceInversionHtml extrae las tasas históricas de la tabla HTML de https://www.bcv.org.ve/estadisticas/indice-de-inversion', () => {
    const rates = parseBcvIndiceInversionHtml(SAMPLE_BCV_INDICE_INVERSION_HTML);
    expect(rates['2026-11-03']).toBe(891.11);
    expect(rates['2026-11-02']).toBe(889.58);
    expect(rates['2026-10-27']).toBe(887.3);
    expect(rates['2026-10-23']).toBe(886.23);
  });

  it('parseBcvExcelBuffer extrae tasas desde libros estadísticos .xls/.xlsx del BCV', () => {
    const wb = XLSX.utils.book_new();
    const sheetData = [
      ['BANCO CENTRAL DE VENEZUELA', '', '', '', '23/10/2026 04:21 PM'],
      ['Fecha Operacion: 22/10/2026', '', 'Fecha Valor: 23/10/2026'],
      ['', 'Moneda/País', 'Compra (BID)', 'Venta (ASK)', 'Compra (BID)', 'Venta (ASK)'],
      ['EUR', 'Zona Euro', 1.12025, 1.12029, 991.55, 994.03],
      ['USD', 'E.U.A.', 1, 1, 884.01, 886.2271],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, '23102026');
    const outBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const parsed = parseBcvExcelBuffer(new Uint8Array(outBuf));
    expect(parsed['2026-10-23']).toBe(886.23);
  });

  it('resolveBcvRateWithBusinessDayFallback aplica la regla bancaria de retroceso hasta 5 días en sábados, domingos y feriados', () => {
    const rates = parseBcvIndiceInversionHtml(SAMPLE_BCV_INDICE_INVERSION_HTML);

    // Día hábil exacto: viernes 23/10/2026
    const exact = resolveBcvRateWithBusinessDayFallback(rates, '23/10/2026', 5);
    expect(exact).not.toBeNull();
    expect(exact?.tasa).toBe(886.23);
    expect(exact?.fechaValor).toBe('2026-10-23');
    expect(exact?.esDiaHabilAnterior).toBe(false);

    // Domingo 25/10/2026 -> retrocede al viernes 23/10/2026
    const sunday = resolveBcvRateWithBusinessDayFallback(rates, '25/10/2026', 5);
    expect(sunday).not.toBeNull();
    expect(sunday?.tasa).toBe(886.23);
    expect(sunday?.fechaSolicitada).toBe('2026-10-25');
    expect(sunday?.fechaValor).toBe('2026-10-23');
    expect(sunday?.fechaValorDisplay).toBe('23/10/2026');
    expect(sunday?.esDiaHabilAnterior).toBe(true);

    // Lunes sin publicación 26/10/2026 -> retrocede 3 días al viernes 23/10/2026
    const holidayMonday = resolveBcvRateWithBusinessDayFallback(rates, '26/10/2026', 5);
    expect(holidayMonday).not.toBeNull();
    expect(holidayMonday?.tasa).toBe(886.23);
    expect(holidayMonday?.fechaValor).toBe('2026-10-23');
    expect(holidayMonday?.esDiaHabilAnterior).toBe(true);
  });

  it('getTasaBcvPorFecha guarda y reutiliza el diccionario local bcv_rates_history_cache de forma instantánea', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tasa: 886.23,
        fechaValor: '2026-10-23',
        fechaSolicitada: '2026-10-23',
        fuente: BCV_INDICE_INVERSION_URL,
        esDiaHabilAnterior: false,
        serieReciente: {
          '2026-10-23': 886.23,
          '2026-11-02': 889.58,
          '2026-11-03': 891.11,
        },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    // Primera consulta a 23/10/2026: llama al endpoint y guarda en caché
    const res1 = await getTasaBcvPorFecha('23/10/2026');
    expect(res1.tasa).toBe(886.23);
    expect(res1.fechaValor).toBe('2026-10-23');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Verificar que se guardó en localStorage bajo `bcv_rates_history_cache`
    if (typeof window !== 'undefined' && window.localStorage) {
      const cache = readLocalBcvRatesCache();
      expect(cache['2026-10-23']?.tasa).toBe(886.23);
      expect(cache['2026-11-02']?.tasa).toBe(889.58);

      // Segunda consulta a 02/11/2026: responde instantáneamente desde caché sin llamar a fetch
      const res2 = await getTasaBcvPorFecha('02/11/2026');
      expect(res2.tasa).toBe(889.58);
      expect(res2.desdeCache).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    }
  });
});
