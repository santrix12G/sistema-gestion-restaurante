import { Body, Controller, ForbiddenException, Header, HttpCode, Logger, Post, Req } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { normalizarTelefono } from '../../clientes';
import { Publico } from '../../identidad';
import { leerConfig } from '../../../shared/config';
import { MensajeEntrante, ProcesarMensajeUseCase } from '../application/procesar-mensaje.use-case';

// Twilio envía el aviso como formulario. Solo los campos que usa el bot
type AvisoTwilio = Record<string, string | string[] | undefined>;

/**
 * X-Twilio-Signature: HMAC SHA-1, en base64, de la URL completa seguida de cada parámetro del formulario
 * (nombre y valor), ordenados por nombre. La clave es el Auth Token de la cuenta.
 */
export function firmaTwilio(url: string, parametros: AvisoTwilio, authToken: string) {
  const datos = Object.keys(parametros)
    .sort()
    .reduce((texto, clave) => {
      const valores = ([] as (string | undefined)[]).concat(parametros[clave]);
      return texto + valores.map((v) => `${clave}${v ?? ''}`).join('');
    }, url);
  return createHmac('sha1', authToken).update(datos, 'utf8').digest('base64');
}

const valor = (aviso: AvisoTwilio, campo: string) => {
  const v = aviso[campo];
  return Array.isArray(v) ? v[0] : v;
};

export function mensajeDelAvisoTwilio(aviso: AvisoTwilio): MensajeEntrante | undefined {
  const de = valor(aviso, 'From');
  const id = valor(aviso, 'MessageSid');
  if (!de?.startsWith('whatsapp:') || !id) return undefined;
  const texto = valor(aviso, 'Body');
  return {
    telefono: normalizarTelefono(de.slice('whatsapp:'.length)),
    // Una foto o un audio sin texto llegan con Body vacío: se tratan como mensaje que no es de texto
    texto: texto?.trim() ? texto : undefined,
    idExterno: id,
    nombre: valor(aviso, 'ProfileName'),
  };
}

/**
 * Webhook que se registra en Twilio: https://TU-DOMINIO/api/webhooks/twilio
 * Es público porque lo llama Twilio, pero cada aviso se valida con su firma.
 */
@Controller('webhooks/twilio')
export class WebhookTwilioController {
  private readonly logger = new Logger('Webhook Twilio');
  private readonly config = leerConfig().whatsapp.twilio;

  constructor(private readonly procesar: ProcesarMensajeUseCase) {}

  @Publico()
  @Post()
  @HttpCode(200)
  @Header('Content-Type', 'text/xml')
  recibir(@Req() req: Request, @Body() aviso: AvisoTwilio) {
    if (!this.firmaValida(req, aviso ?? {})) throw new ForbiddenException('Firma inválida');

    let mensaje: MensajeEntrante | undefined;
    try {
      mensaje = mensajeDelAvisoTwilio(aviso);
    } catch (e) {
      this.logger.warn(`Aviso con un teléfono no válido: ${e instanceof Error ? e.message : e}`);
    }
    // La respuesta se envía después por la API de Twilio; aquí solo se confirma el recibo, rápido
    if (mensaje) {
      const entrante = mensaje;
      setImmediate(() => {
        this.procesar.ejecutar(entrante).catch((e) => this.logger.error('Falló el procesamiento de un mensaje', e instanceof Error ? e.stack : e));
      });
    }
    return '<Response></Response>';
  }

  private firmaValida(req: Request, aviso: AvisoTwilio) {
    const firma = req.headers['x-twilio-signature'];
    if (!this.config.authToken || typeof firma !== 'string') return false;
    const esperada = firmaTwilio(this.urlPublica(req), aviso, this.config.authToken);
    const a = Buffer.from(firma);
    const b = Buffer.from(esperada);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** La URL que llamó Twilio. Detrás de ngrok o de un proxy, el protocolo real viene en X-Forwarded-Proto. */
  private urlPublica(req: Request) {
    if (this.config.urlWebhook) return this.config.urlWebhook;
    const reenviado = req.headers['x-forwarded-proto'];
    const protocolo = (typeof reenviado === 'string' ? reenviado.split(',')[0].trim() : undefined) ?? req.protocol;
    return `${protocolo}://${req.headers.host}${req.originalUrl}`;
  }
}
