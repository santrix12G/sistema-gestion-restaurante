import { Inject, Injectable, Logger } from '@nestjs/common';
import { BusEventos } from '../../../shared/eventos';
import { decidirCambio } from '../domain/pago';
import { PAGO_REPOSITORY, PagoRepository } from './pago.repository';
import { PASARELA, Pasarela } from './pasarela';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Intentos si otro aviso del mismo pago cambia el estado al mismo tiempo. */
const INTENTOS = 3;

export type ResultadoNotificacion = { cambio: true; estado: string } | { cambio: false; motivo: string };

/**
 * Atiende un aviso de la pasarela: "hubo novedades en el pago X".
 * El aviso no trae el estado, y aunque lo trajera no se le cree: se consulta el pago en la pasarela.
 * Los avisos llegan repetidos y en desorden; las reglas de domain/pago.ts deciden si cambian algo.
 */
@Injectable()
export class ProcesarNotificacionUseCase {
  private readonly logger = new Logger('Pagos');

  constructor(
    @Inject(PAGO_REPOSITORY) private readonly pagos: PagoRepository,
    @Inject(PASARELA) private readonly pasarela: Pasarela,
    private readonly bus: BusEventos,
  ) {}

  async ejecutar(idEnPasarela: string): Promise<ResultadoNotificacion> {
    const informado = await this.pasarela.consultarPago(idEnPasarela);
    if (!informado) return this.ignorar(idEnPasarela, 'La pasarela no conoce ese pago');
    if (!informado.pagoId || !UUID.test(informado.pagoId)) return this.ignorar(idEnPasarela, 'El pago no es de este sistema');

    for (let intento = 1; intento <= INTENTOS; intento++) {
      const pago = await this.pagos.obtener(informado.pagoId);
      if (!pago) return this.ignorar(idEnPasarela, 'El pago no está registrado');

      const decision = decidirCambio(pago, informado);
      if (!decision.cambiar) return this.ignorar(idEnPasarela, decision.motivo);

      if (await this.pagos.cambiarEstado(pago.id, pago.estado, decision.nuevo)) {
        this.logger.log(`Pago ${pago.id} del pedido ${pago.pedidoId}: ${pago.estado} → ${decision.nuevo}`);
        this.bus.publicar('pago.estado_cambiado', {
          pagoId: pago.id,
          pedidoId: pago.pedidoId,
          estado: decision.nuevo,
          estadoAnterior: pago.estado,
          monto: pago.monto,
        });
        return { cambio: true, estado: decision.nuevo };
      }
      // Otro aviso cambió el pago entre la lectura y la escritura: se vuelve a leer y a decidir
    }
    throw new Error(`El pago ${informado.pagoId} cambió ${INTENTOS} veces mientras se procesaba un aviso`);
  }

  private ignorar(idEnPasarela: string, motivo: string): ResultadoNotificacion {
    this.logger.log(`Aviso del pago ${idEnPasarela} sin cambios: ${motivo}`);
    return { cambio: false, motivo };
  }
}
