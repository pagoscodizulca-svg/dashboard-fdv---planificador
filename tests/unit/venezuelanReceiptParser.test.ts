import { describe, it, expect } from 'vitest';
import {
  BANCOS_SUDEBAN,
  parseMontoVenezolano,
  formatMontoVenezolano,
  inferirBancoVenezolano,
  extractCuentaEnmascaradaVenezolana,
  normalizeReferenciaVenezolana,
  normalizeFechaVenezolana,
  normalizeExtractedReceipt,
  fileToFullBase64
} from '../../src/services/venezuelanReceiptParser';
import { parseVenezuelanReceiptText } from '../../src/services/venezuelanReceiptAuditor';

describe('Motor de Normalización Bancaria Venezolana (venezuelanReceiptParser)', () => {
  it('parseMontoVenezolano convierte con precisión absoluta todos los formatos venezolanos, US y OCR con moiré', () => {
    expect(parseMontoVenezolano(48742.49)).toBe(48742.49);
    expect(parseMontoVenezolano('48.742,49')).toBe(48742.49);
    expect(parseMontoVenezolano('Bs. 48.742,49')).toBe(48742.49);
    expect(parseMontoVenezolano('48,742.49')).toBe(48742.49);
    expect(parseMontoVenezolano('48742,49')).toBe(48742.49);
    expect(parseMontoVenezolano('48742.49')).toBe(48742.49);
    expect(parseMontoVenezolano('48.742.49')).toBe(48742.49);
    expect(parseMontoVenezolano('48 742 49')).toBe(48742.49);
    expect(parseMontoVenezolano('576 599.07')).toBe(576599.07);
    expect(parseMontoVenezolano('VEB 121,455.99')).toBe(121455.99);
    expect(parseMontoVenezolano(null)).toBe(0);
    expect(parseMontoVenezolano('')).toBe(0);
    expect(formatMontoVenezolano(48742.49)).toBe('48.742,49');
  });

  it('inferirBancoVenezolano identifica bancos por palabras clave (Provinet, Banesco, BDV, Mercantil, BNC) y códigos SUDEBAN', () => {
    expect(inferirBancoVenezolano('', '', 'Provinet')).toBe('BBVA Provincial');
    expect(inferirBancoVenezolano('', '0108*****40*****7396', '')).toBe('BBVA Provincial');
    expect(inferirBancoVenezolano('Provinet', '0108*****40*****7396', '')).toBe('BBVA Provincial');
    expect(inferirBancoVenezolano('', '01341234567890', '')).toBe('Banesco');
    expect(inferirBancoVenezolano('', '01021234567890', '')).toBe('Banco de Venezuela');
    expect(inferirBancoVenezolano('', '', 'TPago Mercantil')).toBe('Banco Mercantil');
    expect(inferirBancoVenezolano('', '01721234567890', '')).toBe('Bancamiga');
    expect(inferirBancoVenezolano('', '01910304812100094878', '')).toBe('BNC (Banco Nacional de Crédito)');
    expect(BANCOS_SUDEBAN['0108']).toBe('BBVA Provincial');
  });

  it('Extrae todos los campos del comprobante real de Provinet en columna sin etiquetas (23/10/2026 • 000012723 • 48.742,49 • 0108*****40*****7396 • Provinet)', () => {
    const rawColumnaProvinet = `
      23/10/2026
      000012723
      48.742,49
      0108*****40*****7396
      Provinet
    `;

    const audited = parseVenezuelanReceiptText(rawColumnaProvinet);
    const normalized = normalizeExtractedReceipt(audited);

    expect(normalized.fecha).toBe('2026-10-23');
    expect(normalized.fechaDisplay).toBe('23/10/2026');
    expect(normalized.referencia).toBe('000012723');
    expect(normalized.montoNumerico).toBe(48742.49);
    expect(normalized.montoFormateado).toBe('48.742,49');
    expect(normalized.banco).toBe('BBVA Provincial');
    expect(normalized.cuentaEnmascarada).toBe('0108*****40*****7396');
    expect(normalized.confianza).toBe('alta');
  });

  it('Reconstruye datos exactos cuando el OCR lee foto a monitor con efecto moiré (48 742 49 y 0105-"---40:-:::7396 + Provinet)', () => {
    const ocrMoireText = `
      |
      23/10/2026 |
      000012723 |
      48 742 49
      0105-"---40:-:::7396
      | Provinet |
    `;

    const audited = parseVenezuelanReceiptText(ocrMoireText);
    const normalized = normalizeExtractedReceipt(audited);

    expect(normalized.fecha).toBe('2026-10-23');
    expect(normalized.fechaDisplay).toBe('23/10/2026');
    expect(normalized.referencia).toBe('000012723');
    expect(normalized.montoNumerico).toBe(48742.49);
    expect(normalized.montoFormateado).toBe('48.742,49');
    expect(normalized.banco).toBe('BBVA Provincial');
    expect(normalized.cuentaEnmascarada).toBe('0108*****40*****7396');
  });

  it('No genera falsos positivos de "Cuenta/Canal: Pago Móvil" cuando la lectura viene vacía', () => {
    const emptyAudited = parseVenezuelanReceiptText('QM\n\n——\nN l\nuu\n');
    expect(emptyAudited.legible).toBe(false);
    expect(emptyAudited.es_legible).toBe(false);
    expect(emptyAudited.canal).toBeNull();

    const normalized = normalizeExtractedReceipt(emptyAudited, '2026-11-03');
    expect(normalized.banco).toBe('');
    expect(normalized.montoNumerico).toBe(0);
    expect(normalized.referencia).toBe('');
    expect(normalized.cuentaEnmascarada).toBeUndefined();
    expect(normalized.confianza).toBe('baja');
  });

  it('fileToFullBase64 convierte un Blob/File íntegro a Base64 sin recorte', async () => {
    const sampleBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const blob = new Blob([sampleBytes], { type: 'image/jpeg' });
    const res = await fileToFullBase64(blob);
    expect(res.mimeType).toBe('image/jpeg');
    expect(res.base64Data.length).toBeGreaterThan(8);
    expect(res.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
  });
});
