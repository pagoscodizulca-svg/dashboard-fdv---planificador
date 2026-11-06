import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseMaestraBytes, parseMaestraTexto } from '../../src/utils/maestraParser';
import {
  sincronizarMaestra,
  calcularPreviewDb,
  chunk,
  MaestraBajasMasivasError,
  MaestraEsquemaError,
  MAESTRA_CHUNK_SIZE,
  type MaestraRepo,
  type FilaClienteDb,
  type FilaVendedorDb,
  type FilaSupervisorDb
} from '../../src/utils/maestraSync';

/** Repositorio en memoria que imita la semántica de Supabase (upsert por PK, soft delete por ultima_carga_id). */
function crearRepoMemoria(opciones: { sinEsquema?: boolean; fallarEnLote?: number } = {}) {
  const clientes = new Map<number, FilaClienteDb>();
  const vendedores = new Map<number, FilaVendedorDb>();
  const supervisores = new Map<string, FilaSupervisorDb>();
  const cargas: Array<{ id: string; estado: string; sha?: string; error?: string }> = [];
  const tamanosLote: number[] = [];
  const log = { deletes: 0 };
  let seq = 0;
  let lotesEscritos = 0;

  const repo: MaestraRepo = {
    async verificarEsquema() {
      if (opciones.sinEsquema) throw new MaestraEsquemaError('faltan tablas');
    },
    async listarClientes() {
      return [...clientes.values()].map(c => ({ id_cliente: c.id_cliente, activo: c.activo, id_vendedor: c.id_vendedor }));
    },
    async listarVendedores() {
      return [...vendedores.values()].map(v => ({ id_vendedor: v.id_vendedor, activo: v.activo }));
    },
    async buscarCargaAplicada(sha) {
      const c = cargas.find(x => x.sha === sha && (x.estado === 'OK' || x.estado === 'ADVERTENCIA'));
      return c ? { id: c.id, finalizado_en: null } : null;
    },
    async crearCarga(meta) {
      const id = `carga-${++seq}`;
      cargas.push({ id, estado: 'EN_CURSO', sha: meta.archivoSha256 });
      return id;
    },
    async upsertSupervisores(rows) {
      rows.forEach(r => supervisores.set(r.nombre, { ...supervisores.get(r.nombre), ...r }));
    },
    async upsertVendedores(rows) {
      rows.forEach(r => vendedores.set(r.id_vendedor, { ...vendedores.get(r.id_vendedor), ...r }));
    },
    async upsertClientes(rows) {
      lotesEscritos++;
      if (opciones.fallarEnLote && lotesEscritos === opciones.fallarEnLote) throw new Error('fallo simulado de red');
      tamanosLote.push(rows.length);
      // Semántica de Supabase: dos filas con la misma PK en un mismo lote provocan error
      const ids = rows.map(r => r.id_cliente);
      if (new Set(ids).size !== ids.length) throw new Error('ON CONFLICT DO UPDATE command cannot affect row a second time');
      rows.forEach(r => clientes.set(r.id_cliente, { ...clientes.get(r.id_cliente), ...r }));
    },
    async desactivarClientesNoVigentes(cargaId, ahora) {
      let n = 0;
      clientes.forEach(c => {
        if (c.activo && c.ultima_carga_id !== cargaId) {
          c.activo = false;
          c.fecha_baja = ahora;
          n++;
        }
      });
      return n;
    },
    async desactivarVendedoresNoVigentes(cargaId, ahora) {
      let n = 0;
      vendedores.forEach(v => {
        if (v.activo && v.ultima_carga_id !== cargaId) {
          v.activo = false;
          v.fecha_baja = ahora;
          n++;
        }
      });
      return n;
    },
    async desactivarSupervisoresNoVigentes(cargaId, ahora) {
      let n = 0;
      supervisores.forEach(s => {
        if (s.activo && s.ultima_carga_id !== cargaId) {
          s.activo = false;
          s.fecha_baja = ahora;
          n++;
        }
      });
      return n;
    },
    async contarClientesActivosPorVendedor() {
      const r: Record<number, number> = {};
      clientes.forEach(c => {
        if (c.activo) r[c.id_vendedor] = (r[c.id_vendedor] || 0) + 1;
      });
      return r;
    },
    async cerrarCarga(id, estado, _resumen, error) {
      const c = cargas.find(x => x.id === id)!;
      c.estado = estado;
      c.error = error;
    }
  };
  return { repo, clientes, vendedores, supervisores, cargas, tamanosLote, log };
}

const CSV = new Uint8Array(fs.readFileSync(path.resolve(__dirname, '../fixtures/MAESTRA_ACTIVA_ultima_version.csv')));
const HEAD = 'SUPERVISOR;ID VENDEDOR;Vendedor;Id;Razón Social;RIF';
const csvMini = (filas: string[]) => parseMaestraTexto(`${HEAD}\n${filas.join('\n')}\n`);

describe('maestraSync · archivo real', () => {
  it('chunk() parte en lotes de 500', () => {
    expect(chunk(Array.from({ length: 1201 }, (_, i) => i), 500).map(c => c.length)).toEqual([500, 500, 201]);
    expect(MAESTRA_CHUNK_SIZE).toBe(500);
  });

  it('carga inicial: 2,716 clientes en 6 lotes de ≤500, 30 vendedores, 3 supervisores, verificación OK', async () => {
    const parsed = parseMaestraBytes(CSV);
    const mem = crearRepoMemoria();
    const r = await sincronizarMaestra(mem.repo, parsed, { archivoSha256: 'h1' });

    expect(r.estado).toBe('OK');
    expect(mem.clientes.size).toBe(2716);
    expect(mem.vendedores.size).toBe(30);
    expect(mem.supervisores.size).toBe(3);
    expect(mem.tamanosLote).toEqual([500, 500, 500, 500, 500, 216]);
    expect(r.clientes).toMatchObject({ enArchivo: 2716, nuevos: 2716, desactivados: 0 });
    expect(r.verificacion).toMatchObject({ ok: true, activosEnBd: 2716, esperados: 2716 });
    expect([...mem.clientes.values()].every(c => c.activo && c.fecha_baja === null)).toBe(true);
    expect(mem.clientes.get(8377)!.id_vendedor).toBe(40);
    expect([...mem.clientes.values()].filter(c => c.rif === null)).toHaveLength(115);
  });

  it('es idempotente: cargar dos veces el mismo archivo no cambia nada ni da de baja', async () => {
    const parsed = parseMaestraBytes(CSV);
    const mem = crearRepoMemoria();
    await sincronizarMaestra(mem.repo, parsed, { archivoSha256: 'h1' });
    const r2 = await sincronizarMaestra(mem.repo, parsed, { archivoSha256: 'h1' });
    expect(r2.yaCargadoAntes).toBe(true);
    expect(r2.clientes).toMatchObject({ nuevos: 0, actualizados: 2716, reactivados: 0, desactivados: 0, cambiosVendedor: 0 });
    expect(mem.clientes.size).toBe(2716);
    expect([...mem.clientes.values()].filter(c => c.activo)).toHaveLength(2716);
  });

  it('el UPSERT no recibe Ids repetidos en un lote (8377 ya viene deduplicado)', async () => {
    const mem = crearRepoMemoria();
    await expect(sincronizarMaestra(mem.repo, parseMaestraBytes(CSV))).resolves.toBeTruthy();
  });
});

describe('maestraSync · soft delete', () => {
  it('desactiva (no borra) clientes y vendedores que ya no vienen y reactiva los que vuelven', async () => {
    const mem = crearRepoMemoria();
    const base = Array.from({ length: 20 }, (_, i) => `NELSON FINOL;1;V1;${100 + i};CLI ${i};J-${100 + i}`);
    await sincronizarMaestra(mem.repo, csvMini([...base, 'ALI PEREZ;2;V2;500;SOLO ANTES;J-500']));
    expect([...mem.clientes.values()].filter(c => c.activo)).toHaveLength(21);

    // Mes siguiente: sale el cliente 500 y el vendedor 2 (1 de 21 = 4.8 %, bajo el umbral)
    const r = await sincronizarMaestra(mem.repo, csvMini(base));
    expect(r.clientes.desactivados).toBe(1);
    expect(r.vendedores.desactivados).toBe(1);
    expect(r.supervisores.desactivados).toBe(1);
    expect(mem.clientes.get(500)).toMatchObject({ activo: false });
    expect(mem.clientes.get(500)!.fecha_baja).toBeTruthy();
    expect(mem.clientes.size).toBe(21); // sigue existiendo: no hubo DELETE
    expect(mem.vendedores.get(2)!.activo).toBe(false);
    expect(mem.supervisores.get('ALI PEREZ')!.activo).toBe(false);

    // Vuelve el cliente 500: se reactiva y se limpia fecha_baja
    const r3 = await sincronizarMaestra(mem.repo, csvMini([...base, 'ALI PEREZ;2;V2;500;SOLO ANTES;J-500']));
    expect(r3.clientes.reactivados).toBe(1);
    expect(mem.clientes.get(500)).toMatchObject({ activo: true, fecha_baja: null });
    expect(mem.vendedores.get(2)!.activo).toBe(true);
  });

  it('actualiza razón social, RIF, vendedor y supervisor de un cliente existente y cuenta el cambio de vendedor', async () => {
    const mem = crearRepoMemoria();
    await sincronizarMaestra(mem.repo, csvMini(['A;1;V1;10;NOMBRE VIEJO;J-1', 'A;1;V1;11;OTRO;J-2']));
    const r = await sincronizarMaestra(mem.repo, csvMini(['B;2;V2;10;NOMBRE NUEVO;#N/D', 'A;1;V1;11;OTRO;J-2']));
    expect(r.clientes.cambiosVendedor).toBe(1);
    expect(mem.clientes.get(10)).toMatchObject({ razon_social: 'NOMBRE NUEVO', rif: null, id_vendedor: 2, supervisor: 'B' });
  });

  it('freno: dar de baja >10 % de los activos aborta sin escribir; con forzarBajas procede', async () => {
    const mem = crearRepoMemoria();
    const filas = Array.from({ length: 10 }, (_, i) => `A;1;V1;${i + 1};C${i};J-${i + 1}`);
    await sincronizarMaestra(mem.repo, csvMini(filas));
    const truncado = csvMini(filas.slice(0, 5)); // 50 % de bajas

    const cargasAntes = mem.cargas.length;
    await expect(sincronizarMaestra(mem.repo, truncado)).rejects.toBeInstanceOf(MaestraBajasMasivasError);
    expect(mem.cargas.length).toBe(cargasAntes); // ni siquiera se registró carga
    expect([...mem.clientes.values()].filter(c => c.activo)).toHaveLength(10);

    const r = await sincronizarMaestra(mem.repo, truncado, { forzarBajas: true });
    expect(r.clientes.desactivados).toBe(5);
  });

  it('un archivo sin clientes válidos no escribe ni da de baja nada', async () => {
    const mem = crearRepoMemoria();
    await sincronizarMaestra(mem.repo, csvMini(['A;1;V1;1;C;J-1']));
    await expect(sincronizarMaestra(mem.repo, csvMini([';;;;;#N/D']))).rejects.toThrow(/no tiene clientes válidos/);
    expect(mem.clientes.get(1)!.activo).toBe(true);
  });
});

describe('maestraSync · fallos y esquema', () => {
  it('si falla un lote NO se da de baja a nadie y la carga queda en ERROR; reintentar completa el trabajo', async () => {
    const filas = Array.from({ length: 1200 }, (_, i) => `A;1;V1;${i + 1};C${i};J-${i + 1}`);
    const mem0 = crearRepoMemoria();
    await sincronizarMaestra(mem0.repo, csvMini(filas));

    // Segunda carga (misma maestra salvo 1 cliente nuevo) con fallo en el 2.º lote
    const mem = crearRepoMemoria({ fallarEnLote: 2 });
    mem0.clientes.forEach((c, k) => mem.clientes.set(k, { ...c }));
    mem0.vendedores.forEach((v, k) => mem.vendedores.set(k, { ...v }));
    mem0.supervisores.forEach((s, k) => mem.supervisores.set(k, { ...s }));

    await expect(sincronizarMaestra(mem.repo, csvMini([...filas, 'A;1;V1;9999;NUEVO;J-9']))).rejects.toThrow(/fallo simulado/);
    expect(mem.cargas.at(-1)!.estado).toBe('ERROR');
    expect([...mem.clientes.values()].filter(c => c.activo)).toHaveLength(1200); // nadie dado de baja

    const ok = await sincronizarMaestra(mem.repo, csvMini([...filas, 'A;1;V1;9999;NUEVO;J-9'])); // reintento sin fallo
    expect(ok.estado).toBe('OK');
    expect(mem.clientes.get(9999)!.activo).toBe(true);
  });

  it('sin tablas: sincronizar lanza MaestraEsquemaError y el preview informa esquemaDisponible=false', async () => {
    const mem = crearRepoMemoria({ sinEsquema: true });
    const parsed = parseMaestraBytes(CSV);
    await expect(sincronizarMaestra(mem.repo, parsed)).rejects.toBeInstanceOf(MaestraEsquemaError);
    const pv = await calcularPreviewDb(mem.repo, parsed);
    expect(pv.esquemaDisponible).toBe(false);
  });

  it('preview contra base vacía: 2,716 nuevos, 0 bajas, sin escribir', async () => {
    const mem = crearRepoMemoria();
    const pv = await calcularPreviewDb(mem.repo, parseMaestraBytes(CSV));
    expect(pv).toMatchObject({ esquemaDisponible: true, nuevos: 2716, aBaja: 0, activosActuales: 0, requiereConfirmarBajas: false });
    expect(mem.clientes.size).toBe(0);
    expect(mem.cargas).toHaveLength(0);
  });
});
