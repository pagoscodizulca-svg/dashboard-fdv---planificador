export type Role = 'ADMIN' | 'SUPERVISOR' | 'VENDEDOR';

export interface VolumenData {
  id: string;
  vendedorId: string;
  vendedorNombre?: string;
  vendedorEmail?: string;
  skuId: string;
  sku?: string;
  articulo?: string;
  cliente: string;
  categoria: string; // Rubro / Categoría
  meta: number;
  metaKg?: number;
  ejecutado: number;
  ejecutadoKg?: number;
  zona: string;
  lat?: number;
  lng?: number;
}

export interface ActivacionData {
  id: string;
  vendedorId: string;
  cliente: string;
  status: 'ACTIVO' | 'INACTIVO';
  cats?: {
    ACEITE?: number;
    AZUCAR?: number;
    POLLO?: number;
    ESTANDAR_ASTURIAS?: number;
    MORTADELA_SALPICAO?: number;
    ARROZ?: number;
    ENTERO?: number;
    LIGEROS?: number;
    [key: string]: number | undefined;
  };
  cajas?: {
    ACEITE?: number;
    AZUCAR?: number;
    POLLO?: number;
    ESTANDAR_ASTURIAS?: number;
    MORTADELA_SALPICAO?: number;
    [key: string]: number | undefined;
  };
}

export interface ClientStats {
  cliente: string;
  zona: string;
  metaTotal: number;
  ejecutadoTotal: number;
  brecha: number;
  cumplimiento: number;
  statusActivacion: 'ACTIVO' | 'INACTIVO' | 'DESCONOCIDO';
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA' | 'CUMPLIDO';
}

export type EstadoDegustacion = 'SOLICITADA' | 'APROBADA' | 'RECHAZADA' | 'REALIZADA' | 'CANCELADA';
export type TurnoDegustacion = 'MAÑANA' | 'TARDE' | 'COMPLETO';

export interface Degustacion {
  id: string;
  clienteCodigo: string;
  clienteNombre: string;
  vendedorNombre: string;
  vendedorId: string;
  vendedorEmail?: string;
  ruta: string;
  fecha: string; // YYYY-MM-DD
  turno: TurnoDegustacion;
  hora?: string; // Ej: '09:00 AM', '10:30 AM', '02:00 PM'
  productos: string[];
  kilosEstimados: number;
  personasEstimadas: number;
  requierePromotora: boolean;
  promotoraAsignada?: string;
  materialPop: boolean;
  contactoPunto?: string;
  telefonoContacto?: string;
  observaciones?: string;
  estado: EstadoDegustacion;
  notasTradeMarketing?: string;
  resultado?: {
    kilosDegustados?: number;
    personasAlcanzadas?: number;
    ventasGeneradas?: string;
    comentarios?: string;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface DegustacionConfig {
  maxPorDia: number;
  maxPorTurnoManana: number;
  maxPorTurnoTarde: number;
  diasBloqueados: string[];
  anticipacionMinimaDias: number;
}

export interface HorarioSlot {
  hora: string;
  turno: TurnoDegustacion;
  disponible: boolean;
  degustacion?: Degustacion;
}

export type EstadoPedidoAlkosto = 'BORRADOR' | 'POR VALIDAR' | 'POR_VALIDAR' | 'ENVIADO' | 'APROBADO' | 'DESPACHADO' | 'ENTREGADO' | 'CANCELADO';

export interface StrictOrderRenglon {
  codigo: string;
  sku?: string;
  descripcion: string;
  unidad_medida?: string;
  cantidad: number;
  cajas?: number;
  unidades?: number;
  kilos?: number;
  precio_unitario: number;
  precio_bruto?: number;
  descuento?: number;
  subtotal: number;
}

export interface StrictOrderPayload {
  id?: string;
  idempotency_key?: string;
  correlativo?: string;
  cadena: 'ALKOSTO' | 'FAMILIA CENTER';
  id_cliente: string;
  sucursal_cliente: string;
  sucursal_tag?: string;
  numero_oc: string;
  direccion_despacho: string;
  observacion_formateada: string;
  vendedor: string;
  renglones: StrictOrderRenglon[];
  total_renglones: number;
  monto_pedido: number;
  estado: 'POR VALIDAR';
  estado_sala_espera?: 'POR_VALIDAR';
  origen: 'APP FDV';
  fecha?: string;
  supervisor?: string;
  chofer?: string;
  cantidad_cestas?: string | number;
}

export interface AlkostoOrderItem {
  id: string;
  sku: string;
  producto: string;
  categoria: string;
  presentacion: string;
  cantidadCajas: number;
  cajas?: number;
  unidades?: number;
  kilosPorCaja: number;
  totalKilos: number;
  precioUnitarioUSD: number;
  precioBrutoUSD?: number;
  descuento?: number;
  subtotalUSD: number;
}

export interface AlkostoOrder {
  id: string;
  idempotencyKey?: string;
  salaEsperaId?: string;
  estadoSalaEspera?: string;
  numeroPedido: string;
  correlativo?: string;
  ordenCompraAlkosto?: string;
  sucursalCodigo: string;
  sucursalNombre: string;
  direccionEntrega?: string;
  vendedora: string;
  ruta: string;
  fechaPedido: string;
  fechaEntregaEstimada: string;
  items: AlkostoOrderItem[];
  totalBultos: number;
  totalKilos: number;
  totalUSD: number;
  estado: EstadoPedidoAlkosto;
  condicionPago: string;
  contactoRecepcion?: string;
  telefonoRecepcion?: string;
  observaciones?: string;
  transmitido_a_pedidos_manuales?: boolean;
  fecha_transmision?: string;
  createdAt: string;
  updatedAt?: string;
  // Campos del Esquema de Datos Normalizado (Strict Payload)
  sucursalTag?: string;
  cadena?: 'ALKOSTO' | 'FAMILIA CENTER';
  sucursal_cliente?: string;
  numero_oc?: string;
  direccion_despacho?: string;
  observacion_formateada?: string;
  vendedor?: string;
  renglones?: StrictOrderRenglon[];
  total_renglones?: number;
  monto_pedido?: number;
  totalNeto?: number;
  origen?: 'APP FDV' | string;
  strict_payload?: StrictOrderPayload;
}

export interface DistribucionPorTiendaItem {
  codigoTienda: string;
  nombreTienda: string;
  cantidad: number;
}

export interface AlkostoOcCabeceraOrden {
  cliente_emisor: string;
  receptor_destino: string;
  numero_orden_compra: string;
  fecha_emision: string;
  fecha_entrega_estimada: string | null;
  moneda: string | null;
  condicion_pago: string | null;
  observaciones_generales: string | null;
}

export interface AlkostoOcDistribucionTienda {
  codigo_tienda: string | null;
  nombre_tienda: string;
  cantidad: number;
}

export interface AlkostoOcRenglonExtraido {
  numero_renglon: number;
  codigo_principal: string;
  codigo_ean: string | null;
  codigo_interno_alkosto: string | null;
  descripcion_producto: string;
  unidad_medida: string;
  unidades_por_empaque: number;
  cantidad_total: number;
  distribucion_tiendas: AlkostoOcDistribucionTienda[];
  costo_unitario: number;
  porcentaje_descuento: number;
  porcentaje_impuesto: number;
  monto_total_renglon: number;
  alerta_revision: boolean;
  nota_revision: string | null;
}

export interface AlkostoOcResumenTotales {
  total_renglones_extraidos: number;
  total_unidades_pedidas: number;
  subtotal_neto: number;
  total_descuentos: number;
  total_impuestos: number;
  monto_total_orden: number;
  cuadre_aritmetico_correcto: boolean;
}

export interface AlkostoOcCanonicalPayload {
  cabecera_orden: AlkostoOcCabeceraOrden;
  renglones: AlkostoOcRenglonExtraido[];
  resumen_totales: AlkostoOcResumenTotales;
}

export interface CodizulcaNotaPedidoItem {
  renglon: number;
  unid: string; // 'CJ' | 'KG' | 'UND' | 'BLT'
  cantSolicitada: number;
  cajas?: number;
  unidades?: number;
  cantDespachada?: number | string;
  codigo: string;
  codigoPrincipal?: string;
  skuCodizulca?: string;
  codigoBarra?: string;
  codigoEan?: string | null;
  codigoInternoAlkosto?: string | null;
  descripcion: string;
  precio: number;
  valorUnitarioOC?: number;
  precioBruto?: number;
  descuento?: number;
  subtotal: number;
  tiendas?: Record<string, number>;
  distribucionPorTienda?: DistribucionPorTiendaItem[];
  distribucion_tiendas?: AlkostoOcDistribucionTienda[];
  alertaRevision?: boolean;
  notaRevision?: string | null;
}

export interface ParsedOrdenCompraAlkosto {
  clienteCadena?: 'ALKOSTO' | 'FAMILIA_CENTER' | string;
  cadenasDetectadas?: Array<'ALKOSTO' | 'FAMILIA_CENTER' | 'VECINO_CENTER'>;
  clienteNombre?: string;
  idCliente?: string;
  ruta?: string;
  supervisor?: string;
  chofer?: string;
  cantidadCestas?: string | number;
  nroPedido?: string;
  ordenNro: string;
  numeroOrden?: string;
  numero_oc?: string;
  sede: string;
  fechaEmision: string;
  fechaOrden?: string;
  fecha_emision?: string;
  fechaEntrega: string;
  moneda?: 'USD' | 'BS' | string;
  condicionPago?: string;
  diasCredito: number;
  tasaCambio: number;
  proveedorNombre: string;
  proveedorRif: string;
  observaciones?: string;
  subtotal: number;
  montoTotal?: number;
  subtotalAlkosto?: number;
  subtotalFamiliaCenter?: number;
  subtotalGeneral?: number;
  totalNeto?: number;
  tiendas?: string[];
  tiendasDetectadas?: string[];
  cabecera_orden?: AlkostoOcCabeceraOrden;
  renglones?: AlkostoOcRenglonExtraido[];
  resumen_totales?: AlkostoOcResumenTotales;
  items: Array<{
    renglon: number;
    codigo: string;
    codigoProducto?: string;
    codigoPrincipal?: string;
    skuCodizulca?: string;
    codigoBarra?: string;
    ean?: string | null;
    codigoEan?: string | null;
    codigoInternoAlkosto?: string | null;
    descripcion: string;
    iva?: number;
    emp?: number;
    unid: string;
    totalCantidad: number;
    cantidadTotal?: number;
    cantDespachada?: number | string;
    costoBruto?: number;
    descuento?: number;
    costoUnitario: number;
    precioUnitario?: number;
    valorUnitarioOC?: number;
    totalRenglon: number;
    subtotal?: number;
    tiendas?: Record<string, number>;
    desglosePorTienda?: Array<{ tienda: string; cantidad: number }>;
    distribucionPorTienda?: DistribucionPorTiendaItem[];
    distribucion_tiendas?: AlkostoOcDistribucionTienda[];
    cuadreTiendasValido?: boolean;
    alertaRevision?: boolean;
    notaRevision?: string | null;
  }>;
}

// ============================================================================
// MÓDULO PLANIFICADOR DE RUTA INTELIGENTE (RUTERO FDV - FASE 1)
// ============================================================================

export type DiaSemanaRuta = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO';

export type EstadoVisitaRuta = 'PENDIENTE' | 'EFECTIVA_PEDIDO' | 'GESTION_COBRO' | 'SIN_VENTA';

export type MotivoNoVentaRuta =
  | 'INVENTARIO_ALTO'
  | 'SIN_CUPO_CREDITO'
  | 'ENCARGADO_AUSENTE'
  | 'LOCAL_CERRADO'
  | 'PRECIO_COMPETENCIA'
  | 'OTRO';

export type PrioridadRutaCliente = 'ALTA_INACTIVO' | 'ALTA_CIERRE_5' | 'MEDIA_DESARROLLO' | 'CUMPLIDO_5';

export interface AsignacionClienteRuta {
  clienteKey: string;
  clienteId: string;
  clienteNombre: string;
  vendedorId: string;
  dias: DiaSemanaRuta[];
  orden?: number;
  zona?: string;
  notasFijas?: string;
  updatedAt: string;
}

export interface RegistroVisitaRuta {
  id: string;
  fecha: string; // YYYY-MM-DD
  diaSemana: DiaSemanaRuta;
  clienteKey: string;
  clienteId: string;
  clienteNombre: string;
  vendedorId: string;
  estado: EstadoVisitaRuta;
  motivoNoVenta?: MotivoNoVentaRuta;
  rubrosOfrecidos?: string[];
  montoEstimadoUSD?: number;
  observacion?: string;
  checkInTimestamp: string;
  coords?: {
    lat: number;
    lng: number;
  };
}

export interface ClienteRutaEnriquecido {
  clienteKey: string;
  clienteId: string;
  clienteNombre: string;
  vendedorId: string;
  zona?: string;
  diasAsignados: DiaSemanaRuta[];
  orden?: number;
  notasFijas?: string;
  isActivoMes: boolean;
  rubrosComprados: string[];
  rubrosFaltantes: string[];
  totalRubrosActivos: number;
  prioridad: PrioridadRutaCliente;
  prioridadScore: number;
  ejecutadoKgMes: number;
  metaKgMes: number;
  visitaHoy?: RegistroVisitaRuta;
}

export interface ResumenJornadaRuta {
  diaSeleccionado: DiaSemanaRuta;
  fechaISO: string;
  totalCarteraVendedor: number;
  totalConDiaAsignado: number;
  totalSinDiaAsignado: number;
  programadosHoy: number;
  visitadosHoy: number;
  pendientesHoy: number;
  efectivosPedidoHoy: number;
  gestionCobroHoy: number;
  sinVentaHoy: number;
  inactivosProgramadosHoy: number;
  porcentajeAvanceRuta: number;
  porcentajeEfectividad: number;
}

