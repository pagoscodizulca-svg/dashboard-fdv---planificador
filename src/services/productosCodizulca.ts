/**
 * ============================================================================
 * MAESTRO OFICIAL DE PRODUCTOS CODIZULCA (158 ÍTEMS - Data de productos.csv)
 * ============================================================================
 *
 * Catálogo oficial obligatorio (158 productos desde el código 9 hasta el 1592),
 * codificación normalizada UTF-8 (corrigiendo caracteres especiales Ñ en
 * DOÑA FLORA y NAVIDEÑA) y motor determinista de homologación semántica/gramaje
 * `matchProductoCodizulca` + limpiador numérico `toSafeNumber`.
 */

export interface ProductoCodizulca {
  codigo: string;
  descripcion: string;
}

/**
 * Los 158 productos oficiales de `Data de productos.csv` (del código 9 al 1592).
 */
export const PRODUCTOS_CODIZULCA: ProductoCodizulca[] = [
  { codigo: '9', descripcion: 'FILETE DE PECHUGA A GRANEL POR KG' },
  { codigo: '21', descripcion: 'MORTADELA ESP D/POLLO CORRAL 1X12UNI' },
  { codigo: '28', descripcion: 'HUEVOS DE CONSUMO TUNAL TIPO A 1X12UNI' },
  { codigo: '46', descripcion: 'NUGGETS INSTITUCIONAL CORRAL POR KG' },
  { codigo: '73', descripcion: 'GALLINA DESNUDA POR KG' },
  { codigo: '75', descripcion: 'PECHUGA CON HUESO POR KG' },
  { codigo: '96', descripcion: 'QUESO MOZZARELLA ESPECIAL EL LUCERO (E)' },
  { codigo: '130', descripcion: 'POLLO CORRAL POR KG' },
  { codigo: '151', descripcion: 'QUESO MOZARELLA EN BARRA DOÑA FLORA' },
  { codigo: '170', descripcion: 'TOCINETA AHUM S/CUERO ALIMEX X KG' },
  { codigo: '171', descripcion: 'JAMON COC. SUPERIOR ALIMEX 1X5.9KG' },
  { codigo: '172', descripcion: 'ESPALDA COCIDA ALIMEX 1X4.6KG' },
  { codigo: '174', descripcion: 'MORTADELA TAPARA ALIMEX DE 6X3.5KG' },
  { codigo: '176', descripcion: 'SALCHICHA VIENA ALIMEX 8 X 800 GRS' },
  { codigo: '177', descripcion: 'SALCHICHA VIENA ALIMEX 16 X 450 GRS' },
  { codigo: '179', descripcion: 'LECHE COMPLETA PURISIMA1X12LTRS' },
  { codigo: '180', descripcion: 'LECHE DESCREMADA PURISIMA1X12LTS' },
  { codigo: '181', descripcion: 'JUGO DE NARANJA EL TUNAL 1X12LTRS' },
  { codigo: '182', descripcion: 'NECTAR DE MANZANA EL TUNAL 1X12LTRS' },
  { codigo: '183', descripcion: 'NECTAR DE PERA EL TUNAL 1X12LTRS' },
  { codigo: '184', descripcion: 'NECTAR DE DURAZNO EL TUNAL 1X12LTRS' },
  { codigo: '185', descripcion: 'TE CON LIMON EL TUNAL 1X12LTRS' },
  { codigo: '186', descripcion: 'TE CON DURAZNO EL TUNAL 1X12LTRS' },
  { codigo: '241', descripcion: 'ESPAL. AHUM T/VISKING ALIMEX 6X3.2' },
  { codigo: '242', descripcion: 'LECHE DESLACTOSADA PURISIMA1X12LT' },
  { codigo: '302', descripcion: 'MANTEQUILLA CON SAL PURISIMA BARRA 18X200GR' },
  { codigo: '306', descripcion: 'ATUN NATURAL 24X170GRS' },
  { codigo: '337', descripcion: 'JAMON COCIDO ESTANDAR ITALICO X KG' },
  { codigo: '340', descripcion: 'CHULETA AHUMADA ALIMEX X KG' },
  { codigo: '353', descripcion: 'MAYONESA MAVESA 445 GRS X 12 UND' },
  { codigo: '354', descripcion: 'MARGARINA MAVESA 500 GRS X 12 UND' },
  { codigo: '360', descripcion: 'KETCHUP PAMPERO 397 GRS X 24 UND' },
  { codigo: '364', descripcion: 'MAVESA VINAGRE DE ALCOHOL 1LX12UND' },
  { codigo: '388', descripcion: 'MAVESA ADEREZO MAYONESA 3.6GX4UN' },
  { codigo: '390', descripcion: 'PAMPERO SALSA TOMATE 4.2KGX4UN' },
  { codigo: '393', descripcion: 'MOLLEJA (EMPACADA)' },
  { codigo: '439', descripcion: 'ESPAL AHUM.T/AREPERO ALIMEX 12X1,6KG' },
  { codigo: '469', descripcion: 'HUEVOS ESTUCH. PLAST. TUNAL 12 X 30' },
  { codigo: '485', descripcion: 'PAP. ALUM DOMESTICO 7M 1X30' },
  { codigo: '518', descripcion: 'PASTA PREMIUM TIPO VERMICELLI 12X1KG' },
  { codigo: '629', descripcion: 'MUSLO CUADRIL DESPRESADO POR KG' },
  { codigo: '630', descripcion: 'ALAS DESPRESADAS POR KG' },
  { codigo: '631', descripcion: 'FILET FRESCO DESPRESADO POR KG (E)' },
  { codigo: '632', descripcion: 'CARCASA DESPRESADA POR KG' },
  { codigo: '642', descripcion: 'QUESO PARMESANO X KG' },
  { codigo: '681', descripcion: 'FILET EN BOLSA CONG DESPRESADO POR KG' },
  { codigo: '687', descripcion: 'CUADRIL DESPRESADO POR KG' },
  { codigo: '688', descripcion: 'PIERNITAS DESPRESADA POR KG' },
  { codigo: '690', descripcion: 'MUSLO A GRANEL DESPRESADO' },
  { codigo: '693', descripcion: 'FILET DE MUSLO DESPRESADO POR KG' },
  { codigo: '699', descripcion: 'MUSLO DESPRESADO EN BANDEJA' },
  { codigo: '700', descripcion: 'ALAS DESPRESADAS EN BANDEJA' },
  { codigo: '829', descripcion: 'FILETE DE PECHUGA PROAGRO A GRANEL 5 KG' },
  { codigo: '860', descripcion: 'SALCHICHAS VIENA ALIMEX 32 X 225GRS' },
  { codigo: '870', descripcion: 'HIGADO (EMPACADO)' },
  { codigo: '922', descripcion: 'HUEVOS DE CONSUMO TUNAL TIPO B 1X12UNI' },
  { codigo: '927', descripcion: 'MORTADELA ESP. CARACAS 10X900GRS' },
  { codigo: '934', descripcion: 'PULPA DE CERDO DEPOSTADA' },
  { codigo: '952', descripcion: 'HUEVOS DE CONSUMO CLASE B 1X12 UND' },
  { codigo: '973', descripcion: 'HARINA DE MAIZ 1X20UNID' },
  { codigo: '979', descripcion: 'HUEVOS DE CONSUMO CLASE A 1X12UNID' },
  { codigo: '993', descripcion: 'HUEVOS CONSUMO EXTRA TUNAL 1X12UNI' },
  { codigo: '995', descripcion: 'ESPAL. AHUM T/VISKING ITALICO 6UNDX3.2KG' },
  { codigo: '1051', descripcion: 'MORTADELA ESP. CARACAS 10X500GRS' },
  { codigo: '1057', descripcion: 'QUESO AMARILLO ESPECIAL' },
  { codigo: '1088', descripcion: 'CHULETA FRESCA IBERICO POR KG' },
  { codigo: '1089', descripcion: 'CREMA DE LECHE PURISIMA 12X250GRS' },
  { codigo: '1091', descripcion: 'CREMA DE LECHE PURISIMA 6 X 500 GRS' },
  { codigo: '1094', descripcion: 'PASTA POR KG' },
  { codigo: '1098', descripcion: 'JUGO DE NARANJA EL TUNAL 27X200ML' },
  { codigo: '1099', descripcion: 'NECTAR DE MANZANA EL TUNAL 27X200ML' },
  { codigo: '1100', descripcion: 'NECTAR DE PERA EL TUNAL 27X200ML' },
  { codigo: '1103', descripcion: 'MANTEQUILLA SIN SAL PURISIMA 18X200GR' },
  { codigo: '1181', descripcion: 'NECTAR DE DURAZNO EL TUNAL 27X200ML' },
  { codigo: '1206', descripcion: 'ARROZ GLORIA CLASICO 24X1KG' },
  { codigo: '1241', descripcion: 'POLLO ENTERO JUAN POLLO POR KG' },
  { codigo: '1242', descripcion: 'MORT. CHORIZO ESPECIAL CDZ X KG' },
  { codigo: '1250', descripcion: 'NECTAR DE PERA EL TUNAL12 X 500ML' },
  { codigo: '1251', descripcion: 'NECTAR DE DURAZNO EL TUNAL 12 X 500ML' },
  { codigo: '1259', descripcion: 'MORTADELA T/ESPECIAL MAXI CARACAS 6UNDX3.3KG' },
  { codigo: '1264', descripcion: 'BANDEJA ECOTRAY NEGRA 1X100 UND' },
  { codigo: '1268', descripcion: 'LECHE BARISTA PURISIMA 1X12 LTRS' },
  { codigo: '1276', descripcion: 'FILET ESP. MILANESA SUPREMA POR KG' },
  { codigo: '1277', descripcion: 'MUSLO ESPECIAL SIN CADERA POR KG' },
  { codigo: '1311', descripcion: 'NECTAR DE MANZANA LIGHT EL TUNAL 1X12LTRS' },
  { codigo: '1312', descripcion: 'NECTAR DE PERA LIGHT EL TUNAL 1X12LTRS' },
  { codigo: '1314', descripcion: 'CREMA DE LECHE MONTE ADENTRO 32 X 250GR' },
  { codigo: '1326', descripcion: 'MOLLEJAS LOS LLANOS POR KG' },
  { codigo: '1334', descripcion: 'HIGADO (GRANEL) LOS LLANOS' },
  { codigo: '1342', descripcion: 'ARROZ GLORIA PREMIUM 24X900GR' },
  { codigo: '1343', descripcion: 'POLLO ESPECIAL DE 1RA LOS LLANOS (E)' },
  { codigo: '1360', descripcion: 'PATATAS FRESCAS MARQUISE 4X2.5KG' },
  { codigo: '1381', descripcion: 'HUEVOS ESTUCH PULPA EL TUNAL 15 X 20' },
  { codigo: '1397', descripcion: 'CARAOTAS POR KG' },
  { codigo: '1409', descripcion: 'FILET DE PECHUGA LOS LLANOS POR KG' },
  { codigo: '1419', descripcion: 'ACEITE DE SOYA DIANA 12X760ML' },
  { codigo: '1428', descripcion: 'FILET DE PECHUGA TIPO A CONGELADO POR KG' },
  { codigo: '1441', descripcion: 'PAN HPM BLANCO GLUTEN FREE 1KGX20UND' },
  { codigo: '1445', descripcion: 'TOCINO FRESCO ASTURIAS X KG' },
  { codigo: '1446', descripcion: 'CHULETA FRESCA ASTURIAS POR KG' },
  { codigo: '1461', descripcion: 'MORT ESTANDAR ASTURIAS X KG' },
  { codigo: '1462', descripcion: 'MORT. ESPECIAL COCIDA ASTURIAS X KG' },
  { codigo: '1463', descripcion: 'MORT. SUPERIOR ASTURIAS X KG' },
  { codigo: '1464', descripcion: 'MORT. NAVIDEÑA ASTURIAS XKG' },
  { codigo: '1477', descripcion: 'RECORTE DE CHARCUTERIA POR KG' },
  { codigo: '1478', descripcion: 'POLLO LLANERITO POR KG' },
  { codigo: '1479', descripcion: 'ACEITE DE SOYA DIANA 12X900ML' },
  { codigo: '1489', descripcion: 'AZUCAR REFINADA D CASTA 1KGX20UND' },
  { codigo: '1493', descripcion: 'GATORADE 500X12UND' },
  { codigo: '1494', descripcion: 'MORTADELA ESP D/POLLO LOS LLANOS 10UNDX900GR' },
  { codigo: '1496', descripcion: 'MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR' },
  { codigo: '1503', descripcion: 'CHURRASCO DE MUSLO POR KG' },
  { codigo: '1504', descripcion: 'CHUPETICA DE POLLO POR KG' },
  { codigo: '1507', descripcion: 'AZUCAR BLANCA ESPERANZA 1X20ND' },
  { codigo: '1511', descripcion: 'MORT. PECHUGA DE POLLO ASTURIAS X KG' },
  { codigo: '1512', descripcion: 'MORT DE PAVO ASTURIAS X KG' },
  { codigo: '1515', descripcion: 'LECHE POLVO COMPLETA PURISIMA 24X200GRS' },
  { codigo: '1516', descripcion: 'LECHE POLVO COMPLETA PURISIMA 24X400GR' },
  { codigo: '1517', descripcion: 'LECHE POLVO COMPLETA PURISIMA 12X900GRS' },
  { codigo: '1519', descripcion: 'MORTADELA ESP D/POLLO SALPICAO 10UNDX900GR' },
  { codigo: '1521', descripcion: 'MORT. ECONOM COCIDA ASTURIAS X KG' },
  { codigo: '1522', descripcion: 'MORT. TIPO AREPERO ASTURIAS X KG' },
  { codigo: '1524', descripcion: 'POLLO BRASA POR KG' },
  { codigo: '1526', descripcion: 'MORTADELITA ASTURIAS X BOLSA' },
  { codigo: '1536', descripcion: 'LECHE EN POLVO VENCAMPO 10X1KG' },
  { codigo: '1543', descripcion: 'AZUCAR BLANCA VENCAMPO 1X20ND' },
  { codigo: '1544', descripcion: 'LECHE EN POLVO VENCAMPO 20X500GR' },
  { codigo: '1549', descripcion: 'ARROZ BLANCO VENCAMPO 24X900GR' },
  { codigo: '1550', descripcion: 'AZUCAR BLANCA VENCAMPO 1X24ND' },
  { codigo: '1551', descripcion: 'ACEITE VENCAMPO 12X900ML' },
  { codigo: '1553', descripcion: 'ACEITE DE SOYA A GRANEL' },
  { codigo: '1555', descripcion: 'LECHE EN POLVO VENCAMPO 20X400GR' },
  { codigo: '1556', descripcion: 'LECHE EN POLVO VENCAMPO 10X900GR' },
  { codigo: '1561', descripcion: 'MORT. PAVO TIPO SHOULDER ASTURIAS POR KG' },
  { codigo: '1562', descripcion: 'MORT. ESPECIAL COCIDA SALPICAO X KG' },
  { codigo: '1563', descripcion: 'MORT. ESTANDAR SALPICAO X KG' },
  { codigo: '1564', descripcion: 'MORTADELA EXTRA ASTURIAS X KG' },
  { codigo: '1568', descripcion: 'POLLO VENCAMPO POR KG' },
  { codigo: '1569', descripcion: 'PATATAS FRESCAS DOBLE COBERTURA 4X2.5KG' },
  { codigo: '1571', descripcion: 'AZUCAR VENCAMPO 1X20ND' },
  { codigo: '1572', descripcion: 'CAJAS DE PIZZA 1X100' },
  { codigo: '1573', descripcion: 'ARVEJAS POR KILO' },
  { codigo: '1574', descripcion: 'LECHE EN POLVO VENCAMPO 10X400GR' },
  { codigo: '1575', descripcion: 'QUESO MOZZARELLA CORLASA 3.5KG X 4 UND' },
  { codigo: '1576', descripcion: 'QUESO CREMA KRAFT 1.36 KG X 6 UND' },
  { codigo: '1577', descripcion: 'QUESO CREMA KRAFT 226 GR X 36 UND' },
  { codigo: '1578', descripcion: 'ARROZ BLANCO VENCAMPO 24X1KG' },
  { codigo: '1579', descripcion: 'LECHE EN POLVO VENCAMPO 10X500GR' },
  { codigo: '1580', descripcion: 'CARAOTAS NEG. VENCAMPO 40X500GR' },
  { codigo: '1584', descripcion: 'REFRESCO 355ML X 16UND' },
  { codigo: '1585', descripcion: 'AGUA MINERAL 300ML X 24UND' },
  { codigo: '1586', descripcion: 'PAN DE HAMBURGUESA POR PAQUETE' },
  { codigo: '1587', descripcion: 'JUGO PASTERIZADO 250ML X 24UND' },
  { codigo: '1588', descripcion: 'REFRESCO 400ML X 15 UND' },
  { codigo: '1589', descripcion: 'QUESO PECORINO DE MI FINCA X KG' },
  { codigo: '1590', descripcion: 'QUESO PECORINO CON PIMIENTA DE MI FINCA X KG' },
  { codigo: '1591', descripcion: 'QUESO AMARILLO TIPO EDAM BARRA DE MI FINCA X KG' },
  { codigo: '1592', descripcion: 'SALMON POR KILO' }
];

/**
 * Mapa indexado de los 158 productos oficiales por su código numérico.
 */
export const MAPA_PRODUCTOS_CODIZULCA = new Map<string, ProductoCodizulca>(
  PRODUCTOS_CODIZULCA.map(p => [p.codigo, p])
);

/**
 * Productos históricos numéricos complementarios de Codizulca presentes en órdenes de Alkosto
 * (ej. 1497 Mortadela Asturias 500gr y 047 Nuggets Del Corral 460gr).
 */
const PRODUCTOS_HISTORICOS_COMPLEMENTARIOS: Record<string, ProductoCodizulca> = {
  '1497': { codigo: '1497', descripcion: 'MORTADELA ESP D/POLLO ASTURIAS 20UNDX500GR' },
  '047': { codigo: '047', descripcion: 'NUGGET CORRAL DE 460GM' },
  '47': { codigo: '047', descripcion: 'NUGGET CORRAL DE 460GM' },
  '270': { codigo: '270', descripcion: 'NUGGETS CORRAL 12X0.460GR' },
  '1599': { codigo: '1599', descripcion: 'MORT. NAVIDEÑA SALPICAO X KG' }
};

/**
 * Homologación directa de códigos de barras EAN-13 y PLUs internos de Alkosto / Familia Center
 * hacia el código numérico y descripción oficial de Codizulca.
 */
const HOMOLOGACION_EAN_PLU_ALKOSTO: Record<string, ProductoCodizulca> = {
  '7590377000503': { codigo: '1574', descripcion: 'LECHE EN POLVO VENCAMPO 10X400GR' },
  '7590377000510': { codigo: '1556', descripcion: 'LECHE EN POLVO VENCAMPO 10X900GR' },
  '7590377000077': { codigo: '1496', descripcion: 'MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR' },
  '7590377000589': { codigo: '1497', descripcion: 'MORTADELA ESP D/POLLO ASTURIAS 20UNDX500GR' },
  '7591289609129': { codigo: '21', descripcion: 'MORTADELA ESP D/POLLO CORRAL 1X12UNI' },
  '7591289400023': { codigo: '047', descripcion: 'NUGGET CORRAL DE 460GM' },
  '5412873178161': { codigo: '1360', descripcion: 'PATATAS FRESCAS MARQUISE 4X2.5KG' },
  '7591210000513': { codigo: '1091', descripcion: 'CREMA DE LECHE PURISIMA 6 X 500 GRS' },
  '7591210000544': { codigo: '1089', descripcion: 'CREMA DE LECHE PURISIMA 12X250GRS' },
  '021000061778': { codigo: '1577', descripcion: 'QUESO CREMA KRAFT 226 GR X 36 UND' },
  '21000061778': { codigo: '1577', descripcion: 'QUESO CREMA KRAFT 226 GR X 36 UND' },
  '100881': { codigo: '1512', descripcion: 'MORT DE PAVO ASTURIAS X KG' },
  '100882': { codigo: '1511', descripcion: 'MORT. PECHUGA DE POLLO ASTURIAS X KG' },
  '100929': { codigo: '1463', descripcion: 'MORT. SUPERIOR ASTURIAS X KG' },
  '100281': { codigo: '1575', descripcion: 'QUESO MOZZARELLA CORLASA 3.5KG X 4 UND' },
  '100253': { codigo: '46', descripcion: 'NUGGETS INSTITUCIONAL CORRAL POR KG' }
};

/**
 * Siglas alfabéticas inventadas o unidades de medida que NUNCA deben aceptarse como código de producto.
 */
const CODIGOS_ALFABETICOS_PROHIBIDOS = new Set<string>([
  'LPV',
  'UTH',
  'UHT',
  'QS',
  'JUGOS',
  'BEBIDAS',
  'POLLO',
  'FILET',
  'MUSLO',
  'ALAS',
  'QUESO',
  'ACEITE',
  'AZUCAR',
  'ARROZ',
  'HUEVOS',
  'PATATAS',
  'S/C',
  'SC',
  'S/N',
  'SN',
  'N/A',
  'NA',
  'NULL',
  'UNDEFINED',
  'NONE',
  'CJ',
  'CJA',
  'CAJA',
  'CAJAS',
  'BLT',
  'BTO',
  'BULTO',
  'BULTOS',
  'UND',
  'UNID',
  'UNIDAD',
  'UNIDADES',
  'KG',
  'KGS',
  'KILO',
  'KILOS'
]);

/**
 * Corrige problemas de codificación latin1 / ISO-8859-1 / mojibake en descripciones (ej. Ñ en DOÑA FLORA y NAVIDEÑA).
 */
export function normalizeEncodingEspeciales(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .replace(/Ã‘/g, 'Ñ')
    .replace(/Ã±/g, 'ñ')
    .replace(/\uFFFD/g, 'Ñ')
    .replace(/DO\?A\s+FLORA/gi, 'DOÑA FLORA')
    .replace(/NAVIDE\?A/gi, 'NAVIDEÑA');
}

/**
 * Decodifica un buffer o string en codificación `latin1` / `ISO-8859-1` o `UTF-8` hacia UTF-8 limpio.
 */
export function decodeLatin1ToUtf8(input: Uint8Array | ArrayBuffer | string): string {
  if (typeof input === 'string') {
    return normalizeEncodingEspeciales(input);
  }
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    return normalizeEncodingEspeciales(utf8Decoder.decode(bytes));
  } catch {
    const latin1Decoder = new TextDecoder('iso-8859-1');
    return normalizeEncodingEspeciales(latin1Decoder.decode(bytes));
  }
}

/**
 * Parsea el contenido de `Data de productos.csv` (separado por `;`) y devuelve la lista normalizada.
 */
export function parseProductosCodizulcaCsv(csvInput: Uint8Array | ArrayBuffer | string): ProductoCodizulca[] {
  const decoded = decodeLatin1ToUtf8(csvInput);
  const lines = decoded.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const result: ProductoCodizulca[] = [];

  for (const line of lines) {
    const sepIdx = line.indexOf(';');
    if (sepIdx === -1) continue;
    const rawCode = line.slice(0, sepIdx).trim();
    const rawDesc = normalizeEncodingEspeciales(line.slice(sepIdx + 1).trim()).toUpperCase();
    if (!rawCode || /^codigo$/i.test(rawCode)) continue;
    result.push({
      codigo: rawCode,
      descripcion: rawDesc
    });
  }
  return result;
}

/**
 * Función limpiadora de números `toSafeNumber(val)` (PASO 4):
 * Elimina símbolos (`$`, `Bs.`, `Bs`, `USD`, `%`, espacios) y normaliza separadores de miles y decimales
 * (tanto anglosajón `9,600.00` como venezolano `9.600,00` o 4 decimales `40.0000`) antes de operar.
 */
export function toSafeNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) && !Number.isNaN(val) ? val : fallback;
  }
  if (val === null || val === undefined) return fallback;

  let s = String(val)
    .trim()
    .replace(/(?:US\$|\$|Bs\.?|USD|VES|EUR|%)/gi, '')
    .replace(/\s+/g, '');

  if (!s) return fallback;

  // Caso ambos separadores '.' y ',' presentes
  if (s.includes('.') && s.includes(',')) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Formato venezolano/europeo: "1.250,50" -> "1250.50"
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato anglosajón: "1,250.50" -> "1250.50"
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // Si tiene múltiples comas o patrón de miles "1,200,000" vs decimal "40,50"
    if (/^-?\d{1,3}(,\d{3})+$/.test(s)) {
      // Cuidado: "1,250" con 3 dígitos tras coma puede ser miles si no es decimal corto,
      // pero en montos como "9,600" es 9600.
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
  } else if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length > 2) {
      s = parts.join('');
    }
  }

  const parsed = Number(s);
  return Number.isFinite(parsed) && !Number.isNaN(parsed) ? parsed : fallback;
}

/**
 * Extrae indicadores de presentación / gramaje de una descripción para desambiguar productos similares
 * (ej. `10X1KG`, `10X900GR`, `10X400GR`, `10X500GR`, `20X400GR`, `20X500GR`, `1X12LTRS`, `X KG`).
 */
function extractPresentationFeatures(descNorm: string): {
  packWeight: string | null;
  unitWeightGrams: number | null;
  packCount: number | null;
  isPerKg: boolean;
} {
  const compact = descNorm.replace(/\s+/g, '').replace(',', '.');

  // Patrón empaque x peso (ej. 10X1KG, 10X900GR, 10UNDX900GR, 24X400GR, 1X12LTRS, 6X3.5KG, 4X2.5KG)
  const packMatch = compact.match(/(\d+)(?:UND|UNI)?X(\d+(?:\.\d+)?)(KG|KGS|GR|GRS|GM|G|LT|LTS|LTRS|L|ML)\b/i);
  if (packMatch) {
    const count = parseInt(packMatch[1], 10);
    const rawVal = parseFloat(packMatch[2]);
    const unit = packMatch[3].toUpperCase();
    const grams =
      unit.startsWith('K') || unit.startsWith('L')
        ? Math.round(rawVal * 1000)
        : Math.round(rawVal);
    return {
      packWeight: `${count}X${grams}`,
      unitWeightGrams: grams,
      packCount: count,
      isPerKg: false
    };
  }

  // Patrón invertido peso x unidades (ej. 400GRX10, 3.5KGX4UND, 226GRX36UND, 500GRS X 12 UND)
  const invMatch = compact.match(/(\d+(?:\.\d+)?)(KG|KGS|GR|GRS|GM|G|LT|LTS|LTRS|L|ML)X(\d+)(?:UND|UNI|UN)?\b/i);
  if (invMatch) {
    const rawVal = parseFloat(invMatch[1]);
    const unit = invMatch[2].toUpperCase();
    const count = parseInt(invMatch[3], 10);
    const grams =
      unit.startsWith('K') || unit.startsWith('L')
        ? Math.round(rawVal * 1000)
        : Math.round(rawVal);
    return {
      packWeight: `${count}X${grams}`,
      unitWeightGrams: grams,
      packCount: count,
      isPerKg: false
    };
  }

  // Patrón peso unitario suelto (ej. 400GR, 400G, 900GR, 900G, 500GR, 500G, 250GR, 1KG, 2.5KG, 226GR)
  const singleWeightMatch = compact.match(/(?:^|[^0-9X])(\d+(?:\.\d+)?)(KG|KGS|GR|GRS|GM|G|ML)\b/i);
  if (singleWeightMatch) {
    const rawVal = parseFloat(singleWeightMatch[1]);
    const unit = singleWeightMatch[2].toUpperCase();
    const grams = unit.startsWith('K') ? Math.round(rawVal * 1000) : Math.round(rawVal);
    return {
      packWeight: null,
      unitWeightGrams: grams,
      packCount: null,
      isPerKg: false
    };
  }

  const isPerKg = /\b(?:X\s*KG|XKG|POR\s*KG|POR\s*KILO|A\s*GRANEL)\b/i.test(descNorm);
  return {
    packWeight: null,
    unitWeightGrams: null,
    packCount: null,
    isPerKg
  };
}

/**
 * Verifica si una descripción contradice explícitamente el gramaje del código leído
 * (ej. cuando la IA asigna código 1536 [10X1KG] pero la descripción dice 400GR o 900GR).
 */
function hasExplicitGramajeConflict(candidate: ProductoCodizulca, descNorm: string): boolean {
  if (!descNorm) return false;
  const inputFeat = extractPresentationFeatures(descNorm);
  const candFeat = extractPresentationFeatures(candidate.descripcion);

  if (inputFeat.packWeight && candFeat.packWeight && inputFeat.packWeight !== candFeat.packWeight) {
    return true;
  }
  if (
    inputFeat.unitWeightGrams !== null &&
    candFeat.unitWeightGrams !== null &&
    inputFeat.unitWeightGrams !== candFeat.unitWeightGrams
  ) {
    return true;
  }
  return false;
}

/**
 * Resuelve específicamente la familia de Leche en Polvo Vencampo según presentación/gramaje:
 * - 10X1KG / 1KG -> 1536 (`LECHE EN POLVO VENCAMPO 10X1KG`)
 * - 10X900GR / 900GR -> 1556 (`LECHE EN POLVO VENCAMPO 10X900GR`)
 * - 20X400GR -> 1555 (`LECHE EN POLVO VENCAMPO 20X400GR`)
 * - 10X400GR / 400GR -> 1574 (`LECHE EN POLVO VENCAMPO 10X400GR`)
 * - 20X500GR -> 1544 (`LECHE EN POLVO VENCAMPO 20X500GR`)
 * - 10X500GR / 500GR -> 1579 (`LECHE EN POLVO VENCAMPO 10X500GR`)
 */
function matchLecheVencampoByGramaje(descNorm: string): ProductoCodizulca {
  const feat = extractPresentationFeatures(descNorm);

  if (feat.packWeight === '20X400') return MAPA_PRODUCTOS_CODIZULCA.get('1555')!;
  if (feat.packWeight === '10X400') return MAPA_PRODUCTOS_CODIZULCA.get('1574')!;
  if (feat.packWeight === '20X500') return MAPA_PRODUCTOS_CODIZULCA.get('1544')!;
  if (feat.packWeight === '10X500') return MAPA_PRODUCTOS_CODIZULCA.get('1579')!;
  if (feat.packWeight === '10X900') return MAPA_PRODUCTOS_CODIZULCA.get('1556')!;
  if (feat.packWeight === '10X1000') return MAPA_PRODUCTOS_CODIZULCA.get('1536')!;

  if (feat.unitWeightGrams === 400) return MAPA_PRODUCTOS_CODIZULCA.get('1574')!;
  if (feat.unitWeightGrams === 900) return MAPA_PRODUCTOS_CODIZULCA.get('1556')!;
  if (feat.unitWeightGrams === 500) return MAPA_PRODUCTOS_CODIZULCA.get('1579')!;
  if (feat.unitWeightGrams === 1000) return MAPA_PRODUCTOS_CODIZULCA.get('1536')!;

  return MAPA_PRODUCTOS_CODIZULCA.get('1536')!;
}

/**
 * Función buscadora/homologadora determinista `matchProductoCodizulca(codigoLeido, descripcionLeida)` (PASO 2):
 * 1. Si `codigoLeido` existe en el mapa de los 158 productos (sin conflicto de gramaje), devuelve ese `codigo` exacto y la `descripcion` oficial del CSV.
 * 2. Si `codigoLeido` es un EAN-13 o PLU de cadena Alkosto/Familia Center conocido (ej. `7590377000503` -> `1574`, `7590377000510` -> `1556`), devuelve su producto oficial.
 * 3. Si no coincide o la IA devolvió una sigla inventada (como `"LPV"`), busca por similitud semántica/palabras clave y gramaje (`10X1KG`, `10X900GR`, `10X400GR`, `10X500GR`, `1X12LTRS`, `X KG`) dentro de los 158 productos para devolver SIEMPRE el código numérico real y la descripción oficial de Codizulca.
 */
export function matchProductoCodizulca(
  codigoLeido?: string | null,
  descripcionLeida?: string | null
): ProductoCodizulca {
  const rawCod = String(codigoLeido ?? '').trim();
  const cleanCod = rawCod.replace(/[\s\-_.]/g, '').toUpperCase();
  const cleanCodNoZeros = /^\d+$/.test(cleanCod) ? String(parseInt(cleanCod, 10)) : cleanCod;

  const descNorm = normalizeEncodingEspeciales(String(descripcionLeida ?? ''))
    .replace(/\s*\/\s*\d+(?:[.,]\d+)?\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  const isForbiddenAlpha = CODIGOS_ALFABETICOS_PROHIBIDOS.has(cleanCod);

  // 1. Si el código leído es "LPV" o la descripción es Leche en Polvo Vencampo (o Leche en Polvo Completa 400gr/900gr de Alkosto):
  const isLechePolvoVencampo =
    cleanCod === 'LPV' ||
    (descNorm.includes('LECHE') &&
      descNorm.includes('POLVO') &&
      !descNorm.includes('PURISIMA') &&
      (descNorm.includes('VENCAMPO') || descNorm.includes('400GR') || descNorm.includes('900GR') || descNorm.includes('10X')));

  if (isLechePolvoVencampo && cleanCod !== '7590377000503' && cleanCod !== '7590377000510') {
    if (MAPA_PRODUCTOS_CODIZULCA.has(cleanCodNoZeros)) {
      const candidate = MAPA_PRODUCTOS_CODIZULCA.get(cleanCodNoZeros)!;
      if (!hasExplicitGramajeConflict(candidate, descNorm)) {
        return candidate;
      }
    }
    return matchLecheVencampoByGramaje(descNorm);
  }

  // 2. Coincidencia directa en el Mapa de los 158 productos oficiales (si no es sigla prohibida)
  if (!isForbiddenAlpha && cleanCod) {
    const exact158 =
      MAPA_PRODUCTOS_CODIZULCA.get(cleanCod) ||
      MAPA_PRODUCTOS_CODIZULCA.get(cleanCodNoZeros);
    if (exact158 && !hasExplicitGramajeConflict(exact158, descNorm)) {
      return exact158;
    }

    // 3. Coincidencia por EAN-13 o PLU interno de Alkosto / Familia Center
    const byBarcodeOrPlu =
      HOMOLOGACION_EAN_PLU_ALKOSTO[cleanCod] ||
      HOMOLOGACION_EAN_PLU_ALKOSTO[cleanCodNoZeros];
    if (byBarcodeOrPlu) {
      return byBarcodeOrPlu;
    }

    // 4. Coincidencia en productos numéricos históricos complementarios (1497, 047, 270, 1599)
    const byHist =
      PRODUCTOS_HISTORICOS_COMPLEMENTARIOS[cleanCod] ||
      PRODUCTOS_HISTORICOS_COMPLEMENTARIOS[cleanCodNoZeros];
    if (byHist) {
      return byHist;
    }
  }

  // 5. Reglas de desambiguación rápida por siglas o familias frecuentes cuando no hubo match de código
  if (cleanCod === 'UTH' || cleanCod === 'UHT' || (descNorm.includes('LECHE') && (descNorm.includes('UHT') || descNorm.includes('UTH') || descNorm.includes('LIQUIDA')))) {
    if (descNorm.includes('DESCREMADA')) return MAPA_PRODUCTOS_CODIZULCA.get('180')!;
    if (descNorm.includes('DESLACTOSADA')) return MAPA_PRODUCTOS_CODIZULCA.get('242')!;
    if (descNorm.includes('BARISTA')) return MAPA_PRODUCTOS_CODIZULCA.get('1268')!;
    return MAPA_PRODUCTOS_CODIZULCA.get('179')!;
  }

  if (cleanCod === 'QS') {
    if (descNorm.includes('MI FINCA') || descNorm.includes('EDAM')) return MAPA_PRODUCTOS_CODIZULCA.get('1591')!;
    return MAPA_PRODUCTOS_CODIZULCA.get('1057')!;
  }

  if (cleanCod === 'JUGOS') {
    if (descNorm.includes('PASTERIZADO') || descNorm.includes('250ML')) return MAPA_PRODUCTOS_CODIZULCA.get('1587')!;
    if (descNorm.includes('200ML')) return MAPA_PRODUCTOS_CODIZULCA.get('1098')!;
    return MAPA_PRODUCTOS_CODIZULCA.get('181')!;
  }

  // 6. Búsqueda semántica por palabras clave y presentación/gramaje en los 158 productos oficiales
  if (descNorm) {
    // 6.1 Coincidencia exacta de descripción
    const exactDesc = PRODUCTOS_CODIZULCA.find(p => p.descripcion.toUpperCase() === descNorm);
    if (exactDesc) return exactDesc;

    // Casos especiales de descripciones de Alkosto hacia códigos oficiales
    if (descNorm.includes('MORTADELA') && descNorm.includes('ASTURIA') && (descNorm.includes('500GR') || descNorm.includes('20UNDX500'))) {
      return PRODUCTOS_HISTORICOS_COMPLEMENTARIOS['1497'];
    }
    if (descNorm.includes('NUGGET') && descNorm.includes('CORRAL') && (descNorm.includes('460') || descNorm.includes('462'))) {
      return PRODUCTOS_HISTORICOS_COMPLEMENTARIOS['047'];
    }
    if (descNorm.includes('PECHUGA') && descNorm.includes('PAVO') && descNorm.includes('ASTURIA')) {
      return MAPA_PRODUCTOS_CODIZULCA.get('1512')!;
    }
    if (descNorm.includes('PECHUGA') && descNorm.includes('POLLO') && descNorm.includes('ASTURIA')) {
      return MAPA_PRODUCTOS_CODIZULCA.get('1511')!;
    }
    if (descNorm.includes('PAPAS') && descNorm.includes('MARQUISE')) {
      return MAPA_PRODUCTOS_CODIZULCA.get('1360')!;
    }
    if (descNorm.includes('QUESO') && descNorm.includes('CORLASA')) {
      return MAPA_PRODUCTOS_CODIZULCA.get('1575')!;
    }

    const inputFeat = extractPresentationFeatures(descNorm);
    const stopWords = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'EN', 'CON', 'POR', 'PARA', 'TIPO', 'UND', 'UNI', 'GRS', 'GR']);
    const queryTokens = descNorm
      .replace(/[()/.,]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 2 && !stopWords.has(t));

    let bestProduct: ProductoCodizulca | null = null;
    let bestScore = -Infinity;

    for (const candidate of PRODUCTOS_CODIZULCA) {
      const candDesc = candidate.descripcion.toUpperCase();
      const candFeat = extractPresentationFeatures(candDesc);
      let score = 0;

      // Inclusión de frase completa
      if (candDesc.includes(descNorm) || descNorm.includes(candDesc)) {
        score += 300;
      }

      // Evaluación de presentación / gramaje (10X1KG, 10X900GR, 10X400GR, 10X500GR, 1X12LTRS, X KG)
      if (inputFeat.packWeight && candFeat.packWeight) {
        if (inputFeat.packWeight === candFeat.packWeight) {
          score += 260;
        } else {
          score -= 180;
        }
      }

      if (inputFeat.unitWeightGrams !== null && candFeat.unitWeightGrams !== null) {
        if (inputFeat.unitWeightGrams === candFeat.unitWeightGrams) {
          score += 160;
        } else {
          score -= 140;
        }
      }

      if (inputFeat.isPerKg && candFeat.isPerKg) {
        score += 80;
      } else if (inputFeat.isPerKg !== candFeat.isPerKg && (inputFeat.unitWeightGrams !== null || candFeat.unitWeightGrams !== null)) {
        score -= 40;
      }

      // Coincidencia de tokens
      let matchedTokens = 0;
      for (const token of queryTokens) {
        if (candDesc.includes(token)) {
          matchedTokens++;
          score += token.length >= 5 ? 65 : 40;
        } else if (token === 'MOZZARELLA' && candDesc.includes('MOZARELLA')) {
          matchedTokens++;
          score += 65;
        } else if (token === 'MOZARELLA' && candDesc.includes('MOZZARELLA')) {
          matchedTokens++;
          score += 65;
        } else if (token === 'MORTADELA' && candDesc.includes('MORT')) {
          matchedTokens++;
          score += 55;
        } else if (token === 'PAPAS' && candDesc.includes('PATATAS')) {
          matchedTokens++;
          score += 65;
        }
      }

      if (matchedTokens > 0 && score > bestScore) {
        bestScore = score;
        bestProduct = candidate;
      }
    }

    if (bestProduct && bestScore >= 45) {
      return bestProduct;
    }
  }

  // Fallback seguro si el documento trae un código numérico no catalogado y descripción explícita
  if (!isForbiddenAlpha && /^\d+$/.test(cleanCod) && descNorm) {
    return {
      codigo: cleanCod,
      descripcion: descNorm
    };
  }

  return MAPA_PRODUCTOS_CODIZULCA.get('1536')!;
}

/**
 * Formatea los 158 productos oficiales (`codigo - descripcion`) para inyectarlos en el System Prompt de Gemini (PASO 3).
 */
export function formatCatalogoCodizulcaForPrompt(): string {
  return PRODUCTOS_CODIZULCA.map(p => `${p.codigo} - ${p.descripcion}`).join('\n');
}
