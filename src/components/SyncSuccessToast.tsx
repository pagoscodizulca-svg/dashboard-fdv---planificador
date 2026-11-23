import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export interface SyncSuccessToastProps {
  visible: boolean;
}

/**
 * Notificación flotante en tiempo real para el perfil del vendedor.
 * - Texto literal exacto: "Tus datos han sido actualizados con éxito"
 * - Duración controlada de 5000 ms por el hook `useSellerLiveSync`
 * - Posición fija, z-index 9999, pointer-events: none (nunca bloquea clics del vendedor)
 */
export const SyncSuccessToast: React.FC<SyncSuccessToastProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="seller-sync-toast"
      className="fixed top-4 left-1/2 -translate-x-1/2 md:top-5 md:right-5 md:left-auto md:translate-x-0 z-[9999] pointer-events-none w-[calc(100%-2rem)] max-w-md md:w-auto animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-950/95 border border-emerald-500/70 shadow-2xl shadow-emerald-950/60 backdrop-blur-md">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/50 shrink-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>
        <span className="text-sm font-sans font-semibold text-white tracking-tight leading-snug">
          Tus datos han sido actualizados con éxito
        </span>
      </div>
    </div>
  );
};
