// Puerto de persistencia: los casos de uso dependen de esta interfaz, no de Prisma.
import { EstadoPago } from '../domain/pago';

export interface PagoGuardado {
  id: string;
  pedidoId: string;
  estado: EstadoPago;
  monto: number;
  urlPago: string | null;
  creadoEn: Date;
}

export interface NuevoPagoEnLinea {
  id: string;
  pedidoId: string;
  monto: number;
  proveedor: string;
  referenciaExterna: string;
  urlPago: string;
}

export interface PagoRepository {
  /** Guarda un pago en línea, pendiente, con su enlace. */
  crearEnLinea(pago: NuevoPagoEnLinea): Promise<PagoGuardado>;
  obtener(id: string): Promise<PagoGuardado | null>;
  /** El pago en línea más reciente del pedido, si tiene alguno. */
  ultimoEnLinea(pedidoId: string): Promise<PagoGuardado | null>;
  /** Cambia el estado solo si sigue en `desde`. Devuelve false si otro aviso lo cambió antes. */
  cambiarEstado(id: string, desde: EstadoPago, hasta: EstadoPago): Promise<boolean>;
}

export const PAGO_REPOSITORY = Symbol('PagoRepository');
