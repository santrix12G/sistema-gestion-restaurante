// Reglas del pedido. Lógica pura: no conoce la base de datos ni HTTP.
import { DomainError } from '../../../shared/domain-error';

export type EstadoPedido = 'PENDIENTE' | 'CONFIRMADO' | 'EN_PREPARACION' | 'LISTO' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';
export type TipoPedido = 'MESA' | 'DOMICILIO' | 'RECOGER';
export type Rol = 'ADMIN' | 'MESERO' | 'COCINA' | 'REPARTIDOR';

export const ESTADOS_ACTIVOS: EstadoPedido[] = ['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'EN_CAMINO'];

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

const SIGUIENTES: Record<EstadoPedido, EstadoPedido[]> = {
  PENDIENTE: ['CONFIRMADO', 'CANCELADO'],
  CONFIRMADO: ['EN_PREPARACION', 'CANCELADO'],
  EN_PREPARACION: ['LISTO'],
  LISTO: ['EN_CAMINO', 'ENTREGADO'],
  EN_CAMINO: ['ENTREGADO'],
  ENTREGADO: [],
  CANCELADO: [],
};

/** Quién puede llevar un pedido a cada estado. ADMIN puede hacerlo todo. */
const ROLES_POR_DESTINO: Record<EstadoPedido, Rol[]> = {
  PENDIENTE: [],
  CONFIRMADO: ['ADMIN', 'MESERO'],
  EN_PREPARACION: ['ADMIN', 'COCINA'],
  LISTO: ['ADMIN', 'COCINA'],
  EN_CAMINO: ['ADMIN', 'REPARTIDOR'],
  ENTREGADO: ['ADMIN', 'MESERO', 'REPARTIDOR'],
  CANCELADO: ['ADMIN', 'MESERO'],
};

const NOMBRES: Record<EstadoPedido, string> = {
  PENDIENTE: 'pendiente',
  CONFIRMADO: 'confirmado',
  EN_PREPARACION: 'en preparación',
  LISTO: 'listo',
  EN_CAMINO: 'en camino',
  ENTREGADO: 'entregado',
  CANCELADO: 'cancelado',
};

/**
 * Lanza un error si el cambio de estado no está permitido.
 * `repartidorId` es quien sacó el domicilio a reparto: solo él puede marcarlo entregado.
 */
export function validarCambioEstado(
  pedido: { estado: EstadoPedido; tipo: TipoPedido; repartidorId?: string | null },
  nuevo: EstadoPedido,
  rol: Rol,
  usuarioId?: string,
): void {
  if (!SIGUIENTES[pedido.estado].includes(nuevo)) {
    const mensaje = pedido.estado === 'EN_PREPARACION' && nuevo === 'CANCELADO'
      ? 'Un pedido en preparación ya no se puede cancelar'
      : `Un pedido ${NOMBRES[pedido.estado]} no puede pasar a ${NOMBRES[nuevo]}`;
    throw new DomainError('conflicto', mensaje);
  }

  const esDomicilio = pedido.tipo === 'DOMICILIO';
  if (nuevo === 'EN_CAMINO' && !esDomicilio) throw new DomainError('conflicto', 'Solo los domicilios salen a reparto');
  if (pedido.estado === 'LISTO' && nuevo === 'ENTREGADO' && esDomicilio) {
    throw new DomainError('conflicto', 'Un domicilio debe salir a reparto antes de entregarse');
  }

  if (!ROLES_POR_DESTINO[nuevo].includes(rol)) throw new DomainError('prohibido', 'Tu rol no puede hacer este cambio de estado');
  // El mesero entrega en el local; el repartidor, a domicilio
  if (nuevo === 'ENTREGADO' && ((rol === 'MESERO' && esDomicilio) || (rol === 'REPARTIDOR' && !esDomicilio))) {
    throw new DomainError('prohibido', 'Tu rol no puede entregar este tipo de pedido');
  }
  if (nuevo === 'ENTREGADO' && rol === 'REPARTIDOR' && pedido.repartidorId && pedido.repartidorId !== usuarioId) {
    throw new DomainError('prohibido', 'Este domicilio lo lleva otro repartidor');
  }
}
