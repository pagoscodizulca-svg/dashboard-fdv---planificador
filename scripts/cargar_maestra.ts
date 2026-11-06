/**
 * CLI de carga de la MAESTRA ACTIVA (usa exactamente el mismo parser y la misma sincronización que la pantalla
 * "Actualizar Maestra").
 *
 *   npx tsx scripts/cargar_maestra.ts --archivo "C:/ruta/MAESTRA ACTIVA ultima version.csv"            # SOLO simula
 *   npx tsx scripts/cargar_maestra.ts --archivo "<csv>" --apply                                       # escribe en la BD
 *   npx tsx scripts/cargar_maestra.ts --archivo "<csv>" --apply --forzar-bajas                        # permite bajas > 10 %
 *
 * Variables de entorno requeridas (NO hay valores por defecto a propósito):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Antes de la primera carga ejecuta scripts/sql/02_maestra.sql en el SQL Editor de Supabase.
 */
import 'dotenv/config';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { parseMaestraBytes, REFERENCIA_MAESTRA_NOV_2026 } from '../src/utils/maestraParser';
import { crearMaestraRepoSupabase, calcularPreviewDb, sincronizarMaestra } from '../src/utils/maestraSync';

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (nombre: string) => process.argv.includes(`--${nombre}`);

function lineaKpi(label: string, valor: number, ref?: number): string {
  const marca = ref === undefined ? '' : valor === ref ? `  ✓ (ref ${ref})` : `  ≠ ref ${ref}`;
  return `  ${label.padEnd(34)} ${String(valor).padStart(6)}${marca}`;
}

async function main() {
  const archivo = arg('archivo');
  if (!archivo) {
    console.error('Uso: npx tsx scripts/cargar_maestra.ts --archivo <csv> [--apply] [--forzar-bajas]');
    process.exit(2);
  }
  const bytes = fs.readFileSync(archivo);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const parsed = parseMaestraBytes(new Uint8Array(bytes));
  const r = parsed.reporte;

  console.log(`\n=== PRE-AUDITORÍA · ${path.basename(archivo)} ===`);
  if (r.banner) console.log(`  Banner: ${r.banner}`);
  console.log(lineaKpi('Filas leídas', r.filasLeidas));
  console.log(lineaKpi('Filas válidas', r.filasValidas, REFERENCIA_MAESTRA_NOV_2026.filasValidas));
  console.log(lineaKpi('Filas descartadas', r.filasDescartadas, REFERENCIA_MAESTRA_NOV_2026.filasDescartadas));
  console.log(lineaKpi('Clientes únicos (tras deduplicar)', r.clientesUnicos));
  console.log(lineaKpi('Supervisores', r.totalSupervisores, REFERENCIA_MAESTRA_NOV_2026.totalSupervisores));
  console.log(lineaKpi('Vendedores', r.totalVendedores, REFERENCIA_MAESTRA_NOV_2026.totalVendedores));
  console.log(lineaKpi('Filas con RIF #N/D (→ NULL)', r.rifPendientesFilas, REFERENCIA_MAESTRA_NOV_2026.rifPendientesFilas));
  console.log(lineaKpi('Ids duplicados en archivo', r.idsDuplicadosEnArchivo, REFERENCIA_MAESTRA_NOV_2026.idsDuplicadosEnArchivo));
  if (r.warnings.length > 0) {
    console.log(`\n  Advertencias (${r.warnings.length}):`);
    r.warnings.slice(0, 20).forEach(w => console.log(`   - [${w.tipo}] ${w.mensaje}`));
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log('\n(Sin SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: solo se mostró la pre-auditoría del archivo.)');
    return;
  }
  const repo = crearMaestraRepoSupabase(createClient(url, key, { auth: { persistSession: false } }));

  const pv = await calcularPreviewDb(repo, parsed, { archivoSha256: sha256 });
  if (!pv.esquemaDisponible) {
    console.error(`\n✗ ${pv.mensajeEsquema}`);
    process.exit(1);
  }
  console.log('\n=== EFECTO SOBRE LA BASE (clientes) ===');
  console.log(`  Activos hoy: ${pv.activosActuales} | nuevos ${pv.nuevos} | actualizados ${pv.actualizados} | reactivados ${pv.reactivados} | a baja ${pv.aBaja} | cambian de vendedor ${pv.cambiosVendedor}`);
  if (pv.yaCargado) console.log('  (Este archivo ya fue cargado antes: la carga es idempotente.)');

  if (!flag('apply')) {
    console.log('\nSimulación terminada. No se escribió nada. Agrega --apply para sincronizar.');
    return;
  }

  const res = await sincronizarMaestra(repo, parsed, {
    periodo: new Date().toISOString().slice(0, 7),
    archivoNombre: path.basename(archivo),
    archivoSha256: sha256,
    creadoPor: 'CLI',
    forzarBajas: flag('forzar-bajas')
  });
  console.log(`\n=== POST-AUDITORÍA · carga ${res.cargaId} → ${res.estado} ===`);
  console.log(`  Clientes: en archivo ${res.clientes.enArchivo} | nuevos ${res.clientes.nuevos} | actualizados ${res.clientes.actualizados} | reactivados ${res.clientes.reactivados} | dados de baja ${res.clientes.desactivados}`);
  console.log(`  Vendedores: ${res.vendedores.enArchivo} (bajas ${res.vendedores.desactivados}) | Supervisores: ${res.supervisores.enArchivo} (bajas ${res.supervisores.desactivados})`);
  console.log(`  Verificación: activos en BD ${res.verificacion.activosEnBd} / esperados ${res.verificacion.esperados} → ${res.verificacion.ok ? 'OK' : 'CON DIFERENCIAS'}`);
  res.verificacion.diferenciasPorVendedor.forEach(d => console.log(`    vendedor ${d.idVendedor}: esperado ${d.esperado} · en BD ${d.enBd}`));
  if (!res.verificacion.ok) process.exit(1);
}

main().catch(err => {
  console.error('✗', err?.message || err);
  process.exit(1);
});
