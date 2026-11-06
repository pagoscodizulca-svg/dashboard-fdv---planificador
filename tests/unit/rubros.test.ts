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
  it('los 5 rubros activos tienen EXACTAMENTE la nomenclatura comercial y el orden pedidos', () => {
    expect(RUBROS_CLAVE.map((r) => r.label)).toEqual([
      'Azúcar',
      'Leche en polvo Vencampo',
      'Jamón estándar y superior Asturias',
      'Mortadela Asturias',
      'Salpicao'
    ]);
    expect(RUBROS_ACTIVACION).toEqual(['AZUCAR', 'LECHE_VENCAMPO', 'ESTANDAR_ASTURIAS', 'MORTADELA_ASTURIAS', 'SALPICAO']);
    expect(RUBROS_CLAVE).toHaveLength(5);
  });

  it('Aceite, Pollo y la categoría combinada quedan como legacy inactivos (se conservan para historial)', () => {
    const legacy = RUBROS_CONFIG.filter((r) => !r.activo).map((r) => r.codigo);
    expect(legacy).toEqual(['ACEITE', 'POLLO', 'MORTADELA_SALPICAO']);
    expect(esRubroActivo('ACEITE')).toBe(false);
    expect(esRubroActivo('SALPICAO')).toBe(true);
    expect(RUBROS_ACTIVACION).not.toContain('ACEITE' as any);
    expect(RUBROS_ACTIVACION).not.toContain('POLLO' as any);
  });

  it('RUBRO_LABEL y RUBRO_SERVER_CATEGORY cubren todos los códigos (incluidos legacy y OTROS)', () => {
    const all: RubroCodigo[] = [
      'AZUCAR', 'LECHE_VENCAMPO', 'ESTANDAR_ASTURIAS', 'MORTADELA_ASTURIAS', 'SALPICAO',
      'ACEITE', 'POLLO', 'MORTADELA_SALPICAO', 'OTROS'
    ];
    all.forEach((c) => {
      expect(RUBRO_LABEL[c]).toBeTruthy();
      expect(RUBRO_SERVER_CATEGORY[c]).toBeTruthy();
    });
    // Las claves internas de servidor son únicas (no se pisan entre rubros)
    expect(new Set(all.map((c) => RUBRO_SERVER_CATEGORY[c])).size).toBe(all.length);
  });

  it('categoryToRubroCode (y categoriaARubroCodigo) normaliza nombres nuevos, claves de servidor y valores legacy', () => {
    expect(categoryToRubroCode('Azúcar')).toBe('AZUCAR');
    expect(categoryToRubroCode('AZÚCAR')).toBe('AZUCAR');
    expect(categoryToRubroCode('Leche en polvo Vencampo')).toBe('LECHE_VENCAMPO');
    expect(categoryToRubroCode('LECHE VENCAMPO')).toBe('LECHE_VENCAMPO');
    expect(categoryToRubroCode('Jamón estándar y superior Asturias')).toBe('ESTANDAR_ASTURIAS');
    expect(categoryToRubroCode('ESTANDAR Y SUPERIOR ASTURIAS')).toBe('ESTANDAR_ASTURIAS');
    expect(categoryToRubroCode('Mortadela Asturias')).toBe('MORTADELA_ASTURIAS');
    expect(categoryToRubroCode('Salpicao')).toBe('SALPICAO');
    // Legacy combinado: NO se puede asignar a uno de los dos nuevos sin el artículo
    expect(categoryToRubroCode('MORTADELA SALPICAO Y ASTURIAS')).toBe('MORTADELA_SALPICAO');
    expect(categoryToRubroCode('ACEITE')).toBe('ACEITE');
    expect(categoryToRubroCode('POLLO')).toBe('POLLO');
    expect(categoriaARubroCodigo('algo desconocido')).toBe('OTROS');
    // Cada clave de servidor activa vuelve a su propio código (ida y vuelta)
    RUBROS_CONFIG.forEach((r) => expect(categoriaARubroCodigo(r.categoriaServidor)).toBe(r.codigo));
    RUBROS_CONFIG.forEach((r) => expect(categoriaARubroCodigo(r.label)).toBe(r.codigo));
  });
});

describe('Unit: clasificarRubro', () => {
  it('Jamón estándar y superior Asturias: SKUs 1461/1463 y nombres', () => {
    expect(clasificarRubro('1461', 'PRODUCTO CUALQUIERA')).toBe('ESTANDAR_ASTURIAS');
    expect(clasificarRubro('1463', 'OTRO PRODUCTO')).toBe('ESTANDAR_ASTURIAS');
    expect(clasificarRubro('9999', 'MORTADELA ESTANDAR ASTURIAS X KG')).toBe('ESTANDAR_ASTURIAS');
    expect(clasificarRubro('9999', 'JAMON SUPERIOR ASTURIAS')).toBe('ESTANDAR_ASTURIAS');
    expect(clasificarRubro('1461', 'MORTADELA ESTANDAR ASTURIAS X KG')).toBe('ESTANDAR_ASTURIAS'); // prioridad sobre mortadela
  });

  it('Mortadela Asturias: SKUs conocidos y nombres con ASTURIAS', () => {
    ['1464', '1462', '1512', '1521', '1561', '1522', '1564', '1496', '1511'].forEach((sku) => {
      expect(clasificarRubro(sku, 'GENERIC ITEM')).toBe('MORTADELA_ASTURIAS');
    });
    expect(clasificarRubro('0', 'MORT. TIPO AREPERO ASTURIAS X KG')).toBe('MORTADELA_ASTURIAS');
    expect(clasificarRubro('1496', '   ')).toBe('MORTADELA_ASTURIAS');
  });

  it('Salpicao: SKUs conocidos y cualquier nombre con SALPICAO (separado de Mortadela Asturias)', () => {
    ['1563', '1562', '1519', '1599'].forEach((sku) => {
      expect(clasificarRubro(sku, 'GENERIC ITEM')).toBe('SALPICAO');
    });
    expect(clasificarRubro('0', 'SALPICAO X KG')).toBe('SALPICAO');
    expect(clasificarRubro('0', 'MORT. ESTANDAR SALPICAO X KG')).toBe('SALPICAO');
  });

  it('mortadelas sin marca Asturias/Salpicao (Corral, Caracas) NO pertenecen a ningún rubro del mes', () => {
    expect(clasificarRubro('21', 'MORTADELA ESP D/POLLO CORRAL 1X12UNI')).toBe('OTROS');
    expect(clasificarRubro('927', 'MORTADELA ESP. CARACAS 10X900GRS')).toBe('OTROS');
    expect(clasificarRubro('0', 'MORTADELA ESPECIAL 900GR')).toBe('OTROS');
  });

  it('Leche en polvo Vencampo: por SKU y por nombre (requiere LECHE + VENCAMPO)', () => {
    ['1536', '1555', '1556', '1574', '1579'].forEach((sku) => expect(clasificarRubro(sku, '')).toBe('LECHE_VENCAMPO'));
    expect(clasificarRubro('0', 'LECHE EN POLVO VENCAMPO 10X400GR')).toBe('LECHE_VENCAMPO');
    expect(clasificarRubro('0', 'LECHE EN POLVO COMPLETA VENCAMPO 900GR')).toBe('LECHE_VENCAMPO');
    // Otras "leches" y otros productos Vencampo NO son el rubro
    expect(clasificarRubro('7591210000513', 'CREMA DE LECHE PURISIMA 500GR')).toBe('OTROS');
    expect(clasificarRubro('1642', 'ARVEJAS VENCAMPO 25 UND X 400GR')).toBe('OTROS');
    expect(clasificarRubro('1644', 'CARAOTAS NEGRAS VENCAMPO 25 UND X 400GR')).toBe('OTROS');
  });

  it('Azúcar con y sin acento (el azúcar Vencampo sigue siendo Azúcar)', () => {
    expect(clasificarRubro('200', 'AZUCAR BLANCA 1KG')).toBe('AZUCAR');
    expect(clasificarRubro('201', 'AZÚCAR REFINADA 1KG')).toBe('AZUCAR');
    expect(clasificarRubro('1543', 'AZUCAR VENCAMPO 1 KG X 20 UND')).toBe('AZUCAR');
  });

  it('códigos legacy se siguen clasificando (para historial): Aceite y Pollo', () => {
    expect(clasificarRubro('100', 'ACEITE VEGETAL 1L')).toBe('ACEITE');
    expect(clasificarRubro('630', 'POLLO')).toBe('POLLO');
    expect(clasificarRubro('999', 'FILET DE PECHUGA')).toBe('POLLO');
    expect(clasificarRubro('1568', 'POLLO VENCAMPO POR KG')).toBe('OTROS');
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
    expect(clasificarRubroServerLabel('1519', '')).toBe('SALPICAO');
    expect(clasificarRubroServerLabel('1464', '')).toBe('MORTADELA ASTURIAS');
  });
});
