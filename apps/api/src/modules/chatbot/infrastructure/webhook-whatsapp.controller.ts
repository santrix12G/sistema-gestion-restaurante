import { Body, Controller, ForbiddenException, Get, Header, HttpCode, Logger, Post, Query, Req, type RawBodyRequest } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { normalizarTelefono } from '../../clientes';
import { Publico } from '../../identidad';
import { leerConfig } from '../../../shared/config';
import { MensajeEntrante, ProcesarMensajeUseCase } from '../application/procesar-mensaje.use-case';

// Solo la parte del aviso de Meta que usa el bot
interface AvisoMeta {
  object?: string;
  entry?: {
    changes?: {
      field?: string;
      value?: {
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: { from: string; id: string; type: string; text?: { body?: string } }[];
      };
    }[];
  }[];
}

/** Extrae los mensajes del aviso. Los avisos de estado (entregado, leído) no traen mensajes y se ignoran. */
export function mensajesDelAviso(aviso: AvisoMeta): MensajeEntrante[] {
  const mensajes: MensajeEntrante[] = [];
  for (const entrada of aviso.entry ?? []) {
    for (const cambio of entrada.changes ?? []) {
      const valor = cambio.value;
      for (const m of valor?.messages ?? []) {
        const contacto = valor?.contacts?.find((c) => c.wa_id === m.from) ?? valor?.contacts?.[0];
        mensajes.push({
          telefono: normalizarTelefono(`+${m.from}`),
          texto: m.type === 'text' ? m.text?.body : undefined,
          idExterno: m.id,
          nombre: contacto?.profile?.name,
        });
      }
    }
  }
  return mensajes;
}

/**
 * Webhook que se registra en Meta: https://TU-DOMINIO/api/webhooks/whatsapp
 * Es público porque lo llama Meta, pero cada aviso se valida con la firma de la app.
 */
@Controller('webhooks/whatsapp')
export class WebhookWhatsAppController {
  private readonly logger = new Logger('Webhook');
  private readonly config = leerConfig().whatsapp;

  constructor(private readonly procesar: ProcesarMensajeUseCase) {}

  /** Meta lo llama una vez, al registrar el webhook, para comprobar que el servidor es tuyo. */
  @Publico()
  @Get()
  @Header('Content-Type', 'text/plain')
  verificar(@Query('hub.mode') modo: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') reto: string) {
    if (modo === 'subscribe' && this.config.verifyToken && iguales(token ?? '', this.config.verifyToken)) return reto;
    throw new ForbiddenException('El token de verificación no coincide');
  }

  @Publico()
  @Post()
  @HttpCode(200)
  recibir(@Req() req: RawBodyRequest<Request>, @Body() aviso: AvisoMeta) {
    if (!this.firmaValida(req)) throw new ForbiddenException('Firma inválida');

    let mensajes: MensajeEntrante[] = [];
    try {
      mensajes = mensajesDelAviso(aviso);
    } catch (e) {
      this.logger.warn(`Aviso con un teléfono no válido: ${e instanceof Error ? e.message : e}`);
    }
    // Meta espera un 200 rápido; si tarda, reenvía el aviso. Se responde ya y se procesa después
    for (const mensaje of mensajes) {
      setImmediate(() => {
        this.procesar.ejecutar(mensaje).catch((e) => this.logger.error('Falló el procesamiento de un mensaje', e instanceof Error ? e.stack : e));
      });
    }
    return { recibido: true };
  }

  /** X-Hub-Signature-256 es el HMAC SHA-256 del cuerpo exacto que envió Meta, con el secreto de la app. */
  private firmaValida(req: RawBodyRequest<Request>) {
    const firma = req.headers['x-hub-signature-256'];
    if (!this.config.appSecret || typeof firma !== 'string' || !req.rawBody) return false;
    const esperada = `sha256=${createHmac('sha256', this.config.appSecret).update(req.rawBody).digest('hex')}`;
    return iguales(firma, esperada);
  }
}

/** Compara sin filtrar por tiempo cuántos caracteres coinciden. */
function iguales(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
