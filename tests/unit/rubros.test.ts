import { describe, it, expect } from 'vitest';
import {
  clasificarRubro,
  clasificarRubroServerLabel,
  categoriaARubroCodigo,
  esRubroActivo,
  RUBROS_CONFIG,
  RUBROS_CLAVE,
  RUBROS_ACTIVACION,
  RUBRO_LABEL,
  RUBRO_SERVER_CATEGORY,
  RubroCodigo
} from '../../src/lib/rubros';
import { categoryToRubroCode } from '../../src/services/historialService';

describe('Rubros de activación · configuración central (Noviembre 2026)', () => {
  it('los 5 rubros activos tienen EXACTAMENTE los encabezados solicitados y el orden del Grid (Cols C-L)', () => {
    expect(RUBROS_CLAVE.map((r) => r.label)).toEqual([
      'AZUCAR',
      'LECHE VENCAMPO',
      'POLLO',
      'ESTANDAR Y SUPERIOR ASTURIAS',
      'MORTADELA SALPICAO Y ASTURIAS'
    ]);
    expect(RUBROS_ACTIVACION).toEqual([
      'AZUCAR',
      'LECHE_VENCAMPO',
      'POLLO',
      'ESTANDAR_ASTURIAS',
      'MORTADELA_SALPICAO'
    ]);
    expect(RUBROS_CLAVE).toHaveLength(5);
  });

  it('Aceite queda como legacy inactivo (se conserva para historial)', () => {
    expect(esRubroActivo('ACEITE')).toBe(false);
    expect(esRubroActivo('AZUCAR')).toBe(true);
    expect(esRubroActivo('LECHE_VENCAMPO')).toBe(true);
    expect(esRubroActivo('POLLO')).toBe(true);
    expect(esRubroActivo('ESTANDAR_ASTURIAS')).toBe(true);
    expect(esRubroActivo('MORTADELA_SALPICAO')).toBe(true);
    expect(RUBROS_ACTIVACION).not.toContain('ACEITE' as any);
  });

  it('RUBRO_LABEL y RUBRO_SERVER_CATEGORY cubren todos los códigos (incluidos legacy y OTROS)', () => {
    const all: RubroCodigo[] = [
      'AZUCAR', 'LECHE_VENCAMPO', 'POLLO', 'ESTANDAR_ASTURIAS', 'MORTADELA_SALPICAO',
      'ACEITE', 'MORTADELA_ASTURIAS', 'SALPICAO', 'OTROS'
    ];
    all.forEach((c) => {
      expect(RUBRO_LABEL[c]).toBeTruthy();
      expect(RUBRO_SERVER_CATEGORY[c]).toBeTruthy();
    });
  });

  it('categoryToRubroCode (y categoriaARubroCodigo) normaliza nombres nuevos, claves de servidor y valores legacy', () => {
    expect(categoryToRubroCode('AZUCAR')).toBe('AZUCAR');
    expect(categoryToRubroCode('AZÚCAR')).toBe('AZUCAR');
    expect(categoryToRubroCode('LECHE VENCAMPO')).toBe('LECHE_VENCAMPO');
    expect(categoryToRubroCode('POLLO')).toBe('POLLO');
    expect(categoryToRubroCode('ESTANDAR Y SUPERIOR ASTURIAS')).toBe('ESTANDAR_ASTURIAS');
    expect(categoryToRubroCode('MORTADELA SALPICAO Y ASTURIAS')).toBe('MORTADELA_SALPICAO');
    expect(categoryToRubroCode('ACEITE')).toBe('ACEITE');
    expect(categoriaARubroCodigo('algo desconocido')).toBe('OTROS');
    RUBROS_CLAVE.forEach((r) => expect(categoriaARubroCodigo(r.label)).toBe(r.codigo));
  });
});

describe('Unit: clasificarRubro', () => {
  it('ESTANDAR Y SUPERIOR ASTURIAS: SKUs 1461/1463 y nombres', () => {
    expect(clasificarRubro('1461', 'PRODUCTO CUALQUIERA')).toBe('ESTANDAR_ASTURIAS');
    expect(clasificarRubro('1463', 'OTRO PRODUCTO')).toBe('ESTANDAR_ASTURIAS');
    expect(clasificarRubro('9999', 'MORTADELA ESTANDAR ASTURIAS X KG')).toBe('ESTANDAR_ASTURIAS');
    expect(clasificarRubro('9999', 'JAMON SUPERIOR ASTURIAS')).toBe('ESTANDAR_ASTURIAS');
    expect(clasificarRubro('1461', 'MORTADELA ESTANDAR ASTURIAS X KG')).toBe('ESTANDAR_ASTURIAS');
  });

  it('MORTADELA SALPICAO Y ASTURIAS: SKUs de Mortadela Asturias y Salpicao', () => {
    ['1464', '1462', '1512', '1521', '1561', '1522', '1564', '1496', '1511', '1563', '1562', '1519', '1599'].forEach((sku) => {
      expect(clasificarRubro(sku, 'GENERIC ITEM')).toBe('MORTADELA_SALPICAO');
    });
    expect(clasificarRubro('0', 'MORT. TIPO AREPERO ASTURIAS X KG')).toBe('MORTADELA_SALPICAO');
    expect(clasificarRubro('0', 'SALPICAO X KG')).toBe('MORTADELA_SALPICAO');
  });

  it('mortadelas sin marca Asturias/Salpicao (Corral, Caracas) NO pertenecen a ningún rubro del mes', () => {
    expect(clasificarRubro('21', 'MORTADELA ESP D/POLLO CORRAL 1X12UNI')).toBe('OTROS');
    expect(clasificarRubro('927', 'MORTADELA ESP. CARACAS 10X900GRS')).toBe('OTROS');
    expect(clasificarRubro('0', 'MORTADELA ESPECIAL 900GR')).toBe('OTROS');
  });

  it('LECHE VENCAMPO: por SKU y por nombre (requiere LECHE + VENCAMPO)', () => {
    ['1536', '1555', '1556', '1574', '1579'].forEach((sku) => expect(clasificarRubro(sku, '')).toBe('LECHE_VENCAMPO'));
    expect(clasificarRubro('0', 'LECHE EN POLVO VENCAMPO 10X400GR')).toBe('LECHE_VENCAMPO');
    expect(clasificarRubro('7591210000513', 'CREMA DE LECHE PURISIMA 500GR')).toBe('OTROS');
    expect(clasificarRubro('1642', 'ARVEJAS VENCAMPO 25 UND X 400GR')).toBe('OTROS');
  });

  it('AZUCAR con y sin acento', () => {
    expect(clasificarRubro('200', 'AZUCAR BLANCA 1KG')).toBe('AZUCAR');
    expect(clasificarRubro('201', 'AZÚCAR REFINADA 1KG')).toBe('AZUCAR');
    expect(clasificarRubro('1543', 'AZUCAR VENCAMPO 1 KG X 20 UND')).toBe('AZUCAR');
  });

  it('POLLO y ACEITE (legacy)', () => {
    expect(clasificarRubro('100', 'ACEITE VEGETAL 1L')).toBe('ACEITE');
    expect(clasificarRubro('630', 'POLLO')).toBe('POLLO');
    expect(clasificarRubro('999', 'FILET DE PECHUGA')).toBe('POLLO');
    expect(clasificarRubro('1568', 'POLLO VENCAMPO POR KG')).toBe('POLLO');
  });

  it('OTROS y entradas vacías/nulas', () => {
    expect(clasificarRubro('555', 'QUESO AMARILLO')).toBe('OTROS');
    expect(clasificarRubro('', '')).toBe('OTROS');
    expect(clasificarRubro(null as any, null as any)).toBe('OTROS');
    expect(clasificarRubro(undefined as any, undefined as any)).toBe('OTROS');
    expect(clasificarRubro('  1461  ', 'estandar asturias')).toBe('ESTANDAR_ASTURIAS');
  });

  it('clasificarRubroServerLabel devuelve la clave de servidor del rubro', () => {
    expect(clasificarRubroServerLabel('1574', 'LECHE EN POLVO VENCAMPO 10X400GR')).toBe('LECHE VENCAMPO');
    expect(clasificarRubroServerLabel('1519', '')).toBe('MORTADELA SALPICAO Y ASTURIAS');
    expect(clasificarRubroServerLabel('1464', '')).toBe('MORTADELA SALPICAO Y ASTURIAS');
  });
});
