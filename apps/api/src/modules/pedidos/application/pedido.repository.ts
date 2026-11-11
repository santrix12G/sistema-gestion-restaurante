// Puerto de persistencia: los casos de uso dependen de esta interfaz, no de Prisma.
import { PedidoEvento } from '../../../shared/eventos';
import { TipoMesa } from '../domain/mesa';
import { Alcance, EstadoCierre, EstadoPedido, LineaCalculada, TipoPedido } from '../domain/pedido';

export type CanalPedido = 'WEB' | 'MOVIL' | 'WHATSAPP' | 'TELEGRAM';

export interface PedidoVista {
  id: string;
  numero: number;
  tipo: TipoPedido;
  canal: CanalPedido;
  estado: EstadoPedido;
  /** Su código (M3, L1, AF2) se arma con `codigoMesa` */
  mesa: { tipo: TipoMesa; numero: number } | null;
  /** Mesero que lo registró. Vacío si llegó por el chatbot */
  creadoPor: { id: string; nombre: string } | null;
  cliente: { nombre: string | null; telefono: string } | null;
  entrega: {
    direccionTexto: string;
    estado: string;
    direccion: { barrio: string | null; referencia: string | null };
    repartidor: { id: string; nombre: string } | null;
  } | null;
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
  canal: CanalPedido;
  mesaId?: string;
  clienteId?: string;
  creadoPorId?: string;
  claveIdempotencia?: string;
  entrega?: { direccionId: string; direccionTexto: string };
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
  /**
   * Los pedidos que el alcance deja ver. Los activos, del más antiguo al más nuevo.
   * Los cerrados desde una fecha (`cerradosDesde`), del último cerrado al primero.
   */
  listar(filtro: { estados: EstadoPedido[]; alcance: Alcance; cerradosDesde?: Date }): Promise<PedidoVista[]>;
  /** Cierra el pedido solo si sigue activo. Devuelve false si otro usuario lo cerró antes. */
  cerrar(id: string, hasta: EstadoCierre, usuarioId: string): Promise<boolean>;
  /** Asigna el domicilio al repartidor solo si nadie lo ha tomado. Devuelve false si otro lo tomó antes. */
  tomarDomicilio(id: string, repartidorId: string): Promise<boolean>;
}

export const PEDIDO_REPOSITORY = Symbol('PedidoRepository');

export function aEvento(p: PedidoVista): PedidoEvento {
  return { pedidoId: p.id, numero: p.numero, tipo: p.tipo, canal: p.canal, estado: p.estado, total: p.total, telefonoCliente: p.cliente?.telefono ?? null };
}
