// Formas de los datos que devuelve la API
export type Rol = 'ADMIN' | 'MESERO' | 'COCINA' | 'REPARTIDOR';
export type EstadoPedido = 'PENDIENTE' | 'CONFIRMADO' | 'EN_PREPARACION' | 'LISTO' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';
export type TipoPedido = 'MESA' | 'DOMICILIO' | 'RECOGER';

export interface UsuarioSesion {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
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
  numero: number;
  capacidad: number;
  pedidosActivos: number;
}

export interface Pedido {
  id: string;
  numero: number;
  tipo: TipoPedido;
  canal: 'WEB' | 'MOVIL' | 'WHATSAPP' | 'TELEGRAM';
  estado: EstadoPedido;
  mesa: { numero: number } | null;
  cliente: { nombre: string | null; telefono: string } | null;
  subtotal: number;
  costoDomicilio: number;
  total: number;
  notas: string | null;
  creadoEn: string;
  entrega: {
    direccionTexto: string;
    estado: string;
    direccion: { barrio: string | null; referencia: string | null };
    /** Quién lo sacó a reparto: solo esa persona puede marcarlo entregado */
    repartidor: { id: string; nombre: string } | null;
  } | null;
  detalles: { id: string; nombreProducto: string; precioUnitario: number; cantidad: number; subtotal: number; notas: string | null }[];
}

export interface MensajeChat {
  id: string;
  direccion: 'ENTRANTE' | 'SALIENTE';
  texto: string;
  creadoEn: string;
}
