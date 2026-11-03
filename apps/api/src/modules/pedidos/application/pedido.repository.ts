// Puerto de persistencia: los casos de uso dependen de esta interfaz, no de Prisma.
import { EstadoPedido, LineaCalculada, TipoPedido } from '../domain/pedido';

export interface PedidoVista {
  id: string;
  numero: number;
  tipo: TipoPedido;
  canal: 'WEB' | 'MOVIL' | 'WHATSAPP';
  estado: EstadoPedido;
  mesa: { numero: number } | null;
  cliente: { nombre: string | null; telefono: string } | null;
  subtotal: number;
  costoDomicilio: number;
  total: number;
  notas: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
  detalles: { id: string; nombreProducto: string; precioUnitario: number; cantidad: number; subtotal: number; notas: string | null }[];
}

export interface NuevoPedido {
  tipo: TipoPedido;
  canal: 'WEB' | 'MOVIL' | 'WHATSAPP';
  estado: EstadoPedido;
  mesaId?: string;
  clienteId?: string;
  creadoPorId?: string;
  claveIdempotencia?: string;
  lineas: LineaCalculada[];
  subtotal: number;
  costoDomicilio: number;
  total: number;
  notas?: string;
}

export interface PedidoRepository {
  /** Guarda el pedido y su primer registro de historial. Si la clave de idempotencia ya existe, devuelve ese pedido. */
  crear(pedido: NuevoPedido): Promise<PedidoVista>;
  buscarPorClave(clave: string): Promise<PedidoVista | null>;
  obtener(id: string): Promise<PedidoVista | null>;
  listar(estados: EstadoPedido[]): Promise<PedidoVista[]>;
  /** Cambia el estado solo si sigue siendo `desde`. Devuelve false si otro usuario lo cambió antes. */
  cambiarEstado(id: string, desde: EstadoPedido, hasta: EstadoPedido, usuarioId: string): Promise<boolean>;
}

export const PEDIDO_REPOSITORY = Symbol('PedidoRepository');
