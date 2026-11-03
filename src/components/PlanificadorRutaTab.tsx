import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Route,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Sparkles,
  FileDown,
  MapPin,
  CreditCard,
  ShoppingBag,
  XCircle,
  SlidersHorizontal,
  Wand2,
  UserCheck,
  Flame,
  TrendingUp,
  RotateCcw,
  Check
} from 'lucide-react';
import {
  AsignacionClienteRuta,
  ClienteRutaEnriquecido,
  DiaSemanaRuta,
  EstadoVisitaRuta,
  MotivoNoVentaRuta,
  RegistroVisitaRuta,
  Role
} from '../types';
import {
  DIAS_SEMANA_RUTA,
  MOTIVOS_NO_VENTA_RUTA,
  RUBRO_SHORT_LABELS,
  MANUAL_RUBROS_STORAGE_KEY,
  getDiaSemanaActualRuta,
  buildClientesRutaEnriquecidos,
  autoDistribuirCarteraSemanal,
  calcularResumenJornadaRuta,
  loadAsignacionesRutaLocal,
  saveAsignacionesRutaLocal,
  loadVisitasRutaLocal,
  saveVisitasRutaLocal,
  fetchRuteroFromServer,
  pushAsignacionesToServer,
  pushVisitaToServer
} from '../services/ruteroService';

interface PlanificadorRutaTabProps {
  filteredVolumen: any[];
  filteredActivacion: any[];
  activeVendedorDisplayName: string;
  activeVendedorId: string;
  userRole: Role;
  onNavigateToTab?: (tabId: string) => void;
}

function loadManualRubrosOverrides(): Record<string, Record<string, boolean | undefined>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MANUAL_RUBROS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export const PlanificadorRutaTab: React.FC<PlanificadorRutaTabProps> = ({
  filteredVolumen,
  filteredActivacion,
  activeVendedorDisplayName,
  activeVendedorId,
  userRole,
  onNavigateToTab
}) => {
  const [diaSeleccionado, setDiaSeleccionado] = useState<DiaSemanaRuta>(() =>
    getDiaSemanaActualRuta()
  );
  const [fechaISO, setFechaISO] = useState<string>(() =>
    new Date().toISOString().split('T')[0]
  );
  const [modoVista, setModoVista] = useState<'EJECUCION_DIA' | 'CONFIGURAR_RUTERO'>('EJECUCION_DIA');
  const [filtroEjecucion, setFiltroEjecucion] = useState<
    'TODOS' | 'PENDIENTES' | 'INACTIVOS' | 'VISITADOS'
  >('TODOS');
  const [filtroConfig, setFiltroConfig] = useState<'TODOS' | 'SIN_DIA' | 'CON_DIA'>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  const [asignacionesMap, setAsignacionesMap] = useState<Record<string, AsignacionClienteRuta>>(
    () => loadAsignacionesRutaLocal()
  );
  const [visitasMap, setVisitasMap] = useState<Record<string, RegistroVisitaRuta>>(
    () => loadVisitasRutaLocal()
  );
  const [manualOverrides, setManualOverrides] = useState<
    Record<string, Record<string, boolean | undefined>>
  >(() => loadManualRubrosOverrides());

  const [clienteMotivoAbierto, setClienteMotivoAbierto] = useState<string | null>(null);
  const [motivoSeleccionado, setMotivoSeleccionado] = useState<MotivoNoVentaRuta>('INVENTARIO_ALTO');
  const [observacionVisita, setObservacionVisita] = useState<string>('');
  const [capturandoGpsKey, setCapturandoGpsKey] = useState<string | null>(null);
  const [toastMensaje, setToastMensaje] = useState<string | null>(null);

  const mostrarToast = (msg: string) => {
    setToastMensaje(msg);
    setTimeout(() => {
      setToastMensaje(prev => (prev === msg ? null : prev));
    }, 3200);
  };

  // Escuchar cambios de rubros manuales y sincronizar con el backend al montar
  useEffect(() => {
    const onManualRubrosUpdated = () => {
      setManualOverrides(loadManualRubrosOverrides());
    };
    window.addEventListener('fdv-manual-rubros-updated', onManualRubrosUpdated);

    let isMounted = true;
    fetchRuteroFromServer().then(remote => {
      if (!isMounted || !remote) return;
      setAsignacionesMap(prev => {
        const merged = { ...remote.asignaciones, ...prev };
        saveAsignacionesRutaLocal(merged);
        return merged;
      });
      setVisitasMap(prev => {
        const merged = { ...remote.visitas, ...prev };
        saveVisitasRutaLocal(merged);
        return merged;
      });
    });

    return () => {
      isMounted = false;
      window.removeEventListener('fdv-manual-rubros-updated', onManualRubrosUpdated);
    };
  }, []);

  // Cartera enriquecida con estado de activación, brecha de los 5 rubros y visita de hoy
  const clientesEnriquecidos = useMemo(() => {
    return buildClientesRutaEnriquecidos({
      filteredActivacion,
      filteredVolumen,
      asignacionesMap,
      visitasMap,
      fechaISO,
      manualOverrides
    });
  }, [filteredActivacion, filteredVolumen, asignacionesMap, visitasMap, fechaISO, manualOverrides]);

  // Resumen de KPIs de la jornada
  const resumenJornada = useMemo(() => {
    return calcularResumenJornadaRuta({
      clientesEnriquecidos,
      diaSeleccionado,
      fechaISO
    });
  }, [clientesEnriquecidos, diaSeleccionado, fechaISO]);

  // Conteo de clientes asignados por cada día de la semana (Lunes a Sábado)
  const conteoPorDia = useMemo(() => {
    const counts: Record<DiaSemanaRuta, number> = {
      LUNES: 0,
      MARTES: 0,
      MIERCOLES: 0,
      JUEVES: 0,
      VIERNES: 0,
      SABADO: 0
    };
    for (const c of clientesEnriquecidos) {
      for (const d of c.diasAsignados) {
        if (counts[d] !== undefined) counts[d]++;
      }
    }
    return counts;
  }, [clientesEnriquecidos]);

  // Clientes que corresponden al día seleccionado y filtro activo
  const clientesDelDiaFiltrados = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return clientesEnriquecidos.filter(c => {
      if (!c.diasAsignados.includes(diaSeleccionado)) return false;

      if (filtroEjecucion === 'PENDIENTES' && c.visitaHoy && c.visitaHoy.estado !== 'PENDIENTE') {
        return false;
      }
      if (filtroEjecucion === 'INACTIVOS' && c.isActivoMes) {
        return false;
      }
      if (filtroEjecucion === 'VISITADOS' && (!c.visitaHoy || c.visitaHoy.estado === 'PENDIENTE')) {
        return false;
      }

      if (term) {
        const matchName = c.clienteNombre.toLowerCase().includes(term);
        const matchId = c.clienteId.toLowerCase().includes(term);
        const matchVend = c.vendedorId.toLowerCase().includes(term);
        return matchName || matchId || matchVend;
      }
      return true;
    });
  }, [clientesEnriquecidos, diaSeleccionado, filtroEjecucion, searchTerm]);

  // Clientes para el modo "Organizar Rutero Semanal"
  const clientesConfigFiltrados = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return clientesEnriquecidos.filter(c => {
      if (filtroConfig === 'SIN_DIA' && c.diasAsignados.length > 0) return false;
      if (filtroConfig === 'CON_DIA' && c.diasAsignados.length === 0) return false;
      if (term) {
        return (
          c.clienteNombre.toLowerCase().includes(term) ||
          c.clienteId.toLowerCase().includes(term) ||
          c.vendedorId.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [clientesEnriquecidos, filtroConfig, searchTerm]);

  // Alternar un día de visita (L-S) para un cliente
  const handleToggleDiaCliente = (cliente: ClienteRutaEnriquecido, dia: DiaSemanaRuta) => {
    const actuales = new Set<DiaSemanaRuta>(cliente.diasAsignados);
    if (actuales.has(dia)) {
      actuales.delete(dia);
    } else {
      actuales.add(dia);
    }
    const nuevosDias = DIAS_SEMANA_RUTA.map(d => d.id).filter(d => actuales.has(d));
    const record: AsignacionClienteRuta = {
      clienteKey: cliente.clienteKey,
      clienteId: cliente.clienteId,
      clienteNombre: cliente.clienteNombre,
      vendedorId: cliente.vendedorId,
      zona: cliente.zona,
      dias: nuevosDias,
      orden: cliente.orden,
      notasFijas: cliente.notasFijas,
      updatedAt: new Date().toISOString()
    };

    setAsignacionesMap(prev => {
      const next = { ...prev, [cliente.clienteKey]: record };
      saveAsignacionesRutaLocal(next);
      return next;
    });
    pushAsignacionesToServer([record]);
  };

  // Auto-distribuir equitativamente clientes entre Lunes y Viernes
  const handleAutoDistribuirCartera = (reequilibrarTodo = false) => {
    if (clientesEnriquecidos.length === 0) return;
    const updatedMap = autoDistribuirCarteraSemanal(
      clientesEnriquecidos.map(c => ({
        clienteKey: c.clienteKey,
        clienteId: c.clienteId,
        clienteNombre: c.clienteNombre,
        vendedorId: c.vendedorId,
        zona: c.zona
      })),
      asignacionesMap,
      reequilibrarTodo
    );

    setAsignacionesMap(updatedMap);
    saveAsignacionesRutaLocal(updatedMap);

    const changedRecords = clientesEnriquecidos
      .map(c => updatedMap[c.clienteKey])
      .filter(Boolean);
    pushAsignacionesToServer(changedRecords);

    mostrarToast(
      `¡Cartera distribuida automáticamente de Lunes a Viernes (${changedRecords.length} clientes)!`
    );
    setModoVista('EJECUCION_DIA');
  };

  // Registrar Check-in de visita (Con Pedido, Gestión de Cobro, Sin Venta o Deshacer)
  const handleRegistrarVisita = (
    cliente: ClienteRutaEnriquecido,
    estado: EstadoVisitaRuta,
    opciones?: {
      motivoNoVenta?: MotivoNoVentaRuta;
      observacion?: string;
      capturarGps?: boolean;
      irACobros?: boolean;
    }
  ) => {
    const visitKey = `${fechaISO}::${cliente.clienteKey}`;

    const guardarRegistro = (coords?: { lat: number; lng: number }) => {
      const nuevaVisita: RegistroVisitaRuta = {
        id: visitKey,
        fecha: fechaISO,
        diaSemana: diaSeleccionado,
        clienteKey: cliente.clienteKey,
        clienteId: cliente.clienteId,
        clienteNombre: cliente.clienteNombre,
        vendedorId: cliente.vendedorId,
        estado,
        motivoNoVenta: estado === 'SIN_VENTA' ? opciones?.motivoNoVenta : undefined,
        rubrosOfrecidos: cliente.rubrosFaltantes,
        observacion: opciones?.observacion?.trim() || undefined,
        checkInTimestamp: new Date().toISOString(),
        ...(coords ? { coords } : {})
      };

      setVisitasMap(prev => {
        const next = { ...prev };
        if (estado === 'PENDIENTE') {
          delete next[visitKey];
        } else {
          next[visitKey] = nuevaVisita;
        }
        saveVisitasRutaLocal(next);
        return next;
      });

      pushVisitaToServer(nuevaVisita);
      setClienteMotivoAbierto(null);
      setObservacionVisita('');

      if (estado === 'EFECTIVA_PEDIDO') {
        mostrarToast(`Visita efectiva registrada: ${cliente.clienteNombre}`);
      } else if (estado === 'GESTION_COBRO') {
        mostrarToast(`Gestión de cobro registrada: ${cliente.clienteNombre}`);
        if (opciones?.irACobros && onNavigateToTab) {
          onNavigateToTab('COBROS_OCR');
        }
      } else if (estado === 'SIN_VENTA') {
        mostrarToast(`Visita sin venta registrada: ${cliente.clienteNombre}`);
      }
    };

    if (opciones?.capturarGps && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      setCapturandoGpsKey(cliente.clienteKey);
      navigator.geolocation.getCurrentPosition(
        pos => {
          setCapturandoGpsKey(null);
          guardarRegistro({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6))
          });
        },
        () => {
          setCapturandoGpsKey(null);
          guardarRegistro();
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
      );
    } else {
      guardarRegistro();
    }
  };

  // Exportar Hoja de Ruta del Día en PDF
  const handleExportarPdfRuta = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const diaObj = DIAS_SEMANA_RUTA.find(d => d.id === diaSeleccionado);
    const diaNombre = diaObj ? diaObj.label.toUpperCase() : diaSeleccionado;

    doc.setFillColor(15, 15, 15);
    doc.rect(0, 0, 297, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`HOJA DE RUTA COMERCIAL — ${diaNombre} (${fechaISO})`, 14, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(210, 210, 210);
    doc.text(
      `Ruta / Vendedor: ${activeVendedorDisplayName}   |   Programados: ${resumenJornada.programadosHoy}   |   Visitados: ${resumenJornada.visitadosHoy} (${resumenJornada.porcentajeAvanceRuta}%)   |   Inactivos por Activar: ${resumenJornada.inactivosProgramadosHoy}`,
      14,
      21
    );

    const rows = clientesDelDiaFiltrados.map((c, idx) => {
      const estadoMes = c.isActivoMes ? `ACTIVO (${c.totalRubrosActivos}/5)` : 'INACTIVO (0/5)';
      const faltantesTxt =
        c.rubrosFaltantes.length > 0
          ? c.rubrosFaltantes.map(r => RUBRO_SHORT_LABELS[r] || r).join(', ')
          : 'COMPLETO (5/5)';
      const estadoVisita = !c.visitaHoy
        ? 'PENDIENTE'
        : c.visitaHoy.estado === 'EFECTIVA_PEDIDO'
          ? 'EFECTIVA (PEDIDO)'
          : c.visitaHoy.estado === 'GESTION_COBRO'
            ? 'GESTION COBRO'
            : `SIN VENTA (${c.visitaHoy.motivoNoVenta || ''})`;

      return [
        String(idx + 1),
        c.clienteId,
        c.clienteNombre,
        estadoMes,
        faltantesTxt,
        `${c.ejecutadoKgMes.toLocaleString('es-VE')} kg`,
        estadoVisita
      ];
    });

    autoTable(doc, {
      startY: 33,
      head: [
        [
          '#',
          'CÓDIGO',
          'CLIENTE',
          'ESTADO MES',
          'RUBROS FALTANTES POR OFRECER HOY',
          'VOLUMEN MES',
          'GESTIÓN DEL DÍA'
        ]
      ],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] }
    });

    doc.save(`Hoja_de_Ruta_${diaNombre}_${fechaISO}.pdf`);
  };

  const renderPrioridadBadge = (c: ClienteRutaEnriquecido) => {
    if (c.prioridad === 'ALTA_INACTIVO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-950/80 text-red-300 border border-red-700/60">
          <Flame className="w-3.5 h-3.5 text-red-400" />
          URGENTE: INACTIVO (0/5)
        </span>
      );
    }
    if (c.prioridad === 'ALTA_CIERRE_5') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-700/60">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          CERRAR 5/5 ({c.totalRubrosActivos}/5 ACTIVOS)
        </span>
      );
    }
    if (c.prioridad === 'MEDIA_DESARROLLO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-950/70 text-blue-300 border border-blue-800/60">
          <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
          DESARROLLO ({c.totalRubrosActivos}/5 ACTIVOS)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        COMPLETO (5/5 RUBROS)
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* NOTIFICACIÓN FLOTANTE */}
      {toastMensaje && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-950 border border-emerald-600 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs md:text-sm font-sans font-bold">{toastMensaje}</span>
        </div>
      )}

      {/* BANNER SUPERIOR Y CONTROLES DE MODO */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 md:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-neutral-800/80">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-red-600/15 border border-red-500/30 text-red-500 shrink-0">
              <Route className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg md:text-xl font-sans font-extrabold text-white tracking-tight uppercase">
                  Planificador Inteligente de Ruta
                </h2>
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300">
                  {activeVendedorDisplayName}
                </span>
              </div>
              <p className="text-xs md:text-sm text-neutral-400 mt-1">
                Priorización diaria de clientes según brecha de los 5 rubros estratégicos y control de efectividad en calle.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Selector de Fecha Operativa */}
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2">
              <Calendar className="w-4 h-4 text-red-500" />
              <input
                type="date"
                value={fechaISO}
                onChange={e => setFechaISO(e.target.value || new Date().toISOString().split('T')[0])}
                className="bg-transparent text-xs font-mono font-bold text-white outline-none cursor-pointer"
              />
            </div>

            {/* Alternador entre Ejecución del Día y Configurar Rutero */}
            <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800">
              <button
                onClick={() => setModoVista('EJECUCION_DIA')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-sans font-bold transition-all cursor-pointer ${
                  modoVista === 'EJECUCION_DIA'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                Mi Ruta del Día
              </button>
              <button
                onClick={() => setModoVista('CONFIGURAR_RUTERO')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-sans font-bold transition-all cursor-pointer ${
                  modoVista === 'CONFIGURAR_RUTERO'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Asignar Días ({resumenJornada.totalConDiaAsignado}/{resumenJornada.totalCarteraVendedor})
              </button>
            </div>

            {/* Exportar PDF */}
            <button
              onClick={handleExportarPdfRuta}
              disabled={clientesDelDiaFiltrados.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-sans font-bold transition-all disabled:opacity-40 cursor-pointer"
              title="Descargar Hoja de Ruta del Día en PDF"
            >
              <FileDown className="w-4 h-4 text-red-500" />
              <span>PDF Ruta</span>
            </button>
          </div>
        </div>

        {/* TARJETAS KPI DE LA JORNADA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-neutral-400">
                Clientes del Día ({diaSeleccionado})
              </span>
              <Route className="w-4 h-4 text-red-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-mono font-extrabold text-white">
                {resumenJornada.programadosHoy}
              </span>
              <span className="text-xs text-neutral-400">
                de {resumenJornada.totalCarteraVendedor} en cartera
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              {resumenJornada.pendientesHoy} pendientes por visitar hoy
            </p>
          </div>

          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-neutral-400">
                Avance de Visitas Hoy
              </span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-mono font-extrabold text-amber-400">
                {resumenJornada.porcentajeAvanceRuta}%
              </span>
              <span className="text-xs font-mono text-neutral-300">
                {resumenJornada.visitadosHoy} / {resumenJornada.programadosHoy} visitados
              </span>
            </div>
            <div className="w-full bg-neutral-950 h-2 rounded-full mt-2 overflow-hidden border border-neutral-800">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, resumenJornada.porcentajeAvanceRuta)}%` }}
              />
            </div>
          </div>

          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-neutral-400">
                Efectividad en Calle
              </span>
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-mono font-extrabold text-emerald-400">
                {resumenJornada.porcentajeEfectividad}%
              </span>
              <span className="text-xs text-neutral-300">
                ({resumenJornada.efectivosPedidoHoy} pedidos · {resumenJornada.gestionCobroHoy} cobros)
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              Visitas sin venta hoy: {resumenJornada.sinVentaHoy}
            </p>
          </div>

          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-neutral-400">
                Foco Activación Hoy
              </span>
              <Flame className="w-4 h-4 text-red-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-mono font-extrabold text-red-400">
                {resumenJornada.inactivosProgramadosHoy}
              </span>
              <span className="text-xs text-neutral-300">clientes inactivos hoy</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              Priorizados al inicio de la hoja de ruta
            </p>
          </div>
        </div>

        {/* SELECTOR DE DÍA DE LA SEMANA (LUNES A SÁBADO) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mt-5">
          {DIAS_SEMANA_RUTA.map(dia => {
            const isSelected = diaSeleccionado === dia.id;
            const count = conteoPorDia[dia.id] || 0;
            const esHoy = getDiaSemanaActualRuta() === dia.id;
            return (
              <button
                key={dia.id}
                onClick={() => setDiaSeleccionado(dia.id)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-sans font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-950/50'
                    : 'bg-neutral-900/70 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span>{dia.label}</span>
                  {esHoy && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-mono ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      Hoy
                    </span>
                  )}
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                    isSelected ? 'bg-black/30 text-white' : 'bg-neutral-950 text-neutral-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* AVISO INTELIGENTE SI EL VENDEDOR AÚN NO TIENE CLIENTES ASIGNADOS AL DÍA */}
      {resumenJornada.totalConDiaAsignado === 0 && clientesEnriquecidos.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-700/50 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <Wand2 className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm md:text-base font-sans font-bold text-amber-200">
                Tu cartera tiene {clientesEnriquecidos.length} clientes listos para organizar por día de visita
              </h3>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Puedes distribuirlos automáticamente de Lunes a Viernes en un clic o asignar manualmente los días de cada cliente.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => handleAutoDistribuirCartera(false)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-sans font-extrabold text-xs transition-all cursor-pointer shadow-lg"
            >
              <Wand2 className="w-4 h-4" />
              Auto-Distribuir Cartera (Lun-Vie)
            </button>
            <button
              onClick={() => setModoVista('CONFIGURAR_RUTERO')}
              className="px-3.5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 font-sans font-bold text-xs cursor-pointer"
            >
              Asignar Manualmente
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODO 1: EJECUCIÓN DE RUTA DEL DÍA (HOJA DE RUTA EN CALLE)
         ===================================================================== */}
      {modoVista === 'EJECUCION_DIA' && (
        <div className="space-y-4">
          {/* BARRA DE FILTROS Y BÚSQUEDA */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'TODOS', label: `Todos Hoy (${resumenJornada.programadosHoy})` },
                { id: 'PENDIENTES', label: `Pendientes (${resumenJornada.pendientesHoy})` },
                { id: 'INACTIVOS', label: `Inactivos del Mes (${resumenJornada.inactivosProgramadosHoy})` },
                { id: 'VISITADOS', label: `Visitados Hoy (${resumenJornada.visitadosHoy})` }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFiltroEjecucion(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-sans font-bold transition-all cursor-pointer ${
                    filtroEjecucion === tab.id
                      ? 'bg-red-600 text-white'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar cliente o código..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* LISTA DE PARADAS DEL DÍA */}
          {clientesDelDiaFiltrados.length === 0 ? (
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-10 text-center space-y-3">
              <Route className="w-10 h-10 text-neutral-600 mx-auto" />
              <h3 className="text-base font-sans font-bold text-white">
                No hay clientes que coincidan con este filtro para el día {diaSeleccionado}
              </h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Usa la pestaña &ldquo;Asignar Días&rdquo; o el botón de Auto-Distribución para programar qué clientes visitas cada día de la semana.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={() => setModoVista('CONFIGURAR_RUTERO')}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
                >
                  Ir a Asignar Clientes a {diaSeleccionado}
                </button>
                {resumenJornada.totalSinDiaAsignado > 0 && (
                  <button
                    onClick={() => handleAutoDistribuirCartera(false)}
                    className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-amber-300 text-xs font-bold cursor-pointer"
                  >
                    Auto-Distribuir {resumenJornada.totalSinDiaAsignado} Clientes Sin Día
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {clientesDelDiaFiltrados.map((cliente, index) => {
                const visit = cliente.visitaHoy;
                const isVisited = Boolean(visit && visit.estado !== 'PENDIENTE');
                const isMotivoOpen = clienteMotivoAbierto === cliente.clienteKey;

                return (
                  <div
                    key={cliente.clienteKey}
                    className={`rounded-2xl border p-4 md:p-5 transition-all ${
                      isVisited
                        ? 'bg-neutral-950/60 border-emerald-900/50'
                        : cliente.prioridad === 'ALTA_INACTIVO'
                          ? 'bg-neutral-950 border-red-900/50 hover:border-red-700/60'
                          : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* INFO IZQUIERDA DEL CLIENTE Y BRECHA DE RUBROS */}
                      <div className="space-y-2.5 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="w-6 h-6 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300 font-mono text-xs font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-800">
                            #{cliente.clienteId}
                          </span>
                          <h3 className="text-sm md:text-base font-sans font-extrabold text-white">
                            {cliente.clienteNombre}
                          </h3>
                          {renderPrioridadBadge(cliente)}
                          {cliente.ejecutadoKgMes > 0 && (
                            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                              {cliente.ejecutadoKgMes.toLocaleString('es-VE')} kg este mes
                            </span>
                          )}
                        </div>

                        {/* BLOQUE DE INTELIGENCIA COMERCIAL: QUÉ RUBROS OFRECER EN ESTA VISITA */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {cliente.rubrosFaltantes.length > 0 ? (
                            <>
                              <span className="text-[11px] font-sans font-bold text-amber-400 mr-1">
                                Ofrecer hoy ({cliente.rubrosFaltantes.length} pendientes):
                              </span>
                              {cliente.rubrosFaltantes.map(r => (
                                <span
                                  key={r}
                                  className="text-[11px] font-sans font-bold px-2 py-0.5 rounded-md bg-amber-950/50 text-amber-200 border border-amber-800/50"
                                >
                                  + {RUBRO_SHORT_LABELS[r] || r}
                                </span>
                              ))}
                            </>
                          ) : (
                            <span className="text-[11px] font-sans font-bold text-emerald-400">
                              ✓ Cliente con los 5 rubros estratégicos activos este mes (Visita de reposición/cobranza)
                            </span>
                          )}

                          {cliente.rubrosComprados.length > 0 && (
                            <div className="flex items-center gap-1 ml-1 flex-wrap">
                              <span className="text-[10px] text-neutral-500">Activos:</span>
                              {cliente.rubrosComprados.map(r => (
                                <span
                                  key={r}
                                  className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-900/40"
                                >
                                  ✓ {RUBRO_SHORT_LABELS[r] || r}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* BOTONES DE CHECK-IN DE VISITA (DERECHA) */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {!isVisited ? (
                          <>
                            <button
                              onClick={() => handleRegistrarVisita(cliente, 'EFECTIVA_PEDIDO')}
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-sans font-bold transition-all cursor-pointer shadow-sm"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                              Efectiva (Pedido)
                            </button>

                            <button
                              onClick={() => handleRegistrarVisita(cliente, 'GESTION_COBRO')}
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-sans font-bold transition-all cursor-pointer shadow-sm"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              Cobro
                            </button>

                            <button
                              onClick={() =>
                                setClienteMotivoAbierto(isMotivoOpen ? null : cliente.clienteKey)
                              }
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-amber-300 text-xs font-sans font-bold transition-all cursor-pointer"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Sin Venta
                            </button>

                            <button
                              onClick={() =>
                                handleRegistrarVisita(cliente, 'EFECTIVA_PEDIDO', { capturarGps: true })
                              }
                              disabled={capturandoGpsKey === cliente.clienteKey}
                              title="Registrar visita efectiva guardando coordenada GPS actual"
                              className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-sans font-bold cursor-pointer"
                            >
                              <MapPin className="w-3.5 h-3.5 text-red-500" />
                              {capturandoGpsKey === cliente.clienteKey ? '...' : 'GPS'}
                            </button>
                          </>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-sans font-bold border ${
                                visit?.estado === 'EFECTIVA_PEDIDO'
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                                  : visit?.estado === 'GESTION_COBRO'
                                    ? 'bg-blue-950/80 text-blue-300 border-blue-700'
                                    : 'bg-amber-950/80 text-amber-300 border-amber-700'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              {visit?.estado === 'EFECTIVA_PEDIDO'
                                ? 'Visita Efectiva (Pedido)'
                                : visit?.estado === 'GESTION_COBRO'
                                  ? 'Gestión de Cobro'
                                  : `Sin Venta: ${
                                      MOTIVOS_NO_VENTA_RUTA.find(m => m.id === visit?.motivoNoVenta)
                                        ?.label || visit?.motivoNoVenta
                                    }`}
                            </span>

                            {onNavigateToTab && visit?.estado === 'GESTION_COBRO' && (
                              <button
                                onClick={() => onNavigateToTab('COBROS_OCR')}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer"
                              >
                                Subir Soporte OCR
                              </button>
                            )}

                            <button
                              onClick={() => handleRegistrarVisita(cliente, 'PENDIENTE')}
                              title="Deshacer registro de visita"
                              className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PANEL DESPLEGABLE DE MOTIVO DE NO VENTA */}
                    {isMotivoOpen && (
                      <div className="mt-4 pt-3 border-t border-neutral-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                        <select
                          value={motivoSeleccionado}
                          onChange={e => setMotivoSeleccionado(e.target.value as MotivoNoVentaRuta)}
                          className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white font-sans font-bold outline-none"
                        >
                          {MOTIVOS_NO_VENTA_RUTA.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={observacionVisita}
                          onChange={e => setObservacionVisita(e.target.value)}
                          placeholder="Nota breve opcional (ej. volver el jueves)..."
                          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 outline-none"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleRegistrarVisita(cliente, 'SIN_VENTA', {
                                motivoNoVenta: motivoSeleccionado,
                                observacion: observacionVisita
                              })
                            }
                            className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-sans font-extrabold text-xs cursor-pointer"
                          >
                            Confirmar Motivo
                          </button>
                          <button
                            onClick={() => setClienteMotivoAbierto(null)}
                            className="p-2 rounded-lg bg-neutral-900 text-neutral-400 hover:text-white cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODO 2: CONFIGURAR RUTERO SEMANAL (ASIGNAR CLIENTES A DÍAS L-S)
         ===================================================================== */}
      {modoVista === 'CONFIGURAR_RUTERO' && (
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
            <div>
              <h3 className="text-base font-sans font-extrabold text-white uppercase">
                Asignación de Clientes por Día de Visita (Lunes a Sábado)
              </h3>
              <p className="text-xs text-neutral-400">
                Marca en qué día(s) de la semana visitas a cada cliente. Los cambios se guardan automáticamente.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleAutoDistribuirCartera(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-sans font-extrabold text-xs cursor-pointer shadow"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Auto-Balancear Toda la Cartera (Lun-Vie)
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'TODOS', label: `Toda la Cartera (${resumenJornada.totalCarteraVendedor})` },
                { id: 'SIN_DIA', label: `Sin Día Asignado (${resumenJornada.totalSinDiaAsignado})` },
                { id: 'CON_DIA', label: `Con Día Asignado (${resumenJornada.totalConDiaAsignado})` }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFiltroConfig(f.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-sans font-bold cursor-pointer ${
                    filtroConfig === f.id
                      ? 'bg-red-600 text-white'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar cliente para asignar día..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
            {clientesConfigFiltrados.map(cliente => (
              <div
                key={cliente.clienteKey}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700"
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-neutral-950 text-neutral-400 border border-neutral-800">
                    #{cliente.clienteId}
                  </span>
                  <span className="text-xs md:text-sm font-sans font-bold text-white">
                    {cliente.clienteNombre}
                  </span>
                  {renderPrioridadBadge(cliente)}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {DIAS_SEMANA_RUTA.map(d => {
                    const active = cliente.diasAsignados.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        onClick={() => handleToggleDiaCliente(cliente, d.id)}
                        title={`Asignar/Quitar ${d.label}`}
                        className={`w-9 h-8 rounded-lg font-mono text-xs font-extrabold transition-all cursor-pointer border ${
                          active
                            ? 'bg-red-600 border-red-500 text-white shadow'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600'
                        }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
