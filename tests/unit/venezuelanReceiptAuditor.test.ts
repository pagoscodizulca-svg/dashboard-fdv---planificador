import { describe, it, expect } from 'vitest';
import {
  auditAndNormalizeReceiptPayload,
  parseVenezuelanReceiptText,
  parseVenezuelanMonto,
  parseMontoVenezolano,
  detectReceiptMimeType,
  VENEZUELAN_RECEIPT_RESPONSE_SCHEMA,
  VENEZUELAN_BANKING_AUDIT_SYSTEM_PROMPT,
  normalizeReferenciaBancaria,
  normalizeVenezuelanBank,
  normalizeReceiptDates,
  normalizeRifCiTitular,
  safeExtractReceiptJson,
  extractNumeroCuentaVenezolana,
  extractMontoTextoExacto,
  resolveVenezuelanBankDetails,
  toCanonicalVenezuelanReceiptJson
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

    expect(audited).toMatchObject({
      lectura_exitosa: true,
      nivel_confianza: 'ALTO',
      requiere_revision_manual: false,
      motivo_revision: null,
      datos_extraidos: {
        fecha_operacion: '2026-10-29',
        fecha_original: '29/10/2026',
        numero_referencia: '460284758160',
        monto_numerico: 203242.47,
        monto_texto: '203.242,47',
        moneda: 'VES',
        banco_identificado: 'Banesco',
        codigo_banco: '0134',
        plataforma_canal: 'Pago Móvil',
        numero_cuenta: null
      },
      legible: true,
      confianza: 0.98,
      confianza_lectura: 'alta',
      metodo_pago: 'Pago Móvil',
      banco: 'Banesco',
      banco_origen: null,
      banco_destino: 'Banesco',
      monto_bs: 203242.47,
      monto_texto_original: 'Bs. 203.242,47',
      referencia: '460284758160',
      nro_referencia: '460284758160',
      codigo_autorizacion: null,
      fecha_pago: '29/10/2026',
      fecha_iso: '2026-10-29',
      titular_remitente: null,
      rif_ci_titular: null,
      beneficiario_detectado: 'COMERCIALIZADORA ZULIANA CODIZULCA C.A.',
      observacion_auditoria: 'Comprobante de operación exitosa leído correctamente.',
      observacion_ia: 'Comprobante de operación exitosa leído correctamente.'
    });
  });

  it('Caso BNC Pago Móvil (Reglas 1–6): ignora ícono de copiado en referencia, separa código autorización y devuelve fecha_pago=null', () => {
    const bncPayload = auditAndNormalizeReceiptPayload({
      metodo_pago: 'Su pago móvil ha sido Ejecutado exitosamente',
      banco: '0191 - BNC',
      monto_bs: 'Bs. 22.000,00',
      referencia: '947474757 [ícono]',
      codigo_autorizacion: '236792',
      fecha_pago: null,
      confianza_lectura: 'alta',
      observacion_auditoria:
        'Comprobante BNC Pago Móvil por Bs. 22.000,00. Ícono de copiado ignorado en referencia.'
    });

    expect(bncPayload.metodo_pago).toBe('Pago Móvil');
    expect(bncPayload.banco).toBe('BNC (Banco Nacional de Crédito)');
    expect(bncPayload.monto_bs).toBe(22000.0);
    expect(bncPayload.referencia).toBe('947474757');
    expect(bncPayload.nro_referencia).toBe('947474757');
    expect(bncPayload.codigo_autorizacion).toBe('236792');
    expect(bncPayload.fecha_pago).toBeNull();
    expect(bncPayload.fecha_iso).toBeNull();
    expect(bncPayload.confianza_lectura).toBe('alta');
    expect(bncPayload.observacion_auditoria).toBe(
      'Comprobante BNC Pago Móvil por Bs. 22.000,00. Ícono de copiado ignorado en referencia.'
    );
  });

  it('Regla 6 (Validación de Coherencia): rechaza montos > 5.000.000.000,00 Bs o con más de 10 dígitos enteros, teléfonos o RIF', () => {
    expect(parseVenezuelanMonto(5000000000.01)).toBeNull();
    expect(parseVenezuelanMonto('Bs. 99.999.999.999,00')).toBeNull();
    expect(parseVenezuelanMonto('04146123456')).toBeNull();
    expect(parseVenezuelanMonto('J-409876136')).toBeNull();
    expect(parseVenezuelanMonto('01340031880311234567')).toBeNull();
    expect(parseVenezuelanMonto('Bs. 22.000,00')).toBe(22000.0);
  });

  it('Regla 2 (Anti-Alucinación en Referencias): elimina ícono de copiado al final sin agregar 0, O u 8 extra', () => {
    expect(normalizeReferenciaBancaria('947474757 [ícono]')).toBe('947474757');
    expect(normalizeReferenciaBancaria('947474757 0')).toBe('947474757');
    expect(normalizeReferenciaBancaria('947474757 O')).toBe('947474757');
    expect(normalizeReferenciaBancaria('947474757 8')).toBe('947474757');
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

  it('Inferencia por patrón y posición (Provinet / tabla recortada sin etiquetas): extrae fecha, referencia con ceros iniciales, monto sin Bs. y banco por cuenta 0108*****', () => {
    const croppedProvinetText = `
      0108*****40*****7396
      02/11/2026
      000019111
      576.599,07
    `;

    const parsed = parseVenezuelanReceiptText(croppedProvinetText);
    expect(parsed.legible).toBe(true);
    expect(parsed.fecha_pago).toBe('02/11/2026');
    expect(parsed.fecha_iso).toBe('2026-11-02');
    expect(parsed.referencia).toBe('000019111');
    expect(parsed.nro_referencia).toBe('000019111');
    expect(parsed.monto_bs).toBe(576599.07);
    expect(parsed.banco).toBe('BBVA Provincial');
    expect(parsed.titular_remitente).toBeNull();
    expect(parsed.rif_ci_titular).toBeNull();

    const auditedDirect = auditAndNormalizeReceiptPayload({
      fecha_pago: '02/11/2026',
      referencia: '000019111',
      monto_bs: 576599.07,
      monto_bs_formateado: '576.599,07',
      banco: null,
      metodo_pago: 'Pago Móvil',
      cuenta_enmascarada: '0108*****40*****7396',
      titular: '',
      rif_ci: ''
    });
    expect(auditedDirect.banco).toBe('BBVA Provincial');
    expect(auditedDirect.referencia).toBe('000019111');
    expect(auditedDirect.monto_bs).toBe(576599.07);
    expect(auditedDirect.fecha_pago).toBe('02/11/2026');
  });

  it('Estructura de salida JSON Puro (toCanonicalVenezuelanReceiptJson) y Heurística para Soportes Recortados sin etiquetas', () => {
    const rawAiCanonicalPayload = {
      lectura_exitosa: true,
      nivel_confianza: 'ALTO',
      requiere_revision_manual: false,
      motivo_revision: null,
      datos_extraidos: {
        fecha_operacion: '2026-11-02',
        fecha_original: '02/11/2026',
        numero_referencia: '000019111',
        monto_numerico: 576599.07,
        monto_texto: '576.599,07',
        moneda: 'VES',
        banco_identificado: null,
        codigo_banco: null,
        plataforma_canal: 'Provinet',
        numero_cuenta: '0108*****40*****7396'
      },
      evidencia_visual: {
        tiene_etiquetas_visibles: false,
        es_foto_de_pantalla: true,
        lineas_crudas_detectadas: [
          '0108*****40*****7396',
          '02/11/2026',
          '000019111',
          '576.599,07'
        ]
      }
    };

    const canonical = toCanonicalVenezuelanReceiptJson(rawAiCanonicalPayload);

    expect(canonical).toEqual({
      lectura_exitosa: true,
      nivel_confianza: 'ALTO',
      requiere_revision_manual: false,
      motivo_revision: null,
      datos_extraidos: {
        fecha_operacion: '2026-11-02',
        fecha_original: '02/11/2026',
        numero_referencia: '000019111',
        monto_numerico: 576599.07,
        monto_texto: '576.599,07',
        moneda: 'VES',
        banco_identificado: 'BBVA Provincial',
        codigo_banco: '0108',
        plataforma_canal: 'Provinet',
        numero_cuenta: '0108*****40*****7396'
      },
      evidencia_visual: {
        tiene_etiquetas_visibles: false,
        es_foto_de_pantalla: true,
        lineas_crudas_detectadas: [
          '0108*****40*****7396',
          '02/11/2026',
          '000019111',
          '576.599,07'
        ]
      }
    });
  });

  it('Reglas Anti-Alucinación: conserva asteriscos en cuenta enmascarada, mapea códigos bancarios y devuelve null en datos faltantes', () => {
    expect(extractNumeroCuentaVenezolana('0108*****40*****7396')).toBe('0108*****40*****7396');
    expect(extractNumeroCuentaVenezolana('01340031880311234567')).toBe('01340031880311234567');
    expect(extractMontoTextoExacto('Bs. 576.599,07')).toBe('576.599,07');

    expect(resolveVenezuelanBankDetails('0108', 'Provinet', '0108*****40*****7396')).toMatchObject({
      banco_identificado: 'BBVA Provincial',
      codigo_banco: '0108',
      plataforma_canal: 'Provinet'
    });
    expect(resolveVenezuelanBankDetails('0134', 'BanescOnline')).toMatchObject({
      banco_identificado: 'Banesco',
      codigo_banco: '0134',
      plataforma_canal: 'BanescOnline'
    });
    expect(resolveVenezuelanBankDetails('0105', 'Mercantil en Línea')).toMatchObject({
      banco_identificado: 'Banco Mercantil',
      codigo_banco: '0105',
      plataforma_canal: 'Mercantil en Línea'
    });
    expect(resolveVenezuelanBankDetails('0102', 'BDVenlínea')).toMatchObject({
      banco_identificado: 'Banco de Venezuela',
      codigo_banco: '0102',
      plataforma_canal: 'BDVenlínea'
    });
    expect(resolveVenezuelanBankDetails('0172')).toMatchObject({
      banco_identificado: 'Bancamiga',
      codigo_banco: '0172'
    });
    expect(resolveVenezuelanBankDetails('0191')).toMatchObject({
      banco_identificado: 'BNC (Banco Nacional de Crédito)',
      codigo_banco: '0191'
    });
    expect(resolveVenezuelanBankDetails('0114')).toMatchObject({
      banco_identificado: 'Bancaribe',
      codigo_banco: '0114'
    });
    expect(resolveVenezuelanBankDetails('0115')).toMatchObject({
      banco_identificado: 'Banco Exterior',
      codigo_banco: '0115'
    });

    const emptyCanonical = toCanonicalVenezuelanReceiptJson({});
    expect(emptyCanonical.lectura_exitosa).toBe(false);
    expect(emptyCanonical.nivel_confianza).toBe('BAJO');
    expect(emptyCanonical.requiere_revision_manual).toBe(true);
    expect(emptyCanonical.datos_extraidos).toEqual({
      fecha_operacion: null,
      fecha_original: null,
      numero_referencia: null,
      monto_numerico: null,
      monto_texto: null,
      moneda: null,
      banco_identificado: null,
      codigo_banco: null,
      plataforma_canal: null,
      numero_cuenta: null
    });
  });

  it('Parser Numérico Venezolano (parseMontoVenezolano): convierte "576.599,07" a 576599.07 y nunca devuelve NaN o 576.599', () => {
    expect(parseMontoVenezolano('576.599,07')).toBe(576599.07);
    expect(parseMontoVenezolano('Bs. 576.599,07')).toBe(576599.07);
    expect(parseMontoVenezolano('1.234.567,89')).toBe(1234567.89);
    expect(parseMontoVenezolano(576599.07)).toBe(576599.07);
    expect(parseMontoVenezolano(null)).toBe(0);
    expect(parseMontoVenezolano('')).toBe(0);
    expect(parseMontoVenezolano('texto_invalido')).toBe(0);
    expect(Number.isNaN(parseMontoVenezolano('576.599,07'))).toBe(false);
  });

  it('Detección dinámica de mimeType (detectReceiptMimeType): identifica image/jpeg, image/png, image/webp y application/pdf sin fijar image/png', () => {
    expect(detectReceiptMimeType(null, 'image/jpeg', 'foto.jpg')).toBe('image/jpeg');
    expect(detectReceiptMimeType(null, '', 'comprobante.jpeg')).toBe('image/jpeg');
    expect(detectReceiptMimeType(null, '', 'captura.png')).toBe('image/png');
    expect(detectReceiptMimeType(null, 'image/webp', 'whatsapp.webp')).toBe('image/webp');
    expect(detectReceiptMimeType(null, '', 'soporte.webp')).toBe('image/webp');
    expect(detectReceiptMimeType(null, '', 'recibo.pdf')).toBe('application/pdf');
    expect(detectReceiptMimeType('data:image/webp;base64,UklGRg==')).toBe('image/webp');
  });

  it('Esquema estricto VENEZUELAN_RECEIPT_RESPONSE_SCHEMA, System Prompt determinista y lectura sin etiquetas ni bloqueo por recortes', () => {
    expect(VENEZUELAN_RECEIPT_RESPONSE_SCHEMA.type).toBe('OBJECT');
    expect(VENEZUELAN_RECEIPT_RESPONSE_SCHEMA.required).toEqual([
      'es_legible',
      'fecha_pago',
      'referencia',
      'monto_bs',
      'banco',
      'canal'
    ]);
    expect(VENEZUELAN_BANKING_AUDIT_SYSTEM_PROMPT).toContain('23/10/2026');
    expect(VENEZUELAN_BANKING_AUDIT_SYSTEM_PROMPT).toContain('000012723');
    expect(VENEZUELAN_BANKING_AUDIT_SYSTEM_PROMPT).toContain('48.742,49');
    expect(VENEZUELAN_BANKING_AUDIT_SYSTEM_PROMPT).toContain('Provinet');

    const auditedFlatOutput = auditAndNormalizeReceiptPayload({
      es_legible: true,
      fecha_pago: '2026-10-23',
      referencia: '000012723',
      monto_bs: 48742.49,
      banco: 'BBVA Provincial',
      canal: 'Provinet',
      numero_cuenta: '0108*****40*****7396'
    });

    expect(auditedFlatOutput.es_legible).toBe(true);
    expect(auditedFlatOutput.legible).toBe(true);
    expect(auditedFlatOutput.lectura_exitosa).toBe(true);
    expect(auditedFlatOutput.banco).toBe('BBVA Provincial');
    expect(auditedFlatOutput.canal).toBe('Provinet');
    expect(auditedFlatOutput.monto_bs).toBe(48742.49);
    expect(auditedFlatOutput.referencia).toBe('000012723');
    expect(auditedFlatOutput.fecha_iso).toBe('2026-10-23');
    expect(auditedFlatOutput.datos_extraidos?.numero_cuenta).toBe('0108*****40*****7396');

    // Lectura parcial con un campo nulo (ej. sin fecha en recorte) no bloquea es_legible
    const partialCropOutput = auditAndNormalizeReceiptPayload({
      es_legible: false,
      fecha_pago: null,
      referencia: '000012723',
      monto_bs: '48.742,49',
      banco: null,
      canal: 'Provinet'
    });
    expect(partialCropOutput.es_legible).toBe(true);
    expect(partialCropOutput.legible).toBe(true);
    expect(partialCropOutput.banco).toBe('BBVA Provincial');
    expect(partialCropOutput.canal).toBe('Provinet');
    expect(partialCropOutput.referencia).toBe('000012723');
    expect(partialCropOutput.monto_bs).toBe(48742.49);
    expect(partialCropOutput.fecha_iso).toBeNull();
  });
});
