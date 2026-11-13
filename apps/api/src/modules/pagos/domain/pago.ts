// Reglas del pago en línea. Lógica pura: no conoce la base de datos, HTTP ni MercadoPago.

export type EstadoPago = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'REEMBOLSADO';

/** Minutos que vale el enlace de pago. Después, el cliente paga en efectivo o pide uno nuevo. */
export const MINUTOS_VIGENCIA_ENLACE = 30;

/**
 * Traduce el estado que informa la pasarela (los de MercadoPago) al estado del pago en el sistema.
 * Devuelve undefined si el estado no cambia nada: por ejemplo, un pago en disputa (in_mediation).
 */
export function traducirEstado(estadoPasarela: string): EstadoPago | undefined {
  switch (estadoPasarela) {
    case 'approved':
      return 'APROBADO';
    case 'pending':
    case 'in_process':
    case 'authorized':
      return 'PENDIENTE';
    case 'rejected':
    case 'cancelled':
      return 'RECHAZADO';
    case 'refunded':
    case 'charged_back':
      return 'REEMBOLSADO';
    default:
      return undefined;
  }
}

/** Lo que el sistema sabe del pago. */
export interface PagoRegistrado {
  estado: EstadoPago;
  /** En pesos, sin decimales */
  monto: number;
}

/** Lo que la pasarela dice de un intento de pago. */
export interface PagoInformado {
  estado: string;
  monto: number;
  moneda: string;
}

export type Decision = { cambiar: true; nuevo: EstadoPago } | { cambiar: false; motivo: string };

/**
 * Decide si un aviso de la pasarela cambia el pago. Los avisos llegan repetidos y en desorden, así que:
 * - Un pago aprobado solo puede pasar a reembolsado: un rechazo viejo que llegue tarde no lo deshace.
 * - Un pago reembolsado ya no cambia.
 * - Uno pendiente o rechazado acepta cualquier estado nuevo: el cliente puede reintentar con otra tarjeta.
 * - No se aprueba si el monto o la moneda no coinciden con lo que se cobró.
 */
export function decidirCambio(actual: PagoRegistrado, informado: PagoInformado): Decision {
  const nuevo = traducirEstado(informado.estado);
  if (!nuevo) return { cambiar: false, motivo: `Estado de la pasarela sin efecto: ${informado.estado}` };
  if (nuevo === actual.estado) return { cambiar: false, motivo: 'El pago ya estaba en ese estado' };

  if (actual.estado === 'REEMBOLSADO') return { cambiar: false, motivo: 'El pago ya fue reembolsado' };
  if (actual.estado === 'APROBADO' && nuevo !== 'REEMBOLSADO') {
    return { cambiar: false, motivo: 'Un pago aprobado solo puede pasar a reembolsado' };
  }

  if (nuevo === 'APROBADO') {
    if (informado.moneda !== 'COP') return { cambiar: false, motivo: `Moneda inesperada: ${informado.moneda}` };
    if (Math.round(informado.monto) !== actual.monto) {
      return { cambiar: false, motivo: `El monto pagado (${informado.monto}) no coincide con el del pedido (${actual.monto})` };
    }
  }
  return { cambiar: true, nuevo };
}
