var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
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

// firebase-applet-config.json
var firebase_applet_config_default;
var init_firebase_applet_config = __esm({
  "firebase-applet-config.json"() {
    firebase_applet_config_default = {
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
  }
});

// src/lib/firebase.ts
var import_app, import_auth, import_firestore, app, db, auth;
var init_firebase = __esm({
  "src/lib/firebase.ts"() {
    import_app = require("firebase/app");
    import_auth = require("firebase/auth");
    import_firestore = require("firebase/firestore");
    init_firebase_applet_config();
    app = !(0, import_app.getApps)().length ? (0, import_app.initializeApp)(firebase_applet_config_default) : (0, import_app.getApp)();
    db = (0, import_firestore.getFirestore)(app, firebase_applet_config_default.firestoreDatabaseId);
    auth = (0, import_auth.getAuth)(app);
  }
});

// src/services/authService.ts
var init_authService = __esm({
  "src/services/authService.ts"() {
  }
});

// src/services/productosCodizulca.ts
function normalizeEncodingEspeciales(raw) {
  if (!raw) return "";
  return String(raw).replace(/Ã‘/g, "\xD1").replace(/Ã±/g, "\xF1").replace(/\uFFFD/g, "\xD1").replace(/DO\?A\s+FLORA/gi, "DO\xD1A FLORA").replace(/NAVIDE\?A/gi, "NAVIDE\xD1A");
}
function toSafeNumber(val, fallback = 0) {
  if (typeof val === "number") {
    return Number.isFinite(val) && !Number.isNaN(val) ? val : fallback;
  }
  if (val === null || val === void 0) return fallback;
  let s = String(val).trim().replace(/(\d+):(\d{2})\b/g, "$1.$2").replace(/(?:US\$|\$|Bs\.?|USD|VES|EUR|%)/gi, "").replace(/\s+/g, "");
  if (!s) return fallback;
  if (s.includes(".") && s.includes(",")) {
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    if (/^-?\d{1,3}(,\d{3})+$/.test(s)) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(",", ".");
    }
  } else if (s.includes(".")) {
    const parts = s.split(".");
    if (parts.length > 2) {
      s = parts.join("");
    }
  }
  const parsed = Number(s);
  return Number.isFinite(parsed) && !Number.isNaN(parsed) ? parsed : fallback;
}
function extractPresentationFeatures(descNorm) {
  const compact = descNorm.replace(/\s+/g, "").replace(",", ".");
  const packMatch = compact.match(/(\d+)(?:UND|UNI)?X(\d+(?:\.\d+)?)(KG|KGS|GR|GRS|GM|G|LT|LTS|LTRS|L|ML)\b/i);
  if (packMatch) {
    const count = parseInt(packMatch[1], 10);
    const rawVal = parseFloat(packMatch[2]);
    const unit = packMatch[3].toUpperCase();
    const grams = unit.startsWith("K") || unit.startsWith("L") ? Math.round(rawVal * 1e3) : Math.round(rawVal);
    return {
      packWeight: `${count}X${grams}`,
      unitWeightGrams: grams,
      packCount: count,
      isPerKg: false
    };
  }
  const invMatch = compact.match(/(\d+(?:\.\d+)?)(KG|KGS|GR|GRS|GM|G|LT|LTS|LTRS|L|ML)X(\d+)(?:UND|UNI|UN)?\b/i);
  if (invMatch) {
    const rawVal = parseFloat(invMatch[1]);
    const unit = invMatch[2].toUpperCase();
    const count = parseInt(invMatch[3], 10);
    const grams = unit.startsWith("K") || unit.startsWith("L") ? Math.round(rawVal * 1e3) : Math.round(rawVal);
    return {
      packWeight: `${count}X${grams}`,
      unitWeightGrams: grams,
      packCount: count,
      isPerKg: false
    };
  }
  const singleWeightMatch = compact.match(/(?:^|[^0-9X])(\d+(?:\.\d+)?)(KG|KGS|GR|GRS|GM|G|ML)\b/i);
  if (singleWeightMatch) {
    const rawVal = parseFloat(singleWeightMatch[1]);
    const unit = singleWeightMatch[2].toUpperCase();
    const grams = unit.startsWith("K") ? Math.round(rawVal * 1e3) : Math.round(rawVal);
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
function isBrandOrPresentationToken(token) {
  const clean = String(token || "").trim().toUpperCase().replace(/[().,/]/g, "");
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
function extractPrimaryProductNouns(descRaw) {
  if (!descRaw) return [];
  const d = normalizeEncodingEspeciales(descRaw).toUpperCase();
  const nouns = [];
  const rules = [
    ["ARVEJAS", /\bARVEJAS?\b/],
    ["CARAOTAS", /\bCARAOTAS?\b/],
    ["LENTEJAS", /\bLENTEJAS?\b/],
    ["GARBANZOS", /\bGARBANZOS?\b/],
    ["FRIJOLES", /\bFRIJOL(?:ES)?\b/],
    ["MAIZ", /\bMAIZ\b/],
    ["MAIZINA", /\bMAIZINA\b/],
    ["AVENA", /\bAVENA\b/],
    ["CEBADA", /\bCEBADA\b/],
    ["CREMA_LECHE", /\bCREMA\s+DE\s+LECHE\b/],
    ["MORTADELA", /\bMORT(?:ADELA|ADELITA|\.)?\b/],
    ["QUESO", /\bQUESO\b/],
    ["RICOTA", /\bRICOTA\b/],
    ["PATATAS", /\b(?:PATATAS?|PAPAS?)\b/],
    ["NUGGET", /\bNUGGETS?\b/],
    ["ARROZ", /\bARROZ\b/],
    ["AZUCAR", /\bAZUCAR\b/],
    ["ACEITE", /\bACEITE\b/],
    ["HARINA", /\bHARINA\b/],
    ["PASTA", /\b(?:PASTA|FIDEOS?|ESPAGUETIS?)\b/],
    ["HUEVOS", /\bHUEVOS?\b/],
    ["JUGO", /\bJUGOS?\b/],
    ["NECTAR", /\bNECTAR\b/],
    ["REFRESCO", /\bREFRESCOS?\b/],
    ["AGUA", /\bAGUA\b/],
    ["TE", /\bTE\b/],
    ["VINO", /\bVINOS?\b/],
    ["PONCHE", /\bPONCHE\b/],
    ["MANTEQUILLA", /\bMANTEQUILLA\b/],
    ["MARGARINA", /\bMARGARINA\b/],
    ["MAYONESA", /\bMAYONESA\b/],
    ["KETCHUP", /\bKETCHUP\b/],
    ["MOSTAZA", /\bMOSTAZA\b/],
    ["SALSA", /\bSALSAS?\b/],
    ["VINAGRE", /\bVINAGRE\b/],
    ["MIEL", /\bMIEL\b/],
    ["ATUN", /\bATUN\b/],
    ["SALMON", /\bSALMON\b/],
    ["PESCADERIA", /\b(?:PESCADERIA|CAMARON|CALAMAR|MEJILLON|PULPO|MERLUZA|SIERRA|PARGO)\b/],
    ["JAMON", /\bJAMON\b/],
    ["ESPALDA", /\bESPAL(?:DA|\.)\b/],
    ["LOMO", /\bLOMO\b/],
    ["PULPA", /\bPULPA\b/],
    ["CARNE", /\bCARNE\b/],
    ["PUNTA", /\bPUNTA\b/],
    ["BIFE", /\bBIFE\b/],
    ["SALCHICHA", /\bSALCHICHAS?\b/],
    ["SALCHICHON", /\bSALCHICHON\b/],
    ["SALAMI", /\b(?:SALAMI|PEPERONI)\b/],
    ["CHORIZO", /\bCHORIZOS?\b/],
    ["TOCINETA", /\bTOCINETA\b/],
    ["TOCINO", /\bTOCINO\b/],
    ["CHULETA", /\bCHULETA\b/],
    ["CAJAS", /\bCAJAS?\b/],
    ["BANDEJA", /\bBANDEJAS?\b/],
    ["GALLINA", /\bGALLINA\b/],
    ["HIGADO", /\bHIGADO\b/],
    ["MOLLEJA", /\bMOLLEJAS?\b/],
    ["CAFE", /\bCAFE\b/],
    ["CACAO", /\bCACAO\b/],
    ["CHOCOLATE", /\bCHOCOLATE\b/],
    ["CONFITERIA", /\b(?:CONFITERIA|TORONTO|BOLERO|TURRON)\b/],
    ["CEREALES", /\bCEREAL(?:ES)?\b/],
    ["PAN", /\bPAN\b/],
    ["LUMPIAS", /\bLUMPIAS?\b/],
    ["TOMATE", /\bTOMATES?\b/],
    ["LEVADURA", /\bLEVADURA\b/],
    ["CHAMPINONES", /\bCHAMPI[ÑN]ONES?\b/],
    ["PALMITO", /\bPALMITOS?\b/],
    ["SERVILLETAS", /\b(?:SERVILLETAS?|TOALLIN)\b/],
    ["UTENSILIOS", /\bUTENSILIOS?\b/],
    ["QUIMICOS", /\b(?:QUIMICOS?|CLORO|DESENGRASANTE|DESINFECTANTE)\b/],
    ["TETERAS", /\bTETERAS?\b/],
    ["ESENCIAS", /\bESENCIAS?\b/]
  ];
  for (const [key, regex] of rules) {
    if (regex.test(d)) {
      nouns.push(key);
    }
  }
  if (/\bLECHE\b/.test(d) && !/\bCREMA\s+DE\s+LECHE\b/.test(d) && !/\bLECHE\s+DE\s+COCO\b/.test(d)) {
    nouns.push("LECHE");
  }
  if (!nouns.includes("MORTADELA")) {
    if (/\bPECHUGA\b|\bFILET(?:E)?\b/.test(d)) nouns.push("PECHUGA");
    if (/\bMUSLO\b|\bCUADRIL\b/.test(d)) nouns.push("MUSLO");
    if (/\bALAS\b/.test(d)) nouns.push("ALAS");
    if (/\bPOLLO\b/.test(d) && !nouns.includes("PECHUGA")) nouns.push("POLLO");
  }
  if (nouns.length === 0) {
    const stopWords = /* @__PURE__ */ new Set(["DE", "DEL", "LA", "EL", "LOS", "LAS", "EN", "CON", "POR", "PARA", "TIPO", "SIN", "FS", "UR"]);
    const tokens = d.replace(/\s*\/\s*\d+(?:[.,]\d+)?\s*$/, "").replace(/[()/.,\-]/g, " ").split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 3 && !stopWords.has(t) && !isBrandOrPresentationToken(t));
    if (tokens.length > 0) {
      nouns.push(tokens[0]);
    }
  }
  return nouns;
}
function hasPrimaryNounConflict(candidateDesc, inputDesc) {
  if (!inputDesc || !candidateDesc) return false;
  const inputNouns = extractPrimaryProductNouns(inputDesc);
  const candNouns = extractPrimaryProductNouns(candidateDesc);
  if (inputNouns.length === 0 || candNouns.length === 0) return true;
  return !inputNouns.some((n) => candNouns.includes(n));
}
function hasExplicitGramajeConflict(candidate, descNorm) {
  if (!descNorm) return false;
  if (hasPrimaryNounConflict(candidate.descripcion, descNorm)) {
    return true;
  }
  const inputFeat = extractPresentationFeatures(descNorm);
  const candFeat = extractPresentationFeatures(candidate.descripcion);
  if (inputFeat.packWeight && candFeat.packWeight && inputFeat.packWeight !== candFeat.packWeight) {
    return true;
  }
  if (inputFeat.unitWeightGrams !== null && candFeat.unitWeightGrams !== null && inputFeat.unitWeightGrams !== candFeat.unitWeightGrams) {
    return true;
  }
  if (inputFeat.unitWeightGrams !== null && !inputFeat.isPerKg && candFeat.isPerKg && candFeat.unitWeightGrams === null) {
    return true;
  }
  return false;
}
function matchLecheVencampoByGramaje(descNorm) {
  const feat = extractPresentationFeatures(descNorm);
  if (feat.packWeight === "20X400") return MAPA_PRODUCTOS_CODIZULCA.get("1555");
  if (feat.packWeight === "10X400") return MAPA_PRODUCTOS_CODIZULCA.get("1574");
  if (feat.packWeight === "20X500") return MAPA_PRODUCTOS_CODIZULCA.get("1544");
  if (feat.packWeight === "10X500") return MAPA_PRODUCTOS_CODIZULCA.get("1579");
  if (feat.packWeight === "10X900") return MAPA_PRODUCTOS_CODIZULCA.get("1556");
  if (feat.packWeight === "10X1000") return MAPA_PRODUCTOS_CODIZULCA.get("1536");
  if (feat.unitWeightGrams === 400) return MAPA_PRODUCTOS_CODIZULCA.get("1574");
  if (feat.unitWeightGrams === 900) return MAPA_PRODUCTOS_CODIZULCA.get("1556");
  if (feat.unitWeightGrams === 500) return MAPA_PRODUCTOS_CODIZULCA.get("1579");
  if (feat.unitWeightGrams === 1e3) return MAPA_PRODUCTOS_CODIZULCA.get("1536");
  return MAPA_PRODUCTOS_CODIZULCA.get("1536");
}
function matchProductoCodizulca(codigoLeido, descripcionLeida) {
  const rawCod = String(codigoLeido ?? "").trim();
  const cleanCod = rawCod.replace(/[\s\-_.]/g, "").toUpperCase();
  const cleanCodNoZeros = /^\d+$/.test(cleanCod) ? String(parseInt(cleanCod, 10)) : cleanCod;
  const rawDescPreserved = normalizeEncodingEspeciales(String(descripcionLeida ?? "")).replace(/\s+/g, " ").trim().toUpperCase();
  const descNorm = rawDescPreserved.replace(/\s*\/\s*\d+(?:[.,]\d+)?\s*$/, "").replace(/\s+/g, " ").trim().toUpperCase();
  const isForbiddenAlpha = CODIGOS_ALFABETICOS_PROHIBIDOS.has(cleanCod);
  if (!isForbiddenAlpha && cleanCod) {
    const byBarcodeOrPlu = HOMOLOGACION_EAN_PLU_ALKOSTO[cleanCod] || HOMOLOGACION_EAN_PLU_ALKOSTO[cleanCodNoZeros];
    if (byBarcodeOrPlu && (!descNorm || !hasPrimaryNounConflict(byBarcodeOrPlu.descripcion, descNorm))) {
      return { ...byBarcodeOrPlu, matchExacto: true };
    }
    const exactCatalog = MAPA_PRODUCTOS_CODIZULCA.get(cleanCod) || MAPA_PRODUCTOS_CODIZULCA.get(cleanCodNoZeros);
    if (exactCatalog && !hasExplicitGramajeConflict(exactCatalog, descNorm)) {
      return { ...exactCatalog, matchExacto: true };
    }
    const byHist = PRODUCTOS_HISTORICOS_COMPLEMENTARIOS[cleanCod] || PRODUCTOS_HISTORICOS_COMPLEMENTARIOS[cleanCodNoZeros];
    if (byHist && !hasExplicitGramajeConflict(byHist, descNorm)) {
      return { ...byHist, matchExacto: true };
    }
  }
  const inputNouns = extractPrimaryProductNouns(descNorm);
  const isLechePolvoVencampo = cleanCod === "LPV" && (inputNouns.length === 0 || inputNouns.includes("LECHE")) || inputNouns.includes("LECHE") && descNorm.includes("POLVO") && !descNorm.includes("PURISIMA") && (descNorm.includes("VENCAMPO") || descNorm.includes("400GR") || descNorm.includes("900GR") || descNorm.includes("10X"));
  if (isLechePolvoVencampo) {
    return { ...matchLecheVencampoByGramaje(descNorm), matchExacto: true };
  }
  if ((cleanCod === "UTH" || cleanCod === "UHT" || inputNouns.includes("LECHE") && (descNorm.includes("UHT") || descNorm.includes("UTH") || descNorm.includes("LIQUIDA"))) && (inputNouns.length === 0 || inputNouns.includes("LECHE"))) {
    if (descNorm.includes("DESCREMADA")) return { ...MAPA_PRODUCTOS_CODIZULCA.get("180"), matchExacto: true };
    if (descNorm.includes("DESLACTOSADA")) return { ...MAPA_PRODUCTOS_CODIZULCA.get("242"), matchExacto: true };
    if (descNorm.includes("BARISTA")) return { ...MAPA_PRODUCTOS_CODIZULCA.get("1268"), matchExacto: true };
    return { ...MAPA_PRODUCTOS_CODIZULCA.get("179"), matchExacto: true };
  }
  if (cleanCod === "QS" && (inputNouns.length === 0 || inputNouns.includes("QUESO"))) {
    if (descNorm.includes("MI FINCA") || descNorm.includes("EDAM")) return { ...MAPA_PRODUCTOS_CODIZULCA.get("1591"), matchExacto: true };
    return { ...MAPA_PRODUCTOS_CODIZULCA.get("1057"), matchExacto: true };
  }
  if (cleanCod === "JUGOS" && (inputNouns.length === 0 || inputNouns.includes("JUGO"))) {
    if (descNorm.includes("PASTERIZADO") || descNorm.includes("250ML")) return { ...MAPA_PRODUCTOS_CODIZULCA.get("1587"), matchExacto: true };
    if (descNorm.includes("200ML")) return { ...MAPA_PRODUCTOS_CODIZULCA.get("1098"), matchExacto: true };
    return { ...MAPA_PRODUCTOS_CODIZULCA.get("181"), matchExacto: true };
  }
  if (descNorm) {
    const exactDesc = PRODUCTOS_CODIZULCA.find((p) => p.descripcion.toUpperCase() === descNorm);
    if (exactDesc) return { ...exactDesc, matchExacto: true };
    if (inputNouns.includes("MORTADELA") && descNorm.includes("ASTURIA") && (descNorm.includes("500GR") || descNorm.includes("20UNDX500") || descNorm.includes("20X500"))) {
      return { ...MAPA_PRODUCTOS_CODIZULCA.get("1624") || PRODUCTOS_HISTORICOS_COMPLEMENTARIOS["1497"], matchExacto: true };
    }
    if (inputNouns.includes("NUGGET") && descNorm.includes("CORRAL") && (descNorm.includes("460") || descNorm.includes("462"))) {
      return { ...PRODUCTOS_HISTORICOS_COMPLEMENTARIOS["047"], matchExacto: true };
    }
    if (descNorm.includes("PECHUGA") && descNorm.includes("PAVO") && descNorm.includes("ASTURIA")) {
      return { ...MAPA_PRODUCTOS_CODIZULCA.get("1512"), matchExacto: true };
    }
    if (descNorm.includes("PECHUGA") && descNorm.includes("POLLO") && descNorm.includes("ASTURIA")) {
      return { ...MAPA_PRODUCTOS_CODIZULCA.get("1511"), matchExacto: true };
    }
    if (inputNouns.includes("PATATAS") && descNorm.includes("MARQUISE")) {
      return { ...MAPA_PRODUCTOS_CODIZULCA.get("1360"), matchExacto: true };
    }
    if (inputNouns.includes("QUESO") && descNorm.includes("CORLASA") && !descNorm.includes("KG")) {
      return { ...MAPA_PRODUCTOS_CODIZULCA.get("1575"), matchExacto: true };
    }
    const inputFeat = extractPresentationFeatures(descNorm);
    const stopWords = /* @__PURE__ */ new Set(["DE", "DEL", "LA", "EL", "LOS", "LAS", "EN", "CON", "POR", "PARA", "TIPO", "UND", "UNI", "GRS", "GR"]);
    const queryTokens = descNorm.replace(/[()/.,]/g, " ").split(/\s+/).filter((t) => t.length >= 2 && !stopWords.has(t));
    const leadingNounToken = queryTokens[0] || "";
    let bestProduct = null;
    let bestScore = -Infinity;
    for (const candidate of PRODUCTOS_CODIZULCA) {
      const candDesc = candidate.descripcion.toUpperCase();
      if (inputNouns.length > 0) {
        if (hasPrimaryNounConflict(candDesc, descNorm)) {
          continue;
        }
      } else if (leadingNounToken.length >= 4 && !candDesc.includes(leadingNounToken)) {
        continue;
      }
      if (hasExplicitGramajeConflict(candidate, descNorm)) {
        continue;
      }
      const candFeat = extractPresentationFeatures(candDesc);
      let score = 180;
      if (candDesc.includes(descNorm) || descNorm.includes(candDesc)) {
        score += 300;
      }
      if (inputFeat.packWeight && candFeat.packWeight && inputFeat.packWeight === candFeat.packWeight) {
        score += 260;
      }
      if (inputFeat.unitWeightGrams !== null && candFeat.unitWeightGrams !== null && inputFeat.unitWeightGrams === candFeat.unitWeightGrams) {
        score += 160;
      }
      if (inputFeat.isPerKg && candFeat.isPerKg) {
        score += 80;
      }
      let matchedTokens = 0;
      for (const token of queryTokens) {
        if (candDesc.includes(token)) {
          matchedTokens++;
          score += token.length >= 5 ? 65 : 40;
        } else if (token === "MOZZARELLA" && candDesc.includes("MOZARELLA")) {
          matchedTokens++;
          score += 65;
        } else if (token === "MOZARELLA" && candDesc.includes("MOZZARELLA")) {
          matchedTokens++;
          score += 65;
        } else if (token === "MORTADELA" && candDesc.includes("MORT")) {
          matchedTokens++;
          score += 55;
        } else if (token === "PAPAS" && candDesc.includes("PATATAS")) {
          matchedTokens++;
          score += 65;
        } else if (token === "NEGRAS" && candDesc.includes("NEG.")) {
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
  const isUnmatchedBarcode = /^\d{8,14}$/.test(cleanCod);
  const fallbackCodigo = !isForbiddenAlpha && cleanCod && !isUnmatchedBarcode ? cleanCod : "PENDIENTE";
  const fallbackDescripcion = rawDescPreserved || descNorm || "PRODUCTO POR HOMOLOGAR (EDITAR SKU)";
  return {
    codigo: fallbackCodigo,
    descripcion: fallbackDescripcion,
    matchExacto: false
  };
}
function formatCatalogoCodizulcaForPrompt() {
  return PRODUCTOS_CODIZULCA.map((p) => `${p.codigo} - ${p.descripcion}`).join("\n");
}
var PRODUCTOS_CODIZULCA, MAPA_PRODUCTOS_CODIZULCA, PRODUCTOS_HISTORICOS_COMPLEMENTARIOS, HOMOLOGACION_EAN_PLU_ALKOSTO, CODIGOS_ALFABETICOS_PROHIBIDOS, BRAND_AND_GENERIC_TOKENS;
var init_productosCodizulca = __esm({
  "src/services/productosCodizulca.ts"() {
    PRODUCTOS_CODIZULCA = [
      { codigo: "9", descripcion: "FILETE DE PECHUGA A GRANEL POR KG" },
      { codigo: "21", descripcion: "MORTADELA ESP D/POLLO CORRAL 1X12UNI" },
      { codigo: "28", descripcion: "HUEVOS DE CONSUMO TUNAL TIPO A 1X12UNI" },
      { codigo: "46", descripcion: "NUGGETS INSTITUCIONAL CORRAL POR KG" },
      { codigo: "73", descripcion: "GALLINA DESNUDA POR KG" },
      { codigo: "75", descripcion: "PECHUGA CON HUESO POR KG" },
      { codigo: "96", descripcion: "QUESO MOZZARELLA ESPECIAL EL LUCERO (E)" },
      { codigo: "130", descripcion: "POLLO CORRAL POR KG" },
      { codigo: "151", descripcion: "QUESO MOZARELLA EN BARRA DO\xD1A FLORA" },
      { codigo: "170", descripcion: "TOCINETA AHUM S/CUERO ALIMEX X KG" },
      { codigo: "171", descripcion: "JAMON COC. SUPERIOR ALIMEX 1X5.9KG" },
      { codigo: "172", descripcion: "ESPALDA COCIDA ALIMEX 1X4.6KG" },
      { codigo: "174", descripcion: "MORTADELA TAPARA ALIMEX DE 6X3.5KG" },
      { codigo: "176", descripcion: "SALCHICHA VIENA ALIMEX 8 X 800 GRS" },
      { codigo: "177", descripcion: "SALCHICHA VIENA ALIMEX 16 X 450 GRS" },
      { codigo: "179", descripcion: "LECHE COMPLETA PURISIMA1X12LTRS" },
      { codigo: "180", descripcion: "LECHE DESCREMADA PURISIMA1X12LTS" },
      { codigo: "181", descripcion: "JUGO DE NARANJA EL TUNAL 1X12LTRS" },
      { codigo: "182", descripcion: "NECTAR DE MANZANA EL TUNAL 1X12LTRS" },
      { codigo: "183", descripcion: "NECTAR DE PERA EL TUNAL 1X12LTRS" },
      { codigo: "184", descripcion: "NECTAR DE DURAZNO EL TUNAL 1X12LTRS" },
      { codigo: "185", descripcion: "TE CON LIMON EL TUNAL 1X12LTRS" },
      { codigo: "186", descripcion: "TE CON DURAZNO EL TUNAL 1X12LTRS" },
      { codigo: "241", descripcion: "ESPAL. AHUM T/VISKING ALIMEX 6X3.2" },
      { codigo: "242", descripcion: "LECHE DESLACTOSADA PURISIMA1X12LT" },
      { codigo: "302", descripcion: "MANTEQUILLA CON SAL PURISIMA BARRA 18X200GR" },
      { codigo: "306", descripcion: "ATUN NATURAL 24X170GRS" },
      { codigo: "337", descripcion: "JAMON COCIDO ESTANDAR ITALICO X KG" },
      { codigo: "340", descripcion: "CHULETA AHUMADA ALIMEX X KG" },
      { codigo: "353", descripcion: "MAYONESA MAVESA 445 GRS X 12 UND" },
      { codigo: "354", descripcion: "MARGARINA MAVESA 500 GRS X 12 UND" },
      { codigo: "360", descripcion: "KETCHUP PAMPERO 397 GRS X 24 UND" },
      { codigo: "364", descripcion: "MAVESA VINAGRE DE ALCOHOL 1LX12UND" },
      { codigo: "388", descripcion: "MAVESA ADEREZO MAYONESA 3.6GX4UN" },
      { codigo: "390", descripcion: "PAMPERO SALSA TOMATE 4.2KGX4UN" },
      { codigo: "393", descripcion: "MOLLEJA (EMPACADA)" },
      { codigo: "439", descripcion: "ESPAL AHUM.T/AREPERO ALIMEX 12X1,6KG" },
      { codigo: "469", descripcion: "HUEVOS ESTUCH. PLAST. TUNAL 12 X 30" },
      { codigo: "485", descripcion: "PAP. ALUM DOMESTICO 7M 1X30" },
      { codigo: "518", descripcion: "PASTA PREMIUM TIPO VERMICELLI 12X1KG" },
      { codigo: "629", descripcion: "MUSLO CUADRIL DESPRESADO POR KG" },
      { codigo: "630", descripcion: "ALAS DESPRESADAS POR KG" },
      { codigo: "631", descripcion: "FILET FRESCO DESPRESADO POR KG (E)" },
      { codigo: "632", descripcion: "CARCASA DESPRESADA POR KG" },
      { codigo: "642", descripcion: "QUESO PARMESANO X KG" },
      { codigo: "681", descripcion: "FILET EN BOLSA CONG DESPRESADO POR KG" },
      { codigo: "687", descripcion: "CUADRIL DESPRESADO POR KG" },
      { codigo: "688", descripcion: "PIERNITAS DESPRESADA POR KG" },
      { codigo: "690", descripcion: "MUSLO A GRANEL DESPRESADO" },
      { codigo: "693", descripcion: "FILET DE MUSLO DESPRESADO POR KG" },
      { codigo: "699", descripcion: "MUSLO DESPRESADO EN BANDEJA" },
      { codigo: "700", descripcion: "ALAS DESPRESADAS EN BANDEJA" },
      { codigo: "829", descripcion: "FILETE DE PECHUGA PROAGRO A GRANEL 5 KG" },
      { codigo: "860", descripcion: "SALCHICHAS VIENA ALIMEX 32 X 225GRS" },
      { codigo: "870", descripcion: "HIGADO (EMPACADO)" },
      { codigo: "922", descripcion: "HUEVOS DE CONSUMO TUNAL TIPO B 1X12UNI" },
      { codigo: "927", descripcion: "MORTADELA ESP. CARACAS 10X900GRS" },
      { codigo: "934", descripcion: "PULPA DE CERDO DEPOSTADA" },
      { codigo: "952", descripcion: "HUEVOS DE CONSUMO CLASE B 1X12 UND" },
      { codigo: "973", descripcion: "HARINA DE MAIZ 1X20UNID" },
      { codigo: "979", descripcion: "HUEVOS DE CONSUMO CLASE A 1X12UNID" },
      { codigo: "993", descripcion: "HUEVOS CONSUMO EXTRA TUNAL 1X12UNI" },
      { codigo: "995", descripcion: "ESPAL. AHUM T/VISKING ITALICO 6UNDX3.2KG" },
      { codigo: "1051", descripcion: "MORTADELA ESP. CARACAS 10X500GRS" },
      { codigo: "1057", descripcion: "QUESO AMARILLO ESPECIAL" },
      { codigo: "1088", descripcion: "CHULETA FRESCA IBERICO POR KG" },
      { codigo: "1089", descripcion: "CREMA DE LECHE PURISIMA 12X250GRS" },
      { codigo: "1091", descripcion: "CREMA DE LECHE PURISIMA 6 X 500 GRS" },
      { codigo: "1094", descripcion: "PASTA POR KG" },
      { codigo: "1098", descripcion: "JUGO DE NARANJA EL TUNAL 27X200ML" },
      { codigo: "1099", descripcion: "NECTAR DE MANZANA EL TUNAL 27X200ML" },
      { codigo: "1100", descripcion: "NECTAR DE PERA EL TUNAL 27X200ML" },
      { codigo: "1103", descripcion: "MANTEQUILLA SIN SAL PURISIMA 18X200GR" },
      { codigo: "1181", descripcion: "NECTAR DE DURAZNO EL TUNAL 27X200ML" },
      { codigo: "1206", descripcion: "ARROZ GLORIA CLASICO 24X1KG" },
      { codigo: "1241", descripcion: "POLLO ENTERO JUAN POLLO POR KG" },
      { codigo: "1242", descripcion: "MORT. CHORIZO ESPECIAL CDZ X KG" },
      { codigo: "1250", descripcion: "NECTAR DE PERA EL TUNAL12 X 500ML" },
      { codigo: "1251", descripcion: "NECTAR DE DURAZNO EL TUNAL 12 X 500ML" },
      { codigo: "1259", descripcion: "MORTADELA T/ESPECIAL MAXI CARACAS 6UNDX3.3KG" },
      { codigo: "1264", descripcion: "BANDEJA ECOTRAY NEGRA 1X100 UND" },
      { codigo: "1268", descripcion: "LECHE BARISTA PURISIMA 1X12 LTRS" },
      { codigo: "1276", descripcion: "FILET ESP. MILANESA SUPREMA POR KG" },
      { codigo: "1277", descripcion: "MUSLO ESPECIAL SIN CADERA POR KG" },
      { codigo: "1311", descripcion: "NECTAR DE MANZANA LIGHT EL TUNAL 1X12LTRS" },
      { codigo: "1312", descripcion: "NECTAR DE PERA LIGHT EL TUNAL 1X12LTRS" },
      { codigo: "1314", descripcion: "CREMA DE LECHE MONTE ADENTRO 32 X 250GR" },
      { codigo: "1326", descripcion: "MOLLEJAS LOS LLANOS POR KG" },
      { codigo: "1334", descripcion: "HIGADO (GRANEL) LOS LLANOS" },
      { codigo: "1342", descripcion: "ARROZ GLORIA PREMIUM 24X900GR" },
      { codigo: "1343", descripcion: "POLLO ESPECIAL DE 1RA LOS LLANOS (E)" },
      { codigo: "1360", descripcion: "PATATAS FRESCAS MARQUISE 4X2.5KG" },
      { codigo: "1381", descripcion: "HUEVOS ESTUCH PULPA EL TUNAL 15 X 20" },
      { codigo: "1397", descripcion: "CARAOTAS POR KG" },
      { codigo: "1409", descripcion: "FILET DE PECHUGA LOS LLANOS POR KG" },
      { codigo: "1419", descripcion: "ACEITE DE SOYA DIANA 12X760ML" },
      { codigo: "1428", descripcion: "FILET DE PECHUGA TIPO A CONGELADO POR KG" },
      { codigo: "1441", descripcion: "PAN HPM BLANCO GLUTEN FREE 1KGX20UND" },
      { codigo: "1445", descripcion: "TOCINO FRESCO ASTURIAS X KG" },
      { codigo: "1446", descripcion: "CHULETA FRESCA ASTURIAS POR KG" },
      { codigo: "1461", descripcion: "MORT ESTANDAR ASTURIAS X KG" },
      { codigo: "1462", descripcion: "MORT. ESPECIAL COCIDA ASTURIAS X KG" },
      { codigo: "1463", descripcion: "MORT. SUPERIOR ASTURIAS X KG" },
      { codigo: "1464", descripcion: "MORT. NAVIDE\xD1A ASTURIAS XKG" },
      { codigo: "1477", descripcion: "RECORTE DE CHARCUTERIA POR KG" },
      { codigo: "1478", descripcion: "POLLO LLANERITO POR KG" },
      { codigo: "1479", descripcion: "ACEITE DE SOYA DIANA 12X900ML" },
      { codigo: "1489", descripcion: "AZUCAR REFINADA D CASTA 1KGX20UND" },
      { codigo: "1493", descripcion: "GATORADE 500X12UND" },
      { codigo: "1494", descripcion: "MORTADELA ESP D/POLLO LOS LLANOS 10UNDX900GR" },
      { codigo: "1496", descripcion: "MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR" },
      { codigo: "1503", descripcion: "CHURRASCO DE MUSLO POR KG" },
      { codigo: "1504", descripcion: "CHUPETICA DE POLLO POR KG" },
      { codigo: "1507", descripcion: "AZUCAR BLANCA ESPERANZA 1X20ND" },
      { codigo: "1511", descripcion: "MORT. PECHUGA DE POLLO ASTURIAS X KG" },
      { codigo: "1512", descripcion: "MORT DE PAVO ASTURIAS X KG" },
      { codigo: "1515", descripcion: "LECHE POLVO COMPLETA PURISIMA 24X200GRS" },
      { codigo: "1516", descripcion: "LECHE POLVO COMPLETA PURISIMA 24X400GR" },
      { codigo: "1517", descripcion: "LECHE POLVO COMPLETA PURISIMA 12X900GRS" },
      { codigo: "1519", descripcion: "MORTADELA ESP D/POLLO SALPICAO 10UNDX900GR" },
      { codigo: "1521", descripcion: "MORT. ECONOM COCIDA ASTURIAS X KG" },
      { codigo: "1522", descripcion: "MORT. TIPO AREPERO ASTURIAS X KG" },
      { codigo: "1524", descripcion: "POLLO BRASA POR KG" },
      { codigo: "1526", descripcion: "MORTADELITA ASTURIAS X BOLSA" },
      { codigo: "1536", descripcion: "LECHE EN POLVO VENCAMPO 10X1KG" },
      { codigo: "1543", descripcion: "AZUCAR BLANCA VENCAMPO 1X20ND" },
      { codigo: "1544", descripcion: "LECHE EN POLVO VENCAMPO 20X500GR" },
      { codigo: "1549", descripcion: "ARROZ BLANCO VENCAMPO 24X900GR" },
      { codigo: "1550", descripcion: "AZUCAR BLANCA VENCAMPO 1X24ND" },
      { codigo: "1551", descripcion: "ACEITE VENCAMPO 12X900ML" },
      { codigo: "1553", descripcion: "ACEITE DE SOYA A GRANEL" },
      { codigo: "1555", descripcion: "LECHE EN POLVO VENCAMPO 20X400GR" },
      { codigo: "1556", descripcion: "LECHE EN POLVO VENCAMPO 10X900GR" },
      { codigo: "1561", descripcion: "MORT. PAVO TIPO SHOULDER ASTURIAS POR KG" },
      { codigo: "1562", descripcion: "MORT. ESPECIAL COCIDA SALPICAO X KG" },
      { codigo: "1563", descripcion: "MORT. ESTANDAR SALPICAO X KG" },
      { codigo: "1564", descripcion: "MORTADELA EXTRA ASTURIAS X KG" },
      { codigo: "1568", descripcion: "POLLO VENCAMPO POR KG" },
      { codigo: "1569", descripcion: "PATATAS FRESCAS DOBLE COBERTURA 4X2.5KG" },
      { codigo: "1571", descripcion: "AZUCAR VENCAMPO 1X20ND" },
      { codigo: "1572", descripcion: "CAJAS DE PIZZA 1X100" },
      { codigo: "1573", descripcion: "ARVEJAS POR KILO" },
      { codigo: "1574", descripcion: "LECHE EN POLVO VENCAMPO 10X400GR" },
      { codigo: "1575", descripcion: "QUESO MOZZARELLA CORLASA 3.5KG X 4 UND" },
      { codigo: "1576", descripcion: "QUESO CREMA KRAFT 1.36 KG X 6 UND" },
      { codigo: "1577", descripcion: "QUESO CREMA KRAFT 226 GR X 36 UND" },
      { codigo: "1578", descripcion: "ARROZ BLANCO VENCAMPO 24X1KG" },
      { codigo: "1579", descripcion: "LECHE EN POLVO VENCAMPO 10X500GR" },
      { codigo: "1580", descripcion: "CARAOTAS NEG. VENCAMPO 40X500GR" },
      { codigo: "1584", descripcion: "REFRESCO 355ML X 16UND" },
      { codigo: "1585", descripcion: "AGUA MINERAL 300ML X 24UND" },
      { codigo: "1586", descripcion: "PAN DE HAMBURGUESA POR PAQUETE" },
      { codigo: "1587", descripcion: "JUGO PASTERIZADO 250ML X 24UND" },
      { codigo: "1588", descripcion: "REFRESCO 400ML X 15 UND" },
      { codigo: "1589", descripcion: "QUESO PECORINO DE MI FINCA X KG" },
      { codigo: "1590", descripcion: "QUESO PECORINO CON PIMIENTA DE MI FINCA X KG" },
      { codigo: "1591", descripcion: "QUESO AMARILLO TIPO EDAM BARRA DE MI FINCA X KG" },
      { codigo: "1592", descripcion: "SALMON POR KILO" },
      { codigo: "1593", descripcion: "NECTAR DE JUCOSA TB DURAZNO 12X1L" },
      { codigo: "1594", descripcion: "NECTAR VARIADO 12X1L" },
      { codigo: "1595", descripcion: "NECTAR JUCOSA TB PERA 12X1L" },
      { codigo: "1596", descripcion: "HARINA POR KG" },
      { codigo: "1597", descripcion: "PAN DE SANDWICH BLANCO E INTEGRAL POR PAQUETE" },
      { codigo: "1598", descripcion: "PAN ARABE Y CASABE POR PAQUETE" },
      { codigo: "1599", descripcion: "MORT. NAVIDE\xD1A SALPICAO X KG" },
      { codigo: "1600", descripcion: "FS QUESO AMARILLO TIPO EDAM BARRA DE MI FINCA X KG" },
      { codigo: "1601", descripcion: "BANDEJAS VARIAS REFERENCIAS CT1 / JT1" },
      { codigo: "1602", descripcion: "QUESO MOZARELLA POR KG" },
      { codigo: "1603", descripcion: "SALCHICHON POR KG" },
      { codigo: "1604", descripcion: "SALAMI Y PEPERONI POR KG" },
      { codigo: "1605", descripcion: "QUESO DE MANO POR KG" },
      { codigo: "1606", descripcion: "QUESO GUAYANES - AMARILLO - PAISA POR KG" },
      { codigo: "1607", descripcion: "PULPA DE CERDO POR KG" },
      { codigo: "1608", descripcion: "QUESO BLANCO MOZZARELLA MI FINCA" },
      { codigo: "1609", descripcion: "PESCADERIA (CAMARON,CALAMAR,MEJILLON,PULPO,PEPITONA,MERLUZA) POR KG" },
      { codigo: "1610", descripcion: "CHAMPI\xD1ONES Y ACEITUNAS NEGRAS" },
      { codigo: "1611", descripcion: "PALMITO Y PEPINILLOS" },
      { codigo: "1612", descripcion: "RICOTA SIN SAL, QUESO PALMITA POR KG" },
      { codigo: "1613", descripcion: "FILET DE PECHUGA INDUST. LIGHT POR KG" },
      { codigo: "1614", descripcion: "FILET DE PECHUGA A GRANEL TROPICAL POR KG" },
      { codigo: "1616", descripcion: "PAN DE PERRO CALIENTE POR PAQUETE" },
      { codigo: "1617", descripcion: "PAPAS RALLADAS PARA PERRO CALIENTE POR PAQUETE" },
      { codigo: "1618", descripcion: "SERVILLETAS, TOALLIN Y LANILLA" },
      { codigo: "1619", descripcion: "TE DE MANZANILLA Y FRUTOS ROJOS" },
      { codigo: "1620", descripcion: "VINAGRE POR GALON" },
      { codigo: "1621", descripcion: "QUESO DURO POR KG" },
      { codigo: "1622", descripcion: "LECHE EN POLVO VENCAMPO 24X125GR" },
      { codigo: "1623", descripcion: "MINI TOCINO ASTURIAS X POR KG" },
      { codigo: "1624", descripcion: "MORT. ESP D/POLLO ASTURIAS 20X500GR" },
      { codigo: "1625", descripcion: "MORTADELA ESP D/POLLO SALPICAO 20UNDX500GR" },
      { codigo: "1626", descripcion: "CHOCOLATE OSCURO - BLANCO BITTER" },
      { codigo: "1627", descripcion: "LLUVIA DE CHOCOLATE - LLUVIA DE COLORES - GOTAS DE CHOCOLATE" },
      { codigo: "1628", descripcion: "VINO BLANCO - VINO TINTO POR LITRO" },
      { codigo: "1629", descripcion: "LEVADURA, POLVO DE HORNEAR Y BICABORNATO DE SODIO POR KG" },
      { codigo: "1630", descripcion: "PAN JUMBO DELI BLANCO - DELI OREGANO POR PAQ" },
      { codigo: "1631", descripcion: "PAN CAPILLA POR UND" },
      { codigo: "1632", descripcion: "PAN RALLADO POR KG" },
      { codigo: "1633", descripcion: "CACAO Y CHOCOLATE EN POLVO POR KG" },
      { codigo: "1634", descripcion: "TOMATE ENTERO PELADO POR LATA" },
      { codigo: "1635", descripcion: "MAIZINA POR KG" },
      { codigo: "1636", descripcion: "ESENCIAS VARIAS" },
      { codigo: "1637", descripcion: "QUESO PARMESANO RALLADO POR KG" },
      { codigo: "1638", descripcion: "QUESO PAISA POR KG" },
      { codigo: "1639", descripcion: "SIERRA EN RUEDA Y PARGO ENTERO POR KG" },
      { codigo: "1640", descripcion: "UTENSILIOS DE LIMPIEZA (CEPILLO, ESPONJA,GUANTES,GORROS,PA\xD1OS)" },
      { codigo: "1641", descripcion: "QUIMICOS (CLORO, DESENGRASANTE,DESINFECTANTE,JABON)" },
      { codigo: "1642", descripcion: "ARVEJAS VENCAMPO 25 UND X 400GR" },
      { codigo: "1643", descripcion: "LOMO DE CERDO AHUM. SALPICAO POR KG" },
      { codigo: "1644", descripcion: "CARAOTAS NEGRAS VENCAMPO 25 UND X 400GR" },
      { codigo: "1646", descripcion: "ACEITE DE MAIZ POR LITRO" },
      { codigo: "1647", descripcion: "TETERAS POR UND VARIAS REFERENCIAS" },
      { codigo: "1648", descripcion: "MIEL POR LITRO" },
      { codigo: "1649", descripcion: "LUMPIAS CONGELADAS POR UND" },
      { codigo: "1650", descripcion: "CEREALES VARIOS POR UND" },
      { codigo: "1651", descripcion: "SALSAS VARIAS REFERENCIAS POR UND" },
      { codigo: "1654", descripcion: "PONCHE DE CREMA - RON A\xD1EJO - LECHE DE COCO" },
      { codigo: "1655", descripcion: "AZUCAR VENPORT 1X20ND" },
      { codigo: "1659", descripcion: "PUNTA TRASERA POR KG (UR)" },
      { codigo: "1660", descripcion: "CARNE MOLIDA PICADO DE BOVINO XKG (UR)" },
      { codigo: "1661", descripcion: "BIFE ANCHO RYBEYE (UR) POR KG" },
      { codigo: "1662", descripcion: "CONFITERIA (TORONTO, BOLERO, TURRON, ETC)" }
    ];
    MAPA_PRODUCTOS_CODIZULCA = new Map(
      PRODUCTOS_CODIZULCA.map((p) => [p.codigo, { ...p, matchExacto: true }])
    );
    PRODUCTOS_HISTORICOS_COMPLEMENTARIOS = {
      "1497": { codigo: "1497", descripcion: "MORTADELA ESP D/POLLO ASTURIAS 20UNDX500GR", matchExacto: true },
      "047": { codigo: "047", descripcion: "NUGGET CORRAL DE 460GM", matchExacto: true },
      "47": { codigo: "047", descripcion: "NUGGET CORRAL DE 460GM", matchExacto: true },
      "270": { codigo: "270", descripcion: "NUGGETS CORRAL 12X0.460GR", matchExacto: true },
      "1599": { codigo: "1599", descripcion: "MORT. NAVIDE\xD1A SALPICAO X KG", matchExacto: true }
    };
    HOMOLOGACION_EAN_PLU_ALKOSTO = {
      "7590377000411": { codigo: "1642", descripcion: "ARVEJAS VENCAMPO 25 UND X 400GR", matchExacto: true },
      "7590377000459": { codigo: "1644", descripcion: "CARAOTAS NEGRAS VENCAMPO 25 UND X 400GR", matchExacto: true },
      "7590377000503": { codigo: "1574", descripcion: "LECHE EN POLVO VENCAMPO 10X400GR", matchExacto: true },
      "7590377000510": { codigo: "1556", descripcion: "LECHE EN POLVO VENCAMPO 10X900GR", matchExacto: true },
      "7590377000077": { codigo: "1496", descripcion: "MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR", matchExacto: true },
      "7590377000589": { codigo: "1497", descripcion: "MORTADELA ESP D/POLLO ASTURIAS 20UNDX500GR", matchExacto: true },
      "7591289609129": { codigo: "21", descripcion: "MORTADELA ESP D/POLLO CORRAL 1X12UNI", matchExacto: true },
      "7591289400023": { codigo: "047", descripcion: "NUGGET CORRAL DE 460GM", matchExacto: true },
      "5412873178161": { codigo: "1360", descripcion: "PATATAS FRESCAS MARQUISE 4X2.5KG", matchExacto: true },
      "7591210000513": { codigo: "1091", descripcion: "CREMA DE LECHE PURISIMA 6 X 500 GRS", matchExacto: true },
      "7591210000544": { codigo: "1089", descripcion: "CREMA DE LECHE PURISIMA 12X250GRS", matchExacto: true },
      "021000061778": { codigo: "1577", descripcion: "QUESO CREMA KRAFT 226 GR X 36 UND", matchExacto: true },
      "21000061778": { codigo: "1577", descripcion: "QUESO CREMA KRAFT 226 GR X 36 UND", matchExacto: true },
      "100881": { codigo: "1512", descripcion: "MORT DE PAVO ASTURIAS X KG", matchExacto: true },
      "100882": { codigo: "1511", descripcion: "MORT. PECHUGA DE POLLO ASTURIAS X KG", matchExacto: true },
      "100929": { codigo: "1463", descripcion: "MORT. SUPERIOR ASTURIAS X KG", matchExacto: true },
      "100281": { codigo: "1575", descripcion: "QUESO MOZZARELLA CORLASA 3.5KG X 4 UND", matchExacto: true },
      "100253": { codigo: "46", descripcion: "NUGGETS INSTITUCIONAL CORRAL POR KG", matchExacto: true }
    };
    CODIGOS_ALFABETICOS_PROHIBIDOS = /* @__PURE__ */ new Set([
      "LPV",
      "UTH",
      "UHT",
      "QS",
      "JUGOS",
      "BEBIDAS",
      "POLLO",
      "FILET",
      "MUSLO",
      "ALAS",
      "QUESO",
      "ACEITE",
      "AZUCAR",
      "ARROZ",
      "HUEVOS",
      "PATATAS",
      "S/C",
      "SC",
      "S/N",
      "SN",
      "N/A",
      "NA",
      "NULL",
      "UNDEFINED",
      "NONE",
      "CJ",
      "CJA",
      "CAJA",
      "CAJAS",
      "BLT",
      "BTO",
      "BULTO",
      "BULTOS",
      "UND",
      "UNID",
      "UNIDAD",
      "UNIDADES",
      "KG",
      "KGS",
      "KILO",
      "KILOS"
    ]);
    BRAND_AND_GENERIC_TOKENS = /* @__PURE__ */ new Set([
      "VENCAMPO",
      "VENPORT",
      "PURISIMA",
      "ASTURIAS",
      "ASTURIA",
      "SALPICAO",
      "CORRAL",
      "MARQUISE",
      "CORLASA",
      "KRAFT",
      "FINCA",
      "JUCOSA",
      "SIMON",
      "SAN",
      "MONTANA",
      "TORONDOY",
      "FRESCAMPO",
      "AURORA",
      "PRADERA",
      "VALLE",
      "HONDO",
      "FLORA",
      "DONA",
      "DO\xD1A",
      "TROPICAL",
      "DELI",
      "JUMBO",
      "COMPLETA",
      "ESPECIAL",
      "ESP",
      "SUPERIOR",
      "EXTRA",
      "ESTANDAR",
      "ECONOM",
      "ECONOMICA",
      "INSTITUCIONAL",
      "INDUSTRIAL",
      "INDUST",
      "BLANCO",
      "BLANCA",
      "BLANCAS",
      "NEGRO",
      "NEGRA",
      "NEGRAS",
      "NEG",
      "VERDE",
      "VERDES",
      "ROJO",
      "ROJA",
      "ROJAS",
      "AMARILLO",
      "AMARILLA"
    ]);
  }
});

// src/services/alkostoService.ts
function getSucursalByTag(tag) {
  const norm = (tag || "").trim().toUpperCase();
  if (!norm) return void 0;
  const cleanDigits = norm.replace(/^0+/, "");
  return TODAS_SUCURSALES_CUENTAS_CLAVE.find(
    (s) => s.tag === norm || s.codigo === norm || cleanDigits && s.codigo.replace(/^0+/, "") === cleanDigits
  );
}
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
    const match = CATALOGO_ALKOSTO.find((p) => p.codigoBarra && normalizarCodigoProducto(p.codigoBarra) === codNorm);
    if (match && (!descNorm || !hasPrimaryNounConflict(match.producto, descNorm))) return match;
  }
  if (codNorm) {
    const match = CATALOGO_ALKOSTO.find((p) => p.sku.toUpperCase() === codNorm);
    if (match && (!descNorm || !hasPrimaryNounConflict(match.producto, descNorm))) return match;
  }
  if (codNorm) {
    const match = CATALOGO_ALKOSTO.find((p) => p.codigosCadena && p.codigosCadena.some((c) => normalizarCodigoProducto(c).toUpperCase() === codNorm));
    if (match && (!descNorm || !hasPrimaryNounConflict(match.producto, descNorm))) return match;
  }
  if (codNorm) {
    const match = CATALOGO_ALKOSTO.find((p) => p.sinonimos && p.sinonimos.some((s) => normalizarCodigoProducto(s).toUpperCase() === codNorm));
    if (match && (!descNorm || !hasPrimaryNounConflict(match.producto, descNorm))) return match;
  }
  const hasExplicitUnmatchedNumericCode = codNorm.length >= 4 && /^\d+$/.test(codNorm);
  if (descNorm) {
    let match = CATALOGO_ALKOSTO.find(
      (p) => p.producto.toUpperCase() === descNorm || p.sinonimos && p.sinonimos.some((s) => s.toUpperCase() === descNorm)
    );
    if (match && !hasPrimaryNounConflict(match.producto, descNorm)) return match;
    if (hasExplicitUnmatchedNumericCode) {
      return void 0;
    }
    match = CATALOGO_ALKOSTO.find((p) => {
      if (hasPrimaryNounConflict(p.producto, descNorm)) return false;
      const pNorm = p.producto.toUpperCase();
      if (descNorm.includes(pNorm) || pNorm.includes(descNorm)) return true;
      if (p.sinonimos && p.sinonimos.some((s) => s.length >= 6 && descNorm.includes(s.toUpperCase()))) return true;
      return false;
    });
    if (match) return match;
    const tokens = descNorm.split(/\s+/).filter((t) => t.length > 2 && !["POR", "CON", "DEL", "LOS", "LAS", "PARA", "MAS"].includes(t) && !isBrandOrPresentationToken(t));
    if (tokens.length > 0) {
      match = CATALOGO_ALKOSTO.find((p) => {
        if (hasPrimaryNounConflict(p.producto, descNorm)) return false;
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
var import_firestore2, SUCURSALES_ALKOSTO, SUCURSALES_FAMILIA_CENTER, CADENAS_ABREVIATURAS, TODAS_SUCURSALES_CUENTAS_CLAVE, CATALOGO_ALKOSTO;
var init_alkostoService = __esm({
  "src/services/alkostoService.ts"() {
    import_firestore2 = require("firebase/firestore");
    init_firebase();
    init_authService();
    init_productosCodizulca();
    SUCURSALES_ALKOSTO = [
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
    SUCURSALES_FAMILIA_CENTER = [
      { codigo: "7490", tag: "FC01", nombre: "Familia Center 1 - Plaza lago", zona: "Plaza lago", direccion: "Plaza lago" },
      { codigo: "7492", tag: "FC02", nombre: "Familia Center 2", zona: "URB monte claro", direccion: "Calle43entre Av 150 416N\xB015-041 URB monte claro" },
      { codigo: "7494", tag: "FC03", nombre: "Familia Center 3", zona: "Parroquia Coquivacoa", direccion: "CalleJ con Av 12 distinguido bajo el NJ-10 de nomenclatura municipal en jurisdicci\xF3n parroquia coquivacoa el municipio aut\xF3nomo Maracaibo estado Zulia." },
      { codigo: "7491", tag: "FC04", nombre: "Familia 4 - Dr quintero", zona: "Dr quintero", direccion: "Dr quintero" },
      { codigo: "7489", tag: "FC05", nombre: "Familia Center 5 - La lago", zona: "La lago", direccion: "La lago" },
      { codigo: "7493", tag: "FC06", nombre: "Familia 6 - Los olivos", zona: "Los olivos", direccion: "Los olivos" },
      { codigo: "8229", tag: "FC07", nombre: "Familia Center #7 - San Francisco", zona: "San Francisco", direccion: "San Francisco" }
    ];
    CADENAS_ABREVIATURAS = {
      ALKOSTO: ["AK01", "AK02", "AK03", "AK04", "AK05", "AK06", "AK07", "AK08", "AK09", "AK10"],
      FAMILIA_CENTER: ["FC01", "FC02", "FC03", "FC04", "FC05", "FC06", "FC07"]
    };
    TODAS_SUCURSALES_CUENTAS_CLAVE = [
      ...SUCURSALES_ALKOSTO,
      ...SUCURSALES_FAMILIA_CENTER
    ];
    CATALOGO_ALKOSTO = [
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
        sku: "1536",
        producto: "LECHE EN POLVO VENCAMPO 10X1KG",
        categoria: "LACTEOS",
        presentacion: "Bulto (10 und x 1kg)",
        kilosPorCaja: 10,
        precioSugeridoUSD: 0,
        codigosCadena: ["1536"],
        sinonimos: ["LECHE EN POLVO VENCAMPO 10X1KG", "LECHE EN POLVO COMPLETA VENCAMPO 1KG", "LECHE VENCAMPO 1KG", "1536"],
        unidadSugerida: "CJ"
      },
      {
        sku: "1556",
        producto: "LECHE EN POLVO VENCAMPO 10X900GR",
        categoria: "LACTEOS",
        presentacion: "Bulto (10 und x 900g)",
        kilosPorCaja: 9,
        precioSugeridoUSD: 0,
        codigosCadena: ["1556"],
        sinonimos: ["LECHE EN POLVO VENCAMPO 10X900GR", "LECHE EN POLVO COMPLETA VENCAMPO 900GR", "LECHE VENCAMPO 900GR", "1556"],
        unidadSugerida: "CJ"
      },
      {
        sku: "1574",
        producto: "LECHE EN POLVO VENCAMPO 10X400GR",
        categoria: "LACTEOS",
        presentacion: "Bulto (10 und x 400g)",
        kilosPorCaja: 4,
        precioSugeridoUSD: 0,
        codigosCadena: ["1574"],
        sinonimos: ["LECHE EN POLVO VENCAMPO 10X400GR", "LECHE EN POLVO COMPLETA VENCAMPO 400GR", "LECHE VENCAMPO 400GR", "1574"],
        unidadSugerida: "CJ"
      },
      {
        sku: "1579",
        producto: "LECHE EN POLVO VENCAMPO 10X500GR",
        categoria: "LACTEOS",
        presentacion: "Bulto (10 und x 500g)",
        kilosPorCaja: 5,
        precioSugeridoUSD: 0,
        codigosCadena: ["1579"],
        sinonimos: ["LECHE EN POLVO VENCAMPO 10X500GR", "LECHE EN POLVO COMPLETA VENCAMPO 500GR", "LECHE VENCAMPO 500GR", "1579"],
        unidadSugerida: "CJ"
      },
      {
        sku: "7590377000503",
        producto: "LECHE EN POLVO COMPLETA VENCAMPO 400GR",
        categoria: "LACTEOS",
        presentacion: "Bulto (10 und x 400g)",
        kilosPorCaja: 4,
        precioSugeridoUSD: 40,
        codigoBarra: "7590377000503",
        codigosCadena: ["7590377000503"],
        sinonimos: ["LECHE EN POLVO COMPLETA VENCAMPO 400GR", "LECHE VENCAMPO 400GR", "7590377000503"],
        unidadSugerida: "CJ"
      },
      {
        sku: "7590377000510",
        producto: "LECHE EN POLVO COMPLETA VENCAMPO 900GR",
        categoria: "LACTEOS",
        presentacion: "Bulto (10 und x 900g)",
        kilosPorCaja: 9,
        precioSugeridoUSD: 90,
        codigoBarra: "7590377000510",
        codigosCadena: ["7590377000510"],
        sinonimos: ["LECHE EN POLVO COMPLETA VENCAMPO 900GR", "LECHE VENCAMPO 900GR", "7590377000510"],
        unidadSugerida: "CJ"
      },
      {
        sku: "1642",
        producto: "ARVEJAS VENCAMPO 25 UND X 400GR",
        categoria: "GRANOS / BASICOS",
        presentacion: "Bulto (25 und x 400g)",
        kilosPorCaja: 10,
        precioSugeridoUSD: 20,
        codigoBarra: "7590377000411",
        codigosCadena: ["1642", "001642", "7590377000411"],
        sinonimos: ["ARVEJAS VERDES VENCAMPO 400GR", "ARVEJAS VENCAMPO 25 UND X 400GR", "ARVEJAS VENCAMPO 400GR", "1642", "7590377000411"],
        unidadSugerida: "CJ"
      },
      {
        sku: "1644",
        producto: "CARAOTAS NEGRAS VENCAMPO 25 UND X 400GR",
        categoria: "GRANOS / BASICOS",
        presentacion: "Bulto (25 und x 400g)",
        kilosPorCaja: 10,
        precioSugeridoUSD: 20,
        codigoBarra: "7590377000459",
        codigosCadena: ["1644", "001644", "7590377000459"],
        sinonimos: ["CARAOTAS NEGRAS VENCAMPO 400GR", "CARAOTAS NEGRAS VENCAMPO 25 UND X 400GR", "CARAOTAS VENCAMPO 400GR", "1644", "7590377000459"],
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
    (() => {
      const existingSkus = new Set(CATALOGO_ALKOSTO.map((c) => String(c.sku).trim()));
      for (const prod of PRODUCTOS_CODIZULCA) {
        if (!existingSkus.has(prod.codigo)) {
          const isKg = /\b(X\s*KG|POR\s*KG|A\s+GRANEL)\b/i.test(prod.descripcion);
          CATALOGO_ALKOSTO.push({
            sku: prod.codigo,
            producto: prod.descripcion,
            categoria: "CATALOGO CODIZULCA",
            presentacion: isKg ? "KG" : "CJ",
            kilosPorCaja: isKg ? 1 : 10,
            precioSugeridoUSD: 0,
            codigosCadena: [prod.codigo],
            sinonimos: [prod.descripcion, prod.codigo],
            unidadSugerida: isKg ? "KG" : "CJ"
          });
          existingSkus.add(prod.codigo);
        }
      }
    })();
  }
});

// src/services/alkostoOcParser.ts
function buildAlkostoOcSystemPrompt(abrevAlkosto = CADENAS_ABREVIATURAS?.ALKOSTO || ["AK01", "AK02", "AK03", "AK04", "AK05", "AK06", "AK07", "AK08", "AK09", "AK10"], abrevFamilia = CADENAS_ABREVIATURAS?.FAMILIA_CENTER || ["FC01", "FC02", "FC03", "FC04", "FC05", "FC06", "FC07"]) {
  const akTagsStr = (abrevAlkosto || []).join(", ");
  const fcTagsStr = (abrevFamilia || []).join(", ");
  const sucursalesAkDetalle = (SUCURSALES_ALKOSTO || []).map((s) => `${s.tag || s.codigo}: "${s.nombre}" (ID ${s.codigo})`).join(" | ");
  const sucursalesFcDetalle = (SUCURSALES_FAMILIA_CENTER || []).map((s) => `${s.tag || s.codigo}: "${s.nombre}" (ID ${s.codigo})`).join(" | ");
  const catalogoOficial158Str = formatCatalogoCodizulcaForPrompt();
  return `ROL Y OBJETIVO:
Eres un motor experto en extracci\xF3n de datos contables y comerciales (OCR + Comprensi\xF3n Documental) especializado en procesar \xD3rdenes de Compra emitidas por ALKOSTO y FAMILIA CENTER para ser integradas autom\xE1ticamente en la Nota de Pedido de Codizulca.

TAREA PRINCIPAL:
Analiza minuciosamente la imagen, captura o documento PDF adjunto correspondiente a una Orden de Compra de ALKOSTO / FAMILIA CENTER en TODAS sus p\xE1ginas. Extrae la totalidad de los datos de cabecera, todos los renglones de productos, c\xF3digos, el desglose de cantidades por tienda/sucursal y los montos financieros, sin omitir ni resumir ning\xFAn \xEDtem.

REGLA OBLIGATORIA DE CAT\xC1LOGO OFICIAL DE CODIZULCA Y PROHIBICI\xD3N DE ALUCINACI\xD3N DE SKU:
- PROHIBIDO inventar c\xF3digos alfab\xE9ticos o siglas (como 'LPV').
- PROHIBIDO asignar un SKU por coincidencia parcial de marca + gramaje (ej. NUNCA asignes el c\xF3digo 1555 "LECHE EN POLVO VENCAMPO 20X400GR" a "ARVEJAS VERDES VENCAMPO 400GR" ni a "CARAOTAS NEGRAS VENCAMPO 400GR" solo porque comparten "VENCAMPO" y "400GR").
- Prioriza el match por: 1) C\xF3digo EAN/Barra exacto (7590377000411 -> 1642, 7590377000459 -> 1644), 2) Coincidencia OBLIGATORIA del sustantivo principal del producto (ARVEJAS, CARAOTAS, LECHE, MORTADELA, QUESO, etc.) + gramaje.
- Si un producto del PDF no tiene coincidencia exacta de sustantivo principal o EAN en el cat\xE1logo, conserva la descripci\xF3n original del PDF (ej. "ARVEJAS VERDES VENCAMPO 400GR/1.00") y el c\xF3digo EAN o marca el SKU como "PENDIENTE" en lugar de sobreescribirlo con otro producto.

CAT\xC1LOGO OFICIAL DE CODIZULCA (codigo - descripcion):
${catalogoOficial158Str}

17 TIENDAS V\xC1LIDAS SINCRONIZADAS EN BASE DE DATOS (\xDANICAS PERMITIDAS):
- Alkosto (${akTagsStr}): ${sucursalesAkDetalle}
- Familia Center (${fcTagsStr}): ${sucursalesFcDetalle}
- PROHIBIDO extraer las columnas administrativas "AKOP", "FCOP" o "CI": ign\xF3ralas por completo.

REGLAS ESTRICTAS DE EXTRACCI\xD3N Y NORMALIZACI\xD3N:
1. LECTURA MULTIP\xC1GINA Y UNIFICACI\xD3N (ALKOSTO + FAMILIA CENTER):
   - Lee todas las p\xE1ginas del documento (unificando la secci\xF3n de P\xE1gina 1 "ALKOSTO DONDE COMPRAR ES GANAR, C.A." y la de P\xE1gina 2 "FAMILIA CENTER, C.A.").
   - Nunca utilices comentarios como "// resto de los \xEDtems".
2. EXCLUSI\xD3N DE COLUMNAS EXTRA (AKOP / CI) Y EXTRACCI\xD3N DE LAS 17 TIENDAS:
   - Extrae \xFAnicamente las 17 tiendas v\xE1lidas sincronizadas en base de datos (${akTagsStr} y ${fcTagsStr}).
   - Ignora por completo las columnas "AKOP", "FCOP" y "CI" que aparecen en las tablas del PDF.
3. CONSOLIDACI\xD3N POR C\xD3DIGO DE PRODUCTO SIN DUPLICADOS Y HOMOLOGACI\xD3N:
   - Si el mismo c\xF3digo de producto aparece en la p\xE1gina de ALKOSTO (AK01..AK10) y en la p\xE1gina de FAMILIA CENTER (FC01..FC07), consolida sus cantidades por tienda en un \xFAnico rengl\xF3n por producto dentro de \`tiendas\` y en \`distribucion_tiendas\` / \`desglosePorTienda\`, evitando claves o filas duplicadas.
   - Homologaci\xF3n directa de EAN/PLU frecuentes en \xD3rdenes de Compra de Alkosto hacia el Cat\xE1logo Oficial de Codizulca:
     * 7590377000411 (ARVEJAS VERDES VENCAMPO 400GR) -> codigo: "1642", descripcion: "ARVEJAS VENCAMPO 25 UND X 400GR", unidad: "BULTO"
     * 7590377000459 (CARAOTAS NEGRAS VENCAMPO 400GR) -> codigo: "1644", descripcion: "CARAOTAS NEGRAS VENCAMPO 25 UND X 400GR", unidad: "BULTO"
     * 7590377000503 (LECHE EN POLVO COMPLETA VENCAMPO 400GR) -> codigo: "1574", descripcion: "LECHE EN POLVO VENCAMPO 10X400GR", unidad: "BULTO"
     * 7590377000510 (LECHE EN POLVO COMPLETA VENCAMPO 900GR) -> codigo: "1556", descripcion: "LECHE EN POLVO VENCAMPO 10X900GR", unidad: "BULTO"
     * LECHE EN POLVO VENCAMPO 10X1KG -> codigo: "1536", descripcion: "LECHE EN POLVO VENCAMPO 10X1KG", unidad: "BULTO"
     * LECHE EN POLVO VENCAMPO 10X500GR -> codigo: "1579", descripcion: "LECHE EN POLVO VENCAMPO 10X500GR", unidad: "BULTO"
     * LECHE EN POLVO VENCAMPO 20X400GR -> codigo: "1555", descripcion: "LECHE EN POLVO VENCAMPO 20X400GR", unidad: "BULTO"
     * LECHE EN POLVO VENCAMPO 20X500GR -> codigo: "1544", descripcion: "LECHE EN POLVO VENCAMPO 20X500GR", unidad: "BULTO"
     * 7591289609129 -> codigo: "21", descripcion: "MORTADELA ESP D/POLLO CORRAL 1X12UNI", unidad: "CJ"
     * 7591289400023 -> codigo: "047", descripcion: "NUGGET CORRAL DE 460GM", unidad: "UND"
     * 5412873178161 -> codigo: "1360", descripcion: "PATATAS FRESCAS MARQUISE 4X2.5KG", unidad: "CJ"
     * 7590377000077 -> codigo: "1496", descripcion: "MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR", unidad: "CJ"
     * 7590377000589 -> codigo: "1497", descripcion: "MORTADELA ESP D/POLLO ASTURIAS 20UNDX500GR", unidad: "CJ"
     * 100881 -> codigo: "1512", descripcion: "MORT DE PAVO ASTURIAS X KG", unidad: "KG"
     * 100882 -> codigo: "1511", descripcion: "MORT. PECHUGA DE POLLO ASTURIAS X KG", unidad: "KG"
     * 100929 -> codigo: "1463", descripcion: "MORT. SUPERIOR ASTURIAS X KG", unidad: "KG"
     * 100281 -> codigo: "1575", descripcion: "QUESO MOZZARELLA CORLASA 3.5KG X 4 UND", unidad: "KG"
     * 7591210000513 -> codigo: "1091", descripcion: "CREMA DE LECHE PURISIMA 6 X 500 GRS", unidad: "CJ"
     * 7591210000544 -> codigo: "1089", descripcion: "CREMA DE LECHE PURISIMA 12X250GRS", unidad: "CJ"
   - Elimina siempre el sufijo de PVP sugerido tras la barra en la descripci\xF3n (ej. quitar "/ 2.40", "/ 6.88") cuando el producto s\xED tiene match exacto en el cat\xE1logo.
4. EXTRACCI\xD3N QUIR\xDARGICA DE \`valorUnitarioOC\` Y SANITIZACI\xD3N DE ARTEFACTOS OCR (\`15:00\` -> \`15.00\`):
   - Extrae con precisi\xF3n quir\xFArgica el \`valorUnitarioOC\` (Precio/Valor Unitario impreso en la Orden de Compra por cada unidad de empaque solicitada, sin confundirlo con el subtotal ni con impuestos).
   - El sistema NUNCA debe inventar precios ni alterar el Valor Unitario que viene en la Orden de Compra. Calcula \`subtotal\` = \`cantidad * valorUnitarioOC\`.
   - Si en alguna columna de tienda el PDF/OCR muestra dos puntos en lugar de punto decimal (ej. "15:00" en AK03 o "0:00" en AK08), corr\xEDgelo a "15.00" y "0.00".
   - Normaliza todos los n\xFAmeros eliminando comas de miles ("9,600.00" -> 9600, "1,900.00" -> 1900) y reduciendo costos de 4 decimales ("20.0000" -> 20, "40.0000" -> 40).
   - Usa punto \`.\` exclusivamente como separador decimal y elimina s\xEDmbolos de moneda \`$\`, \`Bs\`, \`%\`.
5. CABECERA COMPLETA Y VALIDACI\xD3N ARITM\xC9TICA:
   - Extrae la cabecera completa: \`numero_orden\`, \`fecha_emision\`, \`fecha_entrega\`, \`dias_credito\`, \`tasa_cambio\` y \`observaciones\`.
   - Comprueba en cada rengl\xF3n si \`cantidad * valorUnitarioOC\` coincide con \`subtotal\`. Si hay discrepancia por lectura borrosa en foto, prioriza valores legibles y marca \`alerta_revision: true\`.
6. SALIDA JSON PURA:
   - Devuelve \xDANICAMENTE un objeto JSON v\xE1lido sin bloques Markdown (\`\`\`json) ni texto adicional.

ESQUEMA JSON DE SALIDA REQUERIDO:
{
  "numero_orden": "0000054457",
  "fecha_emision": "YYYY-MM-DD",
  "fecha_entrega": "YYYY-MM-DD",
  "dias_credito": 10,
  "tasa_cambio": 872.3927,
  "observaciones": "string | null",
  "subtotal_alkosto": 0.0,
  "subtotal_familia_center": 0.0,
  "total_factura": 0.0,
  "cabecera_orden": {
    "cliente_emisor": "ALKOSTO",
    "receptor_destino": "CODIZULCA",
    "numero_orden_compra": "string",
    "fecha_emision": "YYYY-MM-DD",
    "fecha_entrega_estimada": "YYYY-MM-DD | null",
    "dias_credito": 10,
    "tasa_cambio": 872.3927,
    "moneda": "USD",
    "condicion_pago": "string | null",
    "observaciones_generales": "string | null"
  },
  "renglones": [
    {
      "numero_renglon": 1,
      "codigo": "1574",
      "codigo_principal": "1574",
      "codigo_ean": "string | null",
      "codigo_interno_alkosto": "string | null",
      "descripcion": "LECHE EN POLVO VENCAMPO 10X400GR",
      "descripcion_producto": "LECHE EN POLVO VENCAMPO 10X400GR",
      "unidad": "BULTO",
      "unidad_medida": "CJ",
      "unidades_por_empaque": 1,
      "cantidad": 240.0,
      "cantidad_total": 240.0,
      "valorUnitarioOC": 40.0,
      "costo_unitario": 40.0,
      "subtotal": 9600.0,
      "monto_total_renglon": 9600.0,
      "tiendas": {
        "AK01": 0.0,
        "FC01": 0.0
      },
      "distribucion_tiendas": [
        {
          "codigo_tienda": "AK01",
          "nombre_tienda": "string",
          "cantidad": 0.0
        }
      ],
      "porcentaje_descuento": 0.0,
      "porcentaje_impuesto": 0.0,
      "alerta_revision": false,
      "nota_revision": "string | null"
    }
  ],
  "resumen_totales": {
    "total_renglones_extraidos": 0,
    "total_unidades_pedidas": 0.0,
    "subtotal_neto": 0.0,
    "total_descuentos": 0.0,
    "total_impuestos": 0.0,
    "monto_total_orden": 0.0,
    "cuadre_aritmetico_correcto": true
  }
}`;
}
function sanitizeBase64Payload(rawBase64) {
  if (!rawBase64 || typeof rawBase64 !== "string") return "";
  const readerResult = rawBase64.trim().replace(/^data:(image\/[\w.+-]+|application\/pdf);base64,/i, "").replace(/^data:[^;]+;base64,/i, "");
  const base64Data = readerResult.includes(",") ? readerResult.split(",")[1] || "" : readerResult;
  return base64Data.replace(/\s+/g, "");
}
function detectAlkostoFileMimeType(bytesOrBase64, declaredMimeType, fileName) {
  if (bytesOrBase64) {
    if (typeof bytesOrBase64 === "string") {
      const cleanB64 = sanitizeBase64Payload(bytesOrBase64);
      if (cleanB64.startsWith("JVBERi0")) return "application/pdf";
      if (cleanB64.startsWith("iVBORw0KGgo")) return "image/png";
      if (cleanB64.startsWith("UklGR")) return "image/webp";
      if (cleanB64.startsWith("/9j/")) return "image/jpeg";
    } else if (bytesOrBase64.length >= 4) {
      const b0 = bytesOrBase64[0];
      const b1 = bytesOrBase64[1];
      const b2 = bytesOrBase64[2];
      const b3 = bytesOrBase64[3];
      if (b0 === 37 && b1 === 80 && b2 === 68 && b3 === 70) {
        return "application/pdf";
      }
      if (b0 === 137 && b1 === 80 && b2 === 78 && b3 === 71) {
        return "image/png";
      }
      if (bytesOrBase64.length >= 12 && b0 === 82 && b1 === 73 && b2 === 70 && b3 === 70 && bytesOrBase64[8] === 87 && bytesOrBase64[9] === 69 && bytesOrBase64[10] === 66 && bytesOrBase64[11] === 80) {
        return "image/webp";
      }
      if (b0 === 255 && b1 === 216 && b2 === 255) {
        return "image/jpeg";
      }
    }
  }
  const normMime = String(declaredMimeType || "").trim().toLowerCase();
  if (normMime === "application/pdf" || normMime.includes("pdf")) return "application/pdf";
  if (normMime === "image/png" || normMime.includes("png")) return "image/png";
  if (normMime === "image/webp" || normMime.includes("webp")) return "image/webp";
  if (normMime === "image/jpeg" || normMime === "image/jpg" || normMime.includes("jpeg") || normMime.includes("jpg")) {
    return "image/jpeg";
  }
  const ext = String(fileName || "").trim().toLowerCase();
  if (ext.endsWith(".pdf")) return "application/pdf";
  if (ext.endsWith(".png")) return "image/png";
  if (ext.endsWith(".webp")) return "image/webp";
  if (ext.endsWith(".jpg") || ext.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}
function extractCleanJson(text) {
  if (!text || typeof text !== "string") return null;
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  if (!stripped) return null;
  try {
    return JSON.parse(stripped);
  } catch {
    const firstBrace = stripped.indexOf("{");
    const lastBrace = stripped.lastIndexOf("}");
    const firstBracket = stripped.indexOf("[");
    const lastBracket = stripped.lastIndexOf("]");
    let startIdx = -1;
    let endIdx = -1;
    if (firstBrace !== -1 && lastBrace > firstBrace && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
      endIdx = lastBrace;
    } else if (firstBracket !== -1 && lastBracket > firstBracket) {
      startIdx = firstBracket;
      endIdx = lastBracket;
    } else if (firstBrace !== -1 && lastBrace > firstBrace) {
      startIdx = firstBrace;
      endIdx = lastBrace;
    }
    if (startIdx === -1 || endIdx <= startIdx) {
      return null;
    }
    const candidate = stripped.slice(startIdx, endIdx + 1).replace(/^\s*\/\/.*$/gm, "").replace(/,\s*\/\/[^\r\n]*/g, ",").replace(/([0-9"truefalsenull\]}])\s*\/\/[^\r\n]*/g, "$1").replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
}
async function callGeminiWithFallback(params) {
  const cleanBase64 = sanitizeBase64Payload(params.base64Data);
  if (!cleanBase64) {
    throw new AlkostoOcrStageError("1-Archivo", "El archivo Base64 est\xE1 vac\xEDo o corrupto.");
  }
  const detectedMime = detectAlkostoFileMimeType(cleanBase64, params.mimeType, params.fileName);
  const rawKeys = Array.isArray(params.apiKeys) ? params.apiKeys : [params.apiKeys];
  const validKeys = Array.from(
    new Set(
      rawKeys.filter(Boolean).flatMap((k) => String(k).split(",")).map((k) => k.trim().replace(/^["']+|["']+$/g, "").trim()).filter((k) => k.length > 10 && k !== "undefined" && k !== "null")
    )
  );
  if (validKeys.length === 0) {
    throw new AlkostoOcrStageError(
      "2-Conexi\xF3n Gemini-Render",
      "No se encontr\xF3 la clave GEMINI_API_KEY configurada en las variables de entorno (GEMINI_API_KEY / VITE_GEMINI_API_KEY).",
      { statusCode: 503, code: "AI_API_KEY_UNAVAILABLE" }
    );
  }
  const { GoogleGenAI: GoogleGenAI2 } = await import("@google/genai");
  const systemInstruction = params.systemInstruction || buildAlkostoOcSystemPrompt();
  const prompt = params.prompt || `Analiza minuciosamente todas las p\xE1ginas de la Orden de Compra de ALKOSTO y FAMILIA CENTER adjunta. Unifica las cantidades por tienda \xFAnicamente para las 17 tiendas v\xE1lidas (${(CADENAS_ABREVIATURAS?.ALKOSTO || []).join(", ")} y ${(CADENAS_ABREVIATURAS?.FAMILIA_CENTER || []).join(", ")}), ignorando por completo AKOP y CI. Normaliza todos los montos sin comas de miles y devuelve \xDANICAMENTE el objeto JSON v\xE1lido.`;
  const activeSchema = params.responseSchema !== void 0 ? params.responseSchema : ALKOSTO_OC_RESPONSE_SCHEMA;
  let lastError = null;
  let lastStage = "2-Conexi\xF3n Gemini-Render";
  for (let keyIdx = 0; keyIdx < validKeys.length; keyIdx++) {
    const apiKey = validKeys[keyIdx];
    const ai = new GoogleGenAI2({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    for (const modelName of ALKOSTO_OCR_MODEL_CASCADE) {
      let useSchemaForModel = Boolean(activeSchema);
      for (let retryAttempt = 1; retryAttempt <= 2; retryAttempt++) {
        try {
          lastStage = "2-Conexi\xF3n Gemini-Render";
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: "user",
                parts: [
                  { inlineData: { data: cleanBase64, mimeType: detectedMime } },
                  { text: prompt }
                ]
              }
            ],
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              ...useSchemaForModel && activeSchema ? { responseSchema: activeSchema } : {},
              temperature: 0.1
            }
          });
          const rawText = String(response?.text || "").trim();
          if (!rawText) {
            throw new AlkostoOcrStageError("3-Parseo JSON", `El modelo ${modelName} devolvi\xF3 una respuesta vac\xEDa.`);
          }
          lastStage = "3-Parseo JSON";
          const parsedJson = extractCleanJson(rawText);
          if (!parsedJson || typeof parsedJson !== "object") {
            throw new AlkostoOcrStageError(
              "3-Parseo JSON",
              `El modelo ${modelName} devolvi\xF3 texto que no pudo convertirse en JSON v\xE1lido.`
            );
          }
          return {
            rawText,
            parsedJson,
            modelUsed: modelName,
            usedModel: modelName
          };
        } catch (err) {
          lastError = err;
          const errMsg = String(err?.message || err);
          console.warn(
            `[callGeminiWithFallback] Intento ${retryAttempt}/2 en key#${keyIdx + 1} / modelo ${modelName}: ${errMsg.slice(0, 220)}`
          );
          if (useSchemaForModel && /INVALID_ARGUMENT|response_schema|responseSchema|400/i.test(errMsg)) {
            useSchemaForModel = false;
            continue;
          }
          const isTransientNetworkOr503 = /503|UNAVAILABLE|overloaded|ETIMEDOUT|ECONNRESET|fetch failed|network/i.test(errMsg);
          if (isTransientNetworkOr503 && retryAttempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 450 * retryAttempt));
            continue;
          }
          break;
        }
      }
      const lastErrMsg = String(lastError?.message || "");
      if (/API_KEY_INVALID|API key not valid|reported as leaked|PERMISSION_DENIED/i.test(lastErrMsg)) {
        break;
      }
    }
  }
  if (lastError instanceof AlkostoOcrStageError) {
    throw lastError;
  }
  const finalMsg = String(lastError?.message || "Fallo al conectar con los modelos Gemini en cascada.");
  throw new AlkostoOcrStageError(lastStage, finalMsg, {
    statusCode: lastError?.status || lastError?.statusCode || 503,
    code: lastError?.code
  });
}
function construirDistribucionPorTienda(tiendas) {
  if (!tiendas || typeof tiendas !== "object") return [];
  const list = [];
  for (const [rawTag, rawQty] of Object.entries(tiendas)) {
    const tag = rawTag.trim().toUpperCase();
    const cantidad = parseNumeroEstricto(rawQty, 0);
    if (cantidad <= 0 || tag === "CI" || tag === "AKOP" || tag === "FCOP") continue;
    const sucursalInfo = getSucursalByTag(tag);
    list.push({
      codigoTienda: tag,
      nombreTienda: sucursalInfo?.nombre || tag,
      cantidad: Number(cantidad.toFixed(2))
    });
  }
  return list;
}
function construirDistribucionTiendasCanonico(tiendas, customStoreItems, fallbackSingleStore) {
  const fromMap = construirDistribucionPorTienda(tiendas).map((d) => ({
    codigo_tienda: d.codigoTienda || null,
    nombre_tienda: d.nombreTienda,
    cantidad: d.cantidad
  }));
  if (fromMap.length > 0) {
    return fromMap;
  }
  if (Array.isArray(customStoreItems) && customStoreItems.length > 0) {
    const validCustom = customStoreItems.filter((c) => c.cantidad > 0);
    if (validCustom.length > 0) {
      return validCustom.map((c) => ({
        codigo_tienda: c.codigo_tienda || null,
        nombre_tienda: c.nombre_tienda || "ALKOSTO",
        cantidad: Number(c.cantidad.toFixed(2))
      }));
    }
  }
  if (fallbackSingleStore && (fallbackSingleStore.cantidad ?? 0) > 0) {
    const rawCode = fallbackSingleStore.codigoTienda ? String(fallbackSingleStore.codigoTienda).trim() : null;
    const suc = rawCode ? getSucursalByTag(rawCode) : void 0;
    return [
      {
        codigo_tienda: suc?.tag || suc?.codigo || rawCode || null,
        nombre_tienda: suc?.nombre || fallbackSingleStore.nombreTienda || "ALKOSTO",
        cantidad: Number((fallbackSingleStore.cantidad ?? 0).toFixed(2))
      }
    ];
  }
  return [];
}
function parseNumeroEstricto(val, defaultVal = 0) {
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : defaultVal;
  }
  if (val === null || val === void 0) return defaultVal;
  const raw = String(val).trim().replace(/(\d+):(\d{2})\b/g, "$1.$2");
  if (!raw) return defaultVal;
  const cleaned = raw.replace(/(?:Bs\.?|USD|US\$|\$|%|€|\s)+/gi, "");
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
function normalizarFechaISOAlkosto(fechaRaw) {
  const s = String(fechaRaw || "").trim();
  if (!s || s.toLowerCase() === "null") return null;
  const ymd = s.match(/^(\d{4})[/-](\d{2})[/-](\d{2})$/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  }
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    const yyyy = dmy[3];
    return `${yyyy}-${mm}-${dd}`;
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
function sanitizeAlkostoRawPdfText(rawText) {
  if (!rawText) return "";
  const colonFixed = rawText.replace(/(?<![:\d])(\d+)[;:](\d{2})(?![:\d]|\s*(?:A\.?\s*M\.?|P\.?\s*M\.?)\b)/gi, "$1.$2");
  const rawLines = colonFixed.split(/\r?\n/);
  const normalizedLines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const curr = rawLines[i].trim();
    if (!curr) continue;
    const next = (rawLines[i + 1] || "").trim();
    if (/^\d{4,14}$/.test(curr) && next && /^[A-ZÁÉÍÓÚÑ]/i.test(next) && !/^SubTotal/i.test(next)) {
      normalizedLines.push(`${curr} ${next}`);
      i++;
      continue;
    }
    if (/^\d{4,14}\s+[A-ZÁÉÍÓÚÑ]/i.test(curr) && (curr.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) || []).length < 8 && next && !/^\d{4,14}\s+[A-ZÁÉÍÓÚÑ]/i.test(next) && !/^SubTotal/i.test(next) && (/^\/?\s*\d+(?:\.\d+)?\b/.test(next) || /^[A-ZÁÉÍÓÚÑ0-9\s.,/-]+?\b(?:GR|GRS|KG|KGS|LT|LTS|ML|UND|UNI|PZA)\s*\/\s*\d+(?:\.\d+)?/i.test(next))) {
      normalizedLines.push(`${curr} ${next}`);
      i++;
      continue;
    }
    normalizedLines.push(curr);
  }
  return normalizedLines.join("\n");
}
function parseAlkostoRawText(rawText) {
  assertValidInputPayload(rawText, "parseAlkostoRawText");
  const sanitizedRawText = sanitizeAlkostoRawPdfText(rawText);
  const pageChunks = splitTextIntoPages(sanitizedRawText);
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
      const obsMatch = pageText.match(/(\d+\s*DIAS\s+BS\s+BCV[^\r\n]*)/i) || pageText.match(/(BCV,\s*DESPACHO[^\r\n]*(?:\r?\n\s*(?:PEDIDO|DESPACHO)[^\r\n]*)?)/i);
      if (obsMatch) {
        observaciones = obsMatch[1].replace(/\s+/g, " ").trim();
      }
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
      let nextLineIdx = i;
      let numTokens = [];
      const inlineNumericTail = rawDescPart.match(/^([A-ZÁÉÍÓÚÑ0-9\s.,/()-]+?(?:\s*\/\s*\d+(?:\.\d+)?|\b(?:GR|GRS|KG|KGS|LT|LTS|ML|UND|UNI|PZA)|[A-ZÁÉÍÓÚÑ)]))\s+((?:-?\d+(?:,\d{3})*(?:\.\d+)?\s*){8,})$/i);
      if (inlineNumericTail) {
        rawDescPart = inlineNumericTail[1].trim();
        numTokens = inlineNumericTail[2].match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
      }
      const expectedMinCols = pageChain === "ALKOSTO" ? 21 : 16;
      if (numTokens.length < expectedMinCols) {
        let cursor = i + 1;
        if (numTokens.length === 0) {
          while (cursor < lines.length) {
            const candidateLine = lines[cursor];
            if (!candidateLine || /^(\d{4,14})\s+[A-ZÁÉÍÓÚÑ]/i.test(candidateLine) || /^SubTotal/i.test(candidateLine)) {
              break;
            }
            const inlineCandidate = candidateLine.match(/^([A-ZÁÉÍÓÚÑ0-9\s.,/()-]+?(?:\s*\/\s*\d+(?:\.\d+)?|\b(?:GR|GRS|KG|KGS|LT|LTS|ML|UND|UNI|PZA)|[A-ZÁÉÍÓÚÑ)]))\s+((?:-?\d+(?:,\d{3})*(?:\.\d+)?\s*){8,})$/i);
            if (inlineCandidate) {
              rawDescPart = `${rawDescPart} ${inlineCandidate[1].trim()}`.trim();
              numTokens.push(...inlineCandidate[2].match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) || []);
              nextLineIdx = cursor;
              cursor++;
              break;
            }
            const tokensInLine = candidateLine.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
            const hasAlphaWords = /[A-ZÁÉÍÓÚÑ]{2,}/i.test(candidateLine);
            if (tokensInLine.length < 6 && (hasAlphaWords || /^\/\s*\d+(?:\.\d+)?$/.test(candidateLine))) {
              rawDescPart = `${rawDescPart} ${candidateLine}`.trim();
              nextLineIdx = cursor;
              cursor++;
            } else {
              break;
            }
          }
        }
        while (cursor < lines.length && numTokens.length < expectedMinCols) {
          const candidateLine = lines[cursor];
          if (!candidateLine || /^(\d{4,14})\s+[A-ZÁÉÍÓÚÑ]/i.test(candidateLine) || /^SubTotal/i.test(candidateLine)) {
            break;
          }
          const tokensInLine = candidateLine.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
          if (tokensInLine.length === 0) break;
          if (numTokens.length >= 8 && /[A-ZÁÉÍÓÚÑ]{3,}/i.test(candidateLine)) break;
          numTokens.push(...tokensInLine);
          nextLineIdx = cursor;
          cursor++;
        }
      }
      if (numTokens.length < 8) continue;
      const mapped = mapNumericCellsToRow(numTokens, pageChain);
      if (!mapped) continue;
      i = nextLineIdx;
      const cleanDesc = limpiarDescripcionAlkosto(rawDescPart);
      const catalogMatch = resolverProductoPorCodigoODescripcion(rawCode, cleanDesc);
      const strictMatch = matchProductoCodizulca(rawCode, rawDescPart || cleanDesc);
      const hasExactMatch = Boolean(catalogMatch || strictMatch.matchExacto !== false);
      const finalSku = catalogMatch ? catalogMatch.sku : strictMatch.matchExacto !== false ? strictMatch.codigo : strictMatch.codigo || "PENDIENTE";
      const finalBarcode = catalogMatch?.codigoBarra || (/^\d{8,14}$/.test(rawCode) ? rawCode : void 0);
      const finalCodigoInternoAlkosto = /^100\d{3}$/.test(rawCode) ? rawCode : null;
      const finalDescripcion = catalogMatch ? catalogMatch.producto : strictMatch.matchExacto !== false ? strictMatch.descripcion : rawDescPart.replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/").trim().toUpperCase();
      const finalUnid = normalizarUnidadMedidaAlkosto(void 0, hasExactMatch ? finalDescripcion : cleanDesc, mapped.emp, catalogMatch?.unidadSugerida);
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
          codigoPrincipal: finalSku,
          skuCodizulca: finalSku,
          codigoBarra: finalBarcode,
          codigoEan: finalBarcode || null,
          codigoInternoAlkosto: finalCodigoInternoAlkosto,
          descripcion: finalDescripcion,
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
      codigoPrincipal: it.codigoPrincipal || it.codigo,
      skuCodizulca: it.skuCodizulca,
      codigoBarra: it.codigoBarra,
      codigoEan: it.codigoEan ?? null,
      codigoInternoAlkosto: it.codigoInternoAlkosto ?? null,
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
function parseAlkostoFlexibleOcrText(rawText) {
  if (!rawText || typeof rawText !== "string" || rawText.trim().length < 20) return null;
  const sanitizedText = sanitizeAlkostoRawPdfText(rawText);
  try {
    return parseAlkostoRawText(sanitizedText);
  } catch {
  }
  const upper = sanitizedText.toUpperCase();
  const isFamilia = upper.includes("FAMILIA CENTER") || /\bFC0[1-7]\b/.test(upper);
  const clienteCadena = isFamilia ? "FAMILIA_CENTER" : "ALKOSTO";
  const ocMatch = sanitizedText.match(/Orden\s*(?:de\s*Compra|Nro\.?)?\s*:?\s*#?\s*(\d{4,12})/i) || sanitizedText.match(/\b(0000\d{5,8})\b/);
  const ordenNro = ocMatch ? ocMatch[1].trim() : "S/N";
  const datesFound = sanitizedText.match(/\b(\d{2}[/-]\d{2}[/-]\d{4})\b/g) || [];
  const fechaEmision = datesFound[0] ? normalizarFechaAlkosto(datesFound[0].replace(/-/g, "/")) : "";
  const fechaEntrega = datesFound[1] ? normalizarFechaAlkosto(datesFound[1].replace(/-/g, "/")) : fechaEmision;
  const lines = sanitizedText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length >= 6);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(?:\d{1,2}\s+)?(?:(CJ|KG|UND|BLT)\s+)?(?:(\d+(?:[.,]\d+)?)\s+)?(\d{2,14})\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9\s.,/-]{4,})$/i);
    if (!m) continue;
    const unidHint = m[1];
    const cantHint = m[2] ? parseNumeroEstricto(m[2], 0) : 0;
    const rawCode = m[3].trim();
    const restText = m[4].trim();
    if (rawCode === "409876136" || /^267319/.test(rawCode)) continue;
    const trailingNums = restText.match(/-?\d+(?:[.,]\d+)?/g) || [];
    const rawDescOnly = restText.replace(/(?:\s+-?\d+(?:[.,]\d+)?){2,}\s*$/, "").trim();
    const descOnly = limpiarDescripcionAlkosto(rawDescOnly);
    const catalogMatch = resolverProductoPorCodigoODescripcion(rawCode, descOnly);
    const strictMatch = matchProductoCodizulca(rawCode, rawDescOnly || descOnly);
    const hasExactMatch = Boolean(catalogMatch || strictMatch.matchExacto !== false);
    if (!hasExactMatch && trailingNums.length < 2 && cantHint <= 0) continue;
    let totalCantidad = cantHint;
    let costoUnitario = catalogMatch?.precioSugeridoUSD || 0;
    let totalRenglon = 0;
    if (trailingNums.length >= 3) {
      const nLast = parseNumeroEstricto(trailingNums[trailingNums.length - 1], 0);
      const nPrev = parseNumeroEstricto(trailingNums[trailingNums.length - 2], 0);
      const nThird = parseNumeroEstricto(trailingNums[trailingNums.length - 3], 0);
      if (!totalCantidad && nThird > 0) totalCantidad = nThird;
      if (nPrev > 0) costoUnitario = nPrev;
      if (nLast > 0) totalRenglon = nLast;
    } else if (trailingNums.length === 2) {
      const n1 = parseNumeroEstricto(trailingNums[0], 0);
      const n2 = parseNumeroEstricto(trailingNums[1], 0);
      if (!totalCantidad) {
        totalCantidad = n1;
        costoUnitario = n2;
      } else {
        costoUnitario = n1;
        totalRenglon = n2;
      }
    }
    if (totalCantidad <= 0) continue;
    if (!totalRenglon && costoUnitario > 0) {
      totalRenglon = Number((totalCantidad * costoUnitario).toFixed(2));
    }
    const finalSku = catalogMatch ? catalogMatch.sku : strictMatch.matchExacto !== false ? strictMatch.codigo : strictMatch.codigo || "PENDIENTE";
    const finalDescripcion = catalogMatch ? catalogMatch.producto : strictMatch.matchExacto !== false ? strictMatch.descripcion : rawDescOnly.replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/").trim().toUpperCase();
    items.push({
      renglon: items.length + 1,
      codigo: finalSku,
      skuCodizulca: finalSku,
      codigoBarra: catalogMatch?.codigoBarra || (/^\d{8,14}$/.test(rawCode) ? rawCode : void 0),
      descripcion: finalDescripcion,
      unid: normalizarUnidadMedidaAlkosto(unidHint, hasExactMatch ? finalDescripcion : descOnly, void 0, catalogMatch?.unidadSugerida),
      totalCantidad,
      costoUnitario,
      totalRenglon
    });
  }
  if (items.length === 0) return null;
  try {
    return validateAndNormalizeAlkostoOC(
      {
        clienteCadena,
        ordenNro,
        fechaEmision,
        fechaEntrega,
        moneda: "USD",
        items
      },
      { strictMath: false, requireOrdenNro: false }
    );
  } catch {
    return null;
  }
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
    const btBlocks = inflated.match(/(?:q\s+[\d.]+\s+0(?:\.0+)?\s+0(?:\.0+)?\s+[\d.]+\s+0(?:\.0+)?\s+0(?:\.0+)?\s+cm[\s\S]{0,80}?)?BT[\s\S]*?ET/g) || [];
    for (const block of btBlocks) {
      const cmMatch = block.match(/([\d.]+)\s+0(?:\.0+)?\s+0(?:\.0+)?\s+([\d.]+)\s+0(?:\.0+)?\s+0(?:\.0+)?\s+cm/);
      const cmScaleX = cmMatch ? parseFloat(cmMatch[1]) || 1 : 1;
      const cmScaleY = cmMatch ? parseFloat(cmMatch[2]) || 1 : 1;
      const tfMatch = block.match(/\/F\d+\s+([\d.]+)\s+Tf/);
      const rawFontSize = tfMatch ? parseFloat(tfMatch[1]) : 9.28;
      const fontSize = rawFontSize * cmScaleX;
      const tmMatch = block.match(/1\s+0\s+0(?:\.0+)?\s+-1\s+([\d.]+)\s+([\d.]+)\s+Tm/);
      if (!tmMatch) continue;
      let curX = parseFloat(tmMatch[1]) * cmScaleX;
      const y = parseFloat(tmMatch[2]) * cmScaleY;
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
  const cabeceraObj = root.cabecera_orden && typeof root.cabecera_orden === "object" ? root.cabecera_orden : rawInput?.cabecera_orden && typeof rawInput.cabecera_orden === "object" ? rawInput.cabecera_orden : null;
  const resumenObj = root.resumen_totales && typeof root.resumen_totales === "object" ? root.resumen_totales : rawInput?.resumen_totales && typeof rawInput.resumen_totales === "object" ? rawInput.resumen_totales : null;
  const nonEmptyRawItems = rawItems.filter((it) => {
    if (!it || typeof it !== "object") return true;
    const hasCod = Boolean(
      String(
        pickProp(it, [
          "codigo_principal",
          "codigoPrincipal",
          "codigoProducto",
          "codigo_producto",
          "codigo",
          "sku",
          "SKU",
          "skuCodizulca",
          "codigo_ean",
          "codigoEan",
          "codigoBarra",
          "ean",
          "codigo_interno_alkosto",
          "codigoInternoAlkosto",
          "referencia"
        ]) ?? ""
      ).trim()
    );
    const hasDesc = Boolean(
      String(
        pickProp(it, [
          "descripcion_producto",
          "descripcionProducto",
          "descripcion",
          "DESCRIPCI\xD3N DEL PRODUCTO",
          "producto",
          "nombre",
          "articulo"
        ]) ?? ""
      ).trim()
    );
    const hasCant = parseNumeroEstricto(
      pickProp(it, [
        "cantidad_total",
        "totalCantidad",
        "cantidadTotal",
        "cantSolicitada",
        "CANT",
        "cantidad",
        "cant",
        "CANT. SOLICITADA"
      ]),
      0
    ) > 0;
    const hasStores = it.tiendas && typeof it.tiendas === "object" && Object.values(it.tiendas).some((v) => parseNumeroEstricto(v, 0) > 0) || Array.isArray(it.desglosePorTienda) && it.desglosePorTienda.some((d) => parseNumeroEstricto(d?.cantidad, 0) > 0) || Array.isArray(it.distribucionPorTienda) && it.distribucionPorTienda.some((d) => parseNumeroEstricto(d?.cantidad, 0) > 0) || Array.isArray(it.distribucion_tiendas) && it.distribucion_tiendas.some((d) => parseNumeroEstricto(d?.cantidad, 0) > 0);
    return hasCod || hasDesc || hasCant || hasStores;
  });
  const itemsToValidate = nonEmptyRawItems.length > 0 ? nonEmptyRawItems : rawItems;
  const rawOrdenNro = String(
    pickProp(cabeceraObj, ["numero_orden_compra", "numeroOrdenCompra", "numero_orden", "numeroOrden", "ordenNro", "numero_oc", "ordenCompra", "oc"]) ?? pickProp(root, ["numero_orden_compra", "numero_orden", "ordenNro", "numero_oc", "ORDEN DE COMPRA", "ordenCompra", "orden_compra", "numeroOrden", "nroOrden", "nro_orden", "oc"]) ?? pickProp(rawInput, ["numero_orden_compra", "numero_orden", "ordenNro", "numero_oc", "ORDEN DE COMPRA", "ordenCompra", "numeroOrden", "nroOrden", "oc"]) ?? (typeof root.orden === "string" ? root.orden : "") ?? ""
  ).trim();
  if (requireOrdenNro && !rawOrdenNro) {
    issues.push({
      field: "ordenNro",
      message: "Falta el n\xFAmero de Orden de Compra (ordenNro).",
      severity: "ERROR"
    });
  }
  const clienteEmisorCabecera = String(
    pickProp(cabeceraObj, ["cliente_emisor", "clienteEmisor", "cliente"]) ?? ""
  ).trim();
  const receptorDestinoCabecera = String(
    pickProp(cabeceraObj, ["receptor_destino", "receptorDestino", "proveedor"]) ?? ""
  ).trim();
  const clienteNombreClean = String(
    pickProp(root, ["clienteNombre", "CLIENTE", "cliente"]) ?? pickProp(rawInput, ["clienteNombre", "CLIENTE", "cliente"]) ?? clienteEmisorCabecera ?? ""
  ).trim();
  const idClienteClean = String(
    pickProp(root, ["idCliente", "ID CLIENTE", "codigoCliente", "codCliente"]) ?? pickProp(rawInput, ["idCliente", "ID CLIENTE", "codigoCliente"]) ?? ""
  ).trim();
  const rawNormalizedItems = [];
  itemsToValidate.forEach((it, idx) => {
    const renglonNum = Number(pickProp(it, ["numero_renglon", "numeroRenglon", "renglon", "N\xB0", "nro", "numero"])) || idx + 1;
    if (!it || typeof it !== "object") {
      issues.push({
        field: `items[${idx}]`,
        renglon: renglonNum,
        message: `El rengl\xF3n ${renglonNum} no es un objeto v\xE1lido.`,
        severity: "ERROR"
      });
      return;
    }
    const cleanCodeField = (val) => {
      const s = String(val ?? "").trim();
      if (!s || /^(null|undefined|n\/a|none|-)$/i.test(s)) return "";
      return s;
    };
    let rawCodPrincipal = cleanCodeField(
      pickProp(it, [
        "codigo_principal",
        "codigoPrincipal",
        "codigoProducto",
        "codigo_producto",
        "codigo",
        "sku",
        "SKU",
        "skuCodizulca",
        "codigo_articulo",
        "referencia"
      ])
    );
    const rawCodEan = cleanCodeField(
      pickProp(it, ["codigo_ean", "codigoEan", "codigoBarra", "codigo_barra", "ean", "barcode", "upc"])
    );
    const rawCodAlkosto = cleanCodeField(
      pickProp(it, ["codigo_interno_alkosto", "codigoInternoAlkosto", "plu", "sku_alkosto"])
    );
    let rawUnidInput = String(
      pickProp(it, [
        "unidad_medida",
        "unidadMedida",
        "unid",
        "UNID",
        "unidad",
        "cantSolicitadaUnid"
      ]) ?? ""
    ).trim();
    if (/^(CJ|CAJ|CAJA|CAJAS|KG|KGS|KILOS|UND|UNID|UNIDADES|BLT|BTO|BTOS|BULTO|BULTOS)$/i.test(rawCodPrincipal)) {
      const potentialCodeInUnid = rawUnidInput && !/^(CJ|CAJ|CAJA|CAJAS|KG|KGS|KILOS|UND|UNID|UNIDADES|BLT|BTO|BTOS|BULTO|BULTOS)$/i.test(rawUnidInput) ? rawUnidInput : "";
      rawUnidInput = rawCodPrincipal;
      rawCodPrincipal = cleanCodeField(pickProp(it, ["skuCodizulca", "codigoBarra", "codigo_ean", "codigo_interno_alkosto"]) ?? potentialCodeInUnid);
    }
    const rawCodCombined = rawCodPrincipal || rawCodEan || rawCodAlkosto;
    const cleanCod = normalizarCodigoProducto(rawCodCombined);
    const cleanCodEanInput = normalizarCodigoProducto(rawCodEan);
    const cleanCodAlkostoInput = normalizarCodigoProducto(rawCodAlkosto);
    const rawDesc = String(
      pickProp(it, [
        "descripcion_producto",
        "descripcionProducto",
        "descripcion",
        "DESCRIPCI\xD3N DEL PRODUCTO",
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
    const isForbiddenAlphaCode = /^(LPV|UTH|UHT|QS|JUGOS)$/i.test(cleanCod);
    const match = (cleanCodEanInput ? resolverProductoPorCodigoODescripcion(cleanCodEanInput, cleanDesc) : void 0) || (!isForbiddenAlphaCode ? resolverProductoPorCodigoODescripcion(cleanCod, cleanDesc) : void 0) || (cleanCodAlkostoInput ? resolverProductoPorCodigoODescripcion(cleanCodAlkostoInput, cleanDesc) : void 0);
    const strictMatch = matchProductoCodizulca(cleanCodEanInput || cleanCod, rawDesc || cleanDesc);
    const finalSku = (match ? match.sku : "") || (strictMatch.matchExacto !== false ? strictMatch.codigo : "") || strictMatch.codigo || "PENDIENTE";
    const finalCodigo = finalSku || "PENDIENTE";
    const resolvedEan = cleanCodEanInput || (/^\d{8,14}$/.test(cleanCod) ? cleanCod : "") || match?.codigoBarra || null;
    const catalogAlkostoPlu = match?.codigosCadena?.find((c) => /^100\d{3}$/.test(normalizarCodigoProducto(c))) || null;
    const resolvedCodigoAlkosto = cleanCodAlkostoInput || (/^100\d{3}$/.test(cleanCod) ? cleanCod : "") || catalogAlkostoPlu || null;
    const finalBarcode = resolvedEan || void 0;
    const hasExactCatalogDesc = Boolean(match || strictMatch.matchExacto !== false);
    const finalDesc = hasExactCatalogDesc ? (isForbiddenAlphaCode && strictMatch.matchExacto !== false ? strictMatch.descripcion : "") || cleanDesc || (match ? match.producto : "") || (strictMatch.matchExacto !== false ? strictMatch.descripcion : "") : (rawDesc ? rawDesc.replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/").trim().toUpperCase() : "") || cleanDesc;
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
    const customStoreItems = [];
    if (it.tiendas && typeof it.tiendas === "object") {
      for (const [tag, val] of Object.entries(it.tiendas)) {
        const uTag = tag.trim().toUpperCase();
        if (val === null || val === void 0 || val === "" || val === "-") {
          continue;
        }
        const numVal = parseNumeroEstricto(val, NaN);
        if (Number.isNaN(numVal) || numVal < 0) {
          if (strictMath) {
            issues.push({
              field: `items[${idx}].tiendas.${uTag}`,
              renglon: renglonNum,
              message: `Valor inv\xE1lido en tienda ${uTag} del rengl\xF3n ${renglonNum}: "${val}"`,
              severity: "ERROR"
            });
          }
          continue;
        }
        if (numVal > 0 && ALL_VALID_STORE_TAGS.has(uTag) && uTag !== "CI" && uTag !== "AKOP" && uTag !== "FCOP") {
          cleanTiendas[uTag] = numVal;
        }
      }
    }
    const rawDistList = pickProp(it, [
      "desglosePorTienda",
      "desglose_por_tienda",
      "distribucion_tiendas",
      "distribucionTiendas",
      "distribucionPorTienda",
      "distribucion_por_tienda",
      "tiendasDesglose",
      "tiendas_desglose"
    ]);
    if (Array.isArray(rawDistList)) {
      for (const distItem of rawDistList) {
        if (!distItem || typeof distItem !== "object") continue;
        const rawStoreTag = cleanCodeField(
          pickProp(distItem, ["codigo_tienda", "codigoTienda", "tienda", "codigo", "tag"])
        ).toUpperCase();
        const rawStoreName = String(
          pickProp(distItem, ["nombre_tienda", "nombreTienda", "nombre", "sucursal"]) ?? ""
        ).trim();
        const storeQty = parseNumeroEstricto(
          pickProp(distItem, ["cantidad", "cant", "cantidadSolicitada", "total"]),
          0
        );
        if (storeQty <= 0) continue;
        let resolvedTag = rawStoreTag;
        if (resolvedTag && !ALL_VALID_STORE_TAGS.has(resolvedTag)) {
          const sucByCode = getSucursalByTag(resolvedTag);
          if (sucByCode?.tag) {
            resolvedTag = sucByCode.tag.toUpperCase();
          }
        }
        if (!ALL_VALID_STORE_TAGS.has(resolvedTag) && rawStoreName) {
          const allSucs = [...SUCURSALES_ALKOSTO, ...SUCURSALES_FAMILIA_CENTER];
          const foundSuc = allSucs.find(
            (s) => s.tag && s.tag.toUpperCase() === rawStoreName.toUpperCase() || s.codigo.toUpperCase() === rawStoreName.toUpperCase() || s.nombre.toUpperCase().includes(rawStoreName.toUpperCase()) || rawStoreName.toUpperCase().includes(s.nombre.toUpperCase())
          );
          if (foundSuc) resolvedTag = (foundSuc.tag || foundSuc.codigo).toUpperCase();
        }
        if (ALL_VALID_STORE_TAGS.has(resolvedTag) && resolvedTag !== "CI" && resolvedTag !== "AKOP" && resolvedTag !== "FCOP") {
          if (cleanTiendas[resolvedTag] === void 0) {
            cleanTiendas[resolvedTag] = storeQty;
          }
        } else {
          customStoreItems.push({
            codigo_tienda: rawStoreTag || null,
            nombre_tienda: rawStoreName || rawStoreTag || clienteNombreClean || "ALKOSTO",
            cantidad: Number(storeQty.toFixed(2))
          });
        }
      }
    }
    for (const [k, val] of Object.entries(it)) {
      const uKey = k.trim().toUpperCase();
      if (ALL_VALID_STORE_TAGS.has(uKey) && uKey !== "CI" && uKey !== "AKOP" && uKey !== "FCOP") {
        const numVal = parseNumeroEstricto(val, 0);
        if (numVal > 0 && cleanTiendas[uKey] === void 0) {
          cleanTiendas[uKey] = numVal;
        }
      }
    }
    const empNum = parseNumeroEstricto(
      pickProp(it, ["emp", "unidades_por_empaque", "unidadesPorEmpaque"]),
      0
    );
    const ivaNum = parseNumeroEstricto(
      pickProp(it, ["porcentaje_impuesto", "porcentajeImpuesto", "iva", "impuesto"]),
      0
    );
    const descuentoNum = parseNumeroEstricto(
      pickProp(it, [
        "porcentaje_descuento",
        "porcentajeDescuento",
        "descuento",
        "porcentajeBonif",
        "porcentaje_bonif",
        "bonif",
        "descuentoPorcentaje"
      ]),
      0
    );
    const finalUnid = normalizarUnidadMedidaAlkosto(
      rawUnidInput,
      finalDesc,
      empNum,
      match?.unidadSugerida
    );
    let totalCant = parseNumeroEstricto(
      pickProp(it, [
        "cantidad_total",
        "totalCantidad",
        "cantidadTotal",
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
      cleanTiendas = autocorregirTiendasPorFila(cleanTiendas, totalCant);
    }
    const sumAkTiendas = Object.entries(cleanTiendas).filter(([tk]) => tk.startsWith("AK")).reduce((acc, [, v]) => acc + v, 0);
    const sumFcTiendas = Object.entries(cleanTiendas).filter(([tk]) => tk.startsWith("FC")).reduce((acc, [, v]) => acc + v, 0);
    const sumCustomTiendas = customStoreItems.reduce((acc, c) => acc + c.cantidad, 0);
    const sumAllTiendas = Object.values(cleanTiendas).reduce((acc, v) => acc + v, 0) + sumCustomTiendas;
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
    let alertaRevision = Boolean(
      it.alerta_revision === true || it.alertaRevision === true || String(it.alerta_revision).toLowerCase() === "true"
    );
    const notasRevisionList = [];
    const rawNotaInput = cleanCodeField(pickProp(it, ["nota_revision", "notaRevision"]));
    if (rawNotaInput) {
      notasRevisionList.push(rawNotaInput);
    }
    let cuadreTiendasValido = true;
    const rawTotalCantOriginal = totalCant;
    if (sumAllTiendas > 0) {
      const matchesAll = Math.abs(sumAllTiendas - totalCant) <= 0.05;
      const matchesAk = sumAkTiendas > 0 && Math.abs(sumAkTiendas - totalCant) <= 0.05;
      const matchesFc = sumFcTiendas > 0 && Math.abs(sumFcTiendas - totalCant) <= 0.05;
      if (totalCant === 0) {
        totalCant = sumAkTiendas > 0 && sumFcTiendas === 0 ? sumAkTiendas : sumAllTiendas;
      } else if (!matchesAll && !matchesAk && !matchesFc) {
        cuadreTiendasValido = false;
        if (strictMath) {
          issues.push({
            field: `items[${idx}].totalCantidad`,
            renglon: renglonNum,
            message: `Desalineaci\xF3n en rengl\xF3n ${renglonNum} (${finalCodigo}): la suma de tiendas (${sumAllTiendas}) no coincide con Total Cantidad (${totalCant}).`,
            severity: "ERROR"
          });
        } else {
          alertaRevision = true;
          notasRevisionList.push(
            `Suma de tiendas (${Number(sumAllTiendas.toFixed(2))}) difiere de cantidad_total (${rawTotalCantOriginal}).`
          );
          totalCant = sumAkTiendas > 0 && sumFcTiendas === 0 ? sumAkTiendas : totalCant;
        }
      }
    }
    let precio = parseNumeroEstricto(
      pickProp(it, [
        "valorUnitarioOC",
        "valor_unitario_oc",
        "valorUnitario",
        "valor_unitario",
        "costo_unitario",
        "costoUnitario",
        "PRECIO",
        "precio",
        "precioUnitario",
        "precio_unitario",
        "costoBruto",
        "costo_bruto"
      ]),
      0
    );
    let totalRenglon = parseNumeroEstricto(
      pickProp(it, [
        "monto_total_renglon",
        "montoTotalRenglon",
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
      const factorDesc = descuentoNum > 0 && descuentoNum <= 100 && !it.costoBruto ? 1 - descuentoNum / 100 : 1;
      totalRenglon = Number((totalCant * precio * factorDesc).toFixed(2));
    } else if (precio > 0 && totalCant > 0 && totalRenglon > 0) {
      const expectedDirect = Number((totalCant * precio).toFixed(2));
      const expectedDiscounted = descuentoNum > 0 && descuentoNum <= 100 ? Number((totalCant * precio * (1 - descuentoNum / 100)).toFixed(2)) : expectedDirect;
      const tolDirect = Math.max(0.5, expectedDirect * 0.02);
      const tolDisc = Math.max(0.5, expectedDiscounted * 0.02);
      const matchesDirect = Math.abs(expectedDirect - totalRenglon) <= tolDirect;
      const matchesDiscounted = descuentoNum > 0 && Math.abs(expectedDiscounted - totalRenglon) <= tolDisc;
      if (!matchesDirect && !matchesDiscounted) {
        if (strictMath) {
          issues.push({
            field: `items[${idx}].totalRenglon`,
            renglon: renglonNum,
            message: `Inconsistencia matem\xE1tica en rengl\xF3n ${renglonNum} (${finalCodigo}): ${totalCant} x ${precio} = ${expectedDirect}, pero figura ${totalRenglon}.`,
            severity: "ERROR"
          });
        } else {
          alertaRevision = true;
          const expectedTarget = descuentoNum > 0 && (!it.costoBruto || Math.abs(parseNumeroEstricto(it.costoBruto, 0) - precio) < 1e-3) ? expectedDiscounted : expectedDirect;
          notasRevisionList.push(
            `Discrepancia aritm\xE9tica: cantidad_total (${totalCant}) * costo_unitario (${precio})${expectedTarget === expectedDiscounted && descuentoNum > 0 ? ` (-${descuentoNum}% desc.)` : ""} = ${expectedTarget}, pero monto_total_renglon le\xEDdo fue ${totalRenglon}. Se priorizaron valores legibles.`
          );
          totalRenglon = expectedTarget;
        }
      }
    }
    if (totalCant <= 0 && sumAllTiendas <= 0) {
      if (strictMath || rawItems.length <= 1) {
        issues.push({
          field: `items[${idx}].totalCantidad`,
          renglon: renglonNum,
          message: `El rengl\xF3n ${renglonNum} (${finalCodigo}) tiene cantidad solicitada 0.`,
          severity: "ERROR"
        });
      } else {
        issues.push({
          field: `items[${idx}].totalCantidad`,
          renglon: renglonNum,
          message: `Rengl\xF3n ${renglonNum} (${finalCodigo}) con cantidad 0 omitido.`,
          severity: "WARNING"
        });
        return;
      }
    }
    const distribucionPorTienda = construirDistribucionPorTienda(cleanTiendas);
    const distribucionTiendasCanonico = construirDistribucionTiendasCanonico(
      cleanTiendas,
      customStoreItems,
      {
        codigoTienda: idClienteClean || (root.sede ? String(root.sede) : null),
        nombreTienda: clienteNombreClean || clienteEmisorCabecera || "ALKOSTO",
        cantidad: totalCant
      }
    );
    const notaRevisionFinal = notasRevisionList.length > 0 ? notasRevisionList.join(" | ") : null;
    rawNormalizedItems.push({
      renglon: rawNormalizedItems.length + 1,
      codigo: finalCodigo,
      codigoPrincipal: finalCodigo,
      codigoProducto: finalCodigo,
      skuCodizulca: finalSku,
      codigoBarra: finalBarcode,
      codigoEan: resolvedEan,
      ean: resolvedEan,
      codigoInternoAlkosto: resolvedCodigoAlkosto,
      descripcion: finalDesc,
      iva: ivaNum,
      emp: empNum,
      unid: finalUnid,
      totalCantidad: totalCant,
      cantidadTotal: totalCant,
      cantDespachada: cantDespachadaClean,
      costoBruto: parseNumeroEstricto(it.costoBruto, precio),
      ...descuentoNum > 0 ? { descuento: Number(descuentoNum.toFixed(2)) } : {},
      costoUnitario: precio,
      precioUnitario: precio,
      valorUnitarioOC: precio,
      totalRenglon: Number(totalRenglon.toFixed(2)),
      subtotal: Number(totalRenglon.toFixed(2)),
      tiendas: cleanTiendas,
      desglosePorTienda: Object.entries(cleanTiendas).map(([tienda, cantidad]) => ({
        tienda,
        cantidad: Number(cantidad.toFixed(2))
      })),
      distribucionPorTienda,
      distribucion_tiendas: distribucionTiendasCanonico,
      cuadreTiendasValido,
      alertaRevision,
      notaRevision: notaRevisionFinal
    });
  });
  if (rawNormalizedItems.length === 0 && issues.filter((i) => i.severity === "ERROR").length === 0) {
    issues.push({
      field: "items",
      message: "Todos los renglones extra\xEDdos tienen cantidad solicitada 0.",
      severity: "ERROR"
    });
  }
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
    const isPendingCode = item.codigo === "PENDIENTE" || item.codigo === "S/C";
    const key = hasStores ? isPendingCode ? `${item.codigo}#${item.codigoBarra || item.descripcion || item.renglon}` : item.codigo : `${item.codigo}#${item.renglon}`;
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
      existing.desglosePorTienda = Object.entries(mergedTiendas).map(([tienda, cantidad]) => ({
        tienda,
        cantidad: Number(cantidad.toFixed(2))
      }));
      existing.distribucionPorTienda = construirDistribucionPorTienda(mergedTiendas);
      existing.distribucion_tiendas = construirDistribucionTiendasCanonico(mergedTiendas);
      existing.totalCantidad = primaryCant;
      existing.cantidadTotal = primaryCant;
      existing.totalRenglon = Number((primaryCant * existing.costoUnitario).toFixed(2));
      existing.subtotal = Number((primaryCant * existing.costoUnitario).toFixed(2));
      if (item.alertaRevision) {
        existing.alertaRevision = true;
        existing.notaRevision = [existing.notaRevision, item.notaRevision].filter(Boolean).join(" | ") || null;
      }
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
  const rutaClean = String(pickProp(root, ["ruta", "RUTA"]) ?? pickProp(rawInput, ["ruta", "RUTA"]) ?? "").trim();
  const supervisorClean = String(pickProp(root, ["supervisor", "SUPERVISOR"]) ?? pickProp(rawInput, ["supervisor", "SUPERVISOR"]) ?? "").trim();
  const choferClean = String(pickProp(root, ["chofer", "CHOFER"]) ?? pickProp(rawInput, ["chofer", "CHOFER"]) ?? "").trim();
  const cantidadCestasClean = pickProp(root, ["cantidadCestas", "CANTIDAD DE CESTAS"]) ?? pickProp(rawInput, ["cantidadCestas", "CANTIDAD DE CESTAS"]);
  const nroPedidoClean = String(pickProp(root, ["nroPedido", "N\xB0 DE PEDIDO", "numeroPedido"]) ?? pickProp(rawInput, ["nroPedido", "N\xB0 DE PEDIDO"]) ?? "").trim();
  const observacionesClean = String(
    pickProp(cabeceraObj, ["observaciones_generales", "observacionesGenerales", "observaciones"]) ?? pickProp(root, ["observaciones", "observaciones_generales", "OBSERVACIONES"]) ?? pickProp(rawInput, ["observaciones", "observaciones_generales", "OBSERVACIONES"]) ?? ""
  ).trim();
  const condicionPagoClean = String(
    pickProp(cabeceraObj, ["condicion_pago", "condicionPago"]) ?? pickProp(root, ["condicion_pago", "condicionPago"]) ?? pickProp(rawInput, ["condicion_pago", "condicionPago"]) ?? ""
  ).trim();
  const fechaEmisionExtraida = String(
    pickProp(cabeceraObj, ["fecha_emision", "fechaEmision", "fechaOrden", "fecha_orden"]) ?? pickProp(root, ["fechaEmision", "fecha_emision", "fechaOrden", "fecha_orden"]) ?? pickProp(rawInput, ["fechaEmision", "fecha_emision", "fechaOrden", "fecha_orden"]) ?? ""
  ).trim();
  const fechaEntregaExtraida = String(
    pickProp(cabeceraObj, ["fecha_entrega_estimada", "fechaEntregaEstimada", "fecha_entrega", "fechaEntrega"]) ?? pickProp(root, ["fechaEntrega", "fecha_entrega", "fecha_entrega_estimada", "FECHA", "fecha", "entrega", "fechaEmision", "fecha_emision", "fechaOrden"]) ?? ""
  ).trim();
  const monedaExtraida = String(
    pickProp(cabeceraObj, ["moneda", "currency", "divisa"]) ?? pickProp(root, ["moneda", "currency", "divisa"]) ?? pickProp(rawInput, ["moneda", "currency"]) ?? "USD"
  ).trim().toUpperCase() || "USD";
  let clienteCadena = String(
    root.clienteCadena || rawInput.clienteCadena || (clienteEmisorCabecera.toUpperCase().includes("FAMILIA") ? "FAMILIA_CENTER" : "")
  ).trim().toUpperCase();
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
  const explicitSubAk = parseNumeroEstricto(
    pickProp(root, ["subtotalAlkosto", "subtotal_alkosto"]) ?? pickProp(cabeceraObj, ["subtotalAlkosto", "subtotal_alkosto"]) ?? pickProp(resumenObj, ["subtotalAlkosto", "subtotal_alkosto"]),
    0
  );
  const explicitSubFc = parseNumeroEstricto(
    pickProp(root, ["subtotalFamiliaCenter", "subtotal_familia_center", "subtotalFamilia", "subtotal_familia"]) ?? pickProp(cabeceraObj, ["subtotalFamiliaCenter", "subtotal_familia_center"]) ?? pickProp(resumenObj, ["subtotalFamiliaCenter", "subtotal_familia_center", "subtotalFamilia", "subtotal_familia"]),
    0
  );
  const explicitSubGen = parseNumeroEstricto(
    pickProp(root, ["montoTotal", "monto_total", "subtotalGeneral", "subtotal_general", "total_factura", "totalFactura", "totalNeto", "total_neto", "total_general"]) ?? pickProp(cabeceraObj, ["montoTotal", "total_factura", "totalFactura", "total_general"]) ?? pickProp(resumenObj, ["monto_total_orden", "montoTotal", "subtotal_neto", "total_factura", "total_general"]),
    0
  );
  const finalSubAk = explicitSubAk > 0 ? explicitSubAk : calcSubtotalAlkosto > 0 ? calcSubtotalAlkosto : void 0;
  const finalSubFc = explicitSubFc > 0 ? explicitSubFc : calcSubtotalFamilia > 0 ? calcSubtotalFamilia : void 0;
  const finalSubGen = explicitSubGen > 0 ? explicitSubGen : finalSubAk || finalSubFc ? Number(((finalSubAk || 0) + (finalSubFc || 0)).toFixed(2)) : void 0;
  const subtotalCalc = Number(normalizedItems.reduce((acc, it) => acc + (it.totalRenglon || 0), 0).toFixed(2));
  const rawSubtotal = parseNumeroEstricto(
    root.subtotal ?? root.total ?? root.montoTotal ?? pickProp(resumenObj, ["subtotal_neto", "monto_total_orden"]),
    0
  );
  const normalizedFechaEmision = normalizarFechaAlkosto(fechaEmisionExtraida || fechaEntregaExtraida || "");
  const normalizedFechaEntrega = normalizarFechaAlkosto(fechaEntregaExtraida || "");
  const creditDigitsMatch = condicionPagoClean.match(/(\d{1,3})/);
  const diasCreditoFinal = parseNumeroEstricto(
    pickProp(cabeceraObj, ["dias_credito", "diasCredito"]) ?? pickProp(root, ["diasCredito", "dias_credito"]) ?? pickProp(rawInput, ["diasCredito", "dias_credito"]),
    creditDigitsMatch ? parseInt(creditDigitsMatch[1], 10) : 15
  );
  const tasaCambioFinal = parseNumeroEstricto(
    pickProp(cabeceraObj, ["tasa_cambio", "tasaCambio"]) ?? pickProp(root, ["tasaCambio", "tasa_cambio"]) ?? pickProp(rawInput, ["tasaCambio", "tasa_cambio"]),
    0
  );
  const condicionPagoFinal = condicionPagoClean || (diasCreditoFinal > 0 ? `${diasCreditoFinal} d\xEDas` : null);
  const cabeceraOrdenCanonica = {
    cliente_emisor: clienteEmisorCabecera || (clienteCadena === "FAMILIA_CENTER" ? "FAMILIA CENTER" : "ALKOSTO"),
    receptor_destino: receptorDestinoCabecera || "CODIZULCA",
    numero_orden_compra: rawOrdenNro || "S/N",
    fecha_emision: normalizarFechaISOAlkosto(normalizedFechaEmision) || normalizedFechaEmision || "",
    fecha_entrega_estimada: normalizarFechaISOAlkosto(normalizedFechaEntrega),
    moneda: monedaExtraida || null,
    condicion_pago: condicionPagoFinal,
    observaciones_generales: observacionesClean || null
  };
  const renglonesCanonicos = normalizedItems.map((it, idx) => ({
    numero_renglon: idx + 1,
    codigo_principal: it.codigoPrincipal || it.codigo,
    codigo_ean: it.codigoEan ?? it.codigoBarra ?? null,
    codigo_interno_alkosto: it.codigoInternoAlkosto ?? null,
    descripcion_producto: it.descripcion,
    unidad_medida: it.unid,
    unidades_por_empaque: it.emp && it.emp > 0 ? Math.round(it.emp) : 1,
    cantidad_total: Number((it.totalCantidad || 0).toFixed(2)),
    distribucion_tiendas: it.distribucion_tiendas && it.distribucion_tiendas.length > 0 ? it.distribucion_tiendas : construirDistribucionTiendasCanonico(it.tiendas, void 0, {
      codigoTienda: idClienteClean || null,
      nombreTienda: clienteNombreClean || cabeceraOrdenCanonica.cliente_emisor,
      cantidad: it.totalCantidad
    }),
    costo_unitario: Number((it.costoUnitario || 0).toFixed(4)),
    porcentaje_descuento: Number((it.descuento || 0).toFixed(2)),
    porcentaje_impuesto: Number((it.iva || 0).toFixed(2)),
    monto_total_renglon: Number((it.totalRenglon || 0).toFixed(2)),
    alerta_revision: Boolean(it.alertaRevision),
    nota_revision: it.notaRevision ?? null
  }));
  const totalUnidadesPedidas = Number(
    renglonesCanonicos.reduce((acc, r) => acc + r.cantidad_total, 0).toFixed(2)
  );
  const totalDescuentosCalc = Number(
    normalizedItems.reduce((acc, it) => {
      const bruto = Number(it.costoBruto || it.costoUnitario || 0);
      const neto = Number(it.costoUnitario || 0);
      if (bruto > neto && neto > 0) {
        return acc + (bruto - neto) * (it.totalCantidad || 0);
      }
      return acc;
    }, 0).toFixed(2)
  );
  const totalDescuentosFinal = parseNumeroEstricto(
    pickProp(resumenObj, ["total_descuentos", "totalDescuentos"]),
    totalDescuentosCalc
  );
  const totalImpuestosCalc = Number(
    renglonesCanonicos.reduce((acc, r) => acc + r.monto_total_renglon * ((r.porcentaje_impuesto || 0) / 100), 0).toFixed(2)
  );
  const totalImpuestosFinal = parseNumeroEstricto(
    pickProp(resumenObj, ["total_impuestos", "totalImpuestos"]),
    totalImpuestosCalc
  );
  const subtotalNetoFinal = subtotalCalc;
  const montoTotalOrdenCalc = Number((subtotalNetoFinal + totalImpuestosFinal).toFixed(2));
  const explicitMontoTotalOrden = parseNumeroEstricto(
    pickProp(resumenObj, ["monto_total_orden", "montoTotalOrden"]) ?? root.montoTotal,
    0
  );
  const anyRowAlert = renglonesCanonicos.some((r) => r.alerta_revision);
  const headerTotalMatches = explicitMontoTotalOrden <= 0 || Math.abs(explicitMontoTotalOrden - montoTotalOrdenCalc) <= 0.5 || finalSubGen !== void 0 && Math.abs(explicitMontoTotalOrden - finalSubGen) <= 0.5;
  const explicitCuadreFlag = pickProp(resumenObj, ["cuadre_aritmetico_correcto", "cuadreAritmeticoCorrecto"]);
  const cuadreAritmeticoCorrecto = !anyRowAlert && headerTotalMatches && (explicitCuadreFlag === void 0 ? true : Boolean(explicitCuadreFlag));
  const resumenTotalesCanonico = {
    total_renglones_extraidos: renglonesCanonicos.length,
    total_unidades_pedidas: totalUnidadesPedidas,
    subtotal_neto: subtotalNetoFinal,
    total_descuentos: Number(totalDescuentosFinal.toFixed(2)),
    total_impuestos: Number(totalImpuestosFinal.toFixed(2)),
    monto_total_orden: explicitMontoTotalOrden > 0 && headerTotalMatches ? explicitMontoTotalOrden : montoTotalOrdenCalc,
    cuadre_aritmetico_correcto: cuadreAritmeticoCorrecto
  };
  const tiendasDetectadasList = Array.from(allStoreTags);
  return {
    clienteCadena,
    cadenasDetectadas: root.cadenasDetectadas || (hasAk && hasFc ? ["ALKOSTO", "FAMILIA_CENTER"] : [clienteCadena]),
    tiendasDetectadas: tiendasDetectadasList,
    clienteNombre: clienteNombreClean || void 0,
    idCliente: idClienteClean || void 0,
    ruta: rutaClean || void 0,
    supervisor: supervisorClean || void 0,
    chofer: choferClean || void 0,
    cantidadCestas: cantidadCestasClean !== void 0 ? cantidadCestasClean : void 0,
    nroPedido: nroPedidoClean || void 0,
    ordenNro: rawOrdenNro || "S/N",
    numeroOrden: rawOrdenNro || "S/N",
    numero_oc: rawOrdenNro || "S/N",
    sede: String(root.sede || (clienteCadena === "FAMILIA_CENTER" ? "FCOP" : "AKOP")).trim(),
    fechaEmision: normalizedFechaEmision,
    fechaOrden: normalizedFechaEmision,
    fecha_emision: normalizedFechaEmision,
    fechaEntrega: normalizedFechaEntrega,
    moneda: monedaExtraida,
    condicionPago: condicionPagoFinal || void 0,
    diasCredito: diasCreditoFinal,
    tasaCambio: tasaCambioFinal,
    proveedorNombre: String(root.proveedorNombre || receptorDestinoCabecera || "CODIZULCA, C.A.").trim(),
    proveedorRif: String(root.proveedorRif || "J409876136").trim(),
    observaciones: observacionesClean || void 0,
    subtotal: rawSubtotal > 0 ? rawSubtotal : subtotalCalc,
    montoTotal: finalSubGen ?? (rawSubtotal > 0 ? rawSubtotal : subtotalCalc),
    subtotalAlkosto: finalSubAk,
    subtotalFamiliaCenter: finalSubFc,
    subtotalGeneral: finalSubGen,
    cabecera_orden: cabeceraOrdenCanonica,
    renglones: renglonesCanonicos,
    resumen_totales: resumenTotalesCanonico,
    items: normalizedItems
  };
}
function toCanonicalAlkostoOcJson(input, options = { strictMath: false, requireOrdenNro: false }) {
  const normalized = input && typeof input === "object" && input.cabecera_orden && Array.isArray(input.renglones) && input.resumen_totales && Array.isArray(input.items) ? input : validateAndNormalizeAlkostoOC(input, options);
  return {
    cabecera_orden: normalized.cabecera_orden,
    renglones: normalized.renglones,
    resumen_totales: normalized.resumen_totales
  };
}
function normalizeOrderForCodizulca(rawData) {
  if (!rawData || typeof rawData !== "object") {
    throw new AlkostoOcrStageError(
      "4-Mapeo Nota de Pedido",
      "Los datos extra\xEDdos de la Orden de Compra est\xE1n vac\xEDos o no son un objeto v\xE1lido."
    );
  }
  let validated;
  try {
    validated = validateAndNormalizeAlkostoOC(rawData, {
      strictMath: false,
      requireOrdenNro: false
    });
  } catch (err) {
    throw new AlkostoOcrStageError(
      "4-Mapeo Nota de Pedido",
      err?.message || "Error al normalizar la estructura de la Orden de Compra hacia el Formato Codizulca."
    );
  }
  const valid17Stores = /* @__PURE__ */ new Set([
    ...CADENAS_ABREVIATURAS?.ALKOSTO || ["AK01", "AK02", "AK03", "AK04", "AK05", "AK06", "AK07", "AK08", "AK09", "AK10"],
    ...CADENAS_ABREVIATURAS?.FAMILIA_CENTER || ["FC01", "FC02", "FC03", "FC04", "FC05", "FC06", "FC07"]
  ]);
  const safeNum = (val, fallback = 0) => {
    const n = parseNumeroEstricto(val, fallback);
    return Number.isFinite(n) && !Number.isNaN(n) ? Number(n.toFixed(4)) : fallback;
  };
  const safeStr = (val, fallback = "") => {
    if (val === null || val === void 0) return fallback;
    const s = String(val).trim();
    return s || fallback;
  };
  const rawItemsList = Array.isArray(validated.items) ? validated.items : [];
  const mergedItemsMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < rawItemsList.length; i++) {
    const it = rawItemsList[i] || {};
    const cleanStores = {};
    if (it.tiendas && typeof it.tiendas === "object") {
      for (const [k, v] of Object.entries(it.tiendas)) {
        const tag = safeStr(k).toUpperCase();
        const qty = safeNum(v, 0);
        if (valid17Stores.has(tag) && qty > 0) {
          cleanStores[tag] = Number(((cleanStores[tag] || 0) + qty).toFixed(2));
        }
      }
    }
    const distInput = Array.isArray(it.desglosePorTienda) ? it.desglosePorTienda : Array.isArray(it.distribucion_tiendas) ? it.distribucion_tiendas : Array.isArray(it.distribucionPorTienda) ? it.distribucionPorTienda : [];
    for (const d of distInput) {
      if (!d || typeof d !== "object") continue;
      const tag = safeStr(d.tienda ?? d.codigo_tienda ?? d.codigoTienda).toUpperCase();
      const qty = safeNum(d.cantidad, 0);
      if (valid17Stores.has(tag) && qty > 0 && cleanStores[tag] === void 0) {
        cleanStores[tag] = Number(qty.toFixed(2));
      }
    }
    const codeKey = safeStr(it.codigo || it.codigoPrincipal || it.codigoProducto || it.skuCodizulca || it.codigoBarra, `ITEM_${i + 1}`);
    const isPendingCodeKey = codeKey === "PENDIENTE" || codeKey === "S/C";
    const mergeMapKey = isPendingCodeKey ? `${codeKey}#${safeStr(it.codigoBarra || it.codigoEan || it.descripcion, String(i + 1))}` : codeKey;
    const costoUnit = safeNum(it.valorUnitarioOC ?? it.costoUnitario ?? it.precioUnitario, 0);
    const costoBruto = safeNum(it.costoBruto, costoUnit);
    const sumAk = Object.entries(cleanStores).filter(([tk]) => tk.startsWith("AK")).reduce((acc, [, v]) => acc + v, 0);
    const sumAll = Object.values(cleanStores).reduce((acc, v) => acc + v, 0);
    const fallbackCant = safeNum(it.totalCantidad ?? it.cantidadTotal, 0);
    const effectiveCant = sumAk > 0 ? sumAk : sumAll > 0 ? sumAll : fallbackCant;
    const effectiveTotal = Number((effectiveCant * costoUnit).toFixed(2));
    const existing = mergedItemsMap.get(mergeMapKey);
    if (existing && Object.keys(cleanStores).length > 0) {
      const mergedTiendas = { ...existing.tiendas || {} };
      for (const [tk, tv] of Object.entries(cleanStores)) {
        mergedTiendas[tk] = Number(((mergedTiendas[tk] || 0) + tv).toFixed(2));
      }
      const mSumAk = Object.entries(mergedTiendas).filter(([tk]) => tk.startsWith("AK")).reduce((acc, [, v]) => acc + v, 0);
      const mSumAll = Object.values(mergedTiendas).reduce((acc, v) => acc + v, 0);
      const primaryCant = mSumAk > 0 ? mSumAk : mSumAll;
      existing.tiendas = mergedTiendas;
      existing.desglosePorTienda = Object.entries(mergedTiendas).map(([tienda, cantidad]) => ({
        tienda,
        cantidad: Number(cantidad.toFixed(2))
      }));
      existing.distribucionPorTienda = construirDistribucionPorTienda(mergedTiendas);
      existing.distribucion_tiendas = construirDistribucionTiendasCanonico(mergedTiendas);
      existing.totalCantidad = Number(primaryCant.toFixed(2));
      existing.cantidadTotal = Number(primaryCant.toFixed(2));
      existing.totalRenglon = Number((primaryCant * existing.costoUnitario).toFixed(2));
      existing.subtotal = Number((primaryCant * existing.costoUnitario).toFixed(2));
    } else {
      mergedItemsMap.set(mergeMapKey, {
        renglon: mergedItemsMap.size + 1,
        codigo: codeKey,
        codigoPrincipal: safeStr(it.codigoPrincipal, codeKey),
        codigoProducto: safeStr(it.codigoProducto, codeKey),
        skuCodizulca: safeStr(it.skuCodizulca, codeKey),
        codigoBarra: safeStr(it.codigoBarra, ""),
        codigoEan: it.codigoEan ?? (it.codigoBarra || null),
        ean: it.ean ?? it.codigoEan ?? (it.codigoBarra || null),
        codigoInternoAlkosto: it.codigoInternoAlkosto ?? null,
        descripcion: safeStr(it.descripcion, "PRODUCTO CODIZULCA"),
        iva: safeNum(it.iva, 0),
        emp: safeNum(it.emp, 1),
        unid: normalizarUnidadMedidaAlkosto(it.unid, it.descripcion, it.emp),
        totalCantidad: Number(effectiveCant.toFixed(2)),
        cantidadTotal: Number(effectiveCant.toFixed(2)),
        cantDespachada: safeStr(it.cantDespachada, ""),
        costoBruto,
        ...safeNum(it.descuento, 0) > 0 ? { descuento: Number(safeNum(it.descuento, 0).toFixed(2)) } : {},
        costoUnitario: costoUnit,
        precioUnitario: costoUnit,
        valorUnitarioOC: costoUnit,
        totalRenglon: effectiveTotal > 0 ? effectiveTotal : Number(safeNum(it.totalRenglon, 0).toFixed(2)),
        subtotal: effectiveTotal > 0 ? effectiveTotal : Number(safeNum(it.totalRenglon, 0).toFixed(2)),
        tiendas: cleanStores,
        desglosePorTienda: Object.entries(cleanStores).map(([tienda, cantidad]) => ({
          tienda,
          cantidad: Number(cantidad.toFixed(2))
        })),
        distribucionPorTienda: construirDistribucionPorTienda(cleanStores),
        distribucion_tiendas: construirDistribucionTiendasCanonico(cleanStores),
        cuadreTiendasValido: it.cuadreTiendasValido !== false,
        alertaRevision: Boolean(it.alertaRevision),
        notaRevision: it.notaRevision ?? null
      });
    }
  }
  const safeItems = Array.from(mergedItemsMap.values());
  const safeRenglones = safeItems.map((it, idx) => ({
    numero_renglon: idx + 1,
    codigo_principal: safeStr(it.codigoPrincipal || it.codigo),
    codigo_ean: it.codigoEan ?? null,
    codigo_interno_alkosto: it.codigoInternoAlkosto ?? null,
    descripcion_producto: safeStr(it.descripcion),
    unidad_medida: safeStr(it.unid, "CJ"),
    unidades_por_empaque: Math.max(1, Math.round(safeNum(it.emp, 1))),
    cantidad_total: safeNum(it.totalCantidad, 0),
    distribucion_tiendas: Array.isArray(it.distribucion_tiendas) ? it.distribucion_tiendas : [],
    costo_unitario: safeNum(it.costoUnitario, 0),
    porcentaje_descuento: safeNum(it.descuento, 0),
    porcentaje_impuesto: safeNum(it.iva, 0),
    monto_total_renglon: safeNum(it.totalRenglon, 0),
    alerta_revision: Boolean(it.alertaRevision),
    nota_revision: it.notaRevision ?? null
  }));
  const calcSubAk = Number(
    safeItems.reduce((acc, it) => {
      const akQty = Object.entries(it.tiendas || {}).filter(([tk]) => tk.startsWith("AK")).reduce((s, [, v]) => s + safeNum(v, 0), 0);
      return acc + Number((akQty * safeNum(it.costoUnitario, 0)).toFixed(2));
    }, 0).toFixed(2)
  );
  const calcSubFc = Number(
    safeItems.reduce((acc, it) => {
      const fcQty = Object.entries(it.tiendas || {}).filter(([tk]) => tk.startsWith("FC")).reduce((s, [, v]) => s + safeNum(v, 0), 0);
      return acc + Number((fcQty * safeNum(it.costoUnitario, 0)).toFixed(2));
    }, 0).toFixed(2)
  );
  const subAkFinal = safeNum(validated.subtotalAlkosto, 0) > 0 ? safeNum(validated.subtotalAlkosto, 0) : calcSubAk;
  const subFcFinal = safeNum(validated.subtotalFamiliaCenter, 0) > 0 ? safeNum(validated.subtotalFamiliaCenter, 0) : calcSubFc;
  const subGenFinal = safeNum(validated.subtotalGeneral, 0) > 0 ? safeNum(validated.subtotalGeneral, 0) : Number((subAkFinal + subFcFinal).toFixed(2)) || safeNum(validated.subtotal, 0);
  const ordenNroSafe = safeStr(validated.ordenNro || validated.numeroOrden || validated.numero_oc || rawData?.numeroOrden || rawData?.numero_orden, "S/N");
  const fechaEmisionSafe = safeStr(validated.fechaEmision || validated.fechaOrden || validated.fecha_emision || rawData?.fechaOrden || rawData?.fecha_emision, "");
  const fechaEntregaSafe = safeStr(validated.fechaEntrega || rawData?.fecha_entrega || fechaEmisionSafe, "");
  const diasCreditoSafe = Math.max(0, Math.round(safeNum(validated.diasCredito ?? rawData?.dias_credito, 15)));
  const tasaCambioSafe = safeNum(validated.tasaCambio ?? rawData?.tasa_cambio, 0);
  const observacionesSafe = safeStr(validated.observaciones ?? rawData?.observaciones, "");
  const subtotalSafe = safeNum(validated.subtotal, 0) > 0 ? safeNum(validated.subtotal, 0) : subAkFinal > 0 ? subAkFinal : subGenFinal;
  const tiendasDetectadasSafe = /* @__PURE__ */ new Set();
  safeItems.forEach((it) => {
    if (it.tiendas) Object.keys(it.tiendas).forEach((t) => tiendasDetectadasSafe.add(t));
  });
  return {
    ...validated,
    clienteCadena: safeStr(validated.clienteCadena, "ALKOSTO"),
    cadenasDetectadas: Array.isArray(validated.cadenasDetectadas) && validated.cadenasDetectadas.length > 0 ? validated.cadenasDetectadas : ["ALKOSTO"],
    tiendasDetectadas: Array.from(tiendasDetectadasSafe),
    ordenNro: ordenNroSafe,
    numeroOrden: ordenNroSafe,
    numero_oc: ordenNroSafe,
    sede: safeStr(validated.sede, "AKOP"),
    fechaEmision: fechaEmisionSafe,
    fechaOrden: fechaEmisionSafe,
    fecha_emision: fechaEmisionSafe,
    fechaEntrega: fechaEntregaSafe,
    moneda: safeStr(validated.moneda, "USD"),
    condicionPago: safeStr(validated.condicionPago, `${diasCreditoSafe} d\xEDas`),
    diasCredito: diasCreditoSafe,
    tasaCambio: tasaCambioSafe,
    proveedorNombre: safeStr(validated.proveedorNombre, "CODIZULCA, C.A."),
    proveedorRif: safeStr(validated.proveedorRif, "J409876136"),
    observaciones: observacionesSafe,
    subtotal: Number(subtotalSafe.toFixed(2)),
    montoTotal: Number((subGenFinal || subtotalSafe).toFixed(2)),
    subtotalAlkosto: subAkFinal > 0 ? Number(subAkFinal.toFixed(2)) : void 0,
    subtotalFamiliaCenter: subFcFinal > 0 ? Number(subFcFinal.toFixed(2)) : void 0,
    subtotalGeneral: subGenFinal > 0 ? Number(subGenFinal.toFixed(2)) : void 0,
    totalNeto: Number((subGenFinal || subtotalSafe).toFixed(2)),
    tiendas: Array.from(valid17Stores),
    cabecera_orden: validated.cabecera_orden || {
      cliente_emisor: safeStr(validated.clienteCadena, "ALKOSTO"),
      receptor_destino: "CODIZULCA",
      numero_orden_compra: ordenNroSafe,
      fecha_emision: normalizarFechaISOAlkosto(fechaEmisionSafe) || fechaEmisionSafe,
      fecha_entrega_estimada: normalizarFechaISOAlkosto(fechaEntregaSafe),
      moneda: safeStr(validated.moneda, "USD"),
      condicion_pago: safeStr(validated.condicionPago, `${diasCreditoSafe} d\xEDas`),
      observaciones_generales: observacionesSafe || null
    },
    renglones: safeRenglones,
    resumen_totales: validated.resumen_totales || {
      total_renglones_extraidos: safeRenglones.length,
      total_unidades_pedidas: Number(safeRenglones.reduce((a, r) => a + r.cantidad_total, 0).toFixed(2)),
      subtotal_neto: Number(subtotalSafe.toFixed(2)),
      total_descuentos: 0,
      total_impuestos: 0,
      monto_total_orden: Number((subGenFinal || subtotalSafe).toFixed(2)),
      cuadre_aritmetico_correcto: true
    },
    items: safeItems
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
var ALKOSTO_OCR_MODEL_CASCADE, AlkostoOcrStageError, ALKOSTO_OC_EXTRACTION_SYSTEM_PROMPT, ALKOSTO_OC_RESPONSE_SCHEMA, AlkostoParseValidationError, ALKOSTO_STORE_TAGS, FAMILIA_CENTER_STORE_TAGS, VECINO_CENTER_STORE_TAGS, ALL_VALID_STORE_TAGS;
var init_alkostoOcParser = __esm({
  "src/services/alkostoOcParser.ts"() {
    init_alkostoService();
    init_productosCodizulca();
    ALKOSTO_OCR_MODEL_CASCADE = [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash"
    ];
    AlkostoOcrStageError = class extends Error {
      constructor(stage, message, options) {
        const cleanMsg = String(message || "Error desconocido").replace(/^Error en Etapa \[[^\]]+\]:\s*/i, "");
        super(`Error en Etapa [${stage}]: ${cleanMsg}`);
        this.name = "AlkostoOcrStageError";
        this.stage = stage;
        this.statusCode = options?.statusCode;
        this.code = options?.code;
        this.details = options?.details;
      }
    };
    ALKOSTO_OC_EXTRACTION_SYSTEM_PROMPT = buildAlkostoOcSystemPrompt();
    ALKOSTO_OC_RESPONSE_SCHEMA = {
      type: "OBJECT",
      properties: {
        numeroOrden: {
          type: "STRING",
          description: 'N\xFAmero de la Orden de Compra emitida por Alkosto / Familia Center (ej. "0000054457").'
        },
        fechaOrden: {
          type: "STRING",
          description: "Fecha de emisi\xF3n de la orden de compra (YYYY-MM-DD o DD/MM/YYYY)."
        },
        fechaEntrega: {
          type: "STRING",
          nullable: true,
          description: "Fecha estimada de entrega de la orden (YYYY-MM-DD o DD/MM/YYYY)."
        },
        diasCredito: {
          type: "NUMBER",
          nullable: true,
          description: "D\xEDas de cr\xE9dito de la condici\xF3n de pago (ej. 10, 15, 30)."
        },
        tasaCambio: {
          type: "NUMBER",
          nullable: true,
          description: "Tasa de cambio BCV impresa en la cabecera (ej. 872.3927)."
        },
        observaciones: {
          type: "STRING",
          nullable: true,
          description: "Observaciones generales impresas en la cabecera de la orden."
        },
        tiendasDetectadas: {
          type: "ARRAY",
          description: "Lista de c\xF3digos de las sucursales de Alkosto (AK01..AK10) y Familia Center (FC01..FC07) presentes en la orden, excluyendo AKOP y CI.",
          items: {
            type: "STRING"
          }
        },
        renglones: {
          type: "ARRAY",
          description: "Totalidad de los renglones de productos de la Orden de Compra unificando todas sus p\xE1ginas.",
          items: {
            type: "OBJECT",
            properties: {
              codigo: {
                type: "STRING",
                description: 'C\xF3digo num\xE9rico oficial de Codizulca del 9 al 1662 cuando hay coincidencia exacta de EAN o sustantivo principal (ej. "1642" para EAN 7590377000411 ARVEJAS VENCAMPO, "1644" para EAN 7590377000459 CARAOTAS NEGRAS VENCAMPO, "1574" para EAN 7590377000503 LECHE VENCAMPO 10X400GR), o "PENDIENTE" si el producto no tiene coincidencia exacta de sustantivo principal en el cat\xE1logo. PROHIBIDO inventar siglas como LPV o asignar 1555 por coincidencia parcial de marca/gramaje.'
              },
              codigoProducto: {
                type: "STRING",
                nullable: true,
                description: 'C\xF3digo principal o SKU del producto homologado a Codizulca (o "PENDIENTE" si requiere asignaci\xF3n manual).'
              },
              ean: {
                type: "STRING",
                nullable: true,
                description: 'C\xF3digo de barras EAN-13 impreso en la OC si est\xE1 presente (ej. "7590377000411", "7590377000459").'
              },
              codigoInternoAlkosto: {
                type: "STRING",
                nullable: true,
                description: 'C\xF3digo interno PLU de Alkosto si est\xE1 presente (ej. "100881").'
              },
              descripcion: {
                type: "STRING",
                description: 'Descripci\xF3n del producto: si tiene coincidencia exacta de EAN o sustantivo principal en el cat\xE1logo de Codizulca, usa su descripci\xF3n oficial (ej. "ARVEJAS VENCAMPO 25 UND X 400GR", "CARAOTAS NEGRAS VENCAMPO 25 UND X 400GR"); si NO tiene coincidencia exacta en el cat\xE1logo, conserva intacta la descripci\xF3n original del PDF (ej. "ARVEJAS VERDES VENCAMPO 400GR/1.00").'
              },
              unidad: {
                type: "STRING",
                description: 'Unidad de empaque solicitada: "BULTO", "CAJA", "CJ", "KG" o "UND".'
              },
              unidadMedida: {
                type: "STRING",
                nullable: true,
                description: 'Unidad de medida normalizada: "CJ", "KG", "UND" o "BLT".'
              },
              unidadesPorEmpaque: {
                type: "NUMBER",
                nullable: true,
                description: "Unidades por empaque (columna EMP)."
              },
              cantidad: {
                type: "NUMBER",
                description: "Cantidad num\xE9rica solicitada del producto."
              },
              cantidadTotal: {
                type: "NUMBER",
                nullable: true,
                description: "Cantidad total solicitada del producto sumando las sucursales v\xE1lidas."
              },
              desglosePorTienda: {
                type: "ARRAY",
                description: "Desglose de cantidades pedidas por cada tienda v\xE1lida (AK01..AK10, FC01..FC07), ignorando AKOP y CI.",
                items: {
                  type: "OBJECT",
                  properties: {
                    tienda: {
                      type: "STRING",
                      description: 'C\xF3digo de tienda (ej. "AK01", "FC01").'
                    },
                    cantidad: {
                      type: "NUMBER",
                      description: "Cantidad num\xE9rica asignada a esa tienda."
                    }
                  },
                  required: ["tienda", "cantidad"]
                }
              },
              valorUnitarioOC: {
                type: "NUMBER",
                description: "Valor unitario exacto le\xEDdo de la Orden de Compra por cada unidad de empaque solicitada (sin confundirlo con subtotal ni impuestos)."
              },
              precioUnitario: {
                type: "NUMBER",
                nullable: true,
                description: "Costo o valor unitario neto en USD le\xEDdo de la Orden de Compra."
              },
              porcentajeDescuento: {
                type: "NUMBER",
                nullable: true,
                description: "Porcentaje de descuento o bonificaci\xF3n comercial si aplica."
              },
              subtotal: {
                type: "NUMBER",
                description: "Subtotal exacto del rengl\xF3n en USD (cantidad * valorUnitarioOC)."
              }
            },
            required: [
              "codigo",
              "descripcion",
              "unidad",
              "cantidad",
              "desglosePorTienda",
              "valorUnitarioOC",
              "subtotal"
            ]
          }
        },
        subtotalAlkosto: {
          type: "NUMBER",
          nullable: true,
          description: "Subtotal de la p\xE1gina de Alkosto en USD."
        },
        subtotalFamiliaCenter: {
          type: "NUMBER",
          nullable: true,
          description: "Subtotal de la p\xE1gina de Familia Center en USD."
        },
        montoTotal: {
          type: "NUMBER",
          description: "Monto total general de la Orden de Compra en USD."
        }
      },
      required: ["numeroOrden", "fechaOrden", "tiendasDetectadas", "renglones", "montoTotal"]
    };
    AlkostoParseValidationError = class extends Error {
      constructor(message, issues = [], code = "ALKOSTO_OC_VALIDATION_ERROR") {
        super(message);
        this.name = "AlkostoParseValidationError";
        this.code = code;
        this.issues = issues;
      }
    };
    ALKOSTO_STORE_TAGS = [
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
    FAMILIA_CENTER_STORE_TAGS = [
      "FC01",
      "FC02",
      "FC03",
      "FC04",
      "FC05",
      "FC06",
      "FC07",
      "FCOP"
    ];
    VECINO_CENTER_STORE_TAGS = [
      "VC01",
      "VC02",
      "VC03"
    ];
    ALL_VALID_STORE_TAGS = /* @__PURE__ */ new Set([
      ...ALKOSTO_STORE_TAGS,
      ...FAMILIA_CENTER_STORE_TAGS,
      ...VECINO_CENTER_STORE_TAGS
    ]);
  }
});

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
var import_https = __toESM(require("https"), 1);
var import_zlib = __toESM(require("zlib"), 1);
var import_vite = require("vite");
var import_dotenv = __toESM(require("dotenv"), 1);
init_alkostoOcParser();
init_productosCodizulca();
var import_crypto = __toESM(require("crypto"), 1);

// src/lib/rubros.ts
var RUBROS_CONFIG = [
  {
    codigo: "AZUCAR",
    label: "AZUCAR",
    categoriaServidor: "AZUCAR",
    palabrasClave: "azucar montalban vencampo",
    activo: true
  },
  {
    codigo: "LECHE_VENCAMPO",
    label: "LECHE VENCAMPO",
    categoriaServidor: "LECHE VENCAMPO",
    palabrasClave: "leche en polvo vencampo lpv",
    activo: true
  },
  {
    codigo: "POLLO",
    label: "POLLO",
    categoriaServidor: "POLLO",
    palabrasClave: "pollo filet muslo alas higado molleja arroz vencampo",
    activo: true
  },
  {
    codigo: "ESTANDAR_ASTURIAS",
    label: "ESTANDAR Y SUPERIOR ASTURIAS",
    categoriaServidor: "ESTANDAR Y SUPERIOR ASTURIAS",
    palabrasClave: "jamon estandar superior asturias entero",
    activo: true
  },
  {
    codigo: "MORTADELA_SALPICAO",
    label: "MORTADELA SALPICAO Y ASTURIAS",
    categoriaServidor: "MORTADELA SALPICAO Y ASTURIAS",
    palabrasClave: "mortadela salpicao asturias ligeros enteros",
    activo: true
  },
  // ---- Legacy / auxiliares (no se muestran como tarjeta independiente) ----
  { codigo: "ACEITE", label: "ACEITE", categoriaServidor: "ACEITE", palabrasClave: "aceite oleo soya girasol", activo: false },
  {
    codigo: "MORTADELA_ASTURIAS",
    label: "MORTADELA ASTURIAS",
    categoriaServidor: "MORTADELA ASTURIAS",
    palabrasClave: "mortadela asturias",
    activo: false
  },
  { codigo: "SALPICAO", label: "SALPICAO", categoriaServidor: "SALPICAO", palabrasClave: "salpicao ligeros", activo: false }
];
var RUBROS_ACTIVOS_CONFIG = RUBROS_CONFIG.filter((r) => r.activo);
var RUBROS_ACTIVACION = RUBROS_ACTIVOS_CONFIG.map((r) => r.codigo);
var RUBROS_CLAVE = RUBROS_ACTIVOS_CONFIG.map((r) => ({
  codigo: r.codigo,
  label: r.label
}));
var RUBRO_LABEL = {
  ...Object.fromEntries(RUBROS_CONFIG.map((r) => [r.codigo, r.label])),
  OTROS: "Otros"
};
var RUBRO_SERVER_CATEGORY = {
  ...Object.fromEntries(RUBROS_CONFIG.map((r) => [r.codigo, r.categoriaServidor])),
  OTROS: "OTROS"
};
var RUBRO_KEYWORDS = {
  ...Object.fromEntries(RUBROS_CONFIG.map((r) => [r.codigo, r.palabrasClave])),
  OTROS: "otros varios"
};
function esRubroActivo(codigo) {
  return RUBROS_ACTIVACION.includes(codigo);
}
var sinAcentos = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
function categoriaARubroCodigo(cat) {
  const c = sinAcentos(cat).trim();
  if (c === "MORTADELA_ASTURIAS" || c === "MORTADELA ASTURIAS") return "MORTADELA_SALPICAO";
  if (c === "SALPICAO") return "MORTADELA_SALPICAO";
  if (c.includes("MORTADELA") || c.includes("SALPICAO") || c.includes("LIGEROS")) return "MORTADELA_SALPICAO";
  if (c.includes("LECHE")) return "LECHE_VENCAMPO";
  if (c.includes("AZUCAR")) return "AZUCAR";
  if (c.includes("ESTANDAR") || c.includes("SUPERIOR") || c.includes("JAMON") || c.includes("ENTERO")) return "ESTANDAR_ASTURIAS";
  if (c.includes("POLLO") || c.includes("ARROZ")) return "POLLO";
  if (c.includes("ACEITE")) return "ACEITE";
  return "OTROS";
}
var SKUS_MORTADELA_ASTURIAS = /* @__PURE__ */ new Set(["1464", "1462", "1512", "1521", "1561", "1522", "1564", "1496", "1511"]);
var SKUS_SALPICAO = /* @__PURE__ */ new Set(["1563", "1562", "1519", "1599"]);
var SKUS_LECHE_VENCAMPO = /* @__PURE__ */ new Set(["1536", "1555", "1556", "1574", "1579", "1622"]);
var SKUS_POLLO = /* @__PURE__ */ new Set(["630", "629", "870", "393", "1568", "681", "POLLO", "FILET", "MUSLO", "ALAS"]);
function clasificarRubro(sku, nombre) {
  const s = String(sku || "").trim();
  const sU = s.toUpperCase();
  const n = String(nombre || "").toUpperCase();
  if (s === "1461" || s === "1463" || n.includes("ESTANDAR ASTURIAS") || n.includes("SUPERIOR ASTURIAS")) {
    return "ESTANDAR_ASTURIAS";
  }
  if (n.includes("SALPICAO") || SKUS_SALPICAO.has(s) || SKUS_MORTADELA_ASTURIAS.has(s) || n.includes("ASTURIAS") && (n.includes("MORTADELA") || n.includes("MORT.") || n.includes("PECHUGA"))) {
    return "MORTADELA_SALPICAO";
  }
  if (SKUS_LECHE_VENCAMPO.has(s) || n.includes("LECHE") && n.includes("VENCAMPO")) return "LECHE_VENCAMPO";
  if (sU === "ACEITE" || n.includes("ACEITE")) return "ACEITE";
  if (sU === "AZUCAR" || sU === "AZ\xDACAR" || n.includes("AZUCAR") || n.includes("AZ\xDACAR")) return "AZUCAR";
  if (SKUS_POLLO.has(s) || SKUS_POLLO.has(sU) || n.includes("POLLO ENTERO") || n.includes("POLLO TODAS") || n.includes("POLLO VENCAMPO") || n.includes("FILET") || n.includes("MUSLO") || n.includes("ALAS DESPRESADAS") || n.includes("HIGADO") || n.includes("MOLLEJA")) {
    return "POLLO";
  }
  return "OTROS";
}
function clasificarRubroServerLabel(sku, nombre) {
  return RUBRO_SERVER_CATEGORY[clasificarRubro(sku, nombre)];
}

// src/utils/maestraParser.ts
var MaestraParseError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "MaestraParseError";
  }
};
var REQUIRED_HEADERS = ["SUPERVISOR", "IDVENDEDOR", "VENDEDOR", "ID", "RAZONSOCIAL", "RIF"];
var MAX_HEADER_SCAN_ROWS = 10;
var RIF_NULL_TOKENS = /* @__PURE__ */ new Set(["", "#N/D", "#N/A", "N/D", "N/A", "NA", "NULL", "NAN", "UNDEFINED"]);
function normHeader(s) {
  return String(s ?? "").replace(/^\uFEFF/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function cleanText(s) {
  return String(s ?? "").replace(/[\uFEFF\u200B-\u200D]/g, "").replace(/\s+/g, " ").trim();
}
function decodeMaestraBytes(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let texto;
  let fallback = false;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(view);
  } catch {
    texto = new TextDecoder("windows-1252").decode(view);
    fallback = true;
  }
  return { texto: texto.replace(/^\uFEFF/, ""), fallback };
}
function parseCsvRows(texto, delimitador = ";") {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;
  let fieldStart = true;
  const endField = () => {
    row.push(cur);
    cur = "";
    fieldStart = true;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (inQuotes) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
      continue;
    }
    if (c === '"' && fieldStart) {
      inQuotes = true;
      fieldStart = false;
    } else if (c === delimitador) {
      endField();
    } else if (c === "\r") {
      if (texto[i + 1] === "\n") i++;
      endRow();
    } else if (c === "\n") {
      endRow();
    } else {
      cur += c;
      fieldStart = false;
    }
  }
  if (cur !== "" || row.length > 0) endRow();
  return rows;
}
function sanitizarRifMaestra(raw) {
  const t = cleanText(raw).replace(/^["']+|["']+$/g, "").trim();
  if (RIF_NULL_TOKENS.has(t.toUpperCase())) return null;
  return t.replace(/\s+/g, "").toUpperCase();
}
function aEnteroEstricto(raw) {
  const t = cleanText(raw).replace(/\.0+$/, "");
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}
function filaVacia(cells) {
  return cells.every((c) => cleanText(c) === "");
}
function parseMaestraTexto(textoCrudo, opciones = {}) {
  const texto = textoCrudo.replace(/^\uFEFF/, "");
  const todas = parseCsvRows(texto, ";");
  let headerIdx = -1;
  let colIdx = null;
  for (let i = 0; i < Math.min(todas.length, MAX_HEADER_SCAN_ROWS); i++) {
    const norm = todas[i].map(normHeader);
    const found = {};
    let ok = true;
    for (const h of REQUIRED_HEADERS) {
      const pos = norm.indexOf(h);
      if (pos < 0) {
        ok = false;
        break;
      }
      found[h] = pos;
    }
    if (ok) {
      headerIdx = i;
      colIdx = found;
      break;
    }
  }
  if (headerIdx < 0 || !colIdx) {
    throw new MaestraParseError(
      `No se encontr\xF3 la fila de encabezados. Se esperaba: SUPERVISOR; ID VENDEDOR; Vendedor; Id; Raz\xF3n Social; RIF (en las primeras ${MAX_HEADER_SCAN_ROWS} filas).`
    );
  }
  const bannerCells = todas.slice(0, headerIdx).flatMap((r) => r.map(cleanText)).filter(Boolean);
  const banner = bannerCells.length > 0 ? bannerCells.join(" ") : null;
  const warnings = [];
  if (opciones.codificacionFallback) {
    warnings.push({
      tipo: "CODIFICACION_NO_UTF8",
      mensaje: "El archivo no era UTF-8 v\xE1lido; se decodific\xF3 como windows-1252. Revisa que los acentos y la \xD1 se vean bien."
    });
  }
  const validas = [];
  let filasLeidas = 0;
  let filasDescartadas = 0;
  for (let i = headerIdx + 1; i < todas.length; i++) {
    const cells = todas[i];
    if (filaVacia(cells)) continue;
    filasLeidas++;
    const linea = i + 1;
    const get = (h) => cleanText(cells[colIdx[h]]);
    const idVendRaw = get("IDVENDEDOR");
    const idCliRaw = get("ID");
    if (!idVendRaw || !idCliRaw || /^(NAN|#N\/D|#N\/A|N\/A|NULL)$/i.test(idVendRaw) || /^(NAN|#N\/D|#N\/A|N\/A|NULL)$/i.test(idCliRaw)) {
      filasDescartadas++;
      const rifRaw = get("RIF");
      const razon = get("RAZONSOCIAL");
      const sup = get("SUPERVISOR");
      if (razon || sup || get("VENDEDOR") || idVendRaw || idCliRaw) {
        warnings.push({
          tipo: "FILA_PARCIAL_DESCARTADA",
          mensaje: `L\xEDnea ${linea} descartada: falta Id (${idCliRaw || "vac\xEDo"}) o ID VENDEDOR (${idVendRaw || "vac\xEDo"}); raz\xF3n social "${razon}".`,
          lineas: [linea]
        });
      } else if (rifRaw && !RIF_NULL_TOKENS.has(rifRaw.toUpperCase())) {
        warnings.push({
          tipo: "FILA_PARCIAL_DESCARTADA",
          mensaje: `L\xEDnea ${linea} descartada pero tra\xEDa un RIF real (${rifRaw}) sin Id ni vendedor.`,
          lineas: [linea]
        });
      }
      continue;
    }
    const idVendedor = aEnteroEstricto(idVendRaw);
    const idCliente = aEnteroEstricto(idCliRaw);
    if (idVendedor === null || idCliente === null) {
      filasDescartadas++;
      warnings.push({
        tipo: "ID_NO_NUMERICO_DESCARTADO",
        mensaje: `L\xEDnea ${linea} descartada: Id ("${idCliRaw}") o ID VENDEDOR ("${idVendRaw}") no es un entero v\xE1lido.`,
        lineas: [linea]
      });
      continue;
    }
    validas.push({
      linea,
      supervisor: get("SUPERVISOR"),
      idVendedor,
      vendedor: get("VENDEDOR"),
      idCliente,
      razonSocial: get("RAZONSOCIAL"),
      rif: sanitizarRifMaestra(cells[colIdx.RIF])
    });
  }
  const porId = /* @__PURE__ */ new Map();
  for (const f of validas) {
    const arr = porId.get(f.idCliente);
    if (arr) arr.push(f);
    else porId.set(f.idCliente, [f]);
  }
  const clientes = [];
  let idsDuplicados = 0;
  for (const [idCliente, filas] of porId) {
    const ganadora = filas[filas.length - 1];
    clientes.push(ganadora);
    if (filas.length > 1) {
      idsDuplicados++;
      const detalle = filas.map((f) => `l\xEDnea ${f.linea} \u2192 vendedor ${f.idVendedor} (${f.vendedor})`).join(" | ");
      warnings.push({
        tipo: "ID_CLIENTE_DUPLICADO",
        idCliente,
        lineas: filas.map((f) => f.linea),
        mensaje: `Id ${idCliente} ("${ganadora.razonSocial}") aparece ${filas.length} veces: ${detalle}. Se conserva la \xFAltima (l\xEDnea ${ganadora.linea}, vendedor ${ganadora.idVendedor}).`
      });
    }
  }
  const vendedoresMap = /* @__PURE__ */ new Map();
  for (const f of validas) {
    const existente = vendedoresMap.get(f.idVendedor);
    if (!existente) {
      vendedoresMap.set(f.idVendedor, { idVendedor: f.idVendedor, nombre: f.vendedor, supervisor: f.supervisor });
    } else if (existente.nombre !== f.vendedor || existente.supervisor !== f.supervisor) {
      warnings.push({
        tipo: "VENDEDOR_INCONSISTENTE",
        mensaje: `ID VENDEDOR ${f.idVendedor} aparece con datos distintos (l\xEDnea ${f.linea}: "${f.vendedor}" / ${f.supervisor}) vs. el primero ("${existente.nombre}" / ${existente.supervisor}). Se conserva el primero.`,
        lineas: [f.linea]
      });
    }
  }
  const vendedores = Array.from(vendedoresMap.values()).sort((a, b) => a.idVendedor - b.idVendedor);
  vendedores.forEach((v) => {
    if (!v.supervisor) {
      warnings.push({ tipo: "SUPERVISOR_VACIO", mensaje: `El vendedor ${v.idVendedor} (${v.nombre}) no tiene supervisor.` });
    }
  });
  const supervisores = Array.from(new Set(vendedores.map((v) => v.supervisor).filter(Boolean))).sort();
  const rifPendientesFilas = validas.filter((f) => f.rif === null).length;
  const rifPendientesClientes = clientes.filter((c) => c.rif === null).length;
  const porRif = /* @__PURE__ */ new Map();
  for (const c of clientes) {
    if (c.rif === null) continue;
    if (!porRif.has(c.rif)) porRif.set(c.rif, /* @__PURE__ */ new Set());
    porRif.get(c.rif).add(c.idCliente);
  }
  let gruposRif = 0;
  let filasRif = 0;
  for (const ids of porRif.values()) {
    if (ids.size > 1) {
      gruposRif++;
      filasRif += ids.size;
    }
  }
  return {
    clientes,
    vendedores,
    supervisores,
    reporte: {
      banner,
      filasLeidas,
      filasValidas: validas.length,
      filasDescartadas,
      totalSupervisores: supervisores.length,
      totalVendedores: vendedores.length,
      clientesUnicos: clientes.length,
      rifPendientesFilas,
      rifPendientesClientes,
      idsDuplicadosEnArchivo: idsDuplicados,
      filasDuplicadasEliminadas: validas.length - clientes.length,
      rifsCompartidos: { grupos: gruposRif, filas: filasRif },
      warnings
    }
  };
}
function parseMaestraBytes(bytes) {
  const { texto, fallback } = decodeMaestraBytes(bytes);
  return parseMaestraTexto(texto, { codificacionFallback: fallback });
}

// src/utils/maestraSync.ts
var MAESTRA_CHUNK_SIZE = 500;
var MAESTRA_UMBRAL_BAJAS = 0.1;
var MaestraEsquemaError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "MaestraEsquemaError";
  }
};
var MaestraBajasMasivasError = class extends Error {
  constructor(bajas, activos) {
    super(
      `La carga dar\xEDa de baja ${bajas} de ${activos} clientes activos (${(bajas / activos * 100).toFixed(1)} %), m\xE1s del ${MAESTRA_UMBRAL_BAJAS * 100} % permitido. Revisa que el archivo no est\xE9 truncado o confirma expl\xEDcitamente las bajas.`
    );
    this.name = "MaestraBajasMasivasError";
    this.bajas = bajas;
    this.activos = activos;
  }
};
function chunk(arr, size = MAESTRA_CHUNK_SIZE) {
  if (size < 1) throw new Error("size debe ser >= 1");
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
async function calcularPreviewDb(repo, parsed, opts = {}) {
  try {
    await repo.verificarEsquema();
  } catch (e) {
    if (e instanceof MaestraEsquemaError) {
      return {
        esquemaDisponible: false,
        mensajeEsquema: e.message,
        activosActuales: 0,
        nuevos: 0,
        actualizados: 0,
        reactivados: 0,
        aBaja: 0,
        aBajaIds: [],
        cambiosVendedor: 0,
        porcentajeBajas: 0,
        requiereConfirmarBajas: false,
        yaCargado: false
      };
    }
    throw e;
  }
  const actuales = await repo.listarClientes();
  const porId = new Map(actuales.map((c) => [c.id_cliente, c]));
  const enArchivo = new Set(parsed.clientes.map((c) => c.idCliente));
  let nuevos = 0;
  let actualizados = 0;
  let reactivados = 0;
  let cambiosVendedor = 0;
  for (const c of parsed.clientes) {
    const ex = porId.get(c.idCliente);
    if (!ex) nuevos++;
    else {
      if (ex.activo) actualizados++;
      else reactivados++;
      if (ex.id_vendedor !== null && ex.id_vendedor !== c.idVendedor) cambiosVendedor++;
    }
  }
  const activos = actuales.filter((c) => c.activo);
  const aBajaIds = activos.filter((c) => !enArchivo.has(c.id_cliente)).map((c) => c.id_cliente);
  const porcentajeBajas = activos.length > 0 ? aBajaIds.length / activos.length : 0;
  const aplicada = opts.archivoSha256 ? await repo.buscarCargaAplicada(opts.archivoSha256) : null;
  return {
    esquemaDisponible: true,
    activosActuales: activos.length,
    nuevos,
    actualizados,
    reactivados,
    aBaja: aBajaIds.length,
    aBajaIds,
    cambiosVendedor,
    porcentajeBajas,
    requiereConfirmarBajas: activos.length > 0 && porcentajeBajas > MAESTRA_UMBRAL_BAJAS,
    yaCargado: Boolean(aplicada)
  };
}
async function sincronizarMaestra(repo, parsed, opts = {}) {
  if (parsed.clientes.length === 0) {
    throw new Error("El archivo no tiene clientes v\xE1lidos; no se escribe nada (evita dar de baja toda la cartera).");
  }
  const reloj = opts.ahora ?? (() => /* @__PURE__ */ new Date());
  await repo.verificarEsquema();
  const preview = await calcularPreviewDb(repo, parsed, { archivoSha256: opts.archivoSha256 });
  if (preview.requiereConfirmarBajas && !opts.forzarBajas) {
    throw new MaestraBajasMasivasError(preview.aBaja, preview.activosActuales);
  }
  const cargaId = await repo.crearCarga({
    periodo: opts.periodo,
    archivoNombre: opts.archivoNombre,
    archivoSha256: opts.archivoSha256,
    creadoPor: opts.creadoPor
  });
  const ahoraIso = reloj().toISOString();
  try {
    await repo.upsertSupervisores(
      parsed.supervisores.map((nombre) => ({ nombre, activo: true, fecha_baja: null, fecha_actualizacion: ahoraIso, ultima_carga_id: cargaId }))
    );
    await repo.upsertVendedores(
      parsed.vendedores.map((v) => ({
        id_vendedor: v.idVendedor,
        nombre: v.nombre,
        supervisor: v.supervisor || null,
        activo: true,
        fecha_baja: null,
        fecha_actualizacion: ahoraIso,
        ultima_carga_id: cargaId
      }))
    );
    const filasClientes = parsed.clientes.map((c) => ({
      id_cliente: c.idCliente,
      razon_social: c.razonSocial,
      rif: c.rif,
      id_vendedor: c.idVendedor,
      supervisor: c.supervisor || null,
      activo: true,
      fecha_baja: null,
      fecha_actualizacion: ahoraIso,
      ultima_carga_id: cargaId
    }));
    for (const lote of chunk(filasClientes, MAESTRA_CHUNK_SIZE)) {
      await repo.upsertClientes(lote);
    }
    const clientesDesactivados = await repo.desactivarClientesNoVigentes(cargaId, ahoraIso);
    const vendedoresDesactivados = await repo.desactivarVendedoresNoVigentes(cargaId, ahoraIso);
    const supervisoresDesactivados = await repo.desactivarSupervisoresNoVigentes(cargaId, ahoraIso);
    const esperadoPorVendedor = /* @__PURE__ */ new Map();
    parsed.clientes.forEach((c) => esperadoPorVendedor.set(c.idVendedor, (esperadoPorVendedor.get(c.idVendedor) || 0) + 1));
    const enBd = await repo.contarClientesActivosPorVendedor();
    const diferencias = [];
    const todosVendedores = /* @__PURE__ */ new Set([...esperadoPorVendedor.keys(), ...Object.keys(enBd).map(Number)]);
    for (const idV of todosVendedores) {
      const esperado = esperadoPorVendedor.get(idV) || 0;
      const real = enBd[idV] || 0;
      if (esperado !== real) diferencias.push({ idVendedor: idV, esperado, enBd: real });
    }
    const activosEnBd = Object.values(enBd).reduce((a, b) => a + b, 0);
    const verificacionOk = diferencias.length === 0 && activosEnBd === parsed.clientes.length;
    const estado = verificacionOk ? "OK" : "ADVERTENCIA";
    const result = {
      cargaId,
      estado,
      clientes: {
        enArchivo: parsed.clientes.length,
        nuevos: preview.nuevos,
        actualizados: preview.actualizados,
        reactivados: preview.reactivados,
        desactivados: clientesDesactivados,
        cambiosVendedor: preview.cambiosVendedor
      },
      vendedores: { enArchivo: parsed.vendedores.length, desactivados: vendedoresDesactivados },
      supervisores: { enArchivo: parsed.supervisores.length, desactivados: supervisoresDesactivados },
      lotes: { tamano: MAESTRA_CHUNK_SIZE, clientes: chunk(filasClientes, MAESTRA_CHUNK_SIZE).length },
      verificacion: { ok: verificacionOk, activosEnBd, esperados: parsed.clientes.length, diferenciasPorVendedor: diferencias },
      yaCargadoAntes: preview.yaCargado
    };
    await repo.cerrarCarga(cargaId, estado, { reporte: parsed.reporte, resultado: result });
    return result;
  } catch (err) {
    try {
      await repo.cerrarCarga(cargaId, "ERROR", { reporte: parsed.reporte }, String(err?.message || err));
    } catch {
    }
    throw err;
  }
}
function esErrorTablaInexistente(error) {
  const code = String(error?.code || "");
  const msg = String(error?.message || "");
  return code === "42P01" || code === "PGRST205" || /does not exist|schema cache|Could not find the table/i.test(msg);
}
var MSG_ESQUEMA = "Las tablas de la maestra no existen en Supabase. Ejecuta una vez el script scripts/sql/02_maestra.sql en el SQL Editor y vuelve a intentar.";
async function leerTodo(supabase2, tabla, columnas, orden, filtro) {
  const out = [];
  const PAGINA = 1e3;
  for (let desde = 0; ; desde += PAGINA) {
    let q = supabase2.from(tabla).select(columnas);
    if (filtro) q = filtro(q);
    const { data, error } = await q.order(orden).range(desde, desde + PAGINA - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGINA) break;
  }
  return out;
}
function assertOk(error, contexto) {
  if (error) throw new Error(`${contexto}: ${error.message || error}`);
}
function crearMaestraRepoSupabase(supabase2) {
  const noVigente = (cargaId) => `ultima_carga_id.is.null,ultima_carga_id.neq.${cargaId}`;
  return {
    async verificarEsquema() {
      for (const tabla of ["maestra_cargas", "maestra_supervisores", "maestra_vendedores", "maestra_clientes"]) {
        const { error } = await supabase2.from(tabla).select("*", { head: true, count: "exact" }).limit(1);
        if (error) {
          if (esErrorTablaInexistente(error)) throw new MaestraEsquemaError(MSG_ESQUEMA);
          throw new Error(`No se pudo verificar la tabla ${tabla}: ${error.message}`);
        }
      }
    },
    listarClientes: () => leerTodo(supabase2, "maestra_clientes", "id_cliente,activo,id_vendedor", "id_cliente"),
    listarVendedores: () => leerTodo(supabase2, "maestra_vendedores", "id_vendedor,activo", "id_vendedor"),
    async buscarCargaAplicada(sha256) {
      const { data, error } = await supabase2.from("maestra_cargas").select("id,finalizado_en").eq("archivo_sha256", sha256).in("estado", ["OK", "ADVERTENCIA"]).order("creado_en", { ascending: false }).limit(1);
      assertOk(error, "Consultando cargas previas");
      return data && data.length > 0 ? data[0] : null;
    },
    async crearCarga(meta) {
      const { data, error } = await supabase2.from("maestra_cargas").insert({
        periodo: meta.periodo ?? null,
        archivo_nombre: meta.archivoNombre ?? null,
        archivo_sha256: meta.archivoSha256 ?? null,
        creado_por: meta.creadoPor ?? null,
        estado: "EN_CURSO"
      }).select("id").single();
      assertOk(error, "Creando registro de carga");
      return data.id;
    },
    async upsertSupervisores(rows) {
      const { error } = await supabase2.from("maestra_supervisores").upsert(rows, { onConflict: "nombre" });
      assertOk(error, "UPSERT maestra_supervisores");
    },
    async upsertVendedores(rows) {
      const { error } = await supabase2.from("maestra_vendedores").upsert(rows, { onConflict: "id_vendedor" });
      assertOk(error, "UPSERT maestra_vendedores");
    },
    async upsertClientes(rows) {
      const { error } = await supabase2.from("maestra_clientes").upsert(rows, { onConflict: "id_cliente" });
      assertOk(error, `UPSERT maestra_clientes (lote de ${rows.length})`);
    },
    async desactivarClientesNoVigentes(cargaId, ahoraIso) {
      const { error, count } = await supabase2.from("maestra_clientes").update({ activo: false, fecha_baja: ahoraIso, fecha_actualizacion: ahoraIso }, { count: "exact" }).eq("activo", true).or(noVigente(cargaId));
      assertOk(error, "Soft delete de clientes");
      return count ?? 0;
    },
    async desactivarVendedoresNoVigentes(cargaId, ahoraIso) {
      const { error, count } = await supabase2.from("maestra_vendedores").update({ activo: false, fecha_baja: ahoraIso, fecha_actualizacion: ahoraIso }, { count: "exact" }).eq("activo", true).or(noVigente(cargaId));
      assertOk(error, "Soft delete de vendedores");
      return count ?? 0;
    },
    async desactivarSupervisoresNoVigentes(cargaId, ahoraIso) {
      const { error, count } = await supabase2.from("maestra_supervisores").update({ activo: false, fecha_baja: ahoraIso, fecha_actualizacion: ahoraIso }, { count: "exact" }).eq("activo", true).or(noVigente(cargaId));
      assertOk(error, "Soft delete de supervisores");
      return count ?? 0;
    },
    async contarClientesActivosPorVendedor() {
      const filas = await leerTodo(
        supabase2,
        "maestra_clientes",
        "id_cliente,id_vendedor",
        "id_cliente",
        (q) => q.eq("activo", true)
      );
      const res = {};
      for (const f of filas) res[f.id_vendedor] = (res[f.id_vendedor] || 0) + 1;
      return res;
    },
    async cerrarCarga(id, estado, resumen, error) {
      const { error: e } = await supabase2.from("maestra_cargas").update({ estado, resumen, error: error ?? null, finalizado_en: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id);
      assertOk(e, "Cerrando registro de carga");
    }
  };
}
async function leerCarteraActivaMaestra(supabase2, idActivacionPorCodigo = /* @__PURE__ */ new Map()) {
  try {
    const clientes = await leerTodo(
      supabase2,
      "maestra_clientes",
      "id_cliente,razon_social,id_vendedor",
      "id_cliente",
      (q) => q.eq("activo", true)
    );
    if (clientes.length === 0) return [];
    const vendedores = await leerTodo(
      supabase2,
      "maestra_vendedores",
      "id_vendedor,nombre",
      "id_vendedor"
    );
    const nombrePorId = new Map(vendedores.map((v) => [v.id_vendedor, v.nombre]));
    return clientes.map((c) => {
      const codigo = String(c.id_cliente);
      const nombre = nombrePorId.get(c.id_vendedor) || String(c.id_vendedor);
      const idAct = idActivacionPorCodigo.get(codigo);
      return {
        ...idAct !== void 0 ? { id: idAct } : {},
        cliente_codigo: codigo,
        cliente_nombre: c.razon_social,
        vendedor_id: nombre,
        vendedor_nombre: nombre
      };
    });
  } catch {
    return [];
  }
}

// src/services/venezuelanReceiptAuditor.ts
var import_genai = require("@google/genai");
var MAX_COHERENT_MONTO_BS = 5e9;
var VENEZUELAN_RECEIPT_RESPONSE_SCHEMA = {
  type: import_genai.Type.OBJECT,
  properties: {
    es_legible: {
      type: import_genai.Type.BOOLEAN,
      description: "true siempre que se pueda leer al menos uno de los campos del comprobante; false solo si la imagen est\xE1 totalmente en negro o sin ning\xFAn texto ni n\xFAmero"
    },
    fecha_pago: {
      type: import_genai.Type.STRING,
      nullable: true,
      description: 'Fecha en formato DD/MM/AAAA o DD-MM-AAAA (ej. "23/10/2026") o YYYY-MM-DD'
    },
    referencia: {
      type: import_genai.Type.STRING,
      nullable: true,
      description: 'Secuencia num\xE9rica entera de 6 a 12 d\xEDgitos conservando ceros a la izquierda (ej. "000012723"). NUNCA confundir con el monto.'
    },
    montoRaw: {
      type: import_genai.Type.STRING,
      nullable: true,
      description: 'Texto original del monto tal como aparece en la imagen con punto de miles y coma decimal (ej. "48.742,49" o "1.250,00")'
    },
    montoNumerico: {
      type: import_genai.Type.NUMBER,
      nullable: true,
      description: "Valor num\xE9rico flotante est\xE1ndar con punto decimal y sin separador de miles (ej. 48742.49)"
    },
    monto_bs: {
      type: import_genai.Type.NUMBER,
      nullable: true,
      description: "Mismo valor num\xE9rico flotante est\xE1ndar en Bol\xEDvares (ej. 48742.49)"
    },
    banco: {
      type: import_genai.Type.STRING,
      nullable: true,
      description: 'Nombre del banco inferido por texto, plataforma o primeros 4 d\xEDgitos de la cuenta: "BBVA Provincial" (si dice Provinet o empieza por 0108), "Banesco" (0134), "Banco de Venezuela" (0102), "Mercantil" (0105), "Bancamiga" (0172), "BNC (Banco Nacional de Cr\xE9dito)" (0191), "Bancaribe" (0114), "Banplus" (0174), "Banco Bicentenario" (0175), "Banco del Tesoro" (0163)'
    },
    canal: {
      type: import_genai.Type.STRING,
      nullable: true,
      description: 'Nombre de la plataforma o canal visible (ej. "Provinet", "BanescOnline", "BDVenl\xEDnea", "TPago", "Pago M\xF3vil", "Transferencia")'
    },
    numero_cuenta: {
      type: import_genai.Type.STRING,
      nullable: true,
      description: 'Secuencia de 20 d\xEDgitos o cuenta enmascarada con asteriscos (ej. "0108*****40*****7396")'
    },
    texto_completo: {
      type: import_genai.Type.STRING,
      nullable: true,
      description: "Transcripci\xF3n literal de todas las l\xEDneas o valores visibles en la imagen separadas por espacios"
    },
    metodo_pago: {
      type: import_genai.Type.STRING,
      nullable: true,
      description: "Pago M\xF3vil, Transferencia, Zelle, Biopago, Divisas o Efectivo"
    },
    titular_remitente: { type: import_genai.Type.STRING, nullable: true },
    rif_ci_titular: { type: import_genai.Type.STRING, nullable: true },
    beneficiario_detectado: { type: import_genai.Type.STRING, nullable: true },
    codigo_autorizacion: { type: import_genai.Type.STRING, nullable: true }
  },
  required: [
    "es_legible",
    "fecha_pago",
    "referencia",
    "montoRaw",
    "montoNumerico",
    "monto_bs",
    "banco",
    "canal",
    "numero_cuenta"
  ]
};
var VENEZUELAN_BANKING_AUDIT_SYSTEM_PROMPT = `Eres un sistema experto en extracci\xF3n de datos de comprobantes bancarios de Venezuela (Pago M\xF3vil, Transferencias, Provinet, Banesco, Banco de Venezuela, Mercantil, etc.).

REGLAS CR\xCDTICAS DE EXTRACCI\xD3N (TOLERANCIA A RECORTES SIN ETIQUETAS):
1. COMPROBANTES SIN ETIQUETAS: Muchas im\xE1genes son recortes que muestran \xDANICAMENTE la columna de valores sin los t\xEDtulos ("Fecha", "Referencia", "Monto", "Cuenta", "Banco"). Debes deducir cada campo por el formato del texto:
   - FECHA: Patr\xF3n DD/MM/AAAA o DD-MM-AAAA (ej. "23/10/2026").
   - REFERENCIA / NRO OPERACI\xD3N: Secuencia num\xE9rica entera de 6 a 12 d\xEDgitos, a menudo con ceros a la izquierda (ej. "000012723"). NUNCA confundas la referencia con el monto.
   - MONTO (BS.): N\xFAmero con separador decimal (coma o punto) y dos decimales (ej. "48.742,49" o "1.250,00"). En Venezuela el punto (.) separa miles y la coma (,) separa c\xE9ntimos.
   - CUENTA / TEL\xC9FONO ENMASCARADO: Secuencia de 20 d\xEDgitos (o enmascarada con asteriscos como "0108*****40*****7396").

2. IDENTIFICACI\xD3N DEL BANCO (INFERENCIA OBLIGATORIA):
   Si el nombre del banco no aparece expl\xEDcito como "Banco...", infi\xE9relo por el nombre de la plataforma o por los primeros 4 d\xEDgitos del n\xFAmero de cuenta/origen:
   - Si dice "Provinet" o la cuenta empieza por "0108" -> Devuelve "BBVA Provincial"
   - Si dice "BanescoM\xF3vil" / "BanescOnline" o empieza por "0134" -> Devuelve "Banesco"
   - Si dice "BDVenl\xEDnea" / "BDV" o empieza por "0102" -> Devuelve "Banco de Venezuela"
   - Si dice "Mercantil" / "TPago" o empieza por "0105" -> Devuelve "Mercantil"
   - Si empieza por "0172" -> Devuelve "Bancamiga"
   - Si empieza por "0191" -> Devuelve "BNC (Banco Nacional de Cr\xE9dito)"
   - Si empieza por "0114" -> Devuelve "Bancaribe"
   - Si empieza por "0174" -> Devuelve "Banplus"
   - Si empieza por "0175" -> Devuelve "Banco Bicentenario"
   - Si empieza por "0163" -> Devuelve "Banco del Tesoro"

3. FORMATO DE SALIDA DEL MONTO:
   - Devuelve tanto el texto original (\`montoRaw\`: "48.742,49") como el valor num\xE9rico flotante est\xE1ndar con punto decimal y sin separador de miles (\`montoNumerico\`: 48742.49 y \`monto_bs\`: 48742.49).`;
var BENEFICIARY_NAME_PATTERNS = [
  /CODIZULCA/i,
  /COMERCIALIZADORA\s+ZULIANA/i,
  /DISTRIBUIDORA\s+CODIZULCA/i,
  /ZULIANA\s+DE\s+ALIMENTOS/i
];
var BENEFICIARY_RIF_DIGITS = ["409876136", "40987613"];
var VENEZUELAN_BANKS = [
  {
    canonical: "Banesco",
    codes: ["0134"],
    patterns: [/\bbanesco\b/i, /\bbanesconline\b/i, /\b0134\b/]
  },
  {
    canonical: "Banco de Venezuela",
    codes: ["0102"],
    patterns: [/banco\s+de\s+venezuela/i, /\bbdv\b/i, /bdvenl[ií]nea/i, /pagom[oó]vilbdv/i, /\b0102\b/]
  },
  {
    canonical: "Mercantil",
    codes: ["0105"],
    patterns: [/\bmercantil\b/i, /\btpago\b/i, /\b0105\b/]
  },
  {
    canonical: "BBVA Provincial",
    codes: ["0108"],
    patterns: [/\bprovincial\b/i, /\bbbva\b/i, /\bprovinet\b/i, /dinero\s+r[aá]pido/i, /\b0108\b/]
  },
  {
    canonical: "BNC (Banco Nacional de Cr\xE9dito)",
    codes: ["0191"],
    patterns: [/\bbnc\b/i, /nacional\s+de\s+cr[eé]dito/i, /\b0191\b/]
  },
  {
    canonical: "Bancamiga",
    codes: ["0172"],
    patterns: [/\bbancamiga\b/i, /\b0172\b/]
  },
  {
    canonical: "Bancaribe",
    codes: ["0114"],
    patterns: [/\bbancaribe\b/i, /\b0114\b/]
  },
  {
    canonical: "Banplus",
    codes: ["0174"],
    patterns: [/\bbanplus\b/i, /\b0174\b/]
  },
  {
    canonical: "Banco Exterior",
    codes: ["0115"],
    patterns: [/\bexterior\b/i, /\b0115\b/]
  },
  {
    canonical: "Banco Plaza",
    codes: ["0138"],
    patterns: [/banco\s+plaza/i, /tu\s+pago\s+plaza/i, /\bplaza\b/i, /\b0138\b/]
  },
  {
    canonical: "Banco Activo",
    codes: ["0171"],
    patterns: [/banco\s+activo/i, /\b0171\b/]
  },
  {
    canonical: "Sofitasa",
    codes: ["0137"],
    patterns: [/\bsofitasa\b/i, /\b0137\b/]
  },
  {
    canonical: "100% Banco",
    codes: ["0156"],
    patterns: [/100\s*%\s*banco/i, /\b0156\b/]
  },
  {
    canonical: "Mi Banco",
    codes: ["0169"],
    patterns: [/\bmi\s+banco\b/i, /\b0169\b/]
  },
  {
    canonical: "Banco del Tesoro",
    codes: ["0163"],
    patterns: [/banco\s+del\s+tesoro/i, /\btesoro\b/i, /\b0163\b/]
  },
  {
    canonical: "Banco Bicentenario",
    codes: ["0175"],
    patterns: [/\bbicentenario\b/i, /\b0175\b/]
  },
  {
    canonical: "BFC Banco Fondo Com\xFAn",
    codes: ["0151"],
    patterns: [/\bbfc\b/i, /fondo\s+com[uú]n/i, /\b0151\b/]
  },
  {
    canonical: "Banco Venezolano de Cr\xE9dito",
    codes: ["0104"],
    patterns: [/venezolano\s+de\s+cr[eé]dito/i, /\bbvc\b/i, /\b0104\b/]
  },
  {
    canonical: "Banco Caron\xED",
    codes: ["0128"],
    patterns: [/\bcaron[ií]\b/i, /\b0128\b/]
  },
  {
    canonical: "Banfanb",
    codes: ["0177"],
    patterns: [/\bbanfanb\b/i, /\b0177\b/]
  }
];
var SPANISH_MONTHS = {
  ene: "01",
  enero: "01",
  feb: "02",
  febrero: "02",
  mar: "03",
  marzo: "03",
  abr: "04",
  abril: "04",
  may: "05",
  mayo: "05",
  jun: "06",
  junio: "06",
  jul: "07",
  julio: "07",
  ago: "08",
  agosto: "08",
  sep: "09",
  sept: "09",
  septiembre: "09",
  setiembre: "09",
  oct: "10",
  octubre: "10",
  nov: "11",
  noviembre: "11",
  dic: "12",
  diciembre: "12"
};
function safeExtractReceiptJson(raw) {
  if (!raw || typeof raw !== "string") {
    throw new Error("Respuesta vac\xEDa del motor de auditor\xEDa bancaria.");
  }
  let text = raw.replace(/^\uFEFF/, "").trim();
  const mdBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (mdBlock && mdBlock[1]) {
    text = mdBlock[1].trim();
  } else if (text.includes("```")) {
    text = text.replace(/```[a-z]*\s*/gi, "").replace(/```/g, "").trim();
  }
  try {
    return JSON.parse(text);
  } catch {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const slice = text.substring(firstBrace, lastBrace + 1).replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(slice);
    }
    throw new Error("No se pudo decodificar el objeto JSON del comprobante.");
  }
}
function cleanNullableString(val) {
  if (val === null || val === void 0) return null;
  const s = String(val).trim();
  if (!s || /^(null|undefined|n\/a|na|ninguno|no\s+aplica|no\s+visible|desconocido|-+)$/i.test(s)) {
    return null;
  }
  return s;
}
function isBeneficiaryName(name) {
  if (!name) return false;
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return BENEFICIARY_NAME_PATTERNS.some((rx) => rx.test(normalized));
}
function isBeneficiaryRif(rif) {
  if (!rif) return false;
  const digits = String(rif).replace(/\D/g, "");
  if (!digits) return false;
  return BENEFICIARY_RIF_DIGITS.some((b) => digits.includes(b));
}
function detectReceiptMimeType(base64OrDataUrl, declaredMime, fileName) {
  if (typeof base64OrDataUrl === "string") {
    const trimmed = base64OrDataUrl.trim();
    const dataUrlMatch = trimmed.match(/^data:(image\/(?:jpeg|jpg|png|webp)|application\/pdf);base64,/i);
    if (dataUrlMatch) {
      const m = dataUrlMatch[1].toLowerCase();
      return m === "image/jpg" ? "image/jpeg" : m;
    }
    const pureB64 = (trimmed.includes(",") ? trimmed.split(",")[1] : trimmed).replace(/\s+/g, "");
    if (pureB64.startsWith("JVBERi0")) return "application/pdf";
    if (pureB64.startsWith("/9j/")) return "image/jpeg";
    if (pureB64.startsWith("iVBORw0KGgo")) return "image/png";
    if (pureB64.startsWith("UklGR")) return "image/webp";
  } else if (base64OrDataUrl && base64OrDataUrl.length >= 12) {
    const b = base64OrDataUrl;
    if (b[0] === 37 && b[1] === 80 && b[2] === 68 && b[3] === 70) return "application/pdf";
    if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
    if (b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71) return "image/png";
    if (b[0] === 82 && b[1] === 73 && b[2] === 70 && b[3] === 70 && b[8] === 87 && b[9] === 69 && b[10] === 66 && b[11] === 80) {
      return "image/webp";
    }
  }
  const rawMime = String(declaredMime || "").trim().toLowerCase();
  if (rawMime === "image/jpg" || rawMime === "image/jpeg") return "image/jpeg";
  if (rawMime === "image/png") return "image/png";
  if (rawMime === "image/webp") return "image/webp";
  if (rawMime === "application/pdf") return "application/pdf";
  const lowerName = String(fileName || "").trim().toLowerCase();
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".webp")) return "image/webp";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}
function parseMontoVenezolano(valor) {
  if (typeof valor === "number") {
    if (!Number.isNaN(valor) && Number.isFinite(valor) && valor > 0 && valor <= MAX_COHERENT_MONTO_BS) {
      return Number(valor.toFixed(2));
    }
    return 0;
  }
  const parsed = parseVenezuelanMonto(valor);
  return parsed !== null && !Number.isNaN(parsed) && Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
function parseVenezuelanMonto(val) {
  if (val === null || val === void 0 || val === "") return null;
  if (typeof val === "number") {
    if (Number.isNaN(val) || !Number.isFinite(val) || val <= 0) return null;
    if (val > MAX_COHERENT_MONTO_BS || Math.trunc(val).toString().length > 10) {
      return null;
    }
    return Number(val.toFixed(2));
  }
  let s = String(val).trim();
  if (!s) return null;
  const hasCurrencyHint = /\b(?:bs\.?|bol[ií]vares|ves|monto|total)\b/i.test(s);
  if (!hasCurrencyHint) {
    if (/^[VJEG]\s*[-.]?\s*\d{5,10}$/i.test(s)) return null;
    const onlyDigits = s.replace(/\D/g, "");
    if (/^04(12|14|16|24|26)\d{7}$/.test(onlyDigits) || /^584(12|14|16|24|26)\d{7}$/.test(onlyDigits) || onlyDigits.length === 20 && onlyDigits.startsWith("01")) {
      return null;
    }
  }
  s = s.replace(/\b(?:bol[ií]vares|bs\.?\s*s?\.?|ves|veb)\b/gi, " ").replace(/\$/g, " ").replace(/(\d)\s*([.,])\s*(\d)/g, "$1$2$3").replace(/\b(\d{1,3}(?:[\s.]\d{3})+)\s+(\d{2})\b/g, (_m, intP, decP) => `${String(intP).replace(/\s+/g, ".")},${decP}`).replace(/\b(\d{1,3})\s+(\d{3})([.,]\d{2})\b/g, "$1.$2$3").trim();
  const moneyMatch = s.match(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!moneyMatch) return null;
  s = moneyMatch[1];
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  let parsed = NaN;
  if (hasDot && hasComma) {
    if (/,\d{1,2}$/.test(s) || s.lastIndexOf(",") > s.lastIndexOf(".")) {
      parsed = parseFloat(s.replace(/\./g, "").replace(",", "."));
    } else {
      parsed = parseFloat(s.replace(/,/g, ""));
    }
  } else if (hasComma) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      parsed = parseFloat(s.replace(",", "."));
    } else if (parts.length > 2 && parts[parts.length - 1].length <= 2) {
      const decimals = parts.pop();
      parsed = parseFloat(`${parts.join("")}.${decimals}`);
    } else {
      parsed = parseFloat(s.replace(/,/g, ""));
    }
  } else if (hasDot) {
    const parts = s.split(".");
    if (parts.length === 2 && parts[1].length <= 2) {
      parsed = parseFloat(s);
    } else if (parts.length > 2 && parts[parts.length - 1].length <= 2) {
      const decimals = parts.pop();
      parsed = parseFloat(`${parts.join("")}.${decimals}`);
    } else {
      parsed = parseFloat(s.replace(/\./g, ""));
    }
  } else {
    parsed = parseFloat(s);
  }
  if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed <= 0) return null;
  if (parsed > MAX_COHERENT_MONTO_BS || Math.trunc(parsed).toString().length > 10) {
    return null;
  }
  return Number(parsed.toFixed(2));
}
function normalizeReferenciaBancaria(val) {
  const clean = cleanNullableString(val);
  if (!clean) return null;
  if (/[*•]/.test(clean) || /\b01\d{2}[*xX•\d-]{10,20}\b/.test(clean)) {
    return null;
  }
  let sanitized = clean.replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/[\u{1F4CB}\u{1F50D}\u{1F50E}\u{2398}\u{274F}\u{2750}\u{1F517}]/gu, " ").trim();
  sanitized = sanitized.replace(/^(\D*\d{6,14})\s+[0O8Qo]\s*$/, "$1");
  const digits = sanitized.replace(/\D/g, "");
  if (!digits || digits.length < 4) return null;
  if (/^04(12|14|16|24|26)\d{7}$/.test(digits) || /^584(12|14|16|24|26)\d{7}$/.test(digits)) {
    return null;
  }
  if (digits.length === 20 && digits.startsWith("01")) {
    return null;
  }
  return digits;
}
function matchCatalogVenezuelanBank(val) {
  const clean = cleanNullableString(val);
  if (!clean) return null;
  for (const bank of VENEZUELAN_BANKS) {
    if (bank.patterns.some((rx) => rx.test(clean)) || bank.codes.some((code) => new RegExp(`(?:^|\\b)${code}(?:\\b|\\*|\\d)`).test(clean))) {
      return bank.canonical;
    }
  }
  if (/\bzelle\b/i.test(clean)) return "Zelle";
  if (/bank\s+of\s+america|\bbofa\b/i.test(clean)) return "Bank of America";
  if (/wells\s+fargo/i.test(clean)) return "Wells Fargo";
  if (/\bchase\b/i.test(clean)) return "Chase";
  return null;
}
function extractNumeroCuentaVenezolana(val, contextText) {
  const clean = cleanNullableString(val);
  if (!clean) return null;
  const fullContext = `${clean} ${contextText || ""}`;
  const moireMaskMatch = clean.match(
    /\b(01\d{2})\s*([*•xX#.\-:"'+~_=]{3,8})\s*(\d{2,4})\s*([*•xX#.\-:"'+~_=]{3,8})\s*(\d{4})\b/
  );
  if (moireMaskMatch) {
    let prefix = moireMaskMatch[1];
    const midDigits = moireMaskMatch[3];
    const endDigits = moireMaskMatch[5];
    const isProvinetCtx = /provinet|provmet|provlnet|provinel|provincial|bbva/i.test(fullContext);
    if (prefix === "0103" || prefix === "0100" || prefix === "0106" || isProvinetCtx && /^010\d$/.test(prefix)) {
      prefix = "0108";
    }
    return `${prefix}*****${midDigits}*****${endDigits}`;
  }
  const compactMasks = clean.replace(
    /\b(01(?:02|04|05|08|14|15|28|34|37|38|51|56|63|68|69|71|72|74|75|77|91))((?:[\s]*[*•xX#.\d-]){8,24})/g,
    (_full, prefix, rest) => `${prefix}${String(rest).replace(/\s+/g, "")}`
  );
  const match = compactMasks.match(
    /\b(01(?:02|04|05|08|14|15|28|34|37|38|51|56|63|68|69|71|72|74|75|77|91)[*•xX#.\d-]{8,22})\b/
  );
  if (!match) return null;
  const candidate = match[1].trim();
  const digitsAndMasks = candidate.replace(/-/g, "");
  if (digitsAndMasks.length < 10 || digitsAndMasks.length > 24) {
    return null;
  }
  return candidate;
}
function inferirBancoVenezolano(bancoExtraido, textoCompleto, cuenta) {
  const cleanExtraido = cleanNullableString(bancoExtraido);
  const cleanTexto = cleanNullableString(textoCompleto) || "";
  const cleanCuenta = cleanNullableString(cuenta) || "";
  const combined = [cleanExtraido || "", cleanCuenta, cleanTexto].filter(Boolean).join(" ");
  if (!combined) return "";
  const hasCode = (code) => new RegExp(`(?:^|\\b|[^0-9])${code}(?:[*\u2022xX#.:\\-"'+~_=]|\\d|\\b)`).test(cleanCuenta) || new RegExp(`(?:^|\\b)${code}(?:[*\u2022xX#.:\\-"'+~_=]|\\d{2,}|\\b)`).test(combined);
  if (/\bprovinet\b|\bprovmet\b|\bprovlnet\b|\bprovinel\b|\bprovincial\b|\bbbva\b|dinero\s+r[aá]pido/i.test(combined) || hasCode("0108")) {
    return "BBVA Provincial";
  }
  if (/\bbanescom[oó]vil\b|\bbanesconline\b|\bbanesco\b/i.test(combined) || hasCode("0134")) {
    return "Banesco";
  }
  if (/\bbdvenl[ií]nea\b|\npagom[oó]vilbdv\b|\bbdv\b|banco\s+de\s+venezuela/i.test(combined) || hasCode("0102")) {
    return "Banco de Venezuela";
  }
  if (/\bmercantil\b|\btpago\b/i.test(combined) || hasCode("0105")) {
    return "Mercantil";
  }
  if (/\bbancamiga\b/i.test(combined) || hasCode("0172")) {
    return "Bancamiga";
  }
  if (/\bbnc\b|nacional\s+de\s+cr[eé]dito/i.test(combined) || hasCode("0191")) {
    return "BNC (Banco Nacional de Cr\xE9dito)";
  }
  if (/\bbancaribe\b/i.test(combined) || hasCode("0114")) {
    return "Bancaribe";
  }
  if (/\bbanplus\b/i.test(combined) || hasCode("0174")) {
    return "Banplus";
  }
  if (/\bbicentenario\b/i.test(combined) || hasCode("0175")) {
    return "Banco Bicentenario";
  }
  if (/banco\s+del\s+tesoro|\btesoro\b/i.test(combined) || hasCode("0163")) {
    return "Banco del Tesoro";
  }
  for (const bank of VENEZUELAN_BANKS) {
    if (bank.patterns.some((rx) => rx.test(combined)) || bank.codes.some((code) => hasCode(code))) {
      return bank.canonical;
    }
  }
  if (cleanExtraido && !/^(origen|destino|emisor|receptor|beneficiario|banco|cuenta|null|n\/a)$/i.test(cleanExtraido)) {
    return cleanExtraido;
  }
  return "";
}
function extractMontoTextoExacto(val) {
  const clean = cleanNullableString(val);
  if (!clean) return null;
  const normalized = clean.replace(/(\d)\s*([.,])\s*(\d)/g, "$1$2$3");
  const m = normalized.match(/(\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d+,\d{2}|\d+\.\d{2})/);
  return m ? m[1] : null;
}
function resolveVenezuelanBankDetails(bankInput, accountInput, platformInput, contextText) {
  const cleanBank = cleanNullableString(bankInput);
  const rawArg2 = cleanNullableString(accountInput);
  const rawArg3 = cleanNullableString(platformInput);
  const arg2LooksLikeAccOrCode = Boolean(extractNumeroCuentaVenezolana(rawArg2)) || Boolean(rawArg2 && /^01\d{2}$/.test(rawArg2));
  const arg3LooksLikeAccOrCode = Boolean(extractNumeroCuentaVenezolana(rawArg3)) || Boolean(rawArg3 && /^01\d{2}$/.test(rawArg3));
  const cleanAcc = arg2LooksLikeAccOrCode ? extractNumeroCuentaVenezolana(rawArg2) || rawArg2 : arg3LooksLikeAccOrCode ? extractNumeroCuentaVenezolana(rawArg3) || rawArg3 : null;
  const cleanPlat = !arg2LooksLikeAccOrCode && rawArg2 ? rawArg2 : !arg3LooksLikeAccOrCode && rawArg3 ? rawArg3 : null;
  const combined = [cleanBank, cleanAcc, cleanPlat, contextText || ""].filter(Boolean).join(" ");
  let codigoBanco = null;
  const codeFromAcc = cleanAcc?.match(/^(01\d{2})/);
  if (codeFromAcc) {
    codigoBanco = codeFromAcc[1];
  }
  let matchedEntry = null;
  for (const entry of VENEZUELAN_BANKS) {
    if (codigoBanco && entry.codes.includes(codigoBanco)) {
      matchedEntry = entry;
      break;
    }
    if (cleanBank && (entry.patterns.some((rx) => rx.test(cleanBank)) || entry.codes.some((c) => new RegExp(`(?:^|\\b)${c}(?:\\b|\\*|\\d)`).test(cleanBank))) || cleanPlat && entry.patterns.some((rx) => rx.test(cleanPlat)) || cleanAcc && entry.codes.some((c) => new RegExp(`(?:^|\\b)${c}(?:\\b|\\*|\\d)`).test(cleanAcc))) {
      matchedEntry = entry;
      codigoBanco = codigoBanco || entry.codes[0] || null;
      break;
    }
  }
  let legacyBanco = normalizeVenezuelanBank(cleanBank) || (matchedEntry ? matchedEntry.canonical : null);
  let bancoIdentificado = legacyBanco;
  if (matchedEntry?.codes.includes("0105") || /\bmercantil\b/i.test(combined)) {
    bancoIdentificado = "Banco Mercantil";
    codigoBanco = codigoBanco || "0105";
    if (!legacyBanco) legacyBanco = "Mercantil";
  } else if (matchedEntry) {
    bancoIdentificado = matchedEntry.canonical;
    codigoBanco = codigoBanco || matchedEntry.codes[0] || null;
  }
  let plataformaCanal = cleanPlat;
  if (!plataformaCanal && combined) {
    if (/\bprovinet\b/i.test(combined) || codigoBanco === "0108") plataformaCanal = "Provinet";
    else if (/\bbanesconline\b/i.test(combined)) plataformaCanal = "BanescOnline";
    else if (/mercantil\s+en\s+l[ií]nea/i.test(combined)) plataformaCanal = "Mercantil en L\xEDnea";
    else if (/bdvenl[ií]nea/i.test(combined)) plataformaCanal = "BDVenl\xEDnea";
    else if (/pagom[oó]vilbdv/i.test(combined)) plataformaCanal = "PagoM\xF3vilBDV";
    else if (/\btpago\b/i.test(combined)) plataformaCanal = "Tpago";
    else if (/dinero\s+r[aá]pido/i.test(combined)) plataformaCanal = "Dinero R\xE1pido";
    else if (/pago\s*m[oó]vil/i.test(combined)) plataformaCanal = "Pago M\xF3vil";
    else if (/\btransferencia\b/i.test(combined)) plataformaCanal = "Transferencia";
  }
  if (/\bprovinet\b/i.test(combined) || codigoBanco === "0108") {
    bancoIdentificado = "BBVA Provincial";
    legacyBanco = "BBVA Provincial";
    codigoBanco = "0108";
    if (!plataformaCanal) plataformaCanal = "Provinet";
  }
  return {
    banco_identificado: bancoIdentificado,
    codigo_banco: codigoBanco,
    plataforma_canal: plataformaCanal,
    legacy_banco: legacyBanco
  };
}
function normalizeVenezuelanBank(val) {
  const clean = cleanNullableString(val);
  if (!clean) return null;
  if (/banco\s+mercantil|mercantil\s+en\s+l[ií]nea/i.test(clean)) {
    return "Banco Mercantil";
  }
  const catalogMatch = matchCatalogVenezuelanBank(clean);
  if (catalogMatch) return catalogMatch;
  if (/^(origen|destino|emisor|receptor|beneficiario|banco|cuenta)$/i.test(clean)) {
    return null;
  }
  return clean;
}
function normalizeMetodoPago(val, contextHint) {
  const combined = `${cleanNullableString(val) || ""} ${contextHint || ""}`.trim();
  const s = combined.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const raw = (cleanNullableString(val) || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\bbiopago\b/.test(raw) || /\bbiopago\b/.test(s) && !raw) return "Biopago";
  if (/\bzelle\b/.test(raw) || /\bzelle\b/.test(s) && !raw) return "Zelle";
  if (/\bdivisas?\s+efectivo\b/.test(raw)) return "Divisas Efectivo";
  if (/\befectivo\b/.test(raw)) return "Efectivo";
  if (/\bdivisas?\b|\busd\b|\bdolares?\b/.test(raw)) return "Divisas";
  if (/su\s+pago\s+movil\s+ha\s+sido\s+ejecutado\s+exitosamente|pago\s*movil|\bp2p\b|\bp2c\b|\bc2p\b|\btpago\b|dinero\s*rapido|interbancario\s*movil/.test(
    raw
  )) {
    return "Pago M\xF3vil";
  }
  if (/transferencia/.test(raw)) {
    return "Transferencia";
  }
  if (/\bbiopago\b/.test(s)) return "Biopago";
  if (/\bzelle\b/.test(s)) return "Zelle";
  if (/su\s+pago\s+movil\s+ha\s+sido\s+ejecutado\s+exitosamente|pago\s*movil|\bp2p\b|\bp2c\b|\bc2p\b|\btpago\b|dinero\s*rapido|\b04(12|14|16|24|26)[-\s]?\d{7}\b/.test(
    s
  )) {
    return "Pago M\xF3vil";
  }
  if (/\b01\d{2}[*\d\s-]{12,22}\b|transferencia|cuenta\s+destino|cuenta\s+origen/.test(s)) {
    return "Transferencia";
  }
  return "Pago M\xF3vil";
}
function normalizeConfianzaLectura(rawConfianzaLectura, numericConfianza, legible, isCompleteCore) {
  const clean = cleanNullableString(rawConfianzaLectura)?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (clean === "alta" || clean === "alto") return "alta";
  if (clean === "media" || clean === "medio") return "media";
  if (clean === "baja" || clean === "bajo") return "baja";
  if (!legible || numericConfianza < 0.5) return "baja";
  if (isCompleteCore && numericConfianza >= 0.85) return "alta";
  return "media";
}
function toNivelConfianzaSoporte(confianzaLectura, rawNivel) {
  const clean = cleanNullableString(rawNivel)?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (clean === "ALTO" || clean === "ALTA") return "ALTO";
  if (clean === "MEDIO" || clean === "MEDIA") return "MEDIO";
  if (clean === "BAJO" || clean === "BAJA") return "BAJO";
  if (confianzaLectura === "alta") return "ALTO";
  if (confianzaLectura === "media") return "MEDIO";
  return "BAJO";
}
function normalizeReceiptDates(fechaPagoRaw, fechaIsoRaw) {
  const candidates = [cleanNullableString(fechaPagoRaw), cleanNullableString(fechaIsoRaw)].filter(
    (x) => Boolean(x)
  );
  for (const cand of candidates) {
    const dmy = cand.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2}|\d{2})\b/);
    if (dmy) {
      let day = parseInt(dmy[1], 10);
      let month = parseInt(dmy[2], 10);
      let year = parseInt(dmy[3], 10);
      if (year < 100) year += 2e3;
      if (month > 12 && day <= 12) {
        const tmp = day;
        day = month;
        month = tmp;
      }
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2e3 && year <= 2100) {
        const dd = String(day).padStart(2, "0");
        const mm = String(month).padStart(2, "0");
        const yyyy = String(year);
        return {
          fecha_pago: `${dd}/${mm}/${yyyy}`,
          fecha_iso: `${yyyy}-${mm}-${dd}`
        };
      }
    }
    const ymd = cand.match(/\b(20\d{2})[/-](\d{1,2})[/-](\d{1,2})\b/);
    if (ymd) {
      const year = parseInt(ymd[1], 10);
      const month = parseInt(ymd[2], 10);
      const day = parseInt(ymd[3], 10);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        const dd = String(day).padStart(2, "0");
        const mm = String(month).padStart(2, "0");
        const yyyy = String(year);
        return {
          fecha_pago: `${dd}/${mm}/${yyyy}`,
          fecha_iso: `${yyyy}-${mm}-${dd}`
        };
      }
    }
    const txt = cand.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const textDate = txt.match(/\b(\d{1,2})\s*(?:de\s*)?([a-z]{3,10})\.?\s*(?:de\s*|del\s*|,\s*)?(20\d{2})?\b/);
    if (textDate && SPANISH_MONTHS[textDate[2]]) {
      const day = parseInt(textDate[1], 10);
      const mm = SPANISH_MONTHS[textDate[2]];
      const yyyy = textDate[3] || String((/* @__PURE__ */ new Date()).getFullYear());
      if (day >= 1 && day <= 31) {
        const dd = String(day).padStart(2, "0");
        return {
          fecha_pago: `${dd}/${mm}/${yyyy}`,
          fecha_iso: `${yyyy}-${mm}-${dd}`
        };
      }
    }
  }
  return { fecha_pago: null, fecha_iso: null };
}
function normalizeRifCiTitular(val) {
  const clean = cleanNullableString(val);
  if (!clean) return null;
  const compact = clean.toUpperCase().replace(/[^VJEG0-9]/g, "");
  const match = compact.match(/^([VJEG])0*(\d{5,10})$/);
  if (!match) {
    const matchRaw = compact.match(/^([VJEG])(\d{6,10})$/);
    if (!matchRaw) return null;
    const formattedRaw = `${matchRaw[1]}-${matchRaw[2]}`;
    return isBeneficiaryRif(formattedRaw) ? null : formattedRaw;
  }
  const letter = match[1];
  const digits = match[2];
  const formatted = `${letter}-${digits}`;
  if (isBeneficiaryRif(formatted)) {
    return null;
  }
  return formatted;
}
function auditAndNormalizeReceiptPayload(rawInput) {
  const raw = rawInput && typeof rawInput === "object" ? rawInput : {};
  const datosSub = raw.datos_extraidos && typeof raw.datos_extraidos === "object" ? raw.datos_extraidos : {};
  const evidenciaSub = raw.evidencia_visual && typeof raw.evidencia_visual === "object" ? raw.evidencia_visual : {};
  let beneficiario = cleanNullableString(
    raw.beneficiario_detectado ?? raw.beneficiario ?? raw.destinatario ?? datosSub.beneficiario
  );
  let titular = cleanNullableString(
    raw.titular_remitente ?? raw.titular ?? raw.remitente ?? raw.ordenante ?? raw.emisor ?? datosSub.titular
  );
  let rif = normalizeRifCiTitular(
    raw.rif_ci_titular ?? raw.rif_ci ?? raw.rif ?? raw.cedula ?? raw.documento_emisor ?? datosSub.rif
  );
  if (titular && isBeneficiaryName(titular)) {
    if (!beneficiario) {
      beneficiario = titular;
    }
    titular = null;
    rif = null;
  }
  if (titular && beneficiario && titular.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() === beneficiario.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()) {
    titular = null;
    rif = null;
  }
  if (rif && isBeneficiaryRif(rif)) {
    rif = null;
  }
  const rawMontoTextoInput = cleanNullableString(
    raw.montoRaw ?? datosSub.montoRaw ?? datosSub.monto_texto ?? raw.monto_texto ?? raw.monto_texto_original ?? raw.monto_bs_formateado
  );
  const rawMontoNumInput = raw.montoNumerico ?? datosSub.montoNumerico ?? datosSub.monto_numerico ?? raw.monto_numerico ?? raw.monto_bs ?? raw.monto;
  const parsedFromTexto = parseVenezuelanMonto(rawMontoTextoInput);
  const parsedFromNum = parseVenezuelanMonto(rawMontoNumInput);
  let montoBs = null;
  if (parsedFromTexto !== null && parsedFromNum !== null) {
    if (parsedFromTexto > parsedFromNum && Math.abs(parsedFromTexto / parsedFromNum - 1e3) < 15) {
      montoBs = parsedFromTexto;
    } else {
      montoBs = parsedFromNum;
    }
  } else {
    montoBs = parsedFromTexto ?? parsedFromNum ?? null;
  }
  const codigoAutorizacion = normalizeReferenciaBancaria(
    raw.codigo_autorizacion ?? raw.codigoAutorizacion ?? datosSub.codigo_autorizacion
  );
  const primaryReferencia = normalizeReferenciaBancaria(
    datosSub.numero_referencia ?? raw.numero_referencia ?? raw.referencia ?? raw.nro_referencia
  );
  const nroReferencia = primaryReferencia ?? codigoAutorizacion ?? null;
  const rawCuentaInput = datosSub.numero_cuenta ?? datosSub.cuenta_origen_o_destino ?? raw.numero_cuenta ?? raw.cuenta ?? raw.cuenta_origen_o_destino ?? raw.cuenta_enmascarada ?? raw.cuenta_origen ?? raw.cuenta_destino;
  const rawLineasCrudas = Array.isArray(evidenciaSub.lineas_crudas_detectadas) ? evidenciaSub.lineas_crudas_detectadas.map((l) => String(l ?? "").trim()).filter(Boolean) : Array.isArray(raw.lineas_crudas_detectadas) ? raw.lineas_crudas_detectadas.map((l) => String(l ?? "").trim()).filter(Boolean) : [];
  const rawTextoCompleto = cleanNullableString(
    raw.texto_completo ?? raw.textoCompleto ?? datosSub.texto_completo
  );
  const fullContextString = [
    rawTextoCompleto || "",
    rawLineasCrudas.join(" "),
    cleanNullableString(raw.canal) || "",
    cleanNullableString(raw.plataforma_canal) || "",
    cleanNullableString(datosSub.plataforma_canal) || "",
    cleanNullableString(rawCuentaInput) || ""
  ].filter(Boolean).join(" ");
  const numeroCuenta = extractNumeroCuentaVenezolana(rawCuentaInput, fullContextString) ?? extractNumeroCuentaVenezolana(fullContextString, fullContextString) ?? cleanNullableString(rawCuentaInput);
  if (montoBs === null && fullContextString) {
    const normalizedCtx = fullContextString.replace(/(\d)\s*([.,])\s*(\d)/g, "$1$2$3").replace(/\b(\d{1,3}(?:[\s.]\d{3})+)\s+(\d{2})\b/g, (_m, intP, decP) => `${String(intP).replace(/\s+/g, ".")},${decP}`).replace(/\b(\d{1,3})\s+(\d{3})([.,]\d{2})\b/g, "$1.$2$3");
    const fallbackMoneyMatch = normalizedCtx.match(
      /\b(\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d{2,10},\d{2})\b/
    );
    if (fallbackMoneyMatch) {
      montoBs = parseVenezuelanMonto(fallbackMoneyMatch[1]);
    }
  }
  const exactMontoTexto = montoBs !== null ? extractMontoTextoExacto(rawMontoTextoInput) ?? extractMontoTextoExacto(typeof rawMontoNumInput === "string" ? rawMontoNumInput : null) ?? new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(montoBs) : null;
  const rawCanalInput = cleanNullableString(
    datosSub.plataforma_canal ?? raw.plataforma_canal ?? raw.canal ?? datosSub.canal
  );
  const bankDetails = resolveVenezuelanBankDetails(
    datosSub.banco_identificado ?? raw.banco_identificado ?? raw.banco ?? raw.banco_origen ?? raw.banco_destino,
    numeroCuenta || datosSub.codigo_banco || raw.codigo_banco,
    rawCanalInput ?? raw.metodo_pago,
    fullContextString
  );
  const inferredBank = inferirBancoVenezolano(
    cleanNullableString(
      datosSub.banco_identificado ?? raw.banco_identificado ?? raw.banco ?? raw.banco_origen ?? raw.banco_destino
    ),
    fullContextString,
    numeroCuenta
  );
  const bancoOrigen = normalizeVenezuelanBank(raw.banco_origen);
  const bancoDestino = normalizeVenezuelanBank(raw.banco_destino);
  const bancoPrincipal = inferredBank || normalizeVenezuelanBank(raw.banco) || bancoOrigen || bancoDestino || bankDetails.legacy_banco || bankDetails.banco_identificado || null;
  const rawObservacion = cleanNullableString(
    raw.observacion_auditoria ?? raw.observacion_ia ?? raw.motivo_revision
  );
  const metodoPago = normalizeMetodoPago(
    raw.metodo_pago ?? bankDetails.plataforma_canal,
    `${bancoPrincipal || ""} ${numeroCuenta || ""} ${rawMontoTextoInput || ""} ${rawObservacion || ""} ${rawLineasCrudas.join(" ")}`
  );
  const { fecha_pago, fecha_iso } = normalizeReceiptDates(
    datosSub.fecha_original ?? raw.fecha_original ?? raw.fecha_pago,
    datosSub.fecha_operacion ?? raw.fecha_operacion ?? raw.fecha_iso
  );
  const rawMonedaInput = cleanNullableString(datosSub.moneda ?? raw.moneda)?.toUpperCase();
  const monedaDetectada = rawMonedaInput === "USD" || metodoPago === "Zelle" || metodoPago === "Divisas" || metodoPago === "Divisas Efectivo" ? "USD" : rawMonedaInput === "VES" || rawMonedaInput === "BS" || montoBs !== null || Boolean(bankDetails.codigo_banco) ? "VES" : null;
  const isSpecificPlatformCanal = Boolean(
    bankDetails.plataforma_canal && !/^(pago\s*m[oó]vil|transferencia|efectivo|divisas|divisas\s+efectivo|zelle|biopago)$/i.test(
      bankDetails.plataforma_canal.trim()
    )
  );
  const hasCoreOrPartialData = Boolean(
    montoBs && montoBs > 0 || nroReferencia || fecha_iso || fecha_pago || bancoPrincipal || isSpecificPlatformCanal || numeroCuenta || titular
  );
  const legible = hasCoreOrPartialData;
  const isCompleteCore = Boolean(montoBs && montoBs > 0 && nroReferencia);
  let confianza = Number(raw.confianza);
  if (!Number.isFinite(confianza) || confianza < 0 || confianza > 1) {
    const rawLevel = cleanNullableString(raw.confianza_lectura ?? raw.nivel_confianza)?.toLowerCase();
    if (rawLevel === "alta" || rawLevel === "alto") {
      confianza = 0.96;
    } else if (rawLevel === "media" || rawLevel === "medio") {
      confianza = 0.78;
    } else if (rawLevel === "baja" || rawLevel === "bajo") {
      confianza = 0.25;
    } else {
      confianza = legible ? isCompleteCore && (fecha_pago || bancoPrincipal) ? 0.96 : 0.78 : 0.2;
    }
  } else {
    confianza = Number(confianza.toFixed(2));
  }
  const confianzaLectura = normalizeConfianzaLectura(
    raw.confianza_lectura ?? raw.nivel_confianza,
    confianza,
    legible,
    isCompleteCore
  );
  const nivelConfianza = toNivelConfianzaSoporte(confianzaLectura, raw.nivel_confianza);
  const tieneEtiquetasVisibles = typeof evidenciaSub.tiene_etiquetas_visibles === "boolean" ? evidenciaSub.tiene_etiquetas_visibles : typeof raw.tiene_etiquetas_visibles === "boolean" ? raw.tiene_etiquetas_visibles : rawLineasCrudas.length > 0 ? rawLineasCrudas.some(
    (l) => /\b(fecha|referencia|operaci[oó]n|monto|importe|total|banco|beneficiario|remitente|ordenante|cuenta)\b/i.test(l)
  ) : true;
  const esFotoDePantalla = typeof evidenciaSub.es_foto_de_pantalla === "boolean" ? evidenciaSub.es_foto_de_pantalla : typeof raw.es_foto_de_pantalla === "boolean" ? raw.es_foto_de_pantalla : false;
  const requiereRevisionManual = typeof raw.requiere_revision_manual === "boolean" ? raw.requiere_revision_manual : !legible || !isCompleteCore || nivelConfianza === "BAJO";
  const motivoRevision = requiereRevisionManual ? cleanNullableString(raw.motivo_revision) || (!legible ? "No se lograron identificar con claridad el monto o la referencia del comprobante." : !montoBs ? "Monto de la operaci\xF3n no visible o ilegible en el soporte." : !nroReferencia ? "N\xFAmero de referencia no visible o ilegible en el soporte." : "Soporte con lectura parcial o sin etiquetas completas; verificar datos antes de conciliar.") : cleanNullableString(raw.motivo_revision);
  const observacion = rawObservacion || (legible ? isCompleteCore ? "Comprobante de operaci\xF3n exitosa le\xEDdo correctamente." : "Lectura parcial completada; se autocompletaron los datos detectados en el comprobante." : "No se lograron identificar con claridad el monto o la referencia del comprobante.");
  const rawResolvedCanal = rawCanalInput ?? bankDetails.plataforma_canal ?? null;
  const resolvedCanal = !legible && rawResolvedCanal && /^(pago\s*m[oó]vil|transferencia)$/i.test(rawResolvedCanal.trim()) ? null : rawResolvedCanal;
  const datosExtraidos = {
    fecha_operacion: fecha_iso,
    fecha_original: fecha_pago,
    numero_referencia: nroReferencia,
    monto_numerico: montoBs,
    monto_texto: exactMontoTexto,
    moneda: monedaDetectada,
    banco_identificado: bankDetails.banco_identificado || (bancoPrincipal === "Mercantil" ? "Banco Mercantil" : bancoPrincipal),
    codigo_banco: cleanNullableString(datosSub.codigo_banco ?? raw.codigo_banco) ?? bankDetails.codigo_banco,
    plataforma_canal: resolvedCanal,
    numero_cuenta: numeroCuenta
  };
  const evidenciaVisual = {
    tiene_etiquetas_visibles: tieneEtiquetasVisibles,
    es_foto_de_pantalla: esFotoDePantalla,
    lineas_crudas_detectadas: rawLineasCrudas
  };
  return {
    es_legible: legible,
    lectura_exitosa: legible,
    nivel_confianza: nivelConfianza,
    requiere_revision_manual: requiereRevisionManual,
    motivo_revision: motivoRevision,
    datos_extraidos: datosExtraidos,
    evidencia_visual: evidenciaVisual,
    legible,
    confianza,
    confianza_lectura: confianzaLectura,
    metodo_pago: metodoPago,
    banco: bancoPrincipal,
    canal: resolvedCanal,
    banco_origen: bancoOrigen,
    banco_destino: bancoDestino,
    monto_bs: montoBs,
    montoRaw: exactMontoTexto,
    montoNumerico: montoBs,
    monto_texto_original: rawMontoTextoInput || (montoBs !== null ? `Bs. ${new Intl.NumberFormat("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(montoBs)}` : null),
    referencia: nroReferencia,
    nro_referencia: nroReferencia,
    codigo_autorizacion: codigoAutorizacion,
    fecha_pago,
    fecha_iso,
    numero_cuenta: numeroCuenta,
    texto_completo: fullContextString || null,
    titular_remitente: titular,
    rif_ci_titular: rif,
    beneficiario_detectado: beneficiario,
    observacion_auditoria: observacion,
    observacion_ia: observacion
  };
}
function parseVenezuelanReceiptText(rawText) {
  const text = String(rawText || "").replace(/\r/g, "\n");
  const lines = text.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 0);
  const fullText = lines.join("\n");
  let numeroCuentaDetectada = null;
  for (const line of lines) {
    const acc = extractNumeroCuentaVenezolana(line, fullText);
    if (acc) {
      numeroCuentaDetectada = acc;
      break;
    }
  }
  const tieneEtiquetasVisibles = lines.some(
    (l) => /\b(fecha|referencia|operaci[oó]n|monto|importe|total|banco|beneficiario|remitente|ordenante|cuenta)\b/i.test(l)
  );
  let bancoOrigen = null;
  let bancoDestino = null;
  let bancoGeneral = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || "";
    if (/(banco\s*(de\s*)?origen|banco\s*emisor|desde\s*banco|cuenta\s*origen)/i.test(line)) {
      const rest = line.replace(
        /^.*?(?:banco\s*(?:de\s*)?origen|banco\s*emisor|desde\s*banco|cuenta\s*origen)\s*[:.-]?\s*/i,
        ""
      );
      bancoOrigen = matchCatalogVenezuelanBank(rest) || matchCatalogVenezuelanBank(nextLine) || bancoOrigen;
    } else if (/(banco\s*(de\s*)?destino|banco\s*receptor|banco\s*beneficiario|hacia\s*banco)/i.test(line)) {
      const rest = line.replace(
        /^.*?(?:banco\s*(?:de\s*)?destino|banco\s*receptor|banco\s*beneficiario|hacia\s*banco)\s*[:.-]?\s*/i,
        ""
      );
      bancoDestino = matchCatalogVenezuelanBank(rest) || matchCatalogVenezuelanBank(nextLine) || bancoDestino;
    } else if (/^banco\s*[:.-]?$/i.test(line) && nextLine) {
      const b = matchCatalogVenezuelanBank(nextLine);
      if (b && !bancoDestino) bancoDestino = b;
    }
    if (!bancoGeneral) {
      const matched = matchCatalogVenezuelanBank(line);
      if (matched) {
        bancoGeneral = matched;
      }
    }
  }
  if (!bancoDestino && bancoGeneral && !bancoOrigen) {
    bancoDestino = bancoGeneral;
  }
  const banco = bancoOrigen || bancoGeneral || bancoDestino || null;
  let montoBs = null;
  let montoTextoOriginal = null;
  let montoTextoExacto = null;
  let montoLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/(\d)\s*([.,])\s*(\d)/g, "$1$2$3");
    if (/comisi[oó]n|iva\b|beneficiario|cuenta\s+debitada|tel[eé]fono|celular|c[eé]dula|rif\b/i.test(line)) {
      continue;
    }
    const bsMatch = line.match(
      /(?:Bs\.?\s*S?\.?|Bol[ií]vares|VE[BS])\s*[-:]?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})/i
    );
    if (bsMatch) {
      const candidate = parseVenezuelanMonto(bsMatch[1]);
      if (candidate && (!montoBs || candidate > montoBs)) {
        montoBs = candidate;
        montoTextoOriginal = bsMatch[0].trim();
        montoTextoExacto = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(candidate);
        montoLineIndex = i;
      }
      continue;
    }
    const trailingBsMatch = line.match(
      /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2})\s*(?:Bs\.?\s*S?\.?|VE[BS])\b/i
    );
    if (trailingBsMatch) {
      const candidate = parseVenezuelanMonto(trailingBsMatch[1]);
      if (candidate && (!montoBs || candidate > montoBs)) {
        montoBs = candidate;
        montoTextoOriginal = trailingBsMatch[0].trim();
        montoTextoExacto = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(candidate);
        montoLineIndex = i;
      }
      continue;
    }
    if (/^(monto|monto\s+pagado|importe|monto\s+de\s+la\s+operaci[oó]n|total)\b/i.test(line)) {
      const sameLine = parseVenezuelanMonto(line);
      const nextVal = lines[i + 1] && !/comisi[oó]n|beneficiario|cuenta\s+debitada/i.test(lines[i + 1]) ? parseVenezuelanMonto(lines[i + 1]) : null;
      const picked = sameLine || nextVal;
      if (picked && (!montoBs || picked > montoBs)) {
        montoBs = picked;
        montoTextoOriginal = sameLine ? line : lines[i + 1];
        montoTextoExacto = extractMontoTextoExacto(montoTextoOriginal) || new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(picked);
        montoLineIndex = sameLine ? i : i + 1;
      }
    }
  }
  if (montoBs === null) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/(\d)\s*([.,])\s*(\d)/g, "$1$2$3").replace(/\b(\d{1,3}(?:[\s.]\d{3})+)\s+(\d{2})\b/g, (_m, intP, decP) => `${String(intP).replace(/\s+/g, ".")},${decP}`).replace(/\b(\d{1,3})\s+(\d{3})([.,]\d{2})\b/g, "$1.$2$3");
      if (/comisi[oó]n|iva\b|tasa\b/i.test(line)) continue;
      const standaloneMoneyMatch = line.match(
        /\b(\d{1,3}(?:\.\d{3})+[.,]\d{2}|\d{1,3}(?:,\d{3})+[.,]\d{2}|\d{2,10},\d{2})\b/
      );
      if (standaloneMoneyMatch) {
        const candidate = parseVenezuelanMonto(standaloneMoneyMatch[1]);
        if (candidate && (!montoBs || candidate > montoBs)) {
          montoBs = candidate;
          montoTextoOriginal = standaloneMoneyMatch[1];
          montoTextoExacto = new Intl.NumberFormat("es-VE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }).format(candidate);
          montoLineIndex = i;
        }
      }
    }
  }
  let fechaPago = null;
  let fechaIso = null;
  let fechaLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/fecha\s*(?:de\s*(?:la\s*)?)?(?:operaci[oó]n|pago|transacci[oó]n|valor)/i.test(lines[i])) {
      const sameLineDates = normalizeReceiptDates(lines[i]);
      const nextLineDates = lines[i + 1] ? normalizeReceiptDates(lines[i + 1]) : { fecha_pago: null, fecha_iso: null };
      const chosen = sameLineDates.fecha_pago ? sameLineDates : nextLineDates;
      if (chosen.fecha_pago && chosen.fecha_iso) {
        fechaPago = chosen.fecha_pago;
        fechaIso = chosen.fecha_iso;
        fechaLineIndex = sameLineDates.fecha_pago ? i : i + 1;
        break;
      }
    }
  }
  if (!fechaPago) {
    for (let i = 0; i < lines.length; i++) {
      const parsedDates = normalizeReceiptDates(lines[i]);
      if (parsedDates.fecha_pago && parsedDates.fecha_iso) {
        fechaPago = parsedDates.fecha_pago;
        fechaIso = parsedDates.fecha_iso;
        fechaLineIndex = i;
        break;
      }
    }
  }
  let nroReferencia = null;
  let codigoAutorizacion = null;
  const authCodeLabelRegex = /c[oó]digo\s*(?:de\s*)?(?:autorizaci[oó]n|autorizador)/i;
  const refLabelRegex = /(n[uú]mero\s+de\s+referencia|nro\.?\s*(?:de\s*)?referencia|referencia|ref\.?\s*(?:n[°º*o.]?)?|nro\.?\s*(?:de\s*)?operaci[oó]n|n[uú]mero\s+de\s+operaci[oó]n|secuencia|comprobante|c[oó]digo\s+de\s+operaci[oó]n|recibo|folio|control|id\s*(?:de\s*)?transacci[oó]n|aprobaci[oó]n)/i;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (authCodeLabelRegex.test(line)) {
      const authMatch = line.match(authCodeLabelRegex);
      const afterAuth = authMatch && authMatch.index !== void 0 ? line.slice(authMatch.index + authMatch[0].length).replace(/^[\s:.-]+/, "") : line.replace(authCodeLabelRegex, "").replace(/^[\s:.-]+/, "");
      const sameLineAuth = normalizeReferenciaBancaria(afterAuth);
      if (sameLineAuth) {
        codigoAutorizacion = sameLineAuth;
      } else if (lines[i + 1]) {
        const nextLineAuth = normalizeReferenciaBancaria(lines[i + 1]);
        if (nextLineAuth) {
          codigoAutorizacion = nextLineAuth;
        }
      }
      continue;
    }
    if (!nroReferencia && refLabelRegex.test(line) && !/(?:tipo|fecha)\s+de\s+(?:la\s+)?operaci[oó]n/i.test(line)) {
      const refMatch = line.match(refLabelRegex);
      const afterLabel = refMatch && refMatch.index !== void 0 ? line.slice(refMatch.index + refMatch[0].length).replace(/^[\s:.,*-]+/, "") : line.replace(refLabelRegex, "").replace(/^[\s:.,*-]+/, "");
      const firstRefToken = afterLabel.match(/^(\d{4,15})\b/);
      const sameLineDigits = normalizeReferenciaBancaria(firstRefToken ? firstRefToken[1] : afterLabel);
      if (sameLineDigits) {
        nroReferencia = sameLineDigits;
        continue;
      }
      if (lines[i + 1] && !authCodeLabelRegex.test(lines[i + 1])) {
        const nextLineDigits = normalizeReferenciaBancaria(lines[i + 1]);
        if (nextLineDigits) {
          nroReferencia = nextLineDigits;
          continue;
        }
      }
      if (lines[i + 2] && lines[i + 1] && lines[i + 1].length <= 4) {
        const twoLinesDownDigits = normalizeReferenciaBancaria(lines[i + 2]);
        if (twoLinesDownDigits) {
          nroReferencia = twoLinesDownDigits;
          continue;
        }
      }
    }
  }
  if (!nroReferencia) {
    const candidateRefs = [];
    for (let i = 0; i < lines.length; i++) {
      const strippedLine = lines[i].replace(/(\d)\s*([.,])\s*(\d)/g, "$1$2$3").replace(/\b(\d{1,3}(?:[\s.]\d{3})+)\s+(\d{2})\b/g, " ").replace(/\b\d{1,2}[/-]\d{1,2}[/-](?:20\d{2}|\d{2})\b/g, " ").replace(/\b20\d{2}[/-]\d{1,2}[/-]\d{1,2}\b/g, " ").replace(/\b01\d{2}[*•xX#.\-:"'+~_=\d]{8,24}\b/g, " ").replace(/\b\d{1,3}(?:[.,]\d{3})+[.,]\d{1,2}\b/g, " ").replace(/\b\d+[.,]\d{1,2}\b/g, " ");
      const seqMatches = strippedLine.matchAll(/(?:^|[\s|#:-])(\d{6,15})(?=$|[\s|])/g);
      for (const m of seqMatches) {
        const rawCandidate = m[1];
        const normalized = normalizeReferenciaBancaria(rawCandidate);
        if (normalized && normalized.length >= 6 && normalized.length <= 15) {
          const distFecha = fechaLineIndex >= 0 ? Math.abs(i - fechaLineIndex) : 99;
          const distMonto = montoLineIndex >= 0 ? Math.abs(i - montoLineIndex) : 99;
          candidateRefs.push({
            ref: normalized,
            distance: Math.min(distFecha, distMonto),
            hasLeadingZeros: /^0+/.test(normalized)
          });
        }
      }
    }
    if (candidateRefs.length > 0) {
      candidateRefs.sort((a, b) => {
        if (a.hasLeadingZeros !== b.hasLeadingZeros) return a.hasLeadingZeros ? -1 : 1;
        return a.distance - b.distance;
      });
      nroReferencia = candidateRefs[0].ref;
    }
  }
  let beneficiarioDetectado = null;
  let titularRemitente = null;
  let rifCiTitular = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || "";
    if (isBeneficiaryName(line) && !beneficiarioDetectado) {
      beneficiarioDetectado = line.replace(/^(beneficiario|destinatario|nombre|raz[oó]n\s+social|comercio)\s*[:.-]?\s*/i, "").trim();
    }
    if (/^(beneficiario|destinatario|a\s+favor\s+de|comercio|receptor)\b/i.test(line)) {
      const val = line.replace(/^(beneficiario|destinatario|a\s+favor\s+de|comercio|receptor)\s*[:.-]?\s*/i, "").trim() || nextLine;
      if (val && !beneficiarioDetectado) {
        beneficiarioDetectado = val;
      }
      continue;
    }
    if (/^(ordenante|remitente|emisor|pagador|titular\s+origen|nombre\s+origen|cliente\s+origen)\b/i.test(line)) {
      const val = line.replace(/^(ordenante|remitente|emisor|pagador|titular\s+origen|nombre\s+origen|cliente\s+origen)\s*[:.-]?\s*/i, "").trim() || nextLine;
      if (val && !isBeneficiaryName(val)) {
        titularRemitente = val;
      }
    }
    if (/(rif|c[eé]dula|c\.?i\.?|documento|identificaci[oó]n)\s*(del\s*)?(ordenante|remitente|emisor|origen|pagador)/i.test(
      line
    )) {
      const candidateRif = normalizeRifCiTitular(line) || normalizeRifCiTitular(nextLine);
      if (candidateRif) {
        rifCiTitular = candidateRif;
      }
    }
  }
  const resolvedRef = nroReferencia ?? codigoAutorizacion ?? null;
  const inferredBanco = inferirBancoVenezolano(banco, fullText, numeroCuentaDetectada) || banco;
  const canalDetectado = /\bprovinet\b|\bprovmet\b|\bprovlnet\b|\bprovinel\b/i.test(fullText) || numeroCuentaDetectada && numeroCuentaDetectada.startsWith("0108") || inferredBanco === "BBVA Provincial" ? "Provinet" : null;
  const esLegible = Boolean(
    montoBs && montoBs > 0 || resolvedRef || fechaPago || inferredBanco || canalDetectado || numeroCuentaDetectada
  );
  const metodoPago = esLegible ? normalizeMetodoPago("", fullText) : null;
  return auditAndNormalizeReceiptPayload({
    es_legible: esLegible,
    legible: esLegible,
    confianza: montoBs && resolvedRef ? 0.9 : esLegible ? 0.65 : 0,
    confianza_lectura: montoBs && resolvedRef ? "alta" : esLegible ? "media" : "baja",
    metodo_pago: metodoPago,
    banco: inferredBanco,
    canal: canalDetectado,
    banco_origen: bancoOrigen,
    banco_destino: bancoDestino,
    monto_bs: montoBs,
    montoRaw: montoTextoExacto,
    montoNumerico: montoBs,
    monto_texto: montoTextoExacto,
    monto_texto_original: montoTextoOriginal,
    referencia: resolvedRef,
    nro_referencia: resolvedRef,
    codigo_autorizacion: codigoAutorizacion,
    fecha_pago: fechaPago,
    fecha_iso: fechaIso,
    numero_cuenta: numeroCuentaDetectada,
    texto_completo: fullText,
    titular_remitente: titularRemitente,
    rif_ci_titular: rifCiTitular,
    beneficiario_detectado: beneficiarioDetectado,
    evidencia_visual: {
      tiene_etiquetas_visibles: tieneEtiquetasVisibles,
      es_foto_de_pantalla: false,
      lineas_crudas_detectadas: lines
    },
    observacion_auditoria: montoBs && resolvedRef ? "Comprobante de operaci\xF3n exitosa le\xEDdo correctamente." : "Lectura parcial del comprobante; verifique los campos antes de consolidar."
  });
}
var VENEZUELAN_RECEIPT_MODEL_CASCADE = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite"
];
async function extractSupportWithGemini(options) {
  const { apiKeys, base64Data, mimeType, fileName } = options;
  const cleanB64 = (base64Data.includes(",") ? base64Data.split(",")[1] : base64Data).replace(/\s+/g, "");
  const resolvedMime = detectReceiptMimeType(cleanB64, mimeType, fileName);
  if (!apiKeys || apiKeys.length === 0) {
    return {
      audited: null,
      usedModel: null,
      errorType: "NO_API_KEY",
      errorMessage: "No hay claves GEMINI_API_KEY configuradas para lectura multimodal."
    };
  }
  const userInstruction = "Extrae los datos visibles en este comprobante de pago venezolano (incluyendo capturas recortadas sin etiquetas a la izquierda o fotos tomadas a monitores con efecto moir\xE9) aplicando estrictamente las reglas determin\xEDsticas. Devuelve un objeto JSON v\xE1lido con los campos: es_legible, fecha_pago, referencia, monto_bs, banco, canal, numero_cuenta, metodo_pago, titular_remitente, rif_ci_titular.";
  let lastErrorMsg = "";
  let sawQuota = false;
  let sawNetwork = false;
  let partialAudited = null;
  for (const apiKey of apiKeys) {
    const ai = new import_genai.GoogleGenAI({ apiKey });
    for (const modelName of VENEZUELAN_RECEIPT_MODEL_CASCADE) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: "user",
                parts: [
                  { inlineData: { mimeType: resolvedMime, data: cleanB64 } },
                  { text: userInstruction }
                ]
              }
            ],
            config: {
              systemInstruction: VENEZUELAN_BANKING_AUDIT_SYSTEM_PROMPT,
              responseMimeType: "application/json",
              ...attempt === 0 ? { responseSchema: VENEZUELAN_RECEIPT_RESPONSE_SCHEMA } : {},
              temperature: 0,
              topP: 0.1
            }
          });
          const rawText = String(response?.text || "").trim();
          if (rawText) {
            const parsedJson = safeExtractReceiptJson(rawText);
            const audited = auditAndNormalizeReceiptPayload(parsedJson);
            if (audited.legible || audited.es_legible || audited.lectura_exitosa) {
              return {
                audited,
                usedModel: modelName,
                errorType: "NONE",
                errorMessage: null
              };
            }
            partialAudited = audited;
          }
          break;
        } catch (err) {
          const msg = String(err?.message || err || "");
          lastErrorMsg = msg;
          if (/RESOURCE_EXHAUSTED|quota|429|billing|prepayment/i.test(msg)) {
            sawQuota = true;
          }
          if (/fetch|network|timeout|ECONNRESET|503|502|504/i.test(msg)) {
            sawNetwork = true;
          }
          if (/API_KEY_INVALID|API key not valid|reported as leaked|PERMISSION_DENIED/i.test(msg)) {
            break;
          }
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 250));
            continue;
          }
          break;
        }
      }
    }
  }
  return {
    audited: partialAudited,
    usedModel: null,
    errorType: sawQuota ? "QUOTA_EXCEEDED" : sawNetwork ? "NETWORK_ERROR" : "UNREADABLE_IMAGE",
    errorMessage: lastErrorMsg || "No se lograron identificar con claridad los datos del soporte."
  };
}

// src/services/bcvRateService.ts
var XLSX = __toESM(require("xlsx"), 1);
var BCV_INDICE_INVERSION_URL = "https://www.bcv.org.ve/estadisticas/indice-de-inversion";
var BCV_SMC_URL = "https://www.bcv.org.ve/estadisticas/tipo-cambio-de-referencia-smc";
function normalizeBcvDateInput(fechaInput) {
  const raw = String(fechaInput || "").trim();
  const isoMatch = raw.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    const yyyy = isoMatch[1];
    const mm = isoMatch[2].padStart(2, "0");
    const dd = isoMatch[3].padStart(2, "0");
    return {
      iso: `${yyyy}-${mm}-${dd}`,
      display: `${dd}/${mm}/${yyyy}`
    };
  }
  const dmyMatch = raw.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, "0");
    const mm = dmyMatch[2].padStart(2, "0");
    const yyyy = dmyMatch[3];
    return {
      iso: `${yyyy}-${mm}-${dd}`,
      display: `${dd}/${mm}/${yyyy}`
    };
  }
  const compactMatch = raw.match(/^(\d{2})(\d{2})(20\d{2})$/);
  if (compactMatch) {
    const [, dd, mm, yyyy] = compactMatch;
    return {
      iso: `${yyyy}-${mm}-${dd}`,
      display: `${dd}/${mm}/${yyyy}`
    };
  }
  const todayIso = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const [y, m, d] = todayIso.split("-");
  return {
    iso: todayIso,
    display: `${d}/${m}/${y}`
  };
}
function parseNumeroBcv(raw) {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.round((raw + Number.EPSILON) * 100) / 100;
  }
  if (!raw || typeof raw !== "string") return 0;
  const cleaned = raw.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return 0;
  let numericValue = 0;
  if (cleaned.includes(".") && cleaned.includes(",")) {
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    if (lastComma > lastDot) {
      numericValue = parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
    } else {
      numericValue = parseFloat(cleaned.replace(/,/g, "")) || 0;
    }
  } else if (cleaned.includes(",")) {
    numericValue = parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  } else {
    numericValue = parseFloat(cleaned) || 0;
  }
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
}
function parseBcvIndiceInversionHtml(html) {
  const ratesByDate = {};
  if (!html || typeof html !== "string") return ratesByDate;
  const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const rowHtml of rowMatches) {
    if (/<th[\s>]/i.test(rowHtml) && !/<td[\s>]/i.test(rowHtml)) continue;
    let dateIso = "";
    const contentDateMatch = rowHtml.match(/content=["'](20\d{2}-\d{2}-\d{2})T/i);
    if (contentDateMatch) {
      dateIso = contentDateMatch[1];
    } else {
      const dateCellMatch = rowHtml.match(/views-field-field-fecha-del-indicador[^>]*>([\s\S]*?)<\/td>/i) || rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
      if (dateCellMatch) {
        const plainDate = dateCellMatch[1].replace(/<[^>]+>/g, " ").trim();
        if (/\b\d{1,2}[-/]\d{1,2}[-/]20\d{2}\b/.test(plainDate) || /\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/.test(plainDate)) {
          dateIso = normalizeBcvDateInput(plainDate).iso;
        }
      }
    }
    if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) continue;
    let rateVal = 0;
    const conditionalCellMatch = rowHtml.match(
      /class=["'][^"']*views-field-views-conditional(?:\s|["'])[^>]*>([\s\S]*?)<\/td>/i
    );
    if (conditionalCellMatch) {
      const cellText = conditionalCellMatch[1].replace(/<[^>]+>/g, " ").trim();
      rateVal = parseNumeroBcv(cellText);
    } else {
      const tdMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
        (m) => m[1].replace(/<[^>]+>/g, " ").trim()
      );
      if (tdMatches.length >= 2) {
        rateVal = parseNumeroBcv(tdMatches[1]);
      }
    }
    if (rateVal > 0) {
      ratesByDate[dateIso] = rateVal;
    }
  }
  return ratesByDate;
}
function extractBcvExcelLinksFromHtml(html) {
  if (!html || typeof html !== "string") return [];
  const links = [];
  const regex = /href=["']([^"']+\.(?:xls|xlsx)(?:\?[^"']*)?)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const rawHref = match[1].trim();
    if (!rawHref) continue;
    const fullUrl = rawHref.startsWith("http") ? rawHref : `https://www.bcv.org.ve${rawHref.startsWith("/") ? "" : "/"}${rawHref}`;
    if (!links.includes(fullUrl)) {
      links.push(fullUrl);
    }
  }
  return links;
}
function parseBcvExcelBuffer(buffer) {
  const ratesByDate = {};
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (!Array.isArray(rows) || rows.length === 0) continue;
      let sheetFechaValorIso = "";
      let sheetFechaOperacionIso = "";
      if (/^\d{8}$/.test(sheetName.trim())) {
        sheetFechaOperacionIso = normalizeBcvDateInput(sheetName.trim()).iso;
      }
      for (const row of rows) {
        if (!Array.isArray(row) || row.length === 0) continue;
        const rowText = row.map((c) => String(c ?? "").trim()).join(" ");
        const fvMatch = rowText.match(/Fecha\s+Valor\s*:\s*(\d{2}[-/]\d{2}[-/]20\d{2})/i);
        if (fvMatch) {
          sheetFechaValorIso = normalizeBcvDateInput(fvMatch[1]).iso;
        }
        const foMatch = rowText.match(/Fecha\s+Operaci[oó]n\s*:\s*(\d{2}[-/]\d{2}[-/]20\d{2})/i);
        if (foMatch) {
          sheetFechaOperacionIso = normalizeBcvDateInput(foMatch[1]).iso;
        }
        const firstCol = String(row[0] ?? "").trim().toUpperCase();
        if (firstCol === "USD" && row.length >= 6) {
          const askRate = parseNumeroBcv(row[5]) || parseNumeroBcv(row[4]);
          if (askRate > 0) {
            if (sheetFechaValorIso) {
              ratesByDate[sheetFechaValorIso] = askRate;
            }
            if (sheetFechaOperacionIso && !ratesByDate[sheetFechaOperacionIso]) {
              ratesByDate[sheetFechaOperacionIso] = askRate;
            }
          }
          continue;
        }
        const cell0 = String(row[0] ?? "").trim();
        if (/^\d{1,2}[-/]\d{1,2}[-/]20\d{2}$/.test(cell0) || /^20\d{2}[-/]\d{1,2}[-/]\d{1,2}$/.test(cell0)) {
          const iso = normalizeBcvDateInput(cell0).iso;
          const rateCandidate = parseNumeroBcv(row[1]);
          if (iso && rateCandidate > 0) {
            ratesByDate[iso] = rateCandidate;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[BCV EXCEL PARSER] Error procesando libro Excel del BCV:", err);
  }
  return ratesByDate;
}
function resolveBcvRateWithBusinessDayFallback(ratesMap, fechaInput, maxLookbackDays = 5, fuente = BCV_INDICE_INVERSION_URL) {
  if (!ratesMap || typeof ratesMap !== "object") return null;
  const { iso: targetIso, display: targetDisplay } = normalizeBcvDateInput(fechaInput);
  const exactRate = ratesMap[targetIso];
  if (typeof exactRate === "number" && exactRate > 0) {
    return {
      tasa: exactRate,
      fechaValor: targetIso,
      fechaValorDisplay: targetDisplay,
      fechaSolicitada: targetIso,
      fechaSolicitadaDisplay: targetDisplay,
      fuente,
      esDiaHabilAnterior: false
    };
  }
  const baseDate = /* @__PURE__ */ new Date(`${targetIso}T12:00:00Z`);
  if (isNaN(baseDate.getTime())) return null;
  for (let offset = 1; offset <= maxLookbackDays; offset++) {
    const prevDate = new Date(baseDate.getTime() - offset * 864e5);
    const yyyy = prevDate.getUTCFullYear();
    const mm = String(prevDate.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(prevDate.getUTCDate()).padStart(2, "0");
    const prevIso = `${yyyy}-${mm}-${dd}`;
    const candidateRate = ratesMap[prevIso];
    if (typeof candidateRate === "number" && candidateRate > 0) {
      return {
        tasa: candidateRate,
        fechaValor: prevIso,
        fechaValorDisplay: `${dd}/${mm}/${yyyy}`,
        fechaSolicitada: targetIso,
        fechaSolicitadaDisplay: targetDisplay,
        fuente,
        esDiaHabilAnterior: true
      };
    }
  }
  return null;
}

// server.ts
init_firebase();

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
    displayName: "Cuentas claves 1 - MC",
    routes: [
      {
        id: "CUENTAS CLAVES 1 - MC",
        label: "Cuentas claves 1 - MC",
        aliases: [
          "CUENTAS CLAVES 1 - MC",
          "CUENTAS CLAVE 1 - MC",
          "CUENTAS CLAVES 1",
          "CUENTAS CLAVE 1",
          "MARIANA CHACIN",
          "MARIANA CHAC\xCDN"
        ]
      }
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
    displayName: "Cuentas claves 2 - SV",
    routes: [
      {
        id: "CUENTAS CLAVES 2 - SV",
        label: "Cuentas claves 2 - SV",
        aliases: [
          "CUENTAS CLAVES 2 - SV",
          "CUENTAS CLAVE 2 - SV",
          "CUENTAS CLAVES 2",
          "CUENTAS CLAVE 2",
          "SAIRU VALLES",
          "SAIR\xDA VALLES"
        ]
      }
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
VENDOR_PROFILES["FOOD SERVICE SENIOR - JUAN HERNANDEZ"] = VENDOR_PROFILES["JUAN HERNANDEZ"];
VENDOR_PROFILES["FOOD SERVICE SENIOR"] = VENDOR_PROFILES["JUAN HERNANDEZ"];
VENDOR_PROFILES["CUENTAS CLAVES 1 - MC"] = VENDOR_PROFILES["MARIANA CHACIN"];
VENDOR_PROFILES["CUENTAS CLAVE 1 - MC"] = VENDOR_PROFILES["MARIANA CHACIN"];
VENDOR_PROFILES["CUENTAS CLAVES 1"] = VENDOR_PROFILES["MARIANA CHACIN"];
VENDOR_PROFILES["CUENTAS CLAVE 1"] = VENDOR_PROFILES["MARIANA CHACIN"];
VENDOR_PROFILES["CUENTAS CLAVES 2 - SV"] = VENDOR_PROFILES["SAIRU VALLES"];
VENDOR_PROFILES["CUENTAS CLAVE 2 - SV"] = VENDOR_PROFILES["SAIRU VALLES"];
VENDOR_PROFILES["CUENTAS CLAVES 2"] = VENDOR_PROFILES["SAIRU VALLES"];
VENDOR_PROFILES["CUENTAS CLAVE 2"] = VENDOR_PROFILES["SAIRU VALLES"];
VENDOR_PROFILES["OSCAR ORTIZ- LA COSTA"] = VENDOR_PROFILES["OSCAR ORTIZ"];
VENDOR_PROFILES["OSCAR ORTIZ - LA COSTA"] = VENDOR_PROFILES["OSCAR ORTIZ"];
VENDOR_PROFILES["OSCAR ORTIZ- CORO"] = VENDOR_PROFILES["OSCAR ORTIZ"];
VENDOR_PROFILES["OSCAR ORTIZ - CORO"] = VENDOR_PROFILES["OSCAR ORTIZ"];
var SUPERVISOR_PROFILES = {
  "ALI PEREZ": {
    canonicalUsername: "ALI PEREZ",
    displayName: "Al\xED P\xE9rez (Supervisor)",
    supervisedVendors: [
      "ANGEL NAVARRO",
      "MARIANGEL GONZALEZ",
      "VICTOR CAMPOS",
      "ELISA SOLER",
      "LEONARDO RIOS",
      "LUIS GUANIPA",
      "OSCAR ORTIZ"
    ]
  },
  "JOHNATAN SOTO": {
    canonicalUsername: "JOHNATAN SOTO",
    displayName: "Johnatan Soto (Supervisor)",
    supervisedVendors: [
      "MIKELANGELO DIAZ",
      "HERNAN PAZ",
      "OSWALDO CHURION",
      "ANGELICA MORENO",
      "ADEL JARABA",
      "JUAN HERNANDEZ",
      "JAIDER MEDINA - FOOD SERVICE NORTE"
    ]
  },
  "NELSON FINOL": {
    canonicalUsername: "NELSON FINOL",
    displayName: "Nelson Finol (Supervisor)",
    supervisedVendors: [
      "MARIA BRICE\xD1O",
      "MARIANA CHACIN",
      "CARLOS FUENMAYOR",
      "SARAH REYES",
      "J PABLO ARAUJO",
      "J PABLO ARAUJO - CAB/OJE",
      "JOSE G. GONZALEZ",
      "FOOD SERVICE SUR",
      "YOLEIDA LUGO",
      "SAIRU VALLES",
      "EDUARDO PI\xD1A",
      "MARYERY GARCIA",
      "PEDRO ABREU"
    ]
  }
};
function hydrateVendorProfilesFromMasterCatalog(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  for (const r of rows) {
    if (r.activo === false) continue;
    const canon = normalizeVendorName(r.nombre_canonico);
    if (!canon || r.is_supervisor_route) continue;
    const sup = normalizeVendorName(r.supervisor);
    if (sup && SUPERVISOR_PROFILES[sup] && !SUPERVISOR_PROFILES[sup].supervisedVendors.includes(canon)) {
      SUPERVISOR_PROFILES[sup].supervisedVendors.push(canon);
    }
    if (!VENDOR_PROFILES[canon]) {
      const routeId = normalizeVendorName(r.ruta_oficial) || canon;
      const aliases = Array.from(/* @__PURE__ */ new Set([canon, routeId, ...(r.aliases || []).map((a) => normalizeVendorName(a)).filter(Boolean)]));
      VENDOR_PROFILES[canon] = {
        canonicalUsername: canon,
        displayName: r.display_name || canon,
        email: r.email || void 0,
        routes: [{ id: routeId, label: `Ruta ${r.display_name || canon}`, aliases }]
      };
    }
  }
}
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

// src/utils/maestraCatalogSanitizer.ts
function sanitizeCatalogText(val) {
  if (val === null || val === void 0) return "";
  return String(val).replace(/^\uFEFF/, "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/Ã‘|Ã±/g, "\xD1").replace(/\s+/g, " ").trim();
}
function sanitizeCatalogUpper(val) {
  return sanitizeCatalogText(val).toUpperCase();
}
function normalizeCatalogAsciiKey(val) {
  return sanitizeCatalogUpper(val).replace(/Ñ/g, "N").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");
}
var OFFICIAL_MASTER_VENDEDORES_SEED = [
  // =========================================================================
  // SUPERVISOR: JOHNATAN SOTO (6 Vendedores Comerciales Activos)
  // =========================================================================
  {
    vendedor_id: "3",
    codigo_erp: "3",
    nombre_canonico: "MIKELANGELO DIAZ",
    display_name: "Mikelangelo Diaz",
    ruta_oficial: "MIKELANGELO DIAZ",
    aliases: [
      "MIKELANGELO DIAZ",
      "MIKELANGELO DIAZ1",
      "MIKELANGELO",
      "MIKELANGELO DIAZ - VILLA DEL ROS",
      "MIKELANGELO DIAZ VILLA DEL ROS",
      "MIKELANGELO VILLA DEL ROS",
      "JOHNATAN SOTO",
      "JOHNATAN SOTO VILLA DEL ROS",
      "JOHNATAN SOTO - VILLA DEL ROS",
      "MIKELANGELODIAZ@GMAIL.COM"
    ],
    supervisor: "JOHNATAN SOTO",
    zona: "Machiques / Villa del Rosario / Perij\xE1",
    region: "Supervisi\xF3n Johnatan Soto",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 69,
    meta_volumen: 0,
    email: "Mikelangelodiaz@gmail.com",
    activo: true
  },
  {
    vendedor_id: "4",
    codigo_erp: "4",
    nombre_canonico: "HERNAN PAZ",
    display_name: "Hern\xE1n Paz",
    ruta_oficial: "HERNAN PAZ",
    aliases: ["HERNAN PAZ", "HERN\xC1N PAZ"],
    supervisor: "JOHNATAN SOTO",
    zona: "Maracaibo / Perij\xE1",
    region: "Supervisi\xF3n Johnatan Soto",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 49,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "7",
    codigo_erp: "7",
    nombre_canonico: "OSWALDO CHURION",
    display_name: "Oswaldo Churi\xF3n",
    ruta_oficial: "OSWALDO CHURION",
    aliases: ["OSWALDO CHURION", "OSWALDO CHURI\xD3N"],
    supervisor: "JOHNATAN SOTO",
    zona: "Maracaibo / Sur",
    region: "Supervisi\xF3n Johnatan Soto",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 45,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "21",
    codigo_erp: "21",
    nombre_canonico: "ANGELICA MORENO",
    display_name: "Ang\xE9lica Moreno",
    ruta_oficial: "ANGELICA MORENO",
    aliases: ["ANGELICA MORENO", "ANG\xC9LICA MORENO"],
    supervisor: "JOHNATAN SOTO",
    zona: "Maracaibo / Norte",
    region: "Supervisi\xF3n Johnatan Soto",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 62,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "22",
    codigo_erp: "22",
    nombre_canonico: "ADEL JARABA",
    display_name: "Adel Jaraba",
    ruta_oficial: "ADEL JARABA",
    aliases: ["ADEL JARABA"],
    supervisor: "JOHNATAN SOTO",
    zona: "Mayoristas / Maracaibo",
    region: "Supervisi\xF3n Johnatan Soto",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 40,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "24",
    codigo_erp: "24",
    nombre_canonico: "JUAN HERNANDEZ",
    display_name: "Juan Hern\xE1ndez",
    ruta_oficial: "JUAN HERNANDEZ",
    aliases: ["JUAN HERNANDEZ", "JUAN HERN\xC1NDEZ"],
    supervisor: "JOHNATAN SOTO",
    zona: "Sur del Lago / El Chivo",
    region: "Supervisi\xF3n Johnatan Soto",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 39,
    meta_volumen: 0,
    activo: true
  },
  // =========================================================================
  // SUPERVISOR: ALI PEREZ (7 Vendedores Comerciales Activos en Falcón)
  // =========================================================================
  {
    vendedor_id: "29",
    codigo_erp: "29",
    nombre_canonico: "ANGEL NAVARRO",
    display_name: "\xC1ngel Navarro",
    ruta_oficial: "ANGEL NAVARRO",
    aliases: ["ANGEL NAVARRO", "\xC1NGEL NAVARRO"],
    supervisor: "ALI PEREZ",
    zona: "Punto Fijo / Paraguan\xE1",
    region: "Supervisi\xF3n Ali Perez",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 25,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "47",
    codigo_erp: "47",
    nombre_canonico: "MARIANGEL GONZALEZ",
    display_name: "Mariangel Gonz\xE1lez",
    ruta_oficial: "MARIANGEL GONZALEZ",
    aliases: ["MARIANGEL GONZALEZ", "MARIANGEL GONZ\xC1LEZ", "MARIANGEL"],
    supervisor: "ALI PEREZ",
    zona: "Punto Fijo / Paraguan\xE1",
    region: "Supervisi\xF3n Ali Perez",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 19,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "48",
    codigo_erp: "48",
    nombre_canonico: "VICTOR CAMPOS",
    display_name: "V\xEDctor Campos",
    ruta_oficial: "VICTOR CAMPOS",
    aliases: ["VICTOR CAMPOS", "V\xCDCTOR CAMPOS"],
    supervisor: "ALI PEREZ",
    zona: "Punto Fijo / Paraguan\xE1",
    region: "Supervisi\xF3n Ali Perez",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 20,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "28",
    codigo_erp: "28",
    nombre_canonico: "ELISA SOLER",
    display_name: "Elisa Soler",
    ruta_oficial: "ELISA SOLER",
    aliases: ["ELISA SOLER"],
    supervisor: "ALI PEREZ",
    zona: "Punto Fijo / Paraguan\xE1",
    region: "Supervisi\xF3n Ali Perez",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 59,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "38",
    codigo_erp: "38",
    nombre_canonico: "LEONARDO RIOS",
    display_name: "Leonardo R\xEDos",
    ruta_oficial: "LEONARDO RIOS",
    aliases: ["LEONARDO RIOS", "LEONARDO R\xCDOS"],
    supervisor: "ALI PEREZ",
    zona: "Punto Fijo / Paraguan\xE1",
    region: "Supervisi\xF3n Ali Perez",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 49,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "40",
    codigo_erp: "40",
    nombre_canonico: "LUIS GUANIPA",
    display_name: "Luis Guanipa",
    ruta_oficial: "LUIS GUANIPA",
    aliases: ["LUIS GUANIPA"],
    supervisor: "ALI PEREZ",
    zona: "Coro / Falc\xF3n",
    region: "Supervisi\xF3n Ali Perez",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 57,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "46",
    codigo_erp: "46",
    nombre_canonico: "OSCAR ORTIZ",
    display_name: "\xD3scar Ortiz",
    ruta_oficial: "OSCAR ORTIZ",
    aliases: [
      "OSCAR ORTIZ",
      "OSCAR ORTIZ - CORO",
      "OSCAR ORTIZ- CORO",
      "OSCAR ORTIZ - LA COSTA",
      "OSCAR ORTIZ- LA COSTA",
      "OSCAR ORTIZ-  LA COSTA"
    ],
    supervisor: "ALI PEREZ",
    zona: "Coro / La Costa",
    region: "Supervisi\xF3n Ali Perez",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 96,
    meta_volumen: 0,
    activo: true
  },
  // =========================================================================
  // SUPERVISOR: NELSON FINOL (12 Carteras de Fuerza de Ventas y Cuentas Clave)
  // =========================================================================
  {
    vendedor_id: "1",
    codigo_erp: "1",
    nombre_canonico: "MARIA BRICE\xD1O",
    display_name: "Mar\xEDa Brice\xF1o",
    ruta_oficial: "MARIA BRICE\xD1O",
    aliases: ["MARIA BRICE\xD1O", "MARIA BRICENO", "MAR\xCDA BRICE\xD1O", "MARIA BRICEO"],
    supervisor: "NELSON FINOL",
    zona: "Maracaibo",
    region: "Supervisi\xF3n Nelson Finol",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 59,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "55",
    codigo_erp: "55",
    nombre_canonico: "MARIANA CHACIN",
    display_name: "Cuentas claves 1 - MC",
    ruta_oficial: "CUENTAS CLAVES 1 - MC",
    aliases: [
      "MARIANA CHACIN",
      "MARIANA CHAC\xCDN",
      "CUENTAS CLAVES 1 - MC",
      "CUENTAS CLAVE 1 - MC",
      "CUENTAS CLAVES 1",
      "CUENTAS CLAVE 1",
      "CUENTAS CLAVE 1 - MC (MARIANA CHACIN)",
      "CUENTAS CLAVES 1 - MC (MARIANA CHACIN)"
    ],
    supervisor: "NELSON FINOL",
    zona: "Cuentas claves 1 - MC",
    region: "Supervisi\xF3n Nelson Finol",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 39,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "12",
    codigo_erp: "12",
    nombre_canonico: "CARLOS FUENMAYOR",
    display_name: "Carlos Fuenmayor",
    ruta_oficial: "CARLOS FUENMAYOR",
    aliases: ["CARLOS FUENMAYOR"],
    supervisor: "NELSON FINOL",
    zona: "Maracaibo",
    region: "Supervisi\xF3n Nelson Finol",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 31,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "14",
    codigo_erp: "14",
    nombre_canonico: "SARAH REYES",
    display_name: "Sarah Reyes",
    ruta_oficial: "SARAH REYES",
    aliases: ["SARAH REYES"],
    supervisor: "NELSON FINOL",
    zona: "Maracaibo / San Francisco",
    region: "Supervisi\xF3n Nelson Finol",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 49,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "15",
    codigo_erp: "15",
    nombre_canonico: "J PABLO ARAUJO - CAB/OJE",
    display_name: "J Pablo Araujo (Cabimas / Ojeda)",
    ruta_oficial: "J PABLO ARAUJO - CAB/OJE",
    aliases: ["J PABLO ARAUJO - CAB/OJE", "J PABLO ARAUJO- CAB/OJE", "J PABLO ARAUJO - CAB"],
    supervisor: "NELSON FINOL",
    zona: "Cabimas / Ciudad Ojeda",
    region: "Supervisi\xF3n Nelson Finol",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 36,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "16",
    codigo_erp: "16",
    nombre_canonico: "JOSE G. GONZALEZ",
    display_name: "Jos\xE9 G. Gonz\xE1lez",
    ruta_oficial: "JOSE G. GONZALEZ",
    aliases: ["JOSE G. GONZALEZ", "JOSE GONZALEZ", "JOS\xC9 G. GONZ\xC1LEZ"],
    supervisor: "NELSON FINOL",
    zona: "Maracaibo",
    region: "Supervisi\xF3n Nelson Finol",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 59,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "25",
    codigo_erp: "25",
    nombre_canonico: "YOLEIDA LUGO",
    display_name: "Yoleida Lugo",
    ruta_oficial: "YOLEIDA LUGO",
    aliases: ["YOLEIDA LUGO"],
    supervisor: "NELSON FINOL",
    zona: "Maracaibo",
    region: "Supervisi\xF3n Nelson Finol",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 44,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "56",
    codigo_erp: "56",
    nombre_canonico: "SAIRU VALLES",
    display_name: "Cuentas claves 2 - SV",
    ruta_oficial: "CUENTAS CLAVES 2 - SV",
    aliases: [
      "SAIRU VALLES",
      "SAIR\xDA VALLES",
      "CUENTAS CLAVES 2 - SV",
      "CUENTAS CLAVE 2 - SV",
      "CUENTAS CLAVES 2",
      "CUENTAS CLAVE 2",
      "CUENTAS CLAVE 2 - SV (SAIRU VALLES)",
      "CUENTAS CLAVES 2 - SV (SAIRU VALLES)"
    ],
    supervisor: "NELSON FINOL",
    zona: "Cuentas claves 2 - SV",
    region: "Supervisi\xF3n Nelson Finol",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 36,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "31",
    codigo_erp: "31",
    nombre_canonico: "J PABLO ARAUJO",
    display_name: "J Pablo Araujo",
    ruta_oficial: "J PABLO ARAUJO",
    aliases: ["J PABLO ARAUJO"],
    supervisor: "NELSON FINOL",
    zona: "Costa Oriental del Lago",
    region: "Supervisi\xF3n Nelson Finol",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 41,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "33",
    codigo_erp: "33",
    nombre_canonico: "EDUARDO PI\xD1A",
    display_name: "Eduardo Pi\xF1a",
    ruta_oficial: "EDUARDO PI\xD1A",
    aliases: ["EDUARDO PI\xD1A", "EDUARDO PINA", "EDUARDO PIA"],
    supervisor: "NELSON FINOL",
    zona: "Maracaibo",
    region: "Supervisi\xF3n Nelson Finol",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 59,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "39",
    codigo_erp: "39",
    nombre_canonico: "MARYERY GARCIA",
    display_name: "Maryery Garc\xEDa",
    ruta_oficial: "MARYERY GARCIA",
    aliases: ["MARYERY GARCIA", "MARYERY GARC\xCDA"],
    supervisor: "NELSON FINOL",
    zona: "Ciudad Ojeda / COL",
    region: "Supervisi\xF3n Nelson Finol",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 39,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "45",
    codigo_erp: "45",
    nombre_canonico: "PEDRO ABREU",
    display_name: "Pedro Abreu",
    ruta_oficial: "PEDRO ABREU",
    aliases: ["PEDRO ABREU"],
    supervisor: "NELSON FINOL",
    zona: "Punto Fijo / Paraguan\xE1",
    region: "Supervisi\xF3n Nelson Finol",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: true,
    meta_activacion: 53,
    meta_volumen: 0,
    activo: true
  },
  // =========================================================================
  // RUTAS ESPECIALES DE FOOD SERVICE (Excluidas de Ranking de Volumen FDV)
  // =========================================================================
  {
    vendedor_id: "19",
    codigo_erp: "19",
    nombre_canonico: "FOOD SERVICE SUR",
    display_name: "Food Service Sur",
    ruta_oficial: "FOOD SERVICE SUR",
    aliases: ["FOOD SERVICE SUR"],
    supervisor: "NELSON FINOL",
    zona: "Food Service Sur",
    region: "Supervisi\xF3n Nelson Finol",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: false,
    meta_activacion: 39,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "20",
    codigo_erp: "20",
    nombre_canonico: "JAIDER MEDINA - FOOD SERVICE NORTE",
    display_name: "Jaider Medina (Food Service Norte)",
    ruta_oficial: "JAIDER MEDINA - FOOD SERVICE NORTE",
    aliases: ["JAIDER MEDINA - FOOD SERVICE NORTE", "JAIDER MEDINA", "FOOD SERVICE NORTE"],
    supervisor: "JOHNATAN SOTO",
    zona: "Food Service Norte",
    region: "Supervisi\xF3n Johnatan Soto",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: false,
    meta_activacion: 30,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "57",
    codigo_erp: "57",
    nombre_canonico: "FOOD SERVICE SENIOR - JUAN HERNANDEZ",
    display_name: "Food Service Senior (Juan Hern\xE1ndez)",
    ruta_oficial: "FOOD SERVICE SENIOR - JUAN HERNANDEZ",
    aliases: ["FOOD SERVICE SENIOR - JUAN HERNANDEZ", "FOOD SERVICE SENIOR"],
    supervisor: "JOHNATAN SOTO",
    zona: "Food Service Senior",
    region: "Supervisi\xF3n Johnatan Soto",
    role: "VENDEDOR",
    is_supervisor_route: false,
    incluir_en_volumen: false,
    meta_activacion: 58,
    meta_volumen: 0,
    activo: true
  },
  // =========================================================================
  // PERFILES DE LOS 3 SUPERVISORES COMERCIALES OFICIALES
  // =========================================================================
  {
    vendedor_id: "SUPERVISOR_JOHNATAN_SOTO",
    codigo_erp: "SUP-01",
    nombre_canonico: "JOHNATAN SOTO",
    display_name: "Johnatan Soto (Supervisor)",
    ruta_oficial: "SUPERVISOR JOHNATAN SOTO",
    aliases: ["SUPERVISOR:JOHNATAN SOTO"],
    supervisor: "JOHNATAN SOTO",
    zona: "Occidente / Perij\xE1 / Maracaibo",
    region: "Supervisi\xF3n Johnatan Soto",
    role: "SUPERVISOR",
    is_supervisor_route: true,
    incluir_en_volumen: false,
    meta_activacion: 0,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "SUPERVISOR_ALI_PEREZ",
    codigo_erp: "SUP-02",
    nombre_canonico: "ALI PEREZ",
    display_name: "Al\xED P\xE9rez (Supervisor)",
    ruta_oficial: "SUPERVISOR ALI PEREZ",
    aliases: ["SUPERVISOR:ALI PEREZ", "AL\xCD P\xC9REZ"],
    supervisor: "ALI PEREZ",
    zona: "Falc\xF3n / Punto Fijo / Coro",
    region: "Supervisi\xF3n Ali Perez",
    role: "SUPERVISOR",
    is_supervisor_route: true,
    incluir_en_volumen: false,
    meta_activacion: 0,
    meta_volumen: 0,
    activo: true
  },
  {
    vendedor_id: "SUPERVISOR_NELSON_FINOL",
    codigo_erp: "SUP-03",
    nombre_canonico: "NELSON FINOL",
    display_name: "Nelson Finol (Supervisor)",
    ruta_oficial: "SUPERVISOR NELSON FINOL",
    aliases: ["SUPERVISOR:NELSON FINOL"],
    supervisor: "NELSON FINOL",
    zona: "Maracaibo / COL / Cuentas Clave",
    region: "Supervisi\xF3n Nelson Finol",
    role: "SUPERVISOR",
    is_supervisor_route: true,
    incluir_en_volumen: false,
    meta_activacion: 0,
    meta_volumen: 0,
    activo: true
  }
];
var runtimeSellerCatalog = [...OFFICIAL_MASTER_VENDEDORES_SEED];
var runtimeAliasLookup = /* @__PURE__ */ new Map();
function rebuildRuntimeAliasIndex() {
  runtimeAliasLookup.clear();
  for (const s of runtimeSellerCatalog) {
    if (!s.is_supervisor_route) {
      runtimeAliasLookup.set(normalizeCatalogAsciiKey(s.nombre_canonico), s);
      runtimeAliasLookup.set(normalizeCatalogAsciiKey(s.ruta_oficial), s);
      runtimeAliasLookup.set(normalizeCatalogAsciiKey(s.display_name), s);
      for (const alias of s.aliases || []) {
        runtimeAliasLookup.set(normalizeCatalogAsciiKey(alias), s);
      }
    }
  }
}
rebuildRuntimeAliasIndex();
function hydrateRuntimeSellerCatalog(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return runtimeSellerCatalog;
  }
  const byCanonical = /* @__PURE__ */ new Map();
  for (const seed of OFFICIAL_MASTER_VENDEDORES_SEED) {
    byCanonical.set(
      `${seed.is_supervisor_route ? "SUP::" : "VEN::"}${sanitizeCatalogUpper(seed.nombre_canonico)}`,
      { ...seed, aliases: [...seed.aliases] }
    );
  }
  for (const raw of rows) {
    const canon = sanitizeCatalogUpper(raw.nombre_canonico || raw.ruta_oficial || raw.display_name);
    if (!canon) continue;
    const isSup = Boolean(raw.is_supervisor_route) || sanitizeCatalogUpper(raw.role) === "SUPERVISOR";
    const key = `${isSup ? "SUP::" : "VEN::"}${canon}`;
    const existing = byCanonical.get(key);
    const rawAliases = Array.isArray(raw.aliases) ? raw.aliases.map((a) => sanitizeCatalogUpper(a)).filter(Boolean) : [];
    if (existing) {
      const mergedAliases = Array.from(/* @__PURE__ */ new Set([...existing.aliases, ...rawAliases, canon]));
      byCanonical.set(key, {
        ...existing,
        vendedor_id: sanitizeCatalogText(raw.vendedor_id) || existing.vendedor_id,
        codigo_erp: sanitizeCatalogText(raw.codigo_erp) || existing.codigo_erp,
        nombre_canonico: canon,
        display_name: sanitizeCatalogText(raw.display_name) || existing.display_name,
        ruta_oficial: sanitizeCatalogUpper(raw.ruta_oficial) || existing.ruta_oficial,
        aliases: mergedAliases,
        supervisor: sanitizeCatalogUpper(raw.supervisor) || existing.supervisor,
        zona: sanitizeCatalogText(raw.zona) || existing.zona,
        region: sanitizeCatalogText(raw.region) || existing.region,
        role: sanitizeCatalogUpper(raw.role) || existing.role,
        is_supervisor_route: isSup,
        incluir_en_volumen: typeof raw.incluir_en_volumen === "boolean" ? raw.incluir_en_volumen : existing.incluir_en_volumen,
        meta_activacion: Number(raw.meta_activacion) > 0 ? Number(raw.meta_activacion) : existing.meta_activacion,
        meta_volumen: Number(raw.meta_volumen) > 0 ? Number(raw.meta_volumen) : existing.meta_volumen,
        email: sanitizeCatalogText(raw.email) || existing.email,
        activo: typeof raw.activo === "boolean" ? raw.activo : existing.activo
      });
    } else {
      byCanonical.set(key, {
        vendedor_id: sanitizeCatalogText(raw.vendedor_id) || canon,
        codigo_erp: sanitizeCatalogText(raw.codigo_erp) || "",
        nombre_canonico: canon,
        display_name: sanitizeCatalogText(raw.display_name) || canon,
        ruta_oficial: sanitizeCatalogUpper(raw.ruta_oficial) || canon,
        aliases: Array.from(/* @__PURE__ */ new Set([canon, ...rawAliases])),
        supervisor: sanitizeCatalogUpper(raw.supervisor) || "NELSON FINOL",
        zona: sanitizeCatalogText(raw.zona) || "Maracaibo",
        region: sanitizeCatalogText(raw.region) || "OCCIDENTE",
        role: isSup ? "SUPERVISOR" : "VENDEDOR",
        is_supervisor_route: isSup,
        incluir_en_volumen: typeof raw.incluir_en_volumen === "boolean" ? raw.incluir_en_volumen : !isSup,
        meta_activacion: Number(raw.meta_activacion) || 0,
        meta_volumen: Number(raw.meta_volumen) || 0,
        email: sanitizeCatalogText(raw.email) || void 0,
        activo: typeof raw.activo === "boolean" ? raw.activo : true
      });
    }
  }
  runtimeSellerCatalog = Array.from(byCanonical.values());
  rebuildRuntimeAliasIndex();
  return runtimeSellerCatalog;
}
function getRuntimeSellerCatalog() {
  return runtimeSellerCatalog;
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
function normalizeCuentasClavesVendor(vendorName) {
  const u = String(vendorName || "").replace(/\s+/g, " ").trim().toUpperCase();
  if (u === "MARIANA CHACIN" || u === "MARIANA CHAC\xCDN" || u === "CUENTAS CLAVE 1" || u === "CUENTAS CLAVES 1" || u === "CUENTAS CLAVE 1 - MC" || u === "CUENTAS CLAVES 1 - MC") {
    return { id: "CUENTAS CLAVES 1 - MC", display: "Cuentas claves 1 - MC" };
  }
  if (u === "SAIRU VALLES" || u === "SAIR\xDA VALLES" || u === "CUENTAS CLAVE 2" || u === "CUENTAS CLAVES 2" || u === "CUENTAS CLAVE 2 - SV" || u === "CUENTAS CLAVES 2 - SV") {
    return { id: "CUENTAS CLAVES 2 - SV", display: "Cuentas claves 2 - SV" };
  }
  return null;
}
function formatVolumenVendorDisplay(vendorName) {
  const cc = normalizeCuentasClavesVendor(vendorName);
  if (cc) {
    return {
      finalVendedorId: cc.id,
      finalVendedorNombre: cc.display
    };
  }
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
function extractSheetRows(XLSX2, sheet) {
  if (!sheet) return [];
  return XLSX2.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: true,
    raw: true
  });
}
function parseWorkbookFull(XLSX2, workbook, options) {
  const { periodo, masterClients = [], ventasMes = [] } = options;
  const warnings = [];
  const metrics = {};
  const volumenSupabaseRows = [];
  const volumenApiRows = [];
  const volResolved = resolveSheetByAliases(workbook, ["volumen_por_sku"], ["volumen", "sku"]);
  if (volResolved) {
    const rows = extractSheetRows(XLSX2, volResolved.sheet);
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
            const ccVol = normalizeCuentasClavesVendor(block.vendorName);
            const canonicalBlockVendor = ccVol ? ccVol.id : block.vendorName;
            volumenSupabaseRows.push({
              periodo,
              sku,
              articulo,
              categoria: cat,
              vendedor_id: canonicalBlockVendor,
              vendedor_nombre: canonicalBlockVendor,
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
    const rows = extractSheetRows(XLSX2, resolved.sheet);
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
      let prevCajas = -1;
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
        if (tabMetric.validRecordsRead >= 50 && prevCajas >= 15 && cajas > 0 && cajas <= prevCajas * 0.05) {
          break;
        }
        if (cajas > 0) {
          prevCajas = cajas;
        }
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
  const unirMapas = (a, b) => {
    const out = new Map(a);
    b.forEach((v, k) => out.set(k, +((out.get(k) || 0) + v).toFixed(4)));
    return out;
  };
  const ventasMesPorRubro = (rubro) => {
    const acc = /* @__PURE__ */ new Map();
    for (const v of ventasMes) {
      const cajas = Number(v.cajas) || 0;
      if (cajas <= 0) continue;
      if (clasificarRubro(v.id_articulo, v.articulo) !== rubro) continue;
      const { rawClean, canonical } = normalizeClientCode(v.id_cliente);
      if (!canonical) continue;
      acc.set(canonical, +((acc.get(canonical) || 0) + cajas).toFixed(4));
      if (rawClean && rawClean !== canonical) acc.set(rawClean, acc.get(canonical));
    }
    return acc;
  };
  const productMaps = {
    ACEITE: readProductPurchaseSheet(["aceite"], ["aceite"]),
    AZUCAR: readProductPurchaseSheet(["azucar"], ["azucar"]),
    POLLO: readProductPurchaseSheet(["pollo"], ["pollo"]),
    ESTANDAR_ASTURIAS: readProductPurchaseSheet(["jamon_asturias", "estandar_asturias"], ["jamon", "asturias"]),
    MORTADELA_SALPICAO: readProductPurchaseSheet(["enteros_ligeros", "mortadela_salpicao"], ["ligeros", "salpicao", "mortadela"]),
    // Rubros activos desde Noviembre 2026
    LECHE_VENCAMPO: unirMapas(readProductPurchaseSheet(["leche", "leche_vencampo", "leche_en_polvo_vencampo"], ["leche"]), ventasMesPorRubro("LECHE_VENCAMPO")),
    MORTADELA_ASTURIAS: unirMapas(readProductPurchaseSheet(["mortadela_asturias"], []), ventasMesPorRubro("MORTADELA_ASTURIAS")),
    SALPICAO: unirMapas(readProductPurchaseSheet(["salpicao"], []), ventasMesPorRubro("SALPICAO"))
  };
  const actResolved = resolveSheetByAliases(
    workbook,
    ["activacion_por_cliente", "clientes"],
    ["activacion_por_cliente", "activacion_cliente"]
  );
  const sheetClientsByCanonical = /* @__PURE__ */ new Map();
  if (actResolved) {
    const rows = extractSheetRows(XLSX2, actResolved.sheet);
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
          salpicao: ["mortadela_salpicao_y_asturias", "enteros_ligeros", "mortadela_salpicao"],
          leche: ["leche_en_polvo_vencampo", "leche_vencampo", "leche"],
          mortadelaAsturias: ["mortadela_asturias"]
        },
        {
          codigo: 0,
          razonSocial: 1,
          vendedor: 2,
          aceite: 3,
          azucar: 4,
          pollo: 5,
          asturias: 6,
          salpicao: 7,
          leche: -1,
          mortadelaAsturias: -1
        }
      );
      const salpicaoNuevoIdx = (rows[0] || []).map(normalizeHeaderKey).indexOf("salpicao");
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
        const flagLeche = cols.leche >= 0 ? parseTruthySheetFlag(row[cols.leche]) : false;
        const flagMortadelaAsturias = cols.mortadelaAsturias >= 0 ? parseTruthySheetFlag(row[cols.mortadelaAsturias]) : false;
        const flagSalpicaoNuevo = salpicaoNuevoIdx >= 0 ? parseTruthySheetFlag(row[salpicaoNuevoIdx]) : false;
        const ccSheet = normalizeCuentasClavesVendor(rawVendor);
        const mappedVendor = ccSheet ? ccSheet.id : rawVendor.toUpperCase() === "FOOD SERVICE NORTE" ? "JAIDER MEDINA - FOOD SERVICE NORTE" : rawVendor;
        if (sheetClientsByCanonical.has(canonical)) {
          const prev = sheetClientsByCanonical.get(canonical);
          prev.flagAceite = prev.flagAceite || flagAceite;
          prev.flagAzucar = prev.flagAzucar || flagAzucar;
          prev.flagPollo = prev.flagPollo || flagPollo;
          prev.flagAsturias = prev.flagAsturias || flagAsturias;
          prev.flagSalpicao = prev.flagSalpicao || flagSalpicao;
          prev.flagLeche = prev.flagLeche || flagLeche;
          prev.flagMortadelaAsturias = prev.flagMortadelaAsturias || flagMortadelaAsturias;
          prev.flagSalpicaoNuevo = prev.flagSalpicaoNuevo || flagSalpicaoNuevo;
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
          flagSalpicao,
          flagLeche,
          flagMortadelaAsturias,
          flagSalpicaoNuevo
        });
      }
    }
    metrics[actResolved.sheetName] = tabMetric;
  }
  const mergedClientsMap = /* @__PURE__ */ new Map();
  for (const mc of masterClients) {
    const rawCodeClean = String(mc.cliente_codigo || "").replace(/#\d+$/, "").trim();
    const { rawClean, canonical } = normalizeClientCode(rawCodeClean);
    if (!canonical) continue;
    const rawVId = String(mc.vendedor_id || mc.vendedor_nombre || "").replace(/\s+/g, " ").trim();
    if (rawVId.toUpperCase().startsWith("INACTIVO_MAESTRA::")) continue;
    const rawVNombre = String(mc.vendedor_nombre || mc.vendedor_id || "").replace(/\s+/g, " ").trim();
    const ccMc = normalizeCuentasClavesVendor(rawVNombre) || normalizeCuentasClavesVendor(rawVId);
    const vIdClean = ccMc ? ccMc.id : rawVId;
    const vNombreClean = ccMc ? ccMc.id : rawVNombre;
    const compositeKey = `${normalizeVendorName(vNombreClean)}::${canonical}`;
    const sheetMatch = sheetClientsByCanonical.get(canonical);
    if (!mergedClientsMap.has(compositeKey)) {
      mergedClientsMap.set(compositeKey, {
        dbId: mc.id,
        codigo: String(mc.cliente_codigo || rawClean || canonical).trim(),
        canonical,
        razonSocial: String(mc.cliente_nombre || sheetMatch?.razonSocial || "").trim(),
        vendedorId: vIdClean,
        vendedorNombre: vNombreClean,
        isNewFromSheet: false,
        sheetFlags: sheetMatch
      });
    }
  }
  if (masterClients.length === 0) {
    for (const [canonical, sc] of sheetClientsByCanonical.entries()) {
      const compositeKey = `${normalizeVendorName(sc.vendedor)}::${canonical}`;
      if (mergedClientsMap.has(compositeKey)) continue;
      if (sc.vendedor.toUpperCase() === "ALI PEREZ") continue;
      mergedClientsMap.set(compositeKey, {
        codigo: sc.rawCode || canonical,
        canonical,
        razonSocial: sc.razonSocial,
        vendedorId: sc.vendedor,
        vendedorNombre: sc.vendedor,
        isNewFromSheet: true,
        sheetFlags: sc
      });
    }
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
    const cLeche = productMaps.LECHE_VENCAMPO.get(c.canonical) || productMaps.LECHE_VENCAMPO.get(c.codigo) || 0;
    const cMortAst = productMaps.MORTADELA_ASTURIAS.get(c.canonical) || productMaps.MORTADELA_ASTURIAS.get(c.codigo) || 0;
    const cSalpNuevo = productMaps.SALPICAO.get(c.canonical) || productMaps.SALPICAO.get(c.codigo) || 0;
    const hasAceite = cAceite > 0 || Boolean(c.sheetFlags?.flagAceite);
    const hasAzucar = cAzucar > 0 || Boolean(c.sheetFlags?.flagAzucar);
    const hasPollo = cPollo > 0 || Boolean(c.sheetFlags?.flagPollo);
    const hasAsturias = cAsturias > 0 || Boolean(c.sheetFlags?.flagAsturias);
    const hasSalpicao = cSalpicao > 0 || Boolean(c.sheetFlags?.flagSalpicao);
    const hasLeche = cLeche > 0 || Boolean(c.sheetFlags?.flagLeche);
    const hasMortAst = cMortAst > 0 || Boolean(c.sheetFlags?.flagMortadelaAsturias);
    const hasSalpNuevo = cSalpNuevo > 0 || Boolean(c.sheetFlags?.flagSalpicaoNuevo);
    const isActivo = hasAzucar || hasLeche || hasPollo || hasAsturias || hasSalpicao;
    const vNorm = normalizeVendorName(c.vendedorNombre || c.vendedorId);
    if (!clientActByVendor.has(vNorm)) {
      clientActByVendor.set(vNorm, {
        ACEITE: 0,
        "AZ\xDACAR": 0,
        AZUCAR: 0,
        POLLO: 0,
        "ESTANDAR Y SUPERIOR ASTURIAS": 0,
        "MORTADELA SALPICAO Y ASTURIAS": 0,
        "LECHE VENCAMPO": 0,
        "MORTADELA ASTURIAS": 0,
        SALPICAO: 0
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
    if (hasLeche) vCounts["LECHE VENCAMPO"]++;
    if (hasMortAst) vCounts["MORTADELA ASTURIAS"]++;
    if (hasSalpNuevo) vCounts.SALPICAO++;
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
      has_mortadela_salpicao: hasSalpicao,
      // Rubros nuevos (requieren scripts/sql/03_rubros_noviembre_2026.sql; el servidor las omite si la BD aún no las tiene)
      cajas_leche_vencampo: cLeche,
      cajas_mortadela_asturias: cMortAst,
      cajas_salpicao: cSalpNuevo,
      has_leche_vencampo: hasLeche,
      has_mortadela_asturias: hasMortAst,
      has_salpicao: hasSalpNuevo
    };
    if (c.dbId !== void 0) {
      activacionSupabaseUpserts.push(supaPayload);
    } else if (c.isNewFromSheet) {
      newSheetClientsForSupabase.push(supaPayload);
    }
    const ccAct = normalizeCuentasClavesVendor(c.vendedorNombre) || normalizeCuentasClavesVendor(c.vendedorId);
    const vendUpper = c.vendedorId.toUpperCase();
    const isVilla = vendUpper.includes("VILLA");
    const isJohnatanOrMikel = vendUpper.includes("JOHNATAN") || vendUpper.includes("MIKELANGELO") || vendUpper.includes("SOTO");
    const displayVendedorNombre = ccAct ? ccAct.display : isJohnatanOrMikel ? isVilla ? "Mikelangelo Diaz (Villa del Rosario)" : "Mikelangelo Diaz (Principal)" : c.vendedorNombre;
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
        LECHE_VENCAMPO: hasLeche,
        MORTADELA_ASTURIAS: hasMortAst,
        SALPICAO: hasSalpNuevo,
        ARROZ: hasPollo,
        ENTERO: hasAsturias,
        LIGEROS: hasSalpicao
      },
      cajas: {
        ACEITE: cAceite,
        AZUCAR: cAzucar,
        POLLO: cPollo,
        ESTANDAR_ASTURIAS: cAsturias,
        MORTADELA_SALPICAO: cSalpicao,
        LECHE_VENCAMPO: cLeche,
        MORTADELA_ASTURIAS: cMortAst,
        SALPICAO: cSalpNuevo
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
    const rows = extractSheetRows(XLSX2, gridResolved.sheet);
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
      const findCategoryCols = (catKeywords, fallbackMeta, fallbackAct, exact = false) => {
        const matches = (cell, kw) => exact ? cell === kw : cell === kw || cell.includes(kw);
        const maxCols = Math.max(h0.length, h1.length);
        for (let c = 0; c < maxCols; c++) {
          const cell0 = h0[c] || "";
          if (cell0 && catKeywords.some((kw) => matches(cell0, kw))) {
            return { metaIdx: c, actIdx: c + 1 };
          }
        }
        for (let c = 0; c < maxCols; c++) {
          const cell1 = h1[c] || "";
          if (cell1.startsWith("meta") && catKeywords.some((kw) => exact ? cell1 === `meta_${kw}` : cell1.includes(kw))) {
            return { metaIdx: c, actIdx: c + 1 };
          }
        }
        return { metaIdx: fallbackMeta, actIdx: fallbackAct };
      };
      const GRID_KEYWORDS = {
        AZUCAR: { kw: ["azucar"], fallbackMeta: 2, fallbackAct: 3 },
        LECHE_VENCAMPO: { kw: ["leche_vencampo", "leche_en_polvo_vencampo", "leche"], fallbackMeta: 4, fallbackAct: 5 },
        POLLO: { kw: ["pollo", "arroz"], fallbackMeta: 6, fallbackAct: 7 },
        ESTANDAR_ASTURIAS: { kw: ["estandar", "superior"], fallbackMeta: 8, fallbackAct: 9 },
        MORTADELA_SALPICAO: { kw: ["mortadela_salpicao", "mortadela", "salpicao", "ligeros"], fallbackMeta: 10, fallbackAct: 11 }
      };
      const catDefs = RUBROS_ACTIVOS_CONFIG.map((r) => {
        const g = GRID_KEYWORDS[r.codigo] || { kw: [r.categoriaServidor.toLowerCase()], fallbackMeta: -1, fallbackAct: -1 };
        return { name: r.categoriaServidor, ...findCategoryCols(g.kw, g.fallbackMeta, g.fallbackAct, g.exact) };
      });
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
          if (cDef.actIdx < 0 && liveCounts && liveCounts[cDef.name] !== void 0) {
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
        for (const cat of RUBROS_ACTIVOS_CONFIG.map((r) => r.categoriaServidor)) {
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
    const rows = extractSheetRows(XLSX2, usrResolved.sheet);
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
    const rows = extractSheetRows(XLSX2, degResolved.sheet);
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
  const XLSX2 = await import("xlsx");
  const sheetId = getGoogleSheetId();
  try {
    const exportUrl = buildGoogleSheetExportUrl(sheetId, "xlsx");
    const buffer = await fetchGoogleSheetWithRetry(exportUrl, 3);
    cachedWorkbook = XLSX2.read(buffer, { type: "array", raw: true });
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
      cachedWorkbook = XLSX2.readFile(localPath);
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
  const ruteroFilePath = import_path.default.resolve(process.cwd(), "rutero_state.json");
  let ruteroStateInMemory = {
    asignaciones: {},
    visitas: {}
  };
  try {
    if (import_fs.default.existsSync(ruteroFilePath)) {
      const parsedRutero = JSON.parse(import_fs.default.readFileSync(ruteroFilePath, "utf8"));
      if (parsedRutero && typeof parsedRutero === "object") {
        ruteroStateInMemory = {
          asignaciones: parsedRutero.asignaciones || {},
          visitas: parsedRutero.visitas || {}
        };
      }
    }
  } catch (err) {
    console.warn("[RUTERO] No se pudo cargar rutero_state.json inicial:", err?.message);
  }
  function persistRuteroStateDisk() {
    try {
      import_fs.default.writeFileSync(ruteroFilePath, JSON.stringify(ruteroStateInMemory, null, 2), "utf8");
    } catch (err) {
      console.warn("[RUTERO] Error guardando rutero_state.json:", err?.message);
    }
  }
  app2.get("/api/rutero", authenticateToken, (req, res) => {
    try {
      res.json({
        success: true,
        asignaciones: ruteroStateInMemory.asignaciones,
        visitas: ruteroStateInMemory.visitas
      });
    } catch (err) {
      res.status(500).json({ success: false, error: "Error obteniendo rutero", details: err?.message });
    }
  });
  app2.post("/api/rutero/asignaciones", authenticateToken, (req, res) => {
    try {
      const items = Array.isArray(req.body?.asignaciones) ? req.body.asignaciones : [];
      for (const item of items) {
        if (item && item.clienteKey) {
          ruteroStateInMemory.asignaciones[item.clienteKey] = {
            ...item,
            updatedAt: item.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
          };
        }
      }
      persistRuteroStateDisk();
      res.json({
        success: true,
        count: items.length
      });
    } catch (err) {
      res.status(500).json({ success: false, error: "Error guardando asignaciones de ruta", details: err?.message });
    }
  });
  app2.post("/api/rutero/visitas", authenticateToken, (req, res) => {
    try {
      const visita = req.body?.visita;
      if (!visita || !visita.fecha || !visita.clienteKey) {
        return res.status(400).json({ success: false, error: "Datos de visita incompletos (fecha, clienteKey)" });
      }
      const visitKey = `${visita.fecha}::${visita.clienteKey}`;
      if (visita.estado === "PENDIENTE") {
        delete ruteroStateInMemory.visitas[visitKey];
      } else {
        ruteroStateInMemory.visitas[visitKey] = {
          ...visita,
          id: visita.id || visitKey,
          checkInTimestamp: visita.checkInTimestamp || (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      persistRuteroStateDisk();
      res.json({
        success: true,
        visita: ruteroStateInMemory.visitas[visitKey] || null
      });
    } catch (err) {
      res.status(500).json({ success: false, error: "Error registrando visita en ruta", details: err?.message });
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
      const isForbiddenAlpha = /^(LPV|UTH|UHT|QS|JUGOS)$/i.test(rawCod);
      const desc = limpiarDescripcionAlkosto((rawDesc || "PRODUCTO").toUpperCase());
      const productoOficial = matchProductoCodizulca(isForbiddenAlpha ? "" : rawCod, desc);
      const hasExactOficial = productoOficial.matchExacto !== false && productoOficial.codigo !== "S/C" && productoOficial.codigo !== "PENDIENTE";
      const resolvedProd = hasExactOficial ? null : resolverProductoBackend(isForbiddenAlpha ? "" : rawCod, desc);
      const hasExactCatalogMatch = Boolean(hasExactOficial || resolvedProd);
      const cleanCod = (hasExactOficial ? productoOficial.codigo : "") || (resolvedProd && !/^(LPV|UTH|UHT|QS|JUGOS)$/i.test(resolvedProd.sku) ? resolvedProd.sku : "") || (!isForbiddenAlpha && rawCod && rawCod !== "S/C" && !(!hasExactCatalogMatch && /^\d{8,14}$/.test(rawCod)) ? rawCod : "") || "PENDIENTE";
      const cleanDesc = hasExactCatalogMatch ? (hasExactOficial ? productoOficial.descripcion : "") || (resolvedProd ? resolvedProd.nombre : "") || desc : String(rawDesc || desc || "PRODUCTO").trim().toUpperCase();
      const cant = toSafeNumber(
        it.cantidad ?? it.cantidad_solicitada ?? it.cantidadCajas ?? it.cantSolicitada ?? it.bultos ?? it.cajas ?? it.unidades ?? it.kilos
      );
      if (!Number.isFinite(cant) || Number.isNaN(cant) || cant <= 0) {
        return null;
      }
      const precioBruto = toSafeNumber(
        it.precio_bruto ?? it.precioBrutoUSD ?? it.costoBruto
      );
      const descuentoRaw = Math.max(0, toSafeNumber(it.descuento));
      let precio = toSafeNumber(
        it.valorUnitarioOC ?? it.precio_unitario ?? it.precioUnitarioUSD ?? it.precio
      );
      if (precio <= 0 && precioBruto > 0 && descuentoRaw > 0 && descuentoRaw <= 100) {
        precio = Number((precioBruto * (1 - descuentoRaw / 100)).toFixed(4));
      }
      const descuentoEfectivo = descuentoRaw > 0 ? Number(descuentoRaw.toFixed(2)) : precioBruto > precio && precio > 0 ? Number(((precioBruto - precio) / precioBruto * 100).toFixed(2)) : 0;
      const sub = precio > 0 ? Number((cant * precio).toFixed(2)) : Number(
        Math.max(
          0,
          toSafeNumber(it.subtotal ?? it.subtotalUSD ?? it.sub_total)
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
        descripcion: cleanDesc,
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
      orden_compra: numeroOcClean,
      orden_de_compra: numeroOcClean,
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
      throw lastExternalErr || new AlkostoHttpError(
        502,
        `No se pudo confirmar la inserci\xF3n del pedido N\xB0 ${correlativo} (${sucursalClienteClean}) en Supabase Sala de Espera.`
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
    { sku: "301", nombre: "ACEITE VEGETAL COMESTIBLE 12X1LT", barcode: "", chainCodes: ["301", "ACEITE"], unid: "CJ" },
    { sku: "302", nombre: "MANTEQUILLA CON SAL PURISIMA BARRA 18X200GR", barcode: "", chainCodes: ["302"], unid: "CJ" },
    { sku: "303", nombre: "ARROZ BLANCO ESPECIAL 24X1KG", barcode: "", chainCodes: ["303", "ARROZ"], unid: "CJ" },
    { sku: "401", nombre: "HUEVOS BLANCOS SELECCIONADOS", barcode: "", chainCodes: ["401", "HUEVOS"], unid: "CJ" },
    { sku: "1569", nombre: "PATATAS FRESCAS DOBLE COBERTURA 4X2.5KG", barcode: "", chainCodes: ["1569"], unid: "CJ" },
    { sku: "1536", nombre: "LECHE EN POLVO VENCAMPO 10X1KG", barcode: "", chainCodes: ["1536"], unid: "CJ" },
    { sku: "1556", nombre: "LECHE EN POLVO VENCAMPO 10X900GR", barcode: "7590377000510", chainCodes: ["1556", "7590377000510"], unid: "CJ" },
    { sku: "1574", nombre: "LECHE EN POLVO VENCAMPO 10X400GR", barcode: "7590377000503", chainCodes: ["1574", "7590377000503"], unid: "CJ" },
    { sku: "1579", nombre: "LECHE EN POLVO VENCAMPO 10X500GR", barcode: "", chainCodes: ["1579"], unid: "CJ" },
    { sku: "1642", nombre: "ARVEJAS VENCAMPO 25 UND X 400GR", barcode: "7590377000411", chainCodes: ["1642", "001642", "7590377000411"], unid: "CJ" },
    { sku: "1644", nombre: "CARAOTAS NEGRAS VENCAMPO 25 UND X 400GR", barcode: "7590377000459", chainCodes: ["1644", "001644", "7590377000459"], unid: "CJ" },
    { sku: "1572", nombre: "CAJAS DE PIZZA 1X100", barcode: "", chainCodes: ["1572"], unid: "BLT" },
    ...PRODUCTOS_CODIZULCA.map((p) => ({
      sku: p.codigo,
      nombre: p.descripcion,
      barcode: "",
      chainCodes: [p.codigo],
      unid: /\b(X\s*KG|POR\s*KG|A\s+GRANEL)\b/i.test(p.descripcion) ? "KG" : "CJ"
    }))
  ];
  function resolverProductoBackend(codInput, descInput) {
    const rawCod = String(codInput || "").trim();
    const isForbiddenAlpha = /^(LPV|UTH|UHT|QS|JUGOS)$/i.test(rawCod);
    const cleanCod = isForbiddenAlpha ? "" : rawCod.replace(/[\s\-_.]/g, "").toUpperCase();
    const cleanDesc = String(descInput || "").trim().toUpperCase();
    const prodOficial = matchProductoCodizulca(cleanCod, cleanDesc);
    if (prodOficial.matchExacto !== false && prodOficial.codigo !== "S/C" && prodOficial.codigo !== "PENDIENTE") {
      const dictEntry = MASTER_PRODUCTOS_DICT.find((p) => p.sku === prodOficial.codigo);
      return {
        sku: prodOficial.codigo,
        nombre: prodOficial.descripcion,
        barcode: dictEntry?.barcode || "",
        chainCodes: dictEntry?.chainCodes || [prodOficial.codigo],
        unid: dictEntry?.unid || (/\b(X\s*KG|POR\s*KG|A\s+GRANEL)\b/i.test(prodOficial.descripcion) ? "KG" : "CJ")
      };
    }
    if (cleanCod) {
      const match = MASTER_PRODUCTOS_DICT.find(
        (p) => p.barcode && p.barcode.replace(/[\s\-_.]/g, "") === cleanCod && (!cleanDesc || !hasPrimaryNounConflict(p.nombre, cleanDesc))
      );
      if (match) return match;
    }
    if (cleanCod && cleanCod !== "PENDIENTE" && cleanCod !== "S/C") {
      const match = MASTER_PRODUCTOS_DICT.find(
        (p) => p.sku.toUpperCase() === cleanCod && (!cleanDesc || !hasPrimaryNounConflict(p.nombre, cleanDesc))
      );
      if (match) return match;
    }
    if (cleanCod && cleanCod !== "PENDIENTE" && cleanCod !== "S/C") {
      const match = MASTER_PRODUCTOS_DICT.find(
        (p) => p.chainCodes && p.chainCodes.some((c) => c.toUpperCase() === cleanCod) && (!cleanDesc || !hasPrimaryNounConflict(p.nombre, cleanDesc))
      );
      if (match) return match;
    }
    if (cleanCod.length >= 4 && /^\d+$/.test(cleanCod)) {
      return null;
    }
    if (cleanDesc) {
      const match = MASTER_PRODUCTOS_DICT.find((p) => {
        if (hasPrimaryNounConflict(p.nombre, cleanDesc)) return false;
        const pNorm = p.nombre.toUpperCase();
        return cleanDesc.includes(pNorm) || pNorm.includes(cleanDesc);
      });
      if (match) return match;
      const tokens = cleanDesc.split(/\s+/).filter((t) => t.length > 2 && !["POR", "CON", "DEL", "LOS", "LAS", "PARA"].includes(t) && !isBrandOrPresentationToken(t));
      if (tokens.length > 0) {
        const tokenMatch = MASTER_PRODUCTOS_DICT.find((p) => {
          if (hasPrimaryNounConflict(p.nombre, cleanDesc)) return false;
          const pNorm = p.nombre.toUpperCase();
          const required = tokens.length <= 2 ? tokens.length : Math.max(2, Math.ceil(tokens.length * 0.75));
          return tokens.filter((t) => pNorm.includes(t)).length >= required;
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
  app2.post("/api/alkosto/ocr-orden", rateLimiter(10 * 6e4, 30, "OCR Orden Alkosto"), async (req, res) => {
    req.setTimeout?.(12e4);
    res.setTimeout?.(12e4);
    let currentStage = "1-Archivo";
    try {
      const { imageBase64, mimeType = "image/jpeg", fileName = "" } = req.body || {};
      if (!imageBase64) {
        return res.status(400).json({
          error: "Error en Etapa [1-Archivo]: Falta la imagen (JPG, PNG, WEBP) o el archivo PDF de la Orden de Compra.",
          stage: "1-Archivo",
          code: "MISSING_FILE_PAYLOAD"
        });
      }
      const cleanBase64 = sanitizeBase64Payload(String(imageBase64));
      if (!cleanBase64) {
        return res.status(400).json({
          error: "Error en Etapa [1-Archivo]: El contenido Base64 del archivo est\xE1 vac\xEDo o tiene un formato inv\xE1lido.",
          stage: "1-Archivo",
          code: "EMPTY_BASE64_PAYLOAD"
        });
      }
      const binaryBuffer = Buffer.from(cleanBase64, "base64");
      if (!binaryBuffer || binaryBuffer.length < 32) {
        return res.status(400).json({
          error: "Error en Etapa [1-Archivo]: El archivo de la Orden de Compra est\xE1 vac\xEDo o corrupto.",
          stage: "1-Archivo",
          code: "CORRUPTED_FILE_BUFFER"
        });
      }
      const actualMime = detectAlkostoFileMimeType(binaryBuffer, mimeType, fileName);
      const isPdfPayload = actualMime === "application/pdf";
      console.log(
        `[ALKOSTO OCR] Iniciando procesamiento: fileName="${fileName || "N/A"}", declaredMime="${mimeType}", detectedMime="${actualMime}", sizeKB=${Math.round(binaryBuffer.length / 1024)}`
      );
      let deterministicOrder = null;
      if (isPdfPayload) {
        try {
          const positionedText = extractPositionedTextFromAlkostoPdfBuffer(binaryBuffer, import_zlib.default.inflateSync);
          if (positionedText) {
            const parsedDet = parseAlkostoRawText(positionedText);
            if (parsedDet && parsedDet.items.length > 0) {
              deterministicOrder = normalizeOrderForCodizulca(parsedDet);
              console.log(
                `[ALKOSTO OCR] Extracci\xF3n PDF determinista exitosa (coordenadas X,Y): OC=${deterministicOrder.ordenNro}, renglones=${deterministicOrder.items.length}`
              );
            }
          }
        } catch (pdfParseErr) {
          console.warn("[ALKOSTO OCR] Advertencia en lectura de coordenadas PDF:", pdfParseErr?.message);
        }
        if (!deterministicOrder) {
          try {
            const { PDFParse } = await import("pdf-parse");
            const pdfParser = new PDFParse({ data: binaryBuffer });
            try {
              const textRes = await pdfParser.getText();
              const rawPdfText = String(textRes?.text || "").trim();
              if (rawPdfText.length >= 30) {
                const parsedFlexible = parseAlkostoFlexibleOcrText(rawPdfText);
                if (parsedFlexible && parsedFlexible.items.length > 0) {
                  deterministicOrder = normalizeOrderForCodizulca(parsedFlexible);
                  console.log(
                    `[ALKOSTO OCR] Extracci\xF3n PDF v\xEDa pdf-parse exitosa: OC=${deterministicOrder.ordenNro}, renglones=${deterministicOrder.items.length}`
                  );
                }
              }
            } finally {
              await pdfParser.destroy().catch(() => {
              });
            }
          } catch (pdfFallbackErr) {
            console.warn("[ALKOSTO OCR] Advertencia en pdf-parse secundario:", pdfFallbackErr?.message);
          }
        }
      }
      const rawKeyCandidates = [
        process.env.GEMINI_API_KEY,
        process.env.GOOGLE_API_KEY,
        process.env.VITE_GEMINI_API_KEY,
        process.env.API_KEY
      ].filter(Boolean).flatMap((k) => String(k).split(",")).map((k) => k.trim().replace(/^["']+|["']+$/g, "").trim()).filter((k) => k.length > 10 && k !== "undefined" && k !== "null");
      const apiKeys = Array.from(new Set(rawKeyCandidates));
      if (deterministicOrder && Array.isArray(deterministicOrder.items) && deterministicOrder.items.length > 0) {
        const detCuadre = calcularResumenCuadreOC(deterministicOrder);
        if (detCuadre?.cuadreExacto || apiKeys.length === 0) {
          return res.json({
            success: true,
            parserMode: "DETERMINISTIC_PDF",
            data: deterministicOrder,
            canonical: toCanonicalAlkostoOcJson(deterministicOrder)
          });
        }
      }
      currentStage = "2-Conexi\xF3n Gemini-Render";
      const systemInstruction = buildAlkostoOcSystemPrompt();
      const prompt = `Analiza minuciosamente la imagen, captura o documento PDF adjunto correspondiente a una Orden de Compra de ALKOSTO y FAMILIA CENTER en todas sus p\xE1ginas. Devuelve \xDANICAMENTE el objeto JSON v\xE1lido consolidando las cantidades por tienda en las 17 tiendas v\xE1lidas (AK01-AK10 y FC01-FC07, ignorando AKOP y CI) y normalizando los montos num\xE9ricos sin comas de miles.`;
      let lastModelError = null;
      let validatedOrder = null;
      let usedModel = "";
      if (apiKeys.length > 0) {
        try {
          const geminiOut = await callGeminiWithFallback({
            base64Data: cleanBase64,
            mimeType: actualMime,
            fileName,
            apiKeys,
            systemInstruction,
            prompt
          });
          currentStage = "4-Mapeo Nota de Pedido";
          const candidateValidated = validateAndNormalizeAlkostoOC(geminiOut.parsedJson, {
            strictMath: false,
            requireOrdenNro: false
          });
          validatedOrder = normalizeOrderForCodizulca(candidateValidated);
          usedModel = geminiOut.usedModel;
          console.log(
            `[ALKOSTO OCR] Extracci\xF3n IA exitosa con ${usedModel}: OC=${validatedOrder.ordenNro}, renglones=${validatedOrder.items.length}`
          );
        } catch (mErr) {
          lastModelError = mErr;
          if (mErr instanceof AlkostoOcrStageError) {
            currentStage = mErr.stage;
          }
          console.warn(`[ALKOSTO OCR] Fallo en cascada Gemini (${currentStage}):`, mErr?.message);
        }
      }
      if (deterministicOrder) {
        const detCuadre = calcularResumenCuadreOC(deterministicOrder);
        const aiCuadre = validatedOrder ? calcularResumenCuadreOC(validatedOrder) : null;
        if (!validatedOrder || !aiCuadre?.cuadreExacto && detCuadre?.cuadreExacto || validatedOrder.items.length < deterministicOrder.items.length) {
          return res.json({
            success: true,
            parserMode: usedModel ? `AI_HYBRID_${usedModel}` : "DETERMINISTIC_PDF",
            data: deterministicOrder,
            canonical: toCanonicalAlkostoOcJson(deterministicOrder)
          });
        }
      }
      if (!validatedOrder) {
        try {
          if (actualMime.startsWith("image/")) {
            const TesseractMod = await import("tesseract.js");
            const recognizeFn = TesseractMod.recognize || TesseractMod.default?.recognize;
            if (typeof recognizeFn === "function") {
              const ocrOut = await recognizeFn(binaryBuffer, "spa");
              const ocrText = String(ocrOut?.data?.text || "").trim();
              if (ocrText) {
                const localParsed = parseAlkostoFlexibleOcrText(ocrText);
                if (localParsed && localParsed.items.length > 0) {
                  validatedOrder = normalizeOrderForCodizulca(localParsed);
                  usedModel = "LOCAL_TESSERACT_OCR";
                }
              }
            }
          } else if (isPdfPayload) {
            const { PDFParse } = await import("pdf-parse");
            const pdfParser = new PDFParse({ data: binaryBuffer });
            try {
              const imgRes = await pdfParser.getImage({ imageBuffer: true, first: 1 });
              const firstPageImgs = imgRes?.pages?.[0]?.images || [];
              if (firstPageImgs.length > 0 && firstPageImgs[0]?.data) {
                const TesseractMod = await import("tesseract.js");
                const recognizeFn = TesseractMod.recognize || TesseractMod.default?.recognize;
                if (typeof recognizeFn === "function") {
                  const ocrOut = await recognizeFn(Buffer.from(firstPageImgs[0].data), "spa");
                  const ocrText = String(ocrOut?.data?.text || "").trim();
                  if (ocrText) {
                    const localParsed = parseAlkostoFlexibleOcrText(ocrText);
                    if (localParsed && localParsed.items.length > 0) {
                      validatedOrder = normalizeOrderForCodizulca(localParsed);
                      usedModel = "LOCAL_PDF_TESSERACT_OCR";
                    }
                  }
                }
              }
            } finally {
              await pdfParser.destroy().catch(() => {
              });
            }
          }
        } catch (localErr) {
          console.warn("[ALKOSTO OCR] Advertencia en fallback OCR local:", localErr?.message);
        }
      }
      if (!validatedOrder) {
        const lastMsg = String(lastModelError?.message || "");
        const isAuthOrKeyError = apiKeys.length === 0 || /API_KEY_INVALID|API key not valid|reported as leaked|PERMISSION_DENIED|GEMINI_API_KEY/i.test(lastMsg);
        const isQuotaError = /RESOURCE_EXHAUSTED|prepayment credits|quota|billing|429/i.test(lastMsg);
        if (isAuthOrKeyError) {
          console.error("[ALKOSTO OCR] Error de configuraci\xF3n de clave Gemini API:", lastMsg.slice(0, 200));
          return res.status(503).json({
            error: "Error en Etapa [2-Conexi\xF3n Gemini-Render]: El servicio de IA no tiene una clave GEMINI_API_KEY activa para analizar im\xE1genes. Sube el archivo en formato PDF digital original de Alkosto o configura GEMINI_API_KEY en Render.",
            stage: "2-Conexi\xF3n Gemini-Render",
            code: "AI_API_KEY_UNAVAILABLE"
          });
        }
        if (isQuotaError) {
          console.error("[ALKOSTO OCR] Cuota agotada en Gemini API:", lastMsg.slice(0, 200));
          return res.status(503).json({
            error: "Error en Etapa [2-Conexi\xF3n Gemini-Render]: El servicio de lectura con IA alcanz\xF3 su l\xEDmite temporal de solicitudes. Intenta nuevamente en unos segundos o sube el PDF digital de la Orden de Compra.",
            stage: "2-Conexi\xF3n Gemini-Render",
            code: "AI_QUOTA_EXCEEDED"
          });
        }
        throw new AlkostoOcrStageError(
          currentStage,
          lastMsg || "No fue posible extraer renglones v\xE1lidos de la Orden de Compra. Aseg\xFArate de que la imagen o PDF sea legible."
        );
      }
      return res.json({
        success: true,
        parserMode: `AI_VALIDATED_${usedModel}`,
        data: normalizeOrderForCodizulca(validatedOrder),
        canonical: toCanonicalAlkostoOcJson(validatedOrder)
      });
    } catch (err) {
      const errStatus = err?.status || err?.statusCode || 500;
      const errMessage = String(err?.message || "Error desconocido");
      const stage = err instanceof AlkostoOcrStageError ? err.stage : err instanceof AlkostoParseValidationError ? "4-Mapeo Nota de Pedido" : /JSON|parse|llave/i.test(errMessage) ? "3-Parseo JSON" : currentStage || "2-Conexi\xF3n Gemini-Render";
      const formattedStageError = /^Error en Etapa \[/i.test(errMessage) ? errMessage : `Error en Etapa [${stage}]: ${errMessage}`;
      console.error("[ALKOSTO OCR] Error detallado procesando Orden de Compra:", {
        stage,
        statusCode: errStatus,
        name: err?.name,
        code: err?.code,
        message: formattedStageError.slice(0, 500)
      });
      if (err instanceof AlkostoParseValidationError) {
        return res.status(422).json({
          error: formattedStageError,
          stage: "4-Mapeo Nota de Pedido",
          code: err.code,
          issues: err.issues
        });
      }
      const isQuota = /RESOURCE_EXHAUSTED|prepayment credits|quota|billing|429/i.test(errMessage);
      const isKey = /API_KEY_INVALID|API key not valid|reported as leaked|PERMISSION_DENIED/i.test(errMessage);
      const isParse = /JSON|renglones|interpretar|legible/i.test(errMessage);
      if (isQuota || isKey) {
        return res.status(503).json({
          error: isKey ? "Error en Etapa [2-Conexi\xF3n Gemini-Render]: El motor de IA requiere actualizar la credencial GEMINI_API_KEY en el servidor. Puedes subir el PDF digital original de Alkosto o ingresar los datos manualmente." : "Error en Etapa [2-Conexi\xF3n Gemini-Render]: El lector autom\xE1tico (IA) est\xE1 temporalmente saturado. Por favor reintenta en unos segundos o sube el PDF digital.",
          stage: "2-Conexi\xF3n Gemini-Render",
          code: isKey ? "AI_KEY_INVALID" : "AI_QUOTA_EXCEEDED"
        });
      }
      if (isParse) {
        return res.status(422).json({
          error: formattedStageError,
          stage: "3-Parseo JSON",
          code: "OC_PARSE_ERROR"
        });
      }
      return res.status(500).json({
        error: formattedStageError,
        stage,
        code: "OC_PROCESSING_ERROR"
      });
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
  app2.post("/api/ocr", rateLimiter(10 * 6e4, 30, "OCR Bancario"), async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg", fileName = "" } = req.body || {};
      if (!imageBase64) {
        return res.status(400).json({ error: "Falta la imagen o PDF del comprobante de pago." });
      }
      const rawBase64Str = String(imageBase64).trim();
      const cleanBase64 = (rawBase64Str.includes(",") ? rawBase64Str.split(",")[1] : rawBase64Str).replace(/\s+/g, "");
      const binaryBuffer = Buffer.from(cleanBase64, "base64");
      if (!binaryBuffer || binaryBuffer.length < 32) {
        return res.status(400).json({ error: "El archivo del comprobante est\xE1 vac\xEDo o corrupto." });
      }
      const actualMime = detectReceiptMimeType(binaryBuffer, mimeType, fileName);
      const rawKeyCandidates = [
        process.env.GEMINI_API_KEY,
        process.env.GOOGLE_API_KEY,
        process.env.VITE_GEMINI_API_KEY,
        process.env.API_KEY
      ].filter(Boolean).flatMap((k) => String(k).split(",")).map((k) => k.trim().replace(/^["']+|["']+$/g, "").trim()).filter((k) => k.length > 10 && k !== "undefined" && k !== "null");
      const apiKeys = Array.from(new Set(rawKeyCandidates));
      let aiResult = null;
      let lastAiError = null;
      if (apiKeys.length > 0) {
        const geminiExtraction = await extractSupportWithGemini({
          apiKeys,
          base64Data: cleanBase64,
          mimeType: actualMime,
          fileName
        });
        const audited = geminiExtraction.audited;
        const hasCompleteAiFields = Boolean(
          audited && audited.banco && audited.monto_bs && audited.monto_bs > 0 && audited.referencia
        );
        if (audited && hasCompleteAiFields) {
          return res.json({
            ...audited,
            es_legible: true,
            legible: true,
            lectura_exitosa: true
          });
        }
        aiResult = audited;
        if (geminiExtraction.errorMessage) {
          lastAiError = new Error(geminiExtraction.errorMessage);
        }
      }
      const runSmartImageOcrWithAntiMoire = async (imgBuffer) => {
        const TesseractMod = await import("tesseract.js");
        const recognizeFn = TesseractMod.recognize || TesseractMod.default?.recognize;
        const createWorkerFn = TesseractMod.createWorker || TesseractMod.default?.createWorker;
        let pass1Result = null;
        let pass2Result = null;
        try {
          const canvasMod = await import("@napi-rs/canvas");
          const { createCanvas, loadImage } = canvasMod;
          const img = await loadImage(imgBuffer);
          const w = img.width;
          const h = img.height;
          const scale1 = w < 1e3 ? 2 : 1;
          const c1 = createCanvas(w * scale1, h * scale1);
          const ctx1 = c1.getContext("2d");
          ctx1.imageSmoothingEnabled = true;
          ctx1.drawImage(img, 0, 0, w * scale1, h * scale1);
          const d1 = ctx1.getImageData(0, 0, w * scale1, h * scale1);
          let meanLum = 0;
          const totalPx1 = w * scale1 * h * scale1;
          for (let i = 0; i < totalPx1; i++) {
            meanLum += 0.299 * d1.data[i * 4] + 0.587 * d1.data[i * 4 + 1] + 0.114 * d1.data[i * 4 + 2];
          }
          meanLum /= Math.max(1, totalPx1);
          if (meanLum < 90) {
            for (let i = 0; i < totalPx1; i++) {
              const g = 255 - (0.299 * d1.data[i * 4] + 0.587 * d1.data[i * 4 + 1] + 0.114 * d1.data[i * 4 + 2]);
              d1.data[i * 4] = g;
              d1.data[i * 4 + 1] = g;
              d1.data[i * 4 + 2] = g;
            }
            ctx1.putImageData(d1, 0, 0);
          }
          if (typeof recognizeFn === "function") {
            const out1 = await recognizeFn(c1.toBuffer("image/png"), "spa");
            const txt1 = String(out1?.data?.text || "").trim();
            if (txt1) {
              pass1Result = parseVenezuelanReceiptText(txt1);
            }
          }
          if (pass1Result && pass1Result.monto_bs && pass1Result.monto_bs > 0 && pass1Result.referencia && pass1Result.banco) {
            return pass1Result;
          }
          const cOrig = createCanvas(w, h);
          const ctxOrig = cOrig.getContext("2d");
          ctxOrig.drawImage(img, 0, 0);
          const src = ctxOrig.getImageData(0, 0, w, h).data;
          const gray = new Float32Array(w * h);
          for (let i = 0; i < w * h; i++) {
            const g = 0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2];
            gray[i] = meanLum < 90 ? 255 - g : g;
          }
          const weights = [0.15, 0.2, 0.3, 0.2, 0.15];
          const hBlur = new Float32Array(w * h);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              let s = 0;
              let wSum = 0;
              for (let dx = -2; dx <= 2; dx++) {
                const nx = x + dx;
                if (nx >= 0 && nx < w) {
                  const wt = weights[dx + 2];
                  s += gray[y * w + nx] * wt;
                  wSum += wt;
                }
              }
              hBlur[y * w + x] = s / wSum;
            }
          }
          const integral = new Float64Array((w + 1) * (h + 1));
          for (let y = 1; y <= h; y++) {
            let rowSum = 0;
            for (let x = 1; x <= w; x++) {
              rowSum += hBlur[(y - 1) * w + (x - 1)];
              integral[y * (w + 1) + x] = integral[(y - 1) * (w + 1) + x] + rowSum;
            }
          }
          const getBoxMean = (x0, y0, x1, y1) => {
            const cx0 = Math.max(0, x0);
            const cy0 = Math.max(0, y0);
            const cx1 = Math.min(w - 1, x1);
            const cy1 = Math.min(h - 1, y1);
            const area = (cx1 - cx0 + 1) * (cy1 - cy0 + 1);
            return (integral[(cy1 + 1) * (w + 1) + (cx1 + 1)] - integral[cy0 * (w + 1) + (cx1 + 1)] - integral[(cy1 + 1) * (w + 1) + cx0] + integral[cy0 * (w + 1) + cx0]) / area;
          };
          const norm = new Float32Array(w * h);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const bg = getBoxMean(x - 25, y - 25, x + 25, y + 25);
              norm[y * w + x] = Math.max(0, bg - hBlur[y * w + x]);
            }
          }
          const isLine = new Uint8Array(w * h);
          for (let y = 0; y < h; y++) {
            let runStart = -1;
            for (let x = 0; x <= w; x++) {
              const val = x < w ? Math.max(
                norm[y * w + x],
                y > 0 ? norm[(y - 1) * w + x] * 0.8 : 0,
                y + 1 < h ? norm[(y + 1) * w + x] * 0.8 : 0
              ) : 0;
              if (val > 7) {
                if (runStart === -1) runStart = x;
              } else {
                if (runStart !== -1 && x - runStart >= 50) {
                  for (let k = runStart; k < x; k++) {
                    const above = y >= 5 ? norm[(y - 5) * w + k] : 0;
                    const below = y + 5 < h ? norm[(y + 5) * w + k] : 0;
                    if (above < 12 || below < 12) {
                      isLine[y * w + k] = 1;
                      if (y > 0 && above < 10) isLine[(y - 1) * w + k] = 1;
                      if (y + 1 < h && below < 10) isLine[(y + 1) * w + k] = 1;
                    }
                  }
                }
                runStart = -1;
              }
            }
          }
          for (let x = 0; x < w; x++) {
            let runStart = -1;
            for (let y = 0; y <= h; y++) {
              const val = y < h ? Math.max(
                norm[y * w + x],
                x > 0 ? norm[y * w + (x - 1)] * 0.8 : 0,
                x + 1 < w ? norm[y * w + (x + 1)] * 0.8 : 0
              ) : 0;
              if (val > 7) {
                if (runStart === -1) runStart = y;
              } else {
                if (runStart !== -1 && y - runStart >= 55) {
                  for (let k = runStart; k < y; k++) {
                    const left = x >= 5 ? norm[k * w + (x - 5)] : 0;
                    const right = x + 5 < w ? norm[k * w + (x + 5)] : 0;
                    if (left < 12 || right < 12) {
                      isLine[k * w + x] = 1;
                      if (x > 0 && left < 10) isLine[k * w + (x - 1)] = 1;
                      if (x + 1 < w && right < 10) isLine[k * w + (x + 1)] = 1;
                    }
                  }
                }
                runStart = -1;
              }
            }
          }
          const outCanvas = createCanvas(w, h);
          const outCtx = outCanvas.getContext("2d");
          const outImg = outCtx.createImageData(w, h);
          for (let i = 0; i < w * h; i++) {
            const d = isLine[i] ? 0 : norm[i];
            const v = d <= 4 ? 255 : Math.max(0, Math.min(255, Math.round(255 - (d - 4) * 8.5)));
            outImg.data[i * 4] = v;
            outImg.data[i * 4 + 1] = v;
            outImg.data[i * 4 + 2] = v;
            outImg.data[i * 4 + 3] = 255;
          }
          outCtx.putImageData(outImg, 0, 0);
          const scale2 = w < 900 ? 2 : 1;
          let finalPngBuffer;
          if (scale2 === 1) {
            finalPngBuffer = outCanvas.toBuffer("image/png");
          } else {
            const upCanvas = createCanvas(w * scale2, h * scale2);
            const upCtx = upCanvas.getContext("2d");
            upCtx.imageSmoothingEnabled = true;
            upCtx.drawImage(outCanvas, 0, 0, w * scale2, h * scale2);
            finalPngBuffer = upCanvas.toBuffer("image/png");
          }
          if (typeof createWorkerFn === "function") {
            const worker = await createWorkerFn("spa");
            try {
              await worker.setParameters({ tessedit_pageseg_mode: "6" });
              const out2 = await worker.recognize(finalPngBuffer);
              const txt2 = String(out2?.data?.text || "").trim();
              if (txt2) {
                pass2Result = parseVenezuelanReceiptText(txt2);
              }
            } finally {
              await worker.terminate().catch(() => {
              });
            }
          } else if (typeof recognizeFn === "function") {
            const out2 = await recognizeFn(finalPngBuffer, "spa");
            const txt2 = String(out2?.data?.text || "").trim();
            if (txt2) {
              pass2Result = parseVenezuelanReceiptText(txt2);
            }
          }
        } catch (canvasErr) {
          if (typeof recognizeFn === "function" && !pass1Result) {
            const rawOut = await recognizeFn(imgBuffer, "spa");
            const rawTxt = String(rawOut?.data?.text || "").trim();
            if (rawTxt) {
              pass1Result = parseVenezuelanReceiptText(rawTxt);
            }
          }
        }
        const scoreAudited = (r) => {
          if (!r) return 0;
          let s = 0;
          if (r.monto_bs && r.monto_bs > 0) s += 3;
          if (r.referencia) s += 3;
          if (r.banco) s += 2;
          if (r.fecha_iso) s += 2;
          if (r.numero_cuenta) s += 1;
          return s;
        };
        if (scoreAudited(pass2Result) >= scoreAudited(pass1Result) && pass2Result) {
          return pass2Result;
        }
        return pass1Result || pass2Result;
      };
      let fallbackResult = null;
      try {
        if (actualMime === "application/pdf") {
          const { PDFParse } = await import("pdf-parse");
          const pdfParser = new PDFParse({ data: binaryBuffer });
          try {
            const textRes = await pdfParser.getText();
            const extractedPdfText = String(textRes?.text || "").trim();
            if (extractedPdfText.length >= 12) {
              fallbackResult = parseVenezuelanReceiptText(extractedPdfText);
            }
            if (!fallbackResult?.legible) {
              const imgRes = await pdfParser.getImage({ imageBuffer: true, first: 1 });
              const firstPageImgs = imgRes?.pages?.[0]?.images || [];
              if (firstPageImgs.length > 0 && firstPageImgs[0]?.data) {
                fallbackResult = await runSmartImageOcrWithAntiMoire(Buffer.from(firstPageImgs[0].data));
              }
            }
          } finally {
            await pdfParser.destroy().catch(() => {
            });
          }
        } else if (actualMime.startsWith("image/")) {
          fallbackResult = await runSmartImageOcrWithAntiMoire(binaryBuffer);
        }
      } catch (localOcrErr) {
        console.warn("[OCR COBROS LOCAL] Advertencia en motor local PDF/Tesseract:", localOcrErr?.message);
      }
      if (aiResult || fallbackResult) {
        const mergedTexto = [
          aiResult?.texto_completo || "",
          fallbackResult?.texto_completo || "",
          aiResult?.canal || "",
          fallbackResult?.canal || ""
        ].filter(Boolean).join(" ");
        const mergedCuenta = aiResult?.numero_cuenta || aiResult?.datos_extraidos?.numero_cuenta || fallbackResult?.numero_cuenta || fallbackResult?.datos_extraidos?.numero_cuenta || null;
        const mergedBanco = inferirBancoVenezolano(
          aiResult?.banco || fallbackResult?.banco || null,
          mergedTexto,
          mergedCuenta
        ) || aiResult?.banco || fallbackResult?.banco || null;
        const mergedMontoNum = parseMontoVenezolano(aiResult?.montoRaw ?? aiResult?.montoNumerico ?? aiResult?.monto_bs) || parseMontoVenezolano(fallbackResult?.montoRaw ?? fallbackResult?.montoNumerico ?? fallbackResult?.monto_bs) || null;
        const mergedMontoRaw = aiResult?.montoRaw || fallbackResult?.montoRaw || (mergedMontoNum ? new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(mergedMontoNum) : null);
        const baseObj = aiResult || fallbackResult;
        const combined = auditAndNormalizeReceiptPayload({
          ...fallbackResult,
          ...aiResult,
          banco: mergedBanco,
          canal: aiResult?.canal || fallbackResult?.canal || (mergedBanco === "BBVA Provincial" ? "Provinet" : null),
          monto_bs: mergedMontoNum,
          montoNumerico: mergedMontoNum,
          montoRaw: mergedMontoRaw,
          referencia: aiResult?.referencia || fallbackResult?.referencia || null,
          fecha_pago: aiResult?.fecha_pago || fallbackResult?.fecha_pago || null,
          fecha_iso: aiResult?.fecha_iso || fallbackResult?.fecha_iso || null,
          numero_cuenta: mergedCuenta,
          texto_completo: mergedTexto || baseObj.texto_completo || null
        });
        const hasAnyCombinedField = Boolean(
          combined.monto_bs && combined.monto_bs > 0 || combined.referencia || combined.fecha_pago || combined.fecha_iso || combined.banco || combined.numero_cuenta
        );
        if (hasAnyCombinedField) {
          return res.json({
            ...combined,
            es_legible: true,
            legible: true,
            lectura_exitosa: true
          });
        }
      }
      if (aiResult) {
        return res.status(422).json({
          ...aiResult,
          es_legible: false,
          legible: false,
          error: aiResult.observacion_ia || "No se pudo leer con claridad el monto o la referencia del comprobante."
        });
      }
      const rawAiErrMsg = String(lastAiError?.message || "");
      const isQuotaOrKeyIssue = apiKeys.length === 0 || /RESOURCE_EXHAUSTED|prepayment credits|"code"\s*:\s*(402|429)|quota|billing|API_KEY_INVALID|API key not valid|reported as leaked|PERMISSION_DENIED/i.test(
        rawAiErrMsg
      );
      const fallbackMessage = isQuotaOrKeyIssue ? "No se pudo completar la lectura autom\xE1tica en este soporte. Por favor ingresa o verifica los datos manualmente." : "Comprobante ilegible o con baja resoluci\xF3n. Toma la captura n\xEDtida sin recortes o ingresa los datos manualmente.";
      const unreadablePayload = {
        es_legible: false,
        legible: false,
        confianza: 0,
        confianza_lectura: "baja",
        metodo_pago: "Pago M\xF3vil",
        banco: null,
        canal: null,
        banco_origen: null,
        banco_destino: null,
        monto_bs: null,
        monto_texto_original: null,
        referencia: null,
        nro_referencia: null,
        codigo_autorizacion: null,
        fecha_pago: null,
        fecha_iso: null,
        titular_remitente: null,
        rif_ci_titular: null,
        beneficiario_detectado: null,
        observacion_auditoria: fallbackMessage,
        observacion_ia: fallbackMessage
      };
      return res.status(isQuotaOrKeyIssue ? 503 : 422).json({
        ...unreadablePayload,
        error: unreadablePayload.observacion_auditoria
      });
    } catch (err) {
      console.error("[OCR COBROS] Error inesperado procesando comprobante:", err);
      const internalErrObs = "Error interno al procesar el comprobante. Puedes ingresar los datos manualmente.";
      return res.status(500).json({
        legible: false,
        confianza: 0,
        confianza_lectura: "baja",
        metodo_pago: "Pago M\xF3vil",
        banco: null,
        banco_origen: null,
        banco_destino: null,
        monto_bs: null,
        monto_texto_original: null,
        referencia: null,
        nro_referencia: null,
        codigo_autorizacion: null,
        fecha_pago: null,
        fecha_iso: null,
        titular_remitente: null,
        rif_ci_titular: null,
        beneficiario_detectado: null,
        observacion_auditoria: internalErrObs,
        observacion_ia: internalErrObs,
        error: "No se pudo interpretar el comprobante. Puedes ingresar los datos manualmente."
      });
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
  const normalizeCobroVendorKey = (raw) => String(raw || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/s\b/g, "").replace(/[^a-z0-9]/g, "");
  const toVenezuelaDateIso = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr).slice(0, 10);
    return new Date(d.getTime() - 4 * 3600 * 1e3).toISOString().slice(0, 10);
  };
  app2.get("/api/cobros", authenticateToken, async (req, res) => {
    try {
      const vendedorFilter = String(req.query.vendedor || "").trim();
      const dateFilter = String(req.query.date || "").trim();
      const includeImages = req.query.includeImages === "true";
      const targetDateVe = dateFilter === "today" ? toVenezuelaDateIso((/* @__PURE__ */ new Date()).toISOString()) : /^\d{4}-\d{2}-\d{2}$/.test(dateFilter) ? dateFilter : "";
      const byId = /* @__PURE__ */ new Map();
      if (import_fs.default.existsSync(COBROS_LOCAL_DB_PATH)) {
        try {
          const localList = JSON.parse(import_fs.default.readFileSync(COBROS_LOCAL_DB_PATH, "utf-8")) || [];
          for (const item of localList) {
            if (item && item.id) byId.set(item.id, item);
          }
        } catch (_e) {
        }
      }
      if (supabase) {
        try {
          const { data: folders } = await supabase.storage.from(COBROS_BUCKET).list("registros", { limit: 100 });
          const targetVendorKey = normalizeCobroVendorKey(vendedorFilter);
          const matchingFolders = (folders || []).filter((f) => {
            if (!f?.name) return false;
            if (!targetVendorKey) return true;
            const folderKey = normalizeCobroVendorKey(f.name.replace(/_/g, " "));
            return folderKey.includes(targetVendorKey) || targetVendorKey.includes(folderKey) || targetVendorKey.includes("maria") && folderKey.includes("mar") && folderKey.includes("brice");
          });
          for (const folder of matchingFolders) {
            const { data: files } = await supabase.storage.from(COBROS_BUCKET).list(`registros/${folder.name}`, {
              limit: 300,
              sortBy: { column: "created_at", order: "desc" }
            });
            const candidateFiles = (files || []).filter((fileObj) => {
              if (!fileObj?.name || !fileObj.name.endsWith(".json")) return false;
              if (!dateFilter || dateFilter === "all") return true;
              const createdAtStr = String(fileObj.created_at || "");
              if (dateFilter.endsWith("_utc")) {
                const utcDay = dateFilter.replace("_utc", "");
                return createdAtStr.startsWith(utcDay);
              }
              if (targetDateVe) {
                const fileVeDay = toVenezuelaDateIso(createdAtStr);
                return fileVeDay === targetDateVe || createdAtStr.startsWith(targetDateVe);
              }
              return true;
            });
            const batchSize = 10;
            for (let i = 0; i < candidateFiles.length; i += batchSize) {
              const slice = candidateFiles.slice(i, i + batchSize);
              await Promise.all(
                slice.map(async (fileObj) => {
                  const idGuess = fileObj.name.replace(/\.json$/, "");
                  if (byId.has(idGuess)) return;
                  try {
                    const { data: blob } = await supabase.storage.from(COBROS_BUCKET).download(`registros/${folder.name}/${fileObj.name}`);
                    if (blob) {
                      const rec = JSON.parse(await blob.text());
                      if (rec && rec.id) {
                        byId.set(rec.id, rec);
                      }
                    }
                  } catch (_dlErr) {
                  }
                })
              );
            }
          }
        } catch (supaErr) {
          console.warn("[COBROS RECOVER] Advertencia listando Supabase Storage:", supaErr?.message);
        }
      }
      let list = Array.from(byId.values());
      if (vendedorFilter) {
        const targetVendorKey = normalizeCobroVendorKey(vendedorFilter);
        list = list.filter((item) => {
          const itemKey = normalizeCobroVendorKey(item.vendedor || "");
          return itemKey.includes(targetVendorKey) || targetVendorKey.includes(itemKey) || targetVendorKey.includes("maria") && itemKey.includes("maria") && itemKey.includes("briceno");
        });
      }
      if (dateFilter && dateFilter !== "all") {
        if (dateFilter.endsWith("_utc")) {
          const utcDay = dateFilter.replace("_utc", "");
          list = list.filter(
            (item) => String(item.createdAt || item.syncedAt || "").startsWith(utcDay)
          );
        } else if (targetDateVe) {
          list = list.filter((item) => {
            const veDay = toVenezuelaDateIso(item.createdAt || item.syncedAt);
            return veDay === targetDateVe;
          });
        }
      }
      list.sort(
        (a, b) => String(b.createdAt || b.syncedAt || "").localeCompare(String(a.createdAt || a.syncedAt || ""))
      );
      if (includeImages && list.length > 0) {
        const imgBatchSize = 6;
        for (let i = 0; i < list.length; i += imgBatchSize) {
          const slice = list.slice(i, i + imgBatchSize);
          await Promise.all(
            slice.map(async (item) => {
              if (item.image || !item.comprobante_url) return;
              try {
                const imgRes = await fetch(item.comprobante_url);
                if (imgRes.ok) {
                  const arrBuf = await imgRes.arrayBuffer();
                  const mime = item.fileMimeType || imgRes.headers.get("content-type") || "image/jpeg";
                  const b64 = Buffer.from(arrBuf).toString("base64");
                  const dataUrl = `data:${mime};base64,${b64}`;
                  item.image = mime === "application/pdf" ? void 0 : dataUrl;
                  item.fileDataUrl = dataUrl;
                }
              } catch (_imgErr) {
              }
            })
          );
        }
      }
      return res.json({
        success: true,
        total: list.length,
        cobros: list
      });
    } catch (err) {
      return res.status(500).json({ error: "Error consultando cobros sincronizados" });
    }
  });
  const BCV_LOCAL_CACHE_PATH = import_path.default.join(process.cwd(), "bcv_rates_history_cache.json");
  const bcvHttpsAgent = new import_https.default.Agent({ rejectUnauthorized: false, keepAlive: true });
  let bcvRatesHistoryMap = {};
  let lastBcvScrapeTimestamp = 0;
  const BCV_SCRAPE_TTL_MS = 10 * 60 * 1e3;
  try {
    if (import_fs.default.existsSync(BCV_LOCAL_CACHE_PATH)) {
      const rawJson = JSON.parse(import_fs.default.readFileSync(BCV_LOCAL_CACHE_PATH, "utf-8"));
      if (rawJson && typeof rawJson === "object") {
        for (const [k, v] of Object.entries(rawJson)) {
          const num = typeof v === "number" ? v : v?.tasa;
          const clean = parseNumeroBcv(num);
          if (clean > 0 && /^\d{4}-\d{2}-\d{2}$/.test(k)) {
            bcvRatesHistoryMap[k] = clean;
          }
        }
      }
    }
  } catch (_e) {
  }
  const persistBcvRatesCache = async () => {
    try {
      import_fs.default.writeFileSync(BCV_LOCAL_CACHE_PATH, JSON.stringify(bcvRatesHistoryMap, null, 2), "utf-8");
    } catch (_e) {
    }
    if (supabase) {
      try {
        await ensureCobrosBucket();
        const payload = Buffer.from(JSON.stringify(bcvRatesHistoryMap, null, 2), "utf-8");
        await supabase.storage.from(COBROS_BUCKET).upload("config/bcv_rates_history_cache.json", payload, {
          contentType: "application/json",
          upsert: true
        });
      } catch (_supaErr) {
      }
    }
  };
  const fetchBcvBuffer = (targetUrl, timeoutMs = 7e3, redirectsLeft = 3) => {
    return new Promise((resolve, reject) => {
      const req = import_https.default.get(
        targetUrl,
        {
          agent: bcvHttpsAgent,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-VE,es;q=0.9,en;q=0.8"
          }
        },
        (resp) => {
          const status = resp.statusCode || 0;
          if ([301, 302, 303, 307, 308].includes(status) && resp.headers.location && redirectsLeft > 0) {
            const nextUrl = resp.headers.location.startsWith("http") ? resp.headers.location : `https://www.bcv.org.ve${resp.headers.location.startsWith("/") ? "" : "/"}${resp.headers.location}`;
            resp.resume();
            fetchBcvBuffer(nextUrl, timeoutMs, redirectsLeft - 1).then(resolve).catch(reject);
            return;
          }
          if (status < 200 || status >= 300) {
            resp.resume();
            reject(new Error(`HTTP ${status} desde ${targetUrl}`));
            return;
          }
          const chunks = [];
          resp.on("data", (chunk2) => chunks.push(Buffer.isBuffer(chunk2) ? chunk2 : Buffer.from(chunk2)));
          resp.on("end", () => resolve(Buffer.concat(chunks)));
          resp.on("error", reject);
        }
      );
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error(`Timeout (${timeoutMs}ms) consultando ${targetUrl}`));
      });
      req.on("error", reject);
    });
  };
  const syncBcvRatesForDate = async (targetIso) => {
    const now = Date.now();
    const alreadyResolved = resolveBcvRateWithBusinessDayFallback(bcvRatesHistoryMap, targetIso, 5);
    if (alreadyResolved && !alreadyResolved.esDiaHabilAnterior) {
      return;
    }
    if (alreadyResolved && now - lastBcvScrapeTimestamp < BCV_SCRAPE_TTL_MS) {
      return;
    }
    let updated = false;
    try {
      const page0Buf = await fetchBcvBuffer(BCV_INDICE_INVERSION_URL, 7e3);
      const page0Html = page0Buf.toString("utf-8");
      const page0Rates = parseBcvIndiceInversionHtml(page0Html);
      const extractedDates = Object.keys(page0Rates).sort();
      if (extractedDates.length > 0) {
        Object.assign(bcvRatesHistoryMap, page0Rates);
        lastBcvScrapeTimestamp = now;
        updated = true;
      }
      if (!resolveBcvRateWithBusinessDayFallback(bcvRatesHistoryMap, targetIso, 5)) {
        const excelLinks = extractBcvExcelLinksFromHtml(page0Html);
        for (const xlsUrl of excelLinks.slice(0, 2)) {
          try {
            const xlsBuf = await fetchBcvBuffer(xlsUrl, 7e3);
            const xlsRates = parseBcvExcelBuffer(new Uint8Array(xlsBuf));
            if (Object.keys(xlsRates).length > 0) {
              Object.assign(bcvRatesHistoryMap, xlsRates);
              updated = true;
            }
          } catch (_xlsErr) {
          }
        }
      }
      const oldestPage0 = extractedDates[0];
      if (oldestPage0 && targetIso < oldestPage0 && !resolveBcvRateWithBusinessDayFallback(bcvRatesHistoryMap, targetIso, 5)) {
        const diffDays = Math.max(
          1,
          Math.round(
            ((/* @__PURE__ */ new Date(`${oldestPage0}T12:00:00Z`)).getTime() - (/* @__PURE__ */ new Date(`${targetIso}T12:00:00Z`)).getTime()) / 864e5
          )
        );
        const startPage = Math.max(1, Math.floor(diffDays / 70));
        const pagesToTry = Array.from(/* @__PURE__ */ new Set([startPage, startPage + 1, 1, 2])).slice(0, 3);
        for (const pageNum of pagesToTry) {
          try {
            const pagedBuf = await fetchBcvBuffer(`${BCV_INDICE_INVERSION_URL}?page=${pageNum}`, 6e3);
            const pagedRates = parseBcvIndiceInversionHtml(pagedBuf.toString("utf-8"));
            if (Object.keys(pagedRates).length > 0) {
              Object.assign(bcvRatesHistoryMap, pagedRates);
              updated = true;
              if (resolveBcvRateWithBusinessDayFallback(bcvRatesHistoryMap, targetIso, 5)) {
                break;
              }
            }
          } catch (_pErr) {
          }
        }
      }
      if (!resolveBcvRateWithBusinessDayFallback(bcvRatesHistoryMap, targetIso, 5)) {
        try {
          const smcBuf = await fetchBcvBuffer(BCV_SMC_URL, 6e3);
          const smcExcelLinks = extractBcvExcelLinksFromHtml(smcBuf.toString("utf-8"));
          if (smcExcelLinks.length > 0) {
            const firstXlsBuf = await fetchBcvBuffer(smcExcelLinks[0], 7e3);
            const smcRates = parseBcvExcelBuffer(new Uint8Array(firstXlsBuf));
            if (Object.keys(smcRates).length > 0) {
              Object.assign(bcvRatesHistoryMap, smcRates);
              updated = true;
            }
          }
        } catch (_smcErr) {
        }
      }
    } catch (bcvErr) {
      console.warn("[BCV SCRAPER] Advertencia conectando con bcv.org.ve:", bcvErr?.message);
    }
    if (updated) {
      const latestDates = Object.keys(bcvRatesHistoryMap).sort();
      if (latestDates.length > 0) {
        cachedBcvRate = bcvRatesHistoryMap[latestDates[latestDates.length - 1]];
      }
      persistBcvRatesCache().catch(() => {
      });
    }
  };
  const handleBcvRateRequest = async (req, res) => {
    try {
      const rawDate = String(req.query.date || req.query.fecha || "").trim();
      const todayIso = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const { iso: targetIso, display: targetDisplay } = normalizeBcvDateInput(rawDate || todayIso);
      await syncBcvRatesForDate(targetIso);
      const resolved = resolveBcvRateWithBusinessDayFallback(
        bcvRatesHistoryMap,
        targetIso,
        5,
        BCV_INDICE_INVERSION_URL
      );
      if (resolved) {
        return res.json({
          ...resolved,
          serieReciente: bcvRatesHistoryMap
        });
      }
      const baseDate = /* @__PURE__ */ new Date(`${targetIso}T12:00:00Z`);
      for (let offset = 0; offset <= 5; offset++) {
        const checkDate = new Date(baseDate.getTime() - offset * 864e5);
        const py = checkDate.getUTCFullYear();
        const pm = checkDate.getUTCMonth() + 1;
        const pd = checkDate.getUTCDate();
        const checkIso = `${py}-${String(pm).padStart(2, "0")}-${String(pd).padStart(2, "0")}`;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const extRes = await fetch(`https://rates.dolarvzla.com/bcv/${py}/${pm}/${pd}.json`, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (extRes.ok) {
            const extData = await extRes.json();
            const usdVal = parseNumeroBcv(extData?.usd);
            if (usdVal > 0) {
              bcvRatesHistoryMap[checkIso] = usdVal;
              persistBcvRatesCache().catch(() => {
              });
              return res.json({
                tasa: usdVal,
                fechaValor: checkIso,
                fechaValorDisplay: `${String(pd).padStart(2, "0")}/${String(pm).padStart(2, "0")}/${py}`,
                fechaSolicitada: targetIso,
                fechaSolicitadaDisplay: targetDisplay,
                esDiaHabilAnterior: offset > 0,
                fuente: "https://www.bcv.org.ve/estadisticas/indice-de-inversion",
                serieReciente: bcvRatesHistoryMap
              });
            }
          }
        } catch (_extErr) {
        }
      }
      if (targetIso === todayIso) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const currRes = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", {
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (currRes.ok) {
            const data = await currRes.json();
            const prom = parseNumeroBcv(data?.promedio);
            if (prom > 0) {
              bcvRatesHistoryMap[todayIso] = prom;
              return res.json({
                tasa: prom,
                fechaValor: todayIso,
                fechaValorDisplay: targetDisplay,
                fechaSolicitada: targetIso,
                fechaSolicitadaDisplay: targetDisplay,
                esDiaHabilAnterior: false,
                fuente: "https://ve.dolarapi.com/v1/dolares/oficial",
                serieReciente: bcvRatesHistoryMap
              });
            }
          }
        } catch (_e) {
        }
      }
      return res.status(503).json({
        error: `No se pudo conectar con BCV para el ${targetDisplay}`,
        fechaSolicitada: targetIso,
        fechaSolicitadaDisplay: targetDisplay
      });
    } catch (err) {
      return res.status(503).json({
        error: err?.message || "No se pudo consultar la tasa del BCV"
      });
    }
  };
  app2.get("/api/bcv-rate", handleBcvRateRequest);
  app2.get("/api/tasa-bcv", handleBcvRateRequest);
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
      const XLSX2 = await import("xlsx");
      const parsed = parseWorkbookFull(XLSX2, workbook, { periodo: metasPeriodoActual() });
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
          const XLSX2 = await import("xlsx");
          const sheetName = workbook.SheetNames.find((s) => /activacion|clientes/i.test(s));
          if (sheetName) {
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX2.utils.sheet_to_json(sheet, { header: 1 });
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
  let maestraSyncEnCurso = false;
  function leerCsvMaestraDeBody(body) {
    const b64 = String(body?.csvBase64 || "").replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
    if (!b64) throw new MaestraParseError("Falta el archivo CSV (csvBase64).");
    const bytes = Buffer.from(b64, "base64");
    if (bytes.length === 0) throw new MaestraParseError("El archivo CSV est\xE1 vac\xEDo.");
    if (bytes.length > 20 * 1024 * 1024) throw new MaestraParseError("El archivo CSV supera el m\xE1ximo de 20 MB.");
    return {
      bytes,
      archivoNombre: String(body?.archivo || "maestra.csv").slice(0, 200),
      sha256: import_crypto.default.createHash("sha256").update(bytes).digest("hex")
    };
  }
  function responderErrorMaestra(res, err, contexto) {
    if (err instanceof MaestraParseError) {
      return res.status(400).json({ success: false, code: "CSV_INVALIDO", error: err.message });
    }
    if (err instanceof MaestraEsquemaError) {
      return res.status(412).json({ success: false, code: "ESQUEMA_FALTANTE", error: err.message });
    }
    if (err instanceof MaestraBajasMasivasError) {
      return res.status(409).json({
        success: false,
        code: "BAJAS_MASIVAS",
        error: err.message,
        bajas: err.bajas,
        activos: err.activos
      });
    }
    console.error(`[MAESTRA] Error en ${contexto}:`, err?.message || err);
    return res.status(500).json({ success: false, code: "ERROR_INTERNO", error: err?.message || `Error en ${contexto}` });
  }
  app2.post(
    "/api/maestra/preview",
    authenticateToken,
    requireAdmin,
    rateLimiter(6e4, 20, "maestra-preview"),
    async (req, res) => {
      try {
        const { bytes, archivoNombre, sha256 } = leerCsvMaestraDeBody(req.body);
        const parsed = parseMaestraBytes(new Uint8Array(bytes));
        const conteoPorVendedor = /* @__PURE__ */ new Map();
        parsed.clientes.forEach((c) => conteoPorVendedor.set(c.idVendedor, (conteoPorVendedor.get(c.idVendedor) || 0) + 1));
        let db2 = null;
        if (supabase) {
          const { aBajaIds, ...resto } = await calcularPreviewDb(crearMaestraRepoSupabase(supabase), parsed, { archivoSha256: sha256 });
          db2 = { ...resto, aBajaMuestra: aBajaIds.slice(0, 25) };
        }
        res.json({
          success: true,
          archivo: { nombre: archivoNombre, sha256, bytes: bytes.length },
          reporte: parsed.reporte,
          supervisores: parsed.supervisores,
          vendedores: parsed.vendedores.map((v) => ({ ...v, clientes: conteoPorVendedor.get(v.idVendedor) || 0 })),
          db: db2
        });
      } catch (err) {
        responderErrorMaestra(res, err, "preview");
      }
    }
  );
  app2.post(
    "/api/maestra/sync",
    authenticateToken,
    requireAdmin,
    rateLimiter(6e4, 6, "maestra-sync"),
    async (req, res) => {
      if (maestraSyncEnCurso) {
        return res.status(409).json({ success: false, code: "SYNC_EN_CURSO", error: "Ya hay una sincronizaci\xF3n de la maestra en curso." });
      }
      maestraSyncEnCurso = true;
      try {
        if (!supabase) {
          return res.status(503).json({ success: false, code: "SIN_BASE_DE_DATOS", error: "Supabase no est\xE1 configurado en el servidor." });
        }
        const { bytes, archivoNombre, sha256 } = leerCsvMaestraDeBody(req.body);
        const parsed = parseMaestraBytes(new Uint8Array(bytes));
        const resultado = await sincronizarMaestra(crearMaestraRepoSupabase(supabase), parsed, {
          periodo: metasPeriodoActual(),
          archivoNombre,
          archivoSha256: sha256,
          creadoPor: String(req.user?.username || req.user?.nombre || "ADMIN"),
          forzarBajas: req.body?.forzarBajas === true
        });
        cachedVolumenParsed = null;
        cachedActivacionParsed = null;
        cachedMetasParsed = null;
        lastVolumenParsedTime = 0;
        lastActivacionParsedTime = 0;
        lastMetasParsedTime = 0;
        console.log(
          `[MAESTRA] Carga ${resultado.cargaId} (${resultado.estado}): ${resultado.clientes.enArchivo} clientes | nuevos ${resultado.clientes.nuevos} | actualizados ${resultado.clientes.actualizados} | reactivados ${resultado.clientes.reactivados} | dados de baja ${resultado.clientes.desactivados} | vendedores ${resultado.vendedores.enArchivo} | activos en BD ${resultado.verificacion.activosEnBd}`
        );
        res.json({ success: true, resultado, reporte: parsed.reporte });
      } catch (err) {
        responderErrorMaestra(res, err, "sync");
      } finally {
        maestraSyncEnCurso = false;
      }
    }
  );
  app2.get("/api/maestra/estado", authenticateToken, requireAdmin, async (_req, res) => {
    try {
      if (!supabase) return res.json({ success: true, esquemaDisponible: false, ultimaCarga: null });
      const { data, error } = await supabase.from("maestra_cargas").select("id,periodo,archivo_nombre,estado,creado_por,creado_en,finalizado_en").order("creado_en", { ascending: false }).limit(1);
      if (error) {
        const faltaEsquema = /does not exist|schema cache|Could not find the table/i.test(error.message || "") || error.code === "42P01" || error.code === "PGRST205";
        if (faltaEsquema) return res.json({ success: true, esquemaDisponible: false, ultimaCarga: null });
        throw error;
      }
      res.json({ success: true, esquemaDisponible: true, ultimaCarga: data && data[0] ? data[0] : null });
    } catch (err) {
      responderErrorMaestra(res, err, "estado");
    }
  });
  const COLUMNAS_ACTIVACION_NUEVAS = [
    "cajas_leche_vencampo",
    "cajas_mortadela_asturias",
    "cajas_salpicao",
    "has_leche_vencampo",
    "has_mortadela_asturias",
    "has_salpicao"
  ];
  const NUEVOS_RUBROS_CODES = ["LECHE_VENCAMPO", "MORTADELA_ASTURIAS", "SALPICAO"];
  let activacionColsNuevasCache = null;
  async function activacionTieneColumnasNuevas() {
    if (!supabase) return false;
    if (activacionColsNuevasCache && Date.now() - activacionColsNuevasCache.at < 6e4) return activacionColsNuevasCache.ok;
    const { error } = await supabase.from("activacion_clientes").select(COLUMNAS_ACTIVACION_NUEVAS.join(",")).limit(1);
    activacionColsNuevasCache = { ok: !error, at: Date.now() };
    if (error) console.warn("[RUBROS] activacion_clientes a\xFAn no tiene las columnas de los rubros nuevos; ejecuta scripts/sql/03_rubros_noviembre_2026.sql");
    return !error;
  }
  const sinColumnasNuevas = (row) => {
    const copia = { ...row };
    for (const k of COLUMNAS_ACTIVACION_NUEVAS) delete copia[k];
    return copia;
  };
  async function cargarVentasMesActual() {
    if (!supabase) return [];
    try {
      const hoy = /* @__PURE__ */ new Date();
      const rows = await histFetchAll(
        (a, b) => supabase.from("ventas_historial").select("id_cliente,id_articulo,articulo,cajas").eq("ano", hoy.getFullYear()).eq("mes", hoy.getMonth() + 1).order("id_cliente").order("id_articulo").range(a, b)
      );
      return rows.map((r) => ({ id_cliente: String(r.id_cliente || ""), id_articulo: String(r.id_articulo || ""), articulo: String(r.articulo || ""), cajas: Number(r.cajas) || 0 }));
    } catch {
      return [];
    }
  }
  async function syncWorkbookToSupabase(workbook) {
    const XLSX2 = await import("xlsx");
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
          const seenComposite = /* @__PURE__ */ new Map();
          for (const c of allClients) {
            const rawVid = String(c.vendedor_id || "").trim();
            if (rawVid.toUpperCase().startsWith("INACTIVO_MAESTRA::") || String(c.status || "").toUpperCase() === "BAJA_MAESTRA" || c.activo === false) {
              continue;
            }
            const rawCod = String(c.cliente_codigo || "").trim();
            const cleanCod = rawCod.replace(/#\d+$/, "").trim();
            if (!cleanCod) continue;
            const vNorm = normalizeVendorName(c.vendedor_nombre || c.vendedor_id);
            const compKey = `${vNorm}::${cleanCod}`;
            if (!seenComposite.has(compKey)) {
              seenComposite.set(compKey, c);
            } else {
              const prev = seenComposite.get(compKey);
              prev.has_aceite = Boolean(prev.has_aceite || c.has_aceite);
              prev.has_azucar = Boolean(prev.has_azucar || c.has_azucar);
              prev.has_pollo = Boolean(prev.has_pollo || c.has_pollo);
              prev.has_estandar_asturias = Boolean(prev.has_estandar_asturias || c.has_estandar_asturias);
              prev.has_mortadela_salpicao = Boolean(prev.has_mortadela_salpicao || c.has_mortadela_salpicao);
            }
          }
          masterClients = Array.from(seenComposite.values()).map((c) => ({
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
    if (supabase) {
      const idActivacionPorCodigo = /* @__PURE__ */ new Map();
      for (const mc of masterClients) {
        if (mc.id !== void 0) idActivacionPorCodigo.set(String(mc.cliente_codigo).trim(), mc.id);
      }
      const carteraMaestra = await leerCarteraActivaMaestra(supabase, idActivacionPorCodigo);
      if (carteraMaestra.length > 0) {
        masterClients = carteraMaestra;
      }
    }
    const parsed = parseWorkbookFull(XLSX2, workbook, {
      periodo,
      masterClients,
      ventasMes: await cargarVentasMesActual()
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
        const colsNuevasOk = await activacionTieneColumnasNuevas();
        if (parsed.activacionSupabaseUpserts.length > 0) {
          for (let i = 0; i < parsed.activacionSupabaseUpserts.length; i += 200) {
            const batch = parsed.activacionSupabaseUpserts.slice(i, i + 200).map((row) => colsNuevasOk ? row : sinColumnasNuevas(row));
            await supabase.from("activacion_clientes").upsert(batch, { onConflict: "id" });
          }
        }
        if (hadDbClients && parsed.newSheetClientsForSupabase.length > 0) {
          for (let i = 0; i < parsed.newSheetClientsForSupabase.length; i += 200) {
            const batch = parsed.newSheetClientsForSupabase.slice(i, i + 200).map((row) => colsNuevasOk ? row : sinColumnasNuevas(row));
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
    if (!normHist(raw)) return null;
    const code = categoriaARubroCodigo(String(raw || ""));
    return code === "OTROS" ? null : code;
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
          m = { ano: r.ano, mes: r.mes, sku: r.id_articulo, articulo: r.articulo, rubro: clasificarRubro(r.id_articulo, r.articulo), cajas: 0, unidades: 0, kgs: 0, monto: 0, clientes: 0 };
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
            m = { ano: r.ano, mes: r.mes, sku: r.id_articulo, articulo: r.articulo, rubro: clasificarRubro(r.id_articulo, r.articulo), cajas: 0, unidades: 0, kgs: 0, monto: 0, clientes: 0 };
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
            m = { ano, mes, kgs: {}, cajas: {}, monto: {}, activos: { ACEITE: 0, AZUCAR: 0, POLLO: 0, ESTANDAR_ASTURIAS: 0, MORTADELA_SALPICAO: 0, LECHE_VENCAMPO: 0, MORTADELA_ASTURIAS: 0, SALPICAO: 0, TOTAL: 0 }, clientesConMovimiento: 0, fueraCartera: 0 };
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
            (a, b) => supabase.from("ventas_historial").select("ano,mes,id_cliente,id_articulo,articulo,rubro,cajas").in("vendedor", scope.names).order("ano").order("mes").order("id_cliente").order("id_articulo").range(a, b)
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
            const rk = r.id_articulo || r.articulo ? clasificarRubro(r.id_articulo, r.articulo) : r.rubro;
            obj[rk] = (obj[rk] || 0) + nz(r.cajas);
            obj._ANY = (obj._ANY || 0) + nz(r.cajas);
          });
          byMesCliRub.forEach((obj, mk) => {
            const [anoS, mesS] = mk.split("|");
            const m = mesRow(Number(anoS), Number(mesS));
            let anyKeyRub = false;
            for (const rub of ["AZUCAR", "LECHE_VENCAMPO", "ESTANDAR_ASTURIAS", "MORTADELA_ASTURIAS", "SALPICAO", "ACEITE", "POLLO", "MORTADELA_SALPICAO"]) {
              if ((obj[rub] || 0) > 0) {
                m.activos[rub] = (m.activos[rub] || 0) + 1;
                if (esRubroActivo(rub)) anyKeyRub = true;
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
            m.activos.LECHE_VENCAMPO += nz(r.act_leche_vencampo);
            m.activos.MORTADELA_ASTURIAS += nz(r.act_mortadela_asturias);
            m.activos.SALPICAO += nz(r.act_salpicao);
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
              MORTADELA_SALPICAO: nz(r.cajas_mortadela_salpicao) || +(em?.MORTADELA_SALPICAO || 0).toFixed(2),
              LECHE_VENCAMPO: nz(r.cajas_leche_vencampo),
              MORTADELA_ASTURIAS: nz(r.cajas_mortadela_asturias),
              SALPICAO: nz(r.cajas_salpicao)
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
          m = { ano: r.ano, mes: r.mes, sku: r.id_articulo, articulo: r.articulo, rubro: clasificarRubro(r.id_articulo, r.articulo), cajas: 0, kgs: 0, monto: 0 };
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
        const rkc = clasificarRubro(r.id_articulo, r.articulo);
        cm[rkc] = (cm[rkc] || 0) + nz(r.cajas);
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
              MORTADELA_SALPICAO: nz(r.cajas_mortadela_salpicao) || +(cm.MORTADELA_SALPICAO || 0).toFixed(2),
              LECHE_VENCAMPO: nz(r.cajas_leche_vencampo) || +(cm.LECHE_VENCAMPO || 0).toFixed(2),
              MORTADELA_ASTURIAS: nz(r.cajas_mortadela_asturias) || +(cm.MORTADELA_ASTURIAS || 0).toFixed(2),
              SALPICAO: nz(r.cajas_salpicao) || +(cm.SALPICAO || 0).toFixed(2)
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
            case "LECHE_VENCAMPO":
              return !!c.has_leche_vencampo || nz(c.cajas_leche_vencampo) > 0;
            case "MORTADELA_ASTURIAS":
              return !!c.has_mortadela_asturias || nz(c.cajas_mortadela_asturias) > 0;
            case "SALPICAO":
              return !!c.has_salpicao || nz(c.cajas_salpicao) > 0;
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
    const XLSX2 = await import("xlsx");
    const parsed = parseWorkbookFull(XLSX2, workbook, {
      periodo: metasPeriodoActual(),
      masterClients: loadLocalMasterClientSeed(),
      ventasMes: await cargarVentasMesActual()
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
      if (supabase && await activacionTieneColumnasNuevas()) {
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
              const rawVid = String(r.vendedor_id || "").trim();
              if (rawVid.toUpperCase().startsWith("INACTIVO_MAESTRA::") || String(r.status || "").toUpperCase() === "BAJA_MAESTRA" || r.activo === false) {
                continue;
              }
              const cid = String(r.cliente_codigo || "").replace(/#\d+$/, "").trim();
              if (!cid) continue;
              const vNorm = normalizeVendorName(r.vendedor_nombre || r.vendedor_id);
              const compKey = `${vNorm}::${cid}`;
              const hasAceite = Boolean(r.has_aceite) || (Number(r.cajas_aceite) || 0) > 0;
              const hasAzucar = Boolean(r.has_azucar) || (Number(r.cajas_azucar) || 0) > 0;
              const hasPollo = Boolean(r.has_pollo) || (Number(r.cajas_pollo) || 0) > 0;
              const hasAsturias = Boolean(r.has_estandar_asturias) || (Number(r.cajas_estandar_asturias) || 0) > 0;
              const hasSalpicao = Boolean(r.has_mortadela_salpicao) || (Number(r.cajas_mortadela_salpicao) || 0) > 0;
              const hasLeche = Boolean(r.has_leche_vencampo) || (Number(r.cajas_leche_vencampo) || 0) > 0;
              const hasMortAst = Boolean(r.has_mortadela_asturias) || (Number(r.cajas_mortadela_asturias) || 0) > 0;
              const hasSalpNuevo = Boolean(r.has_salpicao) || (Number(r.cajas_salpicao) || 0) > 0;
              if (!byClientMap.has(compKey)) {
                byClientMap.set(compKey, {
                  id: cid,
                  cliente: r.cliente_nombre,
                  vendedorId: r.vendedor_id,
                  vendedorNombre: r.vendedor_nombre,
                  status: hasAzucar || hasLeche || hasPollo || hasAsturias || hasSalpicao || r.status === "ACTIVO" ? "ACTIVO" : "INACTIVO",
                  cajas: {
                    ACEITE: Number(r.cajas_aceite) || 0,
                    AZUCAR: Number(r.cajas_azucar) || 0,
                    POLLO: Number(r.cajas_pollo) || 0,
                    ESTANDAR_ASTURIAS: Number(r.cajas_estandar_asturias) || 0,
                    MORTADELA_SALPICAO: Number(r.cajas_mortadela_salpicao) || 0,
                    LECHE_VENCAMPO: Number(r.cajas_leche_vencampo) || 0,
                    MORTADELA_ASTURIAS: Number(r.cajas_mortadela_asturias) || 0,
                    SALPICAO: Number(r.cajas_salpicao) || 0
                  },
                  cats: {
                    ACEITE: hasAceite,
                    AZUCAR: hasAzucar,
                    POLLO: hasPollo,
                    ESTANDAR_ASTURIAS: hasAsturias,
                    MORTADELA_SALPICAO: hasSalpicao,
                    LECHE_VENCAMPO: hasLeche,
                    MORTADELA_ASTURIAS: hasMortAst,
                    SALPICAO: hasSalpNuevo,
                    ARROZ: hasPollo,
                    ENTERO: hasAsturias,
                    LIGEROS: hasSalpicao
                  }
                });
              } else {
                const prev = byClientMap.get(compKey);
                prev.cats.ACEITE = prev.cats.ACEITE || hasAceite;
                prev.cats.AZUCAR = prev.cats.AZUCAR || hasAzucar;
                prev.cats.POLLO = prev.cats.POLLO || hasPollo;
                prev.cats.ESTANDAR_ASTURIAS = prev.cats.ESTANDAR_ASTURIAS || hasAsturias;
                prev.cats.MORTADELA_SALPICAO = prev.cats.MORTADELA_SALPICAO || hasSalpicao;
                prev.cats.LECHE_VENCAMPO = prev.cats.LECHE_VENCAMPO || hasLeche;
                prev.cats.MORTADELA_ASTURIAS = prev.cats.MORTADELA_ASTURIAS || hasMortAst;
                prev.cats.SALPICAO = prev.cats.SALPICAO || hasSalpNuevo;
                prev.cats.ARROZ = prev.cats.POLLO;
                prev.cats.ENTERO = prev.cats.ESTANDAR_ASTURIAS;
                prev.cats.LIGEROS = prev.cats.MORTADELA_SALPICAO;
                prev.cajas.ACEITE = Math.max(prev.cajas.ACEITE, Number(r.cajas_aceite) || 0);
                prev.cajas.AZUCAR = Math.max(prev.cajas.AZUCAR, Number(r.cajas_azucar) || 0);
                prev.cajas.POLLO = Math.max(prev.cajas.POLLO, Number(r.cajas_pollo) || 0);
                prev.cajas.ESTANDAR_ASTURIAS = Math.max(prev.cajas.ESTANDAR_ASTURIAS, Number(r.cajas_estandar_asturias) || 0);
                prev.cajas.MORTADELA_SALPICAO = Math.max(prev.cajas.MORTADELA_SALPICAO, Number(r.cajas_mortadela_salpicao) || 0);
                prev.cajas.LECHE_VENCAMPO = Math.max(prev.cajas.LECHE_VENCAMPO || 0, Number(r.cajas_leche_vencampo) || 0);
                prev.cajas.MORTADELA_ASTURIAS = Math.max(prev.cajas.MORTADELA_ASTURIAS || 0, Number(r.cajas_mortadela_asturias) || 0);
                prev.cajas.SALPICAO = Math.max(prev.cajas.SALPICAO || 0, Number(r.cajas_salpicao) || 0);
                if (prev.cats.AZUCAR || prev.cats.LECHE_VENCAMPO || prev.cats.POLLO || prev.cats.ESTANDAR_ASTURIAS || prev.cats.MORTADELA_SALPICAO) {
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
  app2.get("/api/catalog/vendors", async (_req, res) => {
    try {
      let vendedores = getRuntimeSellerCatalog();
      let syncedAt = null;
      if (supabase) {
        try {
          const { data: supaVendedores } = await supabase.from("vendedores_maestro").select("*");
          if (Array.isArray(supaVendedores) && supaVendedores.length > 0) {
            vendedores = hydrateRuntimeSellerCatalog(supaVendedores);
            hydrateVendorProfilesFromMasterCatalog(supaVendedores);
          }
          const { data: syncMeta } = await supabase.from("catalog_sync_meta").select("*").eq("id", "GLOBAL_MASTER_SYNC").maybeSingle();
          if (syncMeta?.last_synced_at) {
            syncedAt = syncMeta.last_synced_at;
          }
        } catch {
        }
      }
      setNoCacheSyncHeaders(res, "supabase");
      return res.json({ vendedores, syncedAt });
    } catch (err) {
      return res.status(500).json({ error: err?.message || "Error consultando cat\xE1logo de vendedores" });
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
        MORTADELA_SALPICAO: "has_mortadela_salpicao",
        LECHE_VENCAMPO: "has_leche_vencampo",
        MORTADELA_ASTURIAS: "has_mortadela_asturias",
        SALPICAO: "has_salpicao"
      };
      const dbCol = colMap[normRubro];
      const colsNuevasOk = await activacionTieneColumnasNuevas();
      if (dbCol && !colsNuevasOk && NUEVOS_RUBROS_CODES.includes(normRubro)) {
        return res.status(412).json({ error: "Faltan columnas en activacion_clientes. Ejecuta scripts/sql/03_rubros_noviembre_2026.sql en Supabase.", code: "ESQUEMA_FALTANTE" });
      }
      if (supabase && dbCol) {
        const { data: rows } = await supabase.from("activacion_clientes").select("*").eq("cliente_codigo", cleanCod);
        if (Array.isArray(rows) && rows.length > 0) {
          for (const r of rows) {
            const nextState = {
              has_aceite: normRubro === "ACEITE" ? boolActive : Boolean(r.has_aceite),
              has_azucar: normRubro === "AZUCAR" ? boolActive : Boolean(r.has_azucar),
              has_pollo: normRubro === "POLLO" ? boolActive : Boolean(r.has_pollo),
              has_estandar_asturias: normRubro === "ESTANDAR_ASTURIAS" ? boolActive : Boolean(r.has_estandar_asturias),
              has_mortadela_salpicao: normRubro === "MORTADELA_SALPICAO" ? boolActive : Boolean(r.has_mortadela_salpicao),
              ...colsNuevasOk ? {
                has_leche_vencampo: normRubro === "LECHE_VENCAMPO" ? boolActive : Boolean(r.has_leche_vencampo),
                has_mortadela_asturias: normRubro === "MORTADELA_ASTURIAS" ? boolActive : Boolean(r.has_mortadela_asturias),
                has_salpicao: normRubro === "SALPICAO" ? boolActive : Boolean(r.has_salpicao)
              } : {}
            };
            const isActivo = [nextState.has_azucar, nextState.has_pollo, nextState.has_estandar_asturias, nextState.has_mortadela_salpicao, nextState.has_leche_vencampo].some(Boolean);
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
              c.cats.AZUCAR || c.cats.LECHE_VENCAMPO || c.cats.POLLO || c.cats.ESTANDAR_ASTURIAS || c.cats.MORTADELA_SALPICAO
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
