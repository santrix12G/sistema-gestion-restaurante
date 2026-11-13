import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../../../shared/domain-error';
import { MINUTOS_VIGENCIA_ENLACE } from '../domain/pago';
import { PAGO_REPOSITORY, PagoRepository } from './pago.repository';
import { PASARELA, Pasarela } from './pasarela';

/** Los datos del pedido que necesita el cobro. Los pasa quien llama, así pagos no depende del módulo de pedidos. */
export interface PedidoACobrar {
  pedidoId: string;
  numero: number;
  /** En pesos, sin decimales */
  total: number;
}

export interface EnlacePago {
  pagoId: string;
  url: string;
}

/**
 * Crea el enlace para pagar un pedido en línea.
 * Si el pedido ya tiene un enlace pendiente y vigente, devuelve ese: el cliente puede pedirlo otra vez sin duplicar cobros.
 */
@Injectable()
export class CrearEnlacePagoUseCase {
  constructor(
    @Inject(PAGO_REPOSITORY) private readonly pagos: PagoRepository,
    @Inject(PASARELA) private readonly pasarela: Pasarela,
  ) {}

  /** False si no hay pasarela configurada: entonces solo se ofrece efectivo. */
  get disponible(): boolean {
    return this.pasarela.disponible;
  }

  async ejecutar(pedido: PedidoACobrar, ahora = new Date()): Promise<EnlacePago> {
    if (!this.pasarela.disponible) throw new DomainError('conflicto', 'El pago en línea no está disponible');
    if (!Number.isInteger(pedido.total) || pedido.total <= 0) throw new DomainError('validacion', 'El total del pedido debe ser un entero positivo');

    const anterior = await this.pagos.ultimoEnLinea(pedido.pedidoId);
    if (anterior?.estado === 'APROBADO') throw new DomainError('conflicto', `El pedido #${pedido.numero} ya está pagado`);
    if (anterior?.estado === 'PENDIENTE' && anterior.urlPago && vigente(anterior.creadoEn, ahora)) {
      return { pagoId: anterior.id, url: anterior.urlPago };
    }

    // El id se genera antes de llamar a la pasarela: viaja en el enlace y vuelve en cada aviso.
    // Si la pasarela falla, no queda ningún pago a medias en la base de datos.
    const pagoId = randomUUID();
    const venceEn = new Date(ahora.getTime() + MINUTOS_VIGENCIA_ENLACE * 60_000);
    const enlace = await this.pasarela.crearEnlace({ pagoId, numeroPedido: pedido.numero, monto: pedido.total, venceEn });

    await this.pagos.crearEnLinea({
      id: pagoId,
      pedidoId: pedido.pedidoId,
      monto: pedido.total,
      proveedor: this.pasarela.nombre,
      referenciaExterna: enlace.referencia,
      urlPago: enlace.url,
    });
    return { pagoId, url: enlace.url };
  }
}

function vigente(creadoEn: Date, ahora: Date) {
  return ahora.getTime() - creadoEn.getTime() < MINUTOS_VIGENCIA_ENLACE * 60_000;
}
