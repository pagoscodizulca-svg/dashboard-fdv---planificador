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
  matchExacto?: boolean;
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
  { codigo: '1592', descripcion: 'SALMON POR KILO' },
  { codigo: '1593', descripcion: 'NECTAR DE JUCOSA TB DURAZNO 12X1L' },
  { codigo: '1594', descripcion: 'NECTAR VARIADO 12X1L' },
  { codigo: '1595', descripcion: 'NECTAR JUCOSA TB PERA 12X1L' },
  { codigo: '1596', descripcion: 'HARINA POR KG' },
  { codigo: '1597', descripcion: 'PAN DE SANDWICH BLANCO E INTEGRAL POR PAQUETE' },
  { codigo: '1598', descripcion: 'PAN ARABE Y CASABE POR PAQUETE' },
  { codigo: '1599', descripcion: 'MORT. NAVIDEÑA SALPICAO X KG' },
  { codigo: '1600', descripcion: 'FS QUESO AMARILLO TIPO EDAM BARRA DE MI FINCA X KG' },
  { codigo: '1601', descripcion: 'BANDEJAS VARIAS REFERENCIAS CT1 / JT1' },
  { codigo: '1602', descripcion: 'QUESO MOZARELLA POR KG' },
  { codigo: '1603', descripcion: 'SALCHICHON POR KG' },
  { codigo: '1604', descripcion: 'SALAMI Y PEPERONI POR KG' },
  { codigo: '1605', descripcion: 'QUESO DE MANO POR KG' },
  { codigo: '1606', descripcion: 'QUESO GUAYANES - AMARILLO - PAISA POR KG' },
  { codigo: '1607', descripcion: 'PULPA DE CERDO POR KG' },
  { codigo: '1608', descripcion: 'QUESO BLANCO MOZZARELLA MI FINCA' },
  { codigo: '1609', descripcion: 'PESCADERIA (CAMARON,CALAMAR,MEJILLON,PULPO,PEPITONA,MERLUZA) POR KG' },
  { codigo: '1610', descripcion: 'CHAMPIÑONES Y ACEITUNAS NEGRAS' },
  { codigo: '1611', descripcion: 'PALMITO Y PEPINILLOS' },
  { codigo: '1612', descripcion: 'RICOTA SIN SAL, QUESO PALMITA POR KG' },
  { codigo: '1613', descripcion: 'FILET DE PECHUGA INDUST. LIGHT POR KG' },
  { codigo: '1614', descripcion: 'FILET DE PECHUGA A GRANEL TROPICAL POR KG' },
  { codigo: '1616', descripcion: 'PAN DE PERRO CALIENTE POR PAQUETE' },
  { codigo: '1617', descripcion: 'PAPAS RALLADAS PARA PERRO CALIENTE POR PAQUETE' },
  { codigo: '1618', descripcion: 'SERVILLETAS, TOALLIN Y LANILLA' },
  { codigo: '1619', descripcion: 'TE DE MANZANILLA Y FRUTOS ROJOS' },
  { codigo: '1620', descripcion: 'VINAGRE POR GALON' },
  { codigo: '1621', descripcion: 'QUESO DURO POR KG' },
  { codigo: '1622', descripcion: 'LECHE EN POLVO VENCAMPO 24X125GR' },
  { codigo: '1623', descripcion: 'MINI TOCINO ASTURIAS X POR KG' },
  { codigo: '1624', descripcion: 'MORT. ESP D/POLLO ASTURIAS 20X500GR' },
  { codigo: '1625', descripcion: 'MORTADELA ESP D/POLLO SALPICAO 20UNDX500GR' },
  { codigo: '1626', descripcion: 'CHOCOLATE OSCURO - BLANCO BITTER' },
  { codigo: '1627', descripcion: 'LLUVIA DE CHOCOLATE - LLUVIA DE COLORES - GOTAS DE CHOCOLATE' },
  { codigo: '1628', descripcion: 'VINO BLANCO - VINO TINTO POR LITRO' },
  { codigo: '1629', descripcion: 'LEVADURA, POLVO DE HORNEAR Y BICABORNATO DE SODIO POR KG' },
  { codigo: '1630', descripcion: 'PAN JUMBO DELI BLANCO - DELI OREGANO POR PAQ' },
  { codigo: '1631', descripcion: 'PAN CAPILLA POR UND' },
  { codigo: '1632', descripcion: 'PAN RALLADO POR KG' },
  { codigo: '1633', descripcion: 'CACAO Y CHOCOLATE EN POLVO POR KG' },
  { codigo: '1634', descripcion: 'TOMATE ENTERO PELADO POR LATA' },
  { codigo: '1635', descripcion: 'MAIZINA POR KG' },
  { codigo: '1636', descripcion: 'ESENCIAS VARIAS' },
  { codigo: '1637', descripcion: 'QUESO PARMESANO RALLADO POR KG' },
  { codigo: '1638', descripcion: 'QUESO PAISA POR KG' },
  { codigo: '1639', descripcion: 'SIERRA EN RUEDA Y PARGO ENTERO POR KG' },
  { codigo: '1640', descripcion: 'UTENSILIOS DE LIMPIEZA (CEPILLO, ESPONJA,GUANTES,GORROS,PAÑOS)' },
  { codigo: '1641', descripcion: 'QUIMICOS (CLORO, DESENGRASANTE,DESINFECTANTE,JABON)' },
  { codigo: '1642', descripcion: 'ARVEJAS VENCAMPO 25 UND X 400GR' },
  { codigo: '1643', descripcion: 'LOMO DE CERDO AHUM. SALPICAO POR KG' },
  { codigo: '1644', descripcion: 'CARAOTAS NEGRAS VENCAMPO 25 UND X 400GR' },
  { codigo: '1646', descripcion: 'ACEITE DE MAIZ POR LITRO' },
  { codigo: '1647', descripcion: 'TETERAS POR UND VARIAS REFERENCIAS' },
  { codigo: '1648', descripcion: 'MIEL POR LITRO' },
  { codigo: '1649', descripcion: 'LUMPIAS CONGELADAS POR UND' },
  { codigo: '1650', descripcion: 'CEREALES VARIOS POR UND' },
  { codigo: '1651', descripcion: 'SALSAS VARIAS REFERENCIAS POR UND' },
  { codigo: '1654', descripcion: 'PONCHE DE CREMA - RON AÑEJO - LECHE DE COCO' },
  { codigo: '1655', descripcion: 'AZUCAR VENPORT 1X20ND' },
  { codigo: '1659', descripcion: 'PUNTA TRASERA POR KG (UR)' },
  { codigo: '1660', descripcion: 'CARNE MOLIDA PICADO DE BOVINO XKG (UR)' },
  { codigo: '1661', descripcion: 'BIFE ANCHO RYBEYE (UR) POR KG' },
  { codigo: '1662', descripcion: 'CONFITERIA (TORONTO, BOLERO, TURRON, ETC)' }
];

/**
 * Mapa indexado de los productos oficiales por su código numérico.
 */
export const MAPA_PRODUCTOS_CODIZULCA = new Map<string, ProductoCodizulca>(
  PRODUCTOS_CODIZULCA.map(p => [p.codigo, { ...p, matchExacto: true }])
);

/**
 * Productos históricos numéricos complementarios de Codizulca presentes en órdenes de Alkosto
 * (ej. 1497 Mortadela Asturias 500gr y 047 Nuggets Del Corral 460gr).
 */
const PRODUCTOS_HISTORICOS_COMPLEMENTARIOS: Record<string, ProductoCodizulca> = {
  '1497': { codigo: '1497', descripcion: 'MORTADELA ESP D/POLLO ASTURIAS 20UNDX500GR', matchExacto: true },
  '047': { codigo: '047', descripcion: 'NUGGET CORRAL DE 460GM', matchExacto: true },
  '47': { codigo: '047', descripcion: 'NUGGET CORRAL DE 460GM', matchExacto: true },
  '270': { codigo: '270', descripcion: 'NUGGETS CORRAL 12X0.460GR', matchExacto: true },
  '1599': { codigo: '1599', descripcion: 'MORT. NAVIDEÑA SALPICAO X KG', matchExacto: true }
};

/**
 * Homologación directa de códigos de barras EAN-13 y PLUs internos de Alkosto / Familia Center
 * hacia el código numérico y descripción oficial de Codizulca.
 */
const HOMOLOGACION_EAN_PLU_ALKOSTO: Record<string, ProductoCodizulca> = {
  '7590377000411': { codigo: '1642', descripcion: 'ARVEJAS VENCAMPO 25 UND X 400GR', matchExacto: true },
  '7590377000459': { codigo: '1644', descripcion: 'CARAOTAS NEGRAS VENCAMPO 25 UND X 400GR', matchExacto: true },
  '7590377000503': { codigo: '1574', descripcion: 'LECHE EN POLVO VENCAMPO 10X400GR', matchExacto: true },
  '7590377000510': { codigo: '1556', descripcion: 'LECHE EN POLVO VENCAMPO 10X900GR', matchExacto: true },
  '7590377000077': { codigo: '1496', descripcion: 'MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR', matchExacto: true },
  '7590377000589': { codigo: '1497', descripcion: 'MORTADELA ESP D/POLLO ASTURIAS 20UNDX500GR', matchExacto: true },
  '7591289609129': { codigo: '21', descripcion: 'MORTADELA ESP D/POLLO CORRAL 1X12UNI', matchExacto: true },
  '7591289400023': { codigo: '047', descripcion: 'NUGGET CORRAL DE 460GM', matchExacto: true },
  '5412873178161': { codigo: '1360', descripcion: 'PATATAS FRESCAS MARQUISE 4X2.5KG', matchExacto: true },
  '7591210000513': { codigo: '1091', descripcion: 'CREMA DE LECHE PURISIMA 6 X 500 GRS', matchExacto: true },
  '7591210000544': { codigo: '1089', descripcion: 'CREMA DE LECHE PURISIMA 12X250GRS', matchExacto: true },
  '021000061778': { codigo: '1577', descripcion: 'QUESO CREMA KRAFT 226 GR X 36 UND', matchExacto: true },
  '21000061778': { codigo: '1577', descripcion: 'QUESO CREMA KRAFT 226 GR X 36 UND', matchExacto: true },
  '100881': { codigo: '1512', descripcion: 'MORT DE PAVO ASTURIAS X KG', matchExacto: true },
  '100882': { codigo: '1511', descripcion: 'MORT. PECHUGA DE POLLO ASTURIAS X KG', matchExacto: true },
  '100929': { codigo: '1463', descripcion: 'MORT. SUPERIOR ASTURIAS X KG', matchExacto: true },
  '100281': { codigo: '1575', descripcion: 'QUESO MOZZARELLA CORLASA 3.5KG X 4 UND', matchExacto: true },
  '100253': { codigo: '46', descripcion: 'NUGGETS INSTITUCIONAL CORRAL POR KG', matchExacto: true }
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
    // Sanitizar artefactos OCR de Alkosto donde el punto decimal se extrae como dos puntos (ej. "15:00" -> "15.00", "0:00" -> "0.00")
    .replace(/(\d+):(\d{2})\b/g, '$1.$2')
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
 * Tokens de marcas comerciales y presentaciones/gramajes que NUNCA pueden usarse por sí solos
 * para declarar una coincidencia de SKU si el sustantivo principal del producto no coincide.
 */
const BRAND_AND_GENERIC_TOKENS = new Set<string>([
  'VENCAMPO',
  'VENPORT',
  'PURISIMA',
  'ASTURIAS',
  'ASTURIA',
  'SALPICAO',
  'CORRAL',
  'MARQUISE',
  'CORLASA',
  'KRAFT',
  'FINCA',
  'JUCOSA',
  'SIMON',
  'SAN',
  'MONTANA',
  'TORONDOY',
  'FRESCAMPO',
  'AURORA',
  'PRADERA',
  'VALLE',
  'HONDO',
  'FLORA',
  'DONA',
  'DOÑA',
  'TROPICAL',
  'DELI',
  'JUMBO',
  'COMPLETA',
  'ESPECIAL',
  'ESP',
  'SUPERIOR',
  'EXTRA',
  'ESTANDAR',
  'ECONOM',
  'ECONOMICA',
  'INSTITUCIONAL',
  'INDUSTRIAL',
  'INDUST',
  'BLANCO',
  'BLANCA',
  'BLANCAS',
  'NEGRO',
  'NEGRA',
  'NEGRAS',
  'NEG',
  'VERDE',
  'VERDES',
  'ROJO',
  'ROJA',
  'ROJAS',
  'AMARILLO',
  'AMARILLA'
]);

/**
 * Determina si un token corresponde únicamente a una marca comercial, color/adjetivo secundario
 * o especificación de peso/empaque (ej. "VENCAMPO", "400GR", "20X400GR", "1.00", "UND").
 */
export function isBrandOrPresentationToken(token: string): boolean {
  const clean = String(token || '').trim().toUpperCase().replace(/[().,/]/g, '');
  if (!clean) return true;
  if (BRAND_AND_GENERIC_TOKENS.has(clean)) return true;
  if (/^\d+(?:[.,]\d+)?$/.test(clean)) return true;
  if (/^(?:\d+(?:UND|UNI)?X)?\d+(?:[.,]\d+)?(?:KG|KGS|GR|GRS|GM|G|LT|LTS|LTRS|L|ML|ND|UND|UNI|PZA|PZAS)$/i.test(clean)) {
    return true;
  }
  if (/^(?:KG|KGS|KILO|KILOS|GR|GRS|GM|LT|LTS|LTRS|ML|UND|UNI|UNID|PZA|CJ|CJA|CAJA|BLT|BULTO|PAQ|PAQUETE|SACO|LATA|GALON|BOLSA|BARRA|GRANEL)$/i.test(clean)) {
    return true;
  }
  return false;
}

/**
 * Extrae el/los sustantivos principales (categoría/familia obligatoria del producto)
 * para prohibir coincidencias parciales solo por marca + gramaje (ej. prohibir que
 * "ARVEJAS VERDES VENCAMPO 400GR" o "CARAOTAS NEGRAS VENCAMPO 400GR" hagan match con
 * "LECHE EN POLVO VENCAMPO 20X400GR").
 */
export function extractPrimaryProductNouns(descRaw: string): string[] {
  if (!descRaw) return [];
  const d = normalizeEncodingEspeciales(descRaw).toUpperCase();
  const nouns: string[] = [];

  const rules: Array<[string, RegExp]> = [
    ['ARVEJAS', /\bARVEJAS?\b/],
    ['CARAOTAS', /\bCARAOTAS?\b/],
    ['LENTEJAS', /\bLENTEJAS?\b/],
    ['GARBANZOS', /\bGARBANZOS?\b/],
    ['FRIJOLES', /\bFRIJOL(?:ES)?\b/],
    ['MAIZ', /\bMAIZ\b/],
    ['MAIZINA', /\bMAIZINA\b/],
    ['AVENA', /\bAVENA\b/],
    ['CEBADA', /\bCEBADA\b/],
    ['CREMA_LECHE', /\bCREMA\s+DE\s+LECHE\b/],
    ['MORTADELA', /\bMORT(?:ADELA|ADELITA|\.)?\b/],
    ['QUESO', /\bQUESO\b/],
    ['RICOTA', /\bRICOTA\b/],
    ['PATATAS', /\b(?:PATATAS?|PAPAS?)\b/],
    ['NUGGET', /\bNUGGETS?\b/],
    ['ARROZ', /\bARROZ\b/],
    ['AZUCAR', /\bAZUCAR\b/],
    ['ACEITE', /\bACEITE\b/],
    ['HARINA', /\bHARINA\b/],
    ['PASTA', /\b(?:PASTA|FIDEOS?|ESPAGUETIS?)\b/],
    ['HUEVOS', /\bHUEVOS?\b/],
    ['JUGO', /\bJUGOS?\b/],
    ['NECTAR', /\bNECTAR\b/],
    ['REFRESCO', /\bREFRESCOS?\b/],
    ['AGUA', /\bAGUA\b/],
    ['TE', /\bTE\b/],
    ['VINO', /\bVINOS?\b/],
    ['PONCHE', /\bPONCHE\b/],
    ['MANTEQUILLA', /\bMANTEQUILLA\b/],
    ['MARGARINA', /\bMARGARINA\b/],
    ['MAYONESA', /\bMAYONESA\b/],
    ['KETCHUP', /\bKETCHUP\b/],
    ['MOSTAZA', /\bMOSTAZA\b/],
    ['SALSA', /\bSALSAS?\b/],
    ['VINAGRE', /\bVINAGRE\b/],
    ['MIEL', /\bMIEL\b/],
    ['ATUN', /\bATUN\b/],
    ['SALMON', /\bSALMON\b/],
    ['PESCADERIA', /\b(?:PESCADERIA|CAMARON|CALAMAR|MEJILLON|PULPO|MERLUZA|SIERRA|PARGO)\b/],
    ['JAMON', /\bJAMON\b/],
    ['ESPALDA', /\bESPAL(?:DA|\.)\b/],
    ['LOMO', /\bLOMO\b/],
    ['PULPA', /\bPULPA\b/],
    ['CARNE', /\bCARNE\b/],
    ['PUNTA', /\bPUNTA\b/],
    ['BIFE', /\bBIFE\b/],
    ['SALCHICHA', /\bSALCHICHAS?\b/],
    ['SALCHICHON', /\bSALCHICHON\b/],
    ['SALAMI', /\b(?:SALAMI|PEPERONI)\b/],
    ['CHORIZO', /\bCHORIZOS?\b/],
    ['TOCINETA', /\bTOCINETA\b/],
    ['TOCINO', /\bTOCINO\b/],
    ['CHULETA', /\bCHULETA\b/],
    ['CAJAS', /\bCAJAS?\b/],
    ['BANDEJA', /\bBANDEJAS?\b/],
    ['GALLINA', /\bGALLINA\b/],
    ['HIGADO', /\bHIGADO\b/],
    ['MOLLEJA', /\bMOLLEJAS?\b/],
    ['CAFE', /\bCAFE\b/],
    ['CACAO', /\bCACAO\b/],
    ['CHOCOLATE', /\bCHOCOLATE\b/],
    ['CONFITERIA', /\b(?:CONFITERIA|TORONTO|BOLERO|TURRON)\b/],
    ['CEREALES', /\bCEREAL(?:ES)?\b/],
    ['PAN', /\bPAN\b/],
    ['LUMPIAS', /\bLUMPIAS?\b/],
    ['TOMATE', /\bTOMATES?\b/],
    ['LEVADURA', /\bLEVADURA\b/],
    ['CHAMPINONES', /\bCHAMPI[ÑN]ONES?\b/],
    ['PALMITO', /\bPALMITOS?\b/],
    ['SERVILLETAS', /\b(?:SERVILLETAS?|TOALLIN)\b/],
    ['UTENSILIOS', /\bUTENSILIOS?\b/],
    ['QUIMICOS', /\b(?:QUIMICOS?|CLORO|DESENGRASANTE|DESINFECTANTE)\b/],
    ['TETERAS', /\bTETERAS?\b/],
    ['ESENCIAS', /\bESENCIAS?\b/]
  ];

  for (const [key, regex] of rules) {
    if (regex.test(d)) {
      nouns.push(key);
    }
  }

  // LECHE solo cuando no es "CREMA DE LECHE" ni "LECHE DE COCO"
  if (/\bLECHE\b/.test(d) && !/\bCREMA\s+DE\s+LECHE\b/.test(d) && !/\bLECHE\s+DE\s+COCO\b/.test(d)) {
    nouns.push('LECHE');
  }

  // PECHUGA, MUSLO, ALAS, POLLO solo cuando no es un calificador secundario de MORTADELA ("MORTADELA D/POLLO")
  if (!nouns.includes('MORTADELA')) {
    if (/\bPECHUGA\b|\bFILET(?:E)?\b/.test(d)) nouns.push('PECHUGA');
    if (/\bMUSLO\b|\bCUADRIL\b/.test(d)) nouns.push('MUSLO');
    if (/\bALAS\b/.test(d)) nouns.push('ALAS');
    if (/\bPOLLO\b/.test(d) && !nouns.includes('PECHUGA')) nouns.push('POLLO');
  }

  // Si ningún sustantivo canónico hizo match (ej. producto nuevo en PDF no registrado en rules),
  // extraer el primer token sustantivo significativo que no sea marca, preposición ni gramaje.
  if (nouns.length === 0) {
    const stopWords = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'EN', 'CON', 'POR', 'PARA', 'TIPO', 'SIN', 'FS', 'UR']);
    const tokens = d
      .replace(/\s*\/\s*\d+(?:[.,]\d+)?\s*$/, '')
      .replace(/[()/.,\-]/g, ' ')
      .split(/\s+/)
      .map(t => t.trim())
      .filter(t => t.length >= 3 && !stopWords.has(t) && !isBrandOrPresentationToken(t));
    if (tokens.length > 0) {
      nouns.push(tokens[0]);
    }
  }

  return nouns;
}

/**
 * Devuelve `true` cuando existe conflicto de sustantivo principal entre el candidato del catálogo
 * y la descripción del documento (o cuando no comparten el sustantivo principal obligatorio).
 */
export function hasPrimaryNounConflict(candidateDesc: string, inputDesc: string): boolean {
  if (!inputDesc || !candidateDesc) return false;
  const inputNouns = extractPrimaryProductNouns(inputDesc);
  const candNouns = extractPrimaryProductNouns(candidateDesc);
  if (inputNouns.length === 0 || candNouns.length === 0) return true;
  return !inputNouns.some(n => candNouns.includes(n));
}

/**
 * Verifica si una descripción contradice explícitamente el gramaje o el sustantivo principal del código leído
 * (ej. cuando la IA asigna código 1555 [LECHE 20X400GR] a ARVEJAS 400GR, o 1580 [500GR] a 400GR).
 */
function hasExplicitGramajeConflict(candidate: ProductoCodizulca, descNorm: string): boolean {
  if (!descNorm) return false;
  if (hasPrimaryNounConflict(candidate.descripcion, descNorm)) {
    return true;
  }
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
  // Si el documento especifica un gramaje unitario fijo (ej. 400GR) y el candidato es venta por kilo ("POR KILO" / "X KG") sin gramaje unitario
  if (inputFeat.unitWeightGrams !== null && !inputFeat.isPerKg && candFeat.isPerKg && candFeat.unitWeightGrams === null) {
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

  const rawDescPreserved = normalizeEncodingEspeciales(String(descripcionLeida ?? ''))
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  const descNorm = rawDescPreserved
    .replace(/\s*\/\s*\d+(?:[.,]\d+)?\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  const isForbiddenAlpha = CODIGOS_ALFABETICOS_PROHIBIDOS.has(cleanCod);

  // 1. PRIORIDAD MÁXIMA: Coincidencia por Código EAN-13 / Barra o PLU interno de Alkosto / Familia Center
  if (!isForbiddenAlpha && cleanCod) {
    const byBarcodeOrPlu =
      HOMOLOGACION_EAN_PLU_ALKOSTO[cleanCod] ||
      HOMOLOGACION_EAN_PLU_ALKOSTO[cleanCodNoZeros];
    if (byBarcodeOrPlu && (!descNorm || !hasPrimaryNounConflict(byBarcodeOrPlu.descripcion, descNorm))) {
      return { ...byBarcodeOrPlu, matchExacto: true };
    }

    // 2. Coincidencia directa por SKU en el Mapa de productos oficiales (validando que no contradiga sustantivo ni gramaje)
    const exactCatalog =
      MAPA_PRODUCTOS_CODIZULCA.get(cleanCod) ||
      MAPA_PRODUCTOS_CODIZULCA.get(cleanCodNoZeros);
    if (exactCatalog && !hasExplicitGramajeConflict(exactCatalog, descNorm)) {
      return { ...exactCatalog, matchExacto: true };
    }

    // 3. Coincidencia en productos numéricos históricos complementarios (1497, 047, 270, 1599)
    const byHist =
      PRODUCTOS_HISTORICOS_COMPLEMENTARIOS[cleanCod] ||
      PRODUCTOS_HISTORICOS_COMPLEMENTARIOS[cleanCodNoZeros];
    if (byHist && !hasExplicitGramajeConflict(byHist, descNorm)) {
      return { ...byHist, matchExacto: true };
    }
  }

  // 4. Si el código leído es "LPV" o la descripción es explícitamente LECHE EN POLVO VENCAMPO:
  const inputNouns = extractPrimaryProductNouns(descNorm);
  const isLechePolvoVencampo =
    (cleanCod === 'LPV' && (inputNouns.length === 0 || inputNouns.includes('LECHE'))) ||
    (inputNouns.includes('LECHE') &&
      descNorm.includes('POLVO') &&
      !descNorm.includes('PURISIMA') &&
      (descNorm.includes('VENCAMPO') || descNorm.includes('400GR') || descNorm.includes('900GR') || descNorm.includes('10X')));

  if (isLechePolvoVencampo) {
    return { ...matchLecheVencampoByGramaje(descNorm), matchExacto: true };
  }

  // 5. Reglas de desambiguación rápida por siglas o familias frecuentes cuando coinciden con el sustantivo
  if (
    (cleanCod === 'UTH' || cleanCod === 'UHT' || (inputNouns.includes('LECHE') && (descNorm.includes('UHT') || descNorm.includes('UTH') || descNorm.includes('LIQUIDA')))) &&
    (inputNouns.length === 0 || inputNouns.includes('LECHE'))
  ) {
    if (descNorm.includes('DESCREMADA')) return { ...MAPA_PRODUCTOS_CODIZULCA.get('180')!, matchExacto: true };
    if (descNorm.includes('DESLACTOSADA')) return { ...MAPA_PRODUCTOS_CODIZULCA.get('242')!, matchExacto: true };
    if (descNorm.includes('BARISTA')) return { ...MAPA_PRODUCTOS_CODIZULCA.get('1268')!, matchExacto: true };
    return { ...MAPA_PRODUCTOS_CODIZULCA.get('179')!, matchExacto: true };
  }

  if (cleanCod === 'QS' && (inputNouns.length === 0 || inputNouns.includes('QUESO'))) {
    if (descNorm.includes('MI FINCA') || descNorm.includes('EDAM')) return { ...MAPA_PRODUCTOS_CODIZULCA.get('1591')!, matchExacto: true };
    return { ...MAPA_PRODUCTOS_CODIZULCA.get('1057')!, matchExacto: true };
  }

  if (cleanCod === 'JUGOS' && (inputNouns.length === 0 || inputNouns.includes('JUGO'))) {
    if (descNorm.includes('PASTERIZADO') || descNorm.includes('250ML')) return { ...MAPA_PRODUCTOS_CODIZULCA.get('1587')!, matchExacto: true };
    if (descNorm.includes('200ML')) return { ...MAPA_PRODUCTOS_CODIZULCA.get('1098')!, matchExacto: true };
    return { ...MAPA_PRODUCTOS_CODIZULCA.get('181')!, matchExacto: true };
  }

  // 6. Búsqueda semántica ESTRICTA con coincidencia obligatoria de sustantivo principal + gramaje
  if (descNorm) {
    // 6.1 Coincidencia exacta de descripción
    const exactDesc = PRODUCTOS_CODIZULCA.find(p => p.descripcion.toUpperCase() === descNorm);
    if (exactDesc) return { ...exactDesc, matchExacto: true };

    // Casos especiales de descripciones de Alkosto hacia códigos oficiales
    if (inputNouns.includes('MORTADELA') && descNorm.includes('ASTURIA') && (descNorm.includes('500GR') || descNorm.includes('20UNDX500') || descNorm.includes('20X500'))) {
      return { ...(MAPA_PRODUCTOS_CODIZULCA.get('1624') || PRODUCTOS_HISTORICOS_COMPLEMENTARIOS['1497']), matchExacto: true };
    }
    if (inputNouns.includes('NUGGET') && descNorm.includes('CORRAL') && (descNorm.includes('460') || descNorm.includes('462'))) {
      return { ...PRODUCTOS_HISTORICOS_COMPLEMENTARIOS['047'], matchExacto: true };
    }
    if (descNorm.includes('PECHUGA') && descNorm.includes('PAVO') && descNorm.includes('ASTURIA')) {
      return { ...MAPA_PRODUCTOS_CODIZULCA.get('1512')!, matchExacto: true };
    }
    if (descNorm.includes('PECHUGA') && descNorm.includes('POLLO') && descNorm.includes('ASTURIA')) {
      return { ...MAPA_PRODUCTOS_CODIZULCA.get('1511')!, matchExacto: true };
    }
    if (inputNouns.includes('PATATAS') && descNorm.includes('MARQUISE')) {
      return { ...MAPA_PRODUCTOS_CODIZULCA.get('1360')!, matchExacto: true };
    }
    if (inputNouns.includes('QUESO') && descNorm.includes('CORLASA') && !descNorm.includes('KG')) {
      return { ...MAPA_PRODUCTOS_CODIZULCA.get('1575')!, matchExacto: true };
    }

    const inputFeat = extractPresentationFeatures(descNorm);
    const stopWords = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'EN', 'CON', 'POR', 'PARA', 'TIPO', 'UND', 'UNI', 'GRS', 'GR']);
    const queryTokens = descNorm
      .replace(/[()/.,]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 2 && !stopWords.has(t));

    // Si la descripción no tiene ningún sustantivo principal reconocible en nuestro diccionario,
    // exigir al menos que la primera palabra significativa (sustantivo líder) coincida.
    const leadingNounToken = queryTokens[0] || '';

    let bestProduct: ProductoCodizulca | null = null;
    let bestScore = -Infinity;

    for (const candidate of PRODUCTOS_CODIZULCA) {
      const candDesc = candidate.descripcion.toUpperCase();

      // REGLA ESTRICTA 1: Coincidencia obligatoria del sustantivo principal del producto.
      // PROHIBIDO hacer match parcial solo por marca ("VENCAMPO") + gramaje ("400GR").
      if (inputNouns.length > 0) {
        if (hasPrimaryNounConflict(candDesc, descNorm)) {
          continue;
        }
      } else if (leadingNounToken.length >= 4 && !candDesc.includes(leadingNounToken)) {
        continue;
      }

      // REGLA ESTRICTA 2: Prohibido asignar un producto si su gramaje/presentación contradice explícitamente al PDF
      if (hasExplicitGramajeConflict(candidate, descNorm)) {
        continue;
      }

      const candFeat = extractPresentationFeatures(candDesc);
      let score = 180; // Base por coincidencia de sustantivo principal obligatorio

      // Inclusión de frase completa
      if (candDesc.includes(descNorm) || descNorm.includes(candDesc)) {
        score += 300;
      }

      // Evaluación de presentación / gramaje (10X1KG, 10X900GR, 25UNDX400GR, 10X400GR, 10X500GR, 1X12LTRS, X KG)
      if (inputFeat.packWeight && candFeat.packWeight && inputFeat.packWeight === candFeat.packWeight) {
        score += 260;
      }

      if (inputFeat.unitWeightGrams !== null && candFeat.unitWeightGrams !== null && inputFeat.unitWeightGrams === candFeat.unitWeightGrams) {
        score += 160;
      }

      if (inputFeat.isPerKg && candFeat.isPerKg) {
        score += 80;
      }

      // Coincidencia de tokens adicionales (marca, variedad, etc.)
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
        } else if (token === 'NEGRAS' && candDesc.includes('NEG.')) {
          matchedTokens++;
          score += 65;
        }
      }

      if (matchedTokens > 0 && score > bestScore) {
        bestScore = score;
        bestProduct = candidate;
      }
    }

    if (bestProduct && bestScore >= 220) {
      return { ...bestProduct, matchExacto: true };
    }
  }

  // Fallback seguro SIN ALUCINACIÓN:
  // Si el producto del PDF no tiene coincidencia exacta de sustantivo o EAN en el catálogo,
  // conserva la descripción original del PDF (ej. "ARVEJAS VERDES VENCAMPO 400GR/1.00") y marca
  // el SKU como editable/pendiente ("PENDIENTE") en vez de sobreescribirlo con 1555 o 1536.
  const isUnmatchedBarcode = /^\d{8,14}$/.test(cleanCod);
  const fallbackCodigo = !isForbiddenAlpha && cleanCod && !isUnmatchedBarcode ? cleanCod : 'PENDIENTE';
  const fallbackDescripcion = rawDescPreserved || descNorm || 'PRODUCTO POR HOMOLOGAR (EDITAR SKU)';
  return {
    codigo: fallbackCodigo,
    descripcion: fallbackDescripcion,
    matchExacto: false
  };
}

/**
 * Formatea los 158 productos oficiales (`codigo - descripcion`) para inyectarlos en el System Prompt de Gemini (PASO 3).
 */
export function formatCatalogoCodizulcaForPrompt(): string {
  return PRODUCTOS_CODIZULCA.map(p => `${p.codigo} - ${p.descripcion}`).join('\n');
}
