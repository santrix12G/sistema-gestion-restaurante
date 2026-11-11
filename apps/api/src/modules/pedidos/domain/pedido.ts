// Reglas del pedido. Lógica pura: no conoce la base de datos ni HTTP.
import { DomainError } from '../../../shared/domain-error';

/** Un pedido está ACTIVO hasta que se cobra (PAGADO) o se cancela. Si un domicilio va en camino lo dice su entrega. */
export type EstadoPedido = 'ACTIVO' | 'PAGADO' | 'CANCELADO';
export type EstadoCierre = Exclude<EstadoPedido, 'ACTIVO'>;
export type TipoPedido = 'MESA' | 'DOMICILIO' | 'RECOGER';
export type Rol = 'ADMIN' | 'MESERO' | 'REPARTIDOR';

export const ESTADOS: EstadoPedido[] = ['ACTIVO', 'PAGADO', 'CANCELADO'];
export const ESTADOS_CIERRE: EstadoCierre[] = ['PAGADO', 'CANCELADO'];

export const MAX_CANTIDAD_POR_LINEA = 50;

export interface LineaSolicitada {
  productoId: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  notas?: string;
}

export interface LineaCalculada extends LineaSolicitada {
  subtotal: number;
}

export function calcularTotales(lineas: LineaSolicitada[], costoDomicilio = 0) {
  if (lineas.length === 0) throw new DomainError('validacion', 'El pedido debe tener al menos un producto');
  for (const linea of lineas) {
    if (!Number.isInteger(linea.cantidad) || linea.cantidad < 1 || linea.cantidad > MAX_CANTIDAD_POR_LINEA) {
      throw new DomainError('validacion', `La cantidad de ${linea.nombre} debe estar entre 1 y ${MAX_CANTIDAD_POR_LINEA}`);
    }
  }
  const calculadas: LineaCalculada[] = lineas.map((l) => ({ ...l, subtotal: l.precioUnitario * l.cantidad }));
  const subtotal = calculadas.reduce((suma, l) => suma + l.subtotal, 0);
  return { lineas: calculadas, subtotal, costoDomicilio, total: subtotal + costoDomicilio };
}

/** Lo que las reglas necesitan saber de un pedido para decidir quién puede cambiarlo. */
export interface PedidoParaPermisos {
  estado: EstadoPedido;
  tipo: TipoPedido;
  /** Mesero que lo registró. Vacío si llegó por el chatbot */
  creadoPorId?: string | null;
  /** Repartidor que lo lleva. Vacío si nadie lo ha tomado */
  repartidorId?: string | null;
}

const NOMBRES: Record<EstadoPedido, string> = { ACTIVO: 'activo', PAGADO: 'pagado', CANCELADO: 'cancelado' };

/**
 * Lanza un error si el usuario no puede marcar el pedido como pagado o cancelado.
 * El administrador puede cerrar cualquiera. El mesero, solo los que él registró.
 * El repartidor, solo los domicilios que lleva. Los pedidos del chatbot para recoger los cierra el administrador.
 */
export function validarCierre(pedido: PedidoParaPermisos, nuevo: EstadoCierre, rol: Rol, usuarioId: string): void {
  if (pedido.estado !== 'ACTIVO') throw new DomainError('conflicto', `Este pedido ya está ${NOMBRES[pedido.estado]}`);
  if (rol === 'ADMIN') return;

  if (pedido.tipo === 'DOMICILIO') {
    if (rol !== 'REPARTIDOR') throw new DomainError('prohibido', 'Los domicilios los cierra el repartidor que los lleva');
    if (!pedido.repartidorId) throw new DomainError('conflicto', 'Primero toma el domicilio para llevarlo');
    if (pedido.repartidorId !== usuarioId) throw new DomainError('prohibido', 'Este domicilio lo lleva otro repartidor');
    return;
  }

  if (rol !== 'MESERO') throw new DomainError('prohibido', 'Tu rol no puede cerrar pedidos en mesa ni para recoger');
  if (!pedido.creadoPorId) throw new DomainError('prohibido', 'Los pedidos del chatbot para recoger los cierra el administrador');
  if (pedido.creadoPorId !== usuarioId) throw new DomainError('prohibido', 'Este pedido lo registró otro mesero');
}

/** Lanza un error si el usuario no puede tomar el domicilio para llevarlo. */
export function validarTomaDomicilio(pedido: PedidoParaPermisos, rol: Rol, usuarioId: string): void {
  if (rol !== 'REPARTIDOR') throw new DomainError('prohibido', 'Solo un repartidor puede llevar domicilios');
  if (pedido.tipo !== 'DOMICILIO') throw new DomainError('conflicto', 'Solo los domicilios salen a reparto');
  if (pedido.estado !== 'ACTIVO') throw new DomainError('conflicto', `Este pedido ya está ${NOMBRES[pedido.estado]}`);
  if (pedido.repartidorId === usuarioId) throw new DomainError('conflicto', 'Ya llevas este domicilio');
  if (pedido.repartidorId) throw new DomainError('conflicto', 'Otro repartidor ya tomó este domicilio');
}
