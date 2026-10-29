/**
 * Clasificación de artículos en los 5 rubros clave del mes.
 *
 * Replica EXACTAMENTE la regla unificada entre el motor de sincronización
 * de Google Sheets (hoja "Volumen por SKU") y el historial de ventas,
 * garantizando 100% de paridad entre servidor y cliente.
 */

export type RubroCodigo =
  | 'ACEITE'
  | 'AZUCAR'
  | 'POLLO'
  | 'ESTANDAR_ASTURIAS'
  | 'MORTADELA_SALPICAO'
  | 'OTROS';

export const RUBROS_CLAVE: { codigo: Exclude<RubroCodigo, 'OTROS'>; label: string }[] = [
  { codigo: 'ACEITE', label: 'Aceite' },
  { codigo: 'AZUCAR', label: 'Azúcar' },
  { codigo: 'POLLO', label: 'Pollo' },
  { codigo: 'ESTANDAR_ASTURIAS', label: 'Estándar y Superior Asturias' },
  { codigo: 'MORTADELA_SALPICAO', label: 'Mortadela Salpicao y Asturias' }
];

export const RUBROS_ACTIVACION: Exclude<RubroCodigo, 'OTROS'>[] = [
  'ACEITE',
  'AZUCAR',
  'POLLO',
  'ESTANDAR_ASTURIAS',
  'MORTADELA_SALPICAO'
];

export const MESES_CORTO: Record<number, string> = {
  1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic'
};

export const MESES_LARGO: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
};

export const RUBRO_LABEL: Record<RubroCodigo, string> = {
  ACEITE: 'Aceite',
  AZUCAR: 'Azúcar',
  POLLO: 'Pollo',
  ESTANDAR_ASTURIAS: 'Estándar y Superior Asturias',
  MORTADELA_SALPICAO: 'Mortadela Salpicao y Asturias',
  OTROS: 'Otros'
};

export const RUBRO_SERVER_CATEGORY: Record<RubroCodigo, string> = {
  ACEITE: 'ACEITE',
  AZUCAR: 'AZÚCAR',
  POLLO: 'POLLO',
  ESTANDAR_ASTURIAS: 'ESTANDAR Y SUPERIOR ASTURIAS',
  MORTADELA_SALPICAO: 'MORTADELA SALPICAO Y ASTURIAS',
  OTROS: 'OTROS'
};

const SKUS_MORTADELA = new Set([
  '1464', '1462', '1512', '1521', '1561', '1522', '1563', '1562', '1564', '1519', '1496', '1511', '1599'
]);
const SKUS_POLLO = new Set([
  '630', '629', '870', '393', 'POLLO', 'FILET', 'MUSLO', 'ALAS'
]);

export function clasificarRubro(sku: string, nombre: string): RubroCodigo {
  const s = String(sku || '').trim();
  const sU = s.toUpperCase();
  const n = String(nombre || '').toUpperCase();

  if (s === '1461' || s === '1463' || n.includes('ESTANDAR ASTURIAS') || n.includes('SUPERIOR ASTURIAS')) {
    return 'ESTANDAR_ASTURIAS';
  }
  if (n.includes('MORTADELA') || n.includes('MORT.') || n.includes('SALPICAO') || SKUS_MORTADELA.has(s)) {
    return 'MORTADELA_SALPICAO';
  }
  if (sU === 'ACEITE' || n.includes('ACEITE')) return 'ACEITE';
  if (sU === 'AZUCAR' || sU === 'AZÚCAR' || n.includes('AZUCAR') || n.includes('AZÚCAR')) return 'AZUCAR';
  if (
    SKUS_POLLO.has(s) ||
    SKUS_POLLO.has(sU) ||
    n.includes('POLLO ENTERO') ||
    n.includes('POLLO TODAS') ||
    n.includes('FILET') ||
    n.includes('MUSLO') ||
    n.includes('ALAS DESPRESADAS') ||
    n.includes('HIGADO') ||
    n.includes('MOLLEJA')
  ) {
    return 'POLLO';
  }
  return 'OTROS';
}

export function clasificarRubroServerLabel(sku: string, nombre: string): string {
  return RUBRO_SERVER_CATEGORY[clasificarRubro(sku, nombre)];
}
