import React, { useMemo } from 'react';
import { Calendar, RefreshCw, Clock } from 'lucide-react';
import { getMesLaboralInfo } from '../utils/calendar';

interface RecorridoMesProps {
  onSync?: () => void;
  loading?: boolean;
  lastSyncAt?: string | null;
  syncStatusHint?: string;
}

function formatSyncTimeLabel(isoTimestamp?: string | null): string {
  if (!isoTimestamp) return 'Pendiente';
  const dt = new Date(isoTimestamp);
  if (Number.isNaN(dt.getTime())) return 'Pendiente';

  const now = new Date();
  const isSameDay =
    dt.getFullYear() === now.getFullYear() &&
    dt.getMonth() === now.getMonth() &&
    dt.getDate() === now.getDate();

  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  const ss = String(dt.getSeconds()).padStart(2, '0');

  if (isSameDay) {
    return `${hh}:${mm}:${ss}`;
  }
  const dd = String(dt.getDate()).padStart(2, '0');
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mo} ${hh}:${mm}`;
}

export const RecorridoMes: React.FC<RecorridoMesProps> = ({
  onSync,
  loading,
  lastSyncAt,
  syncStatusHint
}) => {
  const { monthName, year, elapsed, remaining, total, percentage } = useMemo(() => {
    const info = getMesLaboralInfo();
    return {
      monthName: info.monthName,
      year: info.year,
      total: info.totalWorkingDays,
      elapsed: info.elapsedWorkingDays,
      remaining: info.remainingWorkingDays,
      percentage: info.percentage
    };
  }, []);

  const formattedSyncTime = useMemo(() => formatSyncTimeLabel(lastSyncAt), [lastSyncAt]);

  return (
    <div className="border border-neutral-800 bg-neutral-950 rounded-xl p-5 mb-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-neutral-900 p-2.5 rounded-lg border border-neutral-800">
            <Calendar className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-white font-sans font-bold text-lg uppercase tracking-wide">
              Recorrido Mes: <span className="text-red-500">{monthName} {year}</span>
            </h2>
            <p className="text-neutral-500 font-sans text-xs">Seguimiento de días laborables en curso</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className="flex items-center justify-center gap-2 text-xs md:text-sm font-sans font-medium text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 px-3.5 py-2.5 rounded-lg"
            title={lastSyncAt ? `Marca exacta ISO: ${lastSyncAt}` : 'Sincronización automática con Google Sheets'}
          >
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-ping' : 'bg-emerald-500 animate-pulse'}`}></div>
            <Clock className="w-3.5 h-3.5 text-emerald-400/90 shrink-0" />
            <span>
              Última sincronización: <strong className="font-mono text-emerald-300">{formattedSyncTime}</strong>
            </span>
          </div>

          {syncStatusHint && (
            <span className="text-[11px] font-sans font-medium text-amber-300 bg-amber-950/40 border border-amber-800/50 px-2.5 py-1.5 rounded-lg">
              {syncStatusHint}
            </span>
          )}

          {onSync && (
            <button
              onClick={onSync}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700/60 rounded-lg text-xs md:text-sm font-medium transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Consultar Google Sheets en vivo con reintento automático"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-red-500 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Sincronizando...' : 'Sincronizar datos'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar Area */}
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-2 gap-1">
          <span className="text-[11px] font-sans text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Avance Calendario Laboral
          </span>
          <span className="text-emerald-400 font-mono text-xl font-bold tracking-tight">
            {percentage}% <span className="text-[11px] font-sans text-neutral-500 font-normal ml-1">Hábil Transcurrido</span>
          </span>
        </div>
        <div className="w-full bg-neutral-900 rounded-full h-3 mb-2 border border-neutral-800 overflow-hidden">
          <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
        </div>
        <div className="flex flex-col sm:flex-row justify-between text-xs font-mono text-neutral-400 mt-3 gap-1">
          <span>Días Transcurridos: <strong className="text-white">{elapsed}d</strong></span>
          <span>Días Restantes: <strong className="text-amber-400">{remaining}d</strong></span>
          <span>Total Hábiles Mes: <strong className="text-emerald-400">{total}d</strong></span>
        </div>
      </div>
    </div>
  );
};
