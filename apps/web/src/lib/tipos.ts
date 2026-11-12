// Formas de los datos que devuelve la API
export type Rol = 'ADMIN' | 'MESERO' | 'REPARTIDOR';
/** Un pedido está activo hasta que se cobra o se cancela. Si un domicilio va en camino lo dice su entrega */
export type EstadoPedido = 'ACTIVO' | 'PAGADO' | 'CANCELADO';
export type TipoPedido = 'MESA' | 'DOMICILIO' | 'RECOGER';
/** Normal (M1), larga (L1) o afuera (AF1) */
export type TipoMesa = 'NORMAL' | 'LARGA' | 'AFUERA';

export interface UsuarioSesion {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

/** Cuenta de un mesero o repartidor, como la ve el administrador */
export interface Cuenta {
  id: string;
  nombre: string;
  email: string;
  rol: Exclude<Rol, 'ADMIN'>;
  /** Una cuenta suspendida no puede entrar */
  activo: boolean;
  creadoEn: string;
  /** Pedidos abiertos a su cargo: mientras tenga, no se puede suspender ni cambiar de rol */
  pedidosActivos: number;
  /** Si ya registró o entregó pedidos no se puede borrar, solo suspender */
  tieneHistorial: boolean;
}

export interface Categoria {
  id: string;
  nombre: string;
  orden: number;
  activa: boolean;
}

export interface Producto {
  id: string;
  categoriaId: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  disponible: boolean;
  sinonimos: string[];
  categoria: { id: string; nombre: string };
}

export interface Mesa {
  id: string;
  tipo: TipoMesa;
  numero: number;
  /** M3, L1, AF2 */
  codigo: string;
  capacidad: number;
  /** Una mesa suspendida no aparece al tomar pedidos */
  activa: boolean;
  pedidosActivos: number;
  /** Si ya tuvo pedidos no se puede borrar, solo suspender */
  tienePedidos: boolean;
}

export interface Pedido {
  id: string;
  numero: number;
  tipo: TipoPedido;
  canal: 'WEB' | 'MOVIL' | 'WHATSAPP' | 'TELEGRAM';
  estado: EstadoPedido;
  mesa: { tipo: TipoMesa; numero: number } | null;
  /** Mesero que lo registró. Vacío si llegó por el chatbot */
  creadoPor: { id: string; nombre: string } | null;
  cliente: { nombre: string | null; telefono: string } | null;
  subtotal: number;
  costoDomicilio: number;
  total: number;
  notas: string | null;
  creadoEn: string;
  /** En un pedido cerrado, la hora en que se pagó o se canceló */
  actualizadoEn: string;
  entrega: {
    direccionTexto: string;
    estado: string;
    direccion: { barrio: string | null; referencia: string | null };
    /** Quién lo lleva: solo esa persona (o el administrador) puede cerrarlo */
    repartidor: { id: string; nombre: string } | null;
  } | null;
  detalles: { id: string; nombreProducto: string; precioUnitario: number; cantidad: number; subtotal: number; notas: string | null }[];
}

/** Cifras de un día para el administrador. `activos` solo viene para hoy */
export interface EstadisticasDia {
  fecha: string;
  ventas: { total: number; pedidos: number; promedio: number; platos: number };
  cancelados: { pedidos: number; total: number };
  activos: { pedidos: number; total: number } | null;
  porTipo: { tipo: TipoPedido; pedidos: number; total: number }[];
  porCanal: { canal: Pedido['canal']; pedidos: number; total: number }[];
  /** Las 24 horas del día en Colombia, por la hora en que llegó cada pedido pagado */
  porHora: { hora: number; pedidos: number; total: number }[];
  horaPico: number | null;
  masVendidos: { productoId: string; nombre: string; cantidad: number; total: number }[];
}
