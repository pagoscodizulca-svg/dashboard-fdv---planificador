import { describe, it, expect } from 'vitest';
import {
  auditAndNormalizeReceiptPayload,
  parseVenezuelanReceiptText,
  parseVenezuelanMonto,
  normalizeReferenciaBancaria,
  normalizeVenezuelanBank,
  normalizeReceiptDates,
  normalizeRifCiTitular,
  safeExtractReceiptJson
} from '../../src/services/venezuelanReceiptAuditor';

describe('Agente Experto en Auditoría Bancaria Venezolana (venezuelanReceiptAuditor)', () => {
  it('Regla 1: Cortafuegos Emisor vs Beneficiario bloquea CODIZULCA y su RIF J-409876136 en titular_remitente/rif_ci_titular', () => {
    const rawFromAiWithHallucinatedSender = {
      legible: true,
      confianza: 0.98,
      metodo_pago: 'Pago Móvil',
      banco: 'Banesco',
      banco_origen: null,
      banco_destino: 'Banesco',
      monto_bs: 'Bs. 203.242,47',
      monto_texto_original: 'Bs. 203.242,47',
      nro_referencia: 'Ref. 460284758160',
      fecha_pago: '29/10/2026 06:54:03 PM',
      titular_remitente: 'COMERCIALIZADORA ZULIANA CODIZULCA C.A.',
      rif_ci_titular: 'J-40987613-6',
      beneficiario_detectado: null,
      observacion_ia: 'Comprobante de operación exitosa leído correctamente.'
    };

    const audited = auditAndNormalizeReceiptPayload(rawFromAiWithHallucinatedSender);

    expect(audited).toEqual({
      legible: true,
      confianza: 0.98,
      metodo_pago: 'Pago Móvil',
      banco: 'Banesco',
      banco_origen: null,
      banco_destino: 'Banesco',
      monto_bs: 203242.47,
      monto_texto_original: 'Bs. 203.242,47',
      nro_referencia: '460284758160',
      fecha_pago: '29/10/2026',
      fecha_iso: '2026-10-29',
      titular_remitente: null,
      rif_ci_titular: null,
      beneficiario_detectado: 'COMERCIALIZADORA ZULIANA CODIZULCA C.A.',
      observacion_ia: 'Comprobante de operación exitosa leído correctamente.'
    });
  });

  it('Regla 1 y 7: Preserva datos del Emisor real y normaliza RIF/CI con letra mayúscula y guion', () => {
    const audited = auditAndNormalizeReceiptPayload({
      legible: true,
      confianza: 0.97,
      metodo_pago: 'Transferencia Bancaria',
      banco: '0102 - BDVenlinea',
      banco_origen: 'BDV',
      banco_destino: '0134 Banesco',
      monto_bs: '1.450,00 Bs',
      monto_texto_original: '1.450,00 Bs',
      nro_referencia: 'Nro. 019283',
      fecha_pago: '2026-10-29',
      titular_remitente: 'ABASTOS LA BENDICION C.A.',
      rif_ci_titular: 'j30.192.834-0',
      beneficiario_detectado: 'CODIZULCA C.A.'
    });

    expect(audited.metodo_pago).toBe('Transferencia');
    expect(audited.banco).toBe('Banco de Venezuela');
    expect(audited.banco_origen).toBe('Banco de Venezuela');
    expect(audited.banco_destino).toBe('Banesco');
    expect(audited.monto_bs).toBe(1450);
    expect(audited.nro_referencia).toBe('019283');
    expect(audited.fecha_pago).toBe('29/10/2026');
    expect(audited.fecha_iso).toBe('2026-10-29');
    expect(audited.titular_remitente).toBe('ABASTOS LA BENDICION C.A.');
    expect(audited.rif_ci_titular).toBe('J-301928340');
    expect(audited.beneficiario_detectado).toBe('CODIZULCA C.A.');
  });

  it('Regla 3: Convierte montos venezolanos con puntos de miles y coma decimal a float estándar', () => {
    expect(parseVenezuelanMonto('Bs. 203.242,47')).toBe(203242.47);
    expect(parseVenezuelanMonto('1.450,00 Bs')).toBe(1450);
    expect(parseVenezuelanMonto('520,50')).toBe(520.5);
    expect(parseVenezuelanMonto(203242.47)).toBe(203242.47);
    expect(parseVenezuelanMonto('203,242.47')).toBe(203242.47);
  });

  it('Regla 4: Extrae referencia de solo dígitos y rechaza celulares o cuentas de 20 dígitos', () => {
    expect(normalizeReferenciaBancaria('Ref: 460284758160')).toBe('460284758160');
    expect(normalizeReferenciaBancaria('Secuencia #019283')).toBe('019283');
    expect(normalizeReferenciaBancaria('0414-6123456')).toBeNull();
    expect(normalizeReferenciaBancaria('584246123456')).toBeNull();
    expect(normalizeReferenciaBancaria('01340031880311234567')).toBeNull();
  });

  it('Regla 5: Normaliza el catálogo oficial de bancos venezolanos', () => {
    expect(normalizeVenezuelanBank('BanescOnline')).toBe('Banesco');
    expect(normalizeVenezuelanBank('PagoMóvilBDV')).toBe('Banco de Venezuela');
    expect(normalizeVenezuelanBank('Mercantil Tpago')).toBe('Mercantil');
    expect(normalizeVenezuelanBank('Provinet Dinero Rápido')).toBe('BBVA Provincial');
    expect(normalizeVenezuelanBank('0191 Banco Nacional de Credito')).toBe('BNC (Banco Nacional de Crédito)');
    expect(normalizeVenezuelanBank('0172 Bancamiga')).toBe('Bancamiga');
    expect(normalizeVenezuelanBank('100%Banco')).toBe('100% Banco');
  });

  it('Regla 6 y 7: Normaliza fechas impresas y documentos V/J/E/G', () => {
    expect(normalizeReceiptDates('29/10/2026 06:54:03 PM')).toEqual({
      fecha_pago: '29/10/2026',
      fecha_iso: '2026-10-29'
    });
    expect(normalizeReceiptDates('29 de octubre de 2026')).toEqual({
      fecha_pago: '29/10/2026',
      fecha_iso: '2026-10-29'
    });
    expect(normalizeRifCiTitular('V18.293.041')).toBe('V-18293041');
    expect(normalizeRifCiTitular('E-82345678')).toBe('E-82345678');
    expect(normalizeRifCiTitular('J-40987613-6')).toBeNull();
  });

  it('Motor determinista parseVenezuelanReceiptText audita recibo Banesco Pago Móvil ignorando comisión y beneficiario', () => {
    const ocrTextBanesco = `
      Banesco
      Operación Exitosa
      Pago Móvil
      Bs. 203.242,47
      Comisión: Bs. 609,73
      Fecha: 29/10/2026 06:54:03 PM
      Banco Destino
      0134 - Banesco
      Beneficiario
      CODIZULCA C.A.
      RIF: J-40987613-6
      Teléfono: 0414-6123456
      Número de Referencia
      460284758160
    `;

    const parsed = parseVenezuelanReceiptText(ocrTextBanesco);

    expect(parsed.legible).toBe(true);
    expect(parsed.metodo_pago).toBe('Pago Móvil');
    expect(parsed.banco).toBe('Banesco');
    expect(parsed.banco_destino).toBe('Banesco');
    expect(parsed.monto_bs).toBe(203242.47);
    expect(parsed.nro_referencia).toBe('460284758160');
    expect(parsed.fecha_pago).toBe('29/10/2026');
    expect(parsed.fecha_iso).toBe('2026-10-29');
    expect(parsed.titular_remitente).toBeNull();
    expect(parsed.rif_ci_titular).toBeNull();
    expect(parsed.beneficiario_detectado).toBe('CODIZULCA C.A.');
  });

  it('safeExtractReceiptJson limpia bloques markdown, BOM y comas finales residuales antes de JSON.parse', () => {
    const obj = safeExtractReceiptJson('\uFEFF```json\n{"legible": true, "monto_bs": 1500.25, }\n```');
    expect(obj.legible).toBe(true);
    expect(obj.monto_bs).toBe(1500.25);
  });

  it('Tolerancia a lectura parcial: conserva campos extraídos y marca legible=true aunque falte remitente o referencia', () => {
    const partial = auditAndNormalizeReceiptPayload({
      legible: false,
      metodo_pago: 'Pago Móvil',
      banco: 'Mercantil',
      monto_bs: 'Bs. 203.242, 47',
      nro_referencia: null,
      fecha_pago: '30/10/2026',
      titular_remitente: null,
      rif_ci_titular: null
    });

    expect(partial.legible).toBe(true);
    expect(partial.banco).toBe('Mercantil');
    expect(partial.monto_bs).toBe(203242.47);
    expect(partial.fecha_pago).toBe('30/10/2026');
    expect(partial.fecha_iso).toBe('2026-10-30');
    expect(partial.nro_referencia).toBeNull();
    expect(partial.titular_remitente).toBeNull();
  });
});
