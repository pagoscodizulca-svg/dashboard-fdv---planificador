import { Role, Sucursal } from '../types';
import { normalizeVendorKey } from './vendorKeyNormalizer';
import { inferSucursalFromLegacyMetadata, normalizeSucursal } from './sucursalScope';

export interface AssignedRoute {
  id: string;
  label: string;
  aliases: string[];
  sucursal?: Sucursal;
}

export interface VendorProfile {
  canonicalUsername: string;
  displayName: string;
  email?: string;
  sucursal?: Sucursal;
  routes: AssignedRoute[];
}

export interface SupervisorProfile {
  canonicalUsername: string;
  displayName: string;
  sucursal?: Sucursal;
  supervisedVendors: string[];
}

// Columnas de resumen de supervisores en "Volumen por SKU" (no son rutas de vendedor individual)
export const SUPERVISOR_SUMMARY_COLUMNS = new Set([
  'ALI PEREZ',
  'NELSON FINOL',
  'JOHNATAN SOTO'
]);

// Normalizador de texto para comparaciones robustas contra nombres en hojas de cálculo
export function normalizeVendorName(val: string | null | undefined): string {
  if (!val) return '';
  return String(val)
    .replace(/Ã‘|Ã±/g, 'Ñ')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .trim()
    .toUpperCase();
}

export function normalizeAsciiKey(val: string | null | undefined): string {
  if (!val) return '';
  return String(val)
    .replace(/Ã‘|Ã±/g, 'N')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

// Configuración exhaustiva de perfiles y rutas asignadas a cada vendedor
export const VENDOR_PROFILES: Record<string, VendorProfile> = {
  'MARIA BRICEÑO': {
    canonicalUsername: 'MARIA BRICEÑO',
    displayName: 'María Briceño',
    routes: [
      { id: 'MARIA BRICEÑO', label: 'Ruta María Briceño', aliases: ['MARIA BRICEÑO', 'MARIA BRICENO', 'MARIA BRICEÃ‘O'] }
    ]
  },
  'MARIANA CHACIN': {
    canonicalUsername: 'MARIANA CHACIN',
    displayName: 'Cuentas claves 1 - MC',
    routes: [
      {
        id: 'CUENTAS CLAVES 1 - MC',
        label: 'Cuentas claves 1 - MC',
        aliases: [
          'CUENTAS CLAVES 1 - MC',
          'CUENTAS CLAVE 1 - MC',
          'CUENTAS CLAVES 1',
          'CUENTAS CLAVE 1',
          'MARIANA CHACIN',
          'MARIANA CHACÍN'
        ]
      }
    ]
  },
  'MIKELANGELO DIAZ': {
    canonicalUsername: 'MIKELANGELO DIAZ',
    displayName: 'Mikelangelo Diaz',
    email: 'Mikelangelodiaz@gmail.com',
    routes: [
      { 
        id: 'MIKELANGELO DIAZ', 
        label: 'Ruta Mikelangelo Diaz (Principal)', 
        aliases: [
          'MIKELANGELO DIAZ',
          'MIKELANGELO DIAZ1',
          'MIKELANGELO',
          'MIKELANGELO DIAZ - PRINCIPAL',
          'MIKELANGELO DIAZ-PRINCIPAL',
          'MIKELANGELO DIAZ (PRINCIPAL)',
          'MIKELANGELODIAZ@GMAIL.COM',
          'JOHNATAN SOTO',
          'JOHNATAN',
          'JONATHAN',
          'JHONATAN',
          'JHONATAN SOTO',
          'RUTA MIKELANGELO DIAZ',
          'RUTA JOHNATAN SOTO'
        ] 
      },
      { 
        id: 'MIKELANGELO DIAZ - VILLA DEL ROS', 
        label: 'Ruta Villa del Rosario', 
        aliases: [
          'MIKELANGELO DIAZ - VILLA DEL ROS',
          'MIKELANGELO DIAZ- VILLA DEL ROS',
          'MIKELANGELO DIAZ-VILLA DEL ROS',
          'MIKELANGELO DIAZ VILLA DEL ROS',
          'MIKELANGELO DIAZ - VILLA DEL ROSARIO',
          'MIKELANGELO DIAZ VILLA DEL ROSARIO',
          'MIKELANGELO VILLA DEL ROS',
          'MIKELANGELO - VILLA DEL ROS',
          'MIKELANGELO VILLA DEL ROSARIO',
          'JOHNATAN SOTO VILLA DEL ROS',
          'JOHNATAN SOTO - VILLA DEL ROS',
          'JOHNATAN SOTO VILLA DEL ROSARIO',
          'JOHNATAN SOTO - VILLA DEL ROSARIO',
          'VILLA DEL ROSARIO',
          'VILLA DEL ROS',
          'RUTA VILLA DEL ROSARIO',
          'RUTA VILLA DEL ROS'
        ] 
      }
    ]
  },
  'HERNAN PAZ': {
    canonicalUsername: 'HERNAN PAZ',
    displayName: 'Hernán Paz',
    routes: [
      { id: 'HERNAN PAZ', label: 'Ruta Hernán Paz', aliases: ['HERNAN PAZ'] }
    ]
  },
  'OSWALDO CHURION': {
    canonicalUsername: 'OSWALDO CHURION',
    displayName: 'Oswaldo Churión',
    routes: [
      { id: 'OSWALDO CHURION', label: 'Ruta Oswaldo Churión', aliases: ['OSWALDO CHURION'] }
    ]
  },
  'CARLOS FUENMAYOR': {
    canonicalUsername: 'CARLOS FUENMAYOR',
    displayName: 'Carlos Fuenmayor',
    routes: [
      { id: 'CARLOS FUENMAYOR', label: 'Ruta Carlos Fuenmayor', aliases: ['CARLOS FUENMAYOR'] }
    ]
  },
  'SARAH REYES': {
    canonicalUsername: 'SARAH REYES',
    displayName: 'Sarah Reyes',
    routes: [
      { id: 'SARAH REYES', label: 'Ruta Sarah Reyes', aliases: ['SARAH REYES'] }
    ]
  },
  'J PABLO ARAUJO': {
    canonicalUsername: 'J PABLO ARAUJO',
    displayName: 'J Pablo Araujo',
    routes: [
      { id: 'J PABLO ARAUJO', label: 'Ruta J Pablo Araujo', aliases: ['J PABLO ARAUJO'] },
      { id: 'J PABLO ARAUJO - CAB/OJE', label: 'Ruta Cabimas / Ojeda', aliases: ['J PABLO ARAUJO - CAB/OJE', 'J PABLO ARAUJO - CAB', 'J PABLO ARAUJO- CAB/OJE'] }
    ]
  },
  'J PABLO ARAUJO - CAB/OJE': {
    canonicalUsername: 'J PABLO ARAUJO',
    displayName: 'J Pablo Araujo',
    routes: [
      { id: 'J PABLO ARAUJO', label: 'Ruta J Pablo Araujo', aliases: ['J PABLO ARAUJO'] },
      { id: 'J PABLO ARAUJO - CAB/OJE', label: 'Ruta Cabimas / Ojeda', aliases: ['J PABLO ARAUJO - CAB/OJE', 'J PABLO ARAUJO - CAB', 'J PABLO ARAUJO- CAB/OJE'] }
    ]
  },
  'JOSE G. GONZALEZ': {
    canonicalUsername: 'JOSE G. GONZALEZ',
    displayName: 'José G. González',
    routes: [
      { id: 'JOSE G. GONZALEZ', label: 'Ruta José G. González', aliases: ['JOSE G. GONZALEZ', 'JOSE GONZALEZ'] }
    ]
  },
  'FOOD SERVICE SUR': {
    canonicalUsername: 'FOOD SERVICE SUR',
    displayName: 'Food Service Sur',
    routes: [
      { id: 'FOOD SERVICE SUR', label: 'Ruta Food Service Sur', aliases: ['FOOD SERVICE SUR'] }
    ]
  },
  'JAIDER MEDINA - FOOD SERVICE NORTE': {
    canonicalUsername: 'JAIDER MEDINA - FOOD SERVICE NORTE',
    displayName: 'Jaider Medina (Food Service Norte)',
    routes: [
      { id: 'JAIDER MEDINA - FOOD SERVICE NORTE', label: 'Ruta Food Service Norte', aliases: ['JAIDER MEDINA - FOOD SERVICE NORTE', 'JAIDER MEDINA', 'FOOD SERVICE NORTE'] }
    ]
  },
  'ANGELICA MORENO': {
    canonicalUsername: 'ANGELICA MORENO',
    displayName: 'Angélica Moreno',
    routes: [
      { id: 'ANGELICA MORENO', label: 'Ruta Angélica Moreno', aliases: ['ANGELICA MORENO'] }
    ]
  },
  'ADEL JARABA': {
    canonicalUsername: 'ADEL JARABA',
    displayName: 'Adel Jaraba',
    routes: [
      { id: 'ADEL JARABA', label: 'Ruta Adel Jaraba', aliases: ['ADEL JARABA'] }
    ]
  },
  'JUAN HERNANDEZ': {
    canonicalUsername: 'JUAN HERNANDEZ',
    displayName: 'Juan Hernández',
    routes: [
      { id: 'JUAN HERNANDEZ', label: 'Ruta Juan Hernández', aliases: ['JUAN HERNANDEZ'] },
      { id: 'FOOD SERVICE SENIOR', label: 'Ruta Food Service Senior', aliases: ['FOOD SERVICE SENIOR', 'FOOD SERVICE SENIOR - JUAN HERNANDEZ'] }
    ]
  },
  'YOLEIDA LUGO': {
    canonicalUsername: 'YOLEIDA LUGO',
    displayName: 'Yoleida Lugo',
    routes: [
      { id: 'YOLEIDA LUGO', label: 'Ruta Yoleida Lugo', aliases: ['YOLEIDA LUGO'] }
    ]
  },
  'SAIRU VALLES': {
    canonicalUsername: 'SAIRU VALLES',
    displayName: 'Cuentas claves 2 - SV',
    routes: [
      {
        id: 'CUENTAS CLAVES 2 - SV',
        label: 'Cuentas claves 2 - SV',
        aliases: [
          'CUENTAS CLAVES 2 - SV',
          'CUENTAS CLAVE 2 - SV',
          'CUENTAS CLAVES 2',
          'CUENTAS CLAVE 2',
          'SAIRU VALLES',
          'SAIRÚ VALLES'
        ]
      }
    ]
  },
  'ELISA SOLER': {
    canonicalUsername: 'ELISA SOLER',
    displayName: 'Elisa Soler',
    routes: [
      { id: 'ELISA SOLER', label: 'Ruta Elisa Soler', aliases: ['ELISA SOLER'] }
    ]
  },
  'ANGEL NAVARRO': {
    canonicalUsername: 'ANGEL NAVARRO',
    displayName: 'Ángel Navarro',
    routes: [
      { id: 'ANGEL NAVARRO', label: 'Ruta Ángel Navarro', aliases: ['ANGEL NAVARRO', 'ÁNGEL NAVARRO'] }
    ]
  },
  'MARIANGEL GONZALEZ': {
    canonicalUsername: 'MARIANGEL GONZALEZ',
    displayName: 'Mariangel González',
    routes: [
      { id: 'MARIANGEL GONZALEZ', label: 'Ruta Mariangel González', aliases: ['MARIANGEL GONZALEZ', 'MARIANGEL GONZÁLEZ', 'MARIANGEL'] }
    ]
  },
  'VICTOR CAMPOS': {
    canonicalUsername: 'VICTOR CAMPOS',
    displayName: 'Víctor Campos',
    routes: [
      { id: 'VICTOR CAMPOS', label: 'Ruta Víctor Campos', aliases: ['VICTOR CAMPOS', 'VÍCTOR CAMPOS'] }
    ]
  },
  'EDUARDO PIÑA': {
    canonicalUsername: 'EDUARDO PIÑA',
    displayName: 'Eduardo Piña',
    routes: [
      { id: 'EDUARDO PIÑA', label: 'Ruta Eduardo Piña', aliases: ['EDUARDO PIÑA', 'EDUARDO PINA', 'EDUARDO PIÃ‘A'] }
    ]
  },
  'LEONARDO RIOS': {
    canonicalUsername: 'LEONARDO RIOS',
    displayName: 'Leonardo Ríos',
    routes: [
      { id: 'LEONARDO RIOS', label: 'Ruta Leonardo Ríos', aliases: ['LEONARDO RIOS'] }
    ]
  },
  'MARYERY GARCIA': {
    canonicalUsername: 'MARYERY GARCIA',
    displayName: 'Maryery García',
    routes: [
      { id: 'MARYERY GARCIA', label: 'Ruta Maryery García', aliases: ['MARYERY GARCIA'] }
    ]
  },
  'VICTORIA VARGAS': {
    canonicalUsername: 'VICTORIA VARGAS',
    displayName: 'Victoria Vargas',
    routes: [
      {
        id: 'VICTORIA VARGAS',
        label: 'Ruta Victoria Vargas',
        aliases: ['VICTORIA VARGAS', 'LUIS GUANIPA', 'RUTA VICTORIA VARGAS', 'RUTA LUIS GUANIPA']
      }
    ]
  },
  'PEDRO ABREU': {
    canonicalUsername: 'PEDRO ABREU',
    displayName: 'Pedro Abreu',
    routes: [
      { id: 'PEDRO ABREU', label: 'Ruta Pedro Abreu', aliases: ['PEDRO ABREU'] }
    ]
  },
  'OSCAR ORTIZ': {
    canonicalUsername: 'OSCAR ORTIZ',
    displayName: 'Óscar Ortiz',
    routes: [
      { id: 'OSCAR ORTIZ- LA COSTA', label: 'Ruta La Costa', aliases: ['OSCAR ORTIZ- LA COSTA', 'OSCAR ORTIZ-  LA COSTA', 'OSCAR ORTIZ - LA COSTA', 'OSCAR ORTIZ LA COSTA', 'LA COSTA'] },
      { id: 'OSCAR ORTIZ- CORO', label: 'Ruta Coro', aliases: ['OSCAR ORTIZ- CORO', 'OSCAR ORTIZ - CORO', 'OSCAR ORTIZ CORO', 'CORO'] }
    ]
  }
};

// Vinculación de alias y nomenclaturas históricas al perfil canónico unificado de Mikelangelo Diaz
const mikelProfile = VENDOR_PROFILES['MIKELANGELO DIAZ'];
VENDOR_PROFILES['MIKELANGELODIAZ@GMAIL.COM'] = mikelProfile;
VENDOR_PROFILES['MIKELANGELO'] = mikelProfile;
VENDOR_PROFILES['MIKELANGELO DIAZ1'] = mikelProfile;
VENDOR_PROFILES['MIKELANGELO DIAZ - VILLA DEL ROS'] = mikelProfile;
VENDOR_PROFILES['MIKELANGELO DIAZ VILLA DEL ROS'] = mikelProfile;
VENDOR_PROFILES['MIKELANGELO VILLA DEL ROS'] = mikelProfile;
VENDOR_PROFILES['JOHNATAN SOTO'] = mikelProfile;
VENDOR_PROFILES['JOHNATAN SOTO VILLA DEL ROS'] = mikelProfile;
VENDOR_PROFILES['JOHNATAN'] = mikelProfile;
VENDOR_PROFILES['JONATHAN'] = mikelProfile;
VENDOR_PROFILES['JHONATAN'] = mikelProfile;
VENDOR_PROFILES['JAIDER MEDINA'] = VENDOR_PROFILES['JAIDER MEDINA - FOOD SERVICE NORTE'];
VENDOR_PROFILES['FOOD SERVICE NORTE'] = VENDOR_PROFILES['JAIDER MEDINA - FOOD SERVICE NORTE'];
VENDOR_PROFILES['MARIANGEL'] = VENDOR_PROFILES['MARIANGEL GONZALEZ'];
VENDOR_PROFILES['FOOD SERVICE SENIOR - JUAN HERNANDEZ'] = VENDOR_PROFILES['JUAN HERNANDEZ'];
VENDOR_PROFILES['FOOD SERVICE SENIOR'] = VENDOR_PROFILES['JUAN HERNANDEZ'];
VENDOR_PROFILES['CUENTAS CLAVES 1 - MC'] = VENDOR_PROFILES['MARIANA CHACIN'];
VENDOR_PROFILES['CUENTAS CLAVE 1 - MC'] = VENDOR_PROFILES['MARIANA CHACIN'];
VENDOR_PROFILES['CUENTAS CLAVES 1'] = VENDOR_PROFILES['MARIANA CHACIN'];
VENDOR_PROFILES['CUENTAS CLAVE 1'] = VENDOR_PROFILES['MARIANA CHACIN'];
VENDOR_PROFILES['CUENTAS CLAVES 2 - SV'] = VENDOR_PROFILES['SAIRU VALLES'];
VENDOR_PROFILES['CUENTAS CLAVE 2 - SV'] = VENDOR_PROFILES['SAIRU VALLES'];
VENDOR_PROFILES['CUENTAS CLAVES 2'] = VENDOR_PROFILES['SAIRU VALLES'];
VENDOR_PROFILES['CUENTAS CLAVE 2'] = VENDOR_PROFILES['SAIRU VALLES'];
VENDOR_PROFILES['OSCAR ORTIZ- LA COSTA'] = VENDOR_PROFILES['OSCAR ORTIZ'];
VENDOR_PROFILES['OSCAR ORTIZ - LA COSTA'] = VENDOR_PROFILES['OSCAR ORTIZ'];
VENDOR_PROFILES['OSCAR ORTIZ- CORO'] = VENDOR_PROFILES['OSCAR ORTIZ'];
VENDOR_PROFILES['OSCAR ORTIZ - CORO'] = VENDOR_PROFILES['OSCAR ORTIZ'];
VENDOR_PROFILES['LUIS GUANIPA'] = VENDOR_PROFILES['VICTORIA VARGAS'];

// Perfiles de los 3 Supervisores Comerciales Oficiales (Noviembre 2026)
export const SUPERVISOR_PROFILES: Record<string, SupervisorProfile> = {
  'ALI PEREZ': {
    canonicalUsername: 'ALI PEREZ',
    displayName: 'Alí Pérez (Supervisor)',
    supervisedVendors: [
      'ANGEL NAVARRO',
      'MARIANGEL GONZALEZ',
      'VICTOR CAMPOS',
      'ELISA SOLER',
      'LEONARDO RIOS',
      'VICTORIA VARGAS',
      'OSCAR ORTIZ'
    ]
  },
  'JOHNATAN SOTO': {
    canonicalUsername: 'JOHNATAN SOTO',
    displayName: 'Johnatan Soto (Supervisor)',
    supervisedVendors: [
      'MIKELANGELO DIAZ',
      'HERNAN PAZ',
      'OSWALDO CHURION',
      'ANGELICA MORENO',
      'ADEL JARABA',
      'JUAN HERNANDEZ',
      'JAIDER MEDINA - FOOD SERVICE NORTE'
    ]
  },
  'NELSON FINOL': {
    canonicalUsername: 'NELSON FINOL',
    displayName: 'Nelson Finol (Supervisor)',
    supervisedVendors: [
      'MARIA BRICEÑO',
      'MARIANA CHACIN',
      'CARLOS FUENMAYOR',
      'SARAH REYES',
      'J PABLO ARAUJO',
      'J PABLO ARAUJO - CAB/OJE',
      'JOSE G. GONZALEZ',
      'FOOD SERVICE SUR',
      'YOLEIDA LUGO',
      'SAIRU VALLES',
      'EDUARDO PIÑA',
      'MARYERY GARCIA',
      'PEDRO ABREU'
    ]
  }
};

// Etiquetado explícito de la semilla histórica de Zulia / Falcón como sucursal 'OCCIDENTE'
Object.values(VENDOR_PROFILES).forEach((prof) => {
  if (!prof.sucursal) prof.sucursal = 'OCCIDENTE';
  prof.routes.forEach((r) => {
    if (!r.sucursal) r.sucursal = prof.sucursal || 'OCCIDENTE';
  });
});
Object.values(SUPERVISOR_PROFILES).forEach((sup) => {
  if (!sup.sucursal) sup.sucursal = 'OCCIDENTE';
});

/**
 * Permite hidratar dinámicamente VENDOR_PROFILES y SUPERVISOR_PROFILES desde Supabase
 * (`public.vendedores`, `public.vendedores_maestro` o `public.rutas`) respetando `sucursal` ('CENTRO' | 'OCCIDENTE').
 */
export function hydrateVendorProfilesFromMasterCatalog(
  rows: Array<{
    nombre_canonico?: string;
    username?: string;
    nombre?: string;
    display_name?: string;
    ruta_oficial?: string;
    ruta?: string;
    aliases?: string[];
    supervisor?: string;
    email?: string;
    sucursal?: string;
    region?: string;
    zona?: string;
    role?: string;
    is_supervisor_route?: boolean;
    activo?: boolean;
  }>
): void {
  if (!Array.isArray(rows) || rows.length === 0) return;
  for (const r of rows) {
    if (r.activo === false) continue;
    const rowSucursal = inferSucursalFromLegacyMetadata(r.sucursal, `${r.region || ''} ${r.zona || ''}`);
    const rawRole = String(r.role || '').toUpperCase().trim();
    const canon = normalizeVendorName(r.nombre_canonico || r.username || r.nombre);
    if (!canon) continue;

    if (r.is_supervisor_route || rawRole === 'SUPERVISOR' || rawRole === 'COORDINADORA') {
      if (!SUPERVISOR_PROFILES[canon]) {
        SUPERVISOR_PROFILES[canon] = {
          canonicalUsername: canon,
          displayName: r.display_name || r.nombre || canon,
          sucursal: rowSucursal,
          supervisedVendors: []
        };
      } else if (normalizeSucursal(r.sucursal)) {
        SUPERVISOR_PROFILES[canon].sucursal = rowSucursal;
      }
      continue;
    }

    const sup = normalizeVendorName(r.supervisor);
    if (sup && SUPERVISOR_PROFILES[sup] && !SUPERVISOR_PROFILES[sup].supervisedVendors.includes(canon)) {
      SUPERVISOR_PROFILES[sup].supervisedVendors.push(canon);
    }

    const routeId = normalizeVendorName(r.ruta_oficial || r.ruta) || canon;
    const aliases = Array.from(
      new Set([canon, routeId, ...(r.aliases || []).map((a) => normalizeVendorName(a)).filter(Boolean)])
    );

    if (!VENDOR_PROFILES[canon]) {
      const display = r.display_name || r.nombre || canon;
      VENDOR_PROFILES[canon] = {
        canonicalUsername: canon,
        displayName: display,
        email: r.email || undefined,
        sucursal: rowSucursal,
        routes: [{ id: routeId, label: `Ruta ${display}`, aliases, sucursal: rowSucursal }],
      };
    } else {
      const existing = VENDOR_PROFILES[canon];
      if (normalizeSucursal(r.sucursal)) {
        existing.sucursal = rowSucursal;
      }
      const hasRoute = existing.routes.some((rt) => rt.id === routeId);
      if (!hasRoute && routeId) {
        existing.routes.push({
          id: routeId,
          label: `Ruta ${r.display_name || r.nombre || routeId}`,
          aliases,
          sucursal: rowSucursal
        });
      }
    }
  }
}

export function getSupervisorProfile(username: string | null | undefined): SupervisorProfile | null {
  const norm = normalizeVendorName(username).replace(/^SUPERVISOR:/, '').trim();
  if (!norm) return null;
  if (SUPERVISOR_PROFILES[norm]) return SUPERVISOR_PROFILES[norm];
  const clean = normalizeAsciiKey(norm);
  for (const [k, sup] of Object.entries(SUPERVISOR_PROFILES)) {
    if (normalizeAsciiKey(k) === clean) return sup;
  }
  return null;
}

export function getSupervisedRoutes(supervisorUsername: string): AssignedRoute[] {
  const sup = getSupervisorProfile(supervisorUsername);
  if (!sup) return [];
  const routes: AssignedRoute[] = [];
  const seen = new Set<string>();
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

export function getSupervisedAliases(supervisorUsername: string): string[] {
  const sup = getSupervisorProfile(supervisorUsername);
  if (!sup) return [];
  const routes = getSupervisedRoutes(supervisorUsername);
  return Array.from(
    new Set([
      ...sup.supervisedVendors,
      ...routes.flatMap((r) => [r.id, ...r.aliases])
    ])
  );
}

/**
 * Compara de forma exacta y precisa si el nombre del vendedor en la hoja de cálculo
 * coincide con alguno de los alias asignados a la ruta, usando `normalizeVendorKey` transversal.
 */
export function matchesVendorAlias(aliases: string[], sheetVendor: string | null | undefined): boolean {
  const normSheet = normalizeVendorName(sheetVendor);
  const canonSheet = normalizeVendorKey(sheetVendor);
  if (!normSheet && !canonSheet) return false;
  const cleanSheet = normalizeAsciiKey(canonSheet || normSheet);

  for (const a of aliases) {
    const normA = normalizeVendorName(a);
    const canonA = normalizeVendorKey(a);
    if (!normA && !canonA) continue;
    if (canonSheet && canonA && canonSheet === canonA) return true;
    if (normSheet === normA) return true;
    const cleanA = normalizeAsciiKey(canonA || normA);
    if (cleanSheet && cleanSheet === cleanA) return true;
  }
  return false;
}

/**
 * Obtiene el perfil del vendedor logueado asegurando privacidad total.
 * Los vendedores NO tienen acceso a compañeros; su dashboard es personal.
 */
export function getVendorProfile(username: string, fallbackSucursal?: Sucursal): VendorProfile {
  const normUser = normalizeVendorName(username);
  if (VENDOR_PROFILES[normUser]) {
    return VENDOR_PROFILES[normUser];
  }
  // Búsqueda insensible a caracteres especiales, tildes y espacios
  const cleanUser = normalizeAsciiKey(normUser);
  for (const [key, prof] of Object.entries(VENDOR_PROFILES)) {
    if (normalizeAsciiKey(key) === cleanUser || normalizeAsciiKey(prof.displayName) === cleanUser) {
      return prof;
    }
  }
  // Si contiene MIKELANGELO o JOHNATAN o SOTO
  if (/MIKELANGELO|JOHNATAN|JONATHAN|JHONATAN|SOTO/.test(normUser)) {
    return VENDOR_PROFILES['MIKELANGELO DIAZ'];
  }
  const resolvedSuc = normalizeSucursal(fallbackSucursal) || 'OCCIDENTE';
  // Fallback seguro: solo sus propias rutas homónimas dentro de su sucursal
  return {
    canonicalUsername: normUser,
    displayName: normUser,
    sucursal: resolvedSuc,
    routes: [
      { id: normUser, label: `Ruta ${normUser}`, aliases: [normUser], sucursal: resolvedSuc }
    ]
  };
}

/**
 * Obtiene las rutas asignadas que el usuario tiene permitido ver bajo su `sucursal` activa.
 * - ADMIN / COORDINADORA: únicamente las rutas pertenecientes a `activeSucursal` (si se especifica).
 * - SUPERVISOR: las rutas de su equipo dentro de su `sucursal`.
 * - VENDEDOR: ESTRICTAMENTE sus propias rutas dentro de su `sucursal`.
 */
export function getAllowedRoutesForUser(
  username: string,
  role: Role,
  activeSucursal?: Sucursal | null
): AssignedRoute[] {
  const branchFilter = normalizeSucursal(activeSucursal);

  if (role === 'ADMIN' || role === 'COORDINADORA') {
    const map = new Map<string, AssignedRoute>();
    Object.values(VENDOR_PROFILES).forEach((profile) => {
      const profSuc = profile.sucursal || 'OCCIDENTE';
      if (branchFilter && profSuc !== branchFilter) return;
      profile.routes.forEach((r) => {
        const rSuc = r.sucursal || profSuc;
        if (branchFilter && rSuc !== branchFilter) return;
        if (!map.has(r.id)) {
          map.set(r.id, r);
        }
      });
    });
    return Array.from(map.values());
  }

  if (role === 'SUPERVISOR') {
    const supRoutes = getSupervisedRoutes(username);
    if (!branchFilter) return supRoutes;
    return supRoutes.filter((r) => (r.sucursal || 'OCCIDENTE') === branchFilter);
  }

  // Para vendedor: ESTRICTAMENTE SUS PROPIAS RUTAS ASIGNADAS Y DE SU SUCURSAL
  const profile = getVendorProfile(username, branchFilter || undefined);
  if (!branchFilter) return profile.routes;
  return profile.routes.filter((r) => (r.sucursal || profile.sucursal || 'OCCIDENTE') === branchFilter);
}

/**
 * Verifica si un registro de la hoja de cálculo coincide con el filtro activo.
 * Garantiza de forma estricta que ningún vendedor acceda a perfiles de sus compañeros.
 */
export function isRouteMatch(
  sheetVendor: string | null | undefined,
  selectedRouteId: string,
  loggedInVendor: string,
  userRole: Role,
  activeSucursal?: Sucursal | null
): boolean {
  const normSheetVendor = normalizeVendorName(sheetVendor);
  if (!normSheetVendor) return false;
  // Nunca incluir la fila resumen de "ALI PEREZ" como si fuera un vendedor
  if (normSheetVendor === 'ALI PEREZ') return false;

  const branchFilter = normalizeSucursal(activeSucursal);
  if (branchFilter) {
    const matchedProfile = VENDOR_PROFILES[normSheetVendor] || Object.values(VENDOR_PROFILES).find((p) =>
      p.routes.some((r) => matchesVendorAlias([r.id, ...r.aliases], normSheetVendor))
    );
    if (matchedProfile && matchedProfile.sucursal && matchedProfile.sucursal !== branchFilter) {
      return false;
    }
  }

  // Filtro por equipo de supervisor (ej. SUPERVISOR:ALI PEREZ)
  if (selectedRouteId.startsWith('SUPERVISOR:')) {
    const supName = selectedRouteId.slice('SUPERVISOR:'.length);
    const supAliases = getSupervisedAliases(supName);
    if (userRole === 'ADMIN' || userRole === 'COORDINADORA') {
      return matchesVendorAlias(supAliases, normSheetVendor);
    }
    if (userRole === 'SUPERVISOR') {
      const mySup = getSupervisorProfile(loggedInVendor);
      if (mySup && matchesVendorAlias([mySup.canonicalUsername], supName)) {
        return matchesVendorAlias(supAliases, normSheetVendor);
      }
      return false;
    }
  }

  // 1. Acceso de Administrador o Coordinadora de Sede (acotado por activeSucursal arriba)
  if (userRole === 'ADMIN' || userRole === 'COORDINADORA') {
    if (selectedRouteId === 'ADMIN' || selectedRouteId === 'COORDINADORA_ALL') return true;
    
    // Si el admin seleccionó un vendedor consolidado (todas sus rutas)
    const isConsolidated = selectedRouteId.startsWith('CONSOLIDATED:');
    if (isConsolidated) {
      const rawTarget = selectedRouteId.replace(/^CONSOLIDATED:/, '');
      const profile = getVendorProfile(rawTarget);

      if (profile) {
        const allAliases = profile.routes.flatMap(r => r.aliases);
        return matchesVendorAlias(allAliases, normSheetVendor);
      }
    }

    // Si el admin seleccionó una ruta específica
    for (const p of Object.values(VENDOR_PROFILES)) {
      const found = p.routes.find(r => r.id === selectedRouteId || matchesVendorAlias([r.id, ...r.aliases], selectedRouteId));
      if (found) {
        return matchesVendorAlias(found.aliases, normSheetVendor);
      }
    }

    return matchesVendorAlias([selectedRouteId], normSheetVendor);
  }

  // 2. Acceso de SUPERVISOR (Equipo supervisado)
  if (userRole === 'SUPERVISOR') {
    const mySupAliases = getSupervisedAliases(loggedInVendor);
    const mySupRoutes = getSupervisedRoutes(loggedInVendor);
    if (selectedRouteId === 'SUPERVISOR_ALL' || selectedRouteId === 'ALL_MY_ROUTES') {
      return matchesVendorAlias(mySupAliases, normSheetVendor);
    }
    if (selectedRouteId.startsWith('CONSOLIDATED:')) {
      const rawTarget = selectedRouteId.replace(/^CONSOLIDATED:/, '');
      const sup = getSupervisorProfile(loggedInVendor);
      if (sup && sup.supervisedVendors.some(v => matchesVendorAlias([v], rawTarget))) {
        const prof = getVendorProfile(rawTarget);
        return matchesVendorAlias(prof.routes.flatMap(r => r.aliases), normSheetVendor);
      }
      return false;
    }
    const targetRoute = mySupRoutes.find(r => r.id === selectedRouteId || matchesVendorAlias([r.id, ...r.aliases], selectedRouteId));
    if (targetRoute) {
      return matchesVendorAlias(targetRoute.aliases, normSheetVendor);
    }
    return false;
  }

  // 3. Acceso de VENDEDOR (Personal y Restringido)
  const profile = getVendorProfile(loggedInVendor);
  const myAssignedRoutes = profile.routes;

  // Si seleccionó consolidado ("ALL_MY_ROUTES")
  if (selectedRouteId === 'ALL_MY_ROUTES') {
    const myAllAliases = myAssignedRoutes.flatMap(r => r.aliases);
    return matchesVendorAlias(myAllAliases, normSheetVendor);
  }

  // Si seleccionó una ruta específica de las que tiene asignadas
  const targetRoute = myAssignedRoutes.find(r => r.id === selectedRouteId || matchesVendorAlias([r.id, ...r.aliases], selectedRouteId));
  if (targetRoute) {
    return matchesVendorAlias(targetRoute.aliases, normSheetVendor);
  }

  // Por seguridad: si de alguna manera seleccionó una ruta ajena, se deniega totalmente
  return false;
}
