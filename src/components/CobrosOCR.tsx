import React, { useState, useEffect, useMemo, useRef, Component, ErrorInfo } from 'react';
import { supabase, hasValidSupabaseConfig } from '../lib/supabase';
import heic2any from 'heic2any';
import { 
  Camera, UploadCloud, CheckCircle, AlertTriangle, Search, 
  Loader2, Download, History, Trash2, Calendar, FileText, 
  RefreshCw, DollarSign, Building2, User, Hash, ArrowRight,
  Share2, ClipboardPaste, Smartphone, X, Cloud, CloudOff, Eye, ExternalLink, CreditCard,
  ZoomIn, ZoomOut
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getAuthHeaders } from '../services/authService';
import {
  validateReceiptFile,
  saveCobroToLocalDB,
  getAllCobrosFromLocalDB,
  deleteCobroFromLocalDB,
  clearCobrosFromLocalDB,
  syncCobroToCloud,
  consumeSharedReceiptFromIDB,
  CobroRecord
} from '../utils/cobrosOfflineQueue';
import {
  isBeneficiaryName,
  isBeneficiaryRif,
  normalizeReceiptDates,
  normalizeMetodoPago,
  normalizeReferenciaBancaria,
  parseVenezuelanMonto,
  parseMontoVenezolano,
  inferirBancoVenezolano,
  prepareImageForGemini,
  extractSupportWithGemini,
  extractNumeroCuentaVenezolana,
  resolveVenezuelanBankDetails,
  safeExtractReceiptJson
} from '../services/venezuelanReceiptAuditor';

// Error Boundary específico para CobrosOCR para evitar que cualquier fallo deje la pantalla en blanco
interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class CobrosErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message || 'Error inesperado en Cobros' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error capturado en CobrosErrorBoundary:", error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('ocr_pagos_consolidados');
    } catch (e) {
      console.error(e);
    }
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-xl mx-auto p-6 bg-red-950/40 border border-red-900 rounded-xl my-10 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-sans font-bold text-white mb-2 uppercase tracking-wider">
            Se detectó un problema en el Módulo de Cobros
          </h2>
          <p className="text-sm text-neutral-300 mb-4">
            Ocurrió un error al procesar o renderizar los pagos ({this.state.errorMessage}).
          </p>
          <button
            onClick={this.handleReset}
            className="bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors uppercase tracking-wider inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Restaurar y Continuar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface CobrosOCRProps {
  clientes?: any[];
  currentVendedor?: string;
}

export const CobrosOCRInner: React.FC<CobrosOCRProps> = ({ 
  clientes = [], 
  currentVendedor = 'ADMIN' 
}) => {
  // Navigation
  const [activeSubTab, setActiveSubTab] = useState<'nuevo' | 'historial'>('nuevo');

  // Form State
  const [ruta, setRuta] = useState(() => localStorage.getItem('ocr_ruta') || 'Ruta 1');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewPdfDataUrl, setPreviewPdfDataUrl] = useState<string | null>(null);
  const [sharedFileMeta, setSharedFileMeta] = useState<{
    name: string;
    mimeType: string;
    size: number;
    isPdf: boolean;
  } | null>(null);
  const [selectedReceiptModal, setSelectedReceiptModal] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState<string>('Procesando soporte...');
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [alertMsg, setAlertMsg] = useState<{ type: 'error' | 'success' | 'info', text: string, actionLabel?: string, onAction?: () => void } | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'error' | 'success' | 'info', text: string, actionLabel?: string, onAction?: () => void } | null>(null);
  const [receivedFromWhatsApp, setReceivedFromWhatsApp] = useState(false);
  const [showWhatsAppGuide, setShowWhatsAppGuide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<any>(null);

  const notifyUser = (
    type: 'error' | 'success' | 'info',
    text: string,
    durationMs: number = 4500,
    action?: { label: string; onClick: () => void }
  ) => {
    const payload = {
      type,
      text,
      actionLabel: action?.label,
      onAction: action?.onClick,
    };
    setAlertMsg(payload);
    setToastMsg(payload);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    if (durationMs > 0) {
      toastTimerRef.current = setTimeout(() => {
        setToastMsg(null);
      }, durationMs);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return 'Validado';
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };

  const triggerNativeFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };
  const [canInstallPwa, setCanInstallPwa] = useState<boolean>(() =>
    typeof window !== 'undefined' && Boolean((window as any).__fdvDeferredInstallPrompt)
  );
  const [isStandalonePwa, setIsStandalonePwa] = useState<boolean>(() =>
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)')?.matches || (window.navigator as any)?.standalone === true)
  );

  // Client Data
  const [codigoCliente, setCodigoCliente] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [rucCliente, setRucCliente] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Payment Data
  const [factura, setFactura] = useState('');
  const [metodoPago, setMetodoPago] = useState<string>('Pago Móvil');
  const [tasa, setTasa] = useState('');
  const [banco, setBanco] = useState('');
  const [cuentaCanal, setCuentaCanal] = useState('');
  const [montoDisplay, setMontoDisplay] = useState('');
  const [montoNumerico, setMontoNumerico] = useState<number>(0);
  const [referencia, setReferencia] = useState('');
  const [fechaPago, setFechaPago] = useState(() => new Date().toISOString().split('T')[0]);
  const [titular, setTitular] = useState('');
  const [rifTitular, setRifTitular] = useState('');

  // Zoom interactivo para comparar visualmente el soporte contra los datos extraídos + control de campos faltantes (null) y reintento
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [modalZoom, setModalZoom] = useState<number>(1);
  const [missingFields, setMissingFields] = useState<{
    fecha?: boolean;
    referencia?: boolean;
    monto?: boolean;
    banco?: boolean;
    cuenta?: boolean;
  }>({});
  const [lastOcrPayload, setLastOcrPayload] = useState<{
    base64: string;
    mimeType: string;
    fallbackDateIso?: string;
    fileName?: string;
  } | null>(null);

  // Safe localStorage persistence + IndexedDB offline queue hydration
  const [pagosConsolidados, setPagosConsolidados] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('ocr_pagos_consolidados');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(p => p && typeof p === 'object' && p.referencia);
    } catch (e) {
      console.warn("Error leyendo pagos consolidados:", e);
      return [];
    }
  });

  // Hidratar desde IndexedDB al montar (recupera PDFs o imágenes grandes que no caben en localStorage)
  useEffect(() => {
    let active = true;
    getAllCobrosFromLocalDB().then((idbRecords) => {
      if (!active || !idbRecords || idbRecords.length === 0) return;
      setPagosConsolidados((prev) => {
        const byId = new Map<string, any>();
        for (const item of prev) {
          if (item && item.id) byId.set(item.id, item);
        }
        for (const rec of idbRecords) {
          if (rec && rec.id) {
            const existing = byId.get(rec.id) || {};
            byId.set(rec.id, { ...existing, ...rec });
          }
        }
        return Array.from(byId.values());
      });
    });
    return () => {
      active = false;
    };
  }, []);

  // Monitorear estado de red (Online / Offline) y sincronizar cola automáticamente al recuperar señal
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      handleSyncPendingCobros(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pagosConsolidados]);

  const pendingSyncCount = useMemo(
    () => pagosConsolidados.filter((p) => p.syncStatus === 'pending' || p.syncStatus === 'error').length,
    [pagosConsolidados]
  );

  const handleSyncPendingCobros = async (silent = false) => {
    const pendingList = pagosConsolidados.filter((p) => p.syncStatus !== 'synced');
    if (pendingList.length === 0) {
      if (!silent) {
        setAlertMsg({ type: 'info', text: 'Todos los cobros de la relación actual ya están sincronizados en la nube.' });
        setTimeout(() => setAlertMsg(null), 3000);
      }
      return;
    }
    setIsSyncingCloud(true);
    let syncedCount = 0;
    for (const item of pendingList) {
      const res = await syncCobroToCloud(item as CobroRecord, getAuthHeaders());
      if (res.success) {
        syncedCount++;
        setPagosConsolidados((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? {
                  ...p,
                  comprobante_url: res.comprobante_url || p.comprobante_url,
                  syncStatus: 'synced',
                  syncedAt: res.syncedAt,
                }
              : p
          )
        );
      }
    }
    setIsSyncingCloud(false);
    if (syncedCount > 0) {
      setAlertMsg({
        type: 'success',
        text: `¡${syncedCount} ${syncedCount === 1 ? 'cobro sincronizado' : 'cobros sincronizados'} en Supabase Storage con éxito!`,
      });
      setTimeout(() => setAlertMsg(null), 3500);
    } else if (!silent) {
      setAlertMsg({
        type: 'error',
        text: 'No se pudo conectar con la nube en este momento. Los cobros siguen resguardados localmente.',
      });
      setTimeout(() => setAlertMsg(null), 3500);
    }
  };

  const [historialRelaciones, setHistorialRelaciones] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('ocr_historial_relaciones');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(r => r && typeof r === 'object').map(r => ({
        ...r,
        pagos: Array.isArray(r.pagos) ? r.pagos : []
      }));
    } catch (e) {
      console.warn("Error leyendo historial de relaciones:", e);
      return [];
    }
  });

  // Guardar en localStorage de forma segura (sin exceder cuota de 5MB)
  useEffect(() => {
    try {
      const safeForLocalStorage = pagosConsolidados.map(p => ({
        ...p,
        fileDataUrl: p.fileMimeType === 'application/pdf' ? undefined : p.fileDataUrl
      }));
      localStorage.setItem('ocr_pagos_consolidados', JSON.stringify(safeForLocalStorage));
    } catch (e) {
      console.warn("Cuota de localStorage excedida, guardando versión ligera sin imágenes pesadas:", e);
      try {
        const lightweight = pagosConsolidados.map(p => ({
          ...p,
          image: p.image && p.image.length > 20000 ? undefined : p.image,
          fileDataUrl: undefined
        }));
        localStorage.setItem('ocr_pagos_consolidados', JSON.stringify(lightweight));
      } catch (err) {
        console.error("Fallo al guardar en localStorage:", err);
      }
    }
  }, [pagosConsolidados]);

  useEffect(() => {
    try {
      localStorage.setItem('ocr_historial_relaciones', JSON.stringify(historialRelaciones));
    } catch (e) {
      console.warn("Cuota de localStorage excedida en historial:", e);
      try {
        const lightweight = historialRelaciones.map(rel => ({
          ...rel,
          pagos: (rel.pagos || []).map((p: any) => ({
            ...p,
            image: undefined,
            fileDataUrl: undefined
          }))
        }));
        localStorage.setItem('ocr_historial_relaciones', JSON.stringify(lightweight));
      } catch (err) {
        console.error("Fallo al guardar historial:", err);
      }
    }
  }, [historialRelaciones]);

  // Cargar tasa BCV oficial actual por defecto si no hay tasa
  useEffect(() => {
    if (!tasa) {
      fetch('/api/tasa-bcv?date=' + fechaPago)
        .then(async res => {
          if (!res.ok) return null;
          const text = await res.text();
          if (!text.trim().startsWith('{')) return null;
          return JSON.parse(text);
        })
        .then(data => {
          if (data && data.tasa) {
            setTasa(data.tasa.toString());
          }
        })
        .catch(err => console.log("No se pudo autocompletar tasa inicial:", err));
    }
  }, [fechaPago]);

  // Limpiar y parsear montos en formato venezolano ("576.599,07" -> 576599.07) e internacional de forma 100% exacta
  const parseMontoExacto = (val: any): number => {
    return parseMontoVenezolano(val);
  };

  const handleMontoChange = (val: string) => {
    setMontoDisplay(val);
    const num = parseMontoVenezolano(val);
    setMontoNumerico(num);
    if (num > 0) {
      setMissingFields((prev) => ({ ...prev, monto: false }));
    }
  };

  const handleMontoBlur = () => {
    const num = parseMontoVenezolano(montoDisplay);
    if (num > 0) {
      setMontoDisplay(new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num));
      setMontoNumerico(num);
      setMissingFields((prev) => ({ ...prev, monto: false }));
    } else {
      setMontoDisplay('');
      setMontoNumerico(0);
    }
  };

  const handleCuentaCanalChange = (val: string) => {
    setCuentaCanal(val);
    if (val.trim()) {
      setMissingFields((prev) => ({ ...prev, cuenta: false }));
      // Deducción automática del banco por prefijo de cuenta (ej. 0108*****40*****7396 -> BBVA Provincial) o plataforma (Provinet, BanescOnline)
      const inferred = inferirBancoVenezolano(banco, val, extractNumeroCuentaVenezolana(val) || val);
      const deduced = resolveVenezuelanBankDetails(null, val, extractNumeroCuentaVenezolana(val) || val);
      const targetBank = inferred || deduced.banco_identificado || '';
      if (targetBank && !banco.trim()) {
        setBanco(targetBank);
        setMissingFields((prev) => ({ ...prev, banco: false }));
      }
    }
  };

  // Buscador y sugerencias de clientes flexible (soporta ceros a la izquierda y nombres)
  const clientSuggestions = useMemo(() => {
    const rawClean = codigoCliente.replace(/^[#\s]+/, '').trim().toLowerCase();
    if (!rawClean || rawClean.length < 1) return [];
    const cleanNoZeros = rawClean.replace(/^0+/, '');

    return clientes.filter(c => {
      const cId = String(c.id || c.cliente_codigo || '').replace(/^[#\s]+/, '').trim().toLowerCase();
      const cIdNoZeros = cId.replace(/^0+/, '');
      const cName = String(c.cliente || c.cliente_nombre || c.razonSocial || '').toLowerCase();

      return cId.includes(rawClean) || 
             (cleanNoZeros.length > 0 && cIdNoZeros.includes(cleanNoZeros)) ||
             cName.includes(rawClean);
    }).slice(0, 12);
  }, [codigoCliente, clientes]);

  const handleCodigoChange = (val: string) => {
    setCodigoCliente(val);
    setShowSuggestions(true);

    const rawClean = val.replace(/^[#\s]+/, '').trim().toLowerCase();
    if (!rawClean) return;
    const cleanNoZeros = rawClean.replace(/^0+/, '');

    // Búsqueda de coincidencia exacta por código (con o sin ceros)
    const exact = clientes.find(c => {
      const cId = String(c.id || c.cliente_codigo || '').replace(/^[#\s]+/, '').trim().toLowerCase();
      const cIdNoZeros = cId.replace(/^0+/, '');
      return cId === rawClean || (cleanNoZeros.length > 0 && cIdNoZeros === cleanNoZeros);
    });

    if (exact) {
      const foundName = exact.cliente || exact.cliente_nombre || exact.razonSocial || '';
      setNombreCliente(foundName);
      setRucCliente(String(exact.id || exact.cliente_codigo || ''));
      setAlertMsg({ type: 'info', text: `Cliente identificado: ${foundName}` });
      setTimeout(() => setAlertMsg(null), 3500);
    }
  };

  const handleCodigoBlur = () => {
    setTimeout(async () => {
      setShowSuggestions(false);
      const clean = codigoCliente.replace(/^[#\s]+/, '').trim();
      if (clean && !nombreCliente.trim()) {
        try {
          const res = await fetch(`/api/client-lookup?codigo=${encodeURIComponent(clean.replace(/^0+/, '') || clean)}`, {
            headers: getAuthHeaders()
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.nombre) {
              setNombreCliente(data.nombre);
              setRucCliente(data.ruc || clean);
              setAlertMsg({ type: 'info', text: `Cliente encontrado en base de datos: ${data.nombre}` });
              setTimeout(() => setAlertMsg(null), 3000);
            }
          }
        } catch (e) {}
      }
    }, 250);
  };

  const selectClient = (c: any) => {
    const code = String(c.id || c.cliente_codigo || '');
    const name = c.cliente || c.cliente_nombre || c.razonSocial || '';
    setCodigoCliente(code);
    setNombreCliente(name);
    setRucCliente(code);
    setShowSuggestions(false);
    setAlertMsg({ type: 'info', text: `Cliente seleccionado: ${name}` });
    setTimeout(() => setAlertMsg(null), 3000);
  };

  // Fase 1 y 3: Validación estricta de formato/tamaño (máx. 10 MB), prepareImageForGemini (<= 2048px, calidad 0.92), vista previa inmediata y retroalimentación Toast
  const handleImageInput = async (file: File, fromWhatsApp = false) => {
    if (pagosConsolidados.length >= 60) {
      notifyUser('error', 'Has alcanzado el límite de 60 pagos en la relación. Por favor exporta en PDF para archivar.', 6000);
      return;
    }

    const validation = validateReceiptFile(file);
    if (!validation.valid) {
      notifyUser('error', validation.error || 'Archivo de soporte no válido. Usa JPG, PNG, WEBP, HEIC o PDF (máx. 10 MB).', 7000);
      return;
    }

    if (fromWhatsApp) {
      setReceivedFromWhatsApp(true);
    }

    setPreviewZoom(1);
    setMissingFields({});
    setIsProcessing(true);
    setProcessingLabel('Analizando soporte de pago...');
    notifyUser('info', `Analizando soporte de pago "${file.name || 'comprobante'}" (${formatFileSize(file.size)})...`, 4000);

    let finalFile = file;

    // Regla 5: Determinar fecha por defecto del archivo o del día actual para comprobantes sin fecha impresa (ej. BNC Pago Móvil)
    const resolveFallbackFileDateIso = (targetFile?: File): string => {
      const todayIso = new Date().toISOString().split('T')[0];
      if (!targetFile) return todayIso;
      const nameMatch = String(targetFile.name || '').match(/\b(20\d{2})[-_](\d{2})[-_](\d{2})\b/);
      if (nameMatch) {
        return `${nameMatch[1]}-${nameMatch[2]}-${nameMatch[3]}`;
      }
      if (typeof targetFile.lastModified === 'number' && targetFile.lastModified > 946684800000) {
        const d = new Date(targetFile.lastModified);
        if (!isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }
      }
      return todayIso;
    };
    const fallbackFileDateIso = resolveFallbackFileDateIso(file);

    // Soporte para formato HEIC de iPhone antes de pasar a prepareImageForGemini
    if (validation.isHeic) {
      try {
        setProcessingLabel('Convirtiendo soporte HEIC...');
        const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
        const blobResult = Array.isArray(converted) ? converted[0] : converted;
        finalFile = new File([blobResult as Blob], (file.name || 'soporte.heic').replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
        setProcessingLabel('Analizando soporte de pago...');
      } catch (err) {
        console.error("Fallo conversión HEIC:", err);
        setIsProcessing(false);
        notifyUser('error', 'Error al convertir formato HEIC de iPhone. Intenta compartir como JPG, PNG o PDF.', 6000);
        return;
      }
    }

    try {
      const prepared = await prepareImageForGemini(finalFile, {
        minDimension: 1280,
        maxDimension: 2048,
        quality: 0.92
      });
      const isPdfFile = prepared.mimeType === 'application/pdf' || validation.isPdf;
      const resolvedFileName =
        finalFile.name || (isPdfFile ? `comprobante_${Date.now()}.pdf` : `soporte_whatsapp.jpg`);
      const approxBytes = Math.round((prepared.base64Data.length * 3) / 4);

      if (isPdfFile) {
        setPreviewImage(null);
        setPreviewPdfDataUrl(prepared.dataUrl);
        setSharedFileMeta({
          name: resolvedFileName,
          mimeType: 'application/pdf',
          size: finalFile.size || approxBytes,
          isPdf: true
        });
      } else {
        setPreviewPdfDataUrl(null);
        setPreviewImage(prepared.dataUrl);
        setSharedFileMeta({
          name: resolvedFileName,
          mimeType: prepared.mimeType,
          size: finalFile.size || approxBytes,
          isPdf: false
        });
      }

      setLastOcrPayload({
        base64: prepared.base64Data,
        mimeType: prepared.mimeType,
        fallbackDateIso: fallbackFileDateIso,
        fileName: resolvedFileName
      });

      await processOCR(prepared.base64Data, prepared.mimeType, fallbackFileDateIso);
    } catch (prepErr: any) {
      console.error('Error en prepareImageForGemini:', prepErr);
      setIsProcessing(false);
      notifyUser('error', prepErr?.message || 'Error al preparar el archivo de comprobante.', 6000);
    }
  };

  // Botón para reintentar la lectura con IA sobre el soporte actualmente cargado
  const handleReintentarLectura = async () => {
    if (lastOcrPayload && lastOcrPayload.base64) {
      await processOCR(lastOcrPayload.base64, lastOcrPayload.mimeType, lastOcrPayload.fallbackDateIso);
      return;
    }
    const activeDataUrl = previewPdfDataUrl || previewImage;
    if (activeDataUrl) {
      const pureBase64 = activeDataUrl.includes(',') ? activeDataUrl.split(',')[1] : activeDataUrl;
      const mime = sharedFileMeta?.mimeType || (previewPdfDataUrl ? 'application/pdf' : 'image/jpeg');
      await processOCR(pureBase64, mime);
    }
  };

  // Auditoría Bancaria y Extracción Financiera Determinista (soporta imágenes JPEG/PNG/WEBP y documentos PDF)
  const processOCR = async (
    base64: string,
    mimeType: string = 'image/jpeg',
    fallbackDateIso?: string
  ) => {
    const pureBase64 = base64.includes(',') ? base64.split(',')[1].trim() : base64.trim();
    setLastOcrPayload((prev) => ({
      base64: pureBase64,
      mimeType,
      fallbackDateIso: fallbackDateIso ?? prev?.fallbackDateIso,
      fileName: sharedFileMeta?.name ?? prev?.fileName
    }));

    setIsProcessing(true);
    setProcessingLabel('Analizando soporte de pago...');
    try {
      let data: any = null;
      let resOk = false;

      const clientApiKey =
        (import.meta as any).env?.VITE_GEMINI_API_KEY ||
        (import.meta as any).env?.VITE_GOOGLE_API_KEY ||
        '';

      try {
        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ imageBase64: pureBase64, mimeType })
        });
        resOk = res.ok;
        const rawBodyText = await res.text();
        data = safeExtractReceiptJson(rawBodyText);

        // Si el backend no logró extraer datos (ej. clave no configurada en servidor) pero hay clave en cliente, reintentar con Gemini directo
        const hasExtractedServerData = Boolean(
          data &&
            (data.es_legible ||
              data.legible ||
              data.lectura_exitosa ||
              data.monto_bs ||
              data.referencia ||
              data.fecha_pago ||
              data.banco ||
              data.canal)
        );
        if (!hasExtractedServerData && clientApiKey) {
          const directRes = await extractSupportWithGemini({
            apiKeys: [clientApiKey],
            base64Data: pureBase64,
            mimeType
          });
          if (
            directRes.audited &&
            (directRes.audited.es_legible ||
              directRes.audited.legible ||
              directRes.audited.lectura_exitosa)
          ) {
            data = directRes.audited;
            resOk = true;
          }
        }
      } catch (networkErr) {
        // Fallback directo en cliente si el endpoint /api/ocr no responde y existe clave configurada
        if (clientApiKey) {
          const directRes = await extractSupportWithGemini({
            apiKeys: [clientApiKey],
            base64Data: pureBase64,
            mimeType
          });
          data = directRes.audited;
          resOk = Boolean(data?.es_legible || data?.legible || data?.lectura_exitosa);
        } else {
          throw networkErr;
        }
      }

      if (!data || typeof data !== 'object') {
        throw new Error("El servidor devolvió un formato no válido.");
      }

      const camposCargados: string[] = [];
      const camposFaltantes: string[] = [];
      const nextMissing: {
        fecha?: boolean;
        referencia?: boolean;
        monto?: boolean;
        banco?: boolean;
        cuenta?: boolean;
      } = {};

      const datosExtraidos =
        data && typeof data.datos_extraidos === 'object' && data.datos_extraidos !== null
          ? data.datos_extraidos
          : {};

      // 1. Método de Pago estricto (seleccionado automáticamente en el selector)
      const rawMetodoCandidate =
        data.metodo_pago ??
        data.canal ??
        datosExtraidos.plataforma_canal ??
        data.plataforma_canal ??
        null;
      if (rawMetodoCandidate && rawMetodoCandidate !== 'null') {
        const normalizedMetodo = normalizeMetodoPago(
          rawMetodoCandidate,
          `${data.observacion_auditoria || ''} ${data.observacion_ia || ''} ${data.motivo_revision || ''}`
        );
        setMetodoPago(normalizedMetodo);
        if (resOk || (data.es_legible !== false && data.legible !== false && data.lectura_exitosa !== false)) {
          camposCargados.push(normalizedMetodo);
        }
      }

      // 2. Cuenta / Canal (conserva asteriscos exactos como 0108*****40*****7396 o canal como Provinet / BanescOnline)
      const rawCuentaMask =
        datosExtraidos.numero_cuenta ??
        data.cuenta_origen_o_destino ??
        data.numero_cuenta ??
        data.cuenta ??
        null;
      const rawCanal =
        data.canal ??
        datosExtraidos.plataforma_canal ??
        data.plataforma_canal ??
        null;
      const resolvedCuentaCanal =
        (rawCuentaMask && rawCuentaMask !== 'null' ? String(rawCuentaMask).trim() : '') ||
        (rawCanal && rawCanal !== 'null' ? String(rawCanal).trim() : '');

      if (resolvedCuentaCanal) {
        setCuentaCanal(resolvedCuentaCanal);
        camposCargados.push(`Cuenta/Canal: ${resolvedCuentaCanal}`);
      } else {
        setCuentaCanal('');
      }

      // Contexto textual completo del comprobante para inferencia de respaldo
      const lineasEvidencia = Array.isArray(data?.evidencia_visual?.lineas_crudas_detectadas)
        ? data.evidencia_visual.lineas_crudas_detectadas.join(' ')
        : '';
      const textoCompletoSoporte = [
        data.texto_completo || '',
         data.textoCompleto || '',
        lineasEvidencia,
        rawCanal || '',
        rawCuentaMask || '',
        data.observacion_auditoria || '',
        data.observacion_ia || ''
      ]
        .filter(Boolean)
        .join(' ');

      // 3. Banco normalizado con inferirBancoVenezolano (inferencia obligatoria por Provinet / 0108 / códigos SUDEBAN)
      const rawBancoExtraido =
        data.banco ??
        datosExtraidos.banco_identificado ??
        data.banco_identificado ??
        data.banco_origen ??
        data.banco_destino ??
        datosExtraidos.codigo_banco ??
        data.codigo_banco ??
        null;

      const bancoInferido = inferirBancoVenezolano(
        rawBancoExtraido && rawBancoExtraido !== 'null' ? String(rawBancoExtraido) : '',
        textoCompletoSoporte,
        resolvedCuentaCanal
      );
      const deducedBankInfo = resolveVenezuelanBankDetails(
        rawBancoExtraido,
        rawCanal,
        rawCuentaMask,
        textoCompletoSoporte
      );
      const resolvedBanco =
        bancoInferido ||
        deducedBankInfo.banco_identificado ||
        (rawBancoExtraido && rawBancoExtraido !== 'null' ? String(rawBancoExtraido).trim() : null);

      if (resolvedBanco && resolvedBanco !== 'null') {
        const cleanBanco = String(resolvedBanco).trim();
        setBanco(cleanBanco);
        nextMissing.banco = false;
        if (cleanBanco) camposCargados.push(cleanBanco);
      } else {
        setBanco('');
        nextMissing.banco = true;
        camposFaltantes.push('Banco');
      }

      // 4. Monto en Bolívares usando parseMontoVenezolano ("48.742,49" -> 48742.49) sobre montoRaw y montoNumerico
      const candidateMontos = [
        data.montoRaw,
        datosExtraidos.montoRaw,
        datosExtraidos.monto_texto,
        data.monto_texto,
        data.monto_texto_original,
        data.montoNumerico,
        datosExtraidos.montoNumerico,
        datosExtraidos.monto_numerico,
        data.monto_numerico,
        data.monto_bs,
        data.monto
      ];

      let coherentMonto = 0;
      const parsedFromRawStr = parseMontoVenezolano(
        data.montoRaw ?? datosExtraidos.montoRaw ?? datosExtraidos.monto_texto ?? data.monto_texto ?? data.monto_texto_original
      );
      const parsedFromNumeric = parseMontoVenezolano(
        data.montoNumerico ?? datosExtraidos.montoNumerico ?? datosExtraidos.monto_numerico ?? data.monto_numerico ?? data.monto_bs ?? data.monto
      );

      if (parsedFromRawStr > 0 && parsedFromNumeric > 0) {
        // Si montoRaw ("48.742,49" -> 48742.49) difiere por factor ~1000 de montoNumerico (48.74), priorizar montoRaw
        coherentMonto =
          parsedFromRawStr > parsedFromNumeric && Math.abs(parsedFromRawStr / parsedFromNumeric - 1000) < 15
            ? parsedFromRawStr
            : parsedFromNumeric;
      } else {
        for (const cand of candidateMontos) {
          const val = parseMontoVenezolano(cand);
          if (val > 0) {
            coherentMonto = val;
            break;
          }
        }
      }

      if (coherentMonto > 0) {
        const formattedMonto = new Intl.NumberFormat('es-VE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(coherentMonto);
        setMontoNumerico(coherentMonto);
        setMontoDisplay(formattedMonto);
        nextMissing.monto = false;
        camposCargados.push(`Bs. ${formattedMonto}`);
      } else {
        setMontoNumerico(0);
        setMontoDisplay('');
        nextMissing.monto = true;
        camposFaltantes.push('Monto');
      }

      // 5. Número de Referencia (conservando TODOS los ceros a la izquierda, ej. "000019111")
      const resolvedRef =
        normalizeReferenciaBancaria(
          datosExtraidos.numero_referencia ??
            data.numero_referencia ??
            data.referencia ??
            data.nro_referencia
        ) ?? normalizeReferenciaBancaria(data.codigo_autorizacion);

      if (resolvedRef) {
        setReferencia(resolvedRef);
        camposCargados.push(`Ref: ${resolvedRef}`);
      } else {
        setReferencia('');
        nextMissing.referencia = true;
        camposFaltantes.push('Referencia');
      }

      // 6. Fecha del comprobante (si viene null porque fue recortada en la foto, marca aviso en Fecha sin bloquear)
      const rawFechaOriginal =
        datosExtraidos.fecha_original ?? data.fecha_original ?? data.fecha_pago;
      const rawFechaOperacionIso =
        datosExtraidos.fecha_operacion ?? data.fecha_operacion ?? data.fecha_iso;
      const normalizedDates = normalizeReceiptDates(rawFechaOriginal, rawFechaOperacionIso);
      const explicitIsoDate =
        rawFechaOperacionIso && /^\d{4}-\d{2}-\d{2}$/.test(String(rawFechaOperacionIso).trim())
          ? String(rawFechaOperacionIso).trim()
          : normalizedDates.fecha_iso;
      const effectiveIsoDate =
        explicitIsoDate || fallbackDateIso || new Date().toISOString().split('T')[0];

      if (explicitIsoDate) {
        setFechaPago(explicitIsoDate);
        camposCargados.push(`Fecha: ${normalizedDates.fecha_pago || explicitIsoDate}`);
      } else {
        setFechaPago(effectiveIsoDate);
        nextMissing.fecha = true;
        camposFaltantes.push('Fecha (no visible en recorte)');
      }

      if (effectiveIsoDate) {
        // Consultar tasa oficial BCV correspondiente a la fecha del comprobante
        try {
          const rateRes = await fetch(`/api/tasa-bcv?date=${effectiveIsoDate}`);
          if (rateRes.ok) {
            const rateText = await rateRes.text();
            if (rateText.trim().startsWith('{') || rateText.includes('```')) {
              const rateData = safeExtractReceiptJson(rateText);
              if (rateData && rateData.tasa) {
                setTasa(rateData.tasa.toString());
              }
            }
          }
        } catch (rErr) {
          console.warn("No se pudo autocompletar la tasa:", rErr);
        }
      }

      // 7. Distinción estricta Emisor vs. Beneficiario (NUNCA colocar CODIZULCA en Titular / RIF)
      const resolvedTitular = data.titular_remitente ?? data.titular ?? null;
      if (resolvedTitular && resolvedTitular !== 'null' && !isBeneficiaryName(String(resolvedTitular))) {
        const titularStr = String(resolvedTitular).trim();
        setTitular(titularStr);
        if (titularStr) camposCargados.push(`Remitente: ${titularStr}`);

        // Auto-vincular cliente si no se ha seleccionado y coincide con el emisor real
        if (!codigoCliente && titularStr.length > 3) {
          const tClean = titularStr.toLowerCase();
          const match = clientes.find(c => {
            const cName = String(c.cliente || c.cliente_nombre || c.razonSocial || '').toLowerCase();
            return cName && (cName.includes(tClean) || tClean.includes(cName));
          });
          if (match) {
            const foundCode = String(match.id || match.cliente_codigo || '');
            const foundName = match.cliente || match.cliente_nombre || match.razonSocial || '';
            setCodigoCliente(foundCode);
            setNombreCliente(foundName);
            setRucCliente(foundCode);
          }
        }
      } else {
        setTitular('');
      }

      const resolvedRif = data.rif_ci_titular ?? data.rif ?? null;
      if (resolvedRif && resolvedRif !== 'null' && !isBeneficiaryRif(String(resolvedRif))) {
        const cleanRif = String(resolvedRif).trim();
        setRifTitular(cleanRif);
        if (cleanRif) camposCargados.push(`RIF/CI: ${cleanRif}`);
      } else {
        setRifTitular('');
      }

      setMissingFields(nextMissing);

      // Verificar si se extrajo al menos un campo financiero real (permitiendo lecturas parciales sin lanzar error general)
      const tieneDatosFinancierosExtraidos = Boolean(
        (resolvedBanco && resolvedBanco !== 'null') ||
          (coherentMonto !== null && coherentMonto > 0) ||
          resolvedRef ||
          explicitIsoDate ||
          resolvedCuentaCanal ||
          (resolvedTitular && resolvedTitular !== 'null' && !isBeneficiaryName(String(resolvedTitular)))
      );

      if (!tieneDatosFinancierosExtraidos) {
        setMissingFields({
          fecha: true,
          referencia: true,
          monto: true,
          banco: true
        });
        const reason =
          data.motivo_revision ||
          data.observacion_auditoria ||
          data.observacion_ia ||
          data.error ||
          'No se detectaron datos legibles en la imagen.';
        notifyUser(
          'info',
          `Lectura asistida: ${reason} Completa los campos resaltados en ámbar o presiona "Reintentar lectura".`,
          6500
        );
        return;
      }

      if (camposFaltantes.length > 0) {
        notifyUser(
          'info',
          `Datos extraídos (${camposCargados.join(' • ')}). Completa manualmente: ${camposFaltantes.join(', ')}.`,
          6500
        );
      } else {
        notifyUser(
          'success',
          `¡Datos cargados del comprobante! ${camposCargados.join(' • ')}`,
          6000
        );
      }
    } catch (err: any) {
      console.error("Error en processOCR:", err);
      setMissingFields({
        referencia: !referencia.trim(),
        monto: montoNumerico <= 0,
        banco: !banco.trim()
      });
      const raw = String(err?.message || '');
      const looksRaw = raw.trim().startsWith('{') || /RESOURCE_EXHAUSTED|prepayment|billing|API Key/i.test(raw);
      notifyUser(
        'info',
        looksRaw || !raw
          ? 'Soporte cargado en vista previa. Completa los campos resaltados abajo o toca "Reintentar lectura".'
          : `Soporte en vista previa (${raw}). Puedes completar los datos manualmente o tocar "Reintentar lectura".`,
        6500
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Soporte de pegado desde portapapeles (WhatsApp / Capturas / PDF) y recepción directa vía Web Share Target
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/') || items[i].type === 'application/pdf') {
            const blob = items[i].getAsFile();
            if (blob) {
              setReceivedFromWhatsApp(true);
              handleImageInput(blob, true);
              return;
            }
          }
        }
      }
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/') || file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          setReceivedFromWhatsApp(true);
          handleImageInput(file, true);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [pagosConsolidados]);

  // Escuchar eventos de instalación PWA para habilitar el botón "Compartir desde WhatsApp"
  useEffect(() => {
    const onPromptReady = () => setCanInstallPwa(Boolean((window as any).__fdvDeferredInstallPrompt));
    const onInstalled = () => {
      setCanInstallPwa(false);
      setIsStandalonePwa(true);
      notifyUser(
        'success',
        '¡App instalada! Ahora en WhatsApp puedes tocar cualquier comprobante (imagen o PDF) -> Compartir -> FDV Cobros.',
        6000
      );
    };
    window.addEventListener('fdv-install-prompt-ready', onPromptReady);
    window.addEventListener('fdv-app-installed', onInstalled);
    return () => {
      window.removeEventListener('fdv-install-prompt-ready', onPromptReady);
      window.removeEventListener('fdv-app-installed', onInstalled);
    };
  }, []);

  // Consumir comprobante compartido directamente desde el menú "Compartir" de WhatsApp (IndexedDB, Cache Storage, Server Temp Store o Fallback localStorage)
  useEffect(() => {
    let isMounted = true;
    let isConsuming = false;

    const applySharedCaptionMeta = (captionText: string) => {
      const clean = String(captionText || '').trim();
      if (!clean) return;
      const facMatch = clean.match(/(?:fac(?:tura)?|nro|nota)\s*[:#-]?\s*([A-Za-z0-9-]{3,15})/i);
      if (facMatch && facMatch[1] && !factura) {
        setFactura(facMatch[1]);
      }
    };

    const cleanupShareUrlFlags = () => {
      try {
        sessionStorage.removeItem('fdv_pending_whatsapp_share');
        sessionStorage.removeItem('fdv_shared_receipt_id');
        if (window.location.search.includes('shared-receipt') || window.location.search.includes('receiptId') || window.location.hash === '#cobros') {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch {}
    };

    const consumeSharedReceipt = async () => {
      if (isConsuming || !isMounted) return;
      isConsuming = true;
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('shared-receipt') === 'error') {
          cleanupShareUrlFlags();
          notifyUser(
            'error',
            'No se pudo recibir el archivo automático desde WhatsApp. Por favor selecciónalo tocando aquí.',
            7000,
            { label: 'Elegir Archivo', onClick: triggerNativeFilePicker }
          );
          return;
        }

        // 1. Revisar IndexedDB (escrito por el Service Worker o por el script puente del servidor, soporta archivos grandes > 5MB)
        const idbRecord = await consumeSharedReceiptFromIDB();
        if (idbRecord && idbRecord.blob && idbRecord.blob.size > 0 && isMounted) {
          // Limpiar también CacheStorage para no procesarlo dos veces
          if ('caches' in window) {
            caches.open('fdv-whatsapp-share-v1').then((c) => {
              c.delete('/__shared_whatsapp_receipt__');
              c.delete('/__shared_whatsapp_meta__');
            }).catch(() => {});
          }
          localStorage.removeItem('fdv_shared_whatsapp_payload');

          const fileName = idbRecord.name || (idbRecord.type === 'application/pdf' ? 'soporte_whatsapp.pdf' : 'soporte_whatsapp.jpg');
          const mimeType = idbRecord.type || idbRecord.blob.type || (fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
          const sharedFile = new File([idbRecord.blob], fileName, { type: mimeType });

          setActiveSubTab('nuevo');
          setReceivedFromWhatsApp(true);
          if (idbRecord.text || idbRecord.title) {
            applySharedCaptionMeta(`${idbRecord.title || ''} ${idbRecord.text || ''}`);
          }
          cleanupShareUrlFlags();
          handleImageInput(sharedFile, true);
          return;
        }

        // 2. Revisar Cache Storage escrito por el Service Worker (Web Share Target API)
        if ('caches' in window) {
          const cache = await caches.open('fdv-whatsapp-share-v1');
          const sharedRes = await cache.match('/__shared_whatsapp_receipt__');
          if (sharedRes) {
            const metaRes = await cache.match('/__shared_whatsapp_meta__');
            const meta = metaRes ? await metaRes.json().catch(() => null) : null;
            const blob = await sharedRes.blob();
            await cache.delete('/__shared_whatsapp_receipt__');
            await cache.delete('/__shared_whatsapp_meta__');

            if (blob && blob.size > 0 && isMounted) {
              const fileName =
                meta?.name ||
                decodeURIComponent(sharedRes.headers.get('X-File-Name') || 'soporte_whatsapp.jpg');
              const mimeType =
                meta?.type ||
                sharedRes.headers.get('Content-Type') ||
                blob.type ||
                (fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
              const sharedFile = new File([blob], fileName, { type: mimeType });

              setActiveSubTab('nuevo');
              setReceivedFromWhatsApp(true);
              if (meta?.text || meta?.title) {
                applySharedCaptionMeta(`${meta.title || ''} ${meta.text || ''}`);
              }
              cleanupShareUrlFlags();
              handleImageInput(sharedFile, true);
              return;
            }
          }
        }

        // 3. Revisar token efímero del servidor (/api/shared-receipt-temp/:id) cuando el archivo era grande o entró vía POST al backend
        const receiptId = params.get('receiptId') || sessionStorage.getItem('fdv_shared_receipt_id');
        if (receiptId) {
          try {
            const tempRes = await fetch(`/api/shared-receipt-temp/${encodeURIComponent(receiptId)}`);
            if (tempRes.ok) {
              const parsed = await tempRes.json();
              if (parsed && parsed.dataUrl && isMounted) {
                const fetchRes = await fetch(parsed.dataUrl);
                const blob = await fetchRes.blob();
                const fileName = parsed.name || 'soporte_whatsapp.jpg';
                const mimeType =
                  parsed.type ||
                  blob.type ||
                  (fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
                const sharedFile = new File([blob], fileName, { type: mimeType });
                localStorage.removeItem('fdv_shared_whatsapp_payload');
                setActiveSubTab('nuevo');
                setReceivedFromWhatsApp(true);
                cleanupShareUrlFlags();
                handleImageInput(sharedFile, true);
                return;
              }
            }
          } catch (tempErr) {
            console.warn('Error consultando comprobante temporal del servidor:', tempErr);
          }
        }

        // 4. Revisar Fallback en localStorage escrito por POST /share-target-cobro del servidor
        const rawPayload = localStorage.getItem('fdv_shared_whatsapp_payload');
        if (rawPayload) {
          localStorage.removeItem('fdv_shared_whatsapp_payload');
          const parsed = JSON.parse(rawPayload);
          if (parsed && parsed.dataUrl && isMounted) {
            const fetchRes = await fetch(parsed.dataUrl);
            const blob = await fetchRes.blob();
            const fileName = parsed.name || 'soporte_whatsapp.jpg';
            const mimeType =
              parsed.type ||
              blob.type ||
              (fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
            const sharedFile = new File([blob], fileName, { type: mimeType });
            setActiveSubTab('nuevo');
            setReceivedFromWhatsApp(true);
            cleanupShareUrlFlags();
            handleImageInput(sharedFile, true);
            return;
          }
        }
      } catch (err) {
        console.warn('Error leyendo comprobante compartido desde WhatsApp:', err);
      } finally {
        isConsuming = false;
      }
    };

    consumeSharedReceipt();

    const onSwMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'WHATSAPP_SHARED_RECEIPT') {
        consumeSharedReceipt();
      }
    };
    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        consumeSharedReceipt();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwMessage);
    }
    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    return () => {
      isMounted = false;
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage);
      }
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  }, []);

  // Vía B: Botón "Pegar Soporte de WhatsApp" con manejo de permisos, blobs de imagen/PDF y mensajes claros en Android
  const handlePasteFromWhatsAppButton = async () => {
    setIsProcessing(true);
    setProcessingLabel('Leyendo portapapeles...');
    try {
      // Verificar estado de permiso en navegadores compatibles (Chromium / Android)
      if (navigator.permissions && typeof navigator.permissions.query === 'function') {
        try {
          const permStatus = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
          if (permStatus.state === 'denied') {
            setIsProcessing(false);
            notifyUser(
              'error',
              'El permiso del portapapeles está bloqueado en tu navegador. Usa el botón para elegir el archivo de WhatsApp.',
              7000,
              { label: 'Elegir Archivo', onClick: triggerNativeFilePicker }
            );
            return;
          }
        } catch {
          // Algunos navegadores móviles no soportan query para 'clipboard-read', continuar con read()
        }
      }

      if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
        setIsProcessing(false);
        notifyUser(
          'info',
          'Tu navegador en este dispositivo no permite leer imágenes del portapapeles directamente. Selecciona la imagen o PDF de WhatsApp aquí.',
          7000,
          { label: 'Abrir Archivos de WhatsApp', onClick: triggerNativeFilePicker }
        );
        return;
      }

      const items = await navigator.clipboard.read();
      for (const item of items) {
        const supportedType = item.types.find(
          (t) => t.startsWith('image/') || t === 'application/pdf'
        );
        if (supportedType) {
          const blob = await item.getType(supportedType);
          if (blob && blob.size > 0) {
            const ext = supportedType === 'application/pdf' ? 'pdf' : supportedType.includes('jpeg') ? 'jpg' : 'png';
            const file = new File([blob], `whatsapp_cobro_${Date.now()}.${ext}`, { type: supportedType });
            setReceivedFromWhatsApp(true);
            await handleImageInput(file, true);
            return;
          }
        }
      }

      setIsProcessing(false);
      notifyUser(
        'error',
        'El portapapeles de Android no contiene una imagen o PDF válido. En WhatsApp toca la foto -> Copiar, o toca "Elegir Archivo" para cargarlo de Recientes.',
        7500,
        { label: 'Elegir Archivo', onClick: triggerNativeFilePicker }
      );
    } catch (err: any) {
      setIsProcessing(false);
      console.warn('Aviso al leer portapapeles:', err);
      notifyUser(
        'info',
        'No se pudo leer una imagen del portapapeles (permiso denegado o sin imagen copiada). Toca "Elegir Archivo" para seleccionar el soporte de WhatsApp.',
        7500,
        { label: 'Elegir Archivo', onClick: triggerNativeFilePicker }
      );
    }
  };

  // Vía C: Botón "Compartir desde WhatsApp" -> abre directamente el selector nativo de archivos (Recientes / WhatsApp) y despliega la guía rápida
  const handleShareFromWhatsAppButton = () => {
    setShowWhatsAppGuide(true);
    triggerNativeFilePicker();
  };

  // Activar la app en el menú nativo "Compartir" de WhatsApp (Web Share Target PWA)
  const handleEnableWhatsAppShareTarget = async () => {
    const deferredPrompt = (window as any).__fdvDeferredInstallPrompt;
    if (deferredPrompt && typeof deferredPrompt.prompt === 'function') {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          (window as any).__fdvDeferredInstallPrompt = null;
          setCanInstallPwa(false);
          setIsStandalonePwa(true);
        }
      } catch (e) {
        setShowWhatsAppGuide(true);
      }
    } else {
      setShowWhatsAppGuide((prev) => !prev);
    }
  };

  // Fase 3: Consolidar, guardar en Cola Offline (IndexedDB) y subir comprobante a Supabase Storage
  const handleSave = async () => {
    const cleanRef = referencia.trim();
    if (!cleanRef) {
      setMissingFields((prev) => ({ ...prev, referencia: true }));
      setAlertMsg({ type: 'error', text: 'Debe ingresar el número de referencia del pago.' });
      return;
    }
    if (montoNumerico <= 0) {
      setMissingFields((prev) => ({ ...prev, monto: true }));
      setAlertMsg({ type: 'error', text: 'Debe ingresar un monto válido mayor a 0.' });
      return;
    }
    if (!nombreCliente.trim()) {
      setAlertMsg({ type: 'error', text: 'Debe ingresar el nombre del cliente o seleccionar un código válido.' });
      return;
    }

    try {
      setIsProcessing(true);

      // Verificar si ya existe en la lista actual
      const existeEnLista = pagosConsolidados.some(p => 
        String(p.referencia || '').trim().toLowerCase() === cleanRef.toLowerCase()
      );
      if (existeEnLista) {
        setAlertMsg({ type: 'error', text: `¡Atención! La referencia ${cleanRef} ya está registrada en la lista de cobros actual.` });
        setIsProcessing(false);
        return;
      }

      // Verificar si ya existe en el historial archivado
      const existeEnHistorial = historialRelaciones.some(rel => 
        (rel.pagos || []).some((p: any) => String(p.referencia || '').trim().toLowerCase() === cleanRef.toLowerCase())
      );
      if (existeEnHistorial) {
        const confirmar = window.confirm(`⚠️ Advertencia: La referencia ${cleanRef} ya fue registrada en una relación anterior archivada en el historial. ¿Estás seguro de registrarla nuevamente?`);
        if (!confirmar) {
          setIsProcessing(false);
          return;
        }
      }

      const tasaNum = parseFloat(tasa) || 0;
      const vendedorEmail = (currentVendedor.toUpperCase().includes('MIKELANGELO') || currentVendedor.toUpperCase().includes('SOTO'))
        ? 'Mikelangelodiaz@gmail.com'
        : undefined;
      const nowIso = new Date().toISOString();
      const activeDataUrl = previewPdfDataUrl || previewImage || undefined;

      const nuevoPago: CobroRecord = {
        id: `pago-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        vendedor: currentVendedor,
        vendedorEmail: vendedorEmail,
        ruta: ruta || 'Ruta 1',
        metodo_pago: metodoPago || 'Pago Móvil',
        banco: banco.trim() || 'No especificado',
        monto: montoNumerico,
        referencia: cleanRef,
        fecha_pago: fechaPago,
        titular: titular.trim() || 'No especificado',
        rif: rifTitular.trim() || '',
        tasa: tasaNum,
        codigo_cliente: codigoCliente.trim() || 'N/A',
        nombre_cliente: nombreCliente.trim(),
        factura: factura.trim() || 'N/A',
        image: previewImage || undefined,
        fileDataUrl: activeDataUrl,
        fileName: sharedFileMeta?.name || (previewPdfDataUrl ? `comprobante_${cleanRef}.pdf` : `comprobante_${cleanRef}.jpg`),
        fileMimeType: sharedFileMeta?.mimeType || (previewPdfDataUrl ? 'application/pdf' : 'image/jpeg'),
        fileSize: sharedFileMeta?.size || undefined,
        syncStatus: 'pending',
        createdAt: nowIso
      };

      // 1. Guardar inmediatamente en IndexedDB (soporte Offline garantizado) y en estado local
      await saveCobroToLocalDB(nuevoPago);
      setPagosConsolidados(prev => [nuevoPago, ...prev]);

      // Limpiar formulario para el siguiente pago de forma inmediata
      setPreviewImage(null);
      setPreviewPdfDataUrl(null);
      setSharedFileMeta(null);
      setReceivedFromWhatsApp(false);
      setPreviewZoom(1);
      setMissingFields({});
      setLastOcrPayload(null);
      setCuentaCanal('');
      setReferencia('');
      setMontoDisplay('');
      setMontoNumerico(0);
      setFactura('');
      setCodigoCliente('');
      setNombreCliente('');
      setRucCliente('');
      setTitular('');
      setRifTitular('');
      setShowSuggestions(false);

      // 2. Subir comprobante a Supabase Storage y vincular comprobante_url en segundo plano
      const syncResult = await syncCobroToCloud(nuevoPago, getAuthHeaders());
      if (syncResult.success) {
        setPagosConsolidados(prev =>
          prev.map(p =>
            p.id === nuevoPago.id
              ? {
                  ...p,
                  comprobante_url: syncResult.comprobante_url,
                  syncStatus: 'synced',
                  syncedAt: syncResult.syncedAt
                }
              : p
          )
        );
        setAlertMsg({ 
          type: 'success', 
          text: `¡Pago de ${nuevoPago.nombre_cliente} (Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(nuevoPago.monto)}) consolidado y respaldado en la nube!` 
        });
      } else {
        setAlertMsg({ 
          type: 'info', 
          text: `Pago de ${nuevoPago.nombre_cliente} guardado en cola local (Offline). Se sincronizará automáticamente al recuperar conexión.` 
        });
      }

      setTimeout(() => setAlertMsg(null), 4500);
    } catch (err: any) {
      console.error("Error al consolidar pago:", err);
      setAlertMsg({ type: 'error', text: err.message || 'Error al guardar el pago.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Eliminar un pago individual de la lista actual y de IndexedDB
  const handleEliminarPago = (id: string) => {
    setPagosConsolidados(prev => prev.filter(p => p.id !== id));
    deleteCobroFromLocalDB(id);
    setAlertMsg({ type: 'info', text: 'Pago removido de la relación actual.' });
    setTimeout(() => setAlertMsg(null), 2500);
  };

  // Generar PDF de la relación actual
  const generarRelacionPDF = () => {
    if (pagosConsolidados.length === 0) {
      setAlertMsg({ type: 'error', text: 'No hay pagos cargados para exportar en PDF.' });
      return;
    }

    setAlertMsg({ type: 'info', text: 'Generando documento PDF de la relación...' });
    try {
      const doc = new jsPDF('landscape');
      const totalMonto = pagosConsolidados.reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0);
      const totalUSD = pagosConsolidados.reduce((acc, curr) => {
        const t = Number(curr.tasa) || 0;
        return acc + (t > 0 ? (Number(curr.monto) || 0) / t : 0);
      }, 0);

      // Encabezado
      doc.setFontSize(14);
      doc.setTextColor(211, 47, 47);
      doc.text('DISTRIBUIDORA CODIZULCA - RELACIÓN DE COBROS', 14, 15);

      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Vendedor: ${currentVendedor}  |  Ruta: ${ruta}  |  Fecha: ${new Date().toLocaleDateString('es-VE')}`, 14, 21);
      doc.text(`Total Pagos: ${pagosConsolidados.length}  |  Total Bs: ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(totalMonto)}  |  Total USD: $${totalUSD.toFixed(2)}`, 14, 26);

      // Tabla de Pagos
      const tableData = pagosConsolidados.map(p => {
        const m = Number(p.monto) || 0;
        const t = Number(p.tasa) || 0;
        const usd = t > 0 ? (m / t).toFixed(2) : '0.00';
        return [
          p.codigo_cliente || 'N/A',
          p.nombre_cliente || 'Sin nombre',
          p.factura || 'N/A',
          p.banco || 'N/A',
          new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(m),
          p.referencia || 'N/A',
          p.fecha_pago || 'N/A',
          p.titular || 'N/A',
          p.rif || '',
          t > 0 ? t.toFixed(2) : 'N/A',
          `$${usd}`
        ];
      });

      tableData.push([
        'TOTAL',
        `${pagosConsolidados.length} pagos`,
        '',
        '',
        new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalMonto),
        '',
        '',
        '',
        '',
        '',
        `$${totalUSD.toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: 30,
        head: [['C.C', 'Cliente', 'Factura', 'Banco', 'Monto (Bs.)', 'Referencia', 'Fecha', 'Titular', 'RIF/CI', 'Tasa', 'USD ($)']],
        body: tableData,
        headStyles: { fillColor: [211, 47, 47] },
        styles: { fontSize: 8 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fillColor = [240, 240, 240];
            data.cell.styles.fontStyle = 'bold';
          }
        },
        theme: 'grid'
      });

      // Anexos de Comprobantes (hasta 10 por página)
      let imageCount = 0;
      pagosConsolidados.forEach((p, index) => {
        if (p.image) {
          if (imageCount % 10 === 0) {
            doc.addPage();
            doc.setFontSize(11);
            doc.setTextColor(211, 47, 47);
            doc.text('SOPORTES DE PAGO ADJUNTOS', 14, 12);
          }

          const localIndex = imageCount % 10;
          const col = localIndex % 5;
          const row = Math.floor(localIndex / 5);
          const x = 14 + (col * 55);
          const y = 18 + (row * 90);

          doc.setFontSize(8);
          doc.setTextColor(0, 0, 0);
          doc.text(`Ref: ${p.referencia || 'N/A'}`, x, y);
          doc.text(`Cli: ${(p.nombre_cliente || '').slice(0, 15)}`, x, y + 4);

          try {
            doc.addImage(p.image, 'JPEG', x, y + 6, 48, 75, undefined, 'FAST');
          } catch (imgErr) {
            doc.setFontSize(7);
            doc.setTextColor(150, 150, 150);
            doc.text('Error al incrustar imagen', x, y + 20);
          }

          imageCount++;
        }
      });

      const dateStr = new Date().toISOString().split('T')[0];
      doc.save(`Relacion_Cobros_${currentVendedor.replace(/\s+/g, '_')}_${dateStr}.pdf`);
      setAlertMsg({ type: 'success', text: '¡PDF exportado con éxito!' });
      setTimeout(() => setAlertMsg(null), 3000);
    } catch (err: any) {
      console.error("Error al generar PDF:", err);
      setAlertMsg({ type: 'error', text: 'Error al generar el documento PDF.' });
    }
  };

  // Generar PDF desde un registro del Historial
  const generarPDFDesdeHistorial = (rel: any) => {
    setAlertMsg({ type: 'info', text: 'Generando PDF de la relación archivada...' });
    try {
      const doc = new jsPDF('landscape');
      const pagos = Array.isArray(rel.pagos) ? rel.pagos : [];
      const totalMonto = Number(rel.montoTotal) || pagos.reduce((acc: number, curr: any) => acc + (Number(curr.monto) || 0), 0);
      const totalUSD = pagos.reduce((acc: number, curr: any) => {
        const t = Number(curr.tasa) || 0;
        return acc + (t > 0 ? (Number(curr.monto) || 0) / t : 0);
      }, 0);

      doc.setFontSize(14);
      doc.setTextColor(211, 47, 47);
      doc.text('DISTRIBUIDORA CODIZULCA - HISTORIAL DE RELACIÓN', 14, 15);

      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Vendedor: ${rel.vendedor || currentVendedor}  |  Fecha: ${new Date(rel.fecha).toLocaleDateString('es-VE')} ${new Date(rel.fecha).toLocaleTimeString('es-VE')}`, 14, 21);
      doc.text(`Total Pagos: ${pagos.length}  |  Total Bs: ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(totalMonto)}  |  Total USD: $${totalUSD.toFixed(2)}`, 14, 26);

      const tableData = pagos.map((p: any) => {
        const m = Number(p.monto) || 0;
        const t = Number(p.tasa) || 0;
        const usd = t > 0 ? (m / t).toFixed(2) : '0.00';
        return [
          p.codigo_cliente || 'N/A',
          p.nombre_cliente || 'Sin nombre',
          p.factura || 'N/A',
          p.banco || 'N/A',
          new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(m),
          p.referencia || 'N/A',
          p.fecha_pago || 'N/A',
          p.titular || 'N/A',
          p.rif || '',
          t > 0 ? t.toFixed(2) : 'N/A',
          `$${usd}`
        ];
      });

      if (pagos.length > 0) {
        tableData.push([
          'TOTAL',
          `${pagos.length} pagos`,
          '',
          '',
          new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalMonto),
          '',
          '',
          '',
          '',
          '',
          `$${totalUSD.toFixed(2)}`
        ]);
      }

      autoTable(doc, {
        startY: 30,
        head: [['C.C', 'Cliente', 'Factura', 'Banco', 'Monto (Bs.)', 'Referencia', 'Fecha', 'Titular', 'RIF/CI', 'Tasa', 'USD ($)']],
        body: tableData,
        headStyles: { fillColor: [211, 47, 47] },
        styles: { fontSize: 8 },
        didParseCell: (data) => {
          if (data.section === 'body' && pagos.length > 0 && data.row.index === tableData.length - 1) {
            data.cell.styles.fillColor = [240, 240, 240];
            data.cell.styles.fontStyle = 'bold';
          }
        },
        theme: 'grid'
      });

      const dateStr = new Date(rel.fecha).toISOString().split('T')[0];
      doc.save(`Relacion_Historica_${(rel.vendedor || currentVendedor).replace(/\s+/g, '_')}_${dateStr}.pdf`);
      setAlertMsg({ type: 'success', text: '¡PDF histórico exportado con éxito!' });
      setTimeout(() => setAlertMsg(null), 3000);
    } catch (err: any) {
      console.error("Error generando PDF histórico:", err);
      setAlertMsg({ type: 'error', text: 'Error al exportar el PDF del historial.' });
    }
  };

  // Enviar a Cuentas por Cobrar (Archivar en Historial)
  const handleEnviarCuentasPorCobrar = () => {
    if (pagosConsolidados.length === 0) return;

    const totalMonto = pagosConsolidados.reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0);
    const nuevaRelacion = {
      id: `rel-${Date.now()}`,
      fecha: new Date().toISOString(),
      vendedor: currentVendedor,
      cantidadPagos: pagosConsolidados.length,
      montoTotal: totalMonto,
      pagos: [...pagosConsolidados]
    };

    setHistorialRelaciones(prev => [nuevaRelacion, ...prev]);
    setPagosConsolidados([]);
    clearCobrosFromLocalDB();
    setAlertMsg({ type: 'success', text: '¡Relación enviada y archivada en el Historial con éxito!' });
    setTimeout(() => setAlertMsg(null), 3500);
  };

  return (
    <div className="w-full">
      {/* Pestañas Superiores */}
      <div className="flex flex-wrap border-b border-neutral-800 mb-6 justify-between items-center gap-2">
        <div className="flex">
          <button 
            onClick={() => setActiveSubTab('nuevo')}
            className={`px-6 py-3 text-sm font-sans font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${
              activeSubTab === 'nuevo' 
                ? 'text-red-500 border-b-2 border-red-500' 
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Camera className="w-4 h-4" />
            Cargar / Registrar Cobro
          </button>
          <button 
            onClick={() => setActiveSubTab('historial')}
            className={`px-6 py-3 text-sm font-sans font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${
              activeSubTab === 'historial' 
                ? 'text-red-500 border-b-2 border-red-500' 
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <History className="w-4 h-4" />
            Historial de Relaciones ({historialRelaciones.length})
          </button>
        </div>

        {/* Estado de Red / Cola Offline + Info Vendedor Activo */}
        <div className="flex items-center gap-2 pb-2 sm:pb-0">
          {pendingSyncCount > 0 && (
            <button
              type="button"
              onClick={() => handleSyncPendingCobros(false)}
              disabled={isSyncingCloud}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/60 rounded-lg text-xs font-sans font-bold text-amber-300 transition-colors cursor-pointer"
              title="Subir comprobantes pendientes en la cola local a Supabase Storage"
            >
              {isSyncingCloud ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>Sincronizar Pendientes ({pendingSyncCount})</span>
            </button>
          )}

          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono border ${
              isOnline
                ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-400'
                : 'bg-amber-950/40 border-amber-800/60 text-amber-400'
            }`}
          >
            {isOnline ? <Cloud className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? 'Nube Activa' : 'Modo Offline'}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono">
            <User className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-neutral-400">Vendedor:</span>
            <span className="text-white font-bold">{currentVendedor}</span>
          </div>
        </div>
      </div>

      {/* Notificación Toast Flotante (Visible en cualquier posición de scroll móvil/desktop) */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className={`p-3.5 rounded-xl flex items-center justify-between gap-3 font-bold text-xs shadow-2xl border backdrop-blur-md ${
            toastMsg.type === 'error'
              ? 'bg-red-950/95 border-red-700 text-red-200'
              : toastMsg.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-700 text-emerald-200'
              : 'bg-neutral-900/95 border-neutral-700 text-neutral-100'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              {toastMsg.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              ) : toastMsg.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <Loader2 className={`w-4 h-4 shrink-0 text-emerald-400 ${isProcessing ? 'animate-spin' : ''}`} />
              )}
              <span className="leading-snug">{toastMsg.text}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {toastMsg.actionLabel && toastMsg.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    const fn = toastMsg.onAction;
                    setToastMsg(null);
                    fn?.();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer transition-colors"
                >
                  {toastMsg.actionLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => setToastMsg(null)}
                className="p-1 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alerta Global */}
      {alertMsg && (
        <div className={`p-3.5 rounded-xl flex items-center justify-between gap-2.5 font-bold text-xs mb-6 shadow-md transition-all ${
          alertMsg.type === 'error' 
            ? 'bg-red-950/60 border border-red-900 text-red-400' 
            : alertMsg.type === 'success'
            ? 'bg-emerald-950/60 border border-emerald-900 text-emerald-400'
            : 'bg-neutral-900 border border-neutral-700 text-neutral-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {alertMsg.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            ) : (
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
            )}
            <span>{alertMsg.text}</span>
          </div>
          {alertMsg.actionLabel && alertMsg.onAction && (
            <button
              type="button"
              onClick={alertMsg.onAction}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shrink-0 cursor-pointer transition-colors"
            >
              {alertMsg.actionLabel}
            </button>
          )}
        </div>
      )}

      {/* Input de archivo oculto global para la sección de comprobantes */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.pdf"
        onChange={e => {
          const selected = e.target.files && e.target.files[0];
          if (selected) {
            handleImageInput(selected, false);
          }
          e.target.value = '';
        }}
      />

      {activeSubTab === 'nuevo' ? (
        <div className="grid lg:grid-cols-[1.1fr_1.4fr] gap-6">
          
          {/* COLUMNA IZQUIERDA: FORMULARIO Y CARGA */}
          <div className="space-y-5">
            
            {/* 1. CARGA DE COMPROBANTE (IA OCR) + RECEPCIÓN DIRECTA DESDE WHATSAPP */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 shadow-sm">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                <h3 className="text-xs font-sans font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-red-500" />
                  1. Carga de comprobante (WhatsApp / Imagen o PDF)
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  {receivedFromWhatsApp && (previewImage || previewPdfDataUrl || sharedFileMeta) && (
                    <span className="text-[10px] font-sans font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-700/60 px-2 py-0.5 rounded-full">
                      Recibido de WhatsApp
                    </span>
                  )}
                  {(previewImage || previewPdfDataUrl || sharedFileMeta) && (
                    <>
                      <button
                        type="button"
                        onClick={handleReintentarLectura}
                        disabled={isProcessing}
                        className="text-[11px] text-amber-300 hover:text-amber-200 bg-amber-950/50 hover:bg-amber-900/50 disabled:opacity-50 px-2.5 py-1 rounded border border-amber-700/60 transition-colors cursor-pointer font-bold inline-flex items-center gap-1"
                        title="Volver a analizar el soporte de pago con Gemini Vision"
                      >
                        <RefreshCw className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} />
                        <span>Reintentar lectura</span>
                      </button>
                      <button
                        type="button"
                        onClick={triggerNativeFilePicker}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-800/60 transition-colors cursor-pointer font-bold"
                      >
                        Cambiar Soporte
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setPreviewImage(null);
                          setPreviewPdfDataUrl(null);
                          setSharedFileMeta(null);
                          setReceivedFromWhatsApp(false);
                          setPreviewZoom(1);
                          setMissingFields({});
                          setLastOcrPayload(null);
                          setIsProcessing(false);
                        }}
                        className="text-[11px] text-neutral-400 hover:text-red-400 bg-neutral-900 px-2 py-1 rounded border border-neutral-800 transition-colors cursor-pointer inline-flex items-center gap-1"
                        title="Quitar soporte actual"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Quitar</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Barra Directa de WhatsApp (Evita buscar en la galería) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={handlePasteFromWhatsAppButton}
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-sans font-bold text-xs shadow-sm transition-all cursor-pointer"
                  title="Pega con 1 toque el comprobante copiado en WhatsApp sin entrar a la galería"
                >
                  {isProcessing && processingLabel === 'Leyendo portapapeles...' ? (
                    <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                  ) : (
                    <ClipboardPaste className="w-4 h-4 shrink-0" />
                  )}
                  <span>Pegar Soporte de WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareFromWhatsAppButton}
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/50 disabled:opacity-60 text-emerald-300 border border-emerald-700/60 font-sans font-bold text-xs transition-all cursor-pointer"
                  title="Seleccionar comprobante de WhatsApp (Imagen o PDF) o ver guía de envío directo"
                >
                  <Share2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>Compartir desde WhatsApp</span>
                </button>
              </div>

              {/* Panel desplegable para Compartir directo desde el menú nativo de WhatsApp */}
              {showWhatsAppGuide && (
                <div className="mb-3 p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/60 text-xs font-sans text-neutral-200 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 shrink-0" />
                      <span>Cómo enviar el soporte (JPG, PNG o PDF) directo desde WhatsApp:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowWhatsAppGuide(false)}
                      className="text-neutral-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-neutral-300 leading-relaxed">
                    <p>
                      <strong className="text-emerald-300">Opción A · Compartir directo desde WhatsApp a la App:</strong>{' '}
                      En WhatsApp abre la foto o documento PDF del pago → toca los 3 puntos <strong>⋮</strong> (arriba a la derecha) → toca <strong>Compartir</strong> → selecciona <strong>FDV Cobros</strong>. La app se abrirá directo en este módulo con el soporte cargado y analizado automáticamente.
                    </p>
                    <p>
                      <strong className="text-emerald-300">Opción B · Copiar en WhatsApp y Pegar aquí en 1 toque:</strong>{' '}
                      En WhatsApp toca la foto del pago → toca <strong>Copiar</strong> → vuelve a la app y toca el botón verde <strong>"Pegar Soporte de WhatsApp"</strong>.
                    </p>
                  </div>

                  <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-800/40">
                    <button
                      type="button"
                      onClick={triggerNativeFilePicker}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-emerald-300 border border-emerald-700/50 font-bold text-[11px] cursor-pointer transition-colors"
                    >
                      Elegir archivo de WhatsApp / Recientes ahora
                    </button>

                    {!isStandalonePwa && canInstallPwa && (
                      <button
                        type="button"
                        onClick={handleEnableWhatsAppShareTarget}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer transition-colors"
                      >
                        Activar en menú Compartir de WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!previewImage && !previewPdfDataUrl && !(sharedFileMeta && sharedFileMeta.isPdf) ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={triggerNativeFilePicker}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      triggerNativeFilePicker();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                      setReceivedFromWhatsApp(true);
                      handleImageInput(e.dataTransfer.files[0], true);
                    }
                  }}
                  className="border-2 border-dashed border-neutral-800 hover:border-red-600 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer bg-neutral-900/40 hover:bg-neutral-900 transition-all text-center min-h-[125px] group relative overflow-hidden"
                >
                  {isProcessing ? (
                    <div className="flex flex-col items-center justify-center py-2">
                      <Loader2 className="w-7 h-7 text-emerald-500 animate-spin mb-2" />
                      <span className="text-xs font-bold text-emerald-400 animate-pulse">
                        {processingLabel || 'Analizando soporte de pago...'}
                      </span>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-7 h-7 text-neutral-400 group-hover:text-red-500 transition-colors mb-2" />
                      <span className="text-sm text-neutral-200 font-bold">
                        Comparte desde WhatsApp (Imagen o PDF), Pega o Toca aquí
                      </span>
                      <span className="text-xs text-neutral-500 mt-1 max-w-[320px]">
                        Acepta <strong>JPG, PNG, WEBP, HEIC</strong> y documentos <strong>PDF</strong> (máx. 10 MB) compartidos directo desde WhatsApp
                      </span>
                    </>
                  )}
                </div>
              ) : previewPdfDataUrl || (sharedFileMeta && sharedFileMeta.isPdf) ? (
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden relative flex flex-col justify-between p-3.5 min-h-[185px]">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-neutral-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-2 rounded-lg bg-red-950/60 border border-red-800/60 text-red-400 shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          {sharedFileMeta?.name || 'Comprobante_Pago.pdf'}
                        </p>
                        <p className="text-[10px] font-mono text-neutral-400">
                          Documento PDF &bull; {formatFileSize(sharedFileMeta?.size)}
                        </p>
                      </div>
                    </div>
                    {previewPdfDataUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setModalZoom(1);
                          setSelectedReceiptModal({
                            nombre_cliente: nombreCliente || 'Vista Previa PDF',
                            referencia: referencia || 'En edición',
                            fileMimeType: 'application/pdf',
                            fileDataUrl: previewPdfDataUrl,
                            fileName: sharedFileMeta?.name || 'Comprobante.pdf'
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Ampliar PDF</span>
                      </button>
                    )}
                  </div>

                  {previewPdfDataUrl && (
                    <div className="mt-2 h-32 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950">
                      <iframe
                        src={previewPdfDataUrl}
                        title="Previsualización de PDF"
                        className="w-full h-full border-0"
                      />
                    </div>
                  )}

                  {isProcessing && (
                    <div className="absolute inset-0 bg-neutral-950/85 flex flex-col items-center justify-center z-10 backdrop-blur-xs">
                      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
                      <span className="text-emerald-400 text-xs font-bold animate-pulse">
                        {processingLabel || 'Analizando soporte de pago...'}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden relative flex flex-col">
                  {/* Cabecera con nombre, peso y controles de Zoom para comparar el soporte contra los datos extraídos */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-neutral-800 bg-neutral-950/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold text-white truncate">
                        {sharedFileMeta?.name || 'soporte_whatsapp.jpg'}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                        ({formatFileSize(sharedFileMeta?.size)})
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
                        className="p-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 cursor-pointer"
                        title="Reducir zoom"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewZoom((z) => (z >= 3 ? 1 : Number((z + 0.5).toFixed(1))))}
                        className="px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-[10px] font-mono font-bold text-emerald-400 border border-neutral-800 cursor-pointer"
                        title="Alternar nivel de zoom"
                      >
                        {previewZoom}x
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewZoom((z) => Math.min(3, Number((z + 0.5).toFixed(1))))}
                        className="p-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 cursor-pointer"
                        title="Aumentar zoom para inspeccionar dígitos"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="relative flex items-center justify-center h-52 overflow-auto group bg-neutral-950/40">
                    <img
                      src={previewImage!}
                      alt="Comprobante"
                      style={{
                        transform: `scale(${previewZoom})`,
                        transformOrigin: 'center center'
                      }}
                      className="w-full h-full object-contain transition-transform duration-150"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setModalZoom(1);
                        setSelectedReceiptModal({
                          nombre_cliente: nombreCliente || 'Vista Previa de Soporte',
                          referencia: referencia || 'En edición',
                          fileMimeType: sharedFileMeta?.mimeType || 'image/jpeg',
                          image: previewImage,
                          fileName: sharedFileMeta?.name || 'soporte_whatsapp.jpg'
                        });
                      }}
                      className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-neutral-950/80 hover:bg-neutral-900 text-white text-[11px] font-bold border border-neutral-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Ampliar</span>
                    </button>
                    {isProcessing && (
                      <div className="absolute inset-0 bg-neutral-950/85 flex flex-col items-center justify-center z-10 backdrop-blur-xs">
                        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
                        <span className="text-emerald-400 text-xs font-bold animate-pulse">
                          {processingLabel || 'Analizando soporte de pago...'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 2. FORMULARIO DE COBRO Y CLIENTE */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-2">
                <h3 className="text-xs font-sans font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  2. Datos del Pago y Cliente
                </h3>
                {(missingFields.fecha || missingFields.referencia || missingFields.monto || missingFields.banco) && (
                  <span className="text-[10px] font-sans font-bold text-amber-300 bg-amber-950/50 border border-amber-700/60 px-2 py-0.5 rounded-full">
                    Completa los campos resaltados en ámbar
                  </span>
                )}
              </div>

              {/* Fila Cliente: Código con Autocompletado + Nombre */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 relative">
                {/* Código de Cliente */}
                <div className="relative">
                  <label className="text-[10px] font-sans font-bold text-neutral-400 uppercase tracking-wider mb-1 block">
                    Cód. Cliente (C.C) *
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={codigoCliente} 
                      onChange={e => handleCodigoChange(e.target.value)}
                      onBlur={handleCodigoBlur}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder="Ej: 1001 o nombre" 
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 pr-8 text-white text-sm focus:border-red-500 focus:outline-none transition-colors" 
                    />
                    <Search className="w-4 h-4 text-neutral-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {/* Dropdown de Sugerencias */}
                  {showSuggestions && clientSuggestions.length > 0 && (
                    <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                      {clientSuggestions.map((c, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => selectClient(c)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-800 border-b border-neutral-800/60 last:border-0 flex justify-between items-center transition-colors"
                        >
                          <span className="font-bold text-white truncate max-w-[70%]">{c.cliente || c.razonSocial}</span>
                          <span className="text-[10px] font-mono text-neutral-400 bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800">
                            #{c.id}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Nombre / Razón Social del Cliente */}
                <div>
                  <label className="text-[10px] font-sans font-bold text-neutral-400 uppercase tracking-wider mb-1 block">
                    Nombre / Razón Social *
                  </label>
                  <input 
                    type="text" 
                    value={nombreCliente} 
                    onChange={e => setNombreCliente(e.target.value)} 
                    placeholder="Nombre del cliente" 
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 text-sm focus:border-red-500 focus:outline-none transition-colors" 
                  />
                </div>
              </div>

              {/* RUC / RIF del Cliente si existe */}
              {rucCliente && (
                <div className="text-[11px] text-neutral-400 bg-neutral-900/60 p-2 rounded border border-neutral-800/60 flex items-center justify-between">
                  <span>Código de Cartera: <strong className="text-white">#{rucCliente}</strong></span>
                  <span className="text-emerald-400 font-bold">Cliente Vinculado</span>
                </div>
              )}

              {/* Fila Factura, Método de Pago y Tasa BCV */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="text-[10px] font-sans font-bold text-neutral-400 uppercase tracking-wider mb-1 block">
                    Nro. de Factura *
                  </label>
                  <input 
                    type="text" 
                    value={factura} 
                    onChange={e => setFactura(e.target.value)} 
                    placeholder="Ej: 001-002" 
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-white text-sm focus:border-red-500 focus:outline-none transition-colors" 
                  />
                </div>

                <div>
                  <label className="text-[10px] font-sans font-bold text-neutral-400 uppercase tracking-wider mb-1 block">
                    Método de Pago *
                  </label>
                  <select
                    value={metodoPago}
                    onChange={e => setMetodoPago(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-white text-sm focus:border-red-500 focus:outline-none transition-colors"
                  >
                    <option value="Pago Móvil">Pago Móvil</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Zelle">Zelle</option>
                    <option value="Divisas Efectivo">Divisas Efectivo</option>
                    <option value="Biopago">Biopago</option>
                    <option value="Divisas">Divisas</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Biopago / Punto">Biopago / Punto</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-sans font-bold text-neutral-400 uppercase tracking-wider mb-1 block">
                    Tasa Oficial (BCV) *
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={tasa} 
                    onChange={e => setTasa(e.target.value)} 
                    placeholder="0.00" 
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-white text-sm focus:border-red-500 focus:outline-none transition-colors" 
                  />
                </div>
              </div>

              {/* Fila Banco y Monto */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-sans font-bold text-neutral-400 uppercase tracking-wider block">
                      Banco
                    </label>
                    {missingFields.banco && (
                      <span className="text-[10px] font-sans font-bold text-amber-400">
                        Completar manual
                      </span>
                    )}
                  </div>
                  <input 
                    type="text" 
                    value={banco} 
                    onChange={e => {
                      setBanco(e.target.value);
                      if (e.target.value.trim()) {
                        setMissingFields((prev) => ({ ...prev, banco: false }));
                      }
                    }} 
                    placeholder="Ej: BBVA Provincial / Banesco" 
                    className={`w-full bg-neutral-900 border rounded-lg p-2.5 text-white text-sm focus:outline-none transition-colors ${
                      missingFields.banco
                        ? 'border-amber-500 ring-1 ring-amber-500/40 bg-amber-950/20 focus:border-amber-400'
                        : 'border-neutral-800 focus:border-red-500'
                    }`} 
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-sans font-bold text-neutral-400 uppercase tracking-wider block">
                      Monto (Bs.) *
                    </label>
                    {missingFields.monto ? (
                      <span className="text-[10px] font-sans font-bold text-amber-400">
                        Completar manual
                      </span>
                    ) : montoNumerico > 0 && parseFloat(tasa) > 0 ? (
                      <span className="text-[11px] font-mono text-emerald-400 font-bold">
                        ≈ ${(montoNumerico / parseFloat(tasa)).toFixed(2)} USD
                      </span>
                    ) : null}
                  </div>
                  <input 
                    type="text" 
                    value={montoDisplay} 
                    onChange={e => handleMontoChange(e.target.value)} 
                    onBlur={handleMontoBlur}
                    placeholder="0,00" 
                    className={`w-full bg-neutral-900 border rounded-lg p-2.5 text-emerald-400 font-mono font-bold text-sm focus:outline-none transition-colors ${
                      missingFields.monto
                        ? 'border-amber-500 ring-1 ring-amber-500/40 bg-amber-950/20 focus:border-amber-400'
                        : 'border-neutral-800 focus:border-red-500'
                    }`} 
                  />
                </div>
              </div>

              {/* Fila Referencia y Fecha de Pago */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-sans font-bold text-neutral-400 uppercase tracking-wider block">
                      Nro. de Referencia *
                    </label>
                    {missingFields.referencia && (
                      <span className="text-[10px] font-sans font-bold text-amber-400">
                        Completar manual
                      </span>
                    )}
                  </div>
                  <input 
                    type="text" 
                    value={referencia} 
                    onChange={e => {
                      setReferencia(e.target.value);
                      if (e.target.value.trim()) {
                        setMissingFields((prev) => ({ ...prev, referencia: false }));
                      }
                    }} 
                    placeholder="Ej: 000019111" 
                    className={`w-full bg-neutral-900 border rounded-lg p-2.5 text-white font-mono text-sm focus:outline-none transition-colors ${
                      missingFields.referencia
                        ? 'border-amber-500 ring-1 ring-amber-500/40 bg-amber-950/20 focus:border-amber-400'
                        : 'border-neutral-800 focus:border-red-500'
                    }`} 
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-sans font-bold text-neutral-400 uppercase tracking-wider block">
                      Fecha de Pago *
                    </label>
                    {missingFields.fecha && (
                      <span className="text-[10px] font-sans font-bold text-amber-400">
                        Verificar fecha
                      </span>
                    )}
                  </div>
                  <input 
                    type="date" 
                    value={fechaPago} 
                    onChange={e => {
                      setFechaPago(e.target.value);
                      if (e.target.value) {
                        setMissingFields((prev) => ({ ...prev, fecha: false }));
                      }
                    }} 
                    className={`w-full bg-neutral-900 border rounded-lg p-2.5 text-white text-sm focus:outline-none transition-colors ${
                      missingFields.fecha
                        ? 'border-amber-500 ring-1 ring-amber-500/40 bg-amber-950/20 focus:border-amber-400'
                        : 'border-neutral-800 focus:border-red-500'
                    }`} 
                  />
                </div>
              </div>

              {/* Fila Cuenta / Canal y Titular / RIF */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="text-[10px] font-sans font-bold text-neutral-400 uppercase tracking-wider mb-1 block">
                    Cuenta / Canal Detectado
                  </label>
                  <input 
                    type="text" 
                    value={cuentaCanal} 
                    onChange={e => handleCuentaCanalChange(e.target.value)} 
                    placeholder="Ej: 0108*****40*****7396" 
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 font-mono text-xs focus:border-red-500 focus:outline-none transition-colors" 
                  />
                </div>

                <div>
                  <label className="text-[10px] font-sans font-bold text-neutral-400 uppercase tracking-wider mb-1 block">
                    Titular / Remitente
                  </label>
                  <input 
                    type="text" 
                    value={titular} 
                    onChange={e => setTitular(e.target.value)} 
                    placeholder="Nombre del emisor" 
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-neutral-300 text-sm focus:border-red-500 focus:outline-none transition-colors" 
                  />
                </div>

                <div>
                  <label className="text-[10px] font-sans font-bold text-neutral-400 uppercase tracking-wider mb-1 block">
                    R.I.F. / C.I. Titular
                  </label>
                  <input 
                    type="text" 
                    value={rifTitular} 
                    onChange={e => setRifTitular(e.target.value)} 
                    placeholder="Ej: V-18293041" 
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-neutral-300 text-sm focus:border-red-500 focus:outline-none transition-colors" 
                  />
                </div>
              </div>

              {/* Botón de Consolidación */}
              <button 
                type="button"
                onClick={handleSave} 
                disabled={isProcessing}
                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all uppercase tracking-wider text-sm shadow-lg cursor-pointer"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Consolidar Pago en la Relación
              </button>
            </div>
          </div>

          {/* COLUMNA DERECHA: RELACIÓN DE COBROS ACTUAL */}
          <div className="border border-neutral-800 rounded-xl bg-neutral-950 flex flex-col h-[680px] shadow-sm overflow-hidden">
            {/* Header Relación */}
            <div className="p-4 border-b border-neutral-800 bg-neutral-900/60 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-sans font-bold text-neutral-300 uppercase tracking-wider">
                  Relación de Cobros Actual
                </h3>
                <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                  Vendedor: {currentVendedor}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {pagosConsolidados.length > 0 && (
                  <button 
                    onClick={generarRelacionPDF} 
                    className="flex items-center gap-1.5 text-xs font-bold bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-white px-3 py-1.5 rounded-lg border border-neutral-700 transition-all uppercase tracking-wider shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-red-400" />
                    Exportar PDF
                  </button>
                )}
                <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-900/60 font-mono">
                  {pagosConsolidados.length} {pagosConsolidados.length === 1 ? 'pago' : 'pagos'}
                </span>
              </div>
            </div>

            {/* Lista de Pagos */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {pagosConsolidados.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="bg-neutral-900 p-4 rounded-full border border-neutral-800 mb-3">
                    <FileText className="w-8 h-8 text-neutral-600" />
                  </div>
                  <p className="text-sm font-sans font-bold text-neutral-400 mb-1">No hay cobros en la relación actual</p>
                  <p className="text-xs text-neutral-600 max-w-[240px]">
                    Comparte el soporte (imagen o PDF) desde WhatsApp o completa los datos a la izquierda y presiona "Consolidar Pago".
                  </p>
                </div>
              ) : (
                pagosConsolidados.map((pago: any) => {
                  const m = Number(pago.monto) || 0;
                  const t = Number(pago.tasa) || 0;
                  const usd = t > 0 ? (m / t).toFixed(2) : null;
                  const hasAttachment = Boolean(pago.comprobante_url || pago.image || pago.fileDataUrl);
                  const isPdfAttachment = pago.fileMimeType === 'application/pdf' || String(pago.comprobante_url || '').endsWith('.pdf');
                  return (
                    <div 
                      key={pago.id} 
                      className="bg-neutral-900/70 border border-neutral-800 rounded-lg p-3.5 text-sm relative group hover:border-neutral-700 transition-colors shadow-xs"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="pr-2">
                          <p className="font-bold text-white text-sm leading-snug">
                            {pago.nombre_cliente || 'Cliente sin nombre'}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <span className="text-[10px] text-neutral-400 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800 font-mono">
                              Fact: {pago.factura || 'N/A'}
                            </span>
                            <span className="text-[10px] text-neutral-400 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800 font-mono">
                              C.C: {pago.codigo_cliente || 'N/A'}
                            </span>
                            {pago.metodo_pago && (
                              <span className="text-[10px] text-sky-300 bg-sky-950/40 px-2 py-0.5 rounded border border-sky-800/60 font-sans font-bold">
                                {pago.metodo_pago}
                              </span>
                            )}
                            {pago.syncStatus === 'synced' ? (
                              <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/60 font-sans font-bold inline-flex items-center gap-1">
                                <Cloud className="w-3 h-3" />
                                Sincronizado
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/60 font-sans font-bold inline-flex items-center gap-1">
                                <CloudOff className="w-3 h-3" />
                                En Cola Offline
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-emerald-400 font-mono font-bold text-sm">
                            {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(m)} Bs
                          </p>
                          {usd && (
                            <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                              ~ ${usd} USD
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs text-neutral-400 border-t border-neutral-800/80 pt-2.5 mt-2">
                        <span className="truncate max-w-[45%] text-neutral-400 text-[11px]">
                          {pago.banco}
                        </span>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-neutral-400 text-[11px]">
                            Ref: {pago.referencia}
                          </span>
                          {hasAttachment && (
                            <button
                              type="button"
                              onClick={() => setSelectedReceiptModal(pago)}
                              className="text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                              title="Ver comprobante adjunto"
                            >
                              <Eye className="w-3 h-3" />
                              <span>{isPdfAttachment ? 'Ver PDF' : 'Ver Soporte'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEliminarPago(pago.id)}
                            className="text-neutral-500 hover:text-red-400 transition-colors p-1 cursor-pointer"
                            title="Eliminar este pago de la relación"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Relación */}
            {pagosConsolidados.length > 0 && (
              <div className="p-4 border-t border-neutral-800 bg-neutral-900/60 space-y-2.5">
                <div className="flex justify-between items-center text-xs font-mono px-1">
                  <span className="text-neutral-400">Total a Relacionar:</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    Bs. {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(
                      pagosConsolidados.reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0)
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button"
                    onClick={generarRelacionPDF}
                    className="bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2.5 rounded-lg text-xs transition-colors uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer border border-neutral-700"
                  >
                    <Download className="w-3.5 h-3.5 text-red-400" />
                    Exportar PDF
                  </button>

                  <button 
                    type="button"
                    onClick={handleEnviarCuentasPorCobrar}
                    className="bg-white hover:bg-neutral-200 text-neutral-950 font-bold py-2.5 rounded-lg text-xs transition-colors uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Archivar Relación
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VISTA: HISTORIAL DE RELACIONES */
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-sans font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <History className="w-5 h-5 text-red-500" />
              Historial de Relaciones Enviadas
            </h2>
            <span className="text-xs font-bold text-neutral-400 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800 font-mono">
              {historialRelaciones.length} {historialRelaciones.length === 1 ? 'relación' : 'relaciones'}
            </span>
          </div>

          {historialRelaciones.length === 0 ? (
            <div className="text-center py-14 bg-neutral-950 border border-neutral-800 rounded-xl">
              <History className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-400 text-sm font-sans font-bold mb-1">No hay relaciones en el historial</p>
              <p className="text-neutral-600 text-xs">
                Cuando finalices una relación de cobros y presiones "Archivar Relación", aparecerá aquí para consultar y reenviar.
              </p>
            </div>
          ) : (
            <div className="grid gap-3.5">
              {historialRelaciones.map(rel => {
                const pagos = Array.isArray(rel.pagos) ? rel.pagos : [];
                const montoTotal = Number(rel.montoTotal) || pagos.reduce((acc: number, curr: any) => acc + (Number(curr.monto) || 0), 0);
                return (
                  <details key={rel.id} className="bg-neutral-950 border border-neutral-800 rounded-xl group overflow-hidden shadow-xs">
                    <summary className="p-4 bg-neutral-900/60 hover:bg-neutral-800/60 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors list-none">
                      <div className="flex items-center gap-3">
                        <div className="bg-emerald-950/40 border border-emerald-900/50 p-2 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white mb-0.5 tracking-wide">
                            Relación {new Date(rel.fecha).toLocaleDateString('es-VE')}
                          </h3>
                          <p className="text-[11px] text-neutral-400 font-mono">
                            {new Date(rel.fecha).toLocaleTimeString('es-VE')} &bull; Vendedor: {rel.vendedor || currentVendedor}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-6 md:gap-8">
                        <div>
                          <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-0.5">Pagos</p>
                          <p className="text-sm font-bold text-neutral-300 font-mono">{pagos.length}</p>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-0.5">Monto Total</p>
                          <p className="text-sm font-bold text-emerald-400 font-mono">
                            Bs. {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(montoTotal)}
                          </p>
                        </div>

                        <div className="text-neutral-500 group-open:rotate-180 transition-transform">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </summary>

                    <div className="p-4 border-t border-neutral-800 bg-neutral-950">
                      <div className="flex justify-end mb-3">
                        <button
                          type="button"
                          onClick={() => generarPDFDesdeHistorial(rel)}
                          className="flex items-center gap-1.5 text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white px-3.5 py-2 rounded-lg border border-neutral-700 transition-colors uppercase tracking-wider shadow-sm cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-red-400" />
                          Exportar PDF (Reenviar)
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-neutral-800 text-[10px] font-sans text-neutral-500 uppercase tracking-wider">
                              <th className="pb-2 font-bold">Cliente</th>
                              <th className="pb-2 font-bold text-center">Banco</th>
                              <th className="pb-2 font-bold text-center">Referencia</th>
                              <th className="pb-2 font-bold text-right">Monto (Bs.)</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs font-mono text-neutral-300">
                            {pagos.map((p: any, idx: number) => (
                              <tr key={idx} className="border-b border-neutral-800/40 last:border-0 hover:bg-neutral-900/30 transition-colors">
                                <td className="py-2.5 font-sans">
                                  <div className="font-bold text-white">{p.nombre_cliente || p.codigo_cliente}</div>
                                  <div className="text-[10px] text-neutral-500">
                                    C.C: {p.codigo_cliente} &bull; Fac: {p.factura || 'Sin factura'}
                                  </div>
                                </td>
                                <td className="py-2.5 text-center text-neutral-400">{p.banco}</td>
                                <td className="py-2.5 text-center text-neutral-400">{p.referencia}</td>
                                <td className="py-2.5 text-right font-bold text-emerald-400">
                                  Bs. {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(Number(p.monto) || 0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Previsualización de Soporte (Imagen o PDF) */}
      {selectedReceiptModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedReceiptModal(null)}
        >
          <div
            className="bg-neutral-950 border border-neutral-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between gap-3 bg-neutral-900/60">
              <div className="min-w-0">
                <h4 className="text-sm font-sans font-bold text-white truncate">
                  {selectedReceiptModal.nombre_cliente || 'Soporte de Pago'}
                </h4>
                <p className="text-[11px] font-mono text-neutral-400">
                  Ref: {selectedReceiptModal.referencia || 'N/A'}
                  {selectedReceiptModal.metodo_pago ? ` • ${selectedReceiptModal.metodo_pago}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!(
                  selectedReceiptModal.fileMimeType === 'application/pdf' ||
                  String(selectedReceiptModal.comprobante_url || '').endsWith('.pdf')
                ) && (
                  <div className="flex items-center gap-1 mr-1">
                    <button
                      type="button"
                      onClick={() => setModalZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
                      className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 cursor-pointer"
                      title="Reducir zoom"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalZoom((z) => (z >= 3 ? 1 : Number((z + 0.5).toFixed(1))))}
                      className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-mono font-bold text-emerald-400 cursor-pointer"
                      title="Alternar zoom"
                    >
                      {modalZoom}x
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalZoom((z) => Math.min(3, Number((z + 0.5).toFixed(1))))}
                      className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 cursor-pointer"
                      title="Aumentar zoom"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {selectedReceiptModal.comprobante_url && (
                  <a
                    href={selectedReceiptModal.comprobante_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir en Nube</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedReceiptModal(null)}
                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-neutral-950 min-h-[380px]">
              {selectedReceiptModal.fileMimeType === 'application/pdf' ||
              String(selectedReceiptModal.comprobante_url || '').endsWith('.pdf') ? (
                <iframe
                  src={selectedReceiptModal.fileDataUrl || selectedReceiptModal.comprobante_url}
                  title="Soporte PDF"
                  className="w-full h-[65vh] rounded-lg border border-neutral-800 bg-white"
                />
              ) : (
                <img
                  src={
                    selectedReceiptModal.image ||
                    selectedReceiptModal.fileDataUrl ||
                    selectedReceiptModal.comprobante_url
                  }
                  alt="Soporte de pago"
                  style={{
                    transform: `scale(${modalZoom})`,
                    transformOrigin: 'center center'
                  }}
                  className="max-w-full max-h-[65vh] object-contain rounded-lg transition-transform duration-150"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const CobrosOCR: React.FC<CobrosOCRProps> = (props) => {
  return (
    <CobrosErrorBoundary>
      <CobrosOCRInner {...props} />
    </CobrosErrorBoundary>
  );
};
