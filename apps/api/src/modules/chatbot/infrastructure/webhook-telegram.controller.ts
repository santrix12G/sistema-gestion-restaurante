import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { Publico } from '../../identidad';
import { leerConfig } from '../../../shared/config';
import { ActualizacionTelegram, CanalTelegram } from './telegram';

/**
 * Webhook de Telegram: https://TU-API/api/webhooks/telegram. La API lo registra sola al arrancar
 * si TELEGRAM_WEBHOOK_SECRET está definido. Telegram envía ese secreto en cada llamado.
 */
@Controller('webhooks/telegram')
export class WebhookTelegramController {
  private readonly secreto = leerConfig().telegram.secretoWebhook;

  constructor(private readonly telegram: CanalTelegram) {}

  @Publico()
  @Post()
  @HttpCode(200)
  recibir(@Headers('x-telegram-bot-api-secret-token') recibido: string | undefined, @Body() actualizacion: ActualizacionTelegram) {
    if (!this.secreto || !recibido || !iguales(recibido, this.secreto)) throw new ForbiddenException('Secreto inválido');
    // Se responde de inmediato; si Telegram espera demasiado, reenvía el mensaje
    setImmediate(() => this.telegram.entregar(actualizacion));
    return { recibido: true };
  }
}

function iguales(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
