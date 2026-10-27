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
  descripcion: string;
  unidad_medida?: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface StrictOrderPayload {
  id?: string;
  correlativo?: string;
  cadena: 'ALKOSTO' | 'FAMILIA CENTER';
  id_cliente: string;
  sucursal_cliente: string;
  numero_oc: string;
  direccion_despacho: string;
  observacion_formateada: string;
  vendedor: string;
  renglones: StrictOrderRenglon[];
  total_renglones: number;
  monto_pedido: number;
  estado: 'POR VALIDAR';
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
  kilosPorCaja: number;
  totalKilos: number;
  precioUnitarioUSD: number;
  subtotalUSD: number;
}

export interface AlkostoOrder {
  id: string;
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
  cadena?: 'ALKOSTO' | 'FAMILIA CENTER';
  sucursal_cliente?: string;
  numero_oc?: string;
  direccion_despacho?: string;
  observacion_formateada?: string;
  vendedor?: string;
  renglones?: StrictOrderRenglon[];
  total_renglones?: number;
  monto_pedido?: number;
  origen?: 'APP FDV' | string;
  strict_payload?: StrictOrderPayload;
}

export interface CodizulcaNotaPedidoItem {
  renglon: number;
  unid: string; // 'CJ' | 'KG' | 'UND' | 'BLT'
  cantSolicitada: number;
  cantDespachada?: number | string;
  codigo: string;
  skuCodizulca?: string;
  codigoBarra?: string;
  descripcion: string;
  precio: number;
  subtotal: number;
  tiendas?: Record<string, number>;
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
  sede: string;
  fechaEmision: string;
  fechaEntrega: string;
  diasCredito: number;
  tasaCambio: number;
  proveedorNombre: string;
  proveedorRif: string;
  observaciones?: string;
  subtotal: number;
  subtotalAlkosto?: number;
  subtotalFamiliaCenter?: number;
  items: Array<{
    renglon: number;
    codigo: string;
    skuCodizulca?: string;
    codigoBarra?: string;
    descripcion: string;
    iva?: number;
    emp?: number;
    unid: string;
    totalCantidad: number;
    cantDespachada?: number | string;
    costoBruto?: number;
    costoUnitario: number;
    totalRenglon: number;
    tiendas?: Record<string, number>;
  }>;
}
