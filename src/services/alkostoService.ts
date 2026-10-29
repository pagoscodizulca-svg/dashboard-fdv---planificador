import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query,
  updateDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AlkostoOrder, EstadoPedidoAlkosto, AlkostoOrderItem, ParsedOrdenCompraAlkosto } from '../types';
import { getAuthHeaders } from './authService';

export const ALKOSTO_COLLECTION = 'alkosto_orders';
const STORAGE_KEY = 'dashboard_fdv_alkosto_orders_cache';

export interface AlkostoSucursal {
  codigo: string;
  tag?: string;
  nombre: string;
  zona: string;
  direccion: string;
  contacto?: string;
  telefono?: string;
}

export const SUCURSALES_ALKOSTO: AlkostoSucursal[] = [
  { codigo: '7498', tag: 'AK01', nombre: 'Alkosto 1 san Felipe', zona: 'san Felipe', direccion: 'Dirección de despacho; calle 98 CC san Felipe 1 nivel PB sector casco central.' },
  { codigo: '7499', tag: 'AK02', nombre: 'Alkosto 2 - Plaza baral', zona: 'Plaza baral', direccion: 'Plaza baral' },
  { codigo: '7497', tag: 'AK03', nombre: 'Alkosto 3 - Delicias', zona: 'Delicias', direccion: 'Delicias' },
  { codigo: '7500', tag: 'AK04', nombre: 'Alkosto 4 - Coromoto', zona: 'Coromoto', direccion: 'Coromoto' },
  { codigo: '7502', tag: 'AK05', nombre: 'Alkosto 5 - Cabimas', zona: 'Cabimas', direccion: 'Cabimas' },
  { codigo: '7503', tag: 'AK06', nombre: 'Alkosto 6 - Los cactu', zona: 'Los cactu', direccion: 'Los cactu' },
  { codigo: '7680', tag: 'AK07', nombre: 'Alkosto 7 - Bella vista', zona: 'Bella vista', direccion: 'Bella vista' },
  { codigo: '7905', tag: 'AK08', nombre: 'Alkosto 8 - Trujillo', zona: 'Trujillo', direccion: 'Trujillo' },
  { codigo: '8160', tag: 'AK09', nombre: 'Alkosto 9 - Antiguo nasa Zona industrial', zona: 'Antiguo nasa Zona industrial', direccion: 'Antiguo nasa Zona industrial' },
  { codigo: '8306', tag: 'AK10', nombre: 'Alkosto 10 - La limpia', zona: 'La limpia', direccion: 'La limpia' }
];

export const SUCURSALES_FAMILIA_CENTER: AlkostoSucursal[] = [
  { codigo: '7490', tag: 'FC01', nombre: 'Familia Center 1 - Plaza lago', zona: 'Plaza lago', direccion: 'Plaza lago' },
  { codigo: '7492', tag: 'FC02', nombre: 'Familia Center 2', zona: 'URB monte claro', direccion: 'Calle43entre Av 150 416N°15-041 URB monte claro' },
  { codigo: '7494', tag: 'FC03', nombre: 'Familia Center 3', zona: 'Parroquia Coquivacoa', direccion: 'CalleJ con Av 12 distinguido bajo el NJ-10 de nomenclatura municipal en jurisdicción parroquia coquivacoa el municipio autónomo Maracaibo estado Zulia.' },
  { codigo: '7491', tag: 'FC04', nombre: 'Familia 4 - Dr quintero', zona: 'Dr quintero', direccion: 'Dr quintero' },
  { codigo: '7489', tag: 'FC05', nombre: 'Familia Center 5 - La lago', zona: 'La lago', direccion: 'La lago' },
  { codigo: '7493', tag: 'FC06', nombre: 'Familia 6 - Los olivos', zona: 'Los olivos', direccion: 'Los olivos' },
  { codigo: '8229', tag: 'FC07', nombre: 'Familia Center #7 - San Francisco', zona: 'San Francisco', direccion: 'San Francisco' }
];

export const CADENAS_ABREVIATURAS = {
  ALKOSTO: ['AK01', 'AK02', 'AK03', 'AK04', 'AK05', 'AK06', 'AK07', 'AK08', 'AK09', 'AK10'],
  FAMILIA_CENTER: ['FC01', 'FC02', 'FC03', 'FC04', 'FC05', 'FC06', 'FC07']
};

export const TODAS_SUCURSALES_CUENTAS_CLAVE: AlkostoSucursal[] = [
  ...SUCURSALES_ALKOSTO,
  ...SUCURSALES_FAMILIA_CENTER
];

export function getSucursalByTag(tag: string): AlkostoSucursal | undefined {
  const norm = (tag || '').trim().toUpperCase();
  if (!norm) return undefined;
  const cleanDigits = norm.replace(/^0+/, '');
  return TODAS_SUCURSALES_CUENTAS_CLAVE.find(
    s => s.tag === norm || s.codigo === norm || (cleanDigits && s.codigo.replace(/^0+/, '') === cleanDigits)
  );
}

export function detectCadenaFromTagOrName(value: string): 'ALKOSTO' | 'FAMILIA_CENTER' {
  const norm = (value || '').trim().toUpperCase();
  if (norm.includes('FC') || norm.includes('FAMILIA')) return 'FAMILIA_CENTER';
  return 'ALKOSTO';
}

export async function syncCadenasConfigToFirestore(): Promise<void> {
  try {
    const configDoc = {
      alkosto: SUCURSALES_ALKOSTO,
      familiaCenter: SUCURSALES_FAMILIA_CENTER,
      abreviaturasAlkosto: CADENAS_ABREVIATURAS.ALKOSTO,
      abreviaturasFamiliaCenter: CADENAS_ABREVIATURAS.FAMILIA_CENTER,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'cadenas_config', 'abreviaturas'), configDoc, { merge: true });
    localStorage.setItem('dashboard_fdv_cadenas_config', JSON.stringify(configDoc));
  } catch (err) {
    console.warn("Error sincronizando abreviaturas de cadenas en Firestore:", err);
  }
}

export interface CatalogoAlkostoItem {
  sku: string;
  producto: string;
  categoria: string;
  presentacion: string;
  kilosPorCaja: number;
  precioSugeridoUSD: number;
  codigoBarra?: string;
  codigosCadena?: string[];
  sinonimos?: string[];
  unidadSugerida?: 'CJ' | 'KG' | 'UND' | 'BLT';
}

export const CATALOGO_ALKOSTO: CatalogoAlkostoItem[] = [
  // --- MORTADELAS Y EMBUTIDOS ASTURIAS / SALPICAO / CORRAL ---
  {
    sku: '1496',
    producto: 'MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR',
    categoria: 'MORTADELAS',
    presentacion: 'Caja (10 und x 900g)',
    kilosPorCaja: 9.0,
    precioSugeridoUSD: 20.00,
    codigoBarra: '7590377000077',
    codigosCadena: ['1496', '7590377000077'],
    sinonimos: ['MORTADELA ESPECIAL DE POLLO 900GR ASTURIAS', 'MORTADELA 900GR ASTURIAS', 'MORTADELA ASTURIAS 10X900', '1496'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '1497',
    producto: 'MORTADELA ESP D/POLLO ASTURIAS 20UNDX500GR',
    categoria: 'MORTADELAS',
    presentacion: 'Caja (20 und x 500g)',
    kilosPorCaja: 10.0,
    precioSugeridoUSD: 22.00,
    codigoBarra: '7590377000589',
    codigosCadena: ['1497', '7590377000589'],
    sinonimos: ['MORTADELA ESPECIAL DE POLLO ASTURIA 500GR', 'MORTADELA ESPECIAL DE POLLO ASTURIAS 500GR', 'MORTADELA 500GR ASTURIAS', '1497', '7590377000589'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '1519',
    producto: 'MORTADELA ESP D/POLLO SALPICAO 10UNDX900GR',
    categoria: 'MORTADELAS',
    presentacion: 'Caja (10 und x 900g)',
    kilosPorCaja: 9.0,
    precioSugeridoUSD: 23.00,
    codigosCadena: ['1462', '1519'],
    sinonimos: ['MORTADELA ESPECIAL DE POLLO SALPICAO 10UNDX900GR', 'SALPICAO 10X900', '1519', '1462'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '21',
    producto: 'MORTADELA ESP D/POLLO CORRAL 1X12UNI',
    categoria: 'MORTADELAS',
    presentacion: 'Caja (12 und x 1kg)',
    kilosPorCaja: 12.0,
    precioSugeridoUSD: 36.00,
    codigoBarra: '7591289609129',
    codigosCadena: ['21', '7591289609129'],
    sinonimos: ['MORTADELA DE POLLO DEL CORRAL 1KG', 'MORTADELA CORRAL 1X12', 'MORTADELA CORRAL 12UNI', '21', '7591289609129'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '1464',
    producto: 'MORT. NAVIDEÑA ASTURIAS XKG',
    categoria: 'MORTADELAS',
    presentacion: 'Pieza por Kg (Caja ~12 kg)',
    kilosPorCaja: 12.0,
    precioSugeridoUSD: 36.00,
    codigosCadena: ['1464'],
    sinonimos: ['MORTADELA NAVIDEÑA ASTURIAS', 'NAVIDEÑA ASTURIAS', '1464'],
    unidadSugerida: 'KG'
  },
  {
    sku: '1461',
    producto: 'MORT. ESTANDAR ASTURIAS X KG',
    categoria: 'MORTADELAS',
    presentacion: 'Pieza por Kg (Caja ~10 kg)',
    kilosPorCaja: 10.0,
    precioSugeridoUSD: 25.00,
    codigosCadena: ['1461'],
    sinonimos: ['MORTADELA ESTANDAR ASTURIAS', 'ESTANDAR ASTURIAS', '1461'],
    unidadSugerida: 'KG'
  },
  {
    sku: '1462',
    producto: 'MORT. ESPECIAL COCIDA ASTURIAS X KG',
    categoria: 'MORTADELAS',
    presentacion: 'Pieza por Kg (Caja ~10 kg)',
    kilosPorCaja: 10.0,
    precioSugeridoUSD: 26.00,
    codigosCadena: ['1462'],
    sinonimos: ['MORTADELA ESPECIAL COCIDA ASTURIAS', '1462'],
    unidadSugerida: 'KG'
  },
  {
    sku: '1463',
    producto: 'MORT. SUPERIOR ASTURIAS X KG',
    categoria: 'MORTADELAS',
    presentacion: 'Pieza por Kg (Caja ~12 kg)',
    kilosPorCaja: 12.0,
    precioSugeridoUSD: 28.00,
    codigosCadena: ['1463', '100929'],
    sinonimos: ['MORTADELA SUPERIOR ASTURIAS', '1463'],
    unidadSugerida: 'KG'
  },
  {
    sku: '1512',
    producto: 'MORT. PECHUGA DE PAVO ASTURIAS X KG',
    categoria: 'MORTADELAS',
    presentacion: 'Pieza por Kg (Caja ~10 kg)',
    kilosPorCaja: 10.0,
    precioSugeridoUSD: 55.00,
    codigosCadena: ['100881', '1512'],
    sinonimos: ['PECHUGA DE PAVO ASTURIAS X KG', 'PECHUGA PAVO ASTURIAS', '100881', '1512'],
    unidadSugerida: 'KG'
  },
  {
    sku: '1511',
    producto: 'MORT. PECHUGA DE POLLO ASTURIAS X KG',
    categoria: 'MORTADELAS',
    presentacion: 'Pieza por Kg (Caja ~10 kg)',
    kilosPorCaja: 10.0,
    precioSugeridoUSD: 53.50,
    codigosCadena: ['100882', '1511'],
    sinonimos: ['PECHUGA DE POLLO ASTURIAS X KG', 'PECHUGA POLLO ASTURIAS', '100882', '1511'],
    unidadSugerida: 'KG'
  },
  {
    sku: '1561',
    producto: 'MORT. PAVO TIPO SHOULDER ASTURIAS POR KG',
    categoria: 'MORTADELAS',
    presentacion: 'Pieza por Kg (Caja ~12 kg)',
    kilosPorCaja: 12.0,
    precioSugeridoUSD: 48.00,
    codigosCadena: ['1561'],
    sinonimos: ['SHOULDER ASTURIAS', '1561'],
    unidadSugerida: 'KG'
  },
  {
    sku: '1521',
    producto: 'MORT. ECONOM COCIDA ASTURIAS X KG',
    categoria: 'MORTADELAS',
    presentacion: 'Pieza por Kg (Caja ~10 kg)',
    kilosPorCaja: 10.0,
    precioSugeridoUSD: 22.00,
    codigosCadena: ['1521'],
    sinonimos: ['ECONOMICA ASTURIAS', '1521'],
    unidadSugerida: 'KG'
  },
  {
    sku: '1522',
    producto: 'MORT. TIPO AREPERO ASTURIAS X KG',
    categoria: 'MORTADELAS',
    presentacion: 'Pieza por Kg (Caja ~10 kg)',
    kilosPorCaja: 10.0,
    precioSugeridoUSD: 23.50,
    codigosCadena: ['1522'],
    sinonimos: ['AREPERO ASTURIAS', '1522'],
    unidadSugerida: 'KG'
  },
  {
    sku: '1564',
    producto: 'MORTADELA EXTRA ASTURIAS X KG',
    categoria: 'MORTADELAS',
    presentacion: 'Pieza por Kg (Caja ~10 kg)',
    kilosPorCaja: 10.0,
    precioSugeridoUSD: 25.50,
    codigosCadena: ['1564'],
    sinonimos: ['EXTRA ASTURIAS', '1564'],
    unidadSugerida: 'KG'
  },
  {
    sku: '1563',
    producto: 'MORT. ESTANDAR SALPICAO X KG',
    categoria: 'MORTADELAS',
    presentacion: 'Pieza por Kg (Caja ~10 kg)',
    kilosPorCaja: 10.0,
    precioSugeridoUSD: 24.00,
    codigosCadena: ['1563'],
    sinonimos: ['ESTANDAR SALPICAO', '1563'],
    unidadSugerida: 'KG'
  },
  {
    sku: '1562',
    producto: 'MORT. ESPECIAL COCIDA SALPICAO X KG',
    categoria: 'MORTADELAS',
    presentacion: 'Pieza por Kg (Caja ~10 kg)',
    kilosPorCaja: 10.0,
    precioSugeridoUSD: 25.00,
    codigosCadena: ['1562'],
    sinonimos: ['ESPECIAL SALPICAO', '1562'],
    unidadSugerida: 'KG'
  },
  {
    sku: '1599',
    producto: 'MORT. NAVIDEÑA SALPICAO X KG',
    categoria: 'MORTADELAS',
    presentacion: 'Pieza por Kg (Caja ~12 kg)',
    kilosPorCaja: 12.0,
    precioSugeridoUSD: 34.00,
    codigosCadena: ['1599'],
    sinonimos: ['NAVIDEÑA SALPICAO', '1599'],
    unidadSugerida: 'KG'
  },
  {
    sku: '927',
    producto: 'MORTADELA ESP. CARACAS 10X900GRS',
    categoria: 'MORTADELAS',
    presentacion: 'Caja (10 und x 900g)',
    kilosPorCaja: 9.0,
    precioSugeridoUSD: 23.00,
    codigosCadena: ['927'],
    sinonimos: ['CARACAS 900', '927'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '1051',
    producto: 'MORTADELA ESP. CARACAS 10X500GRS',
    categoria: 'MORTADELAS',
    presentacion: 'Caja (10 und x 500g)',
    kilosPorCaja: 5.0,
    precioSugeridoUSD: 14.00,
    codigosCadena: ['1051'],
    sinonimos: ['CARACAS 500', '1051'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '1242',
    producto: 'MORT. CHORIZO ESPECIAL CDZ X KG',
    categoria: 'MORTADELAS',
    presentacion: 'Pieza por Kg (Caja ~10 kg)',
    kilosPorCaja: 10.0,
    precioSugeridoUSD: 28.00,
    codigosCadena: ['1242'],
    sinonimos: ['CHORIZO ESPECIAL', '1242'],
    unidadSugerida: 'KG'
  },

  // --- CARNES, CHULETAS Y TOCINO ---
  {
    sku: '1446',
    producto: 'CHULETA FRESCA ASTURIAS POR KG',
    categoria: 'CARNES / CHULETA',
    presentacion: 'Caja ~15 kg al vacío',
    kilosPorCaja: 15.0,
    precioSugeridoUSD: 72.00,
    codigosCadena: ['1446'],
    sinonimos: ['CHULETA FRESCA ASTURIAS', 'CHULETA ASTURIAS', '1446'],
    unidadSugerida: 'KG'
  },
  {
    sku: '1088',
    producto: 'CHULETA FRESCA IBERICO POR KG',
    categoria: 'CARNES / CHULETA',
    presentacion: 'Caja ~15 kg al vacío',
    kilosPorCaja: 15.0,
    precioSugeridoUSD: 69.00,
    codigosCadena: ['1088'],
    sinonimos: ['CHULETA IBERICO', '1088'],
    unidadSugerida: 'KG'
  },
  {
    sku: '1445',
    producto: 'TOCINO FRESCO ASTURIAS X KG',
    categoria: 'CARNES / CHULETA',
    presentacion: 'Caja ~15 kg',
    kilosPorCaja: 15.0,
    precioSugeridoUSD: 45.00,
    codigosCadena: ['1445'],
    sinonimos: ['TOCINO FRESCO ASTURIAS', '1445'],
    unidadSugerida: 'KG'
  },
  {
    sku: '340',
    producto: 'CHULETA AHUMADA ALIMEX X KG',
    categoria: 'CARNES / CHULETA',
    presentacion: 'Caja ~12 kg',
    kilosPorCaja: 12.0,
    precioSugeridoUSD: 65.00,
    codigosCadena: ['340'],
    sinonimos: ['CHULETA AHUMADA ALIMEX', '340'],
    unidadSugerida: 'KG'
  },

  // --- JAMONES, ESPALDAS Y SALCHICHAS ALIMEX / ITALICO ---
  {
    sku: '171',
    producto: 'JAMON COC. SUPERIOR ALIMEX 1X5.9KG',
    categoria: 'JAMONES',
    presentacion: 'Pieza (Barra ~5.9 kg)',
    kilosPorCaja: 11.8,
    precioSugeridoUSD: 68.00,
    codigosCadena: ['171', '100929'],
    sinonimos: ['JAMON COCIDO SUPERIOR ASTURIAS / ALIMEX', 'JAMON COCIDO DE PAVO AHUMADO SUPERIOR ASTURIAS', 'JAMON SUPERIOR ALIMEX', '171'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '172',
    producto: 'ESPALDA COCIDA ALIMEX 1X4.6KG',
    categoria: 'JAMONES',
    presentacion: 'Pieza (Barra ~4.6 kg)',
    kilosPorCaja: 9.2,
    precioSugeridoUSD: 54.00,
    codigosCadena: ['172'],
    sinonimos: ['ESPALDA COCIDA ALIMEX', 'ESPALDA ALIMEX', '172'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '241',
    producto: 'ESPAL. AHUM T/VISKING ALIMEX 6X3.2',
    categoria: 'JAMONES',
    presentacion: 'Caja (6 und x 3.2 kg)',
    kilosPorCaja: 19.2,
    precioSugeridoUSD: 98.00,
    codigosCadena: ['241'],
    sinonimos: ['VISKING ALIMEX', 'ESPALDA VISKING', '241'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '439',
    producto: 'ESPAL AHUM.T/AREPERO ALIMEX 12X1,6KG',
    categoria: 'JAMONES',
    presentacion: 'Caja (12 und x 1.6 kg)',
    kilosPorCaja: 19.2,
    precioSugeridoUSD: 95.00,
    codigosCadena: ['439'],
    sinonimos: ['AREPERO ALIMEX', '439'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '995',
    producto: 'ESPAL. AHUM T/VISKING ITALICO 6UNDX3.2KG',
    categoria: 'JAMONES',
    presentacion: 'Caja (6 und x 3.2 kg)',
    kilosPorCaja: 19.2,
    precioSugeridoUSD: 92.00,
    codigosCadena: ['995'],
    sinonimos: ['VISKING ITALICO', '995'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '337',
    producto: 'JAMON COCIDO ESTANDAR ITALICO X KG',
    categoria: 'JAMONES',
    presentacion: 'Pieza por Kg (Caja ~12 kg)',
    kilosPorCaja: 12.0,
    precioSugeridoUSD: 52.00,
    codigosCadena: ['337'],
    sinonimos: ['JAMON ITALICO', '337'],
    unidadSugerida: 'KG'
  },
  {
    sku: '170',
    producto: 'TOCINETA AHUM S/CUERO ALIMEX X KG',
    categoria: 'JAMONES',
    presentacion: 'Caja ~10 kg',
    kilosPorCaja: 10.0,
    precioSugeridoUSD: 58.00,
    codigosCadena: ['170'],
    sinonimos: ['TOCINETA ALIMEX', '170'],
    unidadSugerida: 'KG'
  },
  {
    sku: '177',
    producto: 'SALCHICHA VIENA ALIMEX 16 X 450 GRS',
    categoria: 'JAMONES',
    presentacion: 'Caja (16 paq x 450g)',
    kilosPorCaja: 7.2,
    precioSugeridoUSD: 28.00,
    codigosCadena: ['177'],
    sinonimos: ['SALCHICHA VIENA 450', '177'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '176',
    producto: 'SALCHICHA VIENA ALIMEX 8 X 800 GRS',
    categoria: 'JAMONES',
    presentacion: 'Caja (8 paq x 800g)',
    kilosPorCaja: 6.4,
    precioSugeridoUSD: 25.00,
    codigosCadena: ['176'],
    sinonimos: ['SALCHICHA VIENA 800', '176'],
    unidadSugerida: 'CJ'
  },

  // --- BENEFICIO DE POLLO Y DESPRESADO ---
  {
    sku: '101',
    producto: 'POLLO BENEFICIADO ENTERO',
    categoria: 'POLLO',
    presentacion: 'Cesta / Caja ~20 kg',
    kilosPorCaja: 20.0,
    precioSugeridoUSD: 56.00,
    codigosCadena: ['101', 'POLLO'],
    sinonimos: ['POLLO ENTERO', 'POLLO TODAS LAS MARCAS', 'POLLO'],
    unidadSugerida: 'KG'
  },
  {
    sku: '103',
    producto: 'FILET VARIAS PRESENTACIONES',
    categoria: 'POLLO',
    presentacion: 'Caja 15 kg congelado',
    kilosPorCaja: 15.0,
    precioSugeridoUSD: 65.00,
    codigosCadena: ['103', 'FILET'],
    sinonimos: ['FILET DE POLLO', 'FILET PECHUGA', 'FILET'],
    unidadSugerida: 'KG'
  },
  {
    sku: '629',
    producto: 'MUSLO CUADRIL DESPRESADO POR KG',
    categoria: 'POLLO',
    presentacion: 'Caja 15 kg congelado',
    kilosPorCaja: 15.0,
    precioSugeridoUSD: 39.00,
    codigosCadena: ['629', '102', 'MUSLO'],
    sinonimos: ['MUSLO CUADRIL', 'MUSLO POLLO', 'MUSLO', '629'],
    unidadSugerida: 'KG'
  },
  {
    sku: '630',
    producto: 'ALAS DESPRESADAS POR KG',
    categoria: 'POLLO',
    presentacion: 'Caja 15 kg congelado',
    kilosPorCaja: 15.0,
    precioSugeridoUSD: 42.00,
    codigosCadena: ['630', 'ALAS'],
    sinonimos: ['ALAS DE POLLO', 'ALAS', '630'],
    unidadSugerida: 'KG'
  },
  {
    sku: '870',
    producto: 'HIGADO (EMPACADO)',
    categoria: 'POLLO',
    presentacion: 'Caja 15 kg congelado',
    kilosPorCaja: 15.0,
    precioSugeridoUSD: 25.00,
    codigosCadena: ['870'],
    sinonimos: ['HIGADO DE POLLO', 'HIGADO', '870'],
    unidadSugerida: 'KG'
  },
  {
    sku: '393',
    producto: 'MOLLEJA (EMPACADA)',
    categoria: 'POLLO',
    presentacion: 'Caja 15 kg congelado',
    kilosPorCaja: 15.0,
    precioSugeridoUSD: 28.00,
    codigosCadena: ['393'],
    sinonimos: ['MOLLEJAS', '393'],
    unidadSugerida: 'KG'
  },

  // --- VÍVERES, BÁSICOS Y LÁCTEOS ---
  {
    sku: 'QS',
    producto: 'QUESO AMARILLO',
    categoria: 'LACTEOS',
    presentacion: 'Barra ~3.5 kg (Caja 14 kg)',
    kilosPorCaja: 14.0,
    precioSugeridoUSD: 72.00,
    codigosCadena: ['QS', 'QUESO'],
    sinonimos: ['QUESO AMARILLO GOUDA', 'QUESO', 'QS'],
    unidadSugerida: 'KG'
  },
  {
    sku: '301',
    producto: 'ACEITE VEGETAL COMESTIBLE 12X1LT',
    categoria: 'BASICOS',
    presentacion: 'Caja (12 botellas x 1L)',
    kilosPorCaja: 11.0,
    precioSugeridoUSD: 26.50,
    codigosCadena: ['301', 'ACEITE'],
    sinonimos: ['ACEITE VEGETAL', 'ACEITE', '301'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '302',
    producto: 'AZUCAR REFINADA BLANCA 50KG',
    categoria: 'BASICOS',
    presentacion: 'Saco 50 kg',
    kilosPorCaja: 50.0,
    precioSugeridoUSD: 48.00,
    codigosCadena: ['302', 'AZUCAR'],
    sinonimos: ['AZUCAR 50KG', 'AZUCAR', '302'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '303',
    producto: 'ARROZ BLANCO ESPECIAL 24X1KG',
    categoria: 'BASICOS',
    presentacion: 'Bulto (24 paquetes x 1kg)',
    kilosPorCaja: 24.0,
    precioSugeridoUSD: 28.80,
    codigosCadena: ['303', 'ARROZ'],
    sinonimos: ['ARROZ 900GR', 'ARROZ 24X1KG', 'ARROZ', '303'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '401',
    producto: 'HUEVOS BLANCOS SELECCIONADOS',
    categoria: 'BASICOS',
    presentacion: 'Caja (12 cartones / 360 und)',
    kilosPorCaja: 22.0,
    precioSugeridoUSD: 45.00,
    codigosCadena: ['401', 'HUEVOS'],
    sinonimos: ['HUEVOS BLANCOS', 'HUEVOS', '401'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '1360',
    producto: 'PATATAS FRESCAS MARQUISE 4X2.5KG',
    categoria: 'CONGELADOS',
    presentacion: 'Caja (4 bolsas x 2.5kg)',
    kilosPorCaja: 10.0,
    precioSugeridoUSD: 22.80,
    codigoBarra: '5412873178161',
    codigosCadena: ['1360', '5412873178161', 'PATATAS'],
    sinonimos: ['PAPAS FRITAS CONGELADAS MARQUISE 2,5KG', 'PAPAS MARQUISE', 'PATATAS FRESCAS', '1360', '5412873178161'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '047',
    producto: 'NUGGET CORRAL DE 460GM',
    categoria: 'CONGELADOS',
    presentacion: 'Paquete 460g',
    kilosPorCaja: 0.46,
    precioSugeridoUSD: 3.88,
    codigoBarra: '7591289400023',
    codigosCadena: ['047', '7591289400023'],
    sinonimos: ['NUGGETS DE POLLO DEL CORRAL 460GR', 'NUGGETS DE POLLO DEL CORRAL 462GR', 'NUGGET CORRAL DE 460GM', '047', '7591289400023'],
    unidadSugerida: 'UND'
  },
  {
    sku: '046',
    producto: 'NUGGETS DE POLLO (COD. 046)',
    categoria: 'CONGELADOS',
    presentacion: 'Bolsa Institucional por Kg',
    kilosPorCaja: 1.0,
    precioSugeridoUSD: 8.71,
    codigosCadena: ['046', '100253'],
    sinonimos: ['NUGGETS EL CORRAL POR KG', 'NUGGET CORRAL INSTITUCIONAL', 'NUGGETS DE POLLO (COD. 046)', '046', '100253'],
    unidadSugerida: 'KG'
  },
  {
    sku: '7591210000513',
    producto: 'CREMA DE LECHE PURISIMA 500GR',
    categoria: 'LACTEOS',
    presentacion: 'Caja (6 und x 500g)',
    kilosPorCaja: 3.0,
    precioSugeridoUSD: 25.63,
    codigoBarra: '7591210000513',
    codigosCadena: ['7591210000513'],
    sinonimos: ['CREMA DE LECHE PURISIMA 500GR', 'CREMA DE LECHE PURISIMA 6 X 500 GRS', '7591210000513'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '7591210000544',
    producto: 'CREMA DE LECHE PURISIMA 250GR',
    categoria: 'LACTEOS',
    presentacion: 'Caja (12 und x 250g)',
    kilosPorCaja: 3.0,
    precioSugeridoUSD: 30.60,
    codigoBarra: '7591210000544',
    codigosCadena: ['7591210000544'],
    sinonimos: ['CREMA DE LECHE PURISIMA 250GR', 'CREMA DE LECHE PURISIMA 12 X 250 GRS', '7591210000544'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '021000061778',
    producto: 'QUESO CREMA KRAFT 226 GR X 36 UND',
    categoria: 'LACTEOS',
    presentacion: 'Unidad 226g (Caja x 36 und)',
    kilosPorCaja: 0.226,
    precioSugeridoUSD: 3.00,
    codigoBarra: '021000061778',
    codigosCadena: ['021000061778'],
    sinonimos: ['QUESO CREMA MARCA KRAFT 226GR', 'QUESO CREMA KRAFT 226 GR X 36 UND', '021000061778'],
    unidadSugerida: 'UND'
  },
  {
    sku: '100281',
    producto: 'QUESO MOZZARELLA CORLASA 3.5KG X 4 UND',
    categoria: 'LACTEOS',
    presentacion: 'Pieza por Kg',
    kilosPorCaja: 14.0,
    precioSugeridoUSD: 10.00,
    codigosCadena: ['100281'],
    sinonimos: ['QUESO MOZZARELLA CORLASA X KG', 'QUESO MOZZARELLA CORLASA 3.5KG X 4 UND', '100281'],
    unidadSugerida: 'KG'
  },
  {
    sku: '1569',
    producto: 'PATATAS FRESCAS DOBLE COBERTURA 4X2.5KG',
    categoria: 'CONGELADOS',
    presentacion: 'Caja (4 bolsas x 2.5kg)',
    kilosPorCaja: 10.0,
    precioSugeridoUSD: 23.50,
    codigosCadena: ['1569'],
    sinonimos: ['PAPAS DOBLE COBERTURA', '1569'],
    unidadSugerida: 'CJ'
  },
  {
    sku: 'UTH',
    producto: 'LECHE LIQUIDA UHT 12X1LT',
    categoria: 'LACTEOS',
    presentacion: 'Caja (12 litros)',
    kilosPorCaja: 12.0,
    precioSugeridoUSD: 18.00,
    codigosCadena: ['UTH', 'LECHE UTH'],
    sinonimos: ['LECHE UHT', 'LECHE LIQUIDA', 'UTH'],
    unidadSugerida: 'CJ'
  },
  {
    sku: 'LPV',
    producto: 'LECHE EN POLVO VENCAMPO',
    categoria: 'LACTEOS',
    presentacion: 'Bulto (12 x 1kg / 24 x 500g)',
    kilosPorCaja: 12.0,
    precioSugeridoUSD: 54.00,
    codigosCadena: ['LPV', 'LECHE EN POLVO'],
    sinonimos: ['LECHE VENCAMPO', 'LECHE EN POLVO', 'LPV'],
    unidadSugerida: 'CJ'
  },
  {
    sku: 'JUGOS',
    producto: 'JUGOS Y NECTAR VARIOS',
    categoria: 'BEBIDAS',
    presentacion: 'Caja (24 und x 250ml)',
    kilosPorCaja: 6.0,
    precioSugeridoUSD: 16.00,
    codigosCadena: ['JUGOS', 'BEBIDAS'],
    sinonimos: ['JUGOS Y NECTAR', 'JUGOS', 'BEBIDAS'],
    unidadSugerida: 'CJ'
  },
  {
    sku: '1572',
    producto: 'CAJAS DE PIZZA 1X100',
    categoria: 'EMPAQUES',
    presentacion: 'Bulto (100 unidades)',
    kilosPorCaja: 10.0,
    precioSugeridoUSD: 25.00,
    codigosCadena: ['1572'],
    sinonimos: ['CAJA PIZZA', '1572'],
    unidadSugerida: 'BLT'
  }
];

/**
 * Normaliza y limpia códigos de productos extraídos por OCR o ingresados por el usuario.
 */
export function normalizarCodigoProducto(codigo: string): string {
  if (!codigo) return '';
  return String(codigo).trim().replace(/[\s\-_.]/g, '');
}

/**
 * Resuelve y correlaciona de manera inteligente un código (sea SKU, código de barra EAN-13,
 * o código interno de cadena como Alkosto / Familia Center) o descripción contra el catálogo oficial.
 */
export function resolverProductoPorCodigoODescripcion(
  codigoInput?: string, 
  descripcionInput?: string
): CatalogoAlkostoItem | undefined {
  const codRaw = String(codigoInput || '').trim();
  const codNorm = normalizarCodigoProducto(codRaw).toUpperCase();
  const descNorm = String(descripcionInput || '')
    .replace(/\s+\/\s*\d+(?:[.,]\d+)?\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  if (!codNorm && !descNorm) return undefined;

  // 1. Coincidencia exacta por SKU
  if (codNorm) {
    const match = CATALOGO_ALKOSTO.find(p => p.sku.toUpperCase() === codNorm);
    if (match) return match;
  }

  // 2. Coincidencia por código de barra (EAN-13)
  if (codNorm) {
    const match = CATALOGO_ALKOSTO.find(p => p.codigoBarra && normalizarCodigoProducto(p.codigoBarra) === codNorm);
    if (match) return match;
  }

  // 3. Coincidencia por códigos de cadenas (ej. Alkosto / Familia Center)
  if (codNorm) {
    const match = CATALOGO_ALKOSTO.find(p => p.codigosCadena && p.codigosCadena.some(c => normalizarCodigoProducto(c).toUpperCase() === codNorm));
    if (match) return match;
  }

  // 4. Coincidencia por sinónimos exactos en el código
  if (codNorm) {
    const match = CATALOGO_ALKOSTO.find(p => p.sinonimos && p.sinonimos.some(s => normalizarCodigoProducto(s).toUpperCase() === codNorm));
    if (match) return match;
  }

  // GUARDARRAÍL CRÍTICO: Si el documento trae un código numérico/EAN explícito (>= 4 dígitos)
  // que NO existe en el diccionario por código, solo permitir match por descripción si el nombre
  // o sinónimo coincide de forma exacta completa, NUNCA por coincidencia difusa de palabras sueltas.
  const hasExplicitUnmatchedNumericCode = codNorm.length >= 4 && /^\d+$/.test(codNorm);

  // 5. Coincidencia por descripción si existe
  if (descNorm) {
    // Coincidencia exacta de nombre de producto o sinónimo completo
    let match = CATALOGO_ALKOSTO.find(
      p => p.producto.toUpperCase() === descNorm ||
           (p.sinonimos && p.sinonimos.some(s => s.toUpperCase() === descNorm))
    );
    if (match) return match;

    if (hasExplicitUnmatchedNumericCode) {
      return undefined;
    }

    // Coincidencia por inclusión de frase completa (solo cuando no hay código numérico distinto)
    match = CATALOGO_ALKOSTO.find(p => {
      const pNorm = p.producto.toUpperCase();
      if (descNorm.includes(pNorm) || pNorm.includes(descNorm)) return true;
      if (p.sinonimos && p.sinonimos.some(s => s.length >= 6 && descNorm.includes(s.toUpperCase()))) return true;
      return false;
    });
    if (match) return match;

    // Coincidencia por tokens principales (solo cuando el usuario busca por texto sin código numérico conflictivo)
    const tokens = descNorm.split(/\s+/).filter(t => t.length > 2 && !['POR', 'CON', 'DEL', 'LOS', 'LAS', 'PARA', 'MAS'].includes(t));
    if (tokens.length > 0) {
      match = CATALOGO_ALKOSTO.find(p => {
        const pNorm = p.producto.toUpperCase();
        const matchesCount = tokens.filter(t => pNorm.includes(t)).length;
        const requiredMatches = tokens.length <= 2 ? tokens.length : Math.max(2, Math.ceil(tokens.length * 0.75));
        return matchesCount >= requiredMatches;
      });
      if (match) return match;
    }
  }

  return undefined;
}

function getLocalCache(): AlkostoOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Error leyendo caché local de pedidos Alkosto", e);
  }
  return [];
}

function setLocalCache(orders: AlkostoOrder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch (e) {
    console.warn("Error guardando en caché local de pedidos Alkosto", e);
  }
}

export function calcularSiguienteCorrelativo(pedidos: AlkostoOrder[]): string {
  let max = 0;
  for (const p of pedidos) {
    const raw = p.correlativo || p.numeroPedido || '';
    const digits = raw.replace(/\D/g, '');
    if (digits) {
      const num = parseInt(digits, 10);
      if (!isNaN(num) && num < 100000 && num > max) {
        max = num;
      }
    }
  }
  const next = max > 0 ? max + 1 : (pedidos.length > 0 ? pedidos.length + 1 : 1);
  return String(next).padStart(4, '0');
}

export function subscribeAlkostoOrders(callback: (orders: AlkostoOrder[]) => void): () => void {
  // Emitir caché local de inmediato
  const cached = getLocalCache();
  callback(cached);

  try {
    const q = query(collection(db, ALKOSTO_COLLECTION));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: AlkostoOrder[] = [];
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as Partial<AlkostoOrder>;
          if (data && data.sucursalNombre) {
            list.push({
              id: docSnap.id,
              numeroPedido: data.numeroPedido || `ALK-${docSnap.id.substring(0, 6).toUpperCase()}`,
              correlativo: data.correlativo || (data.numeroPedido && data.numeroPedido.length <= 5 ? data.numeroPedido : undefined),
              ordenCompraAlkosto: data.ordenCompraAlkosto || '',
              sucursalCodigo: data.sucursalCodigo || '7497',
              sucursalNombre: data.sucursalNombre || 'Alkosto',
              direccionEntrega: data.direccionEntrega || '',
              vendedora: data.vendedora || 'SAIRU VALLES',
              ruta: data.ruta || 'CUENTAS CLAVE 2',
              fechaPedido: data.fechaPedido || new Date().toISOString().split('T')[0],
              fechaEntregaEstimada: data.fechaEntregaEstimada || '',
              items: Array.isArray(data.items) ? data.items : [],
              totalBultos: Number(data.totalBultos) || 0,
              totalKilos: Number(data.totalKilos) || 0,
              totalUSD: Number(data.totalUSD) || 0,
              estado: (data.estado as EstadoPedidoAlkosto) || 'BORRADOR',
              condicionPago: data.condicionPago || 'Crédito 15 días',
              contactoRecepcion: data.contactoRecepcion || '',
              telefonoRecepcion: data.telefonoRecepcion || '',
              observaciones: data.observaciones || '',
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || new Date().toISOString()
            });
          }
        });

        // Asegurar que cada pedido en la sala de espera tenga su número correlativo asignado por orden de llegada
        const sortedByArrival = [...list].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        let maxCorrelativo = 0;
        sortedByArrival.forEach(o => {
          if (o.correlativo && /^\d+$/.test(o.correlativo)) {
            const val = parseInt(o.correlativo, 10);
            if (val > maxCorrelativo) maxCorrelativo = val;
          }
        });

        sortedByArrival.forEach((order) => {
          if (!order.correlativo || !/^\d+$/.test(order.correlativo)) {
            maxCorrelativo++;
            order.correlativo = String(maxCorrelativo).padStart(4, '0');
            order.numeroPedido = order.correlativo;
          }
        });

        // Ordenar por fecha de creación descendente
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setLocalCache(list);
        callback(list);
      },
      (error) => {
        console.warn("Error en suscripción de Firestore para Alkosto:", error);
        callback(getLocalCache());
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn("Fallo inicializando listener Firestore para Alkosto:", err);
    return () => {};
  }
}

export async function saveAlkostoOrder(
  order: AlkostoOrder,
  options: { skipBackendSync?: boolean } = {}
): Promise<AlkostoOrder> {
  const current = getLocalCache();

  // Si aún no tiene correlativo, proponer uno local preliminar (el servidor asignará el definitivo atómicamente)
  if (!order.correlativo || order.correlativo.includes('AUTO') || order.numeroPedido === 'AUTO' || order.numeroPedido === 'PENDIENTE' || order.numeroPedido.length > 5) {
    const correlativoAuto = calcularSiguienteCorrelativo(current);
    order.correlativo = correlativoAuto;
    order.numeroPedido = correlativoAuto;
  }

  // 1. Sincronizar primero de forma determinista con el backend API (con await estricto para evitar race conditions)
  if (!options.skipBackendSync) {
    try {
      const res = await fetch('/api/alkosto/pedidos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(order)
      });
      if (res.ok) {
        const resJson = await res.json().catch(() => null);
        if (resJson?.data) {
          if (resJson.data.correlativo) {
            order.correlativo = String(resJson.data.correlativo);
            order.numeroPedido = String(resJson.data.numeroPedido || resJson.data.correlativo);
          }
          if (resJson.data.id) {
            order.id = String(resJson.data.id);
          }
        }
      }
    } catch (apiErr) {
      console.warn('[ENVIO_FDV] Aviso al sincronizar con backend en saveAlkostoOrder:', apiErr);
    }
  }

  // 2. Actualizar caché local con el correlativo definitivo
  const latestCache = getLocalCache();
  const idx = latestCache.findIndex(o => o.id === order.id);
  let updated: AlkostoOrder[];
  if (idx >= 0) {
    updated = [...latestCache];
    updated[idx] = { ...order, updatedAt: new Date().toISOString() };
  } else {
    updated = [{ ...order, updatedAt: new Date().toISOString() }, ...latestCache];
  }
  setLocalCache(updated);

  // 3. Persistir en Firestore con await
  try {
    const docRef = doc(db, ALKOSTO_COLLECTION, order.id);
    await setDoc(docRef, order, { merge: true });
  } catch (err) {
    console.warn("Error guardando pedido Alkosto en Firestore:", err);
  }

  return order;
}

const inFlightOrderSubmissions = new Map<string, Promise<any>>();

function homologarVendedorSairu(raw?: string): string {
  const s = String(raw || '').trim();
  if (!s) return 'Sairu Valles';
  const upper = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (upper.includes('SAIRU') || upper.includes('VALLES') || upper.includes('CUENTAS CLAVE')) {
    return 'Sairu Valles';
  }
  return s;
}

function construirClaveIdempotenciaCliente(pedido: AlkostoOrder): string {
  const existing = String(pedido.idempotencyKey || '').trim();
  if (existing) return existing;
  const rawId = String(pedido.id || '').trim();
  if (rawId && !/^alk-ord-/i.test(rawId)) return rawId;

  const branchKey = String(pedido.sucursalTag || pedido.sucursalCodigo || 'doc')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') || 'doc';
  const ocClean = String(pedido.numero_oc || pedido.ordenCompraAlkosto || 'SN')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^0+/, '') || 'SN';
  const itemsSource = Array.isArray(pedido.renglones) && pedido.renglones.length > 0
    ? pedido.renglones.map(r => `${r.codigo}:${Number(r.cantidad || 0).toFixed(2)}:${Number(r.precio_unitario || 0).toFixed(4)}:${Number(r.descuento || 0).toFixed(2)}`)
    : (Array.isArray(pedido.items) ? pedido.items : []).map(it => `${it.sku}:${Number(it.cantidadCajas || 0).toFixed(2)}:${Number(it.precioUnitarioUSD || 0).toFixed(4)}:${Number(it.descuento || 0).toFixed(2)}`);
  const seed = `${branchKey}|${ocClean}|${String(pedido.fechaPedido || '').slice(0, 10)}|${itemsSource.sort().join('|')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `alk-${branchKey}-${ocClean.slice(-6).toLowerCase()}${(h >>> 0).toString(36)}`;
}

function esErrorTransitorioReintentable(err: any, httpStatus?: number): boolean {
  if (typeof httpStatus === 'number') {
    return httpStatus === 408 || httpStatus === 429 || httpStatus >= 500;
  }
  const msg = String(err?.message || err || '').toLowerCase();
  if (
    msg.includes('http 400') ||
    msg.includes('http 401') ||
    msg.includes('http 403') ||
    msg.includes('http 422') ||
    msg.includes('validación')
  ) {
    return false;
  }
  return true;
}

/**
 * Validación previa estricta de producción antes de permitir cualquier envío a Sala de Espera:
 * - Verifica cliente/sucursal válida.
 * - Verifica al menos 1 producto válido con cantidad > 0 y descripción o SKU presente.
 */
export function validarPedidoAlkostoAntesDeEnviar(
  pedidoInput: Partial<AlkostoOrder> | null | undefined
): {
  valido: boolean;
  errores: string[];
  pedidoSanitizado: AlkostoOrder | null;
} {
  const errores: string[] = [];
  if (!pedidoInput || typeof pedidoInput !== 'object') {
    return {
      valido: false,
      errores: ['El pedido está vacío o tiene un formato inválido.'],
      pedidoSanitizado: null
    };
  }

  const sucursalNombre = String(
    pedidoInput.sucursal_cliente || pedidoInput.sucursalNombre || ''
  ).trim();
  const sucursalCodigo = String(
    pedidoInput.sucursalCodigo || pedidoInput.strict_payload?.id_cliente || ''
  ).trim();

  if (!sucursalNombre && !sucursalCodigo) {
    errores.push('Debe seleccionar una sucursal/tienda de ALKOSTO o FAMILIA CENTER válida.');
  }

  const sanitizado = sanitizarPedidoSucursalAntesDeEnviar(pedidoInput as AlkostoOrder);
  if (!sanitizado) {
    errores.push('El pedido debe contener al menos un producto válido con cantidad mayor a cero (cantidad > 0).');
    return { valido: false, errores, pedidoSanitizado: null };
  }

  const renglonesValidos = (sanitizado.renglones || []).filter(
    r =>
      Number.isFinite(r.cantidad) &&
      r.cantidad > 0 &&
      (String(r.codigo || '').trim() !== '' || String(r.descripcion || '').trim() !== '')
  );

  if (renglonesValidos.length === 0) {
    errores.push('El pedido debe contener al menos un producto válido con código/descripción y cantidad mayor a cero.');
    return { valido: false, errores, pedidoSanitizado: null };
  }

  return {
    valido: errores.length === 0,
    errores,
    pedidoSanitizado: errores.length === 0 ? sanitizado : null
  };
}

/**
 * Transmite un pedido desde el Historial / Detalle hacia la Sala de Espera de Pedidos Manuales
 * con validación previa, idempotencia, hasta 2 reintentos automáticos ante micro-cortes de red
 * y confirmación estricta del `id` retornado por la base de datos destino.
 */
export async function transmitirPedidoAlkosto(
  order: AlkostoOrder
): Promise<{ success: boolean; id: string; message: string; data?: any; attempts?: number }> {
  const validacion = validarPedidoAlkostoAntesDeEnviar(order);
  if (!validacion.valido || !validacion.pedidoSanitizado) {
    throw new Error(`Validación previa fallida: ${validacion.errores.join(' ')}`);
  }

  const pedidoLimpio = validacion.pedidoSanitizado;
  const idempotencyKey = construirClaveIdempotenciaCliente(pedidoLimpio);

  // Deduplicación en vuelo (anti-doble clic concurrente)
  const existingFlight = inFlightOrderSubmissions.get(`transmitir:${idempotencyKey}`);
  if (existingFlight) {
    return existingFlight;
  }

  const executionPromise = (async () => {
    const maxIntentos = 3; // 1 intento inicial + hasta 2 reintentos automáticos
    let ultimoError: Error | null = null;

    for (let intento = 1; intento <= maxIntentos; intento++) {
      let lastStatus: number | undefined;
      try {
        const res = await fetch('/api/alkosto/pedidos/transmitir', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey,
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            ...pedidoLimpio,
            id: pedidoLimpio.id || idempotencyKey,
            idempotencyKey
          })
        });

        lastStatus = res.status;
        const resText = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(resText);
        } catch {}

        if (!res.ok || data?.success === false) {
          const errMsg = data?.error || data?.details || `Error transmitiendo pedido (HTTP ${res.status})`;
          const httpErr = new Error(errMsg);
          (httpErr as any).status = res.status;
          throw httpErr;
        }

        const confirmedId = String(
          data?.salaEsperaId || data?.data?.salaEsperaId || data?.data?.id || ''
        ).trim();

        if (!confirmedId) {
          throw new Error('La Sala de Espera no devolvió el ID de confirmación de la base de datos.');
        }

        return {
          success: true,
          id: confirmedId,
          attempts: intento,
          message:
            data.message ||
            `Pedido confirmado en Sala de Espera (ID: ${confirmedId})`,
          data: {
            ...(data.data || pedidoLimpio),
            id: confirmedId,
            salaEsperaId: confirmedId
          }
        };
      } catch (err: any) {
        ultimoError = err instanceof Error ? err : new Error(String(err));
        const status = (err as any)?.status ?? lastStatus;
        const canRetry = intento < maxIntentos && esErrorTransitorioReintentable(ultimoError, status);
        console.warn(
          `[ENVIO_FDV] Intento ${intento}/${maxIntentos} en transmitirPedidoAlkosto (${pedidoLimpio.sucursalNombre}): ${ultimoError.message}`
        );
        if (!canRetry) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 350 * intento));
      }
    }

    throw ultimoError || new Error('No se pudo confirmar la inserción del pedido en la Sala de Espera.');
  })();

  inFlightOrderSubmissions.set(`transmitir:${idempotencyKey}`, executionPromise);
  try {
    return await executionPromise;
  } finally {
    inFlightOrderSubmissions.delete(`transmitir:${idempotencyKey}`);
  }
}

/**
 * Sanitiza un pedido de sucursal antes de enviarlo:
 * - Filtra cualquier renglón residual con `cantidad <= 0` o `isNaN(cantidad)`.
 * - Homologa `vendedor: 'Sairu Valles'`, `cadena` (`'ALKOSTO' | 'FAMILIA CENTER'`) y `estadoSalaEspera: 'POR_VALIDAR'`.
 * - Preserva 100% de los atributos de cada ítem: `codigo`/`sku`, `descripcion`, `cantidad`, `cajas`, `unidades`, `kilos`, `precio`, `descuento` y `subtotal`.
 */
export function sanitizarPedidoSucursalAntesDeEnviar(pedido: AlkostoOrder): AlkostoOrder | null {
  if (!pedido || typeof pedido !== 'object') return null;

  const itemsActivos = (Array.isArray(pedido.items) ? pedido.items : [])
    .map((it: any, idx: number) => {
      const cant = Number(
        it.cantidadCajas ?? it.cantidad ?? it.bultos ?? it.cajas ?? it.cantSolicitada ?? it.cantidad_solicitada ?? 0
      );
      if (!Number.isFinite(cant) || Number.isNaN(cant) || cant <= 0) return null;

      const skuClean = String(it.sku ?? it.codigo ?? '').trim();
      const prodClean = String(it.producto ?? it.descripcion ?? '').trim();
      if (!skuClean && !prodClean) return null;

      const precioBruto = Number.isFinite(Number(it.precioBrutoUSD ?? it.precio_bruto))
        ? Number(it.precioBrutoUSD ?? it.precio_bruto)
        : 0;
      const descuento = Number.isFinite(Number(it.descuento)) && Number(it.descuento) > 0
        ? Number(Number(it.descuento).toFixed(2))
        : 0;
      let precio = Number.isFinite(Number(it.precioUnitarioUSD ?? it.precio_unitario ?? it.precio))
        ? Number(it.precioUnitarioUSD ?? it.precio_unitario ?? it.precio)
        : 0;
      if (precio <= 0 && precioBruto > 0 && descuento > 0 && descuento <= 100) {
        precio = Number((precioBruto * (1 - descuento / 100)).toFixed(4));
      }

      const rawSub = Number(it.subtotalUSD ?? it.subtotal ?? it.sub_total ?? 0);
      const sub = precio > 0
        ? Number((cant * precio).toFixed(2))
        : (Number.isFinite(rawSub) && rawSub >= 0 ? Number(rawSub.toFixed(2)) : 0);

      const pres = String(it.presentacion ?? it.unidad_medida ?? 'CJ').trim().toUpperCase();
      const isBox = ['CJ', 'CJA', 'CAJA', 'CAJAS', 'BLT', 'BULTO', 'BULTOS'].includes(pres) || pres.startsWith('CAJA');
      const isUnit = ['UND', 'UNID', 'UNIDAD', 'UNIDADES'].includes(pres);
      const kxBox = Number(it.kilosPorCaja) > 0 ? Number(it.kilosPorCaja) : (pres === 'KG' ? 1 : 10);
      const totalK = Number(it.totalKilos ?? it.kilos) > 0
        ? Number(Number(it.totalKilos ?? it.kilos).toFixed(2))
        : Number((pres === 'KG' ? cant : cant * kxBox).toFixed(2));

      return {
        ...it,
        id: it.id || `item-${idx + 1}`,
        sku: skuClean,
        producto: prodClean,
        categoria: it.categoria || 'CHARCUTERIA / CARNES',
        presentacion: it.presentacion || pres,
        cantidadCajas: Number(cant.toFixed(2)),
        cajas: Number.isFinite(Number(it.cajas)) ? Number(it.cajas) : (isBox ? Number(cant.toFixed(2)) : 0),
        unidades: Number.isFinite(Number(it.unidades)) ? Number(it.unidades) : (isUnit ? Number(cant.toFixed(2)) : 0),
        kilosPorCaja: kxBox,
        totalKilos: totalK,
        precioUnitarioUSD: Number(precio.toFixed(4)),
        ...(precioBruto > 0 ? { precioBrutoUSD: Number(precioBruto.toFixed(4)) } : {}),
        descuento,
        subtotalUSD: sub
      } as AlkostoOrderItem;
    })
    .filter((it): it is AlkostoOrderItem => it !== null);

  const renglonesBase = Array.isArray(pedido.renglones) && pedido.renglones.length > 0
    ? pedido.renglones
    : itemsActivos.map(it => ({
        codigo: it.sku,
        sku: it.sku,
        descripcion: it.producto,
        unidad_medida: it.presentacion,
        cantidad: it.cantidadCajas,
        cajas: it.cajas,
        unidades: it.unidades,
        kilos: it.totalKilos,
        precio_unitario: it.precioUnitarioUSD,
        precio_bruto: it.precioBrutoUSD,
        descuento: it.descuento ?? 0,
        subtotal: it.subtotalUSD
      }));

  const renglonesActivos = renglonesBase
    .map((r: any) => {
      const cant = Number(r.cantidad ?? r.cantidad_solicitada ?? r.cantidadCajas ?? r.bultos ?? 0);
      if (!Number.isFinite(cant) || Number.isNaN(cant) || cant <= 0) return null;

      const codigo = String(r.codigo ?? r.sku ?? '').trim();
      const descripcion = String(r.descripcion ?? r.producto ?? '').trim();
      if (!codigo && !descripcion) return null;

      const precioBruto = Number.isFinite(Number(r.precio_bruto ?? r.precioBrutoUSD))
        ? Number(r.precio_bruto ?? r.precioBrutoUSD)
        : 0;
      const descuento = Number.isFinite(Number(r.descuento)) && Number(r.descuento) > 0
        ? Number(Number(r.descuento).toFixed(2))
        : 0;
      let precio = Number.isFinite(Number(r.precio_unitario ?? r.precio ?? r.precioUnitarioUSD))
        ? Number(r.precio_unitario ?? r.precio ?? r.precioUnitarioUSD)
        : 0;
      if (precio <= 0 && precioBruto > 0 && descuento > 0 && descuento <= 100) {
        precio = Number((precioBruto * (1 - descuento / 100)).toFixed(4));
      }

      const rawSub = Number(r.subtotal ?? r.sub_total ?? r.subtotalUSD ?? 0);
      const sub = precio > 0
        ? Number((cant * precio).toFixed(2))
        : (Number.isFinite(rawSub) && rawSub >= 0 ? Number(rawSub.toFixed(2)) : 0);

      const unid = String(r.unidad_medida ?? 'CJ').trim().toUpperCase();
      const isBox = ['CJ', 'CJA', 'CAJA', 'CAJAS', 'BLT', 'BULTO', 'BULTOS'].includes(unid) || unid.startsWith('CAJA');
      const isUnit = ['UND', 'UNID', 'UNIDAD', 'UNIDADES'].includes(unid);

      return {
        ...r,
        codigo,
        sku: String(r.sku || codigo).trim(),
        descripcion,
        unidad_medida: r.unidad_medida || 'CJ',
        cantidad: Number(cant.toFixed(2)),
        cajas: Number.isFinite(Number(r.cajas)) ? Number(r.cajas) : (isBox ? Number(cant.toFixed(2)) : 0),
        unidades: Number.isFinite(Number(r.unidades)) ? Number(r.unidades) : (isUnit ? Number(cant.toFixed(2)) : 0),
        ...(Number.isFinite(Number(r.kilos)) ? { kilos: Number(Number(r.kilos).toFixed(2)) } : {}),
        precio_unitario: Number(precio.toFixed(4)),
        ...(precioBruto > 0 ? { precio_bruto: Number(precioBruto.toFixed(4)) } : {}),
        descuento,
        subtotal: sub
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (renglonesActivos.length === 0) {
    return null;
  }

  // Asegurar que `items` nunca quede vacío si el pedido vino únicamente con `renglones`
  const itemsSincronizados: AlkostoOrderItem[] =
    itemsActivos.length > 0
      ? itemsActivos
      : renglonesActivos.map((r, idx) => ({
          id: `item-${idx + 1}`,
          sku: r.codigo,
          producto: r.descripcion,
          categoria: 'CHARCUTERIA / CARNES',
          presentacion: String(r.unidad_medida || 'CJ'),
          cantidadCajas: r.cantidad,
          cajas: r.cajas,
          unidades: r.unidades,
          kilosPorCaja: String(r.unidad_medida || '').toUpperCase() === 'KG' ? 1 : 10,
          totalKilos: Number(r.kilos ?? r.cantidad),
          precioUnitarioUSD: r.precio_unitario,
          ...(r.precio_bruto ? { precioBrutoUSD: r.precio_bruto } : {}),
          descuento: r.descuento ?? 0,
          subtotalUSD: r.subtotal
        }));

  const montoPedidoExacto = Number(
    renglonesActivos.reduce((acc, r) => acc + Number(r.subtotal || 0), 0).toFixed(2)
  );
  const totalBultosExacto = Number(
    renglonesActivos.reduce((acc, r) => acc + r.cantidad, 0).toFixed(2)
  );

  const vendedorHomologado = homologarVendedorSairu(pedido.vendedor || pedido.vendedora || pedido.ruta);
  const detectedChain =
    pedido.cadena ||
    (detectCadenaFromTagOrName(
      `${pedido.sucursalTag || ''} ${pedido.sucursal_cliente || ''} ${pedido.sucursalNombre || ''}`
    ) === 'FAMILIA_CENTER'
      ? 'FAMILIA CENTER'
      : 'ALKOSTO');

  const sanitizedBase: AlkostoOrder = {
    ...pedido,
    cadena: detectedChain,
    vendedora: vendedorHomologado,
    vendedor: vendedorHomologado,
    ruta: vendedorHomologado,
    estadoSalaEspera: 'POR_VALIDAR',
    items: itemsSincronizados,
    renglones: renglonesActivos,
    total_renglones: renglonesActivos.length,
    totalBultos: totalBultosExacto,
    totalUSD: montoPedidoExacto,
    monto_pedido: montoPedidoExacto,
    totalNeto: montoPedidoExacto,
    strict_payload: pedido.strict_payload
      ? {
          ...pedido.strict_payload,
          cadena: detectedChain,
          vendedor: vendedorHomologado,
          estado: 'POR VALIDAR',
          estado_sala_espera: 'POR_VALIDAR',
          renglones: renglonesActivos,
          total_renglones: renglonesActivos.length,
          monto_pedido: montoPedidoExacto
        }
      : undefined
  };

  const idempKey = construirClaveIdempotenciaCliente(sanitizedBase);
  sanitizedBase.idempotencyKey = idempKey;
  if (!sanitizedBase.id || /^alk-ord-/i.test(sanitizedBase.id)) {
    sanitizedBase.id = idempKey;
  }

  return sanitizedBase;
}

/**
 * Envía un único pedido de forma transaccional con validación previa, idempotencia,
 * hasta 2 reintentos automáticos (3 intentos totales) ante micro-cortes de red,
 * y verificación estricta del `id` confirmado por la base de datos de Sala de Espera.
 */
export async function enviarPedidoAlkostoTransaccional(
  pedidoInput: AlkostoOrder,
  indiceActual: number,
  totalLote: number
): Promise<AlkostoOrder> {
  const validacion = validarPedidoAlkostoAntesDeEnviar(pedidoInput);
  if (!validacion.valido || !validacion.pedidoSanitizado) {
    throw new Error(`Validación previa fallida: ${validacion.errores.join(' ')}`);
  }

  const pedido = validacion.pedidoSanitizado;
  const idempotencyKey = construirClaveIdempotenciaCliente(pedido);

  const existingFlight = inFlightOrderSubmissions.get(`enviar:${idempotencyKey}`);
  if (existingFlight) {
    return existingFlight;
  }

  const executionPromise = (async () => {
    const maxIntentos = 3; // 1 intento inicial + hasta 2 reintentos automáticos
    let ultimoError: Error | null = null;

    for (let intento = 1; intento <= maxIntentos; intento++) {
      let lastStatus: number | undefined;
      try {
        const res = await fetch('/api/alkosto/pedidos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey,
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            ...pedido,
            id: pedido.id || idempotencyKey,
            idempotencyKey,
            estado: 'ENVIADO',
            estadoSalaEspera: 'POR_VALIDAR'
          })
        });

        lastStatus = res.status;
        const resText = await res.text();
        let payload: any = null;
        try {
          payload = JSON.parse(resText);
        } catch {}

        if (!res.ok || !payload?.success) {
          const err = new Error(payload?.error || payload?.details || `Error HTTP ${res.status} al insertar pedido`);
          (err as any).status = res.status;
          throw err;
        }

        const serverRecord = payload.data || {};
        const confirmedId = String(
          payload?.salaEsperaId || serverRecord?.salaEsperaId || serverRecord?.id || ''
        ).trim();

        if (!confirmedId) {
          throw new Error('La base de datos de la Sala de Espera no devolvió el ID del pedido insertado.');
        }

        const pedidoConfirmado: AlkostoOrder = {
          ...pedido,
          id: confirmedId,
          salaEsperaId: confirmedId,
          idempotencyKey,
          correlativo: String(serverRecord.correlativo || pedido.correlativo || pedido.numeroPedido),
          numeroPedido: String(serverRecord.numeroPedido || serverRecord.correlativo || pedido.numeroPedido),
          estado: 'ENVIADO',
          estadoSalaEspera: 'POR_VALIDAR',
          transmitido_a_pedidos_manuales: true,
          fecha_transmision: serverRecord.fecha_transmision || new Date().toISOString()
        };

        // Sincronizar caché local y Firestore con el ID y correlativo definitivos (sin volver a disparar POST al backend)
        await saveAlkostoOrder(pedidoConfirmado, { skipBackendSync: true });

        const renglonesCount = pedidoConfirmado.total_renglones ?? pedidoConfirmado.renglones?.length ?? pedidoConfirmado.items?.length ?? 0;
        const montoVal = Number(pedidoConfirmado.monto_pedido ?? pedidoConfirmado.totalUSD ?? 0);

        console.log(
          `[ENVIO_FDV] Pedido ${indiceActual}/${totalLote} confirmado en Sala de Espera con ID ${confirmedId} | Vendedor: ${pedidoConfirmado.vendedor} | Cliente ID: ${pedidoConfirmado.sucursalCodigo} (${pedidoConfirmado.sucursal_cliente || pedidoConfirmado.sucursalNombre}) | Correlativo: N° ${pedidoConfirmado.correlativo} | OC: ${pedidoConfirmado.numero_oc || pedidoConfirmado.ordenCompraAlkosto || 'S/N'} | Renglones: ${renglonesCount} | Monto: $${montoVal.toFixed(2)}`
        );

        return pedidoConfirmado;
      } catch (err: any) {
        ultimoError = err instanceof Error ? err : new Error(String(err));
        const status = (err as any)?.status ?? lastStatus;
        const canRetry = intento < maxIntentos && esErrorTransitorioReintentable(ultimoError, status);
        console.warn(
          `[ENVIO_FDV] Intento ${intento}/${maxIntentos} fallido para pedido ${indiceActual}/${totalLote} (${pedido.sucursal_cliente || pedido.sucursalNombre}): ${ultimoError.message}`
        );
        if (!canRetry) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 400 * intento));
      }
    }

    throw ultimoError || new Error(`Fallo al enviar el pedido de ${pedido.sucursal_cliente || pedido.sucursalNombre}`);
  })();

  inFlightOrderSubmissions.set(`enviar:${idempotencyKey}`, executionPromise);
  try {
    return await executionPromise;
  } finally {
    inFlightOrderSubmissions.delete(`enviar:${idempotencyKey}`);
  }
}

/**
 * Envía un lote de N pedidos activos de forma estrictamente secuencial (`for (const [index, pedido] of pedidosActivos.entries())` con `await`)
 * verificando la integridad de cada pedido (N de N) y reportando progreso en vivo.
 */
export async function enviarLotePedidosAlkosto(
  pedidosPorEnviar: AlkostoOrder[],
  onProgress?: (indice: number, total: number, pedidoActual: AlkostoOrder) => void
): Promise<{
  pedidosInsertados: AlkostoOrder[];
  pedidosFallidos: Array<{ pedido: AlkostoOrder; motivo: string }>;
  integridadCompleta: boolean;
}> {
  // Filtrar y sanitizar estrictamente cualquier pedido sin renglones con cantidad > 0
  const pedidosActivos = pedidosPorEnviar
    .map(p => sanitizarPedidoSucursalAntesDeEnviar(p))
    .filter((p): p is AlkostoOrder => p !== null && (p.total_renglones ?? p.items.length) > 0);

  if (pedidosActivos.length === 0) {
    throw new Error('Validación previa: Debe existir al menos un producto válido con cantidad mayor a cero antes de enviar.');
  }

  const pedidosInsertados: AlkostoOrder[] = [];
  const pedidosFallidos: Array<{ pedido: AlkostoOrder; motivo: string }> = [];
  const total = pedidosActivos.length;

  console.log(`[ENVIO_FDV] Iniciando transmisión transaccional de lote: ${total} sucursal(es) activa(s) por enviar...`);

  // Asignar correlativos consecutivos preliminares sin colisión antes de iniciar el bucle secuencial
  const baseCache = getLocalCache();
  let nextCorrNum = parseInt(calcularSiguienteCorrelativo(baseCache), 10) || 1;

  for (const [index, pedidoRaw] of pedidosActivos.entries()) {
    const pedido = { ...pedidoRaw };
    if (!pedido.correlativo || pedido.correlativo === 'AUTO' || pedido.numeroPedido === 'AUTO' || pedido.numeroPedido === 'PENDIENTE') {
      const assignedCorr = String(nextCorrNum).padStart(4, '0');
      pedido.correlativo = assignedCorr;
      pedido.numeroPedido = assignedCorr;
      nextCorrNum++;
    }

    if (onProgress) {
      onProgress(index + 1, total, pedido);
    }

    try {
      const confirmado = await enviarPedidoAlkostoTransaccional(pedido, index + 1, total);
      pedidosInsertados.push(confirmado);
      // Ajustar nextCorrNum si el servidor asignó un correlativo mayor
      const serverCorrNum = parseInt(String(confirmado.correlativo || ''), 10);
      if (!isNaN(serverCorrNum) && serverCorrNum >= nextCorrNum) {
        nextCorrNum = serverCorrNum + 1;
      }
    } catch (err: any) {
      const motivo = err?.message || 'Error de red o validación en el servidor';
      console.error(
        `[ENVIO_FDV] ERROR en Pedido ${index + 1}/${total} (${pedido.sucursal_cliente || pedido.sucursalNombre}): ${motivo}`
      );
      pedidosFallidos.push({ pedido, motivo });
    }
  }

  const integridadCompleta = total > 0 && pedidosInsertados.length === total && pedidosFallidos.length === 0;
  console.log(
    `[ENVIO_FDV] Resultado de lote: ${pedidosInsertados.length}/${total} insertados exitosamente | Fallidos: ${pedidosFallidos.length} | Integridad 100%: ${integridadCompleta}`
  );

  return {
    pedidosInsertados,
    pedidosFallidos,
    integridadCompleta
  };
}

export async function updateAlkostoOrderStatus(id: string, nuevoEstado: EstadoPedidoAlkosto): Promise<void> {
  const current = getLocalCache();
  const idx = current.findIndex(o => o.id === id);
  const isEnviado = nuevoEstado === 'ENVIADO';
  const nowIso = new Date().toISOString();

  if (idx >= 0) {
    current[idx].estado = nuevoEstado;
    if (isEnviado) {
      current[idx].transmitido_a_pedidos_manuales = true;
      current[idx].fecha_transmision = nowIso;
    }
    current[idx].updatedAt = nowIso;
    setLocalCache([...current]);
  }

  try {
    const docRef = doc(db, ALKOSTO_COLLECTION, id);
    const updatePayload: any = {
      estado: nuevoEstado,
      updatedAt: nowIso
    };
    if (isEnviado) {
      updatePayload.transmitido_a_pedidos_manuales = true;
      updatePayload.fecha_transmision = nowIso;
    }
    await updateDoc(docRef, updatePayload);
  } catch (err) {
    console.warn("Error actualizando estado en Firestore:", err);
  }

  try {
    fetch(`/api/alkosto/pedidos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        status: nuevoEstado,
        transmitido_a_pedidos_manuales: isEnviado ? true : undefined,
        fecha_transmision: isEnviado ? nowIso : undefined
      })
    }).catch(() => {});
  } catch {}
}

export async function updateAlkostoOrderObservacion(id: string, nuevaObservacion: string): Promise<void> {
  const current = getLocalCache();
  const idx = current.findIndex(o => o.id === id);
  if (idx >= 0) {
    current[idx].observaciones = nuevaObservacion;
    current[idx].updatedAt = new Date().toISOString();
    setLocalCache([...current]);
  }

  try {
    const docRef = doc(db, ALKOSTO_COLLECTION, id);
    await updateDoc(docRef, {
      observaciones: nuevaObservacion,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn("Error actualizando observaciones en Firestore:", err);
  }
}

export async function deleteAlkostoOrder(id: string): Promise<void> {
  const current = getLocalCache().filter(o => o.id !== id);
  setLocalCache(current);

  try {
    const docRef = doc(db, ALKOSTO_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn("Error eliminando pedido Alkosto en Firestore:", err);
  }
}

export async function parseAlkostoOrderImage(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<ParsedOrdenCompraAlkosto> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s de tolerancia para análisis exhaustivo de órdenes completas

  try {
    const response = await fetch('/api/alkosto/ocr-orden', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ imageBase64, mimeType }),
      signal: controller.signal
    });

    const responseText = await response.text();
    let result: any = null;
    try {
      result = JSON.parse(responseText);
    } catch {
      if (!response.ok) {
        throw new Error(`Error en servidor (${response.status}): El servidor no devolvió una respuesta JSON válida.`);
      }
      throw new Error('Respuesta del servidor no válida (formato no reconocido).');
    }

    if (!response.ok) {
      throw new Error(result?.error || result?.details || `Error al procesar la orden de compra (${response.status})`);
    }

    if (!result?.success || !result?.data) {
      throw new Error(result?.error || 'Respuesta incompleta del servidor OCR');
    }

    return result.data;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('El lector OCR excedió el tiempo límite (90s). Por favor reintenta con una imagen más nítida o liviana.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const SAMPLE_ALKOSTO_OC: ParsedOrdenCompraAlkosto | null = null;
export const SAMPLE_FAMILIA_CENTER_OC: ParsedOrdenCompraAlkosto | null = null;
