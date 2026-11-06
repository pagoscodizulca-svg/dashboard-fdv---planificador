import React, { useCallback, useRef, useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, Loader2, Database, FileSpreadsheet, RefreshCw, XCircle } from 'lucide-react';
import { getAuthHeaders } from '../services/authService';
import { REFERENCIA_MAESTRA_NOV_2026, type MaestraReporte } from '../utils/maestraParser';

interface PreviewResponse {
  success: boolean;
  archivo: { nombre: string; sha256: string; bytes: number };
  reporte: MaestraReporte;
  supervisores: string[];
  vendedores: Array<{ idVendedor: number; nombre: string; supervisor: string; clientes: number }>;
  db: null | {
    esquemaDisponible: boolean;
    mensajeEsquema?: string;
    activosActuales: number;
    nuevos: number;
    actualizados: number;
    reactivados: number;
    aBaja: number;
    aBajaMuestra: number[];
    cambiosVendedor: number;
    porcentajeBajas: number;
    requiereConfirmarBajas: boolean;
    yaCargado: boolean;
  };
}

interface SyncResultado {
  cargaId: string;
  estado: 'OK' | 'ADVERTENCIA';
  clientes: { enArchivo: number; nuevos: number; actualizados: number; reactivados: number; desactivados: number; cambiosVendedor: number };
  vendedores: { enArchivo: number; desactivados: number };
  supervisores: { enArchivo: number; desactivados: number };
  verificacion: { ok: boolean; activosEnBd: number; esperados: number; diferenciasPorVendedor: Array<{ idVendedor: number; esperado: number; enBd: number }> };
}

interface Props {
  /** Se invoca tras una sincronización exitosa para refrescar el estado del Dashboard de Vendedores. */
  onSynced?: () => void | Promise<void>;
}

const fmt = (n: number) => n.toLocaleString('es-VE');

function leerComoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => resolve(String(reader.result || '').replace(/^data:[^;]*;base64,/, ''));
    reader.readAsDataURL(file);
  });
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    const err = new Error(data?.error || `Error HTTP ${res.status}`);
    (err as any).code = data?.code;
    throw err;
  }
  return data as T;
}

function Kpi({ label, value, referencia, nota }: { label: string; value: number; referencia?: number; nota?: string }) {
  const tieneRef = referencia !== undefined;
  const coincide = tieneRef && value === referencia;
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-2xl font-mono font-bold text-white mt-1">{fmt(value)}</div>
      {tieneRef && (
        <div className={`text-[11px] mt-1 font-mono ${coincide ? 'text-emerald-400' : 'text-amber-400'}`}>
          {coincide ? `✓ coincide con referencia (${fmt(referencia!)})` : `≠ referencia nov-2026: ${fmt(referencia!)}`}
        </div>
      )}
      {nota && <div className="text-[11px] mt-1 text-neutral-500">{nota}</div>}
    </div>
  );
}

export function ActualizarMaestra({ onSynced }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<{ nombre: string; base64: string } | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [resultado, setResultado] = useState<SyncResultado | null>(null);
  const [cargando, setCargando] = useState<'preview' | 'sync' | null>(null);
  const [error, setError] = useState<{ mensaje: string; code?: string } | null>(null);
  const [confirmarBajas, setConfirmarBajas] = useState(false);

  const reiniciar = useCallback(() => {
    setArchivo(null);
    setPreview(null);
    setResultado(null);
    setError(null);
    setConfirmarBajas(false);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const onArchivo = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResultado(null);
    setPreview(null);
    setConfirmarBajas(false);
    setCargando('preview');
    try {
      const base64 = await leerComoBase64(file);
      setArchivo({ nombre: file.name, base64 });
      const data = await postJson<PreviewResponse>('/api/maestra/preview', { csvBase64: base64, archivo: file.name });
      setPreview(data);
    } catch (e: any) {
      setError({ mensaje: e?.message || 'No se pudo analizar el archivo.', code: e?.code });
    } finally {
      setCargando(null);
    }
  }, []);

  const confirmar = useCallback(async () => {
    if (!archivo) return;
    setError(null);
    setCargando('sync');
    try {
      const data = await postJson<{ resultado: SyncResultado }>('/api/maestra/sync', {
        csvBase64: archivo.base64,
        archivo: archivo.nombre,
        forzarBajas: confirmarBajas
      });
      setResultado(data.resultado);
      setPreview(null);
      await onSynced?.(); // refresca la cartera del Dashboard de Vendedores
    } catch (e: any) {
      setError({ mensaje: e?.message || 'Error al sincronizar la maestra.', code: e?.code });
    } finally {
      setCargando(null);
    }
  }, [archivo, confirmarBajas, onSynced]);

  const rep = preview?.reporte;
  const db = preview?.db;
  const bloqueadoPorEsquema = Boolean(db && !db.esquemaDisponible);
  const bloqueadoPorBajas = Boolean(db?.requiereConfirmarBajas && !confirmarBajas);
  const puedeConfirmar = Boolean(preview && !cargando && !bloqueadoPorEsquema && !bloqueadoPorBajas && (rep?.clientesUnicos ?? 0) > 0);
  const advertencias = rep?.warnings || [];

  return (
    <section className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-red-500" /> Actualizar Maestra de Clientes y Vendedores
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            Sube el CSV “MAESTRA ACTIVA”. Primero verás una vista previa; no se escribe nada en la base hasta que confirmes.
          </p>
        </div>
        {(archivo || resultado) && (
          <button onClick={reiniciar} className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 border border-neutral-800 rounded-full px-3 py-1.5">
            <RefreshCw className="w-3 h-3" /> Cargar otro archivo
          </button>
        )}
      </div>

      {!resultado && (
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-neutral-800 hover:border-neutral-600 rounded-2xl p-8 cursor-pointer bg-neutral-950 transition-colors">
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => onArchivo(e.target.files?.[0])} />
          {cargando === 'preview' ? <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" /> : <Upload className="w-8 h-8 text-neutral-500" />}
          <span className="text-sm text-neutral-300">
            {cargando === 'preview' ? 'Analizando archivo…' : archivo ? archivo.nombre : 'Haz clic para seleccionar el archivo .csv (UTF-8, separado por “;”)'}
          </span>
        </label>
      )}

      {error && (
        <div className="flex gap-3 items-start bg-red-950/40 border border-red-900 rounded-xl p-4 text-sm text-red-200">
          <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">{error.mensaje}</div>
            {error.code === 'BAJAS_MASIVAS' && <div className="text-red-300/80 mt-1">Marca la casilla de confirmación de bajas y vuelve a confirmar si el archivo es correcto.</div>}
          </div>
        </div>
      )}

      {preview && rep && (
        <>
          {rep.banner && <div className="text-xs text-neutral-500 font-mono">Banner detectado: {rep.banner}</div>}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Filas leídas" value={rep.filasLeidas} />
            <Kpi label="Filas válidas" value={rep.filasValidas} referencia={REFERENCIA_MAESTRA_NOV_2026.filasValidas} />
            <Kpi label="Filas descartadas" value={rep.filasDescartadas} referencia={REFERENCIA_MAESTRA_NOV_2026.filasDescartadas} nota="Sin Id o sin ID VENDEDOR (residuos de Excel)" />
            <Kpi label="Clientes únicos" value={rep.clientesUnicos} nota="Después de deduplicar por Id" />
            <Kpi label="Supervisores" value={rep.totalSupervisores} referencia={REFERENCIA_MAESTRA_NOV_2026.totalSupervisores} />
            <Kpi label="Vendedores activos" value={rep.totalVendedores} referencia={REFERENCIA_MAESTRA_NOV_2026.totalVendedores} />
            <Kpi label="Clientes con RIF #N/D" value={rep.rifPendientesFilas} referencia={REFERENCIA_MAESTRA_NOV_2026.rifPendientesFilas} nota={`${fmt(rep.rifPendientesClientes)} clientes únicos (se guardan como NULL)`} />
            <Kpi label="Ids duplicados en archivo" value={rep.idsDuplicadosEnArchivo} referencia={REFERENCIA_MAESTRA_NOV_2026.idsDuplicadosEnArchivo} nota="Gana la última fila" />
          </div>

          {db && !db.esquemaDisponible && (
            <div className="flex gap-3 items-start bg-amber-950/40 border border-amber-800 rounded-xl p-4 text-sm text-amber-200">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Faltan las tablas de la maestra en Supabase</div>
                <div className="text-amber-300/80 mt-1">{db.mensajeEsquema}</div>
              </div>
            </div>
          )}

          {db && db.esquemaDisponible && (
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4">
              <div className="text-sm font-semibold text-white mb-3">Efecto sobre la base de datos (clientes)</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                {[
                  ['Nuevos', db.nuevos, 'text-emerald-400'],
                  ['Actualizados', db.actualizados, 'text-sky-400'],
                  ['Reactivados', db.reactivados, 'text-violet-400'],
                  ['Se darán de baja', db.aBaja, db.aBaja > 0 ? 'text-amber-400' : 'text-neutral-400'],
                  ['Cambian de vendedor', db.cambiosVendedor, 'text-neutral-200']
                ].map(([l, v, c]) => (
                  <div key={String(l)}>
                    <div className={`text-2xl font-mono font-bold ${c}`}>{fmt(Number(v))}</div>
                    <div className="text-[11px] text-neutral-500">{l}</div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-neutral-500 mt-3">
                Activos hoy en la maestra: {fmt(db.activosActuales)}. Las bajas son lógicas (activo = false): el historial no se borra.
                {db.yaCargado && ' · Este mismo archivo ya fue cargado antes; la carga es idempotente.'}
              </div>
              {db.requiereConfirmarBajas && (
                <label className="flex items-center gap-2 mt-3 text-sm text-amber-300 cursor-pointer">
                  <input type="checkbox" checked={confirmarBajas} onChange={e => setConfirmarBajas(e.target.checked)} />
                  Las bajas superan el 10 % ({(db.porcentajeBajas * 100).toFixed(1)} %): confirmo que el archivo está completo.
                </label>
              )}
            </div>
          )}

          {advertencias.length > 0 && (
            <details className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4" open={advertencias.some(w => w.tipo === 'ID_CLIENTE_DUPLICADO')}>
              <summary className="text-sm font-semibold text-white cursor-pointer">Advertencias de validación ({advertencias.length})</summary>
              <ul className="mt-3 space-y-2 text-xs text-neutral-400">
                {advertencias.slice(0, 50).map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span><span className="font-mono text-amber-400">{w.tipo}</span> · {w.mensaje}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <details className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4">
            <summary className="text-sm font-semibold text-white cursor-pointer">Vendedores del archivo ({preview.vendedores.length})</summary>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-xs text-left">
                <thead className="text-neutral-500">
                  <tr><th className="py-1 pr-3">ID</th><th className="pr-3">Vendedor</th><th className="pr-3">Supervisor</th><th className="text-right">Clientes</th></tr>
                </thead>
                <tbody className="text-neutral-300 font-mono">
                  {preview.vendedores.map(v => (
                    <tr key={v.idVendedor} className="border-t border-neutral-900">
                      <td className="py-1 pr-3">{v.idVendedor}</td><td className="pr-3">{v.nombre}</td><td className="pr-3">{v.supervisor}</td><td className="text-right">{fmt(v.clientes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <div className="flex justify-end">
            <button
              onClick={confirmar}
              disabled={!puedeConfirmar}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-sm font-semibold rounded-full px-6 py-2.5 transition-colors"
            >
              {cargando === 'sync' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              {cargando === 'sync' ? 'Sincronizando…' : 'Confirmar y sincronizar'}
            </button>
          </div>
        </>
      )}

      {resultado && (
        <div className={`border rounded-2xl p-5 ${resultado.estado === 'OK' ? 'bg-emerald-950/30 border-emerald-800' : 'bg-amber-950/30 border-amber-800'}`}>
          <div className={`flex items-center gap-2 font-semibold ${resultado.estado === 'OK' ? 'text-emerald-300' : 'text-amber-300'}`}>
            {resultado.estado === 'OK' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            {resultado.estado === 'OK' ? 'Maestra sincronizada correctamente' : 'Maestra sincronizada con diferencias en la verificación'}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-center">
            {[
              ['Clientes en archivo', resultado.clientes.enArchivo],
              ['Nuevos', resultado.clientes.nuevos],
              ['Actualizados', resultado.clientes.actualizados],
              ['Reactivados', resultado.clientes.reactivados],
              ['Dados de baja', resultado.clientes.desactivados],
              ['Vendedores', resultado.vendedores.enArchivo],
              ['Supervisores', resultado.supervisores.enArchivo],
              ['Activos en BD', resultado.verificacion.activosEnBd]
            ].map(([l, v]) => (
              <div key={String(l)}>
                <div className="text-xl font-mono font-bold text-white">{fmt(Number(v))}</div>
                <div className="text-[11px] text-neutral-400">{l}</div>
              </div>
            ))}
          </div>
          {!resultado.verificacion.ok && (
            <ul className="mt-3 text-xs text-amber-200 font-mono">
              {resultado.verificacion.diferenciasPorVendedor.map(d => (
                <li key={d.idVendedor}>Vendedor {d.idVendedor}: esperado {d.esperado} · en BD {d.enBd}</li>
              ))}
            </ul>
          )}
          <div className="text-[11px] text-neutral-500 mt-3 font-mono">Carga {resultado.cargaId} · el Dashboard de Vendedores ya fue refrescado.</div>
        </div>
      )}
    </section>
  );
}
