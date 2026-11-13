import { Module } from '@nestjs/common';
import { CrearEnlacePagoUseCase } from './application/crear-enlace-pago.use-case';
import { PAGO_REPOSITORY } from './application/pago.repository';
import { PASARELA } from './application/pasarela';
import { ProcesarNotificacionUseCase } from './application/procesar-notificacion.use-case';
import { PasarelaNoConfigurada } from './infrastructure/pasarela-no-configurada';
import { PrismaPagoRepository } from './infrastructure/prisma-pago.repository';
import { WebhookMercadoPagoController } from './infrastructure/webhook-mercadopago.controller';

// El adaptador de MercadoPago se agrega en el siguiente paso. Mientras tanto, el pago en línea queda apagado.
@Module({
  controllers: [WebhookMercadoPagoController],
  providers: [
    CrearEnlacePagoUseCase,
    ProcesarNotificacionUseCase,
    { provide: PAGO_REPOSITORY, useClass: PrismaPagoRepository },
    { provide: PASARELA, useFactory: () => new PasarelaNoConfigurada() },
  ],
  exports: [CrearEnlacePagoUseCase],
})
export class PagosModule {}
