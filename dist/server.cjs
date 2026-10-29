var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  authenticateToken: () => authenticateToken,
  metasPeriodoActual: () => metasPeriodoActual,
  rateLimiter: () => rateLimiter,
  requireAdmin: () => requireAdmin
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_zlib = __toESM(require("zlib"), 1);
var import_vite = require("vite");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_genai = require("@google/genai");

// src/services/alkostoService.ts
var import_firestore2 = require("firebase/firestore");

// src/lib/firebase.ts
var import_app = require("firebase/app");
var import_auth = require("firebase/auth");
var import_firestore = require("firebase/firestore");

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "gen-lang-client-0359272213",
  appId: "1:959955873018:web:26b1ca2f9fac2d4db32d43",
  apiKey: "AIzaSyAoSSmvp7Wtsef5zlQQOArtUq3D4Xk3FkM",
  authDomain: "gen-lang-client-0359272213.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-dashboardfdvplan-b71166f0-11d2-4bf0-8a16-d3a8accb0022",
  storageBucket: "gen-lang-client-0359272213.firebasestorage.app",
  messagingSenderId: "959955873018",
  measurementId: "",
  oAuthClientId: "959955873018-sdmf2r8vjhcsclcj1f9jsjuv1uqc0erj.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// src/lib/firebase.ts
var app = !(0, import_app.getApps)().length ? (0, import_app.initializeApp)(firebase_applet_config_default) : (0, import_app.getApp)();
var db = (0, import_firestore.getFirestore)(app, firebase_applet_config_default.firestoreDatabaseId);
var auth = (0, import_auth.getAuth)(app);

// src/services/alkostoService.ts
var SUCURSALES_ALKOSTO = [
  { codigo: "7498", tag: "AK01", nombre: "Alkosto 1 san Felipe", zona: "san Felipe", direccion: "Direcci\xF3n de despacho; calle 98 CC san Felipe 1 nivel PB sector casco central." },
  { codigo: "7499", tag: "AK02", nombre: "Alkosto 2 - Plaza baral", zona: "Plaza baral", direccion: "Plaza baral" },
  { codigo: "7497", tag: "AK03", nombre: "Alkosto 3 - Delicias", zona: "Delicias", direccion: "Delicias" },
  { codigo: "7500", tag: "AK04", nombre: "Alkosto 4 - Coromoto", zona: "Coromoto", direccion: "Coromoto" },
  { codigo: "7502", tag: "AK05", nombre: "Alkosto 5 - Cabimas", zona: "Cabimas", direccion: "Cabimas" },
  { codigo: "7503", tag: "AK06", nombre: "Alkosto 6 - Los cactu", zona: "Los cactu", direccion: "Los cactu" },
  { codigo: "7680", tag: "AK07", nombre: "Alkosto 7 - Bella vista", zona: "Bella vista", direccion: "Bella vista" },
  { codigo: "7905", tag: "AK08", nombre: "Alkosto 8 - Trujillo", zona: "Trujillo", direccion: "Trujillo" },
  { codigo: "8160", tag: "AK09", nombre: "Alkosto 9 - Antiguo nasa Zona industrial", zona: "Antiguo nasa Zona industrial", direccion: "Antiguo nasa Zona industrial" },
  { codigo: "8306", tag: "AK10", nombre: "Alkosto 10 - La limpia", zona: "La limpia", direccion: "La limpia" }
];
var SUCURSALES_FAMILIA_CENTER = [
  { codigo: "7490", tag: "FC01", nombre: "Familia Center 1 - Plaza lago", zona: "Plaza lago", direccion: "Plaza lago" },
  { codigo: "7492", tag: "FC02", nombre: "Familia Center 2", zona: "URB monte claro", direccion: "Calle43entre Av 150 416N\xB015-041 URB monte claro" },
  { codigo: "7494", tag: "FC03", nombre: "Familia Center 3", zona: "Parroquia Coquivacoa", direccion: "CalleJ con Av 12 distinguido bajo el NJ-10 de nomenclatura municipal en jurisdicci\xF3n parroquia coquivacoa el municipio aut\xF3nomo Maracaibo estado Zulia." },
  { codigo: "7491", tag: "FC04", nombre: "Familia 4 - Dr quintero", zona: "Dr quintero", direccion: "Dr quintero" },
  { codigo: "7489", tag: "FC05", nombre: "Familia Center 5 - La lago", zona: "La lago", direccion: "La lago" },
  { codigo: "7493", tag: "FC06", nombre: "Familia 6 - Los olivos", zona: "Los olivos", direccion: "Los olivos" },
  { codigo: "8229", tag: "FC07", nombre: "Familia Center #7 - San Francisco", zona: "San Francisco", direccion: "San Francisco" }
];
var TODAS_SUCURSALES_CUENTAS_CLAVE = [
  ...SUCURSALES_ALKOSTO,
  ...SUCURSALES_FAMILIA_CENTER
];
var CATALOGO_ALKOSTO = [
  // --- MORTADELAS Y EMBUTIDOS ASTURIAS / SALPICAO / CORRAL ---
  {
    sku: "1496",
    producto: "MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR",
    categoria: "MORTADELAS",
    presentacion: "Caja (10 und x 900g)",
    kilosPorCaja: 9,
    precioSugeridoUSD: 20,
    codigoBarra: "7590377000077",
    codigosCadena: ["1496", "7590377000077"],
    sinonimos: ["MORTADELA ESPECIAL DE POLLO 900GR ASTURIAS", "MORTADELA 900GR ASTURIAS", "MORTADELA ASTURIAS 10X900", "1496"],
    unidadSugerida: "CJ"
  },
  {
    sku: "1497",
    producto: "MORTADELA ESP D/POLLO ASTURIAS 20UNDX500GR",
    categoria: "MORTADELAS",
    presentacion: "Caja (20 und x 500g)",
    kilosPorCaja: 10,
    precioSugeridoUSD: 22,
    codigoBarra: "7590377000589",
    codigosCadena: ["1497", "7590377000589"],
    sinonimos: ["MORTADELA ESPECIAL DE POLLO ASTURIA 500GR", "MORTADELA ESPECIAL DE POLLO ASTURIAS 500GR", "MORTADELA 500GR ASTURIAS", "1497", "7590377000589"],
    unidadSugerida: "CJ"
  },
  {
    sku: "1519",
    producto: "MORTADELA ESP D/POLLO SALPICAO 10UNDX900GR",
    categoria: "MORTADELAS",
    presentacion: "Caja (10 und x 900g)",
    kilosPorCaja: 9,
    precioSugeridoUSD: 23,
    codigosCadena: ["1462", "1519"],
    sinonimos: ["MORTADELA ESPECIAL DE POLLO SALPICAO 10UNDX900GR", "SALPICAO 10X900", "1519", "1462"],
    unidadSugerida: "CJ"
  },
  {
    sku: "21",
    producto: "MORTADELA ESP D/POLLO CORRAL 1X12UNI",
    categoria: "MORTADELAS",
    presentacion: "Caja (12 und x 1kg)",
    kilosPorCaja: 12,
    precioSugeridoUSD: 36,
    codigoBarra: "7591289609129",
    codigosCadena: ["21", "7591289609129"],
    sinonimos: ["MORTADELA DE POLLO DEL CORRAL 1KG", "MORTADELA CORRAL 1X12", "MORTADELA CORRAL 12UNI", "21", "7591289609129"],
    unidadSugerida: "CJ"
  },
  {
    sku: "1464",
    producto: "MORT. NAVIDE\xD1A ASTURIAS XKG",
    categoria: "MORTADELAS",
    presentacion: "Pieza por Kg (Caja ~12 kg)",
    kilosPorCaja: 12,
    precioSugeridoUSD: 36,
    codigosCadena: ["1464"],
    sinonimos: ["MORTADELA NAVIDE\xD1A ASTURIAS", "NAVIDE\xD1A ASTURIAS", "1464"],
    unidadSugerida: "KG"
  },
  {
    sku: "1461",
    producto: "MORT. ESTANDAR ASTURIAS X KG",
    categoria: "MORTADELAS",
    presentacion: "Pieza por Kg (Caja ~10 kg)",
    kilosPorCaja: 10,
    precioSugeridoUSD: 25,
    codigosCadena: ["1461"],
    sinonimos: ["MORTADELA ESTANDAR ASTURIAS", "ESTANDAR ASTURIAS", "1461"],
    unidadSugerida: "KG"
  },
  {
    sku: "1462",
    producto: "MORT. ESPECIAL COCIDA ASTURIAS X KG",
    categoria: "MORTADELAS",
    presentacion: "Pieza por Kg (Caja ~10 kg)",
    kilosPorCaja: 10,
    precioSugeridoUSD: 26,
    codigosCadena: ["1462"],
    sinonimos: ["MORTADELA ESPECIAL COCIDA ASTURIAS", "1462"],
    unidadSugerida: "KG"
  },
  {
    sku: "1463",
    producto: "MORT. SUPERIOR ASTURIAS X KG",
    categoria: "MORTADELAS",
    presentacion: "Pieza por Kg (Caja ~12 kg)",
    kilosPorCaja: 12,
    precioSugeridoUSD: 28,
    codigosCadena: ["1463", "100929"],
    sinonimos: ["MORTADELA SUPERIOR ASTURIAS", "1463"],
    unidadSugerida: "KG"
  },
  {
    sku: "1512",
    producto: "MORT. PECHUGA DE PAVO ASTURIAS X KG",
    categoria: "MORTADELAS",
    presentacion: "Pieza por Kg (Caja ~10 kg)",
    kilosPorCaja: 10,
    precioSugeridoUSD: 55,
    codigosCadena: ["100881", "1512"],
    sinonimos: ["PECHUGA DE PAVO ASTURIAS X KG", "PECHUGA PAVO ASTURIAS", "100881", "1512"],
    unidadSugerida: "KG"
  },
  {
    sku: "1511",
    producto: "MORT. PECHUGA DE POLLO ASTURIAS X KG",
    categoria: "MORTADELAS",
    presentacion: "Pieza por Kg (Caja ~10 kg)",
    kilosPorCaja: 10,
    precioSugeridoUSD: 53.5,
    codigosCadena: ["100882", "1511"],
    sinonimos: ["PECHUGA DE POLLO ASTURIAS X KG", "PECHUGA POLLO ASTURIAS", "100882", "1511"],
    unidadSugerida: "KG"
  },
  {
    sku: "1561",
    producto: "MORT. PAVO TIPO SHOULDER ASTURIAS POR KG",
    categoria: "MORTADELAS",
    presentacion: "Pieza por Kg (Caja ~12 kg)",
    kilosPorCaja: 12,
    precioSugeridoUSD: 48,
    codigosCadena: ["1561"],
    sinonimos: ["SHOULDER ASTURIAS", "1561"],
    unidadSugerida: "KG"
  },
  {
    sku: "1521",
    producto: "MORT. ECONOM COCIDA ASTURIAS X KG",
    categoria: "MORTADELAS",
    presentacion: "Pieza por Kg (Caja ~10 kg)",
    kilosPorCaja: 10,
    precioSugeridoUSD: 22,
    codigosCadena: ["1521"],
    sinonimos: ["ECONOMICA ASTURIAS", "1521"],
    unidadSugerida: "KG"
  },
  {
    sku: "1522",
    producto: "MORT. TIPO AREPERO ASTURIAS X KG",
    categoria: "MORTADELAS",
    presentacion: "Pieza por Kg (Caja ~10 kg)",
    kilosPorCaja: 10,
    precioSugeridoUSD: 23.5,
    codigosCadena: ["1522"],
    sinonimos: ["AREPERO ASTURIAS", "1522"],
    unidadSugerida: "KG"
  },
  {
    sku: "1564",
    producto: "MORTADELA EXTRA ASTURIAS X KG",
    categoria: "MORTADELAS",
    presentacion: "Pieza por Kg (Caja ~10 kg)",
    kilosPorCaja: 10,
    precioSugeridoUSD: 25.5,
    codigosCadena: ["1564"],
    sinonimos: ["EXTRA ASTURIAS", "1564"],
    unidadSugerida: "KG"
  },
  {
    sku: "1563",
    producto: "MORT. ESTANDAR SALPICAO X KG",
    categoria: "MORTADELAS",
    presentacion: "Pieza por Kg (Caja ~10 kg)",
    kilosPorCaja: 10,
    precioSugeridoUSD: 24,
    codigosCadena: ["1563"],
    sinonimos: ["ESTANDAR SALPICAO", "1563"],
    unidadSugerida: "KG"
  },
  {
    sku: "1562",
    producto: "MORT. ESPECIAL COCIDA SALPICAO X KG",
    categoria: "MORTADELAS",
    presentacion: "Pieza por Kg (Caja ~10 kg)",
    kilosPorCaja: 10,
    precioSugeridoUSD: 25,
    codigosCadena: ["1562"],
    sinonimos: ["ESPECIAL SALPICAO", "1562"],
    unidadSugerida: "KG"
  },
  {
    sku: "1599",
    producto: "MORT. NAVIDE\xD1A SALPICAO X KG",
    categoria: "MORTADELAS",
    presentacion: "Pieza por Kg (Caja ~12 kg)",
    kilosPorCaja: 12,
    precioSugeridoUSD: 34,
    codigosCadena: ["1599"],
    sinonimos: ["NAVIDE\xD1A SALPICAO", "1599"],
    unidadSugerida: "KG"
  },
  {
    sku: "927",
    producto: "MORTADELA ESP. CARACAS 10X900GRS",
    categoria: "MORTADELAS",
    presentacion: "Caja (10 und x 900g)",
    kilosPorCaja: 9,
    precioSugeridoUSD: 23,
    codigosCadena: ["927"],
    sinonimos: ["CARACAS 900", "927"],
    unidadSugerida: "CJ"
  },
  {
    sku: "1051",
    producto: "MORTADELA ESP. CARACAS 10X500GRS",
    categoria: "MORTADELAS",
    presentacion: "Caja (10 und x 500g)",
    kilosPorCaja: 5,
    precioSugeridoUSD: 14,
    codigosCadena: ["1051"],
    sinonimos: ["CARACAS 500", "1051"],
    unidadSugerida: "CJ"
  },
  {
    sku: "1242",
    producto: "MORT. CHORIZO ESPECIAL CDZ X KG",
    categoria: "MORTADELAS",
    presentacion: "Pieza por Kg (Caja ~10 kg)",
    kilosPorCaja: 10,
    precioSugeridoUSD: 28,
    codigosCadena: ["1242"],
    sinonimos: ["CHORIZO ESPECIAL", "1242"],
    unidadSugerida: "KG"
  },
  // --- CARNES, CHULETAS Y TOCINO ---
  {
    sku: "1446",
    producto: "CHULETA FRESCA ASTURIAS POR KG",
    categoria: "CARNES / CHULETA",
    presentacion: "Caja ~15 kg al vac\xEDo",
    kilosPorCaja: 15,
    precioSugeridoUSD: 72,
    codigosCadena: ["1446"],
    sinonimos: ["CHULETA FRESCA ASTURIAS", "CHULETA ASTURIAS", "1446"],
    unidadSugerida: "KG"
  },
  {
    sku: "1088",
    producto: "CHULETA FRESCA IBERICO POR KG",
    categoria: "CARNES / CHULETA",
    presentacion: "Caja ~15 kg al vac\xEDo",
    kilosPorCaja: 15,
    precioSugeridoUSD: 69,
    codigosCadena: ["1088"],
    sinonimos: ["CHULETA IBERICO", "1088"],
    unidadSugerida: "KG"
  },
  {
    sku: "1445",
    producto: "TOCINO FRESCO ASTURIAS X KG",
    categoria: "CARNES / CHULETA",
    presentacion: "Caja ~15 kg",
    kilosPorCaja: 15,
    precioSugeridoUSD: 45,
    codigosCadena: ["1445"],
    sinonimos: ["TOCINO FRESCO ASTURIAS", "1445"],
    unidadSugerida: "KG"
  },
  {
    sku: "340",
    producto: "CHULETA AHUMADA ALIMEX X KG",
    categoria: "CARNES / CHULETA",
    presentacion: "Caja ~12 kg",
    kilosPorCaja: 12,
    precioSugeridoUSD: 65,
    codigosCadena: ["340"],
    sinonimos: ["CHULETA AHUMADA ALIMEX", "340"],
    unidadSugerida: "KG"
  },
  // --- JAMONES, ESPALDAS Y SALCHICHAS ALIMEX / ITALICO ---
  {
    sku: "171",
    producto: "JAMON COC. SUPERIOR ALIMEX 1X5.9KG",
    categoria: "JAMONES",
    presentacion: "Pieza (Barra ~5.9 kg)",
    kilosPorCaja: 11.8,
    precioSugeridoUSD: 68,
    codigosCadena: ["171", "100929"],
    sinonimos: ["JAMON COCIDO SUPERIOR ASTURIAS / ALIMEX", "JAMON COCIDO DE PAVO AHUMADO SUPERIOR ASTURIAS", "JAMON SUPERIOR ALIMEX", "171"],
    unidadSugerida: "CJ"
  },
  {
    sku: "172",
    producto: "ESPALDA COCIDA ALIMEX 1X4.6KG",
    categoria: "JAMONES",
    presentacion: "Pieza (Barra ~4.6 kg)",
    kilosPorCaja: 9.2,
    precioSugeridoUSD: 54,
    codigosCadena: ["172"],
    sinonimos: ["ESPALDA COCIDA ALIMEX", "ESPALDA ALIMEX", "172"],
    unidadSugerida: "CJ"
  },
  {
    sku: "241",
    producto: "ESPAL. AHUM T/VISKING ALIMEX 6X3.2",
    categoria: "JAMONES",
    presentacion: "Caja (6 und x 3.2 kg)",
    kilosPorCaja: 19.2,
    precioSugeridoUSD: 98,
    codigosCadena: ["241"],
    sinonimos: ["VISKING ALIMEX", "ESPALDA VISKING", "241"],
    unidadSugerida: "CJ"
  },
  {
    sku: "439",
    producto: "ESPAL AHUM.T/AREPERO ALIMEX 12X1,6KG",
    categoria: "JAMONES",
    presentacion: "Caja (12 und x 1.6 kg)",
    kilosPorCaja: 19.2,
    precioSugeridoUSD: 95,
    codigosCadena: ["439"],
    sinonimos: ["AREPERO ALIMEX", "439"],
    unidadSugerida: "CJ"
  },
  {
    sku: "995",
    producto: "ESPAL. AHUM T/VISKING ITALICO 6UNDX3.2KG",
    categoria: "JAMONES",
    presentacion: "Caja (6 und x 3.2 kg)",
    kilosPorCaja: 19.2,
    precioSugeridoUSD: 92,
    codigosCadena: ["995"],
    sinonimos: ["VISKING ITALICO", "995"],
    unidadSugerida: "CJ"
  },
  {
    sku: "337",
    producto: "JAMON COCIDO ESTANDAR ITALICO X KG",
    categoria: "JAMONES",
    presentacion: "Pieza por Kg (Caja ~12 kg)",
    kilosPorCaja: 12,
    precioSugeridoUSD: 52,
    codigosCadena: ["337"],
    sinonimos: ["JAMON ITALICO", "337"],
    unidadSugerida: "KG"
  },
  {
    sku: "170",
    producto: "TOCINETA AHUM S/CUERO ALIMEX X KG",
    categoria: "JAMONES",
    presentacion: "Caja ~10 kg",
    kilosPorCaja: 10,
    precioSugeridoUSD: 58,
    codigosCadena: ["170"],
    sinonimos: ["TOCINETA ALIMEX", "170"],
    unidadSugerida: "KG"
  },
  {
    sku: "177",
    producto: "SALCHICHA VIENA ALIMEX 16 X 450 GRS",
    categoria: "JAMONES",
    presentacion: "Caja (16 paq x 450g)",
    kilosPorCaja: 7.2,
    precioSugeridoUSD: 28,
    codigosCadena: ["177"],
    sinonimos: ["SALCHICHA VIENA 450", "177"],
    unidadSugerida: "CJ"
  },
  {
    sku: "176",
    producto: "SALCHICHA VIENA ALIMEX 8 X 800 GRS",
    categoria: "JAMONES",
    presentacion: "Caja (8 paq x 800g)",
    kilosPorCaja: 6.4,
    precioSugeridoUSD: 25,
    codigosCadena: ["176"],
    sinonimos: ["SALCHICHA VIENA 800", "176"],
    unidadSugerida: "CJ"
  },
  // --- BENEFICIO DE POLLO Y DESPRESADO ---
  {
    sku: "101",
    producto: "POLLO BENEFICIADO ENTERO",
    categoria: "POLLO",
    presentacion: "Cesta / Caja ~20 kg",
    kilosPorCaja: 20,
    precioSugeridoUSD: 56,
    codigosCadena: ["101", "POLLO"],
    sinonimos: ["POLLO ENTERO", "POLLO TODAS LAS MARCAS", "POLLO"],
    unidadSugerida: "KG"
  },
  {
    sku: "103",
    producto: "FILET VARIAS PRESENTACIONES",
    categoria: "POLLO",
    presentacion: "Caja 15 kg congelado",
    kilosPorCaja: 15,
    precioSugeridoUSD: 65,
    codigosCadena: ["103", "FILET"],
    sinonimos: ["FILET DE POLLO", "FILET PECHUGA", "FILET"],
    unidadSugerida: "KG"
  },
  {
    sku: "629",
    producto: "MUSLO CUADRIL DESPRESADO POR KG",
    categoria: "POLLO",
    presentacion: "Caja 15 kg congelado",
    kilosPorCaja: 15,
    precioSugeridoUSD: 39,
    codigosCadena: ["629", "102", "MUSLO"],
    sinonimos: ["MUSLO CUADRIL", "MUSLO POLLO", "MUSLO", "629"],
    unidadSugerida: "KG"
  },
  {
    sku: "630",
    producto: "ALAS DESPRESADAS POR KG",
    categoria: "POLLO",
    presentacion: "Caja 15 kg congelado",
    kilosPorCaja: 15,
    precioSugeridoUSD: 42,
    codigosCadena: ["630", "ALAS"],
    sinonimos: ["ALAS DE POLLO", "ALAS", "630"],
    unidadSugerida: "KG"
  },
  {
    sku: "870",
    producto: "HIGADO (EMPACADO)",
    categoria: "POLLO",
    presentacion: "Caja 15 kg congelado",
    kilosPorCaja: 15,
    precioSugeridoUSD: 25,
    codigosCadena: ["870"],
    sinonimos: ["HIGADO DE POLLO", "HIGADO", "870"],
    unidadSugerida: "KG"
  },
  {
    sku: "393",
    producto: "MOLLEJA (EMPACADA)",
    categoria: "POLLO",
    presentacion: "Caja 15 kg congelado",
    kilosPorCaja: 15,
    precioSugeridoUSD: 28,
    codigosCadena: ["393"],
    sinonimos: ["MOLLEJAS", "393"],
    unidadSugerida: "KG"
  },
  // --- VÍVERES, BÁSICOS Y LÁCTEOS ---
  {
    sku: "QS",
    producto: "QUESO AMARILLO",
    categoria: "LACTEOS",
    presentacion: "Barra ~3.5 kg (Caja 14 kg)",
    kilosPorCaja: 14,
    precioSugeridoUSD: 72,
    codigosCadena: ["QS", "QUESO"],
    sinonimos: ["QUESO AMARILLO GOUDA", "QUESO", "QS"],
    unidadSugerida: "KG"
  },
  {
    sku: "301",
    producto: "ACEITE VEGETAL COMESTIBLE 12X1LT",
    categoria: "BASICOS",
    presentacion: "Caja (12 botellas x 1L)",
    kilosPorCaja: 11,
    precioSugeridoUSD: 26.5,
    codigosCadena: ["301", "ACEITE"],
    sinonimos: ["ACEITE VEGETAL", "ACEITE", "301"],
    unidadSugerida: "CJ"
  },
  {
    sku: "302",
    producto: "AZUCAR REFINADA BLANCA 50KG",
    categoria: "BASICOS",
    presentacion: "Saco 50 kg",
    kilosPorCaja: 50,
    precioSugeridoUSD: 48,
    codigosCadena: ["302", "AZUCAR"],
    sinonimos: ["AZUCAR 50KG", "AZUCAR", "302"],
    unidadSugerida: "CJ"
  },
  {
    sku: "303",
    producto: "ARROZ BLANCO ESPECIAL 24X1KG",
    categoria: "BASICOS",
    presentacion: "Bulto (24 paquetes x 1kg)",
    kilosPorCaja: 24,
    precioSugeridoUSD: 28.8,
    codigosCadena: ["303", "ARROZ"],
    sinonimos: ["ARROZ 900GR", "ARROZ 24X1KG", "ARROZ", "303"],
    unidadSugerida: "CJ"
  },
  {
    sku: "401",
    producto: "HUEVOS BLANCOS SELECCIONADOS",
    categoria: "BASICOS",
    presentacion: "Caja (12 cartones / 360 und)",
    kilosPorCaja: 22,
    precioSugeridoUSD: 45,
    codigosCadena: ["401", "HUEVOS"],
    sinonimos: ["HUEVOS BLANCOS", "HUEVOS", "401"],
    unidadSugerida: "CJ"
  },
  {
    sku: "1360",
    producto: "PATATAS FRESCAS MARQUISE 4X2.5KG",
    categoria: "CONGELADOS",
    presentacion: "Caja (4 bolsas x 2.5kg)",
    kilosPorCaja: 10,
    precioSugeridoUSD: 22.8,
    codigoBarra: "5412873178161",
    codigosCadena: ["1360", "5412873178161", "PATATAS"],
    sinonimos: ["PAPAS FRITAS CONGELADAS MARQUISE 2,5KG", "PAPAS MARQUISE", "PATATAS FRESCAS", "1360", "5412873178161"],
    unidadSugerida: "CJ"
  },
  {
    sku: "047",
    producto: "NUGGET CORRAL DE 460GM",
    categoria: "CONGELADOS",
    presentacion: "Paquete 460g",
    kilosPorCaja: 0.46,
    precioSugeridoUSD: 3.88,
    codigoBarra: "7591289400023",
    codigosCadena: ["047", "7591289400023"],
    sinonimos: ["NUGGETS DE POLLO DEL CORRAL 460GR", "NUGGETS DE POLLO DEL CORRAL 462GR", "NUGGET CORRAL DE 460GM", "047", "7591289400023"],
    unidadSugerida: "UND"
  },
  {
    sku: "046",
    producto: "NUGGETS DE POLLO (COD. 046)",
    categoria: "CONGELADOS",
    presentacion: "Bolsa Institucional por Kg",
    kilosPorCaja: 1,
    precioSugeridoUSD: 8.71,
    codigosCadena: ["046", "100253"],
    sinonimos: ["NUGGETS EL CORRAL POR KG", "NUGGET CORRAL INSTITUCIONAL", "NUGGETS DE POLLO (COD. 046)", "046", "100253"],
    unidadSugerida: "KG"
  },
  {
    sku: "7591210000513",
    producto: "CREMA DE LECHE PURISIMA 500GR",
    categoria: "LACTEOS",
    presentacion: "Caja (6 und x 500g)",
    kilosPorCaja: 3,
    precioSugeridoUSD: 25.63,
    codigoBarra: "7591210000513",
    codigosCadena: ["7591210000513"],
    sinonimos: ["CREMA DE LECHE PURISIMA 500GR", "CREMA DE LECHE PURISIMA 6 X 500 GRS", "7591210000513"],
    unidadSugerida: "CJ"
  },
  {
    sku: "7591210000544",
    producto: "CREMA DE LECHE PURISIMA 250GR",
    categoria: "LACTEOS",
    presentacion: "Caja (12 und x 250g)",
    kilosPorCaja: 3,
    precioSugeridoUSD: 30.6,
    codigoBarra: "7591210000544",
    codigosCadena: ["7591210000544"],
    sinonimos: ["CREMA DE LECHE PURISIMA 250GR", "CREMA DE LECHE PURISIMA 12 X 250 GRS", "7591210000544"],
    unidadSugerida: "CJ"
  },
  {
    sku: "021000061778",
    producto: "QUESO CREMA KRAFT 226 GR X 36 UND",
    categoria: "LACTEOS",
    presentacion: "Unidad 226g (Caja x 36 und)",
    kilosPorCaja: 0.226,
    precioSugeridoUSD: 3,
    codigoBarra: "021000061778",
    codigosCadena: ["021000061778"],
    sinonimos: ["QUESO CREMA MARCA KRAFT 226GR", "QUESO CREMA KRAFT 226 GR X 36 UND", "021000061778"],
    unidadSugerida: "UND"
  },
  {
    sku: "100281",
    producto: "QUESO MOZZARELLA CORLASA 3.5KG X 4 UND",
    categoria: "LACTEOS",
    presentacion: "Pieza por Kg",
    kilosPorCaja: 14,
    precioSugeridoUSD: 10,
    codigosCadena: ["100281"],
    sinonimos: ["QUESO MOZZARELLA CORLASA X KG", "QUESO MOZZARELLA CORLASA 3.5KG X 4 UND", "100281"],
    unidadSugerida: "KG"
  },
  {
    sku: "1569",
    producto: "PATATAS FRESCAS DOBLE COBERTURA 4X2.5KG",
    categoria: "CONGELADOS",
    presentacion: "Caja (4 bolsas x 2.5kg)",
    kilosPorCaja: 10,
    precioSugeridoUSD: 23.5,
    codigosCadena: ["1569"],
    sinonimos: ["PAPAS DOBLE COBERTURA", "1569"],
    unidadSugerida: "CJ"
  },
  {
    sku: "UTH",
    producto: "LECHE LIQUIDA UHT 12X1LT",
    categoria: "LACTEOS",
    presentacion: "Caja (12 litros)",
    kilosPorCaja: 12,
    precioSugeridoUSD: 18,
    codigosCadena: ["UTH", "LECHE UTH"],
    sinonimos: ["LECHE UHT", "LECHE LIQUIDA", "UTH"],
    unidadSugerida: "CJ"
  },
  {
    sku: "LPV",
    producto: "LECHE EN POLVO VENCAMPO",
    categoria: "LACTEOS",
    presentacion: "Bulto (12 x 1kg / 24 x 500g)",
    kilosPorCaja: 12,
    precioSugeridoUSD: 54,
    codigosCadena: ["LPV", "LECHE EN POLVO"],
    sinonimos: ["LECHE VENCAMPO", "LECHE EN POLVO", "LPV"],
    unidadSugerida: "CJ"
  },
  {
    sku: "JUGOS",
    producto: "JUGOS Y NECTAR VARIOS",
    categoria: "BEBIDAS",
    presentacion: "Caja (24 und x 250ml)",
    kilosPorCaja: 6,
    precioSugeridoUSD: 16,
    codigosCadena: ["JUGOS", "BEBIDAS"],
    sinonimos: ["JUGOS Y NECTAR", "JUGOS", "BEBIDAS"],
    unidadSugerida: "CJ"
  },
  {
    sku: "1572",
    producto: "CAJAS DE PIZZA 1X100",
    categoria: "EMPAQUES",
    presentacion: "Bulto (100 unidades)",
    kilosPorCaja: 10,
    precioSugeridoUSD: 25,
    codigosCadena: ["1572"],
    sinonimos: ["CAJA PIZZA", "1572"],
    unidadSugerida: "BLT"
  }
];
function normalizarCodigoProducto(codigo) {
  if (!codigo) return "";
  return String(codigo).trim().replace(/[\s\-_.]/g, "");
}
function resolverProductoPorCodigoODescripcion(codigoInput, descripcionInput) {
  const codRaw = String(codigoInput || "").trim();
  const codNorm = normalizarCodigoProducto(codRaw).toUpperCase();
  const descNorm = String(descripcionInput || "").replace(/\s+\/\s*\d+(?:[.,]\d+)?\s*$/, "").replace(/\s+/g, " ").trim().toUpperCase();
  if (!codNorm && !descNorm) return void 0;
  if (codNorm) {
    const match = CATALOGO_ALKOSTO.find((p) => p.sku.toUpperCase() === codNorm);
    if (match) return match;
  }
  if (codNorm) {
    const match = CATALOGO_ALKOSTO.find((p) => p.codigoBarra && normalizarCodigoProducto(p.codigoBarra) === codNorm);
    if (match) return match;
  }
  if (codNorm) {
    const match = CATALOGO_ALKOSTO.find((p) => p.codigosCadena && p.codigosCadena.some((c) => normalizarCodigoProducto(c).toUpperCase() === codNorm));
    if (match) return match;
  }
  if (codNorm) {
    const match = CATALOGO_ALKOSTO.find((p) => p.sinonimos && p.sinonimos.some((s) => normalizarCodigoProducto(s).toUpperCase() === codNorm));
    if (match) return match;
  }
  const hasExplicitUnmatchedNumericCode = codNorm.length >= 4 && /^\d+$/.test(codNorm);
  if (descNorm) {
    let match = CATALOGO_ALKOSTO.find(
      (p) => p.producto.toUpperCase() === descNorm || p.sinonimos && p.sinonimos.some((s) => s.toUpperCase() === descNorm)
    );
    if (match) return match;
    if (hasExplicitUnmatchedNumericCode) {
      return void 0;
    }
    match = CATALOGO_ALKOSTO.find((p) => {
      const pNorm = p.producto.toUpperCase();
      if (descNorm.includes(pNorm) || pNorm.includes(descNorm)) return true;
      if (p.sinonimos && p.sinonimos.some((s) => s.length >= 6 && descNorm.includes(s.toUpperCase()))) return true;
      return false;
    });
    if (match) return match;
    const tokens = descNorm.split(/\s+/).filter((t) => t.length > 2 && !["POR", "CON", "DEL", "LOS", "LAS", "PARA", "MAS"].includes(t));
    if (tokens.length > 0) {
      match = CATALOGO_ALKOSTO.find((p) => {
        const pNorm = p.producto.toUpperCase();
        const matchesCount = tokens.filter((t) => pNorm.includes(t)).length;
        const requiredMatches = tokens.length <= 2 ? tokens.length : Math.max(2, Math.ceil(tokens.length * 0.75));
        return matchesCount >= requiredMatches;
      });
      if (match) return match;
    }
  }
  return void 0;
}

// src/services/alkostoOcParser.ts
var AlkostoParseValidationError = class extends Error {
  constructor(message, issues = [], code = "ALKOSTO_OC_VALIDATION_ERROR") {
    super(message);
    this.name = "AlkostoParseValidationError";
    this.code = code;
    this.issues = issues;
  }
};
var ALKOSTO_STORE_TAGS = [
  "AK01",
  "AK02",
  "AK03",
  "AK04",
  "AK05",
  "AK06",
  "AK07",
  "AK08",
  "AK09",
  "AK10",
  "AKOP",
  "CI"
];
var FAMILIA_CENTER_STORE_TAGS = [
  "FC01",
  "FC02",
  "FC03",
  "FC04",
  "FC05",
  "FC06",
  "FC07",
  "FCOP"
];
var VECINO_CENTER_STORE_TAGS = [
  "VC01",
  "VC02",
  "VC03"
];
var ALL_VALID_STORE_TAGS = /* @__PURE__ */ new Set([
  ...ALKOSTO_STORE_TAGS,
  ...FAMILIA_CENTER_STORE_TAGS,
  ...VECINO_CENTER_STORE_TAGS
]);
function parseNumeroEstricto(val, defaultVal = 0) {
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : defaultVal;
  }
  if (val === null || val === void 0) return defaultVal;
  const raw = String(val).trim();
  if (!raw) return defaultVal;
  const cleaned = raw.replace(/[$BsUSD\s]/gi, "");
  if (!cleaned || !/\d/.test(cleaned)) return defaultVal;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    const n2 = parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n2) ? n2 : defaultVal;
  }
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    const n2 = parseFloat(cleaned.replace(/,/g, ""));
    return Number.isFinite(n2) ? n2 : defaultVal;
  }
  if (/^-?\d+,\d+$/.test(cleaned)) {
    const n2 = parseFloat(cleaned.replace(",", "."));
    return Number.isFinite(n2) ? n2 : defaultVal;
  }
  if (cleaned.includes(".") && cleaned.includes(",")) {
    if (cleaned.lastIndexOf(".") < cleaned.lastIndexOf(",")) {
      const n2 = parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n2) ? n2 : defaultVal;
    } else {
      const n2 = parseFloat(cleaned.replace(/,/g, ""));
      return Number.isFinite(n2) ? n2 : defaultVal;
    }
  }
  const n = parseFloat(cleaned.replace(/,/g, "."));
  return Number.isFinite(n) ? n : defaultVal;
}
function limpiarDescripcionAlkosto(desc) {
  if (!desc) return "";
  return String(desc).replace(/\s*\/\s*\d+(?:[.,]\d+)?\s*$/, "").replace(/\s+/g, " ").trim();
}
function autocorregirTiendasPorFila(tiendas, totalCantidad) {
  const result = {};
  for (const [k, v] of Object.entries(tiendas || {})) {
    const num = parseNumeroEstricto(v, 0);
    if (num > 0 && k.toUpperCase() !== "CI" && k.toUpperCase() !== "AKOP" && k.toUpperCase() !== "FCOP") {
      result[k.toUpperCase()] = num;
    } else if (num > 0 && (k.toUpperCase() === "AKOP" || k.toUpperCase() === "FCOP")) {
      result[k.toUpperCase()] = num;
    }
  }
  if (!totalCantidad || totalCantidad <= 0) return result;
  const entries = Object.entries(result);
  if (entries.length === 0) return result;
  const currentSum = entries.reduce((acc, [, v]) => acc + v, 0);
  if (Math.abs(currentSum - totalCantidad) <= 0.05) {
    return result;
  }
  if (currentSum > totalCantidad) {
    for (const [tag, val] of entries) {
      for (const divisor of [100, 10]) {
        if (val >= divisor) {
          const candidateVal = Number((val / divisor).toFixed(2));
          const candidateSum = currentSum - val + candidateVal;
          if (Math.abs(candidateSum - totalCantidad) <= 0.05) {
            result[tag] = candidateVal;
            return result;
          }
        }
      }
    }
    for (const divisor of [100, 10]) {
      const scaledEntries = entries.map(([tag, val]) => [
        tag,
        val >= divisor && val % (divisor / 10) === 0 ? Number((val / divisor).toFixed(2)) : val
      ]);
      const scaledSum = scaledEntries.reduce((acc, [, v]) => acc + v, 0);
      if (Math.abs(scaledSum - totalCantidad) <= 0.05) {
        const corrected = {};
        scaledEntries.forEach(([tag, v]) => {
          if (v > 0) corrected[tag] = v;
        });
        return corrected;
      }
    }
    const suspectTags = entries.filter(([, val]) => val > totalCantidad).map(([tag]) => tag);
    if (suspectTags.length >= 2 && suspectTags.length <= 6) {
      const trial = { ...result };
      for (const tag of suspectTags) {
        const v = trial[tag];
        if (v / 100 <= totalCantidad) {
          trial[tag] = Number((v / 100).toFixed(2));
        } else if (v / 10 <= totalCantidad) {
          trial[tag] = Number((v / 10).toFixed(2));
        }
      }
      const trialSum = Object.values(trial).reduce((acc, v) => acc + v, 0);
      if (Math.abs(trialSum - totalCantidad) <= 0.05) {
        return trial;
      }
    }
  }
  return result;
}
function normalizarUnidadMedidaAlkosto(rawUnid, descripcion, emp, catalogUnid) {
  const clean = String(rawUnid || "").trim().toUpperCase().replace(/[.\-_/]/g, "");
  if (clean) {
    if (["CJ", "CJA", "CAJ", "CAJA", "CAJAS", "CJS", "BTO", "BTOS", "BULTO", "BULTOS", "EMP", "CS"].includes(clean)) {
      return "CJ";
    }
    if (["BLT"].includes(clean)) {
      return "BLT";
    }
    if (["KG", "KGS", "KILO", "KILOS", "KLS", "KGR", "KL", "K"].includes(clean)) {
      return "KG";
    }
    if (["UND", "UNID", "UNIDAD", "UNIDADES", "UNI", "UN", "PZA", "PZAS", "PIEZA", "PIEZAS", "PAQ", "PAQUETE", "BOLSA", "BOLSAS"].includes(clean)) {
      return "UND";
    }
  }
  if (catalogUnid && ["CJ", "KG", "UND", "BLT"].includes(catalogUnid.toUpperCase())) {
    return catalogUnid.toUpperCase();
  }
  const descUpper = String(descripcion || "").toUpperCase();
  if (/\b(X\s*KG|POR\s*KG|XKG|A\s+GRANEL)\b/.test(descUpper)) {
    return "KG";
  }
  if (/\b(\d+\s*UND\s*X|\d+\s*X\s*\d+\s*(GR|GRS|KG|LT|ML|UNI|UND))\b/.test(descUpper)) {
    return "CJ";
  }
  if (emp && emp > 0) {
    return "CJ";
  }
  return "KG";
}
function normalizarFechaAlkosto(fechaRaw) {
  const s = String(fechaRaw || "").trim();
  if (!s) return "";
  const dmy = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    const d = parseInt(dd, 10);
    const m = parseInt(mm, 10);
    const y = parseInt(yyyy, 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2e3 && y <= 2100) {
      return `${dd}/${mm}/${yyyy}`;
    }
  }
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    return s;
  }
  return s;
}
function assertValidInputPayload(input, context = "Documento OC Alkosto") {
  if (input === null || input === void 0) {
    throw new AlkostoParseValidationError(
      `${context}: El contenido de entrada es nulo o indefinido.`,
      [{ field: "input", message: "Entrada vac\xEDa o nula", severity: "ERROR" }],
      "EMPTY_INPUT"
    );
  }
  if (typeof input === "string" && input.trim().length === 0) {
    throw new AlkostoParseValidationError(
      `${context}: El texto o imagen base64 de entrada est\xE1 vac\xEDo.`,
      [{ field: "input", message: "Cadena de entrada vac\xEDa", severity: "ERROR" }],
      "EMPTY_STRING_INPUT"
    );
  }
}
function mapNumericCellsToRow(rawTokens, pageChain, explicitStoreHeaders) {
  if (!rawTokens || rawTokens.length < 8) return null;
  const isPlainInteger = (tok) => /^\d+$/.test(tok.trim());
  const nums = rawTokens.map((t) => parseNumeroEstricto(t, 0));
  const tailStart = nums.length - 7;
  if (tailStart < 2) return null;
  const totalCantidad = nums[tailStart];
  const costoBruto = nums[tailStart + 1];
  const costoUnitario = nums[tailStart + 5] || costoBruto;
  const totalRenglon = nums[tailStart + 6];
  const prefixTokens = rawTokens.slice(0, tailStart);
  const prefixNums = nums.slice(0, tailStart);
  const iva = prefixNums[0] ?? 0;
  const tiendas = {};
  let emp = 0;
  if (pageChain === "ALKOSTO" && prefixNums.length === 14) {
    const idx1IsInt = isPlainInteger(prefixTokens[1]);
    const idx5IsInt = isPlainInteger(prefixTokens[5]);
    let storeValues;
    if (idx5IsInt && !idx1IsInt) {
      emp = prefixNums[5];
      storeValues = [
        prefixNums[1],
        // AK01
        prefixNums[2],
        // AK02
        prefixNums[3],
        // AK03
        prefixNums[4],
        // AK04
        prefixNums[8],
        // AK05
        prefixNums[9],
        // AK06
        prefixNums[10],
        // AK07
        prefixNums[6],
        // AK08
        prefixNums[7],
        // AK09
        prefixNums[11],
        // AK10
        prefixNums[12],
        // AKOP
        prefixNums[13]
        // CI
      ];
    } else {
      emp = prefixNums[1];
      storeValues = prefixNums.slice(2, 14);
    }
    ALKOSTO_STORE_TAGS.forEach((tag, i) => {
      const val = storeValues[i] || 0;
      if (val > 0 && tag !== "CI") {
        tiendas[tag] = val;
      }
    });
  } else if (pageChain === "FAMILIA_CENTER" && prefixNums.length === 9) {
    const idx1IsInt = isPlainInteger(prefixTokens[1]);
    const idx3IsInt = isPlainInteger(prefixTokens[3]);
    let storeValues;
    if (idx3IsInt && !idx1IsInt) {
      emp = prefixNums[3];
      storeValues = [
        prefixNums[1],
        // FC01
        prefixNums[2],
        // FC02
        prefixNums[4],
        // FC03
        prefixNums[5],
        // FC04
        prefixNums[6],
        // FC05
        prefixNums[7],
        // FC06
        prefixNums[8]
        // FC07
      ];
    } else {
      emp = prefixNums[1];
      storeValues = prefixNums.slice(2, 9);
    }
    const fcTags = ["FC01", "FC02", "FC03", "FC04", "FC05", "FC06", "FC07"];
    fcTags.forEach((tag, i) => {
      const val = storeValues[i] || 0;
      if (val > 0) {
        tiendas[tag] = val;
      }
    });
  } else {
    emp = prefixNums[1] || 0;
    const storeSlice = prefixNums.slice(2);
    const headers = explicitStoreHeaders && explicitStoreHeaders.length === storeSlice.length ? explicitStoreHeaders : storeSlice.map((_, i) => {
      if (pageChain === "FAMILIA_CENTER") return `FC0${i + 1}`;
      if (pageChain === "VECINO_CENTER") return `VC0${i + 1}`;
      return ALKOSTO_STORE_TAGS[i] || `AK0${i + 1}`;
    });
    headers.forEach((tag, i) => {
      const val = storeSlice[i] || 0;
      if (val > 0 && tag !== "CI") {
        tiendas[tag] = val;
      }
    });
  }
  const correctedTiendas = autocorregirTiendasPorFila(tiendas, totalCantidad);
  return {
    iva,
    emp,
    tiendas: correctedTiendas,
    totalCantidad,
    costoBruto,
    costoUnitario,
    totalRenglon
  };
}
function parseAlkostoRawText(rawText) {
  assertValidInputPayload(rawText, "parseAlkostoRawText");
  const pageChunks = splitTextIntoPages(rawText);
  let ordenNro = "";
  let sede = "AKOP";
  let fechaEmision = "";
  let fechaEntrega = "";
  let diasCredito = 15;
  let tasaCambio = 0;
  let proveedorNombre = "CODIZULCA, C.A.";
  let proveedorRif = "J409876136";
  let observaciones = "";
  let subtotalAlkosto = 0;
  let subtotalFamiliaCenter = 0;
  let subtotalGeneral = 0;
  const cadenasDetectadas = [];
  const itemsByCode = /* @__PURE__ */ new Map();
  for (const pageText of pageChunks) {
    const upper = pageText.toUpperCase();
    let pageChain = "ALKOSTO";
    if (upper.includes("FAMILIA CENTER") || upper.includes("SUBTOTAL ( FC )") || /\bFC01\b/.test(upper)) {
      pageChain = "FAMILIA_CENTER";
    } else if (upper.includes("VECINO CENTER") || upper.includes("SUBTOTAL ( HC )") || /\bVC01\b/.test(upper)) {
      pageChain = "VECINO_CENTER";
    }
    if (!cadenasDetectadas.includes(pageChain)) {
      cadenasDetectadas.push(pageChain);
    }
    if (!ordenNro) {
      const ocMatch = pageText.match(/Orden\s*Nro\.?\s*:?\s*(\d{5,12})/i) || pageText.match(/\b(0000\d{6})\b/);
      if (ocMatch) ordenNro = ocMatch[1].trim();
    }
    if (!tasaCambio) {
      const tasaMatch = pageText.match(/TASA\s+DE\s+CAMBIO\s*:?\s*([\d.,]+)/i);
      if (tasaMatch) tasaCambio = parseNumeroEstricto(tasaMatch[1], 0);
    }
    const datesFound = pageText.match(/\b(\d{2}\/\d{2}\/\d{4})\b/g) || [];
    if (datesFound.length >= 2 && !fechaEntrega) {
      const d1 = datesFound[0];
      const d2 = datesFound[1];
      const toComparable = (d) => {
        const [dd, mm, yyyy] = d.split("/");
        return `${yyyy}-${mm}-${dd}`;
      };
      if (toComparable(d1) >= toComparable(d2)) {
        fechaEntrega = d1;
        fechaEmision = d2;
      } else {
        fechaEmision = d1;
        fechaEntrega = d2;
      }
    } else if (datesFound.length === 1 && !fechaEntrega) {
      fechaEntrega = datesFound[0];
      fechaEmision = datesFound[0];
    }
    const credMatch = pageText.match(/Dias\s+de\s+Credito\s*[\r\n\s]*(\d{1,3})/i);
    if (credMatch) {
      diasCredito = parseInt(credMatch[1], 10) || diasCredito;
    }
    if (!observaciones) {
      const obsMatch = pageText.match(/(\d+\s*DIAS\s+BS\s+BCV[^\r\n]*)/i);
      if (obsMatch) observaciones = obsMatch[1].trim();
    }
    const subAkMatch = pageText.match(/SubTotal\s*\(\s*AK\s*\)\s*([\d.,]+)/i);
    if (subAkMatch) subtotalAlkosto = parseNumeroEstricto(subAkMatch[1], 0);
    const subFcMatch = pageText.match(/SubTotal\s*\(\s*FC\s*\)\s*([\d.,]+)/i);
    if (subFcMatch) subtotalFamiliaCenter = parseNumeroEstricto(subFcMatch[1], 0);
    const subGenMatch = pageText.match(/Sub\s*Total\s*:\s*([\d.,]+)/i);
    if (subGenMatch) subtotalGeneral = parseNumeroEstricto(subGenMatch[1], 0);
    if (pageChain === "VECINO_CENTER") continue;
    const lines = pageText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const prodHeaderMatch = line.match(/^(\d{4,14})\s+([A-ZÁÉÍÓÚÑ0-9][\s\S]+)$/i);
      if (!prodHeaderMatch) continue;
      const rawCode = prodHeaderMatch[1].trim();
      let rawDescPart = prodHeaderMatch[2].trim();
      if (rawCode === "409876136" || /^267319/.test(rawCode) || rawDescPart.toUpperCase().startsWith("CODIZULCA")) {
        continue;
      }
      let nextLineIdx = i + 1;
      let nextLine = lines[nextLineIdx] || "";
      let numTokens = nextLine.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
      if (numTokens.length < 8 && nextLine && !/^(\d{4,14})\s+[A-ZÁÉÍÓÚÑ]/i.test(nextLine) && !/^SubTotal/i.test(nextLine) && lines[i + 2]) {
        const secondNextTokens = lines[i + 2].match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
        if (secondNextTokens.length >= 8) {
          rawDescPart = `${rawDescPart} ${nextLine}`.trim();
          nextLineIdx = i + 2;
          nextLine = lines[nextLineIdx];
          numTokens = secondNextTokens;
        }
      }
      if (numTokens.length < 8) continue;
      const mapped = mapNumericCellsToRow(numTokens, pageChain);
      if (!mapped) continue;
      i = nextLineIdx;
      const cleanDesc = limpiarDescripcionAlkosto(rawDescPart);
      const catalogMatch = resolverProductoPorCodigoODescripcion(rawCode, cleanDesc);
      const finalSku = catalogMatch ? catalogMatch.sku : rawCode;
      const finalBarcode = catalogMatch?.codigoBarra || (/^\d{12,14}$/.test(rawCode) ? rawCode : void 0);
      const finalUnid = normalizarUnidadMedidaAlkosto(void 0, cleanDesc, mapped.emp, catalogMatch?.unidadSugerida);
      const existing = itemsByCode.get(rawCode);
      if (existing) {
        for (const [tk, tv] of Object.entries(mapped.tiendas)) {
          existing.tiendas[tk] = (existing.tiendas[tk] || 0) + tv;
        }
        if (pageChain === "ALKOSTO") {
          existing.totalCantidadAlkosto = (existing.totalCantidadAlkosto || 0) + mapped.totalCantidad;
        } else if (pageChain === "FAMILIA_CENTER") {
          existing.totalCantidadFamilia = (existing.totalCantidadFamilia || 0) + mapped.totalCantidad;
        }
        existing.totalCantidad = (existing.totalCantidadAlkosto || 0) + (existing.totalCantidadFamilia || 0);
        existing.totalRenglon = Number((existing.totalCantidad * existing.costoUnitario).toFixed(2));
      } else {
        itemsByCode.set(rawCode, {
          renglon: itemsByCode.size + 1,
          codigo: finalSku,
          skuCodizulca: finalSku,
          codigoBarra: finalBarcode,
          descripcion: cleanDesc,
          iva: mapped.iva,
          emp: mapped.emp,
          unid: finalUnid,
          totalCantidadAlkosto: pageChain === "ALKOSTO" ? mapped.totalCantidad : 0,
          totalCantidadFamilia: pageChain === "FAMILIA_CENTER" ? mapped.totalCantidad : 0,
          totalCantidad: mapped.totalCantidad,
          costoBruto: mapped.costoBruto,
          costoUnitario: mapped.costoUnitario,
          totalRenglon: mapped.totalRenglon,
          tiendas: { ...mapped.tiendas }
        });
      }
    }
  }
  const mergedItems = Array.from(itemsByCode.values()).map((it, idx) => {
    const hasAlkostoPage = cadenasDetectadas.includes("ALKOSTO");
    const primaryTotalCantidad = hasAlkostoPage && it.totalCantidadAlkosto > 0 ? it.totalCantidadAlkosto : it.totalCantidad;
    const primaryTotalRenglon = Number((primaryTotalCantidad * it.costoUnitario).toFixed(2));
    return {
      renglon: idx + 1,
      codigo: it.codigo,
      skuCodizulca: it.skuCodizulca,
      codigoBarra: it.codigoBarra,
      descripcion: it.descripcion,
      iva: it.iva,
      emp: it.emp,
      unid: it.unid,
      totalCantidad: primaryTotalCantidad,
      costoBruto: it.costoBruto,
      costoUnitario: it.costoUnitario,
      totalRenglon: primaryTotalRenglon,
      tiendas: it.tiendas
    };
  });
  const primaryCadena = cadenasDetectadas.includes("ALKOSTO") ? "ALKOSTO" : cadenasDetectadas.includes("FAMILIA_CENTER") ? "FAMILIA_CENTER" : "ALKOSTO";
  const computedSubtotal = primaryCadena === "ALKOSTO" && subtotalAlkosto > 0 ? subtotalAlkosto : primaryCadena === "FAMILIA_CENTER" && subtotalFamiliaCenter > 0 ? subtotalFamiliaCenter : mergedItems.reduce((acc, it) => acc + it.totalRenglon, 0);
  const computedSubtotalGeneral = subtotalGeneral > 0 ? subtotalGeneral : subtotalAlkosto > 0 || subtotalFamiliaCenter > 0 ? Number(((subtotalAlkosto || 0) + (subtotalFamiliaCenter || 0)).toFixed(2)) : Number(computedSubtotal.toFixed(2));
  const result = {
    clienteCadena: primaryCadena,
    cadenasDetectadas,
    ordenNro,
    sede: primaryCadena === "FAMILIA_CENTER" ? "FCOP" : sede,
    fechaEmision: normalizarFechaAlkosto(fechaEmision),
    fechaEntrega: normalizarFechaAlkosto(fechaEntrega),
    diasCredito,
    tasaCambio,
    proveedorNombre,
    proveedorRif,
    observaciones: observaciones || void 0,
    subtotal: Number(computedSubtotal.toFixed(2)),
    subtotalAlkosto: subtotalAlkosto > 0 ? subtotalAlkosto : void 0,
    subtotalFamiliaCenter: subtotalFamiliaCenter > 0 ? subtotalFamiliaCenter : void 0,
    subtotalGeneral: computedSubtotalGeneral > 0 ? computedSubtotalGeneral : void 0,
    items: mergedItems
  };
  return validateAndNormalizeAlkostoOC(result, { strictMath: true });
}
function splitTextIntoPages(rawText) {
  const parts = rawText.split(/(?=(?:ALKOSTO DONDE COMPRAR ES GANAR|FAMILIA CENTER,\s*C\.A|VECINO CENTER,\s*C\.A))/i);
  const filtered = parts.map((p) => p.trim()).filter((p) => p.length > 40);
  return filtered.length > 0 ? filtered : [rawText];
}
function extractPositionedTextFromAlkostoPdfBuffer(pdfBuffer, inflateSyncFn) {
  assertValidInputPayload(pdfBuffer, "extractPositionedTextFromAlkostoPdfBuffer");
  const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
  const latin1 = buf.toString("latin1");
  let cursor = 0;
  const pageTexts = [];
  while ((cursor = latin1.indexOf("stream", cursor)) !== -1) {
    let start = latin1.indexOf("\n", cursor);
    if (start === -1) break;
    start += 1;
    const end = latin1.indexOf("endstream", start);
    if (end === -1) break;
    const rawSlice = buf.subarray(start, end);
    cursor = end + 9;
    let inflated = "";
    try {
      inflated = inflateSyncFn(rawSlice).toString("latin1");
    } catch {
      continue;
    }
    if (!inflated.includes("BT") || !inflated.includes("ET") || !inflated.includes("Tm")) {
      continue;
    }
    const tokens = [];
    const btBlocks = inflated.match(/BT[\s\S]*?ET/g) || [];
    for (const block of btBlocks) {
      const tfMatch = block.match(/\/F\d+\s+([\d.]+)\s+Tf/);
      const fontSize = tfMatch ? parseFloat(tfMatch[1]) : 9.28;
      const tmMatch = block.match(/1\s+0\s+0(?:\.0+)?\s+-1\s+([\d.]+)\s+([\d.]+)\s+Tm/);
      if (!tmMatch) continue;
      let curX = parseFloat(tmMatch[1]);
      const y = parseFloat(tmMatch[2]);
      const tjMatch = block.match(/\[([\s\S]*?)\]\s*TJ/);
      if (!tjMatch) continue;
      const inner = tjMatch[1];
      const elems = inner.match(/<[0-9A-Fa-f]{4}>|-?\d+(?:\.\d+)?/g) || [];
      let curWord = "";
      let wordStartX = curX;
      for (const el of elems) {
        if (el.startsWith("<")) {
          const gid = parseInt(el.slice(1, 5), 16);
          const ch = decodeAlkostoGlyph(gid);
          if (!curWord) wordStartX = curX;
          curWord += ch;
          curX += fontSize * 0.5;
        } else {
          const kern = parseFloat(el);
          if (kern < -400) {
            if (curWord.trim()) {
              tokens.push({ x: wordStartX, y, txt: curWord.trim() });
            }
            curWord = "";
          }
          curX += -kern / 1e3 * fontSize;
        }
      }
      if (curWord.trim()) {
        tokens.push({ x: wordStartX, y, txt: curWord.trim() });
      }
    }
    if (tokens.length === 0) continue;
    tokens.sort((a, b) => Math.abs(a.y - b.y) < 2.5 ? a.x - b.x : a.y - b.y);
    const rows = [];
    for (const tok of tokens) {
      const lastRow = rows[rows.length - 1];
      if (lastRow && Math.abs(lastRow.y - tok.y) < 2.5) {
        lastRow.items.push(tok);
      } else {
        rows.push({ y: tok.y, items: [tok] });
      }
    }
    const pageLines = rows.map((r) => {
      r.items.sort((a, b) => a.x - b.x);
      return r.items.map((i) => i.txt).join("  ");
    });
    const pageStr = pageLines.join("\n");
    if (/Orden\s*Nro|ALKOSTO|FAMILIA\s*CENTER|VECINO\s*CENTER/i.test(pageStr)) {
      pageTexts.push(pageStr);
    }
  }
  return pageTexts.length > 0 ? pageTexts.join("\n\n") : null;
}
function decodeAlkostoGlyph(gid) {
  const code = gid + 29;
  if (code >= 32 && code <= 126) {
    return String.fromCharCode(code);
  }
  if (gid === 121) return "\xF3";
  if (gid === 105) return "\xE1";
  if (gid === 131) return "\xB0";
  return " ";
}
function validateAndNormalizeAlkostoOC(rawInput, options = {}) {
  const { strictMath = false, requireOrdenNro = true } = options;
  assertValidInputPayload(rawInput, "validateAndNormalizeAlkostoOC");
  const issues = [];
  let root = rawInput;
  if (typeof root === "object" && !Array.isArray(root)) {
    if (root.orden && typeof root.orden === "object" && !Array.isArray(root.orden)) root = root.orden;
    else if (root.ordenCompra && typeof root.ordenCompra === "object") root = root.ordenCompra;
    else if (root.ordenDeCompra && typeof root.ordenDeCompra === "object") root = root.ordenDeCompra;
    else if (root.orden_compra && typeof root.orden_compra === "object") root = root.orden_compra;
    else if (root.orden_de_compra && typeof root.orden_de_compra === "object") root = root.orden_de_compra;
    else if (root.pedido && typeof root.pedido === "object" && !Array.isArray(root.pedido)) root = root.pedido;
    else if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) root = root.data;
  }
  if (!root || typeof root !== "object") {
    throw new AlkostoParseValidationError(
      "El documento analizado no tiene una estructura de objeto JSON v\xE1lida.",
      [{ field: "root", message: "Se esperaba un objeto JSON de Orden de Compra", severity: "ERROR" }],
      "INVALID_ROOT_OBJECT"
    );
  }
  let rawItems = [];
  if (Array.isArray(root)) {
    rawItems = root;
    root = { items: rawItems };
  } else {
    const candidateKeys = ["items", "articulos", "art\xEDculos", "productos", "renglones", "detalle", "detalles", "lineas", "filas"];
    for (const key of candidateKeys) {
      if (Array.isArray(root[key])) {
        rawItems = root[key];
        break;
      }
    }
    if (rawItems.length === 0) {
      for (const k of Object.keys(root)) {
        if (Array.isArray(root[k]) && root[k].length > 0 && typeof root[k][0] === "object") {
          rawItems = root[k];
          break;
        }
      }
    }
  }
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new AlkostoParseValidationError(
      "No se encontraron renglones de productos en la Orden de Compra.",
      [{ field: "items", message: "La lista de productos (items) est\xE1 vac\xEDa o ausente", severity: "ERROR" }],
      "EMPTY_ITEMS_LIST"
    );
  }
  const pickProp = (obj, candidates) => {
    if (!obj || typeof obj !== "object") return void 0;
    for (const c of candidates) {
      if (obj[c] !== void 0 && obj[c] !== null && obj[c] !== "") return obj[c];
    }
    const normKey = (k) => k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const targetSet = new Set(candidates.map(normKey));
    for (const [k, v] of Object.entries(obj)) {
      if (v !== void 0 && v !== null && v !== "" && targetSet.has(normKey(k))) {
        return v;
      }
    }
    return void 0;
  };
  const nonEmptyRawItems = rawItems.filter((it) => {
    if (!it || typeof it !== "object") return true;
    const hasCod = Boolean(String(pickProp(it, ["codigo", "sku", "SKU", "skuCodizulca", "codigoBarra", "ean", "referencia"]) ?? "").trim());
    const hasDesc = Boolean(String(pickProp(it, ["descripcion", "DESCRIPCI\xD3N DEL PRODUCTO", "descripcionProducto", "producto", "nombre", "articulo"]) ?? "").trim());
    const hasCant = parseNumeroEstricto(pickProp(it, ["totalCantidad", "cantSolicitada", "CANT", "cantidad", "cant", "CANT. SOLICITADA"]), 0) > 0;
    const hasStores = it.tiendas && typeof it.tiendas === "object" && Object.values(it.tiendas).some((v) => parseNumeroEstricto(v, 0) > 0);
    return hasCod || hasDesc || hasCant || hasStores;
  });
  const itemsToValidate = nonEmptyRawItems.length > 0 ? nonEmptyRawItems : rawItems;
  const rawOrdenNro = String(
    pickProp(root, ["ordenNro", "numero_oc", "ORDEN DE COMPRA", "ordenCompra", "orden_compra", "numeroOrden", "nroOrden", "nro_orden", "oc"]) ?? pickProp(rawInput, ["ordenNro", "numero_oc", "ORDEN DE COMPRA", "ordenCompra", "numeroOrden", "nroOrden", "oc"]) ?? (typeof root.orden === "string" ? root.orden : "") ?? ""
  ).trim();
  if (requireOrdenNro && !rawOrdenNro) {
    issues.push({
      field: "ordenNro",
      message: "Falta el n\xFAmero de Orden de Compra (ordenNro).",
      severity: "ERROR"
    });
  }
  const rawNormalizedItems = [];
  itemsToValidate.forEach((it, idx) => {
    const renglonNum = Number(pickProp(it, ["renglon", "N\xB0", "nro", "numero"])) || idx + 1;
    if (!it || typeof it !== "object") {
      issues.push({
        field: `items[${idx}]`,
        renglon: renglonNum,
        message: `El rengl\xF3n ${renglonNum} no es un objeto v\xE1lido.`,
        severity: "ERROR"
      });
      return;
    }
    let rawCod = String(
      pickProp(it, [
        "codigo",
        "sku",
        "SKU",
        "skuCodizulca",
        "codigo_articulo",
        "codigo_producto",
        "codigoBarra",
        "codigo_barra",
        "ean",
        "barcode",
        "referencia"
      ]) ?? ""
    ).trim();
    let rawUnidInput = String(
      pickProp(it, [
        "unid",
        "UNID",
        "unidad",
        "unidadMedida",
        "unidad_medida",
        "cantSolicitadaUnid"
      ]) ?? ""
    ).trim();
    if (/^(CJ|CAJA|CAJAS|KG|KGS|KILOS|UND|UNID|UNIDADES|BLT|BTO|BTOS|BULTO|BULTOS)$/i.test(rawCod)) {
      const potentialCodeInUnid = rawUnidInput && !/^(CJ|CAJA|CAJAS|KG|KGS|KILOS|UND|UNID|UNIDADES|BLT|BTO|BTOS|BULTO|BULTOS)$/i.test(rawUnidInput) ? rawUnidInput : "";
      rawUnidInput = rawCod;
      rawCod = String(pickProp(it, ["skuCodizulca", "codigoBarra"]) ?? potentialCodeInUnid ?? "").trim();
    }
    const cleanCod = normalizarCodigoProducto(rawCod);
    const rawDesc = String(
      pickProp(it, [
        "descripcion",
        "DESCRIPCI\xD3N DEL PRODUCTO",
        "descripcionProducto",
        "descripcion_producto",
        "producto",
        "nombre",
        "articulo",
        "detalle"
      ]) ?? ""
    ).trim();
    const cleanDesc = limpiarDescripcionAlkosto(rawDesc);
    if (!cleanCod && !cleanDesc) {
      issues.push({
        field: `items[${idx}].codigo`,
        renglon: renglonNum,
        message: `El rengl\xF3n ${renglonNum} carece tanto de SKU/c\xF3digo como de descripci\xF3n.`,
        severity: "ERROR"
      });
      return;
    }
    const match = resolverProductoPorCodigoODescripcion(cleanCod, cleanDesc);
    const finalSku = (match ? match.sku : "") || (it.skuCodizulca ? normalizarCodigoProducto(it.skuCodizulca) : "") || cleanCod;
    const finalCodigo = finalSku || cleanCod || (match?.codigoBarra ?? "");
    const finalBarcode = it.codigoBarra || it.ean || match?.codigoBarra || (/^\d{12,14}$/.test(cleanCod) ? cleanCod : void 0);
    const finalDesc = cleanDesc || (match ? match.producto : "");
    if (!finalCodigo) {
      issues.push({
        field: `items[${idx}].codigo`,
        renglon: renglonNum,
        message: `El rengl\xF3n ${renglonNum} ("${finalDesc}") no tiene un SKU identificable.`,
        severity: "ERROR"
      });
      return;
    }
    let cleanTiendas = {};
    if (it.tiendas && typeof it.tiendas === "object") {
      for (const [tag, val] of Object.entries(it.tiendas)) {
        const uTag = tag.trim().toUpperCase();
        const numVal = parseNumeroEstricto(val, NaN);
        if (Number.isNaN(numVal) || numVal < 0) {
          issues.push({
            field: `items[${idx}].tiendas.${uTag}`,
            renglon: renglonNum,
            message: `Valor inv\xE1lido en tienda ${uTag} del rengl\xF3n ${renglonNum}: "${val}"`,
            severity: "ERROR"
          });
          continue;
        }
        if (numVal > 0 && ALL_VALID_STORE_TAGS.has(uTag) && uTag !== "CI" && uTag !== "AKOP" && uTag !== "FCOP") {
          cleanTiendas[uTag] = numVal;
        }
      }
    }
    for (const [k, val] of Object.entries(it)) {
      const uKey = k.trim().toUpperCase();
      if (ALL_VALID_STORE_TAGS.has(uKey) && uKey !== "CI" && uKey !== "AKOP" && uKey !== "FCOP") {
        const numVal = parseNumeroEstricto(val, 0);
        if (numVal > 0) {
          cleanTiendas[uKey] = numVal;
        }
      }
    }
    const empNum = parseNumeroEstricto(it.emp, 0);
    const ivaNum = parseNumeroEstricto(it.iva, 0);
    const finalUnid = normalizarUnidadMedidaAlkosto(
      rawUnidInput,
      finalDesc,
      empNum,
      match?.unidadSugerida
    );
    let totalCant = parseNumeroEstricto(
      pickProp(it, [
        "totalCantidad",
        "cantSolicitada",
        "CANT",
        "cantidadSolicitada",
        "cantidad_solicitada",
        "total_cantidad",
        "cantidad",
        "cant",
        "cajas",
        "bultos"
      ]),
      0
    );
    const totalCantAkExplicit = parseNumeroEstricto(
      pickProp(it, ["totalCantidadAlkosto", "total_cantidad_alkosto"]),
      0
    );
    const totalCantFcExplicit = parseNumeroEstricto(
      pickProp(it, ["totalCantidadFamilia", "total_cantidad_familia", "totalCantidadFamiliaCenter", "total_cantidad_familia_center"]),
      0
    );
    if (totalCantAkExplicit > 0 || totalCantFcExplicit > 0) {
      const akMap = {};
      const fcMap = {};
      const otherMap = {};
      for (const [tk, tv] of Object.entries(cleanTiendas)) {
        if (tk.startsWith("AK")) akMap[tk] = tv;
        else if (tk.startsWith("FC")) fcMap[tk] = tv;
        else otherMap[tk] = tv;
      }
      const fixedAk = totalCantAkExplicit > 0 ? autocorregirTiendasPorFila(akMap, totalCantAkExplicit) : akMap;
      const fixedFc = totalCantFcExplicit > 0 ? autocorregirTiendasPorFila(fcMap, totalCantFcExplicit) : fcMap;
      cleanTiendas = { ...fixedAk, ...fixedFc, ...otherMap };
    } else if (totalCant > 0) {
      const akKeys = Object.keys(cleanTiendas).filter((tk) => tk.startsWith("AK"));
      const fcKeys = Object.keys(cleanTiendas).filter((tk) => tk.startsWith("FC"));
      if (akKeys.length > 0 && fcKeys.length === 0) {
        cleanTiendas = autocorregirTiendasPorFila(cleanTiendas, totalCant);
      } else if (fcKeys.length > 0 && akKeys.length === 0) {
        cleanTiendas = autocorregirTiendasPorFila(cleanTiendas, totalCant);
      } else {
        cleanTiendas = autocorregirTiendasPorFila(cleanTiendas, totalCant);
      }
    }
    const sumAkTiendas = Object.entries(cleanTiendas).filter(([tk]) => tk.startsWith("AK")).reduce((acc, [, v]) => acc + v, 0);
    const sumFcTiendas = Object.entries(cleanTiendas).filter(([tk]) => tk.startsWith("FC")).reduce((acc, [, v]) => acc + v, 0);
    const sumAllTiendas = Object.values(cleanTiendas).reduce((acc, v) => acc + v, 0);
    const cantDespachadaRaw = pickProp(it, ["cantDespachada", "CANTIDAD DESPACHADA", "cantidadDespachada", "cantidad_despachada"]) ?? "";
    const cantDespachadaClean = cantDespachadaRaw !== "" && cantDespachadaRaw !== null && cantDespachadaRaw !== void 0 ? String(parseNumeroEstricto(cantDespachadaRaw, 0) || cantDespachadaRaw).trim() : "";
    if (totalCant < 0) {
      issues.push({
        field: `items[${idx}].totalCantidad`,
        renglon: renglonNum,
        message: `Cantidad negativa (${totalCant}) en rengl\xF3n ${renglonNum}.`,
        severity: "ERROR"
      });
    }
    if (sumAllTiendas > 0) {
      const matchesAll = Math.abs(sumAllTiendas - totalCant) <= 0.05;
      const matchesAk = sumAkTiendas > 0 && Math.abs(sumAkTiendas - totalCant) <= 0.05;
      const matchesFc = sumFcTiendas > 0 && Math.abs(sumFcTiendas - totalCant) <= 0.05;
      if (totalCant === 0) {
        totalCant = sumAkTiendas > 0 && sumFcTiendas === 0 ? sumAkTiendas : sumAllTiendas;
      } else if (!matchesAll && !matchesAk && !matchesFc) {
        if (strictMath) {
          issues.push({
            field: `items[${idx}].totalCantidad`,
            renglon: renglonNum,
            message: `Desalineaci\xF3n en rengl\xF3n ${renglonNum} (${finalCodigo}): la suma de tiendas (${sumAllTiendas}) no coincide con Total Cantidad (${totalCant}).`,
            severity: "ERROR"
          });
        } else {
          totalCant = sumAkTiendas > 0 && sumFcTiendas === 0 ? sumAkTiendas : totalCant;
        }
      }
    }
    let precio = parseNumeroEstricto(
      pickProp(it, [
        "costoUnitario",
        "PRECIO",
        "precio",
        "precioUnitario",
        "precio_unitario",
        "costo_unitario",
        "costoBruto",
        "costo_bruto"
      ]),
      0
    );
    let totalRenglon = parseNumeroEstricto(
      pickProp(it, [
        "totalRenglon",
        "SUB TOTAL",
        "subtotal",
        "subTotal",
        "sub_total",
        "total_renglon",
        "importe",
        "monto"
      ]),
      0
    );
    if (precio < 0 || totalRenglon < 0) {
      issues.push({
        field: `items[${idx}].costoUnitario`,
        renglon: renglonNum,
        message: `Precio o total negativo en rengl\xF3n ${renglonNum}.`,
        severity: "ERROR"
      });
    }
    if (!precio && totalRenglon > 0 && totalCant > 0) {
      precio = Number((totalRenglon / totalCant).toFixed(4));
    } else if (precio > 0 && !totalRenglon && totalCant > 0) {
      totalRenglon = Number((totalCant * precio).toFixed(2));
    } else if (precio > 0 && totalCant > 0 && totalRenglon > 0) {
      const expectedTotal = Number((totalCant * precio).toFixed(2));
      if (Math.abs(expectedTotal - totalRenglon) > Math.max(0.5, expectedTotal * 0.02)) {
        if (strictMath) {
          issues.push({
            field: `items[${idx}].totalRenglon`,
            renglon: renglonNum,
            message: `Inconsistencia matem\xE1tica en rengl\xF3n ${renglonNum} (${finalCodigo}): ${totalCant} x ${precio} = ${expectedTotal}, pero figura ${totalRenglon}.`,
            severity: "ERROR"
          });
        } else {
          totalRenglon = expectedTotal;
        }
      }
    }
    if (totalCant <= 0 && sumAllTiendas <= 0) {
      issues.push({
        field: `items[${idx}].totalCantidad`,
        renglon: renglonNum,
        message: `El rengl\xF3n ${renglonNum} (${finalCodigo}) tiene cantidad solicitada 0.`,
        severity: "ERROR"
      });
    }
    rawNormalizedItems.push({
      renglon: rawNormalizedItems.length + 1,
      codigo: finalCodigo,
      skuCodizulca: finalSku,
      codigoBarra: finalBarcode,
      descripcion: finalDesc,
      iva: ivaNum,
      emp: empNum,
      unid: finalUnid,
      totalCantidad: totalCant,
      cantDespachada: cantDespachadaClean,
      costoBruto: parseNumeroEstricto(it.costoBruto, precio),
      costoUnitario: precio,
      totalRenglon: Number(totalRenglon.toFixed(2)),
      tiendas: cleanTiendas
    });
  });
  const errorIssues = issues.filter((i) => i.severity === "ERROR");
  if (errorIssues.length > 0) {
    throw new AlkostoParseValidationError(
      `Error de validaci\xF3n en Orden de Compra Alkosto: ${errorIssues.map((e) => e.message).join(" | ")}`,
      issues,
      "SCHEMA_VALIDATION_FAILED"
    );
  }
  const mergedByCodeMap = /* @__PURE__ */ new Map();
  for (const item of rawNormalizedItems) {
    const hasStores = item.tiendas && Object.keys(item.tiendas).length > 0;
    const key = hasStores ? item.codigo : `${item.codigo}#${item.renglon}`;
    const existing = mergedByCodeMap.get(key);
    if (existing && hasStores) {
      const mergedTiendas = { ...existing.tiendas || {} };
      for (const [tk, tv] of Object.entries(item.tiendas || {})) {
        mergedTiendas[tk] = (mergedTiendas[tk] || 0) + tv;
      }
      const sumAk = Object.entries(mergedTiendas).filter(([tk]) => tk.startsWith("AK")).reduce((acc, [, v]) => acc + v, 0);
      const sumAll = Object.values(mergedTiendas).reduce((acc, v) => acc + v, 0);
      const primaryCant = sumAk > 0 ? sumAk : sumAll;
      existing.tiendas = mergedTiendas;
      existing.totalCantidad = primaryCant;
      existing.totalRenglon = Number((primaryCant * existing.costoUnitario).toFixed(2));
    } else {
      mergedByCodeMap.set(key, {
        ...item,
        renglon: mergedByCodeMap.size + 1
      });
    }
  }
  const normalizedItems = Array.from(mergedByCodeMap.values());
  const allStoreTags = /* @__PURE__ */ new Set();
  normalizedItems.forEach((it) => {
    if (it.tiendas) Object.keys(it.tiendas).forEach((t) => allStoreTags.add(t));
  });
  const hasAk = Array.from(allStoreTags).some((t) => t.startsWith("AK"));
  const hasFc = Array.from(allStoreTags).some((t) => t.startsWith("FC"));
  const clienteNombreClean = String(pickProp(root, ["clienteNombre", "CLIENTE", "cliente"]) ?? pickProp(rawInput, ["clienteNombre", "CLIENTE", "cliente"]) ?? "").trim();
  const idClienteClean = String(pickProp(root, ["idCliente", "ID CLIENTE", "codigoCliente", "codCliente"]) ?? pickProp(rawInput, ["idCliente", "ID CLIENTE", "codigoCliente"]) ?? "").trim();
  const rutaClean = String(pickProp(root, ["ruta", "RUTA"]) ?? pickProp(rawInput, ["ruta", "RUTA"]) ?? "").trim();
  const supervisorClean = String(pickProp(root, ["supervisor", "SUPERVISOR"]) ?? pickProp(rawInput, ["supervisor", "SUPERVISOR"]) ?? "").trim();
  const choferClean = String(pickProp(root, ["chofer", "CHOFER"]) ?? pickProp(rawInput, ["chofer", "CHOFER"]) ?? "").trim();
  const cantidadCestasClean = pickProp(root, ["cantidadCestas", "CANTIDAD DE CESTAS"]) ?? pickProp(rawInput, ["cantidadCestas", "CANTIDAD DE CESTAS"]);
  const nroPedidoClean = String(pickProp(root, ["nroPedido", "N\xB0 DE PEDIDO", "numeroPedido"]) ?? pickProp(rawInput, ["nroPedido", "N\xB0 DE PEDIDO"]) ?? "").trim();
  const observacionesClean = String(pickProp(root, ["observaciones", "OBSERVACIONES"]) ?? pickProp(rawInput, ["observaciones", "OBSERVACIONES"]) ?? "").trim();
  const fechaEmisionExtraida = String(pickProp(root, ["fechaEmision", "fecha_emision"]) ?? "").trim();
  const fechaEntregaExtraida = String(pickProp(root, ["fechaEntrega", "fecha_entrega", "FECHA", "fecha", "entrega", "fechaEmision", "fecha_emision"]) ?? "").trim();
  let clienteCadena = String(root.clienteCadena || rawInput.clienteCadena || "").trim().toUpperCase();
  if (hasAk && !clienteCadena) {
    clienteCadena = "ALKOSTO";
  } else if (hasFc && !hasAk) {
    clienteCadena = "FAMILIA_CENTER";
  } else if (!clienteCadena) {
    const sedeStr = String(root.sede || "").toUpperCase();
    clienteCadena = sedeStr.startsWith("FC") || /FAMILIA/i.test(String(root.proveedorNombre || "")) || /FAMILIA/i.test(clienteNombreClean) ? "FAMILIA_CENTER" : "ALKOSTO";
  }
  const calcSubtotalAlkosto = Number(
    normalizedItems.reduce((acc, it) => {
      const akQty = Object.entries(it.tiendas || {}).filter(([tk]) => tk.startsWith("AK")).reduce((s, [, v]) => s + v, 0);
      return acc + Number((akQty * (it.costoUnitario || 0)).toFixed(2));
    }, 0).toFixed(2)
  );
  const calcSubtotalFamilia = Number(
    normalizedItems.reduce((acc, it) => {
      const fcQty = Object.entries(it.tiendas || {}).filter(([tk]) => tk.startsWith("FC")).reduce((s, [, v]) => s + v, 0);
      return acc + Number((fcQty * (it.costoUnitario || 0)).toFixed(2));
    }, 0).toFixed(2)
  );
  const explicitSubAk = parseNumeroEstricto(pickProp(root, ["subtotalAlkosto", "subtotal_alkosto"]), 0);
  const explicitSubFc = parseNumeroEstricto(pickProp(root, ["subtotalFamiliaCenter", "subtotal_familia_center"]), 0);
  const explicitSubGen = parseNumeroEstricto(pickProp(root, ["subtotalGeneral", "subtotal_general"]), 0);
  const finalSubAk = explicitSubAk > 0 ? explicitSubAk : calcSubtotalAlkosto > 0 ? calcSubtotalAlkosto : void 0;
  const finalSubFc = explicitSubFc > 0 ? explicitSubFc : calcSubtotalFamilia > 0 ? calcSubtotalFamilia : void 0;
  const finalSubGen = explicitSubGen > 0 ? explicitSubGen : finalSubAk || finalSubFc ? Number(((finalSubAk || 0) + (finalSubFc || 0)).toFixed(2)) : void 0;
  const subtotalCalc = normalizedItems.reduce((acc, it) => acc + (it.totalRenglon || 0), 0);
  const rawSubtotal = parseNumeroEstricto(root.subtotal ?? root.total, 0);
  return {
    clienteCadena,
    cadenasDetectadas: root.cadenasDetectadas || (hasAk && hasFc ? ["ALKOSTO", "FAMILIA_CENTER"] : [clienteCadena]),
    clienteNombre: clienteNombreClean || void 0,
    idCliente: idClienteClean || void 0,
    ruta: rutaClean || void 0,
    supervisor: supervisorClean || void 0,
    chofer: choferClean || void 0,
    cantidadCestas: cantidadCestasClean !== void 0 ? cantidadCestasClean : void 0,
    nroPedido: nroPedidoClean || void 0,
    ordenNro: rawOrdenNro || "S/N",
    sede: String(root.sede || (clienteCadena === "FAMILIA_CENTER" ? "FCOP" : "AKOP")).trim(),
    fechaEmision: normalizarFechaAlkosto(fechaEmisionExtraida || fechaEntregaExtraida || ""),
    fechaEntrega: normalizarFechaAlkosto(fechaEntregaExtraida || ""),
    diasCredito: parseNumeroEstricto(pickProp(root, ["diasCredito", "dias_credito"]), 15),
    tasaCambio: parseNumeroEstricto(pickProp(root, ["tasaCambio", "tasa_cambio"]), 0),
    proveedorNombre: String(root.proveedorNombre || "CODIZULCA, C.A.").trim(),
    proveedorRif: String(root.proveedorRif || "J409876136").trim(),
    observaciones: observacionesClean || void 0,
    subtotal: rawSubtotal > 0 ? rawSubtotal : Number(subtotalCalc.toFixed(2)),
    subtotalAlkosto: finalSubAk,
    subtotalFamiliaCenter: finalSubFc,
    subtotalGeneral: finalSubGen,
    items: normalizedItems
  };
}
function normalizarCadenaEstricta(tagOrName, fallbackCadena) {
  const combined = `${tagOrName || ""} ${fallbackCadena || ""}`.toUpperCase();
  if (combined.includes("FAMILIA") || /\bFC0?[1-7]\b|\bFCOP\b/.test(combined) || /\b0*7489\b|\b0*749[0-4]\b|\b0*8229\b|\b0*5373\b/.test(combined)) {
    return "FAMILIA CENTER";
  }
  return "ALKOSTO";
}
function validarNumeroOC(rawOc) {
  const raw = String(rawOc ?? "").trim();
  if (!raw || raw.toUpperCase() === "S/N" || raw.toUpperCase() === "N/A" || raw.toUpperCase() === "PENDIENTE") {
    return {
      valido: false,
      numero_oc: "S/N",
      alerta: 'Falta el n\xFAmero de Orden de Compra (OC). Verifica la casilla "ORDEN DE COMPRA" antes de enviar.'
    };
  }
  const match = raw.match(/(?:OC[-\s#:]*)?([A-Z0-9\-]{4,20})/i);
  const candidate = match ? match[1].trim().toUpperCase() : raw.toUpperCase();
  const hasMinDigits = (candidate.match(/\d/g) || []).length >= 4;
  if (!hasMinDigits) {
    return {
      valido: false,
      numero_oc: candidate || "S/N",
      alerta: `El n\xFAmero de Orden de Compra "${raw}" no tiene al menos 4 d\xEDgitos v\xE1lidos.`
    };
  }
  return {
    valido: true,
    numero_oc: candidate
  };
}
function construirObservacionFormateada(params) {
  const cadenaNorm = normalizarCadenaEstricta(params.cadena, params.sucursal_cliente);
  const sucursalClean = String(params.sucursal_cliente || params.ciudad_zona || cadenaNorm).trim().toUpperCase();
  const ocCheck = validarNumeroOC(params.numero_oc);
  const ocVal = ocCheck.numero_oc || "S/N";
  let rawDir = String(params.direccion_despacho || "").replace(/\s*\|\s*OC\s+(?:ALKOSTO|FAMILIA(?:\s+CENTER)?)\s*:\s*[^|]+/gi, "").replace(/^.*\|\s*Dir:\s*/i, "").trim();
  if (!rawDir || rawDir.toUpperCase() === sucursalClean) {
    rawDir = params.ciudad_zona?.trim() || sucursalClean || "Entrega seg\xFAn Orden de Compra";
  }
  return `${sucursalClean} | OC ${cadenaNorm}: ${ocVal} | Dir: ${rawDir}`;
}
function normalizarNombreVendedorSairu(raw) {
  const s = String(raw || "").trim();
  if (!s) return "Sairu Valles";
  const upper = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (upper.includes("SAIRU") || upper.includes("VALLES") || upper.includes("CUENTAS CLAVE")) {
    return "Sairu Valles";
  }
  return s;
}
function generarIdDeterministaPedidoAlkosto(params) {
  const cleanTag = /^(ak\d+|fc\d+)$/i.test(params.tagSlug) ? params.tagSlug.toLowerCase() : "doc";
  const ocClean = String(params.numeroOc || "SN").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^0+/, "") || "SN";
  const canonicalItems = [...params.renglones].map(
    (r) => `${String(r.codigo || "").trim().toUpperCase()}:${String(r.unidad_medida || "").toUpperCase()}:${Number(r.cantidad || 0).toFixed(2)}:${Number(r.precio_unitario || 0).toFixed(4)}:${Number(r.descuento || 0).toFixed(2)}:${Number(r.subtotal || 0).toFixed(2)}`
  ).sort().join("|");
  const seed = `${cleanTag}|${String(params.idCliente || "").trim()}|${ocClean}|${String(params.fechaISO || "").slice(0, 10)}|${canonicalItems}`;
  let h1 = 2166136261;
  let h2 = 16777619;
  for (let i = 0; i < seed.length; i++) {
    const code = seed.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 16777619);
    h2 ^= code + (i & 255);
    h2 = Math.imul(h2, 2246822507);
  }
  const hashHex = `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`.slice(0, 10);
  const ocPrefix = ocClean !== "SN" ? ocClean.slice(-6).toLowerCase() : "m";
  return `alk-${cleanTag}-${ocPrefix}${hashHex}`;
}
function calcularResumenCuadreOC(data, ordenNroOverride) {
  if (!data || !Array.isArray(data.items) || data.items.length === 0) return null;
  const numero_oc = String(ordenNroOverride || data.ordenNro || "S/N").trim();
  const akStoresTotals = /* @__PURE__ */ new Map();
  const fcStoresTotals = /* @__PURE__ */ new Map();
  for (const item of data.items) {
    const precio = parseNumeroEstricto(item.costoUnitario, 0);
    if (!item.tiendas || typeof item.tiendas !== "object") continue;
    for (const [rawTag, rawQty] of Object.entries(item.tiendas)) {
      const tag = rawTag.trim().toUpperCase();
      if (tag === "CI" || tag === "AKOP" || tag === "FCOP") continue;
      const qty = parseNumeroEstricto(rawQty, 0);
      if (!Number.isFinite(qty) || Number.isNaN(qty) || qty <= 0) continue;
      const lineSub = Number((qty * precio).toFixed(2));
      if (tag.startsWith("AK")) {
        akStoresTotals.set(tag, Number(((akStoresTotals.get(tag) || 0) + lineSub).toFixed(2)));
      } else if (tag.startsWith("FC")) {
        fcStoresTotals.set(tag, Number(((fcStoresTotals.get(tag) || 0) + lineSub).toFixed(2)));
      }
    }
  }
  const alkostoCount = akStoresTotals.size;
  const familiaCount = fcStoresTotals.size;
  const totalSucursalesActivas = alkostoCount + familiaCount;
  if (totalSucursalesActivas === 0) return null;
  const alkostoMonto = Number(
    Array.from(akStoresTotals.values()).reduce((a, b) => a + b, 0).toFixed(2)
  );
  const familiaMonto = Number(
    Array.from(fcStoresTotals.values()).reduce((a, b) => a + b, 0).toFixed(2)
  );
  const totalCalculado = Number((alkostoMonto + familiaMonto).toFixed(2));
  const subAkPdf = parseNumeroEstricto(data.subtotalAlkosto, 0);
  const subFcPdf = parseNumeroEstricto(data.subtotalFamiliaCenter, 0);
  const subGenPdf = parseNumeroEstricto(data.subtotalGeneral, 0);
  const totalEsperadoPDF = subGenPdf > 0 ? subGenPdf : subAkPdf > 0 || subFcPdf > 0 ? Number(((subAkPdf > 0 ? subAkPdf : alkostoMonto) + (subFcPdf > 0 ? subFcPdf : familiaMonto)).toFixed(2)) : totalCalculado;
  const cuadreAk = subAkPdf > 0 ? Math.abs(alkostoMonto - subAkPdf) <= 0.05 : true;
  const cuadreFc = subFcPdf > 0 ? Math.abs(familiaMonto - subFcPdf) <= 0.05 : true;
  const cuadreTotal = Math.abs(totalCalculado - totalEsperadoPDF) <= 0.05;
  const cuadreExacto = cuadreAk && cuadreFc && cuadreTotal;
  const fmtUSD = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const partesCadena = [];
  if (alkostoCount > 0) {
    partesCadena.push(`${alkostoCount} Alkosto: ${fmtUSD(alkostoMonto)}`);
  }
  if (familiaCount > 0) {
    partesCadena.push(`${familiaCount} Familia Center: ${fmtUSD(familiaMonto)}`);
  }
  const estadoTexto = cuadreExacto ? "\u2713 Cuadre Exacto" : `\u26A0\uFE0F Diferencia vs PDF (${fmtUSD(totalEsperadoPDF)})`;
  const textoResumen = `OC #${numero_oc} | ${totalSucursalesActivas} Sucursales Activas (${partesCadena.join(" | ")}) | Total OC: ${fmtUSD(totalCalculado)} ${estadoTexto}`;
  return {
    numero_oc,
    totalSucursalesActivas,
    alkostoCount,
    alkostoMonto,
    familiaCount,
    familiaMonto,
    totalCalculado,
    totalEsperadoPDF,
    cuadreExacto,
    textoResumen
  };
}

// src/utils/vendorRoutes.ts
var SUPERVISOR_SUMMARY_COLUMNS = /* @__PURE__ */ new Set([
  "ALI PEREZ",
  "NELSON FINOL",
  "JOHNATAN SOTO"
]);
function normalizeVendorName(val) {
  if (!val) return "";
  return String(val).replace(/Ã‘|Ã±/g, "\xD1").replace(/\s+/g, " ").replace(/\s*-\s*/g, " - ").trim().toUpperCase();
}
function normalizeAsciiKey(val) {
  if (!val) return "";
  return String(val).replace(/Ã‘|Ã±/g, "N").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
var VENDOR_PROFILES = {
  "MARIA BRICE\xD1O": {
    canonicalUsername: "MARIA BRICE\xD1O",
    displayName: "Mar\xEDa Brice\xF1o",
    routes: [
      { id: "MARIA BRICE\xD1O", label: "Ruta Mar\xEDa Brice\xF1o", aliases: ["MARIA BRICE\xD1O", "MARIA BRICENO", "MARIA BRICE\xC3\u2018O"] }
    ]
  },
  "MARIANA CHACIN": {
    canonicalUsername: "MARIANA CHACIN",
    displayName: "Mariana Chac\xEDn",
    routes: [
      { id: "CUENTAS CLAVE 1", label: "Cuentas Clave 1 (MC)", aliases: ["CUENTAS CLAVE 1", "CUENTAS CLAVE 1 - MC", "MARIANA CHACIN"] }
    ]
  },
  "MIKELANGELO DIAZ": {
    canonicalUsername: "MIKELANGELO DIAZ",
    displayName: "Mikelangelo Diaz",
    email: "Mikelangelodiaz@gmail.com",
    routes: [
      {
        id: "MIKELANGELO DIAZ",
        label: "Ruta Mikelangelo Diaz (Principal)",
        aliases: [
          "MIKELANGELO DIAZ",
          "MIKELANGELO DIAZ1",
          "MIKELANGELO",
          "MIKELANGELO DIAZ - PRINCIPAL",
          "MIKELANGELO DIAZ-PRINCIPAL",
          "MIKELANGELO DIAZ (PRINCIPAL)",
          "MIKELANGELODIAZ@GMAIL.COM",
          "JOHNATAN SOTO",
          "JOHNATAN",
          "JONATHAN",
          "JHONATAN",
          "JHONATAN SOTO",
          "RUTA MIKELANGELO DIAZ",
          "RUTA JOHNATAN SOTO"
        ]
      },
      {
        id: "MIKELANGELO DIAZ - VILLA DEL ROS",
        label: "Ruta Villa del Rosario",
        aliases: [
          "MIKELANGELO DIAZ - VILLA DEL ROS",
          "MIKELANGELO DIAZ- VILLA DEL ROS",
          "MIKELANGELO DIAZ-VILLA DEL ROS",
          "MIKELANGELO DIAZ VILLA DEL ROS",
          "MIKELANGELO DIAZ - VILLA DEL ROSARIO",
          "MIKELANGELO DIAZ VILLA DEL ROSARIO",
          "MIKELANGELO VILLA DEL ROS",
          "MIKELANGELO - VILLA DEL ROS",
          "MIKELANGELO VILLA DEL ROSARIO",
          "JOHNATAN SOTO VILLA DEL ROS",
          "JOHNATAN SOTO - VILLA DEL ROS",
          "JOHNATAN SOTO VILLA DEL ROSARIO",
          "JOHNATAN SOTO - VILLA DEL ROSARIO",
          "VILLA DEL ROSARIO",
          "VILLA DEL ROS",
          "RUTA VILLA DEL ROSARIO",
          "RUTA VILLA DEL ROS"
        ]
      }
    ]
  },
  "HERNAN PAZ": {
    canonicalUsername: "HERNAN PAZ",
    displayName: "Hern\xE1n Paz",
    routes: [
      { id: "HERNAN PAZ", label: "Ruta Hern\xE1n Paz", aliases: ["HERNAN PAZ"] }
    ]
  },
  "OSWALDO CHURION": {
    canonicalUsername: "OSWALDO CHURION",
    displayName: "Oswaldo Churi\xF3n",
    routes: [
      { id: "OSWALDO CHURION", label: "Ruta Oswaldo Churi\xF3n", aliases: ["OSWALDO CHURION"] }
    ]
  },
  "CARLOS FUENMAYOR": {
    canonicalUsername: "CARLOS FUENMAYOR",
    displayName: "Carlos Fuenmayor",
    routes: [
      { id: "CARLOS FUENMAYOR", label: "Ruta Carlos Fuenmayor", aliases: ["CARLOS FUENMAYOR"] }
    ]
  },
  "SARAH REYES": {
    canonicalUsername: "SARAH REYES",
    displayName: "Sarah Reyes",
    routes: [
      { id: "SARAH REYES", label: "Ruta Sarah Reyes", aliases: ["SARAH REYES"] }
    ]
  },
  "J PABLO ARAUJO": {
    canonicalUsername: "J PABLO ARAUJO",
    displayName: "J Pablo Araujo",
    routes: [
      { id: "J PABLO ARAUJO", label: "Ruta J Pablo Araujo", aliases: ["J PABLO ARAUJO"] },
      { id: "J PABLO ARAUJO - CAB/OJE", label: "Ruta Cabimas / Ojeda", aliases: ["J PABLO ARAUJO - CAB/OJE", "J PABLO ARAUJO - CAB", "J PABLO ARAUJO- CAB/OJE"] }
    ]
  },
  "J PABLO ARAUJO - CAB/OJE": {
    canonicalUsername: "J PABLO ARAUJO",
    displayName: "J Pablo Araujo",
    routes: [
      { id: "J PABLO ARAUJO", label: "Ruta J Pablo Araujo", aliases: ["J PABLO ARAUJO"] },
      { id: "J PABLO ARAUJO - CAB/OJE", label: "Ruta Cabimas / Ojeda", aliases: ["J PABLO ARAUJO - CAB/OJE", "J PABLO ARAUJO - CAB", "J PABLO ARAUJO- CAB/OJE"] }
    ]
  },
  "JOSE G. GONZALEZ": {
    canonicalUsername: "JOSE G. GONZALEZ",
    displayName: "Jos\xE9 G. Gonz\xE1lez",
    routes: [
      { id: "JOSE G. GONZALEZ", label: "Ruta Jos\xE9 G. Gonz\xE1lez", aliases: ["JOSE G. GONZALEZ", "JOSE GONZALEZ"] }
    ]
  },
  "FOOD SERVICE SUR": {
    canonicalUsername: "FOOD SERVICE SUR",
    displayName: "Food Service Sur",
    routes: [
      { id: "FOOD SERVICE SUR", label: "Ruta Food Service Sur", aliases: ["FOOD SERVICE SUR"] }
    ]
  },
  "JAIDER MEDINA - FOOD SERVICE NORTE": {
    canonicalUsername: "JAIDER MEDINA - FOOD SERVICE NORTE",
    displayName: "Jaider Medina (Food Service Norte)",
    routes: [
      { id: "JAIDER MEDINA - FOOD SERVICE NORTE", label: "Ruta Food Service Norte", aliases: ["JAIDER MEDINA - FOOD SERVICE NORTE", "JAIDER MEDINA", "FOOD SERVICE NORTE"] }
    ]
  },
  "ANGELICA MORENO": {
    canonicalUsername: "ANGELICA MORENO",
    displayName: "Ang\xE9lica Moreno",
    routes: [
      { id: "ANGELICA MORENO", label: "Ruta Ang\xE9lica Moreno", aliases: ["ANGELICA MORENO"] }
    ]
  },
  "ADEL JARABA": {
    canonicalUsername: "ADEL JARABA",
    displayName: "Adel Jaraba",
    routes: [
      { id: "ADEL JARABA", label: "Ruta Adel Jaraba", aliases: ["ADEL JARABA"] }
    ]
  },
  "JUAN HERNANDEZ": {
    canonicalUsername: "JUAN HERNANDEZ",
    displayName: "Juan Hern\xE1ndez",
    routes: [
      { id: "JUAN HERNANDEZ", label: "Ruta Juan Hern\xE1ndez", aliases: ["JUAN HERNANDEZ"] },
      { id: "FOOD SERVICE SENIOR", label: "Ruta Food Service Senior", aliases: ["FOOD SERVICE SENIOR", "FOOD SERVICE SENIOR - JUAN HERNANDEZ"] }
    ]
  },
  "YOLEIDA LUGO": {
    canonicalUsername: "YOLEIDA LUGO",
    displayName: "Yoleida Lugo",
    routes: [
      { id: "YOLEIDA LUGO", label: "Ruta Yoleida Lugo", aliases: ["YOLEIDA LUGO"] }
    ]
  },
  "SAIRU VALLES": {
    canonicalUsername: "SAIRU VALLES",
    displayName: "Sair\xFA Valles",
    routes: [
      { id: "CUENTAS CLAVE 2", label: "Ruta Cuentas Clave 2 (SV)", aliases: ["CUENTAS CLAVE 2", "CUENTAS CLAVE 2 - SV"] },
      { id: "SAIRU VALLES", label: "Ruta Sair\xFA Valles", aliases: ["SAIRU VALLES"] }
    ]
  },
  "ELISA SOLER": {
    canonicalUsername: "ELISA SOLER",
    displayName: "Elisa Soler",
    routes: [
      { id: "ELISA SOLER", label: "Ruta Elisa Soler", aliases: ["ELISA SOLER"] }
    ]
  },
  "ANGEL NAVARRO": {
    canonicalUsername: "ANGEL NAVARRO",
    displayName: "\xC1ngel Navarro",
    routes: [
      { id: "ANGEL NAVARRO", label: "Ruta \xC1ngel Navarro", aliases: ["ANGEL NAVARRO", "\xC1NGEL NAVARRO"] }
    ]
  },
  "MARIANGEL GONZALEZ": {
    canonicalUsername: "MARIANGEL GONZALEZ",
    displayName: "Mariangel Gonz\xE1lez",
    routes: [
      { id: "MARIANGEL GONZALEZ", label: "Ruta Mariangel Gonz\xE1lez", aliases: ["MARIANGEL GONZALEZ", "MARIANGEL GONZ\xC1LEZ", "MARIANGEL"] }
    ]
  },
  "VICTOR CAMPOS": {
    canonicalUsername: "VICTOR CAMPOS",
    displayName: "V\xEDctor Campos",
    routes: [
      { id: "VICTOR CAMPOS", label: "Ruta V\xEDctor Campos", aliases: ["VICTOR CAMPOS", "V\xCDCTOR CAMPOS"] }
    ]
  },
  "EDUARDO PI\xD1A": {
    canonicalUsername: "EDUARDO PI\xD1A",
    displayName: "Eduardo Pi\xF1a",
    routes: [
      { id: "EDUARDO PI\xD1A", label: "Ruta Eduardo Pi\xF1a", aliases: ["EDUARDO PI\xD1A", "EDUARDO PINA", "EDUARDO PI\xC3\u2018A"] }
    ]
  },
  "LEONARDO RIOS": {
    canonicalUsername: "LEONARDO RIOS",
    displayName: "Leonardo R\xEDos",
    routes: [
      { id: "LEONARDO RIOS", label: "Ruta Leonardo R\xEDos", aliases: ["LEONARDO RIOS"] }
    ]
  },
  "MARYERY GARCIA": {
    canonicalUsername: "MARYERY GARCIA",
    displayName: "Maryery Garc\xEDa",
    routes: [
      { id: "MARYERY GARCIA", label: "Ruta Maryery Garc\xEDa", aliases: ["MARYERY GARCIA"] }
    ]
  },
  "LUIS GUANIPA": {
    canonicalUsername: "LUIS GUANIPA",
    displayName: "Luis Guanipa",
    routes: [
      { id: "LUIS GUANIPA", label: "Ruta Luis Guanipa", aliases: ["LUIS GUANIPA"] }
    ]
  },
  "PEDRO ABREU": {
    canonicalUsername: "PEDRO ABREU",
    displayName: "Pedro Abreu",
    routes: [
      { id: "PEDRO ABREU", label: "Ruta Pedro Abreu", aliases: ["PEDRO ABREU"] }
    ]
  },
  "OSCAR ORTIZ": {
    canonicalUsername: "OSCAR ORTIZ",
    displayName: "\xD3scar Ortiz",
    routes: [
      { id: "OSCAR ORTIZ- LA COSTA", label: "Ruta La Costa", aliases: ["OSCAR ORTIZ- LA COSTA", "OSCAR ORTIZ-  LA COSTA", "OSCAR ORTIZ - LA COSTA", "OSCAR ORTIZ LA COSTA", "LA COSTA"] },
      { id: "OSCAR ORTIZ- CORO", label: "Ruta Coro", aliases: ["OSCAR ORTIZ- CORO", "OSCAR ORTIZ - CORO", "OSCAR ORTIZ CORO", "CORO"] }
    ]
  }
};
var mikelProfile = VENDOR_PROFILES["MIKELANGELO DIAZ"];
VENDOR_PROFILES["MIKELANGELODIAZ@GMAIL.COM"] = mikelProfile;
VENDOR_PROFILES["MIKELANGELO"] = mikelProfile;
VENDOR_PROFILES["MIKELANGELO DIAZ1"] = mikelProfile;
VENDOR_PROFILES["MIKELANGELO DIAZ - VILLA DEL ROS"] = mikelProfile;
VENDOR_PROFILES["MIKELANGELO DIAZ VILLA DEL ROS"] = mikelProfile;
VENDOR_PROFILES["MIKELANGELO VILLA DEL ROS"] = mikelProfile;
VENDOR_PROFILES["JOHNATAN SOTO"] = mikelProfile;
VENDOR_PROFILES["JOHNATAN SOTO VILLA DEL ROS"] = mikelProfile;
VENDOR_PROFILES["JOHNATAN"] = mikelProfile;
VENDOR_PROFILES["JONATHAN"] = mikelProfile;
VENDOR_PROFILES["JHONATAN"] = mikelProfile;
VENDOR_PROFILES["JAIDER MEDINA"] = VENDOR_PROFILES["JAIDER MEDINA - FOOD SERVICE NORTE"];
VENDOR_PROFILES["FOOD SERVICE NORTE"] = VENDOR_PROFILES["JAIDER MEDINA - FOOD SERVICE NORTE"];
VENDOR_PROFILES["MARIANGEL"] = VENDOR_PROFILES["MARIANGEL GONZALEZ"];
var SUPERVISOR_PROFILES = {
  "ALI PEREZ": {
    canonicalUsername: "ALI PEREZ",
    displayName: "Al\xED P\xE9rez (Supervisor)",
    supervisedVendors: [
      "ANGEL NAVARRO",
      "MARIANGEL GONZALEZ",
      "VICTOR CAMPOS"
    ]
  }
};
function getSupervisorProfile(username) {
  const norm = normalizeVendorName(username).replace(/^SUPERVISOR:/, "").trim();
  if (!norm) return null;
  if (SUPERVISOR_PROFILES[norm]) return SUPERVISOR_PROFILES[norm];
  const clean = normalizeAsciiKey(norm);
  for (const [k, sup] of Object.entries(SUPERVISOR_PROFILES)) {
    if (normalizeAsciiKey(k) === clean) return sup;
  }
  return null;
}
function getSupervisedRoutes(supervisorUsername) {
  const sup = getSupervisorProfile(supervisorUsername);
  if (!sup) return [];
  const routes = [];
  const seen = /* @__PURE__ */ new Set();
  sup.supervisedVendors.forEach((vKey) => {
    const prof = VENDOR_PROFILES[vKey];
    if (prof) {
      prof.routes.forEach((r) => {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          routes.push(r);
        }
      });
    }
  });
  return routes;
}
function getSupervisedAliases(supervisorUsername) {
  const sup = getSupervisorProfile(supervisorUsername);
  if (!sup) return [];
  const routes = getSupervisedRoutes(supervisorUsername);
  return Array.from(
    /* @__PURE__ */ new Set([
      ...sup.supervisedVendors,
      ...routes.flatMap((r) => [r.id, ...r.aliases])
    ])
  );
}
function matchesVendorAlias(aliases, sheetVendor) {
  const normSheet = normalizeVendorName(sheetVendor);
  if (!normSheet) return false;
  const cleanSheet = normalizeAsciiKey(normSheet);
  for (const a of aliases) {
    const normA = normalizeVendorName(a);
    if (!normA) continue;
    if (normSheet === normA) return true;
    const cleanA = normalizeAsciiKey(normA);
    if (cleanSheet && cleanSheet === cleanA) return true;
  }
  return false;
}
function getVendorProfile(username) {
  const normUser = normalizeVendorName(username);
  if (VENDOR_PROFILES[normUser]) {
    return VENDOR_PROFILES[normUser];
  }
  const cleanUser = normalizeAsciiKey(normUser);
  for (const [key, prof] of Object.entries(VENDOR_PROFILES)) {
    if (normalizeAsciiKey(key) === cleanUser || normalizeAsciiKey(prof.displayName) === cleanUser) {
      return prof;
    }
  }
  if (/MIKELANGELO|JOHNATAN|JONATHAN|JHONATAN|SOTO/.test(normUser)) {
    return VENDOR_PROFILES["MIKELANGELO DIAZ"];
  }
  return {
    canonicalUsername: normUser,
    displayName: normUser,
    routes: [
      { id: normUser, label: `Ruta ${normUser}`, aliases: [normUser] }
    ]
  };
}

// src/lib/rubros.ts
var RUBRO_SERVER_CATEGORY = {
  ACEITE: "ACEITE",
  AZUCAR: "AZ\xDACAR",
  POLLO: "POLLO",
  ESTANDAR_ASTURIAS: "ESTANDAR Y SUPERIOR ASTURIAS",
  MORTADELA_SALPICAO: "MORTADELA SALPICAO Y ASTURIAS",
  OTROS: "OTROS"
};
var SKUS_MORTADELA = /* @__PURE__ */ new Set([
  "1464",
  "1462",
  "1512",
  "1521",
  "1561",
  "1522",
  "1563",
  "1562",
  "1564",
  "1519",
  "1496",
  "1511",
  "1599"
]);
var SKUS_POLLO = /* @__PURE__ */ new Set([
  "630",
  "629",
  "870",
  "393",
  "POLLO",
  "FILET",
  "MUSLO",
  "ALAS"
]);
function clasificarRubro(sku, nombre) {
  const s = String(sku || "").trim();
  const sU = s.toUpperCase();
  const n = String(nombre || "").toUpperCase();
  if (s === "1461" || s === "1463" || n.includes("ESTANDAR ASTURIAS") || n.includes("SUPERIOR ASTURIAS")) {
    return "ESTANDAR_ASTURIAS";
  }
  if (n.includes("MORTADELA") || n.includes("MORT.") || n.includes("SALPICAO") || SKUS_MORTADELA.has(s)) {
    return "MORTADELA_SALPICAO";
  }
  if (sU === "ACEITE" || n.includes("ACEITE")) return "ACEITE";
  if (sU === "AZUCAR" || sU === "AZ\xDACAR" || n.includes("AZUCAR") || n.includes("AZ\xDACAR")) return "AZUCAR";
  if (SKUS_POLLO.has(s) || SKUS_POLLO.has(sU) || n.includes("POLLO ENTERO") || n.includes("POLLO TODAS") || n.includes("FILET") || n.includes("MUSLO") || n.includes("ALAS DESPRESADAS") || n.includes("HIGADO") || n.includes("MOLLEJA")) {
    return "POLLO";
  }
  return "OTROS";
}
function clasificarRubroServerLabel(sku, nombre) {
  return RUBRO_SERVER_CATEGORY[clasificarRubro(sku, nombre)];
}

// src/services/googleSheetsParser.ts
var DEFAULT_GOOGLE_SHEET_ID = "1PLzYEe9GG1vHb_wjd7HA93U6UQNtyP-uk8sxVfiN4sg";
function sanitizeGoogleSheetId(raw) {
  if (!raw) return DEFAULT_GOOGLE_SHEET_ID;
  let cleaned = String(raw).trim().replace(/^['"<]+|['">]+$/g, "").trim();
  if (!cleaned || /PEGA_AQUI/i.test(cleaned)) {
    return DEFAULT_GOOGLE_SHEET_ID;
  }
  const urlMatch = cleaned.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  return cleaned;
}
function getGoogleSheetId(envOverride) {
  const procEnv = typeof process !== "undefined" && process.env ? process.env : {};
  const raw = envOverride?.GOOGLE_SHEET_ID || envOverride?.VITE_GOOGLE_SHEET_ID || procEnv.GOOGLE_SHEET_ID || procEnv.VITE_GOOGLE_SHEET_ID;
  return sanitizeGoogleSheetId(raw);
}
function buildGoogleSheetExportUrl(sheetId, format = "xlsx", gid) {
  const id = sanitizeGoogleSheetId(sheetId || getGoogleSheetId());
  const gidParam = gid !== void 0 && gid !== null && String(gid).trim() !== "" ? `&gid=${encodeURIComponent(String(gid))}` : "";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=${format}${gidParam}&_cb=${Date.now()}`;
}
function parseCsvRfc4180(csvText) {
  if (!csvText) return [];
  const text = csvText.charCodeAt(0) === 65279 ? csvText.slice(1) : csvText;
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;
  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && text[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        currentField += ch;
        i++;
      }
      continue;
    }
    if (ch === '"' && currentField.length === 0) {
      inQuotes = true;
      i++;
    } else if (ch === ",") {
      currentRow.push(currentField);
      currentField = "";
      i++;
    } else if (ch === "\r") {
      currentRow.push(currentField);
      currentField = "";
      rows.push(currentRow);
      currentRow = [];
      if (i + 1 < len && text[i + 1] === "\n") {
        i += 2;
      } else {
        i++;
      }
    } else if (ch === "\n") {
      currentRow.push(currentField);
      currentField = "";
      rows.push(currentRow);
      currentRow = [];
      i++;
    } else {
      currentField += ch;
      i++;
    }
  }
  if (inQuotes || currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
}
function normalizeHeaderKey(raw) {
  if (raw === null || raw === void 0) return "";
  return String(raw).replace(/Ã‘|Ã±/g, "n").replace(/Ã¡|Ã€/g, "a").replace(/Ã©|Ã‰/g, "e").replace(/Ã­|Ã /g, "i").replace(/Ã³|Ã“/g, "o").replace(/Ãº|Ãš/g, "u").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function isRowCompletelyEmpty(row) {
  if (!row || !Array.isArray(row) || row.length === 0) return true;
  for (let i = 0; i < row.length; i++) {
    const cell = row[i];
    if (cell !== null && cell !== void 0 && String(cell).trim() !== "") {
      return false;
    }
  }
  return true;
}
function normalizeClientCode(raw) {
  if (raw === null || raw === void 0) return { rawClean: "", canonical: "" };
  const rawClean = String(raw).replace(/^[#\s]+/, "").trim();
  if (!rawClean) return { rawClean: "", canonical: "" };
  const canonical = rawClean.replace(/^0+/, "") || "0";
  return { rawClean, canonical };
}
function parseLocaleNumber(raw, fallback = 0) {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : fallback;
  }
  if (raw === null || raw === void 0 || typeof raw === "boolean") {
    return fallback;
  }
  let s = String(raw).replace(/\u00A0/g, " ").trim();
  if (!s) return fallback;
  if (/^[-–—]+$/.test(s) || /^(n\/?a|#n\/?d|#n\/?a|#value!|#ref!|#div\/0!|null|undefined|sin\s*dato)$/i.test(s)) {
    return fallback;
  }
  let isNegative = false;
  if (/^\(.*\)$/.test(s)) {
    isNegative = true;
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/[$\u20AC\u00A3%]/g, "").replace(/\b(bs\.?|usd|kg|kgs|cj|cajas|und)\b/gi, "").replace(/\s+/g, "");
  if (s.startsWith("-")) {
    isNegative = !isNegative;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (!s || /^[-–—]+$/.test(s)) return fallback;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    const commaCount = (s.match(/,/g) || []).length;
    if (commaCount > 1) {
      s = s.replace(/,/g, "");
    } else {
      const [intPart, fracPart] = s.split(",");
      if (intPart === "0" || fracPart.length !== 3) {
        s = `${intPart}.${fracPart}`;
      } else {
        s = `${intPart}${fracPart}`;
      }
    }
  } else if (lastDot !== -1) {
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      s = s.replace(/\./g, "");
    }
  }
  const parsed = Number(s);
  if (!Number.isFinite(parsed)) return fallback;
  const result = isNegative ? -parsed : parsed;
  return Object.is(result, -0) ? 0 : result;
}
function parseSheetDate(raw) {
  if (raw === null || raw === void 0) return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }
  const isValidYmd = (y, m, d) => {
    if (y < 1900 || y > 2150 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
      return null;
    }
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw < 2e4 || raw > 9e4) return null;
    const utcMs = Math.round((Math.floor(raw) - 25569) * 86400 * 1e3);
    const dt = new Date(utcMs);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial >= 2e4 && serial <= 9e4) {
      const utcMs = Math.round((Math.floor(serial) - 25569) * 86400 * 1e3);
      const dt = new Date(utcMs);
      if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    }
  }
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    return isValidYmd(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }
  const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s.*)?$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    let year = Number(dmyMatch[3]);
    if (year < 100) year += 2e3;
    return isValidYmd(year, month, day);
  }
  return null;
}
function resolveSheetByAliases(workbook, exactAliases, substringAliases = [], excludeSubstrings = []) {
  if (!workbook || !Array.isArray(workbook.SheetNames)) return null;
  const exactNorm = new Set(exactAliases.map(normalizeHeaderKey).filter(Boolean));
  const subNorm = substringAliases.map(normalizeHeaderKey).filter(Boolean);
  const exclNorm = excludeSubstrings.map(normalizeHeaderKey).filter(Boolean);
  for (const name of workbook.SheetNames) {
    const norm = normalizeHeaderKey(name);
    if (exactNorm.has(norm)) {
      return { sheetName: name, sheet: workbook.Sheets[name] };
    }
  }
  for (const name of workbook.SheetNames) {
    const norm = normalizeHeaderKey(name);
    if (exclNorm.some((ex) => norm.includes(ex))) continue;
    if (subNorm.some((sub) => norm.includes(sub))) {
      return { sheetName: name, sheet: workbook.Sheets[name] };
    }
  }
  return null;
}
function mapHeaderColumns(headerRow, schema, fallbacks) {
  const normalizedHeaders = (headerRow || []).map(normalizeHeaderKey);
  const result = {};
  for (const key of Object.keys(schema)) {
    const aliases = schema[key].map(normalizeHeaderKey);
    let foundIdx = -1;
    for (const alias of aliases) {
      const idx = normalizedHeaders.indexOf(alias);
      if (idx !== -1) {
        foundIdx = idx;
        break;
      }
    }
    if (foundIdx === -1) {
      for (const alias of aliases) {
        const idx = normalizedHeaders.findIndex((h) => h && (h.includes(alias) || alias.includes(h)));
        if (idx !== -1) {
          foundIdx = idx;
          break;
        }
      }
    }
    if (foundIdx === -1 && fallbacks && typeof fallbacks[key] === "number") {
      foundIdx = fallbacks[key];
    }
    result[key] = foundIdx;
  }
  return result;
}
function isSupervisorSummaryHeader(vendorRaw) {
  const clean = String(vendorRaw || "").replace(/\s+/g, " ").trim().toUpperCase();
  if (!clean) return false;
  if (SUPERVISOR_SUMMARY_COLUMNS.has(clean)) return true;
  const norm = normalizeVendorName(clean);
  return SUPERVISOR_SUMMARY_COLUMNS.has(norm);
}
function formatVolumenVendorDisplay(vendorName) {
  const vendorUpper = vendorName.toUpperCase();
  const isMikelRoute1 = vendorUpper === "MIKELANGELO DIAZ1" || vendorUpper.includes("MIKELANGELO DIAZ 1") || vendorUpper.includes("MIKELANGELO DIAZ - PRINCIPAL");
  const isMikelVilla = (vendorUpper.includes("MIKELANGELO") || vendorUpper.includes("SOTO") || vendorUpper.includes("DIAZ")) && vendorUpper.includes("VILLA");
  const isJohnatanHistorical = (vendorUpper === "JOHNATAN SOTO" || vendorUpper === "JHONATAN SOTO") && !vendorUpper.includes("VILLA");
  if (isMikelRoute1) {
    return {
      finalVendedorId: "MIKELANGELO DIAZ1",
      finalVendedorNombre: "Mikelangelo Diaz (Principal)",
      finalVendedorEmail: "Mikelangelodiaz@gmail.com"
    };
  }
  if (isMikelVilla) {
    return {
      finalVendedorId: "MIKELANGELO DIAZ - VILLA DEL ROS",
      finalVendedorNombre: "Mikelangelo Diaz (Villa del Rosario)",
      finalVendedorEmail: "Mikelangelodiaz@gmail.com"
    };
  }
  if (isJohnatanHistorical) {
    return {
      finalVendedorId: "JOHNATAN SOTO (HISTORICO)",
      finalVendedorNombre: "Johnatan Soto (Hist\xF3rico)"
    };
  }
  if (/mikelangelo/i.test(vendorName)) {
    return {
      finalVendedorId: vendorName,
      finalVendedorNombre: "Mikelangelo Diaz",
      finalVendedorEmail: "Mikelangelodiaz@gmail.com"
    };
  }
  return {
    finalVendedorId: vendorName,
    finalVendedorNombre: vendorName
  };
}
function parseTruthySheetFlag(raw) {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw > 0;
  if (raw === null || raw === void 0) return false;
  const norm = normalizeHeaderKey(raw);
  return norm === "si" || norm === "yes" || norm === "true" || norm === "1" || norm === "activo" || norm === "x";
}
function extractSheetRows(XLSX, sheet) {
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: true,
    raw: true
  });
}
function parseWorkbookFull(XLSX, workbook, options) {
  const { periodo, masterClients = [] } = options;
  const warnings = [];
  const metrics = {};
  const volumenSupabaseRows = [];
  const volumenApiRows = [];
  const volResolved = resolveSheetByAliases(workbook, ["volumen_por_sku"], ["volumen", "sku"]);
  if (volResolved) {
    const rows = extractSheetRows(XLSX, volResolved.sheet);
    const tabMetric = {
      sheetName: volResolved.sheetName,
      totalRowsInSheet: rows.length,
      headerRows: rows.length >= 2 ? 2 : rows.length,
      emptyRowsSkipped: 0,
      summaryRowsSkipped: 0,
      incompleteRowsLogged: 0,
      validRecordsRead: 0
    };
    if (rows.length >= 2) {
      const header0 = rows[0] || [];
      const header1 = rows[1] || [];
      const maxHeaderCols = Math.max(header0.length, header1.length);
      const baseCols = mapHeaderColumns(
        header1,
        {
          sku: ["cod", "codigo", "sku", "id_articulo", "cod_articulo"],
          articulo: ["articulo", "producto", "descripcion", "nombre"]
        },
        { sku: 0, articulo: 1 }
      );
      const vendorBlocks = [];
      const headerStarts = [];
      for (let c = 0; c < maxHeaderCols; c++) {
        if (c === baseCols.sku || c === baseCols.articulo) continue;
        const h0 = header0[c];
        if (h0 !== null && h0 !== void 0 && String(h0).trim() !== "") {
          headerStarts.push(c);
        }
      }
      for (let bIdx = 0; bIdx < headerStarts.length; bIdx++) {
        const startCol = headerStarts[bIdx];
        const endCol = bIdx + 1 < headerStarts.length ? headerStarts[bIdx + 1] : Math.min(startCol + 3, maxHeaderCols);
        const vendorName = String(header0[startCol] || "").replace(/\s+/g, " ").trim();
        if (!vendorName) continue;
        if (isSupervisorSummaryHeader(vendorName)) continue;
        let cuotaCol = startCol;
        let ejecutadoCol = startCol + 1;
        for (let subC = startCol; subC < endCol; subC++) {
          const subNorm = normalizeHeaderKey(header1[subC]);
          if (subNorm === "cuota" || subNorm === "cuota_kg" || subNorm === "meta" || subNorm === "meta_kg") {
            cuotaCol = subC;
          } else if (subNorm === "kg" || subNorm === "venta_kg" || subNorm === "venta" || subNorm === "ejecutado" || subNorm === "ejecutado_kg") {
            ejecutadoCol = subC;
          }
        }
        vendorBlocks.push({ vendorName, cuotaCol, ejecutadoCol });
      }
      let idCounter = 1;
      for (let r = 2; r < rows.length; r++) {
        const row = rows[r];
        if (isRowCompletelyEmpty(row)) {
          tabMetric.emptyRowsSkipped++;
          continue;
        }
        const rawSku = row[baseCols.sku];
        const rawArticulo = row[baseCols.articulo];
        const sku = rawSku !== null && rawSku !== void 0 ? String(rawSku).trim() : "";
        const articulo = rawArticulo !== null && rawArticulo !== void 0 ? String(rawArticulo).trim() : "";
        if (!sku) {
          if (!articulo) {
            tabMetric.summaryRowsSkipped++;
          } else {
            tabMetric.incompleteRowsLogged++;
            warnings.push({
              sheet: volResolved.sheetName,
              row: r + 1,
              reason: `Fila con art\xEDculo "${articulo}" sin c\xF3digo SKU en columna Cod`
            });
          }
          continue;
        }
        if (!articulo) {
          warnings.push({
            sheet: volResolved.sheetName,
            row: r + 1,
            reason: `SKU "${sku}" tiene nombre de art\xEDculo vac\xEDo`
          });
        }
        const cat = clasificarRubroServerLabel(sku, articulo);
        for (const block of vendorBlocks) {
          const metaKg = parseLocaleNumber(row[block.cuotaCol], 0);
          const ejecutadoKg = parseLocaleNumber(row[block.ejecutadoCol], 0);
          if (metaKg > 0 || ejecutadoKg > 0) {
            tabMetric.validRecordsRead++;
            volumenSupabaseRows.push({
              periodo,
              sku,
              articulo,
              categoria: cat,
              vendedor_id: block.vendorName,
              vendedor_nombre: block.vendorName,
              meta_kg: metaKg,
              ejecutado_kg: ejecutadoKg,
              zona: "General"
            });
            const display = formatVolumenVendorDisplay(block.vendorName);
            volumenApiRows.push({
              id: String(idCounter++),
              vendedorId: display.finalVendedorId,
              vendedorNombre: display.finalVendedorNombre,
              vendedorEmail: display.finalVendedorEmail,
              sku,
              skuId: sku,
              articulo,
              cliente: display.finalVendedorNombre,
              categoria: cat,
              meta: metaKg,
              metaKg,
              ejecutado: ejecutadoKg,
              ejecutadoKg,
              zona: "General",
              lat: 10.6427,
              lng: -71.6125
            });
          }
        }
      }
    }
    metrics[volResolved.sheetName] = tabMetric;
  }
  const readProductPurchaseSheet = (exactAliases, substringAliases) => {
    const clientMap = /* @__PURE__ */ new Map();
    const resolved = resolveSheetByAliases(
      workbook,
      exactAliases,
      substringAliases,
      ["grid", "volumen", "activacion_por_cliente", "usuarios", "degustaciones"]
    );
    if (!resolved) return clientMap;
    const rows = extractSheetRows(XLSX, resolved.sheet);
    const tabMetric = {
      sheetName: resolved.sheetName,
      totalRowsInSheet: rows.length,
      headerRows: rows.length > 0 ? 1 : 0,
      emptyRowsSkipped: 0,
      summaryRowsSkipped: 0,
      incompleteRowsLogged: 0,
      validRecordsRead: 0
    };
    if (rows.length > 1) {
      const cols = mapHeaderColumns(
        rows[0] || [],
        {
          codigo: ["id_cliente", "codigo", "cod_cliente", "cliente_codigo", "id", "cod"],
          cliente: ["cliente", "razon_social", "nombre_cliente", "nombre"],
          cajas: ["cajas", "cantidad", "bultos", "unidades", "compra"]
        },
        { codigo: 0, cliente: 1, cajas: 2 }
      );
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (isRowCompletelyEmpty(row)) {
          tabMetric.emptyRowsSkipped++;
          continue;
        }
        const { rawClean, canonical } = normalizeClientCode(row[cols.codigo]);
        if (!canonical) {
          tabMetric.incompleteRowsLogged++;
          warnings.push({
            sheet: resolved.sheetName,
            row: r + 1,
            reason: `Fila de compra sin Id Cliente v\xE1lido (Cliente="${String(row[cols.cliente] ?? "").trim()}")`
          });
          continue;
        }
        const cajas = parseLocaleNumber(row[cols.cajas], 0);
        const addVal = cajas > 0 ? cajas : 1;
        tabMetric.validRecordsRead++;
        const nextTotal = +((clientMap.get(canonical) || 0) + addVal).toFixed(4);
        clientMap.set(canonical, nextTotal);
        if (rawClean && rawClean !== canonical) {
          clientMap.set(rawClean, nextTotal);
        }
      }
    }
    metrics[resolved.sheetName] = tabMetric;
    return clientMap;
  };
  const productMaps = {
    ACEITE: readProductPurchaseSheet(["aceite"], ["aceite"]),
    AZUCAR: readProductPurchaseSheet(["azucar"], ["azucar"]),
    POLLO: readProductPurchaseSheet(["pollo"], ["pollo"]),
    ESTANDAR_ASTURIAS: readProductPurchaseSheet(["jamon_asturias", "estandar_asturias"], ["jamon", "asturias"]),
    MORTADELA_SALPICAO: readProductPurchaseSheet(["enteros_ligeros", "mortadela_salpicao"], ["ligeros", "salpicao", "mortadela"])
  };
  const actResolved = resolveSheetByAliases(
    workbook,
    ["activacion_por_cliente", "clientes"],
    ["activacion_por_cliente", "activacion_cliente"]
  );
  const sheetClientsByCanonical = /* @__PURE__ */ new Map();
  if (actResolved) {
    const rows = extractSheetRows(XLSX, actResolved.sheet);
    const tabMetric = {
      sheetName: actResolved.sheetName,
      totalRowsInSheet: rows.length,
      headerRows: rows.length > 0 ? 1 : 0,
      emptyRowsSkipped: 0,
      summaryRowsSkipped: 0,
      incompleteRowsLogged: 0,
      validRecordsRead: 0
    };
    if (rows.length > 1) {
      const cols = mapHeaderColumns(
        rows[0] || [],
        {
          codigo: ["codigo", "id_cliente", "cliente_codigo", "cod", "id"],
          razonSocial: ["razon_social", "cliente", "nombre_cliente", "nombre"],
          vendedor: ["vendedor", "ruta", "ejecutivo", "vendedor_nombre"],
          aceite: ["aceite"],
          azucar: ["azucar"],
          pollo: ["pollo", "arroz"],
          asturias: ["estandar_y_superior_asturias", "jamon_asturias", "estandar_asturias"],
          salpicao: ["mortadela_salpicao_y_asturias", "enteros_ligeros", "mortadela_salpicao"]
        },
        {
          codigo: 0,
          razonSocial: 1,
          vendedor: 2,
          aceite: 3,
          azucar: 4,
          pollo: 5,
          asturias: 6,
          salpicao: 7
        }
      );
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (isRowCompletelyEmpty(row)) {
          tabMetric.emptyRowsSkipped++;
          continue;
        }
        const { rawClean, canonical } = normalizeClientCode(row[cols.codigo]);
        const razonSocial = String(row[cols.razonSocial] ?? "").trim();
        const rawVendor = String(row[cols.vendedor] ?? "").replace(/\s+/g, " ").trim();
        if (!canonical || !rawVendor) {
          tabMetric.incompleteRowsLogged++;
          warnings.push({
            sheet: actResolved.sheetName,
            row: r + 1,
            reason: `Fila incompleta en Activaci\xF3n por Cliente (CODIGO="${rawClean}", VENDEDOR="${rawVendor}")`
          });
          continue;
        }
        const flagAceite = cols.aceite >= 0 ? parseTruthySheetFlag(row[cols.aceite]) : false;
        const flagAzucar = cols.azucar >= 0 ? parseTruthySheetFlag(row[cols.azucar]) : false;
        const flagPollo = cols.pollo >= 0 ? parseTruthySheetFlag(row[cols.pollo]) : false;
        const flagAsturias = cols.asturias >= 0 ? parseTruthySheetFlag(row[cols.asturias]) : false;
        const flagSalpicao = cols.salpicao >= 0 ? parseTruthySheetFlag(row[cols.salpicao]) : false;
        const mappedVendor = rawVendor.toUpperCase() === "FOOD SERVICE NORTE" ? "JAIDER MEDINA - FOOD SERVICE NORTE" : rawVendor;
        if (sheetClientsByCanonical.has(canonical)) {
          const prev = sheetClientsByCanonical.get(canonical);
          prev.flagAceite = prev.flagAceite || flagAceite;
          prev.flagAzucar = prev.flagAzucar || flagAzucar;
          prev.flagPollo = prev.flagPollo || flagPollo;
          prev.flagAsturias = prev.flagAsturias || flagAsturias;
          prev.flagSalpicao = prev.flagSalpicao || flagSalpicao;
          warnings.push({
            sheet: actResolved.sheetName,
            row: r + 1,
            reason: `C\xF3digo de cliente duplicado #${rawClean} ("${razonSocial}") consolidado en registro \xFAnico`
          });
          continue;
        }
        tabMetric.validRecordsRead++;
        sheetClientsByCanonical.set(canonical, {
          rawCode: rawClean,
          canonicalCode: canonical,
          razonSocial,
          vendedor: mappedVendor,
          flagAceite,
          flagAzucar,
          flagPollo,
          flagAsturias,
          flagSalpicao
        });
      }
    }
    metrics[actResolved.sheetName] = tabMetric;
  }
  const mergedClientsMap = /* @__PURE__ */ new Map();
  for (const mc of masterClients) {
    const { rawClean, canonical } = normalizeClientCode(mc.cliente_codigo);
    if (!canonical) continue;
    const sheetMatch = sheetClientsByCanonical.get(canonical);
    if (!mergedClientsMap.has(canonical)) {
      mergedClientsMap.set(canonical, {
        dbId: mc.id,
        codigo: rawClean || canonical,
        canonical,
        razonSocial: String(mc.cliente_nombre || sheetMatch?.razonSocial || "").trim(),
        vendedorId: String(mc.vendedor_id || mc.vendedor_nombre || "").replace(/\s+/g, " ").trim(),
        vendedorNombre: String(mc.vendedor_nombre || mc.vendedor_id || "").replace(/\s+/g, " ").trim(),
        isNewFromSheet: false,
        sheetFlags: sheetMatch
      });
    }
  }
  for (const [canonical, sc] of sheetClientsByCanonical.entries()) {
    if (mergedClientsMap.has(canonical)) continue;
    if (sc.vendedor.toUpperCase() === "ALI PEREZ") continue;
    mergedClientsMap.set(canonical, {
      codigo: sc.rawCode || canonical,
      canonical,
      razonSocial: sc.razonSocial,
      vendedorId: sc.vendedor,
      vendedorNombre: sc.vendedor,
      isNewFromSheet: true,
      sheetFlags: sc
    });
  }
  const activacionApiRows = [];
  const activacionSupabaseUpserts = [];
  const newSheetClientsForSupabase = [];
  const clientActByVendor = /* @__PURE__ */ new Map();
  for (const c of mergedClientsMap.values()) {
    if (!c.vendedorId || c.vendedorId.toUpperCase() === "ALI PEREZ") continue;
    const cAceite = productMaps.ACEITE.get(c.canonical) || productMaps.ACEITE.get(c.codigo) || 0;
    const cAzucar = productMaps.AZUCAR.get(c.canonical) || productMaps.AZUCAR.get(c.codigo) || 0;
    const cPollo = productMaps.POLLO.get(c.canonical) || productMaps.POLLO.get(c.codigo) || 0;
    const cAsturias = productMaps.ESTANDAR_ASTURIAS.get(c.canonical) || productMaps.ESTANDAR_ASTURIAS.get(c.codigo) || 0;
    const cSalpicao = productMaps.MORTADELA_SALPICAO.get(c.canonical) || productMaps.MORTADELA_SALPICAO.get(c.codigo) || 0;
    const hasAceite = cAceite > 0 || Boolean(c.sheetFlags?.flagAceite);
    const hasAzucar = cAzucar > 0 || Boolean(c.sheetFlags?.flagAzucar);
    const hasPollo = cPollo > 0 || Boolean(c.sheetFlags?.flagPollo);
    const hasAsturias = cAsturias > 0 || Boolean(c.sheetFlags?.flagAsturias);
    const hasSalpicao = cSalpicao > 0 || Boolean(c.sheetFlags?.flagSalpicao);
    const isActivo = hasAceite || hasAzucar || hasPollo || hasAsturias || hasSalpicao;
    const vNorm = normalizeVendorName(c.vendedorNombre || c.vendedorId);
    if (!clientActByVendor.has(vNorm)) {
      clientActByVendor.set(vNorm, {
        ACEITE: 0,
        "AZ\xDACAR": 0,
        AZUCAR: 0,
        POLLO: 0,
        "ESTANDAR Y SUPERIOR ASTURIAS": 0,
        "MORTADELA SALPICAO Y ASTURIAS": 0
      });
    }
    const vCounts = clientActByVendor.get(vNorm);
    if (hasAceite) vCounts.ACEITE++;
    if (hasAzucar) {
      vCounts["AZ\xDACAR"]++;
      vCounts.AZUCAR++;
    }
    if (hasPollo) vCounts.POLLO++;
    if (hasAsturias) vCounts["ESTANDAR Y SUPERIOR ASTURIAS"]++;
    if (hasSalpicao) vCounts["MORTADELA SALPICAO Y ASTURIAS"]++;
    const supaPayload = {
      ...c.dbId !== void 0 ? { id: c.dbId } : {},
      periodo,
      cliente_codigo: c.codigo,
      cliente_nombre: c.razonSocial,
      vendedor_id: c.vendedorId,
      vendedor_nombre: c.vendedorNombre,
      status: isActivo ? "ACTIVO" : "INACTIVO",
      cajas_aceite: cAceite,
      cajas_azucar: cAzucar,
      cajas_pollo: cPollo,
      cajas_estandar_asturias: cAsturias,
      cajas_mortadela_salpicao: cSalpicao,
      has_aceite: hasAceite,
      has_azucar: hasAzucar,
      has_pollo: hasPollo,
      has_estandar_asturias: hasAsturias,
      has_mortadela_salpicao: hasSalpicao
    };
    if (c.dbId !== void 0) {
      activacionSupabaseUpserts.push(supaPayload);
    } else if (c.isNewFromSheet) {
      newSheetClientsForSupabase.push(supaPayload);
    }
    const vendUpper = c.vendedorId.toUpperCase();
    const isVilla = vendUpper.includes("VILLA");
    const isJohnatanOrMikel = vendUpper.includes("JOHNATAN") || vendUpper.includes("MIKELANGELO") || vendUpper.includes("SOTO");
    const displayVendedorNombre = isJohnatanOrMikel ? isVilla ? "Mikelangelo Diaz (Villa del Rosario)" : "Mikelangelo Diaz (Principal)" : c.vendedorNombre;
    const displayEmail = isJohnatanOrMikel ? "Mikelangelodiaz@gmail.com" : void 0;
    activacionApiRows.push({
      id: String(c.codigo),
      vendedorId: c.vendedorId,
      vendedorNombre: displayVendedorNombre,
      vendedorEmail: displayEmail,
      cliente: c.razonSocial,
      status: isActivo ? "ACTIVO" : "INACTIVO",
      cats: {
        ACEITE: hasAceite,
        AZUCAR: hasAzucar,
        POLLO: hasPollo,
        ESTANDAR_ASTURIAS: hasAsturias,
        MORTADELA_SALPICAO: hasSalpicao,
        ARROZ: hasPollo,
        ENTERO: hasAsturias,
        LIGEROS: hasSalpicao
      },
      cajas: {
        ACEITE: cAceite,
        AZUCAR: cAzucar,
        POLLO: cPollo,
        ESTANDAR_ASTURIAS: cAsturias,
        MORTADELA_SALPICAO: cSalpicao
      }
    });
  }
  const metasSupabaseRows = [];
  const metasApiRows = [];
  const gridResolved = resolveSheetByAliases(
    workbook,
    ["grid_de_activacion_por_vendedor"],
    ["grid_de_activacion", "grid"]
  );
  if (gridResolved) {
    const rows = extractSheetRows(XLSX, gridResolved.sheet);
    const tabMetric = {
      sheetName: gridResolved.sheetName,
      totalRowsInSheet: rows.length,
      headerRows: rows.length >= 2 ? 2 : rows.length,
      emptyRowsSkipped: 0,
      summaryRowsSkipped: 0,
      incompleteRowsLogged: 0,
      validRecordsRead: 0
    };
    if (rows.length >= 2) {
      const h0 = (rows[0] || []).map(normalizeHeaderKey);
      const h1 = (rows[1] || []).map(normalizeHeaderKey);
      const vendorCol = h1.findIndex((h) => h === "vendedor" || h === "ruta" || h === "ejecutivo");
      const resolvedVendorCol = vendorCol !== -1 ? vendorCol : 0;
      const findCategoryCols = (catKeywords, fallbackMeta, fallbackAct) => {
        for (let c = 0; c < Math.max(h0.length, h1.length); c++) {
          const cell1 = h1[c] || "";
          const cell0 = h0[c] || "";
          if (cell1.startsWith("meta") && catKeywords.some((kw) => cell1.includes(kw)) || catKeywords.some((kw) => cell0 === kw || cell0.includes(kw))) {
            const actCol = h1[c + 1]?.includes("activad") ? c + 1 : c + 1;
            return { metaIdx: c, actIdx: actCol };
          }
        }
        return { metaIdx: fallbackMeta, actIdx: fallbackAct };
      };
      const catDefs = [
        { name: "ACEITE", ...findCategoryCols(["aceite"], 2, 3) },
        { name: "AZ\xDACAR", ...findCategoryCols(["azucar"], 4, 5) },
        { name: "POLLO", ...findCategoryCols(["pollo", "arroz"], 6, 7) },
        { name: "ESTANDAR Y SUPERIOR ASTURIAS", ...findCategoryCols(["estandar", "superior"], 8, 9) },
        { name: "MORTADELA SALPICAO Y ASTURIAS", ...findCategoryCols(["mortadela", "salpicao"], 10, 11) }
      ];
      for (let r = 2; r < rows.length; r++) {
        const row = rows[r];
        if (isRowCompletelyEmpty(row)) {
          tabMetric.emptyRowsSkipped++;
          continue;
        }
        const rawVendor = row[resolvedVendorCol];
        const vName = rawVendor !== null && rawVendor !== void 0 ? String(rawVendor).replace(/\s+/g, " ").trim() : "";
        if (!vName) {
          tabMetric.summaryRowsSkipped++;
          continue;
        }
        if (isSupervisorSummaryHeader(vName)) {
          tabMetric.summaryRowsSkipped++;
          continue;
        }
        tabMetric.validRecordsRead++;
        const vNorm = normalizeVendorName(vName);
        const liveCounts = clientActByVendor.get(vNorm);
        for (const cDef of catDefs) {
          const meta = Math.round(parseLocaleNumber(row[cDef.metaIdx], 0));
          let activados = Math.round(parseLocaleNumber(row[cDef.actIdx], 0));
          if (activados === 0 && liveCounts && liveCounts[cDef.name] !== void 0) {
            activados = liveCounts[cDef.name];
          }
          metasSupabaseRows.push({
            periodo,
            vendedor_id: vName,
            categoria: cDef.name,
            meta,
            activados
          });
          metasApiRows.push({
            vendedorId: vName,
            categoria: cDef.name,
            meta,
            activados
          });
        }
      }
      if (!metasSupabaseRows.some((m) => normalizeVendorName(m.vendedor_id).includes("ANGEL NAVARRO"))) {
        const angelCounts = clientActByVendor.get("ANGEL NAVARRO") || {};
        for (const cat of [
          "ACEITE",
          "AZ\xDACAR",
          "POLLO",
          "ESTANDAR Y SUPERIOR ASTURIAS",
          "MORTADELA SALPICAO Y ASTURIAS"
        ]) {
          const act = angelCounts[cat] || 0;
          metasSupabaseRows.push({ periodo, vendedor_id: "ANGEL NAVARRO", categoria: cat, meta: 0, activados: act });
          metasApiRows.push({ vendedorId: "ANGEL NAVARRO", categoria: cat, meta: 0, activados: act });
        }
      }
    }
    metrics[gridResolved.sheetName] = tabMetric;
  }
  const usuariosRows = [];
  const usrResolved = resolveSheetByAliases(workbook, ["usuarios"], ["usuario"]);
  if (usrResolved) {
    const rows = extractSheetRows(XLSX, usrResolved.sheet);
    const tabMetric = {
      sheetName: usrResolved.sheetName,
      totalRowsInSheet: rows.length,
      headerRows: rows.length > 0 ? 1 : 0,
      emptyRowsSkipped: 0,
      summaryRowsSkipped: 0,
      incompleteRowsLogged: 0,
      validRecordsRead: 0
    };
    if (rows.length > 1) {
      const cols = mapHeaderColumns(
        rows[0] || [],
        {
          usuario: ["usuario", "username", "nombre"],
          cedula: ["contrasena", "cedula", "password", "clave"],
          rol: ["rol", "role", "perfil"],
          vendorId: ["id_del_vendedor", "vendor_id", "id_vendedor", "id"]
        },
        { usuario: 0, cedula: 1, rol: 2, vendorId: 3 }
      );
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (isRowCompletelyEmpty(row)) {
          tabMetric.emptyRowsSkipped++;
          continue;
        }
        const usuario = String(row[cols.usuario] ?? "").replace(/\s+/g, " ").trim();
        const cedula = String(row[cols.cedula] ?? "").trim();
        if (!usuario) {
          tabMetric.incompleteRowsLogged++;
          warnings.push({
            sheet: usrResolved.sheetName,
            row: r + 1,
            reason: "Fila en Usuarios sin nombre de usuario"
          });
          continue;
        }
        tabMetric.validRecordsRead++;
        usuariosRows.push({
          usuario,
          cedula,
          rol: String(row[cols.rol] || "Vendedor").trim(),
          vendorId: String(row[cols.vendorId] ?? "").trim()
        });
      }
    }
    metrics[usrResolved.sheetName] = tabMetric;
  }
  const degustacionesRows = [];
  const degResolved = resolveSheetByAliases(workbook, ["degustaciones"], ["degustacion"]);
  if (degResolved) {
    const rows = extractSheetRows(XLSX, degResolved.sheet);
    const tabMetric = {
      sheetName: degResolved.sheetName,
      totalRowsInSheet: rows.length,
      headerRows: rows.length > 0 ? 1 : 0,
      emptyRowsSkipped: 0,
      summaryRowsSkipped: 0,
      incompleteRowsLogged: 0,
      validRecordsRead: 0
    };
    if (rows.length > 1) {
      const cols = mapHeaderColumns(
        rows[0] || [],
        {
          id: ["id"],
          fechaRegistro: ["fecha_registro", "created_at", "timestamp"],
          vendedor: ["vendedor", "vendedor_nombre"],
          ruta: ["ruta", "zona"],
          clienteCodigo: ["codigo_cliente", "id_cliente", "cliente_codigo"],
          clienteNombre: ["nombre_cliente", "cliente", "razon_social"],
          fechaDegustacion: ["fecha_degustacion", "fecha"],
          turno: ["turno"],
          horario: ["horario", "hora"],
          productos: ["productos", "producto"],
          kilosEstimados: ["kilos_estimados", "kilos"],
          personasEstimadas: ["personas_estimadas", "personas"],
          requierePromotora: ["requiere_promotora"],
          materialPop: ["material_pop"],
          contactoPunto: ["contacto_punto", "contacto"],
          telefonoContacto: ["telefono_contacto", "telefono"],
          estado: ["estado", "status"],
          promotoraAsignada: ["promotora_asignada", "promotora"],
          notasTradeMarketing: ["notas_trade_marketing", "notas", "observaciones"]
        },
        {
          id: 0,
          fechaRegistro: 1,
          vendedor: 2,
          ruta: 3,
          clienteCodigo: 4,
          clienteNombre: 5,
          fechaDegustacion: 6,
          turno: 7,
          horario: 8,
          productos: 9,
          kilosEstimados: 10,
          personasEstimadas: 11,
          requierePromotora: 12,
          materialPop: 13,
          contactoPunto: 14,
          telefonoContacto: 15,
          estado: 16,
          promotoraAsignada: 17,
          notasTradeMarketing: 18
        }
      );
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (isRowCompletelyEmpty(row)) {
          tabMetric.emptyRowsSkipped++;
          continue;
        }
        const id = String(row[cols.id] ?? "").trim();
        if (!id) {
          tabMetric.incompleteRowsLogged++;
          warnings.push({
            sheet: degResolved.sheetName,
            row: r + 1,
            reason: "Fila en Degustaciones con datos parciales pero sin ID primario"
          });
          continue;
        }
        tabMetric.validRecordsRead++;
        const rawProductos = String(row[cols.productos] ?? "").trim();
        const parsedProductos = rawProductos ? (parseCsvRfc4180(rawProductos)[0] || []).map((p) => p.trim()).filter(Boolean) : [];
        degustacionesRows.push({
          id,
          createdAt: parseSheetDate(row[cols.fechaRegistro]) || String(row[cols.fechaRegistro] ?? "").trim(),
          vendedorNombre: String(row[cols.vendedor] ?? "").trim(),
          ruta: String(row[cols.ruta] ?? "").trim(),
          clienteCodigo: normalizeClientCode(row[cols.clienteCodigo]).rawClean,
          clienteNombre: String(row[cols.clienteNombre] ?? "").trim(),
          fecha: parseSheetDate(row[cols.fechaDegustacion]) || "",
          turno: String(row[cols.turno] ?? "MA\xD1ANA").trim().toUpperCase(),
          hora: String(row[cols.horario] ?? "").trim(),
          productos: parsedProductos,
          kilosEstimados: parseLocaleNumber(row[cols.kilosEstimados], 0),
          personasEstimadas: Math.round(parseLocaleNumber(row[cols.personasEstimadas], 0)),
          requierePromotora: parseTruthySheetFlag(row[cols.requierePromotora]),
          materialPop: parseTruthySheetFlag(row[cols.materialPop]),
          contactoPunto: String(row[cols.contactoPunto] ?? "").trim(),
          telefonoContacto: String(row[cols.telefonoContacto] ?? "").trim(),
          estado: String(row[cols.estado] ?? "SOLICITADA").trim().toUpperCase(),
          promotoraAsignada: String(row[cols.promotoraAsignada] ?? "").trim(),
          notasTradeMarketing: String(row[cols.notasTradeMarketing] ?? "").trim()
        });
      }
    }
    metrics[degResolved.sheetName] = tabMetric;
  }
  return {
    periodo,
    volumenSupabaseRows,
    volumenApiRows,
    metasSupabaseRows,
    metasApiRows,
    activacionApiRows,
    activacionSupabaseUpserts,
    newSheetClientsForSupabase,
    productMaps,
    usuariosRows,
    degustacionesRows,
    metrics,
    warnings
  };
}

// server.ts
var import_firestore3 = require("firebase/firestore");
var import_supabase_js = require("@supabase/supabase-js");
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
import_dotenv.default.config();
process.on("uncaughtException", (err) => {
  const msg = err?.message || String(err);
  if (msg.includes("firestore") || msg.includes("GrpcConnection") || msg.includes("Name resolution failed") || err?.code === 14) {
    console.warn("[SERVER] Advertencia de red Firestore capturada (VPN/DNS):", msg);
    return;
  }
  console.error("[SERVER] Excepci\xF3n no controlada capturada:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  const msg = reason?.message || String(reason);
  if (msg.includes("firestore") || msg.includes("GrpcConnection") || msg.includes("Name resolution failed") || reason?.code === 14) {
    console.warn("[SERVER] Rechazo de red Firestore capturado (VPN/DNS):", msg);
    return;
  }
  console.error("[SERVER] Promesa rechazada no controlada:", reason);
});
if (typeof globalThis.WebSocket === "undefined") {
  try {
    globalThis.WebSocket = require("ws");
  } catch {
    globalThis.WebSocket = class DummyWebSocket {
    };
  }
}
var SUPABASE_URL = process.env.SUPABASE_URL || "https://nudltbgyewyiklqdyujk.supabase.co";
var SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.GERENCIA_SUPABASE_ANON_KEY || process.env.VITE_GERENCIA_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZGx0Ymd5ZXd5aWtscWR5dWprIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTgzMDA3OCwiZXhwIjoyMTA3NDA2MDc4fQ.k92vdZiuVkTzAWNK8Fq71m1Xi_MoWtpx_eRQcZTw1cA";
var supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? (0, import_supabase_js.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) : null;
var metasPeriodoActual = (d = /* @__PURE__ */ new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
var JWT_SECRET = process.env.JWT_SECRET || "codizulca_super_secret_jwt_key_2026_fdv_secure_token_9x8y7z";
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  if (!token) {
    return res.status(401).json({ success: false, error: "Token de autenticaci\xF3n requerido (Bearer token ausente)" });
  }
  import_jsonwebtoken.default.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, error: "Token inv\xE1lido o expirado" });
    }
    req.user = decoded;
    next();
  });
}
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === "ADMIN") {
    return next();
  }
  return res.status(403).json({ success: false, error: "Acceso no autorizado: Se requieren privilegios de Administrador" });
}
var rateLimitMap = /* @__PURE__ */ new Map();
function rateLimiter(windowMs, maxRequests, label) {
  return (req, res, next) => {
    const userKey = (req.user?.username || req.ip || "anon") + ":" + label;
    const now = Date.now();
    const record = rateLimitMap.get(userKey);
    if (!record || now > record.resetTime) {
      rateLimitMap.set(userKey, { count: 1, resetTime: now + windowMs });
      return next();
    }
    if (record.count >= maxRequests) {
      const waitSec = Math.ceil((record.resetTime - now) / 1e3);
      return res.status(429).json({
        success: false,
        error: `L\xEDmite de solicitudes alcanzado para ${label}. Por favor espera ${waitSec} segundos.`
      });
    }
    record.count++;
    next();
  };
}
var cachedWorkbook = null;
var lastFetchTime = 0;
var CACHE_TTL = 3e4;
var lastSuccessfulSheetSyncAt = "";
var lastSheetSource = "memory";
var lastSheetMetrics = {};
var lastSheetWarnings = [];
var cachedLocalMasterSeed = null;
function loadLocalMasterClientSeed() {
  if (cachedLocalMasterSeed) return cachedLocalMasterSeed;
  try {
    const seedPath = import_path.default.join(process.cwd(), "scripts", "data_maestra_octubre_2026.json");
    if (import_fs.default.existsSync(seedPath)) {
      const raw = JSON.parse(import_fs.default.readFileSync(seedPath, "utf8"));
      if (Array.isArray(raw)) {
        cachedLocalMasterSeed = raw.filter((item) => item && item.id && item.vendedor).map((item) => ({
          cliente_codigo: String(item.id).trim(),
          cliente_nombre: String(item.razonSocial || "").trim(),
          vendedor_id: String(item.vendedor).replace(/\s+/g, " ").trim(),
          vendedor_nombre: String(item.vendedor).replace(/\s+/g, " ").trim()
        }));
        return cachedLocalMasterSeed;
      }
    }
  } catch (err) {
    console.warn("[SERVER] No se pudo cargar semilla local data_maestra_octubre_2026.json:", err?.message);
  }
  return [];
}
function setNoCacheSyncHeaders(res, source) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  if (lastSuccessfulSheetSyncAt) {
    res.setHeader("X-Last-Sync", lastSuccessfulSheetSyncAt);
  }
  if (source || lastSheetSource) {
    res.setHeader("X-Sync-Source", source || lastSheetSource);
  }
}
async function fetchGoogleSheetWithRetry(url, maxAttempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15e3);
    try {
      const fetchRes = await fetch(url, {
        signal: controller.signal,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });
      if (!fetchRes.ok) {
        throw new Error(`HTTP ${fetchRes.status} ${fetchRes.statusText}`);
      }
      return await fetchRes.arrayBuffer();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delayMs = 500 * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("Fallo al descargar Google Sheet");
}
async function getWorkbook(force = false) {
  if (!force && cachedWorkbook && Date.now() - lastFetchTime < CACHE_TTL) {
    return cachedWorkbook;
  }
  const XLSX = await import("xlsx");
  const sheetId = getGoogleSheetId();
  try {
    const exportUrl = buildGoogleSheetExportUrl(sheetId, "xlsx");
    const buffer = await fetchGoogleSheetWithRetry(exportUrl, 3);
    cachedWorkbook = XLSX.read(buffer, { type: "array", raw: true });
    lastFetchTime = Date.now();
    lastSuccessfulSheetSyncAt = (/* @__PURE__ */ new Date()).toISOString();
    lastSheetSource = "live_google_sheet";
    const localPath2 = import_path.default.join(process.cwd(), "sheet.xlsx");
    try {
      import_fs.default.writeFileSync(localPath2, Buffer.from(buffer));
    } catch (_) {
    }
    return cachedWorkbook;
  } catch (err) {
    console.warn(`[SERVER] No se pudo obtener XLSX en vivo desde Google Sheets (${sheetId}):`, err?.message);
  }
  const localPath = import_path.default.join(process.cwd(), "sheet.xlsx");
  if (import_fs.default.existsSync(localPath)) {
    try {
      cachedWorkbook = XLSX.readFile(localPath);
      lastFetchTime = Date.now();
      lastSheetSource = "local_backup";
      if (!lastSuccessfulSheetSyncAt) {
        try {
          lastSuccessfulSheetSyncAt = import_fs.default.statSync(localPath).mtime.toISOString();
        } catch {
          lastSuccessfulSheetSyncAt = (/* @__PURE__ */ new Date()).toISOString();
        }
      }
      return cachedWorkbook;
    } catch (fsErr) {
      console.warn("[SERVER] Error leyendo archivo local sheet.xlsx:", fsErr?.message);
    }
  }
  if (cachedWorkbook) return cachedWorkbook;
  throw new Error("No se pudo cargar el libro de datos ni en l\xEDnea ni desde el respaldo local.");
}
async function startServer() {
  const app2 = (0, import_express.default)();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
  app2.use(import_express.default.json({ limit: "50mb" }));
  app2.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
  app2.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
      return res.status(400).json({ success: false, error: "JSON malformado en la petici\xF3n" });
    }
    next(err);
  });
  app2.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, X-Idempotency-Key");
    res.header("Access-Control-Expose-Headers", "X-Last-Sync, X-Sync-Source");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  app2.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  const VENDOR_SERVER_CREDENTIALS = {
    "ADMIN": { password: process.env.ADMIN_PASSWORD || "123", role: "ADMIN", vendorId: "ADMIN" },
    "MARIA BRICE\xD1O": { password: "15937615", role: "VENDEDOR", vendorId: "1" },
    "MARIANA CHACIN": { password: "15260049", role: "VENDEDOR", vendorId: "2" },
    "MIKELANGELO DIAZ": { password: "20863632", role: "VENDEDOR", vendorId: "3" },
    "MIKELANGELODIAZ@GMAIL.COM": { password: "20863632", role: "VENDEDOR", vendorId: "3" },
    "MIKELANGELO": { password: "20863632", role: "VENDEDOR", vendorId: "3" },
    "MIKELANGELO DIAZ1": { password: "20863632", role: "VENDEDOR", vendorId: "3" },
    "MIKELANGELO DIAZ - VILLA DEL ROS": { password: "20863632", role: "VENDEDOR", vendorId: "37" },
    "MIKELANGELO DIAZ VILLA DEL ROS": { password: "20863632", role: "VENDEDOR", vendorId: "37" },
    "MIKELANGELO VILLA DEL ROS": { password: "20863632", role: "VENDEDOR", vendorId: "37" },
    "JOHNATAN SOTO": { password: "20863632", role: "VENDEDOR", vendorId: "3" },
    "JOHNATAN": { password: "20863632", role: "VENDEDOR", vendorId: "3" },
    "JONATHAN": { password: "20863632", role: "VENDEDOR", vendorId: "3" },
    "JHONATAN": { password: "20863632", role: "VENDEDOR", vendorId: "3" },
    "HERNAN PAZ": { password: "15405797", role: "VENDEDOR", vendorId: "4" },
    "OSWALDO CHURION": { password: "13754472", role: "VENDEDOR", vendorId: "7" },
    "CARLOS FUENMAYOR": { password: "18741545", role: "VENDEDOR", vendorId: "12" },
    "SARAH REYES": { password: "18663070", role: "VENDEDOR", vendorId: "14" },
    "J PABLO ARAUJO - CAB/OJE": { password: "15239697", role: "VENDEDOR", vendorId: "15" },
    "JOSE G. GONZALEZ": { password: "13262058", role: "VENDEDOR", vendorId: "16" },
    "FOOD SERVICE SUR": { password: "19", role: "VENDEDOR", vendorId: "19" },
    "JAIDER MEDINA - FOOD SERVICE NORTE": { password: "20", role: "VENDEDOR", vendorId: "20" },
    "JAIDER MEDINA": { password: "20", role: "VENDEDOR", vendorId: "20" },
    "ANGELICA MORENO": { password: "14682378", role: "VENDEDOR", vendorId: "21" },
    "ADEL JARABA": { password: "11719291", role: "VENDEDOR", vendorId: "22" },
    "JUAN HERNANDEZ": { password: "14658122", role: "VENDEDOR", vendorId: "24" },
    "YOLEIDA LUGO": { password: "10083900", role: "VENDEDOR", vendorId: "25" },
    "SAIRU VALLES": { password: "18383237", role: "VENDEDOR", vendorId: "26" },
    "ELISA SOLER": { password: "12330043", role: "VENDEDOR", vendorId: "28" },
    "ALI PEREZ": { password: "19117934", role: "SUPERVISOR", vendorId: "SUPERVISOR_ALI_PEREZ" },
    "ANGEL NAVARRO": { password: "25468939", role: "VENDEDOR", vendorId: "29" },
    "MARIANGEL GONZALEZ": { password: "20552780", role: "VENDEDOR", vendorId: "47" },
    "MARIANGEL": { password: "20552780", role: "VENDEDOR", vendorId: "47" },
    "VICTOR CAMPOS": { password: "19944329", role: "VENDEDOR", vendorId: "48" },
    "J PABLO ARAUJO": { password: "15239697", role: "VENDEDOR", vendorId: "31" },
    "EDUARDO PI\xD1A": { password: "11878063", role: "VENDEDOR", vendorId: "33" },
    "JOHNATAN SOTO VILLA DEL ROS": { password: "18395226", role: "VENDEDOR", vendorId: "37" },
    "LEONARDO RIOS": { password: "17925198", role: "VENDEDOR", vendorId: "38" },
    "MARYERY GARCIA": { password: "12712534", role: "VENDEDOR", vendorId: "39" },
    "LUIS GUANIPA": { password: "18700742", role: "VENDEDOR", vendorId: "40" },
    "PEDRO ABREU": { password: "12456937", role: "VENDEDOR", vendorId: "45" },
    "OSCAR ORTIZ": { password: "16347637", role: "VENDEDOR", vendorId: "46" }
  };
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ success: false, error: "Usuario y contrase\xF1a requeridos" });
      }
      const usuarioUpper = String(username).toUpperCase().trim();
      const pwd = String(password).trim();
      const pwdClean = pwd.replace(/\D/g, "");
      const normalizeForAuth = (s) => {
        return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Ñ/gi, "N").replace(/\s+/g, " ").trim().toUpperCase();
      };
      const usuarioNorm = normalizeForAuth(usuarioUpper);
      let creds = VENDOR_SERVER_CREDENTIALS[usuarioUpper];
      let matchedCanonicalKey = usuarioUpper;
      if (!creds) {
        for (const [key, val] of Object.entries(VENDOR_SERVER_CREDENTIALS)) {
          if (normalizeForAuth(key) === usuarioNorm) {
            creds = val;
            matchedCanonicalKey = key;
            break;
          }
        }
      }
      const isNewFalconVendor = ["ANGEL NAVARRO", "MARIANGEL GONZALEZ", "MARIANGEL", "VICTOR CAMPOS"].includes(matchedCanonicalKey);
      if (supabase) {
        try {
          const { data: supaUser, error: supaErr } = await supabase.from("usuarios").select("*").in("username", [usuarioUpper, matchedCanonicalKey]).maybeSingle();
          if (!supaErr && supaUser) {
            const isBcrypt = supaUser.password_hash && supaUser.password_hash.startsWith("$2");
            let isValid = false;
            if (isBcrypt) {
              isValid = await import_bcryptjs.default.compare(pwd, supaUser.password_hash) || await import_bcryptjs.default.compare(pwdClean, supaUser.password_hash);
            } else {
              isValid = pwd === supaUser.password_hash || pwdClean === supaUser.password_hash || creds && (pwd === creds.password || pwdClean === creds.password) || matchedCanonicalKey === "ANGEL NAVARRO" && pwdClean === "25468939" || isNewFalconVendor && (pwdClean === "19117934" || pwd === "123" || pwdClean === String(supaUser.vendor_id || ""));
            }
            if (!isValid && creds && (pwd === creds.password || pwdClean === creds.password)) {
              isValid = true;
            }
            if (isValid) {
              const supProfile = getSupervisorProfile(supaUser.username);
              const resolvedRole = supProfile ? "SUPERVISOR" : supaUser.role;
              const token2 = import_jsonwebtoken.default.sign(
                {
                  username: matchedCanonicalKey || supaUser.username,
                  role: resolvedRole,
                  vendorId: supaUser.vendor_id
                },
                JWT_SECRET,
                { expiresIn: "7d" }
              );
              return res.json({
                success: true,
                token: token2,
                user: {
                  username: matchedCanonicalKey || supaUser.username,
                  role: resolvedRole,
                  vendorId: supaUser.vendor_id
                },
                source: "supabase"
              });
            } else {
              return res.status(401).json({ success: false, error: "Contrase\xF1a incorrecta" });
            }
          }
        } catch (e) {
        }
      }
      if (!creds) {
        return res.status(401).json({ success: false, error: "Usuario no autorizado o no encontrado en la base de datos" });
      }
      const isMikel = matchedCanonicalKey.includes("MIKELANGELO") || matchedCanonicalKey.includes("SOTO") || matchedCanonicalKey.includes("JOHNATAN");
      const isValidPwd = pwd === creds.password || pwdClean === creds.password || matchedCanonicalKey === "ANGEL NAVARRO" && pwdClean === "25468939" || isMikel && (pwdClean === "20863632" || pwdClean === "18395226") || isNewFalconVendor && (pwdClean === "19117934" || pwd === "123" || pwdClean === creds.vendorId);
      if (!isValidPwd) {
        return res.status(401).json({ success: false, error: "Contrase\xF1a incorrecta" });
      }
      const token = import_jsonwebtoken.default.sign(
        {
          username: matchedCanonicalKey,
          role: creds.role,
          vendorId: creds.vendorId
        },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      return res.json({
        success: true,
        token,
        user: {
          username: matchedCanonicalKey,
          role: creds.role,
          vendorId: creds.vendorId
        },
        source: "local"
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: "Error interno en autenticaci\xF3n" });
    }
  });
  app2.get("/api/auth/me", authenticateToken, (req, res) => {
    const supProfile = getSupervisorProfile(req.user?.username);
    const resolvedRole = supProfile ? "SUPERVISOR" : req.user.role;
    return res.json({
      success: true,
      user: {
        username: req.user.username,
        role: resolvedRole,
        vendorId: req.user.vendorId
      }
    });
  });
  const EXCLUDED_TEST_DEG_IDS = /* @__PURE__ */ new Set([
    "deg-001",
    "deg-002",
    "deg-003",
    "deg-mupk8tih-e3wf",
    "deg-muplzpkm-ncuu",
    "test-ping-01"
  ]);
  function normalizeDegustacionRecord(raw) {
    const cleanId = String(raw.id || raw.degustacionId || "").replace(/^DEG-/, "");
    return {
      id: cleanId,
      clienteCodigo: raw.clienteCodigo || raw.cliente_codigo || "PDV",
      clienteNombre: raw.clienteNombre || raw.cliente_nombre || raw.client || "Punto de Venta",
      vendedorNombre: raw.vendedorNombre || raw.vendedor_nombre || raw.vendedor || "Vendedor",
      vendedorId: raw.vendedorId || raw.vendedor_id || raw.ruta || "1",
      vendedorEmail: raw.vendedorEmail || raw.vendedor_email || void 0,
      ruta: raw.ruta || raw.zone || raw.vendedorId || raw.vendedor_id || "",
      fecha: raw.fecha || raw.date || "",
      turno: raw.turno || "MA\xD1ANA",
      hora: raw.hora || raw.time || "",
      productos: Array.isArray(raw.productos) ? raw.productos : typeof raw.productos === "string" && raw.productos ? raw.productos.split(",").map((s) => s.trim()) : [],
      kilosEstimados: Number(raw.kilosEstimados ?? raw.kilos_estimados) || 0,
      personasEstimadas: Number(raw.personasEstimadas ?? raw.personas_estimadas) || 150,
      requierePromotora: Boolean(raw.requierePromotora ?? raw.requiere_promotora ?? true),
      promotoraAsignada: raw.promotoraAsignada || raw.promotora_asignada || "",
      materialPop: Boolean(raw.materialPop ?? raw.material_pop ?? true),
      contactoPunto: raw.contactoPunto || raw.contacto_punto || "",
      telefonoContacto: raw.telefonoContacto || raw.telefono_contacto || "",
      observaciones: raw.observaciones || "",
      estado: raw.estado || "SOLICITADA",
      notasTradeMarketing: raw.notasTradeMarketing || raw.notas_trade_marketing || "",
      resultado: raw.resultado || null,
      createdAt: raw.createdAt || raw.created_at || (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  function sortDegustacionesServer(list, ascending = false) {
    const shiftRank = (turno, hora) => {
      const t = String(turno || "").toUpperCase().trim();
      const h = String(hora || "").toUpperCase().trim();
      if (t === "MA\xD1ANA" || t === "MANANA" || h.includes("09:") || h.includes("9:") || h.includes("AM")) return 1;
      if (t === "TARDE" || h.includes("02:") || h.includes("14:") || h.includes("04:") || h.includes("PM")) return 2;
      return 3;
    };
    const toIsoDate = (raw) => {
      const s = String(raw || "").trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
        const [d, m, y] = s.split("/");
        return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
      return s;
    };
    return [...list].sort((a, b) => {
      const dateA = toIsoDate(a.fecha || a.date);
      const dateB = toIsoDate(b.fecha || b.date);
      if (dateA !== dateB) {
        return ascending ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      }
      const rankA = shiftRank(a.turno, a.hora || a.time);
      const rankB = shiftRank(b.turno, b.hora || b.time);
      if (rankA !== rankB) {
        return ascending ? rankB - rankA : rankA - rankB;
      }
      const vendA = String(a.vendedorNombre || a.vendedor || "").toUpperCase().trim();
      const vendB = String(b.vendedorNombre || b.vendedor || "").toUpperCase().trim();
      if (vendA !== vendB) {
        return ascending ? vendB.localeCompare(vendA, "es") : vendA.localeCompare(vendB, "es");
      }
      const cliA = String(a.clienteNombre || a.client || "").toUpperCase().trim();
      const cliB = String(b.clienteNombre || b.client || "").toUpperCase().trim();
      if (cliA !== cliB) {
        return ascending ? cliB.localeCompare(cliA, "es") : cliA.localeCompare(cliB, "es");
      }
      return ascending ? String(b.id || "").localeCompare(String(a.id || "")) : String(a.id || "").localeCompare(String(b.id || ""));
    });
  }
  async function loadAllMergedDegustaciones() {
    const mapById = /* @__PURE__ */ new Map();
    if (supabase) {
      try {
        const { data: supaList, error: supaErr } = await supabase.from("degustaciones").select("*").order("fecha", { ascending: false });
        if (!supaErr && Array.isArray(supaList)) {
          for (const row of supaList) {
            const norm = normalizeDegustacionRecord(row);
            if (norm.id && !EXCLUDED_TEST_DEG_IDS.has(norm.id) && !norm.id.startsWith("test-")) {
              mapById.set(norm.id, norm);
            }
          }
        }
      } catch (_) {
      }
    }
    try {
      const snapshot = await (0, import_firestore3.getDocs)((0, import_firestore3.collection)(db, "degustaciones"));
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.clienteNombre) {
          const norm = normalizeDegustacionRecord({ id: docSnap.id, ...data });
          if (norm.id && !EXCLUDED_TEST_DEG_IDS.has(norm.id) && !norm.id.startsWith("test-")) {
            mapById.set(norm.id, norm);
          }
        }
      });
    } catch (_) {
    }
    return sortDegustacionesServer(Array.from(mapById.values()), false);
  }
  app2.get("/api/degustaciones", async (req, res) => {
    try {
      let list = await loadAllMergedDegustaciones();
      if (req.query.vendedor) {
        const v = String(req.query.vendedor).toUpperCase().trim();
        list = list.filter(
          (d) => (d.vendedorNombre || "").toUpperCase().includes(v) || (d.vendedorId || "").toUpperCase().includes(v)
        );
      }
      if (req.query.estado) {
        const e = String(req.query.estado).toUpperCase().trim();
        list = list.filter((d) => (d.estado || "").toUpperCase() === e);
      }
      if (req.query.fecha) {
        const f = String(req.query.fecha).trim();
        list = list.filter((d) => d.fecha === f);
      }
      res.json({
        success: true,
        count: list.length,
        data: list,
        source: "merged_ordered"
      });
    } catch (err) {
      console.error("Error fetching degustaciones via API:", err);
      res.status(500).json({ error: "Error al consultar degustaciones", details: err?.message });
    }
  });
  const GOOGLE_SCRIPT_WEBHOOK_URL = process.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL || "https://script.google.com/macros/s/AKfycbx6JMUR1IubQuZ97Ics7emw_I0G9UAy-5vig4Vl8zPwW8yMBbZldvQGeGOPNiNbUmVTaQ/exec";
  const GERENCIA_TRADE_API_URL = process.env.GERENCIA_TRADE_API_URL || "https://codizulca-dashboard-4.onrender.com/api/degustaciones";
  const GERENCIA_UTERIO_SURVEYS_URL = "https://uterioexpfweghxfbvoa.supabase.co/rest/v1/surveys";
  const GERENCIA_UTERIO_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0ZXJpb2V4cGZ3ZWdoeGZidm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5NTg3ODYsImV4cCI6MjEwMzUzNDc4Nn0.bZnN4vrXUDlcoIaI7l39O-bU4GQp05SvJdio_cn6niI";
  const GERENCIA_SUPABASE_SURVEYS_URL = process.env.GERENCIA_SUPABASE_SURVEYS_URL || process.env.VITE_GERENCIA_SUPABASE_SURVEYS_URL || "https://nudltbgyewyiklqdyujk.supabase.co/rest/v1/surveys";
  const GERENCIA_SUPABASE_ANON_KEY = process.env.GERENCIA_SUPABASE_ANON_KEY || process.env.VITE_GERENCIA_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZGx0Ymd5ZXd5aWtscWR5dWprIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTgzMDA3OCwiZXhwIjoyMTA3NDA2MDc4fQ.k92vdZiuVkTzAWNK8Fq71m1Xi_MoWtpx_eRQcZTw1cA";
  const PEDIDOS_MANUALES_SUPABASE_URL = process.env.PEDIDOS_MANUALES_SUPABASE_URL || "https://vxduxyrbeybhhbpdyqoc.supabase.co";
  const PEDIDOS_MANUALES_SUPABASE_KEY = process.env.PEDIDOS_MANUALES_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4ZHV4eXJiZXliaGhicGR5cW9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzUxNTgsImV4cCI6MjEwNjY1MTE1OH0.sOgUaTLZ0NhlVYSLukAysyxRzggAicjM4n-u4H8NrQ4";
  function buildTradeMarketingItemServer(rawItem, existingRemote) {
    const item = normalizeDegustacionRecord(rawItem);
    const recordId = `DEG-${item.id}`;
    let dmyDate = String(item.fecha || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dmyDate)) {
      const [y, m, day] = dmyDate.split("-");
      dmyDate = `${day}/${m}/${y}`;
    }
    const timeStr = item.hora && item.hora.trim() ? item.hora.trim() : item.turno === "TARDE" ? "02:00 PM - 07:00 PM" : "09:00 AM - 01:00 PM";
    const productStr = Array.isArray(item.productos) && item.productos.length > 0 ? item.productos.join(", ") : item.productos || "MORTADELA";
    const vendedorName = String(item.vendedorNombre || "VENDEDOR COMERCIAL").trim();
    const clientName = String(item.clienteNombre || "Punto de Venta").trim();
    const zoneName = String(item.ruta || item.vendedorId || vendedorName || "Ruta Comercial").trim();
    const kilosNum = Number(item.kilosEstimados) || 5;
    const targetNum = Number(item.personasEstimadas) || 150;
    let status = "scheduled";
    const norm = String(item.estado || "SOLICITADA").toUpperCase().trim();
    if (norm === "REALIZADA" || norm === "COMPLETED") status = "completed";
    else if (norm === "CANCELADA" || norm === "RECHAZADA" || norm === "CANCELLED") status = "cancelled";
    if (existingRemote && existingRemote.status && existingRemote.status !== "scheduled" && status === "scheduled") {
      status = existingRemote.status;
    }
    const rawPromoter = String(item.promotoraAsignada || "").trim();
    const hasLocalAssigned = rawPromoter && !rawPromoter.toUpperCase().includes("POR ASIGNAR");
    const hasRemoteAssigned = existingRemote?.promoter && !String(existingRemote.promoter).toUpperCase().includes("POR ASIGNAR");
    const promoter = hasLocalAssigned ? rawPromoter : hasRemoteAssigned ? existingRemote.promoter : "POR ASIGNAR (Trade Marketing)";
    const promoterEmail = hasRemoteAssigned ? existingRemote.promoterEmail || "" : "";
    const promoterId = hasRemoteAssigned ? existingRemote.promoterId || "" : "";
    const promoterRole = hasRemoteAssigned && existingRemote.promoterRole ? existingRemote.promoterRole : "Impulsadora";
    const contactPrefix = item.contactoPunto ? `Contacto en tienda: ${item.contactoPunto.trim()}${item.telefonoContacto ? ` (${item.telefonoContacto.trim()})` : ""}. ` : "";
    const obsClean = String(item.observaciones || "").trim();
    const bodyNote = obsClean ? obsClean : `Agendada por ${vendedorName}. Kilos: ${kilosNum}. Personas: ${targetNum}.`;
    const fullComments = `${contactPrefix}${bodyNote}`.trim();
    return {
      id: recordId,
      date: dmyDate,
      time: timeStr,
      activity: `Degustaci\xF3n ${productStr} - Solicitada por ${vendedorName}`,
      product: productStr,
      promoter,
      ...promoterEmail ? { promoterEmail } : {},
      ...promoterId ? { promoterId } : {},
      promoterRole,
      client: clientName,
      zone: zoneName,
      vendedor: vendedorName,
      source: "vendedor_app",
      status,
      delivered: Number(item.resultado?.personasAlcanzadas || existingRemote?.delivered || 0),
      target: targetNum,
      acceptanceRate: Number(existingRemote?.acceptanceRate || (status === "completed" ? 95 : 0)),
      comments: fullComments
    };
  }
  function syncToTradeMarketingJson(itemOrList) {
    try {
      const items = sortDegustacionesServer(Array.isArray(itemOrList) ? itemOrList : [itemOrList], false);
      const gerencia3Path = import_path.default.resolve(process.cwd(), "../codizulca-dashboard (3)/data_degustaciones.json");
      const gerencia4Path = import_path.default.resolve(process.cwd(), "../codizulca-dashboard (4)/data_degustaciones.json");
      const localPath = import_path.default.resolve(process.cwd(), "data_degustaciones.json");
      const targetPaths = [localPath];
      if (import_fs.default.existsSync(import_path.default.dirname(gerencia3Path))) targetPaths.push(gerencia3Path);
      if (import_fs.default.existsSync(import_path.default.dirname(gerencia4Path))) targetPaths.push(gerencia4Path);
      for (const tPath of targetPaths) {
        let existing = [];
        try {
          if (import_fs.default.existsSync(tPath)) {
            existing = JSON.parse(import_fs.default.readFileSync(tPath, "utf8") || "[]");
          }
        } catch (_) {
        }
        const existingMap = /* @__PURE__ */ new Map();
        const historicalItems = [];
        existing.forEach((e) => {
          if (!e || !e.id) return;
          const normId = String(e.id).startsWith("DEG-") ? String(e.id) : `DEG-${e.id}`;
          existingMap.set(normId, e);
          if (String(e.id).startsWith("DEG-HIST-")) {
            historicalItems.push(e);
          }
        });
        const updatedVendorMap = /* @__PURE__ */ new Map();
        if (!Array.isArray(itemOrList)) {
          existing.forEach((e) => {
            if (e && e.id && !String(e.id).startsWith("DEG-HIST-")) {
              const normId = String(e.id).startsWith("DEG-") ? String(e.id) : `DEG-${e.id}`;
              updatedVendorMap.set(normId, e);
            }
          });
        }
        for (const rawItem of items) {
          if (!rawItem || !rawItem.id && !rawItem.degustacionId) continue;
          const cleanId = String(rawItem.id || rawItem.degustacionId).replace(/^DEG-/, "");
          const degId = `DEG-${cleanId}`;
          const built = buildTradeMarketingItemServer(rawItem, existingMap.get(degId));
          updatedVendorMap.set(degId, built);
        }
        const vendorItems = Array.from(updatedVendorMap.values());
        vendorItems.sort((a, b) => {
          const toIso = (s) => {
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(s || "")) {
              const [d, m, y] = s.split("/");
              return `${y}-${m}-${d}`;
            }
            return s || "";
          };
          const dA = toIso(a.date);
          const dB = toIso(b.date);
          if (dA !== dB) return dB.localeCompare(dA);
          const tA = String(a.time || "").includes("09:") ? 1 : 2;
          const tB = String(b.time || "").includes("09:") ? 1 : 2;
          if (tA !== tB) return tA - tB;
          return String(a.vendedor || "").localeCompare(String(b.vendedor || ""), "es");
        });
        const finalJsonList = [...vendorItems, ...historicalItems];
        try {
          import_fs.default.writeFileSync(tPath, JSON.stringify(finalJsonList, null, 2), "utf8");
        } catch (err) {
          console.warn(`[SYNC TRADE] Error al escribir en ${tPath}:`, err?.message);
        }
      }
    } catch (e) {
      console.warn("[SYNC TRADE] Error sincronizando archivo json de Trade Marketing:", e?.message);
    }
  }
  function deleteFromTradeMarketingJson(id) {
    try {
      const cleanId = String(id).replace(/^DEG-/, "");
      const degId = `DEG-${cleanId}`;
      const gerencia3Path = import_path.default.resolve(process.cwd(), "../codizulca-dashboard (3)/data_degustaciones.json");
      const gerencia4Path = import_path.default.resolve(process.cwd(), "../codizulca-dashboard (4)/data_degustaciones.json");
      const localPath = import_path.default.resolve(process.cwd(), "data_degustaciones.json");
      const targetPaths = [localPath];
      if (import_fs.default.existsSync(import_path.default.dirname(gerencia3Path))) targetPaths.push(gerencia3Path);
      if (import_fs.default.existsSync(import_path.default.dirname(gerencia4Path))) targetPaths.push(gerencia4Path);
      for (const tPath of targetPaths) {
        if (!import_fs.default.existsSync(tPath)) continue;
        const existing = JSON.parse(import_fs.default.readFileSync(tPath, "utf8") || "[]");
        const filtered = existing.filter((e) => e.id !== id && e.id !== cleanId && e.id !== degId);
        import_fs.default.writeFileSync(tPath, JSON.stringify(filtered, null, 2), "utf8");
      }
    } catch (e) {
      console.warn("[SYNC TRADE] Error eliminando de json Trade Marketing:", e?.message);
    }
  }
  function buildGerenciaDirectPayload(rawItem) {
    const item = normalizeDegustacionRecord(rawItem);
    const normEstado = (item.estado || "SOLICITADA").toUpperCase();
    let status = "Solicitada";
    if (normEstado === "APROBADA") status = "Aprobada";
    else if (normEstado === "RECHAZADA") status = "Rechazada";
    else if (normEstado === "CANCELADA") status = "Cancelada";
    else if (normEstado === "REALIZADA") status = "Realizada";
    let shift = "Ma\xF1ana (9:00 AM - 1:00 PM)";
    if (item.turno === "TARDE") shift = "Tarde (2:00 PM - 7:00 PM)";
    else if (item.turno === "COMPLETO") shift = "D\xEDa Completo";
    const productListStr = Array.isArray(item.productos) && item.productos.length > 0 ? item.productos.join(", ") : item.productos || "MORTADELA";
    const rawPromoter = String(item.promotoraAsignada || "").trim();
    const promoterAssigned = rawPromoter && !rawPromoter.toUpperCase().includes("POR ASIGNAR") ? rawPromoter : "";
    const commentsObj = {
      isTasting: true,
      source: "vendedor_app",
      degustacionId: item.id,
      id: item.id,
      client: item.clienteNombre,
      cliente: item.clienteNombre,
      clienteCodigo: item.clienteCodigo || "PDV",
      store: item.clienteNombre,
      vendedor: item.vendedorNombre,
      salesRep: item.vendedorNombre,
      promoter: promoterAssigned || "POR ASIGNAR (Trade Marketing)",
      promotoraAsignada: promoterAssigned,
      ruta: item.ruta || item.vendedorId || "",
      date: item.fecha || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      turno: item.turno || "MA\xD1ANA",
      shift,
      time: item.hora || (item.turno === "MA\xD1ANA" ? "09:00 AM - 01:00 PM" : "02:00 PM - 07:00 PM"),
      products: productListStr,
      product: productListStr,
      kilos: Number(item.kilosEstimados) || 0,
      kg: Number(item.kilosEstimados) || 0,
      personas: Number(item.personasEstimadas) || 150,
      personasEstimadas: Number(item.personasEstimadas) || 150,
      estado: normEstado,
      status,
      requierePromotora: Boolean(item.requierePromotora),
      promoterType: item.requierePromotora ? "Fija" : "Vendedor / Impulso",
      materialPop: item.materialPop ? "SI" : "NO",
      contactoPunto: item.contactoPunto || "",
      telefonoContacto: item.telefonoContacto || "",
      address: `Ruta: ${item.ruta || item.vendedorNombre || ""} | Contacto: ${item.contactoPunto || ""} (${item.telefonoContacto || ""})`,
      notes: item.observaciones || `Agendada por ${item.vendedorNombre}. Kilos: ${item.kilosEstimados || 5}. Personas: ${item.personasEstimadas || 150}.`,
      originalComments: item.observaciones || `Agendada por ${item.vendedorNombre}. Kilos: ${item.kilosEstimados || 5}. Personas: ${item.personasEstimadas || 150}.`,
      notasTradeMarketing: item.notasTradeMarketing || "",
      resultado: item.resultado || null
    };
    return {
      type: "Degustacion",
      date: item.fecha || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      store: item.clienteNombre,
      promoter: promoterAssigned || item.vendedorNombre || "Vendedor",
      product: productListStr,
      comments: JSON.stringify(commentsObj)
    };
  }
  async function upsertSurveyAtSupabase(url, apiKey, cleanId, payload) {
    try {
      const searchUrl = `${url}?comments=like.*${encodeURIComponent(cleanId)}*&select=id&limit=5`;
      const searchRes = await fetch(searchUrl, {
        method: "GET",
        headers: {
          "apikey": apiKey,
          "Authorization": `Bearer ${apiKey}`
        }
      });
      if (searchRes.ok) {
        const records = await searchRes.json();
        if (Array.isArray(records) && records.length > 0 && records[0].id) {
          const updateUrl = `${url}?id=eq.${records[0].id}`;
          await fetch(updateUrl, {
            method: "PATCH",
            headers: {
              "apikey": apiKey,
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "Prefer": "return=representation"
            },
            body: JSON.stringify(payload)
          });
          return;
        }
      }
      await fetch(url, {
        method: "POST",
        headers: {
          "apikey": apiKey,
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify(payload)
      });
    } catch (_) {
    }
  }
  async function syncToGerenciaDirect(item, existingRemote) {
    try {
      const norm = normalizeDegustacionRecord(item);
      if (!norm.id || EXCLUDED_TEST_DEG_IDS.has(norm.id)) return;
      syncToTradeMarketingJson(norm);
      const tradeItem = buildTradeMarketingItemServer(norm, existingRemote);
      const surveyPayload = buildGerenciaDirectPayload(norm);
      await Promise.all([
        // Enviar en vivo a https://codizulca-dashboard-4.onrender.com/api/degustaciones
        fetch(GERENCIA_TRADE_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tradeItem)
        }).catch(() => {
        }),
        // Sincronizar en Supabase de Gerencia (uterioexpfweghxfbvoa)
        upsertSurveyAtSupabase(GERENCIA_UTERIO_SURVEYS_URL, GERENCIA_UTERIO_ANON_KEY, norm.id, surveyPayload),
        // Sincronizar en Supabase del Planificador (nudltbgyewyiklqdyujk)
        upsertSurveyAtSupabase(GERENCIA_SUPABASE_SURVEYS_URL, GERENCIA_SUPABASE_ANON_KEY, norm.id, surveyPayload)
      ]);
    } catch (err) {
      console.warn("Failed to sync directly to Gerencia:", err);
    }
  }
  async function deleteFromGerenciaDirect(id) {
    try {
      const cleanId = String(id).replace(/^DEG-/, "");
      const degId = `DEG-${cleanId}`;
      deleteFromTradeMarketingJson(cleanId);
      await Promise.all([
        fetch(`${GERENCIA_TRADE_API_URL}/${encodeURIComponent(degId)}`, { method: "DELETE" }).catch(() => {
        }),
        fetch(`${GERENCIA_UTERIO_SURVEYS_URL}?comments=like.*${encodeURIComponent(cleanId)}*`, {
          method: "DELETE",
          headers: {
            "apikey": GERENCIA_UTERIO_ANON_KEY,
            "Authorization": `Bearer ${GERENCIA_UTERIO_ANON_KEY}`
          }
        }).catch(() => {
        }),
        fetch(`${GERENCIA_SUPABASE_SURVEYS_URL}?comments=like.*${encodeURIComponent(cleanId)}*`, {
          method: "DELETE",
          headers: {
            "apikey": GERENCIA_SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${GERENCIA_SUPABASE_ANON_KEY}`
          }
        }).catch(() => {
        })
      ]);
    } catch (err) {
      console.warn("Failed to delete from Gerencia:", err);
    }
  }
  app2.post("/api/degustaciones/sync-gerencia", async (req, res) => {
    try {
      console.log("[SYNC TRADE] Sincronizando todas las degustaciones en orden cronol\xF3gico con Trade Marketing (codizulca-dashboard-4)...");
      const mergedDesc = await loadAllMergedDegustaciones();
      if (supabase && mergedDesc.length > 0) {
        const supaRows = mergedDesc.map((record) => ({
          id: record.id,
          cliente_codigo: record.clienteCodigo || "PDV",
          cliente_nombre: record.clienteNombre,
          vendedor_nombre: record.vendedorNombre || "Vendedor",
          vendedor_id: record.vendedorId || "1",
          vendedor_email: record.vendedorEmail || null,
          ruta: record.ruta || "",
          fecha: record.fecha,
          turno: record.turno || "MA\xD1ANA",
          hora: record.hora || "",
          productos: Array.isArray(record.productos) ? record.productos : [],
          kilos_estimados: Number(record.kilosEstimados) || 0,
          personas_estimadas: Number(record.personasEstimadas) || 150,
          requiere_promotora: Boolean(record.requierePromotora),
          promotora_asignada: record.promotoraAsignada || "",
          material_pop: Boolean(record.materialPop),
          contacto_punto: record.contactoPunto || "",
          telefono_contacto: record.telefonoContacto || "",
          observaciones: record.observaciones || "",
          estado: record.estado || "SOLICITADA",
          notas_trade_marketing: record.notasTradeMarketing || "",
          resultado: record.resultado || null,
          created_at: record.createdAt
        }));
        await supabase.from("degustaciones").upsert(supaRows);
      }
      const remoteById = /* @__PURE__ */ new Map();
      try {
        const remRes = await fetch(GERENCIA_TRADE_API_URL);
        if (remRes.ok) {
          const remJson = await remRes.json();
          if (Array.isArray(remJson)) {
            remJson.forEach((r) => {
              if (r && r.id) remoteById.set(String(r.id), r);
            });
          }
        }
      } catch (_) {
      }
      syncToTradeMarketingJson(mergedDesc);
      const orderedAsc = sortDegustacionesServer(mergedDesc, true);
      let countSynced = 0;
      for (const item of orderedAsc) {
        const degId = `DEG-${item.id}`;
        await syncToGerenciaDirect(item, remoteById.get(degId));
        countSynced++;
      }
      res.json({
        success: true,
        message: "Degustaciones sincronizadas y ordenadas correctamente en Trade Marketing",
        total: mergedDesc.length,
        synced: countSynced,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (err) {
      console.error("[SYNC TRADE] Error en /api/degustaciones/sync-gerencia:", err);
      res.status(500).json({ error: "Error sincronizando con Trade Marketing", details: err?.message });
    }
  });
  async function syncToGoogleScript(item) {
    try {
      await fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_DEGUSTACION",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          id: item.id,
          fechaRegistro: item.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
          vendedor: item.vendedorNombre || item.vendedor,
          ruta: item.ruta || item.vendedorId,
          clienteCodigo: item.clienteCodigo,
          clienteNombre: item.clienteNombre,
          fechaDegustacion: item.fecha || item.fechaDegustacion,
          turno: item.turno,
          hora: item.hora,
          productos: Array.isArray(item.productos) ? item.productos.join(", ") : item.productos,
          kilosEstimados: item.kilosEstimados,
          personasEstimadas: item.personasEstimadas,
          requierePromotora: item.requierePromotora ? "SI" : "NO",
          materialPop: item.materialPop ? "SI" : "NO",
          contactoPunto: item.contactoPunto || "",
          telefonoContacto: item.telefonoContacto || "",
          estado: item.estado || "SOLICITADA",
          promotoraAsignada: item.promotoraAsignada || "",
          notasTradeMarketing: item.notasTradeMarketing || "",
          observaciones: item.observaciones || ""
        })
      });
    } catch (err) {
      console.warn("Failed to sync with Google Script:", err);
    }
  }
  app2.post("/api/degustaciones", async (req, res) => {
    try {
      const item = req.body;
      if (!item || !item.clienteNombre || !item.fecha) {
        return res.status(400).json({ error: "Faltan campos obligatorios (clienteNombre, fecha)" });
      }
      const id = item.id || `deg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const record = {
        ...item,
        id,
        createdAt: item.createdAt || (/* @__PURE__ */ new Date()).toISOString()
      };
      await (0, import_firestore3.setDoc)((0, import_firestore3.doc)(db, "degustaciones", id), record);
      if (supabase) {
        Promise.resolve(supabase.from("degustaciones").upsert({
          id: record.id,
          cliente_codigo: record.clienteCodigo || "PDV",
          cliente_nombre: record.clienteNombre,
          vendedor_nombre: record.vendedorNombre || "Vendedor",
          vendedor_id: record.vendedorId || "1",
          vendedor_email: record.vendedorEmail || null,
          ruta: record.ruta || "",
          fecha: record.fecha,
          turno: record.turno || "MA\xD1ANA",
          hora: record.hora || "",
          productos: Array.isArray(record.productos) ? record.productos : [],
          kilos_estimados: Number(record.kilosEstimados) || 0,
          personas_estimadas: Number(record.personasEstimadas) || 0,
          requiere_promotora: Boolean(record.requierePromotora),
          promotora_asignada: record.promotoraAsignada || "",
          material_pop: Boolean(record.materialPop),
          contacto_punto: record.contactoPunto || "",
          telefono_contacto: record.telefonoContacto || "",
          observaciones: record.observaciones || "",
          estado: record.estado || "SOLICITADA",
          notas_trade_marketing: record.notasTradeMarketing || "",
          resultado: record.resultado || null,
          created_at: record.createdAt
        })).catch((err) => console.warn("[SUPABASE] Error guardando degustaci\xF3n:", err?.message));
      }
      syncToGoogleScript(record).catch(() => {
      });
      syncToGerenciaDirect(record).catch(() => {
      });
      res.json({ success: true, data: record });
    } catch (err) {
      console.error("Error creating degustacion via API:", err);
      res.status(500).json({ error: "Error al guardar degustacion", details: err?.message });
    }
  });
  app2.put("/api/degustaciones/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      await (0, import_firestore3.setDoc)((0, import_firestore3.doc)(db, "degustaciones", id), updates, { merge: true });
      const snap = await (0, import_firestore3.getDoc)((0, import_firestore3.doc)(db, "degustaciones", id));
      if (snap.exists()) {
        const full = { id, ...snap.data() };
        if (supabase) {
          const supaUpdate = {};
          if (updates.clienteNombre !== void 0) supaUpdate.cliente_nombre = updates.clienteNombre;
          if (updates.vendedorNombre !== void 0) supaUpdate.vendedor_nombre = updates.vendedorNombre;
          if (updates.estado !== void 0) supaUpdate.estado = updates.estado;
          if (updates.notasTradeMarketing !== void 0) supaUpdate.notas_trade_marketing = updates.notasTradeMarketing;
          if (updates.promotoraAsignada !== void 0) supaUpdate.promotora_asignada = updates.promotoraAsignada;
          if (updates.resultado !== void 0) supaUpdate.resultado = updates.resultado;
          if (updates.kilosEstimados !== void 0) supaUpdate.kilos_estimados = Number(updates.kilosEstimados) || 0;
          if (updates.personasEstimadas !== void 0) supaUpdate.personas_estimadas = Number(updates.personasEstimadas) || 0;
          supaUpdate.updated_at = (/* @__PURE__ */ new Date()).toISOString();
          Promise.resolve(supabase.from("degustaciones").update(supaUpdate).eq("id", id)).catch((err) => console.warn("[SUPABASE] Error actualizando:", err?.message));
        }
        syncToGoogleScript(full).catch(() => {
        });
        syncToGerenciaDirect(full).catch(() => {
        });
      }
      res.json({ success: true, id, updated: updates });
    } catch (err) {
      console.error("Error updating degustacion via API:", err);
      res.status(500).json({ error: "Error al actualizar degustacion", details: err?.message });
    }
  });
  app2.delete("/api/degustaciones/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await (0, import_firestore3.deleteDoc)((0, import_firestore3.doc)(db, "degustaciones", id));
      if (supabase) {
        Promise.resolve(supabase.from("degustaciones").delete().eq("id", id)).catch((err) => console.warn("[SUPABASE] Error eliminando:", err?.message));
      }
      deleteFromGerenciaDirect(id).catch(() => {
      });
      res.json({ success: true, id });
    } catch (err) {
      console.error("Error deleting degustacion via API:", err);
      res.status(500).json({ error: "Error al eliminar degustacion", details: err?.message });
    }
  });
  app2.get("/api/alkosto/pedidos", authenticateToken, async (req, res) => {
    try {
      if (supabase) {
        try {
          const { data: supaList, error: supaErr } = await supabase.from("pedidos_alkosto").select("*").order("created_at", { ascending: false });
          if (!supaErr && Array.isArray(supaList) && supaList.length > 0) {
            const mapped = supaList.map((p) => ({
              id: p.id,
              numeroPedido: p.numero_pedido || "",
              correlativo: p.correlativo || p.numero_pedido || "",
              ordenCompraAlkosto: p.orden_compra_alkosto || "",
              sucursalCodigo: p.sucursal_codigo || "",
              sucursalNombre: p.sucursal_nombre || "",
              vendedora: p.vendedora || "SAIRU VALLES",
              ruta: p.ruta || "CUENTAS CLAVE 2",
              fechaPedido: p.fecha_pedido,
              fechaEntregaEstimada: p.fecha_entrega,
              totalBultos: Number(p.total_bultos) || 0,
              totalKilos: Number(p.total_kilos) || 0,
              totalUSD: Number(p.total_usd) || 0,
              condicionPago: p.condicion_pago || "",
              items: p.items || [],
              observaciones: p.observaciones || "",
              status: p.status || "PENDIENTE",
              createdAt: p.created_at
            }));
            return res.json({ success: true, count: mapped.length, data: mapped, source: "supabase" });
          }
        } catch (e) {
        }
      }
      const snapshot = await (0, import_firestore3.getDocs)((0, import_firestore3.collection)(db, "alkosto_orders"));
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      res.json({ success: true, count: list.length, data: list, source: "firestore" });
    } catch (err) {
      console.error("Error fetching Alkosto orders:", err);
      res.status(500).json({ error: "Error fetching Alkosto orders", details: err?.message });
    }
  });
  let lastAllocatedCorrelativo = 0;
  async function allocateNextCorrelativo(requestedCorrelativo) {
    if (lastAllocatedCorrelativo === 0) {
      let maxFound = 0;
      if (supabase) {
        try {
          const { data } = await supabase.from("pedidos_alkosto").select("correlativo, numero_pedido").order("created_at", { ascending: false }).limit(200);
          if (Array.isArray(data)) {
            for (const row of data) {
              const cVal = parseInt(String(row.correlativo || row.numero_pedido || ""), 10);
              if (!isNaN(cVal) && cVal > maxFound && cVal < 9e3) {
                maxFound = cVal;
              }
            }
          }
        } catch {
        }
      }
      if (maxFound === 0) {
        try {
          const snap = await (0, import_firestore3.getDocs)((0, import_firestore3.collection)(db, "alkosto_orders"));
          snap.forEach((d) => {
            const data = d.data();
            const cVal = parseInt(String(data.correlativo || data.numeroPedido || ""), 10);
            if (!isNaN(cVal) && cVal > maxFound && cVal < 9e3) {
              maxFound = cVal;
            }
          });
        } catch {
        }
      }
      lastAllocatedCorrelativo = maxFound;
    }
    const reqClean = String(requestedCorrelativo || "").trim();
    if (reqClean && /^\d{1,5}$/.test(reqClean)) {
      const reqNum = parseInt(reqClean, 10);
      if (reqNum > lastAllocatedCorrelativo) {
        lastAllocatedCorrelativo = reqNum;
        return String(reqNum).padStart(4, "0");
      }
    }
    lastAllocatedCorrelativo += 1;
    return String(lastAllocatedCorrelativo).padStart(4, "0");
  }
  const inFlightAlkostoSubmissions = /* @__PURE__ */ new Map();
  const recentAlkostoSubmissions = /* @__PURE__ */ new Map();
  const IDEMPOTENCY_TTL_MS = 6e4;
  class AlkostoHttpError extends Error {
    constructor(statusCode, message) {
      super(message);
      this.name = "AlkostoHttpError";
      this.statusCode = statusCode;
    }
  }
  function extraerArticulosHomologadosSalaEspera(item) {
    const sourceRenglones = Array.isArray(item?.renglones) && item.renglones.length > 0 ? item.renglones : Array.isArray(item?.items) && item.items.length > 0 ? item.items : Array.isArray(item?.articulos) && item.articulos.length > 0 ? item.articulos : [];
    return sourceRenglones.map((it) => {
      if (!it || typeof it !== "object") return null;
      const rawCod = String(it.sku ?? it.codigo ?? "").trim();
      const rawDesc = String(it.producto ?? it.descripcion ?? "").trim();
      if (!rawCod && !rawDesc) return null;
      const desc = limpiarDescripcionAlkosto((rawDesc || "PRODUCTO").toUpperCase());
      const resolvedProd = resolverProductoBackend(rawCod, desc);
      const cleanCod = (resolvedProd ? resolvedProd.sku : "") || rawCod || "S/C";
      const cant = parseNumeroEstricto(
        it.cantidad ?? it.cantidad_solicitada ?? it.cantidadCajas ?? it.cantSolicitada ?? it.bultos ?? it.cajas ?? it.unidades ?? it.kilos,
        0
      );
      if (!Number.isFinite(cant) || Number.isNaN(cant) || cant <= 0) {
        return null;
      }
      const precioBruto = parseNumeroEstricto(
        it.precio_bruto ?? it.precioBrutoUSD ?? it.costoBruto,
        0
      );
      const descuentoRaw = Math.max(0, parseNumeroEstricto(it.descuento, 0));
      let precio = parseNumeroEstricto(
        it.precio_unitario ?? it.precioUnitarioUSD ?? it.precio,
        0
      );
      if (precio <= 0 && precioBruto > 0 && descuentoRaw > 0 && descuentoRaw <= 100) {
        precio = Number((precioBruto * (1 - descuentoRaw / 100)).toFixed(4));
      }
      const descuentoEfectivo = descuentoRaw > 0 ? Number(descuentoRaw.toFixed(2)) : precioBruto > precio && precio > 0 ? Number(((precioBruto - precio) / precioBruto * 100).toFixed(2)) : 0;
      const sub = precio > 0 ? Number((cant * precio).toFixed(2)) : Number(
        Math.max(
          0,
          parseNumeroEstricto(it.subtotal ?? it.subtotalUSD ?? it.sub_total, 0)
        ).toFixed(2)
      );
      const rawUnit = String(
        it.unidad_medida || it.presentacion || it.unid || it.unidad || resolvedProd?.unid || "CJ"
      ).trim().toUpperCase();
      const isBoxUnit = ["CJ", "CJA", "CAJA", "CAJAS", "BLT", "BTO", "BULTO", "BULTOS"].includes(rawUnit) || rawUnit.startsWith("CAJA");
      const isPieceUnit = ["UND", "UNID", "UNIDAD", "UNIDADES"].includes(rawUnit);
      const normUnit = isBoxUnit ? "BULTO" : isPieceUnit ? "UNIDAD" : "KG";
      const unidadOriginal = rawUnit === "BLT" ? "BLT" : isBoxUnit ? "CJ" : isPieceUnit ? "UND" : "KG";
      const cajasVal = Number.isFinite(Number(it.cajas)) && Number(it.cajas) > 0 ? Number(Number(it.cajas).toFixed(2)) : isBoxUnit ? Number(cant.toFixed(2)) : 0;
      const unidadesVal = Number.isFinite(Number(it.unidades)) && Number(it.unidades) > 0 ? Number(Number(it.unidades).toFixed(2)) : isPieceUnit ? Number(cant.toFixed(2)) : 0;
      const kilosVal = Number.isFinite(Number(it.totalKilos ?? it.kilos)) && Number(it.totalKilos ?? it.kilos) > 0 ? Number(Number(it.totalKilos ?? it.kilos).toFixed(2)) : normUnit === "KG" ? Number(cant.toFixed(2)) : Number((cant * 10).toFixed(2));
      return {
        codigo: cleanCod,
        sku: cleanCod,
        descripcion: (resolvedProd ? resolvedProd.nombre : "") || desc,
        cantidad_solicitada: Number(cant.toFixed(2)),
        cantidad: Number(cant.toFixed(2)),
        cantidad_despachada: 0,
        unidad_medida: normUnit,
        unidad_original: unidadOriginal,
        cajas: cajasVal,
        unidades: unidadesVal,
        kilos: kilosVal,
        precio_unitario: Number(precio.toFixed(4)),
        precio: Number(precio.toFixed(4)),
        ...precioBruto > 0 ? { precio_bruto: Number(precioBruto.toFixed(4)) } : {},
        descuento: descuentoEfectivo,
        sub_total: Number(sub.toFixed(2)),
        subtotal: Number(sub.toFixed(2))
      };
    }).filter((a) => a !== null);
  }
  async function syncAlkostoOrderToExternal(item, gestorArticlesPrecomputed) {
    const correlativo = String(item.correlativo || item.numeroPedido || "").trim();
    const orderId = String(item.id || "").trim();
    if (!orderId) {
      throw new AlkostoHttpError(400, "ID de pedido ausente para sincronizar con Sala de Espera.");
    }
    const cadenaNorm = normalizarCadenaEstricta(
      item.cadena || item.sucursalTag || item.sucursalCodigo || item.id_cliente,
      item.sucursal_cliente || item.sucursalNombre || item.cliente
    );
    const sucursalClienteClean = String(
      item.sucursal_cliente || item.sucursalNombre || item.cliente || cadenaNorm
    ).trim().toUpperCase();
    const rawIdCli = String(item.id_cliente || item.sucursalCodigo || item.idCliente || "").trim();
    const idClientePadded = /^\d+$/.test(rawIdCli) ? rawIdCli.padStart(6, "0") : rawIdCli;
    const sucursalTagClean = String(item.sucursalTag || item.sucursal_tag || "").trim().toUpperCase();
    const numeroOcClean = String(
      item.numero_oc || item.ordenCompraAlkosto || item.orden_compra_alkosto || item.orden_compra || "S/N"
    ).trim();
    const direccionDespachoClean = String(
      item.direccion_despacho || item.direccionEntrega || item.observaciones || "Entrega seg\xFAn Orden de Compra"
    ).trim();
    const observacionFormateada = item.observacion_formateada && String(item.observacion_formateada).includes(" | OC ") ? String(item.observacion_formateada).trim() : construirObservacionFormateada({
      sucursal_cliente: sucursalClienteClean,
      cadena: cadenaNorm,
      numero_oc: numeroOcClean,
      direccion_despacho: direccionDespachoClean
    });
    const gestorArticles = Array.isArray(gestorArticlesPrecomputed) ? gestorArticlesPrecomputed : extraerArticulosHomologadosSalaEspera(item);
    if (gestorArticles.length === 0) {
      throw new AlkostoHttpError(
        400,
        `Validaci\xF3n previa: El pedido de ${sucursalClienteClean} no contiene productos v\xE1lidos con cantidad mayor a cero.`
      );
    }
    const totalMonto = Number(
      gestorArticles.reduce((acc, a) => acc + Number(a.sub_total || 0), 0).toFixed(2)
    );
    const fechaValida = item.fechaPedido || item.fecha ? String(item.fechaPedido || item.fecha).includes("T") ? String(item.fechaPedido || item.fecha).split("T")[0] : String(item.fechaPedido || item.fecha) : (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const vendedorHomologado = normalizarNombreVendedorSairu(
      item.vendedor || item.vendedora || item.ruta
    );
    const supervisorClean = String(item.supervisor || vendedorHomologado).trim();
    const rawOrder = {
      id: orderId,
      idempotency_key: String(item.idempotencyKey || orderId),
      id_cliente: idClientePadded,
      cliente: sucursalClienteClean,
      sucursal_cliente: sucursalClienteClean,
      ...sucursalTagClean ? { sucursal_tag: sucursalTagClean } : {},
      cadena: cadenaNorm,
      numero_oc: numeroOcClean,
      direccion_despacho: direccionDespachoClean,
      observacion_formateada: observacionFormateada,
      vendedor: vendedorHomologado,
      vendedor_nombre: vendedorHomologado,
      canal_comercial: "CUENTAS CLAVE 2",
      numero_pedido: correlativo,
      ruta: vendedorHomologado,
      supervisor: supervisorClean,
      chofer: String(item.chofer || "TRANSPORTE CODIZULCA").trim(),
      observaciones: observacionFormateada,
      fecha: fechaValida,
      total_pedido: totalMonto,
      monto_pedido: totalMonto,
      total_renglones: gestorArticles.length,
      estado: "POR VALIDAR",
      estado_sala_espera: "POR_VALIDAR",
      origen: cadenaNorm,
      fuente_origen: "APP FDV",
      sucursal: "Maracaibo",
      articulos: gestorArticles,
      renglones: gestorArticles.map((a) => ({
        codigo: a.codigo,
        sku: a.sku,
        descripcion: a.descripcion,
        unidad_medida: a.unidad_medida,
        unidad_original: a.unidad_original,
        cantidad: a.cantidad_solicitada,
        cajas: a.cajas,
        unidades: a.unidades,
        kilos: a.kilos,
        precio_unitario: a.precio_unitario,
        ...a.precio_bruto ? { precio_bruto: a.precio_bruto } : {},
        descuento: a.descuento,
        subtotal: a.sub_total
      }))
    };
    const supabaseOrderRow = {
      id: orderId,
      numero_pedido: correlativo || "APP-FDV",
      cliente: rawOrder.cliente,
      id_cliente: rawOrder.id_cliente || null,
      ruta: vendedorHomologado,
      supervisor: rawOrder.supervisor,
      chofer: rawOrder.chofer || null,
      observaciones: observacionFormateada,
      fecha: fechaValida,
      total_pedido: totalMonto,
      monto_pedido: totalMonto,
      status: "POR_VALIDAR",
      // Estado exacto que filtra la Sala de Espera de Pedidos Manuales
      sucursal: "Maracaibo",
      version: 1,
      is_modified: false,
      reject_reason: null,
      cxc_note: null,
      fact_note: null,
      articulos: gestorArticles,
      status_history: [
        {
          status: "POR_VALIDAR",
          department: "Ventas",
          changedBy: vendedorHomologado,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          reason: `Recibido en Sala de Espera desde APP FDV (${vendedorHomologado} | ${cadenaNorm} | OC: ${numeroOcClean})`
        }
      ],
      raw_order: rawOrder,
      created_at: item.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      is_archived: false
    };
    const ordersUrl = `${PEDIDOS_MANUALES_SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/orders`;
    const maxAttempts = 3;
    let confirmedId = "";
    let attemptsUsed = 0;
    let lastExternalErr = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attemptsUsed = attempt;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12e3);
      try {
        const supaRes = await fetch(ordersUrl, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "apikey": PEDIDOS_MANUALES_SUPABASE_KEY,
            "Authorization": `Bearer ${PEDIDOS_MANUALES_SUPABASE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=representation"
          },
          body: JSON.stringify(supabaseOrderRow)
        });
        const bodyText = await supaRes.text();
        if (!supaRes.ok) {
          const isClientSchemaError = supaRes.status >= 400 && supaRes.status < 500 && supaRes.status !== 408 && supaRes.status !== 429;
          const err = new AlkostoHttpError(
            isClientSchemaError ? 502 : 503,
            `Supabase Sala de Espera respondi\xF3 HTTP ${supaRes.status}: ${bodyText.slice(0, 300)}`
          );
          err.retryable = !isClientSchemaError;
          throw err;
        }
        let parsedRep = null;
        try {
          parsedRep = bodyText ? JSON.parse(bodyText) : null;
        } catch {
        }
        const insertedRow = Array.isArray(parsedRep) ? parsedRep[0] : parsedRep;
        confirmedId = String(insertedRow?.id || "").trim();
        if (!confirmedId) {
          throw new AlkostoHttpError(
            502,
            "Supabase Sala de Espera no devolvi\xF3 el ID de confirmaci\xF3n en la representaci\xF3n insertada."
          );
        }
        console.log(
          `[ENVIO_FDV -> SALA_ESPERA] Confirmado Pedido N\xB0 ${correlativo} (ID BD: ${confirmedId} | Vendedor: ${vendedorHomologado} | ${sucursalClienteClean} | OC: ${numeroOcClean} | Renglones: ${gestorArticles.length} | Monto: $${totalMonto.toFixed(2)} | Intento: ${attempt}/${maxAttempts})`
        );
        break;
      } catch (err) {
        lastExternalErr = err instanceof Error ? err : new Error(String(err));
        const canRetry = attempt < maxAttempts && err?.retryable !== false;
        console.warn(
          `[ENVIO_FDV -> SALA_ESPERA] Intento ${attempt}/${maxAttempts} fallido para ${sucursalClienteClean}: ${lastExternalErr.message}`
        );
        if (!canRetry) {
          break;
        }
        await new Promise((r) => setTimeout(r, 400 * attempt));
      } finally {
        clearTimeout(timeoutId);
      }
    }
    if (!confirmedId) {
      throw new AlkostoHttpError(
        502,
        `No se pudo confirmar la inserci\xF3n del pedido en la Sala de Espera de Pedidos Manuales tras ${attemptsUsed} intento(s): ${lastExternalErr?.message || "Error desconocido"}`
      );
    }
    try {
      const ordersFilePath = import_path.default.resolve(process.cwd(), "../gestor-de-pedidos-pro/orders.json");
      if (import_fs.default.existsSync(ordersFilePath)) {
        const rawContent = import_fs.default.readFileSync(ordersFilePath, "utf8");
        let fileOrders = [];
        try {
          fileOrders = JSON.parse(rawContent);
          if (!Array.isArray(fileOrders)) fileOrders = [];
        } catch {
        }
        const dbOrderObj = {
          id: confirmedId,
          status: "POR_VALIDAR",
          isArchived: false,
          createdAt: supabaseOrderRow.created_at,
          updatedAt: supabaseOrderRow.updated_at,
          sucursal: "Maracaibo",
          version: 1,
          order: rawOrder,
          statusHistory: supabaseOrderRow.status_history
        };
        const existingIdx = fileOrders.findIndex(
          (o) => o.id === confirmedId || o.order?.numero_pedido && correlativo && String(o.order.numero_pedido).trim() === correlativo
        );
        if (existingIdx >= 0) {
          fileOrders[existingIdx] = dbOrderObj;
        } else {
          fileOrders.unshift(dbOrderObj);
        }
        import_fs.default.writeFileSync(ordersFilePath, JSON.stringify(fileOrders, null, 2), "utf8");
      }
    } catch (fErr) {
      console.warn(`[ALKOSTO -> PEDIDOS MANUALES] No se pudo escribir localmente en orders.json:`, fErr);
    }
    if (GOOGLE_SCRIPT_WEBHOOK_URL) {
      fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_PEDIDO_ALKOSTO",
          tipo: "PEDIDO_ALKOSTO",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          id: confirmedId,
          numeroPedido: correlativo,
          correlativo,
          ordenCompraAlkosto: numeroOcClean,
          sucursalCodigo: item.sucursalCodigo,
          sucursalNombre: sucursalClienteClean,
          vendedora: vendedorHomologado,
          ruta: vendedorHomologado,
          fechaPedido: fechaValida,
          fechaEntrega: item.fechaEntregaEstimada,
          totalBultos: item.totalBultos,
          totalKilos: item.totalKilos,
          totalUSD: totalMonto,
          condicionPago: item.condicionPago || "Cr\xE9dito 21 d\xEDas",
          items: item.items,
          observaciones: observacionFormateada
        })
      }).catch((err) => console.warn("Google script webhook alkosto error:", err));
    }
    return {
      confirmedId,
      status: "POR_VALIDAR",
      totalRenglones: gestorArticles.length,
      montoPedido: totalMonto,
      attempts: attemptsUsed
    };
  }
  async function processAndPersistSingleAlkostoOrder(item, headerIdempotencyKey) {
    if (!item || typeof item !== "object") {
      throw new AlkostoHttpError(400, "Datos de pedido requeridos o inv\xE1lidos.");
    }
    const gestorArticles = extraerArticulosHomologadosSalaEspera(item);
    if (gestorArticles.length === 0) {
      throw new AlkostoHttpError(
        400,
        "Validaci\xF3n previa: El pedido debe contener al menos un producto v\xE1lido con cantidad mayor a cero."
      );
    }
    const cadenaNorm = normalizarCadenaEstricta(
      item.cadena || item.sucursalTag || item.sucursalCodigo || item.id_cliente,
      item.sucursal_cliente || item.sucursalNombre || item.cliente
    );
    const sucursalNombreClean = String(
      item.sucursal_cliente || item.sucursalNombre || item.cliente || cadenaNorm
    ).trim().toUpperCase();
    const numeroOcClean = String(
      item.numero_oc || item.ordenCompraAlkosto || item.orden_compra_alkosto || "S/N"
    ).trim();
    const direccionClean = String(
      item.direccion_despacho || item.direccionEntrega || item.observaciones || "Entrega seg\xFAn Orden de Compra"
    ).trim();
    const fechaISO = item.fechaPedido || item.fecha ? String(item.fechaPedido || item.fecha).split("T")[0] : (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const rawIdInput = String(item.id || "").trim();
    const rawClientCode = String(item.id_cliente || item.sucursalCodigo || "").trim();
    const tagSlug = String(item.sucursalTag || item.sucursal_tag || "doc").trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "doc";
    const deterministicId = rawIdInput && !/^alk-ord-/i.test(rawIdInput) ? rawIdInput : String(headerIdempotencyKey || item.idempotencyKey || "").trim() || generarIdDeterministaPedidoAlkosto({
      tagSlug,
      idCliente: rawClientCode,
      numeroOc: numeroOcClean,
      fechaISO,
      renglones: gestorArticles.map((a) => ({
        codigo: a.codigo,
        unidad_medida: a.unidad_original || a.unidad_medida,
        cantidad: a.cantidad_solicitada,
        precio_unitario: a.precio_unitario,
        descuento: a.descuento,
        subtotal: a.sub_total
      }))
    });
    const idempotencyKey = String(
      headerIdempotencyKey || item.idempotencyKey || deterministicId
    ).trim();
    const existingInFlight = inFlightAlkostoSubmissions.get(idempotencyKey);
    if (existingInFlight) {
      return existingInFlight;
    }
    const cachedRecent = recentAlkostoSubmissions.get(idempotencyKey);
    if (cachedRecent && !item.forceRetransmit && Date.now() - cachedRecent.timestamp < IDEMPOTENCY_TTL_MS) {
      return cachedRecent.record;
    }
    const runPromise = (async () => {
      const correlativo = await allocateNextCorrelativo(
        item.correlativo && item.correlativo !== "AUTO" && item.numeroPedido !== "PENDIENTE" ? item.correlativo : void 0
      );
      const observacionFormateada = item.observacion_formateada && String(item.observacion_formateada).includes(" | OC ") ? String(item.observacion_formateada).trim() : construirObservacionFormateada({
        sucursal_cliente: sucursalNombreClean,
        cadena: cadenaNorm,
        numero_oc: numeroOcClean,
        direccion_despacho: direccionClean
      });
      const vendedorHomologado = normalizarNombreVendedorSairu(
        item.vendedor || item.vendedora || item.ruta
      );
      const totalMonto = Number(
        gestorArticles.reduce((acc, a) => acc + Number(a.sub_total || 0), 0).toFixed(2)
      );
      const totalBultos = Number(
        gestorArticles.reduce((acc, a) => acc + Number(a.cantidad_solicitada || 0), 0).toFixed(2)
      );
      const draftRecord = {
        ...item,
        id: deterministicId,
        idempotencyKey,
        correlativo,
        numeroPedido: correlativo,
        ordenCompraAlkosto: numeroOcClean !== "S/N" ? numeroOcClean : item.ordenCompraAlkosto || "",
        sucursalNombre: sucursalNombreClean,
        direccionEntrega: direccionClean,
        vendedora: vendedorHomologado,
        vendedor: vendedorHomologado,
        ruta: vendedorHomologado,
        observaciones: observacionFormateada,
        observacion_formateada: observacionFormateada,
        cadena: cadenaNorm,
        sucursal_cliente: sucursalNombreClean,
        numero_oc: numeroOcClean,
        direccion_despacho: direccionClean,
        totalBultos: Number(item.totalBultos) > 0 ? Number(item.totalBultos) : totalBultos,
        totalUSD: totalMonto,
        monto_pedido: totalMonto,
        total_renglones: gestorArticles.length,
        origen: "APP FDV",
        createdAt: item.createdAt || (/* @__PURE__ */ new Date()).toISOString()
      };
      const externalConfirmation = await syncAlkostoOrderToExternal(draftRecord, gestorArticles);
      const confirmedId = externalConfirmation.confirmedId;
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const confirmedRecord = {
        ...draftRecord,
        id: confirmedId,
        salaEsperaId: confirmedId,
        estadoSalaEspera: externalConfirmation.status,
        estado: "ENVIADO",
        status: "ENVIADO",
        transmitido_a_pedidos_manuales: true,
        fecha_transmision: nowIso
      };
      await (0, import_firestore3.setDoc)((0, import_firestore3.doc)(db, "alkosto_orders", confirmedId), confirmedRecord, { merge: true }).catch(
        (err) => console.warn("[FIRESTORE] Aviso guardando pedido Alkosto:", err?.message)
      );
      if (supabase) {
        const { error: supaErr } = await supabase.from("pedidos_alkosto").upsert({
          id: confirmedRecord.id,
          numero_pedido: confirmedRecord.numeroPedido || "",
          correlativo: confirmedRecord.correlativo || confirmedRecord.numeroPedido || "",
          orden_compra_alkosto: confirmedRecord.ordenCompraAlkosto || "",
          sucursal_codigo: confirmedRecord.sucursalCodigo || "",
          sucursal_nombre: confirmedRecord.sucursalNombre || "",
          vendedora: vendedorHomologado,
          ruta: vendedorHomologado,
          fecha_pedido: confirmedRecord.fechaPedido ? new Date(confirmedRecord.fechaPedido).toISOString().split("T")[0] : null,
          total_bultos: Number(confirmedRecord.totalBultos) || 0,
          total_kilos: Number(confirmedRecord.totalKilos) || 0,
          total_usd: totalMonto,
          condicion_pago: confirmedRecord.condicionPago || "",
          items: confirmedRecord.items || [],
          observaciones: observacionFormateada,
          status: "ENVIADO",
          created_at: confirmedRecord.createdAt,
          updated_at: nowIso
        });
        if (supaErr) {
          console.warn("[SUPABASE LOCAL] Error en upsert de pedidos_alkosto:", supaErr.message);
        }
      }
      recentAlkostoSubmissions.set(idempotencyKey, {
        timestamp: Date.now(),
        record: confirmedRecord
      });
      return confirmedRecord;
    })();
    inFlightAlkostoSubmissions.set(idempotencyKey, runPromise);
    try {
      return await runPromise;
    } finally {
      inFlightAlkostoSubmissions.delete(idempotencyKey);
    }
  }
  app2.post("/api/alkosto/pedidos", authenticateToken, async (req, res) => {
    try {
      const item = req.body;
      if (!item || !item.sucursalNombre && !item.sucursal_cliente && !item.sucursalCodigo) {
        return res.status(400).json({ success: false, error: "Falta sucursalNombre / sucursal_cliente" });
      }
      const idempHeader = req.headers["x-idempotency-key"] ? String(req.headers["x-idempotency-key"]) : void 0;
      const record = await processAndPersistSingleAlkostoOrder(item, idempHeader);
      res.json({
        success: true,
        id: record.salaEsperaId || record.id,
        salaEsperaId: record.salaEsperaId || record.id,
        data: record
      });
    } catch (err) {
      const statusCode = err instanceof AlkostoHttpError ? err.statusCode : 500;
      console.error("Error saving Alkosto order:", err?.message || err);
      res.status(statusCode).json({
        success: false,
        error: err?.message || "Error saving Alkosto order",
        details: err?.message
      });
    }
  });
  app2.post("/api/alkosto/pedidos/lote", authenticateToken, async (req, res) => {
    try {
      const pedidosInput = Array.isArray(req.body?.pedidos) ? req.body.pedidos : Array.isArray(req.body) ? req.body : [];
      if (pedidosInput.length === 0) {
        return res.status(400).json({ success: false, error: "El lote de pedidos est\xE1 vac\xEDo" });
      }
      const insertados = [];
      const fallidos = [];
      for (let i = 0; i < pedidosInput.length; i++) {
        const p = pedidosInput[i];
        try {
          const saved = await processAndPersistSingleAlkostoOrder(p);
          insertados.push(saved);
          console.log(`[ENVIO_FDV LOTE] Pedido ${i + 1}/${pedidosInput.length} confirmado en Sala de Espera con ID ${saved.id} (Correlativo: ${saved.correlativo})`);
        } catch (err) {
          fallidos.push({
            index: i,
            sucursal: p?.sucursal_cliente || p?.sucursalNombre,
            error: err?.message || "Error procesando pedido del lote"
          });
        }
      }
      res.status(fallidos.length === 0 ? 200 : 207).json({
        success: fallidos.length === 0,
        totalRecibidos: pedidosInput.length,
        totalInsertados: insertados.length,
        data: insertados,
        fallidos
      });
    } catch (err) {
      console.error("Error procesando lote Alkosto:", err);
      res.status(500).json({ success: false, error: "Error procesando lote de pedidos", details: err?.message });
    }
  });
  app2.post("/api/alkosto/pedidos/transmitir", authenticateToken, async (req, res) => {
    try {
      const item = req.body;
      if (!item || !item.id && !item.numeroPedido && !item.sucursalNombre && !item.sucursal_cliente) {
        return res.status(400).json({ success: false, error: "Datos de pedido requeridos o inv\xE1lidos para transmisi\xF3n" });
      }
      const idempHeader = req.headers["x-idempotency-key"] ? String(req.headers["x-idempotency-key"]) : void 0;
      const record = await processAndPersistSingleAlkostoOrder(item, idempHeader);
      const confirmedId = record.salaEsperaId || record.id;
      res.json({
        success: true,
        id: confirmedId,
        salaEsperaId: confirmedId,
        data: record,
        message: `Pedido N\xB0 ${record.correlativo || record.numeroPedido} transmitido y confirmado en la Sala de Espera (ID: ${confirmedId})`
      });
    } catch (err) {
      const statusCode = err instanceof AlkostoHttpError ? err.statusCode : 500;
      console.error("Error transmitiendo pedido:", err?.message || err);
      res.status(statusCode).json({
        success: false,
        error: err?.message || "Error transmitiendo pedido",
        details: err?.message
      });
    }
  });
  app2.put("/api/alkosto/pedidos/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      await (0, import_firestore3.setDoc)((0, import_firestore3.doc)(db, "alkosto_orders", id), updates, { merge: true });
      if (supabase) {
        const supaUpdate = {};
        if (updates.status !== void 0) supaUpdate.status = updates.status;
        if (updates.observaciones !== void 0) supaUpdate.observaciones = updates.observaciones;
        if (updates.items !== void 0) supaUpdate.items = updates.items;
        if (updates.totalBultos !== void 0) supaUpdate.total_bultos = Number(updates.totalBultos) || 0;
        if (updates.totalKilos !== void 0) supaUpdate.total_kilos = Number(updates.totalKilos) || 0;
        if (updates.totalUSD !== void 0) supaUpdate.total_usd = Number(updates.totalUSD) || 0;
        supaUpdate.updated_at = (/* @__PURE__ */ new Date()).toISOString();
        Promise.resolve(supabase.from("pedidos_alkosto").update(supaUpdate).eq("id", id)).catch((err) => console.warn("[SUPABASE] Error actualizando pedido Alkosto:", err?.message));
      }
      res.json({ success: true, id, updated: updates });
    } catch (err) {
      console.error("Error updating Alkosto order:", err);
      res.status(500).json({ error: "Error updating Alkosto order", details: err?.message });
    }
  });
  app2.delete("/api/alkosto/pedidos/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      await (0, import_firestore3.deleteDoc)((0, import_firestore3.doc)(db, "alkosto_orders", id)).catch(() => {
      });
      if (supabase) {
        Promise.resolve(supabase.from("pedidos_alkosto").delete().eq("id", id)).catch((err) => console.warn("[SUPABASE] Error eliminando pedido Alkosto:", err?.message));
      }
      if (/^test-(int|qa)-/i.test(String(id))) {
        const cleanUrl = `${PEDIDOS_MANUALES_SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/orders?id=eq.${encodeURIComponent(String(id))}`;
        await fetch(cleanUrl, {
          method: "DELETE",
          headers: {
            "apikey": PEDIDOS_MANUALES_SUPABASE_KEY,
            "Authorization": `Bearer ${PEDIDOS_MANUALES_SUPABASE_KEY}`
          }
        }).catch(() => {
        });
      }
      res.json({ success: true, id });
    } catch (err) {
      console.error("Error deleting Alkosto order:", err);
      res.status(500).json({ error: "Error deleting Alkosto order", details: err?.message });
    }
  });
  const MASTER_PRODUCTOS_DICT = [
    { sku: "1496", nombre: "MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR", barcode: "7590377000077", chainCodes: ["1496", "7590377000077"], unid: "CJ" },
    { sku: "1497", nombre: "MORTADELA ESP D/POLLO ASTURIAS 20UNDX500GR", barcode: "7590377000589", chainCodes: ["1497", "7590377000589"], unid: "CJ" },
    { sku: "1519", nombre: "MORTADELA ESP D/POLLO SALPICAO 10UNDX900GR", barcode: "", chainCodes: ["1462", "1519"], unid: "CJ" },
    { sku: "21", nombre: "MORTADELA DE POLLO DEL CORRAL 1KG", barcode: "7591289609129", chainCodes: ["21", "021", "1463", "7591289609129"], unid: "CJ" },
    { sku: "047", nombre: "NUGGETS DE POLLO DEL CORRAL 460GR", barcode: "7591289400023", chainCodes: ["047", "47", "7591289400023"], unid: "UND" },
    { sku: "1360", nombre: "PAPAS FRITAS CONGELADAS MARQUISE 2,5KG", barcode: "5412873178161", chainCodes: ["1360", "5412873178161", "PATATAS"], unid: "CJ" },
    { sku: "100281", nombre: "QUESO MOZZARELLA CORLASA X KG", barcode: "", chainCodes: ["100281"], unid: "KG" },
    { sku: "7591210000513", nombre: "CREMA DE LECHE PURISIMA 500GR", barcode: "7591210000513", chainCodes: ["7591210000513"], unid: "CJ" },
    { sku: "7591210000544", nombre: "CREMA DE LECHE PURISIMA 250GR", barcode: "7591210000544", chainCodes: ["7591210000544"], unid: "CJ" },
    { sku: "1464", nombre: "MORT. NAVIDE\xD1A ASTURIAS XKG", barcode: "", chainCodes: ["1464"], unid: "KG" },
    { sku: "1461", nombre: "MORT. ESTANDAR ASTURIAS X KG", barcode: "", chainCodes: ["1461"], unid: "KG" },
    { sku: "1462", nombre: "MORT. ESPECIAL COCIDA ASTURIAS X KG", barcode: "", chainCodes: ["1462"], unid: "KG" },
    { sku: "1463", nombre: "MORT. SUPERIOR ASTURIAS X KG", barcode: "", chainCodes: ["1463", "100929"], unid: "KG" },
    { sku: "1512", nombre: "MORT. PECHUGA DE PAVO ASTURIAS X KG", barcode: "", chainCodes: ["100881", "1512"], unid: "KG" },
    { sku: "1511", nombre: "MORT. PECHUGA DE POLLO ASTURIAS X KG", barcode: "", chainCodes: ["100882", "1511"], unid: "KG" },
    { sku: "1561", nombre: "MORT. PAVO TIPO SHOULDER ASTURIAS POR KG", barcode: "", chainCodes: ["1561"], unid: "KG" },
    { sku: "1521", nombre: "MORT. ECONOM COCIDA ASTURIAS X KG", barcode: "", chainCodes: ["1521"], unid: "KG" },
    { sku: "1522", nombre: "MORT. TIPO AREPERO ASTURIAS X KG", barcode: "", chainCodes: ["1522"], unid: "KG" },
    { sku: "1564", nombre: "MORTADELA EXTRA ASTURIAS X KG", barcode: "", chainCodes: ["1564"], unid: "KG" },
    { sku: "1563", nombre: "MORT. ESTANDAR SALPICAO X KG", barcode: "", chainCodes: ["1563"], unid: "KG" },
    { sku: "1562", nombre: "MORT. ESPECIAL COCIDA SALPICAO X KG", barcode: "", chainCodes: ["1562"], unid: "KG" },
    { sku: "1599", nombre: "MORT. NAVIDE\xD1A SALPICAO X KG", barcode: "", chainCodes: ["1599"], unid: "KG" },
    { sku: "927", nombre: "MORTADELA ESP. CARACAS 10X900GRS", barcode: "", chainCodes: ["927"], unid: "CJ" },
    { sku: "1051", nombre: "MORTADELA ESP. CARACAS 10X500GRS", barcode: "", chainCodes: ["1051"], unid: "CJ" },
    { sku: "1242", nombre: "MORT. CHORIZO ESPECIAL CDZ X KG", barcode: "", chainCodes: ["1242"], unid: "KG" },
    { sku: "1446", nombre: "CHULETA FRESCA ASTURIAS POR KG", barcode: "", chainCodes: ["1446"], unid: "KG" },
    { sku: "1088", nombre: "CHULETA FRESCA IBERICO POR KG", barcode: "", chainCodes: ["1088"], unid: "KG" },
    { sku: "1445", nombre: "TOCINO FRESCO ASTURIAS X KG", barcode: "", chainCodes: ["1445"], unid: "KG" },
    { sku: "340", nombre: "CHULETA AHUMADA ALIMEX X KG", barcode: "", chainCodes: ["340"], unid: "KG" },
    { sku: "171", nombre: "JAMON COC. SUPERIOR ALIMEX 1X5.9KG", barcode: "", chainCodes: ["171", "100929"], unid: "CJ" },
    { sku: "172", nombre: "ESPALDA COCIDA ALIMEX 1X4.6KG", barcode: "", chainCodes: ["172"], unid: "CJ" },
    { sku: "241", nombre: "ESPAL. AHUM T/VISKING ALIMEX 6X3.2", barcode: "", chainCodes: ["241"], unid: "CJ" },
    { sku: "439", nombre: "ESPAL AHUM.T/AREPERO ALIMEX 12X1,6KG", barcode: "", chainCodes: ["439"], unid: "CJ" },
    { sku: "995", nombre: "ESPAL. AHUM T/VISKING ITALICO 6UNDX3.2KG", barcode: "", chainCodes: ["995"], unid: "CJ" },
    { sku: "337", nombre: "JAMON COCIDO ESTANDAR ITALICO X KG", barcode: "", chainCodes: ["337"], unid: "KG" },
    { sku: "170", nombre: "TOCINETA AHUM S/CUERO ALIMEX X KG", barcode: "", chainCodes: ["170"], unid: "KG" },
    { sku: "177", nombre: "SALCHICHA VIENA ALIMEX 16 X 450 GRS", barcode: "", chainCodes: ["177"], unid: "CJ" },
    { sku: "176", nombre: "SALCHICHA VIENA ALIMEX 8 X 800 GRS", barcode: "", chainCodes: ["176"], unid: "CJ" },
    { sku: "101", nombre: "POLLO BENEFICIADO ENTERO", barcode: "", chainCodes: ["101", "POLLO"], unid: "KG" },
    { sku: "103", nombre: "FILET VARIAS PRESENTACIONES", barcode: "", chainCodes: ["103", "FILET"], unid: "KG" },
    { sku: "629", nombre: "MUSLO CUADRIL DESPRESADO POR KG", barcode: "", chainCodes: ["629", "102", "MUSLO"], unid: "KG" },
    { sku: "630", nombre: "ALAS DESPRESADAS POR KG", barcode: "", chainCodes: ["630", "ALAS"], unid: "KG" },
    { sku: "870", nombre: "HIGADO (EMPACADO)", barcode: "", chainCodes: ["870"], unid: "KG" },
    { sku: "393", nombre: "MOLLEJA (EMPACADA)", barcode: "", chainCodes: ["393"], unid: "KG" },
    { sku: "QS", nombre: "QUESO AMARILLO", barcode: "", chainCodes: ["QS", "QUESO"], unid: "KG" },
    { sku: "301", nombre: "ACEITE VEGETAL COMESTIBLE 12X1LT", barcode: "", chainCodes: ["301", "ACEITE"], unid: "CJ" },
    { sku: "302", nombre: "AZUCAR REFINADA BLANCA 50KG", barcode: "", chainCodes: ["302", "AZUCAR"], unid: "CJ" },
    { sku: "303", nombre: "ARROZ BLANCO ESPECIAL 24X1KG", barcode: "", chainCodes: ["303", "ARROZ"], unid: "CJ" },
    { sku: "401", nombre: "HUEVOS BLANCOS SELECCIONADOS", barcode: "", chainCodes: ["401", "HUEVOS"], unid: "CJ" },
    { sku: "1569", nombre: "PATATAS FRESCAS DOBLE COBERTURA 4X2.5KG", barcode: "", chainCodes: ["1569"], unid: "CJ" },
    { sku: "UTH", nombre: "LECHE LIQUIDA UHT 12X1LT", barcode: "", chainCodes: ["UTH"], unid: "CJ" },
    { sku: "LPV", nombre: "LECHE EN POLVO VENCAMPO", barcode: "", chainCodes: ["LPV"], unid: "CJ" },
    { sku: "JUGOS", nombre: "JUGOS Y NECTAR VARIOS", barcode: "", chainCodes: ["JUGOS", "BEBIDAS"], unid: "CJ" },
    { sku: "1572", nombre: "CAJAS DE PIZZA 1X100", barcode: "", chainCodes: ["1572"], unid: "BLT" }
  ];
  function resolverProductoBackend(codInput, descInput) {
    const rawCod = String(codInput || "").trim();
    const cleanCod = rawCod.replace(/[\s\-_.]/g, "").toUpperCase();
    const cleanDesc = String(descInput || "").trim().toUpperCase();
    if (cleanCod) {
      const match = MASTER_PRODUCTOS_DICT.find((p) => p.sku.toUpperCase() === cleanCod);
      if (match) return match;
    }
    if (cleanCod) {
      const match = MASTER_PRODUCTOS_DICT.find((p) => p.barcode && p.barcode.replace(/[\s\-_.]/g, "") === cleanCod);
      if (match) return match;
    }
    if (cleanCod) {
      const match = MASTER_PRODUCTOS_DICT.find((p) => p.chainCodes && p.chainCodes.some((c) => c.toUpperCase() === cleanCod));
      if (match) return match;
    }
    if (cleanDesc) {
      const match = MASTER_PRODUCTOS_DICT.find((p) => {
        const pNorm = p.nombre.toUpperCase();
        return cleanDesc.includes(pNorm) || pNorm.includes(cleanDesc);
      });
      if (match) return match;
      const tokens = cleanDesc.split(/\s+/).filter((t) => t.length > 2 && !["POR", "CON", "DEL", "LOS", "LAS", "PARA"].includes(t));
      if (tokens.length > 0) {
        const tokenMatch = MASTER_PRODUCTOS_DICT.find((p) => {
          const pNorm = p.nombre.toUpperCase();
          return tokens.filter((t) => pNorm.includes(t)).length >= Math.min(2, tokens.length);
        });
        if (tokenMatch) return tokenMatch;
      }
    }
    return null;
  }
  function parseNumeroSeguro(val) {
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const s = String(val).trim();
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
      const num2 = parseFloat(s.replace(/\./g, "").replace(",", "."));
      return isNaN(num2) ? 0 : num2;
    }
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
      const num2 = parseFloat(s.replace(/,/g, ""));
      return isNaN(num2) ? 0 : num2;
    }
    if (/^\d+,\d+$/.test(s)) {
      const num2 = parseFloat(s.replace(",", "."));
      return isNaN(num2) ? 0 : num2;
    }
    const cleaned = s.replace(/[$BsUSD\s]/gi, "");
    if (cleaned.includes(".") && cleaned.includes(",")) {
      if (cleaned.indexOf(".") < cleaned.indexOf(",")) {
        const n = parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
        return isNaN(n) ? 0 : n;
      } else {
        const n = parseFloat(cleaned.replace(/,/g, ""));
        return isNaN(n) ? 0 : n;
      }
    }
    if (cleaned.includes(",")) {
      const n = parseFloat(cleaned.replace(",", "."));
      return isNaN(n) ? 0 : n;
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  app2.post("/api/alkosto/ocr-orden", authenticateToken, rateLimiter(10 * 6e4, 20, "OCR Orden Alkosto"), async (req, res) => {
    try {
      let safeExtractJson = function(raw) {
        if (!raw || typeof raw !== "string") {
          throw new Error("Respuesta vac\xEDa del motor OCR");
        }
        let text = raw.trim();
        const mdCodeBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (mdCodeBlock && mdCodeBlock[1]) {
          text = mdCodeBlock[1].trim();
        } else if (text.startsWith("```")) {
          text = text.replace(/^```[a-z]*\s*/i, "").replace(/```$/s, "").trim();
        }
        try {
          return JSON.parse(text);
        } catch (err) {
          const posMatch = err.message && err.message.match(/at position (\d+)/);
          if (posMatch) {
            const pos = parseInt(posMatch[1], 10);
            try {
              return JSON.parse(text.substring(0, pos).trim());
            } catch {
            }
          }
        }
        const firstBrace = text.indexOf("{");
        if (firstBrace !== -1) {
          const lastBrace = text.lastIndexOf("}");
          if (lastBrace > firstBrace) {
            const candidate = text.substring(firstBrace, lastBrace + 1).trim().replace(/,\s*([}\]])/g, "$1");
            return JSON.parse(candidate);
          }
        }
        throw new Error("No se pudo interpretar el JSON devuelto por el lector OCR");
      };
      const { imageBase64, mimeType = "image/jpeg" } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Falta la imagen o PDF de la orden de compra" });
      }
      let cleanBase64 = String(imageBase64).trim();
      let actualMime = String(mimeType || "image/jpeg").trim();
      if (cleanBase64.startsWith("data:")) {
        const m = cleanBase64.match(/^data:([^;]+);base64,(.+)$/);
        if (m) {
          actualMime = m[1];
          cleanBase64 = m[2];
        }
      }
      const isPdfPayload = actualMime === "application/pdf" || cleanBase64.startsWith("JVBERi0");
      if (isPdfPayload) {
        actualMime = "application/pdf";
      }
      let deterministicOrder = null;
      if (isPdfPayload) {
        try {
          const pdfBuffer = Buffer.from(cleanBase64, "base64");
          const positionedText = extractPositionedTextFromAlkostoPdfBuffer(pdfBuffer, import_zlib.default.inflateSync);
          if (positionedText) {
            const parsedDet = parseAlkostoRawText(positionedText);
            if (parsedDet && parsedDet.items.length > 0) {
              deterministicOrder = parsedDet;
            }
          }
        } catch (pdfParseErr) {
          console.warn("[ALKOSTO OCR] Advertencia en lectura de coordenadas PDF:", pdfParseErr?.message);
        }
      }
      if (!process.env.GEMINI_API_KEY && deterministicOrder) {
        return res.json({
          success: true,
          parserMode: "DETERMINISTIC_PDF",
          data: deterministicOrder
        });
      }
      const ai = new import_genai.GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const systemInstruction = `Eres un motor de visi\xF3n multimodal bancaria especializado en lectura visual nativa de \xD3rdenes de Compra (OC) en PDF e imagen de CODIZULCA, C.A. para las cadenas ALKOSTO (P\xE1gina 1: columnas AK01 a AK10, AKOP, CI) y FAMILIA CENTER (P\xE1gina 2: columnas FC01 a FC07).
REGLAS ESTRICTAS OBLIGATORIAS:
1. Lee visualmente las l\xEDneas de la cuadr\xEDcula de TODAS las p\xE1ginas del PDF sin desfasar columnas cuando la descripci\xF3n salta de l\xEDnea.
2. Extrae obligatoriamente: numero_oc (ej. "0000055773"), fecha_emision (ej. "26/10/2026"), fecha_entrega (ej. "31/10/2026"), tasa_cambio (ej. 887.3020), subtotal_alkosto, subtotal_familia_center y subtotal_general.
3. Recorre todas las p\xE1ginas del PDF identificando la matriz de cada cadena:
   - P\xE1gina Alkosto: AK01, AK02, AK03, AK04, AK05, AK06, AK07, AK08, AK09, AK10, AKOP, CI.
   - P\xE1gina Familia Center: FC01, FC02, FC03, FC04, FC05, FC06, FC07.
4. REGLA DE AUTOCORRECTOR MATEM\xC1TICO POR FILA: Para cada producto, la suma de las cantidades de todas las tiendas de esa p\xE1gina DEBE ser exactamente igual a la columna Total Cantidad de esa fila, y Total Cantidad * Costo Unitario debe cuadrar con Total Renglon. Si en una celda el texto parece decir "200" pero el Total Cantidad de la fila es "3.00" y otra tienda tiene "1.00" (ej. en AK10 para el c\xF3digo 7591210000513), corrige autom\xE1ticamente el valor a "2.00".
5. Homologaci\xF3n de C\xF3digo EAN a SKU Interno y limpieza de descripci\xF3n:
   - 7591289609129 -> SKU "21" | "CJ" | "MORTADELA DE POLLO DEL CORRAL 1KG"
   - 7591289400023 -> SKU "047" | "UND" | "NUGGETS DE POLLO DEL CORRAL 460GR"
   - 5412873178161 -> SKU "1360" | "CJ" | "PAPAS FRITAS CONGELADAS MARQUISE 2,5KG"
   - 100281 -> SKU "100281" | "KG" | "QUESO MOZZARELLA CORLASA X KG"
   - 7591210000513 -> SKU "7591210000513" | "CJ" | "CREMA DE LECHE PURISIMA 500GR"
   - 7591210000544 -> SKU "7591210000544" | "CJ" | "CREMA DE LECHE PURISIMA 250GR"
   Elimina siempre de la descripci\xF3n el sufijo del PVP (ej. quitar "/3.78", "/5.84", "/6.99", "/12.00", "/5.89", "/3.70").`;
      const prompt = `Analiza visualmente el documento PDF/imagen adjunto en todas sus p\xE1ginas y devuelve \xDANICAMENTE un objeto JSON estructurado que cumpla estrictamente el responseSchema y el cuadre matem\xE1tico por fila y por cadena.`;
      const ocResponseSchema = {
        type: import_genai.Type.OBJECT,
        properties: {
          numero_oc: { type: import_genai.Type.STRING, description: "N\xFAmero de Orden de Compra (ej. 0000055773)" },
          ordenNro: { type: import_genai.Type.STRING, description: "N\xFAmero de Orden de Compra (ej. 0000055773)" },
          fecha_emision: { type: import_genai.Type.STRING, description: "Fecha de emisi\xF3n (ej. 26/10/2026)" },
          fechaEmision: { type: import_genai.Type.STRING },
          fecha_entrega: { type: import_genai.Type.STRING, description: "Fecha de entrega (ej. 31/10/2026)" },
          fechaEntrega: { type: import_genai.Type.STRING },
          tasa_cambio: { type: import_genai.Type.NUMBER, description: "Tasa de cambio BCV (ej. 887.3020)" },
          tasaCambio: { type: import_genai.Type.NUMBER },
          subtotal_alkosto: { type: import_genai.Type.NUMBER, description: "SubTotal p\xE1gina Alkosto (ej. 11321.85)" },
          subtotalAlkosto: { type: import_genai.Type.NUMBER },
          subtotal_familia_center: { type: import_genai.Type.NUMBER, description: "SubTotal p\xE1gina Familia Center (ej. 4149.02)" },
          subtotalFamiliaCenter: { type: import_genai.Type.NUMBER },
          subtotal_general: { type: import_genai.Type.NUMBER, description: "Sub Total general de la OC (ej. 15470.87)" },
          subtotalGeneral: { type: import_genai.Type.NUMBER },
          subtotal: { type: import_genai.Type.NUMBER },
          clienteCadena: { type: import_genai.Type.STRING, description: "ALKOSTO o FAMILIA_CENTER" },
          clienteNombre: { type: import_genai.Type.STRING },
          idCliente: { type: import_genai.Type.STRING },
          ruta: { type: import_genai.Type.STRING },
          nroPedido: { type: import_genai.Type.STRING },
          sede: { type: import_genai.Type.STRING },
          diasCredito: { type: import_genai.Type.NUMBER },
          proveedorNombre: { type: import_genai.Type.STRING },
          proveedorRif: { type: import_genai.Type.STRING },
          observaciones: { type: import_genai.Type.STRING },
          supervisor: { type: import_genai.Type.STRING },
          chofer: { type: import_genai.Type.STRING },
          cantidadCestas: { type: import_genai.Type.STRING },
          items: {
            type: import_genai.Type.ARRAY,
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                renglon: { type: import_genai.Type.NUMBER, description: "Columna N\xB0 (n\xFAmero de fila)" },
                unid: { type: import_genai.Type.STRING, description: "Columna UNID normalizada estrictamente a CJ, UND, KG o BLT" },
                totalCantidad: { type: import_genai.Type.NUMBER, description: "Columna Total Cantidad solicitada" },
                cantDespachada: { type: import_genai.Type.STRING },
                codigo: { type: import_genai.Type.STRING, description: "C\xF3digo EAN o SKU del art\xEDculo" },
                skuCodizulca: { type: import_genai.Type.STRING, description: "SKU interno CODIZULCA homologado" },
                codigoBarra: { type: import_genai.Type.STRING },
                descripcion: { type: import_genai.Type.STRING, description: "Descripci\xF3n limpia sin el sufijo /PVP" },
                emp: { type: import_genai.Type.NUMBER },
                costoBruto: { type: import_genai.Type.NUMBER },
                costoUnitario: { type: import_genai.Type.NUMBER, description: "Costo Unitario" },
                totalRenglon: { type: import_genai.Type.NUMBER, description: "Total Renglon (Total Cantidad * Costo Unitario)" },
                tiendas: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    AK01: { type: import_genai.Type.NUMBER },
                    AK02: { type: import_genai.Type.NUMBER },
                    AK03: { type: import_genai.Type.NUMBER },
                    AK04: { type: import_genai.Type.NUMBER },
                    AK05: { type: import_genai.Type.NUMBER },
                    AK06: { type: import_genai.Type.NUMBER },
                    AK07: { type: import_genai.Type.NUMBER },
                    AK08: { type: import_genai.Type.NUMBER },
                    AK09: { type: import_genai.Type.NUMBER },
                    AK10: { type: import_genai.Type.NUMBER },
                    AKOP: { type: import_genai.Type.NUMBER },
                    CI: { type: import_genai.Type.NUMBER },
                    FC01: { type: import_genai.Type.NUMBER },
                    FC02: { type: import_genai.Type.NUMBER },
                    FC03: { type: import_genai.Type.NUMBER },
                    FC04: { type: import_genai.Type.NUMBER },
                    FC05: { type: import_genai.Type.NUMBER },
                    FC06: { type: import_genai.Type.NUMBER },
                    FC07: { type: import_genai.Type.NUMBER },
                    FCOP: { type: import_genai.Type.NUMBER }
                  }
                }
              },
              required: ["codigo", "descripcion", "unid", "totalCantidad"]
            }
          }
        },
        required: ["items"]
      };
      const candidateModels = ["gemini-2.5-flash", "gemini-2.5-pro"];
      let lastModelError = null;
      let validatedOrder = null;
      let usedModel = "";
      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: "user",
                parts: [
                  { inlineData: { data: cleanBase64, mimeType: actualMime } },
                  { text: prompt }
                ]
              }
            ],
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: ocResponseSchema,
              temperature: 0
            }
          });
          if (response && response.text) {
            const parsed = safeExtractJson(response.text);
            const candidateValidated = validateAndNormalizeAlkostoOC(parsed, {
              strictMath: false,
              requireOrdenNro: false
            });
            const resumenCuadre = calcularResumenCuadreOC(candidateValidated);
            const hasRowMismatch = candidateValidated.items.some((it) => {
              const storeVals = Object.entries(it.tiendas || {}).filter(([tk]) => tk !== "AKOP" && tk !== "FCOP" && tk !== "CI").map(([, v]) => Number(v) || 0);
              if (storeVals.length === 0) return false;
              const sumStores = Number(storeVals.reduce((a, b) => a + b, 0).toFixed(2));
              return Math.abs(sumStores - Number(it.totalCantidad || 0)) > 0.05;
            });
            validatedOrder = candidateValidated;
            usedModel = modelName;
            if (!resumenCuadre.cuadreExacto || hasRowMismatch) {
              console.warn(`[ALKOSTO OCR] Descuadre matem\xE1tico detectado en ${modelName}, activando fallback...`);
              continue;
            }
            break;
          }
        } catch (mErr) {
          lastModelError = mErr;
          console.warn(`[ALKOSTO OCR] Modelo ${modelName} fall\xF3, activando fallback:`, mErr?.message);
        }
      }
      if (deterministicOrder) {
        const detCuadre = calcularResumenCuadreOC(deterministicOrder);
        const aiCuadre = validatedOrder ? calcularResumenCuadreOC(validatedOrder) : null;
        if (!validatedOrder || !aiCuadre?.cuadreExacto && detCuadre.cuadreExacto || validatedOrder.items.length < deterministicOrder.items.length) {
          return res.json({
            success: true,
            parserMode: usedModel ? `AI_HYBRID_${usedModel}` : "DETERMINISTIC_PDF",
            data: deterministicOrder
          });
        }
      }
      if (!validatedOrder) {
        throw new Error(lastModelError?.message || "No se obtuvo respuesta del motor de IA para el OCR");
      }
      return res.json({ success: true, parserMode: `AI_VALIDATED_${usedModel}`, data: validatedOrder });
    } catch (err) {
      console.error("Error en OCR Alkosto:", err);
      if (err instanceof AlkostoParseValidationError) {
        return res.status(422).json({
          error: err.message,
          code: err.code,
          issues: err.issues
        });
      }
      const quota = /RESOURCE_EXHAUSTED|prepayment credits|quota|billing/i.test(String(err?.message || ""));
      return res.status(quota ? 503 : 500).json({ error: quota ? "El lector autom\xE1tico (IA) no est\xE1 disponible temporalmente. Ingresa la orden manualmente." : "Error procesando orden de compra" });
    }
  });
  const ABREVIATURAS_CONFIG = {
    alkosto: [
      { codigo: "7498", tag: "AK01", nombre: "Alkosto 1 san Felipe", zona: "san Felipe", direccion: "Direcci\xF3n de despacho; calle 98 CC san Felipe 1 nivel PB sector casco central." },
      { codigo: "7499", tag: "AK02", nombre: "Alkosto 2 - Plaza baral", zona: "Plaza baral", direccion: "Plaza baral" },
      { codigo: "7497", tag: "AK03", nombre: "Alkosto 3 - Delicias", zona: "Delicias", direccion: "Delicias" },
      { codigo: "7500", tag: "AK04", nombre: "Alkosto 4 - Coromoto", zona: "Coromoto", direccion: "Coromoto" },
      { codigo: "7502", tag: "AK05", nombre: "Alkosto 5 - Cabimas", zona: "Cabimas", direccion: "Cabimas" },
      { codigo: "7503", tag: "AK06", nombre: "Alkosto 6 - Los cactu", zona: "Los cactu", direccion: "Los cactu" },
      { codigo: "7680", tag: "AK07", nombre: "Alkosto 7 - Bella vista", zona: "Bella vista", direccion: "Bella vista" },
      { codigo: "7905", tag: "AK08", nombre: "Alkosto 8 - Trujillo", zona: "Trujillo", direccion: "Trujillo" },
      { codigo: "8160", tag: "AK09", nombre: "Alkosto 9 - Antiguo nasa Zona industrial", zona: "Antiguo nasa Zona industrial", direccion: "Antiguo nasa Zona industrial" },
      { codigo: "8306", tag: "AK10", nombre: "Alkosto 10 - La limpia", zona: "La limpia", direccion: "La limpia" }
    ],
    familiaCenter: [
      { codigo: "7490", tag: "FC01", nombre: "Familia Center 1 - Plaza lago", zona: "Plaza lago", direccion: "Plaza lago" },
      { codigo: "7492", tag: "FC02", nombre: "Familia Center 2", zona: "URB monte claro", direccion: "Calle43entre Av 150 416N\xB015-041 URB monte claro" },
      { codigo: "7494", tag: "FC03", nombre: "Familia Center 3", zona: "Parroquia Coquivacoa", direccion: "CalleJ con Av 12 distinguido bajo el NJ-10 de nomenclatura municipal en jurisdicci\xF3n parroquia coquivacoa el municipio aut\xF3nomo Maracaibo estado Zulia." },
      { codigo: "7491", tag: "FC04", nombre: "Familia 4 - Dr quintero", zona: "Dr quintero", direccion: "Dr quintero" },
      { codigo: "7489", tag: "FC05", nombre: "Familia Center 5 - La lago", zona: "La lago", direccion: "La lago" },
      { codigo: "7493", tag: "FC06", nombre: "Familia 6 - Los olivos", zona: "Los olivos", direccion: "Los olivos" },
      { codigo: "8229", tag: "FC07", nombre: "Familia Center #7 - San Francisco", zona: "San Francisco", direccion: "San Francisco" }
    ],
    tags: {
      alkosto: ["AK01", "AK02", "AK03", "AK04", "AK05", "AK06", "AK07", "AK08", "AK09", "AK10"],
      familiaCenter: ["FC01", "FC02", "FC03", "FC04", "FC05", "FC06", "FC07"]
    }
  };
  app2.get("/api/cadenas/sucursales", async (req, res) => {
    try {
      res.json({
        success: true,
        ...ABREVIATURAS_CONFIG
      });
    } catch (err) {
      res.status(500).json({ error: "Error obteniendo sucursales de cadenas" });
    }
  });
  app2.post("/api/cadenas/sincronizar", async (req, res) => {
    try {
      await (0, import_firestore3.setDoc)((0, import_firestore3.doc)(db, "cadenas_config", "abreviaturas"), {
        ...ABREVIATURAS_CONFIG,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }, { merge: true });
      res.json({ success: true, message: "Abreviaturas de Alkosto y Familia Center sincronizadas correctamente en Firestore" });
    } catch (err) {
      console.error("Error sincronizando cadenas en Firestore:", err);
      res.status(500).json({ error: "Error sincronizando en Firestore", details: err?.message });
    }
  });
  let cachedBcvRate = 875.65;
  app2.post("/api/ocr", authenticateToken, rateLimiter(10 * 6e4, 30, "OCR Bancario"), async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg" } = req.body;
      if (!imageBase64) return res.status(400).json({ error: "Falta la imagen del comprobante de pago" });
      let cleanBase64 = String(imageBase64).trim();
      let actualMime = mimeType;
      if (cleanBase64.startsWith("data:")) {
        const matches = cleanBase64.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          actualMime = matches[1];
          cleanBase64 = matches[2];
        }
      }
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
          error: "API Key de Gemini no configurada en el servidor (GEMINI_API_KEY en .env). Por favor ingresa los datos del pago manualmente.",
          manualEntryRequired: true
        });
      }
      const ai = new import_genai.GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const prompt = `Analiza detalladamente esta imagen de comprobante bancario, captura de pantalla de Pago M\xF3vil, transferencia o recibo de pago venezolano.
Extrae la informaci\xF3n financiera exacta de la transacci\xF3n y devuelve estrictamente un objeto JSON con los siguientes campos:

REGLAS CR\xCDTICAS DE EXTRACCI\xD3N PARA COMPROBANTES BANCARIOS VENEZOLANOS:
1. "banco": Nombre oficial del banco de origen o emisor. Ejemplos comunes:
   - "Banco de Venezuela" (BDV, BDVenl\xEDnea, PagoM\xF3vilBDV)
   - "Banesco" (Banesco Pago M\xF3vil, BanescOnline)
   - "Banco Mercantil" (Mercantil M\xF3vil, Tpago)
   - "BBVA Banco Provincial" (Provinet M\xF3vil, Dinero R\xE1pido)
   - "Bancamiga" (Bancamiga Pago M\xF3vil)
   - "Banco Nacional de Cr\xE9dito (BNC)"
   - "Bancaribe" (Mi Pago Bancaribe)
   - "Banplus" (Pago Plus)
   - "Banco Plaza" (Tu Pago Plaza)
   - "Banco del Tesoro" (Tesoro Pago M\xF3vil)
   - "Banco Exterior", "Banco Bicentenario", "Zelle", "D\xF3lares Efectivo".

2. "monto": N\xFAmero decimal exacto pagado en Bol\xEDvares o D\xF3lares (punto para decimales).
   - OJO VENEZUELA: Los recibos usan coma como decimal y punto como miles (ej: "Bs. 1.250,50" -> 1250.50; "Bs. 520,00" -> 520.00; "Bs. 5.400,00" -> 5400.00; "35,00 USD" -> 35.00).
   - NUNCA omitas decimales ni multipliques por 100 (ej: 520,00 NUNCA es 52000).

3. "referencia": El n\xFAmero de comprobante, secuencia, referencia bancaria o c\xF3digo de aprobaci\xF3n de la transacci\xF3n (ej: "019283", "00281902", "12849201", "829103").
   - IMPORTANTE: En Pago M\xF3vil NUNCA extraigas el n\xFAmero de tel\xE9fono celular (0414..., 0424..., 0412..., 0416...) ni la c\xE9dula. Extrae estrictamente el N\xDAMERO DE REFERENCIA / SECUENCIA bancario. Elimina palabras como "REF", "NRO", "OP", "APROBACI\xD3N".

4. "fecha_pago": Fecha en la que se efectu\xF3 el pago en formato YYYY-MM-DD.
   - En Venezuela los comprobantes est\xE1n en formato DD/MM/YYYY (ej: 12/10/2026 -> "2026-10-12").
   - Si no aparece el a\xF1o expl\xEDcito pero s\xED el d\xEDa y mes (ej: "12 Octubre"), asume el a\xF1o en curso (2026).

5. "titular": Nombre de la persona o comercio que REALIZ\xD3 el pago (el emisor/ordenante/cliente).
   - NUNCA pongas "Codizulca", "Distribuidora Codizulca" ni los datos de la cuenta receptora de la empresa.

6. "rif": C\xE9dula de Identidad o RIF del pagador/emisor (ej: "V-18293041", "J-30192834-0").

7. "metodo_pago": Clasifica el m\xE9todo de pago en una de estas opciones exactas:
   - "Pago M\xF3vil"
   - "Transferencia Bancaria"
   - "Zelle / Divisas"
   - "Efectivo Divisas"
   - "Biopago / Punto"`;
      const cobroSchema = {
        type: import_genai.Type.OBJECT,
        properties: {
          banco: { type: import_genai.Type.STRING },
          metodo_pago: { type: import_genai.Type.STRING },
          monto: { type: import_genai.Type.NUMBER },
          referencia: { type: import_genai.Type.STRING },
          fecha_pago: { type: import_genai.Type.STRING },
          titular: { type: import_genai.Type.STRING },
          rif: { type: import_genai.Type.STRING }
        },
        required: ["monto", "referencia"]
      };
      const candidateModels = ["gemini-2.5-flash", "gemini-2.5-pro"];
      let rawResponseText = "";
      let lastModelError = null;
      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: "user",
                parts: [
                  { inlineData: { mimeType: actualMime, data: cleanBase64 } },
                  { text: prompt }
                ]
              }
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: cobroSchema,
              temperature: 0.1
            }
          });
          rawResponseText = response.text || "";
          if (rawResponseText) break;
        } catch (err) {
          lastModelError = err;
          console.warn(`[OCR COBROS] Fall\xF3 modelo ${modelName}, intentando siguiente:`, err?.message);
        }
      }
      if (!rawResponseText) {
        throw new Error(lastModelError?.message || "No se pudo extraer la informaci\xF3n del comprobante.");
      }
      const parsed = JSON.parse(rawResponseText);
      let refClean = String(parsed.referencia || "").trim();
      refClean = refClean.replace(/^(REF|REFERENCIA|NRO|NUM|OPERACION|OP|SECUENCIA|APROB|APROBACION|#)[:\s-]*/gi, "").trim();
      const montoNum = parseNumeroSeguro(parsed.monto);
      let fechaClean = String(parsed.fecha_pago || "").trim();
      if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(fechaClean)) {
        const parts = fechaClean.split(/[/-]/);
        fechaClean = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaClean)) {
        fechaClean = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      }
      let bancoClean = String(parsed.banco || "").trim();
      if (/venezuela|bdv/i.test(bancoClean)) bancoClean = "Banco de Venezuela";
      else if (/banesco/i.test(bancoClean)) bancoClean = "Banesco";
      else if (/mercantil/i.test(bancoClean)) bancoClean = "Banco Mercantil";
      else if (/provincial|bbva/i.test(bancoClean)) bancoClean = "BBVA Banco Provincial";
      else if (/bancamiga/i.test(bancoClean)) bancoClean = "Bancamiga";
      else if (/bnc|nacional de cr/i.test(bancoClean)) bancoClean = "Banco Nacional de Cr\xE9dito (BNC)";
      else if (/bancaribe/i.test(bancoClean)) bancoClean = "Bancaribe";
      else if (/banplus/i.test(bancoClean)) bancoClean = "Banplus";
      else if (/plaza/i.test(bancoClean)) bancoClean = "Banco Plaza";
      else if (/tesoro/i.test(bancoClean)) bancoClean = "Banco del Tesoro";
      else if (/zelle/i.test(bancoClean)) bancoClean = "Zelle";
      let metodoClean = String(parsed.metodo_pago || "").trim();
      if (/zelle/i.test(metodoClean) || /zelle/i.test(bancoClean)) metodoClean = "Zelle / Divisas";
      else if (/transferencia/i.test(metodoClean)) metodoClean = "Transferencia Bancaria";
      else if (/efectivo/i.test(metodoClean)) metodoClean = "Efectivo Divisas";
      else if (/biopago|punto/i.test(metodoClean)) metodoClean = "Biopago / Punto";
      else metodoClean = "Pago M\xF3vil";
      const sinReferencia = !refClean || /^(NO[_ ]?ENCONTRADA|NULL|N\/A)$/i.test(refClean);
      if (montoNum <= 0 && sinReferencia) {
        return res.status(422).json({
          error: "No se pudo leer el comprobante. Toma la foto de frente, con buena luz y sin recortes, o ingresa los datos manualmente.",
          code: "OCR_EMPTY"
        });
      }
      return res.json({
        banco: bancoClean || "",
        metodo_pago: metodoClean,
        monto: montoNum,
        referencia: sinReferencia ? "" : refClean,
        fecha_pago: fechaClean,
        titular: String(parsed.titular || "").trim(),
        rif: String(parsed.rif || "").trim()
      });
    } catch (err) {
      console.error("[OCR COBROS] Error procesando comprobante:", err);
      const rawMsg = String(err?.message || "");
      const isQuota = /RESOURCE_EXHAUSTED|prepayment credits|"code"\s*:\s*(402|429)|quota|billing/i.test(rawMsg);
      if (isQuota) {
        return res.status(503).json({
          error: "El lector autom\xE1tico (IA) no est\xE1 disponible temporalmente. Ingresa los datos del pago manualmente; el resto del m\xF3dulo funciona con normalidad.",
          code: "AI_QUOTA_EXHAUSTED"
        });
      }
      return res.status(500).json({ error: "No se pudo interpretar el comprobante. Puedes ingresar los datos manualmente." });
    }
  });
  const COBROS_BUCKET = "comprobantes-cobros";
  const COBROS_LOCAL_DB_PATH = import_path.default.join(process.cwd(), "cobros_registrados.json");
  let cobrosBucketInitialized = false;
  async function ensureCobrosBucket() {
    if (cobrosBucketInitialized || !supabase) return;
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const exists = Array.isArray(buckets) && buckets.some((b) => b.name === COBROS_BUCKET);
      if (!exists) {
        await supabase.storage.createBucket(COBROS_BUCKET, {
          public: true,
          fileSizeLimit: 15728640,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf", "application/json"]
        });
      }
      cobrosBucketInitialized = true;
    } catch (err) {
      console.warn("[COBROS STORAGE] Advertencia verificando bucket:", err?.message);
    }
  }
  app2.post("/api/cobros/sync", authenticateToken, async (req, res) => {
    try {
      const {
        id,
        vendedor,
        vendedorEmail,
        ruta,
        metodo_pago = "Pago M\xF3vil",
        banco = "No especificado",
        monto = 0,
        referencia = "",
        fecha_pago,
        titular = "",
        rif = "",
        tasa = 0,
        codigo_cliente = "N/A",
        nombre_cliente = "",
        factura = "N/A",
        fileDataUrl,
        fileName,
        fileMimeType,
        createdAt
      } = req.body || {};
      if (!referencia || Number(monto) <= 0) {
        return res.status(400).json({ error: "Referencia y monto mayor a 0 son obligatorios para sincronizar el cobro." });
      }
      const cobroId = String(id || `pago-${Date.now()}`);
      const safeVendedor = String(vendedor || req.user?.username || "VENDEDOR").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
      const safeRef = String(referencia).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 30) || "ref";
      const fechaStr = String(fecha_pago || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]).replace(/[^0-9-]/g, "");
      let comprobante_url = "";
      let uploadedMime = String(fileMimeType || "image/jpeg");
      if (fileDataUrl && typeof fileDataUrl === "string" && supabase) {
        await ensureCobrosBucket();
        let base64Part = fileDataUrl.trim();
        if (base64Part.startsWith("data:")) {
          const m = base64Part.match(/^data:([^;]+);base64,(.+)$/);
          if (m) {
            uploadedMime = m[1];
            base64Part = m[2];
          }
        }
        const fileBuffer = Buffer.from(base64Part, "base64");
        if (fileBuffer.length > 0) {
          let ext = "jpg";
          if (uploadedMime === "application/pdf" || String(fileName || "").toLowerCase().endsWith(".pdf")) {
            ext = "pdf";
            uploadedMime = "application/pdf";
          } else if (uploadedMime === "image/png") {
            ext = "png";
          } else if (uploadedMime === "image/webp") {
            ext = "webp";
          }
          const storagePath = `soportes/${safeVendedor}/${fechaStr}_${safeRef}_${cobroId}.${ext}`;
          const { error: uploadErr } = await supabase.storage.from(COBROS_BUCKET).upload(storagePath, fileBuffer, {
            contentType: uploadedMime,
            upsert: true
          });
          if (!uploadErr) {
            const { data: pubData } = supabase.storage.from(COBROS_BUCKET).getPublicUrl(storagePath);
            if (pubData?.publicUrl) {
              comprobante_url = pubData.publicUrl;
            }
          } else {
            console.warn("[COBROS STORAGE] Error subiendo archivo a Supabase Storage:", uploadErr.message);
          }
        }
      }
      const syncedAt = (/* @__PURE__ */ new Date()).toISOString();
      const cobroMetadata = {
        id: cobroId,
        vendedor: String(vendedor || req.user?.username || "ADMIN"),
        vendedorEmail: vendedorEmail || null,
        ruta: String(ruta || "Ruta 1"),
        metodo_pago: String(metodo_pago || "Pago M\xF3vil"),
        banco: String(banco || "No especificado"),
        monto: Number(monto) || 0,
        referencia: String(referencia).trim(),
        fecha_pago: fechaStr,
        titular: String(titular || ""),
        rif: String(rif || ""),
        tasa: Number(tasa) || 0,
        codigo_cliente: String(codigo_cliente || "N/A"),
        nombre_cliente: String(nombre_cliente || ""),
        factura: String(factura || "N/A"),
        fileName: fileName || null,
        fileMimeType: uploadedMime,
        comprobante_url: comprobante_url || null,
        createdAt: createdAt || syncedAt,
        syncedAt
      };
      if (supabase) {
        try {
          await ensureCobrosBucket();
          const jsonBuffer = Buffer.from(JSON.stringify(cobroMetadata, null, 2), "utf-8");
          await supabase.storage.from(COBROS_BUCKET).upload(`registros/${safeVendedor}/${cobroId}.json`, jsonBuffer, {
            contentType: "application/json",
            upsert: true
          });
        } catch (e) {
          console.warn("[COBROS STORAGE] Advertencia guardando JSON en Storage:", e?.message);
        }
      }
      try {
        await (0, import_firestore3.setDoc)((0, import_firestore3.doc)(db, "cobros_registrados", cobroId), cobroMetadata, { merge: true });
      } catch (_fsErr) {
      }
      try {
        let existingList = [];
        if (import_fs.default.existsSync(COBROS_LOCAL_DB_PATH)) {
          existingList = JSON.parse(import_fs.default.readFileSync(COBROS_LOCAL_DB_PATH, "utf-8")) || [];
        }
        const filtered = existingList.filter((item) => item && item.id !== cobroId);
        filtered.unshift(cobroMetadata);
        import_fs.default.writeFileSync(COBROS_LOCAL_DB_PATH, JSON.stringify(filtered.slice(0, 1e3), null, 2), "utf-8");
      } catch (_localErr) {
      }
      return res.json({
        success: true,
        comprobante_url,
        syncedAt,
        cobro: cobroMetadata
      });
    } catch (err) {
      console.error("[COBROS SYNC] Error sincronizando cobro:", err);
      return res.status(500).json({ error: err?.message || "Error interno al sincronizar el cobro en la nube." });
    }
  });
  app2.get("/api/cobros", authenticateToken, async (req, res) => {
    try {
      let list = [];
      if (import_fs.default.existsSync(COBROS_LOCAL_DB_PATH)) {
        list = JSON.parse(import_fs.default.readFileSync(COBROS_LOCAL_DB_PATH, "utf-8")) || [];
      }
      return res.json({ success: true, cobros: list });
    } catch (err) {
      return res.status(500).json({ error: "Error consultando cobros sincronizados" });
    }
  });
  app2.get("/api/tasa-bcv", async (req, res) => {
    try {
      const dateStr = req.query.date;
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.json({ tasa: cachedBcvRate });
      }
      const [year, month, day] = dateStr.split("-");
      const m = parseInt(month, 10);
      const d = parseInt(day, 10);
      const historicalUrl = `https://rates.dolarvzla.com/bcv/${year}/${m}/${d}.json`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3e3);
        const histRes = await fetch(historicalUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (histRes.ok) {
          const histData = await histRes.json();
          if (histData && typeof histData.usd === "number" && histData.usd > 0) {
            cachedBcvRate = Number(histData.usd.toFixed(2));
            return res.json({ tasa: cachedBcvRate });
          }
        }
      } catch (err) {
      }
      const targetDate = /* @__PURE__ */ new Date(`${dateStr}T12:00:00Z`);
      for (let i = 1; i <= 3; i++) {
        const prevDate = new Date(targetDate);
        prevDate.setDate(targetDate.getDate() - i);
        const py = prevDate.getUTCFullYear();
        const pm = prevDate.getUTCMonth() + 1;
        const pd = prevDate.getUTCDate();
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2e3);
          const prevRes = await fetch(`https://rates.dolarvzla.com/bcv/${py}/${pm}/${pd}.json`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (prevRes.ok) {
            const prevData = await prevRes.json();
            if (prevData && typeof prevData.usd === "number" && prevData.usd > 0) {
              cachedBcvRate = Number(prevData.usd.toFixed(2));
              return res.json({ tasa: cachedBcvRate });
            }
          }
        } catch (e) {
        }
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3e3);
        const currRes = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", { signal: controller.signal });
        clearTimeout(timeoutId);
        if (currRes.ok) {
          const data = await currRes.json();
          if (data && typeof data.promedio === "number" && data.promedio > 0) {
            cachedBcvRate = Number(data.promedio.toFixed(2));
            return res.json({ tasa: cachedBcvRate });
          }
        }
      } catch (e) {
      }
      return res.json({ tasa: cachedBcvRate });
    } catch (err) {
      return res.json({ tasa: cachedBcvRate });
    }
  });
  app2.get("/api/sheets-structure", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
      }
      const token = authHeader.split(" ")[1];
      const spreadsheetId = getGoogleSheetId();
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!metaRes.ok) {
        return res.status(metaRes.status).json({ error: "Failed to fetch spreadsheet structure" });
      }
      const metaData = await metaRes.json();
      const sheets = metaData.sheets.map((s) => ({
        title: s.properties.title,
        sheetId: s.properties.sheetId
      }));
      const result = { sheets };
      for (const sheet of sheets) {
        const dataRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheet.title}'!A1:Z100`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (dataRes.ok) {
          const data = await dataRes.json();
          result[sheet.title] = data.values || [];
        }
      }
      import_fs.default.writeFileSync(import_path.default.join(process.cwd(), "sheets_dump.json"), JSON.stringify(result, null, 2));
      return res.json({ success: true, message: "Data guardada en sheets_dump.json" });
    } catch (err) {
      console.error("Structure lookup error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  let cachedVolumenParsed = null;
  let lastVolumenParsedTime = 0;
  let cachedActivacionParsed = null;
  let lastActivacionParsedTime = 0;
  let cachedMetasParsed = null;
  let lastMetasParsedTime = 0;
  const PARSED_DATA_TTL = 6e4;
  app2.get("/api/usuarios", async (req, res) => {
    try {
      const workbook = await getWorkbook(req.query.force === "true");
      const XLSX = await import("xlsx");
      const parsed = parseWorkbookFull(XLSX, workbook, { periodo: metasPeriodoActual() });
      setNoCacheSyncHeaders(res);
      return res.json(parsed.usuariosRows);
    } catch (err) {
      console.error("Error fetching usuarios:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/client-lookup", authenticateToken, async (req, res) => {
    try {
      const codigo = req.query.codigo;
      if (!codigo) {
        return res.status(400).json({ error: "Missing 'codigo' parameter" });
      }
      const cleanCode = String(codigo).replace(/^[#\s]+/, "").trim();
      const codeNoZeros = cleanCode.replace(/^0+/, "");
      let clientFound = null;
      if (supabase) {
        try {
          const { data: supaRows } = await supabase.from("activacion_clientes").select("*").or(`cliente_codigo.eq.${cleanCode},cliente_codigo.eq.${codeNoZeros}`).limit(1);
          if (supaRows && supaRows.length > 0) {
            clientFound = supaRows[0];
          }
        } catch (sErr) {
          console.warn("[SERVER] Error consultando Supabase en client-lookup:", sErr?.message);
        }
      }
      if (!clientFound && cachedActivacionParsed && cachedActivacionParsed.length > 0) {
        const match = cachedActivacionParsed.find((c) => {
          const cId = String(c.id || c.cliente_codigo || "").replace(/^[#\s]+/, "").trim();
          const cNoZeros = cId.replace(/^0+/, "");
          return cId === cleanCode || codeNoZeros && cNoZeros === codeNoZeros;
        });
        if (match) {
          clientFound = {
            cliente_nombre: match.cliente || match.cliente_nombre,
            vendedor_nombre: match.vendedorNombre || match.vendedorId,
            cliente_codigo: match.id || match.cliente_codigo
          };
        }
      }
      if (!clientFound) {
        try {
          const workbook = await getWorkbook(false);
          const XLSX = await import("xlsx");
          const sheetName = workbook.SheetNames.find((s) => /activacion|clientes/i.test(s));
          if (sheetName) {
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            for (let r = 1; r < rows.length; r++) {
              const row = rows[r];
              if (!row || !row[0]) continue;
              const rCode = String(row[0]).replace(/^[#\s]+/, "").trim();
              const rNoZeros = rCode.replace(/^0+/, "");
              if (rCode === cleanCode || codeNoZeros && rNoZeros === codeNoZeros) {
                clientFound = {
                  cliente_nombre: String(row[1] || "").trim(),
                  vendedor_nombre: String(row[2] || "").trim(),
                  cliente_codigo: rCode
                };
                break;
              }
            }
          }
        } catch (wbErr) {
          console.warn("[SERVER] Fallback workbook client lookup error:", wbErr?.message);
        }
      }
      if (!clientFound) {
        return res.status(404).json({ error: "Cliente no encontrado" });
      }
      const data = clientFound;
      let vendedorNombre = data.vendedor_nombre;
      let vendedorEmail = "";
      if (vendedorNombre && /johnatan|soto|mikelangelo/i.test(vendedorNombre)) {
        vendedorNombre = "Mikelangelo Diaz";
        vendedorEmail = "Mikelangelodiaz@gmail.com";
      }
      return res.json({
        nombre: data.cliente_nombre || data.razon_social || "",
        vendedor: vendedorNombre,
        vendedorEmail,
        direccion: data.direccion || "",
        ruc: data.cliente_codigo || data.codigo || ""
      });
    } catch (err) {
      console.error("Client lookup error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  async function syncWorkbookToSupabase(workbook) {
    const XLSX = await import("xlsx");
    const periodo = metasPeriodoActual();
    let masterClients = [];
    let hadDbClients = false;
    if (supabase) {
      try {
        const allClients = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase.from("activacion_clientes").select("*").order("id").range(from, from + 999);
          if (error || !data || data.length === 0) break;
          allClients.push(...data);
          if (data.length < 1e3) break;
          from += 1e3;
        }
        if (allClients.length > 0) {
          hadDbClients = true;
          const seenCodes = /* @__PURE__ */ new Map();
          const duplicateIds = [];
          for (const c of allClients) {
            const codKey = String(c.cliente_codigo || "").trim();
            if (!codKey) continue;
            if (!seenCodes.has(codKey)) {
              seenCodes.set(codKey, c);
            } else {
              const prev = seenCodes.get(codKey);
              prev.has_aceite = Boolean(prev.has_aceite || c.has_aceite);
              prev.has_azucar = Boolean(prev.has_azucar || c.has_azucar);
              prev.has_pollo = Boolean(prev.has_pollo || c.has_pollo);
              prev.has_estandar_asturias = Boolean(prev.has_estandar_asturias || c.has_estandar_asturias);
              prev.has_mortadela_salpicao = Boolean(prev.has_mortadela_salpicao || c.has_mortadela_salpicao);
              duplicateIds.push(c.id);
            }
          }
          if (duplicateIds.length > 0) {
            for (let i = 0; i < duplicateIds.length; i += 200) {
              await supabase.from("activacion_clientes").delete().in("id", duplicateIds.slice(i, i + 200));
            }
          }
          masterClients = Array.from(seenCodes.values()).map((c) => ({
            id: c.id,
            cliente_codigo: String(c.cliente_codigo || "").trim(),
            cliente_nombre: String(c.cliente_nombre || "").trim(),
            vendedor_id: String(c.vendedor_id || c.vendedor_nombre || "").replace(/\s+/g, " ").trim(),
            vendedor_nombre: String(c.vendedor_nombre || c.vendedor_id || "").replace(/\s+/g, " ").trim(),
            has_aceite: Boolean(c.has_aceite),
            has_azucar: Boolean(c.has_azucar),
            has_pollo: Boolean(c.has_pollo),
            has_estandar_asturias: Boolean(c.has_estandar_asturias),
            has_mortadela_salpicao: Boolean(c.has_mortadela_salpicao)
          }));
        }
      } catch (dbReadErr) {
        console.warn("[SERVER] Advertencia leyendo cartera maestra desde Supabase:", dbReadErr?.message);
      }
    }
    if (masterClients.length === 0) {
      masterClients = loadLocalMasterClientSeed();
    }
    const parsed = parseWorkbookFull(XLSX, workbook, {
      periodo,
      masterClients
    });
    cachedVolumenParsed = parsed.volumenApiRows;
    lastVolumenParsedTime = Date.now();
    cachedActivacionParsed = parsed.activacionApiRows;
    lastActivacionParsedTime = Date.now();
    cachedMetasParsed = parsed.metasApiRows;
    lastMetasParsedTime = Date.now();
    lastSheetMetrics = parsed.metrics;
    lastSheetWarnings = parsed.warnings;
    if (parsed.warnings.length > 0) {
      console.warn(
        `[SHEET QA] ${parsed.warnings.length} advertencia(s) en lectura fila por fila (datos incompletos/duplicados registrados sin cortar carga):`,
        parsed.warnings.slice(0, 8)
      );
    }
    if (supabase) {
      try {
        if (parsed.volumenSupabaseRows.length > 0) {
          await supabase.from("ventas_volumen").delete().eq("periodo", periodo);
          for (let i = 0; i < parsed.volumenSupabaseRows.length; i += 200) {
            const batch = parsed.volumenSupabaseRows.slice(i, i + 200);
            const { error: insVolErr } = await supabase.from("ventas_volumen").insert(batch);
            if (insVolErr) throw new Error(`insert lote ${i}: ${insVolErr.message}`);
          }
        }
      } catch (vErr) {
        console.warn("[SERVER] Error sincronizando ventas_volumen:", vErr?.message);
      }
      try {
        if (parsed.activacionSupabaseUpserts.length > 0) {
          for (let i = 0; i < parsed.activacionSupabaseUpserts.length; i += 200) {
            const batch = parsed.activacionSupabaseUpserts.slice(i, i + 200);
            await supabase.from("activacion_clientes").upsert(batch, { onConflict: "id" });
          }
        }
        if (hadDbClients && parsed.newSheetClientsForSupabase.length > 0) {
          for (let i = 0; i < parsed.newSheetClientsForSupabase.length; i += 200) {
            const batch = parsed.newSheetClientsForSupabase.slice(i, i + 200);
            await supabase.from("activacion_clientes").insert(batch);
          }
        }
      } catch (cErr) {
        console.warn("[SERVER] Error sincronizando activacion_clientes:", cErr?.message);
      }
      try {
        if (parsed.metasSupabaseRows.length > 0) {
          await supabase.from("metas_activacion").delete().eq("periodo", periodo);
          for (let i = 0; i < parsed.metasSupabaseRows.length; i += 200) {
            const batch = parsed.metasSupabaseRows.slice(i, i + 200);
            const { error: insMetaErr } = await supabase.from("metas_activacion").insert(batch);
            if (insMetaErr) throw new Error(`insert lote ${i}: ${insMetaErr.message}`);
          }
        }
      } catch (mErr) {
        console.warn("[SERVER] Error sincronizando metas_activacion:", mErr?.message);
      }
    }
    return {
      countVolumen: parsed.volumenApiRows.length,
      countActivacion: parsed.activacionApiRows.length,
      countMetas: parsed.metasApiRows.length,
      warningsCount: parsed.warnings.length,
      metrics: parsed.metrics
    };
  }
  let inFlightSheetsSync = null;
  let lastFullSheetsSyncCompletedAt = 0;
  async function runCoalescedSheetsSync(bypassCooldown = false) {
    if (inFlightSheetsSync) {
      return inFlightSheetsSync;
    }
    if (!bypassCooldown && Date.now() - lastFullSheetsSyncCompletedAt < 4e3 && cachedVolumenParsed && cachedActivacionParsed && cachedMetasParsed) {
      return {
        countVolumen: cachedVolumenParsed.length,
        countActivacion: cachedActivacionParsed.length,
        countMetas: cachedMetasParsed.length,
        warningsCount: lastSheetWarnings.length,
        metrics: lastSheetMetrics
      };
    }
    inFlightSheetsSync = (async () => {
      try {
        const workbook = await getWorkbook(true);
        const res = await syncWorkbookToSupabase(workbook);
        lastFullSheetsSyncCompletedAt = Date.now();
        return res;
      } finally {
        inFlightSheetsSync = null;
      }
    })();
    return inFlightSheetsSync;
  }
  app2.post("/api/sync/sheets", authenticateToken, async (req, res) => {
    try {
      const sheetId = getGoogleSheetId();
      console.log(`[SERVER] Sincronizando datos en vivo desde Google Sheets (${sheetId}) solicitado por ${req.user?.username || "usuario"}...`);
      const result = await runCoalescedSheetsSync(true);
      setNoCacheSyncHeaders(res);
      res.json({
        success: true,
        message: "Sincronizaci\xF3n con Google Sheets y Supabase completada con \xE9xito",
        sheetId,
        source: lastSheetSource,
        countVolumen: result.countVolumen,
        countActivacion: result.countActivacion,
        countMetas: result.countMetas,
        warningsCount: result.warningsCount,
        timestamp: lastSuccessfulSheetSyncAt || (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (err) {
      console.error("[SERVER] Error en /api/sync/sheets:", err);
      res.status(500).json({ success: false, error: "Error sincronizando datos de Google Sheets", details: err?.message });
    }
  });
  app2.get("/api/sync/status", authenticateToken, (req, res) => {
    setNoCacheSyncHeaders(res);
    res.json({
      success: true,
      sheetId: getGoogleSheetId(),
      lastSyncAt: lastSuccessfulSheetSyncAt || null,
      source: lastSheetSource,
      metrics: lastSheetMetrics,
      warningsCount: lastSheetWarnings.length,
      warnings: lastSheetWarnings.slice(0, 50)
    });
  });
  const normHist = (s) => String(s || "").replace(/Ã‘|Ã±/g, "N").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const normalizeHistRubroCode = (raw) => {
    const s = normHist(raw);
    if (!s) return null;
    if (s.includes("ACEITE")) return "ACEITE";
    if (s.includes("AZUCAR")) return "AZUCAR";
    if (s.includes("POLLO") || s.includes("ARROZ")) return "POLLO";
    if (s.includes("ESTANDAR") || s.includes("SUPERIOR") || s.includes("ENTERO")) return "ESTANDAR_ASTURIAS";
    if (s.includes("MORTADELA") || s.includes("SALPICAO") || s.includes("LIGEROS")) return "MORTADELA_SALPICAO";
    return null;
  };
  const histFail = (res, e) => {
    const msg = String(e?.message || e || "");
    if (/does not exist|schema cache|Could not find the (table|relation)/i.test(msg)) {
      return res.status(503).json({ error: "El historial a\xFAn no est\xE1 instalado en Supabase (ejecutar scripts/sql/ventas_historial.sql y cargar el CSV).", code: "NOT_INSTALLED" });
    }
    console.error("[HISTORIAL]", msg);
    return res.status(500).json({ error: "Error consultando el historial", details: msg });
  };
  async function histFetchAll(build) {
    const out = [];
    for (let from = 0; from < 3e5; from += 1e3) {
      const { data, error } = await build(from, from + 999);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      out.push(...data);
      if (data.length < 1e3) break;
    }
    return out;
  }
  let histVendorsCache = null;
  async function histGetVendorNames() {
    if (histVendorsCache && Date.now() - histVendorsCache.time < 3e5) return histVendorsCache.names;
    const rows = await histFetchAll((a, b) => supabase.from("hist_vendedores").select("vendedor").order("vendedor").range(a, b));
    const names = rows.map((r) => String(r.vendedor || "")).filter(Boolean);
    histVendorsCache = { names, time: Date.now() };
    return names;
  }
  let histCarteraCache = null;
  async function histGetCarteraVendorMap() {
    if (histCarteraCache && Date.now() - histCarteraCache.time < 3e5) return histCarteraCache.rows;
    const raw = await histFetchAll((a, b) => supabase.from("activacion_clientes").select("cliente_codigo,vendedor_nombre").order("id").range(a, b));
    const rows = raw.map((r) => ({
      cod: String(r.cliente_codigo || "").trim().replace(/^#/, "").replace(/^0+/, ""),
      vend: normHist(r.vendedor_nombre)
    })).filter((r) => r.cod && r.vend);
    histCarteraCache = { rows, time: Date.now() };
    return rows;
  }
  async function histResolveScope(req) {
    const user = req.user || {};
    const supProfile = getSupervisorProfile(user.username);
    const role = supProfile ? "SUPERVISOR" : String(user.role || "").toUpperCase();
    const q = String(req.query.vendedor || "").trim();
    const qU = q.toUpperCase();
    const known = await histGetVendorNames();
    const toNames = (aliases2) => {
      const set = new Set(aliases2.map(normHist));
      return known.filter((n) => set.has(normHist(n)));
    };
    const findRoute = (id) => {
      for (const p of Object.values(VENDOR_PROFILES)) {
        const r = p.routes.find((r2) => r2.id === id || r2.aliases.some((a) => normHist(a) === normHist(id)));
        if (r) return r;
      }
      return null;
    };
    const enrichNewVendorScope = async (names, aliases2, isSupervisorScope = false) => {
      if (names.length > 0) return { all: false, names, aliases: aliases2 };
      if (isSupervisorScope) {
        const supHistNames = toNames([...aliases2, "ALI PEREZ"]);
        return { all: false, names: supHistNames, aliases: aliases2 };
      }
      const aliasSet = new Set(aliases2);
      const carteraRows = await histGetCarteraVendorMap();
      const clientIds = /* @__PURE__ */ new Set();
      carteraRows.forEach((r) => {
        if (aliasSet.has(r.vend)) clientIds.add(r.cod);
      });
      if (clientIds.size > 0) {
        const aliHistNames = toNames(["ALI PEREZ", ...aliases2]);
        if (aliHistNames.length > 0) {
          return { all: false, names: aliHistNames, aliases: aliases2, clientIds };
        }
      }
      return { all: false, names, aliases: aliases2 };
    };
    if (role === "ADMIN") {
      if (!q || qU === "ADMIN" || qU === "TODOS" || qU === "TODOS LOS VENDEDORES") return { all: true, names: [], aliases: [] };
      if (qU.startsWith("SUPERVISOR:")) {
        const supName = q.slice("SUPERVISOR:".length);
        const supAliases = getSupervisedAliases(supName);
        return enrichNewVendorScope(toNames([...supAliases, supName]), supAliases.map(normHist), true);
      }
      if (qU.startsWith("CONSOLIDATED:")) {
        const prof = getVendorProfile(q.slice("CONSOLIDATED:".length));
        const aliases3 = prof.routes.flatMap((r2) => [r2.id, ...r2.aliases]).map(normHist);
        return enrichNewVendorScope(toNames(prof.routes.flatMap((r2) => r2.aliases)), aliases3);
      }
      const r = findRoute(q);
      const aliases2 = (r ? [r.id, ...r.aliases] : [q]).map(normHist);
      return enrichNewVendorScope(toNames(r ? r.aliases : [q]), aliases2);
    }
    if (role === "SUPERVISOR") {
      const mySup = supProfile || getSupervisorProfile(String(user.username || ""));
      const supName = mySup?.canonicalUsername || String(user.username || "");
      const allSupAliases = getSupervisedAliases(supName);
      if (!q || qU === "SUPERVISOR_ALL" || qU === "ALL_MY_ROUTES" || qU.startsWith("SUPERVISOR:")) {
        return enrichNewVendorScope(toNames([...allSupAliases, supName]), allSupAliases.map(normHist), true);
      }
      const targetVendor = q.replace(/^CONSOLIDATED:/i, "");
      const supRoutes = getSupervisedRoutes(supName);
      const matchedRoute = supRoutes.find((r) => r.id === targetVendor || r.aliases.some((a) => normHist(a) === normHist(targetVendor)));
      if (matchedRoute) {
        const aliases2 = [matchedRoute.id, ...matchedRoute.aliases].map(normHist);
        return enrichNewVendorScope(toNames(matchedRoute.aliases), aliases2);
      }
      if (mySup?.supervisedVendors.some((v) => normHist(v) === normHist(targetVendor))) {
        const prof = getVendorProfile(targetVendor);
        const aliases2 = prof.routes.flatMap((r) => [r.id, ...r.aliases]).map(normHist);
        return enrichNewVendorScope(toNames(prof.routes.flatMap((r) => r.aliases)), aliases2);
      }
      return enrichNewVendorScope(toNames([...allSupAliases, supName]), allSupAliases.map(normHist), true);
    }
    const profile = getVendorProfile(String(user.username || ""));
    let routes = profile.routes;
    if (q && qU !== "ALL_MY_ROUTES") {
      const mine = routes.find((r) => r.id === q || r.aliases.some((a) => normHist(a) === normHist(q)));
      if (mine) routes = [mine];
    }
    const aliases = routes.flatMap((r) => [r.id, ...r.aliases]).map(normHist);
    return enrichNewVendorScope(toNames(routes.flatMap((r) => r.aliases)), aliases);
  }
  const histCache = /* @__PURE__ */ new Map();
  const histCached = async (key, loader) => {
    const hit = histCache.get(key);
    if (hit && Date.now() - hit.time < 3e5) return hit.data;
    const data = await loader();
    if (histCache.size > 60) histCache.clear();
    histCache.set(key, { time: Date.now(), data });
    return data;
  };
  const scopeKey = (s) => s.all ? "ALL" : [...s.names, ...s.aliases || []].sort().join("|");
  const nz = (v) => Number(v) || 0;
  async function histLoadVolumen(scope) {
    return histCached("vol:" + scopeKey(scope), async () => {
      const merged = /* @__PURE__ */ new Map();
      const add = (r) => {
        const k = `${r.ano}|${r.mes}|${r.id_articulo}`;
        let m = merged.get(k);
        if (!m) {
          m = { ano: r.ano, mes: r.mes, sku: r.id_articulo, articulo: r.articulo, rubro: r.rubro, cajas: 0, unidades: 0, kgs: 0, monto: 0, clientes: 0 };
          merged.set(k, m);
        }
        m.cajas += nz(r.cajas);
        m.unidades += nz(r.unidades);
        m.kgs += nz(r.kgs);
        m.monto += nz(r.monto);
        m.clientes += nz(r.clientes);
      };
      if (scope.all) {
        const rows = await histFetchAll((a, b) => supabase.from("hist_volumen_total_mes").select("*").order("ano").order("mes").order("id_articulo").range(a, b));
        rows.forEach(add);
      } else if (scope.clientIds && scope.clientIds.size > 0) {
        const rawRows = await histFetchAll(
          (a, b) => supabase.from("ventas_historial").select("ano,mes,id_cliente,id_articulo,articulo,rubro,cajas,unidades,kgs,monto").in("vendedor", scope.names).order("ano").order("mes").order("id_articulo").order("id_cliente").range(a, b)
        );
        const cliSets = /* @__PURE__ */ new Map();
        rawRows.forEach((r) => {
          const cid = String(r.id_cliente || "").trim().replace(/^#/, "").replace(/^0+/, "");
          if (!scope.clientIds.has(cid)) return;
          const k = `${r.ano}|${r.mes}|${r.id_articulo}`;
          let m = merged.get(k);
          if (!m) {
            m = { ano: r.ano, mes: r.mes, sku: r.id_articulo, articulo: r.articulo, rubro: r.rubro, cajas: 0, unidades: 0, kgs: 0, monto: 0, clientes: 0 };
            merged.set(k, m);
          }
          m.cajas += nz(r.cajas);
          m.unidades += nz(r.unidades);
          m.kgs += nz(r.kgs);
          m.monto += nz(r.monto);
          if (nz(r.cajas) > 0 && cid) {
            let cs = cliSets.get(k);
            if (!cs) {
              cs = /* @__PURE__ */ new Set();
              cliSets.set(k, cs);
            }
            cs.add(cid);
          }
        });
        cliSets.forEach((cs, k) => {
          const m = merged.get(k);
          if (m) m.clientes = cs.size;
        });
      } else {
        const rows = await histFetchAll((a, b) => supabase.from("hist_volumen_mes").select("*").in("vendedor", scope.names).order("ano").order("mes").order("vendedor").order("id_articulo").range(a, b));
        rows.forEach(add);
      }
      return [...merged.values()].map((r) => ({ ...r, cajas: +r.cajas.toFixed(2), unidades: +r.unidades.toFixed(2), kgs: +r.kgs.toFixed(2), monto: +r.monto.toFixed(2) }));
    });
  }
  app2.get("/api/historial/meta", authenticateToken, async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const periodos = await histCached("periodos", () => histFetchAll((a, b) => supabase.from("hist_periodos").select("ano,mes").order("ano").order("mes").range(a, b)));
      res.json({ periodos });
    } catch (e) {
      histFail(res, e);
    }
  });
  app2.get("/api/historial/volumen", authenticateToken, async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const scope = await histResolveScope(req);
      if (!scope.all && scope.names.length === 0) return res.json({ rows: [] });
      res.json({ rows: await histLoadVolumen(scope) });
    } catch (e) {
      histFail(res, e);
    }
  });
  app2.get("/api/historial/rubros", authenticateToken, async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const scope = await histResolveScope(req);
      if (!scope.all && scope.names.length === 0) return res.json({ meses: [], cartera: 0 });
      const result = await histCached("rub:" + scopeKey(scope), async () => {
        const vol = await histLoadVolumen(scope);
        const meses = /* @__PURE__ */ new Map();
        const mesRow = (ano, mes) => {
          const k = `${ano}|${mes}`;
          let m = meses.get(k);
          if (!m) {
            m = { ano, mes, kgs: {}, cajas: {}, monto: {}, activos: { ACEITE: 0, AZUCAR: 0, POLLO: 0, ESTANDAR_ASTURIAS: 0, MORTADELA_SALPICAO: 0, TOTAL: 0 }, clientesConMovimiento: 0, fueraCartera: 0 };
            meses.set(k, m);
          }
          return m;
        };
        vol.forEach((r) => {
          const m = mesRow(r.ano, r.mes);
          m.kgs[r.rubro] = (m.kgs[r.rubro] || 0) + r.kgs;
          m.cajas[r.rubro] = (m.cajas[r.rubro] || 0) + r.cajas;
          m.monto[r.rubro] = (m.monto[r.rubro] || 0) + r.monto;
        });
        const cart = await histFetchAll((a, b) => supabase.from("activacion_clientes").select("cliente_codigo,vendedor_nombre").order("id").range(a, b));
        const allowed = /* @__PURE__ */ new Set([...scope.names.map(normHist), ...scope.aliases || []]);
        const seen = /* @__PURE__ */ new Set();
        cart.forEach((c) => {
          if (!scope.all && !allowed.has(normHist(c.vendedor_nombre))) return;
          seen.add(String(c.cliente_codigo || "").trim().replace(/^#/, "").replace(/^0+/, ""));
        });
        if (scope.clientIds && scope.clientIds.size > 0) {
          const clientRows = await histFetchAll(
            (a, b) => supabase.from("ventas_historial").select("ano,mes,id_cliente,rubro,cajas").in("vendedor", scope.names).order("ano").order("mes").order("id_cliente").order("id_articulo").range(a, b)
          );
          const byMesCliRub = /* @__PURE__ */ new Map();
          clientRows.forEach((r) => {
            const cid = String(r.id_cliente || "").trim().replace(/^#/, "").replace(/^0+/, "");
            if (!scope.clientIds.has(cid)) return;
            const mk = `${r.ano}|${r.mes}|${cid}`;
            let obj = byMesCliRub.get(mk);
            if (!obj) {
              obj = {};
              byMesCliRub.set(mk, obj);
            }
            obj[r.rubro] = (obj[r.rubro] || 0) + nz(r.cajas);
            obj._ANY = (obj._ANY || 0) + nz(r.cajas);
          });
          byMesCliRub.forEach((obj, mk) => {
            const [anoS, mesS] = mk.split("|");
            const m = mesRow(Number(anoS), Number(mesS));
            let anyKeyRub = false;
            for (const rub of ["ACEITE", "AZUCAR", "POLLO", "ESTANDAR_ASTURIAS", "MORTADELA_SALPICAO"]) {
              if ((obj[rub] || 0) > 0) {
                m.activos[rub] = (m.activos[rub] || 0) + 1;
                anyKeyRub = true;
              }
            }
            if (anyKeyRub) m.activos.TOTAL += 1;
            if ((obj._ANY || 0) > 0) m.clientesConMovimiento += 1;
          });
        } else {
          const resumen = await histFetchAll((a, b) => {
            let q = supabase.from("hist_activacion_resumen_mes").select("*");
            if (!scope.all) q = q.in("vendedor", scope.names);
            return q.order("ano").order("mes").order("vendedor").range(a, b);
          });
          resumen.forEach((r) => {
            const m = mesRow(r.ano, r.mes);
            m.activos.ACEITE += nz(r.act_aceite);
            m.activos.AZUCAR += nz(r.act_azucar);
            m.activos.POLLO += nz(r.act_pollo);
            m.activos.ESTANDAR_ASTURIAS += nz(r.act_estandar_asturias);
            m.activos.MORTADELA_SALPICAO += nz(r.act_mortadela_salpicao);
            m.activos.TOTAL += nz(r.act_total ?? r.clientes_con_compra);
            m.clientesConMovimiento += nz(r.clientes_con_movimiento ?? r.clientes_con_compra);
            m.fueraCartera += nz(r.clientes_fuera_cartera);
          });
          const needsEmFix = [...meses.values()].every(
            (m) => m.activos.ESTANDAR_ASTURIAS === 0 && m.activos.MORTADELA_SALPICAO === 0 && ((m.cajas.ESTANDAR_ASTURIAS || 0) > 0 || (m.cajas.MORTADELA_SALPICAO || 0) > 0)
          );
          if (needsEmFix) {
            const emRows = await histFetchAll((a, b) => {
              let q = supabase.from("ventas_historial").select("ano,mes,id_cliente,rubro,cajas").in("rubro", ["ESTANDAR_ASTURIAS", "MORTADELA_SALPICAO"]);
              if (!scope.all) q = q.in("vendedor", scope.names);
              return q.order("ano").order("mes").order("id_cliente").order("id_articulo").range(a, b);
            });
            const byMesRubCli = /* @__PURE__ */ new Map();
            emRows.forEach((r) => {
              const k = `${r.ano}|${r.mes}|${r.rubro}|${String(r.id_cliente || "").replace(/^0+/, "")}`;
              byMesRubCli.set(k, (byMesRubCli.get(k) || 0) + nz(r.cajas));
            });
            byMesRubCli.forEach((cajasSum, key) => {
              if (cajasSum <= 0) return;
              const [anoS, mesS, rub] = key.split("|");
              const m = mesRow(Number(anoS), Number(mesS));
              if (rub === "ESTANDAR_ASTURIAS" || rub === "MORTADELA_SALPICAO") {
                m.activos[rub] = (m.activos[rub] || 0) + 1;
              }
            });
          }
        }
        return {
          meses: [...meses.values()].sort((a, b) => a.ano - b.ano || a.mes - b.mes),
          cartera: seen.size
        };
      });
      res.json(result);
    } catch (e) {
      histFail(res, e);
    }
  });
  app2.get("/api/historial/clientes", authenticateToken, async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const ano = parseInt(String(req.query.ano), 10);
      const mes = parseInt(String(req.query.mes), 10);
      if (!ano || !mes || mes < 1 || mes > 12) return res.status(400).json({ error: "ano y mes son requeridos" });
      const scope = await histResolveScope(req);
      if (!scope.all && scope.names.length === 0) return res.json({ rows: [] });
      const rows = await histCached(`cli:${ano}:${mes}:${scopeKey(scope)}`, async () => {
        const [data, emData, cart] = await Promise.all([
          histFetchAll((a, b) => {
            let q = supabase.from("hist_activacion_cliente_mes").select("*").eq("ano", ano).eq("mes", mes);
            if (!scope.all) q = q.in("vendedor", scope.names);
            return q.order("id_cliente").range(a, b);
          }),
          histFetchAll((a, b) => {
            let q = supabase.from("ventas_historial").select("id_cliente,rubro,cajas").eq("ano", ano).eq("mes", mes).in("rubro", ["ESTANDAR_ASTURIAS", "MORTADELA_SALPICAO"]);
            if (!scope.all) q = q.in("vendedor", scope.names);
            return q.order("id_cliente").order("id_articulo").range(a, b);
          }),
          histFetchAll((a, b) => supabase.from("activacion_clientes").select("cliente_codigo,vendedor_nombre").order("id").range(a, b))
        ]);
        const allowed = /* @__PURE__ */ new Set([...scope.names.map(normHist), ...scope.aliases || []]);
        const carteraSet = /* @__PURE__ */ new Set();
        cart.forEach((c) => {
          if (!scope.all && !allowed.has(normHist(c.vendedor_nombre))) return;
          carteraSet.add(String(c.cliente_codigo || "").trim().replace(/^#/, "").replace(/^0+/, ""));
        });
        const emByClient = /* @__PURE__ */ new Map();
        emData.forEach((r) => {
          const cid = String(r.id_cliente || "").trim().replace(/^#/, "").replace(/^0+/, "");
          if (scope.clientIds && scope.clientIds.size > 0 && !scope.clientIds.has(cid)) return;
          let cur = emByClient.get(cid);
          if (!cur) {
            cur = { ESTANDAR_ASTURIAS: 0, MORTADELA_SALPICAO: 0 };
            emByClient.set(cid, cur);
          }
          if (r.rubro === "ESTANDAR_ASTURIAS") cur.ESTANDAR_ASTURIAS += nz(r.cajas);
          if (r.rubro === "MORTADELA_SALPICAO") cur.MORTADELA_SALPICAO += nz(r.cajas);
        });
        const filteredData = scope.clientIds && scope.clientIds.size > 0 ? data.filter((r) => scope.clientIds.has(String(r.id_cliente || "").trim().replace(/^#/, "").replace(/^0+/, ""))) : data;
        return filteredData.map((r) => {
          const cid = String(r.id_cliente || "").trim().replace(/^#/, "").replace(/^0+/, "");
          const em = emByClient.get(cid);
          return {
            id: r.id_cliente,
            cliente: r.cliente,
            vendedor: r.vendedor,
            enCartera: r.en_cartera !== void 0 ? !!r.en_cartera : carteraSet.has(cid),
            cajas: {
              ACEITE: nz(r.cajas_aceite),
              AZUCAR: nz(r.cajas_azucar),
              POLLO: nz(r.cajas_pollo),
              ESTANDAR_ASTURIAS: nz(r.cajas_estandar_asturias) || +(em?.ESTANDAR_ASTURIAS || 0).toFixed(2),
              MORTADELA_SALPICAO: nz(r.cajas_mortadela_salpicao) || +(em?.MORTADELA_SALPICAO || 0).toFixed(2)
            },
            kgs: nz(r.kgs ?? r.kgs_total),
            monto: nz(r.monto ?? r.monto_total)
          };
        });
      });
      res.json({ rows });
    } catch (e) {
      histFail(res, e);
    }
  });
  app2.get("/api/historial/cliente/:id", authenticateToken, async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const rawId = String(req.params.id || "").trim().replace(/^#/, "");
      const id = rawId.replace(/^0+/, "");
      if (!/^[A-Za-z0-9._-]{1,24}$/.test(id)) return res.status(400).json({ error: "C\xF3digo de cliente inv\xE1lido" });
      const candidateIds = Array.from(/* @__PURE__ */ new Set([rawId, id, id.padStart(6, "0"), id.padStart(5, "0"), id.padStart(4, "0")])).filter(Boolean);
      const scope = await histResolveScope(req);
      if (!scope.all && scope.names.length === 0) return res.status(404).json({ error: "Sin acceso" });
      if (scope.clientIds && scope.clientIds.size > 0 && !scope.clientIds.has(id)) {
        return res.json({ meses: [], productos: [] });
      }
      const meses = await histFetchAll((a, b) => {
        let q = supabase.from("hist_activacion_cliente_mes").select("*").in("id_cliente", candidateIds);
        if (!scope.all) q = q.in("vendedor", scope.names);
        return q.order("ano").order("mes").range(a, b);
      });
      if (meses.length === 0) return res.json({ meses: [], productos: [] });
      const prods = await histFetchAll((a, b) => {
        let q = supabase.from("ventas_historial").select("ano,mes,id_articulo,articulo,rubro,cajas,kgs,monto").in("id_cliente", candidateIds);
        if (!scope.all) q = q.in("vendedor", scope.names);
        return q.order("ano").order("mes").order("id_articulo").range(a, b);
      });
      const pm = /* @__PURE__ */ new Map();
      const cajasByMesRubro = /* @__PURE__ */ new Map();
      prods.forEach((r) => {
        const k = `${r.ano}|${r.mes}|${r.id_articulo}`;
        let m = pm.get(k);
        if (!m) {
          m = { ano: r.ano, mes: r.mes, sku: r.id_articulo, articulo: r.articulo, rubro: r.rubro, cajas: 0, kgs: 0, monto: 0 };
          pm.set(k, m);
        }
        m.cajas += nz(r.cajas);
        m.kgs += nz(r.kgs);
        m.monto += nz(r.monto);
        const mk = `${r.ano}|${r.mes}`;
        let cm = cajasByMesRubro.get(mk);
        if (!cm) {
          cm = {};
          cajasByMesRubro.set(mk, cm);
        }
        cm[r.rubro] = (cm[r.rubro] || 0) + nz(r.cajas);
      });
      res.json({
        meses: meses.map((r) => {
          const cm = cajasByMesRubro.get(`${r.ano}|${r.mes}`) || {};
          return {
            ano: r.ano,
            mes: r.mes,
            cliente: r.cliente,
            vendedor: r.vendedor,
            cajas: {
              ACEITE: nz(r.cajas_aceite) || +(cm.ACEITE || 0).toFixed(2),
              AZUCAR: nz(r.cajas_azucar) || +(cm.AZUCAR || 0).toFixed(2),
              POLLO: nz(r.cajas_pollo) || +(cm.POLLO || 0).toFixed(2),
              ESTANDAR_ASTURIAS: nz(r.cajas_estandar_asturias) || +(cm.ESTANDAR_ASTURIAS || 0).toFixed(2),
              MORTADELA_SALPICAO: nz(r.cajas_mortadela_salpicao) || +(cm.MORTADELA_SALPICAO || 0).toFixed(2)
            },
            kgs: nz(r.kgs ?? r.kgs_total),
            monto: nz(r.monto ?? r.monto_total)
          };
        }),
        productos: [...pm.values()].map((p) => ({ ...p, cajas: +p.cajas.toFixed(2), kgs: +p.kgs.toFixed(2), monto: +p.monto.toFixed(2) }))
      });
    } catch (e) {
      histFail(res, e);
    }
  });
  app2.get("/api/historial/rubro-360", authenticateToken, async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const rubroCode = normalizeHistRubroCode(req.query.rubro);
      if (!rubroCode) {
        return res.status(400).json({ error: "Rubro inv\xE1lido o no especificado" });
      }
      const scope = await histResolveScope(req);
      if (!scope.all && scope.names.length === 0) {
        return res.json({
          rubro: rubroCode,
          periodos: [],
          carteraTotal: 0,
          activadosMesActual: 0,
          metaMesActual: 0,
          periodoMetaActual: null,
          metasPorMes: [],
          periodosDisponibles: [],
          meses: [],
          skus: [],
          clientes: [],
          resumen: {
            totalMeses: 0,
            promedioClientesMes: 0,
            promedioCajasMes: 0,
            promedioKgsMes: 0,
            mejorMes: null,
            peorMes: null,
            totalCajasHistorico: 0,
            totalKgsHistorico: 0,
            clientesUnicosHistorico: 0,
            clientesHabituales: 0,
            oportunidadRecuperacion: 0,
            reactivadosEsteMes: 0,
            nuevosEsteMes: 0
          }
        });
      }
      const mesesFiltro = (() => {
        const raw = String(req.query.meses || "").trim();
        if (!raw) return null;
        if (raw === "none") return /* @__PURE__ */ new Set();
        const set = /* @__PURE__ */ new Set();
        raw.split(",").forEach((tok) => {
          const m = tok.trim().match(/^(\d{4})-(\d{1,2})$/);
          if (m) set.add(`${Number(m[1])}-${Number(m[2])}`);
        });
        return set.size > 0 ? set : null;
      })();
      const filtroKey = mesesFiltro ? [...mesesFiltro].sort().join(",") : "ALL";
      const base = await histCached(`rub360base:${rubroCode}:${scopeKey(scope)}`, async () => {
        const [periodos, rawRows, cart, metas] = await Promise.all([
          histCached(
            "periodos",
            () => histFetchAll((a, b) => supabase.from("hist_periodos").select("ano,mes").order("ano").order("mes").range(a, b))
          ),
          histFetchAll((a, b) => {
            let q = supabase.from("ventas_historial").select("ano,mes,id_cliente,cliente,vendedor,id_articulo,articulo,cajas,unidades,kgs").eq("rubro", rubroCode);
            if (!scope.all) q = q.in("vendedor", scope.names);
            return q.order("ano").order("mes").order("id_cliente").order("id_articulo").range(a, b);
          }),
          histFetchAll(
            (a, b) => supabase.from("activacion_clientes").select("*").order("id").range(a, b)
          ),
          histFetchAll(
            (a, b) => supabase.from("metas_activacion").select("*").order("id").range(a, b)
          )
        ]);
        const rows = scope.clientIds && scope.clientIds.size > 0 ? rawRows.filter((r) => scope.clientIds.has(String(r.id_cliente || "").trim().replace(/^#/, "").replace(/^0+/, ""))) : rawRows;
        return { periodos, rows, cart, metas };
      });
      const result = await histCached(`rub360:${rubroCode}:${scopeKey(scope)}:${filtroKey}`, async () => {
        const { periodos, cart, metas } = base;
        const rows = mesesFiltro ? base.rows.filter((r) => mesesFiltro.has(`${r.ano}-${r.mes}`)) : base.rows;
        const allowed = new Set(scope.aliases && scope.aliases.length > 0 ? scope.aliases : scope.names.map(normHist));
        const isClientActiveInRubro = (c, rub) => {
          switch (rub) {
            case "ACEITE":
              return !!c.has_aceite || nz(c.cajas_aceite) > 0;
            case "AZUCAR":
              return !!c.has_azucar || nz(c.cajas_azucar) > 0;
            case "POLLO":
              return !!c.has_pollo || nz(c.cajas_pollo) > 0;
            case "ESTANDAR_ASTURIAS":
              return !!c.has_estandar_asturias || nz(c.cajas_estandar_asturias) > 0;
            case "MORTADELA_SALPICAO":
              return !!c.has_mortadela_salpicao || nz(c.cajas_mortadela_salpicao) > 0;
            default:
              return false;
          }
        };
        const carteraMap = /* @__PURE__ */ new Map();
        cart.forEach((c) => {
          if (!scope.all && !allowed.has(normHist(c.vendedor_nombre))) return;
          const normId = String(c.cliente_codigo || "").trim().replace(/^#/, "").replace(/^0+/, "");
          if (!normId) return;
          const activoActual = isClientActiveInRubro(c, rubroCode);
          const prev = carteraMap.get(normId);
          carteraMap.set(normId, {
            rawId: String(c.cliente_codigo || normId).trim(),
            nombre: String(c.cliente_nombre || prev?.nombre || "").trim(),
            vendedor: String(c.vendedor_nombre || prev?.vendedor || "").trim(),
            activoActual: prev ? prev.activoActual || activoActual : activoActual
          });
        });
        const carteraTotal = carteraMap.size;
        const activadosClientesActual = [...carteraMap.values()].filter((c) => c.activoActual).length;
        const aliasSet = new Set(scope.aliases || []);
        const metasPeriodoMap = /* @__PURE__ */ new Map();
        metas.forEach((m) => {
          if (!scope.all && !aliasSet.has(normHist(m.vendedor_id))) return;
          if (normalizeHistRubroCode(m.categoria) !== rubroCode) return;
          const per = String(m.periodo || "");
          if (!/^\d{4}-\d{2}$/.test(per)) return;
          const cur = metasPeriodoMap.get(per) || { meta: 0, activados: 0 };
          cur.meta += nz(m.meta);
          cur.activados += nz(m.activados);
          metasPeriodoMap.set(per, cur);
        });
        const metasPorMes = [...metasPeriodoMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([periodo, v]) => ({ periodo, ano: Number(periodo.slice(0, 4)), mes: Number(periodo.slice(5, 7)), meta: v.meta, activados: v.activados }));
        const periodoMetaActual = metasPorMes.length > 0 ? metasPorMes[metasPorMes.length - 1].periodo : null;
        const metaActualRow = metasPorMes.length > 0 ? metasPorMes[metasPorMes.length - 1] : null;
        const metaMesActual = metaActualRow ? metaActualRow.meta : 0;
        const activadosGridActual = metaActualRow ? metaActualRow.activados : 0;
        const activadosMesActual = activadosGridActual > 0 ? activadosGridActual : activadosClientesActual;
        const periodosDisponibles = [...periodos].sort((a, b) => a.ano - b.ano || a.mes - b.mes);
        const sortedPeriodos = mesesFiltro ? periodosDisponibles.filter((p) => mesesFiltro.has(`${p.ano}-${p.mes}`)) : periodosDisponibles;
        const mesAggMap = /* @__PURE__ */ new Map();
        sortedPeriodos.forEach((p) => {
          mesAggMap.set(`${p.ano}-${p.mes}`, {
            ano: p.ano,
            mes: p.mes,
            clientCajas: /* @__PURE__ */ new Map(),
            skusSet: /* @__PURE__ */ new Set(),
            cajas: 0,
            unidades: 0,
            kgs: 0
          });
        });
        const skuAggMap = /* @__PURE__ */ new Map();
        const cliAggMap = /* @__PURE__ */ new Map();
        carteraMap.forEach((cInfo, normId) => {
          cliAggMap.set(normId, {
            id: cInfo.rawId.padStart(6, "0"),
            cliente: cInfo.nombre,
            vendedor: cInfo.vendedor,
            totalCajas: 0,
            totalKgs: 0,
            porMes: /* @__PURE__ */ new Map()
          });
        });
        rows.forEach((r) => {
          const pKey = `${r.ano}-${r.mes}`;
          let mAgg = mesAggMap.get(pKey);
          if (!mAgg) {
            mAgg = { ano: r.ano, mes: r.mes, clientCajas: /* @__PURE__ */ new Map(), skusSet: /* @__PURE__ */ new Set(), cajas: 0, unidades: 0, kgs: 0 };
            mesAggMap.set(pKey, mAgg);
          }
          const normCid = String(r.id_cliente || "").trim().replace(/^#/, "").replace(/^0+/, "");
          const cajas = nz(r.cajas);
          const unidades = nz(r.unidades);
          const kgs = nz(r.kgs);
          const sku = String(r.id_articulo || "").trim();
          mAgg.cajas += cajas;
          mAgg.unidades += unidades;
          mAgg.kgs += kgs;
          if (normCid) {
            mAgg.clientCajas.set(normCid, (mAgg.clientCajas.get(normCid) || 0) + cajas);
          }
          if (sku && cajas > 0) {
            mAgg.skusSet.add(sku);
          }
          if (sku) {
            let sAgg = skuAggMap.get(sku);
            if (!sAgg) {
              sAgg = {
                sku,
                articulo: String(r.articulo || sku).trim(),
                totalCajas: 0,
                totalUnidades: 0,
                totalKgs: 0,
                allClients: /* @__PURE__ */ new Map(),
                porMes: /* @__PURE__ */ new Map()
              };
              skuAggMap.set(sku, sAgg);
            }
            sAgg.totalCajas += cajas;
            sAgg.totalUnidades += unidades;
            sAgg.totalKgs += kgs;
            if (normCid) {
              sAgg.allClients.set(normCid, (sAgg.allClients.get(normCid) || 0) + cajas);
            }
            let sm = sAgg.porMes.get(pKey);
            if (!sm) {
              sm = { cajas: 0, kgs: 0, clientCajas: /* @__PURE__ */ new Map() };
              sAgg.porMes.set(pKey, sm);
            }
            sm.cajas += cajas;
            sm.kgs += kgs;
            if (normCid) {
              sm.clientCajas.set(normCid, (sm.clientCajas.get(normCid) || 0) + cajas);
            }
          }
          if (normCid) {
            let cAgg = cliAggMap.get(normCid);
            if (!cAgg) {
              cAgg = {
                id: String(r.id_cliente || normCid).trim(),
                cliente: String(r.cliente || "").trim(),
                vendedor: String(r.vendedor || "").trim(),
                totalCajas: 0,
                totalKgs: 0,
                porMes: /* @__PURE__ */ new Map()
              };
              cliAggMap.set(normCid, cAgg);
            } else {
              if (!cAgg.cliente && r.cliente) cAgg.cliente = String(r.cliente).trim();
              if (!cAgg.vendedor && r.vendedor) cAgg.vendedor = String(r.vendedor).trim();
            }
            cAgg.totalCajas += cajas;
            cAgg.totalKgs += kgs;
            let cm = cAgg.porMes.get(pKey);
            if (!cm) {
              cm = { cajas: 0, kgs: 0 };
              cAgg.porMes.set(pKey, cm);
            }
            cm.cajas += cajas;
            cm.kgs += kgs;
          }
        });
        const mesesList = [];
        const orderedMesAggs = [...mesAggMap.values()].sort((a, b) => a.ano - b.ano || a.mes - b.mes);
        orderedMesAggs.forEach((mAgg, idx) => {
          let clientesActivados = 0;
          let clientesEnCartera = 0;
          let clientesFueraCartera = 0;
          mAgg.clientCajas.forEach((netCajas, cid) => {
            if (netCajas > 0) {
              clientesActivados++;
              if (carteraMap.has(cid)) clientesEnCartera++;
              else clientesFueraCartera++;
            }
          });
          const prevCand = idx > 0 ? mesesList[idx - 1] : null;
          const prev = prevCand && mAgg.ano * 12 + mAgg.mes - (prevCand.ano * 12 + prevCand.mes) === 1 ? prevCand : null;
          const variacionClientes = prev !== null ? clientesActivados - prev.clientesActivados : null;
          const variacionPct = prev !== null && prev.clientesActivados > 0 ? +((clientesActivados - prev.clientesActivados) / prev.clientesActivados * 100).toFixed(1) : null;
          const porcentajeCartera = carteraTotal > 0 ? +(clientesActivados / carteraTotal * 100).toFixed(1) : 0;
          const metaReg = metasPeriodoMap.get(`${mAgg.ano}-${String(mAgg.mes).padStart(2, "0")}`);
          mesesList.push({
            ano: mAgg.ano,
            mes: mAgg.mes,
            clientesActivados,
            clientesEnCartera,
            clientesFueraCartera,
            porcentajeCartera,
            variacionClientes,
            variacionPct,
            cajas: +mAgg.cajas.toFixed(2),
            unidades: +mAgg.unidades.toFixed(2),
            kgs: +mAgg.kgs.toFixed(2),
            skusActivos: mAgg.skusSet.size,
            kgsPorCliente: clientesActivados > 0 ? +(mAgg.kgs / clientesActivados).toFixed(2) : 0,
            meta: metaReg ? metaReg.meta : null
          });
        });
        const skusList = [...skuAggMap.values()].map((s) => {
          const porMesObj = {};
          let mesesActivos = 0;
          s.porMes.forEach((sm, pk) => {
            let cliAct = 0;
            sm.clientCajas.forEach((c) => {
              if (c > 0) cliAct++;
            });
            if (sm.cajas > 0) mesesActivos++;
            porMesObj[pk] = {
              cajas: +sm.cajas.toFixed(2),
              kgs: +sm.kgs.toFixed(2),
              clientes: cliAct
            };
          });
          let clientesUnicos = 0;
          s.allClients.forEach((c) => {
            if (c > 0) clientesUnicos++;
          });
          return {
            sku: s.sku,
            articulo: s.articulo,
            totalCajas: +s.totalCajas.toFixed(2),
            totalUnidades: +s.totalUnidades.toFixed(2),
            totalKgs: +s.totalKgs.toFixed(2),
            clientesUnicos,
            mesesActivos,
            porMes: porMesObj
          };
        }).sort((a, b) => b.totalKgs - a.totalKgs || b.totalCajas - a.totalCajas);
        const totalMesesDisponibles = mesesList.length || 1;
        let clientesUnicosHistorico = 0;
        let clientesHabituales = 0;
        let oportunidadRecuperacion = 0;
        let reactivadosEsteMes = 0;
        let nuevosEsteMes = 0;
        const allClientesList = [...cliAggMap.entries()].map(([normId, c]) => {
          const cartInfo = carteraMap.get(normId);
          const enCartera = !!cartInfo;
          const activoMesActual = !!cartInfo?.activoActual;
          const porMesObj = {};
          let mesesActivados = 0;
          let ultimoMesCompra = null;
          orderedMesAggs.forEach((mAgg) => {
            const pk = `${mAgg.ano}-${mAgg.mes}`;
            const cm = c.porMes.get(pk);
            const cajas = cm ? +cm.cajas.toFixed(2) : 0;
            const kgs = cm ? +cm.kgs.toFixed(2) : 0;
            const activo = cajas > 0;
            if (activo) {
              mesesActivados++;
              ultimoMesCompra = { ano: mAgg.ano, mes: mAgg.mes };
            }
            if (cajas !== 0 || kgs !== 0) {
              porMesObj[pk] = { cajas, kgs, activo };
            }
          });
          if (mesesActivados > 0) clientesUnicosHistorico++;
          if (mesesActivados >= Math.max(1, Math.min(3, totalMesesDisponibles))) clientesHabituales++;
          let estado360;
          if (mesesActivados > 0 && activoMesActual) {
            estado360 = "REACTIVADO_ESTE_MES";
            reactivadosEsteMes++;
          } else if (mesesActivados === 0 && activoMesActual) {
            estado360 = "NUEVO_ESTE_MES";
            nuevosEsteMes++;
          } else if (mesesActivados > 0 && !activoMesActual && enCartera) {
            estado360 = "OPORTUNIDAD_RECUPERACION";
            oportunidadRecuperacion++;
          } else if (!enCartera) {
            estado360 = "FUERA_CARTERA";
          } else {
            estado360 = "SIN_HISTORIAL";
          }
          return {
            id: c.id,
            cliente: c.cliente,
            vendedor: c.vendedor,
            enCartera,
            activoMesActual,
            mesesActivados,
            totalMesesDisponibles,
            frecuenciaPct: +(mesesActivados / totalMesesDisponibles * 100).toFixed(0),
            ultimoMesCompra,
            totalCajas: +c.totalCajas.toFixed(2),
            totalKgs: +c.totalKgs.toFixed(2),
            estado360,
            porMes: porMesObj
          };
        });
        const estadoPriority = {
          OPORTUNIDAD_RECUPERACION: 1,
          REACTIVADO_ESTE_MES: 2,
          NUEVO_ESTE_MES: 3,
          FUERA_CARTERA: 4,
          SIN_HISTORIAL: 5
        };
        allClientesList.sort(
          (a, b) => (estadoPriority[a.estado360] || 9) - (estadoPriority[b.estado360] || 9) || b.mesesActivados - a.mesesActivados || b.totalKgs - a.totalKgs
        );
        const clientesList = scope.all ? allClientesList.filter((c, i) => c.mesesActivados > 0 || c.activoMesActual || i < 600) : allClientesList;
        const totalCajasHistorico = +mesesList.reduce((acc, m) => acc + m.cajas, 0).toFixed(2);
        const totalKgsHistorico = +mesesList.reduce((acc, m) => acc + m.kgs, 0).toFixed(2);
        const nMeses = mesesList.length || 1;
        const promedioClientesMes = +(mesesList.reduce((acc, m) => acc + m.clientesActivados, 0) / nMeses).toFixed(1);
        const promedioCajasMes = +(totalCajasHistorico / nMeses).toFixed(1);
        const promedioKgsMes = +(totalKgsHistorico / nMeses).toFixed(1);
        const sortedByCli = [...mesesList].sort((a, b) => b.clientesActivados - a.clientesActivados || b.kgs - a.kgs);
        const mejorMes = sortedByCli.length > 0 ? sortedByCli[0] : null;
        const peorMes = sortedByCli.length > 0 ? sortedByCli[sortedByCli.length - 1] : null;
        return {
          rubro: rubroCode,
          periodos: sortedPeriodos,
          periodosDisponibles,
          carteraTotal,
          activadosMesActual,
          metaMesActual,
          periodoMetaActual,
          metasPorMes,
          meses: mesesList,
          skus: skusList,
          clientes: clientesList,
          resumen: {
            totalMeses: mesesList.length,
            promedioClientesMes,
            promedioCajasMes,
            promedioKgsMes,
            mejorMes: mejorMes ? { ano: mejorMes.ano, mes: mejorMes.mes, clientesActivados: mejorMes.clientesActivados, kgs: mejorMes.kgs, cajas: mejorMes.cajas } : null,
            peorMes: peorMes ? { ano: peorMes.ano, mes: peorMes.mes, clientesActivados: peorMes.clientesActivados, kgs: peorMes.kgs, cajas: peorMes.cajas } : null,
            totalCajasHistorico,
            totalKgsHistorico,
            clientesUnicosHistorico,
            clientesHabituales,
            oportunidadRecuperacion,
            reactivadosEsteMes,
            nuevosEsteMes
          }
        };
      });
      res.json(result);
    } catch (e) {
      histFail(res, e);
    }
  });
  const hydrateParsedCachesFromWorkbookFallback = async () => {
    const workbook = await getWorkbook(false);
    const XLSX = await import("xlsx");
    const parsed = parseWorkbookFull(XLSX, workbook, {
      periodo: metasPeriodoActual(),
      masterClients: loadLocalMasterClientSeed()
    });
    cachedVolumenParsed = parsed.volumenApiRows;
    lastVolumenParsedTime = Date.now();
    cachedActivacionParsed = parsed.activacionApiRows;
    lastActivacionParsedTime = Date.now();
    cachedMetasParsed = parsed.metasApiRows;
    lastMetasParsedTime = Date.now();
    lastSheetMetrics = parsed.metrics;
    lastSheetWarnings = parsed.warnings;
    return parsed;
  };
  const resolveDataFilter = (user, queryVendedor) => {
    const supProfile = getSupervisorProfile(user?.username);
    const effectiveRole = supProfile ? "SUPERVISOR" : String(user?.role || "").toUpperCase();
    const rawQuery = String(queryVendedor || "").trim();
    const rawUpper = rawQuery.toUpperCase();
    if (effectiveRole === "SUPERVISOR") {
      const supName = supProfile?.canonicalUsername || String(user?.username || "").toUpperCase().trim();
      if (!rawUpper || rawUpper === "SUPERVISOR_ALL" || rawUpper === "ALL_MY_ROUTES" || rawUpper.startsWith("SUPERVISOR:")) {
        return {
          vendorFilter: `SUPERVISOR:${supName}`,
          allowedAliases: getSupervisedAliases(supName)
        };
      }
      const target = rawUpper.replace(/^CONSOLIDATED:/i, "").trim();
      const supRoutes = getSupervisedRoutes(supName);
      const matchedRoute = supRoutes.find((r) => matchesVendorAlias([r.id, ...r.aliases], target));
      if (matchedRoute) {
        return {
          vendorFilter: matchedRoute.id,
          allowedAliases: [matchedRoute.id, ...matchedRoute.aliases]
        };
      }
      if (supProfile?.supervisedVendors.some((v) => matchesVendorAlias([v], target))) {
        const prof2 = getVendorProfile(target);
        return {
          vendorFilter: target,
          allowedAliases: prof2.routes.flatMap((r) => [r.id, ...r.aliases, prof2.canonicalUsername, prof2.displayName])
        };
      }
      return {
        vendorFilter: `SUPERVISOR:${supName}`,
        allowedAliases: getSupervisedAliases(supName)
      };
    }
    if (effectiveRole === "VENDEDOR") {
      const prof2 = getVendorProfile(user?.username || "");
      return {
        vendorFilter: (user?.username || "").toUpperCase().trim(),
        allowedAliases: prof2.routes.flatMap((r) => [r.id, ...r.aliases, prof2.canonicalUsername, prof2.displayName])
      };
    }
    if (!rawUpper || rawUpper === "ADMIN" || rawUpper === "TODOS" || rawUpper === "ALL_MY_ROUTES") {
      return { vendorFilter: null, allowedAliases: [] };
    }
    if (rawUpper.startsWith("SUPERVISOR:")) {
      const supName = rawUpper.slice("SUPERVISOR:".length).trim();
      return {
        vendorFilter: rawUpper,
        allowedAliases: getSupervisedAliases(supName)
      };
    }
    const cleanParam = rawUpper.replace(/^CONSOLIDATED:/i, "").trim();
    const prof = getVendorProfile(cleanParam);
    return {
      vendorFilter: cleanParam,
      allowedAliases: prof.routes.flatMap((r) => [r.id, ...r.aliases, prof.canonicalUsername, prof.displayName])
    };
  };
  app2.get("/api/data/volumen", authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      const force = req.query.force === "true";
      const { vendorFilter, allowedAliases } = resolveDataFilter(user, req.query.vendedor);
      const filterByVendor = (list) => {
        const nonSupervisorList = list.filter((d) => !SUPERVISOR_SUMMARY_COLUMNS.has(String(d.vendedorId || "").toUpperCase().trim()));
        if (!vendorFilter || vendorFilter === "ADMIN" || vendorFilter === "TODOS") return nonSupervisorList;
        return nonSupervisorList.filter((d) => {
          const vNombre = (d.vendedorNombre || "").toUpperCase();
          const vId = (d.vendedorId || "").toUpperCase();
          if (matchesVendorAlias([vendorFilter, ...allowedAliases], vId) || matchesVendorAlias([vendorFilter, ...allowedAliases], vNombre)) {
            return true;
          }
          if (vendorFilter && !vendorFilter.startsWith("SUPERVISOR:") && !/^\d+$/.test(vendorFilter)) {
            if (vNombre.includes(vendorFilter) || vId.includes(vendorFilter)) return true;
          }
          return allowedAliases.some((a) => {
            const aU = a.toUpperCase();
            return vNombre.includes(aU) || vId.includes(aU) || aU.includes(vNombre) || aU.includes(vId);
          });
        });
      };
      if (force) {
        await runCoalescedSheetsSync(false);
        setNoCacheSyncHeaders(res);
        return res.json(filterByVendor(cachedVolumenParsed || []));
      }
      if (cachedVolumenParsed && Date.now() - lastVolumenParsedTime < PARSED_DATA_TTL) {
        setNoCacheSyncHeaders(res, "memory");
        return res.json(filterByVendor(cachedVolumenParsed));
      }
      if (supabase) {
        try {
          let supaRows = [];
          let from = 0;
          const pageSize = 1e3;
          while (from < 1e4) {
            const { data, error } = await supabase.from("ventas_volumen").select("*").eq("periodo", metasPeriodoActual()).order("id").range(from, from + pageSize - 1);
            if (error || !data || data.length === 0) break;
            supaRows.push(...data);
            if (data.length < pageSize) break;
            from += pageSize;
          }
          if (Array.isArray(supaRows) && supaRows.length > 0) {
            const mapped = supaRows.map((r) => {
              const metaKg = Number(r.meta_kg) || 0;
              const ejecutadoKg = Number(r.ejecutado_kg) || 0;
              return {
                id: String(r.id),
                sku: r.sku,
                skuId: r.sku,
                articulo: r.articulo,
                categoria: r.categoria,
                vendedorId: r.vendedor_id,
                vendedorNombre: r.vendedor_nombre,
                vendedorEmail: void 0,
                cliente: r.vendedor_nombre || "General",
                meta: metaKg,
                metaKg,
                ejecutado: ejecutadoKg,
                ejecutadoKg,
                zona: r.zona || "General"
              };
            });
            cachedVolumenParsed = mapped;
            lastVolumenParsedTime = Date.now();
            setNoCacheSyncHeaders(res, "supabase");
            return res.json(filterByVendor(mapped));
          }
        } catch (e) {
        }
      }
      const parsed = await hydrateParsedCachesFromWorkbookFallback();
      setNoCacheSyncHeaders(res);
      res.json(filterByVendor(parsed.volumenApiRows));
    } catch (err) {
      console.error("Error parsing volume data:", err);
      res.status(500).json([]);
    }
  });
  app2.get("/api/data/activacion", authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      const force = req.query.force === "true";
      const { vendorFilter, allowedAliases } = resolveDataFilter(user, req.query.vendedor);
      const filterByVendor = (list) => {
        if (!vendorFilter || vendorFilter === "ADMIN" || vendorFilter === "TODOS") return list;
        return list.filter((d) => {
          const vNombre = (d.vendedorNombre || "").toUpperCase();
          const vId = (d.vendedorId || "").toUpperCase();
          if (matchesVendorAlias([vendorFilter, ...allowedAliases], vId) || matchesVendorAlias([vendorFilter, ...allowedAliases], vNombre)) {
            return true;
          }
          if (vendorFilter && !vendorFilter.startsWith("SUPERVISOR:") && !/^\d+$/.test(vendorFilter)) {
            if (vNombre.includes(vendorFilter) || vId.includes(vendorFilter)) return true;
          }
          return allowedAliases.some((a) => {
            const aU = a.toUpperCase();
            return vNombre.includes(aU) || vId.includes(aU) || aU.includes(vNombre) || aU.includes(vId);
          });
        });
      };
      if (force) {
        await runCoalescedSheetsSync(false);
        setNoCacheSyncHeaders(res);
        return res.json(filterByVendor(cachedActivacionParsed || []));
      }
      if (cachedActivacionParsed && Date.now() - lastActivacionParsedTime < PARSED_DATA_TTL) {
        setNoCacheSyncHeaders(res, "memory");
        return res.json(filterByVendor(cachedActivacionParsed));
      }
      if (supabase) {
        try {
          let supaRows = [];
          let from = 0;
          const pageSize = 1e3;
          while (from < 1e4) {
            const { data, error } = await supabase.from("activacion_clientes").select("*").range(from, from + pageSize - 1);
            if (error || !data || data.length === 0) break;
            supaRows.push(...data);
            if (data.length < pageSize) break;
            from += pageSize;
          }
          if (Array.isArray(supaRows) && supaRows.length > 0) {
            const byClientMap = /* @__PURE__ */ new Map();
            for (const r of supaRows) {
              const cid = String(r.cliente_codigo || "").trim();
              if (!cid) continue;
              const hasAceite = Boolean(r.has_aceite) || (Number(r.cajas_aceite) || 0) > 0;
              const hasAzucar = Boolean(r.has_azucar) || (Number(r.cajas_azucar) || 0) > 0;
              const hasPollo = Boolean(r.has_pollo) || (Number(r.cajas_pollo) || 0) > 0;
              const hasAsturias = Boolean(r.has_estandar_asturias) || (Number(r.cajas_estandar_asturias) || 0) > 0;
              const hasSalpicao = Boolean(r.has_mortadela_salpicao) || (Number(r.cajas_mortadela_salpicao) || 0) > 0;
              if (!byClientMap.has(cid)) {
                byClientMap.set(cid, {
                  id: cid,
                  cliente: r.cliente_nombre,
                  vendedorId: r.vendedor_id,
                  vendedorNombre: r.vendedor_nombre,
                  status: hasAceite || hasAzucar || hasPollo || hasAsturias || hasSalpicao || r.status === "ACTIVO" ? "ACTIVO" : "INACTIVO",
                  cajas: {
                    ACEITE: Number(r.cajas_aceite) || 0,
                    AZUCAR: Number(r.cajas_azucar) || 0,
                    POLLO: Number(r.cajas_pollo) || 0,
                    ESTANDAR_ASTURIAS: Number(r.cajas_estandar_asturias) || 0,
                    MORTADELA_SALPICAO: Number(r.cajas_mortadela_salpicao) || 0
                  },
                  cats: {
                    ACEITE: hasAceite,
                    AZUCAR: hasAzucar,
                    POLLO: hasPollo,
                    ESTANDAR_ASTURIAS: hasAsturias,
                    MORTADELA_SALPICAO: hasSalpicao,
                    ARROZ: hasPollo,
                    ENTERO: hasAsturias,
                    LIGEROS: hasSalpicao
                  }
                });
              } else {
                const prev = byClientMap.get(cid);
                prev.cats.ACEITE = prev.cats.ACEITE || hasAceite;
                prev.cats.AZUCAR = prev.cats.AZUCAR || hasAzucar;
                prev.cats.POLLO = prev.cats.POLLO || hasPollo;
                prev.cats.ESTANDAR_ASTURIAS = prev.cats.ESTANDAR_ASTURIAS || hasAsturias;
                prev.cats.MORTADELA_SALPICAO = prev.cats.MORTADELA_SALPICAO || hasSalpicao;
                prev.cats.ARROZ = prev.cats.POLLO;
                prev.cats.ENTERO = prev.cats.ESTANDAR_ASTURIAS;
                prev.cats.LIGEROS = prev.cats.MORTADELA_SALPICAO;
                prev.cajas.ACEITE = Math.max(prev.cajas.ACEITE, Number(r.cajas_aceite) || 0);
                prev.cajas.AZUCAR = Math.max(prev.cajas.AZUCAR, Number(r.cajas_azucar) || 0);
                prev.cajas.POLLO = Math.max(prev.cajas.POLLO, Number(r.cajas_pollo) || 0);
                prev.cajas.ESTANDAR_ASTURIAS = Math.max(prev.cajas.ESTANDAR_ASTURIAS, Number(r.cajas_estandar_asturias) || 0);
                prev.cajas.MORTADELA_SALPICAO = Math.max(prev.cajas.MORTADELA_SALPICAO, Number(r.cajas_mortadela_salpicao) || 0);
                if (prev.cats.ACEITE || prev.cats.AZUCAR || prev.cats.POLLO || prev.cats.ESTANDAR_ASTURIAS || prev.cats.MORTADELA_SALPICAO) {
                  prev.status = "ACTIVO";
                }
              }
            }
            const mapped = Array.from(byClientMap.values());
            cachedActivacionParsed = mapped;
            lastActivacionParsedTime = Date.now();
            setNoCacheSyncHeaders(res, "supabase");
            return res.json(filterByVendor(mapped));
          }
        } catch (e) {
        }
      }
      const parsed = await hydrateParsedCachesFromWorkbookFallback();
      setNoCacheSyncHeaders(res);
      res.json(filterByVendor(parsed.activacionApiRows));
    } catch (err) {
      console.error("Error in /api/data/activacion:", err);
      res.status(500).json([]);
    }
  });
  app2.post("/api/data/activacion/toggle-rubro", authenticateToken, async (req, res) => {
    try {
      const { clienteCodigo, rubro, active } = req.body || {};
      const cleanCod = String(clienteCodigo || "").replace(/^[#\s]+/, "").trim();
      const normRubro = normalizeHistRubroCode(rubro);
      if (!cleanCod || !normRubro) {
        return res.status(400).json({ error: "clienteCodigo y rubro son requeridos" });
      }
      const boolActive = Boolean(active);
      const colMap = {
        ACEITE: "has_aceite",
        AZUCAR: "has_azucar",
        POLLO: "has_pollo",
        ESTANDAR_ASTURIAS: "has_estandar_asturias",
        MORTADELA_SALPICAO: "has_mortadela_salpicao"
      };
      const dbCol = colMap[normRubro];
      if (supabase && dbCol) {
        const { data: rows } = await supabase.from("activacion_clientes").select("*").eq("cliente_codigo", cleanCod);
        if (Array.isArray(rows) && rows.length > 0) {
          for (const r of rows) {
            const nextState = {
              has_aceite: normRubro === "ACEITE" ? boolActive : Boolean(r.has_aceite),
              has_azucar: normRubro === "AZUCAR" ? boolActive : Boolean(r.has_azucar),
              has_pollo: normRubro === "POLLO" ? boolActive : Boolean(r.has_pollo),
              has_estandar_asturias: normRubro === "ESTANDAR_ASTURIAS" ? boolActive : Boolean(r.has_estandar_asturias),
              has_mortadela_salpicao: normRubro === "MORTADELA_SALPICAO" ? boolActive : Boolean(r.has_mortadela_salpicao)
            };
            const isActivo = Object.values(nextState).some(Boolean);
            await supabase.from("activacion_clientes").update({
              ...nextState,
              status: isActivo ? "ACTIVO" : "INACTIVO"
            }).eq("id", r.id);
          }
        }
      }
      if (cachedActivacionParsed && Array.isArray(cachedActivacionParsed)) {
        cachedActivacionParsed.forEach((c) => {
          const cid = String(c.id || "").replace(/^[#\s]+/, "").trim();
          if (cid === cleanCod) {
            if (!c.cats) c.cats = {};
            c.cats[normRubro] = boolActive;
            if (normRubro === "POLLO") c.cats.ARROZ = boolActive;
            if (normRubro === "ESTANDAR_ASTURIAS") c.cats.ENTERO = boolActive;
            if (normRubro === "MORTADELA_SALPICAO") c.cats.LIGEROS = boolActive;
            const anyActive = Boolean(
              c.cats.ACEITE || c.cats.AZUCAR || c.cats.POLLO || c.cats.ESTANDAR_ASTURIAS || c.cats.MORTADELA_SALPICAO
            );
            c.status = anyActive ? "ACTIVO" : "INACTIVO";
          }
        });
      }
      setNoCacheSyncHeaders(res);
      return res.json({ success: true, clienteCodigo: cleanCod, rubro: normRubro, active: boolActive });
    } catch (err) {
      console.error("[SERVER] Error en /api/data/activacion/toggle-rubro:", err);
      return res.status(500).json({ error: "Error actualizando rubro del cliente", details: err?.message });
    }
  });
  app2.get("/api/data/metas-activacion", authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      const force = req.query.force === "true";
      const { vendorFilter, allowedAliases } = resolveDataFilter(user, req.query.vendedor);
      const filterByVendor = (list) => {
        if (!vendorFilter || vendorFilter === "ADMIN" || vendorFilter === "TODOS") return list;
        return list.filter((d) => {
          const vId = (d.vendedorId || "").toUpperCase();
          if (matchesVendorAlias([vendorFilter, ...allowedAliases], vId)) {
            return true;
          }
          if (vendorFilter && !vendorFilter.startsWith("SUPERVISOR:") && !/^\d+$/.test(vendorFilter)) {
            if (vId.includes(vendorFilter) || vendorFilter.includes(vId)) return true;
          }
          return allowedAliases.some((a) => {
            const aU = a.toUpperCase();
            return vId.includes(aU) || aU.includes(vId);
          });
        });
      };
      if (force) {
        await runCoalescedSheetsSync(false);
        setNoCacheSyncHeaders(res);
        return res.json(filterByVendor(cachedMetasParsed || []));
      }
      if (cachedMetasParsed && Date.now() - lastMetasParsedTime < PARSED_DATA_TTL) {
        setNoCacheSyncHeaders(res, "memory");
        return res.json(filterByVendor(cachedMetasParsed));
      }
      if (supabase) {
        try {
          const { data, error } = await supabase.from("metas_activacion").select("*").eq("periodo", metasPeriodoActual());
          if (!error && data && data.length > 0) {
            const mapped = data.map((r) => ({
              vendedorId: r.vendedor_id,
              categoria: r.categoria,
              meta: Number(r.meta) || 0,
              activados: Number(r.activados) || 0
            }));
            cachedMetasParsed = mapped;
            lastMetasParsedTime = Date.now();
            setNoCacheSyncHeaders(res, "supabase");
            return res.json(filterByVendor(mapped));
          }
        } catch (e) {
        }
      }
      const parsed = await hydrateParsedCachesFromWorkbookFallback();
      setNoCacheSyncHeaders(res);
      res.json(filterByVendor(parsed.metasApiRows));
    } catch (err) {
      console.error("Error in /api/data/metas-activacion:", err);
      res.status(500).json([]);
    }
  });
  const sharedReceiptsMemoryStore = /* @__PURE__ */ new Map();
  app2.get("/api/shared-receipt-temp/:id", (req, res) => {
    const id = String(req.params.id || "").trim();
    const entry = sharedReceiptsMemoryStore.get(id);
    if (!entry) {
      return res.status(404).json({ error: "Comprobante temporal expirado o ya consumido" });
    }
    sharedReceiptsMemoryStore.delete(id);
    return res.json(entry);
  });
  app2.post("/share-target-cobro", import_express.default.raw({ type: "*/*", limit: "25mb" }), (req, res) => {
    try {
      const contentType = String(req.headers["content-type"] || "");
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
      let dataUrl = "";
      let fileName = "soporte_whatsapp.jpg";
      let mimeType = "image/jpeg";
      let fileSize = 0;
      if (boundaryMatch && rawBody.length > 0) {
        const boundary = "--" + (boundaryMatch[1] || boundaryMatch[2]).trim();
        const latin = rawBody.toString("latin1");
        const parts = latin.split(boundary);
        for (const part of parts) {
          if (part.includes("filename=")) {
            const fnMatch = part.match(/filename="([^"]+)"/i);
            const ctMatch = part.match(/Content-Type:\s*([^\r\n]+)/i);
            const headerEnd = part.indexOf("\r\n\r\n");
            if (headerEnd !== -1) {
              if (fnMatch && fnMatch[1]) fileName = fnMatch[1];
              if (ctMatch && ctMatch[1]) mimeType = ctMatch[1].trim();
              let bodyLatin = part.slice(headerEnd + 4);
              if (bodyLatin.endsWith("\r\n")) bodyLatin = bodyLatin.slice(0, -2);
              const fileBuf = Buffer.from(bodyLatin, "latin1");
              if (fileBuf.length > 0) {
                fileSize = fileBuf.length;
                const lowerFn = fileName.toLowerCase();
                if (lowerFn.endsWith(".pdf") || fileBuf.subarray(0, 4).toString("ascii") === "%PDF") {
                  mimeType = "application/pdf";
                } else if (lowerFn.endsWith(".png")) {
                  mimeType = "image/png";
                } else if (lowerFn.endsWith(".webp")) {
                  mimeType = "image/webp";
                } else if (lowerFn.endsWith(".heic") || lowerFn.endsWith(".heif")) {
                  mimeType = "image/heic";
                } else if (!mimeType || mimeType === "application/octet-stream") {
                  mimeType = "image/jpeg";
                }
                dataUrl = `data:${mimeType};base64,${fileBuf.toString("base64")}`;
                break;
              }
            }
          }
        }
      }
      const tempReceiptId = `rcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      if (dataUrl) {
        const now = Date.now();
        for (const [k, v] of sharedReceiptsMemoryStore.entries()) {
          if (now - v.timestamp > 10 * 60 * 1e3) sharedReceiptsMemoryStore.delete(k);
        }
        sharedReceiptsMemoryStore.set(tempReceiptId, {
          dataUrl,
          name: fileName,
          type: mimeType,
          size: fileSize,
          timestamp: now
        });
      }
      const payloadJson = JSON.stringify({
        dataUrl,
        name: fileName,
        type: mimeType,
        size: fileSize,
        receiptId: tempReceiptId,
        timestamp: Date.now()
      });
      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recibiendo comprobante de WhatsApp...</title></head>
<body style="background:#0a0a0a;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;gap:12px">
<div style="width:32px;height:32px;border:3px solid #10b981;border-top-color:transparent;border-radius:50%;animation:s 0.8s linear infinite"></div>
<style>@keyframes s{to{transform:rotate(360deg)}}</style>
<div style="font-size:14px;font-weight:bold;color:#10b981">Procesando soporte desde WhatsApp...</div>
<script>
(async function() {
  var payload = ${payloadJson};
  var targetUrl = '/?shared-receipt=1&receiptId=' + encodeURIComponent(payload.receiptId || '') + '#cobros';
  try {
    sessionStorage.setItem('fdv_pending_whatsapp_share', '1');
    if (payload.receiptId) {
      sessionStorage.setItem('fdv_shared_receipt_id', payload.receiptId);
    }
  } catch (e) {}

  try {
    if (payload && payload.dataUrl && payload.dataUrl.length < 3500000) {
      localStorage.setItem('fdv_shared_whatsapp_payload', JSON.stringify(payload));
    }
  } catch (e) {}

  try {
    if (payload && payload.dataUrl && window.indexedDB) {
      var res = await fetch(payload.dataUrl);
      var blob = await res.blob();
      await new Promise(function(resolve) {
        var req = indexedDB.open('fdv_whatsapp_share_db', 1);
        req.onupgradeneeded = function() {
          var db = req.result;
          if (!db.objectStoreNames.contains('shared_receipts')) {
            db.createObjectStore('shared_receipts', { keyPath: 'id' });
          }
        };
        req.onsuccess = function() {
          try {
            var db = req.result;
            var tx = db.transaction('shared_receipts', 'readwrite');
            tx.objectStore('shared_receipts').put({
              id: 'latest_shared_receipt',
              blob: blob,
              name: payload.name || 'soporte_whatsapp.jpg',
              type: payload.type || blob.type || 'image/jpeg',
              size: payload.size || blob.size || 0,
              timestamp: Date.now()
            });
            tx.oncomplete = function() { db.close(); resolve(true); };
            tx.onerror = function() { db.close(); resolve(false); };
          } catch (err) { resolve(false); }
        };
        req.onerror = function() { resolve(false); };
      });
    }
  } catch (e) {}

  window.location.replace(targetUrl);
})();
</script>
</body></html>`);
    } catch (err) {
      console.error("[SHARE TARGET] Error procesando archivo compartido:", err);
      res.redirect(303, "/?shared-receipt=error#cobros");
    }
  });
  const distPath = import_path.default.join(process.cwd(), "dist");
  const distIndexExists = import_fs.default.existsSync(import_path.default.join(distPath, "index.html"));
  const isDevMode = process.env.npm_lifecycle_event === "dev" || process.env.NODE_ENV === "development";
  if (!isDevMode && distIndexExists) {
    app2.use(import_express.default.static(distPath));
    app2.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  } else {
    try {
      const vite = await (0, import_vite.createServer)({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app2.use(vite.middlewares);
    } catch (vErr) {
      console.error("[SERVER] Error al inicializar Vite en modo desarrollo, usando fallback a dist:", vErr);
      if (distIndexExists) {
        app2.use(import_express.default.static(distPath));
        app2.get("*", (req, res) => {
          res.sendFile(import_path.default.join(distPath, "index.html"));
        });
      }
    }
  }
  const tryListen = (portToTry) => {
    const serverInstance = app2.listen(portToTry, "0.0.0.0", () => {
      console.log(`Server running on port ${portToTry}`);
      const runAutoSync = async () => {
        try {
          const sheetId = getGoogleSheetId();
          console.log(`[SYNC AUTO] Sincronizando datos en vivo desde Google Sheet (${sheetId})...`);
          const res = await runCoalescedSheetsSync(true);
          console.log(`[SYNC AUTO] Sincronizaci\xF3n exitosa (${lastSheetSource}). Volumen: ${res.countVolumen}, Activaci\xF3n: ${res.countActivacion}, Metas: ${res.countMetas}`);
        } catch (err) {
          console.warn("[SYNC AUTO] Error en sincronizaci\xF3n peri\xF3dica desde Google Sheet:", err?.message);
        }
      };
      setTimeout(runAutoSync, 3e3);
      setInterval(runAutoSync, 5 * 60 * 1e3);
    });
    serverInstance.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        const altPort = portToTry === 3e3 ? 3005 : portToTry + 1;
        console.warn(`[SERVER] Puerto ${portToTry} ocupado por otra instancia. Intentando en puerto alternativo ${altPort}...`);
        tryListen(altPort);
      } else {
        console.error("[SERVER] Error en servidor HTTP:", err);
      }
    });
  };
  tryListen(PORT);
}
startServer().catch((err) => {
  console.error("[SERVER] Fallo al iniciar startServer:", err);
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  authenticateToken,
  metasPeriodoActual,
  rateLimiter,
  requireAdmin
});
//# sourceMappingURL=server.cjs.map
