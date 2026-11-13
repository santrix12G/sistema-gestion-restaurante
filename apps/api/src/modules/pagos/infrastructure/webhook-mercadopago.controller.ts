import { Body, Controller, ForbiddenException, Headers, HttpCode, Logger, Post, Query } from '@nestjs/common';
import { Publico } from '../../identidad';
import { leerConfig } from '../../../shared/config';
import { ProcesarNotificacionUseCase } from '../application/procesar-notificacion.use-case';
import { firmaMercadoPagoValida } from './firma-mercadopago';

// Solo la parte del aviso de MercadoPago que se usa
interface AvisoMercadoPago {
  type?: string;
  action?: string;
  data?: { id?: string | number };
}

/**
 * Webhook que se registra en MercadoPago: https://TU-DOMINIO/api/webhooks/mercadopago
 * Es público porque lo llama MercadoPago, pero cada aviso se valida con la firma x-signature.
 */
@Controller('webhooks/mercadopago')
export class WebhookMercadoPagoController {
  private readonly logger = new Logger('Webhook');
  private readonly secreto = leerConfig().pagos.mercadopago.secretoWebhook;

  constructor(private readonly procesar: ProcesarNotificacionUseCase) {}

  /**
   * A diferencia de los webhooks del chatbot, aquí se procesa antes de responder:
   * si algo falla, la respuesta es un error y MercadoPago reintenta. Si se respondiera 200 de una vez,
   * un fallo después dejaría el pago sin confirmar para siempre. MercadoPago espera hasta 22 segundos.
   */
  @Publico()
  @Post()
  @HttpCode(200)
  async recibir(
    @Query('data.id') idEnUrl: string | undefined,
    @Query('type') tipoEnUrl: string | undefined,
    @Headers('x-signature') xSignature: string | undefined,
    @Headers('x-request-id') xRequestId: string | undefined,
    @Body() aviso: AvisoMercadoPago,
  ) {
    // MercadoPago firma el data.id que va en la URL
    const dataId = idEnUrl ?? (aviso?.data?.id !== undefined ? String(aviso.data.id) : undefined);
    if (!firmaMercadoPagoValida({ xSignature, xRequestId, dataId, secreto: this.secreto })) {
      throw new ForbiddenException('Firma inválida');
    }

    // Solo interesan los pagos. Otros avisos (por ejemplo, de órdenes comerciales) se confirman y se ignoran.
    if ((tipoEnUrl ?? aviso?.type) !== 'payment' || !dataId) return { recibido: true };

    const resultado = await this.procesar.ejecutar(dataId);
    if (!resultado.cambio) this.logger.debug(`Aviso de MercadoPago ${dataId}: ${resultado.motivo}`);
    return { recibido: true };
  }
}
