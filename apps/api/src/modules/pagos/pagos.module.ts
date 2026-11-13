import { Module } from '@nestjs/common';
import { leerConfig } from '../../shared/config';
import { CrearEnlacePagoUseCase } from './application/crear-enlace-pago.use-case';
import { PAGO_REPOSITORY } from './application/pago.repository';
import { PASARELA } from './application/pasarela';
import { ProcesarNotificacionUseCase } from './application/procesar-notificacion.use-case';
import { PasarelaMercadoPago } from './infrastructure/mercadopago.pasarela';
import { PasarelaNoConfigurada } from './infrastructure/pasarela-no-configurada';
import { PrismaPagoRepository } from './infrastructure/prisma-pago.repository';
import { WebhookMercadoPagoController } from './infrastructure/webhook-mercadopago.controller';

// MERCADOPAGO_ACCESS_TOKEN del .env elige la pasarela. Sin token, el pago en línea queda apagado y solo se ofrece efectivo.
function crearPasarela() {
  return leerConfig().pagos.mercadopago.accessToken ? new PasarelaMercadoPago() : new PasarelaNoConfigurada();
}

@Module({
  controllers: [WebhookMercadoPagoController],
  providers: [
    CrearEnlacePagoUseCase,
    ProcesarNotificacionUseCase,
    { provide: PAGO_REPOSITORY, useClass: PrismaPagoRepository },
    { provide: PASARELA, useFactory: crearPasarela },
  ],
  exports: [CrearEnlacePagoUseCase],
})
export class PagosModule {}
