/**
 * SINCRONIZACIÓN IDEMPOTENTE DE LA MAESTRA ACTIVA (UPSERT por lotes + SOFT DELETE)
 *
 * Todo el acceso a datos pasa por la interfaz `MaestraRepo`, de modo que la misma lógica se
 * ejecuta contra Supabase (producción / CLI) o contra un repositorio en memoria (tests).
 *
 * Flujo de `sincronizarMaestra`:
 *   1. Verifica que existan las tablas (si no, error claro con la instrucción de crear el esquema).
 *   2. Calcula el diff contra la base (nuevos / actualizados / reactivados / a dar de baja).
 *   3. Freno de seguridad: si la baja afectaría a más del 10 % de los clientes activos, aborta
 *      salvo `forzarBajas` (protege contra un CSV truncado).
 *   4. Registra la carga, hace UPSERT de supervisores -> vendedores -> clientes (lotes de 500).
 *   5. SOLO después de escribir TODOS los lotes marca activo=false a lo que no vino en el archivo.
 *      Si algo falla antes, no se da de baja nada y reintentar la carga es seguro.
 *   6. Verifica el resultado (activos == clientes del archivo, por vendedor) y cierra la carga.
 *
 * Nunca se hace DELETE físico.
 */
import type { MaestraParseResult } from './maestraParser';

export const MAESTRA_CHUNK_SIZE = 500;
export const MAESTRA_UMBRAL_BAJAS = 0.1;

export class MaestraEsquemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaestraEsquemaError';
  }
}

export class MaestraBajasMasivasError extends Error {
  public readonly bajas: number;
  public readonly activos: number;
  constructor(bajas: number, activos: number) {
    super(
      `La carga daría de baja ${bajas} de ${activos} clientes activos (${((bajas / activos) * 100).toFixed(1)} %), ` +
        `más del ${MAESTRA_UMBRAL_BAJAS * 100} % permitido. Revisa que el archivo no esté truncado o confirma explícitamente las bajas.`
    );
    this.name = 'MaestraBajasMasivasError';
    this.bajas = bajas;
    this.activos = activos;
  }
}

export interface FilaClienteDb {
  id_cliente: number;
  razon_social: string;
  rif: string | null;
  id_vendedor: number;
  supervisor: string | null;
  activo: boolean;
  fecha_baja: string | null;
  fecha_actualizacion: string;
  ultima_carga_id: string;
}
export interface FilaVendedorDb {
  id_vendedor: number;
  nombre: string;
  supervisor: string | null;
  activo: boolean;
  fecha_baja: string | null;
  fecha_actualizacion: string;
  ultima_carga_id: string;
}
export interface FilaSupervisorDb {
  nombre: string;
  activo: boolean;
  fecha_baja: string | null;
  fecha_actualizacion: string;
  ultima_carga_id: string;
}

export interface MaestraRepo {
  /** Lanza `MaestraEsquemaError` si faltan las tablas. */
  verificarEsquema(): Promise<void>;
  listarClientes(): Promise<Array<{ id_cliente: number; activo: boolean; id_vendedor: number | null }>>;
  listarVendedores(): Promise<Array<{ id_vendedor: number; activo: boolean }>>;
  buscarCargaAplicada(sha256: string): Promise<{ id: string; finalizado_en: string | null } | null>;
  crearCarga(meta: { periodo?: string; archivoNombre?: string; archivoSha256?: string; creadoPor?: string }): Promise<string>;
  upsertSupervisores(rows: FilaSupervisorDb[]): Promise<void>;
  upsertVendedores(rows: FilaVendedorDb[]): Promise<void>;
  upsertClientes(rows: FilaClienteDb[]): Promise<void>;
  /** activo=false (y fecha_baja) a todo activo cuya `ultima_carga_id` no sea la de esta carga. Devuelve cuántos. */
  desactivarClientesNoVigentes(cargaId: string, ahoraIso: string): Promise<number>;
  desactivarVendedoresNoVigentes(cargaId: string, ahoraIso: string): Promise<number>;
  desactivarSupervisoresNoVigentes(cargaId: string, ahoraIso: string): Promise<number>;
  contarClientesActivosPorVendedor(): Promise<Record<number, number>>;
  cerrarCarga(id: string, estado: 'OK' | 'ADVERTENCIA' | 'ERROR', resumen: unknown, error?: string): Promise<void>;
}

export function chunk<T>(arr: T[], size = MAESTRA_CHUNK_SIZE): T[][] {
  if (size < 1) throw new Error('size debe ser >= 1');
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export interface MaestraPreviewDb {
  esquemaDisponible: boolean;
  mensajeEsquema?: string;
  activosActuales: number;
  nuevos: number;
  actualizados: number;
  reactivados: number;
  aBaja: number;
  aBajaIds: number[];
  cambiosVendedor: number;
  porcentajeBajas: number;
  requiereConfirmarBajas: boolean;
  yaCargado: boolean;
}

/** Calcula, SIN escribir nada, el efecto que tendría la carga sobre la base actual. */
export async function calcularPreviewDb(
  repo: MaestraRepo,
  parsed: MaestraParseResult,
  opts: { archivoSha256?: string } = {}
): Promise<MaestraPreviewDb> {
  try {
    await repo.verificarEsquema();
  } catch (e: any) {
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
  const porId = new Map(actuales.map(c => [c.id_cliente, c]));
  const enArchivo = new Set(parsed.clientes.map(c => c.idCliente));

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
  const activos = actuales.filter(c => c.activo);
  const aBajaIds = activos.filter(c => !enArchivo.has(c.id_cliente)).map(c => c.id_cliente);
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

export interface MaestraSyncOptions {
  periodo?: string;
  archivoNombre?: string;
  archivoSha256?: string;
  creadoPor?: string;
  /** Permite una baja mayor al umbral de seguridad (10 %). */
  forzarBajas?: boolean;
  /** Reloj inyectable (tests). */
  ahora?: () => Date;
}

export interface MaestraSyncResult {
  cargaId: string;
  estado: 'OK' | 'ADVERTENCIA';
  clientes: { enArchivo: number; nuevos: number; actualizados: number; reactivados: number; desactivados: number; cambiosVendedor: number };
  vendedores: { enArchivo: number; desactivados: number };
  supervisores: { enArchivo: number; desactivados: number };
  lotes: { tamano: number; clientes: number };
  verificacion: { ok: boolean; activosEnBd: number; esperados: number; diferenciasPorVendedor: Array<{ idVendedor: number; esperado: number; enBd: number }> };
  yaCargadoAntes: boolean;
}

/** Sincroniza la maestra. Idempotente: ejecutar dos veces el mismo archivo no cambia nada la segunda vez. */
export async function sincronizarMaestra(
  repo: MaestraRepo,
  parsed: MaestraParseResult,
  opts: MaestraSyncOptions = {}
): Promise<MaestraSyncResult> {
  if (parsed.clientes.length === 0) {
    throw new Error('El archivo no tiene clientes válidos; no se escribe nada (evita dar de baja toda la cartera).');
  }
  const reloj = opts.ahora ?? (() => new Date());

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
    // 1. Supervisores -> 2. Vendedores (los clientes dependen de ellos por FK) -> 3. Clientes por lotes
    await repo.upsertSupervisores(
      parsed.supervisores.map(nombre => ({ nombre, activo: true, fecha_baja: null, fecha_actualizacion: ahoraIso, ultima_carga_id: cargaId }))
    );
    await repo.upsertVendedores(
      parsed.vendedores.map(v => ({
        id_vendedor: v.idVendedor,
        nombre: v.nombre,
        supervisor: v.supervisor || null,
        activo: true,
        fecha_baja: null,
        fecha_actualizacion: ahoraIso,
        ultima_carga_id: cargaId
      }))
    );
    const filasClientes: FilaClienteDb[] = parsed.clientes.map(c => ({
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

    // 4. Soft delete: recién ahora que TODO se escribió correctamente
    const clientesDesactivados = await repo.desactivarClientesNoVigentes(cargaId, ahoraIso);
    const vendedoresDesactivados = await repo.desactivarVendedoresNoVigentes(cargaId, ahoraIso);
    const supervisoresDesactivados = await repo.desactivarSupervisoresNoVigentes(cargaId, ahoraIso);

    // 5. Verificación post-carga
    const esperadoPorVendedor = new Map<number, number>();
    parsed.clientes.forEach(c => esperadoPorVendedor.set(c.idVendedor, (esperadoPorVendedor.get(c.idVendedor) || 0) + 1));
    const enBd = await repo.contarClientesActivosPorVendedor();
    const diferencias: Array<{ idVendedor: number; esperado: number; enBd: number }> = [];
    const todosVendedores = new Set<number>([...esperadoPorVendedor.keys(), ...Object.keys(enBd).map(Number)]);
    for (const idV of todosVendedores) {
      const esperado = esperadoPorVendedor.get(idV) || 0;
      const real = enBd[idV] || 0;
      if (esperado !== real) diferencias.push({ idVendedor: idV, esperado, enBd: real });
    }
    const activosEnBd = Object.values(enBd).reduce((a, b) => a + b, 0);
    const verificacionOk = diferencias.length === 0 && activosEnBd === parsed.clientes.length;
    const estado: 'OK' | 'ADVERTENCIA' = verificacionOk ? 'OK' : 'ADVERTENCIA';

    const result: MaestraSyncResult = {
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
  } catch (err: any) {
    try {
      await repo.cerrarCarga(cargaId, 'ERROR', { reporte: parsed.reporte }, String(err?.message || err));
    } catch {
      /* no ocultar el error original */
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Implementación sobre Supabase
// ---------------------------------------------------------------------------

function esErrorTablaInexistente(error: any): boolean {
  const code = String(error?.code || '');
  const msg = String(error?.message || '');
  return code === '42P01' || code === 'PGRST205' || /does not exist|schema cache|Could not find the table/i.test(msg);
}

const MSG_ESQUEMA =
  'Las tablas de la maestra no existen en Supabase. Ejecuta una vez el script scripts/sql/02_maestra.sql en el SQL Editor y vuelve a intentar.';

async function leerTodo<T>(
  supabase: any,
  tabla: string,
  columnas: string,
  orden: string,
  filtro?: (q: any) => any
): Promise<T[]> {
  const out: T[] = [];
  const PAGINA = 1000;
  for (let desde = 0; ; desde += PAGINA) {
    let q = supabase.from(tabla).select(columnas);
    if (filtro) q = filtro(q);
    const { data, error } = await q.order(orden).range(desde, desde + PAGINA - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < PAGINA) break;
  }
  return out;
}

function assertOk(error: any, contexto: string): void {
  if (error) throw new Error(`${contexto}: ${error.message || error}`);
}

/** Repositorio real sobre `@supabase/supabase-js` (cliente con service_role). */
export function crearMaestraRepoSupabase(supabase: any): MaestraRepo {
  const noVigente = (cargaId: string) => `ultima_carga_id.is.null,ultima_carga_id.neq.${cargaId}`;

  return {
    async verificarEsquema() {
      for (const tabla of ['maestra_cargas', 'maestra_supervisores', 'maestra_vendedores', 'maestra_clientes']) {
        const { error } = await supabase.from(tabla).select('*', { head: true, count: 'exact' }).limit(1);
        if (error) {
          if (esErrorTablaInexistente(error)) throw new MaestraEsquemaError(MSG_ESQUEMA);
          throw new Error(`No se pudo verificar la tabla ${tabla}: ${error.message}`);
        }
      }
    },
    listarClientes: () => leerTodo(supabase, 'maestra_clientes', 'id_cliente,activo,id_vendedor', 'id_cliente'),
    listarVendedores: () => leerTodo(supabase, 'maestra_vendedores', 'id_vendedor,activo', 'id_vendedor'),
    async buscarCargaAplicada(sha256) {
      const { data, error } = await supabase
        .from('maestra_cargas')
        .select('id,finalizado_en')
        .eq('archivo_sha256', sha256)
        .in('estado', ['OK', 'ADVERTENCIA'])
        .order('creado_en', { ascending: false })
        .limit(1);
      assertOk(error, 'Consultando cargas previas');
      return data && data.length > 0 ? data[0] : null;
    },
    async crearCarga(meta) {
      const { data, error } = await supabase
        .from('maestra_cargas')
        .insert({
          periodo: meta.periodo ?? null,
          archivo_nombre: meta.archivoNombre ?? null,
          archivo_sha256: meta.archivoSha256 ?? null,
          creado_por: meta.creadoPor ?? null,
          estado: 'EN_CURSO'
        })
        .select('id')
        .single();
      assertOk(error, 'Creando registro de carga');
      return data.id as string;
    },
    async upsertSupervisores(rows) {
      const { error } = await supabase.from('maestra_supervisores').upsert(rows, { onConflict: 'nombre' });
      assertOk(error, 'UPSERT maestra_supervisores');
    },
    async upsertVendedores(rows) {
      const { error } = await supabase.from('maestra_vendedores').upsert(rows, { onConflict: 'id_vendedor' });
      assertOk(error, 'UPSERT maestra_vendedores');
    },
    async upsertClientes(rows) {
      const { error } = await supabase.from('maestra_clientes').upsert(rows, { onConflict: 'id_cliente' });
      assertOk(error, `UPSERT maestra_clientes (lote de ${rows.length})`);
    },
    async desactivarClientesNoVigentes(cargaId, ahoraIso) {
      const { error, count } = await supabase
        .from('maestra_clientes')
        .update({ activo: false, fecha_baja: ahoraIso, fecha_actualizacion: ahoraIso }, { count: 'exact' })
        .eq('activo', true)
        .or(noVigente(cargaId));
      assertOk(error, 'Soft delete de clientes');
      return count ?? 0;
    },
    async desactivarVendedoresNoVigentes(cargaId, ahoraIso) {
      const { error, count } = await supabase
        .from('maestra_vendedores')
        .update({ activo: false, fecha_baja: ahoraIso, fecha_actualizacion: ahoraIso }, { count: 'exact' })
        .eq('activo', true)
        .or(noVigente(cargaId));
      assertOk(error, 'Soft delete de vendedores');
      return count ?? 0;
    },
    async desactivarSupervisoresNoVigentes(cargaId, ahoraIso) {
      const { error, count } = await supabase
        .from('maestra_supervisores')
        .update({ activo: false, fecha_baja: ahoraIso, fecha_actualizacion: ahoraIso }, { count: 'exact' })
        .eq('activo', true)
        .or(noVigente(cargaId));
      assertOk(error, 'Soft delete de supervisores');
      return count ?? 0;
    },
    async contarClientesActivosPorVendedor() {
      const filas = await leerTodo<{ id_cliente: number; id_vendedor: number }>(
        supabase,
        'maestra_clientes',
        'id_cliente,id_vendedor',
        'id_cliente',
        q => q.eq('activo', true)
      );
      const res: Record<number, number> = {};
      for (const f of filas) res[f.id_vendedor] = (res[f.id_vendedor] || 0) + 1;
      return res;
    },
    async cerrarCarga(id, estado, resumen, error) {
      const { error: e } = await supabase
        .from('maestra_cargas')
        .update({ estado, resumen, error: error ?? null, finalizado_en: new Date().toISOString() })
        .eq('id', id);
      assertOk(e, 'Cerrando registro de carga');
    }
  };
}

/**
 * Lee la cartera ACTIVA de la maestra con el formato `MasterClientSeed` que consume el parser del
 * Google Sheet. Devuelve `[]` (sin lanzar) si las tablas aún no existen o están vacías, para que el
 * resto del sistema use su fuente anterior.
 */
export async function leerCarteraActivaMaestra(
  supabase: any,
  idActivacionPorCodigo: Map<string, number> = new Map()
): Promise<
  Array<{ id?: number; cliente_codigo: string; cliente_nombre: string; vendedor_id: string; vendedor_nombre: string }>
> {
  try {
    const clientes = await leerTodo<{ id_cliente: number; razon_social: string; id_vendedor: number }>(
      supabase,
      'maestra_clientes',
      'id_cliente,razon_social,id_vendedor',
      'id_cliente',
      q => q.eq('activo', true)
    );
    if (clientes.length === 0) return [];
    const vendedores = await leerTodo<{ id_vendedor: number; nombre: string }>(
      supabase,
      'maestra_vendedores',
      'id_vendedor,nombre',
      'id_vendedor'
    );
    const nombrePorId = new Map(vendedores.map(v => [v.id_vendedor, v.nombre]));
    return clientes.map(c => {
      const codigo = String(c.id_cliente);
      const nombre = nombrePorId.get(c.id_vendedor) || String(c.id_vendedor);
      const idAct = idActivacionPorCodigo.get(codigo);
      return {
        ...(idAct !== undefined ? { id: idAct } : {}),
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
